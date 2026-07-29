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
 * ⚠️ divideGuard_()/copyColumns_() 같은 범용 헬퍼는 재정의하지 않고
 * 53_Events_Merge.js 정의를 재사용.
 *
 * Version
 * v1.1.0
 *
 * Change Log
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
function mergeContentOPS_(existingOps, engineMap) {

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
    applyContentGroup5Derived_(row);
    applyContentDerivedDateColumns_(row);

    summary.merged++;

    return row;

  });

  rowObjects.sort(compareByStartDateBlankLastContent_);

  const rows = rowObjects.map(function (row) {
    return CONTENT.HEADER.map(function (col) { return row[col]; });
  });

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
 * Apply Content Group 5 (Derived — CTR/CvR/CPL/CPNP1/ROAS/Match Rate)
 * ==========================================================
 */
function applyContentGroup5Derived_(row) {

  row["CTR"] = divideGuard_(row["Link clicks"], row["Impressions"]);
  row["CvR"] = divideGuard_(row["Results"], row["Link clicks"]);
  row["CPL"] = divideGuard_(row["Spent"], row["TotalReg."]);
  row["CPNP1"] = divideGuard_(row["Spent"], row["SF NLP1s"]);
  row["ROAS"] = divideGuard_(row["Revenue"], row["Spent"]);
  row["Match Rate"] = divideGuard_(row["SF Reg."], row["TotalReg."]);

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
