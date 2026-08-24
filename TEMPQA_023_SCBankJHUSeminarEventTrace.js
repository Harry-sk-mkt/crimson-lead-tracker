/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — "EV-2026-08-KOR-MOFU-Core SC Bank JHU Seminar" Events_OPS 누락 조사
 *
 * Responsibility
 * 사용자가 MTA import 완료 후 이 프로그램이 Events_OPS에 안 보인다고 보고
 * (2026-08-24). README Pipeline Status는 MTA Leads 행이 DONE(Events_OPS
 * 컬럼도 Complete)으로 확인돼, 백그라운드 파이프라인 자체는 정상 완료된
 * 상태 — 그렇다면 원인은 (1) Leads_Raw/MTA_Raw에 애초에 안 들어왔음
 * (Import 자체가 아직 안 됐거나 CSV에 없었음), (2) Master까지는 갔는데
 * Business Segment가 "Webinar"/"Seminar"가 아닌 다른 값으로 분류됨
 * (BusinessSegmentClassification.md에 이런 사례 다수 기록), (3) Business
 * Segment는 맞는데 EVENTS_002_Engine.js의 isEligibleEventProgram_()
 * (KOR 국가 토큰 위치 + WB/EV TYPE 접두사) 필터에서 예상과 다르게 걸러짐
 * (예: 하이픈이 아닌 유사 문자가 섞여 있거나 COUNTRY 토큰 위치가 밀림)
 * 중 하나로 좁혀볼 수 있음. 이 세 지점 + Events_Engine/Events_OPS 자체를
 * 전부 덤프해 실측으로 원인을 확인한다. **읽기 전용** — 아무것도 쓰지
 * 않음(TEMPQA_005/009/016과 동일 관례).
 *
 * Version
 * v1.4.0
 *
 * Change Log
 * v1.4.0 (2026-08-24)
 * - runTraceSCJHUEVUtm()에 Leads_Raw/Leads_Master 확인 추가(신규
 *   dumpFirstUtmMatchingLeadsRows_()) — 이 UTM이 어떤 리드의 "First"
 *   터치였다면 Leads_Raw의 "First MKT UTM Campaign"/Leads_Master의
 *   "First Touch Detail"(Lead 레벨 필드, MTA 터치 레벨의 "Lead Source
 *   Detail"과 별개)에도 동일한 오염이 있는지 확인 — 정정 범위 판단용.
 * v1.3.0 (2026-08-24)
 * - **사용자가 실제 UTM 값("KR_core_2026-08-23_sc-jhu-ev") 제공** — 신규
 *   runTraceSCJHUEVUtm()/dumpUtmMatchingRows_() 추가. MTA_Raw/MTA_Master의
 *   raw "MKT UTM Campaign" 필드로 직접 조회해 이 UTM으로 들어온 터치가
 *   있는지, 있다면 그 터치의 Lead Source Detail(Events 매칭 키)이 뭔지
 *   확인 — Marketo Program 이름 문자열 검색("SC Bank"/"JHU")과 별도
 *   진입점(기존 runTraceSCBankJHUSeminarEventGap()은 그대로 유지).
 * v1.2.0 (2026-08-24)
 * - **사용자 후속 질문("왜 한 건도 없을까? 있어야하는데") 대응** — "SC
 *   Bank"/"JHU" 정확 문자열 매칭 0건이 "실제 등록자 없음"인지 "프로그램명
 *   철자가 사용자가 말한 것과 다름"인지 구분하기 위해 신규
 *   listDistinctProgramsContaining_() 추가("2026-08-kor" 포함 프로그램
 *   전체를 MTA_Raw/Leads_Raw에서 distinct 나열). 신규 "MTA Import 증분
 *   커서" 섹션 추가 — appendNewMTA()의 lastProcessed 커서(MTA_LAST_ROW)가
 *   MTA_Raw 전체 행 수와 일치하는지 확인해, 이번 import가 실제로 끝까지
 *   Master에 반영됐는지(밀린 행 없는지) 검증.
 * v1.1.0 (2026-08-24)
 * - **버그 수정 — Events_OPS 매칭이 항상 0건으로 나오던 문제**: 범용
 *   sheetToObjects()(1행=헤더 가정)로 Events_OPS를 읽으면 실제 1행
 *   (SUBTOTAL 수식 행)을 헤더로 오인식해 모든 컬럼명이 어긋나 매칭이
 *   항상 0건이 되는 거짓 음성이 있었음(최초 실행 로그로 실측). 신규
 *   dumpMatchingEventsOPSRows_() — readEventsOPS_()(EVENTS_004_Merge.js,
 *   EVENTS.ROWS.HEADER=2 기준으로 정확히 읽음) 재사용으로 교체.
 * v1.0.0 (2026-08-24)
 * - 최초 구현.
 * ==========================================================
 */

const SC_BANK_JHU_SEARCH_TERMS = ["sc bank", "jhu"];

const SC_JHU_EV_UTM_SEARCH_TERM = "sc-jhu-ev";


/**
 * ==========================================================
 * Run Trace — "KR_core_2026-08-23_sc-jhu-ev" UTM 단독 조회
 *
 * WHY (2026-08-24, 사용자 후속 질문)
 * 사용자가 실제 UTM(raw "MKT UTM Campaign" 값, Marketo Program 이름과는
 * 별개 필드)을 알려줌 — 이 UTM으로 실제 터치가 들어왔는지, 들어왔다면
 * 그 터치의 Lead Source Detail(Marketo Program 이름, Events 매칭 키)이
 * 뭔지 확인해야 "SC Bank"/"JHU" 문자열 검색이 놓친 철자 불일치인지
 * 판별 가능. MTA_Raw/MTA_Master 둘 다 확인(Raw엔 있는데 Master엔 없으면
 * 그 사이 append 단계 문제).
 * ==========================================================
 */
function runTraceSCJHUEVUtm(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  Logger.log("========== MTA_Raw — UTM \"" + SC_JHU_EV_UTM_SEARCH_TERM + "\" ==========");
  dumpUtmMatchingRows_(ss, CONFIG.SHEETS.MTA_RAW, ["Lead: Lead ID", "Multi Touch Attribution: Created Date", "MKT UTM Campaign", "Lead Source Detail"]);

  Logger.log("");
  Logger.log("========== MTA_Master — UTM \"" + SC_JHU_EV_UTM_SEARCH_TERM + "\" ==========");
  dumpUtmMatchingRows_(ss, CONFIG.SHEETS.MTA_MASTER, ["Lead ID", "MTA Created Date", "MKT UTM Campaign", "Lead Source Detail", "Business Segment"]);

  //----------------------------------------------------------
  // Leads_Raw / Leads_Master — 이 UTM이 리드의 "First" 터치인 경우
  // First MKT UTM Campaign/First Touch Detail(=Lead Source Detail)에도
  // 동일한 오염이 있는지 확인 (Lead 레벨, MTA 터치 레벨과 별개 필드)
  //----------------------------------------------------------

  Logger.log("");
  Logger.log("========== Leads_Raw — First MKT UTM Campaign \"" + SC_JHU_EV_UTM_SEARCH_TERM + "\" ==========");
  dumpFirstUtmMatchingLeadsRows_(ss, CONFIG.SHEETS.LEADS_RAW, ["Lead ID", "Create Date", "First MKT UTM Campaign", "First Touch Detail"]);

  Logger.log("");
  Logger.log("========== Leads_Master — First MKT UTM Campaign \"" + SC_JHU_EV_UTM_SEARCH_TERM + "\" ==========");
  dumpFirstUtmMatchingLeadsRows_(ss, CONFIG.SHEETS.LEADS_MASTER, ["Lead ID", "Create Date", "First MKT UTM Campaign", "First Touch Detail", "Business Segment"]);

}


function dumpFirstUtmMatchingLeadsRows_(ss, sheetName, logColumns){

  const sheet = ss.getSheetByName(sheetName);

  if(!sheet){
    Logger.log(sheetName + " 시트를 못 찾음.");
    return;
  }

  const records = sheetToObjects(sheet);

  const matches = records.filter(function(r){
    return String(r["First MKT UTM Campaign"] || "").toLowerCase().indexOf(SC_JHU_EV_UTM_SEARCH_TERM) !== -1;
  });

  Logger.log(sheetName + " 전체 " + records.length + "행 중 매칭 " + matches.length + "건");

  matches.slice(0, 20).forEach(function(r){

    const parts = logColumns.map(function(col){
      const v = r[col];
      return col + "=" + (v instanceof Date ? Utilities.formatDate(v, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd") : v);
    });

    Logger.log("  " + parts.join(" / "));

  });

  if(matches.length > 20){
    Logger.log("  ... (20건만 출력, 총 " + matches.length + "건)");
  }

}


function dumpUtmMatchingRows_(ss, sheetName, logColumns){

  const sheet = ss.getSheetByName(sheetName);

  if(!sheet){
    Logger.log(sheetName + " 시트를 못 찾음.");
    return;
  }

  const records = sheetToObjects(sheet);

  const matches = records.filter(function(r){
    return String(r["MKT UTM Campaign"] || "").toLowerCase().indexOf(SC_JHU_EV_UTM_SEARCH_TERM) !== -1;
  });

  Logger.log(sheetName + " 전체 " + records.length + "행 중 매칭 " + matches.length + "건");

  matches.slice(0, 20).forEach(function(r){

    const parts = logColumns.map(function(col){
      const v = r[col];
      return col + "=" + (v instanceof Date ? Utilities.formatDate(v, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd") : v);
    });

    Logger.log("  " + parts.join(" / "));

  });

  if(matches.length > 20){
    Logger.log("  ... (20건만 출력, 총 " + matches.length + "건)");
  }

}


function runTraceSCBankJHUSeminarEventGap(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  //----------------------------------------------------------
  // 0. 프로그램명 철자 불일치 배제 — "2026-08-KOR" 포함 프로그램 전체 나열
  //    ("SC Bank"/"JHU" 정확 일치가 0건이라 실제 등록자가 없는 건지,
  //    아니면 실제 SF 프로그램명이 사용자가 말한 이름과 다른 건지 구분)
  //----------------------------------------------------------

  Logger.log("========== 2026-08-KOR 포함 프로그램 전체 (MTA_Raw) ==========");
  listDistinctProgramsContaining_(ss, CONFIG.SHEETS.MTA_RAW, "Lead Source Detail", "2026-08-kor");

  Logger.log("");
  Logger.log("========== 2026-08-KOR 포함 프로그램 전체 (Leads_Raw) ==========");
  listDistinctProgramsContaining_(ss, CONFIG.SHEETS.LEADS_RAW, "First Touch Detail", "2026-08-kor");

  //----------------------------------------------------------
  // 1. Leads_Raw / Leads_Master — "First Touch Detail"
  //----------------------------------------------------------

  Logger.log("========== Leads_Raw ==========");
  dumpMatchingRowsAny_(ss, CONFIG.SHEETS.LEADS_RAW, "First Touch Detail", ["Lead ID", "Create Date", "First Touch Detail"]);

  Logger.log("");
  Logger.log("========== Leads_Master ==========");
  dumpMatchingRowsAny_(ss, CONFIG.SHEETS.LEADS_MASTER, "First Touch Detail", ["Lead ID", "Create Date", "First Touch Detail", "Business Segment", "Lead Priority"]);

  //----------------------------------------------------------
  // 2. MTA_Raw / MTA_Master — "Lead Source Detail"
  //----------------------------------------------------------

  Logger.log("");
  Logger.log("========== MTA_Raw ==========");
  dumpMatchingRowsAny_(ss, CONFIG.SHEETS.MTA_RAW, "Lead Source Detail", ["Lead: Lead ID", "Multi Touch Attribution: Created Date", "Lead Source Detail"]);

  Logger.log("");
  Logger.log("========== MTA_Master (+ Events 필터 판정) ==========");
  dumpMTAMasterWithEligibility_(ss);

  //----------------------------------------------------------
  // 3. Events_Engine / Events_OPS — 이미 키가 만들어졌는지
  //----------------------------------------------------------

  Logger.log("");
  Logger.log("========== Events_Engine ==========");
  dumpMatchingRowsAny_(ss, EVENTS.SHEET.ENGINE, "Lead Source Detail", EVENTS_ENGINE_HEADERS);

  Logger.log("");
  Logger.log("========== Events_OPS ==========");
  dumpMatchingEventsOPSRows_();

  //----------------------------------------------------------
  // 4. Pipeline Status — 죽은 락/실패 상태인지 확인 (README 확인값 재검증용)
  //----------------------------------------------------------

  Logger.log("");
  Logger.log("========== Pipeline Status ==========");

  const leadsState = readPipelineStatusState_(CONFIG.PIPELINE.TYPES.LEADS);
  const mtaState = readPipelineStatusState_(CONFIG.PIPELINE.TYPES.MTA);

  Logger.log("LEADS: " + JSON.stringify(leadsState));
  Logger.log("MTA: " + JSON.stringify(mtaState));

  //----------------------------------------------------------
  // 5. Import 증분 처리 커서 — 이번 import가 실제로 MTA_Raw 끝까지
  //    처리됐는지 확인 (appendNewMTA()의 lastProcessed 커서,
  //    MASTER_001_IncrementalMasterBuild.js 참고)
  //----------------------------------------------------------

  Logger.log("");
  Logger.log("========== MTA Import 증분 커서 ==========");

  const totalRaw = getRawSheetDataRowCount_(CONFIG.SHEETS.MTA_RAW);
  const lastProcessed = Number(PropertiesService.getScriptProperties().getProperty(CONFIG.PROPERTIES.MTA_LAST_ROW)) || 0;

  Logger.log("MTA_Raw 전체 데이터 행 수 : " + totalRaw);
  Logger.log("마지막으로 Master에 반영 처리된 행 수(MTA_LAST_ROW) : " + lastProcessed);
  Logger.log(totalRaw === lastProcessed ? "→ 일치 — 밀린 행 없음." : "→ 불일치! MTA_Raw에 아직 Master로 안 넘어간 행이 " + (totalRaw - lastProcessed) + "건 있음.");

}


/**
 * ==========================================================
 * List Distinct Programs Containing (내부 헬퍼)
 *
 * WHY
 * "SC Bank"/"JHU" 정확 문자열 매칭이 0건일 때, 원인이 "실제로 등록자가
 * 없음"인지 "프로그램명 철자가 사용자가 말한 것과 다름"인지 구분하기
 * 위해, 더 넓은 조건("2026-08-kor" 포함)으로 걸리는 프로그램을 전부
 * distinct하게 나열 — 실제 SF 프로그램명이 뭔지 눈으로 확인 가능.
 * ==========================================================
 */
function listDistinctProgramsContaining_(ss, sheetName, matchColumn, containsTermLower){

  const sheet = ss.getSheetByName(sheetName);

  if(!sheet){
    Logger.log(sheetName + " 시트를 못 찾음.");
    return;
  }

  const records = sheetToObjects(sheet);

  const counts = {};

  records.forEach(function(r){

    const raw = String(r[matchColumn] || "");

    if(raw.toLowerCase().indexOf(containsTermLower) === -1) return;

    counts[raw] = (counts[raw] || 0) + 1;

  });

  const distinctPrograms = Object.keys(counts);

  Logger.log(sheetName + " — \"" + containsTermLower + "\" 포함 distinct 프로그램 " + distinctPrograms.length + "개 (총 " + records.length + "행 스캔)");

  distinctPrograms.forEach(function(name){
    Logger.log("  \"" + name + "\" — " + counts[name] + "행");
  });

}


/**
 * ==========================================================
 * Dump MTA_Master Rows With Events Eligibility 판정 (내부 헬퍼)
 *
 * WHY
 * MTA_Master 매칭 행마다 실제 Events_OPS 매칭 파이프라인이 쓰는 것과
 * 동일한 순서(stripLGSuffix_ → stripRegistrationFormSuffix_ →
 * isEligibleEventProgram_ → applyEventsProgramKeyOverride_)로 키를
 * 재계산해, 어느 단계에서 왜 걸러지는지(Business Segment부터) 바로
 * 보이게 한다.
 * ==========================================================
 */
function dumpMTAMasterWithEligibility_(ss){

  const sheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);

  if(!sheet){
    Logger.log(CONFIG.SHEETS.MTA_MASTER + " 시트를 못 찾음.");
    return;
  }

  const records = sheetToObjects(sheet);

  const matches = records.filter(function(r){
    const detail = String(r[EVENTS.MATCH_FIELD.MTA] || "").toLowerCase();
    return SC_BANK_JHU_SEARCH_TERMS.some(function(term){ return detail.indexOf(term) !== -1; });
  });

  Logger.log(CONFIG.SHEETS.MTA_MASTER + " 전체 " + records.length + "행 중 매칭 " + matches.length + "건 (매칭 컬럼: \"" + EVENTS.MATCH_FIELD.MTA + "\")");

  matches.slice(0, 20).forEach(function(r){

    const rawDetail = r[EVENTS.MATCH_FIELD.MTA];
    const segment = r["Business Segment"] || "";
    const segmentOk = EVENTS.SEGMENTS.indexOf(segment) !== -1;

    const strippedKey = stripLGSuffix_(stripRegistrationFormSuffix_(rawDetail));
    const koreanOk = isKoreanProgram_(strippedKey);
    const typeOk = isEligibleEventType_(strippedKey);
    const finalKey = applyEventsProgramKeyOverride_(strippedKey);

    Logger.log(
      "  Lead Source Detail(raw)=\"" + rawDetail + "\"" +
      " / Business Segment=\"" + segment + "\" (Webinar/Seminar 통과=" + segmentOk + ")" +
      " / stripped key=\"" + strippedKey + "\"" +
      " / isKoreanProgram_=" + koreanOk +
      " / isEligibleEventType_=" + typeOk +
      " / final key=\"" + finalKey + "\""
    );

  });

  if(matches.length > 20){
    Logger.log("  ... (20건만 출력, 총 " + matches.length + "건)");
  }

}


/**
 * ==========================================================
 * Dump Matching Events_OPS Rows (내부 헬퍼)
 *
 * WHY (2026-08-24 버그 수정)
 * Events_OPS는 1행=SUBTOTAL, 2행=헤더(EVENTS.ROWS.HEADER=2), 3행~=데이터
 * 구조라 범용 sheetToObjects()(1행=헤더 가정)로 읽으면 SUBTOTAL 행을
 * 헤더로 잘못 인식해 모든 컬럼 매칭이 항상 0건으로 나오는 버그가 있었음
 * (최초 실행에서 실측 — "매칭 0건"이 거짓 음성이었음). 이 프로젝트가 이미
 * 갖고 있는 readEventsOPS_()(EVENTS_004_Merge.js, EVENTS.ROWS.HEADER
 * 기준으로 정확히 읽음)를 재사용해 수정.
 * ==========================================================
 */
function dumpMatchingEventsOPSRows_(){

  const records = readEventsOPS_();

  const matches = records.filter(function(r){
    const value = String(r[EVENTS.KEY] || "").toLowerCase();
    return SC_BANK_JHU_SEARCH_TERMS.some(function(term){ return value.indexOf(term) !== -1; });
  });

  Logger.log(EVENTS.SHEET.OPS + " 전체 " + records.length + "행 중 매칭 " + matches.length + "건 (매칭 컬럼: \"" + EVENTS.KEY + "\")");

  matches.slice(0, 20).forEach(function(r){

    Logger.log(
      "  " + EVENTS.KEY + "=\"" + r[EVENTS.KEY] + "\"" +
      " / Marketo Campaign name=\"" + r["Marketo Campaign name"] + "\"" +
      " / Event Date=" + r["Event Date"] +
      " / EventType=" + r["EventType"]
    );

  });

  if(matches.length > 20){
    Logger.log("  ... (20건만 출력, 총 " + matches.length + "건)");
  }

}


/**
 * ==========================================================
 * Dump Matching Rows — 여러 검색어 중 하나라도 포함되면 매칭 (내부 헬퍼)
 *
 * TEMPQA_016의 dumpMatchingRows_()(단일 검색어)를 SC_BANK_JHU_SEARCH_TERMS
 * (복수 검색어, OR 매칭)로 확장한 버전 — 기존 함수를 건드리지 않고 이
 * 조사 전용으로 새로 둠(1회성 진단 파일이라 공유 유틸로 승격하지 않음).
 * ==========================================================
 */
function dumpMatchingRowsAny_(ss, sheetName, matchColumn, logColumns){

  const sheet = ss.getSheetByName(sheetName);

  if(!sheet){
    Logger.log(sheetName + " 시트를 못 찾음.");
    return;
  }

  const records = sheetToObjects(sheet);

  const matches = records.filter(function(r){
    const value = String(r[matchColumn] || "").toLowerCase();
    return SC_BANK_JHU_SEARCH_TERMS.some(function(term){ return value.indexOf(term) !== -1; });
  });

  Logger.log(sheetName + " 전체 " + records.length + "행 중 매칭 " + matches.length + "건 (매칭 컬럼: \"" + matchColumn + "\")");

  matches.slice(0, 20).forEach(function(r){

    const parts = logColumns.map(function(col){
      const v = r[col];
      return col + "=" + (v instanceof Date ? Utilities.formatDate(v, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd") : v);
    });

    Logger.log("  " + parts.join(" / "));

  });

  if(matches.length > 20){
    Logger.log("  ... (20건만 출력, 총 " + matches.length + "건)");
  }

}
