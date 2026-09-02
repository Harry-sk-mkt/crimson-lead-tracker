/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — ICFunnel_Raw 같은 Lead ID의 모든 행(중복 상담신청 확인)
 * (docs/OpenItems.md #32 후속 — SAL 8월 잔여 24건 원인 재검토)
 *
 * Responsibility
 * TEMPQA_045 재실행 결과 남은 24건이 전부 예전과 동일한(7월) Sales
 * Accepted Date를 그대로 갖고 있음 — 처음엔 "ICFunnel_Raw에 8월 값 자체가
 * 없다"고 판단했으나, 사용자가 "7월에도 8월에도 상담신청했을 수 있다"는
 * 대안 가설 제시. `pickLatestICFunnelRecords_()`(MASTER_009_ICFunnelSync.js)가
 * Lead ID별 "시트상 마지막 행"을 채택하는데, 이게 실제 날짜 기준 최신이
 * 아니라 단순 행 순서 기준이라 전체 히스토리 재export(ic2016-2026.csv)에서
 * 정렬이 날짜순이 아니면 August 행이 있어도 July 행이 잘못 채택될 수 있음.
 *
 * 이 스크립트는 Leads_OPS에서 Email → Lead ID를 찾고, ICFunnel_Raw
 * 전체에서 그 Lead ID의 모든 행(발견 순서 그대로)을 나열해 "New (Not
 * Contacted) Date Time" 값이 여러 개(7월/8월) 있는지, 있다면 어느 게
 * 마지막 행인지 확인한다.
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 *
 * INPUT: 없음 (Leads_OPS/ICFunnel_Raw 직접 스캔, 대상 Email 하드코딩)
 * OUTPUT: Logger.log만
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 조사 스크립트(TEMPQA 관례).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-09-01)
 * - 최초 구현.
 * ==========================================================
 */
function runTraceICFunnelDuplicateLeadRows(){

  // TEMPQA_045에서 "8월 아님, 7월로 찍힘" 24건 중 대표 샘플
  const TARGET_EMAILS = [
    "utopiask@naver.com",
    "hyoju.celine@gmail.com",
    "koohani03@gmail.com",
    "jieun24jenny@gmail.com",
    "washgoo@gmail.com" // 참고 — 8/25 실행 시엔 정상 일치했던 케이스와 비교용
  ].filter(function(e){ return e !== "washgoo@gmail.com"; }); // 이미 정상 일치로 확인됨 — 제외

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  //----------------------------------------------------------
  // Leads_OPS — Email → Lead ID
  //----------------------------------------------------------

  const opsSheet = ss.getSheetByName(OPS.SHEET.OPS);
  const opsHeaderMap = getHeaderMap(opsSheet);
  const opsEmailCol = opsHeaderMap["Email"];
  const opsLeadIdCol = opsHeaderMap["Lead ID"];
  const opsLastRow = opsSheet.getLastRow();

  const emailToLeadId = {};

  if(opsLastRow >= OPS.ROWS.DATA_START){
    const numRows = opsLastRow - OPS.ROWS.DATA_START + 1;
    const emailValues = opsSheet.getRange(OPS.ROWS.DATA_START, opsEmailCol + 1, numRows, 1).getValues();
    const leadIdValues = opsSheet.getRange(OPS.ROWS.DATA_START, opsLeadIdCol + 1, numRows, 1).getValues();

    emailValues.forEach(function(row, i){
      const email = String(row[0] || "").trim().toLowerCase();
      if(email) emailToLeadId[email] = leadIdValues[i][0];
    });
  }

  //----------------------------------------------------------
  // ICFunnel_Raw 전체 스캔 — Lead ID별 모든 행 그룹핑(발견 순서 유지)
  //----------------------------------------------------------

  const rawSheet = ss.getSheetByName(CONFIG.IC_FUNNEL.SHEET);
  const rawRecords = sheetToObjects(rawSheet);

  const leadIdCol = CONFIG.IC_FUNNEL.COLUMNS.LEAD_ID;
  const nncCol = CONFIG.IC_FUNNEL.COLUMNS.SALES_ACCEPTED_DATE;

  const rowsByLeadId = {};

  rawRecords.forEach(function(record){
    const leadId = String(record[leadIdCol] || "").trim();
    if(!leadId) return;
    if(!rowsByLeadId[leadId]) rowsByLeadId[leadId] = [];
    rowsByLeadId[leadId].push(record[nncCol]);
  });

  //----------------------------------------------------------
  // 대상 Email별 결과 출력
  //----------------------------------------------------------

  TARGET_EMAILS.forEach(function(email){

    const leadId = emailToLeadId[email];

    Logger.log("========== " + email + " (Lead ID: " + leadId + ") ==========");

    if(!leadId){
      Logger.log("  Leads_OPS에서 Lead ID를 못 찾음.");
      return;
    }

    const rows = rowsByLeadId[leadId];

    if(!rows){
      Logger.log("  ICFunnel_Raw에 이 Lead ID의 행이 하나도 없음.");
      return;
    }

    Logger.log("  ICFunnel_Raw 총 행 수 : " + rows.length);
    Logger.log("  New (Not Contacted) Date Time 값(시트 발견 순서 그대로) : ");
    rows.forEach(function(v, i){
      Logger.log("    [" + (i + 1) + "] \"" + v + "\"" + (i === rows.length - 1 ? "  ← pickLatestICFunnelRecords_()가 채택하는 행" : ""));
    });

  });

}
