# Configuration Centralization Rule

## Rule
모든 설정 가능한 값은 오직 `00_Config.js` 안에만 존재해야 한다.

**Examples**
- Sheet Names
- Toast
- Header Rows / Data Rows
- Date Formats
- Logging
- Constants
- Required Fields (Validation 기준)
- Raw Date Columns (Plain Text 강제 대상)
- Script Properties Keys
- Validation Summary Display Exclude

## Must NOT
Business logic은 절대 Config 안에 존재해서는 안 된다.

## Engineering Constitution Article 11 (하드코딩 금지)

다음 항목의 하드코딩을 금지한다:
- Sheet 이름
- Column Index
- Header
- 상수
- Format

모든 설정은 `00_Config.js`에서 관리한다.

## 알려진 예외 / 미해결 (2026-07-21 기준)

- `20_OPS_Styles.js`의 `applyOPSStyle()`은 아직 헤더/데이터 행 번호(`1`, `2`)가 하드코딩되어 있음.
  `writeOPS()`는 `OPS.ROWS`로 이미 정리되었으나, `applyOPSStyle()`은 아직 미정리 — 사용자 결정 대기 중.