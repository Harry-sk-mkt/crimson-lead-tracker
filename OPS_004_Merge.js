/**
 * ==========================================================
 * Marketing 2.0
 * Leads OPS Merge
 *
 * Responsibility
 * Merge Leads_Master + Existing Leads_OPS (Email 기준)
 *
 * Version
 * v3.4.1
 *
 * Change Log
 * v3.4.1 (2026-09-17)
 * - 주석만 갱신 — `OPS_006_QA.js`의 `runOPSQA_()`가 `executeOPSQAChecks_()`로
 *   개명됨(pre-commit naming 훅 회피, docs/OpenItems.md #25 참고). 코드 변경 없음.
 * v3.4.0 (2026-09-16)
 * - **`buildLeadsOPS()` 증분화 1단계(`docs/OpenItems.md` #50, 그림자 모드
 *   — 실제 쓰기 경로는 아직 무변경)**: `mergeOPS()`의 "이메일 그룹 중복
 *   해소" + "최종 row 구성" 로직을 각각 `resolveEmailGroupEarliestWins_()`/
 *   `buildOpsRowFromMasterRow_()`(순수 함수)로 분리 — `mergeOPS()` 자체
 *   동작은 100% 동일(기존 테스트 `testMergeOPS_EarliestWins()` PASS 유지),
 *   신규 증분 경로가 동일 로직을 재사용하기 위한 리팩터. `applyICRequestTracking_()`의
 *   카운터 산술도 `computeICRequestCounterUpdate_()`로 분리(동일 이유,
 *   `testApplyICRequestTracking()` PASS 유지). 신규 `planIncrementalOpsMerge_()`
 *   (순수 함수 — 새 Master 배치만으로 신규/교체후보/중복 판정) +
 *   `computeIncrementalOpsMergePlan_()`(IO 래퍼 — Leads_OPS Email/Create
 *   Date 2개 컬럼만 targeted read해 인덱스 구성, 교체후보만 전체 행 read).
 *   `OPS_003_Build.js`의 `verifyIncrementalOpsShadowDiff_()`가 매 `buildLeadsOPS()`
 *   실행마다 이 증분 계획과 전체 재스캔 결과를 diff해 Logger에만 기록(시트
 *   쓰기 없음) — 여러 실 Import로 diff 일치를 확인한 뒤 쓰기 전환은 별도
 *   승인 필요(`[[feedback_pause_before_core_merge_logic_change]]`).
 *   신규 테스트: `testResolveEmailGroupEarliestWins()`/`testBuildOpsRowFromMasterRow()`/
 *   `testComputeICRequestCounterUpdate()`/`testPlanIncrementalOpsMerge()`.
 * v3.3.0 (2026-09-04)
 * - **청크 읽기 전환(성능/안전장치, docs/exec-plans/active/
 *   2026-09-03-performance-optimization.md #5)**: `sheetToObjects()`의
 *   `getDataRange().getValues()`(단일 호출) 대신 `getRangeValuesChunked_()`
 *   (UTIL_003_SheetChunkIO.js 신규)로 청크 단위 읽기 — 결과는 100% 동일,
 *   대용량(수만~수십만 행) 시트가 계속 커져도 Apps Script 6분 실행 제한/
 *   응답 크기 제한에 덜 취약해짐. **병합(mergeOPS()) 로직 자체는 무변경**
 *   (사용자 확정 — 이메일 중복 처리를 증분화하는 건 Leads_OPS 전체 리포트가
 *   참조하는 핵심 로직이라 별도 검증 없이는 범위 밖으로 유지).
 * v3.2.4 (2026-08-09)
 * - 중복 이메일 스킵할 때마다 찍던 `Logger.log("[mergeOPS] Duplicate
 *   skipped...")` 제거(사용자 요청 — 대량 중복 발생 시 실행 로그가 수백 줄로
 *   도배됨, 실측 739건). 카운트(`summary.duplicate`)는 그대로 유지되고
 *   `executeOPSQAChecks_()` BUILD SUMMARY에 총계로 이미 찍히므로 정보 손실 없음.
 * v3.2.3 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `22_OPS_Merge.js` → 신규 `OPS_004_Merge.js`, 코드 내용 변경 없음.
 * v3.2.2 (2026-07-29)
 * - compareByCreateDateBlankFirstOPS_() → compareByCreateDateBlankLastOPS_()
 *   로 교체 — 빈 Create Date를 최상단이 아닌 최하단으로(전체 OPS 통일,
 *   사용자 확정 — 73_Search_Merge.js 참고). 테스트도 이름/기대값 갱신.
 * v3.2.1 (2026-07-29)
 * - testCompareByCreateDateBlankFirstOPS_() → testCompareByCreateDateBlankFirstOPS()
 *   로 리네임(끝에 "_" 있으면 Apps Script Run 드롭다운에 안 보이는 문제,
 *   docs/apps-script-gotchas.md #2 — 같은 세션에서 두 번째로 반복한 실수).
 * v3.2.0 (2026-07-29)
 * - Leads_OPS 최종 행에 Create Date 기준 정렬 추가(compareByCreateDate
 *   BlankFirstOPS_) — 다른 OPS(BOFU/Events/Content/Search)는 전부 Start/
 *   Event Date로 이미 정렬 중이었는데 Leads_OPS만 없었음(사용자 확인).
 *   빈 날짜 최상단 + 나머지는 최신순(내림차순), 다른 OPS와 동일 스타일.
 *   신규 테스트: testCompareByCreateDateBlankFirstOPS().
 * v3.1.0 (2026-07-22)
 * - 중복 이메일 처리 로직 변경: 기존엔 시트 순서상 "첫 번째로 만난 행"을 정상 merge
 *   했으나, Master가 Create Date 내림차순 정렬되어 있어 이게 사실상 "가장 최근" 레코드였음.
 * - 이제 이메일별로 그룹핑 후 실제 Create Date를 비교하여 "가장 오래된(True First Touch)"
 *   레코드만 남기고, 나머지는 duplicate로 분류 (Logger 로그에 Email/Lead ID/Create Date 기록).
 * - QA 시트는 여전히 미구현 (의도적 보류) — Logger 로그로만 확인 가능.
 * v3.1.0 (2026-07-22)
 * - IC Request Tracking 추가 (applyICRequestTracking_()) — "IC Requested" 체크박스를
 *   더 이상 단순 보존(MANUAL_COLUMNS)하지 않고, 매 merge마다 이전 값이 true였으면
 *   "Total IC Requests"를 +1 하고 체크박스를 false로 리셋. 재신청 이력 보존 목적
 *   (docs/OperationsLayer.md 참고).
 * ==========================================================
 */

