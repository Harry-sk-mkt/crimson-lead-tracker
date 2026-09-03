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
23. ~~QA 에이전트 설계~~ — **설계 및 구현 완료(2026-08-09)**. 사용자 확인 결과 스코프는
    데이터 정합성+리포트 값 검증+코드/엔지니어링 품질 3개 전부, 형태는 Claude Code 서브에이전트/
    스킬. `.claude/skills/qa-review/SKILL.md` 신규(Apps Script 코드 변경 없음, 스킬/문서만).
    Claude가 라이브 Google Sheet를 읽을 방법이 전혀 없음을 확인해(Sheets API/MCP/`clasp
    run-function` 전무) 리포트 값 검증 모드는 "진단 함수 작성 → 사용자가 Apps Script 편집기에서
    직접 Run → 결과 붙여넣기" 가이드형 워크플로우로 설계, naming/version-header/중복선언/문법은
    이미 `scripts/check-*.sh`가 커버하므로 재구현하지 않음. 상세: `docs/QAAgentDesign.md`.
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
26. ~~`Sales Accepted Date` 과거 오염 데이터~~ — **✅ 전부 해소 완료(2026-08-20)**. day/month
    swap 3,193건(2026-08-18) + 타임존 오사용 94건(2026-08-20) 전부 복구, 예방용 자동 QA 체크
    (`checkUnprotectedDateLikeRawColumns_()`)까지 추가 완료 — 아래는 진행 경과 기록(참고용).
    S&M_REP(신규 리포트) 개발 중 미래 날짜(9~12월)로
    찍힌 SAL을 사용자가 발견, ACQ_REP에서도 동일 현상 확인 후 Salesforce Field History로 직접
    추적해 원인 확정: `CONFIG.RAW_DATE_COLUMNS.MTA`에 `"Lead: Sales Accepted Date"`가 누락돼
    있어(이 필드가 2026-07-25에 파이프라인에 추가됐는데 보호 목록 확정(2026-07-21)엔 그때 같이
    반영이 안 됨) Google Sheets가 day-first 원본("9/8/2026" = 실제 8월 9일)을 자기 locale로
    오해석해 9월 8일로 영구 변환 — 원본 텍스트 소실. 상세 원인/증거: `docs/DateParsing.md`
    "2026-08-19 — 재발 사례" 섹션. **코드 수정 완료**(`CONFIG.RAW_DATE_COLUMNS.MTA`에 추가,
    `CORE_001_Config.js` v1.38.0) — 이후 신규 MTA Import부터는 재발 안 함.
    **✅ 데이터 복구도 같은 세션(2026-08-18)에 완료됨 — 아래는 최초 기록 당시(재export 필요로
    판단) 이후 실제 진행된 내용, 이전 버전 문구는 착수 전 상태였던 것으로 정정**: 원본 텍스트
    소실로 재export 대신 swap-back(day/month 역산) 방식으로 직접 복구. (1) `TEMPQA_007_
    SalesAcceptedDateAudit.js`(읽기 전용 감사) — 대표 터치 기준 8,191건 중 **3,193건 오염**
    확인(day≤12만 ambiguous라 이 조건으로 스캔). (2) `TEMPQA_008_SalesAcceptedDateRepair.js` —
    swap-back 공식으로 MTA_Raw 직접 복구("Raw는 원본 보존" 원칙의 명시적 예외 — 원본 텍스트가
    이미 소실돼 보존 자체가 불가능한 상황이라 예외 처리, 사용자 확인) → `rebuildMTAMaster()` →
    `runSyncMTAFunnelToOPS()`로 반영. (3) `TEMPQA_009_SalesAcceptedDateLeadTrace.js` — 복구
    후에도 남은 4개 Lead ID 추적, MTA_Raw/MTA_Master/Leads_OPS 3단 덤프로 원인 분리: 1건은
    대표 터치가 이미 공란인데 Leads_OPS엔 예전 동기화 값이 잔존한 케이스, 나머지는 day>12라
    애초에 swap 가설과 무관(별도 원인 추정, 아래 참고). (4) `TEMPQA_010_
    SalesAcceptedDateStaleClear.js` — 잔존값 1건 강제 클리어 완료(1회성, `syncMTAFunnelToOPS_()`
    자체의 "값 없으면 안 지움" 정책은 유지, 사용자 확정). 상세 서술: `docs/Changelog.md`
    2026-08-19 항목.
    **미해결(남은 범위, 이전보다 훨씬 좁아짐)**: 잔여 **3개 Lead ID**(`00QRC00000ti6Vc`/
    `00QRC00000tnGLi`/`00QRC00000shbd7`)는 day>12라 이 항목의 day/month swap 가설로는 설명이
    안 됨. **2026-08-19 `TEMPQA_013_SalesAcceptedDateResidualTrace.js`(`runTraceSalesAcceptedDateResidual()`)
    실행 결과**: 셋 다 (1) 정확히 그 달의 말일(2026-09-30/10-31/10-31), (2) IC Booked/Completed/
    Won Date 전부 공란(파이프라인 진행 자체가 없음), (3) Priority(P3/P1/P3)·Business
    Segment(Search/BOFU/Content)는 제각각 — day/month swap이 아니라 **Salesforce 쪽 워크플로우/
    롤업이 월말 날짜를 기본값으로 채워 넣었을 가능성**(SLA 마감일, 다음 리뷰 예정일 등)이 유력
    가설로 좁혀짐(미확정). 시트/코드만으로는 더 이상 원인 규명 불가 — 최초 이 버그를 찾았을
    때와 동일하게, 이 3개 Lead ID를 **Salesforce Field History에서 직접 확인** 필요. 임의로
    처리하지 말 것.
    **2026-08-20 후속 — 전수 감사 결과 3건이 아니라 8건**: S&M_REP 사용 중 사용자가 하드코딩된
    3건 리스트로는 설명 안 되는 추가 미래 주(Week Start 2026-08-31/2026-11-30)에도 SAL이
    찍혀있음을 재차 발견 — `TEMPQA_018_SalesAcceptedDateFutureAudit.js`(`runAuditFutureSalesAcceptedDates()`,
    하드코딩 리스트 없이 Leads_OPS 전체를 "오늘 이후 Sales Accepted Date" 조건으로 스캔) 신규
    작성해 실행한 결과, 기존 3건 외에 **5건 추가**(`00QRC00000tsLnl`/`00QRC00000trIOy`/
    `00QRC00000trFxL`/`00QRC00000tb8LW`/`00QRC00000bzYNf`) 확인 — 총 **8건**. 8건 전부
    동일 패턴(day>=28 월말, IC Booked/Completed/Won Date 전부 공란)이라 위 "월말 기본값" 가설과
    100% 부합. **S&M_REP 파생 문제**: 이 오염 데이터가 그대로 Leads_OPS에 남아있어 S&M_REP
    SAL 블록에 미래 주(2026-08-31~09-06/09-28~10-04/10-26~11-01/11-30~12-06)에 실적 값이
    표시되는 원인 — 조건부 서식(증감 하이라이트) 가드는 이미 추가했으나(`SMREP_002_Styles.js`
    v1.2.0) 그건 색상만 숨길 뿐 값 자체는 그대로 남아있음.
    **2026-08-20 판단 정정(사용자 지적)**: IC Booked/Completed/Won Date 공란을 "이상 신호"로
    잘못 해석했었음 — SAL(상담 신청)만 되고 아직 IC를 안 잡은 것은 정상적인 퍼널 중간 상태이지
    데이터 오염의 증거가 아님. 즉 **이 8건이 가짜 이벤트라는 근거는 없고**, 실제로 상담 신청
    자체는 있었을 가능성이 높음 — 의심스러운 건 오직 "날짜 값이 8건 전부 정확히 월말"이라는
    패턴뿐. **따라서 TEMPQA_010 방식의 stale value 클리어(레코드/날짜 삭제)는 부적절함** —
    실제 있었던 상담 신청 기록의 타임스탬프를 근거 없이 지우는 셈이 됨. **처리 방침(확정)**:
    데이터는 그대로 두고, **Salesforce Field History에서 이 8건의 진짜 Sales Accepted Date를
    확인**해 필요 시 그 정확한 날짜로 교정하는 방향으로만 진행 — 임의 삭제/클리어 금지.
    **2026-08-20 근본 원인 확정(사용자가 Salesforce Field History 2건 직접 대조)**: 8건은
    day/month swap이 아니라 **타임존 오사용**이 원인 — TEMPQA_007/008이 day 판정에
    `Date.getDate()`(스크립트 타임존 America/New_York 기준)를 썼는데, 실제 corruption은
    스프레드시트 타임존(Asia/Seoul) 기준으로 발생해 자정 전후 KST 시각이 NY 기준으론
    "전달 말일"로 보여 day≤12 스캔에서 누락된 것. `TEMPQA_020_SalesAcceptedDateTimezoneReaudit.js`로
    MTA_Master 8,191건 전체를 Asia/Seoul 기준 재감사한 결과 **94건**(8건은 그 부분집합, 나머지
    86건은 미래뿐 아니라 2024~2025년 과거 날짜도 포함)이 동일 패턴으로 확인됨 — 반대 방향(잘못
    swap된 것)은 0건, 기존 3,193건 복구는 전부 안전 확인. 상세 원인/증거: `docs/DateParsing.md`
    "2026-08-20 — 두 번째 근본 원인 발견" 섹션. **✅ 복구 완료(2026-08-20)**:
    `TEMPQA_021_SalesAcceptedDateTimezoneRepair.js`(`runApplySalesAcceptedDateTimezoneRepair()`)
    — TEMPQA_008과 동일한 Raw 직접 수정 방식(Seoul 기준 swap-back), 이미 복구된 값(자정 시각)은
    건드리지 않는 안전장치 포함. 실행 결과 94개 리드의 터치 행 177건 복구(리드당 중복 터치 행
    포함) — 전부 "원래 월=1월"로 복구됨(이 타임존 롤백 버그에 걸리는 조건 자체가 "Seoul 기준
    그 달 1일"인 레코드만 해당하고, swap-back 공식상 그 조건이면 항상 1월이 나옴 —
    yunjiseong955@gmail.com 실측 검증(12/1→1월 12일)과 정확히 같은 계산, 버그 아님).
    **✅ 전부 완료·검증 완료(2026-08-20)**: `rebuildMTAMaster()` → `runSyncMTAFunnelToOPS()`
    실행 완료(에러 없음, Leads_OPS 8,221건 갱신), 사용자가 S&M_REP 재Generate 후 미래 주 SAL
    값이 전부 사라진 것 확인. 26번 항목 전체(day/month swap 3,193건 + 타임존 94건 + 예방
    QA 체크) 완결.
    **예방 조치 완료**: `OPS_006_QA.js` v1.7.0에 `checkUnprotectedDateLikeRawColumns_()` 추가 —
    Leads_Raw/MTA_Raw 헤더 중 이름에 "date"가 들어가는데 `CONFIG.RAW_DATE_COLUMNS`에 없는 컬럼을
    매 QA 실행마다 자동 감지(이번 사고의 근본 원인이었던 "보호 목록 갱신 누락"을 재발 방지).
