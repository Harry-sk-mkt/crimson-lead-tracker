/**
 * ==========================================================
 * Marketing 2.0
 * Search Engine (Aggregate Table)
 *
 * Responsibility
 * Leads_Master / MTA_Master / Leads_OPS 전체를 스캔하여 raw campaign
 * 값(MKT UTM Campaign/First MKT UTM Campaign 필드, Business Segment=
 * Search, 국가 필터 없음 — 사용자가 수동으로 판단) 기준으로 지표를 미리
 * 계산해 Search_Engine(숨김) 시트에 저장한다. 61_BOFU_Engine.js와 유사한
 * 패턴이나 매칭 필드/국가 필터는 다름 — Events/BOFU 코드는 수정하지
 * 않고(Article 5), 여기서 별도로 Search 전용 집계 함수를 둔다.
 *
 * ⚠️ 범용 헬퍼(stripRegistrationFormSuffix_, isKoreanProgram_,
 * isValidDate_)는 51_Events_Engine.js 정의를 재사용 — 재정의하지 않음.
 *
 * P1 판정은 BOFU와 동일하게 정확한 문자열 일치("Priority 1")를 쓴다
 * (Events의 substring 비교 버그 반복 방지, 61_BOFU_Engine.js 참고).
 *
 * 호출 시점
 * - appendNewLeads(), appendNewMTA()(syncMTAFunnelToOPS_ 경유)
 * - rebuildLeadsMaster(), rebuildMTAMaster()
 * (다른 Engine들과 동일한 4개 지점, 07/09/10 파일에 나란히 배선)
 *
 * Version
 * v1.14.0
 *
 * Change Log
 * v1.14.0 (2026-07-29)
 * - runClearSearchOPSMetaChannel() 추가(수동 실행용, 1회성) — 70_Search_
 *   Config.js v1.3.0의 CHANNEL_DEFAULT 공란화에 맞춰 Search_OPS에 이미
 *   있는 "Meta" 값을 일괄 공란 처리(신규 행에만 적용되는 기본값 변경으로는
 *   기존 행이 안 바뀌므로).
 * v1.13.0 (2026-07-29)
 * - resolveSearchEngineKey_()에 우선순위 0/0.5 추가: SEARCH_UTM_TO_PROGRAM_
 *   OVERRIDE(raw UTM→Marketo Program 정확 매핑, detail이 비어있는 터치라
 *   detail 기반 매칭이 안 걸리던 Naver SA 리드 7건 구제) + SEARCH_MERGE_
 *   INTO_ORGANIC_SEARCH("chatgpt.com"/"website-consultation-booking" 같은
 *   비정보성 UTM을 "Organic Search" 버킷으로 강제 병합). 사용자가 Search_OPS
 *   전체를 육안으로 재검토해 확정. 테스트 케이스 추가.
 * v1.12.0 (2026-07-29)
 * - resolveSearchEngineKey_() 재설계(Marketo Program 우선) + 신규
 *   resolveSearchChannelFromKey_() 추가 — Search_OPS에 raw UTM 대신 Naver
 *   SA/Google SA Marketo Program명을 표시하고 Channel도 Naver Search/
 *   Google Search로 구분(사용자 요청, "보여지는게 Marketo Program 이름이
 *   아니야" + "채널도 지금 전부 Meta인데 구분해야"). Lead Source Detail에
 *   "Naver SA"/"Google SA" 포함 시 그 값을 그대로 키로 사용 — 문자열 패턴
 *   매칭이라 향후 신규 프로그램도 하드코딩 없이 자동 포착(사용자 확인:
 *   어제부터 개별 프로그램으로 분류 시작, 향후 리드는 실제 Program명을
 *   달고 들어옴). raw UTM도 없고 Lead Source Category="Google Search Ads"
 *   면 "Google UTM" placeholder(과거 데이터용, 전용 프로그램이 없었던 시절
 *   대응). "2025-12-KOR-Naver SA & Google Ivy League"는 이름에 "Naver SA"가
 *   있지만 실제 채널은 Google이라고 사용자가 확인 — 예외 처리. 신규 테스트:
 *   testResolveSearchChannelFromKey(), testResolveSearchEngineKey() 케이스
 *   확장. aggregateSearchMTATouchRecords_/aggregateSearchLeadsRecords_ 호출
 *   시그니처 변경(campaign/leadSource 2개 → campaign/leadSource/detail/
 *   category 4개).
 * v1.11.1 (2026-07-29)
 * - testResolveSearchEngineKey_() → testResolveSearchEngineKey()로 리네임
 *   (끝에 "_" 있으면 Apps Script Run 드롭다운에 안 보이는 문제,
 *   docs/apps-script-gotchas.md #2 — 사용자가 즉시 발견해 수정).
 * v1.11.0 (2026-07-29)
 * - resolveSearchEngineKey_() 신규 — aggregateSearchMTATouchRecords_/
 *   aggregateSearchLeadsRecords_가 raw UTM Campaign이 비어있으면 그냥
 *   `if (!key) return`으로 행을 스킵해버려, Organic Search 542건(대부분
 *   campaign/detail 둘 다 없음, Revenue $4M+ 포함)이 Search_Engine/
 *   Search_OPS에 전혀 집계되지 않고 조용히 누락되고 있었음(사용자 발견,
 *   runInvestigateSearchBlankSignalRows() 실측 중 인지) — campaign이
 *   비어있으면 First Lead Source 값(예: "Organic Search"/"Paid Search")을
 *   임의 Marketo Campaign name으로 대체 사용하도록 수정(사용자 확정: 향후
 *   유사 신호-없음 케이스도 leadSource 값 그대로 자동 버킷화). 신규 테스트:
 *   testResolveSearchEngineKey().
 * v1.10.1 (2026-07-29)
 * - runInvestigateSearchGroupCLeadSourceCategory()에 UTM Campaign 유무
 *   집계(campaignPresentCount/campaignBlankCount) 추가 — 사용자 질문("이
 *   그룹이 다 Lead Source Detail/UTM이 없는 거지?") 확인용. Lead Source
 *   Detail은 이미 있음(범용 "Contact Us form" 값이라 문제)을 전제로, UTM
 *   Campaign은 카테고리별로 있음/없음 비율이 얼마나 되는지 로그에 추가.
 * v1.10.0 (2026-07-29)
 * - runInvestigateSearchGroupCLeadSourceCategory() 추가(1회성 진단, 수동
 *   실행용). 16_TransformHelper.js v1.9.0의 Content/nurture 재분류 적용 후
 *   여전히 Search로 남는 (c) 그룹(범용 "Contact Us form" 등 캐치올 폼, 신호
 *   없음)에 대해 사용자 질문(Lead Source Category에 "Naver Search"/"Google
 *   Search"가 있는지) 확인 — First Lead Source Category(Leads_Master)
 *   /Lead Source Category(MTA_Master)별 분포 + Revenue>0 여부 집계. 코드
 *   변경 없음, 순수 진단.
 * v1.9.0 (2026-07-29)
 * - runInvestigateSearchContentMisroute()/runInvestigateSearchBlankSignalRows()
 *   추가(1회성 진단, 수동 실행용). runInvestigateSearchProgramGrouping() 결과를
 *   보고 사용자가 지시한 3가지 확인 사항 대응: (1) "Crimson Education Contact
 *   Us form" 등 범용 캐치올 폼 때문에 nurture 이메일/ebook 캠페인까지 Search로
 *   뭉개지는 문제 — Content 키워드 기존 매칭분(순서만 바꾸면 해결)과
 *   "nurture" 신규 키워드 후보를 분리해서 진단, (2) 파트너십 프로그램은
 *   현재도 Other로 분류 중인 것 확인(코드 변경 없음, 사용자 확인용), (3)
 *   campaign/detail 둘 다 없는 Search 행(837건)의 First Lead Source 값 분포와
 *   Revenue 발생 여부 확인. 전부 코드 변경 없음(getBusinessSegment() 등 기존
 *   로직 그대로), 순수 진단.
 * v1.8.0 (2026-07-29)
 * - runInvestigateSearchProgramGrouping() 추가(1회성 진단, 수동 실행용).
 *   Search를 raw UTM 그레인에서 Marketo Program(Lead Source Detail) 그레인
 *   으로 전환하는 작업의 사전 조사 — 사용자가 Search_OPS에 search/sitelink가
 *   아닌 raw UTM이 너무 많다고 재확인(2026-07-29)하면서 2026-07-24의 raw UTM
 *   선택 결정을 재검토하기로 함. Business Segment=Search 행을 스캔해 (1)
 *   Lead Source Detail이 있는 그룹은 Program명 -> 매핑되는 raw UTM Campaign
 *   목록(건수 포함)을, (2) Lead Source Detail이 없는(직접 광고/상담폼) 행은
 *   raw UTM Campaign만 별도로 나열 — 그룹핑 로직 설계 전 실데이터 패턴 파악
 *   목적(사용자 지시). 코드 변경 없음(MATCH_FIELD/getBusinessSegment() 등
 *   기존 로직 그대로), 순수 진단.
 * v1.7.0 (2026-07-28)
 * - runDeleteDeadSearchOPSRows() 추가(수동 실행용). runAuditSearchSegmentIssues()
 *   Part 1로 확인된 죽은 키 116건(전부 수동 컬럼 완전 공백 확인) 삭제 —
 *   사용자 승인 후 실행. 24_OPSQA.js의 완전 동일 중복 삭제 함수들과 동일하게
 *   삭제 전 전체 목록 로그 → 내림차순 deleteRow() 패턴.
 * v1.6.0 (2026-07-28)
 * - runAuditSearchSegmentIssues() 추가(1회성 진단, 수동 실행용). 두 문제를
 *   한 번에 점검: (1) mergeSearchOPS_()의 합집합 병합 때문에 Business
 *   Segment가 바뀌어도 Search_OPS에 그대로 남는 죽은 키(수동 컬럼에 실제
 *   데이터가 있는지 여부까지 구분해서 표시), (2) 아직 Search로 분류돼
 *   값이 있는 것 중 ebook/guide 외의 콘텐츠성 키워드(webinar/checklist/
 *   workbook/practice test/quiz 등)가 감지되는 후보 그룹(자동 확정 아님,
 *   검토용). buildSearchOPS() 실행 후 22개 값이 전부 0으로 표시된 것을
 *   포함해 그 외 다수의 "_contact"/"ptc" 캠페인도 같은 죽은 키 패턴임을
 *   사용자가 발견 — 코드 변경 없음, 순수 진단.
 * v1.5.0 (2026-07-28)
 * - runInvestigateSearchMisclassifiedCampaigns() 성능 개선 — v1.4.0의 행별
 *   상세 로그 + O(N×M) 부분일치(includes) 재검색 방식이 MTA_Master(8만+행)
 *   기준 실행 시간이 너무 길고 로그가 과다 출력됨(사용자 보고, 실행 로그
 *   1분+ 후에도 끝 안 남) — 시트당 1회 스캔(O(N))으로 값별 총 건수/세그먼트
 *   분포/leadSource "search" 포함 여부만 집계하는 요약 전용 방식으로 교체.
 *   실측 결과(사용자 제공 샘플)로 가설 2(leadSource.includes("search")가
 *   Content보다 먼저 체크됨)가 실제로 발생 중임을 확인 — 예:
 *   detail="...Hyperlocalized ECL eBook", leadSource="Organic Search" →
 *   recomputed도 Search(라이브 버그, 레거시 아님). 규칙 수정은 전체 요약
 *   확인 후 별도 결정.
 * v1.4.0 (2026-07-28)
 * - runInvestigateSearchMisclassifiedCampaigns() 추가(1회성 진단, 수동 실행용).
 *   사용자가 Search_OPS에서 발견한 22개 캠페인/UTM 값(전부 content류: ebook/
 *   guide/on-demand/infographic 등)이 실제로 Business Segment=Search로 잘못
 *   찍히고 있는지, 어떤 필드 조합(특히 First Lead Source에 "search" 포함
 *   여부) 때문인지 Leads_Master/MTA_Master 원본 필드를 그대로 로그로 찍어
 *   확인하기 위함. 코드(getBusinessSegment()) 변경 없음 — 순수 진단.
 *   가설 2개: (1) Content 판정의 "on-demand"/"ondemand"/"webinar" 키워드가
 *   detail에만 체크되고 campaign은 체크 안 함(16_TransformHelper.js), (2)
 *   Search의 leadSource.includes("search")가 Content보다 먼저 체크됨.
 * v1.3.0 (2026-07-28)
 * - 코드 변경 없음 — Events_OPS/BOFU_OPS/Content_OPS의 #Deals/Revenue를
 *   Deal Tracker 기반으로 전환하는 2트랙 아키텍처 작업(CLAUDE.md #7) 중,
 *   Search_OPS는 raw UTM 그레인과 Deal Tracker의 프로그램 단위 Lead Source
 *   Detail이 안 맞아 예외 처리하기로 사용자 확인 — computeSearchFunnelAggregates_()
 *   상단에 사유 주석만 추가. 그대로 Leads_OPS 기준 유지. 상세: docs/Changelog.md
 *   2026-07-28.
 * v1.2.0 (2026-07-24)
 * - Country 필터 미적용을 최종 확정 (70_Search_Config.js v1.2.0 참고).
 *   실측 결과(260개 캠페인, revenue 있는 건 25개뿐) 자동 KOR/KR 판별 +
 *   대소문자/중괄호 정규화보다 사용자가 A열(hidden, MKT UTM Campaign
 *   원본)을 보고 직접 Marketo Program 매핑 + 한국 딜 여부 + 중복 캠페인
 *   정리를 수동으로 하는 편이 낫다고 판단(사용자 결정) — Business
 *   Segment=Search 필터만 유지, 추가 자동 필터/정규화 없음.
 * v1.1.0 (2026-07-24)
 * - MATCH_FIELD 변경(SEARCH.MATCH_FIELD, 70_Search_Config.js 참고)에 맞춰
 *   aggregateSearchMTATouchRecords_/aggregateSearchLeadsRecords_가 이제
 *   MKT UTM Campaign/First MKT UTM Campaign 값을 그룹핑 키로 사용.
 * - isKoreanProgram_() 호출 제거 — 이 필터는 Marketo Program 이름
 *   (TYPE-YYYY-MM-COUNTRY-...)의 4번째 토큰 위치를 가정하는데, raw MKT
 *   UTM Campaign 문자열은 이 구조를 따르지 않아(국가 토큰 위치가 다르거나
 *   아예 없음) 실제 KOR 리드 대부분이 걸러지는 문제 발견.
 * ==========================================================
 */


