# Events_OPS / Events_Engine 설계 (2026-07-24)

> **구현 상태 (2026-07-24, 실데이터 검증 완료)**: `50_Events_Config.js` ~ `55_Events_Styles.js`
> (6개 파일, 50번대). 실데이터로 여러 차례 검증하며 이 문서 최초 버전의 매칭 방식(UTM Key,
> `_US-50` 국가 suffix)은 폐기되고 `Lead Source Detail`/`First Touch Detail`(Marketo Program
> 이름) 기준 + KR 필터 + WB/EV TYPE 필터로 교체됨 — 최종 385개 프로그램 확인(연 50~60개 ×
> 5~7년 실측치와 부합). Event Date/EventType 자동 채움, 등록 폼 접미사 중복 버그 수정,
> 사용자 지정 컬럼명/순서/색상/테두리, 메뉴("🗂️ OPS" → "Update Events")까지 반영 완료.
> 아래 본문은 최초 설계 시점 기록이라 일부(매칭 방식, 4-시트 구조 논의 등) 실제와 다름 —
> 최신 상태는 `docs/Changelog.md` 2026-07-24 "실데이터 검증 후 대폭 수정" 항목 참고.

## 목적
Webinar/Seminar 대상 프로그램별 ROI 리포트. 별도 파일(`1__Event_mkt2_0.xlsx`)의 실무 시트 3개
(OPs / Ads perf / FTA)를 crimson-lead-tracker 워크북으로 완전 이관 — 데이터만 가져오는 게 아니라
실무 자체(프로그램 운영 트래킹)를 이관한다. 한 행 = 하나의 Marketo 프로그램(국가별로 분리될 경우
프로그램×국가 조합).

## 아키텍처 (최종 확정 — 2-시트 구조)

> ⚠️ 세션 초반에는 4-시트(OPS/Engine/QA/REP) 구조로 논의됐으나, 프로그램 수가 130~150개 규모로
> 작아 QA/REP를 별도 시트로 분리하는 게 과설계라고 판단해 **Engine + OPS 2개로 축소**했다.
> (Leads_OPS/ACQ_REP처럼 리드 35,000+ 건 규모에서 필요했던 자동 QA·집계 분리 패턴이 여기선
> 오버엔지니어링이라는 게 이유 — 규모가 다르면 같은 패턴을 그대로 재사용하지 않는다.)

- **Events_Engine** (숨김) — SF(Leads_Master/MTA_Master) 집계 전용, Disposable(매번 재계산, Master
  로부터 언제든 재생성 가능). Leads_Master/MTA_Master를 프로그램×국가 키로 aggregate.
- **Events_OPS** (보임) — 수동 관리 + View. 최종 산출물. 아래 5개 컬럼 그룹으로 구성:
  - Group 1~3: Manual (자유 편집)
  - Group 4: SF Computed (Engine → View 수식, 시트 보호로 방어)
  - Group 5(신설): Derived — %/CPL/CPNP1/ROAS. Engine이 든 원본 숫자(Group 2/3/4)를 기반으로
    한 View 수식, **시트 보호로 방어**. REP를 없애면서 이 계산을 OPS 안으로 흡수.
- Events_QA, Events_REP는 **만들지 않는다** (2026-07-24 최종 결정).

### 파생지표를 OPS 안에 View로 두는 이유
기존 실무 시트에서 `#DIV/0!` 14건+ 발견됐던 원인은 "파생 수식이 다른 시트에 있었는지"가 아니라
**"수동 편집 시트에 보호 없이 수식이 박혀 있었던 것"**이 원인이었음. Group 4(SF Computed)도 이미
같은 방식(Engine→View, 시트 보호)으로 방어하기로 확정돼 있으므로, Group 5도 동일 패턴을 쓰면
같은 시트 안에 있어도 안전하다. → REP를 별도로 둘 이유가 없어짐.

**⚠️ 신규 구현 필요**: 이 프로젝트에 시트 보호(Range Protection) 패턴이 아직 없다. Google Apps
Script의 `Range.protect()`로 처음 구현해야 함 — 편집 권한 설정을 잘못하면 오너 자신도 잠길 수 있어
주의 필요 (구현 후 반드시 실제 시트에서 수동 검증).

