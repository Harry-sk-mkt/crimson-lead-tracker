/**
 * ==========================================================
 * Marketing 2.0
 * BOFU Merge
 *
 * Responsibility
 * BOFU_Engine(집계값) + 기존 BOFU_OPS(Manual 컬럼)를 Lead Source
 * Detail(Marketo Program 이름) 기준으로 병합. 53_Events_Merge.js의
 * mergeEventsOPS_() 패턴을 그대로 따름 (키 기준 Manual 컬럼 보존 +
 * 전체 재작성).
 *
 * ⚠️ compareByEventDateBlankLast_()/applyRatioFormulas_()/
 * buildRatioFormula_() 같은 범용 헬퍼는 재정의하지 않고
 * 53_Events_Merge.js/54_Events_Write.js 정의를 재사용(정렬 비교 함수는
 * "Start Date" 기준이라 이름이 달라 새로 작성).
 *
 * Version
 * v1.5.0
 *
 * Change Log
 * v1.5.0 (2026-08-25)
 * - `applyBOFUMetaCampaignDataIfMatched_()`에 Impressions/Reach 추가
 *   (additive) — Meta_Raw 원본에 실제로 있던 컬럼임을 사용자 지적으로
 *   재확인(`AD_001_Config.js` v1.22.0에 매핑 추가), v1.4.0에서 빠졌던
 *   두 필드를 마저 자동화.
 * v1.4.0 (2026-08-25)
 * - `applyBOFUMetaCampaignDataIfMatched_()` 신규(사용자 요청, Spent
 *   자동화에 이은 2단계) — Campaign/Off-On/Start Date/End Date/Link
 *   clicks/Results를 Meta_Raw 매칭이 있는 프로그램에 한해 자동으로
 *   채운다(매칭 없으면 기존 수동값 그대로 유지). `mergeBOFUOPS_()`
 *   시그니처에 `metaAgg` 파라미터 추가(`BOFU_003_Build.js`가
 *   `computeBOFUMetaCampaignDataAggregates_()` 결과를 전달) —
 *   `applyBOFUGroup4Computed_()` 다음, `applyBOFUAutoDerivedFieldsIfBlank_()`
 *   이전에 호출.
 * v1.3.2 (2026-08-19)
 * - `applyBOFUAutoDerivedFieldsIfBlank_()` 신규(사용자 요청) — Start Date가
 *   비어있으면 engineRow["Earliest Lead Date"](BOFU_002_Engine.js
 *   earliestCreateDate)로 채움, 값이 있으면 그대로 유지(Events의
 *   applyAutoDerivedFieldsIfBlank_()와 동일 원칙). `mergeBOFUOPS_()`에서
 *   `applyBOFUGroup4Computed_()` 직후, `applyBOFUDerivedDateColumns_()`
 *   직전에 호출(FY/Month가 Start Date에서 파생되므로 순서 중요). 신규
 *   테스트 `testApplyBOFUAutoDerivedFieldsIfBlank` 추가.
 * v1.3.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `63_BOFU_Merge.js` → 신규 `BOFU_004_Merge.js`, 코드 내용 변경 없음.
 * v1.3.0 (2026-08-09)
 * - `applyBOFUGroup5Derived_()` 삭제 — 비율 컬럼(CTR/CvR/CPL/CPNP1/ROAS/
 *   Match Rate)을 더 이상 JS에서 계산하지 않는다. `mergeBOFUOPS_()`가
 *   정렬 후 최종 행 배열을 만든 직후 `BOFU.RATIO_FORMULAS`(60_BOFU_Config.js)
 *   스펙대로 `applyRatioFormulas_()`(53_Events_Merge.js 정의 재사용)를
 *   호출해 실제 시트 수식으로 채움 — 사용자 요청(수동 입력값 수정 시
 *   자동 재계산). 출력값은 기존과 동일(분모 0 → 0 fallback, 변경 없음).
 * v1.2.0 (2026-07-29)
 * - compareByStartDateBlankFirst_() → compareByStartDateBlankLast_()로 교체
 *   — 빈 Start Date를 최상단이 아닌 최하단으로(전체 OPS 통일, 사용자 확정
 *   — 73_Search_Merge.js 참고). 테스트 함수명 끝 "_"도 같이 제거.
 * v1.1.0 (2026-07-24)
 * - applyBOFUGroup5Derived_() 필드명 갱신: "Amount spent"→"Spent",
 *   "Click to Lead CvR"→"CvR", "Cost per result" 계산 제거
 *   (60_BOFU_Config.js v1.1.0 컬럼 확정 반영).
 * v1.0.0 (2026-07-24)
 * - 최초 구현.
 * ==========================================================
 */

