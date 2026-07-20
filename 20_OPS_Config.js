/**
 * ==========================================================
 * Marketing 2.0
 * Leads OPS Config
 *
 * Responsibility
 * Global configuration for Leads_OPS Build
 *
 * Version
 * v2.0
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

    "Business Segment",

    "IC Booked Date",

    "IC Completed Date",

    "Opportunity Won Date",

    "Revenue"

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

    "IC Requested",

    "Revenue Actual",

    "Notes"

  ],


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