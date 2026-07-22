/**
 * ==========================================================
 * Marketing 2.0
 * ACQ Report
 *
 * Responsibility
 * Cohort 기반 Acquisition Report (Engine + Report 영역)
 *
 * Stage
 * 20 Reporting
 *
 * Version
 * v1.3.0
 *
 * Change Log
 * v1.3.0 (2026-07-21)
 * - Fixed: generateACQReport_() 안에 "Report Area 작성" 블록이
 *   (신규 summaryMap 버전 + 구버전 mtaAgg/opsAgg 버전) 중복 남아있던
 *   문제 수정 — 구버전 블록(6번) 삭제, mtaAgg/opsAgg 미정의 에러 방지.
 * - Fixed: computeMTAAggregates_() / computeOPSAggregates_()가
 *   rangeStart/rangeEndExclusive가 null일 때(= refreshACQSummary_()가
 *   전체 스캔을 요청할 때) 모든 행을 걸러버리던 문제 수정.
 *   `if(rangeStart && rangeEndExclusive){ ... range 체크 ... }`로 감쌈.
 * - generateACQReport_()는 이제 ACQ_Summary 조회만 하며 원본
 *   Master/OPS 스캔을 하지 않음 (실제 스캔은 refreshACQSummary_()가
 *   Append/Sync/Rebuild 시점에 미리 수행).
 * ==========================================================
 */


/**
 * ==========================================================
 * Setup ACQ Dropdowns
 * (변경 없음)
 * ==========================================================
 */
function setupACQDropdowns(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.ACQ.SHEET);

  if(!sheet){
    throw new Error(CONFIG.ACQ.SHEET + " sheet not found.");
  }

  const range = findFiscalYearRange_();

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

  sheet.getRange(CONFIG.ACQ.ROWS.CONTROL_VALUE, CONFIG.ACQ.COLUMNS.START_FY)
    .setDataValidation(fyRule);

  sheet.getRange(CONFIG.ACQ.ROWS.CONTROL_VALUE, CONFIG.ACQ.COLUMNS.END_FY)
    .setDataValidation(fyRule);

  sheet.getRange(CONFIG.ACQ.ROWS.CONTROL_VALUE, CONFIG.ACQ.COLUMNS.START_MONTH)
    .setDataValidation(monthRule);

  sheet.getRange(CONFIG.ACQ.ROWS.CONTROL_VALUE, CONFIG.ACQ.COLUMNS.END_MONTH)
    .setDataValidation(monthRule);

  sheet.getRange(CONFIG.ACQ.ROWS.CONTROL_VALUE, CONFIG.ACQ.COLUMNS.GENERATE)
    .insertCheckboxes();

  Logger.log(
    "ACQ Dropdowns set up. FY range: FY" +
    String(range.min).slice(-2) + " ~ FY" + String(range.max).slice(-2)
  );

}


/**
 * ==========================================================
 * Find Fiscal Year Range (실제 데이터 기준 min/max)
 * (변경 없음)
 * ==========================================================
 */
function findFiscalYearRange_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let min = null;
  let max = null;

  function scan(sheetName, columnName){

    const sheet = ss.getSheetByName(sheetName);
    if(!sheet) return;

    const values = sheet.getDataRange().getValues();
    if(values.length <= 1) return;

    const headers = values[0];
    const colIndex = headers.indexOf(columnName);
    if(colIndex === -1) return;

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

  scan(OPS.SHEET.OPS, "Create Date");
  scan(CONFIG.SHEETS.MTA_MASTER, "MTA Created Date");

  const currentFY = Number(getFiscalYear(new Date()).replace("FY", ""));

  if(min === null) min = currentFY;
  if(max === null || max < currentFY) max = currentFY;

  return { min: min, max: max };

}


/**
 * ==========================================================
 * onEdit Simple Trigger
 * (변경 없음)
 * ==========================================================
 */
function onEdit(e){

  if(!e || !e.range) return;

  const sheet = e.range.getSheet();

  if(sheet.getName() !== CONFIG.ACQ.SHEET) return;

  const row = e.range.getRow();
  const col = e.range.getColumn();

  const isGenerateCell =
    row === CONFIG.ACQ.ROWS.CONTROL_VALUE &&
    col === CONFIG.ACQ.COLUMNS.GENERATE;

  if(!isGenerateCell) return;

  if(e.value !== "TRUE") return;

  try {

    generateACQReport_();

  } finally {

    sheet.getRange(row, col).setValue(false);

  }

}


/**
 * ==========================================================
 * Generate ACQ Report (ACQ_Summary 조회만 — 원본 스캔 없음)
 * ==========================================================
 */
