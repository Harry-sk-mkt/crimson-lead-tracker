# 카카오모먼트 메시지광고 API 연동

**관련 로드맵 항목**: `docs/Roadmap.md` End Goal Phase 1 — 캠페인 지출 통합 (Kakao Moments 플랫폼)
**선행 문서**: `docs/exec-plans/active/2026-07-30-campaign-spend-integration.md` (Kakao Channel 항목,
`AD_005_KakaoChannel.js`)
**시작일**: 2026-08-04

## Goal

카카오모먼트 API(메시지광고 보고서)로 카카오톡 채널 메시지 광고 성과(발송/도달/클릭/응답/비용)를
자동으로 가져와 `KakaoSMS_Raw`에 적재한다. 기존에 `AD_005_KakaoChannel.js`가 수기 관리 시트
("Performance")에서 append-only로 복사해오던 방식을 API 소스로 전환한다.

## 배경 — 기존 구조와의 관계 (중요, 착오 방지용)

- `AD_001_Config.js`의 `AD.PLATFORMS`에 "Kakao Moments"와 "Kakao Channel"이 별개 플랫폼으로
  이미 둘 다 등록되어 있음. "Kakao Channel"(`AD_005_KakaoChannel.js`)은 카카오톡 채널 푸시
  메시지 성과를 사용자가 수기로 관리해온 별도 스프레드시트(`AD.KAKAO_CHANNEL.SPREADSHEET_ID`)에서
  읽어오는 기존 구현.
- **사용자 확인(2026-08-04, claude.ai 세션)**: 카카오모먼트 API로 가져올 데이터는 "메시지" 광고
  성과이고, 목적지는 기존과 동일하게 `KakaoSMS_Raw`(= `AD.RAW_SHEET["Kakao Channel"]`,
  `AD.SPREADSHEET_ID` 안의 탭)로 **재활용**한다. 기존 데이터는 유지, 앞으로의 신규 데이터만 API
  소스로 전환. 즉 시트/컬럼 스키마는 그대로 두고 **데이터 공급원만 교체**하는 작업.
- **문서 간 충돌 발견 및 해소(2026-08-04, Claude Code 세션에서 재확인)**: 선행 exec-plan
  (`2026-07-30-campaign-spend-integration.md`, 2026-07-31 기록)에는 반대 방향
  ("이관 시 기존 시트 완전 폐기, 새 시트/Business Segment 기준 명명 규칙으로 새로 설계")이
  적혀 있어 정면 충돌 — 사용자에게 재확인한 결과 **"기존 시트 재활용"이 최종 확정**(아래
  Decision Log 참고). 이 변경 사항은 선행 exec-plan을 사후 수정하지 않고(ExecPlanConvention.md
  원칙) 이 문서에 새 결정으로 기록.
- `KakaoSMS_Raw` 컬럼(기존 `AD.KAKAO_CHANNEL.SYNC_COLUMNS`, `AD_001_Config.js`):
  `FY / Event type / PIC / SentAt / Time / Keyword / Push / Sent / Reach / Click / Responsed /
  Cost / CTR / CvR / CPL / 비고 / Marketo program`
  - `PIC`, `비고`, `Marketo program`은 원본에 없는/사용자 수동 입력 컬럼 — API 응답으로 채우지 않음
    (append 시 빈 문자열, 기존 `computeKakaoChannelSyncRow_()`의 `source:null` 패턴과 동일)
  - `CTR`, `CvR`은 기존에도 원본 수식값이라 비워둠 — API 전환 후에도 동일 정책 유지 여부는
    Progress 체크리스트의 "필드 매핑" 항목에서 재확인
  - `Event type`은 기존에 Business Segment 값(Seminar/Webinar/BOFU)과 1:1 — API 쪽 캠페인/메시지
    이름에서 어떻게 도출할지 확인 필요 (Meta처럼 `getBusinessSegment()` 재사용 가능한지, 아니면
    Kakao Channel처럼 별도 매핑이 필요한지 실데이터로 검증)

## 인증 (비즈니스 인증, OAuth 2.0)

카카오모먼트 API는 일반 카카오 로그인과 다른 별도 인증 체계(**비즈니스 인증**)를 쓴다.

- **필요한 것**: REST API 키(보유), 클라이언트 시크릿, 리다이렉트 URI, 비즈니스 동의항목
  - 리다이렉트 URI/클라이언트 시크릿 설정 위치: 카카오디벨로퍼스 앱 관리 페이지의
    **[앱] > [플랫폼 키] > [REST API 키]** 카드 안 (2026년 기준 UI — [카카오 로그인] 메뉴 아래가
    아님, 공식 문서 `developers.kakao.com/docs/ko/business-auth/prerequisite` 확인 완료)
  - 비즈니스 동의항목 설정 위치: **[비즈니스 인증] > [동의항목]**
  - 어드민 키는 이 흐름과 무관 — 반드시 비즈니스 토큰(Business Token)이 필요함
- **승인된 스코프** (사용자 확인, 2026-08-04): `moment_create`, `moment_management`,
  `moment_delete`, `moment_bizform_result_read` (+ 키워드광고 관련 스코프, 이 작업과 무관)
