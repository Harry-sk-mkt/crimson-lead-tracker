/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — Content_OPS에 Marketo Program은 있는데 Meta(UTM) 매칭이 비는 6건 추적
 *
 * Responsibility
 * 사용자가 짚은 Content 프로그램 6건(2026-10-16)은 Content_OPS에 행은 있지만
 * Campaign/Spent 등 Meta 컬럼이 비어 있다. 사용자가 알려준 Meta UTM 캠페인명으로
 * Meta 매칭 체인(Meta_Raw 캠페인명 → UTM_Program_Dictionary → strip 정규화 →
 * Content 자격 판정)의 어느 단계에서 끊기는지 건별로 찍는다.
 * `TEMPQA_051`의 `runTraceBOFUContentMetaProgramMismatch()`와 같은 방식이고,
 * 거기에 더해 (a) 필터 전 딕셔너리 원본 행(모호/제외 여부), (b) 이름이 살짝
 * 다른 경우를 잡으려고 slug 부분 일치(Meta_Raw/딕셔너리)도 같이 본다.
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 조사 스크립트(TEMPQA 관례).
 *
 * Version
 * v1.2.0
 *
 * Change Log
 * v1.2.0 (2026-10-16)
 * - `runAddStanfordEssayContentOverride()` 신규(1회성 쓰기) — 트레이스 결과
 *   override 시트(37키)에 Stanford Essay 1 Pager가 없어 Content 자격 탈락 확인.
 *   TEMPQA_054와 같은 방식(기존 override 읽기 → merge → writeOverrideMap_)으로
 *   한 건 추가. 재실행해도 멱등.
 * v1.1.0 (2026-10-16)
 * - `runTraceStanfordEssayContentOPS()` 신규 — 기준 완화 + Program_Segment_Override
 *   추가 후에도 Stanford Essay 1 Pager만 Content_OPS에 비어 있어, 세그먼트
 *   판정 → Meta 집계 → Content_Engine → Content_OPS 행까지 단계별로 확인.
 * v1.0.0 (2026-10-16)
 * - 최초 구현.
 * ==========================================================
 */

const TEMPQA_073_CASES = [
  { program: "WF-2026-07-KOR-MOFU-Core Hyperlocalized Rising 8~9 Roadmap eBook", utm: "KR_core_2026-07-10_hyperlocalised-rising-g8-roadmap-ebook_lead-fbiglg" },
  { program: "WF-2026-04-KOR-MOFU-Core Harvard Essay 1 Pager", utm: "KR_core_2026-04-06_harvard-essay-samples-ebook_lead-fbiglg" },
  { program: "WF-2026-02-KOR-MOFU-Core Stanford Essay 1 Pager", utm: "KR_core_2026-02-04_stanford-essay_lead-fbiglg" },
  { program: "WF-2026-02-KOR-MOFU-Core RISE ECL Planner", utm: "KR_core_2026-02-04_rise-hyperlocal-ecl-planner-ebook_lead-fbiglg" },
  { program: "WF-2025-11-KOR-MOFU-Core Revamped Hyperlocal UC ebook", utm: "KR_core_2025-11-20_revamped-hyperlocalised-uc-eb-dec2024_lead-fbiglg" },
  { program: "WF-2025-08-KOR-MOFU-Core New Personal Essay 7 Samples eBook", utm: "KR_core_2025-08-22_personal-essay-samples-2025_lead-fbiglg" }
];


/**
 * ==========================================================
 * Trace Content Program UTM Missing (수동 실행 진입점, 읽기 전용)
 * ==========================================================
 */
