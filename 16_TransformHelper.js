/**
 * ==========================================================
 * Marketing 2.0
 * Transform Helper
 *
 * Responsibility
 * 순수 헬퍼 함수 전용: parseDate/parseDMY/parseMDY/parseISO/getFiscalYear/
 * getQuarter/getWeek/getMonthKey/getMonthText/getBusinessSegment 등.
 *
 * Version
 * v1.8.0
 *
 * Change Log
 * v1.8.0 (2026-07-28)
 * - Content 키워드에 "download"/"case study"/"quiz"/"on demand"(공백형) 추가
 *   (campaign/detail 양쪽, 사용자 확정) — "Downloaded Top 50 NZ High Schools",
 *   "Case Study", "Career Quiz", 공백형 "On Demand" 계열이 Content로 분류됨.
 * - BOFU/Search 공용 fallback 재설계 — 사용자 확정: 이 계정 BOFU/Search 세그먼트
 *   캠페인 둘 다 슬러그에 관례적으로 "_contact"를 붙이는데, Search는 역사적으로
 *   Lead Source가 Naver Search/Google Search/Organic Search(+Paid Search)인
 *   경우만 존재 — 그 외(Paid Social 등)는 전부 BOFU. campaign에 "search"/
 *   "sitelink" 확정 신호가 없는 순수 "_contact"/"contact"/"consult" 캠페인은
 *   이제 leadSource.includes("search") 여부로 BOFU/Search를 최종 판별(이전
 *   v1.7.0에서는 무조건 Search fallback이었음). 신규 테스트:
 *   testGetBusinessSegmentContactFallbackToBOFU(). 기존
 *   testGetBusinessSegmentQABatch2()의 "순수 consult" 케이스 기대값을
 *   Search→BOFU로 갱신(leadSource 빈 값 기준, 의도된 변경).
 * - ⚠️ 잔여 이슈(CLAUDE.md 미해결 항목에 기록): 옛날 ebook Marketo flow가 UTM
 *   없으면 leadSource를 "Organic Search"로 기본 처리하던 레거시 때문에,
 *   leadSource="Organic Search"라고 다 진짜 Search는 아닐 수 있음(사용자 확인).
 *   이번 수정은 leadSource가 명확히 다른 값(Paid Social 등)인 케이스만 해소 —
 *   leadSource 자체가 "Organic Search"로 잘못 남아있는 잔존 레거시는 별도 처리 필요.
 * v1.7.0 (2026-07-28)
 * - getBusinessSegment() Search 판정 재설계 — campaign.includes("search")/
 *   campaign.includes("sitelink")를 Content 판정보다 먼저 체크하는 확정
 *   신호로 신규 추가(사용자 확정 기준: "campaign에 search/sitelink가 있으면
 *   organic/paid 무관하게 무조건 Search"). campaign.includes("_contact")/
 *   "contact"/"consult")는 이 확정 신호 블록에서 제거하고 Content 판정 뒤
 *   fallback으로 이동 — 이 계정 Meta 리타게팅 캠페인 다수가 슬러그에 관례적
 *   으로 "_contact"/"consult"를 붙이고 있어서(runAuditSearchSegmentIssues(),
 *   71_Search_Engine.js 실측), Content 판정보다 먼저 체크하면 ebook/
 *   prospectus 등 명백한 콘텐츠 캠페인까지 Search로 가로채는 문제 발견.
 *   단순히 "_contact"/"consult"만 뒤로 미루면 "sitelink-ext-..._lead"처럼
 *   Content 키워드("_lead")와 우연히 겹치는 진짜 Search 캠페인이 잘못
 *   Content로 넘어갈 뻔했음 — 사용자가 제시한 "명확한 Search" 49개 캠페인
 *   전수 검증 후 "search"/"sitelink"를 별도 확정 신호로 분리해 해결.
 *   detail.includes("contact")/"paid search"/"organic search")와
 *   leadSource.includes("search") fallback은 기존 위치/동작 유지. 신규
 *   테스트: testGetBusinessSegmentSearchCampaignSignals().
 * v1.6.0 (2026-07-28)
 * - BUSINESS_SEGMENT_EXCEPTIONS에 "Mini/Digital SAT Practice Test" 계열 3건
 *   추가(2개 값 + "MOUF" 오타 변형 1개, 전부 Content). "SAT"/"practice test"는
 *   공통 키워드로 일반화하기엔 다른 세그먼트 오탐 위험이 커서 ebook 계열과
 *   동일하게 정확한 문자열 하드코딩으로 처리(사용자 확인). 배경: 옛날 ebook류를
 *   처리하던 Marketo flow가 UTM 값이 없으면 Lead Source를 "Organic Search"로
 *   기본 처리하도록 설계돼 있었음(사용자 확인) — v1.5.0의 leadSource fallback
 *   순위 조정만으로는 해결 안 되는 잔여 케이스(공통 Content 키워드 자체가 없어
 *   fallback까지 도달해 Search로 남거나 Other로 떨어짐). 신규 테스트 케이스
 *   testGetBusinessSegmentHardcodedExceptions()에 3건 추가.
 * v1.5.0 (2026-07-28)
 * - getBusinessSegment(): leadSource.includes("search")를 Search 블록에서
 *   제거하고 Content 판정 뒤로 이동(신규 "Search (Lead Source fallback)"
 *   블록). campaign/detail에 명확한 Content 키워드(ebook/guide/on-demand/
 *   infographic 등)가 있어도 leadSource가 "Paid Search"/"Organic Search"면
 *   무조건 Search로 덮어써지던 문제 수정 — 사용자가 Search_OPS에서 콘텐츠성
 *   캠페인 22개를 검토하다 발견, runInvestigateSearchMisclassifiedCampaigns()
 *   (71_Search_Engine.js) 실측으로 그중 20개·약 1,190건이 이 원인으로 잘못
 *   분류돼 있었음을 확인 후 수정. 2026-07-25에 leadSource=search 신호를 추가한
 *   원래 목적(Other로 떨어지던 2,264건 구제)은 fallback 위치에서 그대로 유지.
 *   신규 테스트: testGetBusinessSegmentContentBeatsLeadSourceSearch(). 기존
 *   testGetBusinessSegmentLeadSourceSearch()의 "ebook-campaign"+"Paid Search"
 *   케이스 기대값을 Search→Content로 갱신(우선순위 반전에 따른 의도된 변경).
 *   ⚠️ Leads_Master/MTA_Master 전체에 소급 적용하려면 rebuildLeadsMaster()/
 *   rebuildMTAMaster() Full Rebuild 필요(사용자 확인 후 별도 실행 예정).
 * ==========================================================
 *
 * 함수 목록
 * parseDate() / parseDMY() / parseMDY() / parseISO() / getFiscalYear() /
 * getQuarter() / getWeek() / getMonthKey() / getMonthText() /
 * getBusinessSegment()
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
 * v1.4.0 (2026-07-25)
 * - 디버그용 Logger.log() 제거 — value가 이미 Date 객체일 때마다 조건 없이
 *   로그를 찍고 있어서, 대량 레코드(수만 건) 처리 시 실행 시간을 크게
 *   늘리는 원인이었음(Import 다이얼로그 지연/Rebuild 체감 저하로 사용자
 *   발견). 원래 디버깅 목적으로 남아있던 것으로 추정, 정상 동작에는
 *   영향 없어 바로 제거.
 * v1.3.0 (2026-07-21)
 * - 시간이 포함된 값("19/2/2024, 5:21 pm")에서 콤마 이후 시간
 *   부분을 잘라내고 날짜만 파싱하도록 전처리 추가.
 *   (MTA CSV의 IC Booked/Completed/Won Date 필드에서 발견됨 —
 *   기존엔 시간 부분 때문에 파싱 실패 → null 반환되고 있었음)
 * ==========================================================
 */
