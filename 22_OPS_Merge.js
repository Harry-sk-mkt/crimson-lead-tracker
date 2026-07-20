/**
 getHeaderMap()
readMaster()
readOPS()
createEmailMap()
duplicate detection
merge rows
summary
QA TODO
 */

/**
 * ==========================================================
 * Merge Master + Existing OPS
 * ==========================================================
 */

function mergeOPS(master, ops) {
  Logger.log("MERGE VERSION 2026");

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

  const duplicateEmails = new Set();

  master.forEach(masterRow => {

    const email = String(
      masterRow[OPS.KEY] || ""
    ).trim().toLowerCase();

    //----------------------------------------
    // Empty Email
    //----------------------------------------

    if (!email) {

      summary.skipped++;

      return;

    }

    //----------------------------------------
    // Duplicate in Master
    //----------------------------------------

    if (duplicateEmails.has(email)) {

      summary.duplicate++;

      // TODO
      // QA Sheet

      return;

    }

    duplicateEmails.add(email);

    //----------------------------------------
    // Existing OPS
    //----------------------------------------

    const existing = emailMap[email];

    const row = {};

    //----------------------------------------
    // Salesforce Columns
    //----------------------------------------

    OPS.SF_COLUMNS.forEach(col => {

      row[col] = masterRow[col];

    });

    //----------------------------------------
    // Manual Columns
    //----------------------------------------

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

    //----------------------------------------
    // Output Order
    //----------------------------------------

    rows.push(

      OPS.HEADER.map(col => row[col])

    );

    summary.merged++;

  });

  return {

    rows,

    summary,

    qa: []      // TODO

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