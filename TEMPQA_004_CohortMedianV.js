/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — Cohort PrevP1V(b) By FY (FY24~26, median 산출용 원자재 추출)
 *
 * Responsibility
 * Target_REP Block D "prev/pipeline 트랙" P1가치(V)를 FY24~26 3개년 median으로
 * 구하기로 한 논의(2026-07-27, 사용자 확정)에 따라, FY24/25/26 각각의
 * 그룹별 R1(코호트1 Revenue)/NewP1 수/a/R2(코호트2 Revenue)/PrevP1Pool/b를
 * Leads_OPS + Deal Tracker에서 추출해 "temp_CohortMedianV" 시트에 나열한다.
 * median 계산 자체(어떻게 Block D에 반영할지)는 아직 미정 — 이 시트는 그
 * 결정에 필요한 원자재(raw numbers)를 사람이 직접 확인하기 위한 1회성/수시
 * 재실행용 임시 작업 시트, temp_QA(25_TempQA_BusinessSegment.js)/
 * temp_DealTrackerUnmatched(93_TempQA_DealTrackerMatch.js)와 동일한 패턴.
 *
 * WHY
 * b_FY = R2_FY ÷ PrevP1Pool_FY 인데, PrevP1Pool_FY는 "그 FY 이전(~FY-1까지)
 * 누적 생성된 P1 수"여야 정확하다(2026-07-27 사용자 확정 — "fy24값은 fy24
 * 데이터를 활용하는거지, fy24도 이전 파이프라인에서 클로징된 레베뉴가
 * 있을거고 전체 p1숫자가 있을테니까"). computeTargetLeadsOPSAggregates_()의
 * totalP1CountByGroup(all-time, 지금 시점 기준 단일값)을 그대로 재사용하면
 * FY24 시점엔 존재하지도 않았던 FY25·26 리드까지 FY24 백로그에 잘못
 * 포함되므로, 이 함수는 Leads_OPS를 별도로 스캔해 "그 FY 이전 누적" 카운트를
 * FY 경계별로 새로 계산한다.
 *
 * Version
 * v1.0.1
 *
 * Change Log
 * v1.0.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `94_TempQA_CohortMedianV.js` → 신규 `TEMPQA_004_CohortMedianV.js`, 코드 내용 변경 없음.
 * v1.0.0 (2026-07-27)
 * - 최초 작성.
 * ==========================================================
 */

const TEMP_QA_COHORT_MEDIAN_V_SHEET = "temp_CohortMedianV";
const TEMP_QA_COHORT_MEDIAN_V_FYS = [24, 25, 26];

const TEMP_QA_COHORT_MEDIAN_V_HEADERS = [
  "FY",
  "Group",
  "R1 (Cohort1 Revenue)",
  "New P1 Count",
  "a = R1/NewP1",
  "R2 (Cohort2 Revenue)",
  "PrevP1Pool (그 FY 이전 누적 생성 P1)",
  "b = R2/PrevP1Pool"
];


/**
 * ==========================================================
 * Compute Leads_OPS New P1 Counts By Group×FY (전체 FY, 제한 없음)
 *
 * WHY
 * PrevP1Pool_FY를 구하려면 "그 FY 이전 전체"를 누적해야 하므로, 특정
 * FY 목록(예: 24/25/26)으로 제한하지 않고 Create Date가 유효한 모든
 * effective P1의 (group, fy) 카운트를 전부 모아야 한다
 * (computeTargetLeadsOPSAggregates_()는 벤치마크 FY로 제한돼 있어 재사용 불가).
 *
 * @return {Object}  group -> { fy(number) -> count }
 * ==========================================================
 */
