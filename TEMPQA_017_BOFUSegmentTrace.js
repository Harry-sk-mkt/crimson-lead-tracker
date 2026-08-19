/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — BOFU_OPS 잔여 이상 프로그램 추적
 *
 * Responsibility
 * `computeBOFUDealAggregates_()` Business Segment 게이트 버그 수정 +
 * `runDeleteDeadBOFUOPSRows()` 정리(2026-08-19) 이후에도 사용자가 지적한
 * 두 가지가 남아있음:
 * (1) "WB-2023-10-KOR-MOFU-Core How to Get into California Universities?"/
 *     "WB-2022-03-KOR-MOFU-Core How to get into Top US universities with
 *     alumni" — 여전히 BOFU_OPS에 남아있는 WB 프로그램 2건.
 * (2) "WF-2024-06-KOR-BOFU-Core Crimson New Brochure"/
 *     "WF-2023-04-KOR-MOFU-Core Hyperlocalized Korean Army Infographic"/
 *     "WF-2025-08-KOR-MOFU-Core New Personal Essay 7 Samples eBook" —
 *     WF 프로그램이지만 성격상 Content로 보이는데 BOFU_OPS에 남아있음.
 * 또한 "WF-2026-08-KOR-BOFU-Core Duke CAO advise"/"...How to get 5.5 m
 * scholarship" 2건의 실제 raw UTM(MKT UTM Campaign)이 무엇인지도 함께
 * 확인한다(사용자 질문).
 *
 * 이 5+2건을 MTA_Master/Leads_Master(Business Segment 저장값)와 Deal
 * Tracker(Segment 열 원본)에서 각각 찾아 정확히 어디서 "BOFU"로 잡히는지
 * 좁힌다. **읽기 전용** — 아무것도 쓰지 않음(TEMPQA_005/009와 동일 관례).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-08-19)
 * - 최초 구현.
 * ==========================================================
 */

const BOFU_SEGMENT_TRACE_KEYS = [
  "WB-2023-10-KOR-MOFU-Core How to Get into California Universities?",
  "WB-2022-03-KOR-MOFU-Core How to get into Top US universities with alumni",
  "WF-2024-06-KOR-BOFU-Core Crimson New Brochure",
  "WF-2023-04-KOR-MOFU-Core Hyperlocalized Korean Army Infographic",
  "WF-2025-08-KOR-MOFU-Core New Personal Essay 7 Samples eBook",
  "WF-2026-08-KOR-BOFU-Core Duke CAO advise",
  "WF-2026-08-KOR-BOFU-Core Duke CAO How to get 5.5 m scholarship"
];


function runTraceBOFUSegmentAnomalies(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  //----------------------------------------------------------
  // MTA_Master — Business Segment 분포 + 대표 raw UTM 샘플
  //----------------------------------------------------------

  const mtaSheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);
  const mtaRecords = mtaSheet ? sheetToObjects(mtaSheet) : [];

  Logger.log("========== MTA_Master ==========");

  BOFU_SEGMENT_TRACE_KEYS.forEach(function(key){

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

      const utm = String(r["MKT UTM Campaign"] || "").trim();

      if(utm && Object.keys(utmSamples).length < 3 && !utmSamples[utm]){
        utmSamples[utm] = true;
      }

    });

    Logger.log(
      "\"" + key + "\" — 터치 " + rows.length + "건 / Segment 분포: " +
      JSON.stringify(segmentCounts) + " / UTM 샘플: " + Object.keys(utmSamples).join(" | ")
    );

  });

  //----------------------------------------------------------
  // Leads_Master — Business Segment 분포
  //----------------------------------------------------------

  const leadsSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS_MASTER);
  const leadsRecords = leadsSheet ? sheetToObjects(leadsSheet) : [];

  Logger.log("");
  Logger.log("========== Leads_Master ==========");

  BOFU_SEGMENT_TRACE_KEYS.forEach(function(key){

    const rows = leadsRecords.filter(function(r){
      return String(r["First Touch Detail"] || "").trim() === key;
    });

    if(rows.length === 0){
      Logger.log("\"" + key + "\" — Leads_Master(First Touch) 0건");
      return;
    }

    const segmentCounts = {};

    rows.forEach(function(r){
      const seg = String(r["Business Segment"] || "(공란)");
      segmentCounts[seg] = (segmentCounts[seg] || 0) + 1;
    });

    Logger.log("\"" + key + "\" — New Registered " + rows.length + "건 / Segment 분포: " + JSON.stringify(segmentCounts));

  });

  //----------------------------------------------------------
  // Deal Tracker — Segment(원본, businessSegment) 분포
  //----------------------------------------------------------

  Logger.log("");
  Logger.log("========== Deal Tracker ==========");

  const dealRows = readDealTrackerRawRows_();

  BOFU_SEGMENT_TRACE_KEYS.forEach(function(key){

    const matches = dealRows.filter(function(row){
      return stripRegistrationFormSuffix_(row.leadSourceDetail) === key;
    });

    if(matches.length === 0){
      Logger.log("\"" + key + "\" — Deal Tracker 0건");
      return;
    }

    const segmentCounts = {};
    let revenueSum = 0;

    matches.forEach(function(row){
      const seg = String(row.businessSegment || "(공란)");
      segmentCounts[seg] = (segmentCounts[seg] || 0) + 1;
      revenueSum += Number(row.revenue) || 0;
    });

    Logger.log(
      "\"" + key + "\" — 딜 " + matches.length + "건 / Segment 분포: " +
      JSON.stringify(segmentCounts) + " / Revenue 합계: " + revenueSum.toFixed(2)
    );

  });

}
