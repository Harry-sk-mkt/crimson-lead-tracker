/**
 * ==========================================================
 * Marketing 2.0
 * Ad Spend — Naver Search Ad API Import/Transform (2번째 플랫폼)
 *
 * Responsibility
 * 네이버 검색광고 Open API(https://api.searchad.naver.com)를 직접 호출해
 * 캠페인 목록 + 지출 통계를 가져와 (FY|Month|Segment)별 Spent로 변환/집계한다.
 *
 * **설계 배경(2026-07-31)**: 원래 화면/다운로드 지출액 리포트에는 기간(날짜)
 * 컬럼이 전혀 없어(사용자 확인 — "계속노출" 표시뿐, 실제 날짜 아님) 사용자가
 * 매달 수동으로 "Report Month" 컬럼을 붙여넣는 방식(NaverSA_Raw)을 먼저
 * 구현했었으나, 사용자가 네이버 검색광고 API 자격증명(Customer ID/API License
 * Key/Secret Key)을 이미 보유하고 있다고 알려와 API 방식으로 전면 전환 —
 * API는 조회 기간을 정확히 지정할 수 있어 수동 입력 자체가 필요 없어짐.
 * 수동 붙여넣기 방식(NaverSA_Raw 시트, Header-Based Mapping)은 완전히 폐기.
 *
 * **인증(2026-07-31, naver/searchad-apidoc 공식 샘플 코드로 확인 — 추측
 * 없음)**: 요청마다 `X-Timestamp`(현재 시각 ms)/`X-API-KEY`/`X-Customer`/
 * `X-Signature`(Base64(HMAC-SHA256(secretKey, "{timestamp}.{method}.{uri}")))
 * 헤더 필요. 자격증명은 이 파일/Config 어디에도 없음 — Apps Script 편집기
 * "Project Settings > Script Properties"에 `AD.NAVER_SEARCH.API.PROPERTY_KEYS`
 * 이름으로 사용자가 직접 입력(git에 노출 금지).
 *
 * Business Segment 분류는 새로 만들지 않고 `getBusinessSegment()`
 * (16_TransformHelper.js)를 재사용 — `AD.NAVER_SEARCH.LEAD_SOURCE_OVERRIDE`
 * ("naver search") 고정값을 leadSource 자리에 넘겨 `_contact`류 캠페인이
 * BOFU로 오분류되는 문제를 해결(docs/exec-plans/active/
 * 2026-07-30-campaign-spend-integration.md 참고).
 *
 * **실 API 응답으로 검증 완료(2026-07-31)**: `runDebugNaverSearchAdCampaigns()`/
 * `runDebugNaverSearchAdStats()` 실행 결과 확인 — `/ncc/campaigns`는 배열,
 * 캠페인명 필드는 "name"(추정 맞음), `nccCampaignId`가 캠페인 ID.
 * `/stats`는 `{data:[{id, clkCnt, impCnt, salesAmt}], compTm, cycleBaseTm}`
 * 형태, id가 nccCampaignId와 동일 값으로 매칭됨. salesAmt는 원(KRW) 정수.
 *
 * Must NOT
 * - 새 Business Segment 분류 로직 작성 (getBusinessSegment() 재사용)
 * - 자격증명을 코드/Config에 하드코딩 (Script Properties만 사용)
 * - Target_Engine/ACQ_REP/NewP1_REP에 결과를 아직 쓰지 않음(여러 플랫폼
 *   집계 방식은 별도 결정 필요, exec-plan 참고)
 *
 * Stage
 * AD (2026-07-30 네이밍 컨벤션. 기존 00~99는 당장 안 바꿈)
 *
 * Version
 * v2.16.0
 *
 * Change Log
 * v2.16.0 (2026-09-04)
 * - **`Naver_Search_Campaign_Stats_Cache` 외부 스프레드시트 이관**
 *   (`docs/OpenItems.md` #49) — `openNaverSearchCampaignStatsCacheExternalSpreadsheet_()`
 *   신규(`MASTER_010_SALSync.js`의 `openSALExternalSpreadsheet_()`와 동일 패턴),
 *   `readNaverSearchAdCampaignStatsCache_()`/`writeNaverSearchAdCampaignStatsCache_()`/
 *   `runShowNaverSearchAdCampaignStatsCache()`가 `getActiveSpreadsheet()` 대신
 *   이 opener 경유. 헤더/로직/호출부는 전혀 무변경 — I/O 대상만 전환.
 * v2.15.0 (2026-08-19)
 * - Target_REP 주별 CPNP1 정확도 개선(AD_002_Meta.js v1.7.0과 동일 배경) —
 *   `/stats`가 임의 기간을 그대로 받는다는 점(`fetchNaverSearchAdStats_()`가
 *   이미 문자열 since/until을 그대로 넘김, 달력월 정렬 제약 없음)을 활용해
 *   월 대신 주(월~일) 단위로 직접 조회하는 신규 경로 추가: `buildCalendarWeekRange_()`
 *   (buildCalendarMonthRange_()의 주 버전, addDaysToDate_() 재사용),
 *   `computeNaverSearchAdSpendByWeekSegment_()`(computeNaverSearchAdSpendByFYMonthSegment_()의
 *   주 버전, referenceDate 대신 weekStart를 그대로 키에 씀),
 *   `computeNaverSearchAdSpendHistoryWeeklySummary_()`(IO 래퍼 — 월별 버전과
 *   달리 전체 이력이 아니라 Target 주 사이클 전환일(Cutover Date)부터만 순회 —
 *   Naver는 API로 임의 기간을 정확히 조회하므로 **근사 없는 참값**). 기존
 *   월별 함수/출력은 전혀 안 건드림(ACQ_REP/FY_REP 하위호환 유지).
 * v2.14.0 (2026-08-05)
 * - **Spent 전체 기간 소급 백필(사용자 요청 — "시작일까지 전체 소급")** —
 *   `runDebugNaverSearchAdStatsCcntRangeLimit()` 실측 결과 ccnt는 salesAmt와
 *   같은 호출에 있든 없든 92일 제약을 그대로 받음(`{code:11004}` 400,
 *   impCnt/clkCnt 없이 salesAmt+ccnt만 400일로 요청해도 재현) — 즉 Results는
 *   92일 롤링 윈도우가 API 하드 리밋으로 확정, 전체 기간 소급 불가능한
 *   반면 salesAmt 단독은 이미 730일까지 확인돼 있어(Ad_Spend_Cache
 *   파이프라인) Spent만 전체 기간 소급 가능. 신규
 *   `accumulateNaverCampaignSpendKrwByName_()`(순수 함수, 월별 누적) +
 *   1회성 `runBackfillNaverSearchCampaignSpendHistory()` —
 *   `computeNaverSearchAdSpendHistorySummary_()`와 동일 패턴(캠페인 목록 1회
 *   조회 + BACKFILL_START부터 매달 salesAmt 단독 조회, 730일 밖 에러만
 *   건너뜀)을 캠페인 이름 단위로 재사용, spentKrw를 0으로 리셋 후 전체
 *   재계산(90일 백필과 이중 합산 방지), impressions/clicks/results는
 *   불변. 신규 테스트 `testAccumulateNaverCampaignSpendKrwByName()`.
 * v2.13.0 (2026-08-05)
 * - 신규 `runDebugNaverSearchAdStatsCcntRangeLimit()`(수동 실행, 진단용) —
 *   사용자가 Spent/Results 금액이 작다고 지적(90일 백필로는 캠페인 시작일
 *   전체를 못 채움) — impCnt/clkCnt 없이 salesAmt+ccnt만 400일 범위로
 *   요청해 ccnt가 salesAmt와 같은 730일 허용 범위를 공유하는지(92일
 *   제약이 impCnt/clkCnt 전용인지) 실측하는 진단 함수. 결과 확인 후 전체
 *   기간 소급 백필(월별 반복 호출 + 11004 뜨는 달 건너뛰기, 기존
 *   computeNaverSearchAdSpendHistorySummary_() 패턴 재사용) 구현 예정.
 * v2.12.0 (2026-08-05)
 * - **버그 수정 — 배포 직후 Spent/Results가 0으로 표시됨(사용자 실측 보고)**:
 *   원인은 `refreshNaverSearchAdCampaignStatsCache_()`의 "오늘 이미 갱신됨"
 *   가드 — v2.9.0/v2.11.0 배포 이전에 이미 오늘자 갱신이 한 번 돌아서(구버전
 *   호출, salesAmt/ccnt 없이) 오늘 날짜가 `LAST_FETCHED_THROUGH`에 기록돼
 *   있었고, 그래서 신규 필드를 요청하는 갱신이 오늘 안에 한 번도 실행되지
 *   못함(캐시 시트에 Spent(KRW)/Results 컬럼 자체가 없는 상태로 남음). 신규
 *   `backfillNaverCampaignStatsSpentResults_()`(순수 함수) + 1회성 진입점
 *   `runBackfillNaverSearchCampaignStatsSpentResults()` — impressions/clicks
 *   누적치(및 그 진행률 추적용 LAST_FETCHED_THROUGH)는 전혀 안 건드리고
 *   spentKrw/results만 최근 90일 윈도우로 채움(멱등 — 여러 번 실행돼도
 *   매번 같은 스냅샷으로만 재설정, 중복 합산 없음). 신규 테스트
 *   `testBackfillNaverCampaignStatsSpentResults()`.
 * v2.11.0 (2026-08-05)
 * - **Search_OPS "Results" 자동화(사용자 요청)** — `runDebugNaverSearchAdStatsExpandedFields()`
 *   실측 결과 `ccnt` 필드가 200 정상 응답하고 값이 항상 clkCnt 이하라 "전환수"로
 *   판단(사용자 확인) — Spent와 동일한 누적 캐시 패턴으로 확장.
 *   `fetchNaverSearchAdImpressionsClicksStats_()` fields에 "ccnt" 추가,
 *   `accumulateNaverSearchAdCampaignStats_()`가 results도 누적,
 *   `NAVER_CAMPAIGN_STATS_CACHE_HEADERS`에 "Results" 컬럼 추가,
 *   `convertNaverCampaignStatsSpendToNZD_()`가 results를 변환 없이 그대로
 *   통과(통화 무관). `70_Search_Config.js` v1.6.0에서 "Results"를
 *   GROUP_3_MANUAL→GROUP_3A_AUTO로 이동, `73_Search_Merge.js` v1.7.0이
 *   매칭 시 Results도 함께 채우도록 확장(Spent와 달리 FX 실패와 무관하게
 *   항상 갱신 — impressions/clicks와 동일하게 처리).
 * v2.10.0 (2026-08-05)
 * - `runDebugNaverSearchAdStatsExpandedFields()` 재작성 — 1차 실행 결과
 *   ctr/cpc/avgRnk/ccnt/ccnt1d를 한 번에 요청했더니 `{code:11001}` 400
 *   에러(필드 하나라도 유효하지 않으면 요청 전체 실패로 추정) — 어떤 필드가
 *   문제인지 격리하기 위해 base(impCnt/clkCnt/salesAmt) + 후보 1개씩 개별
 *   요청으로 변경(한 번 Run으로 5개 후보 전부 순회, 필드별 statusCode 로그).
 * v2.9.0 (2026-08-05)
 * - **Search_OPS "Spent" 자동화(사용자 요청)** — 기존 Impressions/Link
 *   clicks 누적 캐시 파이프라인에 salesAmt(KRW)를 얹어 확장.
 *   `fetchNaverSearchAdImpressionsClicksStats_()` fields에 "salesAmt" 추가
 *   (92일 윈도우 안이라 salesAmt의 더 넓은 730일 제약과 충돌 없음),
 *   `accumulateNaverSearchAdCampaignStats_()`가 spentKrw도 누적,
 *   `NAVER_CAMPAIGN_STATS_CACHE_HEADERS`에 "Spent (KRW)" 컬럼 추가(원본
 *   그대로 캐시 저장 — NZD 변환은 IO 경계에서). 신규
 *   `convertNaverCampaignStatsSpendToNZD_()`(순수 함수) — `72_Search_Build.js`가
 *   `fetchKrwToNzdRate_()`(AD_004_SpendCache.js)로 구한 환율을 넘겨 변환
 *   (사용자 확정 — ACQ_REP과 동일하게 NZD 통일). `70_Search_Config.js`
 *   v1.5.0에서 "Spent"를 GROUP_3_MANUAL→GROUP_3A_AUTO로 이동,
 *   `73_Search_Merge.js` v1.6.0이 매칭 시 Spent도 함께 채우도록 확장.
 *   신규 테스트 `testConvertNaverCampaignStatsSpendToNZD()`, 기존
 *   `testAccumulateNaverSearchAdCampaignStats()` spentKrw 케이스 추가.
 * v2.8.0 (2026-08-05)
 * - 신규 `runDebugNaverSearchAdStatsExpandedFields()`(수동 실행, 진단용) —
 *   Search_OPS "Results" 컬럼 자동화 검토 중, 공식 문서 사이트가 SPA라
 *   스크레이핑으로 필드 목록을 확인할 수 없어 실제 `/stats` 호출로 직접
 *   확인하기 위한 진단 함수. `fields`에 impCnt/clkCnt/salesAmt 외에
 *   ctr/cpc/avgRnk/ccnt/ccnt1d(전환수 후보) 등을 추가로 요청해 어떤
 *   필드가 실제로 값을 반환하는지 실측. 결과 확인 전까지 Results 자동화는
 *   보류(`docs/OpenItems.md` 참고).
 * v2.7.0 (2026-08-05)
 * - 신규 `runShowNaverSearchAdCampaignStatsCache()`(수동 실행, 진단용) —
 *   사용자가 Google Sheets UI "모든 시트" 목록에서 `Naver_Search_Campaign_
 *   Stats_Cache`(hideSheet()로 매번 숨겨짐)를 못 찾겠다고 해서, 코드로
 *   존재 여부 확인 + 강제 공개하는 함수 추가.
 * v2.6.0 (2026-08-05)
 * - **버그 수정(실측)** — `runRefreshNaverSearchAdCampaignStatsCache()` 최초
 *   실행에서 `{code:11004, message:"데이터는 92일 이내 기간에서만 사용
 *   가능합니다."}` 에러 발생. impCnt/clkCnt 필드는 salesAmt 전용 조회(730일
 *   허용)와 별개로 92일 제약이 있음이 확인됨 — 애초 729일로 가정했던 게
 *   틀렸음. `computeNaverSearchAdCampaignStatsFetchWindow_()` 시그니처를
 *   `initialLookbackDays` → `maxRangeDays`로 교체, "최초 실행" 특수 케이스를
 *   없애고 **항상** `since`를 `[today-maxRangeDays+1, today]` 범위로 사전
 *   clamp(오래 못 돌다 재개되는 경우도 동일 로직으로 커버, 사후 재시도
 *   불필요). `AD_001_Config.js`의 `INITIAL_LOOKBACK_DAYS`(729)도
 *   `MAX_QUERY_RANGE_DAYS`(90)로 교체. 테스트에 `staleResume` 케이스 추가.
 * v2.5.0 (2026-08-05)
 * - **신규 — Search_OPS Campaign/Impressions/Link clicks 자동화(사용자 요청)**.
 *   기존 Spent 캐시(`computeNaverSearchAdSpendHistorySummary_()`, 월별 FY|Month|
 *   Segment 재계산 방식)와 달리, 캠페인별 Impressions/Link clicks는 **누적
 *   캐시**로 신규 설계 — Naver `/stats`가 최근 730일 이전 데이터를 아예 거부해
 *   매번 재계산하면 오래된 실적이 사라지는 문제를 피하기 위해, "지난 갱신
 *   이후~오늘"만 조회해 기존 캐시(`Naver_Search_Campaign_Stats_Cache` 시트)에
 *   계속 더한다. 신규 순수 함수: `todayDateString_()`/`shiftDateString_()`
 *   (yyyy-MM-dd 문자열 산술, `new Date(dateStr)` 직접 파싱 시 타임존 버그
 *   위험 회피), `computeNaverSearchAdCampaignStatsFetchWindow_()`(캐시
 *   상태로부터 이번에 조회할 since/until/shouldFetch 결정 — 같은 날 재실행
 *   시 중복 집계 방지), `accumulateNaverSearchAdCampaignStats_()`(기존
 *   누적치 + 이번 구간 impCnt/clkCnt 병합). 신규 IO:
 *   `fetchNaverSearchAdImpressionsClicksStats_()`(salesAmt 전용
 *   `fetchNaverSearchAdStats_()`는 그대로 둠), `readNaverSearchAdCampaignStatsCache_()`/
 *   `writeNaverSearchAdCampaignStatsCache_()`, 오케스트레이션
 *   `refreshNaverSearchAdCampaignStatsCache_()` + 수동 실행 진입점
 *   `runRefreshNaverSearchAdCampaignStatsCache()`. `08_PipelineAsync.js`에
 *   배선(매 Leads/MTA 백그라운드 실행마다 자동), `73_Search_Merge.js`가
 *   이 캐시를 읽어 Search_OPS Campaign/Impressions/Link clicks에 매칭.
 *   Reach는 Naver API에 해당 지표가 없어 이번 자동화 대상에서 제외(계속
 *   수동 입력). 신규 테스트 3개(`testShiftDateString`/
 *   `testComputeNaverSearchAdCampaignStatsFetchWindow`/
 *   `testAccumulateNaverSearchAdCampaignStats`) 전부 PASS.
 * v2.4.0 (2026-08-04)
 * - **진짜 원인 확정 — "재시도해도 안 되는" 400 에러였음**. v2.3.0에서 추가한
 *   재시도 로직이 처음으로 에러를 드러내 확인: `statusCode=400,
 *   {code:11004,message:"데이터는 최근 730일 이내 기간에서만 조회할 수
 *   있습니다."}` — Naver Search Ad API `/stats`의 공식 제약(최근 730일)이고,
 *   `BACKFILL_START`(2022-09)가 이보다 훨씬 오래돼 매번 필연적으로 발생하는
 *   것이었음(rate limit 추정은 틀렸음). 수정: `callNaverSearchAdApiWithRetry_()`
 *   가 이제 429/5xx만 재시도(그 외 4xx는 재시도해도 동일 결과라 즉시 실패,
 *   던지는 Error에 `statusCode`/`body` 첨부). `computeNaverSearchAdSpendHistorySummary_()`
 *   가 이 특정 에러(`statusCode===400 && body.code===11004`, 알려진 플랫폼
 *   제약)만 그 달을 건너뛰고 계속 진행, 그 외 에러는 그대로 던져 전체 갱신
 *   중단. `node --check`/naming/version-header/중복선언 검사 통과, `clasp
 *   push` 완료.
 * v2.3.0 (2026-08-04)
 * - **버그 수정(1차) — Ad_Spend_Cache에서 Search 세그먼트가 통째로 빈 상태로
 *   발견**. `callNaverSearchAdApi_()`가 상태 코드를 확인 안 해서,
 *   `computeNaverSearchAdSpendHistorySummary_()`의 2022-09~오늘 매달 반복
 *   `/stats` 호출(약 47회) 중 일부가 실패해도 에러 없이 그 달만 0으로
 *   처리되고 있었음(`runComputeNaverSearchAdSpendForMonth()` 단일 달 호출은
 *   정상 동작 확인 — API 인증/서명/`getBusinessSegment()` 분류 로직 문제
 *   아님을 먼저 배제). 신규 `callNaverSearchAdApiWithRetry_()`(상태 코드 200
 *   아니면 지수 백오프로 최대 3회 재시도, 그래도 실패하면 명확한 에러를 던짐)
 *   를 `fetchNaverSearchAdCampaignMap_()`/`fetchNaverSearchAdStats_()` 양쪽에
 *   적용 — 이때는 원인을 rate limit로 추정했으나 실제로는 v2.4.0에서 밝혀진
 *   730일 제약이었음.
 * v2.2.0 (2026-07-31)
 * - **전체 이력 백필 함수 추가** — ACQ_REP W열에 Meta+Naver Search 합산 지출을
 *   연결하기로 확정(사용자, "Meta와 동일한 범위"로 소급). 순수 함수
 *   `generateCalendarMonthSequence_()`(시작~종료 연/월 → 달력월 튜플 나열,
 *   Meta의 FY/Month 라벨용 `generateAdSpendMonthRange_()`와 목적이 달라
 *   재사용 불가) 신규. IO 래퍼 `computeNaverSearchAdSpendHistorySummary_()`
 *   (캠페인 목록은 1회만 조회, 시작 연/월~현재월까지 매달 /stats 호출해
 *   FY|Month|Segment로 합산 — `AD.NAVER_SEARCH.API.BACKFILL_START` 기준).
 *   AD_004_SpendCache.js가 이 함수를 호출해 Meta 몫과 합산. Node 하네스
 *   신규 test 1개 PASS.
 * v2.1.0 (2026-07-31)
 * - 실 API 응답 검증 완료 후 최종 집계 함수 구현: `buildCalendarMonthRange_()`
 *   (순수, 연/월 → since/until 날짜 문자열 — Date 객체는 달력 계산 용도로만
 *   써서 타임존 무관하게 안전)/`computeNaverSearchAdSpendByFYMonthSegment_()`
 *   (순수, 캠페인 id→name 매핑 + stats 행 → FY|Month|Segment 합산 —
 *   LEAD_SOURCE_OVERRIDE로 getBusinessSegment() 재사용). IO 래퍼
 *   `fetchNaverSearchAdCampaignMap_()`/`fetchNaverSearchAdStats_()`/
 *   `computeNaverSearchAdSpendSummaryForMonth_()`. 수동 실행 진입점
 *   `runComputeNaverSearchAdSpendForMonth()`(연/월은 함수 상단 상수를 직접
 *   수정해서 재사용 — `runDebugMetaSpendByCampaignForMonth()`와 동일 관례).
 *   Node 하네스 신규 test 2개 전부 PASS.
 * v2.0.0 (2026-07-31)
 * - 수동 붙여넣기(NaverSA_Raw) 방식 완전 폐기, API 방식으로 전면 재작성.
 *   Base URL을 초기엔 공식 샘플 저장소 값(`api.searchad.naver.com`)으로
 *   썼다가 403 invalid-signature 실측 후 GitHub 이슈 #1319(동일 Apps Script
 *   서명 로직으로 GET 200 성공 사례)로 `api.naver.com`이 맞음을 확인·수정.
 *   이후에도 403이 재발해 `runDebugNaverSearchAdSignatureInputs()`(신규
 *   진단, 자격증명 길이/마스킹 노출)로 확인한 결과 Script Properties에
 *   저장된 Secret Key 끝의 "=="가 누락돼 있었음(길이 50, 정상 52) — 사용자가
 *   재입력 후 해결.
 * v1.0.0 (2026-07-31)
 * - 최초 구현(수동 붙여넣기 방식 — v2.0.0에서 폐기됨).
 * ==========================================================
 */


