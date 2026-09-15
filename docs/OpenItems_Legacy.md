# Open Items Legacy (완료된 항목 아카이브)

> `docs/OpenItems.md`에서 2026-09-15에 분리된 아카이브 파일입니다. 전체 하위 항목까지
> 완전히 해결된(더 이상 미해결 부분이 없는) 항목만 여기로 옮겼습니다 — 원문 그대로,
> 문구 수정 없음. **번호는 절대 재사용/재번호화하지 않습니다** — 다른 문서/코드 주석에서
> "N번 항목"으로 이 파일 또는 `docs/OpenItems.md`를 교차 참조하는 경우가 많기 때문입니다.
> **현재 미해결 항목을 확인하려면 이 파일이 아니라 `docs/OpenItems.md`를 볼 것.**
1. ~~`Leads_OPS_QA` 생성 로직 — 의도적으로 미구현~~ — 구현 완료 (`24_OPSQA.js`, `writeOPSQAResults_()`). Dashboard(Master vs Leads_OPS 지표 대조) + Issues 테이블을 `Leads_OPS_QA` 시트에 기록. `buildLeadsOPS()` 실행 시 자동 호출(`21_OPS_Build.js`), 메뉴에서 "Run Leads_OPS QA"로 수동 실행도 가능. 문서 반영 누락 상태였다가 2026-07-24 뒤늦게 기록.
2. ~~IC Request(SAL)의 `#touches`(터치 횟수) 지표~~ — 4번 항목(재신청 카운터)과 동일 항목으로 확인, 구현 완료. 2026-07-24 정정 (별개 항목으로 잘못 분리 기재돼 있었음).
3. ~~MTA_Master에 "완전 동일한(all-fields identical) duplicate row" 검출 로직 없음~~ — 2026-07-24 판단 기준 확정 및 구현 완료. "완전 동일" = Lead ID + MTA Created Date + MKT UTM Campaign + First Lead Source + First Touch Detail(터치 식별 필드) 5개가 전부 일치하는 경우 (IC Booked/Completed/Won Date, Revenue, Lead Priority 등 export 시점마다 값이 바뀔 수 있는 Lead 레벨 스냅샷 필드는 비교에서 제외). `findExactDuplicateTouchRows_()`/`checkExactDuplicateTouchRows_()`(`24_OPSQA.js`)로 검출해 `Leads_OPS_QA` 시트에 이슈로 플래그, `buildLeadsOPS()` 실행 시 자동 실행. **자동 삭제는 하지 않음** — 검출/보고만 수행하며, 실제 제거 여부는 이슈 확인 후 별도 결정.
4. ~~`IC Requested` 재신청 이력 미보존~~ — 2026-07-22 설계 확정 및 구현 완료 (`applyICRequestTracking_()`, `22_OPS_Merge.js`). `Total IC Requests`/`Last IC Requested Date` 컬럼 추가, 매 OPS sync마다 `IC Requested`가 true였으면 카운터 +1 후 리셋. 자세한 내용: `docs/OperationsLayer.md` "IC Request Tracking" 섹션.
6. ~~SAL 과집계 원인 발견~~ — 2026-07-25 해결 완료. `Lead Record Type`(Lead 레벨 스냅샷이라 오래전 SAL이 된 리드의 무관한 후속 터치까지 집계되던 문제) 대신, Salesforce MTA export에 새로 추가 가능한 `Lead: Sales Accepted Date`(진짜 이벤트 날짜) 필드로 전환. `13_MTATransformer.js`/`09_MTAFunnelSync.js`/`20_OPS_Config.js`/`30_ACQReport.js` 전부 반영, SAL 계산이 MTA_Master 터치 단위에서 Leads_OPS 리드 단위(이벤트 날짜 기준)로 이동. 자세한 내용: `docs/ACQReportDesign.md` "SAL 과집계 원인 해결" 섹션.
8. ~~완전 동일 중복 터치(Exact Duplicate Touch Row) 자동 삭제~~ — 구현 및 실행 검증 완료(2026-07-28). 3번 항목에서 검출 로직(`findExactDuplicateTouchRows_()`, `24_OPSQA.js`)은 구현 완료했지만 자동 삭제는 의도적으로 보류해뒀었음. 2026-07-25 사용자 요청: 자동 삭제까지 구현하면 MTA 재export 시 날짜 겹침을 크게 신경 안 써도 되고(겹쳐 올려도 중복만 자동 정리됨), 지금처럼 "MTA_Raw/MTA_Master 전체 삭제 후 재구축"하는 무거운 프로세스를 매번 반복할 필요가 줄어듦. **설계**: 삭제 안전성 검토 결과 `MTA_LAST_ROW`(PropertiesService)는 MTA_**Raw** 처리 진행률만 추적할 뿐 MTA_Master 행 위치와 무관하고(`07_IncrementalMasterBuild.js` `appendNewMTA()` 참고), MTA_Master는 매 append마다 어차피 `sortSheetByDate()`로 재정렬되므로 삭제로 인한 카운터/정렬 부작용이 없음을 확인 — 애초 우려했던 안전성 이슈가 해소됨. 삭제 기준(사용자 확정): 5개 필드 완전 일치 그룹 중 **"가장 진행된 단계"의 행만 남김**(Won[Opportunity Won Date 유효 또는 Revenue>0] > IC Complete > IC Booked > 없음 순, 동점이면 시트상 더 나중 행 유지) — IC Booked/Completed/Won Date, Revenue 등 export 시점마다 달라지는 Lead 레벨 스냅샷 필드의 진행 정보 손실을 최소화. 그룹 키는 5개 필드(MTA Created Date 포함) 전부 일치해야만 성립하므로, 같은 캠페인에 날짜만 다른 정상적인 재참여 터치는 절대 삭제 대상이 안 됨(사용자 확인). 구현: `24_OPSQA.js`(v1.3.0)의 `runAutoDeleteExactDuplicateTouchRows()`(수동 실행 진입점)/`findExactDuplicateTouchRowsToDelete_()`/`readMTAMasterRowsWithIndex_()`/`computeTouchProgressionScore_()`. **실행 결과(사용자 확인, 2026-07-28)**: 294개 중복 행 삭제, MTA_Master 82,714 → 82,420행, 에러 없음(약 5분 소요). ~~자동 실행 체인엔 아직 배선 안 함~~ — **2026-08-04부터 배선됨**: `08_PipelineAsync.js`의 `runMTAPipelineTail()` 첫 단계(`syncMTAFunnelToOPS_()`보다 먼저)로 매 MTA 백그라운드 실행마다 자동 호출(사용자 요청). 삭제 후 ACQ_Summary 등 캐시 지표는 관련 Engine refresh 재실행 또는 다음 `appendNewMTA()` 시 자동 반영.
16. **2026-07-29 세션 — Search를 Marketo 프로그램화 + git worktree 사고 복구** — 이전 항목들과 별개 세션. (a) Search_OPS를 raw UTM 그레인에서 부분적으로 프로그램화 — Naver SA/Google SA Marketo Program이 Lead Source Detail에 잡히면 Program명을 키로, Channel도 Naver Search/Google Search로 구분(패턴 매칭이라 향후 신규 프로그램도 자동 인식). "research"가 "search"로 오탐되던 버그 발견·수정(예: "college-research-ebook"이 강제로 Search 처리되던 것), Search_OPS 육안 재검토로 50여 개 캠페인 개별 재분류. Channel 기본값 "Meta"(실검증 안 된 값)를 빈 값으로 변경, 모든 OPS 시트 정렬을 "빈 날짜 최상단"에서 "빈 날짜 최하단"으로 통일, Leads_OPS에 누락돼 있던 Create Date 정렬 추가. (b) **사고 발견 및 복구**: 세션 도중 `git worktree list` 확인 없이 main에서 `clasp push`를 반복하다가, 별도 worktree(`worktree-clever-seeking-dolphin`, main과 동일 scriptId)가 이전에 라이브 배포해뒀던 Target_REP New/Pipeline 2트랙 Block C/D 코드를 덮어써 Target_REP가 0으로 표시되는 사고 발생 — worktree 브랜치를 main에 merge해 복구(90_TargetEngine.js v1.15.0/00_Config.js v1.12.0 changelog 참고). **재발 방지**: 앞으로 세션 시작 시 git sync 체크에 `git worktree list`도 포함할 것(기존 "Session-Start Git Sync Check" 원칙에 반영 필요).
19. **캠페인 지출(Ad_Spend_Cache) 독립 스케줄 갱신 — 구현 완료(2026-08-08)** — 2026-08-04
    보류 이후, ACQ_REP refresh 시 Kakao Moments(메시지광고 API) 신규 데이터가 반영 안 되는
    문제를 계기로 사용자가 직접 보류를 해제. `periodicRefreshAdSpendCache_()`
    (`AD_004_SpendCache.js` 신규)를 매 `AD.SPEND_CACHE.PERIODIC_REFRESH_INTERVAL_HOURS`
    (4)시간마다 도는 시간 트리거로 설치(`runInstallAdSpendPeriodicRefreshTrigger()`, 최초 1회
    수동 실행 필요) — `syncKakaoMomentsReportToKakaoSMSRaw_()`로 `KakaoSMS_Raw`를 먼저
    최신화한 뒤 `refreshAdSpendCache_()`(Meta+Naver Search+Kakao Channel/Moments 통합)를
    호출. 기존 `08_PipelineAsync.js` 파이프라인 트리거(`refreshCampaignSpend_()`, Leads/MTA
    import 직후 실행)는 그대로 유지 — 이번 트리거는 그 사이 공백을 메우는 용도로 추가.
