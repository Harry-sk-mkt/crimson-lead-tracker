isEligibleBOFUProgram_()/isEligibleContentProgram_()가 getBusinessSegment(programName, programName)로 재분류하는데, 이 10개 프로그램은 그 방식으로 재분류하면 실제 분류와 다르게 나옵니다. 반면 이 프로젝트엔 이미 실제 리드 데이터로 다수결 채굴한 Program_Segment_Dictionary(#22/#34에서 구축)가 있고, 이게 정확히 "프로그램명 → 실제 Business Segment" 조회용입니다. 이 딕셔너리를 우선 조회하고, 없을 때만 기존 방식으로 폴백하도록 고치겠습니다.
 Update(BOFU_002_Engine.js)
Added 64 lines, removed 16 lines

/**
 * ==========================================================
 * Is Eligible BOFU Program (순수 함수)
 * Is Eligible BOFU Program Pure (순수 함수)
 *
 * WHY
 * WHY (`docs/OpenItems.md` #30 후속, 2026-09-05)
 * UTM_Program_Dictionary가 찾아낸 Marketo Program명이 진짜 BOFU
 * 프로그램인지 판정 — `EVENTS_002_Engine.js`의
 * `isEligibleEventProgram_()`(EVENT_TYPE_PREFIXES 필터)와 동일 역할이지만
 * BOFU는 단일 세그먼트라 Business Segment 체크 하나로 충분(BOFU_002_Engine.js
 * 파일 헤더 WHY와 동일 원칙 — "Events와 달리 EVENT_TYPE_PREFIXES 필터가
 * 없다"). `getBusinessSegment(programName, programName)` — 문자열 하나를
 * campaign/detail 두 인자 모두에 넣는 게 이미 확립된 관례
 * (`AD_006_KakaoMoments.js` `computeKakaoMomentsSyncRow_()` 참고, 한쪽
 * 인자만 넣으면 "wb-"/"ev-" 등 detail 전용 신호를 놓쳐 분류가 실패함).
 * 프로그램인지 판정. 예전엔 `getBusinessSegment(programName, programName)`
 * (문자열 하나를 campaign/detail 두 인자 모두에 넣는 관례,
 * `AD_006_KakaoMoments.js` `computeKakaoMomentsSyncRow_()` 참고)만 썼으나,
 * `TEMPQA_051_BOFUContentMetaProgramCoverageDiagnostic.js`
 * `runTraceBOFUContentMetaProgramMismatch()` 실측 결과 이 재분류 방식이
 * 실제 분류와 어긋나는 프로그램이 있음이 확인됨(예: "WF-2023-04-KOR-MOFU-Core
 * Hyperlocalized Korean Army Infographic" — 딕셔너리 매칭/정규화는 정확한데
 * `getBusinessSegment(programName, programName)`가 BOFU가 아니라고 오판해
 * 실제 Meta Spend(연 419.32 등)가 반영 안 되고 있었음) — Program명 하나를
 * 인위적으로 campaign/detail 두 슬롯에 넣는 방식 자체가 실제 리드의 진짜
 * campaign/detail 조합과 달라 키워드 규칙이 다르게 걸릴 수 있는 구조적
 * 한계. `Program_Segment_Dictionary`(실제 Leads_Master/MTA_Master의 진짜
 * Business Segment 값을 프로그램별로 다수결 채굴한 캐시, #22/#34)가 이미
 * 있으므로 그걸 최우선으로 조회하고(이 프로그램이 실제로 어떤 세그먼트로
 * 분류돼왔는지 그라운드 트루스), 딕셔너리에 없는 경우(신규/모호한 프로그램)
 * 에만 기존 `getBusinessSegment()` 재분류로 폴백 — `resolveBusinessSegment_()`
 * (`UTIL_002_UtmProgramDictionary.js`)와 동일한 "딕셔너리 우선, 키워드
 * 폴백" 원칙.
 *
 * INPUT
 * programName        : string
 * programSegmentMap  : Object  (readProgramSegmentDictionaryMap_() 결과,
 *                       {programNameLower: Business Segment명})
 *
 * TEST
 * testIsEligibleBOFUProgram 참고
 * ==========================================================
 */
function isEligibleBOFUProgram_(programName) {
function isEligibleBOFUProgramPure_(programName, programSegmentMap) {

  if (!programName) return false;

  const dictSegment = (programSegmentMap || {})[String(programName).trim().toLowerCase()];

  if (dictSegment) return BOFU.SEGMENTS.indexOf(dictSegment) !== -1;

  return isKoreanProgram_(programName) &&
    BOFU.SEGMENTS.indexOf(getBusinessSegment(programName, programName)) !== -1;



/**
 * ==========================================================
 * TEST — isEligibleBOFUProgram_()
 * Is Eligible BOFU Program (IO 래퍼)
 *
 * WHY
 * `aggregateMetaCampaignDataByProgram_()`(EVENTS_002_Engine.js)가 이 함수를
 * 단일 인자 `isEligibleProgram` predicate로 그대로 호출하므로 시그니처를
 * 유지 — `readProgramSegmentDictionaryMap_()`(모듈 스코프 메모이제이션,
 * 실행당 1회만 시트 읽음)로 맵을 가져와 순수 함수에 위임한다.
 * ==========================================================
 */
function isEligibleBOFUProgram_(programName) {

  return isEligibleBOFUProgramPure_(programName, readProgramSegmentDictionaryMap_());

}


/**
 * ==========================================================
 * TEST — isEligibleBOFUProgramPure_()
 * ==========================================================
 */
function testIsEligibleBOFUProgra
    "wf-2025-01-kor-mofu-core dictionary-confirmed bofu": "BOFU",
    "wf-2025-02-kor-mofu-core dictionary-confirmed webinar": "Webinar" // 딕셔너리가 아니라고 확정 — getBusinessSegment 결과와 달
라도 딕셔너리 우선
  };

  const pass =
    isEligibleBOFUProgram_("WF-2026-08-KOR-BOFU-Core Duke CAO advise") === true &&
    isEligibleBOFUProgram_("WB-2026-02-KOR-MOFU-Core Application Tips") === false &&
    isEligibleBOFUProgram_("WF-2026-01-KOR-MOFU-Core Some Ebook") === false &&
    isEligibleBOFUProgram_("") === false;
    // 딕셔너리 미스 → 기존 getBusinessSegment() 폴백 경로(기존 동작 그대로)
    isEligibleBOFUProgramPure_("WF-2026-08-KOR-BOFU-Core Duke CAO advise", {}) === true &&
    isEligibleBOFUProgramPure_("WB-2026-02-KOR-MOFU-Core Application Tips", {}) === false &&
    isEligibleBOFUProgramPure_("WF-2026-01-KOR-MOFU-Core Some Ebook", {}) === false &&
    isEligibleBOFUProgramPure_("", {}) === false &&
    // 딕셔너리 히트 → 딕셔너리 값이 최우선(신규 동작)
    isEligibleBOFUProgramPure_("WF-2025-01-KOR-MOFU-Core Dictionary-Confirmed BOFU", dictMap) === true &&
    isEligibleBOFUProgramPure_("WF-2025-02-KOR-MOFU-Core Dictionary-Confirmed Webinar", dictMap) === false;

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");


Now the same fix for Content:

● Update(CONTENT_002_Engine.js)
Added 56 lines, removed 13 lines

/**
 * ==========================================================
 * Is Eligible Content Program (순수 함수)
 * Is Eligible Content Program Pure (순수 함수)
 *
 * WHY
 * WHY (`docs/OpenItems.md` #30 후속, 2026-09-05)
 * UTM_Program_Dictionary가 찾아낸 Marketo Program명이 진짜 Content
 * 프로그램인지 판정 — `BOFU_002_Engine.js`의 `isEligibleBOFUProgram_()`와
 * 동일 패턴(Content도 단일 세그먼트라 Business Segment 체크 하나로 충분).
 * `getBusinessSegment(programName, programName)` — 문자열 하나를
 * campaign/detail 두 인자 모두에 넣는 게 이미 확립된 관례
 * (`AD_006_KakaoMoments.js` `computeKakaoMomentsSyncRow_()` 참고).
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
function isEligibleContentProgram_(programName) {
function isEligibleContentProgramPure_(programName, programSegmentMap) {

  if (!programName) return false;

  const dictSegment = (programSegmentMap || {})[String(programName).trim().toLowerCase()];

  if (dictSegment) return CONTENT.SEGMENTS.indexOf(dictSegment) !== -1;

  return isKoreanProgram_(programName) &&
    CONTENT.SEGMENTS.indexOf(getBusinessSegment(programName, programName)) !== -1;



/**
 * ==========================================================
 * TEST — isEligibleContentProgram_()
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
    "wf-2025-02-kor-mofu-core dictionary-confirmed webinar": "Webinar" // 딕셔너리가 아니라고 확정 — getBusinessSegment 결과와 달
라도 딕셔너리 우선
  };

  const pass =
    isEligibleContentProgram_("WF-2026-07-KOR-MOFU-Core Hyperlocalized Rising 8~9 Roadmap eBook") === true &&
    isEligibleContentProgram_("WB-2026-02-KOR-MOFU-Core Application Tips") === false &&
    isEligibleContentProgram_("WF-2026-08-KOR-BOFU-Core Duke CAO advise") === false &&
    isEligibleContentProgram_("") === false;
    // 딕셔너리 미스 → 기존 getBusinessSegment() 폴백 경로(기존 동작 그대로)
    isEligibleContentProgramPure_("WF-2026-07-KOR-MOFU-Core Hyperlocalized Rising 8~9 Roadmap eBook", {}) === true &&
    isEligibleContentProgramPure_("WB-2026-02-KOR-MOFU-Core Application Tips", {}) === false &&
    isEligibleContentProgramPure_("WF-2026-08-KOR-BOFU-Core Duke CAO advise", {}) === false &&
    isEligibleContentProgramPure_("", {}) === false &&
    // 딕셔너리 히트 → 딕셔너리 값이 최우선(신규 동작)
    isEligibleContentProgramPure_("WF-2025-01-KOR-MOFU-Core Dictionary-Confirmed Content", dictMap) === true &&
    isEligibleContentProgramPure_("WF-2025-02-KOR-MOFU-Core Dictionary-Confirmed Webinar", dictMap) === false;

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");


● Update(BOFU_002_Engine.js)
Added 12 lines, removed 1 line
 * 동일한 4개 지점, 07/09/10 파일에 나란히 배선)
 *
 * Version
 * v1.7.0
 * v1.8.0
 *
 * Change Log
 * v1.8.0 (2026-09-05)
 * - **버그 수정 — `isEligibleBOFUProgram_()`가 Program_Segment_Dictionary
 *   대신 `getBusinessSegment(programName, programName)` 재분류에만 의존해
 *   실제로는 BOFU인 프로그램의 Meta Spend 매칭이 누락되던 문제**
 *   (`docs/OpenItems.md` #30, `TEMPQA_051_BOFUContentMetaProgramCoverageDiagnostic.js`
 *   실측 확인). `isEligibleBOFUProgramPure_(programName, programSegmentMap)`
 *   신규(순수 함수, Program_Segment_Dictionary 우선 → 없으면 기존 방식
 *   폴백) — `isEligibleBOFUProgram_()`는 `readProgramSegmentDictionaryMap_()`
 *   로 맵을 가져와 위임하는 IO 래퍼로 축소(단일 인자 시그니처는 그대로
 *   유지, `aggregateMetaCampaignDataByProgram_()` 호출부 변경 없음).
 *   `testIsEligibleBOFUProgram()` 갱신 — 딕셔너리 히트/미스 양쪽 케이스 추가.
 * v1.7.0 (2026-09-03)
 * - **Meta_Raw+UTM_Program_Dictionary 이중 조회 제거(`docs/OpenItems.md` #41,
 *   실측 근거: `docs/PerformanceBenchmark.md` 2026-09-03)** —

● Update(CONTENT_002_Engine.js)
Added 14 lines, removed 1 line
 * (다른 Engine들과 동일한 4개 지점, 07/09/10 파일에 나란히 배선)
 *
 * Version
 * v1.8.0
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

  Made 6 scratchpad edits +82 -26, searched for 3 patterns, read 1 file, listed 1 directory, ran 5 shell commands

All pass. Let's push and update docs/OpenItems.md #30.

  Searched for 1 pattern, read 1 file, ran 1 shell command

● Update(docs\OpenItems.md)
Added 34 lines, removed 8 lines
    (4) 확실한 후보(distinctProgramCount===1)가 있는데도 안 잡힌 경우(버그 의심, 별도
    확인 필요). `resolveMetaCampaignProgramKey_()`(`EVENTS_002_Engine.js`)가 실제로
    쓰는 정규화(`stripLGSuffix_(stripRegistrationFormSuffix_(...))`)를 그대로 재사용해
    실제 매칭 로직과 동일한 기준으로 비교. `check-syntax`/`check-naming`/
    `check-version-header`/`check-duplicate-declarations` 전부 통과, 다른 TEMPQA
    진단과 동일하게 별도 단위 테스트 없음. **남은 것(TODO)**: 사용자가 Apps Script
    편집기에서 `runDiagnoseBOFUContentMetaProgramCoverage()`를 직접 Run — (1)번
    비중이 크면 딕셔너리 확장/override 둘 다 큰 효과가 없다는 뜻이라 이 항목을 낮은
    우선순위로 재조정할 근거가 되고, (3)번의 "Meta_Raw에 존재" 카운트가 유의미하게
    크면 그 규모만큼 Events_OPS와 동일한 override 맵 도입이 실효 있다는 근거가 됨 —
    실측 결과를 보고 방향(착수/보류) 결정할 것, 임의로 처리하지 말 것.
    실제 매칭 로직과 동일한 기준으로 비교. **실측 결과(2026-09-05, 사용자 실행)**:
    BOFU 미매칭 92건 — (1) 딕셔너리 자체 없음 35 / (3) 모호(override 후보 12건) 19 /
    (4) 확실한 후보인데 Meta_Raw엔 없음(버그 아님) 37 / (5) 확실한 후보 + Meta_Raw에도
    있는데 안 잡힘(버그 의심) 1. Content 미매칭 86건 — (1) 18 / (3) 모호(override 후보
    7건) 15 / (4) 44 / (5) **9**. (5)번이 예상외로 유의미해 `runTraceBOFUContentMetaProgramMismatch()`
    신규(실제 프로덕션 함수 그대로 호출해 단계별 추적)로 원인 확정.
    **✅ 근본 원인 확정 및 수정 완료(2026-09-05)**: (5)번 10건 전부 딕셔너리 조회/
    정규화는 정확한데 `isEligibleBOFUProgram_()`/`isEligibleContentProgram_()`의
    `getBusinessSegment(programName, programName)` 재분류 단계에서 false가 나옴 —
    Program명 문자열 하나를 campaign/detail 두 슬롯에 억지로 넣는 방식이 실제 리드의
    진짜 campaign/detail 조합과 달라 키워드 규칙이 다르게 걸리는 구조적 한계(예:
    "WF-2026-02-KOR-MOFU-Core RISE Academic Foundation"은 matchCount 559/559로
    완벽히 확실한 매칭인데도 재분류에서 Content가 아니라고 오판). `Program_Segment_Dictionary`
    (실제 Leads_Master/MTA_Master 다수결 채굴, #22/#34)가 이미 이 프로그램이 실제로
    어떤 세그먼트인지 아는 그라운드 트루스라는 점에 착안 — `isEligibleBOFUProgramPure_()`/
    `isEligibleContentProgramPure_()` 신규(순수 함수, Program_Segment_Dictionary
    최우선 조회 → 없으면 기존 `getBusinessSegment()` 재분류로 폴백), 기존
    `isEligibleBOFUProgram_()`/`isEligibleContentProgram_()`는 `readProgramSegmentDictionaryMap_()`
    로 맵을 가져와 위임하는 IO 래퍼로 축소(단일 인자 시그니처 유지, 호출부 변경 없음,
    `BOFU_002_Engine.js` v1.8.0/`CONTENT_002_Engine.js` v1.9.0). Node vm 하네스로
    `testIsEligibleBOFUProgram()`/`testIsEligibleContentProgram()`(딕셔너리 히트/미스
    양쪽 케이스로 갱신) 전부 PASS, `check-syntax`/`check-naming`/`check-version-header`/
    `check-duplicate-declarations` 전부 통과, push 완료. **(1)/(4)번(딕셔너리에 UTM
    후보 자체가 없거나 Meta_Raw에 그 캠페인 자체가 없음)은 코드로 해결 불가 — 그
    광고가 지금까지 리드로 귀속된 적이 없거나 Meta 스펜드 자체가 없다는 뜻이라
    딕셔너리 확장/override 둘 다 무효, 낮은 우선순위로 그대로 둠(사용자 확인 불필요,
    구조적 한계)**. **(3)번 override 후보(BOFU 12건/Content 7건)는 이번 세션 범위
    밖 — Events_OPS 선례(`META_CAMPAIGN_NAME_TO_EVENTS_KEY_OVERRIDE`)와 동일한
    override 맵을 BOFU/Content에 도입할지는 여전히 사용자 결정 필요, 임의로 처리하지
    말 것.** **남은 것(TODO)**: `r
31. **Target_REP Actual CPNP1 과소집계 버그 수정 완료 — 잔여 확인 필요(2026-08-25)** — 사용자
    리포트("8월 Webinar Actual CPNP1이 실제보다 훨씬 낮게 나옴")로 조사한 결과
    `isMetaRowWeekPrecise_()`(`AD_002_Meta.js`)가 부분(예: 화~일 6일) Meta export를 "정밀"로
You've hit your session limit · resets 4pm (Asia/Seoul)
/upgrade to increase your usage limit.