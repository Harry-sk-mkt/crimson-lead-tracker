# Target_REP Design (Weekly Segment Target & Achievement Report)

> Status: 설계 확정 (2026-07-27) — 구현 전. 구현 파일 예정: `90_TargetEngine.js`,
> `91_TargetReport.js`, `92_TargetStyles.js`, `CONFIG.TARGET`(`00_Config.js`).
> 관련 문서: `docs/NewP1ReportDesign.md`(P1 정의 재사용), `docs/ACQReportDesign.md`(Control/Generate 패턴),
> `docs/EventsReportDesign.md`(Input 영역 보존 + 시트 보호 패턴), `docs/OperationsLayer.md`

---

## 1. Purpose

주 단위(월~일)로 세그먼트 그룹별 **New P1 / Cost per New P1(CPNP1)** 목표를 세우고
실적 대비 달성률을 추적하는 Target 전용 리포트.

목표 산출은 **top-down**: FY 마케팅 Revenue 타겟에서 세그먼트별 P1 개수를 역산한다.
과거 실적 벤치마크는 목표 산출의 직접 근거가 아니라 (1) **참고 지표**, (2) **월 배분용
시즌성 가중치**로만 쓴다.

> 배경: 최초 논의는 bottom-up(같은 달 과거 벤치마크 × 성장률 30%)이었으나,
> "P1당 가치 × 세일즈 타겟 역산" 로직 확인 후 top-down으로 전면 교체 (2026-07-27 확정).
> FY27 웨비나 물량 2배 확대 계획 등 공격적 목표는 이 역산 구조에서 자연스럽게 도출된다.

## 2. Target Segment Groups

리포트 축은 현행 `Business Segment` 7개가 아니라 **3개 그룹**:

| 그룹 | 매핑되는 Business Segment | 비고 |
| --- | --- | --- |
| events | Seminar + Webinar | 세미나가 매달 있지 않아 합산 목표. 벤치마크 블록에 Seminar/Webinar 분해 보조 표시 (지저분하면 제거 재검토) |
| contact | BOFU + Search | 레거시 "contact" 명명 계승 |
| content | Content | 그대로 |

- Referral: 영업 직접 발굴 성격 — 목표 배분 대상 아님 (그룹에 없으므로 자동 제외)
- Other: 대상 아님
- 매핑은 `CONFIG.TARGET.SEGMENT_GROUPS`에 정의 (Article 11)

## 3. Data Sources

| 소스 | 용도 | 접근 방식 |
| --- | --- | --- |
| `Leads_OPS` | New P1 실적/벤치마크, P1당 가치 (분자·분모 모두) | 워크북 내 직접 |
| 채널시트 (Meta) | events/contact/content 그룹 Spent (NZD) | **외부 스프레드시트 참조** — `SpreadsheetApp.openById()`, 이관 안 함 (시트 사이즈 사유, 2026-07-27 확정) |
| Naver 시트 | contact 그룹 추가 Spent (`SpentNZD` 컬럼) | 채널시트와 **동일 파일 내 별도 시트**, 동일 방식 참조 |
| 딜트랙커 | 세그먼트 딜 비중 (Revenue 비중, 3FY median) | **이관 예정** — 이관 전까지 비중은 Engine Input 블록 수동 입력으로 대체 |

- Leads_OPS 컬럼 참조는 Header-Based Mapping만 허용 (`OPS.HEADER` 기준)
- 외부 파일 스프레드시트 ID / 시트명 / 컬럼 위치는 전부 `CONFIG.TARGET` (실물 구조는 아래 확인 완료)

### 채널시트 → 그룹 매핑 (2026-07-27 확정)

| 채널시트 그룹 | Target 그룹 | 비고 |
| --- | --- | --- |
| event | events | |
| contact | contact | Naver 전액과 합산 |
| lead | content | eBook 등 리드젠 |
| traffic | (제외) | CPNP1 계산에서 완전 제외 |

- Naver: 캠페인 전부 `_contact` 접미사, 트래픽성 캠페인 없음 확인 → **전액 contact 합산**
- 통화: **NZD 통일**. 채널시트 Meta `$` 값 = NZD, Naver는 `SpentNZD` 컬럼 사용 (환율 변환은
  시트 내 컨버터 셀이 이미 처리 — Engine에서 환산 안 함)

