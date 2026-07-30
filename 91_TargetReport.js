/**
 * ==========================================================
 * Marketing 2.0
 * Target Report (Weekly Segment Target & Achievement Report)
 *
 * Responsibility
 * Target_REP 시트: Report(주간 Target/Actual) 생성 — Control 영역 없음
 * (Generate는 수동 실행, 아래 Change Log 참고). Target_Engine(90_TargetEngine.js)을
 * 조회만 하고, 실적(Actual P1)은 Leads_OPS를 직접 스캔한다(Engine의 목표 계산과
 * 분리 — Generate는 Engine 전체 재계산까지 하지만, 실적만 갱신하는
 * refreshTargetActuals_()는 Engine을 건드리지 않는다). Actual CPNP1은
 * 2026-07-30부터 Target_Engine Block 0의 세그먼트별 월별 수동 Spent 입력값
 * 기준(예전엔 외부 채널·Naver 시트 주간 정확 매칭 — 3그룹 전용이라 폐기).
 *
 * 설계 문서
 * docs/TargetReportDesign.md
 *
 * Stage
 * 90 Reporting (Target)
 *
 * Version
 * v1.7.0
 *
 * Change Log
 * v1.7.0 (2026-07-30)
 * - 버그 수정(사용자 리포트: "AH:AK 값이 예전 리포트의 잔재로 보인다") — `clearTargetReportArea_()`
 *   가 실제 헤더 폭(33컬럼)만큼만 지워서 옛 7컬럼/세그먼트 구조(38컬럼) 때의 34~38열
 *   잔재가 안 지워지던 문제. 45컬럼 버퍼로 지우도록 수정(writeTargetReportHeaders_()의
 *   HEADER_CLEAR_COLS와 동일 관례) — 다음 Generate 시 자동 정리됨.
 * v1.6.0 (2026-07-30)
 * - 헤더를 3행 구조(세그먼트명/Target·Actual/개별 지표)로 재설계 — 사용자 요청("세그먼트당
 *   7컬럼 플랫 헤더가 너무 넓다"). `buildTargetReportHeaders_()`를 `buildTargetReportMetricHeaders_()`
 *   (4행, 개별 지표 라벨만)로 교체, 신규 `writeTargetReportSegmentHeaderRow_()`(2행, 세그먼트당
 *   병합)/`writeTargetReportTargetActualHeaderRow_()`(3행, Target 4컬럼/Actual 2컬럼 각각
 *   병합)/`writeTargetReportHeaders_()`(2~4행 통합 — 기존 병합 breakApart 후 재작성, setupTargetReport()/
 *   generateTargetReport_() 공용). 컬럼 순서 재배치 + 달성% 완전 제거(사용자 확인: "Progress는
 *   다른 시트에서 확인") — 세그먼트당 7컬럼→6컬럼: Target(New P1/Pipeline P1/P1/CPNP1) +
 *   Actual(P1/CPNP1). `CONFIG.TARGET.REPORT.ROWS`가 REPORT_HEADER/REPORT_DATA_START(2/3)에서
 *   SEGMENT_HEADER_ROW/TARGET_ACTUAL_HEADER_ROW/METRIC_HEADER_ROW/REPORT_DATA_START(2/3/4/5)로
 *   재정의됨(00_Config.js v1.18.0)에 맞춰 `generateTargetReport_()`/`updateTargetReportActuals_()`
 *   컬럼 오프셋 전부 갱신. `resetTargetReportSheet_()`의 RESET_COLS 30→40(실제 컬럼 수
 *   33 초과 대응). 색상은 92_TargetStyles.js v1.6.0에서 처리.
 * v1.5.0 (2026-07-30)
 * - 세그먼트 구조 전면 분해(3그룹 → 5세그먼트) 대응. `buildTargetReportHeaders_()`/
 *   `generateTargetReport_()`/`updateTargetReportActuals_()`/`clearTargetReportArea_()`는
 *   이미 CONFIG.TARGET.GROUP_ORDER를 동적으로 순회하고 있어 설정 변경만으로
 *   자동 확장됨(3그룹×7컬럼=24 → 5세그먼트×7컬럼=38, 코드 변경 불필요). 반면
 *   `computeTargetActualP1ByWeek_()`의 `{events:0,contact:0,content:0}` 하드코딩은
 *   GROUP_ORDER 기반 동적 초기화로 수정(새 세그먼트명에 대해 undefined++라
 *   NaN 발생하던 버그). Actual CPNP1의 원천을 `buildCombinedWeeklySpentByDateKey_()`
 *   (외부 채널/Naver 시트 주간 정확 매칭, 3그룹 전용이라 5세그먼트에 못 씀,
 *   90_TargetEngine.js에서 제거)에서 신규 `computeTargetActualCPNP1ByGroupMonth_()`
 *   (Target_Engine Block 0의 세그먼트별 월별 수동 Spent 기준, 월 값을 그 달
 *   모든 주에 반복 표시 — Target CPNP1과 동일 패턴)로 교체. 이에 따라
 *   더 이상 쓰이지 않게 된 `readTargetCutoverDate_()` 제거(8/3 cutover 게이트는
 *   채널시트 주간 그레인 제약 때문이었고, 월별 수동 입력에는 해당 없음).
 *   상세: docs/exec-plans/active/2026-07-30-target-rep-segment-breakdown.md
 * v1.4.1 (2026-07-27)
 * - generateTargetReport_()가 헤더 행을 한 번도 다시 안 쓰고 있었던 버그
 *   발견·수정 — 헤더는 setupTargetReport()(최초 1회)에서만 쓰였고, 이후
 *   Generate를 아무리 반복해도 그대로 남아있어서, 컬럼 구조가 바뀌면
 *   (v1.4.0의 5→7컬럼 확장) 헤더와 실제 데이터 폭이 어긋나는 문제가
 *   실측됨(사용자 리포트: "매칭되는 헤더가 없다"). generateTargetReport_()가
 *   매번 헤더도 40컬럼 버퍼로 지운 뒤 다시 쓰도록 수정.
 * v1.4.0 (2026-07-27)
 * - Target P1이 New/Pipeline 합계로만 표시되던 걸 분리(사용자 요청): 그룹당
 *   컬럼이 5→7개로 확장(Target New P1 / Target Pipeline P1 / Target P1(합계) /
 *   Actual P1 / 달성% / Target CPNP1 / Actual CPNP1). buildTargetReportHeaders_(),
 *   generateTargetReport_(), updateTargetReportActuals_()의 baseCol 오프셋 전부
 *   갱신(CONFIG.TARGET.REPORT.GROUP_COLUMN_COUNT 5→7). 신규 capitalizeGroupLabel_()
 *   로 헤더의 그룹명을 "events"→"Events"처럼 첫 글자만 대문자로 표시(내부
 *   lookup 키는 그대로 소문자 유지 — 표시 전용).
 * v1.3.0 (2026-07-27)
 * - setupTargetReport()가 clearContent()만 하던 걸 resetTargetReportSheet_()
 *   (병합 해제 + clearFormat + clearContent + clearDataValidations, 넉넉한
 *   범위)로 교체. 구버전 레이아웃(3행 = 파라미터 요약, 전체 컬럼 병합 + italic)의
 *   잔재가 새 레이아웃(3행 = 첫 데이터 행)과 겹쳐 폰트가 다르게 남고 일부 셀
 *   쓰기가 병합 셀과 충돌해 비어 보이는 문제가 실측됨(사용자 리포트: A3 폰트
 *   다름, A5 비어 보임) — 완전 초기화로 해결.
 * v1.2.0 (2026-07-27)
 * - Control 영역(1~3행 — 체크박스/안내문/파라미터 요약) 전체 제거, 리포트
 *   헤더를 2행으로 당기고 데이터는 3행부터 시작 (1행은 향후 월 소계 행
 *   후보로 비워둠, §12 Open Item #8) — 사용자 요청, CONFIG.TARGET.REPORT.ROWS
 *   단순화(00_Config.js). writeTargetParamSummary_() 제거.
 * v1.1.0 (2026-07-27)
 * - Generate 체크박스+onEdit(Simple Trigger) 제거 → 수동 실행(runGenerateTargetReport())
 *   으로 전환. Simple Trigger가 제한된 권한으로 실행돼 SpreadsheetApp.openById()
 *   (채널시트 참조)를 호출할 수 없다는 게 실측으로 확인됨("Specified permissions
 *   are not sufficient to call SpreadsheetApp.openById") — ACQ_REP/NewP1_REP는
 *   외부 파일을 안 열어서 이 문제가 없었음, Target_REP만 해당. handleTargetReportGenerateEdit_()
 *   제거, 30_ACQReport.js의 onEdit() 분기도 함께 제거.
 * v1.0.0 (2026-07-27)
 * - 최초 구현 (docs/TargetReportDesign.md 설계 그대로).
 * ==========================================================
 */


