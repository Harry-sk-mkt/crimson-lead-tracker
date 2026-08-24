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
- Deals(Pipeline, 건수): `Deal Tracker`([KOR] Deal Tracking), `computeNewP1DealWonRevenueFromRows_()`
  패턴(`40_NewP1Report.js`) 재사용 — 딜의 **Created Date 코호트** + Segment 컬럼 직접 집계,
  리드 단위 매칭 없음. **Revenue(Actual, 2026-08-08 수정)**: 처음엔 Deals와 동일하게 Created
  Date 코호트로 구현했으나, 사용자 피드백("코호트가 아니라 ACQ_REP의 Revenue처럼 그 달에
  얼마 했는지를 봐야 한다")으로 **Close Date 기준 그 달 실제 발생액**으로 전환(ACQ_REP의
  `computeACQDealRevenueFromRows_()`와 동일 사상) — Deals(건수)와 Revenue(금액)가 서로 다른
  날짜 기준을 쓰는 것으로 최종 확정. Upsell/Referral은 그 자체를 별도 카테고리로 분리(Other로
  접지 않음 — ACQ_REP/NewP1_REP과 다른 점, 사용자가 Pipeline/Revenue 섹션에서 명시적으로 요청).

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
- [x] FX 유틸 일반화 — `fetchFxRateToNzd_(currencyCode)`(AD_004_SpendCache.js v1.3.0)
      신규, `AD.FX.RATES`(AD_001_Config.js v1.18.0) KRW/AUD/USD. 기존
      `fetchKrwToNzdRate_()`는 하위호환으로 그대로 유지, 새 함수만 추가.
- [x] Marketing 섹션 Engine(`FYREP_001_Engine.js` v1.0.0) — `perfTrackerByFY` 플랫폼
      블록 읽기/파싱(FY24/25는 헤더 1번만, FY26은 블록마다 반복 — 둘 다 대응 확인),
      채널 동적 목록, NZD 환산. **실측 중 발견(2026-08-08)**: 통화 판정은 플랫폼명이
      아니라 **Spent 행 라벨 자체의 "(NZD)" 표기를 우선** — FY26 탭은 전 플랫폼
      Spent 라벨에 통화가 명시돼 있어(플랫폼명엔 없는 경우多) 기존 "플랫폼명으로만
      판단" 가정(00_Config.js 주석)이 FY26엔 안 맞음, 라벨 우선 + 플랫폼명 폴백으로
      일반화해 3개 탭 전부 커버. 순수 함수 4개 유닛 테스트 Node로 실행 확인(PASS) —
      실제 시트 값으로는 아직 미검증.
- [x] ACQ 섹션 Engine — Leads_OPS 코호트 집계 (NewP1_REP 패턴)
- [x] Pipeline 섹션 Engine — Leads_OPS(IC Booked/Completed) + Deal Tracker(Deals 건수,
      Upsell/Referral 분리). **구현 시 결정**: ACQ/Pipeline의 Leads_OPS 파생 지표(New
      Leads/New P1/SAL/IC Booked/IC Completed)는 FY×Month×Segment로 같은 코호트 키를
      쓰는 같은 소스라 `aggregateFYRepLeadsOPSFromRecords_()` 하나로 통합(시트 중복
      스캔 방지) — Report 레이어에서 ACQ/Pipeline 두 섹션으로 나눠 씀. Deals(건수)는
      Deal Tracker 소스라 별도 `aggregateFYRepDealCountsFromRows_()`.
      `FYREP_001_Engine.js` v1.1.0, 유닛 테스트 3개 Node로 PASS 확인(실 시트 값은 미검증).
