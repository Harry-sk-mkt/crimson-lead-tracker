/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — Deal Tracker Segment Classification Check
 *
 * Responsibility
 * Deal Tracker(딜 비중 계산 원천, 90_TargetEngine.js)에서 classifyDealSegment_()
 * 로 세그먼트 분류가 안 되는 딜을 "temp_DealTrackerUnmatched" 시트에 나열한다.
 * 사람이 직접 눈으로 확인(Lead Source/Source Category/Lead Source Detail이
 * 어떤 값이라 분류가 안 됐는지)하기 위한 1회성/수시 재실행용 임시 작업 시트 —
 * temp_QA(25_TempQA_BusinessSegment.js)와 동일한 패턴.
 *
 * WHY
 * 2026-07-27 아키텍처 전환: Deal Tracker Source email/Primary Guardian Email/
 * Account Name을 Leads_OPS와 매칭하던 접근을 전부 폐기(Sales팀 확인 — 상담
 * 후 이메일이 Salesforce에서 덮어써져 원본 마케팅 터치 이메일이 시스템적으로
 * 복구 불가능한 경우가 있어 개별 리드 매칭 자체가 근본적으로 신뢰 불가).
 * 대신 Deal Tracker 자체를 Source of Truth로 삼아 getBusinessSegment()로
 * 직접 분류(classifyDealSegment_())하는 방식으로 전환 — 이 시트는 그 분류
 * 로직이 실패하는 딜만 모아서 사람이 검토할 수 있게 한다.
 *
 * Version
 * v2.8.0
 *
 * Change Log
 * v2.8.0 (2026-07-28)
 * - 신규 진단 runReportWorkbookCellUsage() 추가 — 워크북이 Google Sheets
 *   1,000만 셀 상한에 근접해 새 시트 생성이 실패하는 문제(v2.5.0에서 실측
 *   확인) 조사용. 시트별 할당 그리드 크기(getMaxRows()×getMaxColumns())와
 *   실사용 범위(getLastRow()×getLastColumn())를 대조해 "낭비되는" 빈 셀이
 *   어느 시트에 몰려있는지 낭비량 큰 순으로 로그 출력. 읽기 전용(수정 없음).
 * v2.7.0 (2026-07-28)
 * - Fixed: computeEventsWebinarSeminarGapRows_()가 Events_OPS 헤더 행을
 *   eventsValues[0](1행)으로 잘못 가정 — 실제로는 1행이 SUBTOTAL 수식 행이고
 *   헤더는 EVENTS.ROWS.HEADER(2행)임(50_Events_Config.js). 이 때문에 K열/A열
 *   위치를 못 찾아 149개 전 항목이 매칭 실패("false | false")로 잘못
 *   나왔음(실측 확인, 실제 매칭 여부와 무관한 버그). EVENTS.ROWS.HEADER/
 *   DATA_START 기준으로 정정 + 사인티 체크 Logger.log 라인 추가(campaignCol/
 *   leadSourceDetailCol 인덱스, 매칭 셋 크기 등 즉시 확인 가능하도록).
 * v2.6.0 (2026-07-28)
 * - Fixed: runCheckEventsWebinarSeminarRevenueGap()가 새 시트를 만들려다
 *   "above the limit of 10000000 cells" 에러로 실패(워크북이 Google Sheets
 *   셀 상한에 근접 — 실측 확인). insertSheet() 제거, 결과를 Logger.log로만
 *   출력하도록 변경.
 * v2.5.0 (2026-07-28)
 * - 신규 진단 runCheckEventsWebinarSeminarRevenueGap()/
 *   computeEventsWebinarSeminarGapRows_() 추가 — 딜트래커 Webinar+Seminar
 *   세그먼트 딜 총액($12,154,404.84)과 Events_OPS Revenue 총액($9,806,317.55)
 *   사이 ~$2.35M 갭 조사용. 딜트래커 각 딜의 Lead Source Detail을 Events_OPS의
 *   K열(Marketo Campaign name, 수동 입력)/A열(Lead Source Detail, 실제 매칭
 *   키) 둘 다와 대조해 어느 쪽으로도 안 잡히는 딜만 Revenue 큰 순으로
 *   "temp_EventsRevenueGapCheck" 시트에 기록. isEligibleEventProgram_() 통과
 *   여부도 같이 표시해 필터 자체에서 걸러지는 건지 구분 가능.
 * v2.4.0 (2026-07-28)
 * - v2.3.0에서 추가했던 TEMP DEBUG 함수 runDumpDealTrackerRowByOppName() 제거
 *   — "Minu Kang" $54,891.44 Referral 딜 미집계 원인이 타임존 버그로 확인됨
 *   (90_TargetEngine.js normalizeExternalCalendarDate_(), v1.13.0에서 수정).
 *   목적을 다했으므로 삭제.
 * v2.3.0 (2026-07-28)
 * - TEMP DEBUG 함수 runDumpDealTrackerRowByOppName() 추가 — "Minu Kang"
 *   $54,891.44 Referral 딜이 Close Date/Segment/Revenue 개별 확인(사용자
 *   실측: Close Date 유효 Date 타입 확인, Segment="Referral" 정확 일치,
 *   Revenue(NZD) 값 존재)에도 불구하고 ACQ_Summary/ACQ_REP 어디에도 안 잡히는
 *   원인 불명 상태라, 시트 원본 값을 가공 없이 그대로 Logger에 덤프해 직접
 *   확인하기 위한 1회성 디버그. 원인 확인 후 삭제 예정.
 * v2.2.0 (2026-07-28)
 * - classifyDealSegment_()가 getBusinessSegment() 키워드 매칭 대신 Deal
 *   Tracker의 수동 "Segment" 컬럼(row.businessSegment)을 직접 참조하도록
 *   바뀐 것에 맞춰 그대로 동작 확인(이 파일 자체 코드는 변경 없음 —
 *   classifyDealSegment_()를 그대로 호출만 하므로 자동 반영됨). 실측 검증
 *   결과 키워드 매칭 정확도가 신뢰 불가 수준(Search $144,265 vs 실제
 *   ~$537,507.89)이라 사용자가 Deal Tracker 전체를 수동 재분류 — 상세:
 *   docs/Changelog.md 2026-07-28, CLAUDE.md #7.
 * v2.1.0 (2026-07-27)
 * - readDealTrackerRawRows_()의 반환 필드가 fy → closeFY/createdFY로 바뀐 것에
 *   맞춰 수정(안 그러면 런타임 에러). MEDIAN_FYS(제거된 설정) 참조도 제거하고
 *   실제 계산(computeDealShareRatiosFromDealRows_)과 동일하게 코호트1
 *   (closeFY===createdFY===P1_VALUE_FY)만 대상으로 필터링하도록 통일.
 * v2.0.0 (2026-07-27)
 * - 전면 재작성. 이메일 매칭 기반(구 computeUnmatchedDealTrackerEmailSummary_)
 *   에서 classifyDealSegment_() 분류 실패 기반으로 교체 — Lead Source/Source
 *   Category/Lead Source Detail 조합별로 집계, Revenue 큰 순 정렬.
 * v1.x (2026-07-27)
 * - (구버전 히스토리) Student/Guardian Email/Account Name 매칭 기반 구현 —
 *   이후 아키텍처 전환으로 폐기.
 * ==========================================================
 */

