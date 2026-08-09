/**
 * ==========================================================
 * Marketing 2.0
 * Workbook Maintenance
 *
 * Responsibility
 * 워크북 전체(모든 시트) 유지보수용 유틸리티. Deal Tracker/리포트 비즈니스
 * 로직과 무관한 순수 "시트 그리드 관리" 책임만 담당한다.
 *
 * WHY
 * 2026-07-28 실측: 워크북 전체 셀 개수가 Google Sheets 상한(1,000만)의 99.8%
 * (9,984,712)에 도달해 새 시트 생성이 "above the limit of 10000000 cells"
 * 에러로 실패함(93_TempQA_DealTrackerMatch.js runReportWorkbookCellUsage()로
 * 실측 확인). Google Sheets 셀 개수는 실제 데이터가 있는 셀이 아니라 시트에
 * 할당된 그리드 크기(getMaxRows()×getMaxColumns())로 계산되는데, 시트 21개
 * 중 상당수가 실사용 범위(getLastRow()/getLastColumn())보다 훨씬 크게
 * 할당돼 있었음(예: MTA_Raw 123,205행 할당 vs 82,715행 사용 — 낭비 셀의
 * 40.8%, Leads_OPS_QA 34,983행 할당 vs 281행 사용 — 낭비 셀의 26.8%. 전체
 * 낭비 3,391,010셀 중 두 시트가 67.6%).
 *
 * 실사용 범위 밖의 빈 행/열만 삭제(deleteRows/deleteColumns)하므로 실제
 * 데이터는 전혀 건드리지 않는다 — 삭제 대상은 항상 getLastRow()/
 * getLastColumn() *이후*의 빈 영역뿐. MTA_Raw/MTA_Master 등 증분 append
 * 방식 시트의 PropertiesService 카운터(예: MTA_LAST_ROW)에도 영향 없음
 * — 기존 데이터 행 위치가 전혀 이동하지 않기 때문(뒤쪽 빈 행만 사라짐).
 * frozen 행/열보다 적게 남기지 않도록 방어, 최소 1행/1열은 항상 유지.
 *
 * Version
 * v1.0.1
 * ==========================================================
 */


/**
 * ==========================================================
 * Compute Sheet Trim Plan (순수 함수)
 *
 * WHY
 * "몇 행/열을 삭제할지" 결정 로직만 분리해 시트 접근 없이 테스트 가능하게 함.
 *
 * INPUT
 * info : { maxRows, maxCols, lastRow, lastCol, frozenRows, frozenCols }
 *
 * OUTPUT
 * { deleteRowsFrom, rowsToDelete, deleteColsFrom, colsToDelete }
 * (rowsToDelete/colsToDelete가 0이면 그 축은 삭제할 게 없다는 뜻)
 *
 * TEST
 * testComputeSheetTrimPlan_() 참고
 * ==========================================================
 */
function computeSheetTrimPlan_(info){

  const minRows = Math.max(info.lastRow, info.frozenRows, 1);
  const minCols = Math.max(info.lastCol, info.frozenCols, 1);

  const rowsToDelete = info.maxRows > minRows ? info.maxRows - minRows : 0;
  const colsToDelete = info.maxCols > minCols ? info.maxCols - minCols : 0;

  return {
    deleteRowsFrom: minRows + 1,
    rowsToDelete: rowsToDelete,
    deleteColsFrom: minCols + 1,
    colsToDelete: colsToDelete
  };

}


/**
 * ==========================================================
 * TEST — computeSheetTrimPlan_()
 * ==========================================================
 */
