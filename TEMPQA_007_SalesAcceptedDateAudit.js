/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — Sales Accepted Date 오염 범위 확인 (docs/OpenItems.md #26)
 *
 * Responsibility
 * `CONFIG.RAW_DATE_COLUMNS.MTA`에 `"Lead: Sales Accepted Date"`가 누락돼
 * 있던 기간(2026-07-25~2026-08-19) 동안 import된 MTA_Master의 Sales
 * Accepted Date 값 중 실제로 day/month가 뒤바뀐(day≤12인 경우만 ambiguous,
 * docs/DateParsing.md 참고) 건수를 세어 복구 범위를 파악한다. **읽기 전용**
 * — 아무것도 쓰지 않음(TEMPQA_005_JulyNewLeadsGap.js와 동일 관례, 새 시트도
 * 만들지 않고 Logger.log로만 출력, docs/apps-script-gotchas.md #8 참고).
 *
 * 판정 로직
 * 현재 저장된 값이 day≤12면 오염 의심(원래 day였던 값이 month 자리로 밀려
 * 들어갔을 가능성 — month는 정의상 항상 1~12라 이 자리는 항상 day≤12로
 * 보임). day>12면 애초에 month로 오해석될 수 없었으므로 안전(그대로 정상).
 * `computeMTAFunnelByLeadId_()`(MASTER_003_MTAFunnelSync.js, 기존 테스트
 * 완료 함수 재사용)로 Leads_OPS에 실제로 동기화되는 "리드별 대표 터치"
 * 값만 집계 — 터치 단위가 아니라 Leads_OPS/ACQ_REP/S&M_REP에 실제로
 * 드러나는 리드 단위 영향 범위를 정확히 알기 위함.
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-08-19)
 * - 최초 구현.
 * ==========================================================
 */
function runAuditSalesAcceptedDateCorruption(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const mtaSheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);

  if(!mtaSheet){
    Logger.log("MTA_Master sheet not found.");
    return;
  }

  const mtaRecords = sheetToObjects(mtaSheet);
  const funnelByLeadId = computeMTAFunnelByLeadId_(mtaRecords);

  let totalWithDate = 0;
  let suspectedCorrupted = 0;
  let safe = 0;

  let earliestStoredCorrupted = null;
  let latestStoredCorrupted = null;
  let earliestRecoveredCorrupted = null;
  let latestRecoveredCorrupted = null;
  let recoveredAfterTodayCount = 0;

  const today = new Date();
  const sampleLeadIds = [];

  Object.keys(funnelByLeadId).forEach(function(leadId){

    const salDate = funnelByLeadId[leadId].salesAcceptedDate;

    if(!(salDate instanceof Date) || isNaN(salDate.getTime())) return;

    totalWithDate++;

    const storedDay = salDate.getDate();
    const storedMonth = salDate.getMonth(); // 0-indexed
    const storedYear = salDate.getFullYear();

    if(storedDay > 12){
      safe++;
      return;
    }

    suspectedCorrupted++;

    if(!earliestStoredCorrupted || salDate < earliestStoredCorrupted) earliestStoredCorrupted = salDate;
    if(!latestStoredCorrupted || salDate > latestStoredCorrupted) latestStoredCorrupted = salDate;

    // day/month를 원래대로 되돌린 추정 실제 날짜(swap-back) — storedMonth+1을
    // day로, storedDay를 month(0-indexed)로 재구성.
    const recovered = new Date(storedYear, storedDay - 1, storedMonth + 1);

    if(!earliestRecoveredCorrupted || recovered < earliestRecoveredCorrupted) earliestRecoveredCorrupted = recovered;
    if(!latestRecoveredCorrupted || recovered > latestRecoveredCorrupted) latestRecoveredCorrupted = recovered;

    if(recovered > today) recoveredAfterTodayCount++;

    if(sampleLeadIds.length < 10){
      sampleLeadIds.push(
        leadId + " : stored=" + Utilities.formatDate(salDate, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd") +
        " -> recovered=" + Utilities.formatDate(recovered, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd")
      );
    }

  });

  Logger.log("========== Sales Accepted Date 오염 범위 감사 ==========");
  Logger.log("Sales Accepted Date 있는 리드 수 (전체) : " + totalWithDate);
  Logger.log("오염 의심(day<=12, swap 추정)          : " + suspectedCorrupted);
  Logger.log("안전(day>12, swap 불가능했음)           : " + safe);
  Logger.log("");

  if(suspectedCorrupted > 0){

    Logger.log("오염 의심 건의 현재 저장값 범위 : " +
      Utilities.formatDate(earliestStoredCorrupted, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd") + " ~ " +
      Utilities.formatDate(latestStoredCorrupted, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd"));

    Logger.log("swap-back 추정 실제 날짜 범위    : " +
      Utilities.formatDate(earliestRecoveredCorrupted, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd") + " ~ " +
      Utilities.formatDate(latestRecoveredCorrupted, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd"));

    Logger.log("swap-back 후에도 오늘(" + Utilities.formatDate(today, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd") +
      ") 이후로 남는 건수 : " + recoveredAfterTodayCount +
      " (0이 아니면 단순 day/month swap 가설만으로는 설명 안 되는 건이 섞여있다는 뜻 — 개별 확인 필요)");

    Logger.log("");
    Logger.log("샘플(최대 10건, Lead ID : stored -> recovered):");
    sampleLeadIds.forEach(function(line){ Logger.log("  " + line); });

  }

  Logger.log("==========================================================");

}
