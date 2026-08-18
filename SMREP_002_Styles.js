/**
 * ==========================================================
 * Marketing 2.0
 * S&M_REP Styles
 *
 * Responsibility
 * S&M_REP Report Area의 셀 서식(날짜 표기, 천단위 콤마, 테두리, 줄무늬
 * 배경, freeze panes)만 담당. Business logic 없음 — 순수 서식 적용
 * (NEWP1REP_002_Styles.js와 동일 관행).
 *
 * Stage
 * 20 Reporting
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-08-18)
 * - 최초 구현.
 * ==========================================================
 */


/**
 * ==========================================================
 * Apply S&M_REP Styles
 *
 * INPUT
 * sheet    : Sheet   (S&M_REP 시트 객체)
 * rowCount : Number  (Report Area에 쓰인 데이터 행 수)
 *
 * SIDE EFFECT
 * S&M_REP 시트의 헤더~데이터 영역 서식/테두리/배경/freeze panes 변경.
 * ==========================================================
 */
function applySMReportStyles_(sheet, rowCount){

  const rows = CONFIG.SM_REP.ROWS;
  const cols = CONFIG.SM_REP.COLUMNS;

  const totalCols = cols.SAL_START + CONFIG.SM_REP.SAL_HEADERS.length - 1;
  const dataStartRow = rows.REPORT_DATA_START;

  //----------------------------------------------------------
  // 헤더 서식 — Block Header(병합 셀)/Column Header 굵게
  //----------------------------------------------------------

  sheet.getRange(rows.COLUMN_HEADER, 1, 1, totalCols).setFontWeight("bold");

  if(rowCount > 0){

    //----------------------------------------------------------
    // 배경색 우선 초기화(이전 실행의 줄무늬가 남지 않도록)
    //----------------------------------------------------------

    sheet.getRange(dataStartRow, 1, rowCount, totalCols).setBackground(null);

    //----------------------------------------------------------
    // 날짜(Week Start/End) — yyyy-MM-dd
    //----------------------------------------------------------

    sheet.getRange(dataStartRow, cols.WEEK_START, rowCount, 2)
      .setNumberFormat("yyyy-MM-dd");

    //----------------------------------------------------------
    // 카운트 컬럼(Leads/SAL 두 블록) — 천단위 콤마
    //----------------------------------------------------------

    sheet.getRange(dataStartRow, cols.LEADS_START, rowCount, CONFIG.SM_REP.LEADS_HEADERS.length)
      .setNumberFormat("#,##0");

    sheet.getRange(dataStartRow, cols.SAL_START, rowCount, CONFIG.SM_REP.SAL_HEADERS.length)
      .setNumberFormat("#,##0");

    //----------------------------------------------------------
    // 한 주 걸러 한 번 옅은 회색 배경(가독성)
    //----------------------------------------------------------

    for(let i = 0; i < rowCount; i++){

      if(i % 2 === 1){
        sheet.getRange(dataStartRow + i, 1, 1, totalCols).setBackground("#F3F3F3");
      }

    }

  }

  //----------------------------------------------------------
  // 테두리 — Block Header + Column Header + 데이터 영역
  //----------------------------------------------------------

  const totalRows = (dataStartRow - rows.BLOCK_HEADER) + rowCount;

  sheet.getRange(rows.BLOCK_HEADER, 1, totalRows, totalCols)
    .setBorder(
      true, true, true, true, true, true,
      "#000000",
      SpreadsheetApp.BorderStyle.SOLID
    );

  //----------------------------------------------------------
  // Freeze — Control/Block/Column Header 행 + Week Start/End 컬럼
  //----------------------------------------------------------

  sheet.setFrozenRows(rows.COLUMN_HEADER);
  sheet.setFrozenColumns(cols.WEEK_END);

}
