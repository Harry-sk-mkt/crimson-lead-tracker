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
 * v1.3.0
 *
 * Change Log
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

  GROUP_3_MANUAL: [

    "Off/On",
    "Campaign",
    "Start Date",
    "End Date",
    "Impressions",
    "Reach",
    "Link clicks",
    "Results",
    "Spent"

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
    "Results",
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
      "Link clicks", "Results", "Spent"
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
