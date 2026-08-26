/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — Google SA BOFU 프로그램 4건의 실제 raw UTM 확인
 *
 * Responsibility
 * "WF-2026-08-KOR-BOFU-Core Google SA ..." 4개 Marketo Program(Lead Source
 * Detail)이 BOFU 퍼널 태그 vs Business Segment "BOFU" 명칭 충돌로 오분류되던
 * 문제를 `UTIL_001_TransformHelper.js` v1.18.0에서 수정(2026-08-26,
 * docs/BusinessSegmentClassification.md 해당 항목 참고)한 뒤, 이 4개 프로그램
 * 으로 실제 들어온 리드의 raw UTM(MKT UTM Campaign) 값이 무엇인지 확인한다
 * (사용자 질문 — GoogleSearch_Raw 캠페인명과 대조해 지출 매칭 갭을 좁히기
 * 위함). **읽기 전용** — 아무것도 쓰지 않음(TEMPQA_017과 동일 관례).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-08-26)
 * - 최초 구현.
 * ==========================================================
 */

const GOOGLE_SA_PROGRAM_TRACE_KEYS = [
  "WF-2026-08-KOR-BOFU-Core Google SA Transfer-US",
  "WF-2026-08-KOR-BOFU-Core Google SA Transfer-General",
  "WF-2026-08-KOR-BOFU-Core Google SA College Specific-Ivy",
  "WF-2026-08-KOR-BOFU-Core Google SA Consultants-General"
];


function runTraceGoogleSAProgramUTM(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  //----------------------------------------------------------
  // Leads_Master — First Touch Detail 기준, First MKT UTM Campaign 샘플
  //----------------------------------------------------------

  const leadsSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS_MASTER);
  const leadsRecords = leadsSheet ? sheetToObjects(leadsSheet) : [];

  Logger.log("========== Leads_Master (First Touch Detail 기준) ==========");

  GOOGLE_SA_PROGRAM_TRACE_KEYS.forEach(function(key){

    const rows = leadsRecords.filter(function(r){
      return String(r["First Touch Detail"] || "").trim() === key;
    });

    if(rows.length === 0){
      Logger.log("\"" + key + "\" — Leads_Master(First Touch) 0건");
      return;
    }

    const segmentCounts = {};
    const utmSamples = {};

    rows.forEach(function(r){

      const seg = String(r["Business Segment"] || "(공란)");
      segmentCounts[seg] = (segmentCounts[seg] || 0) + 1;

      const utm = String(r["First MKT UTM Campaign"] || "(공란)").trim();
      utmSamples[utm] = (utmSamples[utm] || 0) + 1;

    });

    Logger.log(
      "\"" + key + "\" — New Registered " + rows.length + "건 / Segment 분포: " +
      JSON.stringify(segmentCounts) + " / UTM 분포: " + JSON.stringify(utmSamples)
    );

  });

  //----------------------------------------------------------
  // MTA_Master — Lead Source Detail 기준, MKT UTM Campaign 샘플
  //----------------------------------------------------------

  const mtaSheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);
  const mtaRecords = mtaSheet ? sheetToObjects(mtaSheet) : [];

  Logger.log("");
  Logger.log("========== MTA_Master (Lead Source Detail 기준) ==========");

  GOOGLE_SA_PROGRAM_TRACE_KEYS.forEach(function(key){

    const rows = mtaRecords.filter(function(r){
      return String(r["Lead Source Detail"] || "").trim() === key;
    });

    if(rows.length === 0){
      Logger.log("\"" + key + "\" — MTA_Master 터치 0건");
      return;
    }

    const segmentCounts = {};
    const utmSamples = {};

    rows.forEach(function(r){

      const seg = String(r["Business Segment"] || "(공란)");
      segmentCounts[seg] = (segmentCounts[seg] || 0) + 1;

      const utm = String(r["MKT UTM Campaign"] || "(공란)").trim();
      utmSamples[utm] = (utmSamples[utm] || 0) + 1;

    });

    Logger.log(
      "\"" + key + "\" — 터치 " + rows.length + "건 / Segment 분포: " +
      JSON.stringify(segmentCounts) + " / UTM 분포: " + JSON.stringify(utmSamples)
    );

  });

}
