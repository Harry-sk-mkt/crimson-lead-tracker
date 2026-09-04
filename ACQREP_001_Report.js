/**
 * ==========================================================
 * Marketing 2.0
 * ACQ Report
 *
 * Responsibility
 * Acquisition Report (Engine + Report 영역). New Leads/New P1은 Cohort
 * (Create Date) 기준, All Leads/All P1은 Touch(MTA Created Date) 기준,
 * SAL/IC Booked/IC Complete는 각자의 이벤트 날짜(Sales Accepted Date/IC
 * Booked Date/IC Completed Date, Leads_OPS 기준) 기준 (v1.4.0부터 IC
 * Booked/Complete, v1.6.0부터 SAL — 아래 Change Log 참고). Revenue는
 * v1.9.0부터 Leads_OPS가 아니라 **Deal Tracker**의 Close Date/Segment 분류
 * 기준(2트랙 아키텍처, CLAUDE.md #7) — computeACQDealRevenueFromRows_() 참고.
 * Cohort 관점(획득 월 기준 다운스트림 퍼널)은 추후 NewP1_REP가 별도로 담당할 예정.
 *
 * Stage
 * 20 Reporting
 *
 * Version
 * v1.20.0
 *
 * Change Log
 * v1.20.0 (2026-09-05)
 * - **`handleReportGenerateEdit()`에 `isPipelineTailRunning_()` 가드 추가**
 *   (`docs/OpenItems.md` #46) — installable onEdit이 파이프라인 tail 자신의
 *   리포트 시트 쓰기에도 재발동해 Apps Script 락 경합으로 Engine 구간이
 *   2~3배 느려지던 문제 수정. 상세: `MASTER_002_PipelineAsync.js` v1.29.0.
 * v1.19.2 (2026-09-03)
 * - **SAL Segment 분리(사용자 설계 확정)**: `computeOPSAggregates_()`의 SAL/
 *   salWeekly/salP1Weekly 버킷이 이제 새 "SAL Segment" 컬럼(Leads_OPS,
 *   `MASTER_010_SALSync.js` v1.2.0이 SAL_Raw의 Last MKT UTM Campaign/Last
 *   Touch Detail로 독립 분류해 기록)을 읽음 — 기존 "Business Segment"(First
 *   Touch 고정값)는 New Leads/New P1/IC Booked/IC Complete만 계속 사용.
 *   ACQ_REP은 코호트가 아니라 이벤트 기준 리포트(위 Responsibility 참고)라
 *   같은 리드가 New Leads에서는 Search, SAL에서는 BOFU로 잡히는 게 의도된
 *   동작. `refreshACQSummarySALDelta_()`(SAL Sync 델타 경로)가 이미 같은
 *   값을 쓰고 있었으므로, 이 변경으로 Leads/MTA Import의 `refreshACQSummary_()`
 *   (전체 재계산)가 그 델타 결과를 도로 First Touch 값으로 덮어쓰는 불일치가
 *   해소됨.
 * v1.19.1 (2026-09-03)
 * - **회귀 수정 — 주 단위 집계 추가 후 `refreshACQSummary_()`가 24.7s → 122.5s로
 *   5배 느려짐(사용자 실측)**. 원인: v1.19.0에서 추가한 weekKey 계산이 3만6천+행
 *   루프마다 `Utilities.formatDate()`(서비스 호출)를 호출 — 이 프로젝트가
 *   2026-08-06에 Deal Tracker 경로에서 이미 한 번 겪은 것과 동일한 성능
 *   클래스(위 v1.14.4 참고). 신규 순수 함수 `formatWeekKeyDate_()`로 교체 —
 *   `CONFIG.DATE.TIMEZONE`이 `Session.getScriptTimeZone()`(런타임 자체
 *   타임존)이라 `getMondayOfWeek_()`의 로컬 Date 컴포넌트와 항상 일치하므로
 *   순수 JS 포맷도 기존과 바이트 단위로 동일한 결과(타임존 변환이 실제로
 *   일어나지 않는 케이스). 값/로직 변경 없음, 호출 방식만 교체.
 * v1.19.0 (2026-09-03)
 * - `computeMTAAggregates_()`/`computeOPSAggregates_()`에 주 단위 서브맵
 *   (`allLeadsWeekly`/`newLeadsWeekly`/`newP1Weekly`/`salWeekly`/`salP1Weekly`)
 *   추가(additive, 기존 월 단위 반환값 변경 없음) — `ACQREP_002_Summary.js`
 *   v1.4.0의 신규 `refreshACQSummaryWeekly_()`가 소비(`docs/OpenItems.md`
 *   #41 계열, S&M_REP 전체 재스캔 제거 목적). 같은 루프 안에서 `getMondayOfWeek_()`
 *   (`TARGET_001_Engine.js`)로 weekKey만 추가 계산 — 추가 IO 없음. SAL P1은
 *   isEffectiveP1_() 판정 한 줄만 SAL 블록에 추가한 신규 계산(월 단위
 *   ACQ_Summary엔 없던 지표, S&M 전용 수요).
 * v1.18.0 (2026-08-18)
 * - `handleReportGenerateEdit()`에 S&M_REP 분기 추가(`CONFIG.SM_REP.SHEET`
 *   → `handleSMReportGenerateEdit_()`, SMREP_001_Report.js 신규) — 신규
 *   리포트 S&M_REP도 이 파일이 소유한 공용 설치형 onEdit 트리거를 그대로
 *   재사용(사용자 요청, 별도 트리거 설치 절차 불필요).
 * v1.17.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `30_ACQReport.js` → 신규 `ACQREP_001_Report.js`, 코드 내용 변경 없음.
 * v1.17.0 (2026-08-09)
 * - **CPNP1 On Track 판정 추가**(사용자 요청 — ACQ_REP에 이미 수동으로 만들어둔
 *   X열 "CPNP1" 컬럼에 On Track 강조를 붙여달라는 요청). CPNP1은 낮을수록
 *   좋은 지표라 Actual ≤ Target이면 On Track(사용자 확정, Revenue/New P1과
 *   방향 반대). Target CPNP1 = targetLookup.spent(Target_Engine Block 0 수동
 *   Spent) ÷ New P1 Target(기존 targetLookup 재사용, 새 조회 없음). Actual
 *   CPNP1은 X열을 읽지 않고 Spent(Ad_Spend_Cache)÷New P1을 독립 계산 — X열
 *   값/수식은 전혀 안 건드림(사용자 수동 영역 원칙 유지). onTrackRows에 4번째
 *   원소로 추가, 32_ACQReportStyles.js가 색칠/볼드 적용. Revenue/New P1과
 *   달리 누적 카운트가 아니라 비율이라 주간 페이스 보정은 적용 안 함.
 * v1.16.0 (2026-08-09)
 * - **F/H/J/T/V(All P1%/New Leads%/New P1%/Revenue Target%/New P1 Target%)를
 *   값 대신 실제 시트 수식으로 전환**(사용자 요청 — 수동 입력값 수정 시
 *   파이프라인 재실행 없이 자동 재계산). F/H/J는 `buildRatioFormula_()`
 *   (분모 0 → 0, 기존과 동일), T/V는 `buildGuardedRatioFormula_()`(Target
 *   자체가 없거나 0이면 공란 — 기존 hasOwnProperty 기반 분기와 동일 결과).
 *   두 함수 다 54_Events_Write.js 정의 재사용. On Track 하이라이트
 *   (revenueOnTrack/newP1OnTrack)는 원본 값 기반 계산이라 영향 없음.
 * v1.15.0 (2026-08-06)
 * - **F/J/S/T/V 컬럼 하이라이트 재설계**(사용자 요청): F(All P1%)/J(New P1%)는
 *   세그먼트별 상위 25%(0 제외) 조건부 서식(32_ACQReportStyles.js
 *   applyACQSegmentPercentileHighlightRules_() 신규)로, S(Revenue Target)/
 *   T(Revenue Target%)/V(New P1 Target%)는 "On Track"(주간 페이스 —
 *   Target÷그 달의 주 수 대비 실적) 하이라이트로 교체(색상 전부 #01ef18).
 *   On Track 판정은 90_TargetEngine.js computeWeeksInMonthCountsForFYRange_()
 *   (신규)로 구한 월별 주 수 기준 — S/T는 Revenue(N), V는 New P1(I) 실적과
 *   비교(사용자 확정). generateACQReport_()에서 onTrackRows 배열로 계산해
 *   applyACQReportStyles_(sheet, rowCount, onTrackRows)에 전달(시그니처
 *   확장, 기존 2-인자 호출부는 이 파일 안에 이것 하나뿐이라 영향 없음).
 * v1.14.5 (2026-08-06)
 * - **비동기 트리거 방식 → 동기 방식으로 재전환**(사용자 확정): Apps Script
 *   시간 기반 1회성 트리거(schedulePipelineTail_())가 "1초 후 실행"을
 *   요청해도 실제로는 1~2분+ 지연될 수 있음이 실측 확인됨(중복 예약 버그
 *   수정(08_PipelineAsync.js v1.12.1) 이후에도 재현 — 플랫폼 자체의
 *   디스패치 지연으로 판명). DealTracker_Engine 캐시 도입(v1.14.4)으로
 *   refreshAndGenerateACQReport_() 자체가 충분히 빨라져서(대부분 수 초~1분),
 *   예측 불가능한 트리거 지연보다 동기 실행이 체감상 나음. `handleACQReportGenerateEdit_()`
 *   가 다시 try/finally로 동기 호출, `runACQReportGenerateTail()`은 트리거
 *   핸들러가 아닌 수동 테스트 진입점으로 격하.
 * v1.14.4 (2026-08-06)
 * - **성능 개선 — DealTracker_Engine 캐시 도입**(사용자 요청 — "딜 트랙커를
 *   직접 불러오지말고 엔진을 하나 만들자"): refreshACQSummaryRevenueOnly_()
 *   여전히 37초가 걸렸는데(외부 openById() 자체 비용 + Deal Tracker 전체
 *   행마다 Utilities.formatDate() 호출), readDealTrackerRawRows_()가 이제
 *   내부 캐시(90_TargetEngine.js DealTracker_Engine)만 읽도록 전환됨에
 *   따라 refreshAndGenerateACQReport_()에 appendNewDealTrackerRows_()
 *   (신규 딜만 증분 동기화, 일주일에 몇 건 수준이라 빠름)를 먼저 호출하도록
 *   추가 — Revenue는 이 클릭 시점까지 여전히 최신, 속도는 캐시 읽기 수준.
 * v1.14.3 (2026-08-06)
 * - **성능 개선 — refreshAndGenerateACQReport_()를 Revenue 전용으로 축소**:
 *   v1.14.2까지도 여전히 refreshAdSpendCache_()(외부 API)+refreshACQSummary_()
 *   (MTA_Master 8만+행/Leads_OPS 3만5천+행 전체 스캔)를 백그라운드에서
 *   실행했는데, 실측 211초가 걸려 회의 중 활용이 불가능했음(사용자 확인,
 *   Cloud Logs). All Leads/New P1/SAL/IC Booked/IC Complete는 Leads/MTA
 *   Import 시에만 바뀌고 이미 백그라운드 파이프라인이 최신 유지 중이라
 *   Generate 시점 재스캔이 무의미하다는 걸 확인 — Revenue(Deal Tracker)만
 *   Import와 무관하게 바뀔 수 있어 재조회 가치가 있음(사용자 확정, Spent는
 *   이번 범위에서 제외). `refreshACQSummaryRevenueOnly_()`(31_ACQSummary.js
 *   v1.3.0)로 교체 — MTA_Master/Leads_OPS 스캔 없이 Deal Tracker Revenue만
 *   병합, Deal Tracker 읽기 시간 수준(수 초)으로 단축 예상.
 * v1.14.2 (2026-08-06)
 * - **버그 수정 — Generate 체크박스가 완료까지(70초+) 체크된 채 멈춰있음**
 *   (사용자 확인, Cloud Logs Duration 70.223s): v1.14.1에서
 *   refreshAndGenerateACQReport_()를 handleACQReportGenerateEdit_() 안에서
 *   동기 호출하도록 바꿨는데, refreshAdSpendCache_()(외부 API)/
 *   refreshACQSummary_()(MTA_Master/Leads_OPS 전체 스캔)가 원래 무거운
 *   작업이라 체크박스가 그 시간만큼 멈춰있는 것처럼 보였음. 다시
 *   schedulePipelineTail_("runACQReportGenerateTail")로 설치형 1회성
 *   트리거에 위임하도록 변경(체크박스는 즉시 리셋) — 이번엔
 *   handleReportGenerateEdit()가 이미 설치형 트리거(Full Authorization)로
 *   실행되는 중이라, v1.14.0에서 Simple Trigger 안에서 시도했다 실패했던
 *   것과 달리 `ScriptApp.newTrigger()` 호출이 정상 동작함.
 * v1.14.1 (2026-08-06)
 * - **버그 수정 — v1.14.0의 트리거 위임 방식이 실제로는 동작 안 함(실측
 *   확인)**: `onEdit()` Simple Trigger 안에서 `schedulePipelineTail_()`
 *   (`ScriptApp.newTrigger()` 호출)를 호출하는 것 자체가 "Specified
 *   permissions are not sufficient to call ScriptApp.newTrigger" 에러로
 *   실패 — Simple Trigger는 외부 스프레드시트/API 호출뿐 아니라 **트리거
 *   설치 자체도** 제한된 권한 밖이라 못 함. **올바른 해결**: 스케줄링이
 *   아니라 `onEdit(e)` 함수 자체를 `handleReportGenerateEdit(e)`로 개명해
 *   GAS가 더 이상 이걸 Simple Trigger로 자동 인식하지 않게 하고, 신규
 *   `runInstallReportGenerateTrigger()`(1회성 수동 Run)로 이 함수를
 *   **설치형(Installable) onEdit 트리거**로 등록 — 설치형 트리거는 등록한
 *   사용자의 Full Authorization으로 실행되므로 그 안에서 refresh를 직접
 *   동기 호출해도 문제없음. `handleACQReportGenerateEdit_()`는 다시 동기
 *   try/finally로 되돌리되, `generateACQReport_()` 대신 신규
 *   `refreshAndGenerateACQReport_()`(구 `runACQReportGenerateTail()`을
 *   개명 — 더 이상 트리거 핸들러가 아니라 일반 헬퍼라 `deleteTriggersByHandlerName_()`
 *   호출 제거)를 호출. **사용자가 `runInstallReportGenerateTrigger()`를
 *   Apps Script 편집기에서 1회 실행해야 실제로 동작함.**
 * v1.14.0 (2026-08-06, 이 방식은 실패 — 위 v1.14.1 참고)
 * - **버그 수정 — Generate 시 이전 실행분 서식(배경색/테두리)이 새 범위 밖에
 *   남음**: 새 Generate가 이전보다 행 수가 적으면(예: 기간을 좁혀서 재생성),
 *   `.clearContent()`만 호출해 값은 지워지지만 배경색/테두리는 남아있었음
 *   (사용자 발견 — "A5: 데이터 들어가는 영역의 서식이 generate를 할 때
 *   여전히 남아있어"). 이전 실행 범위(A:N/Target 4컬럼/Spent)에
 *   `.clearFormat()`을 추가로 호출해 서식까지 완전히 초기화 —
 *   `applyACQReportStyles_()`가 새 행 수만큼만 다시 서식을 입히므로, 그
 *   범위를 벗어난 행은 이제 완전히 빈 상태로 남음.
 * - **Generate를 설치형 트리거로 위임(사용자 요청 — "트리거 형태로 구현
 *   못하나?")**: `handleACQReportGenerateEdit_()`(onEdit Simple Trigger)가
 *   `generateACQReport_()`를 직접 호출하는 대신, 체크박스를 즉시 리셋하고
 *   `schedulePipelineTail_("runACQReportGenerateTail")`
 *   (08_PipelineAsync.js 기존 인프라 재사용)로 설치형 1회성 트리거를
 *   예약하도록 변경. 신규 `runACQReportGenerateTail()`(Full Authorization)이
 *   `refreshAdSpendCache_()`/`refreshACQSummary_()`(Deal Tracker
 *   openById() 포함 — Simple Trigger에선 불가능했던 호출)로 캐시를 살아있는
 *   값으로 먼저 갱신한 뒤 `generateACQReport_()` 호출 — Generate 클릭 시점에
 *   Spent/Revenue가 실제로 최신화됨(기존엔 마지막 백그라운드 Import 시점
 *   캐시만 읽었음). 두 refresh 모두 실패해도 Logger에만 기록하고 report
 *   생성은 계속 진행(runLeadsPipelineTail()의 refreshCampaignSpend_()와
 *   동일한 비필수 처리 원칙).
 * v1.13.0 (2026-07-31)
 * - **W열 헤더 "Meta Spent" → "Spent", 데이터 소스를 합산 캐시로 교체** —
 *   Naver Search Ad API 파이프라인(AD_003_NaverSearch.js) 검증 완료 후 사용자가
 *   ACQ_REP 지출 컬럼에 Meta+Naver Search를 합쳐서 반영하기로 확정.
 *   `readMetaSpendCacheMap_()` → `readAdSpendCacheMap_()`(AD_004_SpendCache.js
 *   신규 — Meta(NZD 원본)+Naver Search(KRW→NZD 환율 변환, GOOGLEFINANCE) 합산
 *   후 `Ad_Spend_Cache` 시트에 저장). `CONFIG.ACQ.META_SPENT_COLUMN`→
 *   `SPENT_COLUMN` 개명 반영(00_Config.js v1.23.0). 상세: docs/exec-plans/active/
 *   2026-07-30-campaign-spend-integration.md
 * v1.12.0 (2026-07-30)
 * - **버그 수정 — ACQ_REP Generate 체크박스가 Meta Spent 연결 후 조용히 실패**:
 *   Cloud Logs로 확인한 정확한 원인 — "Specified permissions are not sufficient
 *   to call SpreadsheetApp.openById". Generate 체크박스는 `onEdit()` Simple
 *   Trigger로 실행되는데, `computeMetaSpendSummary_()`가 내부에서 캠페인 지출
 *   외부 시트를 `openById()`로 열어서 Simple Trigger의 제한된 권한과 충돌(Target_REP가
 *   예전에 겪은 것과 동일 제약). `computeMetaSpendSummary_()` 대신
 *   `readMetaSpendCacheMap_()`(AD_002_Meta.js v1.5.0, 같은 스프레드시트 안
 *   `Meta_Spend_Cache` 캐시만 읽음)로 교체 — ACQ_Summary와 동일한 캐시 패턴.
 *   사용자가 `runRefreshMetaSpendCache()`를 미리 수동 실행해둬야 최신값 반영.
 * v1.11.0 (2026-07-30)
 * - "Meta Spent" 컬럼(W열, `CONFIG.ACQ.META_SPENT_COLUMN`) 추가 — 캠페인 지출
 *   자동 통합 파이프라인(AD_002_Meta.js)의 첫 연결. Target_Engine 연결은 8개
 *   플랫폼 중 Meta 하나만 자동화돼 총 지출 과소집계 위험이 있어 보류하고,
 *   Segment×Month grain이 이미 맞는 ACQ_REP에 먼저 연결(사용자 확정,
 *   2026-07-30) — 헤더명을 "Spent"가 아니라 "Meta Spent"로 명확히 해서 총
 *   광고비로 오인되지 않게 함. `computeMetaSpendSummary_()`(AD_002_Meta.js)를
 *   캐시 없이 리포트 생성 시점에 직접 조회 — Target 컬럼과 동일하게
 *   hasOwnProperty로 "Meta 지출 없음"과 "Meta 지출 0"을 구분. 상세:
 *   docs/exec-plans/active/2026-07-30-campaign-spend-integration.md
 * v1.10.0 (2026-07-30)
 * - Revenue Target/Revenue Target%/New P1 Target/New P1 Target% 4컬럼 추가
 *   (docs/exec-plans/active/2026-07-30-acq-newp1-target-columns.md 참고, 원래
 *   별도 FY_REP으로 설계했던 걸 기존 두 리포트 확장으로 방향 전환). **컬럼 위치가
 *   두 번 충돌해서 재조정됨** — 처음엔 O열(기존 A:N 바로 뒤)부터 이어붙이려
 *   했으나 O:R이 이미 `CONFIG.ACQ.ENGINE_START_COL`(숨김 Engine 영역,
 *   sortIndex/FY/Month/Segment)로 쓰이고 있어 겹치는 걸 코드 리뷰로 발견 → S열로
 *   옮겼으나 이번엔 실 시트 검증 중 U:AF(21~32열, 사용자 수동 수식/소계 영역)와
 *   겹쳐서 아무 것도 안 보이는 문제 발생(사용자 리포트) → 최종
 *   `CONFIG.ACQ.TARGET_COLUMNS_START_COL`(AH열=34, 00_Config.js v1.20.0)로 확정.
 *   데이터 write/clear를 A:N(`REPORT_DATA_COLUMNS`)과 Target 4컬럼
 *   (`TARGET_COLUMNS_START_COL`~) 두 range로 분리(그 사이 O:R/U:AF는 손대지
 *   않음). Target 값은 ACQ_Summary(캐시)가 아니라
 *   `computeReportTargetLookup_()`(90_TargetEngine.js)로 리포트 생성 시점에
 *   조회 — Target은 Master/OPS 변경이 아니라 Target_Engine 갱신에 종속되는
 *   별개 축이라 캐시 레이어에 안 섞음. 기존 A:N 헤더는 시트에 수동 입력된
 *   값이라 코드가 안 건드리지만(주석 참고), 새로 추가되는 Target 헤더는 수동
 *   입력된 적이 없으므로 generateACQReport_()가 매번 다시 씀(멱등).
 *   Referral/Other 세그먼트와 마지막으로 Generate한 Target FY가 아닌 행은
 *   Target_Engine의 GROUP_ORDER(5개)/단일 FY 제약으로 공란 처리(의도된 동작).
 *   하드코딩 `14` 리터럴을 `CONFIG.ACQ.REPORT_DATA_COLUMNS`로 교체.
 * v1.9.3 (2026-07-28)
 * - computeACQDealRevenueFromRows_()가 "N/A"(출처 불명, 대부분 2022년 이전
 *   딜) 세그먼트도 Upsell과 동일하게 "Other"로 접어 넣도록 수정 — 그대로
 *   두면 CONFIG.ACQ.SEGMENTS(7개) 밖의 값이라 ACQ_Summary엔 집계돼도
 *   buildACQEngineRows_()가 7개 세그먼트만 조회하는 리포트 화면엔 계속 안
 *   뜨는 문제가 있었음(사용자 확인 후 Other 편입으로 결정).
 * v1.9.2 (2026-07-28)
 * - Segment 분류를 getBusinessSegment() 키워드 매칭에서 Deal Tracker의 수동
 *   "Segment" 컬럼(`row.businessSegment`) 직접 참조로 교체 — 실측 검증 결과
 *   키워드 매칭 정확도가 신뢰 불가 수준(Search $144,265 vs 실제 ~$537,507.89,
 *   약 $393K 갭)이라 사용자가 Deal Tracker 전체 딜을 수동 재분류. v1.9.1의
 *   Upsell 별도 제외 로직도 제거(Upsell은 이제 이 컬럼에서 "Other"로 이미
 *   분류돼 있음). 상세: docs/Changelog.md 2026-07-28.
 * v1.9.1 (2026-07-28)
 * - Fixed: computeACQDealRevenueFromRows_()가 Upsell 딜을 제외 없이 집계하던
 *   버그 수정 — Upsell은 획득 채널이 아니라 getBusinessSegment()가 대부분
 *   "Other"로 분류해버려 ACQ_REP Revenue가 과대집계됨(사용자 실측 발견: 7월
 *   Upsell 제외 기준 $956,560.04 vs ACQ_REP 표시 $960,523, 차액 $3,962.96).
 *   `row.leadSource === "upsell"`인 행만 걸러냄(Referral은 정식 세그먼트라
 *   그대로 유지).
 * v1.9.0 (2026-07-28)
 * - Revenue를 Leads_OPS(Opportunity Won Date/Revenue, 리드 단위) 대신 Deal
 *   Tracker 기반으로 전환 (2트랙 아키텍처, CLAUDE.md #7). computeOPSAggregates_()
 *   에서 Revenue 블록/wonDateCol/revenueCol 제거 — Revenue는 신규
 *   computeACQDealRevenueFromRows_()(90_TargetEngine.js의
 *   readDealTrackerRawRows_() 재사용, getBusinessSegment()로 7개 Segment
 *   분류, Close Date 기준 월 귀속)가 전담. refreshACQSummary_()(31_ACQSummary.js)
 *   배선 변경. 상세: docs/Changelog.md 2026-07-28.
 * v1.8.0 (2026-07-27)
 * - onEdit()의 Target_REP 분기 제거. Simple Trigger(onEdit)는 제한된 권한으로
 *   실행돼 Target_REP에 필요한 SpreadsheetApp.openById()(외부 채널시트 참조)를
 *   호출할 수 없다는 게 실측 확인됨 — Target_REP는 수동 실행(runGenerateTargetReport(),
 *   91_TargetReport.js)으로 전환.
 * v1.7.0 (2026-07-27)
 * - onEdit()에 Target_REP 분기 추가 (handleTargetReportGenerateEdit_(),
 *   91_TargetReport.js) — Target_REP 구현 착수, docs/TargetReportDesign.md 참고.
 *   (v1.8.0에서 제거됨)
 * v1.6.0 (2026-07-25)
 * - SAL을 computeMTAAggregates_()(MTA_Master, Lead Record Type 기준)에서
 *   computeOPSAggregates_()(Leads_OPS, 새 "Sales Accepted Date" 필드의
 *   이벤트 날짜 기준)로 이동. Lead Record Type이 리드 레벨 스냅샷이라
 *   이미 SAL이 된 리드의 무관한 후속 터치까지 SAL로 잘못 집계되던 과집계
 *   문제 해결(사용자 실측 확인) — docs/ACQReportDesign.md 참고.
 * v1.5.0 (2026-07-22)
 * - Added isEffectiveP1_(): New P1 판정을 NewP1_REP 설계와 통일 —
 *   Priority Override 우선, "Priority 1" exact match (기존
 *   `indexOf("1")` substring 비교 + Priority Override 미반영 수정).
 *   computeOPSAggregates_()의 New P1 카운트에 적용. All P1(MTA_Master
 *   기반)은 Priority Override 컬럼 자체가 없어 대상 아님 — 그대로 유지.
 *   테스트: testIsEffectiveP1().
 * v1.4.0 (2026-07-22)
 * - computeOPSAggregates_(): IC Booked/IC Complete/Revenue를 Create Date
 *   코호트 → 각자의 이벤트 날짜(IC Booked Date/IC Completed Date/
 *   Opportunity Won Date) 기준으로 변경. 코호트 관점은 NewP1_REP가
 *   담당할 예정이라 ACQ_REP과 역할이 겹치는 걸 피하기 위함
 *   (docs/ACQReportDesign.md 참고). New Leads/New P1은 Create Date
 *   코호트 유지 (정의상 코호트=이벤트가 동일).
 * v1.3.0 (2026-07-21)
 * - Fixed: generateACQReport_() 안에 "Report Area 작성" 블록이
 *   (신규 summaryMap 버전 + 구버전 mtaAgg/opsAgg 버전) 중복 남아있던
 *   문제 수정 — 구버전 블록(6번) 삭제, mtaAgg/opsAgg 미정의 에러 방지.
 * - Fixed: computeMTAAggregates_() / computeOPSAggregates_()가
 *   rangeStart/rangeEndExclusive가 null일 때(= refreshACQSummary_()가
 *   전체 스캔을 요청할 때) 모든 행을 걸러버리던 문제 수정.
 *   `if(rangeStart && rangeEndExclusive){ ... range 체크 ... }`로 감쌈.
 * - generateACQReport_()는 이제 ACQ_Summary 조회만 하며 원본
 *   Master/OPS 스캔을 하지 않음 (실제 스캔은 refreshACQSummary_()가
 *   Append/Sync/Rebuild 시점에 미리 수행).
 * ==========================================================
 */


