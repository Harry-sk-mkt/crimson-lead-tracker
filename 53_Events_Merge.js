/**
 * ==========================================================
 * Marketing 2.0
 * Events Merge
 *
 * Responsibility
 * Events_Engine(집계값) + 기존 Events_OPS(Manual 컬럼)를 Lead Source
 * Detail(Marketo Program 이름) 기준으로 병합. 22_OPS_Merge.js의
 * mergeOPS() 패턴을 그대로 따름 (키 기준 Manual 컬럼 보존 + 전체 재작성).
 *
 * Version
 * v1.6.0
 *
 * Change Log
 * v1.6.0 (2026-07-24)
 * - stripRegistrationFormSuffix_()를 51_Events_Engine.js로 이관 — 매칭
 *   키 추출 단계(Engine)에서 직접 적용하도록 근본 수정됨에 따라, 여기서는
 *   더 이상 필요 없어짐. applyNewRowDefaults_()도 그에 맞춰 단순화
 *   (key가 이미 canonical 값이라 재정제 불필요).
 * v1.5.0 (2026-07-24)
 * - applyAutoDerivedFieldsIfBlank_()에 engineRow 파라미터 추가 — Event
 *   Date를 채울 때 engineRow["Event Date"](raw UTM 일 단위 날짜 최빈값)를
 *   parsed.eventDate(Marketo Program 이름 기반, 월 1일 고정)보다 우선
 *   사용 (사용자 요청, 51_Events_Engine.js v1.6.0의 새 Engine 컬럼 활용).
 * v1.4.0 (2026-07-24)
 * - applyAutoDerivedFieldsIfBlank_() 추가 — EventType/Event Date가
 *   비어있으면 parseProgramTypeAndDate_()(51_Events_Engine.js)로 자동
 *   추출해 채움. 신규/기존 행 모두에 적용(값이 있으면 보존). FY/Month는
 *   기존 applyDerivedDateColumns_()가 Event Date로부터 자동 파생하므로
 *   별도 로직 불필요 — 정렬(compareByEventDateBlankFirst_)도 그대로 재사용.
 * v1.3.0 (2026-07-24)
 * - applyGroup5Derived_() 컬럼 참조를 리네임된 이름("All Registered"→
 *   "SF Reg.", "Reg."→"Mkt Reg.", "NL P1"→"SF NLP1s")으로 갱신
 *   (50_Events_Config.js v1.3.0 GROUP_2_MANUAL/GROUP_4_COMPUTED 리네임 반영).
 * v1.2.0 (2026-07-24)
 * - 키 프로퍼티명 "UTM Key" → EVENTS.KEY("Lead Source Detail") 참조로 정정.
 * - stripRegistrationFormSuffix_() 추가 — 신규 행 Marketo Campaign name
 *   prefill 시 "(구분자) Registered for Webinar/Seminar from X Form" 등록
 *   폼 종류 접미사를 제거 (검색 노이즈 방지, 사용자가 실 빌드 결과에서 발견).
 * v1.1.0 (2026-07-24)
 * - applyNewRowDefaults_()에서 parseCampaignCountrySuffix_() 호출 제거
 *   (51_Events_Engine.js에서 해당 함수 삭제됨 — 매칭 필드가 raw UTM에서
 *   Marketo Program 이름으로 전환되며 국가 suffix 파싱 자체가 불필요해짐).
 *   Target Market은 이제 EVENTS.COUNTRY_FILTER("KOR") 고정값.
 * v1.0.0 (2026-07-24)
 * - 최초 구현.
 * ==========================================================
 */


/**
 * ==========================================================
 * Merge Events_Engine + Existing Events_OPS
 *
 * WHY
 * Events_OPS 행 생성 주체는 시스템(Engine이 발견한 UTM Key 기준)
 * 이지만, Ops팀이 직접 입력하는 Manual 컬럼(Event Date, Reg., Spent
 * 등)은 매 빌드마다 사라지면 안 된다. Leads_OPS와 동일하게 키 기준
 * 으로 Manual 컬럼만 보존하고 나머지는 매번 새로 계산한다.
 *
 * INPUT
 * existingOps : Object[]  (readEventsOPS_() 결과, 없으면 [])
 * engineMap   : Object    (readEventsEngineMap_() 결과, {utmKey: {...}})
 *
 * OUTPUT
 * { rows: Array<Array>, summary: Object }
 *
 * SIDE EFFECT
 * 없음 (순수 함수, 시트 쓰기는 하지 않음)
 * ==========================================================
 */
