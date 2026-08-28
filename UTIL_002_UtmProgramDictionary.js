/**
 * ==========================================================
 * Marketing 2.0
 * UTM Program Dictionary
 *
 * Responsibility
 * MTA_Master(`MKT UTM Campaign`/`Lead Source Detail`)에서 UTM Campaign ↔
 * 실제 Marketo Program명 매핑을 자동으로 채굴해 `CONFIG.UTM_PROGRAM_DICT.SHEET`
 * (같은 스프레드시트 안 숨김 캐시 시트)에 저장/조회한다. UTM 스타일 이름만
 * 갖고 있는 채널(예: Kakao Moments 메시지광고)이 Events_OPS 매칭용 실제
 * Marketo Program명을 자동으로 찾을 때 이 캐시를 소비한다.
 *
 * **2026-08-26 확장**: Marketo Program명 ↔ Business Segment 매핑
 * (`CONFIG.PROGRAM_SEGMENT_DICT.SHEET`)도 동일한 자동 채굴 패턴으로 추가하고,
 * 두 딕셔너리를 조합해 "Lead 유입 → Dictionary 조회 → Business Segment 분류"
 * 플로우를 구현하는 `resolveBusinessSegment_()`를 제공한다(사용자 요청,
 * docs/BusinessSegmentClassification.md 참고) — MASTER_006_LeadTransformer.js/
 * MASTER_007_MTATransformer.js가 기존 `getBusinessSegment()` 직접 호출 대신
 * 이 함수를 호출하도록 전환. `getBusinessSegment()`(UTIL_001_TransformHelper.js)
 * 자체는 시그니처/로직 변경 없음 — 여전히 유일한 키워드 기반 분류 로직
 * 소유자이며, 딕셔너리는 그 앞에 놓이는 조회 우선순위 레이어일 뿐이다.
 * 딕셔너리가 비어있으면(최초 배포 시점) 100% 기존과 동일하게 동작한다.
 *
 * WHY (2026-08-08, 사용자 요청)
 * Kakao Moments 메시지 이름("KR_core_2026-08-08_ec-each-year-kakao-online-event")과
 * Events_OPS 매칭용 실제 Marketo Program명("WB-2026-07-KOR-MOFU-Core...")은
 * 네이밍 체계가 달라 KakaoSMS_Raw의 `Marketo program` 컬럼을 사람이 매 행
 * 수기 입력해야 했음(AD_001_Config.js v1.17.0 changelog, exec-plan
 * 2026-08-04-kakao-moments-api-integration.md에 미해결로 기록). 하드코딩
 * 대신 이미 쌓여있는 실데이터(MTA_Master — 터치 단위라 한 행에 UTM
 * Campaign과 실제 Program명이 항상 같이 있음)에서 자동으로 딕셔너리를
 * 만들자는 사용자 요청으로 신규 착수. `71_Search_Engine.js`의
 * `SEARCH_UTM_TO_PROGRAM_OVERRIDE`(사용자가 5~7개를 육안 대조해 하드코딩한
 * UTM→Program 매핑)가 정확히 이걸 수작업으로 하던 전례 — 이 파일은 그걸
 * 대량/자동으로 하는 버전.
 *
 * 같은 UTM에 서로 다른 Program명이 섞여 있으면(데이터 불일치/오타) 다수결
 * (최다 등장 Program) 채택 + 확신도 정보(matchCount/totalCount/
 * distinctProgramCount)를 함께 기록(사용자 확정) — 모호한 매핑도 숨기지
 * 않고 캐시 시트에서 육안 검토 가능하게 남긴다.
 *
 * Must NOT
 * - **appendNewLeads()/appendNewMTA() 같은 리드 유입 파이프라인(매 append마다
 *   도는 경로)에 갱신(refresh) 자체를 얹지 않음** — MTA_Master/Leads_Master
 *   전체 스캔(12만 행+)은 무거운 작업이라 레코드 단위 호출과는 별개 스케줄로
 *   분리해야 함(사용자 확정, docs/OpenItems.md #19 때와 동일 신중 원칙).
 *   **2026-08-26부터 갱신은 별도의 주기적 시간 트리거**(`periodicRefreshDictionaries_()`,
 *   `runInstallDictionaryPeriodicRefreshTrigger()` 참고)로 자동화하되, 리드
 *   유입 파이프라인과는 완전히 독립된 스케줄 — 리드 유입 시엔 캐시를
 *   "조회"만 하고(`resolveBusinessSegment_()`) 절대 재채굴하지 않는다.
 * - 71_Search_Engine.js의 SEARCH_UTM_TO_PROGRAM_OVERRIDE/
 *   resolveSearchEngineKey_()는 건드리지 않음(기존 출력 변경 금지 원칙) —
 *   이 신규 딕셔너리와 별개로 계속 동작.
 *
 * Version
 * v1.8.0
 *
 * Change Log
 * v1.8.0 (2026-08-28)
 * - `UTM_PROGRAM_DICT_MANUAL_EXCLUSIONS`에 2건 추가 —
 *   `TEMPQA_039_TrafficUtmDictionaryAudit.js`로 "tofu"/"traffic" 포함
 *   딕셔너리 32건 전수 검토 결과, 대부분(예: "Cracking the Common App
 *   with Martin" 완전 일치, "Essay Comp 2025" 417/417건 일치)은 정상
 *   매칭이라 "tofu" 자체를 배제 신호로 쓰면 오히려 정상 매칭을 대량
 *   파괴함이 확인됨(사용자 요청으로 검토, blanket 규칙 도입 안 함) —
 *   그중 UTM명과 매칭 Program 주제가 실제로 안 맞아 보이는 2건만
 *   사용자 확인 후 추가.
 * v1.7.0 (2026-08-28)
 * - **`UTM_PROGRAM_DICT_MANUAL_EXCLUSIONS` 신규 — 오래된 범용 트래픽
 *   캠페인이 다수결로 무관한 Program에 잘못 채굴되는 사례 발견·수정.**
 *   사용자가 Events_OPS의 "WB-2026-07-KOR-MOFU-Core Game Changing Common
 *   Application Tips & Case Studies"(2026-07 웨비나) CVR 71.3%/Spent
 *   $10,706처럼 비정상적으로 큰 것을 발견 — `TEMPQA_038_
 *   EventsGameChangingWebinarMetaAudit.js`로 조사한 결과, 매칭된 유일한
 *   Meta 캠페인이 `KR_core_2024-07-19_landing-page-tofu_traffic`(2024년
 *   7월부터 지금까지 도는 무관한 범용 TOFU 트래픽 캠페인, CampaignRun이
 *   2026-08-31까지)이었음(사용자 확인 — 이 웨비나와 무관). 원인: 이
 *   캠페인은 목적이 "트래픽"이라 대부분의 클릭이 리드로 전환/귀속되지
 *   않고, 어쩌다 귀속된 소수 터치가 우연히 전부 이 웨비나 Program으로
 *   찍혀 있어 `Distinct Program Count===1`(모호하지 않음)로 딕셔너리를
 *   통과함 — 그런데 이 UTM에 매칭되는 Meta 캠페인의 지출/클릭은 소수
 *   터치가 아니라 **2년치 누적 전체**라 Program 하나에 부적절하게
 *   전부 귀속됨. `readUtmProgramDictionaryMap_()`(모든 소비처가 공유하는
 *   단일 소스 — Events/BOFU/Content/Search Spend 매칭 + Business Segment
 *   분류 전부)에 이 UTM 키를 필터링하는 신규 `isUtmProgramDictionaryKeyExcluded_()`
 *   추가. 사람이 직접 확인한 것만 담는 소수 목록(기존
 *   `META_CAMPAIGN_NAME_TO_EVENTS_KEY_OVERRIDE` 등과 동일 관행) — 자동
 *   판별 규칙(예: "_traffic" 접미사 전부 제외)은 아직 검증 안 된 가설이라
 *   도입하지 않음(임의 확장 금지, 다른 "_traffic" 캠페인이 실제로도
 *   문제인지는 별도 확인 필요).
 * v1.6.0 (2026-08-26)
 * - **`resolveBusinessSegmentPure_()` 우선순위 재조정(사용자 확정, 배포 직후
 *   TEMPQA_034 diff로 발견) — 딕셔너리 조회보다 `resolveDefiniteBusinessSegment_()`
 *   (신규, UTIL_001_TransformHelper.js v1.19.0)를 먼저 체크**. 원인: 딕셔너리를
 *   무조건 최우선으로 뒀더니 이미 사용자가 검증한 확정 신호(campaign의
 *   "sitelink" 등)까지 Program 다수결이 근거 없이 뒤집는 사고 발생("Search →
 *   Webinar" 4건). 이제 확정 신호에 안 걸릴 때만(Content 이후 범용 fallback류)
 *   딕셔너리가 개입 — 딕셔너리가 원래 의도대로 돕던 케이스(blank detail 등
 *   확정 신호 자체가 없는 리드)는 그대로 유지. `testResolveBusinessSegmentPure()`
 *   갱신(확정 신호가 딕셔너리를 이기는 회귀 케이스 추가) PASS.

 * v1.5.0 (2026-08-26)
 * - **"Lead 유입 → Dictionary 조회 → Business Segment 분류" 플로우 도입(사용자
 *   요청)**. 신규: `readLeadsMasterProgramSegmentPairs_()`/
 *   `readMtaMasterProgramSegmentPairs_()`(IO, Program↔Business Segment 쌍
 *   읽기) → `aggregateProgramSegmentCounts_()`/`resolveProgramSegmentDictionaryEntries_()`
 *   (순수, 기존 UTM↔Program 채굴과 동일한 다수결+확신도 패턴) →
 *   `refreshProgramSegmentDictionary_()`(IO, `CONFIG.PROGRAM_SEGMENT_DICT.SHEET`
 *   에 캐시) → `readProgramSegmentDictionaryMap_()`(캐시 읽기, 애매한 항목
 *   제외). `resolveCanonicalProgram_()`(순수, detail 있으면 그대로·없으면 UTM
 *   딕셔너리로 역매핑) + `resolveBusinessSegmentPure_()`(순수, Program↔Segment
 *   딕셔너리 히트 시 그 값, 미스 시 기존 `getBusinessSegment()` 그대로 fallback)
 *   + `resolveBusinessSegment_()`(IO 래퍼, 두 캐시 map을 읽어 위임 —
 *   MASTER_006_LeadTransformer.js/MASTER_007_MTATransformer.js의 신규 호출
 *   대상). `readUtmProgramDictionaryMap_()`/`readProgramSegmentDictionaryMap_()`
 *   둘 다 **모듈 스코프 메모이제이션** 추가 — 리드 유입 시 행마다 호출돼도
 *   스크립트 실행 1회당 시트를 1번만 읽음(기존 Kakao Moments 동기화당 1회
 *   호출 전제가 깨지므로 필수, 성능 회귀 방지). 신규
 *   `periodicRefreshDictionaries_()`(트리거 핸들러, UTM→Program 다음
 *   Program→Segment 순으로 재채굴)/`runInstallDictionaryPeriodicRefreshTrigger()`
 *   (수동 1회 실행, `AD_004_SpendCache.js`의 `runInstallAdSpendPeriodicRefreshTrigger()`
 *   패턴 그대로 미러링 — `deleteTriggersByHandlerName_()` 재사용으로 중복
 *   설치 방지 + `CONFIG.DICTIONARY_REFRESH.PERIODIC_INTERVAL_HOURS` 시간마다
 *   자동 재채굴). `getBusinessSegment()`(UTIL_001_TransformHelper.js)는
 *   시그니처/로직 변경 없음 — 딕셔너리가 비어있으면(최초 배포 시점)
 *   `resolveBusinessSegment_()`는 100% 기존과 동일하게 동작(회귀 없음).
 *   신규 테스트: `testAggregateProgramSegmentCounts()`,
 *   `testResolveProgramSegmentDictionaryEntries()`, `testResolveCanonicalProgram()`,
 *   `testResolveBusinessSegmentPure()`.
 * v1.4.0 (2026-08-19)
 * - `readLeadsMasterUtmProgramPairs_()` 신규(Leads_Master `First MKT UTM
 *   Campaign`↔`First Touch Detail`, 리드 단위) — 사용자 요청으로 v1.0.0에서
 *   "정보량이 적어 1차 소스에서 제외"했던 Leads_Master를 2차 소스로 추가.
 *   `refreshUtmProgramDictionary_()`가 이제 MTA_Master + Leads_Master 두
 *   소스의 pair를 합쳐서 채굴(additive, 기존 소스 대체 아님) — Meta 광고
 *   캠페인명처럼 MTA_Master 터치 매칭만으로는 커버가 안 되던 경우까지
 *   딕셔너리 범위를 넓히기 위함(EVENTS_002_Engine.js의 Meta 지출 자동
 *   매칭 확장 작업 중 발견).
 * v1.3.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `17_UtmProgramDictionary.js` → 신규 `UTIL_002_UtmProgramDictionary.js`, 코드 내용 변경 없음.
 * v1.3.0 (2026-08-08)
 * - **`readUtmProgramDictionaryMap_()`가 모호한 UTM(Distinct Program Count
 *   > 1)을 결과에서 제외**하도록 수정(사용자 확인) — Consolidated/Pmax류
 *   복합 캠페인은 UTM 하나가 실제로 여러 Marketo Program과 진짜 1:N으로
 *   매칭돼(예: 이 UTM 하나가 8개 서로 다른 eBook Program과 매칭) 다수결로
 *   찍으면 틀린 값이 자동으로 채워질 위험이 있음 — Kakao Moments 등 소비처는
 *   이런 UTM을 기존처럼 빈 값으로 남겨 사람이 직접 확인.
 * - `runDebugMtaMasterTouchesForUtm()` 신규(1회성 진단) — "같은 리드의 다른
 *   터치 Lead Source Detail로 모호함을 해소하자"는 사용자 제안의 정확한
 *   규칙을 정하기 전, 실제 UTM 하나의 리드 표본 터치 내역(UTM/Lead Source
 *   Detail/날짜)을 그대로 출력해 데이터 패턴을 먼저 확인하기 위함(추측 금지
 *   원칙).
 * v1.2.0 (2026-08-08)
 * - **버그 수정(사용자 피드백) — `runListAmbiguousUtmProgramEntries()`가
 *   채택된 winner Program명만 보여줘서 "뭐가 모호하다는 건지 안 보인다"는
 *   지적**. `buildAmbiguousUtmProgramBreakdown_()` 신규(순수 함수) —
 *   UTM_Program_Dictionary(확정 결과만 있음) 대신 원본 카운트
 *   (aggregateUtmProgramCounts_() 출력)를 다시 읽어 모호한 UTM의 경쟁
 *   Program 후보 **전부**를 행으로 펼치고 "Selected (Majority)" 열로 채택
 *   여부 표시. `runListAmbiguousUtmProgramEntries()`가 MTA_Master를 다시
 *   읽어(~40초) 이 함수를 쓰도록 교체.
 * v1.1.0 (2026-08-08)
 * - `runListAmbiguousUtmProgramEntries()` 신규 — 실제 딕셔너리 첫 구축 결과
 *   3,674개 UTM 키 중 640개가 모호(Distinct Program Count > 1)로 나오자
 *   사용자가 목록을 요청 — 숨김 시트를 직접 스크롤하는 대신 모호한 항목만
 *   Total Count 내림차순으로 별도 비숨김 시트에 정리해 육안 검토 가능하게 함.
 * v1.0.0 (2026-08-08)
 * - 최초 구현. `readMtaMasterUtmProgramPairs_()`/`aggregateUtmProgramCounts_()`/
 *   `resolveUtmProgramDictionaryEntries_()`/`refreshUtmProgramDictionary_()`/
 *   `runRefreshUtmProgramDictionary()`/`readUtmProgramDictionaryMap_()` 신규.
 *   AD_006_KakaoMoments.js `computeKakaoMomentsSyncRow_()`/
 *   `syncKakaoMomentsReportToKakaoSMSRaw_()`가 이 딕셔너리를 소비하도록 연동
 *   (해당 파일 자체 changelog 참고).
 * ==========================================================
 */


