/**
 * ==========================================================
 * Marketing 2.0
 * ACQ Report Styles
 *
 * Responsibility
 * ACQ_REP Report Area의 셀 서식(% 표기, 천단위 콤마, 테두리,
 * 줄무늬 배경, 볼드, 중앙값 이상 강조 등)만 담당.
 * Business logic 없음 — 순수 서식 적용.
 *
 * Stage
 * 20 Reporting (Shared Component)
 *
 * Version
 * v1.4.0
 *
 * Change Log
 * v1.4.0 (2026-07-22)
 * - Added: annotateACQReportMetricNotes_() — SAL/IC Booked/IC Complete/
 *   Revenue 헤더 셀에 날짜 기준(Note)을 남겨서, 코호트 vs 이벤트 기준
 *   혼동(오늘 겪었던 "IC Booked 리포트값과 실제 필터값이 다르다" 같은
 *   질문)을 리포트 자체에서 바로 확인 가능하게 함. applyACQReportStyles_()
 *   호출 시마다 같이 실행되어 항상 최신 상태 유지.
 * v1.3.0 (2026-07-21)
 * - Added: A, B, C, F, H, J, N 컬럼(헤더+데이터) 볼드 처리.
 * - Added: F, H, J(% 컬럼) 중앙값(median) 이상인 셀 배경색 강조.
 * ==========================================================
 */


/**
 * ==========================================================
 * Apply ACQ Report Styles
 *
 * WHY
 * Report Area(A4:N...)에 % 컬럼, Revenue 컬럼 표시 형식,
 * 테두리, 짝수 행 배경색, 볼드, 중앙값 강조를 지정한다.
 * generateACQReport_()가 값을 다 쓴 직후 호출됨.
 *
 * INPUT
 * sheet : Sheet  (ACQ_REP 시트 객체)
 * rowCount : Number  (Report Area에 쓰인 데이터 행 수)
 *
 * SIDE EFFECT
 * ACQ_REP 시트의 헤더~데이터 영역(A4:N) 셀 서식/테두리/배경 변경.
 * ==========================================================
 */
function applyACQReportStyles_(sheet, rowCount){

  const startRow = CONFIG.ACQ.ROWS.REPORT_DATA_START;
  const headerRow = CONFIG.ACQ.ROWS.REPORT_HEADER;

  //----------------------------------------------------------
  // 배경색 우선 초기화 (이전 실행의 줄무늬/강조가 남지 않도록)
  //----------------------------------------------------------

  if(rowCount > 0){

    sheet.getRange(startRow, 1, rowCount, 14)
      .setBackground(null);

  }

  //----------------------------------------------------------
  // % 컬럼: All P1%(6) / New Leads%(8) / New P1%(10)
  // Revenue 컬럼: 14 — 천단위 콤마
  //----------------------------------------------------------

  if(rowCount > 0){

    const percentColumns = [6, 8, 10];

    percentColumns.forEach(function(col){

      sheet.getRange(startRow, col, rowCount, 1)
        .setNumberFormat("0.0%");

    });

    sheet.getRange(startRow, 14, rowCount, 1)
      .setNumberFormat("#,##0");

    //----------------------------------------------------------
    // 월 블록 단위 배경색 (같은 달의 세그먼트끼리는 같은 색,
    // 월이 바뀌면 색이 번갈아가며 바뀜 — 월 구분을 시각적으로 명확히)
    //----------------------------------------------------------

    const segmentsPerMonth = CONFIG.ACQ.SEGMENTS.length;

    for(let i = 0; i < rowCount; i++){

      const monthBlockIndex = Math.floor(i / segmentsPerMonth);
      const isEvenBlock = (monthBlockIndex % 2 === 1);

      if(isEvenBlock){

        sheet.getRange(startRow + i, 1, 1, 14)
          .setBackground("#F3F3F3");

      }

    }

    //----------------------------------------------------------
    // 중앙값 이상 강조 — F, H, J
    //----------------------------------------------------------

    highlightAboveMedian_(sheet, startRow, rowCount, 6);   // All P1 %
    highlightAboveMedian_(sheet, startRow, rowCount, 8);   // New Leads %
    highlightAboveMedian_(sheet, startRow, rowCount, 10);  // New P1 %

  }

  //----------------------------------------------------------
  // 볼드 처리 — A, B, C, F, H, J, N (헤더 + 데이터 전체)
  //----------------------------------------------------------

  const boldColumns = [1, 2, 3, 6, 8, 10, 14];
  const totalRows = 1 + rowCount;   // 헤더 1행 + 데이터

  boldColumns.forEach(function(col){

    sheet.getRange(headerRow, col, totalRows, 1)
      .setFontWeight("bold");

  });

  //----------------------------------------------------------
  // 테두리 — 헤더(4행) + 데이터 영역(5행~) 전체, A~N(14컬럼)
  //----------------------------------------------------------

  sheet.getRange(headerRow, 1, totalRows, 14)
    .setBorder(
      true, true, true, true, true, true,
      "#000000",
      SpreadsheetApp.BorderStyle.SOLID
    );

  annotateACQReportMetricNotes_(sheet, headerRow);

}


