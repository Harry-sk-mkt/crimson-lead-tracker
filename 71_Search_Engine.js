/**
 * ==========================================================
 * Marketing 2.0
 * Search Engine (Aggregate Table)
 *
 * Responsibility
 * Leads_Master / MTA_Master / Leads_OPS 전체를 스캔하여 raw campaign
 * 값(MKT UTM Campaign/First MKT UTM Campaign 필드, Business Segment=
 * Search, 국가 필터 없음 — 사용자가 수동으로 판단) 기준으로 지표를 미리
 * 계산해 Search_Engine(숨김) 시트에 저장한다. 61_BOFU_Engine.js와 유사한
 * 패턴이나 매칭 필드/국가 필터는 다름 — Events/BOFU 코드는 수정하지
 * 않고(Article 5), 여기서 별도로 Search 전용 집계 함수를 둔다.
 *
 * ⚠️ 범용 헬퍼(stripRegistrationFormSuffix_, isKoreanProgram_,
 * isValidDate_)는 51_Events_Engine.js 정의를 재사용 — 재정의하지 않음.
 *
 * P1 판정은 BOFU와 동일하게 정확한 문자열 일치("Priority 1")를 쓴다
 * (Events의 substring 비교 버그 반복 방지, 61_BOFU_Engine.js 참고).
 *
 * 호출 시점
 * - appendNewLeads(), appendNewMTA()(syncMTAFunnelToOPS_ 경유)
 * - rebuildLeadsMaster(), rebuildMTAMaster()
 * (다른 Engine들과 동일한 4개 지점, 07/09/10 파일에 나란히 배선)
 *
 * Version
 * v1.3.0
 *
 * Change Log
 * v1.3.0 (2026-07-28)
 * - 코드 변경 없음 — Events_OPS/BOFU_OPS/Content_OPS의 #Deals/Revenue를
 *   Deal Tracker 기반으로 전환하는 2트랙 아키텍처 작업(CLAUDE.md #7) 중,
 *   Search_OPS는 raw UTM 그레인과 Deal Tracker의 프로그램 단위 Lead Source
 *   Detail이 안 맞아 예외 처리하기로 사용자 확인 — computeSearchFunnelAggregates_()
 *   상단에 사유 주석만 추가. 그대로 Leads_OPS 기준 유지. 상세: docs/Changelog.md
 *   2026-07-28.
 * v1.2.0 (2026-07-24)
 * - Country 필터 미적용을 최종 확정 (70_Search_Config.js v1.2.0 참고).
 *   실측 결과(260개 캠페인, revenue 있는 건 25개뿐) 자동 KOR/KR 판별 +
 *   대소문자/중괄호 정규화보다 사용자가 A열(hidden, MKT UTM Campaign
 *   원본)을 보고 직접 Marketo Program 매핑 + 한국 딜 여부 + 중복 캠페인
 *   정리를 수동으로 하는 편이 낫다고 판단(사용자 결정) — Business
 *   Segment=Search 필터만 유지, 추가 자동 필터/정규화 없음.
 * v1.1.0 (2026-07-24)
 * - MATCH_FIELD 변경(SEARCH.MATCH_FIELD, 70_Search_Config.js 참고)에 맞춰
 *   aggregateSearchMTATouchRecords_/aggregateSearchLeadsRecords_가 이제
 *   MKT UTM Campaign/First MKT UTM Campaign 값을 그룹핑 키로 사용.
 * - isKoreanProgram_() 호출 제거 — 이 필터는 Marketo Program 이름
 *   (TYPE-YYYY-MM-COUNTRY-...)의 4번째 토큰 위치를 가정하는데, raw MKT
 *   UTM Campaign 문자열은 이 구조를 따르지 않아(국가 토큰 위치가 다르거나
 *   아예 없음) 실제 KOR 리드 대부분이 걸러지는 문제 발견.
 * ==========================================================
 */


/**
 * ==========================================================
 * Refresh Search Engine (전체 재계산)
 * ==========================================================
 */