const TEMP_QA_DEAL_TRACKER_SHEET = "temp_DealTrackerUnmatched";

const TEMP_QA_DEAL_TRACKER_HEADERS = [
  "Lead Source",
  "Source Category",
  "Lead Source Detail",
  "Deal Count",
  "Total Revenue (NZD)",
  "FYs"
];


/**
 * ==========================================================
 * Compute Unclassified Deal Tracker Summary
 *
 * WHY
 * classifyDealSegment_()가 실제 계산(computeDealShareRatiosFromDealRows_())
 * 에서 쓰는 것과 동일한 분류 기준을 그대로 재사용해, 실제 계산과 100% 같은
 * 기준으로 "분류 안 되는 것"을 뽑는다. (Lead Source, Source Category, Lead
 * Source Detail) 조합별로 건수/합계 Revenue를 모아 Revenue 큰 순으로 정렬 —
 * 영향 큰 것부터 확인할 수 있도록.
 *
 * @return {Array<Object>}
 * ==========================================================
 */
function computeUnclassifiedDealTrackerSummary_(){

  const dealRows = readDealTrackerRawRows_();
  const config = CONFIG.TARGET.EXTERNAL.DEAL_TRACKER;
  const targetFY = CONFIG.TARGET.P1_VALUE_FY;

  const excludeSet = {};
  config.EXCLUDE_LEAD_SOURCES.forEach(function(src){ excludeSet[src] = true; });

  const summary = {};

  dealRows.forEach(function(row){

    // 실제 계산(computeDealShareRatiosFromDealRows_)과 동일하게 코호트1만 대상
    if(row.closeFY !== targetFY || row.createdFY !== targetFY) return;
    if(excludeSet[String(row.leadSource || "").toLowerCase()]) return;
    if(classifyDealSegment_(row)) return; // 분류됨 — 제외 대상 아님

    const key = row.leadSource + "|" + row.sourceCategory + "|" + row.leadSourceDetail;

    if(!summary[key]){
      summary[key] = {
        leadSource: row.leadSource,
        sourceCategory: row.sourceCategory,
        leadSourceDetail: row.leadSourceDetail,
        count: 0,
        totalRevenue: 0,
        fys: {}
      };
    }

    const entry = summary[key];

    entry.count++;
    entry.totalRevenue += row.revenue;
    entry.fys["FY" + row.closeFY] = true;

  });

  const rows = Object.keys(summary).map(function(key){

    const entry = summary[key];

    return {
      leadSource: entry.leadSource,
      sourceCategory: entry.sourceCategory,
      leadSourceDetail: entry.leadSourceDetail,
      count: entry.count,
      totalRevenue: entry.totalRevenue,
      fys: Object.keys(entry.fys).sort().join(", ")
    };

  });

  rows.sort(function(a, b){ return b.totalRevenue - a.totalRevenue; });

  return rows;

}


