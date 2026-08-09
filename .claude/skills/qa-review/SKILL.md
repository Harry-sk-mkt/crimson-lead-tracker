---
name: qa-review
description: Use this skill when the user asks to QA or verify this project — "QA 해줘", "검증해줘", "이 숫자/값 맞는지 확인해줘", "코드 리뷰해줘", "정합성 확인" — or proactively before a clasp push that changes business logic (Master Build / OPS Merge / Report Engine 파일). Covers three modes: (1) code/engineering-quality review against docs/EngineeringConstitutionalRULES.md, (2) data-integrity gap-check against existing 24_OPSQA.js coverage, (3) guided report-value verification against Salesforce/Deal Tracker source-of-truth. Claude cannot read the live Google Sheet directly, so Mode 3 is a human-in-the-loop workflow, not an automated check.
---

# QA Review (crimson-lead-tracker 전용)

이 스킬은 `docs/QAAgentDesign.md`에 설계 배경이 문서화되어 있다. 실행 전 한 번은 그 문서를 읽고
"이미 다른 곳이 커버하는 것"과 겹치지 않는지 확인한다.

## 시작하기 전에 항상 확인할 것

- `scripts/check-naming.sh` / `check-version-header.sh` / `check-duplicate-declarations.sh` / `check-syntax.sh`가
  이미 pre-commit에서 강제하는 항목(`_` 접미사 실수, version header 존재, 전역 이름 중복, 문법 에러)은
  **이 스킬이 다시 검사하지 않는다** — 재검사는 시간 낭비이자 결과 중복.
- `24_OPSQA.js`가 이미 자동 실행 중인 체크(`checkRowCount_`/`checkMTAFunnelAndMatching_`/
  `checkLeadIdUniqueness_`/`checkExactDuplicateLeadRows_`/`checkExactDuplicateTouchRows_`/
  `checkSyncColumnsPreserved_`)와 겹치는 걸 새로 제안하지 않는다 — 이미 있으면 "이미 커버됨"이라고
  말하고 끝낸다.
- **Claude는 라이브 Google Sheet를 읽을 방법이 없다.** Sheets API/MCP/서비스 계정 전무, `clasp
  run-function`도 미도입 상태(CLAUDE.md 확정 사실). 리포트 실제 값 확인이 필요한 모든 경우는
  반드시 "사용자가 Apps Script 편집기에서 특정 함수를 직접 Run → 결과를 채팅에 붙여넣기"로
  귀결된다. 이 사실을 잊고 "제가 시트를 확인해보겠습니다" 같은 말을 하지 않는다.
- 비즈니스 로직 수정이 필요해 보이면, 이 스킬 안에서 바로 고치지 않고 먼저 사용자에게 확인한다
  (CLAUDE.md "No Assumptions" / Engineering Constitution Article 14).

3개 모드 중 사용자 요청이 어디에 해당하는지 판단한다. 모호하면(예: "QA 좀 해줘"처럼 대상이
불분명하면) 무엇을 QA할지 먼저 되묻는다 — 방금 수정한 코드인지, 특정 리포트 숫자인지, 데이터
정합성 전반인지.

## Mode 1 — 코드/엔지니어링 품질 리뷰

**대상**: 이번 세션(또는 사용자가 지정한 범위)에서 변경된 `.js` 파일.

`git diff` 또는 최근 수정 파일을 확인한 뒤, `docs/EngineeringConstitutionalRULES.md`의 조항 중
**pre-commit 스크립트로 못 잡는 것들**만 체크한다:

- **Article 2 (No Assumptions)**: 시트 이름/컬럼 인덱스/비즈니스 로직을 추측해서 하드코딩한 곳이 있는가?
- **Article 3/6 (TDD)**: 새로 추가되거나 수정된 pure 함수에 `testXXXX()` 짝이 있는가? 테스트가 실제로
  의미 있는 기대값을 검증하는가(껍데기 테스트 아닌지)?
- **Article 5 (Backward Compatibility)**: 기존 함수 시그니처, 시트 레이아웃, 리포트 출력 형식을
  바꿨다면 대화에서 사용자가 명시적으로 승인했는가?
- **Article 7/8/9 (Single Responsibility / Dependency / Import Rule)**: 비즈니스 로직이 Master
  Build 단계 밖(Report/Import/Writer)으로 새어나가지 않았는가? 새 Report가 `Leads_Master`/
  `MTA_Master`를 직접 읽지 않고 `Leads_OPS`를 거치는가(`docs/OperationsLayer.md` 원칙)?
- **Article 10 (Performance)**: 행 단위 `setValue()`/`appendRow()` 반복 호출이 있는가(배치
  `setValues()`/`setValues()` 원칙 위반)?
- **Article 11 (Config Centralization)**: `00_Config.js`(`CONFIG`)를 거치지 않은 매직 넘버/시트명이
  새로 들어갔는가?