/**
 * ==========================================================
 * Get Naver Search Ad Credentials (IO 래퍼)
 *
 * WHY
 * 자격증명은 Script Properties에서만 읽는다 — 코드/git에 절대 남기지 않기
 * 위함(사용자 확인). 값이 하나라도 없으면 명확한 안내 메시지와 함께 에러.
 * ==========================================================
 */
function getNaverSearchAdCredentials_(){

  const props = PropertiesService.getScriptProperties();
  const keys = AD.NAVER_SEARCH.API.PROPERTY_KEYS;

  const customerId = props.getProperty(keys.CUSTOMER_ID);
  const apiKey = props.getProperty(keys.API_KEY);
  const secretKey = props.getProperty(keys.SECRET_KEY);

  if(!customerId || !apiKey || !secretKey){
    throw new Error(
      "Naver Search Ad API 자격증명이 없습니다. Apps Script 편집기 " +
      "Project Settings > Script Properties에 다음 키를 추가하세요: " +
      keys.CUSTOMER_ID + ", " + keys.API_KEY + ", " + keys.SECRET_KEY
    );
  }

  return { customerId: customerId, apiKey: apiKey, secretKey: secretKey };

}


/**
 * ==========================================================
 * Compute Naver Search Ad Signature (순수 함수)
 *
 * WHY
 * 네이버 검색광고 API는 요청마다 HMAC-SHA256 서명이 필요하다(공식 샘플
 * python-sample/examples/signaturehelper.py로 확인): message =
 * "{timestamp}.{method}.{uri}"(쿼리스트링 제외, 경로만), secretKey로
 * HMAC-SHA256 해시 후 Base64 인코딩.
 *
 * INPUT
 * timestamp : string  현재 시각(ms, 문자열)
 * method : string  "GET" 등
 * uri : string  경로만(쿼리스트링 제외, 예: "/stats")
 * secretKey : string
 *
 * OUTPUT
 * string  Base64 인코딩된 서명
 * ==========================================================
 */
