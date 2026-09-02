/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — FY27 AUG ICFunnel_Raw IC Booked/Completed 미동기화 Lead 추적
 * (docs/OpenItems.md #32 후속 — TEMPQA_042/043 연쇄 조사)
 *
 * Responsibility
 * TEMPQA_042 실측: ICFunnel_Raw 자체 재계산은 FY27 AUG IC Booked=50/
 * IC Completed=33인데 Leads_OPS엔 47/30만 반영돼 있었음. `runSyncICFunnelToOPS()`
 * 재실행(2026-09-01) 후에도 48/31로 1건씩만 회복 — 남은 2건씩은 진짜
 * 동기화 로직 문제가 아니라 "그 Lead ID 자체가 Leads_OPS에 없음"으로 추정.
 * 이 스크립트는 ICFunnel_Raw에서 FY27 AUG IC Booked/Completed Date를 가진
 * Lead ID를 뽑아 Leads_OPS에 없는 것만 골라내고, Leads_Master에는 있는지도
 * 확인해 원인을 좁힌다(#20/#27/#32/#37/#40과 동일한 방법론):
 * (1) Leads_Master에도 없음 — Leads Import 자체가 안 된 신규 리드
 * (2) Leads_Master엔 있는데 Leads_OPS엔 없음 — mergeOPS() 배제 패턴 의심
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 *
 * INPUT: 없음 (ICFunnel_Raw/Leads_Master/Leads_OPS 직접 스캔)
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
function runTraceICFunnelAugustMissingLeads(){

  const TARGET_FY = 27;
  const TARGET_MONTH = "AUG";

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  //----------------------------------------------------------
  // ICFunnel_Raw — FY27 AUG IC Booked 또는 IC Completed를 가진 Lead ID 수집
  //----------------------------------------------------------

  const rawSheet = ss.getSheetByName(CONFIG.IC_FUNNEL.SHEET);
  const rawRecords = sheetToObjects(rawSheet);
  const latestByLeadId = pickLatestICFunnelRecords_(rawRecords);
  const funnelByLeadId = computeICFunnelByLeadId_(latestByLeadId);

  function isTargetMonth(date){
    return date instanceof Date && !isNaN(date.getTime()) &&
      Number(getFiscalYear(date).replace("FY","")) === TARGET_FY &&
      getFiscalMonthLabel(date) === TARGET_MONTH;
  }

  const targetLeadIds = Object.keys(funnelByLeadId).filter(function(leadId){
    const f = funnelByLeadId[leadId];
    return isTargetMonth(f.icBookedDate) || isTargetMonth(f.icCompletedDate);
  });

  Logger.log("ICFunnel_Raw에서 FY27 AUG IC Booked/Completed를 가진 Lead ID 수 : " + targetLeadIds.length);

  //----------------------------------------------------------
  // Leads_OPS — Lead ID Set
  //----------------------------------------------------------

  const opsSheet = ss.getSheetByName(OPS.SHEET.OPS);
  const opsHeaderMap = getHeaderMap(opsSheet);
  const opsLeadIdCol = opsHeaderMap["Lead ID"];
  const opsLastRow = opsSheet.getLastRow();

  const opsLeadIdSet = {};
  if(opsLastRow >= OPS.ROWS.DATA_START){
    opsSheet.getRange(OPS.ROWS.DATA_START, opsLeadIdCol + 1, opsLastRow - OPS.ROWS.DATA_START + 1, 1)
      .getValues()
      .forEach(function(row){
        const id = String(row[0] || "").trim();
        if(id) opsLeadIdSet[id] = true;
      });
  }

  //----------------------------------------------------------
  // Leads_Master — Lead ID Set
  //----------------------------------------------------------

  const masterSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS_MASTER);
  const masterHeaderMap = getHeaderMap(masterSheet);
  const masterLeadIdCol = masterHeaderMap["Lead ID"];
  const masterLastRow = masterSheet.getLastRow();

  const masterLeadIdSet = {};
  if(masterLastRow >= 2){
    masterSheet.getRange(2, masterLeadIdCol + 1, masterLastRow - 1, 1)
      .getValues()
      .forEach(function(row){
        const id = String(row[0] || "").trim();
        if(id) masterLeadIdSet[id] = true;
      });
  }

  //----------------------------------------------------------
  // 분류
  //----------------------------------------------------------

  const missingFromOPS = targetLeadIds.filter(function(id){ return !opsLeadIdSet[id]; });

  Logger.log("");
  Logger.log("Leads_OPS에 없는 Lead ID 수 : " + missingFromOPS.length);

  missingFromOPS.forEach(function(leadId){

    const f = funnelByLeadId[leadId];
    const inMaster = !!masterLeadIdSet[leadId];

    Logger.log(
      "  - " + leadId +
      " | IC Booked=" + (f.icBookedDate ? Utilities.formatDate(f.icBookedDate, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd") : "") +
      " | IC Completed=" + (f.icCompletedDate ? Utilities.formatDate(f.icCompletedDate, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd") : "") +
      " | Leads_Master에 있음? " + (inMaster ? "예 (2) mergeOPS 배제 의심" : "아니오 (1) Leads Import 공백")
    );

  });

  if(missingFromOPS.length === 0){
    Logger.log("Leads_OPS에 없는 Lead ID가 없습니다 — 모든 대상 Lead가 Leads_OPS에 존재. " +
      "그런데도 값이 반영 안 됐다면 sync 로직 자체를 재확인해야 합니다.");
  }

}