/**
 * ==========================================================
 * Merge Master + Existing OPS
 * ==========================================================
 *
 * WHY
 * Leads_Master는 Salesforce 원본을 그대로 반영하지만, 데이터 품질 이슈로
 * 같은 이메일이 여러 Lead ID로 중복 생성될 수 있다. Leads_OPS 이후의 모든
 * 다운스트림 레이어는 "1 Email = 1 First Touch"만 바라보므로, 중복 발생 시
 * 실제로 가장 먼저 생성된(Create Date가 이른) 레코드만 남겨야 한다.
 *
 * INPUT
 * master : Object[]  (Leads_Master 전체 레코드)
 * ops    : Object[]  (기존 Leads_OPS 레코드, 없으면 [])
 *
 * OUTPUT
 * { rows: Array<Array>, summary: Object, qa: Array }
 *
 * SIDE EFFECT
 * 없음 (순수 함수, 시트 쓰기는 하지 않음)
 */
function mergeOPS(master, ops) {

  Logger.log("MERGE VERSION 2026-07-21 (Earliest-wins dedup)");

  const emailMap = createEmailMap(ops);

  const rows = [];

  const summary = {

    master: master.length,

    ops: ops.length,

    merged: 0,

    updated: 0,

    new: 0,

    duplicate: 0,

    skipped: 0

  };

  //----------------------------------------
  // 1)+2) Email별 그룹핑 + 중복 해소(가장 이른 Create Date만 채택) —
  // resolveEmailGroupEarliestWins_()로 분리(2026-09-16, #50 증분화 —
  // 증분 경로와 동일 로직 공유 목적)
  //----------------------------------------

  const resolved = resolveEmailGroupEarliestWins_(master);

  summary.skipped = resolved.skippedCount;
  summary.duplicate = resolved.duplicateCount;

  //----------------------------------------
  // 3) 최종 확정된 레코드만 기존 OPS와 Merge — buildOpsRowFromMasterRow_()로
  // 분리(2026-09-16, 증분 경로와 동일 로직 공유 목적)
  //----------------------------------------

  const finalRowObjects = [];

  resolved.resolvedRows.forEach(masterRow => {

    const email = String(
      masterRow[OPS.KEY] || ""
    ).trim().toLowerCase();

    const existing = emailMap[email];

    const row = buildOpsRowFromMasterRow_(masterRow, existing);

    if (existing) {
      summary.updated++;
    } else {
      summary.new++;
    }

    finalRowObjects.push(row);

    summary.merged++;

  });

  finalRowObjects.sort(compareByCreateDateBlankLastOPS_);

  finalRowObjects.forEach(row => {

    rows.push(

      OPS.HEADER.map(col => row[col])

    );

  });

  return {

    rows,

    summary,

    qa: []      // TODO — 프로토타입 검증 후 구현 (의도적 보류)

  };

}


/**
 * ==========================================================
 * Resolve Email Group Earliest Wins (순수 함수, 2026-09-16 분리)
 *
 * WHY
 * `mergeOPS()`의 "이메일별 그룹핑 + 중복 해소(Create Date가 가장 이른
 * 레코드만 채택)" 로직을 분리 — 전체 재스캔 경로(`mergeOPS()`가 Master
 * 전체에 대해 호출)와 증분 경로(`planIncrementalOpsMerge_()`가 이번에
 * 새로 들어온 배치에 대해서만 호출)가 "그룹 내에서 어떤 레코드가 이기는지"
 * 판정 로직을 완전히 동일하게 공유하도록 하기 위함(`docs/OpenItems.md` #50 —
 * 두 경로가 결과적으로 일치해야 diff 검증이 의미 있음).
 *
 * INPUT
 * masterRows : Object[]  (Leads_Master 레코드 — 전체 또는 신규 배치만)
 *
 * OUTPUT
 * { resolvedRows: Object[], duplicateCount: number, skippedCount: number }
 *
 * TEST
 * testResolveEmailGroupEarliestWins() 참고
 * ==========================================================
 */
