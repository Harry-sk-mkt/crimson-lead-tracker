/**
 * ==========================================================
 * Marketing 2.0
 * Ad Spend — Naver Search Ad API Import/Transform (2번째 플랫폼)
 *
 * Responsibility
 * 네이버 검색광고 Open API(https://api.searchad.naver.com)를 직접 호출해
 * 캠페인 목록 + 지출 통계를 가져와 (FY|Month|Segment)별 Spent로 변환/집계한다.
 *
 * **설계 배경(2026-07-31)**: 원래 화면/다운로드 지출액 리포트에는 기간(날짜)
 * 컬럼이 전혀 없어(사용자 확인 — "계속노출" 표시뿐, 실제 날짜 아님) 사용자가
 * 매달 수동으로 "Report Month" 컬럼을 붙여넣는 방식(NaverSA_Raw)을 먼저
 * 구현했었으나, 사용자가 네이버 검색광고 API 자격증명(Customer ID/API License
 * Key/Secret Key)을 이미 보유하고 있다고 알려와 API 방식으로 전면 전환 —
 * API는 조회 기간을 정확히 지정할 수 있어 수동 입력 자체가 필요 없어짐.
 * 수동 붙여넣기 방식(NaverSA_Raw 시트, Header-Based Mapping)은 완전히 폐기.
 *
 * **인증(2026-07-31, naver/searchad-apidoc 공식 샘플 코드로 확인 — 추측
 * 없음)**: 요청마다 `X-Timestamp`(현재 시각 ms)/`X-API-KEY`/`X-Customer`/
 * `X-Signature`(Base64(HMAC-SHA256(secretKey, "{timestamp}.{method}.{uri}")))
 * 헤더 필요. 자격증명은 이 파일/Config 어디에도 없음 — Apps Script 편집기
 * "Project Settings > Script Properties"에 `AD.NAVER_SEARCH.API.PROPERTY_KEYS`
 * 이름으로 사용자가 직접 입력(git에 노출 금지).
 *
 * Business Segment 분류는 새로 만들지 않고 `getBusinessSegment()`
 * (16_TransformHelper.js)를 재사용 — `AD.NAVER_SEARCH.LEAD_SOURCE_OVERRIDE`
 * ("naver search") 고정값을 leadSource 자리에 넘겨 `_contact`류 캠페인이
 * BOFU로 오분류되는 문제를 해결(docs/exec-plans/active/
 * 2026-07-30-campaign-spend-integration.md 참고).
 *
 * **실 API 응답으로 검증 완료(2026-07-31)**: `runDebugNaverSearchAdCampaigns()`/
 * `runDebugNaverSearchAdStats()` 실행 결과 확인 — `/ncc/campaigns`는 배열,
 * 캠페인명 필드는 "name"(추정 맞음), `nccCampaignId`가 캠페인 ID.
 * `/stats`는 `{data:[{id, clkCnt, impCnt, salesAmt}], compTm, cycleBaseTm}`
 * 형태, id가 nccCampaignId와 동일 값으로 매칭됨. salesAmt는 원(KRW) 정수.
 *
 * Must NOT
 * - 새 Business Segment 분류 로직 작성 (getBusinessSegment() 재사용)
 * - 자격증명을 코드/Config에 하드코딩 (Script Properties만 사용)
 * - Target_Engine/ACQ_REP/NewP1_REP에 결과를 아직 쓰지 않음(여러 플랫폼
 *   집계 방식은 별도 결정 필요, exec-plan 참고)
 *
 * Stage
 * AD (2026-07-30 네이밍 컨벤션. 기존 00~99는 당장 안 바꿈)
 *
 * Version
 * v2.7.0
 *
 * Change Log
 * v2.7.0 (2026-08-05)
 * - 신규 `runShowNaverSearchAdCampaignStatsCache()`(수동 실행, 진단용) —
 *   사용자가 Google Sheets UI "모든 시트" 목록에서 `Naver_Search_Campaign_
 *   Stats_Cache`(hideSheet()로 매번 숨겨짐)를 못 찾겠다고 해서, 코드로
 *   존재 여부 확인 + 강제 공개하는 함수 추가.
 * v2.6.0 (2026-08-05)
 * - **버그 수정(실측)** — `runRefreshNaverSearchAdCampaignStatsCache()` 최초
 *   실행에서 `{code:11004, message:"데이터는 92일 이내 기간에서만 사용
 *   가능합니다."}` 에러 발생. impCnt/clkCnt 필드는 salesAmt 전용 조회(730일
 *   허용)와 별개로 92일 제약이 있음이 확인됨 — 애초 729일로 가정했던 게
 *   틀렸음. `computeNaverSearchAdCampaignStatsFetchWindow_()` 시그니처를
 *   `initialLookbackDays` → `maxRangeDays`로 교체, "최초 실행" 특수 케이스를
 *   없애고 **항상** `since`를 `[today-maxRangeDays+1, today]` 범위로 사전
 *   clamp(오래 못 돌다 재개되는 경우도 동일 로직으로 커버, 사후 재시도
 *   불필요). `AD_001_Config.js`의 `INITIAL_LOOKBACK_DAYS`(729)도
 *   `MAX_QUERY_RANGE_DAYS`(90)로 교체. 테스트에 `staleResume` 케이스 추가.
 * v2.5.0 (2026-08-05)
 * - **신규 — Search_OPS Campaign/Impressions/Link clicks 자동화(사용자 요청)**.
 *   기존 Spent 캐시(`computeNaverSearchAdSpendHistorySummary_()`, 월별 FY|Month|
 *   Segment 재계산 방식)와 달리, 캠페인별 Impressions/Link clicks는 **누적
 *   캐시**로 신규 설계 — Naver `/stats`가 최근 730일 이전 데이터를 아예 거부해
 *   매번 재계산하면 오래된 실적이 사라지는 문제를 피하기 위해, "지난 갱신
 *   이후~오늘"만 조회해 기존 캐시(`Naver_Search_Campaign_Stats_Cache` 시트)에
 *   계속 더한다. 신규 순수 함수: `todayDateString_()`/`shiftDateString_()`
 *   (yyyy-MM-dd 문자열 산술, `new Date(dateStr)` 직접 파싱 시 타임존 버그
 *   위험 회피), `computeNaverSearchAdCampaignStatsFetchWindow_()`(캐시
 *   상태로부터 이번에 조회할 since/until/shouldFetch 결정 — 같은 날 재실행
 *   시 중복 집계 방지), `accumulateNaverSearchAdCampaignStats_()`(기존
 *   누적치 + 이번 구간 impCnt/clkCnt 병합). 신규 IO:
 *   `fetchNaverSearchAdImpressionsClicksStats_()`(salesAmt 전용
 *   `fetchNaverSearchAdStats_()`는 그대로 둠), `readNaverSearchAdCampaignStatsCache_()`/
 *   `writeNaverSearchAdCampaignStatsCache_()`, 오케스트레이션
 *   `refreshNaverSearchAdCampaignStatsCache_()` + 수동 실행 진입점
 *   `runRefreshNaverSearchAdCampaignStatsCache()`. `08_PipelineAsync.js`에
 *   배선(매 Leads/MTA 백그라운드 실행마다 자동), `73_Search_Merge.js`가
 *   이 캐시를 읽어 Search_OPS Campaign/Impressions/Link clicks에 매칭.
 *   Reach는 Naver API에 해당 지표가 없어 이번 자동화 대상에서 제외(계속
 *   수동 입력). 신규 테스트 3개(`testShiftDateString`/
 *   `testComputeNaverSearchAdCampaignStatsFetchWindow`/
 *   `testAccumulateNaverSearchAdCampaignStats`) 전부 PASS.
 * v2.4.0 (2026-08-04)
 * - **진짜 원인 확정 — "재시도해도 안 되는" 400 에러였음**. v2.3.0에서 추가한
 *   재시도 로직이 처음으로 에러를 드러내 확인: `statusCode=400,
 *   {code:11004,message:"데이터는 최근 730일 이내 기간에서만 조회할 수
 *   있습니다."}` — Naver Search Ad API `/stats`의 공식 제약(최근 730일)이고,
 *   `BACKFILL_START`(2022-09)가 이보다 훨씬 오래돼 매번 필연적으로 발생하는
 *   것이었음(rate limit 추정은 틀렸음). 수정: `callNaverSearchAdApiWithRetry_()`
 *   가 이제 429/5xx만 재시도(그 외 4xx는 재시도해도 동일 결과라 즉시 실패,
 *   던지는 Error에 `statusCode`/`body` 첨부). `computeNaverSearchAdSpendHistorySummary_()`
 *   가 이 특정 에러(`statusCode===400 && body.code===11004`, 알려진 플랫폼
 *   제약)만 그 달을 건너뛰고 계속 진행, 그 외 에러는 그대로 던져 전체 갱신
 *   중단. `node --check`/naming/version-header/중복선언 검사 통과, `clasp
 *   push` 완료.
 * v2.3.0 (2026-08-04)
 * - **버그 수정(1차) — Ad_Spend_Cache에서 Search 세그먼트가 통째로 빈 상태로
 *   발견**. `callNaverSearchAdApi_()`가 상태 코드를 확인 안 해서,
 *   `computeNaverSearchAdSpendHistorySummary_()`의 2022-09~오늘 매달 반복
 *   `/stats` 호출(약 47회) 중 일부가 실패해도 에러 없이 그 달만 0으로
 *   처리되고 있었음(`runComputeNaverSearchAdSpendForMonth()` 단일 달 호출은
 *   정상 동작 확인 — API 인증/서명/`getBusinessSegment()` 분류 로직 문제
 *   아님을 먼저 배제). 신규 `callNaverSearchAdApiWithRetry_()`(상태 코드 200
 *   아니면 지수 백오프로 최대 3회 재시도, 그래도 실패하면 명확한 에러를 던짐)
 *   를 `fetchNaverSearchAdCampaignMap_()`/`fetchNaverSearchAdStats_()` 양쪽에
 *   적용 — 이때는 원인을 rate limit로 추정했으나 실제로는 v2.4.0에서 밝혀진
 *   730일 제약이었음.
 * v2.2.0 (2026-07-31)
 * - **전체 이력 백필 함수 추가** — ACQ_REP W열에 Meta+Naver Search 합산 지출을
 *   연결하기로 확정(사용자, "Meta와 동일한 범위"로 소급). 순수 함수
 *   `generateCalendarMonthSequence_()`(시작~종료 연/월 → 달력월 튜플 나열,
 *   Meta의 FY/Month 라벨용 `generateAdSpendMonthRange_()`와 목적이 달라
 *   재사용 불가) 신규. IO 래퍼 `computeNaverSearchAdSpendHistorySummary_()`
 *   (캠페인 목록은 1회만 조회, 시작 연/월~현재월까지 매달 /stats 호출해
 *   FY|Month|Segment로 합산 — `AD.NAVER_SEARCH.API.BACKFILL_START` 기준).
 *   AD_004_SpendCache.js가 이 함수를 호출해 Meta 몫과 합산. Node 하네스
 *   신규 test 1개 PASS.
 * v2.1.0 (2026-07-31)
 * - 실 API 응답 검증 완료 후 최종 집계 함수 구현: `buildCalendarMonthRange_()`
 *   (순수, 연/월 → since/until 날짜 문자열 — Date 객체는 달력 계산 용도로만
 *   써서 타임존 무관하게 안전)/`computeNaverSearchAdSpendByFYMonthSegment_()`
 *   (순수, 캠페인 id→name 매핑 + stats 행 → FY|Month|Segment 합산 —
 *   LEAD_SOURCE_OVERRIDE로 getBusinessSegment() 재사용). IO 래퍼
 *   `fetchNaverSearchAdCampaignMap_()`/`fetchNaverSearchAdStats_()`/
 *   `computeNaverSearchAdSpendSummaryForMonth_()`. 수동 실행 진입점
 *   `runComputeNaverSearchAdSpendForMonth()`(연/월은 함수 상단 상수를 직접
 *   수정해서 재사용 — `runDebugMetaSpendByCampaignForMonth()`와 동일 관례).
 *   Node 하네스 신규 test 2개 전부 PASS.
 * v2.0.0 (2026-07-31)
 * - 수동 붙여넣기(NaverSA_Raw) 방식 완전 폐기, API 방식으로 전면 재작성.
 *   Base URL을 초기엔 공식 샘플 저장소 값(`api.searchad.naver.com`)으로
 *   썼다가 403 invalid-signature 실측 후 GitHub 이슈 #1319(동일 Apps Script
 *   서명 로직으로 GET 200 성공 사례)로 `api.naver.com`이 맞음을 확인·수정.
 *   이후에도 403이 재발해 `runDebugNaverSearchAdSignatureInputs()`(신규
 *   진단, 자격증명 길이/마스킹 노출)로 확인한 결과 Script Properties에
 *   저장된 Secret Key 끝의 "=="가 누락돼 있었음(길이 50, 정상 52) — 사용자가
 *   재입력 후 해결.
 * v1.0.0 (2026-07-31)
 * - 최초 구현(수동 붙여넣기 방식 — v2.0.0에서 폐기됨).
 * ==========================================================
 */


