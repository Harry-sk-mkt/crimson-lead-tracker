/**
 * ==========================================================
 * Marketing 2.0
 * Leads OPS Build
 *
 * Responsibility
 * Orchestrate Leads_OPS Build Process
 *
 * Version
 * v1.3.0
 *
 * Change Log
 * v1.3.0 (2026-09-16)
 * - **증분 병합 그림자 diff 추가(`docs/OpenItems.md` #50)** — `mergeOPS()`
 *   직후, `writeOPS()` 전에 `verifyIncrementalOpsShadowDiff_()`를 호출해 신규
 *   증분 경로(`OPS_004_Merge.js`의 `planIncrementalOpsMerge_()`/
 *   `computeIncrementalOpsMergePlan_()`)가 전체 재스캔 결과와 같은 값을
 *   내는지 매 Import마다 자동 검증(Logger 로그만, 시트 쓰기 없음). 독립
 *   try/catch로 격리 — 실패해도 실제 쓰기 경로는 무영향. 체크포인트
 *   `CONFIG.PROPERTIES.LEADS_OPS_MASTER_LAST_ROW` 신규.
 * v1.2.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `21_OPS_Build.js` → 신규 `OPS_003_Build.js`, 코드 내용 변경 없음.
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
    // Incremental Merge Shadow Diff (2026-09-16, docs/OpenItems.md #50)
    //
    // 전체 재스캔 경로는 그대로 쓰기를 담당하고, 증분 경로는 "이번에 계산
    // 했으면 같은 결과가 나왔을지"만 그림자로 검증(diff 로그만 남김,
    // 시트에 아무것도 쓰지 않음). writeOPS() 전에 호출해야 "쓰기 전" 기존
    // OPS 상태를 기준으로 비교 가능. 독립 try/catch로 격리 — 그림자
    // 검증이 실패해도 본 파이프라인(실제 쓰기)은 절대 영향받지 않는다.
    //======================================

    try {
      verifyIncrementalOpsShadowDiff_(result);
    } catch (shadowErr) {
      Logger.log(
        "buildLeadsOPS: 증분 그림자 diff 실패(비필수, 무시) — " +
        (shadowErr && shadowErr.message ? shadowErr.message : shadowErr)
      );
    }

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


/**
 * ==========================================================
 * Verify Incremental OPS Shadow Diff (2026-09-16, `docs/OpenItems.md` #50)
 *
 * WHY
 * `buildLeadsOPS()` 증분화 검증 단계 — 실제 쓰기는 여전히 전체 재스캔
 * 경로(`mergeOPS()`)가 담당하는 동안, 증분 경로(`planIncrementalOpsMerge_()`)가
 * "이번에 새로 들어온 Master 배치만 갖고 계산했으면 같은 결과가 나왔을지"를
 * 매 Import마다 자동으로 검증한다. 시트에는 아무것도 쓰지 않고 Logger에
 * 일치/불일치만 기록 — 여러 차례 실 Import에서 계속 일치함을 확인한 뒤에야
 * 쓰기 경로를 증분으로 전환하는 게 다음 단계(`[[feedback_pause_before_core_
 * merge_logic_change]]` 원칙에 따라 이 전환 자체도 별도 승인 필요).
 *
 * INPUT
 * fullMergeResult : { rows: Array<Array>, summary: Object }
 *   (mergeOPS()의 반환값 — writeOPS() 호출 *전*에 넘겨야 "쓰기 전" 기존
 *   OPS 상태를 기준으로 비교 가능)
 *
 * SIDE EFFECT
 * - Logger.log로 diff 결과 기록
 * - CONFIG.PROPERTIES.LEADS_OPS_MASTER_LAST_ROW 체크포인트 갱신
 * ==========================================================
 */
