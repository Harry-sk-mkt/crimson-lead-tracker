/**
 * ==========================================================
 * Marketing 2.0
 * Events Config
 *
 * Responsibility
 * Global configuration for Events_Engine / Events_OPS.
 * 20_OPS_Config.js와 동일한 관행 — 별도 도메인 config 파일
 * (00_Config.js 중앙화 원칙의 기존 예외를 그대로 따름, 2026-07-24).
 *
 * 소스 시트 이름은 CONFIG.SHEETS(Leads_Master/MTA_Master)와
 * OPS.SHEET.OPS(Leads_OPS)를 그대로 참조 — 여기서 재정의하지 않는다.
 *
 * Version
 * v1.8.0
 *
 * Change Log
 * v1.8.0 (2026-08-06)
 * - TOP25_HIGHLIGHT 추가 — SF P1s/SF NLP1s/SP1%/SNP1% 4개 컬럼에서 값이
 *   상위 25%(PERCENTILE 0.75 이상, 컬럼별 독립 계산)인 셀에 배경색
 *   #01ef18 강조(사용자 요청). 실제 조건부 서식 규칙 생성은
 *   55_Events_Styles.js applyTop25HighlightRules_() 참고.
 * v1.7.1 (2026-08-06)
 * - "NP1%" → "SNP1%"로 컬럼명 정정(사용자 요청, v1.7.0에서 만든 지 얼마
 *   안 된 컬럼이라 아래 v1.7.0 로그 텍스트에도 이미 새 이름으로 소급 반영).
 * v1.7.0 (2026-08-06)
 * - 사용자 지정 헤더 재구성(실무 사용 중 필요성 대두, 2026-08-06 확정):
 *   (1) 신규 "EV IC REQ."(GROUP_2_MANUAL, 수동입력) 추가 — Salesforce는
 *       코호트 기준이라 "이 이벤트에서 신청된 IC 총계"를 직접 볼 수 없어,
 *       Ops가 관찰한 실제 총계를 수동 입력하는 컬럼(SF 계산값 "IC REQ."
 *       바로 앞에 배치, 헤더 색상은 Marketo그룹(보라)으로 사용자 확정 —
 *       IC REQ.의 SF그룹(파랑)과는 구분).
 *   (2) "Mkt P1s"/"Mkt NLP1s"(GROUP_2_MANUAL) 완전 삭제 — 실무상 더 이상
 *       안 씀(사용자 확인).
 *   (3) "LP CVR"/"LG CVR"(GROUP_3_MANUAL) 삭제, "All CVR"은 이름만 "CVR"로
 *       변경(값/의미 동일, 여전히 수동입력) — 세 CVR 대신 단일 CVR로 단순화.
 *   (4) "Leads(Meta)"(GROUP_3_MANUAL) → "Results"로 이름만 변경(값/의미 동일).
 *   (5) "CPL"(GROUP_5_DERIVED) 완전 삭제 — Match Rate와 달리 숨김 유지 없이
 *       공식/컬럼 자체를 제거(사용자 확정, 53_Events_Merge.js
 *       applyGroup5Derived_()에서 계산 라인도 제거).
 *   (6) 신규 계산식 컬럼 3개(GROUP_5_DERIVED) 추가 — "Success %"(Success÷SF
 *       Reg., Success 바로 뒤), "SP1%"(SP1÷SF P1s, SP1 바로 뒤), "SNP1%"
 *       (SNPL1÷SF NLP1s, SNPL1 바로 뒤). Match Rate와 동일하게 SF 매칭
 *       분모 대비 수동 관찰값(Success/SP1/SNPL1)의 비율 — divideGuard_()로
 *       0-division 방지(53_Events_Merge.js applyGroup5Derived_()).
 *   HEADER 전체 순서 재배치, HEADER_COLOR_GROUPS도 위 변경사항 반영.
 *   mergeEventsOPS_()가 매 빌드마다 컬럼명 기준으로 전체 재작성하는
 *   구조라(53_Events_Merge.js) 순서 변경 자체는 데이터 유실 없이 안전.
 * v1.6.0 (2026-07-24)
 * - HEADER_COLORS 조정 (사용자 요청): SF → sky blue(#0369a1), Marketo →
 *   purple(#6b21a8), Meta → Meta 브랜드 블루(#1877F2). DERIVED는 유지.
 * v1.5.0 (2026-07-24)
 * - EVENTS_ENGINE_HEADERS에 "UTM"/"Event Date" 컬럼 추가 (Lead Source
 *   Detail 바로 옆) — 사용자 요청, 51_Events_Engine.js v1.6.0 참고.
 * v1.4.0 (2026-07-24)
 * - EVENT_TYPE_LABELS 추가 (WB→Webinar, EV→Seminar) — EventType/Event Date
 *   자동 추출용 (parseProgramTypeAndDate_, 51_Events_Engine.js).
 * v1.3.0 (2026-07-24)
 * - 컬럼명/순서 사용자 지정 반영: GROUP_2_MANUAL(Reg./PL/NL(MKT)/SPL/SNL →
 *   Mkt Reg./Mkt P1s/Mkt NLP1s/SP1/SNPL1), GROUP_4_COMPUTED(All
 *   Registered 등 → SF Reg./SF NL/SF P1s/SF NLP1s/IC REQ./IC Bked/
 *   #Deals)로 리네임(순서는 그대로라 51_Events_Engine.js 로직 변경 불필요).
 *   HEADER 전체 순서 재배치 (Match Rate가 앞쪽으로, Notes가 맨 뒤로).
 * - HIDE_COLUMN_COUNT(4, A~D열 숨김), HEADER_COLOR_GROUPS/HEADER_COLORS
 *   (Marketo/SF/Meta/Derived 4개 그룹 헤더 배경색) 추가.
 * v1.2.0 (2026-07-24)
 * - KEY/HEADER/EVENTS_ENGINE_HEADERS의 "UTM Key" → "Lead Source Detail"로
 *   컬럼명 정정 (실 데이터 확인 결과 더 이상 UTM이 아니라 오해 소지 있었음).
 * - EVENT_TYPE_PREFIXES 추가: TYPE 토큰이 WB/EV인 것만 허용, WF(대부분
 *   ebook/practice test/consult page 등 비-이벤트 콘텐츠) 등은 기본 제외.
 * v1.1.0 (2026-07-24)
 * - MATCH_FIELD 전면 교체: UTM 문자열(MKT UTM Campaign 등, 채널/캠페인
 *   단위라 프로그램당 UTM이 수십 개로 쪼개짐, 실측 2,167개)이 아니라
 *   Lead Source Detail(MTA_Master)/First Touch Detail(Leads_Master) —
 *   실제 Marketo Program 이름을 담은 필드로 매칭 기준 변경 (실측 시
 *   1,376개까지 감소, 프로그램 단위에 근접). 사용자 확인.
 * - COUNTRY_SUFFIX_PATTERN 제거 — UTM 접미사 파싱은 더 이상 불필요.
 *   대신 COUNTRY_FILTER 추가: Marketo Program 문자열의 4번째 하이픈
 *   토큰이 "KOR"인 것만 대상으로 함 (KR 외 국가는 다른 팀 캠페인,
 *   우리 관리 대상 아님 — 사용자 확인, 2026-07-24).
 * v1.0.0 (2026-07-24)
 * - 최초 구현.
 * ==========================================================
 */