function generateACQReport_(){

  const start = new Date();

  Logger.log("======================================");
  Logger.log("ACQ Report Generation Started");
  Logger.log("======================================");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.ACQ.SHEET);

  if(!sheet){
    throw new Error(CONFIG.ACQ.SHEET + " sheet not found.");
  }

  //----------------------------------------------------------
  // 1. Read Control Values
  //----------------------------------------------------------

  const controls = sheet
    .getRange(
      CONFIG.ACQ.ROWS.CONTROL_VALUE, 1, 1,
      CONFIG.ACQ.COLUMNS.GENERATE
    )
    .getValues()[0];

  const startFY = Number(String(controls[CONFIG.ACQ.COLUMNS.START_FY - 1]).replace("FY", ""));
  const startMonth = String(controls[CONFIG.ACQ.COLUMNS.START_MONTH - 1]);
  const endFY = Number(String(controls[CONFIG.ACQ.COLUMNS.END_FY - 1]).replace("FY", ""));
  const endMonth = String(controls[CONFIG.ACQ.COLUMNS.END_MONTH - 1]);

  if(startFY > endFY){
    throw new Error("Start FY가 End FY보다 나중입니다. 범위를 확인하세요.");
  }

  //----------------------------------------------------------
  // 2. Build Engine — 선택된 Start FY ~ End FY 구간만 생성
  //----------------------------------------------------------

  const engineRows = buildACQEngineRows_(startFY, endFY);

  writeACQEngine_(sheet, engineRows);

  //----------------------------------------------------------
  // 3. Start/End Sort Index 탐색 (base = startFY)
  //----------------------------------------------------------

  const startIndex = computeSortIndex_(startFY, startMonth, startFY);

  const endIndex =
    computeSortIndex_(endFY, endMonth, startFY) +
    CONFIG.ACQ.SEGMENTS.length - 1;

  if(startIndex === -1 || endIndex < startIndex){
    throw new Error("Start/End Month 조합을 Engine에서 찾을 수 없습니다.");
  }

  const targetRows = engineRows.filter(function(row){
    return row.sortIndex >= startIndex && row.sortIndex <= endIndex;
  });

  //----------------------------------------------------------
  // 3.5. 월 블록 단위로 순서 뒤집기 (최신 달이 맨 위로)
  //----------------------------------------------------------

  const reversedTargetRows =
    reverseMonthBlocks_(targetRows, CONFIG.ACQ.SEGMENTS.length);

  Logger.log("Report Rows : " + reversedTargetRows.length);


  //----------------------------------------------------------
  // 4. ACQ Summary 조회 (스캔 없음 — 즉시 응답)
  //----------------------------------------------------------

  const summaryMap = readACQSummaryMap_();

  //----------------------------------------------------------
  // 5. Report Area 작성
  //----------------------------------------------------------

  const outputRows = reversedTargetRows.map(function(row){

    const key = row.fy + "|" + row.month + "|" + row.segment;
    const s = summaryMap[key] || {
      allLeads: 0, allP1: 0, newLeads: 0, newP1: 0,
      sal: 0, icBooked: 0, icComplete: 0, revenue: 0
    };

    return [
      "FY" + String(row.fy).slice(-2),
      row.month,
      row.segment,
      s.allLeads,
      s.allP1,
      s.allLeads > 0 ? s.allP1 / s.allLeads : 0,
      s.newLeads,
      s.allLeads > 0 ? s.newLeads / s.allLeads : 0,
      s.newP1,
      s.newLeads > 0 ? s.newP1 / s.newLeads : 0,
      s.sal,
      s.icBooked,
      s.icComplete,
      s.revenue
    ];

  });

  const lastReportRow = sheet.getLastRow();

  if(lastReportRow >= CONFIG.ACQ.ROWS.REPORT_DATA_START){

    sheet.getRange(
      CONFIG.ACQ.ROWS.REPORT_DATA_START, 1,
      lastReportRow - CONFIG.ACQ.ROWS.REPORT_DATA_START + 1,
      14
    ).clearContent();

  }

  if(outputRows.length > 0){

    sheet.getRange(
      CONFIG.ACQ.ROWS.REPORT_DATA_START, 1,
      outputRows.length, 14
    ).setValues(outputRows);

    applyACQReportStyles_(sheet, outputRows.length);

  }

  SpreadsheetApp.flush();

  const seconds = ((new Date() - start) / 1000).toFixed(2);

  Logger.log("ACQ Report Generation Completed (" + seconds + "s)");
  Logger.log("======================================");

}


/**
 * ==========================================================
 * Build ACQ Engine Rows
 * (변경 없음)
 * ==========================================================
 */