/**
 * ==========================================================
 * Setup ACQ Dropdowns
 * (변경 없음)
 * ==========================================================
 */
function setupACQDropdowns(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.ACQ.SHEET);

  if(!sheet){
    throw new Error(CONFIG.ACQ.SHEET + " sheet not found.");
  }

  const range = findFiscalYearRange_();

  const fyList = [];

  for(let fy = range.min; fy <= range.max; fy++){
    fyList.push("FY" + String(fy).slice(-2));
  }

  const fyRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(fyList, true)
    .setAllowInvalid(false)
    .build();

  const monthRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.ACQ.FISCAL_MONTH_ORDER, true)
    .setAllowInvalid(false)
    .build();

  sheet.getRange(CONFIG.ACQ.ROWS.CONTROL_VALUE, CONFIG.ACQ.COLUMNS.START_FY)
    .setDataValidation(fyRule);

  sheet.getRange(CONFIG.ACQ.ROWS.CONTROL_VALUE, CONFIG.ACQ.COLUMNS.END_FY)
    .setDataValidation(fyRule);

  sheet.getRange(CONFIG.ACQ.ROWS.CONTROL_VALUE, CONFIG.ACQ.COLUMNS.START_MONTH)
    .setDataValidation(monthRule);

  sheet.getRange(CONFIG.ACQ.ROWS.CONTROL_VALUE, CONFIG.ACQ.COLUMNS.END_MONTH)
    .setDataValidation(monthRule);

  sheet.getRange(CONFIG.ACQ.ROWS.CONTROL_VALUE, CONFIG.ACQ.COLUMNS.GENERATE)
    .insertCheckboxes();

  Logger.log(
    "ACQ Dropdowns set up. FY range: FY" +
    String(range.min).slice(-2) + " ~ FY" + String(range.max).slice(-2)
  );

}


