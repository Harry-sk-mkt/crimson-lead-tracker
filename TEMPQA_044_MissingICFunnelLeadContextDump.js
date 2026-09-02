/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — TEMPQA_043에서 찾은 3개 미등록 Lead ID의 내부 컨텍스트 덤프
 * (docs/OpenItems.md #32 후속)
 *
 * Responsibility
 * TEMPQA_043 실측으로 확인된 3개 Lead ID(00QRC00000ZsV97/00QRC00000D1CCY/
 * 00QRC000011JJ3o)는 Leads_Master/Leads_OPS엔 없지만 ICFunnel_Raw엔 IC
 * Booked/Completed 기록이 있다. 사용자가 Salesforce에서 이 3건을 직접
 * 확인하기 전에, 우리 시스템 안에 남아있는 다른 흔적(MTA_Master 터치 —
 * 별도 Salesforce 리포트라 Leads 리포트 범위 밖이어도 잡혔을 수 있음,
 * Deal Tracker)을 먼저 덤프해 Email/Lead Created Date 등 Salesforce
 * 조회에 필요한 단서를 제공한다.
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 *
 * INPUT: 없음 (MTA_Master/Deal Tracker 캐시 직접 스캔)
 * OUTPUT: Logger.log만
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 조사 스크립트(TEMPQA 관례).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-09-01)
 * - 최초 구현.
 * ==========================================================
 */
function runDumpMissingICFunnelLeadContext(){

  const TARGET_LEAD_IDS = ["00QRC00000ZsV97", "00QRC00000D1CCY", "00QRC000011JJ3o"];

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  //----------------------------------------------------------
  // MTA_Master — 이 Lead ID들의 터치 기록이 있는지
  //----------------------------------------------------------

  const mtaSheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);
  const mtaRecords = sheetToObjects(mtaSheet);

  Logger.log("========== MTA_Master 터치 기록 ==========");

  TARGET_LEAD_IDS.forEach(function(leadId){

    const touches = mtaRecords.filter(function(r){
      return String(r["Lead ID"] || "").trim() === leadId;
    });

    if(touches.length === 0){
      Logger.log(leadId + " : MTA_Master에도 터치 기록 없음");
      return;
    }

    const emails = {};
    let minCreated = null, maxTouch = null;

    touches.forEach(function(r){
      if(r["Email"]) emails[r["Email"]] = true;

      const leadCreated = r["Lead Created Date"];
      if(leadCreated instanceof Date && !isNaN(leadCreated.getTime())){
        if(!minCreated || leadCreated.getTime() < minCreated.getTime()) minCreated = leadCreated;
      }

      const mtaCreated = r["MTA Created Date"];
      if(mtaCreated instanceof Date && !isNaN(mtaCreated.getTime())){
        if(!maxTouch || mtaCreated.getTime() > maxTouch.getTime()) maxTouch = mtaCreated;
      }
    });

    Logger.log(
      leadId + " : 터치 " + touches.length + "건 | Email=" + Object.keys(emails).join(",") +
      " | Lead Created Date=" + (minCreated ? Utilities.formatDate(minCreated, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd") : "(없음)") +
      " | 가장 최근 MTA Created Date=" + (maxTouch ? Utilities.formatDate(maxTouch, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd") : "(없음)")
    );

  });

  //----------------------------------------------------------
  // Deal Tracker 캐시 — 이 Lead들과 연결된 딜이 있는지는 Lead ID로
  // 조인이 안 되므로(Deal Tracker는 Lead ID 컬럼이 없음), Email로만
  // 대조 가능 — 위에서 찾은 Email이 있으면 참고용으로 안내만.
  //----------------------------------------------------------

  Logger.log("");
  Logger.log("참고: Deal Tracker는 Lead ID 컬럼이 없어 이 스크립트에서 직접 대조하지 않음 — " +
    "위 Email이 나오면 Deal Tracker에서 수동으로 검색해볼 것.");

}