/**
 * ==========================================================
 * Merge BOFU_Engine + Existing BOFU_OPS
 * ==========================================================
 */
function mergeBOFUOPS_(existingOps, engineMap, metaAgg) {

  const existingMap = createBOFUKeyMap_(existingOps);

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
    row[BOFU.KEY] = key;

    if (existing) {

      copyColumns_(row, existing, BOFU.GROUP_1_MANUAL);
      copyColumns_(row, existing, BOFU.GROUP_2_MANUAL);
      copyColumns_(row, existing, BOFU.GROUP_3_MANUAL);

      summary.updated++;

    } else {

      applyBOFUNewRowDefaults_(row, key);

      summary.new++;

    }

    applyBOFUGroup4Computed_(row, engineRow);
    applyBOFUMetaCampaignDataIfMatched_(row, metaAgg, key);
    applyBOFUAutoDerivedFieldsIfBlank_(row, engineRow);
    applyBOFUDerivedDateColumns_(row);

    summary.merged++;

    return row;

  });

  rowObjects.sort(compareByStartDateBlankLast_);

  const rows = rowObjects.map(function (row) {
    return BOFU.HEADER.map(function (col) { return row[col]; });
  });

  applyRatioFormulas_(rows, BOFU.HEADER, BOFU.RATIO_FORMULAS, BOFU.ROWS.DATA_START);

  return { rows: rows, summary: summary };

}


/**
 * ==========================================================
 * Apply BOFU New Row Defaults (신규 발견 Lead Source Detail)
 *
 * WHY
 * Events의 applyNewRowDefaults_()와 동일 목적 — key(이미 Engine
 * 단계에서 stripRegistrationFormSuffix_()로 정제된 canonical 값)를
 * Marketo Campaign name에 그대로 prefill. Channel은 광고 채널이
 * 현재 Meta 단일이라 BOFU.CHANNEL_DEFAULT("Meta")로 기본값 설정
 * (신규 채널 추가 시 Ops가 수동으로 변경).
 * ==========================================================
 */
function applyBOFUNewRowDefaults_(row, key) {

  BOFU.GROUP_1_MANUAL.forEach(function (col) { row[col] = ""; });
  BOFU.GROUP_2_MANUAL.forEach(function (col) { row[col] = ""; });
  BOFU.GROUP_3_MANUAL.forEach(function (col) { row[col] = ""; });

  row["Marketo Campaign name"] = key;
  row["Channel"] = BOFU.CHANNEL_DEFAULT;

}


/**
 * ==========================================================
 * Apply BOFU Group 4 (SF Computed, Engine 원본값)
 * ==========================================================
 */
function applyBOFUGroup4Computed_(row, engineRow) {

  BOFU.GROUP_4_COMPUTED.forEach(function (col) {
    row[col] = (engineRow && Number(engineRow[col])) || 0;
  });

}


