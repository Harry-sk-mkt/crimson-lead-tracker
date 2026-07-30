# FY_REP Design (FY별 Sales Funnel 대시보드) — SUPERSEDED

> Status: **채택 안 함(superseded), 미구현 — 2026-07-30**. 아래 설계 전체를 진행하는 대신,
> **기존 `ACQ_REP`/`NewP1_REP`에 Target 컬럼을 추가하는 방식으로 대체**하기로 결정(같은 날,
> 같은 세션). 사유: 이 문서가 새로 만들려던 New Leads/P1NL/SAL/ICBooked/Completed/Deals/
> Revenue는 이미 `ACQ_REP`(Event 기준, Deal Tracker Revenue)과 `NewP1_REP`(Cohort 기준,
> New P1 퍼널)이 FY×Month×Segment로 전부 갖고 있음 — 별도 리포트를 새로 만들면 이미 검증된
> 지표를 처음부터 다시 계산하는 중복이 발생(Single Responsibility/중복 로직 금지 원칙 위반).
> 부족했던 건 Target/Target%(달성률)뿐이었고, 이건 두 기존 리포트에 컬럼만 추가하면 됨.
> **후속 설계는 `docs/ACQReportDesign.md`/`docs/NewP1ReportDesign.md`의 Target 확장 섹션 참고**
> (구현 시 추가 예정). 이 문서는 그 판단에 이르기까지의 검토 과정 기록으로 보존.
>
> 관련 로드맵 항목: `docs/Roadmap.md` "계획 중" §"FY별 Sales Funnel 대시보드"
> 관련 문서: `docs/NewP1ReportDesign.md`(패턴 재사용), `docs/TargetReportDesign.md`(Deal Share/Spent 소스)

---

## (아래는 채택 안 된 원래 설계 — 보존 기록)

## 1. Purpose

기존에 사용자가 외부 스프레드시트에서 수동으로 관리해온 **FY_REP**(FY×Month 단위, 매출
달성률·전FY 대비·시즌성/트렌드를 회의에서 논의하는 용도)을 이 프로젝트의 자동화 리포트로
편입하고, 여기에 **세그먼트별 달성률(%) 뷰**를 신규로 추가한다.

- `Target_REP`은 New P1/Pipeline P1/CPNP1의 Target-Actual 원시 수치를 주간 단위로 보여주지만
  **달성%(Progress) 컬럼은 2026-07-30에 의도적으로 제거**됨("다른 시트에서 확인" 사용자 확인,
  `docs/TargetReportDesign.md` 참고) — FY_REP이 그 빈자리(세그먼트별 Revenue 달성률)를 채운다.
- `NewP1_REP`은 이미 FY×Month×Segment 코호트 퍼널(New P1→SAL→IC Booked→IC Complete→Won)을
  제공하지만 Spent/CPNP1/Revenue Target 개념이 없다 — FY_REP은 이 둘을 결합한 새 리포트다
  (NewP1_REP을 확장하지 않고 **신규 시트로 분리**, 사용자 확정).

## 2. 구조 — 2섹션 분리

원본 FY_REP의 용도(트렌드 논의)와 신규 요구(세그먼트 달성률 확인)가 서로 다른 grain을
요구해서, 하나의 flat 테이블로 합치지 않고 **한 시트 안에서 섹션을 분리**한다.

| 섹션 | Grain | 목적 |
| --- | --- | --- |
| Section 1 — Trend | FY × Month (회사 전체, 세그먼트 미분해) | 회의에서 시즌성/트렌드/전FY 대비 논의 (원본 FY_REP 용도 그대로) |
| Section 2 — Segment | FY × Month × Segment | 세그먼트별 Revenue Target 대비 달성률(%) 추적 (신규 요구) |

- Section 2를 FY×Month×Segment로 유지하기로 한 이유: 세그먼트별 달성률도 **월별 추이**로
  봐야 한다는 사용자 확정(2026-07-30) — FY 누적 스냅샷 1행/세그먼트가 아니라 NewP1_REP과
  동일한 flat 패턴(월 12 × 세그먼트 5 = FY당 60행).
- 세그먼트 범위: `CONFIG.TARGET.GROUP_ORDER` 5개(Seminar/Webinar/BOFU/Search/Content) 기준으로
  가정 — **미확정**. Leads_OPS Business Segment 자체는 Referral/Other 포함 7개인데, Target의
  Deal Share가 5개 세그먼트만 정의돼 있어 Referral/Other는 Target 배분 대상이 없음(§5 참고).
  Referral/Other를 Section 2에 포함할지(Target 없이 실적만) 제외할지 결정 필요.

