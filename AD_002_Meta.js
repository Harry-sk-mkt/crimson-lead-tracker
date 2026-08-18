/**
 * ==========================================================
 * Marketing 2.0
 * Ad Spend — Meta Import/Transform (파일럿 플랫폼)
 *
 * Responsibility
 * Meta_Raw(사용자가 Meta Ads Manager export를 수동으로 붙여넣는 시트,
 * AD.SPREADSHEET_ID)를 읽어 (FY|Month|Segment)별 Spent로 변환/집계한다.
 *
 * **핵심 규칙(2026-07-30 사용자 확인)**: "Amount spent"는 캠페인 전체 생애
 * 지출이 아니라 **"Reporting starts~ends"(조회 기간) 안에서 실제로 집행된
 * 금액**이다. 그래서 월별 귀속은 계정 종류(현재/예전)와 무관하게, 캠페인
 * 활성 기간(Date created~Ends)과 보고 조회 기간(Reporting starts~ends)의
 * **교집합**에 균등분배하면 된다 — 교집합이 정확히 한 달이면 그 달에 전액,
 * 여러 달에 걸치면 달마다 나눠 귀속. (처음엔 "현재 계정=월별 정확값 그대로,
 * 예전 계정=캠페인 활성기간에 분배"로 계정별 분기했었으나, 사용자가 현재
 * 계정도 한 번에 넓은 기간(2024-09~지금)으로 export하고 싶다고 해서 그
 * 가정이 깨짐 — 교집합 기반으로 통합, docs/exec-plans/active/
 * 2026-07-30-campaign-spend-integration.md 참고.)
 *
 * Business Segment 분류는 새로 만들지 않고 `getBusinessSegment()`
 * (16_TransformHelper.js)를 그대로 재사용 — Meta 캠페인명 네이밍 규칙이
 * Salesforce MKT UTM Campaign과 사실상 동일함을 실 데이터로 검증 완료
 * (docs/ACQReportDesign.md "오해 방지" 섹션과는 별개로, 위 exec-plan
 * Surprises 참고).
 *
 * Must NOT
 * - 새 Business Segment 분류 로직 작성 (getBusinessSegment() 재사용)
 * - Target_Engine/ACQ_REP/NewP1_REP에 결과를 아직 쓰지 않음(대체 여부
 *   미정, exec-plan 참고) — 이 파일은 집계 결과를 계산해서 보여주는
 *   단계까지만 담당.
 *
 * Stage
 * AD (신규 — 2026-07-30 네이밍 컨벤션. 기존 00~99는 당장 안 바꿈)
 *
 * Version
 * v1.7.0
 *
 * Change Log
 * v1.7.0 (2026-08-19)
 * - Target_REP 주별 CPNP1이 한 달 내내 동일 값으로 반복 표시되는 문제(사용자
 *   리포트) 해소용 — 월 대신 주(월~일) 단위 지출 분배 신규: `generateAdSpendWeekRange_()`
 *   (generateAdSpendMonthRange_()의 주 버전, TARGET_001_Engine.js의
 *   getMondayOfWeek_()/addDaysToDate_() 재사용), `isMetaRowWeekPrecise_()`/
 *   `computeMetaRowWeeklySpend_()`/`aggregateMetaSpendByWeekSegment_()`(월 버전과
 *   동일한 "정밀 export 우선" 패턴), `computeMetaSpendWeeklySummary_()`(IO 래퍼,
 *   AD_004_SpendCache.js `refreshAdSpendWeeklyCache_()`가 호출). **주의**: Meta
 *   실무 export가 보통 월 단위라, 주 단위 정밀 export가 없는 한 이 경로의
 *   결과는 캠페인 활성기간 균등분배 근사값이다(월 버전과 동일한 한계 —
 *   `computeMetaRowWeeklySpend_()` WHY 참고). 기존 월 단위 함수/출력은 전혀
 *   안 건드림(ACQ_REP/FY_REP 하위호환 유지).
 * v1.6.0 (2026-07-31)
 * - Meta 전용 캐시 쓰기/읽기(`refreshMetaSpendCache_()`/`runRefreshMetaSpendCache()`/
 *   `readMetaSpendCacheMap_()`, `META_SPEND_CACHE_HEADERS`, "Meta_Spend_Cache"
 *   시트) 제거 — Naver Search Ad API 파이프라인 추가로 ACQ_REP가 여러 플랫폼
 *   합산 지출을 쓰게 되면서, 캐시 쓰기/읽기를 신규 `AD_004_SpendCache.js`로
 *   통합(사용자 확정, "합쳐서 연결"). `computeMetaSpendSummary_()`는 그대로
 *   유지(AD_004가 호출). 상세: docs/exec-plans/active/
 *   2026-07-30-campaign-spend-integration.md
 * v1.5.0 (2026-07-30)
 * - **Simple Trigger 권한 버그 발견·수정** — ACQ_REP에 "Meta Spent" 컬럼을
 *   연결한 뒤(30_ACQReport.js v1.11.0) Generate 체크박스가 조용히 실패, Cloud
 *   Logs로 정확한 원인 확인: "Specified permissions are not sufficient to
 *   call SpreadsheetApp.openById" — ACQ_REP Generate는 `onEdit()` Simple
 *   Trigger로 실행되는데, `computeMetaSpendSummary_()`(`readMetaRawRows_()`가
 *   내부에서 `SpreadsheetApp.openById(AD.SPREADSHEET_ID)` 호출)는 Simple
 *   Trigger의 제한된 권한으로는 못 씀 — Target_REP가 예전에 겪은 것과 동일한
 *   제약(2026-07-27, docs/TargetReportDesign.md). **해결**: `ACQ_Summary`와
 *   동일한 캐시 패턴 신규 도입 — `refreshMetaSpendCache_()`/
 *   `runRefreshMetaSpendCache()`(수동 실행, 외부 시트 읽어 메인 스프레드시트
 *   안 `Meta_Spend_Cache` 시트에 저장)와 `readMetaSpendCacheMap_()`(같은
 *   스프레드시트만 읽음, Simple Trigger 안전) 추가. `30_ACQReport.js`가
 *   `computeMetaSpendSummary_()` 대신 `readMetaSpendCacheMap_()`을 쓰도록
 *   전환(v1.12.0). Meta_Raw 갱신 시마다 `runRefreshMetaSpendCache()`를 먼저
 *   실행해야 ACQ_REP에 최신 값이 반영됨(자동 실행 체인 미연결, 수동).
 * v1.4.0 (2026-07-30)
 * - **타임존 버그 발견·수정** — `runDebugMetaRawLastRows()` 결과로 새로
 *   붙여넣은 정밀 export 행들이 전부 `isPrecise=false`로 나오는 걸 확인,
 *   `reportStart`가 "2026-06-30T15:00:00.000Z"처럼 실제(NZ 기준 7/1)보다
 *   하루 이른 UTC로 읽히고 있었음 — 이 Apps Script 프로젝트의 스크립트
 *   타임존(America/New_York)과 캠페인 지출 시트 자체 타임존이 달라서
 *   `.getMonth()`가 다른 달을 반환하는, Deal Tracker에서 이미 겪었던
 *   것과 동일한 버그 클래스(2026-07-28, 90_TargetEngine.js). 같은 해법
 *   (`normalizeExternalCalendarDate_()`) 재사용 — `readMetaRawRows_()`가
 *   시트 자체의 `getSpreadsheetTimeZone()` 기준으로 4개 날짜 컬럼
 *   (reportStart/reportEnd/campaignStart/campaignEnd)을 전부 재구성.
 * v1.3.0 (2026-07-30)
 * - `runDebugMetaRawLastRows()` 신규 — 정밀 export를 추가했는데도 집계
 *   결과가 여전히 안 맞는 문제 진단용. 사용자가 손으로 검산한 값(BOFU/
 *   Content)은 새 데이터와 정확히 일치했는데 실제 집계는 계속 어긋나서,
 *   데이터 자체보다 "이 행들이 isMetaRowMonthPrecise_()에서 정밀로
 *   인식되는지"(날짜가 텍스트로 들어갔을 가능성) + "캠페인명이 기존 lump
 *   행과 정확히 일치하는지"(override 커버리지 매칭 실패 가능성)를 직접
 *   확인하기 위함.
 * v1.2.0 (2026-07-30)
 * - 실 시트 검증 중 사용자가 26|JUL 실제 지출과 집계 결과가 15~20%대
 *   어긋난다고 리포트 — `runDebugMetaSpendByCampaignForMonth()`(신규 진단)
 *   로 캠페인별 내역을 확인한 결과 세그먼트 오분류는 없었고, 종료일(Ends)
 *   없는 장기 에버그린 캠페인(예: 2022년 생성 ebook 리타겟팅)의 균등분배
 *   근사 오차로 확인(사용자 확인). **정밀 export 우선 규칙 추가**: 같은
 *   캠페인의 같은 달을 "정밀"(`isMetaRowMonthPrecise_()` 신규 — reportStart/
 *   reportEnd가 같은 달)과 "장기 분배" 행이 동시에 커버하면, 분배 행의 그
 *   달 기여분은 버리고 정밀값을 채택(`aggregateMetaSpendByFYMonthSegment_()`
 *   재작성) — 사용자 확정: "최근 export로 보정하고 나머지는 그대로 두자".
 * v1.1.0 (2026-07-30)
 * - `computeMetaRowMonthlySpend_()` 전면 재작성 — 계정 ID 기반 분기
 *   ("현재 계정=단일월 그대로" vs "예전 계정=캠페인 활성기간에 분배")를
 *   폐기하고, "캠페인 활성 기간 ∩ 보고 조회 기간"에 균등분배하는 단일
 *   로직으로 통합(위 파일 헤더 WHY 참고) — 사용자가 현재 계정도 한 번에
 *   넓은 기간으로 export하고 싶다고 해서, 기존 "현재 계정=항상 한 달"
 *   가정이 깨짐. `AD.META.ACTIVE_ACCOUNT_ID`는 이 함수에서 더 이상 안 씀
 *   (Config엔 당장 유지 — 다른 용도로 쓸 가능성 있어 보존, 로직 의존만 제거).
 * v1.0.0 (2026-07-30)
 * - 최초 구현.
 * ==========================================================
 */


