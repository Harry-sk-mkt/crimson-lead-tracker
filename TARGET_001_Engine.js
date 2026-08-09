/**
 * ==========================================================
 * Marketing 2.0
 * Target Engine (Weekly Segment Target & Achievement — Calc Engine)
 *
 * Responsibility
 * Target_Engine 시트(숨김)의 Block A~D 계산/작성. Leads_OPS(New P1/
 * P1당 가치)와 Block 0의 세그먼트별 월별 수동 Spent(CPNP1 벤치마크 분자)/
 * Deal Tracker(딜 비중)를 원본으로, top-down 목표 역산 체인을 실행한다.
 * Target_REP(91_TargetReport.js)은 이 시트를 조회만 하고 원본을 재스캔하지
 * 않는다(NewP1/Events 패턴과 동일).
 *
 * 설계 문서
 * docs/TargetReportDesign.md
 *
 * Must NOT
 * - Leads_Master / MTA_Master 직접 조회 (Leads_OPS 단일 소스 원칙, NewP1과 동일)
 * - Target_Engine Block 0(Input) 영역을 덮어쓰기 (읽기만, Events_OPS Manual 패턴 준용
 *   — 단 CPNP1_BENCHMARK 섹션은 예외, v1.19.0/v1.20.0 참고)
 *
 * Stage
 * 90 Reporting (Target)
 *
 * Version
 * v1.26.1
 *
 * Change Log
 * v1.26.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `90_TargetEngine.js` → 신규 `TARGET_001_Engine.js`, 코드 내용 변경 없음.
 * v1.26.0 (2026-08-07)
 * - **버그 수정 — 주의 "월"/"FY" 귀속을 월요일 기준 → 과반(4일 이상) 기준으로 변경**
 *   (사용자 리포트: "8/31이 하루라도 포함되면 AUG로 분류되고 있다"). 신규
 *   `getWeekMajorityDate_()`(그 주 목요일=월요일+3일 — 7일이 어느 비율로
 *   나뉘어도 항상 과반 쪽에 위치함을 이용한 순수 함수) + 이를 공유하는
 *   `getWeekMonthLabel_()`/`getWeekFiscalYear_()`, `generateCalendarWeeksForFY_()`가
 *   `getFiscalMonthLabel(monday)`/`getFiscalYear(monday)` 대신 이걸 씀.
 *   `computeWeeksInMonthCounts_()` 등 하위 로직은 이미 이 함수의 week.month/week.fy를
 *   그대로 재사용하는 구조라 추가 수정 없이 자동 반영. 91_TargetReport.js의
 *   `computeTargetActualCPNP1ByGroupMonth_()`가 독립적으로 재계산하던 month/fy도
 *   같은 함수로 교체해 키 불일치 방지(v1.9.0 참고). **처음엔 월만 고치고 FY는
 *   월요일 기준으로 남겨뒀으나(월경계 주만 어긋나는 좁은 문제로 보고, FY26/FY27
 *   실측 영향 없음 확인), 검토 중 "FY와 월 귀속 기준이 서로 다르면 아주 드물게
 *   (Aug 1이 화~목요일에 걸리는 해) 한 FY 리포트 안에 AUG가 처음/끝 두 번
 *   나타나고 Ad_Spend_Cache 조회 키(FY|Month)도 어긋날 수 있다"는 구조적 위험이
 *   발견돼, 사용자 확인 후 FY 귀속도 같은 과반 기준으로 확장** — node 스크립트로
 *   FY25~32 전체 시뮬레이션해 매 FY 첫 주 AUG/마지막 주 JUL 유지 + 인접 FY 사이
 *   공백·중복 0 확인.
 * v1.25.0 (2026-08-06)
 * - 신규 `computeWeeksInMonthCountsForFYRange_()` — `generateCalendarWeeksForFY_()`/
 *   `computeWeeksInMonthCounts_()`를 Start~End FY 여러 해에 걸쳐 합산(사용자
 *   요청 — ACQ_REP S/T/V 컬럼 "On Track" 하이라이트, 30_ACQReport.js 참고).
 * v1.24.1 (2026-08-06)
 * - runRebuildDealTrackerEngine() 추가 — rebuildDealTrackerEngine_()가
 *   "_"로 끝나 Run 드롭다운에 안 뜨는 문제(DealTracker_Engine 최초 구축은
 *   사용자가 편집기에서 직접 Run 해야 함). 안 하면 appendNewDealTrackerRows_()
 *   가 체크포인트 0부터 시작해 Deal Tracker 전체를 신규로 처리하게 됨.
 * v1.24.0 (2026-08-06)
 * - **성능 수정 — readDealTrackerRawRows_()가 외부 스프레드시트를 매번
 *   두 번 열던 버그**: openTargetExternalSheetByGid_() 내부에서 openById()
 *   1번 + 바로 아래 getSpreadsheetTimeZone()용으로 또 openById() 1번,
 *   같은 Deal Tracker를 중복으로 열고 있었음(ACQ_REP Generate 실측 51초
 *   중 상당 부분으로 추정, 사용자 확인). 신규 findSheetByGid_(file, gid)로
 *   gid 탐색 로직을 분리해 openById() 결과를 재사용하도록 수정 —
 *   openTargetExternalSheetByGid_()는 기존 시그니처 그대로 이 헬퍼를 감싸는
 *   래퍼로 유지(다른 호출부 영향 없음).
 * v1.23.0 (2026-07-30)
 * - ACQ_REP/NewP1_REP에 Target 컬럼을 붙이기 위한 공용 조회 함수 신규
 *   (docs/exec-plans/active/2026-07-30-acq-newp1-target-columns.md 참고,
 *   원래 별도 FY_REP으로 설계했던 걸 기존 두 리포트 확장으로 방향 전환).
 *   `readTargetEngineDealShareRows_()`(Block C 조회 — 지금까지 Block D처럼
 *   시트에서 직접 읽는 리더가 없었음) 신규. `computeReportTargetLookupFromInputs_()`
 *   (순수 함수 — Block 0 Revenue Target/Spent × Block C Deal Share × Block D
 *   New P1 Target을 (targetFY|Month|Group) 키로 병합)와 그 IO 래퍼
 *   `computeReportTargetLookup_()` 추가. Revenue Target = 월별 회사 전체
 *   Revenue Target × 세그먼트 Deal Share(코호트1/R1/New 트랙, 위 exec-plan
 *   Decision Log에서 재확인). "타겟 없음"과 "타겟 0"을 구분하기 위해
 *   hasOwnProperty로 조회하도록 설계(90_TargetEngine.js 기존
 *   computeCPNP1RatioByFYMonth_() 관례와 동일) — 소비 측(30_ACQReport.js/
 *   40_NewP1Report.js)에서 반드시 hasOwnProperty 체크 후 사용할 것.
 * v1.22.0 (2026-07-30)
 * - 버그 수정(사용자 리포트: "Seminar Target P1이 0인데 CPNP1 컬럼은 채워져 있다") —
 *   `computeTargetDerivationRows_()`에서 monthlyCPNP1Target이 seasonalityPct(Seminar
 *   비활성 월 게이트)와 무관하게 Block A 벤치마크만 보고 계산돼, New/Pipeline P1
 *   Target이 0으로 강제된 Seminar 비활성 월에도 CPNP1 Target 값이 그대로 남아있던
 *   문제. Seminar이고 seasonalityPct===0(비활성 월)이면 CPNP1 Target도 0으로 통일.
 *   `testComputeTargetDerivationRows()`에 OCT(활성, CPNP1=540 정상 계산)/AUG(비활성,
 *   CPNP1=0) 양쪽 검증 추가(기존엔 AUG CPNP1=450을 "정상"으로 잘못 기대하던 테스트가
 *   이 버그를 그대로 통과시키고 있었음).
 * v1.21.0 (2026-07-30)
 * - Seminar Active Campaign Months를 `CONFIG.TARGET.SEMINAR_CAMPAIGN_MONTHS` 하드코딩에서
 *   Block 0 신규 섹션 5(체크박스, row 32, `INPUT.SEMINAR_ACTIVE_MONTHS`)로 이동 — 사용자
 *   요청: "캠페인 계획이 바뀔 때마다 코드를 고치는 게 아니라 시트에서 체크만 바꾸고 싶다".
 *   `readTargetEngineInputs_()`가 이 체크박스 행을 읽어 `inputs.seminarActiveMonths`
 *   (체크된 달 배열)로 반환, `computeTargetDerivationRows_()`는 이제 CONFIG 대신 이 값을
 *   `computeEvenSeasonalityForMonths_()`에 넘긴다. `setupTargetEngineMonthlyGridDefaults_()`에
 *   체크박스 시딩 로직 신규(최초 실행 시에만 `DEFAULTS.SEMINAR_ACTIVE_MONTHS`로 채움,
 *   `insertCheckboxes()`가 빈 셀을 unchecked로 초기화해버리므로 "비어있는지" 판정은 그 호출
 *   전에 먼저 해야 함 — 함수 WHY 참고). Block 0 grid 배치 읽기(`readTargetEngineInputs_()`)
 *   범위를 `MANUAL_SEGMENT_SPENT` 끝(row 30)에서 `SEMINAR_ACTIVE_MONTHS.ROW`(32)까지 확장.
 *   `testComputeTargetDerivationRows()`의 픽스처에 `inputs.seminarActiveMonths` 추가.
 * v1.20.0 (2026-07-30)
 * - Target CPNP1 벤치마크(Block A) 재활성화 — CONFIG.TARGET.BENCHMARK.CPNP1_FYS/WEIGHTS를
 *   00_Config.js v1.16.0에서 `[]`→`[26]`/`[1]`로 전환하면서, 분자를 죽은 채널시트/Naver
 *   참조 대신 Block 0의 세그먼트별 월별 수동 Spent로 교체. 신규
 *   `buildSpentByGroupFYMonthFromManualInput_()`(순수 함수)가 `inputs.monthlySegmentSpent`를
 *   `computeBenchmarkBlockRows_()`가 기대하는 group->fy->month 형태로 감싸고,
 *   `refreshTargetEngine_()`가 이걸로 `spentByGroupFYMonth`를 만든다. 죽은 코드
 *   `readChannelRawRows_()`/`readNaverRawRows_()`/`computeCombinedSpentByGroupFYMonth_()`
 *   완전 삭제(3그룹 키 "events"/"contact"/"content" 하드코딩이라 5세그먼트 GROUP_ORDER와도
 *   이미 안 맞던 죽은 코드였음). `testComputeBenchmarkBlockRows()` 픽스처/기댓값 갱신
 *   (cpnp1Benchmark가 이제 0이 아니라 실제 계산값이어야 함).
 * - Seminar 전용 월별 배분 예외 신규 — FY27 Seminar는 Oct/Jan/Apr 3회만 개최되고
 *   캠페인은 행사 30일 전 시작이라(사용자 지적), Block A의 과거 실적 기반 시즌성을
 *   그대로 쓰면 비캠페인 월(Aug/Nov 등)에도 New P1 Target이 생겨 비현실적이었음.
 *   신규 `computeEvenSeasonalityForMonths_()`(순수 함수)가 `CONFIG.TARGET.SEMINAR_CAMPAIGN_MONTHS`
 *   (00_Config.js v1.16.0 신규, ["SEP","OCT","DEC","JAN","MAR","APR"])에 균등 분배한
 *   시즌성 맵을 만들고, `computeTargetDerivationRows_()`가 group==="Seminar"일 때만
 *   Block A의 실적 기반 seasonalityPct 대신 이 맵을 써서 월별 New/Pipeline P1 Target을
 *   전개한다(Block A 자체의 시즌성 표시는 참고 지표로 그대로 유지, 건드리지 않음).
 *   Seminar 전용 하드코딩(다른 세그먼트 필요해지면 그때 일반화, 2026-07-30 사용자 확정).
 *   `testComputeTargetDerivationRows()`에 OCT(활성 월)/Webinar(통제군) 케이스 추가.
 * v1.19.0 (2026-07-30)
 * - 세그먼트별 FY26 CPNP1 Benchmark(Block 0 CPNP1_BENCHMARK 섹션)를 수동 입력에서
 *   계산으로 전환 — 세그먼트별 월별 Spent 수동 취합이 완료되면서 사용자가 "월별
 *   Segment Spent 합 ÷ FY26 Segment New P1 합"으로 직접 계산하자고 요청. 신규
 *   computeCPNP1BenchmarkByGroup_()(순수 함수, newP1CountByGroup은
 *   computeTargetLeadsOPSAggregates_()가 이미 만들던 값 재사용)를 refreshTargetEngine_()
 *   에서 호출해 계산 후 writeTargetEngineCPNP1BenchmarkValues_()로 시트에 씀 — 이 섹션은
 *   Block 0의 "절대 안 덮어씀" 원칙의 유일한 예외가 됨(00_Config.js 주석 참고).
 *   readTargetEngineInputs_()는 더 이상 이 섹션을 입력으로 읽지 않음(cpnp1BenchmarkByGroup
 *   필드 제거 — 어차피 아무도 안 쓰고 있었음). CONFIG.TARGET.INPUT.CPNP1_BENCHMARK_MANUAL도
 *   CPNP1_BENCHMARK로 이름 변경(00_Config.js v1.15.0).
 * v1.18.0 (2026-07-30)
 * - refreshTargetEngine_() 끝에서 신규 applyTargetEngineBlockStyles_()
 *   (92_TargetStyles.js) 호출 — Block A~D에 숫자 서식(천단위 콤마, $/%는
 *   소수점 2자리) 적용. 이전 라운드(v1.16.0~v1.17.0)에서 Block 0에만 서식을
 *   넣고 Block A~D는 빠뜨렸던 걸 사용자가 실 시트에서 지적(Seasonality %가
 *   서식 없이 그대로 표시됨).
 * v1.17.0 (2026-07-30)
 * - `buildCombinedWeeklySpentByDateKey_()` 제거 — Actual CPNP1 원천이
 *   91_TargetReport.js의 신규 `computeTargetActualCPNP1ByGroupMonth_()`(Block 0
 *   세그먼트별 월별 수동 Spent 기준)로 교체되며 호출부가 완전히 사라져 orphan
 *   코드가 됨(Backward Compatibility 원칙상 안 쓰는 함수는 완전 삭제).
 *   `setupTargetEngineInputDefaults_()` 끝에서 `applyTargetEngineInputStyles_()`
 *   (92_TargetStyles.js 신규)를 호출해 Block 0 숫자 서식(천단위 콤마, $/%는
 *   소수점 2자리) 적용. `readChannelRawRows_()`/`readNaverRawRows_()`/
 *   `computeCombinedSpentByGroupFYMonth_()`는 CPNP1_FYS 잠정 중단으로 이미
 *   호출이 사실상 no-op(조기 반환)이지만 아직 참조가 남아있어 이번엔 유지 —
 *   완전 삭제는 Phase 1(캠페인 데이터 자동 연동) 방향이 확정된 뒤 별도 결정.
 * v1.16.0 (2026-07-30)
 * - 세그먼트 구조 전면 분해(3그룹 events/contact/content → 5세그먼트 Seminar/
 *   Webinar/BOFU/Search/Content, CONFIG.TARGET.GROUP_ORDER 변경) 대응.
 *   deriveTargetGroup_()/computeBenchmarkBlockRows_()/computeP1ValueBlockRows_()
 *   등 이미 GROUP_ORDER를 동적으로 순회하던 함수는 코드 변경 없음(설정만 반영).
 *   반면 `{events:0,contact:0,content:0}`처럼 3그룹을 리터럴로 하드코딩했던
 *   computeDealShareRatiosFromDealRows_()/computeDealShareRatiosCohort2FromDealRows_()/
 *   computeDealCohortsFromDealRows_()는 GROUP_ORDER 기반 동적 초기화로 수정(그렇지
 *   않으면 새 그룹명에 대해 byGroup[group]이 undefined라 NaN 누적되는 버그 발생).
 *   readTargetEngineInputs_()/setupTargetEngineInputDefaults_()는 개별 named row
 *   (IMPROVEMENT_FACTOR_EVENTS 등)에서 START행+GROUP_ORDER 인덱스 방식으로 전면
 *   재작성, Block 0에 신규 섹션 3개 추가(세그먼트별 FY26 CPNP1 벤치마크 수동입력/
 *   월별 회사 전체 Revenue Target·Budget/세그먼트별 월별 실제 Spent 수동취합) —
 *   신규 setupTargetEngineMonthlyGridDefaults_() 헬퍼. computeDealShareBlockRows_()/
 *   computeTargetDerivationRows_()는 inputs.dealShareEvents 등 named property 대신
 *   inputs.dealShareByGroup/improvementFactorByGroup(동적 객체)을 직접 소비하도록
 *   변경. CONFIG.TARGET.BENCHMARK.CPNP1_FYS를 빈 배열로 전환(채널시트가 3그룹
 *   단위라 5세그먼트 자동 분해 불가)하면서 computeCombinedSpentByGroupFYMonth_()에
 *   조기 반환 추가(불필요한 외부 스프레드시트 호출 방지), computeCPNP1RatioByFYMonth_()는
 *   "지출 데이터 없음"과 "지출 0원"을 구분 못 하던 기존 버그를 hasOwnProperty
 *   체크로 수정. testComputeDealShareRatiosCohort2FromDealRows()가 존재하지도
 *   않는 `contentCategory` 필드를 픽스처로 쓰고 있어(2026-07-28 Segment 컬럼
 *   전환 이후 방치된 버그, 실질적으로 항상 unclassified라 우연히 통과하던 상태)
 *   `businessSegment`로 교정. 그 외 3그룹을 픽스처로 쓰던 테스트 전부(testDeriveTargetGroup/
 *   testClassifyDealSegment/testComputeDealShareRatiosFromDealRows/
 *   testComputeDealCohortsFromDealRows/testComputeBenchmarkBlockRows/
 *   testComputeP1ValueBlockRows/testComputeDealShareBlockRows/
 *   testComputeTargetDerivationRows)를 5세그먼트 실제 이름으로 갱신. **Report/Styles
 *   레이어(91_TargetReport.js/92_TargetStyles.js, 그룹당 컬럼 반복 구조)는 이번
 *   라운드에서 미변경 — 다음 단계 필요, 상세: docs/exec-plans/active/
 *   2026-07-30-target-rep-segment-breakdown.md
 * v1.15.0 (2026-07-29)
 * - 별도 git worktree(worktree-clever-seeking-dolphin)에 있던 New/Pipeline
 *   2트랙 Block C/D 확장 작업(2026-07-27, 아래 병합된 v1.13.0/v1.12.2/
 *   v1.12.0 항목)을 main에 merge — 세션 도중 main에서 반복한 clasp push가
 *   이 worktree가 라이브 스크립트에 배포해뒀던 버전을 덮어써 Target_REP의
 *   New/Pipeline P1 컬럼이 0으로 보이는 사고 발생, 원인 파악 후 복구
 *   (CLAUDE.md 미기록, 사용자 확인 후 진행). 병합 시 분류 로직 충돌 —
 *   worktree는 classifyDealSegment_()가 Deal Tracker "Content Category"
 *   컬럼(H열)을 CONTENT_CATEGORY_GROUP_MAP으로 매핑했으나, 그 이후(v1.12.0,
 *   2026-07-28) 이 접근이 실측 검증에서 신뢰 불가 수준(Search $144,265 vs
 *   실제 ~$537,507.89)으로 폐기되고 사용자가 그 컬럼을 "Segment"로 개명해
 *   전체 딜을 직접 수동 재분류하는 방식으로 전환된 상태 — **분류 로직은
 *   이 최신(Segment 컬럼 직접 참조, deriveTargetGroup_()) 쪽으로 통일**,
 *   worktree의 CONTENT_CATEGORY_GROUP_MAP 방식은 폐기. New/Pipeline 2트랙
 *   Block C/D 계산 로직(computeDealShareRatiosCohort2FromDealRows_/
 *   computeNewPipelineRevenueSplit_/computeDealShareBlockRows_/
 *   computeTargetDerivationRows_ 12컬럼 확장)은 worktree 버전 그대로 채택 —
 *   classifyDealSegment_()를 그대로 호출만 하므로 분류 방식 교체와 무관하게
 *   정상 동작.
 * v1.14.0 (2026-07-28)
 * - readDealTrackerRawRows_()가 이제 정규화된 createdDate(Date, 타임존 보정
 *   완료)도 반환(additive) — NewP1_REP의 Won/Revenue를 Deal Tracker Created
 *   Date 기준으로 재정의하기 위해 필요(40_NewP1Report.js
 *   computeNewP1DealWonRevenueFromRows_() 참고). 기존 소비자(Target_REP)는
 *   새 필드를 그냥 무시하므로 하위호환.
 * v1.13.0 (2026-07-28)
 * - Fixed: Deal Tracker Close Date/Created Date 타임존 버그 — 이 스크립트
 *   프로젝트 타임존(appsscript.json: America/New_York)과 Deal Tracker
 *   스프레드시트 자체 타임존(KOR 딜 트래커, 다른 지역)이 달라, 매달 1일
 *   Close된 딜이 getMonth() 계산 시 전월로 밀려 잘못 집계되던 문제(실측:
 *   "Minu Kang" $54,891.44 Referral 딜, Close Date 2026-07-01이 스크립트에서
 *   "Jun 30 2026 11:00 EDT"로 읽혀 6월로 잘못 집계됨). 신규
 *   normalizeExternalCalendarDate_()가 Deal Tracker의 getSpreadsheetTimeZone()
 *   기준으로 실제 연/월/일을 추출해 스크립트 로컬 타임존 Date로 재구성 —
 *   readDealTrackerRawRows_()가 closeDate/createdDate 둘 다에 적용. 상세:
 *   docs/Changelog.md 2026-07-28.
 * v1.12.0 (2026-07-28)
 * - Segment 분류를 getBusinessSegment() 키워드 매칭에서 Deal Tracker의 수동
 *   "Segment" 컬럼(H열, CONFIG.TARGET.EXTERNAL.DEAL_TRACKER.COLUMNS.SEGMENT)
 *   직접 참조로 교체 — 실측 검증 결과 키워드 매칭 정확도가 신뢰 불가 수준
 *   (Search $144,265 vs 실제 ~$537,507.89, 약 $393K 갭)이라 사용자가 Deal
 *   Tracker 전체 딜을 수동 재분류. readDealTrackerRawRows_()가 이제
 *   businessSegment 필드도 반환, classifyDealSegment_()는 getBusinessSegment()
 *   호출 없이 deriveTargetGroup_(row.businessSegment)만 수행하도록 단순화.
 *   관련 테스트(testClassifyDealSegment/testComputeDealShareRatiosFromDealRows/
 *   testComputeDealCohortsFromDealRows) mock 데이터도 businessSegment 필드
 *   기준으로 갱신. 상세: docs/Changelog.md 2026-07-28.
 * v1.11.0 (2026-07-28)
 * - 2트랙 아키텍처(CLAUDE.md #7) 확장 — Deal Tracker 접근 계층을 Target_REP
 *   전용에서 프로젝트 공용으로 확장. readDealTrackerRawRows_()에 closeDate
 *   (raw Date) 필드 추가(additive, 기존 Target_REP 소비 함수 영향 없음) —
 *   ACQ_REP Revenue의 월 귀속에 필요. 신규 computeDealTrackerCountsByKey_()
 *   (순수 함수) 추가 — Events_OPS/BOFU_OPS/Content_OPS가 각자 스캔하던
 *   Leads_OPS Opportunity Won Date/Revenue 로직을 대체할 공용 헬퍼(도메인별
 *   키 정규화 함수를 주입받아 Deal Tracker 프로그램명 기준으로 #Deals/Revenue
 *   집계). 상세: docs/Changelog.md 2026-07-28.
 * v1.13.0-worktree (2026-07-27, worktree-clever-seeking-dolphin에서 병합)
 * - computeTargetDerivationRows_()(Block D)가 New/Pipeline FY 목표를 합쳐서
 *   전개하던 걸 각각 전개하도록 변경(사용자 요청: Target_REP에서 New P1
 *   Target/Pipeline P1 Target을 분리해서 보고 싶다). 월/주 캐시가 New/Pipeline
 *   각각 생기고, weeklyP1Target(합계)은 둘을 더한 값으로 계속 유지(달성% 분모).
 *   두 트랙 모두 같은 시즌성 %를 재사용(트랙별 다른 시즌성 커브는 미정).
 *   buildTargetDerivationHeaders_/targetDerivationRowsToMatrix_/
 *   readTargetEngineDerivationRows_ 전부 8→12컬럼으로 갱신
 *   (CONFIG.TARGET.ENGINE.BLOCK_D_COLUMNS).
 * v1.12.2-worktree (2026-07-27, worktree-clever-seeking-dolphin에서 병합)
 * - refreshTargetEngine_()의 wide-clear를 clearContent()→clear()로 변경 —
 *   사용자 실측 확인: 예전 Block D 위치(X·Y열, Week Start/Week End Date 서식)에
 *   새 Block C의 FY New/Pipeline P1 Target이 겹치면서 남아있던 Date 서식 때문에
 *   숫자값이 "12/30/1899"류 날짜로 잘못 표시되는 버그 발견 → clear()로 값+서식
 *   모두 제거하도록 수정.
 * v1.12.0-worktree (2026-07-27, worktree-clever-seeking-dolphin에서 병합)
 * - FY P1 목표 공식을 New/Pipeline 2트랙 분리로 전면 교체 — CLAUDE.md #7
 *   최종 결정(a/b 블렌딩 방식 미정 상태 해소). 신규
 *   computeDealShareRatiosCohort2FromDealRows_()(코호트2/R2 기준 그룹 비중,
 *   Pipeline 트랙 전용 — 코호트1 딜비중 재사용 시 contact에 과도 배분되는
 *   문제 발견돼 분리), computeNewPipelineRevenueSplit_()(전체 Revenue 타겟을
 *   코호트1/2 비중으로 New/Pipeline 두 트랙 금액으로 분리). 3FY 평균/median
 *   없이 FY26(P1_VALUE_FY) 단일 스냅샷만 사용(사용자 확정: 이전 FY는 본사
 *   관리 체제라 노이즈).
 *   computeDealShareBlockRows_()(Block C)가 이제 dealShare/pipelineShare/
 *   newP1Target/pipelineP1Target/totalP1Target을 전부 계산 — 시그니처 확장
 *   (pipelineShareRatios/p1ValueByGroup/newPipelineSplit 파라미터 추가).
 *   computeTargetDerivationRows_()(Block D)는 이제 dealShareRows.totalP1Target
 *   을 그대로 읽어 월/주 전개만 담당 — p1ValueRows 파라미터 제거(더 이상
 *   필요 없음), a만 쓰던 placeholder 로직 삭제.
 *   Block C가 2컬럼→6컬럼으로 확장되며 Block D 시작 컬럼이 뒤로 밀림
 *   (CONFIG.TARGET.ENGINE, X열→AB열) — refreshTargetEngine_()에 Block A~D
 *   전체 wide-clear 추가(예전 Block D 위치 잔재 방지, 향후 블록 구조 변경에도
 *   안전하도록 일반화). ⚠️ 이 시점의 classifyDealSegment_()는 "Content
 *   Category" 컬럼 직접 매핑 방식이었으나, v1.15.0 병합 시 Segment 컬럼
 *   직접 참조 방식(v1.12.0, 2026-07-28)으로 교체됨 — 위 v1.15.0 항목 참고.
 * v1.10.0 (2026-07-27)
 * - P1당 가치(Block B)를 코호트1/2 이원화 구조로 전면 재작성 — 사용자 확정
 *   프레임워크: CurrentFYP1V(a) = 코호트1(Created=Closed=타겟FY) Revenue ÷
 *   이번 FY New P1 수, PrevP1V(b) = 코호트2(Closed=타겟FY, Created<타겟FY)
 *   Revenue ÷ (all-time 총 P1 수 − 이번 FY New P1 수). readDealTrackerRawRows_()
 *   가 이제 Close/Created Date(진짜 Date 셀 — 텍스트 파싱 불필요 확인됨)에서
 *   closeFY/createdFY를 직접 파생(구 텍스트 FY 컬럼 fy 필드 제거).
 *   computeDealCohortsFromDealRows_() 신규 — 그룹별 코호트1/2 Revenue를 한 번에
 *   계산. computeDealShareRatiosFromDealRows_()는 코호트1(Created=Closed=
 *   타겟FY)만 사용하도록 필터 조건 보강(기존엔 Close FY만 봤음).
 *   computeTargetLeadsOPSAggregates_()가 이제 newP1CountByGroup(이번 FY 신규
 *   P1 수)과 totalP1CountByGroup(all-time 총 P1 수)를 반환(구 p1ValueByGroup/
 *   revenueSum 제거 — Revenue는 이제 Deal Tracker 코호트에서 옴).
 *   computeTargetDerivationRows_()는 a/b 블렌딩 방식이 아직 미정(사용자가 두
 *   값을 Block B에서 직접 검토 후 결정 예정)이라 임시로 a(CurrentFYP1V)만
 *   사용. Block B 헤더/매트릭스 7컬럼으로 확장(00_Config.js
 *   CONFIG.TARGET.ENGINE.BLOCK_B_COLUMNS 4→7, Block C/D 컬럼 위치 shift).
 *   93_TempQA_DealTrackerMatch.js도 신규 closeFY/createdFY 필드에 맞춰 갱신.
 * v1.9.0 (2026-07-27)
 * - computeDealShareRatiosFromDealRows_()를 3FY(24·25·26) median에서 FY26
 *   단일 코호트(CONFIG.TARGET.P1_VALUE_FY 재사용)로 변경 — 사용자 확정:
 *   median이 최근 연도 실제 구성비와 10%p 이상 괴리(실측: contact 20.9%
 *   median vs 31.3% FY26 단독). 딜 비중도 P1당 가치와 동일하게 FY26 코호트
 *   기준으로 통일.
 * v1.8.0 (2026-07-27)
 * - Deal Tracker 매칭 아키텍처 전면 폐기 및 교체. Sales팀 확인: 상담 종료 후
 *   학부모 요청으로 Lead/Opportunity 이메일이 Salesforce에서 덮어써져 원본
 *   마케팅 터치 이메일이 시스템적으로 복구 불가능한 경우가 있음 — Student/
 *   Guardian Email/Account Name 매칭이 계속 실패하던 근본 원인으로 확인됨.
 *   matchDealToGroup_()/computeTargetLeadsOPSAggregates_()의 emailToGroupMap/
 *   nameToGroupsMap 전부 제거. 대신 classifyDealSegment_() 신규 — Deal Tracker
 *   자체의 Lead Source/Source Category/Lead Source Detail로 getBusinessSegment()
 *   를 직접 호출해 Leads_OPS 조회 없이 세그먼트 분류(Deal Tracker를 Source of
 *   Truth로 전환). P1 판정 제거(사용자 확인: 딜의 99%가 이미 P1). Deal Tracker
 *   원래 시트(gid 498663095, CONFIG.TARGET.EXTERNAL.DEAL_TRACKER, 00_Config.js)
 *   로 복귀 — 새 컬럼 구조(FY 텍스트 컬럼 직접 사용, Close/Created Date는
 *   향후 코호트1/2 분리용으로 보존만). readDealTrackerRawRows_()/
 *   computeDealShareRatiosFromDealRows_()/computeDealShareFromTracker_() 전부
 *   갱신. 93_TempQA_DealTrackerMatch.js도 분류 실패 기반으로 재작성. 상세는
 *   CLAUDE.md #7.
 * v1.7.0 (2026-07-27)
 * - matchDealToGroup_()에 4차 "고스트" 분류 추가 — Student/Guardian Email/
 *   Account Name 전부 실패한 딜을 Leads_OPS 매칭 없이 딜 자체의 UTM Campaign/
 *   First Touch Detail/Lead Source/Lead Source Category로 getBusinessSegment()
 *   (16_TransformHelper.js, 프로젝트 공용 분류 로직) 직접 호출해 분류(사용자
 *   제안 — content Target P1이 여전히 비정상적으로 높아 조사하던 중 나옴).
 *   readDealTrackerRawRows_()가 3개 필드 추가로 읽도록 확장, CONFIG.TARGET.
 *   EXTERNAL.DEAL_TRACKER.COLUMNS에 MKT_UTM_CAMPAIGN/FIRST_TOUCH_DETAIL/
 *   LEAD_SOURCE_CATEGORY 추가(00_Config.js).
 * v1.6.0 (2026-07-27)
 * - matchDealEmailToGroup_() → matchDealToGroup_()로 확장 — Student/Guardian
 *   Email 둘 다 실패할 때(Lead Merge로 원본 이메일 자체가 소실된 실측 케이스
 *   발견) Account Name을 3차 후보로 시도. 동명이인 안전장치: 같은 Account
 *   Name이 Leads_OPS에서 서로 다른 그룹에 걸쳐 등장하면 매칭 포기(잘못된
 *   그룹 배분 방지). computeTargetLeadsOPSAggregates_()가 nameToGroupsMap도
 *   함께 반환하도록 확장. CONFIG.TARGET.EXTERNAL.DEAL_TRACKER.COLUMNS에
 *   ACCOUNT_NAME 추가(00_Config.js). 93_TempQA_DealTrackerMatch.js도 갱신.
 * v1.5.0 (2026-07-27)
 * - 딜트래커 시트 전면 재구축(신규 스프레드시트, FY24~26)에 맞춰 읽기/매칭
 *   로직 갱신: FY 컬럼이 없어져 Close Date(Plain Text, DD/MM/YYYY)에서
 *   parseDMY()(16_TransformHelper.js)로 직접 파생하는 parseDealTrackerCloseDate_()
 *   신규. sourceEmail/oppEmail → studentEmail/guardianEmail로 필드명 정정
 *   (matchDealEmailToGroup_(), computeDealShareRatiosFromDealRows_() 등) —
 *   근본 원인이 "Source/Opp"가 아니라 Salesforce Opportunity의 Student
 *   Contact/Primary Guardian 두 컨택트였음이 규명됨(CLAUDE.md #7 참고).
 *   Stage 필터(WON_STAGE) 추가, Lead Source 대소문자 무시 비교로 변경(실측:
 *   "Upsell"/"UpSell" 표기 혼용). 93_TempQA_DealTrackerMatch.js도 동일하게 갱신.
 * v1.4.0 (2026-07-27)
 * - matchDealEmailToGroup_() 신규 — Deal Tracker Source email이 Leads_OPS와
 *   매칭 안 될 때 Opp Email을 2차 후보로 시도. 사용자가 딜트래커에 "Opp
 *   Email"/"Revenue KRW" 컬럼을 추가(Revenue (NZD)는 A1 환율 기준 수식값으로
 *   전환)하며 컬럼 위치 전체 이동 — CONFIG.TARGET.EXTERNAL.DEAL_TRACKER.COLUMNS
 *   갱신(00_Config.js), readDealTrackerRawRows_()가 oppEmail도 읽도록 확장.
 *   실측 근거: June Chang/Philip Ahn 둘 다 Source email(마케팅 퍼스트터치
 *   이메일)이 Leads_OPS와 매칭 안 됐지만, Opportunity 소속 Account의 이메일
 *   로는 매칭 성공 — 구조적으로 반복되는 패턴으로 확인됨.
 * v1.3.0 (2026-07-27)
 * - Block C(딜 비중) 실데이터 연동. CONFIG.TARGET.EXTERNAL.DEAL_TRACKER 추가,
 *   readDealTrackerRawRows_()/computeDealShareRatiosFromDealRows_()/
 *   computeDealShareFromTracker_() 신규 — Deal Tracker(FY24·25·26)에서
 *   Upsell/Referral을 제외한 조정 베이스 대비 그룹별 Revenue 비중을 구하고
 *   3FY median을 취한다. Source email로 Leads_OPS Business Segment를 매칭
 *   (computeTargetLeadsOPSAggregates_()가 emailToGroupMap도 함께 반환하도록
 *   확장 — 기존 P1 전용 필터를 email 매핑 전 단계로 이동). Deal Tracker
 *   접근 실패 시 Input 블록 수동값으로 Fallback(computeDealShareBlockRows_()).
 *   기존 균등 분할(33%씩) placeholder를 실제 데이터로 대체 — 사용자 요청.
 * - openTargetExternalSheetByGid_()가 spreadsheetId를 인자로 받도록 일반화
 *   (채널시트/Naver와 Deal Tracker가 서로 다른 파일이라).
 * v1.2.0 (2026-07-27)
 * - generateCalendarWeeksForFY_()에 resolveTargetFYCalendarYear_() 추가 —
 *   `new Date(targetFY - 1, 7, 1)`이 2자리 FY(예: 26)를 JS Date의 "0~99는
 *   1900년대" 특수 규칙에 걸려 1926년으로 해석하던 실측 버그 수정(Week
 *   Start/End가 "1926-08-02"처럼 나오고, 요일 정렬도 틀어져 월요일이어야
 *   할 첫 주가 일요일(8/2)로 시작하는 것처럼 보였음 — 둘 다 같은 원인).
 * - targetDerivationRowsToMatrix_()의 Month 컬럼에서 "FY27 " 접두사 제거,
 *   월 라벨만 저장(예: "AUG") — 사용자 요청.
 * v1.1.0 (2026-07-27)
 * - setupTargetReport() 최초 실행 중 "Service Spreadsheets timed out" 실측 —
 *   readTargetEngineInputs_()/setupTargetEngineInputDefaults_()가 Block 0
 *   9개 행을 셀 단위로 개별 getValue()/setValue()(최대 27회 왕복) 하던 것을
 *   컬럼 전체 getValues()/setValues() 배치 호출(1회 읽기 + 2회 쓰기)로 교체.
 * v1.0.0 (2026-07-27)
 * - 최초 구현 (docs/TargetReportDesign.md 설계 그대로).
 * ==========================================================
 */


