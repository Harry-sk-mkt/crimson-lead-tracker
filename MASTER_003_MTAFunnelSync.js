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
 * v1.5.1
 *
 * Change Log
 * v1.5.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `09_MTAFunnelSync.js` → 신규 `MASTER_003_MTAFunnelSync.js`, 코드 내용 변경 없음.
 * v1.5.0 (2026-07-27)
 * - refreshTargetActuals_() 호출 추가 (refreshContentEngine_() 바로 옆) —
 *   Target_REP 실적 컬럼도 항상 최신 유지 (docs/TargetReportDesign.md 참고).
 * v1.4.0 (2026-07-25)
 * - "Sales Accepted Date" 필드 추가(13_MTATransformer.js에서 매핑) — SAL을
 *   Lead Record Type(터치마다 반복되는 스냅샷, 과집계 문제 있음) 대신 이
 *   이벤트 날짜 필드로 판별하기 위함(30_ACQReport.js 참고). Sync 대상에
 *   추가해 Leads_OPS로 반영.
 * v1.3.0 (2026-07-25)
 * - computeMTAFunnelByLeadId_()가 Lead ID별 대표 터치를 "가장 오래된
 *   터치"(earliest) → "가장 최근 터치"(latest, MTA Created Date 최댓값)
 *   기준으로 변경. IC Booked/Completed/Won/Revenue는 파이프라인 진행에
 *   따라 갱신되는 Lead 레벨 스냅샷이라 최신 값이 실제 현재 상태에 가까움
 *   (mergeOPS()의 "earliest wins"는 중복 리드 식별 목적이라 별개 —
 *   여기 적용했던 게 잘못이었음, 사용자 확인). ACQ_REP 테스트 중
 *   IC Booked/Complete/Revenue 수치가 실제보다 낮게 나오는 현상 조사
 *   과정에서 발견.
 * v1.2.0 (2026-07-24)
 * - refreshSearchEngine_()/refreshContentEngine_() 호출 추가 (refreshBOFUEngine_()
 *   바로 옆).
 * v1.1.0 (2026-07-24)
 * - refreshBOFUEngine_() 호출 추가 (refreshEventsEngine_() 바로 옆).
 * ==========================================================
 */


/**
 * ==========================================================
 * Compute MTA Funnel By Lead ID
 *
 * WHY
 * MTA_Master는 터치 단위라 같은 Lead ID가 여러 행에 걸쳐 나온다.
 * IC Booked/Completed/Won/Revenue는 Lead 레벨 스냅샷(그 터치 row가
 * export된 시점의 Salesforce 상태)이라, 파이프라인이 진행될수록
 * (IC Booked → Completed → Won) 값이 갱신된다 — 즉 "모든 터치 행에
 * 동일한 값이 반복된다"는 가정이 실제로는 성립하지 않는다.
 *
 * 2026-07-25 정정: 기존엔 mergeOPS()의 "earliest wins"(중복 리드
 * 식별용) 원칙을 여기에도 그대로 적용해 가장 오래된 터치 값을
 * 채택했으나, 이는 목적이 다른 두 로직을 잘못 동일시한 것이었음
 * (mergeOPS()는 "어느 Lead ID가 원본인지" 식별용, 여기는 "현재 Funnel
 * 상태가 뭔지" 조회용). ACQ_REP의 IC Booked/Complete/Won/Revenue는
 * "가장 최신 상태"를 봐야 하므로, 가장 최근 터치(MTA Created Date
 * 최댓값) 값을 채택하도록 변경 (사용자 확인).
 *
 * INPUT
 * mtaRecords : Object[]  (MTA_Master 전체 레코드)
 *
 * OUTPUT
 * Object  { [leadId]: { icBookedDate, icCompletedDate, wonDate, revenue, salesAcceptedDate } }
 *
 * TEST
 * 같은 Lead ID 2개 터치, IC Booked Date가 서로 다르면
 * → 더 최근 MTA Created Date를 가진 터치의 값이 채택되어야 함
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
    // 가장 최근 터치(MTA Created Date 최댓값) 찾기
    //----------------------------------------------------------

    let latestRow = rows[0];

    rows.forEach(function(row){

      const candidateDate = row["MTA Created Date"];
      const latestDate = latestRow["MTA Created Date"];

      const candidateValid =
        candidateDate instanceof Date && !isNaN(candidateDate.getTime());
      const latestValid =
        latestDate instanceof Date && !isNaN(latestDate.getTime());

      if(candidateValid && latestValid && candidateDate.getTime() > latestDate.getTime()){
        latestRow = row;
      }

    });

    //----------------------------------------------------------
    // 불일치 검증 — 같은 Lead의 터치 행끼리 IC Booked Date가
    // 다르면 경고만 로그로 남기고, latestRow 값을 그대로 채택
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
          "가장 최근 터치 값 채택."
        );

      }

    }

    result[leadId] = {
      icBookedDate: latestRow["IC Booked Date"],
      icCompletedDate: latestRow["IC Completed Date"],
      wonDate: latestRow["Opportunity Won Date"],
      revenue: latestRow["Revenue"],
      salesAcceptedDate: latestRow["Sales Accepted Date"]
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
      // 더 이른 터치 — 아직 IC Complete 안 된 시점의 스냅샷
      "Lead ID": "L1",
      "MTA Created Date": new Date(2026, 5, 1),
      "IC Booked Date": new Date(2026, 5, 1),
      "IC Completed Date": null,
      "Opportunity Won Date": null,
      "Revenue": 0
    },

    {
      // 더 최근 터치 — 이후 IC Complete까지 진행된 시점의 스냅샷
      // (2026-07-25 수정 전이면 이 값이 무시되고 위 row가 채택됐음)
      "Lead ID": "L1",
      "MTA Created Date": new Date(2026, 6, 10),
      "IC Booked Date": new Date(2026, 5, 1),
      "IC Completed Date": new Date(2026, 6, 5),
      "Opportunity Won Date": null,
      "Revenue": 0,
      "Sales Accepted Date": new Date(2026, 4, 20)
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
    result["L1"].salesAcceptedDate.getTime() === new Date(2026, 4, 20).getTime() &&
    result["L1"].icCompletedDate.getTime() === new Date(2026, 6, 5).getTime() &&
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
    "Revenue": "revenue",
    "Sales Accepted Date": "salesAcceptedDate"
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
  refreshBOFUEngine_();
  refreshSearchEngine_();
  refreshContentEngine_();
  refreshTargetActuals_();

}


/**
 * ==========================================================
 * TEMP — syncMTAFunnelToOPS_() 수동 실행용 공개 래퍼
 * ==========================================================
 */
function runSyncMTAFunnelToOPS(){

  syncMTAFunnelToOPS_();

}
