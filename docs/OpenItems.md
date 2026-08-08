# Open Items (현재 알려진 미해결 항목)

> 이 문서는 이전까지 `CLAUDE.md`의 "현재 알려진 미해결 항목" 섹션에 있던 내용을 그대로
> 옮긴 것입니다 (2026-07-29 하네스 엔지니어링 ④단계, CLAUDE.md 다이어트 — 정보 손실 없이
> 위치만 이동, 문구 변경 없음). **임의로 처리하지 말 것** — 각 항목의 확정/미확정 상태와
> 배경을 먼저 읽고 진행한다.

1. ~~`Leads_OPS_QA` 생성 로직 — 의도적으로 미구현~~ — 구현 완료 (`24_OPSQA.js`, `writeOPSQAResults_()`). Dashboard(Master vs Leads_OPS 지표 대조) + Issues 테이블을 `Leads_OPS_QA` 시트에 기록. `buildLeadsOPS()` 실행 시 자동 호출(`21_OPS_Build.js`), 메뉴에서 "Run Leads_OPS QA"로 수동 실행도 가능. 문서 반영 누락 상태였다가 2026-07-24 뒤늦게 기록.
2. ~~IC Request(SAL)의 `#touches`(터치 횟수) 지표~~ — 4번 항목(재신청 카운터)과 동일 항목으로 확인, 구현 완료. 2026-07-24 정정 (별개 항목으로 잘못 분리 기재돼 있었음).
3. ~~MTA_Master에 "완전 동일한(all-fields identical) duplicate row" 검출 로직 없음~~ — 2026-07-24 판단 기준 확정 및 구현 완료. "완전 동일" = Lead ID + MTA Created Date + MKT UTM Campaign + First Lead Source + First Touch Detail(터치 식별 필드) 5개가 전부 일치하는 경우 (IC Booked/Completed/Won Date, Revenue, Lead Priority 등 export 시점마다 값이 바뀔 수 있는 Lead 레벨 스냅샷 필드는 비교에서 제외). `findExactDuplicateTouchRows_()`/`checkExactDuplicateTouchRows_()`(`24_OPSQA.js`)로 검출해 `Leads_OPS_QA` 시트에 이슈로 플래그, `buildLeadsOPS()` 실행 시 자동 실행. **자동 삭제는 하지 않음** — 검출/보고만 수행하며, 실제 제거 여부는 이슈 확인 후 별도 결정.
4. ~~`IC Requested` 재신청 이력 미보존~~ — 2026-07-22 설계 확정 및 구현 완료 (`applyICRequestTracking_()`, `22_OPS_Merge.js`). `Total IC Requests`/`Last IC Requested Date` 컬럼 추가, 매 OPS sync마다 `IC Requested`가 true였으면 카운터 +1 후 리셋. 자세한 내용: `docs/OperationsLayer.md` "IC Request Tracking" 섹션.
5. **`Opp(ortunity) Won Date` 대체 필요 (부분 해소, 잔여 범위만 TODO)** — `Opportunity Won Date`는 실제로는 "Opportunity로 전환된 날짜"일 뿐 진짜 Close Date가 아님(진짜 Close Date 필드는 export에 없음, 2026-07-20 Deal Tracker 논의 중 확인 — `docs/Changelog.md` 참고). Close Date 대용으로 쓰기에 부적절하므로, Close Date가 필요한 리포트/QA 로직에서 이 필드를 다른 필드로 대체해야 함. 2026-07-25 OPS 전체 구축 완료 후 QA 착수 시점에 메모됨. **2026-07-25 후속 발견**: `Lead: Sales Funnel Stage = "Won Deal"`인 리드는 전부 Revenue가 존재 — Won 여부 판별의 대체 후보로 유력하나 구현은 보류 중(`docs/ACQReportDesign.md` "Opportunity Won Date 대체 후보 발견" 섹션 참고). **2026-07-28 해소**: 2트랙 아키텍처(7번 항목) 적용으로 ACQ_REP/Events_OPS/BOFU_OPS/Content_OPS는 더 이상 이 필드에 의존하지 않음 — Deal Tracker의 Close Date로 대체 완료. **잔여 범위(여전히 미해결)**: `NewP1_REP`(Won 판정은 원래도 Revenue>0이라 이 필드 자체는 미사용이었음, 변경 없음)과 `Search_OPS`(UTM 그레인 문제로 2트랙 전환에서 예외 처리됨, 여전히 Opportunity Won Date 사용)에는 이 필드가 그대로 남아있음 — 대체 여부는 미정, 임의로 처리하지 말 것.
6. ~~SAL 과집계 원인 발견~~ — 2026-07-25 해결 완료. `Lead Record Type`(Lead 레벨 스냅샷이라 오래전 SAL이 된 리드의 무관한 후속 터치까지 집계되던 문제) 대신, Salesforce MTA export에 새로 추가 가능한 `Lead: Sales Accepted Date`(진짜 이벤트 날짜) 필드로 전환. `13_MTATransformer.js`/`09_MTAFunnelSync.js`/`20_OPS_Config.js`/`30_ACQReport.js` 전부 반영, SAL 계산이 MTA_Master 터치 단위에서 Leads_OPS 리드 단위(이벤트 날짜 기준)로 이동. 자세한 내용: `docs/ACQReportDesign.md` "SAL 과집계 원인 해결" 섹션.
7. **Deal Tracker(`[KOR] Deal Tracking`) 통합 — Block C 실데이터 연동 완료(아키텍처 전환), Opportunity Won Date 보정 레이어는 여전히 미착수 (TODO)** — 2026-07-25 발견: 사용자가 FY23부터 별도 관리해온 KOR 딜 전용 시트. `Closed Date`가 진짜 Close Date(5번 항목 대체 후보), upsell 데이터로 순매출 계산 가능. **Won Date 보정 레이어 용도는 아직 설계/구현 시작 전** — 자세한 내용은 `docs/Changelog.md` 2026-07-25 "Deal Tracker 통합 계획 메모" 섹션 참고, 임의로 처리하지 말 것.
   - **최종 아키텍처(2026-07-27 확정)**: Leads_OPS 개별 리드 매칭을 전부 폐기하고 **Deal Tracker 자체를 Source of Truth로 전환**. 딜 자체에 기록된 Lead Source/Source Category/Lead Source Detail로 `getBusinessSegment()`(16_TransformHelper.js, 프로젝트 공용 분류 로직)를 직접 호출해 세그먼트 분류 — `classifyDealSegment_()`(`90_TargetEngine.js`), Leads_OPS 조회 전혀 없음. P1 판정도 제거(사용자 확인: 딜의 99%가 이미 P1). 원래 쓰던 시트로 복귀 — 스프레드시트 ID `1oGCY8okaxhpHrtotUzbhyprCOVcJ9ndX5kX3m5qqxME`(gid `498663095`), `CONFIG.TARGET.EXTERNAL.DEAL_TRACKER`(`00_Config.js`). `93_TempQA_DealTrackerMatch.js`(`runListUnmatchedDealTrackerEmails()`)는 "분류 실패한 딜" 목록으로 재작성. **분류 메커니즘 자체는 이후 두 차례 더 교체됨**: 1차로 "Content Category"라는 명시적 분류 컬럼이 시트에 이미 있었음이 뒤늦게 발견돼 그걸 직접 매핑하는 방식으로 교체, 2차로(2026-07-28) 그 컬럼을 사용자가 "Segment"로 개명 + 전체 딜 수동 재분류한 것을 그대로 Source of Truth로 쓰는 현재 방식(`deriveTargetGroup_()`)으로 최종 교체 — 아래 참고.
   - ~~P1당 가치 코호트1/2 이원화~~ — 구현 및 검증 완료(2026-07-28, 사용자 확인). content(ebook 등) 리드는 nurturing이 최대 28개월까지 걸려 단일 코호트만으로 P1당 가치를 구하면 심각하게 저평가됨(원래 발견: content Target P1이 주 871로 비정상적으로 높게 나왔던 원인). 사용자 확정 프레임워크대로 구현(2026-07-27): `readDealTrackerRawRows_()`가 실제 Date 셀인 Close/Created Date에서 `closeFY`/`createdFY`를 직접 파생, `computeDealCohortsFromDealRows_()`가 그룹별 코호트1(Created=Closed=타겟FY) Revenue(R1)/코호트2(Closed=타겟FY, Created≠타겟FY) Revenue(R2)를 분리 계산, `computeP1ValueBlockRows_()`가 `CurrentFYP1V(a)=R1÷타겟FY New P1`, `PrevP1V(b)=R2÷(all-time 총 P1−타겟FY New P1)`를 Target_Engine Block B(7컬럼으로 확장)에 나란히 기록. Block C(딜 비중)도 동일 코호트1 기준으로 통일(3FY median 폐기). ~~**최종 FY P1 목표 공식(Block D)에 a/b를 어떻게 반영할지**~~ — **최종 확정(2026-07-27)**: 단일 코호트로 블렌딩하지 않고, FY Revenue 타겟 자체를 New 트랙(코호트1 비중÷a)과 Pipeline 트랙(코호트2 비중÷b)으로 물리적으로 분리해 각각 계산 후 합산(`computeDealShareBlockRows_()`, Block C가 2컬럼→6컬럼으로 확장). Pipeline 트랙 그룹 배분은 코호트1 딜비중(R1)을 재사용하면 안 됨을 실측으로 확인(같은 해 빠르게 전환되는 contact에 쏠림) — 반드시 코호트2(R2) 자체 비중을 쓰는 `computeDealShareRatiosCohort2FromDealRows_()` 신규. 3FY median/가중평균도 안 씀 — "이전 FY(24·25)는 본사 관리 체제라 노이즈"라는 사용자 판단으로 a/b/딜비중/pipeline비중/트랙분리비율 전부 FY26 단일 스냅샷 기준 통일. **`runRefreshTargetEngine()` 실 시트 검증 완료(2026-07-27)**: Block C 실제 값 — events New 1,358.15/Pipeline 2,277.31/Total 3,635.45, contact New 380.45/Pipeline 489.93/Total 870.38, content New 696.96/Pipeline 1,299.62/Total 1,996.57(New+Pipeline=Total 정확히 일치 확인). 검증 중 별도 버그 발견·수정: Block C 확장으로 Block D 시작 컬럼이 밀리면서(X열→AB열) 예전 Block D의 Date 서식이 남아있어 숫자값이 "12/30/1899"류 날짜로 잘못 표시되던 문제 — `refreshTargetEngine_()`의 wide-clear를 `clearContent()`→`clear()`로 수정해 해결. **2026-07-29 후속**: 이 검증은 당시의 Content Category 기반 분류로 계산된 것 — 이후 분류 메커니즘이 Segment 컬럼 직접 참조로 교체돼(위 참고) 실제 그룹별 숫자는 재계산 필요(공식/구조 자체는 변경 없음). 상세: `docs/TargetReportDesign.md` §5 "P1당 가치".
   - **2트랙 아키텍처로 프로젝트 전역 확장 — ACQ_REP은 실측 검증 완료, Events_OPS/BOFU_OPS/Content_OPS는 검증 대기(TODO)**: 2026-07-28 사용자 확정 — "Revenue가 포함되는 모든 레이어는 딜트래킹을 소스 기반으로. 리드~세일즈 액티비티는 Leads/MTA, Opportunity단은 딜트래킹으로 2트랙 설계." Target_REP에서만 쓰던 Deal Tracker Source of Truth 원칙을 `ACQ_REP`(Revenue), `Events_OPS`/`BOFU_OPS`/`Content_OPS`(`#Deals`/`Revenue`)까지 확장 적용, `docs/OperationsLayer.md`의 "모든 리포트는 Leads_OPS를 읽어야 한다" 원칙에 정식으로 2트랙 예외 각주 추가. 구현: `90_TargetEngine.js`에 프로젝트 공용 `computeDealTrackerCountsByKey_()`(순수 함수, 도메인별 키 정규화 함수 주입) 신설 + `readDealTrackerRawRows_()`에 `closeDate` 필드 추가(additive). `30_ACQReport.js`의 `computeACQDealRevenueFromRows_()`(Segment×Month), `51/61/81_*_Engine.js`의 `compute{Events|BOFU|Content}DealAggregates_()`(프로그램명 키, `stripRegistrationFormSuffix_`+`isKoreanProgram_`(+Events는 `isEligibleEventType_`) 재사용). **2026-07-28 후속 수정**: ACQ_REP Segment 분류를 처음엔 `getBusinessSegment()` 키워드 매칭(7개 Segment 유지, Target의 3그룹 collapse는 안 씀)으로 했으나 실측 검증 결과 정확도가 신뢰 불가 수준(Search $144,265 vs 실제 ~$537,507.89, 약 $393K 갭)이라 폐기 — 사용자가 Deal Tracker의 H열("Content Category"→"Segment"로 개명)에 전체 딜을 수동 재분류, 이 컬럼(`row.businessSegment`)을 그대로 Source of Truth로 씀(`classifyDealSegment_()`도 동일하게 전환돼 Target_REP도 혜택). **의도적 예외 1건(2026-07-28 갱신 — NewP1_REP은 아래에서 예외 해제됨)**: `Search_OPS`(raw UTM 그레인이 Deal Tracker의 프로그램 단위 Lead Source Detail과 안 맞아 중복집계 위험, `71_Search_Engine.js` 주석 참고)만 그대로 Leads_OPS 기준 유지. **2026-07-28 추가 발견·수정(타임존 버그)**: Segment 전환 후에도 ACQ_REP 7월 Referral이 실제값과 안 맞아 조사한 결과, 이 스크립트 타임존(`appsscript.json`: America/New_York)과 Deal Tracker 스프레드시트 자체 타임존이 달라 **매달 1일 Close된 딜이 전월로 잘못 집계되는 구조적 버그** 발견(실측: Close Date "2026-07-01"이 "Jun 30 2026 11:00 EDT"로 읽혀 6월로 집계됨). `normalizeExternalCalendarDate_()`(`90_TargetEngine.js` v1.13.0, Deal Tracker의 `getSpreadsheetTimeZone()` 기준으로 연/월/일 재구성)로 수정 완료 — `readDealTrackerRawRows_()`가 closeDate/createdDate 둘 다에 적용. Target_REP의 `readChannelRawRows_()`/`readNaverRawRows_()`(외부 채널시트/Naver)도 같은 구조라 이론상 같은 위험이 있으나 실측 보고된 적 없어 이번 라운드에선 미수정(낮은 우선순위, 별도 확인 필요). **✅ ACQ_REP 검증 완료(2026-07-28, 사용자 확인)**: `runRefreshACQSummary()` 재실행 후 5·6·7월 전 세그먼트 Revenue(Referral 포함)가 Deal Tracker 실제 합계와 정확히 일치 확인(7월 전체 $999,931.89 vs ACQ_REP $999,932). 12번 항목의 Referral 갭은 이번 전환으로 해소된 것으로 확인됨. **아직 검증 필요(남은 범위)**: Events_OPS/BOFU_OPS/Content_OPS의 Engine 갱신 함수 실행 후 `#Deals`/Revenue가 Deal Tracker 프로그램명 매칭으로 실제 값과 맞는지는 아직 미확인 — 확인 전까지 완료로 간주하지 말 것. 상세: `docs/Changelog.md` 2026-07-28.
   - ~~NewP1_REP Won/Revenue도 2트랙 확장 대상으로 편입~~ — 구현 및 검증 완료(2026-07-28, 사용자 확인). 최초엔 "NewP1_REP의 Won/Revenue는 리드 단위 지표라 Deal Tracker 전환 제외" 결정이었으나, 사용자가 "리드 단위 매칭 없이도 딜의 Created Date(코호트 축)+수동 Segment 컬럼으로 직접 집계 가능하다"고 지적 — ACQ_REP(Close Date 기준)과 동일한 패턴을 NewP1_REP에도 적용. 구현: `40_NewP1Report.js`의 `computeNewP1DealWonRevenueFromRows_()` 신규(딜 Created Date FY/Month + Segment로 코호트 집계, Upsell/N/A는 Other로 접음), `computeNewP1Aggregates_()`는 New P1/SAL/IC Booked/IC Complete만 Leads_OPS에서 집계하고 Won/Revenue는 이 신규 함수 결과와 병합. `90_TargetEngine.js`의 `readDealTrackerRawRows_()`에 `createdDate`(정규화된 Date) 필드 추가(additive). **부작용(사용자 확인·승인)**: Won%(=Won÷New P1)의 분자(딜트래커 딜 건수)와 분모(Leads_OPS 리드 건수)가 서로 다른 두 집단이 되어 "코호트 전환율"이 아니라 "기간별 딜 규모 대비 리드 규모"로 의미가 바뀜. **알려진 한계(별도 항목, 코드 아님)**: Referral 딜 다수가 Created Date 결측이라 Won/Revenue 과소집계 — 사용자가 Deal Tracker에서 직접 채워 넣기로 함, `docs/NewP1ReportDesign.md` 참고. 상세: `docs/Changelog.md` 2026-07-28.
