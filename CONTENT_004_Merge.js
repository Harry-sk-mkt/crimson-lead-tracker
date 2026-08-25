/**
 * ==========================================================
 * Marketing 2.0
 * Content Merge
 *
 * Responsibility
 * Content_Engine(집계값) + 기존 Content_OPS(Manual 컬럼)를 Lead Source
 * Detail(Marketo Program 이름) 기준으로 병합. 63_BOFU_Merge.js /
 * 73_Search_Merge.js와 동일 패턴 (키 기준 Manual 컬럼 보존 + 전체
 * 재작성).
 *
 * ⚠️ copyColumns_()/applyRatioFormulas_() 같은 범용 헬퍼는 재정의하지
 * 않고 53_Events_Merge.js 정의를 재사용.
 *
 * Version
 * v1.4.0
 *
 * Change Log
 * v1.4.0 (2026-08-25)
 * - `applyContentMetaCampaignDataIfMatched_()`에 Impressions/Reach 추가
 *   (additive, BOFU_004_Merge.js v1.5.0과 동일) — Meta_Raw 원본에 실제로
 *   있던 컬럼임을 사용자 지적으로 재확인(`AD_001_Config.js` v1.22.0에
 *   매핑 추가), v1.3.0에서 빠졌던 두 필드를 마저 자동화.
 * v1.3.0 (2026-08-25)
 * - `applyContentMetaCampaignDataIfMatched_()` 신규(사용자 요청, Spent
 *   자동화에 이은 2단계, BOFU_004_Merge.js v1.4.0과 동일 정책) —
 *   Campaign/Off-On/Start Date/End Date/Link clicks/Results를 Meta_Raw
 *   매칭이 있는 프로그램에 한해 자동으로 채운다(매칭 없으면 기존 수동값
 *   유지). `mergeContentOPS_()` 시그니처에 `metaAgg` 파라미터 추가
 *   (`CONTENT_003_Build.js`가 `computeContentMetaCampaignDataAggregates_()`
 *   결과를 전달) — `applyContentGroup4Computed_()` 다음,
 *   `applyContentDerivedDateColumns_()` 이전에 호출.
 * v1.2.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `83_Content_Merge.js` → 신규 `CONTENT_004_Merge.js`, 코드 내용 변경 없음.
 * v1.2.0 (2026-08-09)
 * - `applyContentGroup5Derived_()` 삭제 — 비율 컬럼(CTR/CvR/CPL/CPNP1/
 *   ROAS/Match Rate)을 더 이상 JS에서 계산하지 않는다. `mergeContentOPS_()`가
 *   정렬 후 최종 행 배열을 만든 직후 `CONTENT.RATIO_FORMULAS`
 *   (80_Content_Config.js)로 `applyRatioFormulas_()`(53_Events_Merge.js
 *   정의 재사용)를 호출해 실제 시트 수식으로 채움 — 사용자 요청(수동
 *   입력값 수정 시 자동 재계산). 출력값은 기존과 동일(분모 0 → 0
 *   fallback, 변경 없음).
 * v1.1.0 (2026-07-29)
 * - compareByStartDateBlankFirstContent_() → compareByStartDateBlankLastContent_()
 *   로 교체 — 빈 Start Date를 최상단이 아닌 최하단으로(전체 OPS 통일,
 *   사용자 확정 — 73_Search_Merge.js 참고). 테스트 함수명 끝 "_"도 같이 제거.
 * v1.0.0
 * - 최초 구현.
 * ==========================================================
 */

/**
 * ==========================================================
 * Merge Content_Engine + Existing Content_OPS
 * ==========================================================
 */
