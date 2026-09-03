/**
 * ==========================================================
 * Marketing 2.0
 * SAL Sync (외부 스프레드시트 — SAL_Raw)
 *
 * Responsibility
 * SAL_Raw(전용 외부 스프레드시트, Append 전용, Master 빌드 없음)에서
 * Lead ID별 최신 레코드를 뽑아 Leads_OPS의 "Sales Accepted Date"로
 * 역동기화.
 *
 * WHY (도입 배경, 2026-09-02)
 * SAL(Sales Accepted) 판정은 Salesforce Lead Status가 Nurturing →
 * New (Not Contacted)로 전환된 시각("New (Not Contacted) Date Time"
 * 필드) 기준이다 — Lead 레벨 스냅샷이라 그 리드에 새 마케팅 터치가
 * 없으면 `MASTER_003_MTAFunnelSync.js`(MTA_Master 터치 기반) 경로로는
 * 영원히 갱신 안 됨(`docs/OpenItems.md` #38, SAL 8월 갭 305 vs 243 조사).
 * 이 필드를 `MASTER_009_ICFunnelSync.js`의 ICFunnel_Raw에 편입시켜봤으나,
 * Salesforce IC Funnel 리포트 자체가 이 필드를 export하지 못하는 버그
 * (IC Booked Date 2016~2026 필터 범위 문제로 추정, 리포트 재구성으로도
 * 해결 안 됨 — 잔여 24건, #38 P1 TODO #1)가 있어 사용자가 근본적으로
 * 재설계를 결정: **SAL만 IC Funnel 리포트에서 분리해 별도 Salesforce
 * 리포트("All leads" 범위, IC Booked Date 필터 없음 — 이 리포트에서는
 * 필드가 정상 export됨, TEMPQA_045 실측 확인)로 export하고, 그 Raw
 * 데이터를 메인 스프레드시트가 아닌 전용 외부 스프레드시트(`CONFIG.SAL.
 * EXTERNAL.SPREADSHEET_ID`)에 저장한다.** 메인 스프레드시트 용량이 커져
 * 오픈 속도가 느려지는 문제도 함께 완화하려는 목적(사용자 확인).
 *
 * Master 빌드 없음 / 배치 읽기·쓰기 재사용
 * `MASTER_009_ICFunnelSync.js`와 동일한 아키텍처 — Lead 단위 최신
 * 스냅샷만 의미가 있어 Incremental Master Build 없이 Raw를 직접 읽어
 * Leads_OPS로 동기화하고, 컬럼별 배치 read/write는
 * `MASTER_003_MTAFunnelSync.js`의 `computeMTASyncColumnUpdates_()`(범용
 * 순수 함수)를 그대로 재사용한다.
 *
 * Must NOT
 * - Leads_OPS의 다른 컬럼(Salesforce 기본 정보, Revenue 등) 건드리지 않음
 * - 값이 비어있는 필드는 기존 OPS 값을 덮어쓰지 않음
 * - `syncSALToOPS_()`를 `importCsv()`에서 직접(동기) 호출하지 않음 —
 *   반드시 `scheduleSALPipelineTail_()`을 통해 백그라운드 트리거로 실행할 것
 *   (IC Funnel과 동일 원칙 — Engine refresh 체인이 무거워 업로드 다이얼로그가
 *   오래 안 닫히는 문제 방지)
 *
 * Version
 * v1.3.0
 *
 * Change Log
 * v1.3.0 (2026-09-04)
 * - **Batch Direct Update 전환(성능 개선,
 *   docs/exec-plans/active/2026-09-03-performance-optimization.md #3)** —
 *   `MASTER_009_ICFunnelSync.js` v1.9.0과 동일 원칙/구현 패턴. `syncSALToOPS_()`가
 *   매번 SAL_Raw 전체를 읽던 것을 `CONFIG.PROPERTIES.SAL_LAST_ROW` 체크포인트로
 *   "이번에 새로 Import된 배치"만 읽도록 변경, Leads_OPS 쓰기도
 *   `computeDirectUpdateRowWindow_()`(MASTER_003_MTAFunnelSync.js v1.11.0)로
 *   대상 Lead ID들의 행 범위(연속 구간)만 읽고/쓰도록 변경 —
 *   `computeMTASyncColumnUpdates_()`/`computeSALDeltaLeads_()`는 `dataStartRow`만
 *   이 구간의 시작행으로 바꿔 그대로 재사용(둘 다 무변경).
 * v1.2.0 (2026-09-03)
 * - **"SAL Segment" 신규 — 이벤트 기준(Per-Touch) 독립 분류(사용자 설계
 *   확정)**: ACQ_REP은 NewP1_REP과 달리 코호트가 아니라 "그 달 어떤 채널의
 *   액션에서 퍼널이 이어졌는지"를 보는 리포트라, SAL도 Lead 생성 시점 First
 *   Touch로 고정된 Leads_OPS의 "Business Segment"를 재사용하면 안 된다는
 *   지적(대화 중 확인) — 같은 리드가 New Leads에서는 Search, SAL에서는
 *   BOFU로 잡히는 게 코호트가 아닌 이 리포트에선 올바른 동작. SAL_Raw
 *   자체의 "Last MKT UTM Campaign"/"Last Touch Detail"(`CONFIG.SAL.COLUMNS`
 *   신규 — `parseCsv()`가 CSV 헤더를 전부 record 키로 만들어 이미 SAL_Raw에
 *   저장되고 있던 값)로 `resolveBusinessSegment_()`를 호출해
 *   `computeSALByLeadId_()`에서 `salSegment` 신규 계산, Leads_OPS의 새
 *   "SAL Segment" 컬럼(`OPS_001_Config.js` v2.7)에 별도 기록
 *   (`syncSALToOPS_()` syncFieldMap 추가). `computeSALDeltaLeads_()`의
 *   `segment`도 이제 `salByLeadId[leadId].salSegment`에서 옴 — Leads_OPS
 *   Segment 컬럼 읽기 자체가 불필요해져 인자(`segmentValues`)에서 제거.
 *   `ACQREP_001_Report.js`(`computeOPSAggregates_()`)의 SAL/salWeekly/
 *   salP1Weekly 버킷도 새 "SAL Segment" 컬럼을 읽도록 동시 반영 — 그래야
 *   다음 Leads/MTA Import의 `refreshACQSummary_()`(전체 재계산)가 이 델타
 *   결과를 도로 First Touch 값으로 덮어쓰지 않음. New Leads/New P1/IC
 *   Booked/IC Complete는 기존 "Business Segment"(First Touch) 그대로 유지
 *   (변경 없음).
 * v1.1.0 (2026-09-03)
 * - **엔진 refresh 낭비 제거(`docs/OpenItems.md` #44,
 *   `docs/exec-plans/active/2026-09-02-pipeline-refresh-time-redesign.md`)**:
 *   "Sales Accepted Date"를 실제로 읽는 Engine이 ACQ_Summary 하나뿐임을 확인
 *   (NewP1/Events/BOFU/Search/Content_Engine/Target_Engine 전부 미참조) —
 *   `syncSALToOPS_()` 끝의 `refreshACQSummary_()`/`refreshNewP1Engine_()`/
 *   `refreshEventsEngine_()`/`refreshBOFUEngine_()`/`refreshSearchEngine_()`/
 *   `refreshContentEngine_()`/`refreshTargetActuals_()` 7개 전체 재실행을
 *   `refreshACQSummarySALDelta_()`(ACQREP_002_Summary.js v1.5.0, 신규) 하나로
 *   교체 — Leads_OPS/MTA_Master 전체 재스캔 없이 이번에 바뀐 리드만 반영.
 *   `computeSALDeltaLeads_()` 신규(순수 함수) — "바뀐 리드" 판정과 Business
 *   Segment/Lead Priority 조회를 이 파일이 담당(호출 시점에 이미 읽은 old/new
 *   값 재사용, 추가 스캔 없음).
 * v1.0.0 (2026-09-02)
 * - 최초 구현. `docs/OpenItems.md` #38 P1 TODO #1 참고.
 * ==========================================================
 */


