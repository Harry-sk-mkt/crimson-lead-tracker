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
 * v1.3.2
 *
 * Change Log
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

  const seconds = ((new Date() - start) / 1000).toFixed(2);

  Logger.log(
    CONFIG.LOG.PREFIX + " ACQ Summary Refresh Completed : " +
    rows.length + " rows (" + seconds + "s)"
  );

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

