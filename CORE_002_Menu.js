/**
 * ==========================================================
 * Marketing 2.0
 * Custom Menu
 *
 * Version
 * v3.5.0
 *
 * Change Log
 * v3.5.0 (2026-08-26)
 * - "📥 Update" 메뉴에 "Import IC Funnel"(importICFunnelReport) 추가 —
 *   ICFunnel_Raw 재도입(`docs/OpenItems.md` #32, IC Booked/Complete 구조적
 *   과소집계 해결)의 일부.
 * v3.4.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `00_Menu.js` → 신규 `CORE_002_Menu.js`, 코드 내용 변경 없음.
 * v3.4.0 (2026-07-24)
 * - "🗂️ OPS" 메뉴 항목 라벨을 "Update X" → "🔄 Sync X"로 변경 (Events/BOFU/
 *   Search/Content 전부). 실제 호출 함수/래퍼는 그대로 유지.
 * v3.3.0 (2026-07-24)
 * - "🗂️ OPS" 메뉴에 "Update Search"(menuUpdateSearchOPS → buildSearchOPS())와
 *   "Update Content"(menuUpdateContentOPS → buildContentOPS()) 추가.
 * v3.2.0 (2026-07-24)
 * - "🗂️ OPS" 메뉴에 "Update BOFU"(menuUpdateBOFUOPS → buildBOFUOPS()) 추가.
 * v3.1.0 (2026-07-24)
 * - "✅ QA" 메뉴(createQAMenu()) 제거, "🗂️ OPS" 메뉴로 대체 (createOPSMenu()).
 *   Leads_OPS QA는 buildLeadsOPS() 실행 시 자동 수행이라 메뉴 실익 낮음 —
 *   메뉴 등록 래퍼만 제거, 실제 QA 로직(runOPSQAManual(), 24_OPSQA.js)은
 *   그대로 있어 스크립트 편집기에서 직접 실행 가능. 새 OPS 메뉴엔 "Update
 *   Events"(menuUpdateEventsOPS → buildEventsOPS()) 추가. Search/BOFU/Ebook
 *   트래커는 구현되는 대로 이 메뉴에 추가 예정.
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
  createOPSMenu();
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
    .addItem("Import IC Funnel", "importICFunnelReport")
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
 * OPS Menu (2026-07-24 — QA 메뉴 대체)
 *
 * WHY
 * Leads_OPS QA는 buildLeadsOPS() 실행 시 자동으로 돌아가서 별도
 * 메뉴 항목의 실익이 줄어듦. 대신 세그먼트별 OPS 트래커(Events,
 * 추후 Search/BOFU/Ebook 등)의 수동 빌드 진입점을 모아두는 메뉴로
 * 전환. Search/BOFU/Ebook은 아직 미구현이라 항목 자체를 추가하지
 * 않음 — 구현되는 대로 이 메뉴에 addItem() 추가.
 * ==========================================================
 */
function createOPSMenu() {

  SpreadsheetApp.getUi()
    .createMenu("🗂️ OPS")
    .addItem("🔄 Sync Events", "menuUpdateEventsOPS")
    .addItem("🔄 Sync BOFU", "menuUpdateBOFUOPS")
    .addItem("🔄 Sync Search", "menuUpdateSearchOPS")
    .addItem("🔄 Sync Content", "menuUpdateContentOPS")
    .addToUi();

}


/**
 * ==========================================================
 * Menu Wrappers (OPS)
 * ==========================================================
 */

function menuUpdateEventsOPS(){

  Logger.log(
    CONFIG.LOG.PREFIX +
    " Menu : Update Events"
  );

  buildEventsOPS();

}


function menuUpdateBOFUOPS(){

  Logger.log(
    CONFIG.LOG.PREFIX +
    " Menu : Update BOFU"
  );

  buildBOFUOPS();

}


function menuUpdateSearchOPS(){

  Logger.log(
    CONFIG.LOG.PREFIX +
    " Menu : Update Search"
  );

  buildSearchOPS();

}


function menuUpdateContentOPS(){

  Logger.log(
    CONFIG.LOG.PREFIX +
    " Menu : Update Content"
  );

  buildContentOPS();

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