/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — Sales Accepted Date 복구 후에도 남은 미래 날짜 4건 추적
 *
 * Responsibility
 * TEMPQA_008_SalesAcceptedDateRepair.js 실행(MTA_Raw 복구) →
 * rebuildMTAMaster() → runSyncMTAFunnelToOPS() 이후에도 Leads_OPS에
 * 여전히 미래(2026-10/11월) Sales Accepted Date가 남아있는 4개 Lead ID
 * (사용자 보고, 2026-08-19)를 MTA_Raw/MTA_Master/Leads_OPS 세 지점에서
 * 전부 덤프해 파이프라인 어느 단계에서 반영이 안 됐는지, 혹은 다른 터치가
 * "이겨서"(computeMTAFunnelByLeadId_() latest-touch 규칙) 이 값이 나온
 * 것인지 실측으로 확인한다. **읽기 전용** — 아무것도 쓰지 않음
 * (TEMPQA_005_JulyNewLeadsGap.js와 동일 관례).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-08-19)
 * - 최초 구현.
 * ==========================================================
 */

const SUSPECT_LEAD_IDS = [
  "00QRC00000ti6Vc",
  "00QRC00000tnGLi",
  "00QRC00000shbd7",
  "00QRC000001eqAb"
];


function runDumpSalesAcceptedDateLeadTrace(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  //----------------------------------------------------------
  // MTA_Raw — 해당 Lead ID의 모든 터치 행(원본 컬럼명 기준)
  //----------------------------------------------------------

  const rawSheet = ss.getSheetByName(CONFIG.SHEETS.MTA_RAW);
  const rawRecords = rawSheet ? sheetToObjects(rawSheet) : [];

  Logger.log("========== MTA_Raw ==========");

  SUSPECT_LEAD_IDS.forEach(function(leadId){

    const rows = rawRecords.filter(function(r){
      return String(r["Lead: Lead ID"] || "").trim() === leadId;
    });

    Logger.log("Lead ID " + leadId + " — MTA_Raw 터치 " + rows.length + "건");

    rows.forEach(function(r){
      Logger.log(
        "  MTA Created Date(raw)=" + r["Multi Touch Attribution: Created Date"] +
        " / Sales Accepted Date(raw)=" + r["Lead: Sales Accepted Date"]
      );
    });

  });

  //----------------------------------------------------------
  // MTA_Master — 같은 Lead ID의 모든 터치 행(Transform 후 컬럼명 기준)
  //----------------------------------------------------------

  const mtaSheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);
  const mtaRecords = mtaSheet ? sheetToObjects(mtaSheet) : [];

  Logger.log("");
  Logger.log("========== MTA_Master ==========");

  SUSPECT_LEAD_IDS.forEach(function(leadId){

    const rows = mtaRecords.filter(function(r){
      return String(r["Lead ID"] || "").trim() === leadId;
    });

    Logger.log("Lead ID " + leadId + " — MTA_Master 터치 " + rows.length + "건");

    rows.forEach(function(r){
      Logger.log(
        "  MTA Created Date=" + r["MTA Created Date"] +
        " / Sales Accepted Date=" + r["Sales Accepted Date"]
      );
    });

    // computeMTAFunnelByLeadId_()와 동일 규칙(latest MTA Created Date)으로
    // 실제 Leads_OPS에 동기화될 "대표 터치"가 어느 것인지 계산
    if(rows.length > 0){

      let latestRow = rows[0];

      rows.forEach(function(row){
        const candidateDate = row["MTA Created Date"];
        const latestDate = latestRow["MTA Created Date"];
        const candidateValid = candidateDate instanceof Date && !isNaN(candidateDate.getTime());
        const latestValid = latestDate instanceof Date && !isNaN(latestDate.getTime());
        if(candidateValid && latestValid && candidateDate.getTime() > latestDate.getTime()){
          latestRow = row;
        }
      });

      Logger.log(
        "  -> 대표 터치(latest) Sales Accepted Date=" + latestRow["Sales Accepted Date"]
      );

    }

  });

  //----------------------------------------------------------
  // Leads_OPS — 현재 동기화된 값
  //----------------------------------------------------------

  const opsSheet = ss.getSheetByName(OPS.SHEET.OPS);
  const opsRecords = opsSheet ? sheetToObjects(opsSheet) : [];

  Logger.log("");
  Logger.log("========== Leads_OPS ==========");

  SUSPECT_LEAD_IDS.forEach(function(leadId){

    const row = opsRecords.filter(function(r){
      return String(r["Lead ID"] || "").trim() === leadId;
    })[0];

    if(!row){
      Logger.log("Lead ID " + leadId + " — Leads_OPS에 없음");
      return;
    }

    Logger.log(
      "Lead ID " + leadId +
      " — Sales Accepted Date=" + row["Sales Accepted Date"] +
      " / Lead Priority=" + row["Lead Priority"] +
      " / Business Segment=" + row["Business Segment"]
    );

  });

}
