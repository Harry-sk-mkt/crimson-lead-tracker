# Changelog — 2026-07-21

이날 하루 동안 진행된 리팩토링 요약. 시간순 기록.

## 1. 구버전 중복 파일 정리
- `16_TransformHelper.js`에 `transformLeadRecords`/`transformLeadRecord`가 `12_LeadTransformer.js`와
  중복 정의되어 있던 문제 발견 → 헬퍼 함수(`parseDMY` 등)만 남기고 중복 함수 삭제.

## 2. Import(Stage 00) — Architecture 정합성 수정
- 기존 `importCsv()`가 Raw를 거치지 않고 곧장 Master로 쓰던 구조(Architecture 문서 위반) 발견 → 수정.
- Import는 이제 Raw까지만 담당 (`transformRecords()`/`loadRecords()` 호출 제거).
- Master Build는 별도 메뉴(🏗️)로 분리.
- `REQUIRED_FIELDS`를 `CONFIG.REQUIRED_FIELDS`로 중앙화 (Leads: Lead ID/Email/Create Date/Company Account,
  MTA: Lead ID/Email/MTA Created Date).
- 무효 레코드(`_isValid === false`)는 Raw에 안 쓰고 로그만 남김 (Silent Failure 방지).
- 업로드 다이얼로그(`00_UploadDialog.html`) 연결 함수(`showUploadDialog_`, `importLeadReport`, `importMTAReport`) 추가.
- "Import All" 메뉴 제거 (레거시).

## 3. 날짜 파싱 버그 방지 구현
- `CONFIG.RAW_DATE_COLUMNS` 추가, Raw 쓰기 시 Plain Text 서식(`@`) 강제.
- `parseDMY()` 단위 테스트 + 실데이터 검증 완료 (자세한 내용: `import-date-parsing-bug.md`).

## 4. Raw/Master 방식 전환 — Overwrite → Append
- **배경**: Salesforce weekly export를 매번 전체 재계산하기엔 데이터 볼륨이 너무 큼 (성능 문제).
- **Raw**: Full Overwrite → Append로 전환 (`appendSheetRecords()` 신규 추가, `05_SheetWriter.js`).
  - 정렬은 하지 않음 (텍스트 날짜라 정렬 비용이 큼 — Master 단계에서만 정렬).
  - Leads는 원천에서 이미 신규 lead만 export되어 dedup 불필요. MTA는 중복이 의도된 것이라 dedup 안 함.
- **Master**: Incremental Append 방식 도입 (`07_IncrementalMasterBuild.js`).
  - `PropertiesService`에 `LEADS_LAST_PROCESSED_ROW`/`MTA_LAST_PROCESSED_ROW` 저장, 이후 Raw 행부터만 Transform.
  - Append 후 `06_SheetSorter.js`의 `sortSheetByDate()`로 Create Date 기준 내림차순 정렬 (최신이 맨 위).
- **Full Rebuild**: 기존 `buildLeadsMaster`/`buildMTAMaster` → `rebuildLeadsMaster`/`rebuildMTAMaster`로 개명,
  복구/Business Rule 변경 시 스크립트 편집기에서 수동 실행 전용 (메뉴 노출 안 함). `buildAllMaster()` 제거.
- **초기 전환 절차**: 기존 Raw/Master 수동 삭제 → `resetIncrementalCounters()` 실행(카운터 0 리셋) →
  CSV 재Import → Append 실행. (`99_ResetRawMaster.js`)

## 5. 메뉴 개편
- "📥 Import" → **"📥 Update"**
- "🏗️ Build" → **"🏗️ Append"**
- "📊 Report" 메뉴는 항목이 하나도 없어 `onOpen()`에서 예외 발생 → 호출 비활성화 (함수 정의는 보존).
- Rebuild 메뉴 항목 제거 (스크립트 편집기 직접 실행으로 전환).

## 6. Import 완료 alert 개선
- 진행률(%)은 구현하지 않기로 함 (실시간 상태 전달은 폴링 구조가 필요해 복잡도 대비 실익 낮다고 판단).
- 대신 완료 후 요약 표시: 전체/성공/실패 건수 + 필수 필드별 valid/missing 카운트 + Date 컬럼 텍스트 보존 여부.
- `CONFIG.VALIDATION_SUMMARY_EXCLUDE`로 "Company / Account" 필드와 IC/Won Date 컬럼은 alert 표시에서만 제외
  (검증/서식 강제 로직 자체는 그대로 유지).
- 완료 문구: `"{valid} / {total} 레코드 업데이트 완료" + ... + "Master 🏗️Append를 실행해주세요."`

