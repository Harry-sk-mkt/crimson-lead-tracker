/**
 * ==========================================================
 * Marketing 2.0
 * Search Config
 *
 * Responsibility
 * Global configuration for Search_Engine / Search_OPS.
 * 60_BOFU_Config.js와 동일한 관행(도메인별 별도 config 파일) — BOFU
 * 스키마를 그대로 상속, Business Segment/시트 이름만 다름.
 *
 * ⚠️ Events/BOFU(50/60번대)와 겹치는 일반 헬퍼 함수
 * (stripRegistrationFormSuffix_, isKoreanProgram_, isValidDate_,
 * divideGuard_, columnIndexToLetter_, copyColumns_,
 * computeRowBandingColors_)는 여기서 재정의하지 않고 그대로 재사용한다
 * (Apps Script 전역 네임스페이스 — 같은 이름 재정의 시 충돌 발생).
 *
 * Version
 * v1.8.0
 *
 * Change Log
 * v1.8.0 (2026-08-06)
 * - HIDDEN_COLUMN_NAMES 추가(사용자 요청) — "Campaign"(Naver Search Ad API
 *   자동 매칭된 실제 네이버 캠페인 이름, GROUP_3A_AUTO) 컬럼을 기본 숨김
 *   처리. HIDE_COLUMN_COUNT(선행 N개 연속 숨김)와 달리 HEADER 중간에 있는
 *   컬럼이라 이름 기준으로 별도 처리(75_Search_Styles.js 참고).
 * v1.7.0 (2026-08-05)
 * - 헤더 "Results" → "Results 90D"로 개명(사용자 요청) — ccnt가 Naver API
 *   자체 하드 리밋으로 항상 최근 90일 롤링 값만 반영 가능하다는 걸(Spent는
 *   전체 기간 소급 가능한 것과 대비) 헤더에서 바로 알 수 있게 함. `HEADER`/
 *   `GROUP_3A_AUTO`/`HEADER_COLOR_GROUPS.META` 전부 반영. Search_OPS는 매
 *   빌드마다 전체 재작성이라 기존 시트의 옛 헤더 텍스트가 남지 않음.
 * v1.6.0 (2026-08-05)
 * - `GROUP_3_MANUAL`에서 "Results"도 분리 → `GROUP_3A_AUTO`(Naver Search Ad
 *   API ccnt 자동 매칭, 사용자 요청 — `runDebugNaverSearchAdStatsExpandedFields()`
 *   실측 결과 ccnt가 항상 clkCnt 이하라 "전환수"로 확정). "Reach"만 API에
 *   대응 필드가 없어 계속 수동. 상세: 72_Search_Build.js/73_Search_Merge.js/
 *   AD_003_NaverSearch.js 참고.
 * v1.5.0 (2026-08-05)
 * - `GROUP_3_MANUAL`에서 "Spent"도 분리 → `GROUP_3A_AUTO`(Naver Search Ad API
 *   salesAmt 자동 매칭, KRW→NZD 변환, 사용자 요청). "Reach"/"Results"는 API에
 *   대응 필드가 없어(Results는 실측 진단 대기) 계속 수동. 상세:
 *   72_Search_Build.js/73_Search_Merge.js/AD_003_NaverSearch.js 참고.
 * v1.4.0 (2026-08-05)
 * - `GROUP_3_MANUAL`에서 "Campaign"/"Impressions"/"Link clicks" 분리 →
 *   신규 `GROUP_3A_AUTO`(Naver Search Ad API 자동 매칭, 사용자 요청).
 *   "Reach"는 Naver API에 해당 지표가 없어 `GROUP_3_MANUAL`에 그대로 유지.
 *   `HEADER`/`HEADER_COLOR_GROUPS` 순서·구성은 변경 없음(그룹 소속만 재분류).
 *   상세: 73_Search_Merge.js/AD_003_NaverSearch.js 참고.
 * v1.3.0 (2026-07-29)
 * - CHANNEL_DEFAULT "Meta" → 빈 값으로 변경(사용자 확정 — "채널에 meta가
 *   보이면 안돼"). BOFU에서 그대로 물려받은 값이라 실데이터 검증이 안 돼
 *   있었음 — 실측 결과 대부분 검색 광고라 잘못된 기본값으로 확인. 기존
 *   Search_OPS에 이미 박제된 "Meta" 값은 runClearSearchOPSMetaChannel()
 *   (71_Search_Engine.js)로 일괄 공란 처리, 이후 사용자가 캠페인명 패턴
 *   보고 직접 채워 넣음.
 * v1.2.0 (2026-07-24)
 * - Country 필터(자동 KOR/KR 판별) 및 대소문자/중괄호 정규화 도입을
 *   보류가 아니라 하지 않는 것으로 최종 확정 (사용자 결정). 실측
 *   결과 국가 토큰이 첫 "_" 앞(KR_/US_/ASIA_/AU_ 등, 대소문자 혼재)에
 *   오는 구조였으나, revenue 있는 Search 리드가 총 25개뿐이라 자동
 *   필터/정규화보다 사용자가 A열(hidden, MKT UTM Campaign 원본)을 보고
 *   직접 Marketo Program 매핑 + 한국 딜 여부 + 중복 캠페인 판단을
 *   수동으로 하는 편이 더 안전하다고 판단. Search_OPS는 Business
 *   Segment=Search 전체를 필터링 없이 노출하고, 국가/중복 판단은 전부
 *   Manual 컬럼(PIC/Marketo Campaign name/Notes 등)에서 사람이 처리.
 * v1.1.0 (2026-07-24)
 * - MATCH_FIELD을 Marketo Program 이름 필드("Lead Source Detail"/
 *   "First Touch Detail")에서 raw campaign 필드("MKT UTM Campaign"/
 *   "First MKT UTM Campaign")로 변경. 실데이터 검증 결과 Search
 *   Business Segment 리드는 대부분 Marketo Program(웹폼) 없이 직접
 *   캡처되는 광고/상담 신청이라, Lead Source Detail이 비어있거나
 *   Content류 프로그램명이 섞여 들어와 원하는 값(예: "2025-07-KOR-Naver
 *   SA Study Consultants US", "2021-07-KOR-Book a consult page")이 전혀
 *   안 나오는 문제 발견 (사용자 확인 후 결정).
 * ==========================================================
 */

