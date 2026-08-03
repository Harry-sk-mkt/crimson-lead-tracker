# Performance Benchmark

목적: 향후 리팩토링(예: 배치 처리, API 호출 최소화 등) 전후 성능을 비교하기 위한 실행 시간 기록.
전체 데이터 재구축(`rebuildLeadsMaster()`/`rebuildMTAMaster()`/`buildLeadsOPS()`)은 자주 도는 작업이
아니라 매번 로그가 남지 않으므로, 실행할 때마다 이 문서에 실측치를 추가한다.

## 2026-07-25 — Business Segment 로직 수정 후 전체 Rebuild

배경: `getBusinessSegment()`(`16_TransformHelper.js`) 분류 규칙 6건 수정(Search/Seminar/Webinar/
Content 필드 커버리지 보강) 반영을 위한 전체 재구축. `docs/BusinessSegmentClassification.md` 참고.

### 1. `rebuildLeadsMaster()` (`10_MasterBuild.js`)
데이터 규모: Leads_Raw 35,529 records → Leads_Master 35,529 records (overwrite)

| 단계 | 소요 시간 |
| --- | --- |
| Raw 읽기 + Transform | ~8s |
| Master 쓰기(overwrite) + 정렬 | ~70s |
| ACQ Summary Refresh (506 rows) | 32.92s |
| NewP1 Engine Refresh (386 rows) | 12.68s |
| Events Engine Refresh (370 rows) | 47.28s |
| BOFU Engine Refresh (133 rows) | 49.41s |
| Search Engine Refresh (361 rows) | 53.79s |
| Content Engine Refresh (137 rows) | 44.65s |
| **전체 (Started → Completed)** | **5m 26s** (326s) |

### 2. `rebuildMTAMaster()` (`10_MasterBuild.js`)
데이터 규모: MTA_Raw 82,420 records → MTA_Master 82,420 records (overwrite)

| 단계 | 소요 시간 |
| --- | --- |
| Raw 읽기 + Transform | ~17s |
| Master 쓰기(overwrite) + 정렬 | ~240s (4min) |
| ACQ Summary Refresh (526 rows) | 42.22s |
| NewP1 Engine Refresh (386 rows) | 10.94s |
| Events Engine Refresh (370 rows) | 44.74s |
| BOFU Engine Refresh (123 rows) | 40.02s |
| Search Engine Refresh (454 rows) | 39.97s |
| Content Engine Refresh (135 rows) | 40.04s |
| **전체 (Started → Completed)** | **7m 58s** (478s) |

### 3. `buildLeadsOPS()` (`21_OPS_Build.js`)
데이터 규모: Master 35,529 / OPS 35,482 (Merged 35,482, New 0, Updated 35,482, Duplicate 47, Skipped 0)

| 단계 | 소요 시간 |
| --- | --- |
| Merge + Write | ~124s (Total 245.85s 중 OPS QA 제외분) |
| OPS QA (Leads_OPS_QA, 6,966 issues 검출) | 121.49s |
| **전체 (함수 자체 보고 Time)** | **245.85s** (4m 6s) |
| **전체 (Started → Completed, wall clock)** | **4m 7s** |

OPS QA Issue 내역(참고, 이번 실행분 — 별도 조치 대상 아님, 기존에도 알려진 패턴):
- Funnel Match — IC Booked Date: 2,357
- Funnel Match — IC Completed Date: 2,215
- Funnel Match — Opportunity Won Date: 2,120
- Exact Duplicate Touch Row: 274

### 4. `runTempQABusinessSegment()` (`25_TempQA_BusinessSegment.js`)
데이터 규모: Leads_OPS 35,482행 중 2,269행 플래그(Other + Rule Mismatch)

| 단계 | 소요 시간 |
| --- | --- |
| **전체 (Started → Completed)** | **28s** |

(참고: Business Segment 로직 수정 전 최초 실행 시 6,888행이 플래그됐었음 — 6건의 룰 수정 +
Master/OPS 재구축 후 2,269행으로 감소. 남은 2,269행은 대부분 캠페인/네이밍 실수로 추정되는
개별 예외 케이스로 판단, 계속 검토 중.)

## 2026-07-25 — `buildLeadsOPS()` 재실행 중 대용량 write 타임아웃 2건 (참고용 실패 사례)

배경: 추가 Business Segment 룰(7차, BUSINESS_SEGMENT_EXCEPTIONS 포함) 반영을 위한 2차 전체
Rebuild 중 `buildLeadsOPS()`가 연속 2회 실패. 코드 로직 문제가 아니라 35,482행 전체를
`clear()` + `setValues()` + `applyOPSStyle()` 재작성하는 단일 실행이 Apps Script/Sheets
서비스의 시간·부하 한계에 걸치는 것으로 추정 — 같은 코드가 당일 이전 실행(위 3번 항목,
4m 7s)에서는 정상 완료됐음.

| 시도 | 실패 지점 | 실패까지 경과 시간 | 에러 |
| --- | --- | --- | --- |
| 1차 (09:00:33 시작) | `readOPS()`(`22_OPS_Merge.js:512`, merge 시작 전 기존 OPS 읽기) | ~2m 23s | `Document ... is missing (perhaps it was deleted, or you don't have read access?)` |
| 2차 (09:04:44 시작) | `writeOPS()`(`23_OPS_Write.js`, merge는 완료 — 09:12:02 로그 확인, write/style 단계에서 실패) | ~12m 23s | `Service Spreadsheets timed out while accessing document with id ...` |

메모(리팩토링 참고용): 두 실패 모두 "Document/Service ... [id]" 형태의 Google 측 일시적
접근/타임아웃 오류로, 같은 날 같은 코드로 이미 한 번 성공한 이력이 있어 코드 버그로 보기
어려움. 다만 `writeOPS()`가 매번 전체 시트 `clear()` 후 전체 재작성 + `applyOPSStyle()`
전체 재적용 방식이라, 데이터가 계속 늘어나면(현재 35K+ 행) 이 "전량 재작성" 패턴 자체가
타임아웃 위험을 키우는 구조적 요인일 수 있음 — 향후 증분 업데이트(변경분만 write) 방식
검토 후보.

## 2026-08-04 — `runLeadsPipelineTail()` 백그라운드 트리거 최초 실측 (`08_PipelineAsync.js`)

배경: `docs/OpenItems.md` #9(백엔드 실행 체인 트리거 비동기화) 구현 후 첫 실 시트 검증.
`appendNewLeads(true)`(Import→Append 자동 체이닝)가 설치형 1회성 트리거로
`runLeadsPipelineTail()`을 예약, 트리거가 `buildLeadsOPS(true)` → ACQ/NewP1/Events/BOFU/
Search/Content Engine → Target Actuals refresh 전체 체인을 실행.

| 항목 | 값 |
| --- | --- |
| Apps Script Executions 로그 상태 | Successful |
| **전체 실행 시간** | **363.546s (6m 3.5s)** |

참고: 트리거가 별도 실행으로 백그라운드에서 도니 Import/Append 클릭 직후 사용자는 즉시
알림을 받고 다이얼로그를 닫을 수 있음 — 이 6분은 브라우저를 막지 않음(설계 목적 달성).
README 탭 Pipeline Status A1:C7 표시 위치도 사용자가 직접 셀 클릭 확인(Name Box: A1) —
설계대로 정상 동작 확인.
