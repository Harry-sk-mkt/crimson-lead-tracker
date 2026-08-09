/**
 * ==========================================================
 * Marketing 2.0
 * Leads OPS Config
 *
 * Responsibility
 * Global configuration for Leads_OPS Build
 *
 * Version
 * v2.3
 *
 * Change Log
 * v2.3 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `20_OPS_Config.js` → 신규 `OPS_001_Config.js`, 코드 내용 변경 없음.
 * v2.2 (2026-07-25)
 * - "Sales Accepted Date" 추가 (SYNC_COLUMNS + HEADER, IC Booked Date 앞).
 *   SAL 과집계 문제(Lead Record Type 스냅샷 반복) 해결을 위해 SAL 판정을
 *   이벤트 날짜 기준으로 바꾸는 작업의 일부 — 09_MTAFunnelSync.js/
 *   30_ACQReport.js 참고.
 * v2.1 (2026-07-22)
 * - "Last IC Requested Date"(MANUAL_COLUMNS), "Total IC Requests"(신규 IC_REQUEST.COUNTER) 추가.
 * - "IC Requested"를 MANUAL_COLUMNS에서 제외 — mergeOPS()에서 sync마다 리셋+카운트 증가하는
 *   특수 컬럼으로 전환 (재신청 이력 보존 목적, docs/OperationsLayer.md 참고).
 * ==========================================================
 */

const OPS = {
  /*
  ==========================================================
  ROWS
  ==========================================================
  */

  ROWS : {

    HEADER : 1,

    DATA_START : 2

  },
  
  /*
  ==========================================================
  SHEETS
  ==========================================================
  */

  SHEET : {

    MASTER : "Leads_Master",

    OPS : "Leads_OPS",

    QA : "Leads_OPS_QA"

  },


  /*
  ==========================================================
  PRIMARY KEY
  ==========================================================
  */

  KEY : "Email",


  /*
  ==========================================================
  SALESFORCE MANAGED COLUMNS

  Always overwritten from Leads_Master.
  (2026-07-21: IC Booked/Completed/Won/Revenue 제거 —
   이제 syncICFunnelToOPS()만 이 필드들을 관리함.
   Master는 이 필드들의 신뢰할 수 있는 최신 소스가 아니게 됨.)
  ==========================================================
  */
  SF_COLUMNS : [

    "Lead ID",
    "Created FY",
    "Create Date",
    "Company / Account",
    "Email",
    "Phone",
    "School Name",
    "Lead Priority",
    "First Touch Detail",
    "Business Segment"

    ],


  /*
  ==========================================================
  IC FUNNEL SYNC COLUMNS (2026-07-21 신규)

  syncICFunnelToOPS()만 갱신. mergeOPS()는 이 필드들을
  Master 값으로 덮어쓰지 않고, 기존 OPS 값을 보존한다.
  ==========================================================
  */
  SYNC_COLUMNS : [

    "IC Booked Date",
    "IC Completed Date",
    "Opportunity Won Date",
    "Revenue",
    "Sales Accepted Date"

  ],


  /*
  ==========================================================
  MARKETING MANAGED COLUMNS

  Preserved between builds.
  ==========================================================
  */

  MANUAL_COLUMNS : [

    "FT Override",
    "FT Checked",

    "Priority Override",
    "Priority Checked",

    "Last IC Requested Date",

    "Revenue Actual",

    "Notes"

  ],

  /*
  ==========================================================
  IC REQUEST TRACKING (2026-07-22 추가)

  "IC Requested"는 다른 MANUAL_COLUMNS와 달리 그대로 보존되지 않는다.
  mergeOPS()에서 매 sync마다: 이전 값이 true였으면 "Total IC Requests"를
  +1 하고 "IC Requested"는 false로 리셋한다. 재신청 이력(횟수)을
  보존하기 위함 — 체크박스 하나로는 "몇 번 재신청했는지"가 안 남았음.
  ==========================================================
  */
  IC_REQUEST : {

    CHECKBOX : "IC Requested",
    COUNTER : "Total IC Requests"

  },

  /*
  ==========================================================
  OUTPUT HEADER

  Final Leads_OPS column order.
  ==========================================================
  */

  HEADER : [

    "Lead ID",

    "Created FY",
    "Create Date",

    "Company / Account",

    "Email",

    "Phone",

    "School Name",

    "Lead Priority",
    "Priority Override",
    "Priority Checked",

    "First Touch Detail",

    "Business Segment",

    "FT Override",
    "FT Checked",

    "IC Requested",

    "Last IC Requested Date",

    "Total IC Requests",

    "Sales Accepted Date",

    "IC Booked Date",

    "IC Completed Date",

    "Opportunity Won Date",

    "Revenue",

    "Revenue Actual",

    "Notes"

  ],

  /*
  ==========================================================
  BUILD OPTIONS
  ==========================================================
  */

  BUILD : {

    FREEZE_ROWS : 1,

    FILTER : true,

    SORT_BY : "Create Date",

    SORT_ASC : true

  },


  /*
  ==========================================================
  QA
  ==========================================================
  */

  QA : {

    ENABLED : false,

    CHECK_DUPLICATE_EMAIL : true,

    CHECK_EMPTY_EMAIL : true

  }

};


const BUILD_STATUS = {

  NEW : "NEW",

  UPDATED : "UPDATED",

  DUPLICATE : "DUPLICATE",

  SKIPPED : "SKIPPED"

};