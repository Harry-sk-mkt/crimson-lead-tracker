/**
 * ==========================================================
 * Marketing 2.0
 * IC Funnel Sync
 *
 * Responsibility
 * ICFunnel_Raw(Append 전용, Master 빌드 없음)에서 Lead ID별 최신
 * 레코드를 뽑아 Leads_OPS의 IC Booked Date / IC Completed Date /
 * Opportunity Won Date / Lead Priority(2026-08-28 추가, optional)로
 * 역동기화.
 *
 * WHY (재도입 배경, 2026-08-26)
 * 이 3개 필드는 Lead 레벨 스냅샷이라, `MASTER_003_MTAFunnelSync.js`의
 * MTA_Master(터치 단위) 기반 동기화만으로는 그 리드에 "새 마케팅 터치"가
 * 없으면 Salesforce 쪽 상태가 바뀌어도 영원히 반영이 안 되는 구조적
 * 공백이 있었음(IC Booking/Completion은 대부분 터치 없이 세일즈 내부
 * 프로세스로만 진행됨) — ACQ_REP IC Booked/Complete 구조적 과소집계의
 * 근본 원인으로 확인됨(`docs/OpenItems.md` #32, `docs/ACQReportDesign.md`
 * "이번 달 IC Booked/Complete 구조적 과소집계" 섹션). 터치와 무관하게
 * Lead 단위로 이 3개 필드만 직접 export하는 별도 리포트/파이프라인을
 * 2026-07-21 최초 도입했다가 2026-07-22 MTA_Master 통합으로 대체(제거)됐던
 * 것을, 그 대체가 위 버그의 원인이었음이 확인되어 이 3개 필드 전용으로
 * 재도입함. `MASTER_003_MTAFunnelSync.js`는 이제 Revenue/Sales Accepted
 * Date만 관리 — 두 파이프라인이 같은 필드를 다른 순서로 덮어쓰는 위험을
 * 없애기 위해 필드 소유권을 완전히 분리(사용자 확정).
 *
 * Master 빌드 없음
 * 이 리포트는 Lead 단위 최신 스냅샷만 의미가 있고 터치처럼 이력을 누적
 * 보존할 필요가 없어, Leads/MTA용 Incremental Master Build/정렬/
 * Transformer 없이 Raw를 직접 읽어 바로 Leads_OPS로 동기화한다(옛
 * 08_ICFunnelSync.js와 동일 아키텍처).
 *
 * 배치 읽기/쓰기 재사용
 * 컬럼별 배치 read/write 계산은 `MASTER_003_MTAFunnelSync.js`의
 * `computeMTASyncColumnUpdates_()`(완전히 범용 순수 함수 — MTA 고유
 * 로직 없음)를 그대로 재사용한다. 리드 하나당 개별 setValue() 호출로
 * 인한 성능 문제(MASTER_003 v1.6.0에서 이미 한 차례 실측 발생, 978.95초)를
 * 처음부터 피하면서, 동일 패턴을 중복 구현하지 않기 위함.
 *
 * Must NOT
 * - Leads_OPS의 다른 컬럼(Salesforce 기본 정보, Marketing 관리 컬럼,
 *   Revenue/Sales Accepted Date 포함) 건드리지 않음
 * - 값이 비어있는 필드는 기존 OPS 값을 덮어쓰지 않음
 * - `syncICFunnelToOPS_()`를 `importCsv()`에서 직접(동기) 호출하지 않음 —
 *   반드시 `scheduleICFunnelPipelineTail_()`을 통해 백그라운드 트리거로
 *   실행할 것(아래 v1.1.0 참고)
 *
 * Version
 * v1.3.0
 *
 * Change Log
 * v1.3.0 (2026-09-01)
 * - `scheduleICFunnelPipelineTail_()` 락 충돌 시 `enqueuePendingPipelineType_()`
 *   (MASTER_002_PipelineAsync.js)로 자동 재시도 대기열에 등록하도록 변경
 *   (사용자 요청 — IC→MTA→New Leads 연달아 import 시 중간 타입이 스킵된 채
 *   방치되던 문제 해결). 기존엔 그냥 로그만 남기고 끝났음.
 * v1.2.0 (2026-08-28)
 * - **"Lead Priority" sync 대상 추가(optional)** — `docs/OpenItems.md`
 *   New P1 8월 갭(279 vs 267) 조사 결과, Lead Priority도 IC Booked/
 *   Completed/Won Date와 같은 Lead 레벨 스냅샷 지연 문제를 겪음이 확인됨.
 *   `CONFIG.IC_FUNNEL.COLUMNS.LEAD_PRIORITY`(`CORE_001_Config.js` v1.49.0)
 *   신규, `computeICFunnelByLeadId_()`에 leadPriority 추가(날짜 아님,
 *   parseDate 안 씀). MTA_Master sync(`MASTER_003_MTAFunnelSync.js`
 *   v1.8.0)도 동시에 이 필드를 동기화하게 되므로,
 *   `applyPriorityDowngradeGuard_()`(`UTIL_001_TransformHelper.js` 신규,
 *   "더 높은 Priority만 채택, 다운그레이드 금지" — 사용자 확정)를
 *   computeMTASyncColumnUpdates_() 호출 전에 적용해 두 파이프라인이
 *   순서 무관하게 안전하도록 함. Required Fields엔 미포함 — 사용자가
 *   아직 Salesforce IC Funnel 리포트에 이 컬럼을 추가하지 않은 상태로
 *   재import해도 깨지지 않음(빈 값이면 sync 단계에서 자동 skip).
 * v1.1.0 (2026-08-26)
 * - **버그 수정 — Import 시 실사용 중 실제 발생**: `syncICFunnelToOPS_()`
 *   끝의 7개 Engine refresh(refreshACQSummary_ 등)는 Leads_OPS(3만5천+행)/
 *   MTA_Master(8만+행) 전체를 스캔하는 무거운 함수라, `importCsv()`에서
 *   바로 동기 호출하면 브라우저 업로드 다이얼로그가 오래 안 닫힘 —
 *   "데이터 자체가 작다"는 이유로 동기 호출을 택했었으나 이 refresh
 *   체인만큼은 Leads/MTA와 똑같이 무겁다는 걸 놓친 설계 실수(사용자 실측:
 *   36,464행 전체기간 Import가 끝나지 않는 것처럼 보임). **해결**: 삭제가
 *   아니라 `appendNewLeads()`/`appendNewMTA()`와 동일한 설치형 1회성
 *   백그라운드 트리거 패턴으로 전환 — 신규 `scheduleICFunnelPipelineTail_()`
 *   (본 파일) + `runICFunnelPipelineTail()`(`MASTER_002_PipelineAsync.js`).
 *   `PIPELINE_LOCK`을 Leads/MTA와 공유해 동시 실행 방지. README Pipeline
 *   Status 표는 의도적으로 미반영(LEADS/MTA 2타입 전용 구조라 그대로 얹으면
 *   Leads 상태를 덮어씀) — 범위 최소화, 진행상태는 Executions 로그로 확인.
 * v1.0.0 (2026-08-26)
 * - 최초 구현. `docs/OpenItems.md` #32.
 * ==========================================================
 */


