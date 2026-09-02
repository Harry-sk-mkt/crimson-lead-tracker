/**
 * ==========================================================
 * Marketing 2.0
 * JL Engine — Korea Sales & Marketing Monthly Metrics 계산 (순수 함수)
 *
 * Responsibility
 * ACQ_Summary(readACQSummaryMap_())/Ad_Spend_Cache 원본 행/Deal Tracker
 * 캐시 행(readDealTrackerRawRows_())을 입력으로 받아, 외부 시트에 써야 할
 * 12개월치 지표(JL_001_Config.js ROWS 참고)를 계산한다. SpreadsheetApp 호출
 * 없는 순수 함수로 분리해 실 시트 없이 테스트 가능(TDD, 이 프로젝트 관행).
 * I/O(시트 읽기/쓰기)는 JL_003_Write.js가 담당.
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-09-01)
 * - 최초 구현.
 * ==========================================================
 */


/**
 * ==========================================================
 * Resolve JL Month Descriptors (순수 함수)
 *
 * WHY
 * 외부 시트의 월 헤더 행(B19:M19)이 FY27 고정이 아니라 매년 그대로 유지될
 * 것이므로, 헤더 셀 값(Date 또는 "Aug-26" 형태 텍스트 둘 다 방어)에서
 * 직접 FY/Month를 파생한다 — "지금은 FY27이니 하드코딩"하지 않음(No
 * Assumptions 원칙).
 *
 * INPUT
 * headerValues : Array  헤더 행의 12개 셀 값(Date 인스턴스 또는 "Aug-26"류 문자열)
 *
 * OUTPUT
 * Array<{fy:number, month:string, colOffset:number}>
 *   fy    : 2자리 숫자(예: 27)
 *   month : 3글자 대문자(예: "AUG")
 *   colOffset : headerValues 배열 안에서의 인덱스(0-based) — 그대로 열 오프셋으로 씀
 *
 * TEST
 * testResolveJLMonthDescriptors() 참고
 * ==========================================================
 */
function resolveJLMonthDescriptors_(headerValues){

  return headerValues.map(function(raw, index){

    let date = null;

    if(raw instanceof Date && !isNaN(raw.getTime())){
      date = raw;
    } else {

      // "Aug-26" 류 텍스트 방어 — Google Sheets가 항상 Date로 파싱해준다는
      // 보장이 없어 텍스트로 남아있는 경우도 처리.
      const match = /^([A-Za-z]{3})-(\d{2})$/.exec(String(raw || "").trim());

      if(match){
        const monthAbbrToIndex = {
          jan:0, feb:1, mar:2, apr:3, may:4, jun:5,
          jul:6, aug:7, sep:8, oct:9, nov:10, dec:11
        };
        const monthIndex = monthAbbrToIndex[match[1].toLowerCase()];
        if(monthIndex !== undefined){
          date = new Date(2000 + Number(match[2]), monthIndex, 1);
        }
      }

    }

    if(!date){
      return null;
    }

    const fy = Number(getFiscalYear(date).replace("FY", ""));
    const month = getFiscalMonthLabel(date);

    return { fy: fy, month: month, colOffset: index };

  }).filter(function(d){ return d !== null; });

}


/**
 * ==========================================================
 * TEST — resolveJLMonthDescriptors_()
 * ==========================================================
 */
