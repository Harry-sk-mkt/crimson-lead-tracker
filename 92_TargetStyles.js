/**
 * ==========================================================
 * Marketing 2.0
 * Target Report Styles
 *
 * Responsibility
 * Apply formatting to Target_REP (숫자는 소수점 없이, %만 소수 2자리,
 * 테두리, 짝수 행 배경, 헤더 Note — 2026-07-27 사용자 요청 반영) + Target_Engine
 * Block 0 입력 영역 숫자 서식(2026-07-30 세그먼트 분해 이후 실무자가 직접
 * 값을 입력하는 영역이 늘어나며 추가).
 *
 * 설계 문서
 * docs/TargetReportDesign.md §9
 *
 * Version
 * v1.5.0
 *
 * Change Log
 * v1.5.0 (2026-07-30)
 * - 신규 applyTargetEngineBlockStyles_() — v1.4.0에서 Block 0에만 숫자 서식을
 *   넣고 Block A~D(벤치마크/P1당 가치/딜비중/목표전개)는 빠뜨렸던 걸 사용자가
 *   지적(실 시트 확인: Seasonality %가 "0.07478545157"처럼 그대로, CPNP1
 *   Benchmark도 서식 없이 표시됨) — Block A~D 전체에도 동일 규칙(숫자는
 *   천단위 콤마, $/%는 소수점 2자리) 적용. 90_TargetEngine.js refreshTargetEngine_()
 *   끝에서 호출.
 * v1.4.0 (2026-07-30)
 * - 신규 applyTargetEngineInputStyles_() — Target_Engine Block 0(스칼라+CPNP1
 *   벤치마크 수동입력+월별 회사 Revenue Target/Budget+세그먼트별 월별 Spent)에
 *   숫자 서식 적용(사용자 요청: 천단위 콤마, $/%는 소수점 2자리). Improvement
 *   Factor는 "0.00"(배수), Deal Share는 "0.00%"(비중), CPNP1 벤치마크/월별
 *   Revenue Target·Budget/세그먼트별 Spent는 전부 "$#,##0.00"(금액). 90_TargetEngine.js
 *   setupTargetEngineInputDefaults_() 끝에서 호출. 상세: docs/exec-plans/active/
 *   2026-07-30-target-rep-segment-breakdown.md
 * v1.3.0 (2026-07-27)
 * - 그룹당 컬럼 5→7개 확장(Target New/Pipeline P1 분리 표시, 91_TargetReport.js
 *   참고)에 맞춰 number format 오프셋 갱신.
 * v1.2.0 (2026-07-27)
 * - Body 범위에 setFontStyle("normal")/setFontWeight("normal")/setFontSize(10)
 *   추가 — 레이아웃 변경 이력 중 남은 잔재 서식(예: 옛 파라미터 요약 행의
 *   italic)이 새 데이터 행에 남아있을 수 있어 매 생성마다 방어적으로 정상화
 *   (91_TargetReport.js의 resetTargetReportSheet_()와 별개 방어선).
 * v1.1.0 (2026-07-27)
 * - Param Summary 행 서식 제거 (91_TargetReport.js에서 Control 영역 자체를
 *   없앰 — Generate가 수동 실행으로 전환되며 시트 내 안내가 불필요해짐).
 * - 숫자 서식 변경(사용자 요청): 그룹별 Target/Actual P1·CPNP1 전부 소수점
 *   없이(`#,##0`), 달성%만 소수 2자리(`0.00%`)로 통일 (기존 Target P1 소수1,
 *   CPNP1 소수2 → 전부 정수로 축소).
 * v1.0.0 (2026-07-27)
 * - 최초 구현.
 * ==========================================================
 */


/**
 * ==========================================================
 * Apply Target Report Styles
 *
 * @param {Sheet} sheet
 * @param {number} rowCount  작성된 데이터 행 수
 * ==========================================================
 */
