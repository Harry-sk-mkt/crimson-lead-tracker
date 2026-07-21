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
 * v1.0.0
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

  refreshACQSummary_();   

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

  refreshACQSummary_();

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