function parseDate(value, format) {

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
 * ==========================================================
 * Business Segment Hardcoded Exceptions (2026-07-25)
 *
 * WHY
 * temp_QA 반복 검토로 발견된 개별 케이스 중, 공통 키워드로 일반화할 수 없는
 * 예외(Marketo 캠페인/폼 명명 실수로 추정, 사용자 확인)를 정확한 문자열
 * 매칭으로 처리. campaign/detail 원문 그대로 소문자로 key를 맞춤
 * (getBusinessSegment() 내부에서 이미 toLowerCase() 적용된 값과 비교).
 * 근본 수정은 Marketo에서 캠페인/폼 명명을 정정하는 것 — 이 목록은 그 전까지의
 * 임시 우회. 실제 리네이밍 대상 목록은 docs/BusinessSegmentClassification.md
 * "Marketo 네이밍 정정 필요 목록" 참고.
 *
 * 2026-07-28 추가분 — "Mini/Digital SAT Practice Test" 계열
 * "ebook"/"guide" 같은 공통 Content 키워드가 전혀 없어 일반 룰로 못 잡히고,
 * leadSource="Organic Search"/"Paid Search"인 건은 fallback으로도 Search에
 * 남고 나머지는 Other로 떨어지던 케이스. 사용자 확인: 옛날 ebook류를 처리하던
 * Marketo flow가 UTM 값이 없으면 Lead Source를 "Organic Search"로 기본
 * 처리하도록 설계돼 있었음 — 즉 이 leadSource 값 자체가 실제 검색 유입을
 * 의미하지 않는 레거시 아티팩트. "SAT"/"practice test"는 너무 일반적인
 * 단어라 새 공통 키워드로 추가하기엔 다른 세그먼트 오탐 위험이 있어, ebook
 * 계열과 동일하게 정확한 문자열 하드코딩으로 처리(사용자 확인).
 * ==========================================================
 */
const BUSINESS_SEGMENT_EXCEPTIONS = {

  // Content — 공통 키워드 없는 개별 예외
  "wf-2023-01-kor-mofu-core us university admissions for international school students": "Content",
  "wf-2022-11-kor-mofu-core us vs uk top university comparisons": "Content",
  "wf-2023-06-kor-mofu-core breaking down the ivy league 2023 update": "Content",
  "wf-2022-02-kor-mofu-cga school comparison": "Content",
  "gc-2021-03 kr why cga campaign": "Content",
  "wf-2023-09-kor-mofu-core how to ace your academics for us universities (relaunching)": "Content",
  "wf-2025-12-uk-tofu-core 2 year roadmap to the ivy league": "Content",
  "wf-2026-04-usa-mofu-postgrad the 6-month recruitment prep workbook": "Content",

  // Content — "Mini/Digital SAT Practice Test" 계열 (2026-07-28, 옛날 ebook
  // Marketo flow의 "UTM 없으면 Organic Search로 기본 처리" 아티팩트 대응)
  "wf-2023-05-kor-mofu-core mini digital sat practice test 2023": "Content",
  "wf-2023-05-kor-mouf-core mini digital sat practice test 2023": "Content", // "mouf" 오타 변형
  "wf-2022-11-kor-mofu-core new digital mini sat practice test": "Content",

  // Webinar — 명시적 확인
  "2021-07-kor-book a consult page": "Webinar"

};


/**
 * Determine Business Segment.
 *
 * Used by both Leads_Master and MTA_Master.
 *
 * Leads_Master
 *  First MKT UTM Campaign
 *  -> First Touch Detail
 *  -> Lead Source
 *  -> (First Lead Source Category — N/A 판정 전용, 2026-07-25 추가)
 *
 * MTA_Master
 *  Last MKT UTM Campaign
 *  -> Lead Source Detail
 *  -> Lead Source
 *  -> (Lead Source Category — N/A 판정 전용, 2026-07-25 추가)
 *
 * Change Log
 * 2026-07-25 (계속, 8차 — N/A 세그먼트 추가)
 * - 새 파라미터 category 추가(4번째, optional). MKT UTM Campaign/Lead Source
 *   Detail/Lead Source Category/Lead Source 4개가 전부 비어있으면(진짜
 *   어트리뷰션 데이터 자체가 없음) "Other"가 아니라 "N/A"를 반환하도록 추가
 *   — "Other"는 데이터는 있지만 기존 룰에 안 맞는 경우, "N/A"는 애초에 판단할
 *   데이터가 없는 경우로 구분(사용자 확인). Referral 등 다른 룰이 leadSource
 *   하나만으로도 이미 먼저 매치되므로 이 체크는 맨 마지막(Other 직전)에 위치 —
 *   leadSource도 비어있어야 하므로 Referral 오분류 위험 없음.
 * 2026-07-25 (계속, 7차 — 일반화 불가능 예외 하드코딩)
 * - BUSINESS_SEGMENT_EXCEPTIONS 추가: 공통 키워드가 없어 패턴 룰로 일반화할 수
 *   없는 개별 케이스(Content 8건, Webinar 1건 — Marketo 캠페인/폼 명명 실수로
 *   추정, 사용자 확인)를 정확한 문자열 매칭으로 최우선 처리. 근본 수정은
 *   Marketo에서 명명 정정 — docs/BusinessSegmentClassification.md "Marketo
 *   네이밍 정정 필요 목록" 참고.
 * 2026-07-25 (계속, 6차 — temp_QA 2차 리프레시 발견분 일괄 반영)
 * - Seminar: campaign/detail에 "summit" 추가, detail에 "live event"/"seminar"/
 *   "세미나" 추가(일반 단어 자체를 신호로 인정). detail.startsWith("ev-") →
 *   includes("ev-")로 완화(예: "Registered for EV-2024-04-..." 처럼 접두사가
 *   아닌 위치에 EV가 오는 케이스 대응).
 * - Webinar: campaign/detail에 "book a consult" 추가(다수가 웨비나 케이스로
 *   확인, 예외는 수동 관리), detail에 "open day" 추가. detail.startsWith("wb-")
 *   → includes("wb-")로 완화(EV와 동일한 이유).
 * - BOFU: campaign/detail에 "ptc"(Push To Consult) 추가, detail에
 *   "consultation request"/"consult page" 추가. "book a consult"(Webinar)와
 *   문구가 겹치지 않도록 정확한 문구 단위로 구분 — 코드 순서상 Webinar가
 *   BOFU보다 먼저 체크되므로 "book a consult"가 먼저 잡히고, 순수 "consult"는
 *   기존처럼 Search로 유지(사용자 확인, 세 갈래 우선순위 확정: Webinar >
 *   BOFU > Search).
 * - Content: campaign/detail에 "infographic" 추가, detail에 "on-demand"/
 *   "ondemand" 추가.
 * - "comp"/"checklist"/"Mini Digital SAT"/"TOFU" 포함 + 여전히 Other인 나머지는
 *   일반화 불가능한 개별 예외(캠페인 집행/네이밍 실수)로 판단 — getBusinessSegment()
 *   변경 없이 temp_QA(25_TempQA_BusinessSegment.js)에서 "Other 잘 분류"로 표시만.
 * - 공통 키워드 없는 순수 오타성 Content 예외(예: "US vs UK Top University
 *   Comparisons") 등은 코드 규칙화하지 않고 추후 일괄 결정(FT Override 수동
 *   처리 등) 보류 — 사용자 확인.
 * 2026-07-25 (계속, 5차)
 * - Content 판정이 campaign만 체크하고 detail은 전혀 안 봐서(단일 필드 의존)
 *   detail="WF-2021-09-KOR-MOFU-Core Hyperlocalized ECL eBook" 같은 케이스가
 *   Other로 떨어짐(사용자 확인). "_lead"(캠페인 슬러그 전용 태그) 제외 나머지
 *   6개 콘텐츠 키워드(ebook/planner/guide/prospectus/booklet/curriculum/
 *   parent ebook)를 detail에도 동일하게 미러링.
 * 2026-07-25 (계속, 4차)
 * - Seminar 판정에 campaign/detail 양쪽에 "expo" 포함 조건 추가. Expo는 오프라인
 *   행사(Seminar와 동일 취급)인데 캠페인명에 "event"만 있고 "event-offline"/
 *   "offline-seminar" 패턴이 없어 Other로 떨어지는 케이스 발견
 *   (예: campaign="KR_core_2026-03-01_expo_early1_event-lam-budget-smart160",
 *   detail="WF-2026-03-KOR-MOFU-Core Expo Naver DA", 사용자 확인 — Expo == Seminar).
 * 2026-07-25 (계속, 3차)
 * - Webinar 판정의 detail.includes("zoom webinar")(정확한 문구만 매칭)를
 *   detail.includes("webinar")로 완화 — "Created via Zoom API Integration via
 *   webinar attendance report" 같은 변형이 정확한 문구 불일치로 Other에 떨어지는
 *   케이스 발견(temp_QA, 사용자 확인). "webinar" 단어 자체가 강한 신호라 오탐
 *   위험 낮다고 판단.
 * 2026-07-25 (계속)
 * - Seminar/Webinar 캠페인명 패턴 추가: campaign.includes("offline-seminar") /
 *   "online-webinar". 기존 "event-offline"/"event-online" 리터럴 문자열만으로는
 *   실제 "core" 캠페인 네이밍(예: KR_core_2024-02-27_..._seoul-offline-seminar)을
 *   못 잡아 Seminar여야 할 리드가 Other/Search로 잘못 떨어지는 케이스 발견
 *   (Lead ID 00QRC000008NmXB, 사용자 확인). Seminar/Webinar는 Search보다 먼저
 *   체크되므로 이 fix로 해당 리드들은 Search 판정까지 가지 않고 Seminar/Webinar로
 *   먼저 분류됨.
 * - Search 판정 조건에 detail.includes("contact") 추가 — First Touch Detail이
 *   "Contact Us Form" 류인데 Other로 떨어지는 43건 확인(temp_QA, 사용자 확인).
 *   기존 campaign.includes("contact")와 동일 의도, detail에도 동일 체크 적용.
 * 2026-07-25
 * - Search 판정 조건에 leadSource.includes("search") 추가 (temp_QA 수동 검토로
 *   발견 — First Lead Source에 "Search"가 포함되는데 Other로 떨어지는 2,264건
 *   확인, 사용자 확정). 기존 campaign/detail 조건과 동일 우선순위(OR)로 통합 —
 *   Content보다 먼저 체크되므로, 현재 Content로 분류된 리드 중 Lead Source에
 *   search가 포함된 건 이 변경으로 Search로 바뀔 수 있음(사용자 확인 후 진행).
 * 2026-07-22
 * - "Event Offline" -> "Seminar", "Event Online" -> "Webinar"로 리네이밍
 *   (실무에서 부르는 명칭과 통일. 분류 조건/우선순위는 변경 없음).
 *
 * @param {string} campaign
 * @param {string} detail
 * @param {string} leadSource
 * @param {string} [category]  First Lead Source Category(Leads)/Lead Source Category(MTA) — 2026-07-25 추가, N/A 판정 전용
 * @return {string}
 */
function getBusinessSegment(
  campaign,
  detail,
  leadSource,
  category
) {

  campaign = String(campaign || "").toLowerCase();
  detail = String(detail || "").toLowerCase();
  leadSource = String(leadSource || "").toLowerCase();
  category = String(category || "").toLowerCase();

  //----------------------------------------------------------
  // Hardcoded Exceptions (최우선 — 아래 일반 룰보다 먼저 확인)
  //----------------------------------------------------------

  if (BUSINESS_SEGMENT_EXCEPTIONS[campaign]) {
    return BUSINESS_SEGMENT_EXCEPTIONS[campaign];
  }

  if (BUSINESS_SEGMENT_EXCEPTIONS[detail]) {
    return BUSINESS_SEGMENT_EXCEPTIONS[detail];
  }

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
    campaign.includes("offline-seminar") ||
    campaign.includes("expo") ||
    campaign.includes("summit") ||
    detail.includes("ev-") ||
    detail.includes("expo") ||
    detail.includes("summit") ||
    detail.includes("live event") ||
    detail.includes("seminar") ||
    detail.includes("세미나")
  ) {
    return "Seminar";
  }

  //----------------------------------------------------------
  // Webinar (구 "Event Online")
  //----------------------------------------------------------

  if (
    campaign.includes("event-online") ||
    campaign.includes("online-webinar") ||
    campaign.includes("book a consult") ||
    detail.includes("wb-") ||
    detail.includes("webinar") ||
    detail.includes("book a consult") ||
    detail.includes("open day")
  ) {
    return "Webinar";
  }

  //----------------------------------------------------------
  // BOFU
  //----------------------------------------------------------

  if (
    detail.includes("bofu") ||
    campaign.includes("ptc") ||
    detail.includes("ptc") ||
    detail.includes("consultation request") ||
    detail.includes("consult page")
  ) {
    return "BOFU";
  }

  //----------------------------------------------------------
  // Search — 확정 신호(Content보다 먼저, 2026-07-28 재설계)
  //
  // 사용자 확정 기준: campaign에 "search" 또는 "sitelink"가 있으면(organic/
  // paid 무관) 무조건 Search — 실제 사용자가 "명확한 Search" 49개 캠페인을
  // 검증용으로 제시했고, 그중 다수가 campaign에 "curriculum"(Content
  // 키워드) 등을 우연히 포함하고 있어 이 확정 신호가 Content보다 먼저
  // 와야 함(예: "search-ap-curriculum-courses_contact"). "sitelink-ext-..._lead"
  // 처럼 "_lead"(Content 키워드)로 끝나는 캠페인도 있어 "sitelink" 역시
  // 동일하게 최우선 확정 신호로 취급. detail의 "contact"/"paid search"/
  // "organic search"는 기존처럼 여기 유지(더 구체적인 폼 제출 신호라 Content
  // 오탐 사례가 발견되지 않음).
  //
  // ⚠️ campaign.includes("_contact")/"contact"/"consult")는 여기서 제거하고
  // Content 판정 뒤 fallback으로 이동(아래 참고) — 이 계정의 거의 모든 Meta
  // 리타겟팅 캠페인이 슬러그 끝에 "_contact"/"consult"를 관례적으로 붙이고
  // 있어서, ebook/prospectus/case study/webinar/SAT practice test 등 명백한
  // 콘텐츠 캠페인까지 이 조건 하나로 Search가 돼버리는 문제 발견
  // (runAuditSearchSegmentIssues(), 71_Search_Engine.js 실측).
  //----------------------------------------------------------

  if (
    campaign.includes("search") ||
    campaign.includes("sitelink") ||
    detail.includes("contact") ||
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
    campaign.includes("parent ebook") ||
    campaign.includes("infographic") ||
    campaign.includes("download") ||
    campaign.includes("case study") ||
    campaign.includes("quiz") ||
    campaign.includes("on-demand") ||
    campaign.includes("ondemand") ||
    campaign.includes("on demand") ||
    detail.includes("ebook") ||
    detail.includes("planner") ||
    detail.includes("guide") ||
    detail.includes("prospectus") ||
    detail.includes("booklet") ||
    detail.includes("curriculum") ||
    detail.includes("parent ebook") ||
    detail.includes("infographic") ||
    detail.includes("download") ||
    detail.includes("case study") ||
    detail.includes("quiz") ||
    detail.includes("on-demand") ||
    detail.includes("ondemand") ||
    detail.includes("on demand")
  ) {
    return "Content";
  }

  //----------------------------------------------------------
  // BOFU/Search 공용 fallback (campaign에 "_contact"/"contact"/"consult"만
  // 있는 경우, 2026-07-28 재설계)
  //
  // 사용자 확정: 이 계정 BOFU/Search 세그먼트 캠페인 둘 다 슬러그에 관례적
  // 으로 "_contact"를 붙이는데, Search는 역사적으로 Lead Source가 Naver
  // Search/Google Search/Organic Search(+Paid Search)인 경우만 존재 — 그 외
  // 나머지(예: Paid Social 등)는 전부 BOFU여야 함. "search"/"sitelink"가
  // campaign에 없는 순수 "_contact"/"consult" 캠페인은 leadSource로 최종
  // 판별: leadSource에 "search"가 포함되면 Search, 아니면 BOFU.
  // ⚠️ 잔여 이슈(별도, CLAUDE.md 미해결 항목 참고): 옛날 ebook Marketo flow가
  // UTM 없으면 leadSource를 "Organic Search"로 기본 처리하던 레거시 때문에,
  // leadSource="Organic Search"라고 다 진짜 Search는 아닐 수 있음 — 이번
  // 수정으로 이 fallback 경로는 해소되지만, campaign.includes("search")로
  // 이미 확정 Search 처리되는 케이스나 leadSource 자체가 남아있는 잔존
  // 레거시는 별도 처리 필요.
  //----------------------------------------------------------

  if (
    campaign.includes("_contact") ||
    campaign.includes("contact") ||
    campaign.includes("consult")
  ) {
    return leadSource.includes("search") ? "Search" : "BOFU";
  }

  //----------------------------------------------------------
  // Search (leadSource 최종 fallback, 2026-07-25)
  //
  // campaign/detail 어디에도 신호가 전혀 없을 때만 사용 — First Lead
  // Source에 "Search"가 포함되는데 Other로 떨어지던 2,264건 구제 목적
  // 그대로 유지.
  //----------------------------------------------------------

  if (leadSource.includes("search")) {
    return "Search";
  }

  //----------------------------------------------------------
  // N/A — MKT UTM Campaign/Lead Source Detail/Lead Source Category/
  // Lead Source가 전부 비어있음(진짜 데이터 없음, "Other"와 구분 — 2026-07-25 추가)
  //----------------------------------------------------------

  if (!campaign && !detail && !category && !leadSource) {
    return "N/A";
  }

  //----------------------------------------------------------
  // Other
  //----------------------------------------------------------

  return "Other";

}