function runTraceContentProgramUtmMissing(){

  const dict = readUtmProgramDictionaryMap_();
  const dictRows = readRawUtmProgramDictionaryRowsForCoverage_(); // TEMPQA_051 — 모호 행 포함 원본
  const engineKeys = readEngineKeySetForCoverage_(CONTENT.SHEET.ENGINE, CONTENT.KEY);
  const metaRows = readMetaRawRows_();

  Logger.log("======================================");
  Logger.log("Trace Content Program UTM Missing");
  Logger.log("======================================");

  TEMPQA_073_CASES.forEach(function(c){

    const utm = c.utm.trim();
    const utmLower = utm.toLowerCase();
    const slug = (utmLower.split("_")[3] || utmLower); // KR_core_<date>_<slug>_<suffix>

    Logger.log("---- " + c.program + " ----");
    Logger.log("  Content_Engine에 키 존재 : " + !!engineKeys[c.program]);
    Logger.log("  UTM=\"" + utm + "\" (slug=\"" + slug + "\")");

    // 1) Meta_Raw — 정확 일치 / slug 부분 일치
    const metaExact = metaRows.filter(function(r){ return String(r.campaignName || "").trim().toLowerCase() === utmLower; });
    const metaSlugNames = uniqueNames_(metaRows.filter(function(r){
      return String(r.campaignName || "").toLowerCase().indexOf(slug) !== -1;
    }).map(function(r){ return r.campaignName; }));

    Logger.log("  [1] Meta_Raw 정확 일치 행 수 : " + metaExact.length +
      " (spent 합 " + metaExact.reduce(function(s, r){ return s + (Number(r.spent) || 0); }, 0).toFixed(2) + ")");
    Logger.log("      Meta_Raw slug 부분 일치 캠페인명 : " + JSON.stringify(metaSlugNames));

    // 2) 딕셔너리 원본 — 이 UTM 행 / slug 부분 일치 행 / 이 Program을 가리키는 행
    const dictExact = dictRows.filter(function(d){ return d.utmLower === utmLower; });
    const dictSlug = dictRows.filter(function(d){ return d.utmLower !== utmLower && d.utmLower.indexOf(slug) !== -1; });
    const dictToProgram = dictRows.filter(function(d){ return d.normalizedProgram === c.program; });

    Logger.log("  [2] 딕셔너리 원본 — 이 UTM 행 : " + describeDictRows_(dictExact));
    Logger.log("      딕셔너리 원본 — slug 부분 일치 다른 UTM : " + describeDictRows_(dictSlug));
    Logger.log("      딕셔너리 원본 — 이 Program을 가리키는 UTM : " + describeDictRows_(dictToProgram));

    // 3) 실제 프로덕션 매칭 경로
    const filtered = dict[utmLower];
    const normalized = filtered ? stripLGSuffix_(stripRegistrationFormSuffix_(filtered)) : null;

    Logger.log("  [3] 필터 후 딕셔너리 값 : " + JSON.stringify(filtered) +
      " / 수동 제외 : " + isUtmProgramDictionaryKeyExcluded_(utmLower));
    Logger.log("      strip 정규화 : " + JSON.stringify(normalized) + " (Program과 일치? " + (normalized === c.program) + ")");
    Logger.log("      Content 자격 : " + (normalized ? isEligibleContentProgram_(normalized) : "n/a"));
    Logger.log("      resolveMetaCampaignProgramKey_() : " +
      JSON.stringify(resolveMetaCampaignProgramKey_(utm, dict, isEligibleContentProgram_)));
    Logger.log("");

  });

  Logger.log("======================================");
  Logger.log("Trace Completed");
  Logger.log("======================================");

}


function uniqueNames_(names){

  return names.filter(function(n, i){ return names.indexOf(n) === i; });

}


function describeDictRows_(rows){

  if(rows.length === 0) return "없음";

  return rows.map(function(d){
    return d.utm + " → \"" + d.normalizedProgram + "\" (" + d.matchCount + "/" + d.totalCount + ", distinct=" + d.distinctProgramCount + ")";
  }).join(" | ");

}


/**
 * ==========================================================
 * Trace Stanford Essay Content_OPS (수동 실행 진입점, 읽기 전용)
 * ==========================================================
 */