function applyTargetReportStyles_(sheet, rowCount){

  const rows = CONFIG.TARGET.REPORT.ROWS;
  const headers = buildTargetReportHeaders_();
  const colCount = headers.length;

  if(rowCount <= 0) return;

  const dataStartRow = rows.REPORT_DATA_START;

  /*
  ==========================================================
  Header
  ==========================================================
  */

  sheet.getRange(rows.REPORT_HEADER, 1, 1, colCount)
    .setBackground("#202124")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  sheet.getRange(rows.REPORT_HEADER, 1).setNote(
    "기준: 코호트=Create Date(New P1), 통화=NZD. " +
    "Actual CPNP1은 Target_Engine Block 0의 세그먼트별 월별 수동 Spent 입력값 기준 — " +
    "월 단위로만 취합되므로 그 달의 모든 주에 동일한 값이 반복 표시됨(Target CPNP1과 동일 패턴). " +
    "달성% = Actual ÷ Target. docs/TargetReportDesign.md, " +
    "docs/exec-plans/active/2026-07-30-target-rep-segment-breakdown.md 참고."
  );

  /*
  ==========================================================
  Body — Alignment / Wrap / Font (레이아웃 변경 이력 중 남은 잔재 서식 —
  예: 옛 파라미터 요약 행의 italic — 방어적으로 매 생성마다 정상화)
  ==========================================================
  */

  sheet.getRange(dataStartRow, 1, rowCount, colCount)
    .setVerticalAlignment("middle")
    .setWrap(false)
    .setFontStyle("normal")
    .setFontWeight("normal")
    .setFontSize(10);

  /*
  ==========================================================
  Row Banding (짝수 행 배경색, computeRowBandingColors_는 20_OPS_Styles.js 재사용)
  ==========================================================
  */

  const rowBandingColors = computeRowBandingColors_(dataStartRow, rowCount, colCount, "#F3F3F3");

  sheet.getRange(dataStartRow, 1, rowCount, colCount).setBackgrounds(rowBandingColors);

  /*
  ==========================================================
  Borders
  ==========================================================
  */

  sheet.getRange(rows.REPORT_HEADER, 1, rowCount + 1, colCount)
    .setBorder(true, true, true, true, true, true, "#CCCCCC", SpreadsheetApp.BorderStyle.SOLID);

  /*
  ==========================================================
  Date Columns (Week Start / Week End)
  ==========================================================
  */

  sheet.getRange(dataStartRow, 1, rowCount, 2).setNumberFormat("yyyy-mm-dd");

  /*
  ==========================================================
  그룹별 7컬럼 서식 (2026-07-27 New/Pipeline 분리 — 숫자는 전부 소수점 없이,
  달성%만 소수 2자리): Target New P1(정수) / Target Pipeline P1(정수) /
  Target P1(합계, 정수) / Actual P1(정수) / 달성%(소수2) /
  Target CPNP1(정수, 금액 콤마) / Actual CPNP1(정수, 금액 콤마)
  ==========================================================
  */

  const fixedColCount = CONFIG.TARGET.REPORT.FIXED_HEADERS.length;
  const groupColCount = CONFIG.TARGET.REPORT.GROUP_COLUMN_COUNT;

  CONFIG.TARGET.GROUP_ORDER.forEach(function(group, i){

    const baseCol = fixedColCount + i * groupColCount + 1; // 1-indexed

    sheet.getRange(dataStartRow, baseCol, rowCount, 1).setNumberFormat("#,##0");      // Target New P1
    sheet.getRange(dataStartRow, baseCol + 1, rowCount, 1).setNumberFormat("#,##0");  // Target Pipeline P1
    sheet.getRange(dataStartRow, baseCol + 2, rowCount, 1).setNumberFormat("#,##0");  // Target P1(합계)
    sheet.getRange(dataStartRow, baseCol + 3, rowCount, 1).setNumberFormat("#,##0");  // Actual P1
    sheet.getRange(dataStartRow, baseCol + 4, rowCount, 1).setNumberFormat("0.00%");  // 달성%
    sheet.getRange(dataStartRow, baseCol + 5, rowCount, 1).setNumberFormat("#,##0");  // Target CPNP1
    sheet.getRange(dataStartRow, baseCol + 6, rowCount, 1).setNumberFormat("#,##0");  // Actual CPNP1

  });

}


