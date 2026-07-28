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
 * v1.7.0
 *
 * Change Log
 * v1.7.0 (2026-07-28)
 * - runDeleteDeadSearchOPSRows() 추가(수동 실행용). runAuditSearchSegmentIssues()
 *   Part 1로 확인된 죽은 키 116건(전부 수동 컬럼 완전 공백 확인) 삭제 —
 *   사용자 승인 후 실행. 24_OPSQA.js의 완전 동일 중복 삭제 함수들과 동일하게
 *   삭제 전 전체 목록 로그 → 내림차순 deleteRow() 패턴.
 * v1.6.0 (2026-07-28)
 * - runAuditSearchSegmentIssues() 추가(1회성 진단, 수동 실행용). 두 문제를
 *   한 번에 점검: (1) mergeSearchOPS_()의 합집합 병합 때문에 Business
 *   Segment가 바뀌어도 Search_OPS에 그대로 남는 죽은 키(수동 컬럼에 실제
 *   데이터가 있는지 여부까지 구분해서 표시), (2) 아직 Search로 분류돼
 *   값이 있는 것 중 ebook/guide 외의 콘텐츠성 키워드(webinar/checklist/
 *   workbook/practice test/quiz 등)가 감지되는 후보 그룹(자동 확정 아님,
 *   검토용). buildSearchOPS() 실행 후 22개 값이 전부 0으로 표시된 것을
 *   포함해 그 외 다수의 "_contact"/"ptc" 캠페인도 같은 죽은 키 패턴임을
 *   사용자가 발견 — 코드 변경 없음, 순수 진단.
 * v1.5.0 (2026-07-28)
 * - runInvestigateSearchMisclassifiedCampaigns() 성능 개선 — v1.4.0의 행별
 *   상세 로그 + O(N×M) 부분일치(includes) 재검색 방식이 MTA_Master(8만+행)
 *   기준 실행 시간이 너무 길고 로그가 과다 출력됨(사용자 보고, 실행 로그
 *   1분+ 후에도 끝 안 남) — 시트당 1회 스캔(O(N))으로 값별 총 건수/세그먼트
 *   분포/leadSource "search" 포함 여부만 집계하는 요약 전용 방식으로 교체.
 *   실측 결과(사용자 제공 샘플)로 가설 2(leadSource.includes("search")가
 *   Content보다 먼저 체크됨)가 실제로 발생 중임을 확인 — 예:
 *   detail="...Hyperlocalized ECL eBook", leadSource="Organic Search" →
 *   recomputed도 Search(라이브 버그, 레거시 아님). 규칙 수정은 전체 요약
 *   확인 후 별도 결정.
 * v1.4.0 (2026-07-28)
 * - runInvestigateSearchMisclassifiedCampaigns() 추가(1회성 진단, 수동 실행용).
 *   사용자가 Search_OPS에서 발견한 22개 캠페인/UTM 값(전부 content류: ebook/
 *   guide/on-demand/infographic 등)이 실제로 Business Segment=Search로 잘못
 *   찍히고 있는지, 어떤 필드 조합(특히 First Lead Source에 "search" 포함
 *   여부) 때문인지 Leads_Master/MTA_Master 원본 필드를 그대로 로그로 찍어
 *   확인하기 위함. 코드(getBusinessSegment()) 변경 없음 — 순수 진단.
 *   가설 2개: (1) Content 판정의 "on-demand"/"ondemand"/"webinar" 키워드가
 *   detail에만 체크되고 campaign은 체크 안 함(16_TransformHelper.js), (2)
 *   Search의 leadSource.includes("search")가 Content보다 먼저 체크됨.
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


/**
 * ==========================================================
 * Investigate Search Misclassified Campaigns (1회성 진단, 수동 실행용)
 *
 * WHY
 * 사용자가 Search_OPS를 검토하다가 content류(ebook/guide/on-demand/
 * infographic 등) 캠페인/UTM 값이 Business Segment=Search로 분류돼 있는
 * 것 같다고 발견(2026-07-28). 코드를 바로 고치기 전에, 이 값들이 실제
 * Leads_Master/MTA_Master에서 어떤 campaign/detail/leadSource/category
 * 조합으로 들어와 있고 현재 저장된 Business Segment가 뭔지 원본 그대로
 * 로그로 확인한다 — 규칙 수정은 이 결과를 보고 별도로 결정.
 *
 * 코드 변경 없음(getBusinessSegment() 등 기존 로직 그대로) — 순수 조회/로깅.
 * ==========================================================
 */
