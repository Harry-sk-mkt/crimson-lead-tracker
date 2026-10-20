/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — Events_OPS SAT 웨비나 실적 덤프 (그로스미팅 SAT WB 실험 결과용)
 *
 * Responsibility
 * 2026-10-20 그로스미팅에서 Ideation "SAT WB"(가설: 웨비나 New P1 Lead%
 * 50% 이상, 실험 기간 ~2026-10-14) 결과를 정리하기 위해, Events_OPS에서
 * 프로그램명에 "SAT"가 들어간 행의 등록·P1·비용 지표를 로그로 찍는다.
 * NP1% 분모(SF Reg. vs SF NL)는 사용자 확인 전이라 두 값을 다 계산해 둔다.
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 덤프(TEMPQA 관례).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-10-20)
 * - 최초 구현.
 * ==========================================================
 */
function runDumpEventsOPSSATWebinar(){

  const COLS = ["Lead Source Detail", "Marketo Campaign name", "EventType", "Event Date",
                "Mkt Reg.", "SF Reg.", "SF NL", "SF P1s", "SF NLP1s", "Spent", "CPNP1"];

  const rows = readEventsOPS_().filter(function(r){
    const name = String(r["Marketo Campaign name"] || "") + " " + String(r["Lead Source Detail"] || "");
    return /SAT/i.test(name);
  });

  const lines = [COLS.concat(["NLP1/SF Reg.", "NLP1/SF NL"]).join("\t")];

  rows.forEach(function(r){
    const cells = COLS.map(function(c){
      const v = r[c];
      if(v instanceof Date) return Utilities.formatDate(v, "Asia/Seoul", "yyyy-MM-dd");
      return String(v === null || v === undefined ? "" : v).replace(/[\t\n]/g, " ");
    });
    const nlp1 = Number(r["SF NLP1s"]) || 0;
    const reg = Number(r["SF Reg."]) || 0;
    const nl = Number(r["SF NL"]) || 0;
    cells.push(reg ? (nlp1 / reg * 100).toFixed(1) + "%" : "-");
    cells.push(nl ? (nlp1 / nl * 100).toFixed(1) + "%" : "-");
    lines.push(cells.join("\t"));
  });

  Logger.log("Events_OPS SAT rows : " + rows.length);
  Logger.log("\n" + lines.join("\n"));

}
