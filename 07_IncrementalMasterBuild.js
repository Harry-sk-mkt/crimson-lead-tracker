/**
 * ==========================================================
 * Marketing 2.0
 * Incremental Master Build
 *
 * Responsibility
 * Raw에 새로 추가된 행만 Transform → Master에 Append
 *
 * Stage
 * 10 Master Build (Incremental)
 *
 * Version
 * v1.1.0
 *
 * Change Log
 * v1.1.0 (2026-07-22)
 * - appendNewLeads() : Master append 후 buildLeadsOPS(skipQA=true) 자동 호출 추가.
 *   신규 Lead가 Leads_OPS에 지체 없이 반영되어야 이후 MTA sync의 대상이 될 수 있음.
 *   refreshACQSummary_() 이전에 실행되도록 배치 (ACQ Summary가 최신 OPS 상태를
 *   반영하도록 하기 위함 — 순서가 바뀌면 이번에 들어온 신규 Lead가 반영되기 전
 *   상태로 Summary가 계산됨).
 * - appendNewMTA() : 기존 refreshACQSummary_() 호출을 syncMTAFunnelToOPS_() 호출로
 *   대체. syncMTAFunnelToOPS_()가 끝에서 이미 refreshACQSummary_()를 호출하므로
 *   중복 계산 방지. "IC Requested 체크했는데 Booked Date가 안 보인다"는 갭 해소 목적
 *   (수동으로 09_MTAFunnelSync.js의 runSyncMTAFunnelToOPS()를 따로 실행할 필요 없어짐).
 * ==========================================================
 */


/**
 * ==========================================================
 * Append New Leads
 * ==========================================================
 */
function appendNewLeads(){

  const start = new Date();

  Logger.log("======================================");
  Logger.log("Append New Leads Started");
  Logger.log("======================================");

  const propKey =
    CONFIG.PROPERTIES.LEADS_LAST_ROW;

  const lastProcessed =
    Number(
      PropertiesService
        .getScriptProperties()
        .getProperty(propKey)
    ) || 0;

  const allRaw =
    readLeadRaw();

  const newRaw =
    allRaw.slice(lastProcessed);

  Logger.log(
    "Total Raw : " + allRaw.length +
    " / Already Processed : " + lastProcessed +
    " / New : " + newRaw.length
  );

  if(newRaw.length === 0){

    Logger.log("No new Lead records to append.");

    SpreadsheetApp.getUi().alert(
      "추가할 새 Lead 레코드가 없습니다."
    );

    return { appended: 0 };

  }

  const newMaster =
    transformLeadRecords(newRaw);

  appendSheetRecords(
    CONFIG.SHEETS.LEADS_MASTER,
    newMaster
  );

  sortSheetByDate(
    CONFIG.SHEETS.LEADS_MASTER,
    "Create Date"
  );

  PropertiesService
    .getScriptProperties()
    .setProperty(
      propKey,
      String(allRaw.length)
    );

  Logger.log("Syncing Leads_OPS (skipQA)...");

  buildLeadsOPS(true);

  refreshACQSummary_();
  refreshNewP1Engine_();

  refreshEventsEngine_();

  const seconds =
    ((new Date() - start) / 1000).toFixed(2);

  Logger.log(
    "Appended " + newMaster.length +
    " Lead records. (" + seconds + "s)"
  );

  Logger.log("======================================");
  Logger.log("Append New Leads Completed");
  Logger.log("======================================");

  SpreadsheetApp.getUi().alert(
    "✅ Leads_Master Append 완료",
    "신규 반영 : " + newMaster.length + "건\n" +
    "소요 시간 : " + seconds + "s",
    SpreadsheetApp.getUi().ButtonSet.OK
  );

  return { appended: newMaster.length };

}


/**
 * ==========================================================
 * Append New MTA
 * ==========================================================
 */
function appendNewMTA(){

  const start = new Date();

  Logger.log("======================================");
  Logger.log("Append New MTA Started");
  Logger.log("======================================");

  const propKey =
    CONFIG.PROPERTIES.MTA_LAST_ROW;

  const lastProcessed =
    Number(
      PropertiesService
        .getScriptProperties()
        .getProperty(propKey)
    ) || 0;

  
  const allRaw =
    readMTARaw();

  const newRaw =
    allRaw.slice(lastProcessed);

  Logger.log(
    "Total Raw : " + allRaw.length +
    " / Already Processed : " + lastProcessed +
    " / New : " + newRaw.length
  );

  if(newRaw.length === 0){

    Logger.log("No new MTA records to append.");

    SpreadsheetApp.getUi().alert(
      "추가할 새 MTA 레코드가 없습니다."
    );

    return { appended: 0 };

  }

  const newMaster =
    transformMTARecords(newRaw);

  appendSheetRecords(
    CONFIG.SHEETS.MTA_MASTER,
    newMaster
  );

  sortSheetByDate(
    CONFIG.SHEETS.MTA_MASTER,
    "MTA Created Date"
  );

  PropertiesService
    .getScriptProperties()
    .setProperty(
      propKey,
      String(allRaw.length)
    );

  Logger.log("Syncing MTA Funnel to Leads_OPS...");

  syncMTAFunnelToOPS_();

  const seconds =
    ((new Date() - start) / 1000).toFixed(2);

  Logger.log(
    "Appended " + newMaster.length +
    " MTA records. (" + seconds + "s)"
  );

  Logger.log("======================================");
  Logger.log("Append New MTA Completed");
  Logger.log("======================================");

  SpreadsheetApp.getUi().alert(
    "✅ MTA_Master Append 완료",
    "신규 반영 : " + newMaster.length + "건\n" +
    "소요 시간 : " + seconds + "s",
    SpreadsheetApp.getUi().ButtonSet.OK
  );

  return { appended: newMaster.length };

}