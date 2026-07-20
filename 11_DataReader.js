/**
 * ==========================================================
 * Marketing 2.0
 * Data Reader
 *
 * Responsibility
 * Read Raw tables into JavaScript objects.
 *
 * Stage
 * 10 Master Build
 *
 * Version
 * v2.0.0
 *
 * Change Log
 * v2.0.0 (2026-07-20)
 * - New Data Reader layer.
 * - Separated Raw reading from Master Build.
 * - Returns object arrays from Raw sheets.
 * ==========================================================
 */


/**
 * ==========================================================
 * Read Lead Raw
 * ==========================================================
 */
function readLeadRaw(){

  return readRawSheet(
    CONFIG.SHEETS.LEADS_RAW
  );

}


/**
 * ==========================================================
 * Read MTA Raw
 * ==========================================================
 */
function readMTARaw(){

  return readRawSheet(
    CONFIG.SHEETS.MTA_RAW
  );

}


/**
 * ==========================================================
 * Generic Raw Reader
 * ==========================================================
 *
 * @param {string} sheetName
 * @returns {Object[]}
 *
 */
function readRawSheet(
  sheetName
){

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const sheet =
    ss.getSheetByName(
      sheetName
    );

  if(!sheet){

    throw new Error(

      "Sheet not found : " +
      sheetName

    );

  }

  const values =
    sheet.getDataRange().getValues();

  if(values.length <= 1){

    return [];

  }

  const headers =
    values[0];

  const records =
    [];

  for(
    let i = 1;
    i < values.length;
    i++
  ){

    const row =
      values[i];

    const record =
      {};

    for(
      let j = 0;
      j < headers.length;
      j++
    ){

      record[
        headers[j]
      ] = row[j];

    }

    records.push(
      record
    );

  }

  Logger.log(

    sheetName +
    " : " +
    records.length +
    " records read."

  );

  return records;

}