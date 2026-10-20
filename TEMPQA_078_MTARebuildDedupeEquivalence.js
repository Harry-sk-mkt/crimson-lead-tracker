/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — rebuildMTAMaster() 메모리 중복 제거 동치 검증
 *
 * Responsibility
 * 2026-10-20 `rebuildMTAMaster()` 단축(MASTER_004 v4.8.0): 시트에 쓴 뒤
 * 행 삭제하던 중복 정리를, 쓰기 전 메모리에서 `dedupeExactDuplicateTouchRecords_()`로
 * 하도록 바꿨다. 실제 rebuild 전에, Raw → 변환 → 메모리 중복 제거 결과가 지금
 * MTA_Master(시트 경로로 정리된 상태)와 같은지 비교한다 — 행 수와
 * 키(Lead ID+MTA Created Date+MKT UTM Campaign+First Lead Source+Lead Source
 * Detail) 다중집합. 시트 자동 형변환(문자열→날짜/숫자)으로 키가 달라지는지도 여기서 드러난다.
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 비교(TEMPQA 관례).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-10-20)
 * - 최초 구현.
 * ==========================================================
 */
function runCheckMTARebuildDedupeEquivalence(){

  function key(r){
    const d = r["MTA Created Date"];
    return [
      String(r["Lead ID"] || "").trim(),
      (d instanceof Date && !isNaN(d.getTime())) ? d.getTime() : "NODATE:" + String(d || ""),
      String(r["MKT UTM Campaign"] || "").trim(),
      String(r["First Lead Source"] || "").trim(),
      String(r["Lead Source Detail"] || "").trim()
    ].join("|");
  }

  function count(records){
    const m = {};
    records.forEach(function(r){ const k = key(r); m[k] = (m[k] || 0) + 1; });
    return m;
  }

  const raw = readMTARaw();
  const deduped = dedupeExactDuplicateTouchRecords_(transformMTARecords(raw));
  const sheetRows = readMTAMasterRowsWithIndex_().map(function(x){ return x.record; });

  const memCount = count(deduped.records);
  const sheetCount = count(sheetRows);

  const diffs = [];
  const keys = {};
  Object.keys(memCount).forEach(function(k){ keys[k] = true; });
  Object.keys(sheetCount).forEach(function(k){ keys[k] = true; });
  Object.keys(keys).forEach(function(k){
    const a = memCount[k] || 0, b = sheetCount[k] || 0;
    if(a !== b) diffs.push("mem " + a + " / sheet " + b + " | " + k);
  });

  Logger.log("Raw : " + raw.length);
  Logger.log("메모리 경로 : " + deduped.records.length + " (중복 제거 " + deduped.removed + ")");
  Logger.log("현재 MTA_Master : " + sheetRows.length);
  Logger.log("키 불일치 : " + diffs.length + (diffs.length === 0 ? " → 동치 ✅" : ""));
  if(diffs.length) Logger.log("예시(최대 30):\n" + diffs.slice(0, 30).join("\n"));

}