function computeLeadsOPSNewP1CountsByGroupAllFYs_(){

  const countsByGroup = {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(OPS.SHEET.OPS);

  if(!sheet) return countsByGroup;

  const records = sheetToObjects(sheet);

  records.forEach(function(record){

    const group = deriveTargetGroup_(record["Business Segment"]);

    if(!group) return;
    if(!isEffectiveP1_(record["Lead Priority"], record["Priority Override"])) return;

    const createDate = record["Create Date"];

    if(!(createDate instanceof Date) || isNaN(createDate.getTime())) return;

    const fy = Number(getFiscalYear(createDate).replace("FY", ""));

    if(!fy) return;

    if(!countsByGroup[group]) countsByGroup[group] = {};

    countsByGroup[group][fy] = (countsByGroup[group][fy] || 0) + 1;

  });

  return countsByGroup;

}


/**
 * ==========================================================
 * Compute Deal Tracker Cohort1/2 Revenue By Group For One FY
 *
 * WHY
 * computeDealCohortsFromDealRows_()는 CONFIG.TARGET.P1_VALUE_FY(FY26)
 * 하나로 고정돼 있어 FY24/25엔 재사용 불가 — 동일 로직을 targetFY
 * 파라미터로 받도록 다시 구현한다(분류 기준은 원본과 100% 동일:
 * EXCLUDE_LEAD_SOURCES 필터 + classifyDealSegment_()).
 *
 * @param {Array<Object>} dealRows  readDealTrackerRawRows_() 결과
 * @param {number} targetFY
 * @return {Object}  group -> { cohort1Revenue, cohort2Revenue }
 * ==========================================================
 */
function computeDealCohortsForFY_(dealRows, targetFY){

  const config = CONFIG.TARGET.EXTERNAL.DEAL_TRACKER;

  const excludeSet = {};
  config.EXCLUDE_LEAD_SOURCES.forEach(function(src){ excludeSet[src] = true; });

  const cohort1ByGroup = { events: 0, contact: 0, content: 0 };
  const cohort2ByGroup = { events: 0, contact: 0, content: 0 };

  dealRows.forEach(function(row){

    if(row.closeFY !== targetFY) return;
    if(excludeSet[String(row.leadSource || "").toLowerCase()]) return;

    const group = classifyDealSegment_(row);

    if(!group) return;

    if(row.createdFY === targetFY){
      cohort1ByGroup[group] += row.revenue;
    } else {
      cohort2ByGroup[group] += row.revenue;
    }

  });

  const result = {};

  CONFIG.TARGET.GROUP_ORDER.forEach(function(group){
    result[group] = {
      cohort1Revenue: cohort1ByGroup[group],
      cohort2Revenue: cohort2ByGroup[group]
    };
  });

  return result;

}


/**
 * ==========================================================
 * Compute Cohort Median V Rows (FY24~26 × 그룹, raw 데이터 + median)
 *
 * @return {{ rows: Array<Object>, medianByGroup: Object }}
 * ==========================================================
 */
function computeCohortMedianVRows_(){

  const dealRows = readDealTrackerRawRows_();
  const newP1CountsByGroupAllFYs = computeLeadsOPSNewP1CountsByGroupAllFYs_();

  const rows = [];
  const bValuesByGroup = { events: [], contact: [], content: [] };

  TEMP_QA_COHORT_MEDIAN_V_FYS.forEach(function(targetFY){

    const dealCohorts = computeDealCohortsForFY_(dealRows, targetFY);

    CONFIG.TARGET.GROUP_ORDER.forEach(function(group){

      const fyCounts = newP1CountsByGroupAllFYs[group] || {};

      const newP1Count = fyCounts[targetFY] || 0;

      let prevP1Pool = 0;
      Object.keys(fyCounts).forEach(function(fyKey){
        const fyNum = Number(fyKey);
        if(fyNum < targetFY) prevP1Pool += fyCounts[fyKey];
      });

      const r1 = dealCohorts[group].cohort1Revenue;
      const r2 = dealCohorts[group].cohort2Revenue;

      const a = newP1Count > 0 ? r1 / newP1Count : 0;
      const b = prevP1Pool > 0 ? r2 / prevP1Pool : 0;

      if(prevP1Pool > 0) bValuesByGroup[group].push(b);

      rows.push({
        fy: targetFY,
        group: group,
        r1: r1,
        newP1Count: newP1Count,
        a: a,
        r2: r2,
        prevP1Pool: prevP1Pool,
        b: b
      });

    });

  });

  const medianByGroup = {};

  CONFIG.TARGET.GROUP_ORDER.forEach(function(group){
    medianByGroup[group] = computeMedian_(bValuesByGroup[group]);
  });

  return { rows: rows, medianByGroup: medianByGroup };

}


/**
 * ==========================================================
 * Run Temp QA — Cohort Median V (수동 실행용)
 * ==========================================================
 */
function runComputeCohortMedianV(){

  const result = computeCohortMedianVRows_();

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(TEMP_QA_COHORT_MEDIAN_V_SHEET);

  if(!sheet){
    sheet = ss.insertSheet(TEMP_QA_COHORT_MEDIAN_V_SHEET);
  } else {
    sheet.clearContents();
  }

  sheet.getRange(1, 1, 1, TEMP_QA_COHORT_MEDIAN_V_HEADERS.length)
    .setValues([TEMP_QA_COHORT_MEDIAN_V_HEADERS]);

  const matrix = result.rows.map(function(r){
    return ["FY" + r.fy, r.group, r.r1, r.newP1Count, r.a, r.r2, r.prevP1Pool, r.b];
  });

  sheet.getRange(2, 1, matrix.length, TEMP_QA_COHORT_MEDIAN_V_HEADERS.length)
    .setValues(matrix);

  const summaryStartRow = matrix.length + 3;

  sheet.getRange(summaryStartRow, 1, 1, 2).setValues([["Group", "Median b (FY24-26)"]]);

  const summaryMatrix = CONFIG.TARGET.GROUP_ORDER.map(function(group){
    return [group, result.medianByGroup[group]];
  });

  sheet.getRange(summaryStartRow + 1, 1, summaryMatrix.length, 2).setValues(summaryMatrix);

  Logger.log(
    CONFIG.LOG.PREFIX + " Cohort Median V — " + matrix.length + " row(s, FY24-26 × " +
    CONFIG.TARGET.GROUP_ORDER.length + " groups) written to '" + TEMP_QA_COHORT_MEDIAN_V_SHEET +
    "'. Median b: " + JSON.stringify(result.medianByGroup)
  );

}


/**
 * ==========================================================
 * TEST — computeCohortMedianVRows_() 구성요소 (합성 데이터)
 *
 * EXPECTED
 * PrevP1Pool_FY26 = FY24 count + FY25 count (FY26 자체 count는 제외)
 * b_FY26 = R2_FY26 ÷ PrevP1Pool_FY26
 * ==========================================================
 */
function testComputeLeadsOPSNewP1CountsByGroupAllFYs(){

  // 합성 카운트로 PrevP1Pool 누적 로직만 검증(실제 시트 스캔은 별도 수동 검증)
  const fyCounts = { 24: 100, 25: 150, 26: 200 };
  const targetFY = 26;

  let prevP1Pool = 0;
  Object.keys(fyCounts).forEach(function(fyKey){
    const fyNum = Number(fyKey);
    if(fyNum < targetFY) prevP1Pool += fyCounts[fyKey];
  });

  const expected = 250; // 100(FY24) + 150(FY25), FY26 자체는 제외

  Logger.log("PrevP1Pool_FY26 (합성): " + prevP1Pool + " (expected " + expected + ")");

}
