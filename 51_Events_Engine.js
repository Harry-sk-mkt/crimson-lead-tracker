/**
 * ==========================================================
 * Marketing 2.0
 * Events Engine (Aggregate Table)
 *
 * Responsibility
 * Leads_Master / MTA_Master / Leads_OPS 전체를 스캔하여 Marketo Program
 * 이름(Lead Source Detail/First Touch Detail 필드, KOR만 대상) 기준으로
 * 지표를 미리 계산해 Events_Engine(숨김) 시트에 저장한다. 31_ACQSummary.js
 * 와 동일한 "Disposable, 매번 전체 재계산" 패턴.
 *
 * 호출 시점
 * - appendNewLeads(), appendNewMTA()(syncMTAFunnelToOPS_ 경유)
 * - rebuildLeadsMaster(), rebuildMTAMaster()
 * (refreshACQSummary_()와 동일한 4개 지점, 07/09/10 파일에 나란히 배선)
 *
 * Version
 * v1.7.0
 *
 * Change Log
 * v1.7.0 (2026-07-24)
 * - stripRegistrationFormSuffix_() 53_Events_Merge.js에서 이 파일로 이관,
 *   aggregateMTATouchRecords_()/aggregateLeadsRecords_()의 키 추출 단계에
 *   직접 적용 (버그 수정, 사용자 발견): 등록 폼 종류 접미사(예: "| Registered
 *   for Webinar from FB LG Form")가 매칭 키에 그대로 남아있어, 같은 이벤트가
 *   폼별로 여러 행(예: 동일 날짜 3개 행)으로 쪼개지는 문제가 있었음. 이제
 *   매칭 키 자체가 canonical(정제된) 값이라 근본 해결.
 * v1.6.0 (2026-07-24)
 * - Events_Engine 시트에 "UTM"/"Event Date" 컬럼 추가 (Lead Source Detail
 *   바로 옆). Marketo Program 이름엔 월 단위(YYYY-MM) 정보만 있어 정확한
 *   일자를 못 채웠는데, raw "MKT UTM Campaign"엔 일 단위 날짜가 있음 —
 *   같은 프로그램의 터치들이 가리키는 UTM 날짜 중 최빈값을 채택
 *   (pickModeEventDate_(), 사용자 확정). aggregateMTATouchRecords_()에
 *   eventDateCandidates 파라미터 추가(기존 3-param 호출과 하위 호환).
 * v1.5.0 (2026-07-24)
 * - parseProgramTypeAndDate_() 추가 — Marketo Program 이름 앞부분
 *   ("{TYPE}-{YYYY}-{MM}-...")에서 EventType/Event Date를 추출.
 *   53_Events_Merge.js가 값이 비어있는 행에 자동 prefill하는 데 사용.
 * v1.4.0 (2026-07-24)
 * - isEligibleEventType_()/isEligibleEventProgram_() 추가 — 실 빌드 결과
 *   검토 중 TYPE=WF(ebook/practice test/consult page 등)가 Business
 *   Segment=Webinar/Seminar로 잘못 섞여 들어오는 사례 다수 발견 (사용자
 *   확인). EVENTS.EVENT_TYPE_PREFIXES(WB/EV)만 허용하도록 필터 추가.
 * v1.3.0 (2026-07-24)
 * - 매칭 필드를 raw UTM 문자열(MKT UTM Campaign/First MKT UTM Campaign)에서
 *   Lead Source Detail/First Touch Detail(실제 Marketo Program 이름)로
 *   전환. isKoreanProgram_() 추가 — Program 이름의 4번째 하이픈 토큰이
 *   "KOR"인 것만 대상 (KR 외 국가는 다른 팀 캠페인, 관리 대상 아님).
 *   parseCampaignCountrySuffix_()(UTM 접미사 파싱, 더 이상 불필요) 제거.
 * v1.2.0 (2026-07-24)
 * - runInvestigateFirstTouchDetailGrouping() 추가 — UTM Key(MKT UTM
 *   Campaign) 대신 First Touch Detail(raw "Lead Source Detail",
 *   실제 Marketo Program 이름을 담은 필드로 확인됨)로 그룹핑했을 때
 *   몇 개로 줄어드는지 검증하는 진단. "|"/"丨" 구분자로 폼 종류별
 *   접미사가 붙는 경우가 있어 접미사 제거 전/후 둘 다 카운트.
 * v1.1.0 (2026-07-24)
 * - runInvestigateUTMGrouping() 추가 — 실데이터 확인 결과 UTM Key가
 *   프로그램이 아니라 채널/캠페인 단위(2,167개 vs 실제 ~150개 프로그램)
 *   였음을 확인. 날짜 토큰 제거 시 그룹 수/그룹당 날짜 종류 수를
 *   진단해 그룹핑 규칙 및 Event Date 자동 prefill 안전성을 검증하는
 *   1회성 진단 함수 (24_OPSQA.js의 runInvestigate* 패턴).
 * v1.0.0 (2026-07-24)
 * - 최초 구현.
 * ==========================================================
 */


