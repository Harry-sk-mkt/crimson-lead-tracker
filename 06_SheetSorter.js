/**
 * ==========================================================
 * Marketing 2.0
 * Sheet Sorter
 *
 * Responsibility
 * 지정된 Date 컬럼 기준 내림차순 정렬 (최신이 맨 위)
 *
 * Stage
 * 10 Master Build (Shared Component)
 *
 * Version
 * v1.0.0
 * ==========================================================
 */


/**
 * ==========================================================
 * Sort Sheet By Date Column (Descending)
 * ==========================================================
 *
 * @param {string} sheetName
 * @param {string} dateColumnName
 *
 */
function sortSheetByDate(
  sheetName,
  dateColumnName
){

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

  const lastCol =
    sheet.getLastColumn();

  if(lastRow <= CONFIG.ROWS.HEADER){

    Logger.log(

      CONFIG.LOG.PREFIX +
      " " +
      sheetName +
      " : sort skipped (no data)."

    );

    return;

  }

  const headers =
    sheet.getRange(
      CONFIG.ROWS.HEADER,
      1,
      1,
      lastCol
    ).getValues()[0];

  const colIndex =
    headers.indexOf(
      dateColumnName
    );

  if(colIndex === -1){

    throw new Error(

      "Sort column not found : " +
      dateColumnName +
      " in " +
      sheetName

    );

  }

  sheet.getRange(

    CONFIG.ROWS.DATA_START,
    1,
    lastRow - CONFIG.ROWS.HEADER,
    lastCol

  ).sort({

    column: colIndex + 1,
    ascending: false   // 최신이 맨 위

  });

  Logger.log(

    CONFIG.LOG.PREFIX +
    " " +
    sheetName +
    " : sorted by '" +
    dateColumnName +
    "' (descending)."

  );

}