/**
 * ==========================================================
 * UTM Program Dictionary Headers (같은 스프레드시트 안 숨김 캐시 시트)
 * ==========================================================
 */
const UTM_PROGRAM_DICT_HEADERS = [
  "UTM Campaign", "Marketo Program", "Match Count", "Total Count", "Distinct Program Count"
];


/**
 * ==========================================================
 * Read MTA Master UTM/Program Pairs (IO 래퍼)
 *
 * WHY
 * MTA_Master는 터치 단위라 한 행에 `MKT UTM Campaign`(그 터치의 실제
 * 캠페인)과 `Lead Source Detail`(실제 Marketo Program명)이 항상 같이
 * 있다 — 딕셔너리 채굴 소스로 적합(1차 소스, 2026-08-08). 헤더 이름
 * 기준으로 읽어(readKakaoSMSRawRows_() 스타일) 컬럼 순서 변경에 안전하게
 * 대응. **2026-08-19부터 `readLeadsMasterUtmProgramPairs_()`(리드 단위
 * 첫 터치 스냅샷)를 2차 소스로 함께 사용** — Meta 캠페인명처럼 MTA_Master
 * 터치로 안 잡히는 경우도 커버 범위를 넓히기 위함(사용자 요청,
 * `refreshUtmProgramDictionary_()` 참고).
 *
 * OUTPUT
 * Array<{utm:string, program:string}>  둘 다 비어있지 않은 행만
 * ==========================================================
 */
function readMtaMasterUtmProgramPairs_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);

  if(!sheet) return [];

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if(lastRow < 2 || lastCol === 0) return [];

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function(h){ return String(h).trim(); });

  const utmCol = headers.indexOf("MKT UTM Campaign");
  const programCol = headers.indexOf("Lead Source Detail");

  if(utmCol === -1 || programCol === -1){
    throw new Error(
      "MTA_Master에서 'MKT UTM Campaign'/'Lead Source Detail' 컬럼을 못 찾음 — " +
      "실제 헤더: " + JSON.stringify(headers)
    );
  }

  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  return values
    .map(function(row){
      return {
        utm: String(row[utmCol] || "").trim(),
        program: String(row[programCol] || "").trim()
      };
    })
    .filter(function(pair){ return !!pair.utm && !!pair.program; });

}