8. ~~완전 동일 중복 터치(Exact Duplicate Touch Row) 자동 삭제~~ — 구현 및 실행 검증 완료(2026-07-28). 3번 항목에서 검출 로직(`findExactDuplicateTouchRows_()`, `24_OPSQA.js`)은 구현 완료했지만 자동 삭제는 의도적으로 보류해뒀었음. 2026-07-25 사용자 요청: 자동 삭제까지 구현하면 MTA 재export 시 날짜 겹침을 크게 신경 안 써도 되고(겹쳐 올려도 중복만 자동 정리됨), 지금처럼 "MTA_Raw/MTA_Master 전체 삭제 후 재구축"하는 무거운 프로세스를 매번 반복할 필요가 줄어듦. **설계**: 삭제 안전성 검토 결과 `MTA_LAST_ROW`(PropertiesService)는 MTA_**Raw** 처리 진행률만 추적할 뿐 MTA_Master 행 위치와 무관하고(`07_IncrementalMasterBuild.js` `appendNewMTA()` 참고), MTA_Master는 매 append마다 어차피 `sortSheetByDate()`로 재정렬되므로 삭제로 인한 카운터/정렬 부작용이 없음을 확인 — 애초 우려했던 안전성 이슈가 해소됨. 삭제 기준(사용자 확정): 5개 필드 완전 일치 그룹 중 **"가장 진행된 단계"의 행만 남김**(Won[Opportunity Won Date 유효 또는 Revenue>0] > IC Complete > IC Booked > 없음 순, 동점이면 시트상 더 나중 행 유지) — IC Booked/Completed/Won Date, Revenue 등 export 시점마다 달라지는 Lead 레벨 스냅샷 필드의 진행 정보 손실을 최소화. 그룹 키는 5개 필드(MTA Created Date 포함) 전부 일치해야만 성립하므로, 같은 캠페인에 날짜만 다른 정상적인 재참여 터치는 절대 삭제 대상이 안 됨(사용자 확인). 구현: `24_OPSQA.js`(v1.3.0)의 `runAutoDeleteExactDuplicateTouchRows()`(수동 실행 진입점)/`findExactDuplicateTouchRowsToDelete_()`/`readMTAMasterRowsWithIndex_()`/`computeTouchProgressionScore_()`. **실행 결과(사용자 확인, 2026-07-28)**: 294개 중복 행 삭제, MTA_Master 82,714 → 82,420행, 에러 없음(약 5분 소요). ~~자동 실행 체인엔 아직 배선 안 함~~ — **2026-08-04부터 배선됨**: `08_PipelineAsync.js`의 `runMTAPipelineTail()` 첫 단계(`syncMTAFunnelToOPS_()`보다 먼저)로 매 MTA 백그라운드 실행마다 자동 호출(사용자 요청). 삭제 후 ACQ_Summary 등 캐시 지표는 관련 Engine refresh 재실행 또는 다음 `appendNewMTA()` 시 자동 반영.
9. **Backend 실행 체인 비동기화 — 구현 완료(2026-08-04), 실사용 검증 대기(TODO)** — 설계는
   2026-07-28에 확정, 구현은 2026-08-04 세션에서 완료. `08_PipelineAsync.js` 신규(락/트리거/
   README 진행상태 표시/재시도 진입점), `07_IncrementalMasterBuild.js` v1.5.0(`appendNewLeads()`/
   `appendNewMTA()`가 락 확인 후 트리거로 refresh 체인 위임). 상세 진행 기록·발견 사항:
   `docs/exec-plans/active/2026-08-04-pipeline-async-triggers.md`. **아직 검증 필요**: 실
   스프레드시트에서 `appendNewLeads()`/`appendNewMTA()` 실행 후 README 탭 Pipeline Status가
   정상 갱신되는지, 락 충돌·재시도(`runRetryPipelineTail()`)가 의도대로 동작하는지 — 확인 전까지
   완료로 간주하지 말 것. 아래는 설계 당시 기록(참고용, 최신 구현과 세부 함수명이 다를 수 있음 —
   실제 구현은 위 exec-plan 참고).
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
   - **상태(설계 당시 기록)**: ~~설계 확정, 코드 변경은 아직 없음~~ — 2026-08-04 구현 완료, 위 항목 상단 참고. 실사용 검증 전까지 완료로 간주하지 말 것.