27. **S&M_REP Leads breakdown(Event/BOFU/Content/Organic) New P1 건수가 Salesforce 리포트와
    불일치(2026-08-17~08-23 주 기준) — 조사 진행 중, 다음 세션 계속(2026-08-24)** —
    사용자가 S&M_REP에 New P1 필터를 추가한 직후(아래 SMREP_001_Report.js v1.1.0 참고) 8/17주를
    Salesforce 리포트와 대조: Event 30/BOFU 5/Content 35/Organic 3(Salesforce) vs
    26/4/29/2(S&M_REP) — 4개 버킷 전부 과소집계, 총 12건 차이. Import는 조사 당일(8/24) 실행
    완료된 상태(데이터 지연 아님, 사용자 확인).
    **1차 가설(기각, 2026-08-24)**: `getMondayOfWeek_()`(`TARGET_001_Engine.js`)가
    `date.getFullYear()`/`.getMonth()`/`.getDate()`를 스크립트 타임존(America/New_York)
    기준으로 호출해 Seoul 기준 월요일 새벽 리드가 전 주로 밀릴 수 있다는 가설 — `docs/
    DateParsing.md`의 "Sales Accepted Date 타임존 버그"(26번 항목)와 동일 클래스 우려.
    `TEMPQA_025_SMRepWeekTimezoneTrace.js`(`runTraceSMRepWeekTimezone()`)로 실측한 결과
    버그 있는 방식/Seoul 보정 방식이 완전히 동일한 값(8/17주 newP1=63, Event=26/BOFU=4/
    Content=29/Organic=2)을 냈고 두 방식 간 주 배정이 갈리는 리드도 0건 — **`getMondayOfWeek_()`는
    무관함이 확인됨**. 즉 S&M_REP 코드는 현재 Leads_OPS 데이터를 정확히 집계하고 있고, 불일치는
    "우리 코드 대 Salesforce 리포트" 사이의 문제로 좁혀짐.
    **유력 가설(미검증, 20번 항목 precedent)**: 20번 항목(ACQ_REP New P1 vs Salesforce 불일치,
    2026-08-05)에서 동일 증상(우리 쪽이 Salesforce보다 적게 집계)의 근본 원인이 **Leads_Master의
    미정리 완전동일 중복 Lead 행**(재export로 같은 Lead ID가 여러 번 쌓이고, `mergeOPS()`
    earliest-wins dedup이 최신이 아닌 오래된 스냅샷의 Priority를 채택 — 예: 최신은 Priority 1인데
    오래된 스냅샷 Priority 3이 채택됨)이었던 전례가 있음. 25번 항목(2026-08-09 OPS QA)에서도
    "Exact Duplicate Lead Row 650건"이 미해결로 남아있다고 기록돼 있어, 이번 8/17주 12건 부족도
    같은 메커니즘일 가능성이 있음 — **아직 확인 전, 임의로 처리하지 말 것**.
    **Salesforce 쪽 집계 기준도 미확인**: 사용자가 Event/BOFU/Content/Organic 30/5/35/3을 정확히
    어떤 Salesforce 필드/리포트로 뽑았는지(우리 `getBusinessSegment()`처럼 UTM Campaign/Detail
    키워드 매칭 기반인지, SF 자체의 별도 분류 필드인지) 질문했으나 세션 종료로 답변 전 중단 —
    다음 세션에서 먼저 확인 필요. 만약 SF가 UTM 기반이 아닌 별도 필드로 분류한다면 이건 코드
    버그가 아니라 14번 항목(Business Segment 분류 개선)과 같은 종류의 "우리 키워드 매칭 로직이
    SF의 실제 분류와 다름" 문제일 수 있음.
    **다음 세션 진행 순서(제안)**: (1) Salesforce 집계 기준 확인, (2) `runOPSQA_()` 또는
    `findExactDuplicateLeadRows_()`(`OPS_006_QA.js`)로 8/17주(Create Date) 관련 Lead ID 중
    완전동일 중복이 있는지 확인, (3) 중복이 원인이면 20번 항목과 동일하게
    `runAutoDeleteExactDuplicateLeadRows()` → `buildLeadsOPS()` → S&M_REP 재Generate로 검증.
    **✅ 근본 원인 확정(2026-08-25)** — 위 (2)/(3) 완전동일 중복 가설은 이번 세션에
    `runAutoDeleteExactDuplicateLeadRows()` 재실행 결과 Leads_Master 완전동일 중복 **0건**으로
    기각. (1) Salesforce 집계 기준도 확인 완료 — 사용자가 UTM Campaign/Detail 키워드로 직접
    판단(우리 `getBusinessSegment()`와 사실상 동일 기준), 분류 방식 차이도 아님. **결정적 증거**:
    사용자가 8/17~08/23주 Salesforce New P1 전체 Lead ID 75건을 직접 제공, `TEMPQA_027_
    SMRepNewP1WeekSalesforceDiff.js`(`runCompareSMRepNewP1WeekAgainstSalesforce()`)로
    Leads_OPS/Leads_Master와 Lead ID 단위 1:1 대조한 결과: **63건 정상 일치, "다른 주 배정"
    0건, "P1 아님" 0건, mergeOPS() earliest-wins로 배제된 케이스(Leads_Master엔 있는데
    Leads_OPS엔 없음) 0건 — 누락 12건 전부 Leads_Master에도 존재 자체가 없음**(Import 자체가
    안 됨). 즉 집계 로직/타임존/dedup 버그가 전혀 아니라 **순수 Import 공백(gap)** — 이 12개
    Lead ID(`00QRC00001LKLba/LKZkz/LKzUA/LLlov/LMiAf/LMmnm/LNBZF/LNsJH/LOgL2/LPt6M/LR4R8/
    LRpt3`)가 애초에 어느 주간 CSV export에도 포함된 적이 없음. **✅ 가설 확정(2026-08-25,
    사용자가 75건 전체 Create Date 제공)**: 누락 12건 전부 Create Date = **2026-08-17(그 주
    월요일, 첫날)**로 확정 — 8/17 생성 리드는 정확히 12건이고 그 12건이 통째로 빠졌으며,
    8/18~08/23 생성 리드는 단 한 건도 안 빠짐(63건 전부 일치). 즉 그 주 Leads export가
    8/17을 포함하지 않고 8/18부터 시작됐던 것 — export 날짜 범위 설정 실수(공백)로 최종
    확정, 코드 버그 아님. **해결책**: 2026-08-17(최소 하루, 여유 있게 8/16~08/18 권장)을
    다시 export해 "📥 Update"(Leads)로 재업로드 — 2026-08-25에 추가된 Raw 완전동일 중복
    필터(`IMPORT_008_RawDeduplicator.js`) 덕분에 8/18~23 등 기존에 이미 들어간 행과 겹쳐도
    자동으로 skip되어 안전. **✅ 재업로드 및 검증 완료(2026-08-25)** — 2026-08-17 포함 범위
    재export→재업로드, 파이프라인 전 단계(Master Update~Target_REP) DONE 확인 후
    `runCompareSMRepNewP1WeekAgainstSalesforce()` 재실행 결과 **75건 전체 정상 일치, 누락
    0건**으로 완전히 해소. S&M_REP 화면 재Generate로 Event/BOFU/Content/Organic 30/5/35/3
    최종 확인은 사용자 진행.