/**
 * ==========================================================
 * Read Leads Master UTM/Program Pairs (IO 래퍼, 2026-08-19 신규)
 *
 * WHY
 * Leads_Master는 리드 단위 첫 터치 스냅샷이라 `First MKT UTM Campaign`
 * (그 리드의 최초 터치 캠페인)과 `First Touch Detail`(실제 Marketo
 * Program명)이 한 행에 같이 있다 — readMtaMasterUtmProgramPairs_()와
 * 동일한 원리의 2차 소스(사용자 요청, Meta 지출 캠페인명처럼 MTA_Master
 * 터치로는 안 잡히는 경우까지 커버하기 위함). MTA_Master보다 정보량이
 * 적지만(리드당 1개 스냅샷 vs 터치마다 N개) 완전히 다른 리드 표본은
 * 아니라서 순수 추가(additive) — 기존 MTA_Master 소스를 대체하지 않음.
 *
 * OUTPUT
 * Array<{utm:string, program:string}>  둘 다 비어있지 않은 행만
 * ==========================================================
 */
function readLeadsMasterUtmProgramPairs_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS_MASTER);

  if(!sheet) return [];

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if(lastRow < 2 || lastCol === 0) return [];

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function(h){ return String(h).trim(); });

  const utmCol = headers.indexOf("First MKT UTM Campaign");
  const programCol = headers.indexOf("First Touch Detail");

  if(utmCol === -1 || programCol === -1){
    throw new Error(
      "Leads_Master에서 'First MKT UTM Campaign'/'First Touch Detail' 컬럼을 못 찾음 — " +
      "실제 헤더: " + JSON.stringify(headers)
    );
  }

  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  return values
    .map(function(row){
      return {
        utm: String(row[utmCol] || "").trim(),
        program: String(row[programCol] || "").trim()
      };
    })
    .filter(function(pair){ return !!pair.utm && !!pair.program; });

}


/**
 * ==========================================================
 * Aggregate UTM/Program Counts (순수 함수)
 *
 * WHY
 * utm(trim+lowercase 키)별로 같이 등장한 Program명 각각의 횟수를 센다 —
 * 다음 단계(resolveUtmProgramDictionaryEntries_())가 다수결 채택 + 확신도
 * 계산에 쓴다.
 *
 * INPUT
 * pairs : Array<{utm, program}>  readMtaMasterUtmProgramPairs_() 참고
 *
 * OUTPUT
 * Object  { utmKeyLower: { "프로그램명": count, ... }, ... }
 *
 * TEST
 * testAggregateUtmProgramCounts() 참고
 * ==========================================================
 */
function aggregateUtmProgramCounts_(pairs){

  const counts = {};

  (pairs || []).forEach(function(pair){

    const utmKey = String(pair.utm || "").trim().toLowerCase();
    const program = String(pair.program || "").trim();

    if(!utmKey || !program) return;

    if(!counts[utmKey]) counts[utmKey] = {};

    counts[utmKey][program] = (counts[utmKey][program] || 0) + 1;

  });

  return counts;

}


/**
 * ==========================================================
 * TEST — aggregateUtmProgramCounts_()
 * ==========================================================
 */
