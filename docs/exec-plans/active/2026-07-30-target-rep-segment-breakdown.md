# Target_REP 세그먼트 구조 전면 분해 (3그룹 → 5세그먼트)

**관련 로드맵 항목**: `docs/Roadmap.md` End Goal Phase 2 (선행 착수 — 원래는 Phase 1 이후 순서였으나
세그먼트 구조 부분만 먼저 진행하기로 사용자 결정, 2026-07-30)
**시작일**: 2026-07-30

## Goal

`Target_REP`/`Target_Engine`의 리포트 축을 현재의 3개 추상화 그룹(events=Seminar+Webinar,
contact=BOFU+Search, content=Content)에서 **5개 실제 Business Segment**(Seminar, Webinar,
BOFU, Search, Content — Referral/Other는 계속 제외)로 분해한다. New P1 Target/Pipeline P1
Target/실적은 이번 phase에서 완성. CPNP1은 사용자가 직접 취합해 수동 입력하는 세그먼트별 Spent를
기준으로 계산(자동 캠페인 데이터 연동은 `docs/Roadmap.md` Phase 1로 별도).

## Progress

- [x] 현재 구조 파악 완료 — `docs/TargetReportDesign.md` §2~9, `00_Config.js` CONFIG.TARGET,
      `90_TargetEngine.js`의 `deriveTargetGroup_()`/`classifyDealSegment_()` 확인
- [x] 세그먼트 범위 확정 (Referral/Other 제외, 5개만)
- [x] CPNP1 처리 방식 확정 (수동 입력 Spent 기반, Target_Engine 보존 영역 확장)
- [x] CONFIG.TARGET.SEGMENT_GROUPS/GROUP_ORDER를 5개 세그먼트로 재정의(`00_Config.js` v1.13.0)
- [x] Target_Engine Block A/B/C/D 계산 로직 일반화(`90_TargetEngine.js` v1.16.0) —
      `computeBenchmarkBlockRows_()`/`computeP1ValueBlockRows_()`는 이미 GROUP_ORDER 동적 순회라
      코드 변경 불필요(설정만 반영)했고, `{events:0,contact:0,content:0}` 하드코딩 리터럴은
      `computeDealShareRatiosFromDealRows_()`/`computeDealShareRatiosCohort2FromDealRows_()/
      computeDealCohortsFromDealRows_()`에서 발견해 GROUP_ORDER 기반 동적 초기화로 수정
- [x] 세그먼트별 월별 수동 Spent 입력 영역 + FY26 세그먼트별 CPNP1 벤치마크(스칼라) + 월별
      회사 전체 Revenue Target/Budget을 Target_Engine Block 0에 신규 추가(보존형) —
      `readTargetEngineInputs_()`/`setupTargetEngineInputDefaults_()` 전면 재작성,
      신규 `setupTargetEngineMonthlyGridDefaults_()`
- [x] Config/Engine 레이어 Node 하네스 검증 완료(2026-07-30) — 순수 함수 테스트 12개 전부 PASS,
      Block 0 읽기/쓰기 왕복(사용자가 준 실제 월별 Revenue Target $13,558,380/Budget 수치 포함)
      전부 정확히 일치 확인. 상세는 아래 "검증 방법" 참고.
- [ ] **CPNP1_FYS 자동 채널시트 집계는 잠정 중단** — `BENCHMARK.CPNP1_FYS/WEIGHTS`를 빈 배열로
      전환, `computeCombinedSpentByGroupFYMonth_()`에 조기 반환 추가. Phase 1(캠페인 데이터
      자동 연동) 완료 후 재검토.
- [ ] **예산 기반 신규 도출 체인(5단계, Decision Log 참고)은 미구현** — Deal Share 트랙 선택(R1/R2),
      "실질적 조정" 메커니즘 등 세부 확정 후 `computeTargetDerivationRows_()` 등에 반영 필요
- [ ] `91_TargetReport.js`/`92_TargetStyles.js` — 그룹당 컬럼 반복 구조를 3그룹에서 5세그먼트로
      확장 (레이아웃 변경, 이번 라운드 미착수 — **이게 안 되면 `runGenerateTargetReport()`가
      제대로 동작하지 않음**, 다음 세션 최우선)
- [ ] 실 시트로 `runGenerateTargetReport()` 실행 검증 (Report/Styles 작업 완료 후)
- [ ] `clasp push`는 Report/Styles까지 끝나서 전체 체인이 실제로 동작할 때까지 보류
      (Engine만 배포하면 Report가 깨진 상태로 라이브에 반영되는 위험)

### 검증 방법 (2026-07-30, Node 하네스)

