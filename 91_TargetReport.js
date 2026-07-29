/**
 * ==========================================================
 * Marketing 2.0
 * Target Report (Weekly Segment Target & Achievement Report)
 *
 * Responsibility
 * Target_REP 시트: Report(주간 Target/Actual) 생성 — Control 영역 없음
 * (Generate는 수동 실행, 아래 Change Log 참고). Target_Engine(90_TargetEngine.js)을
 * 조회만 하고, 실적(Actual)은 Leads_OPS/외부 채널·Naver 시트를 직접 스캔한다
 * (Engine의 목표 계산과 분리 — Generate는 Engine 전체 재계산까지 하지만,
 * 실적만 갱신하는 refreshTargetActuals_()는 Engine을 건드리지 않는다).
 *
 * 설계 문서
 * docs/TargetReportDesign.md
 *
 * Stage
 * 90 Reporting (Target)
 *
 * Version
 * v1.4.1
 *
 * Change Log
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
 * Build Target Report Headers (그룹당 7컬럼 × 3그룹 + 고정 3컬럼)
 *
 * WHY (2026-07-27 New/Pipeline 분리 표시 — 사용자 요청)
 * "Target_REP에서 P1이 합계로만 나온다, New P1 Target과 Pipeline P1 Target을
 * 따로 보고 싶다"는 요청에 따라 Target P1(합계) 앞에 Target New P1 / Target
 * Pipeline P1 두 컬럼을 추가(5컬럼 → 7컬럼). Actual P1은 여전히 실적 리드
 * 카운트 하나뿐(리드 생성 시점엔 New/Pipeline 트랙 구분이 없음 — 목표만
 * 트랙별로 나뉘고 실적/달성%는 계속 합계 기준).
 * ==========================================================
 */
function buildTargetReportHeaders_(){

  const headers = CONFIG.TARGET.REPORT.FIXED_HEADERS.slice();

  CONFIG.TARGET.GROUP_ORDER.forEach(function(group){

    const label = capitalizeGroupLabel_(group);

    headers.push(
      label + " Target New P1",
      label + " Target Pipeline P1",
      label + " Target P1",
      label + " Actual P1",
      label + " 달성%",
      label + " Target CPNP1",
      label + " Actual CPNP1"
    );

  });

  return headers;

}


/**
 * ==========================================================
 * Read Target Cutover Date (Target_Engine Input 블록에서 읽기, 없으면 CONFIG 기본값)
 * ==========================================================
 */
function readTargetCutoverDate_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.TARGET.ENGINE_SHEET);

  if(!sheet) return CONFIG.TARGET.CUTOVER_DATE;

  const value = sheet
    .getRange(CONFIG.TARGET.INPUT.ROWS.CUTOVER_DATE, CONFIG.TARGET.INPUT.VALUE_COL)
    .getValue();

  return (value instanceof Date && !isNaN(value.getTime())) ? value : CONFIG.TARGET.CUTOVER_DATE;

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
 * @return {Object}  "yyyy-MM-dd"(Week Start) -> {events, contact, content}
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

    if(!result[key]) result[key] = { events: 0, contact: 0, content: 0 };

    result[key][group]++;

  });

  return result;

}


/**
 * ==========================================================
 * Clear Target Report Area
 * ==========================================================
 */