/**
 * ==========================================================
 * Run Temp QA — Deal Tracker Segment Classification Check (수동 실행용)
 * ==========================================================
 */
function runListUnmatchedDealTrackerEmails(){

  const rows = computeUnclassifiedDealTrackerSummary_();

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(TEMP_QA_DEAL_TRACKER_SHEET);

  if(!sheet){
    sheet = ss.insertSheet(TEMP_QA_DEAL_TRACKER_SHEET);
  } else {
    sheet.clearContents();
  }

  sheet.getRange(1, 1, 1, TEMP_QA_DEAL_TRACKER_HEADERS.length)
    .setValues([TEMP_QA_DEAL_TRACKER_HEADERS]);

  const matrix = rows.map(function(r){
    return [r.leadSource, r.sourceCategory, r.leadSourceDetail, r.count, r.totalRevenue, r.fys];
  });

  if(matrix.length > 0){

    sheet.getRange(2, 1, matrix.length, TEMP_QA_DEAL_TRACKER_HEADERS.length)
      .setValues(matrix);

  }

  Logger.log(
    CONFIG.LOG.PREFIX + " Unclassified Deal Tracker rows: " + matrix.length +
    " distinct (Lead Source, Source Category, Lead Source Detail) combination(s) — written to '" +
    TEMP_QA_DEAL_TRACKER_SHEET + "' sheet, sorted by Total Revenue desc."
  );

}


const TEMP_QA_EVENTS_GAP_HEADERS = [
  "Lead Source Detail (raw)",
  "Business Segment",
  "Normalized Key (stripRegistrationFormSuffix_)",
  "isEligibleEventProgram_() 통과",
  "Events_OPS K열(Marketo Campaign name) 매칭",
  "Events_OPS A열(Lead Source Detail) 매칭",
  "Deal Count",
  "Total Revenue (NZD)"
];


/**
 * ==========================================================
 * Compute Events Webinar/Seminar Revenue Gap Rows
 *
 * WHY (2026-07-28, Events_OPS Revenue 갭 조사)
 * 딜트래커 기준 Webinar+Seminar 세그먼트 딜 총액($12,154,404.84)과 Events_OPS
 * Revenue 합계($9,806,317.55) 사이에 약 $2.35M 갭 발견(사용자 실측). Events_OPS는
 * 프로그램명(Lead Source Detail, A열 — isEligibleEventProgram_()로 KOR+WB/EV
 * 타입만 허용)으로 매칭하므로, 딜트래커의 Lead Source Detail 형식이 이 규칙과
 * 안 맞으면(예: WB-/EV- 프리픽스 없음, KOR 아닌 것으로 판정) 딜 자체가
 * computeEventsDealAggregates_()(51_Events_Engine.js)에서 통째로 제외된다.
 * 사용자 요청대로 Events_OPS의 K열("Marketo Campaign name", 수동 입력 필드)과
 * 실제 매칭 키인 A열(Lead Source Detail) 둘 다 대조해, 어느 쪽으로도 안 잡히는
 * 딜만 눈으로 확인할 수 있게 한다.
 *
 * @return {Array<Object>}  둘 중 하나라도 안 맞는 조합만, Revenue 큰 순
 * ==========================================================
 */