/**
 * ==========================================================
 * Refresh Events Engine (전체 재계산)
 *
 * WHY
 * Master/OPS 데이터가 바뀔 때마다 호출되어, Events_OPS 빌드가
 * 항상 최신 SF 집계값을 읽을 수 있게 한다 (ACQ_Summary와 동일 목적).
 * ==========================================================
 */
function refreshEventsEngine_() {

  const start = new Date();

  Logger.log(CONFIG.LOG.PREFIX + " Events Engine Refresh Started");

  const mtaAgg = computeMTATouchAggregates_();
  const leadsAgg = computeLeadsAggregates_();
  const funnelAgg = computeFunnelAggregates_(leadsAgg.leadIdToKey);

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

    const modeDate = pickModeEventDate_(mtaAgg.eventDateCandidates[key]);

    return [
      key,
      modeDate ? modeDate.sampleUTM : "",
      modeDate ? modeDate.eventDate : "",
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

  writeEventsEngine_(rows);

  const seconds = ((new Date() - start) / 1000).toFixed(2);

  Logger.log(
    CONFIG.LOG.PREFIX + " Events Engine Refresh Completed : " +
    rows.length + " rows (" + seconds + "s)"
  );

}


/**
 * ==========================================================
 * Compute MTA Touch Aggregates (All Registered / P1 All)
 *
 * WHY
 * All Registered는 "모든 터치"를 세는 지표라 MTA_Master(터치 레벨,
 * 1 Lead = N Row)를 스캔한다. 프로그램 매칭은 EVENTS.MATCH_FIELD.MTA
 * ("Lead Source Detail", 터치 시점의 실제 Marketo Program 이름).
 * KOR 외 국가/WB·EV 외 TYPE(다른 팀 캠페인, ebook 등 비-이벤트 콘텐츠)는
 * isEligibleEventProgram_()로 제외.
 *
 * INPUT
 * 없음 (MTA_Master 시트를 직접 읽음)
 *
 * OUTPUT
 * { allRegistered: {utmKey: count}, p1All: {utmKey: count},
 *   eventDateCandidates: {utmKey: {dateStr: {count, sampleUTM}}} }
 *
 * TEST
 * testComputeMTATouchAggregates_ 참고
 * ==========================================================
 */
function computeMTATouchAggregates_() {

  const allRegistered = {};
  const p1All = {};
  const eventDateCandidates = {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);

  if (!sheet) return { allRegistered, p1All, eventDateCandidates };

  aggregateMTATouchRecords_(sheetToObjects(sheet), allRegistered, p1All, eventDateCandidates);

  return { allRegistered, p1All, eventDateCandidates };

}


/**
 * ==========================================================
 * Aggregate MTA Touch Records (순수 함수, 테스트용으로 분리)
 *
 * WHY (eventDateCandidates, 2026-07-24 추가)
 * Marketo Program 이름(Lead Source Detail)엔 월 단위(YYYY-MM) 정보만
 * 있어 Event Date를 정확히 못 채운다. raw "MKT UTM Campaign"에는
 * 일 단위(YYYY-MM-DD) 날짜가 있으므로, 같은 프로그램의 터치들이
 * 가리키는 UTM 날짜를 전부 모아뒀다가 최빈값(가장 자주 등장하는 날짜)을
 * Event Date 후보로 쓴다 (사용자 확정, 2026-07-24). eventDateCandidates
 * 파라미터가 없으면(기존 테스트 호환) 이 부분은 그냥 건너뜀.
 * ==========================================================
 */
function aggregateMTATouchRecords_(records, allRegistered, p1All, eventDateCandidates) {

  records.forEach(function (r) {

    if (EVENTS.SEGMENTS.indexOf(r["Business Segment"]) === -1) return;

    const key = stripRegistrationFormSuffix_(r[EVENTS.MATCH_FIELD.MTA]);

    if (!key || !isEligibleEventProgram_(key)) return;

    allRegistered[key] = (allRegistered[key] || 0) + 1;

    if (String(r["Lead Priority"] || "").indexOf("1") !== -1) {
      p1All[key] = (p1All[key] || 0) + 1;
    }

    if (eventDateCandidates) {

      const utm = String(r["MKT UTM Campaign"] || "").trim();
      const dateMatch = utm.match(/\d{4}-\d{2}-\d{2}/);

      if (dateMatch) {

        if (!eventDateCandidates[key]) eventDateCandidates[key] = {};

        const dateStr = dateMatch[0];

        if (!eventDateCandidates[key][dateStr]) {
          eventDateCandidates[key][dateStr] = { count: 0, sampleUTM: utm };
        }

        eventDateCandidates[key][dateStr].count++;

      }

    }

  });

}


/**
 * ==========================================================
 * TEST — aggregateMTATouchRecords_()
 * ==========================================================
 */
function testComputeMTATouchAggregates_() {

  const records = [
    { "Business Segment": "Webinar", "Lead Source Detail": "WB-2025-07-KOR-MOFU-Core A", "Lead Priority": "P1", "MKT UTM Campaign": "KR_core_2025-07-10_a" },
    { "Business Segment": "Webinar", "Lead Source Detail": "WB-2025-07-KOR-MOFU-Core A", "Lead Priority": "P2", "MKT UTM Campaign": "KR_core_2025-07-10_a" },
    { "Business Segment": "Webinar", "Lead Source Detail": "WB-2025-07-KOR-MOFU-Core A | Registered for Webinar from FB LG Form", "Lead Priority": "P1", "MKT UTM Campaign": "KR_core_2025-07-10_a" }, // 폼 접미사만 다름 → 같은 키로 합쳐져야 함
    { "Business Segment": "Seminar", "Lead Source Detail": "EV-2025-07-KOR-MOFU-Core B", "Lead Priority": "P1", "MKT UTM Campaign": "KR_core_2025-07-15_b" },
    { "Business Segment": "Other", "Lead Source Detail": "WB-2025-07-KOR-MOFU-Core A", "Lead Priority": "P1" },       // segment 필터로 제외
    { "Business Segment": "Webinar", "Lead Source Detail": "", "Lead Priority": "P1" },                               // 빈 key 제외
    { "Business Segment": "Webinar", "Lead Source Detail": "WB-2025-07-US-MOFU-Core C", "Lead Priority": "P1" },     // KOR 아님 → 제외
    { "Business Segment": "Webinar", "Lead Source Detail": "WF-2025-07-KOR-MOFU-Core D eBook", "Lead Priority": "P1" } // TYPE이 WF → 제외
  ];

  const allRegistered = {};
  const p1All = {};
  const eventDateCandidates = {};

  aggregateMTATouchRecords_(records, allRegistered, p1All, eventDateCandidates);

  const pass =
    allRegistered["WB-2025-07-KOR-MOFU-Core A"] === 3 &&
    p1All["WB-2025-07-KOR-MOFU-Core A"] === 2 &&
    allRegistered["EV-2025-07-KOR-MOFU-Core B"] === 1 &&
    p1All["EV-2025-07-KOR-MOFU-Core B"] === 1 &&
    Object.keys(allRegistered).length === 2 &&
    eventDateCandidates["WB-2025-07-KOR-MOFU-Core A"]["2025-07-10"].count === 3 &&
    eventDateCandidates["EV-2025-07-KOR-MOFU-Core B"]["2025-07-15"].count === 1;

  Logger.log("Result: " + JSON.stringify({ allRegistered, p1All, eventDateCandidates }));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Leads Aggregates (New Registered / NL P1)
 *
 * WHY
 * New Registered는 "신규 Lead"만 세는 지표라 Leads_Master(1 Lead =
 * 1 Row, First Touch)를 스캔한다. leadIdToKey는 Funnel 조인
 * (computeFunnelAggregates_)에서 재사용 — Sales funnel 지표는 전부
 * First Touch Attribution 기준이어야 하므로 이 맵이 그 원칙을 보장한다.
 *
 * OUTPUT
 * { newRegistered: {utmKey: count}, nlP1: {utmKey: count},
 *   leadIdToKey: {leadId: utmKey} }
 *
 * TEST
 * testComputeLeadsAggregates_ 참고
 * ==========================================================
 */
function computeLeadsAggregates_() {

  const newRegistered = {};
  const nlP1 = {};
  const leadIdToKey = {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS_MASTER);

  if (!sheet) return { newRegistered, nlP1, leadIdToKey };

  aggregateLeadsRecords_(sheetToObjects(sheet), newRegistered, nlP1, leadIdToKey);

  return { newRegistered, nlP1, leadIdToKey };

}


/**
 * ==========================================================
 * Aggregate Leads Records (순수 함수, 테스트용으로 분리)
 * ==========================================================
 */
function aggregateLeadsRecords_(records, newRegistered, nlP1, leadIdToKey) {

  records.forEach(function (r) {

    if (EVENTS.SEGMENTS.indexOf(r["Business Segment"]) === -1) return;

    const key = stripRegistrationFormSuffix_(r[EVENTS.MATCH_FIELD.LEADS]);

    if (!key || !isEligibleEventProgram_(key)) return;

    newRegistered[key] = (newRegistered[key] || 0) + 1;

    if (String(r["Lead Priority"] || "").indexOf("1") !== -1) {
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
 * TEST — aggregateLeadsRecords_()
 * ==========================================================
 */
function testComputeLeadsAggregates_() {

  const records = [
    { "Business Segment": "Webinar", "First Touch Detail": "WB-2025-07-KOR-MOFU-Core A", "Lead Priority": "P1", "Lead ID": "L1" },
    { "Business Segment": "Webinar", "First Touch Detail": "WB-2025-07-KOR-MOFU-Core A丨Registered for Webinar from Website Form", "Lead Priority": "P1", "Lead ID": "L6" }, // 폼 접미사만 다름 → 같은 키
    { "Business Segment": "Seminar", "First Touch Detail": "EV-2025-07-KOR-MOFU-Core B", "Lead Priority": "P2", "Lead ID": "L2" },
    { "Business Segment": "Search", "First Touch Detail": "WB-2025-07-KOR-MOFU-Core A", "Lead Priority": "P1", "Lead ID": "L3" }, // segment 필터로 제외
    { "Business Segment": "Webinar", "First Touch Detail": "WB-2025-07-US-MOFU-Core C", "Lead Priority": "P1", "Lead ID": "L4" }, // KOR 아님 → 제외
    { "Business Segment": "Webinar", "First Touch Detail": "WF-2025-07-KOR-MOFU-Core D eBook", "Lead Priority": "P1", "Lead ID": "L5" } // TYPE이 WF → 제외
  ];

  const newRegistered = {};
  const nlP1 = {};
  const leadIdToKey = {};

  aggregateLeadsRecords_(records, newRegistered, nlP1, leadIdToKey);

  const pass =
    newRegistered["WB-2025-07-KOR-MOFU-Core A"] === 2 &&
    nlP1["WB-2025-07-KOR-MOFU-Core A"] === 2 &&
    newRegistered["EV-2025-07-KOR-MOFU-Core B"] === 1 &&
    leadIdToKey["L1"] === "WB-2025-07-KOR-MOFU-Core A" &&
    leadIdToKey["L6"] === "WB-2025-07-KOR-MOFU-Core A" &&
    leadIdToKey["L2"] === "EV-2025-07-KOR-MOFU-Core B" &&
    leadIdToKey["L3"] === undefined &&
    leadIdToKey["L4"] === undefined &&
    leadIdToKey["L5"] === undefined;

  Logger.log("Result: " + JSON.stringify({ newRegistered, nlP1, leadIdToKey }));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Funnel Aggregates (IC Request/Booked/Complete/Deals/Revenue)
 *
 * WHY (하이브리드 소스 원칙, 2026-07-24 확정)
 * "모든 리포트는 Leads_OPS를 읽는다" 원칙을 유지하기 위해 Funnel
 * 지표는 MTA_Master가 아니라 Leads_OPS에서 그대로 읽는다 (이미
 * 동기화된 값, 이중 계산 없음). leadIdToKey(Leads_Master 기준,
 * First Touch)로 조인하므로 Funnel 지표는 자동으로 First Touch
 * Attribution 기준이 된다 — MTA_Master(터치 레벨)는 여기서 쓰지 않는다.
 *
 * "IC Request" 정의(가정, docs/EventsReportDesign 계획 참고) =
 * Total IC Requests > 0인 Lead 수 (체크박스는 매 sync마다 리셋되므로
 * durable한 카운터 기준으로 판단).
 *
 * INPUT
 * leadIdToKey : Object  (computeLeadsAggregates_()의 결과)
 *
 * OUTPUT
 * { icRequest, icBooked, icComplete, dealsWon, revenue } (각 {utmKey: count|sum})
 *
 * TEST
 * testComputeFunnelAggregates_ 참고
 * ==========================================================
 */
function computeFunnelAggregates_(leadIdToKey) {

  const icRequest = {};
  const icBooked = {};
  const icComplete = {};
  const dealsWon = {};
  const revenue = {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(OPS.SHEET.OPS);

  if (!sheet) return { icRequest, icBooked, icComplete, dealsWon, revenue };

  aggregateFunnelRecords_(
    sheetToObjects(sheet),
    leadIdToKey,
    icRequest, icBooked, icComplete, dealsWon, revenue
  );

  return { icRequest, icBooked, icComplete, dealsWon, revenue };

}


/**
 * ==========================================================
 * Aggregate Funnel Records (순수 함수, 테스트용으로 분리)
 * ==========================================================
 */
function aggregateFunnelRecords_(opsRecords, leadIdToKey, icRequest, icBooked, icComplete, dealsWon, revenue) {

  opsRecords.forEach(function (r) {

    const leadId = String(r["Lead ID"] || "").trim();

    if (!leadId) return;

    const key = leadIdToKey[leadId];

    if (!key) return;   // 이 Lead의 First Touch가 Webinar/Seminar가 아니었음

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
 * TEST — aggregateFunnelRecords_()
 * ==========================================================
 */
function testComputeFunnelAggregates_() {

  const leadIdToKey = { "L1": "A_US-50", "L2": "B" };

  const opsRecords = [
    { "Lead ID": "L1", "Total IC Requests": 2, "IC Booked Date": new Date(2026, 0, 1), "IC Completed Date": "", "Opportunity Won Date": new Date(2026, 0, 5), "Revenue": 1000 },
    { "Lead ID": "L2", "Total IC Requests": 0, "IC Booked Date": "", "IC Completed Date": "", "Opportunity Won Date": "", "Revenue": 0 },
    { "Lead ID": "L3", "Total IC Requests": 1, "IC Booked Date": new Date(2026, 0, 1), "IC Completed Date": "", "Opportunity Won Date": "", "Revenue": 500 }  // leadIdToKey에 없음 (First Touch가 다른 세그먼트) → 제외
  ];

  const icRequest = {}, icBooked = {}, icComplete = {}, dealsWon = {}, revenue = {};

  aggregateFunnelRecords_(opsRecords, leadIdToKey, icRequest, icBooked, icComplete, dealsWon, revenue);

  const pass =
    icRequest["A_US-50"] === 1 &&
    icBooked["A_US-50"] === 1 &&
    dealsWon["A_US-50"] === 1 &&
    revenue["A_US-50"] === 1000 &&
    icRequest["B"] === undefined &&
    Object.keys(revenue).length === 1;

  Logger.log("Result: " + JSON.stringify({ icRequest, icBooked, icComplete, dealsWon, revenue }));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Is Valid Date (내부 헬퍼)
 * ==========================================================
 */
function isValidDate_(value) {

  return value instanceof Date && !isNaN(value.getTime());

}


/**
 * ==========================================================
 * Strip Registration Form Suffix
 *
 * WHY
 * Marketo Program 이름 뒤에 "(구분자) Registered for Webinar/Seminar
 * from X Form" 형태의 등록 폼 종류 접미사가 붙는 경우가 있음 — 같은
 * 이벤트라도 등록 폼(Website Form/FB LG Form 등)에 따라 raw 값이
 * 달라져, 접미사를 안 떼고 그대로 매칭 키로 쓰면 같은 이벤트가 여러
 * 행으로 쪼개지는 버그가 있었음 (2026-07-24, 사용자가 실 빌드 결과에서
 * 발견 — "Marketo Campaign name" 표시값만 정제하고 매칭 키 자체는
 * 원문 그대로 썼던 게 원인). 이후 이 함수를 aggregateMTATouchRecords_()/
 * aggregateLeadsRecords_()의 키 추출 단계에서 직접 적용해 근본 해결 —
 * 매칭 키 자체가 canonical(정제된) 값이 되도록 함.
 * 구분자가 "丨"/"｜"/"|"/"ㅣ"/소문자 "l" 등 실데이터에서 여러 변형으로
 * 관찰됨.
 *
 * INPUT
 * programName : string
 *
 * OUTPUT
 * string  (접미사 제거된 이름, 패턴 불일치 시 원문 trim만)
 *
 * TEST
 * testStripRegistrationFormSuffix_ 참고
 * ==========================================================
 */
function stripRegistrationFormSuffix_(programName) {

  const str = String(programName || "");

  const match = str.match(/^([\s\S]*?)(?:\s*[|｜丨ㅣl])?\s*Registered for (?:Webinar|Seminar) from\b[\s\S]*$/i);

  return match ? match[1].trim() : str.trim();

}


/**
 * ==========================================================
 * TEST — stripRegistrationFormSuffix_()
 * ==========================================================
 */
function testStripRegistrationFormSuffix_() {

  const pass =
    stripRegistrationFormSuffix_(
      "WB-2026-06-KOR-MOFU-Core Rise Stanford Roadmap for rising G8~9 l Registered for Webinar from FB LG Form"
    ) === "WB-2026-06-KOR-MOFU-Core Rise Stanford Roadmap for rising G8~9" &&
    stripRegistrationFormSuffix_(
      "WB-2026-07-KOR-MOFU-Core Grades vs ECsㅣRegistered for Webinar from FB LG Form"
    ) === "WB-2026-07-KOR-MOFU-Core Grades vs ECs" &&
    stripRegistrationFormSuffix_(
      "WB-2026-06-KOR-MOFU-Core DIS To Harvard and Stanford"
    ) === "WB-2026-06-KOR-MOFU-Core DIS To Harvard and Stanford" &&
    stripRegistrationFormSuffix_("") === "";

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Is Korean Program (국가 필터)
 *
 * WHY
 * Marketo Program 이름은 "{TYPE}-{YYYY}-{MM}-{COUNTRY}-{FUNNEL}-{Division}
 * {이벤트명}" 구조라 COUNTRY가 항상 4번째 하이픈 토큰(index 3)에 위치.
 * KR(KOR) 외 국가(US/CA/HK/SG 등)는 다른 팀 캠페인이라 Events_OPS
 * 관리 대상이 아님 (2026-07-24 사용자 확인).
 *
 * INPUT
 * programName : string
 *
 * OUTPUT
 * boolean
 *
 * TEST
 * testIsKoreanProgram_ 참고
 * ==========================================================
 */
function isKoreanProgram_(programName) {

  const parts = String(programName || "").split("-");

  return parts.length > 3 && parts[3].trim() === EVENTS.COUNTRY_FILTER;

}


/**
 * ==========================================================
 * TEST — isKoreanProgram_()
 * ==========================================================
 */
function testIsKoreanProgram_() {

  const pass =
    isKoreanProgram_("WB-2025-07-KOR-MOFU-Core EC for Each Year of High School") === true &&
    isKoreanProgram_("EV-2024-01-KOR-MOFU Core US Offline Seminar in Irvine (3/9)") === true &&
    isKoreanProgram_("WB-2025-07-US-MOFU-Core Some US Team Webinar") === false &&
    isKoreanProgram_("WB-2025-07-CA-MOFU-Core Some CA Team Webinar") === false &&
    isKoreanProgram_("") === false;

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Is Eligible Event Type (TYPE 접두사 필터)
 *
 * WHY
 * Marketo Program 이름의 1번째 하이픈 토큰(TYPE)이 WB(Webinar)/EV
 * (Seminar)인 것만 실제 라이브 이벤트로 확인됨 — WF(주로 ebook/practice
 * test/consult page 등)는 Business Segment가 Webinar/Seminar로 잡혀도
 * 대부분 이벤트가 아님 (2026-07-24, 사용자가 실데이터에서 다수 예외 확인).
 * 소수 진짜 이벤트인데 WF로 잘못 태깅된 경우는 자동 포함하지 않고,
 * Ops가 Events_OPS에 직접 행을 추가하면 다음 Engine 갱신 때 매칭됨.
 *
 * INPUT
 * programName : string
 *
 * OUTPUT
 * boolean
 *
 * TEST
 * testIsEligibleEventType_ 참고
 * ==========================================================
 */
function isEligibleEventType_(programName) {

  const type = String(programName || "").split("-")[0].trim();

  return EVENTS.EVENT_TYPE_PREFIXES.indexOf(type) !== -1;

}


/**
 * ==========================================================
 * TEST — isEligibleEventType_()
 * ==========================================================
 */
function testIsEligibleEventType_() {

  const pass =
    isEligibleEventType_("WB-2025-07-KOR-MOFU-Core EC for Each Year of High School") === true &&
    isEligibleEventType_("EV-2024-01-KOR-MOFU Core US Offline Seminar in Irvine (3/9)") === true &&
    isEligibleEventType_("WF-2021-09-KOR-MOFU-Core Hyperlocalized ECL eBook") === false &&
    isEligibleEventType_("") === false;

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Is Eligible Event Program (국가 + TYPE 필터 결합)
 *
 * WHY
 * aggregateMTATouchRecords_()/aggregateLeadsRecords_()에서 매번 두
 * 조건을 같이 쓰므로 하나로 묶음 — isKoreanProgram_()/isEligibleEventType_()
 * 각각은 독립적으로 테스트/재사용 가능하도록 유지.
 * ==========================================================
 */
function isEligibleEventProgram_(programName) {

  return isKoreanProgram_(programName) && isEligibleEventType_(programName);

}


/**
 * ==========================================================
 * Parse Program Type And Date
 *
 * WHY
 * Marketo Program 이름 맨 앞이 "{TYPE}-{YYYY}-{MM}-..." 구조라
 * (예: "WB-2025-07-KOR-MOFU-Core ..."), EventType/Event Date를
 * Events_OPS 신규/미입력 행에 자동 prefill하기 위해 이 두 값을
 * 추출한다 (2026-07-24, 사용자 요청). 날짜는 월 단위 정보만 있어
 * "그 달 1일"로 표현 — 실제 일자는 Ops가 알게 되면 수동으로 고침.
 *
 * INPUT
 * programName : string
 *
 * OUTPUT
 * { type, eventDate: Date } | null (패턴 불일치 시)
 *
 * TEST
 * testParseProgramTypeAndDate_ 참고
 * ==========================================================
 */
function parseProgramTypeAndDate_(programName) {

  const match = String(programName || "").match(/^([A-Za-z]+)-(\d{4})-(\d{2})-/);

  if (!match) return null;

  const year = Number(match[2]);
  const month = Number(match[3]);

  if (month < 1 || month > 12) return null;

  return {
    type: match[1],
    eventDate: new Date(year, month - 1, 1)
  };

}


/**
 * ==========================================================
 * TEST — parseProgramTypeAndDate_()
 * ==========================================================
 */
function testParseProgramTypeAndDate_() {

  const parsed = parseProgramTypeAndDate_("WB-2025-07-KOR-MOFU-Core EC for Each Year of High School");
  const unmatched = parseProgramTypeAndDate_("no-date-here");

  const pass =
    parsed !== null &&
    parsed.type === "WB" &&
    parsed.eventDate.getFullYear() === 2025 &&
    parsed.eventDate.getMonth() === 6 &&    // 0-based, 7월 = index 6
    parsed.eventDate.getDate() === 1 &&
    unmatched === null;

  Logger.log("Parsed: " + JSON.stringify(parsed));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Pick Mode Event Date (최빈값 UTM 날짜 선택)
 *
 * WHY
 * aggregateMTATouchRecords_()가 모은 프로그램별 UTM 날짜 후보
 * ({dateStr: {count, sampleUTM}})에서, 가장 많이 등장한 날짜를
 * Event Date 대표값으로 채택한다 (2026-07-24 사용자 확정 — 최빈값
 * 방식). 동률이면 먼저 나온(Object.keys 순서상 앞선) 날짜를 채택
 * — 실무상 큰 영향 없다고 판단, 별도 tie-break 로직 추가 안 함.
 *
 * INPUT
 * dateCandidates : { dateStr: { count, sampleUTM } } | undefined
 *
 * OUTPUT
 * { eventDate: Date, sampleUTM: string } | null
 *
 * TEST
 * testPickModeEventDate_ 참고
 * ==========================================================
 */
function pickModeEventDate_(dateCandidates) {

  if (!dateCandidates) return null;

  let best = null;

  Object.keys(dateCandidates).forEach(function (dateStr) {

    const entry = dateCandidates[dateStr];

    if (!best || entry.count > best.count) {
      best = { dateStr: dateStr, count: entry.count, sampleUTM: entry.sampleUTM };
    }

  });

  if (!best) return null;

  const parts = best.dateStr.split("-");

  return {
    eventDate: new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])),
    sampleUTM: best.sampleUTM
  };

}


/**
 * ==========================================================
 * TEST — pickModeEventDate_()
 * ==========================================================
 */
function testPickModeEventDate_() {

  const candidates = {
    "2026-06-22": { count: 5, sampleUTM: "KR_core_2026-06-22_dis-to-stanford" },
    "2026-06-15": { count: 2, sampleUTM: "KR_core_2026-06-15_dis-to-stanford" }
  };

  const result = pickModeEventDate_(candidates);
  const empty = pickModeEventDate_(undefined);

  const pass =
    result !== null &&
    result.eventDate.getFullYear() === 2026 &&
    result.eventDate.getMonth() === 5 &&   // 0-based, 6월 = index 5
    result.eventDate.getDate() === 22 &&
    result.sampleUTM === "KR_core_2026-06-22_dis-to-stanford" &&
    empty === null;

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Write Events Engine to Sheet (없으면 생성, 숨김 유지)
 * ==========================================================
 */
function writeEventsEngine_(rows) {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(EVENTS.SHEET.ENGINE);

  if (!sheet) {
    sheet = ss.insertSheet(EVENTS.SHEET.ENGINE);
  }

  sheet.clearContents();

  sheet.getRange(1, 1, 1, EVENTS_ENGINE_HEADERS.length)
    .setValues([EVENTS_ENGINE_HEADERS]);

  if (rows.length > 0) {

    sheet.getRange(2, 1, rows.length, EVENTS_ENGINE_HEADERS.length)
      .setValues(rows);

  }

  sheet.hideSheet();

  SpreadsheetApp.flush();

}


/**
 * ==========================================================
 * Read Events Engine as Lookup Map (UTM Key → Row Object)
 * ==========================================================
 */
function readEventsEngineMap_() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(EVENTS.SHEET.ENGINE);

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
function runRefreshEventsEngine() {

  refreshEventsEngine_();

}


/**
 * ==========================================================
 * Investigate UTM Grouping Candidates (1회성 진단, 수동 실행용)
 *
 * WHY
 * 실데이터 확인 결과 UTM Key(2,167개)가 프로그램(~150개) 단위가
 * 아니라 채널/캠페인 단위였음 — 하나의 프로그램이 여러 채널
 * (Meta/Google 등)·여러 날짜 재집행분으로 UTM이 갈라짐. "날짜
 * 토큰만 제거하면 몇 개 그룹으로 줄어드는지", "그룹 안에 날짜가
 * 몇 종류나 섞여있는지"(Event Date 자동추출 안전성 판단용)를 실제
 * Events_Engine 데이터로 검증하기 위한 진단. 이 결과를 보고
 * 그룹핑 규칙(및 Event Date 자동 prefill 여부)을 확정한다.
 *
 * INPUT
 * 없음 (Events_Engine 시트를 직접 읽음 — 먼저 runRefreshEventsEngine()
 * 실행 필요)
 *
 * OUTPUT
 * 없음 (Logger.log로만 결과 출력)
 * ==========================================================
 */
function runInvestigateUTMGrouping() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const engineSheet = ss.getSheetByName(EVENTS.SHEET.ENGINE);

  if (!engineSheet) {
    throw new Error(EVENTS.SHEET.ENGINE + " sheet not found. runRefreshEventsEngine()를 먼저 실행하세요.");
  }

  const values = engineSheet.getDataRange().getValues();

  const utmKeys = [];

  for (let i = 1; i < values.length; i++) {
    const key = String(values[i][0] || "").trim();
    if (key) utmKeys.push(key);
  }

  const DATE_PATTERN = /\d{4}-\d{2}-\d{2}/;

  const groups = {};

  utmKeys.forEach(function (key) {

    const dateMatch = key.match(DATE_PATTERN);
    const date = dateMatch ? dateMatch[0] : null;
    const groupKey = date ? key.replace(date, "{DATE}") : key;

    if (!groups[groupKey]) {
      groups[groupKey] = { count: 0, dates: {}, samples: [] };
    }

    groups[groupKey].count++;

    if (date) groups[groupKey].dates[date] = true;

    if (groups[groupKey].samples.length < 3) {
      groups[groupKey].samples.push(key);
    }

  });

  const groupKeys = Object.keys(groups);

  let singleDateGroups = 0;
  let multiDateGroups = 0;
  let noDateGroups = 0;

  groupKeys.forEach(function (gk) {

    const dateCount = Object.keys(groups[gk].dates).length;

    if (dateCount === 0) noDateGroups++;
    else if (dateCount === 1) singleDateGroups++;
    else multiDateGroups++;

  });

  Logger.log("======================================");
  Logger.log("UTM Grouping Investigation (날짜 토큰 제거 기준)");
  Logger.log("======================================");
  Logger.log("Total raw UTM Keys           : " + utmKeys.length);
  Logger.log("Total groups (date stripped) : " + groupKeys.length);
  Logger.log("  - 그룹당 날짜 1종류(안전)   : " + singleDateGroups);
  Logger.log("  - 그룹당 날짜 여러종류(위험) : " + multiDateGroups);
  Logger.log("  - 날짜 토큰 자체 없음        : " + noDateGroups);
  Logger.log("");

  const sorted = groupKeys.map(function (gk) {

    return {
      groupKey: gk,
      count: groups[gk].count,
      dateCount: Object.keys(groups[gk].dates).length,
      samples: groups[gk].samples
    };

  }).sort(function (a, b) { return b.count - a.count; });

  Logger.log("---- Top 30 그룹 (UTM 개수 많은 순) ----");

  sorted.slice(0, 30).forEach(function (g) {

    Logger.log(
      g.count + "개 UTM (날짜 " + g.dateCount + "종류) — " + g.groupKey +
      "  |  예: " + g.samples.join(" / ")
    );

  });

}


/**
 * ==========================================================
 * Investigate First Touch Detail Grouping (1회성 진단, 수동 실행용)
 *
 * WHY
 * MTA_Master의 "First Touch Detail"(raw "Lead Source Detail")이
 * 실제 Marketo Program 이름을 담고 있다는 사실 확인됨(2026-07-24,
 * 사용자 확인). UTM Key(MKT UTM Campaign, 채널/캠페인 단위) 대신
 * 이 필드로 그룹핑하면 프로그램 단위(~150개)에 훨씬 가까워질 것으로
 * 예상되나, 예시로 보여준 실제 캠페인명("...Registered for Webinar
 * from Website Form" vs "...from FB LG Form")을 보면 폼 종류별로
 * "|"/"丨" 뒤에 접미사가 붙어 프로그램보다 더 잘게 쪼개질 가능성도
 * 있어, 접미사 제거 전/후 실제 그룹 수를 실데이터로 검증한다.
 *
 * INPUT
 * 없음 (MTA_Master 시트를 직접 읽음)
 *
 * OUTPUT
 * 없음 (Logger.log로만 결과 출력)
 * ==========================================================
 */
function runInvestigateFirstTouchDetailGrouping() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);

  if (!sheet) {
    throw new Error(CONFIG.SHEETS.MTA_MASTER + " sheet not found.");
  }

  const records = sheetToObjects(sheet);

  const SUFFIX_SPLIT_PATTERN = /[|｜丨]/;

  const rawGroups = {};
  const strippedGroups = {};

  let totalTouches = 0;
  let emptyDetail = 0;

  records.forEach(function (r) {

    if (EVENTS.SEGMENTS.indexOf(r["Business Segment"]) === -1) return;

    totalTouches++;

    const detail = String(r["First Touch Detail"] || "").trim();

    if (!detail) {
      emptyDetail++;
      return;
    }

    rawGroups[detail] = (rawGroups[detail] || 0) + 1;

    const stripped = detail.split(SUFFIX_SPLIT_PATTERN)[0].trim();

    if (!strippedGroups[stripped]) {
      strippedGroups[stripped] = { count: 0, samples: [] };
    }

    strippedGroups[stripped].count++;

    if (
      strippedGroups[stripped].samples.length < 3 &&
      strippedGroups[stripped].samples.indexOf(detail) === -1
    ) {
      strippedGroups[stripped].samples.push(detail);
    }

  });

  Logger.log("======================================");
  Logger.log("First Touch Detail Grouping Investigation");
  Logger.log("======================================");
  Logger.log("Total Webinar/Seminar touches            : " + totalTouches);
  Logger.log("Empty First Touch Detail                 : " + emptyDetail);
  Logger.log("Distinct raw First Touch Detail values    : " + Object.keys(rawGroups).length);
  Logger.log("Distinct after stripping |/丨 suffix       : " + Object.keys(strippedGroups).length);
  Logger.log("");

  const sortedStripped = Object.keys(strippedGroups).map(function (key) {

    return {
      key: key,
      count: strippedGroups[key].count,
      samples: strippedGroups[key].samples
    };

  }).sort(function (a, b) { return b.count - a.count; });

  Logger.log("---- Top 30 그룹 (접미사 제거 기준, 터치 개수 많은 순) ----");

  sortedStripped.slice(0, 30).forEach(function (g) {

    Logger.log(
      g.count + "개 터치 — " + g.key +
      "  |  예: " + g.samples.join(" // ")
    );

  });

}