/**
 * ==========================================================
 * TEST — getBusinessSegment() N/A 세그먼트 검증 (2026-07-25)
 *
 * WHY
 * MKT UTM Campaign/Lead Source Detail/Lead Source Category/Lead Source
 * 4개가 전부 비어있으면 "Other"가 아니라 "N/A"를 반환해야 함. 4개 중
 * 하나라도 값이 있으면(설령 알려진 패턴에 안 맞아도) 여전히 "Other".
 * ==========================================================
 */
function testGetBusinessSegmentNA(){

  const cases = [
    // [campaign, detail, leadSource, category, expected]
    ["", "", "", "", "N/A"],
    ["random-campaign", "", "", "", "Other"],
    ["", "some detail", "", "", "Other"],
    ["", "", "some source", "", "Other"],
    ["", "", "", "some category", "Other"]
  ];

  let pass = true;

  cases.forEach(function(c){

    const result = getBusinessSegment(c[0], c[1], c[2], c[3]);
    const ok = result === c[4];

    if(!ok) pass = false;

    Logger.log(
      "campaign=" + c[0] + " detail=" + c[1] + " leadSource=" + c[2] +
      " category=" + c[3] + " -> " + result + " (expected " + c[4] + ") " + (ok ? "✅" : "❌")
    );

  });

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

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
 * TEST — getBusinessSegment() 2026-07-25 QA 발견 케이스 검증
 *
 * WHY
 * temp_QA(25_TempQA_BusinessSegment.js) 수동 검토로 발견된 4개 갭을
 * 한 번에 검증:
 * 1. First Lead Source에 "Search" 포함 → Other로 떨어짐 (2,264건)
 * 2. 캠페인명이 "...-offline-seminar"/"...-online-webinar" 패턴(core 캠페인
 *    네이밍) → 기존 "event-offline"/"event-online" 리터럴만으로는 못 잡힘
 *    (Lead ID 00QRC000008NmXB 사례)
 * 3. First Touch Detail에 "Contact" 포함(예: "Contact Us Form") → Other로
 *    떨어짐 (43건)
 * 4. First Touch Detail이 "zoom webinar" 정확한 문구가 아닌 변형(예: "Created
 *    via Zoom API Integration via webinar attendance report") → Other로 떨어짐
 * 5. 캠페인명에 "event"만 있고 "event-offline"/"offline-seminar" 패턴은 없는
 *    Expo 캠페인(Expo == Seminar) → Other로 떨어짐
 * 6. Content 판정이 campaign만 체크해서 detail에만 ebook 등 키워드가 있는
 *    케이스가 Other로 떨어짐
 * ==========================================================
 */
function testGetBusinessSegmentLeadSourceSearch(){

  const cases = [
    // [campaign, detail, leadSource, expected]
    ["", "", "Paid Search", "Search"],
    ["", "", "Organic Search", "Search"],
    ["", "", "search", "Search"],
    ["", "", "SEARCH", "Search"],
    ["ebook-campaign", "", "Paid Search", "Content"],  // 2026-07-28 우선순위 반전 — Content가 leadSource=search보다 우선(과거엔 Search였음, 아래 leadSource fallback 테스트 참고)
    ["", "BOFU-Consult", "Paid Search", "BOFU"],       // BOFU가 Search보다 우선(기존 순서 유지)
    ["", "", "Direct", "Other"],

    // 캠페인명 패턴 — offline-seminar / online-webinar (core 캠페인)
    ["KR_core_2024-02-27_josephine-and-gabe-seoul-offline-seminar", "Crimson Education Contact Us form", "", "Seminar"],
    ["US_core_2024-05-01_some-city-online-webinar", "", "", "Webinar"],

    // First Touch Detail에 "Contact" 포함
    ["", "Crimson Education Contact Us form", "", "Search"],
    ["", "WF-2023-12-USA-TOFU-Core Contact Us Form - Crimson Education USA Contact Us form", "", "Search"],
    ["", "Filled in CGA Contact Enquiry form", "", "Search"],

    // Webinar — "zoom webinar" 정확한 문구가 아닌 변형
    ["", "Created via Zoom API Integration via webinar attendance report", "", "Webinar"],

    // Expo == Seminar (campaign/detail 양쪽 체크)
    ["KR_core_2026-03-01_expo_early1_event-lam-budget-smart160", "WF-2026-03-KOR-MOFU-Core Expo Naver DA", "Paid Display", "Seminar"],

    // Content — detail에만 ebook 키워드가 있는 경우
    ["", "WF-2021-09-KOR-MOFU-Core Hyperlocalized ECL eBook", "", "Content"]
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
 * TEST — getBusinessSegment() Content vs leadSource="search" 우선순위 (2026-07-28)
 *
 * WHY
 * 사용자가 Search_OPS를 검토하다가 ebook/guide/on-demand/infographic 등
 * 콘텐츠 다운로드 리드가 Business Segment=Search로 잘못 찍혀있는 걸 발견.
 * 원인은 leadSource.includes("search")가 Content 판정보다 먼저 체크되던
 * 순서 — 실측 결과(runInvestigateSearchMisclassifiedCampaigns(),
 * 71_Search_Engine.js) 콘텐츠성 캠페인 22개 중 20개에서 총 약 1,190건이
 * 이 원인으로 잘못 분류돼 있었음(예: "Hyperlocalized ECL eBook" detail +
 * leadSource="Organic Search" 조합, 실데이터에서 그대로 확인됨). Content
 * 판정을 leadSource fallback보다 먼저 체크하도록 순서를 바꿔 수정.
 * 2026-07-25에 leadSource="search" 신호를 추가한 원래 목적(Other로
 * 떨어지던 2,264건 구제)은 fallback으로 유지되므로 그대로 보존됨.
 * ==========================================================
 */
function testGetBusinessSegmentContentBeatsLeadSourceSearch(){

  const cases = [
    // [campaign, detail, leadSource, expected]

    // 실제 발견된 케이스 — detail에 ebook, leadSource="Organic Search"
    ["", "WF-2021-09-KOR-MOFU-Core Hyperlocalized ECL eBook", "Organic Search", "Content"],

    // campaign에 ebook, leadSource="Paid Search"
    ["ebook-campaign", "", "Paid Search", "Content"],

    // campaign/detail 둘 다 콘텐츠 신호 없음 — leadSource fallback 그대로 동작해야 함
    ["", "", "Paid Search", "Search"],
    ["", "", "Organic Search", "Search"],

    // detail에 명시적 Search 문구("contact")가 있으면 Content 키워드 없어도 Search
    // (이 케이스는 애초에 Content 키워드가 없으므로 우선순위 변경과 무관, 회귀 확인용)
    ["", "Crimson Education Contact Us form", "Paid Search", "Search"],

    // BOFU가 여전히 Content/leadSource-Search보다 우선(순서 변경 영향 없음)
    ["", "BOFU-Consult", "Paid Search", "BOFU"]
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
 * TEST — getBusinessSegment() campaign "search"/"sitelink" 확정 신호 vs
 * "_contact"/"consult" fallback 재설계 (2026-07-28)
 *
 * WHY
 * 사용자가 "명확한 Search" 캠페인 49개를 직접 검증용으로 제시(전부 campaign에
 * "search" 또는 "sitelink" 포함, 일부는 Naver 등 예외는 별도 detail 값으로
 * 구분되므로 여기서는 다루지 않음). 그중 "search-ap-curriculum-courses_contact"
 * 처럼 Content 키워드("curriculum")와, "sitelink-ext-..._lead"처럼 Content
 * 키워드("_lead")와 우연히 겹치는 케이스가 있어, "search"/"sitelink"를 Content
 * 판정보다 먼저 확정 신호로 체크해야 함(단순히 "_contact"/"consult"만 뒤로
 * 미루는 걸로는 부족 — sitelink/search 케이스가 Content로 잘못 넘어갈 뻔했음).
 * 동시에 이 계정 Meta 리타게팅 캠페인 다수가 슬러그에 관례적으로 "_contact"/
 * "consult"를 붙이고 있어(runAuditSearchSegmentIssues() 실측), 이걸 Content
 * 판정보다 먼저 체크하면 ebook/prospectus 같은 콘텐츠 캠페인까지 가로채는
 * 문제가 있었음 — "_contact"/"consult"는 fallback으로 유지하되, 이후
 * 사용자 확정에 따라 leadSource로 BOFU/Search를 최종 판별하도록 갱신됨
 * (testGetBusinessSegmentContactFallbackToBOFU() 참고).
 * ==========================================================
 */
function testGetBusinessSegmentSearchCampaignSignals(){

  const cases = [
    // [campaign, detail, leadSource, expected]

    // "search"가 Content 키워드("curriculum")보다 우선
    ["US_cgahq_2025-04-01_search-ap-curriculum-courses_contact", "", "", "Search"],

    // "sitelink"가 Content 키워드("_lead")보다 우선
    ["KR_core_2025-01-15_sitelink-ext-bookconsultukoxbridge_lead", "", "", "Search"],
    ["KR_core_2025_01_01_sitelink-ext-bookconsultv2_lead", "", "", "Search"],

    // 순수 "search"만 있어도 Search (organic/paid 무관)
    ["KR_core_2021-04-01_search-kr_tier1-college-specific_contact", "", "", "Search"],

    // "search"/"sitelink" 없이 "_contact"/"consult"만 있는 경우 — leadSource로
    // 최종 판별(2026-07-28, BOFU/Search 공용 fallback 재설계 참고): leadSource에
    // "search"가 있으면 Search, 없으면 BOFU
    ["{KR_core_brand_contact}", "", "Organic Search", "Search"],
    ["{KR_core_study-consult_contact}", "", "Google Search", "Search"],
    ["{KR_core_brand_contact}", "", "Paid Social", "BOFU"],
    ["{KR_core_study-consult_contact}", "", "", "BOFU"],
    ["some-consult-campaign", "", "", "BOFU"],

    // "_contact"/"consult"만 있고 Content 키워드도 있으면 이제는 Content가 이김
    // (이 계정 캠페인 실측 사례 — Hyperlocal Case Study eBook이 campaign에
    // "consult"가 있어서 예전엔 Search로 잘못 잡혔던 패턴 재현)
    ["some-consult-campaign_contact", "WF-2022-06-KOR-MOFU-Core Hyperlocal Case Study eBook", "", "Content"],
    ["kr_core_2022-XX_prospectus-download-consult_contact", "", "", "Content"],

    // "search"/"sitelink"도, Content 키워드도, "_contact"/"consult"도 전혀
    // 없으면 leadSource 최종 fallback (기존 동작 유지)
    ["KR_core_2025-07-03_brand", "", "Organic Search", "Search"]
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
 * TEST — getBusinessSegment() "_contact"/"consult" fallback → BOFU/Search
 * leadSource 판별 (2026-07-28)
 *
 * WHY
 * 사용자 확정: 이 계정의 BOFU/Search 세그먼트 캠페인 둘 다 슬러그에 관례적
 * 으로 "_contact"를 붙이는데, Search는 역사적으로 Lead Source가 Naver
 * Search/Google Search/Organic Search(+Paid Search)인 경우만 존재 — 그 외
 * (예: Paid Social) 나머지는 전부 BOFU여야 함. campaign에 "search"/"sitelink"
 * 확정 신호가 없는 순수 "_contact"/"consult" 캠페인은 leadSource로 최종
 * 판별하도록 재설계(이전엔 무조건 Search fallback이었음).
 * ==========================================================
 */
function testGetBusinessSegmentContactFallbackToBOFU(){

  const cases = [
    // [campaign, detail, leadSource, expected]

    // leadSource가 Naver/Google/Organic/Paid Search면 Search
    ["US_core_2025-12-12_leads-school_contact-fbiglg", "", "Naver Search", "Search"],
    ["US_core_2025-12-12_leads-school_contact-fbiglg", "", "Google Search", "Search"],
    ["US_core_2025-12-12_leads-school_contact-fbiglg", "", "Organic Search", "Search"],
    ["US_core_2025-12-12_leads-school_contact-fbiglg", "", "Paid Search", "Search"],

    // leadSource가 그 외(Paid Social 등)면 BOFU
    ["US_core_2025-12-12_leads-school_contact-fbiglg", "", "Paid Social", "BOFU"],
    ["CA_core_2023-04-02_admissions-consulting-other_contact", "", "Paid Social", "BOFU"],
    ["US_cgahq_2025-11-26_perfmax-eng_consolidated_contact", "", "", "BOFU"],

    // "ptc"가 이미 있으면 기존처럼 그냥 BOFU(leadSource 무관, 우선순위 변경 없음)
    ["US_core_2026-02-07_ptc-retargeting_contact-fbiglg", "", "Paid Social", "BOFU"],

    // campaign에 "search"가 있으면 leadSource 무관하게 Search(우선순위 변경 없음)
    ["JP_core_2021-04-01_search-eng_brand-crimson_contact", "", "Paid Social", "Search"]
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
 * TEST — getBusinessSegment() 2026-07-25 temp_QA 2차 리프레시 발견 케이스 검증
 *
 * WHY
 * Summit/Live Event/Seminar 단어/EV·WB 위치/Book a Consult/PTC/Consultation
 * Request/Open Day/Infographic/On-Demand — temp_QA 2차 리프레시에서 한 번에
 * 발견된 케이스들을 검증. 특히 "consult" 계열은 Webinar("book a consult") >
 * BOFU("consultation request"/"consult page") > Search(순수 "consult") 우선순위
 * 확정이 핵심이라 별도 케이스로 명시.
 * ==========================================================
 */
function testGetBusinessSegmentQABatch2(){

  const cases = [
    // [campaign, detail, leadSource, expected]

    // Summit -> Seminar
    ["", "KR APAC US UK Summit (Jun 06)", "", "Seminar"],

    // Live Event -> Seminar (EV- 접두사가 아닌 위치)
    ["", "Registered for EV-2024-04-USA-TOFU-Core Chinese Seattle Live Event", "", "Seminar"],
    ["", "Registered for Live Event: Mar 30 FAO Conference", "", "Seminar"],

    // "seminar"/"세미나" 단어 자체
    ["", "Martin Walsh Seminar", "", "Seminar"],
    ["", "크림슨 에듀케이션 입시 세미나 [싱가포르 2차 세미나] | SG||https://www.eventbrite.com/e/2-sg-registration-95348476861?aff=lead.affiliate", "", "Seminar"],

    // WB가 접두사가 아닌 위치 -> Webinar
    ["", "Registered for WB-2025-09-MV-YPTMS | Australia", "", "Webinar"],

    // Book a Consult -> Webinar (Search의 순수 "consult"보다 우선)
    ["2021-07-KOR-Book a consult page", "", "", "Webinar"],

    // Open Day -> Webinar
    ["", "Filled out form: CGA APAC Open Day", "", "Webinar"],

    // PTC(Push To Consult) -> BOFU
    ["UK_core_2023-12-06_yale-ptc-parents_content-fbiglg-copy", "Filled out FB LG form", "", "BOFU"],

    // Consultation Request / Consult Page -> BOFU (Book a Consult과 문구로 구분)
    ["", "KR Consult Page", "", "BOFU"],
    ["", "Challenge #Accepted 2024 - US & UK Admissions Results | Consultation Request", "", "BOFU"],

    // 순수 "consult"는 2026-07-28부터 leadSource로 BOFU/Search 판별
    // (leadSource가 search 계열이 아니면 BOFU — testGetBusinessSegmentContactFallbackToBOFU() 참고)
    ["some-consult-campaign", "", "", "BOFU"],

    // Infographic -> Content
    ["", "WF-2023-04-KOR-MOFU-Core Hyperlocalized Korean Army Infographic", "", "Content"],

    // On-Demand/Ondemand -> Content
    ["", "WF-2022-12-KOR-MOFU-Core Admission Strategy for Young Students 15Mins On-Demand", "", "Content"],
    ["", "WF-2025-11-KOR-MOFU-Core On-demand & Slide Package", "", "Content"],
    ["", "WF-2022-10-KOR-MOFU-Core College Research: HYPS On-demand", "", "Content"]
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
 * TEST — getBusinessSegment() BUSINESS_SEGMENT_EXCEPTIONS 하드코딩 검증
 *
 * WHY
 * 공통 키워드가 없어 패턴 룰로 일반화 불가능한 개별 케이스(Marketo 캠페인/폼
 * 명명 실수로 추정)를 BUSINESS_SEGMENT_EXCEPTIONS 정확한 문자열 매칭으로
 * 처리하는지 검증(2026-07-25).
 * ==========================================================
 */
function testGetBusinessSegmentHardcodedExceptions(){

  const cases = [
    // [campaign, detail, leadSource, expected]
    ["", "WF-2023-01-KOR-MOFU-Core US University Admissions for International School Students", "", "Content"],
    ["", "WF-2022-11-KOR-MOFU-Core US vs UK Top University Comparisons", "", "Content"],
    ["", "WF-2023-06-KOR-MOFU-Core Breaking Down the Ivy League 2023 Update", "", "Content"],
    ["", "WF-2022-02-KOR-MOFU-CGA School Comparison", "", "Content"],
    ["", "GC-2021-03 KR Why CGA Campaign", "", "Content"],
    ["", "WF-2023-09-KOR-MOFU-Core How to Ace Your Academics for US Universities (relaunching)", "", "Content"],
    ["", "WF-2025-12-UK-TOFU-Core 2 Year Roadmap to the Ivy League", "", "Content"],
    ["", "WF-2026-04-USA-MOFU-Postgrad The 6-Month Recruitment Prep Workbook", "", "Content"],
    ["2021-07-KOR-Book a consult page", "", "", "Webinar"],

    // 2026-07-28 추가 — Mini/Digital SAT Practice Test 계열, leadSource가
    // "Organic Search"(옛날 Marketo flow의 UTM-없음 기본값)여도 예외로 Content
    ["", "WF-2023-05-KOR-MOFU-Core Mini Digital SAT Practice Test 2023", "Organic Search", "Content"],
    ["", "WF-2023-05-KOR-MOUF-Core Mini Digital SAT Practice Test 2023", "Organic Search", "Content"],
    ["", "WF-2022-11-KOR-MOFU-Core New Digital Mini SAT Practice Test", "Organic Search", "Content"]
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