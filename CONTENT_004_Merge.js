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
 * v1.2.1
 *
 * Change Log
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
