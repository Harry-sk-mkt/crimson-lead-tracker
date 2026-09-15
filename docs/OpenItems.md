# Open Items (현재 알려진 미해결 항목)

> 이 문서는 이전까지 `CLAUDE.md`의 "현재 알려진 미해결 항목" 섹션에 있던 내용을 그대로
> 옮긴 것입니다 (2026-07-29 하네스 엔지니어링 ④단계, CLAUDE.md 다이어트 — 정보 손실 없이
> 위치만 이동, 문구 변경 없음). **임의로 처리하지 말 것** — 각 항목의 확정/미확정 상태와
> 배경을 먼저 읽고 진행한다.

> 2026-09-15부터, 전체 하위 항목까지 완전히 해결된 항목은 `docs/OpenItems_Legacy.md`로 옮겨졌습니다 — 이 파일엔 여전히 미해결이거나 부분적으로만 해결된 항목만 전문으로 남아있고, 옮겨진 항목은 아래에 한 줄 breadcrumb로만 남아있습니다(번호 재사용 없음).

1. (완료 — 상세는 `docs/OpenItems_Legacy.md` #1 "Leads_OPS_QA 생성 로직" 참고)
2. (완료 — 상세는 `docs/OpenItems_Legacy.md` #2 "IC Request(SAL) #touches 지표(4번과 동일 항목으로 통합)" 참고)
3. (완료 — 상세는 `docs/OpenItems_Legacy.md` #3 "MTA_Master 완전 동일 중복 터치 탐지" 참고)
4. (완료 — 상세는 `docs/OpenItems_Legacy.md` #4 "IC Requested 재신청 이력 보존" 참고)
5. **`Opp(ortunity) Won Date` 대체 필요 (부분 해소, 잔여 범위만 TODO)** — `Opportunity Won Date`는 실제로는 "Opportunity로 전환된 날짜"일 뿐 진짜 Close Date가 아님(진짜 Close Date 필드는 export에 없음, 2026-07-20 Deal Tracker 논의 중 확인 — `docs/Changelog.md` 참고). Close Date 대용으로 쓰기에 부적절하므로, Close Date가 필요한 리포트/QA 로직에서 이 필드를 다른 필드로 대체해야 함. 2026-07-25 OPS 전체 구축 완료 후 QA 착수 시점에 메모됨. **2026-07-25 후속 발견**: `Lead: Sales Funnel Stage = "Won Deal"`인 리드는 전부 Revenue가 존재 — Won 여부 판별의 대체 후보로 유력하나 구현은 보류 중(`docs/ACQReportDesign.md` "Opportunity Won Date 대체 후보 발견" 섹션 참고). **2026-07-28 해소**: 2트랙 아키텍처(7번 항목) 적용으로 ACQ_REP/Events_OPS/BOFU_OPS/Content_OPS는 더 이상 이 필드에 의존하지 않음 — Deal Tracker의 Close Date로 대체 완료. **잔여 범위(여전히 미해결)**: `NewP1_REP`(Won 판정은 원래도 Revenue>0이라 이 필드 자체는 미사용이었음, 변경 없음)과 `Search_OPS`(UTM 그레인 문제로 2트랙 전환에서 예외 처리됨, 여전히 Opportunity Won Date 사용)에는 이 필드가 그대로 남아있음 — 대체 여부는 미정, 임의로 처리하지 말 것.
6. (완료 — 상세는 `docs/OpenItems_Legacy.md` #6 "SAL 과집계 원인 해결(Sales Accepted Date 전환)" 참고)
7. **Deal Tracker(`[KOR] Deal Tracking`) 통합 — Block C 실데이터 연동 완료(아키텍처 전환), Opportunity Won Date 보정 레이어는 여전히 미착수 (TODO)** — 2026-07-25 발견: 사용자가 FY23부터 별도 관리해온 KOR 딜 전용 시트. `Closed Date`가 진짜 Close Date(5번 항목 대체 후보), upsell 데이터로 순매출 계산 가능. **Won Date 보정 레이어 용도는 아직 설계/구현 시작 전** — 자세한 내용은 `docs/Changelog.md` 2026-07-25 "Deal Tracker 통합 계획 메모" 섹션 참고, 임의로 처리하지 말 것.
   - **최종 아키텍처(2026-07-27 확정)**: Leads_OPS 개별 리드 매칭을 전부 폐기하고 **Deal Tracker 자체를 Source of Truth로 전환**. 딜 자체에 기록된 Lead Source/Source Category/Lead Source Detail로 `getBusinessSegment()`(16_TransformHelper.js, 프로젝트 공용 분류 로직)를 직접 호출해 세그먼트 분류 — `classifyDealSegment_()`(`90_TargetEngine.js`), Leads_OPS 조회 전혀 없음. P1 판정도 제거(사용자 확인: 딜의 99%가 이미 P1). 원래 쓰던 시트로 복귀 — 스프레드시트 ID `1oGCY8okaxhpHrtotUzbhyprCOVcJ9ndX5kX3m5qqxME`(gid `498663095`), `CONFIG.TARGET.EXTERNAL.DEAL_TRACKER`(`00_Config.js`). `93_TempQA_DealTrackerMatch.js`(`runListUnmatchedDealTrackerEmails()`)는 "분류 실패한 딜" 목록으로 재작성. **분류 메커니즘 자체는 이후 두 차례 더 교체됨**: 1차로 "Content Category"라는 명시적 분류 컬럼이 시트에 이미 있었음이 뒤늦게 발견돼 그걸 직접 매핑하는 방식으로 교체, 2차로(2026-07-28) 그 컬럼을 사용자가 "Segment"로 개명 + 전체 딜 수동 재분류한 것을 그대로 Source of Truth로 쓰는 현재 방식(`deriveTargetGroup_()`)으로 최종 교체 — 아래 참고.
   - ~~P1당 가치 코호트1/2 이원화~~ — 구현 및 검증 완료(2026-07-28, 사용자 확인). content(ebook 등) 리드는 nurturing이 최대 28개월까지 걸려 단일 코호트만으로 P1당 가치를 구하면 심각하게 저평가됨(원래 발견: content Target P1이 주 871로 비정상적으로 높게 나왔던 원인). 사용자 확정 프레임워크대로 구현(2026-07-27): `readDealTrackerRawRows_()`가 실제 Date 셀인 Close/Created Date에서 `closeFY`/`createdFY`를 직접 파생, `computeDealCohortsFromDealRows_()`가 그룹별 코호트1(Created=Closed=타겟FY) Revenue(R1)/코호트2(Closed=타겟FY, Created≠타겟FY) Revenue(R2)를 분리 계산, `computeP1ValueBlockRows_()`가 `CurrentFYP1V(a)=R1÷타겟FY New P1`, `PrevP1V(b)=R2÷(all-time 총 P1−타겟FY New P1)`를 Target_Engine Block B(7컬럼으로 확장)에 나란히 기록. Block C(딜 비중)도 동일 코호트1 기준으로 통일(3FY median 폐기). ~~**최종 FY P1 목표 공식(Block D)에 a/b를 어떻게 반영할지**~~ — **최종 확정(2026-07-27)**: 단일 코호트로 블렌딩하지 않고, FY Revenue 타겟 자체를 New 트랙(코호트1 비중÷a)과 Pipeline 트랙(코호트2 비중÷b)으로 물리적으로 분리해 각각 계산 후 합산(`computeDealShareBlockRows_()`, Block C가 2컬럼→6컬럼으로 확장). Pipeline 트랙 그룹 배분은 코호트1 딜비중(R1)을 재사용하면 안 됨을 실측으로 확인(같은 해 빠르게 전환되는 contact에 쏠림) — 반드시 코호트2(R2) 자체 비중을 쓰는 `computeDealShareRatiosCohort2FromDealRows_()` 신규. 3FY median/가중평균도 안 씀 — "이전 FY(24·25)는 본사 관리 체제라 노이즈"라는 사용자 판단으로 a/b/딜비중/pipeline비중/트랙분리비율 전부 FY26 단일 스냅샷 기준 통일. **`runRefreshTargetEngine()` 실 시트 검증 완료(2026-07-27)**: Block C 실제 값 — events New 1,358.15/Pipeline 2,277.31/Total 3,635.45, contact New 380.45/Pipeline 489.93/Total 870.38, content New 696.96/Pipeline 1,299.62/Total 1,996.57(New+Pipeline=Total 정확히 일치 확인). 검증 중 별도 버그 발견·수정: Block C 확장으로 Block D 시작 컬럼이 밀리면서(X열→AB열) 예전 Block D의 Date 서식이 남아있어 숫자값이 "12/30/1899"류 날짜로 잘못 표시되던 문제 — `refreshTargetEngine_()`의 wide-clear를 `clearContent()`→`clear()`로 수정해 해결. **2026-07-29 후속**: 이 검증은 당시의 Content Category 기반 분류로 계산된 것 — 이후 분류 메커니즘이 Segment 컬럼 직접 참조로 교체돼(위 참고) 실제 그룹별 숫자는 재계산 필요(공식/구조 자체는 변경 없음). 상세: `docs/TargetReportDesign.md` §5 "P1당 가치".
   - **2트랙 아키텍처로 프로젝트 전역 확장 — ACQ_REP은 실측 검증 완료, Events_OPS/BOFU_OPS/Content_OPS는 검증 대기(TODO)**: 2026-07-28 사용자 확정 — "Revenue가 포함되는 모든 레이어는 딜트래킹을 소스 기반으로. 리드~세일즈 액티비티는 Leads/MTA, Opportunity단은 딜트래킹으로 2트랙 설계." Target_REP에서만 쓰던 Deal Tracker Source of Truth 원칙을 `ACQ_REP`(Revenue), `Events_OPS`/`BOFU_OPS`/`Content_OPS`(`#Deals`/`Revenue`)까지 확장 적용, `docs/OperationsLayer.md`의 "모든 리포트는 Leads_OPS를 읽어야 한다" 원칙에 정식으로 2트랙 예외 각주 추가. 구현: `90_TargetEngine.js`에 프로젝트 공용 `computeDealTrackerCountsByKey_()`(순수 함수, 도메인별 키 정규화 함수 주입) 신설 + `readDealTrackerRawRows_()`에 `closeDate` 필드 추가(additive). `30_ACQReport.js`의 `computeACQDealRevenueFromRows_()`(Segment×Month), `51/61/81_*_Engine.js`의 `compute{Events|BOFU|Content}DealAggregates_()`(프로그램명 키, `stripRegistrationFormSuffix_`+`isKoreanProgram_`(+Events는 `isEligibleEventType_`) 재사용). **2026-07-28 후속 수정**: ACQ_REP Segment 분류를 처음엔 `getBusinessSegment()` 키워드 매칭(7개 Segment 유지, Target의 3그룹 collapse는 안 씀)으로 했으나 실측 검증 결과 정확도가 신뢰 불가 수준(Search $144,265 vs 실제 ~$537,507.89, 약 $393K 갭)이라 폐기 — 사용자가 Deal Tracker의 H열("Content Category"→"Segment"로 개명)에 전체 딜을 수동 재분류, 이 컬럼(`row.businessSegment`)을 그대로 Source of Truth로 씀(`classifyDealSegment_()`도 동일하게 전환돼 Target_REP도 혜택). **의도적 예외 1건(2026-07-28 갱신 — NewP1_REP은 아래에서 예외 해제됨)**: `Search_OPS`(raw UTM 그레인이 Deal Tracker의 프로그램 단위 Lead Source Detail과 안 맞아 중복집계 위험, `71_Search_Engine.js` 주석 참고)만 그대로 Leads_OPS 기준 유지. **2026-07-28 추가 발견·수정(타임존 버그)**: Segment 전환 후에도 ACQ_REP 7월 Referral이 실제값과 안 맞아 조사한 결과, 이 스크립트 타임존(`appsscript.json`: America/New_York)과 Deal Tracker 스프레드시트 자체 타임존이 달라 **매달 1일 Close된 딜이 전월로 잘못 집계되는 구조적 버그** 발견(실측: Close Date "2026-07-01"이 "Jun 30 2026 11:00 EDT"로 읽혀 6월로 집계됨). `normalizeExternalCalendarDate_()`(`90_TargetEngine.js` v1.13.0, Deal Tracker의 `getSpreadsheetTimeZone()` 기준으로 연/월/일 재구성)로 수정 완료 — `readDealTrackerRawRows_()`가 closeDate/createdDate 둘 다에 적용. Target_REP의 `readChannelRawRows_()`/`readNaverRawRows_()`(외부 채널시트/Naver)도 같은 구조라 이론상 같은 위험이 있으나 실측 보고된 적 없어 이번 라운드에선 미수정(낮은 우선순위, 별도 확인 필요). **✅ ACQ_REP 검증 완료(2026-07-28, 사용자 확인)**: `runRefreshACQSummary()` 재실행 후 5·6·7월 전 세그먼트 Revenue(Referral 포함)가 Deal Tracker 실제 합계와 정확히 일치 확인(7월 전체 $999,931.89 vs ACQ_REP $999,932). 12번 항목의 Referral 갭은 이번 전환으로 해소된 것으로 확인됨. **아직 검증 필요(남은 범위)**: Events_OPS/BOFU_OPS/Content_OPS의 Engine 갱신 함수 실행 후 `#Deals`/Revenue가 Deal Tracker 프로그램명 매칭으로 실제 값과 맞는지는 아직 미확인 — 확인 전까지 완료로 간주하지 말 것. 상세: `docs/Changelog.md` 2026-07-28.
   - ~~NewP1_REP Won/Revenue도 2트랙 확장 대상으로 편입~~ — 구현 및 검증 완료(2026-07-28, 사용자 확인). 최초엔 "NewP1_REP의 Won/Revenue는 리드 단위 지표라 Deal Tracker 전환 제외" 결정이었으나, 사용자가 "리드 단위 매칭 없이도 딜의 Created Date(코호트 축)+수동 Segment 컬럼으로 직접 집계 가능하다"고 지적 — ACQ_REP(Close Date 기준)과 동일한 패턴을 NewP1_REP에도 적용. 구현: `40_NewP1Report.js`의 `computeNewP1DealWonRevenueFromRows_()` 신규(딜 Created Date FY/Month + Segment로 코호트 집계, Upsell/N/A는 Other로 접음), `computeNewP1Aggregates_()`는 New P1/SAL/IC Booked/IC Complete만 Leads_OPS에서 집계하고 Won/Revenue는 이 신규 함수 결과와 병합. `90_TargetEngine.js`의 `readDealTrackerRawRows_()`에 `createdDate`(정규화된 Date) 필드 추가(additive). **부작용(사용자 확인·승인)**: Won%(=Won÷New P1)의 분자(딜트래커 딜 건수)와 분모(Leads_OPS 리드 건수)가 서로 다른 두 집단이 되어 "코호트 전환율"이 아니라 "기간별 딜 규모 대비 리드 규모"로 의미가 바뀜. **알려진 한계(별도 항목, 코드 아님)**: Referral 딜 다수가 Created Date 결측이라 Won/Revenue 과소집계 — 사용자가 Deal Tracker에서 직접 채워 넣기로 함, `docs/NewP1ReportDesign.md` 참고. 상세: `docs/Changelog.md` 2026-07-28.
8. (완료 — 상세는 `docs/OpenItems_Legacy.md` #8 "완전 동일 중복 터치(Exact Duplicate Touch Row) 자동 삭제" 참고)
9. ~~Backend 실행 체인 비동기화~~ — **✅ 구현 및 실사용 검증 완료(2026-08-04 구현,
   2026-09-09 최종 검증)**. 설계는 2026-07-28 확정, 구현은 2026-08-04. 코드는 이후
   전면 리팩터를 거쳐 현재 `MASTER_002_PipelineAsync.js`(락/트리거/README 진행상태 표시/
   재시도 진입점). **2026-09-09 최종 검증**: 같은 날 Executions 로그로 4개 파이프라인
   전부 "Import → Append → 락 확인 → 트리거 설치 → 트리거 자동 발동" 경로가 Time-Driven
   타입 실행으로 실제 발동함을 확인 — `importLeadReport`(11:32:29)→`importCsv`
   (11:32:42)→**`runLeadsPipelineTail`(Time-Driven, 11:33:25)**, `importMTAReport`
   (10:52:12)→**`runMTAPipelineTail`(Time-Driven, 10:54:12)**, `importSALReport`
   (10:54:46)→**`runSALPipelineTail`(Time-Driven, 11:03:34)**, `importICFunnelReport`
   (10:55:41)→**`runICFunnelPipelineTail`(Time-Driven, 11:15:15 — SAL tail이 11:13:02에
   끝날 때까지 밀렸다가 발동, 락 충돌 시 자동 대기열 동작의 실제 증거)**. 사용자가 README
   탭 육안 확인 결과 New Leads/MTA/SAL/IC Funnel 전부 DONE 상태로 정상 표시 확인 —
   마지막 남은 검증 항목까지 완료. `runRetryPipelineTail()`(실패 시 수동 재시도)만
   실제 실패 사례가 없어 미검증으로 남지만, 실패 자체가 드문 데다 인위적으로 만들
   이유는 없어 낮은 우선순위. `docs/exec-plans/completed/2026-08-04-pipeline-async-triggers.md`로
   이동. 아래는 설계 당시 기록(참고용, 최신 구현과 세부 함수명이 다름 — 예:
   `08_PipelineAsync.js`→`MASTER_002_PipelineAsync.js`, `appendNewLeads()`/`appendNewMTA()`는
   현재 `importCsv()`가 자동 호출).
   **2026-09-04 부분 검증**: #29(getBusinessSegment 순서버그) 수정분을 기존 Master 데이터에
   반영하는 과정에서 `runLeadsPipelineTail()`/`runMTAPipelineTail()`을 수동으로(트리거 경유가
   아니라 Apps Script 편집기에서 직접 Run) 실행 — 둘 다 각 단계(dedup/OPS Build/Engine 6종/
   OPS 시트 재작성/Ad Spend/Target Actuals/리포트 Generate 5종)를 에러 없이 끝까지 완주,
   `[TIMING]` 로그로 단계별 소요시간도 정상 기록됨(Leads tail ~12분/MTA tail ~10분, 30분
   실행시간 제한 내 여유 있게 완료) — **"체인 자체가 끝까지 안전하게 도는지"는 이걸로 검증된
   것으로 볼 수 있음**. 다만 `appendNewLeads()`/`appendNewMTA()` → 락 확인 → 트리거 설치 →
   트리거 자동 발동 경로 자체는 이번에 거치지 않았음(직접 tail 함수를 Run) — README Pipeline
   Status 갱신/락 충돌·재시도 동작까지는 여전히 미검증이라 완료로 간주하지 말 것.
   **2026-08-05 실사용 검증 중 발견·수정**: 20번 항목(ACQ_REP New P1 불일치) 조사 과정에서
   신뢰성 버그 발견 — 중복 정리 등 한 스테이지의 실행 시간이 길어지다 Apps Script
   플랫폼이 실행을 강제 종료하면, 최상위 try/catch(JS 예외 전용)가 개입 못 해
   `releasePipelineLock_()`가 호출 안 되고 `PIPELINE_LOCK`이 영구히 남아 그 이후
   모든 Import의 백그라운드 처리가 계속 스킵되는 구조적 문제 확인(간접 증거 —
   Leads_Master에 중복 659건이 몇 주간 자체 복구 없이 쌓여있었던 것으로 추정, 과거
   실행 로그로 직접 확정한 것은 아님). `08_PipelineAsync.js` v1.7.0에서 락에
   타임스탬프를 같이 저장해 `CONFIG.PIPELINE.LOCK_STALE_THRESHOLD_MS`(30분)보다
   오래된 락은 자동 해제(self-heal)하도록 수정 — 상세는 20번 항목 참고.
   **현상(설계 당시)**: `appendNewMTA()` 등 Import 후속 실행이 `syncMTAFunnelToOPS_()` → `refreshACQSummary_()`/`refreshNewP1Engine_()`/`refreshEventsEngine_()`까지 전부 같은 실행(execution) 안에서 순차 처리됨. Leads_OPS(3만5천+행)/MTA_Master(8만1천+행) 전체 스캔 체인이 한 실행에 몰려 있어 시간이 오래 걸림(2026-07-25 실측: MTA 전체 재구축 관련 체인이 수 분 이상 소요, 브라우저 다이얼로그를 닫아도 서버 실행은 계속됨 — `docs/apps-script-gotchas.md` #5). 사용자는 Import만 하고 나머지는 백그라운드에서 처리되길 원함.
   - **막힌 지점 해소**: (1) 6분 실행 제한 — `docs/PerformanceBenchmark.md`의 `rebuildMTAMaster()` 실측(7m58s, 타임아웃 없이 정상 완료)으로 미루어 이 프로젝트는 Google Workspace 계정(30분 제한)에서 도는 것으로 추정(사용자 미반박, 잠정 확정) — 즉 실행시간 하드 리밋 자체는 실질적 병목이 아니고, 진짜 문제는 UX(브라우저 다이얼로그가 몇 분씩 안 닫힘)와 진단 가능성(몇 단계에서 멈췄는지 모름). (2) `clasp run-function`은 기존 보류 결정 그대로 무관 — 트리거 방식은 GAS 자체 기능이라 별개로 진행 가능.
   - **적용 범위(사용자 확정)**: `appendNewLeads()`/`appendNewMTA()`만 대상. `rebuildLeadsMaster()`/`rebuildMTAMaster()`(스크립트 편집기 수동 실행 전용, 희귀 작업)는 제외.
   - **아키텍처(사용자 확정)**: 단계(Engine refresh)마다 트리거를 따로 걸면 GAS 트리거 디스패치 지연(보통 최대 몇 분/hop)이 누적돼 총 완료 시간이 오히려 늘어날 위험이 있어, **트리거는 파이프라인당 1번만 걸고 그 안에서 전체 체인을 순차 실행**하는 구조로 확정. 구체적으로:
     1. `appendNewLeads()`/`appendNewMTA()`(메뉴 함수) — Raw→Master append는 지금처럼 동기 처리(신규 행 수에 비례해 빠름, 즉시 "N건 반영" 알림 가능). 끝나면 `PIPELINE_LOCK`(PropertiesService, Leads/MTA 공용 단일 락) 확인 → 잠겨있으면 "이미 백그라운드 작업 진행 중" 알림 후 종료(Master append 자체는 이미 반영됐으니 데이터 손실 없음, Leads_OPS/Engine은 다음 정상 실행 때 어차피 Master 전체 기준으로 재계산되므로 이번 사이클 스킵이 안전 — idempotent). 안 잠겨있으면 lock 설정 + 진행상태 기록 + 1회성 트리거 설치 후 즉시 반환.
     2. 트리거가 실행하는 함수(`runLeadsPipelineTail_()`/`runMTAPipelineTail_()`, 신규) — 실행 시작하자마자 자기 자신의 트리거를 삭제(고아 트리거 누적/쿼터 소진 방지) → Leads는 OPS Build, MTA는 MTA Funnel Sync 코어 로직 → 공용 7단계(ACQ/NewP1/Events/BOFU/Search/Content Engine + Target Actuals refresh)를 이 한 실행 안에서 순차 실행. 단계마다 진행상태를 기록.
     3. **동시 실행 처리(사용자 확정)**: 단순 락 — Leads/MTA 백그라운드 체인이 겹치려 하면(예: Append New Leads 직후 Append New MTA 클릭) 두 번째 시도를 거부하고 사용자에게 알림, 자동 대기열은 두지 않음(완료 후 재시도).
     4. **실패 처리(사용자 확정)**: 중간 단계 에러 시 즉시 체인 중단(자동 재시도 없음), 실패 지점/에러 메시지 기록, lock 해제(재시도 가능하게). 재시도용 수동 진입점 필요 — `appendNewLeads()`는 신규 Raw가 없으면 조기 종료해버려 재시도 경로가 안 열리므로, 실패한 파이프라인 tail만 다시 큐잉하는 별도 함수(가칭 `runRetryPipelineTail()`) 신규 필요.
     5. **진행상태 표시(사용자 확정, 2026-07-28)**: 별도 전용 시트(Pipeline_Status) 신설안 대신 **기존 README 탭**에 표시 — 정확한 셀 범위/포맷은 구현 시점에 확정.
   - **미결(구현 시점에 결정)**: `appendNewLeads()`가 현재 `buildLeadsOPS(true)`(= `skipQA=true`, `21_OPS_Build.js` v1.2.0)로 QA를 매번 스킵하고 있다는 게 이번 조사 중 확인됨(대기시간 절감 목적으로 2026-07-22 도입) — 백그라운드화되면 사용자가 더 이상 기다리지 않으므로 QA(13번 항목의 Leads_Master 완전중복 탐지 포함, 약 2분)를 매 Append마다 다시 켤지 여부는 아직 미정, 임의로 처리하지 말 것.
   - **상태(설계 당시 기록)**: ~~설계 확정, 코드 변경은 아직 없음~~ — 2026-08-04 구현 완료, 2026-09-09 실사용 검증까지 완료. 위 항목 상단 참고.
18. **Import 업로드 다이얼로그가 대용량(특히 MTA) 처리 중 오래 대기 — 원인 1건 확인·수정 완료, 나머지는 여전히 TODO** — 9번 항목(Import→Append 자동 체이닝) 구현 이후 실사용 중 발견. `importCsv()`가 이제 CSV 파싱/검증 + Raw 쓰기 + `appendNewLeads(true)`/`appendNewMTA(true)`(Raw→Master append/정렬, refresh 체인 자체는 이미 백그라운드 트리거로 분리돼 있음)까지 전부 같은 동기 호출 안에서 처리 — 이 동기 구간 자체가 오래 걸려 업로드 다이얼로그가 "Uploading..." 상태로 오래 대기.
    **✅ 원인 1건 확인·수정(2026-08-05)**: 20번 항목(ACQ_REP New P1 불일치) 조사 중 사용자가 "Raw가 재import로 계속 쌓이면 결국 처리 속도가 느려지지 않냐"고 질문한 게 계기 — 확인 결과 `appendNewLeads()`/`appendNewMTA()`가 새 행이 몇 건이든 상관없이 `readLeadRaw()`/`readMTARaw()`로 **Raw 시트 전체를 매번 통째로 읽고 있었음**(`11_DataReader.js`의 `readRawSheet()`, `getDataRange().getValues()`). Raw는 원본 보존 원칙상 절대 안 지워지고 겹치는 기간 재import 시마다 계속 누적되므로, 이 전체 읽기 자체가 시간이 지날수록(Raw가 커질수록) 점점 느려지는 구조적 문제였음 — 신규 건수와 무관하게. **수정**: `getRawSheetDataRowCount_()`(메타데이터만, `getLastRow()`)/`readRawSheetFrom_()`(targeted `getRange()` 읽기, `11_DataReader.js` v2.1.0)로 교체 — 이제 처리 시간이 Raw 전체 크기가 아니라 "신규 행 수"에만 비례. `07_IncrementalMasterBuild.js` v1.7.0. 전체 재구축(`rebuildLeadsMaster()`/`rebuildMTAMaster()`)과 진단용(`24_OPSQA.js`)은 여전히 전체 스캔 그대로(의도적, 그쪽은 전체가 필요).
    ~~**남은 후보**: `sortSheetByDate()`(Master 재정렬) 자체가 대용량에서 오래 걸릴 가능성~~ —
    2026-09-04 해소: `docs/exec-plans/active/2026-09-03-performance-optimization.md` #1로
    `appendNewLeads()`/`appendNewMTA()`/`rebuildLeadsMaster()`/`rebuildMTAMaster()`의
    `sortSheetByDate()` 호출 전부 제거, Master를 순수 Append-only로 전환(`sortSheetByDate()`
    자체와 그 파일 `IMPORT_007_SheetSorter.js`도 호출부가 없어져 삭제). **2026-09-08 검증**:
    실 MTA(2026-09-07)/Leads(2026-09-08) Import로 항목 1(정렬 제거)/2(RawDeduplicator 동적
    윈도우, Logger 로그로 직접 확인)/5(OPS 청킹) 무에러 완주. **항목 3(IC Funnel/SAL Sync)도
    2026-09-08 SAL/IC Funnel Import로 "Compared window" 로그 직접 확인** — 단, `SAL_LAST_ROW`/
    `ICFUNNEL_LAST_ROW` 체크포인트가 이번이 배포 후 최초 실행이라 0에서 시작해 Raw 전체를
    "신규"로 처리(예상된 최초 1회 비용), 그래서 윈도우가 OPS 전체(36628건 중 36530~36574건)에
    가깝게 나옴. **✅ 소규모 배치도 같은 날 재확인** — 락 충돌 없이 단독으로 IC Funnel을 한 번 더
    Import(신규 4건)한 결과 윈도우가 여전히 넓게 나오지만(33086/36689, "연속 구간" 설계상 대상
    Lead ID가 흩어져 있으면 필연적) `syncICFunnelToOPS_` 자체 소요시간은 196.4초(최초 690.5초
    대비 대폭 감소)로 절감 효과는 확인됨. **✅ 원인 확정** — `runICFunnelPipelineTail`이
    1790초(≈29.8분, 30분 제한 근접)로 튄 건 `generateTargetReport_`가 916초 걸린 탓이었는데,
    같은 날 락 충돌 없이 단독 실행하니 35.6초(베이스라인과 동일 범위)로 정상 — **Target_REP
    코드 버그가 아니라 SAL 직후 파이프라인이 겹쳐 돌 때(락 충돌 재시도) 외부 스프레드시트(Deal
    Tracker) API 호출이 지연되는 현상으로 사용자 재현 테스트를 통해 확정**. 자주 일어나는
    패턴은 아니라 낮은 우선순위로 두되, 겹치면 30분 제한에 근접하는 건 사실이므로 완전히
    무시하지 말 것 — 필요 시 파이프라인 큐잉 간 최소 대기시간 도입 등 후속 조치는 별도 결정
    필요.
    **🟡 2026-09-15 재발 조사 — "파이프라인 겹침" 가설은 이번 사례에서 기각, 실제 원인은
    다른 곳에서 확정·수정**: 같은 현상이 `runSALPipelineTail` 안의 `generateTargetReport_`
    에서 재현(142.0s, 단독 실행 시 39.79s)돼 재조사 착수. 사용자가 "Apps Script Executions
    탭에서 이미 계속 겹치는 경합이 보인다"고 확인해 처음엔 위 2026-08-05 사례와 동일한
    "파이프라인/트리거 겹침" 가설로 조사했으나, **실제 Executions 타임스탬프를 대조한 결과
    이번 SAL tail 실행 구간(5:47:26~5:53:24 AM)에는 다른 실행이 전혀 겹치지 않았음**(직전
    `periodicRefreshRevenue_`는 5:34:39에 이미 종료) — "파이프라인 겹침"이 이번 건의 원인은
    아님이 로그로 확인됨. 대신 사용자가 Executions 로그에서 `periodicRefreshRevenue_`
    (149s~1506s)/`periodicRefreshAdSpendCache_`(65s~1126s)가 서로 안 겹치는 시간대에도
    극심하게 널뛰는 것을 발견, "Naver Search에서 계속 긁어오는" 것을 직접 지적 — 코드
    확인 결과 `computeNaverSearchAdSpendHistorySummary_()`(AD_003_NaverSearch.js)가
    `BACKFILL_START`(2022-09)부터 **매번** 전체 월(48개월+)을 순회하며 API를 호출하고,
    Naver `/stats`의 공식 제약(최근 730일)보다 오래된 절반가량은 매번 400을 받은 뒤에야
    건너뛰고 있었음(호출 자체는 항상 발생 — Naver 응답 지연이 그대로 실행시간 변동성에
    반영됨, `refreshCampaignSpend_()`/`periodicRefreshAdSpendCache_()` 양쪽에서 반복
    호출되므로 누적 낭비가 큼). **✅ 수정 완료(2026-09-15)**: 신규
    `filterMonthsWithinNaverStatsLookbackWindow_()`(순수 함수, `AD.NAVER_SEARCH.API.
    STATS_LOOKBACK_DAYS`=730 신규, `AD_001_Config.js` v1.25.0)로 범위 밖 월은 API 호출
    전에 사전 필터링 — `AD_003_NaverSearch.js` v2.17.0, 기존 400 캐치는 안전망으로 유지,
    신규 테스트 `testFilterMonthsWithinNaverStatsLookbackWindow()` PASS 확인.
    `TARGET_002_Report.js`는 진단용 계측만 추가했다가(v1.10.1) 원인이 이쪽으로 확정돼
    코드 변경 없이 원복(v1.10.2). **실사용 재검증 필요** — 다음 Import 파이프라인/주기
    트리거 실행에서 Naver 관련 API 호출 수·소요시간이 실제로 줄었는지, 전체 실행시간
    변동성이 완화됐는지 확인 전까지 완료로 간주하지 말 것. 원래의 "SAL 직후 파이프라인이
    겹쳐 돌 때 외부 API 지연" 가설(2026-08-05 사례)은 별개 현상으로 남아있을 수 있으나
    이번 재조사로는 재현되지 않음 — 낮은 우선순위 유지.
    **✅ 2026-09-15 추가 수정 — Ad_Spend_Cache 재계산 자체가 파이프라인 tail과 4시간
    주기 트리거에서 중복 실행되던 구조적 문제 해소(사용자 지적)**: 위 Naver 조사 중
    사용자가 "Ad_Spend_Cache를 외부로 뺀 게(4시간 주기 `periodicRefreshAdSpendCache_()`
    도입, 2026-08-08) 애초에 이 무거운 과정을 미리 돌려두려던 거잖아"라고 지적 — 확인
    결과 `refreshCampaignSpend_()`(Leads/MTA 파이프라인 tail 맨 앞)가 여전히 매번
    `refreshAdSpendCache_()`(Meta+Naver 이력+Kakao Channel 전체 재계산)를 직접
    호출하고 있어, 4시간 주기 트리거와 완전히 같은 무거운 작업을 파이프라인마다
    반복하고 있었음(주기 트리거를 둔 원래 의도가 무력화된 상태) — 짧은 간격의 연속
    Import(Leads→MTA→SAL→IC Funnel)마다 이 중복이 그대로 누적. **수정**:
    `refreshCampaignSpend_()` 단계를 Leads/MTA 파이프라인 tail에서 완전히 제거하고
    함수 자체도 삭제(다른 호출부 없음 확인 완료, 수동 재계산은 기존
    `runRefreshAdSpendCache()`로 계속 가능) — `MASTER_002_PipelineAsync.js` v1.31.0.
    README Pipeline Status 표의 "Campaign Spend" 컬럼도 `CORE_001_Config.js`
    (v1.68.0)에서 함께 제거, `testBuildPipelineStatusGrid()` 기대값(컬럼 수 14→13)
    갱신·PASS 확인. `AD_006_KakaoMoments.js`(v1.24.0) 상단 설계 배경 주석도 "토큰
    자동 갱신의 유일한 수단"이 이제 `periodicRefreshAdSpendCache_()`임을 반영해 갱신.
    **트레이드오프(사용자 확정)**: Import 직후 `refreshTargetActuals_()`/
    `syncMTAFunnelToOPS_()`가 참조하는 Ad_Spend_Cache가 최대 4시간 지연될 수 있음 —
    실시간성보다 중복 제거를 우선. **실사용 재검증 필요** — 다음 Leads/MTA Import
    파이프라인 실행시간이 실제로 줄었는지, README Pipeline Status 표가 13컬럼으로
    정상 렌더링되는지 확인 전까지 완료로 간주하지 말 것.
    **✅ 2026-09-15 세 번째 수정 — `refreshTargetActuals_()`의 같은 tail 내
    자기잠식(self-clobbering) 제거**: 사용자가 2026-09-14 `runLeadsPipelineTail`
    로그(`[TIMING] LEADS/refreshTargetActuals_ completed in 12942ms`)를 보고 "더
    분리할 게 남았는지" 질문 — 확인 결과 `refreshTargetActuals_()`(Target_REP Actual
    컬럼만 부분 갱신)가 실행된 지 수십 초 후 **같은 tail 실행 안에서** `generateTargetReport_()`
    (`refreshReportGenerate_()`가 호출)가 `clearTargetReportArea_()`로 시트를 통째로
    지우고 Target/Actual 전체를 다시 써서, 방금 `refreshTargetActuals_()`가 쓴 값을
    그대로 덮어쓰고 있었음 — Campaign Spend와 달리 완전 중복은 아니고
    "generateTargetReport_ 실패 시 최소한의 부분 갱신을 남긴다"는 안전망 역할이
    있었으나, **사용자가 속도를 우선해 제거 확정**. `runLeadsPipelineTail()`
    (`MASTER_002_PipelineAsync.js` v1.32.0)/`syncMTAFunnelToOPS_()`
    (`MASTER_003_MTAFunnelSync.js` v1.12.0)/`syncICFunnelToOPS_()`
    (`MASTER_009_ICFunnelSync.js` v1.10.0) 세 곳에서 호출 제거(SAL tail은 애초에
    이 호출이 없어 해당 없음). `rebuildLeadsMaster()`/`rebuildMTAMaster()`
    (`MASTER_004_MasterBuild.js`, 이 뒤에 generateTargetReport_가 이어지지 않는
    별도 수동 재구축 경로)의 호출은 유일한 갱신 수단이라 그대로 유지 — 임의로
    건드리지 않음. **실사용 재검증 필요** — 다음 Leads/MTA/IC Funnel Import 후
    Target_REP Actual 값이 여전히 정확한지(generateTargetReport_가 정상 완주한다는
    전제하에 이론상 최종 결과는 동일해야 함), 실행시간이 실제로 더 줄었는지 확인 전까지
    완료로 간주하지 말 것.
    **✅ 2026-09-15 네 번째 수정 — `refreshReportFYDropdowns_`의 중복 전체 스캔에
    하루 1회 캐싱 도입**: 사용자가 Engine 6종 독립 트리거 분리(Axis A)를 다시 검토하자고
    요청 — 설계를 깊이 파다가 (a) OPS hop/Report hop을 진짜 병렬로 돌리려면 이
    프로젝트에 한 번도 안 쓰인 `LockService` 기반 rendezvous가 필요해 새로운 레이스
    컨디션 클래스가 생기고, (b) Engine 6종 자체는 시간을 줄이는 게 아니라 트리거
    경계만 하나 늘리는 것이라(순수 안전마진용) 기대했던 "체감 실행시간 단축"이
    hop 전환 지연에 상쇄될 수 있음을 발견 — 사용자가 Engine 분리는 보류하고 "더
    명백한 낭비가 있는지" 재조사를 요청. 그 결과 `refreshReportFYDropdowns_()`
    (30~44s, 오늘 실측)가 `findFiscalYearRange_()`(ACQREP_001_Report.js —
    Leads_OPS 36,831행+MTA_Master 86,022행 전체 스캔)와 `findNewP1FiscalYearRange_()`
    (NEWP1REP_001_Report.js — Leads_OPS를 **완전히 같은 로직으로 또 한 번** 독립
    스캔) 두 함수의 전체 시트 재스캔 때문임을 확인 — 이 min/max FY 값은 min이
    한 번 정해지면 고정, max는 매년 8월 한 번만 바뀌어 하루 안에서는 사실상
    불변인데도 4개 파이프라인(Leads/MTA/SAL/IC Funnel)이 하루 여러 번 돌 때마다
    매번 12만+ 행을 재스캔하고 있었음 — Naver 캐시(#18 세 번째 수정)와 동일한
    성격의 낭비. **수정**: 캐시 유효성 판정을 순수 함수 `isFYRangeCacheFreshForToday_()`
    (`UTIL_001_TransformHelper.js` v1.22.0, 신규 테스트
    `testIsFYRangeCacheFreshForToday()` 4케이스 통과)로 분리해 두 함수(각자 스캔
    범위가 달라 값이 다를 수 있어 캐시는 통합하지 않고 판정 로직만 공유)에서
    재사용 — `ACQREP_001_Report.js` v1.21.0/`NEWP1REP_001_Report.js` v1.8.0,
    `CONFIG.PROPERTIES.ACQ_FY_RANGE_CACHE`/`NEWP1_FY_RANGE_CACHE` 신규
    (`CORE_001_Config.js` v1.69.0). 출력값/기존 스캔 로직 자체는 무변경 — 같은 날
    두 번째 이후 호출부터 스캔을 건너뛰고 캐시만 반환. **Engine 6종 독립 트리거
    분리(Axis A)는 계속 보류** — 위 레이스 컨디션/hop 지연 상쇄 우려로 착수 안 함,
    필요해지면 별도 논의.
    **✅ 실사용 검증 완료(2026-09-15, 통제된 캐시 삭제→재스캔→재사용 테스트)**:
    배포 직후 첫 파이프라인 실행에서 461ms로 끝나 원인이 불명확했던 것과 별개로,
    `runClearFYRangeCaches()`(`ACQREP_001_Report.js`, 신규 진단용 수동 실행 함수)
    로 캐시를 강제 삭제한 뒤 `setupACQDropdowns()`를 재실행 — **캐시 미스 시
    29.86초**(기존 30~44초 실측과 일치, 스캔 자체가 원래 느린 게 맞음을 재확인)
    걸렸고, 바로 이어서 한 번 더 실행하니 `findFiscalYearRange_: 캐시 사용(...) —
    전체 스캔 생략` 로그와 함께 즉시 완료 — FY 범위 값(FY18~FY27)도 두 실행에서
    동일. 캐시 히트/미스 진단 로그(`ACQREP_001_Report.js`/`NEWP1REP_001_Report.js`
    v1.21.1/v1.8.1)로 원인을 명확히 구분해 검증 완료. 캐시의 "오늘" 기준은
    `todayDateString_()`(스크립트 타임존 America/New_York) — Naver 캐시와 동일
    관례, 한국 시간 기준 날짜와 다르게 표시될 수 있으나 정확도엔 영향 없음(참고
    사항으로 기록, 문제 아님). 최초 배포 직후 첫 실행이 461ms로 나온 원인은
    끝내 특정 못 했으나, 이후 통제된 테스트가 양방향(캐시 미스=느림/캐시
    히트=빠름)으로 명확히 재현돼 로직 정합성 자체는 확실히 확인됨.
    **✅ 항목 4(딕셔너리 증분)도 2026-09-09 최종 검증 완료** — 2026-09-08 신규 0행
    사이클에 이어, 같은 날 오후 1시 사이클(당일 Leads Import 이후) 로그에서 "Leads 신규
    61행 / MTA 신규 0행 반영"이 실제 Import 건수(61건)와 정확히 일치함을 확인, 증분 채굴
    정확성까지 확정. **5개 항목 전부 검증 완료로 exec-plan을
    `docs/exec-plans/completed/2026-09-03-performance-optimization.md`로 이동.**
10. **SAL에 "Lead Status = Nurturing" 제외 조건 추가 필요 (데이터 대기, TODO)** — 6번에서 SAL을 `Sales Accepted Date` 이벤트 기준으로 전환했지만, `Lead Status`(Salesforce 표준 필드, `Sales Funnel Stage`와는 다른 별개 필드 — 픽리스트 순서: Nurturing → New (Not Contacted) → Attempting Contact → Contacted → Disqualified → IC Booked → Qualified)가 "Nurturing"인 리드도 Sales Accepted Date가 찍혀 SAL로 카운트되는 문제를 2026-07-25 사용자가 발견(Search 세그먼트 SAL 8건이 전부 IC Booked인 게 이상해서 개별 확인하다 발견). **확정된 처리 방식**: SAL 제외 조건은 `Lead Status === "Nurturing"` 하나뿐 — New/Attempting Contact/Contacted/Disqualified/IC Booked/Qualified는 전부 SAL로 그대로 카운트(사용자 확인, "New부터는 전부 SAL"). **막힌 지점**: `Lead: Lead Status` 필드가 아직 MTA export에 없어 파이프라인에 전혀 없는 상태 — Salesforce 리포트에 이 필드 추가 + 재export 되기 전까지 구현 불가. 필드 도착 시 `13_MTATransformer.js`에 매핑(리드 레벨 스냅샷이라 `computeMTAFunnelByLeadId_()`처럼 대표값 로직 필요할 수 있음) → `30_ACQReport.js`의 SAL 카운트 조건에 `leadStatus !== "Nurturing"` 추가. 임의로 처리하지 말 것.
11. **Target_REP(주간 세그먼트 목표·달성률 리포트) 구현 완료, Generate 자동화 완료(2026-08-05) — 실사용 검증 진행 중, TODO** — 2026-07-27 설계 확정(`docs/TargetReportDesign.md`) 후 같은 날 구현 및 실 시트 검증 진행. New P1/CPNP1을 top-down(마케팅 Revenue 타겟 × 딜 비중 ÷ P1당 가치)으로 역산해 주간 목표를 세우고 실적과 대조. 구현 파일: `90_TargetEngine.js`(Block A~D 계산/작성, 주 캘린더 생성, 가중평균, 외부 채널시트/Naver gid 매칭), `91_TargetReport.js`(`setupTargetReport()`, `runGenerateTargetReport()`, `refreshTargetActuals_()` — 기존 `refreshACQSummary_()` 호출 4곳에 배선), `92_TargetStyles.js`, `CONFIG.TARGET`(`00_Config.js`). **막힌 지점 5개는 구현 착수 전 전부 해소됨**(상세는 `docs/Changelog.md` 2026-07-27 항목). **실행 중 실측 버그 2건 발견·수정**: (1) Block 0 입력값을 셀 단위로 개별 읽고/쓰던 게(최대 27회 왕복) 대용량 워크북에서 타임아웃 유발 → 배치 호출로 수정, 해결 확인. (2) **Generate를 체크박스+onEdit(Simple Trigger)로 구현했으나, Simple Trigger는 제한된 권한이라 `SpreadsheetApp.openById()`(외부 채널시트 참조)를 아예 호출할 수 없음이 실측 확인됨**("Specified permissions are not sufficient") — ACQ_REP/NewP1_REP는 외부 파일을 안 열어서 이 문제가 없었음, Target_REP만 해당. 사용자 확인 후 체크박스/onEdit 분기 제거, `runGenerateTargetReport()`를 Apps Script 편집기에서 직접 Run하는 방식으로 전환(직접 Run은 Full Authorization). **2026-08-05 자동화**: 사용자 요청("deal tracker도 import 체인에 포함시키자")으로 `generateTargetReport_()`를 `08_PipelineAsync.js`의 `refreshReportGenerate_()`(설치형 트리거, Full Authorization이라 Simple Trigger 제약 자체가 없음)에 추가 — 매 Leads/MTA 백그라운드 실행마다 자동 호출됨, 편집기 직접 Run은 재시도/디버깅용으로 계속 가능. **아직 검증 필요**: 자동 호출된 Target_REP 리포트 행/Target_Engine Block A~D 실제 값(특히 CPNP1 벤치마크가 외부 gid 매칭 성공해서 0이 아닌지) 확인 전까지 완료로 간주하지 말 것. 그 외 `docs/TargetReportDesign.md` §12 #6~8(개선계수 초기값 0.9 placeholder, Seminar/Webinar 분해 표시, 월 소계 행)은 실물 확인 후 결정 예정.
12. ~~ACQ_REP Referral 세그먼트 Revenue가 Salesforce/딜트래커 대비 연간 기준 과소집계~~ — 2026-07-28 해소 확인(사용자 확인, FY26 전체 연간 대조 완료). 원래 발견: 이번 FY(FY26) 전체로 보면 ACQ_REP Referral 합계($2,157,628.79)가 딜트래커 Referral 합계($2,794,367.69)보다 **$636,739(약 22.8%) 적음**(당시 ACQ_REP은 Leads_OPS `Opportunity Won Date`/`Revenue` 기준이었음). 7번 항목의 2트랙 아키텍처 적용(Deal Tracker 기반 + 수동 Segment 컬럼 + 타임존 버그 수정)으로 ACQ_REP Revenue가 Deal Tracker와 정의상 같은 소스가 되면서 갭 해소 — 5·6·7월 개별 대조(7월 전체 $999,931.89 vs ACQ_REP $999,932) 및 FY26 전체 연간 대조 둘 다 사용자 확인 완료. **KRW/환율 관련 가설(별도 낮은 우선순위 항목으로 유지)**: Revenue를 KRW 원본 값으로 가져와서 일관된 환율로 NZD 변환하면 더 정확해질 수 있다는 가설은 미검증 상태로 남음 — 딜트래커 시트엔 KRW 원본 컬럼이 없고 `Revenue (NZD)`(이미 변환된 값)만 있음, Salesforce Opportunity 객체 자체에 KRW 원본 금액 필드가 있는지 확인 필요. Revenue 통화 처리 방식은 Target_REP뿐 아니라 ACQ_REP 등 여러 리포트에 걸친 문제라 별도 세션에서 다룰 것.
13. **Leads_Master 완전 동일 중복 행 탐지/자동삭제 — 구현 및 실데이터 검증 완료(2026-07-28), 자동삭제는 실제 발생 시 확인 필요** — 2026-07-28 사용자 요청으로 3/8번 항목(MTA_Master 완전 동일 중복 터치)과 동일한 문제가 Leads_Master에도 있는지 확인하다가, 해당 로직이 MTA_Master 전용이라 Leads_Master(Leads_Raw로부터 빌드)에는 없다는 게 확인됨 — 새로 설계·구현. **발생 원인 가정(사용자 확인)**: MTA와 동일하게 주간 Lead export 날짜 범위가 겹치면 `appendNewLeads()`가 같은 Lead ID를 Leads_Master에 중복 append. **완전 동일 판정 기준(사용자 확정)**: MTA_Master(터치 단위라 한 Lead가 여러 번 나오는 게 정상)와 달리 Leads_Master는 Lead ID 1개 = 행 1개가 정상 구조이므로, 5필드 복합키 대신 **Lead ID 단독**을 그룹 키로 사용 — 같은 Lead ID가 2번 이상 등장하면 완전 동일 중복. IC Booked/Completed/Won Date, Revenue 등 export 시점마다 바뀌는 스냅샷 필드는 비교에서 제외(MTA와 동일 원칙). **구현(`24_OPSQA.js` v1.4.1)**: `checkExactDuplicateLeadRows_()`/`findExactDuplicateLeadRows_()`(탐지 — `runOPSQA_()`에 배선되어 자동 실행, `Leads_OPS_QA`에 "Exact Duplicate Lead Row" 이슈로 기록)와 `findExactDuplicateLeadRowsToDelete_()`/`readLeadsMasterRowsWithIndex_()`/`runAutoDeleteExactDuplicateLeadRows()`(자동삭제 — 수동 실행 전용, 그룹당 "가장 진행된 단계"만 남기는 tie-break 로직은 `computeTouchProgressionScore_()` 재사용, 필드명이 Leads_Master와 동일해 그대로 호환됨). ~~자동삭제 함수만 MTA_Master 버전과 동일한 방침으로 자동 실행 체인에는 배선하지 않음~~ — **2026-08-04부터 배선됨**: `08_PipelineAsync.js`의 `runLeadsPipelineTail()` 첫 단계(`buildLeadsOPS`보다 먼저)로 매 Leads 백그라운드 실행마다 자동 호출(사용자 요청). 수동 실행(`runAutoDeleteExactDuplicateLeadRows()` 직접 Run)도 계속 가능. **검증 완료(2026-07-28)**: 단위 테스트(`testFindExactDuplicateLeadRows()`/`testFindExactDuplicateLeadRowsToDelete()`/`testFindExactDuplicateLeadRowsToDeleteTieBreak()`) 전부 PASS, `runOPSQA_()` 실행 결과 현재 Leads_Master에는 완전 동일 중복 0건(탐지 로직이 실데이터에 대해 정상 동작함을 확인, 다만 지금 삭제할 대상이 없어 `runAutoDeleteExactDuplicateLeadRows()`의 실제 삭제 동작 자체는 아직 실물 검증 전) — 향후 겹치는 날짜로 Lead export가 올라와 중복이 실제 발생하면 그때 삭제 동작을 검증할 것. 테스트 함수명 관련 사이드노트: 최초 구현 시 `testFindExactDuplicateLeadRowsToDelete_()`처럼 끝에 `_`를 붙였다가 Run 드롭다운에 안 보이는 문제 발견(`docs/apps-script-gotchas.md` #2) → `_` 제거(v1.4.1). MTA_Master용 동명 함수(`testFindExactDuplicateTouchRowsToDelete_()` 등, v1.3.0)도 같은 문제가 있는 것으로 추정되나 사용자가 그대로 두기로 결정(2026-07-28) — 임의로 변경하지 말 것.
14. **Search_OPS 정리 작업 중 발견된 Business Segment 분류 개선 — 대부분 완료, 잔존 leadSource="Organic Search" 레거시만 미해결** — 2026-07-28 사용자가 Search_OPS에서 콘텐츠성 캠페인(ebook/guide/SAT practice test 등)이 Search로 잘못 분류된 걸 발견하면서 시작된 연쇄 개선. 상세 이력은 `docs/BusinessSegmentClassification.md`의 2026-07-28 날짜 항목들 참고, 요약: (1) `leadSource.includes("search")`가 Content보다 먼저 체크되던 우선순위 반전, (2) campaign의 `_contact`/`consult`도 동일 문제 있어 `search`/`sitelink`를 확정 신호로 분리, (3) Content 키워드에 download/case study/quiz/공백형 on demand 추가, (4) SAT Practice Test 계열 개별 하드코딩 예외 추가, (5) BOFU/Search "_contact" 공용 fallback을 leadSource 기반(Naver/Google/Organic/Paid Search면 Search, 그 외는 BOFU)으로 재설계. Search_OPS 죽은 키(합집합 병합으로 지워지지 않던 레거시 행) 116건도 `runDeleteDeadSearchOPSRows()`(`71_Search_Engine.js`)로 삭제 완료. **잔존 미해결**: 옛날 ebook Marketo flow가 UTM 값이 없으면 `First Lead Source`를 "Organic Search"로 기본 처리하던 레거시 때문에, leadSource가 문자 그대로 "Organic Search"인 리드 중 일부는 실제로는 진짜 검색 유입이 아닐 수 있음(사용자 확인). 이번 라운드 수정들은 leadSource가 Paid Social 등 **명확히 다른 값**인 케이스만 해소했고, leadSource 필드 자체가 "Organic Search"로 잘못 찍혀 남아있는 잔존 레거시 리드는 식별 기준이 아직 없어(campaign/detail에 다른 신호가 전혀 없어 진짜/가짜 구분이 안 됨) 처리되지 않음 — 이후 재검토 시 별도로 다시 다룰 필요가 있다는 메모, 임의로 처리하지 말 것.
16. (완료 — 상세는 `docs/OpenItems_Legacy.md` #16 "Search Marketo 프로그램화 + git worktree 사고 복구" 참고)
17. **Target_Engine 단일 FY 구조 vs ACQ_REP/NewP1_REP 실적 달성률 비교의 근본적 불일치 —
    미해결, 우선순위 낮음(사용자 판단, 2026-07-30)** — `docs/exec-plans/active/2026-07-30-acq-newp1-target-columns.md`
    작업으로 `ACQ_REP`/`NewP1_REP`에 Revenue Target/New P1 Target/Target% 컬럼을 추가했으나,
    `Target_Engine`이 한 번에 Target FY 하나만 갖고 있는 구조라(Block 0의 "Target FY" 입력값
    기준으로 Block C/D 전체가 그 FY만 계산) 실 시트 검증 중 데이터 행이 전부 공란으로 나옴 —
    원인은 당시 `Target_Engine`이 FY27(다음 해 계획용)로 설정돼 있는데 사용자가 확인한 행은
    FY26(실적 있는 진행 중인 해)이라 애초에 비교할 Target이 없었던 것(버그 아님, 의도된
    hasOwnProperty 기반 공란 처리가 정상 동작). **문제**: 이 구조상 "올해(FY26) 실적이 목표
    대비 얼마나 왔는지"를 보려면 `Target_Engine`을 FY26으로 재생성해야 하는데, 그러면 이미
    입력해둔 FY27 계획(Block 0 월별 Spent/Revenue Target 등)을 덮어써야 하는 근본적 충돌이
    있음 — Target_Engine이 여러 FY를 동시에 지원하도록 재설계해야 근본 해결. **사용자 결정
    (2026-07-30)**: "타겟 설계를 바꿔봐야 할 것 같지만 캠페인 구축이 먼저" — 지금은 그대로
    두고 미해결로 남김, 임의로 처리하지 말 것. 상세: 위 exec-plan 참고.
19. (완료 — 상세는 `docs/OpenItems_Legacy.md` #19 "캠페인 지출(Ad_Spend_Cache) 독립 스케줄 갱신" 참고)
20. **ACQ_REP New P1 건수가 Salesforce 자체 리포트와 불일치(2026-07 기준) — 조사 진행 중,
    범위 정정됨(2026-08-05)** — **범위 정정**: 최초 보고 때는 "New Leads"(전체 Lead 수) 비교로
    이해했으나, 사용자 재확인 결과 **New P1**(ACQ_REP I열, Priority 1 유효 리드만) 비교였음 —
    Salesforce 쪽 205건도 전부 Priority 1로 필터된 값. ACQ_REP New P1 = **183건**, Salesforce
    Priority 1 Lead 수 = **205건**.
    **1차/2차 조사(당시엔 New Leads 전체로 오인하고 진행, 배경 조사로는 유효)**:
    `95_TempQA_JulyNewLeadsGap.js`의 `runCheckJulyNewLeadsGap()` — Leads_Master 7월 Create
    Date 행이 총 **1,266건**으로 Salesforce 목록(205건, 전부 존재·누락 0건) 대비 대량 중복
    확인(같은 Lead ID 평균 6회+ 반복 — 원인 미조사, 매주 export가 기존 Lead를 재중복 append할
    가능성). `runCheckJulyNewLeadsGapInOPS()` — Leads_OPS 7월 전체 Create Date 행은 619건,
    중복 0건(Lead ID당 1행 불변식은 Leads_OPS에서 유지됨 확인), Salesforce 205건 중
    `00QRC00001IUkqX` 1건만 Leads_OPS에 아예 없음.
    **`runRefreshACQSummary()`(31_ACQSummary.js) 재실행(672행, 34.55초) 후에도 ACQ_REP New
    P1이 183 그대로**라고 사용자 확인 — `generateACQReport_()`(Report Area 실제 표시 갱신)는
    `refreshACQSummary_()`(숨은 캐시 갱신)와 별개 단계이고 ACQ_REP의 E2 체크박스(onEdit)로만
    트리거되므로, 캐시만 갱신하고 Report Area를 다시 Generate 안 했다면 화면엔 이전 값이 남아있을
    수 있음(가설, 미확정 — 사용자가 E2 체크박스를 다시 체크해서 확인 필요).
    **3차 실행 결과(사용자 확인)**: `runCheckJulyNewP1GapInOPS()` 라이브 재계산도 정확히
    **183**(ACQ_REP과 일치) — 사용자가 ACQ_REP E2 "Generate Report" 재실행 후에도 183 그대로였던
    것과 부합, 캐시/Report 갱신 문제가 아님이 확인됨. 누락 24건 중 **23건은 Leads_OPS에
    "Priority 3"로 존재**(Salesforce는 Priority 1로 봄), 1건(`00QRC00001IUkqX`)은 Leads_OPS에
    아예 없음.
    **원인 가설(미확정, 2026-08-05)**: `22_OPS_Merge.js`의 `mergeOPS()`("Earliest-wins dedup",
    Email 그룹핑 후 Create Date가 가장 이른 행만 채택 — 원래 목적은 "같은 이메일의 서로 다른
    Lead ID"=진짜 재신청 구분용)가, 같은 Lead ID가 여러 번 재export되어 Leads_Master에 쌓인
    중복 행(위 1,266행/205 고유 발견과 동일 현상)에도 똑같이 적용되면서, Create Date가 동일한
    중복들 사이에서는 배열 순서(group[0], 사실상 가장 먼저 import된 오래된 스냅샷)로 판가름 나
    **최신이 아니라 오래된 스냅샷의 Priority 값이 채택됐을 가능성**을 발견 — 아직 실제
    Leads_Master 원본에 이 23건의 Priority 1 스냅샷이 존재하는지(=merge가 잘못 고른 것) 아니면
    애초에 없는지(=단순 export 지연, 버그 아님) 확인 전.
    **원인 확정(2026-08-05, `runDumpPriorityMismatchLeadHistory()` 실행 결과)**: 23건 전부
    동일 패턴 확인 — 낮은 rowIndex(먼저 import된 행)엔 "Priority 3", 높은 rowIndex(나중에
    import된 행)엔 "Priority 1". **단, `mergeOPS()`(`22_OPS_Merge.js`) 가설은 정정됨**:
    실제로 확인해보니 `findExactDuplicateLeadRows_()`/`findExactDuplicateLeadRowsToDelete_()`
    (`24_OPSQA.js`, Leads_Master 레벨 중복 탐지/삭제)는 Lead ID만으로 그룹핑하고 삭제 시
    "더 진행된 단계"(IC Booked/Completed/Won/Revenue)를 남기며 동점이면 "더 나중 행"을
    남기도록 이미 올바르게 설계돼 있음(Priority는 애초에 안 봄) — 즉 이 로직이 실행됐다면
    오히려 정답(Priority 1)이 남았어야 함. **진짜 문제는 `08_PipelineAsync.js`의
    `runLeadsPipelineTail()`(이 삭제 함수가 첫 단계로 정확히 배선돼 있음)가 이 배치들에
    대해 완료되지 못했다는 것**으로 추정(정확한 이유는 미확인 — 락 충돌로 스킵됐거나
    `rebuildLeadsMaster()` 등 tail을 안 타는 경로로 데이터가 들어왔을 가능성).
    **2차 버그 발견·수정(2026-08-05)**: `runAutoDeleteExactDuplicateLeadRows()`를 수동
    실행했더니 삭제 대상 659건을 찾았으나, `sheet.deleteRow()` 659회 반복 호출 도중(약
    3분여) 실행이 저절로 중단됨 — 한 행씩 삭제할 때마다 시트 전체가 재계산되는 게 원인으로
    추정. `groupConsecutiveDescendingRows_()`(순수 함수, 신규) + `sheet.deleteRows(start,
    count)` 구간 단위 호출로 교체해 해결(`24_OPSQA.js` v1.6.0) — 판정 로직
    (`findExactDuplicateLeadRowsToDelete_()`)은 변경 없음, 삭제 "방법"만 배치 처리로 교체.
    **✅ 해결 완료(2026-08-05, 사용자 확인)**: 배치 삭제로 수정된
    `runAutoDeleteExactDuplicateLeadRows()` 재실행(4초 완료) → `buildLeadsOPS()` →
    `runRefreshACQSummary()` → ACQ_REP Generate 재실행 결과 **New P1이 183 → 204로
    정상화**(Salesforce 205건 중 204건 일치). **남은 1건(`00QRC00001IUkqX`)은 버그
    아님** — `mergeOPS()`의 "1 Email = 1 진짜 최초 접점" 설계가 정확히 의도대로 동작한
    것(2023년 최초 Lead와 2026-07 재신청 Lead가 같은 이메일 → 재신청 쪽을 의도적으로
    제외, 로그로 직접 확인: `[mergeOPS] Duplicate skipped — Email: ggmoon69@gmail.com
    / Lead ID: 00QRC00001IUkqX ... (kept Lead ID: 00QBT0000029tBu, Create Date:
    2023-03-19)`). Salesforce의 단순 카운트는 이 이메일 기준 통합을 안 해서 205로 보임.
    **재발 방지 조치 2건(같은 세션, 2026-08-05)**:
    1. `24_OPSQA.js` v1.6.0 — 위 배치 삭제 성능 수정 자체.
    2. **`08_PipelineAsync.js` v1.7.0 — 죽은 락(PIPELINE_LOCK) 자동 해제 버그 수정**:
       중복이 누적될수록 옛 `deleteRow()` 반복 버전의 실행 시간이 계속 늘어나다 결국
       Apps Script 플랫폼이 실행을 강제 종료 → `runLeadsPipelineTail()`의 최상위
       try/catch(JS 예외만 처리 가능)가 개입 못 해 `releasePipelineLock_()`가 호출
       안 되고 락이 영구히 남아 그 이후 모든 Import의 백그라운드 처리가 계속
       스킵되는 구조적 문제를 발견 — 이게 중복이 몇 주간 자체 복구 없이 쌓인 진짜
       배경 원인으로 추정(간접 증거, 과거 실행 로그로 직접 확정한 것은 아님).
       `CONFIG.PIPELINE.LOCK_STALE_THRESHOLD_MS`(30분)보다 오래된 락은 자동으로
       해제되도록 수정 — 수동 개입 없이 다음 Import부터 정상 복구됨.
    **알려진 잔여 갭(낮은 우선순위, 코드 수정 안 함)**: `buildLeadsOPS()`를
    파이프라인 tail이 아니라 단독으로 수동 실행하면 `refreshACQSummary_()` 등 하위
    캐시가 자동 갱신되지 않음(오늘 조사 중 실제로 이 때문에 한 차례 혼동 발생) —
    파이프라인 tail 경유 시엔 문제없음(이미 순서대로 다 호출), 편집기에서
    `buildLeadsOPS()`를 직접 Run할 땐 이 사실을 기억할 것.
21. **Search_OPS Campaign/Impressions/Link clicks/Spent/Results 자동화(Naver Search Ad API) — 구현 및 파이프라인 편입 완료(2026-08-05), 매핑 5개 확인/애드그룹 분해 검토는 TODO** — 사용자 요청으로 `GROUP_3_MANUAL`(전부 수동 입력)에서 `Campaign`/`Impressions`/`Link clicks`를 분리해 Naver Search Ad API 자동 매칭으로 전환(`Reach`만 Naver API에 해당 지표가 없어 계속 수동).

**Results 자동화 완료(2026-08-05)**: `runDebugNaverSearchAdStatsExpandedFields()`(AD_003_NaverSearch.js)로 후보 필드(ctr/cpc/avgRnk/ccnt/ccnt1d)를 개별 실측 — `ctr`/`cpc`/`avgRnk`/`ccnt`는 200 정상 응답, `ccnt1d`만 `{code:11001}` 400(유효하지 않은 필드명). `ccnt` 값이 항상 clkCnt 이하로 응답돼 "전환수"로 판단(사용자 확인) — Spent와 동일한 누적 캐시 패턴으로 `results` 필드 추가, `70_Search_Config.js` v1.6.0에서 GROUP_3A_AUTO로 이동. Spent와 달리 통화 변환이 없어 FX 실패와 무관하게 impressions/clicks처럼 항상 갱신.

**배포 직후 버그 발견·수정(2026-08-05)**: 사용자 실측 결과 Spent/Results가 0으로 표시됨 — 원인은 이 코드 배포 이전에 이미 오늘자 갱신이 한 번 돌아서(구버전 호출, salesAmt/ccnt 없이) `refreshNaverSearchAdCampaignStatsCache_()`의 "오늘 이미 갱신됨" 가드가 신규 필드 요청 자체를 막고 있었던 것. `backfillNaverCampaignStatsSpentResults_()`/`runBackfillNaverSearchCampaignStatsSpentResults()`(1회성, impressions/clicks 누적 진행률과 무관하게 최근 90일 스냅샷으로 Spent/Results만 채움) 신규 추가·실행으로 해소.

**Spent 전체 기간 소급 완료, Results는 API 하드 리밋으로 90일 롤링 확정(2026-08-05)**: 90일 백필 후에도 사용자가 "캠페인 시작일(2025년 중반)부터의 전체 금액치고 작다"고 지적 — `runDebugNaverSearchAdStatsCcntRangeLimit()`로 실측한 결과 **`ccnt`는 salesAmt와 같이 요청하든 안 하든(impCnt/clkCnt 없이 salesAmt+ccnt만 400일로 요청해도) 92일 제약을 그대로 받음**(`{code:11004}` 400 재현) — Results는 API 구조상 92일 롤링 윈도우가 하드 리밋으로 확정, 전체 기간 소급이 원천적으로 불가능함. 반면 **`salesAmt` 단독 요청은 이미 Ad_Spend_Cache 파이프라인(`computeNaverSearchAdSpendHistorySummary_()`)에서 730일까지 확인돼 있어 Spent만 전체 기간 소급 가능** — `accumulateNaverCampaignSpendKrwByName_()`(순수 함수) + 1회성 `runBackfillNaverSearchCampaignSpendHistory()`가 동일 패턴(캠페인 목록 1회 조회 + `BACKFILL_START`부터 매달 salesAmt 단독 조회, 730일 밖 에러만 건너뜀)을 캠페인 이름 단위로 재사용해 spentKrw를 0으로 리셋 후 전체 재계산(impressions/clicks/results는 불변). **Results는 최근 90일 롤링 값이라는 한계를 사용자에게 안내 완료(코드 수정 불필요, API 자체 제약) — 재검토하지 말 것.**

**Spent 자동화 추가(2026-08-05, 사용자 요청)**: `Results`/`Spent`도 자동화해달라는 요청 중 `Spent`만 우선 구현 — Naver `/stats`의 salesAmt(KRW)를 impCnt/clkCnt와 같은 92일 누적 캐시 호출에 얹어 캠페인별로 누적(`accumulateNaverSearchAdCampaignStats_()`, `Naver_Search_Campaign_Stats_Cache`에 "Spent (KRW)" 컬럼 추가), `72_Search_Build.js`가 `fetchKrwToNzdRate_()`(AD_004_SpendCache.js, GOOGLEFINANCE 기반)로 구한 환율로 NZD 변환(`convertNaverCampaignStatsSpendToNZD_()`, 사용자 확정 — 기존 Search_OPS Spent 컬럼도 NZD라 통일) 후 Search_OPS "Spent"(GROUP_3A_AUTO로 이동, 70_Search_Config.js v1.5.0)에 매칭. 환율 조회 실패 시 Campaign/Impressions/Link clicks는 정상 갱신하되 Spent는 이번 실행에서 스킵(기존 값 보존 — `applySearchNaverCampaignStats_()`가 `match.spent === undefined`면 Spent 컬럼을 건드리지 않도록 방어). **`Results`는 보류**: Naver Search Ad `/stats` API에 전환수(conversion count) 등 대응 필드가 있는지 공식 문서 사이트가 SPA라 스크레이핑으로 확인 불가 — `runDebugNaverSearchAdStatsExpandedFields()`(AD_003_NaverSearch.js, ctr/cpc/avgRnk/ccnt/ccnt1d 등 후보 필드를 추가 요청해 실측하는 진단 함수) 신규 작성, 사용자가 Apps Script 편집기에서 직접 Run 후 결과 확인 필요 — 결과 나오기 전까지 Results 자동화는 착수하지 말 것. **누적 캐시 아키텍처**: Naver `/stats`가 impCnt/clkCnt 필드에 한해 "최근 92일 이내"만 조회 가능함이 실측 확인됨(당초 salesAmt 파이프라인과 같은 730일로 가정했으나 틀렸음, `AD_003_NaverSearch.js` v2.6.0에서 실측 후 수정) — 매번 전체 재계산 대신 `Naver_Search_Campaign_Stats_Cache`(신규 숨김 시트)에 캠페인별 누적치를 영구 보관하고 매 refresh마다 "지난 갱신 이후~오늘"만 더함(사용자 확정, 2026-08-05). `08_PipelineAsync.js`의 `refreshNaverSearchCampaignStats_()`로 두 파이프라인 테일 모두에 배선(매 Leads/MTA Import마다 자동), 실패는 비필수 처리. **네임스페이스 불일치 발견·부분 해소**: Naver 캠페인의 실제 이름(예: `KR_core_brand_contact`)과 Search_OPS 키(Marketo Program명, 예: `2025-07-KOR-Naver SA Brand`)가 서로 다른 시스템이라 직접 매칭이 거의 안 걸림(사용자 확인, 실캠페인 10개 중 직접 일치 0개) — `73_Search_Merge.js`의 신규 `NAVER_CAMPAIGN_NAME_TO_SEARCH_OPS_KEY_OVERRIDE`(71_Search_Engine.js의 `SEARCH_UTM_TO_PROGRAM_OVERRIDE`와 동일 관행)에 사용자가 육안 대조해준 5개 매핑 반영(brand/transfer-gap-year/competitors/ecl-consult/study-consult). ~~나머지 5개 캠페인(`KR_core_college-spec-1_contact`/`topic-spec-1_contact`/`competitions_contact`/`HStoDS_contact`/`expo_earlybird2_ptc`)은 대응하는 Marketo Program을 사용자가 아직 확인 안 함~~ — **2026-08-05 후속 세션에서 10개 전부 매핑 완료**(사용자가 육안 대조로 확인): `KR_core_college-spec-1_contact`→`2025-07-KOR-Naver SA College Specific`, `topic-spec-1_contact`→`2025-07-KOR-Naver SA UK Meds`, `competitions_contact`→`2025-07-KOR-Naver SA Competitions`, `HStoDS_contact`→`2025-07-KOR-Naver SA Brand`(기존 `brand_contact`와 같은 키 공유), `expo_earlybird2_ptc`→`WF-2026-03-KOR-MOFU-Core Expo Naver Search`. **부수 발견·수정 2건**: (a) `expo_earlybird2_ptc`가 `getBusinessSegment()`(16_TransformHelper.js)에서 캠페인명의 "expo" 키워드 때문에 Seminar로 우선 판정되고 있었으나, 사용자 확인 결과 실제로는 상담신청(ptc) 캠페인으로 Search가 맞음 — `BUSINESS_SEGMENT_EXCEPTIONS`에 예외 추가(v1.13.0), Search_Engine이 Business Segment=Search만 집계하는 구조라 Search_OPS 키 매핑만으로는 부족했던 것. 이 변경은 Search_OPS뿐 아니라 ACQ_REP 등 Business Segment를 쓰는 전체 리포트에 영향(사용자 확정 후 적용). (b) **버그 발견·수정**: `HStoDS_contact`가 기존 `brand_contact`와 같은 Search_OPS 키를 공유하게 되면서, 2개 이상의 Naver 캠페인이 같은 키로 번역될 때 나중 처리된 캠페인이 먼저 것을 조용히 덮어써 통계가 누락되는 문제 발견 — `buildNaverCampaignStatsLowerKeyMap_()`(73_Search_Merge.js v1.5.0)가 충돌 시 impressions/clicks를 합산하고 Campaign명은 " + "로 연결하도록 수정(사용자 확인). Node vm 하네스로 신규 테스트 전부 PASS, `check-syntax`/`check-naming`/`check-version-header`/`check-duplicate-declarations` 전부 통과. **잔여 TODO 1건**: `kr_core_study-consult_contact`는 Naver 콘솔에서 애드그룹 단위로 US/UK 리드가 섞여 있어 정확히 분리 불가능 — 대부분 US라 근사치로 US Marketo Program(`2025-07-KOR-Naver SA Study Consultants US`)에 일괄 매핑(사용자 확정, 2026-08-05) — Naver Search Ad API가 애드그룹(adgroup) 단위 `/stats`를 지원하는지 검토해 가능하면 분리, 안 되면 Naver 콘솔에서 캠페인 자체를 US/UK 2개로 나누는 방안(광고 운영 조치, 코드 밖)을 사용자가 검토할 것 — 임의로 처리하지 말 것.
22. **Marketo Campaign ↔ UTM 딕셔너리 구축 — 구현 완료(2026-08-08)** — 2026-08-06 신규 TODO로
    기록된 항목, 2026-08-08 세션에서 Kakao Moments Marketo program 수기입력 문제를 계기로 착수·구현.
    `17_UtmProgramDictionary.js` 신규(MTA_Master `MKT UTM Campaign`/`Lead Source Detail`에서
    자동 채굴, 다수결+확신도 기록, `UTM_Program_Dictionary` 숨김 캐시 시트). Kakao Moments
    `Marketo program` 컬럼 자동 채움에 연동 완료(AD_006_KakaoMoments.js). 상세: `docs/Changelog.md`
    2026-08-08 "UTM Campaign ↔ Marketo Program 딕셔너리 신규 구축" 섹션.
    **기존 21번 항목의 `SEARCH_UTM_TO_PROGRAM_OVERRIDE`(71_Search_Engine.js)/
    `NAVER_CAMPAIGN_NAME_TO_SEARCH_OPS_KEY_OVERRIDE`(73_Search_Merge.js)는 이번에 안 건드림**
    (기존 출력 변경 금지 원칙) — Search_OPS 키(ad-spend 매칭용) 문제라 Business Segment
    분류와는 별개 관심사, 여전히 안 건드림.
    **알려진 한계(구조적, 코드로 해결 불가 — 사용자 확인 완료)**: Consolidated/Pmax류 복합
    캠페인은 UTM 하나가 실제로 여러 Marketo Program과 진짜 1:N으로 매칭됨(예: 한 UTM이 실제
    리드 데이터상 8개 서로 다른 eBook Program과 매칭 확인됨, `runDebugMtaMasterTouchesForUtm()`
    진단 결과) — 이런 UTM은 자동 채움에서 의도적으로 제외되고 계속 빈 값으로 남음
    (`readUtmProgramDictionaryMap_()`이 Distinct Program Count > 1 항목 제외).
    **2026-08-26 후속 — "이 신규 딕셔너리로 Business Segment 분류를 대체할지" 논의 완료 및
    구현**: `WF-2026-08-KOR-BOFU-Core Google SA ...` 캠페인이 이름 속 "BOFU" 퍼널 태그 때문에
    `getBusinessSegment()` 키워드 규칙으로 오분류되는 버그를 계기로, 사용자가 "Lead 유입 →
    Dictionary 조회 → Business Segment 분류" 플로우 도입을 확정. `UTIL_002_UtmProgramDictionary.js`
    에 Program↔Business Segment 딕셔너리(`Program_Segment_Dictionary`, 동일한 자동 채굴+다수결
    패턴)를 신규 추가하고, `resolveBusinessSegment_()`(딕셔너리 히트 시 우선 사용, 미스 시
    기존 `getBusinessSegment()` fallback)를 `MASTER_006_LeadTransformer.js`/
    `MASTER_007_MTATransformer.js`가 호출하도록 전환 — `getBusinessSegment()` 자체는 시그니처/
    로직 변경 없음(Article 7 유지). 딕셔너리 갱신도 `runInstallDictionaryPeriodicRefreshTrigger()`
    로 주기적 시간 트리거(기본 12시간) 자동화 추가 — 단, 리드 유입 파이프라인(매 append)에는
    여전히 얹지 않고 별도 스케줄로 분리. 상세: `docs/BusinessSegmentClassification.md`
    2026-08-26 항목. **미완료**: 기존 Leads_Master/MTA_Master 행에 소급 적용하려면
    `TEMPQA_034_BusinessSegmentDictionaryDiff.js`로 영향 범위(diff) 먼저 검토 후
    Full Rebuild 여부 사용자가 결정 — 아직 실행 전, 임의로 Full Rebuild 진행하지 말 것.
23. (완료 — 상세는 `docs/OpenItems_Legacy.md` #23 "QA 에이전트 설계" 참고)
24. **원하는 파이프라인 순서(1차 import → master 업로드 → marketo-utm 매칭 → QA → 비즈니스
    세그먼트 분류 → QA → OPS 싱크)를 화/금 자동 리마인더 routine으로 걸어두고 싶다는 요청 —
    routine 미구현, 당분간 수동 진행으로 보류(2026-08-09)** — 사용자가 매주 월/목 리드 업로드
    기준으로 화/목요일에 Biz Segment QA(`biz-segment-qa` 서브에이전트)/UTM 매칭 QA
    (`utm-matching-qa` 서브에이전트)를 routine으로 자동 실행하고 싶어함. `/schedule` 스킬로
    확인한 결과, 클라우드 routine은 격리된 sandbox(이 repo git checkout만 접근 가능)에서 돌아서
    **실제 Google Sheet를 읽거나 Apps Script 함수를 실행할 방법이 없음**(23번 항목과 동일한
    근본 제약 — Sheets API/MCP/`clasp run-function` 전무) — 즉 routine이 QA를 대신 완료해줄 수
    없고 "지금 이 함수 돌릴 차례예요"라는 텍스트 리마인더 역할까지만 가능. 사용자에게 리마인더를
    어떤 형태(예: GitHub Issue 자동 생성)로 받을지 물었으나, **일단은 수동으로 진행하기로 결정**
    — routine 생성은 보류, 이 항목으로 로그만 남김. 두 서브에이전트(`.claude/agents/
    biz-segment-qa.md`/`.claude/agents/utm-matching-qa.md`) 자체는 이미 생성 완료(§9,
    `docs/QAAgentDesign.md`) — 수동으로 부를 때는 정상 사용 가능. 향후 `clasp run-function` 또는
    Sheets API/MCP 연동이 생기면 이 routine 자동화를 재검토할 것 — 임의로 착수하지 말 것.
25. **OPS QA 결과(Total Issues 9765건) — 미해결로 보류, 다음 세션 확인 필요(2026-08-09)** —
    Biz Segment 룰 수정(24번 항목 인접 세션 작업, `UTIL_001_TransformHelper.js` v1.15.0/v1.16.0)
    반영을 위한 `rebuildLeadsMaster()` → `buildLeadsOPS()` 재실행 중 `runOPSQA_()`가 출력한 값 —
    Funnel Match 불일치(IC Booked Date 2904/IC Completed Date 2769/Opportunity Won Date 2696),
    Revenue Existence 746, Exact Duplicate Lead Row 650. 사용자 확인 — 오늘 세션 범위 밖이라
    **의도적으로 미해결 상태로 둠**, 원인 조사·처리는 다음 세션에서. 임의로 손대지 말 것.
26. (완료 — 상세는 `docs/OpenItems_Legacy.md` #26 "Sales Accepted Date 과거 오염 데이터 복구" 참고)
27. (완료 — 상세는 `docs/OpenItems_Legacy.md` #27 "S&M_REP Leads breakdown New P1 Salesforce 불일치" 참고)
28. (완료 — 상세는 `docs/OpenItems_Legacy.md` #28 "Events_OPS 데이터 오염 여부 감사" 참고)
29. (완료 — 상세는 `docs/OpenItems_Legacy.md` #29 "getBusinessSegment Paid Social 회귀 테스트 FAIL 수정" 참고)
30. (완료 — 상세는 `docs/OpenItems_Legacy.md` #30 "BOFU_OPS/Content_OPS Meta 매칭 커버리지" 참고)
31. (완료 — 상세는 `docs/OpenItems_Legacy.md` #31 "Target_REP Actual CPNP1 과소/과다집계 버그" 참고)
32. ~~ACQ_REP 이번 달 IC Booked/Complete 구조적 과소집계~~ — **✅ 실사용 검증 완료(2026-08-28)**,
    아래는 진행 경과 기록(참고용). 사용자가 Salesforce "leads report"(IC
    Booked Date=이번 달, 전체 세그먼트)
    42건 대비 ACQ_REP IC Booked 21건, IC Complete는 Salesforce 21~22건 대비 ACQ_REP 7건으로
    괴리 보고. `TEMPQA_032_ICBookedAugustSalesforceDiff.js`로 Salesforce Email 목록을
    Leads_Master→Leads_OPS→MTA_Master 순으로 대조한 결과: (1) 1건(redrock333@yahoo.com)만
    진짜 sync 버그(신규 리드 생성과 `syncMTAFunnelToOPS_()` 실행 사이 일회성 타이밍 공백) —
    `runSyncMTAFunnelToOPS()` 재실행으로 해결(8,294건 갱신, IC Booked 21→22). (2) 2건은
    Leads_Master에도 없음(신규 리드, Import 대기 — 코드 문제 아님). (3) **나머지 대다수(IC
    Booked 17건, IC Complete 14건, 재sync 이후에도 불변)는 MTA_Master에 그 리드의 터치는
    있지만 어떤 터치 행에도 이번 달 IC Booked/Completed Date 값 자체가 없음** — sync 버그가
    아니라 구조적 원인.
    **근본 원인**: `IC Booked Date`/`IC Completed Date`는 Lead 레벨 스냅샷 필드라, MTA
    리포트에 그 리드의 **새 터치(마케팅 액티비티)가 export될 때만** 그 시점의 최신 상태가
    실린다(`computeMTAFunnelByLeadId_()`, `MASTER_003_MTAFunnelSync.js`). 이 리드들은
    SAL(Sales Accepted) 전후로 마지막 마케팅 터치가 있었고, 그 이후 세일즈 내부 프로세스로
    IC Booking/Completion이 진행된 것으로 보이는데(터치 타임라인 실측 확인) 그 사이 새
    마케팅 터치가 없어 우리 파이프라인이 그 변화를 실을 방법이 없었음 — 재Import를 반복해도
    그 리드가 다시 터치되기 전까진 계속 공란으로 남는 구조.
    **과거 이력과의 연관**: 2026-07-21에 정확히 이 문제를 풀기 위한 별도 Lead-level
    리포트/파이프라인(`ICFunnel_Raw` 시트 + `syncICFunnelToOPS()`, 터치와 무관하게 IC
    Booked/Completed/Won Date를 직접 주간 export)이 있었으나 "SAL 판별이 사실상 IC Booked
    Date 존재 여부와 동일"하다는 이유로 MTA_Master 통합 방식(`syncMTAFunnelToOPS_()`)으로
    대체되며 제거됨(`docs/Changelog.md` "IC Funnel Sync 구축 및 검증" 섹션) — 그 통합이 이번
    과소집계의 구조적 원인으로 추정.
    **✅ 해결책 구현 완료(2026-08-26)**: `ICFunnel_Raw` 재도입 — 사용자 결정: IC Booked/
    Completed/**Opportunity Won Date 3개 필드** 전용(Revenue/SAL은 이미 별개 메커니즘으로
    해결돼 있어 제외), `MASTER_003_MTAFunnelSync.js`(MTA_Master 기반)는 이 3개 필드에서
    완전히 손을 떼도록 필드 소유권 분리(두 파이프라인이 같은 필드를 다른 순서로 덮어쓰는
    위험 제거). 신규 `MASTER_009_ICFunnelSync.js`(`syncICFunnelToOPS_()`, Master 빌드
    단계 없음 — Raw→직접 Leads_OPS sync) + `CONFIG.IC_FUNNEL`(`CORE_001_Config.js`
    v1.43.0, 사용자가 실제 만든 Salesforce 리포트의 export 헤더로 필드명 확인 완료,
    day-first 날짜라 `RAW_DATE_COLUMNS.IC_FUNNEL`로 Plain Text 보호) + `importICFunnelReport()`
    메뉴 진입점 복원("📥 Update → Import IC Funnel", `IMPORT_001_Import.js`).
    Node vm 하네스 신규/회귀 테스트 전부 PASS, 체크 스크립트 전부 통과, clasp push 완료.
    **2026-08-26 후속 — 백그라운드 트리거로 전환**: 처음엔 동기 호출로 구현했으나, sync
    끝의 7개 Engine refresh(Leads_OPS/MTA_Master 전체 스캔)가 IC Funnel 데이터 크기와
    무관하게 그 자체로 무거워 업로드 다이얼로그가 안 끝나는 문제를 사용자가 실제 전체기간
    Import(36,464행) 중 발견 — `appendNewLeads()`/`appendNewMTA()`와 동일한 설치형
    1회성 백그라운드 트리거 패턴으로 재수정(`scheduleICFunnelPipelineTail_()` +
    `runICFunnelPipelineTail()`, `MASTER_002_PipelineAsync.js`, `PIPELINE_LOCK`
    Leads/MTA와 공유). **2026-08-26 추가 후속 — README 표시 추가**: 처음엔 README
    Pipeline Status 표 미반영으로 남겼으나 사용자 요청으로 3번째 행("IC Funnel")
    추가(`buildPipelineStatusGrid_()`/`pipelineStatusPropertyKey_()`) — 이미 자리잡은
    3행 블록에 안전하게 1행만 끼워넣는 마이그레이션 포함.
    **2026-08-26 추가 후속 — OPS 시트/Report 화면까지 재생성(사용자가 실행 로그로 발견)**:
    처음엔 `syncICFunnelToOPS_()`(숨겨진 Engine 캐시만 갱신)만 부르고 끝나서, ACQ_REP
    화면의 IC Booked/Complete 수치가 다음 Leads/MTA Import 전까지 교정 안 되는 구멍이
    있었음 — `runMTAPipelineTail()`과 동일하게 `refreshOPSSheets_()`/
    `refreshReportFYDropdowns_()`/`refreshReportGenerate_()`까지 이어서 실행하도록
    확장(`runICFunnelPipelineTail()` v1.18.0). 상세: `docs/Changelog.md` 2026-08-26,
    `docs/ACQReportDesign.md`/`docs/OperationsLayer.md`/`docs/ImportPipeline.md` 해당 섹션.
    **✅ 실사용 검증 완료(2026-08-28)**: 2026-08-27 세션에서 `runICFunnelPipelineTail`(Time-Driven)이
    IC Funnel Sync~Events Engine까지 정상 완료했고(BOFU 단계의 별개 `Error code INTERNAL`은
    일시적 인프라 결함, `docs/apps-script-gotchas.md` #12), 재업로드 후 한동안 살아있던
    `PIPELINE_LOCK`도 30분 self-heal로 정상 해소된 것을 확인 — Leads_OPS에 IC Funnel 데이터가
    이미 반영된 상태였음. `TEMPQA_032_ICBookedAugustSalesforceDiff.js`의
    `runCompareICBookedAugustAgainstSalesforce()`/`runCompareICCompleteAugustAgainstSalesforce()`
    (코드 수정 없이 그대로 재실행, Leads_OPS 값을 직접 비교하는 방식이라 필드 소유권이
    MTA_Master→ICFunnel_Raw로 바뀐 것과 무관) 재실행 결과: **IC Booked 21/42 → 39/42, IC Complete
    7/21 → 19/21로 대폭 개선**, `syncBugSuspect`/`mtaMissingValue`/`mtaMissingTouch`/`notInOps`
    전부 0건 — 남은 갭 전부(IC Booked 3건, IC Complete 2건, 부분집합) **sync 버그가 아니라
    Leads_Master에 아예 존재하지 않는 순수 Import 공백**(`lyj79bada@gmail.com`/
    `micyoo@gmail.com`/`ian.han0408@gmail.com` — 다음 Leads Import 때 포함되면 자동 해소,
    코드 조치 불필요). ICFunnel_Raw 재도입이 의도대로 완전히 동작함을 최종 확인, 이 항목 완결.
    **✅ 추가 검증(2026-08-28, 사용자가 신선한 Salesforce IC Booked 리포트 52건 제공)**:
    `TEMPQA_040_ICBookedAugustSalesforceLeadTrace.js`로 재대조 — 42건 정상, 5건 순수 Import
    공백(그중 3건은 위와 동일한 잔여 3명), **나머지 5건은 `runSyncICFunnelToOPS()` 재실행 후에도
    안 풀림**. `runTraceICBookedSyncGapLeadIds()`로 Lead ID를 Leads_Master/Leads_OPS/
    ICFunnel_Raw 3단 직접 대조한 결과 Lead ID는 전부 일치 — **원인은 sync 버그가 아니라
    ICFunnel_Raw 자체에 이 5건의 IC Booked Date 값이 비어있음**(5건 전부 SF IC Booked
    Date=8/26 최신일이라, 마지막 IC Funnel export가 이 5건의 예약 확정 이전 시점에 뽑힌
    리포트였던 것으로 결론 — 코드 문제 아님). **남은 것(TODO)**: 사용자가 평소 IC Funnel
    import에 쓰는 리포트 템플릿(Lead ID 포함 필수)으로 최신 데이터를 재export → "📥 Update →
    Import IC Funnel" 재업로드 → 재sync 후 이 5건 해소 확인.
33. (완료 — 상세는 `docs/OpenItems_Legacy.md` #33 "Won/Lost Deal IC Booked/Completed Date 없이 전환" 참고)
34. (완료 — 상세는 `docs/OpenItems_Legacy.md` #34 "Business Segment 딕셔너리 특이 분류 모니터링 프로세스" 참고)
35. **New P1 8월 갭(279 vs 267) — `Lead Priority` 필드 스냅샷 지연 확인·부분 해결(2026-08-28),
    나머지는 사용자 액션 대기(TODO)** — 사용자가 제공한 Salesforce 8월 New Leads CSV(739건,
    Priority 1=279건)를 `TEMPQA_037_NewP1AugustSalesforceLeadTrace.js`로 대조한 결과 10건이
    `Leads_Master`의 `Lead Priority`가 예전 스냅샷(Salesforce에서 이미 승급됐는데 반영 안 됨)인
    것으로 확인 — IC Booked/Completed/Won Date(#32)와 같은 클래스의 "Lead 레벨 스냅샷이 새
    export 전까지 안 바뀌는" 구조적 문제. `MASTER_003_MTAFunnelSync.js`/`MASTER_009_
    ICFunnelSync.js`에 Lead Priority 역동기화 추가(사용자 확정 — MTA+ICFunnel 둘 다), 순서
    무관 안전을 위해 `applyPriorityDowngradeGuard_()`(`UTIL_001_TransformHelper.js`, "더 높은
    Priority만 채택")를 공용 적용. **남은 것(TODO)**: (1) 10건 중 6건은 MTA_Master에 이미 최신
    값이 있어 `runSyncMTAFunnelToOPS()` 실행으로 즉시 해결 가능 — 사용자에게 실행 요청은 했으나
    세션 종료로 결과 미확인, 다음 세션에 재확인 필요. (2) 나머지 4건은 사용자가 Salesforce IC
    Funnel 리포트에 "Lead Priority" 컬럼을 추가해 재export/재import해야 해소됨(코드만으론 불가,
    `CONFIG.IC_FUNNEL.COLUMNS.LEAD_PRIORITY`는 optional로 이미 준비됨) — 아직 안 됨. 다음 세션에
    `TEMPQA_037_NewP1AugustSalesforceLeadTrace.js`의 `runCompareAugustNewP1AgainstSalesforce()`
    재실행으로 최종 검증할 것.
    **2026-09-09 재검증 — 아키텍처 변경으로 위 "6건 즉시 해결" 경로 자체가 사라졌음을 발견**:
    `runCompareAugustNewP1AgainstSalesforce()` 재실행 결과 279건 중 266건 정상 일치(3건은
    #20류 mergeOPS 구조적 배제로 정상, 10건은 여전히 스냅샷 지연) — **2026-08-28 당시와 정확히
    같은 10명**이 그대로 남아있어 원인 재조사. `MASTER_003_MTAFunnelSync.js`가 **2026-09-02
    (v1.10.0)에 Lead Priority 역동기화 자체를 완전히 제거**(Leads_OPS 필드 소유권 재편 —
    Revenue/Lead Priority를 이 파일에서 빼고 `#Touches`만 관리하도록 재설계)했다는 걸 이번에
    확인 — 즉 "MTA_Master 보면 6건 바로 해결"이라던 2026-08-28 진단 경로 자체가 그 이후
    사라진 것. 현재 Lead Priority의 유일한 소유 경로는 New Leads(Leads_Master 재수입) +
    `MASTER_009_ICFunnelSync.js`(ICFunnel_Raw, 다운그레이드 가드) 조합. 신규
    `TEMPQA_056_ICFunnelLeadPriorityBacklogCheck.js`(`runCheckICFunnelLeadPriorityBacklog()`)
    로 이 10명을 ICFunnel_Raw에서 직접 조회한 결과 **10명 전부 ICFunnel_Raw에 딱 1행뿐이고
    IC Booked Date/Lead Priority 둘 다 공란** — Lead Priority 컬럼이 헤더에 추가된
    이후로 이 10명은 단 한 번도 새로 export된 적이 없다는 뜻(#38 SAL 헤더 버그와 같은
    시기의 옛날 행 하나만 남아있음). **결론**: 코드 버그 아님 — 소스 데이터가 신선하지
    않을 뿐. #38(SAL)과 동일한 해법으로 해소 가능할 것으로 예상: **Salesforce IC Funnel
    리포트를 (Lead Priority 컬럼 포함) 전체 재export → "📥 Update → Import IC Funnel"
    재업로드**하면 이 10명 포함 유사 케이스 전체가 갱신될 것 — 아직 실행 전, 사용자 액션
    대기(TODO). 재export 후 `runCompareAugustNewP1AgainstSalesforce()` 재실행으로 최종
    확인할 것.
36. ~~Events_OPS Meta 캠페인 오매칭(CVR 71.3% 등 비정상 수치)~~ — **✅ 근본 원인 규명 및 수정
    완료(2026-08-28)**, "Recording" 변형 0 문제만 별도 미해결로 남음. 사용자 보고로 "WB-2026-07-
    KOR-MOFU-Core Game Changing Common Application Tips & Case Studies" 웨비나의 CVR 71.3%/
    Spent $10,706.41/Clicks 19,827/Results 14,146이 비정상적으로 큰 것 발견.
    `TEMPQA_038_EventsGameChangingWebinarMetaAudit.js` 조사 결과 원인은 `KR_core_2024-07-19_
    landing-page-tofu_traffic`(2024년 7월부터 지금까지 도는 무관한 범용 TOFU 트래픽 캠페인)이
    소수 귀속 터치의 우연한 쏠림으로 `UTM_Program_Dictionary`에서 이 웨비나 Program 하나로
    "모호하지 않음" 판정받아, 2년치 누적 Spend/Clicks 전체가 이 웨비나에 잘못 귀속된 것으로
    확인(사용자 확인). `UTIL_002_UtmProgramDictionary.js`에 `UTM_PROGRAM_DICT_MANUAL_EXCLUSIONS`
    신규 도입(`readUtmProgramDictionaryMap_()` 모든 소비처 — Events/BOFU/Content/Search Spend
    매칭 + Business Segment 분류 — 공통 적용) 후 이 UTM 등록. **후속 전수 감사**(사용자 요청
    "TOFU면 다른 프로그램에도 포함되면 안돼"): `TEMPQA_039_TrafficUtmDictionaryAudit.js`로
    "traffic"/"tofu" 포함 딕셔너리 32건 전수 검토 — "tofu"라는 단어 자체는 이 계정에서 그냥
    퍼널단계 네이밍 태그일 뿐 무관 신호가 아님이 확인됨(대부분 정상 매칭, 예: "Essay Comp 2025"
    417/417건 완전 일치) — blanket 배제 규칙은 도입하지 않음. 이름·매칭 Program 주제가 실제로
    안 맞아 보이는 2건만 사용자 확인 후 추가 등록(`kr_core_2025-07-19_stanford-analysis-
    case-study-event-tofu_traffic`/`wb-2023-01-usa-tofu-core chinese-webinar-trend-analysis-
    david`). **미해결(별도 원인, 남은 범위)**: "Recording" 변형은 매칭되는 Meta 캠페인이 애초에
    0개 — 유료 광고 자체가 없는 정상 상황인지 UTM이 다르게 잡힌 문제인지 구분 안 됨, Meta Ads
    Manager에서 직접 확인 필요(사용자 액션 대기). **소급 적용 관련**: `resolveBusinessSegment_()`
    도 같은 딕셔너리를 쓰므로 이번에 제외한 3개 UTM 키에 걸린 이미 빌드된 Leads_Master/
    MTA_Master 행의 Business Segment는 소급 반영 안 됨(표본 1~2건씩이라 영향 미미로 판단,
    #22 기존 방침대로 rebuild는 보류 — 사용자 확인, 필요시 diff 먼저 확인 후 별도 결정).
37. **JL(외부 "[FY27] Korea Sales and Marketing Monthly Metrics" 시트) 자동 export — 구현
    완료(2026-09-01), Aug-26 실측 대조 검증 대기(TODO)** — 사용자가 공유 중인 외부 시트
    (gid `316435961`, Josephine/Junyong/Simon과 공유)의 B21:M26(Monthly Sales Achieved/No of
    MQLs/No of SALs/No of ICs Completed/Marketing Spend/No of New Accounts Won), B42:M44
    (Referral IC Complete/Revenue/Accounts Won), B49:M50(Non-Referral IC Complete/Revenue)를
    ACQ_REP(ACQ_Summary)/Ad_Spend_Cache/Deal Tracker에서 매일 자동으로 채워 넣어달라는 요청
    (2026-09-01). `JL_001_Config.js`(설정)/`JL_002_Engine.js`(순수 계산, 단위 테스트 5개
    전부 PASS)/`JL_003_Write.js`(외부 시트 I/O)로 구현. **지표 매핑은 실 시트 라이브 접근이
    막힌 상태(Apps Script 편집기 계정이 이 브라우저 세션 Google 계정과 달라 `script.google.com`
    접근 거부)에서 사용자가 알려준 Aug-26 실측값을 역산 대조해 추정 확정한 것** — 특히 (1)
    "No of New Accounts Won"/"Referral Accounts Won"이 Deal Tracker에서 Upsell(LEAD_SOURCE에
    "upsell" 포함)만 제외한 건수 카운트라는 가정, (2) Non-Referral IC/Revenue가 Referral도
    Other(Upsell·미분류 포함 버킷)도 아닌 5개 핵심 마케팅 세그먼트(`deriveTargetGroup_()`,
    Seminar/Webinar/BOFU/Search/Content)만의 합이라는 가정 두 가지는 아직 라이브 데이터로
    검증되지 않았다 — 확인 전까지 완료로 간주하지 말 것. `JL_003_Write.js`의
    `runVerifyJLAugustActuals()`(Apps Script 편집기에서 직접 Run, 시트에는 아무것도 안 씀)로
    계산값과 이미 알려진 Aug-26 실측값을 나란히 로그 대조 가능 — 이 결과가 전부 일치해야
    자동 쓰기(`runRefreshJLExternalSheet()`)를 신뢰할 수 있음. **의도적으로 아직 주기적
    트리거(`MASTER_002_PipelineAsync.js`의 `periodicRefreshAllReports_()`)에 연결하지
    않음** — 검증 전에 외부 이해관계자 공유 시트를 매일 자동으로 덮어쓰는 위험을 피하기
    위함(사용자 확인 후 한 줄 추가로 편입 예정). 상세 매핑 근거는 `JL_001_Config.js` 파일
    헤더 참고.
38. **SAL 8월 갭(305 vs 243) — 근본 원인 해결 및 87.5% 회복 완료(2026-09-01),
    잔여 38건은 Salesforce 리포트 쪽 별개 이슈로 확정, 코드로 처리 불가 — 잔여 항목 P1(최우선)
    TODO로 지정(2026-09-01 사용자 확정)** — 37번(JL) 검증
    작업 중 New P1/SAL/IC Complete가 전부 known 실측값보다 낮게 나오는 것을 발견하며 시작.
    `TEMPQA_041_AugustACQSummaryStalenessCheck.js`로 ACQ_Summary 캐시=원본재계산 일치 확인
    (캐시 지연 아님, 진짜 데이터 갭). **근본 원인**: SAL(`Sales Accepted Date`)도 IC Booked/
    Completed/Won Date와 같은 Lead 레벨 스냅샷이라, 그 리드에 새 마케팅 터치가 없으면
    `MASTER_003_MTAFunnelSync.js`(MTA_Master 터치 기반) 경로로는 영원히 갱신 안 됨 —
    `TEMPQA_045_AugustSALSalesforceLeadTrace.js`(사용자 제공 Salesforce SAL 리포트 304건
    전수 대조)로 62건 갭 중 49건이 이 원인임을 실측 확인. 사용자 확인: Salesforce SAL 판정은
    "New (Not Contacted) Date Time"(Lead Status가 Nurturing→New (Not Contacted)로 전환된
    시각) 필드 존재 여부 — IC Booked/Completed와 동일한 IC Funnel 리포트(`ICFunnel_Raw`)에
    이 필드를 추가해 터치 무관 동기화로 전환(`CONFIG.IC_FUNNEL.COLUMNS.SALES_ACCEPTED_DATE`,
    `MASTER_009_ICFunnelSync.js` v1.5.0, `MASTER_003_MTAFunnelSync.js` v1.9.0는 이 필드에서
    손을 뗌 — IC 3개 필드 이관 때와 동일 원칙).
    **실행 중 발견된 별개 버그(수정 완료)**: `IMPORT_006_SheetWriter.js`의
    `appendSheetRecords()`는 시트에 이미 데이터가 있으면 **기존 헤더를 그대로 쓰고 CSV의
    새 컬럼은 조용히 버리는** 동작 — `ICFunnel_Raw` 헤더가 예전에 고정된 이후 한 번도 안
    늘어나서, "Lead Priority"(2026-08-28 추가된 걸로 문서화돼 있었으나 실제 헤더엔 없었음)와
    신규 "Sales Accepted Date" 둘 다 값이 전혀 반영 안 되고 있었음(`TEMPQA_046_
    ICFunnelRawHeaderDump.js`로 실측 확인) — 즉 New P1 갭 개선(267→309)은 전부 MASTER_003의
    MTA_Master 경로에서만 왔고 ICFunnel_Raw를 통한 Lead Priority 동기화는 그동안 계속
    무동작이었던 것으로 확인됨. `runAddICFunnelRawSalesAcceptedDateColumn()`(1회성 수동
    유틸, `MASTER_009_ICFunnelSync.js`)로 헤더에 두 컬럼 추가 후 전체 재export/재import로
    해결.
    **부수 발견(수정 완료)**: 긴 백그라운드 파이프라인 실행을 Apps Script 편집기에서 직접
    Stop execution으로 강제 종료하면 `PIPELINE_LOCK`이 30분간 안 풀리는 문제 실측 재확인 —
    `runForceReleasePipelineLock()`(`MASTER_002_PipelineAsync.js` v1.23.0, 수동 실행 전용)
    신규로 즉시 해제 가능하게 함.
    **최종 결과(2026-09-01)**: 헤더 추가 + 전체 재export/재import 후 SAL 정상 일치
    241→266/304(87.5%)로 회복.

    **✅ P1 TODO #1 — 아키텍처 변경으로 원천 우회(2026-09-02, 사용자 확정), 잔여
    24건은 SAL 전용 외부 시트 실사용 후 재검증 필요(TODO)**: 원래 원인은 Salesforce
    IC Funnel 리포트 자체의 필드 export 버그로 확정(코드로 처리 불가) — 사용자가 Lead
    레코드를 Salesforce에서 직접 열어 "New (Not Contacted) Date Time" 값이 실제로
    존재함을 확인(예: `00QRC00001JJRCL` = "1/8/2026, 3:24 am")했는데도 IC Funnel 리포트
    export에선 그 필드가 매번 빈 값으로 나옴(`TEMPQA_047_ICFunnelDuplicateLeadRowTrace.js`로
    각 리드가 `ICFunnel_Raw`에 정확히 1행뿐이고 그 값이 빈 문자열임을 확인, 중복 행 오채택
    가설은 기각) — IC Funnel 리포트가 "IC Booked Date: 2016~2026" 범위 필터를 쓰는 반면
    SAL 리포트는 그런 제약 없는 순수 "All leads" 리포트라는 차이가 원인으로 추정.
    **사용자 결정(2026-09-02)**: 리포트 재구성으로 고치는 대신 "SAL만 IC Funnel
    리포트에 묶지 말고 별도 리포트+별도 Raw 시트로 분리한 후 외부 시트로 만들자" —
    메인 스프레드시트 용량 문제(오픈 속도 저하)도 같이 해결. 구현 완료: `CONFIG.SAL`
    신규(`CORE_001_Config.js` v1.55.0), `MASTER_010_SALSync.js` 신규(IC Funnel과
    동일 패턴 — `pickLatestSALRecords_()`/`computeSALByLeadId_()`/`syncSALToOPS_()`,
    단위 테스트 3개 전부 PASS), `IMPORT_005_RawWriter.js`의 `writeSALRaw()`가 전용
    외부 스프레드시트(`CONFIG.SAL.EXTERNAL.SPREADSHEET_ID`)에 직접 append
    (`IMPORT_006_SheetWriter.js`/`IMPORT_008_RawDeduplicator.js`에 optional
    `targetSpreadsheet` 파라미터 추가, 기존 4개 호출부 전부 하위호환), `MASTER_002_
    PipelineAsync.js` v1.24.0에 4번째 독립 파이프라인(README Pipeline Status
    표에 "SAL" 행, PIPELINE_LOCK은 Leads/MTA/IC Funnel과 공유), "📥 Update → Import
    SAL Report" 메뉴 신규. `MASTER_009_ICFunnelSync.js` v1.6.0은 Sales Accepted Date
    관리에서 완전히 손을 뗌(IC Funnel export 버그의 영향 자체를 차단).
    **✅ 막힌 지점 해소됨(정확한 날짜 미상, 늦어도 2026-09 초 — SAL 파이프라인이
    이후 세션들에서 매 Import마다 정상 동작하는 것으로 실측 확인)**: `CONFIG.SAL.
    EXTERNAL.SPREADSHEET_ID` 설정 + Salesforce SAL 전용 리포트 export 둘 다 완료됨
    — 2026-09-08/09 세션에서 `runSALPipelineTail`이 실 SAL_Raw(8,179건+)를 매번
    정상 동기화하는 것을 반복 확인(오늘도 "Compared window" 로그 정상). **✅ 잔여 24건
    (P1 TODO #1) 재검증 완료(2026-09-09)** — `TEMPQA_045_AugustSALSalesforceLeadTrace.js`의
    `runCompareAugustSALAgainstSalesforce()` 재실행 결과 304건 중 295건(97%) 정상 일치,
    어긋난 9건 전부 "Leads_OPS에 없음(Email 매칭 실패)" 단일 원인 — SAL 값 자체가 틀리거나
    없는 sync 레벨 문제는 **0건**. SAL 동기화 메커니즘 자체는 완전히 정상 동작하는 것으로
    최종 확인 — TODO #1은 이걸로 종료, 남은 9건은 아래 TODO #2와 동일한 원인(Leads 리포트
    필터 범위)으로 흡수.

    **P1 TODO #2 — 잔여 9~14건(재검증 시점에 따라 변동): Leads 리포트 필터 범위 문제로 별개,
    코드로 처리 불가, 사용자 액션 대기**: 이 리드들이 `Leads_OPS`(및 상당수는 `Leads_Master`)에
    아예 없음 — IC Funnel/SAL 리포트엔 잡히는데 "Leads" 수동 export 리포트
    ("LeadsIC_KR_mkt_2.0")에서만 빠짐. 재import 타이밍 문제 아님(Leads가 IC Funnel보다
    오히려 최신인데도 재현됨, 실측 확인) — **사용자가 Salesforce에서 두 리포트("Leads" vs
    IC Funnel/SAL)의 필터 조건을 직접 나란히 비교해야 함**, 임의로 처리하지 말 것. IC
    Booked/Complete(TEMPQA_042/043)도 같은 종류의 미등록 리드(3건, Lead ID
    `00QRC00000ZsV97`/`00QRC00000D1CCY`/`00QRC000011JJ3o`) 영향을 받고 있어 이 필터
    이슈가 해결되면 같이 개선될 것으로 예상. **#35(New P1 8월 갭)의 남은 10건도 같은 계열의
    "export 최신성" 문제로 확인됨** — 별개 원인(Salesforce IC Funnel 리포트 자체를 오랫동안
    재export 안 한 것)이지만 처방은 동일(전체 재export/재import).
39. **Leads_OPS 필드 소유권 전면 재편 — 구현 완료(2026-09-02), 핵심 실사용 검증 완료(2026-09-09)** —
    38번 항목(SAL 8월 갭) 조사 중 "Revenue가 MTA_Master 터치 기반으로만 동기화돼 Search_OPS가
    SAL과 동일한 구조적 문제를 겪고 있다"는 게 발견되면서 사용자가 전체 재설계를 결정.
    최종 구조: New Leads(기본정보+First Touch+Lead Priority) / MTA(`#Touches`만, 신규) /
    SAL(Sales Accepted Date, SAL_Raw 외부시트) / IC Funnel(IC Booked/Completed만) /
    Revenue(신규, Deal Tracker 외부시트에서 Email 기준 역싱크 — Revenue + Opportunity Won
    Date). 상세 구현은 `docs/OperationsLayer.md` "Field Ownership 전면 재편" 섹션 참고.
    Lead Priority 다운그레이드 가드는 IC Funnel 경로에 안전장치로 유지(사용자 확정, 20번
    항목 재발 방지), MTA 경로 것은 제거.
    **✅ 실행 검증 완료(2026-09-02)**: `runRebuildDealTrackerEngine()` 실행 결과
    DealTracker_Engine 783개 딜 전체 재구축(3.49초, Email 포함) 성공. 이어서
    `runSyncRevenueToOPS()` 실행 결과 Deal Tracker 고유 Email 122개 중 **44건 Leads_OPS
    반영 성공**, 뒤이은 ACQ/NewP1/Events/BOFU/Search/Content Engine refresh 7개 전부 정상
    완료 확인 — 파이프라인 메커니즘 자체는 정상 동작 확인됨.
    **🟡 잔여 발견 — 78건(122건 중 64%) Leads_OPS 매칭 실패, 원인 가설 확보·검증 대기(TODO)**:
    사용자 가설(2026-09-02) — "Account로 병합(convert)된 리드는 Leads 리포트에서 안 보여서
    그럴 수 있다"(Salesforce Lead→Account/Contact 전환 시 더 이상 "Lead" 레코드가 아니게 되어
    Leads_Raw export에 안 잡히지만, Deal Tracker엔 그 Email로 딜이 남아있는 경우). 그럴듯한
    설명이나 실측 확인 전 — 78건 중 실제로 이 케이스가 몇 건이고, 진짜 놓친 리드(이메일
    대소문자/공백 불일치 등 버그)가 섞여있는지는 확인 안 됨. 임의로 처리하지 말 것.
    **✅ 진단 스크립트 신규 + 실행 완료, 원인 확정(2026-09-05)**:
    `TEMPQA_050_DealTrackerRevenueUnmatchedEmailTrace.js`(읽기 전용) —
    `runTraceDealTrackerUnmatchedEmails()`가 Deal Tracker 고유 Email(122개) 중
    Leads_OPS 미매칭분을 Email/#Deals/Revenue/Lead Source/Close FY/Business
    Segment와 함께 로그로 나열하고, 각각 Leads_Master에도 없는지(=Import 공백/Account
    전환 후보) 아니면 Leads_Master엔 있는데 Leads_OPS엔만 없는지(=mergeOPS()
    earliest-wins 배제 가능성, #20 redrock333 케이스와 동일 패턴이면 진짜 버그)로
    분류해 요약 카운트까지 출력. `computeRevenueByEmail_()`(`MASTER_011_RevenueSync.js`)
    와 동일한 Email 정규화(trim+lowercase) 규칙을 그대로 사용 — 그쪽 매칭 결과와
    1:1 비교 가능. **실행 결과(사용자 실행, 2026-09-05)**: 미매칭 78건 **전부**
    Leads_Master에도 존재하지 않음(78/78) — "Leads_Master엔 있는데 Leads_OPS엔만
    없음"(mergeOPS 배제) 케이스는 **0건**. 즉 mergeOPS()나 다른 파이프라인 로직이
    이 78건을 누락시킨 게 아니라, 애초에 Salesforce Leads export(Leads_Master의
    소스)에 이 Email이 한 번도 없었던 것 — **사용자의 "Account로 병합(convert)된
    리드는 Leads 리포트에서 안 보인다" 가설과 정확히 부합**, 코드 버그 가설(이메일
    대소문자/공백 불일치 등)은 기각. Lead Source는 paid social/paid search/organic/
    referral 등 정상 마케팅 소스라 Deal Tracker 데이터 자체의 이상은 없어 보임,
    Close FY는 대부분 26(현재 진행 FY)·일부 27(미래)·2건 25. **잔여(코드 조치 불필요,
    사용자 선택 사항)**: 실제로 Account 전환 케이스인지는 Salesforce에서 몇 건
    직접 열어 확인해야 최종 확정되나, 코드/파이프라인 측면에서는 이 항목의 조사가
    끝남 — mergeOPS() 관련 버그는 아니라는 게 확정됐으므로 추가 코드 조치는 없음.
    **✅ 남은 마지막 실측 미검증 가정("복수 딜 Email → Revenue 합계 + 최신 Close Date
    채택", `MASTER_011_RevenueSync.js` 헤더 주석) 검증 완료(2026-09-09)**: 신규
    `TEMPQA_057_RevenueSyncDuplicateEmailVerify.js`(`runVerifyRevenueSyncDuplicateEmailAssumption()`)
    로 실제 Deal Tracker의 복수 딜 Email을 조회한 결과 3건 확인 —
    `anjeewoo11@gmail.com`(2건 합계 $213,060.26)/`sy2011@gmail.com`(2건 합계
    $178,076.18, 같은 Close Date에 두 건 다 고액이라 중복 입력 의심)/
    `joymoon916@gmail.com`(2건 합계 $84,168.59). 사용자가 `sy2011@gmail.com`을
    Deal Tracker에서 직접 열어 두 딜이 실제로 서로 다른 정상 거래임을 확인 —
    합계 가정이 맞다고 확정. 단, 이 3건 전부 위에서 이미 확인된 78건 미매칭
    계열(Leads_OPS에 없음, Account 전환 등)이라 계산값이 실제로 Leads_OPS에
    반영되는지(sync 메커니즘 자체)는 이번에도 검증 못함 — 매칭되는 복수 딜
    Email이 실제로 생기면 그때 반영 여부 재확인 필요(낮은 우선순위, 임의로
    처리하지 말 것). 이로써 #39의 남은 TODO는 이 sync-반영 재확인 하나뿐.
40. **GAS 백엔드 설계 — GitHub 상위 스타 저장소 분석 대비 격차 검토, 기록만 완료(TODO, 구현
    착수 전)** — 2026-09-02 사용자가 외부에서 작성해온 분석 문서("GAS 백엔드 설계 — GitHub
    상위 스타 저장소 분석 & crimson-lead-tracker 적용안")를 실제 코드와 대조 검증. 문서 자체가
    "`.js` 소스는 안 읽고 `/docs/`만 근거로 했다"고 명시했었어서, 코드 확인 결과 일부는
    문서 서술과 어긋났음(아래 참고). **사용자 확정(2026-09-02)**: 이 워크북은 **Workspace
    계정**(트리거 총 실행 시간 6시간/일, 소비자 계정 90분/일보다 여유 큼 — Rebuild 커서
    체이닝 설계 시 청크 크기 판단에 참고). 실행 시간 실측(현재 5분리 파이프라인 구조 기준
    재측정)은 **아래 항목들의 설계 변경이 확정된 이후에 다시 진행** — 지금 실측해봐야 설계가
    바뀌면 무의미하므로 순서상 뒤로 미룸. 이번 세션은 **기록만**, 구현은 착수하지 않음 —
    임의로 처리하지 말 것.
    - **✅ 코드 확인 결과 실재하는 격차(구현 검토 가치 있음)**:
      - **Report Generate 체크박스(onEdit)가 `PIPELINE_LOCK` 확인 없이 실행됨** —
        `ACQREP_001_Report.js`의 `handleReportGenerateEdit`(설치형 Full Authorization onEdit
        트리거, 문서가 말한 "권한 제한된 Simple Trigger"라는 서술은 틀렸으나 결론은 유효)가
        `refreshAndGenerateACQReport_()` 호출 전 `PIPELINE_LOCK` 상태를 전혀 확인하지 않음 —
        사용자가 수동으로 체크박스를 누르는 시점과 백그라운드 파이프라인(Leads/MTA/IC Funnel/
        SAL/Revenue tail)이 같은 리포트를 갱신하는 시점이 겹치면 동시 쓰기 충돌 가능.
        NewP1_REP/FY_REP 등 나머지 리포트의 Generate 핸들러도 같은 패턴인지 전수 확인 필요.
      - **clasp dev/prod 프로젝트 분리 없음** — `.clasp.json` 1개만 존재. 2026-07-21
        서버 편집기 직접 수정분이 `clasp push`로 유실된 사고 전례 있음(`docs/Changelog.md`
        참고). `google/aside` 스타일 dev/prod 분리 + push 전 `clasp pull` diff 확인 정례화가
        후보.
      - `LockService`/`CacheService`/Advanced Sheets Service(`Sheets.Spreadsheets.*`)/
        `UrlFetchApp.fetchAll` 병렬화 — 전부 코드 전체에서 0건 사용 확인(`appsscript.json`
        `dependencies`도 비어있음). 도입 여부는 아래 항목들과 함께 논의.
    - **⚠️ 문서 프레이밍이 어긋났거나 이미 한 번 검토된 항목(그대로 반영하면 안 됨)**:
      - **Rebuild 커서 체이닝(`rebuildLeadsMaster()`/`rebuildMTAMaster()` 단일 실행 → 청크
        분할)** — 코드 확인 결과 실제로 청크 처리 없는 단일 실행 맞음(`MASTER_004_
        MasterBuild.js`). 단, 이건 **`docs/OpenItems.md` #9에서 2026-07-28에 이미 "스크립트
        편집기 수동 실행 전용 희귀 작업이라 비동기화 대상에서 제외"라고 명시적으로 결정한
        항목** — 새로 발견한 격차가 아니라 재검토 대상. 2026-07-25 실측(구 데이터량 기준
        5m26s/7m58s)이 6분 한도에 근접했던 전례가 있어 재검토 가치는 있으나, Article 14
        (패치 금지) 원칙상 "이미 제외하기로 한 결정을 왜 다시 여는지"부터 사용자 확인 필요.
      - **Jest/영속 테스트 스위트 부재** — 저장된 테스트 파일이 없는 건 사실이나, 프로젝트에
        세션마다 Node vm으로 순수함수를 즉석 검증하는 관행이 있어(Changelog에 "Node vm 하네스
        테스트 PASS" 반복 기록) 문서가 말하는 "전적으로 사람 눈 의존"은 아님 — 다만 그 검증이
        매번 휘발되고 git에 저장 안 되는 건 실재하는 문제.
    - **❓ 문서의 "확인 필요" 중 이번에 해소된 것**: Workspace 계정 여부(위 참고, 확정됨).
      **미해결로 남은 것**: 현재 실행 시간 실측(설계 확정 후 진행 예정, 위 참고).
    - **실측 시 42번 항목과 반드시 같이 확인할 것(2026-09-02 추가)**: 42번에서 발견한
      Target_REP/FY_REP/S&M_REP의 "과거 기간까지 매번 전체 재계산" 문제 — 이 실측
      재개 시 전체 소요시간뿐 아니라 **리포트별/구간별 소요시간을 나눠서 재야** 42번의
      증분 캐싱 제안이 실제로 값어치가 있는지(과거 구간 재계산 비중이 실제로 얼마인지)
      판단 가능. 전체 합산 시간만 재면 이 부분이 안 보임 — 임의로 처리하지 말 것.
    - 상세 원문 분석(저장소 비교표, Best Practices 인용 등)은 이 세션 대화 기록 참고 — 별도
      문서로 저장하지 않음.
41. (완료 — 상세는 `docs/OpenItems_Legacy.md` #41 "Engine/OPS/Report 중복 외부 오픈 2건 제거" 참고)
42. **Engine → OPS/Report 전체 체인을 트리거 단위로 분리하는 방향 재검토 — S&M_REP
    증분화는 ✅ 구현 완료(2026-09-03, 119.8s → 4.0s), Target_REP/FY_REP 증분화 +
    Engine 독립 트리거 분리는 여전히 설계 미확정(TODO)** — S&M_REP은 "확정된 과거 구간"
    경계 설계 자체가 필요 없는 다른 경로(ACQ Engine이 이미 하던 Leads_OPS 기반 스캔을
    공유)로 해소됨, 상세: `docs/exec-plans/active/2026-09-02-pipeline-refresh-time-redesign.md`.
    Target_REP(`refreshTargetEngine_()` 매번 전체 재계산)/FY_REP(`CONFIG.FYREP.FYS` 전체
    순회)은 이 해법이 그대로 적용되지 않아(다른 계산 구조) 여전히 미해결 — 임의로 처리하지
    말 것. 아래는 2026-09-02 최초 검토 시점 원문(전제 정정 등은 여전히 유효).
    2026-09-02 대화 중 "Engine→OPS→Report 순차 3단계"라는 최초
    전제 자체가 틀렸음을 발견해 정정됨 — 41번(개별 함수 중복 조회)과는 별개 질문 —
    "Engine/OPS/Report가 전부 한 실행 안에서 순차 연쇄돼 있어서 오래 걸리는 거면 아예
    트리거 단위로 분리할 수 있는지" 검토.
    - **정정된 실제 의존 구조(41번 조사 시 만든 조회 매트릭스 재확인 결과)**: "Engine →
      OPS → Report"는 일직선이 아님 — Engine 6종은 도메인마다 다른 곳으로 갈라짐.
      (1) Events/BOFU/Search/Content Engine → 각자의 OPS 화면(Events_OPS 등)에서 **끝남**
      (이 OPS들을 더 읽어가는 Report가 없음 — S&M_REP도 Events_OPS가 아니라 Leads_OPS/
      MTA_Master를 직접 읽음). (2) ACQ_Summary/NewP1_Engine/Target_Engine → OPS를 아예
      안 거치고 ACQ_REP/NewP1_REP/Target_REP/FY_REP이 **직접** 읽음 — 이 3개 도메인엔
      중간 OPS 화면 단계 자체가 없음. **즉 OPS와 Report는 서로 순서 의존 관계가 없고,
      둘 다 "Engine이 끝난 다음"이라는 조건만 공유** — Engine 다음에 OPS→Report를 순서대로
      실행할 필요가 없고, Engine이 끝나면 OPS와 Report를 각자 독립된 트리거로 동시에(또는
      순서 무관하게) 실행해도 됨. 이 발견으로 "Engine/OPS/Report 3단계 순차 분리"였던
      최초 아이디어가 "Engine 1단계 + (OPS, Report) 2개를 Engine 완료 후 독립적으로"로
      바뀜 — 후자가 임계 경로(critical path)를 더 짧게 만듦(OPS가 Report를 안 기다리고,
      Report가 OPS를 안 기다림).
    - **분리 필요성의 실측 근거**: 2026-08-26 실측(IC Funnel 36,464건 기준) Engine 6종
      refresh만으로 이미 **~4m39s**(6분 한도의 78%) — 여기에 OPS 4종 재구성 + Report
      5종 재생성(둘 다 미측정)까지 같은 실행에 얹으면 총합이 한도를 넘길 위험이 있고,
      Leads/MTA 파이프라인(35만+/8만+행, IC Funnel보다 훨씬 큰 데이터량)은 더 위험할 수
      있음. **이미 실제로 발생한 전례 있음**: 9번 항목 관련 2026-08-05 사고 — 당시
      `runLeadsPipelineTail()` 안의 한 단계(중복 삭제, 그 자체는 이후 수정됨)가 느려지며
      Apps Script 플랫폼이 실행 자체를 강제 종료 → 최상위 try/catch가 개입 못 해
      `PIPELINE_LOCK`이 영구히 남는 2차 피해로 이어졌던 실제 사례(#20 조사 기록 참고).
      원인 자체는 고쳤지만 "여러 무거운 단계를 한 실행에 순차로 몰아넣는" 구조는 그대로라
      재발 가능한 근본 리스크로 남아있음.
    - **2026-07-28 개별 함수 단위 트리거 분리 기각 결정과의 관계**: 그 결정("트리거
      디스패치 지연이 hop마다 누적돼 오히려 느려진다")은 함수 16개를 전부 쪼개는 세밀한
      단위를 가정한 것 — 이번 검토는 그보다 굵은 단위(Engine 1묶음 + OPS/Report 각자
      독립, 홉 2단계뿐)라 전제가 다름. 또한 그 결정 당시엔 없었던
      `periodicRefreshAllReports_()`(5개 리포트 하루 2번 KST 10/22시 강제 재계산, 2026-09-01
      도입)가 지금은 안전망으로 존재 — 파이프라인이 늦게 끝나도 최악의 경우 다음 주기적
      refresh가 메워주므로, "총 완료 시간이 늘어나는" 비용이 2026-07-28 당시보다 낮아짐.
    - **Engine을 독립 경계로 분리할 필요성은 근거 있음, OPS/Report 쪽 실행시간은 데이터
      없음**: Engine 6종이 실측상 이미 한도에 가장 근접한 단일 구간이라 독립 트리거
      경계가 필요하다는 쪽은 근거가 있음(위 실측 참고). 반면 OPS 4종/Report 5종은
      실행시간이 아직 미측정이라 이 둘을 정말 병렬/독립으로 나눠도 되는지(PIPELINE_LOCK
      공유 방식까지 포함해서)는 40번 항목의 실행시간 재측정(설계 확정 후 진행 예정) 없이는
      판단 불가 — 임의로 처리하지 말 것.
    - **Report 레이어 5종 각각의 실제 읽기 범위 확인(2026-09-02) — 예상과 반대로 나옴**:
      사용자가 "ACQ는 신규분만, NewP1은 전체 스캔이라 느릴 것, Target/FY/S&M은 각각
      해당 주·월만 보면 되니 빠를 것"이라는 가설을 제시해 코드로 직접 검증. 결과가
      정반대로 나옴 — **NewP1_REP은 이미 가볍고, 오히려 Target/FY/S&M 3개가 "필요한
      범위만 보면 되는데 실제로는 매번 전체를 다시 훑거나 재계산"하는 구조**였음:
      - `generateACQReport_()` — 가설대로 가벼움. `readACQSummaryMap_()`이 이미 집계된
        작은 캐시 테이블만 읽음(원본 Leads_OPS 스캔 없음).
      - `generateNewP1Report_()` — 가설과 반대로 **이미 가벼움**. Report 단계 자체는
        `readNewP1EngineRows_()`로 NewP1_Engine 캐시만 읽음(ACQ와 동일 패턴). Leads_OPS
        전체 스캔은 실재하지만 그건 Engine 단계(`refreshNewP1Engine_()`→
        `computeNewP1Aggregates_()`, `NEWP1REP_001_Report.js:405`)에서 일어나는 일이라
        위 Engine 4m39s 실측에 이미 포함돼 있음 — Report 레이어만 놓고 보면 안 느림.
      - `generateTargetReport_()` — 가설과 반대로 **무거움**. 시작하자마자
        `refreshTargetEngine_()`(Target_Engine 전체 재계산 — Leads_OPS 전체 + Deal
        Tracker 캐시 전체 재훑기)를 매번 새로 호출함(`TARGET_002_Report.js:541`). 특정
        주만 보는 스코핑이 없음.
      - `generateFYReport_()` — 가설과 반대로 **가장 무거움**. `computeFYRepFlatRows_()`
        (`FYREP_001_Engine.js:1504`)가 `CONFIG.FYREP.FYS`(24/25/26 전부)를 매번 순회 —
        해당 월/FY 하나가 아니라 설정된 FY 전체를 매번 재계산. 41번 항목에서 확인한
        perfTrackerByFY 외부 오픈(FY당 최대 2회)도 이 반복 안에서 매번 재발생.
      - `generateSMReport_()` — 가설과 반대로 **스코핑 없음**. `sheetToObjects(opsSheet)`/
        `sheetToObjects(mtaSheet)`(`SMREP_001_Report.js:471-472`)로 Leads_OPS·MTA_Master
        **전체**를 먼저 메모리에 올린 뒤에야 주 단위로 걸러냄 — 읽기 자체가 이미 전체
        스캔.
      **시사점**: Engine 분리(위 항목)와는 별개로, Report 레이어 안에서도 Target_REP/
      FY_REP/S&M_REP 3개가 "필요한 범위만 증분으로 읽도록" 개선할 여지가 있어 보임 —
      단 구현 전 반드시 실행시간 재측정(40번 항목)으로 실제 병목 크기부터 확인, 임의로
      처리하지 말 것.
    - **왜 무거울 이유가 없는지(2026-09-02 사용자 지적)**: Target_REP(주 단위)/FY_REP
      (FY·월 단위)/S&M_REP(주 단위) 전부 **과거로 지나간 구간의 숫자는 이후에 바뀌지
      않는다** — 지난주/지난달/지난 FY 실적은 확정값이라 재계산해도 항상 같은 결과가
      나옴(단, Revenue처럼 Deal Tracker 역싱크로 뒤늦게 갱신될 수 있는 필드는 예외 —
      39번 항목의 78건 미매칭처럼 "과거 리드의 필드가 나중에 채워지는" 케이스가 있어
      완전히 불변은 아님, 이 경계는 설계 시 정확히 확인 필요). 그런데도 위 3개는 매번
      **전체 기간(과거 포함)을 처음부터 다시 계산**하고 있음 — Target_Engine 전체 재계산,
      FY 24/25/26 전부 순회, Leads_OPS/MTA_Master 전체 스캔 후 필터링이 전부 이 패턴.
      **개선 방향(구현 전 검토 필요)**: 이미 확정된 과거 구간(예: 지난 FY, 2주 전 이전
      주차)의 계산 결과는 캐시에 남겨두고, **이번 실행에서 실제로 바뀔 수 있는 최근 구간
      (현재 진행 중인 주/월/FY, 그리고 Revenue처럼 늦게 갱신되는 필드가 걸린 구간)만
      다시 계산**하는 증분 방식으로 전환 — Master Build의 Incremental Append(Properties
      커서로 "어디까지 처리했는지" 기억)와 같은 원칙을 Report 레이어에도 적용하는 셈.
      경계 조건(무엇을 "확정된 과거"로 볼지, Revenue 역싱크 지연이 걸리는 구간을 어떻게
      다룰지)은 설계 단계에서 반드시 확정 필요 — 임의로 처리하지 말 것.
43. (완료 — 상세는 `docs/OpenItems_Legacy.md` #43 "Lead Priority(P1) 리스트 기반 자동 Flagging" 참고)
44. (완료 — 상세는 `docs/OpenItems_Legacy.md` #44 "SAL Sync 무관 Engine 재실행 제거" 참고)
45. (완료 — 상세는 `docs/OpenItems_Legacy.md` #45 "Salesforce Export 타입별 필드 정리" 참고)
46. (완료 — 상세는 `docs/OpenItems_Legacy.md` #46 "onEdit 트리거 재발동으로 파이프라인 tail 지연" 참고)
47. (완료 — 상세는 `docs/OpenItems_Legacy.md` #47 "Revenue 파이프라인 독립 트리거 분리" 참고)
48. (완료 — 상세는 `docs/OpenItems_Legacy.md` #48 "외부 P1 리스트 기반 Lead Priority 불일치 플래깅" 참고)
49. ~~Naver Search API 누적 캐시 시트 외부 Master_DB 스프레드시트로 이관~~ — 구현 및 실행 검증 완료(2026-09-04). `Naver_Search_Campaign_Stats_Cache`/`Ad_Spend_Cache`를 기존 캠페인 시트(Meta_Raw/NaverSA_Raw가 있는 Master_DB 폴더 파일, `1zOZGwnsm0GhLGGe5rATu8jR5WxAQVx7YmmiPZVU88jY`, 사용자 확정 — 새 파일 안 만들고 탭만 추가)로 이관. 재계산 가능한 캐시라는 성질을 이용해 Raw 이관과 달리 별도 복사 스크립트 없이 read/write 함수의 대상만 외부 스프레드시트로 전환(`AD_003_NaverSearch.js` v2.16.0/`AD_004_SpendCache.js` v1.6.0의 opener 함수 신규, `JL_003_Write.js` v1.1.0도 함께 전환). `runRefreshAdSpendCache()`(222행)/`runRefreshNaverSearchAdCampaignStatsCache()`(9개 캠페인) 실행 결과 외부 시트에 탭 정상 생성 확인, ACQ_REP Generate 재실행도 정상 값 확인(사용자 확인, 2026-09-04). 상세: `docs/exec-plans/completed/2026-09-04-ad-spend-cache-external-migration.md`. **남은 낮은 우선순위 항목**: 메인 스프레드시트의 기존 숨김 탭 2개는 안정화 확인 후 별도 삭제(당장 안 함).
50. **`buildLeadsOPS()`(Leads_OPS 병합) 증분화 — 그림자 모드 구현 완료(2026-09-16), 실 Import 검증 대기(TODO)** (2026-09-08 등록, 근거는 2026-09-04 세션에서 이미 논의) — `docs/exec-plans/active/2026-09-03-performance-optimization.md` 항목 5(청크 처리)에서 다룬 5대 성능 개선 중, 사용자가 명시적으로 범위 밖으로 보류한 "더 어려운 절반"이 바로 이것 — `mergeOPS()`(`OPS_004_Merge.js`)의 중복 이메일 해소 로직 자체는 매 Import마다 여전히 Leads_Master(36,741행)+Leads_OPS(36,689행) 전체를 재스캔한다(항목 1~4는 Raw/딕셔너리 레이어의 전체 스캔을 없앴지만 이 레이어는 그대로). 2026-09-08 실 Import 실측: `buildLeadsOPS()`가 61건 신규 처리에 101.18초 소요 — 신규 건수와 무관하게 전체 재스캔 비용이 고정으로 붙는 구조. **보류 사유(사용자 확정, 2026-09-04)**: Leads_OPS는 거의 모든 리포트가 참조하는 핵심 테이블이라 실수 시 파급이 크다는 이유로 청크 처리(안전장치)만 우선 적용하고 증분 병합은 별도 설계/검증 없이는 착수하지 않기로 함(`[[feedback_pause_before_core_merge_logic_change]]` 참고). **최소 설계(exec-plan에 이미 기록)**: (1) 이메일이 이미 OPS에 있는데 새 배치 행의 Create Date가 기존보다 이르면 SF_COLUMNS 교체(MANUAL/SYNC_COLUMNS는 계속 보존), 이르지 않으면 duplicate로 카운트만 하고 기존 행 불변, (2) 같은 배치 내 신규 이메일 중복은 기존 로직 그대로 재사용 가능, (3) 실 스프레드시트 데이터로 대조 검증 필수(순수 함수 테스트만으로는 불충분).

    **2026-09-16 설계 논의 확정(사용자 결정)**:
    - **정렬 불변식**: 매 빌드마다 전체를 Create Date 내림차순 재정렬하던 것을 포기하고, **증분 경로는 신규 행을 추가만 하고 정렬은 그대로 둔 채, 하루 1회 별도 전체 재정렬로 절충**(`rebuildLeadsMaster()`처럼 "빠른 증분 + 가끔 전체 정리" 패턴 재사용). 평소엔 Leads_OPS 정렬이 살짝 깨진 상태로 있을 수 있다는 뜻 — 이 트레이드오프를 사용자가 승인. **(쓰기 전환 시점에 구현 예정, 아직 미구현 — 지금은 전체 경로가 계속 정렬까지 담당하므로 당장 필요 없음)**
    - **재정렬 발동 방식**: `periodicRefreshRevenue_`/`periodicRefreshAdSpendCache_`와 동일한 패턴으로 **하루 1회 자동 주기 트리거**를 신설(수동 진입점 아님) — `PIPELINE_LOCK` 공유해 Leads/MTA/SAL/IC Funnel/Revenue 파이프라인과 경합하지 않게 함(`guardPipelineTailEntry_()` 패턴 재사용 가능성 있음, 2026-09-16 락 가드 수정 참고). **(마찬가지로 쓰기 전환 시점 구현 예정)**
    - **검증 방식**: 컷오버 전 구현 직후 몇 차례 Import 동안 **기존 `mergeOPS()`(전체 재스캔)와 신규 증분 경로를 같은 Import에 둘 다 나란히 돌리되, 실제 시트 쓰기는 기존 경로만 하고 신규 경로는 결과만 메모리에서 계산** → 두 결과를 행별/컬럼별로 diff해서 완전히 일치하는지 여러 차례 확인한 뒤에야 기존 경로를 걷어내고 증분 경로로 전환. 순수 함수 테스트만으로는 불충분(이미 합의된 사항)이라는 원칙과 일치. **✅ 구현 완료(아래 참고), 실 Import diff 결과는 아직 미확인.**
    - **구현 중 추가 발견 — "IC Requested" 체크박스 스윕은 별도 분리(사용자 확정)**: 설계 논의 이후 구현 착수 직전 재점검 중 발견 — `applyICRequestTracking_()`(체크된 행을 찾아 카운터+1/체크박스 리셋)가 지금은 `mergeOPS()`가 전체를 훑기 때문에 사실상 "매 sync마다 시트 전체를 스윕"하는 역할까지 겸하고 있었음(`docs/OperationsLayer.md`: "IC Requested — Marketing, 매 sync마다 리셋됨"). 증분 경로가 "새 Master 배치에 해당하는 이메일만" 건드리면, 그 배치와 무관한 기존 행에서 마케팅이 체크한 "IC Requested"는 그 이메일이 다시 Master에 나타날 때까지(사실상 영원히 안 나타날 수 있음) 리셋도 카운트도 안 되는 회귀가 생김 — 순수 성능 문제가 아니라 기능 손실이라 별도 확인 후 **"별도 경량 전체-컬럼 스윕으로 분리"로 확정**(매 Import마다 "IC Requested"/"Total IC Requests"/"IC Booked Date" 3개 컬럼만 targeted read해 체크된 행만 처리 — 전체 시트 read/write보다 훨씬 가벼움, 기존 "매 sync마다" 동작은 100% 유지). **아직 미구현** — 그림자 모드 diff 검증에는 영향 없음(diff는 SF_COLUMNS/MANUAL/SYNC_COLUMNS 값 일치만 봄, IC Requested 스윕 자체가 아직 어느 경로에도 없어도 두 경로 다 이 필드를 건드리지 않으므로 diff는 정상 작동), 하지만 **쓰기 전환(컷오버) 전에 반드시 구현해야 하는 필수 항목**으로 등록.
    - **✅ 구현 완료(2026-09-16, 그림자 모드)**: `OPS_004_Merge.js` v3.4.0 — `mergeOPS()`를 `resolveEmailGroupEarliestWins_()`/`buildOpsRowFromMasterRow_()`(순수 함수)로 리팩터(동작 100% 동일, 기존 테스트 PASS 유지), 신규 `planIncrementalOpsMerge_()`(순수 함수, 테스트 `testPlanIncrementalOpsMerge()`)/`computeIncrementalOpsMergePlan_()`(IO 래퍼 — Email/Create Date 2개 컬럼만 targeted read, 교체후보만 전체 행 read). `OPS_003_Build.js` v1.3.0 — `buildLeadsOPS()`의 `mergeOPS()` 직후·`writeOPS()` 전에 `verifyIncrementalOpsShadowDiff_()` 호출, 독립 try/catch로 격리, 시트에는 아무것도 안 씀(Logger 로그만). 체크포인트 `CONFIG.PROPERTIES.LEADS_OPS_MASTER_LAST_ROW` 신규(`CORE_001_Config.js` v1.70.0), Master 행 수 감소 시 `computeDictionaryRefreshWindow_()`(기존 딕셔너리 캐시가 쓰던 순수 함수 재사용) 판정으로 안전하게 diff 생략+체크포인트만 갱신. Node.js로 신규 테스트 4개 + 기존 회귀 테스트(`testMergeOPS_EarliestWins`/`testApplyICRequestTracking`) 전부 PASS 확인, `clasp push` 완료. **실 Apps Script 환경에서 테스트 함수들 재확인 필요** — `OPS_004_Merge.js`의 `testResolveEmailGroupEarliestWins()`/`testBuildOpsRowFromMasterRow()`/`testComputeICRequestCounterUpdate()`/`testPlanIncrementalOpsMerge()`/`testMergeOPS_EarliestWins()`/`testApplyICRequestTracking()` 전부 편집기에서 직접 Run.
    - **다음 단계**: (1) 위 6개 테스트 Apps Script 편집기에서 실행 확인, (2) 다음 실제 Leads Import 때 Executions 로그에서 "buildLeadsOPS 그림자 diff 결과" 로그로 일치 여부 확인 — 몇 차례 반복해 계속 일치하면, (3) IC Requested 스윕 구현 + 정렬 불변식 절충(하루 1회 재정렬 트리거) 구현 + 실제 쓰기 경로 전환. **쓰기 전환 자체는 이번 구현 범위 밖 — 별도 승인 필요**(`[[feedback_pause_before_core_merge_logic_change]]` 원칙 유지).
51. **2026-09-11 Executions 로그 — 5개 항목 exec-plan 종료(#42/#50 관련) 이후에도 체감 개선 없음, 원인 미조사(TODO)** — 사용자가 그날 Apps Script Executions 대시보드를 그대로 붙여넣으며 "시간이 너무 전체적으로 다 오래걸려서 재설계한 느낌을 못 받는다"고 지적. 로그상 실측치(같은 날 여러 건): `runLeadsPipelineTail` Editor 695.136s / Time-Driven 691.479s(둘 다 약 11분 반), `runMTAPipelineTail` Time-Driven 462.245s(약 7분 42초), `periodicRefreshAdSpendCache_` Time-Driven 697.267s(약 11분 37초), `runRevenuePipelineTail` Time-Driven 217.846s. **`docs/PerformanceBenchmark.md`(2026-09-03) 베이스라인과 대조 결과, 실제로 개선은커녕 악화로 보임**: 같은 문서의 2026-09-03 실측(S&M_REP 증분화 *이전*)이 `runLeadsPipelineTail` 전체 612s(10m12s)였고, 같은 날 S&M_REP 증분화로 Report 레이어에서만 약 115.8s(119.8s→4.0s)가 줄었으니 그 직후 기대치는 대략 497s(8m17s) 수준이어야 하는데, 2026-09-11 실측은 오히려 691~695s로 베이스라인(612s)보다도 13% 더 걸림 — 기대치 대비로는 약 40% 더 걸리는 셈. **원인 미확정, 아래는 후보일 뿐(임의로 확정하지 말 것)**: (1) 데이터 행수 자체가 계속 늘고 있음(#50에 이미 기록된 `buildLeadsOPS()` 전체 재스캔 비용이 대표적 — 이 항목은 애초에 이번 exec-plan 범위 밖으로 보류됐던 부분), (2) #18에 이미 기록된 "파이프라인 겹침 시 락 경합으로 외부 API 호출 지연" 패턴이 이번에도 작용했을 가능성(이 로그만으로는 여러 트리거가 실제로 겹쳐 돌았는지 확인 불가), (3) `periodicRefreshAdSpendCache_`(697s)는 `docs/PerformanceBenchmark.md`에 베이스라인 자체가 없어 이 값이 원래 정상 범위인지조차 판단 불가. **다음에 조사할 때 확인할 것**: 같은 시간대에 다른 파이프라인 tail이 겹쳐 돌고 있었는지(Executions 로그 Start Time 전체 대조), `[TIMING]` Logger 계측(2026-09-03에 이미 도입됨, `MASTER_002_PipelineAsync.js`)으로 이번 실행의 단계별 분해가 가능한지. 사용자 요청으로 지금은 조사 없이 이 관찰만 기록.
52. **Leads_OPS "Sales Accepted Date"/"IC Booked Date"/"IC Completed Date" 대량 유실 — 복구 완료, 원인 미확정(TODO)** (2026-09-15 등록) — 사용자 보고("S&M_REP/ACQ_REP SAL이 다 0")로 발견. Leads_OPS의 "Sales Accepted Date"가 36,831행 중 18건만 남아있었음(SAL_Raw 원본엔 8,207건 정상 존재 확인, SAL Sync 코드는 2026-09-09 정상 검증 이후 무변경 — 코드 회귀 아님). 같은 배치에 항상 같이 쓰이는 "SAL Segment"(문자열)는 8,182건으로 멀쩡했음. IC Funnel 쪽도 동일 패턴 — "IC Booked Date"(5건)/"IC Completed Date"(3건)만 비정상으로 낮고 같은 배치의 "Lead Priority"는 정상. **패턴**: 두 사고 모두 "Date 타입 sync 컬럼만 지워지고 같이 쓰인 문자열 컬럼은 안 지워짐" — 우연이라기엔 일관적이라 같은 메커니즘일 가능성이 높음(예: Date 타입 컬럼 전체를 대상으로 한 어떤 일괄 작업의 부작용, 혹은 삭제된 줄 알았던 옛 임시 복구 스크립트가 실은 아직 컨테이너에 남아있다가 재실행됨 등 — 전부 가설일 뿐, 확인 안 됨). **복구**: 각 원본(SAL_Raw/ICFunnel_Raw 외부 스프레드시트)에서 체크포인트 무시하고 전체 재백필해 정상화 완료(`Sales Accepted Date` 18→8,177건/`IC Booked Date` 5→3,213건/`IC Completed Date` 3→3,010건, 상세는 `docs/Changelog.md` 2026-09-15 참고). "Opportunity Won Date"(87건)도 같은 패턴으로 의심했으나 Deal Tracker 자체 원본이 원래 딜 792건/고유 이메일 124건뿐임을 확인해 정상 판단, 조치 불필요. **원인 조사는 사용자 요청으로 이번엔 보류** — 재발 시 다음을 확인할 것(임의로 처리하지 말 것): (1) Leads_OPS 시트의 Google Sheets 버전 기록(파일 > 버전 기록)에서 값이 사라진 정확한 시점과 편집 주체(사람 vs Apps Script) 확인, (2) Apps Script 편집기 Executions 탭에서 그 시점 전후 실행된 함수 중 낯선/오래된 것이 있는지 확인, (3) 편집기 파일 목록에 로컬 저장소에서 이미 삭제된 옛 `TEMPQA_0xx_SalesAcceptedDate...` 계열 스크립트가 남아있는지 확인(이번 세션 중 `clasp push`의 삭제 반영이 즉시가 아니라 약간의 지연이 있는 것도 함께 확인됨 — 몇 초~몇 분 내 정상 반영되긴 함, 영구적 버그는 아님).

**2026-09-16 후속 — 항목 (3) 실측, "지연"이 아니라 clasp 자체 버그로 확정**: #52 조사 착수 시점에 컨테이너를 임시 디렉토리에 pull해 로컬과 diff한 결과, `TEMPQA_060_ICFunnelBookedCompletedFullBackfill.js`(Changelog엔 "사용 후 삭제"로 기록됨)가 로컬엔 없는데 원격에 그대로 남아있음을 발견(TEMPQA_059는 정상 삭제 확인). `clasp push`/`clasp push -f` 둘 다 재실행했으나 "Script is already up to date."만 출력하고 실제로는 삭제 안 됨을 재pull로 재확인 — 위 "몇 초~몇 분 내 정상 반영"이라는 기존 판단은 **철회**, 실제로는 clasp 3.3.0의 구조적 버그(`push`가 "파일 삭제만" 있는 변경은 원격 비교 없이 조용히 스킵 — 상세 메커니즘은 `docs/apps-script-gotchas.md` #13)로 확정. 원본 데이터 유실 사고의 직접 원인은 아니지만(TEMPQA_060은 사고 이후 복구용으로 만든 스크립트), "삭제했다"고 기록된 과거의 다른 임시/TEMPQA 스크립트도 실제로는 컨테이너에 남아있을 가능성이 있다는 뜻이라 재발 방지 조치를 이번에 바로 적용: `scripts/safe-clasp-push.sh`가 매 push 후 원격을 임시 디렉토리에 pull해 로컬에 없는 원격 전용 파일을 자동 경고하도록 수정(2026-09-16, 실측으로 TEMPQA_060 정상 탐지 확인) — 경고 시 Apps Script 편집기에서 직접 삭제해야 함(clasp 재시도는 같은 이유로 무의미). TEMPQA_060은 사용자가 Apps Script 편집기에서 직접 삭제 완료(재push로 "원격 전용 파일 없음" 확인).

**2026-09-16 후속 — 항목 (1)/(2) 실측, 유력한 원인 확정(100% 재현은 아니나 코드+로그로 뒷받침됨)**: 사용자가 공유한 9/13~9/16 Executions 로그를 원본 발견 시점(`runDiagnoseSALHistoricalDataWipe` 최초 실행 9/15 11:04:24 AM) 이전 구간과 대조한 결과, 그날 아침 `runLeadsPipelineTail`이 **편집기(Editor)에서 두 번** 수동 실행됨(8:35:25 AM/9:43:36 AM) — 두 번째 실행이 락을 정상 보유 중이던 `periodicRefreshRevenue_`(Time-Driven, 9:38:25~9:44:20 AM)와 **44초간 겹쳐 돌았음**. 코드 확인 결과 `runLeadsPipelineTail()`(`MASTER_002_PipelineAsync.js`)은 트리거 대상 겸 "수동 재실행 진입점(디버깅/재시도용)"으로 **의도적으로** 편집기 직접 Run이 허용돼 있었는데, 트리거 경로(`appendNewLeads()`가 앞문에서 `acquirePipelineLock_()`)와 달리 **이 진입점 자체엔 락 체크가 전혀 없었음** — 무조건 실행되고 끝에서 `releasePipelineLockAndProcessQueue_()`만 무조건 호출(자기가 잡지도 않은 락을 반납 시도). 한편 `buildLeadsOPS()`(`OPS_003_Build.js`)는 `readOPS()`로 Leads_OPS 전체를 메모리 스냅샷 → `mergeOPS()`(SYNC_COLUMNS를 그 스냅샷 값 그대로 복사, `OPS_004_Merge.js:219`) → `writeOPS()`로 시트 전체 재작성하는 구조라, **스냅샷~재작성 사이에 다른 프로세스가 SYNC_COLUMNS(SAL/IC Booked/Completed Date 포함)에 쓴 값은 조용히 되돌아갈 수 있음**. `periodicRefreshRevenue_` 자신은 Revenue/Opportunity Won Date 2개 컬럼만 좁게 쓰기 때문에 SAL/IC 필드를 직접 덮어쓴 증거는 아니지만, 같은 날 아침 `runICFunnelPipelineTail`(8:55~8:57 AM, IC Booked/Completed Date를 새로 씀)이 두 번째 `runLeadsPipelineTail`(9:43 AM) 직전에 실행됐다는 점, 그리고 "락 체크 없는 수동 tail 실행이 다른 살아있는 락과 실제로 겹쳐 돌았다"는 사실 자체가 로그로 증명됐다는 점에서 **이 클래스의 경합이 유력한 원인**으로 결론. **수정 완료(2026-09-16)**: `runLeadsPipelineTail()`/`runMTAPipelineTail()`/`runICFunnelPipelineTail()`/`runSALPipelineTail()` 4개 진입점 전부에 `guardPipelineTailEntry_()`(+ 순수 판정 함수 `computeTailEntryGuardDecision_()`, 테스트 `testComputeTailEntryGuardDecision()` PASS 확인) 가드 추가 — 타입이 다른 살아있는 락이 있으면 실행 거부, 락이 없으면 직접 획득, 같은 타입/stale이면 기존 트리거 흐름 그대로 통과. `MASTER_002_PipelineAsync.js` v1.33.0, clasp push 완료. **실사용 재검증 필요** — 다음에 같은 상황(수동 tail 실행이 다른 파이프라인과 겹침)이 발생하면 Logger에 거부 로그가 남는지, 그리고 이후 SAL/IC 유실이 재발하지 않는지 확인 전까지 완료로 간주하지 말 것. Google Sheets 버전 기록 대조(항목 1)는 이번엔 Executions 로그만으로 충분한 설명이 나와 별도로 진행하지 않음.



