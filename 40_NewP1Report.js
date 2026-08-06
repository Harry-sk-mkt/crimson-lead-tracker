/**
 * ==========================================================
 * Marketing 2.0
 * NewP1 Report (New P1 Cohort Funnel Report)
 *
 * Responsibility
 * New P1 Lead의 획득 시점(Create Date) 코호트 기준 다운스트림 퍼널(SAL/
 * IC Booked/IC Complete/Won) 진행률. New P1/SAL/IC Booked/IC Complete는
 * Leads_OPS 단일 소스(리드~세일즈 액티비티 레이어), **Won/Revenue는
 * 2026-07-28부터 Deal Tracker 기반(Opportunity/Revenue 레이어, 2트랙
 * 아키텍처 — CLAUDE.md #7, computeNewP1DealWonRevenueFromRows_() 참고)**.
 * Engine(조합 생성) + Aggregates(지표 집계) + Report 생성을 이 파일
 * 하나에서 담당하되, 함수 단위로는 책임을 분리한다 (Article 7).
 *
 * 설계 문서
 * docs/NewP1ReportDesign.md
 *
 * Must NOT
 * - Leads_Master / MTA_Master 조회 (Leads_OPS 단일 소스 원칙 — New P1/SAL/
 *   IC Booked/IC Complete에 한정, Won/Revenue는 Deal Tracker 예외)
 *
 * Stage
 * 20 Reporting (NewP1)
 *
 * Version
 * v1.6.2
 *
 * Change Log
 * v1.6.2 (2026-08-06)
 * - **비동기 트리거 방식 → 동기 방식으로 재전환**(30_ACQReport.js v1.14.5와
 *   동일 이유/패턴, 사용자 확정) — `handleNewP1ReportGenerateEdit_()`가
 *   다시 try/finally로 동기 호출, `runNewP1ReportGenerateTail()`은 수동
 *   테스트 진입점으로 격하.
 * v1.6.1 (2026-08-06)
 * - **성능 개선 — DealTracker_Engine 캐시 도입**(30_ACQReport.js v1.14.4와
 *   동일 이유): refreshAndGenerateNewP1Report_()에
 *   appendNewDealTrackerRows_()(90_TargetEngine.js) 호출 추가 — 신규 딜만
 *   증분 동기화.
 * v1.6.0 (2026-08-06)
 * - **성능 개선 — refreshAndGenerateNewP1Report_()를 Revenue 전용으로 축소**
 *   (30_ACQReport.js v1.14.3과 동일 이유/패턴): 실측 69초가 걸려 회의 중
 *   활용이 불가능했음(사용자 확인) — New P1/SAL/IC Booked/IC Complete는
 *   Import 시에만 바뀌고 이미 백그라운드 파이프라인이 최신 유지 중이라
 *   Generate 시점 재스캔이 무의미. 신규 `refreshNewP1EngineRevenueOnly_()`/
 *   `mergeRevenueIntoNewP1EngineRows_()`로 교체 — Leads_OPS 스캔 없이 Deal
 *   Tracker Won/Revenue만 병합. `testMergeRevenueIntoNewP1EngineRows()` 포함.
 * v1.5.2 (2026-08-06)
 * - **버그 수정 — Generate 체크박스가 완료까지 체크된 채 멈춰있음**
 *   (30_ACQReport.js v1.14.2와 동일 원인/해결, 사용자 확인): 다시
 *   schedulePipelineTail_("runNewP1ReportGenerateTail")로 설치형 1회성
 *   트리거에 위임 — handleReportGenerateEdit()가 이미 설치형 트리거로
 *   실행되는 중이라 이번엔 ScriptApp.newTrigger() 호출이 정상 동작함.
 * v1.5.1 (2026-08-06)
 * - **버그 수정 — v1.5.0의 트리거 위임 방식이 실제로는 동작 안 함**(실측
 *   확인, 30_ACQReport.js v1.14.1과 동일 원인/해결): onEdit() Simple
 *   Trigger 안에서 `schedulePipelineTail_()`(`ScriptApp.newTrigger()`)
 *   호출 자체가 권한 오류로 실패 — Simple Trigger는 트리거 설치 자체도
 *   못 함. 올바른 해결(30_ACQReport.js에 구현)은 트리거 핸들러를 설치형
 *   (installable) onEdit으로 등록하는 것 — `handleNewP1ReportGenerateEdit_()`는
 *   다시 동기 try/finally로 되돌리되, `generateNewP1Report_()` 대신 신규
 *   `refreshAndGenerateNewP1Report_()`(구 `runNewP1ReportGenerateTail()`을
 *   개명 — 더 이상 트리거 핸들러가 아니므로 `deleteTriggersByHandlerName_()`
 *   호출 제거)를 호출. **`30_ACQReport.js`의 `runInstallReportGenerateTrigger()`를
 *   1회 실행해야 실제로 동작함**(NewP1_REP도 같은 설치형 트리거 하나를 공유).
 * v1.5.0 (2026-08-06, 이 방식은 실패 — 위 v1.5.1 참고)
 * - **버그 수정 — Generate 시 이전 실행분 서식(배경색/테두리)이 새 범위 밖에
 *   남음**(사용자 발견, 30_ACQReport.js v1.14.0과 동일 버그): `clearNewP1ReportArea_()`가
 *   `.clearContent()`만 호출해 값은 지워지지만 서식은 남아있었음 — 이전 실행
 *   범위(A:M/Target 4컬럼)에 `.clearFormat()`을 추가로 호출.
 * - **Generate를 설치형 트리거로 위임**(30_ACQReport.js v1.14.0과 동일 패턴,
 *   사용자 요청 — "트리거 형태로 구현 못하나?"): `handleNewP1ReportGenerateEdit_()`
 *   (onEdit Simple Trigger)가 `generateNewP1Report_()`를 직접 호출하는 대신
 *   체크박스를 즉시 리셋하고 `schedulePipelineTail_("runNewP1ReportGenerateTail")`
 *   로 설치형 1회성 트리거를 예약. 신규 `runNewP1ReportGenerateTail()`(Full
 *   Authorization)이 `refreshAdSpendCache_()`/`refreshNewP1Engine_()`(Deal
 *   Tracker openById() 포함)로 캐시를 먼저 갱신한 뒤 `generateNewP1Report_()`
 *   호출 — Generate 클릭 시점에 Spent/Revenue가 실제로 최신화됨.
 * v1.4.0 (2026-08-04)
 * - **Spent 소스를 Target_Engine 수동 입력 → Ad_Spend_Cache 자동 집계로 전환**
 *   (사용자 확정 — ACQ_REP의 Spent(W열)는 이미 `readAdSpendCacheMap_()`
 *   (AD_004_SpendCache.js, Meta+Naver Search+Kakao Channel 합산 캐시)를 쓰는데
 *   NewP1_REP은 2026-07-30 추가 당시 아직 이 캐시가 없어 Target_Engine Block 0
 *   수동 입력을 그대로 썼던 게 그대로 남아있었음 — 두 리포트의 Spent 소스가
 *   달라 실제 캠페인 지출과 안 맞는 값이 보이는 원인이 됨(FY27 AUG Spent 이상
 *   현상 조사 중 발견). `generateNewP1Report_()`가 `computeReportTargetLookup_()`
 *   의 `.spent` 대신 `readAdSpendCacheMap_()`를 직접 조회하도록 변경 — key
 *   포맷(FY|Month|Segment)이 이미 동일해 그대로 대체 가능. CPNP1(실적)도
 *   자동 집계 지출 기준으로 재계산됨. `computeReportTargetLookupFromInputs_()`
 *   자체는 손대지 않음(Target_Engine 내부 CPNP1 Benchmark 도출 체인이 여전히
 *   `inputs.monthlySegmentSpent`를 직접 사용 중이라 무관).
 * v1.3.0 (2026-07-30)
 * - Spent/CPNP1(실적)/New P1 Target/New P1 Target% 4컬럼 추가
 *   (docs/exec-plans/active/2026-07-30-acq-newp1-target-columns.md 참고, 원래
 *   별도 FY_REP으로 설계했던 걸 기존 두 리포트 확장으로 방향 전환). **처음엔
 *   N열(A:M 바로 뒤)부터 이어붙이려 `NEWP1_REPORT_HEADERS` 배열 자체를
 *   13→17로 확장했으나, 실 시트 검증 중 N열이 사용자 수동 영역(00_Config.js
 *   `CONFIG.NEWP1.MANUAL_AREA_NOTE`)인 게 발견돼(사용자 리포트: "N:Q 안
 *   나타나") N열을 건너뛰고 O열부터 별도 `NEWP1_TARGET_HEADERS` 배열 +
 *   별도 range(write/clear 둘 다)로 분리** — `NEWP1_REPORT_HEADERS`는 원래
 *   13개(A:M)로 되돌림. Spent는 Target_Engine Block 0 세그먼트별 월별 수동
 *   입력, New P1 Target은 Block D — 둘 다 `computeReportTargetLookup_()`
 *   (90_TargetEngine.js)로 조회. CPNP1(실적) = Spent ÷ New P1(실적, D열).
 *   Pipeline P1 Target은 이번 확장에서 제외(사용자 판단 — 클로징 여부가
 *   불확실한 영역이라 New P1 카운트 목표와 성격이 다름, exec-plan 참고).
 *   Referral/Other 세그먼트와 Target_Engine이 마지막으로 Generate한 FY가
 *   아닌 행은 공란 처리(의도된 동작, hasOwnProperty 기반).
 * v1.2.0 (2026-07-28)
 * - Won/Revenue(K/M열)를 Leads_OPS 리드 단위(Revenue>0) 판정에서 Deal
 *   Tracker 기반(Created Date + 수동 Segment 컬럼으로 FY|Month|Segment
 *   코호트 직접 집계, 리드 단위 매칭 없음)으로 전환 — 2트랙 아키텍처를
 *   NewP1_REP까지 확장(사용자 확정). 신규 computeNewP1DealWonRevenueFromRows_()
 *   추가, computeNewP1Aggregates_()는 New P1/SAL/IC Booked/IC Complete만
 *   Leads_OPS에서 집계하고 Won/Revenue는 병합. 상세: docs/Changelog.md
 *   2026-07-28.
 * v1.1.0 (2026-07-22)
 * - Week(Fiscal Week) 축 제거 — 8/1 기준 7일 단위라 캘린더 주(월~일)와
 *   무관하고 매년 시작 요일이 달라져 혼동을 유발한다는 사용자 피드백.
 *   Row 구조를 FY > Month > Segment로 단순화(ACQ_REP과 동일 계층).
 *   Engine/Report 헤더에서 Week 컬럼 제거, Sort Index 공식에서 Week
 *   슬롯 제거, CONFIG.NEWP1.MAX_WEEKS는 더 이상 사용하지 않음(제거하지
 *   않고 보존 — 향후 재도입 가능성 대비).
 * v1.0.0 (2026-07-22)
 * - 최초 구현 (docs/NewP1ReportDesign.md 설계 그대로, Week 포함 버전).
 * ==========================================================
 */


