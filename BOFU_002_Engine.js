/**
 * ==========================================================
 * Marketing 2.0
 * BOFU Engine (Aggregate Table)
 *
 * Responsibility
 * Leads_Master / MTA_Master / Leads_OPS 전체를 스캔하여 Marketo Program
 * 이름(Lead Source Detail/First Touch Detail 필드, Business Segment=BOFU,
 * KOR만 대상) 기준으로 지표를 미리 계산해 BOFU_Engine(숨김) 시트에
 * 저장한다. 51_Events_Engine.js와 동일한 "Disposable, 매번 전체 재계산"
 * 패턴 — Events 코드 자체는 수정하지 않고(Article 5), 여기서 별도로
 * BOFU 전용 집계 함수를 둔다.
 *
 * ⚠️ 국가/문자열 정제 관련 범용 헬퍼(stripRegistrationFormSuffix_,
 * isKoreanProgram_)는 51_Events_Engine.js의 정의를 그대로 재사용한다
 * (BOFU 전용 로직이 아니라 Marketo Program 이름 문자열 자체의 일반
 * 속성이므로 — 전역 네임스페이스 중복 방지 위해 재정의하지 않음).
 *
 * ⚠️ P1 판정: Events(51_Events_Engine.js)는 Lead Priority에 대해 느슨한
 * substring 비교(indexOf("1"))를 쓰는데, 이는 ACQ_REP/NewP1_REP에서
 * 이미 발견되어 고쳐진 버그(예: "Priority 10" 오탐 가능) 패턴이다.
 * BOFU 설계 문서가 명시적으로 "기존 정의"(Priority Override → Lead
 * Priority, isEffectiveP1_ 방식)를 지정했으므로, BOFU는 정확한 문자열
 * 일치("Priority 1")로 판정한다. MTA_Master/Leads_Master 단계엔
 * Priority Override 컬럼 자체가 없어(Leads_OPS 전용 Manual 컬럼) 그
 * 부분은 적용 대상 아님 — Lead Priority exact match만 적용.
 *
 * 호출 시점
 * - appendNewLeads(), appendNewMTA()(syncMTAFunnelToOPS_ 경유)
 * - rebuildLeadsMaster(), rebuildMTAMaster()
 * (refreshEventsEngine_()/refreshACQSummary_()/refreshNewP1Engine_()와
 * 동일한 4개 지점, 07/09/10 파일에 나란히 배선)
 *
 * Version
 * v1.1.1
 *
 * Change Log
 * v1.1.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `61_BOFU_Engine.js` → 신규 `BOFU_002_Engine.js`, 코드 내용 변경 없음.
 * v1.1.0 (2026-07-28)
 * - #Deals/Revenue를 Leads_OPS(Opportunity Won Date/Revenue, 리드 단위)
 *   대신 Deal Tracker 기반으로 전환 (2트랙 아키텍처, CLAUDE.md #7).
 *   aggregateBOFUFunnelRecords_()에서 dealsWon/revenue 제거. 신규
 *   computeBOFUDealAggregates_() — computeDealTrackerCountsByKey_()
 *   (90_TargetEngine.js)를 stripRegistrationFormSuffix_()+isKoreanProgram_()
 *   (51_Events_Engine.js 재사용) 키 정규화로 감싸 재사용. refreshBOFUEngine_()
 *   배선 변경. 상세: docs/Changelog.md 2026-07-28.
 * v1.0.0
 * - 최초 구현.
 * ==========================================================
 */


/**
 * ==========================================================
 * Refresh BOFU Engine (전체 재계산)
 * ==========================================================
 */
