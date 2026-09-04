/**
 * ==========================================================
 * Marketing 2.0
 * Leads OPS Config
 *
 * Responsibility
 * Global configuration for Leads_OPS Build
 *
 * Version
 * v2.9
 *
 * Change Log
 * v2.9 (2026-09-04)
 * - **`P1_SCHOOL_MISMATCH.MISSING_SCHOOL_TRACKING` 신규**(`docs/OpenItems.md`
 *   #48 후속 요청, 역방향 체크) — 2026-09-04 이후 신규 리드 중 effective
 *   Priority가 P1인데 School Name이 P1 School List에 없는 경우를 학교
 *   단위로 집계, 항상 숨김 탭("Not_Striked")에 기록. `OPS_007_P1SchoolMismatch.js`가
 *   소비.
 * v2.8 (2026-09-04)
 * - **`P1_SCHOOL_MISMATCH` 신규**(`docs/OpenItems.md` #48) — 외부 "P1 School
 *   List" 스프레드시트 위치/컬럼 구조(EXTERNAL) + 결과 기록 대상 시트
 *   (OUTPUT_SHEET). `OPS_007_P1SchoolMismatch.js`가 소비.
 * v2.7 (2026-09-03)
 * - **"SAL Segment" 신규 컬럼**(HEADER + SYNC_COLUMNS) — ACQ_REP은 코호트가
 *   아니라 이벤트 기준 리포트라, SAL도 Lead 생성 시점 First Touch로 고정된
 *   기존 "Business Segment"를 재사용하지 않고 SAL 이벤트 자체의 터치
 *   (Last MKT UTM Campaign/Last Touch Detail)로 별도 분류해야 한다는 설계
 *   확정(대화 중 확인) — `syncSALToOPS_()`(`MASTER_010_SALSync.js` v1.2.0)가
 *   소유. "Sales Accepted Date" 바로 뒤에 배치.
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
  - "Sales Accepted Date" / "SAL Segment"
    → syncSALToOPS_()  (MASTER_010_SALSync.js, SAL_Raw 전용 외부시트 기반 —
      2026-09-02부터 IC Funnel에서 분리, docs/OpenItems.md #38. "SAL Segment"는
      2026-09-03 신규 — 기존 "Business Segment"(First Touch 고정값)와 별개로,
      SAL 이벤트 자체의 터치(Last MKT UTM Campaign/Last Touch Detail)로
      독립 분류한 값)
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
    "SAL Segment",
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
    "SAL Segment",

    "IC Booked Date",

    "IC Completed Date",

    "Opportunity Won Date",

    "Revenue",

    "Revenue Actual",

    "Notes"

  ],

  /*
  ==========================================================
  P1 SCHOOL MISMATCH (2026-09-04 신규, docs/OpenItems.md #48)

  외부 "P1 School List" 스프레드시트(사용자가 관리, 담당팀이 P1으로 확정한
  학교 목록)와 Leads_OPS를 대조해, 리스트엔 P1 학교로 등록돼 있는데
  Leads_OPS 상 effective Priority(Priority Override 우선, 없으면 Lead
  Priority — ACQREP_001_Report.js의 isEffectiveP1_() 재사용)가 "Priority 1"이
  아닌 리드를 검출한다. OPS_007_P1SchoolMismatch.js 참고.
  ==========================================================
  */

  P1_SCHOOL_MISMATCH : {

    EXTERNAL : {
      // 2026-09-04 사용자 공유 —
      // https://docs.google.com/spreadsheets/d/15OVBIzK40s7a2mOCPDs9mrINpS9MUFrUse02KtQqW4Q
      SPREADSHEET_ID : "15OVBIzK40s7a2mOCPDs9mrINpS9MUFrUse02KtQqW4Q",

      TAB_NAME : "P1 School List",

      // 실제 데이터는 4행부터 시작(1~3행은 헤더/안내, 사용자 확인)
      DATA_START_ROW : 4,

      // E열 — 대표 학교명(사용자 확인)
      SCHOOL_COLUMN : 5,

      // N열부터 — 같은 학교의 오기입/변형 표기(사용자 확인: "시스템적으로
      // 사용자가 오기입해서 다른 학교로 분류되는 학교들", 행마다 개수가
      // 다를 수 있어 이 열부터 끝까지 비어있지 않은 셀을 전부 별칭으로 포함)
      ALIAS_START_COLUMN : 14

    },

    // 결과 기록 시트(Leads_OPS_QA와 별개 — runOPSQA_()는 buildLeadsOPS(true)로
    // 매 Import마다 스킵되므로(skipQA), 이 체크는 항상 도는 독립 파이프라인
    // 단계로 별도 시트에 씀. 사용자 확인 후 직접 열어보는 용도라 숨기지 않음)
    OUTPUT_SHEET : "P1_School_Mismatch_QA",

    /*
    ==========================================================
    MISSING SCHOOL TRACKING (역방향 체크, 2026-09-04 신규)

    위와 반대 방향 — Leads_OPS 상 effective Priority가 이미 P1인데 School
    Name이 외부 P1 School List(별칭 포함)에 없는 경우를 검출. "오늘부터
    새로 들어오는 리드"만 대상(사용자 확정) — 오래 누적된 과거 리드 전체에
    적용하면 아직 리스트에 반영 안 된 정상적인 과거 케이스가 너무 많아
    노이즈가 커짐. School 단위로 집계(사용자 확정, 리드 단위 아님) — "이
    학교를 P1 School List에 추가해야 하는지" 판단 용도.
    ==========================================================
    */
    MISSING_SCHOOL_TRACKING : {

      // 이 날짜(포함) 이후 Create Date인 리드만 대상 — 2026-09-04(이 기능
      // 도입일) 사용자 확정 "오늘부터"
      START_DATE : new Date(2026, 8, 4),

      // Leads_OPS_QA/P1_School_Mismatch_QA와 달리 항상 숨김(사용자 확정)
      OUTPUT_SHEET : "Not_Striked"

    }

  },

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