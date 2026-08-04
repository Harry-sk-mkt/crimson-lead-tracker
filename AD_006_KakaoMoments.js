/**
 * ==========================================================
 * Marketing 2.0
 * Ad Spend — Kakao Moments Business Auth (OAuth 2.0) + 메시지광고 API 연동
 *
 * Responsibility
 * 카카오모먼트 API(메시지광고 보고서)로 카카오톡 채널 메시지 광고 성과를
 * 가져오기 위한 비즈니스 인증(OAuth 2.0) 플로우 — 인가 코드 수신용 GAS
 * 웹앱(doGet(e)) + 비즈니스 토큰 교환/저장 + 진단 함수. 보고서 API 자체
 * (실제 성과 데이터 조회/KakaoSMS_Raw 적재)는 토큰 확보 후 이 파일에 이어서
 * 구현 예정(exec-plan Progress 참고).
 *
 * 설계 배경
 * docs/exec-plans/active/2026-08-04-kakao-moments-api-integration.md 참고.
 * 일반 카카오 로그인과 다른 별도 인증 체계(비즈니스 인증) — 어드민 키
 * 무관, 반드시 비즈니스 토큰(Business Token) 필요.
 *
 * **Refresh Token 없음(공식 문서로 확인, 추측 아님, 2026-08-04)**: 비즈니스
 * 토큰 발급 응답엔 access_token/token_type/scope만 있고 refresh_token/
 * expires_in이 없음 — 매번 인가 코드로 새로 발급, "장기 미사용 시 자동
 * 만료"(정확한 기간 미명시). 시간 기반 자동 갱신 트리거는 애초에 불가능 —
 * 실제 사용(캠페인 지출 자동 파이프라인의 주기적 호출, 08_PipelineAsync.js
 * refreshCampaignSpend_())이 유일한 "갱신" 수단이고, 만료/철회되면 사용자가
 * runGetKakaoMomentsAuthorizationUrl()로 다시 동의 화면을 통과해야 함(코드가
 * 대신할 수 없음).
 *
 * **배포 필요(사용자 작업)**: 이 파일의 doGet(e)이 동작하려면 Apps Script
 * 편집기에서 "배포 > 새 배포 > 웹 앱"으로 배포해야 함(Execute as: Me,
 * Who has access: Anyone) — 배포 후 URL을 카카오디벨로퍼스 앱 관리 페이지
 * [앱] > [플랫폼 키] > [REST API 키] 카드의 Redirect URI로 등록. 이후 URL이
 * 바뀌지 않도록 "새 배포"가 아니라 기존 배포를 "관리 > 편집"으로 갱신할 것
 * (매번 새 배포를 만들면 URL이 바뀌어 Redirect URI 재등록이 필요해짐).
 *
 * Must NOT
 * - 자격증명(REST API 키/Client Secret/Access Token)을 코드/Config에
 *   하드코딩 (Script Properties만 사용)
 * - doGet(e) 응답에 Client Secret/Access Token 값을 그대로 노출(에러 메시지
 *   등 어떤 형태로도) — 이 엔드포인트는 인증 없이 공개 접근 가능
 * - state 검증 없이 토큰 교환 진행 (CSRF 방지)
 *
 * Stage
 * AD (2026-07-30 네이밍 컨벤션)
 *
 * Version
 * v1.2.0
 *
 * Change Log
 * v1.2.0 (2026-08-04)
 * - **버그 수정 — 인가 요청이 KOE233("지원하지 않는 파라미터로 비즈니스 인가 코드를 요청한
 *   경우")로 실패**. 공식 문서 확인 결과 scope에 `moment_create`가 포함되면 `resource_ids`
 *   파라미터가 조건부 필수(광고계정 생성 권한은 "전체 광고계정만 요청 가능"이라 특정 ID가
 *   아니라 `moment:*` 와일드카드로 보내야 함). `buildKakaoMomentsAuthorizeUrl_()`에
 *   `resourceIds` 파라미터 추가(scope와 달리 콤마로 합치지 않고 `resource_ids=` 반복),
 *   `runGetKakaoMomentsAuthorizationUrl()`이 `AD.KAKAO_MOMENTS.OAUTH.RESOURCE_IDS`
 *   (`AD_001_Config.js` v1.13.0, `["moment:*"]`)를 넘기도록 수정.
 * v1.1.0 (2026-08-04)
 * - **버그 수정 — Redirect URI 불일치로 OAuth 콜백 실패**. `getKakaoMomentsRedirectUri_()`가
 *   `ScriptApp.getService().getUrl()` 대신 `AD.KAKAO_MOMENTS.OAUTH.REDIRECT_URI`(하드코딩된
 *   실제 배포 `/exec` URL)를 쓰도록 변경 — 편집기에서 직접 Run할 때 그 함수가 `/dev` URL을
 *   반환해 카카오 등록값과 안 맞았던 게 원인(실측 확인, 상세는 함수 WHY 참고).
 * v1.0.0 (2026-08-04)
 * - 최초 구현. OAuth 인가 URL 생성(runGetKakaoMomentsAuthorizationUrl())/
 *   콜백 수신·토큰 교환(doGet(), exchangeKakaoMomentsAuthorizationCode_())/
 *   토큰 진단(runDebugKakaoMomentsTokenInfo()). 리포트 API 연동은 다음 단계
 *   (별도 Change Log 라운드).
 * ==========================================================
 */


