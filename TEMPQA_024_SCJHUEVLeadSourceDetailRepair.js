/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — "KR_core_2026-08-23_sc-jhu-ev" UTM Lead Source Detail 복구
 *
 * Responsibility
 * TEMPQA_023_SCBankJHUSeminarEventTrace.js의 runTraceSCJHUEVUtm()으로
 * 확인된 오염(2026-08-24) — MKT UTM Campaign="KR_core_2026-08-23_sc-jhu-ev"
 * 로 들어온 MTA_Raw 터치 12건의 "Lead Source Detail"이 잘못 찍혀 있었음:
 *   - 6건: "EV-2026-05-KOR-MOFU-Core EXPO Kakao Channel"(지난 5월 EXPO
 *     행사 — 이 Kakao Channel이 5월 EXPO 캠페인에 연결된 채 남아있다가
 *     이번 신규 이벤트 트래픽까지 잘못 붙잡은 것으로 추정, 사용자 확인)
 *   - 6건: 공란(Business Segment="Other"로 미분류)
 * 사용자가 Marketo/SFDC 쪽 Kakao Channel 캠페인 연결을 이미 바로잡아
 * "지금부터 들어오는 리드는 정상 Lead Source Detail로 들어옴"을 확인
 * (2026-08-24) — 이미 들어온 이 12건만 소급 정정이 필요한 상황.
 *
 * 정정 대상 값(사용자 확정, 2026-08-24): "EV-2026-08-KOR-MOFU-Core SC Bank
 * JHU Seminar" — 사용자가 Salesforce/Marketo 원본과 대조해 철자까지 확인.
 * 정정 범위(사용자 확정): 공란 6건 포함 총 12건 전부.
 *
 * ⚠️ "Raw는 원본 보존, 수동 수정 금지" 원칙의 명시적 예외
 * TEMPQA_008_SalesAcceptedDateRepair.js와 동일한 예외 사유 구조 — 오염
 * 원인이 확정적으로 규명됐고(Kakao Channel 캠페인 오연결), 사용자가 올바른
 * 목표값과 정정 범위를 직접 확인했으므로 MTA_Raw를 직접 수정. 안전장치로
 * UTM이 정확히 일치하고 현재 Lead Source Detail이 알려진 오염값(공란 또는
 * "EV-2026-05-KOR-MOFU-Core EXPO Kakao Channel") 중 하나인 행만 건드림 —
 * 예상 밖의 다른 값이 있는 행은 건드리지 않고 로그로 경고.
 *
 * Version
 * v1.1.0
 *
 * Change Log
 * v1.1.0 (2026-08-24)
 * - **Leads_Raw 정정 추가** — runTraceSCJHUEVUtm() 재확인 결과, 이 UTM이
 *   리드 1건(00QRC00001M749m)의 First Touch였고 Leads_Raw의 "First Touch
 *   Detail"도 공란(Business Segment=Other로 미분류)으로 동일하게 오염돼
 *   있었음. 신규 runApplySCJHUEVFirstTouchDetailRepair() — MTA_Raw
 *   복구와 동일 원칙(Raw immutable 예외, 안전장치 포함)으로 Leads_Raw의
 *   "First Touch Detail"을 정정. 실행 후 rebuildLeadsMaster() 필요.
 * v1.0.0 (2026-08-24)
 * - 최초 구현.
 * ==========================================================
 */

const SC_JHU_EV_REPAIR_TARGET_UTM = "KR_core_2026-08-23_sc-jhu-ev";

const SC_JHU_EV_REPAIR_CORRECT_LEAD_SOURCE_DETAIL = "EV-2026-08-KOR-MOFU-Core SC Bank JHU Seminar";

const SC_JHU_EV_REPAIR_KNOWN_CONTAMINATED_VALUES = ["", "EV-2026-05-KOR-MOFU-Core EXPO Kakao Channel"];


/**
 * ==========================================================
 * Compute SC JHU EV Lead Source Detail Repair (순수 함수)
 *
 * INPUT
 * utm               : string  (해당 행의 "MKT UTM Campaign" 값)
 * currentLeadSource  : string  (해당 행의 현재 "Lead Source Detail" 값)
 *
 * OUTPUT
 * { shouldFix: boolean, reason: string }
 * - UTM이 정확히 일치하고 현재값이 알려진 오염값 중 하나 → shouldFix:true
 * - UTM 불일치 → shouldFix:false, reason:"utm-mismatch"
 * - UTM은 일치하나 현재값이 알려지지 않은 값(이미 정상이거나 예상 밖의
 *   값) → shouldFix:false, reason:"unexpected-value"(안전하게 스킵)
 *
 * TEST
 * testComputeSCJHUEVLeadSourceDetailRepair() 참고
 * ==========================================================
 */
