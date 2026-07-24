/**
 * ==========================================================
 * Marketing 2.0
 * MTA Funnel Sync
 *
 * Responsibility
 * MTA_Master(터치 단위, IC Booked/Completed/Won/Revenue 포함)에서
 * Lead ID별 대표값을 뽑아 Leads_OPS의 Funnel 필드(SYNC_COLUMNS)로 역동기화.
 *
 * WHY (설계 배경)
 * SAL 판별(Lead Record Type)이 "이번 주 IC Booked Date 존재 여부"와
 * 사실상 동일한 기준이라는 게 확인되어, 별도 ICFunnel_Raw 리포트/
 * 파이프라인(08_ICFunnelSync.js, CONFIG.IC_FUNNEL) 없이 MTA_Master
 * 하나로 SAL + IC Funnel 동기화를 동시에 처리하도록 통합함.
 * ICFunnel_Raw 관련 코드/시트는 전량 제거됨 (2026-07-21).
 *
 * Must NOT
 * - Leads_OPS의 다른 컬럼(Salesforce 기본 정보, Marketing 관리 컬럼) 건드리지 않음
 *
 * Version
 * v1.0.0
 * ==========================================================
 */


/**
 * ==========================================================
 * Compute MTA Funnel By Lead ID
 *
 * WHY
 * MTA_Master는 터치 단위라 같은 Lead ID가 여러 행에 걸쳐 나온다.
 * IC Booked/Completed/Won/Revenue는 Lead 레벨 사실이라 보통
 * 모든 터치 행에 동일한 값이 반복되지만, 데이터 이상으로 값이
 * 다를 경우 mergeOPS()와 동일한 원칙(가장 오래된 터치 채택)을 적용한다.
 *
 * INPUT
 * mtaRecords : Object[]  (MTA_Master 전체 레코드)
 *
 * OUTPUT
 * Object  { [leadId]: { icBookedDate, icCompletedDate, wonDate, revenue } }
 *
 * TEST
 * 같은 Lead ID 2개 터치, IC Booked Date가 서로 다르면
 * → 더 이른 MTA Created Date를 가진 터치의 값이 채택되어야 함
 * ==========================================================
 */
function computeMTAFunnelByLeadId_(mtaRecords){

  const groups = {};

  mtaRecords.forEach(function(record){

    const leadId = String(record["Lead ID"] || "").trim();

    if(!leadId) return;

    if(!groups[leadId]){
      groups[leadId] = [];
    }

    groups[leadId].push(record);

  });

  const result = {};

  Object.keys(groups).forEach(function(leadId){

    const rows = groups[leadId];

    //----------------------------------------------------------
    // 가장 오래된 터치(MTA Created Date 최솟값) 찾기
    //----------------------------------------------------------

    let earliestRow = rows[0];

    rows.forEach(function(row){

      const candidateDate = row["MTA Created Date"];
      const earliestDate = earliestRow["MTA Created Date"];

      const candidateValid =
        candidateDate instanceof Date && !isNaN(candidateDate.getTime());
      const earliestValid =
        earliestDate instanceof Date && !isNaN(earliestDate.getTime());

      if(candidateValid && earliestValid && candidateDate.getTime() < earliestDate.getTime()){
        earliestRow = row;
      }

    });

    //----------------------------------------------------------
    // 불일치 검증 — 같은 Lead의 터치 행끼리 IC Booked Date가
    // 다르면 경고만 로그로 남기고, earliestRow 값을 그대로 채택
    //----------------------------------------------------------

    if(rows.length > 1){

      const bookedDates = rows
        .map(function(row){ return row["IC Booked Date"]; })
        .filter(function(d){ return d instanceof Date && !isNaN(d.getTime()); })
        .map(function(d){ return d.getTime(); });

      const uniqueBookedDates = Array.from(new Set(bookedDates));

      if(uniqueBookedDates.length > 1){

        Logger.log(
          "[MTAFunnelSync] ⚠️ Lead ID " + leadId +
          " — 터치 행마다 IC Booked Date가 다름 (" +
          uniqueBookedDates.length + "개 서로 다른 값). " +
          "가장 오래된 터치 값 채택."
        );

      }

    }

    result[leadId] = {
      icBookedDate: earliestRow["IC Booked Date"],
      icCompletedDate: earliestRow["IC Completed Date"],
      wonDate: earliestRow["Opportunity Won Date"],
      revenue: earliestRow["Revenue"]
    };

  });

  return result;

}


/**
 * ==========================================================
 * TEST — computeMTAFunnelByLeadId_()
 * ==========================================================
 */