## 행 식별 / 정렬 / 레이아웃
- 프로그램명 = unique 키(국가 분리 시 프로그램×국가 조합)
- 정렬: Event Date 최신순(desc), 빌드가 매번 정렬 출력. 빈 날짜 신규 행은 최상단
- Event Date = 플랜 기반 수동 입력 (SF/자동 소스 없음)
- Archive 분리 없음 (프로그램 수 적음)
- 레이아웃: 1행 = SUBTOTAL 수식 행, 2행 = 헤더, 3행~ = 데이터 (빌드가 SUBTOTAL 보존/재생성)
- FY, Month 컬럼 = Event Date에서 빌드가 계산하는 파생 컬럼 ("FY27" 표준 표기)

## 데이터 소스 원칙 (하이브리드 — 2026-07-24 확정)
"모든 리포트는 Leads_OPS를 읽는다"는 기존 원칙과 충돌하지만, ACQ_REP 선례를 따라 다음과 같이
하이브리드로 확정:

| 지표 | 소스 | 이유 |
| --- | --- | --- |
| All Registered | MTA_Master (프로그램 매칭) | 전체 등록(모든 터치) — ACQ_REP의 "All Leads"와 동일 패턴 |
| New Registered | Leads_Master (프로그램 매칭) | 신규 리드만 — ACQ_REP의 "New Leads"와 동일 패턴 |
| IC Request/Booked/Complete/Deals(Won)/Revenue | **Leads_OPS** | 이미 동기화된 값 그대로 읽음. 이중 계산 없음, 원칙 최대한 유지 |

리드 귀속 = First Touch Attribution 기준 (item 13, 원 설계 결정 유지).

### 프로그램 매칭 컬럼 (코드 확인 완료, 2026-07-24)
- **MTA_Master** (All Registered용): `MKT UTM Campaign` — 터치 레벨 실제값 (2026-07-22에 이미
  "Lead: Last MKT UTM Campaign"에서 이 필드로 정정됨, `13_MTATransformer.js` v5.0.0 참고)
- **Leads_Master** (New Registered용): `First MKT UTM Campaign` — Lead 레벨 최초 터치 캠페인
  (`12_LeadTransformer.js`)
- ⚠️ MTA_Master에도 `First MKT UTM Campaign`이 별도 존재(Lead 레벨 스냅샷이 모든 터치 row에 반복)
  — 프로그램 매칭에 절대 쓰면 안 됨. 반드시 `MKT UTM Campaign`(터치 레벨)을 사용할 것.
- 필터: Business Segment = `Webinar`, `Seminar` (현재 `CONFIG.ACQ.SEGMENTS`와 `docs/BusinessSegmentClassification.md`가 이미 최신 — 별도 스킬 문서(marketing2-report-bizrules)는 이 저장소 밖의 얘기라 여기서 손댈 대상 아님)

## 국가(KR/US 등) 분리 — Engine 자동 분리 (2026-07-24 확정)

리드 단위 국가 판별이 `MKT UTM Campaign` 값 자체로 가능하다고 확인됨. 수동 예외 행 방식을 버리고
Engine이 UTM 패턴으로 프로그램×국가 조합 행을 자동 생성한다.

### 파싱 규칙
- 캠페인/UTM 문자열의 **항상 맨 끝**에 `_{2자리 대문자 국가코드}-{split%}` 형태가 옴
  (예: `webinar-2026-mktg_US-50`, `..._SG-50`)
- 국가별로 **완전히 다른 캠페인/UTM 문자열**이 존재 (`A_US-50` ≠ `A_SG-50`) — 터치 하나하나가
  이미 특정 국가에 귀속되어 있어, 등록자 수를 비율로 "배분"할 필요가 없음
- **split%의 의미** = Meta 광고비(Spent)만 국가 변수 간 나누는 비율. 등록자 수는 각 UTM 변수로
  실제 들어온 터치를 그대로 카운트 (배분 안 함)
  - 예: 캠페인 A 전체 Spent=$1,000, `A_US-50`/`A_SG-50` 두 변수 존재 → 각 $500씩 분배
  - 등록자 수는 각 변수의 실제 터치 수 그대로 (US 120명, SG 80명이면 그대로 120/80)
- 정규식 형태로 안전하게 파싱 가능 (예: `/_([A-Z]{2})-(\d+)$/`) — 단, 실 데이터로 최종 검증 필요

### UTM Key 컬럼의 역할
정식 매칭키로 유지. Events_OPS 각 행(프로그램×국가)의 UTM Key = 그 국가 변수의 실제 캠페인
문자열(예: `A_US-50`). Engine이 이 값으로 MTA_Master/Leads_Master의 매칭 컬럼과 정확히 매칭한다.

