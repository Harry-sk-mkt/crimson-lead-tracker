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
- **Test/Run 함수명은 절대 `_`로 끝내지 않는다**: Apps Script는 이름 끝에 `_`가 붙은 함수를 private로 간주해 편집기 Run 드롭다운에서 숨긴다(`docs/apps-script-gotchas.md` #2). `testXXXX()`처럼 사용자가 Apps Script 편집기에서 직접 Run 해야 하는 함수(테스트 함수, `runXXXX()` 진입점)는 이름 끝에 `_`를 붙이면 안 된다 — 내부 헬퍼 함수(`xxxx_()`)와 헷갈려서 반복적으로 실수가 나온 항목이므로 새 테스트/진입점 함수를 작성할 때마다 이름 끝을 확인한다.
- **File Versioning**: 파일 내용을 수정할 때마다(새 함수 추가/기존 함수 수정 등) 파일 상단 헤더의 `Version`/`Change Log`를 함께 갱신한다. 자세한 형식: `docs/NamingConvention.md` "File Versioning" 섹션.
- **Manual Execution Instructions**: `clasp run-function` 미도입 상태라 Apps Script 함수는 사용자가 Apps Script 편집기에서 직접 Run 해야 한다. 사용자에게 함수 실행을 요청할 때는 **반드시 파일명 + 함수명을 함께 명시**한다 (예: "`09_MTAFunnelSync.js`의 `runSyncMTAFunnelToOPS()` 실행해주세요" — 함수명만 말하지 않는다).
- **Session-End Auto Log, Commit & Push**: 사용자가 "오늘은 여기까지" 류의 종료멘트를 하면, 별도 요청 없이 그 세션에서 실제로 변경된 내용을 `docs/Changelog.md`에 날짜별 항목으로 기록하고 커밋한 뒤 **`git push`까지 진행한다** (단, 실제 파일 변경이 있었을 때만 — 순수 Q&A만 오간 세션은 커밋/푸시할 게 없으므로 skip). (배경: 2026-07-22 env 전환 과정에서 완료된 구현 사항이 문서에 반영되지 않고 누락된 사고가 있었음 — 재발 방지 목적, 2026-07-24 도입. **2026-07-29 push 추가**: 세션 종료 후 커밋만 로컬에 남고 push가 안 된 상태로 방치되어, 사용자가 다른 장소(사무실)에서 이 작업 내용을 못 받아 토요일에 사무실을 다시 방문해야 했던 사고 발생 — 재발 방지로 세션 종료 시 push까지 자동 포함하도록 변경.)
- **Session-End One-Sentence Task Summary**: 위 Changelog 기록/커밋과 함께, 채팅 응답에도 그 세션에서 한 일을 태스크 단위로 한 문장씩 정리해서 보여준다 — Changelog는 상세 기록용, 채팅 요약은 사용자가 그 자리에서 빠르게 훑어볼 용도로 별도 필요(2026-07-28 사용자 요청).
- **Session-Start Git Sync Check**: 새 세션(또는 오랜만의 재개) 시작 시, 코드를 수정하기 전에 먼저 `scripts/start-session.sh`를 실행한다 (git fetch/divergence, `git worktree list`, pre-commit hook 설치 여부를 한 번에 확인 — 배경: 2026-07-24 divergence 미인지 사고, 2026-07-29 worktree 덮어쓰기 사고. 상세 이력은 스크립트 주석 참고).
- **Clasp Push Pre-Authorized / 세션 간 권한 유지**: `clasp push`는 이 프로젝트의 일상적 배포 단계이므로 코드 수정 완료 후 매번 진행 여부를 묻지 않고 바로 실행한다 — git push(원격 저장소, 협업자와 공유됨 — 여전히 명시 요청 시에만)와는 별개로 취급한다. 이 승인은 세션 간에도 유지되는 것으로 간주 — harness 권한 프롬프트가 뜨는 작업은 `.claude/settings.json` 허용 목록에 등록해 재확인 자체를 없앤다 (2026-07-28 사용자 확정). **단, `clasp push`를 직접 실행하지 말고 반드시 `scripts/safe-clasp-push.sh`를 통해 실행한다** — worktree가 2개 이상이면 목록을 보여주고 y/n 확인을 받은 뒤에만 push한다 (2026-07-29 worktree 덮어쓰기 사고 재발 방지, 상세는 스크립트 주석 참고).
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
- `docs/FYReportDesign.md` — FY_REP(FY별 Sales Funnel 대시보드, 트렌드+세그먼트별 달성률) 설계, 2026-07-30 설계 착수(미구현)
- `docs/OpenItems.md` — 현재 알려진 미해결 항목 전체 목록 (2026-07-29 CLAUDE.md 다이어트로 이관)
- `docs/Roadmap.md` — 장기 방향/우선순위 (계속 갱신되는 문서, OpenItems와 별개)
- `docs/ExecPlanConvention.md` — `docs/exec-plans/`(작업 단위 실시간 진행 기록) 작성 규칙

## 현재 알려진 미해결 항목

`docs/OpenItems.md` 참고 — 임의로 처리하지 말 것.
