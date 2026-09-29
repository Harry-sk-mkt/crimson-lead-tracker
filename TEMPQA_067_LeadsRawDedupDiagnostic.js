/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — Leads_Raw dedup 미동작 진단 (2026-09-29)
 *
 * Responsibility
 * 09-29 08:51(9/1~4, 68건) → 09:13(9/1~27, 532건) 연속 Import에서 20분 전에
 * 넣은 같은 리드조차 "완전 동일 중복"으로 skip되지 않음(0건). dedup은
 * 시트 getValues() 값과 CSV 문자열을 String()으로 비교하므로, Sheets가
 * 텍스트 고정(RAW_DATE_COLUMNS) 외 컬럼을 숫자/날짜로 자동 변환하면
 * 영원히 불일치한다는 가설을 확인한다.
 * (1) 최근 행들의 컬럼별 값 타입 분포(string/number/Date) + 샘플
 * (2) 두 배치에 모두 있는 같은 Lead ID 쌍에서 컬럼별로 값이 다른 건수
 *     — (2)가 0인데 dedup이 실패했다면 원인은 저장 시 타입 변환으로 확정.
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 조사 스크립트(TEMPQA 관례).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-09-29)
 * - 최초 구현.
 * ==========================================================
 */
function runDiagnoseLeadsRawDedup(){

  // 09-29 Import 로그 기준 행 번호(시트 1-based)
  const BATCH_A = { first: 38248, last: 38315 };   // 08:51, 9/1~4
  const BATCH_B = { first: 38316, last: 38847 };   // 09:13, 9/1~27

  const sheet = openLeadsRawExternalSpreadsheet_().getSheetByName(CONFIG.SHEETS.LEADS_RAW);
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(CONFIG.ROWS.HEADER, 1, 1, lastCol).getValues()[0];
  const rows = sheet.getRange(BATCH_A.first, 1, BATCH_B.last - BATCH_A.first + 1, lastCol).getValues();
  const idIdx = headers.indexOf("Lead ID");
  const textCols = CONFIG.RAW_DATE_COLUMNS.LEADS;

  function typeOf(v){
    if(v instanceof Date) return "Date";
    return typeof v;
  }

  Logger.log("========== Leads_Raw dedup 진단 (rows " + BATCH_A.first + "-" + BATCH_B.last + ") ==========");
  Logger.log("--- (1) 컬럼별 값 타입 (빈 값 제외) ---");

  headers.forEach(function(h, c){
    const counts = {};
    const samples = {};
    rows.forEach(function(r){
      const v = r[c];
      if(v === "" || v === null) return;
      const t = typeOf(v);
      counts[t] = (counts[t] || 0) + 1;
      if(!samples[t]) samples[t] = String(v);
    });
    const nonString = Object.keys(counts).filter(function(t){ return t !== "string"; });
    Logger.log(
      (nonString.length > 0 ? "⚠️ " : "   ") + h +
      (textCols.indexOf(h) !== -1 ? " [text 고정]" : "") +
      " : " + JSON.stringify(counts) + " 샘플 " + JSON.stringify(samples)
    );
  });

  Logger.log("--- (2) 두 배치 공통 Lead ID 쌍의 컬럼별 값 차이 ---");

  const aById = {};
  rows.slice(0, BATCH_A.last - BATCH_A.first + 1).forEach(function(r){ aById[r[idIdx]] = r; });

  const diffCounts = {};
  const diffSamples = {};
  let pairs = 0;

  rows.slice(BATCH_A.last - BATCH_A.first + 1).forEach(function(b){
    const a = aById[b[idIdx]];
    if(!a) return;
    pairs++;
    headers.forEach(function(h, c){
      if(String(a[c]).trim() === String(b[c]).trim()) return;
      diffCounts[h] = (diffCounts[h] || 0) + 1;
      if(!diffSamples[h]) diffSamples[h] = b[idIdx] + " : " + String(a[c]) + " → " + String(b[c]);
    });
  });

  Logger.log("공통 Lead ID 쌍 : " + pairs);
  Object.keys(diffCounts).forEach(function(h){
    Logger.log("  " + h + " : " + diffCounts[h] + "건 다름 (예: " + diffSamples[h] + ")");
  });
  if(Object.keys(diffCounts).length === 0){
    Logger.log("  모든 컬럼 동일 — 저장된 값끼리는 같음 → dedup 실패 원인은 저장 시 타입 변환(위 ⚠️ 컬럼)");
  }

}