function testComputeSheetTrimPlan_(){

  // MTA_Raw 실측 케이스: 123,205행 할당 / 82,715행 사용, 26열 할당 / 22열 사용
  const plan1 = computeSheetTrimPlan_({
    maxRows: 123205, maxCols: 26, lastRow: 82715, lastCol: 22,
    frozenRows: 0, frozenCols: 0
  });

  const pass1 =
    plan1.rowsToDelete === (123205 - 82715) &&
    plan1.deleteRowsFrom === 82716 &&
    plan1.colsToDelete === (26 - 22) &&
    plan1.deleteColsFrom === 23;

  // 완전히 빈 시트(lastRow=0) — 최소 1행/1열은 유지, frozen 행 있으면 그만큼 유지
  const plan2 = computeSheetTrimPlan_({
    maxRows: 1000, maxCols: 26, lastRow: 0, lastCol: 0,
    frozenRows: 2, frozenCols: 0
  });

  const pass2 =
    plan2.rowsToDelete === (1000 - 2) &&
    plan2.deleteRowsFrom === 3 &&
    plan2.colsToDelete === (26 - 1) &&
    plan2.deleteColsFrom === 2;

  // 이미 딱 맞게 할당된 시트 — 삭제할 게 없어야 함
  const plan3 = computeSheetTrimPlan_({
    maxRows: 100, maxCols: 10, lastRow: 100, lastCol: 10,
    frozenRows: 0, frozenCols: 0
  });

  const pass3 = plan3.rowsToDelete === 0 && plan3.colsToDelete === 0;

  const pass = pass1 && pass2 && pass3;

  Logger.log("plan1: " + JSON.stringify(plan1));
  Logger.log("plan2: " + JSON.stringify(plan2));
  Logger.log("plan3: " + JSON.stringify(plan3));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Run Trim All Sheets To Used Range (수동 실행용)
 *
 * WHY
 * 워크북 전체 셀 상한 문제 해결 — 위 파일 헤더 WHY 참고. 시트 하나 처리
 * 중 에러가 나도(예: 보호된 범위 등) 나머지 시트는 계속 진행하도록
 * try/catch로 감쌈. 실행 후 Google Sheets 자체의 버전 기록(파일 > 버전
 * 기록 > 버전 기록 보기)으로 언제든 이전 상태 확인/복원 가능.
 * ==========================================================
 */
function runTrimAllSheetsToUsedRange(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();

  let totalRowsDeleted = 0;
  let totalColsDeleted = 0;
  let sheetsChanged = 0;

  sheets.forEach(function(sheet){

    const sheetName = sheet.getName();

    try {

      const info = {
        maxRows: sheet.getMaxRows(),
        maxCols: sheet.getMaxColumns(),
        lastRow: sheet.getLastRow(),
        lastCol: sheet.getLastColumn(),
        frozenRows: sheet.getFrozenRows(),
        frozenColumns: sheet.getFrozenColumns()
      };

      const plan = computeSheetTrimPlan_({
        maxRows: info.maxRows,
        maxCols: info.maxCols,
        lastRow: info.lastRow,
        lastCol: info.lastCol,
        frozenRows: info.frozenRows,
        frozenCols: info.frozenColumns
      });

      if(plan.rowsToDelete === 0 && plan.colsToDelete === 0){
        Logger.log(sheetName + " — 삭제할 빈 행/열 없음, 건너뜀");
        return;
      }

      if(plan.rowsToDelete > 0){
        sheet.deleteRows(plan.deleteRowsFrom, plan.rowsToDelete);
        totalRowsDeleted += plan.rowsToDelete;
      }

      if(plan.colsToDelete > 0){
        sheet.deleteColumns(plan.deleteColsFrom, plan.colsToDelete);
        totalColsDeleted += plan.colsToDelete;
      }

      sheetsChanged++;

      Logger.log(
        sheetName + " — 행 삭제: " + plan.rowsToDelete +
        " (from " + plan.deleteRowsFrom + "), 열 삭제: " + plan.colsToDelete +
        " (from " + plan.deleteColsFrom + ")"
      );

    } catch(e){

      Logger.log("⚠️ FAILED — " + sheetName + ": " + e.message);

    }

  });

  Logger.log(
    "===== 완료 — " + sheetsChanged + "개 시트 변경, 총 " +
    totalRowsDeleted.toLocaleString() + "행 / " + totalColsDeleted.toLocaleString() + "열 삭제 ====="
  );

  Logger.log("워크북 전체 셀 사용량 재확인은 93_TempQA_DealTrackerMatch.js의 runReportWorkbookCellUsage() 재실행 권장.");

}
