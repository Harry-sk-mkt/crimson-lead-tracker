/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — NewP1_REP 8월 Search Revenue 누락 확인 (2026-08-19)
 *
 * Responsibility
 * 사용자 리포트: "newP1REP 8월에 $73,029.39 search 레베뉴가 있는데 안잡혀".
 * NewP1_REP의 Won/Revenue는 딜의 **Created Date** 기준으로 (FY|Month|Segment)
 * 코호트에 집계된다(computeNewP1DealWonRevenueFromRows_(), NEWP1REP_001_Report.js
 * — Close Date 아님, 2026-07-28 확정 설계 — 파일 헤더 WHY 참고). 그래서 사용자가
 * "8월 Revenue"를 Close Date 기준으로 확인했다면, Created Date가 다른 달인
 * 딜은 그 달 아래에 잡히는 게 설계대로고, Created Date가 아예 비어있으면
 * (`if(!row.createdDate) return;`) 통째로 제외돼 사라진다 — 이번 케이스가
 * 둘 중 무엇인지 실제 딜을 하나하나 찍어서 확인한다(추측 금지, No Assumptions).
 *
 * WHY
 * Won/Revenue 축이 Close Date가 아니라 Created Date라는 설계를 사용자가
 * 놓쳤을 수도 있고(오해 — 설계대로), 아니면 Created Date 공란으로 딜이
 * 통째로 누락되는 실제 버그일 수도 있다 — 결과를 보고 둘 중 하나로 명확히
 * 좁힌다. 새 시트는 만들지 않고 Logger.log로만 출력(TEMPQA 관례,
 * docs/apps-script-gotchas.md #8 워크북 셀 개수 상한 문제 예방).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-08-19)
 * - 최초 구현.
 * ==========================================================
 */


/**
 * ==========================================================
 * Run Diagnose NewP1 August Search Revenue Gap (읽기 전용, 안전)
 *
 * OUTPUT (Logger.log)
 * (A) Close Date 기준 FY27 AUG Search 건별 내역 + 합계 — 사용자가 눈으로 확인한 축
 * (B) Created Date 기준 FY27 AUG Search 합계 — NewP1_REP이 실제로 집계하는 축
 * (C) (A) 중 Created Date가 없어 NewP1_REP에서 완전히 누락되는 건
 * ==========================================================
 */
function runDiagnoseNewP1AugustSearchRevenueGap(){

  const TARGET_FY = 27;      // 2026년 8월 = FY27 AUG (getFiscalYear() 관례: 8월부터 FY+1)
  const TARGET_MONTH = "AUG";
  const TARGET_SEGMENT = "Search";

  const dealRows = readDealTrackerRawRows_();

  Logger.log("Deal Tracker 전체 행 수: " + dealRows.length);

  // (A) Close Date 기준 — 사용자가 눈으로 확인한 "8월 Search Revenue"와 같은 축
  const byCloseDate = dealRows.filter(function(row){
    return row.closeFY === TARGET_FY &&
      row.closeDate instanceof Date &&
      getFiscalMonthLabel(row.closeDate) === TARGET_MONTH &&
      row.businessSegment === TARGET_SEGMENT;
  });

  const closeDateSum = byCloseDate.reduce(function(sum, r){ return sum + (Number(r.revenue) || 0); }, 0);

  Logger.log("=== (A) Close Date 기준 FY" + TARGET_FY + " " + TARGET_MONTH + " " + TARGET_SEGMENT + " ===");
  Logger.log("건수: " + byCloseDate.length + " / Revenue 합계: " + closeDateSum);

  byCloseDate.forEach(function(row, i){
    Logger.log(
      (i + 1) + ". closeDate=" + row.closeDate +
      " createdDate=" + (row.createdDate || "(없음)") +
      " createdFY=" + row.createdFY +
      " createdMonth=" + (row.createdDate ? getFiscalMonthLabel(row.createdDate) : "(없음)") +
      " revenue=" + row.revenue +
      " leadSource=" + row.leadSource +
      " sourceCategory=" + row.sourceCategory
    );
  });

  // (B) Created Date 기준 — NewP1_REP이 실제로 집계하는 축(computeNewP1DealWonRevenueFromRows_())
  const byCreatedDate = dealRows.filter(function(row){
    return row.createdDate instanceof Date &&
      row.createdFY === TARGET_FY &&
      getFiscalMonthLabel(row.createdDate) === TARGET_MONTH &&
      row.businessSegment === TARGET_SEGMENT;
  });

  const createdDateSum = byCreatedDate.reduce(function(sum, r){ return sum + (Number(r.revenue) || 0); }, 0);

  Logger.log(
    "=== (B) Created Date 기준(NewP1_REP이 실제로 쓰는 축) FY" + TARGET_FY + " " +
    TARGET_MONTH + " " + TARGET_SEGMENT + " ==="
  );
  Logger.log("건수: " + byCreatedDate.length + " / Revenue 합계: " + createdDateSum);

  // (C) Close Date는 8월인데 Created Date가 없어서 통째로 누락되는 케이스
  const missingCreatedDate = byCloseDate.filter(function(row){ return !row.createdDate; });
  const missingSum = missingCreatedDate.reduce(function(sum, r){ return sum + (Number(r.revenue) || 0); }, 0);

  Logger.log("=== (C) Close Date는 8월인데 Created Date가 없어 NewP1_REP에서 완전히 누락되는 건 ===");
  Logger.log("건수: " + missingCreatedDate.length + " / Revenue 합계: " + missingSum);

  Logger.log(
    "요약 — 사용자가 본 8월 Search Revenue($73,029.39 근처)는 (A)와 비교하세요. " +
    "NewP1_REP에 실제로 반영되는 값은 (B)입니다. (A)-(B) 차이가 (C)(Created Date 없음)로 " +
    "설명되면 실제 누락 버그, Created Date가 유효하되 다른 달로 찍혀서라면 설계대로 " +
    "(Close Date축 vs Created Date축 차이 — Revenue가 다른 달 아래 잡혀있는 것)입니다."
  );

}
