/**
 * ==========================================================
 * Marketing 2.0
 * JL Config — Korea Sales & Marketing Monthly Metrics Export
 *
 * Responsibility
 * ACQ_REP/Ad_Spend_Cache/Deal Tracker에서 계산한 월별 실적을 외부
 * 스프레드시트("[FY27] Korea Sales and Marketing Monthly Metrics",
 * 사용자가 Josephine/Junyong/Simon과 공유 중인 시트)의 고정 셀 범위에
 * 매일 자동으로 채워 넣는 신규 기능("JL" 스테이지)의 설정.
 *
 * WHY 이 시트를 별도 스테이지로 분리했는지
 * ACQ_REP/NewP1_REP/Target_REP/S&M_REP/FY_REP(CLAUDE.md Reporting Layer
 * 원칙)과 달리, 이 기능은 "FY 선택 + Generate 체크박스"로 우리 스프레드시트
 * 안의 화면을 재작성하는 게 아니라, 이미 계산된 값을 완전히 다른(우리가
 * 소유하지 않은, 이해관계자와 공유 중인) 외부 스프레드시트의 고정 셀에
 * 써넣는 단방향 export다. 그래서 STATUS_COLUMNS/Generate 체크박스 같은
 * 기존 Reporting Layer 장치를 그대로 흉내내지 않고, `SEARCH`/`BOFU`/`AD`
 * 등 도메인별 독립 config 파일 관행을 따라 별도 전역 상수(`JL`)로 둔다
 * (2026-09-01 사용자 확정 — "이 폴더(crimson-lead-tracker)에서 GAS 생성이
 * 관리에 편하다"는 판단으로, 완전히 새 Apps Script 프로젝트를 만드는 대신
 * 이 프로젝트 안에 openById()로 외부 시트에 쓰는 기존 Target_REP/FY_REP
 * 패턴을 그대로 재사용).
 *
 * 지표 매핑 근거 (2026-09-01 실측 대조 — 외부 시트 Aug-26 실측값과
 * ACQ_REP/Deal Tracker 값을 비교해 확정, 라이브 시트 직접 접근은 계정
 * 권한 문제로 불가해 값 역산으로 검증):
 * - Monthly Sales Achieved(21행)/No of MQLs(22행)/No of SALs(23행)/
 *   No of ICs Completed(24행) = ACQ_REP 7개 세그먼트(CONFIG.ACQ.SEGMENTS)
 *   전체 합의 Revenue/New P1/SAL/IC Complete (ACQ_Summary 그대로).
 * - Marketing Spend(25행) = Ad_Spend_Cache(Meta+Naver Search+Kakao 합산,
 *   ACQ_REP W열과 동일 소스) 전 세그먼트 합.
 * - No of New Accounts Won(26행)/Referral Accounts Won(44행) = Deal
 *   Tracker 캐시(TARGET_001_Engine.js readDealTrackerRawRows_())에서 그 달
 *   Close된 딜 건수(사용자 확정 — "#deals는 deal tracker에서 count"),
 *   Upsell(LEAD_SOURCE에 "upsell" 포함)은 신규 계정이 아니므로 제외.
 * - Referral(42~44행)/Non-Referral(49~50행) 구분 = Business Segment
 *   "Referral" 여부. Non-Referral은 Referral도 Other(Upsell 포함 버킷)도
 *   아닌 5개 핵심 마케팅 세그먼트(Seminar/Webinar/BOFU/Search/Content) —
 *   `deriveTargetGroup_()`(TARGET_001_Engine.js, CONFIG.TARGET.SEGMENT_GROUPS)를
 *   그대로 재사용해 이 5개 판정을 이중 정의하지 않는다. Aug-26 실측으로
 *   교차검증: IC Complete 36 = Referral 2 + Non-Referral 34(정확히 일치,
 *   Other 세그먼트 IC Complete는 0으로 추정) / Revenue 1,661,223.62 =
 *   Referral 34,474.21 + Non-Referral 314,071.77 + 나머지(~1,312,677.64,
 *   Other=Upsell·미분류 버킷으로 추정, 별도 검증 전까지 이 파일 밖에서
 *   확인 필요 — `runVerifyJLAugustActuals()` 참고).
 *
 * ⚠️ 자동 쓰기는 아직 주기적 트리거에 연결하지 않음(2026-09-01) — 외부
 * 이해관계자 공유 시트에 검증 안 된 값을 자동으로 덮어쓰는 위험을 피하기
 * 위해, `runVerifyJLAugustActuals()`로 이미 알려진 Aug-26 실측값과
 * 대조 확인 후 `MASTER_002_PipelineAsync.js`의 `periodicRefreshAllReports_()`에
 * 편입하기로 함(JL_003_Write.js 파일 헤더 참고).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-09-01)
 * - 최초 구현.
 * ==========================================================
 */

const JL = {

  /*
  ==========================================================
  EXTERNAL SHEET — "[FY27] Korea Sales and Marketing Monthly Metrics"

  탭 이름이 아니라 gid(시트 ID)로 찾는다 — 사용자가 탭 이름을 바꿔도
  안전(다른 탭도 "Josephine"/"Junyong"/"Simon"처럼 사람 이름이라 이름
  매칭은 애초에 안정적이지 않음).
  ==========================================================
  */
  EXTERNAL: {
    SPREADSHEET_ID: "162jGFTHM9wUSl86_MtgbU4T4ezG0lwpxn7qtoJNsBfA",
    SHEET_GID: 316435961
  },

  /*
  ==========================================================
  ROWS — 이 시트에 실측값을 채워야 하는 셀 범위(사용자 지정,
  B21:M26 / B42:M44 / B49:M50). 라벨 텍스트는 실 시트에서 확인한 그대로
  주석에 남김(코드가 라벨을 읽어서 검증하진 않음 — 행 번호가 바뀌면
  사용자가 여기 상수를 직접 갱신해야 함, No Assumptions 원칙).
  ==========================================================
  */
  ROWS: {

    MONTH_HEADER: 19,           // "Months" 행 — B19:M19 = Aug-26 ... Jul-27

    SALES_ACHIEVED: 21,         // "Monthly Sales Achieved"        ← Revenue (7세그먼트 합)
    MQL: 22,                    // "No of MQLs"                    ← New P1 (7세그먼트 합)
    SAL: 23,                    // "No of SALs"                    ← SAL (7세그먼트 합)
    IC_COMPLETE: 24,            // "No of ICs Completed"           ← IC Complete (7세그먼트 합)
    MARKETING_SPEND: 25,        // "Marketing Spend"                ← Ad_Spend_Cache 합
    NEW_ACCOUNTS_WON: 26,       // "No of New Accounts Won"        ← Deal Tracker 건수(Upsell 제외)

    REFERRAL_IC_COMPLETE: 42,   // "No of Referral ICs (Complete)"
    REFERRAL_REVENUE: 43,       // "Amount of Referral Revenue"
    REFERRAL_ACCOUNTS_WON: 44,  // "Referral Accounts Won"

    NONREFERRAL_IC_COMPLETE: 49, // "No of Non-Referral ICs (Complete)"
    NONREFERRAL_REVENUE: 50      // "Amount of Non-Referral Revenue"

  },

  MONTH_START_COL: 2,  // B열
  MONTH_COUNT: 12

};
