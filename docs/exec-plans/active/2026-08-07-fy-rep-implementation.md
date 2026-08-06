# FY_REP 구현 — FY24/25/26 Marketing/ACQ/Pipeline/Revenue 비교 리포트

**관련 로드맵 항목**: docs/Roadmap.md "계획 중" §"FY별 Sales Funnel 대시보드 — 2026-08-07 재착수"
**시작일**: 2026-08-07

## Goal

FY24/FY25/FY26을 월별로 나란히 비교할 수 있는 신규 시트 `FY_REP`을 만든다. 4개 섹션으로
구성:

1. **Marketing** — FY×Month×채널(Meta/Google/Naver 등), Spent/Results/CPL (전부 NZD 환산)
2. **ACQ** — FY×Month×세그먼트(Leads_OPS Business Segment 7개), New Leads/New P1/SAL
3. **Pipeline** — FY×Month×세그먼트, IC Booked/Completed/Deals(건수). Upsell/Referral은
   건수만 별도 라인
4. **Revenue** — FY×Month×세그먼트(7개+Upsell), Target(추정치, 라벨링)/Actual Revenue

이 작업이 끝나면: 실무자가 `FY_REP` 시트 하나에서 3개 연도의 마케팅 성과를 한눈에 비교할 수
있어야 한다.

## Goal이 아닌 것 (Out of Scope)

- Google Ads 자동 수집 파이프라인 구축 — `AD.SPREADSHEET_ID`(Campaigns 2.0)의
  `GoogleSearch_Raw` 탭이 비어있음을 확인(2026-08-07), 별도 프로젝트로 분리
