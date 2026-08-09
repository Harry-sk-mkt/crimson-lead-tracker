/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — FY_REP External Spreadsheet Structure Inspection
 *
 * Responsibility
 * FY_REP(신규, docs/FYReportDesign.md) 구현 전 실물 구조 확인용 1회성 진단.
 * 사용자가 과거 FY24~26 Revenue Target/Spent를 수동 관리해온 외부
 * 스프레드시트(https://docs.google.com/spreadsheets/d/1QDB_9MiD6eTeNlnC8YMWXbyncSwgDOTZT-A-KItlu6A)
 * 의 탭 목록/숨김 여부/실제 헤더·데이터 배치를 읽기 전용으로 확인한다 —
 * "Sheet 이름/Column Index/Header는 절대 추측하지 않는다"(CLAUDE.md No
 * Assumptions) 원칙에 따라, Config/Engine을 작성하기 전에 실물부터 본다.
 *
 * WHY
 * 사용자가 링크만 공유하고 "hide된 값 안보이면 알려줘"라고 확인 요청 —
 * Apps Script의 SpreadsheetApp은 숨겨진 시트(isSheetHidden())/숨겨진
 * 행·열(isRowHiddenByUser()/isColumnHiddenByUser())도 값 자체는 정상적으로
 * 읽을 수 있으므로(화면에 안 보일 뿐 데이터 접근엔 제약 없음), 어떤 시트/행/열이
 * 숨겨져 있는지까지 함께 보고해 "숨겨져서 놓친 데이터"가 없는지 확인한다.
 *
 * Stage
 * 90 Reporting (Target/FY) — 임시 진단, 90_TargetEngine.js와 동일
 * openTargetExternalSheetByGid_() 재사용
 *
 * Version
 * v1.7.1
 *
 * Change Log
 * v1.7.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `96_TempQA_FYRepExternalSheet.js` → 신규 `TEMPQA_006_FYRepExternalSheet.js`, 코드 내용 변경 없음.
 * v1.7.0 (2026-08-08)
 * - runInspectFYRepQuarterlySummaryColumns() 신규 — v1.6.0 로그를 파이프(" | ")로
 *   join된 텍스트로 육안 카운팅하다 보니 FY26 헤더 행(6행)과 데이터 행(7행)의
 *   컬럼이 밀린 것처럼 보이는 게 실제 시트 구조인지 카운팅 실수인지 구분이
 *   안 됨 — 컬럼 문자를 명시적으로 붙여 한 줄에 하나씩 찍어 오독 위험을 제거.
 * v1.6.0 (2026-08-08)
 * - runInspectFYRepQuarterlySummary() 신규 — Revenue 섹션 Engine 착수 전 마지막
 *   확인. Quarterly Summary(회사 전체 월별 Target/Actual, 플랫폼 블록 헤더 행
 *   직전까지)의 실제 헤더 행 + 전체 컬럼(C열부터) 값을 탭별로 통째로 덤프해
 *   "Revenue Target이 정확히 몇 행 몇 열인지" 코드 작성 전 확정한다 —
 *   runInspectFYRepConsolidatedSheet()는 상위 15행만 봐서 FY26(헤더 27행)은
 *   안 잘림.
 * v1.5.0 (2026-08-07)
 * - runInspectFYRepConsolidatedSheetHeaderRows() 신규 — 실제 컬럼 작성 전
 *   마지막 확인. 플랫폼 블록 표(FY24/25 헤더행=25, FY26 헤더행=27)의 "월→열"
 *   매핑을 정확히 확정하기 위해 헤더 행 + 데이터 행 1개(Facebook Amount
 *   spent)를 getDisplayValues()로 덤프 — 날짜가 서식대로 표시되는지, 원본
 *   시리얼 숫자로 나오는지까지 함께 확인.
 * v1.4.0 (2026-08-07)
 * - runInspectFYRepConsolidatedSheetBlocks() 신규 — perfTrackerByFY의
 *   FY24/FY25/FY26 탭이 상위 15행(Quarterly Summary)만으론 다 안 보이는
 *   길이(각 201~251행)라, 매체별(Facebook/Google/Naver) 블록이 그 아래
 *   더 있는지 A/B열만 전체 스캔해서 확인(디지털팀 KR탭에서 썼던 것과
 *   동일한 기법 재사용).
 * v1.3.0 (2026-08-07)
 * - runInspectFYRepConsolidatedSheet() 신규 — 사용자가 "FY24부터 통합하는
 *   시트를 하나 만들어볼게"라며 신규 스프레드시트 링크 공유(2026-08-07,
 *   디지털팀 트래커에는 FY27 1년치만 있고 FY24/25가 없다는 게 확인된 직후).
 *   이 시트가 FY_REP Marketing 섹션의 최종 소스가 될 가능성이 높아 구조부터 확인.
 * v1.2.0 (2026-08-07)
 * - runInspectFYRepCampaignEngineSheet() 신규 — 사용자가 "지금 캠페인 데이터를
 *   다시 쌓고 있는 시트"로 별도 스프레드시트를 공유(2026-08-07). "0. Weekly"의
 *   MonthlyGFA 탭이 FY26 Mar부터만 있어 Google 매체 과거 데이터가 사실상
 *   없다는 게 확인된 직후라, 이 새 시트가 그 공백을 메우는 최신 소스인지
 *   구조부터 확인.
 * v1.1.0 (2026-08-07)
 * - runInspectFYRepChannelTabs() 신규 — "FY" 탭의 Marketing 섹션을
 *   Meta/Google/Naver 등 실제 매체 기준으로 만들고 싶다는 요청(2026-08-07)
 *   으로, 같은 파일의 다른 탭(MonthlyMeta/MonthlyNSA/MonthlyGFA/MetaLeads/
 *   WeeklyNSA)에 이미 매체별 과거 데이터가 있는지 확인. 전체 덤프 대신
 *   탭당 상위 8행만(구조 파악 목적).
 * v1.0.0 (2026-08-07)
 * - 최초 작성 — runInspectFYRepExternalSheet()
 * ==========================================================
 */