function refreshBOFUEngine_() {

  const start = new Date();

  Logger.log(CONFIG.LOG.PREFIX + " BOFU Engine Refresh Started");

  const mtaAgg = computeBOFUMTAAggregates_();
  const leadsAgg = computeBOFULeadsAggregates_();
  const funnelAgg = computeBOFUFunnelAggregates_(leadsAgg.leadIdToKey);
  const dealAgg = computeBOFUDealAggregates_();

  const allKeys = {};

  [
    mtaAgg.allRegistered, mtaAgg.p1All,
    leadsAgg.newRegistered, leadsAgg.nlP1,
    funnelAgg.icRequest, funnelAgg.icBooked,
    funnelAgg.icComplete, dealAgg.dealsWon, dealAgg.revenue
  ].forEach(function (map) {
    Object.keys(map).forEach(function (key) {
      allKeys[key] = true;
    });
  });

  const rows = Object.keys(allKeys).map(function (key) {

    return [
      key,
      mtaAgg.allRegistered[key] || 0,
      leadsAgg.newRegistered[key] || 0,
      mtaAgg.p1All[key] || 0,
      leadsAgg.nlP1[key] || 0,
      funnelAgg.icRequest[key] || 0,
      funnelAgg.icBooked[key] || 0,
      funnelAgg.icComplete[key] || 0,
      dealAgg.dealsWon[key] || 0,
      dealAgg.revenue[key] || 0
    ];

  });

  writeBOFUEngine_(rows);

  const seconds = ((new Date() - start) / 1000).toFixed(2);

  Logger.log(
    CONFIG.LOG.PREFIX + " BOFU Engine Refresh Completed : " +
    rows.length + " rows (" + seconds + "s)"
  );

}


/**
 * ==========================================================
 * Is Effective BOFU P1 (정확한 문자열 일치)
 *
 * WHY
 * 위 파일 헤더 WHY 참고 — Events의 substring 비교 버그를 반복하지
 * 않기 위해 exact match만 사용.
 *
 * TEST
 * testIsEffectiveBOFUP1_ 참고
 * ==========================================================
 */
function isEffectiveBOFUP1_(leadPriority) {

  return String(leadPriority || "").trim() === "Priority 1";

}


/**
 * ==========================================================
 * TEST — isEffectiveBOFUP1_()
 * ==========================================================
 */