23. ~~QA 에이전트 설계~~ — **설계 및 구현 완료(2026-08-09)**. 사용자 확인 결과 스코프는
    데이터 정합성+리포트 값 검증+코드/엔지니어링 품질 3개 전부, 형태는 Claude Code 서브에이전트/
    스킬. `.claude/skills/qa-review/SKILL.md` 신규(Apps Script 코드 변경 없음, 스킬/문서만).
    Claude가 라이브 Google Sheet를 읽을 방법이 전혀 없음을 확인해(Sheets API/MCP/`clasp
    run-function` 전무) 리포트 값 검증 모드는 "진단 함수 작성 → 사용자가 Apps Script 편집기에서
    직접 Run → 결과 붙여넣기" 가이드형 워크플로우로 설계, naming/version-header/중복선언/문법은
    이미 `scripts/check-*.sh`가 커버하므로 재구현하지 않음. 상세: `docs/QAAgentDesign.md`.
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
28. ~~Events_OPS 기존 데이터 오염 여부 미확인~~ — **✅ 감사 완료, 오염 없음 확인
    (2026-09-05)**. Content_OPS에서 발견된 "Deal Tracker 집계 Business Segment 필터
    누락" 버그(`computeContentDealAggregates_()`)와 동일한 패턴이
    `computeEventsDealAggregates_()`(`EVENTS_002_Engine.js`)에도 있어 코드는 함께 수정
    완료(v1.17.0, `EVENTS.SEGMENTS.indexOf(row.businessSegment) === -1`이면 제외).
    감사 도구 신규: `CONTENT_002_Engine.js`의 `runAuditContentSegmentDeadKeys()`/
    `runDeleteDeadContentOPSRows()`와 동일 패턴을 `EVENTS_002_Engine.js` v1.21.0에
    그대로 복제 — `runAuditEventsSegmentDeadKeys()`(진단, 죽은 키 목록 + 수동 데이터
    존재 여부 로그)/`runDeleteDeadEventsOPSRows(force)`/
    `runDeleteDeadEventsOPSRowsForce()`(수동 데이터 있어도 강제 삭제) 신규. Events는
    `GROUP_3_MANUAL`이 빈 배열이고 "Channel" 컬럼 자체가 없어 Content/BOFU의 Channel
    기본값 예외 처리는 필요 없어 그 부분만 제외. `check-syntax`/`check-naming`/
    `check-version-header`/`check-duplicate-declarations` 전부 통과, 순수 I/O 진단
    유틸리티라 Content 쪽 선례와 동일하게 별도 단위 테스트는 없음.
    **✅ 사용자 실행 결과(2026-09-05)**: `runAuditEventsSegmentDeadKeys()` 실행 —
    죽은 키 0건(수동 데이터 있음=0, 완전 공백=0). Events_OPS는 Content_OPS와 달리
    이 구조적 문제의 영향을 받은 적이 없는 것으로 확인 — `runDeleteDeadEventsOPSRows()`
    실행 자체가 불필요, 삭제할 대상 없음. 이 항목 완결.
