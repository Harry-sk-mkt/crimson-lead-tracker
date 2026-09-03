/**
 * ==========================================================
 * Marketing 2.0
 * ACQ Summary (Aggregate Table)
 *
 * Responsibility
 * MTA_Master/Leads_OPS 전체를 스캔하고(Revenue는 v1.2.0부터 Deal Tracker,
 * 2트랙 아키텍처 CLAUDE.md #7 참고) (FY|Month|Segment)별 지표를 미리 계산해
 * ACQ_Summary 시트에 저장한다.
 * ACQ Report는 이 시트만 조회하므로 즉시(<1s) 응답 가능하다.
 *
 * 호출 시점
 * - appendNewLeads(), appendNewMTA(), syncICFunnelToOPS()
 * - rebuildLeadsMaster(), rebuildMTAMaster()
 *
 * Version
 * v1.5.1
 *
 * Change Log
 * v1.5.1 (2026-09-03)
 * - `testComputeSALDeltaMaps()` 버그 수정 — 실측(사용자 실행)으로 FAIL 확인,
 *   원인은 실제 코드가 아니라 테스트 기대값: 7월도 FY27일 거라고 하드코딩
 *   했으나 이 프로젝트 회계연도는 8월 시작이라 7월은 FY26이 맞음(`getFiscalYear()`
 *   실제 반환값과 대조 없이 임의로 적어 넣은 실수). `getFiscalYear()` 호출로
 *   교체해 정확한 값 사용하도록 수정 — `computeSALDeltaMaps_()` 자체는 애초에
 *   정상 동작이었음(로그의 "26|JUL|Events" 키가 이미 올바른 값).
 * v1.5.0 (2026-09-03)
 * - **신규 `refreshACQSummarySALDelta_()`/`computeSALDeltaMaps_()`/
 *   `mergeSALDeltaIntoACQSummaryRows_()`/`mergeSALDeltaIntoACQSummaryWeeklyRows_()`**
 *   (`docs/OpenItems.md` #44, `docs/exec-plans/active/
 *   2026-09-02-pipeline-refresh-time-redesign.md`) — SAL Sync 전용 경량 갱신.
 *   "Sales Accepted Date"를 실제로 읽는 Engine이 ACQ_Summary 하나뿐임을 전체
 *   Engine 파일 grep으로 확인(NewP1/Events/BOFU/Search/Content_Engine/Target_Engine
 *   전부 미참조) — `refreshACQSummary_()`(Leads_OPS+MTA_Master+Deal Tracker 전체
 *   스캔) 대신, SAL Sync가 이미 알고 있는 "이번에 바뀐 리드"만으로 SAL 카운트에
 *   +1/-1 델타를 반영. Revenue-Only 변형과 달리 소스 자체가 작지 않아(Leads_OPS)
 *   전체 재계산 대신 호출부(`MASTER_010_SALSync.js`)가 이미 읽은 old/new 값을
 *   그대로 재사용 — 추가 스캔 전혀 없음(Business Segment/Lead Priority만 해당
 *   리드 행에 한해 조회).
 * v1.4.0 (2026-09-03)
 * - **신규 "Weekly Engine" — `refreshACQSummaryWeekly_()`/`writeACQSummaryWeekly_()`/
 *   `readACQSummaryWeeklyMap_()`, `ACQ_Summary_Weekly` 캐시 시트(`docs/OpenItems.md`
 *   #41 계열)** — S&M_REP이 Generate마다 Leads_OPS/MTA_Master 전체를 자체
 *   스캔하던 것(실측 119.8초) 제거 목적. `refreshACQSummary_()`가 이미 계산한
 *   `mtaAgg`/`opsAgg`(월 단위와 동일 스캔, 동일 소스·타이밍)의 신규 `*Weekly`
 *   서브맵을 받아 별도 시트에 씀 — 추가 스캔 없음. `computeOPSAggregates_()`
 *   (`ACQREP_001_Report.js` v1.19.0)에 SAL P1(월 단위엔 없던 신규 지표) 계산
 *   추가. `SMREP_001_Report.js`가 다음 커밋에서 이 캐시를 읽도록 전환 예정.
 * v1.3.2 (2026-08-09)
 * - `debugListAllSheetNames()` 삭제 — 호출부 전무 + 주석에 "TEMP" 명시된
 *   디버그용 스크래치 함수, 안 쓰는 함수 정리 요청으로 사용자 확인 후 삭제.
 * v1.3.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `31_ACQSummary.js` → 신규 `ACQREP_002_Summary.js`, 코드 내용 변경 없음.
 * v1.3.0 (2026-08-06)
 * - 신규 refreshACQSummaryRevenueOnly_()/mergeRevenueIntoACQSummaryRows_() —
 *   ACQ_REP Generate 클릭 시점에 refreshACQSummary_() 전체 스캔(MTA_Master/
 *   Leads_OPS, 실측 211초) 대신 Revenue만 Deal Tracker 기준으로 갱신하는
 *   경량 버전(30_ACQReport.js refreshAndGenerateACQReport_()에서 사용) —
 *   근거: All Leads/New P1/SAL 등은 Leads/MTA Import 시에만 바뀌고 이미
 *   백그라운드 파이프라인이 최신 유지 중이라 Generate 시점 재스캔이
 *   불필요, Revenue(Deal Tracker)만 Import와 무관하게 바뀔 수 있어 재조회
 *   가치가 있음(사용자 확인). testMergeRevenueIntoACQSummaryRows() 포함.
 * v1.2.0 (2026-07-28)
 * - Revenue 데이터 소스를 opsAgg(Leads_OPS Opportunity Won Date/Revenue,
 *   리드 단위)에서 dealRevenue(Deal Tracker 기반, computeACQDealRevenueFromRows_(),
 *   30_ACQReport.js)로 전환 — 2트랙 아키텍처(CLAUDE.md #7). 키 포맷(fy|month|segment)
 *   불변이라 writeACQSummary_()/readACQSummaryMap_()는 수정 없음.
 * v1.1.0 (2026-07-25)
 * - SAL 데이터 소스를 mtaAgg(MTA_Master, Lead Record Type 기준 — 과집계
 *   문제 있었음)에서 opsAgg(Leads_OPS, Sales Accepted Date 이벤트 기준)로
 *   전환. 30_ACQReport.js computeMTAAggregates_()/computeOPSAggregates_()
 *   참고.
 * ==========================================================
 */

