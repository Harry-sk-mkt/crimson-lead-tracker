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
 * v1.14.1
 *
 * Change Log
 * v1.14.1 (2026-08-21)
 * - **버그 수정 — v1.14.0 적용 후에도 짝(충돌)이 없는 단독 dirty 행은
 *   "Marketo Campaign name" 표시 컬럼이 안 정제되고 남아있던 문제(사용자가
 *   rebuild 후 재확인 중 발견)**. v1.14.0은 내부 매칭 키(`EVENTS.KEY`
 *   ="Lead Source Detail")만 정제했는데, 화면에 보이는 "Marketo Campaign
 *   name"은 같은 정규화 키로 병합되는 행이 2개 이상일 때만
 *   `mergeExistingEventsRows_()` 안에서 정제되고 있었음 — 짝이 되는
 *   "깨끗한" 행이 따로 없는 단독 dirty 행은 그 병합 경로 자체를 안 타서
 *   `copyColumns_()`가 원문 그대로 복사해 계속 노출됨. `createEventsKeyMap_()`의
 *   비병합(단독 발견) 분기에도 동일한 정제를 적용해 병합 여부와 무관하게
 *   항상 정제되도록 수정. `testCreateEventsKeyMapNormalizesLegacySuffixes`에
 *   단독 dirty 행("...Ivy Love LG")의 "Marketo Campaign name" 정제
 *   검증 추가.
 * v1.14.0 (2026-08-21)
 * - **버그 수정 — `createEventsKeyMap_()`가 접미사 안 떼진 레거시 Events_OPS
 *   키를 정제 안 하고 있었음(사용자 발견)**. `stripRegistrationFormSuffix_()`/
 *   `stripLGSuffix_()`(EVENTS_002_Engine.js)가 Engine 집계 키 추출
 *   단계에는 적용돼 있었지만 여기(기존 OPS 행 키 읽기)엔 빠져 있어,
 *   두 함수 도입 이전에 생성된 "...| Registered for Webinar from FB LG
 *   Form" 류 원문 키 행이 Engine의 정제된 키와 매칭 안 돼 SF Reg 0인
 *   별도 "유령" 프로그램 행으로 영구히 남아있었음. `createEventsKeyMap_()`/
 *   `mergeExistingEventsRows_()` 양쪽에 두 strip 함수를 EXPO override와
 *   같은 순서로 적용해 다음 빌드부터 정제된 메인 프로그램 키로 자동
 *   병합(숫자 합산)되도록 수정. 신규 테스트
 *   `testCreateEventsKeyMapNormalizesLegacySuffixes` 추가.
 * v1.13.1 (2026-08-19)
 * - `testCreateEventsKeyMapMergesOverrideCollisions`/`testMergeExistingEventsRows`
 *   테스트 데이터 갱신 — CVR/Clicks가 `EVENTS_001_Config.js` v1.11.0에서
 *   GROUP_3_MANUAL(빈 배열이 됨)을 벗어나 GROUP_4_COMPUTED/GROUP_5_DERIVED로
 *   이동하면서 더 이상 `mergeExistingEventsRows_()`의 합산 대상이 아니게 됨
 *   (Engine이 매번 새로 계산하므로 기존 행 병합 대상일 필요가 없어짐, 정상
 *   동작 변경) — 테스트를 여전히 GROUP_2_MANUAL로 남아있는 "Success"
 *   필드로 교체해 실제 동작과 다시 일치시킴. 로직 자체(`mergeExistingEventsRows_`/
 *   `createEventsKeyMap_`)는 변경 없음.
 * v1.13.0 (2026-08-19)
 * - `createEventsKeyMap_()`가 이제 `applyEventsProgramKeyOverride_()`
 *   (EVENTS_002_Engine.js v1.12.0)를 기존 Events_OPS 행의 키에도 적용
 *   — 사용자 요청으로 "Kor-EXPO-Master" 행사 38개 프로그램명 행을 하나로
 *   통합. 신규 `mergeExistingEventsRows_()`(순수 함수) — 충돌 시
 *   GROUP_2_MANUAL/GROUP_3_MANUAL 숫자 컬럼 합산, Notes " / " 연결, 나머지
 *   GROUP_1_MANUAL은 첫 발견 공란 아닌 값 유지(73_Search_Merge.js의 Naver
 *   캠페인 키 충돌 합산 패턴과 동일 관행). 신규 테스트
 *   `testCreateEventsKeyMapMergesOverrideCollisions`/
 *   `testMergeExistingEventsRows` 추가.
 * v1.12.0 (2026-08-09)
 * - `applyRatioFormulas_()` — RATIO_FORMULAS 스펙 컬럼이 header에 없을 때
 *   조용히 건너뛰던 걸 `Logger.log` 경고로 남기도록 수정(qa-review 스킬
 *   Mode 1 테스트런에서 지적된 silent skip 이슈). `testApplyRatioFormulas()`에
 *   존재하지 않는 컬럼을 참조하는 스펙을 추가해 크래시 없이 건너뛰는지 검증.
 * v1.11.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `53_Events_Merge.js` → 신규 `EVENTS_004_Merge.js`, 코드 내용 변경 없음.
 * v1.11.0 (2026-08-09)
 * - `applyGroup5Derived_()`/`divideGuard_()` 삭제(전체 사용처 grep 확인 —
 *   4개 도메인의 동종 함수에서만 쓰였고 이제 전부 대체됨) — 비율 컬럼
 *   (Match Rate/Success %/SP1%/SNP1%/CPNP1/ROAS)을 더 이상 JS에서 계산하지
 *   않는다. 대신 `mergeEventsOPS_()`가 정렬 후 최종 행 배열을 만든 직후,
 *   `EVENTS.RATIO_FORMULAS`(50_Events_Config.js) 스펙대로 각 셀을 실제
 *   시트 수식(`buildRatioFormula_()`, 54_Events_Write.js)으로 채운다 —
 *   사용자 요청(수동 입력값 수정 시 파이프라인 재실행 없이 자동 재계산).
 *   출력값 자체는 기존과 동일(전부 분모 0 → 0 fallback, 변경 없음).
 * v1.10.0 (2026-08-06)
 * - **버그 수정 — `Success %` 분모가 잘못됨(사용자 발견)**. `applyGroup5Derived_()`가
 *   `Success ÷ SF Reg.`로 계산하고 있었는데, 사용자 확인 결과 올바른 공식은
 *   `Success ÷ Mkt Reg.`(시트 R열÷N열) — SP1%(T÷P)/SNP1%(V÷Q)는 원래부터 맞는
 *   분모였음. `testApplyGroup5Derived()` 기대값도 함께 수정(0.2→0.4).
 * v1.9.0 (2026-08-06)
 * - "NP1%" → "SNP1%"로 컬럼명 정정(사용자 요청) — applyGroup5Derived_()/
 *   testApplyGroup5Derived() 참조도 함께 갱신(아래 v1.8.0 로그 텍스트에도
 *   이미 새 이름으로 소급 반영).
 * v1.8.0 (2026-08-06)
 * - applyGroup5Derived_(): "CPL"(Spent÷Leads(Meta)) 계산 라인 제거(컬럼
 *   자체 삭제, 50_Events_Config.js v1.7.0 참고) — "Success %"(Success÷SF
 *   Reg.)/"SP1%"(SP1÷SF P1s)/"SNP1%"(SNPL1÷SF NLP1s) 3개 신규 비율 계산
 *   추가(Match Rate와 동일 패턴, divideGuard_() 0-division 방지).
 * v1.7.0 (2026-07-29)
 * - compareByEventDateBlankFirst_() → compareByEventDateBlankLast_()로
 *   교체 — 빈 Event Date를 최상단이 아닌 최하단으로(전체 OPS 통일, 사용자
 *   확정 — 73_Search_Merge.js 참고). 테스트 함수명 끝 "_"도 같이 제거.
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
 *   별도 로직 불필요 — 정렬(compareByEventDateBlankLast_)도 그대로 재사용.
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
    applyDerivedDateColumns_(row);

    summary.merged++;

    return row;

  });

  rowObjects.sort(compareByEventDateBlankLast_);

  const rows = rowObjects.map(function (row) {
    return EVENTS.HEADER.map(function (col) { return row[col]; });
  });

  applyRatioFormulas_(rows, EVENTS.HEADER, EVENTS.RATIO_FORMULAS, EVENTS.ROWS.DATA_START);

  return { rows: rows, summary: summary };

}