18. **Import 업로드 다이얼로그가 대용량(특히 MTA) 처리 중 오래 대기 — 원인 1건 확인·수정 완료, 나머지는 여전히 TODO** — 9번 항목(Import→Append 자동 체이닝) 구현 이후 실사용 중 발견. `importCsv()`가 이제 CSV 파싱/검증 + Raw 쓰기 + `appendNewLeads(true)`/`appendNewMTA(true)`(Raw→Master append/정렬, refresh 체인 자체는 이미 백그라운드 트리거로 분리돼 있음)까지 전부 같은 동기 호출 안에서 처리 — 이 동기 구간 자체가 오래 걸려 업로드 다이얼로그가 "Uploading..." 상태로 오래 대기.
    **✅ 원인 1건 확인·수정(2026-08-05)**: 20번 항목(ACQ_REP New P1 불일치) 조사 중 사용자가 "Raw가 재import로 계속 쌓이면 결국 처리 속도가 느려지지 않냐"고 질문한 게 계기 — 확인 결과 `appendNewLeads()`/`appendNewMTA()`가 새 행이 몇 건이든 상관없이 `readLeadRaw()`/`readMTARaw()`로 **Raw 시트 전체를 매번 통째로 읽고 있었음**(`11_DataReader.js`의 `readRawSheet()`, `getDataRange().getValues()`). Raw는 원본 보존 원칙상 절대 안 지워지고 겹치는 기간 재import 시마다 계속 누적되므로, 이 전체 읽기 자체가 시간이 지날수록(Raw가 커질수록) 점점 느려지는 구조적 문제였음 — 신규 건수와 무관하게. **수정**: `getRawSheetDataRowCount_()`(메타데이터만, `getLastRow()`)/`readRawSheetFrom_()`(targeted `getRange()` 읽기, `11_DataReader.js` v2.1.0)로 교체 — 이제 처리 시간이 Raw 전체 크기가 아니라 "신규 행 수"에만 비례. `07_IncrementalMasterBuild.js` v1.7.0. 전체 재구축(`rebuildLeadsMaster()`/`rebuildMTAMaster()`)과 진단용(`24_OPSQA.js`)은 여전히 전체 스캔 그대로(의도적, 그쪽은 전체가 필요).
    **남은 후보(여전히 TODO)**: `sortSheetByDate()`(Master 재정렬) 자체가 대용량에서 오래 걸릴 가능성 — 아직 설계 착수 전, 임의로 처리하지 말 것.
