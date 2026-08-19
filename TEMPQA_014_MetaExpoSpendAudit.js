/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — Meta_Raw EXPO 캠페인 지출 확인 (Events_OPS Spent 갭 조사)
 *
 * Responsibility
 * 사용자가 "Kor-EXPO-Master" Meta 지출이 $20,000 이상이었다고 보고했는데,
 * Events_OPS의 "Spent"(GROUP_4_COMPUTED, EVENTS_002_Engine.js
 * computeEventsKakaoSpendAggregates_())가 Kakao Moments 비용만 집계하고
 * Meta는 전혀 반영하지 않는 구조임을 코드 확인함(2026-08-06 v1.9.0/
 * v1.10.0부터). Meta_Raw(AD.RAW_SHEET.Meta = "Meta_Raw")엔 Kakao의
 * "Marketo program" 같은 프로그램 단위 매핑 컬럼이 없어, 캠페인명
 * ("Campaign name")에 "expo"가 포함된 행을 직접 찾아 실제로 EXPO 관련
 * 지출이 이 시트 안에 있는지, 있다면 정확히 어떤 캠페인명으로 얼마씩
 * 찍혀있는지 확인한다. **읽기 전용** — 아무것도 쓰지 않음(TEMPQA_005/009와
 * 동일 관례).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-08-19)
 * - 최초 구현.
 * ==========================================================
 */
function runAuditMetaExpoSpend(){

  const ss = SpreadsheetApp.openById(AD.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(AD.RAW_SHEET.Meta);

  if(!sheet){
    Logger.log("Meta_Raw sheet not found (AD.SPREADSHEET_ID 워크북 안에서 찾음).");
    return;
  }

  const rows = readMetaRawRows_();

  Logger.log("========== Meta_Raw 전체 행 수 ==========");
  Logger.log(rows.length);

  const expoRows = rows.filter(function(r){
    return /expo/i.test(String(r.campaignName || ""));
  });

  Logger.log("");
  Logger.log("========== 'expo' 포함 캠페인명 행 ==========");
  Logger.log("건수: " + expoRows.length);

  const byCampaign = {};

  expoRows.forEach(function(r){

    const name = String(r.campaignName || "").trim();
    const spent = Number(r.spent) || 0;

    if(!byCampaign[name]){
      byCampaign[name] = { totalSpent: 0, rowCount: 0, earliestStart: null, latestEnd: null };
    }

    byCampaign[name].totalSpent += spent;
    byCampaign[name].rowCount++;

    if(r.reportStart instanceof Date && !isNaN(r.reportStart.getTime())){
      if(!byCampaign[name].earliestStart || r.reportStart < byCampaign[name].earliestStart){
        byCampaign[name].earliestStart = r.reportStart;
      }
    }

    if(r.reportEnd instanceof Date && !isNaN(r.reportEnd.getTime())){
      if(!byCampaign[name].latestEnd || r.reportEnd > byCampaign[name].latestEnd){
        byCampaign[name].latestEnd = r.reportEnd;
      }
    }

  });

  let grandTotal = 0;

  Object.keys(byCampaign).forEach(function(name){

    const info = byCampaign[name];
    grandTotal += info.totalSpent;

    Logger.log(
      "  \"" + name + "\" — Spent(NZD) 합계=" + info.totalSpent.toFixed(2) +
      " / 행 수=" + info.rowCount +
      " / 기간=" +
      (info.earliestStart ? Utilities.formatDate(info.earliestStart, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd") : "?") +
      " ~ " +
      (info.latestEnd ? Utilities.formatDate(info.latestEnd, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd") : "?")
    );

  });

  Logger.log("");
  Logger.log("'expo' 캠페인 Spent 총합(NZD): " + grandTotal.toFixed(2));
  Logger.log("");
  Logger.log("========== 참고 ==========");
  Logger.log("여기 0건이거나 캠페인명이 'expo'를 포함하지 않으면, 실제 Meta 캠페인명이 다르게");
  Logger.log("찍혀있을 수 있음 — 그 경우 Meta_Raw에서 Account/기간으로 직접 훑어봐야 함.");
  Logger.log("여기 나온 총합이 사용자가 알고 있는 $20,000+와 맞으면, 이 캠페인명(들)을");
  Logger.log("Kor-EXPO-Master로 매핑하는 신규 집계 로직을 추가하면 됨(다음 단계, 아직 미구현).");

}