29. ~~`getBusinessSegment()` leadSource="Paid Social" 관련 회귀 테스트 3개 FAIL~~ — **✅ 원인
    확정·수정 완료(2026-09-04)**. 원인: `SEARCH_CATCHALL_LEAD_SOURCE_OVERRIDES["paid social"/
    "affiliate organization"/"offline outreach"] = "Other"`(2026-07-29 추가)가 campaign의
    "_contact"/"consult" 기반 BOFU/Search fallback(2026-07-28 확정)보다 먼저 체크되고 있어
    fallback에 도달을 못 하던 순서 버그(가설 그대로 확정) — "Organic Content"→"Content"
    매핑만 이 fallback과 충돌이 없어 원래 위치 유지, 나머지 3개(→"Other")만 fallback 뒤로
    이동(`UTIL_001_TransformHelper.js` v1.21.0). **실측 영향 범위 확인 후 진행**:
    `TEMPQA_047_PaidSocialContactFallbackOrderDiagnostic.js`(신규, 읽기 전용)로 사용자가
    직접 Run — Leads_Master 36,680건 중 17건/MTA_Master 85,384건 중 42건이 영향 대상(전부
    "_contact"/"consult"/"book-a-consult" 캠페인의 Paid Social 리드, Other→BOFU로 재분류
    예상), 샘플 확인 후 사용자 승인 얻고 진행. `testGetBusinessSegmentContentBeatsGenericContactForm()`
    의 stale 기대값 1건도 함께 정정(`testGetBusinessSegmentResearchSubstringFix()`의 동일
    입력 기대값과 모순돼 있었음 — 더 최신인 후자 기준으로 정정). Node vm 하네스로
    getBusinessSegment 관련 테스트 14개 전부 PASS 확인, `check-syntax`/`check-naming`/
    `check-version-header`/`check-duplicate-declarations` 전부 통과, push 완료.
    **✅ 기존 데이터 소급 반영 완료(2026-09-04)** — Full Rebuild 대신 이번 순서버그 영향분만
    정확히 타겟팅하는 1회성 Repair 스크립트로 진행(사용자 확정, 더 큰 범위인 #22의 dictionary
    drift 소급 적용과는 별도 사안으로 분리 유지). `TEMPQA_048_PaidSocialContactFallbackOrderRepair.js`
    (신규, TEMPQA_047과 동일 판정 조건 재사용)의 `runRepairPaidSocialContactFallbackOrderSegments()`
    실행 결과 Leads_Master 17건/MTA_Master 42건 갱신(TEMPQA_047 실측치와 정확히 일치),
    Business Segment 컬럼만 "Other"→"BOFU"로 직접 수정(Raw는 안 건드림).
    **✅ 하위 캐시 반영도 완료(2026-09-04)** — `MASTER_002_PipelineAsync.js`의
    `runLeadsPipelineTail()`/`runMTAPipelineTail()`(둘 다 "트리거 대상 + 수동 재실행
    진입점"으로 설계돼 있어 직접 Run 가능, #9 참고)를 순서대로 수동 실행 — 각각 에러 없이
    `Execution completed`로 완주(Leads tail 약 12분/MTA tail 약 10분). buildLeadsOPS/
    Events·BOFU·Search·Content_OPS 재작성/ACQ·NewP1·Events·BOFU·Search·Content Engine
    6종/ACQ_REP·NewP1_REP·Target_REP·S&M_REP·FY_REP 리포트 5종 전부 정상 재생성 확인 —
    이 두 실행이 **#9(비동기 파이프라인 재설계) 잔여 검증 항목의 "체인이 끝까지 안전하게
    도는지"도 함께 검증**(단, `appendNewLeads()`/`appendNewMTA()` 경유 시의 트리거 설치/
    자동 발동 경로까지 검증한 것은 아니므로 #9는 계속 별도 미해결로 유지).
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
    **✅ 세분화 진단 스크립트 신규(2026-09-05)**: `TEMPQA_051_BOFUContentMetaProgramCoverageDiagnostic.js`
    (읽기 전용) — `runDiagnoseBOFUContentMetaProgramCoverage()`가 미매칭 프로그램마다
    원인을 4가지로 분류: (1) `UTM_Program_Dictionary`에 이 프로그램을 가리키는 UTM
    항목 자체가 없음(0건 터치 추정 — 딕셔너리 확장/override 둘 다 무효), (2) 수동 제외
    목록(`UTM_PROGRAM_DICT_MANUAL_EXCLUSIONS`)에만 걸림, (3) 후보는 있지만 전부
    모호(distinctProgramCount>1)해서 제외 — 그 중 실제로 Meta_Raw에 그 UTM 캠페인명이
    존재하는 것만 "override 도입 시 진짜 Spend가 채워지는" 유효 후보로 별도 카운트,
    (4) 확실한 후보(distinctProgramCount===1)가 있는데도 안 잡힌 경우(버그 의심, 별도
    확인 필요). `resolveMetaCampaignProgramKey_()`(`EVENTS_002_Engine.js`)가 실제로
    쓰는 정규화(`stripLGSuffix_(stripRegistrationFormSuffix_(...))`)를 그대로 재사용해
    실제 매칭 로직과 동일한 기준으로 비교. **실측 결과(2026-09-05, 사용자 실행)**:
    BOFU 미매칭 92건 — (1) 딕셔너리 자체 없음 35 / (3) 모호(override 후보 12건) 19 /
    (4) 확실한 후보인데 Meta_Raw엔 없음(버그 아님) 37 / (5) 확실한 후보 + Meta_Raw에도
    있는데 안 잡힘(버그 의심) 1. Content 미매칭 86건 — (1) 18 / (3) 모호(override 후보
    7건) 15 / (4) 44 / (5) **9**. (5)번이 예상외로 유의미해 `runTraceBOFUContentMetaProgramMismatch()`
    신규(실제 프로덕션 함수 그대로 호출해 단계별 추적)로 원인 확정.
    **✅ 근본 원인 확정 및 수정 완료(2026-09-05)**: (5)번 10건 전부 딕셔너리 조회/
    정규화는 정확한데 `isEligibleBOFUProgram_()`/`isEligibleContentProgram_()`의
    `getBusinessSegment(programName, programName)` 재분류 단계에서 false가 나옴 —
    Program명 문자열 하나를 campaign/detail 두 슬롯에 억지로 넣는 방식이 실제 리드의
    진짜 campaign/detail 조합과 달라 키워드 규칙이 다르게 걸리는 구조적 한계(예:
    "WF-2026-02-KOR-MOFU-Core RISE Academic Foundation"은 matchCount 559/559로
    완벽히 확실한 매칭인데도 재분류에서 Content가 아니라고 오판). `Program_Segment_Dictionary`
    (실제 Leads_Master/MTA_Master 다수결 채굴, #22/#34)가 이미 이 프로그램이 실제로
    어떤 세그먼트인지 아는 그라운드 트루스라는 점에 착안 — `isEligibleBOFUProgramPure_()`/
    `isEligibleContentProgramPure_()` 신규(순수 함수, Program_Segment_Dictionary
    최우선 조회 → 없으면 기존 `getBusinessSegment()` 재분류로 폴백), 기존
    `isEligibleBOFUProgram_()`/`isEligibleContentProgram_()`는 `readProgramSegmentDictionaryMap_()`
    로 맵을 가져와 위임하는 IO 래퍼로 축소(단일 인자 시그니처 유지, 호출부 변경 없음,
    `BOFU_002_Engine.js` v1.8.0/`CONTENT_002_Engine.js` v1.9.0). Node vm 하네스로
    `testIsEligibleBOFUProgram()`/`testIsEligibleContentProgram()`(딕셔너리 히트/미스
    양쪽 케이스로 갱신) 전부 PASS, `check-syntax`/`check-naming`/`check-version-header`/
    `check-duplicate-declarations` 전부 통과, push 완료. **(1)/(4)번(딕셔너리에 UTM
    후보 자체가 없거나 Meta_Raw에 그 캠페인 자체가 없음)은 코드로 해결 불가 — 그
    광고가 지금까지 리드로 귀속된 적이 없거나 Meta 스펜드 자체가 없다는 뜻이라
    딕셔너리 확장/override 둘 다 무효, 낮은 우선순위로 그대로 둠(사용자 확인 불필요,
    구조적 한계)**. **(3)번 override 후보(BOFU 12건/Content 7건)는 이번 세션 범위
    밖 — Events_OPS 선례(`META_CAMPAIGN_NAME_TO_EVENTS_KEY_OVERRIDE`)와 동일한
    override 맵을 BOFU/Content에 도입할지는 여전히 사용자 결정 필요, 임의로 처리하지
    말 것.** **✅ (5)번 잔여 완전 해소(2026-09-08)**: `runRefreshBOFUEngine()`/
    `runRefreshContentEngine()` → `buildBOFUOPS()`/`buildContentOPS()` 재실행 후
    `TEMPQA_051`을 다시 돌려보니 (5)번 버킷이 BOFU 1건/Content 9건에서 BOFU 1건/Content
    6건으로만 줄어 완전히 안 없어짐 — 추가 조사 필요했음. `TEMPQA_052_ProgramSegmentDictionaryAmbiguityCheck.js`로
    `Program_Segment_Dictionary` 원본 행을 직접 조회한 결과, 남은 7건 전부
    `distinctSegmentCount=2`(다수결 제외 대상)인데 실제 다수결은 "Content"이고
    비율이 59~99.7%로 압도적임을 확인 — 즉 (5)번 버킷 판정의 전제("확실한 후보인데
    코드가 안 잡는다")가 틀렸고, 진짜 원인은 **딕셔너리 자체가 이 프로그램들을
    "애매함"으로 정확히 판단해 제외한 것**(소수 의견이 하나만 있어도 무조건 제외하는
    현재 임계값 때문). `TEMPQA_053_ProgramSegmentSplitTrace.js`로 MTA_Master/
    Leads_Master 원본 터치를 UTM Campaign별로 쪼개본 결과, 소수 의견은 **완전히 무관한
    다른 캠페인**임이 확정됨 — 예: "Army Infographic"(BOFU 목록에 있었음)의 Content
    51건은 전부 진짜 에북 캠페인("hyperlocalised-army-infographic-mofu" 등)인데, BOFU
    1건은 전혀 다른 캠페인("google-perfmax-acquisition-consult-bofu_contact")이 우연히
    같은 Program 텍스트 라벨을 공유한 것 — 분류 로직 버그(#29류)가 아니라 Program
    그룹핑 라벨이 서로 다른 캠페인을 우연히 묶는 데이터 구조상 노이즈. "RISE Academic
    Foundation" 등 나머지 6건도 동일 패턴(다수 Content vs 소수 Search/기타, 전부 별개
    캠페인). **✅ 해소(2026-09-08, 사용자 확인)**: 사용자가 데이터 근거를 확인한 후
    Program_Segment_Override로 다수결 확정하기로 결정 — `TEMPQA_054_ProgramSegmentOverrideAdd.js`
    (신규, 기존 `readProgramSegmentOverrideMap_()`/`writeOverrideMap_()`/
    `mergeOverrideMaps_()` 그대로 재사용해 clobber 위험 없이 merge)로 7건을
    `Program_Segment_Override`에 "Content"로 추가(기존 30건 → 37건). Engine/OPS
    재실행 후 `TEMPQA_051` 재검증: **Content 매칭 성공 61→67건(정확히 +6, (5)번
    버킷 0으로 완전 해소)**. BOFU (5)번은 "Army Infographic" 1건이 여전히 표시되지만
    이건 실제 버그가 아니라 진단 스크립트의 한계 — 이제 이 프로그램은 (의도대로) BOFU가
    아니라 Content로 정확히 재분류됐으므로 BOFU 쪽 미매칭은 올바른 동작이고,
    `TEMPQA_051`의 (5)번 판정 로직이 override 존재 여부를 반영하지 않아 계속 "버그
    의심"으로 오탐될 뿐(별도 코드 수정 불필요, 낮은 우선순위 — 원하면 나중에 진단
    스크립트에 override 인지 로직 추가 가능). **#30 전체 완료로 간주.**
31. ~~Target_REP Actual CPNP1 과소집계 버그~~ — **✅ 2026-08-25 버그 2건 수정 + 2026-09-09
    별개 신규 버그(과다집계) 발견·수정, 전부 실사용 검증 완료**. 최초(2026-08-25): 사용자
    리포트("8월 Webinar Actual CPNP1이 실제보다 훨씬 낮게 나옴")로 조사한 결과
    `isMetaRowWeekPrecise_()`(`AD_002_Meta.js`)가 부분(예: 화~일 6일) Meta export를 "정밀"로
    오인해 그 주의 나머지 요일 지출이 통째로 증발/이중집계되던 버그 2건을 발견·수정
    (v1.14.0~v1.16.0, `docs/Changelog.md` 2026-08-25 섹션). 당시 세션 종료 시점 미확인
    3가지(runRefreshTargetActuals 실행 확인/8·17주 최종 오차/8·24주 공란 여부)는 이후 여러
    세션의 실 Import·리포트 재생성으로 간접 해소된 상태였음.
    **2026-09-09 신규 발견 — 완전히 별개의 새 버그(과다집계, 위와 반대 방향)**: 사용자가 최근
    Meta 지출 export를 한 주를 여러 배치로 나눠 올리는 방식(예: 월~수/수~토)으로 바꾸면서,
    같은 캠페인의 같은 주를 "정밀" 행 2개 이상이 동시에 커버하는 케이스가 발생 —
    `aggregateMetaSpendByWeekSegment_()`가 이 여러 정밀 행을 각각 독립적으로
    7일치로 비례보정(prorate)한 뒤 그냥 합산해, 실제 지출의 최대 1.85배까지 과다집계됨
    (2026-09-09 실측: 사용자가 준 Campaigns 2.0 원본 데이터 기준 8/31주 raw $16,299.06 vs
    기존 로직 $30,149.82 — Target_REP CPNP1 역산값과 거의 정확히 일치해 실제로 반영되고
    있던 과다집계로 확인). **수정**: 신규 `computeEffectiveMetaDateRange_()`/
    `mergePreciseMetaRecordsForCampaignWeek_()`(`AD_002_Meta.js` v1.18.0) — 같은 캠페인+같은
    주를 커버하는 정밀 행들을 먼저 그룹핑·병합(raw spent 합산, effectiveStart/End는
    가장 이른/늦은 값)한 뒤 딱 한 번만 prorate하도록 `aggregateMetaSpendByWeekSegment_()`
    재작성 — 두 배치가 합쳐서 7일 전체를 커버하면 자동으로 보정 없이 raw 합산값 채택됨.
    기존 `isMetaRowWeekPrecise_()`/`computeMetaRowWeeklySpend_()`/`prorateSingleWeekMetaSpend_()`
    자체는 변경 없음(이미 검증된 코드, 회귀 위험 최소화). **검증**: Node 시뮬레이션으로 실제
    분할배치 데이터 재현 결과 fixed/raw 비율 정확히 1.0000 확인, Apps Script
    `testMergePreciseMetaRecordsForCampaignWeek()`/`testAggregateMetaSpendByWeekSegment()`
    (분할배치 회귀 케이스 추가) 전부 PASS, 실 `runRefreshAdSpendWeeklyCache()` →
    `runRefreshTargetActuals()` 재실행 후 Target_REP 8/31주 Actual CPNP1이 Webinar
    $652.81→$394.11/BOFU $596.78→$327.48/Content $798.42→$401.14로 정상화(약 50~60%
    감소, 이중집계 제거 비율 1÷1.85≈54%와 부합) — Search만 거의 불변($213.85→$214.34,
    Naver Search Ads API 기반이라 이 Meta 버그와 원래 무관, 정상). **이 패턴은 사용자가
    앞으로도 계속 쓸 예정(2026-09-09 확인)** — 우연한 1회성 이슈가 아니라 상시 케이스.
33. ~~Won/Lost Deal 중 20~30%가 IC Booked/Completed Date 없이 바로 전환~~ — **✅ 원인 확인
    완료(2026-09-09, 사용자 확인)** — 처음부터 Salesforce "Contact"로 생성된 케이스는 우리가
    쓰는 Lead 리포트(Leads_Master의 소스)에 애초에 안 잡힘 — 그 딜에 대응하는 Lead 레코드
    자체가 없으니 Lead 레벨 필드인 IC Booked/Completed Date도 우리 파이프라인 안에 존재할
    방법이 없음(#39의 "Account로 전환된 리드가 Lead 리포트에서 안 보임"과 동일 종류의
    Salesforce 데이터 구조 문제). 기록 누락(버그)이 아니라 애초에 추적 대상이 아니었던
    케이스로 확정 — 코드 조치 불필요, 이 항목 종료. 32번 항목(ICFunnel_Raw 재도입) 검증 중, 사용자가 전체 기간
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
    **✅ 판단 완료(2026-09-09)**: 위 결론 참고 — Contact로 생성된 케이스가 이 20~30%의
    실체로 확인됨.
34. ~~Business Segment 딕셔너리("Lead 유입 → Dictionary 조회 → Business Segment 분류")의
    "특이 분류" 모니터링 프로세스 구축~~ — **✅ 설계·구현·실측 검증 완료(2026-09-04)**.
    사용자와 방향 먼저 논의 후 진행 — 플래깅 대상 3종 전부 확정: (1) 확신도 낮은
    (matchCount/totalCount < 70%) 신규 Program 키, (2) 다수결이 뒤집힌 기존 키, (3) 애매한
    키(Distinct Segment Count > 1, 이미 소비처에선 자동 제외되지만 사람이 해결 전까진 매
    사이클 계속 플래깅). 출력 위치는 신규 시트 `Marketo_QA`(사용자 확정 이름). 구현:
    `UTIL_004_DictionaryQA.js` 신규 — `detectProgramSegmentDictionaryAnomalies_()`(순수
    함수, 이전/이후 스냅샷 비교) + `readAllProgramSegmentDictionaryEntries_()`(필터 없이
    5개 core 컬럼 전체 리더, 기존 `readProgramSegmentDictionaryMap_()`은 애매한 키를
    걸러내므로 재사용 불가) + `writeMarketoQASheet_()`(Leads_OPS_QA/P1_School_Mismatch_QA와
    동일한 clear+재작성 스냅샷 관행) + `refreshProgramSegmentDictionaryWithAnomalyCheck_()`
    (갱신 자체는 격리 없이 실패 전파, diff+쓰기 단계만 try/catch로 격리). `CONFIG.MARKETO_QA`
    (`CORE_001_Config.js` v1.64.0, `SHEET`/`LOW_CONFIDENCE_THRESHOLD=0.7`) 신규.
    `periodicRefreshDictionaries_()`(`UTIL_002_UtmProgramDictionary.js` v1.10.0, 12시간
    주기 트리거 기존 설치돼 있어 재설치 불필요)의 `refreshProgramSegmentDictionaryIncremental_()`
    단독 호출을 `refreshProgramSegmentDictionaryWithAnomalyCheck_()`로 교체해 자동 편입.
    Node vm으로 `testDetectProgramSegmentDictionaryAnomalies()` PASS, `check-syntax`/
    `check-naming`/`check-version-header`/`check-duplicate-declarations` 전부 통과, push
    완료. **실 시트 검증(2026-09-04, `runCheckProgramSegmentDictionaryAnomalies()` 수동
    실행)**: 전체 2,853개 Program 키 중 153건(5.4%) 플래깅, 에러 없이 정상 완료.
    **Override 반영 방식 — 최초 설계 후 사용자 재요청으로 즉시 재설계(2026-09-04, 같은
    세션)**: 최초엔 별도 시트(Program_Segment_Override)에 사람이 직접 입력하는 방식으로
    구현했으나, 사용자가 "QA탭에서 컬럼 하나 추가하는 걸 생각했다"고 재요청 — `Marketo_QA`
    자체의 마지막 컬럼("Override (직접 입력)")에서 바로 입력하도록 전환.
    `readMarketoQAOverrideColumnValues_()`(clear 직전에 그 컬럼값 캡처, 순서가 핵심 —
    바뀌면 입력값이 반영 전에 날아감)/`mergeProgramSegmentOverrides_()`(순수 함수)/
    `writeProgramSegmentOverrideMap_()`(병합 결과를 내부 저장소에 자동 동기화) 신규 —
    `Program_Segment_Override` 시트는 이제 사람이 직접 관리하는 시트가 아니라 Marketo_QA
    컬럼값이 매 사이클 자동 동기화되는 내부 누적 저장소로 성격 변경(직접 편집도 여전히
    지원 — 다음 병합 시 보존됨). UTM 표시도 같은 세션에 함께 요청·구현: Marketo_QA에
    "UTM Campaign(s)" 컬럼(Program당 매칭 UTM 최대 5개 샘플, `UTM_Program_Dictionary`
    역인덱싱) 추가. Node vm으로 신규 테스트(`testBuildProgramToUtmCampaignsMap`/
    `testAttachUtmCampaignsToAnomalies`/`testFilterOutOverriddenProgramAnomalies`/
    `testMergeProgramSegmentOverrides`) 전부 PASS, 재설계 후 `runCheckProgramSegmentDictionaryAnomalies()`
    재실행 결과 148건 플래깅, 에러 없이 정상 완료(신규 10번째 컬럼 정상 반영 확인).
    **✅ 표시 간소화 + 단일/복수 UTM 정렬 + override 왕복 실사용 검증 완료(2026-09-04, 같은
    세션 후속 요청)** — 사용자 요청: (1) "실제 판단에 필요한건 marketo program, utm,
    business segment (현재)면 충분해" → `Marketo_QA` 컬럼을 4개(Marketo Program/UTM
    Campaign(s)/Business Segment (현재)/Override (직접 입력))로 축소, 판정 근거(Anomaly
    Type/이전 Segment/Match·Total Count/Confidence/Distinct Segment Count)는 내부 로직만
    쓰고 화면엔 안 보임 — Anomaly Type이 사라지며 한 Program이 여러 사유로 중복 표시되던
    문제를 `dedupeAnomaliesByProgram_()`(순수 함수, 신규)로 Program당 1행만 남겨 해소.
    (2) "UTM이 단일인 것과 아닌 것을 구분할 필요가 있다 — 여러 개 묶인 건 하나하나 검토,
    단일 오분류는 바로 분류 가능" → `attachUtmCampaignsToAnomalies_()`에 `utmCount`(원본
    개수) 필드 추가, `sortAnomaliesForReview_()`(순수 함수, 신규)로 UTM 개수 오름차순(단일
    먼저) → Program 알파벳순 정렬. `readMarketoQAOverrideColumnValues_()`는 고정 컬럼
    인덱스 대신 **그 순간 실제 시트 헤더 텍스트**로 컬럼을 찾도록 전환(컬럼 레이아웃이
    10개→4개로 바뀌는 배포 중에도 사용자가 예전 레이아웃에 이미 입력해둔 override 값이
    안전하게 캡처되도록). Node vm으로 신규 테스트(`testDedupeAnomaliesByProgram`/
    `testSortAnomaliesForReview`) 포함 전체 7개 PASS. **실사용 왕복 검증(2026-09-04,
    사용자 직접 수행)**: 사용자가 `Marketo_QA`에서 3건을 미리 override 입력 →
    `runCheckProgramSegmentDictionaryAnomalies()` 재실행 → 로그 "148건 플래깅" →
    "145건 플래깅(override로 제외된 3건, 이번 사이클 신규 캡처된 override 3건)"으로 정확히
    3건 감소, 사용자가 시트에서 해당 3건이 실제로 사라진 것 육안 확인 — override 입력→
    캡처→딕셔너리 반영→재플래깅 제외 전체 왕복 흐름 실사용 검증 완료.
    **✅ UTM 단위 explode + override selector 드롭다운 추가 완료(2026-09-04, 같은 세션
    최종 요청)** — 사용자가 실제 사례 3건(`ca_cgahq_2024-03-06_search-curriculum-courses_contact`
    등)을 짚으며 "여러 UTM이 섞인 Program은 하나로 override하면 안 되고 UTM별로 따로
    분류해야 한다"고 지적 → 설계: UTM이 1개 이상 매칭되는 Program은 UTM별로 행을 펼치고
    (매칭 UTM이 없는 Program만 Program 단위 행 유지), override도 UTM 단위/Program 단위
    이원화. 구현: `attachUtmCampaignsToAnomalies_()`(joined 문자열)를 `explodeAnomaliesByUtm_()`
    (UTM별 개별 행, 순수 함수)로 교체, `sortAnomaliesForReview_()`는 UTM 개수 정렬 대신
    program→utm 알파벳순으로 단순화(explode 후엔 모든 행이 이미 원자적). UTM 단위
    override 저장소 `UTM_Segment_Override`(`CONFIG.MARKETO_QA.UTM_OVERRIDE_SHEET`) 신규 —
    `resolveBusinessSegment_()`(`UTIL_002_UtmProgramDictionary.js` v1.12.0)가 이 값을
    Program 딕셔너리/확정 신호보다도 먼저 최우선 적용. `filterOutOverriddenProgramAnomalies_()`
    를 `filterOutOverriddenRows_()`(UTM/Program 겸용)로 교체, `mergeProgramSegmentOverrides_()`
    는 도메인 무관 범용 함수라 `mergeOverrideMaps_()`로 개명(Program/UTM 양쪽 재사용).
    **Override selector**(사용자 요청 — "클릭변경이 가능하게"): `CONFIG.MARKETO_QA.
    BUSINESS_SEGMENT_OPTIONS`(getBusinessSegment() 실제 반환값 전체를 grep으로 확인해
    나열) 기반 Data Validation(드롭다운)을 "Override (직접 입력)" 컬럼에 적용, 자유
    텍스트 입력 차단. **배포 직전 발견·수정한 버그 2건**: (1) `filterOutOverriddenRows_()`
    가 UTM 단위 행을 UTM override map으로만 판단하면, 이미 Program 단위로 확정해둔
    항목이 그 Program에 매칭되는 UTM이 있다는 이유만으로 재플래깅되는 오탐 발견 — UTM
    단위 행도 Program override map을 먼저 확인하도록 수정. (2) 실측 중
    `sheet.clearDataValidations is not a function` 에러 발견(Sheet에 없는 메서드,
    Range에만 존재) — `sheet.getRange(1,1,maxRows,maxCols).clearDataValidations()`로
    수정. Node vm으로 신규 테스트(`testExplodeAnomaliesByUtm`/`testMergeOverrideMaps`/
    `testFilterOutOverriddenRows`) 포함 전체 7개 PASS. **실측 검증(2026-09-04,
    `runCheckProgramSegmentDictionaryAnomalies()` 재실행)**: 에러 없이 정상 완료 — Program
    148개 anomaly가 UTM 단위로 517행까지 explode, override로 제외된 13행(기존에 확정해둔
    3개 Program에 속한 UTM들 — 버그 수정이 실제로 작동함을 실측으로 재확인), 최종 504행
    플래깅. **✅ 전체 소진 완료(2026-09-04, 같은 세션)** — 사용자가 517개 UTM 단위 행 전체에
    드롭다운으로 override를 채워넣고 재실행 → 516행 제외(신규 Program 27건/UTM 476건), 최종
    1행만 잔존. 그 1건(UTM 매칭 없는 Program)의 실제 리드 Email 확인용
    `TEMPQA_049_MarketoQARemainingRowEmailLookup.js`(읽기 전용) 신규 — Marketo_QA 잔여 행의
    Program/UTM으로 Leads_Master/MTA_Master를 매칭해 Email 조회. 추가 요청으로
    `Program_Segment_Override`/`UTM_Segment_Override` 두 시트를 `ensureOverrideSheetExists_()`
    가 기존/신규 무관하게 매번 `hideSheet()`로 숨김 처리하도록 수정(`UTIL_004_DictionaryQA.js`
    v2.1.0) — 이제 사람이 직접 편집하지 않는 내부 자동 동기화 저장소로 성격 확정. 사용자가
    마지막 1건까지 override 처리 완료해 #34 전체 종료. **잔여**: `LOW_CONFIDENCE_THRESHOLD`
    (70%) 자체가 적정한지는 다음 딕셔너리 갱신 사이클(12시간 주기)에서 신규 플래깅이 얼마나
    나오는지 보며 계속 판단.
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
43. ~~Lead Priority(P1) 기준 리스트 기반 자동 Flagging~~ — **✅ #48로 구현 완료 확인
    (2026-09-05 정리)**. 아래 아이디어 등록(2026-09-03) 당시엔 별개 미착수 TODO였으나,
    같은 날 별도 번호로 등록된 #48(외부 P1 School List 기반 Lead Priority 불일치
    검출·플래깅)이 정확히 이 아이디어를 구현 — 외부 P1 School List 스프레드시트로 리스트
    소재 확정, `P1_School_Mismatch_QA` 시트로 노출 위치 확정, `runLeadsPipelineTail()`
    자동 편입까지 전부 여기서 "미정"이라 적어둔 항목의 실제 답. 즉 신규 작업이 아니라
    #48과의 중복 등록이었던 것으로 확인 — 별도로 손댈 것 없음. **✅ #48 자체도 2026-09-08
    실 Leads Import로 최종 검증 완료**(정방향 불일치 2119건 + 역방향 Not_Striked 첫 실제
    양성 케이스 13건, 파이프라인 자동 편입 에러 없음) — exec-plan
    `docs/exec-plans/completed/2026-09-04-p1-school-mismatch-check.md`로 이동. 아래는 최초
    등록 원문(참고용, 보존).
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
44. ~~SAL Sync가 무관한 Engine 6종까지 매번 전부 재실행~~ — **✅ 구현 및 실사용 검증
    완료(2026-09-03 설계/구현, 2026-09-08 실사용 검증)** — `docs/exec-plans/completed/
    2026-09-02-pipeline-refresh-time-redesign.md`에서 해결. `computeSALDeltaLeads_()`
    (신규 순수 함수) + `refreshACQSummarySALDelta_()`(`ACQREP_002_Summary.js` v1.5.0)로
    "무관한 Engine 6종 전부 재실행"을 "이번에 바뀐 리드만 반영하는 델타 병합"으로 교체
    (`MASTER_010_SALSync.js` v1.1.0). 실사용 검증(2026-09-08): SAL Import 로그에서 기존
    6개 Engine 전체 재실행 대신 "ACQ Summary SAL-Delta Refresh Started" → "Completed :
    10 leads changed (3.24s)" 한 줄로 정확히 끝남 확인.
