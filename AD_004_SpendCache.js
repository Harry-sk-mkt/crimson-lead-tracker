/**
 * ==========================================================
 * Marketing 2.0
 * Ad Spend — 플랫폼 합산 캐시 (ACQ_REP 소비 레이어)
 *
 * Responsibility
 * Meta(AD_002_Meta.js, NZD 원본)/Naver Search(AD_003_NaverSearch.js, KRW
 * 원본)/Kakao Channel(AD_005_KakaoChannel.js, KRW 원본)의 캠페인 지출 요약을
 * 합산해 `Ad_Spend_Cache` 시트(메인 스프레드시트 안)에 저장한다.
 * `30_ACQReport.js`의 `generateACQReport_()`는 이 캐시만 읽는다(외부
 * 스프레드시트/API 호출 없음 — ACQ_REP Generate 체크박스는 `onEdit()` Simple
 * Trigger로 실행되는데, Simple Trigger는 제한된 권한이라
 * `SpreadsheetApp.openById()`나 `UrlFetchApp`을 못 씀, 2026-07-30 Meta 연결
 * 때 실측 확인 — 그때 도입한 캐시 패턴을 여러 플랫폼 합산용으로 그대로
 * 확장).
 *
 * **KRW→NZD 환율(2026-07-31, 사용자 확정)**: Google Sheets의
 * `GOOGLEFINANCE("CURRENCY:KRWNZD")` 사용. Apps Script는 GOOGLEFINANCE를
 * 직접 호출할 수 없어(스프레드시트 함수 전용), 메인 스프레드시트 안 숨김
 * 시트에 수식을 심어두고 재계산된 값을 읽는 방식으로 우회
 * (`fetchKrwToNzdRate_()`).
 *
 * **소급 범위(2026-07-31, 사용자 확정)**: Naver Search는 Meta와 동일한
 * 범위(`AD.NAVER_SEARCH.API.BACKFILL_START`, FY23 SEP~현재월)까지 소급.
 * Kakao Channel은 자체 소급 로직이 없음 — Performance 시트에 있는 모든 행을
 * 그대로 집계(시트 자체가 2024-08-13부터 사용자 확인).
 *
 * Must NOT
 * - Meta/Naver Search/Kakao Channel 각 플랫폼의 원본 집계 로직을 다시 구현
 *   (각자의 `computeMetaSpendSummary_()`/`computeNaverSearchAdSpendHistorySummary_()`/
 *   `computeKakaoChannelSpendSummary_()` 재사용)
 * - Target_Engine에는 아직 연결하지 않음(8개 플랫폼 전체 자동화 후 재검토,
 *   docs/exec-plans/active/2026-07-30-campaign-spend-integration.md 참고)
 *
 * Stage
 * AD (2026-07-30 네이밍 컨벤션. 기존 00~99는 당장 안 바꿈)
 *
 * Version
 * v1.5.0
 *
 * Change Log
 * v1.5.0 (2026-08-19)
 * - Target_REP 주별 CPNP1이 한 달 내내 동일 값으로 반복 표시되던 문제(사용자
 *   리포트) 해소 — 신규 `refreshAdSpendWeeklyCache_()`/`runRefreshAdSpendWeeklyCache()`/
 *   `readAdSpendWeeklyCacheMap_()`, `Ad_Spend_Cache_Weekly` 시트(월 단위
 *   `Ad_Spend_Cache`와 별도, `AD.SPEND_CACHE.WEEKLY_CACHE_SHEET` — AD_001_Config.js
 *   v1.20.0). Meta(`computeMetaSpendWeeklySummary_()`, 근사)/Naver(`computeNaverSearchAdSpendHistoryWeeklySummary_()`,
 *   참값)/Kakao(`computeKakaoChannelSpendWeeklySummary_()`, 참값) 3개 플랫폼의
 *   신규 주 단위 집계 함수를 합산 — 기존 `refreshAdSpendCache_()`(월 단위)와
 *   동일한 합산/환율 변환 패턴 재사용(`mergeSpendSummaries_()`/
 *   `convertSpendSummaryCurrency_()`), 소급 범위만 Target_Engine Cutover Date부터로
 *   제한(그 이전 주는 Target_REP도 원래 공란 규칙). WeekStart 컬럼은 Sheets가
 *   "yyyy-MM-dd" 문자열을 Date로 자동 변환해버리는 걸 막기 위해 쓰기 전
 *   `setNumberFormat("@")`로 텍스트 고정(이 프로젝트가 반복적으로 겪은 날짜/
 *   타임존 버그 클래스 예방). `periodicRefreshAdSpendCache_()`가 이 함수도
 *   함께 호출하도록 확장(기존 실패 격리 원칙 그대로 — 이 캐시 갱신 실패가
 *   월 단위 캐시 갱신을 막으면 안 됨).
 * v1.4.1 (2026-08-08)
 * - `runPeriodicRefreshAdSpendCache()` 신규 — `periodicRefreshAdSpendCache_()`
 *   이름 끝에 `_`가 있어 Run 드롭다운에 안 뜨는 문제(사용자 실측 확인)로
 *   수동 테스트용 공개 래퍼 추가(docs/apps-script-gotchas.md #2 관례).
 * v1.4.0 (2026-08-08)
 * - `periodicRefreshAdSpendCache_()`/`runInstallAdSpendPeriodicRefreshTrigger()`
 *   신규 — ACQ_REP를 refresh해도 Kakao Moments(메시지광고 API) 신규 데이터가
 *   반영 안 되는 문제 확인 후 사용자 요청으로 독립 시간 트리거 추가(매
 *   `AD.SPEND_CACHE.PERIODIC_REFRESH_INTERVAL_HOURS`시간, AD_001_Config.js
 *   v1.19.0). `syncKakaoMomentsReportToKakaoSMSRaw_()`(AD_006_KakaoMoments.js)로
 *   `KakaoSMS_Raw`를 먼저 최신화한 뒤 `refreshAdSpendCache_()` 호출 —
 *   `computeKakaoChannelSpendSummary_()`가 같은 시트를 읽으므로 별도 Kakao
 *   Moments 전용 집계 함수 불필요. `docs/OpenItems.md` 항목 19(2026-08-04
 *   보류) 해제.
 * v1.3.0 (2026-08-08)
 * - `fetchFxRateToNzd_(currencyCode)` 신규 — `fetchKrwToNzdRate_()`를 KRW
 *   하나로 고정하지 않고 AD.FX.RATES(KRW/AUD/USD) 임의 통화로 일반화한 버전.
 *   FY_REP Marketing 섹션(Engine, 다음 커밋)이 소비 예정. 기존
 *   `fetchKrwToNzdRate_()`/`refreshAdSpendCache_()`는 변경 없음(하위호환).
 * v1.2.0 (2026-07-31)
 * - **Kakao Channel(3번째 플랫폼) 합산 추가** — `refreshAdSpendCache_()`가
 *   `computeKakaoChannelSpendSummary_()`(AD_005_KakaoChannel.js, KRW 원본)도
 *   호출해 Meta(NZD)+Naver Search(KRW→NZD)+Kakao Channel(KRW→NZD) 3개
 *   플랫폼을 합산하도록 확장. 카카오모먼트 API 이관 전까지의 임시 소스
 *   (사용자 확인 — 이관 시 이 파이프라인 폐기 예정).
 * v1.1.0 (2026-07-31)
 * - `runDeleteMetaSpendCacheSheet()` 신규(수동 실행, 1회성 정리용) — 옛
 *   "Meta_Spend_Cache" 시트(이 파일의 `Ad_Spend_Cache`로 대체됨)를 사용자
 *   요청으로 삭제.
 * v1.0.0 (2026-07-31)
 * - 최초 구현.
 * ==========================================================
 */