function testAggregateUtmProgramCounts(){

  const pairs = [
    { utm: "KR_core_2026-08-08_online-event", program: "WB-2026-08-KOR-MOFU-Core" },
    { utm: "kr_core_2026-08-08_online-event", program: "WB-2026-08-KOR-MOFU-Core" }, // 대소문자만 다름 — 같은 키
    { utm: "KR_core_2026-08-08_online-event", program: "WB-2026-08-KOR-MOFU-Core" },
    { utm: "KR_core_2026-08-08_online-event", program: "오타-프로그램명" }, // 소수 오타 — 별도 항목
    { utm: "kr_core_other-campaign", program: "EV-2026-08-KOR-Seminar" }
  ];

  const result = aggregateUtmProgramCounts_(pairs);

  const pass =
    result["kr_core_2026-08-08_online-event"]["WB-2026-08-KOR-MOFU-Core"] === 3 &&
    result["kr_core_2026-08-08_online-event"]["오타-프로그램명"] === 1 &&
    result["kr_core_other-campaign"]["EV-2026-08-KOR-Seminar"] === 1 &&
    Object.keys(result).length === 2;

  Logger.log("Result: " + JSON.stringify(result, null, 2));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Resolve UTM Program Dictionary Entries (순수 함수)
 *
 * WHY
 * utm별로 최다 등장 Program(다수결)을 채택하고, 채택 확신도를 같이
 * 계산한다(사용자 확정 — 모호한 매핑도 숨기지 않고 캐시 시트에서 육안
 * 검토 가능하게). 동점(최다 등장 Program이 여러 개)이면 알파벳순으로
 * 먼저 오는 쪽을 채택(결정적 결과 보장 목적, 우선순위 의미 없음).
 *
 * INPUT
 * counts : Object  aggregateUtmProgramCounts_() 반환값
 *
 * OUTPUT
 * Array<{utm, program, matchCount, totalCount, distinctProgramCount}>
 *   utm 알파벳순 정렬
 *
 * TEST
 * testResolveUtmProgramDictionaryEntries() 참고
 * ==========================================================
 */
function resolveUtmProgramDictionaryEntries_(counts){

  const utmKeys = Object.keys(counts || {}).sort();

  return utmKeys.map(function(utmKey){

    const programCounts = counts[utmKey];
    const programNames = Object.keys(programCounts).sort();

    let winner = programNames[0];
    let totalCount = 0;

    programNames.forEach(function(name){
      totalCount += programCounts[name];
      if(programCounts[name] > programCounts[winner]) winner = name;
    });

    return {
      utm: utmKey,
      program: winner,
      matchCount: programCounts[winner],
      totalCount: totalCount,
      distinctProgramCount: programNames.length
    };

  });

}


/**
 * ==========================================================
 * TEST — resolveUtmProgramDictionaryEntries_()
 * ==========================================================
 */
function testResolveUtmProgramDictionaryEntries(){

  const counts = {
    "kr_core_2026-08-08_online-event": { "WB-2026-08-KOR-MOFU-Core": 3, "오타-프로그램명": 1 },
    "kr_core_other-campaign": { "EV-2026-08-KOR-Seminar": 1 },
    "kr_core_tie-campaign": { "Program A": 2, "Program B": 2 } // 동점 — 알파벳순 "Program A" 채택
  };

  const result = resolveUtmProgramDictionaryEntries_(counts);

  const first = result[0];
  const tie = result.filter(function(e){ return e.utm === "kr_core_tie-campaign"; })[0];

  const pass =
    result.length === 3 &&
    first.utm === "kr_core_2026-08-08_online-event" && // 알파벳순 정렬 확인
    first.program === "WB-2026-08-KOR-MOFU-Core" &&
    first.matchCount === 3 &&
    first.totalCount === 4 &&
    first.distinctProgramCount === 2 &&
    tie.program === "Program A" &&
    tie.matchCount === 2;

  Logger.log("Result: " + JSON.stringify(result, null, 2));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Refresh UTM Program Dictionary (IO 래퍼 — 수동 실행 전용)
 *
 * WHY
 * MTA_Master 전체를 훑어 딕셔너리를 다시 채굴하고 캐시 시트를 통째로
 * 재작성한다(refreshAdSpendCache_()/refreshSearchEngine_()과 동일한 전체
 * 재빌드 관행 — clearContents→재작성→hideSheet→flush). MTA_Master 전체
 * 스캔(8만 행+)이라 무거움 — 리드 유입 파이프라인(매 append)에는 얹지 않고,
 * 수동(`runRefreshUtmProgramDictionary()`) 또는 별도의 주기적 시간 트리거
 * (`periodicRefreshDictionaries_()`, 2026-08-26 추가)로만 호출.
 * ==========================================================
 */
function refreshUtmProgramDictionary_(){

  const pairs = readMtaMasterUtmProgramPairs_().concat(readLeadsMasterUtmProgramPairs_());
  const counts = aggregateUtmProgramCounts_(pairs);
  const entries = resolveUtmProgramDictionaryEntries_(counts);

  const rows = entries.map(function(e){
    return [e.utm, e.program, e.matchCount, e.totalCount, e.distinctProgramCount];
  });

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(CONFIG.UTM_PROGRAM_DICT.SHEET);

  if(!sheet){
    sheet = ss.insertSheet(CONFIG.UTM_PROGRAM_DICT.SHEET);
  }

  sheet.clearContents();

  sheet.getRange(1, 1, 1, UTM_PROGRAM_DICT_HEADERS.length)
    .setValues([UTM_PROGRAM_DICT_HEADERS]);

  if(rows.length > 0){
    sheet.getRange(2, 1, rows.length, UTM_PROGRAM_DICT_HEADERS.length)
      .setValues(rows);
  }

  sheet.hideSheet();

  SpreadsheetApp.flush();

  _utmProgramDictCache = null; // 메모이제이션 캐시 무효화 — 다음 읽기가 새 값 반영

  const ambiguousCount = entries.filter(function(e){ return e.distinctProgramCount > 1; }).length;

  Logger.log(
    "UTM_Program_Dictionary 갱신 완료: " + rows.length + "개 UTM 키(모호한 키 " +
    ambiguousCount + "개 — Distinct Program Count > 1)."
  );

}


/**
 * ==========================================================
 * TEMP — refreshUtmProgramDictionary_() 수동 실행용 공개 진입점
 * ==========================================================
 */
function runRefreshUtmProgramDictionary(){

  refreshUtmProgramDictionary_();

}


/**
 * ==========================================================
 * Read UTM Program Dictionary Map (같은 스프레드시트 안 캐시 읽기 — Simple
 * Trigger 안전)
 *
 * WHY
 * readAdSpendCacheMap_()/readSearchEngineMap_()과 동일한 모양 — 외부
 * 열기/API 호출 없이 캐시 시트만 읽는다.
 *
 * **Distinct Program Count > 1(모호한 UTM)은 제외한다(2026-08-08, 사용자
 * 확인)**: Consolidated/Pmax류 복합 캠페인은 UTM 하나가 실제로 여러
 * Marketo Program과 진짜 1:N으로 매칭됨(예: "kr_core_..._outside-
 * collaboration-consolidated-eb-mofu_..."가 8개 서로 다른 eBook Program과
 * 매칭) — 다수결로 하나를 찍어도 틀린 Program이 자동으로 채워질 위험이
 * 있어, 이런 UTM은 이 맵에서 아예 빠지고 자동 채움 소비처(Kakao Moments
 * 등)는 기존처럼 빈 값으로 남겨 사람이 직접 확인하게 한다. UTM이 실제로
 * Program 1개와만 짝지어진(distinctProgramCount === 1) 확실한 경우만 반환.
 *
 * OUTPUT
 * Object  { utmKeyLower: Marketo Program명 }  Distinct Program Count === 1인
 *   항목만
 * **메모이제이션(2026-08-26 추가)**: 원래 Kakao Moments 동기화당 1회 호출
 * 전제였으나, `resolveBusinessSegment_()`가 리드/터치 행마다 이 함수를
 * 호출하게 되면서(Full Rebuild 시 12만 행+) 매번 시트를 다시 읽으면 성능
 * 회귀가 발생함 — 스크립트 실행 1회당 1번만 읽고 이후는 모듈 스코프 변수
 * (`_utmProgramDictCache`)에서 반환. 다음 별도 실행에서는 초기화됨(정상
 * GAS 패턴, 캐시가 stale해질 위험 없음).
 * ==========================================================
 */
let _utmProgramDictCache = null;

/**
 * ==========================================================
 * UTM Program Dictionary Manual Exclusions
 *
 * WHY (2026-08-28)
 * `readUtmProgramDictionaryMap_()`의 다수결 채굴이 "모호하지 않음"
 * (Distinct Program Count===1)으로 통과시켰지만 실제로는 틀린 사례가
 * 발견됨 — 오래된 범용 트래픽 캠페인처럼 대부분의 클릭이 리드로 전혀
 * 귀속되지 않는 캠페인은, 어쩌다 귀속된 소수 터치가 우연히 한 Program에
 * 몰리면 통계적으로 "확실"해 보이지만 실제로는 그 UTM의 진짜 성격을
 * 대표하지 못한다(사람이 직접 확인해야 판별 가능, 자동 규칙화 안 함).
 * 여기 등록된 UTM Campaign 키(소문자, `MKT UTM Campaign` 원문 기준)는
 * Distinct Program Count와 무관하게 항상 딕셔너리 매칭에서 제외 —
 * 이 딕셔너리를 쓰는 모든 소비처(Events/BOFU/Content/Search Spend 매칭,
 * Business Segment 분류)에 동일하게 적용됨.
 *
 * 항목 추가 시 반드시 사람이 직접 확인한 근거를 주석으로 남길 것
 * (`docs/OpenItems.md` 참고 — 임의로 목록을 넓히지 않는다).
 * ==========================================================
 */
const UTM_PROGRAM_DICT_MANUAL_EXCLUSIONS = [
  // 2026-08-28 — TEMPQA_038 조사로 발견. 2024-07-19부터 지금까지 도는
  // 범용 TOFU 트래픽 캠페인인데, 소수 귀속 터치가 우연히 전부
  // "WB-2026-07-KOR-MOFU-Core Game Changing Common Application Tips &
  // Case Studies"(2026-07 웨비나)로 찍혀 있어 그 캠페인의 2년치 누적
  // Spend/Clicks 전체가 이 웨비나 하나에 잘못 귀속되던 문제(사용자 확인,
  // Events_OPS에서 CVR 71.3%/Spent $10,706처럼 비정상 수치로 발견됨).
  "kr_core_2024-07-19_landing-page-tofu_traffic",
  // 2026-08-28 — TEMPQA_039로 "tofu"/"traffic" 포함 딕셔너리 전수 조사
  // 중 발견(둘 다 Total Count=1, 매칭 Program과 UTM명 주제가 안 맞음 —
  // "tofu"라는 단어 자체는 이 계정에서 그냥 퍼널단계 네이밍 태그일 뿐
  // 무관 신호가 아님이 같은 조사로 확인됨, 대부분의 tofu 태그 UTM은
  // Program명과 정확히 일치해 제외 대상이 아니었음 — 이 2건만 예외):
  "kr_core_2025-07-19_stanford-analysis-case-study-event-tofu_traffic", // 매칭 Program "WB-2025-06-KOR-MOFU-Core Successful app showcase From SG to HYPS"과 주제 불일치(사용자 확인)
  "wb-2023-01-usa-tofu-core chinese-webinar-trend-analysis-david" // 매칭 Program이 "wechat"이라는 특정 콘텐츠를 안 가리키는 이름(사용자 확인)
];


/**
 * ==========================================================
 * Is UTM Program Dictionary Key Excluded (순수 함수)
 *
 * @param {string} utmKeyLower  소문자로 정규화된 UTM Campaign 키
 * @return {boolean}
 *
 * TEST
 * testIsUtmProgramDictionaryKeyExcluded() 참고
 * ==========================================================
 */
function isUtmProgramDictionaryKeyExcluded_(utmKeyLower){

  return UTM_PROGRAM_DICT_MANUAL_EXCLUSIONS.indexOf(utmKeyLower) !== -1;

}


/**
 * ==========================================================
 * TEST — isUtmProgramDictionaryKeyExcluded_()
 * ==========================================================
 */
function testIsUtmProgramDictionaryKeyExcluded(){

  const pass =
    isUtmProgramDictionaryKeyExcluded_("kr_core_2024-07-19_landing-page-tofu_traffic") === true &&
    isUtmProgramDictionaryKeyExcluded_("kr_core_2025-07-19_stanford-analysis-case-study-event-tofu_traffic") === true &&
    isUtmProgramDictionaryKeyExcluded_("wb-2023-01-usa-tofu-core chinese-webinar-trend-analysis-david") === true &&
    isUtmProgramDictionaryKeyExcluded_("kr_core_2026-01-01_some-webinar_lead") === false;

  Logger.log("testIsUtmProgramDictionaryKeyExcluded: " + (pass ? "PASS" : "FAIL"));

}


function readUtmProgramDictionaryMap_(){

  if(_utmProgramDictCache) return _utmProgramDictCache;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.UTM_PROGRAM_DICT.SHEET);

  const map = {};

  if(!sheet){
    _utmProgramDictCache = map;
    return map;
  }

  const values = sheet.getDataRange().getValues();

  for(let i = 1; i < values.length; i++){

    const distinctProgramCount = Number(values[i][4]);

    if(distinctProgramCount !== 1) continue; // 모호한 UTM 제외

    const utmKeyLower = String(values[i][0] || "").trim().toLowerCase();

    if(isUtmProgramDictionaryKeyExcluded_(utmKeyLower)) continue; // 수동 확인된 오채굴 제외

    map[utmKeyLower] = values[i][1];

  }

  _utmProgramDictCache = map;

  return map;

}


/**
 * ==========================================================
 * Ambiguous UTM Program Dictionary Headers (경쟁 후보 상세 시트 전용)
 * ==========================================================
 */
const AMBIGUOUS_UTM_PROGRAM_HEADERS = [
  "UTM Campaign", "Candidate Program", "Count", "Selected (Majority)", "Total Count for UTM"
];


/**
 * ==========================================================
 * Build Ambiguous UTM Program Breakdown (순수 함수)
 *
 * WHY (2026-08-08, 사용자 요청)
 * 첫 버전은 UTM_Program_Dictionary(이미 다수결로 확정된 winner 하나만 있는
 * 시트)를 그대로 필터링해 보여줘서, 사용자가 "뭐가 모호하다는 건지 안
 * 보인다"고 지적 — winner 말고 **경쟁했던 다른 Program 후보들**이 실제로
 * 시트에 안 보였던 게 원인. `aggregateUtmProgramCounts_()`가 만드는 원본
 * 카운트(모든 후보)를 그대로 받아, distinctProgramCount > 1인 UTM만 골라
 * 후보 Program **전부**를 행으로 펼친다 — resolveUtmProgramDictionaryEntries_()
 * 와 동일한 다수결/동점 규칙(최다 등장, 동점이면 알파벳순)으로 어느 후보가
 * 채택됐는지(`Selected (Majority)`)도 같이 표시.
 *
 * INPUT
 * counts : Object  aggregateUtmProgramCounts_() 반환값
 *
 * OUTPUT
 * Array<{utm, program, count, isSelected, totalCountForUtm}>  UTM별 totalCount
 *   내림차순(영향 큰 UTM 먼저), 같은 UTM 안에서는 count 내림차순
 *
 * TEST
 * testBuildAmbiguousUtmProgramBreakdown() 참고
 * ==========================================================
 */
function buildAmbiguousUtmProgramBreakdown_(counts){

  const utmKeys = Object.keys(counts || {});

  const groups = utmKeys
    .map(function(utmKey){

      const programCounts = counts[utmKey];
      const programNames = Object.keys(programCounts).sort();

      if(programNames.length <= 1) return null; // 모호하지 않음 — 제외

      let winner = programNames[0];

      programNames.forEach(function(name){
        if(programCounts[name] > programCounts[winner]) winner = name;
      });

      const totalCountForUtm = programNames.reduce(function(sum, name){
        return sum + programCounts[name];
      }, 0);

      const candidates = programNames
        .slice()
        .sort(function(a, b){ return programCounts[b] - programCounts[a]; })
        .map(function(name){
          return {
            utm: utmKey,
            program: name,
            count: programCounts[name],
            isSelected: name === winner,
            totalCountForUtm: totalCountForUtm
          };
        });

      return { totalCountForUtm: totalCountForUtm, candidates: candidates };

    })
    .filter(function(g){ return g !== null; })
    .sort(function(a, b){ return b.totalCountForUtm - a.totalCountForUtm; });

  const breakdown = [];

  groups.forEach(function(g){
    g.candidates.forEach(function(c){ breakdown.push(c); });
  });

  return breakdown;

}


/**
 * ==========================================================
 * TEST — buildAmbiguousUtmProgramBreakdown_()
 * ==========================================================
 */
function testBuildAmbiguousUtmProgramBreakdown(){

  const counts = {
    "kr_core_low-volume": { "Program X": 1, "Program Y": 1 }, // total 2 — 모호
    "kr_core_high-volume": { "WB-2026-08-KOR-MOFU-Core": 8, "오타-프로그램명": 2 }, // total 10 — 모호, 더 큼
    "kr_core_clean": { "EV-2026-08-KOR-Seminar": 5 } // 모호하지 않음 — 제외돼야 함
  };

  const result = buildAmbiguousUtmProgramBreakdown_(counts);

  const pass =
    result.length === 4 && // low-volume 2개 + high-volume 2개, clean은 제외
    result[0].utm === "kr_core_high-volume" && // totalCountForUtm 큰 그룹 먼저
    result[0].program === "WB-2026-08-KOR-MOFU-Core" &&
    result[0].count === 8 &&
    result[0].isSelected === true &&
    result[0].totalCountForUtm === 10 &&
    result[1].utm === "kr_core_high-volume" &&
    result[1].program === "오타-프로그램명" &&
    result[1].isSelected === false &&
    result[2].utm === "kr_core_low-volume" &&
    result[2].isSelected === true && // 동점 — 알파벳순 "Program X" 채택
    result[2].program === "Program X";

  Logger.log("Result: " + JSON.stringify(result, null, 2));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * TEMP — 모호한 UTM의 경쟁 Program 후보 전부를 눈에 보이는 시트로 정리
 * (수동 실행, 육안 검토용)
 *
 * WHY (2026-08-08, 사용자 요청)
 * MTA_Master를 다시 읽어(runRefreshUtmProgramDictionary()와 동일 소스,
 * ~40초) 원본 카운트를 얻고 buildAmbiguousUtmProgramBreakdown_()로 모호한
 * UTM의 후보 Program 전부를 펼쳐 별도 **비숨김** 시트에 정리 — "Selected
 * (Majority)" 열로 다수결 채택 여부까지 표시해, 뭐랑 경쟁해서 뭐가 뽑혔는지
 * 한눈에 보이게 함(이전 버전은 채택된 것만 보여줘 사용자가 "뭐가
 * 모호하다는 건지 모르겠다"고 지적).
 * ==========================================================
 */
function runListAmbiguousUtmProgramEntries(){

  const pairs = readMtaMasterUtmProgramPairs_();
  const counts = aggregateUtmProgramCounts_(pairs);
  const breakdown = buildAmbiguousUtmProgramBreakdown_(counts);

  const rows = breakdown.map(function(c){
    return [c.utm, c.program, c.count, c.isSelected ? "TRUE" : "", c.totalCountForUtm];
  });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const outputSheetName = CONFIG.UTM_PROGRAM_DICT.SHEET + "_Ambiguous";

  let outputSheet = ss.getSheetByName(outputSheetName);

  if(!outputSheet){
    outputSheet = ss.insertSheet(outputSheetName);
  }

  outputSheet.showSheet();
  outputSheet.clearContents();

  outputSheet.getRange(1, 1, 1, AMBIGUOUS_UTM_PROGRAM_HEADERS.length)
    .setValues([AMBIGUOUS_UTM_PROGRAM_HEADERS]);

  if(rows.length > 0){
    outputSheet.getRange(2, 1, rows.length, AMBIGUOUS_UTM_PROGRAM_HEADERS.length)
      .setValues(rows);
  }

  SpreadsheetApp.flush();

  const ambiguousUtmCount = breakdown.filter(function(c){ return c.isSelected; }).length;

  Logger.log(
    outputSheetName + " 시트에 모호한 UTM " + ambiguousUtmCount + "개(후보 " +
    rows.length + "행) 정리 완료 — Total Count for UTM 내림차순, 같은 UTM 안에서는 " +
    "Count 내림차순, Selected (Majority)=TRUE가 다수결 채택된 후보."
  );

}


/**
 * ==========================================================
 * TEMP — 특정 UTM으로 들어온 리드들의 MTA_Master 전체 터치 내역 진단
 * (수동 실행, 1회성)
 *
 * WHY (2026-08-08, 사용자 요청)
 * Consolidated/Pmax류 복합 캠페인 UTM은 여러 Marketo Program과 진짜 1:N으로
 * 매칭될 수 있다는 사용자 지적 이후, "같은 리드의 다른 터치에 찍힌 Lead
 * Source Detail을 봐서 모호함을 해소하자"는 제안이 나왔는데 — 정확한 규칙
 * (어느 터치를 근거로 삼을지, Created Date 기준으로 어떻게 고를지)은 실제
 * 데이터 패턴을 보지 않고는 추측 금지 원칙상 확정할 수 없음. 이 UTM으로
 * 들어온 리드 표본의 실제 터치들(UTM/Lead Source Detail/날짜)을 그대로
 * 찍어서 같이 보고 규칙을 정하기 위한 1회성 진단.
 *
 * 표본이 너무 많으면 로그가 잘리므로 리드 최대 15명만 출력(경고 로그로
 * 전체 리드 수는 알려줌).
 * ==========================================================
 */
function runDebugMtaMasterTouchesForUtm(){

  const targetUtm = "kr_core_2023-07-14_outside-collaboration-consolidated-eb-mofu_lead-fbiglg";
  const targetUtmLower = targetUtm.trim().toLowerCase();
  const maxLeadsToLog = 15;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);

  if(!sheet){
    Logger.log("MTA_Master 시트를 못 찾음.");
    return;
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function(h){ return String(h).trim(); });

  const leadIdCol = headers.indexOf("Lead ID");
  const utmCol = headers.indexOf("MKT UTM Campaign");
  const programCol = headers.indexOf("Lead Source Detail");
  const dateCol = headers.indexOf("MTA Created Date");

  if(leadIdCol === -1 || utmCol === -1 || programCol === -1 || dateCol === -1){
    Logger.log(
      "필요한 컬럼을 못 찾음 — 실제 헤더: " + JSON.stringify(headers)
    );
    return;
  }

  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  // 1단계: 이 UTM이 찍힌 터치가 하나라도 있는 Lead ID 전부 수집
  const matchingLeadIds = {};

  values.forEach(function(row){
    const utm = String(row[utmCol] || "").trim().toLowerCase();
    if(utm === targetUtmLower){
      matchingLeadIds[String(row[leadIdCol] || "")] = true;
    }
  });

  const leadIds = Object.keys(matchingLeadIds).filter(function(id){ return !!id; });

  Logger.log("UTM: " + targetUtm);
  Logger.log("이 UTM으로 들어온 고유 Lead ID 수: " + leadIds.length);

  // 2단계: 그 Lead ID들의 "전체" 터치(이 UTM 아닌 것도 포함)를 Lead ID별로 모음
  const touchesByLeadId = {};

  values.forEach(function(row){
    const leadId = String(row[leadIdCol] || "");
    if(!matchingLeadIds[leadId]) return;

    if(!touchesByLeadId[leadId]) touchesByLeadId[leadId] = [];

    touchesByLeadId[leadId].push({
      utm: row[utmCol],
      program: row[programCol],
      date: row[dateCol]
    });

  });

  // 3단계: Lead ID별로 날짜순 정렬 후 최대 maxLeadsToLog명만 출력
  leadIds.slice(0, maxLeadsToLog).forEach(function(leadId){

    const touches = touchesByLeadId[leadId].slice().sort(function(a, b){
      const aTime = a.date instanceof Date ? a.date.getTime() : 0;
      const bTime = b.date instanceof Date ? b.date.getTime() : 0;
      return aTime - bTime;
    });

    Logger.log("--- Lead ID: " + leadId + " (터치 " + touches.length + "개, 날짜순) ---");

    touches.forEach(function(t){
      const dateStr = t.date instanceof Date ? Utilities.formatDate(t.date, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd") : String(t.date);
      Logger.log(
        "  " + dateStr + " | UTM: " + t.utm + " | Lead Source Detail: " +
        (t.program || "(빈값)")
      );
    });

  });

  if(leadIds.length > maxLeadsToLog){
    Logger.log(
      "(리드 " + (leadIds.length - maxLeadsToLog) + "명 더 있음 — 로그 잘림 방지로 " +
      maxLeadsToLog + "명만 출력)"
    );
  }

}


/**
 * ==========================================================
 * Program Segment Dictionary Headers (같은 스프레드시트 안 숨김 캐시 시트,
 * 2026-08-26 신규)
 * ==========================================================
 */
const PROGRAM_SEGMENT_DICT_HEADERS = [
  "Marketo Program", "Business Segment", "Match Count", "Total Count", "Distinct Segment Count"
];


/**
 * ==========================================================
 * Read Leads Master Program/Segment Pairs (IO 래퍼, 2026-08-26 신규)
 *
 * WHY
 * Leads_Master는 리드 단위 첫 터치 스냅샷이라 `First Touch Detail`(실제
 * Marketo Program명)과 `Business Segment`(그 리드의 확정 분류값, 과거
 * getBusinessSegment() 호출 결과가 이미 기록돼있음)가 한 행에 같이 있다 —
 * readLeadsMasterUtmProgramPairs_()와 동일한 원리로 Program→Segment
 * 다수결 채굴의 소스가 된다.
 *
 * OUTPUT
 * Array<{program:string, segment:string}>  둘 다 비어있지 않은 행만
 * ==========================================================
 */
function readLeadsMasterProgramSegmentPairs_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS_MASTER);

  if(!sheet) return [];

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if(lastRow < 2 || lastCol === 0) return [];

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function(h){ return String(h).trim(); });

  const programCol = headers.indexOf("First Touch Detail");
  const segmentCol = headers.indexOf("Business Segment");

  if(programCol === -1 || segmentCol === -1){
    throw new Error(
      "Leads_Master에서 'First Touch Detail'/'Business Segment' 컬럼을 못 찾음 — " +
      "실제 헤더: " + JSON.stringify(headers)
    );
  }

  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  return values
    .map(function(row){
      return {
        program: String(row[programCol] || "").trim(),
        segment: String(row[segmentCol] || "").trim()
      };
    })
    .filter(function(pair){ return !!pair.program && !!pair.segment; });

}