/**
 * ==========================================================
 * Open SAL External Spreadsheet (IO 래퍼)
 *
 * WHY
 * CONFIG.SAL.EXTERNAL.SPREADSHEET_ID가 아직 비어있으면(사용자가 새
 * 스프레드시트를 만들어 ID를 공유하기 전) 추측으로 진행하지 않고 명시적
 * 에러로 실패한다("No Assumptions" 원칙).
 * ==========================================================
 */
function openSALExternalSpreadsheet_(){

  const spreadsheetId = CONFIG.SAL.EXTERNAL.SPREADSHEET_ID;

  if(!spreadsheetId){
    throw new Error(
      "CONFIG.SAL.EXTERNAL.SPREADSHEET_ID가 비어있습니다 — 새 외부 " +
      "스프레드시트를 만들어 ID를 CORE_001_Config.js에 채워넣어야 합니다."
    );
  }

  return SpreadsheetApp.openById(spreadsheetId);

}


/**
 * ==========================================================
 * Pick Latest SAL Records (Lead ID별 시트상 마지막 행 채택)
 *
 * `MASTER_009_ICFunnelSync.js`의 `pickLatestICFunnelRecords_()`와 동일
 * 원칙 — SAL_Raw는 Append 전용이라 같은 Lead ID가 여러 주 export에
 * 중복 등장할 수 있음, 시트상 나중 행(= 나중에 import된 것)을 최신으로
 * 간주.
 *
 * INPUT
 * rawRecords : Object[]  (SAL_Raw 전체 레코드)
 *
 * OUTPUT
 * Object  { [leadId]: record }
 *
 * TEST
 * testPickLatestSALRecords() 참고.
 * ==========================================================
 */
