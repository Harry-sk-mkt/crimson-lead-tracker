/**
 * ==========================================================
 * Marketing 2.0
 * Sheet Writer
 *
 * Responsibility
 * Generic sheet writer (overwrite + append 둘 다 제공)
 *
 * Stage
 * 00 Import / 10 Master Build (Shared Component)
 *
 * Version
 * v4.2.0
 *
 * Change Log
 * v4.2.0 (2026-09-02)
 * - appendSheetRecords()에 5번째 optional 파라미터 `targetSpreadsheet` 추가
 *   (생략 시 기존과 동일하게 `CONFIG.SPREADSHEET` 사용 — 기존 4-인자 호출부
 *   전부 영향 없음). SAL을 전용 외부 스프레드시트로 분리(`docs/OpenItems.md`
 *   #38, `MASTER_010_SALSync.js`)하며 `writeSALRaw()`(IMPORT_005_RawWriter.js)가
 *   이 파라미터로 외부 시트에 직접 append할 수 있어야 해서 추가.
 * v4.1.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `05_SheetWriter.js` → 신규 `IMPORT_006_SheetWriter.js`, 코드 내용 변경 없음.
 * v4.1.0 (2026-08-06)
 * - writeSheetRecords()/appendSheetRecords() 둘 다 numberColumns 파라미터 지원
 *   (신규, optional) — 지정 컬럼에 setNumberFormat("0.00") 강제해 숫자값(예: Revenue)이
 *   Google Sheets에 의해 날짜로 자동 오인식되는 것 방지. appendSheetRecords()는
 *   이미 지원 중이었고, writeSheetRecords()에 동일 파라미터를 추가.
 * v4.0.0 (2026-07-21)
 * - Added appendSheetRecords(): 기존 데이터 유지, 뒤에 이어쓰기.
 * - writeSheetRecords()는 기존 그대로 (Full Overwrite, Rebuild 전용).
 * ==========================================================
 */


/**
 * ==========================================================
 * Write Sheet Records (Full Overwrite)
 * ==========================================================
 *
 * @param {string} sheetName
 * @param {Object[]} records
 * @param {string[]} [textColumns]
 * @param {string[]} [numberColumns]
 *
 */
function writeSheetRecords(
  sheetName,
  records,
  textColumns,
  numberColumns
){

  textColumns = textColumns || [];
  numberColumns = numberColumns || [];

  const ss =
    CONFIG.SPREADSHEET;

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

  sheet.clearContents();
  sheet.clearFormats();

  if(records.length === 0){

    Logger.log(

      CONFIG.LOG.PREFIX +
      " " +
      sheetName +
      " : 0 records."

    );

    return;

  }

  const headers =
    Object.keys(
      records[0]
    );

  sheet.getRange(
    CONFIG.ROWS.HEADER,
    1,
    1,
    headers.length
  ).setValues(
    [headers]
  );

  const values =
    records.map(

      record =>

        headers.map(

          header =>

            record[header]

        )

    );

  textColumns.forEach(function(columnName){

    const colIndex =
      headers.indexOf(columnName);

    if(colIndex === -1){
      return;
    }

    sheet.getRange(
      CONFIG.ROWS.DATA_START,
      colIndex + 1,
      values.length,
      1
    ).setNumberFormat("@");

  });

  numberColumns.forEach(function(columnName){

    const colIndex =
      headers.indexOf(columnName);

    if(colIndex === -1){
      return;
    }

    sheet.getRange(
      CONFIG.ROWS.DATA_START,
      colIndex + 1,
      values.length,
      1
    ).setNumberFormat("0.00");

  });

  sheet.getRange(

    CONFIG.ROWS.DATA_START,
    1,
    values.length,
    headers.length

  ).setValues(
    values
  );

  Logger.log(

    CONFIG.LOG.PREFIX +
    " " +
    sheetName +
    " : " +
    values.length +
    " records written (overwrite)." +
    (textColumns.length > 0
      ? " (Text columns: " + textColumns.join(", ") + ")"
      : "")

  );
  
  SpreadsheetApp.flush();  // ← 추가: 쓰기 완료를 강제로 확정, 다음 호출의 getLastRow()가 정확한 값을 읽도록 보장

}