const ACQ_SUMMARY_HEADERS = [
  "FY", "Month", "Segment",
  "All Leads", "All P1", "New Leads", "New P1",
  "SAL", "IC Booked", "IC Complete", "Revenue"
];


/**
 * ==========================================================
 * Refresh ACQ Summary (전체 재계산)
 *
 * WHY
 * Master/OPS 데이터가 바뀔 때마다(Append, Sync, Rebuild) 호출되어,
 * ACQ Report가 항상 최신이면서도 빠른 요약 테이블을 조회할 수 있게 한다.
 * ==========================================================
 */
function refreshACQSummary_(){

  const start = new Date();

  Logger.log(CONFIG.LOG.PREFIX + " ACQ Summary Refresh Started");

  // 범위 제한 없이 전체 스캔 (rangeStart/rangeEndExclusive를 null로 전달)
  const mtaAgg = computeMTAAggregates_(null, null);
  const opsAgg = computeOPSAggregates_(null, null);

  // Revenue는 Leads_OPS가 아니라 Deal Tracker 기반 (2트랙 아키텍처, CLAUDE.md #7 —
  // 30_ACQReport.js computeACQDealRevenueFromRows_() 참고)
  const dealRevenue = computeACQDealRevenueFromRows_(readDealTrackerRawRows_());

  const allKeys = {};

  [mtaAgg.allLeads, mtaAgg.allP1,
   opsAgg.newLeads, opsAgg.newP1, opsAgg.sal, opsAgg.icBooked, opsAgg.icComplete, dealRevenue]
    .forEach(function(map){
      Object.keys(map).forEach(function(key){
        allKeys[key] = true;
      });
    });

  const rows = Object.keys(allKeys).map(function(key){

    const parts = key.split("|");
    const fy = parts[0];
    const month = parts[1];
    const segment = parts[2];

    return [
      "FY" + String(fy).slice(-2),
      month,
      segment,
      mtaAgg.allLeads[key] || 0,
      mtaAgg.allP1[key] || 0,
      opsAgg.newLeads[key] || 0,
      opsAgg.newP1[key] || 0,
      opsAgg.sal[key] || 0,
      opsAgg.icBooked[key] || 0,
      opsAgg.icComplete[key] || 0,
      dealRevenue[key] || 0
    ];

  });

  writeACQSummary_(rows);

  // 2026-09-03 — S&M_REP 전용 주 단위 캐시도 같은 스캔(mtaAgg/opsAgg)으로 함께 갱신
  // (docs/OpenItems.md #41 계열 — S&M_REP이 자체 전체 스캔하던 것을 제거하기 위함).
  // 별도 스캔 없음 — 이미 계산된 aggregate map만 재사용.
  refreshACQSummaryWeekly_(mtaAgg, opsAgg);

  const seconds = ((new Date() - start) / 1000).toFixed(2);

  Logger.log(
    CONFIG.LOG.PREFIX + " ACQ Summary Refresh Completed : " +
    rows.length + " rows (" + seconds + "s)"
  );

}


/**
 * ==========================================================
 * ACQ Summary Weekly Headers (S&M_REP 전용 캐시)
 * ==========================================================
 */
