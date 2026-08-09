/**
 * ==========================================================
 * Marketing 2.0
 * Content Styles
 *
 * Responsibility
 * Apply formatting to Content_OPS. 65_BOFU_Styles.js / 75_Search_Styles.js와
 * 동일 패턴 (SUBTOTAL 행 + 그룹별 헤더 색상 + 전체 테두리 + 숨김 컬럼).
 *
 * ⚠️ computeRowBandingColors_()(20_OPS_Styles.js)는 재정의하지 않고
 * 그대로 재사용.
 *
 * Version
 * v1.0.1
 * ==========================================================
 */

function applyContentOPSStyle(sheet) {

  const lastRow = Math.max(sheet.getLastRow(), CONTENT.ROWS.DATA_START);
  const lastCol = sheet.getLastColumn();

  const dataRowCount = lastRow - CONTENT.ROWS.DATA_START + 1;

  /*
  ==========================================================
  SUBTOTAL Row
  ==========================================================
  */

  sheet.getRange(CONTENT.ROWS.SUBTOTAL, 1, 1, lastCol)
    .setBackground("#EFEFEF")
    .setFontWeight("bold");

  /*
  ==========================================================
  Header (그룹별 색상 — applyContentHeaderColors_() 참고)
  ==========================================================
  */

  sheet.getRange(CONTENT.ROWS.HEADER, 1, 1, lastCol)
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  applyContentHeaderColors_(sheet, lastCol);

  /*
  ==========================================================
  Body
  ==========================================================
  */

  sheet.getRange(CONTENT.ROWS.DATA_START, 1, dataRowCount, lastCol)
    .setVerticalAlignment("middle")
    .setWrap(false);

  /*
  ==========================================================
  Row Banding (computeRowBandingColors_ — 20_OPS_Styles.js 재사용)
  ==========================================================
  */

  const rowBandingColors = computeRowBandingColors_(
    CONTENT.ROWS.DATA_START,
    dataRowCount,
    lastCol,
    "#F3F3F3"
  );

  sheet
    .getRange(CONTENT.ROWS.DATA_START, 1, dataRowCount, lastCol)
    .setBackgrounds(rowBandingColors);

  /*
  ==========================================================
  Header Map
  ==========================================================
  */

  const headers = sheet.getRange(CONTENT.ROWS.HEADER, 1, 1, lastCol).getValues()[0];

  const map = {};

  headers.forEach(function (header, i) {
    map[header] = i + 1;
  });

  /*
  ==========================================================
  Date Columns
  ==========================================================
  */

  ["Start Date", "End Date"].forEach(function (name) {

    if (map[name]) {

      sheet
        .getRange(CONTENT.ROWS.DATA_START, map[name], dataRowCount, 1)
        .setNumberFormat("yyyy-mm-dd");

    }

  });

  /*
  ==========================================================
  Currency Columns
  ==========================================================
  */

  ["Spent", "Revenue", "CPL", "CPNP1", "ROAS"].forEach(function (name) {

    if (map[name]) {

      sheet
        .getRange(CONTENT.ROWS.DATA_START, map[name], dataRowCount, 1)
        .setNumberFormat("#,##0.00");

    }

  });

  /*
  ==========================================================
  Percent Columns
  ==========================================================
  */

  ["Match Rate", "CTR", "CvR"].forEach(function (name) {

    if (map[name]) {

      sheet
        .getRange(CONTENT.ROWS.DATA_START, map[name], dataRowCount, 1)
        .setNumberFormat("0.0%");

    }

  });

  /*
  ==========================================================
  Hidden Columns (A~C, CONTENT.HIDE_COLUMN_COUNT)
  ==========================================================
  */

  if (CONTENT.HIDE_COLUMN_COUNT > 0) {

    sheet.showColumns(1, lastCol);
    sheet.hideColumns(1, CONTENT.HIDE_COLUMN_COUNT);

  }

  /*
  ==========================================================
  Borders (전체 테두리 — SUBTOTAL~데이터 끝까지)
  ==========================================================
  */

  const totalRows = lastRow - CONTENT.ROWS.SUBTOTAL + 1;

  sheet.getRange(CONTENT.ROWS.SUBTOTAL, 1, totalRows, lastCol)
    .setBorder(
      true, true, true, true, true, true,
      "#000000",
      SpreadsheetApp.BorderStyle.SOLID
    );

}


/**
 * ==========================================================
 * Apply Content Header Colors (그룹별 헤더 배경색)
 * ==========================================================
 */
function applyContentHeaderColors_(sheet, lastCol) {

  const headers = sheet.getRange(CONTENT.ROWS.HEADER, 1, 1, lastCol).getValues()[0];

  const colorByHeaderName = buildContentHeaderColorMap_();

  const FALLBACK_COLOR = "#202124";

  const backgrounds = [headers.map(function (name) {
    return colorByHeaderName[name] || FALLBACK_COLOR;
  })];

  sheet.getRange(CONTENT.ROWS.HEADER, 1, 1, lastCol).setBackgrounds(backgrounds);

}


/**
 * ==========================================================
 * Build Content Header Color Map (헤더명 → 색상 hex)
 *
 * TEST
 * testBuildContentHeaderColorMap_ 참고
 * ==========================================================
 */
function buildContentHeaderColorMap_() {

  const map = {};

  Object.keys(CONTENT.HEADER_COLOR_GROUPS).forEach(function (groupKey) {

    const color = CONTENT.HEADER_COLORS[groupKey];

    CONTENT.HEADER_COLOR_GROUPS[groupKey].forEach(function (headerName) {
      map[headerName] = color;
    });

  });

  return map;

}


/**
 * ==========================================================
 * TEST — buildContentHeaderColorMap_()
 * ==========================================================
 */
function testBuildContentHeaderColorMap_() {

  const map = buildContentHeaderColorMap_();

  const pass =
    map["SF Reg."] === CONTENT.HEADER_COLORS.SF &&
    map["Spent"] === CONTENT.HEADER_COLORS.META &&
    map["Match Rate"] === CONTENT.HEADER_COLORS.DERIVED &&
    map["Marketo Campaign name"] === CONTENT.HEADER_COLORS.MARKETO &&
    map["NonExistentColumn"] === undefined;

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}
