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
 * v4.0.0
 *
 * Change Log
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
 *
 */
function writeSheetRecords(
  sheetName,
  records,
  textColumns
){

  textColumns = textColumns || [];

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
 *
 */
function appendSheetRecords(
  sheetName,
  records,
  textColumns
){

  textColumns = textColumns || [];

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