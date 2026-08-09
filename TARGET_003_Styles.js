/**
 * ==========================================================
 * Marketing 2.0
 * Target Report Styles
 *
 * Responsibility
 * Apply formatting to Target_REP (숫자는 소수점 없이, 헤더 3행 구조 + 세그먼트별
 * 배색, 테두리, 짝수 행 배경, 헤더 Note) + Target_Engine Block 0 입력 영역 숫자
 * 서식(2026-07-30 세그먼트 분해 이후 실무자가 직접 값을 입력하는 영역이 늘어나며 추가).
 *
 * 설계 문서
 * docs/TargetReportDesign.md §9
 *
 * Version
 * v1.7.1
 *
 * Change Log
 * v1.7.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `92_TargetStyles.js` → 신규 `TARGET_003_Styles.js`, 코드 내용 변경 없음.
 * v1.7.0 (2026-07-30)
 * - 사용자 피드백 3건 반영: (1) `applyTargetReportStyles_()`에서 `sheet.setFrozenRows()`로
 *   헤더 3행(4행까지) 틀 고정 신규 추가. (2) CPNP1 컬럼(Target/Actual 둘 다) 서식을
 *   `#,##0` → `$#,##0.00`으로 변경("CPNP1에 $ 붙이고 소수점 2자리로"). (3) 세그먼트별
 *   헤더 배색을 원색에서 파스텔로(00_Config.js v1.19.0 `SEGMENT_HEADER_COLORS`, "색이
 *   너무 강하다") — 이 파일은 값을 그대로 읽어 쓰므로 코드 변경 없이 CONFIG만 반영.
 * v1.6.0 (2026-07-30)
 * - `applyTargetReportStyles_()` 전면 재작성 — 헤더가 1행(REPORT_HEADER)에서 3행
 *   (SEGMENT_HEADER_ROW/TARGET_ACTUAL_HEADER_ROW/METRIC_HEADER_ROW)으로 확장됨에
 *   따라 다크 헤더 스타일은 고정 3컬럼의 METRIC_HEADER_ROW에만 적용, 세그먼트
 *   컬럼(2~4행 전체)은 신규 `CONFIG.TARGET.REPORT.SEGMENT_HEADER_COLORS`(dataviz
 *   스킬 카테고리컬 팔레트)로 세그먼트별 배색 + 검정 굵은 텍스트. 그룹당 컬럼 서식도
 *   6컬럼(달성% 제거, Target 4 + Actual 2)으로 갱신. 상세: 00_Config.js v1.18.0,
 *   91_TargetReport.js v1.6.0.
 * v1.5.1 (2026-07-30)
 * - CONFIG.TARGET.INPUT.CPNP1_BENCHMARK_MANUAL → CPNP1_BENCHMARK 이름 변경 반영
 *   (00_Config.js v1.15.0, 90_TargetEngine.js v1.19.0 — CPNP1 벤치마크가 수동 입력에서
 *   계산으로 전환됨).
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
  const headers = buildTargetReportMetricHeaders_();
  const colCount = headers.length;

  if(rowCount <= 0) return;

  const dataStartRow = rows.REPORT_DATA_START;
  const fixedColCount = CONFIG.TARGET.REPORT.FIXED_HEADERS.length;
  const groupColCount = CONFIG.TARGET.REPORT.GROUP_COLUMN_COUNT;
  const segmentColors = CONFIG.TARGET.REPORT.SEGMENT_HEADER_COLORS;

  // 헤더 3행(2~4행)까지 고정 — 사용자 요청("4번째 행까지 틀 고정").
  sheet.setFrozenRows(rows.METRIC_HEADER_ROW);

  /*
  ==========================================================
  Header — 고정 3컬럼(Week Start/Week End/Month)은 4행에만 라벨(2~3행은 공란,
  사용자 확정) — 기존 다크 헤더 스타일은 4행에만 적용
  ==========================================================
  */

  sheet.getRange(rows.METRIC_HEADER_ROW, 1, 1, fixedColCount)
    .setBackground("#202124")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  sheet.getRange(rows.METRIC_HEADER_ROW, 1).setNote(
    "기준: 코호트=Create Date(New P1), 통화=NZD. " +
    "Actual CPNP1은 Target_Engine Block 0의 세그먼트별 월별 수동 Spent 입력값 기준 — " +
    "월 단위로만 취합되므로 그 달의 모든 주에 동일한 값이 반복 표시됨(Target CPNP1과 동일 패턴). " +
    "달성률(Progress)은 별도 시트에서 확인. docs/TargetReportDesign.md, " +
    "docs/exec-plans/active/2026-07-30-target-rep-segment-breakdown.md 참고."
  );

  /*
  ==========================================================
  Header — 세그먼트별 배색 (2026-07-30 신규, 사용자 요청: "세그먼트마다 다른 색으로
  구분되게"). 2~4행(세그먼트명/Target·Actual/개별 지표) 전체에 동일 배경, 검정 굵은
  텍스트 — dataviz 스킬 카테고리컬 팔레트 1~5번 슬롯(GROUP_ORDER 순서와 1:1), 대비
  계산 결과 5개 색 전부 흰 글자보다 검정 글자가 우세(00_Config.js 주석 참고).
  ==========================================================
  */

  CONFIG.TARGET.GROUP_ORDER.forEach(function(group, i){

    const baseCol = fixedColCount + i * groupColCount + 1; // 1-indexed
    const color = segmentColors[i % segmentColors.length];

    sheet.getRange(rows.SEGMENT_HEADER_ROW, baseCol, 3, groupColCount)
      .setBackground(color)
      .setFontColor("#0b0b0b")
      .setFontWeight("bold")
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");

  });

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
  Borders — 헤더 3행(2~4행) + 데이터 전체
  ==========================================================
  */

  sheet.getRange(rows.SEGMENT_HEADER_ROW, 1, rowCount + 3, colCount)
    .setBorder(true, true, true, true, true, true, "#CCCCCC", SpreadsheetApp.BorderStyle.SOLID);

  /*
  ==========================================================
  Date Columns (Week Start / Week End)
  ==========================================================
  */

  sheet.getRange(dataStartRow, 1, rowCount, 2).setNumberFormat("yyyy-mm-dd");

  /*
  ==========================================================
  그룹별 6컬럼 서식 (2026-07-30 Target/Actual 그룹핑, 달성% 제거 — P1 카운트는
  정수, CPNP1은 금액이라 $ + 소수점 2자리 — 사용자 요청): Target New P1(정수) /
  Target Pipeline P1(정수) / Target P1(합계, 정수) / Target CPNP1($#,##0.00) /
  Actual P1(정수) / Actual CPNP1($#,##0.00)
  ==========================================================
  */

  CONFIG.TARGET.GROUP_ORDER.forEach(function(group, i){

    const baseCol = fixedColCount + i * groupColCount + 1; // 1-indexed

    sheet.getRange(dataStartRow, baseCol, rowCount, 1).setNumberFormat("#,##0");           // Target New P1
    sheet.getRange(dataStartRow, baseCol + 1, rowCount, 1).setNumberFormat("#,##0");       // Target Pipeline P1
    sheet.getRange(dataStartRow, baseCol + 2, rowCount, 1).setNumberFormat("#,##0");       // Target P1(합계)
    sheet.getRange(dataStartRow, baseCol + 3, rowCount, 1).setNumberFormat("$#,##0.00");   // Target CPNP1
    sheet.getRange(dataStartRow, baseCol + 4, rowCount, 1).setNumberFormat("#,##0");       // Actual P1
    sheet.getRange(dataStartRow, baseCol + 5, rowCount, 1).setNumberFormat("$#,##0.00");   // Actual CPNP1

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

  sheet.getRange(input.CPNP1_BENCHMARK.DATA_START_ROW, valueCol, groupCount, 1)
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
