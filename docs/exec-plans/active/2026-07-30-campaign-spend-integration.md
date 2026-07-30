# 캠페인 지출 데이터 통합 (Phase 1)

**관련 로드맵 항목**: `docs/Roadmap.md` End Goal Phase 1 — "외부 캠페인 지출 데이터 통합
(CPNP1 실적 계산 기반)"
**시작일**: 2026-07-30

## Goal

세그먼트별(Seminar/Webinar/BOFU/Search/Content) 월별 실제 광고비(Spent)를 자동으로 파이프라인에
통합해서, CPNP1(Cost Per New P1) 실적을 실측 가능하게 한다. 지금은 `Target_Engine` Block 0에
사용자가 매월 수동으로 취합해 입력 중 — 이 수동 취합을 자동화하는 게 목표.

## Progress

- [x] 원래 계획(외부 `Monthly{채널}` 요약 시트 소스) 검토 후 폐기 — 채널/계정 단위 월 집계라
      캠페인 단위 데이터가 없고, "채널 하나를 여러 세그먼트가 공유"(사용자 확인)해서 세그먼트별
      분리가 원천적으로 불가능함을 확인. 상세: `docs/Roadmap.md` Phase 1 "폐기됨" 섹션.
- [x] 신규 방향 확정 — 광고 플랫폼(Meta/Naver SA/Google Ads 등)에서 캠페인 단위 리포트를
      직접 주기적으로 export. 이 프로젝트의 기존 Leads_Raw/MTA_Raw 패턴(원본 불변 append-only,
      부분/겹치는 구간 export도 Incremental Master Build가 안전하게 병합)을 재사용하기로
      확정(사용자 확인, "매번 전체 캠페인 데이터를 추출할 수 없다"는 제약과 정확히 같은 문제를
      이미 이 패턴으로 풀어놓은 상태였음).
- [x] 저장 위치 확정 — 별도 Google Sheet + 같은 Apps Script 프로젝트(crimson-lead-tracker) —
      `SpreadsheetApp.openById()`로 크로스 스프레드시트 접근(Deal Tracker와 동일 패턴). 완전히
      별도 프로젝트(새 바운드 스크립트)는 아님. 사유: 메인 스프레드시트가 이미 무겁다는 사용자
      우려.
- [ ] 새 캠페인 지출 스프레드시트 준비 — 아직 없음(사용자 확인), 사용자가 새로 만들어서 ID 공유 예정
- [x] 대상 플랫폼 8개 확정(사용자 확인): Meta, Naver Search, Naver GFA, Google Search, Google
      Display, Naver Offline Cafe, Kakao Moments, Kakao Channel — 플랫폼마다 export 가능한
      데이터/캠페인 naming 규칙이 다름.
- [x] 파일럿 플랫폼 확정: **Meta** — 전체 패턴(Raw→Master→세그먼트 매핑)을 먼저 이걸로 검증한
      뒤 나머지 7개로 확장(사용자 확인, 2026-07-30).
- [x] Meta 실 캠페인명 샘플 확보 및 검증(2026-07-30) — 사용자가 Meta Ads Manager 리포트 시트
      (`1zOZGwnsm0GhLGGe5rATu8jR5WxAQVx7YmmiPZVU88jY`) 6행 샘플 공유. 컬럼: 보고 시작/보고
      종료/캠페인 이름/시작/종료/노출/도달/링크 클릭/결과/결과 표시 도구/CTR/Click to Lead
      CvR/결과당 비용/지출 금액 (NZD)/결과(초기)/결과(초기) 표시 도구 — 필요한 건 캠페인 이름 +
      지출 금액(NZD) + 보고 시작/종료(그 행이 대표하는 기간).
