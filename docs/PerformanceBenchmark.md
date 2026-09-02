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

## 2026-08-09 — `buildLeadsOPS()` write 타임아웃 재발 (참고용 실패 사례, 2건째)

배경: Business Segment 룰 수정(Campaign bofu/webinar/seminar 키워드 추가 + 예외 8건,
`UTIL_001_TransformHelper.js` v1.15.0/v1.16.0) 반영을 위한 `rebuildLeadsMaster()` →
`buildLeadsOPS()` 재구축 중 `buildLeadsOPS()` 실패.

| 실패 지점 | 에러 |
| --- | --- |
| `writeOPS()`(`OPS_005_Write.js:65`, `buildLeadsOPS`(`OPS_003_Build.js:57`)에서 호출) | `Exception: Service Spreadsheets timed out while accessing document with id ...` |

2026-07-25 항목(그때 35,482행)과 정확히 같은 실패 지점·같은 에러 문구 — 코드 버그가 아니라
그때 이미 식별된 "Leads_OPS 전체를 매번 `clear()`+`setValues()`로 전량 재작성"하는 구조적
타임아웃 위험이 데이터가 더 늘어난 채로 재발한 것으로 추정. 조치: `buildLeadsOPS()` 재시도
안내(재현 시나리오 확인 전까지 증분 업데이트 리팩터링은 착수하지 않음 — 반복되면 그때
우선순위 재검토).

## 2026-09-03 — `runLeadsPipelineTail()` 전체 체인 리포트별/구간별 실측 (`docs/OpenItems.md` #42, exec-plan `2026-09-02-pipeline-refresh-time-redesign.md`)

배경: #42(Engine→OPS/Report 트리거 분리 재검토)에서 "OPS 4종/Report 5종 실행시간이
미측정이라 분리 여부 판단 불가"로 보류돼 있던 실측을 진행. 결정 로그대로 전체 합산이 아니라
단계별로 나눠서 측정하기 위해 `MASTER_002_PipelineAsync.js` v1.26.0에 `[TIMING]` Logger 계측을
추가(`advancePipelineStage_()` 전체 + `refreshReportGenerate_()`/`refreshOPSSheets_()` 내부
개별 호출, 로직 변경 없음) 후 재실행.

데이터 규모: Leads_Master 36,612행 / Leads_OPS 36,561행(사용자 확인, 8월 대비 증가).

| 레이어 | 소요 시간 | 전체 대비 |
| --- | --- | --- |
| **전체 (Execution started → completed, wall clock)** | **10m 12s** (612s) | 100% |
| 사전 단계(중복삭제 9.2s + buildLeadsOPS 119.7s + DealTracker rebuild 5.4s) | 134.3s | 21.9% |
| Engine 6종 합계 | 169.9s | 27.8% |
| Naver Search 캠페인 통계 | 2.9s | 0.5% |
| OPS 4종 합계 (`refreshOPSSheets_`) | 25.7s | 4.2% |
| Campaign Spend + Target Actuals + FY Dropdowns | 89.4s | 14.6% |
| **Report 5종 합계 (`refreshReportGenerate_`)** | **175.2s** | **28.6%** |
| (계측 합계 vs wall clock 차이 — Properties/README 쓰기 등 오버헤드) | ~14.5s | 2.4% |

### Engine 6종 개별

| Engine | 소요 시간 |
| --- | --- |
| refreshACQSummary_ | 24.7s |
| refreshNewP1Engine_ | 8.5s |
| refreshEventsEngine_ | 40.0s |
| refreshBOFUEngine_ | 34.6s |
| refreshSearchEngine_ | 29.2s |
| refreshContentEngine_ | 32.9s |

### OPS 4종 개별

| OPS | 소요 시간 |
| --- | --- |
| buildEventsOPS | 4.8s |
| buildBOFUOPS | 8.2s |
| buildSearchOPS | 5.5s |
| buildContentOPS | 7.2s |

### Report 5종 개별 — **S&M_REP이 Report 레이어의 68%, 전체 파이프라인의 20%를 단독으로 차지**

| Report | 소요 시간 | Report 레이어 대비 |
| --- | --- | --- |
| generateACQReport_ | 3.7s | 2.1% |
| generateNewP1Report_ | 3.7s | 2.1% |
| generateTargetReport_ | 25.6s | 14.6% |
| **generateSMReport_** | **119.8s** | **68.4%** |
| generateFYReport_ | 22.3s | 12.7% |

### 분석 — #42 두 설계 질문에 대한 실측 근거

1. **Engine 독립 트리거 분리 필요성 — 시급성 낮아짐(재평가 필요)**: 전체 10m12s는
   Workspace 계정 30분 한도의 34%에 불과 — 2026-08-26 IC Funnel 데이터 기준 추정
   (Engine만 4m39s, 6분 한도의 78%)에서 우려했던 것보다 Leads 파이프라인 실측은 여유가
   있음(단, 데이터가 계속 늘어나는 추세이므로 안전마진이 무한하지는 않음, 2026-08-05
   강제종료 사고 전례도 총 소요시간과 무관하게 재발 가능한 리스크로 별도 존재).
   Engine 6종 자체는 169.9s(27.8%)로 가장 큰 단일 레이어는 아님.
