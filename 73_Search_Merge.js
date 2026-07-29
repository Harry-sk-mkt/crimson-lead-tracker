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
 * v1.2.0
 *
 * Change Log
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
 * ==========================================================
 */
function mergeSearchOPS_(existingOps, engineMap) {

  const existingMap = createSearchKeyMap_(existingOps);

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

      summary.updated++;

    } else {

      applySearchNewRowDefaults_(row, key);

      summary.new++;

    }

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

  row["Marketo Campaign name"] = key;
  row["Channel"] = resolveSearchChannelFromKey_(key);

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
