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
 * v1.3.0
 *
 * Change Log
 * v1.3.0 (2026-08-20)
 * - applySMReportWeekOverWeekHighlights_() 규칙 변경(사용자 요청): 전주와
 *   값이 동일해도 초록(증가) 처리, 현재 값이 0이면 증가/감소 어느 쪽이든
 *   색칠 안 함.
 * v1.2.0 (2026-08-20)
 * - applySMReportWeekOverWeekHighlights_()에 미래 주 가드 추가 — Week
 *   Start가 TODAY() 이후인 행은 규칙 자체를 평가하지 않음(아직 실적이
 *   없는 미래 주가 직전 실측 주 대비 "감소"로 오인되던 문제 수정, 사용자
 *   리포트).
 * v1.1.0 (2026-08-20)
 * - applySMReportWeekOverWeekHighlights_() 추가 — Leads/SAL 블록 숫자 컬럼
 *   전주 대비 증가(초록 #01ef18)/감소(빨강 #ea4335) 조건부 서식 강조
 *   (사용자 요청).
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

  applySMReportWeekOverWeekHighlights_(sheet, rowCount);

}


/**
 * ==========================================================
 * Apply S&M_REP Week-over-Week Highlights (조건부 서식)
 *
 * WHY
 * 전주 대비 증가/감소를 한눈에 보기 위해 Leads/SAL 블록의 숫자 컬럼을 바로
 * 위 행(전주)과 비교하는 수식 기반 조건부 서식을 건다 — 값이 아니라 수식
 * 이라 재실행 없이도 값이 바뀔 때마다 자동 재평가된다(TARGET_003_Styles.js
 * applyTargetReportAchievementHighlights_()와 동일 관행). 증가 또는 동일이면
 * 초록(#01ef18), 감소면 빨강(#ea4335) 배경(사용자 요청, 2026-08-20 — 동일값도
 * 초록 처리하도록 확정, "적어도 안 줄었다"는 신호로 취급). **단, 현재 값이
 * 0이면 증가/감소 어느 쪽이든 색칠하지 않음**(사용자 요청) — 0은 "그 주에
 * 실적이 없다"는 의미라 전주 대비 등락 자체가 무의미하기 때문. 각 블록의
 * 첫 데이터 행은 비교 대상(바로 위 행)이 Column Header라 ISNUMBER 가드로
 * 자동 제외됨(별도 분기 불필요).
 *
 * **미래 주 가드(2026-08-20 사용자 리포트로 추가)**: 아직 시작하지 않은
 * 미래 주는 실적이 전부 0으로 채워져 있을 뿐 "실제로 감소한 것"이 아닌데도,
 * 직전 실측 주(0보다 큼) 대비 0이라 빨강(감소)으로 잘못 칠해지는 문제가
 * 실측됨(예: SAL 블록 — Sales Accepted Date 특성상 최근 주 실적이 낮게
 * 보이다 그 다음 미래 주(전부 0)가 "더 감소"로 오인됨). 그 행의 Week Start가
 * TODAY()보다 미래면 규칙 자체가 평가되지 않도록 가드 추가(0값 제외 규칙과
 * 별개로 이중 방어 — 과거 주도 0이면 어차피 색칠 안 됨).
 *
 * INPUT
 * sheet    : Sheet   (S&M_REP 시트 객체)
 * rowCount : Number  (Report Area에 쓰인 데이터 행 수)
 *
 * SIDE EFFECT
 * S&M_REP 시트의 조건부 서식 규칙 전체 교체(setConditionalFormatRules) — 이
 * 시트엔 다른 용도의 조건부 서식이 없어 매 generate마다 통째로 덮어써도 안전.
 * ==========================================================
 */
function applySMReportWeekOverWeekHighlights_(sheet, rowCount){

  if(rowCount <= 0) return;

  const rows = CONFIG.SM_REP.ROWS;
  const cols = CONFIG.SM_REP.COLUMNS;
  const dataStartRow = rows.REPORT_DATA_START;

  const INCREASE_COLOR = "#01ef18";
  const DECREASE_COLOR = "#ea4335";

  const blocks = [
    { startCol: cols.LEADS_START, colCount: CONFIG.SM_REP.LEADS_HEADERS.length },
    { startCol: cols.SAL_START, colCount: CONFIG.SM_REP.SAL_HEADERS.length }
  ];

  const rules = [];

  blocks.forEach(function(block){

    const range = sheet.getRange(dataStartRow, block.startCol, rowCount, block.colCount);
    const cellA1 = sheet.getRange(dataStartRow, block.startCol).getA1Notation();
    const aboveA1 = sheet.getRange(dataStartRow - 1, block.startCol).getA1Notation();

    // 컬럼은 항상 Week Start(A열)에 고정, 행만 range 안에서 상대 이동하도록
    // "$A6" 형태로 변환 — 블록이 여러 컬럼(C~J, L~Q)에 걸쳐 있어도 각 행은
    // 자기 행의 Week Start를 참조한다.
    const weekStartA1 = sheet.getRange(dataStartRow, cols.WEEK_START)
      .getA1Notation().replace(/^([A-Z]+)/, "$$$1");

    rules.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied(
          "=AND(ISNUMBER(" + cellA1 + "),ISNUMBER(" + aboveA1 + ")," + cellA1 + "<>0," +
            cellA1 + ">=" + aboveA1 + "," + weekStartA1 + "<=TODAY())"
        )
        .setBackground(INCREASE_COLOR)
        .setRanges([range])
        .build()
    );

    rules.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied(
          "=AND(ISNUMBER(" + cellA1 + "),ISNUMBER(" + aboveA1 + ")," + cellA1 + "<>0," +
            cellA1 + "<" + aboveA1 + "," + weekStartA1 + "<=TODAY())"
        )
        .setBackground(DECREASE_COLOR)
        .setRanges([range])
        .build()
    );

  });

  sheet.setConditionalFormatRules(rules);

}