- [x] 캠페인명 → Business Segment 매핑 검증 완료(2026-07-30) — **`getBusinessSegment()`를
      수정 없이 그대로 재사용**: 샘플 6개 **전부** 코드 수정 없이 정확히 분류됨(event-offline→
      Seminar ×2, event-online→Webinar ×2, ebook→Content ×1, `book-a-consult-acqui_contact-lg`
      →BOFU ×1). Meta 캠페인명 네이밍 규칙(`KR_core_YYYY-MM-DD_slug_tag`)이 Salesforce
      `MKT UTM Campaign`에 이미 쓰이는 규칙과 사실상 동일 — Meta 캠페인명이 Salesforce로 그대로
      흘러들어가는 값이라는 가설과 부합. (처음엔 `book-a-consult-acqui_contact-lg`→BOFU를
      버그로 의심했으나, Marketo 네이밍 정정 목록의 "book a consult 페이지=웨비나" 기록은
      완전히 다른 별개 캠페인("2021-07-KOR-Book a consult page")에 대한 것이었고, 이 Meta
      캠페인은 실제로 BOFU가 맞다고 사용자 확인 — 하이픈/공백 문제 자체가 애초에 없었음.)
- [x] 월별 그레인 확보 방법 확인(2026-07-30, 사용자 확인) — Meta Ads Manager는 한 export가
      "보고 시작~보고 종료" 기간 전체 합산만 주므로, 월별로 받으려면 **매달 리포트 기간을
      해당 월로 바꿔가며 개별 export**해야 함(Meta 쪽에 "월별 breakdown" 옵션 없음, 사용자
      확인) — Leads/MTA와 동일하게 "매번 부분/겹치는 구간 export, Incremental Master Build가
      병합" 패턴이 그대로 필요함을 재확인. Row 키는 (캠페인명 + 보고 시작 + 보고 종료) 조합 —
      월별로 정확히 export하면 이 조합이 (캠페인, 월) 고유 키가 됨.
- [x] Raw 시트 구조 확정(2026-07-30, 사용자 확인) — 월별 탭이 아니라 **Leads_Raw/MTA_Raw와
      동일하게 플랫폼당 탭 1개에 계속 append**하는 구조로 확정. 처음엔 수동 붙여넣기 편의상
      월별 탭을 생각했으나, append 방식도 매달 밑에 이어 붙이기만 하면 되니 상관없다고 확인 —
      기존 Import/중복방지 로직 재사용 가능해서 새로 만들 코드도 줄어듦.
- [x] 종료된 캠페인의 과거 월별 CPNP1 처리 방식 확정(2026-07-30, 사용자 확인) — **평생 합계를
      캠페인 활성 기간(그 캠페인의 "시작"~"종료" 컬럼)의 각 월에 균등 분배** — 이번 세션
      Seminar 캠페인월 예외에서 쓴 `computeEvenSeasonalityForMonths_()`(90_TargetEngine.js)와
      동일한 패턴 재사용 가능.
      **이중 계상 위험 해소(2026-07-30, 사용자 확인)**: 광고 계정을 이관해서, **예전(이관 전)
      계정의 캠페인은 전부 영구 종료 상태**(다시는 월별 export 대상이 될 수 없음) — 이 배치에만
      평생합계 균등분배를 적용하면 안전. **새(이관 후) 계정 캠페인은 항상 월별 export로만
      추적**(평생합계 방식을 아예 적용 안 함) — 이러면 애초에 겹칠 상황 자체가 없음. 다만
      Content/BOFU는 새 계정에서도 1년 넘게 길게 갈 수 있어 "월별 export를 꾸준히 안 놓치고
      해야 한다"는 운영상 주의사항 존재(Webinar/Seminar는 길어도 2개월 내 종료라 상대적으로
      안전, 사용자 확인).
- [x] 캠페인 지출 스프레드시트 확정: **`1zOZGwnsm0GhLGGe5rATu8jR5WxAQVx7YmmiPZVU88jY`**
      (2026-07-30 사용자가 새로 생성한 빈 시트). 참고: 앞서 공유된 Meta 캠페인명 샘플 6행은
      이 시트가 아니라 사용자가 별도로 뽑아둔 엑셀 파일 데이터였음(혼동 있었으나 정정 완료) —
      즉 이 스프레드시트는 아직 완전히 비어있는 상태에서 시작.