45. ~~Salesforce에서 추출해야 할 필드값을 리포트(Export 타입)별로 정리~~ — **✅ 문서화
    완료(2026-09-04)**. `docs/SalesforceFieldRequirements.md` 신규 — `CORE_001_Config.js`의
    `REQUIRED_FIELDS`/`RAW_DATE_COLUMNS`/`IC_FUNNEL.COLUMNS`/`SAL.COLUMNS`와 각 Transformer/
    Sync 파일(`MASTER_006_LeadTransformer.js`/`MASTER_007_MTATransformer.js`/
    `MASTER_009_ICFunnelSync.js`/`MASTER_010_SALSync.js`)을 직접 읽어 Export 타입(New
    Leads/MTA/IC Funnel/SAL)별 필드 목록·필수 여부·day-first 날짜 보호 필요 여부를 표로
    정리, 공통 주의사항(day-first 보호 누락 시 영구 손상 위험, Raw 헤더 미반영 시 조용한
    드롭 위험)도 함께 기록. **범위 결정(착수 시 확정)**: 필드별 다운스트림 리포트/컬럼
    역추적은 하지 않음(Business Segment 등 다수 리포트에 영향을 주는 필드가 많아 과도한
    범위 확장으로 판단) — 대신 파생 컬럼 단위로 용도만 요약. CLAUDE.md 문서 목록에도 등록.
