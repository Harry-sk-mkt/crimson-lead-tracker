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

## 문서 목록

- `docs/architecture.md` — ETL 파이프라인 전체 구조, Stage 정의
- `docs/design-principles.md` — 프로젝트 전반 설계 원칙
- `docs/naming-convention.md` — 함수/설정 네이밍 규칙
- `docs/config-centralization-rule.md` — Config 중앙화 규칙
- `docs/fiscal-calendar-rule.md` — Fiscal Year/Quarter 계산 규칙
- `docs/hidden-helper-date-column.md` — Master의 날짜 helper column 개념
- `docs/import-date-parsing-bug.md` — 날짜 파싱 버그 히스토리 및 해결 상태
- `docs/import-pipeline-actual-structure.md` — Import(Stage 00) 실제 파일 구조
- `docs/business-segment-classification.md` — Business Segment 분류 로직 (Leads_Master / MTA_Master)
- `docs/acq-report-design.md` — ACQ Report(Cohort 기반) 설계
- `docs/engineering-constitution.md` — 엔지니어링 규칙 (Article 1~16)
- `docs/operations-layer-leads-ops.md` — Leads_OPS 운영 레이어
- `docs/changelog-2026-07-21.md` — 이번 리팩토링(Raw Append, Incremental Master Build 등) 변경 이력 및 미해결 항목

## 현재 알려진 미해결 항목 (임의로 처리하지 말 것)

1. `22_OPS_Merge.js`의 `mergeOPS()` — 중복 이메일 발생 시, 첫 번째 발생분만 정상 merge되고 이후만 duplicate 처리됨. 문서 원칙(그룹 전체 QA 이동)과 다를 수 있음 — 사용자 결정 대기 중.
2. `20_OPS_Styles.js`의 `applyOPSStyle()` — 헤더/데이터 행 번호(`1`, `2`)가 하드코딩됨. `OPS.ROWS`로 교체할지 미결.
3. `Leads_OPS_QA` 생성 로직 — 의도적으로 미구현 (프로토타입 검증 우선, 추후 구현 예정).

새 기능을 만들거나 리팩토링할 때, 위 미해결 항목을 임의로 "정리"하지 말고 반드시 사용자에게 먼저 확인할 것.