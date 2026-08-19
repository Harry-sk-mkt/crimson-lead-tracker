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
 * v1.7.0
 *
 * Change Log
 * v1.7.0 (2026-08-19)
 * - Spent(AE)/CPNP1(AH) 통화 서식을 "#,##0.00" → "$#,##0.00"로 변경(사용자
 *   요청, $ 기호 표시) — Revenue와 동일 그룹으로 이동. ROAS는 비율성 지표라
 *   기존 "#,##0.00" 그대로 유지(별도 그룹으로 분리).
 * v1.6.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `55_Events_Styles.js` → 신규 `EVENTS_006_Styles.js`, 코드 내용 변경 없음.
 * v1.6.0 (2026-08-06)
 * - buildPercentileHighlightFormula_(): 0(빈 셀 포함)을 강조 대상 및
 *   PERCENTILE 계산 둘 다에서 제외하도록 변경(사용자 요청) — SP1%/SNP1%처럼
 *   0이 대다수인 컬럼에서 0 때문에 문턱값이 낮아져 의미 없는 셀까지
 *   강조되던 문제 수정. FILTER(range,range>0)로 0 제외 후 PERCENTILE
 *   계산, AND(anchor>0,...)로 셀 자체 0도 제외.
 * v1.5.0 (2026-08-06)
 * - applyTop25HighlightRules_()/buildPercentileHighlightFormula_() 추가
 *   (사용자 요청) — SF P1s/SF NLP1s/SP1%/SNP1% 4개 컬럼에서 값이 상위
 *   25%(EVENTS.TOP25_HIGHLIGHT.PERCENTILE, 컬럼별 독립 계산)인 셀에
 *   배경색(#01ef18) 강조. PERCENTILE 커스텀 수식 기반 조건부 서식 규칙을
 *   매 빌드마다 sheet.setConditionalFormatRules()로 완전히 새로 교체 —
 *   columnIndexToLetter_()(54_Events_Write.js, 전역 함수) 재사용.
 * v1.4.0 (2026-08-06)
 * - Revenue 통화 서식을 "#,##0.00" → "$#,##0.00"로 변경(사용자 요청, $ 기호
 *   표시) — Spent/CPNP1/ROAS는 기존 서식 그대로 유지, Revenue만 별도 분리.
 * - "NP1%" → "SNP1%"로 컬럼명 정정(사용자 요청, v1.3.0에서 만든 지 얼마 안
 *   된 컬럼이라 아래 v1.3.0 로그 텍스트에도 이미 새 이름으로 소급 반영).
 * v1.3.0 (2026-08-06)
 * - 헤더 재구성 반영(50_Events_Config.js v1.7.0): Currency Columns에서
 *   "CPL"(삭제됨) 제거. Percent Columns를 "LP CVR"/"LG CVR"/"All CVR"
 *   (전부 삭제/리네임됨) → "CVR"/"Success %"/"SP1%"/"SNP1%"(신규)로 갱신.
 *   testBuildEventsHeaderColorMap_()의 "LP CVR" 참조도 "CVR"로 갱신.
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

  ["ROAS"].forEach(function (name) {

    if (map[name]) {

      sheet
        .getRange(EVENTS.ROWS.DATA_START, map[name], dataRowCount, 1)
        .setNumberFormat("#,##0.00");

    }

  });

  ["Spent", "CPNP1", "Revenue"].forEach(function (name) {

    if (map[name]) {

      sheet
        .getRange(EVENTS.ROWS.DATA_START, map[name], dataRowCount, 1)
        .setNumberFormat("$#,##0.00");

    }

  });

  /*
  ==========================================================
  Percent Columns
  ==========================================================
  */

  ["Match Rate", "CVR", "Success %", "SP1%", "SNP1%"].forEach(function (name) {

    if (map[name]) {

      sheet
        .getRange(EVENTS.ROWS.DATA_START, map[name], dataRowCount, 1)
        .setNumberFormat("0.0%");

    }

  });

  /*
  ==========================================================
  Top 25% Highlight (EVENTS.TOP25_HIGHLIGHT)
  ==========================================================
  */

  applyTop25HighlightRules_(sheet, map, lastRow);

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
    map["CVR"] === EVENTS.HEADER_COLORS.META &&
    map["Match Rate"] === EVENTS.HEADER_COLORS.DERIVED &&
    map["Marketo Campaign name"] === EVENTS.HEADER_COLORS.MARKETO &&
    map["NonExistentColumn"] === undefined;

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Apply Top 25% Highlight Rules (EVENTS.TOP25_HIGHLIGHT)
 *
 * WHY
 * SF P1s/SF NLP1s/SP1%/SNP1% 4개 컬럼에서 값이 상위 25%(컬럼별 독립
 * PERCENTILE 기준)인 이벤트를 한눈에 찾을 수 있도록 배경색 강조
 * (2026-08-06 사용자 요청). 매 빌드마다 시트 전체를 다시 쓰므로
 * (writeEventsOPS_()) 조건부 서식 규칙도 매번 새로 계산된 데이터 범위
 * 기준으로 완전히 새로 만들어 sheet.setConditionalFormatRules()로
 * 교체한다 — 이전 빌드의 규칙이 누적되지 않도록 항상 덮어씀.
 *
 * INPUT
 * sheet   : Sheet
 * map     : Object  (헤더명 → 1-based 컬럼 인덱스, applyEventsOPSStyle()의 헤더 맵)
 * lastRow : number  (데이터 마지막 행)
 * ==========================================================
 */
function applyTop25HighlightRules_(sheet, map, lastRow) {

  const rules = EVENTS.TOP25_HIGHLIGHT.COLUMNS.reduce(function (acc, name) {

    const colIndex = map[name];

    if (!colIndex) return acc;

    const colLetter = columnIndexToLetter_(colIndex);

    const formula = buildPercentileHighlightFormula_(
      colLetter,
      EVENTS.ROWS.DATA_START,
      lastRow,
      EVENTS.TOP25_HIGHLIGHT.PERCENTILE
    );

    const rule = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(formula)
      .setBackground(EVENTS.TOP25_HIGHLIGHT.COLOR)
      .setRanges([sheet.getRange(
        EVENTS.ROWS.DATA_START, colIndex,
        lastRow - EVENTS.ROWS.DATA_START + 1, 1
      )])
      .build();

    acc.push(rule);

    return acc;

  }, []);

  sheet.setConditionalFormatRules(rules);

}


/**
 * ==========================================================
 * Build Percentile Highlight Formula (순수 함수, 테스트용으로 분리)
 *
 * WHY
 * 조건부 서식 커스텀 수식은 "적용 범위의 맨 위 셀 기준 상대참조"라, 앵커
 * 셀(예: I3)과 절대참조 데이터 범위($I$3:$I$200)를 조합해 문자열로
 * 만든다 — Sheets가 나머지 행(I4, I5, ...)엔 앵커 부분만 자동으로
 * 상대이동시켜 적용.
 *
 * 0 제외(2026-08-06 사용자 요청): SP1%/SNP1%는 SP1/SNPL1(수동입력, Ops가
 * 아직 안 채운 이벤트가 많음)을 분자로 쓰는 비율이라 0이 대다수인 경우가
 * 많다 — 0이 섞인 채로 PERCENTILE을 계산하면 문턱값 자체가 낮아져 사실상
 * 의미 없는 셀까지 "상위 25%"로 강조되는 문제가 있었음(사용자 확인).
 * FILTER(range,range>0)로 0(빈 셀 포함 — Sheets는 빈 셀을 숫자 비교 시
 * 0으로 취급)을 미리 걷어낸 값들만으로 PERCENTILE을 계산하고,
 * AND(anchor>0, ...)로 셀 자체도 0이면 강조 대상에서 제외.
 *
 * INPUT
 * colLetter    : string  (예: "I")
 * dataStartRow : number
 * lastRow      : number
 * percentile   : number  (0~1)
 *
 * OUTPUT
 * string  (예: "=AND(I3>0,I3>=PERCENTILE(FILTER($I$3:$I$200,$I$3:$I$200>0),0.75))")
 *
 * TEST
 * testBuildPercentileHighlightFormula 참고
 * ==========================================================
 */
function buildPercentileHighlightFormula_(colLetter, dataStartRow, lastRow, percentile) {

  const anchor = colLetter + dataStartRow;
  const range = "$" + colLetter + "$" + dataStartRow + ":$" + colLetter + "$" + lastRow;

  return "=AND(" + anchor + ">0," + anchor + ">=PERCENTILE(FILTER(" +
    range + "," + range + ">0)," + percentile + "))";

}


/**
 * ==========================================================
 * TEST — buildPercentileHighlightFormula_()
 * ==========================================================
 */
function testBuildPercentileHighlightFormula() {

  const pass =
    buildPercentileHighlightFormula_("I", 3, 200, 0.75) ===
      "=AND(I3>0,I3>=PERCENTILE(FILTER($I$3:$I$200,$I$3:$I$200>0),0.75))";

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}