/**
 * ==========================================================
 * Find Fiscal Year Range (실제 데이터 기준 min/max)
 * (변경 없음)
 * ==========================================================
 */
function findFiscalYearRange_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let min = null;
  let max = null;

  function scan(sheetName, columnName){

    const sheet = ss.getSheetByName(sheetName);
    if(!sheet) return;

    const values = sheet.getDataRange().getValues();
    if(values.length <= 1) return;

    const headers = values[0];
    const colIndex = headers.indexOf(columnName);
    if(colIndex === -1) return;

    for(let i = 1; i < values.length; i++){

      const date = values[i][colIndex];

      if(date instanceof Date && !isNaN(date.getTime())){

        const fyLabel = getFiscalYear(date);
        const fyNum = Number(fyLabel.replace("FY", ""));

        if(min === null || fyNum < min) min = fyNum;
        if(max === null || fyNum > max) max = fyNum;

      }

    }

  }

  scan(OPS.SHEET.OPS, "Create Date");
  scan(CONFIG.SHEETS.MTA_MASTER, "MTA Created Date");

  const currentFY = Number(getFiscalYear(new Date()).replace("FY", ""));

  if(min === null) min = currentFY;
  if(max === null || max < currentFY) max = currentFY;

  return { min: min, max: max };

}