function clearTargetReportArea_(sheet){

  const rows = CONFIG.TARGET.REPORT.ROWS;
  const lastRow = sheet.getLastRow();
  const colCount = buildTargetReportHeaders_().length;

  if(lastRow >= rows.REPORT_DATA_START){

    sheet.getRange(
      rows.REPORT_DATA_START, 1,
      lastRow - rows.REPORT_DATA_START + 1,
      colCount
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
  const RESET_COLS = 30;

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

  const rows = CONFIG.TARGET.REPORT.ROWS;
  const headers = buildTargetReportHeaders_();

  // 구버전(체크박스+파라미터 요약이 1~3행에 있던 레이아웃, 3행은 전체 컬럼
  // 병합 + italic 서식)을 이미 실행해본 시트일 수 있음 — clearContent()만으로는
  // 병합/서식(이탤릭 등)이 안 지워져 새 레이아웃과 충돌(예: A3 폰트만 다르게
  // 남음, 데이터 쓰기가 옛 병합 셀과 겹쳐 일부 셀이 비어 보임)하는 게 실측됨.
  // 넉넉한 범위를 병합 해제 + 서식 초기화 + 내용/유효성 삭제로 완전히 리셋한다.
  resetTargetReportSheet_(sheet);

  sheet.getRange(rows.REPORT_HEADER, 1, 1, headers.length).setValues([headers]);

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
  const weeklySpentByDateKey = buildCombinedWeeklySpentByDateKey_();
  const cutoverDate = readTargetCutoverDate_();

  const outputRows = weekOrder.map(function(key){

    const week = weekMap[key];
    const actualCounts = actualP1ByWeek[key] || { events: 0, contact: 0, content: 0 };
    const spentCounts = week.weekStart >= cutoverDate ? (weeklySpentByDateKey[key] || null) : null;

    const row = [week.weekStart, week.weekEnd, week.month];

    CONFIG.TARGET.GROUP_ORDER.forEach(function(group){

      const target = week.byGroup[group] ||
        { weeklyNewP1Target: 0, weeklyPipelineP1Target: 0, weeklyP1Target: 0, weeklyCPNP1Target: 0 };

      const targetNewP1 = target.weeklyNewP1Target;
      const targetPipelineP1 = target.weeklyPipelineP1Target;
      const targetP1 = target.weeklyP1Target;
      const actualP1 = actualCounts[group] || 0;
      const achievementPct = targetP1 > 0 ? actualP1 / targetP1 : "";

      const actualSpent = spentCounts ? spentCounts[group] : null;
      const actualCPNP1 = (actualSpent !== null && actualP1 > 0) ? actualSpent / actualP1 : "";

      row.push(
        targetNewP1, targetPipelineP1, targetP1,
        actualP1, achievementPct, target.weeklyCPNP1Target, actualCPNP1
      );

    });

    return row;

  });

  clearTargetReportArea_(sheet);

  const headers = buildTargetReportHeaders_();

  // 헤더는 원래 setupTargetReport()(최초 1회)에서만 썼는데, Generate를 반복
  // 실행해도 헤더가 그때 그대로 남아있어 컬럼 구조가 바뀌면(2026-07-27 New/
  // Pipeline 분리처럼 5→7컬럼) 헤더와 데이터 폭이 어긋나는 문제가 실측됨
  // (사용자 리포트: "매칭되는 헤더가 없다"). Generate할 때마다 헤더도 항상
  // 다시 써서 코드의 현재 buildTargetReportHeaders_()와 무조건 일치시킨다.
  // 넉넉한 버퍼(40컬럼)까지 먼저 비워서, 향후 컬럼 수가 줄어드는 변경이
  // 생겨도 옛 헤더 텍스트가 뒤쪽에 안 남도록 방어(Target_Engine wide-clear와
  // 동일한 교훈, 2026-07-27).
  const HEADER_CLEAR_COLS = 40;
  sheet.getRange(CONFIG.TARGET.REPORT.ROWS.REPORT_HEADER, 1, 1, HEADER_CLEAR_COLS).clearContent();
  sheet.getRange(CONFIG.TARGET.REPORT.ROWS.REPORT_HEADER, 1, 1, headers.length)
    .setValues([headers]);

  sheet.getRange(
    CONFIG.TARGET.REPORT.ROWS.REPORT_DATA_START, 1,
    outputRows.length, headers.length
  ).setValues(outputRows);

  applyTargetReportStyles_(sheet, outputRows.length);

  SpreadsheetApp.flush();

  const seconds = ((new Date() - start) / 1000).toFixed(2);

  Logger.log("Target Report Generation Completed (" + seconds + "s)");
  Logger.log("======================================");

}


/**
 * ==========================================================
 * Update Target Report Actuals Only (Engine 재계산 없이 Actual/달성%만 갱신)
 *
 * WHY
 * §8 "실적 컬럼은 기존 refreshACQSummary_() 호출 지점에서 함께 갱신".
 * Target 컬럼(이미 Generate로 계산됨)은 그대로 두고 Actual P1/달성%/
 * Actual CPNP1만 다시 계산해 덮어쓴다 — Engine 전체 재계산(목표 재산출)은
 * Generate 체크박스에서만 일어난다.
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

  const cutoverDate = readTargetCutoverDate_();
  const weekStarts = values.map(function(row){ return row[0]; });

  const actualP1ByWeek = computeTargetActualP1ByWeek_(weekStarts);
  const weeklySpentByDateKey = buildCombinedWeeklySpentByDateKey_();

  const toKey = function(date){
    return Utilities.formatDate(date, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd");
  };

  const updated = values.map(function(row){

    const weekStart = row[0];

    if(!(weekStart instanceof Date)) return row;

    const key = toKey(weekStart);
    const actualCounts = actualP1ByWeek[key] || { events: 0, contact: 0, content: 0 };
    const spentCounts = weekStart >= cutoverDate ? (weeklySpentByDateKey[key] || null) : null;

    CONFIG.TARGET.GROUP_ORDER.forEach(function(group, i){

      const baseCol = fixedColCount + i * groupColCount;

      // 컬럼 순서(2026-07-27 New/Pipeline 분리, 7컬럼): 0=Target New P1,
      // 1=Target Pipeline P1, 2=Target P1(합계), 3=Actual P1, 4=달성%,
      // 5=Target CPNP1, 6=Actual CPNP1. 0/1/2/5는 읽기만 하고 그대로 둠(Generate가
      // 이미 계산해둔 목표값 — 여기선 실적/달성%만 갱신).
      const targetP1 = row[baseCol + 2];

      const actualP1 = actualCounts[group] || 0;
      const achievementPct = targetP1 > 0 ? actualP1 / targetP1 : "";

      const actualSpent = spentCounts ? spentCounts[group] : null;
      const actualCPNP1 = (actualSpent !== null && actualP1 > 0) ? actualSpent / actualP1 : "";

      row[baseCol + 3] = actualP1;
      row[baseCol + 4] = achievementPct;
      row[baseCol + 6] = actualCPNP1;

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