/**
 * ==========================================================
 * Refresh Search Engine (전체 재계산)
 * ==========================================================
 */
function refreshSearchEngine_() {

  const start = new Date();

  Logger.log(CONFIG.LOG.PREFIX + " Search Engine Refresh Started");

  const mtaAgg = computeSearchMTAAggregates_();
  const leadsAgg = computeSearchLeadsAggregates_();
  const funnelAgg = computeSearchFunnelAggregates_(leadsAgg.leadIdToKey);

  const allKeys = {};

  [
    mtaAgg.allRegistered, mtaAgg.p1All,
    leadsAgg.newRegistered, leadsAgg.nlP1,
    funnelAgg.icRequest, funnelAgg.icBooked,
    funnelAgg.icComplete, funnelAgg.dealsWon, funnelAgg.revenue
  ].forEach(function (map) {
    Object.keys(map).forEach(function (key) {
      allKeys[key] = true;
    });
  });

  const rows = Object.keys(allKeys).map(function (key) {

    return [
      key,
      mtaAgg.allRegistered[key] || 0,
      leadsAgg.newRegistered[key] || 0,
      mtaAgg.p1All[key] || 0,
      leadsAgg.nlP1[key] || 0,
      funnelAgg.icRequest[key] || 0,
      funnelAgg.icBooked[key] || 0,
      funnelAgg.icComplete[key] || 0,
      funnelAgg.dealsWon[key] || 0,
      funnelAgg.revenue[key] || 0
    ];

  });

  writeSearchEngine_(rows);

  const seconds = ((new Date() - start) / 1000).toFixed(2);

  Logger.log(
    CONFIG.LOG.PREFIX + " Search Engine Refresh Completed : " +
    rows.length + " rows (" + seconds + "s)"
  );

}


/**
 * ==========================================================
 * Is Effective Search P1 (정확한 문자열 일치)
 *
 * TEST
 * testIsEffectiveSearchP1_ 참고
 * ==========================================================
 */
function isEffectiveSearchP1_(leadPriority) {

  return String(leadPriority || "").trim() === "Priority 1";

}


/**
 * ==========================================================
 * TEST — isEffectiveSearchP1_()
 * ==========================================================
 */