/**
 * ==========================================================
 * Pick Latest Record Per Lead ID
 *
 * WHY
 * ICFunnel_Raw는 Append 전용이라 같은 Lead ID가 여러 주 export에
 * 걸쳐 다시 나올 수 있음 — 배열 순서(= import된 순서)상 가장 나중에
 * 나온 레코드가 가장 최근 Salesforce 상태.
 *
 * INPUT
 * rawRecords : Object[]  (ICFunnel_Raw 전체 레코드)
 *
 * OUTPUT
 * Object  { [leadId]: record }
 *
 * TEST
 * testPickLatestICFunnelRecords() 참고.
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

  Logger.log("testPickLatestICFunnelRecords: " + (pass ? "PASS" : "FAIL"));

}


/**
 * ==========================================================
 * Compute IC Funnel By Lead ID
 *
 * WHY
 * ICFunnel_Raw의 날짜 컬럼은 day-first 텍스트(예: "6/8/2026, 3:05 pm")로
 * Plain Text 보호되어 있음(`CONFIG.RAW_DATE_COLUMNS.IC_FUNNEL`) — Sales
 * Accepted Date와 동일한 locale 오해석 사고를 반복하지 않기 위해
 * 반드시 parseDate(value, "DMY")로 명시 파싱한다(시간 포함 텍스트도
 * parseDate()가 콤마 이후를 잘라내고 처리함).
 *
 * INPUT
 * latestByLeadId : Object  (pickLatestICFunnelRecords_() 출력)
 *
 * OUTPUT
 * Object  { [leadId]: { icBookedDate, icCompletedDate, wonDate, leadPriority } }
 *         (computeMTASyncColumnUpdates_()가 기대하는 funnelByLeadId 형태와
 *         동일 — syncColumns의 funnelKey로 조회됨. leadPriority는 날짜가
 *         아니라 문자열 그대로 통과 — 2026-08-28 추가)
 *
 * TEST
 * testComputeICFunnelByLeadId() 참고 — day-first 파싱이 실제로
 * month/day를 뒤바꾸지 않는지 확인.
 * ==========================================================
 */