const ACQ_SUMMARY_WEEKLY_HEADERS = [
  "WeekStart", "Segment", "All Leads", "New Leads", "New P1", "SAL", "SAL P1"
];


/**
 * ==========================================================
 * Refresh ACQ Summary Weekly (S&M_REP 전용 주 단위 캐시, "Weekly Engine")
 *
 * WHY (2026-09-03, `docs/OpenItems.md` #41 계열 — S&M_REP 성능 개선)
 * S&M_REP(`SMREP_001_Report.js`)이 Generate마다 Leads_OPS/MTA_Master
 * 전체를 자체적으로 다시 스캔하던 것(실측 119.8초, `docs/PerformanceBenchmark.md`
 * 2026-09-03)을 제거하기 위한 신규 "Weekly Engine". `refreshACQSummary_()`가
 * 이미 계산해둔 `mtaAgg`/`opsAgg`(All Leads/New Leads/New P1/SAL, 월 단위와
 * 동일한 필드·동일한 소스·동일한 타이밍 — Leads_OPS 빌드 이후)의 주 단위
 * 서브맵(`*Weekly`)을 그대로 받아 별도 시트에 쓴다 — Leads_OPS/MTA_Master를
 * 다시 읽지 않음(같은 스캔 재사용, "월 Engine 따로 + 주 Engine 따로"이되
 * 스캔은 1번, 사용자 확정 설계).
 *
 * SAL P1(P1 필터된 SAL)은 월 단위 ACQ_Summary엔 없는 지표 — S&M_REP 전용
 * 수요라 이 함수에서만 씀. New P1과 동일하게 `isEffectiveP1_()`(Priority
 * Override 포함, 다운그레이드 가드 적용된 Leads_OPS 값) 기준이라 ACQ_REP과
 * 완전히 같은 정의 — 소스/타이밍이 갈라지지 않는다(#35/#38류 불일치 방지가
 * 이 설계의 핵심 이유, 2026-09-03 설계 논의 참고).
 *
 * @param {Object} mtaAgg  computeMTAAggregates_(null, null) 결과
 * @param {Object} opsAgg  computeOPSAggregates_(null, null) 결과
 * ==========================================================
 */
function refreshACQSummaryWeekly_(mtaAgg, opsAgg){

  const allKeys = {};

  [
    mtaAgg.allLeadsWeekly, opsAgg.newLeadsWeekly, opsAgg.newP1Weekly,
    opsAgg.salWeekly, opsAgg.salP1Weekly
  ].forEach(function(map){
    Object.keys(map).forEach(function(key){
      allKeys[key] = true;
    });
  });

  const rows = Object.keys(allKeys).map(function(key){

    const sepIndex = key.indexOf("|");
    const weekStart = key.slice(0, sepIndex);
    const segment = key.slice(sepIndex + 1);

    return [
      weekStart,
      segment,
      mtaAgg.allLeadsWeekly[key] || 0,
      opsAgg.newLeadsWeekly[key] || 0,
      opsAgg.newP1Weekly[key] || 0,
      opsAgg.salWeekly[key] || 0,
      opsAgg.salP1Weekly[key] || 0
    ];

  });

  writeACQSummaryWeekly_(rows);

}


/**
 * ==========================================================
 * Write ACQ Summary Weekly to Sheet (없으면 생성)
 * ==========================================================
 */
function writeACQSummaryWeekly_(rows){

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(CONFIG.ACQ.SUMMARY_WEEKLY_SHEET);

  if(!sheet){
    sheet = ss.insertSheet(CONFIG.ACQ.SUMMARY_WEEKLY_SHEET);
  }

  sheet.clearContents();

  sheet.getRange(1, 1, 1, ACQ_SUMMARY_WEEKLY_HEADERS.length)
    .setValues([ACQ_SUMMARY_WEEKLY_HEADERS]);

  if(rows.length > 0){

    // WeekStart 자동 Date 변환 방지(AD_004_SpendCache.js Ad_Spend_Cache_Weekly와
    // 동일 이유·동일 대응 — 이 프로젝트가 반복 겪은 날짜/타임존 버그 클래스 예방).
    sheet.getRange(2, 1, rows.length, 1).setNumberFormat("@");
    sheet.getRange(2, 1, rows.length, ACQ_SUMMARY_WEEKLY_HEADERS.length).setValues(rows);

  }

  sheet.hideSheet();

  SpreadsheetApp.flush();

}


/**
 * ==========================================================
 * Read ACQ Summary Weekly as Lookup Map (Key "weekStart|segment" → Row Object)
 *
 * WHY
 * S&M_REP(`SMREP_001_Report.js`)이 이 함수만 호출해서 즉시 조회하도록 함
 * (Leads_OPS/MTA_Master 재스캔 없음, `readACQSummaryMap_()`와 동일 원칙).
 * ==========================================================
 */