function buildACQEngineRows_(minFY, maxFY){

  const rows = [];

  let sortIndex = 0;

  for(let fy = minFY; fy <= maxFY; fy++){

    CONFIG.ACQ.FISCAL_MONTH_ORDER.forEach(function(month){

      CONFIG.ACQ.SEGMENTS.forEach(function(segment){

        rows.push({
          sortIndex: sortIndex,
          fy: fy,
          month: month,
          segment: segment
        });

        sortIndex++;

      });

    });

  }

  return rows;

}


/**
 * ==========================================================
 * TEST — buildACQEngineRows_()
 * (변경 없음)
 * ==========================================================
 */
function testBuildACQEngineRows(){

  const rows = buildACQEngineRows_(26, 27);

  const expectedCount = 2 * 12 * CONFIG.ACQ.SEGMENTS.length;

  const pass =
    rows.length === expectedCount &&
    rows[0].fy === 26 &&
    rows[0].month === "AUG" &&
    rows[0].segment === CONFIG.ACQ.SEGMENTS[0] &&
    rows[0].sortIndex === 0;

  Logger.log("rows.length : " + rows.length + " (expected " + expectedCount + ")");
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Sort Index for a given FY + Month
 * (변경 없음)
 * ==========================================================
 */
function computeSortIndex_(fy, month, minFY){

  const monthOrder = CONFIG.ACQ.FISCAL_MONTH_ORDER.indexOf(month);

  if(monthOrder === -1) return -1;

  const fyOffset = fy - minFY;

  if(fyOffset < 0) return -1;

  return (fyOffset * 12 * CONFIG.ACQ.SEGMENTS.length) +
         (monthOrder * CONFIG.ACQ.SEGMENTS.length);

}


/**
 * ==========================================================
 * Write ACQ Engine to Sheet
 * (변경 없음)
 * ==========================================================
 */
function writeACQEngine_(sheet, engineRows){

  const startCol = CONFIG.ACQ.ENGINE_START_COL;

  const lastRow = sheet.getLastRow();

  if(lastRow > 0){
    sheet.getRange(1, startCol, Math.max(lastRow, 1), 4).clearContent();
  }

  const values = engineRows.map(function(row){
    return [row.sortIndex, "FY" + String(row.fy).slice(-2), row.month, row.segment];
  });

  if(values.length > 0){
    sheet.getRange(1, startCol, values.length, 4).setValues(values);
  }

  sheet.hideColumns(startCol, 4);

}


/**
 * ==========================================================
 * Compute MTA Aggregates (All Leads / All P1 / SAL)
 *
 * WHY
 * rangeStart/rangeEndExclusive가 둘 다 주어지면 그 기간 밖 행은
 * skip (ACQ Report의 부분 조회용). 둘 다 null/undefined면
 * 전체 스캔 (refreshACQSummary_()의 전체 재계산용).
 *
 * @param {Date|null} rangeStart
 * @param {Date|null} rangeEndExclusive
 * ==========================================================
 */
function computeMTAAggregates_(rangeStart, rangeEndExclusive){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);

  const result = {
    allLeads: {},
    allP1: {},
    sal: {}
  };

  if(!sheet) return result;

  const values = sheet.getDataRange().getValues();

  if(values.length <= 1) return result;

  const headers = values[0];

  const dateCol = headers.indexOf("MTA Created Date");
  const segmentCol = headers.indexOf("Business Segment");
  const priorityCol = headers.indexOf("Lead Priority");
  const recordTypeCol = headers.indexOf("Lead Record Type");

  const hasRangeFilter = !!(rangeStart && rangeEndExclusive);

  for(let i = 1; i < values.length; i++){

    const row = values[i];
    const date = row[dateCol];

    if(!(date instanceof Date) || isNaN(date.getTime())) continue;

    //------------------------------------------------------
    // range가 지정된 경우에만 밖 행 skip. 지정 안 됐으면(null) 전체 사용.
    //------------------------------------------------------
    if(hasRangeFilter){
      if(date < rangeStart || date >= rangeEndExclusive) continue;
    }

    const fy = Number(getFiscalYear(date).replace("FY", ""));
    const month = getFiscalMonthLabel(date);
    const segment = row[segmentCol] || "Other";

    const key = fy + "|" + month + "|" + segment;

    result.allLeads[key] = (result.allLeads[key] || 0) + 1;

    if(String(row[priorityCol]).indexOf("1") !== -1){
      result.allP1[key] = (result.allP1[key] || 0) + 1;
    }

    if(recordTypeCol !== -1 && row[recordTypeCol] === "SAL"){
      result.sal[key] = (result.sal[key] || 0) + 1;
    }

  }

  return result;

}


