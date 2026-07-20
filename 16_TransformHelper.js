/** 
 * parseDate()

parseDMY()

parseMDY()

parseISO()

getFiscalYear()

getQuarter()

getWeek()

getMonthKey()

getMonthText()

getBusinessSegment()
*/

/**
 * Parse dd/mm/yyyy
 *
 * Example
 * 1/6/2026 -> 1 June 2026
 */
function parseDMY(text) {

  const m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (!m) {
    return null;
  }

  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;

}

/**
 * Parse mm/dd/yyyy
 *
 * Example
 * 1/6/2026 -> January 6 2026
 */
function parseMDY(text) {

  const m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (!m) {
    return null;
  }

  const month = Number(m[1]);
  const day = Number(m[2]);
  const year = Number(m[3]);

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;

}

/**
 * Parse text into Date.
 *
 * Import v2 never relies on JavaScript Date parsing.
 * Every supported format is parsed explicitly.
 *
 * Supported
 * - dd/mm/yyyy
 * - mm/dd/yyyy
 * - yyyy-mm-dd
 * - Date
 *
 * @param {*} value
 * @param {string} format
 *        DMY
 *        MDY
 *        ISO
 * @return {Date|null}
 */
function parseDate(value, format) {

  //----------------------------------------------------------
  // type logger
  //----------------------------------------------------------
  Logger.log("VALUE = " + value);
  Logger.log("TYPE = " + typeof value);
  Logger.log("IS_DATE = " + (value instanceof Date));
  
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  //----------------------------------------------------------
  // Already Date
  //----------------------------------------------------------

  if (value instanceof Date) {
    return isNaN(value.getTime())
    ? null
    : value;
  }

  const text = String(value).trim();

  switch (format) {

    case "DMY":
      return parseDMY(text);

    case "MDY":
      return parseMDY(text);

    case "ISO":
      return parseISO(text);

    default:
      throw new Error(
        "Unsupported date format : " + format
      );

  }

}

/**
 * Parse yyyy-mm-dd
 */
function parseISO(text) {

  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!m) {
    return null;
  }

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;

}

/**
 * Return Fiscal Year.
 *
 * Fiscal Calendar
 * Aug - Dec -> Next FY
 * Jan - Jul -> Current FY
 *
 * Examples
 * 2026-07-31 -> FY26
 * 2026-08-01 -> FY27
 * 2027-01-01 -> FY27
 *
 * @param {Date|null} date
 * @return {string}
 */
function getFiscalYear(date) {

  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  const fiscalYear =
    month >= 8
      ? year + 1
      : year;

  return "FY" + String(fiscalYear).slice(-2);

}

/**
 * Return Fiscal Quarter.
 *
 * Fiscal Calendar
 * Q1 : Aug - Oct
 * Q2 : Nov - Jan
 * Q3 : Feb - Apr
 * Q4 : May - Jul
 *
 * @param {Date|null} date
 * @return {string}
 */
function getQuarter(date) {

  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return "";
  }

  const month = date.getMonth() + 1;

  if (month >= 8 && month <= 10) {
    return "Q1";
  }

  if (month >= 11 || month === 1) {
    return "Q2";
  }

  if (month >= 2 && month <= 4) {
    return "Q3";
  }

  return "Q4";

}

/**
 * Return Fiscal Week.
 *
 * Fiscal Year starts on August 1.
 * Week 1 begins on August 1.
 *
 * Examples
 * 2026-08-01 -> W01
 * 2026-08-07 -> W01
 * 2026-08-08 -> W02
 *
 * @param {Date|null} date
 * @return {string}
 */
function getWeek(date) {

  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return "";
  }

  //----------------------------------------------------------
  // Fiscal Year Start
  //----------------------------------------------------------

  const fiscalStartYear =
    (date.getMonth() + 1 >= 8)
      ? date.getFullYear()
      : date.getFullYear() - 1;

  const fiscalStart = new Date(
    fiscalStartYear,
    7,      // August
    1
  );

  //----------------------------------------------------------
  // Difference
  //----------------------------------------------------------

  const msPerDay = 24 * 60 * 60 * 1000;

  const diffDays = Math.floor(
    (date - fiscalStart) / msPerDay
  );

  const week = Math.floor(diffDays / 7) + 1;

  return "W" + String(week).padStart(2, "0");

}

/**
 * Return Month Key.
 *
 * Examples
 * 2026-01-15 -> 2026-01
 * 2026-11-03 -> 2026-11
 *
 * @param {Date|null} date
 * @return {string}
 */
function getMonthKey(date) {

  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return year + "-" + month;

}

/**
 * Return Month Text.
 *
 * Examples
 * 2026-01-15 -> Jan 26
 * 2026-08-01 -> Aug 26
 *
 * @param {Date|null} date
 * @return {string}
 */
function getMonthText(date) {

  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return "";
  }

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ];

  const month = months[date.getMonth()];
  const year = String(date.getFullYear()).slice(-2);

  return month + " " + year;
}

/**
 * Determine Business Segment.
 *
 * Used by both Leads_Master and MTA_Master.
 *
 * Leads_Master
 *  First MKT UTM Campaign
 *  -> First Touch Detail
 *  -> Lead Source
 *
 * MTA_Master
 *  Last MKT UTM Campaign
 *  -> Lead Source Detail
 *  -> Lead Source
 *
 * @param {string} campaign
 * @param {string} detail
 * @param {string} leadSource
 * @return {string}
 */