/**
 * ==========================================================
 * Report Generate Edit Handler — 설치형(Installable) onEdit 트리거 전용
 *
 * WHY (2026-08-06 — 버그 수정, 설치형 트리거로 전환)
 * 원래 이름 그대로 `onEdit(e)`였을 땐 GAS가 자동으로 Simple Trigger로
 * 인식해서 실행했는데, Simple Trigger는 제한된 권한이라 그 안에서
 * `ScriptApp.newTrigger()` 호출조차 막힘("Specified permissions are not
 * sufficient to call ScriptApp.newTrigger" — 실측 확인, 시도했던 "체크박스
 * 클릭 시 설치형 트리거를 예약" 방식 자체가 애초에 Simple Trigger 안에서는
 * 불가능했음이 드러남). 올바른 해결책은 스케줄링이 아니라 **이 함수 자체를
 * 설치형 onEdit 트리거로 등록**하는 것 — 설치형 트리거는 등록한 사용자의
 * Full Authorization으로 실행되므로, 그 안에서 Ad Spend Cache/Deal Tracker
 * 처럼 외부 접근이 필요한 refresh를 직접 동기 호출해도 문제없음. 함수 이름을
 * `onEdit`에서 바꿔서 GAS가 이걸 Simple Trigger로 자동 실행하지 않도록 하고
 * (자동 실행되면 이 함수도 똑같이 권한 오류가 남), `runInstallReportGenerateTrigger()`
 * (사용자가 Apps Script 편집기에서 1회 직접 Run — 이 실행 자체가 Full
 * Authorization이라 트리거 설치 가능)로 설치형 트리거에 등록해야 실제로 동작함.
 *
 * NewP1_REP도 같은 방식(Generate 체크박스 + 이 트리거)을 쓰므로, GAS가
 * 파일마다 트리거 핸들러를 따로 두면 안 되는 문제(전역 함수명 중복 시 마지막
 * 정의가 조용히 덮어씀)와 무관하게 이 함수 하나만 시트 이름으로 분기해서
 * 각 리포트 전용 핸들러를 호출한다.
 * ==========================================================
 */
function handleReportGenerateEdit(e){

  if(!e || !e.range) return;

  // docs/OpenItems.md #46 — installable onEdit은 파이프라인 tail 자신의
  // 리포트 시트 쓰기에도 재발동한다. 지금 파이프라인 tail이 실행 중이면
  // 이 호출은 사람의 체크박스 클릭이 아니라 그 재발동일 가능성이 높으므로
  // 즉시 반환(isPipelineTailRunning_(), MASTER_002_PipelineAsync.js).
  if(isPipelineTailRunning_()) return;

  const sheet = e.range.getSheet();
  const sheetName = sheet.getName();

  if(sheetName === CONFIG.ACQ.SHEET){
    handleACQReportGenerateEdit_(e, sheet);
    return;
  }

  if(sheetName === CONFIG.NEWP1.SHEET){
    handleNewP1ReportGenerateEdit_(e, sheet);
    return;
  }

  if(sheetName === CONFIG.SM_REP.SHEET){
    handleSMReportGenerateEdit_(e, sheet);
    return;
  }

}


/**
 * ==========================================================
 * Install Report Generate Trigger (1회성 수동 실행 전용)
 *
 * WHY
 * handleReportGenerateEdit()가 Full Authorization으로 실행되려면 설치형
 * (Installable) onEdit 트리거로 등록돼야 한다 — Apps Script 편집기에서
 * 이 함수를 직접 Run하면 그 실행 자체가 Full Authorization이라 트리거
 * 설치가 가능함. 이미 등록된 동일 핸들러 트리거가 있으면 먼저 지우고
 * 다시 등록해 중복 설치를 방지(재실행해도 안전).
 * ==========================================================
 */
function runInstallReportGenerateTrigger(){

  deleteTriggersByHandlerName_("handleReportGenerateEdit");

  ScriptApp.newTrigger("handleReportGenerateEdit")
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();

  Logger.log(CONFIG.LOG.PREFIX + " Report Generate installable onEdit trigger installed.");

}


/**
 * ==========================================================
 * Handle ACQ_REP Generate Checkbox Edit
 * ==========================================================
 */
function handleACQReportGenerateEdit_(e, sheet){

  const row = e.range.getRow();
  const col = e.range.getColumn();

  const isGenerateCell =
    row === CONFIG.ACQ.ROWS.CONTROL_VALUE &&
    col === CONFIG.ACQ.COLUMNS.GENERATE;

  if(!isGenerateCell) return;

  if(e.value !== "TRUE") return;

  try {

    refreshAndGenerateACQReport_();

  } finally {

    sheet.getRange(row, col).setValue(false);

  }

}


/**
 * ==========================================================
 * Manual-run public wrapper (Apps Script 편집기 Run 드롭다운 노출용)
 *
 * WHY (2026-08-06 — 비동기 트리거 방식 → 동기 방식으로 재전환)
 * v1.14.2~v1.14.4에선 이 함수를 schedulePipelineTail_()로 예약하는 설치형
 * 1회성 트리거의 핸들러로 썼으나, Apps Script의 시간 기반 1회성 트리거는
 * "1초 후 실행"을 요청해도 정확한 시점을 보장하지 않고 실제로는 1~2분+
 * 지연될 수 있음이 실측 확인됨(사용자 발견 — 중복 예약 버그(v1.12.1,
 * 08_PipelineAsync.js)를 고친 뒤에도 지연이 재현됨 → 플랫폼 자체의
 * 디스패치 지연으로 판명). DealTracker_Engine 캐시 도입(v1.14.4)으로
 * refreshAndGenerateACQReport_() 자체가 이제 충분히 빨라져서(대부분 수 초
 * ~1분), 예측 불가능한 트리거 디스패치 지연을 감수하는 것보다 다시
 * handleACQReportGenerateEdit_() 안에서 동기 호출하는 게 전체 체감
 * 반응성이 낫다고 판단(사용자 확정). 이 함수는 이제 트리거 핸들러가
 * 아니라 편집기에서 직접 Run하는 수동 테스트 진입점으로만 남김.
 * ==========================================================
 */
function runACQReportGenerateTail(){

  refreshAndGenerateACQReport_();

}