function testIsEffectiveSearchP1_() {

  const pass =
    isEffectiveSearchP1_("Priority 1") === true &&
    isEffectiveSearchP1_("Priority 10") === false &&
    isEffectiveSearchP1_("Priority 2") === false &&
    isEffectiveSearchP1_("") === false;

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Search UTM → Marketo Program Override Map (2026-07-29)
 *
 * WHY
 * Naver SA 프로그램으로 재분류된 리드 중 일부는 MTA 터치 자체엔 Lead
 * Source Detail이 비어있어(같은 사람의 다른 터치에만 Program명이 찍힘)
 * detail 기반 매칭(resolveSearchEngineKey_ 우선순위 1)이 안 걸림 —
 * 사용자가 Search_OPS를 육안 검토해 "이 raw UTM은 사실 이 Program"이라고
 * 직접 확인해준 매핑을 정확 매칭으로 반영.
 * ==========================================================
 */
const SEARCH_UTM_TO_PROGRAM_OVERRIDE = {
  "kr_core_2021-04-01_search-kr_tier1-college-specific_contact": "2025-12-KOR-Naver SA & Google Ivy League",
  "kr_core_transfer-gap-year-kr": "2025-11-KOR-Naver SA Transfer and Gap Year",
  "kr_core_2025-07-03_brand": "2025-07-KOR-Naver SA Brand",
  "{kr_core_brand_contact}": "2025-07-KOR-Naver SA Brand",
  "{kr_core_ecl-consult_contact}": "2025-07-KOR-Naver SA ECL",
  "{kr_core_competitors_contact}": "2025-07-KOR-Naver SA Competitor",
  "kr_core_study-abroad_contact": "2025-07-KOR-Naver SA Study Consultants US"
};

/**
 * ==========================================================
 * Search Non-Informative UTM → Organic Search Bucket (2026-07-29)
 *
 * WHY
 * "chatgpt.com"(AI 검색 리퍼러 도메인이 UTM 자리에 그대로 들어온 것),
 * "website-consultation-booking"(자체 웹사이트 상담 예약 폼) — 둘 다
 * 실제 캠페인 슬러그가 아니라 raw UTM 자리에 우연히 들어간 비정보성
 * 값이라, 개별 키로 남기지 말고 "Organic Search" 버킷으로 합치기로
 * 사용자 확정.
 * ==========================================================
 */
const SEARCH_MERGE_INTO_ORGANIC_SEARCH = ["chatgpt.com", "website-consultation-booking"];

/**
 * ==========================================================
 * Resolve Search Engine Key (Marketo Program 우선, 2026-07-29 재설계)
 *
 * WHY
 * 2026-07-29: Search를 raw UTM 그레인에서 부분적으로 프로그램화 — 사용자가
 * Marketo에 Naver SA/Google SA 개별 프로그램을 신설(어제부터 개별 프로그램
 * 으로 분류 시작, 향후 리드는 실제 Program명을 달고 들어옴). Lead Source
 * Detail에 "Naver SA"/"Google SA"가 포함되면 raw UTM 대신 그 Program명을
 * 그대로 키로 사용 — 문자열 패턴 매칭이라 향후 신규 프로그램도 하드코딩
 * 없이 자동으로 잡힘.
 *
 * 우선순위:
 * 0) raw UTM Campaign이 SEARCH_UTM_TO_PROGRAM_OVERRIDE에 있음 → 매핑된
 *    Program명(사용자 육안 검토로 확정, detail이 비어있는 터치 구제)
 * 0.5) raw UTM Campaign이 SEARCH_MERGE_INTO_ORGANIC_SEARCH에 있음(예:
 *    "chatgpt.com") → "Organic Search" 버킷으로 강제 병합
 * 1) Lead Source Detail에 "Naver SA"/"Google SA" 포함 → Program명 그대로
 * 2) raw UTM Campaign 있음 → 기존처럼 그대로 사용(stripRegistrationFormSuffix_)
 * 3) UTM도 없고 Lead Source Category="Google Search Ads" → "Google UTM"
 *    placeholder(사용자 확정 — Google Search Ads는 전용 프로그램이 없던
 *    과거 데이터용 임시 버킷)
 * 4) 그 외 — First Lead Source 값으로 fallback(2026-07-29 최초 도입분,
 *    "Organic Search"/"Paid Search" 등). raw UTM Campaign이 비어있는 Search
 *    리드(예: campaign/detail 둘 다 없는 542건)가 기존엔 key가 빈 값이라
 *    aggregateSearchMTATouchRecords_/aggregateSearchLeadsRecords_의
 *    `if (!key) return;`에서 스킵돼 Search_Engine/Search_OPS에 전혀
 *    집계되지 않고 있었음(사용자 발견, Revenue $4M+ 포함) — 이 fallback으로
 *    해결.
 * ==========================================================
 */
function resolveSearchEngineKey_(campaignRaw, leadSourceRaw, detailRaw, categoryRaw) {

  const campaignLower = String(campaignRaw || "").trim().toLowerCase();

  if (SEARCH_UTM_TO_PROGRAM_OVERRIDE[campaignLower]) {
    return SEARCH_UTM_TO_PROGRAM_OVERRIDE[campaignLower];
  }

  if (SEARCH_MERGE_INTO_ORGANIC_SEARCH.indexOf(campaignLower) !== -1) {
    return "Organic Search";
  }

  const detail = String(detailRaw || "").trim();
  const detailLower = detail.toLowerCase();

  if (detailLower.includes("naver sa") || detailLower.includes("google sa")) {
    return detail;
  }

  const campaignKey = stripRegistrationFormSuffix_(campaignRaw);

  if (campaignKey) return campaignKey;

  const category = String(categoryRaw || "").trim().toLowerCase();

  if (category === "google search ads") return "Google UTM";

  return String(leadSourceRaw || "").trim();

}


/**
 * ==========================================================
 * TEST — resolveSearchEngineKey_()
 * ==========================================================
 */
function testResolveSearchEngineKey() {

  const pass =
    resolveSearchEngineKey_("{KR_core_brand_contact}", "Organic Search", "2025-07-KOR-Naver SA Brand", "Naver Search Ads") === "2025-07-KOR-Naver SA Brand" &&
    resolveSearchEngineKey_("search-kr_tier1-college-specific_contact", "Paid Search", "2025-12-KOR-Naver SA & Google Ivy League", "Naver Search Ads") === "2025-12-KOR-Naver SA & Google Ivy League" &&
    resolveSearchEngineKey_("2025-07-KOR-Naver SA Brand", "Organic Search", "", "") === "2025-07-KOR-Naver SA Brand" &&
    resolveSearchEngineKey_("", "Paid Search", "", "Google Search Ads") === "Google UTM" &&
    resolveSearchEngineKey_("", "Organic Search", "", "") === "Organic Search" &&
    resolveSearchEngineKey_(null, "Paid Search", "", "") === "Paid Search" &&
    resolveSearchEngineKey_("", "", "", "") === "" &&

    // 2026-07-29 추가 — UTM→Program override(detail 비어있는 터치 구제)
    resolveSearchEngineKey_("KR_core_2025-07-03_brand", "Organic Search", "", "") === "2025-07-KOR-Naver SA Brand" &&
    resolveSearchEngineKey_("{KR_core_ecl-consult_contact}", "", "", "") === "2025-07-KOR-Naver SA ECL" &&
    resolveSearchEngineKey_("KR_core_transfer-gap-year-kr", "", "", "") === "2025-11-KOR-Naver SA Transfer and Gap Year" &&

    // 2026-07-29 추가 — 비정보성 UTM → Organic Search 병합
    resolveSearchEngineKey_("chatgpt.com", "", "", "") === "Organic Search" &&
    resolveSearchEngineKey_("website-consultation-booking", "Organic Search", "", "") === "Organic Search";

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Resolve Search Channel From Key (2026-07-29)
 *
 * WHY
 * resolveSearchEngineKey_()가 만든 키(Naver/Google SA Program명 또는
 * "Google UTM" placeholder)로부터 Channel을 결정 — 신규 Search_OPS 행
 * 생성 시(73_Search_Merge.js applySearchNewRowDefaults_) 무조건 "Meta"
 * 기본값을 쓰던 걸 실제 채널로 교체(사용자 확정). "2025-12-KOR-Naver SA &
 * Google Ivy League"는 이름에 "Naver SA"가 들어있지만 실제로는 Google
 * 채널이라고 사용자가 확인(예외 처리).
 * ==========================================================
 */
function resolveSearchChannelFromKey_(key) {

  const k = String(key || "").trim().toLowerCase();

  if (!k) return SEARCH.CHANNEL_DEFAULT;

  if (k === "2025-12-kor-naver sa & google ivy league") return "Google Search";
  if (k.includes("google sa")) return "Google Search";
  if (k.includes("naver sa")) return "Naver Search";
  if (k === "google utm") return "Google Search";

  return SEARCH.CHANNEL_DEFAULT;

}


/**
 * ==========================================================
 * TEST — resolveSearchChannelFromKey_()
 * ==========================================================
 */
function testResolveSearchChannelFromKey() {

  const pass =
    resolveSearchChannelFromKey_("2025-07-KOR-Naver SA Brand") === "Naver Search" &&
    resolveSearchChannelFromKey_("2025-11-KOR-Naver SA Transfer and Gap Year") === "Naver Search" &&
    resolveSearchChannelFromKey_("2025-12-KOR-Naver SA & Google Ivy League") === "Google Search" &&
    resolveSearchChannelFromKey_("Google UTM") === "Google Search" &&
    resolveSearchChannelFromKey_("KR_core_2021-04-01_search-kr_tier1-college-specific_contact") === SEARCH.CHANNEL_DEFAULT &&
    resolveSearchChannelFromKey_("Organic Search") === SEARCH.CHANNEL_DEFAULT &&
    resolveSearchChannelFromKey_("") === SEARCH.CHANNEL_DEFAULT;

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Search MTA Aggregates (SF Reg. / SF P1s)
 *
 * TEST
 * testComputeSearchMTAAggregates_ 참고
 * ==========================================================
 */
function computeSearchMTAAggregates_() {

  const allRegistered = {};
  const p1All = {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);

  if (!sheet) return { allRegistered, p1All };

  aggregateSearchMTATouchRecords_(sheetToObjects(sheet), allRegistered, p1All);

  return { allRegistered, p1All };

}


/**
 * ==========================================================
 * Aggregate Search MTA Touch Records (순수 함수, 테스트용으로 분리)
 * ==========================================================
 */
function aggregateSearchMTATouchRecords_(records, allRegistered, p1All) {

  records.forEach(function (r) {

    if (SEARCH.SEGMENTS.indexOf(r["Business Segment"]) === -1) return;

    const key = resolveSearchEngineKey_(
      r[SEARCH.MATCH_FIELD.MTA], r["First Lead Source"], r["Lead Source Detail"], r["Lead Source Category"]
    );

    if (!key) return;

    allRegistered[key] = (allRegistered[key] || 0) + 1;

    if (isEffectiveSearchP1_(r["Lead Priority"])) {
      p1All[key] = (p1All[key] || 0) + 1;
    }

  });

}


/**
 * ==========================================================
 * TEST — aggregateSearchMTATouchRecords_()
 * ==========================================================
 */
function testComputeSearchMTAAggregates_() {

  const records = [
    { "Business Segment": "Search", "MKT UTM Campaign": "2025-07-KOR-Naver SA Study Consultants US", "Lead Priority": "Priority 1" },
    { "Business Segment": "Search", "MKT UTM Campaign": "2025-07-KOR-Naver SA Study Consultants US", "Lead Priority": "Priority 2" },
    { "Business Segment": "BOFU", "MKT UTM Campaign": "WF-2025-07-KOR-BOFU-Core B", "Lead Priority": "Priority 1" } // segment 필터로 제외
  ];

  const allRegistered = {};
  const p1All = {};

  aggregateSearchMTATouchRecords_(records, allRegistered, p1All);

  const pass =
    allRegistered["2025-07-KOR-Naver SA Study Consultants US"] === 2 &&
    p1All["2025-07-KOR-Naver SA Study Consultants US"] === 1 &&
    Object.keys(allRegistered).length === 1;

  Logger.log("Result: " + JSON.stringify({ allRegistered, p1All }));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Search Leads Aggregates (SF NL / SF NLP1s)
 *
 * TEST
 * testComputeSearchLeadsAggregates_ 참고
 * ==========================================================
 */
function computeSearchLeadsAggregates_() {

  const newRegistered = {};
  const nlP1 = {};
  const leadIdToKey = {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS_MASTER);

  if (!sheet) return { newRegistered, nlP1, leadIdToKey };

  aggregateSearchLeadsRecords_(sheetToObjects(sheet), newRegistered, nlP1, leadIdToKey);

  return { newRegistered, nlP1, leadIdToKey };

}


/**
 * ==========================================================
 * Aggregate Search Leads Records (순수 함수, 테스트용으로 분리)
 * ==========================================================
 */
function aggregateSearchLeadsRecords_(records, newRegistered, nlP1, leadIdToKey) {

  records.forEach(function (r) {

    if (SEARCH.SEGMENTS.indexOf(r["Business Segment"]) === -1) return;

    const key = resolveSearchEngineKey_(
      r[SEARCH.MATCH_FIELD.LEADS], r["First Lead Source"], r["First Touch Detail"], r["First Lead Source Category"]
    );

    if (!key) return;

    newRegistered[key] = (newRegistered[key] || 0) + 1;

    if (isEffectiveSearchP1_(r["Lead Priority"])) {
      nlP1[key] = (nlP1[key] || 0) + 1;
    }

    const leadId = String(r["Lead ID"] || "").trim();

    if (leadId) {
      leadIdToKey[leadId] = key;
    }

  });

}


/**
 * ==========================================================
 * TEST — aggregateSearchLeadsRecords_()
 * ==========================================================
 */
function testComputeSearchLeadsAggregates_() {

  const records = [
    { "Business Segment": "Search", "First MKT UTM Campaign": "2025-07-KOR-Naver SA Study Consultants US", "Lead Priority": "Priority 1", "Lead ID": "L1" },
    { "Business Segment": "BOFU", "First MKT UTM Campaign": "2025-07-KOR-Naver SA Study Consultants US", "Lead Priority": "Priority 1", "Lead ID": "L2" } // segment 필터로 제외
  ];

  const newRegistered = {};
  const nlP1 = {};
  const leadIdToKey = {};

  aggregateSearchLeadsRecords_(records, newRegistered, nlP1, leadIdToKey);

  const pass =
    newRegistered["2025-07-KOR-Naver SA Study Consultants US"] === 1 &&
    nlP1["2025-07-KOR-Naver SA Study Consultants US"] === 1 &&
    leadIdToKey["L1"] === "2025-07-KOR-Naver SA Study Consultants US" &&
    leadIdToKey["L2"] === undefined;

  Logger.log("Result: " + JSON.stringify({ newRegistered, nlP1, leadIdToKey }));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute Search Funnel Aggregates (IC Request/Booked/Complete/Deals/Revenue)
 *
 * ⚠️ 2트랙 아키텍처 예외 (2026-07-28, 사용자 확인)
 * Events_OPS/BOFU_OPS/Content_OPS는 #Deals/Revenue를 Deal Tracker 기반으로
 * 전환했지만(CLAUDE.md #7), Search_OPS는 이번 전환에서 **제외**한다 — 그대로
 * Leads_OPS(Opportunity Won Date/Revenue) 기준 유지. 이유: Search_OPS는
 * raw UTM 단위(프로그램당 수십 개 행)로 그레인이 세분화되어 있는데, Deal
 * Tracker는 프로그램 단위 "Lead Source Detail"만 보유해 그대로 매칭하면
 * 같은 프로그램을 공유하는 여러 UTM 행이 동일 #Deals/Revenue를 중복으로
 * 받게 된다. Marketo 프로그램→UTM 수동 매핑이 필요한 별도 작업이라 이번
 * 라운드에서는 예외 처리하기로 사용자가 확인함 — 코드 변경 없음.
 *
 * TEST
 * testComputeSearchFunnelAggregates_ 참고
 * ==========================================================
 */
function computeSearchFunnelAggregates_(leadIdToKey) {

  const icRequest = {};
  const icBooked = {};
  const icComplete = {};
  const dealsWon = {};
  const revenue = {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(OPS.SHEET.OPS);

  if (!sheet) return { icRequest, icBooked, icComplete, dealsWon, revenue };

  aggregateSearchFunnelRecords_(
    sheetToObjects(sheet),
    leadIdToKey,
    icRequest, icBooked, icComplete, dealsWon, revenue
  );

  return { icRequest, icBooked, icComplete, dealsWon, revenue };

}


/**
 * ==========================================================
 * Aggregate Search Funnel Records (순수 함수, 테스트용으로 분리)
 * ==========================================================
 */
function aggregateSearchFunnelRecords_(opsRecords, leadIdToKey, icRequest, icBooked, icComplete, dealsWon, revenue) {

  opsRecords.forEach(function (r) {

    const leadId = String(r["Lead ID"] || "").trim();

    if (!leadId) return;

    const key = leadIdToKey[leadId];

    if (!key) return;

    if ((Number(r["Total IC Requests"]) || 0) > 0) {
      icRequest[key] = (icRequest[key] || 0) + 1;
    }

    if (isValidDate_(r["IC Booked Date"])) {
      icBooked[key] = (icBooked[key] || 0) + 1;
    }

    if (isValidDate_(r["IC Completed Date"])) {
      icComplete[key] = (icComplete[key] || 0) + 1;
    }

    if (isValidDate_(r["Opportunity Won Date"])) {
      dealsWon[key] = (dealsWon[key] || 0) + 1;
    }

    revenue[key] = (revenue[key] || 0) + (Number(r["Revenue"]) || 0);

  });

}


/**
 * ==========================================================
 * TEST — aggregateSearchFunnelRecords_()
 * ==========================================================
 */
function testComputeSearchFunnelAggregates_() {

  const leadIdToKey = { "L1": "SR-2025-07-KOR-MOFU-Core A" };

  const opsRecords = [
    { "Lead ID": "L1", "Total IC Requests": 1, "IC Booked Date": new Date(2026, 0, 1), "IC Completed Date": "", "Opportunity Won Date": "", "Revenue": 500 },
    { "Lead ID": "L2", "Total IC Requests": 1, "IC Booked Date": new Date(2026, 0, 1), "IC Completed Date": "", "Opportunity Won Date": "", "Revenue": 999 } // leadIdToKey에 없음 → 제외
  ];

  const icRequest = {}, icBooked = {}, icComplete = {}, dealsWon = {}, revenue = {};

  aggregateSearchFunnelRecords_(opsRecords, leadIdToKey, icRequest, icBooked, icComplete, dealsWon, revenue);

  const pass =
    icRequest["SR-2025-07-KOR-MOFU-Core A"] === 1 &&
    icBooked["SR-2025-07-KOR-MOFU-Core A"] === 1 &&
    revenue["SR-2025-07-KOR-MOFU-Core A"] === 500 &&
    Object.keys(revenue).length === 1;

  Logger.log("Result: " + JSON.stringify({ icRequest, icBooked, icComplete, dealsWon, revenue }));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Write Search Engine to Sheet (없으면 생성, 숨김 유지)
 * ==========================================================
 */
function writeSearchEngine_(rows) {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(SEARCH.SHEET.ENGINE);

  if (!sheet) {
    sheet = ss.insertSheet(SEARCH.SHEET.ENGINE);
  }

  sheet.clearContents();

  sheet.getRange(1, 1, 1, SEARCH_ENGINE_HEADERS.length)
    .setValues([SEARCH_ENGINE_HEADERS]);

  if (rows.length > 0) {

    sheet.getRange(2, 1, rows.length, SEARCH_ENGINE_HEADERS.length)
      .setValues(rows);

  }

  sheet.hideSheet();

  SpreadsheetApp.flush();

}


/**
 * ==========================================================
 * Read Search Engine as Lookup Map (key → Row Object)
 * ==========================================================
 */
function readSearchEngineMap_() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SEARCH.SHEET.ENGINE);

  const map = {};

  if (!sheet) return map;

  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) return map;

  const headers = values[0];

  for (let i = 1; i < values.length; i++) {

    const row = values[i];
    const key = String(row[0] || "").trim();

    if (!key) continue;

    const obj = {};

    headers.forEach(function (header, c) {
      obj[String(header).trim()] = row[c];
    });

    map[key] = obj;

  }

  return map;

}


/**
 * ==========================================================
 * Manual-run public wrapper (Apps Script 편집기 Run 드롭다운 노출용)
 * ==========================================================
 */
function runRefreshSearchEngine() {

  refreshSearchEngine_();

}


/**
 * ==========================================================
 * Investigate Search Program Count (1회성 진단, 수동 실행용)
 *
 * WHY
 * BOFU 실데이터 검증(133개, TYPE 필터 불필요) 패턴 재사용 — Search도
 * Business Segment 필터만으로 캠페인 수가 상식적인지 확인.
 *
 * 2026-07-24: MATCH_FIELD를 MKT UTM Campaign 기준으로 변경 후 실측
 * 결과(260개, revenue 있는 건 25개뿐) 국가 필터는 적용하지 않기로
 * 확정(70_Search_Config.js v1.2.0 참고, 사용자 결정) — "KOR" 포함 여부
 * 출력은 참고용 진단으로만 유지.
 * ==========================================================
 */
function runInvestigateSearchProgramCount() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SEARCH.SHEET.ENGINE);

  if (!sheet) {
    throw new Error(SEARCH.SHEET.ENGINE + " sheet not found. runRefreshSearchEngine()를 먼저 실행하세요.");
  }

  const values = sheet.getDataRange().getValues();

  const keys = [];

  for (let i = 1; i < values.length; i++) {
    const key = String(values[i][0] || "").trim();
    if (key) keys.push(key);
  }

  const withKor = keys.filter(function (k) { return k.toUpperCase().indexOf("KOR") !== -1; });
  const withoutKor = keys.filter(function (k) { return k.toUpperCase().indexOf("KOR") === -1; });

  Logger.log("======================================");
  Logger.log("Search Program Count Investigation");
  Logger.log("======================================");
  Logger.log("Total campaigns (Search_Engine rows) : " + keys.length);
  Logger.log("Contains \"KOR\" (substring)           : " + withKor.length);
  Logger.log("No \"KOR\" (substring)                 : " + withoutKor.length);
  Logger.log("");
  Logger.log("---- \"KOR\" 없는 값 샘플 20개 (국가 필터 결정 참고용) ----");

  withoutKor.slice(0, 20).forEach(function (key) {
    Logger.log(key);
  });

  Logger.log("");
  Logger.log("---- 전체 샘플 30개 ----");

  keys.slice(0, 30).forEach(function (key) {
    Logger.log(key);
  });

}


/**
 * ==========================================================
 * Investigate Search Misclassified Campaigns (1회성 진단, 수동 실행용)
 *
 * WHY
 * 사용자가 Search_OPS를 검토하다가 content류(ebook/guide/on-demand/
 * infographic 등) 캠페인/UTM 값이 Business Segment=Search로 분류돼 있는
 * 것 같다고 발견(2026-07-28). 코드를 바로 고치기 전에, 이 값들이 실제
 * Leads_Master/MTA_Master에서 어떤 campaign/detail/leadSource/category
 * 조합으로 들어와 있고 현재 저장된 Business Segment가 뭔지 원본 그대로
 * 로그로 확인한다 — 규칙 수정은 이 결과를 보고 별도로 결정.
 *
 * 코드 변경 없음(getBusinessSegment() 등 기존 로직 그대로) — 순수 조회/로깅.
 * ==========================================================
 */
function runInvestigateSearchMisclassifiedCampaigns() {

  const SUSPECT_VALUES = [
    "EM-2026-03-KOR-TOFU-Core EXPO Nurture Emails",
    "WF-2021-09-KOR-MOFU-Core Hyperlocalized ECL eBook",
    "WF-2023-12-KOR-MOFU-Core The Ultimate US Admissions Guide for Parents 2023",
    "WF-2023-02-KOR-MOFU-Core 5 Ways To Build Stand-Out ECL ebook",
    "WF-2025-03-KOR-MOFU-Core 2025 Admission Trends On-Demand",
    "WF-2022-12-KOR-MOFU-Core College research:US Top 20 Universities 15Mins On-Demand",
    "WF-2021-12-KOR-MOFU-Core Mini SAT practice ebook",
    "WF-2022-06-KOR-MOFU-Core ECL On Demand (Vietname Webinar)",
    "WF-2023-05-KOR-MOFU-Core Mini Digital SAT Practice Test 2023",
    "WF-2022-06-KOR-MOFU-Core Hyperlocal Case Study eBook",
    "WF-2022-11-KOR-MOFU-Core New Digital Mini SAT Practice Test",
    "WF-2022-12-KOR-MOFU-Core Admission Strategy for Young Students 15Mins On-Demand",
    "WF-2022-10-KOR-MOFU-Core Hyperlocalized FAQ with FAO for US ebook",
    "WF-2023-01-KOR-MOFU-Core US University Admissions for International School Students",
    "WF-2022-05-KOR-MOFU-Core Hyperlocalized Korean Students US Top 5 eBook",
    "WF-2023-02-KOR-MOFU-Core Hyperlocalized Canada eBook",
    "WF-2022-02-KOR-MOFU-Core Major Selection On Demand",
    "WF-2022-11-KOR-MOFU-Core Hyperlocalized Boarding School eBook",
    "WF-2023-06-KOR-MOFU-Core Chat GPT Webinar with Veronica Schrenk On-Demand",
    "WF-2023-05-KOR-MOUF-Core Mini Digital SAT Practice Test 2023",
    "WF-2023-04-KOR-MOFU-Core Hyperlocalized Korean Army Infographic",
    "WF-2022-06-KOR-MOFU-Core Supercurriculars for UK eBook"
  ];

  const summary = {};

  SUSPECT_VALUES.forEach(function (v) {
    summary[v.trim().toLowerCase()] = {
      label: v,
      total: 0,
      bySegment: {},
      searchViaLeadSource: 0,
      searchOtherReason: 0
    };
  });

  //----------------------------------------------------------
  // 시트당 1회 스캔(O(N)) — campaign 또는 detail이 대상 값과
  // 일치하는 행만 집계. 이전 버전의 O(N×M) 부분일치 재검색은
  // 실행 시간이 너무 길어(사용자 보고) 제거.
  //----------------------------------------------------------

  function scan(sheet, campaignField, detailField) {

    if (!sheet) return;

    sheetToObjects(sheet).forEach(function (r) {

      const campaign = String(r[campaignField] || "").trim().toLowerCase();
      const detail = String(r[detailField] || "").trim().toLowerCase();

      const s = summary[campaign] || summary[detail];

      if (!s) return;

      s.total++;

      const segment = r["Business Segment"] || "(빈값)";

      s.bySegment[segment] = (s.bySegment[segment] || 0) + 1;

      if (segment === "Search") {

        const leadSource = String(r["First Lead Source"] || "").toLowerCase();

        if (leadSource.includes("search")) {
          s.searchViaLeadSource++;
        } else {
          s.searchOtherReason++;
        }

      }

    });

  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  Logger.log("======================================");
  Logger.log("Investigate Search Misclassified Campaigns (요약)");
  Logger.log("======================================");

  scan(ss.getSheetByName(CONFIG.SHEETS.LEADS_MASTER), "First MKT UTM Campaign", "First Touch Detail");
  scan(ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER), "MKT UTM Campaign", "Lead Source Detail");

  Object.keys(summary).forEach(function (key) {

    const s = summary[key];

    if (s.total === 0) {
      Logger.log("\"" + s.label + "\" — 매칭 없음 (Leads_Master/MTA_Master 어디에도 없음)");
      return;
    }

    Logger.log(
      "\"" + s.label + "\" — 총 " + s.total + "건 / 세그먼트별: " + JSON.stringify(s.bySegment) +
      (s.bySegment["Search"]
        ? "  [Search 중 leadSource에 'search' 포함=" + s.searchViaLeadSource + ", 그 외 원인=" + s.searchOtherReason + "]"
        : "")
    );

  });

  Logger.log("");
  Logger.log("======================================");
  Logger.log("Investigation Completed");
  Logger.log("======================================");

}


/**
 * ==========================================================
 * Audit Search Segment Issues (1회성 진단, 수동 실행용)
 *
 * WHY
 * Search_OPS 정리 작업(2026-07-28) 중 사용자가 발견한 두 가지 별개 문제를
 * 한 번에 점검하기 위함:
 * (1) 죽은 키 — mergeSearchOPS_()(73_Search_Merge.js)가 "현재 Engine 키 ∪
 *     기존 Search_OPS 키"로 합치기 때문에, 한 번 Search_OPS에 들어간 키는
 *     이후 Business Segment가 바뀌어 Search_Engine에서 사라져도 Search_OPS엔
 *     그대로 남아 지표만 0으로 표시됨(오늘 수정한 22개 값 + 그 외 다수의
 *     "_contact"/"ptc"/"consult" 캠페인에서 실측 확인). 수동 컬럼(PIC/
 *     Marketo Campaign name/Channel/Impressions/Spent 등)에 실제 데이터가
 *     있는지 여부로 "완전 공백(삭제 안전)" vs "데이터 있음(검토 필요)" 구분.
 * (2) 아직 살아있는(값이 0이 아닌) Search 분류 중에서도, ebook/guide 외에
 *     아직 못 잡은 콘텐츠성 키워드(webinar/checklist/workbook/practice test/
 *     quiz 등)가 campaign/detail에 포함된 그룹을 후보로 나열 — 자동 재분류가
 *     아니라 사람이 검토할 후보 목록.
 *
 * 코드 변경 없음(getBusinessSegment() 등 기존 로직 그대로) — 순수 진단.
 * ==========================================================
 */
function runAuditSearchSegmentIssues() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  Logger.log("======================================");
  Logger.log("Audit Search Segment Issues");
  Logger.log("======================================");

  //----------------------------------------------------------
  // Part 1 — Search_OPS 죽은 키 (현재 Search_Engine에 없는 키)
  //----------------------------------------------------------

  const engineSheet = ss.getSheetByName(SEARCH.SHEET.ENGINE);
  const opsSheet = ss.getSheetByName(SEARCH.SHEET.OPS);

  const liveKeys = {};

  if (engineSheet) {

    sheetToObjects(engineSheet).forEach(function (r) {
      const key = String(r["Lead Source Detail"] || "").trim().toLowerCase();
      if (key) liveKeys[key] = true;
    });

  }

  Logger.log("");
  Logger.log("---- Part 1: Search_OPS 죽은 키 (Search_Engine에 더 이상 없음) ----");

  let deadCount = 0;
  let deadWithManualData = 0;

  if (opsSheet) {

    const opsRows = readSearchOPS_();
    const manualCols = SEARCH.GROUP_1_MANUAL.concat(SEARCH.GROUP_2_MANUAL).concat(SEARCH.GROUP_3_MANUAL);

    opsRows.forEach(function (row) {

      const key = String(row[SEARCH.KEY] || "").trim();

      if (!key) return;
      if (liveKeys[key.toLowerCase()]) return; // 살아있음 — 스킵

      deadCount++;

      const manualValues = {};
      let hasManualData = false;

      manualCols.forEach(function (col) {

        const v = row[col];
        manualValues[col] = v;

        if (col === "Channel") return; // 신규 행 기본값(CHANNEL_DEFAULT)이 항상 채워지므로 별도 판단

        if (v !== "" && v !== 0 && v !== undefined && v !== null) {
          hasManualData = true;
        }

      });

      const channelValue = String(row["Channel"] || "");

      if (channelValue && channelValue !== SEARCH.CHANNEL_DEFAULT) {
        hasManualData = true;
      }

      if (hasManualData) deadWithManualData++;

      Logger.log(
        (hasManualData ? "⚠️ [데이터 있음] " : "   [완전 공백] ") +
        "\"" + key + "\"" +
        (hasManualData ? "  " + JSON.stringify(manualValues) : "")
      );

    });

  } else {
    Logger.log(SEARCH.SHEET.OPS + " sheet not found — skipped.");
  }

  Logger.log("");
  Logger.log(
    "Part 1 요약: 죽은 키 " + deadCount + "건 " +
    "(수동 데이터 있음=" + deadWithManualData + ", 완전 공백=" + (deadCount - deadWithManualData) + ")"
  );

  //----------------------------------------------------------
  // Part 2 — 아직 값이 있는데 콘텐츠성으로 의심되는 Search 그룹 (후보만 나열)
  //----------------------------------------------------------

  const SUSPECT_KEYWORDS = [
    "webinar", "checklist", "workbook", "whitepaper", "playbook",
    "template", "toolkit", "roadmap", "practice test", "practice exam",
    "mock test", "sample test", "quiz", "recording", "case study",
    "on demand", "download", ".pdf", "cheat sheet"
  ];

  function containsSuspectKeyword(text) {
    return SUSPECT_KEYWORDS.some(function (kw) { return text.includes(kw); });
  }

  const suspectGroups = {};

  function scanForSuspects(sheet, campaignField, detailField) {

    if (!sheet) return;

    sheetToObjects(sheet).forEach(function (r) {

      if (r["Business Segment"] !== "Search") return;

      const campaign = String(r[campaignField] || "").trim();
      const detail = String(r[detailField] || "").trim();
      const text = (campaign + " " + detail).toLowerCase();

      if (!containsSuspectKeyword(text)) return;

      const label = detail || campaign;
      const key = label.toLowerCase();

      if (!suspectGroups[key]) {
        suspectGroups[key] = { label: label, count: 0 };
      }

      suspectGroups[key].count++;

    });

  }

  scanForSuspects(ss.getSheetByName(CONFIG.SHEETS.LEADS_MASTER), "First MKT UTM Campaign", "First Touch Detail");
  scanForSuspects(ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER), "MKT UTM Campaign", "Lead Source Detail");

  Logger.log("");
  Logger.log("---- Part 2: 현재 Search로 분류돼 있지만 콘텐츠성 키워드가 감지된 후보 (자동 확정 아님, 검토용) ----");

  const sortedSuspects = Object.keys(suspectGroups)
    .map(function (k) { return suspectGroups[k]; })
    .sort(function (a, b) { return b.count - a.count; });

  if (sortedSuspects.length === 0) {
    Logger.log("후보 없음.");
  } else {
    sortedSuspects.forEach(function (g) {
      Logger.log("\"" + g.label + "\" — Search로 분류된 건수: " + g.count);
    });
  }

  Logger.log("");
  Logger.log("======================================");
  Logger.log("Audit Completed");
  Logger.log("======================================");

}


/**
 * ==========================================================
 * Run Delete Dead Search_OPS Rows (수동 실행용)
 *
 * WHY
 * runAuditSearchSegmentIssues() Part 1로 확인된 죽은 키(Search_Engine에
 * 더 이상 없는 Search_OPS 키) 116건 전부 수동 컬럼(PIC/Impressions/Spent
 * 등)이 완전히 비어있음을 실측 확인(2026-07-28) — mergeSearchOPS_()
 * (73_Search_Merge.js)의 "현재 Engine 키 ∪ 기존 Search_OPS 키" 합집합
 * 병합 때문에 Business Segment가 바뀌어도 지워지지 않고 쌓인 레거시 행을
 * 사용자 승인 후 정리한다. 삭제 전 로그로 목록 전체 나열 — 실행 로그가
 * 곧 감사 기록(24_OPSQA.js의 완전 동일 중복 삭제 함수들과 동일 패턴).
 * ==========================================================
 */
function runDeleteDeadSearchOPSRows() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const engineSheet = ss.getSheetByName(SEARCH.SHEET.ENGINE);
  const opsSheet = ss.getSheetByName(SEARCH.SHEET.OPS);

  if (!opsSheet) {
    Logger.log(SEARCH.SHEET.OPS + " sheet not found.");
    return;
  }

  const liveKeys = {};

  if (engineSheet) {

    sheetToObjects(engineSheet).forEach(function (r) {
      const key = String(r["Lead Source Detail"] || "").trim().toLowerCase();
      if (key) liveKeys[key] = true;
    });

  }

  const values = opsSheet.getDataRange().getValues();
  const headers = values[SEARCH.ROWS.HEADER - 1];
  const keyColIndex = headers.indexOf(SEARCH.KEY);

  const rowsToDelete = [];

  for (let r = SEARCH.ROWS.DATA_START - 1; r < values.length; r++) {

    const key = String(values[r][keyColIndex] || "").trim();

    if (!key) continue;
    if (liveKeys[key.toLowerCase()]) continue; // 살아있음 — 스킵

    rowsToDelete.push(r + 1); // 1-based 시트 행 번호

  }

  Logger.log("======================================");
  Logger.log("Delete Dead Search_OPS Rows");
  Logger.log("======================================");
  Logger.log("Search_OPS 현재 행 수(헤더 제외): " + (opsSheet.getLastRow() - SEARCH.ROWS.DATA_START + 1));

  if (rowsToDelete.length === 0) {
    Logger.log("삭제할 죽은 키 없음.");
    return;
  }

  Logger.log("삭제 대상 행 수: " + rowsToDelete.length);
  Logger.log("삭제 대상 시트 행 번호(오름차순): " + rowsToDelete.join(", "));

  rowsToDelete
    .sort(function (a, b) { return b - a; }) // 내림차순 — 삭제 시 인덱스 안 밀리도록
    .forEach(function (rowIndex) {
      opsSheet.deleteRow(rowIndex);
    });

  SpreadsheetApp.flush();

  Logger.log(
    "삭제 완료 — " + rowsToDelete.length + "개 행 제거됨. " +
    "Search_OPS 현재 행 수(헤더 제외): " + (opsSheet.getLastRow() - SEARCH.ROWS.DATA_START + 1)
  );

  Logger.log("======================================");

}


