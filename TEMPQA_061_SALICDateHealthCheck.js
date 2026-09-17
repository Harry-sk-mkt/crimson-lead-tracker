/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — Leads_OPS SAL/IC Booked/Completed Date 건수 헬스체크
 * (docs/OpenItems.md #52 재발 확인용, 2026-09-17)
 *
 * Responsibility
 * #52(Sales Accepted Date/IC Booked Date/IC Completed Date 대량 유실
 * 사고, 2026-09-15) 복구 후 락 가드 수정(v1.33.0/v1.34.0)이 실제로
 * 재발을 막고 있는지, 정기적으로 건수만 빠르게 확인하기 위한 1회성
 * 진단. 2026-09-15 복구 직후 기준값은 Sales Accepted Date 8,177건/
 * IC Booked Date 3,213건/IC Completed Date 3,010건(docs/Changelog.md
 * 2026-09-15) — 정상 상태라면 이후 계속된 Import로 이 값들은 시간이
 * 지날수록 늘어나야 정상이고, 사고 당시처럼 두 자릿수 이하로 갑자기
 * 떨어져 있으면 재발 신호.
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 *
 * INPUT: 없음 (Leads_OPS 직접 스캔)
 * OUTPUT: Logger.log만
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 조사 스크립트(TEMPQA 관례).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-09-17)
 * - 최초 구현.
 * ==========================================================
 */
function runCheckSALICDateHealth(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const opsSheet = ss.getSheetByName(OPS.SHEET.OPS);

  if(!opsSheet){
    Logger.log(OPS.SHEET.OPS + " 시트를 찾을 수 없습니다.");
    return;
  }

  const records = sheetToObjects(opsSheet);

  function isValidDate(v){
    return v instanceof Date && !isNaN(v.getTime());
  }

  function countNonEmpty(fieldName){
    return records.filter(function(r){ return isValidDate(r[fieldName]); }).length;
  }

  const salCount = countNonEmpty("Sales Accepted Date");
  const icBookedCount = countNonEmpty("IC Booked Date");
  const icCompletedCount = countNonEmpty("IC Completed Date");

  Logger.log("========== Leads_OPS SAL/IC Date 헬스체크 ==========");
  Logger.log("Leads_OPS 전체 행 수 : " + records.length);
  Logger.log("Sales Accepted Date  : " + salCount + " (2026-09-15 복구 직후 기준값 8,177)");
  Logger.log("IC Booked Date       : " + icBookedCount + " (2026-09-15 복구 직후 기준값 3,213)");
  Logger.log("IC Completed Date    : " + icCompletedCount + " (2026-09-15 복구 직후 기준값 3,010)");
  Logger.log("=====================================================");
  Logger.log(
    "판단 기준: 위 기준값보다 늘어나 있으면 정상(계속된 Import로 누적), " +
    "기준값보다 훨씬 적거나(특히 두 자릿수 이하) 급감했으면 #52 재발 의심."
  );

}
