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
 * ⚠️ divideGuard_()/copyColumns_() 같은 범용 헬퍼는 재정의하지 않고
 * 53_Events_Merge.js 정의를 재사용.
 *
 * Version
 * v1.4.0
 *
 * Change Log
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
 * Merge Search_Engine + Existing Search_OPS
 *
 * `naverStatsMap`(선택, 2026-08-05 신규): {campaignName: {impressions, clicks}}
 * (AD_003_NaverSearch.js의 `readNaverSearchAdCampaignStatsCache_()`) — 넘기면
 * Search_OPS 키와 대소문자/공백 무시 매칭되는 캠페인의 Campaign/Impressions/
 * Link clicks(GROUP_3A_AUTO)를 자동으로 덮어씀. 안 넘기거나(undefined) 매칭이
 * 없으면 기존 값(수동 입력 또는 빈 값) 그대로 유지 — 사용자 요청.
 * ==========================================================
 */
function mergeSearchOPS_(existingOps, engineMap, naverStatsMap) {

  const existingMap = createSearchKeyMap_(existingOps);
  const naverStatsLower = buildNaverCampaignStatsLowerKeyMap_(naverStatsMap);

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

    applySearchNaverCampaignStats_(row, key, naverStatsLower);
    applySearchGroup4Computed_(row, engineRow);
    applySearchGroup5Derived_(row);
    applySearchDerivedDateColumns_(row);

    summary.merged++;

    return row;

  });

  rowObjects.sort(compareByStartDateBlankLastSearch_);

  const rows = rowObjects.map(function (row) {
    return SEARCH.HEADER.map(function (col) { return row[col]; });
  });

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
 * **나머지 5개는 매핑 미확인**(KR_core_college-spec-1_contact/
 * topic-spec-1_contact/competitions_contact/HStoDS_contact/
 * expo_earlybird2_ptc) — 대응하는 Marketo Program을 사용자가 아직
 * 확인 안 함. 여기 없으면 자동 매칭이 안 걸리고(기존 값 그대로 유지)
 * Search_OPS 쪽에서 계속 수동 입력 — 확인되는 대로 추가할 것.
 * ==========================================================
 */
const NAVER_CAMPAIGN_NAME_TO_SEARCH_OPS_KEY_OVERRIDE = {
  "kr_core_brand_contact": "2025-07-KOR-Naver SA Brand",
  "kr_core_transfer-gap-year-kr": "2025-11-KOR-Naver SA Transfer and Gap Year",
  "kr_core_competitors_contact": "2025-07-KOR-Naver SA Competitor",
  "kr_core_ecl-consult_contact": "2025-07-KOR-Naver SA ECL",
  "kr_core_study-consult_contact": "2025-07-KOR-Naver SA Study Consultants US"
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
 * 스캔하지 않도록 한 번만 변환).
 *
 * INPUT
 * naverStatsMap : Object|undefined  {campaignName: {impressions, clicks}}
 *
 * OUTPUT
 * Object  {lowerSearchOpsKey: {name, impressions, clicks}}  (name은
 *   Search_OPS Campaign 컬럼에 그대로 쓸 원본 Naver 캠페인명)
 *
 * TEST
 * testApplySearchNaverCampaignStats() 참고
 * ==========================================================
 */
function buildNaverCampaignStatsLowerKeyMap_(naverStatsMap) {

  const lower = {};

  Object.keys(naverStatsMap || {}).forEach(function (name) {

    const searchOpsKey =
      NAVER_CAMPAIGN_NAME_TO_SEARCH_OPS_KEY_OVERRIDE[name.trim().toLowerCase()] || name;

    lower[searchOpsKey.trim().toLowerCase()] = {
      name: name,
      impressions: naverStatsMap[name].impressions,
      clicks: naverStatsMap[name].clicks
    };

  });

  return lower;

}


