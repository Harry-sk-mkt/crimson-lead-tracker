/**
 * ==========================================================
 * Marketing 2.0
 * Revenue Sync (Deal Tracker 외부 스프레드시트 — Email 매칭)
 *
 * Responsibility
 * Deal Tracker(`CONFIG.TARGET.EXTERNAL.DEAL_TRACKER`, 외부 스프레드시트,
 * `readDealTrackerRawRows_()` 캐시)를 Email 기준으로 묶어 Leads_OPS의
 * "Revenue"/"Opportunity Won Date"로 역동기화.
 *
 * WHY (도입 배경, 2026-09-02)
 * Leads_OPS 필드 소유권 재편(사용자 확정) — Revenue가 지금까지
 * `MASTER_003_MTAFunnelSync.js`(MTA_Master 터치 기반)로만 동기화돼,
 * SAL이 겪던 것과 동일한 구조적 문제(그 리드에 새 마케팅 터치가 없으면
 * Salesforce에서 실제로 Revenue/Won이 찍혀도 영원히 반영 안 됨)를 그대로
 * 겪고 있었음 — 특히 Search_OPS(`SEARCH_002_Engine.js`)는 2트랙 아키텍처
 * 예외로 지금도 Leads_OPS 자체의 Revenue/Opportunity Won Date를 그대로
 * 쓰기 때문에 직접 영향을 받음. ACQ_REP/NewP1_REP/Target_REP 등은 이미
 * Deal Tracker를 직접 읽어 이 문제가 없었음(`docs/OpenItems.md` #7) —
 * 같은 소스를 Leads_OPS 레벨에도 적용해 근본 해결.
 *
 * Deal Tracker에는 Lead ID가 없어 `CONFIG.TARGET.EXTERNAL.DEAL_TRACKER.
 * COLUMNS.EMAIL`(V열, 사용자 확인)로 매칭 — Leads_OPS의 Primary Key도
 * Email(`OPS.KEY`)이라 자연스럽게 맞음.
 *
 * **집계 가정(사용자 미검증, 실측 전까지 가정으로 표시)**:
 * 같은 Email이 Deal Tracker에 여러 딜로 나타날 수 있음(재구매/업셀 등) —
 * Revenue는 그 Email의 전체 딜 Revenue **합계**, Opportunity Won Date는
 * 그 중 **가장 최근 Close Date**를 채택한다. Target/ACQ 쪽 집계처럼
 * Upsell/Referral을 제외하지 않음 — 이 필드는 "이 리드가 발생시킨 총
 * 매출"이라는 기존 의미를 그대로 유지하는 게 목적이라 소스만 바뀌고
 * 정의는 안 바뀌어야 한다는 판단(Target_REP의 딜비중용 제외 로직과는
 * 목적이 다름).
 *
 * Master 빌드 없음 / 배치 읽기·쓰기 재사용
 * `MASTER_009_ICFunnelSync.js`/`MASTER_010_SALSync.js`와 동일 아키텍처 —
 * Lead(Email) 단위 최신 스냅샷만 의미가 있어 Master Build 없이 캐시를
 * 직접 읽어 Leads_OPS로 동기화, 컬럼별 배치 read/write는
 * `MASTER_003_MTAFunnelSync.js`의 `computeMTASyncColumnUpdates_()`(범용
 * 순수 함수)를 재사용한다.
 *
 * Must NOT
 * - Leads_OPS의 다른 컬럼(Salesforce 기본 정보, #Touches, IC Booked/
 *   Completed Date, Sales Accepted Date 등) 건드리지 않음
 * - 값이 비어있는(또는 0인) 필드는 기존 OPS 값을 덮어쓰지 않음
 * - CSV Import가 없는 유일한 파이프라인 — `importCsv()`에서 호출하지 않고,
 *   Leads/MTA/IC Funnel/SAL 각 파이프라인 tail이 끝날 때마다
 *   `enqueuePendingPipelineType_(CONFIG.PIPELINE.TYPES.REVENUE)`로 대기열에
 *   편입시켜 자동으로 뒤이어 실행되게 한다(사용자 요청 — "역싱크는
 *   트리거로 비동기", `MASTER_002_PipelineAsync.js` 참고).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-09-02)
 * - 최초 구현. `docs/OpenItems.md` 참고.
 * ==========================================================
 */


/**
 * ==========================================================
 * Compute Revenue By Email (Pure)
 *
 * INPUT
 * dealRows : Object[]  (readDealTrackerRawRows_() 출력 — closeDate/revenue/
 *            email 필드 필요, transformDealTrackerRow_() 형태)
 *
 * OUTPUT
 * Object  { [email]: { revenue, wonDate } }
 *         (computeMTASyncColumnUpdates_()가 기대하는 funnelByLeadId 형태와
 *         동일 — syncColumns의 funnelKey로 조회됨. email이 없는 딜은 제외.)
 *
 * TEST
 * testComputeRevenueByEmail() 참고 — 같은 email 딜 2건이 합산/최신
 * Close Date 채택으로 이어지는지 확인.
 * ==========================================================
 */
function computeRevenueByEmail_(dealRows){

  const groups = {};

  dealRows.forEach(function(row){

    const email = String(row.email || "").trim().toLowerCase();

    if(!email) return;

    if(!groups[email]) groups[email] = [];

    groups[email].push(row);

  });

  const result = {};

  Object.keys(groups).forEach(function(email){

    const rows = groups[email];

    let revenueSum = 0;
    let latestCloseDate = null;

    rows.forEach(function(row){

      revenueSum += Number(row.revenue) || 0;

      const closeDate = row.closeDate;

      if(closeDate instanceof Date && !isNaN(closeDate.getTime())){
        if(!latestCloseDate || closeDate.getTime() > latestCloseDate.getTime()){
          latestCloseDate = closeDate;
        }
      }

    });

    result[email] = {
      revenue: revenueSum,
      wonDate: latestCloseDate
    };

  });

  return result;

}