function computeSCJHUEVLeadSourceDetailRepair_(utm, currentLeadSource){

  if(String(utm || "").trim() !== SC_JHU_EV_REPAIR_TARGET_UTM){
    return { shouldFix: false, reason: "utm-mismatch" };
  }

  const current = String(currentLeadSource || "").trim();

  if(SC_JHU_EV_REPAIR_KNOWN_CONTAMINATED_VALUES.indexOf(current) === -1){
    return { shouldFix: false, reason: "unexpected-value" };
  }

  return { shouldFix: true, reason: "" };

}


/**
 * ==========================================================
 * TEST — computeSCJHUEVLeadSourceDetailRepair_()
 * ==========================================================
 */
function testComputeSCJHUEVLeadSourceDetailRepair(){

  const blankCase = computeSCJHUEVLeadSourceDetailRepair_("KR_core_2026-08-23_sc-jhu-ev", "");
  const expoCase = computeSCJHUEVLeadSourceDetailRepair_("KR_core_2026-08-23_sc-jhu-ev", "EV-2026-05-KOR-MOFU-Core EXPO Kakao Channel");
  const utmMismatch = computeSCJHUEVLeadSourceDetailRepair_("some-other-utm", "");
  const unexpectedValue = computeSCJHUEVLeadSourceDetailRepair_("KR_core_2026-08-23_sc-jhu-ev", "WB-2025-07-KOR-MOFU-Core Unrelated");
  const alreadyCorrect = computeSCJHUEVLeadSourceDetailRepair_("KR_core_2026-08-23_sc-jhu-ev", "EV-2026-08-KOR-MOFU-Core SC Bank JHU Seminar");

  const pass =
    blankCase.shouldFix === true &&
    expoCase.shouldFix === true &&
    utmMismatch.shouldFix === false && utmMismatch.reason === "utm-mismatch" &&
    unexpectedValue.shouldFix === false && unexpectedValue.reason === "unexpected-value" &&
    alreadyCorrect.shouldFix === false && alreadyCorrect.reason === "unexpected-value";

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Run Apply SC JHU EV Lead Source Detail Repair (MTA_Raw 직접 수정 — 1회성)
 *
 * WHY
 * MTA_Raw의 "MKT UTM Campaign"/"Lead Source Detail" 두 컬럼을 컬럼 전체
 * 1회 읽기 → 메모리에서 판정 → "Lead Source Detail" 컬럼 전체 1회 쓰기
 * (배치 패턴, TEMPQA_008_SalesAcceptedDateRepair.js와 동일 원칙).
 * 실행 후 반드시 MASTER_004_MasterBuild.js의 rebuildMTAMaster()를 실행해야
 * MTA_Master/Events_OPS 등에 반영됨(이 함수는 Raw만 고침, Master는 별도
 * 재구축 필요 — Business Segment도 rebuildMTAMaster() 시점에 정정된
 * Lead Source Detail 기준으로 자동 재계산됨, MASTER_007_MTATransformer.js
 * getBusinessSegment() 참고).
 * ==========================================================
 */
function runApplySCJHUEVLeadSourceDetailRepair(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.MTA_RAW);

  if(!sheet){
    Logger.log(CONFIG.SHEETS.MTA_RAW + " sheet not found.");
    return;
  }

  const headerMap = getHeaderMap(sheet);
  const utmColIndex = headerMap["MKT UTM Campaign"];
  const leadSourceColIndex = headerMap["Lead Source Detail"];

  if(utmColIndex === undefined || leadSourceColIndex === undefined){
    Logger.log('"MKT UTM Campaign" 또는 "Lead Source Detail" 컬럼을 MTA_Raw에서 못 찾음.');
    return;
  }

  const lastRow = sheet.getLastRow();
  const numRows = lastRow - 1; // 헤더 1행 제외

  if(numRows <= 0){
    Logger.log("MTA_Raw has no data rows.");
    return;
  }

  const utmValues = sheet.getRange(2, utmColIndex + 1, numRows, 1).getValues();
  const leadSourceRange = sheet.getRange(2, leadSourceColIndex + 1, numRows, 1);
  const leadSourceValues = leadSourceRange.getValues();

  let fixedCount = 0;
  let skippedUnexpectedCount = 0;
  const sampleLines = [];
  const unexpectedSamples = [];

  const newLeadSourceValues = leadSourceValues.map(function(row, i){

    const utm = utmValues[i][0];
    const current = row[0];

    const result = computeSCJHUEVLeadSourceDetailRepair_(utm, current);

    if(!result.shouldFix){

      if(result.reason === "unexpected-value" && unexpectedSamples.length < 10){
        unexpectedSamples.push("row " + (i + 2) + " : Lead Source Detail=\"" + current + "\"");
      }

      if(result.reason === "unexpected-value") skippedUnexpectedCount++;

      return [current];
    }

    fixedCount++;

    if(sampleLines.length < 15){
      sampleLines.push("row " + (i + 2) + " : \"" + current + "\" -> \"" + SC_JHU_EV_REPAIR_CORRECT_LEAD_SOURCE_DETAIL + "\"");
    }

    return [SC_JHU_EV_REPAIR_CORRECT_LEAD_SOURCE_DETAIL];

  });

  leadSourceRange.setValues(newLeadSourceValues);

  Logger.log("========== SC JHU EV Lead Source Detail 복구 (MTA_Raw) ==========");
  Logger.log("대상 UTM              : " + SC_JHU_EV_REPAIR_TARGET_UTM);
  Logger.log("정정 목표값           : " + SC_JHU_EV_REPAIR_CORRECT_LEAD_SOURCE_DETAIL);
  Logger.log("전체 데이터 행 수      : " + numRows);
  Logger.log("정정 적용됨            : " + fixedCount);
  Logger.log("UTM 일치했으나 예상 밖 값라 스킵 : " + skippedUnexpectedCount);
  Logger.log("");
  Logger.log("정정 샘플(최대 15건):");
  sampleLines.forEach(function(line){ Logger.log("  " + line); });

  if(unexpectedSamples.length){
    Logger.log("");
    Logger.log("⚠️ UTM은 일치했으나 알려진 오염값이 아니라 건드리지 않은 행(최대 10건):");
    unexpectedSamples.forEach(function(line){ Logger.log("  " + line); });
  }

  Logger.log("");
  Logger.log("⚠️ 다음 단계: MASTER_004_MasterBuild.js의 rebuildMTAMaster()를 실행해");
  Logger.log("   MTA_Master/Business Segment/Events_OPS 등에 반영하세요.");
  Logger.log("==========================================================");

}