/**
 * ==========================================================
 * Refresh And Generate ACQ Report (Full Authorization 전용)
 *
 * WHY (2026-08-06 — Revenue 전용으로 축소, 성능 버그 수정)
 * v1.14.2까지는 Ad Spend Cache 전체 갱신(refreshAdSpendCache_(), 외부 API)
 * + ACQ_Summary 전체 재계산(refreshACQSummary_(), MTA_Master 8만+행/
 * Leads_OPS 3만5천+행 전체 스캔)을 매번 돌렸는데, 실측 211초가 걸려 회의
 * 중 활용이 불가능했음(사용자 확인). 조사 결과: All Leads/New P1/SAL/IC
 * Booked/IC Complete는 Leads/MTA Import 시에만 바뀌고, 그 Import는 이미
 * 08_PipelineAsync.js 백그라운드 파이프라인이 refreshACQSummary_()를
 * 자동으로 돌려 최신 유지 중이라 Generate 시점 재스캔이 무의미함. Revenue
 * (Deal Tracker)만 Import와 무관하게 언제든 바뀔 수 있어 재조회 가치가
 * 있음(사용자 확정) — refreshACQSummaryRevenueOnly_()(31_ACQSummary.js
 * v1.3.0, MTA_Master/Leads_OPS 스캔 없이 Deal Tracker Revenue만 병합)로
 * 교체. Spent는 이번 범위에서 제외 — 기존 백그라운드 파이프라인
 * (refreshCampaignSpend_())에 계속 맡김.
 *
 * refresh 실패해도 Logger에만 기록하고 report 생성은 계속 진행
 * (08_PipelineAsync.js refreshCampaignSpend_()와 동일한 비필수 처리 원칙 —
 * Deal Tracker 갱신 실패로 Report 생성 자체가 막히면 안 됨).
 *
 * 2026-08-06 추가: refreshACQSummaryRevenueOnly_() 전에
 * appendNewDealTrackerRows_()(90_TargetEngine.js)를 먼저 호출 —
 * DealTracker_Engine(내부 캐시)에 체크포인트 이후 신규 딜만 증분
 * 동기화해서, Revenue가 이 클릭 시점까지 실제로 최신화되도록 함(신규
 * 딜은 일주일에 몇 건 수준이라 빠름 — 사용자 확인). readDealTrackerRawRows_()
 * 가 이제 이 캐시만 읽으므로(외부 openById() 직접 호출 없음) 이 순서가
 * 중요함.
 * ==========================================================
 */
function refreshAndGenerateACQReport_(){

  try {

    appendNewDealTrackerRows_();

  } catch(err){

    Logger.log(CONFIG.LOG.PREFIX + " refreshAndGenerateACQReport_: appendNewDealTrackerRows_ failed - " + err);

  }

  try {

    refreshACQSummaryRevenueOnly_();

  } catch(err){

    Logger.log(CONFIG.LOG.PREFIX + " refreshAndGenerateACQReport_: refreshACQSummaryRevenueOnly_ failed - " + err);

  }

  generateACQReport_();

}


/**
 * ==========================================================
 * Generate ACQ Report (ACQ_Summary 조회만 — 원본 스캔 없음)
 * ==========================================================
 */
function generateACQReport_(){

  const start = new Date();

  Logger.log("======================================");
  Logger.log("ACQ Report Generation Started");
  Logger.log("======================================");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.ACQ.SHEET);

  if(!sheet){
    throw new Error(CONFIG.ACQ.SHEET + " sheet not found.");
  }

  //----------------------------------------------------------
  // 1. Read Control Values
  //----------------------------------------------------------

  const controls = sheet
    .getRange(
      CONFIG.ACQ.ROWS.CONTROL_VALUE, 1, 1,
      CONFIG.ACQ.COLUMNS.GENERATE
    )
    .getValues()[0];

  const startFY = Number(String(controls[CONFIG.ACQ.COLUMNS.START_FY - 1]).replace("FY", ""));
  const startMonth = String(controls[CONFIG.ACQ.COLUMNS.START_MONTH - 1]);
  const endFY = Number(String(controls[CONFIG.ACQ.COLUMNS.END_FY - 1]).replace("FY", ""));
  const endMonth = String(controls[CONFIG.ACQ.COLUMNS.END_MONTH - 1]);

  if(startFY > endFY){
    throw new Error("Start FY가 End FY보다 나중입니다. 범위를 확인하세요.");
  }

  //----------------------------------------------------------
  // 2. Build Engine — 선택된 Start FY ~ End FY 구간만 생성
  //----------------------------------------------------------

  const engineRows = buildACQEngineRows_(startFY, endFY);

  writeACQEngine_(sheet, engineRows);

  //----------------------------------------------------------
  // 3. Start/End Sort Index 탐색 (base = startFY)
  //----------------------------------------------------------

  const startIndex = computeSortIndex_(startFY, startMonth, startFY);

  const endIndex =
    computeSortIndex_(endFY, endMonth, startFY) +
    CONFIG.ACQ.SEGMENTS.length - 1;

  if(startIndex === -1 || endIndex < startIndex){
    throw new Error("Start/End Month 조합을 Engine에서 찾을 수 없습니다.");
  }

  const targetRows = engineRows.filter(function(row){
    return row.sortIndex >= startIndex && row.sortIndex <= endIndex;
  });

  //----------------------------------------------------------
  // 3.5. 월 블록 단위로 순서 뒤집기 (최신 달이 맨 위로)
  //----------------------------------------------------------

  const reversedTargetRows =
    reverseMonthBlocks_(targetRows, CONFIG.ACQ.SEGMENTS.length);

  Logger.log("Report Rows : " + reversedTargetRows.length);


  //----------------------------------------------------------
  // 4. ACQ Summary 조회 (스캔 없음 — 즉시 응답)
  //----------------------------------------------------------

  const summaryMap = readACQSummaryMap_();

  // Target 조회(90_TargetEngine.js) — Revenue Target/New P1 Target은 ACQ_Summary
  // 캐시가 아니라 Target_Engine의 마지막 Generate 결과를 리포트 생성 시점에 붙임
  // (docs/exec-plans/active/2026-07-30-acq-newp1-target-columns.md 참고).
  const targetLookup = computeReportTargetLookup_();

  // 캠페인 지출 조회(AD_004_SpendCache.js) — 8개 플랫폼 중 Meta+Naver Search
  // 2개만 자동화된 상태(합산된 값, "Spent"로 표시 — 총 광고비 아님).
  // **캐시(Ad_Spend_Cache)만 읽음** — 이 함수(generateACQReport_)는 ACQ_REP
  // Generate 체크박스의 onEdit() Simple Trigger에서 실행되는데, Simple Trigger는
  // 외부 스프레드시트/API를 열 수 없어서 원본 요약 함수를 직접 호출하면
  // "Specified permissions are not sufficient" 에러로 조용히 실패함(실측 확인).
  // 캐시는 사용자가 runRefreshAdSpendCache()(AD_004_SpendCache.js)를 수동
  // 실행해서 미리 갱신해둬야 함. 상세: docs/exec-plans/active/
  // 2026-07-30-campaign-spend-integration.md
  const spendMap = readAdSpendCacheMap_();

  // "On Track" 판정용 월별 주 수(90_TargetEngine.js) — Revenue/New P1 Target을
  // 그 달의 주 수로 나눈 주간 페이스와 실적을 비교(사용자 요청, 2026-08-06).
  const weeksInMonthCounts = computeWeeksInMonthCountsForFYRange_(startFY, endFY);

  //----------------------------------------------------------
  // 5. Report Area 작성
  //----------------------------------------------------------

  const outputRows = [];
  const targetOutputRows = [];
  const spentOutputRows = [];
  const onTrackRows = [];

  reversedTargetRows.forEach(function(row, i){

    const key = row.fy + "|" + row.month + "|" + row.segment;
    const s = summaryMap[key] || {
      allLeads: 0, allP1: 0, newLeads: 0, newP1: 0,
      sal: 0, icBooked: 0, icComplete: 0, revenue: 0
    };

    // 시트 행 번호(수식의 셀 참조에 필요) — Target 블록 열 문자는
    // TARGET_COLUMNS_START_COL이 과거에 여러 번 이동한 이력이 있어(00_Config.js
    // Change Log 참고) 하드코딩하지 않고 매번 계산.
    const sheetRow = CONFIG.ACQ.ROWS.REPORT_DATA_START + i;
    const revenueTargetColLetter = columnIndexToLetter_(CONFIG.ACQ.TARGET_COLUMNS_START_COL);
    const newP1TargetColLetter = columnIndexToLetter_(CONFIG.ACQ.TARGET_COLUMNS_START_COL + 2);

    outputRows.push([
      "FY" + String(row.fy).slice(-2),
      row.month,
      row.segment,
      s.allLeads,
      s.allP1,
      buildRatioFormula_("E", "D", sheetRow, 0),
      s.newLeads,
      buildRatioFormula_("G", "D", sheetRow, 0),
      s.newP1,
      buildRatioFormula_("I", "G", sheetRow, 0),
      s.sal,
      s.icBooked,
      s.icComplete,
      s.revenue
    ]);

    // Target_Engine은 한 번에 Target FY 하나만 갖고 있어, 그 FY/GROUP_ORDER(5개
    // 세그먼트)에 없는 행은 hasOwnProperty가 false — "타겟 0"과 구분해 공란 처리.
    // Target%(T/V열)는 값 대신 수식(buildGuardedRatioFormula_)으로 이 구분을
    // 그대로 재현 — Target 자체가 없거나(분모 셀 공란) 0이면 공란, 아니면 실제
    // 비율(2026-08-09, 사용자 요청 — 수동 입력값 수정 시 자동 재계산).
    const hasRevenueTarget = targetLookup.revenueTarget.hasOwnProperty(key);
    const revenueTarget = hasRevenueTarget ? targetLookup.revenueTarget[key] : "";
    const revenueTargetPct = hasRevenueTarget
      ? buildGuardedRatioFormula_("N", revenueTargetColLetter, sheetRow) : "";

    const hasNewP1Target = targetLookup.newP1Target.hasOwnProperty(key);
    const newP1Target = hasNewP1Target ? targetLookup.newP1Target[key] : "";
    const newP1TargetPct = hasNewP1Target
      ? buildGuardedRatioFormula_("I", newP1TargetColLetter, sheetRow) : "";

    targetOutputRows.push([revenueTarget, revenueTargetPct, newP1Target, newP1TargetPct]);

    // 지출 데이터가 이 (FY|Month|Segment)에 전혀 없으면(Meta/Naver Search 어느
    // 쪽에도 해당 조합 자체가 없는 경우) hasOwnProperty가 false — "지출 0"과
    // 구분해 공란 처리.
    const hasSpend = spendMap.hasOwnProperty(key);
    spentOutputRows.push([hasSpend ? spendMap[key] : ""]);

    // "On Track" 판정(사용자 요청, 2026-08-06) — 주간 페이스(Target ÷ 그 달의
    // 주 수)보다 실적이 크면 색칠 대상. S(Revenue Target)/T(Revenue Target%)는
    // Revenue(N) 기준, V(New P1 Target%)는 New P1(I) 기준(사용자 확정).
    const weeksInMonth = weeksInMonthCounts[row.fy + "|" + row.month] || 0;

    const revenueOnTrack =
      (hasRevenueTarget && revenueTarget > 0 && weeksInMonth > 0) &&
      (s.revenue > (revenueTarget / weeksInMonth));

    const newP1OnTrack =
      (hasNewP1Target && newP1Target > 0 && weeksInMonth > 0) &&
      (s.newP1 > (newP1Target / weeksInMonth));

    // CPNP1 On Track(2026-08-09 사용자 요청) — X열(CONFIG.ACQ.CPNP1_COLUMN,
    // 사용자가 수동으로 만든 컬럼)에 색칠만 적용, 값/수식은 안 건드림. CPNP1은
    // 낮을수록 좋은 지표라 다른 On Track과 방향이 반대(사용자 확정: Actual ≤
    // Target이면 On Track) — Revenue/New P1처럼 누적 카운트가 아니라 비율이라
    // 주간 페이스 보정은 적용하지 않음(월 전체 Target 그대로 비교).
    // Target CPNP1 = Target_Engine Block 0 수동 Spent ÷ New P1 Target(같은
    // targetLookup 재사용, 새 조회 없음). Actual CPNP1은 X열 수식과 동일한
    // 산식(Spent÷New P1)을 JS에서 독립 계산 — X열 자체는 읽지 않음.
    const targetSpent = targetLookup.spent[key] || 0;
    const targetCpnp1 = (hasNewP1Target && newP1Target > 0) ? targetSpent / newP1Target : null;

    const actualCpnp1 = (hasSpend && s.newP1 > 0) ? spendMap[key] / s.newP1 : null;

    const cpnp1OnTrack =
      targetCpnp1 !== null && actualCpnp1 !== null && actualCpnp1 <= targetCpnp1;

    onTrackRows.push([revenueOnTrack, revenueOnTrack, newP1OnTrack, cpnp1OnTrack]);   // S, T, V, X

  });

  // Target 컬럼 헤더(TARGET_COLUMNS_START_COL부터) — 기존 A:N과 달리 시트에
  // 수동 입력된 적이 없어 코드가 매번 다시 씀(멱등, A:N은 그대로 안 건드림).
  // O:R(ENGINE_START_COL, 숨김 Engine)/U:AF(사용자 수동 영역)는 그 사이 비워둔
  // 채 건너뜀 (위 Change Log — 00_Config.js v1.20.0 참고).
  sheet.getRange(
    CONFIG.ACQ.ROWS.REPORT_HEADER, CONFIG.ACQ.TARGET_COLUMNS_START_COL,
    1, CONFIG.ACQ.TARGET_COLUMNS_COUNT
  ).setValues([["Revenue Target", "Revenue Target%", "New P1 Target", "New P1 Target%"]]);

  // Spent 헤더(SPENT_COLUMN) — Target 컬럼과 동일하게 코드가 매번 다시 씀.
  sheet.getRange(CONFIG.ACQ.ROWS.REPORT_HEADER, CONFIG.ACQ.SPENT_COLUMN, 1, 1)
    .setValue("Spent");

  const lastReportRow = sheet.getLastRow();

  if(lastReportRow >= CONFIG.ACQ.ROWS.REPORT_DATA_START){

    const clearRowCount = lastReportRow - CONFIG.ACQ.ROWS.REPORT_DATA_START + 1;

    sheet.getRange(
      CONFIG.ACQ.ROWS.REPORT_DATA_START, 1,
      clearRowCount, CONFIG.ACQ.REPORT_DATA_COLUMNS
    ).clearContent().clearFormat();

    sheet.getRange(
      CONFIG.ACQ.ROWS.REPORT_DATA_START, CONFIG.ACQ.TARGET_COLUMNS_START_COL,
      clearRowCount, CONFIG.ACQ.TARGET_COLUMNS_COUNT
    ).clearContent().clearFormat();

    sheet.getRange(
      CONFIG.ACQ.ROWS.REPORT_DATA_START, CONFIG.ACQ.SPENT_COLUMN,
      clearRowCount, 1
    ).clearContent().clearFormat();

  }

  if(outputRows.length > 0){

    sheet.getRange(
      CONFIG.ACQ.ROWS.REPORT_DATA_START, 1,
      outputRows.length, CONFIG.ACQ.REPORT_DATA_COLUMNS
    ).setValues(outputRows);

    sheet.getRange(
      CONFIG.ACQ.ROWS.REPORT_DATA_START, CONFIG.ACQ.TARGET_COLUMNS_START_COL,
      targetOutputRows.length, CONFIG.ACQ.TARGET_COLUMNS_COUNT
    ).setValues(targetOutputRows);

    sheet.getRange(
      CONFIG.ACQ.ROWS.REPORT_DATA_START, CONFIG.ACQ.SPENT_COLUMN,
      spentOutputRows.length, 1
    ).setValues(spentOutputRows);

    applyACQReportStyles_(sheet, outputRows.length, onTrackRows);

  }

  SpreadsheetApp.flush();

  const seconds = ((new Date() - start) / 1000).toFixed(2);

  Logger.log("ACQ Report Generation Completed (" + seconds + "s)");
  Logger.log("======================================");

}


