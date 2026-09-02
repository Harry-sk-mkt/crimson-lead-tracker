/**
 * ==========================================================
 * Marketing 2.0
 * JL Write — Korea Sales & Marketing Monthly Metrics 외부 시트 쓰기
 *
 * Responsibility
 * JL_002_Engine.js의 순수 계산 결과를 외부 스프레드시트(JL_001_Config.js
 * JL.EXTERNAL)의 실제 셀에 쓴다. 이 파일만 SpreadsheetApp/openById() I/O를
 * 수행 — 계산 로직은 전혀 없음(Single Responsibility).
 *
 * ⚠️ 아직 주기적 트리거(MASTER_002_PipelineAsync.js periodicRefreshAllReports_())에
 * 연결하지 않음(2026-09-01) — 외부 이해관계자 공유 시트(Josephine/Junyong/
 * Simon과 공유 중)에 검증 안 된 값을 매일 자동으로 덮어쓰는 위험을 피하기
 * 위해, 먼저 `runVerifyJLAugustActuals()`로 이미 알려진 Aug-26 실측값과
 * 대조 확인 후 연결하기로 함(사용자 확인 대기). 그 전까지는
 * `runRefreshJLExternalSheet()`로 수동 실행.
 *
 * 미래 달(아직 시작하지 않은 fiscal month) 컬럼은 쓰지 않는다 — "아직 데이터
 * 없음"과 "실적 0"을 구분하기 위해, 이미 시작한 달까지만 덮어쓴다
 * (filterJLMonthsUpToToday_() 참고).
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
 * Filter JL Months Up To Today (순수 함수)
 *
 * WHY
 * 아직 시작하지 않은 달까지 0으로 덮어쓰면 "이 달은 실적이 0"과 "이 달은
 * 아직 데이터가 없음"을 구분할 수 없게 된다 — 이미 월초가 지난(오늘 포함)
 * 달까지만 쓰기 대상으로 남긴다.
 *
 * INPUT
 * monthDescriptors : Array<{fy, month, colOffset}>
 * today : Date
 *
 * OUTPUT
 * Array<{fy, month, colOffset}>  (필터링된 부분집합, 순서 유지)
 *
 * TEST
 * testFilterJLMonthsUpToToday() 참고
 * ==========================================================
 */
function filterJLMonthsUpToToday_(monthDescriptors, today){

  return monthDescriptors.filter(function(m){

    const monthStart = getCalendarDateForFiscalMonth_(m.fy, m.month, 1);

    return monthStart.getTime() <= today.getTime();

  });

}


/**
 * ==========================================================
 * TEST — filterJLMonthsUpToToday_()
 * ==========================================================
 */
function testFilterJLMonthsUpToToday(){

  const monthDescriptors = [
    { fy: 27, month: "AUG", colOffset: 0 },  // 2026-08-01
    { fy: 27, month: "SEP", colOffset: 1 },  // 2026-09-01
    { fy: 27, month: "OCT", colOffset: 2 }   // 2026-10-01
  ];

  // "오늘"을 2026-09-01(월초 당일)로 — 당일 포함 여부 검증
  const today = new Date(2026, 8, 1);

  const result = filterJLMonthsUpToToday_(monthDescriptors, today);

  const pass =
    result.length === 2 &&
    result[0].month === "AUG" &&
    result[1].month === "SEP";

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Get JL External Sheet (I/O 래퍼)
 *
 * WHY
 * 탭 이름이 아니라 gid로 찾는다(JL_001_Config.js 헤더 참고) — 사람 이름이
 * 섞인 다른 탭들과 달리 gid는 탭이 이름을 바꿔도 안정적.
 * ==========================================================
 */
function getJLExternalSheet_(){

  const ss = SpreadsheetApp.openById(JL.EXTERNAL.SPREADSHEET_ID);
  const sheet = ss.getSheets().filter(function(s){
    return s.getSheetId() === JL.EXTERNAL.SHEET_GID;
  })[0];

  if(!sheet){
    throw new Error("JL 외부 시트에서 gid=" + JL.EXTERNAL.SHEET_GID + " 탭을 찾지 못했습니다.");
  }

  return sheet;

}


/**
 * ==========================================================
 * Compute JL Metrics From Live Data (I/O 래퍼)
 *
 * WHY
 * refreshJLExternalSheet_()/runVerifyJLAugustActuals() 둘 다 "라이브
 * 데이터를 읽어 12개월 지표를 계산"하는 같은 단계가 필요해서 공용으로 뺌.
 * ==========================================================
 */
function computeJLMetricsFromLiveData_(externalSheet){

  const headerValues = externalSheet
    .getRange(JL.ROWS.MONTH_HEADER, JL.MONTH_START_COL, 1, JL.MONTH_COUNT)
    .getValues()[0];

  const monthDescriptors = resolveJLMonthDescriptors_(headerValues);

  const summaryMap = readACQSummaryMap_();

  const spendCacheSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ACQ.AD_SPEND_CACHE_SHEET);
  const spendCacheRows = spendCacheSheet
    ? spendCacheSheet.getDataRange().getValues().slice(1)
    : [];
  const spendByFYMonth = computeJLSpendByFYMonth_(spendCacheRows);

  const dealRows = readDealTrackerRawRows_();
  const dealCountsByFYMonth = computeJLDealCountsByFYMonth_(dealRows);

  return computeJLMonthlyMetrics_(
    monthDescriptors, summaryMap, CONFIG.ACQ.SEGMENTS, spendByFYMonth, dealCountsByFYMonth
  );

}