function mergeContentOPS_(existingOps, engineMap, metaAgg) {

  const existingMap = createContentKeyMap_(existingOps);

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
    row[CONTENT.KEY] = key;

    if (existing) {

      copyColumns_(row, existing, CONTENT.GROUP_1_MANUAL);
      copyColumns_(row, existing, CONTENT.GROUP_2_MANUAL);
      copyColumns_(row, existing, CONTENT.GROUP_3_MANUAL);

      summary.updated++;

    } else {

      applyContentNewRowDefaults_(row, key);

      summary.new++;

    }

    applyContentGroup4Computed_(row, engineRow);
    applyContentMetaCampaignDataIfMatched_(row, metaAgg, key);
    applyContentDerivedDateColumns_(row);

    summary.merged++;

    return row;

  });

  rowObjects.sort(compareByStartDateBlankLastContent_);

  const rows = rowObjects.map(function (row) {
    return CONTENT.HEADER.map(function (col) { return row[col]; });
  });

  applyRatioFormulas_(rows, CONTENT.HEADER, CONTENT.RATIO_FORMULAS, CONTENT.ROWS.DATA_START);

  return { rows: rows, summary: summary };

}


/**
 * ==========================================================
 * Apply Content New Row Defaults (신규 발견 Lead Source Detail)
 * ==========================================================
 */
function applyContentNewRowDefaults_(row, key) {

  CONTENT.GROUP_1_MANUAL.forEach(function (col) { row[col] = ""; });
  CONTENT.GROUP_2_MANUAL.forEach(function (col) { row[col] = ""; });
  CONTENT.GROUP_3_MANUAL.forEach(function (col) { row[col] = ""; });

  row["Marketo Campaign name"] = key;
  row["Channel"] = CONTENT.CHANNEL_DEFAULT;

}


/**
 * ==========================================================
 * Apply Content Group 4 (SF Computed, Engine 원본값)
 * ==========================================================
 */
function applyContentGroup4Computed_(row, engineRow) {

  CONTENT.GROUP_4_COMPUTED.forEach(function (col) {
    row[col] = (engineRow && Number(engineRow[col])) || 0;
  });

}


/**
 * ==========================================================
 * Apply Content Meta Campaign Data If Matched (Campaign/Off-On/Start
 * Date/End Date/Impressions/Reach/Link clicks/Results — 매칭된 프로그램에
 * 한해 자동 덮어쓰기)
 *
 * WHY (2026-08-25, 사용자 요청 — Spent 자동화에 이은 2단계)
 * `BOFU_004_Merge.js`의 `applyBOFUMetaCampaignDataIfMatched_()`와 완전히
 * 동일한 정책/로직(Content엔 BOFU의 "Earliest Lead Date" fallback 같은
 * 게 없어 그 부분만 빠짐) — 상세 WHY는 그쪽 주석 참고. Meta_Raw 매칭이
 * 있는 프로그램만 덮어쓰고, 매칭 없으면 기존 수동값(Start Date/Off-On
 * 등 실제로 채워져 있는 필드)을 그대로 보존한다. Impressions/Reach는
 * 처음엔 Meta_Raw 원본에 없다고 판단했으나 사용자 지적으로 재확인 후
 * 추가(`AD_001_Config.js` v1.22.0).
 *
 * INPUT
 * row     : Object  (in-place 수정)
 * metaAgg : Object  (computeContentMetaCampaignDataAggregates_() 결과)
 * key     : string  (CONTENT.KEY 값)
 *
 * TEST
 * testApplyContentMetaCampaignDataIfMatched 참고
 * ==========================================================
 */
function applyContentMetaCampaignDataIfMatched_(row, metaAgg, key) {

  const names = metaAgg && metaAgg.campaignNames && metaAgg.campaignNames[key];

  if (!names || names.length === 0) return;

  row["Campaign"] = names.join(", ");
  row["Link clicks"] = metaAgg.clicks[key] || 0;
  row["Results"] = metaAgg.results[key] || 0;
  row["Impressions"] = metaAgg.impressions[key] || 0;
  row["Reach"] = metaAgg.reach[key] || 0;

  if (metaAgg.campaignStart[key]) row["Start Date"] = metaAgg.campaignStart[key];
  if (metaAgg.campaignEnd[key]) row["End Date"] = metaAgg.campaignEnd[key];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isEnded = metaAgg.campaignEnd[key] instanceof Date && metaAgg.campaignEnd[key] < today;

  row["Off/On"] = (metaAgg.hasOngoing[key] || !isEnded) ? "On" : "Off";

}