28. **Events_OPS 기존 데이터 오염 여부 미확인(2026-08-25)** — Content_OPS에서 발견된
    "Deal Tracker 집계 Business Segment 필터 누락" 버그(`computeContentDealAggregates_()`)와
    동일한 패턴이 `computeEventsDealAggregates_()`(`EVENTS_002_Engine.js`)에도 있어 코드는
    함께 수정 완료(v1.17.0, `EVENTS.SEGMENTS.indexOf(row.businessSegment) === -1`이면 제외).
    다만 **Content_OPS처럼 이미 오염된 행이 Events_OPS에 쌓여있는지는 아직 감사 전** —
    Content용으로 만든 `runAuditContentSegmentDeadKeys()`/`runDeleteDeadContentOPSRows()`
    (`CONTENT_002_Engine.js`)와 동일한 패턴의 Events 전용 함수가 아직 없음. 다음 세션에
    필요 시 Events 버전을 만들어 확인할 것 — 임의로 처리하지 말 것.
29. **`getBusinessSegment()` leadSource="Paid Social" 관련 회귀 테스트 3개 — 이번 변경과
    무관하게 이미 실패 상태였음이 발견됨(2026-08-25), 원인/해결 미착수** —
    `testGetBusinessSegmentContentBeatsGenericContactForm()`/
    `testGetBusinessSegmentSearchCampaignSignals()`/
    `testGetBusinessSegmentContactFallbackToBOFU()`(`UTIL_001_TransformHelper.js`) 3개가
    campaign 예외 가드 수정(v1.17.0) 검증 중 Node vm으로 전체 테스트 스위트를 돌려보다가
    발견됨 — `git show HEAD:UTIL_001_TransformHelper.js`(이번 세션 변경 전 커밋)로도 동일하게
    FAIL 확인, 이번 세션 변경과 무관한 기존 버그. **원인(가설)**: leadSource가 "Paid Social"인
    경우 `SEARCH_CATCHALL_LEAD_SOURCE_OVERRIDES["paid social"] = "Other"`가 campaign의
    "_contact"/"consult" 기반 BOFU/Search fallback(leadSource로 최종 판별하는 블록)보다
    먼저 체크되어, 테스트가 기대하는 "BOFU"/"Search" 대신 "Other"가 반환됨 — 두 블록의
    의도된 우선순위가 서로 다른 세션에서 각각 확정된 뒤 조율 안 된 것으로 추정(미확정).
    실제 라이브 데이터에 영향 있는지(Leads_Master/MTA_Master의 Paid Social 리드가 실제로
    Other로 잘못 떨어지고 있는지) 아직 확인 안 됨 — 다음 세션에 실측 확인 후 처리 방향
    결정할 것, 임의로 처리하지 말 것.