- [x] 파일 넘버링 확정(2026-07-30, 사용자 확정) — 기존 00~99 넘버링과 별개로, **새 네이밍
      컨벤션(`STAGE_NNN_Name.js`, 3자리)을 이 파이프라인부터 바로 적용**. 스테이지명 `AD`
      (Ad Spend). 기존 63개 파일의 전체 재정비는 별도 세션으로 보류(샘플 매핑만 대화 중 제시,
      실제 반영 안 함). 스테이지당 999개까지 여유 있어 확장성 문제 없음(사용자 확인 — 현재
      최대 스테이지도 8개 파일 수준).
- [x] `AD_001_Config.js` 구현 완료 — `AD.SPREADSHEET_ID`(새 캠페인 지출 시트), `AD.PLATFORMS`
      (8개 플랫폼 목록), `AD.RAW_SHEET`(플랫폼당 탭명, 지금은 Meta만), `AD.META.COLUMNS`
      (Meta Ads Manager export 컬럼명 매핑 — 캠페인 이름/시작/종료/보고 시작/보고 종료/지출
      금액만, 안 쓰는 컬럼은 매핑 안 함). `node --check` 통과, 중복 선언 없음 확인.
- [ ] New P1(Leads_OPS 기반)과 매칭할 세그먼트 단위 그레인 확정 — 월 단위는 확정, 세그먼트
      매칭 방법은 위 세그먼트 분류 로직이 정해져야 확정 가능
- [ ] Target_Engine Block 0 수동 Spent 입력을 이 파이프라인 결과로 대체할지, 별도 참고
      지표로만 둘지 결정
- [x] 예전/새 계정 판별 방법 확정(2026-07-30, 사용자 확인) — Meta Ads Manager export에
      **Account ID 컬럼을 추가로 뽑을 수 있음**(사용자가 이미 그렇게 추출 중). 계정 이관
      이력 때문에 총 3개 Account ID가 존재하는데, 그중 현재 사용 중인 계정 ID
      (`2954404598150809`)만 명시하고 나머지 전부(2개)는 "예전 계정"으로 판별 — 데이터
      기반 자동 판별이라 "어느 파일/진입점으로 가져왔는지"에 의존할 필요 없음(더 단순하고
      안전). `AD_001_Config.js` v1.1.0에 `META.ACTIVE_ACCOUNT_ID` + `COLUMNS.ACCOUNT_ID`
      반영 완료.
- [x] `AD_002_Meta.js` 구현 완료(2026-07-30) — Meta 파일럿 Import/Transform/Aggregation:
      - `generateAdSpendMonthRange_()`(순수) — 예전 계정 캠페인의 활성 기간(시작~종료)에 걸친
        캘린더월 목록 생성(균등분배 분모용).
      - `computeMetaRowMonthlySpend_()`(순수) — 행 1개 → (FY|Month|Segment|Spent) 항목들.
        현재 계정(`AD.META.ACTIVE_ACCOUNT_ID`)은 보고 시작월에 그대로 귀속, 그 외(예전 계정)는
        캠페인 활성 기간에 균등분배. Segment는 새로 안 만들고 기존 `getBusinessSegment()`
        그대로 재사용.
      - `aggregateMetaSpendByFYMonthSegment_()`(순수) — 행별 항목을 (FY|Month|Segment) 키로
        합산(여러 캠페인이 같은 세그먼트/월에 걸치는 게 정상).
      - `readMetaRawRows_()`/`computeMetaSpendSummary_()`(IO 래퍼) — `sheetToObjects()`
        (22_OPS_Merge.js 공용 헤더 기반 리더) 재사용, 새 리더 안 만듦.
      - `setupMetaRawSheet()`(수동 실행, 탭만 생성 — 헤더는 사용자가 Meta Ads Manager export를
        헤더 포함째 그대로 붙여넣으면 그게 헤더가 됨, Header-Based Mapping 원칙).
      - `runComputeMetaSpendSummary()`(수동 실행 진입점, 결과 Logger 출력).
      - Node 하네스 검증(2026-07-30): 신규 test 3개(`testGenerateAdSpendMonthRange`/
        `testComputeMetaRowMonthlySpend`/`testAggregateMetaSpendByFYMonthSegment`) 전부 PASS,
        `node --check` 통과, 중복 선언 없음. `clasp push` 완료.
