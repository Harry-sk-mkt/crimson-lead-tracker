/**
 * ==========================================================
 * Marketing 2.0
 * Ad Spend — Google Search Import/Transform (4번째 플랫폼)
 *
 * Responsibility
 * GoogleSearch_Raw(사용자가 Google Ads 검색광고 리포트를 수동으로
 * 붙여넣는 시트, AD.SPREADSHEET_ID)를 읽어 캠페인별 Impressions/Clicks/
 * Spent/Results로 집계한다.
 *
 * **범위 축소(2026-08-25 사용자 확정)**: Meta/Naver Search와 달리 FY/Month
 * 집계는 하지 않는다 — Google Ads 리포트 테이블 자체에 기간(날짜) 컬럼이
 * 없고(사용자 확인, "구글에 start and end date를 추출할 수 없다"), 지금
 * 업로드된 데이터도 all-time(전체 기간) 합계라 월별로 쪼갤 방법이 없다.
 * 사용자 결정("우선 지금은 search_ops에만 반영해두자, 리포팅 영역은
 * 배제해두고")에 따라 이 파일은 Search_OPS GROUP_3A_AUTO 자동 매칭
 * (SEARCH_004_Merge.js)에 쓰일 캠페인별 stats map만 만든다 —
 * Ad_Spend_Cache(AD_004_SpendCache.js)/ACQ_REP/Target_REP/FY_REP 쪽으로는
 * 연결하지 않는다. Cost는 이미 NZD(사용자 확인)라 환율 변환도 불필요.
 *
 * Business Segment 분류는 이번 범위에 없음(GOOGLE_SEARCH.LEAD_SOURCE_OVERRIDE는
 * 나중에 FY/Month/Segment 집계를 추가할 때를 위해 Config에만 확정해둔 값 —
 * AD_001_Config.js 참고).
 *
 * Must NOT
 * - FY/Month/Segment 집계, Ad_Spend_Cache 연결 (기간 컬럼 없음 — 착수 안 함)
 * - getBusinessSegment() 호출 (이번 범위엔 필요 없음)
 *
 * Stage
 * AD
 *
 * Version
 * v1.2.0
 *
 * Change Log
 * v1.2.0 (2026-08-26)
 * - `runDebugGoogleSearchCampaignMatches()` 수정 — 기존엔 docstring상으로
 *   "buildGoogleSearchCampaignStatsLowerKeyMap_()(SEARCH_004_Merge.js)와
 *   동일 로직"이라고 해놓고 실제로는 override 없이 직접 매칭만 재구현하고
 *   있어서, GOOGLE_SEARCH_CAMPAIGN_NAME_TO_SEARCH_OPS_KEY_OVERRIDE 추가
 *   (SEARCH_004_Merge.js v1.11.0) 이후에도 진단 결과가 실제 Build 동작과
 *   어긋나는 문제 발견(사용자가 override 추가 후에도 "매칭 안 됨"으로
 *   남는 캠페인을 보고 발견) — 이제 `buildGoogleSearchCampaignStatsLowerKeyMap_()`
 *   를 그대로 호출해 진짜 동일한 결과를 보장.
 * v1.1.0 (2026-08-25)
 * - `runDebugGoogleSearchCampaignMatches()` 신규(진단, 수동 실행 진입점) —
 *   `buildSearchOPS()` 실행 후 사용자가 다수의 Search_OPS 키를 "Campaign
 *   데이터가 blank"로 보고(채팅으로 목록 전달, 리스트 자체가 개행 없이
 *   붙어서 왔던 첫 캠페인명 샘플과 달리 이번엔 줄바꿈 있는 목록 — 그래도
 *   채팅 붙여넣기로 전달된 텍스트는 원본 시트 셀 값과 완전히 같다는 보장이
 *   없어(숨은 공백/특수문자 등) 직접 비교로 신뢰하기보다 라이브 시트를
 *   교차 대조하는 진단이 필요하다고 판단**. GoogleSearch_Raw 캠페인명이
 *   실제 Search_OPS 키와 매칭되는지/안 되는지를 라이브로 직접 비교해서
 *   Logger에 두 목록(매칭됨/매칭 안 됨)으로 출력 — 채팅으로 전달된 텍스트
 *   비교 대신 실제 시트값 기준 진단으로 원인(진짜 미매칭 vs 표기 차이)을
 *   좁히기 위함.
 * v1.0.0 (2026-08-25)
 * - 최초 구현. `computeGoogleSearchRowStatsEntry_()`(순수, 행 1개 →
 *   {campaignName, impressions, clicks, spent, results})/
 *   `aggregateGoogleSearchStatsByCampaign_()`(순수, 캠페인명 기준 합산 —
 *   중복 행 대비, Naver stats cache와 동일 출력 형태
 *   {campaignName: {impressions, clicks, spent, results}}). IO 래퍼
 *   `readGoogleSearchRawRows_()`(sheetToObjects() 재사용)/
 *   `computeGoogleSearchStatsSummary_()`. 수동 실행:
 *   `setupGoogleSearchRawSheet()`(탭이 이미 있어 사실상 no-op, 다른
 *   플랫폼과의 일관성 목적)/`runComputeGoogleSearchStatsSummary()`/
 *   `runDebugGoogleSearchRawFirstRow()`(진단, Meta/Naver 패턴과 동일).
 * ==========================================================
 */