30. **BOFU_OPS/Content_OPS Meta 매칭 커버리지 부족 — 자동화 자체는 정상, 딕셔너리가 못
    찾는 프로그램은 여전히 공란/0(2026-08-25)** — Spent/Campaign/Off-On/Start Date/End
    Date/Impressions/Reach/Link clicks/Results를 Meta_Raw 자동 집계로 전환했으나(`BOFU_004_
    Merge.js`/`CONTENT_004_Merge.js` `applyBOFUMetaCampaignDataIfMatched_()`/
    `applyContentMetaCampaignDataIfMatched_()`), 캠페인명→Marketo Program 매칭이
    `UTIL_002_UtmProgramDictionary.js`(MTA_Master/Leads_Master 터치 데이터에서 자동 채굴)에
    의존해 커버리지가 완전하지 않음 — `TEMPQA_031_BOFUContentMetaSpendMatchDiagnostic.js`
    실측 결과 Meta_Raw 919행 중 554행만 딕셔너리 매칭 성공(365행은 딕셔너리에 아예 없음),
    그중 Content 115행/BOFU 67행만 각 세그먼트로 귀속(Content_OPS 144개 프로그램 중 87개/
    BOFU_OPS 138개 중 92개는 매칭 없음 — 이 프로그램들은 이 8개 필드 전부 기존 수동값
    그대로, 자동화 안 됨). Events_OPS는 이 문제를 딕셔너리 매칭 실패 시 사용하는 수동
    override 맵(`META_CAMPAIGN_NAME_TO_EVENTS_KEY_OVERRIDE`, 사람이 직접 확인한 케이스만
    소수 등록)으로 일부 보완하고 있음 — BOFU/Content는 아직 이런 override 안전망이 없음.
    딕셔너리 자체를 넓히거나(모호한 UTM 재검토 등) override 맵을 BOFU/Content에도 도입할지는
    사용자 확인 필요, 임의로 처리하지 말 것.
