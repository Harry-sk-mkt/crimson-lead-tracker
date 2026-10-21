/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — ACQ_Summary FY26·FY27 월×세그먼트 덤프 (아이디에이션 문제 탐색용)
 *
 * Responsibility
 * 2026-10-21 아이디에이션 문제 탐색 — Digital Weekly 10-14에서 나온
 * "8월→9월 New P1 -119"가 어느 세그먼트(채널)에서 빠졌는지 쪼개기 위해,
 * ACQ_Summary의 FY26·FY27 행(FY/Month/Segment/New Leads/New P1 등)을
 * 탭 구분 로그로 찍는다. 비교 계산은 로그를 받아 로컬에서 한다.
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 덤프(TEMPQA 관례).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-10-21)
 * - 최초 구현.
 * ==========================================================
 */
function runDumpACQSummaryNewP1(){

  const sheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.ACQ.SUMMARY_SHEET);
  const values = sheet.getDataRange().getValues();
  const header = values[0];
  const fyIdx = header.indexOf("FY");

  const rows = values.slice(1).filter(function(r){
    return r[fyIdx] === "FY26" || r[fyIdx] === "FY27";
  });

  const lines = [header.join("\t")].concat(rows.map(function(r){ return r.join("\t"); }));

  Logger.log("ACQ_Summary FY26·FY27 rows : " + rows.length);
  Logger.log("\n" + lines.join("\n"));

}