/**
 * ==========================================================
 * Get Kakao Moments OAuth Credentials (IO 래퍼)
 *
 * WHY
 * REST API 키/Client Secret은 Script Properties에서만 읽는다(Naver Search와
 * 동일 관행, git/코드에 하드코딩 금지).
 * ==========================================================
 */
function getKakaoMomentsOAuthCredentials_(){

  const props = PropertiesService.getScriptProperties();
  const keys = AD.KAKAO_MOMENTS.OAUTH.PROPERTY_KEYS;

  const restApiKey = props.getProperty(keys.REST_API_KEY);
  const clientSecret = props.getProperty(keys.CLIENT_SECRET);

  if(!restApiKey || !clientSecret){
    throw new Error(
      "카카오모먼트 OAuth 자격증명이 없습니다. Apps Script 편집기 " +
      "Project Settings > Script Properties에 다음 키를 추가하세요: " +
      keys.REST_API_KEY + ", " + keys.CLIENT_SECRET
    );
  }

  return { restApiKey: restApiKey, clientSecret: clientSecret };

}


/**
 * ==========================================================
 * Get Kakao Moments Redirect URI (IO 래퍼)
 *
 * WHY (2026-08-04, 실측 후 정정)
 * 원래 ScriptApp.getService().getUrl()로 배포 URL을 동적으로 가져오려 했으나,
 * Apps Script 편집기에서 직접 Run(runGetKakaoMomentsAuthorizationUrl())할 때
 * 이 함수가 실제 배포된 `/exec` URL이 아니라 카카오에 등록 안 된 `/dev` URL을
 * 돌려주는 게 실측으로 확인됨(doGet() 실행 컨텍스트 안에서만 정확함) —
 * "Script function not found: doGet" 에러로 이어짐(docs/apps-script-gotchas.md
 * #10 참고). 그래서 `AD.KAKAO_MOMENTS.OAUTH.REDIRECT_URI`(하드코딩된 실제
 * 배포 URL)를 그대로 쓴다 — 재배포로 URL이 바뀌면 그 값도 같이 갱신해야 함.
 * ==========================================================
 */
function getKakaoMomentsRedirectUri_(){

  const url = AD.KAKAO_MOMENTS.OAUTH.REDIRECT_URI;

  if(!url){
    throw new Error(
      "AD.KAKAO_MOMENTS.OAUTH.REDIRECT_URI가 비어있습니다 — 웹 앱 배포 후 " +
      "그 URL을 AD_001_Config.js에 채워넣으세요."
    );
  }

  return url;

}


/**
 * ==========================================================
 * Build Kakao Moments Authorize URL (순수 함수)
 *
 * WHY
 * 인가 코드 요청 URL(GET, 브라우저에서 직접 열어 동의 화면을 띄우는 용도)을
 * 조립한다. scope는 공식 문서 확인 결과 콤마(,) 구분 문자열(다른 카카오
 * API처럼 공백 구분 아님). resource_ids는 scope에 moment_create가 있으면
 * 조건부 필수(2026-08-04, KOE233 실측 후 확인) — scope처럼 콤마로 합치지
 * 않고 "resource_ids=..." 파라미터를 값마다 반복해서 붙인다(공식 문서 예시
 * 형식 그대로, docs/exec-plans/active/2026-08-04-kakao-moments-api-integration.md
 * 참고).
 *
 * INPUT
 * baseUrl : string  AD.KAKAO_MOMENTS.OAUTH.AUTHORIZE_URL
 * clientId : string  REST API 키
 * redirectUri : string
 * scopes : Array<string>
 * state : string  CSRF 방지용 임의값
 * resourceIds : Array<string>  "ScopeGroup:ResourceId" 형식(예: "moment:*")
 *
 * OUTPUT
 * string  전체 URL(쿼리스트링 포함)
 *
 * TEST
 * testBuildKakaoMomentsAuthorizeUrl() 참고
 * ==========================================================
 */
