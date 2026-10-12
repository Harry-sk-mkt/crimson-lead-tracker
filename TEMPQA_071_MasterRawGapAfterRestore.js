/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — 버전 복원 후 Raw ↔ Master 누락 진단 (2026-10-12, 읽기 전용)
 *
 * Responsibility
 * 2026-10-12 오후 사용자가 메인 파일 전체를 10-07 버전으로 복원. Leads_Raw/
 * MTA_Raw는 외부 파일(CONFIG.RAW_EXTERNAL)이라 그대로지만 Leads_Master/
 * MTA_Master는 10-07로 되돌아감. 증분 체크포인트(PROPERTIES.LEADS_LAST_ROW/
 * MTA_LAST_ROW)는 PropertiesService라 복원 대상이 아님 → 10-08~10-12 오전에
 * Raw에 들어간 행이 "이미 처리됨"으로 남아 Master에 다시 안 들어갔을 수 있음.
 * Raw 끝부분의 Lead ID 중 Master에 없는 것을 세어 누락 여부와 Raw 행 범위를 본다.
 *
 * 쓰기 없음. runDiagnoseMasterRawGapAfterRestore()만 실행.
 *
 * TEST: 없음 — 1회성 읽기 전용 진단(TEMPQA 관례).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-10-12)
 * - 최초 구현.
 * ==========================================================
 */

const MASTER_RAW_GAP_TAIL_ROWS = 6000; // Raw 끝에서 검사할 행 수(10-08 이후 Import 분량보다 넉넉히)


function runDiagnoseMasterRawGapAfterRestore() {

  diagnoseMasterRawGap_(
    "LEADS",
    openLeadsRawExternalSpreadsheet_(),
    CONFIG.SHEETS.LEADS_RAW,
    CONFIG.SHEETS.LEADS_MASTER,
    CONFIG.PROPERTIES.LEADS_LAST_ROW,
    ["Lead ID"],
    ["Create Date"]
  );

  diagnoseMasterRawGap_(
    "MTA",
    openMTARawExternalSpreadsheet_(),
    CONFIG.SHEETS.MTA_RAW,
    CONFIG.SHEETS.MTA_MASTER,
    CONFIG.PROPERTIES.MTA_LAST_ROW,
    ["Lead: Lead ID", "Lead ID"],
    ["Multi Touch Attribution: Created Date"]
  );

}


function diagnoseMasterRawGap_(label, rawSS, rawName, masterName, propKey, idCols, dateCols) {

  const rawSheet = rawSS.getSheetByName(rawName);
  const masterSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(masterName);

  function headerOf(sheet) {
    return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(function (h) { return String(h).trim(); });
  }

  function firstIndex(header, names) {
    for (let i = 0; i < names.length; i++) {
      const idx = header.indexOf(names[i]);
      if (idx !== -1) return idx;
    }
    return -1;
  }

  const rawRows = rawSheet.getLastRow() - 1;
  const masterRows = masterSheet.getLastRow() - 1;
  const pointer = PropertiesService.getScriptProperties().getProperty(propKey);

  Logger.log("[" + label + "] Raw " + rawRows + "행 | Master " + masterRows + "행 | 체크포인트 " + pointer);

  const rawHeader = headerOf(rawSheet);
  const masterHeader = headerOf(masterSheet);
  const rawIdIdx = firstIndex(rawHeader, idCols);
  const rawDateIdx = firstIndex(rawHeader, dateCols);
  const masterIdIdx = firstIndex(masterHeader, idCols);

  if (rawIdIdx === -1 || masterIdIdx === -1) {
    Logger.log("[" + label + "] Lead ID 컬럼을 못 찾음 — Raw " + rawIdIdx + " / Master " + masterIdIdx + ". 중단.");
    return;
  }

  const masterIds = {};
  masterSheet.getRange(2, masterIdIdx + 1, masterRows, 1).getValues().forEach(function (r) {
    const id = String(r[0] || "").trim();
    if (id) masterIds[id] = true;
  });

  const startRow = Math.max(2, rawSheet.getLastRow() - MASTER_RAW_GAP_TAIL_ROWS + 1);
  const n = rawSheet.getLastRow() - startRow + 1;
  const ids = rawSheet.getRange(startRow, rawIdIdx + 1, n, 1).getValues();
  const dates = rawDateIdx === -1 ? null : rawSheet.getRange(startRow, rawDateIdx + 1, n, 1).getValues();

  const missingRows = [];
  const missingIds = {};
  ids.forEach(function (r, i) {
    const id = String(r[0] || "").trim();
    if (id && !masterIds[id]) {
      missingRows.push(i);
      missingIds[id] = true;
    }
  });

  if (missingRows.length === 0) {
    Logger.log("[" + label + "] Raw 마지막 " + n + "행의 Lead ID가 전부 Master에 있음 — 누락 없음.");
    return;
  }

  const first = missingRows[0];
  const last = missingRows[missingRows.length - 1];
  Logger.log(
    "[" + label + "] Master에 없는 Raw 행 " + missingRows.length + "개 (고유 Lead ID " + Object.keys(missingIds).length + "개) — Raw 시트 행 " +
    (startRow + first) + " ~ " + (startRow + last) +
    (dates ? " | 날짜 " + String(dates[first][0]) + " ~ " + String(dates[last][0]) : "")
  );

}
