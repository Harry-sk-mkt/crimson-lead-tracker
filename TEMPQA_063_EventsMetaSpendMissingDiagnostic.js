/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — Events_OPS Spent 누락 의심 프로그램 7건 진단
 *
 * Responsibility
 * 사용자가 Events_OPS에서 아래 7개 WB 프로그램의 "Spent"가 업데이트 안 된
 * 것 같다고 보고(2026-09-18):
 *   - WB-2026-08-KOR-MOFU-Core Recording College Research: HYPS & Ivy
 *   - WB-2026-08-KOR-MOFU-Core College Research: HYPS & Ivy
 *   - WB-2026-07-KOR-MOFU-Core Recording Game Changing Common Application Tips & Case Studies
 *   - WB-2026-07-KOR-MOFU-Core Game Changing Common Application Tips & Case Studies
 *   - WB-2026-07-KOR-MOFU-Core Grades vs ECs
 *   - WB-2026-06-KOR-MOFU-Core EA/ED Application Strategy
 *   - WB-2026-06-KOR-MOFU-Core Rise Stanford Roadmap for rising G8~9
 *
 * Events_OPS의 Spent(GROUP_4_COMPUTED)는 Meta_Raw 지출을
 * `resolveMetaCampaignEventsKey_()`(EVENTS_002_Engine.js)로 프로그램명
 * 매칭해 자동 집계한다 — 우선순위: (1) 사람이 확인한
 * META_CAMPAIGN_NAME_TO_EVENTS_KEY_OVERRIDE(현재 EXPO 3건만) → (2)
 * UTM_Program_Dictionary(distinctProgramCount===1인 것만). 이 7건은 전부
 * 최근(FY26 JUN~AUG) 신규 웨비나라, 아직 리드 터치가 충분히 쌓이지 않아
 * 딕셔너리에 "확실한 후보"가 없거나(noDictEntry) 있어도 모호(ambiguous)해서
 * 제외됐을 가능성이 높다는 게 가설 — `docs/exec-plans/active/
 * 2026-07-30-campaign-spend-integration.md`의 "Meta 캠페인명 → Marketo
 * Program명 매핑(Events_OPS 자동화용, 별도 작업)" 미착수 항목과 동일 계열
 * 원인. TEMPQA_051(BOFU/Content 버전)과 동일한 방법론을 그대로 재사용,
 * 실제 프로덕션 함수(`resolveMetaCampaignEventsKey_()`/
 * `readUtmProgramDictionaryMap_()`)를 그대로 호출해 재구현 오차 없이
 * 확인한다.
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 *
 * INPUT: 없음 (Events_Engine, UTM_Program_Dictionary, Meta_Raw 직접 스캔)
 * OUTPUT: Logger.log만
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 조사 스크립트(TEMPQA 관례).
 *
 * Version
 * v1.2.0
 *
 * Change Log
 * v1.2.0 (2026-09-18)
 * - **`runLookupExactCaseMetaCampaignNames()` 신규** — `UTIL_002_
 *   UtmProgramDictionary.js` v1.13.0 등록폼 접미사 정규화 수정 이후
 *   재진단(2026-09-18) 결과 7건 중 6건은 자동 해소됐고, "WB-2026-06-KOR-
 *   MOFU-Core EA/ED Application Strategy"만 진짜 다른 프로그램과 섞인
 *   UTM 2건(`...-bau_event-online-fbiglg`(89% 다수)/
 *   `...-test_event-online-fbiglg`(85% 다수))이 남아 사용자 확정으로 이
 *   2건만 수동 override 추가하기로 함. `META_CAMPAIGN_NAME_TO_EVENTS_KEY_
 *   OVERRIDE`는 대소문자 그대로 정확히 일치해야 하는데(resolveMetaCampaignEventsKey_()
 *   가 소문자 변환 없이 비교) UTM_Program_Dictionary 시트는 소문자로만
 *   저장(aggregateUtmProgramCounts_()가 .toLowerCase() 적용) — 추측 대신
 *   Meta_Raw에서 원본 대소문자 그대로의 campaignName을 직접 조회하는
 *   1회성 읽기전용 함수.
 * v1.1.0 (2026-09-18)
 * - **`runTraceEventsAmbiguousMetaSpendCandidates()` 신규** — v1.0.0 실행 결과,
 *   7건 전부 공통 패턴 확인: 실제 유의미한 Meta 지출($2,849~$11,360)이 붙은
 *   캠페인은 전부 distinctProgramCount>1(모호)이라 제외되고, distinctProgramCount=1
 *   (확실)인 UTM은 전부 Kakao 터치 UTM이라 Meta_Raw에 스펜드 자체가 없음(0건) —
 *   즉 "매칭 로직 버그"가 아니라 "실제 지출이 발생한 캠페인의 UTM이 여러
 *   Marketo Program과 동시에 매칭돼 딕셔너리가 의도적으로 배제"하는 케이스.
 *   `runListAmbiguousUtmProgramEntries()`(UTIL_002_UtmProgramDictionary.js)와
 *   동일한 원본 카운트(`readMtaMasterUtmProgramPairs_()`+
 *   `readLeadsMasterUtmProgramPairs_()`를 `mergeCountsObjects_()`로 합산,
 *   실제 `refreshUtmProgramDictionary_()`가 쓰는 것과 동일)를
 *   `buildAmbiguousUtmProgramBreakdown_()`에 넣어, 이번에 확인된 모호 UTM만
 *   필터링해 경쟁 Program 후보 전체(카운트 포함)를 로그로 출력 — override
 *   맵 추가가 타당한지 사람이 판단할 근거 확보용. **아무것도 쓰지 않음.**
 * v1.0.0 (2026-09-18)
 * - 최초 구현. 사용자 보고 — Events_OPS 7개 WB 프로그램 Spent 업데이트 누락 의심.
 * ==========================================================
 */


