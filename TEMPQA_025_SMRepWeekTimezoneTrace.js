/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — S&M_REP 주간 집계 vs Salesforce 리포트 불일치 원인 추적
 *
 * Responsibility
 * 사용자가 S&M_REP 2026-08-17~08-23 주(Week Start=2026-08-17)를 Salesforce
 * 리포트와 대조한 결과: Event New P1 30→26, BOFU 5→4, New P1 합계 35→29,
 * Organic 3→2로 리포트가 전부 실제보다 적게 나옴(사용자 보고).
 *
 * 가설: `getMondayOfWeek_()`(TARGET_001_Engine.js)가 `date.getFullYear()`/
 * `.getMonth()`/`.getDate()`를 직접 호출하는데, 이 JS Date getter는
 * **스크립트 실행 타임존**(`appsscript.json`: America/New_York) 기준으로
 * 동작한다. 하지만 업무 타임존은 Asia/Seoul(`CONFIG.DATE.DISPLAY_TIMEZONE`).
 * 두 타임존 시차(13~14시간)로 인해 Seoul 기준 월요일 00:00~13:xx 사이에
 * 생성된 Lead는 NY 기준으로는 아직 "일요일"이라 `getMondayOfWeek_()`가
 * 그 전 주(이번 경우 2026-08-10 주)로 잘못 배정한다 — `docs/DateParsing.md`
 * 2026-08-20 "두 번째 근본 원인" 항목(Sales Accepted Date)과 동일 클래스의
 * 버그가 Create Date 기반 주간 버킷팅에도 있는지 확인.
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA_005/009/017과 동일 관례).
 *
 * INPUT: 없음 (Leads_OPS 직접 스캔)
 * OUTPUT: Logger.log만 — (1) 버그 있는 방식(getMondayOfWeek_ 그대로) vs
 *   Seoul 기준 보정 방식으로 각각 계산한 New P1/Event/BOFU/Organic 카운트
 *   비교, (2) 두 방식의 주 배정이 갈리는 개별 리드 목록(Create Date raw +
 *   Seoul 변환값)
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 조사 스크립트(TEMPQA 관례,
 *   예: TEMPQA_017_BOFUSegmentTrace.js 참고).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-08-24)
 * - 최초 구현.
 * ==========================================================
 */

function runTraceSMRepWeekTimezone(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const opsSheet = ss.getSheetByName(OPS.SHEET.OPS);

  if(!opsSheet){
    Logger.log(OPS.SHEET.OPS + " 시트를 찾을 수 없습니다.");
    return;
  }

  const records = sheetToObjects(opsSheet);

  const targetWeekStart = "2026-08-17";  // 사용자가 비교한 주
  const prevWeekStart = "2026-08-10";    // 버그로 유입됐을 것으로 의심되는 전 주

  const leadsMap = CONFIG.SM_REP.LEADS_SEGMENT_BUCKET_MAP;

  // Seoul 캘린더 기준 "yyyy-MM-dd" 문자열로 먼저 뽑은 뒤, 그 문자열을
  // 다시 로컬 Date(런타임 타임존 무관하게 날짜 성분만 사용)로 재구성해
  // getMondayOfWeek_()의 순수 날짜 연산(setDate 등)에 안전하게 넣는다.
  function seoulMondayKey_(date){

    const seoulDateStr = Utilities.formatDate(date, CONFIG.DATE.DISPLAY_TIMEZONE, "yyyy-MM-dd");
    const parts = seoulDateStr.split("-").map(Number);
    const seoulLocalDate = new Date(parts[0], parts[1] - 1, parts[2]);

    const monday = getMondayOfWeek_(seoulLocalDate);

    return Utilities.formatDate(monday, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd");

  }

  function buggyMondayKey_(date){
    const monday = getMondayOfWeek_(date);
    return Utilities.formatDate(monday, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd");
  }

  const buggyCounts = {};
  const fixedCounts = {};

  [targetWeekStart, prevWeekStart].forEach(function(k){
    buggyCounts[k] = { newP1: 0, leadsBreakdown: { Event: 0, BOFU: 0, Content: 0, Organic: 0, Referral: 0 } };
    fixedCounts[k] = { newP1: 0, leadsBreakdown: { Event: 0, BOFU: 0, Content: 0, Organic: 0, Referral: 0 } };
  });

  const flippedRows = [];

  records.forEach(function(record){

    const createDate = record["Create Date"];

    if(!(createDate instanceof Date) || isNaN(createDate.getTime())) return;

    const buggyKey = buggyMondayKey_(createDate);
    const fixedKey = seoulMondayKey_(createDate);

    const isP1 = isEffectiveP1_(record["Lead Priority"], record["Priority Override"]);
    const segment = String(record["Business Segment"] || "").trim();
    const bucket = leadsMap[segment];

    if(buggyCounts[buggyKey]){
      if(isP1){
        buggyCounts[buggyKey].newP1++;
        if(bucket) buggyCounts[buggyKey].leadsBreakdown[bucket]++;
      }
    }

    if(fixedCounts[fixedKey]){
      if(isP1){
        fixedCounts[fixedKey].newP1++;
        if(bucket) fixedCounts[fixedKey].leadsBreakdown[bucket]++;
      }
    }

    if(buggyKey !== fixedKey && (buggyCounts[buggyKey] || fixedCounts[fixedKey])){
      flippedRows.push(
        "Lead ID=" + record["Lead ID"] +
        " CreateDate(raw)=" + createDate.toISOString() +
        " Seoul=" + Utilities.formatDate(createDate, CONFIG.DATE.DISPLAY_TIMEZONE, "yyyy-MM-dd HH:mm") +
        " buggyWeek=" + buggyKey + " fixedWeek=" + fixedKey +
        " Segment=" + segment + " P1=" + isP1
      );
    }

  });

  Logger.log("========== 버그 있는 방식 (getMondayOfWeek_ 그대로, 스크립트 타임존) ==========");
  Logger.log(targetWeekStart + ": " + JSON.stringify(buggyCounts[targetWeekStart]));
  Logger.log(prevWeekStart + ": " + JSON.stringify(buggyCounts[prevWeekStart]));

  Logger.log("");
  Logger.log("========== 보정 방식 (Seoul 캘린더 기준) ==========");
  Logger.log(targetWeekStart + ": " + JSON.stringify(fixedCounts[targetWeekStart]));
  Logger.log(prevWeekStart + ": " + JSON.stringify(fixedCounts[prevWeekStart]));

  Logger.log("");
  Logger.log("========== 두 방식의 주 배정이 갈리는 리드 (" + flippedRows.length + "건, 해당 2개 주 관련분만) ==========");
  flippedRows.forEach(function(line){ Logger.log(line); });

}