/**
 * ==========================================================
 * Get Naver Search Ad Credentials (IO 래퍼)
 *
 * WHY
 * 자격증명은 Script Properties에서만 읽는다 — 코드/git에 절대 남기지 않기
 * 위함(사용자 확인). 값이 하나라도 없으면 명확한 안내 메시지와 함께 에러.
 * ==========================================================
 */
function getNaverSearchAdCredentials_(){

  const props = PropertiesService.getScriptProperties();
  const keys = AD.NAVER_SEARCH.API.PROPERTY_KEYS;

  const customerId = props.getProperty(keys.CUSTOMER_ID);
  const apiKey = props.getProperty(keys.API_KEY);
  const secretKey = props.getProperty(keys.SECRET_KEY);

  if(!customerId || !apiKey || !secretKey){
    throw new Error(
      "Naver Search Ad API 자격증명이 없습니다. Apps Script 편집기 " +
      "Project Settings > Script Properties에 다음 키를 추가하세요: " +
      keys.CUSTOMER_ID + ", " + keys.API_KEY + ", " + keys.SECRET_KEY
    );
  }

  return { customerId: customerId, apiKey: apiKey, secretKey: secretKey };

}


/**
 * ==========================================================
 * Compute Naver Search Ad Signature (순수 함수)
 *
 * WHY
 * 네이버 검색광고 API는 요청마다 HMAC-SHA256 서명이 필요하다(공식 샘플
 * python-sample/examples/signaturehelper.py로 확인): message =
 * "{timestamp}.{method}.{uri}"(쿼리스트링 제외, 경로만), secretKey로
 * HMAC-SHA256 해시 후 Base64 인코딩.
 *
 * INPUT
 * timestamp : string  현재 시각(ms, 문자열)
 * method : string  "GET" 등
 * uri : string  경로만(쿼리스트링 제외, 예: "/stats")
 * secretKey : string
 *
 * OUTPUT
 * string  Base64 인코딩된 서명
 * ==========================================================
 */
