/**
 * ==========================================================
 * Marketing 2.0
 * Target Report Styles
 *
 * Responsibility
 * Apply formatting to Target_REP (숫자는 소수점 없이, %만 소수 2자리,
 * 테두리, 짝수 행 배경, 헤더 Note — 2026-07-27 사용자 요청 반영).
 *
 * 설계 문서
 * docs/TargetReportDesign.md §9
 *
 * Version
 * v1.2.0
 *
 * Change Log
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
    "Cutover(§4 CONFIG.TARGET.CUTOVER_DATE) 이전 주는 Actual Spent/CPNP1이 " +
    "공란(월~일 기준 정확한 주간 Spent가 존재하지 않음). " +
    "달성% = Actual ÷ Target. docs/TargetReportDesign.md 참고."
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
  그룹별 5컬럼 서식 (2026-07-27 사용자 요청 — 숫자는 전부 소수점 없이,
  달성%만 소수 2자리): Target P1(정수) / Actual P1(정수) / 달성%(소수2) /
  Target CPNP1(정수, 금액 콤마) / Actual CPNP1(정수, 금액 콤마)
  ==========================================================
  */

  const fixedColCount = CONFIG.TARGET.REPORT.FIXED_HEADERS.length;
  const groupColCount = CONFIG.TARGET.REPORT.GROUP_COLUMN_COUNT;

  CONFIG.TARGET.GROUP_ORDER.forEach(function(group, i){

    const baseCol = fixedColCount + i * groupColCount + 1; // 1-indexed

    sheet.getRange(dataStartRow, baseCol, rowCount, 1).setNumberFormat("#,##0");      // Target P1
    sheet.getRange(dataStartRow, baseCol + 1, rowCount, 1).setNumberFormat("#,##0");  // Actual P1
    sheet.getRange(dataStartRow, baseCol + 2, rowCount, 1).setNumberFormat("0.00%");  // 달성%
    sheet.getRange(dataStartRow, baseCol + 3, rowCount, 1).setNumberFormat("#,##0");  // Target CPNP1
    sheet.getRange(dataStartRow, baseCol + 4, rowCount, 1).setNumberFormat("#,##0");  // Actual CPNP1

  });

}
