/**
 * ==========================================================
 * Marketing 2.0
 * NewP1 Report (New P1 Cohort Funnel Report)
 *
 * Responsibility
 * Leads_OPS 단일 소스 기반, New P1 Lead의 획득 시점(Create Date)
 * 코호트 기준 다운스트림 퍼널(SAL/IC Booked/IC Complete/Won) 진행률.
 * Engine(조합 생성) + Aggregates(지표 집계) + Report 생성을 이 파일
 * 하나에서 담당하되, 함수 단위로는 책임을 분리한다 (Article 7).
 *
 * 설계 문서
 * docs/NewP1ReportDesign.md
 *
 * Must NOT
 * - Leads_Master / MTA_Master 조회 (Leads_OPS 단일 소스 원칙)
 *
 * Stage
 * 20 Reporting (NewP1)
 *
 * Version
 * v1.1.0
 *
 * Change Log
 * v1.1.0 (2026-07-22)
 * - Week(Fiscal Week) 축 제거 — 8/1 기준 7일 단위라 캘린더 주(월~일)와
 *   무관하고 매년 시작 요일이 달라져 혼동을 유발한다는 사용자 피드백.
 *   Row 구조를 FY > Month > Segment로 단순화(ACQ_REP과 동일 계층).
 *   Engine/Report 헤더에서 Week 컬럼 제거, Sort Index 공식에서 Week
 *   슬롯 제거, CONFIG.NEWP1.MAX_WEEKS는 더 이상 사용하지 않음(제거하지
 *   않고 보존 — 향후 재도입 가능성 대비).
 * v1.0.0 (2026-07-22)
 * - 최초 구현 (docs/NewP1ReportDesign.md 설계 그대로, Week 포함 버전).
 * ==========================================================
 */


/**
 * ==========================================================
 * Report Area Header (A:M, 13 columns)
 * ==========================================================
 */
const NEWP1_REPORT_HEADERS = [
  "FY", "Month", "Segment",
  "New P1", "SAL", "SAL%",
  "IC Booked", "IC Booked%",
  "IC Complete", "IC Complete%",
  "Won", "Won%",
  "Revenue"
];


/**
 * ==========================================================
 * Engine Sheet Header (A:J, 10 columns)
 * ==========================================================
 */
const NEWP1_ENGINE_HEADERS = [
  "FY", "Month", "Segment", "Sort Index",
  "New P1", "SAL", "IC Booked", "IC Complete", "Won", "Revenue"
];


/**
 * ==========================================================
 * Derive NewP1 Cohort (FY / Month from Create Date)
 *
 * WHY
 * Create Date 하나로부터 코호트 귀속에 필요한 FY/Month를 파생한다.
 * (2026-07-22: Week 축 제거 — 위 Change Log 참고)
 *
 * @param {Date} createDate
 * @return {{fy:number, month:string}|null}
 * ==========================================================
 */
function deriveNewP1Cohort_(createDate){

  if(!(createDate instanceof Date) || isNaN(createDate.getTime())){
    return null;
  }

  const fy = Number(getFiscalYear(createDate).replace("FY", ""));
  const month = getFiscalMonthLabel(createDate);

  return { fy: fy, month: month };

}


/**
 * ==========================================================
 * TEST — deriveNewP1Cohort_()
 * ==========================================================
 */