function readACQSummaryWeeklyMap_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.ACQ.SUMMARY_WEEKLY_SHEET);

  const map = {};

  if(!sheet) return map;

  const values = sheet.getDataRange().getValues();

  if(values.length <= 1) return map;

  for(let i = 1; i < values.length; i++){

    const row = values[i];
    const key = String(row[0]).trim() + "|" + row[1];

    map[key] = {
      allLeads: row[2],
      newLeads: row[3],
      newP1: row[4],
      sal: row[5],
      salP1: row[6]
    };

  }

  return map;

}


/**
 * ==========================================================
 * TEMP — refreshACQSummaryWeekly_() 수동 실행용 공개 래퍼(재계산 없이
 * refreshACQSummary_()의 부산물이라, 단독 실행은 최근 refreshACQSummary_()
 * 실행 시점 기준 aggregate를 다시 스캔해서 만든다 — 편집기에서 이 캐시만
 * 따로 재생성하고 싶을 때용)
 * ==========================================================
 */
function runRefreshACQSummaryWeekly(){

  const mtaAgg = computeMTAAggregates_(null, null);
  const opsAgg = computeOPSAggregates_(null, null);

  refreshACQSummaryWeekly_(mtaAgg, opsAgg);

  Logger.log(CONFIG.LOG.PREFIX + " ACQ Summary Weekly Refresh Completed.");

}


/**
 * ==========================================================
 * Write ACQ Summary to Sheet (없으면 생성)
 * ==========================================================
 */
function writeACQSummary_(rows){

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(CONFIG.ACQ.SUMMARY_SHEET);

  if(!sheet){
    sheet = ss.insertSheet(CONFIG.ACQ.SUMMARY_SHEET);
  }

  sheet.clearContents();

  sheet.getRange(1, 1, 1, ACQ_SUMMARY_HEADERS.length)
    .setValues([ACQ_SUMMARY_HEADERS]);

  if(rows.length > 0){

    sheet.getRange(2, 1, rows.length, ACQ_SUMMARY_HEADERS.length)
      .setValues(rows);

  }

  sheet.hideSheet();

  SpreadsheetApp.flush();

}


/**
 * ==========================================================
 * Read ACQ Summary as Lookup Map (Key → Row Object)
 *
 * WHY
 * ACQ Report가 이 함수만 호출해서 즉시 조회하도록 함
 * (원본 Master/OPS 스캔 없음).
 * ==========================================================
 */
function readACQSummaryMap_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.ACQ.SUMMARY_SHEET);

  const map = {};

  if(!sheet) return map;

  const values = sheet.getDataRange().getValues();

  if(values.length <= 1) return map;

  for(let i = 1; i < values.length; i++){

    const row = values[i];

    const fy = Number(String(row[0]).replace("FY", ""));
    const month = row[1];
    const segment = row[2];

    const key = fy + "|" + month + "|" + segment;

    map[key] = {
      allLeads: row[3],
      allP1: row[4],
      newLeads: row[5],
      newP1: row[6],
      sal: row[7],
      icBooked: row[8],
      icComplete: row[9],
      revenue: row[10]
    };

  }

  return map;

}

/**
 * ==========================================================
 * Refresh ACQ Summary — Revenue Only (Generate 클릭 시점 전용, 2026-08-06)
 *
 * WHY
 * ACQ_REP Generate 체크박스가 매번 refreshACQSummary_()(MTA_Master 8만+행/
 * Leads_OPS 3만5천+행 전체 스캔)를 돌렸더니 실측 211초가 걸려 회의 중
 * 활용이 불가능했음(사용자 확인). All Leads/All P1/New Leads/New P1/SAL/
 * IC Booked/IC Complete는 Leads/MTA CSV Import가 있을 때만 바뀌는데, 그
 * Import는 이미 08_PipelineAsync.js 백그라운드 파이프라인이
 * refreshACQSummary_()를 자동으로 돌려 이 캐시를 최신으로 유지한다 —
 * Generate 시점에 다시 스캔해도 더 최신이 되지 않는다. Revenue(Deal
 * Tracker)만 Import와 무관하게 언제든 바뀔 수 있어(Ops가 아무 때나 수정)
 * Generate 클릭 시점에 다시 가져올 가치가 있는 유일한 필드 — 이 함수는
 * 기존 ACQ_Summary 캐시를 읽어 Revenue 필드만 Deal Tracker 기준으로
 * 갱신하고 나머지는 그대로 둔다. MTA_Master/Leads_OPS는 전혀 스캔하지
 * 않으므로 Deal Tracker openById() 읽기 시간 수준(수 초)으로 끝난다.
 *
 * TEST
 * mergeRevenueIntoACQSummaryRows_()의 testMergeRevenueIntoACQSummaryRows 참고
 * ==========================================================
 */
