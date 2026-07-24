/**
 * ==========================================================
 * Marketing 2.0
 * Events Styles
 *
 * Responsibility
 * Apply formatting to Events_OPS. 20_OPS_Styles.js와 동일 패턴이나
 * SUBTOTAL 행(1행) 서식이 추가됨.
 *
 * Version
 * v1.2.0
 *
 * Change Log
 * v1.2.0 (2026-07-24)
 * - 전체 테두리 추가 (SUBTOTAL 행~마지막 데이터 행, 전체 컬럼) — 사용자 요청.
 * v1.1.0 (2026-07-24)
 * - applyEventsHeaderColors_()/buildEventsHeaderColorMap_() 추가 — Marketo/
 *   SF/Meta/Derived 4개 그룹별 헤더 배경색 적용 (EVENTS.HEADER_COLOR_GROUPS/
 *   HEADER_COLORS 기준, 사용자 요청).
 * - EVENTS.HIDE_COLUMN_COUNT(4)만큼 A~D열 기본 숨김 처리 추가.
 * v1.0.0 (2026-07-24)
 * - 최초 구현.
 * ==========================================================
 */

function applyEventsOPSStyle(sheet) {

  const lastRow = Math.max(sheet.getLastRow(), EVENTS.ROWS.DATA_START);
  const lastCol = sheet.getLastColumn();

  const dataRowCount = lastRow - EVENTS.ROWS.DATA_START + 1;

  /*
  ==========================================================
  SUBTOTAL Row
  ==========================================================
  */

  sheet.getRange(EVENTS.ROWS.SUBTOTAL, 1, 1, lastCol)
    .setBackground("#EFEFEF")
    .setFontWeight("bold");

  /*
  ==========================================================
  Header (그룹별 색상 — applyEventsHeaderColors_() 참고)
  ==========================================================
  */

  sheet.getRange(EVENTS.ROWS.HEADER, 1, 1, lastCol)
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  applyEventsHeaderColors_(sheet, lastCol);

  /*
  ==========================================================
  Body
  ==========================================================
  */

  sheet.getRange(EVENTS.ROWS.DATA_START, 1, dataRowCount, lastCol)
    .setVerticalAlignment("middle")
    .setWrap(false);

  /*
  ==========================================================
  Row Banding (computeRowBandingColors_ — 20_OPS_Styles.js 재사용)
  ==========================================================
  */

  const rowBandingColors = computeRowBandingColors_(
    EVENTS.ROWS.DATA_START,
    dataRowCount,
    lastCol,
    "#F3F3F3"
  );

  sheet
    .getRange(EVENTS.ROWS.DATA_START, 1, dataRowCount, lastCol)
    .setBackgrounds(rowBandingColors);

  /*
  ==========================================================
  Header Map
  ==========================================================
  */

  const headers = sheet.getRange(EVENTS.ROWS.HEADER, 1, 1, lastCol).getValues()[0];

  const map = {};

  headers.forEach(function (header, i) {
    map[header] = i + 1;
  });

  /*
  ==========================================================
  Date Columns
  ==========================================================
  */

  ["Event Date"].forEach(function (name) {

    if (map[name]) {

      sheet
        .getRange(EVENTS.ROWS.DATA_START, map[name], dataRowCount, 1)
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
        .getRange(EVENTS.ROWS.DATA_START, map[name], dataRowCount, 1)
        .setNumberFormat("#,##0.00");

    }

  });

  /*
  ==========================================================
  Percent Columns
  ==========================================================
  */

  ["Match Rate", "LP CVR", "LG CVR", "All CVR"].forEach(function (name) {

    if (map[name]) {

      sheet
        .getRange(EVENTS.ROWS.DATA_START, map[name], dataRowCount, 1)
        .setNumberFormat("0.0%");

    }

  });

  /*
  ==========================================================
  Hidden Columns (A~D, EVENTS.HIDE_COLUMN_COUNT)
  ==========================================================
  */

  if (EVENTS.HIDE_COLUMN_COUNT > 0) {

    sheet.showColumns(1, lastCol);
    sheet.hideColumns(1, EVENTS.HIDE_COLUMN_COUNT);

  }

  /*
  ==========================================================
  Borders (전체 테두리 — SUBTOTAL~데이터 끝까지, 사용자 요청)
  ==========================================================
  */

  const totalRows = lastRow - EVENTS.ROWS.SUBTOTAL + 1;

  sheet.getRange(EVENTS.ROWS.SUBTOTAL, 1, totalRows, lastCol)
    .setBorder(
      true, true, true, true, true, true,
      "#000000",
      SpreadsheetApp.BorderStyle.SOLID
    );

}


/**
 * ==========================================================
 * Apply Events Header Colors (그룹별 헤더 배경색)
 *
 * WHY
 * Marketo(파랑)/SF(주황)/Meta(초록)/Derived(회색) 4개 소스 그룹을 헤더
 * 배경색으로 구분해서, 컬럼이 많아도(37개) 어느 소스에서 온 값인지
 * 한눈에 알 수 있게 한다 (2026-07-24 사용자 요청). 그룹 소속은
 * EVENTS.HEADER_COLOR_GROUPS(50_Events_Config.js)에 정의, 어느 그룹에도
 * 없는 헤더는 fallback 색(#202124, 기존 Leads_OPS 스타일)을 그대로 씀.
 *
 * INPUT
 * sheet : Sheet
 * lastCol : number
 * ==========================================================
 */
function applyEventsHeaderColors_(sheet, lastCol) {

  const headers = sheet.getRange(EVENTS.ROWS.HEADER, 1, 1, lastCol).getValues()[0];

  const colorByHeaderName = buildEventsHeaderColorMap_();

  const FALLBACK_COLOR = "#202124";

  const backgrounds = [headers.map(function (name) {
    return colorByHeaderName[name] || FALLBACK_COLOR;
  })];

  sheet.getRange(EVENTS.ROWS.HEADER, 1, 1, lastCol).setBackgrounds(backgrounds);

}


/**
 * ==========================================================
 * Build Events Header Color Map (헤더명 → 색상 hex)
 *
 * WHY
 * EVENTS.HEADER_COLOR_GROUPS(그룹→헤더명 배열)를 EVENTS.HEADER_COLORS
 * (그룹→색상)와 조합해 "헤더명→색상" 조회용 flat map으로 뒤집는다.
 *
 * OUTPUT
 * { headerName: colorHex }
 *
 * TEST
 * testBuildEventsHeaderColorMap_ 참고
 * ==========================================================
 */
function buildEventsHeaderColorMap_() {

  const map = {};

  Object.keys(EVENTS.HEADER_COLOR_GROUPS).forEach(function (groupKey) {

    const color = EVENTS.HEADER_COLORS[groupKey];

    EVENTS.HEADER_COLOR_GROUPS[groupKey].forEach(function (headerName) {
      map[headerName] = color;
    });

  });

  return map;

}


/**
 * ==========================================================
 * TEST — buildEventsHeaderColorMap_()
 * ==========================================================
 */
function testBuildEventsHeaderColorMap_() {

  const map = buildEventsHeaderColorMap_();

  const pass =
    map["SF Reg."] === EVENTS.HEADER_COLORS.SF &&
    map["LP CVR"] === EVENTS.HEADER_COLORS.META &&
    map["Match Rate"] === EVENTS.HEADER_COLORS.DERIVED &&
    map["Marketo Campaign name"] === EVENTS.HEADER_COLORS.MARKETO &&
    map["NonExistentColumn"] === undefined;

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}
