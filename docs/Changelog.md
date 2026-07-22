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

  ## 2026-07-21 (계속) — IC Funnel Sync 최초 실행 검증 완료

- `syncICFunnelToOPS()` 최초 실행: 3,139건 중 3,127건 정상 반영, 12건 "Not found in Leads_OPS".
- 12건 원인 확인 완료 — 버그 아님:
  - 10건: mergeOPS()의 중복 이메일 제외 로직으로 Leads_OPS에 의도적으로 없는 Lead ID
  - 2건: Salesforce에 2026-07-20 새벽 생성된 최신 Lead — 아직 weekly export에 미포함,
    다음 Leads Import 시 자동 반영 예정
- `08_ICFunnelSync.gs`(구 24_) — getHeaderMap() 0-based index를 falsy 체크(`!leadIdCol`)로
  잘못 판단하던 버그 수정 (Lead ID가 0번째 컬럼일 때 실패하던 문제).

  ## 2026-07-21 (계속) — ACQ Report (Engine + Summary) 구현 완료

### 설계 확정 사항
- 시트: 기존 `ACQ_REP` 시트 재사용 (Report Area A4:N + Control Area A1:E1)
- Start/End FY·Month를 별도 드롭다운 4개로 분리 (기존 "FY26 JUL" 통합 드롭다운의 스크롤 문제 해결),
  FY 목록은 실제 데이터 기준 동적 계산
- Generate Report는 E2 체크박스 + `onEdit` Simple Trigger 방식
- Engine(월×세그먼트 조합)은 매번 선택된 Start~End FY 구간만 재생성 (전체 기간 아님, 성능 목적)
- % 계산식: All P1% = All P1/All Leads, New Leads% = New Leads/All Leads, New P1% = New P1/New Leads

### 성능 재설계 — ACQ Summary (Aggregate Table) 도입
- 최초 구현(원본 Master/OPS 매번 전체 스캔)이 선택 기간을 좁혀도 여전히 느려서, 별도 `ACQ_Summary` 숨김 시트에
  전체 (FY|Month|Segment) 조합별 지표를 미리 계산해두는 방식으로 재설계.
- `refreshACQSummary_()`가 Append/Rebuild/Sync 5개 함수 완료 시 자동 호출되어 항상 최신 유지.
- 결과: 리포트 조회가 수십 초 → 1초 이내로 개선.

### SAL 데이터 소스 확정
- 새 `SALs_Raw` 시트 안 만들고, 기존 MTA CSV export에 `Lead: Lead Record Type`(값: MQL/SAL) 컬럼만 추가 요청하는 것으로 단순화.
- MTA 전체(81,907건) 재수출/재Import/Full Rebuild 완료, `Lead Record Type` 필드 반영 확인됨.

### IC Funnel Sync 구축 및 검증
- 새 `ICFunnel_Raw` 시트 + `syncICFunnelToOPS()` 구현 — 별도 Lead 리포트(IC Booked/Completed/Won Date 중
  하나라도 해당 주에 걸리면 잡히는 필터, 2018~현재 히스토리 백필용 최초 추출)로 Leads_OPS의 Funnel 4개 필드만 역동기화.
- `OPS.SF_COLUMNS`에서 IC Booked/Completed/Won/Revenue를 빼서 `OPS.SYNC_COLUMNS`로 재분류
  (mergeOPS()가 더 이상 이 필드들을 Master의 stale 값으로 덮어쓰지 않도록).
- 최초 실행: 3,139건 중 3,127건 반영, 12건 "Not found" — 10건은 mergeOPS 중복 제외 로직으로 의도적으로 없는 Lead,
  2건은 아직 weekly export에 안 잡힌 최신 Lead(2026-07-20 생성)로 확인, 전부 정상.

### Attribution 불일치 발견 및 보류
- All Leads/All P1/SAL(MTA_Master 소스)은 Last Touch 기준 Segment, New Leads/New P1/IC Booked/Complete/Revenue
  (Leads_OPS 소스)는 First Touch 기준 Segment로 서로 다름. 기존 설계 문서(business-segment-classification.md)와
  일치하는 의도된 차이. SAL을 First Touch로 통일할지는 이번엔 보류 (추후 파이프라인/리포트 단계에서 논의 예정).