function computeNaverSearchAdSignature_(timestamp, method, uri, secretKey){

  const message = timestamp + "." + method + "." + uri;
  const rawSignature = Utilities.computeHmacSha256Signature(message, secretKey);

  return Utilities.base64Encode(rawSignature);

}


/**
 * ==========================================================
 * Build Naver Search Ad Query String (순수 함수)
 *
 * WHY
 * UrlFetchApp은 Python requests처럼 params 딕셔너리를 자동으로 인코딩해
 * 주지 않는다. 공식 샘플 코드(ad_management_sample.py) 기준으로 "ids"는
 * 배열 값을 반복 파라미터(ids=A&ids=B)로 보내야 하고, "fields"/"timeRange"는
 * 호출부가 미리 JSON.stringify()한 문자열을 그대로 하나의 파라미터로 보내야
 * 한다(구글 앱스 스크립트 연동 시 파라미터 인코딩 문제가 실제로 보고된 바
 * 있어, 이 함수는 배열만 반복 처리하고 그 외엔 그대로 문자열화한다 —
 * 호출부가 JSON 문자열을 만들어서 넘기는 책임을 진다).
 *
 * INPUT
 * params : Object  값이 배열이면 반복 파라미터, 그 외엔 단일 파라미터
 *
 * OUTPUT
 * string  쿼리스트링(맨 앞 "?" 제외)
 *
 * TEST
 * testBuildNaverSearchAdQueryString() 참고
 * ==========================================================
 */
function buildNaverSearchAdQueryString_(params){

  const parts = [];

  Object.keys(params || {}).forEach(function(key){

    const value = params[key];

    if(Array.isArray(value)){

      value.forEach(function(v){
        parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(v));
      });

    } else {

      parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(value));

    }

  });

  return parts.join("&");

}


/**
 * ==========================================================
 * TEST — buildNaverSearchAdQueryString_()
 * ==========================================================
 */
function testBuildNaverSearchAdQueryString(){

  const result = buildNaverSearchAdQueryString_({
    ids: ["cmp-a001-01-000000009593715", "cmp-a001-01-000000009537809"],
    fields: JSON.stringify(["salesAmt"]),
    timeRange: JSON.stringify({ since: "2026-07-01", until: "2026-07-31" })
  });

  const pass =
    result.indexOf("ids=cmp-a001-01-000000009593715") !== -1 &&
    result.indexOf("ids=cmp-a001-01-000000009537809") !== -1 &&
    result.indexOf("fields=" + encodeURIComponent('["salesAmt"]')) !== -1 &&
    result.indexOf("timeRange=" + encodeURIComponent('{"since":"2026-07-01","until":"2026-07-31"}')) !== -1;

  Logger.log("Result: " + result);
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Call Naver Search Ad API (IO 래퍼)
 *
 * WHY
 * 인증 헤더 생성 + 요청 전송을 한 곳에 모은다. 실패 상태 코드도 그대로
 * 반환(muteHttpExceptions) — 호출부/진단 함수가 statusCode를 보고 판단.
 *
 * INPUT
 * method : string  "GET" 등
 * uri : string  경로만(쿼리스트링 제외)
 * queryParams : Object  buildNaverSearchAdQueryString_() 참고
 *
 * OUTPUT
 * {statusCode:number, body:Object|string}  JSON 파싱 실패 시 body는 원문 문자열
 * ==========================================================
 */
function callNaverSearchAdApi_(method, uri, queryParams){

  const creds = getNaverSearchAdCredentials_();
  const timestamp = String(Date.now());
  const signature = computeNaverSearchAdSignature_(timestamp, method, uri, creds.secretKey);

  const queryString = buildNaverSearchAdQueryString_(queryParams);
  const url = AD.NAVER_SEARCH.API.BASE_URL + uri + (queryString ? "?" + queryString : "");

  const response = UrlFetchApp.fetch(url, {
    method: method,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "X-Timestamp": timestamp,
      "X-API-KEY": creds.apiKey,
      "X-Customer": creds.customerId,
      "X-Signature": signature
    },
    muteHttpExceptions: true
  });

  const statusCode = response.getResponseCode();
  const text = response.getContentText();

  let body;

  try {
    body = JSON.parse(text);
  } catch(e){
    body = text;
  }

  return { statusCode: statusCode, body: body };

}


/**
 * ==========================================================
 * Call Naver Search Ad API With Retry (IO 래퍼)
 *
 * WHY (2026-08-04, 실측 — Ad_Spend_Cache에서 Search 세그먼트가 통째로 빈
 * 상태로 발견)
 * `computeNaverSearchAdSpendHistorySummary_()`가 2022-09~오늘까지 매달
 * `/stats`를 반복 호출하는데(현재 기준 약 47회), `callNaverSearchAdApi_()`는
 * 상태 코드를 확인하지 않고 그대로 반환하기만 해서 그 중 한 달이라도
 * 실패하면 호출부(`fetchNaverSearchAdStats_()`의 `Array.isArray` 체크)가
 * 에러 없이 그 달만 조용히 0으로 처리하는 게 실측됨 —
 * `runComputeNaverSearchAdSpendForMonth()`(단일 달, 반복 호출 없음)는 정상
 * 동작해 API 자체/서명/`getBusinessSegment()` 분류 로직 문제가 아님을 먼저
 * 확인했음. **실제 원인 확정(2026-08-04, 재시도 도입 후 노출된 에러로 확인)**:
 * `/stats`는 "최근 730일 이내 기간만 조회 가능"이 공식 제약(400,
 * `{code:11004}`) — `BACKFILL_START`(2022-09)가 이 범위보다 훨씬 오래돼
 * 매 실행마다 오래된 달에서 필연적으로 400이 남. 재시도해도 똑같이 실패하는
 * 요청 자체의 문제이므로 **4xx(429 제외)는 재시도하지 않고 즉시 실패
 * 처리**(429/5xx만 지수 백오프 재시도) — 호출부(`computeNaverSearchAdSpendHistorySummary_()`)
 * 가 이 "조회 기간 초과"(`statusCode===400 && body.code===11004`)는 알려진
 * 제약으로 보고 그 달만 건너뛰고, 그 외 에러는 그대로 던져 전체 갱신을
 * 중단시킨다(진짜 실패를 조용히 묻지 않기 위함).
 *
 * @param {number} [maxAttempts]  기본 3회(429/5xx에만 적용)
 * ==========================================================
 */
function callNaverSearchAdApiWithRetry_(method, uri, queryParams, maxAttempts){

  const attempts = maxAttempts || 3;
  let lastResult = null;

  for(let attempt = 1; attempt <= attempts; attempt++){

    lastResult = callNaverSearchAdApi_(method, uri, queryParams);

    if(lastResult.statusCode === 200) return lastResult;

    // 429(rate limit)/5xx(서버 오류)만 재시도 대상 — 그 외 4xx(예: 400 잘못된
    // 요청)는 재시도해도 동일하게 실패하는 요청 자체의 문제라 즉시 중단.
    const isRetryable = lastResult.statusCode === 429 || lastResult.statusCode >= 500;

    if(!isRetryable || attempt === attempts) break;

    Utilities.sleep(1000 * attempt);

  }

  const error = new Error(
    "Naver Search Ad API 호출 실패(" + method + " " + uri + ", statusCode=" +
    lastResult.statusCode + "): " + JSON.stringify(lastResult.body)
  );

  error.statusCode = lastResult.statusCode;
  error.body = lastResult.body;

  throw error;

}


/**
 * ==========================================================
 * TEMP — 서명 입력값 진단 (2026-07-31)
 *
 * WHY
 * 403 invalid-signature가 Base URL 수정 후에도 재발 — Script Properties에
 * 붙여넣은 값에 보이지 않는 공백/개행이 섞였을 가능성을 확인하기 위해,
 * 자격증명 길이(및 앞뒤 3글자만 마스킹 노출)와 실제로 서명에 쓰인 메시지
 * 문자열/타임스탬프/서명값을 그대로 로그로 출력한다. 값 전체를 노출하지
 * 않아 로그를 공유해도 비교적 안전하다.
 * ==========================================================
 */
function runDebugNaverSearchAdSignatureInputs(){

  const props = PropertiesService.getScriptProperties();
  const keys = AD.NAVER_SEARCH.API.PROPERTY_KEYS;

  const customerId = props.getProperty(keys.CUSTOMER_ID);
  const apiKey = props.getProperty(keys.API_KEY);
  const secretKey = props.getProperty(keys.SECRET_KEY);

  function mask(value){
    if(!value) return "(없음)";
    if(value.length <= 8) return "len=" + value.length + " value=" + JSON.stringify(value);
    return "len=" + value.length + " head=" + JSON.stringify(value.slice(0, 4)) +
      " tail=" + JSON.stringify(value.slice(-4));
  }

  Logger.log("customerId: " + mask(customerId));
  Logger.log("apiKey: " + mask(apiKey));
  Logger.log("secretKey: " + mask(secretKey));

  const timestamp = String(Date.now());
  const method = "GET";
  const uri = "/ncc/campaigns";
  const message = timestamp + "." + method + "." + uri;
  const signature = computeNaverSearchAdSignature_(timestamp, method, uri, secretKey);

  Logger.log("message: " + JSON.stringify(message));
  Logger.log("signature: " + signature);

}


/**
 * ==========================================================
 * TEMP — 캠페인 목록 진단(GET /ncc/campaigns)
 *
 * WHY (2026-07-31)
 * 캠페인명 실제 필드 키("name"으로 추정 — /ncc/adgroups CREATE 페이로드
 * 관례로 추정, 공식 샘플에 /ncc/campaigns 응답 예시 자체는 없어 확정 아님)를
 * 실 응답으로 확인하기 위한 진단 함수. 응답 전체가 아니라 상태 코드 + 처음
 * 3개 항목만 로그로 출력.
 * ==========================================================
 */
function runDebugNaverSearchAdCampaigns(){

  const result = callNaverSearchAdApi_("GET", "/ncc/campaigns", {});

  Logger.log("statusCode: " + result.statusCode);

  if(Array.isArray(result.body)){
    Logger.log("캠페인 수: " + result.body.length);
    Logger.log("처음 3개: " + JSON.stringify(result.body.slice(0, 3), null, 2));
  } else {
    Logger.log("응답 본문(배열 아님): " + JSON.stringify(result.body, null, 2));
  }

}


/**
 * ==========================================================
 * TEMP — 지출 통계 진단(GET /stats)
 *
 * WHY (2026-07-31)
 * /stats가 캠페인 id를 어떤 키로 돌려주는지, salesAmt가 실제로 어떤 형태로
 * 오는지 실 응답으로 확인하기 위한 진단 함수. runDebugNaverSearchAdCampaigns()
 * 먼저 실행해서 실제 캠페인 ID 몇 개를 아래 sampleIds에 채워 넣고 실행할 것
 * (또는 이 함수가 자동으로 /ncc/campaigns를 먼저 호출해 앞 3개를 사용).
 *
 * 조회 기간은 이번 달(오늘 기준 1일~오늘)로 임시 설정 — 실제 검증 시 필요에
 * 따라 since/until을 직접 바꿔서 재실행.
 * ==========================================================
 */
