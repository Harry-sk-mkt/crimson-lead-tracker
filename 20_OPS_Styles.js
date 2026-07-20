/**
 * ==========================================================
 * Marketing 2.0
 * Leads OPS Styles
 *
 * Responsibility
 * Apply formatting to Leads_OPS
 *
 * Version
 * v2.0
 * ==========================================================
 */

function applyOPSStyle(sheet) {

  const lastRow = Math.max(sheet.getLastRow(), 2);
  const lastCol = sheet.getLastColumn();

  /*
  ==========================================================
  Header
  ==========================================================
  */

  sheet.getRange(1, 1, 1, lastCol)
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

  sheet.getRange(2, 1, lastRow - 1, lastCol)
    .setVerticalAlignment("middle")
    .setWrap(false);

  /*
  ==========================================================
  Build Header Map
  ==========================================================
  */

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

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
        .getRange(2,map[name],lastRow-1,1)
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
        .getRange(2,map[name],lastRow-1,1)
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
        .getRange(2,map[name],lastRow-1,1)
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