/**
 * ==========================================================
 * Diagnose Events Meta Spend Missing (수동 실행 진입점, 읽기 전용)
 * ==========================================================
 */
function runDiagnoseEventsMetaSpendMissing(){

  const EXPECTED_KEYS = [
    "WB-2026-08-KOR-MOFU-Core Recording College Research: HYPS & Ivy",
    "WB-2026-08-KOR-MOFU-Core College Research: HYPS & Ivy",
    "WB-2026-07-KOR-MOFU-Core Recording Game Changing Common Application Tips & Case Studies",
    "WB-2026-07-KOR-MOFU-Core Game Changing Common Application Tips & Case Studies",
    "WB-2026-07-KOR-MOFU-Core Grades vs ECs",
    "WB-2026-06-KOR-MOFU-Core EA/ED Application Strategy",
    "WB-2026-06-KOR-MOFU-Core Rise Stanford Roadmap for rising G8~9"
  ];

  Logger.log("======================================");
  Logger.log("Events_OPS Spent 누락 의심 프로그램 7건 진단");
  Logger.log("======================================");

  const engineKeys = readEngineKeySetForCoverage_(EVENTS.SHEET.ENGINE, EVENTS.KEY);
  const dictRows = readRawUtmProgramDictionaryRowsForCoverage_();
  const dict = readUtmProgramDictionaryMap_();

  const metaRowsByLower = {};

  readMetaRawRows_().forEach(function(r){

    const n = String(r.campaignName || "").trim().toLowerCase();

    if(!n) return;
    if(!metaRowsByLower[n]) metaRowsByLower[n] = [];

    metaRowsByLower[n].push(r);

  });

  const liveSpendAgg = computeEventsMetaMetricsAggregates_().spend;

  EXPECTED_KEYS.forEach(function(key){

    Logger.log("---- \"" + key + "\" ----");
    Logger.log("  Events_Engine(SF 실적)에 이 키로 존재? " + (engineKeys[key] ? "YES" : "NO(Lead Source Detail 표기가 다를 수 있음)"));
    Logger.log("  isEligibleEventProgram_() 판정        : " + isEligibleEventProgram_(key) + " (false면 애초에 Events 대상 필터에서 제외)");

    const manualOverrideHit = Object.keys(META_CAMPAIGN_NAME_TO_EVENTS_KEY_OVERRIDE).filter(function(k){
      return META_CAMPAIGN_NAME_TO_EVENTS_KEY_OVERRIDE[k] === key;
    });

    Logger.log("  수동 override 맵에 이 키를 가리키는 항목 : " + (manualOverrideHit.length ? manualOverrideHit.join(", ") : "없음"));

    const candidates = dictRows.filter(function(row){ return row.normalizedProgram === key; });

    Logger.log("  UTM_Program_Dictionary 후보 수 : " + candidates.length);

    candidates.forEach(function(c){

      const excluded = isUtmProgramDictionaryKeyExcluded_(c.utmLower);
      const metaRows = metaRowsByLower[c.utmLower] || [];
      const metaSpendSum = metaRows.reduce(function(s, r){ return s + (Number(r.spent) || 0); }, 0);

      Logger.log(
        "    UTM=\"" + c.utm + "\" distinctProgramCount=" + c.distinctProgramCount +
        " matchCount=" + c.matchCount + "/" + c.totalCount +
        " 수동제외=" + excluded +
        " Meta_Raw존재행수=" + metaRows.length +
        " Meta_Raw지출합계(NZD)=" + metaSpendSum
      );

      const resolved = resolveMetaCampaignEventsKey_(c.utm, dict);

      Logger.log("    resolveMetaCampaignEventsKey_(\"" + c.utm + "\") 최종 반환값 : " + JSON.stringify(resolved) + " (기대값과 일치? " + (resolved === key) + ")");

    });

    Logger.log("  현재 Engine이 실제로 집계한 Spend(hasOwnProperty 여부로 '0'과 '데이터 없음' 구분) : " +
      (liveSpendAgg.hasOwnProperty(key) ? liveSpendAgg[key] : "(키 자체 없음 — 매칭된 Meta 지출 0건)"));

    Logger.log("");

  });

  Logger.log("======================================");
  Logger.log("Diagnostic Completed");
  Logger.log("======================================");

}


