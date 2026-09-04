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
 * v1.9.0
 *
 * Change Log
 * v1.9.0 (2026-09-05)
 * - **버그 수정 — `isEligibleContentProgram_()`가 Program_Segment_Dictionary
 *   대신 `getBusinessSegment(programName, programName)` 재분류에만 의존해
 *   실제로는 Content인 프로그램의 Meta Spend 매칭이 누락되던 문제**
 *   (`docs/OpenItems.md` #30, `TEMPQA_051_BOFUContentMetaProgramCoverageDiagnostic.js`
 *   실측 확인 — Content 9건, 전부 matchCount/totalCount가 크고 명확한
 *   케이스). `isEligibleContentProgramPure_(programName, programSegmentMap)`
 *   신규(순수 함수, Program_Segment_Dictionary 우선 → 없으면 기존 방식
 *   폴백) — `isEligibleContentProgram_()`는 `readProgramSegmentDictionaryMap_()`
 *   로 맵을 가져와 위임하는 IO 래퍼로 축소(단일 인자 시그니처는 그대로
 *   유지, `aggregateMetaCampaignDataByProgram_()` 호출부 변경 없음).
 *   `testIsEligibleContentProgram()` 갱신 — 딕셔너리 히트/미스 양쪽 케이스 추가.
 *   `BOFU_002_Engine.js` v1.8.0과 동일 패턴/동일 세션.
 * v1.8.0 (2026-09-03)
 * - **Meta_Raw+UTM_Program_Dictionary 이중 조회 제거(`docs/OpenItems.md` #41,
 *   `BOFU_002_Engine.js` v1.7.0과 동일 패턴)** — `computeContentMetaCampaignDataAggregates_()`
 *   를 모듈 스코프 메모이제이션(`_contentMetaCampaignDataAggCache`)으로 전환.
 *   로직/반환값/출력 변경 없음.
 * v1.7.0 (2026-08-25)
 * - `computeContentMetaSpendAggregates_()` → `computeContentMetaCampaignDataAggregates_()`로
 *   교체(사용자 요청, Spent 자동화에 이은 2단계) — `refreshContentEngine_()`의
 *   `metaSpendAgg` 참조도 `metaAgg.spend`로 변경(Spent 계산 자체는 동일,
 *   참조 경로만 변경). `CONTENT_004_Merge.js`의
 *   `applyContentMetaCampaignDataIfMatched_()`가 이 함수의 반환값을 직접
 *   받아 Campaign/Off-On/Start Date/End Date/Link clicks/Results를 매칭된
 *   프로그램에 한해 자동으로 채운다(Engine 시트를 거치지 않고
 *   `buildContentOPS()` 실행 시점에 직접 계산).
 * v1.6.0 (2026-08-25)
 * - Spent 자동 집계 추가(사용자 요청, `CONTENT_001_Config.js` v1.3.0에서
 *   `Spent`를 `GROUP_3_MANUAL`→`GROUP_4_COMPUTED`로 이동한 것과 짝) —
 *   `TEMPQA_029_ContentSpentCompletenessAudit.js` 감사에서 수동 Spent가
 *   사실상 비어있던 게 발견돼 착수. 신규
 *   `isEligibleContentProgram_()`/`computeContentMetaSpendAggregates_()`,
 *   `EVENTS_002_Engine.js` v1.18.0의 제네릭
 *   `aggregateMetaSpendByProgram_()`/`resolveMetaCampaignProgramKey_()`
 *   재사용(BOFU_002_Engine.js v1.5.0과 동일 패턴, Business Segment로 자격
 *   판정). `refreshContentEngine_()`가 이 집계도 allKeys 합집합에 포함하고
 *   rows 배열 마지막에 붙이도록 배선.
 * v1.5.0 (2026-08-25)
 * - runDeleteDeadContentOPSRows()에 `force`(기본 false) 파라미터 추가 —
 *   Deal 필터 버그로 잘못 살아있었던 죽은 키 144건이 전부 수동 컬럼(Off/On
 *   등)에 실제 값이 있어 기존 안전장치로는 하나도 자동 삭제가 안 됐음.
 *   사용자가 "Content_OPS에서 안 보이게 제거"를 명시적으로 요청 —
 *   `force=true`로 호출하면 수동 데이터 여부와 무관하게 죽은 키를 전부
 *   삭제(그 행의 PIC/TotalReg./Off-On 등 수동 데이터도 함께 영구 삭제됨).
 *   기본값(false)은 기존 동작 그대로 유지 — 안전장치가 필요 없다고
 *   명시적으로 확인한 경우에만 우회.
 * v1.4.0 (2026-08-25)
 * - **근본 원인 확정·수정**: runDumpContentOPSKeysWithLiveStatus()로 확인한
 *   결과 Content_OPS에 남아있던 Webinar/Seminar 프로그램들은 Business
 *   Segment 재분류/stale 데이터 문제가 아니라 computeContentDealAggregates_()
 *   에 Business Segment 필터가 아예 없던 버그였음 — Deal Tracker에 어떤
 *   세그먼트로든 귀속된 딜이 있으면 leadSourceDetail 문자열만 일치해도
 *   Content_Engine의 allKeys 합집합(refreshContentEngine_())에 끼어들었음.
 *   같은 패턴을 쓰는 BOFU_002_Engine.js computeBOFUDealAggregates_()는
 *   이미 `row.businessSegment` 필터가 있어 문제 없었음(대조군) — 그 패턴을
 *   그대로 적용해 `CONTENT.SEGMENTS.indexOf(row.businessSegment) === -1`
 *   이면 제외하도록 수정. EVENTS_002_Engine.js의 computeEventsDealAggregates_()
 *   에도 동일한 버그가 있어 함께 수정(사용자 확인). 회귀 테스트
 *   testComputeContentDealAggregates_() 갱신 — Content 아닌 businessSegment
 *   케이스 추가.
 * v1.3.0 (2026-08-25)
 * - runDumpContentOPSKeysWithLiveStatus() 신규 — TEMPQA_028(원본 값 완전
 *   일치 → stripRegistrationFormSuffix_() 적용까지 두 차례 수정)로도
 *   "WB-2026-07-KOR-MOFU-Core EC for Each Year of High School" 등 다수
 *   프로그램이 Content 오염 0%(전부 정상 Webinar/Seminar)로 나오는데도
 *   사용자가 Content_OPS 화면에서는 여전히 보인다고 보고 — 사용자가 붙여넣은
 *   목록이 실제 현재 시트 상태와 다를 가능성(브라우저 캐시/미갱신 등)을
 *   배제하기 위해, Content_OPS의 현재 전체 키 목록과 Content_Engine
 *   생존 여부(live/dead)를 라이브로 직접 덤프하는 진단 함수 추가 — 사용자
 *   추정에 의존하지 않고 시트 자체에서 그라운드 트루스 확인.
 * v1.2.0 (2026-08-25)
 * - runAuditContentSegmentDeadKeys()/runDeleteDeadContentOPSRows() 신규 —
 *   Search_OPS의 "죽은 키" 문제(SEARCH_002_Engine.js
 *   runAuditSearchSegmentIssues()/runDeleteDeadSearchOPSRows(), 2026-07-28)와
 *   동일한 구조적 원인이 Content_OPS에도 있음을 발견해 같은 패턴으로 대응.
 *   mergeContentOPS_()(CONTENT_004_Merge.js)가 "현재 Content_Engine 키 ∪
 *   기존 Content_OPS 키" 합집합으로 병합하기 때문에, Business Segment
 *   재분류(Full Rebuild 등)로 더 이상 Content가 아니게 된 프로그램은
 *   Content_Engine에서 사라져도 Content_OPS엔 그대로 남아 지표만 0으로
 *   표시됨. 사용자가 Content_OPS에서 WB-/EV- 등 명백한 Webinar/Seminar
 *   프로그램 150여 건을 발견 → getBusinessSegment() 현재 코드로 직접
 *   검증한 결과 코드는 정확했고(Node 하네스로 168개 프로그램명 재분류
 *   테스트, Webinar 103/Seminar 38/BOFU 15/Content 11), Leads_Master/
 *   MTA_Master가 2026-07-25~07-29 규칙 개선 이전 값을 그대로 보존하고
 *   있던 stale 데이터가 원인으로 확정 — Full Rebuild(rebuildLeadsMaster/
 *   rebuildMTAMaster/buildLeadsOPS) 실행 후에도 Content_OPS 자체는 union
 *   병합 구조상 죽은 키가 남으므로 별도 삭제 함수 필요.
 * v1.1.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `81_Content_Engine.js` → 신규 `CONTENT_002_Engine.js`, 코드 내용 변경 없음.
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
  const metaAgg = computeContentMetaCampaignDataAggregates_();

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

  writeContentEngine_(rows);

  const seconds = ((new Date() - start) / 1000).toFixed(2);

  Logger.log(
    CONFIG.LOG.PREFIX + " Content Engine Refresh Completed : " +
    rows.length + " rows (" + seconds + "s)"
  );

}


