/**
 * ==========================================================
 * Marketing 2.0
 * P1 School Mismatch Check
 *
 * Responsibility
 * 외부 "P1 School List" 스프레드시트(사용자/담당팀이 확정한 P1 학교 목록,
 * 오기입 변형 표기 포함)와 Leads_OPS를 양방향으로 대조한다:
 * (1) 리스트엔 P1 학교로 등록돼 있는데 Leads_OPS 상 effective Priority
 *     (Priority Override 우선, 없으면 Lead Priority — ACQREP_001_Report.js의
 *     isEffectiveP1_() 재사용)가 "Priority 1"이 아닌 리드를 검출·플래깅
 *     (`P1_School_Mismatch_QA` 시트).
 * (2) (역방향, 신규 리드 대상) 2026-09-04 이후 Create Date인
 *     리드 중 effective Priority는 P1인데 School Name이 리스트에 없는 경우를
 *     학교 단위로 집계 — 리스트에 추가할 학교 후보(`Not_Striked` 시트, 항상
 *     숨김).
 *
 * WHY (도입 배경, 2026-09-04)
 * `docs/OpenItems.md` #48 — 담당팀이 P1으로 확정한 학교 리드가 파이프라인
 * 상에서는 다른 Priority로 남아있는 경우가 종종 있어, 매 Leads Import마다
 * 자동으로 대조해 알려달라는 요청(사용자 확정 — 시트 내 플래깅, 이메일 없이 /
 * Leads Import 파이프라인에 자동 편입). 역방향 체크는 같은 세션 후속 요청 —
 * 반대로 파이프라인상 이미 P1인데 리스트가 아직 못 따라온 신규 학교도
 * 리스트업. 과거 누적 리드 전체로 확장하면 노이즈가 커져 "오늘부터
 * 새로 들어오는 리드"로 한정(사용자 확정).
 *
 * `runOPSQA_()`(OPS_006_QA.js)와 별개 — `runOPSQA_()`는 `buildLeadsOPS(true)`
 * (skipQA=true)로 매 자동 Import마다 스킵되므로, 이 체크는 그 스킵과 무관하게
 * 항상 도는 독립 파이프라인 단계로 분리(전용 결과 시트도 별도 —
 * `Leads_OPS_QA`와 소유권이 섞이면 서로의 전체 재작성이 상대방 결과를
 * 지울 위험이 있음).
 *
 * Must NOT
 * - Leads_OPS/Leads_Master 값을 직접 수정하지 않음(검출·기록만, 실제 Priority
 *   교정/P1 School List 추가는 사용자가 이 결과를 보고 수동으로 처리)
 * - isEffectiveP1_() 판정 로직을 다시 구현하지 않음(ACQREP_001_Report.js 재사용)
 *
 * Stage
 * OPS (Leads_OPS Build 도메인 — Leads_OPS를 읽어 대조하는 후속 체크)
 *
 * Version
 * v1.1.0
 *
 * Change Log
 * v1.1.0 (2026-09-04)
 * - **역방향 체크 신규**(사용자 후속 요청) — `computeMissingP1Schools_()`(순수
 *   함수)/`writeMissingP1SchoolsResults_()` 신규, `performP1SchoolMismatchCheck_()`가
 *   기존에 읽은 opsRecords/p1SchoolSet을 그대로 재사용(추가 Sheet I/O 없음).
 *   결과는 `OPS.P1_SCHOOL_MISMATCH.MISSING_SCHOOL_TRACKING.OUTPUT_SHEET`
 *   ("Not_Striked", 항상 숨김, OPS_001_Config.js v2.9)에 학교 단위로 집계.
 * v1.0.0 (2026-09-04)
 * - 최초 구현. `docs/OpenItems.md` #48.
 * ==========================================================
 */


/**
 * ==========================================================
 * Open P1 School List External Spreadsheet (IO 래퍼)
 *
 * WHY
 * OPS.P1_SCHOOL_MISMATCH.EXTERNAL.SPREADSHEET_ID가 비어있으면 추측으로
 * 진행하지 않고 명시적 에러로 실패한다("No Assumptions" 원칙,
 * MASTER_010_SALSync.js의 openSALExternalSpreadsheet_()와 동일 패턴).
 * ==========================================================
 */
