/**
 * ==========================================================
 * Marketing 2.0
 * Leads OPS Writer
 *
 * Responsibility
 * Write merged Leads_OPS data into sheet
 *
 * Version
 * v2.1
 *
 * Change Log
 * v2.1 (2026-07-20)
 * - Replaced hardcoded row indices (1, 2) with
 *   OPS.ROWS.HEADER / OPS.ROWS.DATA_START.
 * ==========================================================
 */

function writeOPS(rows) {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(OPS.SHEET.OPS);

  if (!sheet) {
    sheet = ss.insertSheet(OPS.SHEET.OPS);
  }

  /*
  ==========================================================
  Clear existing contents only
  (Keep column width)
  ==========================================================
  */

  sheet.clear();

  /*
  ==========================================================
  Header
  ==========================================================
  */

  sheet
    .getRange(OPS.ROWS.HEADER, 1, 1, OPS.HEADER.length)
    .setValues([OPS.HEADER]);

  /*
  ==========================================================
  Data
  ==========================================================
  */

  if (rows && rows.length > 0) {

    sheet
      .getRange(
        OPS.ROWS.DATA_START,
        1,
        rows.length,
        OPS.HEADER.length
      )
      .setValues(rows);

  }

  /*
  ==========================================================
  Freeze Header
  ==========================================================
  */

  sheet.setFrozenRows(OPS.ROWS.HEADER);

  /*
  ==========================================================
  Filter
  ==========================================================
  */

  if (sheet.getFilter()) {
    sheet.getFilter().remove();
  }

  if (sheet.getLastRow() > OPS.ROWS.HEADER) {

    sheet
      .getRange(
        OPS.ROWS.HEADER,
        1,
        sheet.getLastRow(),
        OPS.HEADER.length
      )
      .createFilter();

  }

  /*
  ==========================================================
  Apply Styles
  ==========================================================
  */

  applyOPSStyle(sheet);

}