### 외부 시트 실물 구조 확인 (2026-07-27, WebFetch로 CSV export 열람 확인)

두 시트 모두 스프레드시트 ID `1QDB_9MiD6eTeNlnC8YMWXbyncSwgDOTZT-A-KItlu6A` 안의 별도 탭(gid).
탭 이름 대신 **gid(sheetId) 매칭**으로 찾는 방식 채택 — 탭 이름은 언제든 바뀔 수 있어 gid가 더
안정적 (`SpreadsheetApp.openById(id).getSheets()`를 순회해 `sheet.getSheetId() === gid`인 시트 사용).

**채널시트 (Meta) — gid `1718473299`**
- 컬럼 구조 (헤더 1행): `Start date, End date` 다음 6컬럼씩 3개 그룹 반복(`CvR, Clicks, Spent, Results, CPL, Spent%`), 그 다음 `traffic`(CvR, Spent, Spent% 3컬럼만), 그 다음 `Total Spent, ResultsAll, NL, NL%, Note`
  - A=Start date, B=End date
  - **event**: C=CvR, D=Clicks, **E=Spent**, F=Results, G=CPL, H=Spent%
  - **contact**: I=CvR, J=Clicks, **K=Spent**, L=Results, M=CPL, N=Spent%
  - **lead**(→content): O=CvR, P=Clicks, **Q=Spent**, R=Results, S=CPL, T=Spent%
  - **traffic**(제외 대상): U=CvR, V=Spent, W=Spent%
  - X=Total Spent, Y=ResultsAll, Z=NL, AA=NL%, AB=Note
  - Target Engine이 실제로 쓰는 건 그룹별 **Spent 컬럼(E/K/Q)** 뿐
- 데이터 시작일 2024-09-01 확인 — 문서 §7의 "채널시트 FY24 없음(NoDataBefore)" 서술과 일치 (Note 컬럼에 "NoDataBefore" 문자열 그대로 존재)
- **§12 Open Item #4 실측 확인**: 2026-06-28 / 07-05 / 07-19 세 주(Start date 기준) 행이 전체
  컬럼값 완전 동일(바이트 단위 일치) — placeholder 복붙 추정이 아니라 **실제로 확인된 문제**.
  최근 3주(2026-07-27 기준 가장 최근 완료 주까지 포함)가 영향권 → 벤치마크/실적 계산에 그대로
  넣으면 왜곡됨. 처리 방식은 미정 (아래 Open Items 갱신 참고).

**Naver 시트 — gid `387972603`**
- 컬럼 구조: A=FY, B=Start date, C=End date, **D=SpentNZD**, E=SpentAll, F=T.click, G=CPC, H=SF,
  I=T.results, 이후 캠페인별 `Clicks/Results/CvR/Cost/CPL` 5컬럼 블록 반복(J열부터, 총 55컬럼)
- Target Engine이 쓰는 건 **D열(SpentNZD) 합계뿐** (캠페인별 세부 컬럼은 안 씀 — 전액 contact 합산이므로)
- 캠페인명 전수 확인 결과 `_contact` 접미사 패턴 확인, 트래픽성 캠페인 없음 — §3 "전액 contact 합산" 전제 확인됨
- FY23(2023-07~) 데이터부터 존재 — FY24 커버리지는 문제 없음

## 4. Week / Calendar Rules (2026-07-27 확정)

- **주 = 월요일~일요일** (세일즈마케팅 회의 리포팅 기간 기준, 변경 불가 제약)
- **주의 월 귀속 = 그 주의 월요일이 속한 달**
- **그 달의 주 수 = 그 달에 월요일이 있는 주의 개수** (항상 4 또는 5)
  → 한 달의 주간 목표 합 = 월 목표 (정합성 보장). 예: 2026-08은 월요일이 8/3·10·17·24·31로 5회 → 5주
- **주 사이클 전환일 = 2026-08-03(월)**: FY27부터 모든 실무 시트(채널시트·Naver 포함)가
  일~토 → **월~일**로 전환. 전환 전 마지막 구방식 주는 7/26~8/2로 마감 (8/2 일요일 포함).
