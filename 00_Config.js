/**
 * ==========================================================
 * Marketing 2.0
 * Configuration
 *
 * Responsibility
 * Central configuration for the entire project.
 *
 * Business logic MUST NOT exist here.
 *
 * Version
 * v1.35.0
 *
 * Change Log
 * v1.35.0 (2026-08-08)
 * - `CONFIG.UTM_PROGRAM_DICT.SHEET`("UTM_Program_Dictionary") 신규 — MTA_Master
 *   에서 자동 채굴하는 UTM Campaign↔Marketo Program 딕셔너리 캐시 시트 설정
 *   (신규 `17_UtmProgramDictionary.js`가 소비). Kakao Moments 메시지명(UTM
 *   스타일)의 `Marketo program` 컬럼 자동 채움 위해 사용자 요청으로 착수.
 * v1.34.0 (2026-08-08)
 * - `CONFIG.FYREP.FYS`를 하드코딩 `[24,25,26]`에서
 *   `computeFYRepDefaultFYList_(24)`(FYREP_001_Engine.js 신규) 호출로
 *   교체(사용자 요청 — "27도 추가해줘. 이후 년도도 자동으로 추가되게
 *   하자") — startFY(24)부터 오늘이 속한 FY까지 자동 계산, 매년 8월
 *   수동으로 배열을 늘려줄 필요 없어짐.
 * v1.33.0 (2026-08-08)
 * - `CONFIG.FYREP.CONTROL.GENERATE`(A3:B3) 신규 — Generate 체크박스(사용자
 *   요청). Simple Trigger 권한 제약(Target_REP 선례, docs/OpenItems.md #11)
 *   때문에 설치형 트리거로 구현 — 상세는 FYREP_002_Report.js
 *   `onFYReportEdit_()`/`runInstallFYReportGenerateTrigger()` 참고.
 * v1.32.0 (2026-08-08)
 * - `CONFIG.FYREP.CONTROL` 구조 재설계(3차 피드백) — FY_RANGE(A1:B2, Start/End
 *   FY 드롭다운)와 SECTIONS(C1:F2 체크박스 + C1:E3 지표 드롭다운, Revenue만
 *   Actual 고정)로 분리. 세그먼트/채널이 컬럼, Month가 행, FY 범위만큼 블록이
 *   세로로 반복되는 최종 레이아웃(사용자 확정, 2026-08-08). 상세:
 *   docs/exec-plans/active/2026-08-07-fy-rep-implementation.md
 * v1.31.0 (2026-08-08)
 * - `CONFIG.FYREP.CONTROL`/`REPORT_START_ROW` 신규 — 사용자 피드백("세로로
 *   너무 길고 범위가 넓다")으로 Report/Write 레이어를 Control Area
 *   체크박스 4개(섹션 선택) + FY=컬럼/Month=행 피벗 레이아웃으로 재설계.
 *   상세: docs/exec-plans/active/2026-08-07-fy-rep-implementation.md
 * v1.30.0 (2026-08-08)
 * - `CONFIG.FYREP.QUARTERLY_SUMMARY` 신규 — Revenue 섹션의 회사 전체 월별
 *   Revenue Target 컬럼 위치(실측 확인: B열=월 라벨, C열=Revenue Target,
 *   3개 탭 전부 동일). `CONFIG.FYREP.REVENUE_TARGET_IS_ESTIMATED` 옆에
 *   배분 범위 결정(7세그먼트+Upsell 전체, 사용자 확정) 주석 추가. 상세:
 *   docs/exec-plans/active/2026-08-07-fy-rep-implementation.md
 * v1.29.0 (2026-08-07)
 * - `CONFIG.FYREP` 신규 — FY24/25/26 Marketing/ACQ/Pipeline/Revenue 비교
 *   리포트(신규 시트 `FY_REP`) 설정. 외부 스프레드시트(`perfTrackerByFY`,
 *   사용자가 이 세션 중 생성) 구조를 여러 차례 실측 확인한 뒤 확정된 값 —
 *   상세 배경은 docs/exec-plans/active/2026-08-07-fy-rep-implementation.md.
 * v1.28.0 (2026-08-06)
 * - `PROPERTIES.DEAL_TRACKER_LAST_ROW`/`TARGET.DEAL_TRACKER_ENGINE_SHEET`
 *   신규 — Deal Tracker(외부 시트) 직접 openById() 대신 내부 캐시
 *   DealTracker_Engine을 읽도록 전환하기 위한 설정(90_TargetEngine.js
 *   참고, 사용자 요청 — ACQ_REP/NewP1_REP Generate 성능 개선).
 * v1.27.0 (2026-08-05)
 * - `PIPELINE.STATUS_COLUMNS` 신규 — Pipeline Status 표 레이아웃 전환(행=단계 →
 *   컬럼=단계, 사용자 요청) 지원용. 상세: 08_PipelineAsync.js 참고.
 * v1.26.0 (2026-08-05)
 * - `PIPELINE.LOCK_STALE_THRESHOLD_MS`(30분) 신규 — `08_PipelineAsync.js` v1.7.0의
 *   죽은 락 자동 해제(self-heal) 버그 수정용. 상세: 08_PipelineAsync.js 참고.
 * v1.25.0 (2026-08-04)
 * - `DATE.DISPLAY_TIMEZONE`("Asia/Seoul") 신규 — Pipeline Status(08_PipelineAsync.js)
 *   Last Started/Finished 타임스탬프가 스크립트 타임존(America/New_York, appsscript.json)
 *   기준으로 찍혀 사용자가 혼동한 문제 수정(2026-08-04 실사용 피드백). `DATE.TIMEZONE`
 *   (스크립트/실행 타임존)과는 별개 용도.
 * v1.24.0 (2026-08-04)
 * - `SHEETS.README` 신규("README"), `PROPERTIES`에 `PIPELINE_LOCK`/
 *   `PIPELINE_LAST_FAILED_TYPE`/`PIPELINE_STATUS_LEADS`/`PIPELINE_STATUS_MTA` 4개
 *   신규, `PIPELINE` 블록 신규(`TYPES`/`TRIGGER_DELAY_MS`/`STATUS_ANCHOR_ROW`/
 *   `STATUS_ANCHOR_COL`) — `appendNewLeads()`/`appendNewMTA()` 백그라운드 트리거
 *   비동기화(`08_PipelineAsync.js` 신규, `docs/OpenItems.md` #9) 지원용.
 * v1.23.0 (2026-07-31)
 * - **`ACQ.META_SPENT_COLUMN` → `ACQ.SPENT_COLUMN`, `ACQ.META_SPEND_CACHE_SHEET`
 *   ("Meta_Spend_Cache") → `ACQ.AD_SPEND_CACHE_SHEET`("Ad_Spend_Cache") 개명** —
 *   Naver Search Ad API 파이프라인(AD_003_NaverSearch.js) 검증 완료 후 사용자가
 *   ACQ_REP W열에 Meta+Naver Search 합산 지출을 연결하기로 확정, 헤더도
 *   "Meta Spent"→"Spent"로 변경. 합산/환율 변환(KRW→NZD, GOOGLEFINANCE)은
 *   신규 `AD_004_SpendCache.js`가 담당. 옛 `Meta_Spend_Cache` 시트는 새
 *   `Ad_Spend_Cache`로 대체(사용자가 옛 시트는 직접 삭제 가능, 코드가 자동
 *   삭제하지 않음). 상세: docs/exec-plans/active/
 *   2026-07-30-campaign-spend-integration.md.
 * v1.22.0 (2026-07-30)
 * - `ACQ.META_SPEND_CACHE_SHEET`("Meta_Spend_Cache") 신규 — 실 시트 검증 중 발견된
 *   버그 수정. ACQ_REP Generate 체크박스가 `onEdit()` Simple Trigger로 실행되는데,
 *   Meta Spent 연결 코드(`computeMetaSpendSummary_()`)가 캠페인 지출 시트를
 *   `openById()`로 직접 열어서 "Specified permissions are not sufficient to call
 *   SpreadsheetApp.openById" 에러로 조용히 실패(Target_REP가 예전에 겪은 것과
 *   동일한 Simple Trigger 권한 제약). ACQ_Summary와 동일한 캐시 패턴으로 전환 —
 *   상세: AD_002_Meta.js v1.5.0 Change Log.
 * v1.21.0 (2026-07-30)
 * - `ACQ.META_SPENT_COLUMN`(23, W열) 신규 — AD_002_Meta.js 캠페인 지출 파이프라인
 *   (Meta 파일럿)을 ACQ_REP에 연결하기 위한 컬럼 위치. Target_Engine 연결은 8개
 *   플랫폼 중 Meta 하나만 자동화된 상태라 보류(총 지출 과소집계 위험) — 대신
 *   Segment×Month grain이 이미 맞는 ACQ_REP에 "Meta Spent"로 명확히 라벨링해서
 *   먼저 연결(사용자 확정, 2026-07-30). 상세:
 *   docs/exec-plans/active/2026-07-30-campaign-spend-integration.md
 * v1.20.0 (2026-07-30)
 * - ACQ_REP/NewP1_REP에 Target 컬럼 추가(Revenue Target/Revenue Target%/New P1
 *   Target/New P1 Target% — ACQ_REP, Spent/CPNP1/New P1 Target/New P1 Target% —
 *   NewP1_REP). 두 시트 다 컬럼 배치를 두 번 고쳐서 최종 확정(둘 다 실 시트
 *   검증에서 발견, docs/exec-plans/active/2026-07-30-acq-newp1-target-columns.md
 *   Surprises 참고):
 *   - **ACQ_REP**: O열(바로 다음 컬럼)부터 시도 → `ENGINE_START_COL`(15, 숨김
 *     Engine 영역 O:R)과 충돌 → S열로 이동 → 이번엔 U:AF(21~32, 사용자 수동
 *     수식/소계 영역, `MANUAL_AREA_NOTE`)와 충돌 → 최종 AH열(34, `TARGET_COLUMNS_START_COL`)로
 *     확정. `REPORT_DATA_COLUMNS`(14, 기존 하드코딩 `14` 리터럴 교체)도 신규.
 *   - **NewP1_REP**: N열(바로 다음 컬럼)부터 시도 → N열이 사용자 수동 영역
 *     (`MANUAL_AREA_NOTE`)이라 충돌 → O열(15, `TARGET_COLUMNS_START_COL`)로
 *     확정. NewP1_REP은 숨김 Engine 컬럼이 없어(Engine은 별도 시트
 *     `NewP1_Engine`) 그 문제는 없었음.
 * v1.19.0 (2026-07-30)
 * - `REPORT.SEGMENT_HEADER_COLORS`를 원색(v1.18.0)에서 흰색 75:25 블렌딩 파스텔로
 *   교체 — "색이 너무 강하다"는 사용자 피드백. hue는 동일 유지, 채도만 낮춤.
 * v1.18.0 (2026-07-30)
 * - Target_REP 헤더를 3행 구조(세그먼트명/Target·Actual/개별 지표)로 재설계 — 사용자
 *   요청("컬럼이 너무 넓다"). `REPORT.ROWS`를 SEGMENT_HEADER_ROW(2)/TARGET_ACTUAL_HEADER_ROW(3)/
 *   METRIC_HEADER_ROW(4)/REPORT_DATA_START(5)로 재정의(기존 REPORT_HEADER/REPORT_DATA_START
 *   폐기). `GROUP_COLUMN_COUNT` 7→6 — 달성%는 다른 시트에서 확인한다는 사용자 확인으로
 *   제거, 컬럼 순서를 Target(New P1/Pipeline P1/P1/CPNP1) + Actual(P1/CPNP1)로 재배치.
 *   신규 `TARGET_SUBCOLUMN_COUNT`(4)/`ACTUAL_SUBCOLUMN_COUNT`(2)(3행 병합 범위용),
 *   `SEGMENT_HEADER_COLORS`(dataviz 스킬 카테고리컬 팔레트 1~5번 슬롯, 세그먼트별 헤더
 *   배색). 구현: `91_TargetReport.js`/`92_TargetStyles.js` v1.6.0.
 * v1.17.0 (2026-07-30)
 * - `SEMINAR_CAMPAIGN_MONTHS` 하드코딩 상수를 삭제하고 Block 0 신규 섹션 5
 *   (`INPUT.SEMINAR_ACTIVE_MONTHS`, row 32, B~M열 체크박스)로 대체 — 사용자 요청:
 *   "계획이 바뀔 때마다 코드를 고치는 게 아니라 시트에서 체크만 바꾸고 싶다".
 *   `LAST_ROW` 30→32, `DEFAULTS.SEMINAR_ACTIVE_MONTHS`는 최초 체크박스 시딩값으로만
 *   쓰이고 이후 계산은 시트 체크박스 값을 직접 읽는다(90_TargetEngine.js v1.21.0).
 * v1.16.0 (2026-07-30)
 * - Target CPNP1 벤치마크 재활성화: `BENCHMARK.CPNP1_FYS/WEIGHTS`를 `[]`에서 `[26]`/`[1]`로
 *   전환 — 세그먼트별 월별 Spent(Block 0 MANUAL_SEGMENT_SPENT) 수동 취합이 끝나면서
 *   분자를 채널시트 대신 그 그리드로 교체(90_TargetEngine.js `buildSpentByGroupFYMonthFromManualInput_()`
 *   신규). 이제 안 쓰는 `EXTERNAL.CHANNEL_SHEET_GID`/`CHANNEL_COLUMNS`/`NAVER_SHEET_GID`/
 *   `NAVER_COLUMNS`/채널·Naver용 `SPREADSHEET_ID` 전부 삭제(`DEAL_TRACKER`는 유지) —
 *   `readChannelRawRows_()`/`readNaverRawRows_()`/`computeCombinedSpentByGroupFYMonth_()`도
 *   함께 삭제(90_TargetEngine.js v1.20.0, 3그룹 키 하드코딩이라 5세그먼트와도 안 맞던 죽은 코드).
 * - 신규 `SEMINAR_CAMPAIGN_MONTHS`(["SEP","OCT","DEC","JAN","MAR","APR"]) — FY27 Seminar가
 *   Oct/Jan/Apr 3회만 개최되고 캠페인은 행사 30일 전 시작이라, 과거 실적 기반 시즌성을
 *   그대로 쓰면 비활성 월에도 New P1 Target이 생기는 문제를 Block D에서 이 목록 기준
 *   균등 분배로 대체(Seminar 전용 하드코딩, 90_TargetEngine.js 참고).
 * v1.15.0 (2026-07-30)
 * - CONFIG.TARGET.INPUT.CPNP1_BENCHMARK_MANUAL → CPNP1_BENCHMARK로 이름 변경(행 번호는
 *   그대로 14/15~19) — 세그먼트별 FY26 CPNP1 벤치마크가 수동 입력에서 "월별 Segment
 *   Spent 합 ÷ FY26 Segment New P1 합" 자동 계산으로 전환됨(사용자 요청, 세그먼트별
 *   월별 Spent 수동 취합 완료 후). 계산은 90_TargetEngine.js의 신규
 *   computeCPNP1BenchmarkByGroup_()가 담당. 상세:
 *   docs/exec-plans/active/2026-07-30-target-rep-segment-breakdown.md
 * v1.14.0 (2026-07-30)
 * - CONFIG.TARGET.ENGINE Block A~D 시작 컬럼을 전부 +10 이동(4/13/21/28 →
 *   14/23/31/38) — Block 0의 신규 월별 그리드 섹션(B~M열, 12개월)이 기존
 *   BLOCK_A_START_COL(D열=4)과 정확히 겹쳐 실제 시트에서 두 블록 데이터가
 *   같은 행/컬럼에서 서로 덮어쓰던 버그 발견·수정(사용자 실측 리포트). 상세:
 *   docs/exec-plans/active/2026-07-30-target-rep-segment-breakdown.md
 * v1.13.0 (2026-07-30)
 * - CONFIG.TARGET 세그먼트 구조 전면 분해: GROUP_ORDER/SEGMENT_GROUPS를 3그룹
 *   (events/contact/content)에서 5개 실제 Business Segment(Seminar/Webinar/
 *   BOFU/Search/Content)로 교체 — Referral/Other는 계속 제외. BENCHMARK.CPNP1_FYS/
 *   WEIGHTS는 빈 배열로 잠정 중단(채널시트가 3그룹 단위라 5세그먼트 자동 분해 불가 —
 *   대신 세그먼트별 CPNP1은 신규 INPUT.CPNP1_BENCHMARK로 계산 — v1.15.0에서
 *   "월별 Segment Spent 합 ÷ FY26 Segment New P1 합" 자동 계산으로 전환).
 *   INPUT 블록을 4개 섹션(스칼라/CPNP1 벤치마크 수동입력/월별 회사 전체 Revenue
 *   Target·Budget/세그먼트별 월별 실제 Spent)으로 확장, IMPROVEMENT_FACTOR/DEAL_SHARE는
 *   named row에서 START행+GROUP_ORDER 인덱스 방식으로 변경(90_TargetEngine.js
 *   readTargetEngineInputs_()/setupTargetEngineInputDefaults_() 참고). 상세 배경:
 *   docs/exec-plans/active/2026-07-30-target-rep-segment-breakdown.md
 * v1.12.0 (2026-07-29)
 * - 별도 git worktree(worktree-clever-seeking-dolphin)에 있던 Target_REP
 *   New/Pipeline 2트랙 Block C/D 확장 설정(2026-07-27, 아래 v1.13.0-worktree/
 *   v1.12.0-worktree 항목)을 main에 merge(90_TargetEngine.js v1.15.0 changelog
 *   참고 — 세션 중 clasp push가 이 worktree의 라이브 배포분을 덮어쓴 사고
 *   복구). CONTENT_CATEGORY_GROUP_MAP(worktree가 추가했던 것)은 그 이후
 *   main에서 SEGMENT 컬럼 직접 참조 방식(v1.11.0, 2026-07-28)으로 이미
 *   대체된 상태라 제거 — classifyDealSegment_()는 더 이상 이 맵을 안 씀.
 * v1.11.0 (2026-07-28)
 * - CONFIG.TARGET.EXTERNAL.DEAL_TRACKER.COLUMNS에 SEGMENT(8, H열) 추가 —
 *   사용자가 Deal Tracker의 H열("Content Category"였던 컬럼을 "Segment"로
 *   개명)에 전체 딜을 수동으로 Business Segment 재분류함. getBusinessSegment()
 *   키워드 매칭이 실측 검증(Search $144,265 vs 실제 ~$537,507.89, 약 $393K
 *   갭)으로 신뢰 불가 판정돼 이 컬럼을 Source of Truth로 전환(90_TargetEngine.js
 *   readDealTrackerRawRows_()/classifyDealSegment_(), 30_ACQReport.js
 *   computeACQDealRevenueFromRows_() 참고). SOURCE_CATEGORY/LEAD_SOURCE_DETAIL은
 *   세그먼트 분류엔 더 이상 안 씀(다른 용도로 보존).
 * v1.13.0-worktree (2026-07-27, worktree-clever-seeking-dolphin에서 병합)
 * - CONFIG.TARGET.ENGINE.BLOCK_D_COLUMNS 8→12(Block D도 New/Pipeline 각각
 *   전개), CONFIG.TARGET.REPORT.GROUP_COLUMN_COUNT 5→7(Target_REP에 Target
 *   New/Pipeline P1 컬럼 추가) — Target_REP에서 New/Pipeline P1 목표를 분리
 *   표시해달라는 사용자 요청 반영. 90_TargetEngine.js/91_TargetReport.js/
 *   92_TargetStyles.js 참고.
 * v1.12.0-worktree (2026-07-27, worktree-clever-seeking-dolphin에서 병합)
 * - CONFIG.TARGET.ENGINE.BLOCK_C_COLUMNS 2→6(딜비중+New/Pipeline 2트랙 FY
 *   목표), BLOCK_D_START_COL 24→28(X열→AB열, Block C 확장에 따른 이동) —
 *   New/Pipeline 2트랙 FY P1 목표 공식 확정(CLAUDE.md #7 최종 결정),
 *   90_TargetEngine.js 참고.
 * v1.10.0 (2026-07-27)
 * - CONFIG.TARGET.ENGINE Block B를 4컬럼→7컬럼으로 확장(코호트1 CurrentFYP1V/
 *   코호트2 PrevP1V 분리 표시), Block C/D 시작 컬럼 뒤로 이동(U열/X열).
 * v1.9.0 (2026-07-27)
 * - CONFIG.TARGET.EXTERNAL.DEAL_TRACKER.MEDIAN_FYS 제거 — 딜 비중을 3FY
 *   median에서 FY26 단일 코호트(CONFIG.TARGET.P1_VALUE_FY 재사용) 기준으로
 *   변경(사용자 확정: median이 최근 연도 실제 구성비와 10%p 이상 괴리).
 * v1.8.0 (2026-07-27)
 * - CONFIG.TARGET.EXTERNAL.DEAL_TRACKER 전면 재작성 — Student/Guardian Email/
 *   Account Name 기반 Leads_OPS 매칭 아키텍처 폐기(Sales팀 확인: 상담 후
 *   이메일 덮어쓰기로 시스템적 복구 불가). Deal Tracker를 Source of Truth로
 *   삼아 원래 시트(gid 498663095)로 복귀, 딜 자체의 Lead Source/Source
 *   Category/Lead Source Detail로 직접 세그먼트 분류. P1 판정 제거(사용자
 *   확인: 99%가 P1). 상세: CLAUDE.md #7.
 * v1.7.0 (2026-07-27)
 * - CONFIG.TARGET.EXTERNAL.DEAL_TRACKER.COLUMNS에 MKT_UTM_CAMPAIGN/
 *   FIRST_TOUCH_DETAIL/LEAD_SOURCE_CATEGORY 추가 — Student/Guardian/Account
 *   Name 전부 실패한 딜을 위한 4차 "고스트" 분류(getBusinessSegment() 재사용,
 *   Leads_OPS 매칭 없이 딜 자체의 UTM/터치 필드로 직접 세그먼트 분류).
 * v1.6.0 (2026-07-27)
 * - CONFIG.TARGET.EXTERNAL.DEAL_TRACKER.COLUMNS에 ACCOUNT_NAME 추가 — Student/
 *   Guardian Email 둘 다 실패할 때(Lead Merge로 원본 이메일 자체가 소실된
 *   케이스) 3차 매칭 후보로 Account Name(Leads_OPS."Company / Account"와 매칭).
 * v1.5.0 (2026-07-27)
 * - CONFIG.TARGET.EXTERNAL.DEAL_TRACKER 전면 교체 — 딜트래커 시트를 FY24~26
 *   기준으로 새로 재구축(신규 스프레드시트 ID, gid 0). FY 컬럼 없음(Close Date
 *   에서 파생), Source/Opp Email → Student Contact Email/Primary Guardian
 *   Email로 명확화(근본 원인 규명 후 정정), Stage 필터/대소문자 무시 Lead
 *   Source 비교 추가.
 * v1.4.0 (2026-07-27)
 * - CONFIG.TARGET.EXTERNAL.DEAL_TRACKER.COLUMNS 갱신 — 사용자가 딜트래커에
 *   "Opp Email"/"Revenue KRW" 컬럼 추가(Revenue (NZD)는 이제 A1 환율 기준
 *   수식값)하며 컬럼 위치 전체 이동. OPP_EMAIL(2차 매칭 후보) 추가.
 * v1.3.0 (2026-07-27)
 * - CONFIG.TARGET.EXTERNAL.DEAL_TRACKER 추가 — Block C(딜 비중)를 균등 분할
 *   placeholder(33%씩) 대신 실제 Deal Tracker 데이터(FY24·25·26, Upsell/
 *   Referral 제외, Source email로 Leads_OPS 매칭)로 계산하도록 전환.
 * v1.2.0 (2026-07-27)
 * - CONFIG.TARGET.REPORT.ROWS 단순화: CONTROL_HEADER/CONTROL_VALUE/PARAM_SUMMARY
 *   제거, REPORT_HEADER=2/REPORT_DATA_START=3로 축소 (Target_REP Control 영역
 *   전체 삭제 — 사용자 요청, 91_TargetReport.js 참고). COLUMNS.GENERATE도 제거.
 * v1.1.0 (2026-07-27)
 * - CONFIG.TARGET 추가 (Target_REP 구현 착수, docs/TargetReportDesign.md 참고).
 * ==========================================================
 */