function verifyIncrementalOpsShadowDiff_(fullMergeResult){

  const checkpointKey = CONFIG.PROPERTIES.LEADS_OPS_MASTER_LAST_ROW;
  const props = PropertiesService.getScriptProperties();
  const lastProcessedCount = Number(props.getProperty(checkpointKey)) || 0;

  const currentMasterCount = getRawSheetDataRowCount_(OPS.SHEET.MASTER);

  const window = computeDictionaryRefreshWindow_(lastProcessedCount, currentMasterCount);

  if (window.needsFreshCounts) {

    Logger.log(
      "buildLeadsOPS 그림자 diff: Master 행 수 감소 또는 최초 실행(lastProcessedCount=" +
      lastProcessedCount + ", currentMasterCount=" + currentMasterCount +
      ") — 이번 회차는 diff 생략, 체크포인트만 " + currentMasterCount + "로 갱신."
    );

    props.setProperty(checkpointKey, String(currentMasterCount));
    return;

  }

  if (window.numRows === 0) {

    Logger.log("buildLeadsOPS 그림자 diff: 신규 Master 행 없음 — 생략.");
    props.setProperty(checkpointKey, String(currentMasterCount));
    return;

  }

  const newMasterRows = readRawSheetFrom_(OPS.SHEET.MASTER, lastProcessedCount);

  const incrementalPlan = computeIncrementalOpsMergePlan_(newMasterRows);

  if (!incrementalPlan) {

    Logger.log("buildLeadsOPS 그림자 diff: Leads_OPS가 비어있어 생략(최초 빌드).");
    props.setProperty(checkpointKey, String(currentMasterCount));
    return;

  }

  const emailCol = OPS.HEADER.indexOf(OPS.KEY);
  const fullResultByEmail = {};

  fullMergeResult.rows.forEach(function(rowArray){
    const email = String(rowArray[emailCol] || "").trim().toLowerCase();
    if (email) fullResultByEmail[email] = rowArray;
  });

  let matchCount = 0;
  let mismatchCount = 0;
  const mismatchSamples = [];

  function compareRow(email, incrementalRowObject){

    const fullRowArray = fullResultByEmail[email];

    if (!fullRowArray) {
      mismatchCount++;
      if (mismatchSamples.length < 5) {
        mismatchSamples.push({ email: email, reason: "전체 경로 결과에서 이메일을 찾을 수 없음" });
      }
      return;
    }

    let rowMatches = true;
    const diffFields = [];

    OPS.HEADER.forEach(function(col, c){

      const incrementalValue = incrementalRowObject[col];
      const fullValue = fullRowArray[c];

      const incrementalComparable = incrementalValue instanceof Date ? incrementalValue.getTime() : incrementalValue;
      const fullComparable = fullValue instanceof Date ? fullValue.getTime() : fullValue;

      if (String(incrementalComparable) !== String(fullComparable)) {
        rowMatches = false;
        diffFields.push(col);
      }

    });

    if (rowMatches) {
      matchCount++;
    } else {
      mismatchCount++;
      if (mismatchSamples.length < 5) {
        mismatchSamples.push({ email: email, diffFields: diffFields });
      }
    }

  }

  incrementalPlan.newRows.forEach(function(row){
    compareRow(String(row[OPS.KEY] || "").trim().toLowerCase(), row);
  });

  incrementalPlan.replaceRows.forEach(function(entry){
    compareRow(entry.email, entry.row);
  });

  Logger.log(
    "buildLeadsOPS 그림자 diff 결과 — 신규 Master 행: " + newMasterRows.length +
    ", 증분 계획(신규 " + incrementalPlan.summary.newCount +
    "/교체후보 " + incrementalPlan.summary.replaceCandidateCount +
    "/중복 " + incrementalPlan.summary.duplicateCount + "), " +
    "비교 대상 " + (matchCount + mismatchCount) + "건 중 일치 " + matchCount +
    "건 / 불일치 " + mismatchCount + "건" +
    (mismatchCount > 0 ? (" — 샘플: " + JSON.stringify(mismatchSamples)) : "")
  );

  props.setProperty(checkpointKey, String(currentMasterCount));

}