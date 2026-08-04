# ACQ_REP / NewP1_REP에 Target 컬럼 추가

**관련 로드맵 항목**: `docs/Roadmap.md` "계획 중" §"FY별 Sales Funnel 대시보드 → ACQ_REP/NewP1_REP
Target 확장으로 방향 전환" (원래 `docs/FYReportDesign.md`로 별도 신규 리포트를 설계했으나
같은 세션에서 기존 리포트 확장으로 방향 전환)
**시작일**: 2026-07-30

## Goal

`ACQ_REP`와 `NewP1_REP`에 각각 Target/Target%(달성률) 컬럼을 추가해, 새 리포트를 만들지 않고도
세그먼트별 달성률을 확인할 수 있게 한다.

- **`ACQ_REP`**: Revenue Target/Target% + New P1 Target/Target% (둘 다 달성 시 하이라이트)
- **`NewP1_REP`**: New P1 Target/Target% + Spent + CPNP1(실적) (Target% 달성 시 하이라이트)

Pipeline P1 Target(구 코호트 딜의 이번 FY 전환분)은 이번 확장에서 **제외** — 실제 클로징 여부가
불확실한 영역이라 New P1(리드 생성 카운트) 목표와 성격이 다르다는 사용자 판단(2026-07-30).

## Progress

- [x] 방향 결정 — 신규 `FY_REP` 대신 기존 두 리포트 확장 (`docs/FYReportDesign.md` superseded)
- [x] Target 매핑 확정 — Revenue Target(ACQ_REP, Close Date 이벤트) / New P1 Target(양쪽,
      Create Date 코호트) / Pipeline P1 Target 제외
- [x] ACQ_REP New P1과 NewP1_REP New P1이 동일 소스(Leads_OPS `Business Segment` 컬럼, 재계산
      없음)임을 코드로 확인 — `docs/ACQReportDesign.md` "오해 방지" 섹션에 기록, 두 리포트에
      같은 Target을 붙여도 실적 불일치 없음
- [x] Target_Engine에서 재사용 가능한 값 확정 및 구현(`90_TargetEngine.js` v1.23.0) — Block C를
      읽는 리더가 없어서 `readTargetEngineDealShareRows_()` 신규(Block D 리더와 동일 패턴).
      순수 함수 `computeReportTargetLookupFromInputs_()`(Block 0 Revenue Target/Spent × Block C
      Deal Share(코호트1/R1) × Block D New P1 Target을 `targetFY|Month|Group` 키로 병합) + IO
      래퍼 `computeReportTargetLookup_()`. "타겟 없음"과 "타겟 0"을 hasOwnProperty로 구분(기존
      `computeCPNP1RatioByFYMonth_()` 관례 재사용).
- [x] ACQ_REP/NewP1_REP 구체 컬럼 설계 및 구현 완료(2026-07-30, **컬럼 위치는 실 시트 검증 중
      두 번째 충돌을 거쳐 최종 확정** — 아래 Surprises 참고):
      - **ACQ_REP**(`30_ACQReport.js` v1.10.0, `32_ACQReportStyles.js` v1.6.0, `00_Config.js`
        v1.20.0): **AH:AK열**(`CONFIG.ACQ.TARGET_COLUMNS_START_COL`=34) Revenue Target/Revenue
        Target%/New P1 Target/New P1 Target% 추가. 기존 A:N 헤더는 시트에 수동 입력된 값이라
        코드가 안 건드리지만, 새 AH:AK 헤더는 `generateACQReport_()`가 매번 다시 씀(멱등).
        하드코딩 `14` 리터럴을 `CONFIG.ACQ.REPORT_DATA_COLUMNS`로 교체. Target은 `ACQ_Summary`
        캐시가 아니라 리포트 생성 시점에 `computeReportTargetLookup_()`으로 직접 조회
        (Target_Engine 갱신 주기가 Master/OPS 갱신 주기와 다르므로 캐시 레이어에 안 섞음).
      - **NewP1_REP**(`40_NewP1Report.js` v1.3.0, `41_NewP1ReportStyles.js` v1.3.0): **O:R열**
        (`CONFIG.NEWP1.TARGET_COLUMNS_START_COL`=15, N열 하나 건너뜀) Spent/CPNP1/New P1
        Target/New P1 Target% 추가. `NEWP1_REPORT_HEADERS`(A:M, 13개)는 원래대로 유지, 신규
        `NEWP1_TARGET_HEADERS`(4개)를 별도 배열/range로 분리 — ACQ_REP처럼 두 range를 각각
        clear/write.
      - 하이라이트: `highlightAtOrAboveThreshold_()`(32_ACQReportStyles.js 신규, 기존
        `highlightAboveMedian_()`은 중앙값 기준이라 재사용 불가 — 100% 고정 기준) 신규,
        NewP1_REP 쪽은 GAS 전역 스코프로 재사용(중복 정의 안 함). Target% ≥100%면 `#C6E0B4`
        (ACQ_REP 기존 강조색) 하이라이트. 헤더 Note는 컬럼 위치가 두 번 바뀐 전례 때문에
        하드코딩 키 대신 `CONFIG.*.TARGET_COLUMNS_START_COL` 기준 상대 위치로 부착(재발 방지).