/**
 * ==========================================================
 * Apply Ratio Formulas (값 대신 실제 시트 수식으로 채움)
 *
 * WHY
 * 비율 컬럼(예: Success %)을 JS에서 미리 나눠서 숫자만 쓰면, 분자/분모로
 * 쓰인 수동 입력 컬럼(Spent 등)을 사람이 나중에 고쳐도 비율이 갱신되지
 * 않는다(다음 빌드 전까지). ratioSpecs(도메인별 RATIO_FORMULAS Config)가
 * 지정한 컬럼 짝을 실제 셀 참조 수식으로 바꿔서, 시트 자체가 항상
 * 최신값을 보여주게 한다(사용자 요청).
 *
 * INPUT
 * rows        : Array<Array>  (header 순서로 이미 매핑된 최종 행 배열, in-place 수정)
 * header      : string[]      (컬럼 순서)
 * ratioSpecs  : {column, numerator, denominator}[]
 * dataStartRow: number        (1-based, 이 배열의 0번째 행이 시트에서 몇 행부터 시작하는지)
 *
 * NOTE
 * ratioSpecs의 column/numerator/denominator 중 하나라도 header에 없으면
 * (RATIO_FORMULAS Config 오타/컬럼명 변경 후 갱신 누락 등) 그 스펙만 조용히
 * 건너뛰던 걸 2026-08-09부터 Logger.log 경고로 남긴다 — QA 리뷰에서 지적된
 * silent skip(에러 없이 그 컬럼만 수식이 안 채워짐) 재발 방지.
 *
 * TEST
 * testApplyRatioFormulas 참고
 * ==========================================================
 */
