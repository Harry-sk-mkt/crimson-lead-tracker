/**
 * ==========================================================
 * Marketing 2.0
 * Search Styles
 *
 * Responsibility
 * Apply formatting to Search_OPS. 65_BOFU_Styles.js와 동일 패턴
 * (SUBTOTAL 행 + 그룹별 헤더 색상 + 전체 테두리 + 숨김 컬럼).
 *
 * ⚠️ computeRowBandingColors_()(20_OPS_Styles.js)는 재정의하지 않고
 * 그대로 재사용.
 *
 * Version
 * v1.1.0
 *
 * Change Log
 * v1.1.0 (2026-08-06)
 * - SEARCH.HIDDEN_COLUMN_NAMES(신규, 70_Search_Config.js v1.5.0) 기준으로
 *   "Campaign"(Naver 자동 매칭 캠페인명) 컬럼 숨김 처리 추가(사용자 요청) —
 *   기존 선행 N개(HIDE_COLUMN_COUNT) 숨김과 별개로 이름 기준 개별 숨김.
 * v1.0.0 (2026-07-24)
 * - 최초 구현.
 * ==========================================================
 */

function applySearchOPSStyle(sheet) {

  const lastRow = Math.max(sheet.getLastRow(), SEARCH.ROWS.DATA_START);
  const lastCol = sheet.getLastColumn();

  const dataRowCount = lastRow - SEARCH.ROWS.DATA_START + 1;

  /*
  ==========================================================
  SUBTOTAL Row
  ==========================================================
  */

  sheet.getRange(SEARCH.ROWS.SUBTOTAL, 1, 1, lastCol)
    .setBackground("#EFEFEF")
    .setFontWeight("bold");

  /*
  ==========================================================
  Header (그룹별 색상 — applySearchHeaderColors_() 참고)
  ==========================================================
  */

  sheet.getRange(SEARCH.ROWS.HEADER, 1, 1, lastCol)
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  applySearchHeaderColors_(sheet, lastCol);

  /*
  ==========================================================
  Body
  ==========================================================
  */

  sheet.getRange(SEARCH.ROWS.DATA_START, 1, dataRowCount, lastCol)
    .setVerticalAlignment("middle")
    .setWrap(false);

  /*
  ==========================================================
  Row Banding (computeRowBandingColors_ — 20_OPS_Styles.js 재사용)
  ==========================================================
  */

  const rowBandingColors = computeRowBandingColors_(
    SEARCH.ROWS.DATA_START,
    dataRowCount,
    lastCol,
    "#F3F3F3"
  );

  sheet
    .getRange(SEARCH.ROWS.DATA_START, 1, dataRowCount, lastCol)
    .setBackgrounds(rowBandingColors);

  /*
  ==========================================================
  Header Map
  ==========================================================
  */

  const headers = sheet.getRange(SEARCH.ROWS.HEADER, 1, 1, lastCol).getValues()[0];

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
        .getRange(SEARCH.ROWS.DATA_START, map[name], dataRowCount, 1)
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
        .getRange(SEARCH.ROWS.DATA_START, map[name], dataRowCount, 1)
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
        .getRange(SEARCH.ROWS.DATA_START, map[name], dataRowCount, 1)
        .setNumberFormat("0.0%");

    }

  });

  /*
  ==========================================================
  Hidden Columns (A~C, SEARCH.HIDE_COLUMN_COUNT)
  ==========================================================
  */

  if (SEARCH.HIDE_COLUMN_COUNT > 0) {

    sheet.showColumns(1, lastCol);
    sheet.hideColumns(1, SEARCH.HIDE_COLUMN_COUNT);

  }

  /*
  ==========================================================
  Hidden Columns By Name (SEARCH.HIDDEN_COLUMN_NAMES — HEADER 중간의
  특정 컬럼, 위 선행 N개 숨김과 별개)
  ==========================================================
  */

  SEARCH.HIDDEN_COLUMN_NAMES.forEach(function (name) {

    if (map[name]) {
      sheet.hideColumns(map[name]);
    }

  });

  /*
  ==========================================================
  Borders (전체 테두리 — SUBTOTAL~데이터 끝까지)
  ==========================================================
  */

  const totalRows = lastRow - SEARCH.ROWS.SUBTOTAL + 1;

  sheet.getRange(SEARCH.ROWS.SUBTOTAL, 1, totalRows, lastCol)
    .setBorder(
      true, true, true, true, true, true,
      "#000000",
      SpreadsheetApp.BorderStyle.SOLID
    );

}


/**
 * ==========================================================
 * Apply Search Header Colors (그룹별 헤더 배경색)
 * ==========================================================
 */
function applySearchHeaderColors_(sheet, lastCol) {

  const headers = sheet.getRange(SEARCH.ROWS.HEADER, 1, 1, lastCol).getValues()[0];

  const colorByHeaderName = buildSearchHeaderColorMap_();

  const FALLBACK_COLOR = "#202124";

  const backgrounds = [headers.map(function (name) {
    return colorByHeaderName[name] || FALLBACK_COLOR;
  })];

  sheet.getRange(SEARCH.ROWS.HEADER, 1, 1, lastCol).setBackgrounds(backgrounds);

}


/**
 * ==========================================================
 * Build Search Header Color Map (헤더명 → 색상 hex)
 *
 * TEST
 * testBuildSearchHeaderColorMap_ 참고
 * ==========================================================
 */
function buildSearchHeaderColorMap_() {

  const map = {};

  Object.keys(SEARCH.HEADER_COLOR_GROUPS).forEach(function (groupKey) {

    const color = SEARCH.HEADER_COLORS[groupKey];

    SEARCH.HEADER_COLOR_GROUPS[groupKey].forEach(function (headerName) {
      map[headerName] = color;
    });

  });

  return map;

}


/**
 * ==========================================================
 * TEST — buildSearchHeaderColorMap_()
 * ==========================================================
 */
function testBuildSearchHeaderColorMap_() {

  const map = buildSearchHeaderColorMap_();

  const pass =
    map["SF Reg."] === SEARCH.HEADER_COLORS.SF &&
    map["Spent"] === SEARCH.HEADER_COLORS.META &&
    map["Match Rate"] === SEARCH.HEADER_COLORS.DERIVED &&
    map["Marketo Campaign name"] === SEARCH.HEADER_COLORS.MARKETO &&
    map["NonExistentColumn"] === undefined;

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}
