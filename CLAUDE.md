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

## 현재 알려진 미해결 항목 (임의로 처리하지 말 것)

1. `Leads_OPS_QA` 생성 로직 — 의도적으로 미구현 (프로토타입 검증 우선, 추후 구현 예정).
2. IC Request(SAL)의 `#touches`(터치 횟수) 지표 — mergeOPS의 dedup 로직과는 별개로 추후 논의 필요.