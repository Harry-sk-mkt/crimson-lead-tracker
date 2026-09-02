/**
 * ==========================================================
 * Marketing 2.0
 * Leads OPS Config
 *
 * Responsibility
 * Global configuration for Leads_OPS Build
 *
 * Version
 * v2.6
 *
 * Change Log
 * v2.6 (2026-09-02)
 * - **"#Touches" 신규 컬럼**(HEADER + SYNC_COLUMNS) — Leads_OPS 필드
 *   소유권 재편(사용자 확정): MTA는 이제 "터치 지표만" 관리(Revenue/Lead
 *   Priority sync 제거), 그 대신 이 리드의 MTA_Master 터치 개수를
 *   `syncMTAFunnelToOPS_()`(`MASTER_003_MTAFunnelSync.js` v1.10.0)가
 *   동기화. "Total IC Requests" 바로 뒤에 배치(부속 널쳐링 지표 그룹).
 *   SYNC_COLUMNS 주석 전면 갱신 — Revenue/Opportunity Won Date 실제
 *   소유 함수가 `syncRevenueToOPS_()`(`MASTER_011_RevenueSync.js` 신규,
 *   Deal Tracker 외부시트 Email 매칭)로 이관된 사실 반영.
 * v2.5 (2026-09-01)
 * - 코드 변경 없음 — SYNC_COLUMNS 주변 주석만 정정. "Sales Accepted Date"의
 *   실제 소유 함수가 SAL 8월 갭 조사(docs/OpenItems.md #32) 결과 MTA_Master
 *   기반 `syncMTAFunnelToOPS_()`에서 ICFunnel_Raw 기반
 *   `syncICFunnelToOPS_()`(`MASTER_009_ICFunnelSync.js`)로 이관된 사실을 반영.
 * v2.4 (2026-08-26)
 * - 코드 변경 없음 — SF_COLUMNS/SYNC_COLUMNS 주변 주석만 정정. IC Booked/
 *   Completed/Won Date의 실제 소유 함수가 ICFunnel_Raw 재도입으로
 *   `syncICFunnelToOPS_()`(신규)로 옮겨간 사실을 반영(`docs/OpenItems.md` #32).
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
   Master는 이 필드들의 신뢰할 수 있는 최신 소스가 아니게 됨.
   2026-08-26: 아래 SYNC_COLUMNS 주석 참고 — 실제 소유 함수가
   재도입/재분리됨.)
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
  FUNNEL SYNC COLUMNS (2026-07-21 신규, 2026-09-02 필드 소유권 재편)

  mergeOPS()는 이 필드들을 Master 값으로 덮어쓰지 않고,
  기존 OPS 값을 보존한다 — 실제 갱신은 아래 4개 함수가 필드별로
  나눠 담당한다(리포트별 소유권 완전 분리, 사용자 확정):
  - "IC Booked Date" / "IC Completed Date"
    → syncICFunnelToOPS_()  (MASTER_009_ICFunnelSync.js, ICFunnel_Raw 기반,
      터치 무관 Lead 레벨 최신 상태 — Opportunity Won Date는 2026-09-02부터
      이 함수 소유가 아님, 아래 참고)
  - "Sales Accepted Date"
    → syncSALToOPS_()  (MASTER_010_SALSync.js, SAL_Raw 전용 외부시트 기반 —
      2026-09-02부터 IC Funnel에서 분리, docs/OpenItems.md #38)
  - "#Touches"
    → syncMTAFunnelToOPS_() (MASTER_003_MTAFunnelSync.js, MTA_Master 기반 —
      2026-09-02부터 "터치 지표만" 관리, Revenue/Lead Priority는 제외됨)
  - "Revenue" / "Opportunity Won Date"
    → syncRevenueToOPS_()  (MASTER_011_RevenueSync.js, Deal Tracker
      외부시트 기반, Email 매칭 — 2026-09-02 신규. Revenue가 MTA_Master
      터치 기반으로만 동기화될 때 Search_OPS가 SAL과 동일한 "터치 없으면
      갱신 안 됨" 문제를 겪던 것을 해결)
  ==========================================================
  */
  SYNC_COLUMNS : [

    "IC Booked Date",
    "IC Completed Date",
    "Opportunity Won Date",
    "Revenue",
    "Sales Accepted Date",
    "#Touches"

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

    "#Touches",

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