/**
 * ==========================================================
 * Investigate Search Program Grouping (1회성 진단, 수동 실행용)
 *
 * WHY
 * Search를 raw UTM Campaign 그레인에서 Marketo Program(Lead Source
 * Detail) 그레인으로 전환하는 작업(2026-07-29, 사용자 요청)의 사전 조사.
 * 2026-07-24엔 "Search 리드 대부분이 Marketo Program 없이 직접 캡처되는
 * 광고/상담 신청"이라는 판단으로 raw UTM을 매칭 키로 선택했었으나,
 * 사용자가 실제 Search_OPS를 보니 search/sitelink가 아닌 raw UTM이 너무
 * 많다고 재확인 — 프로그램화 전에 "UTM Campaign별로 실제 Lead Source
 * Detail 값이 뭔지"를 먼저 원본 그대로 확인해서 그루핑 가능한 패턴이
 * 있는지 파악한다(사용자 지시: "utm과 lead source detail을 같이 표시해서
 * 그룹핑 가능한것들 먼저 파악"). 코드(getBusinessSegment()/MATCH_FIELD)
 * 변경 없음 — 순수 조회/로깅.
 * ==========================================================
 */
function runInvestigateSearchProgramGrouping() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const detailGroups = {}; // key: lowercased Lead Source Detail (비어있지 않음)
  const noDetailCampaigns = {}; // key: lowercased raw UTM Campaign (Lead Source Detail 비어있음)

  let totalScanned = 0;
  let totalWithDetail = 0;
  let totalWithoutDetail = 0;

  function scan(sheet, campaignField, detailField) {

    if (!sheet) return;

    sheetToObjects(sheet).forEach(function (r) {

      if (r["Business Segment"] !== "Search") return;

      const campaign = String(r[campaignField] || "").trim();
      const detail = String(r[detailField] || "").trim();

      totalScanned++;

      if (detail) {

        totalWithDetail++;

        const detailKey = detail.toLowerCase();

        if (!detailGroups[detailKey]) {
          detailGroups[detailKey] = { label: detail, total: 0, campaigns: {} };
        }

        detailGroups[detailKey].total++;

        const campaignLabel = campaign || "(빈값)";
        const campaignKey = campaignLabel.toLowerCase();

        if (!detailGroups[detailKey].campaigns[campaignKey]) {
          detailGroups[detailKey].campaigns[campaignKey] = { label: campaignLabel, count: 0 };
        }

        detailGroups[detailKey].campaigns[campaignKey].count++;

      } else {

        totalWithoutDetail++;

        const campaignLabel = campaign || "(빈값)";
        const campaignKey = campaignLabel.toLowerCase();

        if (!noDetailCampaigns[campaignKey]) {
          noDetailCampaigns[campaignKey] = { label: campaignLabel, count: 0 };
        }

        noDetailCampaigns[campaignKey].count++;

      }

    });

  }

  scan(ss.getSheetByName(CONFIG.SHEETS.LEADS_MASTER), SEARCH.MATCH_FIELD.LEADS, "First Touch Detail");
  scan(ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER), SEARCH.MATCH_FIELD.MTA, "Lead Source Detail");

  Logger.log("======================================");
  Logger.log("Investigate Search Program Grouping");
  Logger.log("======================================");
  Logger.log("Business Segment=Search 총 스캔 행 수: " + totalScanned);
  Logger.log(
    "Lead Source Detail 있음: " + totalWithDetail +
    " (" + (totalScanned ? Math.round(totalWithDetail / totalScanned * 1000) / 10 : 0) + "%)"
  );
  Logger.log(
    "Lead Source Detail 없음(직접 광고/상담폼 등): " + totalWithoutDetail +
    " (" + (totalScanned ? Math.round(totalWithoutDetail / totalScanned * 1000) / 10 : 0) + "%)"
  );

  Logger.log("");
  Logger.log("---- Part A: Lead Source Detail 있음 — Program별 raw UTM Campaign 매핑 (건수 내림차순) ----");

  const sortedDetailGroups = Object.keys(detailGroups)
    .map(function (k) { return detailGroups[k]; })
    .sort(function (a, b) { return b.total - a.total; });

  sortedDetailGroups.forEach(function (g) {

    const campaignList = Object.keys(g.campaigns)
      .map(function (k) { return g.campaigns[k]; })
      .sort(function (a, b) { return b.count - a.count; });

    Logger.log(
      "[" + g.total + "건, UTM " + campaignList.length + "종] Lead Source Detail = \"" + g.label + "\""
    );

    campaignList.forEach(function (c) {
      Logger.log("    - (" + c.count + "건) " + c.label);
    });

  });

  Logger.log("");
  Logger.log("---- Part B: Lead Source Detail 없음 — raw UTM Campaign만 존재 (건수 내림차순) ----");

  const sortedNoDetail = Object.keys(noDetailCampaigns)
    .map(function (k) { return noDetailCampaigns[k]; })
    .sort(function (a, b) { return b.count - a.count; });

  sortedNoDetail.forEach(function (c) {
    Logger.log("(" + c.count + "건) " + c.label);
  });

  Logger.log("");
  Logger.log("======================================");
  Logger.log("Investigation Completed");
  Logger.log("======================================");

}


