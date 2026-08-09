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
 * v1.3.1
 *
 * Change Log
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
function mergeBOFUOPS_(existingOps, engineMap) {

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
