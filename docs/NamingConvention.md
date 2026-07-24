# Naming Convention

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
패턴을 따르고 있었으나(예: `13_MTATransformer.js`, `24_OPSQA.js`, `20_OPS_Styles.js`) 명문화된
규칙은 아니었음 — 실수로 누락되는 경우(예: `51_Events_Engine.js`에 함수 추가 후 버전 갱신 누락,
2026-07-24)를 방지하기 위해 규칙으로 고정.

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