31. **Target_REP Actual CPNP1 과소집계 버그 수정 완료 — 잔여 확인 필요(2026-08-25)** — 사용자
    리포트("8월 Webinar Actual CPNP1이 실제보다 훨씬 낮게 나옴")로 조사한 결과
    `isMetaRowWeekPrecise_()`(`AD_002_Meta.js`)가 부분(예: 화~일 6일) Meta export를 "정밀"로
    오인해 그 주의 나머지 요일 지출이 통째로 증발/이중집계되던 버그 2건을 발견·수정
    (v1.14.0~v1.16.0, `docs/Changelog.md` 2026-08-25 "Target_REP Actual CPNP1 과소집계" 섹션
    참고). 코드 수정 자체는 Node 시뮬레이션 + 실 시트 재실행으로 검증 완료했으나, 세션 종료
    시점에 아직 미확인/미완료로 남은 것: (1) `TARGET_002_Report.js`의
    `runRefreshTargetActuals()`를 실행해 Target_REP 시트 자체의 Actual 값이 갱신됐는지
    (사용자에게 요청만 하고 실행 확인 응답은 못 받음), (2) 2026-08-24(월)주 Meta_Raw 데이터가
    아직 비어있어(사용자가 export 붙여넣기 예정이라고 밝힘) 이번 주 Actual이 계속 0/공란으로
    보일 것 — 코드 이슈 아님, (3) 8/17주 수정 후 실측(10,443.03)과의 최종 오차가 얼마인지
    사용자가 직접 재확인한 응답은 못 받음(수정 직전 값 기준 Node 계산상 근접할 것으로 예상만
    확인). 다음 세션에서 위 3가지를 먼저 확인할 것.
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
33. **Won/Lost Deal 중 20~30%가 IC Booked/Completed Date 없이 바로 전환 — 원인 미상, 다음
    세션으로 보류(2026-08-26)** — 32번 항목(ICFunnel_Raw 재도입) 검증 중, 사용자가 전체 기간
    ICFunnel_Raw CSV를 뽑아보니 IC Booked Date가 Salesforce 리포트 화면에 "-"로 보이는 값들이
    있어 "Booked 했다가 취소된 것 아니냐"고 질문 → 후속으로 `Sales Funnel Stage` 컬럼을 추가한
    재export(`report1787695235728.csv`, 36,464행)를 받아 분석.
    **확인된 사실**:
    - 실제 CSV엔 리터럴 `-` 값이 전혀 없음(전부 빈 문자열 아니면 정상 날짜) — 사용자가 본 "-"는
      Salesforce 리포트 화면의 빈 날짜 셀 렌더링으로 추정(코드 처리 불필요, 원본 파일이 이미
      삭제돼 직접 대조는 못 함).
    - **"Opportunity Won Date"가 실제로는 "Opportunity 전환 날짜"라는 기존 추정(5번 항목)이
      데이터로 직접 확인됨** — Lost Deal 733건 전부(100%) Opportunity Won Date가 채워져 있고,
      아직 결론 안 난 Sales Qualified 단계에서도 94%(1,488/1,590)가 이미 채워져 있음.
    - Sales Funnel Stage별 IC Booked/Completed 채움 비율: Lost Deal 733건 중 Booked 586건
      (80%)/Completed 590건(80.5%), Won Deal 918건 중 Booked 646건(70%)/Completed 669건
      (73%) — 즉 Won/Lost Deal의 **20~30%는 IC Booked/Completed Date 없이 바로 전환**됨(이번에
      새로 발견, 기존 파이프라인 버그와 무관 — 빈 값은 정확히 빈 값으로 처리되고 있음, 확인됨).
    **미해결**: 이게 "IC 단계를 정상적으로 건너뛰는 케이스"(예: 재신청/기존 고객 등)인지
    "원래 있어야 하는데 기록 누락"인지 판단 불가 — Salesforce 프로세스/데이터 지식이 필요한
    질문이라 다음 세션으로 보류(사용자 결정, 2026-08-26). 임의로 처리하지 말 것.
