/**
 * ==========================================================
 * Marketing 2.0
 * Configuration
 *
 * Responsibility
 * Central configuration for the entire project.
 *
 * Business logic MUST NOT exist here.
 * ==========================================================
 */

const CONFIG = {

  /**
   * Spreadsheet
   */
  SPREADSHEET: SpreadsheetApp.getActiveSpreadsheet(),

  /**
   * Sheet Names
   */
  SHEETS: {

    // Raw
    LEADS_RAW: "Leads_Raw",
    MTA_RAW: "MTA_Raw",

    // Master
    LEADS_MASTER: "Leads_Master",
    MTA_MASTER: "MTA_Master"

  },

  /**
   * IC Funnel Sync Source
   *
   * 별도 Lead 리포트(IC Booked/Completed/Won Date 중 하나라도 이번 주에
   * 해당하는 Lead, 주 단위 비중복 export)로부터 Leads_OPS의 Funnel 필드를 갱신.
   *
   * ⚠️ COLUMNS 값은 아직 실제 리포트 추출 전 추정치입니다.
   * 리포트를 실제로 뽑아본 뒤, 다른 이름이면 이 부분만 수정하면 됩니다
   * (코드 로직은 이 Config 값을 그대로 참조하므로 안 건드려도 됨).
   */
  IC_FUNNEL: {

    SHEET: "ICFunnel_Raw",

    COLUMNS: {

      LEAD_ID: "Lead ID",  // ✅ 확인됨

      IC_BOOKED_DATE: "IC Booked Date",                          // ⚠️ 추정치 — 확인 필요
      IC_COMPLETED_DATE: "IC Completed Date (Pre-Conversion)",   // ⚠️ 추정치 — 확인 필요
      OPPORTUNITY_WON_DATE: "Opportunity Won Date",              // ⚠️ 추정치 — 확인 필요
      REVENUE: "Won Opportunity's Amount (converted)"            // ⚠️ 추정치 — 확인 필요

    }

  },

  /**
     * Required Fields (Validation)
     *
     * 비어있으면 안 되는 컬럼 목록.
     * Import Type별로 관리.
     */
    REQUIRED_FIELDS: {

      LEADS: [
        "Lead ID",
        "Email",
        "Create Date",
        "Company / Account"
      ],

      MTA: [
        "Lead: Lead ID",
        "Lead: Email",
        "Multi Touch Attribution: Created Date"
      ],

      IC_FUNNEL: [
      "Lead ID"
      ]

  },

  /**
   * Raw Date Columns
   *
   * CSV 원본 텍스트 그대로 보존해야 하는 컬럼.
   * Raw 쓰기 시 Plain Text 서식 강제 대상.
   */
  RAW_DATE_COLUMNS: {

    LEADS: [
      "Create Date",
      "IC Booked Date",
      "IC Completed Date (Pre-Conversion)",
      "Opportunity Won Date"
    ],

    MTA: [
      "Multi Touch Attribution: Created Date",
      "Lead Created Date"
    ],

    IC_FUNNEL: [
      "IC Booked Date",
      "IC Completed Date (Pre-Conversion)",
      "Opportunity Won Date"
    ]

  },

  /**
   * Script Properties Keys
   *
   * Incremental Build가 "어디까지 처리했는지" 추적하는 데 사용.
   */
  PROPERTIES: {

    LEADS_LAST_ROW: "LEADS_LAST_PROCESSED_ROW",
    MTA_LAST_ROW: "MTA_LAST_PROCESSED_ROW"

  },

  /**
   * Row Definitions
   */
  ROWS: {

    HEADER: 1,
    DATA_START: 2

  },

  /**
   * Toast
   */
  TOAST: {

    TITLE: "Marketing 2.0",
    DURATION: 5

  },

  /**
   * Logging
   */
  LOG: {

    PREFIX: "[Marketing 2.0]"

  },

  /**
   * Date Format
   */
  DATE: {

    TIMEZONE: Session.getScriptTimeZone(),
    FORMAT: "yyyy-MM-dd"

  },
  
  /**
   * ACQ Report
   */
  ACQ: {

    SHEET: "ACQ_REP",
    SUMMARY_SHEET: "ACQ_Summary", 

    ROWS: {
      CONTROL_HEADER: 1,
      CONTROL_VALUE: 2,
      REPORT_HEADER: 4,
      REPORT_DATA_START: 5
    },

    COLUMNS: {
      START_FY: 1,      // A
      START_MONTH: 2,   // B
      END_FY: 3,        // C
      END_MONTH: 4,     // D
      GENERATE: 5       // E (checkbox)
    },

    ENGINE_START_COL: 15,  // O열

    SEGMENTS: [
      "Event Offline",
      "Event Online",
      "BOFU",
      "Search",
      "Content",
      "Referral",
      "Other"
    ],

    FISCAL_MONTH_ORDER: [
      "AUG", "SEP", "OCT", "NOV", "DEC",
      "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL"
    ]

  },

  /**
   * Validation Summary Display Exclude
   *
   * Import 완료 alert에 표시하지 않을 필드 목록.
   * (검증/서식 강제 로직 자체는 그대로 유지, 화면 표시만 제외)
   */
  VALIDATION_SUMMARY_EXCLUDE: {

    FIELDS: [
      "Company / Account"
    ],

    DATE_COLUMNS: [
      "IC Booked Date",
      "IC Completed Date (Pre-Conversion)",
      "Opportunity Won Date"
    ]

  }

};