- [x] Revenue 섹션 Engine — Deal Tracker(Actual, 세그먼트별) + Target 추정(Deal Share 배분).
      **구현 시 결정(2026-08-08, 사용자 확정)**: Target 배분은 7세그먼트+Upsell 전체
      대상(Target_Engine의 5세그먼트 전용 Deal Share와 별개 함수,
      `computeFYRepDealShareRatiosForFY_()` — Upsell/Referral을 분모·분자에서 제외하지
      않음). Quarterly Summary Revenue Target 컬럼 구조는
      `runInspectFYRepQuarterlySummaryColumns()`(96_TempQA_FYRepExternalSheet.js
      v1.7.0)로 실측 확인 — B열=월 라벨, **C열=Revenue Target이 3개 탭 전부 동일**
      (FY26이 F열 뒤에 "% Revenue" 컬럼을 끼워 넣어 그 뒤 컬럼만 밀림, C열 앞은 무관).
      `CONFIG.FYREP.QUARTERLY_SUMMARY` 신규(00_Config.js v1.30.0).
      `FYREP_001_Engine.js` v1.2.0, 유닛 테스트 4개 Node로 PASS 확인(실 시트 값은 미검증).
- [x] Report/Write 레이어(`FYREP_002_Report.js`/`FYREP_003_Styles.js`) — **v1.0.0
      구현 후 사용자 피드백(2026-08-08, "세로로 너무 길고 범위가 넓다")으로
      v2.0.0 전면 재설계**:
      - **Control Area(체크박스 4개, 사용자 확정)**: 시트 상단(LABEL_ROW=1/
        CHECKBOX_ROW=2)에 Marketing/ACQ/Pipeline/Revenue 체크박스 — 체크된
        섹션만 Engine 호출 + 작성, 체크 안 한 섹션은 빈 자리도 안 남기고
        건너뜀. `setupFYReport()`는 재실행해도 기존 체크 상태를 안 건드림
        (라벨/데이터 검증만 다시 씌움), 최초 생성 시에만 4개 다 체크로 시작.
      - **레이아웃(사용자 확정, "FY를 컬럼으로 Month를 행으로")**: v1.0.0의
        FY×Month×Segment 플랫 행 나열(세그먼트당 36행) 대신, 세그먼트/채널마다
        블록을 만들고 블록 안에서 **Month가 행(12개, AUG→JUL), FY가 컬럼**인
        피벗 표(perfTrackerByFY 원본의 "지표=행/월=열" 사상과 동일 계열) —
        세그먼트당 12행(+헤더 3행)으로 축소. 지표 그룹 헤더는 병합 셀로
        FY 3개 컬럼을 아우름(Target_REP의 `mergeAcross` 관례 재사용).
      - Report 영역만(`CONFIG.FYREP.REPORT_START_ROW`부터) 매 Generate마다
        clear, Control Area 체크박스는 보존.
      - Revenue Target% ≥100% 강조는 기존 ACQ_REP `highlightAtOrAboveThreshold_()`
        (#C6E0B4) 그대로 재사용 — 새 색상 안 만듦.
      - 메뉴(00_Menu.js) 배선 없음 — 기존 NewP1_REP/Target_REP과 동일하게 Apps
        Script 편집기에서 `setupFYReport()`→`runGenerateFYReport()` 직접 Run
        방식(프로젝트 관례, "Manual Execution Instructions" 확인).
      - 유닛 테스트 3개(collectFYRepDynamicBlockKeys_/buildFYRepPivotIndex_/
        buildFYRepPivotDataRows_) Node로 PASS 확인.
- [x] 파일 번호대 확정(2026-08-08, 사용자) — 90번대도 100번대도 아닌 AD_ 스타일
      신규 컨벤션 채택: `FYREP_NNN_Name.js` (FYREP_001_Engine.js/FYREP_002_Report.js/
      FYREP_003_Styles.js). CONFIG.FYREP는 기존 방침대로 00_Config.js에 계속 유지
      (AD_001_Config.js처럼 분리하지 않음 — 이미 그렇게 구현돼 있었고 이번 결정은
      Engine/Report/Styles 파일에만 해당).
- [ ] 실 시트 검증 (사용자 확인) — 진행 중, Report/Write 레이어가 3차례
      재설계됨(Engine 레이어는 전혀 안 바뀜):
      1차: 체크박스 기본값 버그 발견·수정(FYREP_002_Report.js v2.1.0).
      2차: Revenue Actual을 Created Date 코호트→Close Date 기준 그 달 실제
      발생액으로 전환(`aggregateFYRepDealRevenueFromRows_()` FYREP_001_Engine.js
      v1.3.0), Target 안내 문구를 헤더 셀 Note로 전환(v2.2.0).
      **3차(최종, 2026-08-08)**: "세로로 길고 범위가 넓다"는 반복 피드백 끝에
      최종 레이아웃 확정 — Control Area가 A1:B2(Start/End FY 드롭다운,
      NewP1_REP 패턴 재사용)+C1:F2(섹션 체크박스)+C3:E3(Marketing/ACQ/Pipeline
      지표 드롭다운, Revenue는 Actual 고정)로 재구성. Report 영역은 **세그먼트/
      채널이 컬럼, Month가 행, FY 범위만큼 블록이 세로로 반복**, 섹션당 지표
      1개만 표시(드롭다운으로 전환 가능) — v2.x의 "지표=병합헤더, FY=서브컬럼"
      피벗 완전 폐기. `FYREP_002_Report.js`/`FYREP_003_Styles.js` v3.0.0,
      유닛 테스트 5개 Node로 PASS 확인.
      **4차(2026-08-08)**: Generate 체크박스(A3:B3) 추가 — Target_REP과 동일한
      이유(Simple Trigger 권한 부족, docs/OpenItems.md #11)로 설치형 트리거
      (`onFYReportEdit_()`/`runInstallFYReportGenerateTrigger()`)로 구현.
      **5차(2026-08-08)**: 모든 블록에 Total 행(컬럼별 합계), Revenue 블록에
      Sum 컬럼(세그먼트 값 행별 합계, 8세그먼트+Upsell 기준 자연스럽게 J열),
      Sum이 그 달 회사 전체 Revenue Target 초과 시 `#01EF18` 하이라이트,
      Generate 완료 후 섹션 체크박스(C2:F2)도 자동 해제, 블록 전체 테두리.
      `FYREP_002_Report.js`/`FYREP_003_Styles.js` v3.4.0/v3.1.0, 유닛
      테스트 7개 Node로 PASS 확인.
      **6차(2026-08-08, 실측 버그 수정)**: Revenue 실행 후 Marketing/Results로
      재실행하면 Total 행에 "$" 잔여 서식이 남는 버그 발견 — 정수 카운트
      지표(Results/New Leads/New P1/SAL/IC Booked/IC Completed/Deals)의
      format이 `null`이라 이전 실행의 통화 서식이 덮어써지지 않고 남아있던
      게 원인. 전부 `"0"`으로 명시 + Styles 레이어가 서식을 조건 없이 항상
      재적용하도록 수정(`FYREP_002_Report.js`/`FYREP_003_Styles.js`
      v3.5.0/v3.2.0).
      **7차(2026-08-08)**: 정수 지표 서식 "0"→"#,##0"(1000단위 콤마, 사용자
      요청). Marketing 채널 표시명 매핑(`FY_REP_MARKETING_CHANNEL_DISPLAY_MAP`)
      + 제외 목록(`FY_REP_MARKETING_CHANNEL_EXCLUDE`) 신규 — 원본 채널명이
      길어 컬럼 너비가 들쭉날쭉하던 문제 해소, "Others" 등 노이즈성 채널
      제거. **발견(미해결)**: "Content Performance"가 채널로 잡히는 건
      perfTrackerByFY 원본의 장식용 섹션 헤더 행이
      `scanFYRepMarketingPlatformBlocks_()`에 블록으로 오인식된 것으로
      추정(실제 지출/리드 데이터 없는 빈 컬럼일 가능성) — 사용자가 삭제 대신
      "Content"로 개명 요청해 일단 그대로 따름, 스캔 로직 수정 여부는 미정.
      `FYREP_002_Report.js` v3.6.0, 유닛 테스트 1개 추가 Node로 PASS 확인.
      **8차(2026-08-08)**: FY 블록을 최신이 위로 오도록 역순 표시. Sum
      컬럼(행별 합계)을 Revenue 전용→4개 섹션 전체로 확장(Target 초과
      하이라이트는 여전히 Revenue만 — 다른 섹션엔 비교할 Target이 없음).
      `FYREP_002_Report.js` v3.7.0.
      **9차(2026-08-08)**: "27도 추가해줘. 이후 년도도 자동으로 추가되게
      하자" — `CONFIG.FYREP.FYS`를 하드코딩 `[24,25,26]`에서
      `computeFYRepDefaultFYList_(24)`(FYREP_001_Engine.js v1.4.0 신규,
      startFY부터 오늘이 속한 FY까지 자동 계산) 호출로 교체(00_Config.js
      v1.34.0) — 매년 8월 수동으로 배열을 늘려줄 필요 없어짐. Marketing
      섹션은 `perfTrackerByFY`에 FY27 탭이 아직 없으면(TABS 설정에 없음)
      그 FY만 자동으로 빈 값 처리(에러 없이 안전), ACQ/Pipeline/Revenue는
      Leads_OPS/Deal Tracker 라이브 데이터라 FY27도 바로 정상 표시될 것으로
      예상. 유닛 테스트 1개 추가 Node로 PASS 확인.
      **10차(2026-08-20, 이후 세션 미커밋 상태로 중단됐다가 2026-08-24 재개)**:
      "전체 구조를 바꾸려고 해" — 4섹션 체크박스/지표 드롭다운/세그먼트·채널별
      컬럼/FY 블록 세로 반복 전면 폐기, **FY×Month 단일 플랫 테이블**로 교체
      (Control 1행 + SUBTOTAL 3행 + 헤더 4행 + 데이터, `FYREP_002_Report.js`/
      `FYREP_003_Styles.js` v4.x). Target 컬럼(회사 전체)도 perfTrackerByFY
      Quarterly Summary → `Target_Engine`의 "Team Korea" 월별 회사 전체
      Revenue Target(22행 × VAT)으로 전환(`FYREP_001_Engine.js` v1.6.0). 이
      상태로 실 시트 검증 전 세션이 끊겨 미커밋으로 남아있었음.
      **11차(2026-08-24)**: 재개해 `runInspectFYRepComputedMarketingRows()`로
      실측 — Spent $0 문제는 이미 재현 안 됨(72행 중 65행 정상). 대신 10차의
      Target 값이 사용자 기대치보다 낮게 나오는 걸 발견 — 22행 "Marketing
      Revenue Target"이 Referral/Upsell **제외** 마케팅 기여분만 담고 있어
      FY_REP의 Total Rev(Referral/Upsell 포함 8개 버킷 합)와 범위가 안 맞았음
      (사용자 실측 확인). Target_Engine에 신규 24행 "Total Revenue Target"
      (VAT/Referral/Upsell 전부 포함, 사용자가 다른 시트에서 확인한 FY27
      실측치를 그대로 수동 입력)을 추가해 FY_REP Target 소스를 이 행으로
      교체, VAT 배수 곱셈 제거(`CONFIG.TARGET.INPUT.MONTHLY_COMPANY_INPUTS.
      TOTAL_REVENUE_TARGET_ROW` 신규, `TARGET_001_Engine.js` v1.27.0,
      `FYREP_001_Engine.js` v1.7.0, `TARGET_003_Styles.js` v1.8.2,
      `CORE_001_Config.js` v1.42.0). 1회성 값 입력용
      `TEMPQA_022_TargetEngineTotalRevenueSeed.js`(`runSeedTargetEngineTotalRevenueRow()`)
      신규. **재실행 결과 아직 미확인, 완료로 간주하지 말 것.**

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
