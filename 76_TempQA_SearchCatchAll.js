/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — Search Catch-All Reclassification
 *
 * Responsibility
 * Search를 Marketo 프로그램화하는 작업(2026-07-29) 중 발견된 문제 전용
 * 1회성 QA 시트. Lead Source Detail이 "Crimson Education Contact Us
 * form" 같은 범용 캐치올 폼이라 getBusinessSegment()(16_TransformHelper.js)
 * 의 detail.includes("contact") 최종 fallback으로만 Search가 된 리드 중,
 * raw UTM Campaign이 있고(신호 있음) Lead Source Category가 이미 확정된
 * Search 계열(Organic Search/Organic AI Search/Naver Search Ads/Google
 * Search Ads)이 아닌 나머지만 골라서 사람이 Marketo 로그와 대조해 직접
 * 최종 세그먼트를 매길 수 있도록 모든 원본 필드를 시트에 나열한다.
 *
 * WHY
 * runInvestigateSearchGroupCLeadSourceCategory()(71_Search_Engine.js)
 * 실측 결과, "Lead Source Detail/UTM이 아예 없는" 케이스(Organic Search
 * 542건 — UTM 98% 없음)와 달리, Email/Social/Video/Display/Partnerships/
 * Affiliate 등 나머지(약 270여 건)는 UTM이 대부분 있음이 확인됨 — 즉
 * "신호가 없어서" 어중간한 게 아니라 "신호는 있는데 자동 규칙으로 묶기엔
 * Lead Source Category가 훨씬 정확한 신호"인 상황(사용자 판단, 2026-07-29).
 * 건수가 많지 않아 자동 규칙보다 사람이 Marketo 로그를 보며 직접 매칭하는
 * 편이 안전하다고 판단(신규 자동 키워드를 계속 늘리면 또 다른 오탐 위험).
 *
 * Organic Search(542건, UTM 대부분 없음)는 이 시트 대상에서 제외 — 별도
 * QA가 필요하다고 판단된 항목(사용자 확인)이라 여기서 같이 다루지 않는다.
 *
 * Version
 * v1.2.0
 *
 * Change Log
 * v1.2.0 (2026-07-29)
 * - runExportSearchCatchAllQAMapping() 추가(수동 실행용) — 211행을 MKT UTM
 *   Campaign 단위로 묶어서 Final Segment가 일관되는지 확인하고, 일관되는
 *   캠페인은 override 테이블(exact match) 후보로 export. 코드 변경 없음,
 *   순수 조회.
 * v1.1.0 (2026-07-29)
 * - runAnalyzeSearchCatchAllQA() 추가(수동 실행용) — 사용자가 시트 J열
 *   (Final Segment)에 직접 채워넣고 K열에 이유를 메모한 결과를 Final
 *   Segment별/Lead Source Category별로 집계 + K열 메모 전체를 로그로 출력.
 *   코드 변경 없음, 순수 조회.
 * v1.0.0 (2026-07-29)
 * - 최초 구현.
 * ==========================================================
 */

const SEARCH_CATCHALL_QA_SHEET = "Search_CatchAll_QA";

const SEARCH_CATCHALL_QA_HEADERS = [
  "Source Sheet",
  "Lead ID",
  "Email",
  "MKT UTM Campaign",
  "Lead Source Detail",
  "First Lead Source",
  "Lead Source Category",
  "Revenue",
  "Business Segment (현재)",
  "Final Segment (수동 입력)"
];

// getBusinessSegment()(16_TransformHelper.js)의 Content 키워드 목록과 동일 —
// 이 시트는 "Content로 이미 해결된 것"은 애초에 대상에서 빼기 위한 진단
// 전용 복제본. 원본이 바뀌면 여기도 같이 갱신 필요.
const SEARCH_CATCHALL_QA_CONTENT_KEYWORDS = [
  "ebook", "planner", "guide", "prospectus", "booklet", "curriculum",
  "parent ebook", "infographic", "download", "case study", "quiz",
  "on-demand", "ondemand", "on demand", "nurture"
];

// 이미 확정된 Search 계열 Lead Source Category — QA 대상에서 제외
// (Organic Search는 UTM 대부분 없는 별도 그룹이라 여기서 함께 제외 — 사용자 확인).
const SEARCH_CATCHALL_QA_CONFIRMED_SEARCH_CATEGORIES = [
  "organic search", "organic ai search", "naver search ads", "google search ads"
];


/**
 * ==========================================================
 * Is Search Catch-All QA Candidate (순수 함수)
 *
 * WHY
 * I/O(시트 읽기/쓰기)에서 판정 로직을 분리해 테스트 가능하게 함
 * (25_TempQA_BusinessSegment.js의 categorizeSegmentQARow_() 패턴과 동일).
 * ==========================================================
 */
