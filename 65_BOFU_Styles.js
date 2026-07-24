/**
 * ==========================================================
 * Marketing 2.0
 * BOFU Styles
 *
 * Responsibility
 * Apply formatting to BOFU_OPS. 55_Events_Styles.js와 동일 패턴
 * (SUBTOTAL 행 + 그룹별 헤더 색상 + 전체 테두리 + 숨김 컬럼).
 *
 * ⚠️ computeRowBandingColors_()(20_OPS_Styles.js)는 재정의하지 않고
 * 그대로 재사용.
 *
 * Version
 * v1.1.0
 *
 * Change Log
 * v1.1.0 (2026-07-24)
 * - "Amount spent"→"Spent", "Click to Lead CvR"→"CvR" 리네임 반영,
 *   "Cost per result" 서식 대상에서 제거 (컬럼 자체가 삭제됨).
 * v1.0.0 (2026-07-24)
 * - 최초 구현.
 * ==========================================================
 */

function applyBOFUOPSStyle(sheet) {

  const lastRow = Math.max(sheet.getLastRow(), BOFU.ROWS.DATA_START);
  const lastCol = sheet.getLastColumn();

  const dataRowCount = lastRow - BOFU.ROWS.DATA_START + 1;

  /*
  ==========================================================
  SUBTOTAL Row
  ==========================================================
  */

  sheet.getRange(BOFU.ROWS.SUBTOTAL, 1, 1, lastCol)
    .setBackground("#EFEFEF")
    .setFontWeight("bold");

  /*
  ==========================================================
  Header (그룹별 색상 — applyBOFUHeaderColors_() 참고)
  ==========================================================
  */

  sheet.getRange(BOFU.ROWS.HEADER, 1, 1, lastCol)
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  applyBOFUHeaderColors_(sheet, lastCol);

  /*
  ==========================================================
  Body
  ==========================================================
  */

  sheet.getRange(BOFU.ROWS.DATA_START, 1, dataRowCount, lastCol)
    .setVerticalAlignment("middle")
    .setWrap(false);

  /*
  ==========================================================
  Row Banding (computeRowBandingColors_ — 20_OPS_Styles.js 재사용)
  ==========================================================
  */

  const rowBandingColors = computeRowBandingColors_(
    BOFU.ROWS.DATA_START,
    dataRowCount,
    lastCol,
    "#F3F3F3"
  );

  sheet
    .getRange(BOFU.ROWS.DATA_START, 1, dataRowCount, lastCol)
    .setBackgrounds(rowBandingColors);

  /*
  ==========================================================
  Header Map
  ==========================================================
  */

  const headers = sheet.getRange(BOFU.ROWS.HEADER, 1, 1, lastCol).getValues()[0];

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
        .getRange(BOFU.ROWS.DATA_START, map[name], dataRowCount, 1)
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
        .getRange(BOFU.ROWS.DATA_START, map[name], dataRowCount, 1)
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
        .getRange(BOFU.ROWS.DATA_START, map[name], dataRowCount, 1)
        .setNumberFormat("0.0%");

    }

  });

  /*
  ==========================================================
  Hidden Columns (A~B, BOFU.HIDE_COLUMN_COUNT)
  ==========================================================
  */

  if (BOFU.HIDE_COLUMN_COUNT > 0) {

    sheet.showColumns(1, lastCol);
    sheet.hideColumns(1, BOFU.HIDE_COLUMN_COUNT);

  }

  /*
  ==========================================================
  Borders (전체 테두리 — SUBTOTAL~데이터 끝까지)
  ==========================================================
  */

  const totalRows = lastRow - BOFU.ROWS.SUBTOTAL + 1;

  sheet.getRange(BOFU.ROWS.SUBTOTAL, 1, totalRows, lastCol)
    .setBorder(
      true, true, true, true, true, true,
      "#000000",
      SpreadsheetApp.BorderStyle.SOLID
    );

}


/**
 * ==========================================================
 * Apply BOFU Header Colors (그룹별 헤더 배경색)
 *
 * WHY
 * 55_Events_Styles.js의 applyEventsHeaderColors_()와 동일 로직,
 * BOFU.HEADER_COLOR_GROUPS/HEADER_COLORS 참조만 다름.
 *
 * INPUT
 * sheet : Sheet
 * lastCol : number
 * ==========================================================
 */
function applyBOFUHeaderColors_(sheet, lastCol) {

  const headers = sheet.getRange(BOFU.ROWS.HEADER, 1, 1, lastCol).getValues()[0];

  const colorByHeaderName = buildBOFUHeaderColorMap_();

  const FALLBACK_COLOR = "#202124";

  const backgrounds = [headers.map(function (name) {
    return colorByHeaderName[name] || FALLBACK_COLOR;
  })];

  sheet.getRange(BOFU.ROWS.HEADER, 1, 1, lastCol).setBackgrounds(backgrounds);

}


/**
 * ==========================================================
 * Build BOFU Header Color Map (헤더명 → 색상 hex)
 *
 * TEST
 * testBuildBOFUHeaderColorMap_ 참고
 * ==========================================================
 */
function buildBOFUHeaderColorMap_() {

  const map = {};

  Object.keys(BOFU.HEADER_COLOR_GROUPS).forEach(function (groupKey) {

    const color = BOFU.HEADER_COLORS[groupKey];

    BOFU.HEADER_COLOR_GROUPS[groupKey].forEach(function (headerName) {
      map[headerName] = color;
    });

  });

  return map;

}


/**
 * ==========================================================
 * TEST — buildBOFUHeaderColorMap_()
 * ==========================================================
 */
function testBuildBOFUHeaderColorMap_() {

  const map = buildBOFUHeaderColorMap_();

  const pass =
    map["SF Reg."] === BOFU.HEADER_COLORS.SF &&
    map["Spent"] === BOFU.HEADER_COLORS.META &&
    map["Match Rate"] === BOFU.HEADER_COLORS.DERIVED &&
    map["Marketo Campaign name"] === BOFU.HEADER_COLORS.MARKETO &&
    map["NonExistentColumn"] === undefined;

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}