function testDeriveNewP1Cohort(){

  const result = deriveNewP1Cohort_(new Date(2026, 7, 1));   // 2026-08-01

  const pass =
    result !== null &&
    result.fy === 27 &&
    result.month === "AUG";

  Logger.log(
    "2026-08-01 => " + JSON.stringify(result) +
    " (expected fy=27, month=AUG)"
  );

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

  const invalid = deriveNewP1Cohort_(null);

  Logger.log("invalid date => " + invalid + " (expected null)");
  Logger.log(invalid === null ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute NewP1 Sort Index
 *
 * WHY
 * FY → Month(Fiscal 순서) → Segment(CONFIG.ACQ.SEGMENTS 순서)로
 * 유일한 정렬 순서를 결정한다.
 *
 * @param {number} fy
 * @param {string} month  Fiscal Month Label (예: "AUG")
 * @param {string} segment
 * @param {number} minFY  전체 데이터 중 최소 FY (기준점)
 * @return {number}  -1이면 유효하지 않은 조합
 * ==========================================================
 */
function computeNewP1SortIndex_(fy, month, segment, minFY){

  const monthIndex = CONFIG.ACQ.FISCAL_MONTH_ORDER.indexOf(month);
  const segmentIndex = CONFIG.ACQ.SEGMENTS.indexOf(segment);

  if(monthIndex === -1 || segmentIndex === -1) return -1;

  const fyOffset = fy - minFY;

  if(fyOffset < 0) return -1;

  const segmentCount = CONFIG.ACQ.SEGMENTS.length;

  return (
    (fyOffset * 12 + monthIndex) * segmentCount +
    segmentIndex
  );

}


/**
 * ==========================================================
 * TEST — computeNewP1SortIndex_()
 * ==========================================================
 */
function testComputeNewP1SortIndex(){

  const segmentCount = CONFIG.ACQ.SEGMENTS.length;

  const a = computeNewP1SortIndex_(26, "AUG", CONFIG.ACQ.SEGMENTS[0], 26);
  const b = computeNewP1SortIndex_(26, "AUG", CONFIG.ACQ.SEGMENTS[1], 26);
  const c = computeNewP1SortIndex_(26, "SEP", CONFIG.ACQ.SEGMENTS[0], 26);
  const invalid = computeNewP1SortIndex_(26, "NOT_A_MONTH", CONFIG.ACQ.SEGMENTS[0], 26);

  const pass =
    a === 0 &&
    b === 1 &&
    c === segmentCount &&
    invalid === -1;

  Logger.log("a=" + a + " (expected 0)");
  Logger.log("b=" + b + " (expected 1)");
  Logger.log("c=" + c + " (expected " + segmentCount + ")");
  Logger.log("invalid=" + invalid + " (expected -1)");
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute NewP1 Aggregates
 *
 * WHY
 * Leads_OPS를 1회 스캔(Article 10: Read Once)해서 New P1 코호트별
 * (FY|Month|Segment) 지표를 메모리에서 집계한다. New Leads/SAL/
 * IC Booked/IC Complete/Won/Revenue 전부 이 코호트 필터(유효 Priority
 * = "Priority 1") 안에서만 카운트된다 (docs/NewP1ReportDesign.md §3).
 *
 * @return {Array<Object>}  각 원소: {fy, month, segment, sortIndex,
 *   newP1, sal, icBooked, icComplete, won, revenue}
 * ==========================================================
 */
function computeNewP1Aggregates_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(OPS.SHEET.OPS);

  if(!sheet) return [];

  const records = sheetToObjects(sheet);

  const groups = {};
  let minFY = null;

  records.forEach(function(record){

    if(!isEffectiveP1_(record["Lead Priority"], record["Priority Override"])) return;

    const cohort = deriveNewP1Cohort_(record["Create Date"]);

    if(!cohort) return;

    if(minFY === null || cohort.fy < minFY) minFY = cohort.fy;

    const segment = record["Business Segment"] || "Other";
    const key = cohort.fy + "|" + cohort.month + "|" + segment;

    if(!groups[key]){

      groups[key] = {
        fy: cohort.fy,
        month: cohort.month,
        segment: segment,
        newP1: 0,
        sal: 0,
        icBooked: 0,
        icComplete: 0,
        won: 0,
        revenue: 0
      };

    }

    const g = groups[key];

    g.newP1++;

    const totalICRequests = Number(record["Total IC Requests"]) || 0;

    if(totalICRequests > 0) g.sal++;

    const icBookedDate = record["IC Booked Date"];

    if(icBookedDate instanceof Date && !isNaN(icBookedDate.getTime())) g.icBooked++;

    const icCompleteDate = record["IC Completed Date"];

    if(icCompleteDate instanceof Date && !isNaN(icCompleteDate.getTime())) g.icComplete++;

    const revenueVal = Number(record["Revenue"]) || 0;

    if(revenueVal > 0) g.won++;

    g.revenue += revenueVal;

  });

  if(minFY === null) return [];

  return Object.keys(groups).map(function(key){

    const g = groups[key];

    return {
      fy: g.fy,
      month: g.month,
      segment: g.segment,
      sortIndex: computeNewP1SortIndex_(g.fy, g.month, g.segment, minFY),
      newP1: g.newP1,
      sal: g.sal,
      icBooked: g.icBooked,
      icComplete: g.icComplete,
      won: g.won,
      revenue: g.revenue
    };

  }).filter(function(row){
    return row.sortIndex !== -1;
  });

}


/**
 * ==========================================================
 * Refresh NewP1 Engine (전체 재계산 → NewP1_Engine 시트에 저장)
 *
 * WHY
 * appendNewLeads()/appendNewMTA()/rebuildLeadsMaster()/rebuildMTAMaster()
 * 완료 시 refreshACQSummary_()와 같은 지점에서 함께 호출되어, NewP1_REP
 * 조회가 원본 스캔 없이 항상 빠르게 응답하도록 한다.
 * ==========================================================
 */
function refreshNewP1Engine_(){

  const start = new Date();

  Logger.log(CONFIG.LOG.PREFIX + " NewP1 Engine Refresh Started");

  const aggregates = computeNewP1Aggregates_();

  aggregates.sort(function(a, b){ return a.sortIndex - b.sortIndex; });

  const rows = aggregates.map(function(row){

    return [
      "FY" + String(row.fy).slice(-2),
      row.month,
      row.segment,
      row.sortIndex,
      row.newP1,
      row.sal,
      row.icBooked,
      row.icComplete,
      row.won,
      row.revenue
    ];

  });

  writeNewP1Engine_(rows);

  const seconds = ((new Date() - start) / 1000).toFixed(2);

  Logger.log(
    CONFIG.LOG.PREFIX + " NewP1 Engine Refresh Completed : " +
    rows.length + " rows (" + seconds + "s)"
  );

}


/**
 * ==========================================================
 * TEMP — refreshNewP1Engine_() 수동 실행용 공개 래퍼
 * ==========================================================
 */
function runRefreshNewP1Engine(){

  refreshNewP1Engine_();

}


/**
 * ==========================================================
 * Write NewP1 Engine to Sheet (없으면 생성, 항상 숨김)
 * ==========================================================
 */
function writeNewP1Engine_(rows){

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(CONFIG.NEWP1.ENGINE_SHEET);

  if(!sheet){
    sheet = ss.insertSheet(CONFIG.NEWP1.ENGINE_SHEET);
  }

  sheet.clearContents();

  sheet.getRange(1, 1, 1, NEWP1_ENGINE_HEADERS.length)
    .setValues([NEWP1_ENGINE_HEADERS]);

  if(rows.length > 0){

    sheet.getRange(2, 1, rows.length, NEWP1_ENGINE_HEADERS.length)
      .setValues(rows);

  }

  sheet.hideSheet();

  SpreadsheetApp.flush();

}


/**
 * ==========================================================
 * Read NewP1 Engine Rows
 * ==========================================================
 */
function readNewP1EngineRows_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.NEWP1.ENGINE_SHEET);

  if(!sheet) return [];

  const values = sheet.getDataRange().getValues();

  if(values.length <= 1) return [];

  const rows = [];

  for(let i = 1; i < values.length; i++){

    const row = values[i];

    rows.push({
      fy: Number(String(row[0]).replace("FY", "")),
      month: row[1],
      segment: row[2],
      sortIndex: row[3],
      newP1: row[4],
      sal: row[5],
      icBooked: row[6],
      icComplete: row[7],
      won: row[8],
      revenue: row[9]
    });

  }

  return rows;

}