function isSearchCatchAllQACandidate_(businessSegment, campaignRaw, detailRaw, categoryRaw) {

  if (businessSegment !== "Search") return false;

  const campaign = String(campaignRaw || "").trim().toLowerCase();
  const detail = String(detailRaw || "").trim().toLowerCase();
  const category = String(categoryRaw || "").trim().toLowerCase();

  if (!campaign) return false; // UTM 없음 — 신호 없음, 이 시트 대상 아님(별도 QA)
  if (!detail.includes("contact")) return false; // 범용 캐치올 폼 케이스가 아님
  if (campaign.includes("search") || campaign.includes("sitelink")) return false; // 이미 확정 Search
  if (SEARCH_CATCHALL_QA_CONTENT_KEYWORDS.some(function (kw) { return campaign.includes(kw); })) return false; // 이미 Content
  if (/_lead(?![a-z])/.test(campaign)) return false; // 이미 Content

  if (SEARCH_CATCHALL_QA_CONFIRMED_SEARCH_CATEGORIES.indexOf(category) !== -1) return false; // 이미 확정 Search 계열

  return true;

}


/**
 * ==========================================================
 * TEST — isSearchCatchAllQACandidate_()
 * ==========================================================
 */
function testIsSearchCatchAllQACandidate(){

  const cases = [
    // [businessSegment, campaign, detail, category, expected]

    // 대상 O — UTM 있음, 범용 폼, 확정 Search 계열 아님
    ["Search", "KR_core_2024-01-01_kakaotalk-ads-campaign", "Crimson Education Contact Us form", "KakaoTalk Ads", true],
    ["Search", "US_core_2023-08-30_consolidated-newsletter", "Crimson Education Contact Us form", "Crimson Email Potential List", true],

    // 대상 X — UTM 없음(신호 없음, 별도 QA)
    ["Search", "", "Crimson Education Contact Us form", "Organic Search", false],

    // 대상 X — 확정 Search 계열 카테고리(UTM 있어도 제외)
    ["Search", "KR_core_2024-01-01_some-campaign", "Crimson Education Contact Us form", "Organic Search", false],
    ["Search", "KR_core_2024-01-01_some-campaign", "Crimson Education Contact Us form", "Naver Search Ads", false],
    ["Search", "KR_core_2024-01-01_some-campaign", "Crimson Education Contact Us form", "Google Search Ads", false],
    ["Search", "KR_core_2024-01-01_some-campaign", "Crimson Education Contact Us form", "Organic AI Search", false],

    // 대상 X — Business Segment가 Search가 아님
    ["Content", "KR_core_2024-01-01_kakaotalk-ads-campaign", "Crimson Education Contact Us form", "KakaoTalk Ads", false],

    // 대상 X — campaign에 search/sitelink 확정 신호(이미 Search로 확정, QA 불필요)
    ["Search", "KR_core_2021-04-01_search-kr_brand-crimson_contact", "Crimson Education Contact Us form", "Paid Search", false],

    // 대상 X — detail에 "contact" 없음(이번 캐치올 문제와 무관)
    ["Search", "KR_core_2024-01-01_some-campaign", "WF-2021-09-KOR-MOFU-Core Hyperlocalized ECL eBook", "eBook", false]
  ];

  let pass = true;

  cases.forEach(function(c){

    const result = isSearchCatchAllQACandidate_(c[0], c[1], c[2], c[3]);
    const ok = result === c[4];

    if(!ok) pass = false;

    Logger.log(
      "businessSegment=" + c[0] + " campaign=" + c[1] + " detail=" + c[2] + " category=" + c[3] +
      " -> " + result + " (expected " + c[4] + ") " + (ok ? "✅" : "❌")
    );

  });

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Run Build Search Catch-All QA (수동 실행용)
 * ==========================================================
 */
function runBuildSearchCatchAllQA() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const rows = [];

  function scan(sourceLabel, sheet, campaignField, detailField, categoryField) {

    if (!sheet) return;

    sheetToObjects(sheet).forEach(function (r) {

      const businessSegment = r["Business Segment"] || "";
      const campaignRaw = r[campaignField];
      const detailRaw = r[detailField];
      const categoryRaw = r[categoryField];

      if (!isSearchCatchAllQACandidate_(businessSegment, campaignRaw, detailRaw, categoryRaw)) return;

      rows.push([
        sourceLabel,
        r["Lead ID"] || "",
        r["Email"] || "",
        campaignRaw || "",
        detailRaw || "",
        r["First Lead Source"] || "",
        categoryRaw || "",
        Number(r["Revenue"]) || 0,
        businessSegment,
        "" // Final Segment (수동 입력) — 사용자가 직접 채움
      ]);

    });

  }

  scan(
    CONFIG.SHEETS.LEADS_MASTER,
    ss.getSheetByName(CONFIG.SHEETS.LEADS_MASTER),
    SEARCH.MATCH_FIELD.LEADS, "First Touch Detail", "First Lead Source Category"
  );
  scan(
    CONFIG.SHEETS.MTA_MASTER,
    ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER),
    SEARCH.MATCH_FIELD.MTA, "Lead Source Detail", "Lead Source Category"
  );

  writeSearchCatchAllQASheet_(rows);

  Logger.log(SEARCH_CATCHALL_QA_SHEET + " 작성 완료 — " + rows.length + "행.");

}


