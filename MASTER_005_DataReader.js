/**
 * ==========================================================
 * Marketing 2.0
 * Data Reader
 *
 * Responsibility
 * Read Raw tables into JavaScript objects.
 *
 * Stage
 * 10 Master Build
 *
 * Version
 * v2.2.0
 *
 * Change Log
 * v2.2.0 (2026-09-03)
 * - **Master_DB Raw 이관 2단계(사용자 확정, `docs/exec-plans/active/
 *   2026-09-03-master-db-raw-migration.md`)**: `readRawSheet()`/
 *   `getRawSheetDataRowCount_()`/`readRawSheetFrom_()`에 5번째(또는 3번째)
 *   optional 파라미터 `targetSpreadsheet` 추가(생략 시 기존과 동일하게
 *   `SpreadsheetApp.getActiveSpreadsheet()` 사용 — 기존 호출부 전부 무변경).
 *   `openLeadsRawExternalSpreadsheet_()`/`openMTARawExternalSpreadsheet_()`
 *   신규(`openSALExternalSpreadsheet_()`(MASTER_010_SALSync.js)와 동일 패턴,
 *   SPREADSHEET_ID 비어있으면 명시 에러) — `readLeadRaw()`/`readMTARaw()`가
 *   이제 각자의 external opener로 연 Leads_Raw/MTA_Raw 전용 스프레드시트를
 *   읽는다(마이그레이션 완료·검증됨, 위 exec-plan 참고).
 * v2.1.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `11_DataReader.js` → 신규 `MASTER_005_DataReader.js`, 코드 내용 변경 없음.
 * v2.1.0 (2026-08-05)
 * - **성능 개선(docs/OpenItems.md #18)**: 신규 `getRawSheetDataRowCount_()`(전체
 *   행 수만 `getLastRow()`로 확인, 셀 값 안 읽음) + `computeRawReadRange_()`(순수
 *   함수) + `readRawSheetFrom_()`(targeted `getRange()` 읽기) 추가 — Raw는 원본
 *   보존 원칙상 절대 안 지워져서(겹치는 기간 재import마다 계속 누적) 시간이
 *   지날수록 `readRawSheet()`(전체 스캔)가 점점 느려지는 구조적 문제를 해결.
 *   `07_IncrementalMasterBuild.js`의 `appendNewLeads()`/`appendNewMTA()`가 이제
 *   이 함수들을 사용 — 새로 추가된 행 수에만 비례해 처리 시간이 걸림.
 *   `readLeadRaw()`/`readMTARaw()`(전체 스캔, `rebuildLeadsMaster()`/
 *   `rebuildMTAMaster()`/`24_OPSQA.js` 진단용)는 변경 없음.
 * v2.0.0 (2026-07-20)
 * - New Data Reader layer.
 * - Separated Raw reading from Master Build.
 * - Returns object arrays from Raw sheets.
 * ==========================================================
 */


/**
 * ==========================================================
 * Open Leads Raw External Spreadsheet (IO 래퍼)
 *
 * WHY
 * `openSALExternalSpreadsheet_()`(MASTER_010_SALSync.js)와 동일 원칙 —
 * CONFIG.RAW_EXTERNAL.LEADS.SPREADSHEET_ID가 비어있으면 추측으로 진행하지
 * 않고 명시적 에러로 실패한다("No Assumptions" 원칙).
 * ==========================================================
 */
function openLeadsRawExternalSpreadsheet_(){

  const spreadsheetId = CONFIG.RAW_EXTERNAL.LEADS.SPREADSHEET_ID;

  if(!spreadsheetId){
    throw new Error(
      "CONFIG.RAW_EXTERNAL.LEADS.SPREADSHEET_ID가 비어있습니다 — 외부 " +
      "스프레드시트 ID를 CORE_001_Config.js에 채워넣어야 합니다."
    );
  }

  return SpreadsheetApp.openById(spreadsheetId);

}


/**
 * ==========================================================
 * Open MTA Raw External Spreadsheet (IO 래퍼)
 * ==========================================================
 */