function testIsEffectiveBOFUP1_() {

  const pass =
    isEffectiveBOFUP1_("Priority 1") === true &&
    isEffectiveBOFUP1_("Priority 10") === false &&
    isEffectiveBOFUP1_("Priority 2") === false &&
    isEffectiveBOFUP1_("") === false;

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute BOFU MTA Aggregates (SF Reg. / SF P1s)
 *
 * WHY
 * SF Reg.는 "모든 터치"를 세는 지표라 MTA_Master(터치 레벨)를 스캔한다.
 * stripRegistrationFormSuffix_()/isKoreanProgram_()은 51_Events_Engine.js
 * 재사용.
 *
 * OUTPUT
 * { allRegistered: {key: count}, p1All: {key: count} }
 *
 * TEST
 * testComputeBOFUMTAAggregates_ 참고
 * ==========================================================
 */
function computeBOFUMTAAggregates_() {

  const allRegistered = {};
  const p1All = {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);

  if (!sheet) return { allRegistered, p1All };

  aggregateBOFUMTATouchRecords_(sheetToObjects(sheet), allRegistered, p1All);

  return { allRegistered, p1All };

}


/**
 * ==========================================================
 * Aggregate BOFU MTA Touch Records (순수 함수, 테스트용으로 분리)
 * ==========================================================
 */
function aggregateBOFUMTATouchRecords_(records, allRegistered, p1All) {

  records.forEach(function (r) {

    if (BOFU.SEGMENTS.indexOf(r["Business Segment"]) === -1) return;

    const key = stripRegistrationFormSuffix_(r[BOFU.MATCH_FIELD.MTA]);

    if (!key || !isKoreanProgram_(key)) return;

    allRegistered[key] = (allRegistered[key] || 0) + 1;

    if (isEffectiveBOFUP1_(r["Lead Priority"])) {
      p1All[key] = (p1All[key] || 0) + 1;
    }

  });

}


/**
 * ==========================================================
 * TEST — aggregateBOFUMTATouchRecords_()
 * ==========================================================
 */
function testComputeBOFUMTAAggregates_() {

  const records = [
    { "Business Segment": "BOFU", "Lead Source Detail": "WF-2025-07-KOR-BOFU-Core A", "Lead Priority": "Priority 1" },
    { "Business Segment": "BOFU", "Lead Source Detail": "WF-2025-07-KOR-BOFU-Core A", "Lead Priority": "Priority 2" },
    { "Business Segment": "BOFU", "Lead Source Detail": "WF-2025-07-KOR-BOFU-Core A | Registered for Webinar from Website Form", "Lead Priority": "Priority 1" }, // 접미사만 다름 → 같은 키
    { "Business Segment": "Webinar", "Lead Source Detail": "WB-2025-07-KOR-MOFU-Core B", "Lead Priority": "Priority 1" },  // segment 필터로 제외
    { "Business Segment": "BOFU", "Lead Source Detail": "WF-2025-07-US-BOFU-Core C", "Lead Priority": "Priority 1" }       // KOR 아님 → 제외
  ];

  const allRegistered = {};
  const p1All = {};

  aggregateBOFUMTATouchRecords_(records, allRegistered, p1All);

  const pass =
    allRegistered["WF-2025-07-KOR-BOFU-Core A"] === 3 &&
    p1All["WF-2025-07-KOR-BOFU-Core A"] === 2 &&
    Object.keys(allRegistered).length === 1;

  Logger.log("Result: " + JSON.stringify({ allRegistered, p1All }));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute BOFU Leads Aggregates (SF NL / SF NLP1s)
 *
 * OUTPUT
 * { newRegistered: {key: count}, nlP1: {key: count},
 *   leadIdToKey: {leadId: key} }
 *
 * TEST
 * testComputeBOFULeadsAggregates_ 참고
 * ==========================================================
 */
function computeBOFULeadsAggregates_() {

  const newRegistered = {};
  const nlP1 = {};
  const leadIdToKey = {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS_MASTER);

  if (!sheet) return { newRegistered, nlP1, leadIdToKey };

  aggregateBOFULeadsRecords_(sheetToObjects(sheet), newRegistered, nlP1, leadIdToKey);

  return { newRegistered, nlP1, leadIdToKey };

}


/**
 * ==========================================================
 * Aggregate BOFU Leads Records (순수 함수, 테스트용으로 분리)
 * ==========================================================
 */
function aggregateBOFULeadsRecords_(records, newRegistered, nlP1, leadIdToKey) {

  records.forEach(function (r) {

    if (BOFU.SEGMENTS.indexOf(r["Business Segment"]) === -1) return;

    const key = stripRegistrationFormSuffix_(r[BOFU.MATCH_FIELD.LEADS]);

    if (!key || !isKoreanProgram_(key)) return;

    newRegistered[key] = (newRegistered[key] || 0) + 1;

    if (isEffectiveBOFUP1_(r["Lead Priority"])) {
      nlP1[key] = (nlP1[key] || 0) + 1;
    }

    const leadId = String(r["Lead ID"] || "").trim();

    if (leadId) {
      leadIdToKey[leadId] = key;
    }

  });

}


/**
 * ==========================================================
 * TEST — aggregateBOFULeadsRecords_()
 * ==========================================================
 */
function testComputeBOFULeadsAggregates_() {

  const records = [
    { "Business Segment": "BOFU", "First Touch Detail": "WF-2025-07-KOR-BOFU-Core A", "Lead Priority": "Priority 1", "Lead ID": "L1" },
    { "Business Segment": "Search", "First Touch Detail": "WF-2025-07-KOR-BOFU-Core A", "Lead Priority": "Priority 1", "Lead ID": "L2" }, // segment 필터로 제외
    { "Business Segment": "BOFU", "First Touch Detail": "WF-2025-07-US-BOFU-Core C", "Lead Priority": "Priority 1", "Lead ID": "L3" }      // KOR 아님 → 제외
  ];

  const newRegistered = {};
  const nlP1 = {};
  const leadIdToKey = {};

  aggregateBOFULeadsRecords_(records, newRegistered, nlP1, leadIdToKey);

  const pass =
    newRegistered["WF-2025-07-KOR-BOFU-Core A"] === 1 &&
    nlP1["WF-2025-07-KOR-BOFU-Core A"] === 1 &&
    leadIdToKey["L1"] === "WF-2025-07-KOR-BOFU-Core A" &&
    leadIdToKey["L2"] === undefined &&
    leadIdToKey["L3"] === undefined;

  Logger.log("Result: " + JSON.stringify({ newRegistered, nlP1, leadIdToKey }));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute BOFU Funnel Aggregates (IC Request/Booked/Complete)
 *
 * WHY (2026-07-28 Deals·Revenue 분리)
 * "모든 리포트는 Leads_OPS를 읽는다" 원칙 유지 — Leads_OPS에서 그대로
 * 읽고 leadIdToKey(Leads_Master 기준, First Touch)로 조인해 First Touch
 * Attribution을 보장한다 (Events와 동일 하이브리드 패턴). Deals(Won)/
 * Revenue는 2트랙 아키텍처(CLAUDE.md #7)에 따라 Deal Tracker 기반으로
 * 전환됨 — computeBOFUDealAggregates_() 참고.
 *
 * TEST
 * testComputeBOFUFunnelAggregates_ 참고
 * ==========================================================
 */
function computeBOFUFunnelAggregates_(leadIdToKey) {

  const icRequest = {};
  const icBooked = {};
  const icComplete = {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(OPS.SHEET.OPS);

  if (!sheet) return { icRequest, icBooked, icComplete };

  aggregateBOFUFunnelRecords_(
    sheetToObjects(sheet),
    leadIdToKey,
    icRequest, icBooked, icComplete
  );

  return { icRequest, icBooked, icComplete };

}


/**
 * ==========================================================
 * Aggregate BOFU Funnel Records (순수 함수, 테스트용으로 분리)
 * ==========================================================
 */
function aggregateBOFUFunnelRecords_(opsRecords, leadIdToKey, icRequest, icBooked, icComplete) {

  opsRecords.forEach(function (r) {

    const leadId = String(r["Lead ID"] || "").trim();

    if (!leadId) return;

    const key = leadIdToKey[leadId];

    if (!key) return;

    if ((Number(r["Total IC Requests"]) || 0) > 0) {
      icRequest[key] = (icRequest[key] || 0) + 1;
    }

    if (isValidDate_(r["IC Booked Date"])) {
      icBooked[key] = (icBooked[key] || 0) + 1;
    }

    if (isValidDate_(r["IC Completed Date"])) {
      icComplete[key] = (icComplete[key] || 0) + 1;
    }

  });

}


/**
 * ==========================================================
 * TEST — aggregateBOFUFunnelRecords_()
 * ==========================================================
 */
function testComputeBOFUFunnelAggregates_() {

  const leadIdToKey = { "L1": "WF-2025-07-KOR-BOFU-Core A" };

  const opsRecords = [
    { "Lead ID": "L1", "Total IC Requests": 1, "IC Booked Date": new Date(2026, 0, 1), "IC Completed Date": "" },
    { "Lead ID": "L2", "Total IC Requests": 1, "IC Booked Date": new Date(2026, 0, 1), "IC Completed Date": "" } // leadIdToKey에 없음 → 제외
  ];

  const icRequest = {}, icBooked = {}, icComplete = {};

  aggregateBOFUFunnelRecords_(opsRecords, leadIdToKey, icRequest, icBooked, icComplete);

  const pass =
    icRequest["WF-2025-07-KOR-BOFU-Core A"] === 1 &&
    icBooked["WF-2025-07-KOR-BOFU-Core A"] === 1 &&
    Object.keys(icRequest).length === 1;

  Logger.log("Result: " + JSON.stringify({ icRequest, icBooked, icComplete }));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute BOFU Deal Tracker Aggregates (#Deals/Revenue)
 *
 * WHY (2026-07-28, 2트랙 아키텍처 — CLAUDE.md #7)
 * #Deals/Revenue는 더 이상 Leads_OPS(Opportunity Won Date/Revenue, 리드
 * 단위)로 계산하지 않는다 — Deal Tracker 자체의 Lead Source Detail(프로그램명)
 * 을 기존 매칭 키와 동일하게 정규화(stripRegistrationFormSuffix_ +
 * isKoreanProgram_, 51_Events_Engine.js 재사용)해서 바로 집계한다. BOFU는
 * Events와 달리 EVENT_TYPE_PREFIXES 필터가 없다(단일 세그먼트라 불필요).
 *
 * OUTPUT
 * { dealsWon: {utmKey: count}, revenue: {utmKey: sum} }
 * ==========================================================
 */
function computeBOFUDealAggregates_() {

  return computeDealTrackerCountsByKey_(readDealTrackerRawRows_(), function (row) {

    const key = stripRegistrationFormSuffix_(row.leadSourceDetail);

    return (key && isKoreanProgram_(key)) ? key : null;

  });

}


/**
 * ==========================================================
 * TEST — computeBOFUDealAggregates_()의 keyFn 로직
 * ==========================================================
 */
function testComputeBOFUDealAggregates_() {

  const dealRows = [
    { leadSourceDetail: "WF-2025-07-KOR-BOFU-Core A", revenue: 500 },
    { leadSourceDetail: "WF-2025-07-US-BOFU-Core B", revenue: 999 }  // KOR 아님, 제외
  ];

  const keyFn = function (row) {
    const key = stripRegistrationFormSuffix_(row.leadSourceDetail);
    return (key && isKoreanProgram_(key)) ? key : null;
  };

  const result = computeDealTrackerCountsByKey_(dealRows, keyFn);

  const pass =
    result.revenue["WF-2025-07-KOR-BOFU-Core A"] === 500 &&
    Object.keys(result.revenue).length === 1;

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Write BOFU Engine to Sheet (없으면 생성, 숨김 유지)
 * ==========================================================
 */
function writeBOFUEngine_(rows) {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(BOFU.SHEET.ENGINE);

  if (!sheet) {
    sheet = ss.insertSheet(BOFU.SHEET.ENGINE);
  }

  sheet.clearContents();

  sheet.getRange(1, 1, 1, BOFU_ENGINE_HEADERS.length)
    .setValues([BOFU_ENGINE_HEADERS]);

  if (rows.length > 0) {

    sheet.getRange(2, 1, rows.length, BOFU_ENGINE_HEADERS.length)
      .setValues(rows);

  }

  sheet.hideSheet();

  SpreadsheetApp.flush();

}


/**
 * ==========================================================
 * Read BOFU Engine as Lookup Map (key → Row Object)
 * ==========================================================
 */
function readBOFUEngineMap_() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(BOFU.SHEET.ENGINE);

  const map = {};

  if (!sheet) return map;

  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) return map;

  const headers = values[0];

  for (let i = 1; i < values.length; i++) {

    const row = values[i];
    const key = String(row[0] || "").trim();

    if (!key) continue;

    const obj = {};

    headers.forEach(function (header, c) {
      obj[String(header).trim()] = row[c];
    });

    map[key] = obj;

  }

  return map;

}


/**
 * ==========================================================
 * Manual-run public wrapper (Apps Script 편집기 Run 드롭다운 노출용)
 * ==========================================================
 */
function runRefreshBOFUEngine() {

  refreshBOFUEngine_();

}


/**
 * ==========================================================
 * Investigate BOFU Program Count (1회성 진단, 수동 실행용)
 *
 * WHY
 * 설계 문서 미해결 항목 #5 — Business Segment=BOFU + KR 필터만으로
 * 프로그램 수가 상식적인 범위인지(Events가 385개로 검증됐던 것처럼)
 * 실데이터로 확인. 결과 보고 TYPE 필터 등 추가 조건 필요 여부 판단.
 * ==========================================================
 */
function runInvestigateBOFUProgramCount() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(BOFU.SHEET.ENGINE);

  if (!sheet) {
    throw new Error(BOFU.SHEET.ENGINE + " sheet not found. runRefreshBOFUEngine()를 먼저 실행하세요.");
  }

  const values = sheet.getDataRange().getValues();

  const keys = [];

  for (let i = 1; i < values.length; i++) {
    const key = String(values[i][0] || "").trim();
    if (key) keys.push(key);
  }

  Logger.log("======================================");
  Logger.log("BOFU Program Count Investigation");
  Logger.log("======================================");
  Logger.log("Total programs (BOFU_Engine rows) : " + keys.length);
  Logger.log("");
  Logger.log("---- 샘플 30개 ----");

  keys.slice(0, 30).forEach(function (key) {
    Logger.log(key);
  });

}
