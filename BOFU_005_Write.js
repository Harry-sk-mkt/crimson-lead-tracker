/**
 * ==========================================================
 * Marketing 2.0
 * BOFU Write
 *
 * Responsibility
 * Write merged BOFU_OPS data into sheet (SUBTOTAL row + header +
 * data), mirrors 54_Events_Write.js.
 *
 * Version
 * v1.1.1
 *
 * Change Log
 * v1.1.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `64_BOFU_Write.js` → 신규 `BOFU_005_Write.js`, 코드 내용 변경 없음.
 * v1.1.0 (2026-07-24)
 * - BOFU_SUBTOTAL_COLUMNS: "Amount spent" → "Spent" (컬럼 리네임 반영).
 * v1.0.0 (2026-07-24)
 * - 최초 구현.
 * ==========================================================
 */

/**
 * SUBTOTAL(109, ...) 대상 컬럼 — 개수/금액 성격의 Group2/3/4만.
 * Group1(텍스트), Group3의 날짜(Start/End Date), Group5(비율), FY/Month는
 * 합계 의미가 없어 제외.
 */
const BOFU_SUBTOTAL_COLUMNS =
  BOFU.GROUP_2_MANUAL
    .concat(["Impressions", "Reach", "Link clicks", "Results", "Spent"])
    .concat(BOFU.GROUP_4_COMPUTED);


function writeBOFUOPS_(rows) {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(BOFU.SHEET.OPS);

  if (!sheet) {
    sheet = ss.insertSheet(BOFU.SHEET.OPS);
  }

  sheet.clear();

  /*
  ==========================================================
  Header (row 2)
  ==========================================================
  */

  sheet
    .getRange(BOFU.ROWS.HEADER, 1, 1, BOFU.HEADER.length)
    .setValues([BOFU.HEADER]);

  /*
  ==========================================================
  Data (row 3~)
  ==========================================================
  */

  if (rows && rows.length > 0) {

    sheet
      .getRange(BOFU.ROWS.DATA_START, 1, rows.length, BOFU.HEADER.length)
      .setValues(rows);

  }

  /*
  ==========================================================
  SUBTOTAL row (row 1)
  ==========================================================
  */

  writeBOFUSubtotalRow_(sheet, rows.length);

  /*
  ==========================================================
  Freeze (SUBTOTAL + Header)
  ==========================================================
  */

  sheet.setFrozenRows(BOFU.ROWS.HEADER);

  /*
  ==========================================================
  Filter (헤더 행부터)
  ==========================================================
  */

  if (sheet.getFilter()) {
    sheet.getFilter().remove();
  }

  if (sheet.getLastRow() > BOFU.ROWS.HEADER) {

    sheet
      .getRange(
        BOFU.ROWS.HEADER,
        1,
        sheet.getLastRow() - BOFU.ROWS.HEADER + 1,
        BOFU.HEADER.length
      )
      .createFilter();

  }

  /*
  ==========================================================
  Apply Styles
  ==========================================================
  */

  applyBOFUOPSStyle(sheet);

}


/**
 * ==========================================================
 * Write BOFU SUBTOTAL Row (row 1)
 *
 * WHY
 * 54_Events_Write.js의 writeEventsSubtotalRow_()와 동일 로직.
 * columnIndexToLetter_()는 그 파일의 정의를 재사용.
 * ==========================================================
 */
function writeBOFUSubtotalRow_(sheet, dataRowCount) {

  const lastDataRow =
    dataRowCount > 0
      ? BOFU.ROWS.DATA_START + dataRowCount - 1
      : BOFU.ROWS.DATA_START;

  const subtotalRow = BOFU.HEADER.map(function (colName, i) {

    if (BOFU_SUBTOTAL_COLUMNS.indexOf(colName) === -1) return "";

    const colLetter = columnIndexToLetter_(i + 1);

    return "=SUBTOTAL(109," + colLetter + BOFU.ROWS.DATA_START + ":" + colLetter + lastDataRow + ")";

  });

  sheet
    .getRange(BOFU.ROWS.SUBTOTAL, 1, 1, BOFU.HEADER.length)
    .setValues([subtotalRow]);

}
