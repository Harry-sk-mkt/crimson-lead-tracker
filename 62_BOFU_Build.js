/**
 * ==========================================================
 * Marketing 2.0
 * BOFU Build
 *
 * Responsibility
 * Orchestrate BOFU_OPS Build Process (52_Events_Build.js와 동일 패턴).
 *
 * 자동 트리거 미연결 — Events와 동일하게 BOFU_Engine 갱신은 자동,
 * BOFU_OPS 전체 재작성은 스크립트 편집기에서 수동 실행.
 *
 * Version
 * v1.0.0
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