/**
 * ==========================================================
 * Find NewP1 Fiscal Year Range (Leads_OPS Create Date 기준)
 * ==========================================================
 */
function findNewP1FiscalYearRange_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(OPS.SHEET.OPS);

  let min = null;
  let max = null;

  if(sheet){

    const values = sheet.getDataRange().getValues();

    if(values.length > 1){

      const headers = values[0];
      const colIndex = headers.indexOf("Create Date");

      if(colIndex !== -1){

        for(let i = 1; i < values.length; i++){

          const date = values[i][colIndex];

          if(date instanceof Date && !isNaN(date.getTime())){

            const fyLabel = getFiscalYear(date);
            const fyNum = Number(fyLabel.replace("FY", ""));

            if(min === null || fyNum < min) min = fyNum;
            if(max === null || fyNum > max) max = fyNum;

          }

        }

      }

    }

  }

  const currentFY = Number(getFiscalYear(new Date()).replace("FY", ""));

  if(min === null) min = currentFY;
  if(max === null || max < currentFY) max = currentFY;

  return { min: min, max: max };

}


/**
 * ==========================================================
 * Setup NewP1 Dropdowns (Control Area — FY/Month 목록 + Generate 체크박스)
 * ==========================================================
 */
function setupNewP1Dropdowns_(sheet){

  const range = findNewP1FiscalYearRange_();

  const fyList = [];

  for(let fy = range.min; fy <= range.max; fy++){
    fyList.push("FY" + String(fy).slice(-2));
  }

  const fyRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(fyList, true)
    .setAllowInvalid(false)
    .build();

  const monthRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.ACQ.FISCAL_MONTH_ORDER, true)
    .setAllowInvalid(false)
    .build();

  sheet.getRange(CONFIG.NEWP1.ROWS.CONTROL_VALUE, CONFIG.NEWP1.COLUMNS.START_FY)
    .setDataValidation(fyRule);

  sheet.getRange(CONFIG.NEWP1.ROWS.CONTROL_VALUE, CONFIG.NEWP1.COLUMNS.END_FY)
    .setDataValidation(fyRule);

  sheet.getRange(CONFIG.NEWP1.ROWS.CONTROL_VALUE, CONFIG.NEWP1.COLUMNS.START_MONTH)
    .setDataValidation(monthRule);

  sheet.getRange(CONFIG.NEWP1.ROWS.CONTROL_VALUE, CONFIG.NEWP1.COLUMNS.END_MONTH)
    .setDataValidation(monthRule);

  sheet.getRange(CONFIG.NEWP1.ROWS.CONTROL_VALUE, CONFIG.NEWP1.COLUMNS.GENERATE)
    .insertCheckboxes();

  Logger.log(
    "NewP1 Dropdowns set up. FY range: FY" +
    String(range.min).slice(-2) + " ~ FY" + String(range.max).slice(-2)
  );

}


