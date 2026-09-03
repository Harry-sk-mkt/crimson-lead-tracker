/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — Target_REP Content 세그먼트 특정 주 Spend 불일치 진단
 *
 * Responsibility
 * 사용자 리포트(2026-09-04): Target_REP 2026-08-31주(Week Start)의 Content
 * 세그먼트가 New P1=9 / CPNP1=$709.64로 표시됨(⇒ Actual CPNP1 분자인 그 주
 * Spend가 $6,386.76으로 쓰였다는 뜻, 709.64×9), 그런데 Campaigns 2.0(외부
 * 광고 지출 원본 스프레드시트, AD.SPREADSHEET_ID)에서 직접 확인한 Spent는
 * $2,737.18 — 약 $3,649.58 차이. Target_REP의 Actual CPNP1은
 * `Ad_Spend_Cache_Weekly`(Meta+Naver+Kakao 3개 플랫폼 합산, 세그먼트는
 * `getBusinessSegment()`로 분류)를 읽으므로(TARGET_002_Report.js
 * `computeTargetActualCPNP1ByGroupWeek_()` 참고), 캐시가 어느 소스에서 얼마씩
 * 가져왔는지 플랫폼별로 쪼개고, 특히 Meta는 "캠페인 활성기간 균등분배 근사값"
 * (`computeMetaRowWeeklySpend_()`, 정밀 export가 없는 장기 캠페인일수록 근사
 * 오차 커짐)이라는 게 이미 알려진 한계라 그 근사가 원인인지 Meta_Raw 행
 * 단위로 직접 확인한다.
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 *
 * INPUT: 없음 (Target_Engine Cutover Date, Meta_Raw/NaverSearch/KakaoChannel
 *   원본, Ad_Spend_Cache_Weekly 캐시 시트 직접 스캔)
 * OUTPUT: Logger.log만 — (1) 플랫폼별 그 주|Content 기여 금액, (2) 캐시 시트에
 *   실제 저장된 값(신선도 비교), (3) 그 주에 걸치는 Content 세그먼트 Meta_Raw
 *   행 전부(캠페인명/spent/reportStart~End/campaignStart~End/정밀 여부/그 주
 *   배분액).
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 조사 스크립트(TEMPQA 관례).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-09-04)
 * - 최초 구현. 사용자 리포트(Target_REP Content, 2026-08-31주) 조사용.
 * ==========================================================
 */
