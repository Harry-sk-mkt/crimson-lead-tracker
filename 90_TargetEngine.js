/**
 * ==========================================================
 * Marketing 2.0
 * Target Engine (Weekly Segment Target & Achievement — Calc Engine)
 *
 * Responsibility
 * Target_Engine 시트(숨김)의 Block A~D 계산/작성. Leads_OPS(New P1/
 * P1당 가치)와 외부 채널시트/Naver 시트(CPNP1 벤치마크 분자)/Deal Tracker
 * (딜 비중)를 원본으로, top-down 목표 역산 체인을 실행한다. Target_REP
 * (91_TargetReport.js)은 이 시트를 조회만 하고 원본을 재스캔하지 않는다
 * (NewP1/Events 패턴과 동일).
 *
 * 설계 문서
 * docs/TargetReportDesign.md
 *
 * Must NOT
 * - Leads_Master / MTA_Master 직접 조회 (Leads_OPS 단일 소스 원칙, NewP1과 동일)
 * - Target_Engine Block 0(Input) 영역을 덮어쓰기 (읽기만, Events_OPS Manual 패턴 준용)
 *
 * Stage
 * 90 Reporting (Target)
 *
 * Version
 * v1.10.0
 *
 * Change Log
 * v1.10.0 (2026-07-27)
 * - P1당 가치(Block B)를 코호트1/2 이원화 구조로 전면 재작성 — 사용자 확정
 *   프레임워크: CurrentFYP1V(a) = 코호트1(Created=Closed=타겟FY) Revenue ÷
 *   이번 FY New P1 수, PrevP1V(b) = 코호트2(Closed=타겟FY, Created<타겟FY)
 *   Revenue ÷ (all-time 총 P1 수 − 이번 FY New P1 수). readDealTrackerRawRows_()
 *   가 이제 Close/Created Date(진짜 Date 셀 — 텍스트 파싱 불필요 확인됨)에서
 *   closeFY/createdFY를 직접 파생(구 텍스트 FY 컬럼 fy 필드 제거).
 *   computeDealCohortsFromDealRows_() 신규 — 그룹별 코호트1/2 Revenue를 한 번에
 *   계산. computeDealShareRatiosFromDealRows_()는 코호트1(Created=Closed=
 *   타겟FY)만 사용하도록 필터 조건 보강(기존엔 Close FY만 봤음).
 *   computeTargetLeadsOPSAggregates_()가 이제 newP1CountByGroup(이번 FY 신규
 *   P1 수)과 totalP1CountByGroup(all-time 총 P1 수)를 반환(구 p1ValueByGroup/
 *   revenueSum 제거 — Revenue는 이제 Deal Tracker 코호트에서 옴).
 *   computeTargetDerivationRows_()는 a/b 블렌딩 방식이 아직 미정(사용자가 두
 *   값을 Block B에서 직접 검토 후 결정 예정)이라 임시로 a(CurrentFYP1V)만
 *   사용. Block B 헤더/매트릭스 7컬럼으로 확장(00_Config.js
 *   CONFIG.TARGET.ENGINE.BLOCK_B_COLUMNS 4→7, Block C/D 컬럼 위치 shift).
 *   93_TempQA_DealTrackerMatch.js도 신규 closeFY/createdFY 필드에 맞춰 갱신.
 * v1.9.0 (2026-07-27)
 * - computeDealShareRatiosFromDealRows_()를 3FY(24·25·26) median에서 FY26
 *   단일 코호트(CONFIG.TARGET.P1_VALUE_FY 재사용)로 변경 — 사용자 확정:
 *   median이 최근 연도 실제 구성비와 10%p 이상 괴리(실측: contact 20.9%
 *   median vs 31.3% FY26 단독). 딜 비중도 P1당 가치와 동일하게 FY26 코호트
 *   기준으로 통일.
 * v1.8.0 (2026-07-27)
 * - Deal Tracker 매칭 아키텍처 전면 폐기 및 교체. Sales팀 확인: 상담 종료 후
 *   학부모 요청으로 Lead/Opportunity 이메일이 Salesforce에서 덮어써져 원본
 *   마케팅 터치 이메일이 시스템적으로 복구 불가능한 경우가 있음 — Student/
 *   Guardian Email/Account Name 매칭이 계속 실패하던 근본 원인으로 확인됨.
 *   matchDealToGroup_()/computeTargetLeadsOPSAggregates_()의 emailToGroupMap/
 *   nameToGroupsMap 전부 제거. 대신 classifyDealSegment_() 신규 — Deal Tracker
 *   자체의 Lead Source/Source Category/Lead Source Detail로 getBusinessSegment()
 *   를 직접 호출해 Leads_OPS 조회 없이 세그먼트 분류(Deal Tracker를 Source of
 *   Truth로 전환). P1 판정 제거(사용자 확인: 딜의 99%가 이미 P1). Deal Tracker
 *   원래 시트(gid 498663095, CONFIG.TARGET.EXTERNAL.DEAL_TRACKER, 00_Config.js)
 *   로 복귀 — 새 컬럼 구조(FY 텍스트 컬럼 직접 사용, Close/Created Date는
 *   향후 코호트1/2 분리용으로 보존만). readDealTrackerRawRows_()/
 *   computeDealShareRatiosFromDealRows_()/computeDealShareFromTracker_() 전부
 *   갱신. 93_TempQA_DealTrackerMatch.js도 분류 실패 기반으로 재작성. 상세는
 *   CLAUDE.md #7.
 * v1.7.0 (2026-07-27)
 * - matchDealToGroup_()에 4차 "고스트" 분류 추가 — Student/Guardian Email/
 *   Account Name 전부 실패한 딜을 Leads_OPS 매칭 없이 딜 자체의 UTM Campaign/
 *   First Touch Detail/Lead Source/Lead Source Category로 getBusinessSegment()
 *   (16_TransformHelper.js, 프로젝트 공용 분류 로직) 직접 호출해 분류(사용자
 *   제안 — content Target P1이 여전히 비정상적으로 높아 조사하던 중 나옴).
 *   readDealTrackerRawRows_()가 3개 필드 추가로 읽도록 확장, CONFIG.TARGET.
 *   EXTERNAL.DEAL_TRACKER.COLUMNS에 MKT_UTM_CAMPAIGN/FIRST_TOUCH_DETAIL/
 *   LEAD_SOURCE_CATEGORY 추가(00_Config.js).
 * v1.6.0 (2026-07-27)
 * - matchDealEmailToGroup_() → matchDealToGroup_()로 확장 — Student/Guardian
 *   Email 둘 다 실패할 때(Lead Merge로 원본 이메일 자체가 소실된 실측 케이스
 *   발견) Account Name을 3차 후보로 시도. 동명이인 안전장치: 같은 Account
 *   Name이 Leads_OPS에서 서로 다른 그룹에 걸쳐 등장하면 매칭 포기(잘못된
 *   그룹 배분 방지). computeTargetLeadsOPSAggregates_()가 nameToGroupsMap도
 *   함께 반환하도록 확장. CONFIG.TARGET.EXTERNAL.DEAL_TRACKER.COLUMNS에
 *   ACCOUNT_NAME 추가(00_Config.js). 93_TempQA_DealTrackerMatch.js도 갱신.
 * v1.5.0 (2026-07-27)
 * - 딜트래커 시트 전면 재구축(신규 스프레드시트, FY24~26)에 맞춰 읽기/매칭
 *   로직 갱신: FY 컬럼이 없어져 Close Date(Plain Text, DD/MM/YYYY)에서
 *   parseDMY()(16_TransformHelper.js)로 직접 파생하는 parseDealTrackerCloseDate_()
 *   신규. sourceEmail/oppEmail → studentEmail/guardianEmail로 필드명 정정
 *   (matchDealEmailToGroup_(), computeDealShareRatiosFromDealRows_() 등) —
 *   근본 원인이 "Source/Opp"가 아니라 Salesforce Opportunity의 Student
 *   Contact/Primary Guardian 두 컨택트였음이 규명됨(CLAUDE.md #7 참고).
 *   Stage 필터(WON_STAGE) 추가, Lead Source 대소문자 무시 비교로 변경(실측:
 *   "Upsell"/"UpSell" 표기 혼용). 93_TempQA_DealTrackerMatch.js도 동일하게 갱신.
 * v1.4.0 (2026-07-27)
 * - matchDealEmailToGroup_() 신규 — Deal Tracker Source email이 Leads_OPS와
 *   매칭 안 될 때 Opp Email을 2차 후보로 시도. 사용자가 딜트래커에 "Opp
 *   Email"/"Revenue KRW" 컬럼을 추가(Revenue (NZD)는 A1 환율 기준 수식값으로
 *   전환)하며 컬럼 위치 전체 이동 — CONFIG.TARGET.EXTERNAL.DEAL_TRACKER.COLUMNS
 *   갱신(00_Config.js), readDealTrackerRawRows_()가 oppEmail도 읽도록 확장.
 *   실측 근거: June Chang/Philip Ahn 둘 다 Source email(마케팅 퍼스트터치
 *   이메일)이 Leads_OPS와 매칭 안 됐지만, Opportunity 소속 Account의 이메일
 *   로는 매칭 성공 — 구조적으로 반복되는 패턴으로 확인됨.
 * v1.3.0 (2026-07-27)
 * - Block C(딜 비중) 실데이터 연동. CONFIG.TARGET.EXTERNAL.DEAL_TRACKER 추가,
 *   readDealTrackerRawRows_()/computeDealShareRatiosFromDealRows_()/
 *   computeDealShareFromTracker_() 신규 — Deal Tracker(FY24·25·26)에서
 *   Upsell/Referral을 제외한 조정 베이스 대비 그룹별 Revenue 비중을 구하고
 *   3FY median을 취한다. Source email로 Leads_OPS Business Segment를 매칭
 *   (computeTargetLeadsOPSAggregates_()가 emailToGroupMap도 함께 반환하도록
 *   확장 — 기존 P1 전용 필터를 email 매핑 전 단계로 이동). Deal Tracker
 *   접근 실패 시 Input 블록 수동값으로 Fallback(computeDealShareBlockRows_()).
 *   기존 균등 분할(33%씩) placeholder를 실제 데이터로 대체 — 사용자 요청.
 * - openTargetExternalSheetByGid_()가 spreadsheetId를 인자로 받도록 일반화
 *   (채널시트/Naver와 Deal Tracker가 서로 다른 파일이라).
 * v1.2.0 (2026-07-27)
 * - generateCalendarWeeksForFY_()에 resolveTargetFYCalendarYear_() 추가 —
 *   `new Date(targetFY - 1, 7, 1)`이 2자리 FY(예: 26)를 JS Date의 "0~99는
 *   1900년대" 특수 규칙에 걸려 1926년으로 해석하던 실측 버그 수정(Week
 *   Start/End가 "1926-08-02"처럼 나오고, 요일 정렬도 틀어져 월요일이어야
 *   할 첫 주가 일요일(8/2)로 시작하는 것처럼 보였음 — 둘 다 같은 원인).
 * - targetDerivationRowsToMatrix_()의 Month 컬럼에서 "FY27 " 접두사 제거,
 *   월 라벨만 저장(예: "AUG") — 사용자 요청.
 * v1.1.0 (2026-07-27)
 * - setupTargetReport() 최초 실행 중 "Service Spreadsheets timed out" 실측 —
 *   readTargetEngineInputs_()/setupTargetEngineInputDefaults_()가 Block 0
 *   9개 행을 셀 단위로 개별 getValue()/setValue()(최대 27회 왕복) 하던 것을
 *   컬럼 전체 getValues()/setValues() 배치 호출(1회 읽기 + 2회 쓰기)로 교체.
 * v1.0.0 (2026-07-27)
 * - 최초 구현 (docs/TargetReportDesign.md 설계 그대로).
 * ==========================================================
 */