function runTraceStanfordEssayContentOPS(){

  const program = "WF-2026-02-KOR-MOFU-Core Stanford Essay 1 Pager";
  const utm = "KR_core_2026-02-04_stanford-essay_lead-fbiglg";
  const programLower = program.toLowerCase();

  const overrideMap = readProgramSegmentOverrideMap_();
  const segmentMap = readProgramSegmentDictionaryMap_();
  const metaDict = readUtmProgramDictionaryMapForMeta_();
  const metaAgg = computeContentMetaCampaignDataAggregates_();
  const engineRow = readContentEngineMap_()[program];

  Logger.log("======================================");
  Logger.log("Trace Stanford Essay Content_OPS");
  Logger.log("======================================");
  Logger.log("[1] Program_Segment_Override 값 : " + JSON.stringify(overrideMap[programLower]) +
    " (override 키 수 " + Object.keys(overrideMap).length + ")");
  Logger.log("    override 키 중 'stanford essay' 포함 : " + JSON.stringify(Object.keys(overrideMap).filter(function(k){ return k.indexOf("stanford essay") !== -1; })));
  Logger.log("    병합된 세그먼트 맵 값 : " + JSON.stringify(segmentMap[programLower]));
  Logger.log("    isEligibleContentProgram_ : " + isEligibleContentProgram_(program));
  Logger.log("[2] Meta 딕셔너리 값 : " + JSON.stringify(metaDict[utm.toLowerCase()]));
  Logger.log("    resolveMetaCampaignProgramKey_ : " + JSON.stringify(resolveMetaCampaignProgramKey_(utm, metaDict, isEligibleContentProgram_)));
  Logger.log("    metaAgg spend : " + metaAgg.spend[program] + " / campaignNames : " + JSON.stringify(metaAgg.campaignNames[program]));
  Logger.log("[3] Content_Engine Spent : " + (engineRow ? engineRow["Spent"] : "행 없음"));

  const opsRows = readContentOPS_().filter(function(r){
    return String(r[CONTENT.KEY] || "").trim().toLowerCase() === programLower;
  });

  Logger.log("[4] Content_OPS 일치 행 수 : " + opsRows.length);
  opsRows.forEach(function(r){
    Logger.log("    key=" + JSON.stringify(r[CONTENT.KEY]) + " Campaign=" + JSON.stringify(r["Campaign"]) + " Spent=" + JSON.stringify(r["Spent"]));
  });

  Logger.log("======================================");

}


/**
 * ==========================================================
 * Add Stanford Essay Content Override (1회성 쓰기, 수동 실행)
 *
 * WHY
 * Program_Segment_Dictionary에 확정값이 없고(distinct>1) 키워드 폴백은
 * "1 Pager"를 모르는 탓에 Other로 판정 → Content Meta 매칭에서 탈락.
 * 리드 자체는 Content(Content_Engine에 키 존재)라 Content로 override 확정
 * (사용자 결정 2026-10-16). TEMPQA_054와 같은 방식 — 다음 자동 동기화 때도
 * 기존 override를 읽어 merge하므로 사라지지 않는다.
 * ==========================================================
 */
function runAddStanfordEssayContentOverride(){

  const NEW_OVERRIDES = { "WF-2026-02-KOR-MOFU-Core Stanford Essay 1 Pager": "Content" };

  const existingMap = readProgramSegmentOverrideMap_();
  const mergedMap = mergeOverrideMaps_(existingMap, NEW_OVERRIDES);

  writeOverrideMap_(CONFIG.MARKETO_QA.OVERRIDE_SHEET, "Marketo Program", mergedMap);

  Logger.log("override 항목 수 : " + Object.keys(existingMap).length + " -> " + Object.keys(mergedMap).length);
  Logger.log("추가 : " + JSON.stringify(NEW_OVERRIDES));

}
