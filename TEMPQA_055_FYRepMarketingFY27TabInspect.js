/**
 * ==========================================================
 * Marketing 2.0
 * TEMPQA — FY_REP Marketing FY27 탭 헤더 행 확인 (일회성 진단)
 *
 * WHY (2026-09-08, 사용자 리포트 — "FY_REP에 AUG spending이 없어")
 * `CONFIG.FYREP.MARKETING_SOURCE.TABS`(CORE_001_Config.js)에 24/25/26만
 * 등록돼 있고 27이 없어 FY27(2026-08~) Marketing 섹션이 빈 값으로 나오는
 * 것까지는 코드로 확인됨(computeFYRepMarketingRowsForFY_()가 tabConfig
 * 없으면 빈 배열 반환) — 사용자가 perfTrackerByFY에 "FY27" 탭이 이미
 * 있다고 확인해줬으나, PLATFORM_HEADER_ROW는 연도마다 위치가 달랐던 전례가
 * 있어(FY24/25=25행, FY26=27행) 짐작하지 않고(No Assumptions) 실제 시트를
 * 읽어 확인한다. `parseQuarterlySummaryMonthLabel_()`(FYREP_001_Engine.js,
 * 순수)를 재사용해 C열(MONTH_COL_START)에 "AUGUST"류 월 라벨이 찍힌 행을
 * 자동으로 찾는다.
 *
 * Stage
 * TEMPQA (일회성 진단 — 재사용 목적 아님, 확인 끝나면 삭제 가능)
 *
 * Version
 * v1.3.0
 *
 * Change Log
 * v1.3.0 (2026-09-08)
 * - 헤더 행(27행) 자체는 기존 FY24/25/26과 같은 위치·같은 C=Aug~N=Jul
 *   컬럼 배치임을 사용자가 시트에서 직접 확인(코드가 헤더 행 텍스트/날짜
 *   값 자체는 안 읽고 컬럼 "위치"만 쓰므로 앞서 본 Date 값 차이는 무관함을
 *   확인). 남은 미확인 사항은 METRIC_ROW_LABELS.SPENT_PREFIX("Amount spent
 *   (total)")가 이 탭에도 그대로 있는지 — 1번째 블록(Facebook, 29행~)의
 *   B열 메트릭 라벨을 보니 "Channel Revenue"/"ROAS"/"Deals" 등 기존과
 *   완전히 다른 이름들이라 신규 진단 함수(`runInspectFYRepMarketingFY27FirstBlockLabels()`)
 *   추가 — 29행부터 다음 블록 시작(61행) 전까지 B열 라벨 전체 + "spend"
 *   부분일치 전체 시트 스캔.
 * v1.2.0 (2026-09-08)
 * - 2차 스캔 결과 "aug" 매치가 전부 Date 객체(예: "Mon Aug 31 2026...")로
 *   나와 FY24/25/26의 텍스트 라벨("AUGUST") 구조와 다른 것으로 확인 —
 *   실제 레이아웃을 육안으로 봐야 판단 가능해, 상단 35행 원본 덤프를
 *   조건부 fallback에서 무조건 실행으로 변경.
 * v1.1.0 (2026-09-08)
 * - C열 "AUGUST"류 완전일치 스캔이 0건이라(1차 실행 결과), 원인 불명 상태에서
 *   짐작하지 않기 위해 (1) "aug" 부분일치로 전체 시트 스캔 범위 확대, (2) 상단
 *   40행 A~O열 원본 그대로 로그로 덤프하는 fallback 추가.
 * v1.0.0 (2026-09-08)
 * - 신규.
 * ==========================================================
 */
