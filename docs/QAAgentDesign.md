# QA Agent Design (`qa-review` 스킬)

> Status: 설계 및 구현 완료 (2026-08-09) — `.claude/skills/qa-review/SKILL.md`.
> `docs/OpenItems.md` #23 ("QA 에이전트 설계 — 신규 TODO(2026-08-08), 착수 전")의 후속 구현.
> Apps Script 코드(`.js`) 변경은 없음 — 이 작업은 `.claude/skills/`와 문서만 대상.

---

## 1. Purpose

2026-08-08 세션 종료 시 사용자가 "QA 에이전트 설계"를 다음 TODO로 남겼으나, 스코프/목적이
논의되지 않은 채였다(`docs/OpenItems.md` #23, "임의로 설계하지 말 것"). 이번 세션(2026-08-09)에서
사용자에게 직접 확인해 스코프를 확정했다.

## 2. 스코프 확정 (사용자 확인, 2026-08-09)

- **QA 대상**: 데이터 정합성 + 리포트 값 검증 + 코드/엔지니어링 품질 — 3개 전부.
- **형태**: Claude Code 서브에이전트/스킬 (Apps Script 함수가 아니라, 세션 중 Claude가 따르는
  가이드).

## 3. 설계 전 확인한 제약 3가지

탐색 결과 아래 3가지가 설계를 실질적으로 결정했다:

1. **이 저장소엔 기존 서브에이전트/스킬/커맨드가 전혀 없었다** (`.claude/agents`, `.claude/skills`,
   `.claude/commands` 전무, 사용자 머신에도 참고할 예시 없음) — 처음부터 설계.
2. **naming(`_` 접미사)/version-header/중복 선언/문법 검사는 이미 `scripts/check-*.sh` +
   `.githooks/pre-commit`이 커밋마다 결정적으로 강제** — 새 QA 기능이 이를 재구현하면 순수 낭비.
3. **Claude는 라이브 Google Sheet를 읽을 방법이 전혀 없다.** Sheets API/서비스 계정/MCP 전무 확인,
   `clasp run-function`도 CLAUDE.md 기준 미도입 상태. 과거 모든 "리포트 값 검증"은 예외 없이
   "Claude가 진단 함수 작성 → 사용자가 Apps Script 편집기에서 직접 Run → 결과를 채팅에 붙여넣음 →
   Claude가 그 텍스트로 판단"이라는 사람 개입 루프였다(`docs/OpenItems.md` #20 New P1 183→204
   조사가 대표 사례). 따라서 "리포트 값 검증"은 자동화된 라이브 체크가 될 수 없고, **가이드된
   워크플로우**로만 설계 가능하다.

## 4. 서브에이전트 대신 스킬을 선택한 이유

리포트 값 검증 모드가 "사용자에게 함수 실행을 요청 → 붙여넣은 결과를 해석"하는 대화형 왕복을
필수로 요구하는데, 이는 격리된 컨텍스트에서 결과만 반환하는 서브에이전트보다 메인 대화 흐름에서
자연스럽다. 또한 스킬은 설명(description) 매칭으로 자연어 요청에서 자동 트리거되므로("QA 해줘",
"검증해줘"), 슬래시 커맨드 문법을 몰라도 되는 사용자(비개발자, 한국어 사용 — `docs/../memory` 참고)
에게 더 적합.

## 5. 이미 커버되는 것 vs 이 스킬이 새로 커버하는 것

| 영역 | 이미 커버하는 곳 | `qa-review`가 추가하는 것 |
| --- | --- | --- |
| 네이밍(`_` 접미사)/버전헤더 존재/중복 선언/문법 | `scripts/check-*.sh` + pre-commit (결정적, 커밋마다 강제) | 재검사 안 함 |
| Master/OPS 데이터 정합성(중복, 동기화 컬럼 보존, Dashboard 대조) | `24_OPSQA.js` (`runOPSQA_`, 파이프라인 자동 실행) | 새 로직이 기존 체크로 안 커버되는 **갭**을 찾아 제안(Mode 2) |
| 한 리포트 값의 일회성 조사 | `9X_TempQA_*.js`, 각 Engine의 `runInvestigate*`/`runDiagnose*` 등 (수동 실행, 축적된 관행) | 이미 있으면 재사용 안내, 없으면 같은 컨벤션으로 새로 작성(Mode 3) |
| Engineering Constitution 조항 중 스크립트로 못 잡는 것 (No Assumptions/TDD/Backward Compat/Single Responsibility/Config Centralization/Error Handling) | 사람이 리뷰 시 기억에 의존 | 체크리스트로 명시화(Mode 1) |

## 6. 3개 모드 요약

전체 워크플로우/체크리스트 본문은 `.claude/skills/qa-review/SKILL.md`에 있다(실행 시 로드되는
실제 지시문). 요약:

- **Mode 1 — 코드/엔지니어링 품질 리뷰**: 변경된 `.js`를 Engineering Constitution 조항(스크립트
  미커버 항목) 기준으로 점검, 파일:라인 불릿 리스트로 보고.
- **Mode 2 — 데이터 정합성 갭 체크**: 새 merge/transform 로직이 `24_OPSQA.js` 기존 체크로
  커버되는지 판단, 갭이 있으면 제안(승인 후 추가) + 파이프라인 배선 누락 여부 grep 확인.
- **Mode 3 — 리포트 값 검증(가이드형)**: 설계 문서로 의도된 공식 파악 → 외부 소스오브트루스 확인 →
  기존 진단 함수 재사용 또는 신규 작성 → "파일명+함수명"으로 실행 요청 → 결과 대조 → 알려진
  원인 패턴(dedup 순서/타임존/FX/코호트-이벤트 혼동) 우선 점검.

## 7. 알려진 한계 (구조적, 이번엔 해결 대상 아님)

- Mode 3은 근본적으로 사람 개입이 필요 — Claude가 직접 숫자를 "확인"할 수 없다. `clasp
  run-function` 또는 Sheets API/MCP 연동이 나중에 도입되면 이 모드를 반자동화할 여지가 있으나,
  이번 설계 범위 밖(별도 결정 필요).
- 스킬은 자연어 트리거 기반이라, 사용자가 명시적으로 "QA 해줘"라고 안 해도 Claude가 스스로 판단해
  proactively 부르는 경우 오탐(불필요하게 자주 트리거)이나 누락(불러야 할 때 안 부름) 가능성이 있음
  — 실사용하며 description 문구를 조정할 필요가 있으면 그때 갱신.

## 8. 관련 문서

- `docs/OpenItems.md` #23 (이 설계의 출발점)
- `docs/EngineeringConstitutionalRULES.md` (Mode 1의 체크 기준)
- `docs/OperationsLayer.md` (Leads_OPS_QA 시트, `24_OPSQA.js` 체크 목록)
- `docs/apps-script-gotchas.md` (전역 함수 덮어쓰기, `_` 접미사 Run 드롭다운 이슈)