### 디자인 (32_ACQReportStyles.js)
- % 컬럼 소수점 1자리 %표기, Revenue 천단위 콤마, 전체 테두리, 짝수 행 배경색(#F3F3F3) 적용.

### 트러블슈팅 히스토리 (자세한 내용은 docs/ACQReportImplementation.md 참고)
- `endIndex` 세그먼트 블록 계산 누락, `targetRows` 변수 삭제 사고, Report Area 코드 중복(mtaAgg/opsAgg 구버전 잔존),
  `computeMTAAggregates_`/`computeOPSAggregates_`의 null range 처리 누락, `CONFIG.ACQ.SUMMARY_SHEET` 로컬-서버
  동기화 불일치로 인한 반복적인 신규 시트 생성 버그, `split_csv.js`가 실수로 Apps Script 프로젝트에 push되어
  전체 프로젝트 파싱이 깨졌던 사고(`require is not defined`), Apps Script의 `_` 접미사 함수 Run 드롭다운 미노출 관례.
- 교훈: **서버(Apps Script 편집기)에서 직접 코드를 수정하지 말 것 — 항상 로컬에서 수정 후 push.**
  Node 전용 유틸리티 스크립트는 프로젝트 폴더 밖에 두거나 `.claspignore`로 제외할 것.

# Changelog — 2026-07-22

## 1. MTA Funnel Sync 재검증 (09_MTAFunnelSync.js)
- `rebuildLeadsMaster()`/`rebuildMTAMaster()`/`buildLeadsOPS()`/QA 재실행 완료, `24_OPSQA.js`의 QA
  Dashboard에서 `#Won`(OPS 3093 vs MTA 2875, +218) / `Total Revenue`(OPS가 +415만 많음) 역방향 불일치 발견.
- 원인: 삭제된 구버전 `08_ICFunnelSync.js`(ICFunnel_Raw 기반) 시절 잔존 데이터로, 현재 `MTA_Master`에는
  대응 레코드가 없는 219건 (전부 category A: MTA_Master에 Lead ID 자체가 없음, 파싱 버그 아님).
  `syncMTAFunnelToOPS_()`는 값이 있을 때만 채워넣고 지우지 않으므로 안전하게 보존됨 — 버그 아님, 정상.

## 2. Business Segment 리네이밍
- `Event Offline` → `Seminar`, `Event Online` → `Webinar` (분류 조건 변경 없음, 표시 이름만 변경).
- 변경 파일: `16_TransformHelper.js`(`getBusinessSegment()`), `00_Config.js`(`CONFIG.ACQ.SEGMENTS`),
  `docs/BusinessSegmentClassification.md`, `30_ACQReport.js` 주석.
- **주의**: Master 재생성(`rebuildLeadsMaster()`/`rebuildMTAMaster()`) 전까지는 기존 데이터에 구 이름이 남아있음.

## 3. ACQ Report "All Leads" 월별 집계 근본 한계 발견
- `Last MKT UTM Campaign`이 Salesforce Lead 객체의 **현재 최종 상태 필드**임을 실데이터로 확인
  (Lead `00Q7F00000VePrO`의 2020~2026년 여러 터치를 Salesforce에서 각각 필터링해도 전부 동일한 최신 캠페인).
  터치 시점의 채널 정보를 전혀 보존하지 않음.
- 영향: `MTA_Master`는 터치 단위(1 Lead=N Row)인데 `Business Segment`는 Lead 레벨 필드라 한 Lead의
  모든 터치 row가 항상 동일 Segment를 가짐 → 월별 Segment 집계가 "그 달의 실제 채널"을 의미하지 않음.
- **결정**: 리포트/코드 수정 없음. 한계를 `docs/ACQReportDesign.md`에 명시하는 것으로 마무리
  (Lead 단위 dedup 재설계도 검토했으나, Segment 자체가 터치 시점 정보를 못 담으므로 근본 해결 안 됨).

## 4. MTA_Master 중복 append 의심 (미해결, TODO)
- `findDuplicateTouchRows_()`(`24_OPSQA.js`)로 같은 Lead ID+같은 MTA Created Date 조합 3,401개 그룹,
  extra row 4,139건 발견. MTA_Raw 원문 확인 결과 애초에 시간 정보가 없는 날짜 단위 데이터라, 같은 날
  여러 정상 터치인지 실제 재export로 인한 중복 append인지 현재 필드로는 구분 불가.
- CLAUDE.md "현재 알려진 미해결 항목" 3번으로 TODO 유지.

## 5. Leads_OPS 짝수 행 배경색(Row Banding) 추가
- `20_OPS_Styles.js`에 `computeRowBandingColors_()` 추가, 짝수 행에 `#F3F3F3` 배경 — 컬럼 많은 행을
  옆으로 읽을 때 row 경계 구분 목적. 35,000+ 행이라 `setBackgrounds()` 배치 호출로 구현 (개별 호출 지양).

## 6. Leads_OPS ↔ Master 자동 Sync 연결
- `appendNewLeads()` → `buildLeadsOPS(true)`(QA 생략) 자동 호출 추가.
- `appendNewMTA()` → `syncMTAFunnelToOPS_()` 자동 호출로 대체 (기존 `refreshACQSummary_()` 단독 호출 제거,
  `syncMTAFunnelToOPS_()`가 내부에서 이미 호출하므로 중복 방지).
- 배경: "IC Requested 체크 후 다음 수동 sync 전까지 IC Booked Date가 안 보인다"는 실무 갭 해소 목적.
  MTA sync는 Lead가 이미 Leads_OPS에 있어야 하지만, 매번 전체 재계산이라 순서가 뒤바뀌어도 다음 사이클에
  자동으로 따라잡힘 (self-healing) — 두 담당자가 다른 날 독립적으로 import해도 무방.
- 자세한 내용: `docs/OperationsLayer.md` "자동 Sync 연결" 섹션.

## 7. IC Request Tracking 구현 (재신청 이력 보존)
- `20_OPS_Config.js`: `IC Requested` 옆에 `Last IC Requested Date`, `Total IC Requests` 컬럼 추가.
  `IC Requested`는 `MANUAL_COLUMNS`에서 제외 — `OPS.IC_REQUEST`(CHECKBOX/COUNTER)로 특수 관리.
- `22_OPS_Merge.js`: `applyICRequestTracking_()` 추가. 매 merge마다 기존 `IC Requested`가 true였으면
  `Total IC Requests` +1 후 리셋. 추가로 `IC Booked Date`가 있는데 카운트가 0이면 1로 하한 보정
  (트래킹 도입 이전 기존 Booked 이력 백필 + 체크박스 없이 booked되는 예외 케이스 커버).
- `20_OPS_Styles.js`: `Last IC Requested Date` 날짜 서식(yyyy-mm-dd) 추가.
- 자세한 내용: `docs/OperationsLayer.md` "IC Request Tracking" 섹션.

## 8. MTA Business Segment 필드 근본 수정 — "Last MKT UTM Campaign" → "MKT UTM Campaign"
- **배경**: 3번 항목에서 "Salesforce 데이터 모델 자체의 한계"로 결론 냈던 것을, 사용자가 같은 날 오후
  Salesforce 리포트 추출 필드를 `Last MKT UTM Campaign`(Lead 객체 레벨) → `MKT UTM Campaign`
  (Multi Touch Attribution 객체 자체 필드)로 교체해서 실제로 해결함. 후자는 터치별 실제 캠페인 값이 찍힘.
- `13_MTATransformer.js` v5.0.0: `getBusinessSegment()` 입력 필드 교체, Master 컬럼명도
  `Last MKT UTM Campaign` → `MKT UTM Campaign`로 개명 (더 이상 "Lead의 최종 터치"가 아니므로).
- `24_OPSQA.js`의 진단 함수들(`runInvestigateSegmentMonthAnomaly`, `runSampleDuplicateRawDates`)도
  새 필드명으로 업데이트.
- ⚠️ **`appendSheetRecords()`(`05_SheetWriter.js`) 주의**: 기존 데이터 있는 시트에 append할 때 **시트에
  이미 있는 헤더만 기준으로 컬럼 매칭**. `MTA_Raw` 헤더에 `MKT UTM Campaign`이 없으면 새 CSV의 이
  컬럼이 조용히 드롭됨. 재추출 CSV를 새 헤더 포함해서 다시 쌓아야 함.
- **결정**: 과거 82,000+ 터치까지 정확한 Segment로 바로잡기 위해 **전체 재추출 + 재구축** 진행하기로 함
  (부분 적용— MTA_Raw 헤더만 추가하고 신규 터치부터만 적용 — 대신 선택).
  절차: MTA 전체 리포트 재추출(`MKT UTM Campaign` 포함) → `MTA_Raw`/`MTA_Master` 시트 내용 수동 삭제 →
  `99_ResetRawMaster.js`의 `resetMTACounterOnly()` 실행 → "Import MTA"로 전체 CSV 재업로드 →
  `rebuildMTAMaster()` 실행 (`refreshACQSummary_()` 자동 포함) → `buildLeadsOPS()`로 OPS도 갱신.
- 자세한 내용: `docs/BusinessSegmentClassification.md` "필드 변경 이력", `docs/ACQReportDesign.md`
  "All Leads/SAL — Segment 한계 해결됨" 섹션.

## 다음에 다룰 항목 (2026-07-22 오후 기준 갱신 — 아래 섹션 참고)
- ~~MTA 전체 재추출 + 재구축 실행 대기 (7번 항목 절차)~~ — 완료 (아래 "MTA_Raw Lead ID 누락" 섹션).
- `Total Touches`(MTA_Master 기준 터치 횟수) 컬럼 — Leads_OPS `Revenue Actual`과 `Notes` 사이(T/U열 사이)에 추가. 아직 미구현.
- "Other" 세그먼트 중 Upsell 비중 조사 — `runInvestigateOtherSegmentComposition()`(`24_OPSQA.js`) 구현 완료,
  실행 결과 확인 대기.
- MTA_Master 중복 append 의심(4번 항목) — 여전히 미해결, CLAUDE.md TODO 3번 참고.
- BOFU fix 반영 MTA_Master 재구축 완료 확인 대기 (아래 참고).

# Changelog — 2026-07-22 (계속, 오후)

## 9. 로컬 개발 환경 재구축 (신규 머신)
- 새 환경에 Git 미설치 상태 확인 (winget도 미설치) → Git for Windows 인스톨러 직접 다운로드해 무인 설치.
- 기존 로컬 `crimson-lead-tracker` 폴더(스텁 상태, `.gs` 확장자, 문서 없음)를
  `crimson-lead-tracker-backup-20260722`로 백업 후, GitHub(`Harry-sk-mkt/crimson-lead-tracker`) clone으로 교체.
- `clasp` 재설치 + 로그인(`h.yun@crimsoneducation.org`) 재인증.
- GitHub push 인증: 이 세션의 브릿지된 터미널은 상호작용이 비활성화되어 있어 Git Credential Manager의
  브라우저 로그인을 못 띄움 → 사용자가 별도의 일반 터미널에서 직접 `git push` 실행해 해결.

## 10. MTA_Raw 재추출 시 "Lead: Lead ID" 컬럼 누락 발견 + 재조치
- 사용자가 새로 다운로드한 MTA raw CSV(`report1784693554195.csv`, 82,421행)에 `Lead: Lead ID` 컬럼
  자체가 없음 발견. `CONFIG.REQUIRED_FIELDS.MTA`가 이 필드를 필수로 요구해서 전체 레코드가
  invalid 처리 → `MTA_Raw`에 0건 기록 (에러 없이 "성공"으로 끝나 원인 파악에 로그 확인 필요했음).
- 원인: Salesforce 리포트 재추출 시 필드 설정 누락으로 추정 (재현 조건 불명, 일회성 사용자 실수로 판단).
- 조치: `Lead: Lead ID` 포함해서 재추출(`report1784695873625.csv`) → `google.script.run` 페이로드
  크기 문제 방지를 위해 Node 스크립트(`split_csv.mjs`, 프로젝트 폴더 밖 scratchpad에 위치 —
  gotcha #3 원칙 준수)로 CSV를 quote-aware하게 정확히 2등분(41,211 / 41,210행, 헤더 포함) →
  `MTA_Raw`/`MTA_Master` 시트 전체 삭제 → `resetMTACounterOnly()` → 두 파일 업로드 → `appendNewMTA()`.
- 결과: 82,421건 전체 매칭 확인, `MTA_Master` 재생성 완료.

## 11. MTA BOFU Business Segment 버그 발견 + 수정
- 사용자가 ACQ_REP에서 BOFU가 항상 0으로 나오는 것을 확인, 원인 조사.
- `13_MTATransformer.js`의 `getBusinessSegment()` 호출에서 `detail` 인자가 하드코딩된 `""`였음
  (10번 항목의 MTA 전체 재구축과 무관하게 이전부터 존재하던 별개 버그). BOFU 판정 조건은
  `detail.includes("bofu")` 단독이라 campaign 기반 fallback이 없어 구조적으로 절대 나올 수 없었음.
- Leads_Master 쪽(`12_LeadTransformer.js`)은 원래부터 정상적으로 detail을 넘기고 있어 영향 없음
  (Leads/MTA 분류 로직은 원래도 소스 필드가 다르게 분리되어 있었음 — First Touch vs Per-Touch).
- 사용자 확인: MTA 리포트의 `Lead Source Detail`은 `Lead:` prefix가 없어 Multi Touch Attribution
  객체 자체 필드로 판단 (샘플 검증, 100% 확정은 아님).
- 수정: `13_MTATransformer.js` v5.1.0, `""` → `rawRecord["Lead Source Detail"]`.
  회귀 테스트 `testTransformMTARecord_BOFU()` 추가. `clasp push --force`(manifest 변경 확인 필요)로 배포,
  git 커밋(`cb8fb85`) + GitHub push 완료.
- 반영을 위해 `MTA_Raw`/`MTA_Master` 재삭제 → `resetMTACounterOnly()` → 재Import → `appendNewMTA()` 재실행 중.
- 자세한 내용: `docs/BusinessSegmentClassification.md`, `docs/ACQReportDesign.md`.

## 12.5. IC Booked/Complete Event 기준 검증 + 헤더 Note 추가
- `24_OPSQA.js`에 `runDiagnoseICCompleteMismatch()`(Leads_OPS vs MTA_Master 재계산값 대조)와
  `runBreakdownICCompleteByBookedMonth()`(이번 달 Complete 건을 Booked 월별로 분해) 진단 함수 추가,
  일시적으로 `✅ QA` 메뉴에 걸어 실행 확인 후 메뉴에서 제거(진단 함수 자체는 파일에 보존).
- 검증 결과: IC Booked(41)/IC Complete(43) 전부 정상 — sync 로직 버그 없음. Complete가 Booked보다
  많은 건 5~6월에 Booked된 상담이 7월에 Complete된 백로그(재부킹 등) 때문으로 확인, 정상 동작.
- `32_ACQReportStyles.js` v1.4.0: `annotateACQReportMetricNotes_()` 추가 — `ACQ_REP` 헤더 K/L/M/N
  (SAL/IC Booked/IC Complete/Revenue) 셀에 날짜 기준을 Note로 남겨, 코호트/이벤트 기준 혼동 방지.
  `applyACQReportStyles_()`가 매 리포트 생성마다 자동 호출하므로 항상 최신 유지.

## 12.6. NewP1_REP 설계 확정 + ACQ_REP New P1 로직 통일
- 사용자가 `docs/NewP1ReportDesign.md`에 NewP1_REP(New P1 Cohort Funnel Report) 설계를 직접 정리 —
  소스는 `Leads_OPS` 단일, 코호트는 `Create Date` + 유효 Priority(`Priority Override` 우선 →
  `Lead Priority`, exact match `"Priority 1"`), SAL 판정은 `Total IC Requests` > 0(MTA 무관),
  Won 판정은 `Revenue` > 0, Row는 FY>Month>Fiscal Week>Segment flat 구조(소계 없음), Engine과
  Summary를 `NewP1_Engine` 한 시트로 통합. 리뷰 결과 Article 번호 인용/실제 함수 동작 모두 정확함 확인.
- 리뷰 중 발견: ACQ_REP의 New P1(`computeOPSAggregates_()`)이 `Priority Override`를 무시하고
  `Lead Priority`에 `indexOf("1")`(substring)로 느슨하게 비교하고 있어, NewP1_REP 설계(exact match +
  Override 우선)와 기준이 달랐음. 사용자 확인 후 **ACQ_REP의 New P1도 같은 기준으로 통일** —
  `isEffectiveP1_()` 신규 추가(`30_ACQReport.js` v1.5.0), 테스트 `testIsEffectiveP1()` 포함.
  All P1(MTA_Master 기반)은 `Priority Override` 컬럼 자체가 없어 대상 아니고 기존 로직 유지.
- NewP1_REP 구현은 다음 세션 대기 (`40_NewP1Report.js`/`41_NewP1ReportStyles.js`/`CONFIG.NEWP1` 신규 예정).

## 12. 리포트 설계 가드레일 재확인 — 향후 NewP1_REP 등 확장 리포트 주의사항
- 사용자가 향후 만들 New P1 Funnel 리포트(`NewP1_REP`, 미구현)가 `Leads_Master`를 직접 읽으면 안 된다는
  점을 미리 확인. `Leads_Master`는 append-only라 갱신된 상태(Business Segment 재분류 등)를 반영 못 함.
  기존 원칙(`docs/OperationsLayer.md`: "향후 모든 리포트는 Leads_Master가 아닌 Leads_OPS를 읽어야 한다")과
  일치 — 코드 변경 없음, 향후 구현 시 지킬 가드레일로 기록.
- 참고로 `IC Booked Date` 등 `OPS.SYNC_COLUMNS`는 애초에 `Leads_Master`를 거치지 않고
  `syncMTAFunnelToOPS_()`가 `MTA_Master`에서 직접 `Leads_OPS`로 쓰기 때문에 이 문제와 무관 (이미 안전).