/**
 * ==========================================================
 * Setup NewP1 Report (최초 1회 수동 실행)
 *
 * WHY
 * NewP1_REP 시트가 아직 없거나 Control/Report 헤더가 없는 최초 상태에서,
 * 시트 생성 + Control Area 헤더 + Report Area 헤더 + 드롭다운을 한 번에
 * 세팅한다. ACQ_REP과 달리 기존에 수동으로 만들어둔 헤더가 없으므로
 * 코드가 직접 헤더까지 작성한다. 헤더 값만 다시 쓰므로 기존에 걸어둔
 * 필터/freeze는 영향받지 않는다.
 * ==========================================================
 */
function setupNewP1Report(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(CONFIG.NEWP1.SHEET);

  if(!sheet){
    sheet = ss.insertSheet(CONFIG.NEWP1.SHEET);
  }

  sheet.getRange(CONFIG.NEWP1.ROWS.CONTROL_HEADER, 1, 1, 5)
    .setValues([[
      "Start FY", "Start Month", "End FY", "End Month", "Generate Report"
    ]]);

  sheet.getRange(CONFIG.NEWP1.ROWS.REPORT_HEADER, 1, 1, NEWP1_REPORT_HEADERS.length)
    .setValues([NEWP1_REPORT_HEADERS]);

  setupNewP1Dropdowns_(sheet);

  Logger.log(CONFIG.LOG.PREFIX + " NewP1_REP sheet initialized.");

}