/**
 * ==========================================================
 * Build ACQ Engine Rows
 * (변경 없음)
 * ==========================================================
 */
function buildACQEngineRows_(minFY, maxFY){

  const rows = [];

  let sortIndex = 0;

  for(let fy = minFY; fy <= maxFY; fy++){

    CONFIG.ACQ.FISCAL_MONTH_ORDER.forEach(function(month){

      CONFIG.ACQ.SEGMENTS.forEach(function(segment){

        rows.push({
          sortIndex: sortIndex,
          fy: fy,
          month: month,
          segment: segment
        });

        sortIndex++;

      });

    });

  }

  return rows;

}


/**
 * ==========================================================
 * TEST — buildACQEngineRows_()
 * (변경 없음)
 * ==========================================================
 */
function testBuildACQEngineRows(){

  const rows = buildACQEngineRows_(26, 27);

  const expectedCount = 2 * 12 * CONFIG.ACQ.SEGMENTS.length;

  const pass =
    rows.length === expectedCount &&
    rows[0].fy === 26 &&
    rows[0].month === "AUG" &&
    rows[0].segment === CONFIG.ACQ.SEGMENTS[0] &&
    rows[0].sortIndex === 0;

  Logger.log("rows.length : " + rows.length + " (expected " + expectedCount + ")");
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Sort Index for a given FY + Month
 * (변경 없음)
 * ==========================================================
 */
function computeSortIndex_(fy, month, minFY){

  const monthOrder = CONFIG.ACQ.FISCAL_MONTH_ORDER.indexOf(month);

  if(monthOrder === -1) return -1;

  const fyOffset = fy - minFY;

  if(fyOffset < 0) return -1;

  return (fyOffset * 12 * CONFIG.ACQ.SEGMENTS.length) +
         (monthOrder * CONFIG.ACQ.SEGMENTS.length);

}


/**
 * ==========================================================
 * Write ACQ Engine to Sheet
 * (변경 없음)
 * ==========================================================
 */
function writeACQEngine_(sheet, engineRows){

  const startCol = CONFIG.ACQ.ENGINE_START_COL;

  const lastRow = sheet.getLastRow();

  if(lastRow > 0){
    sheet.getRange(1, startCol, Math.max(lastRow, 1), 4).clearContent();
  }

  const values = engineRows.map(function(row){
    return [row.sortIndex, "FY" + String(row.fy).slice(-2), row.month, row.segment];
  });

  if(values.length > 0){
    sheet.getRange(1, startCol, values.length, 4).setValues(values);
  }

  sheet.hideColumns(startCol, 4);

}


/**
 * ==========================================================
 * Format Week Key (순수 함수, 서비스 호출 없는 "yyyy-MM-dd" 포맷)
 *
 * WHY (2026-09-03, 실측 회귀 발견 후 수정)
 * `computeMTAAggregates_()`/`computeOPSAggregates_()`의 주 단위 집계
 * 루프(각 3만6천+행)에서 `Utilities.formatDate()`(Apps Script 서비스 호출,
 * 호출당 오버헤드 있음)를 매 행 호출했더니 `refreshACQSummary_()`가
 * 24.7s → 122.5s로 5배 느려짐(사용자 실측, `docs/PerformanceBenchmark.md`
 * 2026-09-03). `CONFIG.DATE.TIMEZONE`이 `Session.getScriptTimeZone()`(런타임
 * 자체 타임존)이라 `getMondayOfWeek_()`가 이미 그 타임존 기준 로컬 Date
 * 컴포넌트(new Date(y,m,d))로 만든 값과 항상 같음 — 즉 이 특정 케이스는
 * 실제 타임존 변환이 일어나지 않으므로, 순수 JS getFullYear/getMonth/getDate로
 * 포맷해도 Utilities.formatDate(date, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd")와
 * 바이트 단위로 동일한 결과 — 서비스 호출만 제거.
 *
 * ⚠️ 이 최적화는 "타임존 변환이 필요 없는 경우"에만 안전하다 — 외부
 * 스프레드시트에서 읽은 Date나 CONFIG.DATE.TIMEZONE과 다른 고정 타임존이
 * 필요한 곳에는 이 함수를 재사용하지 말 것(이 프로젝트가 반복 겪은
 * 타임존 버그 클래스, `normalizeExternalCalendarDate_()` 참고).
 * ==========================================================
 */
function formatWeekKeyDate_(date){

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return y + "-" + m + "-" + d;

}


/**
 * ==========================================================
 * Compute MTA Aggregates (All Leads / All P1)
 *
 * WHY
 * rangeStart/rangeEndExclusive가 둘 다 주어지면 그 기간 밖 행은
 * skip (ACQ Report의 부분 조회용). 둘 다 null/undefined면
 * 전체 스캔 (refreshACQSummary_()의 전체 재계산용).
 *
 * 2026-07-25 변경: SAL을 이 함수에서 제거하고 computeOPSAggregates_()로
 * 이동. 기존엔 "Lead Record Type = SAL"인 터치를 MTA Created Date(터치
 * 발생월) 기준으로 셌는데, Lead Record Type이 리드 레벨 스냅샷이라 리드가
 * 오래전에 이미 SAL이 된 경우 그 이후 무관한 터치까지 전부 SAL로 잘못
 * 집계되는 문제가 있었음(사용자 실측 확인). 새로 추가된 "Sales Accepted
 * Date"(진짜 이벤트 날짜 필드)를 IC Booked Date처럼 Leads_OPS 기준으로
 * 처리하도록 변경 — docs/ACQReportDesign.md "SAL 과집계 원인" 섹션 참고.
 *
 * @param {Date|null} rangeStart
 * @param {Date|null} rangeEndExclusive
 * ==========================================================
 */
function computeMTAAggregates_(rangeStart, rangeEndExclusive){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);

  const result = {
    allLeads: {},
    allP1: {},
    allLeadsWeekly: {} // 2026-09-03 — S&M_REP 주간 캐시용(docs/OpenItems.md #41 계열, 같은 스캔 재사용)
  };

  if(!sheet) return result;

  const values = sheet.getDataRange().getValues();

  if(values.length <= 1) return result;

  const headers = values[0];

  const dateCol = headers.indexOf("MTA Created Date");
  const segmentCol = headers.indexOf("Business Segment");
  const priorityCol = headers.indexOf("Lead Priority");

  const hasRangeFilter = !!(rangeStart && rangeEndExclusive);

  for(let i = 1; i < values.length; i++){

    const row = values[i];
    const date = row[dateCol];

    if(!(date instanceof Date) || isNaN(date.getTime())) continue;

    //------------------------------------------------------
    // range가 지정된 경우에만 밖 행 skip. 지정 안 됐으면(null) 전체 사용.
    //------------------------------------------------------
    if(hasRangeFilter){
      if(date < rangeStart || date >= rangeEndExclusive) continue;
    }

    const fy = Number(getFiscalYear(date).replace("FY", ""));
    const month = getFiscalMonthLabel(date);
    const segment = row[segmentCol] || "Other";

    const key = fy + "|" + month + "|" + segment;

    result.allLeads[key] = (result.allLeads[key] || 0) + 1;

    if(String(row[priorityCol]).indexOf("1") !== -1){
      result.allP1[key] = (result.allP1[key] || 0) + 1;
    }

    const weekKey = formatWeekKeyDate_(getMondayOfWeek_(date)) + "|" + segment;
    result.allLeadsWeekly[weekKey] = (result.allLeadsWeekly[weekKey] || 0) + 1;

  }

  return result;

}


