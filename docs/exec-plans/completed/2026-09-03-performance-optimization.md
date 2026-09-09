# 파이프라인 성능 및 구조 비효율 개선 실행 계획 (2026-09-03)

**관련 로드맵 항목**: 파이프라인 성능 최적화 및 구조 효율화  
**시작일**: 2026-09-03  
**상태**: ✅ 전 항목(1~5) 코드 완료(2026-09-04) + 실사용 검증 완료(2026-09-08~09). 항목
1/2/3/5는 2026-09-07~08 실 Import(MTA/Leads/SAL/IC Funnel)로 동작 확인. **항목 4(딕셔너리
증분)도 2026-09-09 최종 검증 완료** — 2026-09-08 01:04:25 사이클(당일 Leads Import 이전,
신규 0행)에 이어 그날 오후 1시 사이클(Leads Import 이후) 로그로 확인: `Leads_Master : 61
new records read (targeted, sheet row 36682부터)` → `UTM_Program_Dictionary 증분 갱신 완료:
Leads 신규 61행 / MTA 신규 0행 반영(전체 재채굴 아님)`, `Program_Segment_Dictionary`도 동일
61행. 그날 실제 Leads Import 신규 건수(61건, Changelog 2026-09-08 `buildLeadsOPS()` 로그와
일치)와 정확히 일치 — 증분 채굴이 올바른 값을 반영함을 확정. 항목 5는 사용자 확정으로 청크
처리만 적용, Leads_OPS 증분 병합(`buildLeadsOPS()` 자체 증분화)은 별도 항목(`docs/OpenItems.md`
#50)으로 분리해 범위 밖으로 보류(아래 항목 5 "미착수" 참고). **✅ 원인 확정(2026-09-08, 사용자 재현
테스트)** — SAL 직후 겹쳐 실행됐을 때 `runICFunnelPipelineTail`이 1790초(≈29.8분, 30분 제한
근접), `generateTargetReport_`만 916초 소요. 같은 날 락 충돌 없이 **단독으로 IC Funnel Import
재실행**(월요일치 소량, 4건 신규)한 결과 `generateTargetReport_` **35.6초**(베이스라인 25.6s와
동일 범위), 전체 `runICFunnelPipelineTail`도 329.9초(5.5분)로 정상 — **Target_REP 코드 버그가
아니라 파이프라인 겹침(락 충돌 재시도)이 외부 스프레드시트(Deal Tracker) API 호출을 지연시키는
현상으로 확정**. 조치는 별도 결정 필요(자주 발생하는 패턴이 아니라 낮은 우선순위로 분류 가능하나,
겹치면 30분 제한에 근접하는 건 사실이므로 완전히 무시하지 말 것) — `docs/OpenItems.md`에 별도
항목으로 기록.

---

## Progress

