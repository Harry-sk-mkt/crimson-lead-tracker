# Import Pipeline — Actual Structure (2026-07-21 업데이트)

## 구성 파일

| 파일 | Responsibility |
| --- | --- |
| `00_Import.js` | 진입점/오케스트레이션. Raw까지만 담당 (Master Build/Transform 호출 안 함, v3.1.0부터) |
| `00_Menu.js` | Custom Menu (📥 Update / 🏗️ Append) |
| `00_UploadDialog.html` | CSV 업로드 다이얼로그 UI |
| `01_CsvReader.js` | CSV 파일 읽기 (텍스트 그대로, `Utilities.parseCsv`) |
| `02_Parser.js` | 2D Array → Object Array 변환 |
| `03_Validator.js` | 필수 필드 검증 (`CONFIG.REQUIRED_FIELDS`), 검증 요약(Summary) 생성 |
| `04_RawWriter.js` | Raw 시트에 **Append** (Leads_Raw / MTA_Raw 전용) |
| `05_SheetWriter.js` | 범용 Sheet Writer — `writeSheetRecords()`(Full Overwrite, Rebuild 전용) + `appendSheetRecords()`(Append) |
| `06_SheetSorter.js` | Date 컬럼 기준 정렬 (Master 전용, Incremental Append 후 사용) |
| `07_IncrementalMasterBuild.js` | `appendNewLeads()` / `appendNewMTA()` — Raw 신규분만 Transform → Master Append |
| `10_MasterBuild.js` | `rebuildLeadsMaster()` / `rebuildMTAMaster()` — Full Rebuild (복구용, 메뉴 미노출) |
| `11_DataReader.js` | Raw 시트 → Object Array 읽기 |
| `12_LeadTransformer.js` | Leads_Raw → Leads_Master 변환 로직 |
| `13_MTATransformer.js` | MTA_Raw → MTA_Master 변환 로직 |
| `14_MasterWriter.js` | Master 시트 쓰기 (writeLeadMaster / writeMTAMaster) |
| `16_TransformHelper.js` | 순수 헬퍼 함수 전용: `parseDMY`, `parseMDY`, `parseISO`, `parseDate`, `getFiscalYear`, `getQuarter`, `getWeek`, `getMonthKey`, `getMonthText`, `getBusinessSegment` |
| `20_OPS_Config.js` | Leads_OPS 전용 설정 (`OPS` 객체) |
| `20_OPS_Styles.js` | Leads_OPS 서식 적용 |
| `21_OPS_Build.js` | Leads_OPS Build 오케스트레이션 |
| `22_OPS_Merge.js` | Master + 기존 OPS 병합 로직 (Email 기준) |
| `23_OPS_Write.js` | Leads_OPS 시트 쓰기 |
| `99_ResetRawMaster.js` | `resetIncrementalCounters()` — Raw/Master 수동 초기화 후 카운터 리셋용 |

## 2026-09-02 변경 이력

- **SAL 전용 외부 스프레드시트 분리**(`docs/OpenItems.md` #38 P1 TODO #1 —
  Salesforce IC Funnel 리포트가 "New (Not Contacted) Date Time"(SAL 판정
  필드)을 export하지 못하는 버그가 리포트 재구성으로도 안 풀려, 사용자 결정으로
  아예 별도 리포트+전용 외부 스프레드시트로 분리): `CONFIG.SAL`(`CORE_001_Config.js`)
  신규, `MASTER_010_SALSync.js` 신규 — ICFunnel_Raw와 동일 아키텍처(Master 빌드
  없음, Raw→직접 Leads_OPS sync)이되 Raw 시트 자체가 이 프로젝트 메인
  스프레드시트가 아니라 `CONFIG.SAL.EXTERNAL.SPREADSHEET_ID`로 지정한 **외부**
  스프레드시트에 있음(`openSALExternalSpreadsheet_()`). 이 때문에
  `IMPORT_006_SheetWriter.js`의 `appendSheetRecords()`/`IMPORT_008_RawDeduplicator.js`의
  `filterOutExactDuplicateRawRecords_()`에 optional `targetSpreadsheet` 파라미터가
  추가됨(생략 시 기존과 동일하게 메인 스프레드시트 대상, 기존 호출부 전부 하위
  호환) — `IMPORT_005_RawWriter.js`의 신규 `writeSALRaw()`가 이 파라미터로 외부
  스프레드시트에 직접 append. `importSALReport()`(`IMPORT_001_Import.js`) 메뉴
  진입점("📥 Update → Import SAL Report") 신규, `importCsv()`의 `case "SAL"`이
  `writeSALRaw()` 직후 `scheduleSALPipelineTail_()`(백그라운드 트리거,
  `runSALPipelineTail()` — `MASTER_002_PipelineAsync.js` v1.24.0)를 호출. IC
  Funnel과 달리 README Pipeline Status 표에 독립 행("SAL")으로 반영됨.
  `MASTER_009_ICFunnelSync.js`(v1.6.0)는 Sales Accepted Date 관리에서 완전히
  손을 뗌. **⚠️ 사용 전 필수**: `CONFIG.SAL.EXTERNAL.SPREADSHEET_ID`를 실제
  외부 스프레드시트 ID로 채워야 하고, 그 스프레드시트 안에 "SAL_Raw"라는
  이름의 탭이 있어야 함 — 비어있으면 명시적 에러로 실패(추측 방지).