function openMTARawExternalSpreadsheet_(){

  const spreadsheetId = CONFIG.RAW_EXTERNAL.MTA.SPREADSHEET_ID;

  if(!spreadsheetId){
    throw new Error(
      "CONFIG.RAW_EXTERNAL.MTA.SPREADSHEET_ID가 비어있습니다 — 외부 " +
      "스프레드시트 ID를 CORE_001_Config.js에 채워넣어야 합니다."
    );
  }

  return SpreadsheetApp.openById(spreadsheetId);

}


/**
 * ==========================================================
 * Read Lead Raw (전용 외부 스프레드시트, 2026-09-03부터)
 * ==========================================================
 */
function readLeadRaw(){

  return readRawSheet(
    CONFIG.SHEETS.LEADS_RAW,
    openLeadsRawExternalSpreadsheet_()
  );

}


/**
 * ==========================================================
 * Read MTA Raw (전용 외부 스프레드시트, 2026-09-03부터)
 * ==========================================================
 */
function readMTARaw(){

  return readRawSheet(
    CONFIG.SHEETS.MTA_RAW,
    openMTARawExternalSpreadsheet_()
  );

}


/**
 * ==========================================================
 * Generic Raw Reader
 * ==========================================================
 *
 * @param {string} sheetName
 * @param {Spreadsheet} [targetSpreadsheet]  생략 시 CONFIG.SPREADSHEET(메인
 *   스프레드시트) — 외부 스프레드시트에서 읽어야 할 때만 명시(Leads_Raw/
 *   MTA_Raw 등, 2026-09-03 추가)
 * @returns {Object[]}
 *
 */
function readRawSheet(
  sheetName,
  targetSpreadsheet
){

  const ss =
    targetSpreadsheet || SpreadsheetApp.getActiveSpreadsheet();

  const sheet =
    ss.getSheetByName(
      sheetName
    );

  if(!sheet){

    throw new Error(

      "Sheet not found : " +
      sheetName

    );

  }

  const values =
    sheet.getDataRange().getValues();

  if(values.length <= 1){

    return [];

  }

  const headers =
    values[0];

  const records =
    [];

  for(
    let i = 1;
    i < values.length;
    i++
  ){

    const row =
      values[i];

    const record =
      {};

    for(
      let j = 0;
      j < headers.length;
      j++
    ){

      record[
        headers[j]
      ] = row[j];

    }

    records.push(
      record
    );

  }

  Logger.log(

    sheetName +
    " : " +
    records.length +
    " records read."

  );

  return records;

}


/**
 * ==========================================================
 * Get Raw Sheet Data Row Count (IO 래퍼)
 *
 * WHY (2026-08-05, 성능 개선 — docs/OpenItems.md #18)
 * `appendNewLeads()`/`appendNewMTA()`가 "새로 추가된 행이 몇 개인지"만 알면
 * 되는데, 기존엔 `readRawSheet()`로 Raw 전체를 매번 읽어와서 길이를 쟀음 —
 * Raw는 원본 보존 원칙상 절대 안 지워져서(겹치는 기간 재import 시마다 계속
 * 누적), 시간이 지날수록 이 전체 읽기 자체가 점점 느려지는 구조적 문제가
 * 있었음(실측 전, 사용자 질문으로 발견 — Import할 때마다 실제 신규 건수와
 * 무관하게 Raw 전체 크기에 비례해 느려짐). `getLastRow()`는 셀 값을 읽지
 * 않는 메타데이터 호출이라 매우 빠름 — 이 값만으로 총 행 수를 구한다.
 * ==========================================================
 */
function getRawSheetDataRowCount_(sheetName, targetSpreadsheet){

  const ss = targetSpreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if(!sheet){
    throw new Error("Sheet not found : " + sheetName);
  }

  return Math.max(0, sheet.getLastRow() - 1);

}