## 7. OPS 정리 (일부)
- `OPS.ROWS = { HEADER: 1, DATA_START: 2 }` 추가, `writeOPS()`가 이를 참조하도록 수정.
- `mergeOPS()` 중복 이메일 처리, `applyOPSStyle()` 하드코딩, `Leads_OPS_QA` 구현은 **모두 미해결로 보류**
  (자세한 내용: `operations-layer-leads-ops.md`).

## 8. 로컬 개발 환경 세팅
- Node.js v24.13.0 확인, `clasp` 3.3.0 설치.
- 기존 로컬 프로젝트 폴더(`crimson-lead-tracker`) 비우고 Marketing 2.0 스크립트로 재clone.
- git 초기화 + GitHub 원격 저장소(`Harry-sk-mkt/crimson-lead-tracker`) 연결, 최초 push 완료.
- `onOpen` 관련 syntax/runtime error 두 건 수정 (Report 메뉴 빈 항목 예외, Import.js 괄호 누락).

## 다음에 다룰 항목 (사용자 확인 후 진행)
- `mergeOPS()` 중복 이메일 처리 로직 재검토
- `applyOPSStyle()` 하드코딩 정리 여부
- `Leads_OPS_QA` 구현 시점 (프로토타입 검증 후)
- Engineering Constitution Article 8 다이어그램 텍스트 수정 (Loader → RawWriter/SheetWriter)
- UX/언어 최적화 (구체 범위 미정 — alert 문구, 다이얼로그 UI 등 중 확인 필요)

## 2026-07-21 (추가) — TDD 원칙 도입 시점 명시

- `CLAUDE.md`에 TDD 원칙 추가 (새/수정 함수는 WHY 주석 + `testXXXX()` 테스트 함수 동반).
- **적용 범위: 이 시점(2026-07-21) 이후 신규 작성/수정되는 함수부터.**
  이전에 작성된 기존 함수(`appendSheetRecords`, `buildValidationSummary_`, `sortSheetByDate` 등)에
  소급 적용하지 않음 — 필요 시 향후 해당 함수를 수정하는 시점에 테스트를 추가한다.

  ## 2026-07-21 (계속) — OPS 중복 이메일 로직 확정 및 정리

### mergeOPS() — 중복 이메일 처리 로직 확정
- **결정**: 이메일별로 그룹핑 후 실제 `Create Date`를 비교하여 **가장 오래된(진짜 First Touch) 레코드만 유지**,
  나머지는 duplicate로 분류. 기존엔 시트 순서(Master가 Create Date 내림차순 정렬되어 있어 사실상 "가장 최근"
  레코드가 남는 구조)에 의존했던 버그를 바로잡음.
- **Tie-break 규칙**: 같은 이메일에 완전히 동일한 Create Date가 여러 건 있는 경우, 배열 순서상 먼저 나온 것을
  유지 (별도 tie-break 로직 추가하지 않기로 결정 — 실무적으로 문제없다고 판단).
- **로그**: 제외된 duplicate 건은 `Logger.log`에 `Email / 제외된 Lead ID / Create Date / 남긴 Lead ID`로 기록
  (QA 시트 대체용, `Leads_OPS_QA` 구현 전까지 유지).
- **검증**: 단위 테스트(`testMergeOPS_EarliestWins`) PASS + 실제 데이터 35,529건 중 47건 duplicate 확인,
  샘플 검증 결과 모두 가장 이른 날짜가 정확히 유지됨.
- **보류 항목**: IC Request(SAL)의 `#touches`(터치 횟수) 지표는 별도 논의 필요 — 이번 dedup 로직과 무관하게
  추후 별도 구현 시 재논의.

### applyOPSStyle() 하드코딩 정리 완료
- 헤더/데이터 행 번호(`1`, `2`) → `OPS.ROWS.HEADER`/`OPS.ROWS.DATA_START` 참조로 교체 완료.

### 디버그 로그 제거
- `buildLeadsOPS()`에 남아있던 `Logger.log(result)`, `Logger.log(result.rows)` 등 35,000+건 전체를
  로그에 찍으려던 디버그 코드 제거. "Logging output too large" 및 불필요한 실행 시간 증가의 원인이었음.

### clasp run-function — 보류
- 터미널에서 Apps Script 함수를 직접 실행하는 방법(`clasp run-function`) 확인함. 별도 OAuth Client,
  API Executable 배포, Cloud Project ID 연결 등 설정 부담이 커서 **당분간 도입 보류**.
  Apps Script 편집기에서 함수 선택 후 직접 실행하는 기존 방식 유지.