/**
 * ==========================================================
 * Leads_Raw "First Touch Detail" 복구 (2026-08-24 추가)
 *
 * WHY
 * runTraceSCJHUEVUtm() 재확인 결과, 이 UTM이 리드 1건(00QRC00001M749m)의
 * First Touch였는데 Leads_Raw의 "First Touch Detail"이 공란 — MTA_Raw와
 * 별개 필드(Lead 레벨 vs MTA 터치 레벨)라 MTA_Raw 복구가 이 필드까지
 * 자동으로 고쳐주지 않음. 동일한 예외 사유/안전장치로 별도 정정 필요.
 * 알려진 오염값은 공란 1가지만 관측됨(EXPO Kakao Channel류 오귀속은
 * Leads_Raw에서 발견 안 됨) — 안전장치를 그에 맞게 좁혀 둠.
 * ==========================================================
 */
const SC_JHU_EV_REPAIR_KNOWN_CONTAMINATED_FIRST_TOUCH_VALUES = [""];


function computeSCJHUEVFirstTouchDetailRepair_(utm, currentFirstTouchDetail){

  if(String(utm || "").trim() !== SC_JHU_EV_REPAIR_TARGET_UTM){
    return { shouldFix: false, reason: "utm-mismatch" };
  }

  const current = String(currentFirstTouchDetail || "").trim();

  if(SC_JHU_EV_REPAIR_KNOWN_CONTAMINATED_FIRST_TOUCH_VALUES.indexOf(current) === -1){
    return { shouldFix: false, reason: "unexpected-value" };
  }

  return { shouldFix: true, reason: "" };

}


/**
 * ==========================================================
 * TEST — computeSCJHUEVFirstTouchDetailRepair_()
 * ==========================================================
 */
