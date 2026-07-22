# NewP1_REP Design (New P1 Cohort Funnel Report)

> Status: 구현 완료 (2026-07-22) — `40_NewP1Report.js`, `41_NewP1ReportStyles.js`, `CONFIG.NEWP1`(`00_Config.js`).
> 최초 시트 세팅은 `setupNewP1Report()`를 편집기에서 1회 수동 실행 (NewP1_REP 시트 생성 + Control/Report 헤더 + 드롭다운).
> 관련 문서: `docs/ACQReportDesign.md`, `docs/OperationsLayer.md`, `docs/Changelog.md` (2026-07-22 §5, §12, §13)

---

## 1. Purpose

Lead **획득 시점(코호트)** 기준으로 New P1 Lead의 다운스트림 퍼널 진행을 추적한다.

- ACQ_REP은 2026-07-22부터 IC Booked/Complete/Revenue를 **이벤트 날짜 기준**으로 집계한다.
- 코호트 관점("이 기간에 획득된 P1 Lead가 퍼널을 얼마나 진행했는가")은 NewP1_REP이 전담한다.
- Marketo 프로그램 단위 코호트는 별도 리포트에서 다룬다 (이 리포트 범위 아님).

## 2. Data Source — Leads_OPS 단일

- **소스는 `Leads_OPS` 하나뿐이다.** Leads_Master / MTA_Master / 기타 시트 조회 금지.
  - 근거: `docs/OperationsLayer.md` — "향후 모든 리포트는 Leads_Master가 아닌 Leads_OPS를 읽어야 한다."
    Leads_Master는 append-only라 갱신된 상태(Segment 재분류, Override 등)를 반영하지 못함.
- 컬럼 참조는 **Header-Based Mapping만 허용** (`OPS.HEADER` 기준, index 참조 금지).

### 사용 컬럼 (OPS.HEADER v2.1 기준)

| 컬럼 | 용도 |
| --- | --- |
| `Create Date` | 코호트 귀속 (FY/Month/Week 파생의 유일한 소스) |
| `Lead Priority` | P1 판정 fallback |
| `Priority Override` | P1 판정 1순위 |
| `Business Segment` | Segment 축 (Override 재판정 없이 그대로 사용) |
| `Total IC Requests` | SAL 판정 (= SAL 터치 횟수) |
| `IC Booked Date` | IC Booked 판정 |
| `IC Completed Date` | IC Complete 판정 |
| `Revenue` | Won 판정 + Revenue 합산 |

> `Opportunity Won Date`는 사용하지 않는다 — Won 판정은 Revenue > 0 (사용자 확정).
> `Revenue Actual`은 사용하지 않는다 (사용자 확정: SF 동기화 `Revenue` 컬럼).

## 3. Cohort Definition

다음 두 조건을 모두 만족하는 Lead:

1. `Create Date`가 선택된 조회 구간(Start FY·Month ~ End FY·Month) 내
2. **유효 Priority = `"Priority 1"`**
   - 유효 Priority: `Priority Override` 값이 있으면 그 값, 없으면 `Lead Priority`
   - 비교 값은 정확히 `"Priority 1"` 텍스트 (양쪽 컬럼 동일 포맷)

**SAL~Revenue 전 지표는 이 코호트 내에서만 카운트한다.** 모든 지표의 월/주 귀속은
`Create Date` 하나로만 결정된다 (IC Booked Date 등 이벤트 날짜는 도달 여부 판단에만 사용).

## 4. Row Structure

FY > Month > Fiscal Week > Segment 계층을 **한 시트에 flat하게 전부 표시** (소계 행 없음).

- **FY / Quarter 아님. Month**: `getFiscalMonthLabel()` (예: "JUN") — FY 내 유일.
- **Week**: `getWeek()` 재사용 — Fiscal Week (8/1 = W01 시작, 7일 단위, W01~W53).
  - Fiscal Week은 월 경계와 어긋난다. 같은 주(예: W05, 8/29~9/4)가 AUG와 SEP 아래에
    분할되어 나타날 수 있으며, **이는 의도된 동작이다** (사용자 확정).
  - 각 Lead의 Month와 Week은 `Create Date`로부터 독립적으로 파생된다.
