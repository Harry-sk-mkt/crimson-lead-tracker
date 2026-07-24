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

## 현재 알려진 미해결 항목 (임의로 처리하지 말 것)

1. ~~`Leads_OPS_QA` 생성 로직 — 의도적으로 미구현~~ — 구현 완료 (`24_OPSQA.js`, `writeOPSQAResults_()`). Dashboard(Master vs Leads_OPS 지표 대조) + Issues 테이블을 `Leads_OPS_QA` 시트에 기록. `buildLeadsOPS()` 실행 시 자동 호출(`21_OPS_Build.js`), 메뉴에서 "Run Leads_OPS QA"로 수동 실행도 가능. 문서 반영 누락 상태였다가 2026-07-24 뒤늦게 기록.
2. ~~IC Request(SAL)의 `#touches`(터치 횟수) 지표~~ — 4번 항목(재신청 카운터)과 동일 항목으로 확인, 구현 완료. 2026-07-24 정정 (별개 항목으로 잘못 분리 기재돼 있었음).
3. ~~MTA_Master에 "완전 동일한(all-fields identical) duplicate row" 검출 로직 없음~~ — 2026-07-24 판단 기준 확정 및 구현 완료. "완전 동일" = Lead ID + MTA Created Date + MKT UTM Campaign + First Lead Source + First Touch Detail(터치 식별 필드) 5개가 전부 일치하는 경우 (IC Booked/Completed/Won Date, Revenue, Lead Priority 등 export 시점마다 값이 바뀔 수 있는 Lead 레벨 스냅샷 필드는 비교에서 제외). `findExactDuplicateTouchRows_()`/`checkExactDuplicateTouchRows_()`(`24_OPSQA.js`)로 검출해 `Leads_OPS_QA` 시트에 이슈로 플래그, `buildLeadsOPS()` 실행 시 자동 실행. **자동 삭제는 하지 않음** — 검출/보고만 수행하며, 실제 제거 여부는 이슈 확인 후 별도 결정.
4. ~~`IC Requested` 재신청 이력 미보존~~ — 2026-07-22 설계 확정 및 구현 완료 (`applyICRequestTracking_()`, `22_OPS_Merge.js`). `Total IC Requests`/`Last IC Requested Date` 컬럼 추가, 매 OPS sync마다 `IC Requested`가 true였으면 카운터 +1 후 리셋. 자세한 내용: `docs/OperationsLayer.md` "IC Request Tracking" 섹션.