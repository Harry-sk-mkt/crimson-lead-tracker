/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — Sales Accepted Date 잔존(stale) 값 강제 클리어
 *
 * Responsibility
 * `syncMTAFunnelToOPS_()`(MASTER_003_MTAFunnelSync.js)는 설계상 "값이 있을
 * 때만 채워넣고, 없으면 기존 값을 지우지 않는다"(안전한 기본값 — 대부분의
 * 경우 값이 사라지는 게 아니라 아직 export/동기화가 안 된 것뿐이라 지우면
 * 안 되기 때문). 그런데 TEMPQA_009_SalesAcceptedDateLeadTrace.js로 실측
 * 확인한 결과, MTA_Master 대표 터치(latest, computeMTAFunnelByLeadId_())의
 * Sales Accepted Date가 이미 공란인데도 Leads_OPS엔 예전 동기화 때 들어간
 * 값이 그대로 남아있는 리드가 있음(00QRC000001eqAb, 2026-11-08 잔존 확인,
 * 2026-08-19). 이 파일은 그 잔존 값을 **이번 한 번만 강제로 공란 처리**하는
 * 1회성 스크립트 — syncMTAFunnelToOPS_() 자체의 "지우지 않음" 정책은
 * 바꾸지 않음(사용자 확정, 2026-08-19).
 *
 * ⚠️ 범위: Sales Accepted Date 컬럼만 대상. IC Booked/Completed/Won Date도
 * 이론상 같은 잔존 가능성이 있지만, 이번에 실측으로 확인된 건 Sales
 * Accepted Date뿐이라 그 범위만 처리(임의 확장하지 않음).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-08-19)
 * - 최초 구현.
 * ==========================================================
 */


/**
 * ==========================================================
 * Should Clear Stale Sales Accepted Date (순수 함수)
 *
 * INPUT
 * currentOpsValue    : *     (Leads_OPS 현재 셀 값)
 * masterFunnelValue  : *     (funnelByLeadId[leadId].salesAcceptedDate,
 *                              computeMTAFunnelByLeadId_() 출력 — 리드가
 *                              MTA_Master에 아예 없으면 undefined)
 *
 * OUTPUT
 * boolean  — true면 clear 대상(공란으로 덮어써야 함)
 *
 * TEST
 * testShouldClearStaleSalesAcceptedDate() 참고
 * ==========================================================
 */
function shouldClearStaleSalesAcceptedDate_(currentOpsValue, masterFunnelValue){

  if(currentOpsValue === "" || currentOpsValue === null || currentOpsValue === undefined){
    return false; // 이미 비어있으면 손댈 필요 없음
  }

  const masterHasValue =
    masterFunnelValue !== undefined &&
    masterFunnelValue !== null &&
    masterFunnelValue !== "" &&
    masterFunnelValue !== 0 &&
    !(masterFunnelValue instanceof Date && isNaN(masterFunnelValue.getTime()));

  return !masterHasValue;

}


/**
 * ==========================================================
 * TEST — shouldClearStaleSalesAcceptedDate_()
 * ==========================================================
 */
function testShouldClearStaleSalesAcceptedDate(){

  const validDate = new Date(2026, 7, 11);

  const cases = [
    // [currentOpsValue, masterFunnelValue, expected]
    ["", undefined, false],                        // 이미 공란
    [validDate, validDate, false],                  // MTA_Master도 값 있음 — 그대로 둠
    [validDate, undefined, true],                   // 리드가 MTA_Master에 없음 — clear
    [validDate, null, true],                        // 대표 터치 값이 null — clear
    [validDate, "", true],                          // 대표 터치 값이 빈 문자열 — clear
    [validDate, new Date(NaN), true]                 // 잘못된 Date 객체 — clear
  ];

  const pass = cases.every(function(c){
    return shouldClearStaleSalesAcceptedDate_(c[0], c[1]) === c[2];
  });

  Logger.log("testShouldClearStaleSalesAcceptedDate: " + (pass ? "PASS" : "FAIL"));

}


/**
 * ==========================================================
 * Run Clear Stale Sales Accepted Date (Leads_OPS 직접 수정 — 1회성)
 *
 * WHY
 * 컬럼 전체를 1회 읽어 메모리에서 판정 후 1회 배치 쓰기(MASTER_003_MTAFunnelSync.js
 * v1.6.0과 동일 배치 패턴).
 * ==========================================================
 */
function runClearStaleSalesAcceptedDate(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const mtaSheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);
  const opsSheet = ss.getSheetByName(OPS.SHEET.OPS);

  if(!mtaSheet || !opsSheet){
    Logger.log("MTA_Master 또는 Leads_OPS sheet not found.");
    return;
  }

  const mtaRecords = sheetToObjects(mtaSheet);
  const funnelByLeadId = computeMTAFunnelByLeadId_(mtaRecords);

  const headerMap = getHeaderMap(opsSheet);
  const leadIdCol = headerMap["Lead ID"];
  const salCol = headerMap["Sales Accepted Date"];

  if(leadIdCol === undefined || salCol === undefined){
    Logger.log("Lead ID 또는 Sales Accepted Date 컬럼을 Leads_OPS에서 찾을 수 없음.");
    return;
  }

  const lastRow = opsSheet.getLastRow();

  if(lastRow < OPS.ROWS.DATA_START){
    Logger.log("Leads_OPS has no data rows.");
    return;
  }

  const numRows = lastRow - OPS.ROWS.DATA_START + 1;

  const leadIdValues = opsSheet.getRange(OPS.ROWS.DATA_START, leadIdCol + 1, numRows, 1).getValues();
  const salValues = opsSheet.getRange(OPS.ROWS.DATA_START, salCol + 1, numRows, 1).getValues();

  let clearedCount = 0;
  const sampleLines = [];

  const newSalValues = salValues.map(function(row, index){

    const currentVal = row[0];
    const leadId = String(leadIdValues[index][0] || "").trim();
    const funnel = leadId ? funnelByLeadId[leadId] : undefined;
    const masterValue = funnel ? funnel.salesAcceptedDate : undefined;

    if(!shouldClearStaleSalesAcceptedDate_(currentVal, masterValue)){
      return [currentVal];
    }

    clearedCount++;

    if(sampleLines.length < 10){
      sampleLines.push(leadId + " : " + currentVal + " -> (공란)");
    }

    return [""];

  });

  opsSheet.getRange(OPS.ROWS.DATA_START, salCol + 1, numRows, 1).setValues(newSalValues);

  Logger.log("========== Sales Accepted Date 잔존값 강제 클리어 (Leads_OPS) ==========");
  Logger.log("전체 리드 수    : " + numRows);
  Logger.log("클리어된 건수    : " + clearedCount);
  Logger.log("");
  Logger.log("샘플(최대 10건, Lead ID : 이전 값 -> 공란):");
  sampleLines.forEach(function(line){ Logger.log("  " + line); });
  Logger.log("==================================================================");

}