/**
 * ==========================================================
 * Run Inspect FY_REP External Sheet (읽기 전용, 안전)
 *
 * WHY
 * 함수 본문 참고. 시트를 전혀 수정하지 않는다.
 * ==========================================================
 */
function runInspectFYRepExternalSheet(){

  const SPREADSHEET_ID = "1QDB_9MiD6eTeNlnC8YMWXbyncSwgDOTZT-A-KItlu6A";
  const TARGET_GID = 346067156;

  const file = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheets = file.getSheets();

  Logger.log("======================================");
  Logger.log("파일: " + file.getName());
  Logger.log("탭 개수: " + sheets.length);
  Logger.log("======================================");

  sheets.forEach(function(sheet){

    Logger.log(
      (sheet.getSheetId() === TARGET_GID ? "▶ " : "  ") +
      "\"" + sheet.getName() + "\"" +
      " (gid=" + sheet.getSheetId() + ")" +
      " hidden=" + sheet.isSheetHidden() +
      " rows=" + sheet.getLastRow() + "/" + sheet.getMaxRows() +
      " cols=" + sheet.getLastColumn() + "/" + sheet.getMaxColumns()
    );

  });

  const target = findSheetByGid_(file, TARGET_GID);

  if(!target){
    Logger.log("❌ gid=" + TARGET_GID + " 시트를 찾을 수 없음 (URL의 gid 재확인 필요)");
    return;
  }

  Logger.log("");
  Logger.log("======================================");
  Logger.log("대상 시트 상세: \"" + target.getName() + "\"");
  Logger.log("======================================");

  const lastRow = target.getLastRow();
  const lastCol = target.getLastColumn();
  const frozenRows = target.getFrozenRows();
  const frozenCols = target.getFrozenColumns();

  Logger.log("Frozen rows=" + frozenRows + " / Frozen cols=" + frozenCols);

  const hiddenRows = [];
  for(let r = 1; r <= lastRow; r++){
    if(target.isRowHiddenByUser(r)) hiddenRows.push(r);
  }

  const hiddenCols = [];
  for(let c = 1; c <= lastCol; c++){
    if(target.isColumnHiddenByUser(c)) hiddenCols.push(c);
  }

  Logger.log("숨겨진 행(사용자가 숨김): " + (hiddenRows.length ? hiddenRows.join(",") : "없음"));
  Logger.log("숨겨진 열(사용자가 숨김): " + (hiddenCols.length ? hiddenCols.join(",") : "없음"));

  const dumpRowCount = Math.min(lastRow, 40);
  const values = target.getRange(1, 1, dumpRowCount, lastCol).getDisplayValues();

  Logger.log("");
  Logger.log("--- 상위 " + dumpRowCount + "행 (표시값 기준, 열은 |로 구분) ---");

  values.forEach(function(row, i){
    Logger.log((i + 1) + ": " + row.join(" | "));
  });

  if(lastRow > 40){

    const tailStart = Math.max(41, lastRow - 9);
    const tailValues = target.getRange(tailStart, 1, lastRow - tailStart + 1, lastCol).getDisplayValues();

    Logger.log("");
    Logger.log("--- 마지막 " + tailValues.length + "행(" + tailStart + "~" + lastRow + ") ---");

    tailValues.forEach(function(row, i){
      Logger.log((tailStart + i) + ": " + row.join(" | "));
    });

  }

  Logger.log("");
  Logger.log("======================================");
  Logger.log("Named Ranges (있으면 컬럼 참조에 참고)");
  Logger.log("======================================");

  const namedRanges = file.getNamedRanges();

  if(namedRanges.length === 0){
    Logger.log("없음");
  } else {
    namedRanges.forEach(function(nr){
      Logger.log(nr.getName() + " => " + nr.getRange().getA1Notation() + " (" + nr.getRange().getSheet().getName() + ")");
    });
  }

}


