/**
 * ==========================================================
 * Marketing 2.0
 * ACQ Summary (Aggregate Table)
 *
 * Responsibility
 * MTA_Master/Leads_OPS 전체를 스캔하여 (FY|Month|Segment)별
 * 지표를 미리 계산해 ACQ_Summary 시트에 저장한다.
 * ACQ Report는 이 시트만 조회하므로 즉시(<1s) 응답 가능하다.
 *
 * 호출 시점
 * - appendNewLeads(), appendNewMTA(), syncICFunnelToOPS()
 * - rebuildLeadsMaster(), rebuildMTAMaster()
 *
 * Version
 * v1.0.0
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

  const allKeys = {};

  [mtaAgg.allLeads, mtaAgg.allP1, mtaAgg.sal,
   opsAgg.newLeads, opsAgg.newP1, opsAgg.icBooked, opsAgg.icComplete, opsAgg.revenue]
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
      mtaAgg.sal[key] || 0,
      opsAgg.icBooked[key] || 0,
      opsAgg.icComplete[key] || 0,
      opsAgg.revenue[key] || 0
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
 * TEMP — 모든 시트 이름을 정확히(따옴표로 감싸서) 출력
 * ==========================================================
 */
function debugListAllSheetNames(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();

  sheets.forEach(function(sheet){

    Logger.log(
      "\"" + sheet.getName() + "\"" +
      "  (length: " + sheet.getName().length + ")" +
      "  hidden: " + sheet.isSheetHidden()
    );

  });

  Logger.log("CONFIG.ACQ.SUMMARY_SHEET = \"" + CONFIG.ACQ.SUMMARY_SHEET + "\"");

}