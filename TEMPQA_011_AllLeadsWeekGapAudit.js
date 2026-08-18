/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — S&M_REP "All Leads" vs Salesforce 불일치 조사 (2026-08-19)
 *
 * Responsibility
 * S&M_REP의 "All Leads"(2026-08-10~08-16 주, MTA_Master 터치 행 개수)가
 * 732인데 Salesforce "All multi touch attributions" 리포트(같은 주 범위,
 * South Korea 필터 — export 자체가 이미 이 필터로 걸려나오므로 국가 문제는
 * 아님, 사용자 확인)는 579 — 153건 차이. Raw/Master/중복 여부를 단계별로
 * 확인해 어디서 차이가 생기는지 좁힌다. **읽기 전용**.
 *
 * WHY
 * 국가 필터는 배제됐으므로(export가 이미 South Korea만 나옴) 남은 후보는:
 * (1) MTA_Raw 자체에 이 주 범위 행이 CSV 재import 등으로 과다 존재,
 * (2) 완전 동일 중복(findExactDuplicateTouchRows_() 5개 필드 기준)이 실제로는
 * 있는데 아직 삭제가 안 됨, (3) 5개 필드 기준으로는 다르지만 실질적으로 같은
 * 이벤트인 "부분 중복"이 있음(다른 원인, 추가 조사 필요).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-08-19)
 * - 최초 구현.
 * ==========================================================
 */
function runAuditAllLeadsWeekGap(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const weekStart = new Date(2026, 7, 10); // 2026-08-10 (Mon)
  const weekEndExclusive = new Date(2026, 7, 17); // 2026-08-17 00:00 (다음 주 월요일, exclusive)

  //----------------------------------------------------------
  // 1) MTA_Master 기준 — S&M_REP이 실제로 세는 것과 동일 로직
  //----------------------------------------------------------

  const mtaSheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);
  const mtaRecords = mtaSheet ? sheetToObjects(mtaSheet) : [];

  const masterRowsInWeek = mtaRecords.filter(function(r){
    const d = r["MTA Created Date"];
    return d instanceof Date && !isNaN(d.getTime()) && d >= weekStart && d < weekEndExclusive;
  });

  Logger.log("MTA_Master — 이 주(08-10~08-16) 행 수 : " + masterRowsInWeek.length);

  //----------------------------------------------------------
  // 2) MTA_Raw 기준 — Transform 이전, parseDMY로 직접 파싱해서 동일 범위 필터
  //----------------------------------------------------------

  const rawSheet = ss.getSheetByName(CONFIG.SHEETS.MTA_RAW);
  const rawRecords = rawSheet ? sheetToObjects(rawSheet) : [];

  const rawRowsInWeek = rawRecords.filter(function(r){
    const parsed = parseDate(r["Multi Touch Attribution: Created Date"], "DMY");
    return parsed instanceof Date && !isNaN(parsed.getTime()) && parsed >= weekStart && parsed < weekEndExclusive;
  });

  Logger.log("MTA_Raw    — 이 주(08-10~08-16) 행 수 : " + rawRowsInWeek.length);

  //----------------------------------------------------------
  // 3) MTA_Raw 내 완전 동일 중복(5개 필드 기준) 여부 확인
  //----------------------------------------------------------

  const dupGroups = {};

  rawRowsInWeek.forEach(function(r){

    const key = [
      r["Lead: Lead ID"],
      r["Multi Touch Attribution: Created Date"],
      r["MKT UTM Campaign"],
      r["Lead Source"],
      r["Lead Source Detail"]
    ].join("|");

    if(!dupGroups[key]) dupGroups[key] = 0;
    dupGroups[key]++;

  });

  let exactDuplicateExtraRows = 0;
  let dupGroupCount = 0;
  const dupSamples = [];

  Object.keys(dupGroups).forEach(function(key){

    if(dupGroups[key] > 1){
      dupGroupCount++;
      exactDuplicateExtraRows += (dupGroups[key] - 1);
      if(dupSamples.length < 5){
        dupSamples.push(key + " x" + dupGroups[key]);
      }
    }

  });

  Logger.log("");
  Logger.log("완전 동일(5필드) 중복 그룹 수 : " + dupGroupCount);
  Logger.log("그로 인한 초과 행 수(중복분)  : " + exactDuplicateExtraRows);

  if(dupSamples.length > 0){
    Logger.log("샘플:");
    dupSamples.forEach(function(s){ Logger.log("  " + s); });
  }

  //----------------------------------------------------------
  // 4) Lead ID 기준 unique count도 참고로 같이 출력
  //    (혹시 사용자가 "리드 수"와 착각 비교 중인지 확인용 보조 지표)
  //----------------------------------------------------------

  const uniqueLeadIds = {};
  rawRowsInWeek.forEach(function(r){
    const leadId = String(r["Lead: Lead ID"] || "").trim();
    if(leadId) uniqueLeadIds[leadId] = true;
  });

  Logger.log("");
  Logger.log("MTA_Raw 이 주 unique Lead ID 수(참고) : " + Object.keys(uniqueLeadIds).length);
  Logger.log("Salesforce 리포트 값(사용자 보고) : 579");
  Logger.log("S&M_REP All Leads 값(사용자 보고) : 732");

}