- **Segment**: `Business Segment` 컬럼 값 그대로 (FT Override 재판정 없음, 사용자 확정).
  세그먼트 목록/순서는 `CONFIG.ACQ.SEGMENTS` 재사용 (Seminar, Webinar, BOFU, Search, Content, Referral, Other).
- FY/Month/Week은 **OPS 시트 컬럼을 참조하지 않고**, Engine 갱신 시 코드에서
  `Create Date` → `getFiscalYear()` / `getFiscalMonthLabel()` / `getWeek()`로 파생한다
  (OPS 스키마 변경 없음, 사용자 확정).

- **소계(subtotal) 행 없음** — flat 구조 확정. (구현 후 실물 확인 뒤 필요 시 추가 검토.
  추가 시 변경 범위는 Engine builder + Styles에 국한, 지표 계산 로직 불변.)

## 5. Metric Columns (A:N, 14 columns)

%는 건수와 **완전 분리된 별도 컬럼** (사용자 확정).

| Col | Header | Definition |
| --- | --- | --- |
| A | FY | 코호트 FY |
| B | Month | 코호트 Fiscal Month 라벨 |
| C | Week | 코호트 Fiscal Week (W01~W53) |
| D | Segment | Business Segment |
| E | New P1 | 코호트 Lead 수 (Count) |
| F | SAL | `Total IC Requests` > 0 인 Lead 수 |
| G | SAL% | F / E |
| H | IC Booked | `IC Booked Date` not blank |
| I | IC Booked% | H / E |
| J | IC Complete | `IC Completed Date` not blank |
| K | IC Complete% | J / E |
| L | Won | `Revenue` > 0 |
| M | Won% | L / E |
| N | Revenue | `Revenue` 합산 |

- **모든 %의 분모는 해당 행의 New P1(E)** — 코호트 진행률이므로.
- E = 0인 행의 % 처리: 0으로 나누기 금지, 빈 값 또는 "-" 표시 (구현 시 Styles에서 확정).
- SAL 참고: `Total IC Requests`에는 백필 하한 보정(IC Booked Date 존재 + 카운터 0 → 1)이
  이미 적용되어 있어, 트래킹 도입 이전 Lead도 SAL로 잡히며 퍼널 순서(SAL ≥ IC Booked)가
  논리적으로 유지된다. 의도된 동작으로 보고 그대로 활용한다.

## 6. Engine — `NewP1_Engine` 숨김 시트 (Summary 통합)

ACQ_REP과 달리 별도 Summary 시트를 두지 않고, **Engine과 사전 집계를 한 시트로 통합**한다
(사용자 확정). ACQ에서 둘이 분리됐던 이유는 갱신 시점 차이(Engine=리포트 생성 시 선택 구간만 /
Summary=데이터 변경 시 전체)였으나, NewP1은 전 기간을 사전 집계하므로 Sort Index를 같은
시트에 두면 Engine 역할까지 흡수된다.

### 시트 구조

```
FY | Month | Week | Segment | Sort Index | New P1 | SAL | IC Booked | IC Complete | Won | Revenue
```

- 실제 데이터에 존재하는 전체 기간의 (FY × Month × Week × Segment) 조합 + 지표를 사전 계산.
- **% 컬럼은 Engine에 저장하지 않는다** — 건수에서 파생되므로 Report 생성 시 계산 (중복 저장 금지).
- Sort Index: FY → Month(fiscal 순서 AUG=1..JUL=12) → Week → Segment(CONFIG.ACQ.SEGMENTS 순서)로
  유일하게 결정. 연속 블록 복사를 가능하게 한다.

### 코드 책임 분리 (Article 7)

시트는 하나지만 함수 책임은 분리한다:

- **조합/Sort Index 생성 함수** — Month/Week/Segment/Ordering만 책임. Business 계산 금지
  (ACQ 설계 원칙 "Engine은 business 계산 절대 안 함"을 함수 레벨에서 유지).
