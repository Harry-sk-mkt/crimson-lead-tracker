/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — Events_OPS 웨비나 실적 덤프 (웨비나 캘린더 Revenue 출처용)
 *
 * Responsibility
 * 학년별 웨비나 캘린더 초안(crimson 루트 작업, 2026-10-16)의 Revenue를
 * `12 Month Marketing Execution Plan SK.xlsx` Var 탭 대신 Events_OPS
 * Revenue(Deal Tracker 기준)로 채우기로 함(사용자 결정) — Var 탭은 딜이 있는
 * 웨비나 165건 중 103건의 Revenue가 비어 있었음. Events_OPS 웨비나 행을
 * 탭 구분 텍스트로 로그에 찍어 사용자가 붙여넣게 한다.
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례). Drive 쓰기는 새 OAuth
 * 범위가 필요해 설치형 트리거 재인증 위험이 있어 쓰지 않음.
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 덤프(TEMPQA 관례).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-10-16)
 * - 최초 구현.
 * ==========================================================
 */
function runDumpEventsOPSWebinarRevenue(){

  const COLS = ["Lead Source Detail", "Marketo Campaign name", "EventType", "Event Date", "SF NLP1s", "#Deals", "Revenue"];

  const rows = readEventsOPS_().filter(function(r){
    return String(r["EventType"] || "").trim() === "Webinar";
  });

  const lines = [COLS.join("\t")];

  rows.forEach(function(r){
    lines.push(COLS.map(function(c){
      const v = r[c];
      if(v instanceof Date) return Utilities.formatDate(v, "Asia/Seoul", "yyyy-MM-dd");
      return String(v === null || v === undefined ? "" : v).replace(/[\t\n]/g, " ");
    }).join("\t"));
  });

  Logger.log("Events_OPS Webinar rows : " + rows.length);
  // 로그 한 줄 길이 제한을 피하려고 50행씩 나눠 찍음
  for(let i = 0; i < lines.length; i += 50){
    Logger.log("\n" + lines.slice(i, i + 50).join("\n"));
  }

}