/**
 * ==========================================================
 * Investigate Search Content Misroute (1회성 진단, 수동 실행용)
 *
 * WHY
 * runInvestigateSearchProgramGrouping() 결과, "Crimson Education Contact Us
 * form" 등 범용 캐치올 폼(Lead Source Detail)이 nurture 이메일/ebook 캠페인
 * 까지 Search로 뭉개고 있음이 확인됨(2026-07-29, 사용자 발견) — 원인은
 * getBusinessSegment()(16_TransformHelper.js)의 Search 확정 신호 블록에
 * 있는 detail.includes("contact")가 Content 판정보다 먼저 체크돼, campaign에
 * ebook/guide 등 Content 키워드가 있어도 detail이 범용 "Contact Us form"
 * 이면 무조건 Search로 먼저 확정돼 버리기 때문(2026-07-28 v1.7.0 change log
 * 의 "Content 오탐 사례가 발견되지 않음" 가정이 이번에 깨진 것).
 *
 * campaign이 "search"/"sitelink"를 포함하지 않는데 detail에 "contact"가
 * 있어 Search로 분류된 행만 스캔해서 3그룹으로 분류:
 * (a) campaign이 기존 Content 키워드(ebook/guide/curriculum 등)와 이미
 *     겹침 — 단순히 검사 순서만 바꾸면(Content를 Search보다 먼저) 해결
 * (b) campaign에 "nurture"가 포함 — 기존 키워드로는 못 잡음, 신규 키워드
 *     후보(이메일 nurture 시퀀스로 추정)
 * (c) 그 외 — 자동 분류 후보 아님, 사람이 개별 검토
 *
 * 코드 변경 없음(getBusinessSegment() 등 기존 로직 그대로) — 순수 진단.
 * ==========================================================
 */
