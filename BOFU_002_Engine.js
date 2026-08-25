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
 * v1.6.0
 *
 * Change Log
 * v1.6.0 (2026-08-25)
 * - `computeBOFUMetaSpendAggregates_()` → `computeBOFUMetaCampaignDataAggregates_()`로
 *   교체(사용자 요청, Spent 자동화에 이은 2단계) — `refreshBOFUEngine_()`의
 *   `metaSpendAgg` 참조도 `metaAgg.spend`로 변경(Spent 계산 자체는 동일,
 *   참조 경로만 변경). `BOFU_004_Merge.js`의
 *   `applyBOFUMetaCampaignDataIfMatched_()`가 이 함수의 반환값을 직접
 *   받아 Campaign/Off-On/Start Date/End Date/Link clicks/Results를 매칭된
 *   프로그램에 한해 자동으로 채운다(Engine 시트를 거치지 않고
 *   `buildBOFUOPS()` 실행 시점에 직접 계산 — Date/배열 값을 시트 캐시로
 *   왕복시키면 타입 손실 위험 있음, 오늘 겪은 Content_OPS Month 셀 Date
 *   강제변환 사례 참고).
 * v1.5.0 (2026-08-25)
 * - Spent 자동 집계 추가(사용자 요청, `BOFU_001_Config.js` v1.5.0에서
 *   `Spent`를 `GROUP_3_MANUAL`→`GROUP_4_COMPUTED`로 이동한 것과 짝)  —
 *   신규 `isEligibleBOFUProgram_()`/`computeBOFUMetaSpendAggregates_()`,
 *   `EVENTS_002_Engine.js` v1.18.0의 제네릭
 *   `aggregateMetaSpendByProgram_()`/`resolveMetaCampaignProgramKey_()`
 *   재사용(Events 전용 EVENT_TYPE_PREFIXES 필터 없이 Business Segment로
 *   자격 판정). `refreshBOFUEngine_()`가 이 집계도 allKeys 합집합에
 *   포함하고 rows 배열 마지막에 붙이도록 배선.
 * v1.4.0 (2026-08-19)
 * - **Start Date 자동 채움이 여전히 공란인 사례 다수 발견(사용자 보고,
 *   "Duke CAO advise" 등 20건+) — 원인: 1차 소스였던 Leads_Master
 *   "New Registered"는 "이 프로그램이 리드의 첫 터치"인 경우만 잡는데,
 *   BOFU 프로그램(Contact/Consult 성격상 후반부 터치)은 리드의 진짜 첫
 *   터치가 훨씬 이전의 다른 프로그램인 경우가 흔함 — SF Reg.(MTA 전체
 *   터치)는 있는데 SF NL(첫 터치)은 0인 프로그램이 많아서였음.** MTA_Master
 *   전체 터치("MTA Created Date")도 2차 소스로 집계
 *   (`aggregateBOFUMTATouchRecords_()`의 신규 `earliestTouchDate` 파라미터)
 *   — 신규 `pickEarliestDate_()`(순수 함수)로 두 소스 중 더 이른 날짜
 *   채택. `refreshBOFUEngine_()` 배선 변경. 신규 테스트
 *   `testAggregateBOFUMTATouchRecordsEarliestTouchDate`/
 *   `testPickEarliestDate` 추가.
 * v1.3.0 (2026-08-19)
 * - `runDeleteDeadBOFUOPSRows()` 신규(수동 실행 전용) — v1.2.0의
 *   `computeBOFUDealAggregates_()` 버그 수정만으로는 이미 새어 들어온
 *   WB-/EV- 행이 안 지워짐(`mergeBOFUOPS_()`가 기존 키를 항상 합집합
 *   보존하는 구조라서) — `71_Search_Engine.js`의
 *   `runDeleteDeadSearchOPSRows()`(Search_OPS에서 동일 문제 116건 정리한
 *   전례)와 동일 패턴으로 신규 작성. **반드시 `refreshBOFUEngine_()`를
 *   먼저 실행한 뒤 이 함수를 실행할 것.**
 * v1.2.0 (2026-08-19)
 * - **버그 수정(사용자 발견) — `computeBOFUDealAggregates_()`에 Business
 *   Segment 게이트가 아예 빠져있었음**. MTA/Leads 경로는 둘 다
 *   `BOFU.SEGMENTS.indexOf(...)`로 Business Segment=BOFU만 통과시키는데
 *   이 Deal Tracker 경로만 KOR 프로그램이기만 하면 통과돼, 실제로는
 *   Webinar/Seminar인 WB-/EV- 프로그램의 딜이 BOFU_OPS에 수백 개 행으로
 *   새어 들어오고 있었음 — Deal Tracker의 `businessSegment`(Segment 열
 *   원본)로 동일하게 게이트해 수정. 회귀 방지 테스트 케이스 추가
 *   (`testComputeBOFUDealAggregates_`).
 * - `aggregateBOFULeadsRecords_()`/`computeBOFULeadsAggregates_()`에
 *   `earliestCreateDate` 신규(선택 파라미터, 기존 호출 하위 호환) —
 *   Start Date 자동 채움용(사용자 요청, `BOFU_001_Config.js` v1.3.0/
 *   `BOFU_004_Merge.js` 참고). `refreshBOFUEngine_()`의 rows 배열에
 *   "Earliest Lead Date" 추가. 신규 테스트
 *   `testAggregateBOFULeadsRecordsEarliestCreateDate` 추가.
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
  const metaAgg = computeBOFUMetaCampaignDataAggregates_();

  const allKeys = {};

  [
    mtaAgg.allRegistered, mtaAgg.p1All,
    leadsAgg.newRegistered, leadsAgg.nlP1,
    funnelAgg.icRequest, funnelAgg.icBooked,
    funnelAgg.icComplete, dealAgg.dealsWon, dealAgg.revenue,
    metaAgg.spend
  ].forEach(function (map) {
    Object.keys(map).forEach(function (key) {
      allKeys[key] = true;
    });
  });

  const rows = Object.keys(allKeys).map(function (key) {

    return [
      key,
      pickEarliestDate_(leadsAgg.earliestCreateDate[key], mtaAgg.earliestTouchDate[key]),
      mtaAgg.allRegistered[key] || 0,
      leadsAgg.newRegistered[key] || 0,
      mtaAgg.p1All[key] || 0,
      leadsAgg.nlP1[key] || 0,
      funnelAgg.icRequest[key] || 0,
      funnelAgg.icBooked[key] || 0,
      funnelAgg.icComplete[key] || 0,
      dealAgg.dealsWon[key] || 0,
      dealAgg.revenue[key] || 0,
      metaAgg.spend[key] || 0
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
 * Pick Earliest Date (순수 함수)
 *
 * WHY
 * "Earliest Lead Date"(Start Date 자동 채움 후보) 소스가 두 곳(Leads_Master
 * New Registered / MTA_Master 전체 터치) — 둘 중 더 이른 날짜를 채택.
 * 둘 다 없으면 ""(공란, Events의 Event Date 패턴과 동일하게 시트에 빈
 * 문자열로 기록).
 *
 * TEST
 * testPickEarliestDate 참고
 * ==========================================================
 */
function pickEarliestDate_(dateA, dateB) {

  const validA = dateA instanceof Date && !isNaN(dateA.getTime());
  const validB = dateB instanceof Date && !isNaN(dateB.getTime());

  if (validA && validB) return dateA < dateB ? dateA : dateB;
  if (validA) return dateA;
  if (validB) return dateB;

  return "";

}


/**
 * ==========================================================
 * TEST — pickEarliestDate_()
 * ==========================================================
 */
function testPickEarliestDate() {

  const early = new Date(2026, 0, 1);
  const late = new Date(2026, 5, 1);

  const pass =
    pickEarliestDate_(late, early) === early &&
    pickEarliestDate_(early, late) === early &&
    pickEarliestDate_(early, undefined) === early &&
    pickEarliestDate_(undefined, early) === early &&
    pickEarliestDate_(undefined, undefined) === "";

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Is Eligible BOFU Program (순수 함수)
 *
 * WHY
 * UTM_Program_Dictionary가 찾아낸 Marketo Program명이 진짜 BOFU
 * 프로그램인지 판정 — `EVENTS_002_Engine.js`의
 * `isEligibleEventProgram_()`(EVENT_TYPE_PREFIXES 필터)와 동일 역할이지만
 * BOFU는 단일 세그먼트라 Business Segment 체크 하나로 충분(BOFU_002_Engine.js
 * 파일 헤더 WHY와 동일 원칙 — "Events와 달리 EVENT_TYPE_PREFIXES 필터가
 * 없다"). `getBusinessSegment(programName, programName)` — 문자열 하나를
 * campaign/detail 두 인자 모두에 넣는 게 이미 확립된 관례
 * (`AD_006_KakaoMoments.js` `computeKakaoMomentsSyncRow_()` 참고, 한쪽
 * 인자만 넣으면 "wb-"/"ev-" 등 detail 전용 신호를 놓쳐 분류가 실패함).
 *
 * TEST
 * testIsEligibleBOFUProgram 참고
 * ==========================================================
 */
function isEligibleBOFUProgram_(programName) {

  return isKoreanProgram_(programName) &&
    BOFU.SEGMENTS.indexOf(getBusinessSegment(programName, programName)) !== -1;

}


/**
 * ==========================================================
 * TEST — isEligibleBOFUProgram_()
 * ==========================================================
 */
function testIsEligibleBOFUProgram() {

  const pass =
    isEligibleBOFUProgram_("WF-2026-08-KOR-BOFU-Core Duke CAO advise") === true &&
    isEligibleBOFUProgram_("WB-2026-02-KOR-MOFU-Core Application Tips") === false &&
    isEligibleBOFUProgram_("WF-2026-01-KOR-MOFU-Core Some Ebook") === false &&
    isEligibleBOFUProgram_("") === false;

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute BOFU Meta Campaign Data Aggregates (IO 래퍼)
 *
 * WHY
 * `EVENTS_002_Engine.js`의 제네릭 `aggregateMetaCampaignDataByProgram_()`/
 * `resolveMetaCampaignProgramKey_()`를 BOFU 전용 자격 판정
 * (`isEligibleBOFUProgram_()`)으로 감싼 IO 래퍼 — `refreshBOFUEngine_()`가
 * `BOFU.GROUP_4_COMPUTED`(v1.5.0에서 Spent 추가)의 Spent를 채우는 데
 * 쓰고, `BOFU_004_Merge.js`의 `applyBOFUMetaCampaignDataIfMatched_()`가
 * Campaign/Off-On/Start Date/End Date/Link clicks/Results 자동 덮어쓰기에
 * 반환값 전체(spend 외 clicks/results/campaignNames/campaignStart/
 * campaignEnd/hasOngoing)를 사용(2026-08-25, Spent 자동화에 이은 2단계
 * 사용자 요청).
 * ==========================================================
 */
function computeBOFUMetaCampaignDataAggregates_() {

  return aggregateMetaCampaignDataByProgram_(
    readMetaRawRows_(), readUtmProgramDictionaryMap_(), isEligibleBOFUProgram_
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
 * { allRegistered: {key: count}, p1All: {key: count},
 *   earliestTouchDate: {key: Date} }
 *
 * TEST
 * testComputeBOFUMTAAggregates_ 참고
 * ==========================================================
 */
function computeBOFUMTAAggregates_() {

  const allRegistered = {};
  const p1All = {};
  const earliestTouchDate = {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);

  if (!sheet) return { allRegistered, p1All, earliestTouchDate };

  aggregateBOFUMTATouchRecords_(sheetToObjects(sheet), allRegistered, p1All, earliestTouchDate);

  return { allRegistered, p1All, earliestTouchDate };

}


/**
 * ==========================================================
 * Aggregate BOFU MTA Touch Records (순수 함수, 테스트용으로 분리)
 *
 * WHY (earliestTouchDate, 2026-08-19 신규)
 * Start Date 자동 채움(applyBOFUAutoDerivedFieldsIfBlank_(), BOFU_004_Merge.js)
 * 의 1차 소스였던 Leads_Master "New Registered"(aggregateBOFULeadsRecords_
 * earliestCreateDate)는 "이 프로그램이 리드의 첫 터치인 경우"만 잡는다 —
 * 신규 캠페인에 기존 리드가 재참여(첫 터치는 예전 다른 프로그램)한
 * 경우엔 SF Reg.(이 함수)는 잡히는데 SF NL은 0이라 Start Date 후보가
 * 안 나오는 사례를 실측으로 확인("WF-2026-08-KOR-BOFU-Core Duke CAO
 * advise" — 리드는 있는데 Start Date가 계속 공란). 그래서 MTA_Master
 * (모든 터치, "MTA Created Date")도 2차 소스로 같이 집계 —
 * BOFU_004_Merge.js가 둘 중 더 이른 날짜를 채택.
 * ==========================================================
 */
function aggregateBOFUMTATouchRecords_(records, allRegistered, p1All, earliestTouchDate) {

  records.forEach(function (r) {

    if (BOFU.SEGMENTS.indexOf(r["Business Segment"]) === -1) return;

    const key = stripRegistrationFormSuffix_(r[BOFU.MATCH_FIELD.MTA]);

    if (!key || !isKoreanProgram_(key)) return;

    allRegistered[key] = (allRegistered[key] || 0) + 1;

    if (isEffectiveBOFUP1_(r["Lead Priority"])) {
      p1All[key] = (p1All[key] || 0) + 1;
    }

    if (earliestTouchDate) {

      const touchDate = r["MTA Created Date"];

      if (touchDate instanceof Date && !isNaN(touchDate.getTime())) {
        if (!earliestTouchDate[key] || touchDate < earliestTouchDate[key]) {
          earliestTouchDate[key] = touchDate;
        }
      }

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
 * TEST — aggregateBOFUMTATouchRecords_()의 earliestTouchDate
 * ==========================================================
 */
function testAggregateBOFUMTATouchRecordsEarliestTouchDate() {

  const records = [
    { "Business Segment": "BOFU", "Lead Source Detail": "WF-2026-08-KOR-BOFU-Core Duke CAO advise", "Lead Priority": "Priority 3", "MTA Created Date": new Date(2026, 7, 17) },
    { "Business Segment": "BOFU", "Lead Source Detail": "WF-2026-08-KOR-BOFU-Core Duke CAO advise", "Lead Priority": "Priority 3", "MTA Created Date": new Date(2026, 7, 14) }, // 더 이른 날짜 — 채택돼야 함
    { "Business Segment": "Search", "Lead Source Detail": "WF-2026-08-KOR-BOFU-Core Duke CAO advise", "Lead Priority": "Priority 3", "MTA Created Date": new Date(2026, 6, 1) } // segment 필터로 제외
  ];

  const allRegistered = {};
  const p1All = {};
  const earliestTouchDate = {};

  aggregateBOFUMTATouchRecords_(records, allRegistered, p1All, earliestTouchDate);

  const pass =
    earliestTouchDate["WF-2026-08-KOR-BOFU-Core Duke CAO advise"].getTime() === new Date(2026, 7, 14).getTime();

  Logger.log("Result: " + JSON.stringify(earliestTouchDate));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute BOFU Leads Aggregates (SF NL / SF NLP1s)
 *
 * OUTPUT
 * { newRegistered: {key: count}, nlP1: {key: count},
 *   leadIdToKey: {leadId: key}, earliestCreateDate: {key: Date} }
 *
 * TEST
 * testComputeBOFULeadsAggregates_ 참고
 * ==========================================================
 */
function computeBOFULeadsAggregates_() {

  const newRegistered = {};
  const nlP1 = {};
  const leadIdToKey = {};
  const earliestCreateDate = {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS_MASTER);

  if (!sheet) return { newRegistered, nlP1, leadIdToKey, earliestCreateDate };

  aggregateBOFULeadsRecords_(sheetToObjects(sheet), newRegistered, nlP1, leadIdToKey, earliestCreateDate);

  return { newRegistered, nlP1, leadIdToKey, earliestCreateDate };

}


/**
 * ==========================================================
 * Aggregate BOFU Leads Records (순수 함수, 테스트용으로 분리)
 *
 * WHY (earliestCreateDate, 2026-08-19 신규)
 * "Start Date"(BOFU_OPS Manual)를 사용자가 아직 안 채운 신규 프로그램은
 * 정렬(compareByStartDateBlankLast_)상 항상 최하단으로 밀려 눈에 잘 안
 * 띈다는 문제가 있어(사용자 발견, "WF-2026-08-KOR-BOFU-Core Duke CAO
 * advise" 사례) — 이 프로그램으로 맨 처음 들어온 리드의 Create Date를
 * "Earliest Lead Date"로 같이 집계해, Start Date가 비어있을 때 자동
 * prefill 후보로 쓴다(BOFU_004_Merge.js 참고). 파라미터가 없으면(기존
 * 테스트 호환) 이 부분은 그냥 건너뜀.
 * ==========================================================
 */
function aggregateBOFULeadsRecords_(records, newRegistered, nlP1, leadIdToKey, earliestCreateDate) {

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

    if (earliestCreateDate) {

      const createDate = r["Create Date"];

      if (createDate instanceof Date && !isNaN(createDate.getTime())) {
        if (!earliestCreateDate[key] || createDate < earliestCreateDate[key]) {
          earliestCreateDate[key] = createDate;
        }
      }

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
 * TEST — aggregateBOFULeadsRecords_()의 earliestCreateDate
 * ==========================================================
 */
function testAggregateBOFULeadsRecordsEarliestCreateDate() {

  const records = [
    { "Business Segment": "BOFU", "First Touch Detail": "WF-2026-08-KOR-BOFU-Core Duke CAO advise", "Lead Priority": "Priority 3", "Lead ID": "L1", "Create Date": new Date(2026, 7, 17) },
    { "Business Segment": "BOFU", "First Touch Detail": "WF-2026-08-KOR-BOFU-Core Duke CAO advise", "Lead Priority": "Priority 3", "Lead ID": "L2", "Create Date": new Date(2026, 7, 15) }, // 더 이른 날짜 — 채택돼야 함
    { "Business Segment": "Search", "First Touch Detail": "WF-2026-08-KOR-BOFU-Core Duke CAO advise", "Lead Priority": "Priority 3", "Lead ID": "L3", "Create Date": new Date(2026, 7, 1) } // segment 필터로 제외 — 날짜도 반영 안 돼야 함
  ];

  const newRegistered = {};
  const nlP1 = {};
  const leadIdToKey = {};
  const earliestCreateDate = {};

  aggregateBOFULeadsRecords_(records, newRegistered, nlP1, leadIdToKey, earliestCreateDate);

  const pass =
    earliestCreateDate["WF-2026-08-KOR-BOFU-Core Duke CAO advise"].getTime() === new Date(2026, 7, 15).getTime();

  Logger.log("Result: " + JSON.stringify(earliestCreateDate));
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
 * Events와 달리 EVENT_TYPE_PREFIXES 필터가 없다(단일 세그먼트라 불필요) —
 * **단, 그렇다고 Business Segment 체크 자체를 생략해도 된다는 뜻은 아니었음
 * (2026-08-19 버그 발견·수정)**: MTA/Leads 경로(aggregateBOFUMTATouchRecords_/
 * aggregateBOFULeadsRecords_)는 둘 다 `BOFU.SEGMENTS.indexOf(...)`로
 * Business Segment=BOFU만 통과시키는데, 이 Deal Tracker 경로만 그 체크가
 * 아예 빠져있어 KOR 프로그램이기만 하면 Business Segment와 무관하게
 * 전부 통과하고 있었음 — 그 결과 실제로는 Webinar/Seminar인 WB-/EV- 프로그램의
 * 딜(Deal Tracker "Segment" 열이 그 딜을 Webinar/Seminar로 정확히 분류해뒀어도)
 * 이 여기서 새어 들어와 BOFU_OPS에 수백 개 엉뚱한 행으로 나타남(사용자
 * 발견). Deal Tracker의 `businessSegment`(row.businessSegment, "Segment"
 * 열 원본, getBusinessSegment()와 동일 taxonomy — TARGET_001_Engine.js
 * readDealTrackerRawRows_() 참고)로 동일하게 게이트해 수정.
 *
 * OUTPUT
 * { dealsWon: {utmKey: count}, revenue: {utmKey: sum} }
 *
 * TEST
 * testComputeBOFUDealAggregates_ 참고
 * ==========================================================
 */
function computeBOFUDealAggregates_() {

  return computeDealTrackerCountsByKey_(readDealTrackerRawRows_(), function (row) {

    if (BOFU.SEGMENTS.indexOf(row.businessSegment) === -1) return null;

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
    { leadSourceDetail: "WF-2025-07-KOR-BOFU-Core A", revenue: 500, businessSegment: "BOFU" },
    { leadSourceDetail: "WF-2025-07-US-BOFU-Core B", revenue: 999, businessSegment: "BOFU" },     // KOR 아님, 제외
    { leadSourceDetail: "WB-2026-07-KOR-MOFU-Core Webinar C", revenue: 777, businessSegment: "Webinar" } // BOFU 아님, 제외(회귀 방지)
  ];

  const keyFn = function (row) {
    if (BOFU.SEGMENTS.indexOf(row.businessSegment) === -1) return null;
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
 * Delete Dead BOFU_OPS Rows (합집합 병합으로 안 지워지는 죽은 키 정리,
 * 수동 실행 전용)
 *
 * WHY (2026-08-19, 사용자 발견)
 * `computeBOFUDealAggregates_()` Business Segment 게이트 누락 버그(위
 * changelog 참고)로 그동안 BOFU_OPS에 새어 들어온 WB-/EV- 프로그램 행이,
 * 코드를 고쳐 `refreshBOFUEngine_()`를 다시 돌려도 저절로 없어지지
 * 않는다 — `mergeBOFUOPS_()`가 기존 OPS 키를 항상 합집합으로 유지하는
 * 구조(Kor-EXPO-Master처럼 정당한 수동 행을 보존하기 위한 의도적 설계)라
 * Engine이 더 이상 그 키를 만들지 않아도 행 자체는 그대로 남기 때문.
 * `71_Search_Engine.js`의 `runDeleteDeadSearchOPSRows()`(Search_OPS에서
 * 동일한 문제로 죽은 키 116건 정리한 전례)와 완전히 동일한 패턴 — 지금의
 * BOFU_Engine(refreshBOFUEngine_() 실행 후 기준)에 없는 키를 BOFU_OPS에서
 * 찾아 삭제. **주의**: 반드시 `refreshBOFUEngine_()`를 먼저 실행해 Engine을
 * 최신 상태로 만든 뒤 이 함수를 실행할 것 — 안 그러면 아직 살아있는 정상
 * 키까지 죽은 걸로 오판할 수 있음.
 * ==========================================================
 */
function runDeleteDeadBOFUOPSRows() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const engineSheet = ss.getSheetByName(BOFU.SHEET.ENGINE);
  const opsSheet = ss.getSheetByName(BOFU.SHEET.OPS);

  if (!opsSheet) {
    Logger.log(BOFU.SHEET.OPS + " sheet not found.");
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
  const headers = values[BOFU.ROWS.HEADER - 1];
  const keyColIndex = headers.indexOf(BOFU.KEY);

  const rowsToDelete = [];

  for (let r = BOFU.ROWS.DATA_START - 1; r < values.length; r++) {

    const key = String(values[r][keyColIndex] || "").trim();

    if (!key) continue;
    if (liveKeys[key.toLowerCase()]) continue; // 살아있음 — 스킵

    rowsToDelete.push(r + 1); // 1-based 시트 행 번호

  }

  Logger.log("======================================");
  Logger.log("Delete Dead BOFU_OPS Rows");
  Logger.log("======================================");
  Logger.log("BOFU_OPS 현재 행 수(헤더 제외): " + (opsSheet.getLastRow() - BOFU.ROWS.DATA_START + 1));

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
    "BOFU_OPS 현재 행 수(헤더 제외): " + (opsSheet.getLastRow() - BOFU.ROWS.DATA_START + 1)
  );

  Logger.log("======================================");

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