- [x] 실 데이터 1차 검증 중 헤더/컬럼 불일치 발견·수정(2026-07-30) — `runComputeMetaSpendSummary()`
      가 `{}`(빈 결과)를 반환해 `runDebugMetaRawFirstRow()`(신규 진단 함수) 추가로 원인 확인:
      1. **헤더가 한국어가 아니라 영어** — 사용자가 채팅에 옮겨 적어준 샘플은 한국어였으나
         실제 Meta_Raw에 붙여넣은 라이브 export는 영어 헤더(`Reporting starts`/`Campaign name`/
         `Amount spent (NZD)` 등, 계정별 UI 언어 설정 차이로 추정).
      2. **캠페인 자체의 종료일 필드가 원래 export 불가능**했음(`Reporting starts/ends`는 리포트
         조회 기간일 뿐 캠페인 종료일과 무관, 사용자 확인: "종료일은 원래 없었고 Reporting
         starts/ends가 원래 A:B였다") — "예전 계정 lifetime 합계를 활성 기간에 균등분배"
         라는 전제 자체가 깨질 뻔했으나, 사용자가 Meta에서 별도로 "Ends" 컬럼을 찾아 추가
         추출하면서 해결.
      3. 재추출 과정에서 KR 외 국가 캠페인(예: `IN_core_...`)이 섞여있던 것도 발견해 KR만
         다시 추출(BusinessSegmentClassification.md의 기존 COUNTRY_FILTER=KOR 원칙과 동일
         방향, 사용자 확인).
      `AD_001_Config.js` v1.2.0에 실제 헤더(`Reporting starts/Reporting ends/Campaign name/
      Date created/Ends/Amount spent (NZD)/Account ID`)로 전면 정정. Node 하네스 재검증(순수
      함수 3개 전부 재 PASS — 이 함수들은 정규화된 필드명을 쓰므로 Config 매핑만 바뀌면
      되고 로직 자체는 무영향), `clasp push` 완료.
- [x] 실 데이터로 `runComputeMetaSpendSummary()` 1차 성공(2026-07-30) — FY23 SEP~FY26 SEP
      (FY|Month|Segment) 집계 결과 정상 생성 확인(사용자 확인). Search 세그먼트가 안 나오는
      것도 정상(Meta는 검색광고 플랫폼이 아니므로 `getBusinessSegment()` 로직상 당연한 결과,
      사용자 확인). Other 세그먼트 규모는 육안 검토 필요 항목으로 남김(급하지 않음, 나중에
      같이 review 예정).
- [x] **Events_OPS(LP CVR/LG CVR/All CVR/Clicks/Leads(Meta)/Spent) 자동화는 별도 작업으로
      분리(2026-07-30, 사용자 확인)** — 이 컬럼들은 Marketo Program 단위 매칭이 필요한데
      (Events_Config.js `MATCH_FIELD` = `Lead Source Detail`/`First Touch Detail`, 네이밍
      `WB-2025-07-KOR-...` 형식), 이번에 검증한 매핑은 Meta 캠페인명 ↔ Salesforce
      `MKT UTM Campaign`(세그먼트 분류용, `KR_core_YYYY-MM-DD_slug` 형식)이라 서로 다른
      필드/네이밍 규칙 — Meta 캠페인명→Marketo Program명 매핑은 별도로 풀어야 함(현재
      exec-plan 범위 밖, 나중에 별도 세션).
- [x] **`computeMetaRowMonthlySpend_()` 로직 재설계(2026-07-30, 실 검증 중 발견)** — 사용자가
      "지금 계정도 한 번에 넓은 기간(2024-09~지금)으로 export하고 싶다"고 하면서, 기존
      "현재 계정=항상 한 달"이라는 가정이 깨짐. 추가로 "Amount spent"가 캠페인 전체 생애가
      아니라 **"Reporting starts~ends"(조회 기간) 안에서 집행된 금액**임을 확인(사용자 확인)
      — 이 두 가지로 계정 ID 기반 분기를 폐기하고, "캠페인 활성 기간(Date created~Ends) ∩
      보고 조회 기간(Reporting starts~ends)"에 균등분배하는 단일 로직으로 재작성(더 단순하고
      더 정확함 — 계정 무관, `AD.META.ACTIVE_ACCOUNT_ID`는 로직에서 제거하고 Config엔 참고용
      으로만 유지). Node 하네스 재검증(test 3개, 실제 검증된 라이브 샘플 값 포함) 전부 PASS,
      `clasp push` 완료.
