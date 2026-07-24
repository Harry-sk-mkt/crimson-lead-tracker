/**
 * ==========================================================
 * Marketing 2.0
 * Search Build
 *
 * Responsibility
 * Orchestrate Search_OPS Build Process (62_BOFU_Build.js와 동일 패턴).
 *
 * 자동 트리거 미연결 — Search_Engine 갱신은 자동, Search_OPS 전체
 * 재작성은 스크립트 편집기에서 수동 실행.
 *
 * Version
 * v1.0.0
 * ==========================================================
 */
function buildSearchOPS() {

  const start = new Date();

  Logger.log("======================================");
  Logger.log("Search_OPS Build Started");
  Logger.log("======================================");

  try {

    //======================================
    // Read Source Data
    //======================================

    const existing = readSearchOPS_();

    const engineMap = readSearchEngineMap_();

    //======================================
    // Merge
    //======================================

    const result = mergeSearchOPS_(existing, engineMap);

    //======================================
    // Write
    //======================================

    writeSearchOPS_(result.rows);

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
