/**
 * ==========================================================
 * Marketing 2.0
 * Configuration
 *
 * Responsibility
 * Central configuration for the entire project.
 *
 * Business logic MUST NOT exist here.
 *
 * Version
 * v1.12.0
 *
 * Change Log
 * v1.12.0 (2026-07-27)
 * - CONFIG.TARGET.ENGINE.BLOCK_C_COLUMNS 2→6(딜비중+New/Pipeline 2트랙 FY
 *   목표), BLOCK_D_START_COL 24→28(X열→AB열, Block C 확장에 따른 이동) —
 *   New/Pipeline 2트랙 FY P1 목표 공식 확정(CLAUDE.md #7 최종 결정),
 *   90_TargetEngine.js 참고.
 * v1.11.0 (2026-07-27)
 * - CONFIG.TARGET.EXTERNAL.DEAL_TRACKER.COLUMNS에 CONTENT_CATEGORY(H열) 추가,
 *   CONTENT_CATEGORY_GROUP_MAP 신규 — classifyDealSegment_()(90_TargetEngine.js)가
 *   더 이상 Lead Source Detail 퍼지 키워드 매칭(getBusinessSegment())이 아니라
 *   이 컬럼을 직접 매핑하도록 전환(사용자 확정). Lead Source Detail이 공란인
 *   딜이 "Other"로 오분류되던 문제 발견 후 수정 — 상세: CLAUDE.md #13.
 * v1.10.0 (2026-07-27)
 * - CONFIG.TARGET.ENGINE Block B를 4컬럼→7컬럼으로 확장(코호트1 CurrentFYP1V/
 *   코호트2 PrevP1V 분리 표시), Block C/D 시작 컬럼 뒤로 이동(U열/X열).
 * v1.9.0 (2026-07-27)
 * - CONFIG.TARGET.EXTERNAL.DEAL_TRACKER.MEDIAN_FYS 제거 — 딜 비중을 3FY
 *   median에서 FY26 단일 코호트(CONFIG.TARGET.P1_VALUE_FY 재사용) 기준으로
 *   변경(사용자 확정: median이 최근 연도 실제 구성비와 10%p 이상 괴리).
 * v1.8.0 (2026-07-27)
 * - CONFIG.TARGET.EXTERNAL.DEAL_TRACKER 전면 재작성 — Student/Guardian Email/
 *   Account Name 기반 Leads_OPS 매칭 아키텍처 폐기(Sales팀 확인: 상담 후
 *   이메일 덮어쓰기로 시스템적 복구 불가). Deal Tracker를 Source of Truth로
 *   삼아 원래 시트(gid 498663095)로 복귀, 딜 자체의 Lead Source/Source
 *   Category/Lead Source Detail로 직접 세그먼트 분류. P1 판정 제거(사용자
 *   확인: 99%가 P1). 상세: CLAUDE.md #7.
 * v1.7.0 (2026-07-27)
 * - CONFIG.TARGET.EXTERNAL.DEAL_TRACKER.COLUMNS에 MKT_UTM_CAMPAIGN/
 *   FIRST_TOUCH_DETAIL/LEAD_SOURCE_CATEGORY 추가 — Student/Guardian/Account
 *   Name 전부 실패한 딜을 위한 4차 "고스트" 분류(getBusinessSegment() 재사용,
 *   Leads_OPS 매칭 없이 딜 자체의 UTM/터치 필드로 직접 세그먼트 분류).
 * v1.6.0 (2026-07-27)
 * - CONFIG.TARGET.EXTERNAL.DEAL_TRACKER.COLUMNS에 ACCOUNT_NAME 추가 — Student/
 *   Guardian Email 둘 다 실패할 때(Lead Merge로 원본 이메일 자체가 소실된
 *   케이스) 3차 매칭 후보로 Account Name(Leads_OPS."Company / Account"와 매칭).
 * v1.5.0 (2026-07-27)
 * - CONFIG.TARGET.EXTERNAL.DEAL_TRACKER 전면 교체 — 딜트래커 시트를 FY24~26
 *   기준으로 새로 재구축(신규 스프레드시트 ID, gid 0). FY 컬럼 없음(Close Date
 *   에서 파생), Source/Opp Email → Student Contact Email/Primary Guardian
 *   Email로 명확화(근본 원인 규명 후 정정), Stage 필터/대소문자 무시 Lead
 *   Source 비교 추가.
 * v1.4.0 (2026-07-27)
 * - CONFIG.TARGET.EXTERNAL.DEAL_TRACKER.COLUMNS 갱신 — 사용자가 딜트래커에
 *   "Opp Email"/"Revenue KRW" 컬럼 추가(Revenue (NZD)는 이제 A1 환율 기준
 *   수식값)하며 컬럼 위치 전체 이동. OPP_EMAIL(2차 매칭 후보) 추가.
 * v1.3.0 (2026-07-27)
 * - CONFIG.TARGET.EXTERNAL.DEAL_TRACKER 추가 — Block C(딜 비중)를 균등 분할
 *   placeholder(33%씩) 대신 실제 Deal Tracker 데이터(FY24·25·26, Upsell/
 *   Referral 제외, Source email로 Leads_OPS 매칭)로 계산하도록 전환.
 * v1.2.0 (2026-07-27)
 * - CONFIG.TARGET.REPORT.ROWS 단순화: CONTROL_HEADER/CONTROL_VALUE/PARAM_SUMMARY
 *   제거, REPORT_HEADER=2/REPORT_DATA_START=3로 축소 (Target_REP Control 영역
 *   전체 삭제 — 사용자 요청, 91_TargetReport.js 참고). COLUMNS.GENERATE도 제거.
 * v1.1.0 (2026-07-27)
 * - CONFIG.TARGET 추가 (Target_REP 구현 착수, docs/TargetReportDesign.md 참고).
 * ==========================================================
 */

