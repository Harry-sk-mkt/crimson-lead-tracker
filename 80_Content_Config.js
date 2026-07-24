/**
 * ==========================================================
 * Marketing 2.0
 * Content Config
 *
 * Responsibility
 * Global configuration for Content_Engine / Content_OPS ("Ebook"
 * 트래커 — Business Segment=Content 전체를 대상으로 함, ebook 외
 * guide/planner/prospectus 등도 포함될 수 있음. 2026-07-24 사용자
 * 확정: 세분화하지 않고 Content 세그먼트 전체를 이 트래커로 관리).
 *
 * 60_BOFU_Config.js와 동일한 스키마를 상속 — Business Segment/시트
 * 이름만 다름.
 *
 * ⚠️ Events/BOFU/Search(50/60/70번대)와 겹치는 일반 헬퍼 함수는
 * 여기서 재정의하지 않고 그대로 재사용한다 (전역 네임스페이스 중복
 * 방지).
 *
 * Version
 * v1.0.0
 * ==========================================================
 */

const CONTENT = {

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

    ENGINE: "Content_Engine",

    OPS: "Content_OPS"

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

  Content 세그먼트 전체(ebook 외 guide/planner/prospectus 등 포함) —
  세분화하지 않기로 확정 (2026-07-24 사용자 확인).
  ==========================================================
  */

  SEGMENTS: ["Content"],

  /*
  ==========================================================
  MATCH FIELDS (Events/BOFU/Search와 동일 — 실측 검증된 필드 상속)
  ==========================================================
  */

  MATCH_FIELD: {

    MTA: "Lead Source Detail",

    LEADS: "First Touch Detail"

  },

  /*
  ==========================================================
  COUNTRY FILTER (동일 — KR만 대상, 국가 자동 분리 없음)
  ==========================================================
  */

  COUNTRY_FILTER: "KOR",

  /*
  ==========================================================
  CHANNEL DEFAULT
  ==========================================================
  */

  CHANNEL_DEFAULT: "Meta",

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

  HEADER 배열의 맨 앞 3개(A:C) 기본 숨김 (BOFU/Search와 동일).
  ==========================================================
  */

  HIDE_COLUMN_COUNT: 3,

  /*
  ==========================================================
  HEADER COLOR GROUPS (Events/BOFU/Search와 동일 색상 체계 재사용)
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
 * Content_Engine Sheet Header (Lead Source Detail + GROUP_4_COMPUTED)
 * ==========================================================
 */
const CONTENT_ENGINE_HEADERS = ["Lead Source Detail"].concat(CONTENT.GROUP_4_COMPUTED);
