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
 * v1.14.0
 *
 * Change Log
 * v1.14.0 (2026-07-30)
 * - CONFIG.TARGET.ENGINE Block A~D 시작 컬럼을 전부 +10 이동(4/13/21/28 →
 *   14/23/31/38) — Block 0의 신규 월별 그리드 섹션(B~M열, 12개월)이 기존
 *   BLOCK_A_START_COL(D열=4)과 정확히 겹쳐 실제 시트에서 두 블록 데이터가
 *   같은 행/컬럼에서 서로 덮어쓰던 버그 발견·수정(사용자 실측 리포트). 상세:
 *   docs/exec-plans/active/2026-07-30-target-rep-segment-breakdown.md
 * v1.13.0 (2026-07-30)
 * - CONFIG.TARGET 세그먼트 구조 전면 분해: GROUP_ORDER/SEGMENT_GROUPS를 3그룹
 *   (events/contact/content)에서 5개 실제 Business Segment(Seminar/Webinar/
 *   BOFU/Search/Content)로 교체 — Referral/Other는 계속 제외. BENCHMARK.CPNP1_FYS/
 *   WEIGHTS는 빈 배열로 잠정 중단(채널시트가 3그룹 단위라 5세그먼트 자동 분해 불가 —
 *   대신 세그먼트별 CPNP1은 신규 INPUT.CPNP1_BENCHMARK_MANUAL로 사용자 직접 입력).
 *   INPUT 블록을 4개 섹션(스칼라/CPNP1 벤치마크 수동입력/월별 회사 전체 Revenue
 *   Target·Budget/세그먼트별 월별 실제 Spent)으로 확장, IMPROVEMENT_FACTOR/DEAL_SHARE는
 *   named row에서 START행+GROUP_ORDER 인덱스 방식으로 변경(90_TargetEngine.js
 *   readTargetEngineInputs_()/setupTargetEngineInputDefaults_() 참고). 상세 배경:
 *   docs/exec-plans/active/2026-07-30-target-rep-segment-breakdown.md
 * v1.12.0 (2026-07-29)
 * - 별도 git worktree(worktree-clever-seeking-dolphin)에 있던 Target_REP
 *   New/Pipeline 2트랙 Block C/D 확장 설정(2026-07-27, 아래 v1.13.0-worktree/
 *   v1.12.0-worktree 항목)을 main에 merge(90_TargetEngine.js v1.15.0 changelog
 *   참고 — 세션 중 clasp push가 이 worktree의 라이브 배포분을 덮어쓴 사고
 *   복구). CONTENT_CATEGORY_GROUP_MAP(worktree가 추가했던 것)은 그 이후
 *   main에서 SEGMENT 컬럼 직접 참조 방식(v1.11.0, 2026-07-28)으로 이미
 *   대체된 상태라 제거 — classifyDealSegment_()는 더 이상 이 맵을 안 씀.
 * v1.11.0 (2026-07-28)
 * - CONFIG.TARGET.EXTERNAL.DEAL_TRACKER.COLUMNS에 SEGMENT(8, H열) 추가 —
 *   사용자가 Deal Tracker의 H열("Content Category"였던 컬럼을 "Segment"로
 *   개명)에 전체 딜을 수동으로 Business Segment 재분류함. getBusinessSegment()
 *   키워드 매칭이 실측 검증(Search $144,265 vs 실제 ~$537,507.89, 약 $393K
 *   갭)으로 신뢰 불가 판정돼 이 컬럼을 Source of Truth로 전환(90_TargetEngine.js
 *   readDealTrackerRawRows_()/classifyDealSegment_(), 30_ACQReport.js
 *   computeACQDealRevenueFromRows_() 참고). SOURCE_CATEGORY/LEAD_SOURCE_DETAIL은
 *   세그먼트 분류엔 더 이상 안 씀(다른 용도로 보존).
 * v1.13.0-worktree (2026-07-27, worktree-clever-seeking-dolphin에서 병합)
 * - CONFIG.TARGET.ENGINE.BLOCK_D_COLUMNS 8→12(Block D도 New/Pipeline 각각
 *   전개), CONFIG.TARGET.REPORT.GROUP_COLUMN_COUNT 5→7(Target_REP에 Target
 *   New/Pipeline P1 컬럼 추가) — Target_REP에서 New/Pipeline P1 목표를 분리
 *   표시해달라는 사용자 요청 반영. 90_TargetEngine.js/91_TargetReport.js/
 *   92_TargetStyles.js 참고.
 * v1.12.0-worktree (2026-07-27, worktree-clever-seeking-dolphin에서 병합)
 * - CONFIG.TARGET.ENGINE.BLOCK_C_COLUMNS 2→6(딜비중+New/Pipeline 2트랙 FY
 *   목표), BLOCK_D_START_COL 24→28(X열→AB열, Block C 확장에 따른 이동) —
 *   New/Pipeline 2트랙 FY P1 목표 공식 확정(CLAUDE.md #7 최종 결정),
 *   90_TargetEngine.js 참고.
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

    // 리포트 축 — CONFIG.ACQ.SEGMENTS(Business Segment 7개) 중 5개를 그대로 사용
    // (Referral/Other는 마케팅 타겟 대상이 아니므로 계속 제외 — 2026-07-30 세그먼트
    // 구조 분해로 기존 3그룹(events/contact/content) 추상화 폐기. deriveTargetGroup_()
    // 로직은 변경 없음 — 그룹명이 세그먼트명 그대로라 1:1 매핑이 됨).
    // 상세: docs/exec-plans/active/2026-07-30-target-rep-segment-breakdown.md
    GROUP_ORDER: ["Seminar", "Webinar", "BOFU", "Search", "Content"],

    SEGMENT_GROUPS: {
      Seminar: ["Seminar"],
      Webinar: ["Webinar"],
      BOFU: ["BOFU"],
      Search: ["Search"],
      Content: ["Content"]
    },

    // P1당 가치 산출 코호트 FY (§5 "P1당 가치" — FY26 1개 FY만 사용)
    P1_VALUE_FY: 26,

    BENCHMARK: {

      // New P1 벤치마크/시즌성 가중평균 — FY24:25:26 = 1:2:3 (최근 가중)
      NEWP1_FYS: [24, 25, 26],
      NEWP1_WEIGHTS: [1, 2, 3],

      // CPNP1 벤치마크(그룹×월 채널시트 자동집계) — 2026-07-30 세그먼트 분해로 잠정
      // 중단(빈 배열 = 계산 스킵). 채널시트가 3그룹(event/contact/lead) 단위라 5세그먼트로
      // 자동으로 못 쪼갬 — 세그먼트별 CPNP1은 대신 INPUT.CPNP1_BENCHMARK_MANUAL(사용자
      // 직접 입력)로 대체. docs/Roadmap.md Phase 1(캠페인 데이터 자동 연동) 완료 시
      // 재활성화 검토. 상세: docs/exec-plans/active/2026-07-30-target-rep-segment-breakdown.md
      CPNP1_FYS: [],
      CPNP1_WEIGHTS: []

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

        // 헤더 1행 기준, 24컬럼 중 실제로 쓰는 7개.
        COLUMNS: {
          FY: 1,                 // A  ("FY26" 등 텍스트 — 그대로 사용, 날짜 파생 불필요)
          REVENUE: 5,            // E  (Revenue (NZD))
          LEAD_SOURCE: 6,        // F  (Upsell/Referral/Paid Search/... — EXCLUDE_LEAD_SOURCES 필터 전용,
                                  //     세그먼트 분류엔 더 이상 안 씀 — 아래 SEGMENT 참고)
          SOURCE_CATEGORY: 7,    // G  (2026-07-28부터 미사용 — getBusinessSegment() 자동 분류 폐기)
          SEGMENT: 8,            // H  (2026-07-28 추가 — 원래 "Content Category"였던 컬럼을 사용자가
                                  //     "Segment"로 개명 + 전체 딜 수동 재분류. getBusinessSegment()
                                  //     키워드 매칭이 실측 검증(Search $144,265 vs 실제 ~$537,507.89,
                                  //     약 $393K 갭) 결과 신뢰 불가로 판정돼 자동 분류 전면 폐기,
                                  //     이 컬럼을 그대로 Source of Truth로 사용. 값: Seminar/Webinar/
                                  //     BOFU/Search/Content/Referral/Other(Upsell 포함)/N/A(출처 불명,
                                  //     대부분 2022년 이전 딜)
          CLOSE_DATE: 10,        // J  (향후 코호트1/2 분리용 — 이번 라운드에선 미사용, 보존)
          CREATED_DATE: 11,      // K  (향후 코호트1/2 분리용 — 이번 라운드에선 미사용, 보존)
          LEAD_SOURCE_DETAIL: 23 // W  (2026-07-28부터 미사용 — 세그먼트 분류는 이제 SEGMENT 컬럼
                                  //     직접 사용, Lead Source Detail은 더 이상 campaign/detail
                                  //     파라미터로 안 씀)
        },

        // 조정 베이스 = 전체 딜 − 조정치(세일즈 레퍼럴 + 업셀) — 분모·분자 모두 제외.
        // 대소문자 무시 비교(실측: "Upsell"/"UpSell" 표기가 섞여 있음).
        EXCLUDE_LEAD_SOURCES: ["upsell", "referral"]

        // 딜 비중 계산 대상 FY는 3FY median이 아니라 CONFIG.TARGET.P1_VALUE_FY
        // (FY26) 단일 코호트를 그대로 쓴다 — 2026-07-27 사용자 확정: "딜 비중도
        // P1당 가치와 마찬가지로 FY26 코호트로 봐야 한다"(3FY median은 최근
        // 연도 실제 구성비와 괴리가 커서 폐기 — 실측: median 기준 contact 20.9%
        // vs FY26 단독 31.3%, 10%p 이상 차이).

      }

    },

    // Engine 시트 Block 0 (Inputs) — 절대 덮어쓰지 않는 영역 (읽기만).
    // 조정 시 숨김 해제 후 직접 편집 (docs/TargetReportDesign.md §9).
    //
    // 2026-07-30 세그먼트 분해 + 예산 반영으로 4개 섹션으로 확장 (컬럼 범위는 의도적으로
    // 제한 안 함 — 사용자 요청). 상세 설계 배경:
    // docs/exec-plans/active/2026-07-30-target-rep-segment-breakdown.md
    //   1) 스칼라 입력 (Target FY / Cutover Date / 세그먼트별 개선계수·딜비중 — GROUP_ORDER 순서)
    //   2) 세그먼트별 FY26 CPNP1 벤치마크 (스칼라 1개씩, 예산 기반 도출 체인 전용 — 사용자
    //      시트에 직접 입력, 채널시트 자동집계 아님)
    //   3) 월별 회사 전체 Revenue Target / Budget (Label=A, 12개월=B..M,
    //      CONFIG.ACQ.FISCAL_MONTH_ORDER 순서)
    //   4) 세그먼트별 월별 실제 Spent (수동 취합) — 5세그먼트 × 12개월
    INPUT: {

      LABEL_COL: 1,
      VALUE_COL: 2,

      // 섹션 1 — 스칼라 입력. IMPROVEMENT_FACTOR/DEAL_SHARE는 개별 named row가 아니라
      // START 행 + GROUP_ORDER 인덱스로 계산 (5세그먼트 순서 그대로, readTargetEngineInputs_()/
      // setupTargetEngineInputDefaults_() 참고).
      ROWS: {
        TARGET_FY: 1,
        CUTOVER_DATE: 2,
        IMPROVEMENT_FACTOR_START: 3,  // 3~7 (GROUP_ORDER 순서, 5행)
        DEAL_SHARE_START: 8           // 8~12 (GROUP_ORDER 순서, 5행)
      },

      SCALAR_LAST_ROW: 12,

      // 섹션 2 — 세그먼트별 FY26 CPNP1 벤치마크 (스칼라 1개씩, VALUE_COL 사용)
      CPNP1_BENCHMARK_MANUAL: {
        HEADER_ROW: 14,
        DATA_START_ROW: 15   // 15~19 (GROUP_ORDER 순서, 5행)
      },

      // 섹션 3 — 월별 회사 전체 Revenue Target / Budget
      MONTHLY_COMPANY_INPUTS: {
        HEADER_ROW: 21,
        REVENUE_TARGET_ROW: 22,
        BUDGET_ROW: 23,
        MONTH_START_COL: 2   // B열부터 12개월 (CONFIG.ACQ.FISCAL_MONTH_ORDER 순서)
      },

      // 섹션 4 — 세그먼트별 월별 실제 Spent (수동 취합)
      MANUAL_SEGMENT_SPENT: {
        HEADER_ROW: 25,
        DATA_START_ROW: 26,  // 26~30 (GROUP_ORDER 순서, 5행)
        MONTH_START_COL: 2   // B열부터 12개월 (CONFIG.ACQ.FISCAL_MONTH_ORDER 순서)
      },

      LAST_ROW: 30,

      // 최초 setupTargetReport() 실행 시 채워지는 기본값 (사용자가 이후 직접 편집).
      DEFAULTS: {
        TARGET_FY: 27,
        IMPROVEMENT_FACTOR: 0.9,
        DEAL_SHARE: 0.2   // 5세그먼트 균등분배(1/5) placeholder — 사용자가 실측치로 교체
      }

    },

    // Engine 시트 Block A~D 시작 컬럼 (Block 0 오른쪽부터 좌→우 배치)
    //
    // 2026-07-30 전면 이동(D→N열, +10컬럼): Block 0에 월별 그리드 섹션(MONTHLY_COMPANY_INPUTS/
    // MANUAL_SEGMENT_SPENT, MONTH_START_COL=2부터 12개월 = B~M열)이 추가되면서, 원래
    // BLOCK_A_START_COL=4(D열)이 그 그리드 한복판(D열은 그리드의 3번째 달 OCT 컬럼)과
    // 정확히 겹치는 버그가 실제 시트에서 발견됨(사용자 리포트: "Monthly Company-wide Inputs
    // 행에 AUG/SEP 다음 Webinar MAR... 행이 이어짐" — 두 블록이 같은 행에서 서로 다른 컬럼을
    // 쓰고 있었을 뿐인데 시각적으로 뒤섞여 보였던 것, 실제로는 Block 0가 쓴 값을 Block A가
    // 그대로 덮어쓰고 있었음). Block 0 그리드가 M열(13)까지 쓰므로 Block A~D를 전부 N열(14)
    // 이후로 이동(기존 간격 패턴 그대로 +10 이동: 4/13/21/28 → 14/23/31/38).
    // 상세: docs/exec-plans/active/2026-07-30-target-rep-segment-breakdown.md
    ENGINE: {

      BLOCK_A_START_COL: 14,  // N열 — 벤치마크 (Block 0 월별 그리드가 M열까지 쓰므로 그 다음부터)
      BLOCK_A_COLUMNS: 8,     // Group, Month, FY24, FY25, FY26, Weighted Avg, Seasonality%, CPNP1 Benchmark

      // P1당 가치 — 2026-07-27 사용자 확정으로 코호트1(CurrentFYP1V)/코호트2(PrevP1V)
      // 2개 값으로 분리 (docs/TargetReportDesign.md §5, CLAUDE.md #7 참고):
      // 코호트1 = Create Date·Close Date 둘 다 FY26인 딜(같은 해 생성·클로징),
      // 코호트2 = Close Date는 FY26인데 Create Date는 이전 FY(과거 리드가 이번
      // 해에 클로징된 파이프라인 기여분, content처럼 nurturing 긴 채널 대응).
      BLOCK_B_START_COL: 23,  // W열 — P1당 가치
      BLOCK_B_COLUMNS: 7,     // Group, NewP1(FY26) 수, 코호트1 Revenue(R1), CurrentFYP1V,
                                // PrevP1 수, 코호트2 Revenue(R2), PrevP1V

      // 딜 비중 + New/Pipeline 2트랙 FY P1 목표 — 2026-07-27 사용자 최종 확정
      // (CLAUDE.md #7): FY Revenue 타겟을 New 트랙(코호트1 비율÷a)/Pipeline
      // 트랙(코호트2 비율÷b)으로 나눠 계산 후 합산. 2컬럼→6컬럼으로 확장되며
      // Block D 시작 컬럼이 뒤로 밀림(refreshTargetEngine_()의 wide-clear로
      // 예전 위치 잔재 처리).
      BLOCK_C_START_COL: 31,  // AE열 — 딜 비중(코호트1/2) + New/Pipeline FY 목표
      BLOCK_C_COLUMNS: 6,     // Group, Deal Share(R1), Pipeline Share(R2),
                                // FY New P1 Target, FY Pipeline P1 Target, FY Total P1 Target

      // 2026-07-27 사용자 요청: Target_REP에서 New/Pipeline P1 목표가 분리 표시돼야
      // 해서, 합계(Total)로 뭉쳐 전개하던 걸 New/Pipeline 각각 전개하도록 확장.
      BLOCK_D_START_COL: 38,  // AL열 — 목표 전개 (주 캘린더 전체 나열)
      BLOCK_D_COLUMNS: 12     // Week Start, Week End, Month(라벨만, 예 "AUG"), Group,
                                // Month/Week New P1 Target, Month/Week Pipeline P1 Target,
                                // Month/Week Target P1(합계), Month CPNP1 Benchmark, Week Target CPNP1

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

      // 그룹당 7컬럼(2026-07-27 New/Pipeline 분리 표시 — 사용자 요청): Target New P1 /
      // Target Pipeline P1 / Target P1(합계) / Actual P1 / 달성% / Target CPNP1 / Actual CPNP1
      GROUP_COLUMN_COUNT: 7,

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

