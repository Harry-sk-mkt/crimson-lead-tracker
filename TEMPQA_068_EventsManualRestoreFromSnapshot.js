/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — Events_OPS Time/Event Date 스냅샷 기준 키 복원 (2026-09-29)
 *
 * Responsibility
 * 09-17 3:58 PM 유실(#53) 이전 버전(09-17 1:55 PM)의 사본 파일에서 Events_OPS를
 * 읽어, 현재 Events_OPS와 **키(Lead Source Detail, build와 같은 정규화)** 기준으로
 * 맞춘다. build가 Event Date 순 정렬 + 이후 신규 행 추가라 행 위치 복사는 불가.
 * - Time : 현재 공란이고 스냅샷에 값이 있는 행만 채움(기존 값은 절대 안 덮음)
 * - Event Date : 현재값과 스냅샷값이 다른 행을 목록으로만 보여줌(자동 재채움
 *   값인지 이후 수동 수정인지 코드로 구분 불가 — 덮어쓰기는 사용자 결정)
 *
 * 쓰기는 runRestoreEventsTimeFromSnapshot()만, 채울 Time 셀만 개별 setValue.
 * 실행 전 README Pipeline Status가 RUNNING이 아닌지 확인(build의 clear+재작성과 겹치면 덮임).
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 복구 스크립트(TEMPQA 관례),
 * 미리보기(run...Preview)로 먼저 확인.
 *
 * Version
 * v1.1.0
 *
 * Change Log
 * v1.1.0 (2026-09-29)
 * - runSetEventsDatesFromSchedule() 추가 — 사용자 일정표 날짜로 Event Date 교정
 *   (`EVENTS_SCHEDULE_DATES`, 키 기준, 해당 셀만 setValue).
 * v1.0.0 (2026-09-29)
 * - 최초 구현.
 * ==========================================================
 */

// 09-17 1:55 PM 버전 사본 파일 ID (사용자 제공)
const EVENTS_RESTORE_SNAPSHOT_ID = "1_kopC4indv1jYUNinmYW6D_ymgB5IeNR5MKqppjl9lw";


function runPreviewEventsRestoreFromSnapshot() {
  planEventsRestoreFromSnapshot_(true);
}


function runRestoreEventsTimeFromSnapshot() {

  const plan = planEventsRestoreFromSnapshot_(false);

  if (plan.timeFills.length === 0) {
    Logger.log("채울 Time 없음 — 쓰기 생략.");
    return;
  }

  // 해당 셀만 개별 쓰기 — 소계 행 등 다른 셀(수식 포함)은 건드리지 않음
  plan.timeFills.forEach(function (f) {
    plan.sheet
      .getRange(EVENTS.ROWS.DATA_START + f.liveIndex, plan.timeCol + 1)
      .setValue(f.value);
  });

  Logger.log("✅ Time " + plan.timeFills.length + "건 복원 완료.");

}


// 사용자가 준 실제 일정표 날짜(09-29) — 9/17 유실 후 자동 재채움값으로 남은 행 교정용.
// 스크립트 타임존이 미 동부라 9-17 스냅샷의 KST 자정 값이 "전날 10~11시"로 보였음 — 4건은 스냅샷과 일치 확인.
const EVENTS_SCHEDULE_DATES = {
  "WB-2025-11-KOR-MOFU-Core The Differences Between Wharton and Stern": [2025, 12, 3],
  "WB-2025-10-KOR-MOFU-Core STEM Major Selection Strategy Master Class": [2025, 11, 12],
  "WB-2025-08-KOR-MOFU-Core The Difference Between a Stanford and Harvard Admit": [2025, 9, 10],
  "WB-2025-07-KOR-MOFU-Core EC for Each Year of High School.": [2025, 8, 23],
  "WB-2025-12-KOR-MOFU-Core How to Recover from Bad Grades and Still Get Into Top Colleges": [2026, 1, 3],
  "WB-2026-02-KOR-MOFU-Core Successful Korean Common App Showcases": [2026, 3, 11]
};


function runSetEventsDatesFromSchedule() {

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EVENTS.SHEET.OPS);
  const values = sheet.getDataRange().getValues();
  const headers = values[EVENTS.ROWS.HEADER - 1].map(function (h) { return String(h).trim(); });
  const keyCol = headers.indexOf(EVENTS.KEY);
  const dateCol = headers.indexOf("Event Date");
  let written = 0;

  values.slice(EVENTS.ROWS.DATA_START - 1).forEach(function (r, i) {
    const rawKey = String(r[keyCol] || "").trim();
    if (!rawKey) return;
    const key = applyEventsProgramKeyOverride_(stripLGSuffix_(stripRegistrationFormSuffix_(rawKey)));
    const ymd = EVENTS_SCHEDULE_DATES[key];
    if (!ymd) return;
    sheet.getRange(EVENTS.ROWS.DATA_START + i, dateCol + 1).setValue(new Date(ymd[0], ymd[1] - 1, ymd[2]));
    Logger.log("  " + key + " → " + ymd.join("-"));
    written++;
  });

  Logger.log("✅ Event Date " + written + "건 설정 (지정 " + Object.keys(EVENTS_SCHEDULE_DATES).length + "건).");

}