/**
 * ==========================================================
 * Trace Events Ambiguous Meta Spend Candidates (수동 실행 진입점, 읽기 전용)
 *
 * WHY
 * `runDiagnoseEventsMetaSpendMissing()` 1차 실행 결과(2026-09-18), 실제
 * 유의미한 Meta 지출이 붙은 UTM은 전부 distinctProgramCount>1(모호)라
 * 딕셔너리에서 배제되고 있음이 확인됨 — 그 UTM이 정확히 어떤 Program들과
 * 경쟁해서 배제됐는지(진짜 겹치는 프로그램인지, 아니면 소수 오귀속 터치
 * 때문에 모호로 잘못 분류된 것인지) 사람이 눈으로 확인해야 override 맵
 * 추가 여부를 판단할 수 있다 — `docs/OpenItems.md` "임의로 처리하지 말 것"
 * 원칙. `runListAmbiguousUtmProgramEntries()`(UTIL_002_UtmProgramDictionary.js)
 * 와 완전히 동일한 원본 카운트 소스(`readMtaMasterUtmProgramPairs_()`+
 * `readLeadsMasterUtmProgramPairs_()`, `mergeCountsObjects_()`로 합산 —
 * `refreshUtmProgramDictionary_()`가 실제로 쓰는 것과 동일 조합)를
 * `buildAmbiguousUtmProgramBreakdown_()`에 그대로 넣어 재구현 오차 없이
 * 확인, 이번에 확인된 모호 UTM 10건만 필터링해 출력.
 *
 * **읽기 전용** — 아무것도 쓰지 않음. MTA_Master 전체 스캔 포함이라
 * `runListAmbiguousUtmProgramEntries()`와 동일하게 느림(수십 초).
 * ==========================================================
 */