function buildKakaoMomentsAuthorizeUrl_(baseUrl, clientId, redirectUri, scopes, state, resourceIds){

  const params = [
    "client_id=" + encodeURIComponent(clientId),
    "response_type=code",
    "redirect_uri=" + encodeURIComponent(redirectUri),
    "scope=" + encodeURIComponent(scopes.join(",")),
    "state=" + encodeURIComponent(state)
  ];

  (resourceIds || []).forEach(function(id){
    params.push("resource_ids=" + encodeURIComponent(id));
  });

  return baseUrl + "?" + params.join("&");

}


/**
 * ==========================================================
 * TEST — buildKakaoMomentsAuthorizeUrl_()
 * ==========================================================
 */
function testBuildKakaoMomentsAuthorizeUrl(){

  const url = buildKakaoMomentsAuthorizeUrl_(
    "https://kauth.kakao.com/oauth/business/authorize",
    "abc123",
    "https://script.google.com/macros/s/xyz/exec",
    ["moment_create", "moment_management"],
    "state-value-1",
    ["moment:*"]
  );

  const pass =
    url.indexOf("https://kauth.kakao.com/oauth/business/authorize?") === 0 &&
    url.indexOf("client_id=abc123") !== -1 &&
    url.indexOf("response_type=code") !== -1 &&
    url.indexOf("redirect_uri=" + encodeURIComponent("https://script.google.com/macros/s/xyz/exec")) !== -1 &&
    url.indexOf("scope=" + encodeURIComponent("moment_create,moment_management")) !== -1 &&
    url.indexOf("state=state-value-1") !== -1 &&
    url.indexOf("resource_ids=" + encodeURIComponent("moment:*")) !== -1;

  Logger.log("URL: " + url);
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * TEMP — 인가 URL 생성 및 안내(수동 실행 진입점)
 *
 * WHY
 * 브라우저에서 직접 열어 카카오 동의 화면을 띄워야 하는 URL이라, 함수
 * 실행만으로는 자동화 불가 — state를 생성해 Script Properties에 임시
 * 저장해두고(콜백에서 대조 후 삭제), 로그에 URL을 남겨 사용자가 복사해서
 * 브라우저 주소창에 붙여넣도록 안내한다.
 * ==========================================================
 */
function runGetKakaoMomentsAuthorizationUrl(){

  const creds = getKakaoMomentsOAuthCredentials_();
  const redirectUri = getKakaoMomentsRedirectUri_();
  const state = Utilities.getUuid();

  PropertiesService.getScriptProperties()
    .setProperty(AD.KAKAO_MOMENTS.OAUTH.PROPERTY_KEYS.OAUTH_STATE, state);

  const url = buildKakaoMomentsAuthorizeUrl_(
    AD.KAKAO_MOMENTS.OAUTH.AUTHORIZE_URL,
    creds.restApiKey,
    redirectUri,
    AD.KAKAO_MOMENTS.OAUTH.SCOPES,
    state,
    AD.KAKAO_MOMENTS.OAUTH.RESOURCE_IDS
  );

  Logger.log("아래 URL을 브라우저 주소창에 붙여넣어 카카오 동의 화면을 여세요:");
  Logger.log(url);
  Logger.log("Redirect URI(카카오디벨로퍼스에 등록된 값과 일치해야 함): " + redirectUri);

}


/**
 * ==========================================================
 * Exchange Kakao Moments Authorization Code (IO 래퍼)
 *
 * WHY
 * 인가 코드를 비즈니스 토큰으로 교환한다(공식 문서 확인 완료 — POST,
 * client_secret 포함). 상태 코드를 그대로 반환해 호출부(doGet())가 성공/
 * 실패를 판단(Naver Search의 callNaverSearchAdApi_()와 동일 패턴).
 * ==========================================================
 */
function exchangeKakaoMomentsAuthorizationCode_(code, redirectUri){

  const creds = getKakaoMomentsOAuthCredentials_();

  const payload = {
    grant_type: "authorization_code",
    client_id: creds.restApiKey,
    client_secret: creds.clientSecret,
    redirect_uri: redirectUri,
    code: code
  };

  const response = UrlFetchApp.fetch(AD.KAKAO_MOMENTS.OAUTH.TOKEN_URL, {
    method: "post",
    payload: payload,
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
 * Render Kakao Moments OAuth Message (IO 래퍼 — doGet() 응답 공용 헬퍼)
 * ==========================================================
 */
function renderKakaoMomentsOAuthMessage_(message){

  return HtmlService.createHtmlOutput("<pre>" + message + "</pre>");

}


/**
 * ==========================================================
 * doGet (GAS 웹 앱 진입점 — 카카오 비즈니스 인증 리다이렉트 수신)
 *
 * WHY
 * 카카오디벨로퍼스가 사용자 동의 후 이 URL로 인가 코드를 전달한다(query
 * parameter "code"). state를 대조해 CSRF를 방지하고, 코드를 비즈니스
 * 토큰으로 교환해 Script Properties에 저장한다. 이 엔드포인트는 인증 없이
 * 공개 접근 가능하므로(OAuth 리다이렉트 특성상 불가피) 응답에 Client
 * Secret/Access Token 값을 절대 노출하지 않는다.
 * ==========================================================
 */
function doGet(e){

  const params = (e && e.parameter) || {};

  if(params.error){
    return renderKakaoMomentsOAuthMessage_(
      "카카오 동의가 취소되거나 실패했습니다: " + params.error +
      (params.error_description ? " (" + params.error_description + ")" : "")
    );
  }

  if(!params.code){
    return renderKakaoMomentsOAuthMessage_(
      "카카오모먼트 OAuth 콜백 엔드포인트입니다. 인가 코드 없이 직접 " +
      "접근된 것으로 보입니다 — runGetKakaoMomentsAuthorizationUrl()로 " +
      "생성한 URL을 통해서만 접근하세요."
    );
  }

  const props = PropertiesService.getScriptProperties();
  const stateKey = AD.KAKAO_MOMENTS.OAUTH.PROPERTY_KEYS.OAUTH_STATE;
  const expectedState = props.getProperty(stateKey);

  if(!expectedState || params.state !== expectedState){
    return renderKakaoMomentsOAuthMessage_(
      "state 값이 일치하지 않습니다(만료된 링크이거나 잘못된 접근일 수 " +
      "있음) — runGetKakaoMomentsAuthorizationUrl()을 다시 실행해 새 URL로 " +
      "시도하세요."
    );
  }

  props.deleteProperty(stateKey);  // 1회용 — 재사용 방지

  let result;

  try {
    result = exchangeKakaoMomentsAuthorizationCode_(params.code, getKakaoMomentsRedirectUri_());
  } catch(err){
    return renderKakaoMomentsOAuthMessage_(
      "토큰 교환 중 오류: " + (err && err.message ? err.message : err)
    );
  }

  if(result.statusCode !== 200 || !result.body || !result.body.access_token){
    return renderKakaoMomentsOAuthMessage_(
      "토큰 발급 실패(statusCode=" + result.statusCode + "): " +
      JSON.stringify(result.body)
    );
  }

  props.setProperty(AD.KAKAO_MOMENTS.OAUTH.PROPERTY_KEYS.ACCESS_TOKEN, result.body.access_token);

  return renderKakaoMomentsOAuthMessage_(
    "카카오모먼트 비즈니스 토큰 발급 완료 — 이 창은 닫으셔도 됩니다. " +
    "(scope: " + (result.body.scope || "") + ")"
  );

}


/**
 * ==========================================================
 * TEMP — 저장된 비즈니스 토큰 진단(수동 실행)
 *
 * WHY
 * OAuth 플로우 완료 후 토큰이 실제로 유효한지 확인 — Naver Search 때
 * runDebugNaverSearchAdCampaigns()와 동일한 목적(추측 없이 실 응답으로 검증).
 * ==========================================================
 */
function runDebugKakaoMomentsTokenInfo(){

  const props = PropertiesService.getScriptProperties();
  const accessToken = props.getProperty(AD.KAKAO_MOMENTS.OAUTH.PROPERTY_KEYS.ACCESS_TOKEN);

  if(!accessToken){
    Logger.log(
      "저장된 Access Token이 없습니다 — runGetKakaoMomentsAuthorizationUrl()로 " +
      "OAuth 플로우를 먼저 완료하세요."
    );
    return;
  }

  const response = UrlFetchApp.fetch(AD.KAKAO_MOMENTS.OAUTH.TOKEN_INFO_URL, {
    method: "get",
    headers: { "Authorization": "Bearer " + accessToken },
    muteHttpExceptions: true
  });

  Logger.log("statusCode: " + response.getResponseCode());
  Logger.log("body: " + response.getContentText());

}