/**
 * ==========================================================
 * TEST — computeRevenueByEmail_()
 * ==========================================================
 */
function testComputeRevenueByEmail(){

  const dealRows = [
    { email: "a@test.com", revenue: 1000, closeDate: new Date(2026, 5, 1) },
    { email: "a@test.com", revenue: 500, closeDate: new Date(2026, 6, 15) },  // 더 최근 Close Date
    { email: "b@test.com", revenue: 2000, closeDate: new Date(2026, 4, 1) },
    { email: "", revenue: 999, closeDate: new Date(2026, 4, 1) }  // email 없음 → 제외
  ];

  const result = computeRevenueByEmail_(dealRows);

  const pass =
    Object.keys(result).length === 2 &&
    result["a@test.com"].revenue === 1500 &&
    result["a@test.com"].wonDate.getTime() === new Date(2026, 6, 15).getTime() &&
    result["b@test.com"].revenue === 2000;

  Logger.log(
    "testComputeRevenueByEmail: " + (pass ? "PASS" : "FAIL") +
    " result=" + JSON.stringify(result)
  );

}


/**
 * ==========================================================
 * Sync Revenue to Leads_OPS
 * ==========================================================
 */
function syncRevenueToOPS_(){

  const start = new Date();

  Logger.log("======================================");
  Logger.log("Revenue Sync Started");
  Logger.log("======================================");

  //----------------------------------------------------------
  // Read Deal Tracker (캐시, readDealTrackerRawRows_() → DealTracker_Engine)
  //----------------------------------------------------------

  const dealRows = readDealTrackerRawRows_();

  const revenueByEmail = computeRevenueByEmail_(dealRows);

  const emails = Object.keys(revenueByEmail);

  Logger.log("Deal Tracker Rows : " + dealRows.length);
  Logger.log("Unique Emails : " + emails.length);

  //----------------------------------------------------------
  // Read Leads_OPS — Email → Row 매핑
  //----------------------------------------------------------

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const opsSheet = ss.getSheetByName(OPS.SHEET.OPS);

  if(!opsSheet){
    throw new Error(OPS.SHEET.OPS + " sheet not found. buildLeadsOPS() 먼저 실행하세요.");
  }

  const headerMap = getHeaderMap(opsSheet);

  const emailCol = headerMap["Email"];

  if(emailCol === undefined){
    throw new Error("Email column not found in " + OPS.SHEET.OPS);
  }

  const lastRow = opsSheet.getLastRow();

  if(lastRow < OPS.ROWS.DATA_START){
    Logger.log("Leads_OPS has no data rows. Nothing to sync.");
    return;
  }

  const opsEmailValues = opsSheet
    .getRange(OPS.ROWS.DATA_START, emailCol + 1, lastRow - OPS.ROWS.DATA_START + 1, 1)
    .getValues();

  const emailToRow = {};

  opsEmailValues.forEach(function(row, index){

    const email = String(row[0] || "").trim().toLowerCase();

    if(email){
      emailToRow[email] = OPS.ROWS.DATA_START + index;
    }

  });

  //----------------------------------------------------------
  // Sync 실행 — 컬럼별 배치 읽기/쓰기
  // (computeMTASyncColumnUpdates_()는 범용 순수 함수, MASTER_003 참고 —
  // "leadId" 대신 email을 키로 그대로 재사용해도 무방, 순수 ID→row 매핑)
  //----------------------------------------------------------

  const syncFieldMap = {
    "Revenue": "revenue",
    "Opportunity Won Date": "wonDate"
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
    emails, revenueByEmail, emailToRow, syncColumns, OPS.ROWS.DATA_START, existingColumnValues
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
  Logger.log("========== REVENUE SYNC SUMMARY ==========");
  Logger.log("Updated in Leads_OPS : " + updated);
  Logger.log("Not found in Leads_OPS (by Email) : " + notFoundInOPS);
  Logger.log("Time : " + seconds + "s");
  Logger.log("===========================================");

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
 * 수동 실행용 공개 래퍼 (편집기에서 직접 Run — 동기 실행)
 * ==========================================================
 */
function runSyncRevenueToOPS(){

  syncRevenueToOPS_();

}


/**
 * ==========================================================
 * Schedule Revenue Pipeline Tail (백그라운드 트리거 예약)
 *
 * `MASTER_009_ICFunnelSync.js`/`MASTER_010_SALSync.js`와 동일 패턴이되,
 * CSV Import가 없어 `importCsv()`에서 호출되지 않는다 — Leads/MTA/IC
 * Funnel/SAL 각 파이프라인 tail의 finally 블록에서
 * `enqueuePendingPipelineType_(CONFIG.PIPELINE.TYPES.REVENUE)`를 호출해
 * 매번 대기열에 편입시키고, `releasePipelineLockAndProcessQueue_()`가
 * 그 락을 반납하는 시점에 자동으로 이 함수를 트리거한다. 수동 즉시 실행이
 * 필요하면 이 함수를 직접 Run해도 됨(락이 비어있을 때).
 * ==========================================================
 */
function scheduleRevenuePipelineTail_(){

  const locked = !acquirePipelineLock_(CONFIG.PIPELINE.TYPES.REVENUE);

  if(locked){

    enqueuePendingPipelineType_(CONFIG.PIPELINE.TYPES.REVENUE);

    Logger.log(
      "[RevenueSync] Pipeline lock held by another run — queued for automatic retry after it finishes."
    );

    return { backgroundSkipped: true };

  }

  schedulePipelineTail_("runRevenuePipelineTail");

  return { backgroundScheduled: true };

}
