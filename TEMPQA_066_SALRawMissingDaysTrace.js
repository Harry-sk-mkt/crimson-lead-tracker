/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — SAL_Raw 9/21~23 누락 추적 (2026-09-28)
 *
 * Responsibility
 * Salesforce SAL 리포트(09-21~27) 29건 중 SAL_Raw에 없는 19건이 정확히
 * SAL 날짜 9/21~23인 리드들 — (1) 이 19개 Lead ID가 SAL_Raw 어디에든
 * (다른 날짜로라도) 있는지, (2) SAL_Raw 끝부분 행들의 날짜 흐름(Import
 * 배치 경계)이 어떻게 생겼는지 찍어 "해당 날짜 구간이 Import 자체에서
 * 빠졌는지"를 확인한다.
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 조사 스크립트(TEMPQA 관례).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-09-28)
 * - 최초 구현.
 * ==========================================================
 */
function runTraceSALRawMissingDays(){

  const missingLeadIds = [
    "00QRC00000ETYhN",
    "00QRC00000LCv3G",
    "00QRC000012oCHF",
    "00QRC000013JcP7",
    "00QRC00001NUcgP",
    "00QRC00001PSJSD",
    "00QRC00001PnXvC",
    "00QRC00001Poi8c",
    "00QRC00001PpB7N",
    "00QRC00001PpDig",
    "00QRC00001PqOgr",
    "00QRC00001PqQh3",
    "00QRC00001PsvnB",
    "00QRC00001PvgI9",
    "00QRC00001Pw4p7",
    "00QRC00001PzQ9x",
    "00QRC00001Q0pSt",
    "00QRC00001Q1Iug",
    "00QRC00001Q1vw1"
  ];

  const cols = CONFIG.SAL.COLUMNS;
  const sheet = openSALExternalSpreadsheet_().getSheetByName(CONFIG.SAL.SHEET);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const idIdx = headers.indexOf(cols.LEAD_ID);
  const dateIdx = headers.indexOf(cols.SALES_ACCEPTED_DATE);
  const statusIdx = headers.indexOf(cols.LEAD_STATUS);

  function show(v){
    return v instanceof Date
      ? "[Date] " + Utilities.formatDate(v, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd HH:mm")
      : "[" + typeof v + "] " + String(v);
  }

  Logger.log("SAL_Raw 헤더 : " + JSON.stringify(headers));
  Logger.log("SAL_Raw 데이터 행 : " + values.length + " / SAL_LAST_PROCESSED_ROW : " +
    PropertiesService.getScriptProperties().getProperty(CONFIG.PROPERTIES.SAL_LAST_ROW));

  // (1) 누락 19건이 SAL_Raw 어디에든 있는지
  const hits = {};
  values.forEach(function(row, i){
    const leadId = String(row[idIdx] || "").trim();
    if(missingLeadIds.indexOf(leadId) === -1) return;
    (hits[leadId] = hits[leadId] || []).push(
      "row " + (i + 2) + " : " + show(row[dateIdx]) + " / " + row[statusIdx]
    );
  });

  Logger.log("---------- (1) 9/21~23 누락 " + missingLeadIds.length + "건의 SAL_Raw 존재 여부 ----------");
  missingLeadIds.forEach(function(leadId){
    Logger.log(leadId + " : " + (hits[leadId] ? hits[leadId].join(" | ") : "없음"));
  });

  // (2) 끝 80행 날짜 흐름 — Import 배치 경계 확인
  Logger.log("---------- (2) SAL_Raw 마지막 80행 ----------");
  const from = Math.max(0, values.length - 80);
  const lines = [];
  for(let i = from; i < values.length; i++){
    lines.push("row " + (i + 2) + " : " + values[i][idIdx] + " / " + show(values[i][dateIdx]));
  }
  Logger.log(lines.join("\n"));

}
