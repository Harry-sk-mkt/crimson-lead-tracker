/**
 * ==========================================================
 * Marketing 2.0
 * Leads OPS Styles
 *
 * Responsibility
 * Apply formatting to Leads_OPS
 *
 * Version
 * v3.0.0
 *
 * Change Log
 * v3.0.0 (2026-07-21)
 * - 하드코딩된 헤더/데이터 행 번호(1, 2)를 OPS.ROWS.HEADER / OPS.ROWS.DATA_START로 교체.
 * ==========================================================
 */

function applyOPSStyle(sheet) {

  const lastRow = Math.max(
    sheet.getLastRow(),
    OPS.ROWS.DATA_START
  );

  const lastCol = sheet.getLastColumn();

  const dataRowCount =
    lastRow - OPS.ROWS.DATA_START + 1;

  /*
  ==========================================================
  Header
  ==========================================================
  */

  sheet.getRange(OPS.ROWS.HEADER, 1, 1, lastCol)
    .setBackground("#202124")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  /*
  ==========================================================
  Body
  ==========================================================
  */

  sheet.getRange(OPS.ROWS.DATA_START, 1, dataRowCount, lastCol)
    .setVerticalAlignment("middle")
    .setWrap(false);

  /*
  ==========================================================
  Build Header Map
  ==========================================================
  */

  const headers = sheet.getRange(OPS.ROWS.HEADER, 1, 1, lastCol).getValues()[0];

  const map = {};

  headers.forEach(function(header, i) {
    map[header] = i + 1;
  });

  /*
  ==========================================================
  Date Columns
  ==========================================================
  */

  [
    "Create Date",
    "IC Booked Date",
    "IC Completed Date",
    "Opportunity Won Date"
  ].forEach(function(name){

    if(map[name]){

      sheet
        .getRange(OPS.ROWS.DATA_START, map[name], dataRowCount, 1)
        .setNumberFormat("yyyy-mm-dd");

    }

  });

  /*
  ==========================================================
  Currency Columns
  ==========================================================
  */

  [
    "Revenue",
    "Revenue Actual"
  ].forEach(function(name){

    if(map[name]){

      sheet
        .getRange(OPS.ROWS.DATA_START, map[name], dataRowCount, 1)
        .setNumberFormat("#,##0.00");

    }

  });

  /*
  ==========================================================
  Checkbox Columns
  ==========================================================
  */

  [
    "Priority Checked",
    "FT Checked",
    "IC Requested"
  ].forEach(function(name){

    if(map[name]){

      sheet
        .getRange(OPS.ROWS.DATA_START, map[name], dataRowCount, 1)
        .insertCheckboxes();

    }

  });

  /*
  ==========================================================
  Hide Lead ID
  ==========================================================
  */

  if(map["Lead ID"]){

    sheet.hideColumns(map["Lead ID"]);

  }

}