const CONFIG = {

  /**
   * Spreadsheet
   */
  SPREADSHEET: SpreadsheetApp.getActiveSpreadsheet(),

  /**
   * Sheet Names
   */
  SHEETS: {

    // Raw
    LEADS_RAW: "Leads_Raw",
    MTA_RAW: "MTA_Raw",

    // Master
    LEADS_MASTER: "Leads_Master",
    MTA_MASTER: "MTA_Master"

  },

  /**
     * Required Fields (Validation)
     *
     * 비어있으면 안 되는 컬럼 목록.
     * Import Type별로 관리.
     */
    REQUIRED_FIELDS: {

      LEADS: [
        "Lead ID",
        "Email",
        "Create Date",
        "Company / Account"
      ],

      MTA: [
        "Lead: Lead ID",
        "Lead: Email",
        "Multi Touch Attribution: Created Date"
      ]

  },

  /**
   * Raw Date Columns
   *
   * CSV 원본 텍스트 그대로 보존해야 하는 컬럼.
   * Raw 쓰기 시 Plain Text 서식 강제 대상.
   */
  RAW_DATE_COLUMNS: {

    LEADS: [
      "Create Date",
      "IC Booked Date",
      "IC Completed Date (Pre-Conversion)",
      "Opportunity Won Date"
    ],

    MTA: [
      "Multi Touch Attribution: Created Date",
      "Lead Created Date",
      "Lead: IC Booked Date",
      "Lead: IC Completed Date (Pre-Conversion)",
      "Lead: Opportunity Won Date"
    ]

  },

  /**
   * Script Properties Keys
   *
   * Incremental Build가 "어디까지 처리했는지" 추적하는 데 사용.
   */
  PROPERTIES: {

    LEADS_LAST_ROW: "LEADS_LAST_PROCESSED_ROW",
    MTA_LAST_ROW: "MTA_LAST_PROCESSED_ROW"

  },

  /**
   * Row Definitions
   */
  ROWS: {

    HEADER: 1,
    DATA_START: 2

  },

  /**
   * Toast
   */
  TOAST: {

    TITLE: "Marketing 2.0",
    DURATION: 5

  },

  /**
   * Logging
   */
  LOG: {

    PREFIX: "[Marketing 2.0]"

  },

  /**
   * Date Format
   */
  DATE: {

    TIMEZONE: Session.getScriptTimeZone(),
    FORMAT: "yyyy-MM-dd"

  },
  
  /**
   * ACQ Report
   */
  ACQ: {

    SHEET: "ACQ_REP",
    SUMMARY_SHEET: "ACQ_Summary", 

    ROWS: {
      CONTROL_HEADER: 1,
      CONTROL_VALUE: 2,
      REPORT_HEADER: 4,
      REPORT_DATA_START: 5
    },

    COLUMNS: {
      START_FY: 1,      // A
      START_MONTH: 2,   // B
      END_FY: 3,        // C
      END_MONTH: 4,     // D
      GENERATE: 5       // E (checkbox)
    },

    ENGINE_START_COL: 15,  // O열

    SEGMENTS: [
      "Seminar",
      "Webinar",
      "BOFU",
      "Search",
      "Content",
      "Referral",
      "Other"
    ],

    FISCAL_MONTH_ORDER: [
      "AUG", "SEP", "OCT", "NOV", "DEC",
      "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL"
    ]

  },

  /**
   * NewP1 Report (New P1 Cohort Funnel Report)
   *
   * docs/NewP1ReportDesign.md 참고. Segment 목록/순서와 Fiscal Month
   * 순서는 CONFIG.ACQ.SEGMENTS / CONFIG.ACQ.FISCAL_MONTH_ORDER를 그대로 재사용.
   */
  NEWP1: {

    SHEET: "NewP1_REP",
    ENGINE_SHEET: "NewP1_Engine",

    ROWS: {
      CONTROL_HEADER: 1,
      CONTROL_VALUE: 2,
      REPORT_HEADER: 4,
      REPORT_DATA_START: 5
    },

    COLUMNS: {
      START_FY: 1,      // A
      START_MONTH: 2,   // B
      END_FY: 3,        // C
      END_MONTH: 4,     // D
      GENERATE: 5       // E (checkbox)
    },

    // Fiscal Week 이론상 최댓값(W53) — Sort Index 계산의 고정폭 슬롯 수로 사용.
    MAX_WEEKS: 53

  },

  /**
   * Target_REP (Weekly Segment Target & Achievement Report)
   *
   * docs/TargetReportDesign.md 참고. New P1/Business Segment 정의는
   * NewP1_REP(CONFIG.NEWP1)와 동일 소스(Leads_OPS)를 재사용한다.
   */
  TARGET: {

    SHEET: "Target_REP",
    ENGINE_SHEET: "Target_Engine",

    // 리포트 축 3개 그룹 — CONFIG.ACQ.SEGMENTS(Business Segment 7개)의 하위 매핑.
    // Referral/Other는 그룹에 없으므로 자동 제외됨 (docs/TargetReportDesign.md §2).
    GROUP_ORDER: ["events", "contact", "content"],

    SEGMENT_GROUPS: {
      events: ["Seminar", "Webinar"],
      contact: ["BOFU", "Search"],
      content: ["Content"]
    },

    // P1당 가치 산출 코호트 FY (§5 "P1당 가치" — FY26 1개 FY만 사용)
    P1_VALUE_FY: 26,

    BENCHMARK: {

      // New P1 벤치마크/시즌성 가중평균 — FY24:25:26 = 1:2:3 (최근 가중)
      NEWP1_FYS: [24, 25, 26],
      NEWP1_WEIGHTS: [1, 2, 3],

      // CPNP1 벤치마크 가중평균 — FY25:26 = 2:3 (채널시트가 FY24 데이터 없음, 확보 FY만)
      CPNP1_FYS: [25, 26],
      CPNP1_WEIGHTS: [2, 3]

    },

    // 주 사이클 전환일(월~일 전환, 2026-08-03) — Engine Input 블록의 편집 가능 셀 기본값.
    // 그 전 마지막 구방식 주는 7/26~8/2로 마감 (docs/TargetReportDesign.md §4).
    CUTOVER_DATE: new Date(2026, 7, 3),

    // 외부 파일 참조 (채널시트/Naver, 이관 안 함 — openById() 직접 참조)
    // 실물 구조 확인: docs/TargetReportDesign.md §3 "외부 시트 실물 구조 확인 (2026-07-27)"
    EXTERNAL: {

      SPREADSHEET_ID: "1QDB_9MiD6eTeNlnC8YMWXbyncSwgDOTZT-A-KItlu6A",

      // 탭 이름이 아닌 gid(sheetId)로 시트를 찾는다 (탭 이름 변경에 안전).
      CHANNEL_SHEET_GID: 1718473299,
      NAVER_SHEET_GID: 387972603,

      // 채널시트(Meta) 컬럼 — 헤더 1행, A=Start date, B=End date,
      // event(C~H)/contact(I~N)/lead(O~T)/traffic(U~W, 제외) 6·6·6·3 블록 반복.
      // Target Engine이 실제로 쓰는 건 그룹별 Spent 컬럼(E/K/Q)뿐.
      CHANNEL_COLUMNS: {
        START_DATE: 1,     // A
        END_DATE: 2,       // B
        EVENT_SPENT: 5,    // E  (channel group "event" → events)
        CONTACT_SPENT: 11, // K  (channel group "contact" → contact)
        CONTENT_SPENT: 17  // Q  (channel group "lead" → content)
      },

      // Naver 시트 컬럼 — A=FY, B=Start date, C=End date, D=SpentNZD(전액 contact 합산).
      NAVER_COLUMNS: {
        START_DATE: 2,  // B
        END_DATE: 3,    // C
        SPENT_NZD: 4    // D
      },

      // Deal Tracker([KOR] Deal Tracking) — Block B(P1당 가치)/C(딜 비중) 실데이터 원천.
      // 채널시트/Naver와 별도 파일.
      //
      // 2026-07-27 아키텍처 전환(중요): Student Contact Email/Primary Guardian
      // Email/Account Name을 Leads_OPS와 매칭시키는 접근을 전부 폐기했다 —
      // Sales팀 확인: 상담 종료 후 학부모가 이메일 변경을 요청하면 Lead/
      // Opportunity의 이메일 정보 자체가 Salesforce에서 덮어써져서, 원본
      // 마케팅 터치 이메일이 시스템적으로 복구 불가능한 경우가 있음(그래서
      // Student/Guardian/Account Name 매칭이 계속 실패하던 근본 원인).
      // 대신 Deal Tracker 자체를 Source of Truth로 삼는다 — Leads_OPS 개별
      // 리드 매칭 없이, 딜 자체에 기록된 Lead Source/Source Category/Lead
      // Source Detail 필드로 getBusinessSegment()(16_TransformHelper.js,
      // 프로젝트 공용 분류 로직)를 직접 호출해 세그먼트를 분류한다
      // (classifyDealSegment_(), 90_TargetEngine.js). P1 판정도 하지 않음
      // (사용자 확인: 딜트래커 딜의 99%가 이미 P1이라 사실상 전수 반영과 동일).
      // 예전 버전(Student/Guardian Email 기반 시트, 스프레드시트 ID
      // 1dJqSsDuFt0MbD6-aQp7NrVIiHKWfSE-BKgkLqz1J14c)은 폐기 — Created Date
      // 컬럼이 없어 코호트 구분도 불가능했음. 원래 쓰던 시트(gid 498663095)로
      // 복귀, 컬럼 구조는 2026-07-27 WebFetch로 재확인.
      DEAL_TRACKER: {

        SPREADSHEET_ID: "1oGCY8okaxhpHrtotUzbhyprCOVcJ9ndX5kX3m5qqxME",
        SHEET_GID: 498663095,

        // 헤더 1행 기준, 24컬럼 중 실제로 쓰는 6개.
        COLUMNS: {
          FY: 1,                 // A  ("FY26" 등 텍스트 — 그대로 사용, 날짜 파생 불필요)
          REVENUE: 5,            // E  (Revenue (NZD))
          LEAD_SOURCE: 6,        // F  (Upsell/Referral/Paid Search/... — 제외 필터 전용)
          SOURCE_CATEGORY: 7,    // G  (미사용 — 분류엔 CONTENT_CATEGORY 사용, 보존만)
          CONTENT_CATEGORY: 8,   // H  (Webinar/Seminar/Consult/eBook/TOFU/On demand/N/A —
                                  //     2026-07-27부터 그룹 분류 직접 원천, CONTENT_CATEGORY_GROUP_MAP 참고)
          CLOSE_DATE: 10,        // J
          CREATED_DATE: 11,      // K
          LEAD_SOURCE_DETAIL: 23 // W  (미사용 — 분류엔 CONTENT_CATEGORY 사용, 보존만)
        },

        // 조정 베이스 = 전체 딜 − 조정치(세일즈 레퍼럴 + 업셀) — 분모·분자 모두 제외.
        // 대소문자 무시 비교(실측: "Upsell"/"UpSell" 표기가 섞여 있음).
        EXCLUDE_LEAD_SOURCES: ["upsell", "referral"],

        // Content Category(H열) → Target 그룹 직접 매핑 (2026-07-27 확정).
        // classifyDealSegment_()(90_TargetEngine.js)가 getBusinessSegment() 퍼지
        // 키워드 매칭(Lead Source Detail 기반) 대신 이 컬럼을 직접 쓴다 — Lead
        // Source Detail이 공란인 딜(실측 다수 존재)이 "Other"로 오분류되던 문제
        // 해결. 소문자·trim 비교. 매핑 안 되는 값(N/A 등)은 미분류(null) 처리.
        //
        // TODO(CLAUDE.md #13): 지금은 단순화된 임시 매핑 — "Consult"를 세부
        // 구분(BOFU/Search) 없이 바로 contact로, TOFU/On demand/eBook을 전부
        // content로 뭉뚱그렸다. 사용자가 추후 실제 Business Segment 세분류
        // 기준으로 업데이트할 예정 — 임의로 세분화하지 말 것.
        CONTENT_CATEGORY_GROUP_MAP: {
          "webinar": "events",
          "seminar": "events",
          "consult": "contact",
          "tofu": "content",
          "on demand": "content",
          "ebook": "content"
        }

        // 딜 비중 계산 대상 FY는 3FY median이 아니라 CONFIG.TARGET.P1_VALUE_FY
        // (FY26) 단일 코호트를 그대로 쓴다 — 2026-07-27 사용자 확정: "딜 비중도
        // P1당 가치와 마찬가지로 FY26 코호트로 봐야 한다"(3FY median은 최근
        // 연도 실제 구성비와 괴리가 커서 폐기 — 실측: median 기준 contact 20.9%
        // vs FY26 단독 31.3%, 10%p 이상 차이).

      }

    },

    // Engine 시트 Block 0 (Inputs) — 절대 덮어쓰지 않는 영역 (읽기만).
    // 조정 시 숨김 해제 후 직접 편집 (docs/TargetReportDesign.md §9).
    INPUT: {

      LABEL_COL: 1,
      VALUE_COL: 2,

      ROWS: {
        TARGET_FY: 1,
        REVENUE_TARGET: 2,
        IMPROVEMENT_FACTOR_EVENTS: 3,
        IMPROVEMENT_FACTOR_CONTACT: 4,
        IMPROVEMENT_FACTOR_CONTENT: 5,
        DEAL_SHARE_EVENTS: 6,
        DEAL_SHARE_CONTACT: 7,
        DEAL_SHARE_CONTENT: 8,
        CUTOVER_DATE: 9
      },

      LAST_ROW: 9,

      // 최초 setupTargetReport() 실행 시 채워지는 기본값 (사용자가 이후 직접 편집).
      DEFAULTS: {
        TARGET_FY: 27,
        REVENUE_TARGET: 9450000,
        IMPROVEMENT_FACTOR: 0.9,
        DEAL_SHARE: {
          events: 0.34,
          contact: 0.33,
          content: 0.33
        }
      }

    },

    // Engine 시트 Block A~D 시작 컬럼 (Block 0 오른쪽부터 좌→우 배치)
    ENGINE: {

      BLOCK_A_START_COL: 4,   // D열 — 벤치마크
      BLOCK_A_COLUMNS: 8,     // Group, Month, FY24, FY25, FY26, Weighted Avg, Seasonality%, CPNP1 Benchmark

      // P1당 가치 — 2026-07-27 사용자 확정으로 코호트1(CurrentFYP1V)/코호트2(PrevP1V)
      // 2개 값으로 분리 (docs/TargetReportDesign.md §5, CLAUDE.md #7 참고):
      // 코호트1 = Create Date·Close Date 둘 다 FY26인 딜(같은 해 생성·클로징),
      // 코호트2 = Close Date는 FY26인데 Create Date는 이전 FY(과거 리드가 이번
      // 해에 클로징된 파이프라인 기여분, content처럼 nurturing 긴 채널 대응).
      BLOCK_B_START_COL: 13,  // M열 — P1당 가치
      BLOCK_B_COLUMNS: 7,     // Group, NewP1(FY26) 수, 코호트1 Revenue(R1), CurrentFYP1V,
                                // PrevP1 수, 코호트2 Revenue(R2), PrevP1V

      // 딜 비중 + New/Pipeline 2트랙 FY P1 목표 — 2026-07-27 사용자 최종 확정
      // (CLAUDE.md #7): FY Revenue 타겟을 New 트랙(코호트1 비율÷a)/Pipeline
      // 트랙(코호트2 비율÷b)으로 나눠 계산 후 합산. 2컬럼→6컬럼으로 확장되며
      // Block D 시작 컬럼이 뒤로 밀림(refreshTargetEngine_()의 wide-clear로
      // 예전 위치 잔재 처리).
      BLOCK_C_START_COL: 21,  // U열 — 딜 비중(코호트1/2) + New/Pipeline FY 목표
      BLOCK_C_COLUMNS: 6,     // Group, Deal Share(R1), Pipeline Share(R2),
                                // FY New P1 Target, FY Pipeline P1 Target, FY Total P1 Target

      BLOCK_D_START_COL: 28,  // AB열 — 목표 전개 (주 캘린더 전체 나열, FY Total P1 Target 기준)
      BLOCK_D_COLUMNS: 8      // Week Start, Week End, Month(라벨만, 예 "AUG"), Group, Month Target P1, Week Target P1, Month CPNP1 Benchmark, Week Target CPNP1

    },

    // Target_REP (보임) 레이아웃
    //
    // 2026-07-27 단순화: Control 영역(Generate 체크박스/파라미터 요약)을 전부 제거.
    // Generate가 수동 실행(runGenerateTargetReport())으로 전환되며 시트 내 안내가
    // 불필요해짐 — 1행은 비워둠(향후 월 소계 행 후보, §12 Open Item #8), 2행부터 헤더.
    REPORT: {

      ROWS: {
        REPORT_HEADER: 2,
        REPORT_DATA_START: 3
      },

      // 그룹당 5컬럼: Target P1 / Actual P1 / 달성% / Target CPNP1 / Actual CPNP1
      GROUP_COLUMN_COUNT: 5,

      FIXED_HEADERS: ["Week Start", "Week End", "Month"]

    }

  },

  /**
   * Validation Summary Display Exclude
   *
   * Import 완료 alert에 표시하지 않을 필드 목록.
   * (검증/서식 강제 로직 자체는 그대로 유지, 화면 표시만 제외)
   */
  VALIDATION_SUMMARY_EXCLUDE: {

    FIELDS: [
      "Company / Account"
    ],

    DATE_COLUMNS: [
      "IC Booked Date",
      "IC Completed Date (Pre-Conversion)",
      "Opportunity Won Date"
    ]

  }

};

