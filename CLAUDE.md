# Marketing 2.0 (crimson-lead-tracker)

Google Apps Script 기반 마케팅 리드 ETL 파이프라인 프로젝트입니다.
아래 문서들은 이 프로젝트의 아키텍처 원칙, 비즈니스 로직, 엔지니어링 규칙을 담고 있습니다.
코드를 수정/생성하기 전에 관련 문서를 먼저 참고하세요.

## 핵심 원칙 (요약)

- **Staged ETL**: `CSV → Import(Raw) → Master Build → Master → Leads_OPS → Reports`
- **Reporting Layer는 Import 시 자동 Generate (신규 리포트도 예외 없음)**: ACQ_REP/NewP1_REP/Target_REP/S&M_REP/FY_REP처럼 "FY 선택 + Generate 체크박스"로 화면을 재작성하는 모든 리포트는, Generate 체크박스 수동 클릭에만 의존하고 끝내지 않는다 — `MASTER_002_PipelineAsync.js`의 `refreshReportGenerate_(type, state)`(Leads/MTA/IC Funnel Import 백그라운드 파이프라인 마지막 단계, 세 트리거가 공유)에 그 리포트의 `generateXxx_()` 호출을 반드시 편입시켜 Import만으로 자동 갱신되게 한다. 새 리포트를 추가할 때 정의완료(Definition of Done) 체크리스트에 포함: (1) `refreshReportGenerate_()`에 호출 추가, (2) 기존 항목과 동일 패턴으로 독립 try/catch(실패해도 나머지 파이프라인은 DONE 유지, Logger에만 기록), (3) `CONFIG.PIPELINE.STATUS_COLUMNS`(CORE_001_Config.js)에 그 리포트 컬럼 추가해 README Pipeline Status 표에 노출, (4) `testBuildPipelineStatusGrid()` 기대값 갱신(컬럼 수/인덱스가 밀림). 설치형 트리거라 Full Authorization으로 실행되므로 외부 스프레드시트 `openById()`(Deal Tracker, perfTrackerByFY 등)를 쓰는 리포트도 문제없이 편입 가능(Target_REP/FY_REP 선례). (2026-09-01 사용자 확정 — S&M_REP/FY_REP을 이 원칙으로 편입하며 도입)
- **Single Responsibility**: 파일 하나 = 책임 하나. Business logic은 Master Build 단계에만 존재.
- **No Assumptions**: Sheet 이름, Column Index, Header, Business Logic, 기존 함수/아키텍처는 절대 추측하지 않는다. 모르면 질문한다.
- **Configuration Centralized**: 모든 설정값은 `CORE_001_Config.js`의 `CONFIG` 객체에만 존재. 하드코딩 금지.
- **Raw is Immutable / Master is Rebuildable**: Raw는 원본 보존, 수동 수정 금지. Master는 Raw로부터 언제든 재생성 가능.
- **Backward Compatibility**: 파일명, 함수명, 함수 시그니처, 기존 시트/수식/출력 변경 금지 (승인 없이는).
- **TDD (Test-Driven Development)**: 새 함수를 만들거나 기존 함수를 수정할 때, 반드시 다음을 함께 작성한다.
  - 이 함수가 **왜 필요한지**(WHY) 함수 상단 주석에 명시
  - 구현 완료 후 **기대값과 실제값을 비교 확인할 수 있는 테스트 함수**(`testXXXX()` 형태, `docs/NamingConvention.md` 참고)를 같은 파일 또는 관련 파일에 함께 추가
  - 테스트가 통과하기 전까지 해당 함수를 "완료"로 간주하지 않는다 (`docs/EngineeringConstitutionalRULES.md` Article 3, Article 6 참고)