- [x] **26|JUL 실제값 대조 중 발견 — 세그먼트 오분류 아니라 "종료일 없는 장기 에버그린
      캠페인의 균등분배 근사 오차"(2026-07-30)** — 사용자 실측(Content 실제 ≈22,922 vs
      집계 27,753 / BOFU 실제 ≈3,904 vs 집계 2,999)이 반대 방향으로 어긋나 세그먼트 오분류를
      의심했으나, `runDebugMetaSpendByCampaignForMonth()`(신규 진단, 특정 FY/Month의 캠페인별
      기여 내역 로그 출력)로 확인한 결과 모든 캠페인이 올바른 세그먼트로 분류돼 있었음(BOFU=
      `_contact-fbiglg`, Content=`_lead-fbiglg`, Webinar=`_event-online-fbiglg` 전부 정합).
      원인은 `KR_core_2022-10-01_retargeting-ebook_lead-fbiglg`처럼 **종료일(Ends)이 없는
      2022년생 에버그린 캠페인**의 지출을 45개월치 평균으로 매달 동일하게 배분하고 있었던 것 —
      실제 월별 집행액 변동을 평균이 뭉개버림.
      **해결(사용자 확정 — "최근 export로 보정하고 나머지는 그대로 두자")**: 정밀 export
      우선 규칙 추가. `isMetaRowMonthPrecise_()` 신규(보고 기간이 정확히 한 달이면 "정밀"),
      `aggregateMetaSpendByFYMonthSegment_()` 재작성 — 같은 캠페인의 같은 달을 정밀 행과
      장기 분배 행이 동시에 커버하면 분배 행의 그 달 기여분은 버리고 정밀값 채택(이중계상
      방지). `AD_002_Meta.js` v1.2.0, Node 하네스 신규 test 2개(`testIsMetaRowMonthPrecise`/
      override 시나리오 추가된 `testAggregateMetaSpendByFYMonthSegment`) 전부 PASS, `clasp
      push` 완료.
- [x] 사용자가 26|JUL만 정밀하게 재추출해서 Meta_Raw에 추가 — 손으로 검산한 결과(BOFU
      ≈3,906.3 / Content ≈22,926.4)가 실제값(3,904 / 22,922)과 거의 정확히 일치해 데이터
      자체와 로직 설계는 맞음을 사전 확인(2026-07-30).
- [x] **그런데도 실제 집계가 계속 어긋남 → 타임존 버그 발견·수정(2026-07-30)** —
      `runDebugMetaRawLastRows()`(신규 진단, 마지막 N행의 실제 날짜 타입 + `isMetaRowMonthPrecise_()`
      판정 + 캠페인명 중복 여부 출력)로 확인한 결과, 새로 추가한 정밀 export 행들이 전부
      `isPrecise=false`로 나옴 — `reportStart`가 "2026-06-30T15:00:00.000Z"처럼 실제(캠페인
      지출 시트 자체 타임존 기준 7/1)보다 하루 이른 UTC로 읽히고 있었음. 원인은 이 Apps
      Script 프로젝트의 스크립트 타임존(America/New_York)과 캠페인 지출 시트 자체 타임존이
      달라서 `.getMonth()`가 다른 달을 반환하는 것 — **2026-07-28 Deal Tracker에서 이미
      겪었던 것과 동일한 버그 클래스**(그때 만든 `normalizeExternalCalendarDate_()`,
      90_TargetEngine.js). 같은 해법을 그대로 재사용해 `readMetaRawRows_()`가 시트 자체의
      `getSpreadsheetTimeZone()` 기준으로 4개 날짜 컬럼(reportStart/reportEnd/campaignStart/
      campaignEnd)을 재구성하도록 수정(`AD_002_Meta.js` v1.4.0). Node 하네스 재검증(기존
      test 전부 + `90_TargetEngine.js` 로드 포함해 `normalizeExternalCalendarDate_` 참조
      확인) PASS, `clasp push` 완료.