function runInspectFYRepMarketingFY27TabHeaderRow(){

  const config = CONFIG.FYREP.MARKETING_SOURCE;
  const tabName = "FY27";

  const file = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const sheet = file.getSheetByName(tabName);

  if(!sheet){
    Logger.log("탭 '" + tabName + "'을 찾을 수 없음 — 실제 탭 이름 확인 필요. 전체 탭 목록: " +
      file.getSheets().map(function(s){ return s.getName(); }).join(", "));
    return;
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  Logger.log("탭 '" + tabName + "' 발견 — lastRow=" + lastRow + " / lastCol=" + lastCol);

  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();

  // 1차 시도: C열 완전일치("AUGUST" 등)
  const candidateRows = [];

  for(let r = 0; r < values.length; r++){
    const cCellValue = values[r][config.MONTH_COL_START - 1]; // C열
    const parsed = parseQuarterlySummaryMonthLabel_(cCellValue);
    if(parsed === "AUG"){
      candidateRows.push(r + 1); // 1-based row number
    }
  }

  Logger.log("[1차] C열이 'AUGUST'류로 완전일치되는 후보 행(1-based): " + JSON.stringify(candidateRows));

  // 2차 시도: 전체 시트 어느 셀이든 "aug" 부분일치(대소문자 무관) — "Aug-26"/"Aug"류 대비
  const partialMatches = [];

  for(let r = 0; r < values.length; r++){
    for(let c = 0; c < values[r].length; c++){
      const cellText = String(values[r][c] || "");
      if(cellText.toLowerCase().indexOf("aug") !== -1){
        partialMatches.push({ row: r + 1, col: c + 1, value: cellText });
      }
    }
  }

  Logger.log("[2차] 'aug' 부분일치 셀(행/열 1-based): " + JSON.stringify(partialMatches));

  // 3차: 상단 35행 A~O열 원본 그대로 무조건 덤프(2차 결과가 Date 객체라 구조가
  // FY24/25/26 텍스트 라벨 구조와 다른 것으로 보여, 실제 레이아웃을 육안으로
  // 확인하기 위해 항상 실행 — 짐작 금지).
  Logger.log("[3차] 상단 " + Math.min(35, values.length) + "행 원본 덤프(Date는 toString()):");
  for(let r = 0; r < Math.min(35, values.length); r++){
    const rowDump = values[r].slice(0, Math.min(lastCol, 15)).map(function(v){
      return v instanceof Date ? v.toString() : v;
    });
    Logger.log((r + 1) + " : " + JSON.stringify(rowDump));
  }

  candidateRows.forEach(function(rowNum){
    const rowIdx = rowNum - 1;
    const windowStart = Math.max(0, rowIdx - 2);
    const windowEnd = Math.min(values.length, rowIdx + 3);
    Logger.log("--- 후보 행 " + rowNum + " 주변(행 " + (windowStart + 1) + "~" + windowEnd + ") ---");
    for(let r = windowStart; r < windowEnd; r++){
      Logger.log((r + 1) + " : " + JSON.stringify(values[r].slice(0, Math.min(lastCol, 15))));
    }
  });

}


/**
 * ==========================================================
 * TEMPQA — FY27 탭 첫 플랫폼 블록(Facebook, 29~60행) B열 라벨 전체 확인 +
 * "spend" 부분일치 전체 스캔
 *
 * WHY
 * 헤더 행/컬럼 배치는 기존과 동일함이 확인됐으나, METRIC_ROW_LABELS.
 * SPENT_PREFIX("Amount spent (total)")가 이 탭에도 그대로 쓰이는지는
 * 미확인 — 앞서 본 29~35행 라벨("Channel Revenue"/"ROAS"/"Deals" 등)이
 * 기존과 완전히 달라 이 탭의 지표 구성 자체가 새로 짜였을 가능성이 있음.
 * ==========================================================
 */
function runInspectFYRepMarketingFY27FirstBlockLabels(){

  const config = CONFIG.FYREP.MARKETING_SOURCE;
  const file = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const sheet = file.getSheetByName("FY27");

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();

  Logger.log("=== 29~60행(첫 블록, Facebook 추정) A/B열 라벨 + C/D열(Jul/Aug 값) ===");
  for(let r = 28; r < Math.min(60, values.length); r++){
    Logger.log((r + 1) + " : A=" + JSON.stringify(values[r][0]) +
      " / B=" + JSON.stringify(values[r][1]) +
      " / C=" + JSON.stringify(values[r][2]) +
      " / D=" + JSON.stringify(values[r][3]));
  }

  const spendMatches = [];
  for(let r = 0; r < values.length; r++){
    const bText = String(values[r][1] || "");
    if(bText.toLowerCase().indexOf("spend") !== -1){
      spendMatches.push({ row: r + 1, value: bText });
    }
  }

  Logger.log("=== B열 'spend' 부분일치(대소문자 무관) 전체 시트: " + JSON.stringify(spendMatches) + " ===");

}