## 3. Section 1 — Trend (FY × Month, 회사 전체)

원본 외부 FY_REP 컬럼을 그대로 재현. **사용자가 실 시트를 공유하지 못해(캡쳐 불가) 채팅
설명만으로 재구성** — `*` 표시 컬럼은 이 세션에서 명시적으로 확인받지 않은 추론값이다.

| 컬럼 | 정의 | 확인 상태 |
| --- | --- | --- |
| Spent | 그 달 전사 총 광고비 (`Target_Engine` Block 0 세그먼트별 월별 입력의 합) | 추론 |
| New leads | 전체 리드 수 (Priority 무관, `Create Date` 기준, Leads_OPS) | 확인됨(Section 2와 공통 정의) |
| P1NL | New P1 수 (유효 Priority = "Priority 1") | 확인됨 |
| P1% | P1NL ÷ New leads | 확인됨 |
| CPNP1 (구 CPNL) | Spent ÷ P1NL — **2026-07-30 사용자가 "Cost Per New P1"로 명명 확정** | 확인됨 |
| SAL | `Total IC Requests` > 0 (Leads_OPS, NewP1_REP과 동일 정의) | 확인됨 |
| SAL/New%* | SAL ÷ New leads | **추론, 미확인** |
| SALtoDeal%* | Deals ÷ SAL | **추론, 미확인** |
| ICBooked | `IC Booked Date` 존재 | 확인됨 |
| NLtoIC* | ICBooked ÷ New leads | **추론, 미확인** |
| Completed | `IC Completed Date` 존재 | 확인됨 |
| BkToC* | Completed ÷ ICBooked | **추론, 미확인** |
| Deals* | 전체 딜 건수 (Upsell 포함, Deal Tracker) | **추론, 미확인** |
| Upsells | Upsell 딜 건수만 (Deal Tracker) | 확인됨(원본 컬럼) |
| #Deals* | Deals − Upsells (Upsell 제외 신규 딜) | **추론, 미확인** |
| BkToD* | Deals ÷ ICBooked | **추론, 미확인** |
| Rev. | Revenue 합 (Deal Tracker, Upsell 포함) | 확인됨 |
| Target | `Target_Engine` 월별 회사 전체 Revenue Target 입력값 그대로 | 확인됨 |
| Target% | Rev. ÷ Target | 확인됨 |
| ROI* | Rev. ÷ Spent | **추론, 미확인**(원본에 있었는지 자체도 미확인 — 사용자가 제거 대상으로 언급 안 함) |

## 4. Section 2 — Segment (FY × Month × Segment, 신규)

원본 컬럼 중 정의가 애매했던 비율 컬럼들은 **세그먼트로 쪼개면 필요 없다는 사용자 판단으로
전부 제거**(2026-07-30 확정) — Deals/#Deals 구분도 세그먼트 단위에선 의미가 없어 Deals
하나로 통합, Upsells 별도 컬럼도 삭제(Rev.에 이미 포함).

`FY | Month | Segment | Spent | New Leads | P1NL | P1% | CPNP1 | SAL | ICBooked | Completed | Deals | Rev. | Target | Target%`

| 컬럼 | 정의 | 소스 |
| --- | --- | --- |
| Spent | 그 달 그 세그먼트 광고비 | `Target_Engine` Block 0 세그먼트별 월별 수동 입력 |
| New Leads | 전체 리드 수 (Priority 무관, Create Date, 해당 Segment) | Leads_OPS, Business Segment 필터 |
| P1NL | New P1 수 (유효 Priority = "Priority 1") | Leads_OPS |
| P1% | P1NL ÷ New Leads | 파생 |
| CPNP1 | Spent ÷ P1NL | 파생 |
| SAL | `Total IC Requests` > 0 | Leads_OPS |
| ICBooked | `IC Booked Date` 존재 | Leads_OPS |
| Completed | `IC Completed Date` 존재 | Leads_OPS |
| Deals | 딜 건수 (Upsell 포함) — Segment + Created Date 코호트 매칭 | Deal Tracker, `NewP1_REP`의 `computeNewP1DealWonRevenueFromRows_()` 패턴 재사용 |
| Rev. | Revenue 합 (Upsell 포함) | Deal Tracker, 위와 동일 매칭 |
| Target | 회사 전체 월별 Target × 세그먼트 Deal Share 비중 | `Target_Engine` Block C (코호트1/R1/New트랙 비중) 재사용 — **2026-07-30 확정** |
| Target% | Rev. ÷ Target — **100% 이상이면 셀 배경 `#C6E0B4`(연초록) 하이라이트** | 파생 + 조건부 서식 |

