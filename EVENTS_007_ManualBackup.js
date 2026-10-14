/**
 * ==========================================================
 * Marketing 2.0
 * Events Manual Backup & Guard
 *
 * Responsibility
 * Events_OPS의 Manual 컬럼(GROUP_1~3)을 build마다 숨김 시트
 * (EVENTS.SHEET.MANUAL_BACKUP)에 키 기준으로 백업하고, 다음 build 전에
 * "백업엔 값이 있는데 지금 시트에선 빈칸"인 셀이 많으면 build를 멈추고
 * 메일로 알린다. 백업에서 빈칸만 되살리는 복원 함수 포함.
 *
 * WHY
 * 2026-10-08 5:10~5:18 PM 사이 Event Date(300→4)·Time(72→0)이 build 밖에서
 * 지워졌고(5:10 build 로그는 정상 쓰기, 7:09 build는 이미 빈 값을 읽음),
 * 원인은 미확정(`docs/Changelog.md` 2026-10-12). build는 읽은 값을 그대로
 * 다시 쓰므로 한 번 지워지면 유실이 그대로 굳고, 복구는 버전 기록 전체
 * 복원뿐이었다(그 사이 다른 변경까지 되돌아감). 원인과 무관하게
 * (1) 다음 build가 유실을 굳히지 않게 멈추고 (2) 키 기준으로 빈칸만 복원.
 *
 * 수동 실행 함수
 * - runPreviewRestoreEventsManualFromBackup() : 복원 대상 미리보기
 * - runRestoreEventsManualFromBackup()        : 빈칸만 백업값으로 복원
 * - runAcceptEventsManualAsBackup()           : 일부러 지운 경우 — 지금
 *   시트 상태를 새 백업으로 확정(가드 해제)
 *
 * TEST: testFindLostManualCells()
 *
 * Version
 * v1.1.0
 *
 * Change Log
 * v1.1.0 (2026-10-14)
 * - `runAuthorizeMailApp()` 신규 — 가드 메일이 "MailApp.sendEmail 권한 없음"으로
 *   10-14 01:13~14:55 내내 발송 실패. 편집기에서 한 번 실행해 권한 승인 + 테스트 메일 1통.
 * v1.0.0 (2026-10-12)
 * - 최초 구현.
 * ==========================================================
 */


function eventsManualColumns_() {
  return EVENTS.GROUP_1_MANUAL
    .concat(EVENTS.GROUP_2_MANUAL)
    .concat(EVENTS.GROUP_3_MANUAL);
}


function isFilledValue_(v) {
  return v !== "" && v !== null && v !== undefined;
}


/**
 * ==========================================================
 * Find Lost Manual Cells (Pure)
 *
 * WHY
 * 개수 비교만으론 "한 칸 지우고 다른 칸 채움"을 못 잡고, 행 추가/삭제에도
 * 흔들림 → 키 단위로 "백업엔 값, 지금은 빈칸"인 셀만 센다. 지금 시트에
 * 없는 키(삭제된 행)는 대상 아님.
 *
 * @param {Array<Object>} liveRows    readEventsOPS_() 결과
 * @param {Array<Object>} backupRows  readEventsManualBackup_() 결과
 * @param {Array<string>} columns
 * @param {string} keyCol
 * @return {{counts: Object<string, number>, fills: Array<{key, col, value}>}}
 * ==========================================================
 */
function findLostManualCells_(liveRows, backupRows, columns, keyCol) {

  const backupByKey = {};

  backupRows.forEach(function (row) {
    const key = String(row[keyCol] || "").trim();
    if (key) backupByKey[key] = row;
  });

  const counts = {};
  columns.forEach(function (col) { counts[col] = 0; });

  const fills = [];

  liveRows.forEach(function (row) {

    const key = String(row[keyCol] || "").trim();
    const backup = key ? backupByKey[key] : null;

    if (!backup) return;

    columns.forEach(function (col) {
      if (!isFilledValue_(row[col]) && isFilledValue_(backup[col])) {
        counts[col]++;
        fills.push({ key: key, col: col, value: backup[col] });
      }
    });

  });

  return { counts: counts, fills: fills };

}


