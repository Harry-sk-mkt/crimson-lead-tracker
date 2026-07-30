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
- [x] **ACQ_REP W열(Meta Spent) 최종 검증 완료(2026-07-31)** — 사용자가
      `runRefreshMetaSpendCache()`(AD_002_Meta.js) 실행 → ACQ_REP Generate 재체크 →
      W열에 Meta Spent 값 정상 표시 확인. Meta 파일럿(Raw→Cache→ACQ_REP 소비까지) 전체
      배선 실사용 검증 끝남.
- [ ] Meta_Raw 갱신 시마다 `runRefreshMetaSpendCache()`를 매번 수동 실행해야 하는 번거로움
      — 자동 실행 체인에 연결할지는 추후 결정(지금은 수동, 임의로 자동 연결하지 말 것)
- [ ] Other 세그먼트 육안 검토(나중에, 급하지 않음)
- [ ] Meta 캠페인명 → Marketo Program명 매핑(Events_OPS 자동화용, 별도 작업)
- [ ] Target_Engine 연결은 8개 플랫폼 다 자동화된 뒤 재검토(보류, 임의로 처리하지 말 것)

### Naver Search (2번째 플랫폼, 착수 2026-07-31)

- [x] 실 캠페인명 샘플 확보(2026-07-31, 사용자 제공 — Naver 광고관리시스템 검색광고 리포트
      10개 행) — `KR_core_...` 패턴이 Meta와 동일하게 쓰이는 것 확인(예:
      `KR_core_expo_earlybird2_ptc`, `KR_core_HStoDS_contact`, `KR_umatch_contact` 등).
      컬럼: ON/OFF, 광고 구분, 상태, 캠페인 이름, 캠페인 분류(내부 ID), 총비용, 노출수, 클릭수,
      클릭률, 평균 CPC, 총 전환수, 총 전환당비용.
