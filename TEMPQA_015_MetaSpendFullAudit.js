/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — Meta_Raw 전체 캠페인 목록/지출 감사 (Events_OPS Spent 전체 반영 준비)
 *
 * Responsibility
 * TEMPQA_014_MetaExpoSpendAudit.js로 "Kor-EXPO-Master" 3개 캠페인만 먼저
 * 확인·반영했는데(EVENTS_002_Engine.js v1.13.0
 * META_CAMPAIGN_NAME_TO_EVENTS_KEY_OVERRIDE), 사용자가 나머지 모든
 * Marketo Program에도 Meta 지출을 반영해달라고 요청함(2026-08-19). Meta
 * 캠페인명과 Marketo Program명은 서로 다른 네임스페이스라(Naver Search Ad
 * 때와 동일 문제) 자동 매칭이 불가능 — EXPO처럼 하나씩 육안 대조가
 * 필요하므로, 그 작업의 첫 단계로 Meta_Raw의 **모든 distinct 캠페인명**을
 * 지출액 내림차순으로 나열해 전체 규모를 파악한다. **읽기 전용** —
 * 아무것도 쓰지 않음(TEMPQA_005/009/014와 동일 관례).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-08-19)
 * - 최초 구현.
 * ==========================================================
 */
function runAuditMetaSpendFull(){

  const rows = readMetaRawRows_();

  Logger.log("========== Meta_Raw 전체 행 수 ==========");
  Logger.log(rows.length);

  const byCampaign = {};

  rows.forEach(function(r){

    const name = String(r.campaignName || "").trim();

    if(!name) return;

    const spent = Number(r.spent) || 0;

    if(!byCampaign[name]){
      byCampaign[name] = { totalSpent: 0, rowCount: 0 };
    }

    byCampaign[name].totalSpent += spent;
    byCampaign[name].rowCount++;

  });

  const names = Object.keys(byCampaign).sort(function(a, b){
    return byCampaign[b].totalSpent - byCampaign[a].totalSpent;
  });

  const alreadyMapped = Object.keys(META_CAMPAIGN_NAME_TO_EVENTS_KEY_OVERRIDE);

  Logger.log("");
  Logger.log("========== Distinct 캠페인명 수 ==========");
  Logger.log(names.length + " (이미 매핑됨: " + alreadyMapped.length + ")");

  let grandTotal = 0;
  let mappedTotal = 0;

  Logger.log("");
  Logger.log("========== 캠페인별 Spent(NZD) 내림차순 ==========");

  names.forEach(function(name){

    const info = byCampaign[name];
    grandTotal += info.totalSpent;

    const isMapped = alreadyMapped.indexOf(name) !== -1;

    if(isMapped) mappedTotal += info.totalSpent;

    Logger.log(
      (isMapped ? "  [매핑됨→" + META_CAMPAIGN_NAME_TO_EVENTS_KEY_OVERRIDE[name] + "] " : "  ") +
      "\"" + name + "\" — Spent(NZD)=" + info.totalSpent.toFixed(2) +
      " / 행 수=" + info.rowCount
    );

  });

  Logger.log("");
  Logger.log("전체 Spent 총합(NZD)   : " + grandTotal.toFixed(2));
  Logger.log("이미 매핑된 캠페인 합계 : " + mappedTotal.toFixed(2));
  Logger.log("미매핑 캠페인 합계     : " + (grandTotal - mappedTotal).toFixed(2));
  Logger.log("");
  Logger.log("========== 참고 ==========");
  Logger.log("이 목록을 보고 각 캠페인명이 어느 Marketo Program(Events_OPS 행)에");
  Logger.log("해당하는지 알려주시면, META_CAMPAIGN_NAME_TO_EVENTS_KEY_OVERRIDE에");
  Logger.log("하나씩 추가하겠습니다(EXPO 3건과 동일한 방식) — 자동 매칭은 위험해서");
  Logger.log("(네임스페이스 불일치, 오귀속 위험) 시도하지 않습니다.");

}