/**
 * ==========================================================
 * Derive Target Segment Group (Business Segment → events/contact/content)
 *
 * WHY
 * 리포트 축은 Business Segment 7개가 아니라 3개 그룹(CONFIG.TARGET.
 * SEGMENT_GROUPS)이다. Referral/Other 등 그룹에 없는 세그먼트는 목표
 * 배분 대상이 아니므로 null을 반환해 자동 제외한다 (docs/TargetReportDesign.md §2).
 *
 * @param {string} businessSegment
 * @return {string|null}  "events"|"contact"|"content"|null
 *
 * TEST
 * deriveTargetGroup_("Webinar") === "events"
 * deriveTargetGroup_("Search") === "contact"
 * deriveTargetGroup_("Referral") === null
 * ==========================================================
 */
function deriveTargetGroup_(businessSegment){

  const segment = String(businessSegment || "").trim();
  const groups = CONFIG.TARGET.SEGMENT_GROUPS;
  const groupNames = Object.keys(groups);

  for(let i = 0; i < groupNames.length; i++){

    if(groups[groupNames[i]].indexOf(segment) !== -1) return groupNames[i];

  }

  return null;

}


/**
 * ==========================================================
 * TEST — deriveTargetGroup_()
 * ==========================================================
 */
function testDeriveTargetGroup(){

  // 2026-07-30 세그먼트 분해 — 그룹명이 세그먼트명 그대로(1:1 매핑)로 변경.
  const cases = [
    ["Webinar", "Webinar"],
    ["Seminar", "Seminar"],
    ["BOFU", "BOFU"],
    ["Search", "Search"],
    ["Content", "Content"],
    ["Referral", null],
    ["Other", null],
    ["", null]
  ];

  let pass = true;

  cases.forEach(function(c){

    const result = deriveTargetGroup_(c[0]);
    const ok = result === c[1];

    if(!ok) pass = false;

    Logger.log(c[0] + " => " + result + " (expected " + c[1] + ") " + (ok ? "✅" : "❌"));

  });

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Get Monday of Week (ISO 주, 월요일 시작)
 *
 * WHY
 * 주 = 월요일~일요일 고정(docs/TargetReportDesign.md §4, 변경 불가 제약).
 * 임의 날짜가 속한 주의 월요일을 시각(시분초) 없이 반환한다.
 *
 * @param {Date} date
 * @return {Date}
 *
 * TEST
 * getMondayOfWeek_(new Date(2026,6,30)) === 2026-07-27 (목요일 → 그 주 월요일)
 * getMondayOfWeek_(new Date(2026,7,2))  === 2026-07-27 (일요일 → 그 주 월요일)
 * ==========================================================
 */
function getMondayOfWeek_(date){

  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0=Sun .. 6=Sat
  const diff = (day === 0 ? -6 : 1) - day;

  d.setDate(d.getDate() + diff);

  return d;

}


/**
 * ==========================================================
 * TEST — getMondayOfWeek_()
 * ==========================================================
 */
function testGetMondayOfWeek(){

  const thursday = getMondayOfWeek_(new Date(2026, 6, 30)); // 2026-07-30 Thu
  const sunday = getMondayOfWeek_(new Date(2026, 7, 2));    // 2026-08-02 Sun
  const monday = getMondayOfWeek_(new Date(2026, 6, 27));   // 2026-07-27 Mon (자기 자신)

  const expected = new Date(2026, 6, 27);

  const pass =
    thursday.getTime() === expected.getTime() &&
    sunday.getTime() === expected.getTime() &&
    monday.getTime() === expected.getTime();

  Logger.log("Thu => " + thursday + " / Sun => " + sunday + " / Mon => " + monday);
  Logger.log("Expected all => " + expected);
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Add Days To Date (시각 없이 날짜만 이동)
 * ==========================================================
 */
function addDaysToDate_(date, days){

  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);

  return d;

}


/**
 * ==========================================================
 * Get Week Majority Date (그 주(월~일)에서 과반을 차지하는 날 — 대표일)
 *
 * WHY
 * 한 주(7일)는 최대 한 번만 월 경계를 넘을 수 있으므로, 과반(4일 이상)을
 * 차지하는 쪽은 항상 그 주의 목요일(월요일+3일)이 속한 쪽과 일치한다(7일이
 * 어느 비율로 나뉘어도 — 1/6, 2/5, 3/4 — 목요일은 항상 더 큰 쪽에 있음).
 * 이 "대표일"을 getFiscalYear()/getFiscalMonthLabel()에 그대로 넘기면 그
 * 주의 FY/월 귀속을 둘 다 과반 기준으로 일관되게 구할 수 있다 —
 * getWeekFiscalYear_()/getWeekMonthLabel_()이 이 함수를 공유한다(단일 소스,
 * 계산이 어긋나면 안 됨).
 *
 * @param {Date} monday  그 주의 월요일(시각 없음)
 * @return {Date}
 * ==========================================================
 */
function getWeekMajorityDate_(monday){

  return addDaysToDate_(monday, 3);

}


/**
 * ==========================================================
 * Get Week Fiscal Year (그 주(월~일)가 귀속되는 FY — 일수 과반 기준)
 *
 * WHY
 * getWeekMonthLabel_()과 동일한 이유(주석 참고) — 기존엔 그 주 월요일의
 * 달력월로 FY를 정했는데, 이러면 월 귀속(과반 기준)과 FY 귀속(월요일 기준)이
 * 서로 다른 기준을 쓰게 돼, 아주 드물게(Aug 1이 화~목요일에 걸리는 해)
 * "그 FY의 마지막 주인데 과반 기준 월은 다음 FY 시작월(AUG)" 같은 어긋난
 * 상태가 생길 수 있음이 발견됨(2026-08-07, node 스크립트로 FY25~32
 * 시뮬레이션해 확인 — FY26/27은 이 경계에 안 걸려 지금까지 드러나지 않았음).
 * FY/월 귀속을 둘 다 같은 과반 기준(대표일)으로 통일하면 이런 어긋남 자체가
 * 구조적으로 발생하지 않는다(FY25~32 전체 시뮬레이션 — 매 FY 첫 주 AUG/
 * 마지막 주 JUL 유지, 인접 FY 사이 공백·중복 0 확인).
 *
 * @param {Date} monday  그 주의 월요일(시각 없음)
 * @return {number}  예: 27 (FY27)
 *
 * TEST
 * getWeekFiscalYear_(new Date(2028,6,31)) === 29 (FY29 첫 주 — 대표일 8/3/2028)
 * ==========================================================
 */
function getWeekFiscalYear_(monday){

  return Number(getFiscalYear(getWeekMajorityDate_(monday)).replace("FY", ""));

}


/**
 * ==========================================================
 * Get Week Month Label (그 주(월~일)의 대표 월 — 일수 과반 기준)
 *
 * WHY
 * 기존엔 그 주의 월요일이 속한 달력월을 그대로 그 주의 "월"로 썼는데, 월
 * 경계에 걸친 주(예: 2026-08-31(월)~09-06(일))는 월요일 하루만 8월이고
 * 나머지 6일이 9월인데도 "AUG"로 분류되는 문제가 있었음(사용자 리포트,
 * 2026-08-07 — Target_REP의 Actual/Target CPNP1이 월 단위 값을 그 달 모든
 * 주에 반복 표시하는 구조라, 이 오분류가 그대로 "9월이 아직 시작도 안 했는데
 * 8월 실적/목표가 표시"되는 결과로 이어짐). getWeekMajorityDate_() WHY 참고
 * — 이 함수를 월요일 기반 getFiscalMonthLabel() 대신 써서, 그 주를 "월"로
 * 분류하는 모든 지점(Target Engine의 주간 목표 계산 + Target_REP의 Actual
 * CPNP1 집계)이 항상 같은 과반 규칙을 쓰도록 통일한다.
 *
 * @param {Date} monday  그 주의 월요일(시각 없음)
 * @return {string}  getFiscalMonthLabel()과 동일한 3글자 라벨(예: "SEP")
 *
 * TEST
 * getWeekMonthLabel_(new Date(2026,7,31)) === "SEP" (8/31(월)~9/6(일), 9월 6일 과반)
 * getWeekMonthLabel_(new Date(2026,7,3))  === "AUG" (8/3(월)~8/9(일), 전부 8월)
 * ==========================================================
 */
function getWeekMonthLabel_(monday){

  return getFiscalMonthLabel(getWeekMajorityDate_(monday));

}


/**
 * ==========================================================
 * TEST — getWeekMonthLabel_() / getWeekFiscalYear_()
 * ==========================================================
 */
function testGetWeekMonthLabel(){

  const augustBoundaryWeek = getWeekMonthLabel_(new Date(2026, 7, 31)); // 8/31~9/6
  const midMonthWeek = getWeekMonthLabel_(new Date(2026, 7, 3));        // 8/3~8/9
  const fyBoundaryWeek = getWeekFiscalYear_(new Date(2028, 6, 31));     // FY29 첫 주(대표일 8/3/2028)

  const pass =
    augustBoundaryWeek === "SEP" &&
    midMonthWeek === "AUG" &&
    fyBoundaryWeek === 29;

  Logger.log("8/31(월)~9/6(일) => " + augustBoundaryWeek + " (expected SEP)");
  Logger.log("8/3(월)~8/9(일) => " + midMonthWeek + " (expected AUG)");
  Logger.log("2028-07-31(월)~08-06(일) FY => " + fyBoundaryWeek + " (expected 29)");
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Resolve Target FY To Calendar Year (2자리 FY → 실제 4자리 연도)
 *
 * WHY
 * JavaScript `Date` 생성자는 연도 인자가 0~99 사이면 자동으로 1900년대로
 * 해석한다(예: `new Date(26, 7, 1)` → 1926-08-01). CONFIG.TARGET의 FY 값은
 * 전부 2자리(27, 26 등)라 이 함정에 그대로 걸림 — 실측: generateCalendarWeeksForFY_()가
 * 1926년 날짜를 생성해 요일 정렬 자체가 틀어짐(2026-08-03 월요일이어야 할 게
 * 다른 요일로 나옴). 이 프로젝트의 FY는 전부 20XX년대이므로 2000을 더해 보정한다.
 *
 * TEST
 * resolveTargetFYCalendarYear_(26) === 2026
 * resolveTargetFYCalendarYear_(2026) === 2026 (이미 4자리면 그대로)
 * ==========================================================
 */
function resolveTargetFYCalendarYear_(fy){

  return fy < 100 ? 2000 + fy : fy;

}


/**
 * ==========================================================
 * TEST — resolveTargetFYCalendarYear_()
 * ==========================================================
 */
function testResolveTargetFYCalendarYear(){

  const a = resolveTargetFYCalendarYear_(26);
  const b = resolveTargetFYCalendarYear_(2026);

  const pass = a === 2026 && b === 2026;

  Logger.log("26 => " + a + " (expected 2026)");
  Logger.log("2026 => " + b + " (expected 2026)");
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Generate Calendar Weeks For Fiscal Year (월~일 주 전체 나열)
 *
 * WHY
 * Target_REP 리포트 영역 = 대상 FY의 월~일 주 전체(52~53행). 각 주의 FY/월
 * 귀속 둘 다 **2026-08-07부터 그 주 7일 중 과반을 차지하는 대표일 기준**
 * (`getWeekFiscalYear_()`/`getWeekMonthLabel_()`, 둘 다 `getWeekMajorityDate_()`
 * 공유) — 원래는 둘 다 월요일 기준이었으나(docs/TargetReportDesign.md §4에
 * 그렇게 기록돼 있었음), 월 경계에 걸친 주(예: 2026-08-31(월)~09-06(일))가
 * 월요일 하루만 속한 8월로 잘못 분류돼 Target/Actual CPNP1(월 단위 값을
 * 그 달 모든 주에 반복 표시하는 구조)이 실제로는 9월인 주에 8월 값으로
 * 표시되는 문제가 사용자 리포트로 발견됨. **FY 귀속도 월요일이 아니라 같은
 * 과반 기준으로 통일**(2026-08-07, 처음엔 월만 고치고 FY는 월요일 기준으로
 * 남겨뒀으나, 그러면 아주 드물게(Aug 1이 화~목요일에 걸리는 해) 그 FY의
 * 마지막 주가 과반 기준 월로는 "AUG"인데 FY는 그대로 그 해(월요일 기준)에
 * 남아 한 리포트 안에 AUG가 두 번 나오고 Ad_Spend_Cache 조회 키(FY|Month)도
 * 어긋나는 문제가 있어, 사용자 확인 후 FY까지 과반 기준으로 확장) —
 * getWeekFiscalYear_() WHY 참고, node 스크립트로 FY25~32 전체 시뮬레이션해
 * 매 FY 첫 주 AUG/마지막 주 JUL 유지 + 인접 FY 사이 공백·중복 0 확인.
 *
 * @param {number} targetFY  예: 27 (FY27 = 2026-08-01 ~ 2027-07-31)
 * @return {Array<{weekStart:Date, weekEnd:Date, fy:number, month:string}>}
 *
 * TEST
 * generateCalendarWeeksForFY_(27).length === 52 or 53
 * 첫 주 month === "AUG", 마지막 주 month === "JUL", weekStart 요일 === 월요일
 * ==========================================================
 */
function generateCalendarWeeksForFY_(targetFY){

  const fyStart = new Date(resolveTargetFYCalendarYear_(targetFY - 1), 7, 1); // Aug 1

  let monday = getMondayOfWeek_(fyStart);

  const weeks = [];
  let safety = 0;

  while(safety < 60){

    safety++;

    const fy = getWeekFiscalYear_(monday);

    if(fy > targetFY) break;

    if(fy === targetFY){

      weeks.push({
        weekStart: monday,
        weekEnd: addDaysToDate_(monday, 6),
        fy: fy,
        month: getWeekMonthLabel_(monday)
      });

    }

    monday = addDaysToDate_(monday, 7);

  }

  return weeks;

}


/**
 * ==========================================================
 * TEST — generateCalendarWeeksForFY_()
 * ==========================================================
 */
function testGenerateCalendarWeeksForFY(){

  const weeks = generateCalendarWeeksForFY_(27);

  const pass =
    (weeks.length === 52 || weeks.length === 53) &&
    weeks[0].month === "AUG" &&
    weeks[0].fy === 27 &&
    weeks[0].weekStart.getDay() === 1 && // 월요일
    weeks[0].weekStart.getFullYear() === 2026 && // 1926년 함정 재발 방지
    weeks[weeks.length - 1].month === "JUL" &&
    weeks[weeks.length - 1].fy === 27;

  Logger.log("Week count: " + weeks.length + " (expected 52 or 53)");
  Logger.log("First: " + weeks[0].weekStart + " => " + weeks[0].fy + " " + weeks[0].month + " (expected 27 AUG)");
  Logger.log(
    "Last: " + weeks[weeks.length - 1].weekStart + " => " +
    weeks[weeks.length - 1].fy + " " + weeks[weeks.length - 1].month + " (expected 27 JUL)"
  );
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Weeks-In-Month Counts (그 달의 주 수 = 월요일 개수)
 *
 * WHY
 * 월 목표 ÷ 그 달의 실제 주 수 = 주 목표 (docs/TargetReportDesign.md §4/§6).
 * 항상 4 또는 5이며, FY/Month 별로 실제 생성된 캘린더에서 집계해야
 * 정확하다(일반화된 "보통 4~5개" 가정이 아니라 실측).
 *
 * @param {Array<{fy:number, month:string}>} weeks
 * @return {Object}  key "fy|month" -> count
 *
 * TEST
 * 2026-08(FY27 AUG)은 월요일이 8/3·10·17·24·31로 5회 → count === 5
 * ==========================================================
 */
function computeWeeksInMonthCounts_(weeks){

  const counts = {};

  weeks.forEach(function(week){

    const key = week.fy + "|" + week.month;
    counts[key] = (counts[key] || 0) + 1;

  });

  return counts;

}


/**
 * ==========================================================
 * Compute Weeks In Month Counts For FY Range (2026-08-06 추가)
 *
 * WHY
 * ACQ_REP Generate는 Start FY~End FY 여러 FY에 걸쳐 리포트를 생성할 수
 * 있어(generateCalendarWeeksForFY_()는 FY 하나만 처리), Start~End 구간의
 * 모든 FY를 순회하며 computeWeeksInMonthCounts_() 결과를 하나로 합친다
 * (30_ACQReport.js "On Track" 하이라이트 — Revenue/New P1 Target을 그
 * 달의 주 수로 나눈 주간 페이스 기준).
 *
 * INPUT
 * startFY, endFY : number  (2자리, 예: 26)
 *
 * OUTPUT
 * { "fy|MONTH": weeksCount }
 *
 * TEST
 * testComputeWeeksInMonthCountsForFYRange 참고
 * ==========================================================
 */
function computeWeeksInMonthCountsForFYRange_(startFY, endFY){

  const counts = {};

  for(let fy = startFY; fy <= endFY; fy++){

    const weeks = generateCalendarWeeksForFY_(fy);
    const fyCounts = computeWeeksInMonthCounts_(weeks);

    Object.keys(fyCounts).forEach(function(key){
      counts[key] = fyCounts[key];
    });

  }

  return counts;

}


/**
 * ==========================================================
 * TEST — computeWeeksInMonthCountsForFYRange_()
 * ==========================================================
 */
function testComputeWeeksInMonthCountsForFYRange(){

  const counts = computeWeeksInMonthCountsForFYRange_(26, 27);

  const pass =
    counts["26|AUG"] >= 4 && counts["26|AUG"] <= 5 &&
    counts["27|AUG"] >= 4 && counts["27|AUG"] <= 5 &&
    counts["26|JUL"] >= 4 && counts["26|JUL"] <= 5;

  Logger.log("Result: " + JSON.stringify(counts));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * TEST — computeWeeksInMonthCounts_()
 * ==========================================================
 */
function testComputeWeeksInMonthCounts(){

  const weeks = generateCalendarWeeksForFY_(27);
  const counts = computeWeeksInMonthCounts_(weeks);

  const augCount = counts["27|AUG"];

  Logger.log("FY27 AUG week count: " + augCount + " (expected 5)");
  Logger.log(augCount === 5 ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Weighted Average (결측 FY는 자동 제외 후 재정규화)
 *
 * WHY
 * New P1 벤치마크(FY24·25·26=1:2:3)와 CPNP1 벤치마크(FY25·26=2:3)를
 * 하나의 공식으로 다룬다. 값이 undefined/null인 FY는 가중치까지
 * 함께 제외하고 나머지로 재정규화한다 — 예: 어떤 그룹×월에 CPNP1
 * 계산 분모(New P1)가 0이라 그 FY의 비율 자체가 정의되지 않는 셀은
 * 해당 FY 가중치를 빼고 나머지 FY만으로 평균낸다(docs/TargetReportDesign.md §7).
 *
 * @param {Object} valuesByKey  key -> number|undefined
 * @param {Array} keys
 * @param {Array<number>} weights
 * @return {number}  전부 결측이면 0
 *
 * TEST
 * computeWeightedAverage_({24:10,25:20,26:30}, [24,25,26], [1,2,3]) === 140/6
 * computeWeightedAverage_({25:20,26:30}, [24,25,26], [1,2,3]) === (2*20+3*30)/5  (24 결측 제외)
 * ==========================================================
 */
function computeWeightedAverage_(valuesByKey, keys, weights){

  let numerator = 0;
  let denominator = 0;

  keys.forEach(function(key, i){

    const value = valuesByKey[key];

    if(value === undefined || value === null) return;

    const weight = weights[i] || 0;

    numerator += value * weight;
    denominator += weight;

  });

  return denominator > 0 ? numerator / denominator : 0;

}


/**
 * ==========================================================
 * TEST — computeWeightedAverage_()
 * ==========================================================
 */
function testComputeWeightedAverage(){

  const a = computeWeightedAverage_({ 24: 10, 25: 20, 26: 30 }, [24, 25, 26], [1, 2, 3]);
  const expectedA = (1 * 10 + 2 * 20 + 3 * 30) / 6;

  const b = computeWeightedAverage_({ 25: 20, 26: 30 }, [24, 25, 26], [1, 2, 3]);
  const expectedB = (2 * 20 + 3 * 30) / 5;

  const c = computeWeightedAverage_({}, [24, 25, 26], [1, 2, 3]);

  const pass =
    Math.abs(a - expectedA) < 1e-9 &&
    Math.abs(b - expectedB) < 1e-9 &&
    c === 0;

  Logger.log("a=" + a + " (expected " + expectedA + ")");
  Logger.log("b=" + b + " (expected " + expectedB + ", FY24 결측 제외 후 재정규화)");
  Logger.log("c=" + c + " (expected 0, 전부 결측)");
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute FY P1 Target (그룹) — 공식 ①
 *
 * WHY
 * top-down 역산의 출발점: 마케팅 Revenue 타겟 × 그룹 딜 비중 ÷ 그룹
 * P1당 가치 (docs/TargetReportDesign.md §6).
 *
 * @param {number} revenueTarget
 * @param {number} dealShare
 * @param {number} p1Value
 * @return {number}  p1Value가 0이면 0 (분모 방어)
 * ==========================================================
 */
function computeFYP1Target_(revenueTarget, dealShare, p1Value){

  return p1Value > 0 ? (revenueTarget * dealShare) / p1Value : 0;

}


/**
 * ==========================================================
 * Compute Monthly P1 Target — 공식 ②
 * ==========================================================
 */
function computeMonthlyP1Target_(fyP1Target, seasonalityPct){

  return fyP1Target * seasonalityPct;

}


/**
 * ==========================================================
 * Compute Weekly P1 Target — 공식 ③
 * ==========================================================
 */
function computeWeeklyP1Target_(monthlyP1Target, weeksInMonth){

  return weeksInMonth > 0 ? monthlyP1Target / weeksInMonth : 0;

}


/**
 * ==========================================================
 * Compute Monthly CPNP1 Target — 공식 ④
 *
 * WHY
 * CPNP1은 낮을수록 좋으므로 성장률이 아니라 개선계수(<1.0)를 곱한다
 * (New P1 쪽 성장률 계수는 top-down 전환으로 폐기, docs/TargetReportDesign.md §6).
 * ==========================================================
 */
function computeMonthlyCPNP1Target_(cpnp1Benchmark, improvementFactor){

  return cpnp1Benchmark * improvementFactor;

}


/**
 * ==========================================================
 * TEST — Target Derivation 공식 체인 ①~④
 * ==========================================================
 */
function testTargetDerivationFormulas(){

  const fyTarget = computeFYP1Target_(9450000, 0.34, 992.80);
  const expectedFYTarget = (9450000 * 0.34) / 992.80;

  const monthlyTarget = computeMonthlyP1Target_(fyTarget, 0.1);
  const expectedMonthlyTarget = fyTarget * 0.1;

  const weeklyTarget = computeWeeklyP1Target_(monthlyTarget, 5);
  const expectedWeeklyTarget = monthlyTarget / 5;

  const monthlyCPNP1 = computeMonthlyCPNP1Target_(500, 0.9);
  const expectedMonthlyCPNP1 = 500 * 0.9;

  const guardZeroP1Value = computeFYP1Target_(9450000, 0.34, 0);
  const guardZeroWeeks = computeWeeklyP1Target_(100, 0);

  const pass =
    Math.abs(fyTarget - expectedFYTarget) < 1e-9 &&
    Math.abs(monthlyTarget - expectedMonthlyTarget) < 1e-9 &&
    Math.abs(weeklyTarget - expectedWeeklyTarget) < 1e-9 &&
    Math.abs(monthlyCPNP1 - expectedMonthlyCPNP1) < 1e-9 &&
    guardZeroP1Value === 0 &&
    guardZeroWeeks === 0;

  Logger.log("FY P1 Target: " + fyTarget + " (expected " + expectedFYTarget + ")");
  Logger.log("Monthly P1 Target: " + monthlyTarget + " (expected " + expectedMonthlyTarget + ")");
  Logger.log("Weekly P1 Target: " + weeklyTarget + " (expected " + expectedWeeklyTarget + ")");
  Logger.log("Monthly CPNP1 Target: " + monthlyCPNP1 + " (expected " + expectedMonthlyCPNP1 + ")");
  Logger.log("Guard (p1Value=0): " + guardZeroP1Value + " (expected 0)");
  Logger.log("Guard (weeksInMonth=0): " + guardZeroWeeks + " (expected 0)");
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Parse Currency Value (외부 시트 "$1,234.56" 등 문자열/숫자 방어적 파싱)
 *
 * WHY
 * 채널시트/Naver 시트는 우리 파이프라인 밖의 외부 파일이라 셀 서식이
 * 통화 숫자든 문자열이든 그대로 신뢰하지 않고 방어적으로 파싱한다.
 *
 * TEST
 * parseCurrencyValue_("$1,234.56") === 1234.56
 * parseCurrencyValue_(1234.56) === 1234.56
 * parseCurrencyValue_("") === 0
 * ==========================================================
 */
function parseCurrencyValue_(value){

  if(typeof value === "number") return value;

  const num = Number(String(value || "").replace(/[^0-9.\-]/g, ""));

  return isNaN(num) ? 0 : num;

}


/**
 * ==========================================================
 * TEST — parseCurrencyValue_()
 * ==========================================================
 */
function testParseCurrencyValue(){

  const cases = [
    ["$1,234.56", 1234.56],
    [1234.56, 1234.56],
    ["", 0],
    [null, 0],
    ["$0.00", 0]
  ];

  let pass = true;

  cases.forEach(function(c){

    const result = parseCurrencyValue_(c[0]);
    const ok = Math.abs(result - c[1]) < 1e-9;

    if(!ok) pass = false;

    Logger.log(JSON.stringify(c[0]) + " => " + result + " (expected " + c[1] + ") " + (ok ? "✅" : "❌"));

  });

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Open Target External Sheet By Gid (탭 이름이 아닌 gid로 매칭)
 *
 * WHY
 * 채널시트/Naver/Deal Tracker 탭 이름은 실무 중 바뀔 수 있어 gid(sheetId)로
 * 찾는다 (docs/TargetReportDesign.md §3 "실물 구조 확인" 참고). 채널시트/Naver와
 * Deal Tracker는 서로 다른 파일이라 spreadsheetId를 인자로 받는다
 * (2026-07-27 Deal Tracker 연동 추가하며 일반화).
 *
 * @param {string} spreadsheetId
 * @param {number} gid
 * @return {Sheet|null}
 * ==========================================================
 */
function openTargetExternalSheetByGid_(spreadsheetId, gid){

  const file = SpreadsheetApp.openById(spreadsheetId);

  return findSheetByGid_(file, gid);

}


/**
 * ==========================================================
 * Find Sheet By Gid (이미 열려 있는 Spreadsheet 객체 재사용)
 *
 * WHY (2026-08-06 추가)
 * openTargetExternalSheetByGid_()에서 gid 탐색 루프만 떼어냄 —
 * readDealTrackerRawRows_()가 타임존 조회(getSpreadsheetTimeZone())도
 * 같은 외부 스프레드시트에서 해야 해서, openById()를 두 번 하지 않고
 * 이미 연 file 객체를 여기 재사용하기 위함(외부 openById()는 비용이 큰
 * 호출 — ACQ_REP Generate 실측 51초 중 상당 부분이 이 중복 open으로 추정).
 *
 * INPUT
 * file : Spreadsheet  SpreadsheetApp.openById()의 결과
 * gid  : number
 *
 * OUTPUT
 * Sheet | null
 * ==========================================================
 */
function findSheetByGid_(file, gid){

  const sheets = file.getSheets();

  for(let i = 0; i < sheets.length; i++){

    if(sheets[i].getSheetId() === gid) return sheets[i];

  }

  return null;

}


/**
 * ==========================================================
 * Parse Deal Tracker Close Date (Plain Text 문자열 우선, Date 객체도 방어)
 *
 * WHY
 * 딜트래커에 FY 컬럼이 없어 Close Date에서 직접 FY를 파생해야 함(2026-07-27
 * 시트 재구축). Close Date는 "24/7/2026"(DD/MM/YYYY) Plain Text로 붙여넣도록
 * 안내했으나(docs/DateParsing.md), 혹시 Sheets가 이미 Date로 자동 변환했을
 * 경우도 방어적으로 처리 — 문자열이면 parseDMY()(16_TransformHelper.js)로
 * 안전하게 파싱, 이미 Date 객체면 그대로 신뢰.
 *
 * @param {string|Date} value
 * @return {Date|null}
 * ==========================================================
 */
function parseDealTrackerCloseDate_(value){

  if(value instanceof Date && !isNaN(value.getTime())) return value;

  if(typeof value === "string" && value.trim() !== ""){
    return parseDMY(value.trim());
  }

  return null;

}


/**
 * ==========================================================
 * Normalize External Calendar Date (타임존 보정)
 *
 * WHY (2026-07-28, 실측 버그 발견 — "Minu Kang" $54,891.44 Referral 딜 누락)
 * 이 Apps Script 프로젝트의 타임존은 `appsscript.json` 기준 America/New_York
 * 인데, Deal Tracker는 별도 스프레드시트([KOR] Deal Tracking)라 타임존이
 * 다르다(실측: Close Date 2026-07-01(한국 자정 기준 입력)이 Apps Script에서
 * "Tue Jun 30 2026 11:00:00 GMT-0400"로 읽힘 — America/New_York과의 시차
 * 때문에 하루 밀림). `getFiscalYear()`/`getFiscalMonthLabel()`은 `.getMonth()`/
 * `.getFullYear()`(스크립트 자신의 타임존 기준 로컬 getter)를 쓰므로, 이
 * 밀린 Date 객체를 그대로 넘기면 매달 1일에 Close된 딜이 전부 전월로
 * 잘못 집계된다(1일이 아닌 날짜는 하루 밀려도 대개 같은 달이라 증상이
 * 안 보였을 뿐 — 월 경계에서만 드러나는 구조적 버그).
 *
 * 해결: Deal Tracker 스프레드시트 자체의 타임존(`getSpreadsheetTimeZone()`)
 * 기준으로 `Utilities.formatDate()`를 이용해 "진짜 의도된" 연/월/일을 문자열로
 * 뽑아낸 뒤, 그 값으로 이 스크립트의 로컬 타임존에서 새 Date 객체를 만든다 —
 * 이러면 `.getMonth()`/`.getDate()`가 어느 타임존에서 호출되든 항상 의도된
 * 날짜를 반환한다. `getFiscalYear()`/`getFiscalMonthLabel()`(16_TransformHelper.js,
 * 프로젝트 전역 공용 함수)은 그대로 두고, 이 함수를 Deal Tracker 등 외부
 * 스프레드시트 날짜를 읽는 지점에서만 선제적으로 적용한다 — MTA_Master/
 * Leads_Master 등 이 스크립트와 같은 스프레드시트에 바인딩된 데이터는
 * 타임존이 이미 일치하므로 영향/변경 없음.
 *
 * INPUT
 * date : Date  (외부 스프레드시트에서 getValues()로 읽은 원본 Date)
 * sourceTimeZone : string  (그 스프레드시트의 getSpreadsheetTimeZone() 반환값)
 *
 * OUTPUT
 * Date  (이 스크립트의 로컬 타임존에서 같은 연/월/일 자정을 나타내는 새 Date)
 *
 * TEST
 * testNormalizeExternalCalendarDate_() 참고
 * ==========================================================
 */
function normalizeExternalCalendarDate_(date, sourceTimeZone){

  const ymd = Utilities.formatDate(date, sourceTimeZone, "yyyy-MM-dd");
  const parts = ymd.split("-");

  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));

}


/**
 * ==========================================================
 * TEST — normalizeExternalCalendarDate_()
 * ==========================================================
 */
function testNormalizeExternalCalendarDate_(){

  // "2026-07-01 00:00 KST(UTC+9)"는 UTC로 2026-06-30T15:00:00Z.
  const utcInstant = new Date(Date.UTC(2026, 5, 30, 15, 0, 0));

  const normalized = normalizeExternalCalendarDate_(utcInstant, "Asia/Seoul");

  const pass =
    normalized.getFullYear() === 2026 &&
    normalized.getMonth() === 6 && // 7월 (0-indexed)
    normalized.getDate() === 1;

  Logger.log("Normalized: " + normalized + " (expected 2026-07-01 in script local time)");
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Read Deal Tracker Raw Rows (전체 행, FY 필터 없음 — 계산 단계에서 필터)
 *
 * WHY
 * Block B(P1당 가치)/C(딜 비중) 실데이터 원천. 2026-07-27 아키텍처 전환:
 * Leads_OPS 개별 리드 매칭(Student/Guardian Email/Account Name)을 전부
 * 폐기 — Sales팀 확인 결과 상담 후 이메일이 Salesforce에서 덮어써져 원본
 * 마케팅 터치 이메일이 시스템적으로 복구 불가능한 경우가 있어 매칭 자체가
 * 근본적으로 신뢰 불가. 대신 Deal Tracker를 Source of Truth로 삼는다.
 * 세그먼트 분류는 2026-07-28부터 딜 자체의 Lead Source/Source
 * Category/Lead Source Detail을 getBusinessSegment()로 키워드 매칭하던
 * 방식을 폐기하고, 사용자가 Deal Tracker에 수동으로 재분류한 "Segment"
 * 컬럼(H열, businessSegment 필드)을 그대로 읽는다 — 키워드 매칭 실측
 * 검증 결과 정확도가 신뢰 불가 수준이었음(Search $144,265 vs 실제
 * ~$537,507.89). classifyDealSegment_() 참고. P1 판정은 하지 않음(사용자
 * 확인: 딜트래커 딜의 99%가 이미 P1이라 사실상 전수 반영과 동일).
 *
 * closeFY/createdFY는 Close Date/Created Date 컬럼(실제 Date 타입 셀로
 * 확인됨 — 더블클릭 시 캘린더 위젯 표시, 텍스트 파싱 불필요/불확실성 없음)
 * 에서 getFiscalYear()로 직접 파생한다. **2026-07-28부터 이 두 날짜는 먼저
 * normalizeExternalCalendarDate_()로 타임존 보정을 거친다** — Deal Tracker와
 * 이 스크립트의 타임존이 달라 매달 1일 Close 딜이 전월로 잘못 집계되던
 * 실측 버그 수정(바로 위 함수 WHY 참고). 2026-07-27 사용자 확정: 딜 비중은
 * "코호트1"(closeFY===createdFY===타겟FY, 같은 해 생성·클로징)만 사용하고,
 * "코호트2"(closeFY===타겟FY, createdFY<타겟FY, 과거 리드가 이번 해에
 * 클로징된 파이프라인 기여분)는 P1당 가치의 PrevP1V 계산에 별도로 쓴다
 * (computeDealCohortsFromDealRows_() 참고). 예전 "FY" 텍스트 컬럼은 더 이상
 * 안 씀(Close Date에서 직접 파생하는 게 더 신뢰할 수 있음).
 *
 * @return {Array<{closeFY:number, createdDate:Date|null, createdFY:number|null, revenue:number, leadSource:string, sourceCategory:string, leadSourceDetail:string, businessSegment:string}>}
 * ==========================================================
 */
function readDealTrackerRawRows_(){

  return readDealTrackerEngineRows_();

}


/**
 * ==========================================================
 * Transform Deal Tracker Row (순수 함수 — 원본 row → 정규화된 객체)
 *
 * WHY
 * readDealTrackerRawRowsFromExternal_()(전체 재구축)와
 * appendNewDealTrackerRows_()(증분 동기화) 둘 다 행 하나를 같은 규칙으로
 * 변환해야 해서 공용으로 뺌. Close Date가 유효한 Date가 아니거나 FY 파생이
 * 안 되면 null 반환(그 행은 제외).
 *
 * INPUT
 * row : Array  Deal Tracker 시트의 원본 행(getValues() 결과 한 줄)
 * cols : Object  CONFIG.TARGET.EXTERNAL.DEAL_TRACKER.COLUMNS
 * sourceTimeZone : string  Deal Tracker 스프레드시트 자체 타임존
 *
 * OUTPUT
 * {closeDate, closeFY, createdDate, createdFY, revenue, leadSource,
 *  sourceCategory, leadSourceDetail, businessSegment} | null
 *
 * TEST
 * testTransformDealTrackerRow 참고
 * ==========================================================
 */
function transformDealTrackerRow_(row, cols, sourceTimeZone){

  const closeDateRaw = row[cols.CLOSE_DATE - 1];

  if(!(closeDateRaw instanceof Date) || isNaN(closeDateRaw.getTime())) return null;

  const closeDate = normalizeExternalCalendarDate_(closeDateRaw, sourceTimeZone);

  const closeFY = Number(getFiscalYear(closeDate).replace("FY", ""));

  if(!closeFY) return null;

  const createdDateRaw = row[cols.CREATED_DATE - 1];
  const hasValidCreatedDate = createdDateRaw instanceof Date && !isNaN(createdDateRaw.getTime());
  const createdDate = hasValidCreatedDate
    ? normalizeExternalCalendarDate_(createdDateRaw, sourceTimeZone)
    : null;

  const createdFY = createdDate
    ? Number(getFiscalYear(createdDate).replace("FY", ""))
    : null;

  return {
    closeDate: closeDate,
    closeFY: closeFY,
    createdDate: createdDate,
    createdFY: createdFY || null,
    revenue: parseCurrencyValue_(row[cols.REVENUE - 1]),
    leadSource: String(row[cols.LEAD_SOURCE - 1] || "").trim().toLowerCase(),
    sourceCategory: String(row[cols.SOURCE_CATEGORY - 1] || "").trim(),
    leadSourceDetail: String(row[cols.LEAD_SOURCE_DETAIL - 1] || "").trim(),
    businessSegment: String(row[cols.SEGMENT - 1] || "").trim()
  };

}


/**
 * ==========================================================
 * TEST — transformDealTrackerRow_()
 * ==========================================================
 */
function testTransformDealTrackerRow(){

  const cols = {
    CLOSE_DATE: 1, CREATED_DATE: 2, REVENUE: 3,
    LEAD_SOURCE: 4, SOURCE_CATEGORY: 5, SEGMENT: 6, LEAD_SOURCE_DETAIL: 7
  };

  const validRow = [
    new Date(2026, 6, 15), new Date(2026, 5, 1), "$1,000",
    "Paid Search", "Search Ads", "Search", "WB-2026-06-KOR-MOFU-Core Test"
  ];

  const result = transformDealTrackerRow_(validRow, cols, "Asia/Seoul");

  const noCloseDateRow = [
    "", new Date(2026, 5, 1), "$1,000", "Paid Search", "Search Ads", "Search", ""
  ];

  const noCreatedDateRow = [
    new Date(2026, 6, 15), "", "$500", "Referral", "", "Referral", ""
  ];

  const pass =
    result !== null &&
    result.closeFY === 26 &&
    result.createdFY === 26 &&
    result.revenue === 1000 &&
    result.leadSource === "paid search" &&
    result.businessSegment === "Search" &&
    transformDealTrackerRow_(noCloseDateRow, cols, "Asia/Seoul") === null &&
    transformDealTrackerRow_(noCreatedDateRow, cols, "Asia/Seoul").createdDate === null &&
    transformDealTrackerRow_(noCreatedDateRow, cols, "Asia/Seoul").createdFY === null;

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Read Deal Tracker Raw Rows From External (전체 재구축 전용, 무거움)
 *
 * WHY
 * 예전 readDealTrackerRawRows_() 본문 그대로 — 외부 Deal Tracker
 * 스프레드시트를 openById()로 열어 전체를 스캔한다. 이제는
 * rebuildDealTrackerEngine_()(백그라운드 파이프라인 전용, 전체 재구축으로
 * 기존 행 수정/재분류까지 반영)에서만 호출됨 — 평소 조회는
 * readDealTrackerRawRows_() → readDealTrackerEngineRows_()(내부 캐시,
 * 빠름)를 사용.
 *
 * @return {Array<{closeFY:number, createdDate:Date|null, createdFY:number|null, revenue:number, leadSource:string, sourceCategory:string, leadSourceDetail:string, businessSegment:string}>}
 * ==========================================================
 */
function readDealTrackerRawRowsFromExternal_(){

  const config = CONFIG.TARGET.EXTERNAL.DEAL_TRACKER;

  const file = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const sheet = findSheetByGid_(file, config.SHEET_GID);

  if(!sheet) return [];

  // 타임존 보정 (2026-07-28 실측 버그 발견) — normalizeExternalCalendarDate_() WHY 참고.
  const sourceTimeZone = file.getSpreadsheetTimeZone();

  const cols = config.COLUMNS;
  const values = sheet.getDataRange().getValues();

  const rows = [];

  for(let r = 1; r < values.length; r++){

    const transformed = transformDealTrackerRow_(values[r], cols, sourceTimeZone);

    if(transformed) rows.push(transformed);

  }

  return rows;

}


/**
 * ==========================================================
 * DealTracker_Engine — 헤더/읽기/쓰기/증분 동기화/전체 재구축
 *
 * WHY (2026-08-06, 사용자 요청 — "딜 트랙커를 직접 불러오지말고 엔진을
 * 하나 만들자")
 * readDealTrackerRawRowsFromExternal_()가 매번 외부 스프레드시트를 열고
 * 전체를 스캔+타임존 변환해서 ACQ_REP/NewP1_REP Generate가 느렸음(실측
 * 37초). Deal Tracker는 일주일에 많아야 신규 딜 5건 정도만 늘어나고(사용자
 * 확인), 기존 행이 가끔 수동으로 수정되기도 한다(2026-07-28 전체 딜 Segment
 * 재분류 실사례) — 그래서 appendNewMTA()/appendNewLeads()와 동일한 이중
 * 구조로 처리:
 *   - appendNewDealTrackerRows_() : 체크포인트 이후 신규 행만 증분 동기화
 *     (Generate 클릭 시점 포함, 빠름 — 신규 딜 몇 건 수준만 처리).
 *   - rebuildDealTrackerEngine_() : 전체 재구축, 체크포인트 리셋(백그라운드
 *     파이프라인에 배선 — 08_PipelineAsync.js — 기존 행 수정/재분류까지
 *     반영하는 정합성 보정 역할, rebuildMTAMaster()와 동일한 위치).
 * readDealTrackerRawRows_()는 이제 이 캐시(readDealTrackerEngineRows_())만
 * 읽으므로 기존 8개+ 호출부(Events/BOFU/Content Engine, ACQ/NewP1 등) 전부
 * 코드 변경 없이 자동으로 빨라짐.
 * ==========================================================
 */
const DEAL_TRACKER_ENGINE_HEADERS = [
  "Close Date", "Close FY", "Created Date", "Created FY",
  "Revenue", "Lead Source", "Source Category", "Lead Source Detail", "Business Segment"
];


function dealTrackerRowToArray_(row){

  return [
    row.closeDate, row.closeFY, row.createdDate, row.createdFY,
    row.revenue, row.leadSource, row.sourceCategory, row.leadSourceDetail, row.businessSegment
  ];

}


function arrayToDealTrackerRow_(arr){

  return {
    closeDate: arr[0],
    closeFY: arr[1],
    createdDate: (arr[2] instanceof Date && !isNaN(arr[2].getTime())) ? arr[2] : null,
    createdFY: (arr[3] === "" ? null : arr[3]),
    revenue: arr[4],
    leadSource: arr[5],
    sourceCategory: arr[6],
    leadSourceDetail: arr[7],
    businessSegment: arr[8]
  };

}


/**
 * ==========================================================
 * Write Deal Tracker Engine (전체 덮어쓰기 — rebuildDealTrackerEngine_() 전용)
 * ==========================================================
 */
function writeDealTrackerEngine_(rows){

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(CONFIG.TARGET.DEAL_TRACKER_ENGINE_SHEET);

  if(!sheet){
    sheet = ss.insertSheet(CONFIG.TARGET.DEAL_TRACKER_ENGINE_SHEET);
  }

  sheet.clearContents();

  sheet.getRange(1, 1, 1, DEAL_TRACKER_ENGINE_HEADERS.length)
    .setValues([DEAL_TRACKER_ENGINE_HEADERS]);

  if(rows.length > 0){

    sheet.getRange(2, 1, rows.length, DEAL_TRACKER_ENGINE_HEADERS.length)
      .setValues(rows.map(dealTrackerRowToArray_));

  }

  sheet.hideSheet();

  SpreadsheetApp.flush();

}


/**
 * ==========================================================
 * Append Deal Tracker Engine Rows (증분 추가 — appendNewDealTrackerRows_() 전용)
 * ==========================================================
 */
function appendDealTrackerEngineRows_(rows){

  if(rows.length === 0) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(CONFIG.TARGET.DEAL_TRACKER_ENGINE_SHEET);

  if(!sheet){
    sheet = ss.insertSheet(CONFIG.TARGET.DEAL_TRACKER_ENGINE_SHEET);
    sheet.getRange(1, 1, 1, DEAL_TRACKER_ENGINE_HEADERS.length)
      .setValues([DEAL_TRACKER_ENGINE_HEADERS]);
    sheet.hideSheet();
  }

  const startRow = Math.max(sheet.getLastRow(), 1) + 1;

  sheet.getRange(startRow, 1, rows.length, DEAL_TRACKER_ENGINE_HEADERS.length)
    .setValues(rows.map(dealTrackerRowToArray_));

  SpreadsheetApp.flush();

}


/**
 * ==========================================================
 * Read Deal Tracker Engine Rows (내부 캐시 읽기 — 빠름, 외부 호출 없음)
 * ==========================================================
 */
function readDealTrackerEngineRows_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.TARGET.DEAL_TRACKER_ENGINE_SHEET);

  if(!sheet) return [];

  const values = sheet.getDataRange().getValues();

  if(values.length <= 1) return [];

  const rows = [];

  for(let r = 1; r < values.length; r++){
    rows.push(arrayToDealTrackerRow_(values[r]));
  }

  return rows;

}


/**
 * ==========================================================
 * Rebuild Deal Tracker Engine (전체 재구축 — 백그라운드 파이프라인 전용)
 *
 * WHY
 * 기존 행 수정/재분류(2026-07-28 전체 Segment 재분류 실사례)는
 * appendNewDealTrackerRows_()의 증분 동기화로는 못 잡는다 — 이 함수가
 * 그 정합성 보정 역할(rebuildMTAMaster()와 동일 위치, 08_PipelineAsync.js
 * 배선 참고). 전체를 다시 읽어 캐시를 통째로 교체하고 체크포인트도
 * 현재 Deal Tracker 데이터 행 개수로 리셋.
 * ==========================================================
 */
function rebuildDealTrackerEngine_(){

  const start = new Date();

  Logger.log(CONFIG.LOG.PREFIX + " DealTracker Engine Rebuild Started");

  const rows = readDealTrackerRawRowsFromExternal_();

  writeDealTrackerEngine_(rows);

  const config = CONFIG.TARGET.EXTERNAL.DEAL_TRACKER;
  const file = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const sheet = findSheetByGid_(file, config.SHEET_GID);
  const totalDataRows = sheet ? Math.max(0, sheet.getLastRow() - 1) : 0;

  PropertiesService.getScriptProperties()
    .setProperty(CONFIG.PROPERTIES.DEAL_TRACKER_LAST_ROW, String(totalDataRows));

  const seconds = ((new Date() - start) / 1000).toFixed(2);

  Logger.log(
    CONFIG.LOG.PREFIX + " DealTracker Engine Rebuild Completed : " +
    rows.length + " rows (" + seconds + "s)"
  );

}


/**
 * ==========================================================
 * Append New Deal Tracker Rows (증분 동기화 — Generate 클릭 시점 포함)
 *
 * WHY
 * 체크포인트(PROPERTIES.DEAL_TRACKER_LAST_ROW) 이후 신규 행만 읽어서
 * DealTracker_Engine에 추가 — appendNewMTA()/appendNewLeads()
 * (07_IncrementalMasterBuild.js)와 동일한 관례(0-based 데이터 행 개수를
 * 체크포인트로 저장). 신규 행이 없으면 외부 시트를 열어 getLastRow()만
 * 확인하고 즉시 반환(전체 스캔 없음).
 * ==========================================================
 */
function appendNewDealTrackerRows_(){

  const config = CONFIG.TARGET.EXTERNAL.DEAL_TRACKER;

  const file = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const sheet = findSheetByGid_(file, config.SHEET_GID);

  if(!sheet) return;

  const totalDataRows = Math.max(0, sheet.getLastRow() - 1);

  const lastProcessed = Number(
    PropertiesService.getScriptProperties().getProperty(CONFIG.PROPERTIES.DEAL_TRACKER_LAST_ROW)
  ) || 0;

  if(totalDataRows <= lastProcessed){

    Logger.log(CONFIG.LOG.PREFIX + " DealTracker Engine : 0 new rows.");
    return;

  }

  const sourceTimeZone = file.getSpreadsheetTimeZone();

  const startRow = lastProcessed + 2;   // 데이터 1행 = 시트 2행(헤더 1행)
  const numRows = totalDataRows - lastProcessed;
  const lastCol = sheet.getLastColumn();

  const values = sheet.getRange(startRow, 1, numRows, lastCol).getValues();

  const cols = config.COLUMNS;
  const newRows = [];

  values.forEach(function(row){

    const transformed = transformDealTrackerRow_(row, cols, sourceTimeZone);

    if(transformed) newRows.push(transformed);

  });

  appendDealTrackerEngineRows_(newRows);

  PropertiesService.getScriptProperties()
    .setProperty(CONFIG.PROPERTIES.DEAL_TRACKER_LAST_ROW, String(totalDataRows));

  Logger.log(
    CONFIG.LOG.PREFIX + " DealTracker Engine : " + newRows.length +
    " new rows appended (of " + numRows + " new sheet rows scanned)."
  );

}


/**
 * ==========================================================
 * Manual-run public wrapper (Apps Script 편집기 Run 드롭다운 노출용)
 *
 * WHY
 * rebuildDealTrackerEngine_()는 이름 끝에 "_"가 있어 Run 드롭다운에
 * 노출되지 않는다 — DealTracker_Engine 최초 구축(사용자가 1회 수동
 * 실행 필요, 안 하면 appendNewDealTrackerRows_()가 체크포인트 0부터
 * 시작해 Deal Tracker 전체를 "신규"로 인식) 및 이후 수동 재구축용
 * 공개 진입점.
 * ==========================================================
 */
function runRebuildDealTrackerEngine(){

  rebuildDealTrackerEngine_();

}


/**
 * ==========================================================
 * Compute Deal Tracker Counts By Key (순수 함수 — 2트랙 설계 공용 헬퍼)
 *
 * WHY (2026-07-28, 2트랙 아키텍처)
 * Events_OPS/BOFU_OPS/Content_OPS의 "#Deals"/"Revenue"는 원래 Leads_OPS를
 * 리드 단위로 스캔해 Opportunity Won Date/Revenue(Salesforce 동기화 컬럼)로
 * 계산했다. 그런데 Leads_OPS 개별 리드 매칭은 상담 후 학부모 이메일 변경으로
 * 구조적으로 신뢰 불가하다는 게 이미 Target_REP에서 확인됨(CLAUDE.md #7).
 * 사용자 확정: 리드~세일즈 액티비티(Track 1)는 그대로 Leads_OPS/MTA_Master,
 * Opportunity/Revenue(Track 2)는 Deal Tracker를 Source of Truth로 삼는다.
 * Deal Tracker의 Lead Source Detail(W열)은 Events/BOFU/Content가 이미 쓰던
 * 매칭 필드(Lead Source Detail/First Touch Detail)와 같은 결의 Marketo
 * 프로그램명 문자열이라, 리드 단위 조인 없이 딜 자체의 프로그램명만 정규화해서
 * 바로 집계할 수 있다. readDealTrackerRawRows_()가 이미 유효한 Close Date
 * 행만 반환하므로(90_TargetEngine.js), 반환된 행 자체가 "Won 딜" — 별도 날짜
 * 유효성 검사 불필요.
 *
 * INPUT
 * dealRows : Object[]  readDealTrackerRawRows_()의 반환값
 * keyFn : function(row) → String|null  도메인별 정규화 규칙(null이면 제외).
 *   예) Events: stripRegistrationFormSuffix_ + isKoreanProgram_ + isEligibleEventType_
 *       BOFU/Content: stripRegistrationFormSuffix_ + isKoreanProgram_
 *
 * OUTPUT
 * { dealsWon: {key: count}, revenue: {key: sum} }
 *
 * TEST
 * testComputeDealTrackerCountsByKey_() 참고
 * ==========================================================
 */
function computeDealTrackerCountsByKey_(dealRows, keyFn){

  const dealsWon = {};
  const revenue = {};

  dealRows.forEach(function(row){

    const key = keyFn(row);

    if(!key) return;

    dealsWon[key] = (dealsWon[key] || 0) + 1;
    revenue[key] = (revenue[key] || 0) + (Number(row.revenue) || 0);

  });

  return { dealsWon: dealsWon, revenue: revenue };

}


/**
 * ==========================================================
 * TEST — computeDealTrackerCountsByKey_()
 * ==========================================================
 */
function testComputeDealTrackerCountsByKey_(){

  const dealRows = [
    { leadSourceDetail: "WB-2025-07-KOR-MOFU-Core A", revenue: 1000 },
    { leadSourceDetail: "WB-2025-07-KOR-MOFU-Core A-RF", revenue: 500 },
    { leadSourceDetail: "junk-not-a-program", revenue: 999 }
  ];

  const keyFn = function(row){
    return row.leadSourceDetail.indexOf("junk") === 0 ? null : row.leadSourceDetail.replace(/-RF$/, "");
  };

  const result = computeDealTrackerCountsByKey_(dealRows, keyFn);

  const pass =
    result.dealsWon["WB-2025-07-KOR-MOFU-Core A"] === 2 &&
    result.revenue["WB-2025-07-KOR-MOFU-Core A"] === 1500 &&
    Object.keys(result.dealsWon).length === 1;

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Build Spent By Group/FY/Month From Manual Input (Block A 벤치마크 분자 — 2026-07-30 재활성화)
 *
 * WHY
 * CPNP1 벤치마크 분자는 원래 외부 채널시트/Naver 자동집계였으나(구
 * computeCombinedSpentByGroupFYMonth_(), event/contact/lead 3그룹 단위라 5세그먼트로
 * 자동 분해가 안 돼 CPNP1_FYS를 빈 배열로 두고 잠정 중단했었음 — 게다가 3그룹 키
 * 하드코딩이라 5세그먼트 GROUP_ORDER와도 안 맞는 죽은 코드였음, 전부 삭제). 세그먼트별
 * 월별 Spent 수동 취합(Block 0 MANUAL_SEGMENT_SPENT)이 끝나면서, 그 값을 그대로
 * computeBenchmarkBlockRows_()가 기대하는 group -> fy -> month 형태로 감싸서 재사용한다
 * — 이 그리드는 항상 CONFIG.TARGET.P1_VALUE_FY(FY26) 1개 FY만 대표한다(과거 FY
 * segment-level spend 데이터 없음, CPNP1_WEIGHTS도 [1]로 단일 FY).
 *
 * @param {Object} monthlySegmentSpent  group -> {month: spent} (readTargetEngineInputs_() 결과)
 * @param {number} fy                   이 그리드가 대표하는 FY (CONFIG.TARGET.P1_VALUE_FY)
 * @return {Object}  group -> fy -> month -> spent (computeBenchmarkBlockRows_() 입력 형태)
 * ==========================================================
 */
function buildSpentByGroupFYMonthFromManualInput_(monthlySegmentSpent, fy){

  const result = {};

  Object.keys(monthlySegmentSpent || {}).forEach(function(group){
    result[group] = {};
    result[group][fy] = monthlySegmentSpent[group];
  });

  return result;

}


/**
 * Test: buildSpentByGroupFYMonthFromManualInput_()
 */
function testBuildSpentByGroupFYMonthFromManualInput(){

  const monthlySegmentSpent = {
    Seminar: { AUG: 1000, SEP: 2000 },
    Webinar: { AUG: 500 }
  };

  const result = buildSpentByGroupFYMonthFromManualInput_(monthlySegmentSpent, 26);

  const pass =
    result.Seminar[26].AUG === 1000 &&
    result.Seminar[26].SEP === 2000 &&
    result.Webinar[26].AUG === 500;

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Target Leads_OPS Aggregates (New P1 벤치마크 원천 + P1당 가치 분모)
 *
 * WHY
 * Leads_OPS를 1회 스캔(Article 10: Read Once)해서 New P1 벤치마크 대상
 * FY(24·25·26)의 (group, fy, month)별 카운트, P1당 가치 산출 대상 FY
 * (CONFIG.TARGET.P1_VALUE_FY = 26)의 (group)별 New P1 수, 그리고 all-time
 * (group)별 총 P1 수를 집계한다(NewP1_REP computeNewP1Aggregates_() 패턴,
 * 40_NewP1Report.js). 2026-07-27 이전엔 Deal Tracker 매칭용 Email/Account
 * Name→그룹 맵도 여기서 함께 만들었으나, Deal Tracker 매칭 아키텍처 자체를
 * 폐기(classifyDealSegment_()로 대체, Leads_OPS 조회 불필요)하면서 제거됨
 * — CLAUDE.md #7 참고.
 *
 * WHY (2026-07-27 코호트1/2 P1당 가치 전환)
 * P1당 가치의 Revenue는 더 이상 Leads_OPS의 Revenue 필드가 아니라 Deal
 * Tracker의 Cohort1/Cohort2 Revenue를 쓴다(computeDealCohortsFromDealRows_
 * 참고) — 이 함수는 그 분모(New P1 수, all-time 총 P1 수)만 제공한다.
 * totalP1CountByGroup은 Create Date 유효 여부와 무관하게 isEffectiveP1_()을
 * 만족하는 모든 리드를 센다(all-time 총량이라 특정 FY 필터가 없어야 함).
 *
 * @return {{newP1CountsByGroupFYMonth: Object, newP1CountByGroup: Object, totalP1CountByGroup: Object}}
 * ==========================================================
 */
function computeTargetLeadsOPSAggregates_(){

  const newP1CountsByGroupFYMonth = {};
  const newP1CountByGroup = {};
  const totalP1CountByGroup = {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(OPS.SHEET.OPS);

  if(!sheet){
    return {
      newP1CountsByGroupFYMonth: newP1CountsByGroupFYMonth,
      newP1CountByGroup: newP1CountByGroup,
      totalP1CountByGroup: totalP1CountByGroup
    };
  }

  const records = sheetToObjects(sheet);

  const benchmarkFYs = CONFIG.TARGET.BENCHMARK.NEWP1_FYS;
  const valueFY = CONFIG.TARGET.P1_VALUE_FY;

  records.forEach(function(record){

    const group = deriveTargetGroup_(record["Business Segment"]);

    if(!group) return;

    if(!isEffectiveP1_(record["Lead Priority"], record["Priority Override"])) return;

    totalP1CountByGroup[group] = (totalP1CountByGroup[group] || 0) + 1;

    const createDate = record["Create Date"];

    if(!(createDate instanceof Date) || isNaN(createDate.getTime())) return;

    const fy = Number(getFiscalYear(createDate).replace("FY", ""));
    const month = getFiscalMonthLabel(createDate);

    if(benchmarkFYs.indexOf(fy) !== -1){

      if(!newP1CountsByGroupFYMonth[group]) newP1CountsByGroupFYMonth[group] = {};
      if(!newP1CountsByGroupFYMonth[group][fy]) newP1CountsByGroupFYMonth[group][fy] = {};

      newP1CountsByGroupFYMonth[group][fy][month] =
        (newP1CountsByGroupFYMonth[group][fy][month] || 0) + 1;

    }

    if(fy === valueFY){
      newP1CountByGroup[group] = (newP1CountByGroup[group] || 0) + 1;
    }

  });

  return {
    newP1CountsByGroupFYMonth: newP1CountsByGroupFYMonth,
    newP1CountByGroup: newP1CountByGroup,
    totalP1CountByGroup: totalP1CountByGroup
  };

}


/**
 * ==========================================================
 * Compute CPNP1 Benchmark By Group (Block 0 CPNP1_BENCHMARK 섹션 — 예산 기반 도출 체인 전용)
 *
 * WHY (2026-07-30, 수동 입력 → 계산 전환)
 * 세그먼트별 FY26 CPNP1 벤치마크는 원래 사용자가 시트에 직접 입력하는 값이었음
 * (docs/exec-plans/active/2026-07-30-target-rep-segment-breakdown.md Decision Log —
 * "채널시트 자동집계 아님"). 세그먼트별 월별 Spent 수동 취합이 끝나면서 사용자가
 * "월별 Segment Spent 합 ÷ FY26 Segment New P1 합"으로 직접 계산하자고 요청(2026-07-30).
 * 분모(newP1CountByGroup)는 computeTargetLeadsOPSAggregates_()가 이미 만들어두던 값을
 * 그대로 재사용 — FY26(P1_VALUE_FY) 전체 New P1 수(월별 세분 불필요, 연간 총합만 필요).
 *
 * @param {Object} monthlySegmentSpent  group -> {month: spent} (readTargetEngineInputs_() 결과)
 * @param {Object} newP1CountByGroup    group -> FY26 New P1 수 (computeTargetLeadsOPSAggregates_() 결과)
 * @param {Array<string>} groupOrder    CONFIG.TARGET.GROUP_ORDER
 * @return {Object}  group -> CPNP1 벤치마크 (New P1이 0이면 0, 분모 방어)
 * ==========================================================
 */
function computeCPNP1BenchmarkByGroup_(monthlySegmentSpent, newP1CountByGroup, groupOrder){

  const result = {};

  groupOrder.forEach(function(group){

    const byMonth = monthlySegmentSpent[group] || {};
    const totalSpent = Object.keys(byMonth).reduce(function(sum, month){
      return sum + (Number(byMonth[month]) || 0);
    }, 0);

    const newP1Count = newP1CountByGroup[group] || 0;

    result[group] = newP1Count > 0 ? totalSpent / newP1Count : 0;

  });

  return result;

}


/**
 * Test: computeCPNP1BenchmarkByGroup_()
 */
function testComputeCPNP1BenchmarkByGroup(){

  const monthlySegmentSpent = {
    Seminar: { AUG: 1000, SEP: 2000, OCT: 0 },
    Webinar: { AUG: 500, SEP: 500 },
    BOFU: {}
  };
  const newP1CountByGroup = { Seminar: 30, Webinar: 0, BOFU: 10 };
  const groupOrder = ["Seminar", "Webinar", "BOFU"];

  const result = computeCPNP1BenchmarkByGroup_(monthlySegmentSpent, newP1CountByGroup, groupOrder);

  const expectedSeminar = 3000 / 30; // 100
  const expectedWebinar = 0; // New P1 분모 0 → 분모 방어로 0
  const expectedBOFU = 0;    // Spent 0 → 0/10 = 0

  const pass =
    Math.abs(result.Seminar - expectedSeminar) < 1e-6 &&
    result.Webinar === expectedWebinar &&
    result.BOFU === expectedBOFU;

  Logger.log("Seminar CPNP1 Benchmark: " + result.Seminar + " (expected " + expectedSeminar + ")");
  Logger.log("Webinar CPNP1 Benchmark: " + result.Webinar + " (expected 0, New P1 분모 0)");
  Logger.log("BOFU CPNP1 Benchmark: " + result.BOFU + " (expected 0, Spent 0)");
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute CPNP1 Ratio By FY/Month (분모=New P1이 0이면 그 셀은 결측)
 *
 * WHY (2026-07-30 hasOwnProperty 수정)
 * 원래 `spentMonths[month] || 0`는 "그 달 지출 데이터가 없음"과 "그 달 지출이
 * 정확히 0원"을 구분하지 못해, 데이터가 아예 없는 달도 CPNP1 $0으로 잘못
 * 계산됐다. 세그먼트별 월별 Spent 수동 취합 그리드(buildSpentByGroupFYMonthFromManualInput_()
 * 참고)도 일부 세그먼트가 특정 달에 캠페인이 아예 없는 경우(예: Seminar)가 있어
 * 이 구분이 여전히 중요 — hasOwnProperty로 명시적 결측 처리를 유지한다.
 *
 * @param {Object} spentByFYMonth       fy -> month -> spent
 * @param {Object} newP1CountsByFYMonth fy -> month -> count
 * @param {Array<number>} fys
 * @return {Object}  fy -> month -> ratio (count===0이거나 지출 데이터 자체가 없으면 그 month 키 없음)
 * ==========================================================
 */
function computeCPNP1RatioByFYMonth_(spentByFYMonth, newP1CountsByFYMonth, fys){

  const ratios = {};

  fys.forEach(function(fy){

    const spentMonths = (spentByFYMonth && spentByFYMonth[fy]) || {};
    const countMonths = (newP1CountsByFYMonth && newP1CountsByFYMonth[fy]) || {};

    ratios[fy] = {};

    CONFIG.ACQ.FISCAL_MONTH_ORDER.forEach(function(month){

      const count = countMonths[month] || 0;

      if(count > 0 && Object.prototype.hasOwnProperty.call(spentMonths, month)){

        ratios[fy][month] = spentMonths[month] / count;

      }

    });

  });

  return ratios;

}


/**
 * ==========================================================
 * Compute Benchmark Block Rows (Block A — 그룹×월 New P1/시즌성/CPNP1)
 *
 * @param {Object} newP1CountsByGroupFYMonth
 * @param {Object} spentByGroupFYMonth
 * @return {Array<Object>}  36행(3그룹×12개월), sortIndex 없이 그룹→월(Fiscal 순서) 순
 * ==========================================================
 */
function computeBenchmarkBlockRows_(newP1CountsByGroupFYMonth, spentByGroupFYMonth){

  const rows = [];

  const newP1FYs = CONFIG.TARGET.BENCHMARK.NEWP1_FYS;
  const newP1Weights = CONFIG.TARGET.BENCHMARK.NEWP1_WEIGHTS;
  const cpnp1FYs = CONFIG.TARGET.BENCHMARK.CPNP1_FYS;
  const cpnp1Weights = CONFIG.TARGET.BENCHMARK.CPNP1_WEIGHTS;

  CONFIG.TARGET.GROUP_ORDER.forEach(function(group){

    const countsByFYMonth = newP1CountsByGroupFYMonth[group] || {};
    const spentByFYMonth = (spentByGroupFYMonth && spentByGroupFYMonth[group]) || {};

    const cpnp1Ratios = computeCPNP1RatioByFYMonth_(spentByFYMonth, countsByFYMonth, cpnp1FYs);

    const weightedNewP1ByMonth = {};

    CONFIG.ACQ.FISCAL_MONTH_ORDER.forEach(function(month){

      const valuesByFY = {};

      newP1FYs.forEach(function(fy){

        const monthCounts = countsByFYMonth[fy] || {};
        valuesByFY[fy] = monthCounts[month] || 0;

      });

      weightedNewP1ByMonth[month] = computeWeightedAverage_(valuesByFY, newP1FYs, newP1Weights);

    });

    const totalWeightedNewP1 = CONFIG.ACQ.FISCAL_MONTH_ORDER.reduce(function(sum, month){
      return sum + weightedNewP1ByMonth[month];
    }, 0);

    CONFIG.ACQ.FISCAL_MONTH_ORDER.forEach(function(month){

      const newP1ByFY = newP1FYs.map(function(fy){

        const monthCounts = countsByFYMonth[fy] || {};
        return monthCounts[month] || 0;

      });

      const weightedAvgNewP1 = weightedNewP1ByMonth[month];
      const seasonalityPct = totalWeightedNewP1 > 0 ? weightedAvgNewP1 / totalWeightedNewP1 : 0;

      const cpnp1ValuesByFY = {};

      cpnp1FYs.forEach(function(fy){
        cpnp1ValuesByFY[fy] = cpnp1Ratios[fy] ? cpnp1Ratios[fy][month] : undefined;
      });

      const cpnp1Benchmark = computeWeightedAverage_(cpnp1ValuesByFY, cpnp1FYs, cpnp1Weights);

      rows.push({
        group: group,
        month: month,
        newP1ByFY: newP1ByFY,
        weightedAvgNewP1: weightedAvgNewP1,
        seasonalityPct: seasonalityPct,
        cpnp1Benchmark: cpnp1Benchmark
      });

    });

  });

  return rows;

}


/**
 * ==========================================================
 * TEST — computeBenchmarkBlockRows_() (합성 데이터, 원본 스캔 없이 순수 로직만 검증)
 * ==========================================================
 */
function testComputeBenchmarkBlockRows(){

  // 2026-07-30 세그먼트 분해 — CONFIG.TARGET.GROUP_ORDER 실제 세그먼트명 사용(첫 항목 Seminar).
  const counts = {
    Seminar: {
      24: { AUG: 10 },
      25: { AUG: 20 },
      26: { AUG: 30 }
    }
  };

  // 2026-07-30: CPNP1_FYS가 [26](단일 FY)로 재활성화되면서 25 픽스처는 더 이상
  // 안 쓰임(가중치 배열에 25가 없으면 computeWeightedAverage_()가 무시함) — 26만 남김.
  const spent = {
    Seminar: {
      26: { AUG: 3000 }
    }
  };

  const rows = computeBenchmarkBlockRows_(counts, spent);

  const augRow = rows.filter(function(r){ return r.group === "Seminar" && r.month === "AUG"; })[0];

  const expectedWeightedAvg = (1 * 10 + 2 * 20 + 3 * 30) / 6; // 23.333...
  const expectedCpnp1Benchmark = 3000 / 30; // 100 — CPNP1_FYS=[26] 단일 FY(2026-07-30 재활성화)

  const pass =
    rows.length === CONFIG.TARGET.GROUP_ORDER.length * 12 &&
    Math.abs(augRow.weightedAvgNewP1 - expectedWeightedAvg) < 1e-6 &&
    Math.abs(augRow.cpnp1Benchmark - expectedCpnp1Benchmark) < 1e-6 &&
    augRow.seasonalityPct > 0;

  Logger.log("Row count: " + rows.length + " (expected " + (CONFIG.TARGET.GROUP_ORDER.length * 12) + ")");
  Logger.log("AUG weightedAvgNewP1: " + augRow.weightedAvgNewP1 + " (expected " + expectedWeightedAvg + ")");
  Logger.log("AUG cpnp1Benchmark: " + augRow.cpnp1Benchmark + " (expected " + expectedCpnp1Benchmark + ", CPNP1_FYS=[26] 단일 FY)");
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute P1 Value Block Rows (Block B — 코호트1/2 이원화)
 *
 * WHY
 * 2026-07-27 사용자 확정 프레임워크: "이번 FY 총 딜 = 이번 FY 생성된 리드
 * 코호트(코호트1) + 더 오래된 리드 코호트(코호트2)". CurrentFYP1V(a) =
 * 코호트1 Revenue ÷ 이번 FY New P1 수, PrevP1V(b) = 코호트2 Revenue ÷
 * (all-time 총 P1 수 − 이번 FY New P1 수). 두 값을 각각 계산해 나란히
 * 노출만 하고, 최종 타겟 공식에서 a/b를 어떻게 합칠지는 사용자가 두 값을
 * 직접 보고 나중에 결정하기로 함(현재는 computeTargetDerivationRows_()에서
 * a를 임시 placeholder로 사용).
 *
 * @param {Object} dealCohortsByGroup  group -> {cohort1Revenue, cohort2Revenue} (computeDealCohortsFromDealRows_)
 * @param {Object} newP1CountByGroup   group -> 이번 FY New P1 수
 * @param {Object} totalP1CountByGroup group -> all-time 총 P1 수
 * @return {Array<Object>}
 * ==========================================================
 */
function computeP1ValueBlockRows_(dealCohortsByGroup, newP1CountByGroup, totalP1CountByGroup){

  return CONFIG.TARGET.GROUP_ORDER.map(function(group){

    const cohort = dealCohortsByGroup[group] || { cohort1Revenue: 0, cohort2Revenue: 0 };
    const newP1Count = newP1CountByGroup[group] || 0;
    const totalP1Count = totalP1CountByGroup[group] || 0;
    const prevP1Count = Math.max(totalP1Count - newP1Count, 0);

    const currentFYP1V = newP1Count > 0 ? cohort.cohort1Revenue / newP1Count : 0;
    const prevP1V = prevP1Count > 0 ? cohort.cohort2Revenue / prevP1Count : 0;

    return {
      group: group,
      newP1Count: newP1Count,
      cohort1Revenue: cohort.cohort1Revenue,
      currentFYP1V: currentFYP1V,
      prevP1Count: prevP1Count,
      cohort2Revenue: cohort.cohort2Revenue,
      prevP1V: prevP1V
    };

  });

}


/**
 * ==========================================================
 * TEST — computeP1ValueBlockRows_() (합성 데이터, 코호트1/2 이원화 검증)
 * ==========================================================
 */
function testComputeP1ValueBlockRows(){

  // 2026-07-30 세그먼트 분해 — CONFIG.TARGET.GROUP_ORDER 실제 세그먼트명 사용.
  const dealCohortsByGroup = {
    Seminar: { cohort1Revenue: 100000, cohort2Revenue: 20000 }
  };

  const newP1CountByGroup = { Seminar: 100 };
  const totalP1CountByGroup = { Seminar: 300 };

  const rows = computeP1ValueBlockRows_(dealCohortsByGroup, newP1CountByGroup, totalP1CountByGroup);

  const seminarRow = rows.filter(function(r){ return r.group === "Seminar"; })[0];
  const otherRow = rows.filter(function(r){ return r.group === "BOFU"; })[0];

  const pass =
    seminarRow.prevP1Count === 200 && // 300 - 100
    Math.abs(seminarRow.currentFYP1V - 1000) < 1e-6 && // 100000 / 100
    Math.abs(seminarRow.prevP1V - 100) < 1e-6 && // 20000 / 200
    otherRow.currentFYP1V === 0 &&
    otherRow.prevP1V === 0;

  Logger.log("Seminar CurrentFYP1V(a): " + seminarRow.currentFYP1V + " (expected 1000)");
  Logger.log("Seminar PrevP1V(b): " + seminarRow.prevP1V + " (expected 100)");
  Logger.log("BOFU(무데이터) a/b: " + otherRow.currentFYP1V + "/" + otherRow.prevP1V + " (expected 0/0)");
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Classify Deal Segment (Deal Tracker 자체 필드로 직접 분류 — Leads_OPS 매칭 없음)
 *
 * WHY
 * 2026-07-27 아키텍처 전환: Student Contact Email/Primary Guardian Email/
 * Account Name을 Leads_OPS와 매칭하던 접근을 전부 폐기했다 — Sales팀 확인
 * 결과, 상담 종료 후 학부모가 이메일 변경을 요청하면 Salesforce의 Lead/
 * Opportunity 이메일이 그대로 덮어써져 원본 마케팅 터치 이메일이 시스템적
 * 으로 복구 불가능한 경우가 있어(Ryan Kang 등 실측 사례) 개별 리드 매칭
 * 자체가 근본적으로 신뢰할 수 없었다. Deal Tracker는 애초에 모든 Opportunity
 * 를 담고 있으므로(사용자 판단), 개별 리드 식별 없이 딜 자체의 세그먼트를
 * 직접 분류한다.
 *
 * 2026-07-28 재수정: `getBusinessSegment()` 키워드 매칭(Lead Source Detail/
 * Lead Source/Source Category 기반)을 실측 검증한 결과 정확도가 신뢰 불가
 * 수준이었음(Search 세그먼트가 코드 기준 $144,265인데 실제로는 ~$537,507.89 —
 * 약 $393K 갭). 사용자가 Deal Tracker에 수동으로 전체 딜을 재분류한 "Segment"
 * 컬럼(원래 "Content Category"였던 H열을 개명 + 재입력)을 직접 만들었으므로,
 * 이제 이 컬럼(`row.businessSegment`, `readDealTrackerRawRows_()` 참고)을
 * 그대로 Source of Truth로 쓴다 — 키워드 매칭 폐기.
 *
 * @param {{businessSegment:string}} row
 * @return {string|null}  그룹(events/contact/content) 또는 분류 불가 시 null
 * ==========================================================
 */
function classifyDealSegment_(row){

  return deriveTargetGroup_(row.businessSegment);

}


/**
 * ==========================================================
 * Compute Deal Share Ratios From Deal Rows (순수 계산 — 코호트1 전용)
 *
 * WHY
 * §5 "세그먼트 딜 비중": 조정 베이스(전체 딜 − 세일즈 레퍼럴·업셀) 대비 그룹별
 * Revenue 비중을 구한다. **2026-07-27 사용자 확정**: "코호트1"(Create Date·
 * Close Date 둘 다 타겟 FY인 딜 — 같은 해에 생성돼 같은 해에 클로징된 것)만
 * 사용한다 — "내년에 들어온 리드 중 얼마나가 그 해 안에 클로징될지"를 보려면
 * 같은 해 생성·클로징 딜만 봐야 한다는 논리. 과거에 생성돼 이번 해에
 * 클로징된 딜(코호트2, 파이프라인 기여분)은 여기 안 섞고 P1당 가치의
 * PrevP1V에서 별도로 다룬다(computeDealCohortsFromDealRows_() 참고). 원래는
 * Close Date만 기준으로 한 3FY median이었으나 실측 결과(median 기준 contact
 * 20.9% vs FY26 단독 31.3%) 최근 연도와 괴리가 커서 폐기됨. 그룹 분류는
 * classifyDealSegment_()로 딜 자체 필드에서 직접 이뤄진다(Leads_OPS 매칭
 * 없음) — 분류 안 되는 딜은 조정 베이스(분모)엔 포함되지만 특정 그룹(분자)
 * 엔 배분되지 않는다(분류율은 로그로 확인 가능).
 *
 * @param {Array<{closeFY:number, createdFY:number|null, revenue:number, leadSource:string, businessSegment:string}>} dealRows
 * @return {Object}  group -> ratio (0~1)
 *
 * TEST
 * FY26 코호트1 events=100/300 (조정 베이스 300 중 events 100 배분, 나머지는 분류 안 됨 등)
 * ==========================================================
 */
function computeDealShareRatiosFromDealRows_(dealRows){

  const config = CONFIG.TARGET.EXTERNAL.DEAL_TRACKER;
  const targetFY = CONFIG.TARGET.P1_VALUE_FY;

  const excludeSet = {};
  config.EXCLUDE_LEAD_SOURCES.forEach(function(src){ excludeSet[src] = true; });

  let base = 0;
  const byGroup = {};
  CONFIG.TARGET.GROUP_ORDER.forEach(function(g){ byGroup[g] = 0; });

  let classifiedCount = 0;
  let unclassifiedCount = 0;

  dealRows.forEach(function(row){

    if(row.closeFY !== targetFY || row.createdFY !== targetFY) return; // 코호트1만
    if(excludeSet[String(row.leadSource || "").toLowerCase()]) return;

    base += row.revenue;

    const group = classifyDealSegment_(row);

    if(group){
      byGroup[group] += row.revenue;
      classifiedCount++;
    } else {
      unclassifiedCount++;
    }

  });

  Logger.log(
    CONFIG.LOG.PREFIX + " Deal Tracker classify (FY" + targetFY + " 코호트1 — 같은 해 생성·클로징): " +
    classifiedCount + " classified / " + unclassifiedCount + " unclassified " +
    "(Segment 컬럼으로 세그먼트 분류 안 된 건수)"
  );

  const result = {};

  CONFIG.TARGET.GROUP_ORDER.forEach(function(group){
    result[group] = base > 0 ? byGroup[group] / base : 0;
  });

  return result;

}


/**
 * ==========================================================
 * TEST — computeDealShareRatiosFromDealRows_() (합성 데이터)
 * ==========================================================
 */
/**
 * ==========================================================
 * TEST — classifyDealSegment_() (딜 자체 필드로 직접 분류, Leads_OPS 매칭 없음 —
 * 2026-07-30 세그먼트 분해로 그룹명이 세그먼트명 그대로가 됨, 1:1 매핑 확인)
 * ==========================================================
 */
function testClassifyDealSegment(){

  const webinarMatch = classifyDealSegment_({ businessSegment: "Webinar" });
  const searchMatch = classifyDealSegment_({ businessSegment: "Search" });
  const contentMatch = classifyDealSegment_({ businessSegment: "Content" });
  const noMatch = classifyDealSegment_({ businessSegment: "N/A" });
  const otherMatch = classifyDealSegment_({ businessSegment: "Other" });

  const pass =
    webinarMatch === "Webinar" &&
    searchMatch === "Search" &&
    contentMatch === "Content" &&
    noMatch === null &&
    otherMatch === null;

  Logger.log("Webinar 분류: " + webinarMatch + " (expected Webinar)");
  Logger.log("Search 분류: " + searchMatch + " (expected Search)");
  Logger.log("Content 분류: " + contentMatch + " (expected Content)");
  Logger.log("N/A → 분류 불가: " + noMatch + " (expected null)");
  Logger.log("Other → 분류 불가: " + otherMatch + " (expected null)");
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


function testComputeDealShareRatiosFromDealRows(){

  const dealRows = [
    // 코호트1 (closeFY===createdFY===26) — Deal Share 계산에 포함되는 것들
    { closeFY: 26, createdFY: 26, revenue: 100, leadSource: "webinar", businessSegment: "Webinar" },
    { closeFY: 26, createdFY: 26, revenue: 100, leadSource: "paid search", businessSegment: "Search" },
    { closeFY: 26, createdFY: 26, revenue: 200, leadSource: "organic", businessSegment: "Content" },
    { closeFY: 26, createdFY: 26, revenue: 50, leadSource: "organic", businessSegment: "Other" }, // 분류 안 됨
    { closeFY: 26, createdFY: 26, revenue: 9999, leadSource: "Upsell", businessSegment: "Other" }, // 제외 대상
    // 코호트2 (closeFY=26이지만 createdFY=25) — Deal Share 계산에서 완전 제외돼야 함
    { closeFY: 26, createdFY: 25, revenue: 9999, leadSource: "webinar", businessSegment: "Webinar" },
    // closeFY가 타겟 FY(26)가 아님 — 제외
    { closeFY: 25, createdFY: 25, revenue: 9999, leadSource: "webinar", businessSegment: "Webinar" }
  ];

  const result = computeDealShareRatiosFromDealRows_(dealRows);

  const expectedWebinar = 100 / 450; // 코호트1 base = 100+100+200+50(분류 안 됨) = 450

  const pass = Math.abs(result.Webinar - expectedWebinar) < 1e-6;

  Logger.log("Webinar dealShare: " + result.Webinar + " (expected ~" + expectedWebinar + ")");
  Logger.log("Search dealShare: " + result.Search);
  Logger.log("Content dealShare: " + result.Content);
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Deal Share Ratios From Deal Rows — Cohort2 (Pipeline 트랙 그룹 배분 기준)
 *
 * WHY
 * 2026-07-27 Target_REP Block D 재설계(New/Pipeline 2트랙 분리) 확정: pipeline
 * 트랙(과거에 뿌려둔 리드가 이번 FY에 전환되는 몫)의 그룹별 배분은 코호트1
 * 딜비중(computeDealShareRatiosFromDealRows_)을 재사용하면 안 된다 — 실측
 * 검증 결과 contact처럼 "같은 해 빠르게 전환되는" 채널에 파이프라인 목표까지
 * 과도하게 쏠리는 문제가 발견됨(사용자 확인). 대신 **코호트2(R2) 자체의
 * 그룹별 비중**을 써야 "실제로 백로그가 전환되고 있는 채널"에 파이프라인
 * 목표가 붙는다 — content처럼 nurture가 긴 채널이 더 큰 몫을 받게 됨(원래
 * 코호트1/2 이원화를 시작한 동기와 일치, CLAUDE.md #7).
 * 계산 구조는 computeDealShareRatiosFromDealRows_()와 동일(조정 베이스에
 * unclassified 포함, 분자에서는 제외, referral/upsell 제외) — 필터 조건만
 * "코호트2"(closeFY===targetFY, createdFY!==targetFY, null 포함)로 바뀐다.
 *
 * @param {Array<{closeFY:number, createdFY:number|null, revenue:number, leadSource:string, contentCategory:string}>} dealRows
 * @return {Object}  group -> ratio (0~1)
 *
 * TEST
 * FY26 코호트2 events=300/600 (조정 베이스 600 중 events 300 배분)
 * ==========================================================
 */
function computeDealShareRatiosCohort2FromDealRows_(dealRows){

  const config = CONFIG.TARGET.EXTERNAL.DEAL_TRACKER;
  const targetFY = CONFIG.TARGET.P1_VALUE_FY;

  const excludeSet = {};
  config.EXCLUDE_LEAD_SOURCES.forEach(function(src){ excludeSet[src] = true; });

  let base = 0;
  const byGroup = {};
  CONFIG.TARGET.GROUP_ORDER.forEach(function(g){ byGroup[g] = 0; });

  let classifiedCount = 0;
  let unclassifiedCount = 0;

  dealRows.forEach(function(row){

    if(row.closeFY !== targetFY || row.createdFY === targetFY) return; // 코호트2만(과거 생성, 이번 FY 클로징)
    if(excludeSet[String(row.leadSource || "").toLowerCase()]) return;

    base += row.revenue;

    const group = classifyDealSegment_(row);

    if(group){
      byGroup[group] += row.revenue;
      classifiedCount++;
    } else {
      unclassifiedCount++;
    }

  });

  Logger.log(
    CONFIG.LOG.PREFIX + " Deal Tracker classify (FY" + targetFY + " 코호트2 — 과거 생성·이번 FY 클로징): " +
    classifiedCount + " classified / " + unclassifiedCount + " unclassified"
  );

  const result = {};

  CONFIG.TARGET.GROUP_ORDER.forEach(function(group){
    result[group] = base > 0 ? byGroup[group] / base : 0;
  });

  return result;

}


/**
 * ==========================================================
 * TEST — computeDealShareRatiosCohort2FromDealRows_() (합성 데이터)
 *
 * 2026-07-30 수정: 원래 픽스처가 `contentCategory` 필드를 썼는데 classifyDealSegment_()는
 * `businessSegment`만 읽으므로(2026-07-28부터) 전 행이 항상 분류 실패(unclassified)해
 * 테스트가 실질적으로 아무것도 검증하지 못하고 있었음(값 자체는 우연히 0이라 통과 판정만
 * 됐던 잠재적 버그) — `businessSegment`로 교정, 그룹명도 5세그먼트로 갱신.
 * ==========================================================
 */
function testComputeDealShareRatiosCohort2FromDealRows(){

  const dealRows = [
    // 코호트1 — 완전 제외돼야 함
    { closeFY: 26, createdFY: 26, revenue: 9999, leadSource: "paid social", businessSegment: "Webinar" },
    // 코호트2 (closeFY=26, createdFY=25) — 배분 대상
    { closeFY: 26, createdFY: 25, revenue: 300, leadSource: "paid social", businessSegment: "Webinar" },
    { closeFY: 26, createdFY: 24, revenue: 200, leadSource: "organic", businessSegment: "Content" },
    { closeFY: 26, createdFY: null, revenue: 100, leadSource: "organic", businessSegment: "N/A" }, // createdFY 불명 — 코호트2로 처리, 분류 안 됨
    { closeFY: 26, createdFY: 25, revenue: 9999, leadSource: "Upsell", businessSegment: "N/A" }, // 제외 대상
    // closeFY가 타겟 FY 아님 — 제외
    { closeFY: 25, createdFY: 24, revenue: 9999, leadSource: "paid social", businessSegment: "Webinar" }
  ];

  const result = computeDealShareRatiosCohort2FromDealRows_(dealRows);

  const expectedWebinar = 300 / 600; // 코호트2 base = 300+200+100 = 600

  const pass = Math.abs(result.Webinar - expectedWebinar) < 1e-6;

  Logger.log("Webinar pipelineShare: " + result.Webinar + " (expected ~" + expectedWebinar + ")");
  Logger.log("Content pipelineShare: " + result.Content + " (expected ~" + (200 / 600) + ")");
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute New/Pipeline Revenue Split (Block C — 전체 Revenue 타겟을 2트랙으로 분리)
 *
 * WHY
 * 2026-07-27 사용자 확정 프레임워크: FY27 마케팅 Revenue 타겟 전체를 "New
 * 트랙"(이번 FY 새로 생성된 리드가 같은 해 안에 전환하는 몫, 코호트1 비율)과
 * "Pipeline 트랙"(과거에 뿌려둔 리드가 이번 FY에 전환되는 몫, 코호트2 비율)
 * 으로 먼저 나눈다. 분리 기준은 FY26 실측 전체 코호트1/코호트2 Revenue 비중
 * (조정 베이스 = 전체 딜 − referral/upsell, unclassified 포함) — "이전 FY들은
 * 본사 관리 체제라 노이즈"라는 사용자 판단(2026-07-27)에 따라 3FY 평균/median
 * 없이 FY26 단일 스냅샷만 사용(Block B의 a/b, Block C 딜비중과 동일 원칙).
 *
 * @param {Array<{closeFY:number, createdFY:number|null, revenue:number, leadSource:string}>} dealRows
 * @return {{newShare:number, pipelineShare:number}}
 *
 * TEST
 * base1=100, base2=50 → newShare=100/150, pipelineShare=50/150
 * ==========================================================
 */
function computeNewPipelineRevenueSplit_(dealRows){

  const config = CONFIG.TARGET.EXTERNAL.DEAL_TRACKER;
  const targetFY = CONFIG.TARGET.P1_VALUE_FY;

  const excludeSet = {};
  config.EXCLUDE_LEAD_SOURCES.forEach(function(src){ excludeSet[src] = true; });

  let base1 = 0; // 코호트1 (New 트랙)
  let base2 = 0; // 코호트2 (Pipeline 트랙)

  dealRows.forEach(function(row){

    if(row.closeFY !== targetFY) return;
    if(excludeSet[String(row.leadSource || "").toLowerCase()]) return;

    if(row.createdFY === targetFY){
      base1 += row.revenue;
    } else {
      base2 += row.revenue;
    }

  });

  const total = base1 + base2;

  return {
    newShare: total > 0 ? base1 / total : 0,
    pipelineShare: total > 0 ? base2 / total : 0
  };

}


/**
 * ==========================================================
 * TEST — computeNewPipelineRevenueSplit_() (합성 데이터)
 * ==========================================================
 */
function testComputeNewPipelineRevenueSplit(){

  const dealRows = [
    { closeFY: 26, createdFY: 26, revenue: 100, leadSource: "paid social" }, // 코호트1
    { closeFY: 26, createdFY: 25, revenue: 50, leadSource: "organic" },      // 코호트2
    { closeFY: 26, createdFY: 26, revenue: 9999, leadSource: "Upsell" },     // 제외
    { closeFY: 25, createdFY: 25, revenue: 9999, leadSource: "paid social" } // closeFY 불일치 — 제외
  ];

  const result = computeNewPipelineRevenueSplit_(dealRows);

  const pass =
    Math.abs(result.newShare - (100 / 150)) < 1e-6 &&
    Math.abs(result.pipelineShare - (50 / 150)) < 1e-6;

  Logger.log("newShare: " + result.newShare + " (expected " + (100 / 150) + ")");
  Logger.log("pipelineShare: " + result.pipelineShare + " (expected " + (50 / 150) + ")");
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Deal Cohorts From Deal Rows (Block B 원천 — 코호트1/2 Revenue 분리)
 *
 * WHY
 * 2026-07-27 사용자 확정: Close Date가 타겟 FY인 딜을, Create Date도 같은
 * 타겟 FY인지(코호트1 — 같은 해 생성·클로징) 아닌지(코호트2 — 과거 생성,
 * 이번 FY에 클로징된 파이프라인 기여분)로 나눠 그룹별 Revenue를 각각
 * 합산한다. computeDealShareRatiosFromDealRows_()와 그룹 분류 로직
 * (classifyDealSegment_(), 세일즈 레퍼럴/업셀 제외)은 동일하되, 코호트2도
 * 함께 계산한다는 점이 다르다 — Deal Share는 코호트1만 쓰지만 P1당 가치는
 * 코호트1(a)과 코호트2(b)를 모두 필요로 하기 때문(§5 Open Item 참고).
 * 분류 안 되는 딜(classifyDealSegment_()가 null)은 어느 그룹에도 배분하지
 * 않는다(그룹별 Revenue라 분모 개념이 없어 Deal Share처럼 별도 베이스 집계 불필요).
 *
 * @param {Array<{closeFY:number, createdFY:number|null, revenue:number, leadSource:string, businessSegment:string}>} dealRows
 * @return {Object}  group -> {cohort1Revenue, cohort2Revenue}
 * ==========================================================
 */
function computeDealCohortsFromDealRows_(dealRows){

  const config = CONFIG.TARGET.EXTERNAL.DEAL_TRACKER;
  const targetFY = CONFIG.TARGET.P1_VALUE_FY;

  const excludeSet = {};
  config.EXCLUDE_LEAD_SOURCES.forEach(function(src){ excludeSet[src] = true; });

  const cohort1ByGroup = {};
  const cohort2ByGroup = {};
  CONFIG.TARGET.GROUP_ORDER.forEach(function(g){ cohort1ByGroup[g] = 0; cohort2ByGroup[g] = 0; });

  dealRows.forEach(function(row){

    if(row.closeFY !== targetFY) return;
    if(excludeSet[String(row.leadSource || "").toLowerCase()]) return;

    const group = classifyDealSegment_(row);

    if(!group) return;

    if(row.createdFY === targetFY){
      cohort1ByGroup[group] += row.revenue;
    } else {
      cohort2ByGroup[group] += row.revenue;
    }

  });

  const result = {};

  CONFIG.TARGET.GROUP_ORDER.forEach(function(group){
    result[group] = {
      cohort1Revenue: cohort1ByGroup[group],
      cohort2Revenue: cohort2ByGroup[group]
    };
  });

  return result;

}


/**
 * ==========================================================
 * TEST — computeDealCohortsFromDealRows_() (합성 데이터)
 * ==========================================================
 */
function testComputeDealCohortsFromDealRows(){

  const dealRows = [
    // 코호트1: closeFY===createdFY===26
    { closeFY: 26, createdFY: 26, revenue: 100, leadSource: "webinar", businessSegment: "Webinar" },
    // 코호트2: closeFY===26이지만 createdFY===24(오래된 리드가 이번 FY 클로징)
    { closeFY: 26, createdFY: 24, revenue: 300, leadSource: "webinar", businessSegment: "Webinar" },
    // 제외 대상(Upsell)
    { closeFY: 26, createdFY: 26, revenue: 9999, leadSource: "Upsell", businessSegment: "Other" },
    // closeFY가 타겟 FY 아님 — 전부 제외
    { closeFY: 25, createdFY: 25, revenue: 9999, leadSource: "webinar", businessSegment: "Webinar" },
    // 분류 불가 — 그룹 배분에서 제외
    { closeFY: 26, createdFY: 26, revenue: 50, leadSource: "organic", businessSegment: "Other" }
  ];

  const result = computeDealCohortsFromDealRows_(dealRows);

  const pass =
    result.Webinar.cohort1Revenue === 100 &&
    result.Webinar.cohort2Revenue === 300;

  Logger.log("Webinar cohort1Revenue: " + result.Webinar.cohort1Revenue + " (expected 100)");
  Logger.log("Webinar cohort2Revenue: " + result.Webinar.cohort2Revenue + " (expected 300)");
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Deal Share Block Rows (Block C — New/Pipeline 2트랙 FY P1 목표 포함)
 *
 * WHY (2026-07-27 New/Pipeline 2트랙 확정 — CLAUDE.md #7 최종 결정)
 * a/b 블렌딩 방식이 미정이던 걸 사용자가 실물 값 검토 후 확정: FY 목표를
 * "New 트랙"(코호트1 비율로 나눈 Revenue ÷ a)과 "Pipeline 트랙"(코호트2
 * 비율로 나눈 Revenue ÷ b)으로 나눠 각각 계산한 뒤 더한다. 딜비중(코호트1)을
 * Pipeline 트랙에도 재사용하면 안 됨(같은 해 빠르게 전환되는 채널에 쏠림,
 * 실측으로 확인) — Pipeline 트랙은 반드시 코호트2(R2) 자체 비중을 써야 한다.
 * 3FY median/가중평균도 쓰지 않음 — "이전 FY는 본사 관리 체제라 노이즈"라는
 * 사용자 판단(2026-07-27)에 따라 a/b/딜비중/pipeline비중/New-Pipeline 분리
 * 비율 전부 FY26(P1_VALUE_FY) 단일 스냅샷 기준으로 통일.
 * Deal Tracker 계산이 실패(시트 접근 불가 등)하면 Input 블록의 수동 값으로
 * Fallback(§5, §12 Open Item #5) — pipelineShare/newPipelineSplit도 딜비중과
 * 동일하게 Fallback(dealShare 재사용, 실패 시 안전장치일 뿐 정밀도 요구 안 함).
 *
 * @param {Object} inputs
 * @param {Object|null} dealShareRatios      computeDealShareRatiosFromDealRows_() 결과(코호트1, 딜 0건이면 null)
 * @param {Object|null} pipelineShareRatios  computeDealShareRatiosCohort2FromDealRows_() 결과(코호트2, 딜 0건이면 null)
 * @param {Object} p1ValueByGroup            group -> {currentFYP1V, prevP1V} (computeP1ValueBlockRows_ 결과를 group 키로 재매핑)
 * @param {{newShare:number, pipelineShare:number}} newPipelineSplit  computeNewPipelineRevenueSplit_() 결과
 * @return {Array<Object>}
 * ==========================================================
 */
function computeDealShareBlockRows_(inputs, dealShareRatios, pipelineShareRatios, p1ValueByGroup, newPipelineSplit){

  const fallbackMap = inputs.dealShareByGroup || {};

  return CONFIG.TARGET.GROUP_ORDER.map(function(group){

    const dealShare = dealShareRatios ? (dealShareRatios[group] || 0) : (fallbackMap[group] || 0);
    const pipelineShare = pipelineShareRatios ? (pipelineShareRatios[group] || 0) : (fallbackMap[group] || 0);

    const p1Value = p1ValueByGroup[group] || { currentFYP1V: 0, prevP1V: 0 };

    const newP1Target = computeFYP1Target_(
      inputs.revenueTarget * newPipelineSplit.newShare, dealShare, p1Value.currentFYP1V
    );

    const pipelineP1Target = computeFYP1Target_(
      inputs.revenueTarget * newPipelineSplit.pipelineShare, pipelineShare, p1Value.prevP1V
    );

    return {
      group: group,
      dealShare: dealShare,
      pipelineShare: pipelineShare,
      newP1Target: newP1Target,
      pipelineP1Target: pipelineP1Target,
      totalP1Target: newP1Target + pipelineP1Target
    };

  });

}


/**
 * ==========================================================
 * TEST — computeDealShareBlockRows_() (합성 데이터, New/Pipeline 2트랙 검증)
 * ==========================================================
 */
function testComputeDealShareBlockRows(){

  // 2026-07-30 세그먼트 분해: CONFIG.TARGET.GROUP_ORDER가 실제로 5세그먼트
  // (Seminar/Webinar/BOFU/Search/Content)라 픽스처도 그 이름을 그대로 써야
  // rows[0]이 실제 첫 세그먼트(Seminar)와 맞물린다.
  const inputs = {
    revenueTarget: 1000000,
    dealShareByGroup: { Seminar: 0.34, Webinar: 0.2, BOFU: 0.2, Search: 0.13, Content: 0.13 }
  };

  const dealShareRatios = { Seminar: 0.5, Webinar: 0.1, BOFU: 0.1, Search: 0.1, Content: 0.2 };
  const pipelineShareRatios = { Seminar: 0.2, Webinar: 0.1, BOFU: 0.1, Search: 0.1, Content: 0.5 };

  const p1ValueByGroup = {
    Seminar: { currentFYP1V: 1000, prevP1V: 500 },
    Webinar: { currentFYP1V: 900, prevP1V: 450 },
    BOFU: { currentFYP1V: 800, prevP1V: 400 },
    Search: { currentFYP1V: 700, prevP1V: 350 },
    Content: { currentFYP1V: 200, prevP1V: 300 }
  };

  const newPipelineSplit = { newShare: 0.6, pipelineShare: 0.4 };

  const rows = computeDealShareBlockRows_(
    inputs, dealShareRatios, pipelineShareRatios, p1ValueByGroup, newPipelineSplit
  );

  const seminarRow = rows[0];

  const expectedNewP1Target = (1000000 * 0.6 * 0.5) / 1000; // 300
  const expectedPipelineP1Target = (1000000 * 0.4 * 0.2) / 500; // 160

  const pass =
    seminarRow.group === "Seminar" &&
    Math.abs(seminarRow.newP1Target - expectedNewP1Target) < 1e-6 &&
    Math.abs(seminarRow.pipelineP1Target - expectedPipelineP1Target) < 1e-6 &&
    Math.abs(seminarRow.totalP1Target - (expectedNewP1Target + expectedPipelineP1Target)) < 1e-6;

  Logger.log("Seminar newP1Target: " + seminarRow.newP1Target + " (expected " + expectedNewP1Target + ")");
  Logger.log("Seminar pipelineP1Target: " + seminarRow.pipelineP1Target + " (expected " + expectedPipelineP1Target + ")");
  Logger.log("Seminar totalP1Target: " + seminarRow.totalP1Target);
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Even Seasonality For Months (활성 월에 균등 분배, 비활성 월은 0)
 *
 * WHY (2026-07-30, Seminar 캠페인 월 예외)
 * Seminar처럼 캠페인이 1년 내내가 아니라 특정 달에만 진행되는 세그먼트는
 * Block A의 과거 실적 기반 시즌성(FY24:25:26 가중평균 New P1 비중)을 그대로
 * 쓰면 캠페인이 없는 달에도 New P1 Target이 생겨 비현실적이다(사용자 지적:
 * "Seminar는 FY27 Oct/Jan/Apr 3회만 개최, 캠페인은 행사 30일 전 시작 —
 * Aug/Nov 등 비캠페인 월에 Target New P1이 있는 건 nonsense"). 활성 월
 * 목록(CONFIG.TARGET.SEMINAR_CAMPAIGN_MONTHS)만 주어지면 그 안에서 균등
 * 분배하고 나머지 달은 0으로 채운다 — computeTargetDerivationRows_()가
 * Seminar 그룹의 월별 분배에만 이 함수를 쓰고, Block A 자체(과거 실적
 * 벤치마크 표시)는 건드리지 않는다(참고 지표로서의 실측 시즌성은 그대로 유지).
 *
 * @param {Array<string>} activeMonths  CONFIG.ACQ.FISCAL_MONTH_ORDER 라벨 목록(예: ["SEP","OCT",...])
 * @return {Object}  month -> weight (활성 월 합 = 1, 12개월 전부 키 존재)
 * ==========================================================
 */
function computeEvenSeasonalityForMonths_(activeMonths){

  const result = {};
  const weight = activeMonths.length > 0 ? 1 / activeMonths.length : 0;

  CONFIG.ACQ.FISCAL_MONTH_ORDER.forEach(function(month){
    result[month] = activeMonths.indexOf(month) !== -1 ? weight : 0;
  });

  return result;

}


/**
 * Test: computeEvenSeasonalityForMonths_()
 */
function testComputeEvenSeasonalityForMonths(){

  const result = computeEvenSeasonalityForMonths_(["SEP", "OCT", "DEC", "JAN", "MAR", "APR"]);

  const activeSum = ["SEP", "OCT", "DEC", "JAN", "MAR", "APR"].reduce(function(sum, m){
    return sum + result[m];
  }, 0);

  const pass =
    Math.abs(result.SEP - 1 / 6) < 1e-9 &&
    result.AUG === 0 &&
    result.NOV === 0 &&
    Math.abs(activeSum - 1) < 1e-9 &&
    Object.keys(result).length === CONFIG.ACQ.FISCAL_MONTH_ORDER.length;

  Logger.log("SEP weight: " + result.SEP + " (expected " + (1 / 6) + ")");
  Logger.log("AUG weight: " + result.AUG + " (expected 0)");
  Logger.log("Active months sum: " + activeSum + " (expected 1)");
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Target Derivation Rows (Block D — FY→월→주 목표 전개)
 *
 * WHY (2026-07-27 New/Pipeline 2트랙 확정 — CLAUDE.md #7 최종 결정)
 * FY P1 목표는 이제 Block C(computeDealShareBlockRows_)에서 New 트랙(코호트1
 * 비율÷a)과 Pipeline 트랙(코호트2 비율÷b)을 각각 계산해 들어온다 — a/b를
 * 어떻게 합칠지 미정이라 a만 쓰던 placeholder는 폐기됨. 이 함수는 New/Pipeline
 * FY 목표를 **각각** 월별 시즌성 비중(②)·주별 균등 분배(③)로 전개한다(합계로
 * 뭉쳐서 전개한 뒤 나누는 게 아니라, 처음부터 트랙별로 따로 전개 — 사용자
 * 요청, 2026-07-27: Target_REP에 New/Pipeline이 분리 표시돼야 함). 두 트랙
 * 모두 같은 시즌성 %를 적용한다(트랙별 다른 시즌성 커브는 아직 미정).
 * weeklyP1Target(합계)는 New+Pipeline을 더한 값으로 계속 유지 — 기존
 * 달성%(Actual÷Target) 계산의 분모로 쓰임.
 *
 * @param {number} targetFY
 * @param {Array<Object>} benchmarkRows
 * @param {Array<Object>} dealShareRows  computeDealShareBlockRows_() 결과(newP1Target/pipelineP1Target 포함)
 * @param {Object} inputs
 * @return {Array<Object>}
 * ==========================================================
 */
function computeTargetDerivationRows_(targetFY, benchmarkRows, dealShareRows, inputs){

  const weeks = generateCalendarWeeksForFY_(targetFY);
  const weeksInMonthCounts = computeWeeksInMonthCounts_(weeks);

  const benchmarkByGroupMonth = {};

  benchmarkRows.forEach(function(row){
    benchmarkByGroupMonth[row.group + "|" + row.month] = row;
  });

  const improvementFactorByGroup = inputs.improvementFactorByGroup || {};

  const fyNewP1TargetByGroup = {};
  const fyPipelineP1TargetByGroup = {};

  dealShareRows.forEach(function(row){
    fyNewP1TargetByGroup[row.group] = row.newP1Target;
    fyPipelineP1TargetByGroup[row.group] = row.pipelineP1Target;
  });

  // Seminar 전용 예외(2026-07-30 사용자 확정, 같은 날 CONFIG 하드코딩 → Block 0 체크박스로
  // 전환) — 과거 실적 기반 시즌성 대신 사용자가 시트에서 직접 체크한 활성 캠페인 월
  // (inputs.seminarActiveMonths, Block 0 섹션 5 SEMINAR_ACTIVE_MONTHS)에만 균등 분배한다.
  // Block A의 시즌성 표시 자체는 건드리지 않고, 이 함수 내 월별 New/Pipeline P1 Target
  // 분배에만 적용 — computeEvenSeasonalityForMonths_() WHY 참고.
  const seminarSeasonalityByMonth = computeEvenSeasonalityForMonths_(
    inputs.seminarActiveMonths || []
  );

  const monthlyNewP1TargetCache = {};
  const monthlyPipelineP1TargetCache = {};
  const monthlyCPNP1TargetCache = {};

  const rows = [];

  weeks.forEach(function(week){

    CONFIG.TARGET.GROUP_ORDER.forEach(function(group){

      const benchmark = benchmarkByGroupMonth[group + "|" + week.month] ||
        { seasonalityPct: 0, cpnp1Benchmark: 0 };

      const monthKey = group + "|" + week.fy + "|" + week.month;

      if(monthlyNewP1TargetCache[monthKey] === undefined){

        // New/Pipeline 둘 다 같은 시즌성 비중을 적용한다 — 트랙별로 다른 시즌성
        // 커브를 쓸지는 아직 미정, 필요시 후속 논의(§6 참고). Seminar만 Block A의
        // 실적 기반 시즌성 대신 활성 캠페인 월 균등 분배로 대체한다.
        const seasonalityPct = group === "Seminar"
          ? (seminarSeasonalityByMonth[week.month] || 0)
          : benchmark.seasonalityPct;

        monthlyNewP1TargetCache[monthKey] = computeMonthlyP1Target_(
          fyNewP1TargetByGroup[group],
          seasonalityPct
        );

        monthlyPipelineP1TargetCache[monthKey] = computeMonthlyP1Target_(
          fyPipelineP1TargetByGroup[group],
          seasonalityPct
        );

        // WHY (2026-07-30 버그 수정 — 사용자 리포트: "Target P1이 0인데 CPNP1은 채워져
        // 있다") — CPNP1 Target(cpnp1Benchmark × 개선계수)은 seasonalityPct와 무관하게
        // Block A의 과거 실적 벤치마크만 보고 계산돼서, Seminar 비활성 월(New/Pipeline
        // Target이 0으로 강제된 달)에도 그 달 과거 벤치마크가 있으면 그대로 값이 찍혔다.
        // Target이 없는 달에 "목표 단가"가 존재하는 건 의미가 없으므로, Seminar
        // 비활성 월은 CPNP1 Target도 0으로 맞춘다(New/Pipeline과 동일한 게이트).
        const isSeminarInactiveMonth = group === "Seminar" && seasonalityPct === 0;

        monthlyCPNP1TargetCache[monthKey] = isSeminarInactiveMonth
          ? 0
          : computeMonthlyCPNP1Target_(benchmark.cpnp1Benchmark, improvementFactorByGroup[group] || 1);

      }

      const weeksInMonth = weeksInMonthCounts[week.fy + "|" + week.month] || 1;

      const weeklyNewP1Target = computeWeeklyP1Target_(monthlyNewP1TargetCache[monthKey], weeksInMonth);
      const weeklyPipelineP1Target = computeWeeklyP1Target_(monthlyPipelineP1TargetCache[monthKey], weeksInMonth);

      rows.push({
        weekStart: week.weekStart,
        weekEnd: week.weekEnd,
        fy: week.fy,
        month: week.month,
        group: group,
        monthlyNewP1Target: monthlyNewP1TargetCache[monthKey],
        monthlyPipelineP1Target: monthlyPipelineP1TargetCache[monthKey],
        monthlyP1Target: monthlyNewP1TargetCache[monthKey] + monthlyPipelineP1TargetCache[monthKey],
        weeklyNewP1Target: weeklyNewP1Target,
        weeklyPipelineP1Target: weeklyPipelineP1Target,
        weeklyP1Target: weeklyNewP1Target + weeklyPipelineP1Target,
        monthlyCPNP1Target: monthlyCPNP1TargetCache[monthKey],
        weeklyCPNP1Target: monthlyCPNP1TargetCache[monthKey]
      });

    });

  });

  return rows;

}


/**
 * ==========================================================
 * TEST — computeTargetDerivationRows_() (합성 데이터, 공식 체인 통합 검증)
 * ==========================================================
 */
function testComputeTargetDerivationRows(){

  // 2026-07-30 세그먼트 분해: CONFIG.TARGET.GROUP_ORDER가 실제로 5세그먼트라
  // 픽스처도 그 이름(Seminar/Webinar/BOFU/Search/Content)을 그대로 써야
  // computeTargetDerivationRows_() 내부의 GROUP_ORDER.forEach가 이 데이터를 찾는다.
  // AUG는 seminarActiveMonths 픽스처(아래 inputs)에 없는 비활성 월, OCT는 활성 월 —
  // Seminar 전용 균등 분배 오버라이드(2026-07-30, Block 0 체크박스 기반) 검증용으로 둘 다 포함.
  const benchmarkRows = [
    { group: "Seminar", month: "AUG", seasonalityPct: 0.5, cpnp1Benchmark: 500 },
    { group: "Seminar", month: "OCT", seasonalityPct: 0.1, cpnp1Benchmark: 600 },
    { group: "Webinar", month: "AUG", seasonalityPct: 0.5, cpnp1Benchmark: 300 },
    { group: "BOFU", month: "AUG", seasonalityPct: 0.5, cpnp1Benchmark: 100 },
    { group: "Search", month: "AUG", seasonalityPct: 0.5, cpnp1Benchmark: 120 },
    { group: "Content", month: "AUG", seasonalityPct: 0.5, cpnp1Benchmark: 50 }
  ];

  const dealShareRows = [
    { group: "Seminar", dealShare: 0.5, pipelineShare: 0.5, newP1Target: 500, pipelineP1Target: 200, totalP1Target: 700 },
    { group: "Webinar", dealShare: 0.2, pipelineShare: 0.2, newP1Target: 200, pipelineP1Target: 100, totalP1Target: 300 },
    { group: "BOFU", dealShare: 0.15, pipelineShare: 0.15, newP1Target: 150, pipelineP1Target: 50, totalP1Target: 200 },
    { group: "Search", dealShare: 0.1, pipelineShare: 0.1, newP1Target: 100, pipelineP1Target: 50, totalP1Target: 150 },
    { group: "Content", dealShare: 0.2, pipelineShare: 0.2, newP1Target: 200, pipelineP1Target: 400, totalP1Target: 600 }
  ];

  const inputs = {
    revenueTarget: 1000000,
    improvementFactorByGroup: {
      Seminar: 0.9, Webinar: 0.9, BOFU: 0.9, Search: 0.9, Content: 0.9
    },
    seminarActiveMonths: ["SEP", "OCT", "DEC", "JAN", "MAR", "APR"]
  };

  const rows = computeTargetDerivationRows_(27, benchmarkRows, dealShareRows, inputs);

  const augSeminarRows = rows.filter(function(r){ return r.group === "Seminar" && r.month === "AUG"; });
  const octSeminarRows = rows.filter(function(r){ return r.group === "Seminar" && r.month === "OCT"; });
  const augWebinarRows = rows.filter(function(r){ return r.group === "Webinar" && r.month === "AUG"; });

  // Webinar(오버라이드 대상 아님)는 그대로 benchmark.seasonalityPct(0.5)를 써야 한다 — 통제군.
  const expectedAugWebinarMonthlyNewTarget = 200 * 0.5; // 100

  // Seminar는 inputs.seminarActiveMonths 6개월에 균등 분배 — AUG(비활성)는 New/Pipeline/
  // CPNP1 Target 전부 0이어야 한다(2026-07-30 버그 수정 — 예전엔 CPNP1만 비활성 월에도
  // 값이 남아있었음, 사용자 리포트). OCT(활성)는 New/Pipeline은 FY Target × 1/6, CPNP1은
  // Block A 벤치마크(600) × 개선계수(0.9) = 540 그대로 계산돼야 한다. Block A의 실적
  // 기반 seasonalityPct(0.5/0.1)는 Seminar에 한해 무시된다.
  const expectedSeminarActiveWeight = 1 / inputs.seminarActiveMonths.length;
  const expectedOctSeminarMonthlyNewTarget = 500 * expectedSeminarActiveWeight;
  const expectedOctSeminarMonthlyPipelineTarget = 200 * expectedSeminarActiveWeight;
  const expectedOctSeminarMonthlyCPNP1Target = 600 * 0.9; // 540

  const pass =
    (augSeminarRows.length === 4 || augSeminarRows.length === 5) &&
    augSeminarRows[0].monthlyNewP1Target === 0 &&
    augSeminarRows[0].monthlyPipelineP1Target === 0 &&
    augSeminarRows[0].monthlyCPNP1Target === 0 &&
    Math.abs(octSeminarRows[0].monthlyNewP1Target - expectedOctSeminarMonthlyNewTarget) < 1e-6 &&
    Math.abs(octSeminarRows[0].monthlyPipelineP1Target - expectedOctSeminarMonthlyPipelineTarget) < 1e-6 &&
    Math.abs(octSeminarRows[0].monthlyCPNP1Target - expectedOctSeminarMonthlyCPNP1Target) < 1e-6 &&
    Math.abs(augWebinarRows[0].monthlyNewP1Target - expectedAugWebinarMonthlyNewTarget) < 1e-6;

  Logger.log("AUG Seminar monthlyNewP1Target: " + augSeminarRows[0].monthlyNewP1Target + " (expected 0, 비활성 월)");
  Logger.log("AUG Seminar monthlyCPNP1Target: " + augSeminarRows[0].monthlyCPNP1Target + " (expected 0, 비활성 월 — 2026-07-30 버그 수정)");
  Logger.log("OCT Seminar monthlyCPNP1Target: " + octSeminarRows[0].monthlyCPNP1Target + " (expected " + expectedOctSeminarMonthlyCPNP1Target + ")");
  Logger.log("OCT Seminar monthlyNewP1Target: " + octSeminarRows[0].monthlyNewP1Target + " (expected " + expectedOctSeminarMonthlyNewTarget + ")");
  Logger.log("AUG Seminar monthlyCPNP1Target: " + augSeminarRows[0].monthlyCPNP1Target + " (expected 450, seasonality와 무관)");
  Logger.log("AUG Webinar monthlyNewP1Target: " + augWebinarRows[0].monthlyNewP1Target + " (expected " + expectedAugWebinarMonthlyNewTarget + ", 오버라이드 미적용 통제군)");
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Read Target Engine Inputs (Block 0 — 읽기 전용)
 *
 * WHY (2026-07-27 성능 수정)
 * 셀 9개를 개별 getValue()로 읽으면 대용량 워크북(Leads_OPS 3만5천+행 등)에서
 * 왕복 호출마다 지연이 누적돼 타임아웃("Service Spreadsheets timed out")이
 * 발생함(실측). Block 0 값 컬럼 전체를 getValues() 1회로 읽어 메모리에서
 * 인덱싱한다 (Article 10: Read Once 원칙, setupTargetEngineInputDefaults_()도 동일).
 * ==========================================================
 */
function readTargetEngineInputs_(sheet){

  const input = CONFIG.TARGET.INPUT;
  const rows = input.ROWS;
  const groupOrder = CONFIG.TARGET.GROUP_ORDER;
  const monthOrder = CONFIG.ACQ.FISCAL_MONTH_ORDER;
  const col = input.VALUE_COL;
  const lastRow = input.LAST_ROW;
  const defaults = input.DEFAULTS;

  // 섹션 1(스칼라)은 VALUE_COL 단일 컬럼이라 한 번의 getRange로 읽는다. 섹션 2(CPNP1
  // 벤치마크)는 더 이상 입력이 아니라 계산 결과라 여기서 읽지 않음(v1.19.0 —
  // computeCPNP1BenchmarkByGroup_()/writeTargetEngineCPNP1BenchmarkValues_() 참고).
  const values = sheet.getRange(1, col, lastRow, 1).getValues();
  const get = function(row){ return values[row - 1][0]; };

  const improvementFactorByGroup = {};
  const dealShareByGroup = {};

  groupOrder.forEach(function(group, i){
    improvementFactorByGroup[group] = Number(get(rows.IMPROVEMENT_FACTOR_START + i)) || 0;
    dealShareByGroup[group] = Number(get(rows.DEAL_SHARE_START + i)) || 0;
  });

  // 섹션 3(월별 회사 전체 Revenue Target/Budget)+섹션 4(세그먼트별 월별 Spent)+섹션 5
  // (Seminar Active Campaign Months 체크박스)는 전부 MONTH_START_COL부터 12개월 폭이고
  // 연속된 행 범위(헤더 행 포함, 섹션 사이 공백 행 1개)라 한 번의 getRange로 같이 읽는다.
  const gridStartRow = input.MONTHLY_COMPANY_INPUTS.HEADER_ROW;
  const gridEndRow = input.SEMINAR_ACTIVE_MONTHS.ROW;
  const gridValues = sheet.getRange(
    gridStartRow, input.MONTHLY_COMPANY_INPUTS.MONTH_START_COL,
    gridEndRow - gridStartRow + 1, monthOrder.length
  ).getValues();

  const getGridCell = function(row, colIndex){
    return gridValues[row - gridStartRow][colIndex];
  };

  const monthlyRevenueTarget = {};
  const monthlyBudget = {};

  monthOrder.forEach(function(month, i){
    monthlyRevenueTarget[month] = Number(getGridCell(input.MONTHLY_COMPANY_INPUTS.REVENUE_TARGET_ROW, i)) || 0;
    monthlyBudget[month] = Number(getGridCell(input.MONTHLY_COMPANY_INPUTS.BUDGET_ROW, i)) || 0;
  });

  const monthlySegmentSpent = {};

  groupOrder.forEach(function(group, gi){

    const row = input.MANUAL_SEGMENT_SPENT.DATA_START_ROW + gi;
    const byMonth = {};

    monthOrder.forEach(function(month, mi){
      byMonth[month] = Number(getGridCell(row, mi)) || 0;
    });

    monthlySegmentSpent[group] = byMonth;

  });

  // 섹션 5 — Seminar Active Campaign Months(체크박스). 체크(true)된 달만 활성 월로 취급 —
  // computeTargetDerivationRows_()가 Seminar 그룹 월별 배분에 직접 씀(00_Config.js
  // INPUT.SEMINAR_ACTIVE_MONTHS 참고).
  const seminarActiveMonths = monthOrder.filter(function(month, mi){
    return getGridCell(input.SEMINAR_ACTIVE_MONTHS.ROW, mi) === true;
  });

  // revenueTarget(연간 합계) — 기존 §6 top-down 공식 체인(computeDealShareBlockRows_())의
  // 하위호환용. 월별 실제 값이 도입되며 스칼라 입력은 폐기됐지만, 그 체인 자체를
  // 대체하는 예산 기반 도출 체인은 아직 설계 확정 전이라(exec-plan Decision Log 참고)
  // 당분간 월별 합계로 대체해 기존 계산이 계속 동작하게 한다.
  const revenueTarget = monthOrder.reduce(function(sum, m){
    return sum + monthlyRevenueTarget[m];
  }, 0);

  return {
    targetFY: Number(get(rows.TARGET_FY)) || defaults.TARGET_FY,
    cutoverDate: get(rows.CUTOVER_DATE),
    improvementFactorByGroup: improvementFactorByGroup,
    dealShareByGroup: dealShareByGroup,
    revenueTarget: revenueTarget,
    monthlyRevenueTarget: monthlyRevenueTarget,
    monthlyBudget: monthlyBudget,
    monthlySegmentSpent: monthlySegmentSpent,
    seminarActiveMonths: seminarActiveMonths
  };

}


/**
 * ==========================================================
 * Setup Target Engine Input Defaults (최초 1회 — 기존 값 있으면 보존)
 *
 * WHY
 * Block 0은 "절대 덮어쓰지 않는" 영역(docs/TargetReportDesign.md §9) —
 * 라벨은 항상 다시 쓰되, 값은 비어있을 때만 기본값을 채운다.
 *
 * WHY (2026-07-27 성능 수정)
 * 행 9개 × (getValue 1 + setValue 최대 2) = 최대 27회의 개별 Range 호출이
 * 대용량 워크북에서 "Service Spreadsheets timed out" 에러를 유발함(실측,
 * setupTargetReport() 최초 실행 중 발생). 라벨 컬럼/값 컬럼을 각각
 * getValues()/setValues() 1회씩으로 배치 처리 — 총 1회 읽기 + 2회 쓰기로 축소.
 * ==========================================================
 */
function setupTargetEngineInputDefaults_(sheet){

  const input = CONFIG.TARGET.INPUT;
  const rows = input.ROWS;
  const groupOrder = CONFIG.TARGET.GROUP_ORDER;
  const labelCol = input.LABEL_COL;
  const valueCol = input.VALUE_COL;
  const lastRow = input.LAST_ROW;
  const defaults = input.DEFAULTS;

  const entries = [
    [rows.TARGET_FY, "Target FY", defaults.TARGET_FY],
    [rows.CUTOVER_DATE, "Week Cycle Cutover Date", CONFIG.TARGET.CUTOVER_DATE]
  ];

  groupOrder.forEach(function(group, i){
    entries.push([
      rows.IMPROVEMENT_FACTOR_START + i,
      "Improvement Factor - " + group,
      defaults.IMPROVEMENT_FACTOR
    ]);
  });

  groupOrder.forEach(function(group, i){
    entries.push([
      rows.DEAL_SHARE_START + i,
      "Deal Share - " + group + " (임시 수동 — 딜트래커 접근 실패 시 Fallback)",
      defaults.DEAL_SHARE
    ]);
  });

  // 값 자체는 이 entries의 default(0)가 아니라 refreshTargetEngine_()가
  // computeCPNP1BenchmarkByGroup_() 결과로 매번 덮어씀 — 여기선 라벨과 최초 실행 전
  // placeholder(0)만 담당(v1.19.0, CPNP1_BENCHMARK_MANUAL → CPNP1_BENCHMARK로 이름 변경).
  groupOrder.forEach(function(group, i){
    entries.push([
      input.CPNP1_BENCHMARK.DATA_START_ROW + i,
      "FY" + CONFIG.TARGET.P1_VALUE_FY + " CPNP1 Benchmark - " + group + " (자동 계산)",
      0
    ]);
  });

  const existingValues = sheet.getRange(1, valueCol, lastRow, 1).getValues();

  const labelColumn = [];
  const valueColumn = [];

  for(let row = 1; row <= lastRow; row++){
    labelColumn.push([""]);
    valueColumn.push([existingValues[row - 1][0]]);
  }

  entries.forEach(function(entry){

    const row = entry[0];
    const existingValue = existingValues[row - 1][0];

    labelColumn[row - 1] = [entry[1]];

    if(existingValue === "" || existingValue === null){
      valueColumn[row - 1] = [entry[2]];
    }

  });

  labelColumn[input.CPNP1_BENCHMARK.HEADER_ROW - 1] =
    ["FY" + CONFIG.TARGET.P1_VALUE_FY + " CPNP1 Benchmark by Segment (자동 계산 = 월별 Segment Spent 합 ÷ FY" +
     CONFIG.TARGET.P1_VALUE_FY + " Segment New P1 합, 예산 기반 도출 체인 전용)"];

  sheet.getRange(1, labelCol, lastRow, 1).setValues(labelColumn);
  sheet.getRange(1, valueCol, lastRow, 1).setValues(valueColumn);

  setupTargetEngineMonthlyGridDefaults_(sheet);
  applyTargetEngineInputStyles_(sheet); // 92_TargetStyles.js — 숫자 서식(천단위 콤마, $/%는 소수점 2자리)

}


/**
 * ==========================================================
 * Setup Target Engine Monthly Grid Defaults (Block 0 섹션 3·4 — 월별 그리드)
 *
 * WHY
 * 월별 회사 전체 Revenue Target/Budget(섹션 3)과 세그먼트별 월별 실제 Spent
 * (섹션 4)는 Label=A열 단일 셀이 아니라 12개월(B..M열) 그리드라 스칼라 섹션과
 * 별도 함수로 분리. setupTargetEngineInputDefaults_()와 동일하게 "값은 비어있을
 * 때만 채운다"(보존형) 원칙을 그대로 따른다 — 2026-07-30 세그먼트 분해/예산
 * 반영으로 신규 도입. docs/exec-plans/active/2026-07-30-target-rep-segment-breakdown.md 참고.
 *
 * WHY (2026-07-30 섹션 5 — Seminar Active Campaign Months 체크박스 추가)
 * Seminar 캠페인 진행 월을 CONFIG 하드코딩(SEMINAR_CAMPAIGN_MONTHS)으로 관리하면
 * 계획이 바뀔 때마다 코드를 고쳐야 해서, 사용자가 시트에서 직접 체크/해제하는 방식을
 * 요청 — insertCheckboxes()로 체크박스 UI 생성. insertCheckboxes()는 값이 없는 셀을
 * unchecked(false)로 초기화해버리므로(빈 셀이 사라짐), "최초 실행인지" 판정은 반드시
 * insertCheckboxes() 호출 **전에** 먼저 해야 한다 — 그렇지 않으면 재실행 때마다
 * "비어있음"으로 오판해 사용자가 체크한 값을 계속 기본값으로 되돌리는 버그가 생긴다.
 * ==========================================================
 */
function setupTargetEngineMonthlyGridDefaults_(sheet){

  const input = CONFIG.TARGET.INPUT;
  const groupOrder = CONFIG.TARGET.GROUP_ORDER;
  const monthOrder = CONFIG.ACQ.FISCAL_MONTH_ORDER;
  const labelCol = input.LABEL_COL;
  const monthStartCol = input.MONTHLY_COMPANY_INPUTS.MONTH_START_COL;

  const headerRow = input.MONTHLY_COMPANY_INPUTS.HEADER_ROW;
  const revenueRow = input.MONTHLY_COMPANY_INPUTS.REVENUE_TARGET_ROW;
  const budgetRow = input.MONTHLY_COMPANY_INPUTS.BUDGET_ROW;
  const spentHeaderRow = input.MANUAL_SEGMENT_SPENT.HEADER_ROW;
  const spentStartRow = input.MANUAL_SEGMENT_SPENT.DATA_START_ROW;

  // 월 헤더(AUG..JUL) — 두 섹션 헤더 행에 동일하게 기록 (매번 덮어써도 무방, 라벨성 데이터).
  sheet.getRange(headerRow, monthStartCol, 1, monthOrder.length).setValues([monthOrder]);
  sheet.getRange(spentHeaderRow, monthStartCol, 1, monthOrder.length).setValues([monthOrder]);

  const labelEntries = [
    [headerRow, "Monthly Company-wide Inputs (실제 값)"],
    [revenueRow, "Marketing Revenue Target (NZD)"],
    [budgetRow, "Total Ad Budget (NZD)"],
    [spentHeaderRow, "Monthly Segment Spent (NZD, 수동 취합)"]
  ];

  groupOrder.forEach(function(group, i){
    labelEntries.push([spentStartRow + i, group + " Spent"]);
  });

  labelEntries.forEach(function(entry){
    sheet.getRange(entry[0], labelCol).setValue(entry[1]);
  });

  // 값 셀 — 비어있을 때만 0으로 초기화(보존형). Revenue Target/Budget 행 + 세그먼트별
  // Spent 행을 한 번의 getRange/setValues로 처리(Article 10: Read Once).
  const dataRows = [revenueRow, budgetRow].concat(
    groupOrder.map(function(g, i){ return spentStartRow + i; })
  );

  const minRow = Math.min.apply(null, dataRows);
  const maxRow = Math.max.apply(null, dataRows);
  const numRows = maxRow - minRow + 1;

  const existing = sheet.getRange(minRow, monthStartCol, numRows, monthOrder.length).getValues();

  dataRows.forEach(function(row){

    const rowValues = existing[row - minRow];

    for(let c = 0; c < monthOrder.length; c++){
      if(rowValues[c] === "" || rowValues[c] === null){
        rowValues[c] = 0;
      }
    }

  });

  sheet.getRange(minRow, monthStartCol, numRows, monthOrder.length).setValues(existing);

  // 섹션 5 — Seminar Active Campaign Months(체크박스, row 32). 불리언 값이라 위 숫자
  // dataRows 배치와 별도 처리 — "비어있는지" 판정을 insertCheckboxes() 호출 전에 먼저
  // 해야 하는 이유는 위 함수 WHY 참고.
  const seminarRow = input.SEMINAR_ACTIVE_MONTHS.ROW;
  const seminarRange = sheet.getRange(seminarRow, monthStartCol, 1, monthOrder.length);

  sheet.getRange(seminarRow, labelCol).setValue(
    "Seminar Active Campaign Months (체크된 달만 캠페인 진행 — Target New/Pipeline P1 배분에 반영)"
  );

  const seminarExisting = seminarRange.getValues()[0];
  const seminarIsBlank = seminarExisting.every(function(v){ return v === "" || v === null; });

  if(seminarIsBlank){

    seminarRange.insertCheckboxes();

    const seminarDefaults = input.DEFAULTS.SEMINAR_ACTIVE_MONTHS;
    const seminarDefaultRow = monthOrder.map(function(month){
      return seminarDefaults.indexOf(month) !== -1;
    });

    seminarRange.setValues([seminarDefaultRow]);

  }

}


/**
 * ==========================================================
 * Write Target Engine Block (Block A~D 공통 — clear 후 재작성)
 *
 * WHY
 * 매 재계산마다 행 수가 달라질 수 있어(예: FY마다 52/53주), 헤더 아래
 * 넉넉한 범위(2000행)를 먼저 비운 뒤 실제 데이터만큼만 다시 쓴다.
 * ==========================================================
 */
function writeTargetEngineBlock_(sheet, startCol, headers, matrix){

  const MAX_CLEAR_ROWS = 2000;

  sheet.getRange(1, startCol, MAX_CLEAR_ROWS, headers.length).clearContent();

  sheet.getRange(1, startCol, 1, headers.length).setValues([headers]);

  if(matrix.length > 0){

    sheet.getRange(2, startCol, matrix.length, headers.length).setValues(matrix);

  }

}


/**
 * ==========================================================
 * Build Block Headers (CONFIG 기반 — FY 라벨 하드코딩 금지)
 * ==========================================================
 */
function buildTargetBenchmarkHeaders_(){

  return ["Group", "Month"]
    .concat(CONFIG.TARGET.BENCHMARK.NEWP1_FYS.map(function(fy){ return "FY" + fy + " New P1"; }))
    .concat(["Weighted Avg New P1", "Seasonality %", "CPNP1 Benchmark"]);

}

function buildTargetP1ValueHeaders_(){

  const fy = CONFIG.TARGET.P1_VALUE_FY;

  return [
    "Group",
    "FY" + fy + " New P1 Count",
    "Cohort1 Revenue (R1, Created=Closed=FY" + fy + ")",
    "CurrentFYP1V (a = R1 / New P1)",
    "Prev P1 Count (all-time − FY" + fy + " New)",
    "Cohort2 Revenue (R2, Closed=FY" + fy + " only)",
    "PrevP1V (b = R2 / Prev P1)"
  ];

}

function buildTargetDealShareHeaders_(){

  return [
    "Group",
    "Deal Share (R1, New Track)",
    "Pipeline Share (R2, Pipeline Track)",
    "FY New P1 Target",
    "FY Pipeline P1 Target",
    "FY Total P1 Target"
  ];

}

function buildTargetDerivationHeaders_(){

  return [
    "Week Start", "Week End", "Month", "Group",
    "Month New P1 Target", "Week New P1 Target",
    "Month Pipeline P1 Target", "Week Pipeline P1 Target",
    "Month Target P1", "Week Target P1",
    "Month CPNP1 Benchmark", "Week Target CPNP1"
  ];

}


/**
 * ==========================================================
 * Convert Block Rows -> Sheet Matrix
 * ==========================================================
 */
function targetBenchmarkRowsToMatrix_(rows){

  return rows.map(function(r){
    return [r.group, r.month].concat(r.newP1ByFY).concat([r.weightedAvgNewP1, r.seasonalityPct, r.cpnp1Benchmark]);
  });

}

function targetP1ValueRowsToMatrix_(rows){

  return rows.map(function(r){
    return [
      r.group,
      r.newP1Count, r.cohort1Revenue, r.currentFYP1V,
      r.prevP1Count, r.cohort2Revenue, r.prevP1V
    ];
  });

}

function targetDealShareRowsToMatrix_(rows){

  return rows.map(function(r){
    return [r.group, r.dealShare, r.pipelineShare, r.newP1Target, r.pipelineP1Target, r.totalP1Target];
  });

}

function targetDerivationRowsToMatrix_(rows){

  return rows.map(function(r){

    return [
      r.weekStart, r.weekEnd,
      r.month, // FY 접두사 없이 월 라벨만(예: "AUG") — 사용자 요청, 2026-07-27
      r.group,
      r.monthlyNewP1Target, r.weeklyNewP1Target,
      r.monthlyPipelineP1Target, r.weeklyPipelineP1Target,
      r.monthlyP1Target, r.weeklyP1Target,
      r.monthlyCPNP1Target, r.weeklyCPNP1Target
    ];

  });

}


/**
 * ==========================================================
 * Write Target Engine CPNP1 Benchmark Values (Block 0 CPNP1_BENCHMARK 섹션 — 계산값 기록)
 *
 * WHY
 * computeCPNP1BenchmarkByGroup_() 결과를 Block 0의 CPNP1_BENCHMARK VALUE_COL 셀에
 * 쓴다. 라벨은 setupTargetEngineInputDefaults_()가 이미 써두므로 여기선 값만 기록.
 * Block 0의 다른 섹션과 달리 이 섹션은 "값이 비어있을 때만 채움"이 아니라 매번
 * 무조건 덮어쓴다 — 더 이상 사용자 입력이 아니라 계산 결과이기 때문(2026-07-30).
 *
 * @param {Sheet} sheet
 * @param {Object} cpnp1BenchmarkByGroup  group -> CPNP1 벤치마크 (computeCPNP1BenchmarkByGroup_() 결과)
 * ==========================================================
 */
function writeTargetEngineCPNP1BenchmarkValues_(sheet, cpnp1BenchmarkByGroup){

  const input = CONFIG.TARGET.INPUT;
  const groupOrder = CONFIG.TARGET.GROUP_ORDER;

  const values = groupOrder.map(function(group){
    return [cpnp1BenchmarkByGroup[group] || 0];
  });

  sheet.getRange(input.CPNP1_BENCHMARK.DATA_START_ROW, input.VALUE_COL, groupOrder.length, 1)
    .setValues(values);

}


/**
 * ==========================================================
 * Refresh Target Engine (전체 재계산 → Target_Engine 시트에 저장)
 *
 * WHY
 * Generate 체크박스(91_TargetReport.js)를 누르면 이 함수가 먼저 실행되어
 * Block A~D를 전부 다시 계산/작성한 뒤, Target_REP가 이 시트를 조회해
 * 리포트를 그린다 (NewP1/Events Engine과 동일한 오케스트레이션 순서).
 * ==========================================================
 */
function refreshTargetEngine_(){

  const start = new Date();

  Logger.log(CONFIG.LOG.PREFIX + " Target Engine Refresh Started");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.TARGET.ENGINE_SHEET);

  if(!sheet){
    sheet = ss.insertSheet(CONFIG.TARGET.ENGINE_SHEET);
  }

  setupTargetEngineInputDefaults_(sheet);

  const inputs = readTargetEngineInputs_(sheet);

  const leadsAgg = computeTargetLeadsOPSAggregates_();
  const spentByGroupFYMonth = buildSpentByGroupFYMonthFromManualInput_(
    inputs.monthlySegmentSpent, CONFIG.TARGET.P1_VALUE_FY
  );

  // Block 0의 "절대 안 덮어씀" 원칙의 유일한 예외 — CPNP1_BENCHMARK 섹션(rows 14~19)은
  // 2026-07-30부터 수동 입력이 아니라 "월별 Segment Spent 합 ÷ FY26 Segment New P1 합"
  // 계산 결과라 매 refresh마다 여기서 덮어쓴다(사용자 확정, 00_Config.js 주석 참고).
  const cpnp1BenchmarkByGroup = computeCPNP1BenchmarkByGroup_(
    inputs.monthlySegmentSpent, leadsAgg.newP1CountByGroup, CONFIG.TARGET.GROUP_ORDER
  );
  writeTargetEngineCPNP1BenchmarkValues_(sheet, cpnp1BenchmarkByGroup);

  const benchmarkRows = computeBenchmarkBlockRows_(
    leadsAgg.newP1CountsByGroupFYMonth,
    spentByGroupFYMonth
  );

  // Deal Tracker는 Block B(코호트1/2 P1당 가치)와 Block C(코호트1/2 Deal Share +
  // New/Pipeline 2트랙 FY 목표) 전부에 쓰이므로 1회만 읽어(Article 10: Read Once) 재사용한다.
  const dealRows = readDealTrackerRawRows_();

  const dealCohortsByGroup = computeDealCohortsFromDealRows_(dealRows);
  const p1ValueRows = computeP1ValueBlockRows_(
    dealCohortsByGroup, leadsAgg.newP1CountByGroup, leadsAgg.totalP1CountByGroup
  );

  const p1ValueByGroup = {};
  p1ValueRows.forEach(function(row){
    p1ValueByGroup[row.group] = { currentFYP1V: row.currentFYP1V, prevP1V: row.prevP1V };
  });

  const dealShareRatios = dealRows.length > 0 ? computeDealShareRatiosFromDealRows_(dealRows) : null;
  const pipelineShareRatios = dealRows.length > 0 ? computeDealShareRatiosCohort2FromDealRows_(dealRows) : null;
  const newPipelineSplit = computeNewPipelineRevenueSplit_(dealRows);

  const dealShareRows = computeDealShareBlockRows_(
    inputs, dealShareRatios, pipelineShareRatios, p1ValueByGroup, newPipelineSplit
  );

  const derivationRows = computeTargetDerivationRows_(
    inputs.targetFY, benchmarkRows, dealShareRows, inputs
  );

  // Block C가 2컬럼→6컬럼으로 확장되며 Block D 시작 컬럼이 뒤로 밀림(2026-07-27)
  // — writeTargetEngineBlock_()는 자기 블록 너비만큼만 지우므로, 예전 Block D
  // 위치(X열~)에 남아있던 잔재가 안 지워질 수 있다. Block A~D 전체 영역을
  // 넉넉하게 먼저 비운 뒤 새로 쓴다(향후 블록 구조가 또 바뀌어도 동일하게 안전).
  //
  // clearContent()가 아니라 clear()를 쓴다 — 실측 확인(2026-07-27): 예전 Block D의
  // Week Start/Week End(X·Y열)가 Date 서식이 적용된 셀이었는데, 새 Block C의
  // FY New/Pipeline P1 Target이 같은 컬럼 위치를 차지하면서 clearContent()로는
  // 안 지워진 Date 서식이 그대로 남아 숫자값이 "12/30/1899" 같은 날짜로 잘못
  // 표시되는 버그 발생. clear()는 값+서식을 모두 지워 근본적으로 방지한다
  // (Target_Engine은 수식/수동 서식이 없는 순수 계산 시트라 안전).
  const WIDE_CLEAR_END_COL = 60;
  sheet.getRange(
    1, CONFIG.TARGET.ENGINE.BLOCK_A_START_COL, 2000,
    WIDE_CLEAR_END_COL - CONFIG.TARGET.ENGINE.BLOCK_A_START_COL + 1
  ).clear();

  writeTargetEngineBlock_(
    sheet, CONFIG.TARGET.ENGINE.BLOCK_A_START_COL,
    buildTargetBenchmarkHeaders_(), targetBenchmarkRowsToMatrix_(benchmarkRows)
  );

  writeTargetEngineBlock_(
    sheet, CONFIG.TARGET.ENGINE.BLOCK_B_START_COL,
    buildTargetP1ValueHeaders_(), targetP1ValueRowsToMatrix_(p1ValueRows)
  );

  writeTargetEngineBlock_(
    sheet, CONFIG.TARGET.ENGINE.BLOCK_C_START_COL,
    buildTargetDealShareHeaders_(), targetDealShareRowsToMatrix_(dealShareRows)
  );

  writeTargetEngineBlock_(
    sheet, CONFIG.TARGET.ENGINE.BLOCK_D_START_COL,
    buildTargetDerivationHeaders_(), targetDerivationRowsToMatrix_(derivationRows)
  );

  applyTargetEngineBlockStyles_(sheet); // 92_TargetStyles.js — Block A~D 숫자 서식(천단위 콤마, $/%는 소수점 2자리)

  SpreadsheetApp.flush();

  const seconds = ((new Date() - start) / 1000).toFixed(2);

  Logger.log(CONFIG.LOG.PREFIX + " Target Engine Refresh Completed (" + seconds + "s)");

}


/**
 * ==========================================================
 * TEMP — refreshTargetEngine_() 수동 실행용 공개 래퍼
 * ==========================================================
 */
function runRefreshTargetEngine(){

  refreshTargetEngine_();

}


/**
 * ==========================================================
 * Read Target Engine Derivation Rows (Block D 조회 — 91_TargetReport.js용)
 * ==========================================================
 */
function readTargetEngineDerivationRows_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.TARGET.ENGINE_SHEET);

  if(!sheet) return [];

  const startCol = CONFIG.TARGET.ENGINE.BLOCK_D_START_COL;
  const colCount = CONFIG.TARGET.ENGINE.BLOCK_D_COLUMNS;

  const lastRow = sheet.getLastRow();

  if(lastRow < 2) return [];

  const values = sheet.getRange(2, startCol, lastRow - 1, colCount).getValues();

  return values
    .filter(function(row){ return row[0] instanceof Date; })
    .map(function(row){

      return {
        weekStart: row[0],
        weekEnd: row[1],
        month: row[2],
        group: row[3],
        monthlyNewP1Target: row[4],
        weeklyNewP1Target: row[5],
        monthlyPipelineP1Target: row[6],
        weeklyPipelineP1Target: row[7],
        monthlyP1Target: row[8],
        weeklyP1Target: row[9],
        monthlyCPNP1Target: row[10],
        weeklyCPNP1Target: row[11]
      };

    });

}


/**
 * ==========================================================
 * Read Target Engine Deal Share Rows (Block C 조회 — ACQ_REP/NewP1_REP용)
 *
 * WHY (2026-07-30)
 * Block C(딜 비중)는 지금까지 쓰는 곳이 refreshTargetEngine_() 내부뿐이라
 * 시트에서 직접 읽는 리더가 없었음 — computeReportTargetLookup_()가 Revenue
 * Target 계산에 필요한 세그먼트 Deal Share(코호트1/R1/New 트랙)를 가져오기
 * 위해 신규 추가. Block D 리더(readTargetEngineDerivationRows_())와 동일 패턴
 * (그룹당 1행, GROUP_ORDER 순서 고정).
 * ==========================================================
 */
function readTargetEngineDealShareRows_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.TARGET.ENGINE_SHEET);

  if(!sheet) return [];

  const startCol = CONFIG.TARGET.ENGINE.BLOCK_C_START_COL;
  const colCount = CONFIG.TARGET.ENGINE.BLOCK_C_COLUMNS;
  const groupCount = CONFIG.TARGET.GROUP_ORDER.length;

  const lastRow = sheet.getLastRow();

  if(lastRow < 2) return [];

  const values = sheet.getRange(2, startCol, groupCount, colCount).getValues();

  return values
    .filter(function(row){ return row[0]; })
    .map(function(row){

      return {
        group: row[0],
        dealShare: row[1],
        pipelineShare: row[2],
        newP1Target: row[3],
        pipelineP1Target: row[4],
        totalP1Target: row[5]
      };

    });

}


/**
 * ==========================================================
 * Compute Report Target Lookup From Inputs (순수 함수 — ACQ_REP/NewP1_REP 공용)
 *
 * WHY (2026-07-30, docs/exec-plans/active/2026-07-30-acq-newp1-target-columns.md 참고)
 * ACQ_REP(Revenue Target)과 NewP1_REP(New P1 Target/Spent/CPNP1)이 각자
 * Target_Engine을 재스캔하지 않도록, Block 0 입력값/Block C 딜 비중/Block D
 * 목표 전개를 (targetFY|Month|Group) 키 하나로 병합해 한 번만 계산한다.
 *
 * - Revenue Target = 월별 회사 전체 Revenue Target × 세그먼트 Deal Share
 *   (dealShareRows의 dealShare, 코호트1/R1/New 트랙 — exec-plan Decision Log
 *   "Target 매핑" 참고). Pipeline Share는 이번 확장에서 안 씀(같은 exec-plan,
 *   Pipeline P1 Target 제외 결정과 동일 이유).
 * - New P1 Target = Block D의 monthlyNewP1Target — 주 단위로 반복 저장돼
 *   있어 (Group, Month) 조합당 첫 값만 채택(dedupe).
 * - Spent = Block 0 세그먼트별 월별 수동 Spent 그대로.
 * - Target_Engine은 한 번에 Target FY 하나만 갖고 있으므로, 그 FY 외의
 *   (Month, Segment) 조합은 키 자체가 없다 — "타겟 없음"과 "타겟 0"을
 *   구분하기 위해 소비 측은 반드시 hasOwnProperty로 조회할 것
 *   (computeCPNP1RatioByFYMonth_()의 기존 관례와 동일 이유).
 *
 * INPUT
 * inputs : Object  readTargetEngineInputs_() 반환값(targetFY/monthlyRevenueTarget/
 *   monthlySegmentSpent 사용)
 * dealShareRows : Array<Object>  readTargetEngineDealShareRows_() 반환값
 * derivationRows : Array<Object>  readTargetEngineDerivationRows_() 반환값
 *
 * OUTPUT
 * { targetFY, revenueTarget, newP1Target, spent }  각 맵의 키:
 *   targetFY + "|" + month + "|" + group
 *
 * TEST
 * testComputeReportTargetLookupFromInputs() 참고
 * ==========================================================
 */
function computeReportTargetLookupFromInputs_(inputs, dealShareRows, derivationRows){

  const dealShareByGroup = {};

  dealShareRows.forEach(function(r){
    dealShareByGroup[r.group] = r.dealShare;
  });

  const revenueTarget = {};
  const spent = {};

  CONFIG.TARGET.GROUP_ORDER.forEach(function(group){

    const groupSpent = inputs.monthlySegmentSpent[group] || {};

    CONFIG.ACQ.FISCAL_MONTH_ORDER.forEach(function(month){

      const key = inputs.targetFY + "|" + month + "|" + group;

      revenueTarget[key] =
        (inputs.monthlyRevenueTarget[month] || 0) * (dealShareByGroup[group] || 0);

      spent[key] = groupSpent[month] || 0;

    });

  });

  const newP1Target = {};
  const seenMonthGroup = {};

  derivationRows.forEach(function(row){

    const dedupeKey = row.group + "|" + row.month;

    if(seenMonthGroup[dedupeKey]) return;

    seenMonthGroup[dedupeKey] = true;

    newP1Target[inputs.targetFY + "|" + row.month + "|" + row.group] = row.monthlyNewP1Target;

  });

  return {
    targetFY: inputs.targetFY,
    revenueTarget: revenueTarget,
    newP1Target: newP1Target,
    spent: spent
  };

}


/**
 * ==========================================================
 * TEST — computeReportTargetLookupFromInputs_()
 * ==========================================================
 */
function testComputeReportTargetLookupFromInputs(){

  const inputs = {
    targetFY: 27,
    monthlyRevenueTarget: { AUG: 100000, SEP: 200000 },
    monthlySegmentSpent: {
      Seminar: { AUG: 5000, SEP: 6000 },
      Webinar: { AUG: 1000, SEP: 1200 }
    }
  };

  const dealShareRows = [
    { group: "Seminar", dealShare: 0.3 },
    { group: "Webinar", dealShare: 0.1 }
  ];

  const derivationRows = [
    { month: "AUG", group: "Seminar", monthlyNewP1Target: 50 },
    { month: "AUG", group: "Seminar", monthlyNewP1Target: 50 }, // 같은 (Month,Group) 중복 — dedupe 확인
    { month: "SEP", group: "Seminar", monthlyNewP1Target: 40 }
  ];

  const result = computeReportTargetLookupFromInputs_(inputs, dealShareRows, derivationRows);

  const pass =
    result.revenueTarget["27|AUG|Seminar"] === 30000 &&
    result.revenueTarget["27|SEP|Webinar"] === 20000 &&
    result.spent["27|AUG|Seminar"] === 5000 &&
    result.spent["27|AUG|BOFU"] === 0 &&
    result.newP1Target["27|AUG|Seminar"] === 50 &&
    result.newP1Target["27|SEP|Seminar"] === 40 &&
    !result.newP1Target.hasOwnProperty("27|OCT|Seminar");

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Report Target Lookup (IO 래퍼 — ACQ_REP/NewP1_REP용)
 * ==========================================================
 */
function computeReportTargetLookup_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.TARGET.ENGINE_SHEET);

  if(!sheet){
    return { targetFY: null, revenueTarget: {}, newP1Target: {}, spent: {} };
  }

  const inputs = readTargetEngineInputs_(sheet);
  const dealShareRows = readTargetEngineDealShareRows_();
  const derivationRows = readTargetEngineDerivationRows_();

  return computeReportTargetLookupFromInputs_(inputs, dealShareRows, derivationRows);

}