function refreshACQSummaryRevenueOnly_(){

  const start = new Date();

  Logger.log(CONFIG.LOG.PREFIX + " ACQ Summary Revenue-Only Refresh Started");

  const existingMap = readACQSummaryMap_();
  const dealRevenue = computeACQDealRevenueFromRows_(readDealTrackerRawRows_());

  const rows = mergeRevenueIntoACQSummaryRows_(existingMap, dealRevenue);

  writeACQSummary_(rows);

  const seconds = ((new Date() - start) / 1000).toFixed(2);

  Logger.log(
    CONFIG.LOG.PREFIX + " ACQ Summary Revenue-Only Refresh Completed : " +
    rows.length + " rows (" + seconds + "s)"
  );

}


/**
 * ==========================================================
 * Merge Revenue Into ACQ Summary Rows (순수 함수, 테스트용으로 분리)
 *
 * WHY
 * refreshACQSummaryRevenueOnly_()의 병합 로직만 떼어내 SpreadsheetApp
 * 없이 테스트 가능하게 함. All Leads/All P1/New Leads/New P1/SAL/IC
 * Booked/IC Complete는 existingMap 값을 그대로 보존하고 Revenue만
 * dealRevenue 기준으로 교체 — 딜이 사라진 키는 0으로(기존
 * refreshACQSummary_()의 `dealRevenue[key] || 0`과 동일 원칙), dealRevenue
 * 에만 있는 신규 키는 나머지 필드 0으로 새 행 추가(generateACQReport_()가
 * summaryMap[key] || {...0}으로 이미 방어하므로 안전).
 *
 * INPUT
 * existingMap : Object  readACQSummaryMap_()의 결과
 * dealRevenue : Object  computeACQDealRevenueFromRows_()의 결과 ({key: sum})
 *
 * OUTPUT
 * Object[][]  writeACQSummary_()에 그대로 넘길 수 있는 row 배열
 *
 * TEST
 * testMergeRevenueIntoACQSummaryRows 참고
 * ==========================================================
 */
function mergeRevenueIntoACQSummaryRows_(existingMap, dealRevenue){

  const allKeys = {};

  Object.keys(existingMap).forEach(function(key){ allKeys[key] = true; });
  Object.keys(dealRevenue).forEach(function(key){ allKeys[key] = true; });

  return Object.keys(allKeys).map(function(key){

    const parts = key.split("|");
    const fy = parts[0];
    const month = parts[1];
    const segment = parts[2];

    const existing = existingMap[key] || {
      allLeads: 0, allP1: 0, newLeads: 0, newP1: 0,
      sal: 0, icBooked: 0, icComplete: 0
    };

    return [
      "FY" + String(fy).slice(-2),
      month,
      segment,
      existing.allLeads,
      existing.allP1,
      existing.newLeads,
      existing.newP1,
      existing.sal,
      existing.icBooked,
      existing.icComplete,
      dealRevenue[key] || 0
    ];

  });

}


/**
 * ==========================================================
 * TEST — mergeRevenueIntoACQSummaryRows_()
 * ==========================================================
 */