function pickLatestSALRecords_(rawRecords){

  const leadIdField = CONFIG.SAL.COLUMNS.LEAD_ID;

  const latestByLeadId = {};

  rawRecords.forEach(function(record){

    const leadId = String(record[leadIdField] || "").trim();

    if(!leadId) return;

    latestByLeadId[leadId] = record;

  });

  return latestByLeadId;

}


/**
 * ==========================================================
 * TEST — pickLatestSALRecords_()
 * ==========================================================
 */
function testPickLatestSALRecords(){

  const leadIdField = CONFIG.SAL.COLUMNS.LEAD_ID;

  const rawRecords = [];

  rawRecords.push((function(){ const r = {}; r[leadIdField] = "L1"; r.marker = "first"; return r; })());
  rawRecords.push((function(){ const r = {}; r[leadIdField] = "L2"; r.marker = "only"; return r; })());
  rawRecords.push((function(){ const r = {}; r[leadIdField] = "L1"; r.marker = "second (latest)"; return r; })());

  const result = pickLatestSALRecords_(rawRecords);

  const pass =
    Object.keys(result).length === 2 &&
    result["L1"].marker === "second (latest)" &&
    result["L2"].marker === "only";

  Logger.log("testPickLatestSALRecords: " + (pass ? "PASS" : "FAIL"));

}


/**
 * ==========================================================
 * Compute SAL By Lead ID
 *
 * WHY
 * SAL_Raw의 날짜 컬럼도 IC Funnel과 동일하게 day-first 텍스트로
 * Plain Text 보호될 것으로 예상됨(`CONFIG.RAW_DATE_COLUMNS.SAL`) —
 * 반드시 parseDate(value, "DMY")로 명시 파싱한다.
 *
 * salSegment(2026-09-03 신규) — ACQ_REP은 코호트가 아니라 "그 달 어떤
 * 액션에서 퍼널이 이어졌는지"를 보는 이벤트 기준 리포트라, SAL도 Lead
 * 생성 시점 First Touch로 고정된 Leads_OPS의 기존 "Business Segment"를
 * 재사용하면 안 되고 SAL 이벤트 자체의 터치로 독립적으로 분류해야 한다
 * (사용자 설계 확정, 대화 중 확인 — 같은 리드가 New Leads에서는 Search,
 * SAL에서는 BOFU로 잡히는 것이 코호트가 아닌 이 리포트에선 올바른 동작).
 * `resolveBusinessSegment_(campaign, detail, leadSource, category)`를
 * 그대로 재사용하되, 이 SAL 리포트엔 leadSource/category에 대응하는
 * 필드가 없어 ""로 전달한다 — 함수 내부 로직 대부분이 campaign/detail
 * 문자열 매칭이라 leadSource/category 없이도 대부분 분류 가능(다만
 * campaign이 "_contact"/"consult" 계열이면 leadSource 신호가 없어
 * 항상 "BOFU"로 fallback — 기존 프로젝트 전역에 이미 있는 동일한 fallback
 * 규칙, `docs/BusinessSegmentClassification.md` #14 참고).
 *
 * INPUT
 * latestByLeadId : Object  (pickLatestSALRecords_() 출력)
 *
 * OUTPUT
 * Object  { [leadId]: { salesAcceptedDate, salSegment } }
 *         (computeMTASyncColumnUpdates_()가 기대하는 funnelByLeadId 형태와
 *         동일 — syncColumns의 funnelKey로 조회됨)
 *
 * TEST
 * testComputeSALByLeadId() 참고 — day-first 파싱이 실제로 month/day를
 * 뒤바꾸지 않는지, salSegment가 campaign/detail로 정상 분류되는지 확인.
 * ==========================================================
 */