/**
 * ==========================================================
 * Capitalize Group Label (표시 전용 — 내부 key는 계속 소문자, CONFIG.TARGET.
 * GROUP_ORDER/SEGMENT_GROUPS 등 lookup에 쓰이는 값은 절대 안 바꾼다)
 *
 * WHY
 * 사용자 요청(2026-07-27): Target_REP 헤더에 "events"가 아니라 "Events"로
 * 보이길 원함. 내부 group 키("events"/"contact"/"content")는 여러 곳에서
 * 정확히 일치해야 하는 lookup 키로 쓰이므로(classifyDealSegment_, Block D
 * Group열 읽기 등) 그대로 두고, 화면에 표시되는 헤더 텍스트를 만들 때만
 * 첫 글자를 대문자로 바꿔 렌더링한다.
 *
 * TEST
 * capitalizeGroupLabel_("events") === "Events"
 * ==========================================================
 */
function capitalizeGroupLabel_(group){

  const str = String(group || "");

  if(str.length === 0) return str;

  return str.charAt(0).toUpperCase() + str.slice(1);

}


/**
 * ==========================================================
 * Build Target Report Metric Headers (4행 — 그룹당 6컬럼 × 5그룹 + 고정 3컬럼)
 *
 * WHY (2026-07-30 헤더 3행 구조로 재설계 — 사용자 요청)
 * 세그먼트당 7컬럼 플랫 헤더("Seminar Target New P1" 식)가 너무 넓어 가로 스크롤이
 * 심하다는 지적으로, 세그먼트명(2행)/Target·Actual 구분(3행)/개별 지표(4행) 3단
 * 헤더로 재설계 — 이 함수는 그중 4행(개별 지표 라벨)만 담당, 세그먼트명/Target·Actual
 * 배너는 writeTargetReportSegmentHeaderRow_()/writeTargetReportTargetActualHeaderRow_()가
 * 병합 셀로 별도 처리한다. 달성%는 "다른 시트에서 확인한다"는 사용자 확인으로 제거,
 * 세그먼트당 7컬럼 → 6컬럼(Target: New P1/Pipeline P1/P1/CPNP1, Actual: P1/CPNP1).
 * ==========================================================
 */
