/**
 * ==========================================================
 * Marketing 2.0
 * Leads OPS Styles
 *
 * Responsibility
 * Apply formatting to Leads_OPS
 *
 * Version
 * v3.4.0
 *
 * Change Log
 * v3.4.0 (2026-08-25)
 * - `applyPercentileHighlightRules_()`가 배경색과 함께 `.setBold(true)`도
 *   적용하도록 변경(사용자 요청) — SF NLP1s/CPNP1 상위·하위 25% 강조 셀이
 *   볼드체로도 표시됨.
 * v3.3.0 (2026-08-25)
 * - applyPercentileHighlightRules_()/buildBottomPercentileHighlightFormula_()
 *   추가(사용자 요청) — BOFU_OPS/Content_OPS의 SF NLP1s(상위 25%,
 *   PERCENTILE 0.75 이상)/CPNP1(비용 지표라 하위 25%, PERCENTILE 0.25
 *   이하) 컬럼 배경색(#01ef18) 강조. Events_OPS의 상위-25%-전용
 *   applyTop25HighlightRules_()/buildPercentileHighlightFormula_()
 *   (EVENTS_006_Styles.js)를 컬럼별 방향(top/bottom) 지정이 가능하도록
 *   제네릭화한 버전 — top 방향은 buildPercentileHighlightFormula_()를
 *   그대로 재사용(전역 함수, 중복 선언 방지). BOFU_006_Styles.js/
 *   CONTENT_006_Styles.js에서 호출.
 * v3.2.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `20_OPS_Styles.js` → 신규 `OPS_002_Styles.js`, 코드 내용 변경 없음.
 * v3.0.0 (2026-07-21)
 * - 하드코딩된 헤더/데이터 행 번호(1, 2)를 OPS.ROWS.HEADER / OPS.ROWS.DATA_START로 교체.
 * v3.1.0 (2026-07-22)
 * - 짝수 행 배경색 밴딩(row banding) 추가 — 같은 Lead의 row 경계를
 *   실무에서 한눈에 구분하기 위함 (MVP 테스트 단계 요청).
 * v3.2.0 (2026-07-22)
 * - "Last IC Requested Date"를 Date Columns 서식(yyyy-mm-dd) 대상에 추가.
 * ==========================================================
 */

/**
 * ==========================================================
 * Compute Row Banding Colors
 *
 * WHY
 * Leads_OPS는 row 수가 많아(35,000+) 어디까지가 한 Lead의 row인지
 * 구분이 어렵다. 짝수 번째 행(시트 실제 행 번호 기준)에만 옅은
 * 배경색을 넣어 가로 줄무늬로 row 경계를 시각적으로 구분한다.
 * 대량 행(35,000+)에 1행씩 setBackground()를 호출하면 너무 느려서,
 * 2D 배열을 만들어 setBackgrounds() 한 번으로 적용한다.
 *
 * INPUT
 * startRow : number  (데이터 시작 행, 시트 기준 절대 행 번호)
 * rowCount : number  (데이터 행 개수)
 * colCount : number  (컬럼 개수)
 * evenColor : string  (짝수 행에 적용할 배경색, hex)
 *
 * OUTPUT
 * (string|null)[][]  (rowCount x colCount, 짝수 행은 evenColor로 채워진 행, 홀수 행은 null로 채워진 행)
 *
 * TEST
 * startRow=2, rowCount=4, colCount=2 → [[c,c],[null,null],[c,c],[null,null]]
 * (행 2,4가 짝수라 색이 채워지고 3,5는 null)
 * ==========================================================
 */
function computeRowBandingColors_(startRow, rowCount, colCount, evenColor) {

  const colors = [];

  for (let i = 0; i < rowCount; i++) {

    const rowNumber = startRow + i;
    const color = rowNumber % 2 === 0 ? evenColor : null;

    colors.push(new Array(colCount).fill(color));

  }

  return colors;

}


/**
 * ==========================================================
 * TEST — computeRowBandingColors_()
 * ==========================================================
 */