/**
 * ==========================================================
 * Read MTA Master Program/Segment Pairs (IO 래퍼, 2026-08-26 신규)
 *
 * WHY
 * MTA_Master는 터치 단위라 `Lead Source Detail`(실제 Marketo Program명)과
 * `Business Segment`가 한 행에 같이 있다 — Leads_Master보다 표본이 훨씬
 * 많아(터치마다 N개) 다수결 신뢰도가 높음. readMtaMasterUtmProgramPairs_()
 * 와 동일한 원리의 2차 소스(additive, Leads_Master를 대체하지 않음).
 *
 * OUTPUT
 * Array<{program:string, segment:string}>  둘 다 비어있지 않은 행만
 * ==========================================================
 */
function readMtaMasterProgramSegmentPairs_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);

  if(!sheet) return [];

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if(lastRow < 2 || lastCol === 0) return [];

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function(h){ return String(h).trim(); });

  const programCol = headers.indexOf("Lead Source Detail");
  const segmentCol = headers.indexOf("Business Segment");

  if(programCol === -1 || segmentCol === -1){
    throw new Error(
      "MTA_Master에서 'Lead Source Detail'/'Business Segment' 컬럼을 못 찾음 — " +
      "실제 헤더: " + JSON.stringify(headers)
    );
  }

  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  return values
    .map(function(row){
      return {
        program: String(row[programCol] || "").trim(),
        segment: String(row[segmentCol] || "").trim()
      };
    })
    .filter(function(pair){ return !!pair.program && !!pair.segment; });

}