function buildTargetReportMetricHeaders_(){

  const headers = CONFIG.TARGET.REPORT.FIXED_HEADERS.slice();

  CONFIG.TARGET.GROUP_ORDER.forEach(function(){
    headers.push("New P1", "Pipeline P1", "P1", "CPNP1", "P1", "CPNP1");
  });

  return headers;

}


/**
 * ==========================================================
 * Write Target Report Segment Header Row (2행 — 세그먼트명 배너, 세그먼트당 병합)
 * ==========================================================
 */
function writeTargetReportSegmentHeaderRow_(sheet){

  const rows = CONFIG.TARGET.REPORT.ROWS;
  const fixedColCount = CONFIG.TARGET.REPORT.FIXED_HEADERS.length;
  const groupColCount = CONFIG.TARGET.REPORT.GROUP_COLUMN_COUNT;

  CONFIG.TARGET.GROUP_ORDER.forEach(function(group, i){

    const baseCol = fixedColCount + i * groupColCount + 1; // 1-indexed
    const range = sheet.getRange(rows.SEGMENT_HEADER_ROW, baseCol, 1, groupColCount);

    range.merge();
    range.setValue(capitalizeGroupLabel_(group));

  });

}


/**
 * ==========================================================
 * Write Target Report Target/Actual Header Row (3행 — Target/Actual 구분 배너,
 * 세그먼트 내부에서 Target 4컬럼 / Actual 2컬럼으로 각각 병합)
 * ==========================================================
 */
function writeTargetReportTargetActualHeaderRow_(sheet){

  const rows = CONFIG.TARGET.REPORT.ROWS;
  const fixedColCount = CONFIG.TARGET.REPORT.FIXED_HEADERS.length;
  const groupColCount = CONFIG.TARGET.REPORT.GROUP_COLUMN_COUNT;
  const targetCols = CONFIG.TARGET.REPORT.TARGET_SUBCOLUMN_COUNT;
  const actualCols = CONFIG.TARGET.REPORT.ACTUAL_SUBCOLUMN_COUNT;

  CONFIG.TARGET.GROUP_ORDER.forEach(function(group, i){

    const baseCol = fixedColCount + i * groupColCount + 1; // 1-indexed

    const targetRange = sheet.getRange(rows.TARGET_ACTUAL_HEADER_ROW, baseCol, 1, targetCols);
    targetRange.merge();
    targetRange.setValue("Target");

    const actualRange = sheet.getRange(rows.TARGET_ACTUAL_HEADER_ROW, baseCol + targetCols, 1, actualCols);
    actualRange.merge();
    actualRange.setValue("Actual");

  });

}