/**
 * ==========================================================
 * Apply BOFU Meta Campaign Data If Matched (Campaign/Off-On/Start Date/
 * End Date/Impressions/Reach/Link clicks/Results — 매칭된 프로그램에 한해
 * 자동 덮어쓰기)
 *
 * WHY (2026-08-25, 사용자 요청 — Spent 자동화에 이은 2단계)
 * `GROUP_3_MANUAL`에 남아있는 이 7개 필드 중 Spent를 제외한 나머지도
 * Meta_Raw에서 자동으로 채워달라는 요청(Impressions/Reach는 처음엔
 * Meta_Raw 원본에 없다고 판단했으나, 사용자 지적으로 `runDebugMetaRawFirstRow()`
 * 재확인 결과 원본에 있었음을 확인 — `AD_001_Config.js` v1.22.0에 매핑
 * 추가). 다만 `Spent`/`Link clicks`/`Results`/`Impressions`/`Reach`와 달리
 * `Start Date`/`Off/On`은 실측 결과(`runDumpContentOPSRowRawCells_()`,
 * TEMPQA_031) 이미 실제 값이 들어차 있는 필드라, Meta_Raw가 커버 못 하는
 * 프로그램(현재 BOFU 138개 중 92개)까지 무조건 덮어쓰면 기존 수동값이
 * 전부 날아가 FY/Month 공란·정렬 회귀(`compareByStartDateBlankLast_()`가
 * 빈 Start Date를 맨 아래로 보냄)로 이어진다. 그래서 **Meta 매칭이 있는
 * 키만** 덮어쓰고, 매칭이 없으면(`metaAgg.campaignNames[key]`가 비어있음)
 * 아무것도 건드리지 않는다 — `applyBOFUAutoDerivedFieldsIfBlank_()`("비어
 * 있을 때만 채움")와 자매 격 정책("매칭 있으면 우선")으로 같은 파일에
 * 나란히 둔다. `mergeBOFUOPS_()`에서 `applyBOFUGroup4Computed_()` 다음,
 * `applyBOFUAutoDerivedFieldsIfBlank_()` 이전에 호출 — 이 함수가 이미
 * Start Date를 채웠으면 그 "비어있을 때만" fallback은 자동으로 스킵됨.
 *
 * Off/On 판정: Meta_Raw엔 활성/비활성을 직접 나타내는 필드가 없어
 * `campaignEnd` 기준 근사(사용자 확정) — 매칭된 캠페인 중 종료일 없는
 * 게 하나라도 있으면(`hasOngoing`) "On", 전부 종료일이 있고 그 중
 * 최댓값이 오늘보다 과거면 "Off", 아니면(오늘 이후 종료 예정) "On".
 *
 * INPUT
 * row       : Object  (in-place 수정)
 * metaAgg   : Object  (computeBOFUMetaCampaignDataAggregates_() 결과)
 * key       : string  (BOFU.KEY 값)
 *
 * TEST
 * testApplyBOFUMetaCampaignDataIfMatched 참고
 * ==========================================================
 */
