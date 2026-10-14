/**
 * ==========================================================
 * Marketing 2.0
 * FY_REP Styles — 서식 레이어
 *
 * Responsibility
 * `FYREP_002_Report.js`의 `generateFYReport_()`가 FY×Month 플랫 행을 다
 * 쓴 뒤 호출하는 서식 전용 함수. 헤더(3행) 굵게+배경, 컬럼별 숫자 서식
 * (`FY_REP_FLAT_COLUMNS[].format`), Target% ≥100% 행 강조, 테두리.
 *
 * Stage
 * FYREP (2026-08-08 신규 컨벤션 — `FYREP_NNN_Name.js`, 사용자 확정)
 *
 * Version
 * v4.2.0
 *
 * Change Log
 * v4.2.0 (2026-10-14)
 * - 세그먼트 Revenue 컬럼(SeminarRev/WB Rev/BOFU Rev/SA Rev/Content Rev/Referral) 상위 30%
 *   셀 #01EF18 강조(사용자 요청) — `highlightFYRepTopPercentCells_()` + 순수
 *   `computeTopPercentThreshold_()`(0 초과 값의 PERCENTILE 0.7, `testComputeTopPercentThreshold()`).
 * v4.1.0 (2026-08-20)
 * - 3행(SUBTOTAL)/4행(헤더 라벨) 분리에 맞춰 스타일 분리 적용 — 3행은
 *   굵게+기울임+숫자 서식(컬럼 format), 4행은 굵게만. 테두리 범위를
 *   3행부터 마지막 데이터 행까지로 확장(기존엔 3행=헤더+SUBTOTAL 겸용
 *   1행부터였음).
 * v4.0.0 (2026-08-20)
 * - FYREP_002_Report.js v4.0.0(FY×Month 단일 플랫 테이블) 전면 재구성에
 *   맞춰 재작성 — 블록/Total 행/Sum 컬럼 개념 전부 폐기(더 이상 해당
 *   없음). Target% ≥100% 강조를 Sum 컬럼(옛 Revenue 블록 전용)에서
 *   Total Rev/Target% 두 컬럼(모든 FY×Month 행 공통)으로 이동 — 행별로
 *   이미 계산된 `row.targetPct` 값을 그대로 판정에 씀(시트 재조회 없음).
 * v3.2.0 (2026-08-08)
 * - (이전 버전 이력은 git 로그 참고 — 블록/Total 행/Sum 컬럼 레이아웃 시절 기록)
 * ==========================================================
 */


/**
 * ==========================================================
 * Apply FY_REP Report Styles (IO 래퍼)
 *
 * WHY
 * generateFYReport_()가 데이터를 다 쓴 뒤 마지막에 호출. 시트 I/O 전용이라
 * 단위 테스트 대상 아님(32_ACQReportStyles.js 관례).
 *
 * INPUT
 * sheet : Sheet
 * columns : Array<Object>  FY_REP_FLAT_COLUMNS
 * orderedRows : Array<Object>  generateFYReport_()가 실제로 쓴 행(순서대로,
 *   각 행의 targetPct로 강조 여부 판정)
 * ==========================================================
 */
function applyFYReportStyles_(sheet, columns, orderedRows){

  const subtotalRow = CONFIG.FYREP.SUBTOTAL_ROW;
  const headerRow = CONFIG.FYREP.HEADER_ROW;
  const dataStartRow = CONFIG.FYREP.REPORT_START_ROW;
  const dataRowCount = orderedRows.length;

  sheet.getRange(subtotalRow, 1, 1, columns.length)
    .setFontWeight("bold")
    .setFontStyle("italic")
    .setBackground("#F3F3F3");

  sheet.getRange(headerRow, 1, 1, columns.length)
    .setFontWeight("bold")
    .setBackground("#F3F3F3");

  columns.forEach(function(col, i){
    if(!col.format) return;
    sheet.getRange(subtotalRow, i + 1).setNumberFormat(col.format);
  });

  if(dataRowCount > 0){

    columns.forEach(function(col, i){
      if(!col.format) return;
      sheet.getRange(dataStartRow, i + 1, dataRowCount, 1).setNumberFormat(col.format);
    });

    sheet.getRange(subtotalRow, 1, dataStartRow + dataRowCount - subtotalRow, columns.length)
      .setBorder(true, true, true, true, true, true);

    highlightFYRepTargetAchievedRows_(sheet, columns, orderedRows, dataStartRow);
    highlightFYRepTopPercentCells_(sheet, columns, orderedRows, dataStartRow);

  }

  sheet.autoResizeColumns(1, columns.length);

}