- [x] **`getBusinessSegment()` 재사용 시 오분류 위험 발견·해결 방안 확정(2026-07-31)** —
      샘플 대부분이 `_contact` 계열인데, `16_TransformHelper.js`의 BOFU/Search 공용
      fallback(1089~1095행)은 leadSource에 "search"가 없으면 기본 BOFU로 떨어짐. Meta는
      검색광고 플랫폼이 아니라 이 케이스가 안 걸렸었으나, Naver Search는 진짜 검색광고라
      leadSource 없이 캠페인명만 넘기면 `_contact` 캠페인이 전부 잘못 BOFU로 집계됨
      (`docs/BusinessSegmentClassification.md`: "Search는 Lead Source가 Naver Search/Google
      Search/Organic Search일 때만 존재"). **해결(사용자 확인)**: Naver Search 데이터 분류
      시 `getBusinessSegment(campaignName, "", "naver search", "")`처럼 leadSource에 고정값
      `"naver search"`를 넘겨 재사용 — 실제 이 채널에서 들어온 리드와 동일한 분류 결과 보장.
      (`expo` 포함 캠페인 3개는 Seminar가 leadSource 무관하게 먼저 매칭되므로 영향 없음.)
- [x] 월별 정확 export 가능 확인(2026-07-31, 사용자 확인) — Naver 광고관리시스템은 기간을
      직접 지정해 그 기간만의 총비용을 뽑을 수 있음(Meta처럼 lifetime 균등분배 fallback
      로직이 기본적으로 필요 없을 가능성 — 계정/캠페인 이관 이력 있는지는 별도 확인 필요).
- [x] Raw 탭 시트명 확정(2026-07-31, 사용자 확정): **`NaverSA_Raw`** — `AD_001_Config.js`
      v1.3.0의 `RAW_SHEET["Naver Search"]`에 반영 완료.
- [x] 실 다운로드 파일 확인(2026-07-31, 사용자 확인) — 다운로드 파일에도 날짜/기간 컬럼이
      전혀 없음(화면 테이블과 동일 컬럼: ON/OFF/광고 구분/상태/보조 상태/캠페인 ID/캠페인
      이름/캠페인 분류/노출수/클릭수/클릭률/총 전환수/총 전환율/총 전환당비용/총비용) — Meta의
      Reporting starts/ends에 해당하는 컬럼이 Naver 쪽엔 원천적으로 없음 확인.
- [x] 다른 형태(.tsv)의 다운로드 확인(2026-07-31, 사용자 확인) — 캠페인 관리 메뉴에서 받은
      별개 파일로 확인됨(지출액 리포트가 아니라 캠페인 메타데이터, 헤더 없음, 캠페인
      생성일 타임스탬프만 있고 총비용 없음). 이후 사용자가 지출액 리포트 자체에서 "기간"
      항목을 찾았으나 값이 "계속노출"(연속 게재 상태 표시일 뿐 실제 날짜 아님)로 확인 —
      지출액 리포트에는 결국 사용할 수 있는 기간 컬럼이 없음이 최종 확정됨.
- [x] **Report Month 수동 컬럼 방식 최종 확정(2026-07-31, 사용자 확인)** — "YYYY-MM" 텍스트
      (예: "2026-07")로 사용자가 매달 붙여넣을 때 직접 입력. `AD_001_Config.js` v1.4.0에
      `NAVER_SEARCH.COLUMNS.REPORT_MONTH: "Report Month"` 반영.
- [x] **`getBusinessSegment()` leadSource override 확정 및 구현(2026-07-31)** —
      `NAVER_SEARCH.LEAD_SOURCE_OVERRIDE = "naver search"`(`AD_001_Config.js` v1.4.0).
- [x] **`AD_003_NaverSearch.js` 구현 완료(2026-07-31)** — Meta와 달리 월별 분배 로직 불필요
      (Report Month가 항상 정확히 한 달, 사용자 확인). 순수 함수
      `parseReportMonthToFYMonth_()`(YYYY-MM → FY/Month 라벨)/
      `computeNaverSARowSpendEntry_()`(캠페인+Report Month+총비용 → 1개 항목,
      leadSource override로 getBusinessSegment() 재사용)/
      `aggregateNaverSASpendByFYMonthSegment_()`(FY|Month|Segment 합산). IO 래퍼
      `readNaverSARawRows_()`(sheetToObjects() + `parseCurrencyValue_()`(90_TargetEngine.js)
      로 "3,765원" 같은 콤마/원 표기 방어적 파싱)/`computeNaverSASpendSummary_()`.
      수동 실행: `setupNaverSARawSheet()`/`runComputeNaverSASpendSummary()`/
      `runDebugNaverSARawFirstRow()`(진단). Node 하네스 신규 test 3개
      (`testParseReportMonthToFYMonth`/`testComputeNaverSARowSpendEntry`/
      `testAggregateNaverSASpendByFYMonthSegment`) 전부 PASS — `_contact` 캠페인이
      override 덕분에 Search로, `expo` 캠페인은 override 무관하게 Seminar로 분류되는
      것까지 검증. `node --check` 통과, `clasp push` 완료(원격 pull로 내용 diff까지
      재확인).
- [x] **수동 붙여넣기(NaverSA_Raw) 방식 폐기 → API 방식으로 전면 전환(2026-07-31,
      사용자 확정)** — 사용자가 네이버 검색광고 API 자격증명(Customer ID/API License
      Key/Secret Key)을 이미 보유하고 있다고 알려와 방향 전환. API는 조회 기간을 정확히
      지정할 수 있어 "Report Month 수동 입력" 문제 자체가 사라짐. `AD_001_Config.js`
      v1.5.0(`NAVER_SEARCH.COLUMNS`/`REPORT_MONTH`/`RAW_SHEET["Naver Search"]` 제거,
      `NAVER_SEARCH.API`(BASE_URL/자격증명 Script Properties 키 이름) 신규),
      `AD_003_NaverSearch.js` v2.0.0(수동 붙여넣기 함수 전부 삭제, API 방식으로 재작성).
      **자격증명은 코드/git에 절대 미포함** — Apps Script 편집기 Project Settings >
      Script Properties에 `NAVER_SEARCHAD_CUSTOMER_ID`/`NAVER_SEARCHAD_API_KEY`/
      `NAVER_SEARCHAD_SECRET_KEY` 3개 키로 사용자가 직접 입력(사용자가 채팅으로 실제
      값을 전달했으나 어떤 파일에도 기록하지 않음).
- [x] **인증 방식 확인(2026-07-31, 추측 없이 공식 샘플 코드로 검증)** — WebSearch/GitHub
      API로 `naver/searchad-apidoc` 저장소의 `python-sample/examples/signaturehelper.py`
      (서명: `Base64(HMAC-SHA256(secretKey, "{timestamp}.{method}.{uri}"))`)와
      `ad_management_sample.py`(Base URL `https://api.searchad.naver.com`, 헤더
      `X-Timestamp`/`X-API-KEY`/`X-Customer`/`X-Signature`, `/stats` 엔드포인트의
      `ids`/`fields`/`timeRange` 파라미터 형식, `salesAmt`=총비용(원 단위) 필드명)를
      실제로 확인. `/ncc/campaigns` 엔드포인트는 GitHub 이슈 제목으로 존재 확인(응답
      스키마 예시는 없어 캠페인명 필드가 정확히 "name"인지는 미확정).
- [x] **`AD_003_NaverSearch.js` 1차 구현(2026-07-31)** — `computeNaverSearchAdSignature_()`
      (순수, HMAC 서명)/`buildNaverSearchAdQueryString_()`(순수, ids는 반복 파라미터로
      /fields·timeRange는 호출부가 JSON.stringify()해서 넘긴 문자열 그대로 — Apps
      Script+이 API 조합에서 파라미터 인코딩 오류가 실제 보고된 바 있어 자동 추측 안 함).
      IO 래퍼 `getNaverSearchAdCredentials_()`(Script Properties 읽기, 누락 시 명확한
      에러)/`callNaverSearchAdApi_()`(인증 헤더 생성 + UrlFetchApp 호출).
      Node 하네스로 `testBuildNaverSearchAdQueryString()` PASS(HMAC 서명 자체는
      Utilities.*가 Apps Script 전용이라 Node에서 검증 불가 — 실 API 호출로만 검증
      가능). `node --check` 통과, `clasp push` 완료.
- [x] **Script Properties 설정 + 실 API 호출 검증 완료(2026-07-31)** — 자격증명 3개
      등록 후 첫 시도 403 invalid-signature(원인 1: Base URL이 공식 샘플 저장소의
      예전 값 `api.searchad.naver.com`이었음 — GitHub 이슈 #1319로 `api.naver.com`이
      맞음을 확인·수정 v1.6.0. 원인 2: 그래도 403 재발 — `runDebugNaverSearchAdSignatureInputs()`
      신규 진단으로 확인한 결과 사용자가 Script Properties에 붙여넣은 Secret Key 끝의
      "=="가 누락돼 있었음(길이 50, 정상 52) — 재입력 후 해결). 이후
      `runDebugNaverSearchAdCampaigns()`(200, 23개 캠페인, 필드 `nccCampaignId`/`name`/
      `delFlag`/`status` 등 확인)와 `runDebugNaverSearchAdStats()`(200,
      `{data:[{id,clkCnt,impCnt,salesAmt}], compTm, cycleBaseTm}` 확인, id가
      nccCampaignId와 매칭) 둘 다 실 응답으로 검증 완료.
- [x] **최종 집계 함수 구현 완료(2026-07-31, `AD_003_NaverSearch.js` v2.1.0)** —
      `buildCalendarMonthRange_()`(순수, 연/월→since/until)/
      `computeNaverSearchAdSpendByFYMonthSegment_()`(순수, campaignMap+statsRows→
      FY|Month|Segment 합산, Meta의 `aggregateMetaSpendByFYMonthSegment_()`와 동일
      출력 형태). IO 래퍼 `fetchNaverSearchAdCampaignMap_()`/`fetchNaverSearchAdStats_()`/
      `computeNaverSearchAdSpendSummaryForMonth_()`. 수동 진입점
      `runComputeNaverSearchAdSpendForMonth()`(연/월은 함수 상단 상수 직접 수정 후
      재실행, `runDebugMetaSpendByCampaignForMonth()`와 동일 관례). Node 하네스 신규
      test 2개 전부 PASS(`testBuildCalendarMonthRange`/
      `testComputeNaverSearchAdSpendByFYMonthSegment`), `node --check` 통과,
      `clasp push` 완료.
- [x] **✅ Naver Search 파이프라인 실 데이터 검증 완료(2026-07-31, 사용자 확인)** —
      `runComputeNaverSearchAdSpendForMonth()`(2026-07) 결과 `26|JUL|Search: 3737733`,
      실제 지출(3,737,732, 31일 미포함 기준) 대비 1원 차이(반올림 수준) — 정확히 일치.
      23개 캠페인 전부 Search로 분류(이 계정 캠페인 특성상 예상대로 — expo 계열은 이번
      조회 기간에 지출 0). Meta에 이어 2번째 플랫폼 파이프라인 완성(Import→Segment
      분류→FY/Month 집계까지, API 기반이라 수동 데이터 취합 자체가 없음).
- [x] **✅ ACQ_REP 합산 지출("Spent") 연결 및 실 검증 완료(2026-07-31, 사용자 확정·확인)** —
      사용자 결정: Meta+Naver Search를 W열 하나로 합쳐서 연결, 헤더 "Meta Spent"→
      "Spent"로 변경, Naver 지출(KRW)은 GOOGLEFINANCE("CURRENCY:KRWNZD") 환율로 NZD
      변환. **구현**: `AD_004_SpendCache.js`(v1.0.0) 신규 — `fetchKrwToNzdRate_()`
      (Apps Script가 GOOGLEFINANCE를 직접 호출 못 해 숨김 시트에 수식을 심고
      flush 후 읽는 방식)/`convertSpendSummaryCurrency_()`(순수)/
      `mergeSpendSummaries_()`(순수, 두 플랫폼 키 합산 — 한쪽에만 있어도 포함)/
      `refreshAdSpendCache_()`(Meta NZD + Naver Search KRW→NZD 소급 합산 후
      `Ad_Spend_Cache` 시트 저장)/`runRefreshAdSpendCache()`(수동 진입점)/
      `readAdSpendCacheMap_()`(Simple Trigger 안전 리더). Naver Search는
      `AD.NAVER_SEARCH.API.BACKFILL_START`(2022-09, Meta와 동일 범위) 기준
      `computeNaverSearchAdSpendHistorySummary_()`(AD_003_NaverSearch.js v2.2.0
      신규, 캠페인 목록 1회 조회 후 매달 /stats 반복 호출)로 전체 이력 소급.
      **개명**: `CONFIG.ACQ.META_SPENT_COLUMN`→`SPENT_COLUMN`,
      `META_SPEND_CACHE_SHEET`("Meta_Spend_Cache")→`AD_SPEND_CACHE_SHEET`
      ("Ad_Spend_Cache")(00_Config.js v1.23.0). `30_ACQReport.js`(v1.13.0)/
      `32_ACQReportStyles.js`(v1.8.0) 헤더·Note·변수명 반영. `AD_002_Meta.js`
      (v1.6.0)의 Meta 전용 캐시 함수(`refreshMetaSpendCache_()`/
      `runRefreshMetaSpendCache()`/`readMetaSpendCacheMap_()`)는 AD_004로
      통합되며 제거(`computeMetaSpendSummary_()`는 유지, AD_004가 호출).
      Node 하네스 신규 test 3개(`testConvertSpendSummaryCurrency`/
      `testMergeSpendSummaries`/`testGenerateCalendarMonthSequence`) 전부 PASS,
      `node --check`/중복 선언 검사 통과, `clasp push` 완료. **실 시트 검증**:
      `runRefreshAdSpendCache()` 실행 결과 212행 갱신, 환율 0.0011963(1 NZD≈
      836원, 합리적 범위) — 사용자 확인. ACQ_REP Generate 재체크 후 W열
      "Spent" 값 정상 표시 확인(사용자 확인).
      **옛 `Meta_Spend_Cache` 시트는 이제 안 씀** — 코드가 자동 삭제하지
      않으므로 사용자가 원하면 직접 삭제 가능(숨김 시트라 방치해도 무해).
- [ ] **다음 단계(결정 필요)**: (1) 매달 자동 갱신할지(트리거 연결, OpenItems 9번
      Backend 비동기화 논의와 연관) — API 방식이라 Meta보다 자동화 난이도가 낮음
      (외부 시트 붙여넣기 자체가 없음). (2) 이 성공 패턴(API 방식)을 Meta에도
      역적용할지(Meta도 Marketing API 있음) — 사용자 판단 필요, 임의로 진행하지 말 것.
      (3) 나머지 6개 플랫폼(Naver GFA/Google Search·Display/Naver Offline Cafe/
      Kakao Moments·Channel) 확장 순서.

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