/**
 * ==========================================================
 * Fetch KRW→NZD Rate (IO 래퍼)
 *
 * WHY
 * Apps Script는 GOOGLEFINANCE를 직접 호출할 수 없다 — 메인 스프레드시트 안
 * 숨김 시트(`AD.FX.RATE_CACHE_SHEET`) 1개 셀에 수식을 심어두고,
 * `SpreadsheetApp.flush()`로 재계산을 강제한 뒤 계산된 값을 읽는다. 값이
 * 숫자가 아니거나(예: "#N/A", 네트워크 지연으로 아직 계산 전) 0 이하이면
 * 명확한 에러를 던진다 — 잘못된 환율로 조용히 계속 진행하는 것을 막기 위함.
 *
 * OUTPUT
 * number  1 KRW당 NZD 환율
 * ==========================================================
 */
function fetchKrwToNzdRate_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(AD.FX.RATE_CACHE_SHEET);

  if(!sheet){
    sheet = ss.insertSheet(AD.FX.RATE_CACHE_SHEET);
    sheet.hideSheet();
  }

  const cell = sheet.getRange(1, 1);

  cell.setFormula(AD.FX.KRW_TO_NZD_FORMULA);

  SpreadsheetApp.flush();

  const rate = cell.getValue();

  if(typeof rate !== "number" || isNaN(rate) || rate <= 0){
    throw new Error(
      "KRW→NZD 환율을 가져오지 못했습니다(GOOGLEFINANCE 값: " + rate + ") — " +
      AD.FX.RATE_CACHE_SHEET + " 시트 A1 셀을 직접 확인하세요."
    );
  }

  return rate;

}


