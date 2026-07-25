# Marketing 2.0 (crimson-lead-tracker)

Google Apps Script 기반 마케팅 리드 ETL 파이프라인 프로젝트입니다.
아래 문서들은 이 프로젝트의 아키텍처 원칙, 비즈니스 로직, 엔지니어링 규칙을 담고 있습니다.
코드를 수정/생성하기 전에 관련 문서를 먼저 참고하세요.

## 핵심 원칙 (요약)

- **Staged ETL**: `CSV → Import(Raw) → Master Build → Master → Leads_OPS → Reports`
- **Single Responsibility**: 파일 하나 = 책임 하나. Business logic은 Master Build 단계에만 존재.
- **No Assumptions**: Sheet 이름, Column Index, Header, Business Logic, 기존 함수/아키텍처는 절대 추측하지 않는다. 모르면 질문한다.
- **Configuration Centralized**: 모든 설정값은 `00_Config.js`의 `CONFIG` 객체에만 존재. 하드코딩 금지.
- **Raw is Immutable / Master is Rebuildable**: Raw는 원본 보존, 수동 수정 금지. Master는 Raw로부터 언제든 재생성 가능.
- **Backward Compatibility**: 파일명, 함수명, 함수 시그니처, 기존 시트/수식/출력 변경 금지 (승인 없이는).
- **TDD (Test-Driven Development)**: 새 함수를 만들거나 기존 함수를 수정할 때, 반드시 다음을 함께 작성한다.
  - 이 함수가 **왜 필요한지**(WHY) 함수 상단 주석에 명시
  - 구현 완료 후 **기대값과 실제값을 비교 확인할 수 있는 테스트 함수**(`testXXXX()` 형태, `docs/NamingConvention.md` 참고)를 같은 파일 또는 관련 파일에 함께 추가
  - 테스트가 통과하기 전까지 해당 함수를 "완료"로 간주하지 않는다 (`docs/EngineeringConstitutionalRULES.md` Article 3, Article 6 참고)
- **File Versioning**: 파일 내용을 수정할 때마다(새 함수 추가/기존 함수 수정 등) 파일 상단 헤더의 `Version`/`Change Log`를 함께 갱신한다. 자세한 형식: `docs/NamingConvention.md` "File Versioning" 섹션.
- **Manual Execution Instructions**: `clasp run-function` 미도입 상태라 Apps Script 함수는 사용자가 Apps Script 편집기에서 직접 Run 해야 한다. 사용자에게 함수 실행을 요청할 때는 **반드시 파일명 + 함수명을 함께 명시**한다 (예: "`09_MTAFunnelSync.js`의 `runSyncMTAFunnelToOPS()` 실행해주세요" — 함수명만 말하지 않는다).
- **Session-End Auto Log & Commit**: 사용자가 "오늘은 여기까지" 류의 종료멘트를 하면, 별도 요청 없이 그 세션에서 실제로 변경된 내용을 `docs/Changelog.md`에 날짜별 항목으로 기록하고 커밋까지 진행한다 (단, 실제 파일 변경이 있었을 때만 — 순수 Q&A만 오간 세션은 커밋할 게 없으므로 skip). Push는 별도로 명시 요청받았을 때만 한다. (배경: 2026-07-22 env 전환 과정에서 완료된 구현 사항이 문서에 반영되지 않고 누락된 사고가 있었음 — 재발 방지 목적, 2026-07-24 도입.)
- **Session-Start Git Sync Check**: 새 세션(또는 오랜만의 재개) 시작 시, 코드를 수정하기 전에 먼저 `git fetch` + `git log --oneline main..origin/main`(또는 `git status`)로 로컬이 origin과 동기화된 상태인지 확인한다. Divergence가 있으면 무엇이 다른지 먼저 파악하고 사용자에게 알린 뒤 진행한다 — 다른 머신(예: "집") 세션에서 이미 커밋/푸시된 작업을 모르고 지나치면, 그 작업을 실수로 덮어쓰거나(예: `clasp push --force`가 origin에 없는 로컬 파일 기준으로 원격을 덮어씀) 이미 존재하는 기능을 모르고 처음부터 재구현하는 사고로 이어질 수 있다. (배경: 2026-07-24, 로컬 checkout이 origin과 7개 커밋 divergence 상태인 걸 모른 채 작업하다가 `40_NewP1Report.js`/`CONFIG.NEWP1` 등을 서버에서 유실 + 로컬 재구성이라는 이중 사고로 번짐 — 세션 시작 시 이 체크를 했다면 훨씬 일찍 발견했을 것.)

