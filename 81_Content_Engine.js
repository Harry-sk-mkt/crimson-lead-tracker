/**
 * ==========================================================
 * Marketing 2.0
 * Content Engine (Aggregate Table)
 *
 * Responsibility
 * Leads_Master / MTA_Master / Leads_OPS 전체를 스캔하여 Marketo Program
 * 이름(Lead Source Detail/First Touch Detail 필드, Business
 * Segment=Content, KOR만 대상) 기준으로 지표를 미리 계산해
 * Content_Engine(숨김) 시트에 저장한다. 61_BOFU_Engine.js와 동일 패턴.
 *
 * ⚠️ 범용 헬퍼(stripRegistrationFormSuffix_, isKoreanProgram_,
 * isValidDate_)는 51_Events_Engine.js 정의를 재사용 — 재정의하지 않음.
 *
 * P1 판정은 BOFU/Search와 동일하게 정확한 문자열 일치("Priority 1")를
 * 쓴다.
 *
 * 호출 시점
 * - appendNewLeads(), appendNewMTA()(syncMTAFunnelToOPS_ 경유)
 * - rebuildLeadsMaster(), rebuildMTAMaster()
 * (다른 Engine들과 동일한 4개 지점, 07/09/10 파일에 나란히 배선)
 *
 * Version
 * v1.1.0
 *
 * Change Log
 * v1.1.0 (2026-07-28)
 * - #Deals/Revenue를 Leads_OPS(Opportunity Won Date/Revenue, 리드 단위)
 *   대신 Deal Tracker 기반으로 전환 (2트랙 아키텍처, CLAUDE.md #7).
 *   aggregateContentFunnelRecords_()에서 dealsWon/revenue 제거. 신규
 *   computeContentDealAggregates_() — computeDealTrackerCountsByKey_()
 *   (90_TargetEngine.js)를 stripRegistrationFormSuffix_()+isKoreanProgram_()
 *   (51_Events_Engine.js 재사용) 키 정규화로 감싸 재사용. refreshContentEngine_()
 *   배선 변경. 상세: docs/Changelog.md 2026-07-28.
 * v1.0.0
 * - 최초 구현.
 * ==========================================================
 */


/**
 * ==========================================================
 * Refresh Content Engine (전체 재계산)
 * ==========================================================
 */
function refreshContentEngine_() {

  const start = new Date();

  Logger.log(CONFIG.LOG.PREFIX + " Content Engine Refresh Started");

  const mtaAgg = computeContentMTAAggregates_();
  const leadsAgg = computeContentLeadsAggregates_();
  const funnelAgg = computeContentFunnelAggregates_(leadsAgg.leadIdToKey);
  const dealAgg = computeContentDealAggregates_();

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

  writeContentEngine_(rows);

  const seconds = ((new Date() - start) / 1000).toFixed(2);

  Logger.log(
    CONFIG.LOG.PREFIX + " Content Engine Refresh Completed : " +
    rows.length + " rows (" + seconds + "s)"
  );

}


/**
 * ==========================================================
 * Is Effective Content P1 (정확한 문자열 일치)
 *
 * TEST
 * testIsEffectiveContentP1_ 참고
 * ==========================================================
 */
function isEffectiveContentP1_(leadPriority) {

  return String(leadPriority || "").trim() === "Priority 1";

}


/**
 * ==========================================================
 * TEST — isEffectiveContentP1_()
 * ==========================================================
 */