function testResolveJLMonthDescriptors(){

  const withDates = [
    new Date(2026, 7, 1),  // Aug-26 → FY27 AUG
    new Date(2026, 11, 1), // Dec-26 → FY27 DEC
    new Date(2027, 6, 1)   // Jul-27 → FY27 JUL
  ];

  const withText = ["Aug-26", "Dec-26", "Jul-27"];

  const resultDates = resolveJLMonthDescriptors_(withDates);
  const resultText = resolveJLMonthDescriptors_(withText);

  const pass =
    resultDates.length === 3 &&
    resultDates[0].fy === 27 && resultDates[0].month === "AUG" && resultDates[0].colOffset === 0 &&
    resultDates[1].fy === 27 && resultDates[1].month === "DEC" && resultDates[1].colOffset === 1 &&
    resultDates[2].fy === 27 && resultDates[2].month === "JUL" && resultDates[2].colOffset === 2 &&
    JSON.stringify(resultText) === JSON.stringify(resultDates);

  Logger.log("Result(dates): " + JSON.stringify(resultDates));
  Logger.log("Result(text): " + JSON.stringify(resultText));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute JL Spend By FY|Month (순수 함수)
 *
 * WHY
 * Ad_Spend_Cache는 (FY, Month, Segment, Spent) 행 단위라, 세그먼트 구분
 * 없이 그 달 전체 지출 합만 필요한 이 리포트를 위해 세그먼트를 접어
 * 합산한다. FY 표기가 "FY27"이든 "27"이든 문자열 그대로 대조하지 않고
 * 양쪽 다 숫자로 정규화해서 키를 맞춘다(포맷 불일치 방어).
 *
 * INPUT
 * cacheRows : Array[]  Ad_Spend_Cache 시트의 헤더 제외 원본 행([FY, Month, Segment, Spent])
 *
 * OUTPUT
 * { "27|AUG": spentSum, ... }
 *
 * TEST
 * testComputeJLSpendByFYMonth() 참고
 * ==========================================================
 */
function computeJLSpendByFYMonth_(cacheRows){

  const result = {};

  cacheRows.forEach(function(row){

    const fy = Number(String(row[0]).replace(/[^0-9]/g, ""));
    const month = String(row[1] || "").trim().toUpperCase();
    const spent = Number(row[3]) || 0;

    if(!fy || !month) return;

    const key = fy + "|" + month;
    result[key] = (result[key] || 0) + spent;

  });

  return result;

}


/**
 * ==========================================================
 * TEST — computeJLSpendByFYMonth_()
 * ==========================================================
 */
function testComputeJLSpendByFYMonth(){

  const cacheRows = [
    ["FY27", "AUG", "Seminar", 1000],
    ["FY27", "AUG", "Search", 2500.5],
    ["FY27", "SEP", "Search", 300],
    ["27", "AUG", "Content", 100]      // FY 접두어 없는 변형도 같은 키로 합산돼야 함
  ];

  const result = computeJLSpendByFYMonth_(cacheRows);

  const pass =
    result["27|AUG"] === 3600.5 &&
    result["27|SEP"] === 300;

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute JL Deal Counts By FY|Month (순수 함수)
 *
 * WHY
 * "No of New Accounts Won"/"Referral Accounts Won"은 ACQ_REP(Revenue $
 * 합계만 계산)에 없는 "건수" 지표라, Deal Tracker 캐시 행을 직접 세어
 * 계산한다. Upsell(기존 고객 재구매 — "신규 계정"이 아님, LEAD_SOURCE에
 * "upsell" 포함으로 식별, CONFIG.TARGET.EXTERNAL.DEAL_TRACKER.EXCLUDE_LEAD_SOURCES와
 * 동일 식별 기준)은 total에서 제외. Referral은 businessSegment === "Referral"로
 * 식별(Deal Tracker Segment 컬럼, docs/BusinessSegmentClassification.md 확정 값).
 *
 * INPUT
 * dealRows : Array  readDealTrackerRawRows_()의 반환값(TARGET_001_Engine.js)
 *
 * OUTPUT
 * { "27|AUG": { totalNew: N, referral: N }, ... }
 *
 * TEST
 * testComputeJLDealCountsByFYMonth() 참고
 * ==========================================================
 */
function computeJLDealCountsByFYMonth_(dealRows){

  const result = {};

  dealRows.forEach(function(row){

    if(!row.closeDate || !row.closeFY) return;

    const leadSource = String(row.leadSource || "").toLowerCase();

    if(leadSource.indexOf("upsell") !== -1) return; // 신규 계정 아님 — 전체 집계 대상에서 제외

    const key = row.closeFY + "|" + getFiscalMonthLabel(row.closeDate);

    if(!result[key]){
      result[key] = { totalNew: 0, referral: 0 };
    }

    result[key].totalNew += 1;

    if(String(row.businessSegment || "").trim() === "Referral"){
      result[key].referral += 1;
    }

  });

  return result;

}


/**
 * ==========================================================
 * TEST — computeJLDealCountsByFYMonth_()
 * ==========================================================
 */
function testComputeJLDealCountsByFYMonth(){

  const dealRows = [
    { closeDate: new Date(2026, 7, 5), closeFY: 27, leadSource: "referral", businessSegment: "Referral" },
    { closeDate: new Date(2026, 7, 12), closeFY: 27, leadSource: "organic search", businessSegment: "Search" },
    { closeDate: new Date(2026, 7, 20), closeFY: 27, leadSource: "upsell", businessSegment: "Other" }, // 제외돼야 함
    { closeDate: new Date(2026, 8, 3), closeFY: 27, leadSource: "paid social", businessSegment: "BOFU" }
  ];

  const result = computeJLDealCountsByFYMonth_(dealRows);

  const pass =
    result["27|AUG"].totalNew === 2 &&
    result["27|AUG"].referral === 1 &&
    result["27|SEP"].totalNew === 1 &&
    result["27|SEP"].referral === 0;

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute JL Monthly Metrics (순수 함수 — 메인 조합 로직)
 *
 * WHY
 * 월 헤더에서 파생한 monthDescriptors를 축으로, ACQ_Summary(7세그먼트)를
 * 훑어 전체 합계와 Referral/Non-Referral 분해를 동시에 계산한다.
 * Non-Referral = Referral도 Other도 아닌 5개 핵심 마케팅 세그먼트
 * (deriveTargetGroup_() 재사용, TARGET_001_Engine.js) — "Other"(Upsell·
 * 미분류 포함)는 전체 합계에는 들어가지만 Referral/Non-Referral 어느
 * 쪽에도 들어가지 않는다(docs/BusinessSegmentClassification.md, 실측
 * 대조로 확정 — JL_001_Config.js 파일 헤더 참고).
 *
 * INPUT
 * monthDescriptors : Array<{fy, month, colOffset}>  resolveJLMonthDescriptors_() 결과
 * summaryMap       : Object  readACQSummaryMap_() 결과 (key: "fy|month|segment")
 * segments         : Array<string>  CONFIG.ACQ.SEGMENTS
 * spendByFYMonth   : Object  computeJLSpendByFYMonth_() 결과 (key: "fy|month")
 * dealCountsByFYMonth : Object  computeJLDealCountsByFYMonth_() 결과 (key: "fy|month")
 *
 * OUTPUT
 * Array<{
 *   fy, month, colOffset,
 *   salesAchieved, mql, sal, icComplete, marketingSpend, newAccountsWon,
 *   referralIcComplete, referralRevenue, referralAccountsWon,
 *   nonReferralIcComplete, nonReferralRevenue
 * }>
 *
 * TEST
 * testComputeJLMonthlyMetrics() 참고
 * ==========================================================
 */
function computeJLMonthlyMetrics_(monthDescriptors, summaryMap, segments, spendByFYMonth, dealCountsByFYMonth){

  const EMPTY_SUMMARY_ROW = { allLeads:0, allP1:0, newLeads:0, newP1:0, sal:0, icBooked:0, icComplete:0, revenue:0 };

  return monthDescriptors.map(function(m){

    let salesAchieved = 0, mql = 0, sal = 0, icComplete = 0;
    let referralIcComplete = 0, referralRevenue = 0;
    let nonReferralIcComplete = 0, nonReferralRevenue = 0;

    segments.forEach(function(segment){

      const key = m.fy + "|" + m.month + "|" + segment;
      const row = summaryMap[key] || EMPTY_SUMMARY_ROW;

      salesAchieved += row.revenue;
      mql += row.newP1;
      sal += row.sal;
      icComplete += row.icComplete;

      if(segment === "Referral"){
        referralIcComplete += row.icComplete;
        referralRevenue += row.revenue;
      } else if(deriveTargetGroup_(segment) !== null){
        nonReferralIcComplete += row.icComplete;
        nonReferralRevenue += row.revenue;
      }
      // deriveTargetGroup_(segment) === null && segment !== "Referral" → "Other" — 전체 합계에만 반영

    });

    const fyMonthKey = m.fy + "|" + m.month;
    const dealCounts = dealCountsByFYMonth[fyMonthKey] || { totalNew: 0, referral: 0 };

    return {
      fy: m.fy,
      month: m.month,
      colOffset: m.colOffset,
      salesAchieved: salesAchieved,
      mql: mql,
      sal: sal,
      icComplete: icComplete,
      marketingSpend: spendByFYMonth[fyMonthKey] || 0,
      newAccountsWon: dealCounts.totalNew,
      referralIcComplete: referralIcComplete,
      referralRevenue: referralRevenue,
      referralAccountsWon: dealCounts.referral,
      nonReferralIcComplete: nonReferralIcComplete,
      nonReferralRevenue: nonReferralRevenue
    };

  });

}


/**
 * ==========================================================
 * TEST — computeJLMonthlyMetrics_()
 * ==========================================================
 */
function testComputeJLMonthlyMetrics(){

  const monthDescriptors = [{ fy: 27, month: "AUG", colOffset: 0 }];

  const segments = ["Seminar", "Webinar", "BOFU", "Search", "Content", "Referral", "Other"];

  const summaryMap = {
    "27|AUG|Seminar": { icComplete: 10, newP1: 5, sal: 3, revenue: 50000 },
    "27|AUG|Webinar": { icComplete: 5, newP1: 2, sal: 1, revenue: 20000 },
    "27|AUG|BOFU": { icComplete: 8, newP1: 4, sal: 2, revenue: 30000 },
    "27|AUG|Search": { icComplete: 6, newP1: 3, sal: 2, revenue: 25000 },
    "27|AUG|Content": { icComplete: 5, newP1: 2, sal: 1, revenue: 15000 },
    "27|AUG|Referral": { icComplete: 2, newP1: 1, sal: 1, revenue: 34474.21 },
    "27|AUG|Other": { icComplete: 0, newP1: 0, sal: 0, revenue: 1312677.64 }
  };

  const spendByFYMonth = { "27|AUG": 98000 };
  const dealCountsByFYMonth = { "27|AUG": { totalNew: 17, referral: 3 } };

  const result = computeJLMonthlyMetrics_(monthDescriptors, summaryMap, segments, spendByFYMonth, dealCountsByFYMonth);

  const row = result[0];

  const pass =
    result.length === 1 &&
    Math.abs(row.salesAchieved - 1487151.85) < 0.01 &&
    row.mql === 17 &&
    row.sal === 10 &&
    row.icComplete === 36 &&
    row.marketingSpend === 98000 &&
    row.newAccountsWon === 17 &&
    row.referralIcComplete === 2 &&
    Math.abs(row.referralRevenue - 34474.21) < 0.01 &&
    row.referralAccountsWon === 3 &&
    row.nonReferralIcComplete === 34 &&
    row.nonReferralRevenue === 140000;

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}