34. **Business Segment 딕셔너리("Lead 유입 → Dictionary 조회 → Business Segment 분류")의
    "특이 분류" 모니터링 프로세스 구축 필요 — 미착수(2026-08-26 사용자 요청)** —
    `Program_Segment_Dictionary`는 자동 채굴(다수결)이라, 오늘처럼 딕셔너리가 이미 검증된
    확정 신호를 근거 없이 덮어쓰는 사고가 또 발생할 수 있음(`resolveDefiniteBusinessSegment_()`
    로 확정 신호는 우선권을 갖도록 막아뒀지만, 그 확정 신호 밖에 있는 fallback 영역에서는
    여전히 다수결이 소수 오분류를 그대로 학습해 전파할 위험이 구조적으로 남아있음 —
    `docs/BusinessSegmentClassification.md` 2026-08-26 항목 참고). 매 딕셔너리 갱신
    (`periodicRefreshDictionaries_()`, 12시간 주기)마다 "이번에 새로 추가/변경된 Program→
    Segment 매핑 중 확신도가 낮거나(matchCount/totalCount 비율 낮음) 이전 갱신과 값이
    달라진 항목"을 사람이 주기적으로 육안 검토할 수 있는 리포트/알림 체계가 필요 —
    구체적 설계(별도 진단 시트로 뽑을지, 이메일/Slack 알림을 붙일지, 얼마나 자주 볼지 등)는
    미정, 다음 세션에 설계 착수. 참고: `TEMPQA_034_BusinessSegmentDictionaryDiff.js`가
    지금은 1회성 수동 diff 진단이라 이 목적에 가장 가까운 기존 코드 — 이걸 정기 모니터링
    체계로 발전시키는 방향이 유력해 보이나 확정 아님, 임의로 설계하지 말고 사용자와 먼저
    논의할 것.
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
    **막힌 지점(사용자 액션 필요, TODO)**: (1) `CONFIG.SAL.EXTERNAL.SPREADSHEET_ID`가
    아직 빈 문자열 — 사용자가 새 Google Sheet를 만들고 그 안에 "SAL_Raw"라는 이름의
    탭을 만든 뒤 스프레드시트 ID를 공유해줘야 함. (2) Salesforce에서 SAL 전용 리포트
    ("All leads" 범위, IC Booked Date 필터 없음, TEMPQA_045에서 쓴 CSV와 유사하되
    이번엔 "New (Not Contacted) Date Time" 필드까지 포함)를 새로 만들어 export해야
    함. 둘 다 완료되기 전까지 `runSyncSALToOPS()`/`importSALReport()`는 명시적
    에러로 실패함(추측으로 진행하지 않음). 완료 후 잔여 24건이 실제로 해소되는지
    재검증 필요 — 확인 전까지 완료로 간주하지 말 것.

    **🔴 P1 TODO #2 — 잔여 14건: Leads 리포트 필터 범위 문제로 별개, 코드로 처리 불가,
    사용자 액션 대기**: 이 리드들이 `Leads_OPS`(및 상당수는 `Leads_Master`)에 아예 없음 — IC
    Funnel/SAL 리포트엔 잡히는데 "Leads" 수동 export 리포트("LeadsIC_KR_mkt_2.0")에서만 빠짐.
    재import 타이밍 문제 아님(Leads가 IC Funnel보다 오히려 최신인데도 재현됨, 실측 확인) —
    **사용자가 Salesforce에서 두 리포트("Leads" vs IC Funnel/SAL)의 필터 조건을 직접 나란히
    비교해야 함**, 임의로 처리하지 말 것. IC Booked/Complete(TEMPQA_042/043)도 같은 종류의
    미등록 리드(3건, Lead ID `00QRC00000ZsV97`/`00QRC00000D1CCY`/`00QRC000011JJ3o`) 영향을
    받고 있어 이 필터 이슈가 해결되면 같이 개선될 것으로 예상.
