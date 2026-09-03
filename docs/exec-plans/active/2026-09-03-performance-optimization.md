# 파이프라인 성능 및 구조 비효율 개선 실행 계획 (2026-09-03)

**관련 로드맵 항목**: 파이프라인 성능 최적화 및 구조 효율화  
**시작일**: 2026-09-03  
**상태**: 다음 세션 시작 시 즉시 착수  

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
