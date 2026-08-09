# Naming Convention

## File Naming (`STAGE_NNN_Name.js`, 2026-07-30 결정 → 2026-08-09 전체 적용)

모든 `.js`(및 관련 `.html`) 파일명은 `STAGE_NNN_Name.js` 형식을 따른다 —
대문자 스테이지/도메인 코드(`_`로 구분) + 3자리 순번 + PascalCase 이름.

```
CORE_001_Config.js
IMPORT_002_CsvReader.js
EVENTS_004_Merge.js
AD_006_KakaoMoments.js
```

- 2026-07-30에 결정될 당시엔 `AD_*`(캠페인 지출)/`FYREP_*`(FY_REP) 등 신규
  파이프라인부터만 적용하고, 기존 `NN_Name.js`(2자리, 스테이지 코드 없음) 65개
  파일은 "별도 세션"으로 전환을 미뤄뒀었다. 2026-08-09 세션에서 전체 전환 완료
  — 현재 모든 파일이 이 규칙을 따른다.
- 스테이지 코드 목록: `CORE`(설정/메뉴), `IMPORT`(CSV→Raw), `MASTER`(Raw→Master
  Build), `UTIL`(도메인 무관 공용 헬퍼), `OPS`(Leads_OPS Build), `ACQREP`,
  `NEWP1REP`, `EVENTS`, `BOFU`, `SEARCH`, `CONTENT`, `TARGET`(각 리포트/트래커
  도메인), `AD`(캠페인 지출 자동화), `FYREP`(FY_REP), `MAINT`(워크북 전체
  유지보수, 특정 도메인과 무관), `RESET`(Raw/Master 리셋 유틸), `TEMPQA`(일회성/
  수시 재실행용 진단 스크래치 파일 — 어느 도메인을 조사했는지와 무관하게 전부
  이 스테이지로 통합, 원래 조사 대상 도메인 번호대에 흩어놓지 않음).
- 번호(`NNN`)는 그 스테이지 안에서의 파이프라인 순서(Config→Engine/Build→
  Merge→Write→Styles 등)를 의미하며, 스테이지마다 001부터 새로 시작한다.
- 파일명을 바꾸는 것 자체도 "내용 변경"으로 간주해 Version/Change Log를 갱신한다
  (아래 "File Versioning" 참고) — 리네임 사실과 기존 파일명을 한 줄로 남긴다.
- **히스토리 문서는 소급 개명하지 않는다** — `docs/Changelog.md`, `docs/exec-plans/**`,
  그리고 각 파일 자체의 Change Log 안의 과거 날짜가 붙은 항목들은 그 시점에
  실제로 쓰이던 파일명을 그대로 기록한 것이므로 새 이름으로 바꿔 쓰지 않는다
  (기록 왜곡 방지). 반대로 "현재 상태"를 설명하는 비-이력 서술(Responsibility/
  WHY 블록, 설계 문서의 "구현 파일" 안내 등)은 새 파일명으로 갱신한다.

## Functions

```
readXXXX()
transformXXXX()
writeXXXX()
buildXXXX()
updateXXXX()
appendXXXX()      // 2026-07-21 추가 — append 방식 함수
rebuildXXXX()     // 2026-07-21 추가 — full rebuild 함수 (구 buildXXXX)
```

## Configuration

```
CONFIG.SHEETS
CONFIG.ROWS
CONFIG.TOAST
CONFIG.LOG
CONFIG.DATE
CONFIG.REQUIRED_FIELDS          // 2026-07-21 추가
CONFIG.RAW_DATE_COLUMNS         // 2026-07-21 추가
CONFIG.PROPERTIES               // 2026-07-21 추가 (Incremental Build 추적용)
CONFIG.VALIDATION_SUMMARY_EXCLUDE  // 2026-07-21 추가
```

## Menu (2026-07-21 개명)

```
📥 Update   (구 "📥 Import")
🏗️ Append   (구 "🏗️ Build")
```

## File Versioning (2026-07-24 명문화)

모든 `.js` 파일 상단 헤더 주석은 `Version`(현재 버전)과 `Change Log`(버전별 변경 이력)를 포함한다.
**파일 내용을 수정할 때마다 반드시 함께 갱신한다** — 새 함수 추가, 기존 함수 수정, 버그 수정
등 내용이 바뀌는 모든 경우 (문서/주석만 고치는 경우는 제외). 지금까지 대부분의 파일이 이미 이
패턴을 따르고 있었으나(예: `MASTER_007_MTATransformer.js`, `OPS_006_QA.js`, `OPS_002_Styles.js`,
2026-08-09 리네임 전 이름은 각각 `13_MTATransformer.js`/`24_OPSQA.js`/`20_OPS_Styles.js`) 명문화된
규칙은 아니었음 — 실수로 누락되는 경우(예: `EVENTS_002_Engine.js`(구 `51_Events_Engine.js`)에 함수
추가 후 버전 갱신 누락, 2026-07-24)를 방지하기 위해 규칙으로 고정.

```js
/**
 * ==========================================================
 * Marketing 2.0
 * <파일 책임 한 줄 요약>
 *
 * Responsibility
 * ...
 *
 * Version
 * v1.1.0                          // 최신 버전만 여기 표기
 *
 * Change Log
 * v1.1.0 (2026-07-24)
 * - 무엇을 왜 바꿨는지 한두 줄
 * v1.0.0 (2026-07-24)
 * - 최초 구현
 * ==========================================================
 */
```

- 버전 번호: `vMAJOR.MINOR.0` — 기존 함수 시그니처/출력을 바꾸는 변경은 MINOR(또는 그 이상) 증가,
  순수 추가(새 함수, 새 테스트)는 MINOR 증가로 충분.
- Change Log는 최신 항목이 위로 오도록 쌓는다(내림차순). 오래된 항목을 지우지 않는다.
- 신규 파일은 `v1.0.0` + `- 최초 구현`으로 시작.