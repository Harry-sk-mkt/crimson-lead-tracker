# Changelog — 2026-08-25

## Import 단계 완전 동일 Raw 중복 필터링 신규 도입

Master Build 단계 완전동일 중복 정리(`OPS_006_QA.js`)가 데이터가 쌓일수록 무거워진다는
지적에 따라, byte-identical 행은 Raw에 쓰기 전 걸러내도록 변경. `IMPORT_008_
RawDeduplicator.js`(신규, 순수 구조적 비교 — 어떤 필드가 snapshot이라 제외되는지 같은
business logic 없음) + `IMPORT_005_RawWriter.js` v4.1.0/`IMPORT_001_Import.js` v3.8.0 수정.
"같은 Lead ID/터치인데 일부 필드만 다른" 경우를 하나로 합치는 판단(progression tie-break 등)은
의도적으로 범위 밖 — 여전히 Master Build 단계(`OPS_006_QA.js`) 책임.

이 김에 Master 단계 완전동일 중복 정리 함수(`runAutoDeleteExactDuplicateLeadRows()`/
`runAutoDeleteExactDuplicateTouchRows()`)를 지금 상태로 재실행 — 둘 다 0건(이미 파이프라인
tail로 계속 정리되고 있던 상태 확인).

## S&M_REP 8/17주 New P1 불일치 — 근본 원인 확정 및 해결(`docs/OpenItems.md` #27)

전날 세션에서 타임존 가설이 기각된 채 미해결로 남아있던 건. 사용자가 8/17~08/23주 Salesforce
New P1 전체 Lead ID 75건 + Create Date를 직접 제공, `TEMPQA_027_
SMRepNewP1WeekSalesforceDiff.js`로 Leads_OPS/Leads_Master와 1:1 대조한 결과 **63건 정상
일치, 완전동일 중복/mergeOPS earliest-wins 등 기존 유력 가설 전부 기각 — 누락 12건 전부
Leads_Master에도 존재 자체가 없음**(Import 자체가 안 됨). 12건 전부 Create Date =
2026-08-17(그 주 월요일, 첫날)로 확정 — 그 주 export가 8/17을 빼고 8/18부터 시작됐던 순수
Import 공백. 사용자가 해당 범위 재export→재업로드(위 Raw 중복 필터 덕분에 기존 데이터와
겹쳐도 안전) 후 재대조 결과 **75건 전체 정상 일치**로 완전히 해소.

## Content_OPS 프로그램 오염 근본 원인 규명 및 수정 (Deal Tracker 집계 Segment 필터 누락)

사용자가 Content_OPS에 "ebook이 아닌" WB-/EV-(Webinar/Seminar) 프로그램 150여 건이 섞여
있음을 발견. 조사 과정:
1. **1차 가설(기각)** — Business Segment 재분류 규칙이 개선되기 전 stale 데이터. Node vm으로
   `getBusinessSegment()`를 직접 실행해 반박(현재 코드로는 대부분 정확히 Webinar/Seminar로
   분류됨) — 그래도 Full Rebuild(`rebuildLeadsMaster()`/`rebuildMTAMaster()`/
   `buildLeadsOPS()`) 1차 진행, Leads_Master 완전동일 중복 937건/MTA_Master 1,855건 추가
   정리(2026-08-20 이후 재발한 것으로 보임 — 별도 조치 없이 이번 Full Rebuild에 포함돼 해소).
2. **2차 근본 원인(확정)** — `computeContentDealAggregates_()`(`CONTENT_002_Engine.js`)가
   Deal Tracker 집계 시 Business Segment 필터가 아예 없어서, 어떤 세그먼트로든 귀속된 딜이
   있으면 프로그램명(`leadSourceDetail`) 문자열만 일치해도 Content_Engine의 살아있는 키로
   잘못 포함되고 있었음 — `BOFU_002_Engine.js`는 이미 `row.businessSegment` 필터가 있어
   문제 없었음(대조군으로 발견). `computeEventsDealAggregates_()`(`EVENTS_002_Engine.js`)에도
   동일 버그 확인, 함께 수정(`EVENTS.SEGMENTS.indexOf(row.businessSegment) === -1`이면 제외).
   회귀 테스트 갱신, Node vm/Apps Script 양쪽 검증.
3. **3차 잔여 원인(확정)** — 위 수정 후에도 9개 프로그램이 여전히 Content로 남음.
   `TEMPQA_028_ContentSegmentLeakTrace.js`로 추적한 결과 `BUSINESS_SEGMENT_EXCEPTIONS`의
   campaign 키 예외(예: `kr_core_2025_01_15_sitelink-ext-bookconsultworkshops_lead` →
   Content)가 실제로는 여러 다른 프로그램(Webinar 등록 페이지 등)에 공용으로 쓰이는 캠페인
   코드라, 그 코드를 공유하는 소수 터치(프로그램당 1~2건)까지 전부 Content로 덮어쓰고
   있었음. `getBusinessSegment()`(`UTIL_001_TransformHelper.js` v1.17.0)에 신규 헬퍼
   `detailIndicatesSpecificProgram_()`로 "이 터치의 detail이 Seminar/Webinar/BOFU 신호를
   명확히 주면 campaign 예외보다 우선" 가드 추가 — campaign 자체의 키워드 오탐을 바로잡던
   기존 예외 케이스(`NZ_core_..._webinar-research` 등)는 영향 없음. 회귀 테스트 33개+4개
   전부 Node vm으로 PASS 확인.

**Content_OPS 정리**: 위 수정들을 반영하려 Full Rebuild 2회 진행(Deal 필터 수정 후 1회,
campaign 예외 가드 수정 후 1회) — 매번 `runAuditContentSegmentDeadKeys()`/
`runDeleteDeadContentOPSRowsForce()`(신규, `force` 파라미터로 수동 데이터 있어도 삭제 —
사용자가 명시적으로 "안 보이게 제거" 요청)로 정리. 최종 Content_OPS 301행 → 157행(Deal
필터 수정) → 144행(campaign 예외 가드 수정, 13건 추가 정리).

**미해결로 남긴 항목(`docs/OpenItems.md` #28/#29)**: (1) Events_OPS도 동일 버그의 영향을
받았을 가능성 있으나 아직 감사 전(Content용 audit/delete 함수를 Events에도 만들어야 함).
(2) 검증 중 발견한 무관 사전 버그 — `leadSource="Paid Social"` 관련 회귀 테스트 3개가 이번
세션 변경 이전부터 이미 실패 상태였음(`git show HEAD`로 확인) — 원인 미착수.



## S&M_REP — Leads breakdown New P1 필터 추가, Salesforce 대조 불일치 조사(진행 중)

사용자가 S&M_REP의 Event/BOFU/Content/Organic/Referral breakdown이 New Leads 전체가 아니라
New P1만 보여야 한다고 확정 — `computeSMRepWeeklyAggregates_()`(`SMREP_001_Report.js` v1.1.0)의
Leads 블록 breakdown 집계에 `isEffectiveP1_()` 필터 추가(`if(bucket) ...` →
`if(bucket && isP1) ...`). SAL 블록 breakdown(BOFU/Search/Organic/Referral)은 변경 없음(원래도
전체 SAL 기준). `testComputeSMRepWeeklyAggregates()` 갱신 및 PASS 확인, clasp push 완료.

이후 사용자가 8/17~08/23 주를 Salesforce 리포트와 대조한 결과 Event/BOFU/Content/Organic이
30/5/35/3(Salesforce) vs 26/4/29/2(S&M_REP)로 불일치 발견 — `TEMPQA_025_
SMRepWeekTimezoneTrace.js` 신규 작성해 "`getMondayOfWeek_()`가 스크립트 타임존(America/
New_York) 기준으로 요일을 판정해 Seoul 기준 월요일 새벽 리드가 전 주로 밀린다"는 1차
가설을 검증했으나, 실측 결과 버그 있는 방식/Seoul 보정 방식이 완전히 동일한 값을 내 **기각**
(주 배정이 갈리는 리드 0건). S&M_REP 코드 자체는 Leads_OPS를 정확히 집계하고 있음이 확인돼,
문제는 "우리 코드 대 Salesforce" 간 불일치로 좁혀짐 — Import는 조사 당일 실행 완료 상태라
데이터 지연도 배제. 20번 항목(ACQ_REP New P1 vs Salesforce, 2026-08-05 — Leads_Master 미정리
중복 Lead 행이 원인이었던 전례) 패턴이 유력 가설이나 미검증 상태로 다음 세션 계속 — 상세는
`docs/OpenItems.md` 27번 항목 참고.

## FY_REP — Target 컬럼 범위 불일치 버그 수정, 2026-08-20 미커밋 재구성 재개/검증

2026-08-20 세션에서 FY_REP 레이아웃을 FY×Month 단일 플랫 테이블로 전면 재구성(4섹션
체크박스 폐기)하고 Target 소스도 `perfTrackerByFY`(Digital/CORE 한정으로 부적절 판명)에서
`Target_Engine`의 "Marketing Revenue Target" × VAT 10%로 전환했었으나, 실 시트 검증 전
커밋 없이 세션이 끊긴 채 방치돼 있던 걸 이번 세션에 재개.

`TEMPQA_006_FYRepExternalSheet.js`의 진단 함수로 실측한 결과:
- Spent $0 문제(2026-08-20 당시 미해결로 남아있던 것)는 이미 재현 안 됨(정상 확인).
- 대신 Target 값이 사용자 기대치보다 낮게 나오는 새 버그 발견 — `Target_Engine`의
  "Marketing Revenue Target"(22행)이 **Referral/Upsell을 제외한** 마케팅 기여분만
  담고 있는데, FY_REP의 Total Rev는 Referral/Upsell을 포함한 8개 버킷 합이라 범위가
  안 맞았음(사용자 실측 확인).

**수정**: `Target_Engine`에 신규 24행 "Total Revenue Target"(VAT/Referral/Upsell 전부
포함, 사용자가 다른 시트에서 확인한 FY27 실측치를 그대로 수동 입력)을 추가하고, FY_REP의
Target 소스를 22행 × VAT 대신 이 24행 값을 직접 쓰도록 교체 — VAT 배수 곱셈도 함께 제거
(`CONFIG.TARGET.INPUT.MONTHLY_COMPANY_INPUTS.TOTAL_REVENUE_TARGET_ROW` 신규,
`TARGET_001_Engine.js` v1.27.0, `TARGET_003_Styles.js` v1.8.2, `FYREP_001_Engine.js`
v1.7.0, `CORE_001_Config.js` v1.42.0). 22행/23행 및 Target_REP 등 기존 소비처는 안 건드림.
1회성 값 입력용 `TEMPQA_022_TargetEngineTotalRevenueSeed.js`(`runSeedTargetEngineTotalRevenueRow()`)
신규 작성. `computeFYRepTeamKoreaTargetsByFY_()` 결과가 사용자 제공 FY27 12개월 값과
정확히 일치함을 실행 로그로 확인, `setupFYReport()`→`runGenerateFYReport()` 실행 후 사용자가
실제 시트에서 Target 반영을 직접 확인 완료.

그 외 Q&A로 확인/정리한 사항(코드 변경 없음): FY27 Spent $0는 버그가 아니라
`perfTrackerByFY`에 FY27 탭이 아직 없어 생기는 예상된 동작(기존에 이미 안전 처리돼
있음). IC Booked/IC Completed는 실제 발생월이 아니라 **Create Date 코호트**(New P1과
동일 기준) 귀속(`aggregateFYRepLeadsOPSFromRecords_()`). FY_REP은 Import 파이프라인에
자동 배선돼 있지 않음 — Generate 체크박스 또는 `runGenerateFYReport()` 수동 실행 필요.

## "EV-2026-08-KOR-MOFU-Core SC Bank JHU Seminar" Events_OPS 누락 — 원인 규명 및 Raw 데이터 정정

사용자가 MTA import 완료 후 이 프로그램이 Events_OPS에 안 보인다고 보고. README Pipeline
Status는 정상 DONE이라 파이프라인 실행 자체는 문제없었음 — `TEMPQA_023_SCBankJHUSeminarEventTrace.js`
(신규, 진단 전용)로 단계별 조사한 결과, 코드 버그가 아니라 **Salesforce/Marketo 쪽 Kakao
Channel 캠페인 연결 오류**로 확인:

- 이 신규 이벤트의 UTM(`KR_core_2026-08-23_sc-jhu-ev`)으로 실제 터치 12건이 들어왔으나,
  해당 Kakao Channel이 지난 5월 EXPO 캠페인에 연결된 채 남아있어 그 중 6건이
  "EV-2026-05-KOR-MOFU-Core EXPO Kakao Channel"(지난 5월 EXPO 행사)로 잘못 attribution
  되어 기존 EXPO 통합 override 로직을 타고 조용히 그쪽 집계에 흡수되고 있었음. 나머지
  6건은 Lead Source Detail이 공란(Business Segment="Other")으로 남아 Events 필터에서
  아예 제외.
- 리드 1건(`00QRC00001M749m`)은 이 UTM이 First Touch였는데 Leads_Raw의 "First Touch
  Detail"도 동일하게 공란.
- 사용자가 Marketo/SFDC 쪽 Kakao Channel 캠페인 연결을 이미 정정(향후 유입 건은 정상
  attribution 확인) — 이미 들어온 과거 데이터만 소급 정정 필요.

**정정**: 사용자가 정확한 프로그램명("EV-2026-08-KOR-MOFU-Core SC Bank JHU Seminar")과 정정
범위(공란 포함 전체)를 확인해줘서, `TEMPQA_024_SCJHUEVLeadSourceDetailRepair.js`(신규)로
"Raw는 원본 보존, 수동 수정 금지" 원칙의 명시적 예외(`TEMPQA_008_SalesAcceptedDateRepair.js`와
동일 사유 구조 — 오염 원인 확정 + 사용자가 목표값/범위 직접 확인)로 MTA_Raw 12건 + Leads_Raw
1건을 직접 정정(UTM 정확히 일치 + 알려진 오염값인 행만 건드리는 안전장치 포함). 이후
`rebuildMTAMaster()`/`rebuildLeadsMaster()` 실행해 Master/Engine까지 반영 완료(Events_Engine
356→357행, 신규 키 생성 확인). **다음 세션 첫 단계**: `buildEventsOPS()` 실행해 Events_OPS
시트에 이 프로그램 행이 정상적으로 나타나는지 최종 확인 필요(이번 세션에서 요청만 하고
실행 확인 전에 종료).
## BOFU_OPS/Content_OPS — SF NLP1s/CPNP1 상위·하위 25% 하이라이트 신규

사용자 요청으로 Events_OPS에만 있던 상위 25% 배경색(`#01ef18`) 강조를 BOFU_OPS/Content_OPS의
SF NLP1s(값이 높을수록 좋음, 상위 25%)/CPNP1(비용 지표라 낮을수록 좋음, 하위 25%) 컬럼에도
추가. Events의 `buildPercentileHighlightFormula_()`/`applyTop25HighlightRules_()`
(`EVENTS_006_Styles.js`)는 상위 25% 방향으로 고정돼 있어, 컬럼별 방향(top/bottom)을 인자로
받는 제네릭 버전 `applyPercentileHighlightRules_()`/`buildBottomPercentileHighlightFormula_()`
(`OPS_002_Styles.js` v3.3.0)를 신규 작성해 top 방향은 기존 함수를 그대로 재사용. `BOFU.
TOP25_HIGHLIGHT`/`CONTENT.TOP25_HIGHLIGHT`(`BOFU_001_Config.js`/`CONTENT_001_Config.js`) 신규
설정, `BOFU_006_Styles.js`/`CONTENT_006_Styles.js`에서 호출. 이후 사용자 요청으로 강조 셀에
볼드체도 추가(`.setBold(true)`, `OPS_002_Styles.js` v3.4.0).

## Content_OPS/BOFU_OPS "Spent"가 사실상 비어있던 문제 발견 및 Meta_Raw 자동 집계로 전환

사용자가 "Content의 Spent가 전체 데이터를 다 담고 있는 것 같지 않다"고 지적 —
`TEMPQA_029_ContentSpentCompletenessAudit.js`(신규)로 FY|Month 버킷별 수동 Spent 합계를
검증된 소스 `Ad_Spend_Cache`(Meta+Naver+Kakao 합산, ACQ_REP가 쓰는 것과 동일)와 대조한 결과
**FY23~27 전체 39개 정상 버킷이 전부 $0**로 확인(Ad_Spend_Cache Content 세그먼트 합계는
동기간 $941,743.60). BOFU도 동일 구조로 확인(`TEMPQA_030_BOFUSpentCompletenessAudit.js`
신규, Ad_Spend_Cache BOFU 합계 $177,705.82 대비 전부 $0). 원인: `Spent`가
`GROUP_3_MANUAL`(Ops가 Meta Ads Manager에서 손으로 옮겨 적는 컬럼)에 남아있어 자동 집계가
전혀 없었음 — Events_OPS만 2026-08-06에 이미 자동화 전환된 상태였음.

Events_OPS가 쓰던 캠페인명→Marketo Program 매칭(`UTIL_002_UtmProgramDictionary.js`
+ `EVENTS_002_Engine.js`의 매칭 로직)을 도메인 무관 제네릭 버전
`resolveMetaCampaignProgramKey_()`/`aggregateMetaSpendByProgram_()`(이후
`aggregateMetaCampaignDataByProgram_()`로 확장, 아래 참고)로 분리해 재사용 — Events 전용
EVENT_TYPE_PREFIXES 필터 대신 Business Segment 기반 자격 판정(`isEligibleBOFUProgram_()`/
`isEligibleContentProgram_()`, `getBusinessSegment(name, name)` 관례 재사용). `BOFU_001_
Config.js`/`CONTENT_001_Config.js`에서 `Spent`를 `GROUP_3_MANUAL`→`GROUP_4_COMPUTED`로 이동,
`BOFU_002_Engine.js`/`CONTENT_002_Engine.js`의 `refreshBOFUEngine_()`/`refreshContentEngine_()`
에 배선. 디버깅 중 "Engine 시트엔 정상 계산됐는데 OPS 시트엔 0"으로 보였던 건 실제로는
`buildBOFUOPS()`/`buildContentOPS()` 재실행 누락이었음(`TEMPQA_031_
BOFUContentMetaSpendMatchDiagnostic.js`로 단계별 확인). 매칭 커버리지는 완전하지 않음 —
Meta_Raw 919행 중 554행만 UTM_Program_Dictionary에서 매칭(365행은 애초에 딕셔너리에 없음),
그중 Content 115행/BOFU 67행만 각 세그먼트로 귀속 — 딕셔너리가 못 찾는 오래된/소규모
캠페인은 여전히 $0(수동 입력도 마찬가지로 채우기 어려웠을 것).

## BOFU_OPS/Content_OPS 나머지 캠페인 데이터(Campaign/Off-On/Start Date/End Date/Impressions/
Reach/Link clicks/Results) 자동 집계 확장

Spent 자동화에 이어 사용자가 "수동입력영역도 그냥 캠페인 데이터 가져오는 걸로 변경해줘"
요청. `aggregateMetaSpendByProgram_()`를 `aggregateMetaCampaignDataByProgram_()`
(`EVENTS_002_Engine.js` v1.20.0)로 확장해 Spend 외 Clicks/Results/Impressions/Reach/캠페인명
목록/캠페인 시작·종료일/진행중 여부(hasOngoing)까지 한 번에 계산. 다만 `Start Date`/`Off/On`은
실측 결과(`runDumpContentOPSRowRawCells_()`) 이미 실제 값이 들어차 있는 필드라, Meta_Raw가
커버 못 하는 프로그램(Content 144개 중 87개/BOFU 138개 중 92개)까지 무조건 덮어쓰면 기존
수동값이 날아가는 회귀가 생김 — **Meta 매칭이 있는 프로그램만** 덮어쓰고 매칭 없으면 기존
수동값을 그대로 보존하는 정책(`applyBOFUMetaCampaignDataIfMatched_()`/
`applyContentMetaCampaignDataIfMatched_()`, `BOFU_004_Merge.js`/`CONTENT_004_Merge.js` 신규)
채택. `mergeBOFUOPS_()`/`mergeContentOPS_()`에 `metaAgg` 파라미터 추가,
`BOFU_003_Build.js`/`CONTENT_003_Build.js`가 빌드 시점에 직접 계산해 전달(Date/배열 값을
Engine 시트 캐시로 왕복시키면 타입 손실 위험이 있어 Spent와 달리 Engine 경유 안 함).

Impressions/Reach는 처음엔 "Meta_Raw 원본에 컬럼 자체가 없다"고 잘못 판단해 자동화 대상에서
제외했으나, 사용자가 "값이 없다"고 재차 지적 — `AD_001_Config.js`의 기존 주석("실제 헤더는
Impressions/Reach/CTR 등이 더 있으나 필요한 컬럼만 매핑")을 재확인하고
`runDebugMetaRawFirstRow()`로 실제 헤더("Impressions"/"Reach", 둘 다 숫자)를 재검증한 뒤
`AD.META.COLUMNS`에 매핑 추가(`AD_001_Config.js` v1.22.0, `AD_002_Meta.js`
`readMetaRawRows_()` v1.9.0) — 나머지 필드와 동일하게 매칭 시 자동 채움으로 편입.

마지막으로 서식 요청 반영: `Impressions`/`Reach`/`Link clicks`/`Results`는 천 단위 콤마+
소수점 제거("#,##0"), `Spent`는 `$` 표시("$#,##0.00", Revenue/CPL/CPNP1/ROAS는 기존 서식
유지) — `BOFU_006_Styles.js` v1.3.0/`CONTENT_006_Styles.js` v1.2.0.

## Target_REP Actual CPNP1 과소집계 — Meta 주간 지출 파이프라인 버그 2건 발견·수정

사용자가 Target_REP 8월 Webinar Actual CPNP1이 비정상적으로 낮게(=달성으로 잘못) 표시된다고
리포트("270+ 나와야 하는데 $162~189대로 나옴"). `AD_002_Meta.js`에 진단 함수들
(`runDebugTargetCampaignTrace()`/`runDebugTargetWebinarAugustSpendAudit()`/
`runDebugTargetWeekAllSegmentsAudit()`, 전부 TEMP)을 신규 추가해 단계적으로 원인을 좁힘:

1. **`Ad_Spend_Cache_Weekly` 단순 미갱신** — `Meta_Raw` 갱신 후 캐시를 안 돌려서 최신 주(週)가
   반영 안 됨. `runRefreshAdSpendWeeklyCache()` 재실행으로 해소(코드 변경 없음).
2. **`isMetaRowWeekPrecise_()` 정의 버그(핵심)** — "reportStart/reportEnd가 같은 주(월~일)
   버킷에 속하는지"만 확인하고 "그 export가 7일 전체를 커버하는지"는 확인 안 함. 사용자가
   화~일(6일)만 export한 배치가 "정밀"로 오인되며, 그 주 전체를 통째로 대체하면서 **월요일
   하루치 지출이 증발**(실측: 8/17주 캐시 5,066.75, 실제 8,897.07). 1차 수정(월~일 7일 전체
   커버만 정밀로 인정)은 반대로 6일치 실측값을 lump 평균으로 완전 대체해버려 더 크게
   과다집계(13,706.50, 실측 10,443.03)로 역효과 — 2차로 `isMetaRowWeekPrecise_()`를
   "reportStart/reportEnd가 정확히 월~일인지"가 아니라 **"실효 구간(캠페인 활성기간 ∩ 보고
   조회기간)이 정확히 한 주에만 걸치는지"**로 재정의, 신규 `prorateSingleWeekMetaSpend_()`가
   그 결측이 export 조회기간 탓이면 일수 비율로 7일치 보정, 캠페인이 진짜 그 주 중간에
   시작/종료된 탓이면 보정 안 함으로 구분. Node로 dedup+보정 파이프라인 전체를 시뮬레이션해
   이중 집계 없음을 확인 후 배포(사용자 확인, `AD_002_Meta.js` v1.14.0~v1.16.0).

사용자가 앞으로 매주 월요일에 전주(월~일) 데이터를 온전히 업로드하기로 확정 — 이번에 발견된
부분(partial) export 케이스 자체가 크게 줄어들 것으로 예상되나, 방어 로직(위 보정)은 재발
대비로 유지. `docs/OpenItems.md`에 잔여 확인 필요 사항 갱신 필요할 수 있음(8/24주 Meta_Raw
데이터 자체가 아직 비어있음 — 사용자가 export 붙여넣기 예정, 코드 이슈 아님).

## Google Search(4번째 캠페인 지출 플랫폼) 연동 — Search_OPS 범위로 착수

사용자가 `GoogleSearch_Raw` 탭(캠페인 지출 스프레드시트)에 Google Ads 검색광고 리포트를
수동 붙여넣기 완료했다고 알려와 착수. 확인 결과 Meta/Naver Search와 달리 **Google Ads
리포트 테이블 자체에 기간(날짜) 컬럼이 없고**(사용자 확인 — "구글에 start and end date를
추출할 수 없다"), 업로드된 데이터도 all-time(전체 기간) 합계라 월별로 쪼갤 방법이 없음 —
사용자 결정("우선 지금은 search_ops에만 반영해두자, 리포팅 영역은 배제해두고")에 따라
FY/Month/Segment 집계·`Ad_Spend_Cache`·ACQ_REP/Target_REP/FY_REP 연결은 하지 않고, Naver
Search의 `NAVER_SEARCH_CAMPAIGN_STATS` 패턴(Search_OPS `GROUP_3A_AUTO` 자동 매칭)만
재사용하기로 범위를 좁힘.

`AD_007_GoogleSearch.js` 신규(캠페인별 Impressions/Clicks/Spent/Results 집계, Cost는 이미
NZD라 환율 변환 불필요) + `SEARCH_004_Merge.js`(Naver 전용이던 매칭 로직을
`buildCampaignStatsLowerKeyMap_(statsMap, overrideTable)`로 일반화, 신규
`mergeCampaignStatsLowerKeyMaps_()`로 두 플랫폼 결과를 키 충돌 시 합산) +
`SEARCH_003_Build.js`(Google Search stats 조회를 try/catch로 격리해 호출) 구현. 캠페인명은
Meta처럼 `KR_core_YYYY-MM-DD_slug_tag` 네이밍이 Search_OPS 키(Salesforce MKT UTM
Campaign)와 다수 직접 일치함을 사용자가 제공한 실 캠페인명으로 확인 — Naver Search 같은
별도 override 매핑 테이블 불필요.

실행 검증(`buildSearchOPS()`): 105개 키 정상 갱신. 이후 사용자가 "Campaign 데이터가
blank인 키가 많다"고 보고해, 채팅 붙여넣기 텍스트 대신 라이브 시트를 직접 비교하는 진단
함수 `runDebugGoogleSearchCampaignMatches()`(AD_007_GoogleSearch.js v1.1.0) 신규 추가해
원인 규명: GoogleSearch_Raw 44개 캠페인 중 16개 매칭, 28개 미매칭. 미매칭 중 4개는 한 셀에
캠페인 2개(`..._contact` + `KR-Core-...-Google-Rep-Test`)가 붙어 들어간 것으로 확인(Google
Ads export/붙여넣기 과정의 데이터 이슈로 추정, 코드 버그 아님). 나머지는 사용자가 직접
Conversions 값을 확인해 전부 0(리드/전환 자체가 없는 캠페인)임을 확인 — 매칭 로직 문제가
아니라 정상 동작으로 최종 확인.

## ACQ_REP 이번 달 IC Booked/Complete vs Salesforce 괴리 조사 — 원인 규명, 구현은 TODO로 보류

사용자 보고: Salesforce "leads report"(IC Booked Date=이번 달, 전체 세그먼트)는 IC Booked
42/IC Complete 22인데 ACQ_REP은 21/7. `OPS_006_QA.js`의 기존 진단 함수
(`runDiagnoseICCompleteMismatch()`/`runBreakdownICCompleteByBookedMonth()`)로 먼저 Leads_OPS
↔ MTA_Master 내부 정합성부터 확인 — 100% 일치, sync 로직 자체엔 문제 없음을 먼저 배제.

사용자가 Salesforce에서 직접 뽑은 Email 목록(IC Booked 42건/IC Complete 21건)을 신규
`TEMPQA_032_ICBookedAugustSalesforceDiff.js`로 `Leads_Master`→`Leads_OPS`→`MTA_Master` 순
단계별 대조:
- **진짜 sync 버그 1건 발견·수정**: `redrock333@yahoo.com`(신규 리드, Create Date 당일) —
  Leads/MTA 파이프라인이 서로 독립된 비동기 체인이라, 이 리드가 `Leads_OPS`에 생기는 시점과
  `syncMTAFunnelToOPS_()`가 마지막으로 돈 시점 사이에 순서가 어긋나 그 1회차 sync만 놓친
  것으로 추정. `runSyncMTAFunnelToOPS()` 재실행(8,294건 갱신)으로 해결 확인, IC Booked
  21→22.
- **나머지(IC Booked 17건, IC Complete 14건)는 구조적 원인으로 확정** — 재sync 이후에도
  불변. `MTA_Master`에 해당 리드의 터치는 있지만 어떤 터치 행에도 이번 달 IC
  Booked/Completed Date 값 자체가 없음(터치 타임라인 직접 덤프로 확인). `IC Booked
  Date`/`IC Completed Date`는 Lead 레벨 스냅샷이라 그 리드가 **새로 터치돼 재export될
  때만** 갱신되는데, 이 리드들은 SAL 이후 세일즈 내부 프로세스로만 IC Booking/Completion이
  진행돼 그 사이 새 마케팅 터치가 없었던 것으로 보임 — 재Import를 반복해도 재터치 전까진
  계속 공란으로 남는 구조.
- 2026-07-21에 정확히 이 문제를 막던 별도 Lead-level 리포트(`ICFunnel_Raw`/
  `syncICFunnelToOPS()`, 터치 무관 직접 export)가 있었으나 SAL 판별 단순화를 이유로
  MTA_Master 통합 방식으로 대체되며 제거됐던 것이 이번 과소집계의 구조적 원인으로 추정됨.

`docs/ACQReportDesign.md`("이번 달 IC Booked/Complete 구조적 과소집계" 섹션)와
`docs/OpenItems.md` #32에 조사 결과·해결 방향(ICFunnel_Raw 방식 재도입) 기록. 해결책 자체는
사용자 판단으로 **TODO 보류** — 이번 세션은 조사 및 문서화까지만 진행.

# Changelog — 2026-08-21

## Events_OPS 유령 프로그램 행("...LG Form" 접미사 미제거) 근본 원인 발견 및 수정

사용자가 Events_OPS에 "WB-2026-08-KOR-MOFU-Core College Research: HYPS & IvyㅣRegistered for
Webinar from FB LG Form" 류의 메인 프로그램 외 행이 SF Reg 0인 채 나타난다고 보고. 조사 결과
원인 2건 발견·수정:

1. **`EVENTS_004_Merge.js`(v1.14.0→v1.14.1)** — `createEventsKeyMap_()`가 기존 Events_OPS
   시트에 남아있는 레거시 키(`stripRegistrationFormSuffix_()`/`stripLGSuffix_()` 도입
   이전에 생성돼 접미사가 안 떼진 원문 키)를 정제 안 하고 있었음. EXPO 통합용
   `applyEventsProgramKeyOverride_()`만 적용되던 걸 두 strip 함수도 같이 적용하도록 수정 —
   처음엔 충돌(병합) 케이스만 고쳤다가(v1.14.0), 짝이 없는 단독 dirty 행은 "Marketo
   Campaign name" 표시 컬럼이 여전히 정제 안 되는 걸 사용자가 rebuild 후 재확인해줘서
   단독 경로도 마저 수정(v1.14.1).
2. **`EVENTS_002_Engine.js`(v1.16.0, 진짜 근본 원인)** — `resolveMetaCampaignEventsKey_()`가
   UTM_Program_Dictionary 경유 프로그램명에 `stripLGSuffix_()`/`stripRegistrationFormSuffix_()`를
   적용 안 하고 있었음. 다른 모든 키 추출 경로(MTA/Leads/Deal/Kakao 집계)는 이미 정제하고
   있었는데 Meta 경로만 빠져 있어, Meta 광고비(FB LG Form 캠페인)가 접미사 안 뗀 원문 키로
   새 Engine 행을 만들고 그 행엔 Spend/Clicks만 있고 SF 지표는 전부 0으로 남는 게 진짜
   원인이었음. 두 strip 함수 적용해 수정 — `runRefreshEventsEngine()` 재실행 후 Engine
   Keys 358→355(3개 감소, 문제 행 정확히 소거) 확인.

각 수정마다 TDD 테스트 추가/보강(`testCreateEventsKeyMapNormalizesLegacySuffixes`,
`testResolveMetaCampaignEventsKey`, `testAggregateMetaMetricsByEventsProgram`) 및 사용자
실제 rebuild로 최종 검증 완료. 정상 import 파이프라인에서는 `refreshEventsEngine_()`/
`buildEventsOPS()` 둘 다 이미 자동 배선(MASTER_003/004_*.js, MASTER_002_PipelineAsync.js)돼
있어, 향후 신규 리드/광고비도 별도 수동 조치 없이 자동으로 정제됨을 확인 — 오늘 두 함수를
수동으로 순서대로 실행해야 했던 건 Apps Script 편집기에서 자동 파이프라인을 거치지 않고
직접 실행했기 때문(정상 import 흐름과 무관).

# Changelog — 2026-08-20

## S&M_REP 전주 대비 증감 하이라이트 추가

사용자 요청으로 `SMREP_002_Styles.js`에 `applySMReportWeekOverWeekHighlights_()` 신규 —
Leads/SAL 블록 숫자 컬럼을 바로 위 행(전주)과 비교하는 수식 기반 조건부 서식(초록
`#01ef18`/빨강 `#ea4335`). 세 차례 조정: (1) 최초 구현 후 미래 주(아직 안 지난 주, 실적이
전부 0)가 직전 실측 주 대비 "감소"로 잘못 칠해지는 문제 발견 — Week Start가 `TODAY()` 이후인
행은 규칙 자체가 평가되지 않도록 가드 추가. (2) 사용자 요청으로 규칙 자체도 변경 — 전주와 값이
동일해도 초록(증가) 처리, 현재 값이 0이면 증가/감소 어느 쪽이든 색칠 안 함.

## Sales Accepted Date 오염(OpenItems #26) 최종 해소 — 타임존 버그가 진짜 원인이었음

S&M_REP 하이라이트 작업 중 미래 주(2026-08-31 등)에 SAL 값 자체가 찍혀있는 걸 발견하며 시작.
`TEMPQA_018_SalesAcceptedDateFutureAudit.js`로 Leads_OPS 전체를 하드코딩 없이 재스캔한 결과
기존에 알려졌던 3건이 아니라 **8건**임을 확인. 사용자가 이 중 2건(ppm1xxx@gmail.com/
yunjiseong955@gmail.com)을 Salesforce Field History에서 직접 대조해 "day>12라 day/month
swap 가설로는 설명 안 됨"이라던 기존 판단이 틀렸음을 지적 — 실제로는 원본이 day-first인데
Google Sheets가 month-first로 오해석한 것까진 기존과 같지만, **그 시각(한국 새벽~오전)이
스크립트 실행 타임존(America/New_York)과 실제 업무 타임존(Asia/Seoul) 사이 시차(최대
13~14시간) 때문에 하루 더 밀려 day가 12를 넘어가 버려** 기존 day≤12 스캔에서 통째로 빠졌던
것으로 근본 원인 확정(`TEMPQA_019_SalesAcceptedDateTimezoneTrace.js`로 검증). 이 발견은
지난 세션(2026-08-19) 기록이 "day/month swap 가설로는 설명 안 되는 잔여 3건, Salesforce
워크플로우 월말 기본값 가설" 이라고 적어둔 것 자체를 정정하는 결과.

`TEMPQA_020_SalesAcceptedDateTimezoneReaudit.js`로 MTA_Master 8,191건 전체를 Asia/Seoul
기준으로 재감사한 결과 **94건**(8건은 그 부분집합)이 동일 패턴, 반대 방향(잘못 swap된 것)은
0건으로 기존 3,193건 복구가 전부 안전했음도 함께 확인. `TEMPQA_021_
SalesAcceptedDateTimezoneRepair.js`(TEMPQA_008과 동일한 Raw 직접 수정 방식, 단 Seoul 기준
day/month + 이미 복구된 값(자정 시각)은 건드리지 않는 안전장치)로 94개 리드 177개 터치 행
복구 완료(전부 "원래 월=1월"로 나왔는데, 이 버그에 걸리는 조건 자체가 "Seoul 기준 그 달 1일"인
레코드만 해당해 수학적으로 당연한 결과 — 유학 상담 특성상 1월 쏠림도 현실적으로 타당).
`rebuildMTAMaster()` → `runSyncMTAFunnelToOPS()` 반영 후 S&M_REP 재확인으로 미래 주 SAL
소거 확인 완료.

**예방**: `OPS_006_QA.js` v1.7.0에 `checkUnprotectedDateLikeRawColumns_()` 신규 — Leads_Raw/
MTA_Raw 헤더 중 이름에 "date"가 들어가는데 `CONFIG.RAW_DATE_COLUMNS`에 없는 컬럼을 매 QA
실행마다 자동 감지. 이번 사고의 진짜 근본 원인("새 날짜 컬럼 매핑 시 보호 목록 갱신 누락",
2026-07-25~08-18 3주 공백)을 사람이 기억할 필요 없이 코드로 재발 방지.

## Full Rebuild가 완전 동일 중복 행 정리를 건너뛰는 구조적 갭 발견·수정

위 복구 후 사용자가 `rebuildMTAMaster()`를 재실행하자 S&M_REP All Leads 수치가 다시 부풀려짐
— 조사 결과 `rebuildMTAMaster()`/`rebuildLeadsMaster()`(`MASTER_004_MasterBuild.js`)가
Raw→Master를 1:1로 그대로 옮길 뿐, 완전 동일 중복 행 자동 삭제
(`runAutoDeleteExactDuplicateTouchRows()`/`runAutoDeleteExactDuplicateLeadRows()`,
OPS_006_QA.js)는 증분 파이프라인(`runLeadsPipelineTail()`/`runMTAPipelineTail()`)에만
배선돼 있어 Full Rebuild 때마다 Raw에 누적된 중복이 그대로 부활하는 구조적 갭이었음(실측:
1,625건 부활, 삭제 후 85,643 → 84,018). 재발 방지로 두 Rebuild 함수 모두에 해당 삭제 호출을
추가(v4.4.0) — 이제 Full Rebuild 후에도 자동으로 정리됨.


## Events_OPS EXPO 통합 + Meta 지출 자동화 + BOFU_OPS Business Segment 누수 버그 수정

**Events_OPS "Kor-EXPO-Master" 통합**: 사용자 요청으로 같은 행사가 채널/타겟팅별
38개 Marketo Program으로 쪼개져 있던 걸 하나로 통합. `EVENTS_PROGRAM_KEY_OVERRIDE`
(`EVENTS_002_Engine.js`) 신규 — 38개 프로그램명을 "Kor-EXPO-Master"로 매핑, MTA/
Leads/Deal Tracker/Kakao Spend 4개 집계 지점 전부 적용. `EVENTS_004_Merge.js`의
`createEventsKeyMap_()`도 같은 override로 기존 OPS 행 병합 — 충돌 시 숫자 컬럼
합산, Notes " / " 연결, 나머지는 첫 발견 값 유지(`mergeExistingEventsRows_()` 신규,
Search_OPS의 Naver 캠페인 키 충돌 합산 패턴 재사용).

**Meta 광고비 자동 집계 확장**: EXPO Meta 지출이 너무 낮다는 사용자 지적으로 조사한
결과, `Spent`가 그동안 Kakao Moments 비용만 집계하고 Meta는 전혀 연결이 안 돼있던
구조적 갭 발견(2026-08-06부터). 처음엔 EXPO 3개 캠페인만 수동 매핑
(`META_CAMPAIGN_NAME_TO_EVENTS_KEY_OVERRIDE`)했으나, 전체 Meta_Raw 실측 결과
752개 캠페인·$1,828,805.85 중 2%뿐이라 전체 캠페인 육안 대조가 비현실적임을
확인 — 사용자 요청으로 기존 `UTIL_002_UtmProgramDictionary.js`(Kakao Moments용
UTM↔Marketo Program 자동 채굴 딕셔너리)를 재사용하는 방향으로 전환.
`readLeadsMasterUtmProgramPairs_()` 신규(Leads_Master `First MKT UTM Campaign`↔
`First Touch Detail`, 2차 소스 추가) + `resolveMetaCampaignEventsKey_()`(수동
override 최우선, 없으면 딕셔너리+eligibility 체크). 이어서 Clicks/Results도 자동화
(Meta_Raw "Link clicks"/"Results" 실제 헤더 확인 후 매핑) — `EVENTS_001_Config.js`에서
Clicks/Results는 GROUP_4_COMPUTED로, CVR은 저장값 대신 GROUP_5_DERIVED(Results÷
Clicks 시트 수식, 여러 캠페인 합산 시 CVR 자체를 합/평균 내면 틀리므로)로 이동.
AE(Spent)/AH(CPNP1) 컬럼 $ 표시 서식 추가.

**BOFU_OPS 버그 발견·수정 3건(사용자 발견)**: (1) 신규 런칭 프로그램("Duke CAO
advise")에 리드가 있는데도 행이 안 보임 조사 중, `computeBOFUDealAggregates_()`
(Deal Tracker 집계 경로)에 Business Segment 게이트가 아예 빠져있던 버그 발견 —
MTA/Leads 경로는 BOFU만 통과시키는데 이 경로만 KOR 프로그램이면 다 통과시켜서
Webinar/Seminar(WB-/EV-) 프로그램의 딜이 BOFU_OPS에 새어 들어오고 있었음(실측
169개 죽은 행). Deal Tracker `businessSegment`로 동일 게이트 추가 후,
`runDeleteDeadBOFUOPSRows()`(Search_OPS의 `runDeleteDeadSearchOPSRows()` 전례와
동일 패턴, `mergeBOFUOPS_()`가 기존 키를 합집합 보존하는 구조라 코드만 고쳐선
기존 행이 안 지워짐) 신규로 169건 정리. 잔여 소수(WB 2건/WF 1건)는 진단 결과
전부 Deal Tracker 수동 오분류(사용자가 직접 Segment 열 수정 완료) 또는 프로그램명
자체에 "-BOFU-Core-"가 포함된 정당한 분류로 확인 — 코드 버그 아님. (2) Start
Date가 비어있는 신규 행이 정렬(빈 날짜 최하단)로 안 보이는 문제 — "Earliest Lead
Date" 자동 채움 추가했으나 Leads_Master(New Registered, 첫 터치만) 단일 소스로는
부족함을 재발견(BOFU 프로그램은 리드의 첫 터치가 아닌 경우가 흔함) — MTA_Master
전체 터치도 2차 소스로 추가(`pickEarliestDate_()`). (3) 진단 과정에서 남은 스냅샷
데이터 문제(MTA_Master 오래된 Business Segment 스냅샷 1건) 발견, Full Rebuild
필요 여부는 보류.

## Sales Accepted Date 오염 — docs drift 정정 + 잔여 3건 원인 조사

`docs/OpenItems.md` #26 점검 요청으로 시작. `docs/OpenItems.md` #26/`docs/DateParsing.md`가
"데이터 복구 TODO, 영향 범위 미확인"으로 남아있었으나, 같은 날짜(2026-08-18) 커밋에서 이미
`TEMPQA_007~010`(감사·swap-back 복구·잔여 추적·stale clear)로 8,191건 중 3,193건 오염을
확인·복구까지 완료했던 사실이 문서에 반영이 안 돼 있었음(docs/Changelog.md 2026-08-19 "MTA
Funnel Sync..." 항목엔 기록돼 있었으나 OpenItems.md #26만 착수 전 문구 그대로 방치) — 두 문서
모두 실제 완료 상태로 정정.

**잔여 3건 원인 조사**: 대량 복구 후에도 day>12(swap 가설 불가) 사유로 미해결 남아있던
`00QRC00000ti6Vc`/`00QRC00000tnGLi`/`00QRC00000shbd7` 3개 Lead ID를 신규 읽기 전용 진단
`TEMPQA_013_SalesAcceptedDateResidualTrace.js`(`runTraceSalesAcceptedDateResidual()`)로
확인 — 사용자가 Apps Script 편집기에서 직접 Run. 결과: 셋 다 (1) 정확히 그 달 말일
(2026-09-30/10-31/10-31), (2) IC Booked/Completed/Won Date 전부 공란(파이프라인 진행 없음),
(3) Priority/Business Segment는 제각각(P3·Search / P1·BOFU / P3·Content) — day/month swap이
아니라 Salesforce 쪽 워크플로우/롤업이 월말 날짜를 기본값으로 채워 넣었을 가능성이 유력 가설로
좁혀짐(미확정). 시트/코드로는 더 이상 원인 규명 불가 — Salesforce Field History 직접 확인이
다음 단계, 사용자 요청으로 이번 세션은 여기서 다음 세션으로 넘김(`docs/OpenItems.md` #26 참고).

## MTA Funnel Sync 성능 버그 수정 + S&M_REP 신규 리포트 + Sales Accepted Date 데이터 오염 발견·복구 + Pipeline Status self-heal 확장

- **버그 발견·수정 — MTA Funnel Sync 개별 setValue() 반복으로 인한 성능 문제(실측
  978.95초 ≈ 16.3분)**: MTA BOFU_OPS에서 Pipeline Status가 RUNNING에 멈춰있다는
  사용자 보고로 조사 시작 — Apps Script Executions 로그 확인 결과 "Timed Out"
  (30분 실행시간 초과), `syncMTAFunnelToOPS_()`(`MASTER_003_MTAFunnelSync.js`)가
  리드당 바뀐 필드마다 `opsSheet.getRange().setValue()`를 개별 호출(8,193개 리드 ×
  최대 5개 필드 = 수만 번의 개별 Sheets API 호출)하던 게 원인. 신규 순수 함수
  `computeMTASyncColumnUpdates_()`로 분리해 컬럼별 기존 값을 한 번에 읽고 메모리에서
  갱신한 뒤 컬럼당 단일 `setValues()`로 되돌려 쓰는 배치 패턴으로 전환(v1.6.0) —
  실측 55.41초로 단축(17.7배), 전체 MTA 파이프라인도 30분 타임아웃 없이 완주 확인.

- **신규 리포트 `S&M_REP`(Sales & Marketing Weekly Dashboard) 구현**: 사용자 요청으로
  신규 시트 — Target_REP과 동일한 주간(월~일) 구조(FY 하나 선택 → 그 FY 전체 주가
  행) 재사용. Leads 블록(All Leads/New Leads/New P1/Event/BOFU/Content/Organic/
  Referral) + SAL 블록(All SAL/P1/BOFU/Search/Organic/Referral), 두 블록의 breakdown
  세그먼트 구성이 의도적으로 비대칭(사용자 확정). `CONFIG.SM_REP`(`CORE_001_Config.js`),
  `SMREP_001_Report.js`(집계/Control Area/Generate), `SMREP_002_Styles.js`(서식) 신규
  — 기존 `handleReportGenerateEdit()` 공용 설치형 트리거 재사용(별도 설치 불필요).

- **버그 발견·수정 — `Sales Accepted Date` 미래 날짜 데이터 오염(`CONFIG.RAW_DATE_COLUMNS.MTA`
  누락)**: S&M_REP 검증 중 SAL이 미래 월(9~12월)에 찍히는 현상 발견 → ACQ_REP도 동일
  현상 확인 → Salesforce Field History로 직접 추적해 원인 확정("9/8/2026"이 실제로는
  8월 9일인데 9월 8일로 저장돼 있었음). `Lead: Sales Accepted Date`가 2026-07-25에
  파이프라인에 추가됐는데 Plain Text 보호 목록(`CONFIG.RAW_DATE_COLUMNS.MTA`, 2026-07-21
  확정)엔 그때 반영이 안 돼, Google Sheets가 day-first 원본을 자기 locale로 오해석해
  영구 변환된 것 — 목록에 추가해 재발 방지(`CORE_001_Config.js` v1.38.0). **데이터 복구**:
  읽기 전용 감사(`TEMPQA_007_SalesAcceptedDateAudit.js`, 8,191건 중 3,193건 오염 확인) →
  swap-back 공식으로 MTA_Raw 직접 복구(`TEMPQA_008_SalesAcceptedDateRepair.js`,
  "Raw는 원본 보존" 원칙의 명시적 예외 — 원본 텍스트가 이미 소실돼 보존 불가) →
  `rebuildMTAMaster()` → `runSyncMTAFunnelToOPS()`. 복구 후에도 남은 4건을
  `TEMPQA_009_SalesAcceptedDateLeadTrace.js`로 추적한 결과 (1) 대표 터치가 공란인데
  Leads_OPS에 잔존한 옛 값(→ `TEMPQA_010_SalesAcceptedDateStaleClear.js`로 강제
  클리어) / (2) day>12라 swap 가설과 무관한 별개 원인(월말 날짜 패턴, Salesforce
  자동화 추정) 2건으로 구분됨. 잔여 3건은 `docs/OpenItems.md` #26에 미해결로 기록.

- **버그 발견·수정 — 플랫폼 강제종료/내부 오류 시 README Pipeline Status에 "RUNNING"
  영구 잔존(BOFU_OPS Timed Out에 이어 Leads_OPS Build 중 "Error code INTERNAL"로
  재발)**: 신규 순수 함수 `computeSelfHealedPipelineState_()`(`MASTER_002_PipelineAsync.js`
  v1.15.0) — RUNNING이 `LOCK_STALE_THRESHOLD_MS`(30분)보다 오래됐거나 `startedAtMs`
  없는 옛 스키마면 FAILED로 자동 전환(락 self-heal과 동일 원칙). `readPipelineStatusState_()`가
  읽을 때마다 적용해 `PIPELINE_LAST_FAILED_TYPE`도 같이 세팅, `runRetryPipelineTail()`
  시작부에서 self-heal을 미리 트리거하도록 배선 — 실전 검증 완료(New Leads 파이프라인
  자동 복구 후 전 구간 정상 완료 확인).

- **MTA 완전 동일 중복 1625건 재정리**: S&M_REP "All Leads"가 Salesforce 리포트와
  153건 차이 나는 걸 조사 중 발견 — `rebuildMTAMaster()`를 파이프라인(dedup 포함)을
  거치지 않고 직접 실행했던 탓에 새로 쌓인 중복이 안 지워진 상태였음.
  `runAutoDeleteExactDuplicateTouchRows()` 재실행으로 정리, 격차 574 vs 579(잔여
  5건은 보류)로 축소 확인.



## QA 에이전트 설계 및 구현 — `qa-review` 스킬 신규

`docs/OpenItems.md` #23("QA 에이전트 설계 — 착수 전, 임의로 설계하지 말 것")의 후속. 사용자
확인 결과 스코프는 데이터 정합성+리포트 값 검증+코드/엔지니어링 품질 3개 전부, 형태는 Claude
Code 서브에이전트/스킬. 탐색 결과 이 저장소엔 기존 `.claude/agents`/`.claude/skills`/
`.claude/commands`가 전혀 없었고, naming/version-header/중복선언/문법은 이미
`scripts/check-*.sh`가 커밋마다 강제 중이라 재구현 대상에서 제외. **Claude는 라이브
Google Sheet를 읽을 방법이 전혀 없음을 확인**(Sheets API/MCP/`clasp run-function` 전무)—
리포트 값 검증 모드는 "진단 함수 작성 → 사용자가 Apps Script 편집기에서 직접 Run → 결과
붙여넣기" 가이드형 워크플로우로 설계. `.claude/skills/qa-review/SKILL.md` 신규(Apps Script
코드 변경 없음), `docs/QAAgentDesign.md` 설계 문서 신규, `CLAUDE.md`/`docs/OpenItems.md` #23
갱신. **세션 후반 실사용 테스트**: 이번 세션 중에 만든 스킬이라 스킬 목록이 그 자리에서 바로
갱신되지 않아(다음 세션부터 정상 인식 예상) `Skill` 도구 호출은 실패, SKILL.md 내용을 수동으로
따라 Mode 1(코드 품질 리뷰)을 오늘 변경 코드에 시연 — 개선 권고 4건 발견(전부 경미, 아래 참고).

## 비율/퍼센트 컬럼을 정적 값 → 실제 시트 수식으로 전환

사용자 요청 — Events_OPS의 "Success %" 등 여러 % 컬럼이 JS에서 미리 계산한 숫자만 시트에
쓰고 있어, 분자/분모로 쓰인 수동 입력 컬럼(Spent 등)을 나중에 고쳐도 파이프라인을 다시 돌리기
전까진 반영이 안 되는 문제. 셀에 실제 `=IFERROR(...)` 수식이 들어가도록 전환해 수동 입력값
수정 시 자동 재계산되게 함. 스코프는 **OPS 4개 시트 + ACQ_REP + NewP1_REP** — Target_REP(값
자체가 벤치마크 기반 다단계 역산이라 같은 행 두 컬럼 나누기가 아님), FY_REP CPL(드롭다운으로
Spent/Results/CPL 중 하나만 표시하는 구조라 Spent/Results 셀이 화면에 동시 존재하지 않아 참조
불가 — 구현 중 발견)은 제외.

- **탐색으로 확인한 재사용 가능 인프라**: `columnIndexToLetter_()`(`EVENTS_005_Write.js`, 구
  `54_Events_Write.js`)가 이미 컬럼 인덱스→A1 문자 변환 공용 함수로 존재. 수식 문자열을
  `setValues()`에 넣는 전례도 이미 있음(`writeEventsSubtotalRow_()`의 SUBTOTAL 수식,
  `AD_006_KakaoMoments.js`의 IF-가드 나눗셈 수식).
- **신규 공용 헬퍼**(`EVENTS_005_Write.js`에 추가, 기존 관례 따름): `buildRatioFormula_()`
  (분모 0 → 고정 fallback, OPS 4개 시트 전부 이 케이스), `buildGuardedRatioFormula_()`(분자
  또는 분모 셀이 공란이면 무조건 공란 — Target%/CPNP1처럼 외부 조회값이 없을 수 있는 컬럼용,
  `guardColLetter` 인자로 어느 쪽을 가드할지 지정).
- **OPS 4개 시트**(`EVENTS_004_Merge.js`/`BOFU_004_Merge.js`/`SEARCH_004_Merge.js`/
  `CONTENT_004_Merge.js` 및 각 `_Config.js`): `applyXGroup5Derived_()` 계열 함수와
  `divideGuard_()`(사용처 grep으로 전체 확인 후 삭제) 제거, `RATIO_FORMULAS` Config 스펙 +
  공용 `applyRatioFormulas_()`(`EVENTS_004_Merge.js`)로 대체 — 정렬 후 최종 행 배열이 확정된
  시점에 수식 주입.
- **ACQREP_001_Report.js**: All P1%/New Leads%/New P1%(0 fallback), Revenue Target%/New P1
  Target%(공란 fallback, "Target 없음"과 "Target=0" 구분) 전환. On Track 하이라이트 로직은
  원본 값 기반이라 영향 없음.
- **NEWP1REP_001_Report.js**: SAL%/IC Booked%/IC Complete%/Won%(공란 fallback, ACQ_REP
  메인비율과 fallback 값이 다름에 주의해서 반영), CPNP1/New P1 Target%(값 없음 가드).
- 각 컬럼마다 "분모 0/값 없음" 처리 방식(0 vs 공란, 분자 가드 vs 분모 가드)이 실제로 전부
  달라 기존 JS 삼항연산자 로직을 하나하나 정확히 재현 — 획일적으로 가정하지 않음.

## ACQ_REP 스타일링 조정 (사용자 요청 4건)

- **New Leads%(H) 중앙값 강조 제거** — 불필요 판단, `highlightAboveMedian_()` 삭제(다른
  사용처 없음 확인).
- **CPNP1 On Track 강조 신규** — 사용자가 이미 ACQ_REP에 수동으로 만들어둔 X열("CPNP1" 헤더,
  X4)에 On Track(Actual ≤ Target, CPNP1은 낮을수록 좋은 지표라 방향 반대) 강조 추가.
  `CONFIG.ACQ.CPNP1_COLUMN`(24) 신규. Target CPNP1 = Target_Engine Block 0 수동 Spent ÷ New
  P1 Target(기존 `computeReportTargetLookup_()`의 `spent` 필드 재사용, 처음으로 소비). X열의
  값/수식 자체는 전혀 안 건드리고 배경/볼드만 적용.
- **Revenue On Track이면 Segment(C열)도 같이 강조**.
- **On Track 강조 셀(S/T/V/X) + F/J 세그먼트 상위 25% 강조에 볼드 추가** — 지금까지 색만
  칠하고 볼드는 없었음.
- 위 과정에서 완전히 미사용 상태가 된 `highlightAtOrAboveThreshold_()`(NewP1_REP의 마지막
  호출부가 아래 항목으로 대체되며 orphan화)도 함께 삭제.

## NewP1_REP 스타일링 조정 (사용자 요청)

- New P1 Target%(Q)가 100% 이상(On Track)이면 Q 하나만이 아니라 **C(Segment)/D(New P1)/Q
  세 컬럼 모두** 강조하도록 확장 — 신규 `applyNewP1TargetOnTrackHighlight_()`
  (`NEWP1REP_002_Styles.js`). 기존 옅은 초록(#C6E0B4, 볼드 없음) 대신 ACQ_REP과 동일한 밝은
  초록(#01ef18)+볼드로 색상 통일. 재실행 시 이전 강조가 안 남도록 배경/폰트weight 초기화 로직도
  같이 정리.

## 파일 전체를 신규 네이밍 컨벤션(`STAGE_NNN_Name.js`)으로 정리

2026-07-30에 결정만 되고 "별도 세션으로 보류"돼 있던 작업(당시 `AD_*`/`FYREP_*` 신규 파일에만
적용, 기존 65개 `NN_Name.js` + `00_UploadDialog.html`은 미착수) — 이번 세션에서 전체 전환
완료. `CORE`/`IMPORT`/`MASTER`/`UTIL`/`OPS`/`ACQREP`/`NEWP1REP`/`EVENTS`/`BOFU`/`SEARCH`/
`CONTENT`/`TARGET`/`MAINT`(신규, 워크북 전체 유지보수 — Target과 무관해 별도 분리)/`RESET`/
`TEMPQA`(신규, TempQA 스크래치 파일 6개를 원래 흩어져 있던 도메인 번호대 대신 단일 스테이지로
통합 — 사용자 확정) 15개 스테이지로 재편.

- **기능적 위험 요소 처리**: `IMPORT_001_Import.js`(구 `00_Import.js`)의
  `HtmlService.createTemplateFromFile("00_UploadDialog")` 문자열 참조를
  `"CORE_003_UploadDialog"`로 같이 수정(안 고쳤으면 업로드 다이얼로그 전체가 깨졌을 것) —
  `CORE_003_UploadDialog.html` 내부의 동일 문자열 상수도 같이 정리.
- 파일마다 Version/Change Log에 "구 파일명 → 신 파일명, 코드 내용 변경 없음" 한 줄 기록.
  버전 헤더 형식이 파일마다 미묘하게 달라서(2-part/3-part 버전, 한 줄/두 줄 Version 표기,
  Change Log 섹션 자체가 없던 옛 파일도 있었음) Node 스크립트로 자동화하되 케이스별 분기 처리.
- `docs/NamingConvention.md`에 `STAGE_NNN_Name.js` 규칙 자체를 정식 문서화(지금까지
  `docs/Changelog.md` 2026-07-30 항목에만 서술돼 있었고 정작 컨벤션 문서엔 없었음),
  `CLAUDE.md`의 옛 파일명 언급 2건도 갱신.
  **히스토리 문서(`docs/Changelog.md` 자체, `docs/exec-plans/**`, 각 파일 Change Log의 과거
  날짜 항목)는 소급 개명하지 않음** — 그 시점 실제 파일명 기록 보존 원칙.
- **미해결로 남긴 것**: `docs/ImportPipeline.md`/`docs/ACQReportDesign.md`/
  `docs/OperationsLayer.md`/`docs/OpenItems.md` 등 20여 개 문서에 옛 파일명 참조가 총 200개
  이상 남아있음(예상보다 훨씬 큰 규모라 이번 세션에서 미처리) — 다음에 처리 여부 확인 필요.
- `scripts/check-*.sh` 4종 전부 통과, `safe-clasp-push.sh`로 76개 파일 배포 확인.

## 안 쓰는 함수 정리

전체 745개 함수(`test*` 176/`run*` 103/`_`헬퍼 392/기타 74) 전수 조사 — **고아 테스트 0건,
참조 없는 헬퍼 0건**(오늘 세션 초반 수식 전환 작업 중 실제 죽은 코드는 이미 다 정리했었음).
유일한 후보 `debugListAllSheetNames()`(`ACQREP_002_Summary.js`, 호출부 없음+주석에 "TEMP"
명시)만 사용자 확인 후 삭제. `createReportMenu()`(`CORE_002_Menu.js`)는 의도적으로 비활성
보존된 함수라 그대로 유지.

## 다음에 다룰 항목
- **문서 내 옛 파일명 참조 정리 여부 확인** — 위 "미해결로 남긴 것" 참고, 20여 개 문서·200개+
  참조. 히스토리 문서(Changelog/exec-plans)는 제외하고 현재상태 서술 문서만 대상.
- **`qa-review` 스킬 정상 인식 확인** — 다음 세션에서 `/qa-review` 또는 자연어 트리거로 재확인.
- 오늘 세션 리뷰에서 나온 경미한 개선 후보(우선순위 낮음, 임의로 처리하지 말 것):
  1. `buildRatioFormula_()`/`buildGuardedRatioFormula_()`(`EVENTS_005_Write.js`)를 신규
     `UTIL_` 스테이지로 이전할지 검토 — 지금은 Events 파일에 있는데 ACQ_REP/NewP1_REP까지
     공용으로 씀.
  2. ACQ_REP의 `revenueOnTrack`/`newP1OnTrack`/`cpnp1OnTrack` 판정 로직을 인라인에서
     pure 함수로 분리해 단위 테스트 대상으로 만들지 검토.
  3. `ACQREP_003_Styles.js`의 X열(CPNP1)에 다른 Target 컬럼처럼 로직 설명 Note 추가.
  4. NewP1_REP의 on-track 강조(`applyNewP1TargetOnTrackHighlight_()`)를 ACQ_REP처럼
     배열 기반 배치 처리로 통일할지 검토(현재는 per-row 개별 호출, 성능 문제는 없음).
- 실 시트에서 오늘 변경사항 전체(수식 표시 확인, On Track 색칠 확인, 새 파일명으로 편집기에
  잘 보이는지, 업로드 다이얼로그 정상 동작) 사용자 확인 대기 — 완료로 간주하지 말 것.

## (세션 계속) `qa-review` 스킬 실사용 + Biz Segment QA 실행·룰 수정

앞선 세션에서 만든 `qa-review` 스킬을 이어지는 새 세션에서 실제로 테스트런/실사용했다.

- **Mode 1 테스트런**: 직전 커밋(9bcdc41)의 실제 로직 변경분(Events/ACQ_REP)을 리뷰 — `EVENTS_004_Merge.js`의
  `applyRatioFormulas_()`가 `RATIO_FORMULAS` 스펙 컬럼을 header에서 못 찾으면 조용히 건너뛰던 silent-skip
  발견. `Logger.log` 경고 추가 + `testApplyRatioFormulas()`에 존재하지 않는 컬럼 참조 케이스 추가
  (`UTIL_001_TransformHelper.js`가 아니라 `EVENTS_004_Merge.js` v1.12.0).
- **Mode 2 (Import 단계 리드 QA 갭 체크)**: "import될 때 리드 QA"를 확인해달라는 요청 — 실제로는 이미
  `runOPSQA_()`(`checkExactDuplicateLeadRows_`/`checkLeadIdUniqueness_` 등)가 `runLeadsPipelineTail()`
  → `buildLeadsOPS()` 체인으로 매 Leads 백그라운드 실행마다 자동 호출되고 있어(2026-08-04부터 배선)
  이미 커버됨으로 결론, 코드 변경 없음.
- **Biz Segment QA / Marketo-UTM 매칭 QA 서브에이전트 신규**: 사용자 요청으로 `.claude/agents/
  biz-segment-qa.md`/`.claude/agents/utm-matching-qa.md` 생성 — `qa-review`의 "서브에이전트 대신
  스킬" 결론(§4)에 대한 명시적 예외로 `docs/QAAgentDesign.md` §9에 기록. 각각 기존 진단 함수
  (`TEMPQA_001_BusinessSegment.js`의 `runTempQABusinessSegment()`, `UTIL_002_UtmProgramDictionary.js`의
  `runRefreshUtmProgramDictionary()`/`runListAmbiguousUtmProgramEntries()`)만 재사용하도록 명시,
  새 진단 함수는 만들지 않음. **이번 세션 도중엔 신규 서브에이전트가 인식되지 않음**(세션 시작 시
  agent 목록이 고정되는 것으로 추정) — 다음 세션부터 정상 트리거 예상.
- **화/금 자동 QA 리마인더 routine — 보류**: 매주 월/목 업로드 기준 화/금에 두 QA를 자동 리마인드하고
  싶다는 요청으로 `/schedule` 검토했으나, 클라우드 routine은 격리 sandbox(이 repo git checkout만 접근)라
  실제 시트/Apps Script를 건드릴 수 없어 "텍스트 리마인더"까지만 가능함을 확인 — 사용자가 일단 수동
  진행으로 결정, `docs/OpenItems.md` #24로 기록.
- **Biz Segment QA 실행 결과 반영**: `runTempQABusinessSegment()` 실행 결과 중 "Other (룰상으로도
  Other)" 플래그를 육안 검토.
  - Campaign/Detail 둘 다 빈 값 + Lead Source만 있는 284건 — 조사 결과 (1) `SEARCH_CATCHALL_
    LEAD_SOURCE_OVERRIDES`의 기존 의도된 매핑, (2) 일부는 **Salesforce/Marketo 동기화 이슈**로 확인
    (Lead ID `00QRC00001FRZ2C` — Marketo 클릭 로그엔 UTM이 있으나 Salesforce Lead 자체엔 First Touch
    필드가 비어있음, 사용자가 Salesforce에서 직접 확인). 코드 문제 아님 — `docs/
    BusinessSegmentClassification.md`에 근거 기록, 코드 변경 없음.
  - Campaign에 "bofu"/"webinar"/"seminar" 단어가 그대로 있는데도 Other로 떨어지던 **진짜 룰 갭
    발견·수정** — 세 판정 전부 이 단어들을 Detail에서만 체크하고 Campaign은 붙임말 패턴만 봤음(예전
    Content의 "campaign만 체크" 버그와 반대 방향의 동일 유형). `campaign.includes("bofu"/"webinar"/
    "seminar")` 추가(`UTIL_001_TransformHelper.js` v1.15.0), 신규 테스트
    `testGetBusinessSegmentCampaignBareKeywords()`.
  - 키워드로 일반화 불가능한 8건은 `BUSINESS_SEGMENT_EXCEPTIONS`에 개별 확정 추가(v1.16.0) —
    why-crimson-is-the-best/2026-admissions-trends/all-about-us-and-uk-med/sa-ha-admit/uk-medicine/
    2024-early-admissions-result-analysis/major-strategy-part-2-humanity-and-liberal-arts-kuk → Webinar,
    honors-that-get-into-the-ivy-league-eb-email-cta → Content. `kr_core_2021-09-01_contactus`는 이번에도
    "BOFU 아니냐" 질문이 나왔으나 로그 대조 없이 한 판단이라, 예전 로그 대조 배치("Other", v1.12.0)가
    더 신뢰도 높다고 사용자 확인 — 값 유지, 회귀 테스트만 추가.
  - `rebuildLeadsMaster()` → `buildLeadsOPS()` 재실행으로 반영. 첫 시도에서 `writeOPS()` 타임아웃
    발생(`docs/PerformanceBenchmark.md` 2026-08-09 항목 — 2026-07-25와 동일 패턴, 코드 버그 아님으로
    판단) → 재시도로 정상 완료(OPS Records 5833, 246.94s).
- **`mergeOPS()` 중복 로그 노이즈 제거**: 중복 이메일 스킵마다 찍던 `Logger.log("[mergeOPS] Duplicate
  skipped...")`(실측 739줄) 삭제 — 카운트(`summary.duplicate`)는 유지, BUILD SUMMARY 총계로 이미
  확인 가능해 정보 손실 없음(`OPS_004_Merge.js` v3.2.4).

**미해결로 남김(사용자 확정, 다음 세션 TODO)**: 이번 `buildLeadsOPS()` 실행에서 나온 OPS QA 결과
(Total Issues 9765 — Funnel Match 불일치: IC Booked Date 2904/IC Completed Date 2769/Opportunity Won
Date 2696, Revenue Existence 746, Exact Duplicate Lead Row 650) 전부 오늘 세션 범위 밖이라 손대지
않음 — 다음에 확인.

## (세션 계속) Target_REP UI 개선 3건 + ACQ/NewP1 월 구분 테두리 + NewP1_REP Revenue 문의(오탐)

- **셀 테두리 강화 + 세그먼트 구분선**: Target_REP 전 셀 그리드 색을 `#CCCCCC`(짝수 행 배경과 대비
  약함)에서 `#999999`로 진하게, 고정 컬럼/각 세그먼트(Seminar/Webinar/BOFU/Search/Content) 블록
  경계에 굵은 구분선(`#434343`, SOLID_MEDIUM) 추가(`TARGET_003_Styles.js` v1.8.0).
- **Actual 달성 시 하이라이트**: 조건부 서식(수식 기반)으로 P1은 Target>0이고 Actual≥Target(합계)이면,
  CPNP1은 Target>0이고 Actual≤Target(낮을수록 좋음)이면서 실제 값이 있을 때 초록(`#01ef18`)으로
  강조 — `applyTargetReportAchievementHighlights_()` 신규. 값이 아니라 수식이라 Actual만 갱신하는
  경량 경로(`updateTargetReportActuals_()`)에서도 자동 재평가. **실측 버그 수정**: Target이 0인
  주(세그먼트 목표 없음)에서 Actual도 0이면 "0≥0"이 참이 돼 오탐 강조되던 문제를 `Target>0` 가드로
  해소(v1.8.1). 하이라이트 색도 사용자 요청으로 `#b7e1cd`→`#01ef18` 변경.
- **주별 CPNP1 재설계(가장 큰 작업)** — 사용자 리포트: "CPNP1이 3개 주 값이 동일함". 원인은
  Actual CPNP1이 월 단위 `Ad_Spend_Cache`(FY|Month|Segment)를 그 달 모든 주에 반복 표시하던 구조
  (2026-08-04 도입, §8이 원래 반려했던 "월 평균 분배" 패턴이 재도입돼 있었음). Meta(`AD_002_Meta.js`
  v1.7.0)/Naver(`AD_003_NaverSearch.js` v2.15.0)/Kakao(`AD_005_KakaoChannel.js` v1.3.0) 3개 플랫폼
  지출 집계를 월 단위 옆에 주(월~일) 단위로 신규 추가(기존 월 단위 함수/출력은 그대로 유지,
  ACQ_REP/FY_REP 하위호환). 정확도는 플랫폼마다 다름 — Naver(API를 주 단위로 직접 조회)/Kakao
  (SentAt 단일 날짜 직접 귀속)는 근사 없는 참값, Meta는 실무 export가 보통 월 단위라 정밀 export가
  없는 한 캠페인 활성기간 균등분배 근사값(월 버전과 동일한 "정밀 export 우선" 패턴 재사용).
  신규 캐시 시트 `Ad_Spend_Cache_Weekly`(`AD_004_SpendCache.js` v1.5.0 `refreshAdSpendWeeklyCache_()`/
  `readAdSpendWeeklyCacheMap_()`, `AD.SPEND_CACHE.WEEKLY_CACHE_SHEET`) — Target 주 사이클 전환일
  (Cutover Date)부터만 채움(그 이전 주는 Target_REP도 원래 공란 규칙). WeekStart 컬럼은 Sheets가
  "yyyy-MM-dd" 문자열을 Date로 자동 변환하는 걸 막기 위해 쓰기 전 `setNumberFormat("@")`로 텍스트
  고정. `periodicRefreshAdSpendCache_()`가 이 캐시도 같은 주기(4시간)로 갱신하도록 확장(실패 격리
  유지). `TARGET_002_Report.js`(v1.10.0)의 `computeTargetActualCPNP1ByGroupMonth_()`를
  `computeTargetActualCPNP1ByGroupWeek_()`로 완전히 대체(구 함수 삭제) — 실 사용자 실행으로 15행
  생성(Cutover 2026-08-03~실행 시점 약 3주 × 5세그먼트) 확인, 주별로 서로 다른 CPNP1 표시되는 것
  사용자 확인 완료.
- **ACQ_REP/NewP1_REP 월 블록 사이 굵은 구분 테두리 추가**: 짝/홀 줄무늬만으로는 흰 배경 블록끼리
  이어질 때 월 경계가 잘 안 보이던 문제 — ACQ_REP은 고정폭 블록(`computeACQMonthBlockDividerRowOffsets_()`,
  `ACQREP_003_Styles.js` v1.14.0), NewP1_REP은 가변폭 블록(`computeVariableBlockDividerRowOffsets_()`,
  `NEWP1REP_002_Styles.js` v1.6.0)이라 각각 다른 경계 판정 로직 필요 — 둘 다 각 블록 마지막 행에
  `#434343` SOLID_MEDIUM 오버레이. 사용자 확인 완료.
- **NewP1_REP 8월 Search Revenue $73,029.39 미반영 문의 — 진단 결과 오탐(코드 버그 아님)**:
  진단 함수(`TEMPQA_012_NewP1AugustSearchRevenueGap.js`) 실행 결과 Close Date 기준 8월 Search
  딜은 2건뿐이고 금액도 $66,265.87/$59,165.29로 사용자가 말한 금액과 안 맞음 — 확인 결과 사용자가
  가리킨 케이스는 세그먼트가 Search가 아니라 Webinar였음(사용자 확인). 다만 이 과정에서 NewP1_REP의
  Revenue가 Close Date가 아니라 **딜의 Created Date** 기준으로 월별 귀속된다는 기존 설계(2026-07-28
  확정)를 재확인 — Close Date 기준으로 리포트를 읽으면 계속 혼동 소지 있음, 별도 이슈 아님.

# Changelog — 2026-08-08

## FY_REP(FY24~27 Marketing/ACQ/Pipeline/Revenue 비교 리포트) 구현 — Report/Write 레이어 완성, 실 시트 검증 대기

- **FX 유틸 일반화**: `fetchFxRateToNzd_(currencyCode)`(AD_004_SpendCache.js v1.3.0) 신규 —
  기존 `fetchKrwToNzdRate_()`(KRW 전용)를 건드리지 않고 KRW/AUD/USD 임의 통화를 지원하도록
  확장. `AD.FX.RATES`(AD_001_Config.js v1.18.0) 신규.
- **FYREP_001_Engine.js 신규** — Marketing(perfTrackerByFY 외부 시트 플랫폼 블록 파싱,
  채널 동적 스캔, NZD 환산)/ACQ(New Leads/New P1/SAL)/Pipeline(IC Booked/Completed/Deals)/
  Revenue(회사 전체 Target × 딜 비중 추정 + Deal Tracker Close Date 기준 Actual) 4개 섹션
  Engine 전부 구현. 실측 중 발견: Spent 통화 판정은 플랫폼명이 아니라 라벨 자체의 "(NZD)"
  표기를 우선해야 FY24/25/26 전체가 정확(당초 가정과 다름). Revenue Actual은 처음 Created
  Date 코호트로 구현했다가 사용자 피드백("ACQ_REP처럼 그 달에 얼마 했는지를 봐야 한다")으로
  Close Date 기준 그 달 실제 발생액으로 전환.
- **FYREP_002_Report.js/FYREP_003_Styles.js 신규** — Report/Write 레이어를 사용자 피드백에
  따라 여러 차례 재설계 끝에 최종 확정:
  - Control Area: A1:B2 FY 범위(Start/End 드롭다운), C1:F2 섹션 체크박스(Marketing/ACQ/
    Pipeline/Revenue), C3:E3 지표 드롭다운(Revenue만 Actual 고정), A3:B3 Generate 체크박스.
  - Generate는 설치형 트리거(`onFYReportEdit_`/`runInstallFYReportGenerateTrigger()`)로 구현
    — 일반 onEdit Simple Trigger는 Marketing 섹션의 외부 시트 열기(`openById`)가 권한 부족으로
    실패하는 게 Target_REP 선례로 이미 확인돼 있어 처음부터 설치형으로 감.
  - 레이아웃: 세그먼트/채널이 컬럼, Month가 행, FY 범위만큼 블록이 세로로 반복(최신 FY가
    위로), 섹션당 지표 1개(드롭다운 선택). 모든 블록에 Total 행(컬럼 합계) + Sum 컬럼(행
    합계) + 전체 테두리. Revenue는 Sum이 그 달 회사 전체 Target을 넘으면 `#01EF18` 하이라이트.
  - Marketing 채널 표시명 매핑/제외 목록 추가(원본 채널명이 길어 컬럼 너비가 불안정했던 문제
    해소, "Others" 등 노이즈성 채널 제거).
  - `CONFIG.FYREP.FYS`를 하드코딩 `[24,25,26]`에서 `computeFYRepDefaultFYList_(24)` 호출로
    교체 — startFY부터 오늘이 속한 FY까지 자동 계산, 매년 8월 수동으로 배열을 늘려줄 필요 없음.
- **실측 버그 2건 발견·수정**: (1) Control Area 체크박스 기본값이 `isNew`(시트 자체가 새로
  생성됐을 때)에만 채워져, 기존 시트에 새 레이아웃을 얹을 때 체크박스가 전부 빈 값으로 남아
  섹션 0개가 생성되던 문제. (2) 정수 카운트 지표(New Leads/New P1/SAL 등)의 숫자 서식이
  `null`이라, Revenue(통화 서식) 실행 직후 재실행하면 이전 서식("$")이 Total 행에 남아있던
  문제 — 전 지표에 명시적 서식("#,##0" 등) 지정 + Styles 레이어가 조건 없이 항상 재적용하도록
  수정.
- **미해결(다음 세션)**: 실 시트에서 `setupFYReport()`→`runGenerateFYReport()`(또는 B3
  체크박스) 최종 검증 대기 — 완료로 간주하지 말 것. "Content Performance"가 Marketing
  채널로 잡히는 게 perfTrackerByFY 원본의 장식용 헤더 행이 스캔 로직에 블록으로 오인식된
  것으로 추정(실제 데이터 없는 빈 컬럼일 가능성) — 사용자가 삭제 대신 개명 요청해 그대로
  두었으나 스캔 로직 수정 여부는 미정. 상세 진행 기록: `docs/exec-plans/active/2026-08-07-fy-rep-implementation.md`.

## Ad_Spend_Cache 독립 주기적(4시간) 갱신 트리거 추가 — docs/OpenItems.md #19 해제

ACQ_REP를 refresh해도 Kakao Moments(메시지광고 API) 신규 데이터가 반영 안 된다는 문의로 조사한
결과, ACQ_REP 자체 refresh는 2026-08-06 성능 분리 이후 Ad_Spend_Cache를 읽기만 하고,
Kakao Moments API sync는 애초에 자동 파이프라인에 연결돼 있지 않았음을 확인. 사용자 확정
방향("외부 시트에서 주기적으로 api 콜을 하도록") — `periodicRefreshAdSpendCache_()`/
`runInstallAdSpendPeriodicRefreshTrigger()`(AD_004_SpendCache.js v1.4.1) 신규, 매
`AD.SPEND_CACHE.PERIODIC_REFRESH_INTERVAL_HOURS`(4, AD_001_Config.js v1.19.0)시간마다
Kakao Moments sync + `refreshAdSpendCache_()`를 자동 실행. 기존 Leads/MTA 파이프라인 tail의
`refreshCampaignSpend_()` 호출은 그대로 유지(하위호환). 실 사용자 실행으로 트리거 등록 확인.

## Kakao Moments 버그 2건 발견·수정 (실 데이터 실행 중 발견)

- **Event type 오분류**: `getBusinessSegment()`(16_TransformHelper.js v1.14.0)에 Webinar 판정
  `campaign.includes("online-event")` 추가 — 카카오모먼트 메시지 이름이 기존 "event-online"과
  반대 순서("...kakao-online-event")라 Other로 잘못 분류되던 문제, 사용자 실측 확인.
- **Cost/Sent/Reach/Click 등이 0으로 덮어써지는 버그**: 카카오모먼트 리포트 API가
  `dimension: "MESSAGE_AD"`로 요청해도 messageAdId당 한 줄이 아니라 **일자별로 여러 줄**을
  반환하는데(발송일엔 실적 있고 이후 날짜는 0), 기존 코드가 마지막(대개 0인) 날짜 값으로
  덮어써지고 있었음. `sumKakaoMomentsReportRowsByMessageAdId_()` 신규(AD_006_KakaoMoments.js
  v1.21.0) — 같은 messageAdId의 모든 날짜 행을 합산(CPL은 합산된 cost/conv_signup_7d로
  재계산)하도록 수정. 실 시트 재실행으로 Cost/Event type 정상화 확인.

## UTM Campaign ↔ Marketo Program 딕셔너리 신규 구축 + Kakao Moments 자동 채움 연동

KakaoSMS_Raw의 `Marketo program` 컬럼(Events_OPS 매칭용)을 사람이 매번 수기 입력해야 하는
문제 해결을 위해, 이미 쌓여있는 MTA_Master(`MKT UTM Campaign`/`Lead Source Detail`)에서
UTM↔Program 매핑을 자동 채굴하는 신규 딕셔너리 착수(사용자 요청, "마케토 프로그램-utm
딕셔너리 하자"). `71_Search_Engine.js`의 `SEARCH_UTM_TO_PROGRAM_OVERRIDE`(수작업 5~7개
하드코딩)가 정확히 이걸 자동화하는 전례.

- **17_UtmProgramDictionary.js 신규**(v1.3.0) — `readMtaMasterUtmProgramPairs_()`/
  `aggregateUtmProgramCounts_()`/`resolveUtmProgramDictionaryEntries_()`/
  `refreshUtmProgramDictionary_()`/`runRefreshUtmProgramDictionary()`/
  `readUtmProgramDictionaryMap_()`. 같은 UTM에 서로 다른 Program이 섞이면 다수결 채택 +
  확신도(Match/Total/Distinct Program Count) 기록. 자동 파이프라인엔 얹지 않음(MTA_Master
  8만 행+ 전체 스캔, 수동/가끔 실행 전용). 실행 결과: 총 3,674개 UTM 키, 640개 모호(약 17%).
- **모호한 UTM 원인 규명(실 데이터 진단)**: `runListAmbiguousUtmProgramEntries()`(후보 Program
  전부 펼쳐 보여주는 버전으로 재설계, 사용자가 "뭐가 모호한지 안 보인다" 지적 후 수정)/
  `runDebugMtaMasterTouchesForUtm()`로 실제 리드 터치 내역 확인 — Consolidated/Pmax류 복합
  캠페인은 UTM 하나가 여러 개의 서로 다른 eBook 등 Program과 **진짜로 1:N**(예: 한 UTM이 8개
  Program과 매칭). 같은 터치(같은 행) 안에서는 UTM/Program이 항상 정확한 짝이라 오류가
  아니라 캠페인 설계상 정상 — 사용자 확인 후, 이런 UTM은 자동 채움에서 제외하고 사람이
  직접 확인하는 것으로 확정(`readUtmProgramDictionaryMap_()`이 Distinct Program Count > 1인
  항목 제외).
- **Kakao Moments 연동**(AD_006_KakaoMoments.js v1.23.0) — `computeKakaoMomentsSyncRow_()`에
  선택적 `utmProgramMap` 파라미터 추가(하위호환), `syncKakaoMomentsReportToKakaoSMSRaw_()`가
  이 딕셔너리를 읽어 신규 행에 자동 채움. **재시도 로직 추가**(사용자 지적 — "미리 예측할
  필요 없이 리드가 들어온 후 매칭되는 값을 나중에 채워도 된다"): `mergeKakaoMomentsSyncRows_()`에
  `preserveOnlyIfNonBlankIndexes` 신규 — Marketo program은 기존 값이 **비어있을 때만** 매
  주기적 재동기화 때 최신 딕셔너리로 재시도, 사람이 입력한 값은 계속 보존.

# Changelog — 2026-08-07

## 세션 시작 자동 Pull 원칙 추가

- `scripts/start-session.sh`: 로컬이 origin보다 뒤처지기만 하고(ahead 없음) 로컬에 커밋 안 된
  변경사항이 없으면, 확인 없이 자동으로 `git pull`까지 진행하도록 수정(fast-forward만 가능한
  안전한 상황이므로). uncommitted 변경이 있거나 진짜 divergence(ahead+behind 동시)면 여전히
  자동 pull 안 하고 알림만. `CLAUDE.md`의 "Session-Start Git Sync Check" 항목에도 반영.

## Target_REP 버그 2건 수정 — 미래 주 Actual CPNP1 노출 + 월/FY 경계 주 오분류

- **버그 발견·수정 — 아직 시작하지 않은 미래 주에도 Actual CPNP1이 표시됨**: Actual CPNP1은
  월 단위 값을 그 달 모든 주에 반복 표시하는 구조라, 이번 달이 진행 중이면 아직 오지 않은
  주까지 월 누적 값을 미리 보여주고 있었음(사용자 리포트). `generateTargetReport_()`/
  `updateTargetReportActuals_()`(`91_TargetReport.js` v1.9.0)에 "weekStart > 이번 주 월요일이면
  공란" 가드 추가 — `docs/TargetReportDesign.md`에 이미 기록돼 있던 "미래 주는 Target만,
  Actual 공란" 원칙을 실제로 지키도록 수정.

- **버그 발견·수정 — 월 경계에 걸친 주가 월요일 하루만 보고 잘못 분류됨**(사용자 리포트: "8/31이
  하루라도 포함되면 AUG로 분류되고 있다"): 기존엔 그 주의 월요일이 속한 달력월을 그대로 그
  주의 "월"로 썼는데, 예를 들어 2026-08-31(월)~09-06(일) 주는 월요일 하루만 8월이고 나머지
  6일이 9월인데도 "AUG"로 분류되고 있었음. 신규 `getWeekMajorityDate_()`(그 주 목요일=월요일
  +3일이 항상 과반 쪽에 위치함을 이용한 순수 함수) + 이를 공유하는 `getWeekMonthLabel_()`/
  `getWeekFiscalYear_()`(`90_TargetEngine.js` v1.26.0)로 교체. **처음엔 월만 고치고 FY 귀속은
  월요일 기준으로 남겨뒀으나**, 검토 중 "FY와 월 귀속 기준이 다르면 아주 드물게 한 FY 리포트
  안에 AUG가 두 번 나타나고 Ad_Spend_Cache 조회 키(FY|Month)도 어긋날 수 있다"는 구조적 위험이
  발견돼 FY 귀속도 같은 과반 기준으로 확장(사용자 확인) — node 스크립트로 FY25~32 전체
  시뮬레이션해 매 FY 첫 주 AUG/마지막 주 JUL 유지 + 인접 FY 사이 공백·중복 0건 확인.
  `91_TargetReport.js`의 `computeTargetActualCPNP1ByGroupMonth_()`가 독립적으로 재계산하던
  month/fy도 같은 함수로 교체해 키 불일치 방지. `docs/TargetReportDesign.md` §4/§7 갱신.

## 실무자 공유용 OPS/REP 스펙 요약 Artifact 제작

- Leads_OPS/Search_OPS/Events_OPS/BOFU_OPS/Content_OPS(운영 시트 5개)와 ACQ_REP/NewP1_REP/
  Target_REP(리포트 3개)의 목적·데이터 소스·갱신 방식을 마케팅 실무자가 한눈에 볼 수 있게
  정리한 웹페이지 제작(Claude Artifact). FY_REP은 이 시점엔 미구현이라 제외.

## FY_REP 재착수 — 데이터 소스 전수 조사 + Config 확정

- **배경**: 2026-07-30 "별도 리포트 대신 ACQ_REP/NewP1_REP Target 컬럼 확장"으로 방향을
  틀었던 FY_REP을, 사용자가 "FY24/25/26 monthly Segment/Sales Funnel 비교"로 다시 요청 —
  이번엔 Marketing/ACQ/Pipeline/Revenue 4개 섹션 구조로 독립 `FY_REP` 시트 신규 제작 최종
  확정(기존 ACQ_REP/NewP1_REP Target 확장은 대체 아니고 그대로 유지·병행).
- **외부 데이터 소스 3개 실물 조사**(전부 읽기 전용 진단 함수로 확인, `96_TempQA_FYRepExternalSheet.js`
  신규): (1) 레거시 "0. Weekly" 외부시트 — FY23~26 Target/Spent는 있으나 세그먼트별 분해
  없음, 대부분 컬럼이 숨김 처리돼 있었으나 Apps Script는 숨김 여부와 무관하게 정상 읽음 확인.
  (2) 사용자가 공유한 디지털팀 다운로드 트래커(xlsx, Excel COM이 PowerShell에서 막혀 zip
  내부 XML 직접 파싱으로 확인) — 플랫폼별(Meta/Google/Naver) 월별 상세 데이터가 있으나 1개
  연도(파일명 "FY26"인데 실제론 우리 기준 FY27, 연도 rollover 시 이름을 안 바꾸는 습관 확인)
  분량만 존재. (3) `AD.SPREADSHEET_ID`(Campaigns 2.0) — 사용자가 "캠페인 데이터 재적재 시트"로
  언급한 게 실은 이미 파이프라인에 연결된 기존 소스였음을 확인(Meta_Raw/KakaoSMS_Raw 이미
  연동됨), `GoogleSearch_Raw`는 완전히 빈 탭이라 Google 자동 수집이 이 프로젝트 어디에도
  없다는 것도 함께 확인.
- **최종 소스 확정**: 사용자가 이 세션 중 신규 생성한 `perfTrackerByFY`(FY24/FY25/FY26 3개
  탭)로 확정 — Quarterly Summary(회사 전체 월별 Target/Spent/Revenue)와 플랫폼 블록(Meta/
  Google 여러 종류/Naver, 월별 Spent/Clicks/Leads/CPL을 상담·이벤트·콘텐츠 유형별로 분해)
  둘 다 보유. 헤더 행(FY24/25=25행, FY26=27행)과 월 컬럼(3~14열=8월~7월) 매핑까지 실측
  확정, "FY26" 탭 이름은 오표기이고 실제 데이터는 진짜 2025-08~2026-07(우리 기준 FY26)
  맞음을 사용자 확인. 연도별로 추적 플랫폼 구성이 다르고(FY24/25엔 TikTok/LinkedIn/Bing/
  Snapchat도 있었으나 FY26엔 빠짐), 플랫폼 통화도 서로 달라(NZD/AUD/USD/KRW) 전부 NZD로
  환산 표시하기로 확정.
- **`CONFIG.FYREP` 신규**(`00_Config.js` v1.29.0) — 위 실측 결과 전부 반영. 세그먼트는
  Target_REP의 5개가 아니라 Leads_OPS Business Segment 전체 7개(Referral/Other 포함, 목표
  배분이 아니라 실적 비교라 사용자 확정). Revenue 섹션의 세그먼트별 Target은 과거 실측값이
  시스템 어디에도 없어 회사 전체 Target × 그 FY Deal Tracker 딜 비중으로 추정할 수밖에 없음 —
  리포트에 "추정치"임을 명확히 라벨링하기로 확정.
- **진행 상황**: `docs/exec-plans/active/2026-08-07-fy-rep-implementation.md`에 전체 설계/
  결정사항/진행 체크리스트 기록. 실제 Engine/Report/Styles 구현은 다음 세션으로 이어짐 —
  Config까지만 완료.



## MTA lock-skip 유실 버그 대응 + Pipeline Status RUNNING/FAILED 표시·색상 추가

- **버그 발견·복구 — MTA 343건 batch가 백그라운드 refresh 없이 유실될 뻔함**: MTA Import 직후
  README Pipeline Status의 "New Leads" 행이 (관련 없는) 과거 실행의 DONE 상태를 그대로 보여주고
  있어 사용자가 혼동 — 조사 결과 `appendNewMTA()`가 `PIPELINE_LOCK`(당시 New Leads 백그라운드
  실행이 5분 전 진행 중이었음)을 못 잡아 백그라운드 refresh를 스킵했는데, 이 skip 경로가
  상태 기록도 재시도 마커도 안 남기는 설계 허점이었음(`docs/OpenItems.md` #9 실사용 검증 항목
  — 정확히 이 시나리오가 미검증 상태로 남아있었음). `MTA_LAST_ROW`가 이미 전진해 있어 재Import도
  무효, `runRetryPipelineTail()`도 FAILED 전용이라 못 잡음 — 이 batch를 자동으로 복구할 경로가
  없었음.

- **버그 발견·수정 — `runAutoDeleteExactDuplicateTouchRows()`(MTA_Master, `24_OPSQA.js` v1.6.1)
  배치 삭제 누락**: 위 batch 복구를 위해 `runMTAPipelineTail()`을 수동 실행했다가 삭제 대상
  1299건에서 5분여만에 Canceled — 원인은 이 함수가 2026-08-05 Leads_Master 쪽
  (`runAutoDeleteExactDuplicateLeadRows()`)에 적용된 배치 삭제 수정(`groupConsecutiveDescendingRows_()`
  + `sheet.deleteRows()`)을 못 받고 여전히 `sheet.deleteRow()` 1299회 반복 호출 중이었던 것
  — 동일 패턴으로 교체. 재실행 결과 828건 삭제 4초 완료, 이어 MTA Funnel Sync→전체 Engine
  refresh→OPS 재작성→Report Generate까지 전 구간 정상 완료 확인. 이어서 재실행한
  `runLeadsPipelineTail()`(중복 32건 배치 삭제→Leads_OPS Build→전체 체인)도 에러 없이 완료.

- **lock-skip 알림 문구 수정**(`07_IncrementalMasterBuild.js` v1.9.0, `00_Import.js` v3.7.0):
  "Leads_OPS/Report는 다음 정상 실행 때 자동 반영됩니다"라는 기존 문구가 위 버그로 사실이 아님이
  확인돼, "자동 재시도 안 됨 + 몇 분 후 08_PipelineAsync.js의 runLeadsPipelineTail()/
  runMTAPipelineTail() 직접 Run" 안내로 교체 — 메뉴 직접 실행(alert)/CSV Import 다이얼로그
  (`formatAppendSummary_()`) 둘 다 반영.

- **Pipeline Status 컬럼(Master Update~Target_REP) RUNNING/FAILED 표시 추가**(`08_PipelineAsync.js`
  v1.13.0, 사용자 요청): 기존엔 `state.stages[key]`가 boolean이라 그 단계가 끝나기 전까지 빈
  칸이었고, `refreshOPSSheets_()`/`refreshReportGenerate_()` 하위 단계 실패도 격리된 try/catch에
  조용히 삼켜져 영원히 빈 칸으로 남았음 — `"RUNNING"|"DONE"|"FAILED"` 문자열로 확장해 진행/실패
  여부가 실시간으로 드러나도록 함. 신규 `setPipelineStageStatus_()` 공용 헬퍼, `markPipelineStageComplete_()`는
  하위 호환 래퍼로 유지.

- **Pipeline Status 셀 색상 추가**(v1.14.0, 사용자 요청 — "running이면 빨갛게, done이면
  초록색으로 bold"): 신규 순수 함수 `computePipelineStatusGridStyles_()`가 RUNNING(빨강)/DONE
  (초록) 배경+글자색+bold를 계산, `writePipelineStatusToReadme_()`가 값 쓰기 직후 매번 같이
  적용. FAILED는 사용자 확인 결과 의도적으로 미채색 유지.

- `docs/OpenItems.md`에 22번 항목 신규 추가 — "Marketo Campaign ↔ UTM 딕셔너리 구축"(상세
  스코프 미정, 착수 전 확인 필요).

## 카카오모먼트 메시지 발송 검증 완료 + KakaoSMS_Raw 실제 sync 구현 + Events_OPS Spent 자동화

- **카카오모먼트 메시지 발송 검증**: 2026-08-05 발송된 메시지 실제 API 응답으로 필드 매핑 확정
  (Sent=msg_send/Reach=msg_open/Click=msg_click/Cost=cost/Responsed=conv_signup_7d/
  CPL=cost_per_conv_signup_7d). Event type은 메시지광고 이름을 `getBusinessSegment()`의
  campaign/detail 두 인자에 동일하게 전달해 판정(실제 메시지 2건이 서로 다른 명명 스타일이라
  한쪽 인자만으론 분류 실패 확인).

- **`KakaoSMS_Raw` 실제 sync 구현**(`AD_006_KakaoMoments.js`): `runSyncKakaoMomentsReportToKakaoSMSRaw()`
  신규 — messageAdId 키로 upsert(발송 후에도 지표가 최대 7일까지 계속 늘어나 append-only 대신
  upsert 채택), 리포팅 지연 시(message-ads/reports가 발송 직후 빈 응답) message-ads/list의
  임베디드 metrics로 Sent/Reach/Click/Cost 폴백. 스타일링 자동화(`applyKakaoSMSRawStyling_()`) —
  숫자 서식/CTR·CvR 수식/SentAt 내림차순 정렬/테두리. `AD_005_KakaoChannel.js`의
  `computeKakaoChannelSpendSummary_()`를 외부 수기 시트 대신 `KakaoSMS_Raw`로 리포인트,
  `Ad_Spend_Cache`→ACQ_REP Spent 반영 확인.

- **사고 발견·복구**: `Message Ad ID` 숨김 컬럼 추가 후 기존 291행이 새 18컬럼 레이아웃으로
  안 밀린 채 남아있던 문제 발견 — 진단 함수 여러 개로 원인(FY 공란 행이 판별 조건을 통과 못함)
  특정 후 전체 정렬 복구 완료.

- **`Marketo program` 컬럼 원복**: 처음엔 메시지광고 이름(UTM 스타일)을 자동 채웠으나, 조사 결과
  Events_OPS 매칭에 쓰는 실제 Marketo Program명(WB-/EV- 형식, Lead Source Detail에 찍힘)과는
  서로 다른 네이밍 체계라 자동 매칭 불가 확인 — 사람이 직접 입력하는 매칭용 컬럼으로 원복. 이
  과정에서 upsert가 수동 입력 컬럼(PIC/Push/비고/Marketo program)을 재동기화 때마다 덮어쓰던
  버그도 함께 발견·수정(`preserveColIndexes`).

- **Events_OPS `Spent` 자동 집계 신규**(사용자 확정 — Spent를 GROUP_3_MANUAL→GROUP_4_COMPUTED로
  전환, `50_Events_Config.js`): `computeEventsKakaoSpendAggregates_()`(`51_Events_Engine.js`)가
  `KakaoSMS_Raw`의 `Marketo program`(수동 입력)+`Cost`를 다른 Events 매칭과 동일한 키 정규화로
  프로그램별 합산, KRW→NZD 변환(`fetchKrwToNzdRate_()` 재사용) 후 `refreshEventsEngine_()`에
  배선 — 재빌드 때마다 알고 있는 모든 플랫폼 합계로 새로 계산(중복 합산 없음). 향후 Meta 등
  다른 플랫폼 자동화 시 같은 패턴으로 합산 예정.

- **`Success %` 공식 버그 수정**(`53_Events_Merge.js`): `Success ÷ SF Reg.`로 잘못 계산되고
  있었음 — `Success ÷ Mkt Reg.`로 정정(사용자 발견). SP1%/SNP1%는 원래부터 맞는 분모였음.

- 상세 진행 기록: `docs/exec-plans/active/2026-08-04-kakao-moments-api-integration.md`

## Revenue 숫자서식 버그 수정, Events/Search_OPS 개편, ACQ_REP/NewP1_REP Generate 성능 대개선

- **Revenue 숫자서식 버그 수정**: `writeMTAMaster()`가 이전 세션에서 `writeSheetRecords()`(overwrite) →
  `appendSheetRecords()`로 잘못 바뀐 채 미완성 상태였음(Full Rebuild마다 MTA_Master 전체가 중복 append되는
  회귀). `writeSheetRecords()`(`05_SheetWriter.js`)에도 `numberColumns` 지원을 추가해 원복하고,
  Revenue가 날짜로 오인식되지 않도록 `numberColumns=["Revenue"]`를 `writeMTAMaster()`
  (`14_MasterWriter.js`)와 증분 경로 `appendNewMTA()`(`07_IncrementalMasterBuild.js`) 둘 다에 적용.

- **Events_OPS 헤더 재구성**(사용자 요청): `50_Events_Config.js` HEADER 전체 재배치 — 신규
  `EV IC REQ.`(수동입력, Salesforce가 이벤트 단위 IC 신청 총계를 못 보여줘서 Ops가 직접 관찰값 입력),
  `Success %`/`SP1%`/`SNP1%`(Derived, Success/SF Reg. 등 SF 매칭 분모 대비 비율) 신규. `Mkt P1s`/
  `Mkt NLP1s`/`LP CVR`/`LG CVR`/`CPL` 삭제, `All CVR`→`CVR`/`Leads(Meta)`→`Results` 리네임.
  `stripLGSuffix_()`(`51_Events_Engine.js`) 신규 — Marketo Program 이름이 " LG"로 끝나는 변형을
  같은 프로그램으로 매칭(실제 중복 사례 발견). SF P1s/SF NLP1s/SP1%/SNP1% 4개 컬럼에 상위 25%(0 제외,
  컬럼별 독립 계산) 조건부 서식 강조(`#01ef18`) 추가(`55_Events_Styles.js`
  `applyTop25HighlightRules_()`/`buildPercentileHighlightFormula_()`). Revenue `$#,##0.00` 서식.

- **Search_OPS**: Naver 자동매칭 "Campaign" 컬럼 기본 숨김 처리(`70_Search_Config.js`
  `HIDDEN_COLUMN_NAMES` 신규, `75_Search_Styles.js`).

- **ACQ_REP/NewP1_REP Generate 성능 대개선** (실측 211초 → 최종 수 초~10여 초):
  1. Generate 체크박스가 매번 `refreshACQSummary_()`/`refreshNewP1Engine_()` 전체 재계산
     (MTA_Master 8만+행/Leads_OPS 3만5천+행 스캔)을 돌리게 시도했으나, All Leads/New P1/SAL/IC
     Booked/IC Complete는 Leads/MTA Import 시에만 바뀌고 이미 백그라운드 파이프라인이 최신 유지 중이라
     Generate 시점 재스캔이 무의미하다는 걸 확인 — Revenue(Deal Tracker)만 Import와 무관하게 바뀔 수
     있어 재조회 가치가 있다고 판단, `refreshACQSummaryRevenueOnly_()`(`31_ACQSummary.js` 신규)/
     `refreshNewP1EngineRevenueOnly_()`(`40_NewP1Report.js` 신규)로 Revenue만 경량 갱신하도록 축소.
     Spent는 범위 제외(기존 백그라운드 파이프라인에 계속 맡김).
  2. `readDealTrackerRawRows_()`(`90_TargetEngine.js`)가 외부 스프레드시트를 매번 두 번 여는 버그
     발견·수정(`findSheetByGid_()` 분리, `openById()` 1회로 통합).
  3. 그래도 여전히 느려서(Deal Tracker 행마다 `Utilities.formatDate()` 호출 등) **`DealTracker_Engine`
     내부 캐시 신규 도입**(사용자 제안) — `appendNewDealTrackerRows_()`(체크포인트 이후 신규 딜만 증분
     동기화, Generate 클릭 시점 포함)와 `rebuildDealTrackerEngine_()`(전체 재구축, 08_PipelineAsync.js
     양쪽 파이프라인 테일에 배선 — 기존 행 수정/재분류까지 반영하는 정합성 보정)로 이중화, `appendNewMTA()`/
     `appendNewLeads()`의 체크포인트 패턴과 동일 원리. `readDealTrackerRawRows_()`는 이제 이 캐시만
     읽어서 8개+ 기존 호출부(Events/BOFU/Content Engine 등)가 코드 변경 없이 전부 자동으로 빨라짐.
     최초 1회 `runRebuildDealTrackerEngine()` 수동 실행 필요.
  4. Generate를 설치형(Installable) onEdit 트리거로 전환(`handleReportGenerateEdit()`,
     `runInstallReportGenerateTrigger()` — 최초 1회 수동 실행 필요) — Simple Trigger의 외부 API/
     스프레드시트 접근 제한 회피. 시간 기반 1회성 트리거로 비동기 위임하는 방식도 시도했으나 Apps
     Script의 트리거 디스패치 자체가 1~2분+ 지연될 수 있음이 실측 확인돼(플랫폼 한계, 코드 버그
     아님) 최종적으로 동기 실행으로 재전환. 그 과정에서 발견한 별도 버그
     `schedulePipelineTail_()`(`08_PipelineAsync.js`)의 트리거 중복 예약(짧은 시간 내 반복 호출 시
     실행 큐에 계속 쌓이는 문제)도 수정 — `runLeadsPipelineTail()`/`runMTAPipelineTail()` 예약에도
     동일하게 적용되는 일반적 수정.
  5. **ACQ_REP F/J/S/T/V 컬럼 하이라이트 재설계**(사용자 요청, `32_ACQReportStyles.js`): F(All P1%)/
     J(New P1%)는 세그먼트별 상위 25%(0 제외) 조건부 서식으로 교체(기존 중앙값 강조 폐기, H는 유지).
     S(Revenue Target)/T(Revenue Target%)/V(New P1 Target%)는 "On Track"(Target÷그 달의 주 수 페이스
     대비 실적, `90_TargetEngine.js` `computeWeeksInMonthCountsForFYRange_()` 신규) 기준으로 교체(기존
     100% 고정 기준 폐기). N(Revenue) `$#,##0.00` 서식. 배경색 적용을 행별 개별 API 호출에서 JS
     배열 계산 후 `setBackgrounds()` 일괄 호출로 전환(성능 개선 겸용).

- **CLAUDE.md 갱신**: `clasp push` 원칙에 "코드 수정 후 함수 실행을 요청하기 직전엔 반드시 push
  여부를 스스로 확인" 문구 추가 — 이번 세션 중 push를 깜빡하고 실행을 요청해 사용자가 옛 코드로
  실행된 결과를 보고서야 발견한 사고 재발 방지.

# Changelog — 2026-08-05

## Search_OPS Naver 캠페인 매핑 10개 완료 + Spent/Results 자동화 (`docs/OpenItems.md` #21)

이전 세션에서 미확인이던 Naver 캠페인 5개 매핑을 사용자가 확인해주면서 이어간 라운드.
Impressions/Link clicks만 자동화돼있던 Search_OPS에 Spent/Results까지 추가로 자동화.

- **나머지 5개 캠페인 매핑 완료**: College Specific/UK Meds/Competitions/Brand(HStoDS)/
  Expo(사용자 확인) — `73_Search_Merge.js`의 `NAVER_CAMPAIGN_NAME_TO_SEARCH_OPS_KEY_OVERRIDE`
  10개 전체 매핑 완료. `expo_earlybird2_ptc`는 캠페인명의 "expo" 키워드 때문에
  `getBusinessSegment()`가 Seminar로 우선 판정 중이었으나 실제로는 Search가 맞다고
  사용자가 확인 — `BUSINESS_SEGMENT_EXCEPTIONS`(16_TransformHelper.js)에 예외 추가(Search_Engine이
  Business Segment=Search만 집계하는 구조라 Search_OPS 키 매핑만으로는 부족했음).
- **버그 발견·수정 — 캠페인 충돌 시 통계 덮어쓰기**: `HStoDS_contact`가 기존 `brand_contact`와
  같은 Search_OPS 키를 공유하게 되면서, 2개 이상의 Naver 캠페인이 같은 키로 번역될 때 나중
  캠페인이 먼저 것을 조용히 덮어써 통계가 누락되는 문제 발견 — 합산하도록 수정(사용자 확인).
- **Spent 자동화**: Naver `salesAmt`(KRW)를 기존 Impressions/Link clicks 누적 캐시에 얹어
  캠페인별로 누적, `fetchKrwToNzdRate_()`(AD_004_SpendCache.js)로 NZD 변환 후 Search_OPS
  "Spent"에 자동 매칭(사용자 확정 — ACQ_REP과 통화 통일). 환율 조회 실패 시 기존 값 보존.
- **Results 자동화 — Naver API 필드 실측 후 확정**: 공식 문서 사이트가 SPA라 필드 목록을
  스크레이핑할 수 없어 실제 `/stats` 호출로 후보 필드(ctr/cpc/avgRnk/ccnt/ccnt1d)를 개별
  실측 — `ccnt`가 200 정상 응답하고 값이 항상 clkCnt 이하라 "전환수"로 판단(사용자 확인),
  Spent와 동일한 패턴으로 Results 자동화 반영.
- **배포 직후 버그 발견·수정 — Spent/Results가 0으로 표시됨**: 원인은 이 코드 배포 이전에
  이미 오늘자 갱신이 한 번 돌아서 `refreshNaverSearchAdCampaignStatsCache_()`의 "오늘 이미
  갱신됨" 가드가 신규 필드 요청 자체를 막고 있었던 것 — 1회성 백필 함수로 해소.
- **Spent 전체 기간 소급, Results는 API 하드 리밋으로 90일 롤링 확정**: 백필 후에도 사용자가
  "캠페인 시작일부터의 전체 금액치고 작다"고 지적 — 실측 결과 `ccnt`는 salesAmt와 같이
  묶든 안 묶든 92일 제약을 그대로 받아(`{code:11004}`) Results는 전체 기간 소급이 원천적으로
  불가능함을 확인. 반면 `salesAmt` 단독은 이미 Ad_Spend_Cache 파이프라인에서 730일까지
  확인돼 있어, 기존 월별 반복 백필 패턴(`computeNaverSearchAdSpendHistorySummary_()`)을
  캠페인 이름 단위로 재사용해 Spent만 전체 기간(BACKFILL_START~오늘) 소급 백필 구현.
- **헤더 개명(사용자 요청)**: "Results" → "Results 90D" — ccnt가 API 자체 하드 리밋으로
  항상 최근 90일 롤링 값만 반영 가능하다는 걸 헤더에서 바로 알 수 있게 함. CvR 계산식/SUBTOTAL
  대상 컬럼 목록 등 관련 참조 전부 갱신(70/73/74_Search_*.js).

**검증**: Node vm 하네스로 신규/변경 pure 함수 전부 테스트 PASS, `check-syntax`/`check-naming`/
`check-version-header`/`check-duplicate-declarations` 매 라운드 통과, 매 라운드 `clasp push` 완료.

## 카카오모먼트 비즈니스 토큰 발급 완료 + 리포트 API 진단 착수

전날 세션에서 인가 코드 요청까지 진행하고 멈췄던 카카오모먼트 OAuth 연동 이어서 진행.

- **웹 앱 배포가 버전 1에 고정된 채 안 갱신되던 버그 발견·수정**: 동의 화면 재시도 후에도
  `Script function not found: doGet` 에러 재발 — `clasp push`는 스크립트 HEAD만 갱신할 뿐
  이미 만들어진 웹 앱 배포(버전 고정)는 안 건드린다는 것을 실측 확인(`docs/apps-script-gotchas.md`
  #11 신규 기록). `npx clasp deploy -i <deploymentId>`로 같은 배포(URL 불변)를 새 버전으로
  갱신해 해결.
- **비즈니스 토큰 발급 완료(사용자 확인)**: 동의 화면 통과 → 4개 스코프 전부 승인된 토큰 저장 확인.
- **리포트 API 진단 체인 구현**: 공식 문서 확인 결과 메시지광고 전용 리포트 API(`POST
  message-ads/reports`)를 쓰기로 확정(캠페인 보고서 아님). `messageAdIds`를 얻기 위한 선행
  체인(광고계정 목록→채널 프로필 목록→메시지광고 목록) 진단 함수 3개 + 리포트 진단 함수 1개를
  `AD_006_KakaoMoments.js`에 구현, 전부 실행해 실제 adAccountId/channelProfileId/messageAdId
  확보. 다만 실제 발송 완료된 메시지가 없어(하나는 당일 저녁 발송 예정, 하나는 삭제된 테스트)
  리포트 응답은 빈 배열 — `Reach`/`Responsed` 필드명 확정은 실제 발송 이후로 보류.

## ACQ_REP New P1 vs Salesforce 불일치(2026-07) 조사 — 근본 원인 규명 및 수정 (`docs/OpenItems.md` #20)

사용자 보고로 시작: ACQ_REP New P1(I열) 183건 vs Salesforce Priority 1 리드 205건. 최초엔
"New Leads" 전체 비교로 오인했다가 사용자 재확인으로 New P1 비교임을 확정.

**조사 과정**(`95_TempQA_JulyNewLeadsGap.js` 신규, 1회성 진단 함수 모음):
- Leads_Master에 7월 한 달만 Create Date 기준 1,266행(고유 리드 205개 대비 대량 중복) 발견.
- Leads_OPS 기준 라이브 재계산도 정확히 183(ACQ_REP과 일치) — 캐시/Report 갱신 문제가 아님을
  확인(`runRefreshACQSummary()`/E2 Generate 재실행 후에도 183 그대로였던 것과 부합).
- 누락 24건 중 23건은 Leads_Master에 완전 동일 Lead ID가 2~3번 중복 존재 — 낮은 rowIndex(먼저
  import)엔 "Priority 3", 높은 rowIndex(나중 import)엔 "Priority 1"로 실측 확인. 나머지 1건은
  Leads_OPS에 아예 없었음.

**근본 원인**: `runAutoDeleteExactDuplicateLeadRows()`(`24_OPSQA.js`, 중복 판정/삭제 로직 자체는
정상 설계)가 `08_PipelineAsync.js`의 `runLeadsPipelineTail()` 첫 단계로 정확히 배선돼 있었음에도
이 배치들에 대해 실행이 완료되지 못한 것으로 추정 — 실제로 이 함수를 수동 실행했더니
`sheet.deleteRow()` 659회 반복 호출 도중(약 3분) 실행이 저절로 중단되는 것을 실측. 중복이
쌓일수록 이 함수의 실행 시간이 계속 늘어나다 Apps Script 플랫폼이 실행을 강제 종료 →
`runLeadsPipelineTail()`의 최상위 try/catch(JS 예외만 처리 가능)가 개입 못 해 락이 영구히
안 풀리고, 그 이후 모든 Import의 백그라운드 처리가 계속 스킵되는 구조적 문제로 판명.

**수정 3건**:
1. `24_OPSQA.js` v1.6.0 — `groupConsecutiveDescendingRows_()`(순수 함수) + `deleteRows()` 구간
   단위 배치 삭제로 교체(기존 `deleteRow()` 반복 호출 제거). 판정 로직은 변경 없음.
2. `08_PipelineAsync.js` v1.7.0 / `00_Config.js` v1.26.0 — 파이프라인 락에 타임스탬프를 같이
   저장(`{type, acquiredAt}` JSON)해, `CONFIG.PIPELINE.LOCK_STALE_THRESHOLD_MS`(30분)보다
   오래된 락은 죽은 락으로 간주해 자동 해제(self-heal). 플랫폼 강제 종료로 락이 영구히 남는
   문제의 재발 방지책.
3. 수동으로 `runAutoDeleteExactDuplicateLeadRows()`(배치 버전, 4초 완료) → `buildLeadsOPS()` →
   `runRefreshACQSummary()` → ACQ_REP Generate 재실행 → **New P1 183 → 204로 정상화**(사용자
   확인). 남은 1건(`00QRC00001IUkqX`)은 버그 아님 — `mergeOPS()`의 "1 Email = 1 진짜 최초 접점"
   설계가 의도대로 동작(2023년 최초 Lead와 2026-07 재신청을 같은 이메일로 인식해 재신청 쪽을
   의도적으로 제외, 로그로 직접 확인).

## Raw 전체 스캔 성능 개선 (`docs/OpenItems.md` #18 부분 해결)

위 조사 중 사용자 질문("Raw가 재import로 계속 쌓이면 처리 속도가 느려지지 않냐")이 계기 —
`appendNewLeads()`/`appendNewMTA()`가 신규 행 수와 무관하게 매번 Raw 시트 전체를
`getDataRange().getValues()`로 읽고 있었음을 확인(Raw는 원본 보존 원칙상 절대 안 지워져
재import 시마다 계속 누적되므로 시간이 지날수록 이 전체 읽기가 느려지는 구조). 신규
`getRawSheetDataRowCount_()`(메타데이터만)/`readRawSheetFrom_()`(targeted `getRange()` 읽기,
`11_DataReader.js` v2.1.0)로 교체 — 처리 시간이 이제 "신규 행 수"에만 비례. 전체 재구축
(`rebuildLeadsMaster()`/`rebuildMTAMaster()`)과 진단 함수는 의도적으로 그대로 둠(전체 스캔 필요).
`07_IncrementalMasterBuild.js` v1.7.0.

## Events/BOFU/Search/Content OPS 시트 재작성 자동화 편입

`refreshEventsEngine_()` 등 Engine 캐시 refresh는 이미 파이프라인에 있었지만, 그 캐시를 실제
Events_OPS/BOFU_OPS/Search_OPS/Content_OPS 시트에 옮겨 적는 `buildEventsOPS()` 등 4개 함수는
2026-07-24 "초기 이관 기간 수동 실행"으로 남겨져 있었음(각 파일 헤더 참고) — 사용자 요청으로
자동화. 신규 `refreshOPSSheets_()`(`08_PipelineAsync.js`)가 4개 함수를 각자 독립 try/catch로
호출(하나 실패해도 나머지 계속), `runLeadsPipelineTail()`/`runMTAPipelineTail()` 양쪽에 배선.
`52/62/72/82_*_Build.js` 헤더 갱신, README 실무자 가이드 ④ 문구도 갱신.

## ACQ_REP/NewP1_REP Generate + Target_REP(Deal Tracker) Generate 자동화 편입

`refreshReportGenerate_()`(ACQ_REP/NewP1_REP Report Area 자동 재생성)는 2026-08-04부터 이미
파이프라인에 있었음 — 여기에 `generateTargetReport_()`(Target_Engine Block A~D 재계산 + Target_REP
재작성, Deal Tracker 참조)를 추가 편입(사용자 요청 — "campaign spend랑 deal tracker도 import
체인에 포함시키자"). 원래 Simple Trigger(체크박스+onEdit) 권한 제약으로 Target_REP만 수동 실행
전용이었으나(`docs/TargetReportDesign.md` 참고), 이 파이프라인 트리거는 설치형(Full Authorization)
이라 그 제약이 없어 안전하게 편입 가능. Block 0(Target FY 등 수동 입력)는 `refreshTargetEngine_()`가
절대 안 덮어쓰므로 반복 자동 실행에도 안전. 캠페인 지출(Ad_Spend_Cache)은 이미 2026-08-04부터
파이프라인에 연결돼 있어 추가 조치 불필요함을 확인. `docs/OpenItems.md` #11 갱신(Generate 자동화
완료 반영).

## Pipeline Status 표 레이아웃 전면 재설계 (단계=행 → 단계=컬럼)

기존 7행×3열(단계가 행, New Leads/MTA가 컬럼) 구조를 3행×12열(New Leads/MTA가 행, Master
Update~Target_REP 각 실무 영역이 컬럼)로 전환(사용자 요청). 각 영역 컬럼은 완료되면 "Complete",
아니면 빈 문자열. `CONFIG.PIPELINE.STATUS_COLUMNS`(00_Config.js 신규) 10개 컬럼: Master
Update/Leads_OPS/Events_OPS/BOFU_OPS/Search_OPS/Content_OPS/Campaign Spend/ACQ_REP/NewP1_REP/
Target_REP. `advancePipelineStage_()`에 선택적 `completedKeys` 파라미터 추가(단일 단계=단일
컬럼용), 여러 컬럼이 한 함수 안에서 개별 완료되는 `refreshOPSSheets_()`/`refreshReportGenerate_()`는
`(type, state)`를 받아 신규 `markPipelineStageComplete_()`로 하위 단계마다 스스로 표시하도록
전환. MTA 행의 Leads_OPS 컬럼은 `syncMTAFunnelToOPS_()`(09_MTAFunnelSync.js, 여러 실무 영역이
한 함수 안에 뭉쳐있음)가 통째로 끝나는 순간 한 번에 Complete — 리팩토링은 안 하기로 사용자
확정. Status 컬럼에 전체 진행상태+마지막 완료 시각을 압축 표시(`buildPipelineStatusCell_()`
신규). 옛 7행 레이아웃이 남아있는 시트는 다음 실행 때 자동으로 마이그레이션(고아 행 없이 교체).
`08_PipelineAsync.js` v1.11.0, `00_Config.js` v1.27.0.

## Search_OPS Campaign/Impressions/Link clicks 자동화 (Naver Search Ad API, `docs/OpenItems.md` #21 신규)

사용자 요청으로 Search_OPS의 `GROUP_3_MANUAL`(전부 수동 입력)에서 `Campaign`/`Impressions`/
`Link clicks`를 분리해 Naver Search Ad API 자동 매칭으로 전환(`Reach`는 Naver API에 해당
지표가 없어 계속 수동). **실측으로 두 가지 예상 밖 문제를 발견·수정**:

1. **API 조회 기간 제약이 예상과 다름**: 캠페인 지출(salesAmt) 파이프라인의 730일 제약을
   그대로 가정했으나, 실제로는 impCnt/clkCnt 필드가 별도로 "최근 92일 이내"만 허용됨이
   최초 실행 에러(`{code:11004}`)로 확인됨. 매번 전체 재계산 대신 `Naver_Search_Campaign_
   Stats_Cache`(신규 숨김 시트)에 캠페인별 누적치를 영구 보관하고 매 refresh마다 "지난
   갱신 이후~오늘"만 더하는 누적 캐시로 설계(사용자 확정) — `computeNaverSearchAdCampaignStatsFetchWindow_()`
   가 항상 API 허용 범위 안으로 사전에 clamp해서 요청, 재발 방지. `08_PipelineAsync.js`의
   `refreshNaverSearchCampaignStats_()`로 두 파이프라인 테일 모두에 배선.
2. **네임스페이스 불일치**: Naver 캠페인 실제 이름(예: `KR_core_brand_contact`)과 Search_OPS
   키(Marketo Program명, 예: `2025-07-KOR-Naver SA Brand`)가 서로 다른 시스템이라 직접 매칭이
   거의 안 걸림(실캠페인 10개 중 직접 일치 0개, 사용자 확인). `73_Search_Merge.js`의 신규
   `NAVER_CAMPAIGN_NAME_TO_SEARCH_OPS_KEY_OVERRIDE`(`71_Search_Engine.js`의
   `SEARCH_UTM_TO_PROGRAM_OVERRIDE`와 동일 관행)에 사용자가 육안 대조해준 5개 매핑 반영.

**잔여 TODO 2건(`docs/OpenItems.md` #21 참고)**: (1) `kr_core_study-consult_contact`는 애드그룹
단위로 US/UK가 섞여있어 정확히 분리 불가 — 대부분 US라 근사치로 일괄 매핑(사용자 확정),
애드그룹 단위 stats 조회 가능 여부는 검토 필요. (2) 나머지 5개 캠페인은 대응 Marketo Program
미확인, 확인되는 대로 override 추가 예정. `AD_001_Config.js` v1.16.0, `AD_003_NaverSearch.js`
v2.7.0, `70_Search_Config.js` v1.4.0, `71_Search_Engine.js` v1.15.0, `72_Search_Build.js`
v1.2.0, `73_Search_Merge.js` v1.4.0.

# Changelog — 2026-08-04

## 로컬/origin 재동기화 (다른 머신 세션과의 divergence)

세션 시작 `scripts/start-session.sh` 체크에서 로컬이 origin보다 3커밋 뒤처져 있음을 발견 —
다른 머신(사무실 등)에서 이미 Naver Search Ad API 파이프라인 + Kakao Channel spend
파이프라인이 추가된 상태였음. worktree 1개뿐이라 안전하게 fast-forward pull로 동기화 후
작업 시작.

## 백엔드 실행 체인 트리거 비동기화 구현 (`docs/OpenItems.md` #9)

**배경**: 2026-07-28 설계만 확정돼있던 항목 — `appendNewLeads()`/`appendNewMTA()`가 Master
append 직후 무거운 refresh 체인(buildLeadsOPS/syncMTAFunnelToOPS_/ACQ·NewP1·Events·BOFU·
Search·Content Engine·Target Actuals)까지 같은 실행 안에서 동기로 처리해 브라우저 다이얼로그가
몇 분씩 안 닫히는 문제(2026-07-25 실측)를 해소하는 게 목표. 상세 진행 기록:
`docs/exec-plans/active/2026-08-04-pipeline-async-triggers.md`.

**구현**: 신규 `08_PipelineAsync.js` — PropertiesService 기반 단순 락(`acquirePipelineLock_`/
`releasePipelineLock_`, Leads/MTA 공용 단일 키), 설치형 1회성 time-based 트리거
(`schedulePipelineTail_`), README 탭에 진행상태 표시(`writePipelineStatusToReadme_`, A1:C7
고정 블록, 최초 1회만 `insertRowsBefore`로 공간 확보), `runLeadsPipelineTail()`/
`runMTAPipelineTail()`(트리거 대상 겸 수동 재실행 진입점), `runRetryPipelineTail()`(실패
시 수동 재시도 전용). `07_IncrementalMasterBuild.js`의 `appendNewLeads()`/`appendNewMTA()`는
Raw→Master append/정렬은 그대로 동기 유지하고 그 이후만 락 확인 후 트리거로 위임 — 다른
백그라운드 작업이 이미 진행 중이면 이번 사이클은 Master append만 반영하고 알림 후 종료
(idempotent, 데이터 손실 없음).

**실 데이터 검증(2026-08-04)**: `runLeadsPipelineTail()` 최초 실행 — Apps Script Executions
로그 Successful, **363.546초(6m 3.5s)** 소요(`docs/PerformanceBenchmark.md` 기록). 트리거로
옮긴 목적은 체인 자체를 빠르게 만드는 게 아니라 브라우저를 막지 않는 것이었고, 실측으로
목적 달성 확인.

**실사용 피드백 기반 후속 개선 6건**(같은 날, 사용자가 실제로 써보며 순차 발견):
1. **Import→Append 자동 체이닝(스코프 확장)**: 원래 설계는 Import와 Append가 계속 별도
   수동 클릭이었으나, 사용자가 "Import 끝나면 Append까지 자동으로 이어지길 기대했다"고
   피드백 — `appendNewLeads()`/`appendNewMTA()`에 옵셔널 `silent` 파라미터 추가(기존 무인자
   호출부는 무변경, `buildLeadsOPS(skipQA)`와 동일 패턴), `00_Import.js`의 `importCsv()`가
   Raw 기록 직후 자동 호출하도록 변경. 신규 `formatAppendSummary_()`가 결과 메시지 통합.
2. **README 표시 개선**: Last Started/Finished가 스크립트 타임존(America/New_York,
   appsscript.json) 기준으로 찍혀 사용자가 혼동 — `CONFIG.DATE.DISPLAY_TIMEZONE`("Asia/Seoul")
   신규 도입 + " KST" 표기. 헤더 라벨 "Leads"/"MTA" → "New Leads Upload"/"MTA Upload"로 변경.
3. **ACQ_REP/NewP1_REP FY 드롭다운 자동 갱신**: 8월 진입(FY26→FY27) 데이터가 들어왔는데도
   Start/End FY 드롭다운에 "FY27"이 안 보인다는 보고 — `setupACQDropdowns()`/
   `setupNewP1Dropdowns_()`가 원래 "1회성 수동 실행" 설계였음을 문서 3곳에서 확인, 사용자
   확정으로 자동화 스코프 추가. 신규 `refreshReportFYDropdowns_()`를 두 백그라운드 tail
   마지막 단계로 추가.
4. **Report Generate까지 백그라운드 편입**: `generateACQReport_()`/`generateNewP1Report_()`를
   `refreshReportGenerate_()`로 감싸 자동 호출 — Control 행 FY 값 오류 등으로 실패해도 전체
   파이프라인은 FAILED로 만들지 않고 Logger에만 기록(사용자 확정 — Report 실패 때문에
   6분짜리 핵심 데이터 refresh 전체를 재실행하게 만드는 건 배보다 배꼽이 큼).
5. **완전 동일 중복 자동삭제도 백그라운드 편입**: 2026-07-28 구현·검증까지 끝났지만 "실데이터
   검증 전까지는 수동 Run" 방침으로 자동 체인엔 안 걸려있던 `runAutoDeleteExactDuplicateLeadRows()`/
   `runAutoDeleteExactDuplicateTouchRows()`(24_OPSQA.js)를 각 tail의 **첫 단계**(OPS/Engine
   갱신보다 먼저)로 추가 — 두 함수 모두 `SpreadsheetApp.getUi()` 미사용이라 트리거에서 안전.
   QA 전체(Funnel Match 등)는 여전히 스킵, 이번엔 중복 삭제 단독 기능만 자동화.
6. **README 실무자 가이드 섹션**: 비개발자 실무자용 안내(평소 할 일/진행상태 확인법/기간
   변경법/아직 수동인 것/장애 시 대응)를 신규 `runSetupReadmeGuide()`로 작성 — 정확한 위치를
   미리 정하지 않고 제목 텍스트로 기존 섹션을 찾아 갱신하거나 시트 맨 아래에 추가(위치 충돌
   없는 안전한 기본값).

`08_PipelineAsync.js` v1.0.0 → v1.5.0, `00_Config.js` v1.24.0 → v1.25.0,
`07_IncrementalMasterBuild.js` v1.5.0 → v1.6.0, `00_Import.js` v3.5.0 → v3.6.0,
`24_OPSQA.js` v1.4.1 → v1.5.0. 관련 문서(`docs/ACQReportImplementation.md`,
`docs/NewP1ReportDesign.md`, `docs/OpenItems.md` #8·#9·#13)도 최신 동작 기준으로 갱신.

## Import 다이얼로그 "Raw 기준 가장 최근 날짜" 표시 제거

2026-07-25 두 차례 성능 최적화(Master→Raw 기준 전환, 전체 스캔→`getRange()` targeted read)에도
불구하고 업로드 다이얼로그 오픈이 여전히 느리다는 실사용 피드백(사용자: "예전에 삭제하기로
했는데 안 돼있다") — git/Changelog 이력상 실제 삭제 커밋은 없었던 것으로 확인됐으나, 사용자
확정에 따라 `getLatestRawDate_()` 및 관련 표시 로직을 `00_Import.js`/`00_UploadDialog.html`에서
완전히 제거. `00_Import.js` v3.4.0 → v3.5.0.

## 신규 TODO 기록 (`docs/OpenItems.md`)

- 18. Import 업로드 다이얼로그가 대용량(특히 MTA) 처리 중 오래 대기 — Raw→Master append/정렬
  자체(백그라운드 트리거 이전 동기 구간)가 원인으로 추정, 아직 실측/설계 전.

## 카카오모먼트 메시지광고 API 연동 — 설계 착수 및 인가 코드 요청까지 진행

claude.ai 세션에서 넘어온 핸드오프 문서를 검토하다 선행 exec-plan(7/31)의 "기존 시트 완전
폐기" 기록과 정면 충돌 발견 — 재확인해 "`KakaoSMS_Raw` 재활용"으로 최종화. 새 exec-plan
`docs/exec-plans/active/2026-08-04-kakao-moments-api-integration.md` 신규. 이후 실제 구현
착수: `AD_006_KakaoMoments.js` 신규(비즈니스 인증 OAuth 2.0 — 인가 URL 생성/`doGet()` 콜백
수신/토큰 교환/진단), `AD_001_Config.js`에 `AD.KAKAO_MOMENTS.OAUTH` 섹션, `appsscript.json`에
웹 앱 배포 매니페스트 추가. 사용자가 웹 앱 배포 완료, 카카오디벨로퍼스에 Redirect URI 등록,
Script Properties 자격증명 입력까지 마쳤고, 인가 코드 요청 단계에서 문제 두 건을 실측
발견·수정: (1) `ScriptApp.getService().getUrl()`을 편집기에서 직접 Run하면 배포된 `/exec`가
아니라 카카오에 등록 안 된 `/dev` URL을 반환하는 버그 — Redirect URI를 Config에 하드코딩하는
방식으로 전환(`docs/apps-script-gotchas.md` #10 신규 기록). (2) scope에 `moment_create`가
있으면 `resource_ids` 파라미터가 조건부 필수라는 걸 KOE233 에러로 실측 — `moment:*`
와일드카드를 추가해 해결. 부수적으로 카카오 콘솔의 Client Secret이 "카카오 로그인용"/
"비즈니스 인증용" 2개로 분리돼 있다는 것도 발견해 Config 키 이름을 `_BIZAUTH`로 명확화. 또한
공식 문서 확인 결과 **비즈니스 토큰엔 Refresh Token이 없다는 것**을 발견 — 애초에 "Time-driven
Trigger로 자동 갱신"하려던 계획이 무효였음, 실제 사용(캠페인 지출 파이프라인의 주기적 호출)으로
미사용 만료를 회피하는 방식으로 정정. 다음 단계는 사용자가 인가 URL을 다시 열어 동의 화면을
통과하는 것 — 아직 토큰 발급 완료 확인 전.

## ACQ_REP/NewP1_REP — 캠페인 지출 자동화 확장 + 리포트 서식 정리

`docs/exec-plans/active/2026-07-30-acq-newp1-target-columns.md`의 미해결 잔재를 정리하다
발견한 문제들을 순차 수정:

- **레거시 컬럼 확인**: ACQ_REP AH:AK(옛 Target 컬럼 위치, 이미 S:V로 이전된 후 안 지워진
  잔재)는 코드가 전혀 참조하지 않는 죽은 데이터임을 확인 — 사용자가 직접 삭제. NewP1_REP R열도
  같은 종류의 잔재로 확인, 마찬가지로 코드 미참조.
- **NewP1_REP/Target_REP Spent 소스 전환**: "FY27 AUG Spent가 이상하다"는 리포트를 조사하다,
  ACQ_REP의 Spent(W열)는 이미 `Ad_Spend_Cache`(Meta+Naver Search+Kakao Channel 자동 집계)를
  쓰는데 NewP1_REP/Target_REP은 여전히 `Target_Engine` Block 0 수동 입력을 쓰고 있던 배선
  누락을 발견 — 둘 다 `readAdSpendCacheMap_()` 기반으로 전환(`40_NewP1Report.js` v1.4.0,
  `91_TargetReport.js` v1.8.0).
- **Naver Search Ad API 버그 발견·수정 — 730일 조회 제약**: 전환 후 Search 세그먼트가
  Ad_Spend_Cache에서 통째로 비어있는 걸 발견 — 원인은 히스토리 백필 반복 호출
  (`computeNaverSearchAdSpendHistorySummary_()`, 2022-09~오늘 매달) 중 730일보다 오래된 달에서
  나는 400 에러(`code:11004`, "최근 730일 이내 기간만 조회 가능")를 `callNaverSearchAdApi_()`가
  상태 코드 검사 없이 조용히 흡수하고 있었던 것. 429/5xx만 재시도하고, 이 특정 "조회 기간 초과"
  에러는 알려진 제약으로 보고 그 달만 건너뛰도록 수정(`AD_003_NaverSearch.js` v2.4.0). 실 시트
  재검증 완료(사용자 확인) — 2024-08 이전 달은 API 구조상 앞으로도 영구히 못 가져옴(한계로 기록).
- **캠페인 지출 자동 파이프라인 편입**: `refreshAdSpendCache_()`를 매번 수동 실행해야 했던
  걸 `08_PipelineAsync.js`의 배경 파이프라인 체인에 `refreshCampaignSpend_()`로 편입(사용자
  요청) — Leads/MTA 파이프라인이 돌 때마다 자동 갱신, 실패해도 핵심 파이프라인은 안 멈춤.
  독립 시간 트리거(리드 유입과 무관한 스케줄)는 필요성 없다고 판단해 `docs/OpenItems.md` #19
  TODO로만 기록.
- **리포트 서식 정리(사용자 요청)**: ACQ_REP S(Revenue Target)/W(Spent), NewP1_REP M(Revenue)/
  N(Spent)/O(CPNP1) → `$#,##0.00`. ACQ_REP U/NewP1_REP P(둘 다 New P1 Target, 원래 서식
  누락 상태였음 발견) → `#,##0`(정수만). Target 달성 시(≥100%) 하이라이트는 이미 반영돼 있던
  것 확인(`highlightAtOrAboveThreshold_()`, 32_ACQReportStyles.js v1.6.0부터).

`08_PipelineAsync.js` v1.6.0, `32_ACQReportStyles.js` v1.9.0, `41_NewP1ReportStyles.js`
v1.4.0. 관련 exec-plan 3개 갱신.

# Changelog — 2026-07-31

## 캠페인 지출 통합 Phase 1 — Kakao 플랫폼(Moments 권한신청 + Channel 파이프라인 구현) + Meta API 재도입 보류

**배경**: 위 "Naver Search API 파이프라인" 세션 이후 이어지는 라운드. 3번째 플랫폼으로
카카오를 다루면서, 앞으로는 "카카오 채널" 대신 "카카오모먼트"로 광고를 운영할 예정이라는
사용자 확인에 따라 두 갈래로 진행. 상세 결정 이력: `docs/exec-plans/active/
2026-07-30-campaign-spend-integration.md`.

**Meta API 재도입 — 보류(사용자 확정)**: 사용자가 Meta API 권한이 reinstate될 예정이라고
알려와 필요 사항(Marketing API 앱/`ads_read` 권한/System User Token/Ad Account ID 등)을
안내했으나, 자격증명이 실제 확보되기 전까지는 착수하지 않기로 확정 — exec-plan에 미해결
항목으로만 기록.

**카카오모먼트 — Open API 권한 심사 신청까지 진행, 승인 대기 중**: 공식 문서 확인 결과
Naver Search Ad API와 달리 OAuth 2.0 Business Auth 플로우 필요, 일반 광고주 계정엔 신청
메뉴 자체가 안 보이는 게 정상(공식대행사/사전 협의 광고주 대상)이라는 걸 확인. 카카오
디벨로퍼스 콘솔 "추가 기능 신청" 메뉴(최초엔 "앱 권한 신청"으로 잘못 안내했다가 정정)를
찾아 카카오모먼트 오픈API 권한 심사를 실제로 신청 완료 — 카카오 측 심사 기간 약 3일
(2026-08-03경 결과 예상). 승인 전까지 모먼트 구현은 보류.

**카카오 채널(기존 수기 데이터) — 3번째 플랫폼으로 파이프라인 완성 및 실 검증 끝**: 모먼트
승인 대기 중 병행 착수. 기존에 사용자가 별도 스프레드시트(`18Ld85fuR76tsVxshEuzZ17SV00c0BEI6Rtl3HjA20RI`,
"Performance" 탭)로 수기 관리해온 카카오톡 채널 푸시 발송 성과 데이터를 소스로 확정 —
Event type 컬럼이 이미 Business Segment 이름과 일치(사용자가 기존 "Direct Consult"를
전부 "BOFU"로 정정 완료, Seminar/Webinar/BOFU 3개뿐)해서 캠페인명 기반 `getBusinessSegment()`
없이 그대로 사용, SentAt이 정확한 단일 발송일이라 Meta식 lifetime 균등분배도 불필요 —
Naver Search보다도 단순한 구조. `AD_005_KakaoChannel.js` 신규 — 순수 함수
`computeKakaoChannelRowSpendEntry_()`/`aggregateKakaoChannelSpendByFYMonthSegment_()`,
1행=subtotal/2행=헤더/3행부터 데이터인 원본 구조 때문에 `sheetToObjects()`(1행=헤더 가정)를
못 써서 전용 리더 `readKakaoChannelPerformanceSheetData_()` 신규 작성. `AD_004_SpendCache.js`
가 Kakao Channel 몫(KRW→NZD 변환)도 합산하도록 확장 — Meta+Naver Search+Kakao Channel
3개 플랫폼 합산이 ACQ_REP W열 "Spent"에 정상 반영되는 것까지 실 시트 검증 완료(사용자 확인).

**`KakaoSMS_Raw` 뷰 탭 추가(사용자 요청)** — "API로 가져오더라도 어차피 performance는
봐야해서" 캠페인 지출 스프레드시트에 원본 Performance 전체 컬럼을 그대로 보여주는 뷰 탭
신설. 신규 "PIC" 컬럼(B/C 사이 삽입, 원본엔 없음)은 사용자가 매 행 직접 입력하는 값이라,
매번 전체 재작성하면 날아가는 문제를 막기 위해 **append-only**(Leads_Raw/MTA_Raw와 동일
기존 관행 — 이미 복사된 행은 안 건드리고 새 행만 이어붙임)로 구현, 실 시트에서 PIC 수동
입력 후 재실행해도 값이 보존되는 것까지 확인. CTR/CvR은 원본이 수식값이라 헤더만 복사하고
값은 항상 빈칸 처리.

**검증**: Node vm 하네스로 신규 순수 함수 전부 테스트(`testComputeKakaoChannelRowSpendEntry`/
`testAggregateKakaoChannelSpendByFYMonthSegment`/`testComputeKakaoChannelSyncRow` 전부
PASS), `node --check`/중복 선언/네이밍/버전헤더 검사 통과, 매 라운드 `clasp push` 완료.

**남은 결정 사항(TODO, 임의로 처리하지 말 것)**: (1) 카카오모먼트 API 권한 심사 결과
대기(~2026-08-03) — 승인되면 카카오 로그인 활성화/Redirect URI 등록부터 이어감, 승인 후
카카오 채널 파이프라인(`AD_005_KakaoChannel.js`)은 폐기 예정. (2) Meta API 재도입은
자격증명 확보 전까지 보류. (3) 매달 자동 갱신 트리거 연결 여부. (4) 나머지 플랫폼(Naver
GFA/Google Search·Display/Naver Offline Cafe) 확장 순서.

## 캠페인 지출 통합 Phase 1 — Naver Search API 파이프라인 신설 + ACQ_REP 합산 Spent 연결

**배경**: 이전 세션(2026-07-30)에서 Meta 파일럿까지 실사용 검증을 마친 상태에서 이어감. 상세 이력:
`docs/exec-plans/active/2026-07-30-campaign-spend-integration.md`.

**Meta 마무리** — 사용자가 `runRefreshMetaSpendCache()` 실행 → ACQ_REP Generate 재체크 → W열
("Meta Spent") 값 정상 표시 확인. Meta 파일럿(Raw→Cache→ACQ_REP 소비까지) 전체 배선 검증 완료.

**Naver Search 2번째 플랫폼 — 수동 붙여넣기 시도 후 API로 전면 전환**: 처음엔 Meta처럼 네이버
검색광고 리포트를 수동 붙여넣는 방식(`NaverSA_Raw`)으로 시작했으나, 화면/다운로드 리포트 어디에도
쓸 수 있는 기간(날짜) 컬럼이 없는 것으로 확정(사용자 확인 — "계속노출" 표시뿐). 이 시점에 사용자가
네이버 검색광고 API 자격증명(Customer ID/API License Key/Secret Key)을 이미 보유하고 있다고 알려와
API 방식으로 전면 전환 — 수동 붙여넣기 코드는 완전 폐기.

**API 인증·엔드포인트는 공식 샘플 코드로 확인(추측 없음)** — `naver/searchad-apidoc`(GitHub) 저장소의
`signaturehelper.py`(서명: `Base64(HMAC-SHA256(secretKey, "{timestamp}.{method}.{uri}"))`)와
`ad_management_sample.py`(헤더 `X-Timestamp`/`X-API-KEY`/`X-Customer`/`X-Signature`)를 실제로 확인
후 구현. **실 호출 중 403 invalid-signature 2건 발견·해결**: (1) Base URL을 공식 샘플의
`api.searchad.naver.com`으로 썼다가 실패 — GitHub 이슈 #1319(동일 Apps Script 서명 로직으로 GET
200 성공 사례)를 근거로 `api.naver.com`으로 수정. (2) 그래도 재발 — 진단 함수로 확인한 결과 Script
Properties에 저장된 Secret Key 끝의 `==`가 누락돼 있었음(길이 50, 정상 52), 사용자가 재입력 후 해결.
이후 `/ncc/campaigns`(캠페인 목록, 필드 `nccCampaignId`/`name`)와 `/stats`(지출 통계,
`{data:[{id,salesAmt,...}]}`) 둘 다 실 응답으로 확인.

**구현**: `AD_003_NaverSearch.js` 신규 — `computeNaverSearchAdSignature_()`(HMAC 서명)/
`buildNaverSearchAdQueryString_()`(ids는 반복 파라미터, fields/timeRange는 JSON 문자열)/
`buildCalendarMonthRange_()`/`computeNaverSearchAdSpendByFYMonthSegment_()`(캠페인명→Segment는
`getBusinessSegment()` 재사용, `leadSource="naver search"` 고정값으로 `_contact` 계열이 BOFU로
오분류되는 문제 해결) 등. **실 데이터 검증**: 2026년 7월 결과 `Search: 3,737,733`원 vs 실제
3,737,732원(31일 미포함 기준) — 1원 차이(반올림)로 정확히 일치 확인.

**ACQ_REP W열을 Meta+Naver Search 합산 "Spent"로 재구성(사용자 확정)** — 헤더를 "Meta Spent"→
"Spent"로 변경, Naver 지출(KRW)은 `GOOGLEFINANCE("CURRENCY:KRWNZD")`(Apps Script가 직접 호출 못
해 숨김 시트에 수식을 심고 읽는 방식)로 NZD 변환 후 합산. 신규 `AD_004_SpendCache.js`가 이 합산/
환율변환/캐시 저장(`Ad_Spend_Cache` 시트, 옛 `Meta_Spend_Cache` 대체)을 전담 — `refreshAdSpendCache_()`/
`runRefreshAdSpendCache()`/`readAdSpendCacheMap_()`. Naver Search는 Meta와 동일 범위(2022-09~현재,
`AD.NAVER_SEARCH.API.BACKFILL_START`)까지 소급, 캠페인 목록은 1회만 조회하고 월별로 `/stats`만
반복 호출. `CONFIG.ACQ.META_SPENT_COLUMN`→`SPENT_COLUMN`, `META_SPEND_CACHE_SHEET`→
`AD_SPEND_CACHE_SHEET` 개명(`00_Config.js`/`30_ACQReport.js`/`32_ACQReportStyles.js` 반영).
`AD_002_Meta.js`의 Meta 전용 캐시 함수(`refreshMetaSpendCache_()` 등)는 AD_004로 통합되며 제거
(`computeMetaSpendSummary_()`는 유지, AD_004가 호출).

**실 시트 검증(사용자 확인)**: `runRefreshAdSpendCache()` 실행 결과 212행 갱신, 환율
0.0011963(1 NZD≈836원, 합리적 범위) — ACQ_REP Generate 재체크 후 W열 "Spent" 값 정상 표시 확인.
옛 `Meta_Spend_Cache` 시트는 `runDeleteMetaSpendCacheSheet()`(1회성 정리 함수)로 삭제.

**검증 방법**: Node vm 하네스로 신규 순수 함수 전부 테스트(서명 생성 자체는 Apps Script
`Utilities.*` 전용이라 Node에서 검증 불가 — 실 API 호출로만 검증). `node --check`/중복 선언 검사
통과, 매 라운드 `clasp push` 완료.

**남은 결정 사항(TODO, 임의로 처리하지 말 것)**: (1) 매달 자동 갱신 트리거 연결 여부(Backend
비동기화 논의와 연관). (2) 이번에 검증된 API 방식을 Meta에도 적용할지(Meta Marketing API 존재).
(3) 나머지 6개 플랫폼(Naver GFA/Google Search·Display/Naver Offline Cafe/Kakao Moments·Channel)
확장 순서.

# Changelog — 2026-07-30

## Target CPNP1 Benchmark 계산 전환 + Seminar 캠페인 월 예외 + Target_REP 헤더 3행 재설계

**배경**: 위 "Target_REP 세그먼트 구조 전면 분해" 세션 이후 후속 세션. 세그먼트별 월별 Spent
수동 취합이 끝나면서 CPNP1 관련 계산을 실제로 살리고, Seminar처럼 캠페인이 특정 달에만 도는
세그먼트의 월별 배분 문제를 고치고, Target_REP 리포트 자체(헤더/색상/포맷)를 실사용 가능한
형태로 다듬은 라운드. 상세 결정 이력: `docs/exec-plans/active/2026-07-30-target-rep-segment-breakdown.md`.

**FY26 CPNP1 Benchmark by Segment: 수동 입력 → 계산으로 전환** — Block 0 rows 15~19
(`CPNP1_BENCHMARK_MANUAL` → `CPNP1_BENCHMARK`로 이름 변경)이 원래 사용자가 시트에 직접
입력하는 스칼라였으나, 월별 Segment Spent 취합이 끝나자 사용자가 "월별 Segment Spent 합 ÷
FY26 Segment New P1 합"으로 자동 계산하자고 요청. 신규 `computeCPNP1BenchmarkByGroup_()`가
매 refresh마다 계산해 `writeTargetEngineCPNP1BenchmarkValues_()`로 덮어씀 — Block 0의
"절대 안 덮어씀" 원칙의 유일한 예외로 문서화.

**Target CPNP1(Block A) 재활성화** — `BENCHMARK.CPNP1_FYS/WEIGHTS`를 `[]`(채널시트 3그룹
단위라 5세그먼트 자동 분해 불가로 잠정 중단됐던 상태)에서 `[26]`/`[1]`(단일 FY)로 전환,
분자를 죽은 채널시트/Naver 참조 대신 Block 0의 세그먼트별 월별 수동 Spent로 교체(신규
`buildSpentByGroupFYMonthFromManualInput_()`). 이미 3그룹 키("events"/"contact"/"content")
하드코딩이라 5세그먼트와도 안 맞던 죽은 코드 `readChannelRawRows_()`/`readNaverRawRows_()`/
`computeCombinedSpentByGroupFYMonth_()` 완전 삭제, `CONFIG.TARGET.EXTERNAL`의 채널/Naver
관련 설정도 함께 삭제(`DEAL_TRACKER`는 유지).

**Seminar 전용 캠페인 월 예외** — FY27 Seminar는 Oct/Jan/Apr 3회만 개최, 캠페인은 행사 30일
전 시작 → Block A의 과거 실적 기반 시즌성을 그대로 쓰면 비캠페인 월(Aug/Nov 등)에도 New P1
Target이 생겨 비현실적이라는 사용자 지적. 신규 `computeEvenSeasonalityForMonths_()`가 활성
월에 균등 분배하도록 `computeTargetDerivationRows_()`에서 Seminar 그룹만 오버라이드(다른
세그먼트/Block A 자체는 무영향). 최초엔 `CONFIG.TARGET.SEMINAR_CAMPAIGN_MONTHS` 하드코딩으로
구현했으나, 사용자가 "계획 바뀔 때마다 코드 고치는 거 말고 시트에서 체크만 바꾸고 싶다"고
요청 — 같은 세션에 Block 0 신규 섹션 5(체크박스, row 32, B~M열 12개월)로 이동. 최초 1회만
기본값(Sep/Oct/Dec/Jan/Mar/Apr)으로 시딩, 이후 시트가 Source of Truth.

**버그 수정: Seminar 비활성 월에 CPNP1 Target이 남아있던 문제** — monthlyCPNP1Target이
seasonalityPct(Seminar 활성 월 게이트)와 무관하게 계산돼, New/Pipeline Target이 0인 달에도
CPNP1 Target 값이 그대로 표시되던 버그(사용자가 실 시트에서 발견: "Target P1이 0인데
CPNP1은 채워져 있다"). Seminar이고 비활성 월이면 CPNP1 Target도 0으로 통일.

**Target_REP 헤더 3행 재설계** — 세그먼트당 7컬럼 플랫 헤더("Seminar Target New P1" 식)가
너무 넓다는 지적으로, 2행(세그먼트명 배너, 세그먼트당 병합)/3행(Target·Actual 구분 배너,
Target 4컬럼·Actual 2컬럼 각각 병합)/4행(개별 지표 라벨) 3단 헤더로 재설계, 데이터는 5행부터
(1행은 그대로 비워둠 — 사용자가 직접 수식 넣는 소계 행). 동시에 달성%를 리포트에서 완전히
제거("Progress는 다른 시트에서 확인" 사용자 확인) — 세그먼트당 7컬럼→6컬럼, 순서를
Target(New P1/Pipeline P1/P1/CPNP1) + Actual(P1/CPNP1)로 재배치. 세그먼트별 헤더 배경색도
신규 적용(dataviz 스킬 카테고리컬 팔레트, GROUP_ORDER 순서와 1:1).

**실 시트 검증 중 발견·수정한 버그/피드백 4건**: (1) `clearTargetReportArea_()`가 새 33컬럼
폭만큼만 지워서 옛 38컬럼 구조(세그먼트당 7컬럼) 때의 34~38열(AH~AL) 잔재가 안 지워지던
문제 — 45컬럼 버퍼로 수정. (2) 헤더 4행까지 틀 고정 추가. (3) 세그먼트 헤더 색이 너무
강하다는 피드백 — 원색을 흰색 75:25 블렌딩 파스텔로 교체(hue 유지, 채도만 하향). (4) CPNP1
컬럼 서식을 `#,##0` → `$#,##0.00`으로 변경.

**검증**: Node vm 하네스로 순수 계산 함수 전수 재검증(22개 testXXXX 전부 PASS, 그중
`testComputeTargetDerivationRows`는 Seminar 활성/비활성 월 양쪽 케이스로 갱신). 헤더 3행
레이아웃은 병합(`merge()`/`getMergedRanges()`/`breakApart()`)까지 흉내내는 가짜 in-memory
시트로 세그먼트 배너 위치/Target·Actual 병합 범위/개별 라벨 순서 전수 검증 + 2회 연속
재실행해도 병합 충돌 없이 안전한지(idempotency), 옛 컬럼 잔재가 실제로 지워지는지까지 왕복
확인. 실제 시트에서 `runRefreshTargetEngine()`/`runGenerateTargetReport()` 여러 차례 실행,
사용자가 발견한 이슈들을 그때그때 수정 → 재검증하는 루프로 진행.

## 로컬/origin 재동기화 (2026-07-29 하네스 엔지니어링 세션과의 divergence)

세션 시작 시 로컬과 origin이 서로 갈라진 상태(로컬 전용 커밋 1개, origin 전용 6개 — 다른 머신의
하네스 엔지니어링 세션)를 발견. origin을 기준으로 리셋한 뒤, 로컬에만 있던 `docs/Changelog.md`
기록(Search Marketo 프로그램화, OPS 정렬 통일, worktree 사고/복구)이 origin Changelog 어디에도
없다는 걸 확인하고 다시 이어붙여 커밋. `core.hooksPath`가 이 로컬 체크아웃에는 아직 설치 안 돼
있던 것도 이번에 설치(`scripts/start-session.sh`가 감지).

## exec-plans 컨벤션 + Roadmap 신설

OpenAI "Harness Engineering" 아티클(exec-plans 패턴)을 참고해 `docs/exec-plans/{active,completed}/`
+ `docs/ExecPlanConvention.md` 신설 — 작업 단위 실시간 진행 기록용, docs/ 트리 안에 유지(일관성
우선, 사용자 확인). `docs/Roadmap.md` 신설 — 실제 코드(`00_Config.js` 등 시트 상수) 기준으로
현재 파이프라인 플로우차트 정리, End Goal(Phase 1: 외부 캠페인 지출 데이터 통합 → CPNP1 실적
계산 / Phase 2: Target_REP 전체 세그먼트+예산 반영 재설계) 및 FY별 Sales Funnel 대시보드(계획 중),
End Goal 이후 장기 항목(유지보수/리팩토링/네이밍 컨벤션/에이전트 QA) 기록.

## Target_REP 세그먼트 구조 전면 분해 (3그룹 → 5개 실제 Business Segment)

**배경**: Target_REP/Target_Engine의 리포트 축이 3개 추상화 그룹(events=Seminar+Webinar,
contact=BOFU+Search, content=Content)이었던 걸 실제 5개 Business Segment(Seminar/Webinar/
BOFU/Search/Content, Referral/Other는 계속 제외)로 분해 — Roadmap Phase 2 중 세그먼트 구조
부분만 먼저 착수(사용자 결정). 상세 설계/결정 이력: `docs/exec-plans/active/
2026-07-30-target-rep-segment-breakdown.md`.

**Config/Engine 레이어(`00_Config.js`/`90_TargetEngine.js`)**: `GROUP_ORDER`/`SEGMENT_GROUPS`를
5세그먼트 1:1 매핑으로 교체. `deriveTargetGroup_()`/`computeBenchmarkBlockRows_()`/
`computeP1ValueBlockRows_()`는 이미 GROUP_ORDER를 동적으로 순회해 코드 변경 없이 그대로 확장됐지만,
`{events:0,contact:0,content:0}` 리터럴로 하드코딩됐던 `computeDealShareRatiosFromDealRows_()`
등 3개 함수는 새 세그먼트명에 대해 NaN이 나는 버그가 있어 GROUP_ORDER 기반 동적 초기화로 수정.
CPNP1 벤치마크(채널시트 3그룹 단위 자동집계, `CONFIG.TARGET.BENCHMARK.CPNP1_FYS`)는 5세그먼트로
자동 분해가 안 돼 잠정 중단(빈 배열) — 대신 Target_Engine Block 0에 신규 섹션 3개 추가: 세그먼트별
FY26 CPNP1 벤치마크(스칼라 수동입력), 월별 회사 전체 Revenue Target/Budget, 세그먼트별 월별 실제
Spent(수동 취합). `readTargetEngineInputs_()`/`setupTargetEngineInputDefaults_()` 전면 재작성.

**Report/Styles 레이어(`91_TargetReport.js`/`92_TargetStyles.js`)**: 헤더/리포트 행 빌더는 이미
GROUP_ORDER 동적 순회라 설정만으로 자동 확장(3그룹×7컬럼=24 → 5세그먼트×7컬럼=38). 실제 버그
1건 수정(`computeTargetActualP1ByWeek_()`의 3그룹 하드코딩). Actual CPNP1 원천을 "외부 채널/Naver
시트 주간 정확매칭"(3그룹 전용, 폐기)에서 "Block 0 세그먼트별 월별 수동 Spent 기준(월 값을 그 달
모든 주에 반복)"으로 교체. Block 0 서식(천단위 콤마, $/%는 소수점 2자리) 최초 추가.

**실 시트 검증 중 발견·수정한 버그 2건**: (1) Block 0 신규 월별 그리드(B~M열, 12개월)가 기존
`BLOCK_A_START_COL`(D열)과 정확히 겹쳐 두 블록이 같은 행/컬럼을 서로 덮어쓰던 버그 — 사용자가
실 시트에서 "Monthly Company-wide Inputs 행에 다른 블록이 이어짐"을 발견해 확인, Block A~D 시작
컬럼을 전부 +10 이동(4/13/21/28 → 14/23/31/38)해 해결. (2) Block 0에만 서식을 넣고 Block A~D
(사실상 시트 숫자 대부분)는 서식이 없어 Seasonality % 등이 raw 소수로 표시되던 것 — 신규
`applyTargetEngineBlockStyles_()`로 Block A~D 전체에 동일 서식 규칙 적용.

**클라스프 push 관련 발견**: `clasp push`가 TTY 없는 환경(이 harness)에서 자체 확인 프롬프트를
못 띄우고 조용히 "Skipping push."로 아무 것도 안 하고 종료되는 걸 발견 — `scripts/safe-clasp-push.sh`
가 이미 자체 worktree 확인 게이트를 갖고 있으므로 `clasp push --force`를 기본으로 넘기도록 수정.

**미해결(다음 세션, 임의로 처리하지 말 것)**:
- 예산 기반 신규 도출 체인(월별 회사 전체 Revenue Target/Budget → 세그먼트별 CPNP1 벤치마크로
  Budget-NP1 산출 → P1당 가치로 Revenue 프로젝션 → 벤치마크 NP1과의 차이로 조정)은 사용자가
  설명한 5단계 로직만 기록됐고 실제 계산 코드는 미구현 — Deal Share 트랙 선택(New/Pipeline)과
  "실질적 조정" 메커니즘(고정 수식인지 수동 판단인지)이 아직 미확정.
- Block 0(A~M열)과 Block A(N열~) 사이 구분용 빈 컬럼 없음 — 사용자 확인 후 보류, 나중에 요청 시 처리.
- ~~Target_REP 실제 출력물의 5세그먼트 컬럼/서식 최종 확인~~ — 후속 세션(위 "Target CPNP1
  Benchmark 계산 전환 + Seminar 캠페인 월 예외 + Target_REP 헤더 3행 재설계" 참고)에서 완료.
- ~~사용자가 실제 월별 Revenue Target/Budget/세그먼트별 Spent 값을 아직 Target_Engine에
  입력 안 함~~ — 후속 세션에서 입력 완료, CPNP1 계산 체인도 그 값 기준으로 재활성화됨.

## Target_REP 실 시트 최종 검증 + ACQ_REP/NewP1_REP Target 달성률 컬럼 추가 (후속 세션)

**배경**: 위 "Target CPNP1 Benchmark 계산 전환 + Seminar 캠페인 월 예외 + Target_REP 헤더 3행
재설계" 세션 이후 같은 날 후속 세션. Target_REP 실 시트 검증 마무리 후, "FY별 Sales Funnel
대시보드"(Roadmap 항목) 설계에 착수했다가 기존 리포트 확장으로 방향을 바꿔 구현까지 완료.

**Target_REP 실 시트 검증 완료** — 직전 세션에서 잡은 4가지(헤더 3행 구조/틀고정/세그먼트
배색, CPNP1 `$` 서식, 옛 7컬럼 구조 잔재 정리, Seminar 비활성월 CPNP1=0 게이팅) 전부 실 시트에
정상 반영 확인(사용자 확인). exec-plan `docs/exec-plans/active/2026-07-30-target-rep-segment-breakdown.md`
는 예산 기반 도출 체인(§ 미구현 1건)이 남아있어 완료 처리는 안 함.

**FY_REP 설계 착수 → 채택 안 함(superseded)** — "리드→SAL→IC Booked→IC Complete→Won FY별
대시보드"를 별도 신규 리포트로 설계(`docs/FYReportDesign.md`, 원본 외부 FY_REP 리포트를
편입 + 세그먼트별 달성률 뷰 추가하는 안, Validation Rules 섹션 포함)했으나, 검토 중 "ACQ_REP/
NewP1_REP이 이미 FY×Month×Segment로 같은 원시 지표를 갖고 있으니 Target만 얹으면 되는 것
아니냐"는 사용자 지적으로 방향 전환 — 새 리포트를 만들면 이미 검증된 지표를 중복 계산하게
됨(Single Responsibility 위반). `docs/FYReportDesign.md`는 검토 과정 기록으로 보존, Status를
"superseded"로 표시.

**오해 발견·정정: ACQ_REP과 NewP1_REP의 New P1은 같은 값** — `docs/ACQReportDesign.md`의
"Attribution 불일치" 표를 "ACQ_REP이 NewP1_REP과 다른 방식으로 Segment를 재계산한다"로
잘못 일반화해서 한때 "같은 Target을 양쪽에 붙이면 실적이 달라질 수 있다"고 판단했으나,
`30_ACQReport.js`의 `computeOPSAggregates_()`를 직접 읽어보니 `headers.indexOf("Business
Segment")`로 NewP1_REP과 동일 컬럼을 그대로 읽고 있음을 확인 — 그 표는 MTA_Master 기반
지표(All Leads/All P1/SAL, 진짜 다른 컬럼)와 Leads_OPS 기반 지표를 대조한 것이었을 뿐.
`docs/ACQReportDesign.md`에 "오해 방지" 섹션으로 정정 기록.

**ACQ_REP/NewP1_REP에 Target 컬럼 구현 완료** — 상세 설계/결정 이력은
`docs/exec-plans/active/2026-07-30-acq-newp1-target-columns.md`.
- **ACQ_REP**(`30_ACQReport.js` v1.10.0, `32_ACQReportStyles.js` v1.6.0): S:V열에 Revenue
  Target/Revenue Target%/New P1 Target/New P1 Target% 4컬럼 추가. Revenue Target = 월별 회사
  전체 Revenue Target × 세그먼트 Deal Share(Target_Engine Block C, 코호트1/R1/New 트랙).
- **NewP1_REP**(`40_NewP1Report.js` v1.3.0, `41_NewP1ReportStyles.js` v1.3.0): N:Q열에 Spent/
  CPNP1(실적)/New P1 Target/New P1 Target% 4컬럼 추가. Spent는 Target_Engine Block 0 세그먼트별
  월별 수동 입력, CPNP1 = Spent ÷ New P1(실적).
- **공용**: `90_TargetEngine.js`(v1.23.0) 신규 `readTargetEngineDealShareRows_()`(Block C 조회,
  기존에 없었음)/`computeReportTargetLookupFromInputs_()`(순수 함수, Block 0/C/D를
  `targetFY|Month|Group` 키로 병합)/`computeReportTargetLookup_()`(IO 래퍼) — 두 리포트가
  같은 함수를 재사용. "타겟 없음"과 "타겟 0"을 hasOwnProperty로 구분(기존
  `computeCPNP1RatioByFYMonth_()` 관례). Target% ≥100%면 `highlightAtOrAboveThreshold_()`
  (32_ACQReportStyles.js 신규)로 `#C6E0B4` 하이라이트. Pipeline P1 Target은 제외 — "구
  코호트 딜의 이번 FY 전환은 클로징 여부가 불확실해 New P1 카운트 목표와 성격이 다르다"는
  사용자 판단.

**실 시트 검증 중 컬럼 충돌 3회 + 배포 누락 1회 발견·수정**:
1. 최초 시도(ACQ_REP O열, NewP1_REP N열, 각각 A:N/A:M 바로 뒤)가 ACQ_REP의 숨김 Engine
   영역(`CONFIG.ACQ.ENGINE_START_COL`, O:R)과 겹치는 걸 코드 리뷰로 발견 → ACQ_REP만 S열로 이동.
2. S열로 실 시트 검증했더니 이번엔 사용자가 U:AF(ACQ_REP)/N열(NewP1_REP)에 넣어둔 **수동
   수식/소계**(코드베이스 어디에도 없어 grep으로는 못 잡는 영역)와 겹쳐 "값이 안 보인다"는
   리포트 — ACQ_REP은 AH열, NewP1_REP은 O열로 재이동.
3. 사용자가 U:AF/N열의 수동 내용을 직접 삭제한 뒤 "이제 원래 위치로 옮겨도 된다"고 확인 —
   ACQ_REP은 S열, NewP1_REP은 N열로 최종 원복. 헤더 Note는 이후 위치가 또 바뀌어도 안 깨지게
   하드코딩 컬럼 번호 대신 `CONFIG.*.TARGET_COLUMNS_START_COL` 기준 상대 위치로 전환.
4. 컬럼 위치를 두 번 고치는 동안 실제로는 `clasp push`를 한 번도 안 해서, 사용자가 계속 옛
   코드로 검증하고 있었던 게 뒤늦게 발견됨(원인의 상당 부분) — `scripts/safe-clasp-push.sh`로
   push, 이후 수정마다 즉시 push하는 것으로 정정(이 exec-plan에 한해 "검증 전 보류" 방침을
   썼던 게 오히려 혼란을 키움 — 프로젝트 기본값은 "수정 후 매번 바로 push").

**🔴 새 미해결 항목 — Target_Engine 단일 FY 구조 한계 발견(`docs/OpenItems.md` #17)**: 컬럼
위치를 다 고친 뒤에도 데이터 행이 전부 공란이길래 조사한 결과, `Target_Engine`이 FY27(다음
해 계획용)로 설정돼 있어 사용자가 확인하던 FY26(실적 있는 진행 중인 해) 행과 매칭되는 Target
자체가 없는 게 원인(버그 아님, 의도된 hasOwnProperty 기반 공란 처리 정상 동작). Target_Engine이
FY 하나만 갖고 있어서 FY26 실적 대비 달성률을 보려면 재생성해야 하고, 그러면 지금의 FY27 계획
입력값을 덮어써야 하는 근본적 설계 충돌 — Target_Engine을 여러 FY 동시 지원 구조로 재설계해야
근본 해결. **사용자 결정**: "타겟 설계를 바꿔봐야 할 것 같지만 캠페인 구축이 먼저" — 지금은
보류, 임의로 처리하지 말 것.

**memory 신규**: `feedback_column_collision_check_before_appending` — 코드가 관리하는 숨김
컬럼뿐 아니라 사용자가 시트에 직접 넣어둔 수동 영역도 "기존 컬럼 사용 현황"에 포함해서
확인해야 한다는 교훈(grep만으로는 못 잡음, 사용자에게 직접 물어봐야 함).

## 캠페인 지출 데이터 통합 착수 — Meta 파일럿 구축 및 실 데이터 검증 (같은 날 후속 세션)

**배경**: 위 세션 종료 후 이어서, `docs/Roadmap.md` End Goal Phase 1(외부 캠페인 지출 데이터
통합)에 착수. 상세 결정 이력: `docs/exec-plans/active/2026-07-30-campaign-spend-integration.md`.

**원래 계획 폐기, 새 아키텍처로 방향 전환** — Roadmap에 적혀있던 소스(외부 `Monthly{채널}`
요약 시트)가 채널/계정 단위 월 집계라 세그먼트별 분리가 원천적으로 불가능함을 확인(채널 하나를
여러 세그먼트가 공유, 사용자 확인)하고 폐기. 대신 **각 광고 플랫폼(Meta/Naver Search/Naver
GFA/Google Search/Google Display/Naver Offline Cafe/Kakao Moments/Kakao Channel, 8개)에서
캠페인 단위 리포트를 직접 export**하는 방식으로 전환 — 이 프로젝트의 기존 Leads_Raw/MTA_Raw
패턴(원본 불변, 부분 export도 안전하게 병합)을 재사용. 저장 위치는 메인 스프레드시트가 이미
무거워서 **별도 Google Sheet + 같은 Apps Script 프로젝트**(Deal Tracker와 동일하게
`SpreadsheetApp.openById()` 크로스 접근)로 확정. 새 네이밍 컨벤션(`STAGE_NNN_Name.js`, 3자리)을
이 파이프라인부터 바로 적용 — 기존 00~99 파일 전체 재정비는 별도 세션으로 보류.

**Meta 파일럿 구현 및 실 데이터 검증 완료** — `AD_001_Config.js`(스프레드시트 ID/8개 플랫폼
목록/Meta export 컬럼 매핑/활성 Account ID), `AD_002_Meta.js`(Import/Transform/Aggregation).
세그먼트 분류는 새로 안 만들고 기존 `getBusinessSegment()`를 그대로 재사용 — Meta 캠페인명
네이밍 규칙(`KR_core_YYYY-MM-DD_slug_tag`)이 Salesforce `MKT UTM Campaign`과 사실상 동일함을
실 데이터 6개 샘플 전수 검증으로 확인.

**실 데이터 검증 중 발견·수정한 버그 4건**:
1. Meta_Raw 실제 헤더가 사용자가 채팅에 옮겨 적어준 한국어 샘플이 아니라 **영어**였음
   (`Reporting starts`/`Campaign name`/`Amount spent (NZD)` 등, 계정별 UI 언어 차이) —
   `runDebugMetaRawFirstRow()`(신규 진단) 로 확인 후 Config 정정.
2. 캠페인 자체 종료일(`Ends`)이 처음엔 export 불가능했다가 사용자가 별도 컬럼으로 추가 확보 —
   "예전 계정 lifetime 합계를 활성 기간에 균등분배"라는 설계 전제가 이걸로 성립.
3. **계정 ID 기반 분기 로직 폐기** — "현재 계정은 항상 한 달만 본다"는 가정이 사용자가 현재
   계정도 넓은 기간(2024-09~지금)으로 한 번에 export하고 싶다는 요청으로 깨짐. 추가로 "Amount
   spent"가 캠페인 전체 생애가 아니라 "Reporting starts~ends"(조회 기간) 안에서 집행된 금액임을
   확인 — 계정 무관하게 "캠페인 활성 기간 ∩ 보고 조회 기간"에 균등분배하는 단일 로직으로 재작성.
4. 26|JUL 실제값 대조 중 발견된 15~20%대 오차 — 세그먼트 오분류가 아니라 **종료일 없는 장기
   에버그린 캠페인의 균등분배 근사 오차**로 확인(`runDebugMetaSpendByCampaignForMonth()` 신규
   진단으로 확인). **정밀 export 우선 규칙**(`isMetaRowMonthPrecise_()` 신규) 추가 — 같은
   캠페인의 같은 달을 정밀 행과 장기 분배 행이 동시에 커버하면 분배 행의 그 달 기여분은 버리고
   정밀값 채택. 이 수정 과정에서 **타임존 버그**도 추가 발견(정밀 export가 왜 정밀로 인식이
   안 되나 봤더니 `reportStart`가 실제보다 하루 이른 UTC로 읽힘 — 2026-07-28 Deal Tracker에서
   이미 겪은 것과 동일 버그 클래스) — `normalizeExternalCalendarDate_()`(90_TargetEngine.js)
   재사용해 해결. 최종 검증: `26|JUL|BOFU: 3906.3`(실제 ≈3,904), `26|JUL|Content: 22926.44`
   (실제 ≈22,922) — 손으로 검산한 값과 정확히 일치.

**`clasp run-function` 설정 검토(실행 안 함)** — 개인 Google 계정으로도 무료로 가능함을 확인
(GCP Standard 프로젝트 연결 + Apps Script API 활성화 + API Executable 배포 필요, 빌링 불필요)
했으나 사용자가 수동 실행 방식 유지를 선택.

**ACQ_REP에 "Meta Spent" 컬럼 연결** — Target_Engine 연결은 8개 플랫폼 중 Meta 하나만
자동화돼 총 지출 과소집계 위험이 있어 보류, Segment×Month grain이 이미 맞는 ACQ_REP에 먼저
연결(사용자 확정) — 헤더명을 "Spent"가 아니라 "Meta Spent"로 명확히 해서 오인 방지(W열,
`CONFIG.ACQ.META_SPENT_COLUMN`).

**연결 직후 버그 발견·수정 — Simple Trigger 권한 제약**: ACQ_REP Generate 체크박스가 조용히
실패, 사용자가 공유한 Cloud Logs로 "Specified permissions are not sufficient to call
SpreadsheetApp.openById" 확인 — ACQ_REP Generate가 `onEdit()` Simple Trigger로 실행되는데
제한된 권한이라 외부 스프레드시트를 못 엶(**Target_REP가 2026-07-27에 이미 겪은 것과 동일한
제약**). 이번엔 체크박스 UX를 유지하고 싶어 `ACQ_Summary`와 동일한 캐시 패턴으로 해결 —
`refreshMetaSpendCache_()`/`runRefreshMetaSpendCache()`(수동 실행, 메인 스프레드시트 안
`Meta_Spend_Cache`에 저장)와 `readMetaSpendCacheMap_()`(같은 스프레드시트만 읽어 Simple
Trigger 안전). 최종 실 시트 검증 완료(사용자 확인, "응 나와").

**문서화**: `docs/apps-script-gotchas.md` #9(Simple Trigger + 외부 스프레드시트 제약, 두 해법
정리) 신규. `docs/Roadmap.md` Phase 1 전면 재작성(원래 계획 폐기 기록 보존). 신규 memory 2건:
`feedback_external_spreadsheet_timezone_dates`(타임존 버그가 이번에 두 번째로 재발한 패턴),
`feedback_column_collision_check_before_appending`(위 세션에서 이미 기록, W열 배치 전 재확인
에서도 다시 활용).

**버전 이력**: `00_Config.js` v1.20.0→v1.22.0, `30_ACQReport.js` v1.10.0→v1.12.0,
`32_ACQReportStyles.js` v1.6.0→v1.7.0, `AD_001_Config.js`/`AD_002_Meta.js` 신규(v1.2.0/v1.5.0
까지). 전부 `clasp push` 완료.

# Changelog — 2026-07-29 (하네스 엔지니어링 ①~④)

## 하네스 엔지니어링 도입 — clasp push 안전장치, pre-commit 훅, 세션 시작 스크립트, CLAUDE.md 다이어트

**배경**: 규칙 준수를 "Claude가 CLAUDE.md의 prose 규칙을 기억하는 확률적 방식"에서 "스크립트/git
hook이 결정론적으로 차단하는 방식"으로 전환. 실제 사고 이력(2026-07-24 divergence 미인지,
2026-07-29 worktree 덮어쓰기, `_` 접미사 반복 실수)이 전부 강제 메커니즘 부재에서 발생했음.
4단계로 나눠 각 단계마다 실제 시연으로 검증 후 다음 단계 진행.

**① `scripts/safe-clasp-push.sh`**: `clasp push` 래퍼. `git worktree list`가 2개 이상이면
목록을 보여주고 y/n 확인을 받은 뒤에만 push한다. 실제 사고 메커니즘(main worktree에서 push하다가
linked worktree가 배포해둔 코드를 덮어씀)을 감안해, "어느 worktree에서 push하는가"가 아니라
"worktree가 여러 개 존재한다는 사실 자체"를 차단 기준으로 삼음(사용자 확정 정책). 정상 케이스(1개
→ 경고 없이 진행)와 차단 케이스(2개, 임시 worktree로 시연 → y/n 둘 다 확인)를 실제로 실행해 검증.

**② `.githooks/pre-commit`(`git config core.hooksPath .githooks`) + 4개 검사 스크립트**:
`scripts/check-naming.sh`(신규 추가된 test/run 진입점 함수가 `_`로 끝나는 실수 — diff의 추가된
줄만 검사해 24_OPSQA.js의 기존 알려진 예외는 안 건드림), `scripts/check-version-header.sh`
(코드 변경 시 Version/Change Log 헤더 갱신 여부), `scripts/check-duplicate-declarations.sh`
(파일 간 동일 함수/상수명 중복 선언), `scripts/check-syntax.sh`(`node --check`). 실제
`git commit`으로 4개 위반 케이스 전부 차단 확인 → 수정 후 통과 확인 → 테스트 커밋/스크래치
파일 정리. `check-version-header.sh`는 주석만 고친 변경과 실제 코드 변경을 구분 못 하는 알려진
한계가 있음(관찰 대기).

**③ `scripts/start-session.sh`**: git fetch/divergence, `git worktree list`, `core.hooksPath`
설치 여부를 한 번에 확인 — 기존 CLAUDE.md prose의 "Session-Start Git Sync Check" 절차를 대체.
ahead-of-origin 케이스와 hooksPath 미설정 경고 둘 다 실측 확인.

**④ CLAUDE.md 다이어트**: 81줄 → 53줄. 미해결 항목 15개를 `docs/OpenItems.md`로 이관(원문과
byte-identical, 대조 검증 완료). Session-Start Git Sync Check/Clasp Push Pre-Authorized
섹션을 각 스크립트 실행 안내로 압축(사고 배경 스토리는 삭제하지 않고 각 스크립트 자체의 주석으로
이동 — 정보 손실 없음).

**그 외**: `.gitattributes` 신규(`*.sh`/`.githooks/*` LF 강제 — `core.autocrlf=true` 환경에서
스크립트 line ending이 깨지는 것 방지). 기존 `.js` GAS 코드는 1바이트도 수정하지 않음(제약 준수),
eslint/vitest는 미도입(2차 재검토 예정).

## 프로젝트 공용 permission 허용목록(`.claude/settings.json`) 신규 추가

세션 트랜스크립트(최근 9개 — crimson-lead-tracker + crimson-naver-blog) 스캔 후, 읽기 전용
커맨드 중 자주 쓰이는데 아직 자동 허용되지 않던 것만 프로젝트 공용 `.claude/settings.json`
(신규 생성)에 추가: `Bash(git fetch *)`, `mcp__claude_ai_Notion__notion-query-data-sources`,
`mcp__claude_ai_Notion__notion-fetch`, `Bash(clasp --version)`. `clasp push`/
`./scripts/safe-clasp-push.sh` 등 배포/뮤테이션성 명령은 자주 쓰였어도(각 18회/3회) 의도적으로
제외 — 특히 `safe-clasp-push.sh`는 방금 ①에서 그 실행 자체를 확인받도록 만든 래퍼라 허용
목록에 넣으면 취지와 충돌. 기존 개인 설정(`.claude/settings.local.json`, git 미추적)은 건드리지
않음.

## Session-Start Git Sync Check의 worktree 확인 항목 — "기억해서 확인" → 스크립트 자동화로 대체

**배경**: `docs/OpenItems.md` #15(구 CLAUDE.md 미해결 항목 #15, 2026-07-29 세션)에서 `git worktree
list` 확인 없이 main에서 `clasp push`를 반복하다가 linked worktree(`worktree-clever-seeking-dolphin`)가
배포해뒀던 Target_REP New/Pipeline 코드를 덮어쓴 사고가 발생했고, 그 항목의 "재발 방지" 문장은
"앞으로 세션 시작 시 git sync 체크에 `git worktree list`도 포함할 것(기존 원칙에 반영 필요)"이라는
TODO 상태로 남아 있었다.

**해소**: 같은 날 진행한 하네스 엔지니어링 세션에서 이 TODO를 스크립트로 구현 완료 —
- `scripts/safe-clasp-push.sh`: `clasp push`를 직접 실행하는 대신 이 래퍼를 통하도록 전환.
  `git worktree list`가 2개 이상이면 목록을 보여주고 y/n 확인을 받은 뒤에만 push한다. 실제 사고
  메커니즘(main에서 push했는데 다른 worktree가 배포해둔 코드를 덮어씀)을 감안해, "어느 worktree에서
  push하는가"가 아니라 "worktree가 여러 개 존재한다는 사실 자체"를 기준으로 경고한다.
- `scripts/start-session.sh`: 세션 시작 시 `git fetch`+divergence, `git worktree list`,
  `core.hooksPath` 설치 여부를 한 번에 확인 — 기존에 CLAUDE.md prose로만 존재하던 "Session-Start
  Git Sync Check" 절차를 대체.
- 둘 다 실제 `git commit`/임시 worktree 생성으로 정상 케이스·차단 케이스 각각 시연 후 검증 완료.
- `docs/OpenItems.md` #15 자체는 텍스트를 수정하지 않고 원문 그대로 보존(당시 기록 그대로 유지) —
  "해소됐다"는 사실은 이 Changelog 항목으로 대신 기록한다.

## 하네스 엔지니어링 pre-commit 도입 — `check-version-header.sh`의 알려진 한계 발견

**배경**: 같은 세션에서 `.githooks/pre-commit`(naming/version-header/중복선언/문법 4개 검사)을
신규 도입하면서, `check-version-header.sh`(코드가 바뀐 `.js` 파일이 Version/Change Log 헤더도
같이 갱신했는지 검사)의 판정 방식을 설계하는 과정에서 한계를 발견했다.

**한계**: 이 스크립트는 diff의 hunk가 파일 헤더 안쪽인지 바깥쪽(코드 영역)인지만 구분할 뿐, 코드
영역 변경이 "실제 로직 변경"인지 "순수 주석만 고친 변경"인지는 구분하지 못한다. `docs/NamingConvention.md`
"File Versioning" 규칙은 주석/문서만 고친 경우를 Version 갱신 예외로 인정하는데, 이 스크립트는 그
예외를 인식하지 못해 함수 본문 내부의 주석 한 줄만 고쳐도 Version 미갱신으로 커밋이 막힐 수 있다.

**처리 방침**: 최소 구성 원칙에 따라 일단 이 한계를 안고 도입(스크립트 자체 주석에 명시). 실사용
중 이 false-positive가 실제로 거슬리면 그때 완화 여부를 재검토한다 — 아직 코드 변경 없음.

## Search를 Marketo 프로그램화 + 캐치올 재분류 (CLAUDE.md #14 연장)

**배경**: 사용자가 Search_OPS를 육안으로 훑어보다가 search/sitelink가 아닌 raw UTM이 너무 많다고
재확인. 2026-07-24에 "Search 리드 대부분이 Marketo Program 없이 직접 캡처된다"는 판단으로 raw
UTM 그레인을 선택했었는데, 그 판단을 재검토하는 것에서 시작.

**발견 1 — Search_OPS Key/Channel**: Lead Source Detail에 "Naver SA"/"Google SA"가 포함되면
raw UTM 대신 그 Program명을 그대로 키로 사용하도록 `resolveSearchEngineKey_()`(71_Search_Engine.js)
재설계 — 패턴 매칭이라 향후 신규 프로그램도 자동 인식. UTM→Program 정확 매핑 7건(detail이
비어있는 터치 구제), "chatgpt.com"/"website-consultation-booking" 같은 비정보성 UTM은 Organic
Search 버킷으로 병합. Channel도 `resolveSearchChannelFromKey_()` 신규로 Naver Search/Google
Search 구분, 기본값 "Meta"(BOFU에서 물려받아 실측 검증 안 됐던 값)는 빈 값으로 변경 —
`runClearSearchOPSMetaChannel()`로 기존 값도 일괄 공란 처리, 나머지는 사용자가 직접 채움.

**발견 2 — "research" 오탐 버그**: `campaign.includes("search")` 확정 신호가 "research"(리서치)
안의 "search"까지 잡아서, "college-research-ebook" 같은 명백한 Content/Webinar 캠페인이 전부
강제로 Search가 되고 있었음. `/(?<!re)search/` 정규식으로 수정.

**발견 3 — Search_OPS 캐치올 육안 재검토**: "Crimson Education Contact Us form" 같은 범용
Lead Source Detail 폼이 raw UTM 그레인과 겹쳐 콘텐츠/웨비나/세미나 캠페인까지 Search로 뭉개던
문제(Content 우선순위 재배치, leadSource 기반 재분류 등)를 여러 라운드로 해결한 뒤에도 남은
캠페인들을 사용자가 Search_OPS 전체를 직접 훑어보고 개별 지정 — `BUSINESS_SEGMENT_EXCEPTIONS`
(16_TransformHelper.js)에 150여 건 누적 추가(파트너십 프로그램/숫자만 있는 캠페인 ID/MedView/
CGA 등). CLAUDE.md #14의 "잔존 leadSource=Organic Search 레거시"도 이번에 해소 — 신호가
전혀 없는 리드는 leadSource 값을 임의 Marketo Campaign name으로 써서 Search_Engine/Search_OPS
집계 누락(Revenue $4M+ 포함)을 막는 `resolveSearchEngineKey_()` fallback으로 처리.

**부수 발견**: `Search_CatchAll_QA` 시트(76_TempQA_SearchCatchAll.js 신규)로 "신호는 있는데
Lead Source Category가 더 정확한 신호인" 케이스를 사람이 직접 검토(Marketo 로그 대조) —
Lead Source Category만으로는 같은 카테고리("Naver online cafe" 등)가 Content/Webinar/Seminar로
캠페인마다 다르게 갈려 자동 규칙화가 불가능함을 확인, 캠페인 단위 override로 반영.

## OPS 전체 정렬 스타일 통일 + Leads_OPS 정렬 추가

**배경**: Search_OPS에서 이번 세션에 신규 생성된 키(Naver SA/Google UTM/Organic Search 등,
Start Date 미기입)가 "빈 날짜 최상단" 정렬 때문에 실데이터 있는 캠페인들을 밀어내는 문제 발견.

**변경**: BOFU/Events(Event Date 기준)/Content/Search_OPS 전부 "빈 날짜 최하단 + 나머지
최신순"으로 통일(`compareBy*BlankLast*` 함수들로 교체). Leads_OPS는 애초에 정렬 로직 자체가
없었음(`20_OPS_Config.js`의 `SORT_BY`/`SORT_ASC`는 어디서도 안 읽히는 죽은 설정) — Create Date
기준으로 동일 스타일 신규 추가.

## git worktree 사고 발견 및 복구 (CLAUDE.md #15 신설)

**배경**: Target_REP에서 "Events Target Pipeline P1"/"Contact Target New P1" 값이 0으로
표시된다는 사용자 보고로 조사 시작.

**원인**: 별도 git worktree(`worktree-clever-seeking-dolphin`, main과 동일한 Apps Script
scriptId)가 New/Pipeline 2트랙 Block C/D 확장(2026-07-27, 8개 커밋)을 라이브 스크립트에
배포해뒀었는데, main에는 이 작업이 merge된 적이 없었음 — 이번 세션 중 `git worktree list`
확인 없이 main에서 `clasp push`를 반복하면서 그 배포분을 구버전(main)으로 덮어씀.

**복구**: worktree 브랜치를 main에 merge — 분류 로직(`classifyDealSegment_()`)은 그 사이 main에서
더 검증된 방식(Deal Tracker "Segment" 컬럼 직접 참조)으로 이미 교체돼 있어 그쪽으로 통일하고,
worktree의 New/Pipeline Block C/D 계산 로직은 그대로 채택(90_TargetEngine.js v1.15.0/
00_Config.js v1.12.0 changelog 참고). Merge 후 관련 테스트 전부 PASS, `runGenerateTargetReport()`
재실행으로 실제 값 정상 반영 확인. Merge 완료 후 worktree/브랜치 삭제(완전히 merge된 상태라
안전).

**재발 방지**: CLAUDE.md "Session-Start Git Sync Check" 원칙에 `git worktree list` 확인을
추가 — 별도 worktree가 main과 동일한 scriptId를 가리키면 그 작업 내용을 먼저 파악하고 진행
(2026-07-29 스크립트 자동화로 해소 완료 — 위 하네스 엔지니어링 섹션 참고).

## 완전 동일 중복 터치(Exact Duplicate Touch Row) 자동 삭제 구현 (CLAUDE.md #8)

**배경**: 2026-07-24 검출 로직(`findExactDuplicateTouchRows_()`)만 구현하고 자동 삭제는 보류.
2026-07-25 사용자 요청으로 자동 삭제 필요성 재확인(MTA 재export 시 날짜 겹침을 신경 안 써도
되게), 오늘 설계 검토 후 구현.

**안전성 검토 결과**: 원래 우려했던 두 가지가 실제로는 문제 없음을 확인 —
1. `MTA_LAST_ROW`(PropertiesService)는 MTA_**Raw** 처리 진행률만 추적(`07_IncrementalMasterBuild.js`
   `appendNewMTA()`의 `allRaw.slice(lastProcessed)`)할 뿐 MTA_**Master** 행 위치/개수와 전혀
   무관 — Master에서 행을 삭제해도 이 카운터에 영향 없음.
2. MTA_Master는 매 append마다 어차피 `sortSheetByDate()`로 날짜순 재정렬되므로, 행 삭제로 인한
   "정렬이 깨진다"는 우려도 해당 없음.

**삭제 기준(사용자 확정)**: 5개 필드(Lead ID+MTA Created Date+MKT UTM Campaign+First Lead
Source+Lead Source Detail) 완전 일치 그룹 중, IC Booked/Completed/Won Date·Revenue 등
export 시점마다 달라질 수 있는 Lead 레벨 스냅샷 필드를 기준으로 **"가장 진행된 단계"의 행만
남긴다** — Won(Opportunity Won Date 유효 또는 Revenue>0) > IC Complete > IC Booked > 아무
것도 없음 순, 동점이면 시트상 더 나중 행을 유지. 이렇게 하면 중복 정리 과정에서 진행 정보
손실이 최소화됨.

**구현**: `24_OPSQA.js` v1.3.0 —
- `computeTouchProgressionScore_(record)`: 진행 단계 점수(0~3) 계산 (순수 함수).
- `readMTAMasterRowsWithIndex_()`: MTA_Master를 시트 행 번호와 함께 읽음(`sheetToObjects()`는
  행 번호를 안 주므로 삭제 대상 지목을 위해 신규 작성).
- `findExactDuplicateTouchRowsToDelete_(rowsWithIndex)`: 그룹별로 남길 행 1개를 정하고 나머지
  행 번호를 **내림차순**으로 반환(삭제 시 인덱스가 밀리지 않도록) — 순수 함수, mock 데이터로
  테스트 가능.
- `runAutoDeleteExactDuplicateTouchRows()`: 수동 실행 진입점 — 삭제 전 대상 행 번호를 Logger에
  전부 나열(실행 로그가 곧 감사 기록) 후 `deleteRow()` 반복 실행.

**의도적으로 배선 안 함**: `runOPSQA_()`/`appendNewMTA()` 등 자동 실행 체인에는 아직 연결하지
않음 — 실데이터로 먼저 수동 검증(어떤 행이 삭제되는지 확인)한 뒤 자동 배선 여부를 별도로
결정하기로 함.

**✅ 검증 완료 (2026-07-28, 사용자 실행 확인)**: `runAutoDeleteExactDuplicateTouchRows()` 실행 —
294개 중복 행 삭제, MTA_Master 82,714 → 82,420행(헤더 제외), 에러 없음. 실행 시간 약 5분(9:19:33
~9:24:19) — GAS 6분 제한에 근접하진 않았으나 향후 중복 건수가 크게 늘면 느려질 수 있어 참고용으로
기록. 삭제 후 ACQ_Summary/Events_Engine 등 캐시된 지표(All Leads/All P1)에 반영하려면 각 Engine
refresh 함수 재실행 필요(또는 다음 `appendNewMTA()` 때 자동 반영).

## NewP1_REP Won/Revenue를 2트랙 확장 대상으로 편입 — Deal Tracker Created Date 기준 전환

**배경**: 오늘 앞서 ACQ_REP/Events_OPS/BOFU_OPS/Content_OPS의 Revenue/#Deals를 Deal Tracker
기반으로 전환하면서, NewP1_REP의 Won/Revenue는 "리드 단위 지표라 Deal Tracker로 바꾸려면
Target_REP이 이미 폐기한 리드 단위 매칭 문제(상담 후 이메일 덮어쓰기)에 부딪힌다"고 판단해
의도적으로 제외했었음(`docs/NewP1ReportDesign.md` 이전 버전 참고). 그런데 사용자가 다시 짚음:
Won/Revenue는 굳이 개별 리드를 딜과 매칭하지 않아도, **딜 자체의 Created Date**(리드 Create
Date와 같은 코호트 축 — Deal Tracker의 Lead Age 컬럼들이 리드 생성 시점 기준임을 시사)와 수동
Segment 컬럼만으로 (FY|Month|Segment) 코호트 단위로 직접 집계할 수 있음 — ACQ_REP(Close
Date 기준)·Events_OPS(프로그램명 기준)와 완전히 동일한 "딜 자체 필드 직접 집계" 패턴이라 리드
단위 매칭 문제 자체가 발생하지 않음.

**구현**:
- `90_TargetEngine.js` v1.14.0: `readDealTrackerRawRows_()`가 정규화된 `createdDate`(Date,
  타임존 보정 완료)도 반환(additive) — 기존 Target_REP 소비 함수는 새 필드를 무시하므로
  하위호환.
- `40_NewP1Report.js` v1.2.0: 신규 `computeNewP1DealWonRevenueFromRows_()` — Deal Tracker
  딜을 `createdFY + "|" + getFiscalMonthLabel(createdDate) + "|" + segment`로 집계(Upsell/N/A는
  ACQ_REP과 동일하게 "Other"로 접음). `computeNewP1Aggregates_()`는 이제 New P1/SAL/IC Booked/
  IC Complete만 Leads_OPS에서 집계하고, Won/Revenue는 이 신규 함수 결과와 키(`fy|month|segment`)
  기준으로 병합(union — 어느 한쪽에만 있는 키도 0으로 채워 포함).

**부작용(사용자 확인·승인)**: Won%(=Won÷New P1)의 분자(Deal Tracker 딜 건수)와 분모(Leads_OPS
New P1 리드 건수)가 서로 다른 두 집단이 됨 — "이 코호트 리드가 실제로 Won이 된 비율"이 아니라
"이 코호트 기간의 Deal Tracker 딜 규모 대비 리드 규모"로 지표 의미가 바뀜.

**결과**: NewP1_REP은 이제 완전한 Leads_OPS 예외가 아니라 **부분 2트랙 리포트**가 됨 — New P1/
SAL/IC Booked/IC Complete(리드~세일즈 액티비티)는 Leads_OPS, Won/Revenue(Opportunity/Revenue)는
Deal Tracker. 프로젝트 전체에서 2트랙 원칙의 완전한 예외로 남는 건 Search_OPS 하나뿐.

**아직 검증 필요**: `runRefreshNewP1Engine()` 실행 후 NewP1_REP의 Won/Revenue 값이 Deal
Tracker 실제 값과 맞는지 확인 전까지 완료로 간주하지 않는다.

**⚠️ 알려진 한계 발견(실행 중, 코드 문제 아님) — Referral 딜의 Created Date 결측**: 검증 중
사용자가 "7월 Referral Won이 1개뿐인 이유"를 물어 확인한 결과, `computeNewP1DealWonRevenueFromRows_()`
는 Priority 필터가 아예 없고(딜트래커 딜은 P1 필터 자체를 안 씀, CLAUDE.md #7 "딜의 99%가 이미
P1" 참고) 단지 **Referral 딜 중 상당수가 Created Date 자체가 비어있어** 코호트 집계에서 제외되고
있었음이 원인으로 확인됨. 사용자 확인: 세일즈가 Lead 생성 과정 없이 바로 Opportunity로 등록하는
Referral 특유의 흐름 때문으로 추정(CLAUDE.md #12에 이미 기록된 가설과 일치). 별도로 확인된
Webinar/Seminar $244,133.68 딜 미표시 건은 버그 아님 — 그 딜의 Created Date가 단순히 7월이
아니라서 정상적으로 다른 월 행에 집계된 것.

**처리 방침(사용자 확정)**: 코드는 수정하지 않음 — Created Date 없는 딜은 그대로 제외(현재
동작 유지), 이 문서에 알려진 한계로 기록만 한다. 사용자가 Deal Tracker에서 Referral 딜들의
실제 Created Date를 직접 입력한 뒤 재동기화(`runRefreshNewP1Engine()`)하면 반영될 예정. 다른
세그먼트도 Created Date 결측이 있는지는 별도 확인 안 함(Referral 특유 이슈로 추정, 필요 시
추후 점검).

## 워크북 셀 사용량 정리 — 1,000만 셀 상한 99.8% → 65.9%

**배경**: Events_OPS 갭 조사용 진단 시트 생성이 `"above the limit of 10000000 cells"` 에러로 실패
(워크북 9,984,712/10,000,000, 99.8%). Google Sheets 셀 개수는 실사용 범위가 아니라 시트에 할당된
그리드 크기(`getMaxRows()×getMaxColumns()`) 기준이라, `93_TempQA_DealTrackerMatch.js`
`runReportWorkbookCellUsage()`(읽기 전용 진단)로 실측한 결과 MTA_Raw(할당 123,205행 vs 사용
82,715행)와 Leads_OPS_QA(할당 34,983행 vs 사용 281행) 두 시트가 전체 낭비(3,391,010셀)의 67.6%를
차지하는 것으로 확인.

**해결**: `94_WorkbookMaintenance.js` 신규 — `runTrimAllSheetsToUsedRange()`가 워크북의 모든
시트를 실사용 범위(`getLastRow()`/`getLastColumn()`) 밖의 빈 행/열만 삭제(실제 데이터는 전혀
안 건드림, frozen 행/열보다 적게 안 남김, 시트별 try/catch로 하나 실패해도 나머지 계속 진행).
21개 시트 전체 실행 결과 92,350행/200열 삭제, 에러 없음 — **워크북 9,984,712(99.8%) →
6,593,702(65.9%), 낭비 셀 0**으로 정리 완료(사용자 실행 확인). MTA_Raw/MTA_Master 등 증분 append
방식 시트의 PropertiesService 카운터는 데이터 행 위치가 이동하지 않으므로 영향 없음.

## Events_OPS Webinar/Seminar Revenue 갭($2.35M) 조사 — 코드 버그 아님, Deal Tracker 데이터 정리로 해소 예정

**배경**: 딜트래커 기준 Webinar+Seminar 세그먼트 딜 총액($12,154,404.84)과 Events_OPS Revenue
총액($9,806,317.55) 사이 약 $2.35M 갭 발견. `93_TempQA_DealTrackerMatch.js`에 신규 진단
`runCheckEventsWebinarSeminarRevenueGap()`(Events_OPS의 K열 "Marketo Campaign name"/A열
"Lead Source Detail" 둘 다와 딜트래커 캠페인명을 대조) 추가해 조사.

**중간 버그(진단 스크립트 자체)**: 최초 실행 시 149개 전부 매칭 실패로 나왔으나, 이는 Events_OPS의
실제 헤더가 1행(SUBTOTAL 수식 행)이 아니라 2행(`EVENTS.ROWS.HEADER`)이라는 걸 진단 스크립트가
놓쳐서 K/A열 위치를 아예 못 찾은 것으로 확인(코드 버그, v2.7.0에서 수정). 수정 후 재실행 결과
33개 콤보, $2,922,678.28로 정상화(실제 갭 규모와 근접).

**분류 결과 (사용자 검토 후 처리 방향 확정)**:
1. **구식 "KR"/"GL" 국가 표기**(2020~2021년 캠페인, 예: `WB-2020-11 KR CGA + Minerva Webinar`,
   합계 약 $99만) — `isKoreanProgram_()`가 4번째 하이픈 토큰 "KOR"만 인식해 탈락. **처리: 무시
   (현재 상태 유지)** — 오래된 건들이라 실익 대비 수정 비용 안 맞음(사용자 확정).
2. WB-/EV- 프리픽스 자체가 없는 완전히 다른 포맷(`KOR_Core_...`, `KR_core_...` 등) — 1번과 유사한
   구식 표기, 별도 처리 안 함.
3. **WF- 프리픽스**(코드가 "이벤트 아님"으로 원래 제외하는 타입 — On-Demand 콘텐츠, Contact Us
   Form 등)인데 Deal Tracker Segment는 Webinar/Seminar로 태그된 건들 — **처리: 그대로 제외
   유지**(사용자 확인: On-Demand/Contact Form은 진짜 라이브 이벤트가 아님, 코드 동작이 맞음).
4. **캠페인명 뒤에 마침표/주석(`; expo MTA`, `; 카카오`, 수정 이력 등)이 붙어 정상 캠페인과 문자열이
   안 맞는 경우**, 두 캠페인명이 합쳐진 데이터 오류 1건 포함 — **처리: 사용자가 Deal Tracker에서
   직접 캠페인명 정리**(건수 적어 수작업이 빠름, 코드 정규화 로직 강화는 비슷한 패턴이 계속
   나올 위험이 있어 보류).
5. **Lead Source Detail 공백**(2건, $254,580.08 + $86,394.53) — **처리: 사용자가 Deal Tracker에서
   직접 확인해 채워넣을 예정**.

**결론**: 이번 갭은 코드 버그가 아니라 Deal Tracker 원본 데이터의 캠페인명 정리 상태 문제로 확인됨.
사용자의 수동 정리(카테고리 4, 5) 완료 후 재확인 필요 — 완료로 간주하지 않음.

## Fixed — Deal Tracker Close Date 타임존 버그 (매달 1일 Close 딜이 전월로 잘못 집계)

**발견 경위**: Segment 분류를 수동 컬럼으로 전환한 뒤에도 ACQ_REP 7월 Referral Revenue가
Deal Tracker 실제 합계와 계속 안 맞음. 원인 추적 과정: (1) Close Date 공란인 딜 발견·수정
($108,362.20, Lillian Kyunghee Kim), (2) 그래도 $54,891.44(Minu Kang, Close Date 2026-07-01)
짜리 하나가 끝까지 안 잡힘, (3) Close Date 유효성(`ISNUMBER()`)/Segment 값("Referral" 정확
일치)/Revenue 값 존재를 전부 사용자가 시트에서 직접 확인했는데도 재현 안 됨, (4) 임시 디버그
함수(`93_TempQA_DealTrackerMatch.js` `runDumpDealTrackerRowByOppName()`, 이후 제거)로 Apps
Script가 실제로 읽는 raw 값을 Logger로 직접 찍어본 결과 **Close Date raw value가 "Tue Jun 30
2026 11:00:00 GMT-0400"로 확인됨** — 사용자가 입력한 "2026-07-01"이 아니라 하루 밀린 값.

**원인**: 이 Apps Script 프로젝트의 타임존(`appsscript.json`: `America/New_York`)과 Deal
Tracker 스프레드시트([KOR] Deal Tracking, 한국 관련 딜이라 실제로는 다른 지역 타임존으로 추정)
가 다르다. Google Sheets Date 셀은 내부적으로 "그 스프레드시트 타임존 기준 자정"을 나타내는
값을 저장하는데, Apps Script가 이걸 `getValues()`로 읽어 JS `Date` 객체를 만들 때 그 절대
시각(instant)은 유지되지만, `getFiscalYear()`/`getFiscalMonthLabel()`(16_TransformHelper.js)이
쓰는 `.getMonth()`/`.getFullYear()`는 **이 스크립트 자신의 타임존**(America/New_York) 기준으로
동작한다. 두 타임존 시차(예: 한국 UTC+9 vs 미국 동부 UTC-4, 13시간 차)가 자정을 가로지르면서
"7월 1일 00:00(한국)"이 "6월 30일 11:00(뉴욕)"로 계산돼버림 — **매달 1일에 Close된 모든 딜이
구조적으로 전월로 잘못 집계되는 문제**(1일이 아닌 날짜는 하루 밀려도 대개 같은 달이라 증상이
안 드러났을 뿐).

**수정**: `90_TargetEngine.js`에 신규 `normalizeExternalCalendarDate_(date, sourceTimeZone)` —
Deal Tracker 스프레드시트 자체의 `getSpreadsheetTimeZone()`을 가져와 `Utilities.formatDate()`로
"의도된" 연/월/일을 문자열로 뽑아낸 뒤, 그 값으로 이 스크립트의 로컬 타임존에서 새 Date 객체를
재구성 — 타임존이 뭐든 `.getMonth()`/`.getDate()`가 항상 올바른 값을 반환하게 됨.
`readDealTrackerRawRows_()`가 Close Date/Created Date 둘 다에 이 보정을 적용하도록 수정
(v1.13.0). `getFiscalYear()`/`getFiscalMonthLabel()` 자체는 프로젝트 전역 공용 함수라 손대지
않음 — MTA_Master/Leads_Master 등 이 스크립트와 같은 스프레드시트에 바인딩된 데이터는 애초에
타임존이 일치해 영향 없음.

**같이 발견된 별개 이슈**: 조사 도중 사용자가 Close Date 컬럼 전체를 실수로 Plain Text 포맷으로
바꿔 모든 Revenue가 0으로 나오는 상황을 겪음 — Plain Text 포맷의 셀은 Apps Script가 문자열로
읽어 `instanceof Date` 체크에 전부 걸리기 때문(코드 버그 아님, 포맷을 Date로 되돌려 해결). 이후
Close Date/Created Date 컬럼 포맷을 `yyyy-mm-dd`(명확한 날짜 표시)로 정리함.

**남은 위험(참고, 이번 수정 범위 아님)**: `readChannelRawRows_()`/`readNaverRawRows_()`
(Target_REP의 외부 채널시트/Naver 시트 벤치마크 원천)도 동일한 구조(외부 스프레드시트 Date
직접 사용)라 같은 타임존 문제에 이론상 노출돼 있음 — 아직 실측으로 문제 보고된 적 없어 이번
라운드에선 손대지 않음, 필요 시 별도 확인.

**✅ 검증 완료 (2026-07-28, 사용자 확인)**: 수정 후 `runRefreshACQSummary()` 재실행 →
ACQ_REP 7월 전체 Revenue가 Deal Tracker 실측 합계 $999,931.89와 정확히 일치($999,932). 5월·6월도
추가로 대조해 전부 매칭 확인. 이 항목은 완료로 간주.

## Deal Tracker Segment 분류 — getBusinessSegment() 키워드 매칭 폐기, 수동 컬럼으로 전환

**배경**: 위 2트랙 전환 직후 실 데이터로 검증하던 중 Upsell 미제외 버그(아래 항목)를 고치고도
숫자가 계속 안 맞아 조사한 결과, ACQ_REP Search 세그먼트 Revenue가 코드 기준 $144,265인데
실제로는 ~$537,507.89(약 $393K 갭)로 확인됨. `getBusinessSegment()`(Lead Source Detail/Lead
Source/Source Category 키워드 매칭, 원래 Salesforce 리드 데이터용으로 설계된 로직을 Deal
Tracker에 재사용)가 Deal Tracker의 실제 데이터 형태에는 정확도가 크게 떨어진다는 게 실측으로
확인됨.

**결정**: 자동 분류 로직을 더 정교화하는 대신, 사용자가 Deal Tracker 시트에서 **H열
("Content Category"였던 컬럼)을 "Segment"로 개명하고 전체 딜을 수동으로 재분류**함 — 값은
Seminar/Webinar/BOFU/Search/Content/Referral/Other(Upsell 포함)/N/A(출처 불명, 대부분 2022년
이전 딜). 이 컬럼을 그대로 Source of Truth로 사용하기로 확정.

**구현**:
- `00_Config.js`: `CONFIG.TARGET.EXTERNAL.DEAL_TRACKER.COLUMNS.SEGMENT = 8`(H열) 추가.
- `90_TargetEngine.js`: `readDealTrackerRawRows_()`가 `businessSegment` 필드도 반환.
  `classifyDealSegment_()`는 `getBusinessSegment()` 호출 없이 `deriveTargetGroup_(row.businessSegment)`
  만 수행하도록 단순화 — Target_REP의 Deal Share/P1당 가치 계산도 자동으로 정확도 개선 혜택을 받음.
- `30_ACQReport.js`: `computeACQDealRevenueFromRows_()`가 `getBusinessSegment()` 호출과 별도
  Upsell 제외 로직(바로 아래 항목의 v1.9.1 수정)을 모두 제거하고 `row.businessSegment`를 그대로
  세그먼트 키로 사용 — Upsell은 이제 이 컬럼에서 이미 "Other"로 분류돼 있어 별도 제외 불필요.
- 관련 테스트(`testClassifyDealSegment`, `testComputeDealShareRatiosFromDealRows`,
  `testComputeDealCohortsFromDealRows`, `testComputeACQDealRevenueFromRows_`) mock 데이터를
  `businessSegment` 필드 기준으로 갱신.
- `93_TempQA_DealTrackerMatch.js`에 임시로 추가했던 `computeACQOtherSegmentDealsSummary_()`/
  `runListACQOtherSegmentDeals()`(getBusinessSegment 기준 Other/N/A 진단용)는 이번 전환으로
  용도가 없어져 제거.

**후속 수정 (같은 날)**: N/A로 태그된 딜(대부분 2022년 이전)이 `CONFIG.ACQ.SEGMENTS`(7개) 밖의
값이라 ACQ_Summary엔 집계되지만 `buildACQEngineRows_()`가 7개 세그먼트만 조회하는 리포트 화면엔
안 뜨는 문제를 사용자가 확인 — Upsell과 동일하게 **"Other"로 접어 넣기로 결정**.
`computeACQDealRevenueFromRows_()`(`30_ACQReport.js` v1.9.3)에 `row.businessSegment === "N/A" ?
"Other" : row.businessSegment` 한 줄 추가로 반영.

**✅ 검증 완료 (2026-07-28)**: Search를 포함한 5·6·7월 전 세그먼트 Revenue가 Deal Tracker
실제 값과 일치 확인(아래 타임존 버그 항목도 같이 해결된 뒤 최종 확인됨).

## 2트랙 아키텍처 확정 및 프로젝트 전역 적용 — Revenue/#Deals를 Deal Tracker 기반으로 통일

**배경**: `docs/OperationsLayer.md`("향후 모든 리포트는 Leads_OPS를 읽어야 한다")·
`docs/NewP1ReportDesign.md`·`docs/ACQReportDesign.md`·`docs/EventsReportDesign.md`가 여전히
"Leads_OPS가 유일한 소스"라는 원칙을 명시하고 있었는데, Target_REP은 이미 2026-07-27에 Deal
Tracker를 Revenue/세그먼트 분류의 Source of Truth로 전환한 상태(CLAUDE.md #7)라 문서와 실제
아키텍처가 모순되는 상태였음. 사용자가 이 모순을 명시적으로 해소: **"Revenue가 포함되는 모든
레이어는 딜트래킹을 소스 기반으로. 리드~세일즈 액티비티는 Leads/MTA, Opportunity단은
딜트래킹으로 2트랙 설계."**

**조사 결과**: Leads_OPS `Opportunity Won Date`/`Revenue`(리드 단위, Salesforce 동기화 컬럼)로
`#Deals`/`Revenue`를 계산하는 동일한 패턴이 **5개 리포트**에 존재함이 확인됨 — `30_ACQReport.js`
(ACQ_REP), `51_Events_Engine.js`(Events_OPS), `61_BOFU_Engine.js`(BOFU_OPS),
`71_Search_Engine.js`(Search_OPS), `81_Content_Engine.js`(Content_OPS). 사용자 확인 결과:

- **NewP1_REP**(Won/Revenue, 리드 단위 코호트 지표)은 전환 대상에서 제외 — 딜 단위로 바꾸면
  Target_REP이 이미 폐기한 것과 동일한 리드 단위 매칭 문제(상담 후 학부모 이메일 변경으로 원본
  마케팅 터치 이메일 복구 불가)에 부딪힘. 그대로 Leads_OPS 유지.
- **ACQ_REP**: Revenue를 Deal Tracker 기반으로 전환, Segment는 `getBusinessSegment()`를 딜
  자체 필드(Lead Source/Source Category/Lead Source Detail)로 직접 호출해 ACQ_REP의 7개
  Business Segment를 그대로 유지(Target_REP의 `classifyDealSegment_()`는 3개 Target 그룹으로
  collapse하므로 그대로 재사용하지 않음).
- **Events_OPS/BOFU_OPS/Content_OPS**: `#Deals`/`Revenue`를 Deal Tracker의 `Lead Source Detail`
  (W열, Marketo 프로그램명 문자열 — 라이브 시트 WebFetch로 실측 확인, 예:
  "WB-2026-05-KOR-MOFU-Core Common app Package")로 전환. 이 세 리포트는 프로그램 단위 lifetime
  집계(월 breakdown 없음)라 리드 단위 조인이 애초에 불필요 — 딜 자체의 프로그램명만 기존과
  동일하게 정규화(`stripRegistrationFormSuffix_`+`isKoreanProgram_`, Events는 추가로
  `isEligibleEventType_`)해서 바로 집계.
- **Search_OPS는 예외 처리**: raw UTM 단위(프로그램당 수십 개 행)로 그레인이 다른데, Deal
  Tracker는 프로그램 단위 `Lead Source Detail`만 있어 그대로 매칭하면 같은 프로그램을 공유하는
  여러 UTM 행이 동일 Revenue/#Deals를 중복으로 받게 됨. 사용자 판단: Marketo 프로그램을 UTM에
  수동으로 매핑하는 별도 작업이 필요해 이번 라운드에서는 예외 처리, 코드 변경 없이 주석으로
  사유만 기록.

**구현**:
- `90_TargetEngine.js`: `readDealTrackerRawRows_()`에 `closeDate`(raw Date) 필드 추가
  (additive, 기존 Target_REP 소비 함수 영향 없음). 신규 `computeDealTrackerCountsByKey_()`
  (순수 함수) — 도메인별 키 정규화 함수를 주입받아 `{dealsWon, revenue}`를 반환하는 프로젝트
  공용 헬퍼.
- `30_ACQReport.js`: `computeOPSAggregates_()`에서 Revenue 블록 제거. 신규
  `computeACQDealRevenueFromRows_()`(Segment×Month 집계) + 테스트.
- `31_ACQSummary.js`: `refreshACQSummary_()`가 `opsAgg.revenue` 대신
  `computeACQDealRevenueFromRows_(readDealTrackerRawRows_())` 결과를 사용하도록 배선 교체(키
  포맷 `fy|month|segment` 불변이라 `writeACQSummary_`/`readACQSummaryMap_`는 수정 없음).
- `51_Events_Engine.js`/`61_BOFU_Engine.js`/`81_Content_Engine.js`: 각 `aggregate*FunnelRecords_()`
  에서 `dealsWon`/`revenue` 누적 제거(IC Request/Booked/Complete는 그대로 유지). 신규
  `compute{Events|BOFU|Content}DealAggregates_()`가 `computeDealTrackerCountsByKey_()`를 도메인별
  키 정규화로 감싸 재사용.
- `71_Search_Engine.js`: 코드 변경 없음, 예외 사유만 주석으로 기록.
- 문서: `docs/OperationsLayer.md`(2트랙 예외 각주), `docs/ACQReportDesign.md`(Metric
  Definitions/Attribution 표), `docs/EventsReportDesign.md`(하이브리드 소스 표 분리 +
  BOFU/Content 동일 패턴 각주 + Search 예외), `docs/NewP1ReportDesign.md`(제외 사유 명시),
  `CLAUDE.md`(#5/#7/#12 갱신) 전부 반영.

**아직 검증 필요**: `runRefreshACQSummary()`(`31_ACQSummary.js`) 및 Events/BOFU/Content 각
Engine 갱신 함수를 Apps Script 편집기에서 직접 실행한 뒤, (1) ACQ_Summary의 세그먼트/월별
Revenue — 특히 Referral 세그먼트가 Deal Tracker 합계와 일치하는지(CLAUDE.md #12), (2) 각
`*_OPS` 시트의 `#Deals`/`Revenue`가 Deal Tracker 프로그램명 매칭으로 정상 채워지는지 확인 전까지
완료로 간주하지 않는다. 추가로 Deal Tracker `Lead Source Detail`의 일부 값(예:
"2025-07-KOR-Naver SA Study Consultants US")이 WB-/EV-/WF- 프리픽스 없는 형태인 것도 실측
확인됐는데, 기존 정규화 함수가 이런 값을 어떻게 처리하는지 아직 미검증 — 상세:
`docs/OperationsLayer.md`/CLAUDE.md #7 참고.

## Fixed — ACQ_REP Revenue가 Upsell 딜을 제외 없이 집계하던 버그 (실측 발견)

**발견**: 위 2트랙 전환 직후 사용자가 실 데이터로 검증하던 중, "Upsell 제외 시 2026년 7월
Revenue는 $956,560.04가 나와야 하는데 ACQ_REP은 $960,523으로 표시된다"고 보고 — 차액
$3,962.96.

**원인**: `computeACQDealRevenueFromRows_()`(`30_ACQReport.js`) 설계 당시 Target_REP의
`EXCLUDE_LEAD_SOURCES`(upsell·referral 둘 다 제외)를 "Target 전용 조정 베이스 개념이라 ACQ_REP엔
적용 안 함"이라고 판단했는데, 이 판단이 Referral과 Upsell을 한 묶음으로 취급하는 실수였음.
Referral은 ACQ_REP의 정식 Business Segment라 제외하면 안 되는 게 맞지만, Upsell은 애초에
마케팅 획득 채널이 아니라 ACQ_REP의 어떤 세그먼트에도 속하지 않는다. 제외 없이 그대로 두면
`getBusinessSegment()`가 Upsell 딜 대부분을 "Other"로 분류해 합산해버려 Revenue가 과대집계됨.

**수정**: `computeACQDealRevenueFromRows_()`에 `row.leadSource === "upsell"`인 행만 걸러내는
필터 추가(Referral은 그대로 유지). `30_ACQReport.js` v1.9.1. 테스트에도 Upsell 케이스 추가해
제외되는지 검증.

**참고**: 이 시점의 가설(Upsell 미제외가 갭의 전부)은 이후 조사에서 부분적으로만 맞은 것으로
드러남 — 실제로는 Segment 키워드 매칭 부정확 + 타임존 버그가 더 크게 기여(위쪽 최신 항목들
참고). 최종적으로 5·6·7월 전 세그먼트가 실제 값과 일치 확인됨.

## Leads_Master 완전 동일 중복 행 탐지/자동삭제 신규 구현 (CLAUDE.md #13)

**배경**: MTA_Master 완전 동일 중복(#3/#8)과 같은 문제가 Leads_Master에도 있는지 확인 요청 —
`24_OPSQA.js`에 Leads_Master 전용 로직이 없다는 게 확인돼 새로 설계.

**설계**: MTA_Master(터치 단위, 한 Lead가 여러 번 나오는 게 정상)와 달리 Leads_Master는 Lead ID
1개 = 행 1개가 정상 구조라, 5필드 복합키 대신 **Lead ID 단독**을 그룹 키로 사용. 진행 단계
tie-break(Won > IC Complete > IC Booked > 없음)는 기존 `computeTouchProgressionScore_()` 재사용
(필드명이 동일해 그대로 호환).

**구현(`24_OPSQA.js` v1.4.1)**: `checkExactDuplicateLeadRows_()`/`findExactDuplicateLeadRows_()`
(탐지, `runOPSQA_()`에 배선) + `findExactDuplicateLeadRowsToDelete_()`/
`readLeadsMasterRowsWithIndex_()`/`runAutoDeleteExactDuplicateLeadRows()`(자동삭제, 수동 실행
전용). 자동삭제는 MTA_Master 버전과 동일 방침으로 `appendNewLeads()` 자동 체인엔 배선 안 함.

**검증 완료**: 단위 테스트 3개 전부 PASS, `runOPSQA_()` 실행 결과 현재 Leads_Master 완전 중복
0건(탐지 로직 정상 동작 확인, 실제 삭제 동작은 향후 중복 발생 시 검증 예정).

**사이드노트**: 최초 구현 시 테스트 함수명에 `_`를 붙였다가(`testFindExactDuplicateLeadRowsToDelete_()`)
Apps Script Run 드롭다운에 안 보이는 문제 발견(`docs/apps-script-gotchas.md` #2) → 제거(v1.4.1).
MTA_Master용 동명 함수는 동일 문제 추정되나 사용자 결정으로 그대로 둠.

## Backend 실행 체인 비동기화 — 설계 확정, 구현은 TODO (CLAUDE.md #9)

**배경**: `appendNewLeads()`/`appendNewMTA()`가 Import 후속 처리(OPS Build/Engine 갱신 7개)까지
전부 한 실행 안에서 순차 처리해 느림 — 사용자가 Import만 하고 나머지는 백그라운드 처리되길 원함.

**막힌 지점 해소**: `docs/PerformanceBenchmark.md`의 `rebuildMTAMaster()` 실측(7m58s, 타임아웃
없이 정상 완료)으로 미루어 이 프로젝트는 Google Workspace 계정(30분 제한)으로 추정 — 실행시간
하드 리밋 자체는 병목이 아니고, 진짜 문제는 UX(브라우저 다이얼로그 대기)와 진단 가능성.

**설계 확정**: 단계마다 트리거를 걸면 GAS 트리거 디스패치 지연이 누적돼 오히려 느려질 위험이
있어, **트리거는 파이프라인당 1번만 걸고 그 안에서 전체 체인을 순차 실행**하는 구조로 확정.
적용 범위는 `appendNewLeads()`/`appendNewMTA()`만(Full Rebuild 제외). 동시 실행은 단순 락으로
거부, 실패 시 즉시 중단 + 수동 재시도, 진행상태는 기존 README 탭에 표시. 상세: CLAUDE.md #9.

**상태**: 설계만 확정, 코드 변경 없음 — 사용자 요청으로 구현은 TODO 보류.

## Search_OPS Business Segment 분류 개선 — 다단계 (CLAUDE.md #14)

**배경**: 사용자가 Search_OPS에서 ebook/guide/SAT practice test 등 콘텐츠성 캠페인이 Search로
잘못 분류된 걸 발견하면서 시작된 연쇄 개선 작업. 상세 이력은
`docs/BusinessSegmentClassification.md`의 2026-07-28 항목들에 전부 기록 — 요약만 남김.

**1단계 — leadSource 우선순위 반전**: `leadSource.includes("search")`가 Content 판정보다 먼저
체크돼 ebook 등 콘텐츠 리드가 Search로 덮어써지던 문제(22개 값·약 1,190건 실측) → Content
판정 뒤로 이동. `runInvestigateSearchMisclassifiedCampaigns()`(`71_Search_Engine.js`)로 진단.

**2단계 — SAT Practice Test 하드코딩 예외**: 공통 키워드가 없는 "Mini/Digital SAT Practice
Test" 계열 3건을 `BUSINESS_SEGMENT_EXCEPTIONS`에 추가.

**3단계 — campaign의 "_contact"/"consult"도 동일 문제**: 이 계정 Meta 캠페인 다수가 슬러그에
관례적으로 `_contact`/`consult`를 붙여서 Content 캠페인까지 가로챔 → `campaign.includes("search")`/
`campaign.includes("sitelink")`를 확정 신호로 신규 분리(Content보다 먼저), `_contact`/`consult`는
fallback으로 이동. 사용자가 제시한 "명확한 Search" 49개 캠페인 전수 검증으로 안전성 확인.

**4단계 — Content 키워드 확장**: "download"/"case study"/"quiz"/공백형 "on demand" 추가(사용자 확정).

**5단계 — BOFU/Search fallback 재설계**: 사용자 확정 — "BOFU/Search 세그먼트 캠페인 둘 다
`_contact`를 붙이는데, Search는 역사적으로 Lead Source가 Naver/Google/Organic(+Paid) Search인
경우만 존재, 그 외는 전부 BOFU". `search`/`sitelink` 확정 신호가 없는 순수 `_contact`/`consult`
캠페인은 leadSource로 최종 판별(search 계열이면 Search, 아니면 BOFU)하도록 재설계.

**Search_OPS 죽은 키 정리**: `mergeSearchOPS_()`의 합집합 병합 때문에 Business Segment가 바뀌어도
지워지지 않던 레거시 행 116건 발견 — 수동 컬럼 전부 공백 확인 후 `runDeleteDeadSearchOPSRows()`
(`71_Search_Engine.js`) 신규 추가.

**구현 파일**: `16_TransformHelper.js`(v1.5.0→v1.8.0, `getBusinessSegment()` 핵심 로직),
`71_Search_Engine.js`(v1.4.0→v1.7.0, 진단/삭제 유틸리티). 신규 테스트:
`testGetBusinessSegmentContentBeatsLeadSourceSearch()`, `testGetBusinessSegmentSearchCampaignSignals()`,
`testGetBusinessSegmentContactFallbackToBOFU()`.

**잔존 미해결(CLAUDE.md #14)**: 옛날 ebook Marketo flow가 UTM 없으면 leadSource를 "Organic
Search"로 기본 처리하던 레거시 때문에, leadSource가 문자 그대로 "Organic Search"인 리드 중 일부는
실제로는 진짜 검색 유입이 아닐 수 있음 — 식별 기준이 아직 없어 별도 재검토 필요.

### 다음 세션 시작 시 할 일 (미실행 상태로 세션 종료)

아래는 전부 **코드/clasp push는 완료**됐지만, 사용자가 Apps Script 편집기에서 아직 **실행하지
않은** 항목 — 다음 세션 시작 시 이어서 진행:

1. `16_TransformHelper.js`의 `testGetBusinessSegmentContactFallbackToBOFU()` Run (신규 테스트,
   BOFU/Search leadSource 판별 검증).
2. `71_Search_Engine.js`의 `runDeleteDeadSearchOPSRows()` Run (죽은 키 116건 삭제).
3. `10_MasterBuild.js`의 `rebuildLeadsMaster()` → `rebuildMTAMaster()` 순서로 재실행 (Content
   키워드 확장 + BOFU/Search 재설계를 Master 전체에 소급 적용 — 직전 Rebuild는 3단계 수정
   전이라 아직 최신 로직 미반영 상태).
4. `72_Search_Build.js`의 `buildSearchOPS()` Run (Search_Engine 최신값을 Search_OPS에 반영).
5. 위 4단계 완료 후, Search_OPS를 다시 살펴보고 남은 문제(예: SAT Practice Test의 다른 문구
   변형들 — "Core SAT practice test" 등, 기존 하드코딩 예외와 다른 값이라 아직 미해결)가 있는지
   확인.

# Changelog — 2026-07-27

## Target_REP P1당 가치(Block B) — 코호트1/2 이원화 구현

**배경**: 바로 아래 섹션("Deal Tracker Source of Truth 전환")에서 "다음 단계(미착수)"로 남겨뒀던
코호트1/2 분리를 이어서 구현. content(ebook 등)처럼 nurture 사이클이 긴 채널은 단일 FY 코호트만
으로 P1당 가치를 구하면 심각하게 저평가된다는 문제의식에서 출발.

**확정된 프레임워크(사용자, "응 맞아")**: 이번 FY 총 딜 = 이번 FY 생성된 리드 코호트(코호트1) +
더 오래된 리드 코호트(코호트2).
- `CurrentFYP1V (a)` = 코호트1 Revenue(Created FY = Closed FY = 타겟 FY) ÷ 타겟 FY New P1 수
- `PrevP1V (b)` = 코호트2 Revenue(Closed FY = 타겟 FY, Created FY ≠ 타겟 FY) ÷ (Leads_OPS
  all-time 총 P1 수 − 타겟 FY New P1 수)

**구현**: `readDealTrackerRawRows_()`가 텍스트 FY 컬럼 대신 실제 Date 셀인 Close Date/Created
Date에서 `closeFY`/`createdFY`를 직접 파생(더블클릭 시 캘린더 뜨는 진짜 Date 타입임을 사용자가
확인 — 텍스트 파싱 리스크 없음). `computeDealCohortsFromDealRows_()` 신규 — 그룹별 코호트1/2
Revenue를 한 번에 계산. `computeTargetLeadsOPSAggregates_()`가 `newP1CountByGroup`(타겟 FY 신규
P1 수)과 `totalP1CountByGroup`(all-time 총 P1 수)를 반환하도록 변경(구 `p1ValueByGroup`/
Leads_OPS Revenue 합산 제거 — Revenue는 이제 Deal Tracker 코호트 기준). `computeP1ValueBlockRows_()`
가 a/b를 둘 다 계산해 Target_Engine Block B(4→7컬럼 확장, `CONFIG.TARGET.ENGINE`)에 나란히 기록.

Deal Share(Block C) 계산도 같은 세션에서 "3FY median" → "타겟 FY 코호트1 단일" 로 이미 전환된
상태(직전 커밋)였는데, 이번 라운드에서 필터 조건을 `closeFY===createdFY===타겟FY`로 보강(기존엔
Close FY만 봤음 — 사실상 결과는 동일했으나 코호트 정의를 명시적으로 맞춤).

**최종 FY P1 목표 공식(Block D)에서 a/b를 어떻게 합칠지는 아직 미정** — 사용자가 실물 값을 직접
검토한 뒤 결정하기로 함. 그 전까지는 원래 단일 코호트 정의에 가장 가까운 `a`를
`computeTargetDerivationRows_()`의 임시 placeholder로 사용.

`93_TempQA_DealTrackerMatch.js`도 `readDealTrackerRawRows_()`의 반환 필드 변경(`fy` →
`closeFY`/`createdFY`)에 맞춰 갱신 — 구 `MEDIAN_FYS` 설정 참조가 남아있어 방치 시 런타임 에러가
날 상황이었음.

**아직 검증 필요**: `runRefreshTargetEngine()` 실행 후 Target_Engine Block B의 코호트1/2
Revenue·New P1/Prev P1 수·a·b 값이 실물 데이터와 맞는지 확인 전까지 완료로 간주하지 말 것.
`docs/TargetReportDesign.md` §5 "P1당 가치" / CLAUDE.md #7에 상세 반영.

## Deal Tracker 매칭 아키텍처 전면 폐기 → Deal Tracker Source of Truth 전환

**배경**: Student Contact Email/Primary Guardian Email/Account Name 3단계 매칭으로 매칭률을
10.7%→86.5%까지 끌어올렸으나(위 섹션들 참고), Sales팀에 직접 확인한 결과 근본적 한계 발견 —
**상담 종료 후 학부모가 이메일 변경을 요청하면 Salesforce의 Lead/Opportunity 이메일이 그대로
덮어써져, 원본 마케팅 터치 이메일이 시스템적으로 복구 불가능한 경우가 있음**. 즉 아무리 매칭
로직을 정교화해도 원천 데이터 자체가 소실된 케이스는 근본적으로 못 잡는다는 것이 확인됨.

**최종 결정**: Leads_OPS 개별 리드 매칭을 전부 폐기하고, **Deal Tracker 자체를 Source of Truth로
전환**. 딜 자체에 기록된 Lead Source/Source Category/Lead Source Detail로 `getBusinessSegment()`
(16_TransformHelper.js, 프로젝트 전체가 쓰는 공용 분류 로직)를 직접 호출해 세그먼트 분류
(`classifyDealSegment_()`, 90_TargetEngine.js) — Leads_OPS 조회 자체가 필요 없어짐. P1 판정도
제거(사용자 확인: 딜의 99%가 이미 P1이라 사실상 전수 반영과 동일). `Deal_Raw` 자체 파이프라인화
(이전 섹션)와 재구축 시트(Student/Guardian Email 포함) 둘 다 폐기하고, 원래 쓰던 시트(gid
498663095)로 복귀 — 컬럼 구조는 FY(텍스트)/Revenue (NZD)/Lead Source/Source Category/Lead
Source Detail만 사용, Close Date/Created Date는 다음 단계(P1당 가치 재설계)를 위해 읽어서
보존만 해둠.

`computeTargetLeadsOPSAggregates_()`의 emailToGroupMap/nameToGroupsMap 빌드 로직 전부 제거(사용처
없어짐 — 코드 단순화). `93_TempQA_DealTrackerMatch.js`는 "분류 실패한 딜"(Lead Source/Source
Category/Lead Source Detail 조합별 집계) 기반으로 재작성.

**다음 단계(미착수)**: content(ebook 등) 리드는 nurturing이 최대 28개월 걸려 FY26 단일 코호트만
으로 P1당 가치를 구하면 심각하게 저평가됨(원래 발견: content Target P1이 주 871로 비정상적으로
높게 나왔던 원인). 딜트래커의 Created Date 기준 "이번 FY 생성 코호트"(코호트1)와 Close Date
기준 "이번 FY 종료·이전 FY 생성"(코호트2) 두 개를 분리 산출해 Target_Engine에 나란히 표시하기로
사용자와 합의 — 최종 공식 반영 방식은 숫자를 보고 추후 결정. CLAUDE.md #7에 상세 기록.

## Deal_Raw 파이프라인화 결정 재검토 → 구글시트 단일 관리로 원복

바로 아래 섹션("Deal_Raw 자체 파이프라인화로 방향 확대")에서 내린 결정을 사용자가 다시 생각해보고
번복함 — 어차피 Lead Source(Student/Guardian 이메일) 오류 교정은 마케팅팀이 계속 수동으로 해야
하는 작업이라, 자동 import 파이프라인(Deal_Raw)을 따로 만들어도 "업로드 + 수동 관리" 이중 작업이
될 뿐 실익이 없다는 판단. **원래대로 구글시트 하나로 관리(수동 교정도 같은 시트에서)하는 방식으로
확정** — 단, 시트는 Student Contact Email/Primary Guardian Email 컬럼을 포함해 FY24~26 기준으로
새로 재구축 중. CLAUDE.md #7 갱신함(아래 섹션 대신 이 결정이 최종).

## Deal Tracker 매칭 문제 근본 원인 규명 — Deal_Raw 자체 파이프라인화로 방향 확대 (2026-07-27, 이후 번복됨 — 위 섹션 참고)

**배경**: Opp Email 2차 매칭(아래 섹션)을 추가한 뒤에도 근본 원인을 더 파다가, 훨씬 명확한 설명을 찾음 —
Salesforce Opportunity는 "Student Contact: Email"과 "Primary Guardian: Email" 두 개의 서로 다른
이메일을 관련 컨택트로 가짐. Marketo 마케팅 액티비티(퍼스트터치)는 보통 Student 쪽 이메일에 남는데,
Leads_OPS.Email은 (Lead Merge 등의 이유로) 종종 Guardian 쪽 이메일로 남아있는 경우가 있음. 사용자가
Salesforce 리포트에서 "Primary Guardian: Email"/"Student Contact: Email"을 직접 뽑아 기존 확인
사례(Ryan Kang)와 대조 — Student Contact Email(`rkckdev@gmail.com`)이 실제 마케팅 리드였고, Guardian
Email(`tomyalice@naver.com`)이 Leads_OPS에 잘못 남아있던 값과 정확히 일치함을 검증 완료.

**방향 결정**: 외부 구글시트([KOR] Deal Tracking)를 `openById()`로 계속 참조하며 매칭 로직만 보정하는
대신, 이 프로젝트 자체의 `Deal_Raw` import 파이프라인(Leads_Raw/MTA_Raw와 동일 패턴 — Raw 불변성,
날짜 Plain Text 보호, Validation 등 기존 인프라 재사용)으로 승격하기로 결정. 이참에 CLAUDE.md #5
(Opportunity Won Date 대체)와 #7(Deal Tracker 통합)을 하나의 설계로 묶어서 별도 세션에서 다루기로
합의 — 오늘 세션이 이미 길어져서 결정 사항만 CLAUDE.md #7/#12에 기록하고 구현은 시작하지 않음.
Deal Tracker 시트 구조는 사용자가 FY24~26 기준으로 Salesforce 리포트에서 재구축 중(날짜 컬럼은
`docs/DateParsing.md`의 기존 Plain Text 가이드 안내함 — 단, 현재 매칭 로직은 날짜 컬럼을 전혀 안 읽어서
당장의 계산엔 영향 없음).

## Deal Tracker Opp Email 2차 매칭 추가 (Source email 매칭률 10.7% 원인 조사 후속)

**배경**: 매칭 안 되는 이메일 목록(`temp_DealTrackerUnmatched`)을 사용자가 직접 Leads_OPS/Salesforce와
대조하며 2건(June Chang, Philip Ahn) 조사 — 둘 다 딜트래커의 Source email(마케팅 퍼스트터치 이메일)이
아니라, 그 Opportunity가 속한 **Account의 정식 이메일**로는 Leads_OPS에 실제로 존재함을 확인. 즉
Opportunity 레벨 이메일과 Account 레벨 이메일이 서로 다른 게 반복되는 구조적 패턴으로 확인됨(단순
오타 아님).

**해결**: 사용자가 딜트래커 시트에 `Opp Email`(신규) / `Revenue KRW`(신규) 컬럼 추가, `Revenue (NZD)`는
A1 환율 셀 기준 `Revenue KRW`를 변환한 수식값으로 전환(향후 환율 일관성 개선). `matchDealEmailToGroup_()`
신규(90_TargetEngine.js) — Source email 매칭 실패 시 Opp Email을 2차 후보로 시도. 컬럼 위치 전체 이동에
맞춰 `CONFIG.TARGET.EXTERNAL.DEAL_TRACKER.COLUMNS` 갱신(00_Config.js). `93_TempQA_DealTrackerMatch.js`도
동일 매칭 로직을 재사용하도록 수정(기존엔 Source email 단독 매칭만 확인해서 QA 시트가 실제 계산보다
과다하게 "안 맞음"으로 보여줬음), Opp Email 컬럼도 표시. CLAUDE.md #12에 상세 기록.

**별개 발견 — ACQ_REP Revenue 갭 조사**: 이 과정에서 이번 FY 전체 Revenue를 Salesforce 리포트/딜트래커와
ACQ_REP로 대조하다 Referral 세그먼트에서 연간 $636,739(약 22.8%) 갭 발견 — 단 최근 3개월(5·6·7월)은
갭이 미미(환율 수준)해서 현재 진행 중인 문제는 아닌 것으로 판단, 낮은 우선순위로 CLAUDE.md #13에 기록.
KRW 원본 값 기반 자체 환율 변환이 정확도를 높일 수 있다는 가설도 함께 메모.

## Target_REP Block C(딜 비중) 균등분할 placeholder → Deal Tracker 실데이터 연동

**배경**: 사용자가 content 그룹의 Target P1이 비정상적으로 크게 나오는 걸 발견 — 원인은
목표 공식(FY P1 목표 = Revenue Target × 딜 비중 ÷ P1당 가치)에서 딜 비중이 아직 딜트래커
미이관 상태라 events 34% / contact 33% / content 33% 균등분할 placeholder였던 것. content는
실제로 P1당 가치가 낮은데 딜 비중까지 과대평가되면서 목표 P1 수가 크게 튀어나옴. 사용자가
"P1 목표도 작년 딜(레퍼럴·업셀 제외)에서 나오는 실제 비중만큼 가져가야 한다"고 지적, Deal
Tracker(`[KOR] Deal Tracking`, 스프레드시트 ID `1oGCY8okaxhpHrtotUzbhyprCOVcJ9ndX5kX3m5qqxME`)
링크 공유받아 WebFetch로 실물 구조 확인 후 연동.

**Deal Tracker 실물 구조**: FY24·25·26 3개 FY 존재(design의 "3FY median"과 정확히 일치).
`Lead Source` 컬럼에 "Upsell"/"Referral" 값이 명확히 구분돼 있어 그대로 제외 필터로 사용 가능.
`Source email`로 Leads_OPS의 `Email`과 매칭해 Business Segment(→그룹) 확인.

**구현**: `CONFIG.TARGET.EXTERNAL.DEAL_TRACKER` 추가(00_Config.js). `readDealTrackerRawRows_()`
(원시 행 읽기) / `computeDealShareRatiosFromDealRows_()`(순수 계산 — 조정 베이스 대비 그룹별
비중, FY별 계산 후 3FY median) / `computeDealShareFromTracker_()`(I/O 래퍼) 신규
(90_TargetEngine.js). `computeTargetLeadsOPSAggregates_()`를 확장해 Leads_OPS 1회 스캔에서
New P1 벤치마크/P1당 가치와 함께 `emailToGroupMap`(P1 여부 무관 전체 리드 대상)도 같이 만들도록
변경 — 딜은 P1이 아니었던 리드에서도 발생할 수 있어 P1 필터 이전 단계에서 매핑해야 함. Deal
Tracker 접근 실패 시(시트 없음 등)엔 Input 블록 수동값으로 Fallback(`computeDealShareBlockRows_()`)
— 완전 실데이터 대체가 아니라 안전장치로 유지. `docs/TargetReportDesign.md` §12 Open Item #5
완료 처리, CLAUDE.md #7과는 별개 좁은 용도임을 명시(Opportunity Won Date 보정 레이어는 여전히 미착수).

## Target_REP 실물 확인 후 UI/데이터 수정 4건

**1) Week Start/End 연도가 1926년으로 나오는 버그** — `generateCalendarWeeksForFY_()`가
`new Date(targetFY - 1, 7, 1)`을 호출하는데, `targetFY`가 2자리 숫자(27)라 `new Date(26, 7, 1)`이
되고 JS `Date` 생성자가 0~99 사이 연도를 자동으로 1900년대로 해석("26" → 1926)하는 함정에 걸림.
같은 원인으로 요일 정렬도 틀어져 월요일로 시작해야 할 첫 주가 일요일(8/2)부터 시작하는 것처럼
보였음 — 사용자가 "2026-08-03이 월요일 맞는데 왜 8/2부터 시작하냐"고 지적해 발견. `resolveTargetFYCalendarYear_()`
추가(2자리 FY → 실제 4자리 연도 보정)로 해결, 수정 후 2026-08-03(월) 정렬 정상 확인 가능.

**2) Month 컬럼 "FY27 AUG" → "AUG"** — 사용자 요청으로 FY 접두사 제거, 월 라벨만 표시
(`targetDerivationRowsToMatrix_()`, `90_TargetEngine.js`).

**3) Target_REP Control 영역(1~3행) 전체 삭제** — 체크박스/안내문/파라미터 요약이 있던 자리를
삭제하고 1행은 향후 월 소계 행 후보로 비워둠, 2행부터 리포트 헤더, 3행부터 데이터 시작
(`CONFIG.TARGET.REPORT.ROWS`, `00_Config.js`). `writeTargetParamSummary_()` 제거.

**4) 숫자 서식 — 소수점 전부 제거, 달성%만 소수 2자리** — 기존 Target P1(소수1)/CPNP1(소수2)를
전부 정수(`#,##0`)로, 달성%는 `0.00%`로 통일 (`92_TargetStyles.js`).

## Target_REP 실측 버그 수정 2건 (setupTargetReport() 실행 중 발견)

**1) Block 0 입력값 개별 셀 호출로 인한 타임아웃** — `setupTargetReport()` 최초 실행 중
"Service Spreadsheets timed out" 발생. `readTargetEngineInputs_()`/`setupTargetEngineInputDefaults_()`
(`90_TargetEngine.js`)가 Input 블록 9개 행을 셀 단위로 개별 `getValue()`/`setValue()`(최대 27회
왕복) 하던 게 원인 — 컬럼 전체 `getValues()`/`setValues()` 배치 호출(1회 읽기 + 2회 쓰기)로 교체,
해결 확인(20.21초 만에 정상 완료).

**2) Generate 체크박스가 Simple Trigger 권한 한계로 동작 불가** — 타임아웃 수정 후 체크박스를
눌러보니 `Exception: Specified permissions are not sufficient to call SpreadsheetApp.openById`
발생. Apps Script의 Simple Trigger(전역 `onEdit(e)`)는 제한된 권한(restricted authorization)으로
실행되어 컨테이너 밖의 다른 스프레드시트를 여는 것 자체가 원천적으로 불가능함 — ACQ_REP/NewP1_REP는
외부 파일을 안 열어서 지금까지 드러난 적 없던 문제. 사용자 확인 후 Target_REP만 체크박스+onEdit을
제거하고 **수동 실행**(`runGenerateTargetReport()`, `91_TargetReport.js`를 Apps Script 편집기에서
직접 Run)으로 전환 — 직접 Run은 Full Authorization이라 문제없음. `30_ACQReport.js`의 중앙
`onEdit()` 디스패처에서도 Target_REP 분기 제거. `docs/TargetReportDesign.md` §9 갱신.

## Target_REP (Weekly Segment Target & Achievement Report) — 설계 확정 + 1차 구현

**배경**: 주 단위(월~일)로 세그먼트 그룹(events/contact/content)별 New P1/CPNP1 목표를 top-down
(마케팅 Revenue 타겟 × 딜 비중 ÷ P1당 가치)으로 역산해 실적과 대조하는 신규 리포트. 설계 전문은
`docs/TargetReportDesign.md` 참고.

**막힌 지점 해소(구현 착수 전 확인)**:
- Leads_OPS FY24 커버리지 존재 확인 → New P1 벤치마크 FY24·25·26 = 1:2:3 가중 유지
- 채널시트 FY24 광고비 복구 불가 확인 → CPNP1 벤치마크 FY25·26 = 2:3 가중 유지
- 외부 채널시트/Naver 시트 실물 구조를 WebFetch(CSV export)로 직접 확인 — 스프레드시트 ID
  `1QDB_9MiD6eTeNlnC8YMWXbyncSwgDOTZT-A-KItlu6A`, 채널시트 gid `1718473299`, Naver gid
  `387972603`, 컬럼 레이아웃 확정 (`docs/TargetReportDesign.md` §3). 탭 이름이 아닌 gid로 매칭.
- 채널시트 "2026-06-28/07-05/07-19 세 주 완전 동일값" 문제를 직접 대조해 실제 데이터 문제로 확인 —
  사용자가 구현 착수 전 채널시트에서 직접 교정하기로 결정, Engine은 별도 보정 로직 없이 값을 그대로 신뢰.

**신규 파일**:
- `90_TargetEngine.js` — Block A(벤치마크)~D(목표 전개) 계산/작성. 월~일 주 캘린더 생성
  (`generateCalendarWeeksForFY_()`), 결측 FY 자동 제외 가중평균(`computeWeightedAverage_()`),
  top-down 공식 체인(`computeFYP1Target_()`→`computeMonthlyP1Target_()`→`computeWeeklyP1Target_()`,
  `computeMonthlyCPNP1Target_()`), 외부 채널시트/Naver 시트 gid 매칭 참조.
- `91_TargetReport.js` — `setupTargetReport()`(최초 1회 수동), Generate 체크박스(onEdit, Engine
  전체 재계산 후 리포트 작성), `refreshTargetActuals_()`(Engine 재계산 없이 Actual/달성%만 갱신 —
  기존 `refreshACQSummary_()` 호출 지점 4곳에 나란히 배선).
- `92_TargetStyles.js` — ACQ_REP 관례 서식(% 소수 1자리, 금액 콤마, 테두리, 짝수 행 배경, 헤더 Note).
- `CONFIG.TARGET`(`00_Config.js`) — 시트명/그룹 매핑/벤치마크 가중치/외부 파일 참조/Engine·Report
  레이아웃 전부 중앙화.

**onEdit 배선**: `30_ACQReport.js`의 중앙 `onEdit()` 디스패처에 `CONFIG.TARGET.SHEET` 분기 추가
(`handleTargetReportGenerateEdit_()`, NewP1_REP과 동일한 이유로 onEdit()은 한 파일에만 둠).

**미해결(구현 후 실물 확인 필요, `docs/TargetReportDesign.md` §12 #6~8)**: 개선계수 초기값 0.9
placeholder, events의 Seminar/Webinar 분해 보조 표시 여부, 월 소계 행 여부. `setupTargetReport()`
(91_TargetReport.js) 실행 및 실제 시트 검증 전까지 미완료 상태.

# Changelog — 2026-07-25 (계속)

## Business Segment QA 착수 — temp_QA 시트 신설 + 분류 룰 대량 보강

**배경**: OPS 전체(Leads/BOFU/Search/Content/Events) 구축 완료 후 QA 착수. `getBusinessSegment()`
(`16_TransformHelper.js`)로 분류된 Business Segment 중 "Other"로 잘못 떨어지는 케이스가 대량
발견되어(최초 6,888건), 신규 시트/테스트 함수와 함께 여러 차례에 걸쳐 룰을 보강함.

**신규 파일**: `25_TempQA_BusinessSegment.js` — Leads_OPS를 Leads_Master와 Lead ID로 조인해
`getBusinessSegment()`로 재계산한 값과 실제 저장된 Business Segment를 비교, Other이거나 불일치하는
행만 `temp_QA` 시트에 나열(`runTempQABusinessSegment()`). "comp"/"checklist"/"Mini Digital SAT"/
"TOFU" 포함 + 여전히 Other인 케이스는 "Other 잘 분류"로 별도 표시(일반화 불가능한 개별 예외로 확인).

**분류 룰 보강 (`16_TransformHelper.js`, 여러 차례에 걸쳐 반영, 최종 6,888건 → 2,269건 → 다수 추가
보강)**:
- Search: `leadSource.includes("search")`, `detail.includes("contact")` 추가
- Seminar/Webinar: 캠페인명 패턴(`offline-seminar`/`online-webinar`), `summit`/`live event`/
  `seminar`/`세미나`/`expo` 단어, `book a consult`, `open day` 추가. `EV-`/`WB-` 접두사 체크를
  위치 무관 `includes()`로 완화(예: "Registered for EV-2024-..." 처럼 접두사가 아닌 위치의 케이스
  대응)
- BOFU: `ptc`(Push To Consult), `consultation request`/`consult page` 추가 — "book a consult"
  (Webinar) > "consultation request"/"consult page"(BOFU) > 순수 "consult"(Search) 우선순위 확정
- Content: `infographic`, `on-demand`/`ondemand` 추가, 단일 필드(campaign) 의존 문제 해결
  (ebook 등 6개 키워드를 detail에도 미러링)
- `BUSINESS_SEGMENT_EXCEPTIONS` 신설 — 공통 키워드 없는 순수 오타성 예외(Content 8건, Webinar 1건)
  를 정확한 문자열 매칭으로 하드코딩 처리. 근본 수정 대상 Marketo 캠페인/폼 이름 목록을
  `docs/BusinessSegmentClassification.md` "Marketo 네이밍 정정 필요 목록"에 기록
- **N/A 세그먼트 신규 추가**: `getBusinessSegment()`에 4번째 파라미터 `category` 추가(Leads:
  First Lead Source Category / MTA: Lead Source Category, 신규 export 필드). MKT UTM Campaign/
  Lead Source Detail/Lead Source Category/Lead Source 4개가 전부 공백이면 "Other" 대신 "N/A" 반환
  — "데이터 자체가 없음"과 "데이터는 있지만 룰에 안 맞음"을 구분

자세한 배경/판단 근거는 `docs/BusinessSegmentClassification.md` 참고.

## MTA Funnel Sync — 대표 터치 선정 기준 정정 (earliest → latest)

**문제**: `computeMTAFunnelByLeadId_()`(`09_MTAFunnelSync.js`)가 Lead ID별 IC Booked/Completed/
Won Date/Revenue를 뽑을 때 "가장 오래된 터치"(mergeOPS()의 중복 리드 식별 원칙을 잘못 그대로 적용)
값을 채택하고 있었음 — 이 필드들은 파이프라인 진행에 따라 갱신되는 Lead 레벨 스냅샷이라, 오래된
터치엔 아직 미완료 상태가 찍혀있을 수 있음. 테스트 스프레드시트에서 이번 달 MTA만 재수출해 실제
Salesforce 수치와 비교하던 중 IC Booked/Complete/Revenue가 실제보다 낮게 나오는 걸 발견해 확인됨.

**수정**: 대표 터치 선정 기준을 "가장 최근 터치(MTA Created Date 최댓값)"로 변경. ACQ_REP은 "그
달까지 실제로 어디까지 진행됐는지"를 보는 지표이므로 최신 스냅샷이 맞음.

## SAL 재설계 — Lead Record Type(과집계) → Sales Accepted Date(이벤트 기준)

**문제**: 기존 SAL은 MTA_Master 터치 단위로 "Lead Record Type = SAL"인 행을 세었는데, 이 필드도
리드 레벨 스냅샷이라 오래전에 이미 SAL이 된 리드의 무관한 후속 터치까지 SAL로 잘못 집계됨(실측
MTA 리포트 SAL 총계 235 확인, 실제로는 훨씬 적어야 함).

**해결**: Salesforce MTA export에 `Lead: Sales Accepted Date`(진짜 SAL 전환 이벤트 날짜) 필드
추가 확인 → `13_MTATransformer.js`에 매핑, `computeMTAFunnelByLeadId_()`/`syncMTAFunnelToOPS_()`
(`09_MTAFunnelSync.js`)에 반영해 Leads_OPS로 동기화, `20_OPS_Config.js`에 컬럼 추가(SYNC_COLUMNS +
HEADER). SAL 계산을 `computeMTAAggregates_()`(MTA_Master 터치 단위)에서 `computeOPSAggregates_()`
(Leads_OPS 리드 단위, Sales Accepted Date 이벤트 기준)로 이동(`30_ACQReport.js`).

**주의(재발 방지 기록)**: `OPS.HEADER`에 컬럼을 코드로 추가한 것만으로는 시트에 컬럼이 안 생김 —
시트 레이아웃을 실제로 다시 쓰는 `buildLeadsOPS()`를 재실행해야 함. 이번에 이 단계를 건너뛰어서
`runSyncMTAFunnelToOPS()`를 여러 번 돌려도 "Sales Accepted Date" 컬럼이 안 생기고 값도 조용히
스킵되는(에러 없음) 문제를 겪음 — `buildLeadsOPS()` 재실행 후 해결.

## MTA 전체 재수출/재구축 (프로덕션)

`Lead: Sales Accepted Date` 필드 포함해서 MTA 전체(82,714건) 재수출 → `resetMTACounterOnly()` →
Import(4개 파일 분할, 각 2만 행 내외) → `rebuildMTAMaster()`/`appendNewMTA()`로 프로덕션 반영
완료. 이 과정에서 대용량 재구축 시 실제로 벌어진 이슈들:
- `buildLeadsOPS()` writeOPS() 단계에서 Sheets 서비스 타임아웃 2회 발생(3번째 시도에서 성공) —
  실패한 시도가 Leads_OPS를 일부만 쓴 상태로 남겨, 700개 리드가 "신규"로 오인되어 수동 입력값
  (FT Override/Notes/IC 날짜 등)이 초기화될 뻔한 리스크 확인(실제 영향 범위는 별도 확인 필요할 수
  있음)
- Apps Script 다이얼로그를 닫아도 서버 실행은 계속 진행됨(`docs/apps-script-gotchas.md` #5 실전
  확인) — 성급한 재시도로 인한 중복 실행 위험 재확인
- 상세 실행 시간 기록은 `docs/PerformanceBenchmark.md` 참고

## Import 다이얼로그 개선 + 성능 버그 2건 수정

- Import Leads/MTA 업로드 화면에 "Raw 기준 가장 최근 날짜" 표시 추가(`00_Import.js`,
  `00_UploadDialog.html`) — 매주 export 범위를 정할 때 날짜 겹침으로 인한 중복 append 방지 목적.
  단, "그 날짜까지 데이터가 빠짐없이 다 있다"는 보장은 아니라는 caveat 문구도 함께 표시(오래된
  리드가 최근 재터치되면 날짜만 갑자기 앞당겨질 수 있음)
- **성능 버그 발견/수정**: `parseDate()`(`16_TransformHelper.js`)에 조건 없는 디버그
  `Logger.log()`가 남아있어 대량 레코드 처리(Import/Rebuild 전체) 시 실행 시간을 크게 늘리고
  있었음 — 제거. `getLatestRawDate_()`도 시트 전체를 객체로 변환하던 걸 날짜 컬럼 하나만
  `getRange()`로 읽도록 최적화(Import 다이얼로그 오픈 지연 해결)

## 신규 TODO 기록 (`CLAUDE.md` 미해결 항목)
- 7. Deal Tracker(`[KOR] Deal Tracking`) 통합 — 설계 메모는 아래 섹션 참고
- 8. 완전 동일 중복 터치 자동 삭제 — 검출 로직은 기존 구현됨, 자동 삭제는 설계 대기
- 9. Backend 실행 체인 비동기화(GAS Time-driven Trigger 체이닝) — 설계 세션 필요

## Deal Tracker 통합 계획 메모 (구현 전, 설계용 기록)

**배경**: 2026-07-20 논의 당시엔 "레거시 방식 유지, 구현 보류"로 종결됐던 Deal Tracker가 실제로는
사용자가 `"[KOR] Deal Tracking"`이라는 이름으로 FY23부터 계속 관리해온 시트였음이 확인됨. SAL/
Sales Accepted Date 개선 작업 중 Revenue/Segment 정확도 개선 아이디어로 다시 논의됨 — 이번엔
Sales Accepted Date/SAL 작업을 먼저 마무리하고 별도 작업으로 진행하기로 함(사용자 확인).

**시트**: `"[KOR] Deal Tracking"` — 컬럼: FY / Closed Month / Opp Name / Revenue (NZD) / Lead Source /
Source Category / Content Category / HQ Digital Deal / Closed Date / Created Date / Created Month /
Created Year / Lead Age (Day, Month) / SF Lead Age (Day, Month) / Marketo/SF Match / Lead Priority /
P1 Strike / School / Source email / Lead Source Detail / Note (+ upsell 데이터 존재 — 순 매출액
계산 가능).

**범위**: KOR 딜만 커버(다른 국가는 별도 트래커 없음) — 따라서 `Opportunity Won Date` 기반 전체
Revenue 계산을 통째로 대체할 수 없고, "매칭되면 우선 사용하는 보정 레이어"로만 활용 가능.

**핵심 발견**:
- `Closed Date` = 진짜 Close Date(Lead 리포트에서는 볼 수 없는 필드) — CLAUDE.md 미해결 항목 5번
  (`Opportunity Won Date`가 진짜 Close Date가 아님)의 대체 후보로 유력.
- `Source email`을 매칭키로 사용 가능(우리 파이프라인의 `Email`과 매칭). 이 시트의 `Created Date`를
  First Touch 기준으로 사용 중이라고 함.
- `Revenue (NZD)`는 값 자체가 고정이라 환율 변동에 취약 — 사용자 계획: 앞으로 입력값 자체를
  원화(KRW)로 받고, NZD 환산 컬럼을 별도로 추가하는 방향으로 시트 운영 변경 예정(아직 미시행).
- Upsell 데이터도 있어 순 매출액(신규 매출 - upsell 등) 계산 가능.

**구현 방향(합의된 것만, 세부 설계는 미정)**: Deal Tracker 자체는 계속 독립적으로 수동 관리 —
Leads_OPS에 흡수 합치는 대신, 별도 sync로 이 시트를 읽어 Email 기준 매칭 후 Leads_OPS에 신규
컬럼(예: Close Date/Revenue "Deal Tracker" 버전)을 추가하고, 매칭되면 이 값을 우선 사용하는
구조가 유력. **아직 코드 작업 없음 — 다음 세션에서 설계부터 시작.**


# Changelog — 2026-07-24 (Events_OPS/Events_Engine 구현)

## NewP1 Report — 삭제 사고 → 재구성 → origin 실제 기록 발견으로 대체 (경위 기록)

**사고**: `40_NewP1Report.js`/Styles 파일/`00_Config.js`의 `CONFIG.NEWP1`/`30_ACQReport.js`의
`onEdit()` NewP1 분기가 이 로컬 checkout에선 한 번도 커밋된 적 없는 상태였는데, Events 작업 중
40번대 파일 번호가 겹친 걸 발견해 정리하다가(사용자가 6개 구 Events 파일을 지울 때 NewP1 파일도
같이 삭제) 사라짐. 추가로 이 세션에서 여러 번 실행한 `clasp push --force`가 `CONFIG.NEWP1`이
없는 로컬 `00_Config.js`로 원격을 덮어써, 설정 블록도 같이 사라짐(이 부분은 작업 방식의 문제).

**1차 대응(재구성, 이후 폐기됨)**: Apps Script 버전 기록엔 삭제 이전 시점이 없어, 사용자가 대화
중 공유해준 파일 원문 + 실제 `NewP1_REP` 시트 레이아웃을 근거로 `40_NewP1Report.js`/
`41_NewP1ReportStyles.js`(추정 파일명)/`CONFIG.NEWP1`/`isEffectiveP1_()`를 재구성해 동작 확인까지
했었음.

**실제로는 이미 origin/main에 진짜 원본이 있었음**: `origin push`를 시도하다 로컬이 origin/main과
7개 커밋 divergence 상태였다는 걸 발견 — "집에서 작업하던 걸 커밋 안 해서"로 추정했던 바로 그
작업이 실제로는 이미 정상적으로 커밋/푸시되어 있었음(`9b1a86a` NewP1_REP 구현, `43890e9` Week축
제거, `cb8fb85` MTA BOFU 버그 수정, `180b9ea`/`95396a8` ACQ_REP 이벤트 기준 개선,
`4d4afce` New P1 로직 통일 등). 이 진짜 원본은 재구성판보다 훨씬 완전했음:
- `isEffectiveP1_()`는 사실 `30_ACQReport.js`에 있었음(재구성판은 `40_NewP1Report.js`에 넣어서,
  origin 버전을 그대로 받으면 중복 선언 충돌이 날 뻔함).
- `13_MTATransformer.js`의 BOFU 분류 버그 수정은 origin 쪽이 회귀 테스트(`testTransformMTARecord_BOFU`)
  까지 포함한 상위호환 버전이었음(수정 내용 자체는 동일 — `diff`로 확인).
- `30_ACQReport.js`엔 ACQ_REP 자체의 개선사항(IC Booked/Complete/Revenue를 코호트가 아니라 실제
  이벤트 날짜 기준으로 전환, `docs/ACQReportDesign.md` 참고)까지 포함돼 있었음 — 재구성판엔 없던 부분.

**최종 결정(사용자 확인)**: `00_Config.js`/`13_MTATransformer.js`/`30_ACQReport.js`/
`40_NewP1Report.js`/`41_NewP1ReportStyles.js`는 origin(진짜 원본) 버전을 그대로 채택, 재구성판은
전부 폐기. `24_OPSQA.js`(IC Booked/Complete 불일치 진단 함수 3종 추가)와
`07_IncrementalMasterBuild.js`/`09_MTAFunnelSync.js`/`10_MasterBuild.js`(`refreshNewP1Engine_()`
호출 배선)는 이번 세션의 Events 관련 변경과 겹치지 않는 별도 영역이라 병합 시 양쪽 다 자동으로
합쳐짐(충돌 없음).

## Events_OPS / Events_Engine 최초 구현
- 설계: `docs/EventsReportDesign.md` (같은 날 세션에서 확정). Webinar/Seminar 프로그램별 ROI
  리포트 — 별도 xlsx(FTA/OPs/Ads perf)로 관리하던 실무를 이 워크북으로 이관하는 첫 구현.
- 신규 파일 6개 (50번대 블록, Leads_OPS/ACQ_Summary 패턴을 그대로 본뜸):
  `50_Events_Config.js`(EVENTS config) / `51_Events_Engine.js`(UTM Key별 SF 집계,
  `refreshEventsEngine_()`) / `52_Events_Build.js`(오케스트레이션, `buildEventsOPS()`) /
  `53_Events_Merge.js`(Manual 컬럼 보존 병합, `mergeEventsOPS_()`) /
  `54_Events_Write.js`(시트 쓰기 + SUBTOTAL 행 수식) / `55_Events_Styles.js`(서식).
- 4-시트(OPS/Engine/QA/REP) 설계에서 프로그램 수(~130~150개) 규모가 작다고 판단해
  **Engine+OPS 2-시트로 축소** — Events_QA/Events_REP는 만들지 않음. 파생지표(Match
  Rate/CPL/CPNP1/ROAS)는 REP 없이 OPS 빌드 시점에 값으로 계산 (ACQ_REP와 동일 패턴,
  라이브 수식/시트보호는 도입하지 않음 — 매 빌드가 전체 재작성이라 보호 없이도 안전).
- Sales funnel 지표(IC Request/Booked/Complete/Deals/Revenue)는 Leads_OPS에서 그대로 읽되
  Leads_Master(1 Lead=1 Row, First Touch)의 Lead ID→UTM Key 맵으로 조인 — First Touch
  Attribution 원칙 보장, MTA_Master(터치 레벨)는 All Registered/P1 All 집계에만 사용.
- `refreshEventsEngine_()`를 `refreshACQSummary_()` 호출부 4곳에 나란히 배선: 
  `07_IncrementalMasterBuild.js:101`(appendNewLeads), `09_MTAFunnelSync.js:325`
  (syncMTAFunnelToOPS_), `10_MasterBuild.js:73/153`(rebuildLeadsMaster/rebuildMTAMaster).
- `buildEventsOPS()`는 메뉴/자동 트리거 미연결 — 초기 롤아웃 기간엔 스크립트 편집기 수동
  실행 전용(Rebuild류와 동일 관행). Engine 갱신만 자동.
- **⚠️ 실행 전 확인 필요한 가정 (구현 계획서에 명시, `~/.claude/plans/synthetic-inventing-pnueli.md`)**:
  IC Request = `Total IC Requests > 0`인 Lead 수로 정의, CPL=Spent/Leads(Meta),
  CPNP1=Spent/NL P1, ROAS=Revenue/Spent, Match Rate=All Registered/Reg. — 전부 표준 관례로
  추정한 것이라 실데이터/기대치와 다르면 조정 필요. `MKT UTM Campaign`의 `_US-50`류 국가 suffix
  패턴도 실데이터 샘플 확인 전.
- 검증 순서(사용자 실행 필요): 각 파일의 `testXXXX()` 함수들 → `51_Events_Engine.js`의
  `runRefreshEventsEngine()` → `Events_Engine` 시트 육안 확인 → `52_Events_Build.js`의
  `buildEventsOPS()` → `Events_OPS` 결과 확인.

## Events_OPS / Events_Engine — 실데이터 검증 후 대폭 수정 (같은 날, 초기 구현 이후)

**⚠️ 위 "최초 구현" 항목의 매칭 방식(UTM Key/`_US-50` 국가 suffix)은 실데이터로 실제 `runRefreshEventsEngine()`을
돌려본 뒤 전면 폐기되고 아래 방식으로 교체됨.**

- **매칭 필드 전환**: 실행 결과 `MKT UTM Campaign`(raw UTM) 기준 그룹 수가 2,167개(실제 프로그램
  ~150~385개 대비 압도적으로 많음) — 하나의 프로그램에 채널(Meta/Google 등)별로 UTM이 수십 개
  붙는 구조였음. 대신 MTA_Master의 `Lead Source Detail`/Leads_Master의 `First Touch Detail`
  (raw 필드, **실제 Marketo Program 이름**을 담고 있음을 사용자가 확인)로 매칭 기준 변경 →
  1,376개로 감소.
- **국가 필터**: `_US-50`류 UTM 접미사 파싱은 실데이터와 안 맞아 폐기. 대신 Marketo Program
  이름 자체가 `{TYPE}-{YYYY}-{MM}-{COUNTRY}-{FUNNEL}-{Division} {이벤트명}` 구조임을 확인,
  COUNTRY(4번째 하이픈 토큰)가 `KOR`인 것만 대상(KR 외 국가는 다른 팀 캠페인). `isKoreanProgram_()`.
- **TYPE 필터 추가**: `WF-`로 시작하는 프로그램(대부분 ebook/practice test/consult page 등
  비-이벤트 콘텐츠)이 Business Segment=Webinar/Seminar로 잘못 섞여 들어오는 사례 다수 발견 →
  `WB`(Webinar)/`EV`(Seminar)만 허용(`EVENTS.EVENT_TYPE_PREFIXES`, `isEligibleEventType_()`).
  최종 Engine 결과: **385개** (연 50~60개 이벤트 × 5~7년 실측치와 부합).
- **MTA_Master 컬럼명 정정**: "First Touch Detail" → "Lead Source Detail"로 리네임
  (`13_MTATransformer.js` v5.1.0) — Leads_Master의 동명 컬럼(raw 필드는 다름, First Touch
  스냅샷)과 헷갈렸음. `24_OPSQA.js`의 완전동일 중복 검출 로직도 함께 갱신.
  부수적으로 `getBusinessSegment()` 호출 시 detail 파라미터에 빈 문자열이 하드코딩되어 있던
  기존 버그도 함께 수정 (v5.2.0) — MTA_Master BOFU 분류가 지금까지 한 번도 작동 안 하고 있었음.
  ⚠️ 둘 다 컬럼/분류값 변경이라 `rebuildMTAMaster()` 재실행 필요.
- **등록 폼 접미사 중복 버그 수정**: Marketo Program 이름 뒤에 "(구분자) Registered for
  Webinar/Seminar from X Form" 접미사가 폼 종류별로 다르게 붙어, 같은 이벤트가 여러 행으로
  쪼개지는 버그 발견(사용자가 실 빌드 결과에서 확인). `stripRegistrationFormSuffix_()`를
  표시용이 아니라 **매칭 키 추출 단계**(`aggregateMTATouchRecords_`/`aggregateLeadsRecords_`,
  51_Events_Engine.js)에 직접 적용해 근본 해결.
- **Event Date/EventType 자동 채움**: Marketo Program 이름에서 `{TYPE}-{YYYY}-{MM}` 파싱
  (`parseProgramTypeAndDate_()`) — EventType은 WB→Webinar/EV→Seminar 매핑, Event Date는
  1차로 월 1일 기본값. 이후 더 정확한 값을 위해 Events_Engine에 `UTM`/`Event Date` 컬럼 추가,
  같은 프로그램의 터치들이 가리키는 raw `MKT UTM Campaign`의 일 단위 날짜 중 **최빈값**을
  채택(`pickModeEventDate_()`) — Engine의 정확한 날짜가 있으면 그걸 우선, 없으면 월 1일로
  fallback. 값이 이미 있는 행(Ops 수동 입력)은 덮어쓰지 않음. FY/Month는 Event Date로부터
  자동 파생(기존 로직 재사용), 정렬도 Event Date 기준(기존 로직)이 그대로 FY/Month 순 역할.
- **스키마/스타일 사용자 지정**: 컬럼명 대량 리네임(예: `All Registered`→`SF Reg.`, `Reg.`→
  `Mkt Reg.`) 및 순서 재배치, A~D열(`Lead Source Detail`/`Match Rate`/`Target Market`/`Division`)
  숨김 처리, 헤더를 소스 그룹별 배경색으로 구분(Marketo=보라 `#6b21a8`, SF=하늘색 `#0369a1`,
  Meta=Meta 브랜드 블루 `#1877F2`, Derived=회색 `#434343`), 전체 셀 테두리 추가.
- **메뉴 정리**: `00_Menu.js` v3.1.0 — "✅ QA" 메뉴 제거(Leads_OPS QA는 이미 `buildLeadsOPS()`
  실행 시 자동 수행이라 메뉴 실익 낮음, `runOPSQAManual()` 자체는 그대로 존재해 편집기에서
  직접 실행 가능), "🗂️ OPS" 메뉴 신설(`createOPSMenu()`) — "Update Events"(`buildEventsOPS()`)
  추가. Search/BOFU/Ebook 등 향후 세그먼트 트래커도 구현되는 대로 이 메뉴에 추가 예정.

## `Leads_OPS_QA` 시트 구현 완료 사실 뒤늦게 반영
- `24_OPSQA.js`(`writeOPSQAResults_()`)에 Dashboard(Master vs Leads_OPS 지표 대조) + Issues 테이블을
  `Leads_OPS_QA` 시트에 쓰는 로직이 이미 완전히 구현되어 있고, `buildLeadsOPS()` 실행 시 자동 호출
  (`21_OPS_Build.js`)까지 연결되어 있음을 확인. 메뉴에도 "Run Leads_OPS QA" 수동 실행 항목 존재.
- 실제로는 2026-07-22 커밋(`c0dec13`, `24_OPSQA.js` 최초 추가) 시점에 이미 구현 완료된 상태였으나,
  env(로컬 개발 환경) 전환 과정에서 CLAUDE.md "현재 알려진 미해결 항목" 1번과 Changelog에 반영이
  누락된 것으로 추정. CLAUDE.md 1번 항목을 완료 처리로 정정.

## CLAUDE.md 2번 항목 정정 — IC Request(SAL) `#touches` 지표는 4번(재신청 카운터)과 동일 항목
- 별개의 미해결 항목으로 잘못 분리 기재돼 있었음. 4번 항목(`applyICRequestTracking_()`,
  `Total IC Requests`/`Last IC Requested Date`)이 곧 이 지표의 구현이었음을 확인, 완료 처리로 정정.

## `OperationsLayer.md` 143~148행 정정 — `applyOPSStyle()` 하드코딩 "미해결" 표기 오류
- 실제 코드(`20_OPS_Styles.js`)는 이미 `OPS.ROWS.HEADER`/`OPS.ROWS.DATA_START`로 전부 교체되어 있었음
  (Changelog 2026-07-21 "applyOPSStyle() 하드코딩 정리 완료" 기록과 일치). `OperationsLayer.md`에만
  구버전 상태로 남아있던 것을 정정.

## CLAUDE.md 3번 항목 해결 — MTA_Master "완전 동일 duplicate row" 검출 로직 구현 (`24_OPSQA.js` v1.1.0)
- **배경**: 2026-07-22 `findDuplicateTouchRows_()`로 Lead ID+MTA Created Date 조합 기준 3,401개 그룹
  발견했으나, 같은 날 서로 다른 캠페인으로 정상 다중 터치한 경우와 진짜 중복(Salesforce export 재전달
  사고)을 구분할 기준이 없어 판단 기준 정의부터 필요한 상태로 보류돼 있었음.
- **판단 기준 확정(사용자 결정)**: "완전 동일" = 터치 식별 필드(Lead ID / MTA Created Date /
  MKT UTM Campaign / First Lead Source / First Touch Detail — 이후 2026-07-24 같은 날 컬럼명이
  "Lead Source Detail"로 정정됨, 아래 Events_OPS 항목 참고) 5개가 전부 일치하는 경우. IC Booked/
  Completed/Won Date, Revenue, Lead Priority, Sales Funnel Stage, Lead Record Type 등 Lead 레벨
  스냅샷 필드(export 시점마다 값이 바뀔 수 있음)는 비교 대상에서 제외 — 서로 다른 시점에 재추출된
  진짜 중복까지 놓치지 않기 위함. Created FY/Quarter/Week/Month 등 파생 필드는 MTA Created Date에서
  자동 계산되므로 비교 의미 없어 제외.
- **구현**: `findExactDuplicateTouchRows_()`(순수 검출 함수) + `checkExactDuplicateTouchRows_()`(OPS QA
  체크로 등록, `runOPSQA_()`에 연결) 추가. 문제 있는 조합은 "Exact Duplicate Touch Row" 이슈로
  `Leads_OPS_QA` 시트에 기록됨. `buildLeadsOPS()` 실행 시 자동 실행.
- **자동 삭제는 하지 않음** — Master는 재생성 가능하지만 원인 파악 전 임의 삭제는 데이터 손실 위험이
  있어, 이번 구현은 검출/보고까지만 수행. 실제 제거 여부는 QA 이슈 확인 후 별도 논의.
- TDD 원칙에 따라 `testFindExactDuplicateTouchRows()` 단위 테스트 함께 추가 (기존 `findDuplicateTouchRows_()`
  로직과 별개로 유지 — 후자는 여전히 1차 스크리닝용 진단 유틸리티로 남겨둠).

## BOFU_OPS/BOFU_Engine, Search_OPS/Search_Engine, Content_OPS/Content_Engine 트래커 구현 (Events 패턴 복제)
- **배경**: Events_OPS 구현·실데이터 검증이 끝난 뒤, 동일한 "세그먼트별 ROI 트래커" 패턴을
  BOFU(Meta 광고 성과) 세그먼트에도 적용(claude.ai 작성 설계 문서 기반, 설계 문서가 명시적으로
  Claude Code+사용자 판단으로 미룬 항목들 — 매칭 필드 확인/최종 컬럼 순서·색상/보호 전략/CPNP1
  포함 여부/SUBTOTAL 대상 — 을 이 세션에서 확정), 이어서 "동일한 구조로 Search랑 ebook도 만들자"는
  직접 요청에 따라 Search(기존 Business Segment 값)와 "Ebook" 트래커를 연속 구현. Ebook은 사용자
  확인 결과 별도 세분화 없이 기존 `"Content"` Business Segment 전체를 대상으로 하는 것으로 확정
  (시트명 `Content_OPS`/`Content_Engine`).
- **신규 파일 18개** (60/70/80번대, 각 6파일 — Config/Engine/Build/Merge/Write/Styles):
  `60~65_BOFU_*.js`, `70~75_Search_*.js`, `80~85_Content_*.js`. 세 트랙커 모두 스키마·컬럼 순서·
  숨김 컬럼(A:C)·헤더 색상 그룹(Marketo 보라/SF 하늘색/Meta 브랜드블루/Derived 회색) 완전히 동일 —
  `SEGMENTS`/시트 이름/함수명 프리픽스만 다름.
- **범용 헬퍼 재사용 원칙 준수**: `stripRegistrationFormSuffix_`/`isKoreanProgram_`/`isValidDate_`/
  `divideGuard_`/`copyColumns_`/`columnIndexToLetter_`/`computeRowBandingColors_` 등은 Events 최초
  구현 파일(50번대)/`20_OPS_Styles.js`에 있는 정의를 그대로 재사용, 트래커마다 재정의하지 않음 —
  전역 네임스페이스 중복 선언으로 인한 전체 프로젝트 크래시 방지 (매 파일 배치 작성 후
  `grep -hoE "^(function|const) [A-Za-z0-9_]+" *.js | sort | uniq -c | awk '$1>1'`로 검증).
- **Events의 P1 판정 버그를 반복하지 않음**: Events(`51_Events_Engine.js`)는 느슨한 substring
  매칭(`Lead Priority.indexOf("1") !== -1`, "Priority 10"도 오탐)을 그대로 쓰고 있음(NewP1_REP/
  ACQ_REP에서 이미 발견·수정된 버그, Events 자체는 이번 스코프 밖이라 손대지 않음). BOFU/Search/
  Content는 `isEffectiveBOFUP1_`/`isEffectiveSearchP1_`/`isEffectiveContentP1_`로 정확히
  `=== "Priority 1"`만 인정 — `Priority Override`는 `Leads_OPS`에만 존재하고 `MTA_Master`/
  `Leads_Master`엔 없어 exact match만 적용.
- **Engine 자동 갱신 배선**: `refreshBOFUEngine_()`/`refreshSearchEngine_()`/`refreshContentEngine_()`를
  `07_IncrementalMasterBuild.js`(`appendNewLeads()`), `09_MTAFunnelSync.js`(`syncMTAFunnelToOPS_()`),
  `10_MasterBuild.js`(`rebuildLeadsMaster()`/`rebuildMTAMaster()`) 총 4개 호출부에 기존
  `refreshACQSummary_(); refreshNewP1Engine_(); refreshEventsEngine_();` 체인 뒤에 추가.
- **메뉴**: `00_Menu.js` v3.3.0 — "🗂️ OPS" 메뉴에 "Update Search"(`buildSearchOPS()`)/"Update
  Content"(`buildContentOPS()`) 추가 (BOFU는 이전 커밋에서 이미 추가됨).
- **검증**: 전체 `.js` 파일 `node --check` 통과, 중복 top-level 선언 없음 확인 후 `clasp push --force`로
  55개 파일 전체 배포 완료. 사용자가 스크립트 편집기에서 각 트래커의 `testXXXX()` →
  `runRefreshSearchEngine()`/`runRefreshContentEngine()` → `runInvestigateSearchProgramCount()`/
  `runInvestigateContentProgramCount()`(프로그램 개수로 TYPE 필터 필요 여부 판단, BOFU 검증 방식과
  동일) → `buildSearchOPS()`/`buildContentOPS()` 순으로 실행해 실데이터 검증할 차례.

## MTA_Master 필드명 회귀 발견 + 수정 (`13_MTATransformer.js` v5.2.0)
- **발견 경위**: 위 Search 실데이터 검증 중 `Search_Engine`이 25개 프로그램(대부분 eBook 이름)만
  잡히는 문제를 조사하다가, `MTA_Master`의 실제 라이브 헤더(사용자가 직접 시트에서 확인해 공유)가
  `"Lead Source Detail"`인데, 현재 `13_MTATransformer.js`(git divergence 병합 시 origin 버전을
  `checkout --theirs`로 통째로 채택한 파일)는 `"First Touch Detail"`을 출력하고 있음을 발견.
- **원인**: 이전 세션에서 이미 `"First Touch Detail"` → `"Lead Source Detail"`로 rename했었고
  Events/BOFU/Search/Content(50/60/70/80번대) 전부 이 이름을 기대하도록 구현됐는데, 나중에 origin
  divergence 해소 과정에서 origin의 `13_MTATransformer.js`(rename 이전 버전, BOFU detail 인자 버그만
  고친 버전)를 그대로 채택하면서 이 rename이 조용히 되돌아가 있었음 — 코드와 라이브 시트 헤더가
  어긋난 상태. `rebuildMTAMaster()`를 그 이후로 재실행한 적이 없어 시트 헤더가 구버전 그대로라
  지금까지는 문제가 드러나지 않았을 뿐, 다음 Full Rebuild 시 전체 트래커(Events/BOFU/Search/Content)의
  MTA측 지표(SF Reg./SF P1s)가 조용히 0으로 깨질 뻔한 잠재 버그였음.
- **수정**: 출력 필드명을 `"Lead Source Detail"`로 복원, 회귀 테스트
  `testTransformMTARecord_OutputFieldName()` 추가.

## Search 매칭 키 실데이터 재검증 → 최종 확정 (`70_Search_Config.js` v1.2.0, `71_Search_Engine.js` v1.2.0)
- **문제**: MTA 필드명 수정 후에도 Search_Engine이 여전히 소수(25개) 프로그램만 찾음. 원인은
  `isKoreanProgram_()`가 Marketo Program 이름 구조(`TYPE-YYYY-MM-COUNTRY-...`, 4번째 토큰이 국가)를
  가정하는데, 실제 Search 리드는 대부분 Marketo Program(웹폼) 없이 직접 캡처되는 광고/상담 신청이라
  이 구조를 따르지 않음(국가 토큰 위치가 다르거나 아예 없음, 예: `"MedView - Contact Form"`).
- **1차 수정**: `MATCH_FIELD`를 Marketo Program 이름 필드(`Lead Source Detail`/`First Touch Detail`)에서
  raw `MKT UTM Campaign`/`First MKT UTM Campaign`로 변경 → 260개 캠페인으로 개선(`KR_core_...`,
  `US_core_...`, `ASIA_cgahq_...` 등 실제 광고 캠페인 슬러그 확인).
- **국가 필터 최종 결정(사용자 확인)**: 실측 결과 국가 토큰이 `KOR`이 아니라 `KR_`/`US_`/`ASIA_` 등
  언더스코어 앞 접두어 구조였고, 대소문자·중괄호(`{...}`) 차이로 같은 캠페인이 쪼개지는 데이터 품질
  이슈도 발견됨. Revenue 있는 Search 리드가 총 25개뿐이라 자동 국가 필터/정규화보다 사용자가 A열
  (hidden, MKT UTM Campaign 원본)을 보고 직접 Marketo Program 매핑 + 한국 딜 여부 + 중복 캠페인
  정리를 수동으로 하는 것으로 최종 확정 — `isKoreanProgram_()` 호출 제거, 자동 정규화 없음.
  `runInvestigateSearchProgramCount()`에 `"KOR"` 포함 여부 분포 출력을 참고용으로 추가.

## 메뉴 라벨 변경 — "Update X" → "🔄 Sync X" (`00_Menu.js` v3.4.0)
- "🗂️ OPS" 메뉴의 Events/BOFU/Search/Content 4개 항목 라벨을 통일된 "🔄 Sync X" 형태로 변경
  (호출 함수는 그대로).

## Deal Tracker 설계 논의 → 구현 보류, 레거시 방식 유지 (사용자 결정)
- Leads_OPS와 별개로 Salesforce Lead Source 오류 정정용 워킹시트("Deal Tracker") 설계를 논의,
  컬럼 정의까지 확정했으나 구현 직전 사용자가 "예전 방식으로 관리하겠다"며 보류 결정.
- 논의 중 확인된 사실(향후 재논의 시 참고): `Leads_Raw`에 `Opportunity Name`/`Opportunity ID` 필드가
  전혀 없음, `Opportunity Won Date`는 실제로는 "Opportunity로 전환된 날짜"이지 진짜 Close Date가
  아님이 확인됨(진짜 Close Date 필드 자체가 export에 없음) — 두 사실 모두 이 워크북/리포트 구조상의
  실제 제약이라 향후 유사 기능 설계 시에도 동일하게 적용됨.
- 코드 변경 없음 (생성했던 `90_Deal_Config.js` 초안은 사용자 지시로 삭제, 커밋된 적 없음).

# Changelog — 2026-07-21

이날 하루 동안 진행된 리팩토링 요약. 시간순 기록.

## 1. 구버전 중복 파일 정리
- `16_TransformHelper.js`에 `transformLeadRecords`/`transformLeadRecord`가 `12_LeadTransformer.js`와
  중복 정의되어 있던 문제 발견 → 헬퍼 함수(`parseDMY` 등)만 남기고 중복 함수 삭제.

## 2. Import(Stage 00) — Architecture 정합성 수정
- 기존 `importCsv()`가 Raw를 거치지 않고 곧장 Master로 쓰던 구조(Architecture 문서 위반) 발견 → 수정.
- Import는 이제 Raw까지만 담당 (`transformRecords()`/`loadRecords()` 호출 제거).
- Master Build는 별도 메뉴(🏗️)로 분리.
- `REQUIRED_FIELDS`를 `CONFIG.REQUIRED_FIELDS`로 중앙화 (Leads: Lead ID/Email/Create Date/Company Account,
  MTA: Lead ID/Email/MTA Created Date).
- 무효 레코드(`_isValid === false`)는 Raw에 안 쓰고 로그만 남김 (Silent Failure 방지).
- 업로드 다이얼로그(`00_UploadDialog.html`) 연결 함수(`showUploadDialog_`, `importLeadReport`, `importMTAReport`) 추가.
- "Import All" 메뉴 제거 (레거시).

## 3. 날짜 파싱 버그 방지 구현
- `CONFIG.RAW_DATE_COLUMNS` 추가, Raw 쓰기 시 Plain Text 서식(`@`) 강제.
- `parseDMY()` 단위 테스트 + 실데이터 검증 완료 (자세한 내용: `import-date-parsing-bug.md`).

## 4. Raw/Master 방식 전환 — Overwrite → Append
- **배경**: Salesforce weekly export를 매번 전체 재계산하기엔 데이터 볼륨이 너무 큼 (성능 문제).
- **Raw**: Full Overwrite → Append로 전환 (`appendSheetRecords()` 신규 추가, `05_SheetWriter.js`).
  - 정렬은 하지 않음 (텍스트 날짜라 정렬 비용이 큼 — Master 단계에서만 정렬).
  - Leads는 원천에서 이미 신규 lead만 export되어 dedup 불필요. MTA는 중복이 의도된 것이라 dedup 안 함.
- **Master**: Incremental Append 방식 도입 (`07_IncrementalMasterBuild.js`).
  - `PropertiesService`에 `LEADS_LAST_PROCESSED_ROW`/`MTA_LAST_PROCESSED_ROW` 저장, 이후 Raw 행부터만 Transform.
  - Append 후 `06_SheetSorter.js`의 `sortSheetByDate()`로 Create Date 기준 내림차순 정렬 (최신이 맨 위).
- **Full Rebuild**: 기존 `buildLeadsMaster`/`buildMTAMaster` → `rebuildLeadsMaster`/`rebuildMTAMaster`로 개명,
  복구/Business Rule 변경 시 스크립트 편집기에서 수동 실행 전용 (메뉴 노출 안 함). `buildAllMaster()` 제거.
- **초기 전환 절차**: 기존 Raw/Master 수동 삭제 → `resetIncrementalCounters()` 실행(카운터 0 리셋) →
  CSV 재Import → Append 실행. (`99_ResetRawMaster.js`)

## 5. 메뉴 개편
- "📥 Import" → **"📥 Update"**
- "🏗️ Build" → **"🏗️ Append"**
- "📊 Report" 메뉴는 항목이 하나도 없어 `onOpen()`에서 예외 발생 → 호출 비활성화 (함수 정의는 보존).
- Rebuild 메뉴 항목 제거 (스크립트 편집기 직접 실행으로 전환).

## 6. Import 완료 alert 개선
- 진행률(%)은 구현하지 않기로 함 (실시간 상태 전달은 폴링 구조가 필요해 복잡도 대비 실익 낮다고 판단).
- 대신 완료 후 요약 표시: 전체/성공/실패 건수 + 필수 필드별 valid/missing 카운트 + Date 컬럼 텍스트 보존 여부.
- `CONFIG.VALIDATION_SUMMARY_EXCLUDE`로 "Company / Account" 필드와 IC/Won Date 컬럼은 alert 표시에서만 제외
  (검증/서식 강제 로직 자체는 그대로 유지).
- 완료 문구: `"{valid} / {total} 레코드 업데이트 완료" + ... + "Master 🏗️Append를 실행해주세요."`

## 7. OPS 정리 (일부)
- `OPS.ROWS = { HEADER: 1, DATA_START: 2 }` 추가, `writeOPS()`가 이를 참조하도록 수정.
- `mergeOPS()` 중복 이메일 처리, `applyOPSStyle()` 하드코딩, `Leads_OPS_QA` 구현은 **모두 미해결로 보류**
  (자세한 내용: `operations-layer-leads-ops.md`).

## 8. 로컬 개발 환경 세팅
- Node.js v24.13.0 확인, `clasp` 3.3.0 설치.
- 기존 로컬 프로젝트 폴더(`crimson-lead-tracker`) 비우고 Marketing 2.0 스크립트로 재clone.
- git 초기화 + GitHub 원격 저장소(`Harry-sk-mkt/crimson-lead-tracker`) 연결, 최초 push 완료.
- `onOpen` 관련 syntax/runtime error 두 건 수정 (Report 메뉴 빈 항목 예외, Import.js 괄호 누락).

## 다음에 다룰 항목 (사용자 확인 후 진행)
- `mergeOPS()` 중복 이메일 처리 로직 재검토
- `applyOPSStyle()` 하드코딩 정리 여부
- `Leads_OPS_QA` 구현 시점 (프로토타입 검증 후)
- Engineering Constitution Article 8 다이어그램 텍스트 수정 (Loader → RawWriter/SheetWriter)
- UX/언어 최적화 (구체 범위 미정 — alert 문구, 다이얼로그 UI 등 중 확인 필요)

## 2026-07-21 (추가) — TDD 원칙 도입 시점 명시

- `CLAUDE.md`에 TDD 원칙 추가 (새/수정 함수는 WHY 주석 + `testXXXX()` 테스트 함수 동반).
- **적용 범위: 이 시점(2026-07-21) 이후 신규 작성/수정되는 함수부터.**
  이전에 작성된 기존 함수(`appendSheetRecords`, `buildValidationSummary_`, `sortSheetByDate` 등)에
  소급 적용하지 않음 — 필요 시 향후 해당 함수를 수정하는 시점에 테스트를 추가한다.

  ## 2026-07-21 (계속) — OPS 중복 이메일 로직 확정 및 정리

### mergeOPS() — 중복 이메일 처리 로직 확정
- **결정**: 이메일별로 그룹핑 후 실제 `Create Date`를 비교하여 **가장 오래된(진짜 First Touch) 레코드만 유지**,
  나머지는 duplicate로 분류. 기존엔 시트 순서(Master가 Create Date 내림차순 정렬되어 있어 사실상 "가장 최근"
  레코드가 남는 구조)에 의존했던 버그를 바로잡음.
- **Tie-break 규칙**: 같은 이메일에 완전히 동일한 Create Date가 여러 건 있는 경우, 배열 순서상 먼저 나온 것을
  유지 (별도 tie-break 로직 추가하지 않기로 결정 — 실무적으로 문제없다고 판단).
- **로그**: 제외된 duplicate 건은 `Logger.log`에 `Email / 제외된 Lead ID / Create Date / 남긴 Lead ID`로 기록
  (QA 시트 대체용, `Leads_OPS_QA` 구현 전까지 유지).
- **검증**: 단위 테스트(`testMergeOPS_EarliestWins`) PASS + 실제 데이터 35,529건 중 47건 duplicate 확인,
  샘플 검증 결과 모두 가장 이른 날짜가 정확히 유지됨.
- **보류 항목**: IC Request(SAL)의 `#touches`(터치 횟수) 지표는 별도 논의 필요 — 이번 dedup 로직과 무관하게
  추후 별도 구현 시 재논의.

### applyOPSStyle() 하드코딩 정리 완료
- 헤더/데이터 행 번호(`1`, `2`) → `OPS.ROWS.HEADER`/`OPS.ROWS.DATA_START` 참조로 교체 완료.

### 디버그 로그 제거
- `buildLeadsOPS()`에 남아있던 `Logger.log(result)`, `Logger.log(result.rows)` 등 35,000+건 전체를
  로그에 찍으려던 디버그 코드 제거. "Logging output too large" 및 불필요한 실행 시간 증가의 원인이었음.

### clasp run-function — 보류
- 터미널에서 Apps Script 함수를 직접 실행하는 방법(`clasp run-function`) 확인함. 별도 OAuth Client,
  API Executable 배포, Cloud Project ID 연결 등 설정 부담이 커서 **당분간 도입 보류**.
  Apps Script 편집기에서 함수 선택 후 직접 실행하는 기존 방식 유지.

  ## 2026-07-21 (계속) — IC Funnel Sync 최초 실행 검증 완료

- `syncICFunnelToOPS()` 최초 실행: 3,139건 중 3,127건 정상 반영, 12건 "Not found in Leads_OPS".
- 12건 원인 확인 완료 — 버그 아님:
  - 10건: mergeOPS()의 중복 이메일 제외 로직으로 Leads_OPS에 의도적으로 없는 Lead ID
  - 2건: Salesforce에 2026-07-20 새벽 생성된 최신 Lead — 아직 weekly export에 미포함,
    다음 Leads Import 시 자동 반영 예정
- `08_ICFunnelSync.gs`(구 24_) — getHeaderMap() 0-based index를 falsy 체크(`!leadIdCol`)로
  잘못 판단하던 버그 수정 (Lead ID가 0번째 컬럼일 때 실패하던 문제).

  ## 2026-07-21 (계속) — ACQ Report (Engine + Summary) 구현 완료

### 설계 확정 사항
- 시트: 기존 `ACQ_REP` 시트 재사용 (Report Area A4:N + Control Area A1:E1)
- Start/End FY·Month를 별도 드롭다운 4개로 분리 (기존 "FY26 JUL" 통합 드롭다운의 스크롤 문제 해결),
  FY 목록은 실제 데이터 기준 동적 계산
- Generate Report는 E2 체크박스 + `onEdit` Simple Trigger 방식
- Engine(월×세그먼트 조합)은 매번 선택된 Start~End FY 구간만 재생성 (전체 기간 아님, 성능 목적)
- % 계산식: All P1% = All P1/All Leads, New Leads% = New Leads/All Leads, New P1% = New P1/New Leads

### 성능 재설계 — ACQ Summary (Aggregate Table) 도입
- 최초 구현(원본 Master/OPS 매번 전체 스캔)이 선택 기간을 좁혀도 여전히 느려서, 별도 `ACQ_Summary` 숨김 시트에
  전체 (FY|Month|Segment) 조합별 지표를 미리 계산해두는 방식으로 재설계.
- `refreshACQSummary_()`가 Append/Rebuild/Sync 5개 함수 완료 시 자동 호출되어 항상 최신 유지.
- 결과: 리포트 조회가 수십 초 → 1초 이내로 개선.

### SAL 데이터 소스 확정
- 새 `SALs_Raw` 시트 안 만들고, 기존 MTA CSV export에 `Lead: Lead Record Type`(값: MQL/SAL) 컬럼만 추가 요청하는 것으로 단순화.
- MTA 전체(81,907건) 재수출/재Import/Full Rebuild 완료, `Lead Record Type` 필드 반영 확인됨.

### IC Funnel Sync 구축 및 검증
- 새 `ICFunnel_Raw` 시트 + `syncICFunnelToOPS()` 구현 — 별도 Lead 리포트(IC Booked/Completed/Won Date 중
  하나라도 해당 주에 걸리면 잡히는 필터, 2018~현재 히스토리 백필용 최초 추출)로 Leads_OPS의 Funnel 4개 필드만 역동기화.
- `OPS.SF_COLUMNS`에서 IC Booked/Completed/Won/Revenue를 빼서 `OPS.SYNC_COLUMNS`로 재분류
  (mergeOPS()가 더 이상 이 필드들을 Master의 stale 값으로 덮어쓰지 않도록).
- 최초 실행: 3,139건 중 3,127건 반영, 12건 "Not found" — 10건은 mergeOPS 중복 제외 로직으로 의도적으로 없는 Lead,
  2건은 아직 weekly export에 안 잡힌 최신 Lead(2026-07-20 생성)로 확인, 전부 정상.

### Attribution 불일치 발견 및 보류
- All Leads/All P1/SAL(MTA_Master 소스)은 Last Touch 기준 Segment, New Leads/New P1/IC Booked/Complete/Revenue
  (Leads_OPS 소스)는 First Touch 기준 Segment로 서로 다름. 기존 설계 문서(business-segment-classification.md)와
  일치하는 의도된 차이. SAL을 First Touch로 통일할지는 이번엔 보류 (추후 파이프라인/리포트 단계에서 논의 예정).

### 디자인 (32_ACQReportStyles.js)
- % 컬럼 소수점 1자리 %표기, Revenue 천단위 콤마, 전체 테두리, 짝수 행 배경색(#F3F3F3) 적용.

### 트러블슈팅 히스토리 (자세한 내용은 docs/ACQReportImplementation.md 참고)
- `endIndex` 세그먼트 블록 계산 누락, `targetRows` 변수 삭제 사고, Report Area 코드 중복(mtaAgg/opsAgg 구버전 잔존),
  `computeMTAAggregates_`/`computeOPSAggregates_`의 null range 처리 누락, `CONFIG.ACQ.SUMMARY_SHEET` 로컬-서버
  동기화 불일치로 인한 반복적인 신규 시트 생성 버그, `split_csv.js`가 실수로 Apps Script 프로젝트에 push되어
  전체 프로젝트 파싱이 깨졌던 사고(`require is not defined`), Apps Script의 `_` 접미사 함수 Run 드롭다운 미노출 관례.
- 교훈: **서버(Apps Script 편집기)에서 직접 코드를 수정하지 말 것 — 항상 로컬에서 수정 후 push.**
  Node 전용 유틸리티 스크립트는 프로젝트 폴더 밖에 두거나 `.claspignore`로 제외할 것.

# Changelog — 2026-07-22

## 1. MTA Funnel Sync 재검증 (09_MTAFunnelSync.js)
- `rebuildLeadsMaster()`/`rebuildMTAMaster()`/`buildLeadsOPS()`/QA 재실행 완료, `24_OPSQA.js`의 QA
  Dashboard에서 `#Won`(OPS 3093 vs MTA 2875, +218) / `Total Revenue`(OPS가 +415만 많음) 역방향 불일치 발견.
- 원인: 삭제된 구버전 `08_ICFunnelSync.js`(ICFunnel_Raw 기반) 시절 잔존 데이터로, 현재 `MTA_Master`에는
  대응 레코드가 없는 219건 (전부 category A: MTA_Master에 Lead ID 자체가 없음, 파싱 버그 아님).
  `syncMTAFunnelToOPS_()`는 값이 있을 때만 채워넣고 지우지 않으므로 안전하게 보존됨 — 버그 아님, 정상.

## 2. Business Segment 리네이밍
- `Event Offline` → `Seminar`, `Event Online` → `Webinar` (분류 조건 변경 없음, 표시 이름만 변경).
- 변경 파일: `16_TransformHelper.js`(`getBusinessSegment()`), `00_Config.js`(`CONFIG.ACQ.SEGMENTS`),
  `docs/BusinessSegmentClassification.md`, `30_ACQReport.js` 주석.
- **주의**: Master 재생성(`rebuildLeadsMaster()`/`rebuildMTAMaster()`) 전까지는 기존 데이터에 구 이름이 남아있음.

## 3. ACQ Report "All Leads" 월별 집계 근본 한계 발견
- `Last MKT UTM Campaign`이 Salesforce Lead 객체의 **현재 최종 상태 필드**임을 실데이터로 확인
  (Lead `00Q7F00000VePrO`의 2020~2026년 여러 터치를 Salesforce에서 각각 필터링해도 전부 동일한 최신 캠페인).
  터치 시점의 채널 정보를 전혀 보존하지 않음.
- 영향: `MTA_Master`는 터치 단위(1 Lead=N Row)인데 `Business Segment`는 Lead 레벨 필드라 한 Lead의
  모든 터치 row가 항상 동일 Segment를 가짐 → 월별 Segment 집계가 "그 달의 실제 채널"을 의미하지 않음.
- **결정**: 리포트/코드 수정 없음. 한계를 `docs/ACQReportDesign.md`에 명시하는 것으로 마무리
  (Lead 단위 dedup 재설계도 검토했으나, Segment 자체가 터치 시점 정보를 못 담으므로 근본 해결 안 됨).

## 4. MTA_Master 중복 append 의심 (미해결, TODO)
- `findDuplicateTouchRows_()`(`24_OPSQA.js`)로 같은 Lead ID+같은 MTA Created Date 조합 3,401개 그룹,
  extra row 4,139건 발견. MTA_Raw 원문 확인 결과 애초에 시간 정보가 없는 날짜 단위 데이터라, 같은 날
  여러 정상 터치인지 실제 재export로 인한 중복 append인지 현재 필드로는 구분 불가.
- CLAUDE.md "현재 알려진 미해결 항목" 3번으로 TODO 유지.

## 5. Leads_OPS 짝수 행 배경색(Row Banding) 추가
- `20_OPS_Styles.js`에 `computeRowBandingColors_()` 추가, 짝수 행에 `#F3F3F3` 배경 — 컬럼 많은 행을
  옆으로 읽을 때 row 경계 구분 목적. 35,000+ 행이라 `setBackgrounds()` 배치 호출로 구현 (개별 호출 지양).

## 6. Leads_OPS ↔ Master 자동 Sync 연결
- `appendNewLeads()` → `buildLeadsOPS(true)`(QA 생략) 자동 호출 추가.
- `appendNewMTA()` → `syncMTAFunnelToOPS_()` 자동 호출로 대체 (기존 `refreshACQSummary_()` 단독 호출 제거,
  `syncMTAFunnelToOPS_()`가 내부에서 이미 호출하므로 중복 방지).
- 배경: "IC Requested 체크 후 다음 수동 sync 전까지 IC Booked Date가 안 보인다"는 실무 갭 해소 목적.
  MTA sync는 Lead가 이미 Leads_OPS에 있어야 하지만, 매번 전체 재계산이라 순서가 뒤바뀌어도 다음 사이클에
  자동으로 따라잡힘 (self-healing) — 두 담당자가 다른 날 독립적으로 import해도 무방.
- 자세한 내용: `docs/OperationsLayer.md` "자동 Sync 연결" 섹션.

## 7. IC Request Tracking 구현 (재신청 이력 보존)
- `20_OPS_Config.js`: `IC Requested` 옆에 `Last IC Requested Date`, `Total IC Requests` 컬럼 추가.
  `IC Requested`는 `MANUAL_COLUMNS`에서 제외 — `OPS.IC_REQUEST`(CHECKBOX/COUNTER)로 특수 관리.
- `22_OPS_Merge.js`: `applyICRequestTracking_()` 추가. 매 merge마다 기존 `IC Requested`가 true였으면
  `Total IC Requests` +1 후 리셋. 추가로 `IC Booked Date`가 있는데 카운트가 0이면 1로 하한 보정
  (트래킹 도입 이전 기존 Booked 이력 백필 + 체크박스 없이 booked되는 예외 케이스 커버).
- `20_OPS_Styles.js`: `Last IC Requested Date` 날짜 서식(yyyy-mm-dd) 추가.
- 자세한 내용: `docs/OperationsLayer.md` "IC Request Tracking" 섹션.

## 8. MTA Business Segment 필드 근본 수정 — "Last MKT UTM Campaign" → "MKT UTM Campaign"
- **배경**: 3번 항목에서 "Salesforce 데이터 모델 자체의 한계"로 결론 냈던 것을, 사용자가 같은 날 오후
  Salesforce 리포트 추출 필드를 `Last MKT UTM Campaign`(Lead 객체 레벨) → `MKT UTM Campaign`
  (Multi Touch Attribution 객체 자체 필드)로 교체해서 실제로 해결함. 후자는 터치별 실제 캠페인 값이 찍힘.
- `13_MTATransformer.js` v5.0.0: `getBusinessSegment()` 입력 필드 교체, Master 컬럼명도
  `Last MKT UTM Campaign` → `MKT UTM Campaign`로 개명 (더 이상 "Lead의 최종 터치"가 아니므로).
- `24_OPSQA.js`의 진단 함수들(`runInvestigateSegmentMonthAnomaly`, `runSampleDuplicateRawDates`)도
  새 필드명으로 업데이트.
- ⚠️ **`appendSheetRecords()`(`05_SheetWriter.js`) 주의**: 기존 데이터 있는 시트에 append할 때 **시트에
  이미 있는 헤더만 기준으로 컬럼 매칭**. `MTA_Raw` 헤더에 `MKT UTM Campaign`이 없으면 새 CSV의 이
  컬럼이 조용히 드롭됨. 재추출 CSV를 새 헤더 포함해서 다시 쌓아야 함.
- **결정**: 과거 82,000+ 터치까지 정확한 Segment로 바로잡기 위해 **전체 재추출 + 재구축** 진행하기로 함
  (부분 적용— MTA_Raw 헤더만 추가하고 신규 터치부터만 적용 — 대신 선택).
  절차: MTA 전체 리포트 재추출(`MKT UTM Campaign` 포함) → `MTA_Raw`/`MTA_Master` 시트 내용 수동 삭제 →
  `99_ResetRawMaster.js`의 `resetMTACounterOnly()` 실행 → "Import MTA"로 전체 CSV 재업로드 →
  `rebuildMTAMaster()` 실행 (`refreshACQSummary_()` 자동 포함) → `buildLeadsOPS()`로 OPS도 갱신.
- 자세한 내용: `docs/BusinessSegmentClassification.md` "필드 변경 이력", `docs/ACQReportDesign.md`
  "All Leads/SAL — Segment 한계 해결됨" 섹션.

## 14. Events_REP 설계 착수 — Meta 데이터 소스 확인 대기 (미해결)

- 다음 리포트로 **Events_REP** 논의 시작: Business Segment 중 **Webinar/Seminar만** 대상,
  NewP1_REP과 달리 **All Leads부터** 퍼널을 그림 (P1 필터 없음), 여기에 마케팅 캠페인 성과를 연결해
  프로그램 자체의 실질 퍼포먼스(ROI)를 보는 목적.
- **소스 결정**: `MTA_Master` (사용자 선택) — "All Leads"가 이미 ACQ_REP에서 MTA_Master 기준
  용어이고, 터치별 `MKT UTM Campaign`이 이미 존재. 퍼널 지표(IC Booked/Complete/Won/Revenue)는
  `Leads_OPS`와 Lead ID로 join 필요 (`09_MTAFunnelSync.js`의 기존 매칭 로직 재사용 가능성 있음).
- **막힌 지점**: "마케팅 캠페인"이 Salesforce `MKT UTM Campaign` 라벨이 아니라 **Meta 광고
  플랫폼 자체의 퍼포먼스 데이터**(스펜드/도달/CTR 등으로 추정)를 붙여서 보고 싶다는 의미로 확인됨.
  이는 현재 파이프라인에 전혀 없는 새 외부 데이터 소스라, 다음 세션에서 먼저 확인 필요:
  1. Meta 광고 성과 데이터를 지금 어떻게 확보 중인지 (수동 CSV export? 기존 시트? 아직 없음?)
  2. Meta 캠페인과 Salesforce `MKT UTM Campaign` 간 join key(이름/ID 일치 여부)
  3. Meta 데이터의 시간 단위(일별/주별/캠페인 누적)
  4. 새 Import 파이프라인(`Meta_Raw` 등) 신설 필요 여부
- 코드 변경 없음 — 순수 논의만 진행, 사용자가 다른 대화창(claude.ai)에서 이어가기로 함.

## 다음에 다룰 항목 (2026-07-22 최종 갱신)
- ~~MTA 전체 재추출 + 재구축 실행 대기 (7번 항목 절차)~~ — 완료.
- ~~BOFU fix 반영 MTA_Master 재구축~~ — 완료 (82,421건 매칭 확인).
- **Events_REP 설계 이어가기 (14번 항목)** — Meta 광고 성과 데이터 확보 방식부터 확인 필요. 다음 세션 최우선.
- `Total Touches`(MTA_Master 기준 터치 횟수) 컬럼 — Leads_OPS `Revenue Actual`과 `Notes` 사이(T/U열 사이)에 추가. 아직 미구현.
- "Other" 세그먼트 중 Upsell 비중 조사 — `runInvestigateOtherSegmentComposition()`(`24_OPSQA.js`) 구현 완료,
  실행 결과 확인 대기.
- MTA_Master 중복 append 의심(4번 항목) — 여전히 미해결, CLAUDE.md TODO 3번 참고.
- NewP1_REP: Segment가 실제 데이터 있는 조합만 sparse하게 표시됨(전체 7개 고정 표시 아님) —
  사용자가 "지금 급하지 않다"고 확인, 필요 시 재검토.

# Changelog — 2026-07-22 (계속, 오후)

## 9. 로컬 개발 환경 재구축 (신규 머신)
- 새 환경에 Git 미설치 상태 확인 (winget도 미설치) → Git for Windows 인스톨러 직접 다운로드해 무인 설치.
- 기존 로컬 `crimson-lead-tracker` 폴더(스텁 상태, `.gs` 확장자, 문서 없음)를
  `crimson-lead-tracker-backup-20260722`로 백업 후, GitHub(`Harry-sk-mkt/crimson-lead-tracker`) clone으로 교체.
- `clasp` 재설치 + 로그인(`h.yun@crimsoneducation.org`) 재인증.
- GitHub push 인증: 이 세션의 브릿지된 터미널은 상호작용이 비활성화되어 있어 Git Credential Manager의
  브라우저 로그인을 못 띄움 → 사용자가 별도의 일반 터미널에서 직접 `git push` 실행해 해결.

## 10. MTA_Raw 재추출 시 "Lead: Lead ID" 컬럼 누락 발견 + 재조치
- 사용자가 새로 다운로드한 MTA raw CSV(`report1784693554195.csv`, 82,421행)에 `Lead: Lead ID` 컬럼
  자체가 없음 발견. `CONFIG.REQUIRED_FIELDS.MTA`가 이 필드를 필수로 요구해서 전체 레코드가
  invalid 처리 → `MTA_Raw`에 0건 기록 (에러 없이 "성공"으로 끝나 원인 파악에 로그 확인 필요했음).
- 원인: Salesforce 리포트 재추출 시 필드 설정 누락으로 추정 (재현 조건 불명, 일회성 사용자 실수로 판단).
- 조치: `Lead: Lead ID` 포함해서 재추출(`report1784695873625.csv`) → `google.script.run` 페이로드
  크기 문제 방지를 위해 Node 스크립트(`split_csv.mjs`, 프로젝트 폴더 밖 scratchpad에 위치 —
  gotcha #3 원칙 준수)로 CSV를 quote-aware하게 정확히 2등분(41,211 / 41,210행, 헤더 포함) →
  `MTA_Raw`/`MTA_Master` 시트 전체 삭제 → `resetMTACounterOnly()` → 두 파일 업로드 → `appendNewMTA()`.
- 결과: 82,421건 전체 매칭 확인, `MTA_Master` 재생성 완료.

## 11. MTA BOFU Business Segment 버그 발견 + 수정
- 사용자가 ACQ_REP에서 BOFU가 항상 0으로 나오는 것을 확인, 원인 조사.
- `13_MTATransformer.js`의 `getBusinessSegment()` 호출에서 `detail` 인자가 하드코딩된 `""`였음
  (10번 항목의 MTA 전체 재구축과 무관하게 이전부터 존재하던 별개 버그). BOFU 판정 조건은
  `detail.includes("bofu")` 단독이라 campaign 기반 fallback이 없어 구조적으로 절대 나올 수 없었음.
- Leads_Master 쪽(`12_LeadTransformer.js`)은 원래부터 정상적으로 detail을 넘기고 있어 영향 없음
  (Leads/MTA 분류 로직은 원래도 소스 필드가 다르게 분리되어 있었음 — First Touch vs Per-Touch).
- 사용자 확인: MTA 리포트의 `Lead Source Detail`은 `Lead:` prefix가 없어 Multi Touch Attribution
  객체 자체 필드로 판단 (샘플 검증, 100% 확정은 아님).
- 수정: `13_MTATransformer.js` v5.1.0, `""` → `rawRecord["Lead Source Detail"]`.
  회귀 테스트 `testTransformMTARecord_BOFU()` 추가. `clasp push --force`(manifest 변경 확인 필요)로 배포,
  git 커밋(`cb8fb85`) + GitHub push 완료.
- 반영을 위해 `MTA_Raw`/`MTA_Master` 재삭제 → `resetMTACounterOnly()` → 재Import → `appendNewMTA()` 재실행 중.
- 자세한 내용: `docs/BusinessSegmentClassification.md`, `docs/ACQReportDesign.md`.

## 12.5. IC Booked/Complete Event 기준 검증 + 헤더 Note 추가
- `24_OPSQA.js`에 `runDiagnoseICCompleteMismatch()`(Leads_OPS vs MTA_Master 재계산값 대조)와
  `runBreakdownICCompleteByBookedMonth()`(이번 달 Complete 건을 Booked 월별로 분해) 진단 함수 추가,
  일시적으로 `✅ QA` 메뉴에 걸어 실행 확인 후 메뉴에서 제거(진단 함수 자체는 파일에 보존).
- 검증 결과: IC Booked(41)/IC Complete(43) 전부 정상 — sync 로직 버그 없음. Complete가 Booked보다
  많은 건 5~6월에 Booked된 상담이 7월에 Complete된 백로그(재부킹 등) 때문으로 확인, 정상 동작.
- `32_ACQReportStyles.js` v1.4.0: `annotateACQReportMetricNotes_()` 추가 — `ACQ_REP` 헤더 K/L/M/N
  (SAL/IC Booked/IC Complete/Revenue) 셀에 날짜 기준을 Note로 남겨, 코호트/이벤트 기준 혼동 방지.
  `applyACQReportStyles_()`가 매 리포트 생성마다 자동 호출하므로 항상 최신 유지.

## 12.6. NewP1_REP 설계 확정 + ACQ_REP New P1 로직 통일
- 사용자가 `docs/NewP1ReportDesign.md`에 NewP1_REP(New P1 Cohort Funnel Report) 설계를 직접 정리 —
  소스는 `Leads_OPS` 단일, 코호트는 `Create Date` + 유효 Priority(`Priority Override` 우선 →
  `Lead Priority`, exact match `"Priority 1"`), SAL 판정은 `Total IC Requests` > 0(MTA 무관),
  Won 판정은 `Revenue` > 0, Row는 FY>Month>Fiscal Week>Segment flat 구조(소계 없음), Engine과
  Summary를 `NewP1_Engine` 한 시트로 통합. 리뷰 결과 Article 번호 인용/실제 함수 동작 모두 정확함 확인.
- 리뷰 중 발견: ACQ_REP의 New P1(`computeOPSAggregates_()`)이 `Priority Override`를 무시하고
  `Lead Priority`에 `indexOf("1")`(substring)로 느슨하게 비교하고 있어, NewP1_REP 설계(exact match +
  Override 우선)와 기준이 달랐음. 사용자 확인 후 **ACQ_REP의 New P1도 같은 기준으로 통일** —
  `isEffectiveP1_()` 신규 추가(`30_ACQReport.js` v1.5.0), 테스트 `testIsEffectiveP1()` 포함.
  All P1(MTA_Master 기반)은 `Priority Override` 컬럼 자체가 없어 대상 아니고 기존 로직 유지.
- NewP1_REP 구현은 다음 세션 대기 (`40_NewP1Report.js`/`41_NewP1ReportStyles.js`/`CONFIG.NEWP1` 신규 예정).

## 13. NewP1_REP 구현 완료

- `docs/NewP1ReportDesign.md` 설계 그대로 구현: `40_NewP1Report.js`(Engine + Aggregates + Report 생성),
  `41_NewP1ReportStyles.js`(서식), `00_Config.js`의 `CONFIG.NEWP1` 신규.
- **Cohort 정의**: `Leads_OPS` 단일 소스, Create Date 구간 + 유효 Priority(`Priority Override` 우선 →
  `Lead Priority`, exact match `"Priority 1"`, `isEffectiveP1_()` 재사용).
- **Engine**: `NewP1_Engine` 숨김 시트 하나에 Engine(조합/Sort Index)과 Summary(사전 집계)를 통합
  (ACQ_REP은 이 둘이 분리돼 있으나, NewP1은 매번 전 기간을 사전 집계하므로 합쳐도 무방 — 설계 문서 §6).
  `refreshNewP1Engine_()`을 `refreshACQSummary_()`가 호출되는 모든 지점(`appendNewLeads()`,
  `syncMTAFunnelToOPS_()`, `rebuildLeadsMaster()`, `rebuildMTAMaster()`)에 나란히 추가.
  `runRefreshACQSummary()`(수동 전용 래퍼)는 건드리지 않음 — `runRefreshNewP1Engine()`을 별도 제공.
- **Row 구조**: FY > Month > Fiscal Week(`getWeek()` 재사용, 8/1=W01 시작) > Segment, flat(소계 없음).
  Week가 Month 경계와 무관하게 파생되어 같은 Week 번호가 다른 두 Month 아래 나뉘어 나타날 수 있음
  (의도된 동작). 이 때문에 ACQ_REP처럼 고정 blockSize로 월 블록을 나눌 수 없어, `reverseNewP1MonthBlocks_()`는
  FY/Month 값이 실제로 바뀌는 지점을 경계로 판단하도록 별도 구현 (ACQ의 `reverseMonthBlocks_()`와 다른 방식).
- **onEdit 통합**: GAS는 전역 함수명이 파일 간 중복되면 나중에 로드된 정의가 조용히 덮어써서, `onEdit()`을
  파일마다 따로 두면 안 됨. `30_ACQReport.js`의 기존 `onEdit()`을 시트 이름 분기 방식으로 리팩터링해서
  `handleACQReportGenerateEdit_()`(기존 로직 그대로 이동)와 `handleNewP1ReportGenerateEdit_()`(신규)를
  각각 호출하도록 변경 — ACQ_REP 동작 자체는 변경 없음.
- **최초 시트 세팅**: ACQ_REP과 달리 사전에 수동으로 만들어둔 헤더가 없어서, `setupNewP1Report()`가
  시트 생성 + Control Area 헤더(Start FY/Start Month/End FY/End Month/Generate Report) + Report Area
  헤더(14개 컬럼) + 드롭다운까지 한 번에 세팅하도록 구현. 편집기에서 1회 수동 실행 필요.
- 신규 pure 함수(`deriveNewP1Cohort_`, `computeNewP1SortIndex_`, `reverseNewP1MonthBlocks_`)는
  전부 `testXXXX()` 회귀 테스트 동반 (TDD).
- 리뷰 중 발견해 같이 처리한 항목: ACQ_REP New P1 로직 통일 (별도 §12.6 기록).

## 13.5. NewP1_REP — Week 축 제거, 줄무늬 배경 Weekly 실험 후 원복
- 사용자가 실제 화면 확인 후 `getWeek()`(8/1 기준 7일 단위 Fiscal Week)이 캘린더 주(월~일)와
  무관함을 확인 — 매년 8/1 요일이 달라(FY26=금요일, FY27=토요일) Week 시작 요일이 매년 바뀜.
  캘린더 주로 오인하기 쉬워 혼동 유발 → **Week 축을 리포트에서 완전히 제거**하기로 결정.
- Row 구조를 FY > Month > Fiscal Week > Segment → **FY > Month > Segment**로 단순화
  (ACQ_REP과 동일 계층). Report Area 14 → 13컬럼, Engine 11 → 10컬럼.
  `computeNewP1SortIndex_()`에서 Week 슬롯 제거(ACQ의 `computeSortIndex_()`와 동일한 형태로 단순화).
  `deriveNewP1Cohort_()`도 Week 계산 제거. `CONFIG.NEWP1.MAX_WEEKS`는 제거하지 않고 보존(향후 재도입 대비).
- 이 변경 직전에는 "줄무늬 배경을 Monthly → Weekly 기준으로" 요청받아 `41_NewP1ReportStyles.js`
  v1.1.0에 반영했었으나, Week 축 자체가 사라지면서 v1.2.0에서 자연스럽게 FY+Month 기준으로 복귀.
- `docs/NewP1ReportDesign.md`는 원래 Week 포함 설계 텍스트를 삭제하지 않고 "원래 설계(배경 기록)"
  섹션으로 보존, 위에 변경 사유를 명시하는 방식으로 갱신.

## 12. 리포트 설계 가드레일 재확인 — 향후 NewP1_REP 등 확장 리포트 주의사항
- 사용자가 향후 만들 New P1 Funnel 리포트(`NewP1_REP`, 미구현)가 `Leads_Master`를 직접 읽으면 안 된다는
  점을 미리 확인. `Leads_Master`는 append-only라 갱신된 상태(Business Segment 재분류 등)를 반영 못 함.
  기존 원칙(`docs/OperationsLayer.md`: "향후 모든 리포트는 Leads_Master가 아닌 Leads_OPS를 읽어야 한다")과
  일치 — 코드 변경 없음, 향후 구현 시 지킬 가드레일로 기록.
- 참고로 `IC Booked Date` 등 `OPS.SYNC_COLUMNS`는 애초에 `Leads_Master`를 거치지 않고
  `syncMTAFunnelToOPS_()`가 `MTA_Master`에서 직접 `Leads_OPS`로 쓰기 때문에 이 문제와 무관 (이미 안전).