function runInvestigateSearchContentMisroute() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 16_TransformHelper.js getBusinessSegment() Content 블록과 동일한 키워드
  // 목록을 진단 전용으로 복제(로직 변경 없이 매칭만 확인하기 위함).
  const CONTENT_KEYWORDS = [
    "ebook", "planner", "guide", "prospectus", "booklet", "curriculum",
    "parent ebook", "infographic", "download", "case study", "quiz",
    "on-demand", "ondemand", "on demand"
  ];

  function matchesContentKeyword(campaign) {
    return CONTENT_KEYWORDS.some(function (kw) { return campaign.includes(kw); })
      || /_lead(?![a-z])/.test(campaign);
  }

  const groupA = {}; // 이미 Content 키워드와 겹침
  const groupB = {}; // "nurture" 포함
  const groupC = {}; // 그 외(수동 검토)

  function addTo(bucket, campaignLabel, detailLabel) {

    const key = campaignLabel.toLowerCase() + "||" + detailLabel.toLowerCase();

    if (!bucket[key]) {
      bucket[key] = { campaign: campaignLabel, detail: detailLabel, count: 0 };
    }

    bucket[key].count++;

  }

  function scan(sheet, campaignField, detailField) {

    if (!sheet) return;

    sheetToObjects(sheet).forEach(function (r) {

      if (r["Business Segment"] !== "Search") return;

      const campaignRaw = String(r[campaignField] || "").trim();
      const detailRaw = String(r[detailField] || "").trim();

      const campaign = campaignRaw.toLowerCase();
      const detail = detailRaw.toLowerCase();

      if (!detail.includes("contact")) return; // 이번 진단 대상 아님
      if (campaign.includes("search") || campaign.includes("sitelink")) return; // 이미 확정 Search — 대상 아님

      if (matchesContentKeyword(campaign)) {
        addTo(groupA, campaignRaw || "(빈값)", detailRaw);
      } else if (campaign.includes("nurture")) {
        addTo(groupB, campaignRaw || "(빈값)", detailRaw);
      } else {
        addTo(groupC, campaignRaw || "(빈값)", detailRaw);
      }

    });

  }

  scan(ss.getSheetByName(CONFIG.SHEETS.LEADS_MASTER), SEARCH.MATCH_FIELD.LEADS, "First Touch Detail");
  scan(ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER), SEARCH.MATCH_FIELD.MTA, "Lead Source Detail");

  function logBucket(title, bucket) {

    Logger.log("");
    Logger.log("---- " + title + " ----");

    const rows = Object.keys(bucket)
      .map(function (k) { return bucket[k]; })
      .sort(function (a, b) { return b.count - a.count; });

    if (rows.length === 0) {
      Logger.log("해당 없음.");
      return;
    }

    let total = 0;

    rows.forEach(function (row) {
      total += row.count;
      Logger.log("(" + row.count + "건) campaign=\"" + row.campaign + "\"  detail=\"" + row.detail + "\"");
    });

    Logger.log("소계: " + total + "건 / " + rows.length + "개 조합");

  }

  Logger.log("======================================");
  Logger.log("Investigate Search Content Misroute");
  Logger.log("======================================");

  logBucket("(a) 기존 Content 키워드와 겹침 — 순서 변경만으로 해결 가능", groupA);
  logBucket("(b) campaign에 \"nurture\" 포함 — 신규 키워드 후보", groupB);
  logBucket("(c) 그 외 — 자동 분류 후보 아님, 수동 검토 필요", groupC);

  Logger.log("");
  Logger.log("======================================");
  Logger.log("Investigation Completed");
  Logger.log("======================================");

}