## 이관 정책
- 외부/파트너 이벤트 4건(Medigate, Metlife, Crimson 고객 웨비나, Kor-EXPO-Master) 이관 제외
- `#REF!` 깨진 행 7개(Ads perf)는 복구 가능 — 복구 후 이관
- 캠페인명 충돌 시 OPs 시트가 정본 (FTA는 OPs 복사본). 단 2024-06-29 행의 "WB-2025-07-" 프리픽스
  시점 모순은 이관 QA에서 Marketo 원본 재확인
- Division 컬럼 유지 (현재 전부 Core, 확장 대비). LP/LG/All = 광고 타입별 CVR로 컬럼명 명확화
- 공란 UTM 29건 = 입력 지연 백로그 (구조적 공란 아님)

## SF 미매칭 프로그램 처리 (2026-07-24 확정)
수동으로 등록된 프로그램인데 MTA_Master/Leads_Master에서 해당 UTM으로 매칭되는 터치가 0건인
경우 — **별도 처리 없이 항상 0으로 표시**. Events_QA를 안 만들기로 했으므로 별도 플래그/알림 없음
(프로그램 수가 적어 수동으로 눈으로 확인 가능하다고 판단).

## 컬럼 그룹 (스키마 확정)

**그룹 1 — 정의 (Manual)**: Event Date / Marketo Campaign name / Target Market(신설 — 기존엔
Speaker 칸에 "US Campaign"으로 숨어있었음) / UTM Key / Division / EventType / PIC / Speaker / Time
/ Notes(FTA 무헤더 Y열 승격)

**그룹 2 — Marketo/Zoom (Manual)**: Reg. / PL / NL(MKT) / Success / SPL / SNL

**그룹 3 — Meta 광고 (Manual, 캠페인 누적)**: LP CVR / LG CVR / All CVR / Clicks / Leads(Meta) /
Spent — FTA·Ads perf 중복 저장 제거, 단일 저장

**그룹 4 — SF Computed (Engine→View, 시트 보호)**: All Registered(MTA) / New Registered(Leads) /
P1 All / NL P1 / IC Request / IC Booked / IC Complete / Deals(Won) / Revenue / Match Rate

**그룹 5(신설) — Derived (Engine 원본값 기반 View, 시트 보호)**: %계열 / CPL / CPNP1 / ROAS
(REP를 없애면서 흡수)

**파생 컬럼 (빌드 계산)**: FY, Month

### 정책 확정된 세부 값
- **Match Rate 분모**: Reg.(Marketo/Zoom 실제 등록자 수) 기준 — "등록자 중 몇 %가 실제 SF 리드로
  전환됐는가"
- **Revenue 통화**: SF `Won Opportunity's Amount (converted)` 원시값 + `...Currency` 컬럼 그대로
  사용, 환산 안 함. ⚠️ 필드명이 "converted"라도 row마다 통화 코드가 다를 수 있는 구조라, 실제로
  다른지는 샘플 데이터로 확인 필요 (구현 중 확인)
- **Month 컬럼**: 포함, FY와 동일하게 빌드가 Event Date에서 계산

## 파일 검증에서 나온 핵심 사실 (`1__Event_mkt2_0.xlsx`)
- FTA 135행 / OPs 136행 / Ads perf 142행, FY24~27, 2024-06-29~2026-08-19
- 캠페인명 3시트 교집합 132개로 양호하나 단독 유일키 아님 (반복 이름 존재 — 다른 연도 재사용 +
  KR/US 분리)
- FTA 퍼널 컬럼 사실상 미기입 (IC Booked 1/135, Complete 0/135) → 자동화 필요성 실증
- FTA.Spent = Ads.Spent 125건 100% 일치 (이중 입력 실증)
- Ads perf UTM: 문자열 112 / 공란 29 / 오염 1, 후행 개행 11건 — 정제 필요
- KR/US 분리 시 UTM이 국가별로 다름 (US행: `..._US-50` 패턴)

## 참고
- 원본 파일: `1__Event_mkt2_0.xlsx` (FTA/OPs/Ads perf) — 스키마 검증 완료본
- 패턴 참고: `docs/ACQReportDesign.md` + `docs/ACQReportImplementation.md` (Engine/Aggregate Table
  구조, ACQ_Summary 숨김 시트 패턴) — 원 설계 문서가 인용한 `docs/NewP1ReportDesign.md`는 이
  저장소에 존재하지 않음 (별도 도구/세션에서 작성된 문서로 추정, 확인 필요)
- Leads_OPS Merge 패턴 참고: `22_OPS_Merge.js` (키 기준 Manual 컬럼 보존 + 전체 재작성 + 정렬 출력)
- 세션 이력: `docs/Changelog.md` 2026-07-24
