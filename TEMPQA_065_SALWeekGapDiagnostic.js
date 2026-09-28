/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — 주간 SAL 갭 진단 (S&M_REP All SAL 3 vs Salesforce 29, 2026-09-28)
 *
 * Responsibility
 * S&M_REP 2026-09-21~27 주 All SAL이 3으로 나오는데 Salesforce SAL
 * 리포트 기준은 29 — S&M/ACQ SAL은 둘 다 Leads_OPS "Sales Accepted Date"
 * (computeOPSAggregates_())라, SAL_Raw → Leads_OPS 경로 어느 단계에서
 * 새는지 단계별 건수로 좁힌다:
 *   A. SAL_Raw에서 SAL 날짜가 이 주인 행 / 고유 Lead ID
 *   B. 그 Lead ID의 SAL_Raw 최신 레코드(sync가 실제 쓰는 값)도 이 주인지
 *   C. Leads_OPS에 그 Lead ID 행이 있는지
 *   D. Leads_OPS "Sales Accepted Date"가 이 주로 들어가 있는지
 * 함께 Leads_OPS 전체 Sales Accepted Date 건수도 찍어 #52(대량 유실)
 * 재발 여부를 같이 본다(TEMPQA_061과 동일 기준값 8,177).
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 *
 * INPUT: 없음 (SAL_Raw 외부 시트 + Leads_OPS 직접 읽기)
 * OUTPUT: Logger.log만
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
function runDiagnoseSALWeekGap(){

  // 조사 대상 주(월~일) — S&M_REP Week Start 2026-09-21
  const weekStart = new Date(2026, 8, 21);
  const weekEndExclusive = new Date(2026, 8, 28);

  function isValidDate(v){
    return v instanceof Date && !isNaN(v.getTime());
  }

  function inWeek(d){
    return isValidDate(d) && d >= weekStart && d < weekEndExclusive;
  }

  function fmt(d){
    return isValidDate(d)
      ? Utilities.formatDate(d, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd HH:mm")
      : String(d);
  }

  const cols = CONFIG.SAL.COLUMNS;

  //----------------------------------------------------------
  // SAL_Raw 전체 읽기
  //----------------------------------------------------------

  const rawAll = readRawSheetFrom_(CONFIG.SAL.SHEET, 0, openSALExternalSpreadsheet_());

  const weekLeadIds = {};
  let weekRawRows = 0;
  let unparsedInRaw = 0;

  rawAll.forEach(function(record){
    const d = parseDate(record[cols.SALES_ACCEPTED_DATE], "DMY");
    if(!isValidDate(d) && record[cols.SALES_ACCEPTED_DATE]) unparsedInRaw++;
    if(!inWeek(d)) return;
    weekRawRows++;
    const leadId = String(record[cols.LEAD_ID] || "").trim();
    if(leadId) weekLeadIds[leadId] = true;
  });

  const latestByLeadId = pickLatestSALRecords_(rawAll);
  const salByLeadId = computeSALByLeadId_(latestByLeadId);

  //----------------------------------------------------------
  // Leads_OPS — Lead ID / Sales Accepted Date 2개 컬럼만
  //----------------------------------------------------------

  const opsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(OPS.SHEET.OPS);
  const headerMap = getHeaderMap(opsSheet);
  const lastRow = opsSheet.getLastRow();
  const numRows = lastRow - OPS.ROWS.DATA_START + 1;

  const opsLeadIds = opsSheet.getRange(OPS.ROWS.DATA_START, headerMap["Lead ID"] + 1, numRows, 1).getValues();
  const opsSalDates = opsSheet.getRange(OPS.ROWS.DATA_START, headerMap["Sales Accepted Date"] + 1, numRows, 1).getValues();

  const opsSalByLeadId = {};
  let opsSalTotal = 0;
  let opsSalInWeek = 0;

  opsLeadIds.forEach(function(row, i){
    const d = opsSalDates[i][0];
    if(isValidDate(d)) opsSalTotal++;
    if(inWeek(d)) opsSalInWeek++;
    const leadId = String(row[0] || "").trim();
    if(leadId) opsSalByLeadId[leadId] = d;
  });

  //----------------------------------------------------------
  // 단계별 분류
  //----------------------------------------------------------

  const latestNotInWeek = [];
  const notInOPS = [];
  const opsDateMismatch = [];
  const ok = [];

  Object.keys(weekLeadIds).forEach(function(leadId){
    const latestDate = salByLeadId[leadId].salesAcceptedDate;
    if(!inWeek(latestDate)){
      latestNotInWeek.push(leadId + " (최신 Raw 날짜 " + fmt(latestDate) + ")");
      return;
    }
    if(!(leadId in opsSalByLeadId)){
      notInOPS.push(leadId);
      return;
    }
    if(!inWeek(opsSalByLeadId[leadId])){
      opsDateMismatch.push(leadId + " (OPS 값 " + fmt(opsSalByLeadId[leadId]) + ", Raw " + fmt(latestDate) + ")");
      return;
    }
    ok.push(leadId);
  });

  Logger.log("========== SAL 주간 갭 진단 (" + fmt(weekStart) + " ~ 2026-09-27) ==========");
  Logger.log("[#52 체크] Leads_OPS Sales Accepted Date 전체 : " + opsSalTotal + " (2026-09-15 기준값 8,177)");
  Logger.log("SAL_Raw 전체 행 : " + rawAll.length + " / SAL 날짜 파싱 실패(값은 있음) : " + unparsedInRaw);
  Logger.log("A. SAL_Raw 이 주 행 : " + weekRawRows + " / 고유 Lead ID : " + Object.keys(weekLeadIds).length);
  Logger.log("B. 최신 Raw 레코드 날짜가 이 주 밖 : " + latestNotInWeek.length);
  Logger.log("C. Leads_OPS에 Lead ID 없음 : " + notInOPS.length);
  Logger.log("D. OPS에 있으나 Sales Accepted Date가 이 주 아님 : " + opsDateMismatch.length);
  Logger.log("정상 반영 : " + ok.length);
  Logger.log("(참고) Leads_OPS에서 Sales Accepted Date가 이 주인 행 : " + opsSalInWeek + " — S&M All SAL과 같아야 함");
  Logger.log("--- B 목록 ---\n" + latestNotInWeek.join("\n"));
  Logger.log("--- C 목록 ---\n" + notInOPS.join("\n"));
  Logger.log("--- D 목록 ---\n" + opsDateMismatch.join("\n"));

}
