/**
 * ==========================================================
 * Marketing 2.0
 * Ad Spend Config
 *
 * Responsibility
 * 캠페인 지출(Ad Spend) 통합 파이프라인의 전역 설정. 00_Config.js 중앙화
 * 원칙의 기존 예외를 그대로 따름(20_OPS_Config.js/50_Events_Config.js와
 * 동일 관행 — 별도 도메인 config 파일).
 *
 * 원본 데이터는 메인 스프레드시트가 아니라 별도 Google Sheet
 * (SPREADSHEET_ID)에 있음 — Deal Tracker와 동일하게
 * `SpreadsheetApp.openById()`로 크로스 스프레드시트 접근.
 *
 * 설계 문서
 * docs/Roadmap.md End Goal Phase 1, docs/exec-plans/active/2026-07-30-campaign-spend-integration.md
 *
 * Stage
 * AD (신규 — 2026-07-30 네이밍 컨벤션 변경 예정에 맞춰 이 스테이지부터
 * `AD_NNN_Name.js` 형식으로 시작. 기존 00~99 파일은 당장 안 바꿈, 전체
 * 재정비는 별도 세션 예정.)
 *
 * Version
 * v1.17.0
 *
 * Change Log
 * v1.17.0 (2026-08-06)
 * - **`KAKAO_CHANNEL.SYNC_COLUMNS`에 `"Message Ad ID"` 컬럼 신규 추가(맨 앞,
 *   숨김 예정)**. 카카오모먼트 API 동기화(`AD_006_KakaoMoments.js`
 *   `runSyncKakaoMomentsReportToKakaoSMSRaw()`)가 같은 메시지광고를 재동기화할
 *   때(발송 후에도 열람/전환 지표가 계속 늘어남) 기존 행을 찾아 upsert하기
 *   위한 키 — 기존엔 재조회 시 값을 매칭할 고유 식별자가 없었음(사용자 확인
 *   후 추가, 기존 시트 구조 변경이라 승인 받음). 수기 소스(Kakao Channel
 *   Performance) 기반 과거 행은 이 컬럼이 빈 값으로 남음(영향 없음). 상세:
 *   docs/exec-plans/active/2026-08-04-kakao-moments-api-integration.md
 * v1.16.0 (2026-08-05)
 * - **버그 수정(실측)** — `NAVER_SEARCH_CAMPAIGN_STATS.INITIAL_LOOKBACK_DAYS`(729)
 *   가 실제 API 제약과 안 맞았음: `runRefreshNaverSearchAdCampaignStatsCache()`
 *   최초 실행에서 `{code:11004, message:"데이터는 92일 이내 기간에서만 사용
 *   가능합니다."}` 에러 — impCnt/clkCnt 필드는 salesAmt와 달리 92일 제약(730일
 *   아님). `INITIAL_LOOKBACK_DAYS` → `MAX_QUERY_RANGE_DAYS`(90, 92일보다 이틀
 *   여유)로 교체, 최초 조회 소급 범위이자 재개 시 하한 클램프로 겸용. 상세:
 *   AD_003_NaverSearch.js v2.6.0 참고.
 * v1.15.0 (2026-08-05)
 * - `NAVER_SEARCH_CAMPAIGN_STATS` 신규 — Search_OPS의 Campaign/Impressions/
 *   Link clicks 컬럼을 Naver Search Ad API로 자동 채우기 위한 누적 캐시 설정
 *   (사용자 요청). 상세: AD_003_NaverSearch.js/73_Search_Merge.js 참고.
 * v1.14.0 (2026-08-05)
 * - `KAKAO_MOMENTS.REPORT` 신규 — 리포트 API 진단 착수를 위한 엔드포인트 4개(광고계정 목록/
 *   채널 프로필 목록/메시지광고 목록/메시지광고 리포트, 공식 문서 확인 완료). 응답 필드
 *   매핑은 아직 미확정 — `AD_006_KakaoMoments.js`의 신규 진단 함수로 실제 호출 후 확정 예정.
 * v1.13.0 (2026-08-04)
 * - **버그 수정 — 인가 요청 KOE233("지원하지 않는 파라미터") 실측**. `scope`에
 *   `moment_create`가 포함되면 `resource_ids` 파라미터가 조건부 필수라는 걸 공식 문서로
 *   확인(누락 시 이 에러) — `KAKAO_MOMENTS.OAUTH.RESOURCE_IDS: ["moment:*"]` 신규(광고계정
 *   생성 권한은 "전체 광고계정만 요청 가능"이 문서에 명시돼 특정 ID 대신 와일드카드 사용).
 *   `AD_006_KakaoMoments.js`의 `buildKakaoMomentsAuthorizeUrl_()`가 이 값을 반영하도록 함께 수정.
 * v1.12.0 (2026-08-04)
 * - **버그 수정 — Redirect URI 불일치로 OAuth 콜백 실패("Script function not found: doGet")**.
 *   `KAKAO_MOMENTS.OAUTH.REDIRECT_URI` 신규(하드코딩) — `ScriptApp.getService().getUrl()`을
 *   Apps Script 편집기에서 직접 Run할 때 호출하면 실제 배포된 `/exec` URL이 아니라 카카오에
 *   등록 안 된 `/dev` URL을 반환하는 게 실측으로 확인됨(docs/apps-script-gotchas.md #10 신규).
 *   실제 배포 URL을 그대로 Config에 고정 — `AD_006_KakaoMoments.js`의
 *   `getKakaoMomentsRedirectUri_()`가 이 값을 쓰도록 함께 수정.
 * v1.11.0 (2026-08-04)
 * - `KAKAO_MOMENTS.OAUTH.PROPERTY_KEYS.CLIENT_SECRET` 값을 `"KAKAO_MOMENTS_CLIENT_SECRET"`
 *   → `"KAKAO_MOMENTS_CLIENT_SECRET_BIZAUTH"`로 변경 — 실측 결과 카카오 콘솔 REST API 키
 *   카드에 "카카오 로그인용"/"비즈니스 인증용" Client Secret이 별도로 존재함이 확인됨
 *   (사용자 발견). 이 프로젝트는 비즈니스 인증만 쓰므로 BIZAUTH 쪽으로 명확히 구분.
 * v1.10.0 (2026-08-04)
 * - `KAKAO_MOMENTS` 신규 — 카카오모먼트 메시지광고 API(비즈니스 인증 OAuth 2.0)
 *   연동 착수. `OAUTH` 섹션(엔드포인트 3개, 스코프 4개, Script Properties 키
 *   이름)만 우선 추가 — 리포트 API 엔드포인트/컬럼 매핑은 실제 토큰 확보 후
 *   확정 예정(구현은 `AD_006_KakaoMoments.js`). 공식 문서 확인 결과 비즈니스
 *   토큰엔 Refresh Token이 없음(매번 인가 코드로 재발급, 장기 미사용 시만
 *   자동 만료) — 원래 계획했던 "시간 트리거 자동 갱신"은 무효, 대신 실제
 *   사용(캠페인 지출 파이프라인의 주기적 호출)으로 미사용 만료를 회피하는
 *   방식으로 전환. 상세: docs/exec-plans/active/
 *   2026-08-04-kakao-moments-api-integration.md
 * v1.9.0 (2026-07-31)
 * - `RAW_SHEET["Kakao Channel"]`("KakaoSMS_Raw") + `KAKAO_CHANNEL.SYNC_COLUMNS`
 *   신규 — 캠페인 지출 스프레드시트(AD.SPREADSHEET_ID)에 Performance 원본을
 *   그대로 보여주는 뷰 탭 추가(사용자 요청, "API로 가져오더라도 어차피
 *   performance는 봐야해서"). `SYNC_COLUMNS`는 목적지 컬럼 순서를 그대로
 *   나타냄 — `PIC`(원본에 없는 신규 컬럼, B/C 사이 삽입, 사용자가 매 행
 *   직접 입력) + `CTR`/`CvR`(원본엔 있으나 수식값이라 값 복사 안 함, 헤더만
 *   유지)는 `source:null`로 표시해 값 대신 빈 문자열이 채워지게 함
 *   (`computeKakaoChannelSyncRow_()`, AD_005_KakaoChannel.js 참고).
 * v1.8.0 (2026-07-31)
 * - `KAKAO_CHANNEL` 신규 — 3번째 플랫폼(카카오톡 채널 푸시). 사용자가 이미
 *   수기로 관리해온 별도 스프레드시트(`18Ld85fuR76tsVxshEuzZ17SV00c0BEI6Rtl3HjA20RI`,
 *   탭 "Performance")를 그대로 소스로 사용 — Meta/Naver Search처럼 AD.SPREADSHEET_ID
 *   안이 아니라 완전히 다른 스프레드시트라 별도 SPREADSHEET_ID 필드로 관리.
 *   1행=subtotal(사용자 직접 수식), 2행=헤더, 3행부터 데이터(사용자 확인,
 *   Meta_Raw/NaverSA_Raw의 "1행=헤더" 관례와 다름 — HEADER_ROW/DATA_START_ROW로
 *   명시). Event type 컬럼 값을 캠페인명 기반 getBusinessSegment() 없이 직접
 *   Business Segment로 사용(사용자가 기존 "Direct Consult"를 전부 "BOFU"로
 *   이미 정정 완료 — Seminar/Webinar/BOFU 3개뿐, Search/Content 해당 없음).
 *   Cost는 KRW(사용자 확인) — Naver Search와 동일하게 AD_004_SpendCache.js에서
 *   NZD 변환 후 합산 예정. 상세: docs/exec-plans/active/
 *   2026-07-30-campaign-spend-integration.md
 * v1.7.0 (2026-07-31)
 * - `NAVER_SEARCH.API.BACKFILL_START`(2022-09, Meta 파이프라인의 실제 첫
 *   데이터 시점과 동일 범위 — 사용자 확정) + `FX`(GOOGLEFINANCE 기반 KRW→NZD
 *   환율 캐시 시트/수식) 신규 — ACQ_REP W열을 Meta+Naver Search 합산 지출로
 *   연결하기 위한 준비(AD_004_SpendCache.js 참고). 상세: docs/exec-plans/active/
 *   2026-07-30-campaign-spend-integration.md
 * v1.6.0 (2026-07-31)
 * - **`NAVER_SEARCH.API.BASE_URL` 수정 — `https://api.searchad.naver.com` →
 *   `https://api.naver.com`**. 실 호출에서 `runDebugNaverSearchAdCampaigns()`가
 *   403 invalid-signature로 실패, 원인 조사 중 GitHub
 *   `naver/searchad-apidoc` 이슈 #1319("GET 요청은 성공하나... Google Apps
 *   Script")에서 **동일한 서명 로직**(`Utilities.computeHmacSha256Signature`
 *   + `base64Encode`)을 쓰는 Apps Script 코드가 `https://api.naver.com`으로는
 *   GET 200 OK를 받은 실사례 확인 — `api.searchad.naver.com`은 공식 샘플
 *   저장소(python-sample)의 예전 값으로 추정, `api.naver.com`이 현재 유효한
 *   도메인. 서명 로직 자체(HMAC-SHA256, 헤더 이름)는 변경 없음.
 * v1.5.0 (2026-07-31)
 * - **Naver Search 수동 붙여넣기 방식 폐기 → API 방식으로 전환(사용자 확정)**.
 *   지출액 리포트 자체에 쓸 수 있는 기간 컬럼이 끝내 없는 것으로 확정된 직후,
 *   사용자가 네이버 검색광고 API(Customer ID/API License Key/Secret Key 이미
 *   발급받음) 사용 가능하다고 알려와 방향 전환. `NAVER_SEARCH.COLUMNS`/
 *   `REPORT_MONTH`(Header-Based Mapping 수동 붙여넣기 스키마)와
 *   `RAW_SHEET["Naver Search"]`(NaverSA_Raw) 제거 — API가 정확한 기간을
 *   직접 지정해 가져오므로 더 이상 필요 없음. 대신 `NAVER_SEARCH.API`
 *   섹션 신규(BASE_URL, 자격증명 Script Properties 키 이름). **자격증명
 *   자체는 코드/git에 절대 포함하지 않음** — Apps Script 편집기 Project
 *   Settings > Script Properties에 사용자가 직접 입력(PROPERTY_KEYS는 그
 *   키 이름만 참조). API 인증 방식(HMAC-SHA256, 헤더 이름 등)은
 *   naver/searchad-apidoc 공식 샘플 코드(GitHub)로 확인 후 반영 — 추측
 *   없음. `LEAD_SOURCE_OVERRIDE`는 그대로 유지(API로 얻은 캠페인명에도
 *   동일하게 필요). 구현은 AD_003_NaverSearch.js 참고.
 * v1.4.0 (2026-07-31)
 * - `NAVER_SEARCH.COLUMNS`/`LEAD_SOURCE_OVERRIDE` 추가 — 실 다운로드 파일
 *   확인 결과 지출액 리포트 자체엔 기간 컬럼이 전혀 없음이 확정돼(화면
 *   테이블과 다운로드 파일 모두 동일), 사용자가 붙여넣을 때 "Report Month"
 *   컬럼(YYYY-MM 텍스트)을 수동 추가하기로 확정. `LEAD_SOURCE_OVERRIDE`는
 *   `getBusinessSegment()` 재사용 시 `_contact`류 캠페인이 BOFU로 오분류되는
 *   문제(leadSource 없으면 기본 BOFU) 해결용 고정값 — 상세는
 *   docs/exec-plans/active/2026-07-30-campaign-spend-integration.md 참고.
 * v1.3.0 (2026-07-31)
 * - `RAW_SHEET`에 `"Naver Search": "NaverSA_Raw"` 추가(사용자 확정 시트명) —
 *   2번째 플랫폼(Naver Search) 착수. `NAVER_SEARCH` 컬럼 매핑은 실 다운로드
 *   파일의 기간 컬럼 확인 후 추가 예정(docs/exec-plans/active/
 *   2026-07-30-campaign-spend-integration.md 참고).
 * v1.2.0 (2026-07-30)
 * - `META.COLUMNS` 전면 정정 — 처음엔 사용자가 채팅으로 옮겨 적어준 한국어
 *   헤더 샘플을 그대로 썼으나, 실제 Meta_Raw에 붙여넣은 라이브 export는
 *   **영어 헤더**였음(계정별 UI 언어 설정 차이로 추정, `runDebugMetaRawFirstRow()`
 *   진단으로 확인). 또한 캠페인 자체의 종료일은 원래 export 불가능한
 *   필드였고(Reporting starts/ends는 리포트 조회 기간일 뿐 캠페인 종료일이
 *   아님), 사용자가 별도로 "Ends" 컬럼을 찾아 추가 추출하면서 해결 —
 *   `CAMPAIGN_START`도 "시작"이 아니라 "Date created"가 실제 필드명.
 *   이번 라운드에 KR 외 국가 캠페인(예: IN_core_...)도 잘못 섞여 들어온
 *   것을 발견해 재추출로 해소(Config엔 영향 없음, 데이터 자체 문제였음).
 * v1.1.0 (2026-07-30)
 * - `META.ACTIVE_ACCOUNT_ID` 추가 — Meta는 계정을 이관해서 총 3개 Account
 *   ID가 export에 찍히는데, 그중 현재 사용 중인 계정 1개만 명시하고
 *   나머지(예전 계정, 전부 영구 종료)는 "그 외 전부"로 판별(사용자 확정,
 *   2026-07-30). 활성 계정 = 월별 정확 Spent, 그 외 = 캠페인 lifetime
 *   합계를 활성 기간에 균등분배 — 처리 방식은 AD_002_Meta.js(예정)에서 구현.
 * v1.0.0 (2026-07-30)
 * - 최초 구현. 파일럿 플랫폼 Meta 컬럼 매핑만 구현, 나머지 7개 플랫폼은
 *   PLATFORMS 목록에만 존재(파일럿 검증 후 확장 예정).
 * ==========================================================
 */