- **흐름**: 인가 코드 요청(동의 화면) → 리다이렉트 URI로 인가 코드 전달 → 인가 코드로 비즈니스
  토큰(Access/Refresh) 교환 → API 호출 시 `Authorization: Bearer ${BUSINESS_ACCESS_TOKEN}` 헤더 사용
- **GAS 구현 방향(제안)**: GAS를 웹앱(`doGet(e)`)으로 배포해 리다이렉트 URI로 등록 → 인가 코드
  수신 → 토큰 교환 → `PropertiesService`에 Access/Refresh Token 저장(기존 `00_Config.js`의
  `PROPERTIES` 패턴, Naver Search API 자격증명 저장 방식과 동일하게 Script Properties 사용) →
  **Time-driven Trigger로 Refresh Token 기반 자동 갱신**(2026-08-04 사용자 확정 — 아래 Decision
  Log 참고)
- **광고계정**: 1개 (다중 계정 매핑 로직 불필요)

## API 참고 (developers.kakao.com 확인 완료, 2026-08-04)

- **비즈니스 토큰 발급/갱신**: `docs/ko/business-auth/rest-api` 참고 (claude.ai 세션에서 상세 미조회 —
  Claude Code가 최초 구현 시 직접 조회 권장, 인가 코드 요청/토큰 교환/갱신 3개 엔드포인트 확인 필요)
- **보고서 API 후보** (`docs/ko/kakaomoment/report` 확인 완료):
  - 캠페인 보고서: `GET https://apis.moment.kakao.com/openapi/v4/campaigns/report`
  - 광고계정 보고서: `GET https://apis.moment.kakao.com/openapi/v4/adAccounts/report`
  - 공통 쿼리 파라미터: `datePreset`(TODAY/YESTERDAY/LAST_7DAY/.../THIS_MONTH/LAST_MONTH) 또는
    `start`/`end`(`yyyyMMdd`, 최대 31일 범위), `level`, `dimension`, `metricsGroup`(복수 선택 가능)
  - 메시지 캠페인 지표는 `metricsGroup=MESSAGE`(기본), `MESSAGE_ADDITION`, `MESSAGE_CLICK`,
    `PLUS_FRIEND` 등으로 선택 — **정확한 응답 필드명(Sent/Reach/Push/Responsed에 대응하는 키)은
    claude.ai 세션에서 확인 못함, type-info 페이지(`docs/ko/kakaomoment/type-info`의
    `MetricsGroup` 표) 또는 실제 API 호출 결과로 반드시 검증 필요** — Meta 때(`runDebugMetaRawFirstRow()`)
    와 동일하게 진단 함수(`runDebugKakaoMomentsReportFirstRow()` 등)를 먼저 만들어 실제 응답 구조를
    찍어보고 필드 매핑을 확정할 것. 절대 필드명을 추측해서 매핑하지 말 것.
  - 대안: 메시지광고 관리(`msg-ad-mgmt`)의 "메시지광고 보고서 조회" 전용 엔드포인트가 있는지도
    `docs/ko/kakaomoment/msg-ad-mgmt` 페이지에서 확인 — 위 공용 보고서 API와 다른 응답 스키마일
    가능성 있음(캠페인/광고그룹 단위가 아니라 개별 메시지광고 단위일 수 있음)
  - 요청 수 제한: 캠페인 보고서는 광고계정+앱 ID당 5초에 1회

## Progress

- [x] 인증 방식 확정 — 비즈니스 인증(OAuth 2.0), 어드민 키 아님
- [x] 목적지 시트 확정 — `KakaoSMS_Raw` 재활용(기존 데이터 유지, 신규 행부터 API 소스)
- [x] 데이터 종류 확정 — 메시지광고 성과(노출/발송/도달/클릭/응답/비용)
- [x] 광고계정 개수 확정 — 1개
- [x] **문서 간 충돌 해소(2026-08-04)** — 선행 exec-plan의 "완전 폐기/새 스키마" 기록과 충돌,
      재확인 결과 "기존 시트 재활용"으로 최종 확정(Decision Log 참고)
- [x] ~~토큰 자동 갱신 방식 확정(2026-08-04) — Time-driven Trigger로 자동 갱신~~ — **정정
      (2026-08-04, 공식 문서 확인 후)**: 비즈니스 토큰엔 Refresh Token 자체가 없어(아래
      Surprises 참고) Time-driven Trigger 방식은 무효. 실제 사용(캠페인 지출 파이프라인의
      주기적 호출)으로 미사용 만료를 회피하는 방식으로 대체 확정(사용자 확인).
- [x] **Config 정리 방향 확정(2026-08-04)** — `AD.RAW_SHEET["Kakao Channel"]` 키/값 그대로 유지,
      리네이밍 안 함(변경 최소화)
- [x] **전환(cutover) 방식 확정(2026-08-04)** — `syncKakaoChannelPerformanceToAD_()`(수기 시트
      동기화)는 원래 수동 실행 전용(시간 트리거 없음)이라, API 전환 후 그냥 실행을 멈추면 됨 —
      별도 코드 가드 불필요
