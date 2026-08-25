/**
 * ==========================================================
 * Marketing 2.0
 * Search Merge
 *
 * Responsibility
 * Search_Engine(집계값) + 기존 Search_OPS(Manual 컬럼)를 Lead Source
 * Detail(Marketo Program 이름) 기준으로 병합. 63_BOFU_Merge.js와
 * 동일 패턴 (키 기준 Manual 컬럼 보존 + 전체 재작성).
 *
 * ⚠️ copyColumns_()/applyRatioFormulas_() 같은 범용 헬퍼는 재정의하지
 * 않고 53_Events_Merge.js 정의를 재사용.
 *
 * Version
 * v1.10.0
 *
 * Change Log
 * v1.10.0 (2026-08-25)
 * - **Google Search stats 병합 추가(4번째 플랫폼, 사용자 확정 — Search_OPS
 *   범위로만 한정)**. `buildNaverCampaignStatsLowerKeyMap_()`의 원래 본문을
 *   `buildCampaignStatsLowerKeyMap_(statsMap, overrideTable)`로 일반화하고,
 *   신규 `buildGoogleSearchCampaignStatsLowerKeyMap_()`(override 없음 —
 *   Google Search 캠페인명이 Meta처럼 Search_OPS 키와 직접 매칭됨을 사용자
 *   샘플 대조로 확인)를 추가. 신규 `mergeCampaignStatsLowerKeyMaps_()`(순수,
 *   두 lower-key 맵을 키 충돌 시 합산)로 Naver Search + Google Search 결과를
 *   합쳐 `applySearchNaverCampaignStats_()`(함수명은 하위 호환 위해 유지)에
 *   전달. `mergeSearchOPS_()`에 `googleStatsMap` 파라미터 추가(4번째 인자,
 *   선택 — 안 넘기면 기존과 동일 동작). 신규 테스트
 *   `testMergeCampaignStatsLowerKeyMaps()` PASS, 기존
 *   `testApplySearchNaverCampaignStats()` 재검증 PASS. 상세:
 *   AD_007_GoogleSearch.js/SEARCH_003_Build.js 참고.
 * v1.9.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `73_Search_Merge.js` → 신규 `SEARCH_004_Merge.js`, 코드 내용 변경 없음.
 * v1.9.0 (2026-08-09)
 * - `applySearchGroup5Derived_()` 삭제 — 비율 컬럼(CTR/CvR/CPL/CPNP1/
 *   ROAS/Match Rate)을 더 이상 JS에서 계산하지 않는다. `mergeSearchOPS_()`가
 *   정렬 후 최종 행 배열을 만든 직후 `SEARCH.RATIO_FORMULAS`
 *   (70_Search_Config.js)로 `applyRatioFormulas_()`(53_Events_Merge.js
 *   정의 재사용)를 호출해 실제 시트 수식으로 채움 — 사용자 요청(수동
 *   입력값 수정 시 자동 재계산). 출력값은 기존과 동일(분모 0 → 0
 *   fallback, 변경 없음).
 * v1.8.0 (2026-08-05)
 * - 헤더 "Results" → "Results 90D"로 개명(70_Search_Config.js v1.7.0, 사용자
 *   요청) 반영 — `applySearchNaverCampaignStats_()`의 row 대입 키,
 *   `applySearchGroup5Derived_()`의 CvR 계산(`row["Results 90D"]`), 관련
 *   테스트 픽스처 전부 갱신.
 * v1.7.0 (2026-08-05)
 * - **Search_OPS "Results" 자동화(사용자 요청)** — `buildNaverCampaignStatsLowerKeyMap_()`/
 *   `applySearchNaverCampaignStats_()`가 이제 `results`(Naver ccnt, 전환수로
 *   추정 — 실측 확인)도 함께 매칭·합산. Spent와 달리 통화 변환이 없어 FX
 *   실패 보호 로직 없이 impressions/clicks와 동일하게 항상 갱신. "Results"는
 *   70_Search_Config.js v1.6.0에서 GROUP_3_MANUAL→GROUP_3A_AUTO로 이동.
 * v1.6.0 (2026-08-05)
 * - **Search_OPS "Spent" 자동화(사용자 요청)** — `buildNaverCampaignStatsLowerKeyMap_()`/
 *   `applySearchNaverCampaignStats_()`가 이제 `spent`(NZD, 72_Search_Build.js가
 *   AD_003_NaverSearch.js `convertNaverCampaignStatsSpendToNZD_()`로 변환해 넘김)도
 *   함께 매칭·합산(충돌 시 Impressions/Link clicks와 동일하게 합산). "Spent"는
 *   70_Search_Config.js v1.5.0에서 GROUP_3_MANUAL→GROUP_3A_AUTO로 이동.
 *   `spent`가 `undefined`(72_Search_Build.js의 KRW→NZD 환율 조회 실패 시)면
 *   Spent 컬럼은 건드리지 않고 기존 값 보존 — Impressions/Link clicks는
 *   정상 갱신(0으로 잘못 덮어쓰는 것 방지).
 * v1.5.0 (2026-08-05)
 * - `NAVER_CAMPAIGN_NAME_TO_SEARCH_OPS_KEY_OVERRIDE`에 나머지 5개 캠페인 매핑
 *   추가(college-spec-1/topic-spec-1/competitions/HStoDS/expo_earlybird2 —
 *   사용자가 육안 대조 완료, 10개 전체 매핑 완료). `expo_earlybird2_ptc`는
 *   Business Segment도 함께 정정(16_TransformHelper.js v1.13.0 참고, 원래
 *   "expo" 키워드로 Seminar 오판정되고 있었음).
 * - **버그 수정 — 2개 이상의 Naver 캠페인이 같은 Search_OPS 키로 번역될 때
 *   (brand_contact + hstods_contact, 둘 다 "Naver SA Brand") 나중 처리된
 *   캠페인이 먼저 것을 조용히 덮어써 통계가 누락되던 문제**(사용자 확인 후
 *   합산으로 결정) — `buildNaverCampaignStatsLowerKeyMap_()`가 이제 충돌 시
 *   impressions/clicks를 합산, Campaign명은 " + "로 연결. 신규 테스트 케이스
 *   `testApplySearchNaverCampaignStats()`에 추가.
 * v1.4.0 (2026-08-05)
 * - **버그 수정(실측) — Naver 캠페인 실제 이름과 Search_OPS 키(Marketo Program명)가
 *   다른 네임스페이스라 직접 매칭이 거의 안 걸렸음**(사용자 확인, 10개 캠페인 중
 *   직접 일치 0개). 신규 `NAVER_CAMPAIGN_NAME_TO_SEARCH_OPS_KEY_OVERRIDE`(사용자가
 *   육안 대조해준 5개 매핑, `SEARCH_UTM_TO_PROGRAM_OVERRIDE`와 동일 관행) —
 *   `buildNaverCampaignStatsLowerKeyMap_()`가 lower-key를 만들 때 이 override로
 *   먼저 번역 후 매핑(없으면 원본 캠페인명 그대로 안전망 유지). "kr_core_study-
 *   consult_contact"는 애드그룹 단위 US/UK 혼재를 확인했으나 대부분 US라 근사치로
 *   US Marketo Program에 일괄 매핑(사용자 확정) — 애드그룹 단위 분해 가능성은
 *   TODO로 남김(주석 참고). 나머지 5개 캠페인은 매핑 미확인, 확인되는 대로 추가 예정.
 *   `testApplySearchNaverCampaignStats()`에 override 경유 케이스 추가.
 * v1.3.0 (2026-08-05)
 * - `mergeSearchOPS_()`에 `naverStatsMap` 파라미터 추가(선택) — Naver Search
 *   Ad API 누적 캐시(AD_003_NaverSearch.js)와 Search_OPS 키를 대소문자 무시
 *   매칭해 Campaign/Impressions/Link clicks(신규 GROUP_3A_AUTO, 70_Search_
 *   Config.js v1.4.0)를 자동으로 채움(사용자 요청). 매칭 안 되면 기존 값
 *   그대로 유지(`copyColumns_()` fallback 이후 덮어쓰기 시도만 함). 신규
 *   `buildNaverCampaignStatsLowerKeyMap_()`/`applySearchNaverCampaignStats_()`,
 *   `applySearchNewRowDefaults_()`도 GROUP_3A_AUTO 초기화 포함하도록 수정.
 *   신규 테스트 `testApplySearchNaverCampaignStats()` PASS. 상세:
 *   72_Search_Build.js/AD_003_NaverSearch.js 참고.
 * v1.2.0 (2026-07-29)
 * - compareByStartDateBlankFirstSearch_() → compareByStartDateBlankLastSearch_()
 *   로 교체 — 빈 Start Date를 최상단이 아닌 최하단으로(사용자 확인: 이번
 *   세션 신규 키들이 Start Date 미기입이라 최상단을 다 차지하던 문제).
 *   BOFU/Events/Content/Leads_OPS도 동일하게 통일. 테스트 함수명 끝 "_"도
 *   같이 제거(Run 드롭다운 노출).
 * v1.1.0 (2026-07-29)
 * - applySearchNewRowDefaults_()의 Channel 기본값을 무조건 "Meta"에서
 *   resolveSearchChannelFromKey_()(71_Search_Engine.js) 기반으로 교체 —
 *   신규 Naver SA/Google SA Program 키는 실제 채널로 자동 설정(사용자 요청).
 * v1.0.0
 * - 최초 구현.
 * ==========================================================
 */