/**
 * ==========================================================
 * TEST — applyContentMetaCampaignDataIfMatched_()
 * ==========================================================
 */
function testApplyContentMetaCampaignDataIfMatched() {

  const metaAgg = {
    clicks: { A: 10, B: 5 },
    results: { A: 2, B: 1 },
    impressions: { A: 1000, B: 500 },
    reach: { A: 800, B: 400 },
    campaignNames: { A: ["campA1", "campA2"], B: ["campB1"] },
    campaignStart: { A: new Date(2026, 0, 1), B: new Date(2026, 1, 1) },
    campaignEnd: { A: new Date(2020, 0, 1) }, // 과거 종료 — B는 종료일 없음(hasOngoing)
    hasOngoing: { B: true }
  };

  const rowMatchedEnded = { "Campaign": "", "Start Date": "old", "End Date": "", "Off/On": "old" };
  applyContentMetaCampaignDataIfMatched_(rowMatchedEnded, metaAgg, "A");

  const rowMatchedOngoing = { "Campaign": "", "Start Date": "", "End Date": "", "Off/On": "" };
  applyContentMetaCampaignDataIfMatched_(rowMatchedOngoing, metaAgg, "B");

  const rowUnmatched = { "Campaign": "keep-me", "Start Date": "keep-me", "Off/On": "keep-me" };
  applyContentMetaCampaignDataIfMatched_(rowUnmatched, metaAgg, "C");

  const pass =
    rowMatchedEnded["Campaign"] === "campA1, campA2" &&
    rowMatchedEnded["Link clicks"] === 10 &&
    rowMatchedEnded["Results"] === 2 &&
    rowMatchedEnded["Impressions"] === 1000 &&
    rowMatchedEnded["Reach"] === 800 &&
    rowMatchedEnded["Start Date"].getTime() === new Date(2026, 0, 1).getTime() &&
    rowMatchedEnded["Off/On"] === "Off" &&
    rowMatchedOngoing["Off/On"] === "On" &&
    rowUnmatched["Campaign"] === "keep-me" &&
    rowUnmatched["Start Date"] === "keep-me" &&
    rowUnmatched["Off/On"] === "keep-me";

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Apply Content Derived Date Columns (FY / Month from Start Date)
 * ==========================================================
 */
function applyContentDerivedDateColumns_(row) {

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
 * 빈 날짜를 최상단 대신 최하단으로 변경(전체 OPS 통일, 사용자 확정 —
 * 73_Search_Merge.js 참고).
 *
 * TEST
 * testCompareByStartDateBlankLastContent 참고
 * ==========================================================
 */
function compareByStartDateBlankLastContent_(a, b) {

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
 * TEST — compareByStartDateBlankLastContent_()
 * ==========================================================
 */
function testCompareByStartDateBlankLastContent() {

  const rows = [
    { "Lead Source Detail": "old", "Start Date": new Date(2026, 0, 1) },
    { "Lead Source Detail": "blank1", "Start Date": "" },
    { "Lead Source Detail": "new", "Start Date": new Date(2026, 5, 1) },
    { "Lead Source Detail": "blank2", "Start Date": "" }
  ];

  rows.sort(compareByStartDateBlankLastContent_);

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
function createContentKeyMap_(rows) {

  const map = {};

  rows.forEach(function (row) {

    const key = String(row[CONTENT.KEY] || "").trim();

    if (!key) return;

    if (!map[key]) {
      map[key] = row;
    }

  });

  return map;

}


/**
 * ==========================================================
 * Read Existing Content_OPS
 * ==========================================================
 */
function readContentOPS_() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONTENT.SHEET.OPS);

  if (!sheet) return [];

  if (sheet.getLastRow() < CONTENT.ROWS.HEADER) return [];

  const values = sheet.getDataRange().getValues();

  const headerIndex = CONTENT.ROWS.HEADER - 1;

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