/**
 * ==========================================================
 * Refresh JL External Sheet (트리거/수동 실행 진입점)
 *
 * WHY
 * 외부 시트의 월별 실적 셀(B21:M26/B42:M44/B49:M50)을 라이브 데이터
 * 기준으로 다시 써서 최신 상태로 유지한다. 아직 시작하지 않은 달은
 * 건드리지 않는다(filterJLMonthsUpToToday_()).
 * ==========================================================
 */
function refreshJLExternalSheet_(){

  const start = new Date();

  const externalSheet = getJLExternalSheet_();
  const metrics = computeJLMetricsFromLiveData_(externalSheet);
  const writableMetrics = filterJLMonthsUpToToday_(metrics, new Date());

  const rowSpecs = [
    { row: JL.ROWS.SALES_ACHIEVED, field: "salesAchieved" },
    { row: JL.ROWS.MQL, field: "mql" },
    { row: JL.ROWS.SAL, field: "sal" },
    { row: JL.ROWS.IC_COMPLETE, field: "icComplete" },
    { row: JL.ROWS.MARKETING_SPEND, field: "marketingSpend" },
    { row: JL.ROWS.NEW_ACCOUNTS_WON, field: "newAccountsWon" },
    { row: JL.ROWS.REFERRAL_IC_COMPLETE, field: "referralIcComplete" },
    { row: JL.ROWS.REFERRAL_REVENUE, field: "referralRevenue" },
    { row: JL.ROWS.REFERRAL_ACCOUNTS_WON, field: "referralAccountsWon" },
    { row: JL.ROWS.NONREFERRAL_IC_COMPLETE, field: "nonReferralIcComplete" },
    { row: JL.ROWS.NONREFERRAL_REVENUE, field: "nonReferralRevenue" }
  ];

  rowSpecs.forEach(function(spec){

    const values = writableMetrics.map(function(m){ return m[spec.field]; });

    if(values.length === 0) return;

    externalSheet.getRange(spec.row, JL.MONTH_START_COL, 1, values.length)
      .setValues([values]);

  });

  SpreadsheetApp.flush();

  const seconds = ((new Date() - start) / 1000).toFixed(2);

  Logger.log(
    CONFIG.LOG.PREFIX + " JL External Sheet Refresh Completed : " +
    writableMetrics.length + " months (" + seconds + "s)"
  );

}


/**
 * ==========================================================
 * TEMP — refreshJLExternalSheet_() 수동 실행용 공개 진입점
 * ==========================================================
 */
function runRefreshJLExternalSheet(){

  refreshJLExternalSheet_();

}


/**
 * ==========================================================
 * Verify JL August Actuals (수동 실행 전용 진단 — 자동화 연결 전 검증용)
 *
 * WHY
 * 이 기능이 쓰는 세 가지 매핑(마케팅 세그먼트 5개 = Non-Referral, Deal
 * Tracker 건수의 Upsell 제외, Ad_Spend_Cache 합산)은 실 데이터 접근 없이
 * 문서/코드만으로 역산 검증한 추정이다(JL_001_Config.js 파일 헤더 참고).
 * 외부 시트를 실제로 덮어쓰기 전에, 이미 사람이 채워 넣은 Aug-26(FY27)
 * 실측값과 이 코드가 계산한 값을 나란히 로그로 찍어 사용자가 직접 대조
 * 확인할 수 있게 한다 — 시트에는 아무것도 쓰지 않음.
 *
 * 대조 대상(사용자가 이미 확인한 외부 시트 Aug-26 값):
 * Sales Achieved=1,661,223.62 / MQL=874 / SAL=305 / IC Complete=36 /
 * Marketing Spend=98,000 / New Accounts Won=17 / Referral IC=2 /
 * Referral Revenue=34,474.21 / Referral Accounts Won=3 /
 * Non-Referral IC=34 / Non-Referral Revenue=314,071.77
 * ==========================================================
 */
function runVerifyJLAugustActuals(){

  const externalSheet = getJLExternalSheet_();
  const metrics = computeJLMetricsFromLiveData_(externalSheet);

  const august = metrics.filter(function(m){ return m.month === "AUG"; })[0];

  if(!august){
    Logger.log("FY27 AUG 월 디스크립터를 못 찾았습니다 — 헤더 행(JL.ROWS.MONTH_HEADER)을 확인하세요.");
    return;
  }

  const KNOWN_AUG_VALUES = {
    salesAchieved: 1661223.62,
    mql: 874,
    sal: 305,
    icComplete: 36,
    marketingSpend: 98000,
    newAccountsWon: 17,
    referralIcComplete: 2,
    referralRevenue: 34474.21,
    referralAccountsWon: 3,
    nonReferralIcComplete: 34,
    nonReferralRevenue: 314071.77
  };

  Logger.log("=== JL August Actuals 대조 (계산값 vs 알려진 실측값) ===");

  Object.keys(KNOWN_AUG_VALUES).forEach(function(field){

    const computed = august[field];
    const known = KNOWN_AUG_VALUES[field];
    const match = Math.abs(Number(computed) - Number(known)) < 0.01;

    Logger.log(
      (match ? "✅" : "❌") + " " + field + " : computed=" + computed + " known=" + known
    );

  });

}
