/**
 * ==========================================================
 * Marketing 2.0
 * Search Build
 *
 * Responsibility
 * Orchestrate Search_OPS Build Process (62_BOFU_Build.js와 동일 패턴).
 *
 * Import 파이프라인의 백그라운드 트리거(08_PipelineAsync.js의
 * refreshOPSSheets_())가 매 Leads/MTA 백그라운드 실행마다 자동 호출함
 * (2026-08-05, docs/OpenItems.md #7 후속). "🗂️ Sync Search" 메뉴로 수동
 * 실행도 계속 가능.
 *
 * Version
 * v1.2.0
 *
 * Change Log
 * v1.2.0 (2026-08-05)
 * - `readNaverSearchAdCampaignStatsCache_()`(AD_003_NaverSearch.js) 결과를
 *   `mergeSearchOPS_()`에 3번째 인자로 전달 — Campaign/Impressions/Link
 *   clicks 자동 매칭(사용자 요청). 상세: 73_Search_Merge.js 참고.
 * v1.1.0 (2026-08-05)
 * - 자동 파이프라인 편입 반영 (08_PipelineAsync.js `refreshOPSSheets_()`).
 *   함수 코드 자체는 변경 없음, 헤더 설명만 갱신.
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

    const naverStatsMap = readNaverSearchAdCampaignStatsCache_();

    //======================================
    // Merge
    //======================================

    const result = mergeSearchOPS_(existing, engineMap, naverStatsMap);

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