/**
 * ==========================================================
 * Merge Campaign Stats Lower-Key Maps (순수 함수, 2026-08-25 신규)
 *
 * WHY
 * Search_OPS GROUP_3A_AUTO가 이제 Naver Search + Google Search 2개 플랫폼의
 * stats를 같은 컬럼에 합쳐서 보여줘야 함(사용자 확정 — 별도 컬럼 분리
 * 없이 그대로 합산, ACQ_REP "Spent" 컬럼이 Meta+Naver Search를 이미 합쳐서
 * 보여주는 것과 동일 관행). 두 lower-key 맵을 같은 키(같은 Search_OPS
 * 캠페인) 충돌 시 합산(impressions/clicks/results/spent 전부 더하고, name은
 * " + "로 연결)하는 동일 규칙을 buildCampaignStatsLowerKeyMap_() 내부
 * 충돌 처리와 맞춰 재사용.
 *
 * INPUT
 * mapA, mapB : Object  {lowerKey: {name, impressions, clicks, spent, results}}
 *
 * OUTPUT
 * Object  같은 형태, 두 맵 병합 결과(원본 불변)
 *
 * TEST
 * testMergeCampaignStatsLowerKeyMaps() 참고
 * ==========================================================
 */
function mergeCampaignStatsLowerKeyMaps_(mapA, mapB) {

  const result = {};

  Object.keys(mapA || {}).forEach(function (key) { result[key] = mapA[key]; });

  Object.keys(mapB || {}).forEach(function (key) {

    const b = mapB[key];
    const a = result[key];

    if (!a) {
      result[key] = b;
      return;
    }

    const combinedSpent = (a.spent === undefined && b.spent === undefined)
      ? undefined
      : ((a.spent || 0) + (b.spent || 0));

    result[key] = {
      name: a.name + " + " + b.name,
      impressions: a.impressions + b.impressions,
      clicks: a.clicks + b.clicks,
      spent: combinedSpent,
      results: a.results + b.results
    };

  });

  return result;

}