- Target_Engine의 "한 번에 FY 하나" 구조 자체를 다중 FY로 재설계하는 것(OpenItems #17) —
  FY_REP은 그 문제를 우회(외부 시트 Target 직접 읽기)하지, Target_Engine을 고치지 않음

## 데이터 소스 확정 (2026-08-07, 여러 차례 실물 확인 후)

### Marketing 섹션 — `perfTrackerByFY` (신규, 사용자가 이 세션 중 생성)

- 스프레드시트 ID: `1DhJynLE6eySh6X9X-Zsgbs6HvuXDT5omjf_m0XjXQ3o`
- 탭: `FY24`(gid=0) / `FY25`(gid=686876369) / `FY26`(gid=1164504125)
  - **탭명 "FY26"은 이름만 구버전** — 실제 담긴 기간은 2025-08~2026-07(우리 시스템 기준
    진짜 FY26)이 맞음, 사용자 확인 완료(2026-08-07). "FY24"/"FY25" 탭은 이름 그대로.
- 각 탭 구조 2단:
  1. **Quarterly Summary**(1~23행 부근, 회사 전체): B열=Q1~Q4/월 라벨, C열부터
     Revenue Target/ROAS Target/Budget Target/Revenue Actual/(%Revenue)/ROAS Actual/
     Total Spend/%Budget/No. of deals — **Revenue 섹션의 회사 전체 Target 원천**
  2. **플랫폼 블록**(헤더행: FY24/25=25행, FY26=27행부터): A열=플랫폼명(줄바꿈에 통화
     표기 포함, 예 "Google Paid Search\nCORE\n(AUD)"), B열=지표명, **C~N열 = 8월~7월
     고정 12개월**(실측 확인 완료 — 3개 탭 전부 col3=Aug...col14=Jul 일치), FY26 탭만
     O열(15)에 FY 합계 추가.
     - 지표명(B열) 목록: Channel Revenue / ROAS / 3 Months Moving Average / Deals /
       Average deal size / Cost per deal / Number of IC booked / Amount spent (total) /
       Clicks / Average CPC / CTR / Impressions / CPM / (Cost -) Leads - CPL - CTR - CvR
       각각 consults/event/content 3세트
     - **연도마다 추적 플랫폼이 다름**(사용자 확인, 정상) — FY24/25: Facebook, Google
       Paid Search, Youtube, Google Display/Discovery/PerfMax, TikTok, LinkedIn,
       Naver Search(FY24만) 또는 Bing/Snapchat(FY25만), Others(1~2개). FY26: Facebook,
       Google Paid Search, Google Performance Max, Google Demand Gen, Naver Search,
       Naver Display. 없는 연도는 그 플랫폼 행 자체가 없음 — 코드에서 플랫폼 존재 여부를
       가정하지 말고 탭별로 A열 스캔해서 동적으로 목록을 구성할 것.
     - **통화가 플랫폼마다 다름**(Facebook=NZD, Google 계열=AUD, TikTok=USD, Naver=KRW 등,
       A열 라벨에 괄호로 표기됨) — **사용자 확정(2026-08-07): 전부 NZD로 환산해서 표시**.
       기존 `fetchKrwToNzdRate_()`(AD_004_SpendCache.js, GOOGLEFINANCE 우회 패턴)를
       AUD/USD도 지원하도록 일반화 필요(신규 FX 페어 추가, 같은 숨김시트 패턴 재사용).

### ACQ / Pipeline 섹션(Actual) — 우리 시스템 자체

- New Leads/New P1/SAL: `Leads_OPS`, `NewP1_REP`(`40_NewP1Report.js`)의 코호트 집계 로직과
  동일 패턴 재사용 (Create Date 기준 FY/Month 파생, Business Segment 컬럼 그대로 사용,
  FT Override 재판정 없음)
- IC Booked/Completed: `Leads_OPS`의 `IC Booked Date`/`IC Completed Date`
- Deals/Revenue(Actual): `Deal Tracker`([KOR] Deal Tracking), `computeNewP1DealWonRevenueFromRows_()`
  패턴(`40_NewP1Report.js`) 재사용 — 딜의 Created Date 코호트 + Segment 컬럼 직접 집계,
  리드 단위 매칭 없음. Upsell/Referral은 그 자체를 별도 카테고리로 분리(Other로 접지 않음 —
  ACQ_REP/NewP1_REP과 다른 점, 사용자가 Pipeline/Revenue 섹션에서 명시적으로 요청).

### Revenue 섹션 — Target(세그먼트별) 추정

- 회사 전체 월별 Target: 위 `perfTrackerByFY` Quarterly Summary의 Revenue Target
- 세그먼트별 배분: **추정치** — 회사 전체 Target × 그 FY의 세그먼트별 딜 비중(Deal Tracker
  코호트1 기준, `90_TargetEngine.js`의 `computeDealShareRatiosFromDealRows_()` 계열 재사용/
  일반화). **실제 그 시점에 세운 세그먼트별 목표가 아니라는 것을 컬럼 헤더/스타일로 명확히
  라벨링**(사용자 확정 — "Target(추정)" 등, 정확한 표기는 스타일 작업 시 확정)

## Progress

- [x] "0. Weekly" 레거시 외부시트(FY 탭) 구조 확인 — Target/Spent 있음, 세그먼트별 Target 없음
- [x] 디지털팀 다운로드 트래커(xlsx) 구조 확인 — KR 탭에 플랫폼별 월별 데이터, 단 FY27
      1년치만 (파일명 FY26은 오표기)
- [x] `AD.SPREADSHEET_ID`(Campaigns 2.0) 확인 — Meta_Raw/KakaoSMS_Raw는 이미 파이프라인
      연결됨, GoogleSearch_Raw는 비어있음(Google 자동 수집 미착수)
- [x] `perfTrackerByFY`(사용자 신규 생성) 구조 확인 — FY24/25/26 3개 탭, Quarterly Summary +
      플랫폼 블록, 컬럼 매핑까지 실측 확정
- [x] 데이터 소스 전체 확정, 사용자 최종 확인("이거면 충분해?" → 통화 NZD 통일만 추가 확인)
- [x] `CONFIG.FYREP` 신규(00_Config.js v1.29.0) — 시트명, 외부 스프레드시트 ID/탭/헤더행,
      월 컬럼 범위, 지표 라벨(SPENT는 접두사 매칭 필요함을 실측 중 추가로 발견해 반영) 정의
- [ ] FX 유틸 일반화 — `fetchKrwToNzdRate_()`(AD_004_SpendCache.js)를 AUD/USD도 되게 확장
- [ ] Marketing 섹션 Engine — `perfTrackerByFY` 플랫폼 블록 읽기/파싱, 채널 동적 목록,
      NZD 환산
- [ ] ACQ 섹션 Engine — Leads_OPS 코호트 집계 (NewP1_REP 패턴)
- [ ] Pipeline 섹션 Engine — Leads_OPS(IC Booked/Completed) + Deal Tracker(Deals 건수,
      Upsell/Referral 분리)
- [ ] Revenue 섹션 Engine — Deal Tracker(Actual, 세그먼트별) + Target 추정(Deal Share 배분)
- [ ] Report/Write 레이어 — 4섹션 레이아웃, 헤더, Target(추정) 라벨링/스타일
- [ ] 파일 번호대 확정 — 90번대(Target)와 붙여 쓸지 별도 100번대로 뺄지 구현 착수 시 결정
- [ ] 실 시트 검증 (사용자 확인)

## Surprises & Discoveries

- 레거시 "0. Weekly" 시트의 FY 컬럼 블록들이 대부분 숨김 처리돼 있었으나(Revenue만 노출),
  Apps Script `getRange().getValues()`는 숨김 여부와 무관하게 값을 정상적으로 읽음 — 문제
  없음, 사용자 우려("hide된 값 안보이면 알려줘") 해소.
- 레거시 시트/디지털팀 트래커 둘 다 "FY26"이라는 이름이 실제로는 다음 회계연도(우리 기준
  FY27, 2026-08~)를 가리키는 표기 지연(rollover 시점에 이름을 안 바꾸는 습관)이 있음 —
  향후 유사 외부 파일을 열 때 파일명/탭명의 FY 표기를 곧이곧대로 믿지 말고 실제 날짜 값으로
  검증할 것.
- Google Ads 데이터는 이 프로젝트 어디에도 체계적으로 수집되고 있지 않음(레거시 시트의
  MonthlyGFA도 최근 몇 달치뿐, `GoogleSearch_Raw`는 빈 탭) — FY_REP Marketing 섹션에서
  Google 열은 `perfTrackerByFY`의 플랫폼 블록에 그 연도 데이터가 있으면 쓰고, 없으면 공란.
- 플랫폼 블록 표는 월(month)이 컬럼, Quarterly Summary는 월이 행(row) — 같은 탭 안에 두
  섹션의 grain 방향이 반대라 헷갈리기 쉬움, 구현 시 주의.

## Decision Log

- **독립 신규 시트 vs 기존 리포트 확장**: 독립 `FY_REP` 시트로 확정(2026-08-07, 사용자) —
  2026-07-30의 "확장" 결정을 뒤집은 것이지만, 그건 대체가 아니라 병행(ACQ_REP/NewP1_REP의
  Target 컬럼 확장은 이미 배포됐고 그대로 유지, 단일 FY 조회용으로 계속 씀).
- **세그먼트 범위**: Leads_OPS Business Segment 전체 7개(Seminar/Webinar/BOFU/Search/
  Content/Referral/Other) — Target_REP 등이 쓰는 5개로 좁히지 않음(사용자 확정).
- **Marketing "채널"의 정의**: Business Segment 아님, 실제 광고 매체(Meta/Google/Naver 등)
  — 사용자가 명시적으로 정정(2026-08-07).
- **Pipeline vs Revenue 역할 분리**: Pipeline=건수 중심(Upsell/Referral도 건수만), Revenue=
  금액 중심(세그먼트별 Target/Actual $) — 사용자 확정.
- **세그먼트별 Target은 추정치**: 실제 과거 세그먼트별 목표가 시스템 어디에도 없음(사용자
  확인) — 회사 전체 Target × 그 FY Deal Tracker 딜 비중으로 역산, 반드시 "추정" 라벨.
- **채널 통화는 NZD로 통일 환산**(사용자 확정) — 플랫폼별 원본 통화 그대로 두는 대안은
  기각.
- **Google 자동 수집은 이번 스코프 제외** — GoogleSearch_Raw가 비어있다는 게 확인된 뒤
  사용자가 "그건 별도로"라고 명시하지는 않았으나, 규모상 별도 프로젝트가 필요하다고 판단해
  Out of Scope로 명시(다음 세션에서 재확인 필요하면 다시 논의).

## Outcomes & Retrospective

(작업 완료 후 작성)
