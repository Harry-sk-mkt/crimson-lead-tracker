/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — Marketo_QA 잔여 행의 실제 리드 Email 조회
 *
 * Responsibility
 * `Marketo_QA`(UTIL_004_DictionaryQA.js)에 아직 남아있는 행(Program/UTM)이
 * 실제로 어떤 리드에서 나왔는지 확인하려고, 그 Program/UTM에 매칭되는
 * Leads_Master/MTA_Master 레코드를 찾아 Email을 뽑아 보여준다.
 *
 * WHY
 * 2026-09-04 사용자가 override를 대량으로 채운 뒤 남은 마지막 1행("UTM
 * Campaign"이 비어있는 행 — Program에 매칭되는 UTM이 전혀 없는 케이스,
 * `explodeAnomaliesByUtm_()` 참고)을 판단하려면 그 리드의 실제 Email을
 * 봐야 한다는 요청 — Salesforce에서 직접 확인하기 위한 단서 제공.
 *
 * **읽기 전용** — 아무것도 쓰지 않음.
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-09-04)
 * - 최초 구현.
 * ==========================================================
 */


/**
 * ==========================================================
 * Lookup Marketo QA Remaining Row Emails (수동 실행 진입점, 읽기 전용)
 * ==========================================================
 */
function runLookupMarketoQARemainingRowEmails(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const qaSheet = ss.getSheetByName(CONFIG.MARKETO_QA.SHEET);

  if(!qaSheet){
    Logger.log(CONFIG.MARKETO_QA.SHEET + " 시트를 못 찾음.");
    return;
  }

  const lastRow = qaSheet.getLastRow();

  if(lastRow <= 1){
    Logger.log(CONFIG.MARKETO_QA.SHEET + "에 남은 행 없음.");
    return;
  }

  const headerRow = qaSheet.getRange(1, 1, 1, qaSheet.getLastColumn()).getValues()[0]
    .map(function(h){ return String(h || "").trim(); });

  const programCol = headerRow.indexOf("Marketo Program");
  const utmCol = headerRow.indexOf("UTM Campaign");

  if(programCol === -1){
    Logger.log("\"Marketo Program\" 컬럼을 못 찾음.");
    return;
  }

  const rows = qaSheet.getRange(2, 1, lastRow - 1, qaSheet.getLastColumn()).getValues();

  const leadsRecords = sheetToObjects(ss.getSheetByName(CONFIG.SHEETS.LEADS_MASTER));
  const mtaRecords = sheetToObjects(ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER));

  rows.forEach(function(row){

    const program = String(row[programCol] || "").trim();
    const utm = utmCol > -1 ? String(row[utmCol] || "").trim() : "";

    Logger.log("========== Program=\"" + program + "\" UTM=\"" + (utm || "(없음)") + "\" ==========");

    if(utm){
      logMatchingEmails_("Leads_Master (First MKT UTM Campaign)", leadsRecords, "First MKT UTM Campaign", utm, "Email");
      logMatchingEmails_("MTA_Master (MKT UTM Campaign)", mtaRecords, "MKT UTM Campaign", utm, "Email");
    } else {
      logMatchingEmails_("Leads_Master (First Touch Detail)", leadsRecords, "First Touch Detail", program, "Email");
      logMatchingEmails_("MTA_Master (Lead Source Detail)", mtaRecords, "Lead Source Detail", program, "Email");
    }

  });

}


/**
 * ==========================================================
 * Log Matching Emails (IO 헬퍼, 읽기 전용)
 *
 * WHY
 * Leads_Master/MTA_Master 양쪽에서 동일한 "필드값 일치 → Email 수집" 로직을
 * 재사용 — 대소문자/공백 차이는 무시(트림 + 소문자 비교).
 * ==========================================================
 */
function logMatchingEmails_(label, records, matchField, matchValue, emailField){

  const target = String(matchValue || "").trim().toLowerCase();

  const matches = records.filter(function(r){
    return String(r[matchField] || "").trim().toLowerCase() === target;
  });

  Logger.log(label + " — 매칭 " + matches.length + "건");

  const emails = {};

  matches.forEach(function(r){
    const email = String(r[emailField] || "").trim();
    if(email) emails[email] = (emails[email] || 0) + 1;
  });

  const emailKeys = Object.keys(emails);

  if(emailKeys.length === 0 && matches.length > 0){
    Logger.log("  (매칭은 있으나 Email이 전부 공란)");
  }

  emailKeys.slice(0, 20).forEach(function(email){
    Logger.log("  " + email + " (" + emails[email] + "건)");
  });

  if(emailKeys.length > 20){
    Logger.log("  ... 외 " + (emailKeys.length - 20) + "개 Email 더 있음");
  }

}