const EVENTS = {

  /*
  ==========================================================
  ROWS
  Leads_OPS와 다름 — 1행에 SUBTOTAL 수식 행이 추가됨.
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

    ENGINE: "Events_Engine",

    OPS: "Events_OPS"

  },

  /*
  ==========================================================
  PRIMARY KEY

  Lead Source Detail = Marketo Program 이름 문자열 (예: "WB-2025-07-KOR-
  MOFU-Core EC for Each Year of High School"). 컬럼명 "UTM Key"는
  2026-07-24 "Lead Source Detail"로 정정 (더 이상 UTM이 아니라서 오해의
  소지가 있었음, 사용자 확인). Leads_OPS의 OPS.KEY("Email")에 대응.
  ==========================================================
  */

  KEY: "Lead Source Detail",

  /*
  ==========================================================
  BUSINESS SEGMENT FILTER

  MTA_Master/Leads_Master 스캔 시 이 두 세그먼트만 대상으로 함
  (CONFIG.ACQ.SEGMENTS 하위 집합).
  ==========================================================
  */

  SEGMENTS: ["Webinar", "Seminar"],

  /*
  ==========================================================
  EVENT TYPE PREFIX ALLOWLIST (2026-07-24 확정)

  Marketo Program 이름의 1번째 하이픈 토큰(TYPE). WB(Webinar)/EV(Seminar)만
  실제 라이브 이벤트고, WF(주로 ebook/practice test/consult page 같은
  콘텐츠 자산)는 Business Segment가 Webinar/Seminar로 잡혀도 대부분
  이벤트가 아님 — 소수 예외(진짜 이벤트인데 WF로 잘못 태깅된 경우)는
  자동 제외하고, 필요 시 Ops가 Events_OPS에 직접 수동으로 행을 추가하면
  다음 Engine 갱신 때 정상적으로 매칭됨 (사용자 확인, 2026-07-24).
  ==========================================================
  */

  EVENT_TYPE_PREFIXES: ["WB", "EV"],

  /*
  ==========================================================
  EVENT TYPE LABELS (2026-07-24 추가)

  TYPE 토큰 → 사람이 읽는 EventType 값. Business Segment 명명(Webinar/
  Seminar)과 통일. EventType/Event Date 자동 추출(parseProgramTypeAndDate_,
  51_Events_Engine.js)에서 사용.
  ==========================================================
  */

  EVENT_TYPE_LABELS: {

    WB: "Webinar",

    EV: "Seminar"

  },

  /*
  ==========================================================
  MATCH FIELDS (2026-07-24 확정 — Lead Source Detail/First Touch Detail 기준)

  raw UTM 문자열(MKT UTM Campaign 등)은 채널/캠페인 단위(하나의 프로그램에
  Meta/Google 등 채널별로 UTM이 수십 개 붙음, 실측 2,167개)라 프로그램
  매칭에 못 씀. 대신:
  - MTA_Master."Lead Source Detail" (raw "Lead Source Detail", 터치 시점의
    Marketo Program 이름) → All Registered 매칭
  - Leads_Master."First Touch Detail" (raw "First Touch Detail", 최초
    유입 시점의 Marketo Program 이름) → New Registered 매칭
  두 필드 다 실측 결과 1,376개까지 감소(프로그램 단위에 근접) 확인됨.
  ==========================================================
  */

  MATCH_FIELD: {

    MTA: "Lead Source Detail",

    LEADS: "First Touch Detail"

  },

  /*
  ==========================================================
  COUNTRY FILTER (2026-07-24 확정)

  Marketo Program 이름은 "{TYPE}-{YYYY}-{MM}-{COUNTRY}-{FUNNEL}-{Division}
  {이벤트명}" 구조 (예: "WB-2025-07-KOR-MOFU-Core ..."). COUNTRY는 항상
  4번째 하이픈 토큰(0-based index 3)에 위치. KR(KOR)만 우리 팀 관리
  대상이고 US/CA/HK/SG 등은 다른 팀 캠페인이라 제외 (사용자 확인).
  ==========================================================
  */

  COUNTRY_FILTER: "KOR",

  /*
  ==========================================================
  COLUMN GROUPS
  ==========================================================
  */

  GROUP_1_MANUAL: [

    "Event Date",
    "Marketo Campaign name",
    "Target Market",
    "Division",
    "EventType",
    "PIC",
    "Speaker",
    "Time",
    "Notes"

  ],

  GROUP_2_MANUAL: [

    "Mkt Reg.",
    "EV IC REQ.",
    "Success",
    "SP1",
    "SNPL1"

  ],

  GROUP_3_MANUAL: [

    "CVR",
    "Clicks",
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

    "Match Rate",
    "Success %",
    "SP1%",
    "SNP1%",
    "CPNP1",
    "ROAS"

  ],

  DERIVED_DATE_COLUMNS: [

    "FY",
    "Month"

  ],

  /*
  ==========================================================
  OUTPUT HEADER (2026-08-06 사용자 지정 순서 — 실무 사용하며 바뀔 수 있음)

  Final Events_OPS column order. A~D열(Lead Source Detail/Match Rate/
  Target Market/Division)은 HIDE_COLUMN_COUNT만큼 기본 숨김 처리.
  ==========================================================
  */

  HEADER: [

    "Lead Source Detail",
    "Match Rate",
    "Target Market",
    "Division",

    "FY",
    "EventType",
    "PIC",
    "Event Date",
    "Time",
    "Month",
    "Marketo Campaign name",
    "Speaker",

    "SF Reg.",
    "Mkt Reg.",
    "SF NL",
    "SF P1s",
    "SF NLP1s",
    "Success",
    "Success %",
    "SP1",
    "SP1%",
    "SNPL1",
    "SNP1%",

    "EV IC REQ.",
    "IC REQ.",
    "IC Bked",
    "IC Complete",
    "#Deals",
    "Revenue",

    "CVR",
    "Spent",
    "Clicks",
    "Results",

    "CPNP1",
    "ROAS",

    "Notes"

  ],

  /*
  ==========================================================
  HIDDEN COLUMNS

  HEADER 배열의 맨 앞 N개(A~D열)를 기본 숨김 처리 (2026-07-24 확정).
  ==========================================================
  */

  HIDE_COLUMN_COUNT: 4,

  /*
  ==========================================================
  HEADER COLOR GROUPS (2026-07-24 확정)

  Marketo(파랑)/Meta(초록)/SF(주황)/Derived(회색, 계산식이라 단일
  소스가 아님) 4개 그룹으로 헤더 배경색을 구분. 색상/그룹 소속은
  실무 사용하며 조정 가능 — 45_→55_Events_Styles.js의
  applyEventsOPSStyle()에서 참조.
  ==========================================================
  */

  HEADER_COLOR_GROUPS: {

    MARKETO: [
      "Lead Source Detail", "Target Market", "Division", "EventType", "PIC",
      "Event Date", "Time", "Marketo Campaign name", "Speaker", "Notes",
      "Mkt Reg.", "Success", "SP1", "SNPL1", "EV IC REQ.",
      "FY", "Month"
    ],

    SF: [
      "SF Reg.", "SF NL", "SF P1s", "SF NLP1s",
      "IC REQ.", "IC Bked", "IC Complete", "#Deals", "Revenue"
    ],

    META: [
      "CVR", "Clicks", "Results", "Spent"
    ],

    DERIVED: [
      "Match Rate", "Success %", "SP1%", "SNP1%", "CPNP1", "ROAS"
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
  TOP 25% HIGHLIGHT (2026-08-06 사용자 요청)

  지정된 컬럼에서 값이 상위 25%(해당 컬럼 자체 분포 기준, PERCENTILE 0.75
  이상)인 셀에 배경색 강조 — 55_Events_Styles.js
  applyTop25HighlightRules_()에서 참조. 컬럼마다 독립적으로 계산(하나의
  이벤트가 4개 중 일부만 상위 25%에 들 수 있음).
  ==========================================================
  */

  TOP25_HIGHLIGHT: {

    COLUMNS: ["SF P1s", "SF NLP1s", "SP1%", "SNP1%"],
    COLOR: "#01ef18",
    PERCENTILE: 0.75

  }

};


/**
 * ==========================================================
 * Events_Engine Sheet Header
 *
 * "UTM"/"Event Date"는 2026-07-24 추가 — Lead Source Detail(월 단위
 * 정보만 있음) 대신 raw MKT UTM Campaign의 일 단위 날짜(최빈값)로
 * Event Date를 정확히 채우기 위한 근거 컬럼 (51_Events_Engine.js
 * pickModeEventDate_() 참고).
 * ==========================================================
 */
const EVENTS_ENGINE_HEADERS =
  ["Lead Source Detail", "UTM", "Event Date"].concat(EVENTS.GROUP_4_COMPUTED);
