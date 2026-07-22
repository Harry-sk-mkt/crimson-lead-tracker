/**
 * ==========================================================
 * Marketing 2.0
 * Leads OPS Build
 *
 * Responsibility
 * Orchestrate Leads_OPS Build Process
 *
 * Version
 * v1.2.0
 *
 * Change Log
 * v1.1.0 (2026-07-21)
 * - Removed leftover debug Logger.log(result / result.rows / ...) calls.
 *   35,000+건 전체를 로그에 찍으려다 "Logging output too large" 발생 +
 *   불필요한 실행 시간 증가(디버그 로그 자체가 병목)의 원인이었음.
 * v1.2.0 (2026-07-22)
 * - skipQA 파라미터 추가. appendNewLeads()에서 자동 호출 시 QA(~77s)를
 *   생략해서 매 Import마다 추가되는 대기 시간을 줄이기 위함. 메뉴/편집기
 *   수동 실행 시에는 기존처럼 파라미터 없이 호출하면 QA 포함 전체 실행.
 * ==========================================================
 */

/**
 * @param {boolean} [skipQA=false]  true면 QA 단계 생략 (자동 트리거 전용)
 */
function buildLeadsOPS(skipQA) {

  const start = new Date();

  Logger.log("======================================");
  Logger.log("Leads_OPS Build Started");
  Logger.log("======================================");

  try {

    //======================================
    // Read Source Data
    //======================================

    const master = readMaster();

    const ops = readOPS();

    //======================================
    // Merge
    //======================================

    const result = mergeOPS(master, ops);

    //======================================
    // Write
    //======================================

    writeOPS(result.rows);

    //======================================
    // QA (2026-07-21 추가)
    //======================================

    if (skipQA) {

      Logger.log("QA skipped (skipQA=true, 자동 트리거 호출).");

    } else {

      runOPSQA_(ops, result.rows);

    }

    //======================================
    // Summary
    //======================================

    const seconds = (
      (new Date() - start) / 1000
    ).toFixed(2);

    Logger.log("");

    Logger.log("========== BUILD SUMMARY ==========");

    Logger.log(`Master Records : ${result.summary.master}`);

    Logger.log(`OPS Records    : ${result.summary.ops}`);

    Logger.log(`Merged         : ${result.summary.merged}`);

    Logger.log(`New            : ${result.summary.new}`);

    Logger.log(`Updated        : ${result.summary.updated}`);

    Logger.log(`Duplicate      : ${result.summary.duplicate}`);

    Logger.log(`Skipped        : ${result.summary.skipped}`);

    Logger.log(`Time           : ${seconds}s`);

    Logger.log("===================================");

  }

  catch(error){

    Logger.log("");

    Logger.log("========== BUILD FAILED ==========");

    Logger.log(error);

    Logger.log(error.stack);

    throw error;

  }

}