- CPNP1 renamed from 원본 "CPNL" — 사용자가 "Cost Per New P1"이 정확한 의미라고 확정
  (2026-07-30), Section 1/2 공통 적용.
- 하이라이트 색상 `#C6E0B4`는 새 값이 아니라 `32_ACQReportStyles.js`의 `highlightAboveMedian_()`에서
  이미 쓰는 "옅은 초록 — 강조색" 재사용(프로젝트 기존 관례 유지).
- 하이라이트 적용 범위는 **Target%/Rev. 셀만**(사용자 확정) — 행 전체 강조 아님.

## 5. Deal Share 재사용 관련 미해결 사항

Target 배분에 쓰는 "세그먼트 Deal Share"는 `Target_Engine` Block C가 이미 계산하는
코호트1(R1, New 트랙) 비중을 재사용하기로 확정했으나(2026-07-30), 다음은 아직 미확정:

- Block C는 New 트랙(R1)과 Pipeline 트랙(R2) 비중을 **따로** 계산한다(`docs/OpenItems.md` #7
  참고) — FY_REP Target 배분에 New(R1)만 쓸지, New+Pipeline 합산 비중을 쓸지 재확인 필요.
  이번 세션에서는 "New트랙(R1)"으로 잠정 확정했으나 원본 FY_REP이 어떤 개념의 Target이었는지
  (신규 획득분만인지, Pipeline 포함 전체 매출 목표인지) 실물 확인 없이 결정된 부분이라 재검토 여지.
- Referral/Other 세그먼트는 Deal Share 자체가 정의돼 있지 않아(`GROUP_ORDER`가 5개만 포함)
  Target 값을 못 만든다 — §2의 "세그먼트 범위" 미확정과 동일한 이슈.

## 6. Validation Rules (QA) — 2026-07-30 신규

`24_OPSQA.js`(Leads_OPS_QA — Dashboard + Issues 테이블, `runOPSQA_()`/`writeOPSQAResults_()`)
패턴을 재사용해, 계산값 사이의 **논리적 정합성**을 탐지/보고한다. 3/8/13번 항목(완전 동일
중복 행)처럼 **탐지/보고만 하고 자동 수정·리포트 생성 중단은 안 함** — **2026-07-30 사용자
확정**(아래 모든 규칙에 공통 적용, 하드/소프트 구분 없음).

### 6.1 퍼널 단조성 (Funnel Monotonicity)

Section 1(FY×Month)/Section 2(FY×Month×Segment) 각 행에서 하위 단계 수가 상위 단계 수를
넘을 수 없다는 전제 — 위반해도 리포트 생성은 그대로 진행, QA 이슈로만 기록:

| 규칙 | 근거 |
| --- | --- |
| P1NL ≤ New Leads | P1은 전체 리드의 부분집합 |
| SAL ≤ New Leads | SAL도 그 코호트 리드의 부분집합 |
| ICBooked ≤ SAL | 퍼널 순서상 IC Booked는 SAL 이후 단계 |
| Completed ≤ ICBooked | 퍼널 순서상 Completed는 Booked 이후 단계 |
| Deals ≤ Completed | `docs/NewP1ReportDesign.md` §5가 이미 "SAL/IC Booked 역전이 백필 보정 전에는 실제로 발생했었다"고 기록한 전례가 있는 규칙 — 다른 규칙과 동일하게 이슈로만 기록 |

- **미확정**: SAL/ICBooked/Completed가 Section 2에서 "그 세그먼트의 New Leads 전체" 모집단
  기준인지 "그중 P1NL만" 기준인지 §4에서 아직 명시 안 함 — 이 규칙들의 정확한 분모/모집단은
  그 결정에 따라 달라짐(예: SAL ≤ New Leads가 맞는지 SAL ≤ P1NL이 맞는지).

### 6.2 Section 1 ↔ Section 2 합계 정합성

Section 1은 회사 전체, Section 2는 세그먼트 분해이므로 같은 FY×Month에 대해 **Section
2를 세그먼트 전체에 걸쳐 합산하면 Section 1과 일치해야 한다**(New Leads/P1NL/SAL/ICBooked/
Completed/Deals/Rev./Spent 전 컬럼).

- **§2/§5의 미해결 사항(Referral/Other 포함 여부)에 의존** — Section 2가 5개 세그먼트만
  다루면 Referral/Other만큼 항상 차이가 나는 게 "정상"이라 이 규칙을 그대로 적용 못 함.
  Referral/Other 처리 방침이 정해져야 이 규칙의 허용 오차(0이어야 하는지, Referral/Other
  합계만큼의 차이가 예상 오차인지)를 확정할 수 있음.

### 6.3 범위/입력값 검증