function computeICFunnelByLeadId_(latestByLeadId){

  const cols = CONFIG.IC_FUNNEL.COLUMNS;

  const result = {};

  Object.keys(latestByLeadId).forEach(function(leadId){

    const record = latestByLeadId[leadId];

    result[leadId] = {
      icBookedDate: parseDate(record[cols.IC_BOOKED_DATE], "DMY"),
      icCompletedDate: parseDate(record[cols.IC_COMPLETED_DATE], "DMY"),
      wonDate: parseDate(record[cols.OPPORTUNITY_WON_DATE], "DMY"),
      leadPriority: record[cols.LEAD_PRIORITY] || ""
    };

  });

  return result;

}


/**
 * ==========================================================
 * TEST — computeICFunnelByLeadId_()
 * ==========================================================
 */
function testComputeICFunnelByLeadId(){

  const cols = CONFIG.IC_FUNNEL.COLUMNS;

  const latestByLeadId = {};

  latestByLeadId["L1"] = (function(){
    const r = {};
    r[cols.IC_BOOKED_DATE] = "6/8/2026, 3:05 pm";        // 8월 6일 (day-first)
    r[cols.IC_COMPLETED_DATE] = "";                       // 아직 없음
    r[cols.OPPORTUNITY_WON_DATE] = "10/9/2026";           // 9월 10일 (day-first)
    r[cols.LEAD_PRIORITY] = "Priority 1";
    return r;
  })();

  const result = computeICFunnelByLeadId_(latestByLeadId);

  const pass =
    result["L1"].icBookedDate instanceof Date &&
    result["L1"].icBookedDate.getMonth() === 7 &&   // August = index 7
    result["L1"].icBookedDate.getDate() === 6 &&
    result["L1"].icCompletedDate === null &&
    result["L1"].wonDate instanceof Date &&
    result["L1"].wonDate.getMonth() === 8 &&         // September = index 8
    result["L1"].wonDate.getDate() === 10 &&
    result["L1"].leadPriority === "Priority 1";

  Logger.log(
    "testComputeICFunnelByLeadId: " + (pass ? "PASS" : "FAIL") +
    " icBookedDate=" + result["L1"].icBookedDate +
    " wonDate=" + result["L1"].wonDate
  );

}


/**
 * ==========================================================
 * Sync IC Funnel to Leads_OPS
 * ==========================================================
 */
