/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — Leads_OPS 전체 스캔, 미래 Sales Accepted Date 전수 감사
 * (docs/OpenItems.md #26 후속)
 *
 * Responsibility
 * S&M_REP 개발 중 발견된 미래 SAL 오염(#26)은 TEMPQA_008(swap-back
 * 복구) + TEMPQA_010(잔존값 클리어)으로 대부분 해소됐고, 그때 설명 안
 * 되고 남은 건 3개 Lead ID뿐이었다(TEMPQA_013). 그런데 2026-08-20
 * 사용자가 S&M_REP에서 그 3건으로는 설명 안 되는 **추가** 미래 주(주
 * 시작 2026-08-31/2026-11-30 — 앞서 확인된 3건의 월말 패턴과 동일 계열로
 * 보이나 다른 Lead)에도 SAL 값이 찍혀있다고 보고 — 기존 3개 ID 하드코딩
 * 리스트로는 전체 규모를 알 수 없으므로, Leads_OPS 전체를 스캔해 "오늘
 * 이후" Sales Accepted Date를 가진 행을 전부 나열한다. **읽기 전용** —
 * 아무것도 쓰지 않음(TEMPQA_013과 동일 관례).
 *
 * Version
 * v1.1.0
 *
 * Change Log
 * v1.1.0 (2026-08-20)
 * - Salesforce Field History 조회용으로 Email 컬럼 출력 추가(사용자 요청).
 * v1.0.0 (2026-08-20)
 * - 최초 구현.
 * ==========================================================
 */


function runAuditFutureSalesAcceptedDates(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const today = new Date();

  const opsSheet = ss.getSheetByName(OPS.SHEET.OPS);
  const opsRecords = opsSheet ? sheetToObjects(opsSheet) : [];

  const futureRows = opsRecords.filter(function(r){
    const salDate = r["Sales Accepted Date"];
    return salDate instanceof Date && !isNaN(salDate.getTime()) && salDate > today;
  });

  Logger.log(
    CONFIG.LOG.PREFIX + " 오늘(" +
    Utilities.formatDate(today, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd") +
    ") 이후 Sales Accepted Date를 가진 Leads_OPS 행 " + futureRows.length + "건"
  );

  futureRows.forEach(function(r){

    const salDate = r["Sales Accepted Date"];
    const day = salDate.getDate();
    const isMonthEndPattern = day >= 28;

    Logger.log(
      "Lead ID=" + r["Lead ID"] +
      " / Email=" + r["Email"] +
      " / Sales Accepted Date=" + Utilities.formatDate(salDate, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd") +
      " / 월말(>=28)패턴=" + isMonthEndPattern +
      " / IC Booked Date=" + r["IC Booked Date"] +
      " / IC Completed Date=" + r["IC Completed Date"] +
      " / Opportunity Won Date=" + r["Opportunity Won Date"] +
      " / Lead Priority=" + r["Lead Priority"] +
      " / Business Segment=" + r["Business Segment"]
    );

  });

  Logger.log("");
  Logger.log(
    CONFIG.LOG.PREFIX + " 참고: day>=28(월말)이면서 IC Booked/Completed/Won Date가 전부 " +
    "공란이면 TEMPQA_013에서 확인된 '월말 기본값' 패턴과 동일 계열일 가능성이 높음 — " +
    "day<12(swap 가능 영역)인데 여기 남아있다면 TEMPQA_008 복구 누락 가능성, 별도 확인 필요."
  );

}