/**
 * ==========================================================
 * Reverse NewP1 Month Blocks (FY+Month 블록 단위로만 순서 뒤집기)
 *
 * WHY
 * targetRows는 Sort Index 오름차순(오래된 달 → 최신 달) 정렬 상태인데,
 * 리포트에서는 최신 달이 위로 오는 게 보기 편하다. Segment는 실제
 * 데이터에 존재하는 것만 들어있어(전체 7개가 항상 채워지는 게 아님)
 * 블록 크기가 가변이므로, 연속된 행의 (FY, Month) 값이 바뀌는 지점을
 * 블록 경계로 삼는다 (ACQ_REP의 고정 blockSize 방식과 다름).
 *
 * @param {Array<Object>} targetRows  sortIndex 오름차순 정렬된 Engine 행들
 * @return {Array<Object>}
 * ==========================================================
 */
function reverseNewP1MonthBlocks_(targetRows){

  const blocks = [];
  let currentBlock = [];
  let currentKey = null;

  targetRows.forEach(function(row){

    const key = row.fy + "|" + row.month;

    if(key !== currentKey){

      if(currentBlock.length > 0) blocks.push(currentBlock);

      currentBlock = [];
      currentKey = key;

    }

    currentBlock.push(row);

  });

  if(currentBlock.length > 0) blocks.push(currentBlock);

  blocks.reverse();

  return blocks.reduce(function(acc, block){
    return acc.concat(block);
  }, []);

}


/**
 * ==========================================================
 * TEST — reverseNewP1MonthBlocks_()
 * ==========================================================
 */
