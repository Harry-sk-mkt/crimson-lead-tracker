/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — S&M_REP New P1 주간 breakdown, 리드 단위 상세 추적
 *
 * Responsibility
 * OpenItems.md #27 — S&M_REP Leads breakdown(Event/BOFU/Content/Organic)
 * New P1 건수가 8/17~08/23 주 기준 Salesforce 리포트보다 전부 적게 나옴
 * (Event 30→26 / BOFU 5→4 / Content 35→29 / Organic 3→2). 타임존 가설
 * (TEMPQA_025)과 Leads_Master 완전동일 중복(2026-08-25 세션에
 * runAutoDeleteExactDuplicateLeadRows() 재실행, 0건 확인)은 둘 다 기각/무관
 * 확인됨 — 이번엔 그 주(Create Date 기준)에 해당하는 Leads_OPS 레코드를
 * 전부 Lead ID 단위로 로그에 남겨, 사용자가 Salesforce 목록과 1:1 대조해
 * 정확히 어느 리드가 빠졌는지/잘못 분류됐는지 특정할 수 있게 한다.
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA_005/009/017/025와 동일 관례).
 *
 * INPUT: 없음 (Leads_OPS 직접 스캔)
 * OUTPUT: Logger.log만 —
 *   (1) computeSMRepWeeklyAggregates_()와 동일 로직으로 재계산한 New Leads/
 *       New P1/leadsBreakdown 합계(S&M_REP 표시값과 반드시 일치해야 함 —
 *       다르면 집계 로직 자체가 아니라 이 스크립트나 시트 상태 문제)
 *   (2) 그 주 Create Date를 가진 모든 Leads_OPS 레코드의 Lead ID/Email/
 *       Create Date/Lead Priority/Priority Override/isP1/Business Segment/
 *       배정된 breakdown 버킷(또는 "매핑 없음") 전체 목록
 *   (3) New P1인데 breakdown 어느 버킷에도 안 잡힌 레코드만 따로 모아 표시
 *       (Segment가 LEADS_SEGMENT_BUCKET_MAP에 없는 값이거나 공백인 경우 —
 *       설계상 의도된 제외(예: Search)인지 진짜 미분류 데이터인지 구분 필요)
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 조사 스크립트(TEMPQA 관례).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-08-25)
 * - 최초 구현.
 * ==========================================================
 */

function runTraceSMRepNewP1WeekLeads(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const opsSheet = ss.getSheetByName(OPS.SHEET.OPS);

  if(!opsSheet){
    Logger.log(OPS.SHEET.OPS + " 시트를 찾을 수 없습니다.");
    return;
  }

  const targetWeekKey = "2026-08-17";  // 사용자가 Salesforce와 대조한 주(월요일)

  const records = sheetToObjects(opsSheet);

  const leadsMap = CONFIG.SM_REP.LEADS_SEGMENT_BUCKET_MAP;

  const totals = {
    newLeads: 0,
    newP1: 0,
    leadsBreakdown: { Event: 0, BOFU: 0, Content: 0, Organic: 0, Referral: 0 }
  };

  const weekRecords = [];
  const p1UnmappedRecords = [];

  records.forEach(function(record){

    const createDate = record["Create Date"];

    if(!(createDate instanceof Date) || isNaN(createDate.getTime())) return;

    const weekKey = Utilities.formatDate(
      getMondayOfWeek_(createDate),
      CONFIG.DATE.TIMEZONE,
      "yyyy-MM-dd"
    );

    if(weekKey !== targetWeekKey) return;

    const isP1 = isEffectiveP1_(record["Lead Priority"], record["Priority Override"]);
    const segment = String(record["Business Segment"] || "").trim();
    const bucket = leadsMap[segment];

    totals.newLeads++;
    if(isP1) totals.newP1++;
    if(bucket && isP1) totals.leadsBreakdown[bucket]++;

    const line =
      "Lead ID=" + record["Lead ID"] +
      " / Email=" + record["Email"] +
      " / Create Date=" + Utilities.formatDate(createDate, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd HH:mm") +
      " / Lead Priority=" + record["Lead Priority"] +
      " / Priority Override=" + record["Priority Override"] +
      " / isP1=" + isP1 +
      " / Business Segment=" + segment +
      " / Bucket=" + (bucket || "(매핑 없음)");

    weekRecords.push(line);

    if(isP1 && !bucket){
      p1UnmappedRecords.push(line);
    }

  });

  Logger.log("========== S&M_REP " + targetWeekKey + "주 재계산 합계 (S&M_REP 표시값과 대조) ==========");
  Logger.log("New Leads : " + totals.newLeads);
  Logger.log("New P1    : " + totals.newP1);
  Logger.log("Event     : " + totals.leadsBreakdown.Event);
  Logger.log("BOFU      : " + totals.leadsBreakdown.BOFU);
  Logger.log("Content   : " + totals.leadsBreakdown.Content);
  Logger.log("Organic   : " + totals.leadsBreakdown.Organic);
  Logger.log("Referral  : " + totals.leadsBreakdown.Referral);

  Logger.log("");
  Logger.log("========== 해당 주 Leads_OPS 레코드 전체 (" + weekRecords.length + "건, Salesforce와 1:1 대조용) ==========");
  weekRecords.forEach(function(line){ Logger.log(line); });

  Logger.log("");
  Logger.log("========== New P1인데 breakdown 어느 버킷에도 안 잡힌 레코드 (" + p1UnmappedRecords.length + "건) ==========");
  p1UnmappedRecords.forEach(function(line){ Logger.log(line); });

}
