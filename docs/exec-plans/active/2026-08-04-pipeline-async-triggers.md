# 백엔드 실행 체인 트리거 비동기화

**관련 로드맵 항목**: `docs/OpenItems.md` #9 (2026-07-28 설계 확정)
**시작일**: 2026-08-04

## Goal

`appendNewLeads()`/`appendNewMTA()`(`07_IncrementalMasterBuild.js`)가 Raw→Master append 직후
무거운 refresh 체인(buildLeadsOPS/syncMTAFunnelToOPS_/ACQ·NewP1·Events·BOFU·Search·Content
Engine·Target Actuals)까지 같은 실행 안에서 동기로 처리해 브라우저 다이얼로그가 몇 분씩 안
닫히는 문제(2026-07-25 실측, `docs/apps-script-gotchas.md` #5)를 해소한다. Import는 동기로 빠르게
끝내고, refresh 체인은 설치형 1회성 time-based 트리거로 백그라운드 처리 — 사용자가 완료를
기다리지 않아도 되게 한다.

## Progress

- [x] 세션 시작 시 로컬이 origin보다 3커밋 뒤처짐 발견(Naver Search Ad API, Kakao Channel spend
      pipeline) — fast-forward pull로 동기화 완료(이 작업과 무관한 별도 초기화).
- [x] 설계 확인 — `docs/OpenItems.md` #9(2026-07-28 확정 사항) 재확인, 미확정이던 3가지를 이번
      대화에서 사용자에게 확인:
      - README 탭 실제 시트명: `"README"` (이모지 없음)
      - Pipeline Status 블록 anchor: README!A1부터 7행×3열, 최초 1회만 `insertRowsBefore`로
        공간 확보 후 이후엔 덮어쓰기만
      - 블록 레이아웃: 라벨(A열) × Leads/MTA(B/C열) — Status/Current Stage/Last Started/
        Last Finished/Last Error
- [x] `00_Config.js` v1.24.0 — `SHEETS.README`, `PROPERTIES.PIPELINE_LOCK`/
      `PIPELINE_LAST_FAILED_TYPE`/`PIPELINE_STATUS_LEADS`/`PIPELINE_STATUS_MTA`, `PIPELINE`
      블록(`TYPES`/`TRIGGER_DELAY_MS`/`STATUS_ANCHOR_ROW`/`STATUS_ANCHOR_COL`) 추가.
- [x] `08_PipelineAsync.js` v1.0.0 신규 구현 — 순수 함수(`computePipelineLockState_`/
      `buildPipelineStatusGrid_`, `testXxx()` 페어 포함) + IO 래퍼(락/트리거/상태 JSON/README
      쓰기) + `runLeadsPipelineTail()`/`runMTAPipelineTail()`(트리거 대상 + 수동 재실행 진입점)
      + `runRetryPipelineTail()`(수동 전용 재시도 진입점).
- [x] `07_IncrementalMasterBuild.js` v1.5.0 — `appendNewLeads()`/`appendNewMTA()`의 Raw→Master
      append/sort/카운터 갱신은 그대로 두고, 그 이후 refresh 체인 직접 호출을 락 확인 +
      `schedulePipelineTail_()`로 교체. 락 충돌 시 Master append만 반영하고 알림 후 종료(다음
      정상 실행 때 재계산되므로 데이터 손실 없음, idempotent).
- [x] Node vm 하네스로 `testComputePipelineLockState`/`testBuildPipelineStatusGrid` 전부 PASS.
- [x] `scripts/check-syntax.sh`/`check-naming.sh`/`check-duplicate-declarations.sh`/
      `check-version-header.sh` 전부 통과(staged 기준 재검증).
- [x] `clasp push`(`scripts/safe-clasp-push.sh` 경유) — 1차 구현분 push 완료.
- [x] **실 시트 1차 테스트 피드백(2026-08-04, 사용자)** — `appendNewLeads()` 실행 결과 "32건
      반영, 백그라운드 처리 시작" 알림은 정상 수신. 이어서 3가지 이슈 제기:
      1. README Pipeline Status 범위가 기대(A1 근처)와 다르게 보임("A7:C7"로 보인다는 보고) —
         원인 미확인, 사용자에게 정확한 셀 참조(Name Box) 확인 요청, 답변 대기 중.
      2. 상태 표시에 빈 칸이 많음 — PENDING 상태에서는 stage/startedAt이 의도적으로 빈 문자열
         (설계상 정상), 다만 트리거가 실제로 실행됐는지(RUNNING/DONE 전환 여부) 확인 필요 —
         Executions 로그 확인 요청, 답변 대기 중.
      3. **스코프 확장 요청**: Import(📥 Update)를 실행하면 Append를 별도로 누르지 않아도
         자동으로 Raw→Master Append까지 이어지길 기대했다는 피드백 — 기존 설계(#9)는
         `appendNewLeads()`/`appendNewMTA()`만 대상이었고 Import→Append 체이닝은 범위 밖이었음.
         AskUserQuestion으로 명시 확인 → "예, Import 끝나면 Append까지 자동 실행" 확정.
- [x] **Import→Append 자동 체이닝 구현(2026-08-04)** — `appendNewLeads()`/`appendNewMTA()`에
      옵셔널 `silent` 파라미터 추가(`buildLeadsOPS(skipQA)`와 동일 패턴, 기존 무인자 호출부는
      무변경이라 백워드 호환) — `silent=true`면 함수 내부 `SpreadsheetApp.getUi().alert()`를
      전부 스킵. `00_Import.js`의 `importCsv()`가 LEADS/MTA Raw 쓰기 직후
      `appendNewLeads(true)`/`appendNewMTA(true)`를 바로 호출, 신규 `formatAppendSummary_()`가
      append 결과(backgroundScheduled/backgroundSkipped/appended:0)를 업로드 다이얼로그 완료
      메시지에 이어붙임(중복 팝업 없이 메시지 하나로 통합). IC_FUNNEL은 대응 append 함수가
      없어 기존 "Master Append를 실행해주세요" 안내 문구 유지. `07_IncrementalMasterBuild.js`
      v1.6.0, `00_Import.js` v3.6.0. `node --check`/pre-commit 4종 전부 통과, `clasp push` 완료.
- [x] **README 범위 이슈 — 버그 아님, 확인 완료(2026-08-04)**: 사용자가 "⚙️ Pipeline Status"
      제목 셀을 직접 클릭해 Name Box 확인 → **A1**. 설계대로 정상 동작(빈칸/범위 모두 이슈
      없었음 — 이전 "A7:C7로 보인다"는 보고는 오인이었던 것으로 판단).
- [x] **`runLeadsPipelineTail()` 최초 실행 검증 완료(2026-08-04)**: Apps Script Executions
      로그 — Successful, **363.546초(6m 3.5s)** 소요. `docs/PerformanceBenchmark.md`에 실측치
      기록. Import(LEADS)→Append 자동 체이닝→트리거 백그라운드 refresh 전체 체인이 실 데이터로
      end-to-end 검증됨.
- [ ] 남은 검증(사용자, 급하지 않음): MTA 쪽(`appendNewMTA(true)`/`runMTAPipelineTail()`)은
      아직 실측 안 됨. 두 번 연속 실행 시 락 충돌 알림, (선택) 강제 실패 후
      `runRetryPipelineTail()` 재시도도 미검증.
- [ ] `docs/OpenItems.md` #9 상태 갱신(남은 검증 완료 후, 또는 사용자가 "이 정도면 충분" 확인 시)
- [x] **README 표시 개선(2026-08-04, 사용자 피드백)**: (1) Last Started/Finished가 스크립트
      타임존(America/New_York) 기준으로 찍혀 KST로 오인 — `CONFIG.DATE.DISPLAY_TIMEZONE`
      ("Asia/Seoul") 신규 도입 + " KST" 표기 추가. (2) 헤더 라벨 "Leads"/"MTA" →
      "New Leads Upload"/"MTA Upload"로 변경. `08_PipelineAsync.js` v1.1.0.
- [x] **ACQ_REP/NewP1_REP FY 드롭다운 자동 갱신 스코프 추가(2026-08-04)** — 8월 진입(FY26→FY27)
      데이터가 들어왔는데도 Start/End FY 드롭다운에 "FY27"이 안 보인다는 사용자 보고 → 원인 확인:
      `setupACQDropdowns()`(30_ACQReport.js)/`setupNewP1Dropdowns_()`(40_NewP1Report.js)는
      원래 "1회성 수동 실행" 설계(문서 3곳에서 확인, 자동 갱신 근거 없었음) — 사용자가 실사용
      경험 기준으로 "새 FY 데이터 들어오면 자동 갱신"을 원한다고 확정, 스코프 추가. 신규
      `refreshReportFYDropdowns_()`(08_PipelineAsync.js v1.2.0)를
      `runLeadsPipelineTail()`/`runMTAPipelineTail()` 마지막 단계로 추가 — 두 setup 함수 모두
      데이터 검증 규칙/체크박스만 재적용(셀 값은 안 건드림)이라 반복 호출 안전. 관련 문서
      (`docs/ACQReportImplementation.md`, `docs/NewP1ReportDesign.md`)의 "1회성 수동 실행"
      문구도 최신화.
- [x] **ACQ_REP/NewP1_REP Report Generate까지 백그라운드 체인에 편입(2026-08-04)** — 사용자가
      "Report도 백그라운드 체인에 refresh 포함시킬 수 있냐"고 요청. `generateACQReport_()`/
      `generateNewP1Report_()` 둘 다 onEdit 이벤트 객체와 무관하게 동작해 직접 호출 가능함을 확인.
      **실패 격리 방식 사용자 확정**: Control 행 Start FY > End FY 등으로 Report Generate가 실패해도
      전체 파이프라인은 FAILED로 만들지 않고 Logger에만 기록(OPS/Engine/Target 갱신은 이미 끝난
      뒤라, Report 실패 때문에 6분짜리 핵심 refresh를 통째로 재실행하게 만드는 게 배보다 배꼽 큰
      상황이라는 판단). 신규 `refreshReportGenerate_()`(08_PipelineAsync.js v1.3.0, 각 Generate
      호출을 독립 try/catch로 감쌈)를 `refreshReportFYDropdowns_` 바로 다음 마지막 단계로 추가.
      Generate 체크박스(`onEdit`)는 즉시 재생성이 필요할 때 쓰는 수동 경로로 계속 유효 — 관련 문서
      (`ACQReportImplementation.md`, `NewP1ReportDesign.md`)도 갱신.
- [x] **완전 동일 중복 자동삭제도 백그라운드 체인에 편입(2026-08-04)** — 사용자 요청. 기존
      `runAutoDeleteExactDuplicateLeadRows()`/`runAutoDeleteExactDuplicateTouchRows()`(24_OPSQA.js,
      2026-07-28 구현·검증 완료했지만 "실데이터 검증 전까지는 수동 Run" 방침으로 자동 체인엔
      배선 안 돼 있었음)를 각각 `runLeadsPipelineTail()`/`runMTAPipelineTail()`의 **첫 단계**로
      추가(08_PipelineAsync.js v1.4.0) — `buildLeadsOPS`/`syncMTAFunnelToOPS_`보다 먼저 실행해
      OPS/Engine이 중복 제거된 Master를 기준으로 계산되도록 순서 배치. 두 함수 모두
      `SpreadsheetApp.getUi()` 미사용(Logger만 사용)이라 설치형 트리거에서 안전함을 소스로 확인.
      **범위 명확화**: QA 전체(`runOPSQA_()`, Funnel Match 등 다른 검사 포함, ~2분)는 여전히
      `skipQA=true`로 스킵 — 이번 변경은 완전 중복 삭제 단독 기능만 포함(QA 재활성화 여부는
      `docs/OpenItems.md` #9의 별개 미결 사항). 2026-07-28 실측 기준 MTA 중복 삭제는 건수가 많으면
      최대 ~5분 추가 소요될 수 있음(294건 삭제 시 실측) — 평소엔 중복이 거의 없어 순식간.
      `24_OPSQA.js` v1.5.0, 관련 함수 상단 주석/`docs/OpenItems.md` #8·#13도 갱신.

## Surprises & Discoveries

- 설계 문서 원안의 `runLeadsPipelineTail_()`/`runMTAPipelineTail_()`이라는 이름 표기는 오탈자성
  설계 실수였음 — CLAUDE.md 핵심 원칙("test/run 진입점은 `_`로 끝나면 안 됨")과 정면 충돌.
  구현 시 `_` 없이 `runLeadsPipelineTail()`/`runMTAPipelineTail()`로 바로잡음.
- 구현 중 내부 헬퍼 `runPipelineStage_()`를 새로 만들었는데, pre-commit `check-naming.sh`가
  "run으로 시작 + `_`로 끝남" 패턴을 진입점 오탈자로 감지해 커밋을 막음 — 실제로는 진입점이
  아닌 내부 헬퍼였지만 이름이 "run"으로 시작해 발생한 오탐. `advancePipelineStage_()`로 개명해
  해결. 앞으로 내부 헬퍼 이름에 "run"/"test" 접두어를 쓰지 않는 편이 이 훅과 마찰이 없음.
- `09_MTAFunnelSync.js`의 `syncMTAFunnelToOPS_()`가 이미 자체적으로 ACQ/NewP1/Events/BOFU/
  Search/Content Engine + Target Actuals refresh 전체를 끝에 포함하고 있어서, MTA tail은 그
  함수 호출 1건으로 충분 — `09_MTAFunnelSync.js` 자체는 수정 불필요.

- **트리거 실행 시간이 기존 동기 체인과 비슷한 규모(6분대)임을 확인** — 백그라운드로 옮긴다고
  체인 자체가 빨라지는 건 아니고(같은 로직, 같은 데이터량), 목적은 어디까지나 "브라우저를
  막지 않는 것"이었음을 실측으로 재확인(`docs/PerformanceBenchmark.md` 2026-07-25 전체
  Rebuild 5~8분대 기록과 같은 자릿수).

## Decision Log

- **PropertiesService 기반 단순 락, `LockService` 미도입**: 저장소 전체에 `LockService` 전례가
  없고, 사용자가 2026-07-28에 이미 "단순 락 — 겹치면 두 번째 시도 거부, 자동 대기열 없음"으로
  확정. 기존 `LEADS_LAST_ROW`/`MTA_LAST_ROW`와 동일한 PropertiesService 패턴 재사용.
- **README Pipeline Status 블록 anchor = A1, 최초 1회만 insertRowsBefore**: 사용자가 정확한 셀
  범위를 요청 — 7행×3열 스펙을 먼저 제시하고 anchor 위치(A1)와 시트명("README")을
  AskUserQuestion으로 확인받음(No Assumptions 원칙, 시트명은 추측 시도 없이 직접 확인).
- **실패 시 상태 기록 후 rethrow 유지**: README에 FAILED 상태를 명시적으로 기록하는 것과 별개로,
  에러를 다시 throw해 Apps Script 기본 트리거 실패 메일도 안전망으로 유지(Article 13, 조용한
  실패 금지).

- **Import→Append 자동 체이닝으로 스코프 확장(2026-08-04)**: 원래 #9 설계는
  `appendNewLeads()`/`appendNewMTA()`의 refresh 체인만 비동기화 대상이었고 Import는 계속 별도
  수동 클릭으로 남는 게 전제였음(2026-07-28 확정 범위). 1차 구현을 실제로 써본 사용자가 "Import
  끝나면 Append까지 자동으로 이어지길 기대했다"는 피드백을 줘서 AskUserQuestion으로 명시
  재확인 후 스코프 확장 — Import는 여전히 사용자가 직접 누르지만, 그 이후 Append는 자동.

## Outcomes & Retrospective

(작업 완료 시 작성)