/**
 * ==========================================================
 * Aggregate Program/Segment Counts (순수 함수, 2026-08-26 신규)
 *
 * WHY
 * program(trim 키, 대소문자 구분 유지 — 조회 시 lower 비교는 별도 단계에서)
 * 별로 같이 등장한 Business Segment 각각의 횟수를 센다 — 다음 단계
 * (resolveProgramSegmentDictionaryEntries_())가 다수결 채택 + 확신도 계산에
 * 쓴다. aggregateUtmProgramCounts_()와 동일 구조.
 *
 * INPUT
 * pairs : Array<{program, segment}>
 *
 * OUTPUT
 * Object  { programKeyLower: { "Segment명": count, ... }, ... }
 *
 * TEST
 * testAggregateProgramSegmentCounts() 참고
 * ==========================================================
 */
function aggregateProgramSegmentCounts_(pairs){

  const counts = {};

  (pairs || []).forEach(function(pair){

    const programKey = String(pair.program || "").trim().toLowerCase();
    const segment = String(pair.segment || "").trim();

    if(!programKey || !segment) return;

    if(!counts[programKey]) counts[programKey] = {};

    counts[programKey][segment] = (counts[programKey][segment] || 0) + 1;

  });

  return counts;

}


/**
 * ==========================================================
 * TEST — aggregateProgramSegmentCounts_()
 * ==========================================================
 */
