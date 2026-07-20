/**
 * ==========================================================
 * Marketing 2.0
 * Master Writer
 *
 * Responsibility
 * Write Master records to Master sheets.
 *
 * Stage
 * 10 Master Build
 *
 * Version
 * v3.0.0
 * ==========================================================
 */


/**
 * ==========================================================
 * Write Leads Master
 * ==========================================================
 *
 * @param {Object[]} records
 *
 */
function writeLeadMaster(records){

  writeSheetRecords(
    CONFIG.SHEETS.LEADS_MASTER,
    records
  );

}


/**
 * ==========================================================
 * Write MTA Master
 * ==========================================================
 *
 * @param {Object[]} records
 *
 */
function writeMTAMaster(records){

  writeSheetRecords(
    CONFIG.SHEETS.MTA_MASTER,
    records
  );

}