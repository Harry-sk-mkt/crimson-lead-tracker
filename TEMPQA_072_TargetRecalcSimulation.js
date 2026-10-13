/**
 * ==========================================================
 * Marketing 2.0
 * TEMPQA — Target 재산출 시뮬레이션 (12개월 롤링 / 3개월 이동평균, 읽기 전용)
 *
 * Responsibility
 * FY27 Target(현재: FY26 단일 스냅샷 + 총합 3627 오버라이드)이 10월 중순 현재
 * 현실을 반영하는지 확인하기 위해, 같은 엔진 함수를 기준 기간만 바꿔 다시 돌려
 * 결과를 Logger로만 비교 출력한다. **시트에 아무것도 쓰지 않는다.**
 *
 * WHY (2026-10-13, 사용자 요청)
 * - 사용자: "최근 12개월·3개월 moving average를 반영하려 했었다" — 확인 결과
 *   현재 설계/코드엔 둘 다 없음(docs/Changelog.md 10-13). 사용자 확정 용도 분리:
 *   12개월 롤링 = 목표 구조(세그먼트 배분·CPNP1 벤치마크) 대체 후보,
 *   3개월 = 최근 속도로 총목표 3627의 현실성 점검.
 * - 엔진 로직을 복제하지 않으려고, 딜 행의 closeFY/createdFY를 "기준 기간 안이면
 *   SENTINEL_FY"로 바꾼 사본을 만들고 CONFIG.TARGET.P1_VALUE_FY를 잠시 SENTINEL_FY로
 *   바꿔(finally에서 원복) 기존 함수(computeDealShareRatiosFromDealRows_ 등)를
 *   그대로 호출한다. 검증용으로 FY26 기간도 같은 방식으로 돌려 Target_Engine
 *   Block C의 현재 값과 일치하는지 함께 출력한다.
 *
 * 출력 (runSimulateTargetRecalc())
 *   [1] 검증: FY26 재계산 vs Target_Engine Block C 현재 FY 목표 (일치해야 방법 신뢰)
 *   [2] 세그먼트 FY 목표: 현재 / 12개월 롤링 기준 (둘 다 총합 오버라이드 적용)
 *   [3] YTD 페이스: 주간 목표 합 vs 실제 New P1, 달성률
 *   [4] FY 끝 예상: (a) 시즌성 반영 = 달성률 × FY 목표, (b) 3개월 속도 = YTD + 3M 주평균 × 남은 주
 *   [5] CPNP1: 현재 목표(내재값) / FY26 / 12개월 / 3개월 / YTD 실제
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-10-13)
 * - 최초 작성. 테스트 `testTargetRecalcSimulationHelpers()`.
 * ==========================================================
 */

const TARGET_RECALC_SIM = {
  SENTINEL_FY: 9999,
  // 끝난 달만 쓴다(end는 미포함). 12개월 = 2025-10 ~ 2026-09, 3개월 = 2026-07 ~ 2026-09.
  WINDOWS: {
    FY26: { label: "FY26(현재 기준)", start: new Date(2025, 7, 1), end: new Date(2026, 7, 1),
            months: [[26, "AUG"], [26, "SEP"], [26, "OCT"], [26, "NOV"], [26, "DEC"], [26, "JAN"],
                     [26, "FEB"], [26, "MAR"], [26, "APR"], [26, "MAY"], [26, "JUN"], [26, "JUL"]] },
    M12:  { label: "최근 12개월", start: new Date(2025, 9, 1), end: new Date(2026, 9, 1),
            months: [[26, "OCT"], [26, "NOV"], [26, "DEC"], [26, "JAN"], [26, "FEB"], [26, "MAR"],
                     [26, "APR"], [26, "MAY"], [26, "JUN"], [26, "JUL"], [27, "AUG"], [27, "SEP"]] },
    M3:   { label: "최근 3개월", start: new Date(2026, 6, 1), end: new Date(2026, 9, 1),
            months: [[26, "JUL"], [27, "AUG"], [27, "SEP"]] }
  }
};


/**
 * 기간 포함 여부(start 포함, end 미포함). Date가 아니면 false.
 */
function isDateInSimWindow_(date, window){
  return date instanceof Date && !isNaN(date.getTime()) && date >= window.start && date < window.end;
}


/**
 * 딜 행 사본: 기간 안이면 closeFY/createdFY를 SENTINEL_FY, 아니면 -1로 바꾼다.
 * 엔진 함수가 "closeFY === P1_VALUE_FY && createdFY === P1_VALUE_FY"(코호트1) /
 * "closeFY === P1_VALUE_FY && createdFY !== P1_VALUE_FY"(코호트2)로 판정하므로
 * P1_VALUE_FY를 SENTINEL_FY로 두면 "기간 안 생성·클로징 / 기간 전 생성·기간 안 클로징"이 된다.
 */