- 전환일은 `CONFIG.TARGET` + Engine Input 블록에 편집 가능 셀로 보관

> NewP1_REP에서 Fiscal Week을 제거했던 이력과 무관 — 이 리포트의 주는 Fiscal Week이 아니라
> 캘린더 주(월~일)이며, `getWeek()`를 재사용하지 않는다.

## 5. Metric Definitions

### New P1 (실적·벤치마크·P1당 가치 분모 공통 — NewP1_REP 정의 재사용)
- 소스: `Leads_OPS` 단일
- 코호트: `Create Date` 기준 귀속
- P1 판정: 유효 Priority = 정확히 `"Priority 1"` (`Priority Override` 우선 → 없으면 `Lead Priority`)
- 세그먼트: `Business Segment` 그대로 → 그룹 매핑

### CPNP1 (Cost per New P1)
- 분자 = 그룹 Spent (NZD): events=채널 event / contact=채널 contact+Naver 전액 / content=채널 lead
- 분모 = 그룹 New P1
- **분자 커버리지는 Meta(+Naver)만** — 타 플랫폼(GSA, Kakao 등) 비용 미포함이 정의에 내재함 (확정)

### P1당 가치 (P1 Value) — **2026-07-27 코호트1/2 이원화로 전면 재설계**
> 2026-07-25 원안(Leads_OPS Revenue 컬럼 ÷ FY26 P1 수, 단일 코호트)은 **폐기**. Sales팀 확인
> 결과 Deal Tracker를 Revenue의 Source of Truth로 쓰기로 확정하면서(CLAUDE.md #7), P1당 가치도
> Deal Tracker 기반 코호트 구조로 다시 설계됨.

- Revenue 원천: `Leads_OPS.Revenue`가 아니라 **Deal Tracker**(`[KOR] Deal Tracking`, Close
  Date/Created Date는 실제 Date 셀 — 텍스트 파싱 불필요 확인됨). 분류는 `classifyDealSegment_()`
  (Deal Tracker 자체 필드로 직접 분류, Leads_OPS 매칭 없음). **2026-07-27 재확정**: 최초엔
  Lead Source Detail을 `getBusinessSegment()`로 퍼지 매칭했으나, Lead Source Detail 공란
  딜이 "Other"로 오분류되는 문제 발견 → Deal Tracker 실제 컬럼(H열 "Content Category",
  WebFetch로 확인)을 직접 매핑하는 방식으로 교체(`CONFIG.TARGET.EXTERNAL.DEAL_TRACKER.
  CONTENT_CATEGORY_GROUP_MAP`). 현재 매핑은 임시 단순화 버전(Consult→contact 직행,
  TOFU/On demand/eBook→content 뭉뚱그림) — 사용자가 추후 세분화 예정, CLAUDE.md #13 참고.
- **코호트1(같은 해 생성·클로징)**과 **코호트2(과거 생성, 이번 FY 클로징 — 파이프라인 기여분)**를
  분리해 각각 계산 (사용자 논리: "이번 FY 총 딜 = 이번 FY 생성 리드 코호트 + 더 오래된 리드 코호트").
  - `CurrentFYP1V (a)` = 코호트1 Revenue(R1, Created FY = Closed FY = 타겟 FY) ÷ 타겟 FY New P1 수
    (Leads_OPS, Create Date 기준)
  - `PrevP1V (b)` = 코호트2 Revenue(R2, Closed FY = 타겟 FY이지만 Created FY ≠ 타겟 FY) ÷
    (Leads_OPS all-time 총 P1 수 − 타겟 FY New P1 수)
- 두 값 모두 `Target_Engine` Block B에 나란히 표시만 하고, **최종 FY 목표 공식(§6 ③)에서 a/b를
  어떻게 합칠지는 아직 미정** — 사용자가 실물 값을 검토한 뒤 결정 예정. 그 전까지는 원래 단일
  코호트 정의에 가장 가까운 `a`(CurrentFYP1V)를 임시로 사용.
- Content처럼 나urture 사이클이 긴(최대 28개월) 채널은 코호트2 비중이 클 것으로 예상 — 검증 필요.

### 세그먼트 딜 비중 (Deal Share)
- 정의: **Revenue 금액 비중** = 그룹 딜 금액 합 ÷ 조정 베이스 딜 금액 합
- 조정 베이스 = 전체 딜 − 조정치(세일즈 레퍼럴 + 업셀) — 분모·분자 모두 조정 후 기준
- 산출: **~~3개 FY 비중의 median~~ → 2026-07-27 변경: 타겟 FY 코호트1(Created FY = Closed FY =
  타겟 FY) 단일 기준**. median이 최근 연도 실제 구성비와 10%p 이상 괴리(실측: contact 20.9%
  median vs 31.3% FY26 코호트1 단독) — "내년에 들어온 리드 중 얼마나가 그 해 안에 클로징될지"를
  보려면 같은 해 생성·클로징 딜만 봐야 한다는 논리로 사용자 확정. P1당 가치와 동일 기준으로 통일.
- 그룹 분류: `classifyDealSegment_()` (딜 자체 필드 직접 분류, Leads_OPS 매칭 없음 — §12 Open Item #5 참고)

## 6. Target Derivation (top-down 공식 체인)

```
① FY P1 목표(그룹)  = 마케팅 Revenue 타겟(수동 입력, 조정 후 베이스)
                       × 그룹 딜 비중
                       ÷ 그룹 P1당 가치
② 월 P1 목표        = FY P1 목표 × 그룹 시즌성 비중(월)      ← 시즌성 비례 배분
③ 주 P1 목표        = 월 P1 목표 ÷ 그 달의 주 수(4 or 5)
④ 월 CPNP1 목표     = 월 CPNP1 벤치마크 × 개선계수(그룹별, <1.0)
```

- **마케팅 Revenue 타겟은 수동 입력** (예: 회사 전체 13.5M × ~0.7 ≈ 9.45M — 확정 시 값만 교체).
  Engine은 조정 계산을 하지 않는다 (2026-07-27 확정, 옵션 (b)).
- 개선계수: CPNP1은 낮을수록 좋으므로 성장률 대신 **개선계수(<1.0)** 사용. 초기값 0.9 placeholder,
  그룹별 3셀. (New P1 쪽 성장률 계수는 top-down 전환으로 **폐기** — 공식에 존재하지 않음)

### 시즌성 비중 (②의 가중치)
- 그룹별: 과거 FY들의 월별 New P1 **가중평균**(아래 §7)이 연간 합에서 차지하는 % (12개 월 합 = 100%)

## 7. Benchmark (참고 지표 + 시즌성 원천)

- **New P1 벤치마크**: 그룹×월 단위, FY24·25·26 **가중평균 1:2:3** (최근 가중, 2026-07-27 확정 —
  median 아님: 표본 2~3개에서 가중 median은 최신값 그대로가 되어 무의미)
  - ⚠️ Leads_OPS의 FY24 커버리지 미확인 (Open Item #1). 없으면 FY25·26 가중 2:3으로 축소.
- **CPNP1 벤치마크**: 그룹×월 단위 = 월 Spent ÷ 월 New P1
  - Spent는 **roughMonthlySum**: 과거 일~토 주간 데이터를 월로 합산 — **주 시작일(일요일)이 속한
    달로 귀속**. 월 레벨로 올려 요일 오프셋 문제를 흡수 (사용자 제안 방식).
  - FY 가중치 = **FY25 : FY26 = 2 : 3** — 채널시트가 2024-09("NoDataBefore")부터라 FY24 없음.
    "CPNP1 벤치마크 = 확보된 FY만" 원칙 (확정). FY24 광고 데이터는 계정 이관으로 소실 가능성
    높음 — 복구 시에만 1:2:3 확장.
- New P1 벤치마크(FY24·25·26)와 CPNP1 벤치마크(FY25·26)의 **기간 불일치는 허용** (확정)

## 8. Actuals (실적)

- **Actual New P1 (주간)**: Leads_OPS 스캔 — Create Date가 해당 월~일 주에 속하는 유효 P1 카운트
- **Actual Spent / CPNP1 (주간)**:
  - **2026-08-03 이후**: 채널시트·Naver의 월~일 행과 1:1 매칭 (정확)
  - **2026-08-03 이전 주**: **공란** — 전환 전이라 월~일 기준 정확한 주간 Spent가 존재하지 않음.
    (월 평균 분배 방식은 "같은 달 모든 주가 동일 Spent가 되어 실제 주간 소진 변동이 안 보이는"
    문제로 기각 — 2026-07-27)
- 갱신 시점: 실적 컬럼은 기존 `refreshACQSummary_()` 호출 지점(Append/Rebuild/Sync/OPS Build 완료 시)에서
  함께 갱신. 목표 체인 전체는 Generate 시 재계산.

## 9. Sheet Architecture — 2-시트 (Engine + REP)

규모가 작아 QA 시트 없음 (Events 선례). 시트는 2개지만 함수 책임은 블록별 분리 (Article 7).

### `Target_Engine` (**숨김** — 2026-07-27 확정)

파라미터는 FY당 1회 세팅으로 충분하다는 사용자 판단 → 숨김 유지 (조정 시 숨김 해제 후 편집).
좌→우 블록 배치:

| 블록 | 내용 | 빌드 동작 |
| --- | --- | --- |
| **0 — Inputs** | Target FY / 마케팅 Revenue 타겟(NZD) / 개선계수×3 / 딜 비중×3(임시) / 벤치마크 가중치(1:2:3, 2:3) / 전환일(2026-08-03) | **절대 덮어쓰지 않음** (읽기만) |
| **A — 벤치마크** | 그룹×월: FY별 New P1, 가중평균, 시즌성 %, CPNP1 벤치마크. events는 Seminar/Webinar 분해 보조 행 | clear 후 재작성 |
| **B — P1당 가치** | 그룹별 1행: New P1 수 / 코호트1 Revenue(R1) / CurrentFYP1V(a) / Prev P1 수 / 코호트2 Revenue(R2) / PrevP1V(b) | clear 후 재작성 |
| **C — 딜 비중** | 딜트랙커 타겟 FY 코호트1(같은 해 생성·클로징) 기준 계산. 접근 실패 시 블록 0 수동값 Fallback | clear 후 재작성 |
| **D — 목표 전개** | FY 목표 → 월 목표 → 주 캘린더(월~일 전체 나열) → 주 목표, CPNP1 목표 | clear 후 재작성 |

- Engine이 순수 Disposable이 아님 — **블록 0 보존형** (Events_OPS Manual 영역 보존 패턴 준용).
  블록 0 범위 = `CONFIG.TARGET.INPUT_RANGE`.
- 블록 A~D에 Range Protection 적용 검토 (Events Group 4/5 패턴. 프로젝트 최초 `Range.protect()`
  구현이 Events 쪽에서 선행될 예정 — 잠금 사고 주의, 구현 후 실시트 수동 검증 필수)

### `Target_REP` (보임)

- **컨트롤 영역 없음 (2026-07-27 수정 — 체크박스 → 수동 실행 → Control 영역 자체 삭제)**: 최초
  설계는 ACQ 패턴(Generate 체크박스 + onEdit Simple Trigger)이었으나, 구현 후 실측 결과 Simple
  Trigger는 제한된 권한으로 실행돼 `SpreadsheetApp.openById()`(외부 채널시트 참조)를 호출할 수
  없음이 확인됨("Specified permissions are not sufficient to call SpreadsheetApp.openById" —
  ACQ_REP/NewP1_REP는 외부 파일을 안 열어서 이 문제가 없었음, Target_REP만 해당). 체크박스를
  제거하고 Apps Script 편집기에서 `runGenerateTargetReport()`(91_TargetReport.js)를 직접
  Run하는 방식으로 전환 — 직접 Run은 Full Authorization이라 문제없음. 이후 사용자 요청으로
  체크박스/안내문/파라미터 요약이 있던 Control 영역(1~3행) 자체를 삭제 — **1행은 비워둠(향후
  월 소계 행 후보), 2행부터 바로 리포트 헤더, 3행부터 데이터**.
- **리포트 영역**: 행 = 대상 FY의 월~일 주 전체(52~53행). 미래 주는 Target만, Actual 공란
  → 연간 페이스 표가 미리 완성된 형태

| Week Start | Week End | Month | events (5컬럼) | contact (5컬럼) | content (5컬럼) |

그룹별 5컬럼: `Target P1` / `Actual P1` / `달성%` / `Target CPNP1` / `Actual CPNP1`. Month
컬럼은 FY 접두사 없이 월 라벨만(예: "AUG") — 사용자 요청, 2026-07-27.

- 달성% = Actual ÷ Target (분모 0 방어)
- 월 소계 행: 1행을 비워 자리는 확보해뒀음 — 실제 수식/구현은 아직 미정, 실물 확인 뒤 결정
  (NewP1 관례)
- 스타일 (2026-07-27 수정 — 사용자 요청): 숫자(Target/Actual P1·CPNP1)는 전부 **소수점 없이**
  (`#,##0`), **달성%만 소수 2자리**(`0.00%`). 테두리, 짝수 행 `#F3F3F3`, 헤더 Note에 기준
  (코호트=Create Date, 통화=NZD, 8/3 이전 Actual CPNP1 공란 사유) 명시.

## 10. Modules & Config

| 파일 | 책임 |
| --- | --- |
| `90_TargetEngine.js` | 블록 A~D 빌드 (블록별 함수 분리: 벤치마크 / P1가치 / 딜비중 / 목표전개 / 주캘린더 생성) |
| `91_TargetReport.js` | `setupTargetReport()`(1회 수동), onEdit Generate, 리포트 생성, 실적 갱신 훅 |
| `92_TargetStyles.js` | 서식 전용 |
| `00_Config.js` → `CONFIG.TARGET` | 시트명, `SEGMENT_GROUPS`, `INPUT_RANGE`, 외부 파일 ID/시트명/컬럼, 전환일, 가중치, 벤치마크 FY 목록, 행/열 상수 |

- 하드코딩 금지 (Article 11), 신규 함수 전부 WHY/INPUT/OUTPUT/TEST 주석 + `testXXXX()` 동반 (TDD),
  파일 상단 Change Log (Article 16), 로컬 수정 → clasp push (서버 직접 수정 금지)

## 11. Out of Scope

- 타 광고 플랫폼(GSA·Kakao 등) 비용 통합 — CPNP1은 Meta(+Naver) 한정으로 정의
- 딜트랙커 이관 자체 (별도 트랙 — 이 리포트는 이관 완료 시 블록 C만 교체)
- SAL/IC/Won 퍼널 목표 (New P1·CPNP1 두 지표만)
- Referral/Other 그룹 목표

## 12. Open Items (구현 전/중 확인)

1. ~~Leads_OPS FY24 커버리지 미확인~~ — **2026-07-27 확인 완료(사용자 확인)**: FY24 리드 존재함.
   New P1 벤치마크/시즌성은 원래 계획대로 **FY24·25·26 = 1:2:3 가중** 유지.
2. ~~채널시트 FY24 광고비 복구 여부~~ — **2026-07-27 확인 완료(사용자 확인)**: 복구 불가/미확인.
   CPNP1 벤치마크는 계획대로 **FY25·26 = 2:3 가중**(확보된 FY만) 유지. WebFetch로 열람한 실제
   데이터에서도 채널시트 최초 행이 2024-09-01(Note: "NoDataBefore")로 FY24 데이터 자체가
   시트에 없음을 재확인.
3. ~~외부 파일 스프레드시트 ID/시트명·컬럼 위치 미확인~~ — **2026-07-27 확인 완료** (WebFetch로
   CSV export 열람). 스프레드시트 ID `1QDB_9MiD6eTeNlnC8YMWXbyncSwgDOTZT-A-KItlu6A`, 채널시트
   gid `1718473299`, Naver gid `387972603`. 컬럼 레이아웃은 §3 "외부 시트 실물 구조 확인" 섹션에
   기록. **탭 이름이 아닌 gid(sheetId) 매칭으로 구현** (탭 이름 변경에 안전).
4. ~~채널시트 "동일 값 3주 반복" 처리 방식~~ — **2026-07-27 확인 및 처리 방식 결정 완료**. WebFetch로
   2026-06-28/07-05/07-19 세 행을 직접 대조, 전체 컬럼값이 바이트 단위로 완전 동일함을 확인
   (복붙 placeholder 추정이 사실로 확정). **처리 방식**: Engine 쪽에서 별도 제외/보정 로직을 두지
   않음 — **사용자가 구현 착수 전 채널시트에서 직접 실제 스펜드 값으로 교정**할 예정이므로 Engine은
   채널시트 값을 그대로 신뢰. (구현 시점에 아직 교정이 안 되어 있다면 착수 전 재확인 필요)
5. ~~딜트랙커 이관 후: 블록 C를 수동 입력 → 엔진 계산으로 교체~~ — **완료, 단 아키텍처가 세션 중
   두 번 크게 바뀜(최종 상태만 유효)**:
   - 1차(2026-07-27 초): Deal Tracker의 Source/Opp email → Account Name → UTM/Touch Detail
     "고스트" 분류까지 단계적으로 추가하며 Leads_OPS와의 리드 단위 매칭률을 10.7%→86.5%까지
     끌어올렸으나, **Sales팀 확인 결과 상담 종료 후 학부모 요청으로 Salesforce Lead/Opportunity
     이메일이 덮어써져 원본 마케팅 터치 이메일이 시스템적으로 복구 불가능한 경우가 있음이
     확인**되어(Ryan Kang 등 실측 사례) 개별 리드 매칭 자체가 근본적으로 신뢰 불가 판정 —
     이 전체 매칭 계층 폐기.
   - 2차(최종, 2026-07-27): Deal Tracker 자체를 Revenue의 Source of Truth로 전환 —
     `classifyDealSegment_()`가 Leads_OPS 조회 없이 딜 자체의 Lead Source/Source Category/
     Lead Source Detail로 `getBusinessSegment()`를 직접 호출해 분류. Deal Share 산출 기준도
     "3FY median"에서 "타겟 FY 코호트1(같은 해 생성·클로징) 단일"로 변경(실측 괴리 10%p+
     발견, median 폐기). 같은 코호트1/2 구조가 P1당 가치(위 §5)에도 그대로 확장됨.
     `readDealTrackerRawRows_()`/`computeDealShareRatiosFromDealRows_()`/
     `computeDealCohortsFromDealRows_()`(`90_TargetEngine.js`) 참고. **주의**: 이건 Block B/C
     계산 용도로 한정 — CLAUDE.md 미해결 항목 #7(Opportunity Won Date를 Deal Tracker Closed
     Date로 대체하는 더 큰 보정 레이어)은 별개 작업으로 여전히 미착수 상태.
   - 스프레드시트 ID `1oGCY8okaxhpHrtotUzbhyprCOVcJ9ndX5kX3m5qqxME`, gid `498663095`
     (`CONFIG.TARGET.EXTERNAL.DEAL_TRACKER`).
6. 개선계수 초기값 0.9는 placeholder — P1당 가치 분석 결과 보고 실값 확정
7. events의 Seminar/Webinar 분해 보조 표시 — 실물 확인 후 지저분하면 합산만 남김
8. 월 소계 행 여부 — 실물 확인 후 결정

## 13. 결정 이력 (사용자 확정 사항, 2026-07-27)

| 항목 | 결정 |
| --- | --- |
| 목표 산출 | **top-down**: 마케팅 Revenue 타겟 × 딜 비중 ÷ P1당 가치 (성장률 30% 방식 폐기) |
| 세그먼트 그룹 | events=Seminar+Webinar / contact=BOFU+Search / content=Content, traffic·Referral·Other 제외 |
| 지표 | New P1, CPNP1 (2개) |
| 주 정의 | 월~일 고정 (세일즈마케팅 회의 기준), 월 귀속=월요일, 주 수=월요일 개수 |
| 주간 목표 | 월 목표 ÷ 그 달의 실제 주 수 |
| 사이클 전환 | 2026-08-03부터 전 실무 시트 월~일, 마지막 구방식 주 7/26~8/2 |
| 마케팅 타겟 | 수동 입력 (조정 계산 안 함, 예: 13.5M×0.7≈9.45M) |
| 딜 비중 | Revenue 금액 비중, 조정 베이스(−세일즈 레퍼럴·업셀), **타겟 FY 코호트1(같은 해 생성·클로징) 단일**(2026-07-27, 3FY median 폐기), `classifyDealSegment_()`로 딜 자체 필드 직접 분류(Leads_OPS 매칭 없음) — 접근 실패 시에만 Input 수동값 Fallback |
| P1당 가치 | **코호트1/2 이원화**(2026-07-27): CurrentFYP1V(a)=코호트1 Revenue÷타겟FY New P1, PrevP1V(b)=코호트2 Revenue÷(all-time 총 P1−타겟FY New P1). Revenue는 Deal Tracker 원천(Leads_OPS Revenue 컬럼 아님). a/b 블렌딩 방식은 미정(임시 a 사용) |
| 월 배분 | 시즌성 비례 (벤치마크 월 분포 재활용) |
| 벤치마크 | 가중평균 — New P1: FY24·25·26=1:2:3 / CPNP1: FY25·26=2:3 (확보 FY만), 기간 불일치 허용 |
| CPNP1 목표 | 벤치마크 × 개선계수(<1.0, 그룹별, 초기 0.9) |
| 실적 Spent | 8/3 이후 월~일 1:1, 이전 주는 공란 (월평균 분배 방식 기각) |
| 통화 | NZD 통일 (Meta $=NZD, Naver `SpentNZD`) |
| Naver | 전액 contact 합산 (트래픽성 캠페인 없음) |
| 채널시트 | 이관 안 함, `openById()` 외부 참조 |
| 파라미터 위치 | Engine 블록 0 (REP 아님), 전부 편집 가능 셀, 빌드가 보존 |
| Engine 표시 | 숨김 (파라미터는 FY당 1회 세팅) |
| P1/Revenue 정의 | NewP1_REP 재사용 (Leads_OPS 단일, 유효 Priority, `Revenue` 컬럼) |

## 14. 연간 전환 체크리스트 (Annual FY Rollover, 2026-07-27 메모)

**구조상 특징**: `Target_Engine` Block 0의 "Target FY" 입력값 하나로 어느 회계연도를 계산할지
결정한다 — Engine/Report 둘 다 **그 시점에 한 FY만** 다룬다(멀티 FY 동시 표시 아님). 그래서
FY가 바뀔 때(예: FY27 → FY28, 2027-08-01부터)마다 아래 절차를 **수동으로** 밟아야 한다.
`refreshTargetActuals_()`(Append/Sync마다 자동 실행)는 FY 전환을 대신 해주지 않는다 — 이미
리포트에 있는 행들의 Actual 값만 갱신할 뿐, Target FY를 바꾸거나 새 FY용 행을 만들어주지 않는다.

**절차**:
1. `Target_Engine` 시트 숨김 해제
2. Block 0(Input) 값 갱신: `Target FY`(예: 27→28), `Marketing Revenue Target`(그 해 마케팅 Revenue
   타겟), 그룹별 `Improvement Factor`×3, (딜트랙커 이관 전이라면) 그룹별 `Deal Share`×3 수동 재산정
3. Apps Script 편집기에서 `runGenerateTargetReport()`(`91_TargetReport.js`) 직접 Run
4. `Target_Engine` 시트 다시 숨김 처리 (선택)

**주의**: 리포트를 재생성하면 그 시점의 Target FY 기준으로 리포트 영역 전체를 덮어쓴다 — 예를
들어 FY28로 바꿔서 재생성하면 화면에서 FY27 주들은 사라진다. 데이터 자체가 손실되는 건 아님
(New P1/Revenue는 `Leads_OPS`에 그대로 있고, 채널시트/Naver도 그대로 있어 Target FY를 다시
27로 돌려서 재생성하면 복구됨) — 다만 두 FY를 동시에 한 화면에서 볼 수는 없는 구조.

**미해결**: 이 절차를 트리거하는 알림/리마인더는 없음(사람이 기억해서 매년 8월 초에 수동으로
실행해야 함). 자동화(예: 매년 8/1 근처 트리거로 알림만 보내기 등)는 아직 설계 안 됨 — 필요하면
별도 논의.
