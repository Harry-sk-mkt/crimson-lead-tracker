/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — FY27 AUG ACQ_Summary 캐시 vs 원본 재계산 대조
 *
 * Responsibility
 * JL 외부 시트 export 기능(docs/OpenItems.md #37) 검증 중, `readACQSummaryMap_()`로
 * 읽은 FY27 AUG New P1 합계(309)가 사용자가 아는 실측값(874)보다 크게(약 65%)
 * 낮게 나온 것을 발견 — SAL(243 vs 305)/IC Complete(30 vs 36)도 같은 방향으로
 * 낮음. Revenue만 거의 일치(1,653,404 vs 1,661,224). `TEMPQA_036_
 * AugustACQMetricsRawRecompute.js`가 "오늘 기준 fiscal month"만 다뤄 지금
 * (9월) 실행하면 8월이 아니라 9월을 조사하게 되므로, FY27 AUG를 고정 대상으로
 * 재계산하는 버전을 새로 만든다(기존 파일은 TEMPQA 관례상 수정하지 않음).
 *
 * 이 스크립트는 두 가지를 구분한다:
 * (1) ACQ_Summary 캐시가 최근 Import/Rebuild를 못 따라가 stale한 것인지 —
 *     `computeMTAAggregates_()`/`computeOPSAggregates_()`(프로덕션 함수,
 *     원본 MTA_Master/Leads_OPS 전체 재스캔)로 다시 계산한 값이 캐시보다
 *     크면 stale(=refreshACQSummary_() 재실행으로 해결).
 * (2) 원본을 재스캔해도 캐시와 같은 낮은 값이 나오면 "진짜 데이터 갭" —
 *     Revenue만 최신인 이유(refreshACQSummaryRevenueOnly_()가 Generate
 *     클릭 시점마다 Deal Tracker 기준으로 Revenue만 갱신, 나머지 필드는
 *     Import 때만 갱신)가 유력한 원인 후보.
 *
 * **읽기 전용** — 프로덕션 집계 함수 재호출만, 아무것도 쓰지 않음(TEMPQA 관례).
 *
 * INPUT: 없음 (FY27 AUG 고정, MTA_Master/Leads_OPS 전체 스캔)
 * OUTPUT: Logger.log만
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 조사 스크립트(TEMPQA 관례).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-09-01)
 * - 최초 구현.
 * ==========================================================
 */
function runCheckAugustACQSummaryStaleness(){

  const TARGET_FY = 27;
  const TARGET_MONTH = "AUG";
  const prefix = TARGET_FY + "|" + TARGET_MONTH + "|";

  Logger.log("========== 기준: FY" + TARGET_FY + " / " + TARGET_MONTH + " (고정) ==========");

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

  // ---- (1) ACQ_Summary 캐시에서 그대로 읽기 ----
  const summaryMap = readACQSummaryMap_();
  const segments = CONFIG.ACQ.SEGMENTS;

  let cacheNewP1 = 0, cacheSal = 0, cacheIcBooked = 0, cacheIcComplete = 0, cacheRevenue = 0;
  const cacheBySegment = {};

  segments.forEach(function(segment){
    const row = summaryMap[TARGET_FY + "|" + TARGET_MONTH + "|" + segment];
    if(!row) return;
    cacheNewP1 += row.newP1;
    cacheSal += row.sal;
    cacheIcBooked += row.icBooked;
    cacheIcComplete += row.icComplete;
    cacheRevenue += row.revenue;
    cacheBySegment[segment] = row;
  });

  Logger.log("");
  Logger.log("---- (1) ACQ_Summary 캐시 (readACQSummaryMap_()) ----");
  Logger.log("New P1      : " + cacheNewP1);
  Logger.log("SAL         : " + cacheSal);
  Logger.log("IC Booked   : " + cacheIcBooked);
  Logger.log("IC Complete : " + cacheIcComplete);
  Logger.log("Revenue     : " + cacheRevenue);
  Logger.log("세그먼트별   : " + JSON.stringify(cacheBySegment));

  // ---- (2) 원본 MTA_Master/Leads_OPS/Deal Tracker 재스캔(프로덕션 집계 함수 그대로 호출) ----
  const mta = computeMTAAggregates_(null, null);
  const ops = computeOPSAggregates_(null, null);
  const dealRevenue = computeACQDealRevenueFromRows_(readDealTrackerRawRows_());

  const allLeads = sumByPrefix(mta.allLeads);
  const allP1 = sumByPrefix(mta.allP1);
  const newLeads = sumByPrefix(ops.newLeads);
  const newP1Raw = sumByPrefix(ops.newP1);
  const salRaw = sumByPrefix(ops.sal);
  const icBookedRaw = sumByPrefix(ops.icBooked);
  const icCompleteRaw = sumByPrefix(ops.icComplete);
  const revenueRaw = sumByPrefix(dealRevenue);

  Logger.log("");
  Logger.log("---- (2) 원본 재계산 (production 집계 함수 재호출, 캐시 우회) ----");
  Logger.log("All Leads   : " + allLeads.total + "  (" + JSON.stringify(allLeads.bySegment) + ")");
  Logger.log("All P1      : " + allP1.total + "  (" + JSON.stringify(allP1.bySegment) + ")");
  Logger.log("New Leads   : " + newLeads.total + "  (" + JSON.stringify(newLeads.bySegment) + ")");
  Logger.log("New P1      : " + newP1Raw.total + "  (" + JSON.stringify(newP1Raw.bySegment) + ")");
  Logger.log("SAL         : " + salRaw.total + "  (" + JSON.stringify(salRaw.bySegment) + ")");
  Logger.log("IC Booked   : " + icBookedRaw.total + "  (" + JSON.stringify(icBookedRaw.bySegment) + ")");
  Logger.log("IC Complete : " + icCompleteRaw.total + "  (" + JSON.stringify(icCompleteRaw.bySegment) + ")");
  Logger.log("Revenue     : " + revenueRaw.total + "  (" + JSON.stringify(revenueRaw.bySegment) + ")");

  // ---- (3) 판정 ----
  Logger.log("");
  Logger.log("---- (3) 캐시 vs 원본 재계산 대조 ----");

  [
    ["New P1", cacheNewP1, newP1Raw.total],
    ["SAL", cacheSal, salRaw.total],
    ["IC Booked", cacheIcBooked, icBookedRaw.total],
    ["IC Complete", cacheIcComplete, icCompleteRaw.total],
    ["Revenue", cacheRevenue, revenueRaw.total]
  ].forEach(function(pair){
    const label = pair[0], cached = pair[1], raw = pair[2];
    const diff = raw - cached;
    const verdict = diff === 0
      ? "일치(캐시 최신)"
      : (Math.abs(diff) < 0.01 ? "일치(부동소수점 오차)" : "❌ 불일치 — 캐시가 " + (diff > 0 ? "낮음(stale 의심)" : "높음(원본 재계산 쪽이 낮음, 원인 재조사 필요)"));
    Logger.log(label + " : 캐시=" + cached + " / 원본재계산=" + raw + " / 차이=" + diff + " → " + verdict);
  });

  Logger.log("");
  Logger.log("사용자가 아는 실측값(참고): New P1=874, SAL=305, IC Complete=36, Revenue=1,661,223.62");

}
