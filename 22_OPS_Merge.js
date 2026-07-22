/**
 * ==========================================================
 * Marketing 2.0
 * Leads OPS Merge
 *
 * Responsibility
 * Merge Leads_Master + Existing Leads_OPS (Email 기준)
 *
 * Version
 * v3.1.0
 *
 * Change Log
 * v3.0.0 (2026-07-21)
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
  // 1) Email별 그룹핑 (빈 Email은 skip)
  //----------------------------------------

  const emailGroups = {};

  master.forEach(masterRow => {

    const email = String(
      masterRow[OPS.KEY] || ""
    ).trim().toLowerCase();

    if (!email) {

      summary.skipped++;

      return;

    }

    if (!emailGroups[email]) {
      emailGroups[email] = [];
    }

    emailGroups[email].push(masterRow);

  });

  //----------------------------------------
  // 2) 중복 그룹 해소 — Create Date가 가장 이른 레코드만 채택
  //----------------------------------------

  const resolvedRows = [];

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
        candidateDate instanceof Date &&
        !isNaN(candidateDate.getTime());

      const earliestValid =
        earliestDate instanceof Date &&
        !isNaN(earliestDate.getTime());

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

        summary.duplicate++;

        Logger.log(
          "[mergeOPS] Duplicate skipped — Email: " +
          email +
          " / Lead ID: " +
          candidate["Lead ID"] +
          " / Create Date: " +
          candidate["Create Date"] +
          "  (kept Lead ID: " +
          earliest["Lead ID"] +
          ", Create Date: " +
          earliest["Create Date"] +
          ")"
        );

      }

    });

    resolvedRows.push(earliest);

  });

  //----------------------------------------
  // 3) 최종 확정된 레코드만 기존 OPS와 Merge
  //----------------------------------------

  resolvedRows.forEach(masterRow => {

    const email = String(
      masterRow[OPS.KEY] || ""
    ).trim().toLowerCase();

    const existing = emailMap[email];

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

      summary.updated++;

    }

    else {

      OPS.MANUAL_COLUMNS.forEach(col => {

        row[col] = "";

      });

      OPS.SYNC_COLUMNS.forEach(col => {

        row[col] = "";

      });

      applyICRequestTracking_(row, null);

      summary.new++;

    }

    rows.push(

      OPS.HEADER.map(col => row[col])

    );

    summary.merged++;

  });

  return {

    rows,

    summary,

    qa: []      // TODO — 프로토타입 검증 후 구현 (의도적 보류)

  };

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

  let newCount = previousCount + (wasRequested ? 1 : 0);

  const icBookedDate = row["IC Booked Date"];
  const hasBookedDate = icBookedDate instanceof Date && !isNaN(icBookedDate.getTime());

  if (hasBookedDate && newCount < 1) {
    newCount = 1;
  }

  row[checkboxCol] = false;
  row[counterCol] = newCount;

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

  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {

    return [];

  }

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