/**
 * ==========================================================
 * Marketing 2.0
 * Events Write
 *
 * Responsibility
 * Write merged Events_OPS data into sheet (SUBTOTAL row + header +
 * data), mirrors 23_OPS_Write.js.
 *
 * Version
 * v1.0.0
 * ==========================================================
 */

/**
 * SUBTOTAL(109, ...) 대상 컬럼 — 개수/금액 성격의 Group2/3/4만.
 * Group1(텍스트), Group3의 %컬럼(LP CVR 등), Group5(비율), FY/Month는
 * 합계 의미가 없어 제외.
 */
const EVENTS_SUBTOTAL_COLUMNS =
  EVENTS.GROUP_2_MANUAL
    .concat(["Clicks", "Leads(Meta)", "Spent"])
    .concat(EVENTS.GROUP_4_COMPUTED);


function writeEventsOPS_(rows) {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(EVENTS.SHEET.OPS);

  if (!sheet) {
    sheet = ss.insertSheet(EVENTS.SHEET.OPS);
  }

  sheet.clear();

  /*
  ==========================================================
  Header (row 2)
  ==========================================================
  */

  sheet
    .getRange(EVENTS.ROWS.HEADER, 1, 1, EVENTS.HEADER.length)
    .setValues([EVENTS.HEADER]);

  /*
  ==========================================================
  Data (row 3~)
  ==========================================================
  */

  if (rows && rows.length > 0) {

    sheet
      .getRange(EVENTS.ROWS.DATA_START, 1, rows.length, EVENTS.HEADER.length)
      .setValues(rows);

  }

  /*
  ==========================================================
  SUBTOTAL row (row 1)
  ==========================================================
  */

  writeEventsSubtotalRow_(sheet, rows.length);

  /*
  ==========================================================
  Freeze (SUBTOTAL + Header)
  ==========================================================
  */

  sheet.setFrozenRows(EVENTS.ROWS.HEADER);

  /*
  ==========================================================
  Filter (헤더 행부터)
  ==========================================================
  */

  if (sheet.getFilter()) {
    sheet.getFilter().remove();
  }

  if (sheet.getLastRow() > EVENTS.ROWS.HEADER) {

    sheet
      .getRange(
        EVENTS.ROWS.HEADER,
        1,
        sheet.getLastRow() - EVENTS.ROWS.HEADER + 1,
        EVENTS.HEADER.length
      )
      .createFilter();

  }

  /*
  ==========================================================
  Apply Styles
  ==========================================================
  */

  applyEventsOPSStyle(sheet);

}


/**
 * ==========================================================
 * Write SUBTOTAL Row (row 1)
 *
 * WHY
 * 실무에서 필터를 걸어도(예: FY/Segment 필터) 화면에 보이는 행만의
 * 합계를 바로 볼 수 있어야 한다는 요구사항 (원본 xlsx 실무 패턴
 * 그대로 이관). SUBTOTAL(109, range)는 숨겨진(필터된) 행을 제외하고
 * 합산 — 109=SUM.
 *
 * INPUT
 * sheet : Sheet
 * dataRowCount : number
 * ==========================================================
 */
function writeEventsSubtotalRow_(sheet, dataRowCount) {

  const lastDataRow =
    dataRowCount > 0
      ? EVENTS.ROWS.DATA_START + dataRowCount - 1
      : EVENTS.ROWS.DATA_START;

  const subtotalRow = EVENTS.HEADER.map(function (colName, i) {

    if (EVENTS_SUBTOTAL_COLUMNS.indexOf(colName) === -1) return "";

    const colLetter = columnIndexToLetter_(i + 1);

    return "=SUBTOTAL(109," + colLetter + EVENTS.ROWS.DATA_START + ":" + colLetter + lastDataRow + ")";

  });

  sheet
    .getRange(EVENTS.ROWS.SUBTOTAL, 1, 1, EVENTS.HEADER.length)
    .setValues([subtotalRow]);

}


/**
 * ==========================================================
 * Column Index (1-based) → A1 Letter
 *
 * TEST
 * columnIndexToLetter_(1) === "A"
 * columnIndexToLetter_(27) === "AA"
 * ==========================================================
 */
function columnIndexToLetter_(index) {

  let letter = "";
  let n = index;

  while (n > 0) {

    const remainder = (n - 1) % 26;

    letter = String.fromCharCode(65 + remainder) + letter;

    n = Math.floor((n - 1) / 26);

  }

  return letter;

}


/**
 * ==========================================================
 * TEST — columnIndexToLetter_()
 * ==========================================================
 */
function testColumnIndexToLetter_() {

  const pass =
    columnIndexToLetter_(1) === "A" &&
    columnIndexToLetter_(26) === "Z" &&
    columnIndexToLetter_(27) === "AA" &&
    columnIndexToLetter_(52) === "AZ";

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}