function runInvestigateSearchMisclassifiedCampaigns() {

  const SUSPECT_VALUES = [
    "EM-2026-03-KOR-TOFU-Core EXPO Nurture Emails",
    "WF-2021-09-KOR-MOFU-Core Hyperlocalized ECL eBook",
    "WF-2023-12-KOR-MOFU-Core The Ultimate US Admissions Guide for Parents 2023",
    "WF-2023-02-KOR-MOFU-Core 5 Ways To Build Stand-Out ECL ebook",
    "WF-2025-03-KOR-MOFU-Core 2025 Admission Trends On-Demand",
    "WF-2022-12-KOR-MOFU-Core College research:US Top 20 Universities 15Mins On-Demand",
    "WF-2021-12-KOR-MOFU-Core Mini SAT practice ebook",
    "WF-2022-06-KOR-MOFU-Core ECL On Demand (Vietname Webinar)",
    "WF-2023-05-KOR-MOFU-Core Mini Digital SAT Practice Test 2023",
    "WF-2022-06-KOR-MOFU-Core Hyperlocal Case Study eBook",
    "WF-2022-11-KOR-MOFU-Core New Digital Mini SAT Practice Test",
    "WF-2022-12-KOR-MOFU-Core Admission Strategy for Young Students 15Mins On-Demand",
    "WF-2022-10-KOR-MOFU-Core Hyperlocalized FAQ with FAO for US ebook",
    "WF-2023-01-KOR-MOFU-Core US University Admissions for International School Students",
    "WF-2022-05-KOR-MOFU-Core Hyperlocalized Korean Students US Top 5 eBook",
    "WF-2023-02-KOR-MOFU-Core Hyperlocalized Canada eBook",
    "WF-2022-02-KOR-MOFU-Core Major Selection On Demand",
    "WF-2022-11-KOR-MOFU-Core Hyperlocalized Boarding School eBook",
    "WF-2023-06-KOR-MOFU-Core Chat GPT Webinar with Veronica Schrenk On-Demand",
    "WF-2023-05-KOR-MOUF-Core Mini Digital SAT Practice Test 2023",
    "WF-2023-04-KOR-MOFU-Core Hyperlocalized Korean Army Infographic",
    "WF-2022-06-KOR-MOFU-Core Supercurriculars for UK eBook"
  ];

  const summary = {};

  SUSPECT_VALUES.forEach(function (v) {
    summary[v.trim().toLowerCase()] = {
      label: v,
      total: 0,
      bySegment: {},
      searchViaLeadSource: 0,
      searchOtherReason: 0
    };
  });

  //----------------------------------------------------------
  // 시트당 1회 스캔(O(N)) — campaign 또는 detail이 대상 값과
  // 일치하는 행만 집계. 이전 버전의 O(N×M) 부분일치 재검색은
  // 실행 시간이 너무 길어(사용자 보고) 제거.
  //----------------------------------------------------------

  function scan(sheet, campaignField, detailField) {

    if (!sheet) return;

    sheetToObjects(sheet).forEach(function (r) {

      const campaign = String(r[campaignField] || "").trim().toLowerCase();
      const detail = String(r[detailField] || "").trim().toLowerCase();

      const s = summary[campaign] || summary[detail];

      if (!s) return;

      s.total++;

      const segment = r["Business Segment"] || "(빈값)";

      s.bySegment[segment] = (s.bySegment[segment] || 0) + 1;

      if (segment === "Search") {

        const leadSource = String(r["First Lead Source"] || "").toLowerCase();

        if (leadSource.includes("search")) {
          s.searchViaLeadSource++;
        } else {
          s.searchOtherReason++;
        }

      }

    });

  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  Logger.log("======================================");
  Logger.log("Investigate Search Misclassified Campaigns (요약)");
  Logger.log("======================================");

  scan(ss.getSheetByName(CONFIG.SHEETS.LEADS_MASTER), "First MKT UTM Campaign", "First Touch Detail");
  scan(ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER), "MKT UTM Campaign", "Lead Source Detail");

  Object.keys(summary).forEach(function (key) {

    const s = summary[key];

    if (s.total === 0) {
      Logger.log("\"" + s.label + "\" — 매칭 없음 (Leads_Master/MTA_Master 어디에도 없음)");
      return;
    }

    Logger.log(
      "\"" + s.label + "\" — 총 " + s.total + "건 / 세그먼트별: " + JSON.stringify(s.bySegment) +
      (s.bySegment["Search"]
        ? "  [Search 중 leadSource에 'search' 포함=" + s.searchViaLeadSource + ", 그 외 원인=" + s.searchOtherReason + "]"
        : "")
    );

  });

  Logger.log("");
  Logger.log("======================================");
  Logger.log("Investigation Completed");
  Logger.log("======================================");

}