/**
 * ==========================================================
 * Generate Ad Spend Month Range (순수 함수)
 *
 * WHY
 * 예전(영구 종료) 계정 캠페인은 lifetime 합계 1건만 있어, 그 캠페인의
 * 활성 기간(시작~종료)에 걸친 모든 달 목록이 있어야 균등분배할 수 있다.
 *
 * INPUT
 * startDate : Date
 * endDate : Date
 *
 * OUTPUT
 * Array<{fy:number, month:string}>  startDate~endDate에 걸친 각 캘린더
 * 월 1개씩, 오름차순. 유효하지 않은 범위(endDate < startDate)면 빈 배열.
 *
 * TEST
 * testGenerateAdSpendMonthRange() 참고
 * ==========================================================
 */
function generateAdSpendMonthRange_(startDate, endDate){

  const months = [];

  if(!(startDate instanceof Date) || isNaN(startDate.getTime())) return months;
  if(!(endDate instanceof Date) || isNaN(endDate.getTime())) return months;
  if(endDate < startDate) return months;

  let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const last = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

  while(cursor <= last){

    months.push({
      fy: Number(getFiscalYear(cursor).replace("FY", "")),
      month: getFiscalMonthLabel(cursor)
    });

    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);

  }

  return months;

}


/**
 * ==========================================================
 * TEST — generateAdSpendMonthRange_()
 * ==========================================================
 */