Apps Script는 로컬 실행이 안 되므로, `vm` 모듈로 `SpreadsheetApp`/`Utilities`/`Session`/`Logger`를
스텁 처리한 뒤 `00_Config.js`+`16_TransformHelper.js`+`90_TargetEngine.js`를 그대로 로드해 두 가지를
검증:
1. 기존/신규 `testXXXX()` 함수 12개를 그대로 호출 — 전부 `✅ PASS`(Logger 출력 파싱으로 판정)
2. `getRange`/`getValues`/`setValues`를 흉내내는 가짜 in-memory 시트 객체로
   `setupTargetEngineInputDefaults_()` → `readTargetEngineInputs_()` 왕복 호출 — 라벨/행 배치가
   의도대로(스칼라 1~12행, CPNP1 벤치마크 14~19행, 월별 회사 입력 21~23행, 세그먼트별 Spent
   25~30행) 정확히 나오는지, 실제 사용자 제공 수치(월별 Revenue Target/Budget)를 넣었을 때
   합계·개별 값이 기대대로 나오는지 확인.
스크래치패드에 남긴 하네스 스크립트는 세션 종료 시 자동 정리 대상(레포에는 커밋 안 함).

## Surprises & Discoveries

- Deal Tracker의 "Segment" 컬럼(및 Leads_OPS의 "Business Segment" 컬럼)은 **이미 세그먼트 7개
  전체 단위로 데이터가 존재**함 — `classifyDealSegment_()`가 호출하는 `deriveTargetGroup_()`이
  그걸 3그룹으로 축소하는 매핑 함수 하나일 뿐이었음. 즉 New P1/Pipeline P1 Target 계산은 데이터
  자체는 이미 세그먼트 단위로 준비돼 있고, 그룹 정의(`CONFIG.TARGET.SEGMENT_GROUPS`)와 그걸
  소비하는 집계 코드만 일반화하면 됨 — 새로운 데이터 소스가 필요 없었음.
- 반면 CPNP1의 분자(Spent)는 외부 채널시트가 `event/contact/lead` 3그룹 단위로만 나뉘어 있어
  Seminar/Webinar, BOFU/Search 세부 분리가 안 됨 — 이 부분만 자동화 데이터가 없어 수동 입력으로
  임시 대체하기로 함(아래 Decision Log).

## Decision Log

- **세그먼트 범위**: Referral/Other는 계속 제외, 5개(Seminar/Webinar/BOFU/Search/Content)만 분해
  (2026-07-30 사용자 확정) — 기존 제외 사유(영업 직접 발굴/캐치올 성격, 마케팅 타겟 대상 아님)는
  그룹 세분화와 무관하게 유지.
- **CPNP1 Spent 소스**: 세그먼트별 자동 채널 데이터가 없는 동안은 사용자가 직접 취합한 Spent 값을
  Target_Engine에 수동 입력하는 방식으로 임시 대체 (2026-07-30 사용자 확정). 이 입력 영역은
  Block 0(Input, 절대 덮어쓰지 않는 보존형 영역)과 같은 성격으로 취급 — "실무자 설정 영역"으로
  앞으로도 유지.
- **수동 Spent 입력 그레인**: 월별 × 5세그먼트로 확정 (2026-07-30 사용자 확정) — 기존 CPNP1
  월 단위 체계(§7 벤치마크, §8 Actual)와 그레인 일치.
- **CPNP1 벤치마크**: 당분간 공란 (2026-07-30 사용자 확정) — 소급 입력 안 함, 이번 타겟 FY부터
  실적만 채움. 과거분은 `docs/Roadmap.md` Phase 1(캠페인 시트 자동 연동) 완료 시 자동으로 채워질
  것이므로 지금 수동 소급 입력에 시간 안 씀.
- **수동 Spent 입력 영역 위치**: 특정 컬럼(A:B)에 국한하지 않음 — Block 0 안에서 필요한 만큼
  범위를 잡아도 됨(2026-07-30 사용자 확정, "너무 좁게 두지 말자").
- **Target_Engine 표시 서식**: 전체 숫자 천단위 콤마(`#,##0`), `$`/`%` 값은 소수점 2자리까지
  (`$#,##0.00` / `0.00%`) — 2026-07-30 사용자 확정.

## Surprises & Discoveries (계속)

- **`computeBenchmarkBlockRows_()`(Block A)는 이미 `CONFIG.TARGET.GROUP_ORDER`를 동적으로
  순회**하도록 짜여 있어 그룹 수가 3→5로 바뀌어도 이 함수 자체는 코드 수정 불필요 — Config만
  바꾸면 자동으로 5그룹×12개월 행을 만든다.
- **`computeCPNP1RatioByFYMonth_()`는 "지출 데이터 없음"과 "지출 0원"을 구분하지 못함**
  (`spentMonths[month] || 0`) — 과거분을 공란으로 두려면 이 함수를 `hasOwnProperty` 체크로
  고쳐야 함(그렇지 않으면 데이터 없는 달이 CPNP1 벤치마크 $0으로 잘못 표시됨). **수정 완료**
  (2026-07-30).
