# Master_DB — Naver_Search_Campaign_Stats_Cache / Ad_Spend_Cache 외부 스프레드시트 이관 (#49)

**관련 로드맵 항목**: `docs/OpenItems.md` #49 (2026-09-03 등록)
**시작일**: 2026-09-04
**상태**: 완료(2026-09-04) — 두 캐시 모두 외부 스프레드시트 이관 + 실 트리거 실행 + ACQ_REP
소비 검증까지 전부 확인. 남은 건 기존 메인 시트 탭 정리(낮은 우선순위, 안정화 후 별도 결정)뿐.

## Goal

현재 메인 스프레드시트 내부 숨김 탭으로 존재하는 `Naver_Search_Campaign_Stats_Cache`
(`AD_001_Config.js`의 `AD.NAVER_SEARCH_CAMPAIGN_STATS.CACHE_SHEET`)와 `Ad_Spend_Cache`
(`CORE_001_Config.js`의 `CONFIG.ACQ.AD_SPEND_CACHE_SHEET`)를, `docs/exec-plans/completed/`로
옮겨질 예정인 `2026-09-03-master-db-raw-migration.md`(Leads_Raw/MTA_Raw/ICFunnel_Raw 이관)와
동일한 2단계 패턴(마이그레이션 스크립트 → 검증 → reader/writer 전환)으로 `Master_DB` 폴더 내
외부 스프레드시트로 이관해 메인 스프레드시트 용량/오픈 속도를 추가로 절감한다.

**범위 밖(이번 작업 아님)**: `Ad_Spend_Cache_Weekly`(`AD.SPEND_CACHE.WEEKLY_CACHE_SHEET`)와
`FX_Rate_Cache`(`AD.FX.RATE_CACHE_SHEET`) — #49 항목 원문이 명시한 두 시트(Naver_Search_
Campaign_Stats_Cache, Ad_Spend_Cache)만 대상. 확장 여부는 이번 라운드 완료·검증 후 별도 판단.

## 사전 조사 결과 (2026-09-04, 코드 조사만 — 아직 아무것도 수정 안 함)

### 대상 시트별 read/write 지점

**`Naver_Search_Campaign_Stats_Cache`** (`AD.NAVER_SEARCH_CAMPAIGN_STATS.CACHE_SHEET`,
전부 `AD_003_NaverSearch.js`):
- L1607, L1638-1641 — 읽기/쓰기(insertSheet 포함)
- L2123 — 참조