function runDebugNaverSearchAdStats(){

  const campaignsResult = callNaverSearchAdApi_("GET", "/ncc/campaigns", {});

  if(!Array.isArray(campaignsResult.body) || campaignsResult.body.length === 0){
    Logger.log("캠페인 목록을 못 가져옴 — statusCode: " + campaignsResult.statusCode +
      ", body: " + JSON.stringify(campaignsResult.body));
    return;
  }

  const sampleIds = campaignsResult.body.slice(0, 3).map(function(c){ return c.nccCampaignId; });

  const today = new Date();
  const since = Utilities.formatDate(new Date(today.getFullYear(), today.getMonth(), 1), Session.getScriptTimeZone(), "yyyy-MM-dd");
  const until = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");

  Logger.log("sampleIds: " + JSON.stringify(sampleIds) + ", since=" + since + ", until=" + until);

  const statsResult = callNaverSearchAdApi_("GET", "/stats", {
    ids: sampleIds,
    fields: JSON.stringify(["impCnt", "clkCnt", "salesAmt"]),
    timeRange: JSON.stringify({ since: since, until: until })
  });

  Logger.log("statusCode: " + statsResult.statusCode);
  Logger.log("응답 본문: " + JSON.stringify(statsResult.body, null, 2));

}


/**
 * ==========================================================
 * TEMP — 확장 필드 진단(GET /stats, "전환수" 후보 필드 실측 — 1개씩 개별 요청)
 *
 * WHY (2026-08-05)
 * Search_OPS "Results" 컬럼을 Naver Search Ad API로 자동화할 수 있는지
 * 검토 중 — 공식 문서 사이트(naver.github.io/searchad-apidoc)가 SPA라
 * 스크레이핑으로 필드 목록을 확인할 수 없었음. impCnt/clkCnt/salesAmt는
 * 이미 확인됐으니, "전환"에 해당할 만한 필드 후보(ctr/cpc/avgRnk/ccnt/
 * ccnt1d)를 추가로 요청해 실제로 값이 오는지/에러가 나는지 실측한다.
 *
 * **1차 실행 결과(2026-08-05, 사용자 실행)**: 후보 8개를 한 번에 요청했더니
 * `{code:11001, message:"잘못된 파라미터 형식입니다."}` 400 에러 — 이 API는
 * fields 배열에 유효하지 않은 필드명이 하나라도 섞이면 요청 전체가 실패하는
 * 것으로 추정(추측, 아직 확정 아님). 어떤 필드가 문제인지 알 수 없어, 확인된
 * base(impCnt/clkCnt/salesAmt) + 후보 1개씩만 넣어 개별 요청으로 격리
 * (한 번 Run으로 5개 후보 전부 순서대로 호출, 각각의 statusCode/응답을 로그로
 * 남김 — 400이면 그 필드가 유효하지 않은 것, 200이면 유효한 것으로 판정).
 * ==========================================================
 */
function runDebugNaverSearchAdStatsExpandedFields(){

  const campaignsResult = callNaverSearchAdApi_("GET", "/ncc/campaigns", {});

  if(!Array.isArray(campaignsResult.body) || campaignsResult.body.length === 0){
    Logger.log("캠페인 목록을 못 가져옴 — statusCode: " + campaignsResult.statusCode +
      ", body: " + JSON.stringify(campaignsResult.body));
    return;
  }

  const sampleIds = campaignsResult.body.slice(0, 3).map(function(c){ return c.nccCampaignId; });

  const today = new Date();
  const since = Utilities.formatDate(new Date(today.getFullYear(), today.getMonth(), 1), Session.getScriptTimeZone(), "yyyy-MM-dd");
  const until = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");

  Logger.log("sampleIds: " + JSON.stringify(sampleIds) + ", since=" + since + ", until=" + until);

  const baseFields = ["impCnt", "clkCnt", "salesAmt"];
  const candidateFields = ["ctr", "cpc", "avgRnk", "ccnt", "ccnt1d"];

  candidateFields.forEach(function(candidate){

    const fields = baseFields.concat([candidate]);

    const statsResult = callNaverSearchAdApi_("GET", "/stats", {
      ids: sampleIds,
      fields: JSON.stringify(fields),
      timeRange: JSON.stringify({ since: since, until: until })
    });

    Logger.log(
      "--- 후보 필드: " + candidate + " ---\n" +
      "statusCode: " + statsResult.statusCode + "\n" +
      "응답 본문: " + JSON.stringify(statsResult.body, null, 2)
    );

  });

}


/**
 * ==========================================================
 * TEMP — ccnt/salesAmt 조회 가능 기간 진단(GET /stats, impCnt/clkCnt 제외)
 *
 * WHY (2026-08-05)
 * Search_OPS Spent/Results가 캠페인 시작일(2025년 중반)부터가 아니라 최근
 * 90일치만 반영돼 사용자가 금액이 작다고 지적 — 원인은 92일 제약이 있는
 * impCnt/clkCnt를 salesAmt/ccnt와 같은 호출에 묶어서 요청했기 때문(salesAmt
 * 단독은 이미 Ad_Spend_Cache 파이프라인에서 730일까지 조회 가능함이 확인돼
 * 있음, `fetchNaverSearchAdStats_()` 참고). ccnt도 salesAmt와 같은 730일
 * 허용 범위를 공유하는지, 아니면 impCnt/clkCnt처럼 92일로 별도 제한되는지는
 * 아직 미확인 — impCnt/clkCnt를 완전히 빼고 salesAmt+ccnt만 92일보다 긴
 * 기간(400일)으로 요청해 실측한다. 200이면 92일보다 넓은 범위 허용 확정
 * (정확한 상한은 몰라도 무방 — 기존 salesAmt 월별 백필 패턴처럼 매달
 * 반복 호출하다 11004 뜨는 달만 건너뛰면 됨), 400이면 ccnt도 92일
 * 제약이라는 뜻.
 * ==========================================================
 */
function runDebugNaverSearchAdStatsCcntRangeLimit(){

  const campaignsResult = callNaverSearchAdApi_("GET", "/ncc/campaigns", {});

  if(!Array.isArray(campaignsResult.body) || campaignsResult.body.length === 0){
    Logger.log("캠페인 목록을 못 가져옴 — statusCode: " + campaignsResult.statusCode +
      ", body: " + JSON.stringify(campaignsResult.body));
    return;
  }

  const sampleIds = campaignsResult.body.slice(0, 3).map(function(c){ return c.nccCampaignId; });

  const today = todayDateString_();
  const since400 = shiftDateString_(today, -399);

  Logger.log("sampleIds: " + JSON.stringify(sampleIds) + ", since=" + since400 + ", until=" + today + " (400일 범위)");

  const statsResult = callNaverSearchAdApi_("GET", "/stats", {
    ids: sampleIds,
    fields: JSON.stringify(["salesAmt", "ccnt"]),
    timeRange: JSON.stringify({ since: since400, until: today })
  });

  Logger.log("statusCode: " + statsResult.statusCode);
  Logger.log("응답 본문: " + JSON.stringify(statsResult.body, null, 2));

}


/**
 * ==========================================================
 * Build Calendar Month Range (순수 함수)
 *
 * WHY
 * 네이버 API에 보낼 since/until("yyyy-MM-dd")을 연/월로부터 만든다. Date
 * 객체는 "그 달이 며칠까지 있는지" 계산 용도로만 쓰고(로컬 달력 계산이라
 * 타임존 변환이 개입하지 않음 — 외부에서 읽은 날짜 셀을 다루는 게 아니라
 * 순수 계산이라 이전에 겪은 타임존 버그 클래스와 무관), 문자열은 직접
 * 조립해서 어떤 형태의 타임존 이슈도 배제한다.
 *
 * INPUT
 * year : number
 * month : number  1~12
 *
 * OUTPUT
 * {since:string, until:string}  둘 다 "yyyy-MM-dd"
 *
 * TEST
 * testBuildCalendarMonthRange() 참고
 * ==========================================================
 */
function buildCalendarMonthRange_(year, month){

  function pad2(n){ return (n < 10 ? "0" : "") + n; }

  const since = year + "-" + pad2(month) + "-01";
  const lastDay = new Date(year, month, 0).getDate();
  const until = year + "-" + pad2(month) + "-" + pad2(lastDay);

  return { since: since, until: until };

}


/**
 * ==========================================================
 * TEST — buildCalendarMonthRange_()
 * ==========================================================
 */