function refreshSearchEngine_() {

  const start = new Date();

  Logger.log(CONFIG.LOG.PREFIX + " Search Engine Refresh Started");

  const mtaAgg = computeSearchMTAAggregates_();
  const leadsAgg = computeSearchLeadsAggregates_();
  const funnelAgg = computeSearchFunnelAggregates_(leadsAgg.leadIdToKey);

  const allKeys = {};

  [
    mtaAgg.allRegistered, mtaAgg.p1All,
    leadsAgg.newRegistered, leadsAgg.nlP1,
    funnelAgg.icRequest, funnelAgg.icBooked,
    funnelAgg.icComplete, funnelAgg.dealsWon, funnelAgg.revenue
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
      funnelAgg.dealsWon[key] || 0,
      funnelAgg.revenue[key] || 0
    ];

  });

  writeSearchEngine_(rows);

  const seconds = ((new Date() - start) / 1000).toFixed(2);

  Logger.log(
    CONFIG.LOG.PREFIX + " Search Engine Refresh Completed : " +
    rows.length + " rows (" + seconds + "s)"
  );

}


/**
 * ==========================================================
 * Is Effective Search P1 (정확한 문자열 일치)
 *
 * TEST
 * testIsEffectiveSearchP1_ 참고
 * ==========================================================
 */
function isEffectiveSearchP1_(leadPriority) {

  return String(leadPriority || "").trim() === "Priority 1";

}


/**
 * ==========================================================
 * TEST — isEffectiveSearchP1_()
 * ==========================================================
 */