10. **SAL에 "Lead Status = Nurturing" 제외 조건 추가 필요 (데이터 대기, TODO)** — 6번에서 SAL을 `Sales Accepted Date` 이벤트 기준으로 전환했지만, `Lead Status`(Salesforce 표준 필드, `Sales Funnel Stage`와는 다른 별개 필드 — 픽리스트 순서: Nurturing → New (Not Contacted) → Attempting Contact → Contacted → Disqualified → IC Booked → Qualified)가 "Nurturing"인 리드도 Sales Accepted Date가 찍혀 SAL로 카운트되는 문제를 2026-07-25 사용자가 발견(Search 세그먼트 SAL 8건이 전부 IC Booked인 게 이상해서 개별 확인하다 발견). **확정된 처리 방식**: SAL 제외 조건은 `Lead Status === "Nurturing"` 하나뿐 — New/Attempting Contact/Contacted/Disqualified/IC Booked/Qualified는 전부 SAL로 그대로 카운트(사용자 확인, "New부터는 전부 SAL"). **막힌 지점**: `Lead: Lead Status` 필드가 아직 MTA export에 없어 파이프라인에 전혀 없는 상태 — Salesforce 리포트에 이 필드 추가 + 재export 되기 전까지 구현 불가. 필드 도착 시 `13_MTATransformer.js`에 매핑(리드 레벨 스냅샷이라 `computeMTAFunnelByLeadId_()`처럼 대표값 로직 필요할 수 있음) → `30_ACQReport.js`의 SAL 카운트 조건에 `leadStatus !== "Nurturing"` 추가. 임의로 처리하지 말 것.
11. **Target_REP(주간 세그먼트 목표·달성률 리포트) 구현 완료, Generate 자동화 완료(2026-08-05) — 실사용 검증 진행 중, TODO** — 2026-07-27 설계 확정(`docs/TargetReportDesign.md`) 후 같은 날 구현 및 실 시트 검증 진행. New P1/CPNP1을 top-down(마케팅 Revenue 타겟 × 딜 비중 ÷ P1당 가치)으로 역산해 주간 목표를 세우고 실적과 대조. 구현 파일: `90_TargetEngine.js`(Block A~D 계산/작성, 주 캘린더 생성, 가중평균, 외부 채널시트/Naver gid 매칭), `91_TargetReport.js`(`setupTargetReport()`, `runGenerateTargetReport()`, `refreshTargetActuals_()` — 기존 `refreshACQSummary_()` 호출 4곳에 배선), `92_TargetStyles.js`, `CONFIG.TARGET`(`00_Config.js`). **막힌 지점 5개는 구현 착수 전 전부 해소됨**(상세는 `docs/Changelog.md` 2026-07-27 항목). **실행 중 실측 버그 2건 발견·수정**: (1) Block 0 입력값을 셀 단위로 개별 읽고/쓰던 게(최대 27회 왕복) 대용량 워크북에서 타임아웃 유발 → 배치 호출로 수정, 해결 확인. (2) **Generate를 체크박스+onEdit(Simple Trigger)로 구현했으나, Simple Trigger는 제한된 권한이라 `SpreadsheetApp.openById()`(외부 채널시트 참조)를 아예 호출할 수 없음이 실측 확인됨**("Specified permissions are not sufficient") — ACQ_REP/NewP1_REP는 외부 파일을 안 열어서 이 문제가 없었음, Target_REP만 해당. 사용자 확인 후 체크박스/onEdit 분기 제거, `runGenerateTargetReport()`를 Apps Script 편집기에서 직접 Run하는 방식으로 전환(직접 Run은 Full Authorization). **2026-08-05 자동화**: 사용자 요청("deal tracker도 import 체인에 포함시키자")으로 `generateTargetReport_()`를 `08_PipelineAsync.js`의 `refreshReportGenerate_()`(설치형 트리거, Full Authorization이라 Simple Trigger 제약 자체가 없음)에 추가 — 매 Leads/MTA 백그라운드 실행마다 자동 호출됨, 편집기 직접 Run은 재시도/디버깅용으로 계속 가능. **아직 검증 필요**: 자동 호출된 Target_REP 리포트 행/Target_Engine Block A~D 실제 값(특히 CPNP1 벤치마크가 외부 gid 매칭 성공해서 0이 아닌지) 확인 전까지 완료로 간주하지 말 것. 그 외 `docs/TargetReportDesign.md` §12 #6~8(개선계수 초기값 0.9 placeholder, Seminar/Webinar 분해 표시, 월 소계 행)은 실물 확인 후 결정 예정.
12. ~~ACQ_REP Referral 세그먼트 Revenue가 Salesforce/딜트래커 대비 연간 기준 과소집계~~ — 2026-07-28 해소 확인(사용자 확인, FY26 전체 연간 대조 완료). 원래 발견: 이번 FY(FY26) 전체로 보면 ACQ_REP Referral 합계($2,157,628.79)가 딜트래커 Referral 합계($2,794,367.69)보다 **$636,739(약 22.8%) 적음**(당시 ACQ_REP은 Leads_OPS `Opportunity Won Date`/`Revenue` 기준이었음). 7번 항목의 2트랙 아키텍처 적용(Deal Tracker 기반 + 수동 Segment 컬럼 + 타임존 버그 수정)으로 ACQ_REP Revenue가 Deal Tracker와 정의상 같은 소스가 되면서 갭 해소 — 5·6·7월 개별 대조(7월 전체 $999,931.89 vs ACQ_REP $999,932) 및 FY26 전체 연간 대조 둘 다 사용자 확인 완료. **KRW/환율 관련 가설(별도 낮은 우선순위 항목으로 유지)**: Revenue를 KRW 원본 값으로 가져와서 일관된 환율로 NZD 변환하면 더 정확해질 수 있다는 가설은 미검증 상태로 남음 — 딜트래커 시트엔 KRW 원본 컬럼이 없고 `Revenue (NZD)`(이미 변환된 값)만 있음, Salesforce Opportunity 객체 자체에 KRW 원본 금액 필드가 있는지 확인 필요. Revenue 통화 처리 방식은 Target_REP뿐 아니라 ACQ_REP 등 여러 리포트에 걸친 문제라 별도 세션에서 다룰 것.
13. **Leads_Master 완전 동일 중복 행 탐지/자동삭제 — 구현 및 실데이터 검증 완료(2026-07-28), 자동삭제는 실제 발생 시 확인 필요** — 2026-07-28 사용자 요청으로 3/8번 항목(MTA_Master 완전 동일 중복 터치)과 동일한 문제가 Leads_Master에도 있는지 확인하다가, 해당 로직이 MTA_Master 전용이라 Leads_Master(Leads_Raw로부터 빌드)에는 없다는 게 확인됨 — 새로 설계·구현. **발생 원인 가정(사용자 확인)**: MTA와 동일하게 주간 Lead export 날짜 범위가 겹치면 `appendNewLeads()`가 같은 Lead ID를 Leads_Master에 중복 append. **완전 동일 판정 기준(사용자 확정)**: MTA_Master(터치 단위라 한 Lead가 여러 번 나오는 게 정상)와 달리 Leads_Master는 Lead ID 1개 = 행 1개가 정상 구조이므로, 5필드 복합키 대신 **Lead ID 단독**을 그룹 키로 사용 — 같은 Lead ID가 2번 이상 등장하면 완전 동일 중복. IC Booked/Completed/Won Date, Revenue 등 export 시점마다 바뀌는 스냅샷 필드는 비교에서 제외(MTA와 동일 원칙). **구현(`24_OPSQA.js` v1.4.1)**: `checkExactDuplicateLeadRows_()`/`findExactDuplicateLeadRows_()`(탐지 — `runOPSQA_()`에 배선되어 자동 실행, `Leads_OPS_QA`에 "Exact Duplicate Lead Row" 이슈로 기록)와 `findExactDuplicateLeadRowsToDelete_()`/`readLeadsMasterRowsWithIndex_()`/`runAutoDeleteExactDuplicateLeadRows()`(자동삭제 — 수동 실행 전용, 그룹당 "가장 진행된 단계"만 남기는 tie-break 로직은 `computeTouchProgressionScore_()` 재사용, 필드명이 Leads_Master와 동일해 그대로 호환됨). ~~자동삭제 함수만 MTA_Master 버전과 동일한 방침으로 자동 실행 체인에는 배선하지 않음~~ — **2026-08-04부터 배선됨**: `08_PipelineAsync.js`의 `runLeadsPipelineTail()` 첫 단계(`buildLeadsOPS`보다 먼저)로 매 Leads 백그라운드 실행마다 자동 호출(사용자 요청). 수동 실행(`runAutoDeleteExactDuplicateLeadRows()` 직접 Run)도 계속 가능. **검증 완료(2026-07-28)**: 단위 테스트(`testFindExactDuplicateLeadRows()`/`testFindExactDuplicateLeadRowsToDelete()`/`testFindExactDuplicateLeadRowsToDeleteTieBreak()`) 전부 PASS, `runOPSQA_()` 실행 결과 현재 Leads_Master에는 완전 동일 중복 0건(탐지 로직이 실데이터에 대해 정상 동작함을 확인, 다만 지금 삭제할 대상이 없어 `runAutoDeleteExactDuplicateLeadRows()`의 실제 삭제 동작 자체는 아직 실물 검증 전) — 향후 겹치는 날짜로 Lead export가 올라와 중복이 실제 발생하면 그때 삭제 동작을 검증할 것. 테스트 함수명 관련 사이드노트: 최초 구현 시 `testFindExactDuplicateLeadRowsToDelete_()`처럼 끝에 `_`를 붙였다가 Run 드롭다운에 안 보이는 문제 발견(`docs/apps-script-gotchas.md` #2) → `_` 제거(v1.4.1). MTA_Master용 동명 함수(`testFindExactDuplicateTouchRowsToDelete_()` 등, v1.3.0)도 같은 문제가 있는 것으로 추정되나 사용자가 그대로 두기로 결정(2026-07-28) — 임의로 변경하지 말 것.
14. **Search_OPS 정리 작업 중 발견된 Business Segment 분류 개선 — 대부분 완료, 잔존 leadSource="Organic Search" 레거시만 미해결** — 2026-07-28 사용자가 Search_OPS에서 콘텐츠성 캠페인(ebook/guide/SAT practice test 등)이 Search로 잘못 분류된 걸 발견하면서 시작된 연쇄 개선. 상세 이력은 `docs/BusinessSegmentClassification.md`의 2026-07-28 날짜 항목들 참고, 요약: (1) `leadSource.includes("search")`가 Content보다 먼저 체크되던 우선순위 반전, (2) campaign의 `_contact`/`consult`도 동일 문제 있어 `search`/`sitelink`를 확정 신호로 분리, (3) Content 키워드에 download/case study/quiz/공백형 on demand 추가, (4) SAT Practice Test 계열 개별 하드코딩 예외 추가, (5) BOFU/Search "_contact" 공용 fallback을 leadSource 기반(Naver/Google/Organic/Paid Search면 Search, 그 외는 BOFU)으로 재설계. Search_OPS 죽은 키(합집합 병합으로 지워지지 않던 레거시 행) 116건도 `runDeleteDeadSearchOPSRows()`(`71_Search_Engine.js`)로 삭제 완료. **잔존 미해결**: 옛날 ebook Marketo flow가 UTM 값이 없으면 `First Lead Source`를 "Organic Search"로 기본 처리하던 레거시 때문에, leadSource가 문자 그대로 "Organic Search"인 리드 중 일부는 실제로는 진짜 검색 유입이 아닐 수 있음(사용자 확인). 이번 라운드 수정들은 leadSource가 Paid Social 등 **명확히 다른 값**인 케이스만 해소했고, leadSource 필드 자체가 "Organic Search"로 잘못 찍혀 남아있는 잔존 레거시 리드는 식별 기준이 아직 없어(campaign/detail에 다른 신호가 전혀 없어 진짜/가짜 구분이 안 됨) 처리되지 않음 — 이후 재검토 시 별도로 다시 다룰 필요가 있다는 메모, 임의로 처리하지 말 것.
16. **2026-07-29 세션 — Search를 Marketo 프로그램화 + git worktree 사고 복구** — 이전 항목들과 별개 세션. (a) Search_OPS를 raw UTM 그레인에서 부분적으로 프로그램화 — Naver SA/Google SA Marketo Program이 Lead Source Detail에 잡히면 Program명을 키로, Channel도 Naver Search/Google Search로 구분(패턴 매칭이라 향후 신규 프로그램도 자동 인식). "research"가 "search"로 오탐되던 버그 발견·수정(예: "college-research-ebook"이 강제로 Search 처리되던 것), Search_OPS 육안 재검토로 50여 개 캠페인 개별 재분류. Channel 기본값 "Meta"(실검증 안 된 값)를 빈 값으로 변경, 모든 OPS 시트 정렬을 "빈 날짜 최상단"에서 "빈 날짜 최하단"으로 통일, Leads_OPS에 누락돼 있던 Create Date 정렬 추가. (b) **사고 발견 및 복구**: 세션 도중 `git worktree list` 확인 없이 main에서 `clasp push`를 반복하다가, 별도 worktree(`worktree-clever-seeking-dolphin`, main과 동일 scriptId)가 이전에 라이브 배포해뒀던 Target_REP New/Pipeline 2트랙 Block C/D 코드를 덮어써 Target_REP가 0으로 표시되는 사고 발생 — worktree 브랜치를 main에 merge해 복구(90_TargetEngine.js v1.15.0/00_Config.js v1.12.0 changelog 참고). **재발 방지**: 앞으로 세션 시작 시 git sync 체크에 `git worktree list`도 포함할 것(기존 "Session-Start Git Sync Check" 원칙에 반영 필요).
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
19. **캠페인 지출(Ad_Spend_Cache) 독립 스케줄 갱신 — 구현 완료(2026-08-08)** — 2026-08-04
    보류 이후, ACQ_REP refresh 시 Kakao Moments(메시지광고 API) 신규 데이터가 반영 안 되는
    문제를 계기로 사용자가 직접 보류를 해제. `periodicRefreshAdSpendCache_()`
    (`AD_004_SpendCache.js` 신규)를 매 `AD.SPEND_CACHE.PERIODIC_REFRESH_INTERVAL_HOURS`
    (4)시간마다 도는 시간 트리거로 설치(`runInstallAdSpendPeriodicRefreshTrigger()`, 최초 1회
    수동 실행 필요) — `syncKakaoMomentsReportToKakaoSMSRaw_()`로 `KakaoSMS_Raw`를 먼저
    최신화한 뒤 `refreshAdSpendCache_()`(Meta+Naver Search+Kakao Channel/Moments 통합)를
    호출. 기존 `08_PipelineAsync.js` 파이프라인 트리거(`refreshCampaignSpend_()`, Leads/MTA
    import 직후 실행)는 그대로 유지 — 이번 트리거는 그 사이 공백을 메우는 용도로 추가.
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
    (기존 출력 변경 금지 원칙) — 이 신규 딕셔너리로 그 하드코딩들을 대체할지는 별도 논의 필요,
    임의로 처리하지 말 것.
    **알려진 한계(구조적, 코드로 해결 불가 — 사용자 확인 완료)**: Consolidated/Pmax류 복합
    캠페인은 UTM 하나가 실제로 여러 Marketo Program과 진짜 1:N으로 매칭됨(예: 한 UTM이 실제
    리드 데이터상 8개 서로 다른 eBook Program과 매칭 확인됨, `runDebugMtaMasterTouchesForUtm()`
    진단 결과) — 이런 UTM은 자동 채움에서 의도적으로 제외되고 계속 빈 값으로 남음
    (`readUtmProgramDictionaryMap_()`이 Distinct Program Count > 1 항목 제외). 딕셔너리는
    수동 실행(`runRefreshUtmProgramDictionary()`) 전용 — 자동 파이프라인엔 얹지 않음(MTA_Master
    전체 스캔 8만 행+ 무거움).
23. **QA 에이전트 설계 — 신규 TODO(2026-08-08), 착수 전** — 사용자가 세션 종료 시점에 "QA 에이전트
    설계"를 todo로 남겨달라고 요청. 상세 스코프/목적은 이 세션에서 논의되지 않음 — 착수 전 범위
    확인 필요(무엇을 QA하는 에이전트인지, 이 프로젝트의 어느 영역 대상인지 등), 임의로 설계하지
    말 것.
