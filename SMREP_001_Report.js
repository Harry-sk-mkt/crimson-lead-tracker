/**
 * ==========================================================
 * Marketing 2.0
 * S&M_REP (Sales & Marketing Weekly Dashboard)
 *
 * Responsibility
 * Leads_OPS/MTA_Master를 주간(월~일) 단위로 집계해 리드 유입량과 SAL
 * 전환량을 세그먼트별로 보여주는 대시보드. Target_REP과 동일한 "FY 하나
 * 선택 → 그 FY의 전체 주가 행"구조(TARGET_001_Engine.js의
 * getMondayOfWeek_()/generateCalendarWeeksForFY_() 재사용).
 *
 * 지표 정의 (2026-08-18 사용자 확정)
 * - All Leads   : 그 주(MTA Created Date 기준) MTA_Master 터치 행 자체의
 *                 개수(unique Lead ID 아님, 터치 row count 그대로).
 * - New Leads   : 그 주(Create Date 기준) Leads_OPS 리드 수
 *                 (ACQ_REP computeOPSAggregates_()의 "New Leads"와 동일 정의).
 * - New P1      : New Leads 중 isEffectiveP1_() true인 리드 수.
 * - Event/BOFU/Content/Organic/Referral : New Leads 중 New P1(isEffectiveP1_()
 *                 true)인 리드만 Business Segment로 분해(CONFIG.SM_REP.
 *                 LEADS_SEGMENT_BUCKET_MAP) — 2026-08-24부터 New P1 필터 추가
 *                 (사용자 확정: 이 breakdown은 New P1 구성을 보기 위한 것). 매핑에
 *                 없는 Segment(예: Search)는 어느 breakdown 컬럼에도 안 잡힘 —
 *                 의도된 설계(00_Config.js 주석 참고).
 * - All SAL     : 그 주(Sales Accepted Date 기준) Leads_OPS 리드 수
 *                 (ACQ_REP의 "SAL"과 동일 정의).
 * - P1(SAL)     : All SAL 중 isEffectiveP1_() true인 리드 수.
 * - BOFU/Search/Organic/Referral(SAL) : All SAL 중 P1(SAL)(isEffectiveP1_()
 *                 true)인 리드만 Business Segment로 분해(CONFIG.SM_REP.
 *                 SAL_SEGMENT_BUCKET_MAP) — 2026-09-01부터 P1 필터 추가(사용자
 *                 요청, Leads 블록과 동일하게 P1 구성만 노출). breakdown
 *                 세그먼트 구성 자체는 Leads 블록과 여전히 다름(Content/Event
 *                 없음, Search 있음 — 사용자 확정, 의도된 비대칭).
 * - Organic     : 두 블록 공통 — Business Segment가 "Other" 또는 "N/A"
 *                 (유료 캠페인으로 분류 안 된 유입).
 *
 * Must NOT
 * - Leads_OPS/MTA_Master 원본을 수정하지 않는다(읽기 전용).
 *
 * Stage
 * 20 Reporting
 *
 * Version
 * v1.2.0
 *
 * Change Log
 * v1.2.0 (2026-09-01)
 * - SAL 블록 breakdown(BOFU/Search/Organic/Referral)에도 P1 필터 추가(사용자
 *   요청 — "SAL의 BOFU/Search/Organic/Referral 세그먼트는 P1 숫자만 보이도록").
 *   v1.1.0에서 Leads 블록에 적용했던 것과 동일 원칙을 SAL 블록에도 적용
 *   (`computeSMRepWeeklyAggregates_()`, `if(bucket) ...` → `if(bucket && isP1) ...`).
 *   컬럼 헤더(BOFU/Search/Organic/Referral)는 변경 없음 — 집계 대상만
 *   All SAL 전체 → P1(SAL)로 좁힘. 회귀 테스트: `testComputeSMRepWeeklyAggregates()` 갱신.
 * v1.1.0 (2026-08-24)
 * - Leads 블록 breakdown(Event/BOFU/Content/Organic/Referral)에 New P1 필터
 *   추가 — 사용자 확정: 이 breakdown은 "New P1의 세그먼트 구성"을 보기 위한
 *   것이라 New Leads 전체가 아니라 New P1만 집계해야 함
 *   (`computeSMRepWeeklyAggregates_()`, `if(bucket) ...` → `if(bucket && isP1) ...`).
 *   SAL 블록 breakdown(BOFU/Search/Organic/Referral)은 변경 없음(All SAL 전체
 *   유지). 회귀 테스트: `testComputeSMRepWeeklyAggregates()` 갱신.
 * v1.0.0 (2026-08-18)
 * - 최초 구현. 사용자 요청으로 신규 리포트 생성.
 * ==========================================================
 */