/**
 * ==========================================================
 * Run Inspect FY_REP Channel Tabs (읽기 전용, 안전)
 *
 * WHY
 * 함수 본문 참고 — 파일 상단 v1.1.0 Change Log 참고. Marketing 섹션을
 * 매체(Meta/Google/Naver) 기준으로 만들려면 이 탭들에 이미 과거 매체별
 * 데이터가 쌓여있는지부터 확인해야 한다. 탭별 상위 8행만 덤프(구조 확인
 * 목적 — 전체 데이터가 필요하면 별도로 다시 조회).
 * ==========================================================
 */
function runInspectFYRepChannelTabs(){

  const SPREADSHEET_ID = "1QDB_9MiD6eTeNlnC8YMWXbyncSwgDOTZT-A-KItlu6A";
  const TAB_NAMES = ["MonthlyMeta", "MonthlyNSA", "MonthlyGFA", "MetaLeads", "WeeklyNSA"];

  const file = SpreadsheetApp.openById(SPREADSHEET_ID);

  TAB_NAMES.forEach(function(name){

    const sheet = file.getSheetByName(name);

    Logger.log("");
    Logger.log("======================================");
    Logger.log("탭: \"" + name + "\"");
    Logger.log("======================================");

    if(!sheet){
      Logger.log("❌ 탭을 찾을 수 없음");
      return;
    }

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    Logger.log(
      "hidden=" + sheet.isSheetHidden() +
      " rows=" + lastRow + "/" + sheet.getMaxRows() +
      " cols=" + lastCol + "/" + sheet.getMaxColumns() +
      " frozenRows=" + sheet.getFrozenRows() +
      " frozenCols=" + sheet.getFrozenColumns()
    );

    if(lastRow === 0 || lastCol === 0){
      Logger.log("(빈 시트)");
      return;
    }

    const dumpRowCount = Math.min(lastRow, 8);
    const values = sheet.getRange(1, 1, dumpRowCount, lastCol).getDisplayValues();

    values.forEach(function(row, i){
      Logger.log((i + 1) + ": " + row.join(" | "));
    });

    if(lastRow > dumpRowCount){

      const lastFewValues = sheet.getRange(Math.max(dumpRowCount + 1, lastRow - 2), 1, Math.min(3, lastRow - dumpRowCount), lastCol).getDisplayValues();
      const startRow = Math.max(dumpRowCount + 1, lastRow - 2);

      Logger.log("... (마지막 " + lastFewValues.length + "행, " + startRow + "~" + lastRow + ") ...");

      lastFewValues.forEach(function(row, i){
        Logger.log((startRow + i) + ": " + row.join(" | "));
      });

    }

  });

}


/**
 * ==========================================================
 * Run Inspect FY_REP Campaign Engine Sheet (읽기 전용, 안전)
 *
 * WHY
 * 파일 상단 v1.2.0 Change Log 참고 — 사용자가 공유한 "캠페인 데이터를 다시
 * 쌓고 있는" 별도 스프레드시트의 전체 탭 목록 + 지정 gid 탭 구조를 확인.
 * runInspectFYRepExternalSheet()와 동일한 패턴(탭 목록 → 숨김행/열 → 상위/
 * 하위 행 덤프), 다른 스프레드시트 ID라 별도 함수로 분리.
 * ==========================================================
 */