/**
 * ==========================================================
 * Run Analyze Search Catch-All QA (수동 실행용)
 *
 * WHY
 * 사용자가 Search_CatchAll_QA 시트의 "Final Segment (수동 입력)"(J열)에
 * Marketo 로그 대조 후 직접 세그먼트를 채워넣고, K열에 이유를 메모해둔
 * 상태(2026-07-29) — 다음 단계(getBusinessSegment() 반영) 설계를 위해
 * 사용자가 실제로 어떻게 분류했는지 요약해서 로그로 확인한다. K열 헤더는
 * 사용자가 자유롭게 붙였을 수 있어 헤더 값을 그대로 읽어와 라벨로 사용.
 *
 * 코드 변경 없음 — 순수 조회/로깅.
 * ==========================================================
 */
function runAnalyzeSearchCatchAllQA() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SEARCH_CATCHALL_QA_SHEET);

  if (!sheet) {
    throw new Error(SEARCH_CATCHALL_QA_SHEET + " sheet not found. runBuildSearchCatchAllQA()를 먼저 실행하세요.");
  }

  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    Logger.log(SEARCH_CATCHALL_QA_SHEET + " — 데이터 없음.");
    return;
  }

  const headers = values[0];
  const reasonColIndex = 10; // K열 (0-based) — 헤더 라벨은 사용자가 자유 입력
  const reasonLabel = headers[reasonColIndex] || "(K열, 헤더 없음)";

  const byFinalSegment = {}; // Final Segment -> { count, byCategory: {} }
  let blankFinalCount = 0;

  const reasonRows = [];

  for (let i = 1; i < values.length; i++) {

    const row = values[i];

    const leadId = row[1];
    const campaign = row[3];
    const detail = row[4];
    const leadSource = row[5];
    const category = row[6];
    const revenue = row[7];
    const currentSegment = row[8];
    const finalSegment = String(row[9] || "").trim();
    const reason = row[reasonColIndex] !== undefined ? String(row[reasonColIndex] || "").trim() : "";

    if (!finalSegment) {

      blankFinalCount++;

    } else {

      if (!byFinalSegment[finalSegment]) {
        byFinalSegment[finalSegment] = { count: 0, byCategory: {} };
      }

      byFinalSegment[finalSegment].count++;

      const categoryLabel = String(category || "(빈값)");
      byFinalSegment[finalSegment].byCategory[categoryLabel] =
        (byFinalSegment[finalSegment].byCategory[categoryLabel] || 0) + 1;

    }

    if (reason) {
      reasonRows.push({
        leadId: leadId, campaign: campaign, detail: detail, leadSource: leadSource,
        category: category, revenue: revenue, currentSegment: currentSegment,
        finalSegment: finalSegment, reason: reason
      });
    }

  }

  Logger.log("======================================");
  Logger.log("Analyze Search Catch-All QA");
  Logger.log("======================================");
  Logger.log("총 " + (values.length - 1) + "행 / Final Segment 미기입 " + blankFinalCount + "행");
  Logger.log("K열 헤더 라벨: \"" + reasonLabel + "\"");
  Logger.log("");

  Logger.log("---- Final Segment별 분포 (Lead Source Category 하위 breakdown 포함) ----");

  Object.keys(byFinalSegment)
    .sort(function (a, b) { return byFinalSegment[b].count - byFinalSegment[a].count; })
    .forEach(function (segment) {

      const info = byFinalSegment[segment];
      Logger.log("");
      Logger.log("[" + segment + "] 총 " + info.count + "건");

      Object.keys(info.byCategory)
        .sort(function (a, b) { return info.byCategory[b] - info.byCategory[a]; })
        .forEach(function (cat) {
          Logger.log("    - (" + info.byCategory[cat] + "건) Lead Source Category = \"" + cat + "\"");
        });

    });

  Logger.log("");
  Logger.log("---- K열(" + reasonLabel + ") 메모가 있는 행 전체 (" + reasonRows.length + "건) ----");

  reasonRows.forEach(function (r) {
    Logger.log(
      "Lead ID=" + r.leadId + " | campaign=\"" + r.campaign + "\" | category=\"" + r.category +
      "\" | leadSource=\"" + r.leadSource + "\" | revenue=" + r.revenue +
      " | 현재=" + r.currentSegment + " -> 최종=" + r.finalSegment +
      " | 이유=\"" + r.reason + "\""
    );
  });

  Logger.log("");
  Logger.log("======================================");
  Logger.log("Analysis Completed");
  Logger.log("======================================");

}