function mapDealRowsToSimWindow_(dealRows, window){
  const S = TARGET_RECALC_SIM.SENTINEL_FY;
  return dealRows.map(function(row){
    return Object.assign({}, row, {
      closeFY: isDateInSimWindow_(row.closeDate, window) ? S : -1,
      createdFY: isDateInSimWindow_(row.createdDate, window) ? S : (row.createdDate ? -1 : null)
    });
  });
}


/**
 * 기간 안에 생성된 유효 P1을 그룹별로 센다(엔진의 newP1CountByGroup과 같은 정의).
 */
function countNewP1ByGroupInWindow_(p1Records, window){
  const counts = {};
  CONFIG.TARGET.GROUP_ORDER.forEach(function(g){ counts[g] = 0; });
  p1Records.forEach(function(r){
    if(isDateInSimWindow_(r.createDate, window)) counts[r.group]++;
  });
  return counts;
}


/**
 * 기존 엔진 함수로 기간 기준 세그먼트 FY 목표(총합 오버라이드 적용 후)를 계산.
 */
function computeSimFYTargetsForWindow_(window, dealRows, p1Records, totalP1CountByGroup, inputs){

  const mapped = mapDealRowsToSimWindow_(dealRows, window);
  const newP1 = countNewP1ByGroupInWindow_(p1Records, window);
  const originalFY = CONFIG.TARGET.P1_VALUE_FY;

  try {

    CONFIG.TARGET.P1_VALUE_FY = TARGET_RECALC_SIM.SENTINEL_FY;

    const cohorts = computeDealCohortsFromDealRows_(mapped);
    const p1ValueRows = computeP1ValueBlockRows_(cohorts, newP1, totalP1CountByGroup);
    const p1ValueByGroup = {};
    p1ValueRows.forEach(function(r){ p1ValueByGroup[r.group] = { currentFYP1V: r.currentFYP1V, prevP1V: r.prevP1V }; });

    const dealShare = computeDealShareRatiosFromDealRows_(mapped);
    const pipelineShare = computeDealShareRatiosCohort2FromDealRows_(mapped);
    const split = resolveNewPipelineSplit_(computeNewPipelineRevenueSplit_(mapped), inputs.pipelineShareOverride);

    const rows = applyFYNewP1TargetOverride_(
      computeDealShareBlockRows_(inputs, dealShare, pipelineShare, p1ValueByGroup, split),
      inputs.newP1TargetOverride
    );

    const byGroup = {};
    rows.forEach(function(r){ byGroup[r.group] = r.totalP1Target; });

    return { targets: byGroup, newP1: newP1, p1ValueRows: p1ValueRows };

  } finally {
    CONFIG.TARGET.P1_VALUE_FY = originalFY;
  }

}


function sumSpendForMonths_(spendMap, months, group){
  return months.reduce(function(sum, fm){
    return sum + (Number(spendMap[fm[0] + "|" + fm[1] + "|" + group]) || 0);
  }, 0);
}


function fmtSim_(n, digits){
  if(n === null || n === undefined || isNaN(n) || !isFinite(n)) return "-";
  return Number(n).toFixed(digits === undefined ? 0 : digits);
}