- [ ] **필수 변경사항 발견(2026-08-04)** — `AD_004_SpendCache.js`의 `computeKakaoChannelSpendSummary_()`
      호출부(245행 부근)가 지금 외부 수기 스프레드시트(`AD.KAKAO_CHANNEL.SPREADSHEET_ID`)를 직접
      읽고 있음. API 전환 후 신규 행은 `KakaoSMS_Raw`에만 쌓이므로, 이 함수를 `KakaoSMS_Raw`
      (`AD.SPREADSHEET_ID` 내부)를 읽도록 리포인트하지 않으면 전환 시점부터 `Ad_Spend_Cache`→
      ACQ_REP Spent 집계가 조용히 멈춤. 구현 시 반드시 처리.
- [x] **비즈니스 토큰 발급/저장 코드 구현 완료(2026-08-04)** — `AD_006_KakaoMoments.js`(v1.0.0)
      신규: `doGet(e)`(리다이렉트 수신, `state` CSRF 검증 포함)/`exchangeKakaoMomentsAuthorizationCode_()`
      (토큰 교환)/`runGetKakaoMomentsAuthorizationUrl()`(인가 URL 생성·안내, 수동 실행)/
      `runDebugKakaoMomentsTokenInfo()`(토큰 진단, 수동 실행). Redirect URI는 Config에
      하드코딩하지 않고 `ScriptApp.getService().getUrl()`로 배포 시점에 자동 도출(닭·달걀 문제
      회피). `AD_001_Config.js`(v1.10.0)에 `AD.KAKAO_MOMENTS.OAUTH` 섹션(엔드포인트/스코프/
      Script Properties 키 이름) 추가. `appsscript.json`에 `webapp`(executeAs: USER_DEPLOYING,
      access: ANYONE_ANONYMOUS) 매니페스트 추가. Node 하네스로 `testBuildKakaoMomentsAuthorizeUrl()`
      PASS 확인. `node --check`/naming/version-header/중복선언 검사 통과, `clasp push` 완료.
- [x] **사용자가 웹 앱 배포 완료(2026-08-04)** — Deployment ID/URL 확보, 카카오디벨로퍼스에
      Redirect URI 등록 완료. Client Secret이 카카오 콘솔에 "카카오 로그인용"/"비즈니스 인증용"
      2개로 분리돼 있는 걸 사용자가 발견 — `PROPERTY_KEYS.CLIENT_SECRET`을
      `KAKAO_MOMENTS_CLIENT_SECRET_BIZAUTH`로 명확화(`AD_001_Config.js` v1.11.0).
- [x] **버그 발견·수정 — Redirect URI 불일치로 첫 시도 실패(2026-08-04)** — `runGetKakaoMomentsAuthorizationUrl()`
      을 편집기에서 직접 Run했더니 `ScriptApp.getService().getUrl()`이 실제 배포 `/exec` URL이
      아니라 카카오에 등록 안 된 `/dev` URL(도메인 경로도 다름)을 반환 — 카카오 동의까지는
      진행됐으나 리다이렉트 후 "Script function not found: doGet" 에러로 실패. 원인은 이 함수가
      `doGet()` 실행 컨텍스트 안에서만 정확하고 수동 Run에서는 신뢰 불가하다는 것(`docs/
      apps-script-gotchas.md` #10 신규 기록). **수정**: `AD.KAKAO_MOMENTS.OAUTH.REDIRECT_URI`
      (실제 배포 URL 하드코딩)로 전환(`AD_001_Config.js` v1.12.0, `AD_006_KakaoMoments.js`
      v1.1.0). `node --check`/naming/version-header/중복선언 검사 통과, `clasp push` 완료.
- [x] **버그 발견·수정 — 인가 요청 KOE233("지원하지 않는 파라미터로 비즈니스 인가 코드를 요청한
      경우") 실측(2026-08-04)** — Redirect URI가 정확히 일치했음에도 동의 화면 진입 전 카카오
      쪽에서 이 에러로 거부됨. 공식 에러코드 문서(`business-auth/trouble-shooting`) 확인 결과
      KOE233은 "지원하지 않는 파라미터" 문제 — `business-auth/rest-api`의 파라미터 표를 다시
      정밀 확인해 원인 특정: **scope에 `moment_create`가 포함되면 `resource_ids` 파라미터가
      조건부 필수**인데 우리 요청엔 이게 없었음. 게다가 문서에 "[카카오모먼트/키워드광고
      광고계정 생성] 동의항목 인가 요청 시 전체 광고계정만 요청 가능, `${ScopeGroup}:*` 형태로
      전달 필요"라고 명시돼 있어, 특정 광고계정 ID가 아니라 `moment:*` 와일드카드로 보내야 함.
      **수정**: `AD.KAKAO_MOMENTS.OAUTH.RESOURCE_IDS: ["moment:*"]` 신규(`AD_001_Config.js`
      v1.13.0), `buildKakaoMomentsAuthorizeUrl_()`에 `resourceIds` 매개변수 추가 — scope와
      달리 콤마로 합치지 않고 `resource_ids=` 파라미터를 값마다 반복(공식 문서 예시 형식 그대로,
      `AD_006_KakaoMoments.js` v1.2.0). Node 하네스로 `testBuildKakaoMomentsAuthorizeUrl()`
      재검증 PASS. `node --check`/naming/version-header/중복선언 검사 통과, `clasp push` 완료.
      사용자가 `runGetKakaoMomentsAuthorizationUrl()` 재실행 후 동의 화면 재시도 예정.
- [x] **버그 발견·수정 — 웹 앱 배포가 버전 1에 고정된 채 갱신 안 됨(2026-08-05)** — resource_ids
      수정(v1.2.0) 반영 후 동의 화면 재시도했으나 다시 `Script function not found: doGet` —
      10번 항목(`/dev` URL)과 다른 원인으로 판명. `npx clasp deployments` 확인 결과 콜백
      배포(`AKfycbwqJ08W...`)가 `@1`(버전 1 고정)이었고, v1.0.0 배포 이후 v1.1.0/v1.2.0
      `clasp push`는 HEAD만 갱신할 뿐 이 버전 고정 배포엔 반영 안 됐던 것 — `clasp push`가
      웹 앱 배포를 갱신하지 않는다는 사실을 실측으로 확인(`docs/apps-script-gotchas.md` #11
      신규 기록). **수정**: `npx clasp deploy -i AKfycbwqJ08W...`로 같은 배포 ID(URL 불변)를
      새 버전으로 갱신(`@1` → `@2`).
- [x] **비즈니스 토큰 발급 완료(2026-08-05, 사용자 확인)** — 배포 갱신 후 같은 인가 URL로
      재시도, 카카오 동의 화면 통과 → `doGet()` 콜백에서 "카카오모먼트 비즈니스 토큰 발급
      완료" 메시지 확인(scope: moment_management moment_bizform_result_read moment_create
      moment_delete — 승인된 4개 스코프 전부 포함). `doGet()` 코드상 이 메시지는 토큰 교환
      성공(`statusCode===200 && access_token` 존재) 이후에만 렌더링되고, 그 직전에
      Script Properties에 `ACCESS_TOKEN`을 저장하므로 별도 `runDebugKakaoMomentsTokenInfo()`
      실행 없이도 저장 완료로 판단.