2. **Report 레이어 증분화 — 실측으로 확인, S&M_REP이 압도적 1순위**: 사전 가설("Target/FY/S&M
   모두 무거울 것") 중 실제로는 **S&M_REP 하나가 Report 레이어 175.2s 중 119.8s(68%)를
   차지** — 전체 파이프라인 10m12s의 약 1/5이 S&M_REP 한 함수. Target_REP(25.6s)/FY_REP
   (22.3s)은 상대적으로 작아 우선순위가 S&M_REP에 훨씬 쏠림. `SMREP_001_Report.js`가
   Leads_OPS·MTA_Master 전체를 `sheetToObjects()`로 메모리에 올린 뒤 주 단위로 필터링하는
   구조(`docs/OpenItems.md` #42 코드 근거)가 그대로 병목으로 실측 확인됨.
3. **부가 발견(별도 항목 아님, 참고)**: `refreshCampaignSpend_`(41.2s)의 상당 부분이
   Naver Search Ad API 조회 가능 기간(최근 730일) 밖인 2022~2024년 각 월을 매번 순회하며
   "건너뜀" 로그만 남기는 데 소모됨 — 조회 시작 시점을 730일 이내로 하한 처리하면 이 구간의
   낭비가 줄어들 가능성(작지만 쉬운 개선 후보, 별도 결정 필요).

**다음 액션**: 사용자 설계 확정 대기(exec-plan `2026-09-02-pipeline-refresh-time-redesign.md`
Decision Log 원칙대로 구현은 미착수) — 이 실측 결과를 그 문서 Progress/Surprises에도 반영.

## 2026-09-03 — S&M_REP 증분화 구현 완료 및 실측 검증 (`docs/OpenItems.md` #41 계열)

배경: 위 실측에서 S&M_REP(`generateSMReport_`)이 Report 레이어의 68%, 전체 파이프라인의
20%를 단독으로 차지하는 것으로 확인돼(원인: Leads_OPS/MTA_Master 전체를 자체 재스캔),
같은 데이터를 이미 계산해두고 있던 ACQ Engine(`refreshACQSummary_`)의 스캔에 주 단위
서브맵만 얹어 공유하는 방식으로 재설계(`ACQREP_001_Report.js` v1.19.1,
`ACQREP_002_Summary.js` v1.4.0, `SMREP_001_Report.js` v1.3.0 — 신규 `ACQ_Summary_Weekly`
캐시, `docs/OpenItems.md` #41 참고).

| 실행 | `generateSMReport_` | `refreshACQSummary_` |
| --- | --- | --- |
| 개선 전(09-03 오전, 3회차) | 119.8s | 24.7s |
| 1차 구현 직후(09-03) | **3.9s** | ⚠️ 122.5s (회귀) |
| 회귀 수정 후(09-03) | **4.0s** | 33.8s (정상 범위 복귀) |

**회귀 원인 및 수정**: 1차 구현이 `computeMTAAggregates_()`/`computeOPSAggregates_()`의
주 단위 weekKey 계산에 `Utilities.formatDate()`(Apps Script 서비스 호출)를 3만6천+행
루프마다 호출 — 7만+회 서비스 호출로 5배 느려짐(2026-08-06 Deal Tracker 경로에서 이미
한 번 겪은 것과 동일한 성능 클래스). `CONFIG.DATE.TIMEZONE = Session.getScriptTimeZone()`
(런타임 자체 타임존)이라 `getMondayOfWeek_()`의 로컬 Date 컴포넌트와 항상 일치함을
확인한 뒤, 순수 JS 포맷 함수 `formatWeekKeyDate_()`로 교체(바이트 단위로 동일한 결과,
서비스 호출만 제거) — `ACQREP_001_Report.js` v1.19.1.

**결과(사용자 실측 확인, 2026-09-03)**: S&M_REP Generate **119.8s → 4.0s(97% 감소)**.
BOFU_OPS(136)/Content_OPS(144)/Events_OPS(357)/Search_OPS(108) 등 나머지 전 항목 행
수 동일 — 회귀 없음. New P1은 ACQ_REP과 완전히 동일한 소스(Leads_OPS의 Priority
Override/다운그레이드 가드 포함)로 계산해 정의 불일치 위험 없음(#35/#38류 재발 방지가
설계 핵심 — 2026-09-03 설계 논의에서 raw Master 기반 대안은 명시적으로 기각됨).

**설계 논의 중 파생된 별도 TODO 2건**(구현 범위 밖, `docs/OpenItems.md` 참고): #43
Lead Priority(P1) 기준 리스트 기반 자동 flagging, #44 SAL Sync가 무관한 Engine 6종까지
매번 전부 재실행하는 낭비 구조.
