/**
 * ==========================================================
 * Marketing 2.0
 * BOFU Build
 *
 * Responsibility
 * Orchestrate BOFU_OPS Build Process (52_Events_Build.js와 동일 패턴).
 *
 * Import 파이프라인의 백그라운드 트리거(08_PipelineAsync.js의
 * refreshOPSSheets_())가 매 Leads/MTA 백그라운드 실행마다 자동 호출함
 * (2026-08-05, docs/OpenItems.md #7 후속). "🗂️ Sync BOFU" 메뉴로 수동
 * 실행도 계속 가능.
 *
 * Version
 * v1.1.0
 *
 * Change Log
 * v1.1.0 (2026-08-05)
 * - 자동 파이프라인 편입 반영 (08_PipelineAsync.js `refreshOPSSheets_()`).
 *   함수 코드 자체는 변경 없음, 헤더 설명만 갱신.
 * ==========================================================
 */
function buildBOFUOPS() {

  const start = new Date();

  Logger.log("======================================");
  Logger.log("BOFU_OPS Build Started");
  Logger.log("======================================");

  try {

    //======================================
    // Read Source Data
    //======================================

    const existing = readBOFUOPS_();

    const engineMap = readBOFUEngineMap_();

    //======================================
    // Merge
    //======================================

    const result = mergeBOFUOPS_(existing, engineMap);

    //======================================
    // Write
    //======================================

    writeBOFUOPS_(result.rows);

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