function computeSALByLeadId_(latestByLeadId){

  const cols = CONFIG.SAL.COLUMNS;

  const result = {};

  Object.keys(latestByLeadId).forEach(function(leadId){

    const record = latestByLeadId[leadId];

    result[leadId] = {
      salesAcceptedDate: parseDate(record[cols.SALES_ACCEPTED_DATE], "DMY"),
      salSegment: resolveBusinessSegment_(
        record[cols.LAST_MKT_UTM_CAMPAIGN],
        record[cols.LAST_TOUCH_DETAIL],
        "",
        ""
      )
    };

  });

  return result;

}


/**
 * ==========================================================
 * TEST — computeSALByLeadId_()
 * ==========================================================
 */
function testComputeSALByLeadId(){

  const cols = CONFIG.SAL.COLUMNS;

  const latestByLeadId = {};

  latestByLeadId["L1"] = (function(){
    const r = {};
    r[cols.SALES_ACCEPTED_DATE] = "3/8/2026, 9:00 am";  // 8월 3일 (day-first)
    r[cols.LAST_MKT_UTM_CAMPAIGN] = "kr_core_2025-07-19_stanford-analysis-ebook";
    r[cols.LAST_TOUCH_DETAIL] = "";
    return r;
  })();

  const result = computeSALByLeadId_(latestByLeadId);

  const pass =
    result["L1"].salesAcceptedDate instanceof Date &&
    result["L1"].salesAcceptedDate.getMonth() === 7 &&  // August = index 7
    result["L1"].salesAcceptedDate.getDate() === 3 &&
    result["L1"].salSegment === "Content";  // campaign에 "ebook" 포함

  Logger.log(
    "testComputeSALByLeadId: " + (pass ? "PASS" : "FAIL") +
    " salesAcceptedDate=" + result["L1"].salesAcceptedDate +
    " salSegment=" + result["L1"].salSegment
  );

}


/**
 * ==========================================================
 * Sync SAL to Leads_OPS
 * ==========================================================
 */