function mergeEventsOPS_(existingOps, engineMap) {

  const existingMap = createEventsKeyMap_(existingOps);

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
    row[EVENTS.KEY] = key;

    if (existing) {

      copyColumns_(row, existing, EVENTS.GROUP_1_MANUAL);
      copyColumns_(row, existing, EVENTS.GROUP_2_MANUAL);
      copyColumns_(row, existing, EVENTS.GROUP_3_MANUAL);

      summary.updated++;

    } else {

      applyNewRowDefaults_(row, key);

      summary.new++;

    }

    applyAutoDerivedFieldsIfBlank_(row, key, engineRow);
    applyGroup4Computed_(row, engineRow);
    applyGroup5Derived_(row);
    applyDerivedDateColumns_(row);

    summary.merged++;

    return row;

  });

  rowObjects.sort(compareByEventDateBlankFirst_);

  const rows = rowObjects.map(function (row) {
    return EVENTS.HEADER.map(function (col) { return row[col]; });
  });

  return { rows: rows, summary: summary };

}


/**
 * ==========================================================
 * Copy Columns (existing → row, 지정된 컬럼만)
 * ==========================================================
 */
function copyColumns_(row, source, columns) {

  columns.forEach(function (col) {
    row[col] = source[col];
  });

}


/**
 * ==========================================================
 * Apply New Row Defaults (신규 발견 Lead Source Detail)
 *
 * WHY
 * Events_OPS에 아직 없는 키(=Marketo Program 이름, EVENTS.MATCH_FIELD
 * 기준)가 Engine에서 새로 발견되면, 사람이 바로 알아볼 수 있도록
 * Marketo Campaign name에 그 이름을 prefill한다. key 자체가 이미
 * Engine 집계 단계에서 stripRegistrationFormSuffix_()로 정제된
 * canonical 값이므로(2026-07-24, 아래 WHY 참고) 여기서 다시 정제할
 * 필요 없음 — 그대로 씀. Target Market은 Engine이 이미
 * isEligibleEventProgram_()로 KOR만 걸러서 넘기므로 항상
 * EVENTS.COUNTRY_FILTER("KOR")로 고정.
 * ==========================================================
 */
function applyNewRowDefaults_(row, key) {

  EVENTS.GROUP_1_MANUAL.forEach(function (col) { row[col] = ""; });
  EVENTS.GROUP_2_MANUAL.forEach(function (col) { row[col] = ""; });
  EVENTS.GROUP_3_MANUAL.forEach(function (col) { row[col] = ""; });

  row["Marketo Campaign name"] = key;
  row["Target Market"] = EVENTS.COUNTRY_FILTER;

}


/**
 * ==========================================================
 * Apply Auto-Derived Fields If Blank (EventType / Event Date)
 *
 * WHY
 * EventType/Event Date는 Manual 컬럼이라 Ops가 직접 입력하는 게
 * 원칙이지만, Marketo Program 이름 자체에 이미 TYPE/YYYY/MM 정보가
 * 있어 비어있는 동안은 자동으로 채워주는 게 유용함 (2026-07-24 사용자
 * 요청). "새 행일 때만"이 아니라 "값이 비어있으면 항상" 적용 — 신규
 * 행/기존 행(과거에 비어있던 채로 저장된 행) 둘 다 커버. Ops가 한번
 * 수동으로 값을 채우면 그 다음부턴 채워진 값으로 간주되어 더 이상
 * 덮어쓰지 않음.
 *
 * Event Date 우선순위(2026-07-24 추가): engineRow["Event Date"](raw
 * MKT UTM Campaign의 일 단위 날짜 최빈값, 51_Events_Engine.js
 * pickModeEventDate_())가 있으면 그걸 우선 사용 — Marketo Program
 * 이름 기반 parsed.eventDate(월 1일로만 표시)보다 정확함. Engine에
 * 값이 없을 때만 parsed.eventDate로 fallback.
 *
 * INPUT
 * row : Object  (in-place 수정)
 * key : string  (Lead Source Detail = Marketo Program 이름)
 * engineRow : Object|undefined  (readEventsEngineMap_() 결과의 해당 key 행)
 *
 * TEST
 * testApplyAutoDerivedFieldsIfBlank_ 참고
 * ==========================================================
 */