/**
 * ==========================================================
 * Audit Search Segment Issues (1회성 진단, 수동 실행용)
 *
 * WHY
 * Search_OPS 정리 작업(2026-07-28) 중 사용자가 발견한 두 가지 별개 문제를
 * 한 번에 점검하기 위함:
 * (1) 죽은 키 — mergeSearchOPS_()(73_Search_Merge.js)가 "현재 Engine 키 ∪
 *     기존 Search_OPS 키"로 합치기 때문에, 한 번 Search_OPS에 들어간 키는
 *     이후 Business Segment가 바뀌어 Search_Engine에서 사라져도 Search_OPS엔
 *     그대로 남아 지표만 0으로 표시됨(오늘 수정한 22개 값 + 그 외 다수의
 *     "_contact"/"ptc"/"consult" 캠페인에서 실측 확인). 수동 컬럼(PIC/
 *     Marketo Campaign name/Channel/Impressions/Spent 등)에 실제 데이터가
 *     있는지 여부로 "완전 공백(삭제 안전)" vs "데이터 있음(검토 필요)" 구분.
 * (2) 아직 살아있는(값이 0이 아닌) Search 분류 중에서도, ebook/guide 외에
 *     아직 못 잡은 콘텐츠성 키워드(webinar/checklist/workbook/practice test/
 *     quiz 등)가 campaign/detail에 포함된 그룹을 후보로 나열 — 자동 재분류가
 *     아니라 사람이 검토할 후보 목록.
 *
 * 코드 변경 없음(getBusinessSegment() 등 기존 로직 그대로) — 순수 진단.
 * ==========================================================
 */
function runAuditSearchSegmentIssues() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  Logger.log("======================================");
  Logger.log("Audit Search Segment Issues");
  Logger.log("======================================");

  //----------------------------------------------------------
  // Part 1 — Search_OPS 죽은 키 (현재 Search_Engine에 없는 키)
  //----------------------------------------------------------

  const engineSheet = ss.getSheetByName(SEARCH.SHEET.ENGINE);
  const opsSheet = ss.getSheetByName(SEARCH.SHEET.OPS);

  const liveKeys = {};

  if (engineSheet) {

    sheetToObjects(engineSheet).forEach(function (r) {
      const key = String(r["Lead Source Detail"] || "").trim().toLowerCase();
      if (key) liveKeys[key] = true;
    });

  }

  Logger.log("");
  Logger.log("---- Part 1: Search_OPS 죽은 키 (Search_Engine에 더 이상 없음) ----");

  let deadCount = 0;
  let deadWithManualData = 0;

  if (opsSheet) {

    const opsRows = readSearchOPS_();
    const manualCols = SEARCH.GROUP_1_MANUAL.concat(SEARCH.GROUP_2_MANUAL).concat(SEARCH.GROUP_3_MANUAL);

    opsRows.forEach(function (row) {

      const key = String(row[SEARCH.KEY] || "").trim();

      if (!key) return;
      if (liveKeys[key.toLowerCase()]) return; // 살아있음 — 스킵

      deadCount++;

      const manualValues = {};
      let hasManualData = false;

      manualCols.forEach(function (col) {

        const v = row[col];
        manualValues[col] = v;

        if (col === "Channel") return; // 신규 행 기본값(CHANNEL_DEFAULT)이 항상 채워지므로 별도 판단

        if (v !== "" && v !== 0 && v !== undefined && v !== null) {
          hasManualData = true;
        }

      });

      const channelValue = String(row["Channel"] || "");

      if (channelValue && channelValue !== SEARCH.CHANNEL_DEFAULT) {
        hasManualData = true;
      }

      if (hasManualData) deadWithManualData++;

      Logger.log(
        (hasManualData ? "⚠️ [데이터 있음] " : "   [완전 공백] ") +
        "\"" + key + "\"" +
        (hasManualData ? "  " + JSON.stringify(manualValues) : "")
      );

    });

  } else {
    Logger.log(SEARCH.SHEET.OPS + " sheet not found — skipped.");
  }

  Logger.log("");
  Logger.log(
    "Part 1 요약: 죽은 키 " + deadCount + "건 " +
    "(수동 데이터 있음=" + deadWithManualData + ", 완전 공백=" + (deadCount - deadWithManualData) + ")"
  );

  //----------------------------------------------------------
  // Part 2 — 아직 값이 있는데 콘텐츠성으로 의심되는 Search 그룹 (후보만 나열)
  //----------------------------------------------------------

  const SUSPECT_KEYWORDS = [
    "webinar", "checklist", "workbook", "whitepaper", "playbook",
    "template", "toolkit", "roadmap", "practice test", "practice exam",
    "mock test", "sample test", "quiz", "recording", "case study",
    "on demand", "download", ".pdf", "cheat sheet"
  ];

  function containsSuspectKeyword(text) {
    return SUSPECT_KEYWORDS.some(function (kw) { return text.includes(kw); });
  }

  const suspectGroups = {};

  function scanForSuspects(sheet, campaignField, detailField) {

    if (!sheet) return;

    sheetToObjects(sheet).forEach(function (r) {

      if (r["Business Segment"] !== "Search") return;

      const campaign = String(r[campaignField] || "").trim();
      const detail = String(r[detailField] || "").trim();
      const text = (campaign + " " + detail).toLowerCase();

      if (!containsSuspectKeyword(text)) return;

      const label = detail || campaign;
      const key = label.toLowerCase();

      if (!suspectGroups[key]) {
        suspectGroups[key] = { label: label, count: 0 };
      }

      suspectGroups[key].count++;

    });

  }

  scanForSuspects(ss.getSheetByName(CONFIG.SHEETS.LEADS_MASTER), "First MKT UTM Campaign", "First Touch Detail");
  scanForSuspects(ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER), "MKT UTM Campaign", "Lead Source Detail");

  Logger.log("");
  Logger.log("---- Part 2: 현재 Search로 분류돼 있지만 콘텐츠성 키워드가 감지된 후보 (자동 확정 아님, 검토용) ----");

  const sortedSuspects = Object.keys(suspectGroups)
    .map(function (k) { return suspectGroups[k]; })
    .sort(function (a, b) { return b.count - a.count; });

  if (sortedSuspects.length === 0) {
    Logger.log("후보 없음.");
  } else {
    sortedSuspects.forEach(function (g) {
      Logger.log("\"" + g.label + "\" — Search로 분류된 건수: " + g.count);
    });
  }

  Logger.log("");
  Logger.log("======================================");
  Logger.log("Audit Completed");
  Logger.log("======================================");

}