/**
 * ==========================================================
 * Write Target Report Headers (2~4행 전체 — 병합 해제 후 재작성)
 *
 * WHY
 * setupTargetReport()(최초 1회)와 generateTargetReport_()(매 실행)이 동일한 헤더
 * 작성 로직을 공유해야 코드 중복 없이 항상 최신 구조로 맞춰진다(v1.4.1에서 겪은
 * "헤더가 안 갱신되는" 버그 재발 방지 — 매번 다시 씀). 병합 범위가 이전 실행과
 * 다를 수 있어(세그먼트 수/컬럼 수 변경 등) 먼저 breakApart()로 기존 병합을 전부
 * 해제한 뒤 다시 병합한다 — 안 그러면 겹치는 병합 범위끼리 충돌해 에러가 난다.
 * ==========================================================
 */
function writeTargetReportHeaders_(sheet){

  const HEADER_CLEAR_COLS = 40;
  const rows = CONFIG.TARGET.REPORT.ROWS;

  const headerClearRange = sheet.getRange(rows.SEGMENT_HEADER_ROW, 1, 3, HEADER_CLEAR_COLS);

  if(headerClearRange.getMergedRanges().length > 0){
    headerClearRange.breakApart();
  }

  headerClearRange.clearContent();

  writeTargetReportSegmentHeaderRow_(sheet);
  writeTargetReportTargetActualHeaderRow_(sheet);

  const metricHeaders = buildTargetReportMetricHeaders_();
  sheet.getRange(rows.METRIC_HEADER_ROW, 1, 1, metricHeaders.length).setValues([metricHeaders]);

}


/**
 * ==========================================================
 * Compute Target Actual P1 By Week (Leads_OPS 1회 스캔)
 *
 * WHY
 * 각 유효 P1 리드의 Create Date가 속한 주(월~일)의 월요일을 구해, 리포트에
 * 실제로 존재하는 주(weekStarts)에만 매칭시켜 카운트한다 (Article 10: Read Once).
 *
 * @param {Array<Date>} weekStarts  리포트에 나열된 모든 Week Start
 * @return {Object}  "yyyy-MM-dd"(Week Start) -> {세그먼트명: count, ...} (CONFIG.TARGET.GROUP_ORDER 순)
 * ==========================================================
 */