/**
 * ==========================================================
 * Investigate Search Blank Signal Rows (1회성 진단, 수동 실행용)
 *
 * WHY
 * runInvestigateSearchProgramGrouping() Part B에서 raw UTM Campaign도 Lead
 * Source Detail도 둘 다 비어있는 Search 행이 837건 확인됨(2026-07-29) —
 * getBusinessSegment()의 최종 fallback(leadSource.includes("search"))으로만
 * Search 판정된 행들로 추정. 사용자 질문: 이 837건의 실제 First Lead Source
 * 값이 정확히 "Naver Search"/"Google Search"뿐인지, 그 외 값(예: 레거시
 * "Organic Search" 기본값 — CLAUDE.md #14 참고)이 섞여 있는지, 그리고 이
 * 행들 중 Revenue가 발생한 케이스가 있는지 확인.
 *
 * 코드 변경 없음(getBusinessSegment() 등 기존 로직 그대로) — 순수 조회/로깅.
 * ==========================================================
 */
function runInvestigateSearchBlankSignalRows() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const bySource = {};

  function scan(sheet, campaignField, detailField) {

    if (!sheet) return;

    sheetToObjects(sheet).forEach(function (r) {

      if (r["Business Segment"] !== "Search") return;

      const campaign = String(r[campaignField] || "").trim();
      const detail = String(r[detailField] || "").trim();

      if (campaign || detail) return; // 둘 중 하나라도 있으면 이번 진단 대상 아님

      const leadSourceRaw = String(r["First Lead Source"] || "").trim();
      const leadSourceLabel = leadSourceRaw || "(빈값)";
      const key = leadSourceLabel.toLowerCase();

      if (!bySource[key]) {
        bySource[key] = { label: leadSourceLabel, count: 0, revenueCount: 0, revenueSum: 0 };
      }

      bySource[key].count++;

      const revenue = Number(r["Revenue"]) || 0;

      if (revenue > 0) {
        bySource[key].revenueCount++;
        bySource[key].revenueSum += revenue;
      }

    });

  }

  scan(ss.getSheetByName(CONFIG.SHEETS.LEADS_MASTER), SEARCH.MATCH_FIELD.LEADS, "First Touch Detail");
  scan(ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER), SEARCH.MATCH_FIELD.MTA, "Lead Source Detail");

  Logger.log("======================================");
  Logger.log("Investigate Search Blank Signal Rows");
  Logger.log("======================================");
  Logger.log("(campaign/detail 둘 다 비어있고 Business Segment=Search인 행 — First Lead Source별 분포)");
  Logger.log("");

  const rows = Object.keys(bySource)
    .map(function (k) { return bySource[k]; })
    .sort(function (a, b) { return b.count - a.count; });

  let total = 0;
  let totalRevenueCount = 0;
  let totalRevenueSum = 0;

  rows.forEach(function (r) {

    total += r.count;
    totalRevenueCount += r.revenueCount;
    totalRevenueSum += r.revenueSum;

    Logger.log(
      "(" + r.count + "건) First Lead Source = \"" + r.label + "\"" +
      (r.revenueCount > 0
        ? "  ⚠️ Revenue>0 " + r.revenueCount + "건 (합계 " + r.revenueSum + ")"
        : "")
    );

  });

  Logger.log("");
  Logger.log("총 " + total + "건 / Revenue>0 " + totalRevenueCount + "건 (합계 " + totalRevenueSum + ")");

  Logger.log("");
  Logger.log("======================================");
  Logger.log("Investigation Completed");
  Logger.log("======================================");

}


