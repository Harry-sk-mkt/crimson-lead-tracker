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
 * v1.19.0
 *
 * Change Log
 * v1.19.0 (2026-08-06)
 * - **`readKakaoSMSRawProgramCostRows_()` 신규** — Events_OPS Spent 자동
 *   집계(51_Events_Engine.js `computeEventsKakaoSpendAggregates_()`)가
 *   쓰는 IO 리더. `Marketo program`(수동 입력)+`Cost`만 추출, Marketo
 *   program이 빈 행은 제외.
 * v1.18.0 (2026-08-06)
 * - **버그 수정 — `Marketo program`을 다시 수동 입력 컬럼으로 되돌림, upsert가
 *   수동 입력 컬럼을 덮어쓰던 문제 수정(둘 다 사용자 확인)**. 조사 결과 카카오
 *   메시지 이름(UTM 스타일)과 Events_OPS 매칭용 실제 Marketo Program명(WB-/EV-
 *   형식, Lead Source Detail에 찍힘)은 서로 다른 네이밍 체계라 자동 매칭 불가
 *   — `computeKakaoMomentsSyncRow_()`의 Marketo program을 다시 빈 문자열로
 *   되돌림(v1.13.0에서 메시지명 자동 채움으로 바꿨던 걸 원복, 원래도 이 컬럼은
 *   수동 입력용이었음). 이 되돌림 과정에서 **발견한 별도 버그**: upsert
 *   (`mergeKakaoMomentsSyncRows_()`)가 기존 행을 새로 계산된 행으로 통째로
 *   교체하는 구조라, PIC/Push/비고/Marketo program처럼 사람이 입력한 값이
 *   재동기화(예: 전환 지표가 나중에 채워져 재실행) 때 전부 날아가는 문제 확인
 *   — `preserveColIndexes` 매개변수 신규 추가, 매칭된 기존 행에서 이 4개
 *   컬럼만 새 행에 이식해 보존. 테스트 추가.
 * v1.17.0 (2026-08-06)
 * - **리포팅 지연 폴백 추가(사용자 요청)** — `computeKakaoMomentsSyncRow_()`가
 *   message-ads/reports(전환 지표 포함) 응답이 아직 없는 신규 발송 메시지에
 *   대해, message-ads/list 응답에 이미 임베디드된 messageAd.metrics(cost/
 *   msg_send/msg_click/msg_open)로 Sent/Reach/Click/Cost를 즉시 채움 —
 *   Responsed/CPL은 리포트 전용 지표라 폴백 소스가 없어 계속 빈 값(다음
 *   sync 재실행 시 리포트가 채워지면 자동 반영). 테스트 추가.
 * v1.16.0 (2026-08-06)
 * - **버그 수정 — Keyword에 메시지 본문 줄바꿈이 그대로 들어가 셀이 여러 줄로
 *   보임(사용자 발견)**. `computeKakaoMomentsSyncRow_()`가 mainTitle의 줄바꿈을
 *   30자 자르기 전에 공백으로 치환하도록 수정. 테스트 케이스 추가(본문 중간
 *   줄바꿈).
 * v1.15.0 (2026-08-06)
 * - **`Keyword` 컬럼에 메시지 본문 앞 30자 채움(사용자 요청)** —
 *   `computeKakaoMomentsSyncRow_()`가 `messageAd.message.mainTitle`(발송
 *   목록 API 응답에 이미 포함된 필드)을 `.slice(0,30)`으로 잘라서 씀. 테스트
 *   갱신(실제 메시지 본문으로 30자 슬라이스 검증).
 * v1.14.0 (2026-08-06)
 * - **`applyKakaoSMSRawStyling_()`에 정렬 추가(사용자 요청)** — SentAt(E열)
 *   기준 내림차순(최신이 맨 위). `sortSheetByDate()`(06_SheetSorter.js)는
 *   `CONFIG.SPREADSHEET`(메인 스프레드시트) 전용이라 재사용 불가(KakaoSMS_Raw는
 *   AD.SPREADSHEET_ID, 별도 스프레드시트) — 직접 구현. CTR/CvR 수식이 행 번호를
 *   문자열로 참조하므로 정렬을 수식 생성보다 먼저 수행하도록 순서 조정.
 * v1.13.0 (2026-08-06)
 * - **스타일링 함수 추가 — `applyKakaoSMSRawStyling_()`(사용자 요청)**. I:M열
 *   (Sent/Reach/Click/Responsed/Cost)/P열(CPL) 천단위 콤마+정수 표시, N열(CTR)=
 *   Click/Reach·O열(CvR)=Responsed/Click을 값 대신 수식으로 채움("0.0%" 표시,
 *   0 나누기 방지), 전체 데이터 범위 테두리 재적용. `syncKakaoMomentsReportTo
 *   KakaoSMS_Raw_()` 끝에서 호출, 매번 전체 범위에 멱등 재적용(수기 소스 행도
 *   함께 정리됨). `computeKakaoMomentsSyncRow_()`도 함께 수정: FY를 "FY27"
 *   문자열 대신 숫자 27로 저장(기존 수기 행의 숫자 형식과 통일, 사용자 발견),
 *   `Marketo program`에 메시지광고 이름 그대로 저장(기존 수기 데이터 선례
 *   확인 — 사용자 요청, 향후 Events_OPS Cost 연동 전제 마련 목적이나 자동
 *   반영은 아직 아님, exec-plan 참고). 테스트 갱신.
 * v1.12.0 (2026-08-06)
 * - **버그 수정 — `runRepairKakaoSMSRawColumnAlignment_()` 판별 사각지대**.
 *   `runFindKakaoSMSRawFYColumnAnomalies()` 실측으로 시트 267행(FY가 원래
 *   공란이던 행)이 "A열 숫자" 판별을 통과 못 해 복구에서 누락된 걸 확인 —
 *   판별 조건에 "B열(FY 자리)이 알려진 Event type 문자열" 케이스도 OR로
 *   추가. 이미 정렬된 행은 영향 없음(재실행해도 안전).
 * v1.11.0 (2026-08-06)
 * - **진단 함수 추가 — `runFindKakaoSMSRawFYColumnAnomalies()`**. Event type(C열)
 *   스캔의 사각지대(PIC가 공란이면 미정렬 행도 통과해버림) 발견 — B열(FY 자리)에
 *   실제 Event type 문자열이 들어있는지 직접 검사하는 더 확실한 신호로 재검증.
 * v1.10.0 (2026-08-06)
 * - **진단 함수 추가 — `runFindKakaoSMSRawEventTypeAnomalies()`**. A열 숫자 기준
 *   스캔(`runFindUnrepairedKakaoSMSRawRows()`)이 0건이었지만 293행 중 290행만
 *   이동됐다는 로그와 1행 차이가 여전히 안 풀려서, Event type(C열) 값이 알려진
 *   세그먼트가 아닌 행을 찾는 더 정밀한 검증 추가.
 * v1.9.0 (2026-08-06)
 * - **진단 함수 추가 — `runFindUnrepairedKakaoSMSRawRows()`**. 복구 실행 결과 293행 중
 *   290행만 옮겨져(291행 예상과 1행 차이) 어느 행이 남았는지 실제 값으로 찾기 위함.
 * v1.8.0 (2026-08-06)
 * - **복구 함수 추가 — `runRepairKakaoSMSRawColumnAlignment()`(1회성, 수동 실행)**.
 *   `runDebugKakaoSMSRawColumnAlignment()` 실측으로 컬럼 밀림 확인(옛 291행은 17컬럼
 *   레이아웃 그대로, 신규 2행만 18컬럼 레이아웃) — A열이 숫자(FY)인 행만 옛 레이아웃으로
 *   판별해 앞에 빈 칸을 끼워 밀고, 헤더를 새 스키마로 갱신, Message Ad ID 컬럼 숨김.
 *   이미 신규 레이아웃인 행은 그대로 둬 재실행해도 안전.
 * v1.7.0 (2026-08-06)
 * - **진단 함수 추가 — `runDebugKakaoSMSRawColumnAlignment()`**. `Message Ad ID`
 *   컬럼 추가(v1.6.0/AD_001_Config.js v1.17.0) 후 기존 291행짜리 KakaoSMS_Raw
 *   시트에 `runSyncKakaoChannelPerformanceToAD()`로 신규 2행이 추가되면서
 *   컬럼 밀림 가능성 발견 — 실제 헤더/첫 행/마지막 행 값을 찍어서 확인
 *   (추측 금지, 수정 전 필수 확인).
 * v1.6.1 (2026-08-06)
 * - **테스트 버그 수정** — `testComputeKakaoMomentsSyncRow()`가 FY 기대값을 "FY26"으로
 *   잘못 적어 FAIL(사용자 실행으로 발견). `getFiscalYear()` 규칙(8월부터 다음 FY 시작)상
 *   2026-08-05는 실제로 FY27 — 프로덕션 로직(`computeKakaoMomentsSyncRow_()`)은 처음부터
 *   정확했고 테스트 기대값만 수정.
 * v1.6.0 (2026-08-06)
 * - **실제 sync 구현 — `syncKakaoMomentsReportToKakaoSMSRaw_()`/`runSyncKakaoMomentsReportToKakaoSMSRaw()`
 *   신규**. 진단 함수 체인(광고계정→채널 프로필→메시지광고 목록→리포트)을
 *   `fetchKakaoMomentsAdAccountAndChannelProfile_()`(공용, 실패 시 에러 throw)로
 *   재정리 후 실제 파이프라인에 연결. 발송 전/메트릭 없는 메시지(metrics: null)는
 *   제외. `computeKakaoMomentsSyncRow_()`(순수 함수, 확정된 필드 매핑 — Sent=
 *   msg_send/Reach=msg_open/Click=msg_click/Cost=cost/Responsed=conv_signup_7d/
 *   CPL=cost_per_conv_signup_7d, Event type=getBusinessSegment(name,name))로
 *   KakaoSMS_Raw 행을 계산, `mergeKakaoMomentsSyncRows_()`(순수 함수)로
 *   messageAdId 기준 upsert(발송 후에도 지표가 최대 7일까지 계속 늘어나므로
 *   append-only 대신 upsert로 확정, 사용자 확인). `parseKakaoMomentsSendingDate_()`
 *   신규(sendingReservation.date 문자열 → SentAt Date/Time 문자열 분리). 테스트
 *   4개 추가(TDD). `AD_001_Config.js`(v1.17.0)에 `SYNC_COLUMNS` 맨 앞
 *   "Message Ad ID"(숨김) 컬럼 신규 — upsert 매칭 키(사용자 확인 후 기존 시트
 *   구조 변경 승인). 상세: docs/exec-plans/active/2026-08-04-kakao-moments-api-integration.md
 * v1.5.0 (2026-08-06)
 * - **`runDebugKakaoMomentsReportFirstRow()` metricsGroup에 `PIXEL_SDK_CONVERSION` 추가**.
 *   2026-08-05 실제 발송 메시지 응답 실측 결과(사용자 확인) Sent=msg_send/Reach=msg_open/
 *   Click=msg_click/Cost=cost로 확정됐으나, `Responsed`(CPL=Cost/Responsed의 분모)에
 *   대응하는 필드가 MESSAGE/MESSAGE_ADDITION 그룹엔 없음 — 카카오 대시보드의 "서비스신청
 *   (7일)" 전환 지표가 `PIXEL_SDK_CONVERSION`(`conv_signup_7d`/`cost_per_conv_signup_7d`)에
 *   있음을 공식 문서로 확인, 재검증을 위해 metricsGroup에 추가. 상세: exec-plan
 *   `docs/exec-plans/active/2026-08-04-kakao-moments-api-integration.md`.
 * v1.4.0 (2026-08-05)
 * - **메시지광고 리포트 진단 함수 추가**. `runDebugKakaoMomentsReportFirstRow()` 신규 —
 *   광고계정 목록 → 채널 프로필 목록 → 메시지광고 목록(messageAdIds 추출)을 체이닝한 뒤
 *   `POST message-ads/reports`(dimension: MESSAGE_AD, metricsGroup: [MESSAGE,
 *   MESSAGE_ADDITION], datePreset: LAST_30DAY)를 호출해 원본 응답을 그대로 로그.
 *   `Reach`/`Responsed`에 대응하는 정확한 필드명이 공식 문서 표에 없어(msg_send/msg_open/
 *   msg_click/msg_send_fail/cost만 확인됨) 실제 호출로 확정 예정 — 아직 실행 전.
 * v1.3.0 (2026-08-05)
 * - **리포트 API 진단 체인 착수**. 공용 IO 래퍼 `callKakaoMomentsApi_()` 신규
 *   (`callNaverSearchAdApi_()`와 동일한 상태코드 그대로 반환 패턴). 진단 함수 3개 추가 —
 *   `runDebugKakaoMomentsAdAccounts()`(광고계정 목록), `runDebugKakaoMomentsChannelProfiles()`
 *   (채널 프로필 목록, 광고계정 목록을 내부에서 다시 호출해 첫 계정 ID 자동 사용),
 *   `runDebugKakaoMomentsMessageAdsList()`(메시지광고 목록, 위 두 단계를 체이닝해 adAccountId/
 *   channel-profile-id 헤더 자동 구성). 아직 실제 API 응답으로 필드 검증 전 — 다음 단계는
 *   `runDebugKakaoMomentsReportFirstRow()`(메시지광고 리포트, messageAdIds 필요).
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


