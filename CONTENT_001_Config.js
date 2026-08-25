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
 * v1.5.0
 *
 * Change Log
 * v1.5.0 (2026-08-25)
 * - `GROUP_3_MANUAL` 문서 주석 정정(BOFU_001_Config.js v1.7.0과 동일) —
 *   Impressions/Reach도 Meta_Raw 원본에 실제로 있었음을 사용자 지적으로
 *   재확인(`runDebugMetaRawFirstRow()`, `AD_001_Config.js` v1.22.0에 매핑
 *   추가) — 이 8개 필드 전부 동일하게 자동화됨.
 * v1.4.0 (2026-08-25)
 * - `GROUP_3_MANUAL` 문서 주석 갱신(사용자 요청, Spent 자동화 2단계,
 *   BOFU_001_Config.js v1.6.0과 동일) — `Off/On`/`Campaign`/`Start
 *   Date`/`End Date`/`Link clicks`/`Results`는 이제 Meta_Raw 매칭이
 *   있으면 자동 덮어쓰기(매칭 없으면 기존 수동값 유지,
 *   `CONTENT_004_Merge.js` `applyContentMetaCampaignDataIfMatched_()`
 *   참고) — 배열 자체는 변경 없음. `Impressions`/`Reach`만 순수 수동으로
 *   남음.
 * v1.3.0 (2026-08-25)
 * - **`Spent`을 `GROUP_3_MANUAL` → `GROUP_4_COMPUTED`로 이동(사용자
 *   요청)** — `TEMPQA_029_ContentSpentCompletenessAudit.js` 감사 결과 실제
 *   수동 Spent가 FY23~27 전체에서 사실상 $0인 게 확인됨(Ad_Spend_Cache
 *   Content 세그먼트 합계 $941,743.60 대비). Events_OPS가 이미 한 것과
 *   동일한 전환(2026-08-06, EVENTS_001_Config.js v1.9.0) — Meta_Raw 기준
 *   매 재빌드마다 새로 계산, 수동 보존 안 함. 실제 집계 로직은
 *   `CONTENT_002_Engine.js` `computeContentMetaSpendAggregates_()` 참고.
 * v1.2.0 (2026-08-25)
 * - TOP25_HIGHLIGHT 추가(사용자 요청) — BOFU_001_Config.js v1.4.0과 동일
 *   스펙: SF NLP1s(상위 25%)/CPNP1(비용 지표라 하위 25%) 컬럼에 배경색
 *   #01ef18 강조. 실제 규칙 생성은 OPS_002_Styles.js
 *   applyPercentileHighlightRules_() 참고(CONTENT_006_Styles.js에서 호출).
 * v1.1.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `80_Content_Config.js` → 신규 `CONTENT_001_Config.js`, 코드 내용 변경 없음.
 * v1.1.0 (2026-08-09)
 * - RATIO_FORMULAS 신규(50/60/70_*_Config.js와 동일 패턴) —
 *   GROUP_5_DERIVED 6개 컬럼의 분자/분모 짝을 중앙화,
 *   83_Content_Merge.js의 applyContentGroup5Derived_() 삭제 근거(값
 *   대신 실제 시트 수식으로 전환, 사용자 요청).
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

  /*
  2026-08-25(사용자 요청, Spent 자동화 2단계 — Impressions/Reach도
  Meta_Raw에 실제로 있음을 사용자 지적으로 재확인 후 포함): 이 8개
  필드 전부 Meta_Raw 매칭이 있으면 CONTENT_004_Merge.js의
  applyContentMetaCampaignDataIfMatched_()가 자동 덮어쓰고, 매칭 없으면
  이 배열이 기존 수동값을 baseline으로 보존한다(copyColumns_() 그대로).
  */
  GROUP_3_MANUAL: [

    "Off/On",
    "Campaign",
    "Start Date",
    "End Date",
    "Impressions",
    "Reach",
    "Link clicks",
    "Results"

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
    "Revenue",
    "Spent"

  ],

  GROUP_5_DERIVED: [

    "CTR",
    "CvR",
    "CPL",
    "CPNP1",
    "ROAS",
    "Match Rate"

  ],

  /*
  ==========================================================
  RATIO FORMULAS (2026-08-09 신규, 50/60/70_*_Config.js와 동일 패턴)

  기존 applyContentGroup5Derived_()(83_Content_Merge.js, 이번에 삭제됨)
  본문과 동일한 분자/분모 짝.
  ==========================================================
  */
  RATIO_FORMULAS: [

    { column: "CTR", numerator: "Link clicks", denominator: "Impressions" },
    { column: "CvR", numerator: "Results", denominator: "Link clicks" },
    { column: "CPL", numerator: "Spent", denominator: "TotalReg." },
    { column: "CPNP1", numerator: "Spent", denominator: "SF NLP1s" },
    { column: "ROAS", numerator: "Revenue", denominator: "Spent" },
    { column: "Match Rate", numerator: "SF Reg.", denominator: "TotalReg." }

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

  },

  /*
  ==========================================================
  TOP 25% HIGHLIGHT (2026-08-25 사용자 요청, BOFU_001_Config.js와 동일 스펙)

  SF NLP1s(리드 수 — 높을수록 좋음)는 상위 25%(PERCENTILE 0.75 이상),
  CPNP1(비용 — 낮을수록 좋음)은 하위 25%(PERCENTILE 0.25 이하)를 배경색
  #01ef18로 강조. 컬럼별 독립 계산 — OPS_002_Styles.js
  applyPercentileHighlightRules_()에서 참조.
  ==========================================================
  */

  TOP25_HIGHLIGHT: {

    COLUMNS: [
      { name: "SF NLP1s", direction: "top", percentile: 0.75 },
      { name: "CPNP1", direction: "bottom", percentile: 0.25 }
    ],

    COLOR: "#01ef18"

  }

};


/**
 * ==========================================================
 * Content_Engine Sheet Header (Lead Source Detail + GROUP_4_COMPUTED)
 * ==========================================================
 */
const CONTENT_ENGINE_HEADERS = ["Lead Source Detail"].concat(CONTENT.GROUP_4_COMPUTED);
