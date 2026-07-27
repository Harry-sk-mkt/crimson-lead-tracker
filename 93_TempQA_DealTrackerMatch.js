/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — Deal Tracker Segment Classification Check
 *
 * Responsibility
 * Deal Tracker(딜 비중 계산 원천, 90_TargetEngine.js)에서 classifyDealSegment_()
 * 로 세그먼트 분류가 안 되는 딜을 "temp_DealTrackerUnmatched" 시트에 나열한다.
 * 사람이 직접 눈으로 확인(Lead Source/Source Category/Lead Source Detail이
 * 어떤 값이라 분류가 안 됐는지)하기 위한 1회성/수시 재실행용 임시 작업 시트 —
 * temp_QA(25_TempQA_BusinessSegment.js)와 동일한 패턴.
 *
 * WHY
 * 2026-07-27 아키텍처 전환: Deal Tracker Source email/Primary Guardian Email/
 * Account Name을 Leads_OPS와 매칭하던 접근을 전부 폐기(Sales팀 확인 — 상담
 * 후 이메일이 Salesforce에서 덮어써져 원본 마케팅 터치 이메일이 시스템적으로
 * 복구 불가능한 경우가 있어 개별 리드 매칭 자체가 근본적으로 신뢰 불가).
 * 대신 Deal Tracker 자체를 Source of Truth로 삼아 getBusinessSegment()로
 * 직접 분류(classifyDealSegment_())하는 방식으로 전환 — 이 시트는 그 분류
 * 로직이 실패하는 딜만 모아서 사람이 검토할 수 있게 한다.
 *
 * Version
 * v2.1.0
 *
 * Change Log
 * v2.1.0 (2026-07-27)
 * - readDealTrackerRawRows_()의 반환 필드가 fy → closeFY/createdFY로 바뀐 것에
 *   맞춰 수정(안 그러면 런타임 에러). MEDIAN_FYS(제거된 설정) 참조도 제거하고
 *   실제 계산(computeDealShareRatiosFromDealRows_)과 동일하게 코호트1
 *   (closeFY===createdFY===P1_VALUE_FY)만 대상으로 필터링하도록 통일.
 * v2.0.0 (2026-07-27)
 * - 전면 재작성. 이메일 매칭 기반(구 computeUnmatchedDealTrackerEmailSummary_)
 *   에서 classifyDealSegment_() 분류 실패 기반으로 교체 — Lead Source/Source
 *   Category/Lead Source Detail 조합별로 집계, Revenue 큰 순 정렬.
 * v1.x (2026-07-27)
 * - (구버전 히스토리) Student/Guardian Email/Account Name 매칭 기반 구현 —
 *   이후 아키텍처 전환으로 폐기.
 * ==========================================================
 */

const TEMP_QA_DEAL_TRACKER_SHEET = "temp_DealTrackerUnmatched";

const TEMP_QA_DEAL_TRACKER_HEADERS = [
  "Lead Source",
  "Source Category",
  "Lead Source Detail",
  "Deal Count",
  "Total Revenue (NZD)",
  "FYs"
];


/**
 * ==========================================================
 * Compute Unclassified Deal Tracker Summary
 *
 * WHY
 * classifyDealSegment_()가 실제 계산(computeDealShareRatiosFromDealRows_())
 * 에서 쓰는 것과 동일한 분류 기준을 그대로 재사용해, 실제 계산과 100% 같은
 * 기준으로 "분류 안 되는 것"을 뽑는다. (Lead Source, Source Category, Lead
 * Source Detail) 조합별로 건수/합계 Revenue를 모아 Revenue 큰 순으로 정렬 —
 * 영향 큰 것부터 확인할 수 있도록.
 *
 * @return {Array<Object>}
 * ==========================================================
 */
function computeUnclassifiedDealTrackerSummary_(){

  const dealRows = readDealTrackerRawRows_();
  const config = CONFIG.TARGET.EXTERNAL.DEAL_TRACKER;
  const targetFY = CONFIG.TARGET.P1_VALUE_FY;

  const excludeSet = {};
  config.EXCLUDE_LEAD_SOURCES.forEach(function(src){ excludeSet[src] = true; });

  const summary = {};

  dealRows.forEach(function(row){

    // 실제 계산(computeDealShareRatiosFromDealRows_)과 동일하게 코호트1만 대상
    if(row.closeFY !== targetFY || row.createdFY !== targetFY) return;
    if(excludeSet[String(row.leadSource || "").toLowerCase()]) return;
    if(classifyDealSegment_(row)) return; // 분류됨 — 제외 대상 아님

    const key = row.leadSource + "|" + row.sourceCategory + "|" + row.leadSourceDetail;

    if(!summary[key]){
      summary[key] = {
        leadSource: row.leadSource,
        sourceCategory: row.sourceCategory,
        leadSourceDetail: row.leadSourceDetail,
        count: 0,
        totalRevenue: 0,
        fys: {}
      };
    }

    const entry = summary[key];

    entry.count++;
    entry.totalRevenue += row.revenue;
    entry.fys["FY" + row.closeFY] = true;

  });

  const rows = Object.keys(summary).map(function(key){

    const entry = summary[key];

    return {
      leadSource: entry.leadSource,
      sourceCategory: entry.sourceCategory,
      leadSourceDetail: entry.leadSourceDetail,
      count: entry.count,
      totalRevenue: entry.totalRevenue,
      fys: Object.keys(entry.fys).sort().join(", ")
    };

  });

  rows.sort(function(a, b){ return b.totalRevenue - a.totalRevenue; });

  return rows;

}


/**
 * ==========================================================
 * Run Temp QA — Deal Tracker Segment Classification Check (수동 실행용)
 * ==========================================================
 */
function runListUnmatchedDealTrackerEmails(){

  const rows = computeUnclassifiedDealTrackerSummary_();

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(TEMP_QA_DEAL_TRACKER_SHEET);

  if(!sheet){
    sheet = ss.insertSheet(TEMP_QA_DEAL_TRACKER_SHEET);
  } else {
    sheet.clearContents();
  }

  sheet.getRange(1, 1, 1, TEMP_QA_DEAL_TRACKER_HEADERS.length)
    .setValues([TEMP_QA_DEAL_TRACKER_HEADERS]);

  const matrix = rows.map(function(r){
    return [r.leadSource, r.sourceCategory, r.leadSourceDetail, r.count, r.totalRevenue, r.fys];
  });

  if(matrix.length > 0){

    sheet.getRange(2, 1, matrix.length, TEMP_QA_DEAL_TRACKER_HEADERS.length)
      .setValues(matrix);

  }

  Logger.log(
    CONFIG.LOG.PREFIX + " Unclassified Deal Tracker rows: " + matrix.length +
    " distinct (Lead Source, Source Category, Lead Source Detail) combination(s) — written to '" +
    TEMP_QA_DEAL_TRACKER_SHEET + "' sheet, sorted by Total Revenue desc."
  );

}