/**
 * ==========================================================
 * Compute OPS Aggregates (New Leads / New P1 / IC Booked / IC Complete / Revenue)
 *
 * @param {Date|null} rangeStart
 * @param {Date|null} rangeEndExclusive
 * ==========================================================
 */
function computeOPSAggregates_(rangeStart, rangeEndExclusive){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(OPS.SHEET.OPS);

  const result = {
    newLeads: {},
    newP1: {},
    icBooked: {},
    icComplete: {},
    revenue: {}
  };

  if(!sheet) return result;

  const values = sheet.getDataRange().getValues();

  if(values.length <= 1) return result;

  const headers = values[0];

  const dateCol = headers.indexOf("Create Date");
  const segmentCol = headers.indexOf("Business Segment");
  const priorityCol = headers.indexOf("Lead Priority");
  const icBookedCol = headers.indexOf("IC Booked Date");
  const icCompleteCol = headers.indexOf("IC Completed Date");
  const revenueCol = headers.indexOf("Revenue");

  const hasRangeFilter = !!(rangeStart && rangeEndExclusive);

  for(let i = 1; i < values.length; i++){

    const row = values[i];
    const date = row[dateCol];

    if(!(date instanceof Date) || isNaN(date.getTime())) continue;

    if(hasRangeFilter){
      if(date < rangeStart || date >= rangeEndExclusive) continue;
    }

    const fy = Number(getFiscalYear(date).replace("FY", ""));
    const month = getFiscalMonthLabel(date);
    const segment = row[segmentCol] || "Other";

    const key = fy + "|" + month + "|" + segment;

    result.newLeads[key] = (result.newLeads[key] || 0) + 1;

    if(String(row[priorityCol]).indexOf("1") !== -1){
      result.newP1[key] = (result.newP1[key] || 0) + 1;
    }

    const icBookedVal = row[icBookedCol];
    if(icBookedVal instanceof Date && !isNaN(icBookedVal.getTime())){
      result.icBooked[key] = (result.icBooked[key] || 0) + 1;
    }

    const icCompleteVal = row[icCompleteCol];
    if(icCompleteVal instanceof Date && !isNaN(icCompleteVal.getTime())){
      result.icComplete[key] = (result.icComplete[key] || 0) + 1;
    }

    const revenueVal = Number(row[revenueCol]) || 0;
    result.revenue[key] = (result.revenue[key] || 0) + revenueVal;

  }

  return result;

}

/**
 * ==========================================================
 * Reverse Month Blocks (세그먼트 순서는 유지, 월 순서만 최신이 먼저)
 *
 * WHY
 * targetRows는 Sort Index 오름차순(오래된 달 → 최신 달)으로 정렬되어
 * 있는데, 리포트에서는 최신 달이 맨 위로 오는 게 보기 편하다.
 * 다만 각 달 안의 7개 세그먼트 순서(Seminar → ... → Other)는
 * 그대로 유지해야 하므로, "월 블록" 단위로만 순서를 뒤집는다.
 *
 * INPUT
 * targetRows : Object[]  (Sort Index 오름차순 정렬된 Engine 행들)
 * blockSize : Number  (한 달에 해당하는 행 수 = 세그먼트 개수, 보통 7)
 *
 * OUTPUT
 * Object[]  (월 블록만 뒤집힌 배열, 각 블록 내부 순서는 그대로)
 *
 * TEST
 * 입력이 [Aug-A, Aug-B, Sep-A, Sep-B] (blockSize=2)일 때
 * 출력은 [Sep-A, Sep-B, Aug-A, Aug-B] 이어야 함 (블록 내부 A→B 순서 유지)
 * ==========================================================
 */
function reverseMonthBlocks_(targetRows, blockSize){

  const blocks = [];

  for(let i = 0; i < targetRows.length; i += blockSize){
    blocks.push(targetRows.slice(i, i + blockSize));
  }

  blocks.reverse();

  return blocks.reduce(function(acc, block){
    return acc.concat(block);
  }, []);

}


/**
 * ==========================================================
 * TEST — reverseMonthBlocks_()
 * ==========================================================
 */
function testReverseMonthBlocks(){

  const input = [
    { label: "Aug-A" }, { label: "Aug-B" },
    { label: "Sep-A" }, { label: "Sep-B" }
  ];

  const result = reverseMonthBlocks_(input, 2);

  const expectedOrder = ["Sep-A", "Sep-B", "Aug-A", "Aug-B"];
  const actualOrder = result.map(function(r){ return r.label; });

  const pass = JSON.stringify(actualOrder) === JSON.stringify(expectedOrder);

  Logger.log("Expected : " + expectedOrder.join(", "));
  Logger.log("Actual   : " + actualOrder.join(", "));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}