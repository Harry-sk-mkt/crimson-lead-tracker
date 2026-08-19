/**
 * ==========================================================
 * Marketing 2.0
 * BOFU Config
 *
 * Responsibility
 * Global configuration for BOFU_Engine / BOFU_OPS.
 * 50_Events_Config.js와 동일한 관행(도메인별 별도 config 파일).
 *
 * 설계 문서
 * BOFU_OPS / BOFU_Engine 설계 (2026-07-24, claude.ai 세션) — Events
 * 트래커(50번대)의 검증된 패턴을 상속. 차이점만 이 파일/관련 파일에 반영.
 *
 * 소스 시트 이름은 CONFIG.SHEETS(Leads_Master/MTA_Master)와
 * OPS.SHEET.OPS(Leads_OPS)를 그대로 참조 — 여기서 재정의하지 않는다.
 *
 * ⚠️ Events(50번대)와 겹치는 일반 헬퍼 함수(stripRegistrationFormSuffix_,
 * isKoreanProgram_, isValidDate_, divideGuard_, columnIndexToLetter_)는
 * 여기서 재정의하지 않고 51/53/54_Events_*.js의 정의를 그대로 재사용한다
 * (Apps Script 전역 네임스페이스 — 같은 이름 재정의 시 충돌 발생).
 * 설계 문서의 "Events 파일 복제" 전략은 "동일 아키텍처 패턴 적용"으로
 * 해석 — 함수명까지 그대로 복제하면 전역 중복 선언 에러가 남.
 *
 * Version
 * v1.3.0
 *
 * Change Log
 * v1.3.0 (2026-08-19)
 * - `BOFU_ENGINE_HEADERS`에 "Earliest Lead Date" 보조 컬럼 추가(사용자
 *   요청) — Start Date가 비어있는 신규 런칭 프로그램이
 *   compareByStartDateBlankLast_()로 인해 시트 최하단에 묻혀 안 보이던
 *   문제 해결용. `BOFU.GROUP_4_COMPUTED`에는 넣지 않음(그건 매번 무조건
 *   덮어쓰는 값들이라 Manual Start Date와는 다른 취급이 필요) — Events의
 *   "Event Date" 보조 컬럼과 동일 패턴. 상세: `BOFU_002_Engine.js`/
 *   `BOFU_004_Merge.js` 참고.
 * v1.2.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `60_BOFU_Config.js` → 신규 `BOFU_001_Config.js`, 코드 내용 변경 없음.
 * v1.2.0 (2026-08-09)
 * - RATIO_FORMULAS 신규(50_Events_Config.js v1.10.0과 동일 패턴) —
 *   GROUP_5_DERIVED 6개 컬럼의 분자/분모 짝을 중앙화, 63_BOFU_Merge.js의
 *   applyBOFUGroup5Derived_() 삭제 근거(값 대신 실제 시트 수식으로 전환,
 *   사용자 요청).
 * v1.1.0 (2026-07-24)
 * - 실데이터 검증 완료(133개 프로그램, TYPE 필터 불필요 확정) 후 컬럼
 *   순서/이름 사용자 최종 확정 반영: "Amount spent"→"Spent",
 *   "Click to Lead CvR"→"CvR"로 리네임, "Cost per result" 지표 제거.
 *   HIDE_COLUMN_COUNT 2→3 (A:C — Lead Source Detail/Match Rate/Division).
 * v1.0.0 (2026-07-24)
 * - 최초 구현.
 * ==========================================================
 */

const BOFU = {

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

    ENGINE: "BOFU_Engine",

    OPS: "BOFU_OPS"

  },

  /*
  ==========================================================
  PRIMARY KEY

  Lead Source Detail = Marketo Program 이름 문자열. Events와 동일하게
  raw 값을 매칭 키로 쓰고, "Marketo Campaign name"은 화면 표시용
  Manual 컬럼으로 분리 (BOFU는 1 Program = 1 Meta Campaign 1:1이라
  국가/채널 분리 자체가 없음 — 그래도 원본 값 보존을 위해 분리 유지).
  ==========================================================
  */

  KEY: "Lead Source Detail",

  /*
  ==========================================================
  BUSINESS SEGMENT FILTER

  Events(Webinar/Seminar)와 달리 BOFU는 세그먼트 1개만 대상.
  ==========================================================
  */

  SEGMENTS: ["BOFU"],

  /*
  ==========================================================
  MATCH FIELDS (Events와 동일 — 실측 검증된 필드 그대로 상속)
  ==========================================================
  */

  MATCH_FIELD: {

    MTA: "Lead Source Detail",

    LEADS: "First Touch Detail"

  },

  /*
  ==========================================================
  COUNTRY FILTER (Events와 동일 — KR만 대상, 국가 자동 분리 없음)
  ==========================================================
  */

  COUNTRY_FILTER: "KOR",

  /*
  ==========================================================
  CHANNEL DEFAULT

  광고 채널은 현재 Meta 단일. 신규 발견 프로그램 행의 Channel 컬럼
  기본값. YouTube 등 신규 채널 추가 시 Ops가 수동으로 값 변경.
  ==========================================================
  */

  CHANNEL_DEFAULT: "Meta",

  /*
  ==========================================================
  COLUMN GROUPS
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

  /*
  ==========================================================
  RATIO FORMULAS (2026-08-09 신규, 50_Events_Config.js와 동일 패턴)

  기존 applyBOFUGroup5Derived_()(63_BOFU_Merge.js, 이번에 삭제됨) 본문과
  동일한 분자/분모 짝 — 54_Events_Write.js의 buildRatioFormula_()가 이
  스펙으로 시트 수식을 생성한다.
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
  OUTPUT HEADER (2026-07-24 사용자 확정 순서, 2차 조정)
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

  HEADER 배열의 맨 앞 3개(A:C — Lead Source Detail/Match Rate/Division)
  기본 숨김 (2026-07-24 사용자 확정).
  ==========================================================
  */

  HIDE_COLUMN_COUNT: 3,

  /*
  ==========================================================
  HEADER COLOR GROUPS (Events와 동일 색상 체계 재사용 — 트래커 간
  시각적 일관성 목적. 조정 필요 시 언제든 변경 가능)
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
 * BOFU_Engine Sheet Header (Lead Source Detail + Earliest Lead Date +
 * GROUP_4_COMPUTED)
 *
 * "Earliest Lead Date"(2026-08-19 신규) — BOFU의 Start Date는 원래
 * Meta Ads 원본을 그대로 수동 입력하는 Manual 필드라 SF 터치 데이터에서
 * 날짜를 추정할 필요가 없다는 설계였으나, 신규 런칭 프로그램은 Ops가
 * Start Date를 아직 안 채운 동안 정렬(compareByStartDateBlankLast_)상
 * 최하단으로 밀려 눈에 안 띄는 문제가 발견됨(사용자 요청) — Events의
 * "Event Date" 보조 컬럼과 동일한 패턴으로, Start Date가 비어있을 때만
 * 채우는 fallback 값을 Engine에 같이 실어 보낸다(BOFU.GROUP_4_COMPUTED에는
 * 넣지 않음 — 그건 매번 무조건 덮어쓰는 값들이라 Manual 필드인 Start
 * Date에는 안 맞음). 소비처: BOFU_004_Merge.js
 * applyBOFUAutoDerivedFieldsIfBlank_().
 * ==========================================================
 */
const BOFU_ENGINE_HEADERS = ["Lead Source Detail", "Earliest Lead Date"].concat(BOFU.GROUP_4_COMPUTED);
