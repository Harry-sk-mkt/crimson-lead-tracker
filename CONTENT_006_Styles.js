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
 * v1.2.0
 *
 * Change Log
 * v1.2.0 (2026-08-25)
 * - 사용자 요청 서식 변경 — `Spent`만 `Revenue`/`CPL`/`CPNP1`/`ROAS`에서
 *   분리해 "$#,##0.00"(달러 표시)로 변경. `Impressions`/`Reach`/`Link
 *   clicks`/`Results`(이번 세션에 Meta 자동 집계 대상이 됨) 신규 "Count
 *   Columns" 서식 블록 추가 — "#,##0"(천 단위 콤마, 소수점 없음).
 * v1.1.0 (2026-08-25)
 * - applyPercentileHighlightRules_() 호출 추가(사용자 요청) — SF NLP1s
 *   (상위 25%)/CPNP1(하위 25%) 컬럼에 배경색 #01ef18 강조.
 *   CONTENT.TOP25_HIGHLIGHT(CONTENT_001_Config.js v1.2.0) 참고, 실제
 *   규칙 생성 로직은 OPS_002_Styles.js applyPercentileHighlightRules_().
 * v1.0.1 이전
 * - Change Log 도입 전 — 상세 이력 없음.
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
  Currency Columns (Spent만 $ 표시 — 사용자 요청, 2026-08-25)
  ==========================================================
  */

  if (map["Spent"]) {

    sheet
      .getRange(CONTENT.ROWS.DATA_START, map["Spent"], dataRowCount, 1)
      .setNumberFormat("$#,##0.00");

  }

  ["Revenue", "CPL", "CPNP1", "ROAS"].forEach(function (name) {

    if (map[name]) {

      sheet
        .getRange(CONTENT.ROWS.DATA_START, map[name], dataRowCount, 1)
        .setNumberFormat("#,##0.00");

    }

  });

  /*
  ==========================================================
  Count Columns (천 단위 콤마, 소수점 없음 — 사용자 요청, 2026-08-25)
  ==========================================================
  */

  ["Impressions", "Reach", "Link clicks", "Results"].forEach(function (name) {

    if (map[name]) {

      sheet
        .getRange(CONTENT.ROWS.DATA_START, map[name], dataRowCount, 1)
        .setNumberFormat("#,##0");

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
  Top/Bottom 25% Highlight (CONTENT.TOP25_HIGHLIGHT)
  ==========================================================
  */

  applyPercentileHighlightRules_(
    sheet,
    map,
    CONTENT.ROWS.DATA_START,
    lastRow,
    CONTENT.TOP25_HIGHLIGHT.COLUMNS,
    CONTENT.TOP25_HIGHLIGHT.COLOR
  );

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