/**
 * ==========================================================
 * Setup Google Search Raw Sheet (수동 실행, 탭만 생성)
 * ==========================================================
 */
function setupGoogleSearchRawSheet(){

  const ss = SpreadsheetApp.openById(AD.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(AD.RAW_SHEET["Google Search"]);

  if(!sheet){
    sheet = ss.insertSheet(AD.RAW_SHEET["Google Search"]);
    Logger.log(AD.RAW_SHEET["Google Search"] + " 탭 생성 완료. Google Ads 검색광고 리포트를 헤더 포함해서 A1부터 붙여넣으세요.");
  } else {
    Logger.log(AD.RAW_SHEET["Google Search"] + " 탭이 이미 존재합니다.");
  }

}


/**
 * ==========================================================
 * Compute Google Search Row Stats Entry (순수 함수)
 *
 * WHY
 * GoogleSearch_Raw 원본 행(헤더 기반 object) → 캠페인별 stats 항목 1개로
 * 변환. Cost/Conversions/Clicks/Impr.는 콤마 포함 문자열일 수 있어
 * parseCurrencyValue_()(TARGET_001_Engine.js)로 방어적 파싱(Naver Search의
 * "3,765원" 방어 파싱과 동일 관행).
 *
 * INPUT
 * row : Object  {CAMPAIGN_NAME, IMPRESSIONS, CLICKS, COST, CONVERSIONS}
 *   (AD.GOOGLE_SEARCH.COLUMNS 매핑을 거친 raw 헤더 값)
 *
 * OUTPUT
 * Object  {campaignName, impressions, clicks, spent, results}
 *
 * TEST
 * testComputeGoogleSearchRowStatsEntry() 참고
 * ==========================================================
 */
function computeGoogleSearchRowStatsEntry_(row){

  return {
    campaignName: String(row.campaignName || "").trim(),
    impressions: parseCurrencyValue_(row.impressions),
    clicks: parseCurrencyValue_(row.clicks),
    spent: parseCurrencyValue_(row.spent),
    results: parseCurrencyValue_(row.conversions)
  };

}


/**
 * ==========================================================
 * TEST — computeGoogleSearchRowStatsEntry_()
 * ==========================================================
 */
function testComputeGoogleSearchRowStatsEntry(){

  const entry = computeGoogleSearchRowStatsEntry_({
    campaignName: "  KR_core_2021-04-01_search-kr_brand-crimson_contact  ",
    impressions: "12,345",
    clicks: "1,200",
    spent: "3,456.78",
    conversions: "42.5"
  });

  const pass =
    entry.campaignName === "KR_core_2021-04-01_search-kr_brand-crimson_contact" &&
    entry.impressions === 12345 &&
    entry.clicks === 1200 &&
    entry.spent === 3456.78 &&
    entry.results === 42.5;

  Logger.log("Entry: " + JSON.stringify(entry));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Aggregate Google Search Stats By Campaign (순수 함수)
 *
 * WHY
 * GoogleSearch_Raw는 재붙여넣기/재export 시 같은 캠페인명이 여러 행에
 * 걸칠 수 있어(사용자가 매번 시트 내용을 통째로 교체하는 걸 권장하지만,
 * 방어적으로) 캠페인명(trim, 대소문자 구분 유지 — Search_OPS 매칭 단계인
 * buildGoogleSearchCampaignStatsLowerKeyMap_()에서 대소문자 무시 비교)
 * 기준으로 합산한다. Naver stats cache와 동일 출력 형태를 맞춰 그대로
 * mergeCampaignStatsLowerKeyMaps_()(SEARCH_004_Merge.js)에 넘길 수 있게 함.
 *
 * INPUT
 * entries : Array<{campaignName, impressions, clicks, spent, results}>
 *
 * OUTPUT
 * Object  {campaignName: {impressions, clicks, spent, results}}
 *
 * TEST
 * testAggregateGoogleSearchStatsByCampaign() 참고
 * ==========================================================
 */
function aggregateGoogleSearchStatsByCampaign_(entries){

  const totals = {};

  (entries || []).forEach(function(entry){

    if(!entry.campaignName) return;

    const existing = totals[entry.campaignName];

    totals[entry.campaignName] = existing ? {
      impressions: existing.impressions + entry.impressions,
      clicks: existing.clicks + entry.clicks,
      spent: existing.spent + entry.spent,
      results: existing.results + entry.results
    } : {
      impressions: entry.impressions,
      clicks: entry.clicks,
      spent: entry.spent,
      results: entry.results
    };

  });

  return totals;

}


/**
 * ==========================================================
 * TEST — aggregateGoogleSearchStatsByCampaign_()
 * ==========================================================
 */
function testAggregateGoogleSearchStatsByCampaign(){

  const entries = [
    { campaignName: "Campaign A", impressions: 100, clicks: 10, spent: 50, results: 2 },
    { campaignName: "Campaign B", impressions: 200, clicks: 20, spent: 80, results: 3 },
    { campaignName: "Campaign A", impressions: 50, clicks: 5, spent: 25, results: 1 },
    { campaignName: "", impressions: 999, clicks: 999, spent: 999, results: 999 }
  ];

  const totals = aggregateGoogleSearchStatsByCampaign_(entries);

  const pass =
    Object.keys(totals).length === 2 &&
    totals["Campaign A"].impressions === 150 &&
    totals["Campaign A"].clicks === 15 &&
    totals["Campaign A"].spent === 75 &&
    totals["Campaign A"].results === 3 &&
    totals["Campaign B"].impressions === 200;

  Logger.log("Totals: " + JSON.stringify(totals));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Read Google Search Raw Rows (IO 래퍼)
 * ==========================================================
 */
function readGoogleSearchRawRows_(){

  const ss = SpreadsheetApp.openById(AD.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(AD.RAW_SHEET["Google Search"]);

  if(!sheet) return [];

  const cols = AD.GOOGLE_SEARCH.COLUMNS;

  return sheetToObjects(sheet).map(function(raw){

    return {
      campaignName: raw[cols.CAMPAIGN_NAME],
      impressions: raw[cols.IMPRESSIONS],
      clicks: raw[cols.CLICKS],
      spent: raw[cols.COST],
      conversions: raw[cols.CONVERSIONS]
    };

  });

}


/**
 * ==========================================================
 * Compute Google Search Stats Summary (IO 래퍼)
 * ==========================================================
 */
function computeGoogleSearchStatsSummary_(){

  const entries = readGoogleSearchRawRows_().map(computeGoogleSearchRowStatsEntry_);

  return aggregateGoogleSearchStatsByCampaign_(entries);

}


/**
 * ==========================================================
 * Run Compute Google Search Stats Summary (수동 실행 진입점)
 * ==========================================================
 */
function runComputeGoogleSearchStatsSummary(){

  const summary = computeGoogleSearchStatsSummary_();

  Logger.log("캠페인 수: " + Object.keys(summary).length);
  Logger.log(JSON.stringify(summary, null, 2));

}


/**
 * ==========================================================
 * Run Debug Google Search Raw First Row (진단, 수동 실행 진입점)
 * ==========================================================
 */
function runDebugGoogleSearchRawFirstRow(){

  const rows = readGoogleSearchRawRows_();

  if(rows.length === 0){
    Logger.log("GoogleSearch_Raw에 데이터가 없습니다.");
    return;
  }

  Logger.log("Raw (매핑 후): " + JSON.stringify(rows[0]));
  Logger.log("Parsed: " + JSON.stringify(computeGoogleSearchRowStatsEntry_(rows[0])));

}


/**
 * ==========================================================
 * Run Debug Google Search Campaign Matches (진단, 수동 실행 진입점, 2026-08-25)
 *
 * WHY
 * GoogleSearch_Raw 캠페인명이 Search_OPS 키(Lead Source Detail)와 실제로
 * 매칭되는지/안 되는지를 라이브 시트 기준으로 직접 비교해서 보여준다 —
 * 채팅으로 전달된 캠페인명 목록은 원본 셀 값과 완전히 같다는 보장이 없어
 * (숨은 공백/특수문자 등 가능) 실제 시트값 기준 진단이 필요함(사용자가
 * "Campaign 데이터가 blank"인 Search_OPS 키 목록을 다수 보고, 진짜 미매칭인지
 * 표기 차이인지 확인 필요).
 *
 * `buildGoogleSearchCampaignStatsLowerKeyMap_()`(SEARCH_004_Merge.js)와
 * 동일한 대소문자/공백 무시 비교 로직을 그대로 사용 — Build 때와 완전히
 * 같은 매칭 결과가 나오는지 검증 가능.
 * ==========================================================
 */
function runDebugGoogleSearchCampaignMatches(){

  const googleStatsMap = computeGoogleSearchStatsSummary_();
  const existingOps = readSearchOPS_();

  const existingKeysLower = {};

  existingOps.forEach(function(row){
    const key = String(row[SEARCH.KEY] || "").trim();
    if(key) existingKeysLower[key.toLowerCase()] = key;
  });

  // buildGoogleSearchCampaignStatsLowerKeyMap_()(SEARCH_004_Merge.js)를
  // 그대로 호출 — GOOGLE_SEARCH_CAMPAIGN_NAME_TO_SEARCH_OPS_KEY_OVERRIDE
  // 번역까지 포함해 Build 때와 완전히 동일한 매칭 결과를 보장(2026-08-26,
  // 기존엔 override 없이 직접 매칭만 재구현하고 있어서 진단 결과가 실제
  // Build 동작과 어긋났음 — 사용자가 override 추가 후에도 "매칭 안 됨"으로
  // 남는 걸 보고 발견).
  const googleStatsLower = buildGoogleSearchCampaignStatsLowerKeyMap_(googleStatsMap);

  const matched = [];
  const unmatched = [];

  Object.keys(googleStatsLower).forEach(function(lower){

    const name = googleStatsLower[lower].name;

    if(existingKeysLower[lower]){
      matched.push(name + "  →  " + existingKeysLower[lower]);
    } else {
      unmatched.push(name);
    }

  });

  Logger.log("GoogleSearch_Raw 총 캠페인 수: " + Object.keys(googleStatsMap).length);
  Logger.log("");
  Logger.log("========== Search_OPS 키와 매칭됨 (" + matched.length + "개) ==========");
  Logger.log(matched.join("\n"));
  Logger.log("");
  Logger.log("========== 매칭 안 됨 (" + unmatched.length + "개) ==========");
  Logger.log(unmatched.join("\n"));

}