function testGenerateAdSpendMonthRange(){

  const result = generateAdSpendMonthRange_(
    new Date(2022, 8, 16),   // 2022-09-16
    new Date(2023, 4, 31)    // 2023-05-31
  );

  const labels = result.map(function(r){ return r.fy + "|" + r.month; });

  const pass =
    result.length === 9 &&
    labels[0] === "23|SEP" &&
    labels[8] === "23|MAY";

  Logger.log("Result: " + JSON.stringify(labels));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

  const invalid = generateAdSpendMonthRange_(new Date(2023, 4, 31), new Date(2022, 8, 16));

  Logger.log("Invalid range length: " + invalid.length + " (expected 0)");
  Logger.log(invalid.length === 0 ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Meta Row Monthly Spend (순수 함수)
 *
 * WHY
 * Meta_Raw 한 행(캠페인+기간+Spent)을 (FY|Month|Segment) 단위 Spent
 * 항목들로 변환한다. Spent는 "보고 조회 기간(reportStart~reportEnd)" 안에서
 * 집행된 금액이므로, 캠페인 활성 기간(campaignStart~campaignEnd)과의
 * 교집합에 균등분배한다 — 위 파일 헤더 WHY 참고. campaignEnd가 없으면
 * (아직 종료 안 된 캠페인) reportEnd를 임시 종료 시점으로 취급.
 *
 * INPUT
 * record : Object  {campaignName, spent, reportStart(Date), reportEnd(Date),
 *   campaignStart(Date), campaignEnd(Date|없을 수 있음)}
 *
 * OUTPUT
 * Array<{fy:number, month:string, segment:string, spent:number}>
 *
 * TEST
 * testComputeMetaRowMonthlySpend() 참고
 * ==========================================================
 */
function computeMetaRowMonthlySpend_(record){

  const segment = getBusinessSegment(record.campaignName);

  if(!(record.reportStart instanceof Date) || isNaN(record.reportStart.getTime())) return [];
  if(!(record.reportEnd instanceof Date) || isNaN(record.reportEnd.getTime())) return [];

  const hasCampaignStart = record.campaignStart instanceof Date && !isNaN(record.campaignStart.getTime());
  const hasCampaignEnd = record.campaignEnd instanceof Date && !isNaN(record.campaignEnd.getTime());

  const effectiveStart = (hasCampaignStart && record.campaignStart > record.reportStart)
    ? record.campaignStart
    : record.reportStart;

  const effectiveEnd = (hasCampaignEnd && record.campaignEnd < record.reportEnd)
    ? record.campaignEnd
    : record.reportEnd;

  const months = generateAdSpendMonthRange_(effectiveStart, effectiveEnd);

  if(months.length === 0) return [];

  const perMonthSpent = (Number(record.spent) || 0) / months.length;

  return months.map(function(m){
    return { fy: m.fy, month: m.month, segment: segment, spent: perMonthSpent };
  });

}


/**
 * ==========================================================
 * TEST — computeMetaRowMonthlySpend_()
 * ==========================================================
 */
function testComputeMetaRowMonthlySpend(){

  // Case A — 실 데이터 검증 샘플: "book-a-consult-acqui_contact-lg" (BOFU).
  // campaignStart(2022-09-18)가 reportStart(2023-06-29)보다 이르므로 유효
  // 구간은 reportStart~campaignEnd(2024-07-30) = 2023 JUN~2024 JUL, 14개월.
  const row = {
    campaignName: "KR_core_2022-01-19_book-a-consult-acqui_contact-lg",
    spent: 9217.3,
    reportStart: new Date(2023, 5, 29),
    reportEnd: new Date(2024, 8, 9),
    campaignStart: new Date(2022, 8, 18),
    campaignEnd: new Date(2024, 6, 30)
  };

  const result = computeMetaRowMonthlySpend_(row);
  const expectedPerMonth = 9217.3 / 14;

  const pass =
    result.length === 14 &&
    result[0].fy === 23 && result[0].month === "JUN" &&
    result[13].fy === 24 && result[13].month === "JUL" &&
    result.every(function(r){ return r.segment === "BOFU"; }) &&
    Math.abs(result[0].spent - expectedPerMonth) < 1e-9;

  Logger.log("Result length: " + result.length + " (expected 14), first=" +
    JSON.stringify(result[0]) + ", last=" + JSON.stringify(result[13]));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

  // Case B — 캠페인이 아직 종료 안 됨(campaignEnd 없음) → reportEnd까지로 취급.
  // 보고 기간 자체가 한 달(2026-07)뿐이면 그 한 달에 전액 귀속.
  const ongoingRow = {
    campaignName: "KR_core_2024-09-07_admission-process-sim_event-online",
    spent: 1000,
    reportStart: new Date(2026, 6, 1),
    reportEnd: new Date(2026, 6, 31),
    campaignStart: new Date(2024, 7, 7),
    campaignEnd: null
  };

  const ongoingResult = computeMetaRowMonthlySpend_(ongoingRow);

  const ongoingPass =
    ongoingResult.length === 1 &&
    ongoingResult[0].fy === 26 &&
    ongoingResult[0].month === "JUL" &&
    ongoingResult[0].segment === "Webinar" &&
    ongoingResult[0].spent === 1000;

  Logger.log("Ongoing campaign result: " + JSON.stringify(ongoingResult));
  Logger.log(ongoingPass ? "✅ PASS" : "❌ FAIL");

  // Case C — 캠페인이 보고 기간 시작 전에 이미 종료됨 → 겹치는 구간이 없어 공란.
  const noOverlapRow = {
    campaignName: "KR_core_2022-09-16_gl-satpracticetest-eb-ebook-mofu_lead",
    spent: 900,
    reportStart: new Date(2023, 5, 28),
    reportEnd: new Date(2024, 8, 10),
    campaignStart: new Date(2022, 8, 16),
    campaignEnd: new Date(2022, 9, 31)
  };

  const noOverlapResult = computeMetaRowMonthlySpend_(noOverlapRow);

  Logger.log("No-overlap result length: " + noOverlapResult.length + " (expected 0)");
  Logger.log(noOverlapResult.length === 0 ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Is Meta Row Month-Precise (순수 함수)
 *
 * WHY (2026-07-30)
 * 종료일(Ends)이 없는 장기 에버그린 캠페인은 균등분배 근사 오차가 크다
 * (사용자 실측: 26|JUL Content/BOFU가 실제와 15~20%대 어긋남 — 세그먼트
 * 오분류가 아니라 "몇 년치를 평균낸" 근사 오차로 확인됨). 사용자가 특정
 * 달만 좁혀서(reportStart~reportEnd가 같은 달) 다시 export하면 그 값을
 * "정밀값"으로 우선시하기로 함(넓은 기간 분배값 중 그 달은 제외) — 이
 * 함수는 한 행이 "정밀"(보고 기간이 정확히 한 달)인지 판별한다.
 *
 * INPUT
 * record : Object  {reportStart(Date), reportEnd(Date)}
 *
 * OUTPUT
 * boolean
 *
 * TEST
 * testIsMetaRowMonthPrecise() 참고
 * ==========================================================
 */
function isMetaRowMonthPrecise_(record){

  if(!(record.reportStart instanceof Date) || isNaN(record.reportStart.getTime())) return false;
  if(!(record.reportEnd instanceof Date) || isNaN(record.reportEnd.getTime())) return false;

  return (
    record.reportStart.getFullYear() === record.reportEnd.getFullYear() &&
    record.reportStart.getMonth() === record.reportEnd.getMonth()
  );

}


/**
 * ==========================================================
 * TEST — isMetaRowMonthPrecise_()
 * ==========================================================
 */
function testIsMetaRowMonthPrecise(){

  const precise = isMetaRowMonthPrecise_({
    reportStart: new Date(2026, 6, 1),
    reportEnd: new Date(2026, 6, 31)
  });

  const lump = isMetaRowMonthPrecise_({
    reportStart: new Date(2023, 5, 29),
    reportEnd: new Date(2024, 8, 9)
  });

  Logger.log("precise=" + precise + " (expected true), lump=" + lump + " (expected false)");
  Logger.log((precise === true && lump === false) ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Aggregate Meta Spend By FY/Month/Segment (순수 함수)
 *
 * WHY
 * computeMetaRowMonthlySpend_()가 만든 행별 항목들을 (FY|Month|Segment)
 * 키로 합산한다 — 한 세그먼트/월에 여러 캠페인(행)이 걸치는 게 정상이므로.
 *
 * **정밀 export 우선 규칙(2026-07-30)**: 같은 캠페인의 같은 달을 "정밀"
 * (isMetaRowMonthPrecise_) 행과 "분배"(장기 lump) 행이 동시에 커버하면,
 * 분배 행의 그 달 기여분은 버리고 정밀 행 값만 채택 — 이중계상 방지 +
 * 근사 오차 보정. 나머지(정밀 export가 없는 달)는 그대로 분배값 사용
 * (사용자 확정: "최근 export로 보정하고 나머지는 그대로 두자").
 *
 * INPUT
 * records : Array<Object>  Meta_Raw에서 읽은 원시 레코드 배열
 *
 * OUTPUT
 * Object  키 "fy|month|segment" → 합산 Spent
 *
 * TEST
 * testAggregateMetaSpendByFYMonthSegment() 참고
 * ==========================================================
 */
function aggregateMetaSpendByFYMonthSegment_(records){

  // 캠페인별로 "정밀 export가 커버하는 (fy|month)" 집합을 먼저 구한다.
  const preciseCoverageByCampaign = {};

  records.forEach(function(record){

    if(!isMetaRowMonthPrecise_(record)) return;

    computeMetaRowMonthlySpend_(record).forEach(function(entry){

      const campaign = record.campaignName;

      if(!preciseCoverageByCampaign[campaign]) preciseCoverageByCampaign[campaign] = {};

      preciseCoverageByCampaign[campaign][entry.fy + "|" + entry.month] = true;

    });

  });

  const totals = {};

  records.forEach(function(record){

    const isPrecise = isMetaRowMonthPrecise_(record);
    const coverage = preciseCoverageByCampaign[record.campaignName];

    computeMetaRowMonthlySpend_(record).forEach(function(entry){

      // 분배(lump) 행이 만든 항목인데, 같은 캠페인의 같은 달을 정밀 export가
      // 이미 커버한다면 건너뜀(정밀값 우선, 이중계상 방지).
      if(!isPrecise && coverage && coverage[entry.fy + "|" + entry.month]) return;

      const key = entry.fy + "|" + entry.month + "|" + entry.segment;

      totals[key] = (totals[key] || 0) + entry.spent;

    });

  });

  return totals;

}


/**
 * ==========================================================
 * TEST — aggregateMetaSpendByFYMonthSegment_()
 * ==========================================================
 */
function testAggregateMetaSpendByFYMonthSegment(){

  const records = [
    {
      // 아직 종료 안 된 캠페인(campaignEnd 없음) — reportEnd까지로 취급, 보고
      // 기간이 한 달(2026-07)뿐이라 그 달에 전액.
      campaignName: "KR_core_2024-09-07_admission-process-sim_event-online",
      spent: 500,
      reportStart: new Date(2026, 6, 1),
      reportEnd: new Date(2026, 6, 31),
      campaignStart: new Date(2024, 7, 7),
      campaignEnd: null
    },
    {
      // 같은 (FY|Month|Segment)에 걸치는 두 번째 캠페인 — 합산 확인용
      campaignName: "KR_core_2024-09-07_admission-process-sim_event-online-fbiglg",
      spent: 250,
      reportStart: new Date(2026, 6, 1),
      reportEnd: new Date(2026, 6, 31),
      campaignStart: new Date(2024, 7, 7),
      campaignEnd: null
    }
  ];

  const result = aggregateMetaSpendByFYMonthSegment_(records);

  const pass = result["26|JUL|Webinar"] === 750;

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

  // 정밀 export 우선 규칙 확인 — 같은 캠페인이 (1) 종료일 없는 장기 lump로
  // 여러 달에 분배되고, (2) 그중 한 달(JUL)만 정밀 export도 있으면, JUL은
  // 정밀값으로 대체되고 나머지 달은 분배값 그대로 남아야 한다.
  const overrideRecords = [
    {
      campaignName: "KR_core_2022-10-01_retargeting-ebook_lead-fbiglg",
      spent: 1200,   // 2026-06~2026-07 두 달에 걸쳐 분배 → 달당 600
      reportStart: new Date(2026, 5, 1),
      reportEnd: new Date(2026, 6, 31),
      campaignStart: new Date(2022, 9, 1),
      campaignEnd: null
    },
    {
      // 같은 캠페인의 2026-07만 좁혀서 다시 뽑은 정밀 export
      campaignName: "KR_core_2022-10-01_retargeting-ebook_lead-fbiglg",
      spent: 900,
      reportStart: new Date(2026, 6, 1),
      reportEnd: new Date(2026, 6, 31),
      campaignStart: new Date(2022, 9, 1),
      campaignEnd: null
    }
  ];

  const overrideResult = aggregateMetaSpendByFYMonthSegment_(overrideRecords);

  const overridePass =
    overrideResult["26|JUN|Content"] === 600 &&   // 분배값 그대로
    overrideResult["26|JUL|Content"] === 900;     // 정밀값으로 대체(600 아님)

  Logger.log("Override result: " + JSON.stringify(overrideResult));
  Logger.log(overridePass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Setup Meta Raw Sheet (최초 1회 수동 실행 — 탭만 생성)
 *
 * WHY
 * 헤더는 코드가 미리 정하지 않는다 — 사용자가 Meta Ads Manager export를
 * (헤더 행 포함) 그대로 복사/붙여넣기 하면 그게 곧 헤더가 되는 방식이라
 * (Header-Based Mapping, sheetToObjects() 재사용), 탭 자체만 미리 만들어둔다.
 * ==========================================================
 */
function setupMetaRawSheet(){

  const ss = SpreadsheetApp.openById(AD.SPREADSHEET_ID);

  let sheet = ss.getSheetByName(AD.RAW_SHEET.Meta);

  if(!sheet){
    sheet = ss.insertSheet(AD.RAW_SHEET.Meta);
    Logger.log(AD.RAW_SHEET.Meta + " 탭 생성 완료. Meta Ads Manager export를 헤더 포함해서 A1부터 붙여넣으세요.");
  } else {
    Logger.log(AD.RAW_SHEET.Meta + " 탭이 이미 존재합니다.");
  }

}


/**
 * ==========================================================
 * Read Meta Raw Rows (IO 래퍼)
 *
 * WHY
 * Meta_Raw 시트를 sheetToObjects()(22_OPS_Merge.js, 공용 헤더 기반 리더)
 * 로 읽어 AD.META.COLUMNS 매핑에 따라 파싱한다.
 *
 * **타임존 정규화(2026-07-30 추가)**: 이 Apps Script 프로젝트의 스크립트
 * 타임존(America/New_York)과 캠페인 지출 스프레드시트 자체의 타임존이
 * 달라서, 날짜 셀을 그냥 읽으면 실제 날짜보다 하루 이전으로 밀려 나오는
 * 문제 발견(예: NZ 기준 "2026-07-01"이 "2026-06-30T15:00:00Z"로 읽혀
 * `.getMonth()`가 JUN을 반환 — `isMetaRowMonthPrecise_()`가 정밀 export를
 * "여러 달에 걸침"으로 오판하게 됨). Deal Tracker에서 이미 겪은 동일 버그의
 * 해법(`normalizeExternalCalendarDate_()`, 90_TargetEngine.js)을 그대로
 * 재사용 — 캠페인 지출 시트 자체의 타임존 기준으로 연/월/일을 재구성한다.
 * ==========================================================
 */
function readMetaRawRows_(){

  const ss = SpreadsheetApp.openById(AD.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(AD.RAW_SHEET.Meta);

  if(!sheet) return [];

  const sourceTimeZone = ss.getSpreadsheetTimeZone();
  const cols = AD.META.COLUMNS;

  function normalizeDate(value){
    return value instanceof Date ? normalizeExternalCalendarDate_(value, sourceTimeZone) : value;
  }

  return sheetToObjects(sheet).map(function(raw){

    return {
      campaignName: raw[cols.CAMPAIGN_NAME],
      accountId: String(raw[cols.ACCOUNT_ID] || ""),
      spent: raw[cols.SPENT],
      reportStart: normalizeDate(raw[cols.REPORT_START]),
      reportEnd: normalizeDate(raw[cols.REPORT_END]),
      campaignStart: normalizeDate(raw[cols.CAMPAIGN_START]),
      campaignEnd: normalizeDate(raw[cols.CAMPAIGN_END])
    };

  });

}


/**
 * ==========================================================
 * Compute Meta Spend Summary (IO 래퍼)
 * ==========================================================
 */
function computeMetaSpendSummary_(){

  return aggregateMetaSpendByFYMonthSegment_(readMetaRawRows_());

}


// Meta 전용 캐시 쓰기/읽기(refreshMetaSpendCache_/runRefreshMetaSpendCache/
// readMetaSpendCacheMap_, "Meta_Spend_Cache" 시트)는 2026-07-31 제거됨 —
// Naver Search Ad API 파이프라인(AD_003_NaverSearch.js) 추가 후 ACQ_REP가
// 여러 플랫폼 합산 지출을 쓰기로 확정, 캐시 쓰기/읽기는 신규
// AD_004_SpendCache.js(refreshAdSpendCache_()/readAdSpendCacheMap_(),
// "Ad_Spend_Cache" 시트)로 통합. computeMetaSpendSummary_()는 그대로 유지 —
// AD_004가 이 함수를 호출해 Meta 몫을 가져간다. 상세: docs/exec-plans/active/
// 2026-07-30-campaign-spend-integration.md


/**
 * ==========================================================
 * TEMP — computeMetaSpendSummary_() 수동 실행/확인용 공개 진입점
 * ==========================================================
 */
function runComputeMetaSpendSummary(){

  const summary = computeMetaSpendSummary_();

  Logger.log(JSON.stringify(summary, null, 2));

}


/**
 * ==========================================================
 * Generate Ad Spend Week Range (순수 함수)
 *
 * WHY
 * generateAdSpendMonthRange_()의 주(월~일) 버전 — Target_REP 주별 CPNP1
 * 정확도 개선(2026-08-19)을 위해 Meta 캠페인 지출을 월이 아니라 주 단위로도
 * 분배할 수 있어야 한다. 주 정의는 Target_Engine과 동일(월요일 시작) —
 * `getMondayOfWeek_()`/`addDaysToDate_()`(TARGET_001_Engine.js)를 그대로
 * 재사용한다(같은 Apps Script 프로젝트라 전역에서 바로 호출 가능, 새 유틸
 * 재작성 안 함).
 *
 * INPUT
 * startDate : Date
 * endDate : Date
 *
 * OUTPUT
 * Array<{weekStart:Date}>  startDate~endDate에 걸친 각 주(월~일)의 월요일,
 * 오름차순. 유효하지 않은 범위(endDate < startDate)면 빈 배열.
 *
 * TEST
 * testGenerateAdSpendWeekRange() 참고
 * ==========================================================
 */
function generateAdSpendWeekRange_(startDate, endDate){

  const weeks = [];

  if(!(startDate instanceof Date) || isNaN(startDate.getTime())) return weeks;
  if(!(endDate instanceof Date) || isNaN(endDate.getTime())) return weeks;
  if(endDate < startDate) return weeks;

  let cursor = getMondayOfWeek_(startDate);
  const last = getMondayOfWeek_(endDate);

  while(cursor <= last){

    weeks.push({ weekStart: new Date(cursor) });
    cursor = addDaysToDate_(cursor, 7);

  }

  return weeks;

}


/**
 * ==========================================================
 * TEST — generateAdSpendWeekRange_()
 * ==========================================================
 */
function testGenerateAdSpendWeekRange(){

  const result = generateAdSpendWeekRange_(
    new Date(2026, 7, 6),   // 2026-08-06 (목, 8/3주)
    new Date(2026, 7, 20)   // 2026-08-20 (목, 8/17주)
  );

  const pass =
    result.length === 3 &&
    result[0].weekStart.getTime() === new Date(2026, 7, 3).getTime() &&
    result[1].weekStart.getTime() === new Date(2026, 7, 10).getTime() &&
    result[2].weekStart.getTime() === new Date(2026, 7, 17).getTime();

  Logger.log("Result: " + result.map(function(r){ return r.weekStart.toString(); }).join(" | "));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

  const invalid = generateAdSpendWeekRange_(new Date(2026, 7, 20), new Date(2026, 7, 6));

  Logger.log("Invalid range length: " + invalid.length + " (expected 0)");
  Logger.log(invalid.length === 0 ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Is Meta Row Week Precise (순수 함수)
 *
 * WHY
 * isMetaRowMonthPrecise_()의 주 버전 — reportStart/reportEnd가 같은 주(월~일)
 * 안에 있으면 그 행의 Spent를 "그 주 정확 값"으로 신뢰할 수 있다. 실무
 * export가 보통 월 단위라 이 조건을 만족하는 행은 드물 것으로 예상됨(사용자가
 * 주 단위 export로 바꾸기 전까지) — 만족하는 행이 있으면 우선 채택하고,
 * 없으면 computeMetaRowWeeklySpend_()의 균등분배 근사값으로 대체된다
 * (aggregateMetaSpendByWeekSegment_()의 정밀 우선 규칙).
 *
 * @param {Object} record
 * @return {boolean}
 *
 * TEST
 * testIsMetaRowWeekPrecise() 참고
 * ==========================================================
 */
function isMetaRowWeekPrecise_(record){

  if(!(record.reportStart instanceof Date) || isNaN(record.reportStart.getTime())) return false;
  if(!(record.reportEnd instanceof Date) || isNaN(record.reportEnd.getTime())) return false;

  return getMondayOfWeek_(record.reportStart).getTime() === getMondayOfWeek_(record.reportEnd).getTime();

}


/**
 * ==========================================================
 * TEST — isMetaRowWeekPrecise_()
 * ==========================================================
 */
function testIsMetaRowWeekPrecise(){

  const precise = isMetaRowWeekPrecise_({
    reportStart: new Date(2026, 7, 3),
    reportEnd: new Date(2026, 7, 9)
  });

  const lump = isMetaRowWeekPrecise_({
    reportStart: new Date(2026, 6, 1),
    reportEnd: new Date(2026, 6, 31)
  });

  Logger.log("precise=" + precise + " (expected true), lump=" + lump + " (expected false)");
  Logger.log((precise === true && lump === false) ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Meta Row Weekly Spend (순수 함수)
 *
 * WHY
 * computeMetaRowMonthlySpend_()의 주 버전 — "캠페인 활성 기간 ∩ 보고 조회
 * 기간"을 주(월~일) 단위로 균등분배한다. 월 버전과 동일한 근사 한계를 그대로
 * 가진다(장기 lump 행일수록 실제 주간 변동을 못 담음) — 정밀 export가 월
 * 단위인 한 이 함수의 대부분 출력은 근사값이라는 걸 유의(파일 헤더 Change
 * Log v1.7.0 WHY 참고).
 *
 * INPUT
 * record : Object  computeMetaRowMonthlySpend_()와 동일
 *
 * OUTPUT
 * Array<{weekStart:Date, segment:string, spent:number}>
 *
 * TEST
 * testComputeMetaRowWeeklySpend() 참고
 * ==========================================================
 */
function computeMetaRowWeeklySpend_(record){

  const segment = getBusinessSegment(record.campaignName);

  if(!(record.reportStart instanceof Date) || isNaN(record.reportStart.getTime())) return [];
  if(!(record.reportEnd instanceof Date) || isNaN(record.reportEnd.getTime())) return [];

  const hasCampaignStart = record.campaignStart instanceof Date && !isNaN(record.campaignStart.getTime());
  const hasCampaignEnd = record.campaignEnd instanceof Date && !isNaN(record.campaignEnd.getTime());

  const effectiveStart = (hasCampaignStart && record.campaignStart > record.reportStart)
    ? record.campaignStart
    : record.reportStart;

  const effectiveEnd = (hasCampaignEnd && record.campaignEnd < record.reportEnd)
    ? record.campaignEnd
    : record.reportEnd;

  const weeks = generateAdSpendWeekRange_(effectiveStart, effectiveEnd);

  if(weeks.length === 0) return [];

  const perWeekSpent = (Number(record.spent) || 0) / weeks.length;

  return weeks.map(function(w){
    return { weekStart: w.weekStart, segment: segment, spent: perWeekSpent };
  });

}


/**
 * ==========================================================
 * TEST — computeMetaRowWeeklySpend_()
 * ==========================================================
 */
function testComputeMetaRowWeeklySpend(){

  // 2주치 정밀 export(2026-08-03~08-16) — BOFU 캠페인명 패턴(기존
  // testComputeMetaRowMonthlySpend() Case A와 동일 네이밍 관례).
  const row = {
    campaignName: "KR_core_2022-01-19_book-a-consult-acqui_contact-lg",
    spent: 700,
    reportStart: new Date(2026, 7, 3),
    reportEnd: new Date(2026, 7, 16),
    campaignStart: new Date(2020, 0, 1),
    campaignEnd: null
  };

  const result = computeMetaRowWeeklySpend_(row);

  const pass =
    result.length === 2 &&
    Math.abs(result[0].spent - 350) < 1e-9 &&
    Math.abs(result[1].spent - 350) < 1e-9 &&
    result[0].weekStart.getTime() === new Date(2026, 7, 3).getTime() &&
    result[1].weekStart.getTime() === new Date(2026, 7, 10).getTime() &&
    result[0].segment === "BOFU";

  Logger.log("Result: " + JSON.stringify(result.map(function(r){
    return { weekStart: r.weekStart.toString(), segment: r.segment, spent: r.spent };
  })));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Aggregate Meta Spend By Week/Segment (순수 함수)
 *
 * WHY
 * aggregateMetaSpendByFYMonthSegment_()의 주 버전 — 동일한 "정밀 export
 * 우선" 규칙: 같은 캠페인의 같은 주를 정밀(isMetaRowWeekPrecise_()) 행과
 * 분배(장기 lump) 행이 동시에 커버하면, 분배 행의 그 주 기여분은 버리고
 * 정밀값을 채택한다.
 *
 * INPUT
 * records : Array  (readMetaRawRows_() 결과)
 *
 * OUTPUT
 * Object  키 "yyyy-MM-dd(weekStart)|segment" → 합산 Spent
 *
 * TEST
 * testAggregateMetaSpendByWeekSegment() 참고
 * ==========================================================
 */
function aggregateMetaSpendByWeekSegment_(records){

  const toKey = function(weekStart){
    return Utilities.formatDate(weekStart, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd");
  };

  const preciseCoverageByCampaign = {};

  records.forEach(function(record){

    if(!isMetaRowWeekPrecise_(record)) return;

    computeMetaRowWeeklySpend_(record).forEach(function(entry){

      const campaign = record.campaignName;

      if(!preciseCoverageByCampaign[campaign]) preciseCoverageByCampaign[campaign] = {};

      preciseCoverageByCampaign[campaign][toKey(entry.weekStart)] = true;

    });

  });

  const totals = {};

  records.forEach(function(record){

    const isPrecise = isMetaRowWeekPrecise_(record);
    const coverage = preciseCoverageByCampaign[record.campaignName];

    computeMetaRowWeeklySpend_(record).forEach(function(entry){

      const weekKey = toKey(entry.weekStart);

      if(!isPrecise && coverage && coverage[weekKey]) return;

      const key = weekKey + "|" + entry.segment;

      totals[key] = (totals[key] || 0) + entry.spent;

    });

  });

  return totals;

}


/**
 * ==========================================================
 * TEST — aggregateMetaSpendByWeekSegment_()
 * ==========================================================
 */
function testAggregateMetaSpendByWeekSegment(){

  const records = [
    {
      // 정밀(단일 주) 행 — 2026-08-03~08-09.
      campaignName: "KR_core_2022-01-19_book-a-consult-acqui_contact-lg",
      spent: 500,
      reportStart: new Date(2026, 7, 3),
      reportEnd: new Date(2026, 7, 9),
      campaignStart: new Date(2020, 0, 1),
      campaignEnd: null
    },
    {
      // 같은 캠페인의 장기 분배 행(2026-07-27~08-09, 2주 걸침) — 8/3주는
      // 위 정밀 행이 이미 커버하므로 그 주 기여분은 버려지고 7/27주만 채택.
      campaignName: "KR_core_2022-01-19_book-a-consult-acqui_contact-lg",
      spent: 1000,
      reportStart: new Date(2026, 6, 27),
      reportEnd: new Date(2026, 7, 9),
      campaignStart: new Date(2020, 0, 1),
      campaignEnd: null
    }
  ];

  const result = aggregateMetaSpendByWeekSegment_(records);

  const pass =
    result["2026-08-03|BOFU"] === 500 &&        // 정밀값 채택(분배 행의 500 안 더해짐)
    result["2026-07-27|BOFU"] === 500 &&        // 분배 행의 7/27주 기여분(1000/2)
    Object.keys(result).length === 2;

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Meta Spend Weekly Summary (IO 래퍼)
 * ==========================================================
 */
function computeMetaSpendWeeklySummary_(){

  return aggregateMetaSpendByWeekSegment_(readMetaRawRows_());

}


/**
 * ==========================================================
 * TEMP — computeMetaSpendWeeklySummary_() 수동 실행/확인용 공개 진입점
 * ==========================================================
 */
function runComputeMetaSpendWeeklySummary(){

  const summary = computeMetaSpendWeeklySummary_();

  Logger.log(JSON.stringify(summary, null, 2));

}


/**
 * ==========================================================
 * TEMP — Meta_Raw 첫 행 진단 (집계 결과가 빈 경우 원인 확인용)
 *
 * WHY (2026-07-30)
 * 사용자가 데이터를 붙여넣었는데 runComputeMetaSpendSummary()가 {}를
 * 반환하는 문제 발생 — 헤더명 불일치 또는 날짜 컬럼이 텍스트로 들어간
 * 경우를 눈으로 바로 확인하기 위한 진단 함수. sheetToObjects()가 실제로
 * 어떤 키/타입으로 읽는지 그대로 보여준다.
 * ==========================================================
 */
function runDebugMetaRawFirstRow(){

  const ss = SpreadsheetApp.openById(AD.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(AD.RAW_SHEET.Meta);

  if(!sheet){
    Logger.log("Meta_Raw 시트를 못 찾음 — setupMetaRawSheet() 먼저 실행하세요.");
    return;
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  Logger.log("Meta_Raw lastRow=" + lastRow + ", lastCol=" + lastCol);

  if(lastRow === 0){
    Logger.log("시트가 완전히 비어있음(헤더도 없음).");
    return;
  }

  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  Logger.log("헤더(실제 시트): " + JSON.stringify(headerRow));
  Logger.log("헤더(AD_001_Config.js 매핑 기대값): " + JSON.stringify(AD.META.COLUMNS));

  const records = sheetToObjects(sheet);

  Logger.log("sheetToObjects()로 읽은 행 수: " + records.length);

  if(records.length > 0){

    const first = records[0];
    const cols = AD.META.COLUMNS;

    Logger.log("첫 행 원본: " + JSON.stringify(first));

    Object.keys(cols).forEach(function(key){

      const headerName = cols[key];
      const value = first[headerName];

      Logger.log(
        key + " (헤더 \"" + headerName + "\") => " +
        JSON.stringify(value) + "  [type: " +
        (value instanceof Date ? "Date" : typeof value) + "]"
      );

    });

  }

}


/**
 * ==========================================================
 * TEMP — 특정 FY/Month 세그먼트별 캠페인 상세 내역 진단
 *
 * WHY (2026-07-30)
 * 사용자가 26|JUL 실제 지출(Content ≈22,922 / BOFU ≈3,904)과 집계 결과
 * (Content 27,753 / BOFU 2,999)가 서로 반대 방향으로 어긋난다고 리포트 —
 * 날짜 분배 문제라면 보통 같은 방향으로 틀리므로, 특정 캠페인이 Content↔BOFU
 * 사이에서 잘못 분류됐을 가능성이 높다. 세그먼트별로 어떤 캠페인이 얼마나
 * 잡혔는지 눈으로 확인하기 위한 진단 함수 — 대상 FY/Month는 아래 상수를
 * 직접 고쳐서 재사용.
 * ==========================================================
 */
function runDebugMetaSpendByCampaignForMonth(){

  const targetFY = 26;
  const targetMonth = "JUL";

  const records = readMetaRawRows_();
  const details = [];

  records.forEach(function(record){

    computeMetaRowMonthlySpend_(record).forEach(function(entry){

      if(entry.fy === targetFY && entry.month === targetMonth){

        details.push({
          campaign: record.campaignName,
          segment: entry.segment,
          spent: entry.spent
        });

      }

    });

  });

  details.sort(function(a, b){
    if(a.segment !== b.segment) return a.segment < b.segment ? -1 : 1;
    return b.spent - a.spent;
  });

  Logger.log("FY" + targetFY + " " + targetMonth + " — 캠페인별 기여 내역 (" + details.length + "건)");

  details.forEach(function(d){
    Logger.log(d.segment + " | " + d.spent.toFixed(2) + " | " + d.campaign);
  });

}


/**
 * ==========================================================
 * TEMP — Meta_Raw 마지막 N행 진단 (정밀 export 우선 규칙이 왜 안 먹는지 확인용)
 *
 * WHY (2026-07-30)
 * 사용자가 손으로 계산한 값(BOFU/Content)은 새로 붙여넣은 데이터와 정확히
 * 일치했는데, 실제 runComputeMetaSpendSummary() 결과는 여전히 어긋남 —
 * 즉 데이터 자체는 맞는데 코드가 이 행들을 "정밀"로 인식 못 하고 있을
 * 가능성이 높음(예: 붙여넣은 날짜가 실제 Date가 아니라 텍스트로 들어감).
 * 마지막 N행의 reportStart/reportEnd 실제 타입과 isMetaRowMonthPrecise_()
 * 판정 결과를 그대로 보여준다.
 * ==========================================================
 */
function runDebugMetaRawLastRows(){

  const n = 10;

  const ss = SpreadsheetApp.openById(AD.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(AD.RAW_SHEET.Meta);

  if(!sheet){
    Logger.log("Meta_Raw 시트를 못 찾음.");
    return;
  }

  const records = readMetaRawRows_();

  Logger.log("전체 행 수: " + records.length + " — 마지막 " + n + "행 확인");

  records.slice(-n).forEach(function(record, i){

    const precise = isMetaRowMonthPrecise_(record);

    Logger.log(
      "[" + (records.length - n + i + 1) + "] " + record.campaignName +
      " | reportStart=" + JSON.stringify(record.reportStart) +
      " (type=" + (record.reportStart instanceof Date ? "Date" : typeof record.reportStart) + ")" +
      " | reportEnd=" + JSON.stringify(record.reportEnd) +
      " (type=" + (record.reportEnd instanceof Date ? "Date" : typeof record.reportEnd) + ")" +
      " | isPrecise=" + precise
    );

  });

  // 캠페인명 중복(같은 캠페인이 lump 행과 precise 행 양쪽에 존재하는지) 확인 —
  // 이름이 한 글자라도 다르면 커버리지 매칭이 실패해 override가 안 먹는다.
  const nameCounts = {};

  records.forEach(function(record){
    nameCounts[record.campaignName] = (nameCounts[record.campaignName] || 0) + 1;
  });

  const duplicated = Object.keys(nameCounts).filter(function(name){
    return nameCounts[name] > 1;
  });

  Logger.log("2번 이상 등장하는 캠페인명 수: " + duplicated.length +
    " (0이면 이름이 안 겹쳐서 override 자체가 발동 안 될 수 있음)");

  duplicated.slice(0, 5).forEach(function(name){
    Logger.log("  중복 예시: \"" + name + "\" (" + nameCounts[name] + "회)");
  });

}