/**
 * ==========================================================
 * Highlight FY_REP Target Achieved Rows (IO 래퍼)
 *
 * WHY
 * Target% ≥ 100%인 FY×Month 행의 Total Rev/Target% 셀 배경을 강조한다 —
 * 이전 버전(블록 레이아웃)이 Revenue 블록의 Sum 컬럼에 적용하던 것과
 * 동일한 목적을 새 플랫 레이아웃에 맞춰 이동(사용자가 명시적으로 폐기
 * 요청하지 않은 기존 확정 기능 — FY_REP_TARGET_ACHIEVED_COLOR, 2026-08-08
 * 확정 색상 그대로 재사용).
 *
 * INPUT
 * sheet : Sheet
 * columns : Array<Object>  FY_REP_FLAT_COLUMNS
 * orderedRows : Array<Object>  targetPct 필드 포함
 * dataStartRow : number
 * ==========================================================
 */
function highlightFYRepTargetAchievedRows_(sheet, columns, orderedRows, dataStartRow){

  const totalRevCol = columns.findIndex(function(c){ return c.key === "totalRev"; }) + 1;
  const targetPctCol = columns.findIndex(function(c){ return c.key === "targetPct"; }) + 1;

  if(totalRevCol === 0 || targetPctCol === 0) return;

  orderedRows.forEach(function(row, i){

    if(row.targetPct === "" || row.targetPct < 1) return;

    const sheetRow = dataStartRow + i;

    sheet.getRange(sheetRow, totalRevCol).setBackground(FY_REP_TARGET_ACHIEVED_COLOR);
    sheet.getRange(sheetRow, targetPctCol).setBackground(FY_REP_TARGET_ACHIEVED_COLOR);

  });

}


/**
 * ==========================================================
 * Compute Top-Percent Threshold (순수 함수)
 *
 * WHY (2026-10-14, 사용자 요청 — 세그먼트 Revenue 컬럼 상위 30% 강조)
 * 0보다 큰 값만 모아 Sheets PERCENTILE(=PERCENTILE.INC, 선형 보간)과 같은
 * 방식으로 (1 - topPercent) 분위수를 구한다. 이 값 이상이면 "상위 topPercent".
 * ACQ_REP의 buildSegmentPercentileHighlightFormula_()와 같은 정의(>0, PERCENTILE).
 *
 * @param {Array<*>} values
 * @param {number} topPercent  0~1 (0.3 = 상위 30%)
 * @return {number|null}  양수 값이 없으면 null
 * ==========================================================
 */
function computeTopPercentThreshold_(values, topPercent){

  const nums = values
    .map(function(v){ return Number(v); })
    .filter(function(v){ return isFinite(v) && v > 0; })
    .sort(function(a, b){ return a - b; });

  if(nums.length === 0) return null;

  const pos = (1 - topPercent) * (nums.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);

  return nums[lo] + (nums[hi] - nums[lo]) * (pos - lo);

}


function testComputeTopPercentThreshold(){

  // PERCENTILE({10,20,...,100}, 0.7) = 73
  const t = computeTopPercentThreshold_([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 0, ""], 0.3);
  const single = computeTopPercentThreshold_([0, 500, ""], 0.3);
  const none = computeTopPercentThreshold_([0, "", null], 0.3);

  const pass = Math.abs(t - 73) < 1e-9 && single === 500 && none === null;

  Logger.log("testComputeTopPercentThreshold: " + (pass ? "PASS" : "FAIL"));
  return pass;

}


/**
 * ==========================================================
 * Highlight FY_REP Top-Percent Cells (IO 래퍼)
 *
 * FY_REP_TOP_PERCENT_COLUMNS 각 컬럼에서 임계값 이상인 셀만 배경색.
 * Target 달성 강조와 같은 방식(Generate 때 직접 칠함, 재생성 시 시트가 다시 써짐).
 * ==========================================================
 */
function highlightFYRepTopPercentCells_(sheet, columns, orderedRows, dataStartRow){

  FY_REP_TOP_PERCENT_COLUMNS.forEach(function(key){

    const colIdx = columns.findIndex(function(c){ return c.key === key; });
    if(colIdx === -1) return;

    const threshold = computeTopPercentThreshold_(
      orderedRows.map(function(r){ return r[key]; }), FY_REP_TOP_PERCENT
    );
    if(threshold === null) return;

    orderedRows.forEach(function(row, i){
      const v = Number(row[key]);
      if(isFinite(v) && v > 0 && v >= threshold){
        sheet.getRange(dataStartRow + i, colIdx + 1).setBackground(FY_REP_TOP_PERCENT_COLOR);
      }
    });

  });

}