function runSimulateTargetRecalc(){

  const W = TARGET_RECALC_SIM.WINDOWS;
  const groups = CONFIG.TARGET.GROUP_ORDER;
  const L = function(s){ Logger.log(s); };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const inputs = readTargetEngineInputs_(ss.getSheetByName(CONFIG.TARGET.ENGINE_SHEET));

  // Leads_OPS 1회 스캔 — 유효 P1만 (group, createDate)로 축약
  const totalP1CountByGroup = {};
  groups.forEach(function(g){ totalP1CountByGroup[g] = 0; });
  const p1Records = [];
  sheetToObjects(ss.getSheetByName(OPS.SHEET.OPS)).forEach(function(rec){
    const group = deriveTargetGroup_(rec["Business Segment"]);
    if(!group || !isEffectiveP1_(rec["Lead Priority"], rec["Priority Override"])) return;
    totalP1CountByGroup[group]++;
    if(rec["Create Date"] instanceof Date) p1Records.push({ group: group, createDate: rec["Create Date"] });
  });

  const dealRows = readDealTrackerRawRows_();
  const blockC = readTargetEngineDealShareRows_();
  const derivation = readTargetEngineDerivationRows_();
  const monthlySpend = readAdSpendCacheMap_();
  const weeklySpend = readAdSpendWeeklyCacheMap_();

  const thisMonday = getMondayOfWeek_(new Date());
  // Cutover는 Target_Engine 입력 셀 값 우선(Target_REP·주간 캐시와 같은 기준), 없으면 CONFIG 기본값
  const cutover = getMondayOfWeek_(inputs.cutoverDate instanceof Date ? inputs.cutoverDate : CONFIG.TARGET.CUTOVER_DATE);
  const toKey = function(d){ return Utilities.formatDate(d, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd"); };

  const currentFY = {};
  blockC.forEach(function(r){ currentFY[r.group] = Number(r.totalP1Target) || 0; });

  // [1] 검증 + [2] 12개월 기준 목표
  const simFY26 = computeSimFYTargetsForWindow_(W.FY26, dealRows, p1Records, totalP1CountByGroup, inputs);
  const sim12 = computeSimFYTargetsForWindow_(W.M12, dealRows, p1Records, totalP1CountByGroup, inputs);
  const newP1_3M = countNewP1ByGroupInWindow_(p1Records, W.M3);

  L("===== [1] 방법 검증: FY26 기간 재계산 vs Target_Engine 현재 FY 목표 (같아야 함) =====");
  groups.forEach(function(g){
    L(g + "\t현재 " + fmtSim_(currentFY[g], 1) + "\t재계산 " + fmtSim_(simFY26.targets[g], 1));
  });

  L("===== [2] 세그먼트 FY27 목표: 현재(FY26 기준) vs 최근 12개월 기준 (총합 오버라이드 동일 적용) =====");
  L("세그먼트\t현재목표\t비중\t12개월목표\t비중\t차이\t| 근거 New P1: FY26 / 12개월 / 3개월");
  const sumCur = groups.reduce(function(s, g){ return s + (currentFY[g] || 0); }, 0);
  const sum12 = groups.reduce(function(s, g){ return s + (sim12.targets[g] || 0); }, 0);
  groups.forEach(function(g){
    L(g + "\t" + fmtSim_(currentFY[g]) + "\t" + fmtSim_(100 * currentFY[g] / sumCur, 1) + "%\t" +
      fmtSim_(sim12.targets[g]) + "\t" + fmtSim_(100 * sim12.targets[g] / sum12, 1) + "%\t" +
      fmtSim_(sim12.targets[g] - currentFY[g]) + "\t| " +
      simFY26.newP1[g] + " / " + sim12.newP1[g] + " / " + newP1_3M[g]);
  });
  L("합계\t" + fmtSim_(sumCur) + "\t\t" + fmtSim_(sum12));

  // [3] YTD 페이스 (Cutover 주 ~ 지난주)
  const ytdTarget = {}, remWeeks = {}, ytdCPNP1Num = {}, ytdCPNP1Den = {};
  groups.forEach(function(g){ ytdTarget[g] = 0; remWeeks[g] = 0; ytdCPNP1Num[g] = 0; ytdCPNP1Den[g] = 0; });
  derivation.forEach(function(r){
    if(groups.indexOf(r.group) === -1) return;
    if(r.weekStart >= cutover && r.weekStart < thisMonday){
      ytdTarget[r.group] += Number(r.weeklyP1Target) || 0;
      ytdCPNP1Num[r.group] += (Number(r.weeklyP1Target) || 0) * (Number(r.weeklyCPNP1Target) || 0);
      ytdCPNP1Den[r.group] += Number(r.weeklyP1Target) || 0;
    } else if(r.weekStart >= thisMonday){
      remWeeks[r.group]++;
    }
  });

  const ytdWindow = { start: cutover, end: thisMonday };
  const ytdActual = countNewP1ByGroupInWindow_(p1Records, ytdWindow);
  const ytdWeeks = Math.round((thisMonday - cutover) / (7 * 86400000));
  const m3Weeks = (W.M3.end - W.M3.start) / (7 * 86400000);

  L("===== [3] YTD 페이스 (" + toKey(cutover) + " ~ " + toKey(new Date(thisMonday.getTime() - 86400000)) + ", " + ytdWeeks + "주) =====");
  L("세그먼트\tYTD목표\tYTD실제\t달성률");
  let tT = 0, tA = 0;
  groups.forEach(function(g){
    tT += ytdTarget[g]; tA += ytdActual[g];
    L(g + "\t" + fmtSim_(ytdTarget[g], 1) + "\t" + ytdActual[g] + "\t" + fmtSim_(100 * ytdActual[g] / ytdTarget[g], 1) + "%");
  });
  L("합계\t" + fmtSim_(tT, 1) + "\t" + tA + "\t" + fmtSim_(100 * tA / tT, 1) + "%");

  // [4] FY 끝 예상
  L("===== [4] FY27 끝 예상 New P1 (남은 주 " + remWeeks[groups[0]] + "주) =====");
  L("세그먼트\tFY목표\t(a)시즌성반영\t(b)3개월속도\t3M주평균");
  let pA = 0, pB = 0;
  groups.forEach(function(g){
    const a = ytdTarget[g] > 0 ? ytdActual[g] * currentFY[g] / ytdTarget[g] : NaN;
    const rate = newP1_3M[g] / m3Weeks;
    const b = ytdActual[g] + rate * remWeeks[g];
    if(!isNaN(a)) pA += a;
    pB += b;
    L(g + "\t" + fmtSim_(currentFY[g]) + "\t" + fmtSim_(a) + "\t" + fmtSim_(b) + "\t" + fmtSim_(rate, 1));
  });
  L("합계\t" + fmtSim_(sumCur) + "\t" + fmtSim_(pA) + "\t" + fmtSim_(pB));

  // [5] CPNP1 (Spend는 Ad_Spend_Cache — Meta+Naver+Kakao, NZD. 현재 벤치마크는 Block 0 수동 취합 Spent라 소스 다름)
  L("===== [5] CPNP1 (NZD) — 현재 목표는 YTD 주간 목표의 가중평균 =====");
  L("세그먼트\t현재목표\tFY26\t12개월\t3개월\tYTD실제");
  groups.forEach(function(g){
    const cur = ytdCPNP1Den[g] > 0 ? ytdCPNP1Num[g] / ytdCPNP1Den[g] : NaN;
    const c26 = sumSpendForMonths_(monthlySpend, W.FY26.months, g) / simFY26.newP1[g];
    const c12 = sumSpendForMonths_(monthlySpend, W.M12.months, g) / sim12.newP1[g];
    const c3 = sumSpendForMonths_(monthlySpend, W.M3.months, g) / newP1_3M[g];
    let ytdSpend = 0;
    Object.keys(weeklySpend).forEach(function(k){
      const parts = k.split("|");
      if(parts[1] === g && parts[0] >= toKey(cutover) && parts[0] < toKey(thisMonday)) ytdSpend += Number(weeklySpend[k]) || 0;
    });
    L(g + "\t" + fmtSim_(cur) + "\t" + fmtSim_(c26) + "\t" + fmtSim_(c12) + "\t" + fmtSim_(c3) + "\t" +
      fmtSim_(ytdSpend / ytdActual[g]) + " (Spend " + fmtSim_(ytdSpend) + " / P1 " + ytdActual[g] + ")");
  });

  L("참고: 12개월 기준 P1당 가치(코호트1 매출 ÷ New P1) — " + sim12.p1ValueRows.map(function(r){
    return r.group + " " + fmtSim_(r.currentFYP1V) + " (R1 " + fmtSim_(r.cohort1Revenue) + ")";
  }).join(" | "));

}


function testTargetRecalcSimulationHelpers(){

  const w = { start: new Date(2025, 9, 1), end: new Date(2026, 9, 1) };
  const S = TARGET_RECALC_SIM.SENTINEL_FY;

  const inWin = isDateInSimWindow_(new Date(2026, 8, 30), w) &&
    !isDateInSimWindow_(new Date(2026, 9, 1), w) &&
    isDateInSimWindow_(new Date(2025, 9, 1), w) &&
    !isDateInSimWindow_("2026-01-01", w);

  const mapped = mapDealRowsToSimWindow_([
    { closeDate: new Date(2026, 0, 5), createdDate: new Date(2025, 11, 1), revenue: 1 },  // 코호트1
    { closeDate: new Date(2026, 0, 5), createdDate: new Date(2025, 0, 1), revenue: 2 },   // 코호트2
    { closeDate: new Date(2025, 5, 1), createdDate: new Date(2025, 4, 1), revenue: 3 },   // 기간 밖
    { closeDate: new Date(2026, 0, 5), createdDate: null, revenue: 4 }                    // 생성일 없음
  ], w);

  const mapOk =
    mapped[0].closeFY === S && mapped[0].createdFY === S &&
    mapped[1].closeFY === S && mapped[1].createdFY === -1 &&
    mapped[2].closeFY === -1 &&
    mapped[3].closeFY === S && mapped[3].createdFY === null;

  const pass = inWin && mapOk;
  Logger.log("testTargetRecalcSimulationHelpers: " + (pass ? "PASS" : "FAIL"));
  return pass;

}