- [x] **✅ Meta 파일럿 실 데이터 검증 완료(2026-07-30)** — 타임존 수정 후
      `runComputeMetaSpendSummary()` 재실행 결과 `26|JUL|BOFU: 3906.3`(실제 ≈3,904),
      `26|JUL|Content: 22926.44`(실제 ≈22,922) — 손으로 검산한 값과 정확히 일치, 사용자
      확인. Meta 파일럿(Import→Transform→세그먼트 분류→월별 정밀/분배 병합→집계) 전체
      파이프라인이 실 데이터로 검증 끝남. `clasp run-function` 설정은 검토 후 GCP
      Standard 프로젝트 연결이 필요함을 확인했으나(개인 계정도 가능, 무료) 사용자가
      수동 실행 방식 유지를 선택(2026-07-30) — 필요해지면 재검토.
- [x] **소비처 연결 — Target_Engine 대신 ACQ_REP 선택(2026-07-30, 사용자 확정)** —
      Target_Engine 연결은 8개 플랫폼 중 Meta 하나만 자동화된 상태라 Block 0의 "전체 지출"
      필드를 Meta만으로 덮으면 총 지출이 과소집계될 위험 논의 끝에, 사용자가 "일단
      Target_Engine은 건들지 말고 ACQ_REP에 Spent 컬럼을 만들자 — 어차피 여기도 들어가야
      하니"로 결정. ACQ_REP은 이미 Segment×Month grain이라 grain 불일치 문제도 없음.
      **구현**: `ACQ_REP`에 "Meta Spent" 컬럼 추가(W열, `CONFIG.ACQ.META_SPENT_COLUMN`,
      00_Config.js v1.21.0), hasOwnProperty로 "Meta 지출 없음"과 "0"을 구분. 헤더명을
      "Spent"가 아니라 **"Meta Spent"**로 명확히 해서 나머지 7개 플랫폼 자동화 전까지
      총 광고비로 오인되지 않게 함(헤더 Note에도 명시, `32_ACQReportStyles.js` v1.7.0).
      컬럼 위치는 W열(23) — 배치 전 사용자에게 W열 이후 수동 내용 없음을 확인받음(오늘
      세 번째 컬럼 충돌 방지 교훈 적용).
- [x] **실 시트 검증 중 버그 발견·수정 — ACQ_REP Generate가 Simple Trigger 권한 제약으로
      조용히 실패(2026-07-30)** — 체크박스를 눌러도 헤더조차 안 나타나는 문제 발생, 사용자가
      공유한 Cloud Logs로 정확한 원인 확인: `"Specified permissions are not sufficient to
      call SpreadsheetApp.openById"` at `readMetaRawRows_` ← `computeMetaSpendSummary_` ←
      `generateACQReport_` ← `handleACQReportGenerateEdit_` ← `onEdit`. ACQ_REP의 Generate는
      `onEdit()` Simple Trigger로 실행되는데, 이건 제한된 권한이라 외부 스프레드시트를
      `openById()`로 여는 걸 못 함 — **Target_REP가 2026-07-27에 이미 겪었던 것과 동일한
      제약**(그때는 Target_REP를 체크박스에서 수동 실행으로 전환하는 방식으로 해결).
      이번엔 ACQ_REP의 체크박스 UX를 유지하고 싶어서 다른 해법 채택: **`ACQ_Summary`와
      동일한 캐시 패턴 신규 도입** — `refreshMetaSpendCache_()`/`runRefreshMetaSpendCache()`
      (AD_002_Meta.js v1.5.0, 수동 실행 — 외부 시트를 읽어 메인 스프레드시트 안
      `Meta_Spend_Cache` 시트에 저장)와 `readMetaSpendCacheMap_()`(같은 스프레드시트만
      읽음, Simple Trigger 안전). `30_ACQReport.js`(v1.12.0)가 `computeMetaSpendSummary_()`
      대신 `readMetaSpendCacheMap_()`을 쓰도록 전환. `node --check`/중복 선언 검사 통과,
      `clasp push` 완료.
