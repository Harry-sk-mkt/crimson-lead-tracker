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

/**
 * ==========================================================
 * Parse Date (범용 진입점)
 *
 * Change Log
 * v1.3.0 (2026-07-21)
 * - 시간이 포함된 값("19/2/2024, 5:21 pm")에서 콤마 이후 시간
 *   부분을 잘라내고 날짜만 파싱하도록 전처리 추가.
 *   (MTA CSV의 IC Booked/Completed/Won Date 필드에서 발견됨 —
 *   기존엔 시간 부분 때문에 파싱 실패 → null 반환되고 있었음)
 * ==========================================================
 */
function parseDate(value, format) {

  if (value instanceof Date) {
    Logger.log(
      "[parseDate] IS_DATE = true (이미 Date 객체) : VALUE = " + value
    );
  }

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (value instanceof Date) {
    return isNaN(value.getTime())
    ? null
    : value;
  }

  //----------------------------------------------------------
  // 콤마 이후 시간 부분 제거 (날짜만 사용)
  // 예: "19/2/2024, 5:21 pm" → "19/2/2024"
  //----------------------------------------------------------

  const rawText = String(value).trim();
  const text = rawText.split(",")[0].trim();

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
 * ==========================================================
 * TEST — parseDate() 시간 포함 값 처리
 * ==========================================================
 */
function testParseDateWithTime(){

  const result = parseDate("19/2/2024, 5:21 pm", "DMY");

  const pass =
    result instanceof Date &&
    result.getFullYear() === 2024 &&
    result.getMonth() === 1 &&   // 2월 (0-indexed)
    result.getDate() === 19;

  Logger.log(
    "Result : " + result +
    " (expected 2024-02-19)"
  );

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

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
 * Change Log
 * 2026-07-22
 * - "Event Offline" -> "Seminar", "Event Online" -> "Webinar"로 리네이밍
 *   (실무에서 부르는 명칭과 통일. 분류 조건/우선순위는 변경 없음).
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
  // Seminar (구 "Event Offline")
  //----------------------------------------------------------

  if (
    campaign.includes("event-offline") ||
    detail.startsWith("ev-")
  ) {
    return "Seminar";
  }

  //----------------------------------------------------------
  // Webinar (구 "Event Online")
  //----------------------------------------------------------

  if (
    campaign.includes("event-online") ||
    detail.startsWith("wb-") ||
    detail.includes("zoom webinar")
  ) {
    return "Webinar";
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
 * TEST — getBusinessSegment() 리네이밍 검증
 *
 * WHY
 * "Event Offline"/"Event Online" -> "Seminar"/"Webinar" 리네이밍 후에도
 * 기존 분류 조건(campaign/detail 패턴)이 그대로 동작하는지 확인.
 * ==========================================================
 */
function testGetBusinessSegmentRenamed(){

  const cases = [
    // [campaign, detail, leadSource, expected]
    ["spring-event-offline-2026", "", "", "Seminar"],
    ["", "EV-Spring26", "", "Seminar"],
    ["fall-event-online-2026", "", "", "Webinar"],
    ["", "WB-Fall26", "", "Webinar"],
    ["", "Zoom Webinar Series", "", "Webinar"],
    ["", "BOFU-Consult", "", "BOFU"],
    ["", "", "Referral", "Referral"],
    ["random-campaign", "", "", "Other"]
  ];

  let pass = true;

  cases.forEach(function(c){

    const result = getBusinessSegment(c[0], c[1], c[2]);
    const ok = result === c[3];

    if(!ok) pass = false;

    Logger.log(
      "campaign=" + c[0] + " detail=" + c[1] + " leadSource=" + c[2] +
      " -> " + result + " (expected " + c[3] + ") " + (ok ? "✅" : "❌")
    );

  });

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

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

/**
 * ==========================================================
 * Get Fiscal Month Label
 *
 * WHY
 * ACQ Report의 Engine/Report 영역은 "JUL", "AUG" 같은 3글자
 * 대문자 월 약어로 Month를 표현한다 (기존 getMonthText()의
 * "Jul 26" 포맷과는 다름). Fiscal Year 안에서 각 달력월은
 * 정확히 한 번만 나타나므로, FY + 이 라벨 조합으로 유일하게
 * 식별 가능하다.
 *
 * INPUT
 * date : Date|null
 *
 * OUTPUT
 * string  (예: "JUL", 실패 시 "")
 *
 * TEST
 * getFiscalMonthLabel(new Date(2026,6,1)) === "JUL"
 *
 * EXPECTED
 * 7월(getMonth()===6) → "JUL"
 * ==========================================================
 */
function getFiscalMonthLabel(date){

  if(!(date instanceof Date) || isNaN(date.getTime())){
    return "";
  }

  const labels = [
    "JAN","FEB","MAR","APR","MAY","JUN",
    "JUL","AUG","SEP","OCT","NOV","DEC"
  ];

  return labels[date.getMonth()];

}


/**
 * ==========================================================
 * TEST — getFiscalMonthLabel()
 * ==========================================================
 */
function testGetFiscalMonthLabel(){

  const cases = [
    [new Date(2026, 6, 1), "JUL"],   // 7월
    [new Date(2026, 7, 1), "AUG"],   // 8월
    [new Date(2026, 0, 1), "JAN"],   // 1월
    [null, ""]
  ];

  let passCount = 0;

  cases.forEach(function(testCase){

    const result = getFiscalMonthLabel(testCase[0]);
    const expected = testCase[1];
    const pass = result === expected;

    if(pass) passCount++;

    Logger.log(
      (pass ? "✅ PASS" : "❌ FAIL") +
      "  input=" + testCase[0] +
      "  expected=" + expected +
      "  actual=" + result
    );

  });

  Logger.log(passCount + " / " + cases.length + " passed");

}

/**
 * ==========================================================
 * Get Calendar Date For Fiscal Month
 *
 * WHY
 * Fiscal Year + 3글자 Month 라벨(예: FY26, "AUG")을 실제 달력
 * Date 객체로 변환한다. 데이터 스캔 시 날짜 범위 필터링에 사용.
 *
 * Fiscal 규칙: AUG~DEC는 (FY-1)년, JAN~JUL은 FY년.
 *
 * INPUT
 * fy : Number (예: 26)
 * monthLabel : string (예: "AUG")
 * day : Number (1 또는 그 달의 마지막 날)
 *
 * OUTPUT
 * Date
 *
 * TEST
 * getCalendarDateForFiscalMonth_(26, "AUG", 1) → 2025-08-01
 * getCalendarDateForFiscalMonth_(26, "JUL", 1) → 2026-07-01
 * ==========================================================
 */
function getCalendarDateForFiscalMonth_(fy, monthLabel, day){

  const labels = [
    "JAN","FEB","MAR","APR","MAY","JUN",
    "JUL","AUG","SEP","OCT","NOV","DEC"
  ];

  const monthIndex = labels.indexOf(monthLabel);

  if(monthIndex === -1){
    throw new Error("Unknown month label : " + monthLabel);
  }

  // fy는 "20" + fy 형태의 2자리 숫자로 들어온다고 가정 (예: 26 → 2026)
  const fullYear = 2000 + fy;

  const calendarYear =
    (monthIndex >= 7)   // AUG(7)~DEC(11)
      ? fullYear - 1
      : fullYear;

  return new Date(calendarYear, monthIndex, day);

}


/**
 * ==========================================================
 * TEST — getCalendarDateForFiscalMonth_()
 * ==========================================================
 */
function testGetCalendarDateForFiscalMonth(){

  const case1 = getCalendarDateForFiscalMonth_(26, "AUG", 1);
  const case2 = getCalendarDateForFiscalMonth_(26, "JUL", 1);

  const pass1 =
    case1.getFullYear() === 2025 &&
    case1.getMonth() === 7 &&
    case1.getDate() === 1;

  const pass2 =
    case2.getFullYear() === 2026 &&
    case2.getMonth() === 6 &&
    case2.getDate() === 1;

  Logger.log("Case1 (FY26 AUG) : " + case1 + " (expected 2025-08-01) " + (pass1 ? "✅" : "❌"));
  Logger.log("Case2 (FY26 JUL) : " + case2 + " (expected 2026-07-01) " + (pass2 ? "✅" : "❌"));

}