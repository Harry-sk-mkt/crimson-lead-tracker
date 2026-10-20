/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — 같은 이메일에 Lead ID가 여러 개인 리드의 IC/SAL 조인 누락 규모
 *
 * Responsibility
 * 2026-10-20 확인: Salesforce에서 리드가 병합되며 2022년 레코드는 삭제되고
 * 최근 레코드만 남았는데, Leads_OPS는 `resolveEmailGroupEarliestWins_()`로
 * 가장 이른 Create Date(=삭제된 옛 Lead ID)를 계속 채택한다. IC Funnel·SAL
 * sync는 Lead ID로 Leads_OPS에 붙으므로(`computeICFunnelByLeadId_()`/
 * `computeSALByLeadId_()`), 채택되지 않은 Lead ID 쪽에 IC/SAL 기록이 있으면
 * Leads_OPS에서 누락된다. 처리 방식(A/B) 결정 전에 그 규모를 센다.
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례). 로그에 이메일은 찍지 않음.
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 집계(TEMPQA 관례).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-10-20)
 * - 최초 구현.
 * ==========================================================
 */
function runCheckDuplicateEmailLeadIdJoinGap(){

  const RECENT_DAYS = 14;
  const now = new Date();

  // 1) Leads_Master → 이메일별 그룹 (mergeOPS와 같은 정규화)
  const groups = {};
  readMaster().forEach(function(r){
    const email = String(r[OPS.KEY] || "").trim().toLowerCase();
    if(!email) return;
    (groups[email] = groups[email] || []).push(r);
  });

  // 2) IC Funnel / SAL Raw 전체에서 날짜가 있는 Lead ID 집합
  const icCols = CONFIG.IC_FUNNEL.COLUMNS;
  const salCols = CONFIG.SAL.COLUMNS;

  const icIds = {};
  readRawSheetFrom_(CONFIG.IC_FUNNEL.SHEET, 0, openICFunnelRawExternalSpreadsheet_()).forEach(function(r){
    if(r[icCols.IC_BOOKED_DATE] || r[icCols.IC_COMPLETED_DATE]){
      icIds[String(r[icCols.LEAD_ID]).trim()] = true;
    }
  });

  const salIds = {};
  readRawSheetFrom_(CONFIG.SAL.SHEET, 0, openSALExternalSpreadsheet_()).forEach(function(r){
    if(r[salCols.SALES_ACCEPTED_DATE]){
      salIds[String(r[salCols.LEAD_ID]).trim()] = true;
    }
  });

  // 3) Lead ID가 2개 이상인 그룹만 — 채택 ID vs 탈락 ID 비교
  const stats = { multiIdGroups: 0, recentNewerRecord: 0, droppedHasIC: 0, droppedHasSAL: 0, keptHasIC: 0, keptHasSAL: 0 };
  const examples = [];

  Object.keys(groups).forEach(function(email){

    const rows = groups[email];
    const ids = {};
    rows.forEach(function(r){ ids[String(r["Lead ID"]).trim()] = r; });
    if(Object.keys(ids).length < 2) return;

    stats.multiIdGroups++;

    const kept = resolveEmailGroupEarliestWins_(rows).resolvedRows[0];
    const keptId = String(kept["Lead ID"]).trim();
    const droppedIds = Object.keys(ids).filter(function(id){ return id !== keptId; });

    const newest = rows.reduce(function(a, b){
      return (b["Create Date"] instanceof Date && (!(a["Create Date"] instanceof Date) || b["Create Date"] > a["Create Date"])) ? b : a;
    });
    const isRecent = newest["Create Date"] instanceof Date &&
      (now - newest["Create Date"]) / 86400000 <= RECENT_DAYS;
    if(isRecent) stats.recentNewerRecord++;

    const dIC = droppedIds.some(function(id){ return icIds[id]; });
    const dSAL = droppedIds.some(function(id){ return salIds[id]; });
    if(dIC) stats.droppedHasIC++;
    if(dSAL) stats.droppedHasSAL++;
    if(icIds[keptId]) stats.keptHasIC++;
    if(salIds[keptId]) stats.keptHasSAL++;

    if((dIC || dSAL || isRecent) && examples.length < 30){
      const fmt = function(d){ return d instanceof Date ? Utilities.formatDate(d, "Asia/Seoul", "yyyy-MM-dd") : String(d || ""); };
      examples.push([
        "kept " + keptId + " (" + fmt(kept["Create Date"]) + ")",
        "dropped " + droppedIds.map(function(id){ return id + " (" + fmt(ids[id]["Create Date"]) + ")"; }).join(", "),
        "droppedIC=" + dIC, "droppedSAL=" + dSAL, "recent=" + isRecent
      ].join(" | "));
    }

  });

  Logger.log("이메일 그룹 중 Lead ID 2개 이상 : " + stats.multiIdGroups);
  Logger.log("  └ 최신 레코드 Create Date가 최근 " + RECENT_DAYS + "일 이내 : " + stats.recentNewerRecord);
  Logger.log("  └ 탈락(미채택) Lead ID에 IC 기록 있음 → Leads_OPS 누락 : " + stats.droppedHasIC);
  Logger.log("  └ 탈락(미채택) Lead ID에 SAL 기록 있음 → Leads_OPS 누락 : " + stats.droppedHasSAL);
  Logger.log("  (참고) 채택 Lead ID에 IC 기록 : " + stats.keptHasIC + " / SAL 기록 : " + stats.keptHasSAL);
  Logger.log("예시(최대 30건, 이메일 제외):\n" + examples.join("\n"));

}