function resolveEmailGroupEarliestWins_(masterRows){

  const emailGroups = {};
  let skippedCount = 0;

  masterRows.forEach(masterRow => {

    const email = String(
      masterRow[OPS.KEY] || ""
    ).trim().toLowerCase();

    if (!email) {
      skippedCount++;
      return;
    }

    if (!emailGroups[email]) {
      emailGroups[email] = [];
    }

    emailGroups[email].push(masterRow);

  });

  const resolvedRows = [];
  let duplicateCount = 0;

  Object.keys(emailGroups).forEach(email => {

    const group = emailGroups[email];

    if (group.length === 1) {
      resolvedRows.push(group[0]);
      return;
    }

    let earliest = group[0];

    group.forEach(candidate => {

      const candidateDate = candidate["Create Date"];
      const earliestDate = earliest["Create Date"];

      const candidateValid =
        candidateDate instanceof Date && !isNaN(candidateDate.getTime());

      const earliestValid =
        earliestDate instanceof Date && !isNaN(earliestDate.getTime());

      if (
        candidateValid &&
        earliestValid &&
        candidateDate.getTime() < earliestDate.getTime()
      ) {
        earliest = candidate;
      }

    });

    group.forEach(candidate => {
      if (candidate !== earliest) {
        duplicateCount++;
      }
    });

    resolvedRows.push(earliest);

  });

  return { resolvedRows, duplicateCount, skippedCount };

}


/**
 * ==========================================================
 * TEST — resolveEmailGroupEarliestWins_()
 * ==========================================================
 */
function testResolveEmailGroupEarliestWins(){

  const rows = [
    { "Email": "test@example.com", "Lead ID": "L2", "Create Date": new Date(2026, 5, 15) },
    { "Email": "test@example.com", "Lead ID": "L1", "Create Date": new Date(2026, 5, 1) },
    { "Email": "test@example.com", "Lead ID": "L3", "Create Date": new Date(2026, 5, 20) },
    { "Email": "", "Lead ID": "blank" },
    { "Email": "solo@example.com", "Lead ID": "S1", "Create Date": new Date(2026, 5, 10) }
  ];

  const result = resolveEmailGroupEarliestWins_(rows);

  const pass =
    result.resolvedRows.length === 2 &&
    result.resolvedRows.some(r => r["Lead ID"] === "L1") &&
    result.resolvedRows.some(r => r["Lead ID"] === "S1") &&
    result.duplicateCount === 2 &&
    result.skippedCount === 1;

  Logger.log(
    "testResolveEmailGroupEarliestWins: " + (pass ? "PASS" : "FAIL") +
    " (" + JSON.stringify(result) + ")"
  );

}


/**
 * ==========================================================
 * Build OPS Row From Master Row (순수 함수, 2026-09-16 분리)
 *
 * WHY
 * `mergeOPS()`의 "최종 row 구성"(SF_COLUMNS는 masterRow에서, MANUAL/
 * SYNC_COLUMNS는 existing에서 보존 또는 신규면 공백, IC Request Tracking
 * 적용) 로직을 분리 — 전체 재스캔 경로와 증분 경로(신규 행 추가 + 기존 행
 * 교체 둘 다)가 동일하게 재사용(`docs/OpenItems.md` #50).
 *
 * INPUT
 * masterRow : Object  (SF_COLUMNS 소스 — 이 이메일의 "채택된" Master 레코드)
 * existing  : Object|undefined|null  (기존 OPS 레코드 — 없으면 신규 행)
 *
 * OUTPUT
 * Object  (OPS.HEADER의 모든 컬럼을 키로 갖는 완성된 row 객체)
 *
 * TEST
 * testBuildOpsRowFromMasterRow() 참고
 * ==========================================================
 */
function buildOpsRowFromMasterRow_(masterRow, existing){

  const row = {};

  OPS.SF_COLUMNS.forEach(col => {
    row[col] = masterRow[col];
  });

  if (existing) {

    OPS.MANUAL_COLUMNS.forEach(col => {
      row[col] = existing[col];
    });

    OPS.SYNC_COLUMNS.forEach(col => {
      row[col] = existing[col];
    });

    applyICRequestTracking_(row, existing);

  } else {

    OPS.MANUAL_COLUMNS.forEach(col => {
      row[col] = "";
    });

    OPS.SYNC_COLUMNS.forEach(col => {
      row[col] = "";
    });

    applyICRequestTracking_(row, null);

  }

  return row;

}


/**
 * ==========================================================
 * TEST — buildOpsRowFromMasterRow_()
 * ==========================================================
 */