/**
 * ==========================================================
 * Fetch FX Rate To NZD (IO 래퍼, 통화 일반화)
 *
 * WHY
 * fetchKrwToNzdRate_()와 동일한 우회 방식(숨김 시트+GOOGLEFINANCE)이지만
 * KRW 하나로 고정돼 있지 않고 AD.FX.RATES에 등록된 임의 통화 코드를 받는다
 * (FY_REP Marketing 섹션이 AUD/USD 표기 플랫폼도 NZD로 환산해야 해서 신규 —
 * docs/exec-plans/active/2026-08-07-fy-rep-implementation.md 참고). 통화별로
 * 캐시 시트의 다른 행(같은 A열)에 수식을 심어 서로 덮어쓰지 않게 한다.
 * "NZD"는 변환이 필요 없으므로 시트 접근 없이 1을 바로 반환한다.
 *
 * INPUT
 * currencyCode : string  "KRW"/"AUD"/"USD"/"NZD" 등 AD.FX.RATES 키
 *
 * OUTPUT
 * number  1 {currencyCode}당 NZD 환율(NZD면 1)
 * ==========================================================
 */
function fetchFxRateToNzd_(currencyCode){

  if(currencyCode === "NZD") return 1;

  const rateConfig = AD.FX.RATES[currencyCode];

  if(!rateConfig){
    throw new Error(
      "지원하지 않는 통화 코드입니다: " + currencyCode +
      " — AD.FX.RATES에 등록되지 않음(AD_001_Config.js)."
    );
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(AD.FX.RATE_CACHE_SHEET);

  if(!sheet){
    sheet = ss.insertSheet(AD.FX.RATE_CACHE_SHEET);
    sheet.hideSheet();
  }

  const cell = sheet.getRange(rateConfig.CELL_ROW, 1);

  cell.setFormula(rateConfig.FORMULA);

  SpreadsheetApp.flush();

  const rate = cell.getValue();

  if(typeof rate !== "number" || isNaN(rate) || rate <= 0){
    throw new Error(
      currencyCode + "→NZD 환율을 가져오지 못했습니다(GOOGLEFINANCE 값: " + rate + ") — " +
      AD.FX.RATE_CACHE_SHEET + " 시트 " + rateConfig.CELL_ROW + "행 A열 셀을 직접 확인하세요."
    );
  }

  return rate;

}


/**
 * ==========================================================
 * Convert Spend Summary Currency (순수 함수)
 *
 * WHY
 * (FY|Month|Segment) → 금액 맵 하나 전체를 주어진 환율로 일괄 변환한다.
 *
 * INPUT
 * summary : Object  키 "fy|month|segment" → 금액(원 통화)
 * rate : number  곱할 환율
 *
 * OUTPUT
 * Object  같은 키, 값만 rate를 곱한 새 Object(원본 불변)
 *
 * TEST
 * testConvertSpendSummaryCurrency() 참고
 * ==========================================================
 */
function convertSpendSummaryCurrency_(summary, rate){

  const result = {};

  Object.keys(summary).forEach(function(key){
    result[key] = summary[key] * rate;
  });

  return result;

}


/**
 * ==========================================================
 * TEST — convertSpendSummaryCurrency_()
 * ==========================================================
 */
function testConvertSpendSummaryCurrency(){

  const input = { "26|JUL|Search": 3737733, "26|JUL|Seminar": 1000 };
  const result = convertSpendSummaryCurrency_(input, 0.0012);

  const pass =
    Math.abs(result["26|JUL|Search"] - 3737733 * 0.0012) < 1e-9 &&
    Math.abs(result["26|JUL|Seminar"] - 1000 * 0.0012) < 1e-9 &&
    input["26|JUL|Search"] === 3737733; // 원본 불변 확인

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Merge Spend Summaries (순수 함수)
 *
 * WHY
 * 여러 플랫폼의 (FY|Month|Segment) → 금액 맵을 하나로 합산한다(키가 한쪽에만
 * 있어도 그대로 포함 — 두 소스 어디에도 없는 키만 최종 결과에서 빠짐, 이는
 * 소비부(30_ACQReport.js)의 hasOwnProperty 기반 "공란 vs 0" 구분과 그대로
 * 호환).
 *
 * INPUT
 * summaries : Array<Object>  각각 "fy|month|segment" → 금액
 *
 * OUTPUT
 * Object  합산된 "fy|month|segment" → 금액
 *
 * TEST
 * testMergeSpendSummaries() 참고
 * ==========================================================
 */
function mergeSpendSummaries_(summaries){

  const totals = {};

  summaries.forEach(function(summary){

    Object.keys(summary).forEach(function(key){
      totals[key] = (totals[key] || 0) + summary[key];
    });

  });

  return totals;

}


/**
 * ==========================================================
 * TEST — mergeSpendSummaries_()
 * ==========================================================
 */
function testMergeSpendSummaries(){

  const meta = { "26|JUL|BOFU": 100, "26|JUL|Content": 200 };
  const naver = { "26|JUL|BOFU": 50, "26|JUL|Search": 300 };

  const result = mergeSpendSummaries_([meta, naver]);

  const pass =
    result["26|JUL|BOFU"] === 150 &&      // 양쪽 다 있음 — 합산
    result["26|JUL|Content"] === 200 &&   // Meta만 있음 — 그대로
    result["26|JUL|Search"] === 300 &&    // Naver만 있음 — 그대로
    Object.keys(result).length === 3;

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Ad Spend Cache Headers (같은 메인 스프레드시트 안 캐시 시트)
 * ==========================================================
 */
const AD_SPEND_CACHE_HEADERS = ["FY", "Month", "Segment", "Spent"];


/**
 * ==========================================================
 * Refresh Ad Spend Cache (IO 래퍼 — 수동 실행 전용)
 *
 * WHY
 * Meta(NZD)와 Naver Search(KRW→NZD 변환)를 합산해 `Ad_Spend_Cache` 시트에
 * 저장한다. Meta_Raw/NaverSA 캠페인 데이터가 갱신되거나, 최소 ACQ_REP
 * Generate 전에 사용자가 이 함수를 직접 Run 해야 한다(자동 실행 체인에는
 * 아직 안 걸림, Meta 때와 동일 방침).
 * ==========================================================
 */
function refreshAdSpendCache_(){

  const metaSummaryNZD = computeMetaSpendSummary_();

  const naverBackfill = AD.NAVER_SEARCH.API.BACKFILL_START;
  const naverSummaryKRW = computeNaverSearchAdSpendHistorySummary_(
    naverBackfill.YEAR, naverBackfill.MONTH
  );

  const kakaoChannelSummaryKRW = computeKakaoChannelSpendSummary_();

  const rate = fetchKrwToNzdRate_();
  const naverSummaryNZD = convertSpendSummaryCurrency_(naverSummaryKRW, rate);
  const kakaoChannelSummaryNZD = convertSpendSummaryCurrency_(kakaoChannelSummaryKRW, rate);

  const combined = mergeSpendSummaries_([metaSummaryNZD, naverSummaryNZD, kakaoChannelSummaryNZD]);

  const rows = Object.keys(combined).map(function(key){

    const parts = key.split("|");

    return [Number(parts[0]), parts[1], parts[2], combined[key]];

  });

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(CONFIG.ACQ.AD_SPEND_CACHE_SHEET);

  if(!sheet){
    sheet = ss.insertSheet(CONFIG.ACQ.AD_SPEND_CACHE_SHEET);
  }

  sheet.clearContents();

  sheet.getRange(1, 1, 1, AD_SPEND_CACHE_HEADERS.length)
    .setValues([AD_SPEND_CACHE_HEADERS]);

  if(rows.length > 0){

    sheet.getRange(2, 1, rows.length, AD_SPEND_CACHE_HEADERS.length)
      .setValues(rows);

  }

  sheet.hideSheet();

  SpreadsheetApp.flush();

  Logger.log(
    "Ad_Spend_Cache 갱신 완료: " + rows.length + "행 (환율 KRW→NZD=" + rate + ")"
  );

}


/**
 * ==========================================================
 * TEMP — refreshAdSpendCache_() 수동 실행용 공개 진입점
 * ==========================================================
 */
function runRefreshAdSpendCache(){

  refreshAdSpendCache_();

}


/**
 * ==========================================================
 * Ad Spend Weekly Cache Headers (Target_REP 전용, 월 단위 캐시와 별도)
 * ==========================================================
 */
const AD_SPEND_WEEKLY_CACHE_HEADERS = ["WeekStart", "Segment", "Spent"];


/**
 * ==========================================================
 * Refresh Ad Spend Weekly Cache (IO 래퍼 — 수동 실행 전용, 2026-08-19 신규)
 *
 * WHY
 * Target_REP의 Actual CPNP1이 월 값을 그 달 모든 주에 반복 표시하던 문제
 * (사용자 리포트, 2026-08-19)를 해소하기 위한 신규 주 단위 캐시. 월별 캐시
 * (refreshAdSpendCache_())와 완전히 별도 시트로 분리 — ACQ_REP/FY_REP는
 * 계속 월 단위 캐시만 쓰고(기존 출력 변경 금지), 이 캐시는 Target_REP 전용.
 *
 * **정확도는 플랫폼마다 다르다**:
 * - Kakao/Naver: 근사 없는 참값(Kakao는 SentAt 단일 날짜 직접 귀속, Naver는
 *   API를 주 단위 기간으로 직접 조회).
 * - Meta: 실무 export가 보통 월 단위라, 정밀(주 단위) export가 없는 한
 *   캠페인 활성기간 균등분배 근사값(computeMetaRowWeeklySpend_() WHY 참고).
 *
 * **소급 범위 = Target 주 사이클 전환일(Target_Engine Block 0 Cutover Date)
 * 부터만** — 그 이전 주는 이 캐시에 아예 안 만든다(§8 "Cutover 이전 주는
 * 공란" 원칙 복원, 2026-08-04 월 캐시 전환 때 일시적으로 깨졌던 부분).
 *
 * WeekStart 컬럼은 "yyyy-MM-dd" 문자열을 그대로 저장해야 하는데, Google
 * Sheets가 이런 값을 자동으로 Date로 인식해버리면 읽을 때 다시 문자열로
 * 포맷해야 하는 번거로움과 타임존 어긋남 위험이 생긴다(이 프로젝트가 반복
 * 겪은 버그 클래스) — 쓰기 전에 해당 컬럼을 `setNumberFormat("@")`(텍스트)로
 * 고정해 원천 차단한다.
 * ==========================================================
 */
function refreshAdSpendWeeklyCache_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const engineSheet = ss.getSheetByName(CONFIG.TARGET.ENGINE_SHEET);

  if(!engineSheet){
    Logger.log(
      CONFIG.TARGET.ENGINE_SHEET + " 시트가 없어 Ad_Spend_Cache_Weekly 갱신을 건너뜁니다 " +
      "(setupTargetReport() 먼저 실행 필요)."
    );
    return;
  }

  const cutoverDate = readTargetEngineInputs_(engineSheet).cutoverDate;

  if(!(cutoverDate instanceof Date) || isNaN(cutoverDate.getTime())){
    Logger.log("Target_Engine Cutover Date가 유효하지 않아 Ad_Spend_Cache_Weekly 갱신을 건너뜁니다.");
    return;
  }

  const cutoverMonday = getMondayOfWeek_(cutoverDate);

  const metaSummaryNZD = computeMetaSpendWeeklySummary_();
  const naverSummaryKRW = computeNaverSearchAdSpendHistoryWeeklySummary_(cutoverMonday);
  const kakaoChannelSummaryKRW = computeKakaoChannelSpendWeeklySummary_();

  const rate = fetchKrwToNzdRate_();
  const naverSummaryNZD = convertSpendSummaryCurrency_(naverSummaryKRW, rate);
  const kakaoChannelSummaryNZD = convertSpendSummaryCurrency_(kakaoChannelSummaryKRW, rate);

  const combined = mergeSpendSummaries_([metaSummaryNZD, naverSummaryNZD, kakaoChannelSummaryNZD]);

  const cutoverKey = Utilities.formatDate(cutoverMonday, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd");

  const rows = Object.keys(combined)
    .filter(function(key){
      const weekKey = key.slice(0, key.indexOf("|"));
      return weekKey >= cutoverKey; // "yyyy-MM-dd" 문자열 비교 = 날짜 오름차순 비교와 동일
    })
    .map(function(key){
      const sepIndex = key.indexOf("|");
      return [key.slice(0, sepIndex), key.slice(sepIndex + 1), combined[key]];
    });

  let sheet = ss.getSheetByName(AD.SPEND_CACHE.WEEKLY_CACHE_SHEET);

  if(!sheet){
    sheet = ss.insertSheet(AD.SPEND_CACHE.WEEKLY_CACHE_SHEET);
  }

  sheet.clearContents();

  sheet.getRange(1, 1, 1, AD_SPEND_WEEKLY_CACHE_HEADERS.length)
    .setValues([AD_SPEND_WEEKLY_CACHE_HEADERS]);

  if(rows.length > 0){

    // WeekStart 자동 Date 변환 방지(위 WHY 참고) — 값을 쓰기 전에 텍스트로 고정.
    sheet.getRange(2, 1, rows.length, 1).setNumberFormat("@");
    sheet.getRange(2, 1, rows.length, AD_SPEND_WEEKLY_CACHE_HEADERS.length).setValues(rows);

  }

  sheet.hideSheet();

  SpreadsheetApp.flush();

  Logger.log(
    "Ad_Spend_Cache_Weekly 갱신 완료: " + rows.length + "행 (Cutover=" + cutoverKey +
    ", 환율 KRW→NZD=" + rate + ")"
  );

}


/**
 * ==========================================================
 * TEMP — refreshAdSpendWeeklyCache_() 수동 실행용 공개 진입점
 * ==========================================================
 */
function runRefreshAdSpendWeeklyCache(){

  refreshAdSpendWeeklyCache_();

}


/**
 * ==========================================================
 * Read Ad Spend Weekly Cache Map (같은 스프레드시트 안 캐시 읽기)
 *
 * OUTPUT
 * Object  키 "yyyy-MM-dd(weekStart)|segment" → Spent(NZD)
 * ==========================================================
 */
function readAdSpendWeeklyCacheMap_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(AD.SPEND_CACHE.WEEKLY_CACHE_SHEET);

  const map = {};

  if(!sheet) return map;

  const values = sheet.getDataRange().getValues();

  for(let i = 1; i < values.length; i++){

    const row = values[i];

    map[row[0] + "|" + row[1]] = row[2];

  }

  return map;

}


/**
 * ==========================================================
 * Read Ad Spend Cache Map (같은 스프레드시트 안 캐시 읽기 — Simple Trigger 안전)
 *
 * WHY
 * generateACQReport_()가 onEdit() Simple Trigger에서 호출되므로, 이 함수는
 * `getActiveSpreadsheet()`(같은 문서)만 쓰고 외부 시트/API는 절대 열지 않는다.
 *
 * OUTPUT
 * Object  키 "fy|month|segment" → Spent(NZD)
 * ==========================================================
 */
function readAdSpendCacheMap_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.ACQ.AD_SPEND_CACHE_SHEET);

  const map = {};

  if(!sheet) return map;

  const values = sheet.getDataRange().getValues();

  for(let i = 1; i < values.length; i++){

    const row = values[i];

    map[row[0] + "|" + row[1] + "|" + row[2]] = row[3];

  }

  return map;

}