function testIsEffectiveSearchP1_() {

  const pass =
    isEffectiveSearchP1_("Priority 1") === true &&
    isEffectiveSearchP1_("Priority 10") === false &&
    isEffectiveSearchP1_("Priority 2") === false &&
    isEffectiveSearchP1_("") === false;

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Search MTA Aggregates (SF Reg. / SF P1s)
 *
 * TEST
 * testComputeSearchMTAAggregates_ 참고
 * ==========================================================
 */
function computeSearchMTAAggregates_() {

  const allRegistered = {};
  const p1All = {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);

  if (!sheet) return { allRegistered, p1All };

  aggregateSearchMTATouchRecords_(sheetToObjects(sheet), allRegistered, p1All);

  return { allRegistered, p1All };

}


/**
 * ==========================================================
 * Aggregate Search MTA Touch Records (순수 함수, 테스트용으로 분리)
 * ==========================================================
 */
function aggregateSearchMTATouchRecords_(records, allRegistered, p1All) {

  records.forEach(function (r) {

    if (SEARCH.SEGMENTS.indexOf(r["Business Segment"]) === -1) return;

    const key = stripRegistrationFormSuffix_(r[SEARCH.MATCH_FIELD.MTA]);

    if (!key) return;

    allRegistered[key] = (allRegistered[key] || 0) + 1;

    if (isEffectiveSearchP1_(r["Lead Priority"])) {
      p1All[key] = (p1All[key] || 0) + 1;
    }

  });

}


/**
 * ==========================================================
 * TEST — aggregateSearchMTATouchRecords_()
 * ==========================================================
 */
function testComputeSearchMTAAggregates_() {

  const records = [
    { "Business Segment": "Search", "MKT UTM Campaign": "2025-07-KOR-Naver SA Study Consultants US", "Lead Priority": "Priority 1" },
    { "Business Segment": "Search", "MKT UTM Campaign": "2025-07-KOR-Naver SA Study Consultants US", "Lead Priority": "Priority 2" },
    { "Business Segment": "BOFU", "MKT UTM Campaign": "WF-2025-07-KOR-BOFU-Core B", "Lead Priority": "Priority 1" } // segment 필터로 제외
  ];

  const allRegistered = {};
  const p1All = {};

  aggregateSearchMTATouchRecords_(records, allRegistered, p1All);

  const pass =
    allRegistered["2025-07-KOR-Naver SA Study Consultants US"] === 2 &&
    p1All["2025-07-KOR-Naver SA Study Consultants US"] === 1 &&
    Object.keys(allRegistered).length === 1;

  Logger.log("Result: " + JSON.stringify({ allRegistered, p1All }));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Search Leads Aggregates (SF NL / SF NLP1s)
 *
 * TEST
 * testComputeSearchLeadsAggregates_ 참고
 * ==========================================================
 */
function computeSearchLeadsAggregates_() {

  const newRegistered = {};
  const nlP1 = {};
  const leadIdToKey = {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS_MASTER);

  if (!sheet) return { newRegistered, nlP1, leadIdToKey };

  aggregateSearchLeadsRecords_(sheetToObjects(sheet), newRegistered, nlP1, leadIdToKey);

  return { newRegistered, nlP1, leadIdToKey };

}


/**
 * ==========================================================
 * Aggregate Search Leads Records (순수 함수, 테스트용으로 분리)
 * ==========================================================
 */
function aggregateSearchLeadsRecords_(records, newRegistered, nlP1, leadIdToKey) {

  records.forEach(function (r) {

    if (SEARCH.SEGMENTS.indexOf(r["Business Segment"]) === -1) return;

    const key = stripRegistrationFormSuffix_(r[SEARCH.MATCH_FIELD.LEADS]);

    if (!key) return;

    newRegistered[key] = (newRegistered[key] || 0) + 1;

    if (isEffectiveSearchP1_(r["Lead Priority"])) {
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
 * TEST — aggregateSearchLeadsRecords_()
 * ==========================================================
 */
function testComputeSearchLeadsAggregates_() {

  const records = [
    { "Business Segment": "Search", "First MKT UTM Campaign": "2025-07-KOR-Naver SA Study Consultants US", "Lead Priority": "Priority 1", "Lead ID": "L1" },
    { "Business Segment": "BOFU", "First MKT UTM Campaign": "2025-07-KOR-Naver SA Study Consultants US", "Lead Priority": "Priority 1", "Lead ID": "L2" } // segment 필터로 제외
  ];

  const newRegistered = {};
  const nlP1 = {};
  const leadIdToKey = {};

  aggregateSearchLeadsRecords_(records, newRegistered, nlP1, leadIdToKey);

  const pass =
    newRegistered["2025-07-KOR-Naver SA Study Consultants US"] === 1 &&
    nlP1["2025-07-KOR-Naver SA Study Consultants US"] === 1 &&
    leadIdToKey["L1"] === "2025-07-KOR-Naver SA Study Consultants US" &&
    leadIdToKey["L2"] === undefined;

  Logger.log("Result: " + JSON.stringify({ newRegistered, nlP1, leadIdToKey }));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Search Funnel Aggregates (IC Request/Booked/Complete/Deals/Revenue)
 *
 * ⚠️ 2트랙 아키텍처 예외 (2026-07-28, 사용자 확인)
 * Events_OPS/BOFU_OPS/Content_OPS는 #Deals/Revenue를 Deal Tracker 기반으로
 * 전환했지만(CLAUDE.md #7), Search_OPS는 이번 전환에서 **제외**한다 — 그대로
 * Leads_OPS(Opportunity Won Date/Revenue) 기준 유지. 이유: Search_OPS는
 * raw UTM 단위(프로그램당 수십 개 행)로 그레인이 세분화되어 있는데, Deal
 * Tracker는 프로그램 단위 "Lead Source Detail"만 보유해 그대로 매칭하면
 * 같은 프로그램을 공유하는 여러 UTM 행이 동일 #Deals/Revenue를 중복으로
 * 받게 된다. Marketo 프로그램→UTM 수동 매핑이 필요한 별도 작업이라 이번
 * 라운드에서는 예외 처리하기로 사용자가 확인함 — 코드 변경 없음.
 *
 * TEST
 * testComputeSearchFunnelAggregates_ 참고
 * ==========================================================
 */
function computeSearchFunnelAggregates_(leadIdToKey) {

  const icRequest = {};
  const icBooked = {};
  const icComplete = {};
  const dealsWon = {};
  const revenue = {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(OPS.SHEET.OPS);

  if (!sheet) return { icRequest, icBooked, icComplete, dealsWon, revenue };

  aggregateSearchFunnelRecords_(
    sheetToObjects(sheet),
    leadIdToKey,
    icRequest, icBooked, icComplete, dealsWon, revenue
  );

  return { icRequest, icBooked, icComplete, dealsWon, revenue };

}


/**
 * ==========================================================
 * Aggregate Search Funnel Records (순수 함수, 테스트용으로 분리)
 * ==========================================================
 */
function aggregateSearchFunnelRecords_(opsRecords, leadIdToKey, icRequest, icBooked, icComplete, dealsWon, revenue) {

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

    if (isValidDate_(r["Opportunity Won Date"])) {
      dealsWon[key] = (dealsWon[key] || 0) + 1;
    }

    revenue[key] = (revenue[key] || 0) + (Number(r["Revenue"]) || 0);

  });

}


/**
 * ==========================================================
 * TEST — aggregateSearchFunnelRecords_()
 * ==========================================================
 */
function testComputeSearchFunnelAggregates_() {

  const leadIdToKey = { "L1": "SR-2025-07-KOR-MOFU-Core A" };

  const opsRecords = [
    { "Lead ID": "L1", "Total IC Requests": 1, "IC Booked Date": new Date(2026, 0, 1), "IC Completed Date": "", "Opportunity Won Date": "", "Revenue": 500 },
    { "Lead ID": "L2", "Total IC Requests": 1, "IC Booked Date": new Date(2026, 0, 1), "IC Completed Date": "", "Opportunity Won Date": "", "Revenue": 999 } // leadIdToKey에 없음 → 제외
  ];

  const icRequest = {}, icBooked = {}, icComplete = {}, dealsWon = {}, revenue = {};

  aggregateSearchFunnelRecords_(opsRecords, leadIdToKey, icRequest, icBooked, icComplete, dealsWon, revenue);

  const pass =
    icRequest["SR-2025-07-KOR-MOFU-Core A"] === 1 &&
    icBooked["SR-2025-07-KOR-MOFU-Core A"] === 1 &&
    revenue["SR-2025-07-KOR-MOFU-Core A"] === 500 &&
    Object.keys(revenue).length === 1;

  Logger.log("Result: " + JSON.stringify({ icRequest, icBooked, icComplete, dealsWon, revenue }));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Write Search Engine to Sheet (없으면 생성, 숨김 유지)
 * ==========================================================
 */
function writeSearchEngine_(rows) {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(SEARCH.SHEET.ENGINE);

  if (!sheet) {
    sheet = ss.insertSheet(SEARCH.SHEET.ENGINE);
  }

  sheet.clearContents();

  sheet.getRange(1, 1, 1, SEARCH_ENGINE_HEADERS.length)
    .setValues([SEARCH_ENGINE_HEADERS]);

  if (rows.length > 0) {

    sheet.getRange(2, 1, rows.length, SEARCH_ENGINE_HEADERS.length)
      .setValues(rows);

  }

  sheet.hideSheet();

  SpreadsheetApp.flush();

}


/**
 * ==========================================================
 * Read Search Engine as Lookup Map (key → Row Object)
 * ==========================================================
 */
function readSearchEngineMap_() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SEARCH.SHEET.ENGINE);

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
function runRefreshSearchEngine() {

  refreshSearchEngine_();

}


/**
 * ==========================================================
 * Investigate Search Program Count (1회성 진단, 수동 실행용)
 *
 * WHY
 * BOFU 실데이터 검증(133개, TYPE 필터 불필요) 패턴 재사용 — Search도
 * Business Segment 필터만으로 캠페인 수가 상식적인지 확인.
 *
 * 2026-07-24: MATCH_FIELD를 MKT UTM Campaign 기준으로 변경 후 실측
 * 결과(260개, revenue 있는 건 25개뿐) 국가 필터는 적용하지 않기로
 * 확정(70_Search_Config.js v1.2.0 참고, 사용자 결정) — "KOR" 포함 여부
 * 출력은 참고용 진단으로만 유지.
 * ==========================================================
 */
function runInvestigateSearchProgramCount() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SEARCH.SHEET.ENGINE);

  if (!sheet) {
    throw new Error(SEARCH.SHEET.ENGINE + " sheet not found. runRefreshSearchEngine()를 먼저 실행하세요.");
  }

  const values = sheet.getDataRange().getValues();

  const keys = [];

  for (let i = 1; i < values.length; i++) {
    const key = String(values[i][0] || "").trim();
    if (key) keys.push(key);
  }

  const withKor = keys.filter(function (k) { return k.toUpperCase().indexOf("KOR") !== -1; });
  const withoutKor = keys.filter(function (k) { return k.toUpperCase().indexOf("KOR") === -1; });

  Logger.log("======================================");
  Logger.log("Search Program Count Investigation");
  Logger.log("======================================");
  Logger.log("Total campaigns (Search_Engine rows) : " + keys.length);
  Logger.log("Contains \"KOR\" (substring)           : " + withKor.length);
  Logger.log("No \"KOR\" (substring)                 : " + withoutKor.length);
  Logger.log("");
  Logger.log("---- \"KOR\" 없는 값 샘플 20개 (국가 필터 결정 참고용) ----");

  withoutKor.slice(0, 20).forEach(function (key) {
    Logger.log(key);
  });

  Logger.log("");
  Logger.log("---- 전체 샘플 30개 ----");

  keys.slice(0, 30).forEach(function (key) {
    Logger.log(key);
  });

}