46. ~~자동 리포트 생성이 installable onEdit 트리거를 재발동시켜 파이프라인 tail이 느려짐~~ —
    **✅ 가드 추가로 수정 완료(2026-09-05), 실사용 검증 완료(2026-09-09)** (2026-09-03, Master_DB Raw
    이관 검증 세션 중 발견) — `runICFunnelPipelineTail()` 실행이 19분 넘게 걸려 원인 조사 중
    확인. `handleReportGenerateEdit`(`ACQREP_001_Report.js`, ACQ_REP/NewP1_REP/S&M_REP의
    Generate 체크박스 처리)와 `onFYReportEdit_`(`FYREP_002_Report.js`)는 **installable
    onEdit 트리거**로 등록돼 있는데, installable onEdit은 Simple Trigger와 달리 사람이
    직접 편집할 때뿐 아니라 **스크립트 자신이 같은 스프레드시트에 값을 쓸 때도 발동**한다 —
    그래서 파이프라인 tail 안에서 `generateACQReport_()`/`generateNewP1Report_()`/
    `generateSMReport_()`/`generateFYReport_()`가 리포트 시트에 쓰기를 할 때마다 이
    핸들러들이 반복 재발동됨(실측: `runICFunnelPipelineTail` 실행 중이던 11:13~11:22 사이
    `onFYReportEdit_`/`handleReportGenerateEdit`가 10회 넘게 개별 실행으로 잡힘, 사용자가 그
    시간에 시트를 전혀 건드리지 않았음을 확인). 각 재발동은 가드 조건(`row`/`col`이 정확히
    Generate 체크박스 셀인지, `e.value === "TRUE"`인지)에서 대부분 조기 return하므로
    무한루프나 중복 생성으로 이어지진 않는 것으로 보이지만, 같은 스프레드시트에 여러 실행이
    동시에 몰리면서 Apps Script 락 경합을 유발해 그 tail의 Events/BOFU/Content Engine
    구간이 평소(MTA tail 기준 각 55~76초)보다 2~3배 느려짐(각 153~207초)이 실측 확인됨.
    **✅ 수정 완료(2026-09-05)**: 두 방향(리포트 쓰기를 트리거가 감지 못하게 바꾸기 vs
    "같은 파이프라인 tail 안에서 발생했는지" 가드 추가) 중 후자로 진행 — `PIPELINE_LOCK`이
    파이프라인 tail 실행 중에만 값을 갖는다는 점을 이용해, `acquirePipelineLock_()`가
    쓰는 `computePipelineLockState_()`(순수 함수, staleness 판정 포함)를 재사용한 읽기
    전용 peek `isPipelineTailRunning_()`(`MASTER_002_PipelineAsync.js` v1.29.0, 락을
    획득/해제하지 않음) 신규 — `handleReportGenerateEdit()`(`ACQREP_001_Report.js`
    v1.20.0)/`onFYReportEdit_()`(`FYREP_002_Report.js` v4.2.0) 맨 앞에 이 가드를 추가해
    파이프라인 tail 실행 중이면 즉시 return하도록 수정. `check-syntax`/`check-naming`/
    `check-version-header`/`check-duplicate-declarations` 전부 통과, `computePipelineLockState_()`
    재사용이라 별도 신규 테스트는 없음(기존 `testComputePipelineLockState()`가 이미 커버).
    **알려진 트레이드오프(사용자 확인 없이 진행 — 순수 성능 최적화, 리포트 출력값 자체는
    변경 없음)**: 사람이 파이프라인 tail 실행 도중 정확히 같은 순간 Generate 체크박스를
    직접 클릭하면 이번 사이클엔 무시됨(체크박스는 TRUE로 남고 자동 리셋도 안 됨) —
    `periodicRefreshAllReports_()`(하루 2번 강제 재계산) 안전망이 있어 리스크 낮다고 판단.
    **✅ 실사용 검증 완료(2026-09-09)** — 실 `runICFunnelPipelineTail`(11:15:15 시작,
    754.9초) 로그 대조: 재발동 자체는 여전히 발생(11:25:07~11:26:08 사이 8회, Report
    Generation 단계에서 리포트 시트 쓰기 때마다 반응 — 구조상 막을 수 없는 부분, 가드는
    "재발동 후 즉시 return"만 보장) — 각 재발동이 전부 1.25~3.57초로 짧게 끝나 가드가
    의도대로 초입에서 빠져나가는 패턴 확인(전체 재생성 로직이 도는 흔적 없음). Engine
    구간은 Search 61.40s/Content 69.67s로 정상 범위(55~76s), Events 117.05s/BOFU
    108.61s는 다소 높지만 원래 버그 수치(153~207s)에는 못 미침 — **이번 재발동 클러스터
    (Report Generation 단계)는 Engine Refresh 단계(11:16:48~11:22:45)보다 시간상 나중에
    발생해 서로 안 겹침**, 즉 이번 실행에서 Events/BOFU가 다소 높은 건 재발동 락 경합이
    원인일 수 없음 — 같은 날 아침 MTA→SAL→IC Funnel이 연속으로 밀려 돈 것(#18 파이프라인
    겹침 이슈)이 더 유력. 원래 보고됐던 심각한 재발(153~207s 수준) 재현 없음, 재발동도
    빠르게 소진 — 완료로 정리. (Engine 구간 소폭 상승의 정확한 원인이 100% 분리 확인된
    건 아니라 #18과 연결지어 계속 관찰.)
47. ~~Revenue 파이프라인 — Leads/MTA/IC Funnel/SAL 완료에 얹혀가는 방식 대신 독립 트리거로
    분리~~ — **✅ 구현 및 실사용 검증 완료(2026-09-03 설계/구현, 2026-09-09 2회 연속
    재예약 확인)** — 두 방향 중 "단순 시간 트리거"로 확정, `docs/exec-plans/completed/
    2026-09-02-pipeline-refresh-time-redesign.md`에서 해결. `scheduleNextRevenuePeriodicRefresh_()`/
    `periodicRefreshRevenue_()`(`MASTER_002_PipelineAsync.js`)가 2시간마다 독립 실행
    (`PIPELINE_LOCK`은 계속 존중, 획득 실패 시 대기열 등록 후 다음 주기 재시도). **2026-09-08
    버그 발견·수정**: self-rescheduling이 실패 시 체인이 끊기는 구조적 결함을 실사용 중
    발견해 `finally`로 재예약을 옮겨 수정(v1.30.0). **2026-09-09 최종 검증**: Executions
    로그로 2회 연속 정상 재예약(07:32→09:38 KST 예약대로 정확히 발동→11:46 KST 재예약)
    확인, 체인 복구 확정.
48. ~~외부 P1 리스트 시트 기반 Lead Priority 불일치 검출 및 플래깅~~ — **✅ 완료(2026-09-08 실 Import 검증까지 마무리)** (2026-09-03 등록) — 외부 "P1 School List" 스프레드시트(`15OVBIzK40s7a2mOCPDs9mrINpS9MUFrUse02KtQqW4Q`, 사용자 확정 — E열 대표 학교명 + N열부터 오기입 변형 표기)와 Leads_OPS를 대조해, School Name이 P1 리스트에 있는데 effective Priority(`isEffectiveP1_()` 재사용, Priority Override 우선)가 P1이 아닌 리드를 `P1_School_Mismatch_QA` 시트에 플래깅(사용자 확정 — 이메일 알림 없음, Leads Import 파이프라인에 자동 편입). `runCheckP1SchoolMismatch()` 실행 결과 P1 학교 572개(별칭 포함)/Leads_OPS 36,628건 대조, 불일치 2,116건 기록 — 사용자가 상위 10건 육안 대조해 School Name 매칭 정확함을 확인(2026-09-04). 역방향 체크(`Not_Striked`, 2026-09-04 이후 신규 P1 리드 중 리스트에 없는 학교)도 함께 구현. **✅ 2026-09-08 실 Leads Import로 최종 검증**: `runLeadsPipelineTail()` 안에서 `checkP1SchoolMismatch_` 자동 편입 확인(정방향 불일치 2,119건, 역방향 Not_Striked 신규 학교 13건 — 배포 후 첫 실제 양성 케이스), 에러 없음. 상세: `docs/exec-plans/completed/2026-09-04-p1-school-mismatch-check.md`.