/**
 * ==========================================================
 * Append Sheet Records (기존 데이터 유지)
 * ==========================================================
 *
 * @param {string} sheetName
 * @param {Object[]} records
 * @param {string[]} [textColumns]
 * @param {string[]} [numberColumns]
 * @param {Spreadsheet} [targetSpreadsheet]  생략 시 CONFIG.SPREADSHEET(이
 *   프로젝트 메인 스프레드시트) — 외부 스프레드시트(SpreadsheetApp.openById()
 *   결과)에 append해야 할 때만 명시(SAL_Raw 등, 2026-09-02 추가)
 *
 */
function appendSheetRecords(
  sheetName,
  records,
  textColumns,
  numberColumns,   // ← 신규 파라미터
  targetSpreadsheet   // ← 신규 파라미터 (2026-09-02)
){

  textColumns = textColumns || [];
  numberColumns = numberColumns || [];

  if(records.length === 0){

    Logger.log(

      CONFIG.LOG.PREFIX +
      " " +
      sheetName +
      " : 0 records to append."

    );

    return;

  }

  const ss =
    targetSpreadsheet || CONFIG.SPREADSHEET;

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

  const lastRow =
    sheet.getLastRow();

  let headers;
  let startRow;

  //----------------------------------------------------------
  // Sheet가 완전히 비어있는 경우 (최초 1회) — Header부터 생성
  //----------------------------------------------------------

  if(lastRow === 0){

    headers =
      Object.keys(
        records[0]
      );

    sheet.getRange(
      CONFIG.ROWS.HEADER,
      1,
      1,
      headers.length
    ).setValues(
      [headers]
    );

    startRow =
      CONFIG.ROWS.DATA_START;

  } else {

    headers =
      sheet.getRange(
        CONFIG.ROWS.HEADER,
        1,
        1,
        sheet.getLastColumn()
      ).getValues()[0];

    startRow =
      lastRow + 1;

  }

  //----------------------------------------------------------
  // Plain Text 서식 강제 (새로 추가되는 행 범위만)
  //----------------------------------------------------------

  textColumns.forEach(function(columnName){

    const colIndex =
      headers.indexOf(columnName);

    if(colIndex === -1){
      return;
    }

    sheet.getRange(
      startRow,
      colIndex + 1,
      records.length,
      1
    ).setNumberFormat("@");

  });

  //----------------------------------------------------------
  // 숫자 서식 강제 (신규 — 날짜로 자동 오인식되는 것 방지)
  //----------------------------------------------------------

  numberColumns.forEach(function(columnName){

    const colIndex = headers.indexOf(columnName);
    if(colIndex === -1) return;

    sheet.getRange(startRow, colIndex + 1, records.length, 1)
      .setNumberFormat("0.00");

  });

  //----------------------------------------------------------
  // 값 쓰기
  //----------------------------------------------------------

  const values =
    records.map(

      record =>

        headers.map(

          header =>

            record[header] !== undefined
              ? record[header]
              : ""

        )

    );

  sheet.getRange(

    startRow,
    1,
    values.length,
    headers.length

  ).setValues(
    values
  );

  Logger.log(

    CONFIG.LOG.PREFIX +
    " " +
    sheetName +
    " : " +
    values.length +
    " records appended (rows " +
    startRow +
    "-" +
    (startRow + values.length - 1) +
    ")." +
    (textColumns.length > 0
      ? " (Text columns: " + textColumns.join(", ") + ")"
      : "")

  );

  SpreadsheetApp.flush();  // ← 추가: 쓰기 완료를 강제로 확정, 다음 호출의 getLastRow()가 정확한 값을 읽도록 보장

}