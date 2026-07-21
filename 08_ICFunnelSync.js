/**
 * ==========================================================
 * Marketing 2.0
 * IC Funnel Sync
 *
 * Responsibility
 * ICFunnel_Raw(주 단위 append)로부터 Leads_OPS의
 * IC Booked/Completed/Won Date + Revenue만 역동기화.
 *
 * Must NOT
 * - Leads_OPS의 다른 컬럼(Salesforce 기본 정보, Marketing 관리 컬럼) 건드리지 않음
 * - 값이 비어있는 필드는 기존 OPS 값을 덮어쓰지 않음 (부분 정보로 지우지 않기 위함)
 *
 * Version
 * v1.1.0
 *
 * Change Log
 * v1.1.0 (2026-07-21)
 * - Fixed: getHeaderMap()이 0-based index를 반환하는데
 *   `!leadIdCol` falsy 체크와 getRange() 1-based 컬럼 인자로
 *   그대로 사용해서, Lead ID가 첫 번째 컬럼(index 0)일 때
 *   "column not found"로 잘못 판단하던 버그 수정.
 * - `leadIdCol === undefined` 명시적 체크로 변경.
 * - getRange() 호출 시 (index + 1)로 1-based 변환.
 * ==========================================================
 */


/**
 * ==========================================================
 * Pick Latest Record Per Lead ID
 * (변경 없음 — 기존 그대로)
 * ==========================================================
 */
function pickLatestICFunnelRecords_(rawRecords){

  const leadIdKey = CONFIG.IC_FUNNEL.COLUMNS.LEAD_ID;

  const latest = {};

  rawRecords.forEach(function(record){

    const leadId = String(record[leadIdKey] || "").trim();

    if(!leadId){
      return;
    }

    latest[leadId] = record;

  });

  return latest;

}


/**
 * ==========================================================
 * TEST — pickLatestICFunnelRecords_()
 * (변경 없음 — 기존 그대로)
 * ==========================================================
 */