/**
 * ==========================================================
 * Run Delete Dead Search_OPS Rows (수동 실행용)
 *
 * WHY
 * runAuditSearchSegmentIssues() Part 1로 확인된 죽은 키(Search_Engine에
 * 더 이상 없는 Search_OPS 키) 116건 전부 수동 컬럼(PIC/Impressions/Spent
 * 등)이 완전히 비어있음을 실측 확인(2026-07-28) — mergeSearchOPS_()
 * (73_Search_Merge.js)의 "현재 Engine 키 ∪ 기존 Search_OPS 키" 합집합
 * 병합 때문에 Business Segment가 바뀌어도 지워지지 않고 쌓인 레거시 행을
 * 사용자 승인 후 정리한다. 삭제 전 로그로 목록 전체 나열 — 실행 로그가
 * 곧 감사 기록(24_OPSQA.js의 완전 동일 중복 삭제 함수들과 동일 패턴).
 * ==========================================================
 */
function runDeleteDeadSearchOPSRows() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const engineSheet = ss.getSheetByName(SEARCH.SHEET.ENGINE);
  const opsSheet = ss.getSheetByName(SEARCH.SHEET.OPS);

  if (!opsSheet) {
    Logger.log(SEARCH.SHEET.OPS + " sheet not found.");
    return;
  }

  const liveKeys = {};

  if (engineSheet) {

    sheetToObjects(engineSheet).forEach(function (r) {
      const key = String(r["Lead Source Detail"] || "").trim().toLowerCase();
      if (key) liveKeys[key] = true;
    });

  }

  const values = opsSheet.getDataRange().getValues();
  const headers = values[SEARCH.ROWS.HEADER - 1];
  const keyColIndex = headers.indexOf(SEARCH.KEY);

  const rowsToDelete = [];

  for (let r = SEARCH.ROWS.DATA_START - 1; r < values.length; r++) {

    const key = String(values[r][keyColIndex] || "").trim();

    if (!key) continue;
    if (liveKeys[key.toLowerCase()]) continue; // 살아있음 — 스킵

    rowsToDelete.push(r + 1); // 1-based 시트 행 번호

  }

  Logger.log("======================================");
  Logger.log("Delete Dead Search_OPS Rows");
  Logger.log("======================================");
  Logger.log("Search_OPS 현재 행 수(헤더 제외): " + (opsSheet.getLastRow() - SEARCH.ROWS.DATA_START + 1));

  if (rowsToDelete.length === 0) {
    Logger.log("삭제할 죽은 키 없음.");
    return;
  }

  Logger.log("삭제 대상 행 수: " + rowsToDelete.length);
  Logger.log("삭제 대상 시트 행 번호(오름차순): " + rowsToDelete.join(", "));

  rowsToDelete
    .sort(function (a, b) { return b - a; }) // 내림차순 — 삭제 시 인덱스 안 밀리도록
    .forEach(function (rowIndex) {
      opsSheet.deleteRow(rowIndex);
    });

  SpreadsheetApp.flush();

  Logger.log(
    "삭제 완료 — " + rowsToDelete.length + "개 행 제거됨. " +
    "Search_OPS 현재 행 수(헤더 제외): " + (opsSheet.getLastRow() - SEARCH.ROWS.DATA_START + 1)
  );

  Logger.log("======================================");

}