/**
 * ==========================================================
 * Apply Target Engine Input Styles (Block 0 숫자 서식 — 2026-07-30 신규)
 *
 * WHY
 * 세그먼트 분해로 Target_Engine Block 0에 실무자가 직접 값을 입력하는 영역이
 * 늘어남(세그먼트별 FY26 CPNP1 벤치마크/월별 회사 Revenue Target·Budget/
 * 세그먼트별 월별 Spent) — 사용자 요청(2026-07-30): 전체 숫자는 천단위 콤마,
 * $/%인 경우 소수점 2자리까지만. Improvement Factor(배수)/Deal Share(비중)는
 * $나 %는 아니지만 0.9 같은 소수 값이 "#,##0"(정수)으로 반올림 표시되면
 * 값이 왜곡되어 보이므로, Deal Share는 개념상 비중이라 "%"로, Improvement
 * Factor는 배수 그대로 "0.00"으로 표시(둘 다 저장값 자체는 안 바뀜 — 표시만).
 *
 * @param {Sheet} sheet  Target_Engine 시트
 * ==========================================================
 */
function applyTargetEngineInputStyles_(sheet){

  const input = CONFIG.TARGET.INPUT;
  const groupCount = CONFIG.TARGET.GROUP_ORDER.length;
  const valueCol = input.VALUE_COL;
  const monthStartCol = input.MONTHLY_COMPANY_INPUTS.MONTH_START_COL;
  const monthCount = CONFIG.ACQ.FISCAL_MONTH_ORDER.length;

  sheet.getRange(input.ROWS.TARGET_FY, valueCol).setNumberFormat("0");
  sheet.getRange(input.ROWS.CUTOVER_DATE, valueCol).setNumberFormat("yyyy-mm-dd");

  sheet.getRange(input.ROWS.IMPROVEMENT_FACTOR_START, valueCol, groupCount, 1)
    .setNumberFormat("0.00");

  sheet.getRange(input.ROWS.DEAL_SHARE_START, valueCol, groupCount, 1)
    .setNumberFormat("0.00%");

  sheet.getRange(input.CPNP1_BENCHMARK_MANUAL.DATA_START_ROW, valueCol, groupCount, 1)
    .setNumberFormat("$#,##0.00");

  sheet.getRange(input.MONTHLY_COMPANY_INPUTS.REVENUE_TARGET_ROW, monthStartCol, 1, monthCount)
    .setNumberFormat("$#,##0.00");

  sheet.getRange(input.MONTHLY_COMPANY_INPUTS.BUDGET_ROW, monthStartCol, 1, monthCount)
    .setNumberFormat("$#,##0.00");

  sheet.getRange(input.MANUAL_SEGMENT_SPENT.DATA_START_ROW, monthStartCol, groupCount, monthCount)
    .setNumberFormat("$#,##0.00");

}


/**
 * ==========================================================
 * Apply Target Engine Block Styles (Block A~D 숫자 서식 — 2026-07-30 신규)
 *
 * WHY
 * applyTargetEngineInputStyles_()가 Block 0(수동 입력 영역)만 서식을 적용하고
 * Block A~D(계산 결과)는 빠뜨렸음 — 사용자가 실 시트에서 Seasonality %가
 * "0.07478545157"처럼 서식 없이 그대로 표시되는 걸 확인하고 지적(2026-07-30).
 * "숫자는 천단위 콤마, $/%는 소수점 2자리" 규칙을 Block A~D 전체에도 동일 적용.
 * 각 블록은 매번 clear() 후 다시 쓰이므로(refreshTargetEngine_() wide-clear가
 * 서식까지 지움) 매 refresh마다 다시 적용해야 한다 — writeTargetEngineBlock_()
 * 호출 전부가 끝난 뒤 이 함수를 호출한다. 실제 데이터 행 수를 매번 정확히
 * 알 필요 없이 넉넉한 행 수(2000, wide-clear와 동일 관례)에 적용 — 빈 셀에
 * 서식만 있는 건 무해하다.
 *
 * @param {Sheet} sheet  Target_Engine 시트
 * ==========================================================
 */
