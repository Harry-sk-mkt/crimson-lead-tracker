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
 * v1.3.1
 *
 * Change Log
 * v1.3.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `72_Search_Build.js` → 신규 `SEARCH_003_Build.js`, 코드 내용 변경 없음.
 * v1.3.0 (2026-08-05)
 * - **Search_OPS "Spent" 자동화(사용자 요청)** — `readNaverSearchAdCampaignStatsCache_()`가
 *   돌려주는 spentKrw(원본)를 `fetchKrwToNzdRate_()`(AD_004_SpendCache.js,
 *   GOOGLEFINANCE 기반)로 구한 환율로 `convertNaverCampaignStatsSpendToNZD_()`
 *   (AD_003_NaverSearch.js)가 NZD 변환 후 `mergeSearchOPS_()`에 전달. 환율
 *   조회 실패(GOOGLEFINANCE 미계산 등) 시 전체 Build를 막지 않도록 try/catch로
 *   감싸고, 실패하면 Impressions/Link clicks만 자동 채우고 Spent는 이번
 *   실행에서 스킵(기존 값 유지) — Ad_Spend_Cache 갱신 실패 시에도 핵심
 *   파이프라인을 막지 않는 기존 방침(08_PipelineAsync.js)과 동일하게 처리.
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

    let naverStatsMap = readNaverSearchAdCampaignStatsCache_();

    try {
      const rate = fetchKrwToNzdRate_();
      naverStatsMap = convertNaverCampaignStatsSpendToNZD_(naverStatsMap, rate);
    } catch (fxError) {
      Logger.log(
        "⚠️ KRW→NZD 환율 조회 실패 — 이번 실행에서 Spent 자동 매칭 스킵" +
        "(Impressions/Link clicks는 정상 진행): " + fxError
      );
    }

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