function syncICFunnelToOPS_(){

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

  const funnelByLeadId = computeICFunnelByLeadId_(latestByLeadId);

  const leadIds = Object.keys(funnelByLeadId);

  Logger.log("ICFunnel_Raw Records : " + rawRecords.length);
  Logger.log("Unique Lead IDs (latest only) : " + leadIds.length);

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
  // Sync 실행 — 컬럼별 배치 읽기/쓰기
  // (computeMTASyncColumnUpdates_()는 범용 순수 함수, MASTER_003 참고)
  //----------------------------------------------------------

  const syncFieldMap = {
    "IC Booked Date": "icBookedDate",
    "IC Completed Date": "icCompletedDate",
    "Opportunity Won Date": "wonDate",
    "Lead Priority": "leadPriority"
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

  //----------------------------------------------------------
  // Lead Priority — MTA_Master sync(MASTER_003)와 순서 무관하게
  // 다운그레이드 방지(UTIL_001_TransformHelper.js
  // applyPriorityDowngradeGuard_(), docs/OpenItems.md New P1 8월 갭 조사 참고)
  //----------------------------------------------------------

  const guardedFunnelByLeadId = existingColumnValues["Lead Priority"]
    ? applyPriorityDowngradeGuard_(
        leadIds, funnelByLeadId, leadIdToRow, OPS.ROWS.DATA_START, existingColumnValues["Lead Priority"]
      )
    : funnelByLeadId;

  const syncResult = computeMTASyncColumnUpdates_(
    leadIds, guardedFunnelByLeadId, leadIdToRow, syncColumns, OPS.ROWS.DATA_START, existingColumnValues
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
  Logger.log("========== IC FUNNEL SYNC SUMMARY ==========");
  Logger.log("Updated in Leads_OPS : " + updated);
  Logger.log("Not found in Leads_OPS : " + notFoundInOPS);
  Logger.log("Time : " + seconds + "s");
  Logger.log("=============================================");

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
function runSyncICFunnelToOPS(){

  syncICFunnelToOPS_();

}


/**
 * ==========================================================
 * Schedule IC Funnel Pipeline Tail (백그라운드 트리거 예약)
 *
 * WHY (2026-08-26, 실사용 중 발견)
 * `syncICFunnelToOPS_()` 끝의 7개 Engine refresh는 Leads_OPS(3만5천+행)/
 * MTA_Master(8만+행) 전체를 스캔하는 무거운 함수들이라, `importCsv()`에서
 * 바로 동기 호출하면 브라우저 업로드 다이얼로그가 오래 안 닫힘(사용자 실측 —
 * 36,464행 전체기간 Import가 끝나지 않는 것처럼 보임). `appendNewLeads()`/
 * `appendNewMTA()`(`MASTER_001_IncrementalMasterBuild.js`)가 이미 쓰고 있는
 * 것과 동일한 설치형 1회성 트리거 패턴(`MASTER_002_PipelineAsync.js`)을
 * 그대로 재사용 — `PIPELINE_LOCK`도 공유(같은 PropertiesService 키)해서
 * Leads/MTA 백그라운드 실행과 겹치지 않게 함(둘 다 Leads_OPS/Engine 캐시를
 * 동시에 건드릴 수 있어 순차 실행이 안전).
 *
 * README Pipeline Status 표에는 반영하지 않음(의도적, 범위 최소화) —
 * `writePipelineStatusState_()`가 현재 LEADS/MTA 2개 키만 구분하는 구조라
 * ICFUNNEL 타입을 그대로 넘기면 LEADS 상태를 덮어쓰게 됨(코드 확인 완료).
 * 진행상태가 궁금하면 Apps Script 편집기의 Executions 로그로 확인.
 *
 * OUTPUT
 * { backgroundScheduled: true } | { backgroundSkipped: true }
 * ==========================================================
 */
function scheduleICFunnelPipelineTail_(){

  const locked = !acquirePipelineLock_(CONFIG.PIPELINE.TYPES.ICFUNNEL);

  if(locked){

    enqueuePendingPipelineType_(CONFIG.PIPELINE.TYPES.ICFUNNEL);

    Logger.log(
      "[ICFunnelSync] Pipeline lock held by another run — queued for automatic retry after it finishes."
    );

    return { backgroundSkipped: true };

  }

  schedulePipelineTail_("runICFunnelPipelineTail");

  return { backgroundScheduled: true };

}