- **지표 집계 함수** — Leads_OPS 스캔, 코호트 필터, 각 지표 카운트/합산. 각 지표는 독립적.

### 갱신 시점

`refreshNewP1Engine_()`을 기존 `refreshACQSummary_()` 호출 지점과 동일한 위치에서 함께 호출
(Append/Rebuild/Sync/OPS Build 완료 시). 성능 원칙: Read Once → Parse Once → Write Once
(Article 10) — OPS 전체를 1회 읽고, 조합별 집계를 메모리에서 완료 후 `setValues()` 1회로 쓴다.

## 7. Report Generation Flow (`NewP1_REP` 시트)

ACQ_REP 패턴 재사용:

1. Control Area: Start FY / Start Month / End FY / End Month 드롭다운 4개 + Generate 체크박스
   (FY 목록은 실제 데이터 기준 동적 계산)
2. `onEdit` Simple Trigger가 Generate 체크박스 감지
3. `NewP1_Engine`에서 Start/End Sort Index 탐색
4. 연속 블록(FY/Month/Week/Segment + 건수/Revenue)을 Report Area로 복사
5. % 컬럼(G/I/K/M) 계산해 채움
6. Styles 적용

## 8. Styles (`41_NewP1ReportStyles.js`)

ACQ_REP 스타일 관례 준수:

- % 컬럼: 소수점 1자리 % 표기
- Revenue: 천단위 콤마
- 전체 테두리, 짝수 행 배경 `#F3F3F3` (배치 `setBackgrounds()`)
- 헤더 Note: 각 지표 컬럼에 날짜 기준(코호트 = Create Date) 명시 —
  ACQ_REP(이벤트 기준)과의 혼동 방지 목적. `annotateACQReportMetricNotes_()` 패턴 재사용.

## 9. Modules & Config

| 파일 | 책임 |
| --- | --- |
| `40_NewP1Report.js` | Engine refresh + Report 생성 (조합 생성 함수 / 지표 집계 함수 / 리포트 생성 함수 분리) |
| `41_NewP1ReportStyles.js` | 서식 전용 |
| `00_Config.js` → `CONFIG.NEWP1` | 시트명(`NewP1_REP`, `NewP1_Engine`), Control Area 범위, Report Area 시작 행, 헤더 배열, 색상 상수 |

- 하드코딩 금지 (Article 11): 시트명/범위/헤더 전부 `CONFIG.NEWP1`.
- 신규 함수 전부 WHY/INPUT/OUTPUT/TEST 주석 + `testXXXX()` 동반 (TDD, 2026-07-21 원칙).
- 파일 상단 Change Log 기록 (Article 16).

## 10. Out of Scope

- Marketo 프로그램 단위 코호트 리포트 (별도 리포트)
- 코호트 성숙도/속도 분석 (Cohort Matrix — 필요 시 추후 별도 리포트)
- 소계 행 (실물 확인 후 재검토)
- OPS에 Created Week helper 컬럼 추가 (이 리포트는 불필요 — 코드 파생)

## 11. 결정 이력 (사용자 확정 사항)

| 항목 | 결정 |
| --- | --- |
| 소스 | Leads_OPS 단일 |
| 코호트 | Create Date 구간 + 유효 Priority = "Priority 1" (Override 우선 → Lead Priority) |
| SAL 판정 | `Total IC Requests` > 0 (MTA 무관, OPS 기존 컬럼) |
| Won 판정 | `Revenue` > 0 |
| Revenue 합산 | `Revenue` (SF 동기화 컬럼) |
| Segment | `Business Segment` 그대로 (FT Override 재판정 없음) |
| Week | Fiscal Week (`getWeek()`), 월 경계 분할 허용 |
| FY/Week 파생 | Engine 갱신 시 코드 계산 (OPS 스키마 변경 없음) |
| 행 구조 | flat, 소계 없음 |
| % 표시 | 건수와 별도 컬럼 분리, 분모 = New P1 |
| Engine/Summary | `NewP1_Engine` 한 시트로 통합, 함수 책임은 분리 |