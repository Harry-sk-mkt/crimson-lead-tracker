/**
 * ==========================================================
 * Marketing 2.0
 * Search Write
 *
 * Responsibility
 * Write merged Search_OPS data into sheet (SUBTOTAL row + header +
 * data), mirrors 64_BOFU_Write.js.
 *
 * Version
 * v1.1.0
 *
 * Change Log
 * v1.1.0 (2026-08-05)
 * - `SEARCH_SUBTOTAL_COLUMNS`의 "Results" → "Results 90D"로 갱신
 *   (70_Search_Config.js v1.7.0 헤더 개명 반영, 사용자 요청).
 * v1.0.0
 * - 최초 구현.
 * ==========================================================
 */

/**
 * SUBTOTAL(109, ...) 대상 컬럼 — 개수/금액 성격의 Group2/3/4만.
 */
const SEARCH_SUBTOTAL_COLUMNS =
  SEARCH.GROUP_2_MANUAL
    .concat(["Impressions", "Reach", "Link clicks", "Results 90D", "Spent"])
    .concat(SEARCH.GROUP_4_COMPUTED);


function writeSearchOPS_(rows) {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(SEARCH.SHEET.OPS);

  if (!sheet) {
    sheet = ss.insertSheet(SEARCH.SHEET.OPS);
  }

  sheet.clear();

  /*
  ==========================================================
  Header (row 2)
  ==========================================================
  */

  sheet
    .getRange(SEARCH.ROWS.HEADER, 1, 1, SEARCH.HEADER.length)
    .setValues([SEARCH.HEADER]);

  /*
  ==========================================================
  Data (row 3~)
  ==========================================================
  */

  if (rows && rows.length > 0) {

    sheet
      .getRange(SEARCH.ROWS.DATA_START, 1, rows.length, SEARCH.HEADER.length)
      .setValues(rows);

  }

  /*
  ==========================================================
  SUBTOTAL row (row 1)
  ==========================================================
  */

  writeSearchSubtotalRow_(sheet, rows.length);

  /*
  ==========================================================
  Freeze (SUBTOTAL + Header)
  ==========================================================
  */

  sheet.setFrozenRows(SEARCH.ROWS.HEADER);

  /*
  ==========================================================
  Filter (헤더 행부터)
  ==========================================================
  */

  if (sheet.getFilter()) {
    sheet.getFilter().remove();
  }

  if (sheet.getLastRow() > SEARCH.ROWS.HEADER) {

    sheet
      .getRange(
        SEARCH.ROWS.HEADER,
        1,
        sheet.getLastRow() - SEARCH.ROWS.HEADER + 1,
        SEARCH.HEADER.length
      )
      .createFilter();

  }

  /*
  ==========================================================
  Apply Styles
  ==========================================================
  */

  applySearchOPSStyle(sheet);

}


/**
 * ==========================================================
 * Write Search SUBTOTAL Row (row 1)
 * ==========================================================
 */
function writeSearchSubtotalRow_(sheet, dataRowCount) {

  const lastDataRow =
    dataRowCount > 0
      ? SEARCH.ROWS.DATA_START + dataRowCount - 1
      : SEARCH.ROWS.DATA_START;

  const subtotalRow = SEARCH.HEADER.map(function (colName, i) {

    if (SEARCH_SUBTOTAL_COLUMNS.indexOf(colName) === -1) return "";

    const colLetter = columnIndexToLetter_(i + 1);

    return "=SUBTOTAL(109," + colLetter + SEARCH.ROWS.DATA_START + ":" + colLetter + lastDataRow + ")";

  });

  sheet
    .getRange(SEARCH.ROWS.SUBTOTAL, 1, 1, SEARCH.HEADER.length)
    .setValues([subtotalRow]);

}