/**
 * ==========================================================
 * Run Export Search Catch-All QA Mapping (수동 실행용)
 *
 * WHY
 * runAnalyzeSearchCatchAllQA() 결과, 같은 Lead Source Category("Naver
 * online cafe" 등)가 Final Segment content/webinar/seminar로 제각각
 * 갈린 것으로 확인됨(2026-07-29) — 카테고리 단위 자동 규칙으로는 재현
 * 불가능하고, 사용자가 캠페인 하나하나를 Marketo 로그로 확인해 판단한
 * 것으로 보임. 다만 같은 캠페인(MKT UTM Campaign)이 여러 행(Leads_Master
 * 1행 + MTA_Master 터치 여러 행)에 반복 등장하는 경우 Final Segment가
 * 일관되는지(예: "youtube-acquisition-tofu_traffic" 4행 전부 content)
 * 확인해서, 캠페인 단위 override 테이블(BUSINESS_SEGMENT_EXCEPTIONS와
 * 동일 패턴, exact match)로 안전하게 하드코딩할 수 있는지 판단한다.
 *
 * 코드 변경 없음 — 순수 조회/로깅.
 * ==========================================================
 */
function runExportSearchCatchAllQAMapping() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SEARCH_CATCHALL_QA_SHEET);

  if (!sheet) {
    throw new Error(SEARCH_CATCHALL_QA_SHEET + " sheet not found. runBuildSearchCatchAllQA()를 먼저 실행하세요.");
  }

  const values = sheet.getDataRange().getValues();

  const byCampaign = {}; // lowercased campaign -> { label, segments: {segment: count}, total }

  for (let i = 1; i < values.length; i++) {

    const row = values[i];

    const campaignRaw = String(row[3] || "").trim();
    const finalSegment = String(row[9] || "").trim();

    if (!campaignRaw || !finalSegment) continue;

    const key = campaignRaw.toLowerCase();

    if (!byCampaign[key]) {
      byCampaign[key] = { label: campaignRaw, segments: {}, total: 0 };
    }

    byCampaign[key].total++;
    byCampaign[key].segments[finalSegment] = (byCampaign[key].segments[finalSegment] || 0) + 1;

  }

  const conflicts = [];
  const clean = [];

  Object.keys(byCampaign).forEach(function (key) {

    const info = byCampaign[key];
    const distinctSegments = Object.keys(info.segments);

    if (distinctSegments.length > 1) {
      conflicts.push(info);
    } else {
      clean.push({ label: info.label, segment: distinctSegments[0], total: info.total });
    }

  });

  Logger.log("======================================");
  Logger.log("Export Search Catch-All QA Mapping");
  Logger.log("======================================");
  Logger.log("고유 캠페인 수: " + Object.keys(byCampaign).length + " (211행 기준)");
  Logger.log("");

  Logger.log("---- 충돌(같은 캠페인, Final Segment 불일치) — " + conflicts.length + "건 ----");

  if (conflicts.length === 0) {
    Logger.log("없음 — 전부 캠페인 단위로 일관됨.");
  } else {
    conflicts.forEach(function (c) {
      Logger.log("\"" + c.label + "\" -> " + JSON.stringify(c.segments));
    });
  }

  Logger.log("");
  Logger.log("---- 캠페인 단위 매핑(일관됨, override 테이블 후보) — " + clean.length + "개 캠페인 ----");

  clean
    .sort(function (a, b) { return b.total - a.total; })
    .forEach(function (c) {
      Logger.log("(" + c.total + "건) \"" + c.label + "\" -> " + c.segment);
    });

  Logger.log("");
  Logger.log("======================================");
  Logger.log("Export Completed");
  Logger.log("======================================");

}


/**
 * ==========================================================
 * Write Search Catch-All QA Sheet
 * ==========================================================
 */
function writeSearchCatchAllQASheet_(rows) {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(SEARCH_CATCHALL_QA_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(SEARCH_CATCHALL_QA_SHEET);
  }

  sheet.clearContents();
  sheet.clearFormats();

  sheet.getRange(1, 1, 1, SEARCH_CATCHALL_QA_HEADERS.length)
    .setValues([SEARCH_CATCHALL_QA_HEADERS])
    .setFontWeight("bold");

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, SEARCH_CATCHALL_QA_HEADERS.length).setValues(rows);
  }

  sheet.setFrozenRows(1);

  SpreadsheetApp.flush();

}