/**
 * ==========================================================
 * Compute Raw Read Range (순수 함수)
 *
 * WHY
 * "0-based 처리 시작 인덱스 + 전체 데이터 행 수"를 시트 좌표(1-based, 헤더
 * 행 제외 데이터는 2행부터 시작)로 변환하는 부분만 순수 로직으로 분리해
 * 테스트 가능하게 함 — Sheet IO(readRawSheetFrom_())와 분리.
 *
 * INPUT
 * startIndex : number  마지막으로 처리된 행 수(0-based, 이 행부터 새 데이터)
 * totalDataRows : number  헤더 제외 전체 데이터 행 수
 *
 * OUTPUT
 * { startRow: number, numRows: number } | null  (읽을 새 행이 없으면 null)
 *
 * TEST
 * testComputeRawReadRange() 참고
 * ==========================================================
 */
function computeRawReadRange_(startIndex, totalDataRows){

  if(startIndex >= totalDataRows){
    return null;
  }

  return {
    startRow: startIndex + 2,           // 데이터 1행 = 시트 2행(헤더가 1행)
    numRows: totalDataRows - startIndex
  };

}


/**
 * ==========================================================
 * TEST — computeRawReadRange_()
 * ==========================================================
 */
function testComputeRawReadRange(){

  const fromStart = computeRawReadRange_(0, 5);
  const fromStartOk = fromStart.startRow === 2 && fromStart.numRows === 5;

  const fromMiddle = computeRawReadRange_(3, 5);
  const fromMiddleOk = fromMiddle.startRow === 5 && fromMiddle.numRows === 2;

  const nothingNew = computeRawReadRange_(5, 5);
  const nothingNewOk = nothingNew === null;

  const overProcessed = computeRawReadRange_(10, 5); // 방어적 케이스 — 발생하면 안 되지만 안전하게 null
  const overProcessedOk = overProcessed === null;

  const pass = fromStartOk && fromMiddleOk && nothingNewOk && overProcessedOk;

  Logger.log(
    "testComputeRawReadRange: " + (pass ? "PASS" : "FAIL") +
    " (fromStart=" + JSON.stringify(fromStart) +
    ", fromMiddle=" + JSON.stringify(fromMiddle) +
    ", nothingNew=" + JSON.stringify(nothingNew) +
    ", overProcessed=" + JSON.stringify(overProcessed) + ")"
  );

}


/**
 * ==========================================================
 * Read Raw Sheet From (IO 래퍼) — targeted read
 *
 * WHY
 * `readRawSheet()`(전체 스캔)를 대체 — `appendNewLeads()`/`appendNewMTA()`처럼
 * "이미 처리된 행 이후"만 필요한 호출부용. `getRange()`로 필요한 행만
 * 읽어와 Raw 전체 크기와 무관하게 "신규 행 수"에만 비례하는 시간이 걸리게
 * 한다. `rebuildLeadsMaster()`/`rebuildMTAMaster()`(10_MasterBuild.js)처럼
 * 전체 재구축이 필요한 호출부는 계속 `readLeadRaw()`/`readMTARaw()`(전체
 * 스캔)를 그대로 사용 — 여긴 바꾸지 않음.
 *
 * INPUT
 * sheetName : string
 * startIndex : number  0-based, 이 인덱스부터 끝까지 읽음
 *
 * OUTPUT
 * Object[]  (헤더 매핑된 레코드 배열, 읽을 게 없으면 빈 배열)
 * ==========================================================
 */
function readRawSheetFrom_(sheetName, startIndex, targetSpreadsheet){

  const ss = targetSpreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if(!sheet){
    throw new Error("Sheet not found : " + sheetName);
  }

  const totalDataRows = Math.max(0, sheet.getLastRow() - 1);
  const range = computeRawReadRange_(startIndex, totalDataRows);

  if(!range){
    return [];
  }

  const numCols = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, numCols).getValues()[0];
  const values = sheet.getRange(range.startRow, 1, range.numRows, numCols).getValues();

  const records = [];

  for(let i = 0; i < values.length; i++){

    const row = values[i];
    const record = {};

    for(let j = 0; j < headers.length; j++){
      record[headers[j]] = row[j];
    }

    records.push(record);

  }

  Logger.log(
    sheetName + " : " + records.length +
    " new records read (targeted, sheet row " + range.startRow + "부터)."
  );

  return records;

}