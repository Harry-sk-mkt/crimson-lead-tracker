/**
 * ==========================================================
 * Marketing 2.0
 * Content Build
 *
 * Responsibility
 * Orchestrate Content_OPS Build Process (62_BOFU_Build.js와 동일 패턴).
 *
 * Import 파이프라인의 백그라운드 트리거(08_PipelineAsync.js의
 * refreshOPSSheets_())가 매 Leads/MTA 백그라운드 실행마다 자동 호출함
 * (2026-08-05, docs/OpenItems.md #7 후속). "🗂️ Sync Content" 메뉴로 수동
 * 실행도 계속 가능.
 *
 * Version
 * v1.1.1
 *
 * Change Log
 * v1.1.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `82_Content_Build.js` → 신규 `CONTENT_003_Build.js`, 코드 내용 변경 없음.
 * v1.1.0 (2026-08-05)
 * - 자동 파이프라인 편입 반영 (08_PipelineAsync.js `refreshOPSSheets_()`).
 *   함수 코드 자체는 변경 없음, 헤더 설명만 갱신.
 * ==========================================================
 */
function buildContentOPS() {

  const start = new Date();

  Logger.log("======================================");
  Logger.log("Content_OPS Build Started");
  Logger.log("======================================");

  try {

    //======================================
    // Read Source Data
    //======================================

    const existing = readContentOPS_();

    const engineMap = readContentEngineMap_();

    //======================================
    // Merge
    //======================================

    const result = mergeContentOPS_(existing, engineMap);

    //======================================
    // Write
    //======================================

    writeContentOPS_(result.rows);

    //======================================
    // Summary
    //======================================

    const seconds = ((new Date() - start) / 1000).toFixed(2);

    Logger.log("");
    Logger.log("========== BUILD SUMMARY ==========");
    Logger.log("Engine Keys    : " + result.summary.engine);
    Logger.log("Existing Rows  : " + result.summary.existing);
    Logger.log("Merged         : " + result.summary.merged);
    Logger.log("New            : " + result.summary.new);
    Logger.log("Updated        : " + result.summary.updated);
    Logger.log("Time           : " + seconds + "s");
    Logger.log("===================================");

  } catch (error) {

    Logger.log("");
    Logger.log("========== BUILD FAILED ==========");
    Logger.log(error);
    Logger.log(error.stack);

    throw error;

  }

}