function testComputeMTAFunnelByLeadId(){

  const records = [

    {
      "Lead ID": "L1",
      "MTA Created Date": new Date(2026, 5, 15),
      "IC Booked Date": new Date(2026, 6, 1),
      "IC Completed Date": null,
      "Opportunity Won Date": null,
      "Revenue": 0
    },

    {
      "Lead ID": "L1",
      "MTA Created Date": new Date(2026, 5, 1),   // 더 이른 터치
      "IC Booked Date": new Date(2026, 6, 1),
      "IC Completed Date": null,
      "Opportunity Won Date": null,
      "Revenue": 0
    },

    {
      "Lead ID": "L2",
      "MTA Created Date": new Date(2026, 4, 1),
      "IC Booked Date": null,
      "IC Completed Date": null,
      "Opportunity Won Date": null,
      "Revenue": 0
    }

  ];

  const result = computeMTAFunnelByLeadId_(records);

  const pass =
    Object.keys(result).length === 2 &&
    result["L1"].icBookedDate.getTime() === new Date(2026, 6, 1).getTime() &&
    result["L2"].icBookedDate === null;

  Logger.log("Keys: " + Object.keys(result).length + " (expected 2)");
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Sync MTA Funnel to Leads_OPS
 * ==========================================================
 */
function syncMTAFunnelToOPS_(){

  const start = new Date();

  Logger.log("======================================");
  Logger.log("MTA Funnel Sync Started");
  Logger.log("======================================");

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  //----------------------------------------------------------
  // Read MTA_Master
  //----------------------------------------------------------

  const mtaSheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);

  if(!mtaSheet){
    throw new Error(CONFIG.SHEETS.MTA_MASTER + " sheet not found.");
  }

  const mtaRecords = sheetToObjects(mtaSheet);

  const funnelByLeadId = computeMTAFunnelByLeadId_(mtaRecords);

  const leadIds = Object.keys(funnelByLeadId);

  Logger.log("MTA_Master Records : " + mtaRecords.length);
  Logger.log("Unique Lead IDs : " + leadIds.length);

  //----------------------------------------------------------
  // Read Leads_OPS — Lead ID → Row 매핑
  //----------------------------------------------------------

  const opsSheet = ss.getSheetByName(OPS.SHEET.OPS);

  if(!opsSheet){
    throw new Error(OPS.SHEET.OPS + " sheet not found. buildLeadsOPS() 먼저 실행하세요.");
  }

  const headerMap = getHeaderMap(opsSheet);

  const leadIdCol = headerMap["Lead ID"];

  if(leadIdCol === undefined){
    throw new Error("Lead ID column not found in " + OPS.SHEET.OPS);
  }

  const lastRow = opsSheet.getLastRow();

  if(lastRow < OPS.ROWS.DATA_START){
    Logger.log("Leads_OPS has no data rows. Nothing to sync.");
    return;
  }

  const opsLeadIdValues = opsSheet
    .getRange(OPS.ROWS.DATA_START, leadIdCol + 1, lastRow - OPS.ROWS.DATA_START + 1, 1)
    .getValues();

  const leadIdToRow = {};

  opsLeadIdValues.forEach(function(row, index){

    const leadId = String(row[0] || "").trim();

    if(leadId){
      leadIdToRow[leadId] = OPS.ROWS.DATA_START + index;
    }

  });

  //----------------------------------------------------------
  // Sync 실행
  //----------------------------------------------------------

  const syncFieldMap = {
    "IC Booked Date": "icBookedDate",
    "IC Completed Date": "icCompletedDate",
    "Opportunity Won Date": "wonDate",
    "Revenue": "revenue"
  };

  let updated = 0;
  let notFoundInOPS = 0;

  leadIds.forEach(function(leadId){

    const sheetRow = leadIdToRow[leadId];

    if(!sheetRow){
      notFoundInOPS++;
      return;
    }

    const funnel = funnelByLeadId[leadId];

    let rowUpdated = false;

    Object.keys(syncFieldMap).forEach(function(opsFieldName){

      const value = funnel[syncFieldMap[opsFieldName]];

      if(
        value === undefined ||
        value === null ||
        value === "" ||
        value === 0
      ){
        return;
      }

      const colIndex = headerMap[opsFieldName];

      if(colIndex === undefined) return;

      opsSheet.getRange(sheetRow, colIndex + 1).setValue(value);

      rowUpdated = true;

    });

    if(rowUpdated){
      updated++;
    }

  });

  const seconds = ((new Date() - start) / 1000).toFixed(2);

  Logger.log("");
  Logger.log("========== MTA FUNNEL SYNC SUMMARY ==========");
  Logger.log("Updated in Leads_OPS : " + updated);
  Logger.log("Not found in Leads_OPS : " + notFoundInOPS);
  Logger.log("Time : " + seconds + "s");
  Logger.log("==============================================");

  refreshACQSummary_();
  refreshNewP1Engine_();

  refreshEventsEngine_();

}


/**
 * ==========================================================
 * TEMP — syncMTAFunnelToOPS_() 수동 실행용 공개 래퍼
 * ==========================================================
 */
function runSyncMTAFunnelToOPS(){

  syncMTAFunnelToOPS_();

}