- **Article 13 (Error Handling)**: 조용히 무시되는 catch, 부분 저장(partial save) 위험이 있는가?
- **Change Log 내용 검증**: version header가 "존재"하는지는 스크립트가 이미 확인하므로, 여기서는
  그 내용이 실제 코드 변경을 정확히 설명하는지만 추가로 본다.

**출력 형식**: 파일:라인 단위 한글 불릿 리스트로 짧게. 문제 없으면 "발견된 이슈 없음"이라고
명확히 말한다. 별도 findings tool은 쓰지 않는다(이 스킬 전용 텍스트 출력).

## Mode 2 — 데이터 정합성 갭 체크

**대상**: `Leads_Master`/`MTA_Master`/`Leads_OPS`에 영향을 주는 merge/transform 로직 변경.

1. 변경된 로직이 새 필드/새 조인 키/새 dedup 기준을 도입했는지 확인한다.
2. `24_OPSQA.js`의 기존 체크 목록과 대조해서, 이 변경이 기존 체크로 커버되는지 판단한다.
3. 커버 안 되는 갭이 있으면 — **조용히 새 체크 함수를 추가하지 않는다.** 갭을 설명하고, `24_OPSQA.js`의
   기존 패턴(`checkXxx_()` + `runOPSQA_()`에 배선하는 구조)을 따르는 새 체크를 제안한 뒤 사용자
   승인을 받는다.
4. **배선 무결성 확인**: `runLeadsPipelineTail()`/`runMTAPipelineTail()`/`buildLeadsOPS()` 등에서
   QA/자동삭제 함수 호출이 최근 리팩터링 중 조용히 빠지지 않았는지 grep으로 확인한다. 이 프로젝트는
   Apps Script 전역 함수 이름이 파일 간 겹치면 나중에 로드된 정의가 조용히 덮어쓰는 특성이 있어
   (`docs/apps-script-gotchas.md` 참고), 이런 배선 누락이 실제로 반복 발생한 사고 패턴이다
   (`docs/OpenItems.md` #20 근본 원인 중 하나).

## Mode 3 — 리포트 값 검증 (가이드형, 사람 개입 필수)

라이브 시트를 읽을 수 없으므로, 이 모드는 항상 다음 순서로 진행하고 마지막엔 사용자의 실행
결과를 기다린다:

1. 어떤 리포트인지 확인하고, 관련 설계 문서(`docs/ACQReportDesign.md` / `docs/NewP1ReportDesign.md` /
   `docs/TargetReportDesign.md` / `docs/FYReportDesign.md`)를 읽어 의도된 공식과 소스오브트루스를
   파악한다.
2. 사용자가 비교 기준으로 삼는 외부 소스(Salesforce 리포트 export, `[KOR] Deal Tracking` 등)를
   확인한다.
3. 같은 비교를 이미 하는 진단 함수가 있는지 먼저 찾는다 — `9X_TempQA_*.js` 파일들, 각 Engine
   파일(`30_ACQReport.js`/`40_NewP1Report.js`/`90_TargetEngine.js`/`FYREP_001_Engine.js` 등)의
   `runInvestigate*`/`runDiagnose*`/`runCheck*`/`runDebug*`/`runDump*`/`runList*` 함수들. 있으면
   재사용한다.
4. 없으면 `9X_TempQA_*.js` 네이밍/버전헤더 컨벤션을 따르는 새 진단 함수를 작성한다 — **읽기 전용
   집계 + `Logger.log` 출력만**, 자동 수정/자동 삭제는 절대 하지 않는다. 함수명이 `run`으로
   시작하고 `_`로 끝나지 않는지 반드시 확인한다(`docs/apps-script-gotchas.md` #2).
5. CLAUDE.md의 "Manual Execution Instructions" 원칙대로 **파일명 + 함수명을 함께** 명시해 사용자에게
   실행을 요청한다. 결과가 올 때까지 완료로 간주하지 않는다.
6. 붙여넣은 값과 기대값을 비교한다. 불일치 시, 이 프로젝트에서 반복적으로 확인된 원인 패턴부터
   먼저 점검한다: merge/dedup 순서(earliest-wins 등), 타임존 불일치(스크립트 vs 외부 시트),
   FX/환율 처리, 코호트(Created Date) vs 이벤트(Close/Booked Date) 기준 혼동, 재신청/재중복 append.
   원인을 특정하기 전에는 "버그로 추정"과 "확정"을 구분해서 말한다.

## 부수 원칙

- 이 스킬 자체(`.claude/skills/qa-review/`)는 Apps Script `.js` 파일이 아니므로 Engineering
  Constitution의 TDD/버전헤더 요구사항 대상이 아니다.
- 이 스킬이 새 Apps Script 진단 함수를 작성하게 되는 경우(Mode 3 4단계), 그 함수는 이 프로젝트의
  일반 규칙(네이밍, 버전 헤더, Config 중앙화 등)을 그대로 따라야 한다 — 스킬 자체는 예외지만
  스킬이 만드는 산출물은 예외가 아니다.