39. **Leads_OPS 필드 소유권 전면 재편 — 구현 완료(2026-09-02), 실사용 검증 대기(TODO)** —
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
    대소문자/공백 불일치 등 버그)가 섞여있는지는 확인 안 됨. 임의로 처리하지 말 것, 다음
    세션에서 78건 이메일 샘플 + Lead Source/Close FY를 덤프하는 임시 조사 스크립트로 확인.
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
41. ~~Engine/OPS/Report 조회 의존성 매트릭스 확인 중 발견한 중복 외부 오픈 2건~~ — **✅ 둘 다
    구현 및 실측 검증 완료(2026-09-03)**: BOFU/Content는 모듈 스코프 메모이제이션
    (`BOFU_002_Engine.js` v1.7.0/`CONTENT_002_Engine.js` v1.8.0), FY_REP은
    `openFYRepMarketingSourceFile_()` 단일 오픈(`FYREP_001_Engine.js` v1.8.0). 상세:
    `docs/exec-plans/active/2026-09-02-pipeline-refresh-time-redesign.md`. (아래는 발견
    당시 원문, 참고용)
    2026-09-02 사용자 요청으로 Engine 6종·OPS 5종·Report 5종
    함수가 각자 무엇을 읽는지 전수 확인(어느 함수가 어떤 시트/외부 워크북을 여는지 매핑).
    대부분은 "Engine이 원본을 계산 → OPS는 Engine 캐시만 읽음 → Report는 OPS/Engine 캐시만
    읽음"으로 깔끔하게 연쇄돼 있으나, 예외 2건이 같은 외부 파일을 같은 실행 주기 안에서
    반복해서 여는 게 확인됨 — 둘 다 "분리"보다는 **"한 번 계산해서 캐시하고 재사용"** 쪽이
    해법으로 보임(임의로 구현하지 말 것, 설계 검토 후 진행).
    - **BOFU/Content — Meta_Raw + UTM Dictionary 이중 조회**: `computeBOFUMetaCampaignDataAggregates_()`
      (`BOFU_002_Engine.js`)가 **동일한 함수 그대로** `refreshBOFUEngine_()`(Engine 단계,
      Spent 계산용)와 `buildBOFUOPS()`(OPS Build 단계, Campaign/Off-On/Start·End Date/
      Link clicks/Results 자동채움용, `BOFU_003_Build.js:48`)에서 각각 호출됨 — 매 사이클
      Meta_Raw 외부 워크북과 UTM_Program_Dictionary를 두 번씩 읽음. 반환값 자체에 이미
      spend 외에 clicks/results/campaignNames/campaignStart/campaignEnd/hasOngoing이
      전부 들어있는데(주석 확인, `BOFU_002_Engine.js` 270행대) Engine 단계에서 Spent만
      뽑아 쓰고 나머지는 버리는 구조라 OPS Build가 어쩔 수 없이 재계산하는 상황. Content도
      `computeContentMetaCampaignDataAggregates_()`로 완전히 동일한 패턴(`CONTENT_002_
      Engine.js`/`CONTENT_003_Build.js:49`). **제안(검토 필요, 구현 안 함)**: Engine 단계가
      계산한 전체 반환값을 캐시 시트에 같이 저장해두고, OPS Build는 그 캐시만 읽도록 변경
      — Meta_Raw/Dictionary 외부 오픈이 사이클당 1회로 줄어듦. Events_Engine은 이미 OPS
      Build 단계에서 재조회를 안 하는 비대칭 구조라 왜 다른지도 함께 확인 필요.
    - **FY_REP — perfTrackerByFY 외부 워크북을 FY 개수만큼 반복 오픈**: `computeFYRepMarketingRowsForFY_()`
      (`FYREP_001_Engine.js:489`)가 `SpreadsheetApp.openById()`를 호출부마다 새로 열고,
      `computeFYRepCompanyRevenueTargetsForFY_()`(:942)도 별개로 또 엶 — `CONFIG.FYREP.FYS`에
      설정된 FY(24/25/26 등) 하나당 각각 호출되므로, FY_REP Generate 한 번에 외부 오픈이
      FY 개수 × 최대 2회 반복됨. ACQ_REP/NewP1_REP/Target_REP은 전부 `Ad_Spend_Cache`(주기적
      트리거로 미리 캐시, Report는 캐시만 읽음) 패턴으로 이미 이 문제를 해소해뒀는데 FY_REP만
      그 패턴이 없음. **제안(검토 필요, 구현 안 함)**: `Ad_Spend_Cache`와 동일하게 perfTrackerByFY
      데이터를 주기적 트리거로 로컬 캐시에 미리 읽어두고, `generateFYReport_()`는 캐시만
      읽도록 전환 — 단, perfTrackerByFY는 사용자가 다른 곳에서 직접 편집하는 외부 시트라
      캐시 주기 동안의 최신성 트레이드오프는 사용자 확인 필요.
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
43. **Lead Priority(P1) 기준 리스트 기반 자동 Flagging — 아이디어만 기록, 미착수(TODO)**
    (2026-09-03) — S&M_REP 성능 개선 설계 논의 중 발견: `Lead Priority`가 리드 유입 후
    바뀔 수 있는 이유는 Salesforce 자동 재분류가 아니라 **실무자가 P1 기준(연 학비
    2500만원 이상 학교) 대비 수기 검수 후 정정**하는 것(사용자 확인) — 그리고 이 P1
    기준에 해당하는 학교 리스트가 실제로 존재함. **아이디어**: Import마다 도는 에이전트가
    이 리스트를 기준으로 방금 들어온 리드의 학교와 대조해, 리스트 기준과 다르게 찍힌
    Lead Priority 값(예: 리스트상 P1 대상 학교인데 Priority가 P1이 아니거나 그 반대)을
    자동으로 flagging — 지금은 정정이 실무자 수기 검수에만 의존하는데, 이 flagging이
    있으면 검수 대상을 좁혀주거나 놓친 케이스를 잡아줄 수 있음. **아직 설계 착수 전** —
    리스트 자체가 어디 있는지/형식/최신성, flagging 결과를 어디에 어떻게 노출할지(별도
    QA 시트? Leads_OPS_QA 확장?) 전부 미정. 임의로 처리하지 말 것.
44. **SAL Sync가 무관한 Engine 6종까지 매번 전부 재실행 — 코드로 확인, 미착수(TODO)**
    (2026-09-03) — S&M_REP 성능 개선 설계 논의 중 사용자가 "SAL/IC 같은 세일즈 퍼널
    데이터가 들어올 때마다 New P1까지 전부 다시 훑을 필요가 있냐"고 지적, 코드 확인 결과
    실제로 낭비 확인됨. `syncSALToOPS_()`(`MASTER_010_SALSync.js:356-363`)는 `Sales
    Accepted Date` 필드 하나만 동기화하는데(Create Date/Lead Priority는 전혀 안 건드림),
    끝에서 `refreshACQSummary_()`/`refreshNewP1Engine_()`/Events/BOFU/Search/Content
    Engine/`refreshTargetActuals_()` 7개를 조건 없이 전부 재실행 — Leads_OPS/MTA_Master
    전체 재스캔이 SAL 하나 때문에 매번 도는 구조. (`syncICFunnelToOPS_()`는 Lead Priority도
    함께 동기화하는 경로라 New P1이 실제로 바뀔 수 있어 이 문제에 덜 해당 —
    `applyPriorityDowngradeGuard_()` 참고.) **막힌 지점**: 제대로 고치려면
    `refreshACQSummary_()`(및 나머지 Engine들)를 "SAL 파생 부분만 부분 갱신" 가능하게
    쪼개야 하는데, 이건 그 자체로 별도 설계/구현 작업 — 오늘(#39 Revenue 매칭 실패 조사 중
    파생된 S&M_REP 성능 개선) 범위에는 포함하지 않기로 함. 임의로 처리하지 말 것.