- [x] Node 하네스 검증(2026-07-30) — `testComputeReportTargetLookupFromInputs()` PASS,
      `90_TargetEngine.js`의 기존 test 20개 전부 회귀 없이 PASS(`node --check` 문법 검사 포함
      6개 수정 파일 전부 통과, 컬럼 재배치 후 재검증 포함). Apps Script 환경(SpreadsheetApp
      실제 호출) 검증은 아직 — 아래 "다음 단계" 참고.
- [x] 컬럼 위치 최종 확정 및 배포 — ACQ_REP은 S:V열, NewP1_REP은 N:Q열(사용자가 U:AF/N열
      수동 수식·내용을 직접 삭제하면서 원래 자리로 원복 가능해짐). `clasp push` 완료(실은
      이전 라운드에서 push 자체를 안 해서 옛 코드로 검증되고 있었던 게 뒤늦게 발견됨 —
      아래 Surprises "배포 누락 발견" 참고). 헤더 라벨은 양쪽 다 정상 표시 확인(사용자 확인).
- [x] 데이터 행 공란 원인 규명 — 버그 아님, `Target_Engine`이 FY27로 설정돼 있어 FY26
      행(사용자가 확인 중이던 실적 있는 해)과 매칭되는 Target이 원천적으로 없음(의도된
      hasOwnProperty 기반 공란 처리가 정상 동작한 것).
- [ ] **🔴 미해결(사용자 결정으로 보류, 2026-07-30)** — Target_Engine 단일 FY 구조 때문에
      ACQ_REP/NewP1_REP에서 "현재 진행 중인 해(FY26) 실적 vs 목표" 달성률을 보려면
      Target_Engine을 FY26으로 재생성해야 하고, 그러면 지금의 FY27 계획 입력값을 덮어써야
      하는 근본적 설계 충돌 발견. 사용자 판단: "타겟 설계를 바꿔봐야 할 것 같지만 지금은
      캠페인 구축이 먼저" — 재설계는 별도 세션에서. 상세는 아래 Surprises 참고.
- [x] `clasp push` 완료 — 이 exec-plan은 "검증 전 보류" 방침을 썼었으나, 그로 인해 배포
      누락을 오래 못 알아챈 사고가 있었음(위 참고) — 이후 이 프로젝트 원칙(CLAUDE.md
      "Clasp Push Pre-Authorized": 코드 수정 후 매번 바로 push)대로 정정.

## Surprises & Discoveries

- 처음엔 "ACQ_REP의 New P1은 First Touch 재계산, NewP1_REP은 Business Segment 컬럼 그대로라
  서로 다른 값이 나올 수 있다"고 잘못 판단했으나, `30_ACQReport.js`의 `computeOPSAggregates_()`를
  직접 읽어보니 `headers.indexOf("Business Segment")`로 **NewP1_REP과 동일 컬럼을 그대로**
  읽고 있었음 — `docs/ACQReportDesign.md`의 "Attribution 불일치" 표가 MTA_Master 기반 지표(All
  Leads/All P1/SAL, 진짜 다른 컬럼)와 Leads_OPS 기반 지표를 대조한 것인데, 이걸 "ACQ_REP vs
  NewP1_REP이 다르다"로 잘못 일반화했던 것. 교훈과 정정 내용은 `docs/ACQReportDesign.md`
  "오해 방지" 섹션(2026-07-30)에 기록.
