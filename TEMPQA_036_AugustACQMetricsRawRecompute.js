/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — ACQ_REP 8월 All Leads/All P1/New P1/IC Booked/IC Complete
 * 원본 재계산 대조 (docs/OpenItems.md #32 후속 조사)
 *
 * Responsibility
 * 사용자가 Salesforce 기준 기대값(All Leads 2074/All P1 1033/New P1 279/
 * IC Booked 52/IC Complete 30)과 ACQ_REP 화면 표시값(2105/1045/267/43/30)
 * 사이에 5개 지표 전부 어긋나 있다고 보고. 두 가지를 구분해야 한다:
 * (1) ACQ_REP 화면(Report Area)이 최신 refreshACQSummary_() 결과를
 *     반영 못 하고 있는 "화면 갱신 지연"인지 (과거 #20 항목에서 실제로
 *     한 차례 발생한 패턴),
 * (2) 원본 시트(MTA_Master/Leads_OPS) 자체를 실제 프로덕션 집계 함수
 *     (computeMTAAggregates_()/computeOPSAggregates_(), ACQREP_001_Report.js)
 *     로 그대로 재계산해도 화면과 같은 값이 나오는 "진짜 데이터 갭"인지.
 *
 * 이 스크립트는 프로덕션 집계 함수를 그대로 호출해(로직 재구현 없음,
 * 이중 유지보수 방지) 원본 재계산 값만 뽑는다. 이 값이 ACQ_REP 화면과
 * 다르면 (1) 화면 갱신 지연, 같으면 (2) 진짜 데이터 갭으로 좁혀진다.
 *
 * **읽기 전용** — computeMTAAggregates_()/computeOPSAggregates_() 둘 다
 * 시트 읽기만 하는 순수 함수라 아무것도 쓰지 않음(TEMPQA 관례).
 *
 * INPUT: 없음 (MTA_Master/Leads_OPS 전체 스캔, 오늘 날짜 기준 현재
 *   Fiscal Year/Month로 자동 필터)
 * OUTPUT: Logger.log만
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 조사 스크립트(TEMPQA 관례).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-08-28)
 * - 최초 구현.
 * ==========================================================
 */
function runRecomputeAugustACQMetricsRaw(){

  const now = new Date();
  const fy = Number(getFiscalYear(now).replace("FY", ""));
  const month = getFiscalMonthLabel(now);
  const prefix = fy + "|" + month + "|";

  Logger.log("========== 기준: FY" + fy + " / " + month + " (오늘 " +
    Utilities.formatDate(now, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd") + ") ==========");

  function sumByPrefix(obj){
    let total = 0;
    const bySegment = {};
    Object.keys(obj).forEach(function(key){
      if(key.indexOf(prefix) !== 0) return;
      const segment = key.substring(prefix.length);
      bySegment[segment] = obj[key];
      total += obj[key];
    });
    return { total: total, bySegment: bySegment };
  }

  const mta = computeMTAAggregates_(null, null);
  const ops = computeOPSAggregates_(null, null);

  const allLeads = sumByPrefix(mta.allLeads);
  const allP1 = sumByPrefix(mta.allP1);
  const newLeads = sumByPrefix(ops.newLeads);
  const newP1 = sumByPrefix(ops.newP1);
  const icBooked = sumByPrefix(ops.icBooked);
  const icComplete = sumByPrefix(ops.icComplete);

  Logger.log("");
  Logger.log("---- 원본 재계산 (production 집계 함수 그대로 호출) ----");
  Logger.log("All Leads    : " + allLeads.total + "  (세그먼트별: " + JSON.stringify(allLeads.bySegment) + ")");
  Logger.log("All P1       : " + allP1.total + "  (세그먼트별: " + JSON.stringify(allP1.bySegment) + ")");
  Logger.log("New Leads    : " + newLeads.total + "  (세그먼트별: " + JSON.stringify(newLeads.bySegment) + ")");
  Logger.log("New P1       : " + newP1.total + "  (세그먼트별: " + JSON.stringify(newP1.bySegment) + ")");
  Logger.log("IC Booked    : " + icBooked.total + "  (세그먼트별: " + JSON.stringify(icBooked.bySegment) + ")");
  Logger.log("IC Complete  : " + icComplete.total + "  (세그먼트별: " + JSON.stringify(icComplete.bySegment) + ")");

  Logger.log("");
  Logger.log("---- All Leads의 Per-Touch 특성 확인 (MTA_Master 고유 Lead ID 수 대조) ----");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const mtaSheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);
  const mtaRecords = sheetToObjects(mtaSheet);

  const uniqueLeadIdsThisMonth = {};
  let touchRowsThisMonth = 0;

  mtaRecords.forEach(function(r){
    const date = r["MTA Created Date"];
    if(!(date instanceof Date) || isNaN(date.getTime())) return;
    const rowFy = Number(getFiscalYear(date).replace("FY", ""));
    const rowMonth = getFiscalMonthLabel(date);
    if(rowFy !== fy || rowMonth !== month) return;
    touchRowsThisMonth++;
    const leadId = String(r["Lead ID"] || "").trim();
    if(leadId) uniqueLeadIdsThisMonth[leadId] = (uniqueLeadIdsThisMonth[leadId] || 0) + 1;
  });

  const uniqueCount = Object.keys(uniqueLeadIdsThisMonth).length;
  const multiTouchLeadIds = Object.keys(uniqueLeadIdsThisMonth).filter(function(id){
    return uniqueLeadIdsThisMonth[id] > 1;
  });

  Logger.log("MTA_Master 이번 달 터치 행 수(=All Leads 집계 방식) : " + touchRowsThisMonth);
  Logger.log("MTA_Master 이번 달 고유 Lead ID 수                  : " + uniqueCount);
  Logger.log("2개 이상 터치를 가진 Lead ID 수                     : " + multiTouchLeadIds.length);
  Logger.log("(터치행수 - 고유Lead수 = " + (touchRowsThisMonth - uniqueCount) +
    " — 이 차이만큼 Per-Touch 집계가 고유 리드 수보다 부풀려짐, 설계상 의도된 것인지 확인 필요)");

}