/**
 * ==========================================================
 * Is Eligible Content Program Pure (순수 함수)
 *
 * WHY (`docs/OpenItems.md` #30 후속, 2026-09-05)
 * UTM_Program_Dictionary가 찾아낸 Marketo Program명이 진짜 Content
 * 프로그램인지 판정 — `BOFU_002_Engine.js`의 `isEligibleBOFUProgramPure_()`와
 * 동일 패턴/동일 배경(자세한 WHY는 그쪽 헤더 참고). 예전엔
 * `getBusinessSegment(programName, programName)`만 썼으나,
 * `TEMPQA_051_BOFUContentMetaProgramCoverageDiagnostic.js`
 * `runTraceBOFUContentMetaProgramMismatch()` 실측 결과 Content 프로그램
 * 9건(예: "WF-2026-02-KOR-MOFU-Core RISE Academic Foundation", matchCount
 * 559/559로 딕셔너리 매칭 자체는 완벽)이 이 재분류 방식으로는 Content가
 * 아니라고 오판돼 실제 Meta Spend가 반영 안 되고 있었음이 확인됨 —
 * `Program_Segment_Dictionary`(실제 리드 데이터 다수결 채굴, #22/#34)를
 * 최우선으로 조회하고, 없는 경우에만 기존 방식으로 폴백.
 *
 * INPUT
 * programName        : string
 * programSegmentMap  : Object  (readProgramSegmentDictionaryMap_() 결과,
 *                       {programNameLower: Business Segment명})
 *
 * TEST
 * testIsEligibleContentProgram 참고
 * ==========================================================
 */
