/**
 * ==========================================================
 * Marketing 2.0
 * ACQ Report Styles
 *
 * Responsibility
 * ACQ_REP Report Area의 셀 서식(% 표기, 천단위 콤마, 테두리,
 * 줄무늬 배경 등)만 담당. Business logic 없음 — 순수 서식 적용.
 *
 * Stage
 * 20 Reporting (Shared Component)
 *
 * Version
 * v1.2.0
 *
 * Change Log
 * v1.2.0 (2026-07-21)
 * - Added: 짝수 행 배경색(줄무늬) 적용 — 가독성 개선.
 * ==========================================================
 */


/**
 * ==========================================================
 * Apply ACQ Report Styles
 *
 * WHY
 * Report Area(A4:N...)에 % 컬럼, Revenue 컬럼 표시 형식,
 * 테두리, 짝수 행 배경색을 지정한다.
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

  //----------------------------------------------------------
  // 배경색 우선 초기화 (이전 실행의 줄무늬가 남지 않도록)
  //----------------------------------------------------------

  if(rowCount > 0){

    sheet.getRange(startRow, 1, rowCount, 14)
      .setBackground(null);

  }

  //----------------------------------------------------------
  // % 컬럼: All P1%(6) / New Leads%(8) / New P1%(10)
  //----------------------------------------------------------

  if(rowCount > 0){

    const percentColumns = [6, 8, 10];

    percentColumns.forEach(function(col){

      sheet.getRange(startRow, col, rowCount, 1)
        .setNumberFormat("0.0%");

    });

    //----------------------------------------------------------
    // Revenue 컬럼(14) — 천단위 콤마
    //----------------------------------------------------------

    sheet.getRange(startRow, 14, rowCount, 1)
      .setNumberFormat("#,##0");

    //----------------------------------------------------------
    // 짝수 행 배경색 (줄무늬, 가독성 개선)
    //----------------------------------------------------------

    for(let i = 0; i < rowCount; i++){

      const isEvenRow = (i % 2 === 1);   // i=0이 첫 데이터 행(홀수 번째) → i=1이 두 번째(짝수 번째)

      if(isEvenRow){

        sheet.getRange(startRow + i, 1, 1, 14)
          .setBackground("#F3F3F3");

      }

    }

  }

  //----------------------------------------------------------
  // 테두리 — 헤더(4행) + 데이터 영역(5행~) 전체, A~N(14컬럼)
  //----------------------------------------------------------

  const totalRows = 1 + rowCount;

  sheet.getRange(
    CONFIG.ACQ.ROWS.REPORT_HEADER, 1,
    totalRows, 14
  ).setBorder(
    true, true, true, true, true, true,
    "#000000",
    SpreadsheetApp.BorderStyle.SOLID
  );

}