function applyRatioFormulas_(rows, header, ratioSpecs, dataStartRow) {

  const columnLetters = header.map(function (_, i) {
    return columnIndexToLetter_(i + 1);
  });

  ratioSpecs.forEach(function (spec) {

    const colIndex = header.indexOf(spec.column);
    const numLetter = columnLetters[header.indexOf(spec.numerator)];
    const denLetter = columnLetters[header.indexOf(spec.denominator)];

    if (colIndex === -1 || !numLetter || !denLetter) {
      Logger.log("⚠️ applyRatioFormulas_: RATIO_FORMULAS 스펙 컬럼을 header에서 찾을 수 없어 건너뜀 — " +
        JSON.stringify(spec));
      return;
    }

    rows.forEach(function (row, i) {
      row[colIndex] = buildRatioFormula_(numLetter, denLetter, dataStartRow + i, 0);
    });

  });

}


/**
 * ==========================================================
 * TEST — applyRatioFormulas_()
 * ==========================================================
 */
function testApplyRatioFormulas() {

  const header = ["Num", "Den", "Ratio"];
  const rows = [["10", "5", ""], ["20", "4", ""]];
  const ratioSpecs = [
    { column: "Ratio", numerator: "Num", denominator: "Den" },
    { column: "Ratio", numerator: "Num", denominator: "MissingCol" }   // 존재하지 않는 컬럼 — 경고 후 건너뜀, 크래시 없어야 함
  ];

  applyRatioFormulas_(rows, header, ratioSpecs, 3);

  const pass =
    rows[0][2] === "=IFERROR(A3/B3,0)" &&
    rows[1][2] === "=IFERROR(A4/B4,0)";

  Logger.log("Result: " + JSON.stringify(rows));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

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
 * Compare Rows By Event Date (빈 날짜 최하단, 나머지는 내림차순 — 2026-07-29)
 *
 * WHY
 * 원래 "빈 날짜 신규 행은 최상단" 요구사항으로 설계됐으나(스프레드시트
 * 기본 정렬은 빈 값이 항상 맨 뒤라 sortSheetByDate() 대신 쓰기 전 JS
 * 배열 단계에서 직접 정렬), Search_OPS에서 신규 키 대거 유입으로 빈
 * 날짜가 최상단을 차지해 실데이터 있는 캠페인들을 밀어내는 문제 발견
 * (사용자 확인) — 빈 날짜를 최하단으로 변경, 전체 OPS 통일(사용자 확정).
 *
 * TEST
 * testCompareByEventDateBlankLast 참고
 * ==========================================================
 */
function compareByEventDateBlankLast_(a, b) {

  const dateA = a["Event Date"];
  const dateB = b["Event Date"];

  const validA = dateA instanceof Date && !isNaN(dateA.getTime());
  const validB = dateB instanceof Date && !isNaN(dateB.getTime());

  if (!validA && !validB) return 0;
  if (!validA) return 1;
  if (!validB) return -1;

  return dateB.getTime() - dateA.getTime();

}


/**
 * ==========================================================
 * TEST — compareByEventDateBlankLast_()
 * ==========================================================
 */
function testCompareByEventDateBlankLast() {

  const rows = [
    { "Lead Source Detail": "old", "Event Date": new Date(2026, 0, 1) },
    { "Lead Source Detail": "blank1", "Event Date": "" },
    { "Lead Source Detail": "new", "Event Date": new Date(2026, 5, 1) },
    { "Lead Source Detail": "blank2", "Event Date": "" }
  ];

  rows.sort(compareByEventDateBlankLast_);

  const order = rows.map(function (r) { return r["Lead Source Detail"]; });

  const pass =
    order[0] === "new" && order[1] === "old" &&
    order[2] === "blank1" && order[3] === "blank2";

  Logger.log("Order: " + JSON.stringify(order));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Create Key Lookup Map (UTM Key 기준, 접미사 정규화 + EVENTS_PROGRAM_KEY_OVERRIDE
 * 적용 후 충돌 시 병합)
 *
 * WHY
 * 51_Events_Engine.js(EVENTS_002_Engine.js) v1.12.0의
 * `EVENTS_PROGRAM_KEY_OVERRIDE`(예: EXPO 38개 프로그램명 →
 * "Kor-EXPO-Master")가 Engine 집계 키는 이미 통합하지만, 기존
 * Events_OPS 시트엔 여전히 그 38개 프로그램명 각각의 행이 남아있고 그
 * 안에 사람이 직접 입력한 Manual 값(Reg./Success/Spent 관련 수동 컬럼/
 * Notes 등)이 들어있을 수 있다. 여기서도 같은 override를 적용해 같은
 * 키로 묶고, 충돌하면 `mergeExistingEventsRows_()`로 합쳐서 데이터
 * 유실 없이 한 행으로 만든다(사용자 확정, 2026-08-19 — 숫자 컬럼 합산,
 * Notes는 연결).
 *
 * **2026-08-21 추가**: `stripRegistrationFormSuffix_()`/`stripLGSuffix_()`
 * (EVENTS_002_Engine.js, 각각 2026-07-24/2026-08-06 도입)가 MTA_Master/
 * Leads_Master/Deal Tracker 집계 키 추출 단계에는 이미 적용돼 있었지만,
 * 여기(기존 Events_OPS 행 키 읽기)엔 빠져 있었음 — 그 결과 두 함수 도입
 * 이전에 이미 생성된 Events_OPS 행("...| Registered for Webinar from FB
 * LG Form" 등 접미사가 안 떼진 원문 키)이 Engine의 정제된 키와 영원히
 * 매칭되지 않아 SF Reg 0인 별도 "유령" 프로그램 행으로 계속 남는 버그
 * 발견(사용자 발견, 2026-08-21). EXPO override와 동일하게 여기서도
 * 정제해 같은 키로 묶이도록 수정.
 *
 * TEST
 * testCreateEventsKeyMapMergesOverrideCollisions 참고
 * testCreateEventsKeyMapNormalizesLegacySuffixes 참고
 * ==========================================================
 */
function createEventsKeyMap_(rows) {

  const map = {};

  rows.forEach(function (row) {

    const rawKey = String(row[EVENTS.KEY] || "").trim();

    if (!rawKey) return;

    const key = applyEventsProgramKeyOverride_(stripLGSuffix_(stripRegistrationFormSuffix_(rawKey)));

    if (map[key]) {

      map[key] = mergeExistingEventsRows_(map[key], row);

    } else {

      // 충돌(병합) 없이 단독으로 발견된 행도 "Marketo Campaign name" 표시
      // 컬럼을 동일하게 정제 — mergeExistingEventsRows_()의 정규화 로직은
      // 충돌 시에만 타므로, 단독 dirty 행은 별도로 처리해야 함(2026-08-21,
      // 사용자가 rebuild 후에도 접미사 안 떼진 행이 남아있는 걸 발견해서
      // 추가 수정).
      const normalizedRow = Object.assign({}, row);
      normalizedRow["Marketo Campaign name"] = applyEventsProgramKeyOverride_(
        stripLGSuffix_(stripRegistrationFormSuffix_(row["Marketo Campaign name"]))
      );
      map[key] = normalizedRow;

    }

  });

  return map;

}


/**
 * ==========================================================
 * Merge Existing Events_OPS Rows (같은 override 키로 묶인 기존 행 병합, 순수 함수)
 *
 * WHY
 * EVENTS.GROUP_2_MANUAL/GROUP_3_MANUAL(Reg./Success/SP1/SNPL1/CVR/
 * Clicks/Results 등 숫자 수동 입력)은 합산, Notes는 " / "로 연결(공란
 * 스킵), 나머지 GROUP_1_MANUAL(Event Date/Marketo Campaign name/
 * Target Market/Division/EventType/PIC/Speaker/Time)은 첫 번째로
 * 발견된 공란 아닌 값을 유지(사용자 확정, 2026-08-19). ⚠️ CVR은
 * 원래 비율(%) 값이라 단순 합산이 통계적으로 정확하진 않지만, 사용자가
 * 명시적으로 다른 숫자 컬럼과 동일하게 합쳐달라고 요청 — 임의로 다른
 * 처리(평균 등)로 바꾸지 않음. Marketo Campaign name이 override 대상
 * 원본 키(38개 중 하나) 그대로 병합되는 경우를 대비해 최종적으로
 * applyEventsProgramKeyOverride_()를 한 번 더 통과시켜 "Kor-EXPO-Master"로
 * 정규화.
 *
 * INPUT
 * a, b : Object  (병합 대상 두 기존 행 — a가 먼저 발견된 행)
 *
 * OUTPUT
 * Object  (병합된 새 행)
 *
 * TEST
 * testMergeExistingEventsRows 참고
 * ==========================================================
 */
function mergeExistingEventsRows_(a, b) {

  const merged = {};

  merged[EVENTS.KEY] = a[EVENTS.KEY];

  EVENTS.GROUP_2_MANUAL.concat(EVENTS.GROUP_3_MANUAL).forEach(function (col) {
    merged[col] = (Number(a[col]) || 0) + (Number(b[col]) || 0);
  });

  EVENTS.GROUP_1_MANUAL.forEach(function (col) {

    if (col === "Notes") {

      const notes = [a["Notes"], b["Notes"]]
        .map(function (v) { return String(v || "").trim(); })
        .filter(function (v) { return v; });

      merged["Notes"] = notes.join(" / ");

      return;

    }

    const valA = a[col];
    const isBlankA = valA === "" || valA === null || valA === undefined;

    merged[col] = isBlankA ? b[col] : valA;

  });

  merged["Marketo Campaign name"] = applyEventsProgramKeyOverride_(
    stripLGSuffix_(stripRegistrationFormSuffix_(merged["Marketo Campaign name"]))
  );

  return merged;

}


/**
 * ==========================================================
 * TEST — createEventsKeyMap_()의 override 충돌 병합
 * ==========================================================
 */
function testCreateEventsKeyMapMergesOverrideCollisions() {

  const rows = [
    {
      "Lead Source Detail": "EV-2026-04-KOR-MOFU-Core EXPO META",
      "Marketo Campaign name": "EV-2026-04-KOR-MOFU-Core EXPO META",
      "Mkt Reg.": 10,
      "Success": 5,
      "Notes": "META 채널 메모"
    },
    {
      "Lead Source Detail": "EV-2026-03-KOR-MOFU-Core EXPO Kakao DA",
      "Marketo Campaign name": "EV-2026-03-KOR-MOFU-Core EXPO Kakao DA",
      "Mkt Reg.": 7,
      "Success": 3,
      "Notes": "Kakao DA 메모"
    },
    {
      "Lead Source Detail": "EV-2025-07-KOR-MOFU-Core Unrelated",
      "Marketo Campaign name": "EV-2025-07-KOR-MOFU-Core Unrelated",
      "Mkt Reg.": 100
    }
  ];

  const map = createEventsKeyMap_(rows);

  const pass =
    Object.keys(map).length === 2 &&
    map["Kor-EXPO-Master"]["Mkt Reg."] === 17 &&
    map["Kor-EXPO-Master"]["Success"] === 8 &&
    map["Kor-EXPO-Master"]["Notes"] === "META 채널 메모 / Kakao DA 메모" &&
    map["Kor-EXPO-Master"]["Marketo Campaign name"] === "Kor-EXPO-Master" &&
    map["EV-2025-07-KOR-MOFU-Core Unrelated"]["Mkt Reg."] === 100;

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * TEST — createEventsKeyMap_()이 접미사 안 떼진 레거시 키를 정제된
 * 메인 프로그램 키로 병합하는지 (2026-08-21 버그 수정 검증)
 * ==========================================================
 */
function testCreateEventsKeyMapNormalizesLegacySuffixes() {

  const rows = [
    {
      "Lead Source Detail": "WB-2026-08-KOR-MOFU-Core College Research: HYPS & Ivy",
      "Marketo Campaign name": "WB-2026-08-KOR-MOFU-Core College Research: HYPS & Ivy",
      "Mkt Reg.": 50,
      "Success": 20
    },
    {
      "Lead Source Detail": "WB-2026-08-KOR-MOFU-Core College Research: HYPS & IvyㅣRegistered for Webinar from FB LG Form",
      "Marketo Campaign name": "WB-2026-08-KOR-MOFU-Core College Research: HYPS & IvyㅣRegistered for Webinar from FB LG Form",
      "Mkt Reg.": 3,
      "Success": 0
    },
    {
      "Lead Source Detail": "WB-2026-05-KOR-MOFU-Core Profiles HYPS and Ivy Love LG",
      "Marketo Campaign name": "WB-2026-05-KOR-MOFU-Core Profiles HYPS and Ivy Love LG",
      "Mkt Reg.": 4,
      "Success": 1
    }
  ];

  const map = createEventsKeyMap_(rows);

  const pass =
    Object.keys(map).length === 2 &&
    map["WB-2026-08-KOR-MOFU-Core College Research: HYPS & Ivy"]["Mkt Reg."] === 53 &&
    map["WB-2026-08-KOR-MOFU-Core College Research: HYPS & Ivy"]["Success"] === 20 &&
    map["WB-2026-08-KOR-MOFU-Core College Research: HYPS & Ivy"]["Marketo Campaign name"] ===
      "WB-2026-08-KOR-MOFU-Core College Research: HYPS & Ivy" &&
    map["WB-2026-05-KOR-MOFU-Core Profiles HYPS and Ivy Love"]["Mkt Reg."] === 4 &&
    // 짝(충돌)이 없는 단독 dirty 행도 "Marketo Campaign name" 표시 컬럼이
    // 정제돼야 함 — mergeExistingEventsRows_() 병합 경로를 안 타는 케이스
    map["WB-2026-05-KOR-MOFU-Core Profiles HYPS and Ivy Love"]["Marketo Campaign name"] ===
      "WB-2026-05-KOR-MOFU-Core Profiles HYPS and Ivy Love";

  Logger.log("Keys: " + JSON.stringify(Object.keys(map)));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * TEST — mergeExistingEventsRows_() 개별 필드 정책
 * ==========================================================
 */
function testMergeExistingEventsRows() {

  const a = {
    "Lead Source Detail": "Kor-EXPO-Master",
    "Event Date": "",
    "Division": "Core",
    "Mkt Reg.": 10,
    "Success": 3,
    "Notes": ""
  };

  const b = {
    "Lead Source Detail": "EV-2026-04-KOR-MOFU-Core EXPO META",
    "Event Date": "2026-04-15",
    "Division": "",
    "Mkt Reg.": 5,
    "Success": 2,
    "Notes": "META 메모"
  };

  const merged = mergeExistingEventsRows_(a, b);

  const pass =
    merged["Event Date"] === "2026-04-15" &&   // a가 공란이라 b 값 채택
    merged["Division"] === "Core" &&            // a가 값 있어 유지
    merged["Mkt Reg."] === 15 &&                // 합산
    merged["Success"] === 5 &&                  // 합산
    merged["Notes"] === "META 메모";             // a 공란 스킵, b만 채택

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

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