## 문서 목록

- `docs/Architecture.md` — ETL 파이프라인 전체 구조, Stage 정의
- `docs/DesignPrinciples.md` — 프로젝트 전반 설계 원칙
- `docs/NamingConvention.md` — 함수/설정 네이밍 규칙
- `docs/ConfigurationCentralizationRules.md` — Config 중앙화 규칙
- `docs/FiscalCalendarRule.md` — Fiscal Year/Quarter 계산 규칙
- `docs/HiddenHelperDateColumn.md` — Master의 날짜 helper column 개념
- `docs/DateParsing.md` — 날짜 파싱 버그 히스토리 및 해결 상태
- `docs/ImportPipeline.md` — Import(Stage 00) 실제 파일 구조
- `docs/BusinessSegmentClassification.md` — Business Segment 분류 로직 (Leads_Master / MTA_Master)
- `docs/ACQReportDesign.md` — ACQ Report(Cohort 기반) 설계
- `docs/EngineeringConstitutionalRULES.md` — 엔지니어링 규칙 (Article 1~16)
- `docs/OperationsLayer.md` — Leads_OPS 운영 레이어
- `docs/Changelog.md` — 이번 리팩토링(Raw Append, Incremental Master Build 등) 변경 이력 및 미해결 항목
- `docs/salesforce-objects-reference.md` — Salesforce Object 목록
- `docs/ACQReportImplementation.md` — ACQ Report 구현 참고 (파일/함수 목록, 트러블슈팅 이력)
- `docs/apps-script-gotchas.md` — Apps Script/clasp 운영상 주의사항 (실전 트러블슈팅 모음)
- `docs/EventsReportDesign.md` — Events_OPS/Events_Engine(Webinar/Seminar 프로그램별 ROI 리포트) 설계
- `docs/PerformanceBenchmark.md` — 전체 Rebuild(Leads/MTA Master, Leads_OPS 등) 실행 시간 기록, 리팩토링 전후 성능 비교용

## 현재 알려진 미해결 항목 (임의로 처리하지 말 것)

