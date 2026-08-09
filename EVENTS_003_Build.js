/**
 * ==========================================================
 * Marketing 2.0
 * Events Build
 *
 * Responsibility
 * Orchestrate Events_OPS Build Process (21_OPS_Build.js와 동일 패턴).
 *
 * Import 파이프라인의 백그라운드 트리거(08_PipelineAsync.js의
 * refreshOPSSheets_())가 매 Leads/MTA 백그라운드 실행마다 자동 호출함
 * (2026-08-05, docs/OpenItems.md #7 후속). "🗂️ Sync Events" 메뉴로 수동
 * 실행도 계속 가능.
 *
 * Version
 * v1.1.1
 *
 * Change Log
 * v1.1.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `52_Events_Build.js` → 신규 `EVENTS_003_Build.js`, 코드 내용 변경 없음.
 * v1.1.0 (2026-08-05)
 * - 자동 파이프라인 편입 반영 (08_PipelineAsync.js `refreshOPSSheets_()`) —
 *   2026-07-24 "초기 이관 기간엔 수동 전용" 결정이 사용자 요청으로 해제됨.
 *   함수 코드 자체는 변경 없음, 헤더 설명만 갱신.
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
