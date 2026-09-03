/**
 * ==========================================================
 * Marketing 2.0
 * Ad Spend — Meta Import/Transform (파일럿 플랫폼)
 *
 * Responsibility
 * Meta_Raw(사용자가 Meta Ads Manager export를 수동으로 붙여넣는 시트,
 * AD.SPREADSHEET_ID)를 읽어 (FY|Month|Segment)별 Spent로 변환/집계한다.
 *
 * **핵심 규칙(2026-07-30 사용자 확인)**: "Amount spent"는 캠페인 전체 생애
 * 지출이 아니라 **"Reporting starts~ends"(조회 기간) 안에서 실제로 집행된
 * 금액**이다. 그래서 월별 귀속은 계정 종류(현재/예전)와 무관하게, 캠페인
 * 활성 기간(Date created~Ends)과 보고 조회 기간(Reporting starts~ends)의
 * **교집합**에 균등분배하면 된다 — 교집합이 정확히 한 달이면 그 달에 전액,
 * 여러 달에 걸치면 달마다 나눠 귀속. (처음엔 "현재 계정=월별 정확값 그대로,
 * 예전 계정=캠페인 활성기간에 분배"로 계정별 분기했었으나, 사용자가 현재
 * 계정도 한 번에 넓은 기간(2024-09~지금)으로 export하고 싶다고 해서 그
 * 가정이 깨짐 — 교집합 기반으로 통합, docs/exec-plans/active/
 * 2026-07-30-campaign-spend-integration.md 참고.)
 *
 * Business Segment 분류는 새로 만들지 않고 `getBusinessSegment()`
 * (16_TransformHelper.js)를 그대로 재사용 — Meta 캠페인명 네이밍 규칙이
 * Salesforce MKT UTM Campaign과 사실상 동일함을 실 데이터로 검증 완료
 * (docs/ACQReportDesign.md "오해 방지" 섹션과는 별개로, 위 exec-plan
 * Surprises 참고).
 *
 * Must NOT
 * - 새 Business Segment 분류 로직 작성 (getBusinessSegment() 재사용)
 * - Target_Engine/ACQ_REP/NewP1_REP에 결과를 아직 쓰지 않음(대체 여부
 *   미정, exec-plan 참고) — 이 파일은 집계 결과를 계산해서 보여주는
 *   단계까지만 담당.
 *
 * Stage
 * AD (신규 — 2026-07-30 네이밍 컨벤션. 기존 00~99는 당장 안 바꿈)
 *
 * Version
 * v1.17.0
 *
 * Change Log
 * v1.17.0 (2026-09-04)
 * - **버그 수정 — 진행 중인(아직 안 끝난) 주가 미래 요일 지출을 조작해
 *   부풀려짐(사용자 리포트)**: Target_REP Content 2026-08-31주가 New P1=9/
 *   CPNP1=$709.64로 표시됐는데(⇒ Spend $6,386.76), 사용자가 Campaigns 2.0
 *   원본에서 확인한 실제 값은 $2,737.18 — TEMPQA_046으로 조사한 결과 27개
 *   Meta 캠페인 전부 `reportStart~End=2026-08-31~2026-09-02`(월~수 3일치,
 *   export 시점이 그 주 도중이라 그때까지만 데이터가 있었을 뿐)인데
 *   `prorateSingleWeekMetaSpend_()`가 "export 범위가 좁아서 생긴 결측"으로
 *   오판해 3일치 실측($2,737.18)을 7/3배로 부풀림(정확히 $6,386.75 재현
 *   확인). 이 함수는 "과거에 실제로 있었는데 export만 안 담긴 지출"과 "그
 *   주가 아직 안 끝나 아직 발생하지 않은 지출"을 구분하지 못했던 것 —
 *   신규 optional `now` 파라미터(생략 시 실제 현재 시각) 추가, 그 주
 *   일요일이 아직 지나지 않았으면(다음 주 월요일이 아직 안 됐으면) 어떤
 *   경우든 보정하지 않고 원본 값 그대로 반환하도록 최상단에 가드 추가.
 *   과거에 완결된 주의 기존 보정 동작(Case A/B/C)은 무변경 — `now`가
 *   실제 그 주보다 한참 뒤인 한 항상 이 가드를 통과함. `testProrateSingleWeekMetaSpend()`
 *   에 Case D(진행 중인 주 재현) 추가 + 기존 A/B/C도 명시적 `now` 인자로
 *   결정론적으로 전환.
 * v1.16.0 (2026-08-25)
 * - **버그 수정 — v1.15.0의 일수 보정이 이중 집계로 이어지던 문제.**
 *   v1.14.0에서 `isMetaRowWeekPrecise_()`가 화~일(6일) 부분 export를 "정밀
 *   아님"으로 판정하도록 좁혀놨는데, v1.15.0에서 `computeMetaRowWeeklySpend_()`가
 *   그 부분 export를 7일치로 보정(prorate)하도록 고쳐도, `isMetaRowWeekPrecise_()`
 *   가 여전히 "정밀 아님"이라 `aggregateMetaSpendByWeekSegment_()`의 dedup이
 *   이 보정값을 override로 안 쓰고 기존 lump 조각과 **그냥 더해버려** 오히려
 *   더 나빠짐(사용자 실측: 8/17주 10,443.03 실제 vs 14,818.38로 과다집계,
 *   v1.14.0 직후의 13,706.50보다도 더 벌어짐). 근본 원인: "정밀"의 자격
 *   기준(월~일 7일 전체 커버)과 "보정 대상" 기준(report-limited 부분 커버)이
 *   서로 어긋나 있었던 것 — `isMetaRowWeekPrecise_()`를 "reportStart/reportEnd가
 *   정확히 7일인지"가 아니라 **"실효 구간(캠페인 활성기간 ∩ 보고 조회기간)이
 *   정확히 한 주에만 걸치는지"**로 재정의(며칠을 커버하든 그 주에 대해 이
 *   행이 유일한 근거이므로 항상 override 자격이 있음 — 실제 정확도는
 *   `prorateSingleWeekMetaSpend_()`가 담당). Node로 두 행(장기 lump + 화~일
 *   부분 정밀)을 합성해 dedup+보정 파이프라인 전체를 시뮬레이션, 이중 집계
 *   없이 한 번만 반영됨을 확인 후 배포(사용자 확인, "응 진행해줘").
 *   `testIsMetaRowWeekPrecise()` 케이스를 새 정의에 맞게 갱신(부분 주 export도
 *   이제 true가 정답).
 * v1.15.0 (2026-08-25)
 * - **버그 수정 — 단일 주(週)만 커버하는 Meta export가 실제 며칠치인지 상관없이
 *   spent 전액을 "그 주 값"으로 인정하던 문제.** v1.14.0에서 화~일(6일) export를
 *   "정밀"에서 탈락시켜 lump 분배로 완전히 대체했더니, 이번엔 실측(10,443.03)
 *   보다 훨씬 큰 값(13,706.50)이 나옴 — 6일치 실측 자체는 정확하니 버릴
 *   이유가 없고, 일수 비율로 7일치로 늘리면(8,897.07×7/6=10,379.58) 실측과
 *   오차 0.6%로 거의 일치함을 사용자 실측으로 확인(사용자 확인 후 진행).
 *   신규 `prorateSingleWeekMetaSpend_()`(순수 함수) — `computeMetaRowWeeklySpend_()`가
 *   effectiveStart~effectiveEnd를 단 하나의 주(週) 버킷에만 걸치는 것으로
 *   판단했을 때 이 헬퍼를 호출해, 그 결측이 export 조회기간(report) 탓인지
 *   캠페인 자체가 그 주 중간에 진짜로 시작/종료된 탓인지 구분해서 전자만
 *   7일 기준으로 보정한다(해당 함수 WHY 참고, `testProrateSingleWeekMetaSpend()`
 *   3케이스: report-limited 보정/campaign-limited 무보정/7일 전체 커버 무변화).
 *   `computeMetaSpendWeeklySummary_()`(Target_REP Actual CPNP1의 근간)의 과거
 *   출력값이 다시 바뀌는 변경 — 월 단위 함수(`computeMetaRowMonthlySpend_()`)는
 *   건드리지 않음(ACQ_REP/FY_REP 영향 없음).
 * v1.14.0 (2026-08-25)
 * - **버그 수정 — `isMetaRowWeekPrecise_()`가 부분(예: 화~일) 주 export를
 *   "정밀"로 오인해 그 주 월요일 지출이 통째로 증발하던 문제.**
 *   `runDebugTargetWeekAllSegmentsAudit()` 진단으로 원인 확정(WHY 상세는
 *   `isMetaRowWeekPrecise_()` 주석 참고, 사용자 확인 후 진행) — "reportStart와
 *   reportEnd가 같은 주 버킷에 속하는지"만 보던 조건에 "reportStart가 그 주의
 *   월요일이고 reportEnd가 일요일인지"(7일 전체 커버) 조건을 추가. 부분 주
 *   export는 이제 분배(lump) 추정치를 밀어내지 못하고 그대로 근사값이 쓰인다.
 *   `computeMetaSpendWeeklySummary_()`(Target_REP Actual CPNP1의 근간, AD_004_SpendCache.js
 *   `refreshAdSpendWeeklyCache_()`가 소비)의 과거 출력값이 바뀌는 변경 —
 *   `testIsMetaRowWeekPrecise()`에 화~일 부분 export 회귀 케이스 추가. 사용자가
 *   앞으로는 매주 월요일에 전주(월~일) 데이터를 온전히 export하기로 확정
 *   (2026-08-25) — 이 케이스는 재발 방지용 방어 로직으로 유지.
 * v1.13.0 (2026-08-25)
 * - `runDebugTargetWeekAllSegmentsAudit()` 보강 — 8/17주(Webinar=8,897.07)
 *   전수 조사 결과 다른 세그먼트로 새는 캠페인은 안 보였는데도 사용자 실측
 *   (10,443.03)과 여전히 1,545.96 차이가 남아, `isMetaRowWeekPrecise_()`가
 *   "reportStart/reportEnd가 같은 주(월~일) 안에 있는지"만 확인하고 "그
 *   export가 월요일~일요일 7일 전체를 커버하는지"는 확인하지 않는다는 점에
 *   착안 — 부분(예: 수~일) export가 "정밀"로 오인되면 분배(lump)값을 통째로
 *   대체하면서 커버 안 된 나머지 요일분이 누락될 수 있다는 가설 검증용. 정밀
 *   행에 reportStart/reportEnd를 요일과 함께 출력하고, 월요일 시작·일요일
 *   종료가 아니면 "부분 export 의심" 경고를 표시.
 * v1.12.0 (2026-08-25)
 * - `runDebugTargetWeekAllSegmentsAudit()` 신규 — 캐시 갱신(`runRefreshAdSpendWeeklyCache()`)
 *   후에도 8/17주 캐시(9,154.25)가 사용자 실측(Meta 실제 집행 10,443.03)보다
 *   여전히 1,288.78 적어, "캐시 오래됨" 문제가 아니라 "그 주 캠페인 일부가
 *   Webinar가 아닌 다른 세그먼트로 분류되고 있거나 정밀 export 우선 규칙에
 *   의해 그 주 기여분이 잘못 버려지고(dropped) 있을 가능성"을 좁혀 조사하기
 *   위한 진단. 대상 주(아래 상수, 기본 2026-08-17)에 걸치는 Meta_Raw 전체
 *   캠페인을 세그먼트 무관하게 나열하고 dropped 행도 표시.
 * v1.11.0 (2026-08-25)
 * - `runDebugTargetWebinarAugustSpendAudit()` 신규 — `runDebugTargetCampaignTrace()`로
 *   개별 캠페인 1건은 정상 반영을 확인했으나, 사용자가 제시한 8월 Webinar
 *   총 Spend(27,635.75)와 Target_REP 3주 캐시 합계(15,907.28) 사이에 약
 *   11,728 격차가 발견돼(캠페인 1건 문제로는 설명 안 되는 규모) 원인 범위를
 *   넓혀 조사하기 위한 진단. 캐시 vs 즉석 재계산(캐시 staleness 확인) +
 *   공식 월 합계(중복 제거 적용) + Meta_Raw Webinar AUG 캠페인 전체 목록
 *   (중복 제거 미적용, 참고용)을 함께 출력.
 * v1.10.0 (2026-08-25)
 * - `runDebugTargetCampaignTrace()` 신규 — 사용자 리포트("메인 프로그램 외
 *   사이드 리타겟팅 캠페인이 Target_REP Actual CPNP1에 반영 안 되는 것
 *   같다", 예: "KR_core_2026-08-05_consolidated-retargeting-lplg_event-online")
 *   조사용 진단. Meta_Raw 존재 여부 → `getBusinessSegment()` 분류 →
 *   `computeMetaRowWeeklySpend_()` 주간 분배 → Target_Engine Cutover Date
 *   게이트 → `Ad_Spend_Cache_Weekly` 반영 여부까지 파이프라인 전 구간을
 *   한 번에 짚어 어느 단계에서 빠지는지 보여준다(기존
 *   `runDebugMetaRawLastRows()`류 진단과 동일하게 TEMP, 테스트 없음).
 * v1.9.0 (2026-08-25)
 * - `readMetaRawRows_()`가 `impressions`("Impressions")/`reach`("Reach")도
 *   반환하도록 확장(additive, 기존 필드 변경 없음) — BOFU_OPS/Content_OPS
 *   Impressions/Reach 자동 집계용(`AD_001_Config.js` v1.22.0/
 *   `EVENTS_002_Engine.js` `aggregateMetaCampaignDataByProgram_()` 참고).
 * v1.8.0 (2026-08-19)
 * - `readMetaRawRows_()`가 `clicks`("Link clicks")/`results`("Results")도
 *   반환하도록 확장(additive, 기존 필드 변경 없음) — Events_OPS Clicks/
 *   Results 자동 집계용(`AD_001_Config.js` v1.21.0/`EVENTS_002_Engine.js`
 *   참고).
 * v1.7.0 (2026-08-19)
 * - Target_REP 주별 CPNP1이 한 달 내내 동일 값으로 반복 표시되는 문제(사용자
 *   리포트) 해소용 — 월 대신 주(월~일) 단위 지출 분배 신규: `generateAdSpendWeekRange_()`
 *   (generateAdSpendMonthRange_()의 주 버전, TARGET_001_Engine.js의
 *   getMondayOfWeek_()/addDaysToDate_() 재사용), `isMetaRowWeekPrecise_()`/
 *   `computeMetaRowWeeklySpend_()`/`aggregateMetaSpendByWeekSegment_()`(월 버전과
 *   동일한 "정밀 export 우선" 패턴), `computeMetaSpendWeeklySummary_()`(IO 래퍼,
 *   AD_004_SpendCache.js `refreshAdSpendWeeklyCache_()`가 호출). **주의**: Meta
 *   실무 export가 보통 월 단위라, 주 단위 정밀 export가 없는 한 이 경로의
 *   결과는 캠페인 활성기간 균등분배 근사값이다(월 버전과 동일한 한계 —
 *   `computeMetaRowWeeklySpend_()` WHY 참고). 기존 월 단위 함수/출력은 전혀
 *   안 건드림(ACQ_REP/FY_REP 하위호환 유지).
 * v1.6.0 (2026-07-31)
 * - Meta 전용 캐시 쓰기/읽기(`refreshMetaSpendCache_()`/`runRefreshMetaSpendCache()`/
 *   `readMetaSpendCacheMap_()`, `META_SPEND_CACHE_HEADERS`, "Meta_Spend_Cache"
 *   시트) 제거 — Naver Search Ad API 파이프라인 추가로 ACQ_REP가 여러 플랫폼
 *   합산 지출을 쓰게 되면서, 캐시 쓰기/읽기를 신규 `AD_004_SpendCache.js`로
 *   통합(사용자 확정, "합쳐서 연결"). `computeMetaSpendSummary_()`는 그대로
 *   유지(AD_004가 호출). 상세: docs/exec-plans/active/
 *   2026-07-30-campaign-spend-integration.md
 * v1.5.0 (2026-07-30)
 * - **Simple Trigger 권한 버그 발견·수정** — ACQ_REP에 "Meta Spent" 컬럼을
 *   연결한 뒤(30_ACQReport.js v1.11.0) Generate 체크박스가 조용히 실패, Cloud
 *   Logs로 정확한 원인 확인: "Specified permissions are not sufficient to
 *   call SpreadsheetApp.openById" — ACQ_REP Generate는 `onEdit()` Simple
 *   Trigger로 실행되는데, `computeMetaSpendSummary_()`(`readMetaRawRows_()`가
 *   내부에서 `SpreadsheetApp.openById(AD.SPREADSHEET_ID)` 호출)는 Simple
 *   Trigger의 제한된 권한으로는 못 씀 — Target_REP가 예전에 겪은 것과 동일한
 *   제약(2026-07-27, docs/TargetReportDesign.md). **해결**: `ACQ_Summary`와
 *   동일한 캐시 패턴 신규 도입 — `refreshMetaSpendCache_()`/
 *   `runRefreshMetaSpendCache()`(수동 실행, 외부 시트 읽어 메인 스프레드시트
 *   안 `Meta_Spend_Cache` 시트에 저장)와 `readMetaSpendCacheMap_()`(같은
 *   스프레드시트만 읽음, Simple Trigger 안전) 추가. `30_ACQReport.js`가
 *   `computeMetaSpendSummary_()` 대신 `readMetaSpendCacheMap_()`을 쓰도록
 *   전환(v1.12.0). Meta_Raw 갱신 시마다 `runRefreshMetaSpendCache()`를 먼저
 *   실행해야 ACQ_REP에 최신 값이 반영됨(자동 실행 체인 미연결, 수동).
 * v1.4.0 (2026-07-30)
 * - **타임존 버그 발견·수정** — `runDebugMetaRawLastRows()` 결과로 새로
 *   붙여넣은 정밀 export 행들이 전부 `isPrecise=false`로 나오는 걸 확인,
 *   `reportStart`가 "2026-06-30T15:00:00.000Z"처럼 실제(NZ 기준 7/1)보다
 *   하루 이른 UTC로 읽히고 있었음 — 이 Apps Script 프로젝트의 스크립트
 *   타임존(America/New_York)과 캠페인 지출 시트 자체 타임존이 달라서
 *   `.getMonth()`가 다른 달을 반환하는, Deal Tracker에서 이미 겪었던
 *   것과 동일한 버그 클래스(2026-07-28, 90_TargetEngine.js). 같은 해법
 *   (`normalizeExternalCalendarDate_()`) 재사용 — `readMetaRawRows_()`가
 *   시트 자체의 `getSpreadsheetTimeZone()` 기준으로 4개 날짜 컬럼
 *   (reportStart/reportEnd/campaignStart/campaignEnd)을 전부 재구성.
 * v1.3.0 (2026-07-30)
 * - `runDebugMetaRawLastRows()` 신규 — 정밀 export를 추가했는데도 집계
 *   결과가 여전히 안 맞는 문제 진단용. 사용자가 손으로 검산한 값(BOFU/
 *   Content)은 새 데이터와 정확히 일치했는데 실제 집계는 계속 어긋나서,
 *   데이터 자체보다 "이 행들이 isMetaRowMonthPrecise_()에서 정밀로
 *   인식되는지"(날짜가 텍스트로 들어갔을 가능성) + "캠페인명이 기존 lump
 *   행과 정확히 일치하는지"(override 커버리지 매칭 실패 가능성)를 직접
 *   확인하기 위함.
 * v1.2.0 (2026-07-30)
 * - 실 시트 검증 중 사용자가 26|JUL 실제 지출과 집계 결과가 15~20%대
 *   어긋난다고 리포트 — `runDebugMetaSpendByCampaignForMonth()`(신규 진단)
 *   로 캠페인별 내역을 확인한 결과 세그먼트 오분류는 없었고, 종료일(Ends)
 *   없는 장기 에버그린 캠페인(예: 2022년 생성 ebook 리타겟팅)의 균등분배
 *   근사 오차로 확인(사용자 확인). **정밀 export 우선 규칙 추가**: 같은
 *   캠페인의 같은 달을 "정밀"(`isMetaRowMonthPrecise_()` 신규 — reportStart/
 *   reportEnd가 같은 달)과 "장기 분배" 행이 동시에 커버하면, 분배 행의 그
 *   달 기여분은 버리고 정밀값을 채택(`aggregateMetaSpendByFYMonthSegment_()`
 *   재작성) — 사용자 확정: "최근 export로 보정하고 나머지는 그대로 두자".
 * v1.1.0 (2026-07-30)
 * - `computeMetaRowMonthlySpend_()` 전면 재작성 — 계정 ID 기반 분기
 *   ("현재 계정=단일월 그대로" vs "예전 계정=캠페인 활성기간에 분배")를
 *   폐기하고, "캠페인 활성 기간 ∩ 보고 조회 기간"에 균등분배하는 단일
 *   로직으로 통합(위 파일 헤더 WHY 참고) — 사용자가 현재 계정도 한 번에
 *   넓은 기간으로 export하고 싶다고 해서, 기존 "현재 계정=항상 한 달"
 *   가정이 깨짐. `AD.META.ACTIVE_ACCOUNT_ID`는 이 함수에서 더 이상 안 씀
 *   (Config엔 당장 유지 — 다른 용도로 쓸 가능성 있어 보존, 로직 의존만 제거).
 * v1.0.0 (2026-07-30)
 * - 최초 구현.
 * ==========================================================
 */