function computeEventsWebinarSeminarGapRows_(){

  const dealRows = readDealTrackerRawRows_().filter(function(row){
    return row.businessSegment === "Webinar" || row.businessSegment === "Seminar";
  });

  const eventsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EVENTS.SHEET.OPS);
  const eventsValues = eventsSheet ? eventsSheet.getDataRange().getValues() : [];

  // Events_OPS는 1행이 SUBTOTAL 수식 행, 실제 헤더는 EVENTS.ROWS.HEADER(2행) —
  // 0-based 인덱스로 변환 (50_Events_Config.js 참고. 2026-07-28 버그 수정:
  // 이전엔 eventsValues[0]을 헤더로 잘못 가정해 K/A열을 못 찾아 전부 매칭
  // 실패로 나왔었음).
  const headerRowIndex = EVENTS.ROWS.HEADER - 1;
  const dataStartIndex = EVENTS.ROWS.DATA_START - 1;
  const eventsHeaders = eventsValues.length > headerRowIndex ? eventsValues[headerRowIndex] : [];

  const campaignCol = eventsHeaders.indexOf("Marketo Campaign name");
  const leadSourceDetailCol = eventsHeaders.indexOf("Lead Source Detail");

  const eventsCampaignSet = {};
  const eventsLSDSet = {};

  for(let i = dataStartIndex; i < eventsValues.length; i++){

    const row = eventsValues[i];

    if(campaignCol !== -1){
      const v = String(row[campaignCol] || "").trim().toLowerCase();
      if(v) eventsCampaignSet[v] = true;
    }

    if(leadSourceDetailCol !== -1){
      const v = String(row[leadSourceDetailCol] || "").trim().toLowerCase();
      if(v) eventsLSDSet[v] = true;
    }

  }

  Logger.log(
    "[sanity check] campaignCol idx=" + campaignCol + ", leadSourceDetailCol idx=" + leadSourceDetailCol +
    " | eventsCampaignSet distinct values=" + Object.keys(eventsCampaignSet).length +
    " | eventsLSDSet distinct values=" + Object.keys(eventsLSDSet).length +
    " | Events_OPS total data rows scanned=" + Math.max(0, eventsValues.length - dataStartIndex) +
    " | dealRows(Webinar+Seminar)=" + dealRows.length
  );

  const summary = {};

  dealRows.forEach(function(row){

    const rawDetail = row.leadSourceDetail;
    const normalizedKey = stripRegistrationFormSuffix_(rawDetail);
    const eligible = !!(normalizedKey && isEligibleEventProgram_(normalizedKey));

    const rawCompare = String(rawDetail || "").trim().toLowerCase();
    const normalizedCompare = String(normalizedKey || "").trim().toLowerCase();

    const matchesCampaignCol = !!eventsCampaignSet[rawCompare] || !!eventsCampaignSet[normalizedCompare];
    const matchesLSDCol = !!eventsLSDSet[rawCompare] || !!eventsLSDSet[normalizedCompare];

    if(matchesCampaignCol && matchesLSDCol) return; // 둘 다 매칭되면 정상 — 제외

    const key = rawDetail + "||" + row.businessSegment;

    if(!summary[key]){
      summary[key] = {
        leadSourceDetail: rawDetail,
        businessSegment: row.businessSegment,
        normalizedKey: normalizedKey,
        eligible: eligible,
        matchesCampaignCol: matchesCampaignCol,
        matchesLSDCol: matchesLSDCol,
        count: 0,
        totalRevenue: 0
      };
    }

    summary[key].count++;
    summary[key].totalRevenue += row.revenue;

  });

  const rows = Object.keys(summary).map(function(k){ return summary[k]; });

  rows.sort(function(a, b){ return b.totalRevenue - a.totalRevenue; });

  return rows;

}