function testComputeRowBandingColors() {

  const result = computeRowBandingColors_(2, 4, 2, "#F3F3F3");

  const pass =
    result.length === 4 &&
    result[0][0] === "#F3F3F3" && result[0][1] === "#F3F3F3" &&
    result[1][0] === null && result[1][1] === null &&
    result[2][0] === "#F3F3F3" && result[2][1] === "#F3F3F3" &&
    result[3][0] === null && result[3][1] === null;

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


function applyOPSStyle(sheet) {

  const lastRow = Math.max(
    sheet.getLastRow(),
    OPS.ROWS.DATA_START
  );

  const lastCol = sheet.getLastColumn();

  const dataRowCount =
    lastRow - OPS.ROWS.DATA_START + 1;

  /*
  ==========================================================
  Header
  ==========================================================
  */

  sheet.getRange(OPS.ROWS.HEADER, 1, 1, lastCol)
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

  sheet.getRange(OPS.ROWS.DATA_START, 1, dataRowCount, lastCol)
    .setVerticalAlignment("middle")
    .setWrap(false);

  /*
  ==========================================================
  Row Banding (짝수 행 배경색)
  ==========================================================
  */

  const rowBandingColors = computeRowBandingColors_(
    OPS.ROWS.DATA_START,
    dataRowCount,
    lastCol,
    "#F3F3F3"
  );

  sheet
    .getRange(OPS.ROWS.DATA_START, 1, dataRowCount, lastCol)
    .setBackgrounds(rowBandingColors);

  /*
  ==========================================================
  Build Header Map
  ==========================================================
  */

  const headers = sheet.getRange(OPS.ROWS.HEADER, 1, 1, lastCol).getValues()[0];

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
    "Last IC Requested Date",
    "IC Booked Date",
    "IC Completed Date",
    "Opportunity Won Date"
  ].forEach(function(name){

    if(map[name]){

      sheet
        .getRange(OPS.ROWS.DATA_START, map[name], dataRowCount, 1)
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
        .getRange(OPS.ROWS.DATA_START, map[name], dataRowCount, 1)
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
        .getRange(OPS.ROWS.DATA_START, map[name], dataRowCount, 1)
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


/**
 * ==========================================================
 * Build Bottom Percentile Highlight Formula (CUSTOM formula)
 *
 * WHY
 * CPNP1처럼 값이 낮을수록 좋은(저비용) 지표는 "N% 강조"가 literal
 * top 값이 아니라 하위 N%(가장 저렴한 값)를 의미해야 한다(2026-08-25
 * 사용자 확정 — BOFU_OPS/Content_OPS CPNP1). Events_006_Styles.js의
 * buildPercentileHighlightFormula_()(상위 N%, >=)와 정반대 방향(<=) 버전.
 * 0/빈 셀은 강조 대상 및 PERCENTILE 계산 둘 다에서 제외(동일 이유 —
 * SF NLP1s가 0이라 CPNP1이 비어있는 행이 threshold를 왜곡하지 않도록).
 *
 * INPUT
 * colLetter : string ("A", "B", ...)
 * dataStartRow : number
 * lastRow : number
 * percentile : number (0~1, 예: 0.25 = 하위 25%)
 *
 * OUTPUT
 * string (Google Sheets CUSTOM_FORMULA 조건부 서식 수식)
 *
 * TEST
 * testBuildBottomPercentileHighlightFormula 참고
 * ==========================================================
 */
function buildBottomPercentileHighlightFormula_(colLetter, dataStartRow, lastRow, percentile) {

  const anchor = colLetter + dataStartRow;
  const range = "$" + colLetter + "$" + dataStartRow + ":$" + colLetter + "$" + lastRow;

  return "=AND(" + anchor + ">0," + anchor + "<=PERCENTILE(FILTER(" +
    range + "," + range + ">0)," + percentile + "))";

}


/**
 * ==========================================================
 * TEST — buildBottomPercentileHighlightFormula_()
 * ==========================================================
 */
function testBuildBottomPercentileHighlightFormula() {

  const pass =
    buildBottomPercentileHighlightFormula_("Q", 3, 200, 0.25) ===
      "=AND(Q3>0,Q3<=PERCENTILE(FILTER($Q$3:$Q$200,$Q$3:$Q$200>0),0.25))";

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Apply Percentile Highlight Rules (BOFU_OPS/Content_OPS 공용)
 *
 * WHY
 * BOFU_OPS/Content_OPS의 SF NLP1s(높을수록 좋음)/CPNP1(비용 지표라
 * 낮을수록 좋음) 컬럼에 상위/하위 25% 배경색 강조를 적용하되, 컬럼마다
 * 방향(direction)이 다를 수 있어 Events_OPS의 상위-25%-전용
 * applyTop25HighlightRules_()(EVENTS_006_Styles.js)를 제네릭화(2026-08-25
 * 사용자 요청). 매 빌드마다 sheet.setConditionalFormatRules()로 시트의
 * 조건부 서식 규칙을 전부 새로 교체 — BOFU_OPS/Content_OPS는 이 규칙
 * 외에 다른 조건부 서식을 쓰지 않으므로 안전.
 *
 * INPUT
 * sheet : Sheet
 * map : {headerName: colIndex}  (1-based)
 * dataStartRow : number
 * lastRow : number
 * columns : {name: string, direction: "top"|"bottom", percentile: number}[]
 * color : string (hex)
 * ==========================================================
 */
function applyPercentileHighlightRules_(sheet, map, dataStartRow, lastRow, columns, color) {

  const rules = columns.reduce(function (acc, col) {

    const colIndex = map[col.name];

    if (!colIndex) return acc;

    const colLetter = columnIndexToLetter_(colIndex);

    const formula = col.direction === "bottom"
      ? buildBottomPercentileHighlightFormula_(colLetter, dataStartRow, lastRow, col.percentile)
      : buildPercentileHighlightFormula_(colLetter, dataStartRow, lastRow, col.percentile);

    const rule = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(formula)
      .setBackground(color)
      .setBold(true)
      .setRanges([sheet.getRange(
        dataStartRow, colIndex,
        lastRow - dataStartRow + 1, 1
      )])
      .build();

    acc.push(rule);

    return acc;

  }, []);

  sheet.setConditionalFormatRules(rules);

}