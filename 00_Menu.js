/**
 * ==========================================================
 * Marketing 2.0
 * Custom Menu
 *
 * Version
 * v3.0.0
 *
 * Change Log
 * v3.0.0 (2026-07-21)
 * - Restored menuAppendNewLeads()/menuAppendNewMTA() wrapper functions
 *   (menu item onClick handlers — 누락되어 "Script function not found" 에러 발생).
 * - Restored createReportMenu() definition (호출은 계속 비활성 상태, 함수만 보존).
 * - Removed Rebuild menu items — Rebuild는 스크립트 편집기에서 직접 실행.
 * ==========================================================
 */

function onOpen() {

  createImportMenu();
  createBuildMenu();
  createQAMenu();
  // createReportMenu();  // Report Stage 미구현 — 항목 생기면 다시 활성화

}


/**
 * ==========================================================
 * Import Menu (Update)
 * ==========================================================
 */
function createImportMenu() {

  SpreadsheetApp.getUi()
    .createMenu("📥 Update")
    .addItem("Import Leads", "importLeadReport")
    .addItem("Import MTA", "importMTAReport")
    .addToUi();

}


/**
 * ==========================================================
 * Build Menu (Append)
 * ==========================================================
 */
function createBuildMenu() {

  SpreadsheetApp.getUi()
    .createMenu("🏗️ Append")
    .addItem("Append New Leads", "menuAppendNewLeads")
    .addItem("Append New MTA", "menuAppendNewMTA")
    .addToUi();

}


/**
 * ==========================================================
 * Menu Wrappers (Append)
 * ==========================================================
 */

function menuAppendNewLeads(){

  Logger.log(
    CONFIG.LOG.PREFIX +
    " Menu : Append New Leads"
  );

  appendNewLeads();

}


function menuAppendNewMTA(){

  Logger.log(
    CONFIG.LOG.PREFIX +
    " Menu : Append New MTA"
  );

  appendNewMTA();

}

/**
 * ==========================================================
 * QA Menu
 *
 * WHY
 * OPS, ACQ 등 여러 파이프라인의 QA를 한곳에 모아두는 메뉴.
 * 앞으로 다른 리포트 QA도 이 메뉴에 추가.
 * ==========================================================
 */
function createQAMenu() {

  SpreadsheetApp.getUi()
    .createMenu("✅ QA")
    .addItem("Run Leads_OPS QA", "runOPSQAManual")
    .addToUi();

}

/**
 * ==========================================================
 * Report Menu (미구현 — onOpen()에서 호출 비활성 상태)
 * ==========================================================
 */
function createReportMenu() {

  SpreadsheetApp.getUi()
    .createMenu("📊 Report")
    // 추후 구현
    //.addItem("Update Lead Report", "updateLeadReport")
    //.addItem("Update Conversion Report", "updateConversionReport")
    //.addSeparator()
    //.addItem("Update All Reports", "updateAllReports")
    .addToUi();

}