/**
 * ==========================================================
 * Run Temp QA — Events Webinar/Seminar Revenue Gap Check (수동 실행용)
 *
 * WHY (2026-07-28, 워크북 셀 한도 초과)
 * 원래는 결과를 새 시트에 썼으나, 워크북이 Google Sheets 1,000만 셀 상한에
 * 근접해 있어 `insertSheet()` 자체가 "This action would increase the number
 * of cells in the workbook above the limit of 10000000 cells" 에러로 실패함
 * (실측 확인). 새 시트를 만들지 않고 Logger에만 결과를 출력하도록 변경 —
 * 실행 후 Apps Script 편집기의 실행 로그(Executions)에서 그대로 복사해 확인.
 * ==========================================================
 */
function runCheckEventsWebinarSeminarRevenueGap(){

  const rows = computeEventsWebinarSeminarGapRows_();

  const totalUnmatchedRevenue = rows.reduce(function(sum, r){ return sum + r.totalRevenue; }, 0);

  Logger.log(
    CONFIG.LOG.PREFIX + " Events Webinar/Seminar 매칭 안 되는 딜: " + rows.length +
    " combo, 합계 Revenue: " + totalUnmatchedRevenue
  );

  Logger.log(TEMP_QA_EVENTS_GAP_HEADERS.join(" | "));

  rows.forEach(function(r){

    Logger.log(
      [
        r.leadSourceDetail,
        r.businessSegment,
        r.normalizedKey,
        r.eligible,
        r.matchesCampaignCol,
        r.matchesLSDCol,
        r.count,
        r.totalRevenue
      ].join(" | ")
    );

  });

}


/**
 * ==========================================================
 * TEMP DEBUG — Report Workbook Cell Usage Per Sheet (읽기 전용, 안전)
 *
 * WHY (2026-07-28, "above the limit of 10000000 cells" 에러 조사)
 * 새 시트 생성이 워크북 전체 셀 개수 상한(1,000만)에 걸려 실패하는 것을
 * 실측 확인(runCheckEventsWebinarSeminarRevenueGap() v2.5.0 최초 실행 시).
 * Google Sheets의 셀 개수는 "실제 데이터가 있는 셀"이 아니라 "시트에 할당된
 * 그리드 크기"(getMaxRows() × getMaxColumns())로 계산되므로, 실제 사용량
 * (getLastRow() × getLastColumn())과의 차이가 클수록 "낭비되는" 할당 영역이다.
 * 어떤 시트를 얼마나 줄여야 할지 추측하지 않고 실측하기 위한 읽기 전용
 * 진단 — 시트를 수정하지 않으므로 안전.
 * ==========================================================
 */
function runReportWorkbookCellUsage(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();

  let totalAllocated = 0;
  let totalUsed = 0;

  const rows = sheets.map(function(sheet){

    const maxRows = sheet.getMaxRows();
    const maxCols = sheet.getMaxColumns();
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    const allocated = maxRows * maxCols;
    const used = lastRow * lastCol;
    const wasted = allocated - used;

    totalAllocated += allocated;
    totalUsed += used;

    return {
      name: sheet.getName(),
      hidden: sheet.isSheetHidden(),
      maxRows: maxRows,
      maxCols: maxCols,
      lastRow: lastRow,
      lastCol: lastCol,
      allocated: allocated,
      used: used,
      wasted: wasted
    };

  });

  rows.sort(function(a, b){ return b.wasted - a.wasted; });

  Logger.log(
    "워크북 전체 — 할당된 셀: " + totalAllocated.toLocaleString() +
    " / 실사용 셀: " + totalUsed.toLocaleString() +
    " / 낭비(할당-사용): " + (totalAllocated - totalUsed).toLocaleString() +
    " (1,000만 셀 상한 대비 " + (totalAllocated / 10000000 * 100).toFixed(1) + "%)"
  );

  Logger.log("Sheet | Hidden | MaxRows x MaxCols (할당) | LastRow x LastCol (사용) | 낭비 셀 수");

  rows.forEach(function(r){

    Logger.log(
      r.name + " | " + r.hidden +
      " | " + r.maxRows + "x" + r.maxCols + " = " + r.allocated.toLocaleString() +
      " | " + r.lastRow + "x" + r.lastCol + " = " + r.used.toLocaleString() +
      " | " + r.wasted.toLocaleString()
    );

  });

}


