/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — "WF-2026-08-KOR-BOFU-Core Duke CAO advise" BOFU_OPS 누락 조사
 *
 * Responsibility
 * 사용자가 지난주 금요일 런칭한 이 프로그램에 리드 2건이 이미 들어왔고
 * 이번 주 월요일 import에서 잡혔어야 한다고 보고했는데, BOFU_OPS엔 행이
 * 안 보임(2026-08-19). 원인 후보: (1) Leads_Raw/MTA_Raw에 애초에 안
 * 들어왔음(Import 자체가 아직 안 됐거나 CSV에 없었음), (2)
 * Leads_Master/MTA_Master까지는 갔는데 Business Segment가 "BOFU"가
 * 아닌 다른 값으로 분류돼 BOFU_002_Engine.js의 `BOFU.SEGMENTS` 필터에
 * 걸러짐(BusinessSegmentClassification.md에 이런 사례 다수 기록), (3)
 * Pipeline Status가 죽은 RUNNING/FAILED로 멈춰 이번 주 백그라운드 refresh
 * 체인이 안 돌았음. 이 세 지점을 전부 덤프해 실측으로 원인을 좁힌다.
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA_005/009와 동일 관례).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-08-19)
 * - 최초 구현.
 * ==========================================================
 */

const BOFU_DUKE_CAO_ADVISE_SEARCH_TERM = "duke cao advise";


function runTraceBOFUDukeCaoAdviseGap(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  //----------------------------------------------------------
  // 1. Leads_Raw — "First Touch Detail"에 검색어 포함된 행
  //----------------------------------------------------------

  Logger.log("========== Leads_Raw ==========");
  dumpMatchingRows_(ss, CONFIG.SHEETS.LEADS_RAW, "First Touch Detail", ["Lead ID", "Create Date", "First Touch Detail"]);

  //----------------------------------------------------------
  // 2. Leads_Master — 동일 + Business Segment
  //----------------------------------------------------------

  Logger.log("");
  Logger.log("========== Leads_Master ==========");
  dumpMatchingRows_(ss, CONFIG.SHEETS.LEADS_MASTER, "First Touch Detail", ["Lead ID", "Create Date", "First Touch Detail", "Business Segment", "Lead Priority"]);

  //----------------------------------------------------------
  // 3. MTA_Raw — "Lead Source Detail"에 검색어 포함된 행
  //----------------------------------------------------------

  Logger.log("");
  Logger.log("========== MTA_Raw ==========");
  dumpMatchingRows_(ss, CONFIG.SHEETS.MTA_RAW, "Lead Source Detail", ["Lead: Lead ID", "Multi Touch Attribution: Created Date", "Lead Source Detail"]);

  //----------------------------------------------------------
  // 4. MTA_Master — 동일 + Business Segment
  //----------------------------------------------------------

  Logger.log("");
  Logger.log("========== MTA_Master ==========");
  dumpMatchingRows_(ss, CONFIG.SHEETS.MTA_MASTER, "Lead Source Detail", ["Lead ID", "MTA Created Date", "Lead Source Detail", "Business Segment", "Lead Priority"]);

  //----------------------------------------------------------
  // 5. Pipeline Status — 죽은 락/실패 상태인지 확인
  //----------------------------------------------------------

  Logger.log("");
  Logger.log("========== Pipeline Status ==========");

  const leadsState = readPipelineStatusState_(CONFIG.PIPELINE.TYPES.LEADS);
  const mtaState = readPipelineStatusState_(CONFIG.PIPELINE.TYPES.MTA);

  Logger.log("LEADS: " + JSON.stringify(leadsState));
  Logger.log("MTA: " + JSON.stringify(mtaState));

  const lock = PropertiesService.getScriptProperties().getProperty(CONFIG.PROPERTIES.PIPELINE_LOCK);
  Logger.log("PIPELINE_LOCK: " + (lock || "(없음)"));

}


/**
 * ==========================================================
 * Dump Matching Rows (내부 헬퍼)
 *
 * INPUT
 * ss          : Spreadsheet
 * sheetName   : string
 * matchColumn : string  (이 컬럼 값에 BOFU_DUKE_CAO_ADVISE_SEARCH_TERM이
 *                포함되는지 대소문자 무시로 검사)
 * logColumns  : string[]  (매칭된 행에서 출력할 컬럼들)
 * ==========================================================
 */
function dumpMatchingRows_(ss, sheetName, matchColumn, logColumns){

  const sheet = ss.getSheetByName(sheetName);

  if(!sheet){
    Logger.log(sheetName + " 시트를 못 찾음.");
    return;
  }

  const records = sheetToObjects(sheet);

  const matches = records.filter(function(r){
    return String(r[matchColumn] || "").toLowerCase().indexOf(BOFU_DUKE_CAO_ADVISE_SEARCH_TERM) !== -1;
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