function computeNaverSearchAdSignature_(timestamp, method, uri, secretKey){

  const message = timestamp + "." + method + "." + uri;
  const rawSignature = Utilities.computeHmacSha256Signature(message, secretKey);

  return Utilities.base64Encode(rawSignature);

}


/**
 * ==========================================================
 * Build Naver Search Ad Query String (순수 함수)
 *
 * WHY
 * UrlFetchApp은 Python requests처럼 params 딕셔너리를 자동으로 인코딩해
 * 주지 않는다. 공식 샘플 코드(ad_management_sample.py) 기준으로 "ids"는
 * 배열 값을 반복 파라미터(ids=A&ids=B)로 보내야 하고, "fields"/"timeRange"는
 * 호출부가 미리 JSON.stringify()한 문자열을 그대로 하나의 파라미터로 보내야
 * 한다(구글 앱스 스크립트 연동 시 파라미터 인코딩 문제가 실제로 보고된 바
 * 있어, 이 함수는 배열만 반복 처리하고 그 외엔 그대로 문자열화한다 —
 * 호출부가 JSON 문자열을 만들어서 넘기는 책임을 진다).
 *
 * INPUT
 * params : Object  값이 배열이면 반복 파라미터, 그 외엔 단일 파라미터
 *
 * OUTPUT
 * string  쿼리스트링(맨 앞 "?" 제외)
 *
 * TEST
 * testBuildNaverSearchAdQueryString() 참고
 * ==========================================================
 */
function buildNaverSearchAdQueryString_(params){

  const parts = [];

  Object.keys(params || {}).forEach(function(key){

    const value = params[key];

    if(Array.isArray(value)){

      value.forEach(function(v){
        parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(v));
      });

    } else {

      parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(value));

    }

  });

  return parts.join("&");

}


/**
 * ==========================================================
 * TEST — buildNaverSearchAdQueryString_()
 * ==========================================================
 */
function testBuildNaverSearchAdQueryString(){

  const result = buildNaverSearchAdQueryString_({
    ids: ["cmp-a001-01-000000009593715", "cmp-a001-01-000000009537809"],
    fields: JSON.stringify(["salesAmt"]),
    timeRange: JSON.stringify({ since: "2026-07-01", until: "2026-07-31" })
  });

  const pass =
    result.indexOf("ids=cmp-a001-01-000000009593715") !== -1 &&
    result.indexOf("ids=cmp-a001-01-000000009537809") !== -1 &&
    result.indexOf("fields=" + encodeURIComponent('["salesAmt"]')) !== -1 &&
    result.indexOf("timeRange=" + encodeURIComponent('{"since":"2026-07-01","until":"2026-07-31"}')) !== -1;

  Logger.log("Result: " + result);
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Call Naver Search Ad API (IO 래퍼)
 *
 * WHY
 * 인증 헤더 생성 + 요청 전송을 한 곳에 모은다. 실패 상태 코드도 그대로
 * 반환(muteHttpExceptions) — 호출부/진단 함수가 statusCode를 보고 판단.
 *
 * INPUT
 * method : string  "GET" 등
 * uri : string  경로만(쿼리스트링 제외)
 * queryParams : Object  buildNaverSearchAdQueryString_() 참고
 *
 * OUTPUT
 * {statusCode:number, body:Object|string}  JSON 파싱 실패 시 body는 원문 문자열
 * ==========================================================
 */
function callNaverSearchAdApi_(method, uri, queryParams){

  const creds = getNaverSearchAdCredentials_();
  const timestamp = String(Date.now());
  const signature = computeNaverSearchAdSignature_(timestamp, method, uri, creds.secretKey);

  const queryString = buildNaverSearchAdQueryString_(queryParams);
  const url = AD.NAVER_SEARCH.API.BASE_URL + uri + (queryString ? "?" + queryString : "");

  const response = UrlFetchApp.fetch(url, {
    method: method,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "X-Timestamp": timestamp,
      "X-API-KEY": creds.apiKey,
      "X-Customer": creds.customerId,
      "X-Signature": signature
    },
    muteHttpExceptions: true
  });

  const statusCode = response.getResponseCode();
  const text = response.getContentText();

  let body;

  try {
    body = JSON.parse(text);
  } catch(e){
    body = text;
  }

  return { statusCode: statusCode, body: body };

}


/**
 * ==========================================================
 * Call Naver Search Ad API With Retry (IO 래퍼)
 *
 * WHY (2026-08-04, 실측 — Ad_Spend_Cache에서 Search 세그먼트가 통째로 빈
 * 상태로 발견)
 * `computeNaverSearchAdSpendHistorySummary_()`가 2022-09~오늘까지 매달
 * `/stats`를 반복 호출하는데(현재 기준 약 47회), `callNaverSearchAdApi_()`는
 * 상태 코드를 확인하지 않고 그대로 반환하기만 해서 그 중 한 달이라도
 * 실패하면 호출부(`fetchNaverSearchAdStats_()`의 `Array.isArray` 체크)가
 * 에러 없이 그 달만 조용히 0으로 처리하는 게 실측됨 —
 * `runComputeNaverSearchAdSpendForMonth()`(단일 달, 반복 호출 없음)는 정상
 * 동작해 API 자체/서명/`getBusinessSegment()` 분류 로직 문제가 아님을 먼저
 * 확인했음. **실제 원인 확정(2026-08-04, 재시도 도입 후 노출된 에러로 확인)**:
 * `/stats`는 "최근 730일 이내 기간만 조회 가능"이 공식 제약(400,
 * `{code:11004}`) — `BACKFILL_START`(2022-09)가 이 범위보다 훨씬 오래돼
 * 매 실행마다 오래된 달에서 필연적으로 400이 남. 재시도해도 똑같이 실패하는
 * 요청 자체의 문제이므로 **4xx(429 제외)는 재시도하지 않고 즉시 실패
 * 처리**(429/5xx만 지수 백오프 재시도) — 호출부(`computeNaverSearchAdSpendHistorySummary_()`)
 * 가 이 "조회 기간 초과"(`statusCode===400 && body.code===11004`)는 알려진
 * 제약으로 보고 그 달만 건너뛰고, 그 외 에러는 그대로 던져 전체 갱신을
 * 중단시킨다(진짜 실패를 조용히 묻지 않기 위함).
 *
 * @param {number} [maxAttempts]  기본 3회(429/5xx에만 적용)
 * ==========================================================
 */
