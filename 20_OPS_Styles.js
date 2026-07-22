/**
 * ==========================================================
 * Marketing 2.0
 * Leads OPS Styles
 *
 * Responsibility
 * Apply formatting to Leads_OPS
 *
 * Version
 * v3.2.0
 *
 * Change Log
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