/**
 * ==========================================================
 * Compute S&M_REP Weekly Aggregates (Leads_OPS/MTA_Master 각 1회 스캔)
 *
 * WHY
 * All Leads(MTA_Master)와 New Leads/New P1/SAL(Leads_OPS)은 소스 시트가
 * 다르고 각자 다른 날짜 컬럼(MTA Created Date / Create Date / Sales
 * Accepted Date) 기준으로 주가 갈리므로, 한 번의 스캔으로 모든 걸 처리할
 * 수 없다 — 시트별로 정확히 1회씩만 스캔(Article 10: Read Once)하고
 * 결과를 weekKey 기준으로 병합한다. Sheet IO 없이 Node 하네스로 테스트
 * 가능하도록 순수 함수로 분리(다른 *_By_Week_() 계열 함수와 동일 패턴,
 * TARGET_002_Report.js computeTargetActualP1ByWeek_() 참고).
 *
 * INPUT
 * leadsOpsRecords : Object[]  (sheetToObjects(Leads_OPS 시트) 결과)
 * mtaRecords      : Object[]  (sheetToObjects(MTA_Master 시트) 결과)
 * weekStarts      : Date[]    (리포트에 나열될 모든 Week Start, 월요일)
 *
 * OUTPUT
 * Object  "yyyy-MM-dd"(Week Start) -> {
 *   allLeads, newLeads, newP1,
 *   leadsBreakdown: { Event, BOFU, Content, Organic, Referral }  (New P1만 집계, 2026-08-24부터),
 *   allSAL, salP1,
 *   salBreakdown: { BOFU, Search, Organic, Referral }  (P1(SAL)만 집계, 2026-09-01부터)
 * }
 * (해당 주에 매칭되는 데이터가 하나도 없으면 그 키 자체가 없음 —
 * buildSMRepDataRows_()가 기본값으로 채움)
 *
 * TEST
 * testComputeSMRepWeeklyAggregates() 참고
 * ==========================================================
 */