function callNaverSearchAdApiWithRetry_(method, uri, queryParams, maxAttempts){

  const attempts = maxAttempts || 3;
  let lastResult = null;

  for(let attempt = 1; attempt <= attempts; attempt++){

    lastResult = callNaverSearchAdApi_(method, uri, queryParams);

    if(lastResult.statusCode === 200) return lastResult;

    // 429(rate limit)/5xx(서버 오류)만 재시도 대상 — 그 외 4xx(예: 400 잘못된
    // 요청)는 재시도해도 동일하게 실패하는 요청 자체의 문제라 즉시 중단.
    const isRetryable = lastResult.statusCode === 429 || lastResult.statusCode >= 500;

    if(!isRetryable || attempt === attempts) break;

    Utilities.sleep(1000 * attempt);

  }

  const error = new Error(
    "Naver Search Ad API 호출 실패(" + method + " " + uri + ", statusCode=" +
    lastResult.statusCode + "): " + JSON.stringify(lastResult.body)
  );

  error.statusCode = lastResult.statusCode;
  error.body = lastResult.body;

  throw error;

}


/**
 * ==========================================================
 * TEMP — 서명 입력값 진단 (2026-07-31)
 *
 * WHY
 * 403 invalid-signature가 Base URL 수정 후에도 재발 — Script Properties에
 * 붙여넣은 값에 보이지 않는 공백/개행이 섞였을 가능성을 확인하기 위해,
 * 자격증명 길이(및 앞뒤 3글자만 마스킹 노출)와 실제로 서명에 쓰인 메시지
 * 문자열/타임스탬프/서명값을 그대로 로그로 출력한다. 값 전체를 노출하지
 * 않아 로그를 공유해도 비교적 안전하다.
 * ==========================================================
 */
function runDebugNaverSearchAdSignatureInputs(){

  const props = PropertiesService.getScriptProperties();
  const keys = AD.NAVER_SEARCH.API.PROPERTY_KEYS;

  const customerId = props.getProperty(keys.CUSTOMER_ID);
  const apiKey = props.getProperty(keys.API_KEY);
  const secretKey = props.getProperty(keys.SECRET_KEY);

  function mask(value){
    if(!value) return "(없음)";
    if(value.length <= 8) return "len=" + value.length + " value=" + JSON.stringify(value);
    return "len=" + value.length + " head=" + JSON.stringify(value.slice(0, 4)) +
      " tail=" + JSON.stringify(value.slice(-4));
  }

  Logger.log("customerId: " + mask(customerId));
  Logger.log("apiKey: " + mask(apiKey));
  Logger.log("secretKey: " + mask(secretKey));

  const timestamp = String(Date.now());
  const method = "GET";
  const uri = "/ncc/campaigns";
  const message = timestamp + "." + method + "." + uri;
  const signature = computeNaverSearchAdSignature_(timestamp, method, uri, secretKey);

  Logger.log("message: " + JSON.stringify(message));
  Logger.log("signature: " + signature);

}


/**
 * ==========================================================
 * TEMP — 캠페인 목록 진단(GET /ncc/campaigns)
 *
 * WHY (2026-07-31)
 * 캠페인명 실제 필드 키("name"으로 추정 — /ncc/adgroups CREATE 페이로드
 * 관례로 추정, 공식 샘플에 /ncc/campaigns 응답 예시 자체는 없어 확정 아님)를
 * 실 응답으로 확인하기 위한 진단 함수. 응답 전체가 아니라 상태 코드 + 처음
 * 3개 항목만 로그로 출력.
 * ==========================================================
 */
function runDebugNaverSearchAdCampaigns(){

  const result = callNaverSearchAdApi_("GET", "/ncc/campaigns", {});

  Logger.log("statusCode: " + result.statusCode);

  if(Array.isArray(result.body)){
    Logger.log("캠페인 수: " + result.body.length);
    Logger.log("처음 3개: " + JSON.stringify(result.body.slice(0, 3), null, 2));
  } else {
    Logger.log("응답 본문(배열 아님): " + JSON.stringify(result.body, null, 2));
  }

}


/**
 * ==========================================================
 * TEMP — 지출 통계 진단(GET /stats)
 *
 * WHY (2026-07-31)
 * /stats가 캠페인 id를 어떤 키로 돌려주는지, salesAmt가 실제로 어떤 형태로
 * 오는지 실 응답으로 확인하기 위한 진단 함수. runDebugNaverSearchAdCampaigns()
 * 먼저 실행해서 실제 캠페인 ID 몇 개를 아래 sampleIds에 채워 넣고 실행할 것
 * (또는 이 함수가 자동으로 /ncc/campaigns를 먼저 호출해 앞 3개를 사용).
 *
 * 조회 기간은 이번 달(오늘 기준 1일~오늘)로 임시 설정 — 실제 검증 시 필요에
 * 따라 since/until을 직접 바꿔서 재실행.
 * ==========================================================
 */
function runDebugNaverSearchAdStats(){

  const campaignsResult = callNaverSearchAdApi_("GET", "/ncc/campaigns", {});

  if(!Array.isArray(campaignsResult.body) || campaignsResult.body.length === 0){
    Logger.log("캠페인 목록을 못 가져옴 — statusCode: " + campaignsResult.statusCode +
      ", body: " + JSON.stringify(campaignsResult.body));
    return;
  }

  const sampleIds = campaignsResult.body.slice(0, 3).map(function(c){ return c.nccCampaignId; });

  const today = new Date();
  const since = Utilities.formatDate(new Date(today.getFullYear(), today.getMonth(), 1), Session.getScriptTimeZone(), "yyyy-MM-dd");
  const until = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");

  Logger.log("sampleIds: " + JSON.stringify(sampleIds) + ", since=" + since + ", until=" + until);

  const statsResult = callNaverSearchAdApi_("GET", "/stats", {
    ids: sampleIds,
    fields: JSON.stringify(["impCnt", "clkCnt", "salesAmt"]),
    timeRange: JSON.stringify({ since: since, until: until })
  });

  Logger.log("statusCode: " + statsResult.statusCode);
  Logger.log("응답 본문: " + JSON.stringify(statsResult.body, null, 2));

}


/**
 * ==========================================================
 * Build Calendar Month Range (순수 함수)
 *
 * WHY
 * 네이버 API에 보낼 since/until("yyyy-MM-dd")을 연/월로부터 만든다. Date
 * 객체는 "그 달이 며칠까지 있는지" 계산 용도로만 쓰고(로컬 달력 계산이라
 * 타임존 변환이 개입하지 않음 — 외부에서 읽은 날짜 셀을 다루는 게 아니라
 * 순수 계산이라 이전에 겪은 타임존 버그 클래스와 무관), 문자열은 직접
 * 조립해서 어떤 형태의 타임존 이슈도 배제한다.
 *
 * INPUT
 * year : number
 * month : number  1~12
 *
 * OUTPUT
 * {since:string, until:string}  둘 다 "yyyy-MM-dd"
 *
 * TEST
 * testBuildCalendarMonthRange() 참고
 * ==========================================================
 */