/**
 * ==========================================================
 * Periodic Refresh Ad Spend Cache (설치형 시간 트리거 핸들러)
 *
 * WHY (2026-08-08, 사용자 요청)
 * ACQ_REP를 refresh해도 Kakao Moments(메시지광고 API)로 새로 보낸 메시지가
 * 반영 안 된다는 문의로 조사한 결과 두 가지가 겹쳐 있었음: (1) ACQ_REP 자체
 * refresh는 2026-08-06 성능 수정 이후 Revenue만 재조회하고 Ad_Spend_Cache는
 * 읽기만 함(211초 문제로 분리 확정, 되돌리지 않음), (2) Kakao Moments API
 * sync(`syncKakaoMomentsReportToKakaoSMSRaw_()`, AD_006_KakaoMoments.js)가
 * 자동 파이프라인에 전혀 연결 안 돼 있어 사람이 직접 안 돌리면 `KakaoSMS_Raw`
 * 자체가 안 바뀜. 사용자 확정 방향: ACQ_REP는 계속 캐시만 빠르게 읽고, 대신
 * 이 함수를 독립적인 시간 트리거로 주기적으로 돌려 캐시를 최신 유지
 * (`docs/OpenItems.md` 항목 19, 2026-08-04 보류를 사용자가 직접 해제).
 *
 * `computeKakaoChannelSpendSummary_()`(AD_005_KakaoChannel.js)가 이미
 * `KakaoSMS_Raw` 시트를 그대로 읽어 합산하고, Kakao Moments sync의 목적지도
 * 동일한 `KakaoSMS_Raw`이므로(AD_001_Config.js v1.17.0 changelog 참고) 별도
 * "Kakao Moments 전용 spend summary" 함수는 불필요 — sync만 먼저 최신화하면
 * `refreshAdSpendCache_()`가 자동으로 반영한다. Naver Search는 이미
 * `refreshAdSpendCache_()` 안에서 매번 실시간 API를 호출하므로 이 함수를
 * 주기적으로 도는 것만으로 "카카오모먼트와 동일한 처리"가 됨(사용자 확인).
 *
 * 실패 격리(refreshCampaignSpend_()/refreshAndGenerateACQReport_()와 동일
 * 원칙) — Kakao Moments Access Token은 refresh_token이 없어 장기 미사용 시
 * 만료될 수 있는데(AD_001_Config.js v1.10.0 changelog), 그 실패가
 * Naver Search/Meta/Kakao Channel 갱신까지 막으면 안 되므로 각각 별도
 * try/catch로 격리. 참고로 이 함수가 주기적으로 Kakao Moments API를 실제
 * 호출하는 것 자체가, 토큰이 미사용으로 만료되는 걸 막는 의도된 부수 효과
 * (v1.10.0 changelog에 이미 이 방향으로 적혀 있었음).
 * ==========================================================
 */