1. ~~`Leads_OPS_QA` 생성 로직 — 의도적으로 미구현~~ — 구현 완료 (`24_OPSQA.js`, `writeOPSQAResults_()`). Dashboard(Master vs Leads_OPS 지표 대조) + Issues 테이블을 `Leads_OPS_QA` 시트에 기록. `buildLeadsOPS()` 실행 시 자동 호출(`21_OPS_Build.js`), 메뉴에서 "Run Leads_OPS QA"로 수동 실행도 가능. 문서 반영 누락 상태였다가 2026-07-24 뒤늦게 기록.
2. ~~IC Request(SAL)의 `#touches`(터치 횟수) 지표~~ — 4번 항목(재신청 카운터)과 동일 항목으로 확인, 구현 완료. 2026-07-24 정정 (별개 항목으로 잘못 분리 기재돼 있었음).
3. ~~MTA_Master에 "완전 동일한(all-fields identical) duplicate row" 검출 로직 없음~~ — 2026-07-24 판단 기준 확정 및 구현 완료. "완전 동일" = Lead ID + MTA Created Date + MKT UTM Campaign + First Lead Source + First Touch Detail(터치 식별 필드) 5개가 전부 일치하는 경우 (IC Booked/Completed/Won Date, Revenue, Lead Priority 등 export 시점마다 값이 바뀔 수 있는 Lead 레벨 스냅샷 필드는 비교에서 제외). `findExactDuplicateTouchRows_()`/`checkExactDuplicateTouchRows_()`(`24_OPSQA.js`)로 검출해 `Leads_OPS_QA` 시트에 이슈로 플래그, `buildLeadsOPS()` 실행 시 자동 실행. **자동 삭제는 하지 않음** — 검출/보고만 수행하며, 실제 제거 여부는 이슈 확인 후 별도 결정.
4. ~~`IC Requested` 재신청 이력 미보존~~ — 2026-07-22 설계 확정 및 구현 완료 (`applyICRequestTracking_()`, `22_OPS_Merge.js`). `Total IC Requests`/`Last IC Requested Date` 컬럼 추가, 매 OPS sync마다 `IC Requested`가 true였으면 카운터 +1 후 리셋. 자세한 내용: `docs/OperationsLayer.md` "IC Request Tracking" 섹션.
5. **`Opp(ortunity) Won Date` 대체 필요 (미해결, TODO)** — `Opportunity Won Date`는 실제로는 "Opportunity로 전환된 날짜"일 뿐 진짜 Close Date가 아님(진짜 Close Date 필드는 export에 없음, 2026-07-20 Deal Tracker 논의 중 확인 — `docs/Changelog.md` 참고). Close Date 대용으로 쓰기에 부적절하므로, Close Date가 필요한 리포트/QA 로직에서 이 필드를 다른 필드로 대체해야 함. 2026-07-25 OPS 전체 구축 완료 후 QA 착수 시점에 메모됨 — 대체 대상 필드/구체적 위치는 아직 미정, 임의로 처리하지 말 것. **2026-07-25 후속 발견**: `Lead: Sales Funnel Stage = "Won Deal"`인 리드는 전부 Revenue가 존재 — Won 여부 판별의 대체 후보로 유력하나 구현은 보류 중(`docs/ACQReportDesign.md` "Opportunity Won Date 대체 후보 발견" 섹션 참고).
6. ~~SAL 과집계 원인 발견~~ — 2026-07-25 해결 완료. `Lead Record Type`(Lead 레벨 스냅샷이라 오래전 SAL이 된 리드의 무관한 후속 터치까지 집계되던 문제) 대신, Salesforce MTA export에 새로 추가 가능한 `Lead: Sales Accepted Date`(진짜 이벤트 날짜) 필드로 전환. `13_MTATransformer.js`/`09_MTAFunnelSync.js`/`20_OPS_Config.js`/`30_ACQReport.js` 전부 반영, SAL 계산이 MTA_Master 터치 단위에서 Leads_OPS 리드 단위(이벤트 날짜 기준)로 이동. 자세한 내용: `docs/ACQReportDesign.md` "SAL 과집계 원인 해결" 섹션.
7. **Deal Tracker(`[KOR] Deal Tracking`) 통합 (설계 대기, TODO)** — 2026-07-25 발견: 사용자가 FY23부터 별도 관리해온 KOR 딜 전용 시트. `Closed Date`가 진짜 Close Date(5번 항목 대체 후보), `Source email`이 매칭키, upsell 데이터로 순매출 계산 가능. KOR 딜만 커버해서 Opportunity Won Date 기반 전체 계산을 대체할 수는 없고 "매칭되면 우선 사용하는 보정 레이어"로 계획 중. 아직 설계/구현 시작 전 — 자세한 내용은 `docs/Changelog.md` 2026-07-25 "Deal Tracker 통합 계획 메모" 섹션 참고, 임의로 처리하지 말 것.
8. **완전 동일 중복 터치(Exact Duplicate Touch Row) 자동 삭제 (설계 대기, TODO)** — 3번 항목에서 검출 로직(`findExactDuplicateTouchRows_()`, `24_OPSQA.js`)은 구현 완료했지만 자동 삭제는 의도적으로 보류해뒀었음. 2026-07-25 사용자 요청: 자동 삭제까지 구현하면 MTA 재export 시 날짜 겹침을 크게 신경 안 써도 되고(겹쳐 올려도 중복만 자동 정리됨), 지금처럼 "MTA_Raw/MTA_Master 전체 삭제 후 재구축"하는 무거운 프로세스를 매번 반복할 필요가 줄어듦. **주의**: 자동 삭제는 파괴적 작업이라 삭제 기준(5개 필드 완전 일치)이 실제로 안전한지, 삭제 시 MTA_Master 재정렬/카운터(PropertiesService MTA_LAST_ROW)에 미치는 영향까지 설계 검토 필요 — 아직 구현 시작 전, 임의로 처리하지 말 것.
9. **Backend 실행 체인 비동기화 (설계 필요, TODO)** — **현상**: `appendNewMTA()` 등 Import 후속 실행이 `syncMTAFunnelToOPS_()` → `refreshACQSummary_()`/`refreshNewP1Engine_()`/`refreshEventsEngine_()`까지 전부 같은 실행(execution) 안에서 순차 처리됨. Leads_OPS(3만5천+행)/MTA_Master(8만1천+행) 전체 스캔 체인이 한 실행에 몰려 있어 시간이 오래 걸림(2026-07-25 실측: MTA 전체 재구축 관련 체인이 수 분 이상 소요, 브라우저 다이얼로그를 닫아도 서버 실행은 계속됨 — `docs/apps-script-gotchas.md` #5). 사용자는 Import만 하고 나머지는 백그라운드에서 처리되길 원함. **제안 방향**: GAS Time-driven Trigger 체이닝 — Import는 즉시 반환, PropertiesService에 "다음 단계" 상태만 기록 → 짧은 지연의 1회성 trigger 설치 → 각 단계(Append/OPS Build/Engine 갱신들) 완료 시 자기 자신을 삭제하고 다음 trigger를 새로 검. 트리거는 브라우저/시트가 닫혀 있어도 Google 서버에서 독립적으로 계속 실행됨(확인됨). **막힌 지점(설계 세션에서 확정 필요)**: (1) 실패 시 어느 단계에서 멈췄는지 확인할 방법(Article 12 Logging 강화 필요), (2) 6분 실행 제한에 실제로 걸린 적이 있는지 아니면 아직 "느리다" 체감 수준인지, (3) `clasp run-function`은 이미 별도 보류 결정 남(OAuth Client/API Executable 배포 부담) — 이 트리거 구조는 그것과 무관하게 GAS 자체 기능으로 가능. **상태**: 코드 변경 없음, 순수 설계 논의만 진행(claude.ai 세션) — 별도 설계 세션 필요, 임의로 처리하지 말 것.
10. **SAL에 "Lead Status = Nurturing" 제외 조건 추가 필요 (데이터 대기, TODO)** — 6번에서 SAL을 `Sales Accepted Date` 이벤트 기준으로 전환했지만, `Lead Status`(Salesforce 표준 필드, `Sales Funnel Stage`와는 다른 별개 필드 — 픽리스트 순서: Nurturing → New (Not Contacted) → Attempting Contact → Contacted → Disqualified → IC Booked → Qualified)가 "Nurturing"인 리드도 Sales Accepted Date가 찍혀 SAL로 카운트되는 문제를 2026-07-25 사용자가 발견(Search 세그먼트 SAL 8건이 전부 IC Booked인 게 이상해서 개별 확인하다 발견). **확정된 처리 방식**: SAL 제외 조건은 `Lead Status === "Nurturing"` 하나뿐 — New/Attempting Contact/Contacted/Disqualified/IC Booked/Qualified는 전부 SAL로 그대로 카운트(사용자 확인, "New부터는 전부 SAL"). **막힌 지점**: `Lead: Lead Status` 필드가 아직 MTA export에 없어 파이프라인에 전혀 없는 상태 — Salesforce 리포트에 이 필드 추가 + 재export 되기 전까지 구현 불가. 필드 도착 시 `13_MTATransformer.js`에 매핑(리드 레벨 스냅샷이라 `computeMTAFunnelByLeadId_()`처럼 대표값 로직 필요할 수 있음) → `30_ACQReport.js`의 SAL 카운트 조건에 `leadStatus !== "Nurturing"` 추가. 임의로 처리하지 말 것.