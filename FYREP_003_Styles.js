/**
 * ==========================================================
 * Marketing 2.0
 * FY_REP Styles — 서식 레이어
 *
 * Responsibility
 * `FYREP_002_Report.js`의 `generateFYReport_()`가 섹션/블록을 다 쓴 뒤
 * 호출하는 서식 전용 함수. 헤더 굵게+배경, 지표 숫자 서식(metric.format),
 * Total 행 굵게, 블록 전체 테두리(사용자 요청, 2026-08-08).
 *
 * Stage
 * FYREP (2026-08-08 신규 컨벤션 — `FYREP_NNN_Name.js`, 사용자 확정)
 *
 * Version
 * v3.2.0
 *
 * Change Log
 * v3.2.0 (2026-08-08)
 * - 버그 수정(실측) — Revenue(→"$#,##0") 실행 직후 Marketing/Results(→"0")로
 *   재실행했더니 Total 행에 "$"가 남아있던 문제. 데이터+Total 행 숫자
 *   서식을 조건 없이 항상 재적용하도록 수정(모든 지표가 이제 format을
 *   명시 — FYREP_002_Report.js에서 정수 지표도 "0"으로 통일, null 없앰).
 * v3.1.0 (2026-08-08)
 * - 사용자 요청 반영 — 블록(헤더~Total 행) 전체에 테두리 추가, Total 행
 *   굵게+숫자 서식. Sum 컬럼 하이라이트(#01EF18)는 Report 레이어
 *   (`writeFYRepFlatBlock_()`)에서 직접 처리 — Sum 계산과 같은 위치에서
 *   해야 rowSums 재계산/재조회가 필요 없어 그대로 둠.
 * v3.0.0 (2026-08-08)
 * - FYREP_002_Report.js v3.0.0(섹션당 지표 1개, 세그먼트=컬럼) 레이아웃에
 *   맞춰 단순화 — 병합 헤더/Target% 강조 로직 전부 제거(더 이상 해당 없음).
 * ==========================================================
 */


/**
 * ==========================================================
 * Apply FY_REP Report Styles (IO 래퍼)
 *
 * WHY
 * generateFYReport_()가 체크된 섹션을 다 쓴 뒤 마지막에 호출. 시트 I/O
 * 전용이라 단위 테스트 대상 아님(32_ACQReportStyles.js 관례).
 *
 * INPUT
 * sheet : Sheet
 * sectionsWritten : Array<{ metric: { format }, blocks: Array<Object> }>
 *   blocks 각 항목: { headerRow, dataStartRow, rowCount, colCount, totalRow, nextRow }
 * ==========================================================
 */
function applyFYReportStyles_(sheet, sectionsWritten){

  let maxCols = 6;

  sectionsWritten.forEach(function(section){

    section.blocks.forEach(function(block){

      sheet.getRange(block.headerRow, 1, 1, block.colCount)
        .setFontWeight("bold")
        .setBackground("#F3F3F3");

      // 데이터/Total 행 전체(Total 있으면 그 행까지 포함)에 항상 명시적으로
      // 숫자 서식을 다시 씌운다 — 이전 실행(다른 지표, 다른 서식)이 같은
      // 셀 위치에 남긴 서식이 있어도 무조건 덮어써 잔여 서식을 막는다
      // (실측 버그: Revenue 실행 후 Marketing/Results로 재실행했더니 Total
      // 행에 "$"가 남아있던 문제, 2026-08-08). 모든 지표가 format을
      // 명시하므로(FY_REP_*_METRICS, "0" 또는 "$..." — null 없음) 조건 없이
      // 항상 적용.
      const numberFormatRowCount = block.totalRow
        ? (block.totalRow - block.dataStartRow + 1)
        : block.rowCount;

      if(numberFormatRowCount > 0){
        sheet.getRange(block.dataStartRow, 2, numberFormatRowCount, block.colCount - 1)
          .setNumberFormat(section.metric.format);
      }

      if(block.totalRow){
        sheet.getRange(block.totalRow, 1, 1, block.colCount).setFontWeight("bold");
      }

      const blockLastRow = block.totalRow || (block.dataStartRow + block.rowCount - 1);

      sheet.getRange(block.headerRow, 1, blockLastRow - block.headerRow + 1, block.colCount)
        .setBorder(true, true, true, true, true, true);

      maxCols = Math.max(maxCols, block.colCount);

    });

  });

  sheet.autoResizeColumns(1, maxCols);

}