function testBuildOpsRowFromMasterRow(){

  const masterRow = {
    "Lead ID": "L1", "Created FY": "FY26", "Create Date": new Date(2026, 5, 1),
    "Company / Account": "Acme", "Email": "test@example.com", "Phone": "",
    "School Name": "", "Lead Priority": "Priority 1", "First Touch Detail": "",
    "Business Segment": "Events"
  };

  // Case 1: 신규(existing 없음) — MANUAL/SYNC 공백, IC Request 초기화
  const newRow = buildOpsRowFromMasterRow_(masterRow, null);
  const newRowOk =
    newRow["Lead ID"] === "L1" &&
    newRow["Notes"] === "" &&
    newRow["Revenue"] === "" &&
    newRow["IC Requested"] === false &&
    newRow["Total IC Requests"] === 0;

  // Case 2: 기존 존재 — MANUAL/SYNC 보존
  const existing = {
    "Notes": "VIP", "Revenue": 5000, "IC Requested": false, "Total IC Requests": 2,
    "IC Booked Date": ""
  };
  const updatedRow = buildOpsRowFromMasterRow_(masterRow, existing);
  const updatedRowOk =
    updatedRow["Lead ID"] === "L1" &&
    updatedRow["Notes"] === "VIP" &&
    updatedRow["Revenue"] === 5000 &&
    updatedRow["Total IC Requests"] === 2;

  const pass = newRowOk && updatedRowOk;

  Logger.log(
    "testBuildOpsRowFromMasterRow: " + (pass ? "PASS" : "FAIL") +
    " (newRow=" + JSON.stringify(newRow) + ", updatedRow=" + JSON.stringify(updatedRow) + ")"
  );

}


/**
 * ==========================================================
 * Compare Rows By Create Date (빈 날짜 최하단, 나머지는 내림차순 — 2026-07-29)
 *
 * WHY
 * BOFU/Events/Content/Search_OPS는 전부 Start/Event Date 기준으로 이
 * 정렬 스타일을 이미 쓰고 있었는데 Leads_OPS만 정렬 로직이 없었음(사용자
 * 확인). 20_OPS_Config.js의 OPS.BUILD.SORT_BY/SORT_ASC는 어디서도 읽히지
 * 않는 죽은 설정이었음 — 실제 구현은 다른 OPS들과 동일한 "빈 날짜 최하단 +
 * 최신순" 스타일로 통일(사용자 확정, Leads_OPS는 "Start Date"가 없어
 * "Create Date" 사용). 최초 구현은 빈 날짜 최상단이었으나, Search_OPS에서
 * 신규 키 대거 유입으로 문제가 발견돼 전체 OPS를 최하단으로 통일 변경.
 *
 * TEST
 * testCompareByCreateDateBlankLastOPS 참고
 * ==========================================================
 */
function compareByCreateDateBlankLastOPS_(a, b) {

  const dateA = a["Create Date"];
  const dateB = b["Create Date"];

  const validA = dateA instanceof Date && !isNaN(dateA.getTime());
  const validB = dateB instanceof Date && !isNaN(dateB.getTime());

  if (!validA && !validB) return 0;
  if (!validA) return 1;
  if (!validB) return -1;

  return dateB.getTime() - dateA.getTime();

}


/**
 * ==========================================================
 * TEST — compareByCreateDateBlankLastOPS_()
 * ==========================================================
 */