function computeSMRepWeeklyAggregates_(leadsOpsRecords, mtaRecords, weekStarts){

  const toKey = function(date){
    return Utilities.formatDate(date, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd");
  };

  const validKeys = {};

  weekStarts.forEach(function(date){
    if(date instanceof Date) validKeys[toKey(date)] = true;
  });

  const leadsMap = CONFIG.SM_REP.LEADS_SEGMENT_BUCKET_MAP;
  const salMap = CONFIG.SM_REP.SAL_SEGMENT_BUCKET_MAP;

  const result = {};

  function ensureRow(key){

    if(!result[key]){
      result[key] = {
        allLeads: 0, newLeads: 0, newP1: 0,
        leadsBreakdown: { Event: 0, BOFU: 0, Content: 0, Organic: 0, Referral: 0 },
        allSAL: 0, salP1: 0,
        salBreakdown: { BOFU: 0, Search: 0, Organic: 0, Referral: 0 }
      };
    }

    return result[key];

  }

  //----------------------------------------------------------
  // All Leads — MTA_Master 터치 행 개수 (MTA Created Date 기준 주)
  //----------------------------------------------------------

  mtaRecords.forEach(function(record){

    const mtaCreated = record["MTA Created Date"];

    if(!(mtaCreated instanceof Date) || isNaN(mtaCreated.getTime())) return;

    const key = toKey(getMondayOfWeek_(mtaCreated));

    if(!validKeys[key]) return;

    ensureRow(key).allLeads++;

  });

  //----------------------------------------------------------
  // New Leads/New P1/breakdown(Create Date) + All SAL/P1/breakdown
  // (Sales Accepted Date) — Leads_OPS 1회 스캔
  //----------------------------------------------------------

  leadsOpsRecords.forEach(function(record){

    const segment = String(record["Business Segment"] || "").trim();
    const isP1 = isEffectiveP1_(record["Lead Priority"], record["Priority Override"]);

    const createDate = record["Create Date"];

    if(createDate instanceof Date && !isNaN(createDate.getTime())){

      const key = toKey(getMondayOfWeek_(createDate));

      if(validKeys[key]){

        const row = ensureRow(key);

        row.newLeads++;

        if(isP1) row.newP1++;

        const bucket = leadsMap[segment];

        if(bucket && isP1) row.leadsBreakdown[bucket]++;

      }

    }

    const salDate = record["Sales Accepted Date"];

    if(salDate instanceof Date && !isNaN(salDate.getTime())){

      const key = toKey(getMondayOfWeek_(salDate));

      if(validKeys[key]){

        const row = ensureRow(key);

        row.allSAL++;

        if(isP1) row.salP1++;

        const bucket = salMap[segment];

        if(bucket && isP1) row.salBreakdown[bucket]++;

      }

    }

  });

  return result;

}


/**
 * ==========================================================
 * TEST — computeSMRepWeeklyAggregates_()
 * ==========================================================
 */
function testComputeSMRepWeeklyAggregates(){

  // 2026-07-27(월)~08-02(일) 주 하나만 유효 주로 등록
  const weekStart = new Date(2026, 6, 27);
  const weekStarts = [weekStart];

  const mtaRecords = [
    { "MTA Created Date": new Date(2026, 6, 28) },  // 유효 주 안(화요일)
    { "MTA Created Date": new Date(2026, 6, 28) },  // 같은 Lead라도 터치 행이면 각각 카운트
    { "MTA Created Date": new Date(2026, 6, 20) },  // 유효 주 밖 — 제외
    { "MTA Created Date": null }                    // 날짜 없음 — 제외
  ];

  const leadsOpsRecords = [
    // New Leads(Create Date 주 안) + New P1 + Event(Seminar)
    {
      "Create Date": new Date(2026, 6, 27), "Sales Accepted Date": null,
      "Business Segment": "Seminar", "Lead Priority": "Priority 1", "Priority Override": ""
    },
    // New Leads + Search(=Leads 블록 breakdown 매핑 없음 — 어느 컬럼에도 안 잡힘)
    {
      "Create Date": new Date(2026, 6, 30), "Sales Accepted Date": null,
      "Business Segment": "Search", "Lead Priority": "Priority 2", "Priority Override": ""
    },
    // Create Date는 유효 주 밖이지만 Sales Accepted Date가 유효 주 안 —
    // All SAL/P1/BOFU(SAL)로만 잡혀야 함
    {
      "Create Date": new Date(2026, 5, 1), "Sales Accepted Date": new Date(2026, 6, 29),
      "Business Segment": "BOFU", "Lead Priority": "Priority 1", "Priority Override": ""
    },
    // Referral, Create/SAL 둘 다 유효 주 안이지만 Priority 3(P1 아님) —
    // leadsBreakdown(New P1 필터 적용)에는 안 잡히고 salBreakdown(필터 없음)에는 잡혀야 함
    {
      "Create Date": new Date(2026, 6, 27), "Sales Accepted Date": new Date(2026, 6, 27),
      "Business Segment": "Referral", "Lead Priority": "Priority 3", "Priority Override": ""
    }
  ];

  const result = computeSMRepWeeklyAggregates_(leadsOpsRecords, mtaRecords, weekStarts);

  const key = Utilities.formatDate(weekStart, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd");
  const row = result[key];

  const pass =
    row.allLeads === 2 &&
    row.newLeads === 3 &&
    row.newP1 === 1 &&  // Search 리드(Priority 2)는 P1 아님, BOFU 리드는 Create Date가 유효 주 밖
    row.leadsBreakdown.Event === 1 &&   // Seminar 리드, Priority 1 — New P1이라 잡힘
    row.leadsBreakdown.Referral === 0 &&  // Referral 리드는 Priority 3(P1 아님) — New P1 필터로 제외(2026-08-24부터)
    row.leadsBreakdown.BOFU === 0 &&   // Search는 Leads 블록 매핑 없음(BOFU 아님, 어디에도 안 잡힘)
    row.allSAL === 2 &&
    row.salP1 === 1 &&
    row.salBreakdown.BOFU === 1 &&
    row.salBreakdown.Referral === 0;  // Referral 리드는 Priority 3(P1 아님) — SAL 블록 breakdown도 New P1 필터 적용(2026-09-01부터)으로 제외

  Logger.log(
    "testComputeSMRepWeeklyAggregates: " + (pass ? "PASS" : "FAIL") +
    " row=" + JSON.stringify(row)
  );

}


/**
 * ==========================================================
 * Build S&M_REP Data Rows (순수 함수)
 *
 * WHY
 * computeSMRepWeeklyAggregates_() 결과(매칭 없는 주는 키 자체가 없음)를
 * weekStarts 순서 그대로 시트에 쓸 2D 배열로 펼친다 — 매칭 없는 주는
 * 전부 0으로 채움(Sheet setValues()에 바로 넘길 수 있는 형태).
 *
 * INPUT
 * weekStarts : Date[]  (리포트에 나열될 모든 Week Start, 월요일, 오름차순)
 * aggregates : Object  (computeSMRepWeeklyAggregates_() 출력)
 *
 * OUTPUT
 * Array<Array>  각 행: [weekStart, weekEnd,
 *   allLeads, newLeads, newP1, event, bofu, content, organic, referral,
 *   "",
 *   allSAL, salP1, bofuSAL, search, organicSAL, referralSAL]
 * (K열은 두 블록 사이 spacer, 항상 빈 문자열)
 *
 * TEST
 * testBuildSMRepDataRows() 참고
 * ==========================================================
 */
function buildSMRepDataRows_(weekStarts, aggregates){

  const toKey = function(date){
    return Utilities.formatDate(date, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd");
  };

  const EMPTY_ROW = {
    allLeads: 0, newLeads: 0, newP1: 0,
    leadsBreakdown: { Event: 0, BOFU: 0, Content: 0, Organic: 0, Referral: 0 },
    allSAL: 0, salP1: 0,
    salBreakdown: { BOFU: 0, Search: 0, Organic: 0, Referral: 0 }
  };

  return weekStarts.map(function(weekStart){

    const a = aggregates[toKey(weekStart)] || EMPTY_ROW;
    const weekEnd = addDaysToDate_(weekStart, 6);

    return [
      weekStart, weekEnd,
      a.allLeads, a.newLeads, a.newP1,
      a.leadsBreakdown.Event, a.leadsBreakdown.BOFU, a.leadsBreakdown.Content,
      a.leadsBreakdown.Organic, a.leadsBreakdown.Referral,
      "",
      a.allSAL, a.salP1,
      a.salBreakdown.BOFU, a.salBreakdown.Search, a.salBreakdown.Organic, a.salBreakdown.Referral
    ];

  });

}


/**
 * ==========================================================
 * TEST — buildSMRepDataRows_()
 * ==========================================================
 */
function testBuildSMRepDataRows(){

  const week1 = new Date(2026, 6, 27);
  const week2 = new Date(2026, 7, 3);

  const aggregates = {};

  aggregates[Utilities.formatDate(week1, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd")] = {
    allLeads: 10, newLeads: 5, newP1: 2,
    leadsBreakdown: { Event: 1, BOFU: 1, Content: 0, Organic: 2, Referral: 1 },
    allSAL: 3, salP1: 1,
    salBreakdown: { BOFU: 1, Search: 0, Organic: 1, Referral: 1 }
  };
  // week2는 매칭 없음 — 전부 0으로 채워져야 함

  const rows = buildSMRepDataRows_([week1, week2], aggregates);

  const pass =
    rows.length === 2 &&
    rows[0][0].getTime() === week1.getTime() &&
    rows[0][1].getTime() === addDaysToDate_(week1, 6).getTime() &&
    rows[0][2] === 10 && rows[0][3] === 5 && rows[0][4] === 2 &&
    rows[0][5] === 1 && rows[0][6] === 1 && rows[0][7] === 0 && rows[0][8] === 2 && rows[0][9] === 1 &&
    rows[0][10] === "" &&
    rows[0][11] === 3 && rows[0][12] === 1 &&
    rows[0][13] === 1 && rows[0][14] === 0 && rows[0][15] === 1 && rows[0][16] === 1 &&
    rows[1][2] === 0 && rows[1][11] === 0;  // week2 — 전부 0

  Logger.log(
    "testBuildSMRepDataRows: " + (pass ? "PASS" : "FAIL") +
    " rows=" + JSON.stringify(rows)
  );

}


/**
 * ==========================================================
 * Setup S&M_REP (수동 실행 — 시트 생성 + Control Area 뼈대)
 *
 * WHY
 * FY_REP/Target_REP과 동일한 관례 — 시트가 없으면 생성, Control Area(FY
 * 드롭다운 + Generate 체크박스)를 1회 배선. Report Area(헤더/데이터)는
 * generateSMReport_()가 매번 다시 쓰므로 여기서 건드리지 않는다.
 * ==========================================================
 */
function setupSMReport(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(CONFIG.SM_REP.SHEET);

  if(!sheet){
    sheet = ss.insertSheet(CONFIG.SM_REP.SHEET);
  }

  const rows = CONFIG.SM_REP.ROWS;
  const cols = CONFIG.SM_REP.COLUMNS;

  sheet.getRange(rows.CONTROL_HEADER, cols.FY).setValue("FY");
  sheet.getRange(rows.CONTROL_HEADER, cols.GENERATE).setValue("Generate");

  const fyLabels = CONFIG.SM_REP.FYS.map(function(fy){ return "FY" + String(fy).slice(-2); });
  const fyCell = sheet.getRange(rows.CONTROL_VALUE, cols.FY);

  fyCell.clearDataValidations();
  fyCell.setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(fyLabels).build()
  );

  if(fyLabels.indexOf(String(fyCell.getValue())) === -1){
    fyCell.setValue(fyLabels[fyLabels.length - 1]);
  }

  const generateCell = sheet.getRange(rows.CONTROL_VALUE, cols.GENERATE);

  generateCell.clearDataValidations();
  generateCell.insertCheckboxes();

  if(typeof generateCell.getValue() !== "boolean"){
    generateCell.setValue(false);
  }

  sheet.getRange(rows.CONTROL_HEADER, cols.FY, 1, 2).setFontWeight("bold");

  Logger.log(CONFIG.LOG.PREFIX + " S&M_REP Control Area 설정 완료.");

}


/**
 * ==========================================================
 * Generate S&M_REP (Report Area 재작성)
 *
 * WHY
 * Control Area의 FY 값을 읽어 그 FY의 전체 주(generateCalendarWeeksForFY_(),
 * TARGET_001_Engine.js)를 행으로 나열하고, Leads_OPS/MTA_Master를 각 1회
 * 스캔(computeSMRepWeeklyAggregates_())한 결과를 채워 넣는다. 재실행해도
 * 안전(Report Area 전체를 덮어씀, Control Area는 건드리지 않음).
 * ==========================================================
 */
function generateSMReport_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheet = ss.getSheetByName(CONFIG.SM_REP.SHEET);

  if(!sheet){
    throw new Error(CONFIG.SM_REP.SHEET + " sheet not found. setupSMReport() 먼저 실행하세요.");
  }

  const rows = CONFIG.SM_REP.ROWS;
  const cols = CONFIG.SM_REP.COLUMNS;

  const fyLabel = String(sheet.getRange(rows.CONTROL_VALUE, cols.FY).getValue() || "").trim();
  const fyMatch = fyLabel.match(/(\d+)$/);

  if(!fyMatch){
    throw new Error("S&M_REP Control Area의 FY 값(" + fyLabel + ")을 인식할 수 없습니다.");
  }

  // FY 라벨은 "FY27" 같은 2자리 접미사(setupSMReport()의 fyLabels 생성 규칙과
  // 동일) — generateCalendarWeeksForFY_()/resolveTargetFYCalendarYear_()도
  // 이 2자리 convention(26/27 등)을 그대로 기대하므로 변환하지 않는다.
  const targetFY = Number(fyMatch[1]);

  const weeks = generateCalendarWeeksForFY_(targetFY);
  const weekStarts = weeks.map(function(w){ return w.weekStart; });

  const opsSheet = ss.getSheetByName(OPS.SHEET.OPS);
  const mtaSheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);

  const leadsOpsRecords = opsSheet ? sheetToObjects(opsSheet) : [];
  const mtaRecords = mtaSheet ? sheetToObjects(mtaSheet) : [];

  const aggregates = computeSMRepWeeklyAggregates_(leadsOpsRecords, mtaRecords, weekStarts);
  const dataRows = buildSMRepDataRows_(weekStarts, aggregates);

  //----------------------------------------------------------
  // 헤더(Block/Column) — 매번 다시 씀
  //----------------------------------------------------------

  sheet.getRange(rows.BLOCK_HEADER, 1, 1, cols.SAL_START + CONFIG.SM_REP.SAL_HEADERS.length - 1).clearContent();
  sheet.getRange(rows.COLUMN_HEADER, 1, 1, cols.SAL_START + CONFIG.SM_REP.SAL_HEADERS.length - 1).clearContent();

  sheet.getRange(rows.BLOCK_HEADER, cols.LEADS_START, 1, CONFIG.SM_REP.LEADS_HEADERS.length)
    .merge()
    .setValue("Leads")
    .setFontWeight("bold")
    .setHorizontalAlignment("center");

  sheet.getRange(rows.BLOCK_HEADER, cols.SAL_START, 1, CONFIG.SM_REP.SAL_HEADERS.length)
    .merge()
    .setValue("SAL")
    .setFontWeight("bold")
    .setHorizontalAlignment("center");

  sheet.getRange(rows.COLUMN_HEADER, cols.WEEK_START).setValue("Week Start");
  sheet.getRange(rows.COLUMN_HEADER, cols.WEEK_END).setValue("Week End");

  sheet.getRange(rows.COLUMN_HEADER, cols.LEADS_START, 1, CONFIG.SM_REP.LEADS_HEADERS.length)
    .setValues([CONFIG.SM_REP.LEADS_HEADERS]);

  sheet.getRange(rows.COLUMN_HEADER, cols.SAL_START, 1, CONFIG.SM_REP.SAL_HEADERS.length)
    .setValues([CONFIG.SM_REP.SAL_HEADERS]);

  //----------------------------------------------------------
  // 데이터 영역 — 기존 내용 전체 clear 후 재작성(주 수가 FY마다 52/53으로
  // 달라질 수 있어 이전 실행의 잔여 행을 남기지 않기 위함)
  //----------------------------------------------------------

  const lastRow = sheet.getLastRow();
  const totalCols = cols.SAL_START + CONFIG.SM_REP.SAL_HEADERS.length - 1;

  if(lastRow >= rows.REPORT_DATA_START){
    sheet.getRange(rows.REPORT_DATA_START, 1, lastRow - rows.REPORT_DATA_START + 1, totalCols).clearContent();
  }

  if(dataRows.length > 0){
    sheet.getRange(rows.REPORT_DATA_START, 1, dataRows.length, totalCols).setValues(dataRows);
  }

  applySMReportStyles_(sheet, dataRows.length);

  Logger.log(
    CONFIG.LOG.PREFIX + " S&M_REP Generate 완료 — FY" + targetFY +
    ", " + dataRows.length + "주."
  );

}


/**
 * ==========================================================
 * Handle S&M_REP Generate Checkbox Edit
 *
 * WHY
 * ACQ_REP/NewP1_REP과 동일한 설치형(Installable) onEdit 트리거를 공유
 * (handleReportGenerateEdit(), ACQREP_001_Report.js) — S&M_REP은
 * Leads_OPS/MTA_Master(같은 스프레드시트 내부)만 읽어 Simple Trigger로도
 * 충분하지만, 이미 설치된 트리거를 재사용하면 사용자가 별도로 "설치
 * 트리거 실행" 절차를 한 번 더 밟을 필요가 없어 그대로 편입한다.
 * ==========================================================
 */
function handleSMReportGenerateEdit_(e, sheet){

  const row = e.range.getRow();
  const col = e.range.getColumn();

  const isGenerateCell =
    row === CONFIG.SM_REP.ROWS.CONTROL_VALUE &&
    col === CONFIG.SM_REP.COLUMNS.GENERATE;

  if(!isGenerateCell) return;
  if(e.value !== "TRUE") return;

  try{
    generateSMReport_();
  } catch(err){
    Logger.log(CONFIG.LOG.PREFIX + " S&M_REP Generate 실패: " + err.message);
  } finally {
    sheet.getRange(row, col).setValue(false);
  }

}
