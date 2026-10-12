/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — Leads_OPS "Create Date" 빈칸 진단 (2026-10-12, 읽기 전용)
 *
 * Responsibility
 * 2026-10-12 15:26 Leads tail 이후 ACQ/NewP1/Target/S&M 리포트가 거의 0으로
 * 나옴(그림자 diff full=1 / incremental=714). 사용자 확인: Leads_OPS Create
 * Date 9,180칸 빈칸, 같은 날 파일 전체를 10-07 버전으로 복원함. Create Date는
 * `OPS.SF_COLUMNS`라 build마다 Leads_Master 값으로 덮어씀 → 빈칸이 Master에서
 * 온 건지(Master도 빈칸) OPS에서만 생긴 건지 가르고, 빈칸 행의 모양(Created FY
 * 분포, 행 위치, Master 값 타입)을 본다.
 *
 * 쓰기 없음. runDiagnoseLeadsCreateDateBlanks()만 실행.
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
function runDiagnoseLeadsCreateDateBlanks() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  function readColumns(sheetName, names) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error(sheetName + " 없음");
    const lastRow = sheet.getLastRow();
    const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(function (h) { return String(h).trim(); });
    const out = { rows: lastRow - 1 };
    names.forEach(function (n) {
      const idx = header.indexOf(n);
      out[n] = idx === -1 ? null :
        sheet.getRange(2, idx + 1, lastRow - 1, 1).getValues().map(function (r) { return r[0]; });
    });
    return out;
  }

  function typeOf(v) {
    if (v === "" || v === null) return "blank";
    if (v instanceof Date) return "Date";
    return typeof v;
  }

  function tally(values) {
    const t = {};
    values.forEach(function (v) { const k = typeOf(v); t[k] = (t[k] || 0) + 1; });
    return JSON.stringify(t);
  }

  const cols = ["Lead ID", "Create Date", "Created FY"];
  const ops = readColumns(OPS.SHEET.OPS, cols);
  const master = readColumns(CONFIG.SHEETS.LEADS_MASTER, cols);

  Logger.log("Leads_OPS 행 " + ops.rows + " | Create Date 타입 " + tally(ops["Create Date"]));
  Logger.log("Leads_Master 행 " + master.rows + " | Create Date 타입 " + tally(master["Create Date"]));

  // Master: Lead ID → Create Date
  const masterById = {};
  master["Lead ID"].forEach(function (id, i) {
    if (id) masterById[String(id).trim()] = master["Create Date"][i];
  });

  const blankIdx = [];
  ops["Create Date"].forEach(function (v, i) { if (typeOf(v) === "blank") blankIdx.push(i); });

  if (blankIdx.length === 0) {
    Logger.log("Leads_OPS Create Date 빈칸 없음.");
    return;
  }

  // 빈칸 행: Created FY 분포, 행 위치, Master 쪽 값 타입
  const fyDist = {};
  const masterTypes = {};
  blankIdx.forEach(function (i) {
    const fy = String(ops["Created FY"] ? ops["Created FY"][i] : "?");
    fyDist[fy] = (fyDist[fy] || 0) + 1;
    const id = String(ops["Lead ID"][i] || "").trim();
    const k = !id ? "OPS Lead ID 없음" : (id in masterById ? "Master " + typeOf(masterById[id]) : "Master에 Lead ID 없음");
    masterTypes[k] = (masterTypes[k] || 0) + 1;
  });

  Logger.log("OPS 빈칸 " + blankIdx.length + "건 — 시트 행 " + (blankIdx[0] + 2) + " ~ " + (blankIdx[blankIdx.length - 1] + 2));
  Logger.log("빈칸 행의 Created FY 분포: " + JSON.stringify(fyDist));
  Logger.log("빈칸 행의 Master Create Date: " + JSON.stringify(masterTypes));

  // 연속 구간 상위 5개
  const runs = [];
  let s = blankIdx[0], p = blankIdx[0];
  blankIdx.slice(1).concat([null]).forEach(function (i) {
    if (i !== null && i === p + 1) { p = i; return; }
    runs.push({ from: s + 2, to: p + 2, n: p - s + 1 });
    if (i !== null) { s = i; p = i; }
  });
  runs.sort(function (a, b) { return b.n - a.n; });
  Logger.log("연속 빈칸 구간 " + runs.length + "개, 큰 순 5개: " + JSON.stringify(runs.slice(0, 5)));

  blankIdx.slice(0, 5).forEach(function (i) {
    const id = String(ops["Lead ID"][i] || "").trim();
    Logger.log("샘플 행 " + (i + 2) + " | Lead ID " + id + " | Created FY " + (ops["Created FY"] ? ops["Created FY"][i] : "?") +
      " | Master Create Date " + (id in masterById ? String(masterById[id]) + " (" + typeOf(masterById[id]) + ")" : "-"));
  });

}