function buildCalendarMonthRange_(year, month){

  function pad2(n){ return (n < 10 ? "0" : "") + n; }

  const since = year + "-" + pad2(month) + "-01";
  const lastDay = new Date(year, month, 0).getDate();
  const until = year + "-" + pad2(month) + "-" + pad2(lastDay);

  return { since: since, until: until };

}


/**
 * ==========================================================
 * TEST — buildCalendarMonthRange_()
 * ==========================================================
 */
function testBuildCalendarMonthRange(){

  const jul = buildCalendarMonthRange_(2026, 7);
  const julPass = jul.since === "2026-07-01" && jul.until === "2026-07-31";

  Logger.log("2026-07: " + JSON.stringify(jul) + " (expected 07-01~07-31)");
  Logger.log(julPass ? "✅ PASS" : "❌ FAIL");

  // 2026년은 윤년 아님 — 2월 28일까지
  const feb = buildCalendarMonthRange_(2026, 2);
  const febPass = feb.since === "2026-02-01" && feb.until === "2026-02-28";

  Logger.log("2026-02: " + JSON.stringify(feb) + " (expected 02-01~02-28, 평년)");
  Logger.log(febPass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Naver Search Ad Spend By FY/Month/Segment (순수 함수)
 *
 * WHY
 * /ncc/campaigns(id→name 매핑)와 /stats(id별 salesAmt) 응답을 조인해
 * (FY|Month|Segment) 키로 합산한다 — Meta 파이프라인의
 * aggregateMetaSpendByFYMonthSegment_()와 동일한 출력 형태.
 *
 * INPUT
 * campaignMap : Object  {nccCampaignId: name}
 * statsRows : Array<{id, salesAmt, ...}>  /stats 응답의 data 배열
 * referenceDate : Date  이 조회 기간을 대표하는 날짜(그 달의 아무 날, FY/Month
 *   라벨 계산용 — 달력 계산이라 타임존 무관하게 안전)
 *
 * OUTPUT
 * Object  키 "fy|month|segment" → 합산 Spent(원)
 *
 * TEST
 * testComputeNaverSearchAdSpendByFYMonthSegment() 참고
 * ==========================================================
 */
function computeNaverSearchAdSpendByFYMonthSegment_(campaignMap, statsRows, referenceDate){

  const fy = Number(getFiscalYear(referenceDate).replace("FY", ""));
  const month = getFiscalMonthLabel(referenceDate);

  const totals = {};

  statsRows.forEach(function(row){

    const name = campaignMap[row.id];

    if(!name) return;

    const segment = getBusinessSegment(name, "", AD.NAVER_SEARCH.LEAD_SOURCE_OVERRIDE, "");
    const key = fy + "|" + month + "|" + segment;

    totals[key] = (totals[key] || 0) + (Number(row.salesAmt) || 0);

  });

  return totals;

}


/**
 * ==========================================================
 * TEST — computeNaverSearchAdSpendByFYMonthSegment_()
 * ==========================================================
 */
function testComputeNaverSearchAdSpendByFYMonthSegment(){

  const campaignMap = {
    "cmp-a001-01-000000009593715": "KR_core_HStoDS_contact",     // Search(override)
    "cmp-a001-01-000000009537809": "KR_core_competitions_contact", // Search(override)
    "cmp-a001-01-000000010516912": "KR_core_expo_earlybird2_ptc"   // Seminar(확정 신호)
  };

  const statsRows = [
    { id: "cmp-a001-01-000000009593715", salesAmt: 3765 },
    { id: "cmp-a001-01-000000009537809", salesAmt: 7245 },
    { id: "cmp-a001-01-000000010516912", salesAmt: 1000 },
    { id: "cmp-a001-01-999999999999999", salesAmt: 999 } // campaignMap에 없는 id — 무시돼야 함
  ];

  const result = computeNaverSearchAdSpendByFYMonthSegment_(
    campaignMap, statsRows, new Date(2026, 6, 15) // 2026-07-15
  );

  const pass =
    result["26|JUL|Search"] === (3765 + 7245) &&
    result["26|JUL|Seminar"] === 1000 &&
    Object.keys(result).length === 2;

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Fetch NaverSA Campaign Map (IO 래퍼)
 * ==========================================================
 */
function fetchNaverSearchAdCampaignMap_(){

  const result = callNaverSearchAdApiWithRetry_("GET", "/ncc/campaigns", {});
  const map = {};

  if(Array.isArray(result.body)){
    result.body.forEach(function(c){ map[c.nccCampaignId] = c.name; });
  }

  return map;

}


/**
 * ==========================================================
 * Fetch NaverSA Stats (IO 래퍼)
 *
 * WHY
 * ids가 비어있으면 API 호출 자체를 생략(빈 계정/신규 상태 방어).
 * ==========================================================
 */
function fetchNaverSearchAdStats_(ids, since, until){

  if(!ids || ids.length === 0) return [];

  const result = callNaverSearchAdApiWithRetry_("GET", "/stats", {
    ids: ids,
    fields: JSON.stringify(["salesAmt"]),
    timeRange: JSON.stringify({ since: since, until: until })
  });

  return (result.body && Array.isArray(result.body.data)) ? result.body.data : [];

}


/**
 * ==========================================================
 * Compute NaverSA Spend Summary For Month (IO 래퍼)
 * ==========================================================
 */
function computeNaverSearchAdSpendSummaryForMonth_(year, month){

  const range = buildCalendarMonthRange_(year, month);
  const campaignMap = fetchNaverSearchAdCampaignMap_();
  const ids = Object.keys(campaignMap);
  const statsRows = fetchNaverSearchAdStats_(ids, range.since, range.until);
  const referenceDate = new Date(year, month - 1, 1);

  return computeNaverSearchAdSpendByFYMonthSegment_(campaignMap, statsRows, referenceDate);

}


/**
 * ==========================================================
 * TEMP — computeNaverSearchAdSpendSummaryForMonth_() 수동 실행/확인용 진입점
 *
 * WHY
 * year/month는 함수 상단 상수를 직접 수정해서 원하는 달로 재실행
 * (runDebugMetaSpendByCampaignForMonth()와 동일 관례).
 * ==========================================================
 */
function runComputeNaverSearchAdSpendForMonth(){

  const year = 2026;
  const month = 7;

  const summary = computeNaverSearchAdSpendSummaryForMonth_(year, month);

  Logger.log("FY/Month/Segment별 Spent(원): " + JSON.stringify(summary, null, 2));

}


/**
 * ==========================================================
 * Generate Calendar Month Sequence (순수 함수)
 *
 * WHY
 * 소급 백필 범위(시작 연/월 ~ 종료 연/월, 양끝 포함)를 달력월 단위로
 * 나열한다 — buildCalendarMonthRange_()에 하나씩 넘겨 API를 반복 호출하기
 * 위함. Meta의 generateAdSpendMonthRange_()(AD_002_Meta.js)는 FY/Month
 * 라벨을 만드는 함수라 목적이 달라 재사용 불가(이건 달력 연/월 튜플 필요).
 *
 * INPUT
 * startYear/startMonth/endYear/endMonth : number  month는 1~12
 *
 * OUTPUT
 * Array<{year:number, month:number}>  오름차순, 유효하지 않은 범위(끝이
 * 시작보다 이전)면 빈 배열
 *
 * TEST
 * testGenerateCalendarMonthSequence() 참고
 * ==========================================================
 */
function generateCalendarMonthSequence_(startYear, startMonth, endYear, endMonth){

  const sequence = [];

  let year = startYear;
  let month = startMonth;

  const startIndex = startYear * 12 + startMonth;
  const endIndex = endYear * 12 + endMonth;

  if(endIndex < startIndex) return sequence;

  while(year * 12 + month <= endIndex){

    sequence.push({ year: year, month: month });

    month++;
    if(month > 12){ month = 1; year++; }

  }

  return sequence;

}


/**
 * ==========================================================
 * TEST — generateCalendarMonthSequence_()
 * ==========================================================
 */
function testGenerateCalendarMonthSequence(){

  const result = generateCalendarMonthSequence_(2022, 11, 2023, 2);
  const labels = result.map(function(r){ return r.year + "-" + r.month; });

  const pass =
    labels.length === 4 &&
    labels[0] === "2022-11" &&
    labels[3] === "2023-2";

  Logger.log("Result: " + JSON.stringify(labels));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

  const invalid = generateCalendarMonthSequence_(2023, 2, 2022, 11);

  Logger.log("Invalid range length: " + invalid.length + " (expected 0)");
  Logger.log(invalid.length === 0 ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute NaverSA Spend History Summary (IO 래퍼)
 *
 * WHY
 * ACQ_REP 전체 이력 반영을 위해, 캠페인 목록은 한 번만 조회하고(API 호출
 * 절약) 시작 연/월부터 오늘이 속한 달까지 매달 /stats를 호출해 합산한다.
 *
 * WHY (2026-08-04 — "조회 기간 초과" 달 건너뛰기)
 * Naver Search Ad API `/stats`는 "최근 730일 이내 기간만 조회 가능"이 공식
 * 제약(실측: 400, `{code:11004}`) — `BACKFILL_START`(2022-09)가 이 범위보다
 * 훨씬 오래돼 매 실행마다 오래된 달에서 필연적으로 이 에러가 남(Meta는
 * 사용자가 수동 export하는 방식이라 이 제약이 없어 같은 소급 범위를 그대로
 * 가져왔던 게 원인). 이 특정 에러(알려진 플랫폼 제약, 버그 아님)만 그 달을
 * 건너뛰고 계속 진행 — 그 외 에러(인증 실패 등 진짜 문제)는 그대로 던져
 * 전체 갱신을 중단시킨다.
 *
 * INPUT
 * startYear/startMonth : number  AD.NAVER_SEARCH.API.BACKFILL_START 참고
 *
 * OUTPUT
 * Object  키 "fy|month|segment" → 합산 Spent(원, KRW)
 * ==========================================================
 */
function computeNaverSearchAdSpendHistorySummary_(startYear, startMonth){

  const campaignMap = fetchNaverSearchAdCampaignMap_();
  const ids = Object.keys(campaignMap);

  const today = new Date();
  const months = generateCalendarMonthSequence_(
    startYear, startMonth, today.getFullYear(), today.getMonth() + 1
  );

  const totals = {};

  months.forEach(function(m){

    const range = buildCalendarMonthRange_(m.year, m.month);

    let statsRows;

    try {
      statsRows = fetchNaverSearchAdStats_(ids, range.since, range.until);
    } catch(e){

      if(e.statusCode === 400 && e.body && e.body.code === 11004){

        Logger.log(
          m.year + "-" + m.month + " 건너뜀(Naver Search Ad API 조회 가능 기간 " +
          "밖 — 최근 730일 이내만 조회 가능)."
        );

        return;

      }

      throw e;

    }

    const referenceDate = new Date(m.year, m.month - 1, 1);
    const monthTotals = computeNaverSearchAdSpendByFYMonthSegment_(campaignMap, statsRows, referenceDate);

    Object.keys(monthTotals).forEach(function(key){
      totals[key] = (totals[key] || 0) + monthTotals[key];
    });

  });

  return totals;

}


/**
 * ==========================================================
 * Today Date String (순수 함수, yyyy-MM-dd)
 *
 * WHY
 * `buildCalendarMonthRange_()`와 동일한 이유로 Date 객체를 로컬 연/월/일
 * 컴포넌트 읽기 용도로만 쓰고 문자열은 직접 조립 — 외부 스프레드시트 셀을
 * 읽는 게 아니라 스크립트 실행 시각 자체이므로 타임존 버그 클래스와 무관.
 * ==========================================================
 */
function todayDateString_(){

  const now = new Date();

  function pad2(n){ return (n < 10 ? "0" : "") + n; }

  return now.getFullYear() + "-" + pad2(now.getMonth() + 1) + "-" + pad2(now.getDate());

}


/**
 * ==========================================================
 * Shift Date String (순수 함수, "yyyy-MM-dd" ± N일)
 *
 * WHY
 * 문자열을 `new Date(dateStr)`로 직접 파싱하면 UTC 자정으로 해석돼(로컬
 * 타임존에 따라 하루 밀리는) 이 프로젝트가 반복적으로 겪은 타임존 버그
 * 클래스에 해당 — 연/월/일을 직접 분해해 `new Date(y, m, d)`(로컬 자정)로
 * 만든 뒤 setDate()로 이동, 다시 로컬 컴포넌트로 조립해서 반환.
 *
 * INPUT
 * dateStr : string  "yyyy-MM-dd"
 * deltaDays : number  양수/음수 모두 허용
 *
 * OUTPUT
 * string  "yyyy-MM-dd"
 *
 * TEST
 * testShiftDateString() 참고
 * ==========================================================
 */
function shiftDateString_(dateStr, deltaDays){

  const parts = dateStr.split("-").map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);

  d.setDate(d.getDate() + deltaDays);

  function pad2(n){ return (n < 10 ? "0" : "") + n; }

  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());

}


/**
 * ==========================================================
 * TEST — shiftDateString_()
 * ==========================================================
 */
function testShiftDateString(){

  const pass =
    shiftDateString_("2026-08-05", 1) === "2026-08-06" &&
    shiftDateString_("2026-08-05", -1) === "2026-08-04" &&
    shiftDateString_("2026-08-31", 1) === "2026-09-01" &&
    shiftDateString_("2026-01-01", -1) === "2025-12-31" &&
    shiftDateString_("2026-08-05", 0) === "2026-08-05";

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Naver Search Ad Campaign Stats Fetch Window (순수 함수)
 *
 * WHY (2026-08-05, 누적 캐시 설계 — 사용자 확정)
 * "지난 갱신(`lastFetchedThroughStr`) 다음날 ~ 오늘"만 조회해 기존 누적치에
 * 더하는 방식 — 이미 캐시에 반영된 값은 절대 다시 조회할 필요가 없다.
 *
 * **실측 정정(2026-08-05)**: impCnt/clkCnt 필드는 salesAmt와 별개로 "최근
 * 92일 이내"만 조회 가능함이 실 API 에러로 확인됨(`AD_001_Config.js`
 * `NAVER_SEARCH_CAMPAIGN_STATS` 주석 참고, 애초 가정했던 730일이 아님) —
 * `maxRangeDays`(권장 90, 92일보다 이틀 여유)로 `since`를 **항상 사전에**
 * `[today - maxRangeDays + 1, today]` 범위 안으로 clamp한다(캐시가 없는
 * 최초 실행이든, 오래 못 돌다가 재개되는 경우든 동일 로직 하나로 처리 —
 * 사후 에러 캐치/재시도가 아니라 애초에 범위 초과 요청 자체를 안 만듦).
 *
 * 같은 날 여러 번 실행돼도(예: Leads Import 직후 MTA Import) 두 번째부터는
 * `since`가 `until`보다 미래가 되어 `shouldFetch:false`로 스킵 — 같은 날
 * 데이터를 중복으로 더하는 걸 방지(당일 내 증분은 다음날 반영됨, 사용자
 * 확정 트레이드오프).
 *
 * INPUT
 * lastFetchedThroughStr : string|null  마지막으로 성공 반영한 until 값
 *   ("yyyy-MM-dd"), 최초 실행이면 null/빈 문자열
 * todayStr : string  "yyyy-MM-dd" (todayDateString_() 결과 주입)
 * maxRangeDays : number  API가 허용하는 최대 조회 범위(오늘 포함 일수)
 *
 * OUTPUT
 * { since:string, until:string, shouldFetch:boolean }
 *
 * TEST
 * testComputeNaverSearchAdCampaignStatsFetchWindow() 참고
 * ==========================================================
 */
function computeNaverSearchAdCampaignStatsFetchWindow_(lastFetchedThroughStr, todayStr, maxRangeDays){

  const earliestAllowed = shiftDateString_(todayStr, -(maxRangeDays - 1));

  let since = lastFetchedThroughStr
    ? shiftDateString_(lastFetchedThroughStr, 1)
    : earliestAllowed;

  if(since < earliestAllowed) since = earliestAllowed;

  return { since: since, until: todayStr, shouldFetch: since <= todayStr };

}


/**
 * ==========================================================
 * TEST — computeNaverSearchAdCampaignStatsFetchWindow_()
 * ==========================================================
 */
function testComputeNaverSearchAdCampaignStatsFetchWindow(){

  const firstRun = computeNaverSearchAdCampaignStatsFetchWindow_(null, "2026-08-05", 90);
  const firstRunPass =
    firstRun.since === "2026-05-08" &&
    firstRun.until === "2026-08-05" &&
    firstRun.shouldFetch === true;

  const incremental = computeNaverSearchAdCampaignStatsFetchWindow_("2026-08-04", "2026-08-05", 90);
  const incrementalPass =
    incremental.since === "2026-08-05" &&
    incremental.shouldFetch === true;

  const sameDayRerun = computeNaverSearchAdCampaignStatsFetchWindow_("2026-08-05", "2026-08-05", 90);
  const sameDayRerunPass =
    sameDayRerun.since === "2026-08-06" &&
    sameDayRerun.shouldFetch === false;

  // 오래 못 돌다가 재개되는 경우(예: 자격증명 만료 몇 달) — since가 API
  // 허용 범위보다 오래됐으면 earliestAllowed로 clamp돼야 함(11004 재발 방지).
  const staleResume = computeNaverSearchAdCampaignStatsFetchWindow_("2025-01-01", "2026-08-05", 90);
  const staleResumePass =
    staleResume.since === "2026-05-08" &&
    staleResume.shouldFetch === true;

  const pass = firstRunPass && incrementalPass && sameDayRerunPass && staleResumePass;

  Logger.log(
    "firstRun=" + JSON.stringify(firstRun) +
    " incremental=" + JSON.stringify(incremental) +
    " sameDayRerun=" + JSON.stringify(sameDayRerun) +
    " staleResume=" + JSON.stringify(staleResume)
  );
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Accumulate Naver Search Ad Campaign Stats (순수 함수)
 *
 * WHY
 * 기존 누적 캐시(`existingTotals`) 위에 이번 조회 구간의 impCnt/clkCnt를
 * 캠페인 "이름"(id→name은 campaignMap으로 조인) 기준으로 더한다. 입력을
 * 변형하지 않고 새 객체를 반환.
 *
 * INPUT
 * existingTotals : Object  {campaignName: {impressions, clicks}}
 * campaignMap : Object  {nccCampaignId: name}
 * statsRows : Array<{id, impCnt, clkCnt}>
 *
 * OUTPUT
 * Object  {campaignName: {impressions, clicks}}  (새 객체)
 *
 * TEST
 * testAccumulateNaverSearchAdCampaignStats() 참고
 * ==========================================================
 */
function accumulateNaverSearchAdCampaignStats_(existingTotals, campaignMap, statsRows){

  const totals = {};

  Object.keys(existingTotals || {}).forEach(function(name){
    totals[name] = {
      impressions: (existingTotals[name] && existingTotals[name].impressions) || 0,
      clicks: (existingTotals[name] && existingTotals[name].clicks) || 0
    };
  });

  (statsRows || []).forEach(function(row){

    const name = campaignMap[row.id];

    if(!name) return;

    if(!totals[name]) totals[name] = { impressions: 0, clicks: 0 };

    totals[name].impressions += Number(row.impCnt) || 0;
    totals[name].clicks += Number(row.clkCnt) || 0;

  });

  return totals;

}


/**
 * ==========================================================
 * TEST — accumulateNaverSearchAdCampaignStats_()
 * ==========================================================
 */
function testAccumulateNaverSearchAdCampaignStats(){

  const existingTotals = {
    "2025-07-KOR-Naver SA Brand": { impressions: 100, clicks: 10 }
  };

  const campaignMap = {
    "cmp-001": "2025-07-KOR-Naver SA Brand",
    "cmp-002": "2025-07-KOR-Naver SA ECL"
  };

  const statsRows = [
    { id: "cmp-001", impCnt: 50, clkCnt: 5 },
    { id: "cmp-002", impCnt: 20, clkCnt: 2 },
    { id: "cmp-999", impCnt: 999, clkCnt: 999 } // campaignMap에 없음 — 무시돼야 함
  ];

  const result = accumulateNaverSearchAdCampaignStats_(existingTotals, campaignMap, statsRows);

  const pass =
    result["2025-07-KOR-Naver SA Brand"].impressions === 150 &&
    result["2025-07-KOR-Naver SA Brand"].clicks === 15 &&
    result["2025-07-KOR-Naver SA ECL"].impressions === 20 &&
    result["2025-07-KOR-Naver SA ECL"].clicks === 2 &&
    Object.keys(result).length === 2 &&
    existingTotals["2025-07-KOR-Naver SA Brand"].impressions === 100; // 입력 불변 확인

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Fetch NaverSA Impressions/Clicks Stats (IO 래퍼)
 *
 * WHY
 * `fetchNaverSearchAdStats_()`(salesAmt 전용, Ad_Spend_Cache 파이프라인
 * 소유)는 건드리지 않고 별도 함수로 분리 — 캠페인 통계 캐시가 요청하는
 * 필드(impCnt/clkCnt)가 다르고, 실패 시 처리 방식(호출부가 730일 제약과
 * 무관하도록 설계돼 있어 굳이 11004 특수 처리 불필요)도 다름.
 * ==========================================================
 */
function fetchNaverSearchAdImpressionsClicksStats_(ids, since, until){

  if(!ids || ids.length === 0) return [];

  const result = callNaverSearchAdApiWithRetry_("GET", "/stats", {
    ids: ids,
    fields: JSON.stringify(["impCnt", "clkCnt"]),
    timeRange: JSON.stringify({ since: since, until: until })
  });

  return (result.body && Array.isArray(result.body.data)) ? result.body.data : [];

}


/**
 * ==========================================================
 * Campaign Stats Cache Sheet IO (읽기/쓰기)
 *
 * WHY
 * Ad_Spend_Cache/Search_Engine과 동일 패턴(메인 스프레드시트 안 숨김
 * 시트) — Naver API 자격증명 없이도(Simple Trigger 등) 캐시된 값만
 * 읽을 수 있게 분리.
 * ==========================================================
 */
const NAVER_CAMPAIGN_STATS_CACHE_HEADERS = ["Campaign Name", "Impressions", "Link Clicks"];

function readNaverSearchAdCampaignStatsCache_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(AD.NAVER_SEARCH_CAMPAIGN_STATS.CACHE_SHEET);

  const map = {};

  if(!sheet) return map;

  const values = sheet.getDataRange().getValues();

  for(let i = 1; i < values.length; i++){

    const name = String(values[i][0] || "").trim();

    if(!name) continue;

    map[name] = {
      impressions: Number(values[i][1]) || 0,
      clicks: Number(values[i][2]) || 0
    };

  }

  return map;

}


function writeNaverSearchAdCampaignStatsCache_(totals){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(AD.NAVER_SEARCH_CAMPAIGN_STATS.CACHE_SHEET);

  if(!sheet){
    sheet = ss.insertSheet(AD.NAVER_SEARCH_CAMPAIGN_STATS.CACHE_SHEET);
  }

  sheet.clearContents();

  sheet.getRange(1, 1, 1, NAVER_CAMPAIGN_STATS_CACHE_HEADERS.length)
    .setValues([NAVER_CAMPAIGN_STATS_CACHE_HEADERS]);

  const names = Object.keys(totals);

  if(names.length > 0){

    const rows = names.map(function(name){
      return [name, totals[name].impressions, totals[name].clicks];
    });

    sheet.getRange(2, 1, rows.length, NAVER_CAMPAIGN_STATS_CACHE_HEADERS.length)
      .setValues(rows);

  }

  sheet.hideSheet();

  SpreadsheetApp.flush();

}


/**
 * ==========================================================
 * Refresh Naver Search Ad Campaign Stats Cache (IO 오케스트레이션)
 *
 * WHY
 * Search_OPS의 Campaign/Impressions/Link clicks를 자동으로 채우기 위한
 * 진입점(사용자 요청, 2026-08-05) — `08_PipelineAsync.js`의
 * `refreshNaverSearchCampaignStats_()`가 매 Leads/MTA 백그라운드 실행마다
 * 호출, `72_Search_Build.js`의 `buildSearchOPS()`가 이 함수가 채워둔
 * 캐시(`readNaverSearchAdCampaignStatsCache_()`)를 읽어 매칭.
 * ==========================================================
 */
function refreshNaverSearchAdCampaignStatsCache_(){

  const props = PropertiesService.getScriptProperties();
  const propertyKey = AD.NAVER_SEARCH_CAMPAIGN_STATS.LAST_FETCHED_THROUGH_PROPERTY_KEY;

  const lastThrough = props.getProperty(propertyKey);
  const today = todayDateString_();

  const window = computeNaverSearchAdCampaignStatsFetchWindow_(
    lastThrough, today, AD.NAVER_SEARCH_CAMPAIGN_STATS.MAX_QUERY_RANGE_DAYS
  );

  if(!window.shouldFetch){
    Logger.log(
      "refreshNaverSearchAdCampaignStatsCache_: 오늘(" + today + ") 이미 갱신됨 — 스킵."
    );
    return;
  }

  const campaignMap = fetchNaverSearchAdCampaignMap_();
  const ids = Object.keys(campaignMap);
  const statsRows = fetchNaverSearchAdImpressionsClicksStats_(ids, window.since, window.until);

  const existingTotals = readNaverSearchAdCampaignStatsCache_();
  const newTotals = accumulateNaverSearchAdCampaignStats_(existingTotals, campaignMap, statsRows);

  writeNaverSearchAdCampaignStatsCache_(newTotals);

  props.setProperty(propertyKey, window.until);

  Logger.log(
    "refreshNaverSearchAdCampaignStatsCache_: " + window.since + " ~ " + window.until +
    " 반영 완료 (" + Object.keys(newTotals).length + "개 캠페인 누적)."
  );

}


/**
 * ==========================================================
 * Manual-run public wrapper (Apps Script 편집기 Run 드롭다운 노출용)
 * ==========================================================
 */
function runRefreshNaverSearchAdCampaignStatsCache(){

  refreshNaverSearchAdCampaignStatsCache_();

}


/**
 * ==========================================================
 * TEMP — Naver Campaign Stats Cache 시트 강제 공개(진단용, 수동 실행)
 *
 * WHY
 * `writeNaverSearchAdCampaignStatsCache_()`가 매번 `hideSheet()`를 호출해
 * 숨기므로, Google Sheets UI의 "모든 시트" 목록에서 못 찾겠다는 경우를
 * 대비해 코드로 직접 존재 여부 확인 + 강제로 보이게 하는 진단 함수.
 * ==========================================================
 */
function runShowNaverSearchAdCampaignStatsCache(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = AD.NAVER_SEARCH_CAMPAIGN_STATS.CACHE_SHEET;
  const sheet = ss.getSheetByName(sheetName);

  if(!sheet){
    Logger.log(
      "\"" + sheetName + "\" 시트를 이 스프레드시트(" + ss.getName() +
      ")에서 찾을 수 없습니다 — runRefreshNaverSearchAdCampaignStatsCache()가 " +
      "정상 완료됐는지 먼저 확인하세요."
    );
    return;
  }

  sheet.showSheet();
  ss.setActiveSheet(sheet);

  Logger.log(
    "\"" + sheetName + "\" 시트를 찾아서 공개했습니다 — 행 수: " + sheet.getLastRow()
  );

}
