/**
 * ==========================================================
 * Marketing 2.0
 * Leads OPS Merge
 *
 * Responsibility
 * Merge Leads_Master + Existing Leads_OPS (Email 기준)
 *
 * Version
 * v3.0.0
 *
 * Change Log
 * v3.0.0 (2026-07-21)
 * - 중복 이메일 처리 로직 변경: 기존엔 시트 순서상 "첫 번째로 만난 행"을 정상 merge
 *   했으나, Master가 Create Date 내림차순 정렬되어 있어 이게 사실상 "가장 최근" 레코드였음.
 * - 이제 이메일별로 그룹핑 후 실제 Create Date를 비교하여 "가장 오래된(True First Touch)"
 *   레코드만 남기고, 나머지는 duplicate로 분류 (Logger 로그에 Email/Lead ID/Create Date 기록).
 * - QA 시트는 여전히 미구현 (의도적 보류) — Logger 로그로만 확인 가능.
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

      summary.updated++;

    }

    else {

      OPS.MANUAL_COLUMNS.forEach(col => {

        row[col] = "";

      });

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