function applyAutoDerivedFieldsIfBlank_(row, key, engineRow) {

  const parsed = parseProgramTypeAndDate_(key);

  if (parsed && !row["EventType"]) {
    row["EventType"] = EVENTS.EVENT_TYPE_LABELS[parsed.type] || parsed.type;
  }

  const hasEventDate = row["Event Date"] instanceof Date && !isNaN(row["Event Date"].getTime());

  if (!hasEventDate) {

    const engineDate = engineRow && engineRow["Event Date"];
    const hasEngineDate = engineDate instanceof Date && !isNaN(engineDate.getTime());

    if (hasEngineDate) {
      row["Event Date"] = engineDate;
    } else if (parsed) {
      row["Event Date"] = parsed.eventDate;
    }

  }

}


/**
 * ==========================================================
 * TEST — applyAutoDerivedFieldsIfBlank_()
 * ==========================================================
 */
function testApplyAutoDerivedFieldsIfBlank_() {

  const key = "WB-2025-07-KOR-MOFU-Core EC for Each Year of High School";

  // Case 1: 비어있고 engineRow 없음 → parsed.eventDate(월 1일)로 fallback
  const row1 = { "EventType": "", "Event Date": "" };
  applyAutoDerivedFieldsIfBlank_(row1, key);

  // Case 2: 이미 값이 있으면 덮어쓰지 않음 (Ops 수동 입력 보존)
  const manualDate = new Date(2025, 6, 15);
  const row2 = { "EventType": "Webinar (수정됨)", "Event Date": manualDate };
  applyAutoDerivedFieldsIfBlank_(row2, key);

  // Case 3: 비어있고 engineRow에 정확한 날짜 있음 → 그걸 우선 사용
  const row3 = { "EventType": "", "Event Date": "" };
  const engineRow3 = { "Event Date": new Date(2025, 6, 22) };
  applyAutoDerivedFieldsIfBlank_(row3, key, engineRow3);

  const pass =
    row1["EventType"] === "Webinar" &&
    row1["Event Date"] instanceof Date &&
    row1["Event Date"].getFullYear() === 2025 &&
    row1["Event Date"].getMonth() === 6 &&
    row1["Event Date"].getDate() === 1 &&
    row2["EventType"] === "Webinar (수정됨)" &&
    row2["Event Date"] === manualDate &&
    row3["Event Date"].getDate() === 22;

  Logger.log("Row1: " + JSON.stringify(row1));
  Logger.log("Row2 preserved: " + (row2["EventType"] === "Webinar (수정됨)"));
  Logger.log("Row3 (engine date preferred): " + JSON.stringify(row3));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Apply Group 4 (SF Computed, Engine 원본값)
 *
 * WHY
 * Engine에 없는 key(=Ops가 수동으로 등록했지만 SF 매칭이 0건인
 * 프로그램)는 전부 0으로 표시한다 (2026-07-24 확정 — 별도 QA 플래그 없음).
 * ==========================================================
 */
function applyGroup4Computed_(row, engineRow) {

  EVENTS.GROUP_4_COMPUTED.forEach(function (col) {
    row[col] = (engineRow && Number(engineRow[col])) || 0;
  });

}


/**
 * ==========================================================
 * Apply Group 5 (Derived — Match Rate/CPL/CPNP1/ROAS)
 *
 * WHY
 * REP 시트 없이 OPS 빌드 시점에 값으로 계산 (ACQ_REP와 동일 패턴).
 * 0으로 나누는 경우 #DIV/0! 대신 0을 반환 — 기존 실무 시트에서
 * #DIV/0! 14건+ 발견됐던 원인 재발 방지가 이 기능의 존재 이유.
 *
 * ⚠️ 2026-07-24 컬럼명 리네임 반영: "All Registered"→"SF Reg.",
 * "Reg."→"Mkt Reg."(마케토 자체 등록수), "NL P1"→"SF NLP1s"(SF 매칭된
 * New Lead P1 수 — 마케토 자체 집계인 "Mkt NLP1s"와 다른 지표이니
 * CPNP1 분모로 혼동하지 말 것).
 * ==========================================================
 */
function applyGroup5Derived_(row) {

  row["Match Rate"] = divideGuard_(row["SF Reg."], row["Mkt Reg."]);
  row["CPL"] = divideGuard_(row["Spent"], row["Leads(Meta)"]);
  row["CPNP1"] = divideGuard_(row["Spent"], row["SF NLP1s"]);
  row["ROAS"] = divideGuard_(row["Revenue"], row["Spent"]);

}


/**
 * ==========================================================
 * Divide Guard (0-division 방지)
 *
 * TEST
 * divideGuard_(10, 0) === 0
 * divideGuard_(10, 5) === 2
 * ==========================================================
 */
function divideGuard_(numerator, denominator) {

  const num = Number(numerator) || 0;
  const den = Number(denominator) || 0;

  if (den === 0) return 0;

  return num / den;

}


/**
 * ==========================================================
 * TEST — divideGuard_()
 * ==========================================================
 */
function testDivideGuard_() {

  const pass =
    divideGuard_(10, 0) === 0 &&
    divideGuard_(10, 5) === 2 &&
    divideGuard_("", "") === 0 &&
    divideGuard_(0, 5) === 0;

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Apply Derived Date Columns (FY / Month)
 *
 * WHY
 * Event Date는 Manual 입력 필드. FY27 표준 표기, Leads_Master/
 * MTA_Master와 동일한 getFiscalYear()/getMonthText()
 * (16_TransformHelper.js) 재사용 — Event Date가 비어있으면 둘 다 빈값.
 * ==========================================================
 */
function applyDerivedDateColumns_(row) {

  const eventDate = row["Event Date"];
  const validDate = eventDate instanceof Date && !isNaN(eventDate.getTime());

  row["FY"] = validDate ? getFiscalYear(eventDate) : "";
  row["Month"] = validDate ? getMonthText(eventDate) : "";

}


/**
 * ==========================================================
 * Compare Rows By Event Date (빈 날짜 최상단, 나머지는 내림차순)
 *
 * WHY
 * "빈 날짜 신규 행은 최상단" 요구사항은 스프레드시트 기본 정렬
 * 동작(빈 값은 항상 맨 뒤)과 반대라, sortSheetByDate()(시트 레벨
 * Range.sort) 대신 쓰기 전 JS 배열 단계에서 직접 정렬한다.
 *
 * TEST
 * testCompareByEventDateBlankFirst_ 참고
 * ==========================================================
 */
function compareByEventDateBlankFirst_(a, b) {

  const dateA = a["Event Date"];
  const dateB = b["Event Date"];

  const validA = dateA instanceof Date && !isNaN(dateA.getTime());
  const validB = dateB instanceof Date && !isNaN(dateB.getTime());

  if (!validA && !validB) return 0;
  if (!validA) return -1;
  if (!validB) return 1;

  return dateB.getTime() - dateA.getTime();

}


/**
 * ==========================================================
 * TEST — compareByEventDateBlankFirst_()
 * ==========================================================
 */
function testCompareByEventDateBlankFirst_() {

  const rows = [
    { "Lead Source Detail": "old", "Event Date": new Date(2026, 0, 1) },
    { "Lead Source Detail": "blank1", "Event Date": "" },
    { "Lead Source Detail": "new", "Event Date": new Date(2026, 5, 1) },
    { "Lead Source Detail": "blank2", "Event Date": "" }
  ];

  rows.sort(compareByEventDateBlankFirst_);

  const order = rows.map(function (r) { return r["Lead Source Detail"]; });

  const pass =
    order[0] === "blank1" && order[1] === "blank2" &&
    order[2] === "new" && order[3] === "old";

  Logger.log("Order: " + JSON.stringify(order));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Create Key Lookup Map (UTM Key 기준, first-seen-wins)
 * ==========================================================
 */
function createEventsKeyMap_(rows) {

  const map = {};

  rows.forEach(function (row) {

    const key = String(row[EVENTS.KEY] || "").trim();

    if (!key) return;

    if (!map[key]) {
      map[key] = row;
    }

  });

  return map;

}


/**
 * ==========================================================
 * Read Existing Events_OPS
 *
 * WHY
 * Events_OPS는 Leads_OPS와 달리 1행이 SUBTOTAL 수식 행이라
 * (헤더는 2행), 22_OPS_Merge.js의 범용 sheetToObjects()를 그대로
 * 쓸 수 없다 (그건 1행을 헤더로 가정함). EVENTS.ROWS.HEADER 기준으로
 * 별도 구현.
 * ==========================================================
 */
function readEventsOPS_() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(EVENTS.SHEET.OPS);

  if (!sheet) return [];

  if (sheet.getLastRow() < EVENTS.ROWS.HEADER) return [];

  const values = sheet.getDataRange().getValues();

  const headerIndex = EVENTS.ROWS.HEADER - 1;

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