const SEARCH = {

  /*
  ==========================================================
  ROWS
  ==========================================================
  */

  ROWS: {

    SUBTOTAL: 1,

    HEADER: 2,

    DATA_START: 3

  },

  /*
  ==========================================================
  SHEETS
  ==========================================================
  */

  SHEET: {

    ENGINE: "Search_Engine",

    OPS: "Search_OPS"

  },

  /*
  ==========================================================
  PRIMARY KEY
  ==========================================================
  */

  KEY: "Lead Source Detail",

  /*
  ==========================================================
  BUSINESS SEGMENT FILTER
  ==========================================================
  */

  SEGMENTS: ["Search"],

  /*
  ==========================================================
  MATCH FIELDS (2026-07-24 변경 — Events/BOFU/Content와 다름)

  Search 리드는 대부분 Marketo Program(웹폼) 없이 직접 캡처되는 광고/상담
  신청이라 "Lead Source Detail"(Marketo Program 이름)이 아니라 raw
  "MKT UTM Campaign"(MTA_Master, 터치별)/"First MKT UTM Campaign"
  (Leads_Master, 최초 터치)이 실제 식별값을 담고 있음 (사용자 확인).
  ==========================================================
  */

  MATCH_FIELD: {

    MTA: "MKT UTM Campaign",

    LEADS: "First MKT UTM Campaign"

  },

  /*
  ==========================================================
  COUNTRY FILTER — 적용 안 함 (2026-07-24 최종 확정, 사용자 결정)

  Events/BOFU/Content와 달리 Search는 자동 국가 필터를 두지 않음. 국가
  판별/중복 캠페인 정리는 사용자가 A열(hidden, MKT UTM Campaign 원본)을
  보고 직접 수행. 71_Search_Engine.js의 aggregateSearchMTATouchRecords_/
  aggregateSearchLeadsRecords_는 Business Segment=Search 필터만 적용.
  ==========================================================
  */

  /*
  ==========================================================
  CHANNEL DEFAULT (2026-07-29 확정 — 빈 값)

  원래 BOFU에서 그대로 물려받은 "Meta" 기본값이었으나(2026-07-24, 실데이터
  검증 안 된 상태로 도입) 실측 결과 Search_OPS 대부분이 실제로는 Meta가
  아니라 검색 광고(Naver/Google Search Ads)라 잘못된 기본값으로 확인됨
  (사용자 확인). Naver SA/Google SA로 식별되는 건 resolveSearchChannel
  FromKey_()(71_Search_Engine.js)가 정확한 채널을 채우고, 그 외(raw UTM만
  있고 프로그램명이 없는 오래된 캠페인들)는 자동 추정하지 않고 빈 값으로
  둬서 사용자가 캠페인명 패턴을 보고 직접 채워 넣도록 함(사용자 확정 —
  "채널에 meta가 보이면 안돼", 자동 규칙화는 오분류 위험 있어 보류).
  ==========================================================
  */

  CHANNEL_DEFAULT: "",

  /*
  ==========================================================
  COLUMN GROUPS (BOFU와 동일 스키마)
  ==========================================================
  */

  GROUP_1_MANUAL: [

    "PIC",
    "Marketo Campaign name",
    "Channel",
    "Division",
    "Notes"

  ],

  GROUP_2_MANUAL: [

    "TotalReg."

  ],

  /*
  ==========================================================
  GROUP 3 — 순수 수동 입력 (자동 소스 없음)

  2026-08-05: "Campaign"/"Impressions"/"Link clicks"/"Spent"/"Results"는
  전부 GROUP_3A_AUTO로 분리됨(Naver Search Ad API 자동 매칭, 사용자 요청,
  Results는 실측 결과 ccnt 필드로 확정 — AD_003_NaverSearch.js
  runDebugNaverSearchAdStatsExpandedFields() 참고). "Reach"만 Naver API에
  해당 지표가 없어 여전히 순수 수동.
  ==========================================================
  */
  GROUP_3_MANUAL: [

    "Off/On",
    "Start Date",
    "End Date",
    "Reach"

  ],

  /*
  ==========================================================
  GROUP 3A — Naver Search Ad API 자동 매칭 (2026-08-05 신규, Spent/Results 추가)

  Search_OPS 키(Marketo Program명 또는 raw UTM)와 Naver 캠페인 실제
  이름이 매칭되면 이 5개 필드를 캐시값으로 덮어씀(73_Search_Merge.js의
  applySearchNaverCampaignStats_() 참고) — 매칭 안 되면 기존 값(수동
  입력 또는 빈 값) 그대로 유지(copyColumns_() fallback). "Spent"는
  Naver salesAmt(KRW)를 GOOGLEFINANCE 환율로 NZD 변환한 값(사용자 확정 —
  ACQ_REP과 통화 통일, 72_Search_Build.js 참고). "Results 90D"는 Naver ccnt
  (전환수로 추정, 실측 확인 — 사용자 확정)를 변환 없이 그대로 사용 —
  헤더명에 "90D"를 명시(2026-08-05, 사용자 요청): ccnt는 Naver API 자체
  하드 리밋으로 최근 90일만 조회 가능해 Spent(전체 기간 소급 가능, 사용자
  확인)와 달리 항상 최근 90일 롤링 값이라는 걸 헤더에서 바로 알 수 있게 함.
  ==========================================================
  */
  GROUP_3A_AUTO: [

    "Campaign",
    "Impressions",
    "Link clicks",
    "Spent",
    "Results 90D"

  ],

  GROUP_4_COMPUTED: [

    "SF Reg.",
    "SF NL",
    "SF P1s",
    "SF NLP1s",
    "IC REQ.",
    "IC Bked",
    "IC Complete",
    "#Deals",
    "Revenue"

  ],

  GROUP_5_DERIVED: [

    "CTR",
    "CvR",
    "CPL",
    "CPNP1",
    "ROAS",
    "Match Rate"

  ],

  DERIVED_DATE_COLUMNS: [

    "FY",
    "Month"

  ],

  /*
  ==========================================================
  OUTPUT HEADER (BOFU 확정 순서 그대로 상속)
  ==========================================================
  */

  HEADER: [

    "Lead Source Detail",
    "Match Rate",
    "Division",

    "FY",
    "Month",

    "Off/On",
    "Start Date",
    "End Date",

    "PIC",
    "Marketo Campaign name",
    "Channel",

    "SF Reg.",
    "TotalReg.",
    "SF NL",
    "SF P1s",
    "SF NLP1s",
    "CPNP1",

    "IC REQ.",
    "IC Bked",
    "IC Complete",
    "#Deals",
    "Revenue",

    "Campaign",
    "Impressions",
    "Reach",
    "Link clicks",
    "CTR",
    "Results 90D",
    "CvR",
    "Spent",
    "CPL",
    "ROAS",

    "Notes"

  ],

  /*
  ==========================================================
  HIDDEN COLUMNS

  HEADER 배열의 맨 앞 3개(A:C) 기본 숨김 (BOFU와 동일).
  ==========================================================
  */

  HIDE_COLUMN_COUNT: 3,

  /*
  ==========================================================
  HIDDEN COLUMN NAMES (2026-08-06 사용자 요청)

  HIDE_COLUMN_COUNT(선행 N개 연속 숨김)와 별개로, HEADER 중간에 있는
  특정 컬럼을 이름 기준으로 숨김 처리 — 75_Search_Styles.js
  applySearchOPSStyle()에서 참조.
  ==========================================================
  */

  HIDDEN_COLUMN_NAMES: ["Campaign"],

  /*
  ==========================================================
  HEADER COLOR GROUPS (Events/BOFU와 동일 색상 체계 재사용)
  ==========================================================
  */

  HEADER_COLOR_GROUPS: {

    MARKETO: [
      "Lead Source Detail", "PIC", "Marketo Campaign name", "Channel",
      "Division", "Notes", "TotalReg.", "FY", "Month"
    ],

    SF: [
      "SF Reg.", "SF NL", "SF P1s", "SF NLP1s",
      "IC REQ.", "IC Bked", "IC Complete", "#Deals", "Revenue"
    ],

    META: [
      "Off/On", "Campaign", "Start Date", "End Date", "Impressions", "Reach",
      "Link clicks", "Results 90D", "Spent"
    ],

    DERIVED: [
      "Match Rate", "CTR", "CvR",
      "CPL", "CPNP1", "ROAS"
    ]

  },

  HEADER_COLORS: {

    MARKETO: "#6b21a8",
    SF: "#0369a1",
    META: "#1877F2",
    DERIVED: "#434343"

  }

};


/**
 * ==========================================================
 * Search_Engine Sheet Header (Lead Source Detail + GROUP_4_COMPUTED)
 * ==========================================================
 */
const SEARCH_ENGINE_HEADERS = ["Lead Source Detail"].concat(SEARCH.GROUP_4_COMPUTED);