**`Ad_Spend_Cache`** (`CONFIG.ACQ.AD_SPEND_CACHE_SHEET`):
- `AD_004_SpendCache.js` L359-377 (`refreshAdSpendCache_()`, 쓰기 — Meta+Naver+Kakao 합산 후
  `clearContents()`+`setValues()`, 시간 기반 주기 트리거 `periodicRefreshAdSpendCache_()`
  경유, `docs/OpenItems.md` #19)
- `AD_004_SpendCache.js` L566-583 (`readAdSpendCacheMap_()`, 읽기)
- `JL_003_Write.js` L138 (직접 `getSheetByName()` 읽기 — `readAdSpendCacheMap_()` 안 씀,
  별도 처리 필요)

`readAdSpendCacheMap_()` 호출부(전부 grep 확인):
- `ACQREP_001_Report.js` L693 (`generateACQReport_()` 내부)
- `NEWP1REP_001_Report.js` L1167 (`generateNewP1Report_()` 계열)
- `AD_002_Meta.js` L1674 (`runDebugTargetWebinarAugustSpendAudit()` — TEMP 진단용 수동 실행
  함수, 트리거 무관)
- `UTIL_002_UtmProgramDictionary.js` L1006 — 주석에서 "같은 모양" 언급만, 실제 호출 아님(재확인 필요)

`readAdSpendWeeklyCacheMap_()`(별도 시트, 범위 밖)는 `TARGET_002_Report.js`/`AD_002_Meta.js`
TEMP 함수들이 사용 — Ad_Spend_Cache_Weekly 자체가 범위 밖이라 이번 작업과 무관.

### 트리거 컨텍스트 확인 (Simple Trigger 제약 재발 방지 목적)

`docs/OpenItems.md` #11에서 Target_REP가 겪은 문제 — Simple Trigger(`onEdit()` 직접 등록)는
Full Authorization이 아니라 `SpreadsheetApp.openById()`(외부 스프레드시트) 호출 자체가
막힘("Specified permissions are not sufficient"). 이 프로젝트는 이미 `refreshReportGenerate_()`
(`MASTER_002_PipelineAsync.js`) + 개별 `runInstall*ReportGenerateTrigger()`로 **모든 Report
Generate를 installable onEdit 트리거로 전환 완료**(CLAUDE.md 핵심 원칙, Target_REP/FY_REP
선례) — `AD_004_SpendCache.js`의 `readAdSpendCacheMap_()` 헤더 주석("Simple Trigger에서
호출되므로 외부 시트 절대 안 엶")은 **stale** — 실제로는:
- `ACQREP_001_Report.js`의 `runInstallReportGenerateTrigger()`(L469-480)가
  `handleReportGenerateEdit`를 installable onEdit으로 등록 → Full Authorization으로 실행
  확인(코드 직접 대조, L469-480).
- `AD_004_SpendCache.js`의 `refreshAdSpendCache_()`는 시간 기반 주기 트리거
  (`periodicRefreshAdSpendCache_()`) 경유 — 시간 기반 트리거는 애초에 항상 Full Authorization.
- 위 두 컨텍스트 모두 이미 Full Authorization이므로 `openById()` 전환 자체는 이론상 안전
  (Target_REP/FY_REP 선례와 동일 근거). **단, stale 주석은 정정 필요**(전환 작업 중 함께 수정).

### 확인 완료 (2026-09-04)

- `UTIL_002_UtmProgramDictionary.js` L1006은 `readAdSpendCacheMap_()`를 실제로 호출하지
  않음(주석에서 "같은 모양"이라 언급만 함) — 관련 없음, 확인 완료.
- `JL_003_Write.js`는 Korea Sales & Marketing Monthly Metrics 외부 시트 쓰기 전용 파일 —
  아직 주기적 트리거에 연결 안 됨(2026-09-01, 외부 이해관계자 공유 시트라 검증 전까지 보류
  중), `runRefreshJLExternalSheet()` 수동 실행만 — 수동 Run은 Full Authorization이라 안전.

## Progress

- [x] 대상 시트 2개의 read/write 지점 전수 grep 조사
- [x] Simple Trigger 제약 재발 여부 코드 대조로 확인(현재 컨텍스트 전부 Full Authorization으로
      판단, 위 근거 참고)
- [x] `JL_003_Write.js`/`UTIL_002_UtmProgramDictionary.js` L1006 잔여 확인 — 둘 다 무관/안전
- [x] **외부 스프레드시트 위치 확정(2026-09-04, 사용자 확인)** — 새 파일을 만들지 않고
      기존 캠페인 시트(`1zOZGwnsm0GhLGGe5rATu8jR5WxAQVx7YmmiPZVU88jY`, Meta_Raw/NaverSA_Raw가
      있는 Master_DB 폴더 파일)에 탭 2개를 추가로 만들어 재사용, 숨김 탭으로 유지(아래
      Decision Log 참고).
- [x] `CORE_001_Config.js`(v1.63.0) `CONFIG.ACQ.AD_SPEND_CACHE_EXTERNAL.SPREADSHEET_ID`,
      `AD_001_Config.js`(v1.24.0) `AD.NAVER_SEARCH_CAMPAIGN_STATS.EXTERNAL.SPREADSHEET_ID`
      추가 — 둘 다 위 캠페인 시트 ID.
- [x] **재구축형 캐시라 "복사 이관" 대신 "쓰기 대상만 전환" 방식으로 결정** — Raw와 달리
      두 캐시 모두 매 refresh마다 `clearContents()`+`setValues()`로 전량 재작성되므로
      (append-only 아님, 과거 이력 보존 불필요), `MASTER_012_RawExternalMigration.js`류의
      별도 1회성 복사 스크립트를 만들지 않고 read/write 함수 자체의 대상만 외부
      스프레드시트로 바꿈 — 다음 refresh 실행 시 외부 시트에 처음부터 새로 채워짐(Decision
      Log 참고).
- [x] **opener 함수 신규 + reader/writer 전환 완료(코드 작성)**:
      `openNaverSearchCampaignStatsCacheExternalSpreadsheet_()`(`AD_003_NaverSearch.js`
      v2.16.0)/`openAdSpendCacheExternalSpreadsheet_()`(`AD_004_SpendCache.js` v1.6.0) —
      `MASTER_010_SALSync.js`의 `openSALExternalSpreadsheet_()`와 동일 패턴(ID 비어있으면
      명시적 에러). `readNaverSearchAdCampaignStatsCache_()`/
      `writeNaverSearchAdCampaignStatsCache_()`/`runShowNaverSearchAdCampaignStatsCache()`
      (진단용)와 `refreshAdSpendCache_()`/`readAdSpendCacheMap_()`,
      `JL_003_Write.js`(v1.1.0)의 `computeJLMetricsFromLiveData_()` 직접 참조까지 전부
      opener 경유로 전환 — 헤더/합산/변환 로직은 전혀 무변경, I/O 대상만 전환.
      `AD_004_SpendCache.js` 헤더 주석의 stale한 "Simple Trigger라 openById() 불가" 설명도
      정정(위 사전 조사에서 확인한 대로 이미 installable onEdit로 전환돼 있었음).
      `node --check` + `scripts/check-*.sh`(duplicate-declarations/naming/syntax/
      version-header) 전부 통과 확인.
- [x] `scripts/safe-clasp-push.sh` 완료(단일 worktree, 충돌 없음)
- [x] **실 실행 검증 완료(2026-09-04, 사용자 확인)** — `runRefreshAdSpendCache()`:
      에러 없이 완료, "Ad_Spend_Cache 갱신 완료: 222행 (환율 KRW→NZD=0.001253306)" —
      외부 시트에 `Ad_Spend_Cache` 탭 정상 생성. Naver 2022-9~2024-9 구간 "조회 가능 기간
      밖(730일)" 스킵 로그는 API 하드 리밋에 의한 기존 설계된 정상 동작(코드 무변경 구간,
      이관과 무관). `runRefreshNaverSearchAdCampaignStatsCache()`: "2026-09-03 ~
      2026-09-03 반영 완료 (9개 캠페인 누적)" — 외부 시트에 `Naver_Search_Campaign_Stats_Cache`
      탭 정상 생성. 사용자가 캠페인 시트에서 탭 2개 생성 육안 확인.
- [x] **ACQ_REP Generate 재검증 완료(2026-09-04, 사용자 확인)** — "acq에서 정상으로 나와"
      — Spent/CPNP1 등 이 캐시에 의존하는 값이 이관 후에도 정상 표시됨. → 두 캐시 모두
      Phase 완전 검증 완료.
- [ ] (낮은 우선순위, 당장 안 함) 메인 스프레드시트의 기존
      `Naver_Search_Campaign_Stats_Cache`/`Ad_Spend_Cache` 숨김 탭 정리 — Raw 이관과 동일
      방침으로 안정화 확인 후 사용자 결정 시점에 삭제.

## Surprises & Discoveries

- `AD_004_SpendCache.js`의 `readAdSpendCacheMap_()` 헤더 주석이 "Simple Trigger라 외부 시트
  절대 안 엶"이라고 적혀 있으나, 실제 호출 컨텍스트(ACQ_REP/NewP1_REP Generate)는 이미
  installable onEdit로 전환되어 있어 주석이 stale함 — 이관 작업 중 정정 필요, 하지만 반대로
  "그때는 Simple Trigger였다"는 사실 자체가 이 캐시를 설계할 당시(2026-08-06 이전)의 제약
  조건이었을 가능성이 있어, 왜 마이그레이션이 여태 안 됐는지의 배경 설명이 될 수 있음.
- 이 두 캐시는 Raw와 달리 **소스 오브 트루스가 아니라 외부 API(Meta/Naver/Kakao) 재조회로
  100% 재구축 가능한 캐시**라는 점이 Raw 이관과 근본적으로 다른 성질 — "복사 이관" 대신
  "외부 스프레드시트를 대상으로 캐시 재구축 함수를 그대로 한 번 실행"하는 편이 더 간단하고
  안전할 수 있음(무손실 복사 로직 자체가 불필요해질 가능성). 착수 시 재검토.

## Decision Log

- **새 외부 스프레드시트 파일을 만들지 않고 기존 캠페인 시트에 탭만 추가**(2026-09-04,
  사용자 확정) — 처음엔 Raw 이관 때처럼 "타입당 파일 1개" 관례를 그대로 따라 새 파일
  생성을 제안했으나, 사용자가 "왜 기존 시트를 쓰면 안 되냐"고 되물어 재검토한 결과 실제
  기술적 제약은 없음(탭 이름만 겹치지 않으면 충돌 없음)을 인정 — "타입당 파일 1개"는
  강제 규칙이 아니라 그때그때의 정리 관례였을 뿐. 사용자가 최종적으로 "기존에 추가하고
  숨김처리" 확정.
- **"복사 이관" 대신 "쓰기 대상 전환"** — Raw(불변 원본, 손실 없이 옮겨야 함)와 달리 이
  두 캐시는 외부 API에서 100% 재계산 가능한 값이라, 별도 마이그레이션 스크립트로 기존
  값을 복사할 필요가 없다고 판단. 다음 refresh 실행 한 번이면 외부 시트가 처음부터 채워짐
  — Raw 이관의 2단계 롤아웃(복사 스크립트 먼저 → 검증 → reader/writer 전환)보다 훨씬
  단순한 1단계 전환으로 충분.
- **Simple Trigger 관련 stale 주석 정정** — `AD_004_SpendCache.js`가 애초에 이 캐시를
  "같은 스프레드시트에만 둬야 한다"고 설계했던 이유 자체가 당시(2026-07-30) ACQ_REP
  Generate가 Simple Trigger였기 때문 — 이후 installable onEdit으로 전환되면서 그 제약이
  사라졌는데 주석은 안 고쳐져 있었음. 이번 작업의 전제 조건이라 코드 대조로 재확인 후
  정정.

## Outcomes & Retrospective

당초 Raw 이관 패턴(1회성 복사 스크립트 → 검증 → 2단계 reader/writer 전환)을 그대로 따를
것으로 예상했으나, 두 캐시가 재계산 가능한 값이라는 성질을 활용해 훨씬 단순한 "쓰기 대상
전환 1단계"로 끝낼 수 있었음 — 착수 전 예상보다 작업량이 적었음. 조사 과정에서 걸림돌이 될
뻔했던 지점(Simple Trigger `openById()` 제약)이 실제로는 이미 해소돼 있었다는 것도 코드
대조로 사전에 확인해 안전하게 진행. 외부 스프레드시트 위치는 "타입당 새 파일" 관례를 깨고
기존 캠페인 시트에 탭만 추가하는 것으로 사용자가 확정 — Master_DB 폴더 구조가 반드시
"파일 1개 = 데이터 1종류"일 필요는 없다는 선례가 됨(다음에 비슷한 캐시를 이관할 때 참고).

**남은 한계**: 메인 스프레드시트의 기존 두 숨김 탭(`Naver_Search_Campaign_Stats_Cache`/
`Ad_Spend_Cache`)은 정리하지 않고 그대로 둠 — 용량 절감 효과를 온전히 보려면 추후 삭제
필요(사용자 결정 시점).