function testCompareByCreateDateBlankLastOPS() {

  const rows = [
    { "Lead ID": "old", "Create Date": new Date(2026, 0, 1) },
    { "Lead ID": "blank1", "Create Date": "" },
    { "Lead ID": "new", "Create Date": new Date(2026, 5, 1) },
    { "Lead ID": "blank2", "Create Date": "" }
  ];

  rows.sort(compareByCreateDateBlankLastOPS_);

  const order = rows.map(r => r["Lead ID"]);

  const pass =
    order[0] === "new" && order[1] === "old" &&
    order[2] === "blank1" && order[3] === "blank2";

  Logger.log("Order: " + JSON.stringify(order));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Apply IC Request Tracking (재신청 이력 보존)
 *
 * WHY
 * "IC Requested" 체크박스 하나로는 같은 Lead가 여러 번 재신청해도
 * 최근 값으로 덮어씌워져 이력이 안 남는다. 매 sync(merge) 시점에
 * 이전 값이 true였으면 카운터를 +1하고 체크박스는 false로 리셋해서,
 * "총 몇 번 신청했는지"는 보존하면서 "지금 막 신청한 건인지"는
 * 매번 새로 판단할 수 있게 한다.
 *
 * 추가로, IC Booked Date가 있으면(=실제로 상담이 성사된 이력) 최소
 * 1회는 신청이 있었을 수밖에 없으므로 카운트 하한을 1로 보정한다.
 * 이 트래킹 도입 이전부터 이미 Booked였던 Lead들의 이력 백필과,
 * 앞으로 체크박스 없이(예: 세일즈가 직접 예약) Booked되는 예외
 * 케이스를 동시에 커버한다.
 *
 * INPUT
 * row : Object  (merge 중인 새 row, in-place 수정 — 호출 시점에
 *   OPS.SYNC_COLUMNS까지 이미 채워져 있어야 함, 즉 "IC Booked Date" 포함)
 * existing : Object|null  (기존 OPS 레코드, 신규 Lead면 null)
 *
 * SIDE EFFECT
 * row[OPS.IC_REQUEST.CHECKBOX], row[OPS.IC_REQUEST.COUNTER]를 채운다.
 *
 * TEST
 * existing.IC Requested === true, Total IC Requests === 2
 * → row.IC Requested === false, row.Total IC Requests === 3
 * existing.IC Requested === false, Total IC Requests === 0, row["IC Booked Date"] = Date
 * → row.Total IC Requests === 1 (하한 보정)
 * ==========================================================
 */
function applyICRequestTracking_(row, existing) {

  const checkboxCol = OPS.IC_REQUEST.CHECKBOX;
  const counterCol = OPS.IC_REQUEST.COUNTER;

  if (!existing) {

    row[checkboxCol] = false;
    row[counterCol] = 0;

    return;

  }

  const wasRequested = existing[checkboxCol] === true;
  const previousCount = Number(existing[counterCol]) || 0;

  const icBookedDate = row["IC Booked Date"];
  const hasBookedDate = icBookedDate instanceof Date && !isNaN(icBookedDate.getTime());

  const update = computeICRequestCounterUpdate_(wasRequested, previousCount, hasBookedDate);

  row[checkboxCol] = update.requested;
  row[counterCol] = update.count;

}


/**
 * ==========================================================
 * Compute IC Request Counter Update (순수 함수, 2026-09-16 분리)
 *
 * WHY
 * `applyICRequestTracking_()`의 카운터 산술만 분리 — 전체 재스캔 경로(매
 * row마다 호출)와 증분 경로 도입 후 신설될 "IC Requested 체크된 행만
 * 훑는 경량 스윕"(`docs/OpenItems.md` #50, `[[feedback_pause_before_core_
 * merge_logic_change]]` 논의에서 별도 스윕으로 분리 확정) 둘 다 동일한
 * 산술을 재사용하기 위함 — 두 경로가 결과적으로 같은 카운트를 내야 함.
 *
 * INPUT
 * wasRequested : boolean  (기존 "IC Requested" 체크박스 값)
 * previousCount : number  (기존 "Total IC Requests")
 * hasBookedDate : boolean (이 row의 "IC Booked Date"가 유효한 Date인지)
 *
 * OUTPUT
 * { requested: false, count: number }
 *
 * TEST
 * testComputeICRequestCounterUpdate() 참고
 * ==========================================================
 */
function computeICRequestCounterUpdate_(wasRequested, previousCount, hasBookedDate){

  let newCount = previousCount + (wasRequested ? 1 : 0);

  if (hasBookedDate && newCount < 1) {
    newCount = 1;
  }

  return { requested: false, count: newCount };

}


/**
 * ==========================================================
 * TEST — computeICRequestCounterUpdate_()
 * ==========================================================
 */
function testComputeICRequestCounterUpdate(){

  const wasChecked = computeICRequestCounterUpdate_(true, 2, false);
  const wasCheckedOk = wasChecked.requested === false && wasChecked.count === 3;

  const wasUnchecked = computeICRequestCounterUpdate_(false, 2, false);
  const wasUncheckedOk = wasUnchecked.requested === false && wasUnchecked.count === 2;

  const floorCorrection = computeICRequestCounterUpdate_(false, 0, true);
  const floorCorrectionOk = floorCorrection.requested === false && floorCorrection.count === 1;

  const floorNotNeeded = computeICRequestCounterUpdate_(false, 3, true);
  const floorNotNeededOk = floorNotNeeded.requested === false && floorNotNeeded.count === 3;

  const pass = wasCheckedOk && wasUncheckedOk && floorCorrectionOk && floorNotNeededOk;

  Logger.log(
    "testComputeICRequestCounterUpdate: " + (pass ? "PASS" : "FAIL") +
    " (wasChecked=" + JSON.stringify(wasChecked) +
    ", wasUnchecked=" + JSON.stringify(wasUnchecked) +
    ", floorCorrection=" + JSON.stringify(floorCorrection) +
    ", floorNotNeeded=" + JSON.stringify(floorNotNeeded) + ")"
  );

}


/**
 * ==========================================================
 * TEST — applyICRequestTracking_()
 * ==========================================================
 */
function testApplyICRequestTracking() {

  // Case 1: 기존에 체크되어 있었음 → 리셋 + 카운트 증가
  const row1 = { "IC Booked Date": "" };
  applyICRequestTracking_(row1, { "IC Requested": true, "Total IC Requests": 2 });

  // Case 2: 기존에 체크 안 되어 있었음 → 카운트 유지
  const row2 = { "IC Booked Date": "" };
  applyICRequestTracking_(row2, { "IC Requested": false, "Total IC Requests": 2 });

  // Case 3: 신규 Lead (existing 없음) → 전부 초기값
  const row3 = {};
  applyICRequestTracking_(row3, null);

  // Case 4: 트래킹 도입 이전부터 Booked였던 Lead (카운트 0인데 Booked Date 있음) → 하한 1로 보정
  const row4 = { "IC Booked Date": new Date(2026, 3, 1) };
  applyICRequestTracking_(row4, { "IC Requested": false, "Total IC Requests": 0 });

  // Case 5: 이미 카운트가 있는데 Booked Date도 있음 → 하한 보정으로 낮아지면 안 됨
  const row5 = { "IC Booked Date": new Date(2026, 3, 1) };
  applyICRequestTracking_(row5, { "IC Requested": false, "Total IC Requests": 3 });

  const pass =
    row1["IC Requested"] === false && row1["Total IC Requests"] === 3 &&
    row2["IC Requested"] === false && row2["Total IC Requests"] === 2 &&
    row3["IC Requested"] === false && row3["Total IC Requests"] === 0 &&
    row4["IC Requested"] === false && row4["Total IC Requests"] === 1 &&
    row5["IC Requested"] === false && row5["Total IC Requests"] === 3;

  Logger.log("Case 1 (was checked): " + JSON.stringify(row1) + " (expected IC Requested=false, Total=3)");
  Logger.log("Case 2 (was unchecked): " + JSON.stringify(row2) + " (expected IC Requested=false, Total=2)");
  Logger.log("Case 3 (new lead): " + JSON.stringify(row3) + " (expected IC Requested=false, Total=0)");
  Logger.log("Case 4 (pre-existing booked, count 0): " + JSON.stringify(row4) + " (expected IC Requested=false, Total=1)");
  Logger.log("Case 5 (already booked, count 3): " + JSON.stringify(row5) + " (expected IC Requested=false, Total=3)");
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * TEST — mergeOPS() 중복 해소 검증
 *
 * WHY
 * 같은 이메일 3건(Create Date 다름) 입력 시, 가장 이른 날짜의
 * Lead ID만 최종 rows에 남는지 확인.
 *
 * EXPECTED
 * rows.length === 1, summary.duplicate === 2
 * ==========================================================
 */
function testMergeOPS_EarliestWins(){

  const master = [

    {
      "Email": "test@example.com",
      "Lead ID": "L2",
      "Create Date": new Date(2026, 5, 15) // 6/15 (더 늦음)
    },

    {
      "Email": "test@example.com",
      "Lead ID": "L1",
      "Create Date": new Date(2026, 5, 1)  // 6/1 (가장 이름 — 남아야 함)
    },

    {
      "Email": "test@example.com",
      "Lead ID": "L3",
      "Create Date": new Date(2026, 5, 20) // 6/20 (더 늦음)
    }

  ];

  // OPS.SF_COLUMNS/HEADER는 실제 Config 기준이라 최소 구성으로 임시 오버라이드하지 않고
  // 실제 OPS 객체를 그대로 사용 (Lead ID, Create Date만 채워져도 undefined는 그냥 들어감)

  const result = mergeOPS(master, []);

  Logger.log("rows.length : " + result.rows.length + " (expected 1)");
  Logger.log("summary.duplicate : " + result.summary.duplicate + " (expected 2)");
  Logger.log("summary.merged : " + result.summary.merged + " (expected 1)");

  const pass =
    result.rows.length === 1 &&
    result.summary.duplicate === 2 &&
    result.summary.merged === 1;

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Plan Incremental OPS Merge (순수 함수, 2026-09-16 신규 — `docs/OpenItems.md` #50)
 *
 * WHY
 * `buildLeadsOPS()` 증분화의 핵심 판정 로직 — "이번에 새로 들어온 Master
 * 배치"만 갖고, 기존 Leads_OPS를 건드리지 않으면서 어떤 이메일이 (a) 완전
 * 신규 행으로 추가돼야 하는지, (b) 기존 행의 SF_COLUMNS를 교체해야 하는지
 * (기존보다 더 이른 Create Date 레코드가 이번 배치에 있는 경우), (c) 그냥
 * duplicate로 카운트만 하고 기존 행은 그대로 둬야 하는지를 가른다.
 *
 * 2026-09-16 설계 논의에서 확정된 원칙(사용자 결정):
 * - 전체 재스캔 경로(`mergeOPS()`)는 이 함수 도입 이후에도 당분간 그대로
 *   유지하며 실제 쓰기를 계속 담당 — 이 함수의 결과는 "그림자 모드"로
 *   병렬 계산돼 실제 쓰기 결과와 diff 검증만 하고, 여러 차례 실 Import로
 *   diff가 계속 일치함을 확인한 뒤에야 쓰기 경로를 이 함수로 전환한다.
 * - 정렬(Create Date 내림차순) 불변식은 이 함수/증분 경로에서 아예 다루지
 *   않음 — 신규 행은 그냥 끝에 추가되고, 정렬 복구는 별도의 하루 1회 전체
 *   재정렬 트리거가 담당(아직 미구현, 쓰기 전환 시점에 함께 구현 예정).
 *
 * INPUT
 * newMasterRows : Object[]  (이번에 새로 Leads_Master에 추가된 배치만 —
 *   전체 Master 아님)
 * existingIndex : Object  { [lowercase email]: { rowIndex: number,
 *   createDate: Date|"" } }  (현재 Leads_OPS의 Email→행번호+Create Date만
 *   담은 경량 인덱스 — 이 함수 자체는 시트를 읽지 않음, IO 래퍼가 준비)
 *
 * OUTPUT
 * {
 *   newRows: Object[]        (완성된 row 객체 — 그대로 추가하면 됨)
 *   replaceCandidates: [{ email, rowIndex, masterRow }]  (SF_COLUMNS 교체
 *     대상 — 최종 row 완성은 IO 래퍼가 기존 행 전체를 읽어온 뒤
 *     buildOpsRowFromMasterRow_()로 수행, 이 함수는 "교체해야 하는지"만
 *     판정)
 *   summary : { newCount, replaceCandidateCount, duplicateCount, skippedCount }
 * }
 *
 * TEST
 * testPlanIncrementalOpsMerge() 참고
 * ==========================================================
 */
function planIncrementalOpsMerge_(newMasterRows, existingIndex){

  const resolved = resolveEmailGroupEarliestWins_(newMasterRows);

  const newRows = [];
  const replaceCandidates = [];
  let duplicateCount = resolved.duplicateCount; // 배치 내부 중복(그룹 해소 과정)

  resolved.resolvedRows.forEach(masterRow => {

    const email = String(
      masterRow[OPS.KEY] || ""
    ).trim().toLowerCase();

    const existingEntry = existingIndex[email];

    if (!existingEntry) {

      newRows.push(buildOpsRowFromMasterRow_(masterRow, null));
      return;

    }

    const candidateDate = masterRow["Create Date"];
    const existingDate = existingEntry.createDate;

    const candidateValid =
      candidateDate instanceof Date && !isNaN(candidateDate.getTime());

    const existingValid =
      existingDate instanceof Date && !isNaN(existingDate.getTime());

    const shouldReplace =
      candidateValid && existingValid &&
      candidateDate.getTime() < existingDate.getTime();

    if (shouldReplace) {

      replaceCandidates.push({
        email: email,
        rowIndex: existingEntry.rowIndex,
        masterRow: masterRow
      });

    } else {

      // 기존 OPS 레코드가 이미 같거나 더 이른 Create Date를 갖고 있음 —
      // 배치 쪽 레코드는 duplicate로만 카운트, 기존 행은 건드리지 않음.
      duplicateCount++;

    }

  });

  return {
    newRows: newRows,
    replaceCandidates: replaceCandidates,
    summary: {
      newCount: newRows.length,
      replaceCandidateCount: replaceCandidates.length,
      duplicateCount: duplicateCount,
      skippedCount: resolved.skippedCount
    }
  };

}


/**
 * ==========================================================
 * TEST — planIncrementalOpsMerge_()
 * ==========================================================
 */
function testPlanIncrementalOpsMerge(){

  const newBatch = [
    // 완전 신규 이메일
    { "Email": "new@example.com", "Lead ID": "N1", "Create Date": new Date(2026, 5, 10) },

    // 기존 OPS(6/15)보다 더 이른 레코드 도착 — 교체 대상
    { "Email": "earlier@example.com", "Lead ID": "E1", "Create Date": new Date(2026, 5, 1) },

    // 기존 OPS(6/1)보다 늦은 레코드 도착 — duplicate, 기존 유지
    { "Email": "later@example.com", "Lead ID": "L1", "Create Date": new Date(2026, 5, 20) },

    // 같은 배치 내 중복(같은 이메일 2건, earlier wins) — 결과는 dupA(6/1)만 살아남고
    // 그 자체가 "existingIndex에 없음"이라 신규 행으로 추가됨
    { "Email": "dup@example.com", "Lead ID": "D2", "Create Date": new Date(2026, 5, 15) },
    { "Email": "dup@example.com", "Lead ID": "D1", "Create Date": new Date(2026, 5, 5) }
  ];

  const existingIndex = {
    "earlier@example.com": { rowIndex: 100, createDate: new Date(2026, 5, 15) },
    "later@example.com": { rowIndex: 200, createDate: new Date(2026, 5, 1) }
  };

  const result = planIncrementalOpsMerge_(newBatch, existingIndex);

  const pass =
    result.newRows.length === 2 && // new@ + dup@(승자 D1)
    result.newRows.some(r => r["Email"] === "new@example.com") &&
    result.newRows.some(r => r["Lead ID"] === "D1") &&
    result.replaceCandidates.length === 1 &&
    result.replaceCandidates[0].email === "earlier@example.com" &&
    result.replaceCandidates[0].rowIndex === 100 &&
    result.summary.duplicateCount === 2 && // later@ 1건 + dup@ 그룹 내부 1건
    result.summary.newCount === 2 &&
    result.summary.replaceCandidateCount === 1;

  Logger.log(
    "testPlanIncrementalOpsMerge: " + (pass ? "PASS" : "FAIL") +
    " (" + JSON.stringify(result) + ")"
  );

}


/**
 * ==========================================================
 * Compute Incremental OPS Merge Plan (IO 래퍼, 2026-09-16 — `docs/OpenItems.md` #50)
 *
 * WHY
 * `planIncrementalOpsMerge_()`(순수 함수)가 필요로 하는 "Leads_OPS의
 * Email→행번호+Create Date 경량 인덱스"를 준비하고, `replaceCandidates`로
 * 판정된 항목은 그 행 전체를 targeted read해 `buildOpsRowFromMasterRow_()`로
 * 최종 row까지 완성한다. Email/Create Date 2개 컬럼만 전체 스캔하고(전체
 * ~26개 컬럼이 아님), 실제 행 전체 읽기는 교체 후보(보통 0~소수 건)에만
 * 한정 — 이게 이 증분 경로가 전체 재스캔(`readOPS()` 전체 시트 읽기)보다
 * 가벼운 핵심 이유.
 *
 * INPUT
 * newMasterRows : Object[]  (이번에 새로 Leads_Master에 추가된 배치)
 *
 * OUTPUT
 * { newRows: Object[], replaceRows: [{rowIndex, email, row}], summary: Object }
 * | null  (Leads_OPS가 비어있으면 — 호출부가 전체 경로로 폴백해야 함)
 * ==========================================================
 */
function computeIncrementalOpsMergePlan_(newMasterRows){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const opsSheet = ss.getSheetByName(OPS.SHEET.OPS);

  if (!opsSheet || opsSheet.getLastRow() < OPS.ROWS.DATA_START) {
    return null;
  }

  const headerMap = getHeaderMap(opsSheet);
  const emailCol = headerMap[OPS.KEY];
  const createDateCol = headerMap["Create Date"];

  if (emailCol === undefined || createDateCol === undefined) {
    throw new Error("Email/Create Date column not found in " + OPS.SHEET.OPS);
  }

  const numRows = opsSheet.getLastRow() - OPS.ROWS.DATA_START + 1;

  const emailValues = opsSheet
    .getRange(OPS.ROWS.DATA_START, emailCol + 1, numRows, 1)
    .getValues();

  const createDateValues = opsSheet
    .getRange(OPS.ROWS.DATA_START, createDateCol + 1, numRows, 1)
    .getValues();

  const existingIndex = {};

  emailValues.forEach(function(row, i){

    const email = String(row[0] || "").trim().toLowerCase();

    if (!email || existingIndex[email]) return; // 첫 번째로 만난 행만(정상 상태면 중복 없음)

    existingIndex[email] = {
      rowIndex: OPS.ROWS.DATA_START + i,
      createDate: createDateValues[i][0]
    };

  });

  const plan = planIncrementalOpsMerge_(newMasterRows, existingIndex);

  const replaceRows = plan.replaceCandidates.map(function(candidate){

    const existingRowValues = opsSheet
      .getRange(candidate.rowIndex, 1, 1, OPS.HEADER.length)
      .getValues()[0];

    const existingRowObject = {};

    OPS.HEADER.forEach(function(col, c){
      existingRowObject[col] = existingRowValues[c];
    });

    return {
      rowIndex: candidate.rowIndex,
      email: candidate.email,
      row: buildOpsRowFromMasterRow_(candidate.masterRow, existingRowObject)
    };

  });

  return {
    newRows: plan.newRows,
    replaceRows: replaceRows,
    summary: plan.summary
  };

}


/**
 * ==========================================================
 * Create Email Lookup Map
 * ==========================================================
 */
function createEmailMap(rows) {

  const map = {};

  rows.forEach(row => {

    const email = String(
      row[OPS.KEY] || ""
    ).trim().toLowerCase();

    if (!email) return;

    if (!map[email]) {

      map[email] = row;

    }

  });

  return map;

}


/**
 * ==========================================================
 * Read Leads_Master
 * ==========================================================
 */
function readMaster() {

  const ss = SpreadsheetApp.getActive();

  const sheet = ss.getSheetByName(
    OPS.SHEET.MASTER
  );

  if (!sheet) {

    throw new Error(
      `${OPS.SHEET.MASTER} sheet not found`
    );

  }

  return sheetToObjects(sheet);

}


/**
 * ==========================================================
 * Read Existing Leads_OPS
 * ==========================================================
 */
function readOPS() {

  const ss = SpreadsheetApp.getActive();

  const sheet = ss.getSheetByName(
    OPS.SHEET.OPS
  );

  if (!sheet) {

    return [];

  }

  if (sheet.getLastRow() <= 1) {

    return [];

  }

  return sheetToObjects(sheet);

}


/**
 * ==========================================================
 * Convert Sheet -> Object Array
 * ==========================================================
 */
function sheetToObjects(sheet) {

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow <= 1 || lastCol === 0) {

    return [];

  }

  // 2026-09-04 — 청크 단위 읽기(UTIL_003_SheetChunkIO.js)로 교체, 결과는
  // getDataRange().getValues()와 100% 동일(exec-plan #5, 대용량 대비 안전장치).
  const values = getRangeValuesChunked_(sheet, 1, 1, lastRow, lastCol);

  const headers = values[0];

  const objects = [];

  for (let r = 1; r < values.length; r++) {

    const obj = {};

    headers.forEach((header, c) => {

      obj[String(header).trim()] = values[r][c];

    });

    objects.push(obj);

  }

  return objects;

}


/**
 * ==========================================================
 * Header Map
 * ==========================================================
 */
function getHeaderMap(sheet) {

  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0];

  const map = {};

  headers.forEach((header, index) => {

    map[String(header).trim()] = index;

  });

  return map;

}