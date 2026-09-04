/**
 * ==========================================================
 * Marketing 2.0
 * Custom Menu
 *
 * Version
 * v3.7.0
 *
 * Change Log
 * v3.7.0 (2026-09-05, 사용자 요청)
 * - "📥 Update" 메뉴 라벨을 "📥 Import"로 환원(하위 항목은 이미 전부
 *   "Import X"라 라벨만 정정 — 함수/시그니처 변경 없음).
 * - **"🏗️ Append"/"🗂️ OPS" 메뉴 제거** — 둘 다 `importCsv()`/
 *   `refreshOPSSheets_()`(`MASTER_002_PipelineAsync.js`)를 통해 매 Import마다
 *   이미 자동 호출되는 단계라 수동 메뉴로 별도 노출할 실익이 없음을 확인
 *   (`importLeadReport()`/`importMTAReport()` → `importCsv()`가 내부에서
 *   `appendNewLeads(true)`/`appendNewMTA(true)` 호출, 파이프라인 tail의
 *   `refreshOPSSheets_()`가 `buildEventsOPS()`/`buildBOFUOPS()`/
 *   `buildSearchOPS()`/`buildContentOPS()` 전부 자동 호출) — 오히려 수동
 *   재실행이 파이프라인 실행 도중과 겹치면 혼동 소지. `createBuildMenu()`/
 *   `createOPSMenu()`와 그 메뉴 전용 wrapper(`menuAppendNewLeads()`/
 *   `menuAppendNewMTA()`/`menuUpdateEventsOPS()`/`menuUpdateBOFUOPS()`/
 *   `menuUpdateSearchOPS()`/`menuUpdateContentOPS()`) 삭제 — 다른 파일에서
 *   참조하는 곳 없음 확인(grep). 실제 로직 함수(`appendNewLeads()`/
 *   `appendNewMTA()`/`buildEventsOPS()` 등)는 그대로 있어 Apps Script
 *   편집기에서 직접 Run 가능, 파이프라인 자동 호출도 무관하게 계속 동작.
 * v3.6.0 (2026-09-02)
 * - "📥 Update" 메뉴에 "Import SAL Report"(importSALReport) 추가 — SAL을
 *   IC Funnel 리포트에서 분리해 전용 외부 시트로 이관(`docs/OpenItems.md`
 *   #38, `MASTER_010_SALSync.js`).
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
  // createReportMenu();  // Report Stage 미구현 — 항목 생기면 다시 활성화

}


/**
 * ==========================================================
 * Import Menu
 * ==========================================================
 */
function createImportMenu() {

  SpreadsheetApp.getUi()
    .createMenu("📥 Import")
    .addItem("Import Leads", "importLeadReport")
    .addItem("Import MTA", "importMTAReport")
    .addItem("Import IC Funnel", "importICFunnelReport")
    .addItem("Import SAL Report", "importSALReport")
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