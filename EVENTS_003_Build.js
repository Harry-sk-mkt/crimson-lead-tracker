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
 * v1.2.0
 *
 * Change Log
 * v1.2.0 (2026-09-29)
 * - Manual 컬럼 채움 건수 로그 추가(`logEventsManualFillCounts_()`) — Event Date
 *   (09-29)/Time(#53, 09-17·09-29) 유실이 반복되는데, `writeEventsOPS_()`가 매
 *   build마다 `sheet.clear()`로 셀 수정 기록까지 지워 원인 추적이 불가했음. 매
 *   build마다 Manual 컬럼별 "읽은 시점 → 쓴 값" 채워진 셀 수를 남겨, 다음 유실 때
 *   build가 줄였는지(읽기>쓰기) / build 사이에 이미 줄어 있었는지(이전 쓰기>이번
 *   읽기)를 로그만으로 판별. 계산/출력 무변경.
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

    // 진단 로그 실패가 build를 막으면 안 됨
    try {
      logEventsManualFillCounts_(existing, result.rows);
    } catch (logError) {
      Logger.log("logEventsManualFillCounts_ 실패(무시): " + logError);
    }

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


/**
 * ==========================================================
 * Count Filled Columns (Pure)
 *
 * WHY
 * Manual 컬럼 유실 추적용(v1.2.0 Change Log 참고) — 컬럼별로 값이 비어있지
 * 않은 행 수를 센다. rows는 객체 배열(readEventsOPS_ 결과) 또는 header 순서
 * 배열(mergeEventsOPS_().rows) 둘 다 받음.
 *
 * @param {Array<Object>|Array<Array>} rows
 * @param {Array<string>} columns
 * @param {Array<string>} [header]  rows가 배열일 때 컬럼 위치 조회용
 * @return {Object<string, number>}
 * ==========================================================
 */
function countFilledColumns_(rows, columns, header) {

  const counts = {};

  columns.forEach(function (col) {

    const index = header ? header.indexOf(col) : -1;

    counts[col] = rows.filter(function (row) {
      const v = header ? row[index] : row[col];
      return v !== "" && v !== null && v !== undefined;
    }).length;

  });

  return counts;

}


/**
 * ==========================================================
 * Log Events Manual Fill Counts
 * ==========================================================
 */
function logEventsManualFillCounts_(existing, outputRows) {

  const columns = EVENTS.GROUP_1_MANUAL
    .concat(EVENTS.GROUP_2_MANUAL)
    .concat(EVENTS.GROUP_3_MANUAL);

  const before = countFilledColumns_(existing, columns);
  const after = countFilledColumns_(outputRows, columns, EVENTS.HEADER);

  Logger.log(
    "[Events_OPS Manual 채움 읽기→쓰기] " +
    columns.map(function (col) {
      return (after[col] < before[col] ? "⚠️ " : "") + col + " " + before[col] + "→" + after[col];
    }).join(" | ")
  );

}


/**
 * ==========================================================
 * TEST — countFilledColumns_()
 * ==========================================================
 */
function testCountFilledColumns() {

  const objects = [
    { "Event Date": new Date(2026, 9, 24), "Time": "" },
    { "Event Date": "", "Time": 0 },
    { "Event Date": null, "Time": undefined }
  ];

  const header = ["Key", "Event Date", "Time"];
  const arrays = [
    ["A", new Date(2026, 9, 24), "10:00"],
    ["B", "", ""]
  ];

  const a = countFilledColumns_(objects, ["Event Date", "Time"]);
  const b = countFilledColumns_(arrays, ["Event Date", "Time"], header);

  // Time 0(자정 등 숫자 0)은 값으로 인정
  const pass =
    a["Event Date"] === 1 && a["Time"] === 1 &&
    b["Event Date"] === 1 && b["Time"] === 1;

  Logger.log("testCountFilledColumns: " + (pass ? "PASS" : "FAIL") +
    " a=" + JSON.stringify(a) + " b=" + JSON.stringify(b));

}