function testComputeSCJHUEVFirstTouchDetailRepair(){

  const blankCase = computeSCJHUEVFirstTouchDetailRepair_("KR_core_2026-08-23_sc-jhu-ev", "");
  const utmMismatch = computeSCJHUEVFirstTouchDetailRepair_("some-other-utm", "");
  const unexpectedValue = computeSCJHUEVFirstTouchDetailRepair_("KR_core_2026-08-23_sc-jhu-ev", "WB-2025-07-KOR-MOFU-Core Unrelated");

  const pass =
    blankCase.shouldFix === true &&
    utmMismatch.shouldFix === false && utmMismatch.reason === "utm-mismatch" &&
    unexpectedValue.shouldFix === false && unexpectedValue.reason === "unexpected-value";

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Run Apply SC JHU EV First Touch Detail Repair (Leads_Raw 직접 수정 — 1회성)
 *
 * WHY
 * Leads_Raw의 "First MKT UTM Campaign"/"First Touch Detail" 두 컬럼을
 * 컬럼 전체 1회 읽기 → 메모리에서 판정 → "First Touch Detail" 컬럼 전체
 * 1회 쓰기 (배치 패턴, runApplySCJHUEVLeadSourceDetailRepair()와 동일).
 * 실행 후 반드시 MASTER_004_MasterBuild.js의 rebuildLeadsMaster()를
 * 실행해야 Leads_Master/Business Segment 등에 반영됨.
 * ==========================================================
 */
function runApplySCJHUEVFirstTouchDetailRepair(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS_RAW);

  if(!sheet){
    Logger.log(CONFIG.SHEETS.LEADS_RAW + " sheet not found.");
    return;
  }

  const headerMap = getHeaderMap(sheet);
  const utmColIndex = headerMap["First MKT UTM Campaign"];
  const firstTouchColIndex = headerMap["First Touch Detail"];

  if(utmColIndex === undefined || firstTouchColIndex === undefined){
    Logger.log('"First MKT UTM Campaign" 또는 "First Touch Detail" 컬럼을 Leads_Raw에서 못 찾음.');
    return;
  }

  const lastRow = sheet.getLastRow();
  const numRows = lastRow - 1; // 헤더 1행 제외

  if(numRows <= 0){
    Logger.log("Leads_Raw has no data rows.");
    return;
  }

  const utmValues = sheet.getRange(2, utmColIndex + 1, numRows, 1).getValues();
  const firstTouchRange = sheet.getRange(2, firstTouchColIndex + 1, numRows, 1);
  const firstTouchValues = firstTouchRange.getValues();

  let fixedCount = 0;
  let skippedUnexpectedCount = 0;
  const sampleLines = [];
  const unexpectedSamples = [];

  const newFirstTouchValues = firstTouchValues.map(function(row, i){

    const utm = utmValues[i][0];
    const current = row[0];

    const result = computeSCJHUEVFirstTouchDetailRepair_(utm, current);

    if(!result.shouldFix){

      if(result.reason === "unexpected-value" && unexpectedSamples.length < 10){
        unexpectedSamples.push("row " + (i + 2) + " : First Touch Detail=\"" + current + "\"");
      }

      if(result.reason === "unexpected-value") skippedUnexpectedCount++;

      return [current];
    }

    fixedCount++;
    sampleLines.push("row " + (i + 2) + " : \"" + current + "\" -> \"" + SC_JHU_EV_REPAIR_CORRECT_LEAD_SOURCE_DETAIL + "\"");

    return [SC_JHU_EV_REPAIR_CORRECT_LEAD_SOURCE_DETAIL];

  });

  firstTouchRange.setValues(newFirstTouchValues);

  Logger.log("========== SC JHU EV First Touch Detail 복구 (Leads_Raw) ==========");
  Logger.log("대상 UTM              : " + SC_JHU_EV_REPAIR_TARGET_UTM);
  Logger.log("정정 목표값           : " + SC_JHU_EV_REPAIR_CORRECT_LEAD_SOURCE_DETAIL);
  Logger.log("전체 데이터 행 수      : " + numRows);
  Logger.log("정정 적용됨            : " + fixedCount);
  Logger.log("UTM 일치했으나 예상 밖 값라 스킵 : " + skippedUnexpectedCount);
  Logger.log("");
  Logger.log("정정 샘플:");
  sampleLines.forEach(function(line){ Logger.log("  " + line); });

  if(unexpectedSamples.length){
    Logger.log("");
    Logger.log("⚠️ UTM은 일치했으나 알려진 오염값이 아니라 건드리지 않은 행:");
    unexpectedSamples.forEach(function(line){ Logger.log("  " + line); });
  }

  Logger.log("");
  Logger.log("⚠️ 다음 단계: MASTER_004_MasterBuild.js의 rebuildLeadsMaster()를 실행해");
  Logger.log("   Leads_Master/Business Segment 등에 반영하세요.");
  Logger.log("==========================================================");

}
