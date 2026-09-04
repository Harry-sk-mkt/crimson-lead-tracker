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
 * v1.21.0
 *
 * Change Log
 * v1.21.0 (2026-09-05)
 * - **`runAuditEventsSegmentDeadKeys()`/`runDeleteDeadEventsOPSRows()`/
 *   `runDeleteDeadEventsOPSRowsForce()` 신규(`docs/OpenItems.md` #28)** —
 *   Content_OPS/Search_OPS와 동일한 "죽은 키" 구조적 문제(Business
 *   Segment 재분류로 더 이상 Webinar/Seminar가 아니게 된 프로그램이
 *   union 병합 구조상 Events_OPS에 남아 지표만 0으로 표시)가
 *   Events_OPS에도 있는지 확인할 방법이 없다는 게 발견돼(28번 항목
 *   등록 당시 "Events 전용 함수가 아직 없음"), `CONTENT_002_Engine.js`
 *   v1.2.0의 `runAuditContentSegmentDeadKeys()`/`runDeleteDeadContentOPSRows()`
 *   패턴을 그대로 복제 — Events는 GROUP_3_MANUAL이 빈 배열이고 "Channel"
 *   컬럼 자체가 없어 Content/BOFU의 Channel 기본값 예외 처리는 불필요
 *   (그 부분만 제외하고 로직 동일). `readEventsOPS_()`(`EVENTS_004_Merge.js`)
 *   기존 함수 재사용, 코드 변경 없음(순수 진단/삭제 유틸리티 추가).
 * v1.20.0 (2026-08-25)
 * - `aggregateMetaCampaignDataByProgram_()`에 `impressions`/`reach` 추가
 *   (additive) — `AD_001_Config.js` v1.22.0/`AD_002_Meta.js` v1.9.0에서
 *   Meta_Raw의 Impressions/Reach 컬럼을 새로 매핑한 것과 짝(사용자가
 *   Impressions/Reach도 원본에 있다고 확인, `runDebugMetaRawFirstRow()`로
 *   재검증). Clicks/Results와 동일하게 단순 합산(캠페인 간 겹치는 Reach를
 *   중복 제거하지 않는 근사치 — Clicks/Results도 동일한 한계).
 * v1.19.0 (2026-08-25)
 * - `aggregateMetaSpendByProgram_()`(v1.18.0에서 이번 세션에 막 추가,
 *   외부 안정 계약 아님)를 `aggregateMetaCampaignDataByProgram_()`로
 *   교체 — Spend 외 Clicks/Results/캠페인명 목록/캠페인 시작·종료일/진행중
 *   여부(hasOngoing)까지 한 번에 반환하도록 확장(사용자 요청 —
 *   BOFU_OPS/Content_OPS의 Campaign/Off-On/Start Date/End Date/Link
 *   clicks/Results 자동화, Spent에 이어 2단계). `BOFU_002_Engine.js`/
 *   `CONTENT_002_Engine.js`의 호출부도 이름/반환구조에 맞춰 갱신.
 * v1.18.0 (2026-08-25)
 * - `resolveMetaCampaignProgramKey_()`/`aggregateMetaSpendByProgram_()`
 *   신규(사용자 요청) — 기존 `resolveMetaCampaignEventsKey_()`/
 *   `aggregateMetaMetricsByEventsProgram_()`(Events 전용, EVENT_TYPE_PREFIXES
 *   필터 + `META_CAMPAIGN_NAME_TO_EVENTS_KEY_OVERRIDE` 내장)는 그대로 두고
 *   그 옆에 제네릭 버전을 추가 — eligibility 판정 함수를 인자로 받아
 *   BOFU_OPS/Content_OPS의 Spent 자동 집계(`BOFU_002_Engine.js`
 *   `computeBOFUMetaSpendAggregates_()`, `CONTENT_002_Engine.js`
 *   `computeContentMetaSpendAggregates_()`)가 재사용. 매칭/정규화 로직
 *   (`readUtmProgramDictionaryMap_()`/`stripLGSuffix_()`/
 *   `stripRegistrationFormSuffix_()`)은 기존 함수와 동일하게 재사용 —
 *   새로 만들지 않음.
 * v1.17.0 (2026-08-25)
 * - **버그 수정 — computeEventsDealAggregates_()에 Business Segment 필터가
 *   없었음**(Content_002_Engine.js에서 동일 패턴으로 먼저 발견, 사용자
 *   확인 후 Events도 함께 수정). Deal Tracker에 어떤 세그먼트로든 귀속된
 *   딜이 있으면 leadSourceDetail 문자열만 일치해도 Events_Engine의 allKeys
 *   합집합에 끼어들어 Webinar/Seminar가 아닌 프로그램(예: ebook 등)이
 *   Events_OPS에 노출될 수 있었음. BOFU_002_Engine.js computeBOFUDealAggregates_()
 *   의 `row.businessSegment` 필터 패턴을 그대로 적용 —
 *   `EVENTS.SEGMENTS.indexOf(row.businessSegment) === -1`이면 제외. 회귀
 *   테스트 testComputeEventsDealAggregates_() 갱신.
 * v1.16.0 (2026-08-21)
 * - **버그 수정 — `resolveMetaCampaignEventsKey_()`가 UTM_Program_Dictionary
 *   경유 프로그램명에 `stripLGSuffix_()`/`stripRegistrationFormSuffix_()`를
 *   적용 안 하고 있었음(사용자 발견)**. 이 프로젝트의 다른 모든 키 추출
 *   경로(MTA/Leads/Deal/Kakao 집계, `aggregateMTATouchRecords_()` 등)는
 *   전부 `stripLGSuffix_(stripRegistrationFormSuffix_(...))`를 거치는데,
 *   Meta 경로만 `applyEventsProgramKeyOverride_(dictProgram)`만 적용하고
 *   있어 — UTM_Program_Dictionary가 원문 그대로("...| Registered for
 *   Webinar from FB LG Form") 채굴해둔 프로그램명이 그대로 Engine 키로
 *   쓰이는 버그. Meta 지출(Spend/Clicks/Results)만 있고 SF 관련 지표는
 *   전부 0인 "유령" 프로그램 행이 Events_OPS에 나타나던 근본 원인
 *   (`EVENTS_004_Merge.js` v1.14.0/v1.14.1은 기존 OPS 시트 쪽만 정제했고,
 *   이 Engine 쪽 근본 원인은 미발견 상태였음). 두 strip 함수를 다른
 *   경로와 동일한 순서로 적용해 수정. `testResolveMetaCampaignEventsKey`/
 *   `testAggregateMetaMetricsByEventsProgram`에 접미사 포함 dictProgram
 *   케이스 추가.
 * v1.15.0 (2026-08-19)
 * - **Clicks/Results도 Meta에서 자동 집계(사용자 요청)**. `aggregateMetaSpendByEventsProgram_()`/
 *   `computeEventsMetaSpendAggregates_()`를 `aggregateMetaMetricsByEventsProgram_()`/
 *   `computeEventsMetaMetricsAggregates_()`로 교체(spend/clicks/results
 *   한 번의 순회로 같이 집계 — 셋 다 같은 키 해석 로직을 타므로 중복 순회
 *   방지) — `readMetaRawRows_()`가 이제 clicks/results도 반환
 *   (`AD_002_Meta.js` v1.8.0). CVR은 여기서 안 만듦 — GROUP_5_DERIVED로
 *   이동해 Results÷Clicks 시트 수식으로 계산(`EVENTS_001_Config.js`
 *   v1.11.0, 여러 캠페인이 한 프로그램으로 뭉칠 때 CVR 자체를 합산/평균
 *   내면 틀리기 때문). `refreshEventsEngine_()`의 rows 배열에 Clicks/
 *   Results 추가(GROUP_4_COMPUTED 순서와 일치하도록 Spent 바로 뒤에 배치).
 *   신규 테스트 `testAggregateMetaMetricsByEventsProgram`(기존
 *   `testAggregateMetaSpendByEventsProgram_` 대체).
 * v1.14.0 (2026-08-19)
 * - **Meta 지출 매칭을 UTM_Program_Dictionary 기반으로 확장(사용자 결정)**.
 *   전체 Meta_Raw 실측 결과 752개 캠페인·$1,828,805.85 중 수동 override
 *   3건(EXPO, $39,374.62)은 2%뿐이라 캠페인별 육안 대조가 비현실적임을
 *   확인 — `UTIL_002_UtmProgramDictionary.js`(Kakao Moments용으로 이미
 *   있던 UTM↔Marketo Program 자동 채굴 딕셔너리, MTA_Master + 신규
 *   Leads_Master 2개 소스, v1.4.0)를 재사용하기로 사용자 확정. 신규
 *   `resolveMetaCampaignEventsKey_()`(순수 함수) — 수동 override 최우선,
 *   없으면 딕셔너리(`readUtmProgramDictionaryMap_()`, 이미 모호한 UTM은
 *   제외돼 있음) + `isEligibleEventProgram_()`(비-이벤트 프로그램 오귀속
 *   방지) + `applyEventsProgramKeyOverride_()`(EXPO류 재정규화) 순으로
 *   해석. `aggregateMetaSpendByEventsProgram_()`가 `utmProgramDictionaryMap`
 *   파라미터를 받도록 확장(생략 시 override만, 기존 호출 하위 호환),
 *   `computeEventsMetaSpendAggregates_()`가 `readUtmProgramDictionaryMap_()`
 *   전달하도록 배선. 신규 테스트 `testResolveMetaCampaignEventsKey` 추가,
 *   기존 `testAggregateMetaSpendByEventsProgram_`도 딕셔너리 경유 케이스
 *   포함하도록 갱신.
 * v1.13.0 (2026-08-19)
 * - **Meta 광고비 자동 집계 신규(사용자 발견 — "Kor-EXPO-Master" Spent가
 *   너무 낮음)**. Spent(GROUP_4_COMPUTED)가 지금까지 Kakao Moments 비용만
 *   집계하고 있었음(v1.10.0부터, Meta는 "향후 예정"으로 미착수 상태였음).
 *   `TEMPQA_014_MetaExpoSpendAudit.js`로 Meta_Raw를 캠페인명 "expo"
 *   키워드로 실측한 결과 3개 캠페인·합계 $39,374.62(NZD) 확인(사용자
 *   확인). 신규 `META_CAMPAIGN_NAME_TO_EVENTS_KEY_OVERRIDE`(이 3개만
 *   매핑, Kakao처럼 프로그램 단위 매핑 컬럼이 없어 Naver 캠페인명 override와
 *   동일 관행 — 다른 프로그램 Meta 지출을 반영하려면 육안 대조 후 추가
 *   필요)/`aggregateMetaSpendByEventsProgram_()`(순수 함수)/
 *   `computeEventsMetaSpendAggregates_()`(IO 래퍼, `readMetaRawRows_()`
 *   재사용, "Amount spent (NZD)"가 이미 NZD라 환율 변환 불필요). `refreshEventsEngine_()`가
 *   이제 `kakaoSpendAgg[key] + metaSpendAgg[key]`를 Spent로 기록. 신규
 *   테스트 `testAggregateMetaSpendByEventsProgram_` 추가.
 * v1.12.0 (2026-08-19)
 * - `EVENTS_PROGRAM_KEY_OVERRIDE`/`applyEventsProgramKeyOverride_()` 신규
 *   (사용자 요청) — "Kor-EXPO-Master" 행사 하나가 채널/타겟팅별로 38개
 *   별도 Marketo Program으로 쪼개져 Events_OPS에 38개 행으로 나타나던
 *   문제. `SEARCH_UTM_TO_PROGRAM_OVERRIDE`(SEARCH_002_Engine.js)와 동일
 *   관행 — 사용자가 육안 대조해준 38개 프로그램명을 "Kor-EXPO-Master"로
 *   통합. `aggregateMTATouchRecords_()`/`aggregateLeadsRecords_()`/
 *   `computeEventsDealAggregates_()`/`aggregateKakaoSpendByProgram_()`
 *   4곳의 키 추출 단계(eligibility 체크 통과 직후)에 적용 — override
 *   대상은 원래도 전부 "EV-...-KOR-..." 패턴이라 eligibility 체크는
 *   override 이전 원본 키로 수행(override 결과인 "Kor-EXPO-Master" 자체는
 *   이 패턴이 아니라 eligibility를 통과 못 하므로 순서가 중요함). 기존
 *   Events_OPS에 이미 있는 38개 행의 Manual 컬럼 병합은 EVENTS_004_Merge.js
 *   쪽에서 처리(사용자 확정 — 숫자 컬럼은 합산, Notes는 연결).
 * v1.11.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `51_Events_Engine.js` → 신규 `EVENTS_002_Engine.js`, 코드 내용 변경 없음.
 * v1.11.0 (2026-08-06)
 * - **버그 수정 — Kakao Spent가 KRW 그대로 들어감(사용자 발견)**.
 *   `computeEventsKakaoSpendAggregates_()`가 `fetchKrwToNzdRate_()`/
 *   `convertSpendSummaryCurrency_()`(AD_004_SpendCache.js, Naver Search/
 *   Kakao Channel의 Ad_Spend_Cache 집계와 동일 패턴)로 NZD 변환하도록 수정.
 * v1.10.0 (2026-08-06)
 * - **`Spent` 자동 집계 추가(사용자 확정 — Spent를 GROUP_3_MANUAL→
 *   GROUP_4_COMPUTED로 전환, `50_Events_Config.js` v1.9.0)**. 신규
 *   `computeEventsKakaoSpendAggregates_()`(IO)/`aggregateKakaoSpendByProgram_()`
 *   (순수 함수) — `readKakaoSMSRawProgramCostRows_()`(AD_006_KakaoMoments.js
 *   v1.19.0)로 KakaoSMS_Raw의 `Marketo program`(수동 입력)+`Cost`를 읽어
 *   다른 Events 매칭과 동일한 키 정규화로 프로그램별 합산. `refreshEventsEngine_()`
 *   의 allKeys 수집/rows 배열에 kakaoSpendAgg 추가(EVENTS_ENGINE_HEADERS가
 *   GROUP_4_COMPUTED를 그대로 이어붙이므로 Spent가 자동으로 마지막 컬럼이 됨).
 *   테스트 추가. 향후 다른 플랫폼(Meta 등) 자동화 시 같은 패턴으로 합산 예정.
 * v1.9.0 (2026-08-06)
 * - stripLGSuffix_() 추가 — 사용자가 실제 중복 사례 발견: 같은 프로그램인데
 *   Marketo Program 이름이 " LG"로만 끝나는 변형이 별도 키로 잡혀 매칭이
 *   갈라짐(예: "...Ivy Love LG" vs "...Ivy Love"). 기존
 *   stripRegistrationFormSuffix_()가 처리하는 "| Registered for Webinar
 *   from FB LG Form" 패턴과는 다른 별개 케이스(그 문구 자체가 없이 그냥
 *   끝에 " LG" 토큰만 붙음) — 일반 규칙으로 처리하기로 사용자 확정
 *   (마케토 Program 이름이 " LG"로 끝나면 전부 그 접미사를 떼고 매칭).
 *   aggregateMTATouchRecords_()/aggregateLeadsRecords_()/
 *   computeEventsDealAggregates_()의 키 추출 단계에 stripRegistrationFormSuffix_()
 *   바로 다음 단계로 적용.
 * v1.8.0 (2026-07-28)
 * - #Deals/Revenue를 Leads_OPS(Opportunity Won Date/Revenue, 리드 단위)
 *   대신 Deal Tracker 기반으로 전환 (2트랙 아키텍처, CLAUDE.md #7).
 *   aggregateFunnelRecords_()에서 dealsWon/revenue 제거(icRequest/icBooked/
 *   icComplete만 유지). 신규 computeEventsDealAggregates_() —
 *   computeDealTrackerCountsByKey_()(90_TargetEngine.js)를 기존
 *   stripRegistrationFormSuffix_()+isEligibleEventProgram_() 키 정규화로
 *   감싸 재사용. refreshEventsEngine_() 배선 변경. 상세: docs/Changelog.md
 *   2026-07-28.
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
  const dealAgg = computeEventsDealAggregates_();
  const kakaoSpendAgg = computeEventsKakaoSpendAggregates_();
  const metaAgg = computeEventsMetaMetricsAggregates_();

  const allKeys = {};

  [
    mtaAgg.allRegistered, mtaAgg.p1All,
    leadsAgg.newRegistered, leadsAgg.nlP1,
    funnelAgg.icRequest, funnelAgg.icBooked,
    funnelAgg.icComplete, dealAgg.dealsWon, dealAgg.revenue,
    kakaoSpendAgg, metaAgg.spend, metaAgg.clicks, metaAgg.results
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
      dealAgg.dealsWon[key] || 0,
      dealAgg.revenue[key] || 0,
      (kakaoSpendAgg[key] || 0) + (metaAgg.spend[key] || 0),
      metaAgg.clicks[key] || 0,
      metaAgg.results[key] || 0
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

    const rawKey = stripLGSuffix_(stripRegistrationFormSuffix_(r[EVENTS.MATCH_FIELD.MTA]));

    if (!rawKey || !isEligibleEventProgram_(rawKey)) return;

    const key = applyEventsProgramKeyOverride_(rawKey);

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

    const rawKey = stripLGSuffix_(stripRegistrationFormSuffix_(r[EVENTS.MATCH_FIELD.LEADS]));

    if (!rawKey || !isEligibleEventProgram_(rawKey)) return;

    const key = applyEventsProgramKeyOverride_(rawKey);

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
 * Compute Funnel Aggregates (IC Request/Booked/Complete)
 *
 * WHY (하이브리드 소스 원칙, 2026-07-24 확정 / 2026-07-28 Deals·Revenue 분리)
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
 * Deals(Won)/Revenue는 2026-07-28부터 이 함수 책임이 아니다 — 2트랙
 * 아키텍처(CLAUDE.md #7)에 따라 Deal Tracker 기반으로 전환됨
 * (refreshEventsEngine_()의 computeDealTrackerCountsByKey_() 호출 참고,
 * 90_TargetEngine.js). Leads_OPS 리드 단위 매칭은 상담 후 학부모 이메일
 * 변경으로 신뢰 불가하다는 게 이미 확인됨.
 *
 * INPUT
 * leadIdToKey : Object  (computeLeadsAggregates_()의 결과)
 *
 * OUTPUT
 * { icRequest, icBooked, icComplete } (각 {utmKey: count})
 *
 * TEST
 * testComputeFunnelAggregates_ 참고
 * ==========================================================
 */
function computeFunnelAggregates_(leadIdToKey) {

  const icRequest = {};
  const icBooked = {};
  const icComplete = {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(OPS.SHEET.OPS);

  if (!sheet) return { icRequest, icBooked, icComplete };

  aggregateFunnelRecords_(
    sheetToObjects(sheet),
    leadIdToKey,
    icRequest, icBooked, icComplete
  );

  return { icRequest, icBooked, icComplete };

}


/**
 * ==========================================================
 * Aggregate Funnel Records (순수 함수, 테스트용으로 분리)
 * ==========================================================
 */
function aggregateFunnelRecords_(opsRecords, leadIdToKey, icRequest, icBooked, icComplete) {

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
    { "Lead ID": "L1", "Total IC Requests": 2, "IC Booked Date": new Date(2026, 0, 1), "IC Completed Date": "" },
    { "Lead ID": "L2", "Total IC Requests": 0, "IC Booked Date": "", "IC Completed Date": "" },
    { "Lead ID": "L3", "Total IC Requests": 1, "IC Booked Date": new Date(2026, 0, 1), "IC Completed Date": "" }  // leadIdToKey에 없음 (First Touch가 다른 세그먼트) → 제외
  ];

  const icRequest = {}, icBooked = {}, icComplete = {};

  aggregateFunnelRecords_(opsRecords, leadIdToKey, icRequest, icBooked, icComplete);

  const pass =
    icRequest["A_US-50"] === 1 &&
    icBooked["A_US-50"] === 1 &&
    icRequest["B"] === undefined &&
    Object.keys(icRequest).length === 1;

  Logger.log("Result: " + JSON.stringify({ icRequest, icBooked, icComplete }));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Events Deal Tracker Aggregates (#Deals/Revenue)
 *
 * WHY (2026-07-28, 2트랙 아키텍처 — CLAUDE.md #7)
 * #Deals/Revenue는 더 이상 Leads_OPS(Opportunity Won Date/Revenue, 리드
 * 단위)로 계산하지 않는다 — Deal Tracker 자체의 Lead Source Detail(프로그램명)
 * 을 기존 매칭 키와 동일하게 정규화(stripRegistrationFormSuffix_ +
 * isEligibleEventProgram_)해서 바로 집계한다. 리드 단위 조인이 필요 없어짐.
 *
 * OUTPUT
 * { dealsWon: {utmKey: count}, revenue: {utmKey: sum} }
 *
 * TEST
 * testComputeEventsDealAggregates_ 참고
 * ==========================================================
 */
function computeEventsDealAggregates_() {

  return computeDealTrackerCountsByKey_(readDealTrackerRawRows_(), function (row) {

    if (EVENTS.SEGMENTS.indexOf(row.businessSegment) === -1) return null;

    const rawKey = stripLGSuffix_(stripRegistrationFormSuffix_(row.leadSourceDetail));

    return (rawKey && isEligibleEventProgram_(rawKey)) ? applyEventsProgramKeyOverride_(rawKey) : null;

  });

}


/**
 * ==========================================================
 * TEST — computeEventsDealAggregates_()의 keyFn 로직
 * (실제 Deal Tracker I/O는 mock 불가 — computeDealTrackerCountsByKey_()
 * 자체 테스트는 90_TargetEngine.js의 testComputeDealTrackerCountsByKey_ 참고,
 * 여기선 Events 전용 keyFn 필터링만 검증)
 * ==========================================================
 */
function testComputeEventsDealAggregates_() {

  const dealRows = [
    { leadSourceDetail: "WB-2025-07-KOR-MOFU-Core A", revenue: 1000, businessSegment: "Webinar" },
    { leadSourceDetail: "WF-2025-07-KOR-MOFU-Core B", revenue: 500, businessSegment: "Webinar" },   // WF 제외 대상
    { leadSourceDetail: "WB-2025-07-US-MOFU-Core C", revenue: 300, businessSegment: "Webinar" },    // KOR 아님, 제외
    { leadSourceDetail: "WB-2025-07-KOR-MOFU-Core D", revenue: 777, businessSegment: "Content" }    // Webinar/Seminar 아님, 제외(회귀 방지)
  ];

  const keyFn = function (row) {
    if (EVENTS.SEGMENTS.indexOf(row.businessSegment) === -1) return null;
    const key = stripLGSuffix_(stripRegistrationFormSuffix_(row.leadSourceDetail));
    return (key && isEligibleEventProgram_(key)) ? key : null;
  };

  const result = computeDealTrackerCountsByKey_(dealRows, keyFn);

  const pass =
    result.revenue["WB-2025-07-KOR-MOFU-Core A"] === 1000 &&
    Object.keys(result.revenue).length === 1;

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Aggregate Kakao Spend By Program (순수 함수)
 *
 * WHY (2026-08-06)
 * KakaoSMS_Raw의 `Marketo program`(수동 입력, 실제 Marketo Program명)+
 * `Cost`를 다른 Events 매칭 로직과 동일한 방식(stripLGSuffix_+
 * stripRegistrationFormSuffix_+isEligibleEventProgram_)으로 정규화해
 * 프로그램별 Cost를 합산한다. 카카오 메시지 이름(UTM 스타일)과 이 매칭 키는
 * 서로 다른 네이밍 체계라 자동 매칭이 불가능함을 확인(exec-plan
 * 2026-08-04-kakao-moments-api-integration.md 참고) — 그래서 KakaoSMS_Raw의
 * Marketo program을 사람이 직접 채워야 하고, 이 컬럼이 비어있는 행은
 * readKakaoSMSRawProgramCostRows_()(AD_006_KakaoMoments.js)가 이미 제외한다.
 *
 * INPUT
 * records : Array<{marketoProgram, cost}>
 *
 * OUTPUT
 * Object  키 programKey → 합산 Cost
 *
 * TEST
 * testAggregateKakaoSpendByProgram 참고
 * ==========================================================
 */
function aggregateKakaoSpendByProgram_(records) {

  const spend = {};

  (records || []).forEach(function (r) {

    const rawKey = stripLGSuffix_(stripRegistrationFormSuffix_(r.marketoProgram));

    if (!rawKey || !isEligibleEventProgram_(rawKey)) return;

    const key = applyEventsProgramKeyOverride_(rawKey);

    spend[key] = (spend[key] || 0) + (Number(r.cost) || 0);

  });

  return spend;

}


/**
 * ==========================================================
 * TEST — aggregateKakaoSpendByProgram_()
 * ==========================================================
 */
function testAggregateKakaoSpendByProgram() {

  const records = [
    { marketoProgram: "WB-2025-07-KOR-MOFU-Core A", cost: 1000 },
    { marketoProgram: "WB-2025-07-KOR-MOFU-Core A", cost: 500 },   // 같은 프로그램 — 합산
    { marketoProgram: "WF-2025-07-KOR-MOFU-Core B", cost: 300 },   // WF 제외 대상
    { marketoProgram: "WB-2025-07-US-MOFU-Core C", cost: 200 }     // KOR 아님, 제외
  ];

  const result = aggregateKakaoSpendByProgram_(records);

  const pass =
    result["WB-2025-07-KOR-MOFU-Core A"] === 1500 &&
    Object.keys(result).length === 1;

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Events Kakao Spend Aggregates (IO 래퍼)
 *
 * WHY
 * `readKakaoSMSRawProgramCostRows_()`(AD_006_KakaoMoments.js)로 KakaoSMS_Raw를
 * 읽어 `aggregateKakaoSpendByProgram_()`로 정규화/집계 — `refreshEventsEngine_()`이
 * 다른 aggregate 함수들과 동일한 패턴으로 호출한다.
 *
 * **KRW→NZD 변환(2026-08-06, 사용자 확인)**: KakaoSMS_Raw의 Cost는 KRW 원본 —
 * Events_OPS의 다른 지표/Revenue와 통화 단위를 맞추기 위해 `fetchKrwToNzdRate_()`/
 * `convertSpendSummaryCurrency_()`(AD_004_SpendCache.js, Naver Search/Kakao
 * Channel의 Ad_Spend_Cache 집계 때와 동일한 GOOGLEFINANCE 우회 패턴)를 그대로
 * 재사용해 NZD로 변환한 값을 반환한다.
 *
 * OUTPUT
 * Object  키 programKey → 합산 Cost(NZD)
 * ==========================================================
 */
function computeEventsKakaoSpendAggregates_() {

  const spendKRW = aggregateKakaoSpendByProgram_(readKakaoSMSRawProgramCostRows_());
  const rate = fetchKrwToNzdRate_();

  return convertSpendSummaryCurrency_(spendKRW, rate);

}


/**
 * ==========================================================
 * Meta Campaign Name → Events Key Override
 *
 * WHY
 * Kakao(KakaoSMS_Raw)는 "Marketo program"이라는 수동 매핑 컬럼이 있어
 * 프로그램 단위로 바로 집계 가능하지만, Meta_Raw는 Meta Ads Manager
 * 자체 캠페인명(`AD.META.COLUMNS.CAMPAIGN_NAME`)만 있고 Marketo Program
 * 이름과 네임스페이스가 전혀 다르다(SEARCH_004_Merge.js의 Naver 캠페인명
 * 불일치와 동일 패턴) — 그래서 지금까지 Meta는 Events_OPS Spent 자동
 * 집계에서 완전히 빠져있었다(51_Events_Engine.js v1.10.0 changelog
 * "향후 다른 플랫폼(Meta 등) 자동화 시 같은 패턴으로 합산 예정" 참고).
 *
 * 사용자가 "Kor-EXPO-Master" Meta 지출이 실제보다 너무 낮게 보인다고
 * 지적(2026-08-19) — `TEMPQA_014_MetaExpoSpendAudit.js`로 Meta_Raw를
 * 캠페인명 "expo" 키워드로 훑어 실측한 결과 아래 3개 캠페인, 합계
 * $39,374.62(NZD)를 확인(사용자 확인). **2026-08-19 규모 재확인**: Meta_Raw
 * 전체는 752개 distinct 캠페인·$1,828,805.85(NZD)로, 이 3개(2%)만으로는
 * 턱없이 부족 — 캠페인 하나하나 육안 대조로 750개 가까이 처리하는 건
 * 비현실적이라고 판단, `UTIL_002_UtmProgramDictionary.js`(원래 Kakao
 * Moments용으로 만든 UTM↔Marketo Program 자동 채굴 딕셔너리, MTA_Master +
 * Leads_Master `First MKT UTM Campaign`↔`First Touch Detail`도 v1.4.0에서
 * 2차 소스로 추가됨)를 재사용해 스케일 문제 해결(사용자 결정) — 아래
 * `resolveMetaCampaignEventsKey_()` 참고. 이 override 맵은 **사람이 직접
 * 눈으로 확인한 3건만** 담고, 딕셔너리로 못 찾는 나머지에 대한 안전망
 * 역할로 남긴다(딕셔너리가 모호하거나 못 찾을 때도 이 3건은 항상 정확).
 *
 * TEST
 * testResolveMetaCampaignEventsKey 참고
 * ==========================================================
 */
const META_CAMPAIGN_NAME_TO_EVENTS_KEY_OVERRIDE = {
  "KR_core_2026-05-30_kr-expo-event_traffic": "Kor-EXPO-Master",
  "KR_core_2026-05-30_crimson-expo-meta_event-offline-fbiglg": "Kor-EXPO-Master",
  "KR_core_2026-05-30_crimson-expo-meta_event-offline": "Kor-EXPO-Master"
};


/**
 * ==========================================================
 * Resolve Meta Campaign Events Key (순수 함수)
 *
 * WHY
 * 캠페인명(Meta Ads Manager 자체 이름)을 Events_OPS 키(Marketo Program명,
 * override 적용 후)로 변환하는 단일 지점. 우선순위: (1) 사람이 직접 확인한
 * META_CAMPAIGN_NAME_TO_EVENTS_KEY_OVERRIDE(항상 정확, 최우선) → (2)
 * UTM_Program_Dictionary(자동 채굴, `readUtmProgramDictionaryMap_()`가
 * 이미 distinctProgramCount===1인 것만 반환하므로 모호한 건 여기 안 옴) —
 * 다만 이 프로젝트 Marketo Program 명명 규칙(`{TYPE}-{YYYY}-{MM}-{COUNTRY}-...`)에
 * 안 맞는(비-이벤트 콘텐츠 등) 딕셔너리 결과는 isEligibleEventProgram_()로
 * 걸러낸다 — 어차피 Events_OPS 대상이 아닌 프로그램에 지출이 잘못
 * 붙는 걸 방지. 마지막으로 applyEventsProgramKeyOverride_()를 한 번 더
 * 통과시켜(예: 딕셔너리가 EXPO 38개 변형 중 하나를 찾아내도) 최종
 * 통합 키로 정규화.
 *
 * **2026-08-21 버그 수정**: UTM_Program_Dictionary는 MTA_Master/
 * Leads_Master의 "Lead Source Detail"/"First Touch Detail" 원본값을
 * 그대로 채굴하므로("| Registered for Webinar from FB LG Form" 접미사가
 * 안 떼진 채) `dictProgram`에도 그 접미사가 그대로 남아있을 수 있음 —
 * 다른 모든 키 추출 경로(MTA/Leads/Deal/Kakao 집계)는 전부
 * `stripLGSuffix_(stripRegistrationFormSuffix_(...))`를 거치는데 여기만
 * 빠져 있어, Meta 지출이 이 경로로 들어오면 접미사 안 뗀 원문이 그대로
 * Engine 키가 돼 SF 지표는 0이고 Spend/Clicks만 있는 "유령" 프로그램
 * 행이 Events_OPS에 나타나는 버그가 있었음(사용자 발견) — 동일한 순서로
 * strip 적용해 수정.
 *
 * INPUT
 * campaignName            : string
 * utmProgramDictionaryMap : Object  (readUtmProgramDictionaryMap_() 결과,
 *                             {utmKeyLower: Marketo Program명})
 *
 * OUTPUT
 * string|null  (매칭 실패 시 null)
 *
 * TEST
 * testResolveMetaCampaignEventsKey 참고
 * ==========================================================
 */
function resolveMetaCampaignEventsKey_(campaignName, utmProgramDictionaryMap) {

  const name = String(campaignName || "").trim();

  if (!name) return null;

  const manualKey = META_CAMPAIGN_NAME_TO_EVENTS_KEY_OVERRIDE[name];

  if (manualKey) return manualKey;

  const dict = utmProgramDictionaryMap || {};
  const dictProgram = stripLGSuffix_(stripRegistrationFormSuffix_(dict[name.toLowerCase()]));

  if (!dictProgram || !isEligibleEventProgram_(dictProgram)) return null;

  return applyEventsProgramKeyOverride_(dictProgram);

}


/**
 * ==========================================================
 * TEST — resolveMetaCampaignEventsKey_()
 * ==========================================================
 */
function testResolveMetaCampaignEventsKey() {

  const dict = {
    "kr_core_2026-05-30_some-other-expo-variant_lead": "EV-2026-05-KOR-MOFU-Core Expo Naver DA-General", // 딕셔너리 경유 → override로 재정규화
    "kr_core_2026-01-01_some-program_lead": "EV-2026-01-KOR-MOFU-Core Some Program",                     // 딕셔너리 경유, override 대상 아님
    "kr_core_2026-01-01_wf-content_lead": "WF-2026-01-KOR-MOFU-Core Some Ebook",                         // WF라 이벤트 부적격 — 제외돼야 함
    "kr_core_2026-08-01_fb-lg-form_lead": "WB-2026-08-KOR-MOFU-Core College Research: HYPS & IvyㅣRegistered for Webinar from FB LG Form" // 접미사 안 떼진 딕셔너리 원본값 — strip 후 매칭돼야 함(2026-08-21 버그 수정)
  };

  const pass =
    resolveMetaCampaignEventsKey_("KR_core_2026-05-30_kr-expo-event_traffic", dict) === "Kor-EXPO-Master" && // 수동 override 최우선
    resolveMetaCampaignEventsKey_("KR_core_2026-05-30_some-other-expo-variant_lead", dict) === "Kor-EXPO-Master" && // 딕셔너리 → override 재정규화
    resolveMetaCampaignEventsKey_("KR_core_2026-01-01_some-program_lead", dict) === "EV-2026-01-KOR-MOFU-Core Some Program" &&
    resolveMetaCampaignEventsKey_("KR_core_2026-01-01_wf-content_lead", dict) === null &&
    resolveMetaCampaignEventsKey_("KR_core_2026-01-01_unmatched_lead", dict) === null &&
    resolveMetaCampaignEventsKey_("", dict) === null &&
    resolveMetaCampaignEventsKey_("KR_core_2026-08-01_fb-lg-form_lead", dict) ===
      "WB-2026-08-KOR-MOFU-Core College Research: HYPS & Ivy";

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Aggregate Meta Metrics By Events Program (순수 함수)
 *
 * WHY
 * Spent/Clicks/Results 셋 다 같은 캠페인→Events 키 해석
 * (resolveMetaCampaignEventsKey_())을 거쳐야 하므로, 한 번의 순회로
 * 셋 다 같이 합산(각각 따로 순회하지 않음). CVR은 여기서 만들지 않음 —
 * 여러 캠페인이 한 프로그램으로 뭉칠 때(EXPO 등) 개별 CVR을 합치거나
 * 평균 내면 통계적으로 틀리므로, Results÷Clicks를 Events_OPS 쪽에서
 * 시트 수식(GROUP_5_DERIVED, RATIO_FORMULAS)으로 매번 다시 계산한다
 * (`EVENTS_001_Config.js` v1.11.0).
 *
 * INPUT
 * records                 : Object[]  (readMetaRawRows_() 결과,
 *                             {campaignName, spent, clicks, results, ...})
 * utmProgramDictionaryMap : Object  (readUtmProgramDictionaryMap_() 결과, 선택 —
 *                             생략 시 수동 override만 사용)
 *
 * OUTPUT
 * { spend: {eventsKey: totalSpentNZD}, clicks: {eventsKey: totalClicks},
 *   results: {eventsKey: totalResults} }  (Meta의 "Amount spent (NZD)"는
 * 이미 NZD라 Kakao와 달리 환율 변환 불필요)
 *
 * TEST
 * testAggregateMetaMetricsByEventsProgram 참고
 * ==========================================================
 */
function aggregateMetaMetricsByEventsProgram_(records, utmProgramDictionaryMap) {

  const spend = {};
  const clicks = {};
  const results = {};

  (records || []).forEach(function (r) {

    const key = resolveMetaCampaignEventsKey_(r.campaignName, utmProgramDictionaryMap);

    if (!key) return;

    spend[key] = (spend[key] || 0) + (Number(r.spent) || 0);
    clicks[key] = (clicks[key] || 0) + (Number(r.clicks) || 0);
    results[key] = (results[key] || 0) + (Number(r.results) || 0);

  });

  return { spend: spend, clicks: clicks, results: results };

}


/**
 * ==========================================================
 * TEST — aggregateMetaMetricsByEventsProgram_()
 * ==========================================================
 */
function testAggregateMetaMetricsByEventsProgram() {

  const dict = {
    "kr_core_2026-06-01_some-other-program_lead": "EV-2026-06-KOR-MOFU-Core Some Other Program"
  };

  const records = [
    { campaignName: "KR_core_2026-05-30_kr-expo-event_traffic", spent: 3137.98, clicks: 100, results: 20 },
    { campaignName: "KR_core_2026-05-30_crimson-expo-meta_event-offline-fbiglg", spent: 26098.17, clicks: 800, results: 150 },
    { campaignName: "KR_core_2026-05-30_crimson-expo-meta_event-offline", spent: 10138.47, clicks: 300, results: 50 },
    { campaignName: "KR_core_2026-06-01_some-other-program_lead", spent: 500, clicks: 10, results: 2 },
    { campaignName: "KR_core_2026-05-30_unrelated_campaign", spent: 999, clicks: 5, results: 1 }
  ];

  const result = aggregateMetaMetricsByEventsProgram_(records, dict);

  const pass =
    Math.abs(result.spend["Kor-EXPO-Master"] - 39374.62) < 0.01 &&
    result.clicks["Kor-EXPO-Master"] === 1200 &&
    result.results["Kor-EXPO-Master"] === 220 &&
    Math.abs(result.spend["EV-2026-06-KOR-MOFU-Core Some Other Program"] - 500) < 0.01 &&
    result.clicks["EV-2026-06-KOR-MOFU-Core Some Other Program"] === 10 &&
    Object.keys(result.spend).length === 2;

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Events Meta Metrics Aggregates (IO 래퍼)
 * ==========================================================
 */
function computeEventsMetaMetricsAggregates_() {

  return aggregateMetaMetricsByEventsProgram_(readMetaRawRows_(), readUtmProgramDictionaryMap_());

}


/**
 * ==========================================================
 * Resolve Meta Campaign Program Key (순수 함수, 도메인 무관 제네릭 버전)
 *
 * WHY
 * `resolveMetaCampaignEventsKey_()`와 동일한 매칭 로직(UTM_Program_Dictionary
 * + 접미사 정규화)이지만, Events 전용 하드코딩(EVENT_TYPE_PREFIXES 필터,
 * `META_CAMPAIGN_NAME_TO_EVENTS_KEY_OVERRIDE`, `applyEventsProgramKeyOverride_()`
 * EXPO 변형 통합)이 없다 — BOFU/Content는 "1 Program = 1 Meta Campaign"이라
 * 변형 통합이 불필요하고, 자격 판정 기준도 도메인마다 달라(Business
 * Segment) 호출자가 `isEligibleProgram` predicate로 직접 넘긴다(2026-08-25
 * 사용자 요청 — Content_OPS/BOFU_OPS Spent 자동 집계).
 *
 * INPUT
 * campaignName            : string  (Meta Ads Manager 자체 캠페인명)
 * utmProgramDictionaryMap : Object  (readUtmProgramDictionaryMap_() 결과)
 * isEligibleProgram        : function(programName: string): boolean
 *
 * OUTPUT
 * string|null  (매칭 실패/자격 미달 시 null)
 *
 * TEST
 * testResolveMetaCampaignProgramKey 참고
 * ==========================================================
 */
function resolveMetaCampaignProgramKey_(campaignName, utmProgramDictionaryMap, isEligibleProgram) {

  const name = String(campaignName || "").trim();

  if (!name) return null;

  const dict = utmProgramDictionaryMap || {};
  const dictProgram = stripLGSuffix_(stripRegistrationFormSuffix_(dict[name.toLowerCase()]));

  if (!dictProgram || !isEligibleProgram(dictProgram)) return null;

  return dictProgram;

}


/**
 * ==========================================================
 * TEST — resolveMetaCampaignProgramKey_()
 * ==========================================================
 */
function testResolveMetaCampaignProgramKey() {

  const dict = {
    "kr_core_2026-01-01_some-ebook_lead": "WF-2026-01-KOR-MOFU-Core Some Ebook",
    "kr_core_2026-01-01_some-webinar_lead": "WB-2026-01-KOR-MOFU-Core Some WebinarㅣRegistered for Webinar from FB LG Form"
  };

  const onlyWF = function (programName) { return String(programName).indexOf("WF-") === 0; };

  const pass =
    resolveMetaCampaignProgramKey_("kr_core_2026-01-01_some-ebook_lead", dict, onlyWF) ===
      "WF-2026-01-KOR-MOFU-Core Some Ebook" &&
    resolveMetaCampaignProgramKey_("kr_core_2026-01-01_some-webinar_lead", dict, onlyWF) === null &&
    resolveMetaCampaignProgramKey_("kr_core_2026-01-01_unmatched_lead", dict, onlyWF) === null &&
    resolveMetaCampaignProgramKey_("", dict, onlyWF) === null;

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Aggregate Meta Campaign Data By Program (순수 함수, 도메인 무관 제네릭 버전)
 *
 * WHY
 * `aggregateMetaMetricsByEventsProgram_()`의 제네릭 버전 — Spend/Clicks/
 * Results뿐 아니라 캠페인명 목록(BOFU_OPS/Content_OPS "Campaign" 컬럼용,
 * 쉼표로 join해 표시, 사용자 확정)/캠페인 시작일 최소값/종료일 최댓값
 * ("Start Date"/"End Date" 컬럼용)/종료일 없는 캠페인 존재 여부("Off/On"
 * 판정용, hasOngoing)까지 한 번의 순회로 같이 계산한다(2026-08-25 사용자
 * 요청 — Impressions/Reach 제외 나머지 GROUP_3_MANUAL 필드 자동화).
 * 이전 버전(Spend만 반환하던 `aggregateMetaSpendByProgram_()`, 같은
 * 세션에 추가돼 BOFU/Content Engine에서만 쓰이던 내부 함수)을 대체 —
 * 외부에 노출된 안정 계약이 아니라 이름 변경/구조 확장에 하위호환 부담
 * 없음. Meta_Raw의 정밀/분배 export 이중계상 방지
 * (`aggregateMetaSpendByFYMonthSegment_()`, AD_002_Meta.js)는 여기서도
 * 재사용하지 않음 — 기존 `aggregateMetaMetricsByEventsProgram_()`도
 * 동일하게 단순 합산만 하고 있어(이미 실사용 중) 일관성을 맞춘다.
 *
 * INPUT
 * records                 : Object[]  (readMetaRawRows_() 결과 —
 *                             {campaignName, spent, clicks, results,
 *                              campaignStart, campaignEnd, ...})
 * utmProgramDictionaryMap : Object   (readUtmProgramDictionaryMap_() 결과)
 * isEligibleProgram        : function(programName: string): boolean
 *
 * OUTPUT
 * {
 *   spend: {programKey: totalSpentNZD}, clicks: {programKey: totalClicks},
 *   results: {programKey: totalResults},
 *   impressions: {programKey: totalImpressions}, reach: {programKey: totalReach},
 *   campaignNames: {programKey: string[]} (중복 제거된 Meta 캠페인명 목록),
 *   campaignStart: {programKey: Date} (매칭된 캠페인들의 최소 시작일),
 *   campaignEnd: {programKey: Date} (매칭된 캠페인들의 최대 종료일,
 *     종료일이 있는 캠페인만 반영),
 *   hasOngoing: {programKey: true} (매칭된 캠페인 중 종료일 없는 게
 *     하나라도 있으면 true — "아직 진행 중" 신호)
 * }
 *
 * TEST
 * testAggregateMetaCampaignDataByProgram 참고
 * ==========================================================
 */
function aggregateMetaCampaignDataByProgram_(records, utmProgramDictionaryMap, isEligibleProgram) {

  const spend = {};
  const clicks = {};
  const results = {};
  const impressions = {};
  const reach = {};
  const campaignNames = {};
  const campaignStart = {};
  const campaignEnd = {};
  const hasOngoing = {};

  (records || []).forEach(function (r) {

    const key = resolveMetaCampaignProgramKey_(r.campaignName, utmProgramDictionaryMap, isEligibleProgram);

    if (!key) return;

    spend[key] = (spend[key] || 0) + (Number(r.spent) || 0);
    clicks[key] = (clicks[key] || 0) + (Number(r.clicks) || 0);
    results[key] = (results[key] || 0) + (Number(r.results) || 0);
    impressions[key] = (impressions[key] || 0) + (Number(r.impressions) || 0);
    reach[key] = (reach[key] || 0) + (Number(r.reach) || 0);

    if (!campaignNames[key]) campaignNames[key] = [];

    if (campaignNames[key].indexOf(r.campaignName) === -1) {
      campaignNames[key].push(r.campaignName);
    }

    const hasStart = r.campaignStart instanceof Date && !isNaN(r.campaignStart.getTime());

    if (hasStart && (!campaignStart[key] || r.campaignStart < campaignStart[key])) {
      campaignStart[key] = r.campaignStart;
    }

    const hasEnd = r.campaignEnd instanceof Date && !isNaN(r.campaignEnd.getTime());

    if (hasEnd) {

      if (!campaignEnd[key] || r.campaignEnd > campaignEnd[key]) {
        campaignEnd[key] = r.campaignEnd;
      }

    } else {

      hasOngoing[key] = true;

    }

  });

  return {
    spend: spend,
    clicks: clicks,
    results: results,
    impressions: impressions,
    reach: reach,
    campaignNames: campaignNames,
    campaignStart: campaignStart,
    campaignEnd: campaignEnd,
    hasOngoing: hasOngoing
  };

}


/**
 * ==========================================================
 * TEST — aggregateMetaCampaignDataByProgram_()
 * ==========================================================
 */
function testAggregateMetaCampaignDataByProgram() {

  const dict = {
    "kr_core_2026-01-01_some-ebook_lead": "WF-2026-01-KOR-MOFU-Core Some Ebook",
    "kr_core_2026-01-05_some-ebook-v2_lead": "WF-2026-01-KOR-MOFU-Core Some Ebook",
    "kr_core_2026-02-01_ongoing-ebook_lead": "WF-2026-02-KOR-MOFU-Core Ongoing Ebook"
  };

  const onlyWF = function (programName) { return String(programName).indexOf("WF-") === 0; };

  const records = [
    {
      campaignName: "KR_core_2026-01-01_some-ebook_lead", spent: 100, clicks: 10, results: 2,
      impressions: 1000, reach: 800,
      campaignStart: new Date(2026, 0, 1), campaignEnd: new Date(2026, 0, 31)
    },
    {
      campaignName: "KR_core_2026-01-05_some-ebook-v2_lead", spent: 50, clicks: 5, results: 1,
      impressions: 500, reach: 400,
      campaignStart: new Date(2026, 0, 5), campaignEnd: new Date(2026, 1, 10)
    },
    {
      campaignName: "KR_core_2026-02-01_ongoing-ebook_lead", spent: 30, clicks: 3, results: 0,
      impressions: 200, reach: 150,
      campaignStart: new Date(2026, 1, 1), campaignEnd: null
    },
    { campaignName: "KR_core_2026-01-01_unmatched_lead", spent: 999, clicks: 1, results: 0, impressions: 100, reach: 90 }
  ];

  const result = aggregateMetaCampaignDataByProgram_(records, dict, onlyWF);

  const ebookKey = "WF-2026-01-KOR-MOFU-Core Some Ebook";
  const ongoingKey = "WF-2026-02-KOR-MOFU-Core Ongoing Ebook";

  const pass =
    result.spend[ebookKey] === 150 &&
    result.clicks[ebookKey] === 15 &&
    result.results[ebookKey] === 3 &&
    result.impressions[ebookKey] === 1500 &&
    result.reach[ebookKey] === 1200 &&
    result.campaignNames[ebookKey].length === 2 &&
    result.campaignStart[ebookKey].getTime() === new Date(2026, 0, 1).getTime() &&
    result.campaignEnd[ebookKey].getTime() === new Date(2026, 1, 10).getTime() &&
    !result.hasOngoing[ebookKey] &&
    result.hasOngoing[ongoingKey] === true &&
    result.campaignEnd[ongoingKey] === undefined &&
    Object.keys(result.spend).length === 2;

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
 * Strip LG Suffix
 *
 * WHY
 * 사용자가 실제 중복 사례 발견(2026-08-06): "WB-2026-05-KOR-MOFU-Core
 * Profiles HYPS and Ivy Love LG"와 "WB-2026-05-KOR-MOFU-Core Profiles
 * HYPS and Ivy Love"가 같은 프로그램인데 끝의 " LG" 토큰 하나 때문에
 * 서로 다른 매칭 키로 갈라짐. stripRegistrationFormSuffix_()가 처리하는
 * "| Registered for Webinar from FB LG Form" 패턴과는 별개 케이스(그
 * 문구 자체가 없음) — 마케토 Program 이름이 " LG"로 끝나는 경우 전부
 * 이 접미사를 떼고 매칭하는 일반 규칙으로 처리하기로 사용자 확정.
 *
 * INPUT
 * programName : string
 *
 * OUTPUT
 * string  (끝의 " LG" 토큰 제거된 이름, 패턴 불일치 시 원문 trim만)
 *
 * TEST
 * testStripLGSuffix 참고
 * ==========================================================
 */
function stripLGSuffix_(programName) {

  const str = String(programName || "").trim();

  return str.replace(/\s+LG$/, "").trim();

}


/**
 * ==========================================================
 * TEST — stripLGSuffix_()
 * ==========================================================
 */
function testStripLGSuffix() {

  const pass =
    stripLGSuffix_(
      "WB-2026-05-KOR-MOFU-Core Profiles HYPS and Ivy Love LG"
    ) === "WB-2026-05-KOR-MOFU-Core Profiles HYPS and Ivy Love" &&
    stripLGSuffix_(
      "WB-2026-05-KOR-MOFU-Core Profiles HYPS and Ivy Love"
    ) === "WB-2026-05-KOR-MOFU-Core Profiles HYPS and Ivy Love" &&
    stripLGSuffix_("") === "";

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Events Program Key Override (Marketo Program명 여러 개 → 단일 키 통합)
 *
 * WHY
 * "Kor-EXPO-Master"(2026 KOR 오프라인 EXPO 행사)가 채널/날짜/타겟팅별로
 * Marketo Program이 38개나 별도로 생성돼(META/META UK/Naver DA 세부
 * 타겟팅/Kakao Channel/Webinar/Seminar 등, 실제로는 전부 같은 행사)
 * Events_OPS에 38개 행으로 쪼개져 나타나는 문제 — 사용자가 육안으로
 * 확인한 목록을 그대로 반영(SEARCH_UTM_TO_PROGRAM_OVERRIDE/
 * NAVER_CAMPAIGN_NAME_TO_SEARCH_OPS_KEY_OVERRIDE와 동일 관행,
 * SEARCH_004_Merge.js 참고). stripLGSuffix_/stripRegistrationFormSuffix_로
 * 정제된 canonical 키에 적용 — 이 목록에 없는 프로그램명은 원래 키 그대로
 * 통과(안전망).
 *
 * TEST
 * testApplyEventsProgramKeyOverride 참고
 * ==========================================================
 */
const EVENTS_PROGRAM_KEY_OVERRIDE = {

  "EV-2026-04-KOR-MOFU-Core EXPO META": "Kor-EXPO-Master",
  "EV-2026-04-KOR-MOFU-Core EXPO META UK": "Kor-EXPO-Master",
  "EV-2026-04-KOR-MOFU-Core EXPO Indigo": "Kor-EXPO-Master",
  "EV-2026-05-KOR-MOFU-Core Expo Naver Blog": "Kor-EXPO-Master",
  "EV-2026-05-KOR-MOFU-Core EXPO Kakao Channel": "Kor-EXPO-Master",
  "EV-2026-05-KOR-MOFU-Core Expo Naver DA-General": "Kor-EXPO-Master",
  "EV-2026-05-KOR-MOFU-Core Expo Naver DA-Retargeting": "Kor-EXPO-Master",
  "EV-2026-05-KOR-MOFU-Core Expo Naver DA-HS to Harvard": "Kor-EXPO-Master",
  "EV-2026-05-KOR-MOFU-Core Expo Naver DA-FAO Martin": "Kor-EXPO-Master",
  "EV-2026-04-KOR-MOFU-Core Expo Naver DA-FAO Martin": "Kor-EXPO-Master",
  "EV-2026-04-KOR-MOFU-Core EXPO Naver Cafe 2": "Kor-EXPO-Master",
  "EV-2026-04-KOR-MOFU-Core EXPO Seminar 2": "Kor-EXPO-Master",
  "EV-2026-04-KOR-MOFU-Core Expo Naver DA-HS to Harvard (Sunday)": "Kor-EXPO-Master",
  "EV-2026-04-KOR-MOFU-Core Expo Naver DA-HS to Stanford": "Kor-EXPO-Master",
  "EV-2026-04-KOR-MOFU-Core Expo Naver DA-HS to Harvard": "Kor-EXPO-Master",
  "EV-2026-04-KOR-MOFU-Core Expo Webinar 2": "Kor-EXPO-Master",
  "EV-2026-04-KOR-MOFU-Core Expo Naver DA-HS to Harvard (Date)": "Kor-EXPO-Master",
  "EV-2026-04-KOR-MOFU-Core EXPO Seminar": "Kor-EXPO-Master",
  "EV-2026-04-KOR-MOFU-Core Expo Invitation": "Kor-EXPO-Master",
  "EV-2026-04-KOR-MOFU-Core EXPO Kakao Channel": "Kor-EXPO-Master",
  "EV-2026-04-KOR-MOFU-Core EXPO Naver Cafe": "Kor-EXPO-Master",
  "EV-2026-04-KOR-MOFU-Core EXPO Kakao DA Hs to DS": "Kor-EXPO-Master",
  "EV-2026-04-KOR-MOFU-Core EXPO Kakao Channel.": "Kor-EXPO-Master",
  "EV-2026-04-KOR-MOFU-Core EXPO META.": "Kor-EXPO-Master",
  "EV-2026-03-KOR-MOFU-Core Expo Naver DA-Grade 7 to Yale": "Kor-EXPO-Master",
  "EV-2026-03-KOR-MOFU-Core EXPO Kakao DA UHak GPA": "Kor-EXPO-Master",
  "EV-2026-03-KOR-MOFU-Core Expo Naver DA-HS to Yale": "Kor-EXPO-Master",
  "EV-2026-03-KOR-MOFU-Core Expo Naver DA-HS to Princeton": "Kor-EXPO-Master",
  "EV-2026-03-KOR-MOFU-Core Expo Naver DA-Grade 7 to Harvard": "Kor-EXPO-Master",
  "EV-2026-03-KOR-MOFU-Core Expo Naver DA-Grade 7 to Stanford": "Kor-EXPO-Master",
  "EV-2026-03-KOR-MOFU-Core Expo Webinar": "Kor-EXPO-Master",
  "EV-2026-03-KOR-MOFU-Core Expo Naver DA-HS to Stanford": "Kor-EXPO-Master",
  "EV-2026-03-KOR-MOFU-Core Expo Naver DA-HS to DS Value LP": "Kor-EXPO-Master",
  "EV-2026-03-KOR-MOFU-Core Expo Webinar (3/11)": "Kor-EXPO-Master",
  "EV-2026-03-KOR-MOFU-Core Expo Naver DA-HS to DS": "Kor-EXPO-Master",
  "EV-2026-03-KOR-MOFU-Core EXPO Kakao DA Native": "Kor-EXPO-Master",
  "EV-2026-03-KOR-MOFU-Core EXPO Naver DA-UHak Guarantee (Student)": "Kor-EXPO-Master",
  "EV-2026-03-KOR-MOFU-Core EXPO Kakao DA": "Kor-EXPO-Master"

};


function applyEventsProgramKeyOverride_(key) {

  return EVENTS_PROGRAM_KEY_OVERRIDE[key] || key;

}


/**
 * ==========================================================
 * TEST — applyEventsProgramKeyOverride_()
 * ==========================================================
 */
function testApplyEventsProgramKeyOverride() {

  const pass =
    applyEventsProgramKeyOverride_("EV-2026-04-KOR-MOFU-Core EXPO META") === "Kor-EXPO-Master" &&
    applyEventsProgramKeyOverride_("EV-2026-03-KOR-MOFU-Core EXPO Kakao DA") === "Kor-EXPO-Master" &&
    applyEventsProgramKeyOverride_("EV-2025-07-KOR-MOFU-Core Unrelated Program") === "EV-2025-07-KOR-MOFU-Core Unrelated Program" &&
    applyEventsProgramKeyOverride_("") === "";

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


/**
 * ==========================================================
 * Audit Events Segment Dead Keys (1회성 진단, 수동 실행용)
 *
 * WHY
 * mergeEventsOPS_()(EVENTS_004_Merge.js)가 "현재 Events_Engine 키 ∪
 * 기존 Events_OPS 키" 합집합으로 병합하기 때문에, Business Segment
 * 재분류(Full Rebuild 등)로 더 이상 Webinar/Seminar가 아니게 된
 * 프로그램은 Events_Engine에서 사라져도 Events_OPS엔 그대로 남아
 * 지표만 0으로 표시됨 — Search_OPS/Content_OPS와 동일한 구조적 문제
 * (`CONTENT_002_Engine.js`의 `runAuditContentSegmentDeadKeys()`와 동일
 * 패턴, `docs/OpenItems.md` #28). 수동 컬럼(GROUP_1_MANUAL/GROUP_2_MANUAL,
 * Events는 GROUP_3_MANUAL이 빈 배열이고 "Channel" 컬럼 자체가 없어
 * Content/BOFU의 Channel 기본값 예외 처리는 불필요)에 실제 데이터가
 * 있는지로 "완전 공백(삭제 안전)" vs "데이터 있음(검토 필요)" 구분.
 *
 * 코드 변경 없음(getBusinessSegment() 등 기존 로직 그대로) — 순수 진단.
 * ==========================================================
 */
function runAuditEventsSegmentDeadKeys() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const engineSheet = ss.getSheetByName(EVENTS.SHEET.ENGINE);
  const opsSheet = ss.getSheetByName(EVENTS.SHEET.OPS);

  Logger.log("======================================");
  Logger.log("Audit Events Segment Dead Keys");
  Logger.log("======================================");

  const liveKeys = {};

  if (engineSheet) {

    sheetToObjects(engineSheet).forEach(function (r) {
      const key = String(r[EVENTS.KEY] || "").trim().toLowerCase();
      if (key) liveKeys[key] = true;
    });

  }

  if (!opsSheet) {
    Logger.log(EVENTS.SHEET.OPS + " sheet not found — skipped.");
    return;
  }

  const opsRows = readEventsOPS_();
  const manualCols = EVENTS.GROUP_1_MANUAL
    .concat(EVENTS.GROUP_2_MANUAL)
    .concat(EVENTS.GROUP_3_MANUAL);

  let deadCount = 0;
  let deadWithManualData = 0;

  opsRows.forEach(function (row) {

    const key = String(row[EVENTS.KEY] || "").trim();

    if (!key) return;
    if (liveKeys[key.toLowerCase()]) return; // 살아있음 — 스킵

    deadCount++;

    const manualValues = {};
    let hasManualData = false;

    manualCols.forEach(function (col) {

      const v = row[col];
      manualValues[col] = v;

      if (v !== "" && v !== 0 && v !== undefined && v !== null) {
        hasManualData = true;
      }

    });

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
 * Run Delete Dead Events_OPS Rows (수동 실행용)
 *
 * WHY
 * runAuditEventsSegmentDeadKeys()로 확인된 죽은 키(Events_Engine에 더
 * 이상 없는 Events_OPS 키) 중 수동 컬럼이 완전히 비어있는 행만 삭제한다
 * (`runDeleteDeadContentOPSRows()`, CONTENT_002_Engine.js와 동일 패턴).
 * 삭제 전 로그로 목록 전체 나열 — 실행 로그가 곧 감사 기록.
 *
 * ⚠️ 수동 데이터가 있는 죽은 키는 자동 삭제하지 않고 로그로만 표시 —
 * 실제 캠페인 운영 데이터가 있을 수 있어 임의 삭제 금지, 발견되면 사용자
 * 확인 후 별도 처리.
 * ==========================================================
 */
function runDeleteDeadEventsOPSRows(force) {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const engineSheet = ss.getSheetByName(EVENTS.SHEET.ENGINE);
  const opsSheet = ss.getSheetByName(EVENTS.SHEET.OPS);

  if (!opsSheet) {
    Logger.log(EVENTS.SHEET.OPS + " sheet not found.");
    return;
  }

  const liveKeys = {};

  if (engineSheet) {

    sheetToObjects(engineSheet).forEach(function (r) {
      const key = String(r[EVENTS.KEY] || "").trim().toLowerCase();
      if (key) liveKeys[key] = true;
    });

  }

  const manualCols = EVENTS.GROUP_1_MANUAL
    .concat(EVENTS.GROUP_2_MANUAL)
    .concat(EVENTS.GROUP_3_MANUAL);

  const values = opsSheet.getDataRange().getValues();
  const headers = values[EVENTS.ROWS.HEADER - 1];
  const keyColIndex = headers.indexOf(EVENTS.KEY);

  const rowsToDelete = [];
  const skippedWithManualData = [];

  for (let r = EVENTS.ROWS.DATA_START - 1; r < values.length; r++) {

    const key = String(values[r][keyColIndex] || "").trim();

    if (!key) continue;
    if (liveKeys[key.toLowerCase()]) continue; // 살아있음 — 스킵

    let hasManualData = false;

    manualCols.forEach(function (col) {

      const colIndex = headers.indexOf(col);
      if (colIndex === -1) return;

      const v = values[r][colIndex];

      if (v !== "" && v !== 0 && v !== undefined && v !== null) {
        hasManualData = true;
      }

    });

    if (hasManualData && !force) {
      skippedWithManualData.push(key);
      continue;
    }

    rowsToDelete.push(r + 1); // 1-based 시트 행 번호

  }

  Logger.log("======================================");
  Logger.log("Delete Dead Events_OPS Rows" + (force ? " (force=true — 수동 데이터 있어도 삭제)" : ""));
  Logger.log("======================================");
  Logger.log("Events_OPS 현재 행 수(헤더 제외): " + (opsSheet.getLastRow() - EVENTS.ROWS.DATA_START + 1));

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
    "Events_OPS 현재 행 수(헤더 제외): " + (opsSheet.getLastRow() - EVENTS.ROWS.DATA_START + 1)
  );

  Logger.log("======================================");

}


/**
 * ==========================================================
 * Run Delete Dead Events_OPS Rows — Force (수동 실행 전용 wrapper)
 *
 * WHY
 * Apps Script 편집기의 Run 버튼은 함수에 인자를 넘길 수 없어
 * runDeleteDeadEventsOPSRows(true)를 직접 실행할 방법이 없음 —
 * `runDeleteDeadContentOPSRowsForce()`(CONTENT_002_Engine.js)와 동일한
 * 인자 없는 진입점.
 *
 * ⚠️ 수동 컬럼(PIC/Speaker/Mkt Reg. 등) 데이터가 있어도 전부 삭제한다 —
 * 되돌릴 수 없음.
 * ==========================================================
 */
function runDeleteDeadEventsOPSRowsForce() {

  runDeleteDeadEventsOPSRows(true);

}
