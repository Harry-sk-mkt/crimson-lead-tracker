/**
 * ==========================================================
 * Marketing 2.0
 * Master Rebuild (Full)
 *
 * Responsibility
 * Master 전체를 Raw로부터 재계산 (복구/Business Rule 변경 시 사용)
 *
 * Stage
 * 10 Master Build (Full Rebuild)
 *
 * Version
 * v4.0.0
 *
 * Change Log
 * v4.0.0 (2026-07-21)
 * - buildLeadsMaster/buildMTAMaster → rebuildLeadsMaster/rebuildMTAMaster로 개명.
 * - buildAllMaster() 제거 (Leads/MTA 완전 분리 운영으로 전환).
 * - Rebuild 후 정렬 + PropertiesService 카운터 리셋 추가
 *   (Rebuild 이후 Append가 중복 처리하지 않도록).
 * ==========================================================
 */


/**
 * ==========================================================
 * Rebuild Leads Master (Full)
 * ==========================================================
 */
function rebuildLeadsMaster(showAlert = true) {

  Logger.log(
    CONFIG.LOG.PREFIX +
    " Rebuild Leads Master (FULL) Started"
  );

  const raw = readLeadRaw();

  Logger.log(
    CONFIG.LOG.PREFIX +
    " Raw Leads : " +
    raw.length
  );

  const master =
    transformLeadRecords(raw);

  Logger.log(
    CONFIG.LOG.PREFIX +
    " Master Leads : " +
    master.length
  );

  writeLeadMaster(master);

  sortSheetByDate(
    CONFIG.SHEETS.LEADS_MASTER,
    "Create Date"
  );

  //----------------------------------------------------------
  // Rebuild 완료 후, Append가 중복 처리하지 않도록
  // 처리 카운터를 Raw 전체 길이로 리셋
  //----------------------------------------------------------

  PropertiesService
    .getScriptProperties()
    .setProperty(
      CONFIG.PROPERTIES.LEADS_LAST_ROW,
      String(raw.length)
    );

  refreshACQSummary_();
  refreshNewP1Engine_();

  refreshEventsEngine_();

  Logger.log(
    CONFIG.LOG.PREFIX +
    " ACQ Summary refreshed."
  );

  const result = {
    raw: raw.length,
    master: master.length
  };

  Logger.log(
    CONFIG.LOG.PREFIX +
    " Rebuild Leads Master (FULL) Completed"
  );

  if (showAlert) {

    SpreadsheetApp.getUi().alert(
      "✅ Leads_Master Rebuild 완료",
      [
        "Full Rebuild Complete",
        "",
        "Raw : " + result.raw,
        "Master : " + result.master
      ].join("\n"),
      SpreadsheetApp.getUi().ButtonSet.OK
    );

  }

  return result;

}


/**
 * ==========================================================
 * Rebuild MTA Master (Full)
 * ==========================================================
 */
function rebuildMTAMaster(showAlert = true) {

  Logger.log(
    CONFIG.LOG.PREFIX +
    " Rebuild MTA Master (FULL) Started"
  );

  const raw = readMTARaw();

  Logger.log(
    CONFIG.LOG.PREFIX +
    " Raw MTA : " +
    raw.length
  );

  const master =
    transformMTARecords(raw);

  Logger.log(
    CONFIG.LOG.PREFIX +
    " Master MTA : " +
    master.length
  );

  writeMTAMaster(master);

  sortSheetByDate(
    CONFIG.SHEETS.MTA_MASTER,
    "MTA Created Date"
  );

  PropertiesService
    .getScriptProperties()
    .setProperty(
      CONFIG.PROPERTIES.MTA_LAST_ROW,
      String(raw.length)
    );

  refreshACQSummary_();
  refreshNewP1Engine_();

  refreshEventsEngine_();

  Logger.log(
    CONFIG.LOG.PREFIX +
    " ACQ Summary refreshed."
  );

  const result = {
    raw: raw.length,
    master: master.length
  };

  Logger.log(
    CONFIG.LOG.PREFIX +
    " Rebuild MTA Master (FULL) Completed"
  );

  if (showAlert) {

    SpreadsheetApp.getUi().alert(
      "✅ MTA_Master Rebuild 완료",
      [
        "Full Rebuild Complete",
        "",
        "Raw : " + result.raw,
        "Master : " + result.master
      ].join("\n"),
      SpreadsheetApp.getUi().ButtonSet.OK
    );

  }

  return result;

}