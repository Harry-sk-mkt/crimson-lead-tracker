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
 * v2.2.0
 *
 * Change Log
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

  const result = callNaverSearchAdApi_("GET", "/ncc/campaigns", {});
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

  const result = callNaverSearchAdApi_("GET", "/stats", {
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
    const statsRows = fetchNaverSearchAdStats_(ids, range.since, range.until);
    const referenceDate = new Date(m.year, m.month - 1, 1);
    const monthTotals = computeNaverSearchAdSpendByFYMonthSegment_(campaignMap, statsRows, referenceDate);

    Object.keys(monthTotals).forEach(function(key){
      totals[key] = (totals[key] || 0) + monthTotals[key];
    });

  });

  return totals;

}