function testIsEffectiveContentP1_() {

  const pass =
    isEffectiveContentP1_("Priority 1") === true &&
    isEffectiveContentP1_("Priority 10") === false &&
    isEffectiveContentP1_("Priority 2") === false &&
    isEffectiveContentP1_("") === false;

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Content MTA Aggregates (SF Reg. / SF P1s)
 *
 * TEST
 * testComputeContentMTAAggregates_ 참고
 * ==========================================================
 */
function computeContentMTAAggregates_() {

  const allRegistered = {};
  const p1All = {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);

  if (!sheet) return { allRegistered, p1All };

  aggregateContentMTATouchRecords_(sheetToObjects(sheet), allRegistered, p1All);

  return { allRegistered, p1All };

}


/**
 * ==========================================================
 * Aggregate Content MTA Touch Records (순수 함수, 테스트용으로 분리)
 * ==========================================================
 */
function aggregateContentMTATouchRecords_(records, allRegistered, p1All) {

  records.forEach(function (r) {

    if (CONTENT.SEGMENTS.indexOf(r["Business Segment"]) === -1) return;

    const key = stripRegistrationFormSuffix_(r[CONTENT.MATCH_FIELD.MTA]);

    if (!key || !isKoreanProgram_(key)) return;

    allRegistered[key] = (allRegistered[key] || 0) + 1;

    if (isEffectiveContentP1_(r["Lead Priority"])) {
      p1All[key] = (p1All[key] || 0) + 1;
    }

  });

}


/**
 * ==========================================================
 * TEST — aggregateContentMTATouchRecords_()
 * ==========================================================
 */
function testComputeContentMTAAggregates_() {

  const records = [
    { "Business Segment": "Content", "Lead Source Detail": "WF-2025-07-KOR-MOFU-Core A", "Lead Priority": "Priority 1" },
    { "Business Segment": "Content", "Lead Source Detail": "WF-2025-07-KOR-MOFU-Core A", "Lead Priority": "Priority 2" },
    { "Business Segment": "BOFU", "Lead Source Detail": "WF-2025-07-KOR-BOFU-Core B", "Lead Priority": "Priority 1" },  // segment 필터로 제외
    { "Business Segment": "Content", "Lead Source Detail": "WF-2025-07-US-MOFU-Core C", "Lead Priority": "Priority 1" } // KOR 아님 → 제외
  ];

  const allRegistered = {};
  const p1All = {};

  aggregateContentMTATouchRecords_(records, allRegistered, p1All);

  const pass =
    allRegistered["WF-2025-07-KOR-MOFU-Core A"] === 2 &&
    p1All["WF-2025-07-KOR-MOFU-Core A"] === 1 &&
    Object.keys(allRegistered).length === 1;

  Logger.log("Result: " + JSON.stringify({ allRegistered, p1All }));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Content Leads Aggregates (SF NL / SF NLP1s)
 *
 * TEST
 * testComputeContentLeadsAggregates_ 참고
 * ==========================================================
 */
function computeContentLeadsAggregates_() {

  const newRegistered = {};
  const nlP1 = {};
  const leadIdToKey = {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS_MASTER);

  if (!sheet) return { newRegistered, nlP1, leadIdToKey };

  aggregateContentLeadsRecords_(sheetToObjects(sheet), newRegistered, nlP1, leadIdToKey);

  return { newRegistered, nlP1, leadIdToKey };

}


/**
 * ==========================================================
 * Aggregate Content Leads Records (순수 함수, 테스트용으로 분리)
 * ==========================================================
 */
function aggregateContentLeadsRecords_(records, newRegistered, nlP1, leadIdToKey) {

  records.forEach(function (r) {

    if (CONTENT.SEGMENTS.indexOf(r["Business Segment"]) === -1) return;

    const key = stripRegistrationFormSuffix_(r[CONTENT.MATCH_FIELD.LEADS]);

    if (!key || !isKoreanProgram_(key)) return;

    newRegistered[key] = (newRegistered[key] || 0) + 1;

    if (isEffectiveContentP1_(r["Lead Priority"])) {
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
 * TEST — aggregateContentLeadsRecords_()
 * ==========================================================
 */
function testComputeContentLeadsAggregates_() {

  const records = [
    { "Business Segment": "Content", "First Touch Detail": "WF-2025-07-KOR-MOFU-Core A", "Lead Priority": "Priority 1", "Lead ID": "L1" },
    { "Business Segment": "BOFU", "First Touch Detail": "WF-2025-07-KOR-MOFU-Core A", "Lead Priority": "Priority 1", "Lead ID": "L2" }, // segment 필터로 제외
    { "Business Segment": "Content", "First Touch Detail": "WF-2025-07-US-MOFU-Core C", "Lead Priority": "Priority 1", "Lead ID": "L3" } // KOR 아님 → 제외
  ];

  const newRegistered = {};
  const nlP1 = {};
  const leadIdToKey = {};

  aggregateContentLeadsRecords_(records, newRegistered, nlP1, leadIdToKey);

  const pass =
    newRegistered["WF-2025-07-KOR-MOFU-Core A"] === 1 &&
    nlP1["WF-2025-07-KOR-MOFU-Core A"] === 1 &&
    leadIdToKey["L1"] === "WF-2025-07-KOR-MOFU-Core A" &&
    leadIdToKey["L2"] === undefined &&
    leadIdToKey["L3"] === undefined;

  Logger.log("Result: " + JSON.stringify({ newRegistered, nlP1, leadIdToKey }));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Content Funnel Aggregates (IC Request/Booked/Complete)
 *
 * WHY (2026-07-28 Deals·Revenue 분리)
 * Deals(Won)/Revenue는 2트랙 아키텍처(CLAUDE.md #7)에 따라 Deal Tracker
 * 기반으로 전환됨 — computeContentDealAggregates_() 참고.
 *
 * TEST
 * testComputeContentFunnelAggregates_ 참고
 * ==========================================================
 */
function computeContentFunnelAggregates_(leadIdToKey) {

  const icRequest = {};
  const icBooked = {};
  const icComplete = {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(OPS.SHEET.OPS);

  if (!sheet) return { icRequest, icBooked, icComplete };

  aggregateContentFunnelRecords_(
    sheetToObjects(sheet),
    leadIdToKey,
    icRequest, icBooked, icComplete
  );

  return { icRequest, icBooked, icComplete };

}


/**
 * ==========================================================
 * Aggregate Content Funnel Records (순수 함수, 테스트용으로 분리)
 * ==========================================================
 */
function aggregateContentFunnelRecords_(opsRecords, leadIdToKey, icRequest, icBooked, icComplete) {

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
 * TEST — aggregateContentFunnelRecords_()
 * ==========================================================
 */
function testComputeContentFunnelAggregates_() {

  const leadIdToKey = { "L1": "WF-2025-07-KOR-MOFU-Core A" };

  const opsRecords = [
    { "Lead ID": "L1", "Total IC Requests": 1, "IC Booked Date": new Date(2026, 0, 1), "IC Completed Date": "" },
    { "Lead ID": "L2", "Total IC Requests": 1, "IC Booked Date": new Date(2026, 0, 1), "IC Completed Date": "" } // leadIdToKey에 없음 → 제외
  ];

  const icRequest = {}, icBooked = {}, icComplete = {};

  aggregateContentFunnelRecords_(opsRecords, leadIdToKey, icRequest, icBooked, icComplete);

  const pass =
    icRequest["WF-2025-07-KOR-MOFU-Core A"] === 1 &&
    icBooked["WF-2025-07-KOR-MOFU-Core A"] === 1 &&
    Object.keys(icRequest).length === 1;

  Logger.log("Result: " + JSON.stringify({ icRequest, icBooked, icComplete }));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Content Deal Tracker Aggregates (#Deals/Revenue)
 *
 * WHY (2026-07-28, 2트랙 아키텍처 — CLAUDE.md #7)
 * #Deals/Revenue는 더 이상 Leads_OPS(Opportunity Won Date/Revenue, 리드
 * 단위)로 계산하지 않는다 — Deal Tracker 자체의 Lead Source Detail(프로그램명)
 * 을 기존 매칭 키와 동일하게 정규화(stripRegistrationFormSuffix_ +
 * isKoreanProgram_, 51_Events_Engine.js 재사용)해서 바로 집계한다.
 *
 * OUTPUT
 * { dealsWon: {utmKey: count}, revenue: {utmKey: sum} }
 * ==========================================================
 */
function computeContentDealAggregates_() {

  return computeDealTrackerCountsByKey_(readDealTrackerRawRows_(), function (row) {

    const key = stripRegistrationFormSuffix_(row.leadSourceDetail);

    return (key && isKoreanProgram_(key)) ? key : null;

  });

}


/**
 * ==========================================================
 * TEST — computeContentDealAggregates_()의 keyFn 로직
 * ==========================================================
 */
function testComputeContentDealAggregates_() {

  const dealRows = [
    { leadSourceDetail: "WF-2025-07-KOR-MOFU-Core A", revenue: 500 },
    { leadSourceDetail: "WF-2025-07-US-MOFU-Core B", revenue: 999 }  // KOR 아님, 제외
  ];

  const keyFn = function (row) {
    const key = stripRegistrationFormSuffix_(row.leadSourceDetail);
    return (key && isKoreanProgram_(key)) ? key : null;
  };

  const result = computeDealTrackerCountsByKey_(dealRows, keyFn);

  const pass =
    result.revenue["WF-2025-07-KOR-MOFU-Core A"] === 500 &&
    Object.keys(result.revenue).length === 1;

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Write Content Engine to Sheet (없으면 생성, 숨김 유지)
 * ==========================================================
 */
function writeContentEngine_(rows) {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(CONTENT.SHEET.ENGINE);

  if (!sheet) {
    sheet = ss.insertSheet(CONTENT.SHEET.ENGINE);
  }

  sheet.clearContents();

  sheet.getRange(1, 1, 1, CONTENT_ENGINE_HEADERS.length)
    .setValues([CONTENT_ENGINE_HEADERS]);

  if (rows.length > 0) {

    sheet.getRange(2, 1, rows.length, CONTENT_ENGINE_HEADERS.length)
      .setValues(rows);

  }

  sheet.hideSheet();

  SpreadsheetApp.flush();

}


/**
 * ==========================================================
 * Read Content Engine as Lookup Map (key → Row Object)
 * ==========================================================
 */
function readContentEngineMap_() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONTENT.SHEET.ENGINE);

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
function runRefreshContentEngine() {

  refreshContentEngine_();

}


/**
 * ==========================================================
 * Investigate Content Program Count (1회성 진단, 수동 실행용)
 * ==========================================================
 */
function runInvestigateContentProgramCount() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONTENT.SHEET.ENGINE);

  if (!sheet) {
    throw new Error(CONTENT.SHEET.ENGINE + " sheet not found. runRefreshContentEngine()를 먼저 실행하세요.");
  }

  const values = sheet.getDataRange().getValues();

  const keys = [];

  for (let i = 1; i < values.length; i++) {
    const key = String(values[i][0] || "").trim();
    if (key) keys.push(key);
  }

  Logger.log("======================================");
  Logger.log("Content Program Count Investigation");
  Logger.log("======================================");
  Logger.log("Total programs (Content_Engine rows) : " + keys.length);
  Logger.log("");
  Logger.log("---- 샘플 30개 ----");

  keys.slice(0, 30).forEach(function (key) {
    Logger.log(key);
  });

}