function runDiagnoseTargetRepContentWeekSpend(){

  const TARGET_WEEK_START_KEY = "2026-08-31"; // 사용자 확인: 2026-08-31~2026-09-06(SEP)
  const TARGET_SEGMENT = "Content";

  Logger.log("========== Target_REP Content " + TARGET_WEEK_START_KEY + "주 Spend 불일치 진단 ==========");

  //----------------------------------------------------------
  // 1) Ad_Spend_Cache_Weekly에 실제로 저장된 값(캐시 신선도 확인)
  //----------------------------------------------------------

  const cachedMap = readAdSpendWeeklyCacheMap_();
  const cachedValue = cachedMap[TARGET_WEEK_START_KEY + "|" + TARGET_SEGMENT];

  Logger.log("");
  Logger.log("[1] Ad_Spend_Cache_Weekly 캐시 값 (" + TARGET_WEEK_START_KEY + "|" + TARGET_SEGMENT + "):");
  Logger.log("    " + (cachedValue === undefined ? "(키 없음 — 캐시에 이 주/세그먼트 자체가 없음)" : cachedValue));

  //----------------------------------------------------------
  // 2) 플랫폼별로 다시 계산해서 캐시와 대조(캐시가 최신인지 확인)
  //----------------------------------------------------------

  const engineSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.TARGET.ENGINE_SHEET);

  if(!engineSheet){
    Logger.log("");
    Logger.log(CONFIG.TARGET.ENGINE_SHEET + " 시트가 없어 Naver 소급 기준(Cutover Date)을 못 구함 — 중단.");
    return;
  }

  const cutoverDate = readTargetEngineInputs_(engineSheet).cutoverDate;

  if(!(cutoverDate instanceof Date) || isNaN(cutoverDate.getTime())){
    Logger.log("");
    Logger.log("Target_Engine Cutover Date가 유효하지 않음 — 중단.");
    return;
  }

  const cutoverMonday = getMondayOfWeek_(cutoverDate);

  const metaSummaryNZD = computeMetaSpendWeeklySummary_();
  const naverSummaryKRW = computeNaverSearchAdSpendHistoryWeeklySummary_(cutoverMonday);
  const kakaoChannelSummaryKRW = computeKakaoChannelSpendWeeklySummary_();

  const rate = fetchKrwToNzdRate_();
  const naverSummaryNZD = convertSpendSummaryCurrency_(naverSummaryKRW, rate);
  const kakaoChannelSummaryNZD = convertSpendSummaryCurrency_(kakaoChannelSummaryKRW, rate);

  const key = TARGET_WEEK_START_KEY + "|" + TARGET_SEGMENT;

  const metaAmount = metaSummaryNZD[key] || 0;
  const naverAmount = naverSummaryNZD[key] || 0;
  const kakaoAmount = kakaoChannelSummaryNZD[key] || 0;
  const recomputedTotal = metaAmount + naverAmount + kakaoAmount;

  Logger.log("");
  Logger.log("[2] 방금 재계산한 플랫폼별 기여 금액(NZD, 환율=" + rate + "):");
  Logger.log("    Meta   : " + metaAmount.toFixed(2));
  Logger.log("    Naver  : " + naverAmount.toFixed(2));
  Logger.log("    Kakao  : " + kakaoAmount.toFixed(2));
  Logger.log("    합계    : " + recomputedTotal.toFixed(2) +
    (cachedValue !== undefined ? " (캐시값과 차이: " + (recomputedTotal - cachedValue).toFixed(2) + ")" : ""));

  //----------------------------------------------------------
  // 3) Meta_Raw 중 이 주에 걸치는 Content 세그먼트 행 전부 — 근사 배분 상세
  //----------------------------------------------------------

  Logger.log("");
  Logger.log("[3] 이 주(" + TARGET_WEEK_START_KEY + ")에 배분액이 잡힌 Content 세그먼트 Meta_Raw 행:");

  const metaRows = readMetaRawRows_();

  let metaRowCount = 0;

  metaRows.forEach(function(record){

    const segment = getBusinessSegment(record.campaignName);

    if(segment !== TARGET_SEGMENT) return;

    const weeklyEntries = computeMetaRowWeeklySpend_(record);

    const matching = weeklyEntries.filter(function(entry){
      return Utilities.formatDate(entry.weekStart, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd") === TARGET_WEEK_START_KEY;
    });

    if(matching.length === 0) return;

    metaRowCount++;

    const isPrecise = isMetaRowWeekPrecise_(record);

    Logger.log(
      "    - \"" + record.campaignName + "\"" +
      " | 이 주 배분액=" + matching[0].spent.toFixed(2) +
      " | 원본 spent(export 전체 기간)=" + record.spent +
      " | reportStart~End=" + formatDiagDate_(record.reportStart) + "~" + formatDiagDate_(record.reportEnd) +
      " | campaignStart~End=" + formatDiagDate_(record.campaignStart) + "~" + formatDiagDate_(record.campaignEnd) +
      " | " + (isPrecise ? "정밀(단일 주 export)" : "근사(장기 export 균등분배)")
    );

  });

  if(metaRowCount === 0){
    Logger.log("    (해당 주에 배분액이 잡힌 Content Meta_Raw 행 없음)");
  }

  Logger.log("");
  Logger.log("========== Diagnostic Completed ==========");

}


/**
 * ==========================================================
 * Format Diagnostic Date (순수 함수, 로그 전용)
 * ==========================================================
 */
function formatDiagDate_(date){

  if(!(date instanceof Date) || isNaN(date.getTime())) return "(없음)";

  return Utilities.formatDate(date, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd");

}