- **기존 테스트에 방치된 잠재 버그 발견**: `testComputeDealShareRatiosCohort2FromDealRows()`가
  픽스처에 `contentCategory` 필드를 쓰고 있었는데 `classifyDealSegment_()`는 2026-07-28부터
  `businessSegment`만 읽으므로 전 행이 항상 분류 실패(unclassified) 상태였음 — 기댓값이
  우연히 결과와 맞아떨어져(0이 아니라 실제로는 계산 자체가 의미 없었던 것) 통과 판정만 되고
  있었음. `businessSegment`로 교정하며 발견·수정(2026-07-30).

## Decision Log (계속, 2026-07-30 — 예산/월별 실제 타겟 반영으로 설계 확장)

**배경**: 사용자가 작업 도중 월별 실제 Revenue Target(회사 전체, 12개 값, 합계≈$13.56M)과
월별 전체 광고 예산(Budget, 회사 전체·세그먼트 미분해, 12개 값, 합계≈$1.12M)을 제공 — 이는
Phase 2가 원래 지적한 "예산 정보 미반영" 문제의 실제 데이터. 기존 §6 공식 체인(연간 단일 Revenue
Target을 시즌성 벤치마크로 월별 배분)을 대체할 잠재력이 있어 설계가 확장됨.

- **월별 Revenue Target**: 기존 "연간 단일 값 + 시즌성 비중으로 월별 배분" 방식 대신, **이제
  월별 실제 값을 직접 받는다** — Block ②(월 P1 목표) 계산이 "FY 총 P1 목표 × 시즌성%"에서
  "그 달 실제 Revenue Target × Deal Share ÷ P1Value"로 바뀔 가능성. 세부 반영 방식은 아래
  "다음 확인 필요" 참고.
- **월별 예산(Budget)**: 사용자가 설명한 신규 도출 체인(2026-07-30):
  1. FY26 **세그먼트별** CPNP1 벤치마크를 만든다 (출처 미정 — 아래 열린 질문)
  2. 월별 전체 예산을 세그먼트 Deal Share 비율로 배분 → 세그먼트별 예상 예산
  3. 세그먼트 예산 ÷ 세그먼트 CPNP1 벤치마크 = 그 예산으로 데려올 수 있는 New P1 수("버젯 NP1")
  4. 버젯 NP1 × P1당 가치(PerNP1V) = 세그먼트 Revenue 프로젝션
  5. "버젯 NP1"과 "벤치마크 NP1"(Block A 기존 New P1 벤치마크치)의 차이를 구해 실질적으로 조정
     — 예산이 벤치마크보다 커지면 CPL/CPNP1이 자연히 올라간다는 전제(선형 비례가 아님을 반영)
- **1번 해결(2026-07-30)**: FY26 세그먼트별(5개) CPNP1 벤치마크는 사용자가 **시트에 직접 입력**
  하기로 함(채팅으로 값을 받을 필요 없음) — Block 0에 세그먼트당 1개 스칼라 입력 셀(5개)만
  마련해두면 됨(위 "수동 Spent 입력"과는 별개 — 이건 월별이 아니라 세그먼트당 1개 값).
  - 이전에 "CPNP1 벤치마크는 당분간 공란"이라 결정했던 것과 겉보기엔 상충되지만, 실제로는 범위가
    다름 — 그 결정은 "Block A의 월별×FY 가중평균 자동 계산 체계"를 공란으로 둔다는 뜻이었고,
    지금 이 FY26 단일 벤치마크는 예산 기반 신규 도출 체인(위 5단계) 전용 별도 입력으로, Block A
    벤치마크 표 자체를 대체하지 않음.
  - **미해결(다음 세션 확인)**: 2번의 Deal Share는 New 트랙(R1)인지 Pipeline(R2)인지, 아니면
    둘의 합/블렌드인지.
  - 5번의 "실질적으로 조정"이 고정 수식인지(예: 비선형 체감 함수), 아니면 매번 사람이 판단해서
    수동 보정하는 단계인지 — 후자라면 Engine이 자동 계산 안 하고 참고 수치만 보여주는 형태가
    될 수 있음.
  - 월별 실제 Revenue Target이 기존 §6 공식 체인(New/Pipeline 2트랙 분리, Deal Share 기반 FY
    목표 산출) 전체를 대체하는지, 아니면 그 체인의 "월 배분" 단계만 대체하는지.
- **이번 세션에서 실제로 진행한 것**: 위 설계 확장이 대화 중 발견되면서, 원래 계획했던 "Config
  변경 → Engine 함수 일반화" 착수를 잠시 보류 — 예산 체인 설계가 Block A/D 자체의 계산식을
  다시 바꿀 가능성이 커서, 코드부터 손대면 헛수고가 될 위험 판단(2026-07-30).

## Outcomes & Retrospective

(작업 완료 시 작성)