function readEventsManualBackup_() {

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EVENTS.SHEET.MANUAL_BACKUP);

  if (!sheet || sheet.getLastRow() < 2) return null;

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function (h) { return String(h).trim(); });

  return values.slice(1).map(function (r) {
    const obj = {};
    headers.forEach(function (h, c) { obj[h] = r[c]; });
    return obj;
  });

}


/**
 * @param {Array<Object>} rows  키 + Manual 컬럼을 가진 객체 배열
 */
function writeEventsManualBackup_(rows) {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(EVENTS.SHEET.MANUAL_BACKUP);

  if (!sheet) {
    sheet = ss.insertSheet(EVENTS.SHEET.MANUAL_BACKUP);
    sheet.hideSheet();
  }

  const header = [EVENTS.KEY].concat(eventsManualColumns_());

  const data = rows
    .filter(function (row) { return String(row[EVENTS.KEY] || "").trim(); })
    .map(function (row) {
      return header.map(function (h) {
        return isFilledValue_(row[h]) ? row[h] : "";
      });
    });

  sheet.clearContents();
  sheet.getRange(1, 1, data.length + 1, header.length).setValues([header].concat(data));

}


/**
 * build 결과(EVENTS.HEADER 순서 배열)를 객체로 바꿔 백업.
 */
function backupEventsManualFromBuildRows_(rows) {

  writeEventsManualBackup_(rows.map(function (r) {
    const obj = {};
    EVENTS.HEADER.forEach(function (h, c) { obj[h] = r[c]; });
    return obj;
  }));

}


/**
 * ==========================================================
 * Guard — build 전 유실 감지
 *
 * @param {Array<Object>} existing  readEventsOPS_() 결과
 * @return {boolean} true = build 진행 / false = 멈춤(알림 발송됨)
 * ==========================================================
 */
function guardEventsManualLoss_(existing) {

  const backup = readEventsManualBackup_();

  if (!backup) return true; // 첫 실행 — 백업 없음

  const result = findLostManualCells_(existing, backup, eventsManualColumns_(), EVENTS.KEY);

  const lostCols = Object.keys(result.counts).filter(function (col) {
    return result.counts[col] >= EVENTS.MANUAL_GUARD.MAX_LOST_CELLS;
  });

  if (lostCols.length === 0) return true;

  const summary = lostCols.map(function (col) {
    return col + " " + result.counts[col] + "칸";
  }).join(", ");

  const message =
    "Events_OPS Manual 컬럼 유실 감지 — " + summary + ".\n\n" +
    "Events_OPS build를 멈췄습니다(유실된 상태로 덮어쓰지 않음).\n" +
    "복원: Apps Script 편집기에서 runPreviewRestoreEventsManualFromBackup() 확인 후 " +
    "runRestoreEventsManualFromBackup() 실행.\n" +
    "일부러 지운 거라면: runAcceptEventsManualAsBackup() 실행.\n\n" +
    "감지 시각: " + new Date();

  Logger.log("⚠️ [Events_OPS Manual 가드] " + message);

  try {
    MailApp.sendEmail(
      Session.getEffectiveUser().getEmail(),
      "[Lead Tracker] Events_OPS 수동 입력값 유실 감지 — build 중단",
      message
    );
  } catch (mailError) {
    Logger.log("Manual 가드 메일 발송 실패(무시): " + mailError);
  }

  return false;

}


/**
 * ==========================================================
 * Restore (수동 실행)
 * ==========================================================
 */
function runPreviewRestoreEventsManualFromBackup() {
  restoreEventsManualFromBackup_(true);
}


function runRestoreEventsManualFromBackup() {

  if (currentPipelineLockValue_()) {
    Logger.log("⚠️ PIPELINE_LOCK이 잡혀 있어 중단 — 실행 중인 tail이 끝난 뒤 재실행.");
    return;
  }

  restoreEventsManualFromBackup_(false);

}