- [x] **항목 1 — Master 정렬(`sortSheetByDate`) 제거 (2026-09-04, 코드 완료)**:
      `MASTER_001_IncrementalMasterBuild.js`(v1.12.0)의 `appendNewLeads()`/`appendNewMTA()`,
      `MASTER_004_MasterBuild.js`(v4.5.0)의 `rebuildLeadsMaster()`/`rebuildMTAMaster()` 4곳
      전부 `sortSheetByDate()` 호출 제거. 호출부가 하나도 안 남아 `IMPORT_007_SheetSorter.js`
      자체도 삭제(No Assumptions 원칙에 따라 grep으로 다른 호출부 없음을 사전 확인).
      `OPS_006_QA.js`(v1.8.1)의 중복행 자동삭제 함수 헤더 주석("매 append마다 재정렬되므로
      정렬 부작용 없음")이 stale해져 함께 갱신(카운터 무관 결론 자체는 그대로 유효).
      `docs/OpenItems.md` #18 하위 TODO, `docs/ImportPipeline.md` 파일 목록도 갱신.
      **간접 검증(2026-09-07/08)** — 실 MTA/Leads Import 2건 모두 에러 없이 완주(다운스트림
      OPS/리포트까지 정상 생성), append-only 전환으로 인한 부작용 없음. Master 행이 실제로
      append 순서 그대로 쌓이는지(정렬 여부)까지 육안 대조는 안 함(낮은 우선순위, 필요 시
      추가 확인).
- [x] **항목 2 — `RawDeduplicator` 동적 윈도우 (2026-09-04, 코드 완료)**:
      `IMPORT_008_RawDeduplicator.js`(v1.2.0)의 `filterOutExactDuplicateRawRecords_()`에
      optional `dateFieldName` 추가 — 지정 시 그 컬럼만 먼저 읽어(`findRawDedupComparisonWindow_()`)
      신규 배치의 날짜 값과 일치하는 기존 행의 연속 구간(최소~최대 인덱스)만
      추려 그 구간만 전체 폭으로 읽음. 완전동일 중복 판정이 날짜 필드도
      포함한 전체 필드 일치를 요구한다는 성질을 이용해 **시트 정렬 순서와
      무관하게 항상 정확**(순수 함수 `computeRawDedupWindowFromDateColumn_()` +
      `testComputeRawDedupWindowFromDateColumn()`으로 이상치/빈값 케이스까지
      검증). `IMPORT_005_RawWriter.js`(v4.4.0)의 `writeLeadRaw()`/`writeMTARaw()`가
      각각 `REQUIRED_FIELDS`에 있어 항상 값이 보장되는 `"Create Date"`/
      `"Multi Touch Attribution: Created Date"` 전달. `writeICFunnelRaw()`/
      `writeSALRaw()`는 필수 날짜 필드가 없어(`REQUIRED_FIELDS`에 "Lead ID"만)
      의도적으로 미전달 — 기존 전체 스캔 그대로(No Assumptions, 대상 규모도
      Leads/MTA보다 훨씬 작음). **✅ 실 Import로 검증 완료(2026-09-08)** — Logger
      로그 확인: Leads `Raw dedup — 61건 중 0건 완전 동일 중복으로 skip, 61건 신규.
      (비교 대상 0건 / 전체 37630건)`(겹치는 날짜 없어 비교 자체 스킵), MTA
      `Raw dedup — 388건 중 97건 완전 동일 중복으로 skip, 291건 신규. (비교 대상
      141건 / 전체 87342건)`(겹치는 구간 141건만 읽어 정확히 판정) — 둘 다 전체
      스캔 대신 좁은 윈도우만 읽으면서 판정 정확도 그대로 유지됨을 실측 확인.
- [x] **항목 3 — `ICFunnelSync`/`SALSync` Batch Direct Update (2026-09-04, 코드 완료)**:
      두 파일 다 기존엔 매번 Raw 전체(4만+ 행)를 읽어 전체 Lead ID의 "최신
      스냅샷"을 재계산하고, Leads_OPS도 전체 컬럼(3만5천+ 행)을 읽고/썼음.
      `CONFIG.PROPERTIES.ICFUNNEL_LAST_ROW`/`SAL_LAST_ROW`(LEADS_LAST_ROW와
      동일 관례) 신규 도입해 `getRawSheetDataRowCount_()`/`readRawSheetFrom_()`
      (기존 MASTER_005_DataReader.js 재사용, 무변경)로 "이번에 새로 Import된
      배치"만 읽음 — Raw가 Append-only라 배치 내 Lead ID는 항상 과거 어떤
      레코드보다 최신이라는 성질로 결과 동일함을 보장. Leads_OPS 쓰기도
      신규 공용 순수 함수 `computeDirectUpdateRowWindow_()`
      (MASTER_003_MTAFunnelSync.js v1.11.0, `testComputeDirectUpdateRowWindow()`
      검증)로 대상 Lead ID들의 행 번호 최소~최대 연속 구간만 읽고/씀 — 리드
      하나당 개별 setValue() 호출(과거 978.95초 성능 사고 방식)은 재사용하지
      않고 배치 read/write 방식 그대로 유지, 범위만 좁힘.
      `computeMTASyncColumnUpdates_()`/`applyPriorityDowngradeGuard_()`/
      `computeSALDeltaLeads_()` 셋 다 `dataStartRow` 인자만 이 window의
      `startRow`로 바뀌어 그대로 호환(내부 로직 무변경, 리스크 최소화).
      MASTER_009_ICFunnelSync.js v1.9.0/MASTER_010_SALSync.js v1.3.0.
      **주의(최초 1회 한정)**: 두 카운터 모두 0에서 시작하므로 배포 후 첫
      실행은 기존 Raw 전체를 "신규"로 처리(기존과 동일한 부하 1회) —
      이후부터 배치 단위로 빨라짐. **✅ 동작 확인(2026-09-08, 예상대로 최초
      1회 전체 처리)** — Logger 로그: SAL `Compared window : 36574 rows (of
      36628 total OPS rows)`(New 8179 = SAL_Raw 전체), IC Funnel `Compared
      window : 36530 rows (of 36628 total OPS rows)`(New 42875 = ICFunnel_Raw
      전체) — 둘 다 체크포인트 0 → 최초 실행이라 예상대로 OPS 거의 전체가
      윈도우로 잡힘(버그 아님). **✅ 소규모 배치 재확인 완료(2026-09-08)** —
      같은 날 IC Funnel을 락 충돌 없이 단독으로 한 번 더 Import(월요일치 소량,
      신규 4건)한 결과 `Compared window : 33086 rows (of 36689 total OPS
      rows)` — 배치가 4건뿐인데도 윈도우는 여전히 OPS 거의 전체(90%)에 가깝게
      나옴. 이건 버그가 아니라 "연속 구간(min~max row span)" 설계 자체의
      성질로 추정 — 이 4건의 대상 Lead ID들이 OPS 시트 전체에 흩어져 있으면
      그 최소~최대 구간 자체가 넓어짐(정렬 순서와 Lead ID 매칭 위치는 무관).
      다만 `syncICFunnelToOPS_` 자체 소요시간은 196.4초(최초 실행 690.5초 대비
      대폭 감소)로 짧게 끝나 체감 절감 효과 자체는 확인됨 — "윈도우 폭"과
      "실제 처리 시간"이 꼭 비례하진 않는다는 것도 함께 확인. 락 충돌 재시도
      메커니즘(#9)도 이번에 실전 확인(SAL 실행 중 IC Funnel이 겹치자 자동
      재시도 큐잉, 데이터 손실 없음).
- [x] **항목 4 — `Program_Segment_Dictionary`(+`UTM_Program_Dictionary`도 동일 적용)
      증분 등록 (2026-09-04, 코드 완료)**: exec-plan 제목은 Program_Segment_
      Dictionary만 명시했지만, `periodicRefreshDictionaries_()`가 같은 실행에서
      두 딕셔너리를 순서대로 호출하고 둘 다 Leads_Master+MTA_Master 전체(12.4만
      행)를 스캔하는 동일 구조라 UTM_Program_Dictionary도 함께 전환하지 않으면
      "12.4만 행 전수 스캔 제거" 목표를 달성 못 함 — 둘 다 전환.
      `refreshUtmProgramDictionaryIncremental_()`/`refreshProgramSegmentDictionaryIncremental_()`
      신규(`readRawSheetFrom_()` 재사용, MASTER_005_DataReader.js 무변경)로
      `periodicRefreshDictionaries_()`를 교체. **정확성 핵심 설계**: Master는
      Raw와 달리 완전동일 중복행 자동삭제로 행 수가 줄 수 있어(순수 row-count
      체크포인트가 위치 밀림으로 이중집계될 위험) `computeDictionaryRefreshWindow_()`
      가 감소를 감지하면 그 소스만 처음부터 재채굴; 두 소스(MTA/Leads)의 카운트를
      합쳐 저장하면 한쪽만 재채굴할 때 다른 쪽 기여분을 역산할 수 없어 캐시 시트
      hidden 컬럼(MTA/Leads Counts JSON)에 **소스별로 분리 보존**, 딕셔너리별
      체크포인트 4개도 완전히 독립(공유 시 한쪽만 수동 전체 재구축될 때 어긋남).
      신규 순수 함수 6개 전부 테스트 작성 + PASS 확인, 추가로 "두 배치로 나눠
      증분 처리한 결과 === 한 번에 전체 스캔한 결과" 동등성을 노드 시뮬레이션으로
      별도 검증(수동, 코드에는 없음 — 세션 기록용). 기존 수동 전체 재구축
      (`runRefreshUtmProgramDictionary()`/`runRefreshProgramSegmentDictionary()`)은
      함수명/시그니처/가시적 출력 무변경으로 유지(안전장치), 내부만 hidden
      컬럼 기록+체크포인트 리셋을 하도록 갱신해 두 경로가 캐시 시트를 공유해도
      어긋나지 않게 함. **부분 검증(2026-09-08)** — Executions 로그로
      `periodicRefreshDictionaries_`의 01:04:25 Time-Driven 실행(31.1초, 에러 없음) 확인,
      기대 로그 포맷("Leads 신규 N행 / MTA 신규 N행 반영(전체 재채굴 아님)")도 정확히
      찍힘(UTM_Program_Dictionary/Program_Segment_Dictionary 둘 다) — 증분 경로 진입
      자체는 확인됨. **✅ 완전 검증(2026-09-09)** — 같은 날(2026-09-08) 오후 1시 사이클
      (당일 Leads Import 이후) 로그로 이어서 확인: `Leads_Master : 61 new records read
      (targeted, sheet row 36682부터)` → `UTM_Program_Dictionary 증분 갱신 완료: Leads
      신규 61행 / MTA 신규 0행 반영(전체 재채굴 아님)`, `Program_Segment_Dictionary`도
      동일 61행 — 그날 실제 Leads Import 신규 건수(61건, 항목 2/5 검증 로그와 동일 배치)와
      정확히 일치해 증분 채굴이 실제로 올바른 값을 반영함을 확정.
      Business Segment 분류 결과(`resolveBusinessSegment_()` 등 소비 측)는 캐시
      시트의 핵심 4개 컬럼 의미/위치가 그대로라 회귀 없음 — 그래도 다음 Import 후
      Business Segment 분류가 기존과 동일하게 나오는지 육안 확인 권장.
- [x] **항목 5 — 청크(Chunk) 처리만 적용 (2026-09-04, 코드 완료) — 증분 업데이트는
      사용자 확정으로 범위 밖(아래 참고)**: 사용자 확인(2026-09-04) — Leads_OPS
      중복 이메일 처리(`mergeOPS()`, `OPS_004_Merge.js`)를 증분화하려면 "신규
      배치 행의 Create Date가 기존 OPS 행보다 이른지" 비교하는 새 로직이
      필요해(단순 재사용 불가) Leads_OPS(전체 리포트가 참조하는 핵심 테이블)
      실수 시 파급이 크다는 이유로 **청크 처리만 우선 진행, 증분 병합 로직은
      이번 라운드에서 보류**하기로 확정. 청크 처리(`UTIL_003_SheetChunkIO.js`
      신규 — `computeChunkRanges_()`(순수, `testComputeChunkRanges()`) +
      `getRangeValuesChunked_()`/`setRangeValuesChunked_()`(단일 `getValues()`/
      `setValues()` 호출과 결과 100% 동일 — 노드 시뮬레이션으로 별도 검증,
      코드에는 없음)만 아래 4곳에 적용, **동작/출력 변경 없음**(안전장치만 추가):
      - `OPS_004_Merge.js`(v3.3.0) `sheetToObjects()`
      - `OPS_005_Write.js`(v2.3) `writeOPS()`
      - `MASTER_005_DataReader.js`(v2.3.0) `readRawSheet()`
      - `MASTER_012_RawExternalMigration.js`(v1.1.0) `writeFullRawSnapshotToExternalSheet_()`
      **간접 검증(2026-09-08)** — Leads_OPS(36,741행) 청크 처리 경유 read/write가 실 Import
      파이프라인에서 에러 없이 완주(101.18초, Merged 36,689/New 61/Updated 36,628). 청크
      경계 자체를 정밀 검증하진 않았으나 대용량 실데이터로 최소 1회 무결히 동작함은 확인.
      **미착수(향후 별도 검토 필요, 임의로 처리하지 말 것)**: `buildLeadsOPS()`의
      증분 병합(신규 Master 배치만 처리 + 기존 OPS 행과 날짜 비교) — 착수 시
      최소 다음을 설계해야 함: (1) 이메일이 이미 OPS에 있는데 새 배치 행의
      Create Date가 기존보다 이르면 SF_COLUMNS 교체(MANUAL/SYNC_COLUMNS는
      계속 보존), 이르지 않으면 duplicate로 카운트만 하고 기존 행 불변,
      (2) 같은 배치 내 신규 이메일 중복은 기존 로직 그대로 재사용 가능,
      (3) 실 스프레드시트 데이터로 대조 검증 필수(순수 함수 테스트만으로는
      불충분 — Leads_OPS는 거의 모든 리포트의 소스).

---

## 작업 배경 및 목적

`crimson-lead-tracker` 프로젝트의 ETL 파이프라인 전수 조사 결과, 대용량 시트(8만+ 행)에 대한 불필요한 반복 스캔 및 과도한 전체 정렬/덮어쓰기 연산이 병목의 주원인으로 파악되었습니다. 

다음 세션 개시 시 Claude 및 개발 에이전트가 본 문서를 읽고 아래 5대 최적화 항목에 대한 코드 개편을 즉시 수행합니다.

---

## 5대 성능 및 구조 개선 작업 항목

### 1. Master 정렬 연산(`sortSheetByDate`) 완전 제거
* **대상 파일**: `MASTER_001_IncrementalMasterBuild.js`, `MASTER_004_MasterBuild.js`
* **내용**: 
  * `Leads_Master`(3.7만 행) 및 `MTA_Master`(8.7만 행)에 증분 데이터(수십~수백 건) append 후, 매번 전체 시트에 대해 실행되던 `sortSheetByDate()` 호출을 완전히 제거.
  * 실무자는 중간 처리 레이어인 Master 시트를 직접 보지 않고 `Leads_OPS`만 보므로, Master 시트는 **순수 Append-only(아래로 계속 붙여넣기) 방식**으로 전환하여 정렬 시간 비용을 **0초**로 단축.

---

### 2. `RawDeduplicator` 동적 윈도우 벤치마크 적용
* **대상 파일**: `IMPORT_008_RawDeduplicator.js`
* **내용**: 
  * 매 Import마다 외부 Raw 시트 전체(8.7만 행)를 `getValues()`로 읽던 방식을 수정.
  * 새로 들어온 CSV 데이터의 가장 오래된 날짜/행 오프셋을 동적으로 탐색하는 **동적 탐색 윈도우(Dynamic Window)** 적용. 해당 윈도우 범위만 지정 읽기하여 소급 데이터(이상치) 안전성을 유지하며 I/O 최소화.

---

### 3. `ICFunnelSync` & `SALSync` 신규 Import Batch Direct Update 전환
* **대상 파일**: `MASTER_009_ICFunnelSync.js`, `MASTER_010_SALSync.js`
* **내용**: 
  * 동기화 시 과거부터 누적된 Raw 전체(4만+ 행)를 매번 스캔하던 로직을 제거.
  * **이번에 새로 Import된 최신 CSV 묶음(수십~수백 건)만 타겟팅**하여, 해당 Lead ID들의 위치에만 `Leads_OPS` 값을 즉시 덮어쓰도록(Direct Update) 구조 변경.

---

### 4. `Program_Segment_Dictionary` 증분 등록(Incremental Update) 전환
* **대상 파일**: `UTIL_002_UtmProgramDictionary.js`
* **내용**: 
  * 12시간마다 Master 12.4만 행 전체를 스캔하여 딕셔너리를 처음부터 재구축하던 방식 폐기.
  * 기존 캐시 딕셔너리를 유지하고, **새로 Import되는 신규 데이터의 UTM/Program/Segment 키만 대조**하여:
    * 이미 존재하는 키: 카운트 증분 (+1)
    * 없는 신규 키: 딕셔너리에 추가 (Append)
  * 12.4만 행 전수 스캔 연산을 완전히 제거.

---

### 5. `Leads_OPS` 증분 업데이트 및 대용량 배치 청크(Chunking) 도입
* **대상 파일**: `OPS_004_Merge.js`, `OPS_005_Write.js`, `MASTER_012_RawExternalMigration.js`
* **내용**: 
  * 수십 건 반영 시에도 `Leads_OPS`(3.5만 행) 전체를 `clearContents()` 후 통째로 다시 쓰는 구조 보완.
  * 신규/변경이 발생한 행 단위 부분 갱신 및 5,000~10,000행 단위 청크(Chunk) 분할 읽기/쓰기를 적용해 Apps Script 6분 실행 제한 및 시트 락 방지.

---

## 세션 시작 시 착수 절차 (에이전트 지침)

1. `docs/exec-plans/active/2026-09-03-performance-optimization.md` 읽기
2. `MASTER_001_IncrementalMasterBuild.js`에서 Master 정렬 코드 제거 및 테스트
3. `UTIL_002_UtmProgramDictionary.js` 증분 등록 알고리즘 수정 및 테스트
4. `MASTER_009_ICFunnelSync.js` / `MASTER_010_SALSync.js` 신규 Batch Direct Update 전환 및 테스트
5. `IMPORT_008_RawDeduplicator.js` 동적 윈도우 벤치마크 구현 및 테스트
6. `OPS_004_Merge.js` 증분 업데이트 구조 보완

---

## Outcomes & Retrospective

**5개 항목 전부 실 Import로 실사용 검증 완료(2026-09-08~09)**:
- 항목 1(Master 정렬 제거)/5(OPS 청킹): 대용량 실데이터 무에러 완주로 간접 검증.
- 항목 2(RawDeduplicator 동적 윈도우): Logger 로그로 직접 확인(좁은 윈도우만 읽으면서
  판정 정확도 그대로 유지).
- 항목 3(IC Funnel/SAL Batch Direct Update): 최초 1회 전체 처리(체크포인트 0 시작) 확인
  + 소규모 배치 재확인으로 처리 시간 절감(690.5s → 196.4s) 확인.
- 항목 4(딕셔너리 증분): 신규 0행 사이클과 신규 61행 사이클을 모두 확인 — 후자가 실제
  Leads Import 건수(61건)와 정확히 일치해 증분 채굴 정확성까지 확정.

**부수적으로 발견·해소된 것**: SAL 직후 파이프라인 겹침(락 충돌 재시도) 시
`generateTargetReport_`가 916초까지 튀는 현상 — Target_REP 코드 버그가 아니라 파이프라인
겹칠 때 외부 Deal Tracker API 호출이 지연되는 현상으로 원인 확정(재현 테스트로 검증).
자주 발생하는 패턴이 아니라 낮은 우선순위로 `docs/OpenItems.md` #18에 기록만 해둠.

**범위 밖으로 분리된 항목**: 항목 5의 "더 어려운 절반"이었던 `buildLeadsOPS()`(Leads_OPS
증분 병합, `mergeOPS()` 중복 이메일 해소 로직 자체의 증분화)는 핵심 테이블 리스크가 커
사용자 확정으로 이번 라운드 범위에서 제외 — `docs/OpenItems.md` #50으로 별도 등록, 설계/
구현 미착수 상태로 백로그에 남김.