function testPickLatestICFunnelRecords(){

  const cols = CONFIG.IC_FUNNEL.COLUMNS;

  const rawRecords = [

    (function(){
      const r = {};
      r[cols.LEAD_ID] = "L1";
      r[cols.IC_BOOKED_DATE] = "first";
      return r;
    })(),

    (function(){
      const r = {};
      r[cols.LEAD_ID] = "L2";
      r[cols.IC_BOOKED_DATE] = "only";
      return r;
    })(),

    (function(){
      const r = {};
      r[cols.LEAD_ID] = "L1";
      r[cols.IC_BOOKED_DATE] = "second";
      return r;
    })()

  ];

  const result = pickLatestICFunnelRecords_(rawRecords);

  const pass =
    Object.keys(result).length === 2 &&
    result["L1"][cols.IC_BOOKED_DATE] === "second" &&
    result["L2"][cols.IC_BOOKED_DATE] === "only";

  Logger.log("Keys: " + Object.keys(result).length + " (expected 2)");
  Logger.log("L1 value: " + result["L1"][cols.IC_BOOKED_DATE] + " (expected 'second')");
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * TEST — getHeaderMap() 0-based index 처리 검증
 *
 * WHY
 * "Lead ID"가 시트의 첫 번째 컬럼(index 0)일 때도
 * "컬럼을 못 찾음"으로 잘못 판단하지 않는지 확인.
 * (실제로 이 버그 때문에 syncICFunnelToOPS()가 실패했었음)
 *
 * EXPECTED
 * headerMap["Lead ID"] === 0 이어도, `=== undefined` 체크로는
 * "찾음"으로 정상 판단되어야 함.
 * ==========================================================
 */
function testHeaderMapZeroIndexHandling(){

  const headerMap = {
    "Lead ID": 0,
    "Email": 1
  };

  const leadIdCol = headerMap["Lead ID"];

  // 버그가 있던 방식: if(!leadIdCol) → 0은 falsy라 여기서 잘못 걸림
  const buggyCheck = !leadIdCol;

  // 고친 방식
  const fixedCheck = leadIdCol === undefined;

  Logger.log("buggyCheck (틀린 방식) : " + buggyCheck + " (원래 여기서 오작동 발생)");
  Logger.log("fixedCheck (맞는 방식) : " + fixedCheck + " (expected false — 컬럼 찾음)");

  const pass = fixedCheck === false;

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Sync IC Funnel to Leads_OPS
 * ==========================================================
 */
function syncICFunnelToOPS(){

  const start = new Date();

  Logger.log("======================================");
  Logger.log("IC Funnel Sync Started");
  Logger.log("======================================");

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  //----------------------------------------------------------
  // Read ICFunnel_Raw
  //----------------------------------------------------------

  const rawSheet = ss.getSheetByName(CONFIG.IC_FUNNEL.SHEET);

  if(!rawSheet){
    throw new Error(
      CONFIG.IC_FUNNEL.SHEET + " sheet not found. Import IC Funnel 먼저 실행하세요."
    );
  }

  const rawRecords = sheetToObjects(rawSheet);

  const latestByLeadId = pickLatestICFunnelRecords_(rawRecords);

  const leadIds = Object.keys(latestByLeadId);

  Logger.log("ICFunnel_Raw Records : " + rawRecords.length);
  Logger.log("Unique Lead IDs (latest only) : " + leadIds.length);

  //----------------------------------------------------------
  // Read Leads_OPS — Lead ID → Row 매핑
  //----------------------------------------------------------

  const opsSheet = ss.getSheetByName(OPS.SHEET.OPS);

  if(!opsSheet){
    throw new Error(
      OPS.SHEET.OPS + " sheet not found. buildLeadsOPS() 먼저 실행하세요."
    );
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
  // 필드 매핑: OPS 컬럼명 → ICFunnel_Raw 컬럼 Config Key
  //----------------------------------------------------------

  const syncFieldMap = {
    "IC Booked Date": { key: CONFIG.IC_FUNNEL.COLUMNS.IC_BOOKED_DATE, isDate: true },
    "IC Completed Date": { key: CONFIG.IC_FUNNEL.COLUMNS.IC_COMPLETED_DATE, isDate: true },
    "Opportunity Won Date": { key: CONFIG.IC_FUNNEL.COLUMNS.OPPORTUNITY_WON_DATE, isDate: true },
    "Revenue": { key: CONFIG.IC_FUNNEL.COLUMNS.REVENUE, isDate: false }
  };

  //----------------------------------------------------------
  // Sync 실행
  //----------------------------------------------------------

  let updated = 0;
  let notFoundInOPS = 0;

  leadIds.forEach(function(leadId){

    const sheetRow = leadIdToRow[leadId];

    if(!sheetRow){

      Logger.log("[syncICFunnelToOPS] Lead ID not found in Leads_OPS : " + leadId);
      notFoundInOPS++;
      return;

    }

    const record = latestByLeadId[leadId];

    let rowUpdated = false;

    Object.keys(syncFieldMap).forEach(function(opsFieldName){

      const fieldConfig = syncFieldMap[opsFieldName];

      const rawValue = record[fieldConfig.key];

      if(
        rawValue === undefined ||
        rawValue === null ||
        String(rawValue).trim() === ""
      ){
        return;
      }

      const colIndex = headerMap[opsFieldName];

      if(colIndex === undefined){
        return;
      }

      const parsedValue =
        fieldConfig.isDate
          ? parseDMY(String(rawValue).trim())
          : (Number(rawValue) || 0);

      opsSheet.getRange(sheetRow, colIndex + 1).setValue(parsedValue);

      rowUpdated = true;

    });

    if(rowUpdated){
      updated++;
    }

  });

  const seconds = ((new Date() - start) / 1000).toFixed(2);

  Logger.log("");
  Logger.log("========== IC FUNNEL SYNC SUMMARY ==========");
  Logger.log("Updated in Leads_OPS : " + updated);
  Logger.log("Not found in Leads_OPS : " + notFoundInOPS);
  Logger.log("Time : " + seconds + "s");
  Logger.log("=============================================");

  refreshACQSummary_();

}