/**
 * ==========================================================
 * Apply Search Naver Campaign Stats (GROUP_3A_AUTO 자동 매칭 덮어쓰기)
 *
 * WHY
 * Search_OPS 키가 Naver 캠페인 실제 이름과 매칭되면 Campaign/Impressions/
 * Link clicks를 캐시값으로 덮어쓴다. 매칭 안 되면 아무것도 하지 않음 —
 * 호출 시점에 row에 이미 들어있는 값(기존 행이면 copyColumns_()로 복사된
 * 이전 값, 신규 행이면 applySearchNewRowDefaults_()가 채운 빈 문자열)을
 * 그대로 유지(사용자 요청 — "매칭되는 것만 자동, 나머지는 그대로").
 * ==========================================================
 */
function applySearchNaverCampaignStats_(row, key, naverStatsLower) {

  const match = naverStatsLower[String(key || "").trim().toLowerCase()];

  if (!match) return;

  row["Campaign"] = match.name;
  row["Impressions"] = match.impressions;
  row["Link clicks"] = match.clicks;

}


/**
 * ==========================================================
 * TEST — buildNaverCampaignStatsLowerKeyMap_() / applySearchNaverCampaignStats_()
 * ==========================================================
 */
function testApplySearchNaverCampaignStats() {

  const naverStatsMap = {
    "2025-07-KOR-Naver SA Brand": { impressions: 1000, clicks: 50 }, // Search_OPS 키와 이미 동일(direct match)
    "KR_core_ecl-consult_contact": { impressions: 300, clicks: 20 } // override 번역 필요
  };

  const lower = buildNaverCampaignStatsLowerKeyMap_(naverStatsMap);

  // 매칭 케이스 (대소문자/공백 무시, direct)
  const matchedRow = { "Campaign": "old", "Impressions": 1, "Link clicks": 1 };
  applySearchNaverCampaignStats_(matchedRow, "  2025-07-kor-naver sa brand  ", lower);

  const matchedPass =
    matchedRow["Campaign"] === "2025-07-KOR-Naver SA Brand" &&
    matchedRow["Impressions"] === 1000 &&
    matchedRow["Link clicks"] === 50;

  // 매칭 케이스 (override 번역 경유) — Search_OPS 키 "2025-07-KOR-Naver SA ECL"로
  // 조회하면 원본 캠페인명 "KR_core_ecl-consult_contact"의 값을 찾아와야 함
  const overrideRow = { "Campaign": "old2", "Impressions": 1, "Link clicks": 1 };
  applySearchNaverCampaignStats_(overrideRow, "2025-07-KOR-Naver SA ECL", lower);

  const overridePass =
    overrideRow["Campaign"] === "KR_core_ecl-consult_contact" &&
    overrideRow["Impressions"] === 300 &&
    overrideRow["Link clicks"] === 20;

  // 매칭 안 되는 케이스 — 기존 값 그대로 유지돼야 함
  const unmatchedRow = { "Campaign": "manual entry", "Impressions": 5, "Link clicks": 2 };
  applySearchNaverCampaignStats_(unmatchedRow, "Google UTM", lower);

  const unmatchedPass =
    unmatchedRow["Campaign"] === "manual entry" &&
    unmatchedRow["Impressions"] === 5 &&
    unmatchedRow["Link clicks"] === 2;

  const pass = matchedPass && overridePass && unmatchedPass;

  Logger.log(
    "matchedRow=" + JSON.stringify(matchedRow) +
    " overrideRow=" + JSON.stringify(overrideRow) +
    " unmatchedRow=" + JSON.stringify(unmatchedRow)
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
 * Apply Search Group 5 (Derived — CTR/CvR/CPL/CPNP1/ROAS/Match Rate)
 * ==========================================================
 */
function applySearchGroup5Derived_(row) {

  row["CTR"] = divideGuard_(row["Link clicks"], row["Impressions"]);
  row["CvR"] = divideGuard_(row["Results"], row["Link clicks"]);
  row["CPL"] = divideGuard_(row["Spent"], row["TotalReg."]);
  row["CPNP1"] = divideGuard_(row["Spent"], row["SF NLP1s"]);
  row["ROAS"] = divideGuard_(row["Revenue"], row["Spent"]);
  row["Match Rate"] = divideGuard_(row["SF Reg."], row["TotalReg."]);

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