| 규칙 | 비고 |
| --- | --- |
| Spent ≥ 0, Target ≥ 0 | 수동 입력 영역(Target_Engine Block 0) — Apps Script Data Validation으로 음수 자체를 입력 단계에서 차단하는 방안도 가능(§6과 별개로 "입력 셀 검증"이 필요하면 재논의) |
| P1% ∈ [0%, 100%] | New Leads ≥ P1NL이 §6.1에서 보장되면 자동으로 성립 — 별도 규칙이라기보다 §6.1의 파생 결과 |
| Target%는 상한 없음 | 목표 초과 달성은 정상 상황(100% 초과 시 하이라이트가 오히려 그 신호) |
| 분모 0일 때 % 공백 처리 | `NewP1_REP`과 동일 원칙(0으로 나누기 금지, `""`) — 새 규칙 아니라 기존 컨벤션 재확인 |

### 6.4 미확정 — 실행/출력 방식

- **어느 시트에 기록할지**: 기존 `Leads_OPS_QA`에 새 이슈 타입으로 얹을지, `FY_REP` 전용 QA
  섹션/시트를 새로 만들지 미정.
- **실행 시점**: 리포트 생성(Generate) 시 자동 실행할지, `runOPSQA_()`처럼 별도 수동 진입점을
  만들지 미정.

## 7. Out of Scope (이번 라운드)

- 시각적 대시보드(차트/그래프) — 숫자 표(flat table)로 확정(2026-07-30).
- Section 1/2를 하나의 리포트 생성 흐름(Control Area + Generate)으로 묶을지, 독립 실행할지는
  미정 — 구현 착수 시 결정.
- Engine/Report/Config 파일 분리 방식(`9x_FYReport.js` 신규 번호대 등)은 미정 — 구현 착수 시
  기존 넘버링 컨벤션에 맞춰 확정.

## 8. Decision Log (2026-07-30, 채팅 기준)

| 항목 | 결정 |
| --- | --- |
| 관계 | `NewP1_REP` 확장 아님, 완전 신규 리포트/시트 |
| 출력 형태 | 숫자 표 (시각적 대시보드 아님) |
| 구조 | Section 1(FY×Month 트렌드, 세그먼트 미분해) + Section 2(FY×Month×Segment 달성률) 분리 |
| Section 2 grain | FY×Month×Segment (FY 누적 스냅샷 아님 — 월별 추이 필요, 사용자 확정) |
| CPNL → CPNP1 | Spent ÷ P1NL, 이름 변경 확정 |
| Section 2 비율 컬럼 정리 | SAL/New%, SALtoDeal%, NLtoIC, BkToC 전부 제거 — "세그먼트로 쪼개면 불필요" |
| Deals/#Deals | Section 2는 Deals 하나로 통합(Upsell 포함), Upsells 별도 컬럼도 삭제 |
| Section 2 Target | 회사 전체 월별 Target × Deal Share(Target_Engine Block C, 코호트1/R1/New트랙) 배분 |
| 하이라이트 | Target% ≥ 100%일 때 Target%/Rev. 셀 배경만 `#C6E0B4`(기존 강조색 재사용) |
| Section 1 | 원본 그대로 유지 — 단, 이번 세션에서 실 시트를 못 봐서 다수 컬럼(`*` 표시)이 추론 상태 |
| Validation | `Leads_OPS_QA` 패턴 재사용, **모든 규칙 탐지/보고만 — 자동 수정·리포트 생성 중단 없음(2026-07-30 사용자 확정)**. 규칙 목록은 §6 |

## 9. 다음 단계

사용자 재검토 대기 중. 특히:
1. §3 Section 1의 `*` 표시 컬럼(SAL/New%, SALtoDeal%, NLtoIC, BkToC, Deals, #Deals, BkToD,
   ROI) 공식이 실제 원본과 맞는지
2. §2/§5 Referral/Other 세그먼트를 Section 2에 포함할지
3. §5 Deal Share를 New트랙(R1)만 쓸지 New+Pipeline 합산을 쓸지
4. §6.1 SAL/ICBooked/Completed의 정확한 모집단(New Leads 전체 기준인지 P1NL만인지)
5. §6.2 Section 1↔2 합계 정합성 규칙의 허용 오차(§2 세그먼트 범위 결정에 종속)
6. §6.4 QA 결과 기록 위치(`Leads_OPS_QA` 재사용 vs 신규 시트) 및 실행 시점(자동 vs 수동)

재검토 완료 후 `docs/exec-plans/active/`에 구현용 exec-plan 신설 예정(`docs/ExecPlanConvention.md`
기준 — 여러 세션에 걸칠 것으로 예상되는 작업).