function getBusinessSegment(
  campaign,
  detail,
  leadSource
) {

  campaign = String(campaign || "").toLowerCase();
  detail = String(detail || "").toLowerCase();
  leadSource = String(leadSource || "").toLowerCase();

  //----------------------------------------------------------
  // Referral
  //----------------------------------------------------------

  if (leadSource === "referral") {
    return "Referral";
  }

  //----------------------------------------------------------
  // Event Offline
  //----------------------------------------------------------

  if (
    campaign.includes("event-offline") ||
    detail.startsWith("ev-")
  ) {
    return "Event Offline";
  }

  //----------------------------------------------------------
  // Event Online
  //----------------------------------------------------------

  if (
    campaign.includes("event-online") ||
    detail.startsWith("wb-") ||
    detail.includes("zoom webinar")
  ) {
    return "Event Online";
  }

  //----------------------------------------------------------
  // BOFU
  //----------------------------------------------------------

  if (
    detail.includes("bofu")
  ) {
    return "BOFU";
  }

  //----------------------------------------------------------
  // Search
  //----------------------------------------------------------

  if (
    campaign.includes("_contact") ||
    campaign.includes("contact") ||
    campaign.includes("consult") ||
    detail.includes("paid search") ||
    detail.includes("organic search")
  ) {
    return "Search";
  }

  //----------------------------------------------------------
  // Content
  //----------------------------------------------------------

  if (
    campaign.includes("_lead") ||
    campaign.includes("ebook") ||
    campaign.includes("planner") ||
    campaign.includes("guide") ||
    campaign.includes("prospectus") ||
    campaign.includes("booklet") ||
    campaign.includes("curriculum") ||
    campaign.includes("parent ebook")
  ) {
    return "Content";
  }

  //----------------------------------------------------------
  // Other
  //----------------------------------------------------------

  return "Other";

}

/**
 * ==========================================================
 * TEST
 * parseDMY() 정확성 검증
 * ==========================================================
 *
 * 실행 후 Apps Script 편집기 하단 "실행 로그"에서 결과 확인
 */
function testParseDMY_CreateDate(){

  const cases = [

    // [입력값, 기대 Year, 기대 Month(1~12), 기대 Day]
    ["1/6/2026",  2026, 6, 1],   // 6월 1일이어야 함
    ["6/1/2026",  2026, 1, 6],   // 1월 6일이어야 함 (day=6 > 12라 명확)
    ["31/12/2026",2026, 12, 31], // day=31, ambiguous 없음
    ["15/3/2026", 2026, 3, 15]

  ];

  Logger.log("=================================");
  Logger.log("parseDMY() TEST");
  Logger.log("=================================");

  let passCount = 0;

  cases.forEach(function(testCase){

    const input = testCase[0];
    const expectedYear = testCase[1];
    const expectedMonth = testCase[2];
    const expectedDay = testCase[3];

    const result = parseDMY(input);

    if(!result){

      Logger.log(
        "❌ FAIL  input=" + input +
        "  → parseDMY() returned null"
      );

      return;

    }

    const actualYear = result.getFullYear();
    const actualMonth = result.getMonth() + 1; // getMonth()는 0-indexed
    const actualDay = result.getDate();

    const pass =
      actualYear === expectedYear &&
      actualMonth === expectedMonth &&
      actualDay === expectedDay;

    if(pass){
      passCount++;
    }

    Logger.log(
      (pass ? "✅ PASS" : "❌ FAIL") +
      "  input=" + input +
      "  expected=" + expectedYear + "-" + expectedMonth + "-" + expectedDay +
      "  actual=" + actualYear + "-" + actualMonth + "-" + actualDay
    );

  });

  Logger.log("=================================");
  Logger.log(passCount + " / " + cases.length + " passed");
  Logger.log("=================================");

}


/**
 * ==========================================================
 * TEST
 * 실제 Leads_Raw 시트의 Create Date 컬럼을 직접 읽어서
 * parseDMY() 결과를 그대로 로그로 확인
 * ==========================================================
 */
function testParseDMY_FromRawSheet(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS_RAW);

  if(!sheet){
    throw new Error("Leads_Raw sheet not found.");
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0];

  const colIndex = headers.indexOf("Create Date");

  if(colIndex === -1){
    throw new Error("'Create Date' column not found in Leads_Raw.");
  }

  Logger.log("=================================");
  Logger.log("Leads_Raw 'Create Date' → parseDMY() 결과");
  Logger.log("=================================");

  for(let i = 1; i < values.length && i <= 10; i++){ // 상위 10건만

    const rawValue = values[i][colIndex];

    Logger.log(
      "Raw cell value : " + JSON.stringify(rawValue) +
      "  (type=" + typeof rawValue + ")"
    );

    const parsed = parseDMY(String(rawValue).trim());

    if(parsed){

      Logger.log(
        "  → parsed Date : " +
        parsed.getFullYear() + "-" +
        (parsed.getMonth() + 1) + "-" +
        parsed.getDate()
      );

    } else {

      Logger.log("  → parseDMY() returned null (형식 불일치)");

    }

  }

}