function periodicRefreshAdSpendCache_(){

  try {
    syncKakaoMomentsReportToKakaoSMSRaw_();
  } catch(err){
    Logger.log(
      "periodicRefreshAdSpendCache_: Kakao Moments sync 실패(비필수, 계속 진행) — " +
      (err && err.message ? err.message : err)
    );
  }

  try {
    refreshAdSpendCache_();
  } catch(err){
    Logger.log(
      "periodicRefreshAdSpendCache_: refreshAdSpendCache_ 실패 — 기존 캐시 유지 — " +
      (err && err.message ? err.message : err)
    );
  }

  // 2026-08-19 신규 — Target_REP 전용 주 단위 캐시도 같은 주기로 갱신. 실패가
  // 위 월 단위 캐시 갱신에 영향을 주면 안 되므로 별도 try/catch로 격리
  // (이 함수 전체의 실패 격리 원칙, 파일 헤더 Change Log 참고).
  try {
    refreshAdSpendWeeklyCache_();
  } catch(err){
    Logger.log(
      "periodicRefreshAdSpendCache_: refreshAdSpendWeeklyCache_ 실패 — 기존 캐시 유지 — " +
      (err && err.message ? err.message : err)
    );
  }

}


/**
 * ==========================================================
 * TEMP — periodicRefreshAdSpendCache_() 수동 실행/확인용 공개 진입점
 *
 * WHY
 * 이름 끝에 `_`가 붙은 함수는 Apps Script 편집기 Run 드롭다운에 안 뜬다
 * (docs/apps-script-gotchas.md #2) — 트리거가 실제로 4시간 기다리지 않고
 * 지금 바로 동작하는지 확인하고 싶을 때 이 함수를 대신 Run한다.
 * ==========================================================
 */