/**
 * ==========================================================
 * Generate Ad Spend Month Range (순수 함수)
 *
 * WHY
 * 예전(영구 종료) 계정 캠페인은 lifetime 합계 1건만 있어, 그 캠페인의
 * 활성 기간(시작~종료)에 걸친 모든 달 목록이 있어야 균등분배할 수 있다.
 *
 * INPUT
 * startDate : Date
 * endDate : Date
 *
 * OUTPUT
 * Array<{fy:number, month:string}>  startDate~endDate에 걸친 각 캘린더
 * 월 1개씩, 오름차순. 유효하지 않은 범위(endDate < startDate)면 빈 배열.
 *
 * TEST
 * testGenerateAdSpendMonthRange() 참고
 * ==========================================================
 */
function generateAdSpendMonthRange_(startDate, endDate){

  const months = [];

  if(!(startDate instanceof Date) || isNaN(startDate.getTime())) return months;
  if(!(endDate instanceof Date) || isNaN(endDate.getTime())) return months;
  if(endDate < startDate) return months;

  let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const last = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

  while(cursor <= last){

    months.push({
      fy: Number(getFiscalYear(cursor).replace("FY", "")),
      month: getFiscalMonthLabel(cursor)
    });

    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);

  }

  return months;

}


/**
 * ==========================================================
 * TEST — generateAdSpendMonthRange_()
 * ==========================================================
 */
