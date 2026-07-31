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
 * v1.2.0
 *
 * Change Log
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