/**
 * ==========================================================
 * Report Area Header (A:M, 13 columns)
 * ==========================================================
 */
const NEWP1_REPORT_HEADERS = [
  "FY", "Month", "Segment",
  "New P1", "SAL", "SAL%",
  "IC Booked", "IC Booked%",
  "IC Complete", "IC Complete%",
  "Won", "Won%",
  "Revenue"
];


/**
 * ==========================================================
 * Report Area Target Columns (2026-07-30 신규 — Spent/CPNP1/
 * New P1 Target/New P1 Target%, `CONFIG.NEWP1.TARGET_COLUMNS_START_COL`부터)
 *
 * WHY
 * A:M 바로 뒤(N열)에 이어붙이려 했으나 N열은 사용자가 직접 쓰던 수동 영역
 * (00_Config.js `CONFIG.NEWP1.MANUAL_AREA_NOTE`)이라 실 시트 검증 중 충돌
 * 발견 — N열 하나를 건너뛰고 O열부터 별도 range로 분리(NEWP1_REPORT_HEADERS에
 * 합치지 않음). 상세: docs/exec-plans/active/2026-07-30-acq-newp1-target-columns.md
 * ==========================================================
 */
const NEWP1_TARGET_HEADERS = [
  "Spent", "CPNP1", "New P1 Target", "New P1 Target%"
];


/**
 * ==========================================================
 * Engine Sheet Header (A:J, 10 columns)
 * ==========================================================
 */
const NEWP1_ENGINE_HEADERS = [
  "FY", "Month", "Segment", "Sort Index",
  "New P1", "SAL", "IC Booked", "IC Complete", "Won", "Revenue"
];


/**
 * ==========================================================
 * Derive NewP1 Cohort (FY / Month from Create Date)
 *
 * WHY
 * Create Date 하나로부터 코호트 귀속에 필요한 FY/Month를 파생한다.
 * (2026-07-22: Week 축 제거 — 위 Change Log 참고)
 *
 * @param {Date} createDate
 * @return {{fy:number, month:string}|null}
 * ==========================================================
 */
function deriveNewP1Cohort_(createDate){

  if(!(createDate instanceof Date) || isNaN(createDate.getTime())){
    return null;
  }

  const fy = Number(getFiscalYear(createDate).replace("FY", ""));
  const month = getFiscalMonthLabel(createDate);

  return { fy: fy, month: month };

}