## 2026-08-26 변경 이력

- **ICFunnel_Raw 재도입**(`docs/OpenItems.md` #32 — ACQ_REP IC Booked/Complete
  구조적 과소집계 해결): `CONFIG.IC_FUNNEL`(`CORE_001_Config.js`) 신규,
  `importICFunnelReport()`(`IMPORT_001_Import.js`) 메뉴 진입점 복원("📥 Update →
  Import IC Funnel"). `importCsv()`의 `case "IC_FUNNEL"`이 `writeICFunnelRaw()`
  직후 신규 `syncICFunnelToOPS_()`(`MASTER_009_ICFunnelSync.js`)를 호출 —
  Leads/MTA와 달리 Master 빌드 단계는 없음(Lead 단위 소규모 리포트, Raw→직접
  Leads_OPS sync). **단, sync 끝의 Engine refresh 체인 자체는 Leads/MTA와 동일하게
  무거워** — 처음엔 동기 호출했으나 업로드 다이얼로그가 오래 안 닫히는 문제가
  실사용 중 발견돼(2026-08-26 후속), `appendNewLeads()`/`appendNewMTA()`와 동일한
  설치형 1회성 백그라운드 트리거로 전환(`scheduleICFunnelPipelineTail_()` +
  `runICFunnelPipelineTail()`, `MASTER_002_PipelineAsync.js`) — `PIPELINE_LOCK`
  공유, README Pipeline Status 표는 의도적으로 미반영. `MASTER_003_MTAFunnelSync.js`
  (v1.7.0)는 IC Booked/Completed/Opportunity Won Date에서 손을 떼고 Revenue/Sales Accepted
  Date만 계속 관리 — 상세는 `docs/OperationsLayer.md` "IC Funnel Sync" 섹션 참고.

## 2026-08-25 변경 이력

- **완전 동일 중복 Raw 단계 필터링 신규 도입** (`IMPORT_008_RawDeduplicator.js`
  신규, 현재 파일명 기준): `writeLeadRaw()`/`writeMTARaw()`/`writeICFunnelRaw()`
  (`IMPORT_005_RawWriter.js` v4.1.0)가 `appendSheetRecords()` 호출 전에
  `filterOutExactDuplicateRawRecords_()`로 대상 Raw 시트를 읽어, 이미 있는
  행과 모든 필드 값이 완전히 같은 신규 레코드는 Raw에 아예 쓰지 않고 skip
  (사용자 요청 — Master Build 단계 완전동일 중복 정리(`OPS_006_QA.js`)가
  데이터가 쌓일수록 무거워짐, 겹치는 export 날짜 범위 재업로드로 생기는
  byte-identical 행을 Raw에서부터 차단). **범위 밖(의도적)**: "같은 Lead
  ID/터치인데 일부 snapshot 필드만 다른" 경우를 하나로 합치는 판단
  (progression tie-break 등 business logic)은 여전히 Master Build 단계
  책임 — Raw 단계는 순수 구조적 완전 일치만 검사(2026-08-25 사용자 확정).
  `importCsv()`(`IMPORT_001_Import.js` v3.8.0)가 skip 건수를 업로드
  완료 메시지에 표시.

## 2026-07-21 변경 이력

- **`16_TransformHelper.js`**: 과거 리팩토링 이전 버전에 `transformLeadRecords`/`transformLeadRecord`가 헬퍼 함수들과 함께 중복 정의되어 있던 문제를 발견 → 해당 두 함수 삭제, 순수 헬퍼 함수만 유지 (전역 스코프 함수명 중복 해소, `12_LeadTransformer.js`가 유일한 정의처).
- **Import(`00_Import.js`)**: 기존엔 `transformRecords()`/`loadRecords()`를 호출해 CSV를 곧장 Master에 적재했음 (Architecture 문서 위반) → Raw까지만 쓰도록 수정.
- **Raw 쓰기 방식**: Full Overwrite(매번 `clearContents()`) → **Append** 방식으로 전환 (`04_RawWriter.js`가 `appendSheetRecords()` 사용).
- **Master 빌드 방식**: Full Rebuild만 있던 것 → **Incremental Append**(기본, 성능 목적) + **Full Rebuild**(복구/Rule 변경 시 수동) 이원화.
- **메뉴**: "Import All" 제거 (레거시). "📥 Import" → "📥 Update", "🏗️ Build" → "🏗️ Append"로 개명. Rebuild 메뉴 항목은 제거 (스크립트 편집기에서 직접 실행).

## 참고
- 과거 존재했던 "Import Engine v2 (Import.gs / Parser.gs / Loader.gs, Validator 없음)" 제안은 채택되지 않음 — 레거시.
- Engineering Constitution Article 8의 "Loader" 표기는 실제로는 `RawWriter`(specific) + `SheetWriter`(generic)로 분리되어 있음 — 문서 업데이트 필요 (engineering-constitution.md 참고).