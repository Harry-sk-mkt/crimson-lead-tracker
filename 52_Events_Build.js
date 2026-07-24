/**
 * ==========================================================
 * Marketing 2.0
 * Events Build
 *
 * Responsibility
 * Orchestrate Events_OPS Build Process (21_OPS_Build.js와 동일 패턴).
 *
 * 자동 트리거 미연결 — 초기 이관/롤아웃 기간에는 Apps Script 편집기에서
 * 수동 실행 전용 (Events_Engine 갱신은 refreshEventsEngine_()로 자동화
 * 돼 있지만, Events_OPS 전체 재작성은 별도 확인 후 수동 실행하기로 결정,
 * 2026-07-24). 데이터 안정화 후 자동화 여부는 별도 논의.
 *
 * Version
 * v1.0.0
 * ==========================================================
 */
function buildEventsOPS() {

  const start = new Date();

  Logger.log("======================================");
  Logger.log("Events_OPS Build Started");
  Logger.log("======================================");

  try {

    //======================================
    // Read Source Data
    //======================================

    const existing = readEventsOPS_();

    const engineMap = readEventsEngineMap_();

    //======================================
    // Merge
    //======================================

    const result = mergeEventsOPS_(existing, engineMap);

    //======================================
    // Write
    //======================================

    writeEventsOPS_(result.rows);

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
