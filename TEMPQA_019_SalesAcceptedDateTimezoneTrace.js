/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — 잔여 8건 Sales Accepted Date, Timezone 오해석 가설 검증
 * (docs/OpenItems.md #26 후속)
 *
 * Responsibility
 * TEMPQA_013/018로 확인된 잔여 8건(day>=28 월말 패턴)이 day/month swap
 * 만으로는 설명 안 되던 이유를, 사용자가 Salesforce Field History에서
 * 직접 확인한 두 건(ppm1xxx@gmail.com, yunjiseong955@gmail.com — 둘 다
 * 원본이 "12/1/2026, 오전 8시대"인데 현재 시트엔 월말 날짜로 남아있음)을
 * 근거로 재검토한다. 가설: 원본이 day-first("12/1/2026"=1월 12일)인데
 * Google Sheets가 month-first(12월 1일)로 오해석(기존에 알려진 swap
 * 버그, docs/DateParsing.md)한 뒤, **그 시각(오전 8~9시대)이 스프레드시트
 * 표시 타임존과 스크립트 실행 타임존(America/New_York, appsscript.json)
 * 사이의 큰 시차(한국 기준 최대 13~14시간) 때문에 하루 앞으로 밀려**
 * "12월 1일"이 "11월 30일"로 한 번 더 밀렸다면 — day가 12 초과로 넘어가
 * TEMPQA_008의 day<=12 스캔 조건을 벗어나 복구 대상에서 누락된 것이
 * 설명됨. 이 스크립트는 그 가설을 검증하기 위해 8건의 MTA_Raw/MTA_Master/
 * Leads_OPS 값을 여러 타임존 관점에서 덤프한다. **읽기 전용** — 아무것도
 * 쓰지 않음(TEMPQA_013/018과 동일 관례).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-08-20)
 * - 최초 구현.
 * ==========================================================
 */

const SAL_RESIDUAL8_LEAD_IDS = [
  "00QRC00000tsLnl",
  "00QRC00000trIOy",
  "00QRC00000trFxL",
  "00QRC00000tnGLi",
  "00QRC00000ti6Vc",
  "00QRC00000tb8LW",
  "00QRC00000shbd7",
  "00QRC00000bzYNf"
];


function runTraceSalesAcceptedDateTimezone(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  Logger.log("========== Timezone 설정 ==========");
  Logger.log("Spreadsheet Timezone = " + ss.getSpreadsheetTimeZone());
  Logger.log("Script Timezone = " + Session.getScriptTimeZone());
  Logger.log("CONFIG.DATE.TIMEZONE = " + CONFIG.DATE.TIMEZONE);
  Logger.log("CONFIG.DATE.DISPLAY_TIMEZONE = " + CONFIG.DATE.DISPLAY_TIMEZONE);

  const zonesToShow = [
    "UTC",
    "Asia/Seoul",
    "America/New_York",
    ss.getSpreadsheetTimeZone()
  ];

  function dumpDateInZones(label, value){

    if(!(value instanceof Date) || isNaN(value.getTime())){
      Logger.log("  " + label + " = " + value + " (Date 아님)");
      return;
    }

    const parts = zonesToShow.map(function(tz){
      return tz + "=" + Utilities.formatDate(value, tz, "yyyy-MM-dd HH:mm:ss");
    });

    Logger.log("  " + label + " (epoch=" + value.getTime() + ") — " + parts.join(" / "));

  }

  //----------------------------------------------------------
  // MTA_Raw — 원본 컬럼명 기준 (Sales Accepted Date + 대조용 MTA Created Date)
  //----------------------------------------------------------

  const rawSheet = ss.getSheetByName(CONFIG.SHEETS.MTA_RAW);
  const rawRecords = rawSheet ? sheetToObjects(rawSheet) : [];

  Logger.log("");
  Logger.log("========== MTA_Raw ==========");

  SAL_RESIDUAL8_LEAD_IDS.forEach(function(leadId){

    const rows = rawRecords.filter(function(r){
      return String(r["Lead: Lead ID"] || "").trim() === leadId;
    });

    Logger.log("Lead ID " + leadId + " — MTA_Raw 터치 " + rows.length + "건");

    rows.forEach(function(r, i){

      const rawValue = r["Lead: Sales Accepted Date"];

      Logger.log(
        " [" + i + "] typeof=" + (rawValue instanceof Date ? "Date" : typeof rawValue) +
        " / raw literal=" + rawValue
      );

      dumpDateInZones("Sales Accepted Date", rawValue);

    });

  });

  //----------------------------------------------------------
  // MTA_Master — 대표 터치(latest) 기준
  //----------------------------------------------------------

  const mtaSheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);
  const mtaRecords = mtaSheet ? sheetToObjects(mtaSheet) : [];
  const funnelByLeadId = computeMTAFunnelByLeadId_(mtaRecords);

  Logger.log("");
  Logger.log("========== MTA_Master (대표 터치 기준) ==========");

  SAL_RESIDUAL8_LEAD_IDS.forEach(function(leadId){

    const funnel = funnelByLeadId[leadId];
    const salDate = funnel ? funnel.salesAcceptedDate : undefined;

    Logger.log("Lead ID " + leadId);
    dumpDateInZones("Sales Accepted Date", salDate);

  });

  //----------------------------------------------------------
  // Leads_OPS — 현재 동기화된 값 + Email(Salesforce 대조용)
  //----------------------------------------------------------

  const opsSheet = ss.getSheetByName(OPS.SHEET.OPS);
  const opsRecords = opsSheet ? sheetToObjects(opsSheet) : [];

  Logger.log("");
  Logger.log("========== Leads_OPS ==========");

  SAL_RESIDUAL8_LEAD_IDS.forEach(function(leadId){

    const row = opsRecords.filter(function(r){
      return String(r["Lead ID"] || "").trim() === leadId;
    })[0];

    if(!row){
      Logger.log("Lead ID " + leadId + " — Leads_OPS에 없음");
      return;
    }

    Logger.log("Lead ID " + leadId + " / Email=" + row["Email"]);
    dumpDateInZones("Sales Accepted Date", row["Sales Accepted Date"]);

  });

}