function testBuildCalendarMonthRange(){

  const jul = buildCalendarMonthRange_(2026, 7);
  const julPass = jul.since === "2026-07-01" && jul.until === "2026-07-31";

  Logger.log("2026-07: " + JSON.stringify(jul) + " (expected 07-01~07-31)");
  Logger.log(julPass ? "✅ PASS" : "❌ FAIL");

  // 2026년은 윤년 아님 — 2월 28일까지
  const feb = buildCalendarMonthRange_(2026, 2);
  const febPass = feb.since === "2026-02-01" && feb.until === "2026-02-28";

  Logger.log("2026-02: " + JSON.stringify(feb) + " (expected 02-01~02-28, 평년)");
  Logger.log(febPass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Naver Search Ad Spend By FY/Month/Segment (순수 함수)
 *
 * WHY
 * /ncc/campaigns(id→name 매핑)와 /stats(id별 salesAmt) 응답을 조인해
 * (FY|Month|Segment) 키로 합산한다 — Meta 파이프라인의
 * aggregateMetaSpendByFYMonthSegment_()와 동일한 출력 형태.
 *
 * INPUT
 * campaignMap : Object  {nccCampaignId: name}
 * statsRows : Array<{id, salesAmt, ...}>  /stats 응답의 data 배열
 * referenceDate : Date  이 조회 기간을 대표하는 날짜(그 달의 아무 날, FY/Month
 *   라벨 계산용 — 달력 계산이라 타임존 무관하게 안전)
 *
 * OUTPUT
 * Object  키 "fy|month|segment" → 합산 Spent(원)
 *
 * TEST
 * testComputeNaverSearchAdSpendByFYMonthSegment() 참고
 * ==========================================================
 */
function computeNaverSearchAdSpendByFYMonthSegment_(campaignMap, statsRows, referenceDate){

  const fy = Number(getFiscalYear(referenceDate).replace("FY", ""));
  const month = getFiscalMonthLabel(referenceDate);

  const totals = {};

  statsRows.forEach(function(row){

    const name = campaignMap[row.id];

    if(!name) return;

    const segment = getBusinessSegment(name, "", AD.NAVER_SEARCH.LEAD_SOURCE_OVERRIDE, "");
    const key = fy + "|" + month + "|" + segment;

    totals[key] = (totals[key] || 0) + (Number(row.salesAmt) || 0);

  });

  return totals;

}


/**
 * ==========================================================
 * TEST — computeNaverSearchAdSpendByFYMonthSegment_()
 * ==========================================================
 */
function testComputeNaverSearchAdSpendByFYMonthSegment(){

  const campaignMap = {
    "cmp-a001-01-000000009593715": "KR_core_HStoDS_contact",     // Search(override)
    "cmp-a001-01-000000009537809": "KR_core_competitions_contact", // Search(override)
    "cmp-a001-01-000000010516912": "KR_core_expo_earlybird2_ptc"   // Seminar(확정 신호)
  };

  const statsRows = [
    { id: "cmp-a001-01-000000009593715", salesAmt: 3765 },
    { id: "cmp-a001-01-000000009537809", salesAmt: 7245 },
    { id: "cmp-a001-01-000000010516912", salesAmt: 1000 },
    { id: "cmp-a001-01-999999999999999", salesAmt: 999 } // campaignMap에 없는 id — 무시돼야 함
  ];

  const result = computeNaverSearchAdSpendByFYMonthSegment_(
    campaignMap, statsRows, new Date(2026, 6, 15) // 2026-07-15
  );

  const pass =
    result["26|JUL|Search"] === (3765 + 7245) &&
    result["26|JUL|Seminar"] === 1000 &&
    Object.keys(result).length === 2;

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Fetch NaverSA Campaign Map (IO 래퍼)
 * ==========================================================
 */
function fetchNaverSearchAdCampaignMap_(){

  const result = callNaverSearchAdApiWithRetry_("GET", "/ncc/campaigns", {});
  const map = {};

  if(Array.isArray(result.body)){
    result.body.forEach(function(c){ map[c.nccCampaignId] = c.name; });
  }

  return map;

}


/**
 * ==========================================================
 * Fetch NaverSA Stats (IO 래퍼)
 *
 * WHY
 * ids가 비어있으면 API 호출 자체를 생략(빈 계정/신규 상태 방어).
 * ==========================================================
 */
function fetchNaverSearchAdStats_(ids, since, until){

  if(!ids || ids.length === 0) return [];

  const result = callNaverSearchAdApiWithRetry_("GET", "/stats", {
    ids: ids,
    fields: JSON.stringify(["salesAmt"]),
    timeRange: JSON.stringify({ since: since, until: until })
  });

  return (result.body && Array.isArray(result.body.data)) ? result.body.data : [];

}


/**
 * ==========================================================
 * Compute NaverSA Spend Summary For Month (IO 래퍼)
 * ==========================================================
 */
function computeNaverSearchAdSpendSummaryForMonth_(year, month){

  const range = buildCalendarMonthRange_(year, month);
  const campaignMap = fetchNaverSearchAdCampaignMap_();
  const ids = Object.keys(campaignMap);
  const statsRows = fetchNaverSearchAdStats_(ids, range.since, range.until);
  const referenceDate = new Date(year, month - 1, 1);

  return computeNaverSearchAdSpendByFYMonthSegment_(campaignMap, statsRows, referenceDate);

}


/**
 * ==========================================================
 * TEMP — computeNaverSearchAdSpendSummaryForMonth_() 수동 실행/확인용 진입점
 *
 * WHY
 * year/month는 함수 상단 상수를 직접 수정해서 원하는 달로 재실행
 * (runDebugMetaSpendByCampaignForMonth()와 동일 관례).
 * ==========================================================
 */
function runComputeNaverSearchAdSpendForMonth(){

  const year = 2026;
  const month = 7;

  const summary = computeNaverSearchAdSpendSummaryForMonth_(year, month);

  Logger.log("FY/Month/Segment별 Spent(원): " + JSON.stringify(summary, null, 2));

}


/**
 * ==========================================================
 * Generate Calendar Month Sequence (순수 함수)
 *
 * WHY
 * 소급 백필 범위(시작 연/월 ~ 종료 연/월, 양끝 포함)를 달력월 단위로
 * 나열한다 — buildCalendarMonthRange_()에 하나씩 넘겨 API를 반복 호출하기
 * 위함. Meta의 generateAdSpendMonthRange_()(AD_002_Meta.js)는 FY/Month
 * 라벨을 만드는 함수라 목적이 달라 재사용 불가(이건 달력 연/월 튜플 필요).
 *
 * INPUT
 * startYear/startMonth/endYear/endMonth : number  month는 1~12
 *
 * OUTPUT
 * Array<{year:number, month:number}>  오름차순, 유효하지 않은 범위(끝이
 * 시작보다 이전)면 빈 배열
 *
 * TEST
 * testGenerateCalendarMonthSequence() 참고
 * ==========================================================
 */
function generateCalendarMonthSequence_(startYear, startMonth, endYear, endMonth){

  const sequence = [];

  let year = startYear;
  let month = startMonth;

  const startIndex = startYear * 12 + startMonth;
  const endIndex = endYear * 12 + endMonth;

  if(endIndex < startIndex) return sequence;

  while(year * 12 + month <= endIndex){

    sequence.push({ year: year, month: month });

    month++;
    if(month > 12){ month = 1; year++; }

  }

  return sequence;

}


/**
 * ==========================================================
 * TEST — generateCalendarMonthSequence_()
 * ==========================================================
 */
function testGenerateCalendarMonthSequence(){

  const result = generateCalendarMonthSequence_(2022, 11, 2023, 2);
  const labels = result.map(function(r){ return r.year + "-" + r.month; });

  const pass =
    labels.length === 4 &&
    labels[0] === "2022-11" &&
    labels[3] === "2023-2";

  Logger.log("Result: " + JSON.stringify(labels));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

  const invalid = generateCalendarMonthSequence_(2023, 2, 2022, 11);

  Logger.log("Invalid range length: " + invalid.length + " (expected 0)");
  Logger.log(invalid.length === 0 ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute NaverSA Spend History Summary (IO 래퍼)
 *
 * WHY
 * ACQ_REP 전체 이력 반영을 위해, 캠페인 목록은 한 번만 조회하고(API 호출
 * 절약) 시작 연/월부터 오늘이 속한 달까지 매달 /stats를 호출해 합산한다.
 *
 * WHY (2026-08-04 — "조회 기간 초과" 달 건너뛰기)
 * Naver Search Ad API `/stats`는 "최근 730일 이내 기간만 조회 가능"이 공식
 * 제약(실측: 400, `{code:11004}`) — `BACKFILL_START`(2022-09)가 이 범위보다
 * 훨씬 오래돼 매 실행마다 오래된 달에서 필연적으로 이 에러가 남(Meta는
 * 사용자가 수동 export하는 방식이라 이 제약이 없어 같은 소급 범위를 그대로
 * 가져왔던 게 원인). 이 특정 에러(알려진 플랫폼 제약, 버그 아님)만 그 달을
 * 건너뛰고 계속 진행 — 그 외 에러(인증 실패 등 진짜 문제)는 그대로 던져
 * 전체 갱신을 중단시킨다.
 *
 * INPUT
 * startYear/startMonth : number  AD.NAVER_SEARCH.API.BACKFILL_START 참고
 *
 * OUTPUT
 * Object  키 "fy|month|segment" → 합산 Spent(원, KRW)
 * ==========================================================
 */
function computeNaverSearchAdSpendHistorySummary_(startYear, startMonth){

  const campaignMap = fetchNaverSearchAdCampaignMap_();
  const ids = Object.keys(campaignMap);

  const today = new Date();
  const months = generateCalendarMonthSequence_(
    startYear, startMonth, today.getFullYear(), today.getMonth() + 1
  );

  const totals = {};

  months.forEach(function(m){

    const range = buildCalendarMonthRange_(m.year, m.month);

    let statsRows;

    try {
      statsRows = fetchNaverSearchAdStats_(ids, range.since, range.until);
    } catch(e){

      if(e.statusCode === 400 && e.body && e.body.code === 11004){

        Logger.log(
          m.year + "-" + m.month + " 건너뜀(Naver Search Ad API 조회 가능 기간 " +
          "밖 — 최근 730일 이내만 조회 가능)."
        );

        return;

      }

      throw e;

    }

    const referenceDate = new Date(m.year, m.month - 1, 1);
    const monthTotals = computeNaverSearchAdSpendByFYMonthSegment_(campaignMap, statsRows, referenceDate);

    Object.keys(monthTotals).forEach(function(key){
      totals[key] = (totals[key] || 0) + monthTotals[key];
    });

  });

  return totals;

}


/**
 * ==========================================================
 * Build Calendar Week Range (순수 함수)
 *
 * WHY
 * buildCalendarMonthRange_()의 주(월~일) 버전 — 네이버 API `/stats`가
 * since/until을 임의 문자열 기간으로 그대로 받으므로(달력월 정렬 제약 없음,
 * `fetchNaverSearchAdStats_()` 참고) 월요일부터 그 주 일요일까지의 문자열을
 * 만들면 된다. `addDaysToDate_()`(TARGET_001_Engine.js, 전역) 재사용.
 *
 * INPUT
 * weekStart : Date  그 주의 월요일(시각 없음)
 *
 * OUTPUT
 * {since:string, until:string}  둘 다 "yyyy-MM-dd"
 *
 * TEST
 * testBuildCalendarWeekRange() 참고
 * ==========================================================
 */
function buildCalendarWeekRange_(weekStart){

  function pad2(n){ return (n < 10 ? "0" : "") + n; }
  function fmt(d){ return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }

  const weekEnd = addDaysToDate_(weekStart, 6);

  return { since: fmt(weekStart), until: fmt(weekEnd) };

}


/**
 * ==========================================================
 * TEST — buildCalendarWeekRange_()
 * ==========================================================
 */
function testBuildCalendarWeekRange(){

  const result = buildCalendarWeekRange_(new Date(2026, 7, 3)); // 2026-08-03(월)
  const pass = result.since === "2026-08-03" && result.until === "2026-08-09";

  Logger.log("Result: " + JSON.stringify(result) + " (expected 08-03~08-09)");
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Naver Search Ad Spend By Week/Segment (순수 함수)
 *
 * WHY
 * computeNaverSearchAdSpendByFYMonthSegment_()의 주 버전 — referenceDate(그
 * 달 대표일)로 fy|month 라벨을 만들던 것과 달리, weekStart를 "yyyy-MM-dd"
 * 문자열 그대로 키에 쓴다(Target_REP 리포트 행의 Week Start와 1:1 매칭시키기
 * 위함 — 월 라벨 같은 중간 표현이 필요 없음).
 *
 * INPUT
 * campaignMap : Object  {nccCampaignId: name}
 * statsRows : Array<{id, salesAmt, ...}>  /stats 응답의 data 배열
 * weekStart : Date  이 조회에 쓴 주의 월요일
 *
 * OUTPUT
 * Object  키 "yyyy-MM-dd(weekStart)|segment" → 합산 Spent(원)
 *
 * TEST
 * testComputeNaverSearchAdSpendByWeekSegment() 참고
 * ==========================================================
 */
function computeNaverSearchAdSpendByWeekSegment_(campaignMap, statsRows, weekStart){

  const weekKey = Utilities.formatDate(weekStart, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd");
  const totals = {};

  statsRows.forEach(function(row){

    const name = campaignMap[row.id];

    if(!name) return;

    const segment = getBusinessSegment(name, "", AD.NAVER_SEARCH.LEAD_SOURCE_OVERRIDE, "");
    const key = weekKey + "|" + segment;

    totals[key] = (totals[key] || 0) + (Number(row.salesAmt) || 0);

  });

  return totals;

}


/**
 * ==========================================================
 * TEST — computeNaverSearchAdSpendByWeekSegment_()
 * ==========================================================
 */
function testComputeNaverSearchAdSpendByWeekSegment(){

  const campaignMap = {
    "cmp-a001-01-000000009593715": "KR_core_HStoDS_contact",
    "cmp-a001-01-000000010516912": "KR_core_expo_earlybird2_ptc"
  };

  const statsRows = [
    { id: "cmp-a001-01-000000009593715", salesAmt: 3765 },
    { id: "cmp-a001-01-000000010516912", salesAmt: 1000 },
    { id: "cmp-a001-01-999999999999999", salesAmt: 999 } // campaignMap에 없는 id — 무시돼야 함
  ];

  const result = computeNaverSearchAdSpendByWeekSegment_(
    campaignMap, statsRows, new Date(2026, 7, 3) // 2026-08-03(월)
  );

  const pass =
    result["2026-08-03|Search"] === 3765 &&
    result["2026-08-03|Seminar"] === 1000 &&
    Object.keys(result).length === 2;

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute NaverSA Spend History Weekly Summary (IO 래퍼)
 *
 * WHY
 * computeNaverSearchAdSpendHistorySummary_()(월 단위, 전체 소급)와 달리
 * Target 주 사이클 전환일(Cutover Date)부터 오늘까지만 주 단위로 순회한다 —
 * Naver는 API로 임의 기간을 정확히 조회하므로 근사 없는 참값이지만, 전체
 * 3년 이력을 주 단위(월 단위 대비 약 4배 호출 수)로 백필할 이유가 없다
 * (Target_REP은 Cutover Date 이전 주는 원래 공란 규칙 — §8, 이 소급 범위
 * 축소가 자연스럽게 그 규칙과 일치). 92일 조회 제약(salesAmt는 730일까지
 * 확인됨, v2.14.0 changelog 참고)에도 여유 있게 안전한 범위.
 *
 * INPUT
 * cutoverMonday : Date  Target_Engine Cutover Date가 속한 주의 월요일
 *
 * OUTPUT
 * Object  키 "yyyy-MM-dd(weekStart)|segment" → 합산 Spent(원, KRW)
 * ==========================================================
 */
function computeNaverSearchAdSpendHistoryWeeklySummary_(cutoverMonday){

  const campaignMap = fetchNaverSearchAdCampaignMap_();
  const ids = Object.keys(campaignMap);

  const today = new Date();
  const weeks = generateAdSpendWeekRange_(cutoverMonday, today);

  const totals = {};

  weeks.forEach(function(w){

    const range = buildCalendarWeekRange_(w.weekStart);

    let statsRows;

    try {
      statsRows = fetchNaverSearchAdStats_(ids, range.since, range.until);
    } catch(e){

      if(e.statusCode === 400 && e.body && e.body.code === 11004){

        Logger.log(
          range.since + "~" + range.until + " 건너뜀(Naver Search Ad API 조회 가능 기간 밖)."
        );

        return;

      }

      throw e;

    }

    const weekTotals = computeNaverSearchAdSpendByWeekSegment_(campaignMap, statsRows, w.weekStart);

    Object.keys(weekTotals).forEach(function(key){
      totals[key] = (totals[key] || 0) + weekTotals[key];
    });

  });

  return totals;

}


/**
 * ==========================================================
 * TEMP — computeNaverSearchAdSpendHistoryWeeklySummary_() 수동 실행/확인용 진입점
 * ==========================================================
 */
function runComputeNaverSearchAdSpendWeeklyHistory(){

  const cutoverMonday = getMondayOfWeek_(CONFIG.TARGET.CUTOVER_DATE);
  const summary = computeNaverSearchAdSpendHistoryWeeklySummary_(cutoverMonday);

  Logger.log(JSON.stringify(summary, null, 2));

}


/**
 * ==========================================================
 * Today Date String (순수 함수, yyyy-MM-dd)
 *
 * WHY
 * `buildCalendarMonthRange_()`와 동일한 이유로 Date 객체를 로컬 연/월/일
 * 컴포넌트 읽기 용도로만 쓰고 문자열은 직접 조립 — 외부 스프레드시트 셀을
 * 읽는 게 아니라 스크립트 실행 시각 자체이므로 타임존 버그 클래스와 무관.
 * ==========================================================
 */
function todayDateString_(){

  const now = new Date();

  function pad2(n){ return (n < 10 ? "0" : "") + n; }

  return now.getFullYear() + "-" + pad2(now.getMonth() + 1) + "-" + pad2(now.getDate());

}


/**
 * ==========================================================
 * Shift Date String (순수 함수, "yyyy-MM-dd" ± N일)
 *
 * WHY
 * 문자열을 `new Date(dateStr)`로 직접 파싱하면 UTC 자정으로 해석돼(로컬
 * 타임존에 따라 하루 밀리는) 이 프로젝트가 반복적으로 겪은 타임존 버그
 * 클래스에 해당 — 연/월/일을 직접 분해해 `new Date(y, m, d)`(로컬 자정)로
 * 만든 뒤 setDate()로 이동, 다시 로컬 컴포넌트로 조립해서 반환.
 *
 * INPUT
 * dateStr : string  "yyyy-MM-dd"
 * deltaDays : number  양수/음수 모두 허용
 *
 * OUTPUT
 * string  "yyyy-MM-dd"
 *
 * TEST
 * testShiftDateString() 참고
 * ==========================================================
 */
function shiftDateString_(dateStr, deltaDays){

  const parts = dateStr.split("-").map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);

  d.setDate(d.getDate() + deltaDays);

  function pad2(n){ return (n < 10 ? "0" : "") + n; }

  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());

}


/**
 * ==========================================================
 * TEST — shiftDateString_()
 * ==========================================================
 */
function testShiftDateString(){

  const pass =
    shiftDateString_("2026-08-05", 1) === "2026-08-06" &&
    shiftDateString_("2026-08-05", -1) === "2026-08-04" &&
    shiftDateString_("2026-08-31", 1) === "2026-09-01" &&
    shiftDateString_("2026-01-01", -1) === "2025-12-31" &&
    shiftDateString_("2026-08-05", 0) === "2026-08-05";

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Naver Search Ad Campaign Stats Fetch Window (순수 함수)
 *
 * WHY (2026-08-05, 누적 캐시 설계 — 사용자 확정)
 * "지난 갱신(`lastFetchedThroughStr`) 다음날 ~ 오늘"만 조회해 기존 누적치에
 * 더하는 방식 — 이미 캐시에 반영된 값은 절대 다시 조회할 필요가 없다.
 *
 * **실측 정정(2026-08-05)**: impCnt/clkCnt 필드는 salesAmt와 별개로 "최근
 * 92일 이내"만 조회 가능함이 실 API 에러로 확인됨(`AD_001_Config.js`
 * `NAVER_SEARCH_CAMPAIGN_STATS` 주석 참고, 애초 가정했던 730일이 아님) —
 * `maxRangeDays`(권장 90, 92일보다 이틀 여유)로 `since`를 **항상 사전에**
 * `[today - maxRangeDays + 1, today]` 범위 안으로 clamp한다(캐시가 없는
 * 최초 실행이든, 오래 못 돌다가 재개되는 경우든 동일 로직 하나로 처리 —
 * 사후 에러 캐치/재시도가 아니라 애초에 범위 초과 요청 자체를 안 만듦).
 *
 * 같은 날 여러 번 실행돼도(예: Leads Import 직후 MTA Import) 두 번째부터는
 * `since`가 `until`보다 미래가 되어 `shouldFetch:false`로 스킵 — 같은 날
 * 데이터를 중복으로 더하는 걸 방지(당일 내 증분은 다음날 반영됨, 사용자
 * 확정 트레이드오프).
 *
 * INPUT
 * lastFetchedThroughStr : string|null  마지막으로 성공 반영한 until 값
 *   ("yyyy-MM-dd"), 최초 실행이면 null/빈 문자열
 * todayStr : string  "yyyy-MM-dd" (todayDateString_() 결과 주입)
 * maxRangeDays : number  API가 허용하는 최대 조회 범위(오늘 포함 일수)
 *
 * OUTPUT
 * { since:string, until:string, shouldFetch:boolean }
 *
 * TEST
 * testComputeNaverSearchAdCampaignStatsFetchWindow() 참고
 * ==========================================================
 */
function computeNaverSearchAdCampaignStatsFetchWindow_(lastFetchedThroughStr, todayStr, maxRangeDays){

  const earliestAllowed = shiftDateString_(todayStr, -(maxRangeDays - 1));

  let since = lastFetchedThroughStr
    ? shiftDateString_(lastFetchedThroughStr, 1)
    : earliestAllowed;

  if(since < earliestAllowed) since = earliestAllowed;

  return { since: since, until: todayStr, shouldFetch: since <= todayStr };

}


/**
 * ==========================================================
 * TEST — computeNaverSearchAdCampaignStatsFetchWindow_()
 * ==========================================================
 */
function testComputeNaverSearchAdCampaignStatsFetchWindow(){

  const firstRun = computeNaverSearchAdCampaignStatsFetchWindow_(null, "2026-08-05", 90);
  const firstRunPass =
    firstRun.since === "2026-05-08" &&
    firstRun.until === "2026-08-05" &&
    firstRun.shouldFetch === true;

  const incremental = computeNaverSearchAdCampaignStatsFetchWindow_("2026-08-04", "2026-08-05", 90);
  const incrementalPass =
    incremental.since === "2026-08-05" &&
    incremental.shouldFetch === true;

  const sameDayRerun = computeNaverSearchAdCampaignStatsFetchWindow_("2026-08-05", "2026-08-05", 90);
  const sameDayRerunPass =
    sameDayRerun.since === "2026-08-06" &&
    sameDayRerun.shouldFetch === false;

  // 오래 못 돌다가 재개되는 경우(예: 자격증명 만료 몇 달) — since가 API
  // 허용 범위보다 오래됐으면 earliestAllowed로 clamp돼야 함(11004 재발 방지).
  const staleResume = computeNaverSearchAdCampaignStatsFetchWindow_("2025-01-01", "2026-08-05", 90);
  const staleResumePass =
    staleResume.since === "2026-05-08" &&
    staleResume.shouldFetch === true;

  const pass = firstRunPass && incrementalPass && sameDayRerunPass && staleResumePass;

  Logger.log(
    "firstRun=" + JSON.stringify(firstRun) +
    " incremental=" + JSON.stringify(incremental) +
    " sameDayRerun=" + JSON.stringify(sameDayRerun) +
    " staleResume=" + JSON.stringify(staleResume)
  );
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Accumulate Naver Search Ad Campaign Stats (순수 함수)
 *
 * WHY
 * 기존 누적 캐시(`existingTotals`) 위에 이번 조회 구간의 impCnt/clkCnt/
 * salesAmt/ccnt를 캠페인 "이름"(id→name은 campaignMap으로 조인) 기준으로
 * 더한다(2026-08-05: salesAmt/spentKrw 추가 — Search_OPS "Spent" 컬럼
 * 자동화, ccnt/results 추가 — "Results" 컬럼 자동화, 둘 다 사용자 요청).
 * ccnt는 Naver 실측 확인 결과 항상 clkCnt 이하 값으로 응답돼 "전환수"로
 * 판단(사용자 확인, `runDebugNaverSearchAdStatsExpandedFields()` 실측).
 * 입력을 변형하지 않고 새 객체를 반환.
 *
 * INPUT
 * existingTotals : Object  {campaignName: {impressions, clicks, spentKrw, results}}
 * campaignMap : Object  {nccCampaignId: name}
 * statsRows : Array<{id, impCnt, clkCnt, salesAmt, ccnt}>
 *
 * OUTPUT
 * Object  {campaignName: {impressions, clicks, spentKrw, results}}  (새 객체,
 *   spentKrw는 원 단위 KRW 원본 — NZD 변환은 72_Search_Build.js가 IO
 *   경계에서 수행. results는 통화와 무관해 변환 없이 그대로 사용)
 *
 * TEST
 * testAccumulateNaverSearchAdCampaignStats() 참고
 * ==========================================================
 */
function accumulateNaverSearchAdCampaignStats_(existingTotals, campaignMap, statsRows){

  const totals = {};

  Object.keys(existingTotals || {}).forEach(function(name){
    totals[name] = {
      impressions: (existingTotals[name] && existingTotals[name].impressions) || 0,
      clicks: (existingTotals[name] && existingTotals[name].clicks) || 0,
      spentKrw: (existingTotals[name] && existingTotals[name].spentKrw) || 0,
      results: (existingTotals[name] && existingTotals[name].results) || 0
    };
  });

  (statsRows || []).forEach(function(row){

    const name = campaignMap[row.id];

    if(!name) return;

    if(!totals[name]) totals[name] = { impressions: 0, clicks: 0, spentKrw: 0, results: 0 };

    totals[name].impressions += Number(row.impCnt) || 0;
    totals[name].clicks += Number(row.clkCnt) || 0;
    totals[name].spentKrw += Number(row.salesAmt) || 0;
    totals[name].results += Number(row.ccnt) || 0;

  });

  return totals;

}


/**
 * ==========================================================
 * TEST — accumulateNaverSearchAdCampaignStats_()
 * ==========================================================
 */
function testAccumulateNaverSearchAdCampaignStats(){

  const existingTotals = {
    "2025-07-KOR-Naver SA Brand": { impressions: 100, clicks: 10, spentKrw: 1000, results: 4 }
  };

  const campaignMap = {
    "cmp-001": "2025-07-KOR-Naver SA Brand",
    "cmp-002": "2025-07-KOR-Naver SA ECL"
  };

  const statsRows = [
    { id: "cmp-001", impCnt: 50, clkCnt: 5, salesAmt: 500, ccnt: 2 },
    { id: "cmp-002", impCnt: 20, clkCnt: 2, salesAmt: 300, ccnt: 1 },
    { id: "cmp-999", impCnt: 999, clkCnt: 999, salesAmt: 999, ccnt: 999 } // campaignMap에 없음 — 무시돼야 함
  ];

  const result = accumulateNaverSearchAdCampaignStats_(existingTotals, campaignMap, statsRows);

  const pass =
    result["2025-07-KOR-Naver SA Brand"].impressions === 150 &&
    result["2025-07-KOR-Naver SA Brand"].clicks === 15 &&
    result["2025-07-KOR-Naver SA Brand"].spentKrw === 1500 &&
    result["2025-07-KOR-Naver SA Brand"].results === 6 &&
    result["2025-07-KOR-Naver SA ECL"].impressions === 20 &&
    result["2025-07-KOR-Naver SA ECL"].clicks === 2 &&
    result["2025-07-KOR-Naver SA ECL"].spentKrw === 300 &&
    result["2025-07-KOR-Naver SA ECL"].results === 1 &&
    Object.keys(result).length === 2 &&
    existingTotals["2025-07-KOR-Naver SA Brand"].impressions === 100; // 입력 불변 확인

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Fetch NaverSA Impressions/Clicks/Spend/Results Stats (IO 래퍼)
 *
 * WHY
 * `fetchNaverSearchAdStats_()`(salesAmt 전용, Ad_Spend_Cache의 FY|Month|
 * Segment 집계 파이프라인 소유)는 건드리지 않고 별도 함수로 분리 — 캠페인
 * 통계 캐시가 요청하는 필드가 다르고(2026-08-05: Search_OPS "Spent"/"Results"
 * 자동화로 salesAmt/ccnt 추가 — impCnt/clkCnt와 같은 호출에 넣어도 안전함,
 * salesAmt/ccnt 둘 다 `runDebugNaverSearchAdStatsExpandedFields()` 실측으로
 * 92일 윈도우 안에서 200 정상 응답 확인됨), 실패 시 처리 방식(호출부가
 * 730일 제약과 무관하도록 설계돼 있어 굳이 11004 특수 처리 불필요)도 다름.
 * ==========================================================
 */
function fetchNaverSearchAdImpressionsClicksStats_(ids, since, until){

  if(!ids || ids.length === 0) return [];

  const result = callNaverSearchAdApiWithRetry_("GET", "/stats", {
    ids: ids,
    fields: JSON.stringify(["impCnt", "clkCnt", "salesAmt", "ccnt"]),
    timeRange: JSON.stringify({ since: since, until: until })
  });

  return (result.body && Array.isArray(result.body.data)) ? result.body.data : [];

}


/**
 * ==========================================================
 * Campaign Stats Cache Sheet IO (읽기/쓰기)
 *
 * WHY
 * Ad_Spend_Cache/Search_Engine과 동일 패턴(메인 스프레드시트 안 숨김
 * 시트) — Naver API 자격증명 없이도(Simple Trigger 등) 캐시된 값만
 * 읽을 수 있게 분리. "Spent (KRW)"는 원본 그대로 저장(NZD 변환은
 * 72_Search_Build.js가 IO 경계에서 수행 — Ad_Spend_Cache와 달리 이 캐시는
 * 증분 누적이라, 변환 전 원본을 보존해야 재계산/검증이 쉬움). "Results"는
 * 통화가 없어 변환 없이 그대로 저장/사용.
 * ==========================================================
 */
const NAVER_CAMPAIGN_STATS_CACHE_HEADERS = ["Campaign Name", "Impressions", "Link Clicks", "Spent (KRW)", "Results"];


/**
 * ==========================================================
 * Open Naver Search Campaign Stats Cache External Spreadsheet (IO 래퍼)
 *
 * WHY
 * CONFIG.AD.NAVER_SEARCH_CAMPAIGN_STATS.EXTERNAL.SPREADSHEET_ID가 비어있으면
 * 추측으로 진행하지 않고 명시적 에러로 실패한다("No Assumptions" 원칙,
 * MASTER_010_SALSync.js의 openSALExternalSpreadsheet_()와 동일 패턴).
 * ==========================================================
 */
function openNaverSearchCampaignStatsCacheExternalSpreadsheet_(){

  const spreadsheetId = AD.NAVER_SEARCH_CAMPAIGN_STATS.EXTERNAL.SPREADSHEET_ID;

  if(!spreadsheetId){
    throw new Error(
      "AD.NAVER_SEARCH_CAMPAIGN_STATS.EXTERNAL.SPREADSHEET_ID가 비어있습니다 — " +
      "AD_001_Config.js를 먼저 확인하세요."
    );
  }

  return SpreadsheetApp.openById(spreadsheetId);

}


function readNaverSearchAdCampaignStatsCache_(){

  const ss = openNaverSearchCampaignStatsCacheExternalSpreadsheet_();
  const sheet = ss.getSheetByName(AD.NAVER_SEARCH_CAMPAIGN_STATS.CACHE_SHEET);

  const map = {};

  if(!sheet) return map;

  const values = sheet.getDataRange().getValues();

  for(let i = 1; i < values.length; i++){

    const name = String(values[i][0] || "").trim();

    if(!name) continue;

    map[name] = {
      impressions: Number(values[i][1]) || 0,
      clicks: Number(values[i][2]) || 0,
      spentKrw: Number(values[i][3]) || 0,
      results: Number(values[i][4]) || 0
    };

  }

  return map;

}


function writeNaverSearchAdCampaignStatsCache_(totals){

  const ss = openNaverSearchCampaignStatsCacheExternalSpreadsheet_();
  let sheet = ss.getSheetByName(AD.NAVER_SEARCH_CAMPAIGN_STATS.CACHE_SHEET);

  if(!sheet){
    sheet = ss.insertSheet(AD.NAVER_SEARCH_CAMPAIGN_STATS.CACHE_SHEET);
  }

  sheet.clearContents();

  sheet.getRange(1, 1, 1, NAVER_CAMPAIGN_STATS_CACHE_HEADERS.length)
    .setValues([NAVER_CAMPAIGN_STATS_CACHE_HEADERS]);

  const names = Object.keys(totals);

  if(names.length > 0){

    const rows = names.map(function(name){
      return [name, totals[name].impressions, totals[name].clicks, totals[name].spentKrw, totals[name].results];
    });

    sheet.getRange(2, 1, rows.length, NAVER_CAMPAIGN_STATS_CACHE_HEADERS.length)
      .setValues(rows);

  }

  sheet.hideSheet();

  SpreadsheetApp.flush();

}


/**
 * ==========================================================
 * Convert Naver Campaign Stats Spend to NZD (순수 함수)
 *
 * WHY (2026-08-05)
 * `readNaverSearchAdCampaignStatsCache_()`는 spentKrw를 원본 그대로
 * 돌려주므로, Search_OPS "Spent" 컬럼에 쓰기 전에 이 함수로 NZD 변환.
 * impressions/clicks는 통화와 무관해 그대로 통과, spentKrw만 rate를 곱해
 * spent로 이름을 바꿔 반환(72_Search_Build.js가 fetchKrwToNzdRate_()
 * (AD_004_SpendCache.js)로 구한 환율을 넘겨줌). results는 통화가 없어
 * 변환 없이 그대로 통과(2026-08-05 추가).
 *
 * INPUT
 * naverStatsMap : Object  {campaignName: {impressions, clicks, spentKrw, results}}
 * rate : number  KRW→NZD 환율
 *
 * OUTPUT
 * Object  {campaignName: {impressions, clicks, spent, results}}  (새 객체, 원본 불변)
 *
 * TEST
 * testConvertNaverCampaignStatsSpendToNZD() 참고
 * ==========================================================
 */
function convertNaverCampaignStatsSpendToNZD_(naverStatsMap, rate){

  const result = {};

  Object.keys(naverStatsMap || {}).forEach(function(name){

    const entry = naverStatsMap[name];

    result[name] = {
      impressions: entry.impressions,
      clicks: entry.clicks,
      spent: (Number(entry.spentKrw) || 0) * rate,
      results: entry.results
    };

  });

  return result;

}


/**
 * ==========================================================
 * TEST — convertNaverCampaignStatsSpendToNZD_()
 * ==========================================================
 */
function testConvertNaverCampaignStatsSpendToNZD(){

  const naverStatsMap = {
    "2025-07-KOR-Naver SA Brand": { impressions: 100, clicks: 10, spentKrw: 1000, results: 4 }
  };

  const result = convertNaverCampaignStatsSpendToNZD_(naverStatsMap, 0.0012);

  const pass =
    result["2025-07-KOR-Naver SA Brand"].impressions === 100 &&
    result["2025-07-KOR-Naver SA Brand"].clicks === 10 &&
    Math.abs(result["2025-07-KOR-Naver SA Brand"].spent - 1000 * 0.0012) < 1e-9 &&
    result["2025-07-KOR-Naver SA Brand"].results === 4 &&
    naverStatsMap["2025-07-KOR-Naver SA Brand"].spentKrw === 1000; // 입력 불변 확인

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Refresh Naver Search Ad Campaign Stats Cache (IO 오케스트레이션)
 *
 * WHY
 * Search_OPS의 Campaign/Impressions/Link clicks/Spent를 자동으로 채우기
 * 위한 진입점(사용자 요청, 2026-08-05) — `08_PipelineAsync.js`의
 * `refreshNaverSearchCampaignStats_()`가 매 Leads/MTA 백그라운드 실행마다
 * 호출, `72_Search_Build.js`의 `buildSearchOPS()`가 이 함수가 채워둔
 * 캐시(`readNaverSearchAdCampaignStatsCache_()`)를 읽고 NZD 변환해 매칭.
 * ==========================================================
 */
function refreshNaverSearchAdCampaignStatsCache_(){

  const props = PropertiesService.getScriptProperties();
  const propertyKey = AD.NAVER_SEARCH_CAMPAIGN_STATS.LAST_FETCHED_THROUGH_PROPERTY_KEY;

  const lastThrough = props.getProperty(propertyKey);
  const today = todayDateString_();

  const window = computeNaverSearchAdCampaignStatsFetchWindow_(
    lastThrough, today, AD.NAVER_SEARCH_CAMPAIGN_STATS.MAX_QUERY_RANGE_DAYS
  );

  if(!window.shouldFetch){
    Logger.log(
      "refreshNaverSearchAdCampaignStatsCache_: 오늘(" + today + ") 이미 갱신됨 — 스킵."
    );
    return;
  }

  const campaignMap = fetchNaverSearchAdCampaignMap_();
  const ids = Object.keys(campaignMap);
  const statsRows = fetchNaverSearchAdImpressionsClicksStats_(ids, window.since, window.until);

  const existingTotals = readNaverSearchAdCampaignStatsCache_();
  const newTotals = accumulateNaverSearchAdCampaignStats_(existingTotals, campaignMap, statsRows);

  writeNaverSearchAdCampaignStatsCache_(newTotals);

  props.setProperty(propertyKey, window.until);

  Logger.log(
    "refreshNaverSearchAdCampaignStatsCache_: " + window.since + " ~ " + window.until +
    " 반영 완료 (" + Object.keys(newTotals).length + "개 캠페인 누적)."
  );

}


/**
 * ==========================================================
 * Manual-run public wrapper (Apps Script 편집기 Run 드롭다운 노출용)
 * ==========================================================
 */
function runRefreshNaverSearchAdCampaignStatsCache(){

  refreshNaverSearchAdCampaignStatsCache_();

}


/**
 * ==========================================================
 * Backfill Naver Campaign Stats Spent/Results (순수 함수)
 *
 * WHY (2026-08-05)
 * Spent/Results 자동화(v2.9.0/v2.11.0) 배포 당일 실측 결과 두 컬럼이 0으로
 * 나오는 문제 발견 — 원인: `refreshNaverSearchAdCampaignStatsCache_()`가
 * `LAST_FETCHED_THROUGH_PROPERTY_KEY` 기준 "오늘 이미 갱신됨"이면 API 호출
 * 자체를 스킵하는데, 이 코드 배포 이전에 이미 오늘자 갱신이 한 번 돌아서
 * (impCnt/clkCnt만 있던 구버전 호출로) 오늘 날짜가 이미 기록돼 있었음 —
 * 그 결과 새로 추가된 salesAmt/ccnt를 요청하는 갱신이 오늘 안에 한 번도
 * 실행되지 못해 캐시 시트에 Spent(KRW)/Results 컬럼 자체가 아직 없는 상태.
 *
 * 이 함수는 `LAST_FETCHED_THROUGH_PROPERTY_KEY`(impressions/clicks 누적
 * 진행률 추적용)를 전혀 건드리지 않고 **spentKrw/results만 최근
 * MAX_QUERY_RANGE_DAYS(90일) 윈도우로 새로 채워 넣는다** — impressions/
 * clicks는 기존 누적치 그대로 보존(이 백필과 무관), spentKrw/results는
 * 지금까지 항상 0이었으므로 "0에서 시작해 이번 윈도우만큼 채움"과
 * "누적"이 결과적으로 같음 — 실수로 두 번 실행돼도 매번 같은 90일
 * 스냅샷으로 재설정될 뿐 중복 합산되지 않음(멱등).
 *
 * INPUT
 * existingTotals : Object  {campaignName: {impressions, clicks, spentKrw, results}}
 * campaignMap : Object  {nccCampaignId: name}
 * statsRows : Array<{id, impCnt, clkCnt, salesAmt, ccnt}>  (impCnt/clkCnt는 무시)
 *
 * OUTPUT
 * Object  {campaignName: {impressions, clicks, spentKrw, results}}  (새 객체,
 *   impressions/clicks는 existingTotals 그대로, spentKrw/results만 이번
 *   윈도우 값으로 교체)
 *
 * TEST
 * testBackfillNaverCampaignStatsSpentResults() 참고
 * ==========================================================
 */
function backfillNaverCampaignStatsSpentResults_(existingTotals, campaignMap, statsRows){

  const totals = {};

  Object.keys(existingTotals || {}).forEach(function(name){
    totals[name] = {
      impressions: existingTotals[name].impressions,
      clicks: existingTotals[name].clicks,
      spentKrw: 0,
      results: 0
    };
  });

  (statsRows || []).forEach(function(row){

    const name = campaignMap[row.id];

    if(!name) return;

    if(!totals[name]) totals[name] = { impressions: 0, clicks: 0, spentKrw: 0, results: 0 };

    totals[name].spentKrw += Number(row.salesAmt) || 0;
    totals[name].results += Number(row.ccnt) || 0;

  });

  return totals;

}


/**
 * ==========================================================
 * TEST — backfillNaverCampaignStatsSpentResults_()
 * ==========================================================
 */
function testBackfillNaverCampaignStatsSpentResults(){

  const existingTotals = {
    "2025-07-KOR-Naver SA Brand": { impressions: 500, clicks: 30, spentKrw: 0, results: 0 }
  };

  const campaignMap = {
    "cmp-001": "2025-07-KOR-Naver SA Brand",
    "cmp-002": "2025-07-KOR-Naver SA ECL" // existingTotals에 없던 신규 캠페인
  };

  const statsRows = [
    { id: "cmp-001", impCnt: 9999, clkCnt: 9999, salesAmt: 500, ccnt: 2 }, // impCnt/clkCnt는 무시돼야 함
    { id: "cmp-002", impCnt: 9999, clkCnt: 9999, salesAmt: 300, ccnt: 1 },
    { id: "cmp-999", impCnt: 1, clkCnt: 1, salesAmt: 1, ccnt: 1 } // campaignMap에 없음 — 무시돼야 함
  ];

  const result = backfillNaverCampaignStatsSpentResults_(existingTotals, campaignMap, statsRows);

  const pass =
    result["2025-07-KOR-Naver SA Brand"].impressions === 500 && // 기존 impressions 보존
    result["2025-07-KOR-Naver SA Brand"].clicks === 30 &&       // 기존 clicks 보존
    result["2025-07-KOR-Naver SA Brand"].spentKrw === 500 &&
    result["2025-07-KOR-Naver SA Brand"].results === 2 &&
    result["2025-07-KOR-Naver SA ECL"].impressions === 0 &&
    result["2025-07-KOR-Naver SA ECL"].spentKrw === 300 &&
    result["2025-07-KOR-Naver SA ECL"].results === 1 &&
    Object.keys(result).length === 2 &&
    existingTotals["2025-07-KOR-Naver SA Brand"].impressions === 500; // 입력 불변 확인

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Backfill Naver Campaign Stats Spent/Results (IO 오케스트레이션, 1회성)
 *
 * WHY
 * 위 backfillNaverCampaignStatsSpentResults_() 참고 — 정상 배포 이후에는
 * 다시 실행할 필요 없음(`refreshNaverSearchAdCampaignStatsCache_()`가 매
 * Import마다 자동으로 salesAmt/ccnt까지 누적함), 이번 배포 공백만 메우는
 * 1회성 함수.
 * ==========================================================
 */
function runBackfillNaverSearchCampaignStatsSpentResults(){

  const campaignMap = fetchNaverSearchAdCampaignMap_();
  const ids = Object.keys(campaignMap);

  const today = todayDateString_();
  const window = computeNaverSearchAdCampaignStatsFetchWindow_(
    null, today, AD.NAVER_SEARCH_CAMPAIGN_STATS.MAX_QUERY_RANGE_DAYS
  );

  const statsRows = fetchNaverSearchAdImpressionsClicksStats_(ids, window.since, window.until);

  const existingTotals = readNaverSearchAdCampaignStatsCache_();
  const newTotals = backfillNaverCampaignStatsSpentResults_(existingTotals, campaignMap, statsRows);

  writeNaverSearchAdCampaignStatsCache_(newTotals);

  Logger.log(
    "runBackfillNaverSearchCampaignStatsSpentResults: " + window.since + " ~ " + window.until +
    " Spent/Results 백필 완료 (" + Object.keys(newTotals).length + "개 캠페인)."
  );

}


/**
 * ==========================================================
 * Accumulate Naver Campaign Spend (KRW) By Name (순수 함수)
 *
 * WHY (2026-08-05)
 * 위 90일 백필로는 캠페인 시작일(2025년 중반)부터의 전체 지출을 못 담아
 * 사용자가 금액이 작다고 지적 — `runDebugNaverSearchAdStatsCcntRangeLimit()`
 * 실측 결과 ccnt는 92일 제약을 그대로 받지만 salesAmt 단독 요청은 이미
 * Ad_Spend_Cache 파이프라인에서 730일까지 확인돼 있음(`fetchNaverSearchAdStats_()`,
 * `computeNaverSearchAdSpendHistorySummary_()` 참고) — salesAmt만 따로
 * 월별 반복 호출해 캠페인 이름 단위로 누적하는 이 함수가 그 재사용.
 * impressions/clicks/results는 건드리지 않고 spentKrw만 더한다(호출부가
 * 매달 한 번씩 이 함수를 실행하며 totals를 스레딩 — 반복 누적).
 *
 * INPUT
 * existingTotals : Object  {campaignName: {impressions, clicks, spentKrw, results}}
 * campaignMap : Object  {nccCampaignId: name}
 * statsRows : Array<{id, salesAmt}>
 *
 * OUTPUT
 * Object  {campaignName: {impressions, clicks, spentKrw, results}}  (새 객체,
 *   spentKrw만 이번 statsRows만큼 더해짐)
 *
 * TEST
 * testAccumulateNaverCampaignSpendKrwByName() 참고
 * ==========================================================
 */
function accumulateNaverCampaignSpendKrwByName_(existingTotals, campaignMap, statsRows){

  const totals = {};

  Object.keys(existingTotals || {}).forEach(function(name){
    totals[name] = {
      impressions: existingTotals[name].impressions || 0,
      clicks: existingTotals[name].clicks || 0,
      spentKrw: existingTotals[name].spentKrw || 0,
      results: existingTotals[name].results || 0
    };
  });

  (statsRows || []).forEach(function(row){

    const name = campaignMap[row.id];

    if(!name) return;

    if(!totals[name]) totals[name] = { impressions: 0, clicks: 0, spentKrw: 0, results: 0 };

    totals[name].spentKrw += Number(row.salesAmt) || 0;

  });

  return totals;

}


/**
 * ==========================================================
 * TEST — accumulateNaverCampaignSpendKrwByName_()
 * ==========================================================
 */
function testAccumulateNaverCampaignSpendKrwByName(){

  const existingTotals = {
    "2025-07-KOR-Naver SA Brand": { impressions: 500, clicks: 30, spentKrw: 100, results: 4 }
  };

  const campaignMap = {
    "cmp-001": "2025-07-KOR-Naver SA Brand",
    "cmp-002": "2025-07-KOR-Naver SA ECL"
  };

  const statsRows = [
    { id: "cmp-001", salesAmt: 500 },
    { id: "cmp-002", salesAmt: 300 },
    { id: "cmp-999", salesAmt: 999 } // campaignMap에 없음 — 무시돼야 함
  ];

  const result = accumulateNaverCampaignSpendKrwByName_(existingTotals, campaignMap, statsRows);

  const pass =
    result["2025-07-KOR-Naver SA Brand"].impressions === 500 && // 보존
    result["2025-07-KOR-Naver SA Brand"].clicks === 30 &&       // 보존
    result["2025-07-KOR-Naver SA Brand"].results === 4 &&       // 보존
    result["2025-07-KOR-Naver SA Brand"].spentKrw === 600 &&    // 100 + 500 누적
    result["2025-07-KOR-Naver SA ECL"].spentKrw === 300 &&
    Object.keys(result).length === 2 &&
    existingTotals["2025-07-KOR-Naver SA Brand"].spentKrw === 100; // 입력 불변 확인

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Backfill Naver Campaign Spend History (IO 오케스트레이션, 1회성)
 *
 * WHY
 * 캠페인 시작일부터의 전체 Spent를 채우기 위해, `computeNaverSearchAdSpendHistorySummary_()`
 * 와 동일한 패턴(캠페인 목록 1회 조회 + `AD.NAVER_SEARCH.API.BACKFILL_START`
 * 부터 이번 달까지 매달 salesAmt 단독 조회, "730일 밖" 에러(`{code:11004}`)만
 * 그 달을 건너뛰고 계속)을 캠페인 이름 단위로 재사용. **spentKrw를 0으로
 * 리셋 후 전체 재계산**(위 90일 백필로 이미 채워진 값과 겹쳐서 이중 합산되는
 * 것을 방지) — impressions/clicks/results는 전혀 건드리지 않음. 정상 배포
 * 이후에는 재실행 불필요(`refreshNaverSearchAdCampaignStatsCache_()`가 매
 * Import마다 자동으로 이어서 누적), 이번 배포 공백만 메우는 1회성 함수.
 * ==========================================================
 */
function runBackfillNaverSearchCampaignSpendHistory(){

  const campaignMap = fetchNaverSearchAdCampaignMap_();
  const ids = Object.keys(campaignMap);

  const backfillStart = AD.NAVER_SEARCH.API.BACKFILL_START;
  const today = new Date();
  const months = generateCalendarMonthSequence_(
    backfillStart.YEAR, backfillStart.MONTH, today.getFullYear(), today.getMonth() + 1
  );

  let totals = readNaverSearchAdCampaignStatsCache_();

  Object.keys(totals).forEach(function(name){ totals[name].spentKrw = 0; });

  let skippedMonths = 0;

  months.forEach(function(m){

    const range = buildCalendarMonthRange_(m.year, m.month);

    let statsRows;

    try {
      statsRows = fetchNaverSearchAdStats_(ids, range.since, range.until);
    } catch(e){

      if(e.statusCode === 400 && e.body && e.body.code === 11004){

        skippedMonths++;
        Logger.log(m.year + "-" + m.month + " 건너뜀(730일 밖).");
        return;

      }

      throw e;

    }

    totals = accumulateNaverCampaignSpendKrwByName_(totals, campaignMap, statsRows);

  });

  writeNaverSearchAdCampaignStatsCache_(totals);

  Logger.log(
    "runBackfillNaverSearchCampaignSpendHistory: " + months.length + "개월 순회(" +
    skippedMonths + "개월 730일 밖으로 건너뜀), Spent 전체 소급 완료 (" +
    Object.keys(totals).length + "개 캠페인)."
  );

}


/**
 * ==========================================================
 * TEMP — Naver Campaign Stats Cache 시트 강제 공개(진단용, 수동 실행)
 *
 * WHY
 * `writeNaverSearchAdCampaignStatsCache_()`가 매번 `hideSheet()`를 호출해
 * 숨기므로, Google Sheets UI의 "모든 시트" 목록에서 못 찾겠다는 경우를
 * 대비해 코드로 직접 존재 여부 확인 + 강제로 보이게 하는 진단 함수.
 * ==========================================================
 */
function runShowNaverSearchAdCampaignStatsCache(){

  const ss = openNaverSearchCampaignStatsCacheExternalSpreadsheet_();
  const sheetName = AD.NAVER_SEARCH_CAMPAIGN_STATS.CACHE_SHEET;
  const sheet = ss.getSheetByName(sheetName);

  if(!sheet){
    Logger.log(
      "\"" + sheetName + "\" 시트를 이 스프레드시트(" + ss.getName() +
      ")에서 찾을 수 없습니다 — runRefreshNaverSearchAdCampaignStatsCache()가 " +
      "정상 완료됐는지 먼저 확인하세요."
    );
    return;
  }

  sheet.showSheet();
  ss.setActiveSheet(sheet);

  Logger.log(
    "\"" + sheetName + "\" 시트를 찾아서 공개했습니다 — 행 수: " + sheet.getLastRow()
  );

}