/**
 * ==========================================================
 * Annotate ACQ Report Metric Notes (헤더 셀 Note)
 *
 * WHY
 * SAL/IC Booked/IC Complete/Revenue는 서로 날짜 기준이 다르다
 * (2026-07-22부터 IC Booked/IC Complete/Revenue는 Event 기준으로
 * 전환, SAL은 원래부터 MTA Created Date 기준). 리포트만 보고는
 * 구분이 안 돼서 헷갈리기 쉬우므로, 헤더 셀에 Note로 기준을 남긴다.
 * 컬럼 텍스트 자체는 시트에 수동으로 입력된 값이라 코드가 건드리지
 * 않고, Note만 컬럼 위치(K/L/M/N) 기준으로 부착한다.
 *
 * INPUT
 * sheet : Sheet  (ACQ_REP 시트 객체)
 * headerRow : Number
 * ==========================================================
 */
function annotateACQReportMetricNotes_(sheet, headerRow){

  const notes = {
    11: "SAL — MTA Created Date(터치 발생월) 기준. Lead Record Type = \"SAL\"인 터치 건수.",
    12: "IC Booked — IC Booked Date 기준(그 달에 실제로 Booking된 건). Create Date(Lead 생성월)와 무관 (2026-07-22, 코호트 → 이벤트 기준 전환).",
    13: "IC Complete — IC Completed Date 기준(그 달에 실제로 Complete된 건). Booked된 달과 다를 수 있음 (예: 이전 달 Booked, 이번 달 Complete — 정상적인 백로그).",
    14: "Revenue — Opportunity Won Date 기준(그 달에 Won된 건의 Revenue 합). Create Date(Lead 생성월)와 무관 (2026-07-22, 코호트 → 이벤트 기준 전환)."
  };

  Object.keys(notes).forEach(function(col){

    sheet.getRange(headerRow, Number(col))
      .setNote(notes[col]);

  });

}


/**
 * ==========================================================
 * Highlight Cells Above Median (특정 컬럼의 중앙값 이상인 셀 강조)
 *
 * WHY
 * F/H/J(% 지표) 컬럼에서 상대적으로 높은 값을 시각적으로
 * 바로 알아볼 수 있게 한다.
 *
 * INPUT
 * sheet : Sheet
 * startRow : Number  (데이터 시작 행)
 * rowCount : Number  (데이터 행 수)
 * col : Number  (대상 컬럼, 1-based)
 *
 * SIDE EFFECT
 * 해당 컬럼에서 중앙값 이상인 셀의 배경색을 강조색으로 변경
 * (짝수 행 줄무늬보다 나중에 적용되므로 이 강조색이 우선됨).
 * ==========================================================
 */
function highlightAboveMedian_(sheet, startRow, rowCount, col){

  if(rowCount === 0) return;

  const values = sheet
    .getRange(startRow, col, rowCount, 1)
    .getValues()
    .map(function(row){ return Number(row[0]) || 0; });

  const median = computeMedian_(values);

  for(let i = 0; i < rowCount; i++){

    if(values[i] >= median){

      sheet.getRange(startRow + i, col)
        .setBackground("#C6E0B4");   // 옅은 초록 — 강조색

    }

  }

}


/**
 * ==========================================================
 * Compute Median
 *
 * WHY
 * highlightAboveMedian_()이 기준값을 계산하는 데 사용.
 *
 * INPUT
 * values : Number[]
 *
 * OUTPUT
 * Number
 *
 * TEST
 * computeMedian_([1,2,3]) === 2
 * computeMedian_([1,2,3,4]) === 2.5
 *
 * EXPECTED
 * 홀수 개는 가운데 값, 짝수 개는 가운데 두 값의 평균
 * ==========================================================
 */
function computeMedian_(values){

  if(values.length === 0) return 0;

  const sorted = values.slice().sort(function(a, b){ return a - b; });

  const mid = Math.floor(sorted.length / 2);

  if(sorted.length % 2 === 0){
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];

}


/**
 * ==========================================================
 * TEST — computeMedian_()
 * ==========================================================
 */
function testComputeMedian(){

  const case1 = computeMedian_([1, 2, 3]);
  const case2 = computeMedian_([1, 2, 3, 4]);
  const case3 = computeMedian_([]);

  const pass =
    case1 === 2 &&
    case2 === 2.5 &&
    case3 === 0;

  Logger.log("case1 (홀수) : " + case1 + " (expected 2)");
  Logger.log("case2 (짝수) : " + case2 + " (expected 2.5)");
  Logger.log("case3 (빈배열) : " + case3 + " (expected 0)");
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}