function syncSALToOPS_(){

  const start = new Date();

  Logger.log("======================================");
  Logger.log("SAL Sync Started");
  Logger.log("======================================");

  //----------------------------------------------------------
  // Read SAL_Raw — 이번에 새로 Import된 배치만(2026-09-04부터,
  // docs/exec-plans/active/2026-09-03-performance-optimization.md #3,
  // MASTER_009_ICFunnelSync.js v1.9.0과 동일 원칙 — Raw Append-only라
  // 새 배치의 Lead ID는 항상 과거 어떤 레코드보다 최신)
  //----------------------------------------------------------

  const externalFile = openSALExternalSpreadsheet_();
  const rawSheet = externalFile.getSheetByName(CONFIG.SAL.SHEET);

  if(!rawSheet){
    throw new Error(
      CONFIG.SAL.SHEET + " sheet not found in external SAL spreadsheet. " +
      "Import SAL Report 먼저 실행하세요."
    );
  }

  const lastProcessed =
    Number(
      PropertiesService
        .getScriptProperties()
        .getProperty(CONFIG.PROPERTIES.SAL_LAST_ROW)
    ) || 0;

  const totalRaw =
    getRawSheetDataRowCount_(CONFIG.SAL.SHEET, externalFile);

  const newRaw =
    readRawSheetFrom_(CONFIG.SAL.SHEET, lastProcessed, externalFile);

  Logger.log(
    "SAL_Raw Records : " + totalRaw +
    " / Already Processed : " + lastProcessed +
    " / New : " + newRaw.length
  );

  if(newRaw.length === 0){

    Logger.log("No new SAL records to sync.");
    Logger.log("======================================");
    Logger.log("SAL Sync Completed (no-op)");
    Logger.log("======================================");

    return;

  }

  const latestByLeadId = pickLatestSALRecords_(newRaw);

  const salByLeadId = computeSALByLeadId_(latestByLeadId);

  const leadIds = Object.keys(salByLeadId);

  Logger.log("Unique Lead IDs (this batch, latest only) : " + leadIds.length);

  //----------------------------------------------------------
  // Read Leads_OPS — Lead ID → Row 매핑
  //----------------------------------------------------------

  const ss = SpreadsheetApp.getActiveSpreadsheet();
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
  // Sync 실행 — Direct Update(2026-09-04부터, exec-plan #3): 이번 배치
  // Lead ID들의 Leads_OPS 행 범위(연속 구간, computeDirectUpdateRowWindow_()
  // — MASTER_003_MTAFunnelSync.js 신규 공용 함수)만 읽고/쓴다.
  // computeMTASyncColumnUpdates_()는 dataStartRow만 이 window의 startRow로
  // 바꾸면 그대로 재사용 가능(무변경).
  //----------------------------------------------------------

  const window = computeDirectUpdateRowWindow_(leadIds, leadIdToRow);

  if(!window){

    PropertiesService
      .getScriptProperties()
      .setProperty(
        CONFIG.PROPERTIES.SAL_LAST_ROW,
        String(totalRaw)
      );

    Logger.log("이번 배치의 Lead ID가 Leads_OPS에 하나도 없음 — sync할 대상 없음.");
    Logger.log("======================================");
    Logger.log("SAL Sync Completed (no matching OPS rows)");
    Logger.log("======================================");

    return;

  }

  const syncFieldMap = {
    "Sales Accepted Date": "salesAcceptedDate",
    "SAL Segment": "salSegment"
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

  const existingColumnValues = {};

  syncColumns.forEach(function(col){
    existingColumnValues[col.opsFieldName] = opsSheet
      .getRange(window.startRow, col.colIndex + 1, window.numRows, 1)
      .getValues();
  });

  //----------------------------------------------------------
  // ACQ_Summary 델타 갱신용 — Lead Priority 조회
  // (2026-09-03, refreshACQSummarySALDelta_() 참고. 이번 리드들의 old/new
  // Sales Accepted Date는 이미 위에서 읽었으니 추가 스캔 없이 재사용. Segment는
  // 더 이상 Leads_OPS를 읽지 않음 — salByLeadId[leadId].salSegment(SAL 이벤트
  // 자체의 터치로 독립 분류된 값, computeSALByLeadId_ 참고)를 그대로 씀 —
  // Leads_OPS의 기존 "Business Segment"는 Lead 생성 시점 First Touch로 고정된
  // 값이라 이벤트 기준 리포트인 ACQ_REP의 SAL 취지와 다름(사용자 설계 확정).
  //----------------------------------------------------------

  const priorityCol = headerMap["Lead Priority"];
  const priorityOverrideCol = headerMap["Priority Override"];

  const priorityValues = priorityCol !== undefined
    ? opsSheet.getRange(window.startRow, priorityCol + 1, window.numRows, 1).getValues()
    : null;

  const priorityOverrideValues = priorityOverrideCol !== undefined
    ? opsSheet.getRange(window.startRow, priorityOverrideCol + 1, window.numRows, 1).getValues()
    : null;

  const deltaLeads = computeSALDeltaLeads_(
    leadIds,
    leadIdToRow,
    window.startRow,
    existingColumnValues["Sales Accepted Date"],
    salByLeadId,
    priorityValues,
    priorityOverrideValues
  );

  const syncResult = computeMTASyncColumnUpdates_(
    leadIds, salByLeadId, leadIdToRow, syncColumns, window.startRow, existingColumnValues
  );

  syncColumns.forEach(function(col){

    if(!syncResult.columnChanged[col.opsFieldName]) return;

    opsSheet
      .getRange(window.startRow, col.colIndex + 1, window.numRows, 1)
      .setValues(syncResult.columnValues[col.opsFieldName]);

  });

  const updated = syncResult.updated;
  const notFoundInOPS = syncResult.notFoundInOPS;

  PropertiesService
    .getScriptProperties()
    .setProperty(
      CONFIG.PROPERTIES.SAL_LAST_ROW,
      String(totalRaw)
    );

  const seconds = ((new Date() - start) / 1000).toFixed(2);

  Logger.log("");
  Logger.log("========== SAL SYNC SUMMARY ==========");
  Logger.log("Updated in Leads_OPS : " + updated);
  Logger.log("Not found in Leads_OPS : " + notFoundInOPS);
  Logger.log("Compared window : " + window.numRows + " rows (of " + (lastRow - OPS.ROWS.DATA_START + 1) + " total OPS rows)");
  Logger.log("Time : " + seconds + "s");
  Logger.log("=======================================");

  refreshACQSummarySALDelta_(deltaLeads);

}


/**
 * ==========================================================
 * Compute SAL Delta Leads (순수 함수)
 *
 * WHY
 * `refreshACQSummarySALDelta_()`(ACQREP_002_Summary.js)에 넘길 "이번에
 * Sales Accepted Date가 실제로 바뀐 리드" 목록을 계산 — SAL Sync가 이미 읽어둔
 * old(existingSalesAcceptedValues)/new(salByLeadId) 값을 그대로 재사용하므로
 * 추가 Leads_OPS 스캔이 없다. 값이 같으면(변화 없음) 목록에서 제외해 델타
 * 계산량을 최소화.
 *
 * segment(2026-09-03 변경) — 더 이상 Leads_OPS의 "Business Segment" 컬럼을
 * 읽지 않는다. `salByLeadId[leadId].salSegment`(SAL_Raw 자체의 Last MKT UTM
 * Campaign/Last Touch Detail로 `computeSALByLeadId_()`가 독립 분류한 값)를
 * 그대로 씀 — ACQ_REP은 이벤트 기준 리포트라 SAL도 SAL 이벤트 자체의 터치로
 * 분류해야 한다는 설계 확정(사용자 확인). 이 변경으로 Leads_OPS Segment 컬럼
 * 읽기 자체가 불필요해져 인자에서 제거.
 *
 * INPUT
 * leadIds : string[]  (SAL_Raw 전체 Lead ID)
 * leadIdToRow : Object  { [leadId]: rowNumber }
 * dataStartRow : number
 * existingSalesAcceptedValues : Array[]  (Sales Accepted Date 컬럼, 변경 전 값)
 * salByLeadId : Object  { [leadId]: { salesAcceptedDate, salSegment } }
 * priorityValues/priorityOverrideValues : Array[] | null
 *   (해당 컬럼이 Leads_OPS에 없으면 null — 방어적으로 빈 문자열 처리)
 *
 * OUTPUT
 * Object[]  { segment, priority, priorityOverride, oldDate, newDate }
 *
 * TEST
 * testComputeSALDeltaLeads() 참고
 * ==========================================================
 */
function computeSALDeltaLeads_(
  leadIds, leadIdToRow, dataStartRow,
  existingSalesAcceptedValues, salByLeadId,
  priorityValues, priorityOverrideValues
){

  const deltaLeads = [];

  leadIds.forEach(function(leadId){

    const row = leadIdToRow[leadId];
    if(row === undefined) return;

    const rowIndex = row - dataStartRow;

    const oldDate = existingSalesAcceptedValues[rowIndex][0];
    const newDate = salByLeadId[leadId].salesAcceptedDate;

    const oldValid = oldDate instanceof Date && !isNaN(oldDate.getTime());
    const newValid = newDate instanceof Date && !isNaN(newDate.getTime());

    if(!newValid) return;  // SAL sync는 값을 비우지 않음(기존 원칙)
    if(oldValid && oldDate.getTime() === newDate.getTime()) return;  // 변화 없음

    deltaLeads.push({
      segment: salByLeadId[leadId].salSegment || "",
      priority: priorityValues ? (priorityValues[rowIndex][0] || "") : "",
      priorityOverride: priorityOverrideValues ? (priorityOverrideValues[rowIndex][0] || "") : "",
      oldDate: oldValid ? oldDate : null,
      newDate: newDate
    });

  });

  return deltaLeads;

}


/**
 * ==========================================================
 * TEST — computeSALDeltaLeads_()
 * ==========================================================
 */
function testComputeSALDeltaLeads(){

  const leadIds = ["L1", "L2", "L3"];

  const leadIdToRow = { "L1": 2, "L2": 3, "L3": 4 };  // L3는 아래서 존재 안 함 취급

  const existingSalesAcceptedValues = [
    [""],                        // L1 — 기존 값 없음
    [new Date(2026, 6, 1)]       // L2 — 기존 값 있음, 동일 값으로 재동기화될 예정
  ];

  const salByLeadId = {
    "L1": { salesAcceptedDate: new Date(2026, 7, 15), salSegment: "Content" },   // 신규
    "L2": { salesAcceptedDate: new Date(2026, 6, 1), salSegment: "BOFU" },       // 변화 없음
    "L3": { salesAcceptedDate: new Date(2026, 7, 1), salSegment: "Search" }      // Leads_OPS에 없는 리드
  };

  const priorityValues = [["Priority 1"], [""]];
  const priorityOverrideValues = [[""], [""]];

  const result = computeSALDeltaLeads_(
    leadIds, leadIdToRow, 2,
    existingSalesAcceptedValues, salByLeadId,
    priorityValues, priorityOverrideValues
  );

  const pass =
    result.length === 1 &&                      // L2(변화 없음)/L3(OPS에 없음) 제외, L1만 남음
    result[0].segment === "Content" &&           // salByLeadId.salSegment(SAL 이벤트 자체 분류)에서 옴 — Leads_OPS Segment 아님
    result[0].oldDate === null &&
    result[0].newDate.getTime() === new Date(2026, 7, 15).getTime();

  Logger.log("testComputeSALDeltaLeads: " + (pass ? "PASS" : "FAIL") + " " + JSON.stringify(result));

}


/**
 * ==========================================================
 * 수동 실행용 공개 래퍼 (편집기에서 직접 Run — 동기 실행)
 * ==========================================================
 */
function runSyncSALToOPS(){

  syncSALToOPS_();

}


/**
 * ==========================================================
 * Schedule SAL Pipeline Tail (백그라운드 트리거 예약)
 *
 * `MASTER_009_ICFunnelSync.js`의 `scheduleICFunnelPipelineTail_()`와
 * 동일 패턴 — `syncSALToOPS_()` 끝의 Engine refresh들이 무거워 업로드
 * 다이얼로그가 오래 안 닫히는 문제를 피하기 위해 설치형 1회성 트리거로
 * 백그라운드 처리. PIPELINE_LOCK은 Leads/MTA/IC Funnel과 공유(같은
 * PropertiesService 키) — 넷 중 어느 것이 실행 중이어도 나머지는 겹치지
 * 않게 스킵/대기열(`enqueuePendingPipelineType_()`)됨.
 * ==========================================================
 */
function scheduleSALPipelineTail_(){

  const locked = !acquirePipelineLock_(CONFIG.PIPELINE.TYPES.SAL);

  if(locked){

    enqueuePendingPipelineType_(CONFIG.PIPELINE.TYPES.SAL);

    Logger.log(
      "[SALSync] Pipeline lock held by another run — queued for automatic retry after it finishes."
    );

    return { backgroundSkipped: true };

  }

  schedulePipelineTail_("runSALPipelineTail");

  return { backgroundScheduled: true };

}