function runInspectFYRepCampaignEngineSheet(){

  const SPREADSHEET_ID = "1zOZGwnsm0GhLGGe5rATu8jR5WxAQVx7YmmiPZVU88jY";
  const TARGET_GID = 1926742852;

  const file = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheets = file.getSheets();

  Logger.log("======================================");
  Logger.log("파일: " + file.getName());
  Logger.log("탭 개수: " + sheets.length);
  Logger.log("======================================");

  sheets.forEach(function(sheet){

    Logger.log(
      (sheet.getSheetId() === TARGET_GID ? "▶ " : "  ") +
      "\"" + sheet.getName() + "\"" +
      " (gid=" + sheet.getSheetId() + ")" +
      " hidden=" + sheet.isSheetHidden() +
      " rows=" + sheet.getLastRow() + "/" + sheet.getMaxRows() +
      " cols=" + sheet.getLastColumn() + "/" + sheet.getMaxColumns()
    );

  });

  const target = findSheetByGid_(file, TARGET_GID);

  if(!target){
    Logger.log("❌ gid=" + TARGET_GID + " 시트를 찾을 수 없음 (URL의 gid 재확인 필요)");
    return;
  }

  Logger.log("");
  Logger.log("======================================");
  Logger.log("대상 시트 상세: \"" + target.getName() + "\"");
  Logger.log("======================================");

  const lastRow = target.getLastRow();
  const lastCol = target.getLastColumn();

  Logger.log(
    "Frozen rows=" + target.getFrozenRows() + " / Frozen cols=" + target.getFrozenColumns()
  );

  const hiddenRows = [];
  for(let r = 1; r <= lastRow; r++){
    if(target.isRowHiddenByUser(r)) hiddenRows.push(r);
  }

  const hiddenCols = [];
  for(let c = 1; c <= lastCol; c++){
    if(target.isColumnHiddenByUser(c)) hiddenCols.push(c);
  }

  Logger.log("숨겨진 행: " + (hiddenRows.length ? hiddenRows.join(",") : "없음"));
  Logger.log("숨겨진 열: " + (hiddenCols.length ? hiddenCols.join(",") : "없음"));

  const dumpRowCount = Math.min(lastRow, 30);
  const values = target.getRange(1, 1, dumpRowCount, lastCol).getDisplayValues();

  Logger.log("");
  Logger.log("--- 상위 " + dumpRowCount + "행 ---");

  values.forEach(function(row, i){
    Logger.log((i + 1) + ": " + row.join(" | "));
  });

  if(lastRow > dumpRowCount){

    const tailStart = Math.max(dumpRowCount + 1, lastRow - 9);
    const tailValues = target.getRange(tailStart, 1, lastRow - tailStart + 1, lastCol).getDisplayValues();

    Logger.log("");
    Logger.log("--- 마지막 " + tailValues.length + "행(" + tailStart + "~" + lastRow + ") ---");

    tailValues.forEach(function(row, i){
      Logger.log((tailStart + i) + ": " + row.join(" | "));
    });

  }

}


/**
 * ==========================================================
 * Run Inspect FY_REP Consolidated Sheet (읽기 전용, 안전)
 *
 * WHY
 * 파일 상단 v1.3.0 Change Log 참고 — gid 없이 기본 URL만 공유돼 대상 탭이
 * 뭔지 모르므로, 다른 함수들과 달리 gid 하나를 찍어서 열지 않고 전체 탭을
 * 각각 훑는다(탭별 상위 15행). 아직 만들고 있는 시트라 대부분 비어있을
 * 수 있음 — 그 경우도 있는 그대로 보고.
 * ==========================================================
 */
