/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — ICFunnel_Raw 자체 재계산 vs Leads_OPS 동기화 결과 대조
 * (docs/OpenItems.md #32/#37 후속 — IC Complete 8월 30건에서 정체된 원인 조사)
 *
 * Responsibility
 * TEMPQA_041 실측 결과 FY27 AUG IC Complete=30(캐시=원본재계산 일치)인데,
 * 이 값이 2026-08-28 TEMPQA_036 실행 시점의 30과 완전히 동일 — 그 사이
 * Salesforce 쪽에서 실제로 몇 건 더 IC Complete 됐다면(사용자 보고
 * 기준값 36) `ICFunnel_Raw`(터치와 무관하게 IC Booked/Completed/Won Date를
 * 직접 export하는 Lead 레벨 리포트, `MASTER_009_ICFunnelSync.js`)가 최근에
 * 재import 안 됐거나, import는 됐는데 `syncICFunnelToOPS_()` 동기화 자체가
 * 안 먹은 두 가지 가능성이 있다. 이 스크립트는 `ICFunnel_Raw` 원본을 직접
 * 재계산해서(코드 재사용 — `pickLatestICFunnelRecords_()`/
 * `computeICFunnelByLeadId_()`, `MASTER_009_ICFunnelSync.js`), Leads_OPS에
 * 이미 동기화된 값과 비교한다:
 * (1) ICFunnel_Raw 원본 재계산도 30이면 → Raw 자체가 오래됨(사용자가
 *     Salesforce에서 재export + "📥 Update → Import IC Funnel" 재실행 필요,
 *     코드 문제 아님).
 * (2) ICFunnel_Raw 원본 재계산이 30보다 크면(예: 36에 근접) → Raw엔 최신
 *     데이터가 있는데 Leads_OPS로의 동기화가 안 먹은 것 — 코드 버그.
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 *
 * INPUT: 없음 (ICFunnel_Raw/Leads_OPS 직접 스캔)
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
function runCheckICFunnelRawFreshness(){

  const TARGET_FY = 27;
  const TARGET_MONTH = "AUG";

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rawSheet = ss.getSheetByName(CONFIG.IC_FUNNEL.SHEET);

  if(!rawSheet){
    Logger.log("❌ " + CONFIG.IC_FUNNEL.SHEET + " 시트가 없습니다 — IC Funnel Import가 한 번도 안 된 상태.");
    return;
  }

  const rawRecords = sheetToObjects(rawSheet);

  Logger.log("ICFunnel_Raw 전체 행 수 : " + rawRecords.length);

  const latestByLeadId = pickLatestICFunnelRecords_(rawRecords);
  const funnelByLeadId = computeICFunnelByLeadId_(latestByLeadId);
  const leadIds = Object.keys(funnelByLeadId);

  Logger.log("ICFunnel_Raw 고유 Lead ID 수(최신 레코드 기준) : " + leadIds.length);

  // ---- ICFunnel_Raw 원본만으로 FY27 AUG IC Booked/Completed/Won 건수 재계산 ----
  let rawIcBooked = 0, rawIcCompleted = 0, rawWon = 0;
  let maxIcCompletedDate = null;

  leadIds.forEach(function(leadId){

    const f = funnelByLeadId[leadId];

    if(f.icBookedDate instanceof Date && !isNaN(f.icBookedDate.getTime())){
      if(Number(getFiscalYear(f.icBookedDate).replace("FY","")) === TARGET_FY &&
         getFiscalMonthLabel(f.icBookedDate) === TARGET_MONTH){
        rawIcBooked++;
      }
    }

    if(f.icCompletedDate instanceof Date && !isNaN(f.icCompletedDate.getTime())){
      if(Number(getFiscalYear(f.icCompletedDate).replace("FY","")) === TARGET_FY &&
         getFiscalMonthLabel(f.icCompletedDate) === TARGET_MONTH){
        rawIcCompleted++;
      }
      if(!maxIcCompletedDate || f.icCompletedDate.getTime() > maxIcCompletedDate.getTime()){
        maxIcCompletedDate = f.icCompletedDate;
      }
    }

    if(f.wonDate instanceof Date && !isNaN(f.wonDate.getTime())){
      if(Number(getFiscalYear(f.wonDate).replace("FY","")) === TARGET_FY &&
         getFiscalMonthLabel(f.wonDate) === TARGET_MONTH){
        rawWon++;
      }
    }

  });

  Logger.log("");
  Logger.log("---- ICFunnel_Raw 원본만으로 재계산한 FY27 AUG 건수 ----");
  Logger.log("IC Booked (raw 재계산)    : " + rawIcBooked);
  Logger.log("IC Completed (raw 재계산) : " + rawIcCompleted);
  Logger.log("Won (raw 재계산)          : " + rawWon);
  Logger.log("ICFunnel_Raw 전체 통틀어 가장 최신 IC Completed Date : " +
    (maxIcCompletedDate ? Utilities.formatDate(maxIcCompletedDate, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd") : "(없음)"));

  // ---- Leads_OPS에 이미 동기화된 값(=ACQ_Summary/원본재계산과 동일해야 정상, TEMPQA_041 참고) ----
  const ops = computeOPSAggregates_(null, null);
  const prefix = TARGET_FY + "|" + TARGET_MONTH + "|";

  function sumByPrefix(obj){
    let total = 0;
    Object.keys(obj).forEach(function(key){
      if(key.indexOf(prefix) === 0) total += obj[key];
    });
    return total;
  }

  const opsIcBooked = sumByPrefix(ops.icBooked);
  const opsIcComplete = sumByPrefix(ops.icComplete);

  Logger.log("");
  Logger.log("---- Leads_OPS 현재 동기화된 값(computeOPSAggregates_(), TEMPQA_041과 동일 소스) ----");
  Logger.log("IC Booked   : " + opsIcBooked);
  Logger.log("IC Complete : " + opsIcComplete);

  Logger.log("");
  Logger.log("---- 판정 ----");
  Logger.log(
    (rawIcCompleted > opsIcComplete)
      ? "❌ ICFunnel_Raw엔 Leads_OPS보다 많은 IC Completed(" + rawIcCompleted + " > " + opsIcComplete +
        ")가 있음 — syncICFunnelToOPS_() 동기화 자체가 안 먹은 것으로 의심, 코드 재확인 필요."
      : "✅ ICFunnel_Raw 재계산(" + rawIcCompleted + ")도 Leads_OPS(" + opsIcComplete + ")와 같은 수준 " +
        "— 동기화는 정상 동작 중, Raw 자체(Salesforce 재export)가 최신이 아닌 것으로 보임."
  );

}