function testReverseNewP1MonthBlocks(){

  const input = [
    { fy: 26, month: "AUG", label: "Aug-A" },
    { fy: 26, month: "AUG", label: "Aug-B" },
    { fy: 26, month: "SEP", label: "Sep-A" }
  ];

  const result = reverseNewP1MonthBlocks_(input);

  const expectedOrder = ["Sep-A", "Aug-A", "Aug-B"];
  const actualOrder = result.map(function(r){ return r.label; });

  const pass = JSON.stringify(actualOrder) === JSON.stringify(expectedOrder);

  Logger.log("Expected : " + expectedOrder.join(", "));
  Logger.log("Actual   : " + actualOrder.join(", "));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Clear NewP1 Report Area
 * ==========================================================
 */
function clearNewP1ReportArea_(sheet){

  const lastRow = sheet.getLastRow();

  if(lastRow >= CONFIG.NEWP1.ROWS.REPORT_DATA_START){

    sheet.getRange(
      CONFIG.NEWP1.ROWS.REPORT_DATA_START, 1,
      lastRow - CONFIG.NEWP1.ROWS.REPORT_DATA_START + 1,
      NEWP1_REPORT_HEADERS.length
    ).clearContent();

  }

}


/**
 * ==========================================================
 * Generate NewP1 Report (NewP1_Engine 조회만 — 원본 스캔 없음)
 * ==========================================================
 */
function generateNewP1Report_(){

  const start = new Date();

  Logger.log("======================================");
  Logger.log("NewP1 Report Generation Started");
  Logger.log("======================================");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.NEWP1.SHEET);

  if(!sheet){
    throw new Error(CONFIG.NEWP1.SHEET + " sheet not found. setupNewP1Report()를 먼저 실행하세요.");
  }

  //----------------------------------------------------------
  // 1. Read Control Values
  //----------------------------------------------------------

  const controls = sheet
    .getRange(
      CONFIG.NEWP1.ROWS.CONTROL_VALUE, 1, 1,
      CONFIG.NEWP1.COLUMNS.GENERATE
    )
    .getValues()[0];

  const startFY = Number(String(controls[CONFIG.NEWP1.COLUMNS.START_FY - 1]).replace("FY", ""));
  const startMonth = String(controls[CONFIG.NEWP1.COLUMNS.START_MONTH - 1]);
  const endFY = Number(String(controls[CONFIG.NEWP1.COLUMNS.END_FY - 1]).replace("FY", ""));
  const endMonth = String(controls[CONFIG.NEWP1.COLUMNS.END_MONTH - 1]);

  if(startFY > endFY){
    throw new Error("Start FY가 End FY보다 나중입니다. 범위를 확인하세요.");
  }

  //----------------------------------------------------------
  // 2. Read Engine
  //----------------------------------------------------------

  const engineRows = readNewP1EngineRows_();

  if(engineRows.length === 0){

    clearNewP1ReportArea_(sheet);
    Logger.log("NewP1_Engine has no data. refreshNewP1Engine_()을 먼저 실행하세요.");
    return;

  }

  let minFY = engineRows[0].fy;

  engineRows.forEach(function(row){
    if(row.fy < minFY) minFY = row.fy;
  });

  //----------------------------------------------------------
  // 3. Start/End Sort Index 범위 계산
  //----------------------------------------------------------

  const segmentCount = CONFIG.ACQ.SEGMENTS.length;
  const blockSize = segmentCount;

  const startMonthIndex = CONFIG.ACQ.FISCAL_MONTH_ORDER.indexOf(startMonth);
  const endMonthIndex = CONFIG.ACQ.FISCAL_MONTH_ORDER.indexOf(endMonth);

  if(startMonthIndex === -1 || endMonthIndex === -1){
    throw new Error("Start/End Month 조합을 찾을 수 없습니다.");
  }

  const startIndex = ((startFY - minFY) * 12 + startMonthIndex) * blockSize;
  const endIndex = ((endFY - minFY) * 12 + endMonthIndex) * blockSize + blockSize - 1;

  if(endIndex < startIndex){
    throw new Error("Start/End 범위가 올바르지 않습니다.");
  }

  const targetRows = engineRows.filter(function(row){
    return row.sortIndex >= startIndex && row.sortIndex <= endIndex;
  });

  //----------------------------------------------------------
  // 4. 월 블록 단위로 순서 뒤집기 (최신 달이 맨 위로)
  //----------------------------------------------------------

  const reversedTargetRows = reverseNewP1MonthBlocks_(targetRows);

  Logger.log("Report Rows : " + reversedTargetRows.length);

  //----------------------------------------------------------
  // 5. Report Area 작성 (% 컬럼은 여기서 계산, Engine엔 저장 안 함)
  //----------------------------------------------------------

  const outputRows = reversedTargetRows.map(function(row){

    const newP1 = row.newP1;

    return [
      "FY" + String(row.fy).slice(-2),
      row.month,
      row.segment,
      newP1,
      row.sal,
      newP1 > 0 ? row.sal / newP1 : "",
      row.icBooked,
      newP1 > 0 ? row.icBooked / newP1 : "",
      row.icComplete,
      newP1 > 0 ? row.icComplete / newP1 : "",
      row.won,
      newP1 > 0 ? row.won / newP1 : "",
      row.revenue
    ];

  });

  clearNewP1ReportArea_(sheet);

  if(outputRows.length > 0){

    sheet.getRange(
      CONFIG.NEWP1.ROWS.REPORT_DATA_START, 1,
      outputRows.length, NEWP1_REPORT_HEADERS.length
    ).setValues(outputRows);

    applyNewP1ReportStyles_(sheet, outputRows.length);

  }

  SpreadsheetApp.flush();

  const seconds = ((new Date() - start) / 1000).toFixed(2);

  Logger.log("NewP1 Report Generation Completed (" + seconds + "s)");
  Logger.log("======================================");

}


/**
 * ==========================================================
 * Handle NewP1_REP Generate Checkbox Edit
 *
 * WHY
 * GAS는 전역 함수명이 파일 간 중복되면 나중에 로드된 정의가 조용히
 * 덮어쓰므로, onEdit() 자체는 30_ACQReport.js 하나에만 두고 시트
 * 이름으로 분기해서 이 함수를 호출한다 (여기서 onEdit()을 재정의하지 않음).
 * ==========================================================
 */
function handleNewP1ReportGenerateEdit_(e, sheet){

  const row = e.range.getRow();
  const col = e.range.getColumn();

  const isGenerateCell =
    row === CONFIG.NEWP1.ROWS.CONTROL_VALUE &&
    col === CONFIG.NEWP1.COLUMNS.GENERATE;

  if(!isGenerateCell) return;

  if(e.value !== "TRUE") return;

  try {

    generateNewP1Report_();

  } finally {

    sheet.getRange(row, col).setValue(false);

  }

}
