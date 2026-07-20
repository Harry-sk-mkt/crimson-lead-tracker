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

## 2026-07-21 변경 이력

- **`16_TransformHelper.js`**: 과거 리팩토링 이전 버전에 `transformLeadRecords`/`transformLeadRecord`가 헬퍼 함수들과 함께 중복 정의되어 있던 문제를 발견 → 해당 두 함수 삭제, 순수 헬퍼 함수만 유지 (전역 스코프 함수명 중복 해소, `12_LeadTransformer.js`가 유일한 정의처).
- **Import(`00_Import.js`)**: 기존엔 `transformRecords()`/`loadRecords()`를 호출해 CSV를 곧장 Master에 적재했음 (Architecture 문서 위반) → Raw까지만 쓰도록 수정.
- **Raw 쓰기 방식**: Full Overwrite(매번 `clearContents()`) → **Append** 방식으로 전환 (`04_RawWriter.js`가 `appendSheetRecords()` 사용).
- **Master 빌드 방식**: Full Rebuild만 있던 것 → **Incremental Append**(기본, 성능 목적) + **Full Rebuild**(복구/Rule 변경 시 수동) 이원화.
- **메뉴**: "Import All" 제거 (레거시). "📥 Import" → "📥 Update", "🏗️ Build" → "🏗️ Append"로 개명. Rebuild 메뉴 항목은 제거 (스크립트 편집기에서 직접 실행).

## 참고
- 과거 존재했던 "Import Engine v2 (Import.gs / Parser.gs / Loader.gs, Validator 없음)" 제안은 채택되지 않음 — 레거시.
- Engineering Constitution Article 8의 "Loader" 표기는 실제로는 `RawWriter`(specific) + `SheetWriter`(generic)로 분리되어 있음 — 문서 업데이트 필요 (engineering-constitution.md 참고).