function isEligibleContentProgramPure_(programName, programSegmentMap) {

  if (!programName) return false;

  const dictSegment = (programSegmentMap || {})[String(programName).trim().toLowerCase()];

  if (dictSegment) return CONTENT.SEGMENTS.indexOf(dictSegment) !== -1;

  return isKoreanProgram_(programName) &&
    CONTENT.SEGMENTS.indexOf(getBusinessSegment(programName, programName)) !== -1;

}


/**
 * ==========================================================
 * Is Eligible Content Program (IO 래퍼)
 *
 * WHY
 * `aggregateMetaCampaignDataByProgram_()`(EVENTS_002_Engine.js)가 이 함수를
 * 단일 인자 `isEligibleProgram` predicate로 그대로 호출하므로 시그니처를
 * 유지 — `readProgramSegmentDictionaryMap_()`(모듈 스코프 메모이제이션,
 * 실행당 1회만 시트 읽음)로 맵을 가져와 순수 함수에 위임한다.
 * ==========================================================
 */
function isEligibleContentProgram_(programName) {

  return isEligibleContentProgramPure_(programName, readProgramSegmentDictionaryMap_());

}


/**
 * ==========================================================
 * TEST — isEligibleContentProgramPure_()
 * ==========================================================
 */
function testIsEligibleContentProgram() {

  const dictMap = {
    "wf-2025-01-kor-mofu-core dictionary-confirmed content": "Content",
    "wf-2025-02-kor-mofu-core dictionary-confirmed webinar": "Webinar" // 딕셔너리가 아니라고 확정 — getBusinessSegment 결과와 달라도 딕셔너리 우선
  };

  const pass =
    // 딕셔너리 미스 → 기존 getBusinessSegment() 폴백 경로(기존 동작 그대로)
    isEligibleContentProgramPure_("WF-2026-07-KOR-MOFU-Core Hyperlocalized Rising 8~9 Roadmap eBook", {}) === true &&
    isEligibleContentProgramPure_("WB-2026-02-KOR-MOFU-Core Application Tips", {}) === false &&
    isEligibleContentProgramPure_("WF-2026-08-KOR-BOFU-Core Duke CAO advise", {}) === false &&
    isEligibleContentProgramPure_("", {}) === false &&
    // 딕셔너리 히트 → 딕셔너리 값이 최우선(신규 동작)
    isEligibleContentProgramPure_("WF-2025-01-KOR-MOFU-Core Dictionary-Confirmed Content", dictMap) === true &&
    isEligibleContentProgramPure_("WF-2025-02-KOR-MOFU-Core Dictionary-Confirmed Webinar", dictMap) === false;

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Content Meta Campaign Data Aggregates (IO 래퍼, 실행 단위 메모이제이션)
 *
 * WHY
 * `EVENTS_002_Engine.js`의 제네릭 `aggregateMetaCampaignDataByProgram_()`/
 * `resolveMetaCampaignProgramKey_()`를 Content 전용 자격 판정
 * (`isEligibleContentProgram_()`)으로 감싼 IO 래퍼 —
 * `refreshContentEngine_()`가 `CONTENT.GROUP_4_COMPUTED`(v1.3.0에서 Spent
 * 추가)의 Spent를 채우는 데 쓰고, `CONTENT_004_Merge.js`의
 * `applyContentMetaCampaignDataIfMatched_()`가 Campaign/Off-On/Start
 * Date/End Date/Link clicks/Results 자동 덮어쓰기에 반환값 전체를
 * 사용(2026-08-25, Spent 자동화에 이은 2단계 사용자 요청).
 *
 * **메모이제이션(2026-09-03, `docs/OpenItems.md` #41)**: `BOFU_002_Engine.js`의
 * `computeBOFUMetaCampaignDataAggregates_()`와 완전히 동일한 이유·동일 패턴 —
 * `refreshContentEngine_()`/`buildContentOPS()`(`CONTENT_003_Build.js:49`)가
 * 파라미터 없이 같은 실행 안에서 이 함수를 두 번 호출해 Meta_Raw +
 * UTM_Program_Dictionary를 매번 두 번씩 읽던 것을 모듈 스코프 변수로 제거
 * (직렬화/시트 왕복 없음, `UTIL_002_UtmProgramDictionary.js`의
 * `_utmProgramDictCache`와 동일 전례 — 별도 실행에서는 자동 초기화).
 * ==========================================================
 */
let _contentMetaCampaignDataAggCache = null;

function computeContentMetaCampaignDataAggregates_() {

  if (_contentMetaCampaignDataAggCache) return _contentMetaCampaignDataAggCache;

  _contentMetaCampaignDataAggCache = aggregateMetaCampaignDataByProgram_(
    readMetaRawRows_(), readUtmProgramDictionaryMap_(), isEligibleContentProgram_
  );

  return _contentMetaCampaignDataAggCache;

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

    if (CONTENT.SEGMENTS.indexOf(row.businessSegment) === -1) return null;

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
    { leadSourceDetail: "WF-2025-07-KOR-MOFU-Core A", revenue: 500, businessSegment: "Content" },
    { leadSourceDetail: "WF-2025-07-US-MOFU-Core B", revenue: 999, businessSegment: "Content" },  // KOR 아님, 제외
    { leadSourceDetail: "WB-2026-07-KOR-MOFU-Core Webinar C", revenue: 777, businessSegment: "Webinar" } // Content 아님, 제외(회귀 방지)
  ];

  const keyFn = function (row) {
    if (CONTENT.SEGMENTS.indexOf(row.businessSegment) === -1) return null;
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


/**
 * ==========================================================
 * Audit Content Segment Dead Keys (1회성 진단, 수동 실행용)
 *
 * WHY
 * mergeContentOPS_()(CONTENT_004_Merge.js)가 "현재 Content_Engine 키 ∪
 * 기존 Content_OPS 키"로 합치기 때문에, Business Segment가 재분류돼
 * Content_Engine에서 사라진 키도 Content_OPS엔 그대로 남아 지표만 0으로
 * 표시됨(Search_OPS와 동일한 구조적 문제, runAuditSearchSegmentIssues()
 * Part 1 패턴 재사용). 수동 컬럼(PIC/Marketo Campaign name/Channel/
 * Division/Notes/TotalReg./Off/On/Campaign/Start Date/End Date/
 * Impressions/Reach/Link clicks/Results/Spent)에 실제 데이터가 있는지로
 * "완전 공백(삭제 안전)" vs "데이터 있음(검토 필요)" 구분.
 *
 * 코드 변경 없음(getBusinessSegment() 등 기존 로직 그대로) — 순수 진단.
 * ==========================================================
 */
function runAuditContentSegmentDeadKeys() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const engineSheet = ss.getSheetByName(CONTENT.SHEET.ENGINE);
  const opsSheet = ss.getSheetByName(CONTENT.SHEET.OPS);

  Logger.log("======================================");
  Logger.log("Audit Content Segment Dead Keys");
  Logger.log("======================================");

  const liveKeys = {};

  if (engineSheet) {

    sheetToObjects(engineSheet).forEach(function (r) {
      const key = String(r[CONTENT.KEY] || "").trim().toLowerCase();
      if (key) liveKeys[key] = true;
    });

  }

  if (!opsSheet) {
    Logger.log(CONTENT.SHEET.OPS + " sheet not found — skipped.");
    return;
  }

  const opsRows = readContentOPS_();
  const manualCols = CONTENT.GROUP_1_MANUAL
    .concat(CONTENT.GROUP_2_MANUAL)
    .concat(CONTENT.GROUP_3_MANUAL);

  let deadCount = 0;
  let deadWithManualData = 0;

  opsRows.forEach(function (row) {

    const key = String(row[CONTENT.KEY] || "").trim();

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

    if (channelValue && channelValue !== CONTENT.CHANNEL_DEFAULT) {
      hasManualData = true;
    }

    if (hasManualData) deadWithManualData++;

    Logger.log(
      (hasManualData ? "⚠️ [데이터 있음] " : "   [완전 공백] ") +
      "\"" + key + "\"" +
      (hasManualData ? "  " + JSON.stringify(manualValues) : "")
    );

  });

  Logger.log("");
  Logger.log(
    "요약: 죽은 키 " + deadCount + "건 " +
    "(수동 데이터 있음=" + deadWithManualData + ", 완전 공백=" + (deadCount - deadWithManualData) + ")"
  );

  Logger.log("======================================");
  Logger.log("Audit Completed");
  Logger.log("======================================");

}


/**
 * ==========================================================
 * Run Delete Dead Content_OPS Rows (수동 실행용)
 *
 * WHY
 * runAuditContentSegmentDeadKeys()로 확인된 죽은 키(Content_Engine에 더
 * 이상 없는 Content_OPS 키) 중 수동 컬럼이 완전히 비어있는 행만 삭제한다
 * (runDeleteDeadSearchOPSRows(), SEARCH_002_Engine.js와 동일 패턴). 삭제
 * 전 로그로 목록 전체 나열 — 실행 로그가 곧 감사 기록.
 *
 * ⚠️ 수동 데이터가 있는 죽은 키는 자동 삭제하지 않고 로그로만 표시 —
 * 실제 캠페인 운영 데이터가 있을 수 있어 임의 삭제 금지, 발견되면 사용자
 * 확인 후 별도 처리.
 * ==========================================================
 */
function runDeleteDeadContentOPSRows(force) {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const engineSheet = ss.getSheetByName(CONTENT.SHEET.ENGINE);
  const opsSheet = ss.getSheetByName(CONTENT.SHEET.OPS);

  if (!opsSheet) {
    Logger.log(CONTENT.SHEET.OPS + " sheet not found.");
    return;
  }

  const liveKeys = {};

  if (engineSheet) {

    sheetToObjects(engineSheet).forEach(function (r) {
      const key = String(r[CONTENT.KEY] || "").trim().toLowerCase();
      if (key) liveKeys[key] = true;
    });

  }

  const manualCols = CONTENT.GROUP_1_MANUAL
    .concat(CONTENT.GROUP_2_MANUAL)
    .concat(CONTENT.GROUP_3_MANUAL);

  const values = opsSheet.getDataRange().getValues();
  const headers = values[CONTENT.ROWS.HEADER - 1];
  const keyColIndex = headers.indexOf(CONTENT.KEY);

  const rowsToDelete = [];
  const skippedWithManualData = [];

  for (let r = CONTENT.ROWS.DATA_START - 1; r < values.length; r++) {

    const key = String(values[r][keyColIndex] || "").trim();

    if (!key) continue;
    if (liveKeys[key.toLowerCase()]) continue; // 살아있음 — 스킵

    let hasManualData = false;

    manualCols.forEach(function (col) {

      const colIndex = headers.indexOf(col);
      if (colIndex === -1) return;

      const v = values[r][colIndex];

      if (col === "Channel") return;

      if (v !== "" && v !== 0 && v !== undefined && v !== null) {
        hasManualData = true;
      }

    });

    const channelColIndex = headers.indexOf("Channel");
    const channelValue = channelColIndex === -1 ? "" : String(values[r][channelColIndex] || "");

    if (channelValue && channelValue !== CONTENT.CHANNEL_DEFAULT) {
      hasManualData = true;
    }

    if (hasManualData && !force) {
      skippedWithManualData.push(key);
      continue;
    }

    rowsToDelete.push(r + 1); // 1-based 시트 행 번호

  }

  Logger.log("======================================");
  Logger.log("Delete Dead Content_OPS Rows" + (force ? " (force=true — 수동 데이터 있어도 삭제)" : ""));
  Logger.log("======================================");
  Logger.log("Content_OPS 현재 행 수(헤더 제외): " + (opsSheet.getLastRow() - CONTENT.ROWS.DATA_START + 1));

  if (skippedWithManualData.length > 0) {

    Logger.log("");
    Logger.log("⚠️ 수동 데이터가 있어 삭제 스킵된 죽은 키 (" + skippedWithManualData.length + "건, 별도 확인 필요):");
    skippedWithManualData.forEach(function (key) { Logger.log("  " + key); });

  }

  if (rowsToDelete.length === 0) {
    Logger.log("");
    Logger.log("삭제할 죽은 키 없음.");
    return;
  }

  Logger.log("");
  Logger.log("삭제 대상 행 수" + (force ? "(force — 수동 데이터 포함)" : "(완전 공백)") + " : " + rowsToDelete.length);
  Logger.log("삭제 대상 시트 행 번호(오름차순): " + rowsToDelete.join(", "));

  rowsToDelete
    .sort(function (a, b) { return b - a; }) // 내림차순 — 삭제 시 인덱스 안 밀리도록
    .forEach(function (rowIndex) {
      opsSheet.deleteRow(rowIndex);
    });

  SpreadsheetApp.flush();

  Logger.log(
    "삭제 완료 — " + rowsToDelete.length + "개 행 제거됨. " +
    "Content_OPS 현재 행 수(헤더 제외): " + (opsSheet.getLastRow() - CONTENT.ROWS.DATA_START + 1)
  );

  Logger.log("======================================");

}


/**
 * ==========================================================
 * Run Delete Dead Content_OPS Rows — Force (수동 실행 전용 wrapper)
 *
 * WHY
 * Apps Script 편집기의 Run 버튼은 함수에 인자를 넘길 수 없어
 * runDeleteDeadContentOPSRows(true)를 직접 실행할 방법이 없음 — 사용자가
 * "Content_OPS에서 안 보이게 제거" 요청(2026-08-25)한 죽은 키 144건(전부
 * 수동 데이터 있음, computeContentDealAggregates_() Segment 필터 버그로
 * 잘못 살아있었던 것들)을 삭제하기 위한 인자 없는 진입점.
 *
 * ⚠️ 수동 컬럼(PIC/TotalReg./Off-On 등) 데이터가 있어도 전부 삭제한다 —
 * 되돌릴 수 없음.
 * ==========================================================
 */
function runDeleteDeadContentOPSRowsForce() {

  runDeleteDeadContentOPSRows(true);

}


/**
 * ==========================================================
 * Dump Content_OPS Keys With Live Status (1회성 진단, 수동 실행용)
 *
 * WHY
 * TEMPQA_028_ContentSegmentLeakTrace.js로도 다수 프로그램이 Content 오염
 * 0%(전부 정상 Webinar/Seminar)로 확인됐는데 사용자는 Content_OPS 화면에서
 * 여전히 보인다고 보고 — 채팅으로 붙여넣은 목록이 실제 현재 시트 상태와
 * 다를 가능성(브라우저 미갱신/캐시 등)을 배제하기 위해, Content_OPS
 * 시트를 지금 이 순간 직접 읽어 전체 키 목록과 Content_Engine 생존 여부
 * (live/dead)를 그대로 덤프한다. 사용자 추정에 의존하지 않는 그라운드
 * 트루스 확인용.
 * ==========================================================
 */
function runDumpContentOPSKeysWithLiveStatus() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const engineSheet = ss.getSheetByName(CONTENT.SHEET.ENGINE);
  const opsSheet = ss.getSheetByName(CONTENT.SHEET.OPS);

  Logger.log("======================================");
  Logger.log("Dump Content_OPS Keys With Live Status");
  Logger.log("======================================");

  if (!opsSheet) {
    Logger.log(CONTENT.SHEET.OPS + " sheet not found.");
    return;
  }

  const liveKeys = {};

  if (engineSheet) {

    sheetToObjects(engineSheet).forEach(function (r) {
      const key = String(r[CONTENT.KEY] || "").trim().toLowerCase();
      if (key) liveKeys[key] = true;
    });

  }

  const opsRows = readContentOPS_();

  Logger.log("Content_Engine 현재 live 키 수 : " + Object.keys(liveKeys).length);
  Logger.log("Content_OPS 현재 행 수(readContentOPS_() 기준) : " + opsRows.length);
  Logger.log("");
  Logger.log("---- 전체 목록 (LIVE/DEAD) ----");

  opsRows.forEach(function (row) {

    const key = String(row[CONTENT.KEY] || "").trim();
    if (!key) return;

    const status = liveKeys[key.toLowerCase()] ? "LIVE" : "DEAD";

    Logger.log(status + "\t" + key);

  });

  Logger.log("");
  Logger.log("======================================");
  Logger.log("Dump Completed");
  Logger.log("======================================");

}
