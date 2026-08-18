/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — Sales Accepted Date 복구 후 잔여 3건 원인 조사 (docs/OpenItems.md #26)
 *
 * Responsibility
 * TEMPQA_008_SalesAcceptedDateRepair.js(swap-back 복구) +
 * TEMPQA_010_SalesAcceptedDateStaleClear.js(잔존값 클리어) 이후에도
 * 설명되지 않은 채 남은 3개 Lead ID(day>12라 애초에 day/month swap
 * 가설로는 설명 안 됨, docs/Changelog.md 2026-08-19 참고)를 대상으로,
 * (1) 정확히 어떤 날짜 값이 남아있는지, (2) 월말(day>=28) 패턴과
 * 일치하는지, (3) 같은 리드의 다른 날짜 컬럼(IC Booked/Completed/Won
 * Date)에도 비슷한 이상이 있는지를 실측으로 확인해 "Salesforce 자동화
 * 추정" 가설을 검증하거나 새 단서를 찾는다. **읽기 전용** — 아무것도
 * 쓰지 않음(TEMPQA_005/009와 동일 관례).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-08-19)
 * - 최초 구현.
 * ==========================================================
 */

const SAL_RESIDUAL_LEAD_IDS = [
  "00QRC00000ti6Vc",
  "00QRC00000tnGLi",
  "00QRC00000shbd7"
];


function runTraceSalesAcceptedDateResidual(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const today = new Date();

  //----------------------------------------------------------
  // MTA_Raw — 해당 Lead ID의 모든 터치 행(원본 컬럼명 기준)
  //----------------------------------------------------------

  const rawSheet = ss.getSheetByName(CONFIG.SHEETS.MTA_RAW);
  const rawRecords = rawSheet ? sheetToObjects(rawSheet) : [];

  Logger.log("========== MTA_Raw ==========");

  SAL_RESIDUAL_LEAD_IDS.forEach(function(leadId){

    const rows = rawRecords.filter(function(r){
      return String(r["Lead: Lead ID"] || "").trim() === leadId;
    });

    Logger.log("Lead ID " + leadId + " — MTA_Raw 터치 " + rows.length + "건");

    rows.forEach(function(r){
      Logger.log(
        "  MTA Created Date(raw)=" + r["Multi Touch Attribution: Created Date"] +
        " / Sales Accepted Date(raw)=" + r["Lead: Sales Accepted Date"] +
        " / IC Booked Date(raw)=" + r["Lead: IC Booked Date"] +
        " / IC Completed Date(raw)=" + r["Lead: IC Completed Date (Pre-Conversion)"] +
        " / Opportunity Won Date(raw)=" + r["Lead: Opportunity Won Date"]
      );
    });

  });

  //----------------------------------------------------------
  // MTA_Master — 대표 터치(latest) 기준 Sales Accepted Date +
  // 월말(day>=28) 패턴 여부
  //----------------------------------------------------------

  const mtaSheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);
  const mtaRecords = mtaSheet ? sheetToObjects(mtaSheet) : [];
  const funnelByLeadId = computeMTAFunnelByLeadId_(mtaRecords);

  Logger.log("");
  Logger.log("========== MTA_Master (대표 터치 기준) ==========");

  SAL_RESIDUAL_LEAD_IDS.forEach(function(leadId){

    const funnel = funnelByLeadId[leadId];
    const salDate = funnel ? funnel.salesAcceptedDate : undefined;

    if(!(salDate instanceof Date) || isNaN(salDate.getTime())){
      Logger.log("Lead ID " + leadId + " — 대표 터치 Sales Accepted Date 없음/공란 (현재값=" + salDate + ")");
      return;
    }

    const day = salDate.getDate();
    const isMonthEndPattern = day >= 28;
    const isFuture = salDate > today;

    Logger.log(
      "Lead ID " + leadId +
      " — Sales Accepted Date=" + Utilities.formatDate(salDate, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd") +
      " / day=" + day +
      " / 월말(>=28)패턴=" + isMonthEndPattern +
      " / 오늘(" + Utilities.formatDate(today, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd") + ") 이후 미래=" + isFuture
    );

  });

  //----------------------------------------------------------
  // Leads_OPS — 현재 동기화된 값 + 다른 날짜 컬럼과 비교
  //----------------------------------------------------------

  const opsSheet = ss.getSheetByName(OPS.SHEET.OPS);
  const opsRecords = opsSheet ? sheetToObjects(opsSheet) : [];

  Logger.log("");
  Logger.log("========== Leads_OPS ==========");

  SAL_RESIDUAL_LEAD_IDS.forEach(function(leadId){

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
      " / IC Booked Date=" + row["IC Booked Date"] +
      " / IC Completed Date=" + row["IC Completed Date"] +
      " / Opportunity Won Date=" + row["Opportunity Won Date"] +
      " / Lead Priority=" + row["Lead Priority"] +
      " / Business Segment=" + row["Business Segment"]
    );

  });

  Logger.log("");
  Logger.log("========== 참고: 판정 기준 ==========");
  Logger.log("day>=28(월말)이면서 다른 날짜 컬럼도 같은 달 말일 근처면 'Salesforce 자동화(월말 일괄 처리)' 가설에 부합.");
  Logger.log("day<12(swap 가능 영역)인데 여기 남아있다면 TEMPQA_008 복구 로직 자체의 누락/버그 가능성 — 개별 재확인 필요.");

}