function applyTargetEngineBlockStyles_(sheet){

  const engine = CONFIG.TARGET.ENGINE;
  const MAX_ROWS = 2000;
  const DATA_START_ROW = 2; // 헤더가 1행, 데이터는 2행부터 (writeTargetEngineBlock_ 관례)
  const numDataRows = MAX_ROWS - DATA_START_ROW + 1;

  const fmt = function(startCol, colOffset, numCols, numberFormat){
    sheet.getRange(DATA_START_ROW, startCol + colOffset, numDataRows, numCols)
      .setNumberFormat(numberFormat);
  };

  /*
  ==========================================================
  Block A — Group, Month, FY24/25/26 New P1(#,##0), Weighted Avg(#,##0.00),
  Seasonality %(0.00%), CPNP1 Benchmark($#,##0.00)
  ==========================================================
  */

  const newP1FYCount = CONFIG.TARGET.BENCHMARK.NEWP1_FYS.length;

  fmt(engine.BLOCK_A_START_COL, 2, newP1FYCount, "#,##0");                 // FY New P1 (그룹당 FY 수만큼)
  fmt(engine.BLOCK_A_START_COL, 2 + newP1FYCount, 1, "#,##0.00");          // Weighted Avg New P1
  fmt(engine.BLOCK_A_START_COL, 2 + newP1FYCount + 1, 1, "0.00%");         // Seasonality %
  fmt(engine.BLOCK_A_START_COL, 2 + newP1FYCount + 2, 1, "$#,##0.00");     // CPNP1 Benchmark

  /*
  ==========================================================
  Block B — Group, New P1 Count(#,##0), Cohort1 Revenue($), CurrentFYP1V($),
  Prev P1 Count(#,##0), Cohort2 Revenue($), PrevP1V($)
  ==========================================================
  */

  fmt(engine.BLOCK_B_START_COL, 1, 1, "#,##0");       // FY New P1 Count
  fmt(engine.BLOCK_B_START_COL, 2, 1, "$#,##0.00");   // Cohort1 Revenue (R1)
  fmt(engine.BLOCK_B_START_COL, 3, 1, "$#,##0.00");   // CurrentFYP1V (a)
  fmt(engine.BLOCK_B_START_COL, 4, 1, "#,##0");       // Prev P1 Count
  fmt(engine.BLOCK_B_START_COL, 5, 1, "$#,##0.00");   // Cohort2 Revenue (R2)
  fmt(engine.BLOCK_B_START_COL, 6, 1, "$#,##0.00");   // PrevP1V (b)

  /*
  ==========================================================
  Block C — Group, Deal Share(%), Pipeline Share(%), FY New/Pipeline/Total
  P1 Target(#,##0)
  ==========================================================
  */

  fmt(engine.BLOCK_C_START_COL, 1, 1, "0.00%");  // Deal Share (R1)
  fmt(engine.BLOCK_C_START_COL, 2, 1, "0.00%");  // Pipeline Share (R2)
  fmt(engine.BLOCK_C_START_COL, 3, 3, "#,##0");  // FY New/Pipeline/Total P1 Target (연속 3컬럼)

  /*
  ==========================================================
  Block D — Week Start/End(날짜), Month/Group(텍스트), Month/Week New·Pipeline·
  Total P1 Target(#,##0), Month/Week CPNP1($)
  ==========================================================
  */

  fmt(engine.BLOCK_D_START_COL, 0, 1, "yyyy-mm-dd");  // Week Start
  fmt(engine.BLOCK_D_START_COL, 1, 1, "yyyy-mm-dd");  // Week End
  fmt(engine.BLOCK_D_START_COL, 4, 6, "#,##0");        // Month/Week New·Pipeline·Total P1 Target (연속 6컬럼)
  fmt(engine.BLOCK_D_START_COL, 10, 2, "$#,##0.00");   // Month/Week CPNP1

}