/**
 * ==========================================================
 * TEST — deriveNewP1Cohort_()
 * ==========================================================
 */
function testDeriveNewP1Cohort(){

  const result = deriveNewP1Cohort_(new Date(2026, 7, 1));   // 2026-08-01

  const pass =
    result !== null &&
    result.fy === 27 &&
    result.month === "AUG";

  Logger.log(
    "2026-08-01 => " + JSON.stringify(result) +
    " (expected fy=27, month=AUG)"
  );

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

  const invalid = deriveNewP1Cohort_(null);

  Logger.log("invalid date => " + invalid + " (expected null)");
  Logger.log(invalid === null ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute NewP1 Sort Index
 *
 * WHY
 * FY → Month(Fiscal 순서) → Segment(CONFIG.ACQ.SEGMENTS 순서)로
 * 유일한 정렬 순서를 결정한다.
 *
 * @param {number} fy
 * @param {string} month  Fiscal Month Label (예: "AUG")
 * @param {string} segment
 * @param {number} minFY  전체 데이터 중 최소 FY (기준점)
 * @return {number}  -1이면 유효하지 않은 조합
 * ==========================================================
 */
function computeNewP1SortIndex_(fy, month, segment, minFY){

  const monthIndex = CONFIG.ACQ.FISCAL_MONTH_ORDER.indexOf(month);
  const segmentIndex = CONFIG.ACQ.SEGMENTS.indexOf(segment);

  if(monthIndex === -1 || segmentIndex === -1) return -1;

  const fyOffset = fy - minFY;

  if(fyOffset < 0) return -1;

  const segmentCount = CONFIG.ACQ.SEGMENTS.length;

  return (
    (fyOffset * 12 + monthIndex) * segmentCount +
    segmentIndex
  );

}


/**
 * ==========================================================
 * TEST — computeNewP1SortIndex_()
 * ==========================================================
 */
function testComputeNewP1SortIndex(){

  const segmentCount = CONFIG.ACQ.SEGMENTS.length;

  const a = computeNewP1SortIndex_(26, "AUG", CONFIG.ACQ.SEGMENTS[0], 26);
  const b = computeNewP1SortIndex_(26, "AUG", CONFIG.ACQ.SEGMENTS[1], 26);
  const c = computeNewP1SortIndex_(26, "SEP", CONFIG.ACQ.SEGMENTS[0], 26);
  const invalid = computeNewP1SortIndex_(26, "NOT_A_MONTH", CONFIG.ACQ.SEGMENTS[0], 26);

  const pass =
    a === 0 &&
    b === 1 &&
    c === segmentCount &&
    invalid === -1;

  Logger.log("a=" + a + " (expected 0)");
  Logger.log("b=" + b + " (expected 1)");
  Logger.log("c=" + c + " (expected " + segmentCount + ")");
  Logger.log("invalid=" + invalid + " (expected -1)");
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute NewP1 Deal Won/Revenue From Rows (순수 함수 — 2트랙 설계)
 *
 * WHY (2026-07-28, 사용자 확정)
 * Won/Revenue(K/M열)는 원래 Leads_OPS 리드별 `Revenue > 0` 여부로 판정했으나
 * (리드 단위, `Revenue`는 Opportunity Won Date 기준 Salesforce 동기화 값 —
 * `docs/NewP1ReportDesign.md` 원 설계), Deal Tracker를 Source of Truth로
 * 전환한다. 리드 단위 매칭(Student/Guardian Email 등)은 Target_REP에서 이미
 * "상담 후 이메일 덮어쓰기로 시스템적 복구 불가"로 폐기됐지만, Won/Revenue는
 * 굳이 리드 단위로 조인할 필요 없이 **딜 자체의 Created Date**(Lead Create
 * Date와 같은 코호트 축 — Deal Tracker의 Lead Age 컬럼들이 리드 생성 시점
 * 기준임을 시사)와 수동 Segment 컬럼으로 (FY|Month|Segment) 코호트에 직접
 * 집계하면 된다 — ACQ_REP(Close Date 기준)·Events_OPS(프로그램명 기준)와
 * 동일한 "딜 자체 필드 직접 집계" 패턴. Upsell/N/A는 ACQ_REP과 동일하게
 * "Other"로 접어 넣는다.
 *
 * 이 전환으로 Won%(=Won÷New P1)의 분자(딜트래커 딜 건수)와 분모(Leads_OPS
 * New P1 리드 건수)가 서로 다른 두 집단의 비율이 된다 — "이 코호트의 리드가
 * 실제로 Won이 된 비율"이 아니라 "이 코호트 기간에 딜트래커 기준으로 발생한
 * 딜 규모 대비 리드 규모"로 의미가 바뀜을 사용자가 확인·승인함(2026-07-28).
 *
 * INPUT
 * dealRows : Object[]  readDealTrackerRawRows_()의 반환값(90_TargetEngine.js)
 *
 * OUTPUT
 * { won: {"fy|month|segment": count}, revenue: {"fy|month|segment": sum} }
 *
 * TEST
 * testComputeNewP1DealWonRevenueFromRows_() 참고
 * ==========================================================
 */
function computeNewP1DealWonRevenueFromRows_(dealRows){

  const won = {};
  const revenue = {};

  dealRows.forEach(function(row){

    if(!row.createdDate) return;

    const segment = row.businessSegment === "N/A" ? "Other" : row.businessSegment;
    const key = row.createdFY + "|" + getFiscalMonthLabel(row.createdDate) + "|" + segment;

    won[key] = (won[key] || 0) + 1;
    revenue[key] = (revenue[key] || 0) + (Number(row.revenue) || 0);

  });

  return { won: won, revenue: revenue };

}


/**
 * ==========================================================
 * TEST — computeNewP1DealWonRevenueFromRows_()
 * ==========================================================
 */
function testComputeNewP1DealWonRevenueFromRows_(){

  const dealRows = [
    { createdFY: 26, createdDate: new Date(2025, 7, 15), revenue: 1000, businessSegment: "Webinar" },
    { createdFY: 26, createdDate: new Date(2025, 7, 20), revenue: 500, businessSegment: "Webinar" },
    { createdFY: 26, createdDate: new Date(2025, 7, 22), revenue: 300, businessSegment: "Referral" },
    { createdFY: 26, createdDate: new Date(2025, 7, 25), revenue: 700, businessSegment: "N/A" }, // Other로 접힘
    { createdFY: 26, createdDate: null, revenue: 9999, businessSegment: "Webinar" } // createdDate 없음 — 제외
  ];

  const result = computeNewP1DealWonRevenueFromRows_(dealRows);

  const augWebinarKey = "26|" + getFiscalMonthLabel(new Date(2025, 7, 15)) + "|Webinar";
  const referralKey = "26|" + getFiscalMonthLabel(new Date(2025, 7, 22)) + "|Referral";
  const otherKey = "26|" + getFiscalMonthLabel(new Date(2025, 7, 25)) + "|Other";

  const pass =
    result.won[augWebinarKey] === 2 &&
    result.revenue[augWebinarKey] === 1500 &&
    result.won[referralKey] === 1 &&
    result.revenue[referralKey] === 300 &&
    result.won[otherKey] === 1 &&
    result.revenue[otherKey] === 700;

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute NewP1 Aggregates
 *
 * WHY
 * Leads_OPS를 1회 스캔(Article 10: Read Once)해서 New P1 코호트별
 * (FY|Month|Segment) New P1/SAL/IC Booked/IC Complete를 메모리에서
 * 집계한다(유효 Priority = "Priority 1" 코호트 필터,
 * docs/NewP1ReportDesign.md §3). **Won/Revenue는 2026-07-28부터 이 스캔
 * 책임이 아니다** — Deal Tracker 기반 별도 집계(computeNewP1DealWonRevenueFromRows_())
 * 를 이후 병합한다 (2트랙 아키텍처, CLAUDE.md #7).
 *
 * @return {Array<Object>}  각 원소: {fy, month, segment, sortIndex,
 *   newP1, sal, icBooked, icComplete, won, revenue}
 * ==========================================================
 */
function computeNewP1Aggregates_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(OPS.SHEET.OPS);

  const groups = {};

  if(sheet){

    const records = sheetToObjects(sheet);

    records.forEach(function(record){

      if(!isEffectiveP1_(record["Lead Priority"], record["Priority Override"])) return;

      const cohort = deriveNewP1Cohort_(record["Create Date"]);

      if(!cohort) return;

      const segment = record["Business Segment"] || "Other";
      const key = cohort.fy + "|" + cohort.month + "|" + segment;

      if(!groups[key]){

        groups[key] = {
          newP1: 0,
          sal: 0,
          icBooked: 0,
          icComplete: 0
        };

      }

      const g = groups[key];

      g.newP1++;

      const totalICRequests = Number(record["Total IC Requests"]) || 0;

      if(totalICRequests > 0) g.sal++;

      const icBookedDate = record["IC Booked Date"];

      if(icBookedDate instanceof Date && !isNaN(icBookedDate.getTime())) g.icBooked++;

      const icCompleteDate = record["IC Completed Date"];

      if(icCompleteDate instanceof Date && !isNaN(icCompleteDate.getTime())) g.icComplete++;

    });

  }

  const dealWonRevenue = computeNewP1DealWonRevenueFromRows_(readDealTrackerRawRows_());

  const allKeys = {};

  Object.keys(groups).forEach(function(key){ allKeys[key] = true; });
  Object.keys(dealWonRevenue.won).forEach(function(key){ allKeys[key] = true; });
  Object.keys(dealWonRevenue.revenue).forEach(function(key){ allKeys[key] = true; });

  const keys = Object.keys(allKeys);

  if(keys.length === 0) return [];

  let minFY = null;

  keys.forEach(function(key){

    const fy = Number(key.split("|")[0]);

    if(minFY === null || fy < minFY) minFY = fy;

  });

  return keys.map(function(key){

    const parts = key.split("|");
    const fy = Number(parts[0]);
    const month = parts[1];
    const segment = parts[2];

    const g = groups[key] || { newP1: 0, sal: 0, icBooked: 0, icComplete: 0 };

    return {
      fy: fy,
      month: month,
      segment: segment,
      sortIndex: computeNewP1SortIndex_(fy, month, segment, minFY),
      newP1: g.newP1,
      sal: g.sal,
      icBooked: g.icBooked,
      icComplete: g.icComplete,
      won: dealWonRevenue.won[key] || 0,
      revenue: dealWonRevenue.revenue[key] || 0
    };

  }).filter(function(row){
    return row.sortIndex !== -1;
  });

}


/**
 * ==========================================================
 * Refresh NewP1 Engine (전체 재계산 → NewP1_Engine 시트에 저장)
 *
 * WHY
 * appendNewLeads()/appendNewMTA()/rebuildLeadsMaster()/rebuildMTAMaster()
 * 완료 시 refreshACQSummary_()와 같은 지점에서 함께 호출되어, NewP1_REP
 * 조회가 원본 스캔 없이 항상 빠르게 응답하도록 한다.
 * ==========================================================
 */
function refreshNewP1Engine_(){

  const start = new Date();

  Logger.log(CONFIG.LOG.PREFIX + " NewP1 Engine Refresh Started");

  const aggregates = computeNewP1Aggregates_();

  aggregates.sort(function(a, b){ return a.sortIndex - b.sortIndex; });

  const rows = aggregates.map(function(row){

    return [
      "FY" + String(row.fy).slice(-2),
      row.month,
      row.segment,
      row.sortIndex,
      row.newP1,
      row.sal,
      row.icBooked,
      row.icComplete,
      row.won,
      row.revenue
    ];

  });

  writeNewP1Engine_(rows);

  const seconds = ((new Date() - start) / 1000).toFixed(2);

  Logger.log(
    CONFIG.LOG.PREFIX + " NewP1 Engine Refresh Completed : " +
    rows.length + " rows (" + seconds + "s)"
  );

}


/**
 * ==========================================================
 * TEMP — refreshNewP1Engine_() 수동 실행용 공개 래퍼
 * ==========================================================
 */
function runRefreshNewP1Engine(){

  refreshNewP1Engine_();

}


/**
 * ==========================================================
 * Write NewP1 Engine to Sheet (없으면 생성, 항상 숨김)
 * ==========================================================
 */
function writeNewP1Engine_(rows){

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(CONFIG.NEWP1.ENGINE_SHEET);

  if(!sheet){
    sheet = ss.insertSheet(CONFIG.NEWP1.ENGINE_SHEET);
  }

  sheet.clearContents();

  sheet.getRange(1, 1, 1, NEWP1_ENGINE_HEADERS.length)
    .setValues([NEWP1_ENGINE_HEADERS]);

  if(rows.length > 0){

    sheet.getRange(2, 1, rows.length, NEWP1_ENGINE_HEADERS.length)
      .setValues(rows);

  }

  sheet.hideSheet();

  SpreadsheetApp.flush();

}


/**
 * ==========================================================
 * Read NewP1 Engine Rows
 * ==========================================================
 */
function readNewP1EngineRows_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.NEWP1.ENGINE_SHEET);

  if(!sheet) return [];

  const values = sheet.getDataRange().getValues();

  if(values.length <= 1) return [];

  const rows = [];

  for(let i = 1; i < values.length; i++){

    const row = values[i];

    rows.push({
      fy: Number(String(row[0]).replace("FY", "")),
      month: row[1],
      segment: row[2],
      sortIndex: row[3],
      newP1: row[4],
      sal: row[5],
      icBooked: row[6],
      icComplete: row[7],
      won: row[8],
      revenue: row[9]
    });

  }

  return rows;

}


/**
 * ==========================================================
 * Refresh NewP1 Engine — Revenue Only (Generate 클릭 시점 전용, 2026-08-06)
 *
 * WHY
 * 31_ACQSummary.js의 refreshACQSummaryRevenueOnly_()와 동일한 이유·패턴.
 * NewP1_REP Generate 체크박스가 매번 refreshNewP1Engine_()(Leads_OPS
 * 3만5천+행 전체 스캔)를 돌렸더니 실측 69초가 걸림(사용자 확인). New P1/
 * SAL/IC Booked/IC Complete는 Leads/MTA Import 시에만 바뀌고 이미
 * 백그라운드 파이프라인이 최신 유지 중이라 Generate 시점 재스캔이
 * 불필요 — Won/Revenue(Deal Tracker)만 Import와 무관하게 바뀔 수 있어
 * 재조회 가치가 있음. Sort Index는 기존 값 그대로 보존(순서를 바꿀 이유
 * 없음).
 *
 * TEST
 * mergeRevenueIntoNewP1EngineRows_()의 testMergeRevenueIntoNewP1EngineRows 참고
 * ==========================================================
 */
function refreshNewP1EngineRevenueOnly_(){

  const start = new Date();

  Logger.log(CONFIG.LOG.PREFIX + " NewP1 Engine Revenue-Only Refresh Started");

  const existingRows = readNewP1EngineRows_();
  const dealWonRevenue = computeNewP1DealWonRevenueFromRows_(readDealTrackerRawRows_());

  const rows = mergeRevenueIntoNewP1EngineRows_(existingRows, dealWonRevenue);

  writeNewP1Engine_(rows);

  const seconds = ((new Date() - start) / 1000).toFixed(2);

  Logger.log(
    CONFIG.LOG.PREFIX + " NewP1 Engine Revenue-Only Refresh Completed : " +
    rows.length + " rows (" + seconds + "s)"
  );

}


/**
 * ==========================================================
 * Merge Revenue Into NewP1 Engine Rows (순수 함수, 테스트용으로 분리)
 *
 * WHY
 * refreshNewP1EngineRevenueOnly_()의 병합 로직만 떼어내 SpreadsheetApp
 * 없이 테스트 가능하게 함. New P1/SAL/IC Booked/IC Complete/Sort Index는
 * existingRows 값을 그대로 보존하고 Won/Revenue만 dealWonRevenue 기준으로
 * 교체 — 딜이 사라진 키는 0으로, dealWonRevenue에만 있는 신규 키는
 * (Sort Index 포함) 나머지 필드 0으로 새 행 추가.
 *
 * ⚠️ 신규 키의 Sort Index=0은 정렬 우선순위가 부정확할 수 있음(31_ACQSummary.js의
 * 신규 키 처리와 달리, NewP1_Engine은 sortIndex를 reverseNewP1MonthBlocks_()가
 * 참조함) — 다음 전체 refreshNewP1Engine_() 실행(백그라운드 파이프라인) 때
 * 정확한 값으로 자동 교정됨. Generate 직후 화면에 정확한 정렬이 필요하면
 * 전체 refresh를 기다려야 함(드문 케이스 — Deal Tracker에만 있고 Leads_OPS
 * 코호트엔 아직 없는 신규 FY|Month|Segment 조합).
 *
 * INPUT
 * existingRows   : Object[]  readNewP1EngineRows_()의 결과
 * dealWonRevenue : Object    computeNewP1DealWonRevenueFromRows_()의 결과
 *                             ({ won: {key: count}, revenue: {key: sum} })
 *
 * OUTPUT
 * Object[][]  writeNewP1Engine_()에 그대로 넘길 수 있는 row 배열
 *
 * TEST
 * testMergeRevenueIntoNewP1EngineRows 참고
 * ==========================================================
 */
function mergeRevenueIntoNewP1EngineRows_(existingRows, dealWonRevenue){

  const existingByKey = {};

  existingRows.forEach(function(row){
    const key = row.fy + "|" + row.month + "|" + row.segment;
    existingByKey[key] = row;
  });

  const allKeys = {};

  Object.keys(existingByKey).forEach(function(key){ allKeys[key] = true; });
  Object.keys(dealWonRevenue.revenue).forEach(function(key){ allKeys[key] = true; });

  return Object.keys(allKeys).map(function(key){

    const parts = key.split("|");
    const fy = parts[0];
    const month = parts[1];
    const segment = parts[2];

    const existing = existingByKey[key] || {
      sortIndex: 0, newP1: 0, sal: 0, icBooked: 0, icComplete: 0
    };

    return [
      "FY" + String(fy).slice(-2),
      month,
      segment,
      existing.sortIndex,
      existing.newP1,
      existing.sal,
      existing.icBooked,
      existing.icComplete,
      dealWonRevenue.won[key] || 0,
      dealWonRevenue.revenue[key] || 0
    ];

  });

}


/**
 * ==========================================================
 * TEST — mergeRevenueIntoNewP1EngineRows_()
 * ==========================================================
 */
function testMergeRevenueIntoNewP1EngineRows(){

  const existingRows = [
    { fy: 26, month: "Jul", segment: "Contact", sortIndex: 5, newP1: 20, sal: 10, icBooked: 8, icComplete: 5 },
    { fy: 26, month: "Jul", segment: "Content", sortIndex: 6, newP1: 2, sal: 1, icBooked: 1, icComplete: 0 }
  ];

  const dealWonRevenue = {
    won: { "26|Jul|Contact": 3, "27|Aug|Events": 1 },
    revenue: { "26|Jul|Contact": 5000, "27|Aug|Events": 1200 }
    // "26|Jul|Content"는 없음 — Won/Revenue 0으로 리셋
  };

  const rows = mergeRevenueIntoNewP1EngineRows_(existingRows, dealWonRevenue);

  const byKey = {};
  rows.forEach(function(row){
    byKey[Number(String(row[0]).replace("FY", "")) + "|" + row[1] + "|" + row[2]] = row;
  });

  const pass =
    rows.length === 3 &&
    byKey["26|Jul|Contact"][8] === 3 && byKey["26|Jul|Contact"][9] === 5000 &&
    byKey["26|Jul|Contact"][3] === 5 &&                   // sortIndex 보존
    byKey["26|Jul|Contact"][4] === 20 &&                  // newP1 보존
    byKey["26|Jul|Content"][8] === 0 && byKey["26|Jul|Content"][9] === 0 &&
    byKey["26|Jul|Content"][4] === 2 &&                   // 다른 필드는 보존
    byKey["27|Aug|Events"][8] === 1 && byKey["27|Aug|Events"][9] === 1200 &&
    byKey["27|Aug|Events"][4] === 0;                      // 신규 키 나머지 0

  Logger.log("Result: " + JSON.stringify(rows));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Find NewP1 Fiscal Year Range (Leads_OPS Create Date 기준)
 * ==========================================================
 */
function findNewP1FiscalYearRange_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(OPS.SHEET.OPS);

  let min = null;
  let max = null;

  if(sheet){

    const values = sheet.getDataRange().getValues();

    if(values.length > 1){

      const headers = values[0];
      const colIndex = headers.indexOf("Create Date");

      if(colIndex !== -1){

        for(let i = 1; i < values.length; i++){

          const date = values[i][colIndex];

          if(date instanceof Date && !isNaN(date.getTime())){

            const fyLabel = getFiscalYear(date);
            const fyNum = Number(fyLabel.replace("FY", ""));

            if(min === null || fyNum < min) min = fyNum;
            if(max === null || fyNum > max) max = fyNum;

          }

        }

      }

    }

  }

  const currentFY = Number(getFiscalYear(new Date()).replace("FY", ""));

  if(min === null) min = currentFY;
  if(max === null || max < currentFY) max = currentFY;

  return { min: min, max: max };

}


/**
 * ==========================================================
 * Setup NewP1 Dropdowns (Control Area — FY/Month 목록 + Generate 체크박스)
 * ==========================================================
 */
function setupNewP1Dropdowns_(sheet){

  const range = findNewP1FiscalYearRange_();

  const fyList = [];

  for(let fy = range.min; fy <= range.max; fy++){
    fyList.push("FY" + String(fy).slice(-2));
  }

  const fyRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(fyList, true)
    .setAllowInvalid(false)
    .build();

  const monthRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.ACQ.FISCAL_MONTH_ORDER, true)
    .setAllowInvalid(false)
    .build();

  sheet.getRange(CONFIG.NEWP1.ROWS.CONTROL_VALUE, CONFIG.NEWP1.COLUMNS.START_FY)
    .setDataValidation(fyRule);

  sheet.getRange(CONFIG.NEWP1.ROWS.CONTROL_VALUE, CONFIG.NEWP1.COLUMNS.END_FY)
    .setDataValidation(fyRule);

  sheet.getRange(CONFIG.NEWP1.ROWS.CONTROL_VALUE, CONFIG.NEWP1.COLUMNS.START_MONTH)
    .setDataValidation(monthRule);

  sheet.getRange(CONFIG.NEWP1.ROWS.CONTROL_VALUE, CONFIG.NEWP1.COLUMNS.END_MONTH)
    .setDataValidation(monthRule);

  sheet.getRange(CONFIG.NEWP1.ROWS.CONTROL_VALUE, CONFIG.NEWP1.COLUMNS.GENERATE)
    .insertCheckboxes();

  Logger.log(
    "NewP1 Dropdowns set up. FY range: FY" +
    String(range.min).slice(-2) + " ~ FY" + String(range.max).slice(-2)
  );

}


/**
 * ==========================================================
 * Setup NewP1 Report (최초 1회 수동 실행)
 *
 * WHY
 * NewP1_REP 시트가 아직 없거나 Control/Report 헤더가 없는 최초 상태에서,
 * 시트 생성 + Control Area 헤더 + Report Area 헤더 + 드롭다운을 한 번에
 * 세팅한다. ACQ_REP과 달리 기존에 수동으로 만들어둔 헤더가 없으므로
 * 코드가 직접 헤더까지 작성한다. 헤더 값만 다시 쓰므로 기존에 걸어둔
 * 필터/freeze는 영향받지 않는다.
 * ==========================================================
 */
function setupNewP1Report(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(CONFIG.NEWP1.SHEET);

  if(!sheet){
    sheet = ss.insertSheet(CONFIG.NEWP1.SHEET);
  }

  sheet.getRange(CONFIG.NEWP1.ROWS.CONTROL_HEADER, 1, 1, 5)
    .setValues([[
      "Start FY", "Start Month", "End FY", "End Month", "Generate Report"
    ]]);

  sheet.getRange(CONFIG.NEWP1.ROWS.REPORT_HEADER, 1, 1, NEWP1_REPORT_HEADERS.length)
    .setValues([NEWP1_REPORT_HEADERS]);

  sheet.getRange(
    CONFIG.NEWP1.ROWS.REPORT_HEADER, CONFIG.NEWP1.TARGET_COLUMNS_START_COL,
    1, NEWP1_TARGET_HEADERS.length
  ).setValues([NEWP1_TARGET_HEADERS]);

  setupNewP1Dropdowns_(sheet);

  Logger.log(CONFIG.LOG.PREFIX + " NewP1_REP sheet initialized.");

}


/**
 * ==========================================================
 * Reverse NewP1 Month Blocks (FY+Month 블록 단위로만 순서 뒤집기)
 *
 * WHY
 * targetRows는 Sort Index 오름차순(오래된 달 → 최신 달) 정렬 상태인데,
 * 리포트에서는 최신 달이 위로 오는 게 보기 편하다. Segment는 실제
 * 데이터에 존재하는 것만 들어있어(전체 7개가 항상 채워지는 게 아님)
 * 블록 크기가 가변이므로, 연속된 행의 (FY, Month) 값이 바뀌는 지점을
 * 블록 경계로 삼는다 (ACQ_REP의 고정 blockSize 방식과 다름).
 *
 * @param {Array<Object>} targetRows  sortIndex 오름차순 정렬된 Engine 행들
 * @return {Array<Object>}
 * ==========================================================
 */
function reverseNewP1MonthBlocks_(targetRows){

  const blocks = [];
  let currentBlock = [];
  let currentKey = null;

  targetRows.forEach(function(row){

    const key = row.fy + "|" + row.month;

    if(key !== currentKey){

      if(currentBlock.length > 0) blocks.push(currentBlock);

      currentBlock = [];
      currentKey = key;

    }

    currentBlock.push(row);

  });

  if(currentBlock.length > 0) blocks.push(currentBlock);

  blocks.reverse();

  return blocks.reduce(function(acc, block){
    return acc.concat(block);
  }, []);

}


/**
 * ==========================================================
 * TEST — reverseNewP1MonthBlocks_()
 * ==========================================================
 */
function testReverseNewP1MonthBlocks(){

  const input = [
    { fy: 26, month: "AUG", label: "Aug-A" },
    { fy: 26, month: "AUG", label: "Aug-B" },
    { fy: 26, month: "SEP", label: "Sep-A" }
  ];

  const result = reverseNewP1MonthBlocks_(input);

  const expectedOrder = ["Sep-A", "Aug-A", "Aug-B"];
  const actualOrder = result.map(function(r){ return r.label; });

  const pass = JSON.stringify(actualOrder) === JSON.stringify(expectedOrder);

  Logger.log("Expected : " + expectedOrder.join(", "));
  Logger.log("Actual   : " + actualOrder.join(", "));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Clear NewP1 Report Area
 * ==========================================================
 */
function clearNewP1ReportArea_(sheet){

  const lastRow = sheet.getLastRow();

  if(lastRow >= CONFIG.NEWP1.ROWS.REPORT_DATA_START){

    const rowCount = lastRow - CONFIG.NEWP1.ROWS.REPORT_DATA_START + 1;

    sheet.getRange(
      CONFIG.NEWP1.ROWS.REPORT_DATA_START, 1,
      rowCount, NEWP1_REPORT_HEADERS.length
    ).clearContent().clearFormat();

    // Target 4컬럼(N열 사용자 수동 영역을 건너뛴 O열부터, 위 NEWP1_TARGET_HEADERS
    // WHY 참고) — A:M과 사이가 떨어져 있어 별도 clear 필요.
    sheet.getRange(
      CONFIG.NEWP1.ROWS.REPORT_DATA_START, CONFIG.NEWP1.TARGET_COLUMNS_START_COL,
      rowCount, NEWP1_TARGET_HEADERS.length
    ).clearContent().clearFormat();

  }

}


/**
 * ==========================================================
 * Generate NewP1 Report (NewP1_Engine 조회만 — 원본 스캔 없음)
 * ==========================================================
 */
function generateNewP1Report_(){

  const start = new Date();

  Logger.log("======================================");
  Logger.log("NewP1 Report Generation Started");
  Logger.log("======================================");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.NEWP1.SHEET);

  if(!sheet){
    throw new Error(CONFIG.NEWP1.SHEET + " sheet not found. setupNewP1Report()를 먼저 실행하세요.");
  }

  //----------------------------------------------------------
  // 1. Read Control Values
  //----------------------------------------------------------

  const controls = sheet
    .getRange(
      CONFIG.NEWP1.ROWS.CONTROL_VALUE, 1, 1,
      CONFIG.NEWP1.COLUMNS.GENERATE
    )
    .getValues()[0];

  const startFY = Number(String(controls[CONFIG.NEWP1.COLUMNS.START_FY - 1]).replace("FY", ""));
  const startMonth = String(controls[CONFIG.NEWP1.COLUMNS.START_MONTH - 1]);
  const endFY = Number(String(controls[CONFIG.NEWP1.COLUMNS.END_FY - 1]).replace("FY", ""));
  const endMonth = String(controls[CONFIG.NEWP1.COLUMNS.END_MONTH - 1]);

  if(startFY > endFY){
    throw new Error("Start FY가 End FY보다 나중입니다. 범위를 확인하세요.");
  }

  //----------------------------------------------------------
  // 2. Read Engine
  //----------------------------------------------------------

  const engineRows = readNewP1EngineRows_();

  if(engineRows.length === 0){

    clearNewP1ReportArea_(sheet);
    Logger.log("NewP1_Engine has no data. refreshNewP1Engine_()을 먼저 실행하세요.");
    return;

  }

  let minFY = engineRows[0].fy;

  engineRows.forEach(function(row){
    if(row.fy < minFY) minFY = row.fy;
  });

  //----------------------------------------------------------
  // 3. Start/End Sort Index 범위 계산
  //----------------------------------------------------------

  const segmentCount = CONFIG.ACQ.SEGMENTS.length;
  const blockSize = segmentCount;

  const startMonthIndex = CONFIG.ACQ.FISCAL_MONTH_ORDER.indexOf(startMonth);
  const endMonthIndex = CONFIG.ACQ.FISCAL_MONTH_ORDER.indexOf(endMonth);

  if(startMonthIndex === -1 || endMonthIndex === -1){
    throw new Error("Start/End Month 조합을 찾을 수 없습니다.");
  }

  const startIndex = ((startFY - minFY) * 12 + startMonthIndex) * blockSize;
  const endIndex = ((endFY - minFY) * 12 + endMonthIndex) * blockSize + blockSize - 1;

  if(endIndex < startIndex){
    throw new Error("Start/End 범위가 올바르지 않습니다.");
  }

  const targetRows = engineRows.filter(function(row){
    return row.sortIndex >= startIndex && row.sortIndex <= endIndex;
  });

  //----------------------------------------------------------
  // 4. 월 블록 단위로 순서 뒤집기 (최신 달이 맨 위로)
  //----------------------------------------------------------

  const reversedTargetRows = reverseNewP1MonthBlocks_(targetRows);

  Logger.log("Report Rows : " + reversedTargetRows.length);

  //----------------------------------------------------------
  // 5. Report Area 작성 (% 컬럼은 여기서 계산, Engine엔 저장 안 함)
  //----------------------------------------------------------

  // Target 조회(90_TargetEngine.js) — New P1 Target은 NewP1_Engine 캐시가
  // 아니라 Target_Engine의 마지막 Generate 결과를 리포트 생성 시점에 붙임
  // (docs/exec-plans/active/2026-07-30-acq-newp1-target-columns.md 참고).
  const targetLookup = computeReportTargetLookup_();

  // 캠페인 지출 조회(AD_004_SpendCache.js) — 2026-08-04까지는 Spent를
  // Target_Engine Block 0 수동 입력(targetLookup.spent)에서 가져왔으나, 이미
  // ACQ_REP은 같은 grain(FY|Month|Segment)의 자동 집계 캐시(Meta+Naver
  // Search+Kakao Channel)를 쓰고 있어(30_ACQReport.js) 두 리포트의 Spent
  // 소스가 서로 달랐음(수동 입력이 실제 캠페인 지출과 어긋나는 원인) — ACQ_REP과
  // 동일한 자동 집계 소스로 통일(2026-08-04 사용자 확정). **캐시만 읽음** —
  // 이 함수는 NewP1_REP Generate 체크박스의 onEdit() Simple Trigger에서
  // 실행되는데, Simple Trigger는 외부 스프레드시트를 못 열어서(ACQ_REP과
  // 동일 제약, docs/exec-plans/active/2026-07-30-campaign-spend-integration.md
  // 참고) 원본 요약 함수가 아니라 같은 메인 스프레드시트 안 캐시만 읽는
  // readAdSpendCacheMap_()를 써야 함. 캐시는 사용자가 runRefreshAdSpendCache()
  // (AD_004_SpendCache.js)를 수동 실행해서 미리 갱신해둬야 함.
  const spendMap = readAdSpendCacheMap_();

  const outputRows = [];
  const targetOutputRows = [];

  reversedTargetRows.forEach(function(row){

    const newP1 = row.newP1;
    const key = row.fy + "|" + row.month + "|" + row.segment;

    outputRows.push([
      "FY" + String(row.fy).slice(-2),
      row.month,
      row.segment,
      newP1,
      row.sal,
      newP1 > 0 ? row.sal / newP1 : "",
      row.icBooked,
      newP1 > 0 ? row.icBooked / newP1 : "",
      row.icComplete,
      newP1 > 0 ? row.icComplete / newP1 : "",
      row.won,
      newP1 > 0 ? row.won / newP1 : "",
      row.revenue
    ]);

    // Ad_Spend_Cache에 그 (FY|Month|Segment) 키 자체가 없으면(예: 아직 캠페인
    // 지출 파이프라인이 커버하지 않는 옛날 달) hasOwnProperty가 false —
    // "지출 0"과 구분해 공란 처리(기존 Target_Engine 조회 때와 동일 관례).
    const hasSpent = spendMap.hasOwnProperty(key);
    const spent = hasSpent ? spendMap[key] : "";
    const cpnp1 = (hasSpent && newP1 > 0) ? spent / newP1 : "";

    const hasNewP1Target = targetLookup.newP1Target.hasOwnProperty(key);
    const newP1Target = hasNewP1Target ? targetLookup.newP1Target[key] : "";
    const newP1TargetPct = (hasNewP1Target && newP1Target > 0)
      ? newP1 / newP1Target : "";

    targetOutputRows.push([spent, cpnp1, newP1Target, newP1TargetPct]);

  });

  clearNewP1ReportArea_(sheet);

  if(outputRows.length > 0){

    sheet.getRange(
      CONFIG.NEWP1.ROWS.REPORT_DATA_START, 1,
      outputRows.length, NEWP1_REPORT_HEADERS.length
    ).setValues(outputRows);

    sheet.getRange(
      CONFIG.NEWP1.ROWS.REPORT_DATA_START, CONFIG.NEWP1.TARGET_COLUMNS_START_COL,
      targetOutputRows.length, NEWP1_TARGET_HEADERS.length
    ).setValues(targetOutputRows);

    applyNewP1ReportStyles_(sheet, outputRows.length);

  }

  SpreadsheetApp.flush();

  const seconds = ((new Date() - start) / 1000).toFixed(2);

  Logger.log("NewP1 Report Generation Completed (" + seconds + "s)");
  Logger.log("======================================");

}


/**
 * ==========================================================
 * Handle NewP1_REP Generate Checkbox Edit
 *
 * WHY
 * GAS는 전역 함수명이 파일 간 중복되면 나중에 로드된 정의가 조용히
 * 덮어쓰므로, 트리거 핸들러(handleReportGenerateEdit()) 자체는
 * 30_ACQReport.js 하나에만 두고 시트 이름으로 분기해서 이 함수를 호출한다
 * (여기서 핸들러를 재정의하지 않음).
 * ==========================================================
 */
function handleNewP1ReportGenerateEdit_(e, sheet){

  const row = e.range.getRow();
  const col = e.range.getColumn();

  const isGenerateCell =
    row === CONFIG.NEWP1.ROWS.CONTROL_VALUE &&
    col === CONFIG.NEWP1.COLUMNS.GENERATE;

  if(!isGenerateCell) return;

  if(e.value !== "TRUE") return;

  try {

    refreshAndGenerateNewP1Report_();

  } finally {

    sheet.getRange(row, col).setValue(false);

  }

}


/**
 * ==========================================================
 * Manual-run public wrapper (Apps Script 편집기 Run 드롭다운 노출용)
 *
 * WHY (2026-08-06 — 비동기 트리거 방식 → 동기 방식으로 재전환)
 * 30_ACQReport.js의 runACQReportGenerateTail()과 동일 이유 — Apps Script
 * 시간 기반 1회성 트리거의 예측 불가능한 디스패치 지연(실측 1~2분+)이
 * DealTracker_Engine 캐시 도입 이후의 빠른 실행 시간(대부분 수 초~1분)보다
 * 체감상 더 나빠서, handleNewP1ReportGenerateEdit_() 안에서 다시 동기
 * 호출하도록 전환(사용자 확정). 이 함수는 트리거 핸들러가 아니라 편집기
 * 수동 테스트 진입점으로만 남김.
 * ==========================================================
 */
function runNewP1ReportGenerateTail(){

  refreshAndGenerateNewP1Report_();

}


/**
 * ==========================================================
 * Refresh And Generate NewP1 Report (Full Authorization 전용)
 *
 * WHY (2026-08-06 — Revenue 전용으로 축소, 성능 버그 수정)
 * 30_ACQReport.js의 refreshAndGenerateACQReport_()와 동일한 이유/변경.
 * Ad Spend Cache 전체 갱신 + NewP1_Engine 전체 재계산(refreshNewP1Engine_(),
 * Leads_OPS 3만5천+행 전체 스캔)을 매번 돌렸더니 실측 69초가 걸려 회의 중
 * 활용이 불가능했음(사용자 확인). New P1/SAL/IC Booked/IC Complete는
 * Leads/MTA Import 시에만 바뀌고 이미 백그라운드 파이프라인이 최신
 * 유지 중이라 Generate 시점 재스캔이 무의미함. Won/Revenue(Deal
 * Tracker)만 Import와 무관하게 언제든 바뀔 수 있어 재조회 가치가 있음 —
 * refreshNewP1EngineRevenueOnly_()(이 파일, Leads_OPS 스캔 없이 Deal
 * Tracker Won/Revenue만 병합)로 교체. Spent는 이번 범위에서 제외 — 기존
 * 백그라운드 파이프라인(refreshCampaignSpend_())에 계속 맡김.
 *
 * refresh 실패해도 Logger에만 기록하고 report 생성은 계속 진행
 * (08_PipelineAsync.js refreshCampaignSpend_()와 동일한 비필수 처리 원칙).
 *
 * 2026-08-06 추가: refreshNewP1EngineRevenueOnly_() 전에
 * appendNewDealTrackerRows_()(90_TargetEngine.js, 30_ACQReport.js
 * refreshAndGenerateACQReport_()와 동일 이유)를 먼저 호출 — DealTracker_Engine
 * 증분 동기화.
 * ==========================================================
 */
function refreshAndGenerateNewP1Report_(){

  try {

    appendNewDealTrackerRows_();

  } catch(err){

    Logger.log(CONFIG.LOG.PREFIX + " refreshAndGenerateNewP1Report_: appendNewDealTrackerRows_ failed - " + err);

  }

  try {

    refreshNewP1EngineRevenueOnly_();

  } catch(err){

    Logger.log(CONFIG.LOG.PREFIX + " refreshAndGenerateNewP1Report_: refreshNewP1EngineRevenueOnly_ failed - " + err);

  }

  generateNewP1Report_();

}