- [x] **정확한 리포트 API 엔드포인트/파라미터 확정(2026-08-05, 공식 문서 확인)** — 캠페인
      보고서(`campaigns/report`)가 아니라 **메시지광고 전용 보고서**(`POST
      message-ads/reports`, `msg-ad-mgmt` 문서)를 쓰기로 확정 — 우리가 가져올 데이터가
      캠페인 단위가 아니라 개별 메시지광고 단위 성과이기 때문. `MESSAGE`/`MESSAGE_ADDITION`
      메트릭 그룹의 필드명도 확인: `msg_send`(발송)/`msg_open`(열람)/`msg_click`(전체
      클릭)/`msg_send_fail`(발송실패)/`cost`(비용) — **`Reach`(도달)/`Responsed`(응답)에
      정확히 대응하는 필드명은 문서 표에서 못 찾음, 실제 API 응답으로 확인 필요**(아래
      Surprises 참고). 이 리포트 호출엔 `messageAdIds`가 필수라 그 값을 얻기 위한 선행
      체인(광고계정 목록 → 채널 프로필 목록 → 메시지광고 목록)도 함께 필요함을 확인 —
      `AD_001_Config.js`(v1.14.0)에 4개 엔드포인트 전부 추가.
- [x] **진단 함수 체인 구현(2026-08-05)** — `AD_006_KakaoMoments.js`(v1.3.0) 신규:
      공용 IO 래퍼 `callKakaoMomentsApi_()` + `runDebugKakaoMomentsAdAccounts()`(광고계정
      목록)/`runDebugKakaoMomentsChannelProfiles()`(채널 프로필 목록, 광고계정 자동 체이닝)/
      `runDebugKakaoMomentsMessageAdsList()`(메시지광고 목록, 위 두 단계 자동 체이닝) —
      Naver Search 때(`runDebugNaverSearchAdStats()`)와 동일한 "직접 호출해서 앞 단계
      값을 자동으로 얻는" 체이닝 패턴. `node --check`/naming/version-header/중복선언 검사
      통과, `clasp push` 완료. **아직 실행 전** — 사용자가 순서대로 Run해서 실제
      adAccountId/channelProfileId/messageAdId 값과 메시지광고 목록 API의 정확한 요청
      body 스키마(문서에서 상세 미확인, 빈 body로 우선 호출해 에러로 확인하는 전략)를
      확인해야 다음 단계(`runDebugKakaoMomentsReportFirstRow()`) 구현 가능.