function applyBOFUMetaCampaignDataIfMatched_(row, metaAgg, key) {

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
 * TEST — applyBOFUMetaCampaignDataIfMatched_()
 * ==========================================================
 */
function testApplyBOFUMetaCampaignDataIfMatched() {

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
  applyBOFUMetaCampaignDataIfMatched_(rowMatchedEnded, metaAgg, "A");

  const rowMatchedOngoing = { "Campaign": "", "Start Date": "", "End Date": "", "Off/On": "" };
  applyBOFUMetaCampaignDataIfMatched_(rowMatchedOngoing, metaAgg, "B");

  const rowUnmatched = { "Campaign": "keep-me", "Start Date": "keep-me", "Off/On": "keep-me" };
  applyBOFUMetaCampaignDataIfMatched_(rowUnmatched, metaAgg, "C");

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
 * Apply BOFU Auto-Derived Fields If Blank (Start Date fallback)
 *
 * WHY (2026-08-19, 사용자 요청)
 * Start Date는 원래 Meta Ads 원본을 사람이 그대로 옮겨 적는 Manual
 * 필드지만, 신규 런칭 프로그램은 Ops가 아직 안 채운 동안
 * compareByStartDateBlankLast_() 때문에 시트 맨 아래로 밀려 눈에 잘
 * 안 띈다는 문제가 실제로 발생함("WF-2026-08-KOR-BOFU-Core Duke CAO
 * advise" 사례, 리드는 이미 있는데 Start Date가 비어있어 못 찾음).
 * Events의 applyAutoDerivedFieldsIfBlank_()와 동일 원칙 — **값이 있으면
 * 절대 덮어쓰지 않고, 비어있을 때만** Engine이 계산해 보낸
 * "Earliest Lead Date"(이 프로그램으로 들어온 가장 이른 New Registered
 * 리드의 Create Date, BOFU_002_Engine.js aggregateBOFULeadsRecords_
 * earliestCreateDate 참고)로 채운다. 한 번 사람이 실제 Meta 캠페인
 * 시작일로 값을 채우면 그 다음부턴 그 값이 우선(정확도가 더 높음).
 *
 * INPUT
 * row       : Object  (in-place 수정)
 * engineRow : Object|undefined  (readBOFUEngineMap_() 결과의 해당 key 행)
 *
 * TEST
 * testApplyBOFUAutoDerivedFieldsIfBlank 참고
 * ==========================================================
 */
function applyBOFUAutoDerivedFieldsIfBlank_(row, engineRow) {

  const hasStartDate = row["Start Date"] instanceof Date && !isNaN(row["Start Date"].getTime());

  if (hasStartDate) return;

  const earliestDate = engineRow && engineRow["Earliest Lead Date"];
  const hasEarliestDate = earliestDate instanceof Date && !isNaN(earliestDate.getTime());

  if (hasEarliestDate) {
    row["Start Date"] = earliestDate;
  }

}


/**
 * ==========================================================
 * TEST — applyBOFUAutoDerivedFieldsIfBlank_()
 * ==========================================================
 */
function testApplyBOFUAutoDerivedFieldsIfBlank() {

  const earliestDate = new Date(2026, 7, 15);

  const rowBlank = { "Start Date": "" };
  applyBOFUAutoDerivedFieldsIfBlank_(rowBlank, { "Earliest Lead Date": earliestDate });

  const rowFilled = { "Start Date": new Date(2026, 0, 1) };
  applyBOFUAutoDerivedFieldsIfBlank_(rowFilled, { "Earliest Lead Date": earliestDate });

  const rowNoEngine = { "Start Date": "" };
  applyBOFUAutoDerivedFieldsIfBlank_(rowNoEngine, undefined);

  const pass =
    rowBlank["Start Date"].getTime() === earliestDate.getTime() &&    // 공란 → 채움
    rowFilled["Start Date"].getTime() === new Date(2026, 0, 1).getTime() && // 값 있음 → 유지
    rowNoEngine["Start Date"] === "";                                  // engineRow 없음 → 그대로 공란

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Apply BOFU Derived Date Columns (FY / Month from Start Date)
 *
 * WHY
 * Events는 Event Date 기준이었지만 BOFU는 이벤트 개념이 없어 Meta
 * 캠페인 Start Date를 기준으로 FY/Month를 파생한다. getFiscalYear()/
 * getMonthText()는 16_TransformHelper.js 재사용.
 * ==========================================================
 */
function applyBOFUDerivedDateColumns_(row) {

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
 * compareByEventDateBlankLast_()(53_Events_Merge.js)와 동일 로직,
 * 비교 대상 필드만 "Event Date" → "Start Date"로 다름 — 필드명이
 * 하드코딩되어 있어 함수 자체는 재사용 불가, 새로 작성.
 * 2026-07-29: 빈 날짜를 최상단 대신 최하단으로 변경(Search_OPS에서 신규
 * 키 대거 유입으로 빈 Start Date가 최상단을 차지하는 문제 발견 후 전체
 * OPS 통일, 사용자 확정 — 73_Search_Merge.js 참고).
 *
 * TEST
 * testCompareByStartDateBlankLast 참고
 * ==========================================================
 */
function compareByStartDateBlankLast_(a, b) {

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
 * TEST — compareByStartDateBlankLast_()
 * ==========================================================
 */
function testCompareByStartDateBlankLast() {

  const rows = [
    { "Lead Source Detail": "old", "Start Date": new Date(2026, 0, 1) },
    { "Lead Source Detail": "blank1", "Start Date": "" },
    { "Lead Source Detail": "new", "Start Date": new Date(2026, 5, 1) },
    { "Lead Source Detail": "blank2", "Start Date": "" }
  ];

  rows.sort(compareByStartDateBlankLast_);

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
function createBOFUKeyMap_(rows) {

  const map = {};

  rows.forEach(function (row) {

    const key = String(row[BOFU.KEY] || "").trim();

    if (!key) return;

    if (!map[key]) {
      map[key] = row;
    }

  });

  return map;

}


/**
 * ==========================================================
 * Read Existing BOFU_OPS
 *
 * WHY
 * BOFU_OPS도 Events_OPS와 동일하게 1행이 SUBTOTAL 수식 행이라
 * (헤더는 2행), 범용 sheetToObjects()를 그대로 쓸 수 없음.
 * ==========================================================
 */
function readBOFUOPS_() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(BOFU.SHEET.OPS);

  if (!sheet) return [];

  if (sheet.getLastRow() < BOFU.ROWS.HEADER) return [];

  const values = sheet.getDataRange().getValues();

  const headerIndex = BOFU.ROWS.HEADER - 1;

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