function runTraceEventsAmbiguousMetaSpendCandidates(){

  const TARGET_UTMS_LOWER = [
    "kr_core_2026-09-12_college-research-hyps-&-ivy-rerun-lplg_event-online",
    "kr_core_2026-09-08_college-research-hyps-&-ivy-lplg_event-online",
    "kr_core_2026-08-29_game-changing-case-studies-rerun-lplg_event-online",
    "kr_core_2026-08-26_game-changing-case-studies-lplg_event-online-fbiglg",
    "kr_core_2026-08-12_grades-vs-ecs-lplg_event-online-fbiglg",
    "kr_core-ltb_2026-07-29_fbcrv2026-early-stanford-app-lplg-bau_event-online-fbiglg",
    "kr_core-ltb_2026-07-29_fbcrv2026-early-stanford-app-lplg-test_event-online-fbiglg",
    "kr_core_2026-07-29_ea-ed-strategy-wb-with-emily",
    "kr_core_2026-07-22_rise-stanford-roadmap-lplg_event-online-fbiglg",
    "kr_core_2026-07-22_stanford-roadmap-for-rising-89-wb"
  ];

  Logger.log("======================================");
  Logger.log("모호(distinctProgramCount>1) UTM 경쟁 Program 후보 상세 — Meta 지출 있는 케이스만");
  Logger.log("(MTA_Master + Leads_Master 전체 스캔 — 수십 초 소요될 수 있음)");
  Logger.log("======================================");

  const mtaCounts = aggregateUtmProgramCounts_(readMtaMasterUtmProgramPairs_());
  const leadsCounts = aggregateUtmProgramCounts_(readLeadsMasterUtmProgramPairs_());
  const counts = mergeCountsObjects_(mtaCounts, leadsCounts);

  const breakdown = buildAmbiguousUtmProgramBreakdown_(counts)
    .filter(function(row){ return TARGET_UTMS_LOWER.indexOf(row.utm) !== -1; });

  TARGET_UTMS_LOWER.forEach(function(utmLower){

    const rows = breakdown.filter(function(r){ return r.utm === utmLower; });

    Logger.log("---- UTM=\"" + utmLower + "\" ----");

    if(rows.length === 0){
      Logger.log("  (buildAmbiguousUtmProgramBreakdown_() 결과에 없음 — distinctProgramCount<=1로 재계산되었거나 UTM 자체가 없음, 재확인 필요)");
      Logger.log("");
      return;
    }

    rows.forEach(function(r){
      Logger.log(
        "  Program=\"" + r.program + "\" count=" + r.count + "/" + r.totalCountForUtm +
        (r.isSelected ? " <= 다수결 채택(딕셔너리 winner)" : "")
      );
    });

    Logger.log("");

  });

  Logger.log("======================================");
  Logger.log("Trace Completed");
  Logger.log("======================================");

}


/**
 * ==========================================================
 * Lookup Exact-Case Meta Campaign Names (수동 실행 진입점, 읽기 전용)
 *
 * WHY
 * `META_CAMPAIGN_NAME_TO_EVENTS_KEY_OVERRIDE`(EVENTS_002_Engine.js)는
 * `resolveMetaCampaignEventsKey_()`가 대소문자 변환 없이 정확히 일치하는
 * 키만 찾으므로, override를 추가하려면 Meta_Raw에 실제로 저장된 원본
 * 대소문자 그대로의 campaignName이 필요하다. UTM_Program_Dictionary
 * 시트는 소문자로만 저장돼 있어(추측 대신) Meta_Raw를 직접 훑어 확인한다.
 * ==========================================================
 */
function runLookupExactCaseMetaCampaignNames(){

  const TARGET_UTMS_LOWER = [
    "kr_core-ltb_2026-07-29_fbcrv2026-early-stanford-app-lplg-bau_event-online-fbiglg",
    "kr_core-ltb_2026-07-29_fbcrv2026-early-stanford-app-lplg-test_event-online-fbiglg"
  ];

  const found = {};

  readMetaRawRows_().forEach(function(r){

    const nameLower = String(r.campaignName || "").trim().toLowerCase();

    if(TARGET_UTMS_LOWER.indexOf(nameLower) === -1) return;
    if(!found[nameLower]) found[nameLower] = {};

    found[nameLower][r.campaignName] = true;

  });

  TARGET_UTMS_LOWER.forEach(function(utmLower){

    const variants = Object.keys(found[utmLower] || {});

    Logger.log(
      "UTM(lower)=\"" + utmLower + "\" -> Meta_Raw 원본 campaignName(들): " +
      (variants.length ? JSON.stringify(variants) : "(Meta_Raw에서 못 찾음)")
    );

  });

}