function runPeriodicRefreshAdSpendCache(){

  periodicRefreshAdSpendCache_();

}


/**
 * ==========================================================
 * TEMP — periodicRefreshAdSpendCache_() 시간 트리거 설치(최초 1회 수동
 * 실행 전용)
 *
 * WHY
 * `ScriptApp.newTrigger()`로 트리거를 설치하려면 Full Authorization이
 * 필요해 사람이 Apps Script 편집기에서 직접 한 번 Run 해야 한다
 * (FYREP_002_Report.js의 runInstallFYReportGenerateTrigger()와 동일 패턴).
 * 재실행해도 안전하도록 설치 전 같은 핸들러의 기존 트리거를 먼저 지운다
 * (deleteTriggersByHandlerName_(), 08_PipelineAsync.js 재사용) — 중복 설치
 * 방지.
 * ==========================================================
 */
function runInstallAdSpendPeriodicRefreshTrigger(){

  deleteTriggersByHandlerName_("periodicRefreshAdSpendCache_");

  ScriptApp.newTrigger("periodicRefreshAdSpendCache_")
    .timeBased()
    .everyHours(AD.SPEND_CACHE.PERIODIC_REFRESH_INTERVAL_HOURS)
    .create();

  Logger.log(
    CONFIG.LOG.PREFIX + " Ad Spend Cache 주기적 갱신 트리거 등록 완료 (매 " +
    AD.SPEND_CACHE.PERIODIC_REFRESH_INTERVAL_HOURS + "시간)."
  );

}


/**
 * ==========================================================
 * TEMP — 옛 Meta_Spend_Cache 시트 삭제(1회성 정리, 수동 실행 전용)
 *
 * WHY (2026-07-31)
 * "Meta_Spend_Cache"는 이 파일의 `Ad_Spend_Cache`(Meta+Naver Search 합산)로
 * 완전히 대체됨 — 더 이상 어떤 코드도 참조하지 않음. 사용자 요청으로 삭제.
 * ==========================================================
 */
function runDeleteMetaSpendCacheSheet(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Meta_Spend_Cache");

  if(!sheet){
    Logger.log("Meta_Spend_Cache 시트가 이미 없습니다.");
    return;
  }

  ss.deleteSheet(sheet);

  Logger.log("Meta_Spend_Cache 시트 삭제 완료.");

}