function computeTargetActualP1ByWeek_(weekStarts){

  const toKey = function(date){
    return Utilities.formatDate(date, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd");
  };

  const validKeys = {};

  weekStarts.forEach(function(date){
    if(date instanceof Date) validKeys[toKey(date)] = true;
  });

  const result = {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(OPS.SHEET.OPS);

  if(!sheet) return result;

  const records = sheetToObjects(sheet);

  records.forEach(function(record){

    if(!isEffectiveP1_(record["Lead Priority"], record["Priority Override"])) return;

    const group = deriveTargetGroup_(record["Business Segment"]);

    if(!group) return;

    const createDate = record["Create Date"];

    if(!(createDate instanceof Date) || isNaN(createDate.getTime())) return;

    const key = toKey(getMondayOfWeek_(createDate));

    if(!validKeys[key]) return;

    if(!result[key]){
      result[key] = {};
      CONFIG.TARGET.GROUP_ORDER.forEach(function(g){ result[key][g] = 0; });
    }

    result[key][group]++;

  });

  return result;

}


/**
 * ==========================================================
 * Compute Actual CPNP1 By Group/Month (세그먼트별 월별 수동 Spent 기반 — 2026-07-30)
 *
 * WHY
 * 2026-07-30 세그먼트 분해로 Actual Spent/CPNP1의 원천이 "채널시트 주간 정확
 * 매칭"(buildCombinedWeeklySpentByDateKey_(), 3그룹 전용이라 5세그먼트에 못 씀)
 * 에서 "Target_Engine Block 0의 세그먼트별 월별 수동 Spent 입력"으로 바뀌었다.
 * 수동 입력은 월 단위라 주 단위로 쪼갤 근거가 없으므로, Target CPNP1(월별
 * 값을 그 달의 모든 주에 동일하게 반복 표시, computeTargetDerivationRows_()의
 * weeklyCPNP1Target 참고)과 동일한 패턴을 따른다 — 그 달의 Actual CPNP1도
 * 모든 주에 같은 값(월 Spent ÷ 그 달 Actual P1 합계)을 반복 표시한다.
 * 기존의 "8/3 cutover 이전 주는 공란" 게이트는 채널시트의 주간 그레인
 * 제약 때문이었으므로(월 데이터에는 해당 없음) 더 이상 적용하지 않는다.
 *
 * @param {Array<Date>} weekStarts     리포트에 나열된 모든 Week Start
 * @param {Object} actualP1ByWeek      computeTargetActualP1ByWeek_() 결과
 * @return {Object}  "group|month" -> ratio (그 달 Actual P1 합계가 0이면 키 없음)
 * ==========================================================
 */
function computeTargetActualCPNP1ByGroupMonth_(weekStarts, actualP1ByWeek){

  const toKey = function(date){
    return Utilities.formatDate(date, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd");
  };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const engineSheet = ss.getSheetByName(CONFIG.TARGET.ENGINE_SHEET);

  if(!engineSheet) return {};

  const inputs = readTargetEngineInputs_(engineSheet);

  const actualP1ByGroupMonth = {};

  weekStarts.forEach(function(weekStart){

    if(!(weekStart instanceof Date)) return;

    const month = getFiscalMonthLabel(weekStart);
    const counts = actualP1ByWeek[toKey(weekStart)] || {};

    CONFIG.TARGET.GROUP_ORDER.forEach(function(group){

      const groupMonthKey = group + "|" + month;

      actualP1ByGroupMonth[groupMonthKey] =
        (actualP1ByGroupMonth[groupMonthKey] || 0) + (counts[group] || 0);

    });

  });

  const ratios = {};

  CONFIG.TARGET.GROUP_ORDER.forEach(function(group){

    const monthlySpent = inputs.monthlySegmentSpent[group] || {};

    Object.keys(actualP1ByGroupMonth).forEach(function(groupMonthKey){

      if(groupMonthKey.indexOf(group + "|") !== 0) return;

      const month = groupMonthKey.slice(group.length + 1);
      const p1Count = actualP1ByGroupMonth[groupMonthKey];

      if(p1Count > 0 && Object.prototype.hasOwnProperty.call(monthlySpent, month)){
        ratios[groupMonthKey] = monthlySpent[month] / p1Count;
      }

    });

  });

  return ratios;

}


/**
 * ==========================================================
 * Clear Target Report Area
 *
 * WHY (2026-07-30 버그 수정 — 사용자 리포트: "AH:AK 값이 예전 리포트의 잔재로 보인다")
 * 세그먼트당 컬럼이 7→6으로 줄면서(38컬럼→33컬럼) 실제 헤더 폭(colCount=33)만큼만
 * clearContent()하면, 옛 7컬럼 구조 때 썼던 34~38열(AH~AL) 데이터가 안 지워지고
 * 그대로 남는다. HEADER_CLEAR_COLS(writeTargetReportHeaders_())와 동일한 버퍼
 * 관례로 45컬럼까지 넉넉히 지운다(향후 컬럼 수가 또 줄어도 안전).
 * ==========================================================
 */
function clearTargetReportArea_(sheet){

  const rows = CONFIG.TARGET.REPORT.ROWS;
  const lastRow = sheet.getLastRow();
  const CLEAR_COLS_BUFFER = 45;

  if(lastRow >= rows.REPORT_DATA_START){

    sheet.getRange(
      rows.REPORT_DATA_START, 1,
      lastRow - rows.REPORT_DATA_START + 1,
      CLEAR_COLS_BUFFER
    ).clearContent();

  }

}


/**
 * ==========================================================
 * Reset Target Report Sheet (병합 해제 + 서식/내용/유효성 완전 초기화)
 *
 * WHY
 * 레이아웃이 바뀔 때마다(체크박스 → 안내문 → 완전 제거 등) 예전 서식/병합이
 * 새 레이아웃과 같은 셀에 남아 충돌하는 게 실측됨 — 예: 옛 파라미터 요약 행
 * (전체 컬럼 병합 + italic)이 새 첫 데이터 행 자리에 그대로 남아 폰트가
 * 다르게 보이고, 그 행에 새 값을 쓸 때 병합 셀과 겹쳐 일부가 비어 보임.
 * Target_REP는 완전히 재생성 가능한 리포트 시트이므로(Article: Master/Report
 * is Rebuildable), 넉넉한 범위를 병합 해제 → 서식 초기화 → 내용/유효성 삭제
 * 순으로 통째로 리셋한다.
 * ==========================================================
 */
function resetTargetReportSheet_(sheet){

  const RESET_ROWS = 3000;
  // 2026-07-30 헤더 3행 구조 도입 후 실제 컬럼 수(3 고정 + 5세그먼트×6 = 33)가 예전
  // 30을 넘어서 40으로 확장(HEADER_CLEAR_COLS와 동일한 버퍼 관례).
  const RESET_COLS = 40;

  const range = sheet.getRange(1, 1, RESET_ROWS, RESET_COLS);

  if(range.getMergedRanges().length > 0){
    range.breakApart();
  }

  range.clearFormat();
  range.clearContent();
  range.clearDataValidations();

}


/**
 * ==========================================================
 * Setup Target Report (최초 1회 수동 실행)
 *
 * WHY
 * Target_REP/Target_Engine 시트가 아직 없는 최초 상태에서 Report 헤더 +
 * Engine Block 0 기본값까지 한 번에 세팅한다 (NewP1_REP 패턴).
 *
 * WHY (2026-07-27 체크박스/파라미터 요약 제거 — 레이아웃 단순화)
 * Generate 체크박스는 Simple Trigger 권한 한계로 애초에 동작 불가 확인됨
 * (Generate가 SpreadsheetApp.openById()로 채널시트를 열어야 하는데, Simple
 * Trigger는 제한된 권한이라 "Specified permissions are not sufficient to
 * call SpreadsheetApp.openById" 발생 — ACQ_REP/NewP1_REP는 외부 파일을 안
 * 열어서 이 문제가 없었음). Generate를 수동 실행(runGenerateTargetReport())
 * 으로 전환하면서, 시트 내 Control 영역(체크박스/안내문/파라미터 요약) 자체가
 * 불필요해져 통째로 제거 — 사용자 요청으로 1행은 비워두고(향후 월 소계 행
 * 후보, §12 Open Item #8) 2행부터 바로 헤더 시작.
 * ==========================================================
 */
function setupTargetReport(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(CONFIG.TARGET.SHEET);

  if(!sheet){
    sheet = ss.insertSheet(CONFIG.TARGET.SHEET);
  }

  // 구버전(체크박스+파라미터 요약이 1~3행에 있던 레이아웃, 3행은 전체 컬럼
  // 병합 + italic 서식)을 이미 실행해본 시트일 수 있음 — clearContent()만으로는
  // 병합/서식(이탤릭 등)이 안 지워져 새 레이아웃과 충돌(예: A3 폰트만 다르게
  // 남음, 데이터 쓰기가 옛 병합 셀과 겹쳐 일부 셀이 비어 보임)하는 게 실측됨.
  // 넉넉한 범위를 병합 해제 + 서식 초기화 + 내용/유효성 삭제로 완전히 리셋한다.
  resetTargetReportSheet_(sheet);

  writeTargetReportHeaders_(sheet);

  // Target_Engine 최초 생성 + Block 0 기본값 세팅 + Block A~D 1회 계산
  refreshTargetEngine_();

  const engineSheet = ss.getSheetByName(CONFIG.TARGET.ENGINE_SHEET);

  if(engineSheet) engineSheet.hideSheet();

  Logger.log(
    CONFIG.LOG.PREFIX +
    " Target_REP sheet initialized. 리포트 생성은 runGenerateTargetReport()를 직접 Run하세요."
  );

}


/**
 * ==========================================================
 * Generate Target Report (Generate 체크박스 → Engine 전체 재계산 + 리포트 작성)
 * ==========================================================
 */
function generateTargetReport_(){

  const start = new Date();

  Logger.log("======================================");
  Logger.log("Target Report Generation Started");
  Logger.log("======================================");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.TARGET.SHEET);

  if(!sheet){
    throw new Error(CONFIG.TARGET.SHEET + " sheet not found. setupTargetReport()를 먼저 실행하세요.");
  }

  refreshTargetEngine_();

  const derivationRows = readTargetEngineDerivationRows_();

  if(derivationRows.length === 0){

    clearTargetReportArea_(sheet);
    Logger.log("Target_Engine has no data.");
    return;

  }

  //----------------------------------------------------------
  // Week 단위로 그룹핑 (Engine에는 주×그룹 1행씩 있음)
  //----------------------------------------------------------

  const weekMap = {};
  const weekOrder = [];

  derivationRows.forEach(function(row){

    const key = Utilities.formatDate(row.weekStart, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd");

    if(!weekMap[key]){

      weekMap[key] = {
        weekStart: row.weekStart,
        weekEnd: row.weekEnd,
        month: row.month,
        byGroup: {}
      };

      weekOrder.push(key);

    }

    weekMap[key].byGroup[row.group] = row;

  });

  weekOrder.sort(function(a, b){
    return weekMap[a].weekStart - weekMap[b].weekStart;
  });

  const weekStarts = weekOrder.map(function(key){ return weekMap[key].weekStart; });

  const actualP1ByWeek = computeTargetActualP1ByWeek_(weekStarts);
  const actualCPNP1ByGroupMonth = computeTargetActualCPNP1ByGroupMonth_(weekStarts, actualP1ByWeek);

  const outputRows = weekOrder.map(function(key){

    const week = weekMap[key];
    const actualCounts = actualP1ByWeek[key] || {};

    const row = [week.weekStart, week.weekEnd, week.month];

    CONFIG.TARGET.GROUP_ORDER.forEach(function(group){

      const target = week.byGroup[group] ||
        { weeklyNewP1Target: 0, weeklyPipelineP1Target: 0, weeklyP1Target: 0, weeklyCPNP1Target: 0 };

      const targetNewP1 = target.weeklyNewP1Target;
      const targetPipelineP1 = target.weeklyPipelineP1Target;
      const targetP1 = target.weeklyP1Target;
      const actualP1 = actualCounts[group] || 0;

      // 그 달의 Actual CPNP1 값을 그 달 모든 주에 동일하게 반복 표시(Target CPNP1과
      // 동일한 패턴 — computeTargetActualCPNP1ByGroupMonth_() WHY 참고).
      const actualCPNP1Key = group + "|" + week.month;
      const actualCPNP1 = actualCPNP1ByGroupMonth[actualCPNP1Key];

      // 2026-07-30 컬럼 순서 재배치(달성% 제거, 사용자 확인 — "Progress는 다른
      // 시트에서 확인") — Target 4컬럼(New P1/Pipeline P1/P1/CPNP1) 다음 Actual
      // 2컬럼(P1/CPNP1), buildTargetReportMetricHeaders_()/헤더 3행 구조와 순서 일치.
      row.push(
        targetNewP1, targetPipelineP1, targetP1, target.weeklyCPNP1Target,
        actualP1,
        actualCPNP1 === undefined ? "" : actualCPNP1
      );

    });

    return row;

  });

  clearTargetReportArea_(sheet);

  // 헤더는 원래 setupTargetReport()(최초 1회)에서만 썼는데, Generate를 반복
  // 실행해도 헤더가 그때 그대로 남아있어 컬럼 구조가 바뀌면 헤더와 데이터 폭이
  // 어긋나는 문제가 실측됨(사용자 리포트: "매칭되는 헤더가 없다"). Generate할
  // 때마다 writeTargetReportHeaders_()로 헤더 3행(세그먼트명/Target·Actual/개별
  // 지표)을 전부 다시 써서 코드의 현재 구조와 무조건 일치시킨다(2026-07-27 교훈,
  // 2026-07-30 3행 구조 확장에도 동일 적용).
  writeTargetReportHeaders_(sheet);

  const metricHeaders = buildTargetReportMetricHeaders_();

  sheet.getRange(
    CONFIG.TARGET.REPORT.ROWS.REPORT_DATA_START, 1,
    outputRows.length, metricHeaders.length
  ).setValues(outputRows);

  applyTargetReportStyles_(sheet, outputRows.length);

  SpreadsheetApp.flush();

  const seconds = ((new Date() - start) / 1000).toFixed(2);

  Logger.log("Target Report Generation Completed (" + seconds + "s)");
  Logger.log("======================================");

}


/**
 * ==========================================================
 * Update Target Report Actuals Only (Engine 재계산 없이 Actual만 갱신)
 *
 * WHY
 * §8 "실적 컬럼은 기존 refreshACQSummary_() 호출 지점에서 함께 갱신".
 * Target 컬럼(이미 Generate로 계산됨)은 그대로 두고 Actual P1/Actual CPNP1만
 * 다시 계산해 덮어쓴다 — Engine 전체 재계산(목표 재산출)은 Generate 체크박스에서만
 * 일어난다. 달성%는 2026-07-30부터 이 리포트에서 제거(다른 시트에서 확인, 사용자 확인).
 * ==========================================================
 */
function updateTargetReportActuals_(sheet){

  const rows = CONFIG.TARGET.REPORT.ROWS;
  const groupColCount = CONFIG.TARGET.REPORT.GROUP_COLUMN_COUNT;
  const fixedColCount = CONFIG.TARGET.REPORT.FIXED_HEADERS.length;
  const totalCols = fixedColCount + CONFIG.TARGET.GROUP_ORDER.length * groupColCount;

  const lastRow = sheet.getLastRow();
  const dataRowCount = lastRow - rows.REPORT_DATA_START + 1;

  if(dataRowCount <= 0) return;

  const values = sheet.getRange(rows.REPORT_DATA_START, 1, dataRowCount, totalCols).getValues();

  const weekStarts = values.map(function(row){ return row[0]; });

  const actualP1ByWeek = computeTargetActualP1ByWeek_(weekStarts);
  const actualCPNP1ByGroupMonth = computeTargetActualCPNP1ByGroupMonth_(weekStarts, actualP1ByWeek);

  const toKey = function(date){
    return Utilities.formatDate(date, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd");
  };

  const updated = values.map(function(row){

    const weekStart = row[0];

    if(!(weekStart instanceof Date)) return row;

    const key = toKey(weekStart);
    const month = row[2]; // Month 컬럼(라벨만, 예 "AUG") — 리포트에 이미 기록된 값 재사용
    const actualCounts = actualP1ByWeek[key] || {};

    CONFIG.TARGET.GROUP_ORDER.forEach(function(group, i){

      const baseCol = fixedColCount + i * groupColCount;

      // 컬럼 순서(2026-07-30 Target/Actual 그룹핑, 6컬럼): 0=Target New P1,
      // 1=Target Pipeline P1, 2=Target P1(합계), 3=Target CPNP1, 4=Actual P1,
      // 5=Actual CPNP1. 0~3은 읽기 대상이 아님(Generate가 이미 계산해둔 목표값 —
      // 여기선 4/5(Actual)만 갱신).
      const actualP1 = actualCounts[group] || 0;

      // 그 달의 Actual CPNP1을 그 달 모든 주에 동일하게 반복 표시(generateTargetReport_()와
      // 동일한 패턴 — computeTargetActualCPNP1ByGroupMonth_() WHY 참고).
      const actualCPNP1 = actualCPNP1ByGroupMonth[group + "|" + month];

      row[baseCol + 4] = actualP1;
      row[baseCol + 5] = actualCPNP1 === undefined ? "" : actualCPNP1;

    });

    return row;

  });

  sheet.getRange(rows.REPORT_DATA_START, 1, dataRowCount, totalCols).setValues(updated);

}


/**
 * ==========================================================
 * Refresh Target Actuals (Append/Rebuild/Sync/OPS Build 완료 시 자동 호출)
 *
 * WHY
 * Target_REP가 아직 setupTargetReport()/Generate로 만들어지지 않았으면
 * 조용히 skip (다른 리포트의 refreshXXXEngine_()과 달리, 이 함수는 이미
 * 생성된 리포트의 실적 컬럼만 갱신하는 경량 함수라 사전조건 미충족 시
 * 에러 없이 넘어가는 게 맞다).
 * ==========================================================
 */
function refreshTargetActuals_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.TARGET.SHEET);

  if(!sheet) return;

  const lastRow = sheet.getLastRow();

  if(lastRow < CONFIG.TARGET.REPORT.ROWS.REPORT_DATA_START) return;

  updateTargetReportActuals_(sheet);

  SpreadsheetApp.flush();

}


/**
 * ==========================================================
 * TEMP — refreshTargetActuals_() 수동 실행용 공개 래퍼
 * ==========================================================
 */
function runRefreshTargetActuals(){

  refreshTargetActuals_();

}


/**
 * ==========================================================
 * TEMP — generateTargetReport_() 수동 실행용 공개 래퍼
 *
 * WHY
 * 체크박스+onEdit(Simple Trigger) 대신 Apps Script 편집기에서 직접 Run —
 * Simple Trigger는 제한된 권한이라 SpreadsheetApp.openById()(채널시트 참조)를
 * 못 쓰기 때문 (setupTargetReport() Change Log 참고, 2026-07-27 확인).
 * ==========================================================
 */
function runGenerateTargetReport(){

  generateTargetReport_();

}
