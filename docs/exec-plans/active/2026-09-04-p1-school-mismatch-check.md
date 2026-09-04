# P1 School Mismatch 검출/플래깅 (#48)

**관련 로드맵 항목**: `docs/OpenItems.md` #48 (2026-09-03 등록)
**시작일**: 2026-09-04
**상태**: 코드 작성 + clasp push + 수동 실행/육안 검증 전부 완료(2026-09-04) —
남은 건 실제 Leads Import 1회로 파이프라인 자동 편입 단계 확인뿐.

## Goal

외부 "P1 School List" 스프레드시트(담당팀이 P1으로 확정한 학교 목록, 오기입 변형 표기 포함)와
Leads_OPS를 매 Leads Import마다 자동으로 대조해, 리스트엔 P1 학교로 등록돼 있는데 파이프라인
상 effective Priority가 다르게 지정된 리드를 시트에 플래깅한다(이메일 알림 없음).

## 사용자 확정 사항 (2026-09-04)

- **알림 수단**: 시트 내 플래깅(이메일 없음)
- **실행 주기**: Leads Import 백그라운드 파이프라인에 편입(독립 시간 트리거 아님)
- **외부 시트**: `https://docs.google.com/spreadsheets/d/15OVBIzK40s7a2mOCPDs9mrINpS9MUFrUse02KtQqW4Q`
  탭 "P1 School List" — 실제 데이터는 4행부터(1~3행 헤더/안내), E열이 대표 학교명, N열부터는
  "시스템적으로 사용자가 오기입해서 다른 학교로 분류되는" 같은 학교의 변형 표기(행마다 개수
  다를 수 있음, 있는 만큼 전부 포함해야 함).

## Progress

- [x] 식별 키 확인 — School Name(Leads_OPS 기존 컬럼) 기준, Lead ID/Email 아님
- [x] `isEffectiveP1_()`(ACQREP_001_Report.js, Priority Override 우선 판정) 재사용 확인 —
      새로 만들지 않음
- [x] `OPS_001_Config.js`(v2.8) `OPS.P1_SCHOOL_MISMATCH` 신규 — EXTERNAL(스프레드시트
      ID/탭명/DATA_START_ROW=4/SCHOOL_COLUMN=5(E)/ALIAS_START_COLUMN=14(N)),
      OUTPUT_SHEET("P1_School_Mismatch_QA")
- [x] `OPS_007_P1SchoolMismatch.js` 신규(v1.0.0) — opener, reader, 순수 함수 2개
      (`computeP1SchoolNormalizedSet_()`/`computeP1SchoolMismatches_()`, 둘 다 node로
      단위 테스트 PASS 확인), writer, 오케스트레이션(`performP1SchoolMismatchCheck_()`),
      실패 격리 래퍼(`checkP1SchoolMismatch_()`, `refreshCampaignSpend_()`와 동일 원칙),
      수동 진입점(`runCheckP1SchoolMismatch()`)
- [x] `MASTER_002_PipelineAsync.js`(v1.28.0) `runLeadsPipelineTail()`의 `buildLeadsOPS`
      직후에 `checkP1SchoolMismatch_()` 단계 추가
- [x] `Leads_OPS_QA`(OPS_006_QA.js)와 소유권 분리 확인 — `runOPSQA_()`는
      `buildLeadsOPS(true)`로 매 자동 Import마다 스킵되므로 별도 결과 시트
      (`P1_School_Mismatch_QA`)로 분리, 서로 덮어쓰지 않음
- [x] `node --check` + `scripts/check-*.sh`(duplicate-declarations/naming/syntax/
      version-header) 전부 통과 — naming 체크에서 최초 함수명
      `runP1SchoolMismatchCheck_()`가 "run+trailing _" 패턴으로 걸림 →
      `performP1SchoolMismatchCheck_()`로 개명(실제 수동 Run 진입점은
      `runCheckP1SchoolMismatch()` 그대로 유지)
- [x] `scripts/safe-clasp-push.sh` 완료
- [x] **수동 실행 + 육안 검증 완료(2026-09-04, 사용자 확인)** — `runCheckP1SchoolMismatch()`
      실행 결과: "P1 학교 572개(별칭 포함) / Leads_OPS 36628건 대조 — 불일치 2116건
      P1_School_Mismatch_QA에 기록", 에러 없음. 사용자가 상위 10건 육안 대조 —
      "전부 있는학교 맞아"(School Name 매칭 정확도 확인, 오탐 없음). 불일치 건수(2116/36628,
      약 5.8%)는 오래 누적된 미교정 리드로 판단, 매칭 로직 문제 아님.
- [ ] **남은 검증**: 실제 Leads Import 한 번 실행해 `runLeadsPipelineTail()`의
      `checkP1SchoolMismatch_` 단계가 자동으로 정상 동작하는지 확인(README Pipeline
      Status 또는 Execution 로그) — 지금까지는 수동 진입점(`runCheckP1SchoolMismatch()`)
      만 검증됨, 파이프라인 자동 편입 자체는 아직 실측 전.

## Surprises & Discoveries

- 외부 리스트가 단순 "학교명 컬럼 1개"가 아니라 "대표 학교명(E) + 가변 개수의 오기입 변형
  표기(N열부터)" 구조 — 애초 예상(단일 컬럼 목록)과 달라 순수 함수 설계를 "행 배열 순회 +
  index 기반 필터"로 일반화해야 했음(고정 컬럼 수 가정 불가, 행마다 다를 수 있음).
- 매칭 키가 Lead ID/Email이 아니라 School Name이라는 점 — 여러 리드가 같은 학교를 공유하므로
  "학교 단위 P1 지정"이 "리드 단위 Effective Priority"와 다를 수 있다는 게 이 기능의 핵심
  전제. School Name이 아예 없는 리드(빈 값)는 애초에 매칭 대상에서 제외(정상 동작으로 설계).

## Decision Log

- **`Leads_OPS_QA`에 통합하지 않고 전용 시트로 분리** — `runOPSQA_()`가 `buildLeadsOPS(true)`
  (skipQA=true)로 매 자동 Import마다 스킵되는 게 확인됨(OpenItems #9) — 같은 시트를 쓰면
  이 체크와 수동 `runOPSQAManual()`이 서로의 전체 재작성을 지울 위험이 있어 분리.
- **effective Priority 판정은 `isEffectiveP1_()` 재사용, 새로 구현 안 함** — Priority
  Override가 있으면 그 값을 우선하는 기존 규칙을 그대로 따름(마케팅이 이미 수동으로 P1
  교정을 걸어둔 리드까지 다시 플래깅하면 소음이 됨).
- **매 실행마다 결과 시트 전체 재작성(이력 누적 안 함)** — 교정되면 다음 실행에서 자동으로
  목록에서 빠지는 게 "지금 당장 조치가 필요한 리드" 목록으로서 더 유용하다고 판단(과거 이력이
  필요하면 별도로 Changelog/시트 버전 기록에서 추적 가능).

## Outcomes & Retrospective

(미착수 — clasp push 및 실 Import 검증 이후 작성)