/**
 * ==========================================================
 * Is Effective P1
 *
 * WHY (2026-07-22 추가)
 * New P1 판정을 NewP1_REP 설계(docs/NewP1ReportDesign.md)와 통일.
 * 기존엔 `Priority Override`를 무시하고 `Lead Priority`에 `indexOf("1")`
 * 로 느슨하게(substring) 비교했음 — "Priority 10"류 값이 있었다면
 * 오탐 가능했고, 마케팅이 수동으로 걸어둔 Priority Override도 반영이
 * 안 됐음. Priority Override가 있으면 그 값을 우선하고, "Priority 1"
 * 정확히 일치하는 경우만 P1으로 판정하도록 변경.
 *
 * @param {string} leadPriority
 * @param {string} priorityOverride
 * @return {boolean}
 *
 * TEST
 * isEffectiveP1_("Priority 1", "") === true
 * isEffectiveP1_("Priority 2", "Priority 1") === true (Override 우선)
 * isEffectiveP1_("Priority 1", "Priority 2") === false (Override가 덮어씀)
 * isEffectiveP1_("Priority 10", "") === false (기존 substring 버그 재현 방지)
 * ==========================================================
 */
function isEffectiveP1_(leadPriority, priorityOverride){

  const override = String(priorityOverride || "").trim();
  const effective = override !== "" ? override : String(leadPriority || "").trim();

  return effective === "Priority 1";

}


/**
 * ==========================================================
 * TEST — isEffectiveP1_()
 * ==========================================================
 */