function restoreEventsManualFromBackup_(previewOnly) {

  const backup = readEventsManualBackup_();

  if (!backup) {
    Logger.log("백업 없음 — 복원 불가.");
    return;
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EVENTS.SHEET.OPS);
  const live = readEventsOPS_();
  const result = findLostManualCells_(live, backup, eventsManualColumns_(), EVENTS.KEY);

  Logger.log("[복원 대상] " + Object.keys(result.counts).map(function (col) {
    return col + " " + result.counts[col];
  }).join(" | "));

  if (previewOnly || result.fills.length === 0) {
    if (result.fills.length === 0) Logger.log("복원할 빈칸 없음.");
    return;
  }

  // 컬럼별로 모아 그 컬럼 데이터 범위만 한 번에 씀 — 다른 컬럼/수식 안 건드림
  const headers = sheet
    .getRange(EVENTS.ROWS.HEADER, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(function (h) { return String(h).trim(); });

  const rowIndexByKey = {};
  live.forEach(function (row, i) {
    const key = String(row[EVENTS.KEY] || "").trim();
    if (key) rowIndexByKey[key] = i;
  });

  const byCol = {};
  result.fills.forEach(function (f) {
    (byCol[f.col] = byCol[f.col] || []).push(f);
  });

  Object.keys(byCol).forEach(function (col) {

    const colIndex = headers.indexOf(col);
    if (colIndex === -1) return;

    const range = sheet.getRange(EVENTS.ROWS.DATA_START, colIndex + 1, live.length, 1);
    const values = range.getValues();

    byCol[col].forEach(function (f) {
      values[rowIndexByKey[f.key]][0] = f.value;
    });

    range.setValues(values);

  });

  Logger.log("✅ 백업에서 " + result.fills.length + "칸 복원 완료.");

}


/**
 * 일부러 지운 값이 가드에 걸릴 때 — 지금 Events_OPS 상태를 새 백업으로 확정.
 */
function runAcceptEventsManualAsBackup() {

  if (currentPipelineLockValue_()) {
    Logger.log("⚠️ PIPELINE_LOCK이 잡혀 있어 중단 — 실행 중인 tail이 끝난 뒤 재실행.");
    return;
  }

  const live = readEventsOPS_();
  writeEventsManualBackup_(live);
  Logger.log("✅ 현재 Events_OPS " + live.length + "행을 Manual 백업으로 확정.");

}


/**
 * ==========================================================
 * TEST — findLostManualCells_()
 * ==========================================================
 */
function testFindLostManualCells() {

  const backup = [
    { K: "a", Time: "10:00", PIC: "Kim" },
    { K: "b", Time: 0, PIC: "Lee" },        // Time 0(자정)도 값
    { K: "c", Time: "11:00", PIC: "" },     // 삭제된 행 — 대상 아님
    { K: "d", Time: "", PIC: "" }
  ];

  const live = [
    { K: "a", Time: "", PIC: "Kim" },       // Time 유실
    { K: "b", Time: "", PIC: "" },          // 둘 다 유실
    { K: "d", Time: "09:00", PIC: "" },     // 새로 채움 — 유실 아님
    { K: "e", Time: "", PIC: "" }           // 신규 행 — 백업 없음
  ];

  const r = findLostManualCells_(live, backup, ["Time", "PIC"], "K");

  const pass =
    r.counts.Time === 2 &&
    r.counts.PIC === 1 &&
    r.fills.length === 3 &&
    r.fills.some(function (f) { return f.key === "b" && f.col === "Time" && f.value === 0; });

  Logger.log("testFindLostManualCells: " + (pass ? "PASS" : "FAIL") + " " + JSON.stringify(r));

  return pass;

}


/**
 * ==========================================================
 * TEMP — MailApp 권한 승인 (편집기에서 1회 수동 실행)
 *
 * WHY (2026-10-14)
 * 트리거 실행은 새 권한(script.send_mail)을 스스로 승인받지 못해 가드 메일이
 * 계속 실패했다. 편집기에서 이 함수를 실행하면 승인 창이 뜨고, 승인 후 실행 계정
 * 주소로 테스트 메일 1통을 보낸다 — 이후 트리거의 가드 메일도 발송된다.
 * ==========================================================
 */
function runAuthorizeMailApp() {

  const to = Session.getEffectiveUser().getEmail();

  MailApp.sendEmail(
    to,
    "[Lead Tracker] 메일 권한 승인 테스트",
    "Events_OPS Manual 가드 알림 메일 권한이 승인됐습니다. 이 메일은 무시하셔도 됩니다."
  );

  Logger.log("✅ MailApp 권한 승인 완료 — 테스트 메일 발송: " + to);

}