function runInspectFYRepConsolidatedSheet(){

  const SPREADSHEET_ID = "1DhJynLE6eySh6X9X-Zsgbs6HvuXDT5omjf_m0XjXQ3o";

  const file = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheets = file.getSheets();

  Logger.log("======================================");
  Logger.log("파일: " + file.getName());
  Logger.log("탭 개수: " + sheets.length);
  Logger.log("======================================");

  sheets.forEach(function(sheet){

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    Logger.log("");
    Logger.log("--- \"" + sheet.getName() + "\" (gid=" + sheet.getSheetId() + ") " +
      "hidden=" + sheet.isSheetHidden() + " rows=" + lastRow + " cols=" + lastCol + " ---");

    if(lastRow === 0 || lastCol === 0){
      Logger.log("(빈 시트)");
      return;
    }

    const dumpRowCount = Math.min(lastRow, 15);
    const values = sheet.getRange(1, 1, dumpRowCount, lastCol).getDisplayValues();

    values.forEach(function(row, i){
      Logger.log((i + 1) + ": " + row.join(" | "));
    });

    if(lastRow > dumpRowCount){
      Logger.log("... (총 " + lastRow + "행 중 상위 " + dumpRowCount + "행만 표시)");
    }

  });

}


/**
 * ==========================================================
 * Run Inspect FY_REP Consolidated Sheet Blocks (읽기 전용, 안전)
 *
 * WHY
 * 파일 상단 v1.4.0 Change Log 참고 — FY24/FY25/FY26 탭 전체(201~251행)를
 * A/B열만 스캔해 매체별 블록("Platform"/"Facebook"/"Google..."/"Naver..."
 * 같은 라벨)이 있는지, 있다면 몇 번째 행부터인지 확인한다.
 * ==========================================================
 */
function runInspectFYRepConsolidatedSheetBlocks(){

  const SPREADSHEET_ID = "1DhJynLE6eySh6X9X-Zsgbs6HvuXDT5omjf_m0XjXQ3o";
  const TAB_NAMES = ["FY24", "FY25", "FY26"];

  const file = SpreadsheetApp.openById(SPREADSHEET_ID);

  TAB_NAMES.forEach(function(name){

    const sheet = file.getSheetByName(name);

    Logger.log("");
    Logger.log("======================================");
    Logger.log("탭: \"" + name + "\" — A/B열 non-blank 전체 스캔");
    Logger.log("======================================");

    if(!sheet){
      Logger.log("❌ 탭을 찾을 수 없음");
      return;
    }

    const lastRow = sheet.getLastRow();
    const values = sheet.getRange(1, 1, lastRow, 2).getDisplayValues();

    values.forEach(function(row, i){
      const a = row[0];
      const b = row[1];
      if(a !== "" || b !== ""){
        Logger.log((i + 1) + ": A='" + a + "' B='" + b + "'");
      }
    });

  });

}


/**
 * ==========================================================
 * Run Inspect FY_REP Consolidated Sheet Header Rows (읽기 전용, 안전)
 *
 * WHY
 * 파일 상단 v1.5.0 Change Log 참고 — 플랫폼 블록 표의 헤더 행(FY24/25=25행,
 * FY26=27행, runInspectFYRepConsolidatedSheetBlocks() 결과 기준)과 Facebook
 * "Amount spent" 데이터 행을 나란히 덤프해 "이 열이 정확히 몇 월인지"를
 * 코드 작성 전 마지막으로 확정한다.
 * ==========================================================
 */
function runInspectFYRepConsolidatedSheetHeaderRows(){

  const SPREADSHEET_ID = "1DhJynLE6eySh6X9X-Zsgbs6HvuXDT5omjf_m0XjXQ3o";
  const TABS = [
    { name: "FY24", headerRow: 25, spentRow: 34 },
    { name: "FY25", headerRow: 25, spentRow: 34 },
    { name: "FY26", headerRow: 27, spentRow: 36 }
  ];

  const file = SpreadsheetApp.openById(SPREADSHEET_ID);

  TABS.forEach(function(tab){

    const sheet = file.getSheetByName(tab.name);

    Logger.log("");
    Logger.log("======================================");
    Logger.log("탭: \"" + tab.name + "\"");
    Logger.log("======================================");

    if(!sheet){
      Logger.log("❌ 탭을 찾을 수 없음");
      return;
    }

    const lastCol = sheet.getLastColumn();

    const headerValues = sheet.getRange(tab.headerRow, 1, 1, lastCol).getDisplayValues()[0];
    const spentValues = sheet.getRange(tab.spentRow, 1, 1, lastCol).getDisplayValues()[0];

    Logger.log("헤더행(" + tab.headerRow + "): " + headerValues.join(" | "));
    Logger.log("Spent행(" + tab.spentRow + "): " + spentValues.join(" | "));

    Logger.log("--- 열별 매핑(헤더 → Facebook Spent) ---");
    for(let i = 0; i < lastCol; i++){
      if(headerValues[i] !== "" || spentValues[i] !== ""){
        Logger.log("col" + (i + 1) + ": '" + headerValues[i] + "' => " + spentValues[i]);
      }
    }

  });

}