function testIsEffectiveP1(){

  const cases = [
    // [leadPriority, priorityOverride, expected]
    ["Priority 1", "", true],
    ["Priority 2", "Priority 1", true],
    ["Priority 1", "Priority 2", false],
    ["Priority 10", "", false],
    ["", "", false]
  ];

  let pass = true;

  cases.forEach(function(c){

    const result = isEffectiveP1_(c[0], c[1]);
    const ok = result === c[2];

    if(!ok) pass = false;

    Logger.log(
      "leadPriority=\"" + c[0] + "\" priorityOverride=\"" + c[1] + "\"" +
      " => " + result + " (expected " + c[2] + ") " + (ok ? "✅" : "❌")
    );

  });

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute OPS Aggregates (New Leads / New P1 / SAL / IC Booked / IC Complete / Revenue)
 *
 * WHY (2026-07-22 변경)
 * IC Booked/IC Complete/Revenue를 "Create Date 코호트"(그 달에 생성된
 * Lead 기준)로 묶으면, NewP1_REP(추후 구현될 New P1 Funnel 리포트)가
 * 어차피 코호트 관점을 담당하게 되므로 ACQ_REP과 역할이 겹친다.
 * ACQ_REP은 "그 달의 실제 퍼포먼스"(그 달에 실제로 발생한 이벤트)를
 * 보여주는 게 목적이므로, 이 3개 지표는 각자 자기 이벤트 날짜
 * (IC Booked Date / IC Completed Date / Opportunity Won Date)가
 * 속한 달로 귀속하도록 변경. New Leads/New P1은 "새로 생성된 Lead 수"
 * 자체가 정의상 Create Date 기준이라 그대로 유지 (코호트=이벤트가 동일).
 *
 * WHY (2026-07-25 추가 — SAL)
 * SAL을 MTA_Master의 "Lead Record Type=SAL 터치 건수"(computeMTAAggregates_())로
 * 세던 방식은, Lead Record Type이 리드 레벨 스냅샷이라 이미 SAL이 된 리드의
 * 무관한 후속 터치까지 SAL로 잘못 잡히는 과집계 문제가 있었음. "Sales Accepted
 * Date"(진짜 SAL 전환 이벤트 날짜)가 새로 확보되어, IC Booked/Complete와 동일한
 * 방식(Leads_OPS 기준, 자기 이벤트 날짜가 속한 달)으로 전환.
 *
 * @param {Date|null} rangeStart
 * @param {Date|null} rangeEndExclusive
 * ==========================================================
 */
function computeOPSAggregates_(rangeStart, rangeEndExclusive){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(OPS.SHEET.OPS);

  const result = {
    newLeads: {},
    newP1: {},
    sal: {},
    icBooked: {},
    icComplete: {},
    // 2026-09-03 — S&M_REP 주간 캐시용(docs/OpenItems.md #41 계열, 같은 스캔 재사용).
    // salP1은 월 단위 ACQ_Summary에는 없던 신규 지표(S&M 전용 수요) — SAL 블록에서
    // isEffectiveP1_() 판정 한 줄만 추가하면 되는 부가 계산이라 여기서 같이 뽑는다.
    newLeadsWeekly: {},
    newP1Weekly: {},
    salWeekly: {},
    salP1Weekly: {}
  };

  if(!sheet) return result;

  const values = sheet.getDataRange().getValues();

  if(values.length <= 1) return result;

  const headers = values[0];

  const createDateCol = headers.indexOf("Create Date");
  const segmentCol = headers.indexOf("Business Segment");
  // 2026-09-03 — SAL 전용 이벤트 기준 Segment(사용자 설계 확정, MASTER_010_SALSync.js
  // v1.2.0 참고). New Leads/New P1/IC Booked/IC Complete는 계속 "Business Segment"
  // (First Touch 고정값, 코호트 일관성) 사용, SAL만 이 컬럼(SAL 이벤트 자체의 터치로
  // 독립 분류) 사용 — ACQ_REP은 코호트가 아니라 "그 달 어떤 액션에서 퍼널이
  // 이어졌는지"를 보는 이벤트 기준 리포트라 같은 리드가 New Leads와 SAL에서
  // 서로 다른 Segment로 잡히는 게 의도된 동작.
  const salSegmentCol = headers.indexOf("SAL Segment");
  const priorityCol = headers.indexOf("Lead Priority");
  const priorityOverrideCol = headers.indexOf("Priority Override");
  const salesAcceptedCol = headers.indexOf("Sales Accepted Date");
  const icBookedCol = headers.indexOf("IC Booked Date");
  const icCompleteCol = headers.indexOf("IC Completed Date");

  const hasRangeFilter = !!(rangeStart && rangeEndExclusive);

  function inRange(date){
    if(!hasRangeFilter) return true;
    return date >= rangeStart && date < rangeEndExclusive;
  }

  function keyFor(date, segment){
    const fy = Number(getFiscalYear(date).replace("FY", ""));
    const month = getFiscalMonthLabel(date);
    return fy + "|" + month + "|" + (segment || "Other");
  }

  for(let i = 1; i < values.length; i++){

    const row = values[i];
    const segment = row[segmentCol] || "Other";

    //------------------------------------------------------
    // New Leads / New P1 — Create Date 코호트 (Lead 생성된 달)
    //------------------------------------------------------

    const createDate = row[createDateCol];

    if(createDate instanceof Date && !isNaN(createDate.getTime()) && inRange(createDate)){

      const key = keyFor(createDate, segment);
      const isP1 = isEffectiveP1_(row[priorityCol], row[priorityOverrideCol]);

      result.newLeads[key] = (result.newLeads[key] || 0) + 1;

      if(isP1){
        result.newP1[key] = (result.newP1[key] || 0) + 1;
      }

      const weekKey = formatWeekKeyDate_(getMondayOfWeek_(createDate)) + "|" + segment;

      result.newLeadsWeekly[weekKey] = (result.newLeadsWeekly[weekKey] || 0) + 1;

      if(isP1){
        result.newP1Weekly[weekKey] = (result.newP1Weekly[weekKey] || 0) + 1;
      }

    }

    //------------------------------------------------------
    // SAL — Sales Accepted Date 자체가 속한 달 (이벤트 기준)
    // Segment는 "SAL Segment"(SAL 이벤트 자체의 터치로 독립 분류, 위 참고) —
    // New Leads/New P1이 쓰는 First Touch 고정값 segment와 다름(의도된 동작).
    //------------------------------------------------------

    const salesAcceptedVal = row[salesAcceptedCol];

    if(salesAcceptedVal instanceof Date && !isNaN(salesAcceptedVal.getTime()) && inRange(salesAcceptedVal)){

      const salSegment = (salSegmentCol !== -1 ? row[salSegmentCol] : "") || "Other";

      const key = keyFor(salesAcceptedVal, salSegment);

      result.sal[key] = (result.sal[key] || 0) + 1;

      const weekKey = formatWeekKeyDate_(getMondayOfWeek_(salesAcceptedVal)) + "|" + salSegment;

      result.salWeekly[weekKey] = (result.salWeekly[weekKey] || 0) + 1;

      if(isEffectiveP1_(row[priorityCol], row[priorityOverrideCol])){
        result.salP1Weekly[weekKey] = (result.salP1Weekly[weekKey] || 0) + 1;
      }

    }

    //------------------------------------------------------
    // IC Booked — IC Booked Date 자체가 속한 달 (이벤트 기준)
    //------------------------------------------------------

    const icBookedVal = row[icBookedCol];

    if(icBookedVal instanceof Date && !isNaN(icBookedVal.getTime()) && inRange(icBookedVal)){
      const key = keyFor(icBookedVal, segment);
      result.icBooked[key] = (result.icBooked[key] || 0) + 1;
    }

    //------------------------------------------------------
    // IC Complete — IC Completed Date 자체가 속한 달 (이벤트 기준)
    //------------------------------------------------------

    const icCompleteVal = row[icCompleteCol];

    if(icCompleteVal instanceof Date && !isNaN(icCompleteVal.getTime()) && inRange(icCompleteVal)){
      const key = keyFor(icCompleteVal, segment);
      result.icComplete[key] = (result.icComplete[key] || 0) + 1;
    }

  }

  return result;

}


/**
 * ==========================================================
 * Compute ACQ Deal Revenue From Rows (순수 함수 — 2트랙 설계, Revenue 전용)
 *
 * WHY (2026-07-28)
 * Revenue는 더 이상 Leads_OPS의 Opportunity Won Date/Revenue(Salesforce
 * 동기화 컬럼, 리드 단위)로 계산하지 않는다 — Deal Tracker를 Source of
 * Truth로 삼는 2트랙 설계(CLAUDE.md #7)에 따라 Deal Tracker 자체의 Close
 * Date/Revenue로 직접 계산한다.
 *
 * Segment 분류 — 2026-07-28 재수정: 최초 구현은 getBusinessSegment()로
 * Lead Source Detail/Lead Source/Source Category를 키워드 매칭해 자동
 * 분류했으나, 실측 검증 결과 정확도가 신뢰 불가 수준이었다(Search 세그먼트가
 * 코드 기준 $144,265인데 실제로는 ~$537,507.89 — 약 $393K 갭; 별도로
 * Upsell $3,962.96 미제외 버그도 발견). 사용자가 Deal Tracker에 전체 딜을
 * 수동으로 재분류한 "Segment" 컬럼(H열, 원래 "Content Category")을 만들었으므로
 * `row.businessSegment`(`readDealTrackerRawRows_()` 참고)를 그대로 Source of
 * Truth로 쓴다 — 키워드 매칭·Upsell 별도 제외 전부 폐기(Upsell은 이 컬럼에서
 * 이미 "Other"로 수동 분류됨). "N/A"(출처 불명, 대부분 2022년 이전 딜)는
 * `CONFIG.ACQ.SEGMENTS`(7개) 밖의 값이라 그대로 두면 ACQ_Summary엔 집계돼도
 * `buildACQEngineRows_()`가 7개 세그먼트만 조회하는 리포트 화면엔 안 뜨므로
 * (사용자 확인, 2026-07-28), Upsell과 동일하게 "Other"로 접어 넣는다.
 *
 * INPUT
 * dealRows : Object[]  readDealTrackerRawRows_()의 반환값(90_TargetEngine.js)
 *
 * OUTPUT
 * { "fy|month|segment": revenueSum, ... }
 *
 * TEST
 * testComputeACQDealRevenueFromRows_() 참고
 * ==========================================================
 */
function computeACQDealRevenueFromRows_(dealRows){

  const revenue = {};

  dealRows.forEach(function(row){

    const segment = row.businessSegment === "N/A" ? "Other" : row.businessSegment;

    const key = row.closeFY + "|" + getFiscalMonthLabel(row.closeDate) + "|" + segment;

    revenue[key] = (revenue[key] || 0) + (Number(row.revenue) || 0);

  });

  return revenue;

}


/**
 * ==========================================================
 * TEST — computeACQDealRevenueFromRows_()
 * ==========================================================
 */
function testComputeACQDealRevenueFromRows_(){

  const dealRows = [
    { closeFY: 26, closeDate: new Date(2025, 7, 15), revenue: 1000, businessSegment: "Webinar" },
    { closeFY: 26, closeDate: new Date(2025, 7, 20), revenue: 500, businessSegment: "Webinar" },
    { closeFY: 26, closeDate: new Date(2025, 7, 22), revenue: 300, businessSegment: "Referral" },
    { closeFY: 26, closeDate: new Date(2025, 7, 25), revenue: 5000, businessSegment: "Other" }, // Upsell은 이제 Other로 수동 분류
    { closeFY: 26, closeDate: new Date(2025, 7, 25), revenue: 700, businessSegment: "N/A" } // Other로 접혀야 함
  ];

  const result = computeACQDealRevenueFromRows_(dealRows);

  const augKey = "26|" + getFiscalMonthLabel(new Date(2025, 7, 15)) + "|Webinar";
  const referralKey = "26|" + getFiscalMonthLabel(new Date(2025, 7, 22)) + "|Referral";
  const otherKey = "26|" + getFiscalMonthLabel(new Date(2025, 7, 25)) + "|Other";

  const pass =
    result[augKey] === 1500 &&
    result[referralKey] === 300 &&
    result[otherKey] === 5700; // Other(5000) + N/A(700)가 접혀 합산됨

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}

/**
 * ==========================================================
 * Reverse Month Blocks (세그먼트 순서는 유지, 월 순서만 최신이 먼저)
 *
 * WHY
 * targetRows는 Sort Index 오름차순(오래된 달 → 최신 달)으로 정렬되어
 * 있는데, 리포트에서는 최신 달이 맨 위로 오는 게 보기 편하다.
 * 다만 각 달 안의 7개 세그먼트 순서(Seminar → ... → Other)는
 * 그대로 유지해야 하므로, "월 블록" 단위로만 순서를 뒤집는다.
 *
 * INPUT
 * targetRows : Object[]  (Sort Index 오름차순 정렬된 Engine 행들)
 * blockSize : Number  (한 달에 해당하는 행 수 = 세그먼트 개수, 보통 7)
 *
 * OUTPUT
 * Object[]  (월 블록만 뒤집힌 배열, 각 블록 내부 순서는 그대로)
 *
 * TEST
 * 입력이 [Aug-A, Aug-B, Sep-A, Sep-B] (blockSize=2)일 때
 * 출력은 [Sep-A, Sep-B, Aug-A, Aug-B] 이어야 함 (블록 내부 A→B 순서 유지)
 * ==========================================================
 */
function reverseMonthBlocks_(targetRows, blockSize){

  const blocks = [];

  for(let i = 0; i < targetRows.length; i += blockSize){
    blocks.push(targetRows.slice(i, i + blockSize));
  }

  blocks.reverse();

  return blocks.reduce(function(acc, block){
    return acc.concat(block);
  }, []);

}


/**
 * ==========================================================
 * TEST — reverseMonthBlocks_()
 * ==========================================================
 */
function testReverseMonthBlocks(){

  const input = [
    { label: "Aug-A" }, { label: "Aug-B" },
    { label: "Sep-A" }, { label: "Sep-B" }
  ];

  const result = reverseMonthBlocks_(input, 2);

  const expectedOrder = ["Sep-A", "Sep-B", "Aug-A", "Aug-B"];
  const actualOrder = result.map(function(r){ return r.label; });

  const pass = JSON.stringify(actualOrder) === JSON.stringify(expectedOrder);

  Logger.log("Expected : " + expectedOrder.join(", "));
  Logger.log("Actual   : " + actualOrder.join(", "));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}