function testAggregateProgramSegmentCounts(){

  const pairs = [
    { program: "WF-2026-08-KOR-BOFU-Core Google SA College Specific-Ivy", segment: "Search" },
    { program: "wf-2026-08-kor-bofu-core google sa college specific-ivy", segment: "Search" }, // 대소문자만 다름 — 같은 키
    { program: "WF-2026-08-KOR-BOFU-Core Google SA College Specific-Ivy", segment: "Search" },
    { program: "WF-2026-08-KOR-BOFU-Core Google SA College Specific-Ivy", segment: "BOFU" }, // 소수 예외 — 별도 항목
    { program: "2025-07-KOR-BOFU-Core B", segment: "BOFU" }
  ];

  const result = aggregateProgramSegmentCounts_(pairs);

  const pass =
    result["wf-2026-08-kor-bofu-core google sa college specific-ivy"]["Search"] === 3 &&
    result["wf-2026-08-kor-bofu-core google sa college specific-ivy"]["BOFU"] === 1 &&
    result["2025-07-kor-bofu-core b"]["BOFU"] === 1 &&
    Object.keys(result).length === 2;

  Logger.log("Result: " + JSON.stringify(result, null, 2));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Resolve Program Segment Dictionary Entries (순수 함수, 2026-08-26 신규)
 *
 * WHY
 * program별로 최다 등장 Business Segment(다수결)를 채택하고, 채택 확신도를
 * 같이 계산한다 — resolveUtmProgramDictionaryEntries_()와 동일 규칙. 동점
 * (최다 등장 Segment가 여러 개)이면 알파벳순으로 먼저 오는 쪽을 채택
 * (결정적 결과 보장 목적, 우선순위 의미 없음).
 *
 * INPUT
 * counts : Object  aggregateProgramSegmentCounts_() 반환값
 *
 * OUTPUT
 * Array<{program, segment, matchCount, totalCount, distinctSegmentCount}>
 *   program 알파벳순 정렬
 *
 * TEST
 * testResolveProgramSegmentDictionaryEntries() 참고
 * ==========================================================
 */
function resolveProgramSegmentDictionaryEntries_(counts){

  const programKeys = Object.keys(counts || {}).sort();

  return programKeys.map(function(programKey){

    const segmentCounts = counts[programKey];
    const segmentNames = Object.keys(segmentCounts).sort();

    let winner = segmentNames[0];
    let totalCount = 0;

    segmentNames.forEach(function(name){
      totalCount += segmentCounts[name];
      if(segmentCounts[name] > segmentCounts[winner]) winner = name;
    });

    return {
      program: programKey,
      segment: winner,
      matchCount: segmentCounts[winner],
      totalCount: totalCount,
      distinctSegmentCount: segmentNames.length
    };

  });

}


/**
 * ==========================================================
 * TEST — resolveProgramSegmentDictionaryEntries_()
 * ==========================================================
 */
function testResolveProgramSegmentDictionaryEntries(){

  const counts = {
    "wf-2026-08-kor-bofu-core google sa college specific-ivy": { "Search": 8 },
    "2025-12-kor-naver sa & google ivy league": { "Search": 42, "Other": 1 },
    "kr_core_tie-program": { "Segment A": 2, "Segment B": 2 } // 동점 — 알파벳순 "Segment A" 채택
  };

  const result = resolveProgramSegmentDictionaryEntries_(counts);

  const first = result.filter(function(e){ return e.program === "2025-12-kor-naver sa & google ivy league"; })[0];
  const ivy = result.filter(function(e){ return e.program === "wf-2026-08-kor-bofu-core google sa college specific-ivy"; })[0];
  const tie = result.filter(function(e){ return e.program === "kr_core_tie-program"; })[0];

  const pass =
    result.length === 3 &&
    first.segment === "Search" &&
    first.matchCount === 42 &&
    first.totalCount === 43 &&
    first.distinctSegmentCount === 2 &&
    ivy.segment === "Search" &&
    ivy.matchCount === 8 &&
    ivy.distinctSegmentCount === 1 &&
    tie.segment === "Segment A" &&
    tie.matchCount === 2;

  Logger.log("Result: " + JSON.stringify(result, null, 2));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Refresh Program Segment Dictionary (IO 래퍼 — 수동/주기 트리거 전용,
 * 2026-08-26 신규)
 *
 * WHY
 * Leads_Master + MTA_Master 전체를 훑어 Program→Business Segment 딕셔너리를
 * 다시 채굴하고 캐시 시트를 통째로 재작성한다. refreshUtmProgramDictionary_()
 * 와 완전히 동일한 패턴(clearContents→재작성→hideSheet→flush) — 무거운
 * 전체 스캔이라 리드 유입 파이프라인에는 얹지 않고, 수동
 * (`runRefreshProgramSegmentDictionary()`) 또는 주기적 시간 트리거
 * (`periodicRefreshDictionaries_()`)로만 호출.
 * ==========================================================
 */
function refreshProgramSegmentDictionary_(){

  const pairs = readMtaMasterProgramSegmentPairs_().concat(readLeadsMasterProgramSegmentPairs_());
  const counts = aggregateProgramSegmentCounts_(pairs);
  const entries = resolveProgramSegmentDictionaryEntries_(counts);

  const rows = entries.map(function(e){
    return [e.program, e.segment, e.matchCount, e.totalCount, e.distinctSegmentCount];
  });

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(CONFIG.PROGRAM_SEGMENT_DICT.SHEET);

  if(!sheet){
    sheet = ss.insertSheet(CONFIG.PROGRAM_SEGMENT_DICT.SHEET);
  }

  sheet.clearContents();

  sheet.getRange(1, 1, 1, PROGRAM_SEGMENT_DICT_HEADERS.length)
    .setValues([PROGRAM_SEGMENT_DICT_HEADERS]);

  if(rows.length > 0){
    sheet.getRange(2, 1, rows.length, PROGRAM_SEGMENT_DICT_HEADERS.length)
      .setValues(rows);
  }

  sheet.hideSheet();

  SpreadsheetApp.flush();

  _programSegmentDictCache = null; // 메모이제이션 캐시 무효화 — 다음 읽기가 새 값 반영

  const ambiguousCount = entries.filter(function(e){ return e.distinctSegmentCount > 1; }).length;

  Logger.log(
    "Program_Segment_Dictionary 갱신 완료: " + rows.length + "개 Program 키(모호한 키 " +
    ambiguousCount + "개 — Distinct Segment Count > 1)."
  );

}


/**
 * ==========================================================
 * TEMP — refreshProgramSegmentDictionary_() 수동 실행용 공개 진입점
 * ==========================================================
 */
function runRefreshProgramSegmentDictionary(){

  refreshProgramSegmentDictionary_();

}


/**
 * ==========================================================
 * Read Program Segment Dictionary Map (같은 스프레드시트 안 캐시 읽기 —
 * Simple Trigger 안전, 2026-08-26 신규)
 *
 * WHY
 * readUtmProgramDictionaryMap_()과 동일한 모양 — 외부 열기/API 호출 없이
 * 캐시 시트만 읽는다. **Distinct Segment Count > 1(애매한 Program, 예: 정책
 * 변경 중간에 같은 이름이 재사용된 경우)은 제외한다** — 다수결로 하나를
 * 찍어도 틀린 Segment가 자동으로 채워질 위험이 있어, 이런 Program은 이
 * 맵에서 아예 빠지고 소비처(`resolveBusinessSegmentPure_()`)가 기존
 * `getBusinessSegment()` 키워드 규칙으로 fallback한다. Program이 실제로
 * Segment 1개와만 짝지어진(distinctSegmentCount === 1) 확실한 경우만 반환.
 *
 * **메모이제이션**: readUtmProgramDictionaryMap_()과 동일 이유 — 리드
 * 유입 시 행마다 호출돼도 스크립트 실행 1회당 1번만 읽음.
 *
 * OUTPUT
 * Object  { programKeyLower: Business Segment명 }  Distinct Segment Count === 1인
 *   항목만
 * ==========================================================
 */
let _programSegmentDictCache = null;

function readProgramSegmentDictionaryMap_(){

  if(_programSegmentDictCache) return _programSegmentDictCache;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.PROGRAM_SEGMENT_DICT.SHEET);

  const map = {};

  if(!sheet){
    _programSegmentDictCache = map;
    return map;
  }

  const values = sheet.getDataRange().getValues();

  for(let i = 1; i < values.length; i++){

    const distinctSegmentCount = Number(values[i][4]);

    if(distinctSegmentCount !== 1) continue; // 애매한 Program 제외

    map[String(values[i][0] || "").trim().toLowerCase()] = values[i][1];

  }

  _programSegmentDictCache = map;

  return map;

}


/**
 * ==========================================================
 * Resolve Canonical Program (순수 함수, 2026-08-26 신규)
 *
 * WHY
 * detail(Lead Source Detail / First Touch Detail)이 이미 실제 Marketo
 * Program명인 경우가 대다수라 그대로 신뢰 — detail이 비어있는 소수 터치만
 * UTM_Program_Dictionary로 raw UTM(campaign)을 역매핑해 보완한다
 * (SEARCH_UTM_TO_PROGRAM_OVERRIDE가 원래 하려던 것과 같은 목적을 자동
 * 채굴로 일반화).
 *
 * INPUT
 * campaignRaw   : string  raw UTM Campaign
 * detailRaw     : string  Lead Source Detail / First Touch Detail
 * utmProgramMap : Object  readUtmProgramDictionaryMap_() 반환값
 *
 * OUTPUT
 * string  canonical Program명(못 찾으면 빈 문자열)
 *
 * TEST
 * testResolveCanonicalProgram() 참고
 * ==========================================================
 */
function resolveCanonicalProgram_(campaignRaw, detailRaw, utmProgramMap){

  const detail = String(detailRaw || "").trim();

  if(detail) return detail;

  const utmKey = String(campaignRaw || "").trim().toLowerCase();

  return (utmProgramMap && utmProgramMap[utmKey]) || "";

}


/**
 * ==========================================================
 * TEST — resolveCanonicalProgram_()
 * ==========================================================
 */
function testResolveCanonicalProgram(){

  const utmProgramMap = {
    "kr_core_transfer-gap-year-kr": "2025-11-KOR-Naver SA Transfer and Gap Year"
  };

  const pass =
    resolveCanonicalProgram_("kr_core_transfer-gap-year-kr", "WF-2026-08-KOR-BOFU-Core Google SA Transfer-US", utmProgramMap)
      === "WF-2026-08-KOR-BOFU-Core Google SA Transfer-US" && // detail 있으면 그대로(우선)
    resolveCanonicalProgram_("kr_core_transfer-gap-year-kr", "", utmProgramMap)
      === "2025-11-KOR-Naver SA Transfer and Gap Year" && // detail 없으면 UTM 딕셔너리로 역매핑
    resolveCanonicalProgram_("kr_core_unknown-utm", "", utmProgramMap) === "" && // 둘 다 없음
    resolveCanonicalProgram_("", "", utmProgramMap) === "";

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Resolve Business Segment Pure (순수 함수, 2026-08-26 신규)
 *
 * WHY (사용자 요청 — "Lead 유입 → Dictionary 조회 → Business Segment 분류")
 * canonicalProgram을 먼저 확정한 뒤 Program_Segment_Dictionary에서 그
 * Program의 자동 채굴된(다수결) Business Segment를 조회 — 있으면 즉시
 * 반환(딕셔너리 우선, 사용자 확정). 딕셔너리에 없는 경우(완전히 신규인
 * Program, 또는 애매해서 제외된 Program)만 기존
 * `getBusinessSegment()`(UTIL_001_TransformHelper.js) 키워드 규칙으로
 * fallback — 그 함수의 시그니처/로직은 전혀 건드리지 않는다(Article 7,
 * 유일한 Business Logic 소유자 유지).
 *
 * **우선순위 재조정(2026-08-26, 사용자 확정 — 배포 직후 TEMPQA_034 diff로
 * 발견)**: 최초 버전은 딕셔너리를 무조건 최우선으로 뒀는데, 그러면 이미
 * 사용자가 실측/육안 검증으로 확정한 신호(Referral의 leadSource, campaign의
 * "search"/"sitelink" — 2026-07-28에 49개 캠페인 직접 검증, 오늘 만든 Google
 * SA/Naver SA 채널 신호 등, `resolveDefiniteBusinessSegment_()` 참고)까지
 * Program 단위 다수결이 근거 없이 뒤집는 사고가 실제로 발견됨("Search →
 * Webinar" 4건, canonicalProgram="2021-07-KOR-Book a consult page" — 검증된
 * "sitelink" 신호가 있는데도 Program 다수결이 Webinar로 덮어씀). 이제
 * `getBusinessSegment()`의 확정 신호 구간(`resolveDefiniteBusinessSegment_()`,
 * Exceptions~Search 확정 신호까지)을 **딕셔너리보다 먼저** 체크하고, 거기서
 * 안 걸릴 때만(Content 이후에 해당하는 범용 fallback류) 딕셔너리를 참조한다.
 *
 * 왜 순환 의존이 아닌가: programSegmentMap은 Leads_Master/MTA_Master에
 * **이미 기록된**(과거 getBusinessSegment() 호출로 확정된) Business Segment
 * 값을 다수결 집계한 것 — 이 함수 호출 시점에 재귀적으로 재계산하는 게
 * 아니라 별도 스케줄(주기적 트리거)로 미리 채굴해둔 캐시를 읽을 뿐이다.
 * "과거의 합의가 미래 리드를 안내"하는 시간적으로 분리된 패턴.
 *
 * INPUT
 * campaign, detail, leadSource, category : string  getBusinessSegment()와 동일
 * programSegmentMap : Object  readProgramSegmentDictionaryMap_() 반환값
 * utmProgramMap     : Object  readUtmProgramDictionaryMap_() 반환값
 *
 * OUTPUT
 * string  Business Segment
 *
 * TEST
 * testResolveBusinessSegmentPure() 참고
 * ==========================================================
 */
function resolveBusinessSegmentPure_(campaign, detail, leadSource, category, programSegmentMap, utmProgramMap){

  const definite = resolveDefiniteBusinessSegment_(campaign, detail, leadSource, category);

  if(definite) return definite;

  const canonicalProgram = resolveCanonicalProgram_(campaign, detail, utmProgramMap);

  if(canonicalProgram){

    const segment = (programSegmentMap || {})[canonicalProgram.trim().toLowerCase()];

    if(segment) return segment;

  }

  return getBusinessSegment(campaign, detail, leadSource, category);

}


/**
 * ==========================================================
 * TEST — resolveBusinessSegmentPure_()
 * ==========================================================
 */
function testResolveBusinessSegmentPure(){

  const programSegmentMap = {
    "some custom nurture drip program": "Content",
    "2025-12-kor-naver sa & google ivy league": "Webinar" // 실제로는 사용자 검증된 "Book a consult page"와 유사한 오염 시나리오 재현용
  };
  const utmProgramMap = {
    "kr_core_2021-04-01_search-kr_tier1-college-specific_contact": "2025-12-KOR-Naver SA & Google Ivy League",
    "kr_core_2025-01-01_random-slug-xyz": "2025-12-KOR-Naver SA & Google Ivy League"
  };

  // 딕셔너리 히트 — 확정 신호(Exceptions/Referral/Seminar/Webinar/Google·Naver SA
  // 채널/BOFU/Search 확정)에 전혀 안 걸리는 순수 신규 Program명이 딕셔너리에
  // 있으면 그 값을 바로 반환
  const hit = resolveBusinessSegmentPure_(
    "", "Some Custom Nurture Drip Program", "", "",
    programSegmentMap, utmProgramMap
  );

  // 딕셔너리 미스(둘 다 빈 map) — 기존 getBusinessSegment()와 완전히 동일해야 함
  // ("bofu" 리터럴 포함 + Google SA 채널 신호 없음 → BOFU, 오늘 세션 회귀 케이스)
  const missFallback = resolveBusinessSegmentPure_(
    "", "WF-2025-07-KOR-BOFU-Core B", "", "", {}, {}
  );
  const directFallback = getBusinessSegment("", "WF-2025-07-KOR-BOFU-Core B", "", "");

  // ⚠️ 회귀 케이스(2026-08-26, TEMPQA_034 diff로 발견) — campaign에 "sitelink"가
  // 있어 resolveDefiniteBusinessSegment_()가 이미 "Search"로 확정하는데, 같은
  // raw UTM이 UTM 딕셔너리를 거쳐 canonicalProgram으로 번역되고 그 Program이
  // programSegmentMap에서 "Webinar"로 매핑돼 있어도(오염된/다수결로 다른 값이
  // 채굴된 시나리오) **확정 신호가 이겨야 함** — 딕셔너리가 검증된 규칙을
  // 덮어쓰면 안 됨.
  const definiteBeatsDict = resolveBusinessSegmentPure_(
    "KR_core_2025_01_01_sitelink-ext-bookconsultv2_lead", "", "", "",
    programSegmentMap, utmProgramMap
  );

  // detail 비어있고 campaign(raw UTM, 확정 신호 없는 순수 슬러그)만 있는 경우 —
  // UTM 딕셔너리로 canonicalProgram 역매핑 후 Program_Segment_Dictionary
  // 조회 — programSegmentMap에 그 Program이 있으므로("Webinar") 딕셔너리 값 채택
  const utmDictHit = resolveBusinessSegmentPure_(
    "KR_core_2025-01-01_random-slug-xyz", "", "", "",
    programSegmentMap, utmProgramMap
  );

  const pass =
    hit === "Content" &&
    missFallback === directFallback &&
    missFallback === "BOFU" &&
    definiteBeatsDict === "Search" &&
    utmDictHit === "Webinar";

  Logger.log(
    "hit=" + hit + " missFallback=" + missFallback + " directFallback=" + directFallback +
    " definiteBeatsDict=" + definiteBeatsDict + " utmDictHit=" + utmDictHit
  );
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Resolve Business Segment (IO 래퍼, 2026-08-26 신규)
 *
 * WHY
 * MASTER_006_LeadTransformer.js/MASTER_007_MTATransformer.js가 기존
 * `getBusinessSegment(...)` 직접 호출 대신 이 함수를 호출하도록 전환하는
 * 것이 이번 작업의 핵심 진입점 — 두 캐시 map을 읽어(메모이제이션 적용,
 * 스크립트 실행 1회당 1번만 시트 읽음) `resolveBusinessSegmentPure_()`에
 * 위임한다. 두 캐시 시트가 모두 비어있으면(최초 배포 시점) 100% 기존
 * `getBusinessSegment()`와 동일하게 동작 — 배포 자체는 무위험.
 *
 * INPUT/OUTPUT: getBusinessSegment()와 완전히 동일한 시그니처.
 * ==========================================================
 */
function resolveBusinessSegment_(campaign, detail, leadSource, category){

  const programSegmentMap = readProgramSegmentDictionaryMap_();
  const utmProgramMap = readUtmProgramDictionaryMap_();

  return resolveBusinessSegmentPure_(campaign, detail, leadSource, category, programSegmentMap, utmProgramMap);

}


/**
 * ==========================================================
 * Periodic Refresh Dictionaries (트리거 핸들러, 2026-08-26 신규)
 *
 * WHY
 * UTM_Program_Dictionary → Program_Segment_Dictionary 순서로 재채굴한다
 * (Program_Segment_Dictionary는 Program명을 직접 Master에서 읽으므로 순서
 * 자체가 결과에 영향을 주진 않지만, "리드 분류 딕셔너리 2단계" 개념 순서를
 * 코드에도 반영). `AD_004_SpendCache.js`의 `periodicRefreshAdSpendCache_()`
 * 와 동일한 "트리거가 직접 호출하는 핸들러" 역할 — 리드 유입 파이프라인과는
 * 완전히 독립된 스케줄로 동작.
 * ==========================================================
 */
function periodicRefreshDictionaries_(){

  refreshUtmProgramDictionary_();
  refreshProgramSegmentDictionary_();

}


/**
 * ==========================================================
 * TEMP — periodicRefreshDictionaries_() 시간 트리거 설치(최초 1회 수동
 * 실행 전용, 2026-08-26 신규)
 *
 * WHY
 * `ScriptApp.newTrigger()`로 트리거를 설치하려면 Full Authorization이
 * 필요해 사람이 Apps Script 편집기에서 직접 한 번 Run 해야 한다
 * (AD_004_SpendCache.js의 runInstallAdSpendPeriodicRefreshTrigger()와 동일
 * 패턴). 재실행해도 안전하도록 설치 전 같은 핸들러의 기존 트리거를 먼저
 * 지운다(deleteTriggersByHandlerName_(), MASTER_002_PipelineAsync.js 재사용)
 * — 중복 설치 방지.
 * ==========================================================
 */
function runInstallDictionaryPeriodicRefreshTrigger(){

  deleteTriggersByHandlerName_("periodicRefreshDictionaries_");

  ScriptApp.newTrigger("periodicRefreshDictionaries_")
    .timeBased()
    .everyHours(CONFIG.DICTIONARY_REFRESH.PERIODIC_INTERVAL_HOURS)
    .create();

  Logger.log(
    CONFIG.LOG.PREFIX + " Dictionary(UTM_Program_Dictionary + Program_Segment_Dictionary) " +
    "주기적 갱신 트리거 등록 완료 (매 " + CONFIG.DICTIONARY_REFRESH.PERIODIC_INTERVAL_HOURS + "시간)."
  );

}