function testGenerateAdSpendMonthRange(){

  const result = generateAdSpendMonthRange_(
    new Date(2022, 8, 16),   // 2022-09-16
    new Date(2023, 4, 31)    // 2023-05-31
  );

  const labels = result.map(function(r){ return r.fy + "|" + r.month; });

  const pass =
    result.length === 9 &&
    labels[0] === "23|SEP" &&
    labels[8] === "23|MAY";

  Logger.log("Result: " + JSON.stringify(labels));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

  const invalid = generateAdSpendMonthRange_(new Date(2023, 4, 31), new Date(2022, 8, 16));

  Logger.log("Invalid range length: " + invalid.length + " (expected 0)");
  Logger.log(invalid.length === 0 ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Meta Row Monthly Spend (순수 함수)
 *
 * WHY
 * Meta_Raw 한 행(캠페인+기간+Spent)을 (FY|Month|Segment) 단위 Spent
 * 항목들로 변환한다. Spent는 "보고 조회 기간(reportStart~reportEnd)" 안에서
 * 집행된 금액이므로, 캠페인 활성 기간(campaignStart~campaignEnd)과의
 * 교집합에 균등분배한다 — 위 파일 헤더 WHY 참고. campaignEnd가 없으면
 * (아직 종료 안 된 캠페인) reportEnd를 임시 종료 시점으로 취급.
 *
 * INPUT
 * record : Object  {campaignName, spent, reportStart(Date), reportEnd(Date),
 *   campaignStart(Date), campaignEnd(Date|없을 수 있음)}
 *
 * OUTPUT
 * Array<{fy:number, month:string, segment:string, spent:number}>
 *
 * TEST
 * testComputeMetaRowMonthlySpend() 참고
 * ==========================================================
 */
function computeMetaRowMonthlySpend_(record){

  const segment = getBusinessSegment(record.campaignName);

  if(!(record.reportStart instanceof Date) || isNaN(record.reportStart.getTime())) return [];
  if(!(record.reportEnd instanceof Date) || isNaN(record.reportEnd.getTime())) return [];

  const hasCampaignStart = record.campaignStart instanceof Date && !isNaN(record.campaignStart.getTime());
  const hasCampaignEnd = record.campaignEnd instanceof Date && !isNaN(record.campaignEnd.getTime());

  const effectiveStart = (hasCampaignStart && record.campaignStart > record.reportStart)
    ? record.campaignStart
    : record.reportStart;

  const effectiveEnd = (hasCampaignEnd && record.campaignEnd < record.reportEnd)
    ? record.campaignEnd
    : record.reportEnd;

  const months = generateAdSpendMonthRange_(effectiveStart, effectiveEnd);

  if(months.length === 0) return [];

  const perMonthSpent = (Number(record.spent) || 0) / months.length;

  return months.map(function(m){
    return { fy: m.fy, month: m.month, segment: segment, spent: perMonthSpent };
  });

}


/**
 * ==========================================================
 * TEST — computeMetaRowMonthlySpend_()
 * ==========================================================
 */
function testComputeMetaRowMonthlySpend(){

  // Case A — 실 데이터 검증 샘플: "book-a-consult-acqui_contact-lg" (BOFU).
  // campaignStart(2022-09-18)가 reportStart(2023-06-29)보다 이르므로 유효
  // 구간은 reportStart~campaignEnd(2024-07-30) = 2023 JUN~2024 JUL, 14개월.
  const row = {
    campaignName: "KR_core_2022-01-19_book-a-consult-acqui_contact-lg",
    spent: 9217.3,
    reportStart: new Date(2023, 5, 29),
    reportEnd: new Date(2024, 8, 9),
    campaignStart: new Date(2022, 8, 18),
    campaignEnd: new Date(2024, 6, 30)
  };

  const result = computeMetaRowMonthlySpend_(row);
  const expectedPerMonth = 9217.3 / 14;

  const pass =
    result.length === 14 &&
    result[0].fy === 23 && result[0].month === "JUN" &&
    result[13].fy === 24 && result[13].month === "JUL" &&
    result.every(function(r){ return r.segment === "BOFU"; }) &&
    Math.abs(result[0].spent - expectedPerMonth) < 1e-9;

  Logger.log("Result length: " + result.length + " (expected 14), first=" +
    JSON.stringify(result[0]) + ", last=" + JSON.stringify(result[13]));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

  // Case B — 캠페인이 아직 종료 안 됨(campaignEnd 없음) → reportEnd까지로 취급.
  // 보고 기간 자체가 한 달(2026-07)뿐이면 그 한 달에 전액 귀속.
  const ongoingRow = {
    campaignName: "KR_core_2024-09-07_admission-process-sim_event-online",
    spent: 1000,
    reportStart: new Date(2026, 6, 1),
    reportEnd: new Date(2026, 6, 31),
    campaignStart: new Date(2024, 7, 7),
    campaignEnd: null
  };

  const ongoingResult = computeMetaRowMonthlySpend_(ongoingRow);

  const ongoingPass =
    ongoingResult.length === 1 &&
    ongoingResult[0].fy === 26 &&
    ongoingResult[0].month === "JUL" &&
    ongoingResult[0].segment === "Webinar" &&
    ongoingResult[0].spent === 1000;

  Logger.log("Ongoing campaign result: " + JSON.stringify(ongoingResult));
  Logger.log(ongoingPass ? "✅ PASS" : "❌ FAIL");

  // Case C — 캠페인이 보고 기간 시작 전에 이미 종료됨 → 겹치는 구간이 없어 공란.
  const noOverlapRow = {
    campaignName: "KR_core_2022-09-16_gl-satpracticetest-eb-ebook-mofu_lead",
    spent: 900,
    reportStart: new Date(2023, 5, 28),
    reportEnd: new Date(2024, 8, 10),
    campaignStart: new Date(2022, 8, 16),
    campaignEnd: new Date(2022, 9, 31)
  };

  const noOverlapResult = computeMetaRowMonthlySpend_(noOverlapRow);

  Logger.log("No-overlap result length: " + noOverlapResult.length + " (expected 0)");
  Logger.log(noOverlapResult.length === 0 ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Is Meta Row Month-Precise (순수 함수)
 *
 * WHY (2026-07-30)
 * 종료일(Ends)이 없는 장기 에버그린 캠페인은 균등분배 근사 오차가 크다
 * (사용자 실측: 26|JUL Content/BOFU가 실제와 15~20%대 어긋남 — 세그먼트
 * 오분류가 아니라 "몇 년치를 평균낸" 근사 오차로 확인됨). 사용자가 특정
 * 달만 좁혀서(reportStart~reportEnd가 같은 달) 다시 export하면 그 값을
 * "정밀값"으로 우선시하기로 함(넓은 기간 분배값 중 그 달은 제외) — 이
 * 함수는 한 행이 "정밀"(보고 기간이 정확히 한 달)인지 판별한다.
 *
 * INPUT
 * record : Object  {reportStart(Date), reportEnd(Date)}
 *
 * OUTPUT
 * boolean
 *
 * TEST
 * testIsMetaRowMonthPrecise() 참고
 * ==========================================================
 */
function isMetaRowMonthPrecise_(record){

  if(!(record.reportStart instanceof Date) || isNaN(record.reportStart.getTime())) return false;
  if(!(record.reportEnd instanceof Date) || isNaN(record.reportEnd.getTime())) return false;

  return (
    record.reportStart.getFullYear() === record.reportEnd.getFullYear() &&
    record.reportStart.getMonth() === record.reportEnd.getMonth()
  );

}


/**
 * ==========================================================
 * TEST — isMetaRowMonthPrecise_()
 * ==========================================================
 */
function testIsMetaRowMonthPrecise(){

  const precise = isMetaRowMonthPrecise_({
    reportStart: new Date(2026, 6, 1),
    reportEnd: new Date(2026, 6, 31)
  });

  const lump = isMetaRowMonthPrecise_({
    reportStart: new Date(2023, 5, 29),
    reportEnd: new Date(2024, 8, 9)
  });

  Logger.log("precise=" + precise + " (expected true), lump=" + lump + " (expected false)");
  Logger.log((precise === true && lump === false) ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Aggregate Meta Spend By FY/Month/Segment (순수 함수)
 *
 * WHY
 * computeMetaRowMonthlySpend_()가 만든 행별 항목들을 (FY|Month|Segment)
 * 키로 합산한다 — 한 세그먼트/월에 여러 캠페인(행)이 걸치는 게 정상이므로.
 *
 * **정밀 export 우선 규칙(2026-07-30)**: 같은 캠페인의 같은 달을 "정밀"
 * (isMetaRowMonthPrecise_) 행과 "분배"(장기 lump) 행이 동시에 커버하면,
 * 분배 행의 그 달 기여분은 버리고 정밀 행 값만 채택 — 이중계상 방지 +
 * 근사 오차 보정. 나머지(정밀 export가 없는 달)는 그대로 분배값 사용
 * (사용자 확정: "최근 export로 보정하고 나머지는 그대로 두자").
 *
 * INPUT
 * records : Array<Object>  Meta_Raw에서 읽은 원시 레코드 배열
 *
 * OUTPUT
 * Object  키 "fy|month|segment" → 합산 Spent
 *
 * TEST
 * testAggregateMetaSpendByFYMonthSegment() 참고
 * ==========================================================
 */
function aggregateMetaSpendByFYMonthSegment_(records){

  // 캠페인별로 "정밀 export가 커버하는 (fy|month)" 집합을 먼저 구한다.
  const preciseCoverageByCampaign = {};

  records.forEach(function(record){

    if(!isMetaRowMonthPrecise_(record)) return;

    computeMetaRowMonthlySpend_(record).forEach(function(entry){

      const campaign = record.campaignName;

      if(!preciseCoverageByCampaign[campaign]) preciseCoverageByCampaign[campaign] = {};

      preciseCoverageByCampaign[campaign][entry.fy + "|" + entry.month] = true;

    });

  });

  const totals = {};

  records.forEach(function(record){

    const isPrecise = isMetaRowMonthPrecise_(record);
    const coverage = preciseCoverageByCampaign[record.campaignName];

    computeMetaRowMonthlySpend_(record).forEach(function(entry){

      // 분배(lump) 행이 만든 항목인데, 같은 캠페인의 같은 달을 정밀 export가
      // 이미 커버한다면 건너뜀(정밀값 우선, 이중계상 방지).
      if(!isPrecise && coverage && coverage[entry.fy + "|" + entry.month]) return;

      const key = entry.fy + "|" + entry.month + "|" + entry.segment;

      totals[key] = (totals[key] || 0) + entry.spent;

    });

  });

  return totals;

}


/**
 * ==========================================================
 * TEST — aggregateMetaSpendByFYMonthSegment_()
 * ==========================================================
 */
function testAggregateMetaSpendByFYMonthSegment(){

  const records = [
    {
      // 아직 종료 안 된 캠페인(campaignEnd 없음) — reportEnd까지로 취급, 보고
      // 기간이 한 달(2026-07)뿐이라 그 달에 전액.
      campaignName: "KR_core_2024-09-07_admission-process-sim_event-online",
      spent: 500,
      reportStart: new Date(2026, 6, 1),
      reportEnd: new Date(2026, 6, 31),
      campaignStart: new Date(2024, 7, 7),
      campaignEnd: null
    },
    {
      // 같은 (FY|Month|Segment)에 걸치는 두 번째 캠페인 — 합산 확인용
      campaignName: "KR_core_2024-09-07_admission-process-sim_event-online-fbiglg",
      spent: 250,
      reportStart: new Date(2026, 6, 1),
      reportEnd: new Date(2026, 6, 31),
      campaignStart: new Date(2024, 7, 7),
      campaignEnd: null
    }
  ];

  const result = aggregateMetaSpendByFYMonthSegment_(records);

  const pass = result["26|JUL|Webinar"] === 750;

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

  // 정밀 export 우선 규칙 확인 — 같은 캠페인이 (1) 종료일 없는 장기 lump로
  // 여러 달에 분배되고, (2) 그중 한 달(JUL)만 정밀 export도 있으면, JUL은
  // 정밀값으로 대체되고 나머지 달은 분배값 그대로 남아야 한다.
  const overrideRecords = [
    {
      campaignName: "KR_core_2022-10-01_retargeting-ebook_lead-fbiglg",
      spent: 1200,   // 2026-06~2026-07 두 달에 걸쳐 분배 → 달당 600
      reportStart: new Date(2026, 5, 1),
      reportEnd: new Date(2026, 6, 31),
      campaignStart: new Date(2022, 9, 1),
      campaignEnd: null
    },
    {
      // 같은 캠페인의 2026-07만 좁혀서 다시 뽑은 정밀 export
      campaignName: "KR_core_2022-10-01_retargeting-ebook_lead-fbiglg",
      spent: 900,
      reportStart: new Date(2026, 6, 1),
      reportEnd: new Date(2026, 6, 31),
      campaignStart: new Date(2022, 9, 1),
      campaignEnd: null
    }
  ];

  const overrideResult = aggregateMetaSpendByFYMonthSegment_(overrideRecords);

  const overridePass =
    overrideResult["26|JUN|Content"] === 600 &&   // 분배값 그대로
    overrideResult["26|JUL|Content"] === 900;     // 정밀값으로 대체(600 아님)

  Logger.log("Override result: " + JSON.stringify(overrideResult));
  Logger.log(overridePass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Setup Meta Raw Sheet (최초 1회 수동 실행 — 탭만 생성)
 *
 * WHY
 * 헤더는 코드가 미리 정하지 않는다 — 사용자가 Meta Ads Manager export를
 * (헤더 행 포함) 그대로 복사/붙여넣기 하면 그게 곧 헤더가 되는 방식이라
 * (Header-Based Mapping, sheetToObjects() 재사용), 탭 자체만 미리 만들어둔다.
 * ==========================================================
 */
function setupMetaRawSheet(){

  const ss = SpreadsheetApp.openById(AD.SPREADSHEET_ID);

  let sheet = ss.getSheetByName(AD.RAW_SHEET.Meta);

  if(!sheet){
    sheet = ss.insertSheet(AD.RAW_SHEET.Meta);
    Logger.log(AD.RAW_SHEET.Meta + " 탭 생성 완료. Meta Ads Manager export를 헤더 포함해서 A1부터 붙여넣으세요.");
  } else {
    Logger.log(AD.RAW_SHEET.Meta + " 탭이 이미 존재합니다.");
  }

}


/**
 * ==========================================================
 * Read Meta Raw Rows (IO 래퍼)
 *
 * WHY
 * Meta_Raw 시트를 sheetToObjects()(22_OPS_Merge.js, 공용 헤더 기반 리더)
 * 로 읽어 AD.META.COLUMNS 매핑에 따라 파싱한다.
 *
 * **타임존 정규화(2026-07-30 추가)**: 이 Apps Script 프로젝트의 스크립트
 * 타임존(America/New_York)과 캠페인 지출 스프레드시트 자체의 타임존이
 * 달라서, 날짜 셀을 그냥 읽으면 실제 날짜보다 하루 이전으로 밀려 나오는
 * 문제 발견(예: NZ 기준 "2026-07-01"이 "2026-06-30T15:00:00Z"로 읽혀
 * `.getMonth()`가 JUN을 반환 — `isMetaRowMonthPrecise_()`가 정밀 export를
 * "여러 달에 걸침"으로 오판하게 됨). Deal Tracker에서 이미 겪은 동일 버그의
 * 해법(`normalizeExternalCalendarDate_()`, 90_TargetEngine.js)을 그대로
 * 재사용 — 캠페인 지출 시트 자체의 타임존 기준으로 연/월/일을 재구성한다.
 * ==========================================================
 */
function readMetaRawRows_(){

  const ss = SpreadsheetApp.openById(AD.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(AD.RAW_SHEET.Meta);

  if(!sheet) return [];

  const sourceTimeZone = ss.getSpreadsheetTimeZone();
  const cols = AD.META.COLUMNS;

  function normalizeDate(value){
    return value instanceof Date ? normalizeExternalCalendarDate_(value, sourceTimeZone) : value;
  }

  return sheetToObjects(sheet).map(function(raw){

    return {
      campaignName: raw[cols.CAMPAIGN_NAME],
      accountId: String(raw[cols.ACCOUNT_ID] || ""),
      spent: raw[cols.SPENT],
      clicks: raw[cols.CLICKS],
      results: raw[cols.RESULTS],
      impressions: raw[cols.IMPRESSIONS],
      reach: raw[cols.REACH],
      reportStart: normalizeDate(raw[cols.REPORT_START]),
      reportEnd: normalizeDate(raw[cols.REPORT_END]),
      campaignStart: normalizeDate(raw[cols.CAMPAIGN_START]),
      campaignEnd: normalizeDate(raw[cols.CAMPAIGN_END])
    };

  });

}


/**
 * ==========================================================
 * Compute Meta Spend Summary (IO 래퍼)
 * ==========================================================
 */
function computeMetaSpendSummary_(){

  return aggregateMetaSpendByFYMonthSegment_(readMetaRawRows_());

}


// Meta 전용 캐시 쓰기/읽기(refreshMetaSpendCache_/runRefreshMetaSpendCache/
// readMetaSpendCacheMap_, "Meta_Spend_Cache" 시트)는 2026-07-31 제거됨 —
// Naver Search Ad API 파이프라인(AD_003_NaverSearch.js) 추가 후 ACQ_REP가
// 여러 플랫폼 합산 지출을 쓰기로 확정, 캐시 쓰기/읽기는 신규
// AD_004_SpendCache.js(refreshAdSpendCache_()/readAdSpendCacheMap_(),
// "Ad_Spend_Cache" 시트)로 통합. computeMetaSpendSummary_()는 그대로 유지 —
// AD_004가 이 함수를 호출해 Meta 몫을 가져간다. 상세: docs/exec-plans/active/
// 2026-07-30-campaign-spend-integration.md


/**
 * ==========================================================
 * TEMP — computeMetaSpendSummary_() 수동 실행/확인용 공개 진입점
 * ==========================================================
 */
function runComputeMetaSpendSummary(){

  const summary = computeMetaSpendSummary_();

  Logger.log(JSON.stringify(summary, null, 2));

}


/**
 * ==========================================================
 * Generate Ad Spend Week Range (순수 함수)
 *
 * WHY
 * generateAdSpendMonthRange_()의 주(월~일) 버전 — Target_REP 주별 CPNP1
 * 정확도 개선(2026-08-19)을 위해 Meta 캠페인 지출을 월이 아니라 주 단위로도
 * 분배할 수 있어야 한다. 주 정의는 Target_Engine과 동일(월요일 시작) —
 * `getMondayOfWeek_()`/`addDaysToDate_()`(TARGET_001_Engine.js)를 그대로
 * 재사용한다(같은 Apps Script 프로젝트라 전역에서 바로 호출 가능, 새 유틸
 * 재작성 안 함).
 *
 * INPUT
 * startDate : Date
 * endDate : Date
 *
 * OUTPUT
 * Array<{weekStart:Date}>  startDate~endDate에 걸친 각 주(월~일)의 월요일,
 * 오름차순. 유효하지 않은 범위(endDate < startDate)면 빈 배열.
 *
 * TEST
 * testGenerateAdSpendWeekRange() 참고
 * ==========================================================
 */
function generateAdSpendWeekRange_(startDate, endDate){

  const weeks = [];

  if(!(startDate instanceof Date) || isNaN(startDate.getTime())) return weeks;
  if(!(endDate instanceof Date) || isNaN(endDate.getTime())) return weeks;
  if(endDate < startDate) return weeks;

  let cursor = getMondayOfWeek_(startDate);
  const last = getMondayOfWeek_(endDate);

  while(cursor <= last){

    weeks.push({ weekStart: new Date(cursor) });
    cursor = addDaysToDate_(cursor, 7);

  }

  return weeks;

}


/**
 * ==========================================================
 * TEST — generateAdSpendWeekRange_()
 * ==========================================================
 */
function testGenerateAdSpendWeekRange(){

  const result = generateAdSpendWeekRange_(
    new Date(2026, 7, 6),   // 2026-08-06 (목, 8/3주)
    new Date(2026, 7, 20)   // 2026-08-20 (목, 8/17주)
  );

  const pass =
    result.length === 3 &&
    result[0].weekStart.getTime() === new Date(2026, 7, 3).getTime() &&
    result[1].weekStart.getTime() === new Date(2026, 7, 10).getTime() &&
    result[2].weekStart.getTime() === new Date(2026, 7, 17).getTime();

  Logger.log("Result: " + result.map(function(r){ return r.weekStart.toString(); }).join(" | "));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

  const invalid = generateAdSpendWeekRange_(new Date(2026, 7, 20), new Date(2026, 7, 6));

  Logger.log("Invalid range length: " + invalid.length + " (expected 0)");
  Logger.log(invalid.length === 0 ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Is Meta Row Week Precise (순수 함수) — 2026-08-25 정의 재설계
 *
 * WHY
 * v1.14.0에서 "reportStart가 그 주의 월요일이고 reportEnd가 일요일인 경우"
 * (=7일 전체를 실제로 커버하는 export)로만 좁혔더니, 화~일(6일) 부분 export가
 * "정밀" 자격을 잃고 lump 분배로 완전히 대체되면서 그 6일치 실측값(정확함)이
 * 통째로 버려지고 실측보다 훨씬 큰 lump 평균값이 대신 채택되는 역효과가
 * 발생(사용자 실측: 실제 10,443.03 vs lump 대체 13,706.50). v1.15.0에서
 * `computeMetaRowWeeklySpend_()`가 부분 export를 일수 비율로 7일치로
 * 보정(prorate)하도록 고쳤는데, 이 함수가 여전히 "정밀 아님"으로 판정하면
 * `aggregateMetaSpendByWeekSegment_()`의 dedup이 이 보정값을 override로 안 쓰고
 * 기존 lump 조각과 **그냥 더해버려** 이중 집계가 발생(사용자 실측: 14,818.38로
 * 더 나빠짐).
 *
 * **결론(2026-08-25 최종)**: "정밀"의 진짜 의미는 "reportStart/reportEnd가
 * 정확히 월~일 7일을 채우는지"가 아니라, **"이 행의 실효 구간(캠페인 활성기간
 * ∩ 보고 조회기간)이 정확히 한 주(週)에만 걸치는지"** — 며칠을 커버하든, 그
 * 캠페인의 그 주에 대해서는 이 행이 유일한 근거 데이터이므로(다른 행은 다른
 * 기간을 담당) 항상 다른 다주(多週) lump 분배 조각보다 우선해야 한다. 실제
 * "그 주 값이 얼마인지"의 정확도는 `computeMetaRowWeeklySpend_()`/
 * `prorateSingleWeekMetaSpend_()`가 담당(부분 export면 비례 보정, 캠페인이
 * 진짜 그 주 중간에 시작/종료했으면 원본 그대로) — 이 함수는 오직 "이 행이
 * 그 주의 override 자격이 있는가"만 판단한다.
 *
 * @param {Object} record
 * @return {boolean}
 *
 * TEST
 * testIsMetaRowWeekPrecise() 참고
 * ==========================================================
 */
function isMetaRowWeekPrecise_(record){

  if(!(record.reportStart instanceof Date) || isNaN(record.reportStart.getTime())) return false;
  if(!(record.reportEnd instanceof Date) || isNaN(record.reportEnd.getTime())) return false;

  const hasCampaignStart = record.campaignStart instanceof Date && !isNaN(record.campaignStart.getTime());
  const hasCampaignEnd = record.campaignEnd instanceof Date && !isNaN(record.campaignEnd.getTime());

  const effectiveStart = (hasCampaignStart && record.campaignStart > record.reportStart)
    ? record.campaignStart
    : record.reportStart;

  const effectiveEnd = (hasCampaignEnd && record.campaignEnd < record.reportEnd)
    ? record.campaignEnd
    : record.reportEnd;

  if(effectiveEnd < effectiveStart) return false;

  return generateAdSpendWeekRange_(effectiveStart, effectiveEnd).length === 1;

}


/**
 * ==========================================================
 * TEST — isMetaRowWeekPrecise_()
 * ==========================================================
 */
function testIsMetaRowWeekPrecise(){

  const fullWeek = isMetaRowWeekPrecise_({
    reportStart: new Date(2026, 7, 3),  // 2026-08-03 월요일
    reportEnd: new Date(2026, 7, 9),    // 2026-08-09 일요일
    campaignStart: new Date(2020, 0, 1),
    campaignEnd: null
  });

  const lump = isMetaRowWeekPrecise_({
    reportStart: new Date(2026, 6, 1),
    reportEnd: new Date(2026, 6, 31),
    campaignStart: new Date(2020, 0, 1),
    campaignEnd: null
  });

  // 2026-08-25 재설계 핵심 케이스 — 화~일(6일) 부분 export도 실효 구간이 한
  // 주에만 걸치면 "정밀"(=override 자격 있음)이어야 한다. 값 보정은
  // computeMetaRowWeeklySpend_()가 별도로 담당.
  const partialWeek = isMetaRowWeekPrecise_({
    reportStart: new Date(2026, 7, 18), // 2026-08-18 화요일
    reportEnd: new Date(2026, 7, 23),   // 2026-08-23 일요일
    campaignStart: new Date(2026, 7, 5),
    campaignEnd: new Date(2026, 8, 11)
  });

  const pass =
    fullWeek === true &&
    lump === false &&
    partialWeek === true;

  Logger.log(
    "fullWeek=" + fullWeek + " (expected true), lump=" + lump + " (expected false), " +
    "partialWeek(화~일)=" + partialWeek + " (expected true)"
  );
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Meta Row Weekly Spend (순수 함수)
 *
 * WHY
 * computeMetaRowMonthlySpend_()의 주 버전 — "캠페인 활성 기간 ∩ 보고 조회
 * 기간"을 주(월~일) 단위로 균등분배한다. 월 버전과 동일한 근사 한계를 그대로
 * 가진다(장기 lump 행일수록 실제 주간 변동을 못 담음) — 정밀 export가 월
 * 단위인 한 이 함수의 대부분 출력은 근사값이라는 걸 유의(파일 헤더 Change
 * Log v1.7.0 WHY 참고).
 *
 * **단일 주 보정(2026-08-25 추가)**: effectiveStart~effectiveEnd가 한 주(월~일)
 * 버킷 안에만 들어올 때, 예전엔 며칠치인지 상관없이 spent 전액을 "그 주 값"
 * 으로 그대로 인정했다 — 사용자가 화~일(6일)만 export하면 그 6일치 값이
 * 통째로 "정밀"이 돼 나머지 요일(월요일) 지출이 증발하는 문제로 이어짐
 * (`isMetaRowWeekPrecise_()` v1.14.0 수정 배경). 그런데 그 반대로 "정밀에서
 * 탈락시키고 lump 분배로 완전히 대체"하면 실측보다 훨씬 크게 어긋남(사용자
 * 검증: 8/17주 실측 10,443.03 vs lump 대체값 13,706.50) — 6일치 실측 자체는
 * 정확하므로 버릴 이유가 없고, 일수 비율로 7일치로 늘리면(8,897.07×7/6=
 * 10,379.58) 실측과 오차 0.6%로 거의 일치함을 확인. `prorateSingleWeekMetaSpend_()`
 * 로 분리 — 그 결측이 export 조회기간 탓인지 캠페인이 진짜 그 주 중간에
 * 시작/종료된 탓인지 구분해서, 후자면 보정하지 않는다(해당 함수 WHY 참고).
 *
 * INPUT
 * record : Object  computeMetaRowMonthlySpend_()와 동일
 *
 * OUTPUT
 * Array<{weekStart:Date, segment:string, spent:number}>
 *
 * TEST
 * testComputeMetaRowWeeklySpend() 참고
 * ==========================================================
 */
function computeMetaRowWeeklySpend_(record){

  const segment = getBusinessSegment(record.campaignName);

  if(!(record.reportStart instanceof Date) || isNaN(record.reportStart.getTime())) return [];
  if(!(record.reportEnd instanceof Date) || isNaN(record.reportEnd.getTime())) return [];

  const hasCampaignStart = record.campaignStart instanceof Date && !isNaN(record.campaignStart.getTime());
  const hasCampaignEnd = record.campaignEnd instanceof Date && !isNaN(record.campaignEnd.getTime());

  const effectiveStart = (hasCampaignStart && record.campaignStart > record.reportStart)
    ? record.campaignStart
    : record.reportStart;

  const effectiveEnd = (hasCampaignEnd && record.campaignEnd < record.reportEnd)
    ? record.campaignEnd
    : record.reportEnd;

  const weeks = generateAdSpendWeekRange_(effectiveStart, effectiveEnd);

  if(weeks.length === 0) return [];

  if(weeks.length === 1){

    const proratedSpent = prorateSingleWeekMetaSpend_(record, effectiveStart, effectiveEnd, weeks[0].weekStart);

    return [{ weekStart: weeks[0].weekStart, segment: segment, spent: proratedSpent }];

  }

  const perWeekSpent = (Number(record.spent) || 0) / weeks.length;

  return weeks.map(function(w){
    return { weekStart: w.weekStart, segment: segment, spent: perWeekSpent };
  });

}


/**
 * ==========================================================
 * Prorate Single-Week Meta Spend (순수 함수, 2026-08-25 신규)
 *
 * WHY
 * computeMetaRowWeeklySpend_()의 단일 주 케이스 전용 헬퍼 — 위 WHY 참고.
 * 핵심 판단: **그 주의 결측일이 "export 조회기간(reportStart/reportEnd)이
 * 좁아서" 생긴 건지, "캠페인 자체가 그 주 중간에 진짜로 시작/종료돼서" 생긴
 * 건지** 구분한다. 전자만 보정 대상 — 캠페인이 이미 그 주 월요일 이전부터
 * 활성 상태였는데(campaignStart가 그 주 월요일 이전/없음) reportStart가 그
 * 주 중간이면, 그 이전 요일들의 지출은 실제로 있었는데 export에만 안 담긴
 * 것 → 보정. 반대로 effectiveStart가 campaignStart로 결정됐다면(=캠페인이
 * 정말 그 주 중간에 막 시작함) 그 이전 요일은 진짜로 캠페인이 없어서 지출이
 * 0인 것 → 보정하면 실제보다 부풀림, 하지 않음. reportEnd/campaignEnd 쪽도
 * 동일 논리(대칭).
 *
 * **진행 중인(아직 안 끝난) 주는 보정하지 않는다(2026-09-04 버그 수정, 사용자
 * 리포트)**: 이 함수가 "export 범위가 좁아서 생긴 결측"(과거, 실제로 지출이
 * 있었는데 export만 안 담김 — 보정 타당)과 "그 주가 아직 안 끝나서 생긴
 * 결측"(미래, 아직 지출 자체가 발생하지 않음 — 보정하면 안 일어난 지출을
 * 조작하는 것)을 구분하지 못해, 진행 중인 주까지 나머지 요일을 지금까지의
 * 평균으로 부풀리고 있었음(실측: Target_REP Content 2026-08-31주, 월~수
 * 3일치 실제 $2,737.18을 7/3배 하여 $6,386.75로 표시 — 사용자가 Campaigns
 * 2.0 원본과 대조해 발견). 그 주 일요일(weekSunday)이 아직 지나지 않았으면
 * (= 다음 주 월요일이 아직 안 됐으면) 보정 없이 원본 값을 그대로 반환 — 그
 * 주가 끝난 뒤 재갱신되면 그때 정상적으로 최종값이 채워진다.
 *
 * INPUT
 * record : Object  {spent, reportStart, reportEnd, campaignStart, campaignEnd}
 * effectiveStart, effectiveEnd : Date  호출부가 이미 계산한 교집합
 * weekMonday : Date  그 주(유일하게 걸치는 주)의 월요일
 * now : Date  (optional) 기준 "오늘" — 생략 시 실제 현재 시각(테스트에서만 명시 주입)
 *
 * OUTPUT
 * number  보정된(또는 원본 그대로인) 그 주 Spent
 *
 * TEST
 * testProrateSingleWeekMetaSpend() 참고
 * ==========================================================
 */
function prorateSingleWeekMetaSpend_(record, effectiveStart, effectiveEnd, weekMonday, now){

  const spent = Number(record.spent) || 0;

  const weekSunday = addDaysToDate_(weekMonday, 6);

  const currentTime = (now instanceof Date && !isNaN(now.getTime())) ? now : new Date();
  const nextMonday = addDaysToDate_(weekMonday, 7);

  if(currentTime.getTime() < nextMonday.getTime()){
    return spent;
  }

  const hasCampaignStart = record.campaignStart instanceof Date && !isNaN(record.campaignStart.getTime());
  const hasCampaignEnd = record.campaignEnd instanceof Date && !isNaN(record.campaignEnd.getTime());

  const leftIsReportLimited =
    effectiveStart.getTime() > weekMonday.getTime() &&
    effectiveStart.getTime() === record.reportStart.getTime() &&
    (!hasCampaignStart || record.campaignStart.getTime() <= weekMonday.getTime());

  const leftIsCampaignLimited = effectiveStart.getTime() > weekMonday.getTime() && !leftIsReportLimited;

  const rightIsReportLimited =
    effectiveEnd.getTime() < weekSunday.getTime() &&
    effectiveEnd.getTime() === record.reportEnd.getTime() &&
    (!hasCampaignEnd || record.campaignEnd.getTime() >= weekSunday.getTime());

  const rightIsCampaignLimited = effectiveEnd.getTime() < weekSunday.getTime() && !rightIsReportLimited;

  // 캠페인이 그 주 중간에 진짜로 시작/종료됐다면(=진짜 결측일) 보정하지 않는다.
  if(leftIsCampaignLimited || rightIsCampaignLimited) return spent;

  const daysCovered = Math.round((effectiveEnd.getTime() - effectiveStart.getTime()) / 86400000) + 1;

  if(daysCovered <= 0 || daysCovered >= 7) return spent;

  return spent * (7 / daysCovered);

}


/**
 * ==========================================================
 * TEST — prorateSingleWeekMetaSpend_()
 * ==========================================================
 */
function testProrateSingleWeekMetaSpend(){

  const weekMonday = new Date(2026, 7, 17); // 2026-08-17
  const pastNow = new Date(2026, 7, 30);    // 이 주(8/17~8/23)가 이미 끝난 뒤 시점 — A/B/C는 전부 "완료된 과거 주" 케이스

  // Case A — 사용자 실측 케이스: 캠페인은 그 주 이전부터(8/5) 활성, export만
  // 화(8/18)~일(8/23) 6일치 → report-limited, 7/6로 보정돼야 함(과거 주라 보정 타당).
  const reportLimitedRecord = {
    spent: 8897.07,
    reportStart: new Date(2026, 7, 18),
    reportEnd: new Date(2026, 7, 23),
    campaignStart: new Date(2026, 7, 5),
    campaignEnd: new Date(2026, 8, 11)
  };

  const proratedA = prorateSingleWeekMetaSpend_(
    reportLimitedRecord, new Date(2026, 7, 18), new Date(2026, 7, 23), weekMonday, pastNow
  );

  const expectedA = 8897.07 * (7 / 6);

  // Case B — 캠페인이 그 주 수요일(8/19)에 진짜로 시작(campaignStart===effectiveStart) →
  // 월~화 이틀은 실제로 캠페인이 없어서 지출 0인 것, 보정하면 안 됨(원본 그대로).
  const campaignLimitedRecord = {
    spent: 500,
    reportStart: new Date(2026, 7, 17),
    reportEnd: new Date(2026, 7, 23),
    campaignStart: new Date(2026, 7, 19),
    campaignEnd: null
  };

  const proratedB = prorateSingleWeekMetaSpend_(
    campaignLimitedRecord, new Date(2026, 7, 19), new Date(2026, 7, 23), weekMonday, pastNow
  );

  // Case C — 7일 전체 커버(기존 정상 정밀 export) → 변화 없음.
  const fullWeekRecord = {
    spent: 1000,
    reportStart: new Date(2026, 7, 17),
    reportEnd: new Date(2026, 7, 23),
    campaignStart: new Date(2020, 0, 1),
    campaignEnd: null
  };

  const proratedC = prorateSingleWeekMetaSpend_(
    fullWeekRecord, new Date(2026, 7, 17), new Date(2026, 7, 23), weekMonday, pastNow
  );

  // Case D — 2026-09-04 버그 수정(사용자 리포트): 진행 중인(아직 안 끝난) 주는
  // report-limited로 보여도 보정하면 안 됨(미래 요일을 조작하게 됨) — 원본 그대로.
  // 실측 재현: Content 2026-08-31주, 월~수(3일) $2,737.18을 7/3로 부풀려
  // $6,386.75가 되던 버그.
  const inProgressWeekMonday = new Date(2026, 7, 31); // 2026-08-31
  const inProgressRecord = {
    spent: 2737.18,
    reportStart: new Date(2026, 7, 31),
    reportEnd: new Date(2026, 8, 2), // 2026-09-02(수)
    campaignStart: new Date(2024, 7, 14),
    campaignEnd: new Date(2026, 8, 30)
  };

  const proratedD = prorateSingleWeekMetaSpend_(
    inProgressRecord, new Date(2026, 7, 31), new Date(2026, 8, 2), inProgressWeekMonday,
    new Date(2026, 8, 4) // "오늘" = 2026-09-04(금), 그 주 일요일(9/6) 아직 안 지남
  );

  const pass =
    Math.abs(proratedA - expectedA) < 1e-9 &&
    proratedB === 500 &&
    proratedC === 1000 &&
    proratedD === 2737.18;

  Logger.log(
    "A(report-limited, 6일→7일 보정)=" + proratedA.toFixed(2) + " (expected " + expectedA.toFixed(2) + ")"
  );
  Logger.log("B(campaign-limited, 보정 안 함)=" + proratedB + " (expected 500, 원본 그대로)");
  Logger.log("C(7일 전체 커버, 변화 없음)=" + proratedC + " (expected 1000)");
  Logger.log("D(진행 중인 주, 보정 안 함)=" + proratedD + " (expected 2737.18, 원본 그대로)");
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * TEST — computeMetaRowWeeklySpend_()
 * ==========================================================
 */
function testComputeMetaRowWeeklySpend(){

  // 2주치 정밀 export(2026-08-03~08-16) — BOFU 캠페인명 패턴(기존
  // testComputeMetaRowMonthlySpend() Case A와 동일 네이밍 관례).
  const row = {
    campaignName: "KR_core_2022-01-19_book-a-consult-acqui_contact-lg",
    spent: 700,
    reportStart: new Date(2026, 7, 3),
    reportEnd: new Date(2026, 7, 16),
    campaignStart: new Date(2020, 0, 1),
    campaignEnd: null
  };

  const result = computeMetaRowWeeklySpend_(row);

  const pass =
    result.length === 2 &&
    Math.abs(result[0].spent - 350) < 1e-9 &&
    Math.abs(result[1].spent - 350) < 1e-9 &&
    result[0].weekStart.getTime() === new Date(2026, 7, 3).getTime() &&
    result[1].weekStart.getTime() === new Date(2026, 7, 10).getTime() &&
    result[0].segment === "BOFU";

  Logger.log("Result: " + JSON.stringify(result.map(function(r){
    return { weekStart: r.weekStart.toString(), segment: r.segment, spent: r.spent };
  })));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Aggregate Meta Spend By Week/Segment (순수 함수)
 *
 * WHY
 * aggregateMetaSpendByFYMonthSegment_()의 주 버전 — 동일한 "정밀 export
 * 우선" 규칙: 같은 캠페인의 같은 주를 정밀(isMetaRowWeekPrecise_()) 행과
 * 분배(장기 lump) 행이 동시에 커버하면, 분배 행의 그 주 기여분은 버리고
 * 정밀값을 채택한다.
 *
 * INPUT
 * records : Array  (readMetaRawRows_() 결과)
 *
 * OUTPUT
 * Object  키 "yyyy-MM-dd(weekStart)|segment" → 합산 Spent
 *
 * TEST
 * testAggregateMetaSpendByWeekSegment() 참고
 * ==========================================================
 */
function aggregateMetaSpendByWeekSegment_(records){

  const toKey = function(weekStart){
    return Utilities.formatDate(weekStart, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd");
  };

  const preciseCoverageByCampaign = {};

  records.forEach(function(record){

    if(!isMetaRowWeekPrecise_(record)) return;

    computeMetaRowWeeklySpend_(record).forEach(function(entry){

      const campaign = record.campaignName;

      if(!preciseCoverageByCampaign[campaign]) preciseCoverageByCampaign[campaign] = {};

      preciseCoverageByCampaign[campaign][toKey(entry.weekStart)] = true;

    });

  });

  const totals = {};

  records.forEach(function(record){

    const isPrecise = isMetaRowWeekPrecise_(record);
    const coverage = preciseCoverageByCampaign[record.campaignName];

    computeMetaRowWeeklySpend_(record).forEach(function(entry){

      const weekKey = toKey(entry.weekStart);

      if(!isPrecise && coverage && coverage[weekKey]) return;

      const key = weekKey + "|" + entry.segment;

      totals[key] = (totals[key] || 0) + entry.spent;

    });

  });

  return totals;

}


/**
 * ==========================================================
 * TEST — aggregateMetaSpendByWeekSegment_()
 * ==========================================================
 */
function testAggregateMetaSpendByWeekSegment(){

  const records = [
    {
      // 정밀(단일 주) 행 — 2026-08-03~08-09.
      campaignName: "KR_core_2022-01-19_book-a-consult-acqui_contact-lg",
      spent: 500,
      reportStart: new Date(2026, 7, 3),
      reportEnd: new Date(2026, 7, 9),
      campaignStart: new Date(2020, 0, 1),
      campaignEnd: null
    },
    {
      // 같은 캠페인의 장기 분배 행(2026-07-27~08-09, 2주 걸침) — 8/3주는
      // 위 정밀 행이 이미 커버하므로 그 주 기여분은 버려지고 7/27주만 채택.
      campaignName: "KR_core_2022-01-19_book-a-consult-acqui_contact-lg",
      spent: 1000,
      reportStart: new Date(2026, 6, 27),
      reportEnd: new Date(2026, 7, 9),
      campaignStart: new Date(2020, 0, 1),
      campaignEnd: null
    }
  ];

  const result = aggregateMetaSpendByWeekSegment_(records);

  const pass =
    result["2026-08-03|BOFU"] === 500 &&        // 정밀값 채택(분배 행의 500 안 더해짐)
    result["2026-07-27|BOFU"] === 500 &&        // 분배 행의 7/27주 기여분(1000/2)
    Object.keys(result).length === 2;

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Meta Spend Weekly Summary (IO 래퍼)
 * ==========================================================
 */
function computeMetaSpendWeeklySummary_(){

  return aggregateMetaSpendByWeekSegment_(readMetaRawRows_());

}


/**
 * ==========================================================
 * TEMP — computeMetaSpendWeeklySummary_() 수동 실행/확인용 공개 진입점
 * ==========================================================
 */
function runComputeMetaSpendWeeklySummary(){

  const summary = computeMetaSpendWeeklySummary_();

  Logger.log(JSON.stringify(summary, null, 2));

}


/**
 * ==========================================================
 * TEMP — Meta_Raw 첫 행 진단 (집계 결과가 빈 경우 원인 확인용)
 *
 * WHY (2026-07-30)
 * 사용자가 데이터를 붙여넣었는데 runComputeMetaSpendSummary()가 {}를
 * 반환하는 문제 발생 — 헤더명 불일치 또는 날짜 컬럼이 텍스트로 들어간
 * 경우를 눈으로 바로 확인하기 위한 진단 함수. sheetToObjects()가 실제로
 * 어떤 키/타입으로 읽는지 그대로 보여준다.
 * ==========================================================
 */
function runDebugMetaRawFirstRow(){

  const ss = SpreadsheetApp.openById(AD.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(AD.RAW_SHEET.Meta);

  if(!sheet){
    Logger.log("Meta_Raw 시트를 못 찾음 — setupMetaRawSheet() 먼저 실행하세요.");
    return;
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  Logger.log("Meta_Raw lastRow=" + lastRow + ", lastCol=" + lastCol);

  if(lastRow === 0){
    Logger.log("시트가 완전히 비어있음(헤더도 없음).");
    return;
  }

  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  Logger.log("헤더(실제 시트): " + JSON.stringify(headerRow));
  Logger.log("헤더(AD_001_Config.js 매핑 기대값): " + JSON.stringify(AD.META.COLUMNS));

  const records = sheetToObjects(sheet);

  Logger.log("sheetToObjects()로 읽은 행 수: " + records.length);

  if(records.length > 0){

    const first = records[0];
    const cols = AD.META.COLUMNS;

    Logger.log("첫 행 원본: " + JSON.stringify(first));

    Object.keys(cols).forEach(function(key){

      const headerName = cols[key];
      const value = first[headerName];

      Logger.log(
        key + " (헤더 \"" + headerName + "\") => " +
        JSON.stringify(value) + "  [type: " +
        (value instanceof Date ? "Date" : typeof value) + "]"
      );

    });

  }

}


/**
 * ==========================================================
 * TEMP — 특정 FY/Month 세그먼트별 캠페인 상세 내역 진단
 *
 * WHY (2026-07-30)
 * 사용자가 26|JUL 실제 지출(Content ≈22,922 / BOFU ≈3,904)과 집계 결과
 * (Content 27,753 / BOFU 2,999)가 서로 반대 방향으로 어긋난다고 리포트 —
 * 날짜 분배 문제라면 보통 같은 방향으로 틀리므로, 특정 캠페인이 Content↔BOFU
 * 사이에서 잘못 분류됐을 가능성이 높다. 세그먼트별로 어떤 캠페인이 얼마나
 * 잡혔는지 눈으로 확인하기 위한 진단 함수 — 대상 FY/Month는 아래 상수를
 * 직접 고쳐서 재사용.
 * ==========================================================
 */
function runDebugMetaSpendByCampaignForMonth(){

  const targetFY = 26;
  const targetMonth = "JUL";

  const records = readMetaRawRows_();
  const details = [];

  records.forEach(function(record){

    computeMetaRowMonthlySpend_(record).forEach(function(entry){

      if(entry.fy === targetFY && entry.month === targetMonth){

        details.push({
          campaign: record.campaignName,
          segment: entry.segment,
          spent: entry.spent
        });

      }

    });

  });

  details.sort(function(a, b){
    if(a.segment !== b.segment) return a.segment < b.segment ? -1 : 1;
    return b.spent - a.spent;
  });

  Logger.log("FY" + targetFY + " " + targetMonth + " — 캠페인별 기여 내역 (" + details.length + "건)");

  details.forEach(function(d){
    Logger.log(d.segment + " | " + d.spent.toFixed(2) + " | " + d.campaign);
  });

}


/**
 * ==========================================================
 * TEMP — Meta_Raw 마지막 N행 진단 (정밀 export 우선 규칙이 왜 안 먹는지 확인용)
 *
 * WHY (2026-07-30)
 * 사용자가 손으로 계산한 값(BOFU/Content)은 새로 붙여넣은 데이터와 정확히
 * 일치했는데, 실제 runComputeMetaSpendSummary() 결과는 여전히 어긋남 —
 * 즉 데이터 자체는 맞는데 코드가 이 행들을 "정밀"로 인식 못 하고 있을
 * 가능성이 높음(예: 붙여넣은 날짜가 실제 Date가 아니라 텍스트로 들어감).
 * 마지막 N행의 reportStart/reportEnd 실제 타입과 isMetaRowMonthPrecise_()
 * 판정 결과를 그대로 보여준다.
 * ==========================================================
 */
function runDebugMetaRawLastRows(){

  const n = 10;

  const ss = SpreadsheetApp.openById(AD.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(AD.RAW_SHEET.Meta);

  if(!sheet){
    Logger.log("Meta_Raw 시트를 못 찾음.");
    return;
  }

  const records = readMetaRawRows_();

  Logger.log("전체 행 수: " + records.length + " — 마지막 " + n + "행 확인");

  records.slice(-n).forEach(function(record, i){

    const precise = isMetaRowMonthPrecise_(record);

    Logger.log(
      "[" + (records.length - n + i + 1) + "] " + record.campaignName +
      " | reportStart=" + JSON.stringify(record.reportStart) +
      " (type=" + (record.reportStart instanceof Date ? "Date" : typeof record.reportStart) + ")" +
      " | reportEnd=" + JSON.stringify(record.reportEnd) +
      " (type=" + (record.reportEnd instanceof Date ? "Date" : typeof record.reportEnd) + ")" +
      " | isPrecise=" + precise
    );

  });

  // 캠페인명 중복(같은 캠페인이 lump 행과 precise 행 양쪽에 존재하는지) 확인 —
  // 이름이 한 글자라도 다르면 커버리지 매칭이 실패해 override가 안 먹는다.
  const nameCounts = {};

  records.forEach(function(record){
    nameCounts[record.campaignName] = (nameCounts[record.campaignName] || 0) + 1;
  });

  const duplicated = Object.keys(nameCounts).filter(function(name){
    return nameCounts[name] > 1;
  });

  Logger.log("2번 이상 등장하는 캠페인명 수: " + duplicated.length +
    " (0이면 이름이 안 겹쳐서 override 자체가 발동 안 될 수 있음)");

  duplicated.slice(0, 5).forEach(function(name){
    Logger.log("  중복 예시: \"" + name + "\" (" + nameCounts[name] + "회)");
  });

}


/**
 * ==========================================================
 * TEMP — 특정 캠페인의 Target_REP Actual CPNP1 반영 여부 추적 진단
 *
 * WHY (2026-08-25)
 * 사용자 리포트: "KR_core_2026-08-05_consolidated-retargeting-lplg_event-online"
 * 같은 메인 프로그램 외 사이드 리타겟팅 캠페인이 Target_REP Actual CPNP1
 * 계산에 반영 안 되는 것 같다 — Meta_Raw 존재 여부/`getBusinessSegment()`
 * 세그먼트 분류/`computeMetaRowWeeklySpend_()` 주간 분배/Target_Engine
 * Cutover Date 게이트/`Ad_Spend_Cache_Weekly` 캐시 반영까지 파이프라인 전
 * 구간을 한 번에 짚어 어느 단계에서 빠지는지 확인한다. 대상 캠페인 키워드는
 * 아래 상수를 직접 고쳐서 재사용.
 * ==========================================================
 */
function runDebugTargetCampaignTrace(){

  const keyword = "consolidated-retargeting-lplg";

  const records = readMetaRawRows_().filter(function(r){
    return String(r.campaignName || "").toLowerCase().indexOf(keyword.toLowerCase()) !== -1;
  });

  Logger.log("Meta_Raw에서 \"" + keyword + "\" 포함 캠페인 " + records.length + "건 발견");

  if(records.length === 0){
    Logger.log("=> Meta_Raw 자체에 해당 캠페인 데이터가 없음 — Meta Ads Manager export를 다시 확인/붙여넣기 필요.");
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const engineSheet = ss.getSheetByName(CONFIG.TARGET.ENGINE_SHEET);
  const cutoverDate = engineSheet ? readTargetEngineInputs_(engineSheet).cutoverDate : null;
  const cutoverMonday = (cutoverDate instanceof Date && !isNaN(cutoverDate.getTime()))
    ? getMondayOfWeek_(cutoverDate) : null;

  Logger.log("Cutover Monday: " + (cutoverMonday ? cutoverMonday.toString() : "(Target_Engine Cutover Date 읽기 실패)"));

  const weeklyCacheMap = readAdSpendWeeklyCacheMap_();

  records.forEach(function(record){

    const segment = getBusinessSegment(record.campaignName);

    Logger.log(
      "\n캠페인: " + record.campaignName +
      "\n  Spent=" + record.spent +
      " reportStart=" + JSON.stringify(record.reportStart) +
      " reportEnd=" + JSON.stringify(record.reportEnd) +
      " campaignStart=" + JSON.stringify(record.campaignStart) +
      " campaignEnd=" + JSON.stringify(record.campaignEnd) +
      "\n  getBusinessSegment() => " + segment
    );

    const weeklyEntries = computeMetaRowWeeklySpend_(record);

    if(weeklyEntries.length === 0){
      Logger.log("  => 주간 분배 결과 0건(reportStart/reportEnd 유효성 또는 활성기간 겹침 없음 확인 필요)");
      return;
    }

    weeklyEntries.forEach(function(entry){

      const weekKey = Utilities.formatDate(entry.weekStart, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd");
      const beforeCutover = cutoverMonday && entry.weekStart < cutoverMonday;
      const cacheKey = weekKey + "|" + entry.segment;
      const cacheValue = weeklyCacheMap[cacheKey];

      Logger.log(
        "  " + weekKey + " | segment=" + entry.segment + " | 분배액=" + entry.spent.toFixed(2) +
        (beforeCutover ? " | ⚠️ Cutover 이전 주 — Ad_Spend_Cache_Weekly에서 애초에 제외됨" : "") +
        " | Ad_Spend_Cache_Weekly[" + cacheKey + "]=" +
        (cacheValue === undefined ? "(없음 — 캐시 미반영/미갱신 가능성)" : cacheValue.toFixed(2))
      );

    });

  });

}


/**
 * ==========================================================
 * TEMP — Webinar 8월 Spend 전수 감사 (캐시 vs 실시간, 캠페인별 내역)
 *
 * WHY (2026-08-25)
 * 사용자 리포트: 8월 Webinar 집행비용 27,635.75 / New P1 93건이면 CPNP1이
 * 270+ 나와야 하는데, Target_REP 주별 Actual CPNP1이 $162.77/$188.59/$163.44로
 * 훨씬 낮게(=달성으로 잘못) 표시됨. `runDebugTargetCampaignTrace()`로 확인한
 * 개별 캠페인 1건은 정상 반영되고 있었으나, 8/3·8/10·8/17 3주 캐시 합계
 * (5371.49+5469.04+5066.75=15907.28)가 사용자 총액(27,635.75)과 약 11,728
 * 차이 — 이 정도 격차는 캠페인 1건 문제가 아니라 더 넓은 원인(캐시가 최신
 * Meta_Raw를 반영 못했거나, 다른 Webinar 캠페인 다수가 누락/오분류)일
 * 가능성이 높음. 이 함수는 (1) 캐시값과 지금 Meta_Raw로 즉석 재계산한 값을
 * 주별로 나란히 비교(캐시 staleness 확인)하고, (2) Meta_Raw 전체에서
 * Webinar로 분류되는 AUG 캠페인을 캠페인별로 나열해 눈으로 사용자의 27,635.75
 * 산출과 대조할 수 있게 한다.
 *
 * **주의**: (2)의 캠페인별 목록/합계는 `computeMetaRowMonthlySpend_()`를
 * 캠페인별로 그대로 나열한 것이라 "정밀 export 우선" 중복 제거가 적용 안 됨
 * (같은 캠페인이 lump/정밀 두 행으로 겹치면 합계가 실제보다 부풀 수 있음) —
 * 공식 월 합계는 별도로 `computeMetaSpendSummary_()`(중복 제거 적용)로 함께
 * 출력하니 그 값을 기준으로 판단할 것, 캠페인별 목록은 어떤 캠페인이 있는지
 * 확인하는 용도로만 사용.
 * ==========================================================
 */
function runDebugTargetWebinarAugustSpendAudit(){

  const segment = "Webinar";
  const weeklyWeeks = ["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24"];

  Logger.log("=== 1) " + segment + " 주별 Spend — 저장된 캐시 vs 지금 Meta_Raw로 즉석 재계산(Meta만, Naver/Kakao 제외) ===");

  const liveWeekly = computeMetaSpendWeeklySummary_();
  const cachedWeekly = readAdSpendWeeklyCacheMap_();

  let liveTotal = 0;
  let cachedTotal = 0;

  weeklyWeeks.forEach(function(weekKey){

    const key = weekKey + "|" + segment;
    const liveValue = liveWeekly[key] || 0;
    const cachedValue = cachedWeekly[key] || 0;

    liveTotal += liveValue;
    cachedTotal += cachedValue;

    Logger.log(
      weekKey + " | 캐시(Ad_Spend_Cache_Weekly, Meta+Naver+Kakao)=" + cachedValue.toFixed(2) +
      " | 즉석 재계산(Meta만)=" + liveValue.toFixed(2) +
      (Math.abs(liveValue - cachedValue) > 1 ? "  ⚠️ 차이 " + (liveValue - cachedValue).toFixed(2) : "")
    );

  });

  Logger.log(
    "4주 합계 | 캐시=" + cachedTotal.toFixed(2) + " | 즉석 재계산(Meta만)=" + liveTotal.toFixed(2) +
    " | 사용자 제시 총액=27635.75"
  );

  Logger.log(
    "\n=== 2) 공식 월간 합계(중복 제거 적용, computeMetaSpendSummary_) — FY27 AUG " + segment + " ==="
  );

  const officialMonthly = computeMetaSpendSummary_();
  Logger.log("27|AUG|" + segment + " = " + (officialMonthly["27|AUG|" + segment] || "(없음)"));

  const cachedMonthly = readAdSpendCacheMap_();
  Logger.log("Ad_Spend_Cache(월 단위) 27|AUG|" + segment + " = " + (cachedMonthly["27|AUG|" + segment] !== undefined ? cachedMonthly["27|AUG|" + segment] : "(없음)"));

  Logger.log("\n=== 3) Meta_Raw에서 " + segment + "로 분류되는 AUG 캠페인 전체 내역(중복 제거 미적용 — 참고용) ===");

  const records = readMetaRawRows_();
  const details = [];

  records.forEach(function(record){

    computeMetaRowMonthlySpend_(record).forEach(function(entry){

      if(entry.segment === segment && entry.month === "AUG"){
        details.push({
          campaign: record.campaignName,
          fy: entry.fy,
          spent: entry.spent,
          isPrecise: isMetaRowMonthPrecise_(record)
        });
      }

    });

  });

  details.sort(function(a, b){ return b.spent - a.spent; });

  let listTotal = 0;

  details.forEach(function(d){
    listTotal += d.spent;
    Logger.log(
      "FY" + d.fy + " AUG | " + d.spent.toFixed(2) + (d.isPrecise ? " (정밀)" : " (분배)") + " | " + d.campaign
    );
  });

  Logger.log("목록 합계(중복 제거 미적용, 참고용) = " + listTotal.toFixed(2) + " — " + details.length + "건");

}


/**
 * ==========================================================
 * TEMP — 특정 주(월~일)에 걸치는 전체 캠페인 세그먼트 무관 전수 감사
 *
 * WHY (2026-08-25)
 * `runDebugTargetWebinarAugustSpendAudit()`로 캐시 staleness는 해결했지만
 * (8/17주 캐시 5,066.75→9,154.25로 갱신), 사용자 실측(8/17~23주 Meta 실제
 * 집행 10,443.03)과 비교하면 캐시 갱신 후에도, 심지어 Meta+Naver+Kakao를
 * 다 더한 캐시값(9,154.25)조차 여전히 1,288.78 부족 — 이제 "캐시가 오래됨"
 * 문제가 아니라 "그 주에 Meta_Raw가 갖고 있는 캠페인 중 일부가 Webinar가
 * 아닌 다른 세그먼트로 분류되고 있거나, 정밀 export 우선 규칙에 의해 그
 * 주 기여분이 잘못 버려지고 있거나(dropped), 애초에 Meta_Raw에 그 주를
 * 커버하는 캠페인이 부족한 것"인지 좁혀야 한다. 이 함수는 대상 주(아래
 * 상수, 기본 2026-08-17)에 걸치는 Meta_Raw의 **모든** 캠페인을 세그먼트
 * 무관하게 나열하고, 정밀 우선 규칙으로 그 주 기여분이 버려진(dropped)
 * 행도 표시해 어디서 얼마가 빠지는지 한눈에 보여준다.
 * ==========================================================
 */
function runDebugTargetWeekAllSegmentsAudit(){

  const targetWeekStart = new Date(2026, 7, 17); // 2026-08-17(월)

  const toKey = function(weekStart){
    return Utilities.formatDate(weekStart, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd");
  };

  const targetKey = toKey(targetWeekStart);

  const records = readMetaRawRows_();

  // aggregateMetaSpendByWeekSegment_()와 동일한 "정밀 우선" 커버리지 계산
  // (같은 캠페인의 같은 주를 정밀 행이 커버하면 분배 행의 그 주 기여분은 버려짐).
  const preciseCoverageByCampaign = {};

  records.forEach(function(record){

    if(!isMetaRowWeekPrecise_(record)) return;

    computeMetaRowWeeklySpend_(record).forEach(function(entry){

      const campaign = record.campaignName;

      if(!preciseCoverageByCampaign[campaign]) preciseCoverageByCampaign[campaign] = {};

      preciseCoverageByCampaign[campaign][toKey(entry.weekStart)] = true;

    });

  });

  const bySegmentTotal = {};
  const rowsForWeek = [];

  records.forEach(function(record){

    const isPrecise = isMetaRowWeekPrecise_(record);
    const coverage = preciseCoverageByCampaign[record.campaignName];

    computeMetaRowWeeklySpend_(record).forEach(function(entry){

      const weekKey = toKey(entry.weekStart);

      if(weekKey !== targetKey) return;

      const dropped = !isPrecise && !!(coverage && coverage[weekKey]);

      if(!dropped){
        bySegmentTotal[entry.segment] = (bySegmentTotal[entry.segment] || 0) + entry.spent;
      }

      rowsForWeek.push({
        campaign: record.campaignName,
        segment: entry.segment,
        spent: entry.spent,
        isPrecise: isPrecise,
        dropped: dropped,
        reportStart: record.reportStart,
        reportEnd: record.reportEnd
      });

    });

  });

  Logger.log("=== " + targetKey + "(월~일) 주 — 세그먼트별 Spend 합계(정밀 우선 규칙 적용, dropped 제외) ===");

  Object.keys(bySegmentTotal).sort().forEach(function(seg){
    Logger.log(seg + " = " + bySegmentTotal[seg].toFixed(2));
  });

  Logger.log("\n=== " + targetKey + " 주에 걸치는 Meta_Raw 전체 캠페인 내역(세그먼트 무관, dropped 표시 포함) ===");

  rowsForWeek.sort(function(a, b){
    if(a.segment !== b.segment) return a.segment < b.segment ? -1 : 1;
    return b.spent - a.spent;
  });

  let adoptedTotal = 0;

  rowsForWeek.forEach(function(r){

    if(!r.dropped) adoptedTotal += r.spent;

    // "정밀"이 같은 주(월~일) 안에 있다는 것만 확인할 뿐, reportStart가 실제로
    // 그 주의 월요일이고 reportEnd가 일요일인지(=7일 전체를 커버하는지)는 별도
    // 확인 필요 — 부분(예: 수~일) export가 "정밀"로 인식돼 분배값을 통째로
    // 대체해버리면 나머지 요일분이 누락될 수 있다(이 진단의 핵심 가설).
    const spansFullWeek = r.isPrecise &&
      r.reportStart instanceof Date && r.reportEnd instanceof Date &&
      r.reportStart.getDay() === 1 && r.reportEnd.getDay() === 0;

    Logger.log(
      r.segment + " | " + r.spent.toFixed(2) + (r.isPrecise ? " (정밀)" : " (분배)") +
      (r.dropped ? " ⚠️DROPPED(같은 캠페인 정밀 우선으로 그 주 기여분 제외됨)" : "") +
      (r.isPrecise ? " | reportStart=" + Utilities.formatDate(r.reportStart, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd(E)") +
        " reportEnd=" + Utilities.formatDate(r.reportEnd, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd(E)") +
        (spansFullWeek ? "" : " ⚠️7일 전체 커버 아님(부분 export 의심)") : "") +
      " | " + r.campaign
    );

  });

  Logger.log("\n전체 채택 합계(세그먼트 무관, dropped 제외) = " + adoptedTotal.toFixed(2) + " — " + rowsForWeek.length + "행");

}