function openP1SchoolListExternalSpreadsheet_(){

  const spreadsheetId = OPS.P1_SCHOOL_MISMATCH.EXTERNAL.SPREADSHEET_ID;

  if(!spreadsheetId){
    throw new Error(
      "OPS.P1_SCHOOL_MISMATCH.EXTERNAL.SPREADSHEET_ID가 비어있습니다 — " +
      "OPS_001_Config.js를 먼저 확인하세요."
    );
  }

  return SpreadsheetApp.openById(spreadsheetId);

}


/**
 * ==========================================================
 * Read P1 School List Raw Rows (IO 래퍼)
 *
 * WHY
 * "P1 School List" 탭에서 E열(School, 대표 학교명)부터 마지막 열까지 —
 * F~M열은 학교명과 무관한 다른 정보라 범위에 포함하되 순수 함수 쪽에서
 * 걸러낸다(N열부터가 오기입 변형 표기). DATA_START_ROW(4행)부터 읽어
 * 1~3행의 헤더/안내 문구를 제외한다.
 *
 * OUTPUT
 * Array[][]  각 행 = [School(E), F, G, ..., 마지막 열] — row[0]이 E열
 * ==========================================================
 */
function readP1SchoolListRawRows_(){

  const ext = OPS.P1_SCHOOL_MISMATCH.EXTERNAL;

  const ss = openP1SchoolListExternalSpreadsheet_();
  const sheet = ss.getSheetByName(ext.TAB_NAME);

  if(!sheet){
    throw new Error(
      "\"" + ext.TAB_NAME + "\" 탭을 찾을 수 없습니다 — " + ss.getUrl()
    );
  }

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if(lastRow < ext.DATA_START_ROW || lastColumn < ext.SCHOOL_COLUMN){
    return [];
  }

  const numRows = lastRow - ext.DATA_START_ROW + 1;
  const numCols = lastColumn - ext.SCHOOL_COLUMN + 1;

  return sheet.getRange(ext.DATA_START_ROW, ext.SCHOOL_COLUMN, numRows, numCols).getValues();

}


/**
 * ==========================================================
 * Compute P1 School Normalized Set (순수 함수)
 *
 * WHY
 * 각 행의 첫 칸(index 0 = E열, 대표 학교명)과 aliasStartColumnOffset부터
 * 끝까지(N열부터, 오기입 변형 표기)만 학교명으로 취급 — 그 사이(F~M열,
 * index 1~aliasStartColumnOffset-1)는 학교명과 무관한 다른 컬럼이라 건너뜀.
 * 대소문자/공백 차이로 인한 매칭 실패를 막기 위해 trim + lowercase로
 * 정규화한 키로 저장(원본 표기가 여러 개라도 하나의 Set으로 합쳐짐).
 *
 * @param {Array[][]} rows  readP1SchoolListRawRows_() 결과와 동일 모양
 * @param {number} aliasStartColumnOffset  row 배열 내 별칭 시작 index(N열 - E열)
 * @return {Object}  정규화된 학교명(lowercase, trim) → true
 *
 * TEST
 * computeP1SchoolNormalizedSet_([["ABC School","","","","","","","","","ABC Skool","abc school "]], 9)
 *   => {"abc school": true, "abc skool": true}  (2개 — 마지막 값이 trim 후 동일 키로 합쳐짐)
 * ==========================================================
 */
function computeP1SchoolNormalizedSet_(rows, aliasStartColumnOffset){

  const set = {};

  rows.forEach(function(row){

    row.forEach(function(cell, i){

      if(i > 0 && i < aliasStartColumnOffset) return;

      const trimmed = String(cell || "").trim();

      if(!trimmed) return;

      set[trimmed.toLowerCase()] = true;

    });

  });

  return set;

}


/**
 * ==========================================================
 * TEST — computeP1SchoolNormalizedSet_()
 * ==========================================================
 */