/**
 * ==========================================================
 * Call Kakao Moments API (IO 래퍼)
 *
 * WHY
 * 리포트 API 진단 체인(광고계정 목록 → 채널 프로필 목록 → 메시지광고 목록 →
 * 메시지광고 리포트) 전부가 "Bearer 토큰 + 선택적 추가 헤더(adAccountId 등) +
 * GET 쿼리스트링 또는 POST JSON body" 형태로 동일해서 공용 래퍼로 뺌
 * (`callNaverSearchAdApi_()`와 동일한 상태코드 그대로 반환 패턴).
 *
 * INPUT
 * method : string  "get" | "post"
 * url : string  쿼리스트링 포함 완성 URL(GET) 또는 base URL(POST)
 * extraHeaders : Object  adAccountId/channel-profile-id 등 추가 헤더(선택)
 * payload : Object|null  POST body(JSON.stringify해서 전송), GET이면 무시
 *
 * OUTPUT
 * { statusCode: number, body: Object|string }
 * ==========================================================
 */
function callKakaoMomentsApi_(method, url, extraHeaders, payload){

  const props = PropertiesService.getScriptProperties();
  const accessToken = props.getProperty(AD.KAKAO_MOMENTS.OAUTH.PROPERTY_KEYS.ACCESS_TOKEN);

  if(!accessToken){
    throw new Error(
      "저장된 Kakao Moments Access Token이 없습니다 — " +
      "runGetKakaoMomentsAuthorizationUrl()로 OAuth 플로우를 먼저 완료하세요."
    );
  }

  const headers = Object.assign(
    { "Authorization": "Bearer " + accessToken },
    extraHeaders || {}
  );

  const options = {
    method: method,
    headers: headers,
    muteHttpExceptions: true
  };

  if(method === "post"){
    options.contentType = "application/json";
    options.payload = JSON.stringify(payload || {});
  }

  const response = UrlFetchApp.fetch(url, options);
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
 * TEMP — 광고계정 목록 진단(수동 실행)
 *
 * WHY
 * 리포트 API 호출 체인의 첫 단계 — 아직 광고계정 ID를 모르므로(사용자가
 * 알려준 적 없음, 추측 금지) 계정 정보 없이 호출 가능한 이 엔드포인트로
 * 실제 ID/이름을 먼저 확인한다.
 * ==========================================================
 */
function runDebugKakaoMomentsAdAccounts(){

  const result = callKakaoMomentsApi_(
    "get", AD.KAKAO_MOMENTS.REPORT.AD_ACCOUNTS_LIST_URL, {}, null
  );

  Logger.log("statusCode: " + result.statusCode);
  Logger.log("body: " + JSON.stringify(result.body, null, 2));

}


/**
 * ==========================================================
 * TEMP — 카카오톡 채널 프로필 목록 진단(수동 실행)
 *
 * WHY
 * runDebugKakaoMomentsAdAccounts()로 확인한 광고계정 ID가 필요한 다음
 * 단계 — 직접 하드코딩해 넣지 않고, 이 함수가 광고계정 목록을 다시 호출해
 * 첫 번째 계정 ID를 자동으로 사용한다(Naver Search의
 * runDebugNaverSearchAdStats() 체이닝 패턴과 동일).
 * ==========================================================
 */
function runDebugKakaoMomentsChannelProfiles(){

  const accountsResult = callKakaoMomentsApi_(
    "get", AD.KAKAO_MOMENTS.REPORT.AD_ACCOUNTS_LIST_URL, {}, null
  );

  const accounts = accountsResult.body && accountsResult.body.content;

  if(!Array.isArray(accounts) || accounts.length === 0){
    Logger.log(
      "광고계정 목록을 못 가져옴 — statusCode: " + accountsResult.statusCode +
      ", body: " + JSON.stringify(accountsResult.body)
    );
    return;
  }

  const adAccountId = accounts[0].id;
  Logger.log("사용할 adAccountId: " + adAccountId + " (전체 계정 수: " + accounts.length + ")");

  const result = callKakaoMomentsApi_(
    "get", AD.KAKAO_MOMENTS.REPORT.CHANNEL_PROFILES_URL,
    { "adAccountId": String(adAccountId) }, null
  );

  Logger.log("statusCode: " + result.statusCode);
  Logger.log("body: " + JSON.stringify(result.body, null, 2));

}


/**
 * ==========================================================
 * TEMP — 메시지광고 목록 진단(수동 실행)
 *
 * WHY
 * 메시지광고 리포트 조회(message-ads/reports)는 messageAdIds가 필수라,
 * 실제 존재하는 메시지광고 ID를 먼저 확인해야 함. 이 API의 정확한 요청
 * body 스키마(필수/선택 필드)는 공식 문서에서 상세 확인 못 해 빈 body로
 * 우선 호출 — 필수 필드 누락 에러가 나면 그 에러 메시지로 실제 스키마를
 * 확정한다(추측 금지, 실측 우선).
 * ==========================================================
 */
function runDebugKakaoMomentsMessageAdsList(){

  const accountsResult = callKakaoMomentsApi_(
    "get", AD.KAKAO_MOMENTS.REPORT.AD_ACCOUNTS_LIST_URL, {}, null
  );

  const accounts = accountsResult.body && accountsResult.body.content;

  if(!Array.isArray(accounts) || accounts.length === 0){
    Logger.log(
      "광고계정 목록을 못 가져옴 — statusCode: " + accountsResult.statusCode +
      ", body: " + JSON.stringify(accountsResult.body)
    );
    return;
  }

  const adAccountId = accounts[0].id;

  const profilesResult = callKakaoMomentsApi_(
    "get", AD.KAKAO_MOMENTS.REPORT.CHANNEL_PROFILES_URL,
    { "adAccountId": String(adAccountId) }, null
  );

  const profiles = profilesResult.body;

  if(!Array.isArray(profiles) || profiles.length === 0){
    Logger.log(
      "채널 프로필 목록을 못 가져옴 — statusCode: " + profilesResult.statusCode +
      ", body: " + JSON.stringify(profilesResult.body)
    );
    return;
  }

  const channelProfileId = profiles[0].id;
  Logger.log("사용할 adAccountId: " + adAccountId + ", channelProfileId: " + channelProfileId);

  const result = callKakaoMomentsApi_(
    "post", AD.KAKAO_MOMENTS.REPORT.MESSAGE_ADS_LIST_URL,
    { "adAccountId": String(adAccountId), "channel-profile-id": String(channelProfileId) },
    {}
  );

  Logger.log("statusCode: " + result.statusCode);
  Logger.log("body: " + JSON.stringify(result.body, null, 2));

}


/**
 * ==========================================================
 * TEMP — 메시지광고 리포트 진단(수동 실행)
 *
 * WHY
 * KakaoSMS_Raw 컬럼(Sent/Reach/Click/Responsed/Cost) 매핑을 확정하기 전
 * 마지막 검증 단계 — 문서(type-info)의 MESSAGE 그룹 필드명(msg_send/
 * msg_open/msg_click/msg_send_fail/cost)에 Reach/Responsed에 정확히
 * 대응하는 게 안 보여서, 실제 응답을 찍어보고 확정한다(추측 금지).
 * 2026-08-06 실측(v1.4.0): Sent=msg_send/Reach=msg_open/Click=msg_click/
 * Cost=cost는 사용자 확인으로 확정됐으나, Responsed(CPL=Cost/Responsed의
 * 분모)에 대응하는 필드가 MESSAGE/MESSAGE_ADDITION 그룹엔 없음 — 카카오
 * 모먼트 대시보드의 "서비스신청 (7일)" 전환 지표가 PIXEL_SDK_CONVERSION
 * 그룹(conv_signup_7d/cost_per_conv_signup_7d)에 있다는 걸 공식 문서로
 * 확인해 metricsGroup에 추가(v1.5.0) — 이 값이 Responsed와 일치하는지
 * 실제 응답으로 재검증한다.
 * ==========================================================
 */
function runDebugKakaoMomentsReportFirstRow(){

  const accountsResult = callKakaoMomentsApi_(
    "get", AD.KAKAO_MOMENTS.REPORT.AD_ACCOUNTS_LIST_URL, {}, null
  );

  const accounts = accountsResult.body && accountsResult.body.content;

  if(!Array.isArray(accounts) || accounts.length === 0){
    Logger.log(
      "광고계정 목록을 못 가져옴 — statusCode: " + accountsResult.statusCode +
      ", body: " + JSON.stringify(accountsResult.body)
    );
    return;
  }

  const adAccountId = accounts[0].id;

  const profilesResult = callKakaoMomentsApi_(
    "get", AD.KAKAO_MOMENTS.REPORT.CHANNEL_PROFILES_URL,
    { "adAccountId": String(adAccountId) }, null
  );

  const profiles = profilesResult.body;

  if(!Array.isArray(profiles) || profiles.length === 0){
    Logger.log(
      "채널 프로필 목록을 못 가져옴 — statusCode: " + profilesResult.statusCode +
      ", body: " + JSON.stringify(profilesResult.body)
    );
    return;
  }

  const channelProfileId = profiles[0].id;

  const messageAdsResult = callKakaoMomentsApi_(
    "post", AD.KAKAO_MOMENTS.REPORT.MESSAGE_ADS_LIST_URL,
    { "adAccountId": String(adAccountId), "channel-profile-id": String(channelProfileId) },
    {}
  );

  const messageAds = messageAdsResult.body && messageAdsResult.body.content;

  if(!Array.isArray(messageAds) || messageAds.length === 0){
    Logger.log(
      "메시지광고 목록을 못 가져옴 — statusCode: " + messageAdsResult.statusCode +
      ", body: " + JSON.stringify(messageAdsResult.body)
    );
    return;
  }

  const messageAdIds = messageAds.map(function(ad){ return ad.messageAdId; });
  Logger.log("사용할 messageAdIds: " + JSON.stringify(messageAdIds));

  const result = callKakaoMomentsApi_(
    "post", AD.KAKAO_MOMENTS.REPORT.MESSAGE_ADS_REPORT_URL,
    { "adAccountId": String(adAccountId), "channel-profile-id": String(channelProfileId) },
    {
      messageAdIds: messageAdIds,
      dimension: "MESSAGE_AD",
      metricsGroup: ["MESSAGE", "MESSAGE_ADDITION", "PIXEL_SDK_CONVERSION"],
      datePreset: "LAST_30DAY"
    }
  );

  Logger.log("statusCode: " + result.statusCode);
  Logger.log("body: " + JSON.stringify(result.body, null, 2));

}


/**
 * ==========================================================
 * Parse Kakao Moments Sending Date (순수 함수)
 *
 * WHY
 * 카카오모먼트 API의 sendingReservation.date("yyyy-MM-dd HH:mm" 문자열)를
 * KakaoSMS_Raw의 기존 SentAt(Date)/Time(문자열) 분리 컬럼 구조에 맞춰
 * 나눈다(기존 수기 시트도 두 컬럼이 분리돼 있던 관례 그대로 유지).
 *
 * INPUT
 * dateTimeStr : string  예: "2026-08-05 18:30"
 *
 * OUTPUT
 * {date: Date|null, time: string}  형식이 안 맞으면 {date:null, time:""}
 *
 * TEST
 * testParseKakaoMomentsSendingDate() 참고
 * ==========================================================
 */
function parseKakaoMomentsSendingDate_(dateTimeStr){

  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(String(dateTimeStr || "").trim());

  if(!match) return { date: null, time: "" };

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const time = match[4] + ":" + match[5];

  return { date: date, time: time };

}


/**
 * ==========================================================
 * TEST — parseKakaoMomentsSendingDate_()
 * ==========================================================
 */
function testParseKakaoMomentsSendingDate(){

  const result = parseKakaoMomentsSendingDate_("2026-08-05 18:30");

  const pass =
    result.date instanceof Date &&
    result.date.getFullYear() === 2026 &&
    result.date.getMonth() === 7 &&
    result.date.getDate() === 5 &&
    result.time === "18:30";

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

  const invalid = parseKakaoMomentsSendingDate_("garbage");

  const invalidPass = invalid.date === null && invalid.time === "";

  Logger.log("Invalid input result: " + JSON.stringify(invalid));
  Logger.log(invalidPass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Kakao Moments Sync Row (순수 함수)
 *
 * WHY
 * 메시지광고 목록 항목(messageAd) + 리포트 지표(metrics, message-ads/reports
 * 응답의 metrics 객체)를 KakaoSMS_Raw 한 행(Message Ad ID 포함 18컬럼,
 * AD.KAKAO_CHANNEL.SYNC_COLUMNS 순서)으로 변환한다.
 *
 * 매핑은 2026-08-06 실제 발송 데이터로 검증 후 사용자 확인 기준 확정
 * (exec-plan 2026-08-04-kakao-moments-api-integration.md 참고):
 * Sent=msg_send / Reach=msg_open / Click=msg_click / Cost=cost /
 * Responsed=conv_signup_7d / CPL=cost_per_conv_signup_7d.
 *
 * **리포팅 지연 폴백(2026-08-06 사용자 확인)**: message-ads/reports는
 * PIXEL_SDK_CONVERSION(전환) 지표까지 포함해서 그런지 발송 직후엔 빈 응답을
 * 줄 수 있음(2026-08-05/06 두 메시지 모두 실측 — 몇 시간 지나야 채워짐).
 * 반면 message-ads/list 응답엔 이미 자체 metrics(cost/msg_send/msg_click/
 * msg_open, 전환 지표는 없음)가 같이 옴 — 리포트(metrics 인자)가 없으면
 * Sent/Reach/Click/Cost는 messageAd.metrics(list 응답 임베디드)로 즉시
 * 채우고, Responsed/CPL만 리포트 전용이라 빈 값으로 남긴다(다음 sync 재실행
 * 때 리포트가 채워지면 자동으로 반영됨).
 *
 * Event type은 메시지광고 이름(name)을 getBusinessSegment()의 campaign/detail
 * 두 인자에 동일하게 전달해서 판정 — 실제 메시지 2건이 서로 다른 명명
 * 스타일(예: "..._event-online"은 campaign 신호, "WB-..."는 detail 신호만
 * getBusinessSegment()가 체크)을 써서 한쪽 인자만으론 분류 실패가 확인됨
 * (사용자 확인 후 확정).
 *
 * Push/CTR/CvR/비고는 이 API에 대응 소스가 없어 빈 문자열(PIC와 동일,
 * computeKakaoChannelSyncRow_()의 source:null 패턴). CTR/CvR은 시트 쓰기
 * 단계(applyKakaoSMSRawStyling_())에서 수식으로 채움 — 여기서는 항상 빈
 * 문자열만 반환.
 *
 * **Marketo program은 수동 입력 컬럼으로 되돌림(2026-08-06, 사용자 확정 —
 * 아래 정정 참고)**. 처음엔 메시지광고 이름(name)을 자동으로 채웠으나,
 * 조사 결과 카카오 메시지 이름(UTM 스타일, 예: "KR_core_2026-08-12_grades-
 * ecs-kakao_event-online")과 Events_OPS가 매칭에 쓰는 실제 Marketo Program명
 * (Lead Source Detail/First Touch Detail에 찍히는 WB-/EV- 형식, 예: "WB-2024-
 * 02-KOR-MOFU-Core US App Year Strategy Webinar joining HK")은 서로 다른
 * 두 네이밍 체계라 자동 매칭이 불가능함을 확인(사용자 확인). 처음 발견했던
 * "WB-2026-07-KOR-MOFU-Core EC for Each Year of High School"(카카오 메시지
 * name과 실제 Program명이 우연히 같아 보였던 사례)은 예외 — 카카오 메시지
 * 제목 50자 제한 때문에 원래도 UTM 스타일로 잘려 들어가는 게 정상(사용자
 * 확인). 이 컬럼은 원래도(레거시 수기 행 기준) 실제 Program명 수동 입력
 * 용도였으므로 그 용도로 복귀 — 항상 빈 문자열 반환, Events_OPS 매칭용
 * Program명은 사람이 직접 입력.
 *
 * Keyword는 메시지 본문(messageAd.message.mainTitle) 앞 30자를 잘라서 씀
 * (2026-08-06 사용자 요청) — 본문 자체가 길어서(발송 안내문 전체) 시트에서
 * 한눈에 알아보기 위한 미리보기 용도.
 *
 * INPUT
 * messageAd : Object  message-ads/list 응답의 content 배열 항목(자체 .metrics
 *   포함 가능 — 리포팅 지연 시 폴백 소스)
 * metrics : Object|undefined  message-ads/reports 응답의 metrics 객체
 *   (해당 messageAdId의 리포트가 아직 없으면 undefined — 이 경우
 *   messageAd.metrics로 Sent/Reach/Click/Cost만 폴백, Responsed/CPL은 빈 값)
 *
 * OUTPUT
 * Array  AD.KAKAO_CHANNEL.SYNC_COLUMNS와 같은 길이/순서의 값 배열
 *
 * TEST
 * testComputeKakaoMomentsSyncRow() 참고
 * ==========================================================
 */
function computeKakaoMomentsSyncRow_(messageAd, metrics){

  const name = String((messageAd && messageAd.name) || "");
  const messageAdId = (messageAd && messageAd.messageAdId) || "";

  const mainTitle = String(
    (messageAd && messageAd.message && messageAd.message.mainTitle) || ""
  ).replace(/\s*\n+\s*/g, " "); // 줄바꿈 -> 공백(셀 한 줄로 표시, 2026-08-06 사용자 요청)
  const keyword = mainTitle.slice(0, 30);

  const sendingDate = parseKakaoMomentsSendingDate_(
    messageAd && messageAd.sendingReservation && messageAd.sendingReservation.date
  );

  // 기존 수기 소스 행(예: 25, 26)이 FY를 순수 숫자로 저장해와서 형식을
  // 맞춤(2026-08-06 사용자 확인) — getFiscalYear()는 "FY27" 문자열을 주므로
  // "FY" 접두사를 떼고 숫자로 변환(computeKakaoChannelRowSpendEntry_()와
  // 동일한 변환 방식).
  const fy = sendingDate.date ? Number(getFiscalYear(sendingDate.date).replace("FY", "")) : "";
  const eventType = getBusinessSegment(name, name);

  const listMetrics = messageAd && messageAd.metrics;

  const sent = metrics ? (Number(metrics.msg_send) || 0)
    : listMetrics ? (Number(listMetrics.msg_send) || 0) : "";
  const reach = metrics ? (Number(metrics.msg_open) || 0)
    : listMetrics ? (Number(listMetrics.msg_open) || 0) : "";
  const click = metrics ? (Number(metrics.msg_click) || 0)
    : listMetrics ? (Number(listMetrics.msg_click) || 0) : "";
  const cost = metrics ? (Number(metrics.cost) || 0)
    : listMetrics ? (Number(listMetrics.cost) || 0) : "";

  // Responsed/CPL은 message-ads/reports(PIXEL_SDK_CONVERSION)에만 있어 폴백 소스가 없음
  const responsed = metrics ? (Number(metrics.conv_signup_7d) || 0) : "";
  const cpl = metrics ? (Number(metrics.cost_per_conv_signup_7d) || 0) : "";

  return [
    messageAdId,       // Message Ad ID (숨김)
    fy,                 // FY
    eventType,          // Event type
    "",                 // PIC
    sendingDate.date,   // SentAt
    sendingDate.time,   // Time
    keyword,             // Keyword (메시지 본문 앞 30자)
    "",                 // Push
    sent,                // Sent
    reach,               // Reach
    click,               // Click
    responsed,           // Responsed
    cost,                // Cost
    "",                 // CTR
    "",                 // CvR
    cpl,                 // CPL
    "",                 // 비고
    ""                  // Marketo program (수동 입력 — Events_OPS 매칭용 실제 Program명)
  ];

}


/**
 * ==========================================================
 * TEST — computeKakaoMomentsSyncRow_()
 * ==========================================================
 */
function testComputeKakaoMomentsSyncRow(){

  // 실제 검증에 쓴 메시지(campaign 스타일 "event-online" 신호)
  const onlineStyleAd = {
    messageAdId: "msg-ad-1534139723687342080",
    name: "KR_core_2026-08-12_grades-ecs-kakao_event-online",
    sendingReservation: { date: "2026-08-05 18:30" },
    message: { mainTitle: "무료 웨비나) 전교 1등 GPA 4.0 학생, 스탠포드 떨어지는 진짜 이유?🤔\n\n스탠포드 입학사정관을 사로잡는" }
  };

  const metrics = {
    msg_send: 7039,
    msg_open: 2406,
    msg_click: 44,
    msg_send_fail: 7,
    cost: 105585,
    conv_signup_7d: 4,
    cost_per_conv_signup_7d: 26396.25
  };

  const result = computeKakaoMomentsSyncRow_(onlineStyleAd, metrics);

  const pass =
    result[0] === "msg-ad-1534139723687342080" &&
    result[1] === 27 &&  // getFiscalYear(): 8월 시작이라 2026-08-05는 FY27, 숫자로 저장(기존 수기 행과 형식 통일)
    result[2] === "Webinar" &&
    result[3] === "" &&
    result[4] instanceof Date && result[4].getMonth() === 7 && result[4].getDate() === 5 &&
    result[5] === "18:30" &&
    result[6] === "무료 웨비나) 전교 1등 GPA 4.0 학생, 스탠포드" && result[6].length === 30 && // Keyword: 본문 앞 30자
    result[8] === 7039 &&   // Sent
    result[9] === 2406 &&   // Reach
    result[10] === 44 &&    // Click
    result[11] === 4 &&     // Responsed
    result[12] === 105585 && // Cost
    result[15] === 26396.25 && // CPL
    result[17] === "" && // Marketo program — 수동 입력 컬럼, 항상 빈 값 반환
    result.length === 18;

  Logger.log("Result(event-online): " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

  // 실제 두 번째 메시지(detail 스타일 "WB-" 신호) — campaign 인자 하나만으론
  // 분류 실패했던 케이스, campaign/detail 양쪽에 넣는 방식으로 해결 확인
  const wbStyleAd = {
    messageAdId: "msg-ad-wb-test",
    name: "WB-2026-07-KOR-MOFU-Core EC for Each Year of High",
    sendingReservation: { date: "2026-08-05 19:00" }
  };

  const wbResult = computeKakaoMomentsSyncRow_(wbStyleAd, undefined);

  const wbPass =
    wbResult[2] === "Webinar" &&
    wbResult[8] === "" &&  // metrics 없음 — 빈 값
    wbResult.length === 18;

  Logger.log("Result(wb-style, no metrics): " + JSON.stringify(wbResult));
  Logger.log(wbPass ? "✅ PASS" : "❌ FAIL");

  // 본문 중간에 줄바꿈이 있는 케이스 — Keyword가 한 줄로(공백 치환) 나와야 함
  const newlineTitleAd = {
    messageAdId: "msg-ad-newline-test",
    name: "KR_core_2026-08-01_test_event-online",
    sendingReservation: { date: "2026-08-01 10:00" },
    message: { mainTitle: "Line1\nLine2 padding padding padding padding" }
  };

  const newlineResult = computeKakaoMomentsSyncRow_(newlineTitleAd, undefined);

  const newlinePass =
    newlineResult[6].indexOf("\n") === -1 &&
    newlineResult[6].indexOf("Line1 Line2") === 0;

  Logger.log("Result(newline in title): " + JSON.stringify(newlineResult[6]));
  Logger.log(newlinePass ? "✅ PASS" : "❌ FAIL");

  // 리포트(metrics)가 아직 없는 신규 발송 메시지 — messageAd.metrics(list 응답
  // 임베디드)로 Sent/Reach/Click/Cost는 즉시 채우고 Responsed/CPL만 빈 값이어야 함
  const reportPendingAd = {
    messageAdId: "msg-ad-report-pending",
    name: "KR_core_2026-08-06_test_event-online",
    sendingReservation: { date: "2026-08-06 10:30" },
    metrics: { cost: 105525, msg_send: 7035, msg_click: 52, msg_send_fail: 7, msg_open: 1847 }
  };

  const reportPendingResult = computeKakaoMomentsSyncRow_(reportPendingAd, undefined);

  const reportPendingPass =
    reportPendingResult[8] === 7035 &&   // Sent — list 폴백
    reportPendingResult[9] === 1847 &&   // Reach — list 폴백
    reportPendingResult[10] === 52 &&    // Click — list 폴백
    reportPendingResult[12] === 105525 && // Cost — list 폴백
    reportPendingResult[11] === "" &&    // Responsed — 폴백 소스 없음, 빈 값
    reportPendingResult[15] === "";      // CPL — 폴백 소스 없음, 빈 값

  Logger.log("Result(report pending, list fallback): " + JSON.stringify(reportPendingResult));
  Logger.log(reportPendingPass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Merge Kakao Moments Sync Rows By Key (순수 함수)
 *
 * WHY
 * 같은 messageAdId(keyColIndex 위치)를 다시 동기화할 때 기존 행을 최신
 * 지표로 덮어쓴다(upsert) — 카카오모먼트 지표는 발송 후에도 최대 7일까지
 * 계속 늘어나므로(msg_open/conv_signup_7d 등, 2026-08-06 실측 확인) 수기
 * 시트 때의 append-only 방식(syncKakaoChannelPerformanceToAD_())을 그대로
 * 쓰면 오래된 스냅샷이 영구 고정돼 과소평가 위험이 있음(사용자 확인 후
 * upsert로 결정). Message Ad ID가 없는(빈 문자열) 기존 행 — 수기 소스로
 * 과거 동기화된 행 — 은 새 데이터와 절대 매칭되지 않아 그대로 보존된다.
 *
 * **수동 입력 컬럼 보존(2026-08-06 추가)**: `computeKakaoMomentsSyncRow_()`는
 * PIC/Push/비고/Marketo program을 항상 빈 문자열로 계산한다(API 소스 없음,
 * Marketo program은 Events_OPS 매칭용으로 사람이 직접 입력하는 컬럼 —
 * exec-plan 2026-08-04-kakao-moments-api-integration.md 참고). preserveColIndexes
 * 없이 그냥 새 값으로 덮어쓰면, 이미 사람이 입력해둔 값이 다음 재동기화(예:
 * 전환 지표가 나중에 채워져 재실행) 때 통째로 날아감 — 기존 행의 이 컬럼
 * 값들만 새 행에 이식해서 보존한다.
 *
 * INPUT
 * existingRows : Array<Array>  KakaoSMS_Raw의 기존 데이터 행(헤더 제외)
 * newRows : Array<Array>  이번 sync에서 계산된 새 행
 * keyColIndex : number  매칭 키로 쓸 컬럼 인덱스
 * preserveColIndexes : Array<number>  매칭된 기존 행에서 그대로 유지할 컬럼
 *   인덱스(수동 입력 컬럼) — 생략 시 보존 없이 전부 새 값으로 교체
 *
 * OUTPUT
 * Array<Array>  최종 전체 행(기존 행 순서 유지, 매칭된 건 새 값으로 교체하되
 *   preserveColIndexes는 기존 값 유지, 새 키만 뒤에 추가)
 *
 * TEST
 * testMergeKakaoMomentsSyncRows() 참고
 * ==========================================================
 */
function mergeKakaoMomentsSyncRows_(existingRows, newRows, keyColIndex, preserveColIndexes){

  const newByKey = {};

  (newRows || []).forEach(function(row){
    newByKey[row[keyColIndex]] = row;
  });

  const usedKeys = {};

  const merged = (existingRows || []).map(function(row){

    const key = row[keyColIndex];

    if(key && newByKey.hasOwnProperty(key)){
      usedKeys[key] = true;

      const mergedRow = newByKey[key].slice();

      (preserveColIndexes || []).forEach(function(idx){
        mergedRow[idx] = row[idx];
      });

      return mergedRow;
    }

    return row;

  });

  (newRows || []).forEach(function(row){

    const key = row[keyColIndex];

    if(!usedKeys[key]) merged.push(row);

  });

  return merged;

}


/**
 * ==========================================================
 * TEST — mergeKakaoMomentsSyncRows_()
 * ==========================================================
 */
function testMergeKakaoMomentsSyncRows(){

  const existingRows = [
    ["msg-ad-1", "old", "row1"],
    ["", "manual", "row-no-id"],       // 수기 소스 과거 행 — 키 없음
    ["msg-ad-2", "old", "row2"]
  ];

  const newRows = [
    ["msg-ad-1", "new", "row1-updated"],  // 기존 매칭 — 덮어써야 함
    ["msg-ad-3", "new", "row3"]           // 신규 — 뒤에 추가돼야 함
  ];

  const result = mergeKakaoMomentsSyncRows_(existingRows, newRows, 0);

  const pass =
    result.length === 4 &&
    result[0][2] === "row1-updated" &&  // msg-ad-1 갱신됨
    result[1][1] === "manual" &&        // 키 없는 행 그대로 보존
    result[2][2] === "row2" &&          // msg-ad-2 안 건드림
    result[3][0] === "msg-ad-3";        // 신규 행 뒤에 추가됨

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

  // preserveColIndexes — 사람이 수동으로 입력해둔 컬럼(예: Marketo program)은
  // 재동기화로 덮어써지면 안 됨
  const existingWithManualEntry = [
    ["msg-ad-1", "old", "row1", "WB-2024-02-KOR-MOFU-Core Manual Program Name"]
  ];

  const newRowsBlankManualCol = [
    ["msg-ad-1", "new", "row1-updated", ""]  // computeKakaoMomentsSyncRow_()는 항상 빈 문자열로 계산
  ];

  const preserveResult = mergeKakaoMomentsSyncRows_(
    existingWithManualEntry, newRowsBlankManualCol, 0, [3]
  );

  const preservePass =
    preserveResult[0][1] === "new" &&              // 자동 갱신 컬럼은 새 값
    preserveResult[0][3] === "WB-2024-02-KOR-MOFU-Core Manual Program Name"; // 수동 입력 컬럼은 보존

  Logger.log("Result(preserve manual column): " + JSON.stringify(preserveResult));
  Logger.log(preservePass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Fetch Kakao Moments Ad Account And Channel Profile (IO 래퍼)
 *
 * WHY
 * 리포트 관련 API 호출은 전부 adAccountId/channelProfileId 체이닝이
 * 선행돼야 함(runDebugKakaoMomentsReportFirstRow() 등 진단 함수와 동일한
 * 패턴). 광고계정 1개 운영이 확정돼 있어(exec-plan 참고) 첫 번째 값을 그대로
 * 사용. 실제 파이프라인에서 쓰이므로 진단 함수와 달리 실패 시 조용히
 * 넘어가지 않고 에러를 던진다(Naver Search 때와 동일 원칙).
 * ==========================================================
 */
function fetchKakaoMomentsAdAccountAndChannelProfile_(){

  const accountsResult = callKakaoMomentsApi_(
    "get", AD.KAKAO_MOMENTS.REPORT.AD_ACCOUNTS_LIST_URL, {}, null
  );

  const accounts = accountsResult.body && accountsResult.body.content;

  if(!Array.isArray(accounts) || accounts.length === 0){
    throw new Error(
      "카카오모먼트 광고계정 목록을 못 가져옴 — statusCode: " + accountsResult.statusCode +
      ", body: " + JSON.stringify(accountsResult.body)
    );
  }

  const adAccountId = accounts[0].id;

  const profilesResult = callKakaoMomentsApi_(
    "get", AD.KAKAO_MOMENTS.REPORT.CHANNEL_PROFILES_URL,
    { "adAccountId": String(adAccountId) }, null
  );

  const profiles = profilesResult.body;

  if(!Array.isArray(profiles) || profiles.length === 0){
    throw new Error(
      "카카오모먼트 채널 프로필 목록을 못 가져옴 — statusCode: " + profilesResult.statusCode +
      ", body: " + JSON.stringify(profilesResult.body)
    );
  }

  return { adAccountId: adAccountId, channelProfileId: profiles[0].id };

}


/**
 * ==========================================================
 * Sync Kakao Moments Report To KakaoSMS_Raw (IO 래퍼)
 *
 * WHY
 * 카카오모먼트 메시지광고 리포트를 가져와 `KakaoSMS_Raw`(AD.RAW_SHEET
 * ["Kakao Channel"])에 upsert한다. 발송 완료 안 된(metrics가 null인) 메시지는
 * 제외 — 예약 대기/삭제된 테스트 메시지가 빈 행으로 섞이는 것을 방지
 * (2026-08-05 실측: 발송 전 메시지는 metrics: null로 확인됨).
 *
 * 시트가 처음 생성될 때만 "Message Ad ID" 컬럼(1열)을 숨긴다 — 사용자가
 * 필요시 직접 다시 표시/재숨김할 수 있으므로 매 실행마다 강제로 재적용하지
 * 않음.
 *
 * OUTPUT
 * number  이번 실행에서 새로 추가되거나 갱신된 메시지광고 수
 * ==========================================================
 */
function syncKakaoMomentsReportToKakaoSMSRaw_(){

  const chain = fetchKakaoMomentsAdAccountAndChannelProfile_();

  const messageAdsResult = callKakaoMomentsApi_(
    "post", AD.KAKAO_MOMENTS.REPORT.MESSAGE_ADS_LIST_URL,
    { "adAccountId": String(chain.adAccountId), "channel-profile-id": String(chain.channelProfileId) },
    {}
  );

  const messageAds = (messageAdsResult.body && messageAdsResult.body.content) || [];

  const sentMessageAds = messageAds.filter(function(ad){
    return ad.metrics !== null && ad.metrics !== undefined;
  });

  if(sentMessageAds.length === 0){
    Logger.log("발송 완료된 메시지광고가 없습니다 — 동기화할 행 없음.");
    return 0;
  }

  const messageAdIds = sentMessageAds.map(function(ad){ return ad.messageAdId; });

  const reportResult = callKakaoMomentsApi_(
    "post", AD.KAKAO_MOMENTS.REPORT.MESSAGE_ADS_REPORT_URL,
    { "adAccountId": String(chain.adAccountId), "channel-profile-id": String(chain.channelProfileId) },
    {
      messageAdIds: messageAdIds,
      dimension: "MESSAGE_AD",
      metricsGroup: ["MESSAGE", "MESSAGE_ADDITION", "PIXEL_SDK_CONVERSION"],
      datePreset: "LAST_30DAY"
    }
  );

  const reportRows = (reportResult.body && reportResult.body.data) || [];

  const metricsByMessageAdId = {};

  reportRows.forEach(function(row){
    const id = row.dimensions && row.dimensions.message_ad_id;
    if(id) metricsByMessageAdId[id] = row.metrics;
  });

  const columnDefs = AD.KAKAO_CHANNEL.SYNC_COLUMNS;
  const headerValues = columnDefs.map(function(c){ return c.header; });
  const keyColIndex = 0; // Message Ad ID
  const preserveColIndexes = [3, 7, 16, 17]; // PIC/Push/비고/Marketo program(수동 입력) — 재동기화 시 보존

  const newRows = sentMessageAds.map(function(ad){
    return computeKakaoMomentsSyncRow_(ad, metricsByMessageAdId[ad.messageAdId]);
  });

  const destSS = SpreadsheetApp.openById(AD.SPREADSHEET_ID);
  let destSheet = destSS.getSheetByName(AD.RAW_SHEET["Kakao Channel"]);

  if(!destSheet){
    destSheet = destSS.insertSheet(AD.RAW_SHEET["Kakao Channel"]);
    destSheet.getRange(1, 1, 1, headerValues.length).setValues([headerValues]);
    destSheet.hideColumns(1);
  }

  const lastRow = destSheet.getLastRow();
  const existingRows = lastRow > 1
    ? destSheet.getRange(2, 1, lastRow - 1, headerValues.length).getValues()
    : [];

  const merged = mergeKakaoMomentsSyncRows_(existingRows, newRows, keyColIndex, preserveColIndexes);

  if(existingRows.length > 0){
    destSheet.getRange(2, 1, existingRows.length, headerValues.length).clearContent();
  }

  if(merged.length > 0){
    destSheet.getRange(2, 1, merged.length, headerValues.length).setValues(merged);
  }

  applyKakaoSMSRawStyling_(destSheet);

  Logger.log(
    "KakaoSMS_Raw 동기화 완료 — 총 " + merged.length + "행(이번 실행 대상 메시지광고 " +
    newRows.length + "건)."
  );

  return newRows.length;

}


/**
 * ==========================================================
 * TEMP — syncKakaoMomentsReportToKakaoSMSRaw_() 수동 실행용 공개 진입점
 * ==========================================================
 */
function runSyncKakaoMomentsReportToKakaoSMSRaw(){

  syncKakaoMomentsReportToKakaoSMSRaw_();

}


/**
 * ==========================================================
 * Apply KakaoSMS_Raw Styling (IO 래퍼)
 *
 * WHY (2026-08-06, 사용자 요청)
 * 가장 최신 SentAt이 맨 위로 오도록 정렬(빈 날짜는 Sheets 기본 동작상
 * 끝으로 감, 다른 OPS 시트들의 "빈 날짜 최하단" 관례와 일치) — 프로젝트
 * 공용 `sortSheetByDate()`(06_SheetSorter.js)는 `CONFIG.SPREADSHEET`(메인
 * 스프레드시트) 전용이라 못 씀(KakaoSMS_Raw는 AD.SPREADSHEET_ID, 별도
 * 스프레드시트 — AD_001_Config.js 헤더 코멘트 참고), 여기서 직접 정렬.
 * **정렬은 반드시 CTR/CvR 수식 생성보다 먼저** — 수식이 "K5/J5"처럼 행
 * 번호를 문자열로 박아 넣으므로, 정렬 후에 수식을 만들어야 실제 위치와
 * 맞는다(먼저 만들고 나중에 정렬하면 행이 통째로 이동하면서 수식이 엉뚱한
 * 행을 참조하게 됨).
 *
 * Sent/Reach/Click/Responsed/Cost(I:M열)/CPL(P열)은 천 단위 콤마 + 소수
 * 자리수 없는 정수 표시(값 자체는 안 바꾸고 표시 형식만), CTR(N열)=Click÷
 * Reach, CvR(O열)=Responsed÷Click은 실제 값 대신 수식으로 채워 항상 최신
 * 상태를 유지한다("0.0%" 표시, 다른 리포트의 CTR류 컬럼과 동일한 하우스
 * 스타일 — 55_Events_Styles.js 등 참고). 전체 데이터 범위에 매번 다시
 * 적용(멱등, 기존 수기 소스 행도 함께 정리됨)하고 테두리도 다시 그린다.
 * 두 sync 함수(syncKakaoMomentsReportToKakaoSMSRaw_()/
 * syncKakaoChannelPerformanceToAD_()) 둘 다 실행 끝에 호출해 어느 경로로
 * 갱신되든 스타일이 항상 유지되게 한다.
 * ==========================================================
 */
function applyKakaoSMSRawStyling_(sheet){

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if(lastRow < 2) return;

  const numRows = lastRow - 1;

  // SentAt(E열=5) 기준 내림차순(최신이 맨 위) — 수식 생성 전에 먼저 정렬
  sheet.getRange(2, 1, numRows, lastCol).sort({ column: 5, ascending: false });

  // I:M(9~13열) = Sent/Reach/Click/Responsed/Cost, P(16열) = CPL — 정수, 천단위 콤마
  sheet.getRange(2, 9, numRows, 5).setNumberFormat("#,##0");
  sheet.getRange(2, 16, numRows, 1).setNumberFormat("#,##0");

  // N(14열)=CTR=Click(K)/Reach(J), O(15열)=CvR=Responsed(L)/Click(K) — 0으로
  // 나누기 방지, "0.0%" 표시(하우스 스타일)
  const ctrFormulas = [];
  const cvrFormulas = [];

  for(let i = 0; i < numRows; i++){
    const row = i + 2;
    ctrFormulas.push(["=IF(J" + row + "=0,\"\",K" + row + "/J" + row + ")"]);
    cvrFormulas.push(["=IF(K" + row + "=0,\"\",L" + row + "/K" + row + ")"]);
  }

  sheet.getRange(2, 14, numRows, 1).setFormulas(ctrFormulas).setNumberFormat("0.0%");
  sheet.getRange(2, 15, numRows, 1).setFormulas(cvrFormulas).setNumberFormat("0.0%");

  // 테두리(헤더+데이터 전체) — 하우스 스타일(55_Events_Styles.js 등과 동일)
  sheet.getRange(1, 1, lastRow, lastCol)
    .setBorder(
      true, true, true, true, true, true,
      "#000000",
      SpreadsheetApp.BorderStyle.SOLID
    );

}


/**
 * ==========================================================
 * TEMP — KakaoSMS_Raw 컬럼 정렬 진단(수동 실행, 1회성)
 *
 * WHY (2026-08-06)
 * `AD_001_Config.js` v1.17.0에서 `SYNC_COLUMNS` 맨 앞에 "Message Ad ID"를
 * 추가했는데, 기존 `KakaoSMS_Raw` 시트(291행)는 그 전(17컬럼, A열=FY)에 이미
 * 만들어져 있었음 — 시트 생성 코드는 `!destSheet`일 때만 헤더를 다시 쓰므로
 * 기존 시트의 헤더/데이터는 갱신 안 됐을 가능성이 높음. 방금
 * `runSyncKakaoChannelPerformanceToAD()`가 추가한 신규 2행은 새 18컬럼
 * 레이아웃(A열=Message Ad ID)으로 써져서, 기존 291행과 신규 2행 사이에
 * 컬럼 밀림이 있는지 실제 값으로 확인한다(추측 금지, 수정 전 필수 확인).
 * ==========================================================
 */
function runDebugKakaoSMSRawColumnAlignment(){

  const ss = SpreadsheetApp.openById(AD.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(AD.RAW_SHEET["Kakao Channel"]);

  if(!sheet){
    Logger.log("KakaoSMS_Raw 시트를 못 찾음.");
    return;
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  Logger.log("lastRow=" + lastRow + ", lastCol=" + lastCol);

  const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  Logger.log("헤더(1행): " + JSON.stringify(header));

  const firstDataRow = sheet.getRange(2, 1, 1, lastCol).getValues()[0];
  Logger.log("첫 데이터 행(2행): " + JSON.stringify(firstDataRow));

  const lastTwoRows = sheet.getRange(lastRow - 1, 1, 2, lastCol).getValues();
  Logger.log("마지막 2개 행(" + (lastRow - 1) + "~" + lastRow + "행): " + JSON.stringify(lastTwoRows));

}


/**
 * ==========================================================
 * TEMP — KakaoSMS_Raw 컬럼 밀림 복구(1회성, 수동 실행)
 *
 * WHY (2026-08-06)
 * `runDebugKakaoSMSRawColumnAlignment()` 실측으로 확인된 문제: "Message Ad ID"
 * 컬럼 추가(v1.6.0) 전에 이미 있던 291개 행(수기 소스, `runSyncKakaoChannel
 * PerformanceToAD()`가 예전에 채움)은 옛 17컬럼 레이아웃 그대로 남아있고
 * (A열=FY, 숫자), 이번 실행에서 새로 추가된 2개 행은 새 18컬럼 레이아웃으로
 * 써져서(A열=Message Ad ID, 빈 문자열) 시트 안에서 레이아웃이 섞여 있었음.
 * 헤더(1행)도 옛 17컬럼 그대로 미갱신 상태.
 *
 * 실측으로 확인한 구분 기준: A열이 숫자(number)면 옛 레이아웃 행 — FY가
 * 그 자리에 숫자로 들어있음. A열이 문자열(빈 값 또는 messageAdId)이면 이미
 * 신규 레이아웃. 옛 행만 앞에 빈 "Message Ad ID" 칸을 끼워 한 칸씩 밀고
 * (끝의 stray 빈 칸 1개는 버림 — 밀면서 자연히 상쇄), 신규 행은 그대로 둔다
 * (재실행해도 안전, idempotent). 마지막에 헤더를 새 18컬럼 스키마로 갱신하고
 * "Message Ad ID" 컬럼을 숨긴다.
 * ==========================================================
 */
function runRepairKakaoSMSRawColumnAlignment(){

  const ss = SpreadsheetApp.openById(AD.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(AD.RAW_SHEET["Kakao Channel"]);

  if(!sheet){
    Logger.log("KakaoSMS_Raw 시트를 못 찾음.");
    return;
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if(lastRow < 2){
    Logger.log("데이터 행 없음 — 복구할 게 없음.");
    return;
  }

  const columnDefs = AD.KAKAO_CHANNEL.SYNC_COLUMNS;
  const headerValues = columnDefs.map(function(c){ return c.header; });

  const knownEventTypes = ["Seminar", "Webinar", "BOFU", "Search", "Content", "Referral", "Other"];

  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  let fixedCount = 0;

  const fixedData = data.map(function(row){

    // 옛 레이아웃 판별: A열(FY 자리)이 숫자이거나, FY가 공란이라 A열이
    // ""였던 케이스는 B열(Event type 자리)에 실제 세그먼트 문자열이
    // 들어있음(2026-08-06 실측, 시트 267행에서 발견 — runFindKakaoSMSRaw
    // FYColumnAnomalies() 참고).
    const looksOld =
      typeof row[0] === "number" ||
      knownEventTypes.indexOf(row[1]) !== -1;

    if(looksOld){
      fixedCount++;
      return [""].concat(row.slice(0, headerValues.length - 1));
    }

    if(row.length === headerValues.length) return row;

    return row.concat(new Array(headerValues.length - row.length).fill(""));

  });

  sheet.getRange(1, 1, 1, headerValues.length).setValues([headerValues]);
  sheet.getRange(2, 1, fixedData.length, headerValues.length).setValues(fixedData);

  if(lastCol > headerValues.length){
    sheet.deleteColumns(headerValues.length + 1, lastCol - headerValues.length);
  }

  sheet.hideColumns(1);

  Logger.log(
    "KakaoSMS_Raw 컬럼 정렬 복구 완료 — 총 " + fixedData.length + "행 중 " +
    fixedCount + "행을 옛 17컬럼 레이아웃에서 신규 18컬럼 레이아웃으로 이동. " +
    "헤더 갱신 및 Message Ad ID 컬럼 숨김 완료."
  );

}


/**
 * ==========================================================
 * TEMP — runRepairKakaoSMSRawColumnAlignment() 이후 남은 미정렬 행 스캔
 *
 * WHY (2026-08-06)
 * 복구 실행 결과 293행 중 290행만 옮겨짐(291행이 옛 레이아웃일 것으로
 * 예상했으나 1행 차이) — 어느 행이 판별 기준(A열이 숫자)에 안 걸렸는지
 * 실제 행 번호/값으로 찾는다(추측 금지). 복구 후 A열(Message Ad ID)이
 * 숫자인 행이 남아있으면 그 행이 여전히 옛 레이아웃(미복구) 상태.
 * ==========================================================
 */
function runFindUnrepairedKakaoSMSRawRows(){

  const ss = SpreadsheetApp.openById(AD.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(AD.RAW_SHEET["Kakao Channel"]);

  if(!sheet){
    Logger.log("KakaoSMS_Raw 시트를 못 찾음.");
    return;
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  let found = 0;

  data.forEach(function(row, i){

    if(typeof row[0] === "number"){
      found++;
      Logger.log("미복구 의심 행(시트 " + (i + 2) + "행): " + JSON.stringify(row));
    }

  });

  if(found === 0){
    Logger.log("A열이 숫자인 행 없음 — 전부 신규 레이아웃으로 정렬된 것으로 보임.");
  } else {
    Logger.log("총 " + found + "개 행이 여전히 미복구 상태.");
  }

}


/**
 * ==========================================================
 * TEMP — Event type(C열) 값 기준 KakaoSMS_Raw 정렬 재검증
 *
 * WHY (2026-08-06)
 * A열 숫자 여부로는 미복구 행을 못 찾았으나(runFindUnrepairedKakaoSMSRawRows()
 * 결과 0건) 293행 중 290행만 이동됐다는 로그와 1행 차이가 남아있음 — FY가
 * 애초에 공란이던 옛 행이라 "A열 숫자" 판별을 통과 못 했을 가능성. Event
 * type(C열)이 알려진 세그먼트 값이 아닌 행을 찾아 실제로 밀려있는지
 * (예: C열에 PIC 이름 같은 엉뚱한 값이 들어있는지) 확인한다.
 * ==========================================================
 */
function runFindKakaoSMSRawEventTypeAnomalies(){

  const ss = SpreadsheetApp.openById(AD.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(AD.RAW_SHEET["Kakao Channel"]);

  if(!sheet){
    Logger.log("KakaoSMS_Raw 시트를 못 찾음.");
    return;
  }

  const knownEventTypes = ["Seminar", "Webinar", "BOFU", "Search", "Content", "Referral", "Other", ""];

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  let found = 0;

  data.forEach(function(row, i){

    const eventType = row[2];

    if(knownEventTypes.indexOf(eventType) === -1){
      found++;
      Logger.log("Event type 이상 행(시트 " + (i + 2) + "행, Event type=" + JSON.stringify(eventType) + "): " + JSON.stringify(row));
    }

  });

  Logger.log(found === 0 ? "이상 행 없음." : "총 " + found + "개 행에서 Event type 이상 발견.");

}


/**
 * ==========================================================
 * TEMP — B열(FY) 값 기준 KakaoSMS_Raw 정렬 최종 재검증
 *
 * WHY (2026-08-06)
 * Event type(C열) 스캔도 0건이었지만, PIC가 마침 공란인 행이면 그 스캔을
 * 통과하고도 여전히 안 밀린 상태일 수 있음(사각지대: 안 밀린 행은 C열에
 * PIC가 오는데 PIC가 공란이면 "이상 없음"으로 오판됨). 더 직접적인 신호로
 * B열(FY 자리)을 검사 — 정상이라면 숫자/공란/"FY.."문자열이어야 하는데,
 * 여전히 안 밀린 행이라면 이 자리에 실제 Event type 문자열(Seminar 등)이
 * 들어있을 것.
 * ==========================================================
 */
function runFindKakaoSMSRawFYColumnAnomalies(){

  const ss = SpreadsheetApp.openById(AD.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(AD.RAW_SHEET["Kakao Channel"]);

  if(!sheet){
    Logger.log("KakaoSMS_Raw 시트를 못 찾음.");
    return;
  }

  const knownEventTypes = ["Seminar", "Webinar", "BOFU", "Search", "Content", "Referral", "Other"];

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  let found = 0;

  data.forEach(function(row, i){

    const fyValue = row[1];

    if(knownEventTypes.indexOf(fyValue) !== -1){
      found++;
      Logger.log("FY열(B) 이상 행(시트 " + (i + 2) + "행, B열=" + JSON.stringify(fyValue) + " — Event type 값이 여기 들어있음, 안 밀린 것으로 추정): " + JSON.stringify(row));
    }

  });

  Logger.log(found === 0 ? "이상 행 없음 — B열이 전부 정상." : "총 " + found + "개 행에서 FY열 이상 발견(미정렬 의심).");

}


/**
 * ==========================================================
 * Read KakaoSMS_Raw Program/Cost Rows (IO 래퍼)
 *
 * WHY (2026-08-06)
 * Events_Engine이 프로그램별 카카오모먼트 비용을 집계하려면 `Marketo
 * program`(R열, 수동 입력 — 실제 Marketo Program명, Events_OPS 매칭 키)과
 * `Cost`만 있으면 된다. 카카오 메시지 이름(UTM 스타일)과 Events_OPS 매칭용
 * 실제 Program명은 서로 다른 네이밍 체계라 자동 매칭이 불가능함을 확인했고
 * (exec-plan 2026-08-04-kakao-moments-api-integration.md), 그래서 이 컬럼을
 * 사람이 직접 채워야 함 — `Marketo program`이 빈 행은 아직 매칭 안 된
 * 메시지이므로 이 함수 결과에서 제외(호출부가 처리).
 *
 * OUTPUT
 * Array<{marketoProgram, cost}>  Marketo program이 빈 문자열인 행은 제외
 * ==========================================================
 */
function readKakaoSMSRawProgramCostRows_(){

  const ss = SpreadsheetApp.openById(AD.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(AD.RAW_SHEET["Kakao Channel"]);

  if(!sheet) return [];

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if(lastRow < 2 || lastCol === 0) return [];

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function(h){ return String(h).trim(); });

  const programCol = headers.indexOf("Marketo program");
  const costCol = headers.indexOf("Cost");

  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  return values
    .map(function(row){
      return {
        marketoProgram: row[programCol],
        cost: parseCurrencyValue_(row[costCol])
      };
    })
    .filter(function(record){ return !!String(record.marketoProgram || "").trim(); });

}