const CONFIG = {

  /**
   * Spreadsheet
   */
  SPREADSHEET: SpreadsheetApp.getActiveSpreadsheet(),

  /**
   * Sheet Names
   */
  SHEETS: {

    // Raw
    LEADS_RAW: "Leads_Raw",
    MTA_RAW: "MTA_Raw",

    // Master
    LEADS_MASTER: "Leads_Master",
    MTA_MASTER: "MTA_Master",

    // Ops / Docs
    // 2026-08-04 추가 — 백그라운드 파이프라인 진행상태 표시용(08_PipelineAsync.js)
    README: "README"

  },

  /**
     * UTM_PROGRAM_DICT — UTM Campaign ↔ Marketo Program명 딕셔너리(2026-08-08 신규).
     * MTA_Master(MKT UTM Campaign / Lead Source Detail)에서 자동으로 채굴해
     * 같은 스프레드시트 안 숨김 시트에 캐시(17_UtmProgramDictionary.js).
     * Kakao Moments 등 UTM 스타일 이름만 있는 채널이 실제 Marketo Program명을
     * 자동으로 찾을 때 이 캐시를 읽는다(Simple Trigger 안전, 같은 스프레드시트).
     */
  UTM_PROGRAM_DICT: {
    SHEET: "UTM_Program_Dictionary"
  },

  /**
     * Required Fields (Validation)
     *
     * 비어있으면 안 되는 컬럼 목록.
     * Import Type별로 관리.
     */
    REQUIRED_FIELDS: {

      LEADS: [
        "Lead ID",
        "Email",
        "Create Date",
        "Company / Account"
      ],

      MTA: [
        "Lead: Lead ID",
        "Lead: Email",
        "Multi Touch Attribution: Created Date"
      ]

  },

  /**
   * Raw Date Columns
   *
   * CSV 원본 텍스트 그대로 보존해야 하는 컬럼.
   * Raw 쓰기 시 Plain Text 서식 강제 대상.
   */
  RAW_DATE_COLUMNS: {

    LEADS: [
      "Create Date",
      "IC Booked Date",
      "IC Completed Date (Pre-Conversion)",
      "Opportunity Won Date"
    ],

    MTA: [
      "Multi Touch Attribution: Created Date",
      "Lead Created Date",
      "Lead: IC Booked Date",
      "Lead: IC Completed Date (Pre-Conversion)",
      "Lead: Opportunity Won Date"
    ]

  },

  /**
   * Script Properties Keys
   *
   * Incremental Build가 "어디까지 처리했는지" 추적하는 데 사용.
   */
  PROPERTIES: {

    LEADS_LAST_ROW: "LEADS_LAST_PROCESSED_ROW",
    MTA_LAST_ROW: "MTA_LAST_PROCESSED_ROW",

    // 2026-08-04 추가 — 백그라운드 파이프라인 트리거 비동기화(08_PipelineAsync.js)
    PIPELINE_LOCK: "PIPELINE_CHAIN_LOCK",
    PIPELINE_LAST_FAILED_TYPE: "PIPELINE_LAST_FAILED_TYPE",
    PIPELINE_STATUS_LEADS: "PIPELINE_STATUS_LEADS",
    PIPELINE_STATUS_MTA: "PIPELINE_STATUS_MTA",

    // 2026-08-06 추가 — DealTracker_Engine 증분 동기화 체크포인트
    // (appendNewDealTrackerRows_(), 90_TargetEngine.js). LEADS_LAST_ROW/
    // MTA_LAST_ROW와 동일 관례: 이미 처리한 "데이터 행 개수"(헤더 제외, 0-based).
    DEAL_TRACKER_LAST_ROW: "DEAL_TRACKER_LAST_PROCESSED_ROW"

  },

  /**
   * Pipeline Async (Background Trigger Chain)
   *
   * 2026-08-04 추가 — appendNewLeads()/appendNewMTA()의 refresh 체인을
   * 설치형 1회성 트리거로 백그라운드 처리하기 위한 설정(08_PipelineAsync.js).
   * STATUS_ANCHOR_ROW/COL은 CONFIG.SHEETS.README 탭에 Pipeline Status
   * 7행×3열 블록을 쓰는 시작 좌표(1-indexed, A1).
   */
  PIPELINE: {

    TYPES: {
      LEADS: "LEADS",
      MTA: "MTA"
    },

    TRIGGER_DELAY_MS: 1000,

    // **2026-08-05 신규** — 락에 타임스탬프를 같이 저장해, 이 시간(30분)보다 오래된
    // 락은 "죽은 락"으로 간주해 자동 해제(self-heal)한다. 이 프로젝트가 도는 Google
    // Workspace 계정의 실행시간 상한이 30분으로 추정되므로(docs/PerformanceBenchmark.md),
    // 그 시점까지 안 끝났다면 플랫폼이 이미 실행을 강제 종료했을 것 — try/catch를
    // 우회하는 강제 종료 시 releasePipelineLock_()가 호출 안 돼 락이 영구히 안 풀리는
    // 문제를 실측(2026-08-05, Leads_Master 중복 대량 적체 원인 조사 중 발견 —
    // 상세는 docs/OpenItems.md 참고)으로 확인해 도입.
    LOCK_STALE_THRESHOLD_MS: 30 * 60 * 1000,

    STATUS_ANCHOR_ROW: 1,
    STATUS_ANCHOR_COL: 1,

    // **2026-08-05 신규** — Pipeline Status 표 레이아웃을 "단계=행" → "단계=컬럼"으로
    // 전환(사용자 요청, README에서 New Leads/MTA Leads 두 행이 각 실무 영역(Master
    // Update~Target_REP)을 컬럼으로 갖도록). key는 08_PipelineAsync.js의
    // state.stages 객체 키와 반드시 일치해야 함(buildPipelineStatusGrid_() 참고).
    // 순서 = 실제 파이프라인 실행 순서(런타임 완료 시점 기준, runLeadsPipelineTail()/
    // runMTAPipelineTail() 참고).
    STATUS_COLUMNS: [
      { KEY: "masterUpdate", HEADER: "Master Update" },
      { KEY: "leadsOps", HEADER: "Leads_OPS" },
      { KEY: "eventsOps", HEADER: "Events_OPS" },
      { KEY: "bofuOps", HEADER: "BOFU_OPS" },
      { KEY: "searchOps", HEADER: "Search_OPS" },
      { KEY: "contentOps", HEADER: "Content_OPS" },
      { KEY: "campaignSpend", HEADER: "Campaign Spend" },
      { KEY: "acqRep", HEADER: "ACQ_REP" },
      { KEY: "newP1Rep", HEADER: "NewP1_REP" },
      { KEY: "targetRep", HEADER: "Target_REP" }
    ]

  },

  /**
   * Row Definitions
   */
  ROWS: {

    HEADER: 1,
    DATA_START: 2

  },

  /**
   * Toast
   */
  TOAST: {

    TITLE: "Marketing 2.0",
    DURATION: 5

  },

  /**
   * Logging
   */
  LOG: {

    PREFIX: "[Marketing 2.0]"

  },

  /**
   * Date Format
   */
  DATE: {

    TIMEZONE: Session.getScriptTimeZone(),
    FORMAT: "yyyy-MM-dd",

    // 2026-08-04 추가 — 스크립트 타임존(appsscript.json: America/New_York)과 무관하게
    // 사용자에게 보여주는 타임스탬프(예: Pipeline Status Last Started/Finished)는
    // 항상 KST로 표시하기 위한 상수. TIMEZONE(스크립트/실행 타임존)과는 용도가 다름 —
    // 혼동 금지.
    DISPLAY_TIMEZONE: "Asia/Seoul"

  },
  
  /**
   * ACQ Report
   */
  ACQ: {

    SHEET: "ACQ_REP",
    SUMMARY_SHEET: "ACQ_Summary", 

    ROWS: {
      CONTROL_HEADER: 1,
      CONTROL_VALUE: 2,
      REPORT_HEADER: 4,
      REPORT_DATA_START: 5
    },

    COLUMNS: {
      START_FY: 1,      // A
      START_MONTH: 2,   // B
      END_FY: 3,        // C
      END_MONTH: 4,     // D
      GENERATE: 5       // E (checkbox)
    },

    ENGINE_START_COL: 15,  // O열 (숨김, 폭 4 — O:R)

    // Report Area 원래 데이터 폭(A:N, FY~Revenue) — 기존 하드코딩 `14` 리터럴 교체용.
    REPORT_DATA_COLUMNS: 14,

    // (과거 기록) U:AF(21~32열)에 사용자가 직접 넣은 수동 수식/소계가 있었으나
    // 2026-07-30 사용자가 직접 삭제 — 더 이상 이 범위를 피할 필요 없음(아래
    // TARGET_COLUMNS_START_COL이 다시 S열로 돌아온 이유). 앞으로 이 영역에
    // 사용자가 다시 수동 내용을 넣을 수 있으므로 코드가 U:AF를 쓰는 건 여전히
    // 권장 안 함(구두 협의 사항, 강제 아님).

    // Target 컬럼(Revenue Target/Revenue Target%/New P1 Target/New P1 Target%) 위치.
    // 2026-07-30 컬럼 충돌을 거쳐 확정:
    // 1차 — 처음엔 O열(15)부터 이어붙이려다 ENGINE_START_COL(15, 숨김 Engine 영역
    //   O:R, 폭 4)과 겹치는 걸 코드 리뷰로 발견해 S열(19)로 이동.
    // 2차 — S:V(19~22)로 실 시트 검증했더니 이번엔 U:AF(21~32, 사용자 수동
    //   수식/소계)와 겹쳐 아무것도 안 보이는 문제 발생(사용자 리포트) — AH열(34)로 재이동.
    // 3차(최종) — 사용자가 U:AF의 수동 수식/소계를 직접 삭제하면서 다시 여유가
    //   생겨, S열(19)로 원복(사용자 확정, 2026-07-30). 상세:
    //   docs/exec-plans/active/2026-07-30-acq-newp1-target-columns.md
    TARGET_COLUMNS_START_COL: 19,  // S열
    TARGET_COLUMNS_COUNT: 4,

    // Spent 컬럼(2026-07-30 신규, 2026-07-31 Meta 전용→플랫폼 합산으로 확장) —
    // 캠페인 지출 파이프라인 결과(현재 Meta+Naver Search, AD_004_SpendCache.js가
    // 합산)를 리포트 생성 시점에 조회해서 붙임(Target 컬럼과 동일 패턴). S:V(19~22,
    // TARGET_COLUMNS_*) 바로 다음인 W열(23)에 배치 — 붙이기 전 사용자에게 W열
    // 이후 수동 내용 없음을 확인받음(2026-07-30, 오늘 세 번 겪은 컬럼 충돌 재발 방지).
    // **헤더명 "Meta Spent"→"Spent"로 변경(2026-07-31, 사용자 확정)** — Naver
    // Search까지 합산되면서 "Meta 전용"이라는 의미가 더 이상 안 맞음. 아직 8개
    // 플랫폼 중 2개(Meta+Naver Search)만 자동화된 상태라 "총 광고비"와는 여전히
    // 다름 — 헤더 Note에 그 사실을 명시(32_ACQReportStyles.js). 상세:
    // docs/exec-plans/active/2026-07-30-campaign-spend-integration.md.
    SPENT_COLUMN: 23,  // W열

    // Ad Spend 캐시 시트(2026-07-30 Meta 전용으로 신규, 2026-07-31 플랫폼 합산
    // 캐시로 확장·개명 — 같은 메인 스프레드시트 안) — ACQ_REP의 Generate
    // 체크박스가 onEdit() Simple Trigger로 실행되는데, Simple Trigger는
    // 제한된 권한이라 캠페인 지출 시트를 openById()로 여는 걸 못 함(실측 확인:
    // "Specified permissions are not sufficient to call SpreadsheetApp.openById").
    // ACQ_Summary와 동일한 캐시 패턴 — AD_004_SpendCache.js의 runRefreshAdSpendCache()가
    // 수동 실행 시 Meta/Naver Search 각 플랫폼 요약을 합산(환율 변환 포함)해 이 캐시
    // 시트(같은 스프레드시트)에 미리 저장해두고, generateACQReport_()는 이 캐시만
    // 읽는다(외부 열기/API 호출 없음, Simple Trigger 안전).
    AD_SPEND_CACHE_SHEET: "Ad_Spend_Cache",

    SEGMENTS: [
      "Seminar",
      "Webinar",
      "BOFU",
      "Search",
      "Content",
      "Referral",
      "Other"
    ],

    FISCAL_MONTH_ORDER: [
      "AUG", "SEP", "OCT", "NOV", "DEC",
      "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL"
    ]

  },

  /**
   * NewP1 Report (New P1 Cohort Funnel Report)
   *
   * docs/NewP1ReportDesign.md 참고. Segment 목록/순서와 Fiscal Month
   * 순서는 CONFIG.ACQ.SEGMENTS / CONFIG.ACQ.FISCAL_MONTH_ORDER를 그대로 재사용.
   */
  NEWP1: {

    SHEET: "NewP1_REP",
    ENGINE_SHEET: "NewP1_Engine",

    ROWS: {
      CONTROL_HEADER: 1,
      CONTROL_VALUE: 2,
      REPORT_HEADER: 4,
      REPORT_DATA_START: 5
    },

    COLUMNS: {
      START_FY: 1,      // A
      START_MONTH: 2,   // B
      END_FY: 3,        // C
      END_MONTH: 4,     // D
      GENERATE: 5       // E (checkbox)
    },

    // Fiscal Week 이론상 최댓값(W53) — Sort Index 계산의 고정폭 슬롯 수로 사용.
    MAX_WEEKS: 53,

    // Report Area 원래 데이터 폭(A:M, FY~Revenue, NEWP1_REPORT_HEADERS 13개) —
    // 40_NewP1Report.js가 이 값을 직접 계산해 쓰지 않고 NEWP1_REPORT_HEADERS.length를
    // 쓰므로 여긴 참고용 상수 아님(실제 폭 소스는 그 배열).

    // (과거 기록) N열(14)에 사용자가 직접 넣은 수동 내용이 있었으나 2026-07-30
    // 사용자가 직접 삭제 — 더 이상 이 컬럼을 피할 필요 없음(아래
    // TARGET_COLUMNS_START_COL이 다시 N열로 돌아온 이유).

    // Target 컬럼(Spent/CPNP1/New P1 Target/New P1 Target%) 위치. 2026-07-30
    // 처음엔 N열(14, A:M 바로 뒤)부터 이어붙였다가 → N열 수동 영역과 겹쳐 O열(15)로
    // 피함(사용자 리포트: "N:Q 안 나타나") → 사용자가 N열 수동 내용을 직접 삭제하면서
    // 다시 N열(14)로 원복(사용자 확정, 2026-07-30 — ACQ_REP S열 원복과 동일 맥락).
    // 상세: docs/exec-plans/active/2026-07-30-acq-newp1-target-columns.md
    TARGET_COLUMNS_START_COL: 14,  // N열
    TARGET_COLUMNS_COUNT: 4

  },

  /**
   * Target_REP (Weekly Segment Target & Achievement Report)
   *
   * docs/TargetReportDesign.md 참고. New P1/Business Segment 정의는
   * NewP1_REP(CONFIG.NEWP1)와 동일 소스(Leads_OPS)를 재사용한다.
   */
  TARGET: {

    SHEET: "Target_REP",
    ENGINE_SHEET: "Target_Engine",

    // 2026-08-06 추가 — Deal Tracker(외부 시트) 캐시. readDealTrackerRawRows_()
    // (90_TargetEngine.js)가 이제 이 시트를 읽는다 — 외부 openById() 직접 호출은
    // rebuildDealTrackerEngine_()(전체 재구축, 백그라운드 파이프라인 전용)/
    // appendNewDealTrackerRows_()(증분 동기화, Generate 클릭 시점 포함)에서만
    // 발생. 상세: 90_TargetEngine.js DealTracker_Engine 관련 함수 WHY 참고.
    DEAL_TRACKER_ENGINE_SHEET: "DealTracker_Engine",

    // 리포트 축 — CONFIG.ACQ.SEGMENTS(Business Segment 7개) 중 5개를 그대로 사용
    // (Referral/Other는 마케팅 타겟 대상이 아니므로 계속 제외 — 2026-07-30 세그먼트
    // 구조 분해로 기존 3그룹(events/contact/content) 추상화 폐기. deriveTargetGroup_()
    // 로직은 변경 없음 — 그룹명이 세그먼트명 그대로라 1:1 매핑이 됨).
    // 상세: docs/exec-plans/active/2026-07-30-target-rep-segment-breakdown.md
    GROUP_ORDER: ["Seminar", "Webinar", "BOFU", "Search", "Content"],

    SEGMENT_GROUPS: {
      Seminar: ["Seminar"],
      Webinar: ["Webinar"],
      BOFU: ["BOFU"],
      Search: ["Search"],
      Content: ["Content"]
    },

    // P1당 가치 산출 코호트 FY (§5 "P1당 가치" — FY26 1개 FY만 사용)
    P1_VALUE_FY: 26,

    BENCHMARK: {

      // New P1 벤치마크/시즌성 가중평균 — FY24:25:26 = 1:2:3 (최근 가중)
      NEWP1_FYS: [24, 25, 26],
      NEWP1_WEIGHTS: [1, 2, 3],

      // CPNP1 벤치마크(그룹×월) — 2026-07-30 세그먼트별 월별 Spent 수동 취합 완료로 재활성화.
      // 원래 채널시트(event/contact/lead 3그룹 단위) 자동집계였으나 5세그먼트로 못 쪼개
      // 한동안 빈 배열로 중단했었음. 이제 분자를 Block 0의 세그먼트별 월별 수동 Spent
      // (INPUT.MANUAL_SEGMENT_SPENT)로 교체(90_TargetEngine.js buildSpentByGroupFYMonthFromManualInput_()) —
      // 이 그리드는 FY26(P1_VALUE_FY) 1개 FY만 대표하므로 가중치도 단일 FY.
      // 과거 FY(24·25) segment-level spend 데이터가 없어 확장 불가 — 상세:
      // docs/exec-plans/active/2026-07-30-target-rep-segment-breakdown.md
      CPNP1_FYS: [26],
      CPNP1_WEIGHTS: [1]

    },

    // 주 사이클 전환일(월~일 전환, 2026-08-03) — Engine Input 블록의 편집 가능 셀 기본값.
    // 그 전 마지막 구방식 주는 7/26~8/2로 마감 (docs/TargetReportDesign.md §4).
    CUTOVER_DATE: new Date(2026, 7, 3),

    // 외부 파일 참조 (Deal Tracker, 이관 안 함 — openById() 직접 참조)
    // 실물 구조 확인: docs/TargetReportDesign.md §3 "외부 시트 실물 구조 확인 (2026-07-27)"
    //
    // WHY (2026-07-30 채널시트/Naver 참조 제거)
    // 채널시트/Naver(event/contact/lead 3그룹 단위)는 5세그먼트로 자동 분해가 안 돼
    // CPNP1 벤치마크 분자 소스에서 이미 탈락했고(BENCHMARK.CPNP1_FYS 잠정 중단),
    // Actual CPNP1도 v1.5.0(91_TargetReport.js)에서 Block 0 세그먼트별 월별 수동
    // Spent 기준으로 전환되며 참조가 완전히 사라졌다. 남아있던 readChannelRawRows_()/
    // readNaverRawRows_()/computeCombinedSpentByGroupFYMonth_()도 3그룹 키("events"/
    // "contact"/"content") 하드코딩이라 5세그먼트 GROUP_ORDER와도 안 맞는 죽은 코드였음
    // — 전부 삭제(90_TargetEngine.js v1.20.0). CPNP1 벤치마크는 이제 buildSpentByGroupFYMonthFromManualInput_()
    // 로 Block 0의 세그먼트별 월별 Spent를 재사용(CPNP1_FYS=[26]로 재활성화, 아래 참고).
    EXTERNAL: {

      // Deal Tracker([KOR] Deal Tracking) — Block B(P1당 가치)/C(딜 비중) 실데이터 원천.
      //
      // 2026-07-27 아키텍처 전환(중요): Student Contact Email/Primary Guardian
      // Email/Account Name을 Leads_OPS와 매칭시키는 접근을 전부 폐기했다 —
      // Sales팀 확인: 상담 종료 후 학부모가 이메일 변경을 요청하면 Lead/
      // Opportunity의 이메일 정보 자체가 Salesforce에서 덮어써져서, 원본
      // 마케팅 터치 이메일이 시스템적으로 복구 불가능한 경우가 있음(그래서
      // Student/Guardian/Account Name 매칭이 계속 실패하던 근본 원인).
      // 대신 Deal Tracker 자체를 Source of Truth로 삼는다 — Leads_OPS 개별
      // 리드 매칭 없이, 딜 자체에 기록된 Lead Source/Source Category/Lead
      // Source Detail 필드로 getBusinessSegment()(16_TransformHelper.js,
      // 프로젝트 공용 분류 로직)를 직접 호출해 세그먼트를 분류한다
      // (classifyDealSegment_(), 90_TargetEngine.js). P1 판정도 하지 않음
      // (사용자 확인: 딜트래커 딜의 99%가 이미 P1이라 사실상 전수 반영과 동일).
      // 예전 버전(Student/Guardian Email 기반 시트, 스프레드시트 ID
      // 1dJqSsDuFt0MbD6-aQp7NrVIiHKWfSE-BKgkLqz1J14c)은 폐기 — Created Date
      // 컬럼이 없어 코호트 구분도 불가능했음. 원래 쓰던 시트(gid 498663095)로
      // 복귀, 컬럼 구조는 2026-07-27 WebFetch로 재확인.
      DEAL_TRACKER: {

        SPREADSHEET_ID: "1oGCY8okaxhpHrtotUzbhyprCOVcJ9ndX5kX3m5qqxME",
        SHEET_GID: 498663095,

        // 헤더 1행 기준, 24컬럼 중 실제로 쓰는 7개.
        COLUMNS: {
          FY: 1,                 // A  ("FY26" 등 텍스트 — 그대로 사용, 날짜 파생 불필요)
          REVENUE: 5,            // E  (Revenue (NZD))
          LEAD_SOURCE: 6,        // F  (Upsell/Referral/Paid Search/... — EXCLUDE_LEAD_SOURCES 필터 전용,
                                  //     세그먼트 분류엔 더 이상 안 씀 — 아래 SEGMENT 참고)
          SOURCE_CATEGORY: 7,    // G  (2026-07-28부터 미사용 — getBusinessSegment() 자동 분류 폐기)
          SEGMENT: 8,            // H  (2026-07-28 추가 — 원래 "Content Category"였던 컬럼을 사용자가
                                  //     "Segment"로 개명 + 전체 딜 수동 재분류. getBusinessSegment()
                                  //     키워드 매칭이 실측 검증(Search $144,265 vs 실제 ~$537,507.89,
                                  //     약 $393K 갭) 결과 신뢰 불가로 판정돼 자동 분류 전면 폐기,
                                  //     이 컬럼을 그대로 Source of Truth로 사용. 값: Seminar/Webinar/
                                  //     BOFU/Search/Content/Referral/Other(Upsell 포함)/N/A(출처 불명,
                                  //     대부분 2022년 이전 딜)
          CLOSE_DATE: 10,        // J  (향후 코호트1/2 분리용 — 이번 라운드에선 미사용, 보존)
          CREATED_DATE: 11,      // K  (향후 코호트1/2 분리용 — 이번 라운드에선 미사용, 보존)
          LEAD_SOURCE_DETAIL: 23 // W  (2026-07-28부터 미사용 — 세그먼트 분류는 이제 SEGMENT 컬럼
                                  //     직접 사용, Lead Source Detail은 더 이상 campaign/detail
                                  //     파라미터로 안 씀)
        },

        // 조정 베이스 = 전체 딜 − 조정치(세일즈 레퍼럴 + 업셀) — 분모·분자 모두 제외.
        // 대소문자 무시 비교(실측: "Upsell"/"UpSell" 표기가 섞여 있음).
        EXCLUDE_LEAD_SOURCES: ["upsell", "referral"]

        // 딜 비중 계산 대상 FY는 3FY median이 아니라 CONFIG.TARGET.P1_VALUE_FY
        // (FY26) 단일 코호트를 그대로 쓴다 — 2026-07-27 사용자 확정: "딜 비중도
        // P1당 가치와 마찬가지로 FY26 코호트로 봐야 한다"(3FY median은 최근
        // 연도 실제 구성비와 괴리가 커서 폐기 — 실측: median 기준 contact 20.9%
        // vs FY26 단독 31.3%, 10%p 이상 차이).

      }

    },

    // Engine 시트 Block 0 (Inputs) — 절대 덮어쓰지 않는 영역 (읽기만).
    // 조정 시 숨김 해제 후 직접 편집 (docs/TargetReportDesign.md §9).
    // 예외: 섹션 2(CPNP1_BENCHMARK)는 2026-07-30부터 수동 입력이 아니라 매 refresh마다
    // 계산되어 덮어써짐 — 아래 섹션 2 설명 참고.
    //
    // 2026-07-30 세그먼트 분해 + 예산 반영으로 4개 섹션으로 확장 (컬럼 범위는 의도적으로
    // 제한 안 함 — 사용자 요청). 상세 설계 배경:
    // docs/exec-plans/active/2026-07-30-target-rep-segment-breakdown.md
    //   1) 스칼라 입력 (Target FY / Cutover Date / 세그먼트별 개선계수·딜비중 — GROUP_ORDER 순서)
    //   2) 세그먼트별 FY26 CPNP1 벤치마크 (스칼라 1개씩, 예산 기반 도출 체인 전용 — 원래 사용자
    //      직접 입력이었으나 세그먼트별 월별 Spent 수동 취합 완료 후 "월별 Segment Spent 합 ÷
    //      FY26 Segment New P1 합" 자동 계산으로 전환, refreshTargetEngine_()가 매번 덮어씀)
    //   3) 월별 회사 전체 Revenue Target / Budget (Label=A, 12개월=B..M,
    //      CONFIG.ACQ.FISCAL_MONTH_ORDER 순서)
    //   4) 세그먼트별 월별 실제 Spent (수동 취합) — 5세그먼트 × 12개월
    INPUT: {

      LABEL_COL: 1,
      VALUE_COL: 2,

      // 섹션 1 — 스칼라 입력. IMPROVEMENT_FACTOR/DEAL_SHARE는 개별 named row가 아니라
      // START 행 + GROUP_ORDER 인덱스로 계산 (5세그먼트 순서 그대로, readTargetEngineInputs_()/
      // setupTargetEngineInputDefaults_() 참고).
      ROWS: {
        TARGET_FY: 1,
        CUTOVER_DATE: 2,
        IMPROVEMENT_FACTOR_START: 3,  // 3~7 (GROUP_ORDER 순서, 5행)
        DEAL_SHARE_START: 8           // 8~12 (GROUP_ORDER 순서, 5행)
      },

      SCALAR_LAST_ROW: 12,

      // 섹션 2 — 세그먼트별 FY26 CPNP1 벤치마크 (스칼라 1개씩, VALUE_COL 사용).
      // 2026-07-30 이후 수동 입력 아님 — computeCPNP1BenchmarkByGroup_()(90_TargetEngine.js)가
      // "월별 Segment Spent 합 ÷ FY26 Segment New P1 합"으로 계산해 매 refresh마다 덮어씀.
      CPNP1_BENCHMARK: {
        HEADER_ROW: 14,
        DATA_START_ROW: 15   // 15~19 (GROUP_ORDER 순서, 5행)
      },

      // 섹션 3 — 월별 회사 전체 Revenue Target / Budget
      MONTHLY_COMPANY_INPUTS: {
        HEADER_ROW: 21,
        REVENUE_TARGET_ROW: 22,
        BUDGET_ROW: 23,
        MONTH_START_COL: 2   // B열부터 12개월 (CONFIG.ACQ.FISCAL_MONTH_ORDER 순서)
      },

      // 섹션 4 — 세그먼트별 월별 실제 Spent (수동 취합)
      MANUAL_SEGMENT_SPENT: {
        HEADER_ROW: 25,
        DATA_START_ROW: 26,  // 26~30 (GROUP_ORDER 순서, 5행)
        MONTH_START_COL: 2   // B열부터 12개월 (CONFIG.ACQ.FISCAL_MONTH_ORDER 순서)
      },

      // 섹션 5 — Seminar Active Campaign Months (체크박스, B~M열 12개월) — 2026-07-30 신규,
      // CONFIG 하드코딩 대신 도입(사용자 요청: "새 계획이 생기면 코드를 고치는 게 아니라
      // 시트에서 체크만 바꾸고 싶다"). 체크된 달만 Seminar 캠페인이 진행 중이라고 보고,
      // computeTargetDerivationRows_()(90_TargetEngine.js)가 Seminar 그룹의 월별 New/
      // Pipeline P1 Target 배분에 이 값을 직접 읽어 쓴다(체크된 달에 균등 분배,
      // computeEvenSeasonalityForMonths_() 참고). Block 0 보존 원칙 그대로 — 최초 1회만
      // DEFAULTS.SEMINAR_ACTIVE_MONTHS로 시딩하고 이후로는 절대 안 덮어씀.
      SEMINAR_ACTIVE_MONTHS: {
        ROW: 32,
        MONTH_START_COL: 2   // B열부터 12개월 (CONFIG.ACQ.FISCAL_MONTH_ORDER 순서)
      },

      LAST_ROW: 32,

      // 최초 setupTargetReport() 실행 시 채워지는 기본값 (사용자가 이후 직접 편집).
      DEFAULTS: {
        TARGET_FY: 27,
        IMPROVEMENT_FACTOR: 0.9,
        DEAL_SHARE: 0.2,   // 5세그먼트 균등분배(1/5) placeholder — 사용자가 실측치로 교체
        // SEMINAR_ACTIVE_MONTHS 체크박스 최초 시딩용(FY27 계획: Oct/Jan/Apr 개최, 캠페인
        // 행사 30일 전 시작 → 행사월+직전월 근사) — 이후 시트 체크박스가 Source of Truth,
        // 계획 바뀌면 시트에서 직접 체크/해제(코드 변경 불필요).
        SEMINAR_ACTIVE_MONTHS: ["SEP", "OCT", "DEC", "JAN", "MAR", "APR"]
      }

    },

    // Engine 시트 Block A~D 시작 컬럼 (Block 0 오른쪽부터 좌→우 배치)
    //
    // 2026-07-30 전면 이동(D→N열, +10컬럼): Block 0에 월별 그리드 섹션(MONTHLY_COMPANY_INPUTS/
    // MANUAL_SEGMENT_SPENT, MONTH_START_COL=2부터 12개월 = B~M열)이 추가되면서, 원래
    // BLOCK_A_START_COL=4(D열)이 그 그리드 한복판(D열은 그리드의 3번째 달 OCT 컬럼)과
    // 정확히 겹치는 버그가 실제 시트에서 발견됨(사용자 리포트: "Monthly Company-wide Inputs
    // 행에 AUG/SEP 다음 Webinar MAR... 행이 이어짐" — 두 블록이 같은 행에서 서로 다른 컬럼을
    // 쓰고 있었을 뿐인데 시각적으로 뒤섞여 보였던 것, 실제로는 Block 0가 쓴 값을 Block A가
    // 그대로 덮어쓰고 있었음). Block 0 그리드가 M열(13)까지 쓰므로 Block A~D를 전부 N열(14)
    // 이후로 이동(기존 간격 패턴 그대로 +10 이동: 4/13/21/28 → 14/23/31/38).
    // 상세: docs/exec-plans/active/2026-07-30-target-rep-segment-breakdown.md
    ENGINE: {

      BLOCK_A_START_COL: 14,  // N열 — 벤치마크 (Block 0 월별 그리드가 M열까지 쓰므로 그 다음부터)
      BLOCK_A_COLUMNS: 8,     // Group, Month, FY24, FY25, FY26, Weighted Avg, Seasonality%, CPNP1 Benchmark

      // P1당 가치 — 2026-07-27 사용자 확정으로 코호트1(CurrentFYP1V)/코호트2(PrevP1V)
      // 2개 값으로 분리 (docs/TargetReportDesign.md §5, CLAUDE.md #7 참고):
      // 코호트1 = Create Date·Close Date 둘 다 FY26인 딜(같은 해 생성·클로징),
      // 코호트2 = Close Date는 FY26인데 Create Date는 이전 FY(과거 리드가 이번
      // 해에 클로징된 파이프라인 기여분, content처럼 nurturing 긴 채널 대응).
      BLOCK_B_START_COL: 23,  // W열 — P1당 가치
      BLOCK_B_COLUMNS: 7,     // Group, NewP1(FY26) 수, 코호트1 Revenue(R1), CurrentFYP1V,
                                // PrevP1 수, 코호트2 Revenue(R2), PrevP1V

      // 딜 비중 + New/Pipeline 2트랙 FY P1 목표 — 2026-07-27 사용자 최종 확정
      // (CLAUDE.md #7): FY Revenue 타겟을 New 트랙(코호트1 비율÷a)/Pipeline
      // 트랙(코호트2 비율÷b)으로 나눠 계산 후 합산. 2컬럼→6컬럼으로 확장되며
      // Block D 시작 컬럼이 뒤로 밀림(refreshTargetEngine_()의 wide-clear로
      // 예전 위치 잔재 처리).
      BLOCK_C_START_COL: 31,  // AE열 — 딜 비중(코호트1/2) + New/Pipeline FY 목표
      BLOCK_C_COLUMNS: 6,     // Group, Deal Share(R1), Pipeline Share(R2),
                                // FY New P1 Target, FY Pipeline P1 Target, FY Total P1 Target

      // 2026-07-27 사용자 요청: Target_REP에서 New/Pipeline P1 목표가 분리 표시돼야
      // 해서, 합계(Total)로 뭉쳐 전개하던 걸 New/Pipeline 각각 전개하도록 확장.
      BLOCK_D_START_COL: 38,  // AL열 — 목표 전개 (주 캘린더 전체 나열)
      BLOCK_D_COLUMNS: 12     // Week Start, Week End, Month(라벨만, 예 "AUG"), Group,
                                // Month/Week New P1 Target, Month/Week Pipeline P1 Target,
                                // Month/Week Target P1(합계), Month CPNP1 Benchmark, Week Target CPNP1

    },

    // Target_REP (보임) 레이아웃
    //
    // 2026-07-27 단순화: Control 영역(Generate 체크박스/파라미터 요약)을 전부 제거.
    // Generate가 수동 실행(runGenerateTargetReport())으로 전환되며 시트 내 안내가
    // 불필요해짐 — 1행은 비워둠(향후 월 소계 행 후보, §12 Open Item #8), 2행부터 헤더.
    //
    // 2026-07-30 헤더 3행 구조로 확장(사용자 요청 — 컬럼 폭 축소): 세그먼트당 컬럼이 너무
    // 넓어서(7컬럼 플랫 헤더) 가로 스크롤이 심하다는 지적 — 세그먼트명(2행)/Target·Actual
    // 구분(3행)/개별 지표(4행) 3단 헤더로 병합해 세그먼트당 6컬럼(달성%는 다른 시트에서
    // 확인한다는 사용자 확인으로 제거)으로 축소. 데이터는 5행부터.
    REPORT: {

      ROWS: {
        SEGMENT_HEADER_ROW: 2,        // 세그먼트명 배너(세그먼트당 병합)
        TARGET_ACTUAL_HEADER_ROW: 3,  // Target/Actual 구분 배너(하위 병합)
        METRIC_HEADER_ROW: 4,         // 개별 지표 라벨(New P1/Pipeline P1/P1/CPNP1/P1/CPNP1) + 고정 3컬럼 라벨
        REPORT_DATA_START: 5
      },

      // 그룹당 6컬럼(2026-07-30 Target/Actual 그룹핑 + 달성% 제거 — "Progress는 다른
      // 시트에서 확인" 사용자 확인) 순서: Target New P1 / Target Pipeline P1 /
      // Target P1(합계) / Target CPNP1 / Actual P1 / Actual CPNP1
      GROUP_COLUMN_COUNT: 6,

      // 3행 Target/Actual 배너 병합 범위 계산용 — 그룹 6컬럼을 Target 4 + Actual 2로 분할.
      TARGET_SUBCOLUMN_COUNT: 4,
      ACTUAL_SUBCOLUMN_COUNT: 2,

      FIXED_HEADERS: ["Week Start", "Week End", "Month"],

      // 세그먼트별 헤더 배경색(GROUP_ORDER 순서와 1:1) — dataviz 스킬 카테고리컬 팔레트
      // 1~5번 슬롯(파랑/주황/아쿠아/노랑/마젠타)을 흰색과 75:25로 블렌딩한 파스텔 톤
      // (원색이 "너무 강하다"는 사용자 피드백, 2026-07-30) — 색상 계열(hue)은 원본과
      // 동일하게 유지해 세그먼트 식별성은 그대로, 채도만 낮춤. 검정 굵은 텍스트 대비
      // 14~16:1로 원색 대비 오히려 더 여유 있음(재계산 확인).
      SEGMENT_HEADER_COLORS: ["#caddf5", "#fad9cc", "#c6ebde", "#fbe8bf", "#f9dee8"]

    }

  },

  /**
   * FY_REP (FY24/25/26 Marketing/ACQ/Pipeline/Revenue 비교 리포트)
   *
   * docs/exec-plans/active/2026-08-07-fy-rep-implementation.md 참고 — 실물 구조
   * 확인(외부 스프레드시트 헤더 행/컬럼 매핑 실측)까지 마친 뒤 확정된 값들이다.
   * TARGET과 달리 세그먼트는 CONFIG.ACQ.SEGMENTS 전체 7개(Referral/Other 포함,
   * 사용자 확정) — 마케팅 타겟 배분 대상만 골랐던 TARGET.GROUP_ORDER(5개)와는
   * 다른 목적(실적 비교이지 목표 배분이 아님)이라 그대로 안 씀.
   */
  FYREP: {

    SHEET: "FY_REP",

    // Control Area — 2026-08-08 세 차례 사용자 피드백을 거쳐 확정된 최종 레이아웃.
    // (1) "범위가 너무 넓다" → 섹션 체크박스로 선택 생성. (2) "세로로 길다" →
    // FY×Month×Segment 플랫 나열 폐기, FY=컬럼 피벗 시도했다가 재차 피드백.
    // (3) "세그먼트가 컬럼을 차지하고, FY는 블록(세로 반복), 지표는 드롭다운
    // 선택"으로 최종 확정 — 세그먼트/채널을 컬럼으로, Month를 행으로, FY
    // 범위(Start~End)만큼 블록을 세로로 반복, 섹션마다 지표 1개를 드롭다운으로
    // 골라 표시(Revenue만 Actual 고정 — Target/Target%는 추정치라 사용자가
    // 제외 확정).
    CONTROL: {

      // A1:B2 — FY 범위(NewP1_REP의 Start/End FY 패턴과 동일 사상)
      FY_RANGE: {
        START_ROW: 1, END_ROW: 2,
        LABEL_COL: 1, VALUE_COL: 2
      },

      // C1:F2 — 섹션 라벨/체크박스(오른쪽으로 밀림, 사용자 확정)
      SECTIONS: {
        LABEL_ROW: 1,
        CHECKBOX_ROW: 2,
        METRIC_ROW: 3, // Marketing/ACQ/Pipeline 지표 드롭다운(Revenue는 없음 — Actual 고정)
        COLUMNS: { MARKETING: 3, ACQ: 4, PIPELINE: 5, REVENUE: 6 } // C, D, E, F
      },

      // A3:B3 — Generate 체크박스(사용자 요청, 2026-08-08). Target_REP이
      // 겪었던 것과 동일한 문제(일반 onEdit Simple Trigger는 권한 부족으로
      // SpreadsheetApp.openById() 호출 불가 — Marketing 섹션이 perfTrackerByFY
      // 외부 시트를 정확히 이 방식으로 읾)를 피하기 위해, **설치형 트리거**
      // (Installable Trigger, 08_PipelineAsync.js의 백그라운드 파이프라인과
      // 동일한 완전 권한 방식)로 구현 — 사용자가 `runInstallFYReportGenerateTrigger()`
      // (FYREP_002_Report.js)를 최초 1회만 직접 Run하면 이후엔 체크박스만으로
      // 동작. `docs/OpenItems.md` #11 참고.
      GENERATE: {
        ROW: 3,
        LABEL_COL: 1,
        CHECKBOX_COL: 2
      }

    },

    REPORT_START_ROW: 4,

    // 비교 대상 FY(오래된 순) — 우리 시스템 기준 FY(getFiscalYear() 컨벤션:
    // 8월 시작). startFY(24)부터 오늘이 속한 FY까지 자동 계산(사용자 요청,
    // 2026-08-08 — "이후 년도도 자동으로 추가되게 하자") — 매년 8월 수동으로
    // 늘려줄 필요 없음. `computeFYRepDefaultFYList_()`(FYREP_001_Engine.js)가
    // 매 실행마다 다시 계산(Apps Script는 실행마다 전체 스크립트를 새로 로드).
    FYS: computeFYRepDefaultFYList_(24),

    // Marketing 섹션 — 사용자가 새로 만든 통합 트래커. 3개 탭(FY24/FY25/FY26)
    // 모두 "0. Weekly"(레거시) 원본과 값 일치 실측 확인(2026-08-07, Facebook
    // Amount spent $66,172 등 교차검증). ⚠️ "FY26" 탭 이름은 오표기 —
    // 실제로는 2025-08~2026-07(우리 기준 진짜 FY26) 데이터가 맞음(사용자
    // 확인, exec-plan Decision Log 참고). 탭 이름 자체는 그대로 신뢰해서 씀
    // (FYS 배열의 24/25/26과 탭명 "FY24"/"FY25"/"FY26"이 1:1 대응).
    MARKETING_SOURCE: {

      SPREADSHEET_ID: "1DhJynLE6eySh6X9X-Zsgbs6HvuXDT5omjf_m0XjXQ3o",

      // FY별 탭명 + 플랫폼 블록 헤더 행(실측 확인, 2026-08-07). 헤더 행 기준
      // C~N열(3~14) = 8월~7월 고정 12개월, 3개 탭 전부 일치. FY26 탭만
      // O열(15)에 FY 합계 추가(다른 탭은 없음 — 합계는 코드에서 직접 sum).
      TABS: {
        24: { NAME: "FY24", PLATFORM_HEADER_ROW: 25 },
        25: { NAME: "FY25", PLATFORM_HEADER_ROW: 25 },
        26: { NAME: "FY26", PLATFORM_HEADER_ROW: 27 }
      },

      // 플랫폼 블록의 월 데이터는 항상 헤더행 기준 3~14열(8월~7월) — 탭마다
      // 동일(실측 확인).
      MONTH_COL_START: 3,
      MONTH_COL_COUNT: 12,

      // 플랫폼명(A열)에 줄바꿈으로 통화가 표기됨(예: "Google Paid Search\nCORE\n(AUD)").
      // 괄호 안 3자리 통화 코드를 추출해 FX 변환에 쓴다 — 표기 없으면 NZD로 간주
      // (Facebook 등 일부 블록은 통화 표기가 없고 컬럼명 자체가 "(NZD)"라 원래 NZD).
      DEFAULT_CURRENCY: "NZD",

      // 플랫폼 블록 안에서 실제로 읽는 지표(B열 라벨) — Marketing 섹션
      // Spent/Results/CPL에 필요한 것만. 나머지(ROAS/Deals/IC booked 등)는
      // 이번 라운드에선 안 읽음(필요해지면 여기 추가).
      //
      // ⚠️ SPENT는 정확히 일치가 아니라 접두사 매칭 필요(실측 확인,
      // 2026-08-07) — Facebook 블록만 "Amount spent (total) (NZD)"이고
      // Google Paid Search 등 다른 블록은 "Amount spent (total)"(통화
      // 접미사 없음)이라 라벨 문구가 블록마다 다름. 실제 통화는 라벨이
      // 아니라 A열 플랫폼명의 괄호 표기(예 "(AUD)")로 판단할 것 —
      // SPENT_PREFIX로 `startsWith` 매칭.
      METRIC_ROW_LABELS: {
        SPENT_PREFIX: "Amount spent (total)",
        CLICKS: "Clicks",
        IMPRESSIONS: "Impressions"
        // Leads/CPL은 상담(consults)/이벤트(event)/콘텐츠(content) 3분할이라
        // 별도 처리 필요 — LEAD_TYPE_SUFFIXES 참고
      },

      // Leads/CPL은 "Leads - consults" 처럼 유형 접미사가 붙는다(FY26 탭은
      // "Cost - consults"도 별도로 있음 — FY24/25엔 없고 Amount spent 총액만
      // 있음, 유형별 Cost가 없는 연도는 유형별 CPL을 못 구하므로 공란 처리).
      LEAD_TYPE_SUFFIXES: ["consults", "event", "content"]

    },

    // Quarterly Summary(회사 전체 월별 Target/Actual, 플랫폼 블록 위쪽 —
    // MARKETING_SOURCE.TABS와 같은 탭, 같은 스프레드시트) — Revenue 섹션의
    // 회사 전체 Target 원천. 실측 확인(2026-08-08,
    // runInspectFYRepQuarterlySummaryColumns() 로그 — 컬럼 문자를 직접
    // 찍어서 확인, 파이프 join 텍스트 육안 카운팅은 오독 위험이 있어 폐기).
    // B열=월/분기 라벨("AUGUST"/"August 2026"/"Q1"/"YTD" 등 섞여 있음 —
    // 월 이름으로 시작하는 라벨만 골라 쓸 것), **C열=Revenue Target은 3개
    // 탭(FY24/25/26) 전부 동일** — FY26이 F열(Revenue Actual) 뒤에
    // "% Revenue" 컬럼을 추가로 끼워 넣어 그 뒤(ROAS Actual 이후) 컬럼들은
    // FY24/25보다 한 칸씩 밀렸지만, C열 앞쪽(Revenue Target)은 영향 없음.
    QUARTERLY_SUMMARY: {
      MONTH_LABEL_COL: 2,   // B
      REVENUE_TARGET_COL: 3 // C
    },

    // ACQ/Pipeline 섹션(Actual) — Leads_OPS/Deal Tracker 재사용, 별도 시트 없음
    // (NewP1_REP/Target_REP과 동일 소스, OPS.HEADER/CONFIG.TARGET.EXTERNAL.DEAL_TRACKER
    // 그대로 재사용 — 이 블록엔 FY_REP 전용 설정만).
    //
    // Pipeline/Revenue 섹션에서 Upsell/Referral을 별도 라인으로 분리할 때는
    // Deal Tracker의 SEGMENT 컬럼(H, "Other"에 Upsell이 섞여 있음)이 아니라
    // LEAD_SOURCE 컬럼(F)을 CONFIG.TARGET.EXTERNAL.DEAL_TRACKER.EXCLUDE_LEAD_SOURCES
    // 값("upsell"/"referral")과 대소문자 무시 비교해서 식별한다 — SEGMENT 컬럼만
    // 보면 Upsell 딜과 진짜 Other 딜을 구분 못 함(00_Config.js TARGET.EXTERNAL.DEAL_TRACKER
    // 주석 참고).

    // Revenue 섹션 — 세그먼트별 Target은 실제 과거 데이터가 없어 회사 전체
    // Target(MARKETING_SOURCE 탭의 Quarterly Summary Revenue Target) × 그 FY
    // Deal Tracker 딜 비중으로 추정한다. 추정치라는 걸 리포트에 라벨링할 것
    // (정확한 문구는 Report/Styles 작성 시 확정) — 절대 "실제 세그먼트별
    // 목표였다"처럼 보이면 안 됨(사용자 확정 사항).
    //
    // **배분 범위(2026-08-08 사용자 확정)**: 7개 세그먼트(Referral/Other 포함)
    // + Upsell 전체에 다 배분한다 — Target_Engine의 기존 5개 마케팅 세그먼트
    // 전용 Deal Share(EXCLUDE_LEAD_SOURCES로 Upsell/Referral을 분모·분자에서
    // 아예 제외)와 달리, FY_REP은 Upsell/Referral도 포함한 전체 딜 비중
    // 기준으로 비율을 계산 — `computeFYRepDealShareRatiosForFY_()`
    // (FYREP_001_Engine.js)가 `computeDealShareRatiosFromDealRows_()`
    // (90_TargetEngine.js)와 별개로 이 배분 방식을 구현.
    REVENUE_TARGET_IS_ESTIMATED: true

  },

  /**
   * Validation Summary Display Exclude
   *
   * Import 완료 alert에 표시하지 않을 필드 목록.
   * (검증/서식 강제 로직 자체는 그대로 유지, 화면 표시만 제외)
   */
  VALIDATION_SUMMARY_EXCLUDE: {

    FIELDS: [
      "Company / Account"
    ],

    DATE_COLUMNS: [
      "IC Booked Date",
      "IC Completed Date (Pre-Conversion)",
      "Opportunity Won Date"
    ]

  }

};