- **컬럼 충돌 재발(같은 세션에서 두 번째)**: 처음 구현할 때 ACQ_REP 새 Target 4컬럼을 O열(15,
  기존 A:N 바로 뒤)부터 이어붙였는데, O:R이 이미 `CONFIG.ACQ.ENGINE_START_COL`(숨김 Engine
  영역 — `writeACQEngine_()`가 sortIndex/FY/Month/Segment를 쓰고 `hideColumns()`로 숨김)과
  정확히 겹치는 걸 실 시트 검증 전 **코드 리뷰 단계에서** 발견 — `docs/TargetReportDesign.md`/
  이번 세션 앞부분의 Target_Engine Block 0/Block A 충돌 버그와 똑같은 유형("새 블록을 기존
  블록 바로 뒤에 이어붙였는데 그 자리에 이미 다른 블록이 있었다")이 반복된 것. `docs/Roadmap.md`
  "End Goal 이후"에 이런 컬럼 배치 버그가 반복되고 있다는 패턴 자체를 기록해둘 가치가 있음 —
  새 컬럼 블록을 기존 시트에 추가할 때는 "바로 다음 컬럼"을 가정하지 말고 그 시트의 기존
  컬럼 사용 현황(숨김 컬럼 포함)을 먼저 확인할 것. 1차 수정: Target 4컬럼을 Engine 영역(O:R)
  뒤 S열(19)로 이동.
- **컬럼 충돌 재발(같은 세션에서 세 번째) — 이번엔 실 시트 검증에서 발견**: S열(19)로 옮긴
  버전을 실제로 `generateACQReport_()` 실행해봤더니 사용자가 "S:V는 비어있다"고 리포트 —
  원인은 U:AF(21~32열)이 **사용자가 시트에 직접 넣어둔 수동 수식/소계 영역**(코드 아님, 이
  프로젝트 코드베이스 어디에도 이 범위를 쓰는 함수 없음 — 전체 grep으로 확인)이었고, S:V(19~22)
  중 U:V(21~22) 부분이 정확히 겹쳤던 것. 같은 세션에서 NewP1_REP도 동일 패턴으로 재발 —
  N열(14)부터 이어붙였는데 N열도 사용자 수동 영역이라 "N:Q 안 나타남" 리포트. **최종 수정**:
  ACQ_REP은 U:AF 뒤로 버퍼 1칸 두고 AH열(34)로, NewP1_REP은 N열 하나만 건너뛰고 O열(15)로
  이동(`00_Config.js` v1.20.0 — `MANUAL_AREA_NOTE` 상수로 두 수동 영역 모두 문서화,
  `30_ACQReport.js` v1.10.0, `32_ACQReportStyles.js` v1.6.0, `40_NewP1Report.js` v1.3.0,
  `41_NewP1ReportStyles.js` v1.3.0 — NewP1_REP은 `NEWP1_REPORT_HEADERS` 배열 확장 방식을
  버리고 ACQ_REP과 동일하게 별도 range 분리 방식으로 재작성). 헤더 Note의 컬럼 키도 하드코딩
  숫자 대신 `CONFIG.*.TARGET_COLUMNS_START_COL` 기준 상대 위치로 바꿔 향후 위치가 또 바뀌어도
  Note가 깨지지 않게 함. **교훈**: 숨김 코드 영역뿐 아니라 사용자가 시트에 직접 넣어둔 수동
  영역도 "기존 컬럼 사용 현황"에 포함해서 확인해야 한다 — 코드 grep만으로는 못 잡음, 이런
  종류는 사용자에게 직접 물어보는 수밖에 없음(memory: `feedback_column_collision_check_before_appending`
  갱신 여지). NewP1_REP은 숨김 Engine 컬럼 충돌은 없었지만(Engine이 별도 시트) 사용자 수동
  영역 충돌은 똑같이 겪음 — "이 시트엔 숨김 Engine이 없으니 안전하다"고 판단한 것도 불완전한
  검증이었음.
- **컬럼 위치 원복(같은 세션, 네 번째 조정)**: 사용자가 U:AF/N열의 수동 수식/소계를 직접
  삭제한 뒤 "이제 옮겨도 된다"고 확인 — Target 컬럼을 원래 시도했던 위치로 되돌림: ACQ_REP은
  S열(19), NewP1_REP은 N열(14, A:M 바로 뒤, 간격 없음). `00_Config.js`의 `MANUAL_AREA_NOTE`는
  과거 기록으로만 남기고 실제 배치 회피 로직에서는 제거.
- **⚠️ 배포 누락 발견**: 컬럼 위치를 두 번(S:V→AH:AK) 수정하는 동안 실제로는 `clasp push`를
  한 번도 안 해서, 사용자가 계속 옛날 코드(Target 컬럼 자체가 없는 버전)로 실 시트 검증을
  하고 있었음 — "값이 안 나온다"는 리포트의 상당 부분이 이 때문이었을 가능성. 이후
  `scripts/safe-clasp-push.sh`로 push 완료, 이 세션에서는 코드 수정 직후 매번 push하는
  것으로 정정(CLAUDE.md "Clasp Push Pre-Authorized" 원칙 — 애초에 검증 전까지 보류하기로
  한 이전 exec-plan 결정을 이번 항목에 그대로 따른 게 오히려 혼란을 키움, 이 프로젝트
  기본값은 "수정 후 매번 바로 push"임을 재확인).
- **🔴 미해결로 남김 — Target_Engine 단일 FY 구조와 ACQ_REP/NewP1_REP 실적 비교의 근본적
  불일치**: 컬럼 위치를 고친 뒤에도 데이터 행이 전부 공란이길래 조사한 결과, `Target_Engine`이
  FY27(다음 해 계획용)로 설정돼 있는데 사용자가 확인한 ACQ_REP/NewP1_REP 행은 FY26(실적 있는
  현재 진행 중인 해)이라 애초에 비교할 Target 자체가 없는 게 원인 — 버그 아님, 설계상
  예상된 동작(§9 "다음 단계"에도 명시했던 제약). **문제는 이 제약이 기능 자체를 실질적으로
  무용하게 만든다는 것** — Target_Engine은 한 번에 FY 하나만 갖고 있어서, FY26 실적 대비
  달성률을 보려면 Target_Engine을 FY26으로 재생성해야 하는데 그러면 지금 입력해둔 FY27
  계획(Block 0 월별 Spent/Revenue Target 등)을 덮어써야 함. **사용자 결정(2026-07-30)**:
  지금은 그대로 두고 미해결로 남김 — "타겟 설계를 바꿔봐야 할 것 같은데, 캠페인 구축이
  먼저"라는 우선순위 판단. Target_Engine을 여러 FY 동시 지원 구조로 바꾸는 등의 재설계는
  이후 별도 세션에서 착수.

- **Pipeline P1 Target 제외**: New P1 Target(리드 생성 카운트, 확정적 과거 사실)과 달리
  Pipeline P1 Target은 "예전 코호트 딜이 이번 FY에 클로징될지"가 불확실한 영역이라 지금 붙이지
  않기로 함(2026-07-30 사용자 판단) — "과거 달의 New P1 미달성이 나중에 파이프라인이 클로징되며
  달성으로 둔갑하는" 혼란을 피함. Revenue Target(ACQ_REP, 이벤트 기준)은 어차피 New+Pipeline
  트랙 매출이 섞여서 잡히므로, New P1 Target(코호트, 리드 생성 카운트)이 그 옆에서 "이번 달
  리드 발굴 자체는 건강했는지"를 별도로 보여주는 보완 지표 역할을 한다.
- **Target 매핑**: ACQ_REP(Event 기준, Close Date) → Revenue Target. NewP1_REP(Cohort 기준,
  Create Date) → New P1 Target. 두 리포트 모두 New P1 Target도 추가하기로 함(같은 소스,
  같은 값이라 안전 — 위 Surprises 참고) — ACQ_REP에서도 "이번 달 리드 발굴이 목표만큼
  됐는지"를 Revenue와 나란히 보고 싶다는 사용자 요청(2026-07-30).

- [x] **AH:AK 레거시 컬럼 정리(2026-08-04)** — 컬럼 위치가 O→S→AH→S로 네 번 바뀌는 동안
      AH:AK(34, 옛 `TARGET_COLUMNS_START_COL` 값)에 남아있던 값을 코드가 정리한 적이 없어
      죽은 데이터로 방치돼 있었음(`generateACQReport_()`는 현재 S:V만 clear/write). 사용자가
      시트에서 직접 삭제 완료 — 코드 변경 없음(원래부터 AH:AK를 참조하는 코드가 없었음).
- [x] **NewP1_REP Spent 소스를 Target_Engine 수동 입력 → Ad_Spend_Cache 자동 집계로 전환
      (2026-08-04, 사용자 확정)** — "FY27 AUG Spent가 이상하다"는 리포트를 조사하다 발견:
      `ACQ_REP`의 Spent(W열)는 이미 `readAdSpendCacheMap_()`(`AD_004_SpendCache.js`, Meta+
      Naver Search+Kakao Channel 합산 자동 집계)를 쓰는데, `NewP1_REP`의 Spent는 이 캐시가
      생기기 하루 전(2026-07-30)에 추가돼 여전히 `Target_Engine` Block 0 수동 입력
      (`computeReportTargetLookup_().spent`)을 그대로 쓰고 있었음 — 두 리포트가 서로 다른
      Spent 소스를 쓰던 배선 누락. `40_NewP1Report.js`(v1.4.0)의 `generateNewP1Report_()`가
      `readAdSpendCacheMap_()`를 직접 조회하도록 변경(key 포맷 `FY|Month|Segment` 동일해 그대로
      대체 가능, ACQ_REP과 동일하게 캐시만 읽어 Simple Trigger 권한 제약도 안전). CPNP1(실적)도
      자동 집계 지출 기준으로 재계산됨. `computeReportTargetLookupFromInputs_()`
      (90_TargetEngine.js)의 `.spent` 출력 자체는 손대지 않음 — Target_Engine 내부 CPNP1
      Benchmark 도출 체인이 여전히 `inputs.monthlySegmentSpent`(Block 0 수동 입력)를 직접
      쓰고 있어 이번 변경과 무관. `node --check`/naming/version-header/중복선언 검사 통과,
      `clasp push` 완료. 실 시트 재검증(Generate 재실행 후 값 확인)은 사용자 진행 예정.

## Outcomes & Retrospective

(작업 완료 시 작성)