/**
 * ==========================================================
 * Investigate Search Group C Lead Source Category (1회성 진단, 수동 실행용)
 *
 * WHY
 * runInvestigateSearchContentMisroute() (c) 그룹(821건 — 범용 "Contact Us
 * form" 등 캐치올 폼이라 campaign에 Content/nurture 키워드도, search/
 * sitelink 확정 신호도 없어 자동 재분류 후보가 아니었던 나머지)에 대해,
 * 사용자가 First Lead Source보다 더 구체적인 "Lead Source Category" 필드에
 * "Naver Search"/"Google Search" 같은 값이 있는지 질문(2026-07-29) — 있다면
 * (c) 그룹 중 일부를 추가로 구제할 여지가 있는지 확인하기 위한 사전 조사.
 *
 * (a)/(b)와 동일한 기준으로 (c) 그룹만 다시 스캔해서 "First Lead Source /
 * Lead Source Category" 조합별 건수 + Revenue>0 여부를 집계한다.
 *
 * 코드 변경 없음(getBusinessSegment() 등 기존 로직 그대로) — 순수 조회/로깅.
 * ==========================================================
 */
function runInvestigateSearchGroupCLeadSourceCategory() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const CONTENT_KEYWORDS = [
    "ebook", "planner", "guide", "prospectus", "booklet", "curriculum",
    "parent ebook", "infographic", "download", "case study", "quiz",
    "on-demand", "ondemand", "on demand", "nurture"
  ];

  function matchesContentKeyword(campaign) {
    return CONTENT_KEYWORDS.some(function (kw) { return campaign.includes(kw); })
      || /_lead(?![a-z])/.test(campaign);
  }

  const bySourceCategory = {};

  function scan(sheet, campaignField, detailField, categoryField) {

    if (!sheet) return;

    sheetToObjects(sheet).forEach(function (r) {

      if (r["Business Segment"] !== "Search") return;

      const campaignRaw = String(r[campaignField] || "").trim();
      const detailRaw = String(r[detailField] || "").trim();

      const campaign = campaignRaw.toLowerCase();
      const detail = detailRaw.toLowerCase();

      if (!detail.includes("contact")) return; // (a)/(b)/(c) 대상 자체가 아님
      if (campaign.includes("search") || campaign.includes("sitelink")) return; // 이미 확정 Search
      if (matchesContentKeyword(campaign)) return; // (a) — 이제 Content
      if (campaign.includes("nurture")) return; // (b) — 이제 Content (matchesContentKeyword에 이미 포함되지만 명시)

      // 여기부터 (c) 그룹
      const leadSourceLabel = String(r["First Lead Source"] || "").trim() || "(빈값)";
      const categoryLabel = String(r[categoryField] || "").trim() || "(빈값)";
      const key = leadSourceLabel.toLowerCase() + "||" + categoryLabel.toLowerCase();

      if (!bySourceCategory[key]) {
        bySourceCategory[key] = {
          leadSource: leadSourceLabel, category: categoryLabel,
          count: 0, revenueCount: 0, revenueSum: 0,
          campaignPresentCount: 0, campaignBlankCount: 0
        };
      }

      bySourceCategory[key].count++;

      if (campaignRaw) {
        bySourceCategory[key].campaignPresentCount++;
      } else {
        bySourceCategory[key].campaignBlankCount++;
      }

      const revenue = Number(r["Revenue"]) || 0;

      if (revenue > 0) {
        bySourceCategory[key].revenueCount++;
        bySourceCategory[key].revenueSum += revenue;
      }

    });

  }

  scan(
    ss.getSheetByName(CONFIG.SHEETS.LEADS_MASTER),
    SEARCH.MATCH_FIELD.LEADS, "First Touch Detail", "First Lead Source Category"
  );
  scan(
    ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER),
    SEARCH.MATCH_FIELD.MTA, "Lead Source Detail", "Lead Source Category"
  );

  Logger.log("======================================");
  Logger.log("Investigate Search Group C Lead Source Category");
  Logger.log("======================================");
  Logger.log("(범용 폼이라 (a)/(b)에 안 걸린 (c) 그룹 — First Lead Source / Lead Source Category 조합별 분포)");
  Logger.log("");

  const rows = Object.keys(bySourceCategory)
    .map(function (k) { return bySourceCategory[k]; })
    .sort(function (a, b) { return b.count - a.count; });

  let total = 0;
  let totalRevenueCount = 0;
  let totalRevenueSum = 0;

  rows.forEach(function (r) {

    total += r.count;
    totalRevenueCount += r.revenueCount;
    totalRevenueSum += r.revenueSum;

    Logger.log(
      "(" + r.count + "건) First Lead Source = \"" + r.leadSource + "\"  /  Lead Source Category = \"" + r.category + "\"" +
      "  [UTM 있음 " + r.campaignPresentCount + " / UTM 없음 " + r.campaignBlankCount + "]" +
      (r.revenueCount > 0
        ? "  ⚠️ Revenue>0 " + r.revenueCount + "건 (합계 " + r.revenueSum + ")"
        : "")
    );

  });

  Logger.log("");
  Logger.log("총 " + total + "건 / Revenue>0 " + totalRevenueCount + "건 (합계 " + totalRevenueSum + ")");

  Logger.log("");
  Logger.log("======================================");
  Logger.log("Investigation Completed");
  Logger.log("======================================");

}


/**
 * ==========================================================
 * Run Clear Search_OPS Meta Channel (수동 실행용, 1회성)
 *
 * WHY
 * SEARCH.CHANNEL_DEFAULT를 "Meta"에서 빈 값으로 바꿨지만(70_Search_Config.js
 * v1.3.0), 이건 앞으로 새로 생기는 행에만 적용됨 — 이미 Search_OPS에 있는
 * 기존 행들의 Channel="Meta"는 과거 기본값이 그대로 박제된 것일 뿐 실제
 * 검증된 값이 아니므로(사용자 확인), 전부 지워서 사용자가 캠페인명 패턴을
 * 보고 직접 채워 넣을 수 있게 한다. Naver SA/Google SA로 이미 정확히 채워진
 * 행은 "Meta"가 아니므로 영향 없음.
 * ==========================================================
 */
function runClearSearchOPSMetaChannel() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SEARCH.SHEET.OPS);

  if (!sheet) {
    Logger.log(SEARCH.SHEET.OPS + " sheet not found.");
    return;
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[SEARCH.ROWS.HEADER - 1];
  const keyColIndex = headers.indexOf(SEARCH.KEY);
  const channelColIndex = headers.indexOf("Channel");

  if (channelColIndex === -1) {
    Logger.log("Channel 컬럼을 찾을 수 없습니다.");
    return;
  }

  let clearedCount = 0;

  Logger.log("======================================");
  Logger.log("Clear Search_OPS Meta Channel");
  Logger.log("======================================");

  for (let r = SEARCH.ROWS.DATA_START - 1; r < values.length; r++) {

    if (String(values[r][channelColIndex] || "").trim() !== "Meta") continue;

    const key = values[r][keyColIndex];

    sheet.getRange(r + 1, channelColIndex + 1).setValue("");

    clearedCount++;

    Logger.log("Cleared — \"" + key + "\"");

  }

  SpreadsheetApp.flush();

  Logger.log("");
  Logger.log("총 " + clearedCount + "건 Channel 공란 처리 완료.");
  Logger.log("======================================");

}