function planEventsRestoreFromSnapshot_(verbose) {

  if (!EVENTS_RESTORE_SNAPSHOT_ID) {
    throw new Error("EVENTS_RESTORE_SNAPSHOT_ID가 비어 있음 — 사본 파일 ID를 넣고 push 필요.");
  }

  function normalizedKey(row) {
    const rawKey = String(row[EVENTS.KEY] || "").trim();
    return rawKey
      ? applyEventsProgramKeyOverride_(stripLGSuffix_(stripRegistrationFormSuffix_(rawKey)))
      : "";
  }

  function isBlank(v) {
    return v === "" || v === null || v === undefined;
  }

  function show(v) {
    return v instanceof Date
      ? Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm")
      : String(v);
  }

  // 스냅샷
  const snapSheet = SpreadsheetApp.openById(EVENTS_RESTORE_SNAPSHOT_ID).getSheetByName(EVENTS.SHEET.OPS);
  const snapValues = snapSheet.getDataRange().getValues();
  const snapHeaders = snapValues[EVENTS.ROWS.HEADER - 1].map(function (h) { return String(h).trim(); });
  const snapByKey = {};

  snapValues.slice(EVENTS.ROWS.DATA_START - 1).forEach(function (r) {
    const obj = {};
    snapHeaders.forEach(function (h, c) { obj[h] = r[c]; });
    const key = normalizedKey(obj);
    if (key && !snapByKey[key]) snapByKey[key] = obj;
  });

  // 현재
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EVENTS.SHEET.OPS);
  const liveValues = sheet.getDataRange().getValues();
  const liveHeaders = liveValues[EVENTS.ROWS.HEADER - 1].map(function (h) { return String(h).trim(); });
  const timeCol = liveHeaders.indexOf("Time");
  const dateCol = liveHeaders.indexOf("Event Date");
  const liveRows = liveValues.slice(EVENTS.ROWS.DATA_START - 1);

  if (timeCol === -1 || dateCol === -1) {
    throw new Error("현재 Events_OPS 헤더에서 Time/Event Date를 못 찾음.");
  }

  const timeFills = [];
  const dateDiffs = [];
  let matched = 0;

  liveRows.forEach(function (r, i) {

    const obj = {};
    liveHeaders.forEach(function (h, c) { obj[h] = r[c]; });
    const key = normalizedKey(obj);
    const snap = key && snapByKey[key];
    if (!snap) return;
    matched++;

    if (isBlank(r[timeCol]) && !isBlank(snap["Time"])) {
      timeFills.push({ liveIndex: i, key: key, value: snap["Time"] });
    }

    const liveDate = r[dateCol];
    const snapDate = snap["Event Date"];
    if (!isBlank(snapDate) && show(liveDate) !== show(snapDate)) {
      dateDiffs.push(key + " : 현재 " + show(liveDate) + " / 9-17 " + show(snapDate));
    }

  });

  Logger.log("========== Events_OPS 스냅샷 복원 계획 ==========");
  Logger.log("스냅샷 키 " + Object.keys(snapByKey).length + " / 현재 행 " + liveRows.length + " / 키 매칭 " + matched);
  Logger.log("Time 채울 행(현재 공란 + 스냅샷 값 있음) : " + timeFills.length);
  if (verbose) {
    timeFills.forEach(function (f) { Logger.log("  " + f.key + " → " + show(f.value)); });
  }
  Logger.log("Event Date 현재≠9-17 행 : " + dateDiffs.length + " (쓰기 안 함, 확인용)");
  if (verbose) {
    dateDiffs.forEach(function (d) { Logger.log("  " + d); });
  }

  return {
    sheet: sheet,
    timeCol: timeCol,
    timeFills: timeFills
  };

}