45. **Salesforce에서 추출해야 할 필드값을 리포트(Export 타입)별로 정리 — 사용자 요청, 미착수(TODO)**
    (2026-09-03, Master_DB Raw 이관 세션 중 메모) — 지금은 각 Export 타입(New Leads/MTA/IC
    Funnel/SAL)이 어떤 Salesforce 필드를 필요로 하는지가 `CORE_001_Config.js`의
    `REQUIRED_FIELDS`/`RAW_DATE_COLUMNS`/각 Transformer(`MASTER_006_LeadTransformer.js`/
    `MASTER_007_MTATransformer.js`)/`MASTER_009_ICFunnelSync.js`/`MASTER_010_SALSync.js`
    코드 여기저기에 흩어져 있어, "이 리포트를 만들려면 Salesforce에서 정확히 어떤 필드를
    뽑아야 하는가"를 한눈에 보려면 코드를 전부 훑어야 함. 리포트별(New Leads Export/MTA
    Export/IC Funnel Export/SAL Export)로 필요한 Salesforce 필드 목록을 정리하는 문서화
    작업 — 어느 문서에 정리할지, 필드별로 "어느 다운스트림 리포트/컬럼이 이 필드를 쓰는지"까지
    역추적해서 정리할지는 착수 시 확인. 임의로 처리하지 말 것.
46. **자동 리포트 생성이 installable onEdit 트리거를 재발동시켜 파이프라인 tail이 느려짐 —
    실측으로 발견, 미착수(TODO)** (2026-09-03, Master_DB Raw 이관 검증 세션 중 발견) —
    `runICFunnelPipelineTail()` 실행이 19분 넘게 걸려 원인 조사 중 확인. `handleReportGenerateEdit`
    (`ACQREP_001_Report.js`, ACQ_REP/NewP1_REP/S&M_REP의 Generate 체크박스 처리)와
    `onFYReportEdit_`(`FYREP_002_Report.js`)는 **installable onEdit 트리거**로 등록돼 있는데,
    installable onEdit은 Simple Trigger와 달리 사람이 직접 편집할 때뿐 아니라 **스크립트 자신이
    같은 스프레드시트에 값을 쓸 때도 발동**한다 — 그래서 파이프라인 tail 안에서
    `generateACQReport_()`/`generateNewP1Report_()`/`generateSMReport_()`/`generateFYReport_()`가
    리포트 시트에 쓰기를 할 때마다 이 핸들러들이 반복 재발동됨(실측: `runICFunnelPipelineTail`
    실행 중이던 11:13~11:22 사이 `onFYReportEdit_`/`handleReportGenerateEdit`가 10회 넘게
    개별 실행으로 잡힘, 사용자가 그 시간에 시트를 전혀 건드리지 않았음을 확인). 각 재발동은
    가드 조건(`row`/`col`이 정확히 Generate 체크박스 셀인지, `e.value === "TRUE"`인지)에서
    대부분 조기 return하므로 무한루프나 중복 생성으로 이어지진 않는 것으로 보이지만, 같은
    스프레드시트에 여러 실행이 동시에 몰리면서 Apps Script 락 경합을 유발해 그 tail의 Events/
    BOFU/Content Engine 구간이 평소(MTA tail 기준 각 55~76초)보다 2~3배 느려짐(각 153~207초)이
    실측 확인됨. **막힌 지점**: 정확한 근본 수정 방향(예: 리포트 쓰기를 이 트리거들이 감지 못하는
    방식으로 바꿀지, 가드에 "이 실행이 같은 파이프라인 tail 안에서 발생했는지" 체크를 추가할지)은
    미검토 — 이번 세션(Master_DB Raw 이관) 범위 밖이라 조사만 하고 수정하지 않음. 임의로
    처리하지 말 것.
47. **Revenue 파이프라인 — Leads/MTA/IC Funnel/SAL 완료에 얹혀가는 방식 대신 독립 트리거로
    분리 — 아이디어만 기록, 미착수(TODO)** (2026-09-03, Master_DB Raw 이관 세션 중 사용자
    제안) — 지금 `runRevenuePipelineTail()`(`MASTER_011_RevenueSync.js`)은 CSV Import가
    없는 유일한 타입이라 Leads/MTA/IC Funnel/SAL 중 아무 tail이나 끝날 때마다
    `enqueuePendingPipelineType_(CONFIG.PIPELINE.TYPES.REVENUE)`로 대기열에 얹혀가는 방식으로만
    트리거됨(`CORE_001_Config.js` v1.56.0 변경 이력 참고). 그런데 Revenue의 실제 소스인 Deal
    Tracker(외부 스프레드시트)는 이 4개 파이프라인과 무관하게 바뀌므로, 지금 방식도 "진짜 변경
    감지"가 아니라 다른 파이프라인에 편승하는 간접 트리거일 뿐 — 사용자가 차라리 Revenue를
    떼어내 독립적으로 도는 트리거로 바꾸자고 제안. 두 방향 검토됨:
    - **단순 시간 트리거**: 이 프로젝트에 이미 선례 있음 —
      `periodicRefreshAllReports_()`(하루 2번 KST 10/22시 강제 재계산, 42번 항목 참고)와 동일
      패턴을 Revenue에도 적용. 구현 난이도 낮음, 기존 검증된 패턴 재사용.
    - **Deal Tracker 자체 변경 감지(신규 입력 발생 시 트리거)**: 이 스크립트가 Deal Tracker
      외부 스프레드시트에 직접 installable onEdit 트리거를 설치하는 게 기술적으로 가능해
      보이나(편집 권한만 있으면 소유하지 않은 스프레드시트에도 설치형 트리거를 걸 수 있음),
      **실제로 되는지 검증 안 됨** — 이 프로젝트가 Simple Trigger의 외부 `openById()` 권한
      부족으로 이미 여러 번 막힌 이력(Target_REP/ACQ_REP 사례)이 있어 신중한 검증 필요.
    막힌 지점: 두 방향 중 어느 쪽으로 갈지, 착수 시점 확정 필요 — 임의로 처리하지 말 것.