- [ ] **다음 단계**: 사용자가 `runRefreshMetaSpendCache()`(AD_002_Meta.js) 먼저 수동
      실행 → ACQ_REP Generate 체크박스 재체크 → W열에 Meta Spent 값이 정상 표시되는지
      확인 필요 — 아직 최종 검증 전.
- [ ] Meta_Raw 갱신 시마다 `runRefreshMetaSpendCache()`를 매번 수동 실행해야 하는 번거로움
      — 자동 실행 체인에 연결할지는 추후 결정(지금은 수동, 임의로 자동 연결하지 말 것)
- [ ] Other 세그먼트 육안 검토(나중에, 급하지 않음)
- [ ] 나머지 7개 플랫폼(Naver Search/GFA, Google Search/Display, Naver Offline Cafe,
      Kakao Moments/Channel) 확장 — 확장되면 ACQ_REP의 "Meta Spent"도 "Ad Spent"(전체)로
      재검토 필요할 수 있음
- [ ] Meta 캠페인명 → Marketo Program명 매핑(Events_OPS 자동화용, 별도 작업)
- [ ] Target_Engine 연결은 8개 플랫폼 다 자동화된 뒤 재검토(보류, 임의로 처리하지 말 것)

## Surprises & Discoveries

- 원래 Roadmap.md에 적혀있던 소스(외부 `Monthly{채널}` 요약 시트)는 세그먼트별 분리가 원천적으로
  불가능한 구조였음 — 착수 전 문서만 보고 진행했다면 나중에 처음부터 다시 설계해야 했을 뻔함
  (설계 착수 시 "미정" 항목을 실제로 확인하고 넘어가는 절차가 유효했던 사례).
- **대상 플랫폼이 8개나 됨 + 플랫폼 간 Marketo Program 공유(2026-07-30, 사용자 확인)**: Meta,
  Naver Search, Naver GFA, Google Search, Google Display, Naver Offline Cafe, Kakao Moments,
  Kakao Channel. "각 플랫폼마다 추출할 수 있는 데이터가 다르고, 다른 플랫폼이더라도 같은
  Marketo 프로그램을 공유할 수 있고, 캠페인 naming 규칙도 플랫폼마다 다르다"는 사용자 설명 —
  즉 매핑 키는 "플랫폼"이 아니라 **"각 플랫폼 캠페인명에서 뽑아낸 Marketo Program 식별자"**여야
  함. 이 식별자가 Salesforce `MKT UTM Campaign`과 같은 값으로 뽑힌다면 기존
  `getBusinessSegment()` 매핑을 그대로 재사용 가능할 잠재력 있음 — 단, 실제로 그런지는 각
  플랫폼 실 캠페인명을 봐야 확인 가능(추측 금지).

## Decision Log

- **원래 소스 폐기, 캠페인 단위 export로 전환**: 세그먼트 공유 채널 문제 때문에 채널 단위
  월 집계로는 세그먼트별 CPNP1을 못 만듦 — 캠페인 단위 데이터가 필요하다는 사용자 판단
  (2026-07-30).
- **Leads_Raw/MTA_Raw 패턴 재사용**: "매번 전체 캠페인을 export할 수 없다"는 제약이 Salesforce
  Lead/MTA export와 동일한 문제라, 이미 검증된 원본 불변 + Incremental Master Build(중복 제거
  병합) 패턴을 그대로 재사용하기로 확정(2026-07-30).
- **별도 시트 + 같은 Apps Script 프로젝트**: 메인 스프레드시트가 이미 무거워서 새 데이터를 안
  얹기로 함 — 완전 별도 프로젝트(새 바운드 스크립트)까지는 아니고, Deal Tracker처럼 크로스
  스프레드시트 접근으로 코드는 이 레포에 유지(사용자 확정, 2026-07-30).

## Outcomes & Retrospective

(작업 완료 시 작성)