/**
 * ==========================================================
 * Derive Target Segment Group (Business Segment → events/contact/content)
 *
 * WHY
 * 리포트 축은 Business Segment 7개가 아니라 3개 그룹(CONFIG.TARGET.
 * SEGMENT_GROUPS)이다. Referral/Other 등 그룹에 없는 세그먼트는 목표
 * 배분 대상이 아니므로 null을 반환해 자동 제외한다 (docs/TargetReportDesign.md §2).
 *
 * @param {string} businessSegment
 * @return {string|null}  "events"|"contact"|"content"|null
 *
 * TEST
 * deriveTargetGroup_("Webinar") === "events"
 * deriveTargetGroup_("Search") === "contact"
 * deriveTargetGroup_("Referral") === null
 * ==========================================================
 */
function deriveTargetGroup_(businessSegment){

  const segment = String(businessSegment || "").trim();
  const groups = CONFIG.TARGET.SEGMENT_GROUPS;
  const groupNames = Object.keys(groups);

  for(let i = 0; i < groupNames.length; i++){

    if(groups[groupNames[i]].indexOf(segment) !== -1) return groupNames[i];

  }

  return null;

}


/**
 * ==========================================================
 * TEST — deriveTargetGroup_()
 * ==========================================================
 */
function testDeriveTargetGroup(){

  const cases = [
    ["Webinar", "events"],
    ["Seminar", "events"],
    ["BOFU", "contact"],
    ["Search", "contact"],
    ["Content", "content"],
    ["Referral", null],
    ["Other", null],
    ["", null]
  ];

  let pass = true;

  cases.forEach(function(c){

    const result = deriveTargetGroup_(c[0]);
    const ok = result === c[1];

    if(!ok) pass = false;

    Logger.log(c[0] + " => " + result + " (expected " + c[1] + ") " + (ok ? "✅" : "❌"));

  });

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Get Monday of Week (ISO 주, 월요일 시작)
 *
 * WHY
 * 주 = 월요일~일요일 고정(docs/TargetReportDesign.md §4, 변경 불가 제약).
 * 임의 날짜가 속한 주의 월요일을 시각(시분초) 없이 반환한다.
 *
 * @param {Date} date
 * @return {Date}
 *
 * TEST
 * getMondayOfWeek_(new Date(2026,6,30)) === 2026-07-27 (목요일 → 그 주 월요일)
 * getMondayOfWeek_(new Date(2026,7,2))  === 2026-07-27 (일요일 → 그 주 월요일)
 * ==========================================================
 */
function getMondayOfWeek_(date){

  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0=Sun .. 6=Sat
  const diff = (day === 0 ? -6 : 1) - day;

  d.setDate(d.getDate() + diff);

  return d;

}


/**
 * ==========================================================
 * TEST — getMondayOfWeek_()
 * ==========================================================
 */
function testGetMondayOfWeek(){

  const thursday = getMondayOfWeek_(new Date(2026, 6, 30)); // 2026-07-30 Thu
  const sunday = getMondayOfWeek_(new Date(2026, 7, 2));    // 2026-08-02 Sun
  const monday = getMondayOfWeek_(new Date(2026, 6, 27));   // 2026-07-27 Mon (자기 자신)

  const expected = new Date(2026, 6, 27);

  const pass =
    thursday.getTime() === expected.getTime() &&
    sunday.getTime() === expected.getTime() &&
    monday.getTime() === expected.getTime();

  Logger.log("Thu => " + thursday + " / Sun => " + sunday + " / Mon => " + monday);
  Logger.log("Expected all => " + expected);
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Add Days To Date (시각 없이 날짜만 이동)
 * ==========================================================
 */
function addDaysToDate_(date, days){

  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);

  return d;

}


/**
 * ==========================================================
 * Resolve Target FY To Calendar Year (2자리 FY → 실제 4자리 연도)
 *
 * WHY
 * JavaScript `Date` 생성자는 연도 인자가 0~99 사이면 자동으로 1900년대로
 * 해석한다(예: `new Date(26, 7, 1)` → 1926-08-01). CONFIG.TARGET의 FY 값은
 * 전부 2자리(27, 26 등)라 이 함정에 그대로 걸림 — 실측: generateCalendarWeeksForFY_()가
 * 1926년 날짜를 생성해 요일 정렬 자체가 틀어짐(2026-08-03 월요일이어야 할 게
 * 다른 요일로 나옴). 이 프로젝트의 FY는 전부 20XX년대이므로 2000을 더해 보정한다.
 *
 * TEST
 * resolveTargetFYCalendarYear_(26) === 2026
 * resolveTargetFYCalendarYear_(2026) === 2026 (이미 4자리면 그대로)
 * ==========================================================
 */
function resolveTargetFYCalendarYear_(fy){

  return fy < 100 ? 2000 + fy : fy;

}


/**
 * ==========================================================
 * TEST — resolveTargetFYCalendarYear_()
 * ==========================================================
 */
function testResolveTargetFYCalendarYear(){

  const a = resolveTargetFYCalendarYear_(26);
  const b = resolveTargetFYCalendarYear_(2026);

  const pass = a === 2026 && b === 2026;

  Logger.log("26 => " + a + " (expected 2026)");
  Logger.log("2026 => " + b + " (expected 2026)");
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Generate Calendar Weeks For Fiscal Year (월~일 주 전체 나열)
 *
 * WHY
 * Target_REP 리포트 영역 = 대상 FY의 월~일 주 전체(52~53행). 각 주의
 * 월 귀속은 그 주 월요일의 FY/Month(getFiscalYear/getFiscalMonthLabel
 * 재사용 — Fiscal Month 라벨은 실제로 그 달력월 그대로라 계산월과
 * 캘린더월이 1:1 대응한다, docs/TargetReportDesign.md §4/§6 참고).
 *
 * @param {number} targetFY  예: 27 (FY27 = 2026-08-01 ~ 2027-07-31)
 * @return {Array<{weekStart:Date, weekEnd:Date, fy:number, month:string}>}
 *
 * TEST
 * generateCalendarWeeksForFY_(27).length === 52 or 53
 * 첫 주 month === "AUG", 마지막 주 month === "JUL", weekStart 요일 === 월요일
 * ==========================================================
 */
function generateCalendarWeeksForFY_(targetFY){

  const fyStart = new Date(resolveTargetFYCalendarYear_(targetFY - 1), 7, 1); // Aug 1

  let monday = getMondayOfWeek_(fyStart);

  const weeks = [];
  let safety = 0;

  while(safety < 60){

    safety++;

    const fy = Number(getFiscalYear(monday).replace("FY", ""));

    if(fy > targetFY) break;

    if(fy === targetFY){

      weeks.push({
        weekStart: monday,
        weekEnd: addDaysToDate_(monday, 6),
        fy: fy,
        month: getFiscalMonthLabel(monday)
      });

    }

    monday = addDaysToDate_(monday, 7);

  }

  return weeks;

}


/**
 * ==========================================================
 * TEST — generateCalendarWeeksForFY_()
 * ==========================================================
 */
function testGenerateCalendarWeeksForFY(){

  const weeks = generateCalendarWeeksForFY_(27);

  const pass =
    (weeks.length === 52 || weeks.length === 53) &&
    weeks[0].month === "AUG" &&
    weeks[0].fy === 27 &&
    weeks[0].weekStart.getDay() === 1 && // 월요일
    weeks[0].weekStart.getFullYear() === 2026 && // 1926년 함정 재발 방지
    weeks[weeks.length - 1].month === "JUL" &&
    weeks[weeks.length - 1].fy === 27;

  Logger.log("Week count: " + weeks.length + " (expected 52 or 53)");
  Logger.log("First: " + weeks[0].weekStart + " => " + weeks[0].fy + " " + weeks[0].month + " (expected 27 AUG)");
  Logger.log(
    "Last: " + weeks[weeks.length - 1].weekStart + " => " +
    weeks[weeks.length - 1].fy + " " + weeks[weeks.length - 1].month + " (expected 27 JUL)"
  );
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Weeks-In-Month Counts (그 달의 주 수 = 월요일 개수)
 *
 * WHY
 * 월 목표 ÷ 그 달의 실제 주 수 = 주 목표 (docs/TargetReportDesign.md §4/§6).
 * 항상 4 또는 5이며, FY/Month 별로 실제 생성된 캘린더에서 집계해야
 * 정확하다(일반화된 "보통 4~5개" 가정이 아니라 실측).
 *
 * @param {Array<{fy:number, month:string}>} weeks
 * @return {Object}  key "fy|month" -> count
 *
 * TEST
 * 2026-08(FY27 AUG)은 월요일이 8/3·10·17·24·31로 5회 → count === 5
 * ==========================================================
 */
function computeWeeksInMonthCounts_(weeks){

  const counts = {};

  weeks.forEach(function(week){

    const key = week.fy + "|" + week.month;
    counts[key] = (counts[key] || 0) + 1;

  });

  return counts;

}


/**
 * ==========================================================
 * TEST — computeWeeksInMonthCounts_()
 * ==========================================================
 */
function testComputeWeeksInMonthCounts(){

  const weeks = generateCalendarWeeksForFY_(27);
  const counts = computeWeeksInMonthCounts_(weeks);

  const augCount = counts["27|AUG"];

  Logger.log("FY27 AUG week count: " + augCount + " (expected 5)");
  Logger.log(augCount === 5 ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Weighted Average (결측 FY는 자동 제외 후 재정규화)
 *
 * WHY
 * New P1 벤치마크(FY24·25·26=1:2:3)와 CPNP1 벤치마크(FY25·26=2:3)를
 * 하나의 공식으로 다룬다. 값이 undefined/null인 FY는 가중치까지
 * 함께 제외하고 나머지로 재정규화한다 — 예: 어떤 그룹×월에 CPNP1
 * 계산 분모(New P1)가 0이라 그 FY의 비율 자체가 정의되지 않는 셀은
 * 해당 FY 가중치를 빼고 나머지 FY만으로 평균낸다(docs/TargetReportDesign.md §7).
 *
 * @param {Object} valuesByKey  key -> number|undefined
 * @param {Array} keys
 * @param {Array<number>} weights
 * @return {number}  전부 결측이면 0
 *
 * TEST
 * computeWeightedAverage_({24:10,25:20,26:30}, [24,25,26], [1,2,3]) === 140/6
 * computeWeightedAverage_({25:20,26:30}, [24,25,26], [1,2,3]) === (2*20+3*30)/5  (24 결측 제외)
 * ==========================================================
 */
function computeWeightedAverage_(valuesByKey, keys, weights){

  let numerator = 0;
  let denominator = 0;

  keys.forEach(function(key, i){

    const value = valuesByKey[key];

    if(value === undefined || value === null) return;

    const weight = weights[i] || 0;

    numerator += value * weight;
    denominator += weight;

  });

  return denominator > 0 ? numerator / denominator : 0;

}


/**
 * ==========================================================
 * TEST — computeWeightedAverage_()
 * ==========================================================
 */
function testComputeWeightedAverage(){

  const a = computeWeightedAverage_({ 24: 10, 25: 20, 26: 30 }, [24, 25, 26], [1, 2, 3]);
  const expectedA = (1 * 10 + 2 * 20 + 3 * 30) / 6;

  const b = computeWeightedAverage_({ 25: 20, 26: 30 }, [24, 25, 26], [1, 2, 3]);
  const expectedB = (2 * 20 + 3 * 30) / 5;

  const c = computeWeightedAverage_({}, [24, 25, 26], [1, 2, 3]);

  const pass =
    Math.abs(a - expectedA) < 1e-9 &&
    Math.abs(b - expectedB) < 1e-9 &&
    c === 0;

  Logger.log("a=" + a + " (expected " + expectedA + ")");
  Logger.log("b=" + b + " (expected " + expectedB + ", FY24 결측 제외 후 재정규화)");
  Logger.log("c=" + c + " (expected 0, 전부 결측)");
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute FY P1 Target (그룹) — 공식 ①
 *
 * WHY
 * top-down 역산의 출발점: 마케팅 Revenue 타겟 × 그룹 딜 비중 ÷ 그룹
 * P1당 가치 (docs/TargetReportDesign.md §6).
 *
 * @param {number} revenueTarget
 * @param {number} dealShare
 * @param {number} p1Value
 * @return {number}  p1Value가 0이면 0 (분모 방어)
 * ==========================================================
 */
function computeFYP1Target_(revenueTarget, dealShare, p1Value){

  return p1Value > 0 ? (revenueTarget * dealShare) / p1Value : 0;

}


/**
 * ==========================================================
 * Compute Monthly P1 Target — 공식 ②
 * ==========================================================
 */
function computeMonthlyP1Target_(fyP1Target, seasonalityPct){

  return fyP1Target * seasonalityPct;

}


/**
 * ==========================================================
 * Compute Weekly P1 Target — 공식 ③
 * ==========================================================
 */
function computeWeeklyP1Target_(monthlyP1Target, weeksInMonth){

  return weeksInMonth > 0 ? monthlyP1Target / weeksInMonth : 0;

}


/**
 * ==========================================================
 * Compute Monthly CPNP1 Target — 공식 ④
 *
 * WHY
 * CPNP1은 낮을수록 좋으므로 성장률이 아니라 개선계수(<1.0)를 곱한다
 * (New P1 쪽 성장률 계수는 top-down 전환으로 폐기, docs/TargetReportDesign.md §6).
 * ==========================================================
 */
function computeMonthlyCPNP1Target_(cpnp1Benchmark, improvementFactor){

  return cpnp1Benchmark * improvementFactor;

}


/**
 * ==========================================================
 * TEST — Target Derivation 공식 체인 ①~④
 * ==========================================================
 */
function testTargetDerivationFormulas(){

  const fyTarget = computeFYP1Target_(9450000, 0.34, 992.80);
  const expectedFYTarget = (9450000 * 0.34) / 992.80;

  const monthlyTarget = computeMonthlyP1Target_(fyTarget, 0.1);
  const expectedMonthlyTarget = fyTarget * 0.1;

  const weeklyTarget = computeWeeklyP1Target_(monthlyTarget, 5);
  const expectedWeeklyTarget = monthlyTarget / 5;

  const monthlyCPNP1 = computeMonthlyCPNP1Target_(500, 0.9);
  const expectedMonthlyCPNP1 = 500 * 0.9;

  const guardZeroP1Value = computeFYP1Target_(9450000, 0.34, 0);
  const guardZeroWeeks = computeWeeklyP1Target_(100, 0);

  const pass =
    Math.abs(fyTarget - expectedFYTarget) < 1e-9 &&
    Math.abs(monthlyTarget - expectedMonthlyTarget) < 1e-9 &&
    Math.abs(weeklyTarget - expectedWeeklyTarget) < 1e-9 &&
    Math.abs(monthlyCPNP1 - expectedMonthlyCPNP1) < 1e-9 &&
    guardZeroP1Value === 0 &&
    guardZeroWeeks === 0;

  Logger.log("FY P1 Target: " + fyTarget + " (expected " + expectedFYTarget + ")");
  Logger.log("Monthly P1 Target: " + monthlyTarget + " (expected " + expectedMonthlyTarget + ")");
  Logger.log("Weekly P1 Target: " + weeklyTarget + " (expected " + expectedWeeklyTarget + ")");
  Logger.log("Monthly CPNP1 Target: " + monthlyCPNP1 + " (expected " + expectedMonthlyCPNP1 + ")");
  Logger.log("Guard (p1Value=0): " + guardZeroP1Value + " (expected 0)");
  Logger.log("Guard (weeksInMonth=0): " + guardZeroWeeks + " (expected 0)");
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Parse Currency Value (외부 시트 "$1,234.56" 등 문자열/숫자 방어적 파싱)
 *
 * WHY
 * 채널시트/Naver 시트는 우리 파이프라인 밖의 외부 파일이라 셀 서식이
 * 통화 숫자든 문자열이든 그대로 신뢰하지 않고 방어적으로 파싱한다.
 *
 * TEST
 * parseCurrencyValue_("$1,234.56") === 1234.56
 * parseCurrencyValue_(1234.56) === 1234.56
 * parseCurrencyValue_("") === 0
 * ==========================================================
 */
function parseCurrencyValue_(value){

  if(typeof value === "number") return value;

  const num = Number(String(value || "").replace(/[^0-9.\-]/g, ""));

  return isNaN(num) ? 0 : num;

}


/**
 * ==========================================================
 * TEST — parseCurrencyValue_()
 * ==========================================================
 */
function testParseCurrencyValue(){

  const cases = [
    ["$1,234.56", 1234.56],
    [1234.56, 1234.56],
    ["", 0],
    [null, 0],
    ["$0.00", 0]
  ];

  let pass = true;

  cases.forEach(function(c){

    const result = parseCurrencyValue_(c[0]);
    const ok = Math.abs(result - c[1]) < 1e-9;

    if(!ok) pass = false;

    Logger.log(JSON.stringify(c[0]) + " => " + result + " (expected " + c[1] + ") " + (ok ? "✅" : "❌"));

  });

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Open Target External Sheet By Gid (탭 이름이 아닌 gid로 매칭)
 *
 * WHY
 * 채널시트/Naver/Deal Tracker 탭 이름은 실무 중 바뀔 수 있어 gid(sheetId)로
 * 찾는다 (docs/TargetReportDesign.md §3 "실물 구조 확인" 참고). 채널시트/Naver와
 * Deal Tracker는 서로 다른 파일이라 spreadsheetId를 인자로 받는다
 * (2026-07-27 Deal Tracker 연동 추가하며 일반화).
 *
 * @param {string} spreadsheetId
 * @param {number} gid
 * @return {Sheet|null}
 * ==========================================================
 */
function openTargetExternalSheetByGid_(spreadsheetId, gid){

  const file = SpreadsheetApp.openById(spreadsheetId);
  const sheets = file.getSheets();

  for(let i = 0; i < sheets.length; i++){

    if(sheets[i].getSheetId() === gid) return sheets[i];

  }

  return null;

}


/**
 * ==========================================================
 * Read Channel Sheet Raw Rows (전체 행, FY/날짜 필터 없음)
 *
 * WHY
 * 벤치마크(월 합산, FY 필터)와 실적(주 단위, 정확한 날짜 매칭)이 둘 다
 * 채널시트를 원본으로 쓰므로, 원시 행 읽기를 한 곳에 두고 두 용도에서
 * 재사용한다 (91_TargetReport.js의 주간 실적 매칭도 이 함수를 그대로 씀).
 *
 * @return {Array<{startDate:Date, events:number, contact:number, content:number}>}
 * ==========================================================
 */
function readChannelRawRows_(){

  const sheet = openTargetExternalSheetByGid_(
    CONFIG.TARGET.EXTERNAL.SPREADSHEET_ID, CONFIG.TARGET.EXTERNAL.CHANNEL_SHEET_GID
  );

  if(!sheet) return [];

  const cols = CONFIG.TARGET.EXTERNAL.CHANNEL_COLUMNS;
  const values = sheet.getDataRange().getValues();

  const rows = [];

  for(let r = 1; r < values.length; r++){

    const row = values[r];
    const startDate = row[cols.START_DATE - 1];

    if(!(startDate instanceof Date) || isNaN(startDate.getTime())) continue;

    rows.push({
      startDate: startDate,
      events: parseCurrencyValue_(row[cols.EVENT_SPENT - 1]),
      contact: parseCurrencyValue_(row[cols.CONTACT_SPENT - 1]),
      content: parseCurrencyValue_(row[cols.CONTENT_SPENT - 1])
    });

  }

  return rows;

}


/**
 * ==========================================================
 * Read Naver Sheet Raw Rows (전체 행, FY/날짜 필터 없음)
 *
 * @return {Array<{startDate:Date, spentNZD:number}>}
 * ==========================================================
 */
function readNaverRawRows_(){

  const sheet = openTargetExternalSheetByGid_(
    CONFIG.TARGET.EXTERNAL.SPREADSHEET_ID, CONFIG.TARGET.EXTERNAL.NAVER_SHEET_GID
  );

  if(!sheet) return [];

  const cols = CONFIG.TARGET.EXTERNAL.NAVER_COLUMNS;
  const values = sheet.getDataRange().getValues();

  const rows = [];

  for(let r = 1; r < values.length; r++){

    const row = values[r];
    const startDate = row[cols.START_DATE - 1];

    if(!(startDate instanceof Date) || isNaN(startDate.getTime())) continue;

    rows.push({
      startDate: startDate,
      spentNZD: parseCurrencyValue_(row[cols.SPENT_NZD - 1])
    });

  }

  return rows;

}


/**
 * ==========================================================
 * Parse Deal Tracker Close Date (Plain Text 문자열 우선, Date 객체도 방어)
 *
 * WHY
 * 딜트래커에 FY 컬럼이 없어 Close Date에서 직접 FY를 파생해야 함(2026-07-27
 * 시트 재구축). Close Date는 "24/7/2026"(DD/MM/YYYY) Plain Text로 붙여넣도록
 * 안내했으나(docs/DateParsing.md), 혹시 Sheets가 이미 Date로 자동 변환했을
 * 경우도 방어적으로 처리 — 문자열이면 parseDMY()(16_TransformHelper.js)로
 * 안전하게 파싱, 이미 Date 객체면 그대로 신뢰.
 *
 * @param {string|Date} value
 * @return {Date|null}
 * ==========================================================
 */
function parseDealTrackerCloseDate_(value){

  if(value instanceof Date && !isNaN(value.getTime())) return value;

  if(typeof value === "string" && value.trim() !== ""){
    return parseDMY(value.trim());
  }

  return null;

}


/**
 * ==========================================================
 * Read Deal Tracker Raw Rows (전체 행, FY 필터 없음 — 계산 단계에서 필터)
 *
 * WHY
 * Block B(P1당 가치)/C(딜 비중) 실데이터 원천. 2026-07-27 아키텍처 전환:
 * Leads_OPS 개별 리드 매칭(Student/Guardian Email/Account Name)을 전부
 * 폐기 — Sales팀 확인 결과 상담 후 이메일이 Salesforce에서 덮어써져 원본
 * 마케팅 터치 이메일이 시스템적으로 복구 불가능한 경우가 있어 매칭 자체가
 * 근본적으로 신뢰 불가. 대신 Deal Tracker를 Source of Truth로 삼아, 딜
 * 자체에 기록된 Lead Source/Source Category/Lead Source Detail로
 * getBusinessSegment()(16_TransformHelper.js)를 직접 호출해 세그먼트를
 * 분류한다 — classifyDealSegment_() 참고. P1 판정은 하지 않음(사용자 확인:
 * 딜트래커 딜의 99%가 이미 P1이라 사실상 전수 반영과 동일).
 *
 * closeFY/createdFY는 Close Date/Created Date 컬럼(실제 Date 타입 셀로
 * 확인됨 — 더블클릭 시 캘린더 위젯 표시, 텍스트 파싱 불필요/불확실성 없음)
 * 에서 getFiscalYear()로 직접 파생한다. 2026-07-27 사용자 확정: 딜 비중은
 * "코호트1"(closeFY===createdFY===타겟FY, 같은 해 생성·클로징)만 사용하고,
 * "코호트2"(closeFY===타겟FY, createdFY<타겟FY, 과거 리드가 이번 해에
 * 클로징된 파이프라인 기여분)는 P1당 가치의 PrevP1V 계산에 별도로 쓴다
 * (computeDealCohortsFromDealRows_() 참고). 예전 "FY" 텍스트 컬럼은 더 이상
 * 안 씀(Close Date에서 직접 파생하는 게 더 신뢰할 수 있음).
 *
 * @return {Array<{closeFY:number, createdFY:number|null, revenue:number, leadSource:string, sourceCategory:string, leadSourceDetail:string}>}
 * ==========================================================
 */
function readDealTrackerRawRows_(){

  const config = CONFIG.TARGET.EXTERNAL.DEAL_TRACKER;

  const sheet = openTargetExternalSheetByGid_(config.SPREADSHEET_ID, config.SHEET_GID);

  if(!sheet) return [];

  const cols = config.COLUMNS;
  const values = sheet.getDataRange().getValues();

  const rows = [];

  for(let r = 1; r < values.length; r++){

    const row = values[r];

    const closeDate = row[cols.CLOSE_DATE - 1];

    if(!(closeDate instanceof Date) || isNaN(closeDate.getTime())) continue;

    const closeFY = Number(getFiscalYear(closeDate).replace("FY", ""));

    if(!closeFY) continue;

    const createdDate = row[cols.CREATED_DATE - 1];

    const createdFY =
      (createdDate instanceof Date && !isNaN(createdDate.getTime()))
        ? Number(getFiscalYear(createdDate).replace("FY", ""))
        : null;

    rows.push({
      closeFY: closeFY,
      createdFY: createdFY || null,
      revenue: parseCurrencyValue_(row[cols.REVENUE - 1]),
      leadSource: String(row[cols.LEAD_SOURCE - 1] || "").trim().toLowerCase(),
      sourceCategory: String(row[cols.SOURCE_CATEGORY - 1] || "").trim(),
      leadSourceDetail: String(row[cols.LEAD_SOURCE_DETAIL - 1] || "").trim()
    });

  }

  return rows;

}


/**
 * ==========================================================
 * Compute Combined Spent By Group/FY/Month (Block A 벤치마크용 — CPNP1_FYS만)
 *
 * roughMonthlySum — 각 행의 Start Date가 속한 (fy, month)로 귀속시켜 합산
 * (구방식 일~토/신방식 월~일 무관, docs/TargetReportDesign.md §7).
 *
 * @return {Object}  group -> fy -> month -> spentSum(NZD)
 * ==========================================================
 */
function computeCombinedSpentByGroupFYMonth_(){

  const result = {};
  const cpnp1FYs = CONFIG.TARGET.BENCHMARK.CPNP1_FYS;

  const addToResult = function(group, startDate, spent){

    const fy = Number(getFiscalYear(startDate).replace("FY", ""));

    if(cpnp1FYs.indexOf(fy) === -1) return;

    const month = getFiscalMonthLabel(startDate);

    if(!result[group]) result[group] = {};
    if(!result[group][fy]) result[group][fy] = {};

    result[group][fy][month] = (result[group][fy][month] || 0) + spent;

  };

  readChannelRawRows_().forEach(function(row){

    addToResult("events", row.startDate, row.events);
    addToResult("contact", row.startDate, row.contact);
    addToResult("content", row.startDate, row.content);

  });

  readNaverRawRows_().forEach(function(row){

    addToResult("contact", row.startDate, row.spentNZD);

  });

  return result;

}


/**
 * ==========================================================
 * Build Combined Weekly Spent By Date Key (Target_REP 주간 실적 매칭용)
 *
 * WHY
 * 2026-08-03 사이클 전환 이후 주는 채널시트/Naver 행과 Week Start가
 * 정확히 1:1 매칭된다(docs/TargetReportDesign.md §8). FY/월 집계가 아니라
 * "이 정확한 날짜의 행"이 필요해서 raw row를 그대로 날짜 키로 색인한다.
 *
 * @return {Object}  "yyyy-MM-dd"(Week Start) -> {events, contact, content}
 * ==========================================================
 */
function buildCombinedWeeklySpentByDateKey_(){

  const result = {};

  const toKey = function(date){
    return Utilities.formatDate(date, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd");
  };

  readChannelRawRows_().forEach(function(row){

    const key = toKey(row.startDate);

    if(!result[key]) result[key] = { events: 0, contact: 0, content: 0 };

    result[key].events += row.events;
    result[key].contact += row.contact;
    result[key].content += row.content;

  });

  readNaverRawRows_().forEach(function(row){

    const key = toKey(row.startDate);

    if(!result[key]) result[key] = { events: 0, contact: 0, content: 0 };

    result[key].contact += row.spentNZD;

  });

  return result;

}


/**
 * ==========================================================
 * Compute Target Leads_OPS Aggregates (New P1 벤치마크 원천 + P1당 가치 분모)
 *
 * WHY
 * Leads_OPS를 1회 스캔(Article 10: Read Once)해서 New P1 벤치마크 대상
 * FY(24·25·26)의 (group, fy, month)별 카운트, P1당 가치 산출 대상 FY
 * (CONFIG.TARGET.P1_VALUE_FY = 26)의 (group)별 New P1 수, 그리고 all-time
 * (group)별 총 P1 수를 집계한다(NewP1_REP computeNewP1Aggregates_() 패턴,
 * 40_NewP1Report.js). 2026-07-27 이전엔 Deal Tracker 매칭용 Email/Account
 * Name→그룹 맵도 여기서 함께 만들었으나, Deal Tracker 매칭 아키텍처 자체를
 * 폐기(classifyDealSegment_()로 대체, Leads_OPS 조회 불필요)하면서 제거됨
 * — CLAUDE.md #7 참고.
 *
 * WHY (2026-07-27 코호트1/2 P1당 가치 전환)
 * P1당 가치의 Revenue는 더 이상 Leads_OPS의 Revenue 필드가 아니라 Deal
 * Tracker의 Cohort1/Cohort2 Revenue를 쓴다(computeDealCohortsFromDealRows_
 * 참고) — 이 함수는 그 분모(New P1 수, all-time 총 P1 수)만 제공한다.
 * totalP1CountByGroup은 Create Date 유효 여부와 무관하게 isEffectiveP1_()을
 * 만족하는 모든 리드를 센다(all-time 총량이라 특정 FY 필터가 없어야 함).
 *
 * @return {{newP1CountsByGroupFYMonth: Object, newP1CountByGroup: Object, totalP1CountByGroup: Object}}
 * ==========================================================
 */
function computeTargetLeadsOPSAggregates_(){

  const newP1CountsByGroupFYMonth = {};
  const newP1CountByGroup = {};
  const totalP1CountByGroup = {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(OPS.SHEET.OPS);

  if(!sheet){
    return {
      newP1CountsByGroupFYMonth: newP1CountsByGroupFYMonth,
      newP1CountByGroup: newP1CountByGroup,
      totalP1CountByGroup: totalP1CountByGroup
    };
  }

  const records = sheetToObjects(sheet);

  const benchmarkFYs = CONFIG.TARGET.BENCHMARK.NEWP1_FYS;
  const valueFY = CONFIG.TARGET.P1_VALUE_FY;

  records.forEach(function(record){

    const group = deriveTargetGroup_(record["Business Segment"]);

    if(!group) return;

    if(!isEffectiveP1_(record["Lead Priority"], record["Priority Override"])) return;

    totalP1CountByGroup[group] = (totalP1CountByGroup[group] || 0) + 1;

    const createDate = record["Create Date"];

    if(!(createDate instanceof Date) || isNaN(createDate.getTime())) return;

    const fy = Number(getFiscalYear(createDate).replace("FY", ""));
    const month = getFiscalMonthLabel(createDate);

    if(benchmarkFYs.indexOf(fy) !== -1){

      if(!newP1CountsByGroupFYMonth[group]) newP1CountsByGroupFYMonth[group] = {};
      if(!newP1CountsByGroupFYMonth[group][fy]) newP1CountsByGroupFYMonth[group][fy] = {};

      newP1CountsByGroupFYMonth[group][fy][month] =
        (newP1CountsByGroupFYMonth[group][fy][month] || 0) + 1;

    }

    if(fy === valueFY){
      newP1CountByGroup[group] = (newP1CountByGroup[group] || 0) + 1;
    }

  });

  return {
    newP1CountsByGroupFYMonth: newP1CountsByGroupFYMonth,
    newP1CountByGroup: newP1CountByGroup,
    totalP1CountByGroup: totalP1CountByGroup
  };

}


/**
 * ==========================================================
 * Compute CPNP1 Ratio By FY/Month (분모=New P1이 0이면 그 셀은 결측)
 *
 * @param {Object} spentByFYMonth       fy -> month -> spent
 * @param {Object} newP1CountsByFYMonth fy -> month -> count
 * @param {Array<number>} fys
 * @return {Object}  fy -> month -> ratio (count===0이면 그 month 키 없음)
 * ==========================================================
 */
function computeCPNP1RatioByFYMonth_(spentByFYMonth, newP1CountsByFYMonth, fys){

  const ratios = {};

  fys.forEach(function(fy){

    const spentMonths = (spentByFYMonth && spentByFYMonth[fy]) || {};
    const countMonths = (newP1CountsByFYMonth && newP1CountsByFYMonth[fy]) || {};

    ratios[fy] = {};

    CONFIG.ACQ.FISCAL_MONTH_ORDER.forEach(function(month){

      const count = countMonths[month] || 0;

      if(count > 0){

        ratios[fy][month] = (spentMonths[month] || 0) / count;

      }

    });

  });

  return ratios;

}


/**
 * ==========================================================
 * Compute Benchmark Block Rows (Block A — 그룹×월 New P1/시즌성/CPNP1)
 *
 * @param {Object} newP1CountsByGroupFYMonth
 * @param {Object} spentByGroupFYMonth
 * @return {Array<Object>}  36행(3그룹×12개월), sortIndex 없이 그룹→월(Fiscal 순서) 순
 * ==========================================================
 */
function computeBenchmarkBlockRows_(newP1CountsByGroupFYMonth, spentByGroupFYMonth){

  const rows = [];

  const newP1FYs = CONFIG.TARGET.BENCHMARK.NEWP1_FYS;
  const newP1Weights = CONFIG.TARGET.BENCHMARK.NEWP1_WEIGHTS;
  const cpnp1FYs = CONFIG.TARGET.BENCHMARK.CPNP1_FYS;
  const cpnp1Weights = CONFIG.TARGET.BENCHMARK.CPNP1_WEIGHTS;

  CONFIG.TARGET.GROUP_ORDER.forEach(function(group){

    const countsByFYMonth = newP1CountsByGroupFYMonth[group] || {};
    const spentByFYMonth = (spentByGroupFYMonth && spentByGroupFYMonth[group]) || {};

    const cpnp1Ratios = computeCPNP1RatioByFYMonth_(spentByFYMonth, countsByFYMonth, cpnp1FYs);

    const weightedNewP1ByMonth = {};

    CONFIG.ACQ.FISCAL_MONTH_ORDER.forEach(function(month){

      const valuesByFY = {};

      newP1FYs.forEach(function(fy){

        const monthCounts = countsByFYMonth[fy] || {};
        valuesByFY[fy] = monthCounts[month] || 0;

      });

      weightedNewP1ByMonth[month] = computeWeightedAverage_(valuesByFY, newP1FYs, newP1Weights);

    });

    const totalWeightedNewP1 = CONFIG.ACQ.FISCAL_MONTH_ORDER.reduce(function(sum, month){
      return sum + weightedNewP1ByMonth[month];
    }, 0);

    CONFIG.ACQ.FISCAL_MONTH_ORDER.forEach(function(month){

      const newP1ByFY = newP1FYs.map(function(fy){

        const monthCounts = countsByFYMonth[fy] || {};
        return monthCounts[month] || 0;

      });

      const weightedAvgNewP1 = weightedNewP1ByMonth[month];
      const seasonalityPct = totalWeightedNewP1 > 0 ? weightedAvgNewP1 / totalWeightedNewP1 : 0;

      const cpnp1ValuesByFY = {};

      cpnp1FYs.forEach(function(fy){
        cpnp1ValuesByFY[fy] = cpnp1Ratios[fy] ? cpnp1Ratios[fy][month] : undefined;
      });

      const cpnp1Benchmark = computeWeightedAverage_(cpnp1ValuesByFY, cpnp1FYs, cpnp1Weights);

      rows.push({
        group: group,
        month: month,
        newP1ByFY: newP1ByFY,
        weightedAvgNewP1: weightedAvgNewP1,
        seasonalityPct: seasonalityPct,
        cpnp1Benchmark: cpnp1Benchmark
      });

    });

  });

  return rows;

}


/**
 * ==========================================================
 * TEST — computeBenchmarkBlockRows_() (합성 데이터, 원본 스캔 없이 순수 로직만 검증)
 * ==========================================================
 */
function testComputeBenchmarkBlockRows(){

  const counts = {
    events: {
      24: { AUG: 10 },
      25: { AUG: 20 },
      26: { AUG: 30 }
    }
  };

  const spent = {
    events: {
      25: { AUG: 2000 },
      26: { AUG: 3000 }
    }
  };

  const rows = computeBenchmarkBlockRows_(counts, spent);

  const augRow = rows.filter(function(r){ return r.group === "events" && r.month === "AUG"; })[0];

  const expectedWeightedAvg = (1 * 10 + 2 * 20 + 3 * 30) / 6; // 23.333...
  const expectedCPNP1 = (2 * (2000 / 20) + 3 * (3000 / 30)) / 5; // (2*100+3*100)/5 = 100

  const pass =
    rows.length === CONFIG.TARGET.GROUP_ORDER.length * 12 &&
    Math.abs(augRow.weightedAvgNewP1 - expectedWeightedAvg) < 1e-6 &&
    Math.abs(augRow.cpnp1Benchmark - expectedCPNP1) < 1e-6 &&
    augRow.seasonalityPct > 0;

  Logger.log("Row count: " + rows.length + " (expected " + (CONFIG.TARGET.GROUP_ORDER.length * 12) + ")");
  Logger.log("AUG weightedAvgNewP1: " + augRow.weightedAvgNewP1 + " (expected " + expectedWeightedAvg + ")");
  Logger.log("AUG cpnp1Benchmark: " + augRow.cpnp1Benchmark + " (expected " + expectedCPNP1 + ")");
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute P1 Value Block Rows (Block B — 코호트1/2 이원화)
 *
 * WHY
 * 2026-07-27 사용자 확정 프레임워크: "이번 FY 총 딜 = 이번 FY 생성된 리드
 * 코호트(코호트1) + 더 오래된 리드 코호트(코호트2)". CurrentFYP1V(a) =
 * 코호트1 Revenue ÷ 이번 FY New P1 수, PrevP1V(b) = 코호트2 Revenue ÷
 * (all-time 총 P1 수 − 이번 FY New P1 수). 두 값을 각각 계산해 나란히
 * 노출만 하고, 최종 타겟 공식에서 a/b를 어떻게 합칠지는 사용자가 두 값을
 * 직접 보고 나중에 결정하기로 함(현재는 computeTargetDerivationRows_()에서
 * a를 임시 placeholder로 사용).
 *
 * @param {Object} dealCohortsByGroup  group -> {cohort1Revenue, cohort2Revenue} (computeDealCohortsFromDealRows_)
 * @param {Object} newP1CountByGroup   group -> 이번 FY New P1 수
 * @param {Object} totalP1CountByGroup group -> all-time 총 P1 수
 * @return {Array<Object>}
 * ==========================================================
 */
function computeP1ValueBlockRows_(dealCohortsByGroup, newP1CountByGroup, totalP1CountByGroup){

  return CONFIG.TARGET.GROUP_ORDER.map(function(group){

    const cohort = dealCohortsByGroup[group] || { cohort1Revenue: 0, cohort2Revenue: 0 };
    const newP1Count = newP1CountByGroup[group] || 0;
    const totalP1Count = totalP1CountByGroup[group] || 0;
    const prevP1Count = Math.max(totalP1Count - newP1Count, 0);

    const currentFYP1V = newP1Count > 0 ? cohort.cohort1Revenue / newP1Count : 0;
    const prevP1V = prevP1Count > 0 ? cohort.cohort2Revenue / prevP1Count : 0;

    return {
      group: group,
      newP1Count: newP1Count,
      cohort1Revenue: cohort.cohort1Revenue,
      currentFYP1V: currentFYP1V,
      prevP1Count: prevP1Count,
      cohort2Revenue: cohort.cohort2Revenue,
      prevP1V: prevP1V
    };

  });

}


/**
 * ==========================================================
 * TEST — computeP1ValueBlockRows_() (합성 데이터, 코호트1/2 이원화 검증)
 * ==========================================================
 */
function testComputeP1ValueBlockRows(){

  const dealCohortsByGroup = {
    events: { cohort1Revenue: 100000, cohort2Revenue: 20000 }
  };

  const newP1CountByGroup = { events: 100 };
  const totalP1CountByGroup = { events: 300 };

  const rows = computeP1ValueBlockRows_(dealCohortsByGroup, newP1CountByGroup, totalP1CountByGroup);

  const eventsRow = rows.filter(function(r){ return r.group === "events"; })[0];
  const otherRow = rows.filter(function(r){ return r.group === "contact"; })[0];

  const pass =
    eventsRow.prevP1Count === 200 && // 300 - 100
    Math.abs(eventsRow.currentFYP1V - 1000) < 1e-6 && // 100000 / 100
    Math.abs(eventsRow.prevP1V - 100) < 1e-6 && // 20000 / 200
    otherRow.currentFYP1V === 0 &&
    otherRow.prevP1V === 0;

  Logger.log("events CurrentFYP1V(a): " + eventsRow.currentFYP1V + " (expected 1000)");
  Logger.log("events PrevP1V(b): " + eventsRow.prevP1V + " (expected 100)");
  Logger.log("contact(무데이터) a/b: " + otherRow.currentFYP1V + "/" + otherRow.prevP1V + " (expected 0/0)");
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Classify Deal Segment (Deal Tracker 자체 필드로 직접 분류 — Leads_OPS 매칭 없음)
 *
 * WHY
 * 2026-07-27 아키텍처 전환: Student Contact Email/Primary Guardian Email/
 * Account Name을 Leads_OPS와 매칭하던 접근을 전부 폐기했다 — Sales팀 확인
 * 결과, 상담 종료 후 학부모가 이메일 변경을 요청하면 Salesforce의 Lead/
 * Opportunity 이메일이 그대로 덮어써져 원본 마케팅 터치 이메일이 시스템적
 * 으로 복구 불가능한 경우가 있어(Ryan Kang 등 실측 사례) 개별 리드 매칭
 * 자체가 근본적으로 신뢰할 수 없었다. Deal Tracker는 애초에 모든 Opportunity
 * 를 담고 있으므로(사용자 판단), 개별 리드 식별 없이 딜 자체에 기록된
 * Lead Source Detail(campaign/detail 이중 사용 — 이 시트엔 별도 UTM Campaign
 * 컬럼이 없음)/Lead Source/Source Category를 getBusinessSegment()
 * (16_TransformHelper.js, 프로젝트 공용 분류 로직)에 그대로 넣어 세그먼트를
 * 직접 분류한다. 93_TempQA_DealTrackerMatch.js도 동일 로직을 재사용해야
 * QA 시트와 실제 계산이 어긋나지 않는다.
 *
 * @param {{leadSource:string, sourceCategory:string, leadSourceDetail:string}} row
 * @return {string|null}  그룹(events/contact/content) 또는 분류 불가 시 null
 * ==========================================================
 */
function classifyDealSegment_(row){

  const segment = getBusinessSegment(
    row.leadSourceDetail, row.leadSourceDetail, row.leadSource, row.sourceCategory
  );

  return deriveTargetGroup_(segment);

}


/**
 * ==========================================================
 * Compute Deal Share Ratios From Deal Rows (순수 계산 — 코호트1 전용)
 *
 * WHY
 * §5 "세그먼트 딜 비중": 조정 베이스(전체 딜 − 세일즈 레퍼럴·업셀) 대비 그룹별
 * Revenue 비중을 구한다. **2026-07-27 사용자 확정**: "코호트1"(Create Date·
 * Close Date 둘 다 타겟 FY인 딜 — 같은 해에 생성돼 같은 해에 클로징된 것)만
 * 사용한다 — "내년에 들어온 리드 중 얼마나가 그 해 안에 클로징될지"를 보려면
 * 같은 해 생성·클로징 딜만 봐야 한다는 논리. 과거에 생성돼 이번 해에
 * 클로징된 딜(코호트2, 파이프라인 기여분)은 여기 안 섞고 P1당 가치의
 * PrevP1V에서 별도로 다룬다(computeDealCohortsFromDealRows_() 참고). 원래는
 * Close Date만 기준으로 한 3FY median이었으나 실측 결과(median 기준 contact
 * 20.9% vs FY26 단독 31.3%) 최근 연도와 괴리가 커서 폐기됨. 그룹 분류는
 * classifyDealSegment_()로 딜 자체 필드에서 직접 이뤄진다(Leads_OPS 매칭
 * 없음) — 분류 안 되는 딜은 조정 베이스(분모)엔 포함되지만 특정 그룹(분자)
 * 엔 배분되지 않는다(분류율은 로그로 확인 가능).
 *
 * @param {Array<{closeFY:number, createdFY:number|null, revenue:number, leadSource:string, sourceCategory:string, leadSourceDetail:string}>} dealRows
 * @return {Object}  group -> ratio (0~1)
 *
 * TEST
 * FY26 코호트1 events=100/300 (조정 베이스 300 중 events 100 배분, 나머지는 분류 안 됨 등)
 * ==========================================================
 */
function computeDealShareRatiosFromDealRows_(dealRows){

  const config = CONFIG.TARGET.EXTERNAL.DEAL_TRACKER;
  const targetFY = CONFIG.TARGET.P1_VALUE_FY;

  const excludeSet = {};
  config.EXCLUDE_LEAD_SOURCES.forEach(function(src){ excludeSet[src] = true; });

  let base = 0;
  const byGroup = { events: 0, contact: 0, content: 0 };

  let classifiedCount = 0;
  let unclassifiedCount = 0;

  dealRows.forEach(function(row){

    if(row.closeFY !== targetFY || row.createdFY !== targetFY) return; // 코호트1만
    if(excludeSet[String(row.leadSource || "").toLowerCase()]) return;

    base += row.revenue;

    const group = classifyDealSegment_(row);

    if(group){
      byGroup[group] += row.revenue;
      classifiedCount++;
    } else {
      unclassifiedCount++;
    }

  });

  Logger.log(
    CONFIG.LOG.PREFIX + " Deal Tracker classify (FY" + targetFY + " 코호트1 — 같은 해 생성·클로징): " +
    classifiedCount + " classified / " + unclassifiedCount + " unclassified " +
    "(Lead Source Detail/Lead Source/Source Category로 세그먼트 분류 안 된 건수)"
  );

  const result = {};

  CONFIG.TARGET.GROUP_ORDER.forEach(function(group){
    result[group] = base > 0 ? byGroup[group] / base : 0;
  });

  return result;

}


/**
 * ==========================================================
 * TEST — computeDealShareRatiosFromDealRows_() (합성 데이터)
 * ==========================================================
 */
/**
 * ==========================================================
 * TEST — classifyDealSegment_() (딜 자체 필드로 직접 분류, Leads_OPS 매칭 없음)
 * ==========================================================
 */
function testClassifyDealSegment(){

  const webinarMatch = classifyDealSegment_({
    leadSource: "Paid Social", sourceCategory: "", leadSourceDetail: "Registered for webinar session"
  });

  const searchMatch = classifyDealSegment_({
    leadSource: "Paid Search", sourceCategory: "Naver Search", leadSourceDetail: ""
  });

  const contentMatch = classifyDealSegment_({
    leadSource: "Organic", sourceCategory: "", leadSourceDetail: "ebook-download-2025"
  });

  const noMatch = classifyDealSegment_({
    leadSource: "", sourceCategory: "", leadSourceDetail: ""
  });

  const pass =
    webinarMatch === "events" &&
    searchMatch === "contact" &&
    contentMatch === "content" &&
    noMatch === null;

  Logger.log("Webinar(Lead Source Detail) 분류: " + webinarMatch + " (expected events)");
  Logger.log("Search(Lead Source) 분류: " + searchMatch + " (expected contact)");
  Logger.log("Content(ebook) 분류: " + contentMatch + " (expected content)");
  Logger.log("전부 공백 → 분류 불가: " + noMatch + " (expected null)");
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


function testComputeDealShareRatiosFromDealRows(){

  const dealRows = [
    // 코호트1 (closeFY===createdFY===26) — Deal Share 계산에 포함되는 것들
    { closeFY: 26, createdFY: 26, revenue: 100, leadSource: "webinar", sourceCategory: "", leadSourceDetail: "registered for webinar" },
    { closeFY: 26, createdFY: 26, revenue: 100, leadSource: "paid search", sourceCategory: "", leadSourceDetail: "" },
    { closeFY: 26, createdFY: 26, revenue: 200, leadSource: "organic", sourceCategory: "", leadSourceDetail: "ebook-download" },
    { closeFY: 26, createdFY: 26, revenue: 50, leadSource: "organic", sourceCategory: "", leadSourceDetail: "" }, // 분류 안 됨
    { closeFY: 26, createdFY: 26, revenue: 9999, leadSource: "Upsell", sourceCategory: "", leadSourceDetail: "" }, // 제외 대상
    // 코호트2 (closeFY=26이지만 createdFY=25) — Deal Share 계산에서 완전 제외돼야 함
    { closeFY: 26, createdFY: 25, revenue: 9999, leadSource: "webinar", sourceCategory: "", leadSourceDetail: "registered for webinar" },
    // closeFY가 타겟 FY(26)가 아님 — 제외
    { closeFY: 25, createdFY: 25, revenue: 9999, leadSource: "webinar", sourceCategory: "", leadSourceDetail: "registered for webinar" }
  ];

  const result = computeDealShareRatiosFromDealRows_(dealRows);

  const expectedEvents = 100 / 450; // 코호트1 base = 100+100+200+50(분류 안 됨) = 450

  const pass = Math.abs(result.events - expectedEvents) < 1e-6;

  Logger.log("events dealShare: " + result.events + " (expected ~" + expectedEvents + ")");
  Logger.log("contact dealShare: " + result.contact);
  Logger.log("content dealShare: " + result.content);
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Deal Cohorts From Deal Rows (Block B 원천 — 코호트1/2 Revenue 분리)
 *
 * WHY
 * 2026-07-27 사용자 확정: Close Date가 타겟 FY인 딜을, Create Date도 같은
 * 타겟 FY인지(코호트1 — 같은 해 생성·클로징) 아닌지(코호트2 — 과거 생성,
 * 이번 FY에 클로징된 파이프라인 기여분)로 나눠 그룹별 Revenue를 각각
 * 합산한다. computeDealShareRatiosFromDealRows_()와 그룹 분류 로직
 * (classifyDealSegment_(), 세일즈 레퍼럴/업셀 제외)은 동일하되, 코호트2도
 * 함께 계산한다는 점이 다르다 — Deal Share는 코호트1만 쓰지만 P1당 가치는
 * 코호트1(a)과 코호트2(b)를 모두 필요로 하기 때문(§5 Open Item 참고).
 * 분류 안 되는 딜(classifyDealSegment_()가 null)은 어느 그룹에도 배분하지
 * 않는다(그룹별 Revenue라 분모 개념이 없어 Deal Share처럼 별도 베이스 집계 불필요).
 *
 * @param {Array<{closeFY:number, createdFY:number|null, revenue:number, leadSource:string, sourceCategory:string, leadSourceDetail:string}>} dealRows
 * @return {Object}  group -> {cohort1Revenue, cohort2Revenue}
 * ==========================================================
 */
function computeDealCohortsFromDealRows_(dealRows){

  const config = CONFIG.TARGET.EXTERNAL.DEAL_TRACKER;
  const targetFY = CONFIG.TARGET.P1_VALUE_FY;

  const excludeSet = {};
  config.EXCLUDE_LEAD_SOURCES.forEach(function(src){ excludeSet[src] = true; });

  const cohort1ByGroup = { events: 0, contact: 0, content: 0 };
  const cohort2ByGroup = { events: 0, contact: 0, content: 0 };

  dealRows.forEach(function(row){

    if(row.closeFY !== targetFY) return;
    if(excludeSet[String(row.leadSource || "").toLowerCase()]) return;

    const group = classifyDealSegment_(row);

    if(!group) return;

    if(row.createdFY === targetFY){
      cohort1ByGroup[group] += row.revenue;
    } else {
      cohort2ByGroup[group] += row.revenue;
    }

  });

  const result = {};

  CONFIG.TARGET.GROUP_ORDER.forEach(function(group){
    result[group] = {
      cohort1Revenue: cohort1ByGroup[group],
      cohort2Revenue: cohort2ByGroup[group]
    };
  });

  return result;

}


/**
 * ==========================================================
 * TEST — computeDealCohortsFromDealRows_() (합성 데이터)
 * ==========================================================
 */
function testComputeDealCohortsFromDealRows(){

  const dealRows = [
    // 코호트1: closeFY===createdFY===26
    { closeFY: 26, createdFY: 26, revenue: 100, leadSource: "webinar", sourceCategory: "", leadSourceDetail: "registered for webinar" },
    // 코호트2: closeFY===26이지만 createdFY===24(오래된 리드가 이번 FY 클로징)
    { closeFY: 26, createdFY: 24, revenue: 300, leadSource: "webinar", sourceCategory: "", leadSourceDetail: "registered for webinar" },
    // 제외 대상(Upsell)
    { closeFY: 26, createdFY: 26, revenue: 9999, leadSource: "Upsell", sourceCategory: "", leadSourceDetail: "" },
    // closeFY가 타겟 FY 아님 — 전부 제외
    { closeFY: 25, createdFY: 25, revenue: 9999, leadSource: "webinar", sourceCategory: "", leadSourceDetail: "registered for webinar" },
    // 분류 불가 — 그룹 배분에서 제외
    { closeFY: 26, createdFY: 26, revenue: 50, leadSource: "organic", sourceCategory: "", leadSourceDetail: "" }
  ];

  const result = computeDealCohortsFromDealRows_(dealRows);

  const pass =
    result.events.cohort1Revenue === 100 &&
    result.events.cohort2Revenue === 300;

  Logger.log("events cohort1Revenue: " + result.events.cohort1Revenue + " (expected 100)");
  Logger.log("events cohort2Revenue: " + result.events.cohort2Revenue + " (expected 300)");
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Deal Share Block Rows (Block C)
 *
 * WHY
 * Deal Tracker 계산이 성공하면 그 값을 쓰고, 실패(시트 접근 불가 등)하면
 * Input 블록의 수동 값으로 Fallback한다 (§5, §12 Open Item #5 — 2026-07-27
 * 실데이터 연동 완료, Fallback 경로는 안전장치로 유지).
 *
 * @param {Object} inputs
 * @param {Object|null} dealShareRatios  computeDealShareRatiosFromDealRows_() 결과(딜 0건이면 null)
 * ==========================================================
 */
function computeDealShareBlockRows_(inputs, dealShareRatios){

  const fallbackMap = {
    events: inputs.dealShareEvents,
    contact: inputs.dealShareContact,
    content: inputs.dealShareContent
  };

  return CONFIG.TARGET.GROUP_ORDER.map(function(group){

    const dealShare = dealShareRatios ? (dealShareRatios[group] || 0) : (fallbackMap[group] || 0);

    return { group: group, dealShare: dealShare };

  });

}


/**
 * ==========================================================
 * Compute Target Derivation Rows (Block D — FY→월→주 목표 전개)
 *
 * WHY (2026-07-27 코호트1/2 P1당 가치 placeholder)
 * P1당 가치가 CurrentFYP1V(a)/PrevP1V(b) 두 값으로 나뉜 뒤에도 FY P1 Target
 * 공식(computeFYP1Target_)은 분모 하나만 받는다 — a/b를 어떻게 합칠지는
 * 사용자가 Block B에서 두 값을 직접 검토한 뒤 결정하기로 확정(2026-07-27
 * 논의). 그때까지는 원래 단일 코호트 정의(같은 FY 생성·클로징)에 가장
 * 가까운 CurrentFYP1V(a)를 임시로 사용한다.
 *
 * @param {number} targetFY
 * @param {Array<Object>} benchmarkRows
 * @param {Array<Object>} p1ValueRows
 * @param {Array<Object>} dealShareRows
 * @param {Object} inputs
 * @return {Array<Object>}
 * ==========================================================
 */
function computeTargetDerivationRows_(targetFY, benchmarkRows, p1ValueRows, dealShareRows, inputs){

  const weeks = generateCalendarWeeksForFY_(targetFY);
  const weeksInMonthCounts = computeWeeksInMonthCounts_(weeks);

  const benchmarkByGroupMonth = {};

  benchmarkRows.forEach(function(row){
    benchmarkByGroupMonth[row.group + "|" + row.month] = row;
  });

  const p1ValueByGroup = {};

  p1ValueRows.forEach(function(row){
    p1ValueByGroup[row.group] = row.currentFYP1V; // placeholder — a/b 블렌딩은 추후 결정
  });

  const dealShareByGroup = {};

  dealShareRows.forEach(function(row){
    dealShareByGroup[row.group] = row.dealShare;
  });

  const improvementFactorByGroup = {
    events: inputs.improvementFactorEvents,
    contact: inputs.improvementFactorContact,
    content: inputs.improvementFactorContent
  };

  const fyP1TargetByGroup = {};

  CONFIG.TARGET.GROUP_ORDER.forEach(function(group){

    fyP1TargetByGroup[group] = computeFYP1Target_(
      inputs.revenueTarget,
      dealShareByGroup[group] || 0,
      p1ValueByGroup[group] || 0
    );

  });

  const monthlyP1TargetCache = {};
  const monthlyCPNP1TargetCache = {};

  const rows = [];

  weeks.forEach(function(week){

    CONFIG.TARGET.GROUP_ORDER.forEach(function(group){

      const benchmark = benchmarkByGroupMonth[group + "|" + week.month] ||
        { seasonalityPct: 0, cpnp1Benchmark: 0 };

      const monthKey = group + "|" + week.fy + "|" + week.month;

      if(monthlyP1TargetCache[monthKey] === undefined){

        monthlyP1TargetCache[monthKey] = computeMonthlyP1Target_(
          fyP1TargetByGroup[group],
          benchmark.seasonalityPct
        );

        monthlyCPNP1TargetCache[monthKey] = computeMonthlyCPNP1Target_(
          benchmark.cpnp1Benchmark,
          improvementFactorByGroup[group] || 1
        );

      }

      const weeksInMonth = weeksInMonthCounts[week.fy + "|" + week.month] || 1;

      const weeklyP1Target = computeWeeklyP1Target_(monthlyP1TargetCache[monthKey], weeksInMonth);

      rows.push({
        weekStart: week.weekStart,
        weekEnd: week.weekEnd,
        fy: week.fy,
        month: week.month,
        group: group,
        monthlyP1Target: monthlyP1TargetCache[monthKey],
        weeklyP1Target: weeklyP1Target,
        monthlyCPNP1Target: monthlyCPNP1TargetCache[monthKey],
        weeklyCPNP1Target: monthlyCPNP1TargetCache[monthKey]
      });

    });

  });

  return rows;

}


/**
 * ==========================================================
 * TEST — computeTargetDerivationRows_() (합성 데이터, 공식 체인 통합 검증)
 * ==========================================================
 */
function testComputeTargetDerivationRows(){

  const benchmarkRows = [
    { group: "events", month: "AUG", seasonalityPct: 0.5, cpnp1Benchmark: 500 },
    { group: "contact", month: "AUG", seasonalityPct: 0.5, cpnp1Benchmark: 100 },
    { group: "content", month: "AUG", seasonalityPct: 0.5, cpnp1Benchmark: 50 }
  ];

  const p1ValueRows = [
    { group: "events", currentFYP1V: 1000 },
    { group: "contact", currentFYP1V: 500 },
    { group: "content", currentFYP1V: 200 }
  ];

  const dealShareRows = [
    { group: "events", dealShare: 0.5 },
    { group: "contact", dealShare: 0.3 },
    { group: "content", dealShare: 0.2 }
  ];

  const inputs = {
    revenueTarget: 1000000,
    improvementFactorEvents: 0.9,
    improvementFactorContact: 0.9,
    improvementFactorContent: 0.9
  };

  const rows = computeTargetDerivationRows_(27, benchmarkRows, p1ValueRows, dealShareRows, inputs);

  const augEventsRows = rows.filter(function(r){ return r.group === "events" && r.month === "AUG"; });

  const expectedFYTarget = (1000000 * 0.5) / 1000; // 500
  const expectedMonthlyTarget = expectedFYTarget * 0.5; // 250
  const expectedWeeklyTarget = expectedMonthlyTarget / augEventsRows.length;

  const pass =
    (augEventsRows.length === 4 || augEventsRows.length === 5) &&
    Math.abs(augEventsRows[0].monthlyP1Target - expectedMonthlyTarget) < 1e-6 &&
    Math.abs(augEventsRows[0].weeklyP1Target - expectedWeeklyTarget) < 1e-6 &&
    Math.abs(augEventsRows[0].monthlyCPNP1Target - 450) < 1e-6 &&
    augEventsRows[0].weeklyCPNP1Target === augEventsRows[0].monthlyCPNP1Target;

  Logger.log("AUG events week rows: " + augEventsRows.length + " (expected 4 or 5)");
  Logger.log("Monthly P1 Target: " + augEventsRows[0].monthlyP1Target + " (expected " + expectedMonthlyTarget + ")");
  Logger.log("Weekly P1 Target: " + augEventsRows[0].weeklyP1Target + " (expected " + expectedWeeklyTarget + ")");
  Logger.log("Monthly CPNP1 Target: " + augEventsRows[0].monthlyCPNP1Target + " (expected 450)");
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Read Target Engine Inputs (Block 0 — 읽기 전용)
 *
 * WHY (2026-07-27 성능 수정)
 * 셀 9개를 개별 getValue()로 읽으면 대용량 워크북(Leads_OPS 3만5천+행 등)에서
 * 왕복 호출마다 지연이 누적돼 타임아웃("Service Spreadsheets timed out")이
 * 발생함(실측). Block 0 값 컬럼 전체를 getValues() 1회로 읽어 메모리에서
 * 인덱싱한다 (Article 10: Read Once 원칙, setupTargetEngineInputDefaults_()도 동일).
 * ==========================================================
 */
function readTargetEngineInputs_(sheet){

  const rows = CONFIG.TARGET.INPUT.ROWS;
  const col = CONFIG.TARGET.INPUT.VALUE_COL;
  const lastRow = CONFIG.TARGET.INPUT.LAST_ROW;
  const defaults = CONFIG.TARGET.INPUT.DEFAULTS;

  const values = sheet.getRange(1, col, lastRow, 1).getValues();

  const get = function(row){
    return values[row - 1][0];
  };

  return {
    targetFY: Number(get(rows.TARGET_FY)) || defaults.TARGET_FY,
    revenueTarget: Number(get(rows.REVENUE_TARGET)) || 0,
    improvementFactorEvents: Number(get(rows.IMPROVEMENT_FACTOR_EVENTS)) || 0,
    improvementFactorContact: Number(get(rows.IMPROVEMENT_FACTOR_CONTACT)) || 0,
    improvementFactorContent: Number(get(rows.IMPROVEMENT_FACTOR_CONTENT)) || 0,
    dealShareEvents: Number(get(rows.DEAL_SHARE_EVENTS)) || 0,
    dealShareContact: Number(get(rows.DEAL_SHARE_CONTACT)) || 0,
    dealShareContent: Number(get(rows.DEAL_SHARE_CONTENT)) || 0,
    cutoverDate: get(rows.CUTOVER_DATE)
  };

}


/**
 * ==========================================================
 * Setup Target Engine Input Defaults (최초 1회 — 기존 값 있으면 보존)
 *
 * WHY
 * Block 0은 "절대 덮어쓰지 않는" 영역(docs/TargetReportDesign.md §9) —
 * 라벨은 항상 다시 쓰되, 값은 비어있을 때만 기본값을 채운다.
 *
 * WHY (2026-07-27 성능 수정)
 * 행 9개 × (getValue 1 + setValue 최대 2) = 최대 27회의 개별 Range 호출이
 * 대용량 워크북에서 "Service Spreadsheets timed out" 에러를 유발함(실측,
 * setupTargetReport() 최초 실행 중 발생). 라벨 컬럼/값 컬럼을 각각
 * getValues()/setValues() 1회씩으로 배치 처리 — 총 1회 읽기 + 2회 쓰기로 축소.
 * ==========================================================
 */
function setupTargetEngineInputDefaults_(sheet){

  const rows = CONFIG.TARGET.INPUT.ROWS;
  const labelCol = CONFIG.TARGET.INPUT.LABEL_COL;
  const valueCol = CONFIG.TARGET.INPUT.VALUE_COL;
  const lastRow = CONFIG.TARGET.INPUT.LAST_ROW;
  const defaults = CONFIG.TARGET.INPUT.DEFAULTS;

  const entries = [
    [rows.TARGET_FY, "Target FY", defaults.TARGET_FY],
    [rows.REVENUE_TARGET, "Marketing Revenue Target (NZD)", defaults.REVENUE_TARGET],
    [rows.IMPROVEMENT_FACTOR_EVENTS, "Improvement Factor - events", defaults.IMPROVEMENT_FACTOR],
    [rows.IMPROVEMENT_FACTOR_CONTACT, "Improvement Factor - contact", defaults.IMPROVEMENT_FACTOR],
    [rows.IMPROVEMENT_FACTOR_CONTENT, "Improvement Factor - content", defaults.IMPROVEMENT_FACTOR],
    [rows.DEAL_SHARE_EVENTS, "Deal Share - events (임시 수동 — 딜트래커 이관 전)", defaults.DEAL_SHARE.events],
    [rows.DEAL_SHARE_CONTACT, "Deal Share - contact (임시 수동 — 딜트래커 이관 전)", defaults.DEAL_SHARE.contact],
    [rows.DEAL_SHARE_CONTENT, "Deal Share - content (임시 수동 — 딜트래커 이관 전)", defaults.DEAL_SHARE.content],
    [rows.CUTOVER_DATE, "Week Cycle Cutover Date", CONFIG.TARGET.CUTOVER_DATE]
  ];

  const existingValues = sheet.getRange(1, valueCol, lastRow, 1).getValues();

  const labelColumn = [];
  const valueColumn = [];

  for(let row = 1; row <= lastRow; row++){
    labelColumn.push([""]);
    valueColumn.push([existingValues[row - 1][0]]);
  }

  entries.forEach(function(entry){

    const row = entry[0];
    const existingValue = existingValues[row - 1][0];

    labelColumn[row - 1] = [entry[1]];

    if(existingValue === "" || existingValue === null){
      valueColumn[row - 1] = [entry[2]];
    }

  });

  sheet.getRange(1, labelCol, lastRow, 1).setValues(labelColumn);
  sheet.getRange(1, valueCol, lastRow, 1).setValues(valueColumn);

}


/**
 * ==========================================================
 * Write Target Engine Block (Block A~D 공통 — clear 후 재작성)
 *
 * WHY
 * 매 재계산마다 행 수가 달라질 수 있어(예: FY마다 52/53주), 헤더 아래
 * 넉넉한 범위(2000행)를 먼저 비운 뒤 실제 데이터만큼만 다시 쓴다.
 * ==========================================================
 */
function writeTargetEngineBlock_(sheet, startCol, headers, matrix){

  const MAX_CLEAR_ROWS = 2000;

  sheet.getRange(1, startCol, MAX_CLEAR_ROWS, headers.length).clearContent();

  sheet.getRange(1, startCol, 1, headers.length).setValues([headers]);

  if(matrix.length > 0){

    sheet.getRange(2, startCol, matrix.length, headers.length).setValues(matrix);

  }

}


/**
 * ==========================================================
 * Build Block Headers (CONFIG 기반 — FY 라벨 하드코딩 금지)
 * ==========================================================
 */
function buildTargetBenchmarkHeaders_(){

  return ["Group", "Month"]
    .concat(CONFIG.TARGET.BENCHMARK.NEWP1_FYS.map(function(fy){ return "FY" + fy + " New P1"; }))
    .concat(["Weighted Avg New P1", "Seasonality %", "CPNP1 Benchmark"]);

}

function buildTargetP1ValueHeaders_(){

  const fy = CONFIG.TARGET.P1_VALUE_FY;

  return [
    "Group",
    "FY" + fy + " New P1 Count",
    "Cohort1 Revenue (R1, Created=Closed=FY" + fy + ")",
    "CurrentFYP1V (a = R1 / New P1)",
    "Prev P1 Count (all-time − FY" + fy + " New)",
    "Cohort2 Revenue (R2, Closed=FY" + fy + " only)",
    "PrevP1V (b = R2 / Prev P1)"
  ];

}

function buildTargetDealShareHeaders_(){

  return ["Group", "Deal Share"];

}

function buildTargetDerivationHeaders_(){

  return [
    "Week Start", "Week End", "Month", "Group",
    "Month Target P1", "Week Target P1",
    "Month CPNP1 Benchmark", "Week Target CPNP1"
  ];

}


/**
 * ==========================================================
 * Convert Block Rows -> Sheet Matrix
 * ==========================================================
 */
function targetBenchmarkRowsToMatrix_(rows){

  return rows.map(function(r){
    return [r.group, r.month].concat(r.newP1ByFY).concat([r.weightedAvgNewP1, r.seasonalityPct, r.cpnp1Benchmark]);
  });

}

function targetP1ValueRowsToMatrix_(rows){

  return rows.map(function(r){
    return [
      r.group,
      r.newP1Count, r.cohort1Revenue, r.currentFYP1V,
      r.prevP1Count, r.cohort2Revenue, r.prevP1V
    ];
  });

}

function targetDealShareRowsToMatrix_(rows){

  return rows.map(function(r){
    return [r.group, r.dealShare];
  });

}

function targetDerivationRowsToMatrix_(rows){

  return rows.map(function(r){

    return [
      r.weekStart, r.weekEnd,
      r.month, // FY 접두사 없이 월 라벨만(예: "AUG") — 사용자 요청, 2026-07-27
      r.group,
      r.monthlyP1Target, r.weeklyP1Target,
      r.monthlyCPNP1Target, r.weeklyCPNP1Target
    ];

  });

}


/**
 * ==========================================================
 * Refresh Target Engine (전체 재계산 → Target_Engine 시트에 저장)
 *
 * WHY
 * Generate 체크박스(91_TargetReport.js)를 누르면 이 함수가 먼저 실행되어
 * Block A~D를 전부 다시 계산/작성한 뒤, Target_REP가 이 시트를 조회해
 * 리포트를 그린다 (NewP1/Events Engine과 동일한 오케스트레이션 순서).
 * ==========================================================
 */
function refreshTargetEngine_(){

  const start = new Date();

  Logger.log(CONFIG.LOG.PREFIX + " Target Engine Refresh Started");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.TARGET.ENGINE_SHEET);

  if(!sheet){
    sheet = ss.insertSheet(CONFIG.TARGET.ENGINE_SHEET);
  }

  setupTargetEngineInputDefaults_(sheet);

  const inputs = readTargetEngineInputs_(sheet);

  const leadsAgg = computeTargetLeadsOPSAggregates_();
  const spentByGroupFYMonth = computeCombinedSpentByGroupFYMonth_();

  const benchmarkRows = computeBenchmarkBlockRows_(
    leadsAgg.newP1CountsByGroupFYMonth,
    spentByGroupFYMonth
  );

  // Deal Tracker는 Block B(코호트1/2 P1당 가치)와 Block C(코호트1 Deal Share)
  // 둘 다에 쓰이므로 1회만 읽어(Article 10: Read Once) 재사용한다.
  const dealRows = readDealTrackerRawRows_();

  const dealCohortsByGroup = computeDealCohortsFromDealRows_(dealRows);
  const p1ValueRows = computeP1ValueBlockRows_(
    dealCohortsByGroup, leadsAgg.newP1CountByGroup, leadsAgg.totalP1CountByGroup
  );

  const dealShareRatios = dealRows.length > 0 ? computeDealShareRatiosFromDealRows_(dealRows) : null;
  const dealShareRows = computeDealShareBlockRows_(inputs, dealShareRatios);

  const derivationRows = computeTargetDerivationRows_(
    inputs.targetFY, benchmarkRows, p1ValueRows, dealShareRows, inputs
  );

  writeTargetEngineBlock_(
    sheet, CONFIG.TARGET.ENGINE.BLOCK_A_START_COL,
    buildTargetBenchmarkHeaders_(), targetBenchmarkRowsToMatrix_(benchmarkRows)
  );

  writeTargetEngineBlock_(
    sheet, CONFIG.TARGET.ENGINE.BLOCK_B_START_COL,
    buildTargetP1ValueHeaders_(), targetP1ValueRowsToMatrix_(p1ValueRows)
  );

  writeTargetEngineBlock_(
    sheet, CONFIG.TARGET.ENGINE.BLOCK_C_START_COL,
    buildTargetDealShareHeaders_(), targetDealShareRowsToMatrix_(dealShareRows)
  );

  writeTargetEngineBlock_(
    sheet, CONFIG.TARGET.ENGINE.BLOCK_D_START_COL,
    buildTargetDerivationHeaders_(), targetDerivationRowsToMatrix_(derivationRows)
  );

  SpreadsheetApp.flush();

  const seconds = ((new Date() - start) / 1000).toFixed(2);

  Logger.log(CONFIG.LOG.PREFIX + " Target Engine Refresh Completed (" + seconds + "s)");

}


/**
 * ==========================================================
 * TEMP — refreshTargetEngine_() 수동 실행용 공개 래퍼
 * ==========================================================
 */
function runRefreshTargetEngine(){

  refreshTargetEngine_();

}


/**
 * ==========================================================
 * Read Target Engine Derivation Rows (Block D 조회 — 91_TargetReport.js용)
 * ==========================================================
 */
function readTargetEngineDerivationRows_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.TARGET.ENGINE_SHEET);

  if(!sheet) return [];

  const startCol = CONFIG.TARGET.ENGINE.BLOCK_D_START_COL;
  const colCount = CONFIG.TARGET.ENGINE.BLOCK_D_COLUMNS;

  const lastRow = sheet.getLastRow();

  if(lastRow < 2) return [];

  const values = sheet.getRange(2, startCol, lastRow - 1, colCount).getValues();

  return values
    .filter(function(row){ return row[0] instanceof Date; })
    .map(function(row){

      return {
        weekStart: row[0],
        weekEnd: row[1],
        month: row[2],
        group: row[3],
        monthlyP1Target: row[4],
        weeklyP1Target: row[5],
        monthlyCPNP1Target: row[6],
        weeklyCPNP1Target: row[7]
      };

    });

}
