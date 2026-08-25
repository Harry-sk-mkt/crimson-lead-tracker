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
 * 사실상 동일한 기준이라는 게 확인되어, 2026-07-21 별도 ICFunnel_Raw 리포트/
 * 파이프라인(08_ICFunnelSync.js, CONFIG.IC_FUNNEL)을 제거하고 MTA_Master
 * 하나로 SAL + IC Funnel 동기화를 동시에 처리하도록 통합했었음.
 *
 * WHY (2026-08-26 재정정 — IC Booked/Completed/Won Date는 다시 분리)
 * 위 통합이 구조적 과소집계 버그의 원인으로 확인됨: IC Booked/Completed/
 * Won Date는 Lead 레벨 스냅샷이라, 그 리드에 "새 마케팅 터치"가 없으면
 * Salesforce 쪽 상태가 바뀌어도 MTA_Master 기반으로는 영원히 반영이 안 됨
 * (터치와 무관하게 진행되는 세일즈 내부 프로세스가 원인). ICFunnel_Raw +
 * `syncICFunnelToOPS_()`(`MASTER_009_ICFunnelSync.js`)를 이 3개 필드
 * 전용으로 재도입 — 이 파일은 이제 `Revenue`/`Sales Accepted Date`
 * 2개만 계속 관리(둘 다 이미 별개 메커니즘으로 해결된 필드라 이 구조적
 * 문제와 무관, `docs/OpenItems.md` #32 참고).
 *
 * Must NOT
 * - Leads_OPS의 다른 컬럼(Salesforce 기본 정보, Marketing 관리 컬럼) 건드리지 않음
 * - IC Booked Date / IC Completed Date / Opportunity Won Date를 쓰지 않음
 *   (2026-08-26부터 `MASTER_009_ICFunnelSync.js`의 전담 필드)
 *
 * Version
 * v1.7.0
 *
 * Change Log
 * v1.7.0 (2026-08-26)
 * - **IC Booked Date / IC Completed Date / Opportunity Won Date를
 *   syncFieldMap에서 제거** — ICFunnel_Raw 재도입(`MASTER_009_ICFunnelSync.js`,
 *   신규)으로 이관. 두 파이프라인이 같은 필드를 서로 다른 순서로 덮어쓰는
 *   위험을 없애기 위해 소유권을 완전히 분리(사용자 확정). `Revenue`/
 *   `Sales Accepted Date`만 계속 관리. `computeMTAFunnelByLeadId_()` 자체
 *   (대표 터치 계산 로직)는 변경 없음 — 반환 객체에 icBookedDate/
 *   icCompletedDate/wonDate가 남아있어도 이 파일 안에서 더 이상 안 쓰일 뿐
 *   무해(다른 소비처 없음 확인, 불필요한 변경 범위 확장 방지). 배경:
 *   `docs/OpenItems.md` #32, `docs/ACQReportDesign.md` "이번 달 IC
 *   Booked/Complete 구조적 과소집계" 섹션.
 * v1.6.0 (2026-08-18)
 * - **버그 수정 — 리드당 개별 setValue() 호출로 인한 성능 문제(실측
 *   978.95초 ≈ 16.3분)**: `runMTAPipelineTail()` 실행 로그(2026-08-17) 확인
 *   결과 MTA Funnel Sync 하나가 전체 30분 실행시간 예산의 절반 이상을
 *   써버려, 뒤이은 BOFU_OPS Build 단계가 플랫폼 강제종료(Exceeded maximum
 *   execution time)로 잘리고 README Pipeline Status에 "RUNNING"이 영구히
 *   남는 사고로 이어짐(강제종료는 try/catch를 우회해 FAILED로도 못 바뀜).
 *   원인은 `syncMTAFunnelToOPS_()`가 리드 하나당 바뀐 필드마다
 *   `opsSheet.getRange().setValue()`를 개별 호출(8,193개 리드 × 최대 5개
 *   필드 = 수만 번의 개별 Sheets API 호출)하던 구조 — 신규 순수 함수
 *   `computeMTASyncColumnUpdates_()`로 분리해 컬럼별 기존 값을 한 번에
 *   읽고 메모리에서 갱신한 뒤 컬럼당 단일 `setValues()`로 되돌려 쓰는
 *   배치 패턴으로 전환(다른 배치 삭제 수정들과 동일 원칙). `updated`/
 *   `notFoundInOPS` 집계 로직은 동일하게 유지. `testComputeMTASyncColumnUpdates()`
 *   신규.
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
 * Compute MTA Sync Column Updates
 *
 * WHY (2026-08-18, 성능 버그 수정 — 실측 계기)
 * 기존엔 리드 하나당 바뀐 필드마다 opsSheet.getRange().setValue()를
 * 개별 호출했음 — 8,193개 리드(2026-08-17 실행 로그 기준 Updated 건수)
 * × 최대 5개 필드가 전부 개별 Sheets API 호출이 되어 실측 978.95초
 * (약 16.3분)가 걸림. 이 여파로 총 30분 실행시간 예산이 뒤이은
 * BOFU_OPS Build 단계 도중 소진돼 플랫폼 강제종료(Exceeded maximum
 * execution time)로 이어졌고, 강제종료는 try/catch를 우회하므로
 * README Pipeline Status에 "RUNNING"이 영구히 남는 사고가 발생함
 * (docs/OpenItems.md 참고). 컬럼별로 기존 값 배열을 한 번에 읽어와서
 * 메모리에서 갱신한 뒤 컬럼당 단일 setValues() 호출로 되돌려 쓰는
 * 배치 패턴으로 전환(다른 배치 삭제 수정들과 동일 원칙) — Sheet IO
 * 없이 Node 하네스로 테스트 가능하도록 순수 함수로 분리.
 *
 * INPUT
 * leadIds              : string[]  (MTA_Master 기준 전체 unique Lead ID)
 * funnelByLeadId       : Object    (computeMTAFunnelByLeadId_() 출력)
 * leadIdToRow          : Object    ({ [leadId]: 1-indexed sheet row })
 * syncColumns          : { opsFieldName, funnelKey }[]
 * dataStartRow         : number    (OPS.ROWS.DATA_START)
 * existingColumnValues : Object    ({ [opsFieldName]: value[][] } —
 *                        getValues() 결과, dataStartRow부터 시작하는 배열)
 *
 * OUTPUT
 * {
 *   columnValues  : Object   ({ [opsFieldName]: value[][] } — 갱신 반영된
 *                   새 배열, 입력 existingColumnValues는 변경하지 않음)
 *   columnChanged : Object   ({ [opsFieldName]: boolean } — 이 컬럼에
 *                   실제로 쓸 값이 하나라도 있었는지, IO 레이어가
 *                   불필요한 setValues() 호출을 건너뛸 때 사용)
 *   updated       : number   (필드 하나라도 갱신된 리드 수)
 *   notFoundInOPS : number   (Leads_OPS에서 못 찾은 리드 수)
 * }
 *
 * TEST
 * testComputeMTASyncColumnUpdates() 참고 — 값이 있는 필드만 갱신되고
 * 없는/0인 필드는 기존 값 보존, leadIdToRow에 없는 리드는 notFoundInOPS로
 * 집계되며, 입력 배열 자체는 변경되지 않아야 함(순수 함수).
 * ==========================================================
 */
function computeMTASyncColumnUpdates_(
  leadIds, funnelByLeadId, leadIdToRow, syncColumns, dataStartRow, existingColumnValues
){

  const columnValues = {};
  const columnChanged = {};

  syncColumns.forEach(function(col){

    columnValues[col.opsFieldName] = existingColumnValues[col.opsFieldName].map(function(row){
      return row.slice();
    });

    columnChanged[col.opsFieldName] = false;

  });

  let updated = 0;
  let notFoundInOPS = 0;

  leadIds.forEach(function(leadId){

    const sheetRow = leadIdToRow[leadId];

    if(!sheetRow){
      notFoundInOPS++;
      return;
    }

    const funnel = funnelByLeadId[leadId];
    const rowOffset = sheetRow - dataStartRow;

    let rowUpdated = false;

    syncColumns.forEach(function(col){

      const value = funnel[col.funnelKey];

      if(
        value === undefined ||
        value === null ||
        value === "" ||
        value === 0
      ){
        return;
      }

      columnValues[col.opsFieldName][rowOffset][0] = value;
      columnChanged[col.opsFieldName] = true;
      rowUpdated = true;

    });

    if(rowUpdated){
      updated++;
    }

  });

  return {
    columnValues: columnValues,
    columnChanged: columnChanged,
    updated: updated,
    notFoundInOPS: notFoundInOPS
  };

}


/**
 * ==========================================================
 * TEST — computeMTASyncColumnUpdates_()
 * ==========================================================
 */
function testComputeMTASyncColumnUpdates(){

  const leadIds = ["L1", "L2", "L3"];

  const funnelByLeadId = {
    L1: {
      icBookedDate: new Date(2026, 0, 1), icCompletedDate: null,
      wonDate: null, revenue: 0, salesAcceptedDate: null
    },
    L2: {
      icBookedDate: null, icCompletedDate: null,
      wonDate: null, revenue: 5000, salesAcceptedDate: null
    },
    L3: {
      // Leads_OPS에 없는 리드(leadIdToRow에서 의도적으로 누락)
      icBookedDate: null, icCompletedDate: null,
      wonDate: null, revenue: 0, salesAcceptedDate: null
    }
  };

  const leadIdToRow = { L1: 2, L2: 4 }; // dataStartRow=2 기준 offset 0/2, L3는 없음

  const syncColumns = [
    { opsFieldName: "IC Booked Date", funnelKey: "icBookedDate" },
    { opsFieldName: "Revenue", funnelKey: "revenue" }
  ];

  const dataStartRow = 2;

  const existingColumnValues = {
    "IC Booked Date": [["old1"], ["old2"], ["old3"], ["old4"]],
    "Revenue": [[0], [0], [0], [0]]
  };

  const result = computeMTASyncColumnUpdates_(
    leadIds, funnelByLeadId, leadIdToRow, syncColumns, dataStartRow, existingColumnValues
  );

  const icBookedDateForL1 = result.columnValues["IC Booked Date"][0][0];
  const revenueForL2 = result.columnValues["Revenue"][2][0];

  const pass =
    result.updated === 2 &&
    result.notFoundInOPS === 1 &&
    icBookedDateForL1 instanceof Date &&
    icBookedDateForL1.getTime() === new Date(2026, 0, 1).getTime() &&
    result.columnValues["IC Booked Date"][1][0] === "old2" && // L2 IC Booked 미갱신(보존)
    revenueForL2 === 5000 &&
    result.columnValues["Revenue"][0][0] === 0 &&             // L1 Revenue 미갱신(0이라 skip, 보존)
    result.columnChanged["IC Booked Date"] === true &&
    result.columnChanged["Revenue"] === true &&
    existingColumnValues["IC Booked Date"][0][0] === "old1";  // 입력 배열 불변(순수 함수 확인)

  Logger.log(
    "testComputeMTASyncColumnUpdates: " + (pass ? "PASS" : "FAIL") +
    " result=" + JSON.stringify(result)
  );

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
  // Sync 실행 — 컬럼별 배치 읽기/쓰기(성능 최적화, 2026-08-18 v1.6.0)
  //----------------------------------------------------------

  const syncFieldMap = {
    "Revenue": "revenue",
    "Sales Accepted Date": "salesAcceptedDate"
  };

  const syncColumns = Object.keys(syncFieldMap)
    .map(function(opsFieldName){
      return {
        opsFieldName: opsFieldName,
        funnelKey: syncFieldMap[opsFieldName],
        colIndex: headerMap[opsFieldName]
      };
    })
    .filter(function(col){ return col.colIndex !== undefined; });

  const numRows = lastRow - OPS.ROWS.DATA_START + 1;

  const existingColumnValues = {};

  syncColumns.forEach(function(col){
    existingColumnValues[col.opsFieldName] = opsSheet
      .getRange(OPS.ROWS.DATA_START, col.colIndex + 1, numRows, 1)
      .getValues();
  });

  const syncResult = computeMTASyncColumnUpdates_(
    leadIds, funnelByLeadId, leadIdToRow, syncColumns, OPS.ROWS.DATA_START, existingColumnValues
  );

  syncColumns.forEach(function(col){

    if(!syncResult.columnChanged[col.opsFieldName]) return;

    opsSheet
      .getRange(OPS.ROWS.DATA_START, col.colIndex + 1, numRows, 1)
      .setValues(syncResult.columnValues[col.opsFieldName]);

  });

  const updated = syncResult.updated;
  const notFoundInOPS = syncResult.notFoundInOPS;

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