- **Test/Run 함수명은 절대 `_`로 끝내지 않는다**: 루트 `crimson/CLAUDE.md` "Apps Script(clasp) 도메인 공통" 참고 (`docs/apps-script-gotchas.md` #2).
- **File Versioning**: 파일 내용을 수정할 때마다(새 함수 추가/기존 함수 수정 등) 파일 상단 헤더의 `Version`/`Change Log`를 함께 갱신한다. 자세한 형식: `docs/NamingConvention.md` "File Versioning" 섹션.
- **Manual Execution Instructions**: 함수 실행 요청 시 파일명 + 함수명 명시 — 루트 `crimson/CLAUDE.md` "Apps Script(clasp) 도메인 공통" 참고.
- **Session-End Auto Log, Commit & Push**: 루트 `crimson/CLAUDE.md` "Session-End Log, Commit & Push" 참고. 이 저장소의 기록 위치는 `docs/Changelog.md`(날짜별 항목). (배경: 2026-07-22 env 전환 중 구현 사항 문서 누락 사고로 2026-07-24 도입, 2026-07-29 push 누락으로 사무실 재방문 사고 후 push 추가.)
- **Session-End One-Sentence Task Summary**: Changelog와 별도로 채팅에도 그 세션에서 한 일을 요약한다(2026-07-28 사용자 요청). 형식/범위는 루트 `crimson/CLAUDE.md` "Session-End Summary Format" 참고.
- **Session-Start Git Sync Check (+ 자동 Pull)**: 루트 `crimson/CLAUDE.md` "Session-Start Git Sync Check" 참고. 이 저장소는 `scripts/start-session.sh`로 실행한다(git fetch/divergence, `git worktree list`, pre-commit hook 설치 여부, behind-only·clean이면 자동 `git pull`). 트리거는 코드 수정 임박이 아니라 세션 시작 그 자체(2026-09-02 사고 — 상태 확인 질문이라 미뤘다가 3커밋 뒤처진 정보로 답변).
- **Clasp Push Pre-Authorized / 세션 간 권한 유지**: 규칙 본문(묻지 않고 실행, `scripts/safe-clasp-push.sh` 필수, 함수 실행 요청 전 push 확인)은 루트 `crimson/CLAUDE.md` "Apps Script(clasp) 도메인 공통" 참고. 이 저장소 추가 사항: 승인은 세션 간 유지되며 권한 프롬프트가 뜨는 작업은 `.claude/settings.json` 허용 목록에 등록한다(2026-07-28 사용자 확정). 세션 종료 외의 `git push`는 명시 요청 시에만.
- **Pre-commit Hook**: `.githooks/pre-commit`(설치: `git config core.hooksPath .githooks`, `scripts/start-session.sh`가 설치 여부 확인)이 매 커밋마다 naming(`_` 접미사 실수)/version-header/중복 선언/문법(`node --check`)을 자동 검사한다 — 각 스크립트는 `scripts/check-*.sh` (2026-07-29 도입, 상세는 각 스크립트 주석 참고).

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
- `docs/TargetReportDesign.md` — Target_REP(주간 세그먼트 그룹별 New P1/CPNP1 목표·달성률) 설계, top-down 목표 역산 로직
- `docs/FYReportDesign.md` — FY_REP(FY별 Sales Funnel 대시보드, 트렌드+세그먼트별 달성률) 설계, 2026-07-30 설계 착수 → 구현 완료(FYREP_001_Engine.js/FYREP_002_Report.js), 2026-09-01부터 Import 시 자동 Generate
- `docs/OpenItems.md` — 현재 알려진 미해결 항목 전체 목록 (2026-07-29 CLAUDE.md 다이어트로 이관). 완전히 해결된 항목은 `docs/OpenItems_Legacy.md`로 분리됨(2026-09-15) — 번호 breadcrumb만 남음.
- `docs/QAAgentDesign.md` — QA 에이전트(`qa-review` 스킬: 코드 품질/데이터 정합성/리포트 값 검증) 설계, 2026-08-09 구현
- `docs/Roadmap.md` — 장기 방향/우선순위 (계속 갱신되는 문서, OpenItems와 별개)
- `docs/ExecPlanConvention.md` — `docs/exec-plans/`(작업 단위 실시간 진행 기록) 작성 규칙
- `docs/SalesforceFieldRequirements.md` — Export 타입(New Leads/MTA/IC Funnel/SAL)별로 Salesforce에서 뽑아야 하는 필드 목록·필수 여부·day-first 날짜 보호 필요 여부 정리, 2026-09-04 작성

## 현재 알려진 미해결 항목

`docs/OpenItems.md` 참고 — 임의로 처리하지 말 것.
