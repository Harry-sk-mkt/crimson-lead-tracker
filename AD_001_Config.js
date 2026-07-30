/**
 * ==========================================================
 * Marketing 2.0
 * Ad Spend Config
 *
 * Responsibility
 * 캠페인 지출(Ad Spend) 통합 파이프라인의 전역 설정. 00_Config.js 중앙화
 * 원칙의 기존 예외를 그대로 따름(20_OPS_Config.js/50_Events_Config.js와
 * 동일 관행 — 별도 도메인 config 파일).
 *
 * 원본 데이터는 메인 스프레드시트가 아니라 별도 Google Sheet
 * (SPREADSHEET_ID)에 있음 — Deal Tracker와 동일하게
 * `SpreadsheetApp.openById()`로 크로스 스프레드시트 접근.
 *
 * 설계 문서
 * docs/Roadmap.md End Goal Phase 1, docs/exec-plans/active/2026-07-30-campaign-spend-integration.md
 *
 * Stage
 * AD (신규 — 2026-07-30 네이밍 컨벤션 변경 예정에 맞춰 이 스테이지부터
 * `AD_NNN_Name.js` 형식으로 시작. 기존 00~99 파일은 당장 안 바꿈, 전체
 * 재정비는 별도 세션 예정.)
 *
 * Version
 * v1.2.0
 *
 * Change Log
 * v1.2.0 (2026-07-30)
 * - `META.COLUMNS` 전면 정정 — 처음엔 사용자가 채팅으로 옮겨 적어준 한국어
 *   헤더 샘플을 그대로 썼으나, 실제 Meta_Raw에 붙여넣은 라이브 export는
 *   **영어 헤더**였음(계정별 UI 언어 설정 차이로 추정, `runDebugMetaRawFirstRow()`
 *   진단으로 확인). 또한 캠페인 자체의 종료일은 원래 export 불가능한
 *   필드였고(Reporting starts/ends는 리포트 조회 기간일 뿐 캠페인 종료일이
 *   아님), 사용자가 별도로 "Ends" 컬럼을 찾아 추가 추출하면서 해결 —
 *   `CAMPAIGN_START`도 "시작"이 아니라 "Date created"가 실제 필드명.
 *   이번 라운드에 KR 외 국가 캠페인(예: IN_core_...)도 잘못 섞여 들어온
 *   것을 발견해 재추출로 해소(Config엔 영향 없음, 데이터 자체 문제였음).
 * v1.1.0 (2026-07-30)
 * - `META.ACTIVE_ACCOUNT_ID` 추가 — Meta는 계정을 이관해서 총 3개 Account
 *   ID가 export에 찍히는데, 그중 현재 사용 중인 계정 1개만 명시하고
 *   나머지(예전 계정, 전부 영구 종료)는 "그 외 전부"로 판별(사용자 확정,
 *   2026-07-30). 활성 계정 = 월별 정확 Spent, 그 외 = 캠페인 lifetime
 *   합계를 활성 기간에 균등분배 — 처리 방식은 AD_002_Meta.js(예정)에서 구현.
 * v1.0.0 (2026-07-30)
 * - 최초 구현. 파일럿 플랫폼 Meta 컬럼 매핑만 구현, 나머지 7개 플랫폼은
 *   PLATFORMS 목록에만 존재(파일럿 검증 후 확장 예정).
 * ==========================================================
 */

const AD = {

  /*
  ==========================================================
  SPREADSHEET
  캠페인 지출 전용 별도 Google Sheet — 메인 스프레드시트(무거움)에 안
  얹기로 확정(2026-07-30 사용자 확정).
  ==========================================================
  */

  SPREADSHEET_ID: "1zOZGwnsm0GhLGGe5rATu8jR5WxAQVx7YmmiPZVU88jY",

  /*
  ==========================================================
  PLATFORMS
  대상 광고 플랫폼 8개(사용자 확정, 2026-07-30). 플랫폼마다 export 가능한
  데이터/캠페인 naming 규칙이 다름 — Meta부터 파일럿으로 검증 후 확장.
  ==========================================================
  */

  PLATFORMS: [
    "Meta",
    "Naver Search",
    "Naver GFA",
    "Google Search",
    "Google Display",
    "Naver Offline Cafe",
    "Kakao Moments",
    "Kakao Channel"
  ],

  /*
  ==========================================================
  RAW SHEETS
  플랫폼당 탭 1개, 계속 append(Leads_Raw/MTA_Raw와 동일 패턴 — 월별 탭
  아님, 2026-07-30 사용자 확정). 지금은 파일럿 Meta만 실제로 생성.
  ==========================================================
  */

  RAW_SHEET: {
    Meta: "Meta_Raw"
  },

  /*
  ==========================================================
  META — Ads Manager Export 컬럼 매핑 (실 라이브 export로 검증 완료, 2026-07-30
  — 처음엔 사용자가 옮겨 적어준 한국어 샘플을 썼으나 실제는 영어 헤더였음,
  runDebugMetaRawFirstRow() 진단으로 정정. 실제 헤더는 이 외에도 Impressions/
  Reach/CTR 등이 있으나, CPNP1 계산에 필요한 컬럼만 매핑)
  ==========================================================
  */

  META: {

    COLUMNS: {
      REPORT_START: "Reporting starts",
      REPORT_END: "Reporting ends",
      CAMPAIGN_NAME: "Campaign name",
      CAMPAIGN_START: "Date created",
      CAMPAIGN_END: "Ends",
      SPENT: "Amount spent (NZD)",
      ACCOUNT_ID: "Account ID"
    },

    /*
    ==========================================================
    ACTIVE ACCOUNT (2026-07-30 사용자 확정)
    Meta는 계정 이관 이력이 있어 export에 Account ID가 총 3개 찍힘 — 이
    값과 일치하는 행만 "현재 사용 중 계정"(월별 export로 정확한 월별
    Spent 추적 대상), 그 외 값은 전부 "예전 계정"(영구 종료, lifetime
    합계를 활성 기간에 균등분배 대상)으로 판별.
    ==========================================================
    */

    ACTIVE_ACCOUNT_ID: "2954404598150809"

  }

};
