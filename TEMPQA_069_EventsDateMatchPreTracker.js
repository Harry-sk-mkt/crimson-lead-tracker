/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — Events_OPS Event Date를 트랙커 빌드 전 사전시트("0. Event Data"
 * Events 탭) 기준으로 일괄 교정 (2026-10-02)
 *
 * Responsibility
 * 2026-06-24 이전 이벤트는 Events_OPS의 Event Date가 실제 이벤트 날짜가
 * 아니라 Salesforce first-touch 기반 날짜라 사전시트와 다르게 찍히는 경우가
 * 있고(사용자 확인, 2026-10-02 — 이건 정상/의도된 차이), 그와 별개로 9/17·
 * 9/29 유실 사고(`docs/Changelog.md`, `EVENTS_004_Merge.js` v1.15.0 참고)로
 * 일부 행은 수동 입력했던 올바른 Event Date 자체가 Engine 추정값으로 조용히
 * 덮어써진 상태다. 사전시트("0. Event Data", gid=0 "Events" 탭)가 정답이라고
 * 사용자가 확정(2026-10-02) — Lead Source Detail(=Marketo Campaign name)
 * 키로 매칭해 Events_OPS의 Event Date를 그 값으로 맞춘다.
 *
 * 매칭 정규화는 `EVENTS_002_Engine.js`의 키 정제 함수(stripRegistrationFormSuffix_/
 * stripLGSuffix_/applyEventsProgramKeyOverride_)를 그대로 재사용 — build가 쓰는
 * 것과 다른 정규화를 쓰면 안 맞는 키가 생김.
 *
 * **쓰기는 runMatchEventsDateToPreTracker()만, 값이 다른 행의 Event Date
 * 셀만 개별 setValue** (TEMPQA_068 관례 그대로 — sheet.clear()/전체 재작성
 * 아님, 다른 셀/수식 안 건드림). 실행 전 PIPELINE_LOCK이 잡혀있지 않은지
 * 확인(Revenue/Leads/MTA tail과 겹치면 쓰기가 덮일 수 있음).
 *
 * INPUT: 없음 — 사전시트는 openById()로 직접 읽음 (Target_REP/FY_REP과 동일
 * 패턴, 외부 스프레드시트 읽기 전용 접근)
 * OUTPUT: Logger.log (미리보기), Events_OPS Event Date 셀 쓰기 (실행 시)
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 교정 스크립트(TEMPQA 관례).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-10-02)
 * - 최초 구현.
 * ==========================================================
 */

// "0. Event Data" 사전트래커 시트 ID, "Events" 탭(gid=0) — 사용자 제공, 2026-10-02.
const EVENTS_PRE_TRACKER_SHEET_ID = "1sa0KBeaRbHonBBS74H7VbXCU1dptKOVjp6AmXLq382c";
const EVENTS_PRE_TRACKER_TAB_NAME = "Events";


function runPreviewEventsDateMatchPreTracker() {
  planEventsDateMatchPreTracker_(true);
}


function runMatchEventsDateToPreTracker() {

  if (currentPipelineLockValue_()) {
    Logger.log("⚠️ PIPELINE_LOCK이 잡혀 있어 중단 — Revenue/Leads/MTA tail 종료 후 재실행.");
    return;
  }

  const plan = planEventsDateMatchPreTracker_(false);

  if (plan.fixes.length === 0) {
    Logger.log("고칠 행 없음 — 쓰기 생략.");
    return;
  }

  plan.fixes.forEach(function (f) {
    plan.sheet.getRange(EVENTS.ROWS.DATA_START + f.liveIndex, plan.dateCol + 1).setValue(f.correctDate);
  });

  Logger.log("✅ Event Date " + plan.fixes.length + "건을 사전시트 기준으로 교정 완료.");

}


function planEventsDateMatchPreTracker_(verbose) {

  const tz = Session.getScriptTimeZone();

  function normalizedCampaignKey(raw) {
    const s = String(raw || "").trim();
    return s ? applyEventsProgramKeyOverride_(stripLGSuffix_(stripRegistrationFormSuffix_(s))) : "";
  }

  function ymd(date) {
    return date instanceof Date && !isNaN(date.getTime())
      ? Utilities.formatDate(date, tz, "yyyy-MM-dd")
      : "";
  }

  // 사전시트 (Events 탭: 1행 합계, 2행 헤더, 3행~ 데이터 — Events_OPS와 동일 레이아웃)
  const preSheet = SpreadsheetApp.openById(EVENTS_PRE_TRACKER_SHEET_ID).getSheetByName(EVENTS_PRE_TRACKER_TAB_NAME);
  if (!preSheet) throw new Error("사전시트에서 '" + EVENTS_PRE_TRACKER_TAB_NAME + "' 탭을 못 찾음.");

  const preValues = preSheet.getDataRange().getValues();
  const preHeaders = preValues[1].map(function (h) { return String(h).trim(); });
  const preCampaignCol = preHeaders.indexOf("Marketo Campaign name");
  const preDateCol = preHeaders.indexOf("Event Date");

  if (preCampaignCol === -1 || preDateCol === -1) {
    throw new Error("사전시트 헤더에서 Marketo Campaign name/Event Date를 못 찾음.");
  }

  const preByKey = {};
  preValues.slice(2).forEach(function (r) {
    const key = normalizedCampaignKey(r[preCampaignCol]);
    if (key && !preByKey[key]) preByKey[key] = r[preDateCol];
  });

  // 현재 Events_OPS
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EVENTS.SHEET.OPS);
  const liveValues = sheet.getDataRange().getValues();
  const liveHeaders = liveValues[EVENTS.ROWS.HEADER - 1].map(function (h) { return String(h).trim(); });
  const keyCol = liveHeaders.indexOf(EVENTS.KEY);
  const dateCol = liveHeaders.indexOf("Event Date");

  if (keyCol === -1 || dateCol === -1) {
    throw new Error("Events_OPS 헤더에서 " + EVENTS.KEY + "/Event Date를 못 찾음.");
  }

  const liveRows = liveValues.slice(EVENTS.ROWS.DATA_START - 1);

  const fixes = [];
  let matched = 0, alreadyCorrect = 0, preKeyNotFound = 0;

  liveRows.forEach(function (r, i) {

    const key = normalizedCampaignKey(r[keyCol]);
    if (!key) return;

    const preDate = preByKey[key];
    if (preDate === undefined) { preKeyNotFound++; return; }

    matched++;

    const liveYmd = ymd(r[dateCol]);
    const preYmd = ymd(preDate);

    if (liveYmd === preYmd) { alreadyCorrect++; return; }

    fixes.push({ liveIndex: i, key: key, from: liveYmd || "(공란)", to: preYmd, correctDate: preDate });

  });

  Logger.log("========== Events_OPS Event Date ↔ 사전시트 매칭 계획 ==========");
  Logger.log("사전시트 키 " + Object.keys(preByKey).length + " / Events_OPS 행 " + liveRows.length);
  Logger.log("키 매칭 " + matched + " (Events_OPS에만 있어 매칭 안 됨 " + preKeyNotFound + "건 — 영향 없음)");
  Logger.log("이미 일치 " + alreadyCorrect + "건 / 고칠 행 " + fixes.length + "건");

  if (verbose) {
    fixes.forEach(function (f) { Logger.log("  " + f.key + " : " + f.from + " → " + f.to); });
  }

  return { sheet: sheet, dateCol: dateCol, fixes: fixes };

}