- [x] **실제 API 호출로 응답 필드명 검증 완료(2026-08-06)** — 2026-08-05 18:30 발송 예정이던
      `msg-ad-1534139723687342080`이 실제 발송 완료된 후 `runDebugKakaoMomentsReportFirstRow()`
      재실행 결과 실데이터 확보: `msg_send: 7039`(발송), `msg_open: 2406`(열람, 이후 재확인 시점엔
      2,935로 증가 — 실시간 집계), `msg_click: 44`(클릭), `msg_send_fail: 7`(발송실패),
      `cost: 105585`(비용, KRW). `msg_open_rate`(34.181%) = `msg_open/msg_send`로 계산됨을 확인.
      카카오 공식 문서(`type-info`)에도 `msg_send`가 "발송 시도"인지 "발송 성공"인지 명시 안 돼
      있어(WebFetch로 확인 시도했으나 문서 자체에 정의 없음) 필드 의미는 사용자 확인으로 확정.
- [x] **API 응답 → `KakaoSMS_Raw` 컬럼 매핑 확정(2026-08-06, 사용자 확인)** —
      `Sent` → `msg_send`, `Reach` → `msg_open`(사용자 확정: "발송수는 Sent, 열람이 Reach"),
      `Click` → `msg_click`, `Cost` → `cost`. `Push`는 레거시 컬럼으로 확인됨(사용자: "해당
      이벤트에서 메시지 발송 회차를 의미 — 예전에 회차별 신청율을 보려던 것, 지금은 불필요") —
      API 소스 없이 빈 값 유지(PIc와 동일 패턴). `Responsed`는 사용자 정의상 "클릭 이후의 별도
      전환 행동(랜딩 액션 등)"인데 이 API 응답엔 대응 필드가 없어 빈 값 유지. `CTR`/`CvR`은
      기존 정책(원본 수식값이라 비워둠) 그대로 유지. `msg_send_fail`(발송실패)은 기존 스키마에
      대응 컬럼이 없어 미사용(현재 범위 밖, 필요시 별도 컬럼 추가는 추후 논의).
      **`Responsed`/`CPL` 후속 확정(2026-08-06)** — 사용자가 "CPL = Cost/Responses"라고
      정의하면서 `Responsed`가 API에 없다는 결정과 충돌 발견 → 재조사 결과, 카카오모먼트
      대시보드의 "서비스신청 (7일)" 전환 지표가 `PIXEL_SDK_CONVERSION` 메트릭 그룹
      (`conv_signup_7d`/`cost_per_conv_signup_7d`, 공식 문서 확인)에 있음을 발견.
      `runDebugKakaoMomentsReportFirstRow()`의 metricsGroup에 추가해 재실행(`AD_006_KakaoMoments.js`
      v1.5.0) → 실측: `conv_signup_7d: 4`, `cost_per_conv_signup_7d: 26396.25` = `105585÷4`
      정확히 일치, CPL 공식과 부합 확인. **최종 확정**: `Responsed` → `conv_signup_7d`,
      `CPL` → `cost_per_conv_signup_7d`(API가 이미 계산해서 주는 값 그대로 사용 — 직접
      나눗셈하지 않음, 0 나눗셈 회피). 사용자가 대시보드에서 본 값(5)과 API 값(4)의 1건
      차이는 `msg_open`이 조회 시점마다 늘어난 것(2,406→2,935)과 동일한 실시간 집계 지연으로
      판단, 매핑 오류 아님.
      **여전히 미해결**: `Event type` 도출 방식(Business Segment 매핑 로직 필요 여부)은
      아직 미확인.
- [x] **`Event type` 도출 방식 확정(2026-08-06)** — `runDebugKakaoMomentsMessageAdsList()`
      실행 결과(사용자 확인) 실제 메시지광고 이름 3건 확보: `"KR_core_2026-08-12_grades-ecs-
      kakao_event-online"`(campaign 스타일, Marketo UTM Campaign과 동일한 `event-online`
      리터럴 포함), `"WB-2026-07-KOR-MOFU-Core EC for Each Year of High"`(detail 스타일,
      `getBusinessSegment()`가 `"wb-"` 신호를 `detail` 파라미터에서만 체크), `"tese_2608041106"`
      (삭제된 테스트 메시지, 무관). **발견**: 두 실제 메시지가 서로 다른 명명 규칙을 써서
      Meta처럼 `getBusinessSegment(name)`(campaign 인자 하나만) 방식으로는 "WB-" 메시지가
      Other로 잘못 분류됨(내용 확인 결과 둘 다 실제로는 웨비나 공지 메시지, 사용자 확인).
      **최종 확정(사용자 결정)**: `getBusinessSegment(name, name)` — 같은 메시지광고 이름을
      `campaign`/`detail` 두 인자에 동일하게 전달, 두 스타일의 신호(`campaign`의
      `event-online`, `detail`의 `wb-`) 모두 적용되게 함. 부수효과(예: BOFU/Search 등
      detail 전용 규칙도 같이 적용됨)는 사용자 확인 하에 감수하기로 함 — Kakao Channel처럼
      별도 매핑 로직은 만들지 않음(기존 함수 그대로 재사용).
      **최종 확정 매핑 요약**: `Sent`→`msg_send`, `Reach`→`msg_open`, `Click`→`msg_click`,
      `Cost`→`cost`, `Responsed`→`conv_signup_7d`, `CPL`→`cost_per_conv_signup_7d`,
      `Push`→소스 없음(레거시, 빈 값), `CTR`/`CvR`→기존 정책 유지(빈 값).
- [x] **구현 완료(2026-08-06), 실행 검증 대기(TODO)** — `AD_006_KakaoMoments.js`(v1.6.0)에
      `syncKakaoMomentsReportToKakaoSMSRaw_()`/`runSyncKakaoMomentsReportToKakaoSMSRaw()` 신규:
      진단 체인(광고계정→채널 프로필→메시지광고 목록→리포트, `fetchKakaoMomentsAdAccountAndChannelProfile_()`
      로 공용화, 실패 시 에러 throw)을 재사용해 발송 완료 메시지(metrics≠null)만
      `computeKakaoMomentsSyncRow_()`(순수 함수, 확정 매핑 그대로 적용)로 행 계산 →
      `mergeKakaoMomentsSyncRows_()`(순수 함수)로 `Message Ad ID` 키 upsert. 업서트가
      필요한 이유(사용자 확인, 2026-08-06): 발송 후에도 msg_open/conv_signup_7d가 최대
      7일까지 계속 늘어나 append-only(기존 Kakao Channel 패턴)로는 스냅샷이 영구 고정돼
      과소평가됨. `AD_001_Config.js`(v1.17.0) `SYNC_COLUMNS` 맨 앞에 숨김 `"Message Ad ID"`
      컬럼 추가(upsert 매칭 키, 기존 시트 구조 변경 — 사용자 승인 받음). 테스트 4개
      (`testParseKakaoMomentsSendingDate`/`testComputeKakaoMomentsSyncRow`/
      `testMergeKakaoMomentsSyncRows`) 추가, 2026-08-05 실측 응답값으로 검증. `node --check`/
      naming/version-header/중복선언 검사 통과, `clasp push` 완료. **아직 실행 전** —
      사용자가 `runSyncKakaoMomentsReportToKakaoSMSRaw()`를 Apps Script 편집기에서 직접
      Run해서 `KakaoSMS_Raw`에 실제로 행이 채워지는지, 값이 맞는지 확인 필요.
- [x] **`computeKakaoChannelSpendSummary_()`를 `KakaoSMS_Raw` 소스로 리포인트 완료(2026-08-06)** —
      `AD_005_KakaoChannel.js`(v1.2.0) 신규 `readKakaoSMSRawRows_()`(AD.SPREADSHEET_ID 내부
      읽기, 외부 스프레드시트 아니라 타임존 보정 불필요)로 교체. 기존 `readKakaoChannelRawRows_()`
      (외부 수기 Performance 시트 리더)는 삭제하지 않고 유지(`syncKakaoChannelPerformanceToAD_()`/
      진단 함수가 계속 참조, Decision Log상 그 함수 자체를 더 이상 실행 안 하는 것으로 전환
      완료 처리). **아직 실행 전** — `runRefreshAdSpendCache()` 재실행 후 Ad_Spend_Cache/
      ACQ_REP Spent 집계가 KakaoSMS_Raw 기준으로 정상 반영되는지 확인 필요(위 sync 함수를
      먼저 실행해서 KakaoSMS_Raw에 데이터가 있어야 의미 있는 검증 가능).
- [x] `AD.PLATFORMS`/`AD.RAW_SHEET` 등 Config 갱신, 테스트 함수 작성 (TDD 원칙 준수) — 완료,
      위 두 항목 참고. `AD.PLATFORMS`/`AD.RAW_SHEET`는 이미 "Kakao Moments"/"Kakao Channel"
      키로 등록돼 있어 추가 변경 불필요했음(2026-08-04 확인 사항 재확인).

## Surprises & Discoveries

- **선행 exec-plan과의 정면 충돌(2026-08-04)** — 2026-07-31에 "카카오모먼트 이관 시 기존
  Kakao Channel 시트/파이프라인 완전 폐기, 새 시트로 이관"이라고 명확히 기록해뒀는데, 이후
  claude.ai 세션(2026-08-04)에서 정반대로 "기존 시트 재활용"으로 재확정됨. 두 기록 모두
  "사용자 확인"으로 남아있어 시간 순서(더 최신 확인이 우선)로 판단, 재확인 질문으로 최종
  해소. **교훈**: 여러 세션(특히 claude.ai 채팅과 Claude Code 세션을 오갈 때)에 걸친 설계
  변경은 이전 exec-plan과 자동으로 대조되지 않으므로, 새 설계 착수 시 관련 선행 문서를 먼저
  읽고 충돌 여부를 명시적으로 확인하는 절차가 유효했음.
- **연쇄 영향 조사 중 발견(2026-08-04)** — 핸드오프 문서에는 없었으나, `AD_004_SpendCache.js`가
  `computeKakaoChannelSpendSummary_()`를 통해 외부 수기 시트를 직접 읽는 연결점이 있어, 이걸
  놓치면 API 전환 후 지출 집계가 조용히 멈추는 문제가 있었음.
- **`clasp push`가 버전 고정 웹 앱 배포를 갱신하지 않음(2026-08-05, 실측)** — 10번 항목
  (`/dev` URL 버그)을 고쳤다고 생각했는데 같은 에러(`Script function not found: doGet`)가
  재발해서 조사하다 발견. `clasp push`는 HEAD만 갱신하고, 이미 만들어진 웹 앱 배포는
  배포 시점 버전에 고정돼 있어(`clasp deployments`로 `@1` 확인) 이후 push들이 전혀 반영
  안 되고 있었음. `clasp deploy -i <deploymentId>`로 그 배포를 새 버전으로 갱신해야
  한다는 걸 몰랐던 게 원인 — `docs/apps-script-gotchas.md` #11 신규 기록. **교훈**: `doGet`/
  `doPost` 등 웹 앱 진입점 코드를 수정할 때마다, `clasp push` 후에 그 배포가 `@HEAD`가
  아니라 버전 고정이라면 `clasp deploy -i`도 같이 실행해야 함을 앞으로 체크리스트화할 것.
- **비즈니스 토큰엔 Refresh Token이 없음(2026-08-04, 공식 문서로 확인)** — `business-auth/rest-api`/
  `business-auth/common` 문서 확인 결과, 비즈니스 토큰 발급 응답엔 `access_token`/`token_type`/
  `scope`만 있고 `refresh_token`/`expires_in` 필드 자체가 없음. 토큰은 매번 인가 코드로 새로
  발급하는 방식이고 "장기 미사용 시 자동 만료"(정확한 기간 미명시) — 일반 카카오 로그인(Refresh
  Token 있음)과 다른 부분이라 실제로 조회하기 전까진 예상 못한 차이. 이전 세션(claude.ai)에서
  세운 "Time-driven Trigger로 Refresh Token 갱신" 계획이 이 발견으로 무효화됨 — Decision Log 참고.

- **`Message Ad ID` 컬럼 추가 후 기존 KakaoSMS_Raw 데이터가 한 칸씩 밀린 사고 발견·복구
  (2026-08-06)** — `AD_001_Config.js` v1.17.0에서 `SYNC_COLUMNS` 맨 앞에 `Message Ad ID`를
  추가했는데, 시트 생성 로직(`syncKakaoChannelPerformanceToAD_()`/
  `syncKakaoMomentsReportToKakaoSMSRaw_()` 둘 다)이 `!destSheet`(시트가 아직 없을 때)에만
  헤더를 다시 쓰는 구조라, 이미 존재하던 291행짜리 KakaoSMS_Raw 시트는 헤더/데이터가 옛
  17컬럼 레이아웃 그대로 남아있었음. 그 상태에서 사용자가 `runSyncKakaoChannelPerformanceToAD()`
  로 신규 2행을 추가하자 그 2행만 새 18컬럼 레이아웃(A열=Message Ad ID)으로 써져서, 같은
  시트 안에 두 레이아웃이 섞이는 사고 발생 — **Config(스키마)만 바꾸고 이미 존재하는 시트의
  실제 헤더/데이터는 자동으로 안 바뀐다는 걸 놓친 것**(교훈: 기존 시트 구조를 바꾸는 Config
  변경은 "새 시트 생성 시에만 적용"이 아니라 기존 시트 마이그레이션도 같이 고려해야 함).
  **복구**: `runRepairKakaoSMSRawColumnAlignment()`(1회성) — 처음엔 "A열이 숫자면 옛
  레이아웃"으로 판별했으나 293행 중 290행만 이동, 1행(시트 267행) 누락 발견 —
  `runFindKakaoSMSRawFYColumnAnomalies()`로 원인 특정: 그 행은 원본 FY 자체가 공란이라
  숫자 판별을 통과 못 했던 것. 판별 조건에 "B열이 알려진 Event type 문자열"도 OR로 추가해
  재실행, 293행 전부 정렬 완료 확인(`runFindKakaoSMSRawFYColumnAnomalies()` "이상 행 없음").
  진단/복구 함수 5개(`runDebugKakaoSMSRawColumnAlignment`/`runRepairKakaoSMSRawColumnAlignment`/
  `runFindUnrepairedKakaoSMSRawRows`/`runFindKakaoSMSRawEventTypeAnomalies`/
  `runFindKakaoSMSRawFYColumnAnomalies`)는 1회성 TEMP로 파일에 남아있음(재사용 목적 아님).

- **`Marketo program` = 메시지광고 이름 그대로 저장(2026-08-06) — 향후 Events_OPS Cost 연동의
  전제만 마련, 자동 반영은 아직 아님** — 사용자 질문("메시지광고이름 그대로 사용하면 나중에
  Event_OPS에 cost반영 가능해?")에 조사 후 답변: 지금 캡처된 메시지명 중 "WB-2026-07-KOR-MOFU-
  Core EC for Each Year of High"는 `51_Events_Engine.js`의 `isEligibleEventProgram_()`
  (WB-/EV- Marketo Program 명명 전제)와 형식이 맞지만, **사용자 확인 결과 이건 예외/레거시
  값이고 앞으로는 50자 제목 제한 때문에 UTM 스타일("KR_core_...")로 통일될 예정** — 즉 향후
  메시지명은 Events_Engine의 Program명 매칭 로직과 형식이 안 맞음. 나중에 Events_OPS Cost
  연동을 만들 땐 `isEligibleEventProgram_()` 방식이 아니라 Meta 때 쓴
  `getBusinessSegment(campaignName)` 방식(UTM 스타일 매칭)에 더 가까운 새 로직이 필요할 것.
  현재 `Events_OPS`의 `Spent` 컬럼 자체는 이미 존재하나(`50_Events_Config.js`) 채워주는
  자동화가 없는 상태(Search_OPS가 Naver 자동화되기 전과 동일 상태) — 이 작업은 오늘 범위
  밖, 별도 착수 필요.

- **시트 스타일링 + 리포팅 지연 폴백 추가(2026-08-06, 사용자 요청)** — `applyKakaoSMSRawStyling_()`
  신규(`AD_006_KakaoMoments.js`): I:M열(Sent/Reach/Click/Responsed/Cost)/P열(CPL) 천단위
  콤마+정수 표시, N/O열(CTR/CvR)을 값 대신 수식(Click÷Reach, Responsed÷Click, "0.0%" 표시,
  0 나누기 방지)으로 채움, SentAt 기준 내림차순 정렬(최신이 맨 위 — 정렬을 수식 생성보다
  먼저 해야 수식의 행 번호 참조가 안 꼬임), 전체 데이터 범위 테두리. 두 sync 함수(API/수기)
  끝에서 모두 호출해 어느 경로로 갱신되든 일관 유지. `computeKakaoMomentsSyncRow_()`도
  추가 수정: FY를 숫자로 통일(기존 수기 행과 형식 통일), `Marketo program`=메시지광고 이름,
  `Keyword`=메시지 본문(mainTitle) 앞 30자(줄바꿈은 공백 치환 후 자름 — 셀이 여러 줄로
  안 보이게). **리포팅 지연 폴백**: message-ads/reports(전환 지표 포함)가 발송 직후엔 빈
  응답을 주는 현상이 8/5·8/6 메시지 둘 다에서 재현됨 — message-ads/list 응답에 이미 있는
  messageAd.metrics(cost/msg_send/msg_click/msg_open, 전환 지표는 없음)로 Sent/Reach/
  Click/Cost는 즉시 채우고 Responsed/CPL만 리포트 전용이라 계속 빈 값으로 남김(다음 sync
  재실행 시 리포트가 채워지면 자동 반영). **참고**: `Marketo program`에 메시지 이름을 그대로
  쓰는 게 나중에 Events_OPS Cost 연동에 도움되는지 사용자가 질문 — 지금 캡처된 "WB-..." 이름은
  레거시 예외이고 앞으로는 50자 제한 때문에 UTM 스타일("KR_core_...")로 통일될 예정이라는 걸
  사용자가 확인(위 항목 참고).

## Decision Log

- **`KakaoSMS_Raw` 재활용(폐기 아님)** — 2026-08-04, 사용자 확정(재확인 질문으로 최종화).
  이유: "재사용/재활용" 방향이 스키마 변경/마이그레이션 비용 없이 기존 뷰·데이터를 그대로
  이어갈 수 있어 선택. 선행 exec-plan의 "완전 폐기" 기록은 이 결정으로 대체됨(선행 문서 자체는
  수정하지 않음, ExecPlanConvention.md 원칙).
- **`AD.RAW_SHEET["Kakao Channel"]` 키 유지, 리네이밍 안 함** — 2026-08-04, Claude Code 제안 채택.
  이유: 다른 코드가 이 문자열 키를 참조할 수 있어 이름 변경은 이득 대비 리스크만 늘림.
- ~~토큰 자동 갱신 — Time-driven Trigger 사용~~ — 2026-08-04, 사용자 확정 → **같은 날 정정**:
  공식 문서 확인 결과 비즈니스 토큰엔 Refresh Token이 없어(Surprises 참고) 애초에 회전시킬
  대상이 없음. **최종 결정**: 자동 갱신은 포기하고, 캠페인 지출 자동 파이프라인
  (`08_PipelineAsync.js` `refreshCampaignSpend_()`)이 이 토큰을 주기적으로 실사용하는 것 자체로
  "장기 미사용 만료"를 회피 — 만료/철회 시엔 사용자가 `runGetKakaoMomentsAuthorizationUrl()`로
  다시 동의 화면을 통과해야 하며, 실패 시 조용히 넘어가지 않고 명확한 에러로 알림(Naver Search
  때와 동일 원칙). 사용자 확정.
- **전환(cutover) — 코드 가드 없이 운영 규칙으로만 처리** — 2026-08-04, Claude Code 제안 채택.
  이유: 기존 수기 동기화 함수(`syncKakaoChannelPerformanceToAD_()`)가 애초에 시간 트리거 없는
  수동 실행 전용이라, "API 전환 후 그 함수를 그냥 안 돌린다"는 운영 규칙만으로 충분 — 별도
  분기/가드 코드는 불필요한 복잡성.

## Outcomes & Retrospective

(작업 완료 시 작성)