function testMergeRevenueIntoACQSummaryRows(){

  const existingMap = {
    "26|Jul|Contact": {
      allLeads: 100, allP1: 50, newLeads: 40, newP1: 20,
      sal: 10, icBooked: 8, icComplete: 5
    },
    "26|Jul|Content": {
      allLeads: 30, allP1: 10, newLeads: 5, newP1: 2,
      sal: 1, icBooked: 1, icComplete: 0
    }
  };

  const dealRevenue = {
    "26|Jul|Contact": 5000,           // 기존 키 — Revenue만 교체
    "27|Aug|Events": 1200             // 신규 키 — 나머지 0으로 새 행
    // "26|Jul|Content"는 dealRevenue에 없음 — Revenue 0으로 리셋
  };

  const rows = mergeRevenueIntoACQSummaryRows_(existingMap, dealRevenue);

  const byKey = {};
  rows.forEach(function(row){
    byKey[Number(String(row[0]).replace("FY", "")) + "|" + row[1] + "|" + row[2]] = row;
  });

  const pass =
    rows.length === 3 &&
    byKey["26|Jul|Contact"][10] === 5000 &&
    byKey["26|Jul|Contact"][3] === 100 &&               // allLeads 보존
    byKey["26|Jul|Content"][10] === 0 &&                // 딜 사라짐 → 0
    byKey["26|Jul|Content"][3] === 30 &&                // 다른 필드는 보존
    byKey["27|Aug|Events"][10] === 1200 &&              // 신규 키
    byKey["27|Aug|Events"][3] === 0;                    // 신규 키 나머지 0

  Logger.log("Result: " + JSON.stringify(rows));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * TEMP — refreshACQSummary_() 수동 실행용 공개 래퍼
 *
 * WHY
 * refreshACQSummary_()는 이름 끝에 "_"가 있어 Apps Script
 * 편집기의 수동 실행 드롭다운에 노출되지 않는다 (private 함수 관례).
 * 편집기에서 직접 테스트하기 위한 공개 진입점.
 * ==========================================================
 */
function runRefreshACQSummary(){

  refreshACQSummary_();

}


/**
 * ==========================================================
 * Refresh ACQ Summary — SAL Delta Only (SAL Sync 전용, 2026-09-03)
 *
 * WHY
 * `docs/OpenItems.md` #44 — SAL Sync가 매번 `refreshACQSummary_()`(Leads_OPS
 * 3만+행/MTA_Master 8만+행/Deal Tracker 전체 스캔)를 돌렸으나, "Sales Accepted
 * Date"를 실제로 읽는 Engine은 ACQ_Summary뿐(전체 Engine 파일 grep으로 확인 —
 * NewP1/Events/BOFU/Search/Content_Engine/Target_Engine 전부 미참조). SAL
 * Sync는 이미 이번 배치에서 어떤 Lead ID의 값이 바뀌었는지(old/new 포함) 알고
 * 있으므로, 그 델타만 기존 캐시에 반영 — 추가 스캔 없음.
 *
 * INPUT
 * deltaLeads : Object[]  { segment, priority, priorityOverride, oldDate, newDate }
 *              (`computeSALDeltaLeads_()`(MASTER_010_SALSync.js) 결과, oldDate는
 *              변경 전 값 없으면 null, newDate는 항상 유효한 Date)
 *
 * TEST
 * computeSALDeltaMaps_()/mergeSALDeltaIntoACQSummaryRows_()/
 * mergeSALDeltaIntoACQSummaryWeeklyRows_() 각각의 test 함수 참고 — 이 함수
 * 자체는 SpreadsheetApp IO라 별도 테스트 없음(기존 refreshACQSummaryRevenueOnly_()
 * 와 동일 원칙).
 * ==========================================================
 */
function refreshACQSummarySALDelta_(deltaLeads){

  const start = new Date();

  Logger.log(CONFIG.LOG.PREFIX + " ACQ Summary SAL-Delta Refresh Started");

  if(deltaLeads.length === 0){
    Logger.log(CONFIG.LOG.PREFIX + " ACQ Summary SAL-Delta Refresh : 변경된 리드 없음, 스킵.");
    return;
  }

  const deltas = computeSALDeltaMaps_(deltaLeads);

  const existingMap = readACQSummaryMap_();
  const monthlyRows = mergeSALDeltaIntoACQSummaryRows_(existingMap, deltas.monthlyDelta);
  writeACQSummary_(monthlyRows);

  const existingWeeklyMap = readACQSummaryWeeklyMap_();
  const weeklyRows = mergeSALDeltaIntoACQSummaryWeeklyRows_(
    existingWeeklyMap, deltas.weeklyDelta, deltas.weeklyP1Delta
  );
  writeACQSummaryWeekly_(weeklyRows);

  const seconds = ((new Date() - start) / 1000).toFixed(2);

  Logger.log(
    CONFIG.LOG.PREFIX + " ACQ Summary SAL-Delta Refresh Completed : " +
    deltaLeads.length + " leads changed (" + seconds + "s)"
  );

}


/**
 * ==========================================================
 * Compute SAL Delta Maps (순수 함수)
 *
 * WHY
 * "바뀐 리드 목록"을 (FY|Month|Segment) 월 단위 델타 + (WeekStart|Segment)
 * 주 단위 델타 + P1 전용 주 단위 델타로 변환하는 로직만 분리해 테스트 가능하게
 * 함. `computeOPSAggregates_()`(ACQREP_001_Report.js)의 SAL 키 생성 규칙과
 * 동일해야 기존 캐시와 어긋나지 않음 — 반드시 동일한 keyFor/weekKeyFor 로직
 * 재사용(getFiscalYear/getFiscalMonthLabel/formatWeekKeyDate_/getMondayOfWeek_/
 * isEffectiveP1_ 전부 기존 전역 함수 그대로 재사용, 새로 만들지 않음).
 *
 * ⚠️ 한계(허용된 근사): priority/priorityOverride는 "지금 시점" 값을 old/new
 * 버킷 조정 양쪽에 동일하게 사용한다 — SAL Sync 자체는 Priority를 바꾸지
 * 않으므로 대부분 정확하지만, 만약 이 리드의 Priority가 old SAL이 처음
 * 집계된 시점 이후 다른 파이프라인(IC Funnel Sync)에 의해 바뀌었다면 그
 * old P1-주간 버킷에서 정확히 원래 넣었던 자리가 아닌 "현재 Priority 기준"
 * 자리에서 빼게 됨 — 극히 드문 케이스로 판단, 정밀 추적은 하지 않음(사용자
 * 확인 필요 시 재검토).
 *
 * INPUT
 * deltaLeads : Object[]  { segment, priority, priorityOverride, oldDate, newDate }
 *
 * OUTPUT
 * { monthlyDelta, weeklyDelta, weeklyP1Delta }  각각 Object { key: ±count }
 *
 * TEST
 * testComputeSALDeltaMaps() 참고
 * ==========================================================
 */
function computeSALDeltaMaps_(deltaLeads){

  const monthlyDelta = {};
  const weeklyDelta = {};
  const weeklyP1Delta = {};

  function monthKeyFor(date, segment){
    const fy = Number(getFiscalYear(date).replace("FY", ""));
    const month = getFiscalMonthLabel(date);
    return fy + "|" + month + "|" + (segment || "Other");
  }

  function weekKeyFor(date, segment){
    return formatWeekKeyDate_(getMondayOfWeek_(date)) + "|" + (segment || "Other");
  }

  function bump(map, key, amount){
    map[key] = (map[key] || 0) + amount;
  }

  deltaLeads.forEach(function(lead){

    const segment = lead.segment || "Other";
    const isP1 = isEffectiveP1_(lead.priority, lead.priorityOverride);

    if(lead.oldDate instanceof Date && !isNaN(lead.oldDate.getTime())){

      bump(monthlyDelta, monthKeyFor(lead.oldDate, segment), -1);
      bump(weeklyDelta, weekKeyFor(lead.oldDate, segment), -1);

      if(isP1){
        bump(weeklyP1Delta, weekKeyFor(lead.oldDate, segment), -1);
      }

    }

    if(lead.newDate instanceof Date && !isNaN(lead.newDate.getTime())){

      bump(monthlyDelta, monthKeyFor(lead.newDate, segment), 1);
      bump(weeklyDelta, weekKeyFor(lead.newDate, segment), 1);

      if(isP1){
        bump(weeklyP1Delta, weekKeyFor(lead.newDate, segment), 1);
      }

    }

  });

  return {
    monthlyDelta: monthlyDelta,
    weeklyDelta: weeklyDelta,
    weeklyP1Delta: weeklyP1Delta
  };

}


/**
 * ==========================================================
 * TEST — computeSALDeltaMaps_()
 * ==========================================================
 */
function testComputeSALDeltaMaps(){

  const deltaLeads = [
    // 신규 SAL (old 없음) — 2026-08-15 (FY27 Aug)
    { segment: "Events", priority: "Priority 1", priorityOverride: "", oldDate: null, newDate: new Date(2026, 7, 15) },
    // 기존 SAL이 다른 달로 이동 — 2026-07-01(FY27 Jul) → 2026-08-01(FY27 Aug)
    { segment: "Events", priority: "", priorityOverride: "", oldDate: new Date(2026, 6, 1), newDate: new Date(2026, 7, 1) }
  ];

  const result = computeSALDeltaMaps_(deltaLeads);

  const augKey =
    Number(getFiscalYear(new Date(2026, 7, 15)).replace("FY", "")) + "|" +
    getFiscalMonthLabel(new Date(2026, 7, 15)) + "|Events";

  const julKey =
    Number(getFiscalYear(new Date(2026, 6, 1)).replace("FY", "")) + "|" +
    getFiscalMonthLabel(new Date(2026, 6, 1)) + "|Events";

  const pass =
    result.monthlyDelta[augKey] === 2 &&      // 신규 +1, 이동 +1
    result.monthlyDelta[julKey] === -1 &&     // 이동으로 -1
    result.weeklyP1Delta[
      formatWeekKeyDate_(getMondayOfWeek_(new Date(2026, 7, 15))) + "|Events"
    ] === 1;                                  // 첫 리드만 P1

  Logger.log(
    "testComputeSALDeltaMaps: " + (pass ? "PASS" : "FAIL") +
    " monthlyDelta=" + JSON.stringify(result.monthlyDelta)
  );

}


/**
 * ==========================================================
 * Merge SAL Delta Into ACQ Summary Rows (순수 함수)
 *
 * `mergeRevenueIntoACQSummaryRows_()`와 동일 구조 — allLeads/allP1/newLeads/
 * newP1/icBooked/icComplete/revenue는 기존 캐시값 그대로 보존, sal만 델타
 * 반영. 0 밑으로 내려가지 않도록 방어(음수 델타 누적 버그가 있어도 화면에
 * 음수가 뜨는 사고는 방지).
 *
 * TEST
 * testMergeSALDeltaIntoACQSummaryRows() 참고
 * ==========================================================
 */
function mergeSALDeltaIntoACQSummaryRows_(existingMap, monthlyDelta){

  const allKeys = {};

  Object.keys(existingMap).forEach(function(key){ allKeys[key] = true; });
  Object.keys(monthlyDelta).forEach(function(key){ allKeys[key] = true; });

  return Object.keys(allKeys).map(function(key){

    const parts = key.split("|");
    const fy = parts[0];
    const month = parts[1];
    const segment = parts[2];

    const existing = existingMap[key] || {
      allLeads: 0, allP1: 0, newLeads: 0, newP1: 0,
      sal: 0, icBooked: 0, icComplete: 0, revenue: 0
    };

    const newSal = Math.max(0, (existing.sal || 0) + (monthlyDelta[key] || 0));

    return [
      "FY" + String(fy).slice(-2),
      month,
      segment,
      existing.allLeads,
      existing.allP1,
      existing.newLeads,
      existing.newP1,
      newSal,
      existing.icBooked,
      existing.icComplete,
      existing.revenue || 0
    ];

  });

}


/**
 * ==========================================================
 * TEST — mergeSALDeltaIntoACQSummaryRows_()
 * ==========================================================
 */
function testMergeSALDeltaIntoACQSummaryRows(){

  const existingMap = {
    "26|Jul|Contact": { allLeads: 100, allP1: 50, newLeads: 20, newP1: 10, sal: 5, icBooked: 3, icComplete: 1, revenue: 5000 }
  };

  const monthlyDelta = {
    "26|Jul|Contact": 2,       // 5 → 7
    "27|Aug|Events": 1         // 신규 키, 나머지 0
  };

  const rows = mergeSALDeltaIntoACQSummaryRows_(existingMap, monthlyDelta);

  const byKey = {};
  rows.forEach(function(row){
    byKey[Number(row[0].replace("FY", "")) + "|" + row[1] + "|" + row[2]] = row;
  });

  const pass =
    byKey["26|Jul|Contact"][7] === 7 &&               // sal 5+2
    byKey["26|Jul|Contact"][3] === 100 &&             // allLeads 보존
    byKey["26|Jul|Contact"][10] === 5000 &&           // revenue 보존
    byKey["27|Aug|Events"][7] === 1 &&                // 신규 키
    byKey["27|Aug|Events"][3] === 0;                  // 신규 키 나머지 0

  Logger.log("testMergeSALDeltaIntoACQSummaryRows: " + (pass ? "PASS" : "FAIL") + " " + JSON.stringify(rows));

}


/**
 * ==========================================================
 * Merge SAL Delta Into ACQ Summary Weekly Rows (순수 함수)
 * ==========================================================
 */
function mergeSALDeltaIntoACQSummaryWeeklyRows_(existingMap, weeklyDelta, weeklyP1Delta){

  const allKeys = {};

  Object.keys(existingMap).forEach(function(key){ allKeys[key] = true; });
  Object.keys(weeklyDelta).forEach(function(key){ allKeys[key] = true; });
  Object.keys(weeklyP1Delta).forEach(function(key){ allKeys[key] = true; });

  return Object.keys(allKeys).map(function(key){

    const sepIndex = key.indexOf("|");
    const weekStart = key.slice(0, sepIndex);
    const segment = key.slice(sepIndex + 1);

    const existing = existingMap[key] || {
      allLeads: 0, newLeads: 0, newP1: 0, sal: 0, salP1: 0
    };

    const newSal = Math.max(0, (existing.sal || 0) + (weeklyDelta[key] || 0));
    const newSalP1 = Math.max(0, (existing.salP1 || 0) + (weeklyP1Delta[key] || 0));

    return [
      weekStart,
      segment,
      existing.allLeads,
      existing.newLeads,
      existing.newP1,
      newSal,
      newSalP1
    ];

  });

}


/**
 * ==========================================================
 * TEST — mergeSALDeltaIntoACQSummaryWeeklyRows_()
 * ==========================================================
 */
function testMergeSALDeltaIntoACQSummaryWeeklyRows(){

  const existingMap = {
    "2026-07-27|Events": { allLeads: 10, newLeads: 4, newP1: 2, sal: 1, salP1: 0 }
  };

  const weeklyDelta = { "2026-07-27|Events": 1, "2026-08-03|Contact": 1 };
  const weeklyP1Delta = { "2026-07-27|Events": 1 };

  const rows = mergeSALDeltaIntoACQSummaryWeeklyRows_(existingMap, weeklyDelta, weeklyP1Delta);

  const byKey = {};
  rows.forEach(function(row){ byKey[row[0] + "|" + row[1]] = row; });

  const pass =
    byKey["2026-07-27|Events"][5] === 2 &&    // sal 1+1
    byKey["2026-07-27|Events"][6] === 1 &&    // salP1 0+1
    byKey["2026-07-27|Events"][2] === 10 &&   // allLeads 보존
    byKey["2026-08-03|Contact"][5] === 1 &&   // 신규 키
    byKey["2026-08-03|Contact"][2] === 0;     // 신규 키 나머지 0

  Logger.log("testMergeSALDeltaIntoACQSummaryWeeklyRows: " + (pass ? "PASS" : "FAIL") + " " + JSON.stringify(rows));

}