/**
 * ==========================================================
 * Run Inspect FY_REP Quarterly Summary (읽기 전용, 안전)
 *
 * WHY
 * 파일 상단 v1.6.0 Change Log 참고 — Revenue 섹션 Engine 착수 전, Quarterly
 * Summary(회사 전체 월별 Target/Actual) 구간을 플랫폼 블록 헤더 행 직전까지
 * 통째로 덤프해 정확한 행/열 구조를 확정한다.
 * ==========================================================
 */
function runInspectFYRepQuarterlySummary(){

  const SPREADSHEET_ID = "1DhJynLE6eySh6X9X-Zsgbs6HvuXDT5omjf_m0XjXQ3o";
  const TABS = [
    { name: "FY24", platformHeaderRow: 25 },
    { name: "FY25", platformHeaderRow: 25 },
    { name: "FY26", platformHeaderRow: 27 }
  ];

  const file = SpreadsheetApp.openById(SPREADSHEET_ID);

  TABS.forEach(function(tab){

    const sheet = file.getSheetByName(tab.name);

    Logger.log("");
    Logger.log("======================================");
    Logger.log("탭: \"" + tab.name + "\" — Quarterly Summary(1~" + (tab.platformHeaderRow - 1) + "행) 전체 덤프");
    Logger.log("======================================");

    if(!sheet){
      Logger.log("❌ 탭을 찾을 수 없음");
      return;
    }

    const lastCol = sheet.getLastColumn();
    const numRows = tab.platformHeaderRow - 1;

    const values = sheet.getRange(1, 1, numRows, lastCol).getDisplayValues();

    values.forEach(function(row, i){
      Logger.log((i + 1) + ": " + row.join(" | "));
    });

  });

}


/**
 * ==========================================================
 * Run Inspect FY_REP Quarterly Summary Columns (읽기 전용, 안전)
 *
 * WHY
 * 파일 상단 v1.7.0 Change Log 참고 — 파이프 join 텍스트 육안 카운팅의 오독
 * 위험을 없애기 위해, 헤더 행 하나와 데이터 행 하나(FY24/25는 "AUGUST" 행,
 * FY26은 "August 2026" 행)를 컬럼 문자를 명시해 한 줄씩 찍는다
 * (columnToLetter_ 없이 A/B/C... 직접 계산 — 이 프로젝트에 아직 없는
 * 범용 유틸이라 이 진단 함수 안에서만 임시로 계산).
 * ==========================================================
 */
function runInspectFYRepQuarterlySummaryColumns(){

  const SPREADSHEET_ID = "1DhJynLE6eySh6X9X-Zsgbs6HvuXDT5omjf_m0XjXQ3o";
  const TABS = [
    { name: "FY24", headerRow: 4, dataRow: 6 },
    { name: "FY25", headerRow: 4, dataRow: 6 },
    { name: "FY26", headerRow: 6, dataRow: 8 }
  ];

  const file = SpreadsheetApp.openById(SPREADSHEET_ID);

  function colLetter(oneBasedIndex){
    let n = oneBasedIndex;
    let s = "";
    while(n > 0){
      const rem = (n - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  TABS.forEach(function(tab){

    const sheet = file.getSheetByName(tab.name);

    Logger.log("");
    Logger.log("======================================");
    Logger.log("탭: \"" + tab.name + "\" — 헤더행(" + tab.headerRow + ")/데이터행(" + tab.dataRow + ") 컬럼별 값");
    Logger.log("======================================");

    if(!sheet){
      Logger.log("❌ 탭을 찾을 수 없음");
      return;
    }

    const lastCol = sheet.getLastColumn();

    const headerValues = sheet.getRange(tab.headerRow, 1, 1, lastCol).getDisplayValues()[0];
    const dataValues = sheet.getRange(tab.dataRow, 1, 1, lastCol).getDisplayValues()[0];

    for(let i = 0; i < lastCol; i++){
      if(headerValues[i] !== "" || dataValues[i] !== ""){
        Logger.log(colLetter(i + 1) + "열: 헤더='" + headerValues[i] + "' | 데이터='" + dataValues[i] + "'");
      }
    }

  });

}