const AD = {

  /*
  ==========================================================
  SPREADSHEET
  캠페인 지출 전용 별도 Google Sheet — 메인 스프레드시트(무거움)에 안
  얹기로 확정(2026-07-30 사용자 확정).
  ==========================================================
  */

  SPREADSHEET_ID: "1zOZGwnsm0GhLGGe5rATu8jR5WxAQVx7YmmiPZVU88jY",

  /*
  ==========================================================
  PLATFORMS
  대상 광고 플랫폼 8개(사용자 확정, 2026-07-30). 플랫폼마다 export 가능한
  데이터/캠페인 naming 규칙이 다름 — Meta부터 파일럿으로 검증 후 확장.
  ==========================================================
  */

  PLATFORMS: [
    "Meta",
    "Naver Search",
    "Naver GFA",
    "Google Search",
    "Google Display",
    "Naver Offline Cafe",
    "Kakao Moments",
    "Kakao Channel"
  ],

  /*
  ==========================================================
  RAW SHEETS
  플랫폼당 탭 1개, 계속 append(Leads_Raw/MTA_Raw와 동일 패턴 — 월별 탭
  아님, 2026-07-30 사용자 확정). 지금은 파일럿 Meta만 실제로 생성.
  ==========================================================
  */

  RAW_SHEET: {
    Meta: "Meta_Raw",
    "Kakao Channel": "KakaoSMS_Raw"
  },

  /*
  ==========================================================
  META — Ads Manager Export 컬럼 매핑 (실 라이브 export로 검증 완료, 2026-07-30
  — 처음엔 사용자가 옮겨 적어준 한국어 샘플을 썼으나 실제는 영어 헤더였음,
  runDebugMetaRawFirstRow() 진단으로 정정. 실제 헤더는 이 외에도 Impressions/
  Reach/CTR 등이 있으나, CPNP1 계산에 필요한 컬럼만 매핑)
  ==========================================================
  */

  META: {

    COLUMNS: {
      REPORT_START: "Reporting starts",
      REPORT_END: "Reporting ends",
      CAMPAIGN_NAME: "Campaign name",
      CAMPAIGN_START: "Date created",
      CAMPAIGN_END: "Ends",
      SPENT: "Amount spent (NZD)",
      ACCOUNT_ID: "Account ID"
    },

    /*
    ==========================================================
    ACTIVE ACCOUNT (2026-07-30 사용자 확정)
    Meta는 계정 이관 이력이 있어 export에 Account ID가 총 3개 찍힘 — 이
    값과 일치하는 행만 "현재 사용 중 계정"(월별 export로 정확한 월별
    Spent 추적 대상), 그 외 값은 전부 "예전 계정"(영구 종료, lifetime
    합계를 활성 기간에 균등분배 대상)으로 판별.
    ==========================================================
    */

    ACTIVE_ACCOUNT_ID: "2954404598150809"

  },

  /*
  ==========================================================
  NAVER SEARCH — 네이버 검색광고 Open API 연동(2026-07-31, 사용자 확정 —
  수동 붙여넣기 방식에서 전환). Base URL/인증 헤더/서명 방식은
  naver/searchad-apidoc 공식 샘플 코드(python-sample/examples/
  signaturehelper.py, ad_management_sample.py)로 확인.

  **자격증명은 여기 없음** — Customer ID/API License Key/Secret Key는
  Apps Script 편집기 "Project Settings > Script Properties"에 아래
  PROPERTY_KEYS의 키 이름으로 사용자가 직접 입력한다(git/코드에 노출 금지).
  ==========================================================
  */

  NAVER_SEARCH: {

    API: {

      BASE_URL: "https://api.naver.com",

      PROPERTY_KEYS: {
        CUSTOMER_ID: "NAVER_SEARCHAD_CUSTOMER_ID",
        API_KEY: "NAVER_SEARCHAD_API_KEY",
        SECRET_KEY: "NAVER_SEARCHAD_SECRET_KEY"
      },

      /*
      ==========================================================
      BACKFILL START (2026-07-31 사용자 확정 — "Meta와 동일한 범위")
      Ad_Spend_Cache 전체 갱신(runRefreshAdSpendCache(), AD_004_SpendCache.js)
      시 Naver Search 지출을 이 연/월부터 현재 달까지 월별로 조회해 합산한다.
      Meta 파이프라인의 실제 첫 데이터 시점(FY23 SEP, 2026-07-30 실측)과 동일.
      ==========================================================
      */

      BACKFILL_START: { YEAR: 2022, MONTH: 9 }

    },

    /*
    ==========================================================
    LEAD SOURCE OVERRIDE (2026-07-31 사용자 확인)
    Naver 검색광고 캠페인명 다수가 "_contact" 계열이라, getBusinessSegment()의
    BOFU/Search 공용 fallback이 leadSource 없이는 기본 BOFU로 오분류함
    (docs/BusinessSegmentClassification.md — Search는 Lead Source가 Naver
    Search/Google Search/Organic Search일 때만 존재). 이 채널은 구조적으로
    항상 검색광고이므로, 실제 리드가 이 채널에서 들어왔을 때와 동일한 결과가
    나오도록 leadSource에 이 고정값을 넘겨 getBusinessSegment()를 그대로
    재사용한다(campaign에 "expo" 등 확정 신호가 있으면 이 값과 무관하게
    Seminar 등으로 먼저 분류되므로 영향 없음).
    ==========================================================
    */

    LEAD_SOURCE_OVERRIDE: "naver search"

  },

  /*
  ==========================================================
  NAVER SEARCH — CAMPAIGN STATS CACHE (2026-08-05, Search_OPS Campaign/
  Impressions/Link clicks 자동화용, docs 참고 — 사용자 요청)

  Spent 캐시(위 NAVER_SEARCH.API)와 별개 — 이건 캠페인별 누적
  Impressions/Link clicks다. 스냅샷 재계산이 아니라 **누적 캐시**로 설계:
  이 시트에 캠페인별 누적치를 영구 보관하고, 매 refresh마다 "지난 갱신
  이후~오늘"만 새로 조회해서 더한다(사용자 확정, 2026-08-05).

  **실측 정정(2026-08-05)**: 애초엔 Spent 파이프라인과 같은 "최근 730일"
  제약으로 가정했으나, 실제 `runRefreshNaverSearchAdCampaignStatsCache()`
  최초 실행 에러로 `impCnt`/`clkCnt` 필드는 **"92일 이내"**라는 별도(더
  좁은) 제약이 확인됨(`{code:11004, message:"데이터는 92일 이내 기간에서만
  사용 가능합니다."}` — salesAmt 전용 조회의 730일 제약과 다름, 요청 필드
  조합별로 Naver가 허용 기간을 다르게 두는 것으로 추정). MAX_QUERY_RANGE_DAYS
  (90, 92일보다 이틀 여유)를 최초 실행 소급 범위이자, 오래 못 돌았다가
  재개될 때(예: 자격증명 만료 몇 달) since가 그보다 오래된 경우의 하한
  클램프로 동시에 사용 — `computeNaverSearchAdCampaignStatsFetchWindow_()`
  (AD_003_NaverSearch.js)가 항상 이 범위 안으로 사전에 좁혀서 요청하므로
  이 에러 자체가 재발하지 않음(사후 재시도가 아니라 사전 방지).
  ==========================================================
  */

  NAVER_SEARCH_CAMPAIGN_STATS: {

    CACHE_SHEET: "Naver_Search_Campaign_Stats_Cache",

    LAST_FETCHED_THROUGH_PROPERTY_KEY: "NAVER_SEARCHAD_CAMPAIGN_STATS_LAST_FETCHED_THROUGH",

    MAX_QUERY_RANGE_DAYS: 90

  },

  /*
  ==========================================================
  KAKAO CHANNEL — 카카오톡 채널 푸시 발송 성과 시트(사용자가 기존에 수기로
  관리해온 별도 스프레드시트, 2026-07-31 착수). Meta/Naver Search와 달리
  AD.SPREADSHEET_ID 안이 아니라 별도 스프레드시트 — 이 섹션에 자체
  SPREADSHEET_ID를 둔다. 카카오모먼트(API)로 이관되면 이 시트는 폐기 예정
  (사용자 확인)이지만, 그 전까지의 과거/현재 지출은 이 시트가 유일한 소스.
  ==========================================================
  */

  KAKAO_CHANNEL: {

    SPREADSHEET_ID: "18Ld85fuR76tsVxshEuzZ17SV00c0BEI6Rtl3HjA20RI",
    SHEET_NAME: "Performance",

    /*
    ==========================================================
    ROW LAYOUT (2026-07-31 사용자 확인)
    1행=subtotal(사용자가 직접 넣는 합계 수식, Target_Engine Block 0의 "1행은
    비워서 사용자 수식용"과 동일 관례), 2행=헤더, 3행부터 실제 데이터.
    ==========================================================
    */

    HEADER_ROW: 2,
    DATA_START_ROW: 3,

    /*
    ==========================================================
    COLUMNS (2026-07-31 사용자 확인)
    Event type 값이 이미 Business Segment 이름과 동일(Seminar/Webinar/BOFU) —
    사용자가 기존 "Direct Consult"를 전부 "BOFU"로 정정 완료해서, 캠페인명 기반
    getBusinessSegment() 없이 이 값을 그대로 Segment로 사용한다(Search/Content는
    이 채널에 해당 없음). Cost는 KRW.
    ==========================================================
    */

    COLUMNS: {
      EVENT_TYPE: "Event type",
      SENT_AT: "SentAt",
      COST: "Cost"
    },

    /*
    ==========================================================
    SYNC COLUMNS (2026-07-31 사용자 요청)
    `KakaoSMS_Raw` 뷰 탭(AD.SPREADSHEET_ID 안, RAW_SHEET["Kakao Channel"])의
    컬럼 순서 — 원본 Performance 시트 전체 컬럼 + 신규 "PIC"(B/C 사이 삽입,
    원본에 없음, 사용자가 매 행 직접 입력). `source:null`이면 값을 복사하지
    않고 빈 문자열로 채움(PIC — 애초에 원본에 없음, CTR/CvR — 원본 수식값이라
    그대로 복사하면 의미 없는 스냅샷이 되므로 사용자 확인 하에 헤더만 유지).
    ==========================================================
    */

    SYNC_COLUMNS: [
      { header: "Message Ad ID", source: null },
      { header: "FY", source: "FY" },
      { header: "Event type", source: "Event type" },
      { header: "PIC", source: null },
      { header: "SentAt", source: "SentAt" },
      { header: "Time", source: "Time" },
      { header: "Keyword", source: "Keyword" },
      { header: "Push", source: "Push" },
      { header: "Sent", source: "Sent" },
      { header: "Reach", source: "Reach" },
      { header: "Click", source: "Click" },
      { header: "Responsed", source: "Responsed" },
      { header: "Cost", source: "Cost" },
      { header: "CTR", source: null },
      { header: "CvR", source: null },
      { header: "CPL", source: "CPL" },
      { header: "비고", source: "비고" },
      { header: "Marketo program", source: "Marketo program" }
    ]

  },

  /*
  ==========================================================
  KAKAO MOMENTS — 메시지광고 API 연동(2026-08-04 착수). 비즈니스 인증
  (OAuth 2.0) 필요 — 일반 카카오 로그인과 다른 별도 체계, 어드민 키 무관.

  **자격증명은 여기 없음** — REST API 키/Client Secret은 Apps Script 편집기
  "Project Settings > Script Properties"에 아래 PROPERTY_KEYS의 키 이름으로
  사용자가 직접 입력한다(git/코드에 노출 금지, Naver Search와 동일 관행).
  ACCESS_TOKEN은 사람이 입력하는 값이 아니라 OAuth 콜백(doGet())이 토큰
  교환 후 자동으로 써넣는 값 — 그래도 같은 이유(민감정보, git 미노출)로
  Script Properties에 저장.

  **Refresh Token 없음(2026-08-04, 공식 문서로 확인 — 추측 아님)**:
  `business-auth/rest-api`/`business-auth/common` 문서 확인 결과, 비즈니스
  토큰 발급 응답엔 `access_token`/`token_type`/`scope`만 있고 `refresh_token`/
  `expires_in` 필드 자체가 없음 — 매번 인가 코드로 새로 발급하는 방식이고
  "장기 미사용 시 자동 만료"(정확한 기간 미명시). 즉 시간 기반 자동 갱신은
  애초에 불가능 — 실제 사용(캠페인 지출 자동 파이프라인이 주기적으로 호출)이
  유일한 "갱신" 수단이고, 만료/철회되면 사용자가 다시 동의 화면을 통과해야
  함(코드가 대신할 수 없음). 상세: docs/exec-plans/active/
  2026-08-04-kakao-moments-api-integration.md Decision Log.
  ==========================================================
  */

  KAKAO_MOMENTS: {

    OAUTH: {

      AUTHORIZE_URL: "https://kauth.kakao.com/oauth/business/authorize",
      TOKEN_URL: "https://kauth.kakao.com/oauth/business/token",
      TOKEN_INFO_URL: "https://kapi.kakao.com/v1/business/tokeninfo",

      // **Redirect URI는 하드코딩(2026-08-04, 실측 후 정정)** — 원래 ScriptApp.getService().getUrl()
      // 로 배포 시점에 자동으로 가져오려 했으나(닭·달걀 문제 회피 의도), Apps Script 편집기에서
      // 직접 Run(runGetKakaoMomentsAuthorizationUrl())할 때는 이 함수가 실제 배포된 /exec URL이
      // 아니라 개발용 /dev URL(도메인 경로도 다름, 카카오에 등록 안 된 값)을 돌려주는 걸 실측으로
      // 확인함 — doGet() 실행 컨텍스트 안에서만 정확함, 수동 Run에서는 신뢰 불가
      // (docs/apps-script-gotchas.md #10 참고). 그래서 실제 배포 후 나온 /exec URL을 그대로
      // 여기 박아둔다 — 카카오디벨로퍼스에 등록한 값과 반드시 동일해야 함. **재배포 시 URL이
      // 바뀌면(새 배포를 만들면 바뀜, 기존 배포를 "관리 > 편집"하면 안 바뀜) 이 값과 카카오 콘솔
      // Redirect URI 둘 다 같이 갱신할 것.**
      REDIRECT_URI: "https://script.google.com/macros/s/AKfycbwqJ08WQOWNMDvza7QWnTboks-xVfRV9XnpRDjxK1bCX9Zi6d4fyoZpNOgfqQLYkiv-qw/exec",

      // 사용자 확인(2026-08-04) — moment_bizform_result_read는 이 작업과 무관한
      // 키워드광고 스코프 제외, 메시지광고 연동에 필요한 4개만.
      SCOPES: ["moment_create", "moment_management", "moment_delete", "moment_bizform_result_read"],

      // **resource_ids — scope에 moment_create 포함 시 필수(2026-08-04, 공식 문서로 확인)**.
      // 실제로 이 값 없이 인가 요청을 보내 KOE233("지원하지 않는 파라미터로 비즈니스 인가
      // 코드를 요청한 경우") 에러를 실측함 — 문서 확인 결과 scope에 moment_create/keyword_create
      // 가 있으면 resource_ids가 조건부 필수 파라미터였음. 형식은 "ScopeGroup:ResourceId"
      // (예: "moment:12345") — "*"를 넣으면 보유한 전체 광고계정 대상. 이 광고계정 생성/관리
      // 권한(moment_create)은 "전체 광고계정만 요청 가능"이 문서에 명시돼 있어 특정 계정 ID
      // 대신 반드시 "moment:*"로 보내야 함(광고계정 1개뿐이라 실질적 차이는 없지만, 특정 ID로
      // 보내면 다시 에러가 날 수 있음 — 추측 아니라 문서 문구 그대로 반영).
      RESOURCE_IDS: ["moment:*"],

      // **Client Secret이 카카오 콘솔에 2개 존재함(2026-08-04 실측 발견)** — REST API 키
      // 카드 안에 "카카오 로그인용"과 "비즈니스 인증용" Secret이 별도로 발급됨. 이 플로우는
      // 비즈니스 인증(/oauth/business/token)이므로 반드시 BIZAUTH 쪽을 써야 함 — 카카오
      // 로그인용 Secret을 쓰면 토큰 교환이 실패함(미검증이지만 문서상 별개 자격증명이라
      // 섞어 쓸 이유 없음). 카카오 로그인용 Secret은 이 프로젝트가 안 씀(다른 용도 생기기
      // 전까진 저장 안 해도 무방, 사용자가 이미 별도 보관 중이면 그대로 둬도 무해).
      PROPERTY_KEYS: {
        REST_API_KEY: "KAKAO_MOMENTS_REST_API_KEY",
        CLIENT_SECRET: "KAKAO_MOMENTS_CLIENT_SECRET_BIZAUTH",
        ACCESS_TOKEN: "KAKAO_MOMENTS_ACCESS_TOKEN",
        OAUTH_STATE: "KAKAO_MOMENTS_OAUTH_STATE"  // CSRF 방지용 임시값(발급→콜백 사이만 보관)
      }

    },

    // **리포트 API 엔드포인트(2026-08-05, 공식 문서 확인 완료)** — 아직 실제 API 호출로
    // 응답 필드명 검증 전 단계(진단 함수용, `AD_006_KakaoMoments.js` 참고). 메시지광고는
    // adAccountId/channelProfileId를 몰라야 조회 체인을 못 타므로, 계정 정보 없이도 호출
    // 가능한 목록 조회 엔드포인트부터 순서대로 나열.
    REPORT: {
      AD_ACCOUNTS_LIST_URL: "https://apis.moment.kakao.com/openapi/v4/adAccounts/pages",
      CHANNEL_PROFILES_URL: "https://apis.moment.kakao.com/openapi/v4/adAccounts/channel/profiles",
      MESSAGE_ADS_LIST_URL: "https://apis.moment.kakao.com/openapi/message/v2/message-ads",
      MESSAGE_ADS_REPORT_URL: "https://apis.moment.kakao.com/openapi/message/v2/message-ads/reports"
    }

  },

  /*
  ==========================================================
  FX — 환율 변환(2026-07-31 신규, 사용자 확정: GOOGLEFINANCE 사용).
  Naver Search 등 KRW 원본 플랫폼의 지출을 NZD로 합산하기 위해, 메인
  스프레드시트 안 숨김 시트에 GOOGLEFINANCE 수식을 심어두고 계산된 값을
  읽는다(Apps Script는 GOOGLEFINANCE를 직접 호출할 수 없음 — 시트 수식
  경유 필요). AD_004_SpendCache.js의 fetchKrwToNzdRate_() 참고.
  ==========================================================
  */

  FX: {

    RATE_CACHE_SHEET: "FX_Rate_Cache",
    KRW_TO_NZD_FORMULA: '=GOOGLEFINANCE("CURRENCY:KRWNZD")'

  }

};
