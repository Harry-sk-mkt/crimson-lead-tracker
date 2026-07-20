/**
 * ==========================================================
 * Marketing 2.0
 * Leads OPS Build
 *
 * Responsibility
 * Orchestrate Leads_OPS Build Process
 *
 * Version
 * v1.0
 * ==========================================================
 */

function buildLeadsOPS() {

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

    Logger.log(result === null);
    Logger.log(typeof result);
    Logger.log(Object.keys(result));
    //======================================
    // Write
    //======================================

    Logger.log(result);
    Logger.log(result.rows);
    Logger.log(Array.isArray(result.rows));
    Logger.log(result.rows.length);
    writeOPS(result.rows);

    //======================================
    // TODO
    // QA
    //======================================

    // writeOPSQA(result.qa);

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