/**
 * ==========================================================
 * TEST — mergeCampaignStatsLowerKeyMaps_()
 * ==========================================================
 */
function testMergeCampaignStatsLowerKeyMaps() {

  const mapA = {
    "campaign x": { name: "Campaign X", impressions: 100, clicks: 10, spent: 50, results: 2 },
    "campaign y": { name: "Campaign Y", impressions: 200, clicks: 20, spent: undefined, results: 1 }
  };

  const mapB = {
    "campaign x": { name: "Campaign X (Google)", impressions: 300, clicks: 30, spent: 75, results: 4 },
    "campaign z": { name: "Campaign Z", impressions: 400, clicks: 40, spent: 20, results: 3 }
  };

  const merged = mergeCampaignStatsLowerKeyMaps_(mapA, mapB);

  const pass =
    Object.keys(merged).length === 3 &&
    merged["campaign x"].name === "Campaign X + Campaign X (Google)" &&
    merged["campaign x"].impressions === 400 &&
    merged["campaign x"].clicks === 40 &&
    merged["campaign x"].spent === 125 &&
    merged["campaign x"].results === 6 &&
    merged["campaign y"].spent === undefined &&
    merged["campaign y"].impressions === 200 &&
    merged["campaign z"].name === "Campaign Z" &&
    merged["campaign z"].impressions === 400;

  Logger.log("Merged: " + JSON.stringify(merged));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Merge Search_Engine + Existing Search_OPS
 *
 * `naverStatsMap`(선택, 2026-08-05 신규): {campaignName: {impressions, clicks, spent}}
 * (AD_003_NaverSearch.js의 `readNaverSearchAdCampaignStatsCache_()` →
 * `convertNaverCampaignStatsSpendToNZD_()`로 spent를 NZD 변환한 결과, 72_Search_
 * Build.js 참고) — 넘기면 Search_OPS 키와 대소문자/공백 무시 매칭되는 캠페인의
 * Campaign/Impressions/Link clicks/Spent(GROUP_3A_AUTO)를 자동으로 덮어씀.
 * 안 넘기거나(undefined) 매칭이 없으면 기존 값(수동 입력 또는 빈 값) 그대로
 * 유지 — 사용자 요청.
 *
 * `googleStatsMap`(선택, 2026-08-25 신규): {campaignName: {impressions, clicks,
 * spent, results}} (AD_007_GoogleSearch.js의 `computeGoogleSearchStatsSummary_()`
 * 결과, Cost가 이미 NZD라 환율 변환 없음) — naverStatsMap과 같은 Search_OPS
 * 키로 매칭되면 mergeCampaignStatsLowerKeyMaps_()로 합산, 서로 다른 키면
 * 둘 다 독립적으로 반영.
 * ==========================================================
 */
function mergeSearchOPS_(existingOps, engineMap, naverStatsMap, googleStatsMap) {

  const existingMap = createSearchKeyMap_(existingOps);

  const naverStatsLower = buildNaverCampaignStatsLowerKeyMap_(naverStatsMap);
  const googleStatsLower = buildGoogleSearchCampaignStatsLowerKeyMap_(googleStatsMap);
  const combinedStatsLower = mergeCampaignStatsLowerKeyMaps_(naverStatsLower, googleStatsLower);

  const allKeys = {};

  Object.keys(engineMap).forEach(function (key) { allKeys[key] = true; });
  Object.keys(existingMap).forEach(function (key) { allKeys[key] = true; });

  const summary = {
    engine: Object.keys(engineMap).length,
    existing: existingOps.length,
    merged: 0,
    updated: 0,
    new: 0
  };

  const rowObjects = Object.keys(allKeys).map(function (key) {

    const existing = existingMap[key];
    const engineRow = engineMap[key];

    const row = {};
    row[SEARCH.KEY] = key;

    if (existing) {

      copyColumns_(row, existing, SEARCH.GROUP_1_MANUAL);
      copyColumns_(row, existing, SEARCH.GROUP_2_MANUAL);
      copyColumns_(row, existing, SEARCH.GROUP_3_MANUAL);
      copyColumns_(row, existing, SEARCH.GROUP_3A_AUTO);

      summary.updated++;

    } else {

      applySearchNewRowDefaults_(row, key);

      summary.new++;

    }

    applySearchNaverCampaignStats_(row, key, combinedStatsLower);
    applySearchGroup4Computed_(row, engineRow);
    applySearchDerivedDateColumns_(row);

    summary.merged++;

    return row;

  });

  rowObjects.sort(compareByStartDateBlankLastSearch_);

  const rows = rowObjects.map(function (row) {
    return SEARCH.HEADER.map(function (col) { return row[col]; });
  });

  applyRatioFormulas_(rows, SEARCH.HEADER, SEARCH.RATIO_FORMULAS, SEARCH.ROWS.DATA_START);

  return { rows: rows, summary: summary };

}


/**
 * ==========================================================
 * Apply Search New Row Defaults (신규 발견 Lead Source Detail)
 *
 * 2026-07-29: Channel 기본값을 무조건 "Meta"로 두던 걸 resolveSearchChannel
 * FromKey_()(71_Search_Engine.js)로 교체 — key가 Naver/Google SA Program명
 * 또는 "Google UTM" placeholder면 실제 채널(Naver Search/Google Search)로
 * 설정, 그 외는 기존처럼 "Meta" 유지(사용자 확정).
 * ==========================================================
 */
function applySearchNewRowDefaults_(row, key) {

  SEARCH.GROUP_1_MANUAL.forEach(function (col) { row[col] = ""; });
  SEARCH.GROUP_2_MANUAL.forEach(function (col) { row[col] = ""; });
  SEARCH.GROUP_3_MANUAL.forEach(function (col) { row[col] = ""; });
  SEARCH.GROUP_3A_AUTO.forEach(function (col) { row[col] = ""; });

  row["Marketo Campaign name"] = key;
  row["Channel"] = resolveSearchChannelFromKey_(key);

}


/**
 * ==========================================================
 * Naver Campaign Name → Search_OPS Key Override (2026-08-05)
 *
 * WHY
 * Naver Search Ad 캠페인의 실제 이름(예: "KR_core_brand_contact")과
 * Search_OPS 키(Marketo Program명, 예: "2025-07-KOR-Naver SA Brand")는
 * 서로 다른 네임스페이스라 직접 매칭이 안 됨(사용자 확인, 2026-08-05) —
 * 71_Search_Engine.js의 `SEARCH_UTM_TO_PROGRAM_OVERRIDE`와 동일한 관행으로
 * 사용자가 육안 대조해준 매핑을 그대로 반영(캠페인 10개 중 5개만 매핑 확정,
 * 나머지는 아래 주석 참고).
 *
 * **"kr_core_study-consult_contact"는 근사치임(사용자 확정)**: 이 캠페인은
 * Naver 콘솔에서 애드그룹 단위로 US/UK 리드가 섞여 있어 정확히 분리
 * 불가능 — 대부분 US라 일괄 US Marketo Program에 매핑하기로 사용자가
 * 결정. **TODO(2026-08-05)**: 애드그룹 단위 stats 조회 가능 여부 검토
 * (Naver Search Ad API가 adgroup id 기준 `/stats`를 지원하는지 확인) —
 * 가능하면 US/UK 분리, 안 되면 Naver 콘솔에서 캠페인 자체를 US/UK 2개로
 * 나누는 방안(광고 운영 조치, 코드 밖)을 사용자가 검토하기로 함.
 *
 * **나머지 5개도 2026-08-05 사용자 확인으로 매핑 완료**(college-spec-1/
 * topic-spec-1/competitions/HStoDS/expo_earlybird2). `expo_earlybird2_ptc`는
 * 원래 getBusinessSegment()가 "expo" 키워드로 Seminar 우선 판정하고 있었으나
 * 실제로는 Search가 맞다는 게 이번에 확인돼 `BUSINESS_SEGMENT_EXCEPTIONS`
 * (16_TransformHelper.js)에도 별도로 반영함(Search_Engine이 Business
 * Segment=Search만 집계하므로, 여기 override만으로는 부족).
 *
 * **`kr_core_hstods_contact`가 `kr_core_brand_contact`와 같은 Search_OPS
 * 키("2025-07-KOR-Naver SA Brand")를 공유함**(사용자 확인 — 실제로 같은
 * Marketo Program으로 들어가는 캠페인 2개) — 이 경우 Impressions/Link
 * clicks는 두 캠페인 합산, Campaign 표시명은 " + "로 이어붙임
 * (`buildNaverCampaignStatsLowerKeyMap_()` 참고, 원래는 나중 처리된 캠페인이
 * 먼저 것을 조용히 덮어쓰는 버그가 있었음 — 2026-08-05 수정).
 * ==========================================================
 */
const NAVER_CAMPAIGN_NAME_TO_SEARCH_OPS_KEY_OVERRIDE = {
  "kr_core_brand_contact": "2025-07-KOR-Naver SA Brand",
  "kr_core_transfer-gap-year-kr": "2025-11-KOR-Naver SA Transfer and Gap Year",
  "kr_core_competitors_contact": "2025-07-KOR-Naver SA Competitor",
  "kr_core_ecl-consult_contact": "2025-07-KOR-Naver SA ECL",
  "kr_core_study-consult_contact": "2025-07-KOR-Naver SA Study Consultants US",
  "kr_core_college-spec-1_contact": "2025-07-KOR-Naver SA College Specific",
  "kr_core_topic-spec-1_contact": "2025-07-KOR-Naver SA UK Meds",
  "kr_core_competitions_contact": "2025-07-KOR-Naver SA Competitions",
  "kr_core_hstods_contact": "2025-07-KOR-Naver SA Brand",
  "kr_core_expo_earlybird2_ptc": "WF-2026-03-KOR-MOFU-Core Expo Naver Search"
};


/**
 * ==========================================================
 * Build Naver Campaign Stats Lower-Key Map (순수 함수)
 *
 * WHY
 * Search_OPS 키(Marketo Program명)와 Naver 캠페인 실제 이름이 다른
 * 네임스페이스라(위 NAVER_CAMPAIGN_NAME_TO_SEARCH_OPS_KEY_OVERRIDE 참고),
 * override에 있으면 번역된 Search_OPS 키로, 없으면 원본 캠페인명 그대로
 * lower-key 맵의 키로 사용(override 없는 값도 Search_OPS 키가 우연히
 * 원본 캠페인명과 같은 경우를 위한 안전망 — 매 행마다 원본 맵을 다시
 * 스캔하지 않도록 한 번만 변환). **2개 이상의 Naver 캠페인이 같은
 * Search_OPS 키로 번역되는 경우(예: brand_contact + hstods_contact →
 * 둘 다 "Naver SA Brand") impressions/clicks/spent/results는 합산, name은
 * " + "로 이어붙임**(2026-08-05 수정 — 원래는 나중 처리된 캠페인이 먼저 것을
 * 조용히 덮어써 통계가 누락되는 버그였음, 사용자 확인 후 합산으로 결정).
 * **spent는 naverStatsMap 항목에 그 키 자체가 없으면 `undefined`로 통과**
 * (0으로 강제하지 않음) — 72_Search_Build.js가 KRW→NZD 환율 조회 실패 시
 * spent 변환 자체를 건너뛰므로, 이 경우 Search_OPS의 기존 Spent 값을 0으로
 * 덮어쓰지 않고 그대로 보존해야 하기 때문(`applySearchNaverCampaignStats_`
 * 참고 — `match.spent === undefined`면 Spent 컬럼을 건드리지 않음). results는
 * 통화 변환이 없어 이런 보호가 필요 없음 — impressions/clicks와 동일하게
 * 항상 숫자로 합산(2026-08-05 추가).
 *
 * INPUT
 * naverStatsMap : Object|undefined  {campaignName: {impressions, clicks, spent?, results}}
 *
 * OUTPUT
 * Object  {lowerSearchOpsKey: {name, impressions, clicks, spent, results}}
 *   (name은 Search_OPS Campaign 컬럼에 그대로 쓸 원본 Naver 캠페인명, 충돌 시
 *   " + "로 연결된 복수 캠페인명. spent는 입력 전체에 spent가 없으면
 *   undefined로 유지, 하나라도 있으면 없는 쪽을 0으로 간주해 합산)
 *
 * TEST
 * testApplySearchNaverCampaignStats() 참고
 * ==========================================================
 */
function buildNaverCampaignStatsLowerKeyMap_(naverStatsMap) {

  return buildCampaignStatsLowerKeyMap_(naverStatsMap, NAVER_CAMPAIGN_NAME_TO_SEARCH_OPS_KEY_OVERRIDE);

}


/**
 * ==========================================================
 * Build Google Search Campaign Stats Lower-Key Map (순수 함수, 2026-08-25)
 *
 * WHY
 * Google Search 캠페인명(예: "KR_core_2021-04-01_search-kr_brand-crimson_
 * contact")은 Meta와 동일하게 `KR_core_YYYY-MM-DD_slug_tag` 네이밍을 쓰고,
 * 사용자가 대조한 실 샘플에서 다수가 Search_OPS 키(Lead Source Detail)와
 * 이미 그대로 일치함을 확인(2026-08-25) — Naver Search 같은 별도 override
 * 테이블이 필요 없음(캠페인 수가 많아 전수 육안 대조도 비현실적). 매칭 안
 * 되는 캠페인은 buildCampaignStatsLowerKeyMap_()의 기존 안전망(override
 * 없으면 원본 캠페인명 그대로 키로 사용)에 따라 그냥 매칭 실패로 남고,
 * applySearchNaverCampaignStats_()가 기존 값을 그대로 보존한다(정상 동작).
 * ==========================================================
 */
function buildGoogleSearchCampaignStatsLowerKeyMap_(googleStatsMap) {

  return buildCampaignStatsLowerKeyMap_(googleStatsMap, {});

}


/**
 * ==========================================================
 * Build Campaign Stats Lower-Key Map (순수 함수, 제너릭 — 2026-08-25 도입)
 *
 * WHY
 * buildNaverCampaignStatsLowerKeyMap_()의 원래 본문을 override 테이블을
 * 파라미터로 받도록 일반화 — Naver Search(override 테이블 있음)/Google
 * Search(override 없음, 직접 매칭)가 동일 로직을 공유한다.
 * ==========================================================
 */
function buildCampaignStatsLowerKeyMap_(statsMap, overrideTable) {

  const lower = {};

  Object.keys(statsMap || {}).forEach(function (name) {

    const searchOpsKey =
      (overrideTable || {})[name.trim().toLowerCase()] || name;

    const lowerKey = searchOpsKey.trim().toLowerCase();
    const existing = lower[lowerKey];
    const rawSpent = statsMap[name].spent;
    const spent = rawSpent === undefined ? undefined : (Number(rawSpent) || 0);
    const results = Number(statsMap[name].results) || 0;

    const combinedSpent = (existing && existing.spent === undefined && spent === undefined)
      ? undefined
      : ((existing ? (existing.spent || 0) : 0) + (spent || 0));

    lower[lowerKey] = existing ? {
      name: existing.name + " + " + name,
      impressions: existing.impressions + statsMap[name].impressions,
      clicks: existing.clicks + statsMap[name].clicks,
      spent: combinedSpent,
      results: existing.results + results
    } : {
      name: name,
      impressions: statsMap[name].impressions,
      clicks: statsMap[name].clicks,
      spent: spent,
      results: results
    };

  });

  return lower;

}


/**
 * ==========================================================
 * Apply Search Naver Campaign Stats (GROUP_3A_AUTO 자동 매칭 덮어쓰기)
 *
 * WHY
 * Search_OPS 키가 캠페인 실제 이름과 매칭되면 Campaign/Impressions/
 * Link clicks/Spent/Results(2026-08-05 추가)를 캐시값으로 덮어쓴다. 매칭
 * 안 되면 아무것도 하지 않음 — 호출 시점에 row에 이미 들어있는 값(기존
 * 행이면 copyColumns_()로 복사된 이전 값, 신규 행이면
 * applySearchNewRowDefaults_()가 채운 빈 문자열)을 그대로 유지(사용자 요청
 * — "매칭되는 것만 자동, 나머지는 그대로"). **`match.spent`가 `undefined`면
 * Spent 컬럼은 건드리지 않음**(72_Search_Build.js가 KRW→NZD 환율 조회 실패
 * 시 spent 변환을 건너뛰는 경우 — Campaign/Impressions/Link clicks/Results는
 * 정상 갱신하되 Spent는 기존 값을 0으로 잘못 덮어쓰지 않도록 보호).
 *
 * **2026-08-25**: 함수명은 그대로 유지하지만(하위 호환), 넘어오는
 * `statsLower`는 이제 Naver Search 단독이 아니라 mergeSearchOPS_()가
 * mergeCampaignStatsLowerKeyMaps_()로 Naver Search + Google Search를 합쳐
 * 넘기는 combinedStatsLower — 함수 자체는 출처 플랫폼을 몰라도 되므로
 * 동작 변경 없음.
 * ==========================================================
 */
function applySearchNaverCampaignStats_(row, key, naverStatsLower) {

  const match = naverStatsLower[String(key || "").trim().toLowerCase()];

  if (!match) return;

  row["Campaign"] = match.name;
  row["Impressions"] = match.impressions;
  row["Link clicks"] = match.clicks;
  row["Results 90D"] = match.results;

  if (match.spent !== undefined) row["Spent"] = match.spent;

}


/**
 * ==========================================================
 * TEST — buildNaverCampaignStatsLowerKeyMap_() / applySearchNaverCampaignStats_()
 * ==========================================================
 */
function testApplySearchNaverCampaignStats() {

  const naverStatsMap = {
    "2025-07-KOR-Naver SA Brand": { impressions: 1000, clicks: 50, results: 8 }, // Search_OPS 키와 이미 동일(direct match), spent 필드 없음 — FX 실패 시나리오 검증
    "KR_core_ecl-consult_contact": { impressions: 300, clicks: 20, spent: 12.5, results: 3 } // override 번역 필요
  };

  const lower = buildNaverCampaignStatsLowerKeyMap_(naverStatsMap);

  // 매칭 케이스 (대소문자/공백 무시, direct) — spent 필드 없는 입력(FX 조회 실패
  // 시나리오)은 기존 Spent 값을 그대로 보존해야 함(0으로 덮어쓰면 안 됨).
  // results는 FX와 무관해 항상 갱신돼야 함.
  const matchedRow = { "Campaign": "old", "Impressions": 1, "Link clicks": 1, "Spent": 42, "Results 90D": 1 };
  applySearchNaverCampaignStats_(matchedRow, "  2025-07-kor-naver sa brand  ", lower);

  const matchedPass =
    matchedRow["Campaign"] === "2025-07-KOR-Naver SA Brand" &&
    matchedRow["Impressions"] === 1000 &&
    matchedRow["Link clicks"] === 50 &&
    matchedRow["Spent"] === 42 &&
    matchedRow["Results 90D"] === 8;

  // 매칭 케이스 (override 번역 경유) — Search_OPS 키 "2025-07-KOR-Naver SA ECL"로
  // 조회하면 원본 캠페인명 "KR_core_ecl-consult_contact"의 값을 찾아와야 함
  const overrideRow = { "Campaign": "old2", "Impressions": 1, "Link clicks": 1, "Spent": 1, "Results 90D": 1 };
  applySearchNaverCampaignStats_(overrideRow, "2025-07-KOR-Naver SA ECL", lower);

  const overridePass =
    overrideRow["Campaign"] === "KR_core_ecl-consult_contact" &&
    overrideRow["Impressions"] === 300 &&
    overrideRow["Link clicks"] === 20 &&
    overrideRow["Spent"] === 12.5 &&
    overrideRow["Results 90D"] === 3;

  // 매칭 안 되는 케이스 — 기존 값 그대로 유지돼야 함
  const unmatchedRow = { "Campaign": "manual entry", "Impressions": 5, "Link clicks": 2, "Spent": 3, "Results 90D": 1 };
  applySearchNaverCampaignStats_(unmatchedRow, "Google UTM", lower);

  const unmatchedPass =
    unmatchedRow["Campaign"] === "manual entry" &&
    unmatchedRow["Impressions"] === 5 &&
    unmatchedRow["Link clicks"] === 2 &&
    unmatchedRow["Spent"] === 3 &&
    unmatchedRow["Results 90D"] === 1;

  // 충돌 케이스 (2026-08-05) — kr_core_brand_contact와 kr_core_hstods_contact
  // 둘 다 "2025-07-KOR-Naver SA Brand"로 번역됨 → 합산돼야 함(덮어쓰기 아님)
  const collisionStatsMap = {
    "KR_core_brand_contact": { impressions: 1000, clicks: 50, spent: 100, results: 5 },
    "KR_core_HStoDS_contact": { impressions: 300, clicks: 20, spent: 40, results: 2 }
  };
  const collisionLower = buildNaverCampaignStatsLowerKeyMap_(collisionStatsMap);
  const collisionRow = { "Campaign": "old3", "Impressions": 1, "Link clicks": 1, "Spent": 1, "Results 90D": 1 };
  applySearchNaverCampaignStats_(collisionRow, "2025-07-KOR-Naver SA Brand", collisionLower);

  const collisionPass =
    collisionRow["Campaign"] === "KR_core_brand_contact + KR_core_HStoDS_contact" &&
    collisionRow["Impressions"] === 1300 &&
    collisionRow["Link clicks"] === 70 &&
    collisionRow["Spent"] === 140 &&
    collisionRow["Results 90D"] === 7;

  const pass = matchedPass && overridePass && unmatchedPass && collisionPass;

  Logger.log(
    "matchedRow=" + JSON.stringify(matchedRow) +
    " overrideRow=" + JSON.stringify(overrideRow) +
    " unmatchedRow=" + JSON.stringify(unmatchedRow) +
    " collisionRow=" + JSON.stringify(collisionRow)
  );
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Apply Search Group 4 (SF Computed, Engine 원본값)
 * ==========================================================
 */
function applySearchGroup4Computed_(row, engineRow) {

  SEARCH.GROUP_4_COMPUTED.forEach(function (col) {
    row[col] = (engineRow && Number(engineRow[col])) || 0;
  });

}


/**
 * ==========================================================
 * Apply Search Derived Date Columns (FY / Month from Start Date)
 * ==========================================================
 */
function applySearchDerivedDateColumns_(row) {

  const startDate = row["Start Date"];
  const validDate = startDate instanceof Date && !isNaN(startDate.getTime());

  row["FY"] = validDate ? getFiscalYear(startDate) : "";
  row["Month"] = validDate ? getMonthText(startDate) : "";

}


/**
 * ==========================================================
 * Compare Rows By Start Date (빈 날짜 최하단, 나머지는 내림차순 — 2026-07-29)
 *
 * WHY
 * 원래 빈 날짜가 최상단이었으나(Events 최초 패턴 그대로 상속), 이번 세션에
 * 신규 생성된 키(Naver SA/Google UTM/Organic Search 등 Start Date 미기입)
 * 가 대거 최상단을 차지해 실제 데이터 있는 캠페인들을 밀어내는 문제 발견
 * (사용자 확인) — 빈 날짜를 최하단으로 이동. 다른 OPS(BOFU/Events/Content/
 * Leads)도 동일하게 통일(사용자 확정, 일관성).
 *
 * TEST
 * testCompareByStartDateBlankLastSearch 참고
 * ==========================================================
 */
function compareByStartDateBlankLastSearch_(a, b) {

  const dateA = a["Start Date"];
  const dateB = b["Start Date"];

  const validA = dateA instanceof Date && !isNaN(dateA.getTime());
  const validB = dateB instanceof Date && !isNaN(dateB.getTime());

  if (!validA && !validB) return 0;
  if (!validA) return 1;
  if (!validB) return -1;

  return dateB.getTime() - dateA.getTime();

}


/**
 * ==========================================================
 * TEST — compareByStartDateBlankLastSearch_()
 * ==========================================================
 */
function testCompareByStartDateBlankLastSearch() {

  const rows = [
    { "Lead Source Detail": "old", "Start Date": new Date(2026, 0, 1) },
    { "Lead Source Detail": "blank1", "Start Date": "" },
    { "Lead Source Detail": "new", "Start Date": new Date(2026, 5, 1) },
    { "Lead Source Detail": "blank2", "Start Date": "" }
  ];

  rows.sort(compareByStartDateBlankLastSearch_);

  const order = rows.map(function (r) { return r["Lead Source Detail"]; });

  const pass =
    order[0] === "new" && order[1] === "old" &&
    order[2] === "blank1" && order[3] === "blank2";

  Logger.log("Order: " + JSON.stringify(order));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Create Key Lookup Map (Lead Source Detail 기준, first-seen-wins)
 * ==========================================================
 */
function createSearchKeyMap_(rows) {

  const map = {};

  rows.forEach(function (row) {

    const key = String(row[SEARCH.KEY] || "").trim();

    if (!key) return;

    if (!map[key]) {
      map[key] = row;
    }

  });

  return map;

}


/**
 * ==========================================================
 * Read Existing Search_OPS
 * ==========================================================
 */
function readSearchOPS_() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SEARCH.SHEET.OPS);

  if (!sheet) return [];

  if (sheet.getLastRow() < SEARCH.ROWS.HEADER) return [];

  const values = sheet.getDataRange().getValues();

  const headerIndex = SEARCH.ROWS.HEADER - 1;

  if (values.length <= headerIndex) return [];

  const headers = values[headerIndex];

  const objects = [];

  for (let r = headerIndex + 1; r < values.length; r++) {

    const obj = {};

    headers.forEach(function (header, c) {
      obj[String(header).trim()] = values[r][c];
    });

    objects.push(obj);

  }

  return objects;

}