function testComputeP1SchoolNormalizedSet(){

  const rows = [
    ["ABC School", "ignore1", "ignore2", "ignore3", "ignore4", "ignore5", "ignore6", "ignore7", "ignore8", "ABC Skool", "abc school "],
    ["XYZ College"],
    ["", "", "", "", "", "", "", "", "", ""]
  ];

  const result = computeP1SchoolNormalizedSet_(rows, 9);

  const pass =
    result["abc school"] === true &&
    result["abc skool"] === true &&
    result["xyz college"] === true &&
    result["ignore1"] === undefined &&
    Object.keys(result).length === 3;

  Logger.log("computeP1SchoolNormalizedSet_ result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute P1 School Mismatches (순수 함수)
 *
 * WHY
 * Leads_OPS 레코드 중 School Name이 P1 학교 Set에 있는데, effective
 * Priority(isEffectiveP1_(), ACQREP_001_Report.js 재사용)가 P1이 아닌
 * 것만 골라낸다. School Name이 아예 없거나 P1 Set에 없는 리드는 이 체크
 * 대상이 아니므로 무시(정상).
 *
 * @param {Object[]} opsRecords  sheetToObjects(Leads_OPS) 결과
 * @param {Object} p1SchoolNormalizedSet  computeP1SchoolNormalizedSet_() 결과
 * @return {Object[]}  {leadId, email, schoolName, leadPriority, priorityOverride, effectivePriority}
 *
 * TEST
 * computeP1SchoolMismatches_(
 *   [
 *     {"Lead ID":"1","Email":"a@x.com","School Name":"ABC School","Lead Priority":"Priority 2","Priority Override":""},
 *     {"Lead ID":"2","Email":"b@x.com","School Name":"ABC School","Lead Priority":"Priority 1","Priority Override":""},
 *     {"Lead ID":"3","Email":"c@x.com","School Name":"ABC School","Lead Priority":"Priority 2","Priority Override":"Priority 1"},
 *     {"Lead ID":"4","Email":"d@x.com","School Name":"Unrelated School","Lead Priority":"Priority 2","Priority Override":""}
 *   ],
 *   {"abc school": true}
 * ) => [{leadId:"1", ...}]  (2번은 이미 P1, 3번은 Override로 P1, 4번은 리스트 밖 학교라 전부 제외)
 * ==========================================================
 */
function computeP1SchoolMismatches_(opsRecords, p1SchoolNormalizedSet){

  const mismatches = [];

  opsRecords.forEach(function(record){

    const schoolName = String(record["School Name"] || "").trim();

    if(!schoolName) return;

    const key = schoolName.toLowerCase();

    if(!p1SchoolNormalizedSet[key]) return;

    const leadPriority = record["Lead Priority"] || "";
    const priorityOverride = record["Priority Override"] || "";

    if(isEffectiveP1_(leadPriority, priorityOverride)) return;

    mismatches.push({
      leadId: record["Lead ID"] || "",
      email: record["Email"] || "",
      schoolName: schoolName,
      leadPriority: leadPriority,
      priorityOverride: priorityOverride,
      effectivePriority: String(priorityOverride || leadPriority || "").trim()
    });

  });

  return mismatches;

}


/**
 * ==========================================================
 * TEST — computeP1SchoolMismatches_()
 * ==========================================================
 */
function testComputeP1SchoolMismatches(){

  const opsRecords = [
    {"Lead ID":"1","Email":"a@x.com","School Name":"ABC School","Lead Priority":"Priority 2","Priority Override":""},
    {"Lead ID":"2","Email":"b@x.com","School Name":"ABC School","Lead Priority":"Priority 1","Priority Override":""},
    {"Lead ID":"3","Email":"c@x.com","School Name":"ABC School","Lead Priority":"Priority 2","Priority Override":"Priority 1"},
    {"Lead ID":"4","Email":"d@x.com","School Name":"Unrelated School","Lead Priority":"Priority 2","Priority Override":""},
    {"Lead ID":"5","Email":"e@x.com","School Name":"","Lead Priority":"Priority 2","Priority Override":""}
  ];

  const p1SchoolSet = {"abc school": true};

  const result = computeP1SchoolMismatches_(opsRecords, p1SchoolSet);

  const pass =
    result.length === 1 &&
    result[0].leadId === "1" &&
    result[0].effectivePriority === "Priority 2";

  Logger.log("computeP1SchoolMismatches_ result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Missing P1 Schools (순수 함수 — 역방향 체크)
 *
 * WHY (2026-09-04, 사용자 후속 요청)
 * `computeP1SchoolMismatches_()`의 반대 방향 — School Name이 P1 School
 * List에 없는데 Leads_OPS 상 effective Priority는 이미 P1인 "리스트에
 * 아직 없는 학교"를 찾아 P1 School List에 추가할지 판단할 수 있게 한다.
 * `startDate`(포함) 이후 Create Date인 리드만 대상 — 과거 누적 리드
 * 전체로 확장하면 노이즈가 커짐(사용자 확정, "오늘부터 새로 들어오는
 * 리드"). School 단위로 집계(리드 단위 아님) — 같은 학교의 여러 리드는
 * 카운트만 늘리고 한 행으로 합쳐짐.
 *
 * @param {Object[]} opsRecords  sheetToObjects(Leads_OPS) 결과
 * @param {Object} p1SchoolNormalizedSet  computeP1SchoolNormalizedSet_() 결과
 * @param {Date} startDate  이 날짜(포함) 이후 Create Date만 대상
 * @return {Object[]}  {schoolName, count, exampleLeadId, exampleEmail, firstSeenDate}
 *
 * TEST
 * computeMissingP1Schools_(
 *   [
 *     {"Lead ID":"1","Email":"a@x.com","School Name":"New School","Lead Priority":"Priority 1","Priority Override":"","Create Date":new Date(2026,8,5)},
 *     {"Lead ID":"2","Email":"b@x.com","School Name":"New School","Lead Priority":"Priority 1","Priority Override":"","Create Date":new Date(2026,8,6)},
 *     {"Lead ID":"3","Email":"c@x.com","School Name":"ABC School","Lead Priority":"Priority 1","Priority Override":"","Create Date":new Date(2026,8,5)},
 *     {"Lead ID":"4","Email":"d@x.com","School Name":"New School","Lead Priority":"Priority 2","Priority Override":"","Create Date":new Date(2026,8,5)},
 *     {"Lead ID":"5","Email":"e@x.com","School Name":"New School","Lead Priority":"Priority 1","Priority Override":"","Create Date":new Date(2026,8,3)}
 *   ],
 *   {"abc school": true},
 *   new Date(2026,8,4)
 * ) => [{schoolName:"New School", count:2, exampleLeadId:"1", exampleEmail:"a@x.com", firstSeenDate: 2026-09-05}]
 *   (3번은 이미 리스트에 있는 학교, 4번은 P1 아님, 5번은 startDate 이전이라 전부 제외)
 * ==========================================================
 */
function computeMissingP1Schools_(opsRecords, p1SchoolNormalizedSet, startDate){

  const bySchool = {};

  opsRecords.forEach(function(record){

    const createDate = record["Create Date"];

    if(!(createDate instanceof Date) || isNaN(createDate.getTime())) return;
    if(createDate.getTime() < startDate.getTime()) return;

    const leadPriority = record["Lead Priority"] || "";
    const priorityOverride = record["Priority Override"] || "";

    if(!isEffectiveP1_(leadPriority, priorityOverride)) return;

    const schoolName = String(record["School Name"] || "").trim();

    if(!schoolName) return;

    const key = schoolName.toLowerCase();

    if(p1SchoolNormalizedSet[key]) return;

    if(!bySchool[key]){
      bySchool[key] = {
        schoolName: schoolName,
        count: 0,
        exampleLeadId: record["Lead ID"] || "",
        exampleEmail: record["Email"] || "",
        firstSeenDate: createDate
      };
    }

    bySchool[key].count++;

    if(createDate.getTime() < bySchool[key].firstSeenDate.getTime()){
      bySchool[key].firstSeenDate = createDate;
    }

  });

  return Object.keys(bySchool).map(function(key){
    return bySchool[key];
  });

}


/**
 * ==========================================================
 * TEST — computeMissingP1Schools_()
 * ==========================================================
 */
function testComputeMissingP1Schools(){

  const opsRecords = [
    {"Lead ID":"1","Email":"a@x.com","School Name":"New School","Lead Priority":"Priority 1","Priority Override":"","Create Date":new Date(2026,8,5)},
    {"Lead ID":"2","Email":"b@x.com","School Name":"New School","Lead Priority":"Priority 1","Priority Override":"","Create Date":new Date(2026,8,6)},
    {"Lead ID":"3","Email":"c@x.com","School Name":"ABC School","Lead Priority":"Priority 1","Priority Override":"","Create Date":new Date(2026,8,5)},
    {"Lead ID":"4","Email":"d@x.com","School Name":"New School","Lead Priority":"Priority 2","Priority Override":"","Create Date":new Date(2026,8,5)},
    {"Lead ID":"5","Email":"e@x.com","School Name":"New School","Lead Priority":"Priority 1","Priority Override":"","Create Date":new Date(2026,8,3)}
  ];

  const p1SchoolSet = {"abc school": true};

  const result = computeMissingP1Schools_(opsRecords, p1SchoolSet, new Date(2026,8,4));

  const pass =
    result.length === 1 &&
    result[0].schoolName === "New School" &&
    result[0].count === 2 &&
    result[0].exampleLeadId === "1" &&
    result[0].firstSeenDate.getTime() === new Date(2026,8,5).getTime();

  Logger.log("computeMissingP1Schools_ result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Write P1 School Mismatch Results (IO 래퍼)
 *
 * WHY
 * 사용자가 직접 열어 확인하는 용도라(알림 수단으로 시트 내 플래깅을
 * 선택, 이메일 발송 없음) hideSheet() 호출하지 않음 — Leads_OPS_QA와 달리
 * 계속 눈에 보여야 함. 매 실행마다 전체 재작성(현재 상태만 반영, 이력
 * 누적 안 함 — 교정되면 다음 실행에서 자동으로 목록에서 빠짐).
 * ==========================================================
 */
const P1_SCHOOL_MISMATCH_HEADERS = [
  "Lead ID", "Email", "School Name", "Lead Priority", "Priority Override",
  "Effective Priority", "Checked At"
];

function writeP1SchoolMismatchResults_(mismatches){

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(OPS.P1_SCHOOL_MISMATCH.OUTPUT_SHEET);

  if(!sheet){
    sheet = ss.insertSheet(OPS.P1_SCHOOL_MISMATCH.OUTPUT_SHEET);
  }

  sheet.clearContents();

  sheet.getRange(1, 1, 1, P1_SCHOOL_MISMATCH_HEADERS.length)
    .setValues([P1_SCHOOL_MISMATCH_HEADERS])
    .setFontWeight("bold");

  if(mismatches.length > 0){

    const checkedAt = Utilities.formatDate(new Date(), CONFIG.DATE.TIMEZONE, "yyyy-MM-dd HH:mm");

    const rows = mismatches.map(function(m){
      return [
        m.leadId, m.email, m.schoolName, m.leadPriority, m.priorityOverride,
        m.effectivePriority, checkedAt
      ];
    });

    sheet.getRange(2, 1, rows.length, P1_SCHOOL_MISMATCH_HEADERS.length).setValues(rows);

  }

  sheet.setFrozenRows(1);

  SpreadsheetApp.flush();

}


/**
 * ==========================================================
 * Write Missing P1 Schools Results (IO 래퍼 — 역방향 체크)
 *
 * WHY
 * `writeP1SchoolMismatchResults_()`와 달리 항상 숨김(사용자 확정) — 담당팀이
 * 정기적으로 열어 P1 School List에 추가할 학교를 검토하는 용도.
 * ==========================================================
 */
const MISSING_P1_SCHOOL_HEADERS = [
  "School Name", "P1 Lead Count", "Example Lead ID", "Example Email",
  "First Seen Date", "Checked At"
];

function writeMissingP1SchoolsResults_(missingSchools){

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(OPS.P1_SCHOOL_MISMATCH.MISSING_SCHOOL_TRACKING.OUTPUT_SHEET);

  if(!sheet){
    sheet = ss.insertSheet(OPS.P1_SCHOOL_MISMATCH.MISSING_SCHOOL_TRACKING.OUTPUT_SHEET);
  }

  sheet.clearContents();

  sheet.getRange(1, 1, 1, MISSING_P1_SCHOOL_HEADERS.length)
    .setValues([MISSING_P1_SCHOOL_HEADERS])
    .setFontWeight("bold");

  if(missingSchools.length > 0){

    const checkedAt = Utilities.formatDate(new Date(), CONFIG.DATE.TIMEZONE, "yyyy-MM-dd HH:mm");

    const rows = missingSchools.map(function(m){
      return [
        m.schoolName, m.count, m.exampleLeadId, m.exampleEmail,
        Utilities.formatDate(m.firstSeenDate, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd"),
        checkedAt
      ];
    });

    sheet.getRange(2, 1, rows.length, MISSING_P1_SCHOOL_HEADERS.length).setValues(rows);

  }

  sheet.setFrozenRows(1);
  sheet.hideSheet();

  SpreadsheetApp.flush();

}


/**
 * ==========================================================
 * Perform P1 School Mismatch Check (오케스트레이션)
 * ==========================================================
 */
function performP1SchoolMismatchCheck_(){

  const ext = OPS.P1_SCHOOL_MISMATCH.EXTERNAL;
  const aliasStartColumnOffset = ext.ALIAS_START_COLUMN - ext.SCHOOL_COLUMN;

  const rawRows = readP1SchoolListRawRows_();
  const p1SchoolSet = computeP1SchoolNormalizedSet_(rawRows, aliasStartColumnOffset);

  const opsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(OPS.SHEET.OPS);
  const opsRecords = opsSheet ? sheetToObjects(opsSheet) : [];

  const mismatches = computeP1SchoolMismatches_(opsRecords, p1SchoolSet);

  writeP1SchoolMismatchResults_(mismatches);

  Logger.log(
    "[P1SchoolMismatch] P1 학교 " + Object.keys(p1SchoolSet).length +
    "개(별칭 포함) / Leads_OPS " + opsRecords.length + "건 대조 — 불일치 " +
    mismatches.length + "건 " + OPS.P1_SCHOOL_MISMATCH.OUTPUT_SHEET + "에 기록."
  );

  // 2026-09-04 — 역방향 체크(사용자 후속 요청). 위에서 이미 읽은 opsRecords/
  // p1SchoolSet을 그대로 재사용 — 추가 Sheet I/O 없이 메모리 연산만 더함.
  const missingSchools = computeMissingP1Schools_(
    opsRecords, p1SchoolSet, OPS.P1_SCHOOL_MISMATCH.MISSING_SCHOOL_TRACKING.START_DATE
  );

  writeMissingP1SchoolsResults_(missingSchools);

  Logger.log(
    "[P1SchoolMismatch] " +
    Utilities.formatDate(
      OPS.P1_SCHOOL_MISMATCH.MISSING_SCHOOL_TRACKING.START_DATE, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd"
    ) + " 이후 신규 P1 리드 중 리스트에 없는 학교 " + missingSchools.length + "개 " +
    OPS.P1_SCHOOL_MISMATCH.MISSING_SCHOOL_TRACKING.OUTPUT_SHEET + "에 기록."
  );

  return mismatches;

}


/**
 * ==========================================================
 * Check P1 School Mismatch (실패 격리 래퍼 — 파이프라인 단계용)
 *
 * WHY
 * refreshCampaignSpend_()(MASTER_002_PipelineAsync.js)와 동일 원칙 — 외부
 * P1 School List 시트 접근 실패(공유 해제, 탭 이름 변경 등) 시에도 Logger에만
 * 남기고 던지지 않아, Leads Import 파이프라인 나머지 단계가 계속 진행되도록
 * 격리한다. 이 체크는 보조 QA성 기능이라 실패로 핵심 데이터 refresh 전체를
 * 막을 필요가 없음.
 * ==========================================================
 */
function checkP1SchoolMismatch_(){

  try {

    performP1SchoolMismatchCheck_();

  } catch(err){

    Logger.log(
      "checkP1SchoolMismatch_: P1 School Mismatch 체크 실패(비필수, 파이프라인은 계속) — " +
      (err && err.message ? err.message : err)
    );

  }

}


/**
 * ==========================================================
 * Manual-run public wrapper (Apps Script 편집기 Run 드롭다운 노출용)
 * ==========================================================
 */
function runCheckP1SchoolMismatch(){

  performP1SchoolMismatchCheck_();

}
