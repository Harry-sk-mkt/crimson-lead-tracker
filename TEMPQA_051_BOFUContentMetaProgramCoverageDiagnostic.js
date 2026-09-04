/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — BOFU/Content Meta 매칭 커버리지 부족 원인 세분화
 * (docs/OpenItems.md #30 후속 조사)
 *
 * Responsibility
 * #30에서 실측된 "BOFU_OPS 138개 프로그램 중 92개/Content_OPS 144개 중
 * 87개가 Meta 자동 매칭 실패"라는 숫자가, 서로 다른 대응이 필요한 두 원인
 * 중 어느 쪽이 대부분인지 구분되지 않은 채로 남아있었음:
 * (1) UTM_Program_Dictionary에 이 프로그램을 가리키는 UTM 항목 자체가
 *     아예 없음 — Meta 광고가 지금까지 리드로 한 번도 귀속되지 않았다는
 *     뜻이라, 딕셔너리를 넓히거나 override를 추가해도 도움이 안 됨
 *     (딕셔너리 자체에 후보가 없으므로).
 * (2) 딕셔너리에 후보 UTM은 있는데 전부 모호(distinctProgramCount>1)해서
 *     제외됨 — 이 경우만 Events_OPS 선례(수동 override 맵, 사람이 직접
 *     확인한 소수 케이스만 등록)가 실효 있음. 그 중에서도 그 UTM이 실제로
 *     Meta_Raw 캠페인명으로 존재하는 것만 "override를 넣으면 실제로 Spend가
 *     채워지는" 진짜 후보다.
 *
 * 두 원인의 비중을 실측해야 "딕셔너리 확장 vs override 맵 도입" 중 어느
 * 쪽이 실효 있는 방향인지(또는 둘 다 큰 도움이 안 되는지) 판단 가능하다 —
 * `docs/OpenItems.md` #30 "임의로 처리하지 말 것" 원칙에 따라 결정 전
 * 데이터부터 확보.
 *
 * `resolveMetaCampaignProgramKey_()`(EVENTS_002_Engine.js)가 실제로 쓰는
 * 정규화(stripLGSuffix_(stripRegistrationFormSuffix_(...)))를 그대로 재사용해
 * 실제 매칭 로직과 동일한 기준으로 비교한다.
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 *
 * INPUT: 없음 (BOFU_Engine/Content_Engine, UTM_Program_Dictionary, Meta_Raw
 *   직접 스캔)
 * OUTPUT: Logger.log만
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 조사 스크립트(TEMPQA 관례).
 *
 * Version
 * v1.2.0
 *
 * Change Log
 * v1.2.0 (2026-09-05)
 * - **`runTraceBOFUContentMetaProgramMismatch()` 신규** — v1.1.0 실행 결과
 *   "확실한 후보 + Meta_Raw에도 존재하는데 안 잡힘"(진짜 버그 의심)이
 *   BOFU 1건/Content 9건으로 좁혀짐(전부 matchCount/totalCount가 크고
 *   명확한 케이스) — 재구현 로직이 아니라 실제 프로덕션 함수
 *   (`resolveMetaCampaignProgramKey_()`/`readUtmProgramDictionaryMap_()`)를
 *   그대로 호출해 단계별(딕셔너리 원본값 → strip 정규화 → eligibility 판정 →
 *   최종 반환값)로 어디서 어긋나는지 직접 추적.
 * v1.1.0 (2026-09-05)
 * - **1차 실행 결과 발견된 허점 수정**: 확실한 후보(distinctProgramCount===1)가
 *   있는데도 미매칭인 버킷이 BOFU 38건/Content 53건(미매칭의 절반 이상)으로
 *   나왔으나, 그 확실한 UTM 후보가 실제로 Meta_Raw 캠페인명으로 존재하는지
 *   확인을 빼먹고 있었음 — 존재하지 않으면 "그 캠페인은 애초에 Meta 스펜드
 *   데이터가 없다"는 뜻이라 noDictEntry(1번 원인)와 사실상 같은 결론인데
 *   "버그 의심"으로 잘못 분류될 위험. 이 버킷을 (4) 확실한 후보는 있지만
 *   Meta_Raw엔 없음(버그 아님) / (5) 확실한 후보 + Meta_Raw에도 존재하는데
 *   안 잡힘(진짜 버그 의심)으로 세분화, (5) 샘플에 matchCount/totalCount도
 *   같이 표시(#36 선례 — 표본이 극소수인 "확실한" 판정은 신뢰도가 낮을 수
 *   있어 판단 근거로 필요).
 * v1.0.0 (2026-09-05)
 * - 최초 구현. `docs/OpenItems.md` #30.
 * ==========================================================
 */


/**
 * ==========================================================
 * Diagnose BOFU/Content Meta Program Coverage (수동 실행 진입점, 읽기 전용)
 * ==========================================================
 */
function runDiagnoseBOFUContentMetaProgramCoverage(){

  Logger.log("======================================");
  Logger.log("BOFU/Content Meta Program Coverage 세분화 진단");
  Logger.log("======================================");

  const metaCampaignNamesLower = {};

  readMetaRawRows_().forEach(function(r){

    const name = String(r.campaignName || "").trim().toLowerCase();

    if(name) metaCampaignNamesLower[name] = true;

  });

  const dictRows = readRawUtmProgramDictionaryRowsForCoverage_();

  [
    {
      label: "BOFU",
      engineKeys: readEngineKeySetForCoverage_(BOFU.SHEET.ENGINE, BOFU.KEY),
      matchedKeys: Object.keys(computeBOFUMetaCampaignDataAggregates_().spend)
    },
    {
      label: "Content",
      engineKeys: readEngineKeySetForCoverage_(CONTENT.SHEET.ENGINE, CONTENT.KEY),
      matchedKeys: Object.keys(computeContentMetaCampaignDataAggregates_().spend)
    }
  ].forEach(function(domain){

    logBOFUContentMetaProgramCoverage_(domain.label, domain.engineKeys, domain.matchedKeys, dictRows, metaCampaignNamesLower);

  });

  Logger.log("======================================");
  Logger.log("Diagnostic Completed");
  Logger.log("======================================");

}


/**
 * ==========================================================
 * Trace BOFU/Content Meta Program Mismatch (수동 실행 진입점, 읽기 전용)
 *
 * WHY
 * `runDiagnoseBOFUContentMetaProgramCoverage()` 1차 실행(2026-09-05) 결과
 * "확실한 후보 + Meta_Raw에도 존재하는데 안 잡힘"(진짜 버그 의심) 케이스가
 * BOFU 1건/Content 9건으로 좁혀짐 — 전부 matchCount/totalCount가 크고
 * 명확한데도 실제 매칭에 실패하는 이유를 알아야 함. 재구현한 로직이 아니라
 * **실제 프로덕션 함수(`resolveMetaCampaignProgramKey_()`,
 * `readUtmProgramDictionaryMap_()`)를 그대로 호출**해 각 단계(딕셔너리
 * 원본값 → strip 정규화 → eligibility 판정 → 최종 반환값)를 그대로 찍어
 * 어느 단계에서 어긋나는지 직접 확인한다.
 * ==========================================================
 */
function runTraceBOFUContentMetaProgramMismatch(){

  const CASES = [
    {
      label: "BOFU",
      expectedKey: "WF-2023-04-KOR-MOFU-Core Hyperlocalized Korean Army Infographic",
      candidateUtms: [
        "kr_core_2023-04-21_hyperlocalised-army-infographic-mofu_lead",
        "kr_core_2023-06-23_hyperlocalised-army-infographic-mofu_lead"
      ],
      isEligible: isEligibleBOFUProgram_
    },
    {
      label: "Content",
      expectedKey: "WF-2026-02-KOR-MOFU-Core RISE Academic Foundation",
      candidateUtms: ["kr_core_2026-02-06_rise-hyperlocal-academic-ebook_lead-fbiglg"],
      isEligible: isEligibleContentProgram_
    },
    {
      label: "Content",
      expectedKey: "WF-2026-06-KOR-MOFU-Core 1 Pager Alternative Competitions",
      candidateUtms: ["kr_core_2026-06-23_one-pager-alternative_lead-fbiglg"],
      isEligible: isEligibleContentProgram_
    },
    {
      label: "Content",
      expectedKey: "WF-2026-06-KOR-MOFU-Core New Harvard Essay 1 Pager",
      candidateUtms: ["kr_core_2026-06-18_harvard-essay-one-pager_lead-fbiglg"],
      isEligible: isEligibleContentProgram_
    },
    {
      label: "Content",
      expectedKey: "WF-2026-06-KOR-MOFU-Core One Pager Admission Timeline",
      candidateUtms: ["kr_core_2026-06-17_one-pager-admission-timeline_lead-fbiglg"],
      isEligible: isEligibleContentProgram_
    },
    {
      label: "Content",
      expectedKey: "WF-2026-03-KOR-MOFU-Core Yale Essay 1 Pager",
      candidateUtms: ["kr_core_2026-03-04_yale-case-study_lead-fbiglg"],
      isEligible: isEligibleContentProgram_
    },
    {
      label: "Content",
      expectedKey: "WF-2024-06-KOR-MOFU-Core UC Accepted Essay Samples",
      candidateUtms: ["kr_core_2024-06-18_gl-us-personal-essay-master-guide-eb-uc_lead-fbiglg"],
      isEligible: isEligibleContentProgram_
    },
    {
      label: "Content",
      expectedKey: "WF-2023-03-KOR-MOFU-Core Rise 2.0 Checklist Digital Campaign",
      candidateUtms: ["kr_core_2023-03-10_rise-2.0-type-form-mofu_lead-lg"],
      isEligible: isEligibleContentProgram_
    },
    {
      label: "Content",
      expectedKey: "WF-2023-12-KOR-MOFU-Core Rise 7 Days Bootcamp",
      candidateUtms: ["kr_core_2023-12-08_hqrise-crimson-seven-days-bootcamp_lead-fbiglg"],
      isEligible: isEligibleContentProgram_
    },
    {
      label: "Content",
      expectedKey: "WF-2022-07-KOR-TOFU-Core Master Class: Cracking the Common App",
      candidateUtms: [
        "kr_core_2023-08-01_gl-common-app-master-class_lead",
        "kr_core_2023-08-01_gl-common-app-master-class_lead-fbiglg"
      ],
      isEligible: isEligibleContentProgram_
    }
  ];

  const dict = readUtmProgramDictionaryMap_();

  const metaRowsByLower = {};

  readMetaRawRows_().forEach(function(r){

    const n = String(r.campaignName || "").trim().toLowerCase();

    if(!n) return;
    if(!metaRowsByLower[n]) metaRowsByLower[n] = [];

    metaRowsByLower[n].push(r);

  });

  Logger.log("======================================");
  Logger.log("Trace BOFU/Content Meta Program Mismatch");
  Logger.log("======================================");

  CASES.forEach(function(c){

    Logger.log("---- [" + c.label + "] expected=\"" + c.expectedKey + "\" ----");

    c.candidateUtms.forEach(function(utm){

      const utmLower = utm.toLowerCase();
      const dictRaw = dict[utmLower];
      const normalized = dictRaw ? stripLGSuffix_(stripRegistrationFormSuffix_(dictRaw)) : null;
      const eligible = normalized ? c.isEligible(normalized) : false;
      const resolved = resolveMetaCampaignProgramKey_(utm, dict, c.isEligible);
      const metaRows = metaRowsByLower[utmLower] || [];

      Logger.log("  UTM=\"" + utm + "\"");
      Logger.log("    dict[utmLower] 원본값        : " + JSON.stringify(dictRaw));
      Logger.log("    strip 정규화 후              : " + JSON.stringify(normalized) + " (expected와 일치? " + (normalized === c.expectedKey) + ")");
      Logger.log("    eligibility 판정             : " + eligible);
      Logger.log("    resolveMetaCampaignProgramKey_() 반환값 : " + JSON.stringify(resolved));
      Logger.log("    Meta_Raw에 이 campaignName(소문자 일치)로 존재하는 행 수 : " + metaRows.length);

      metaRows.slice(0, 3).forEach(function(m){
        Logger.log("      원본 campaignName=\"" + m.campaignName + "\" spent=" + m.spent);
      });

    });

    Logger.log("");

  });

  Logger.log("======================================");
  Logger.log("Trace Completed");
  Logger.log("======================================");

}


/**
 * ==========================================================
 * Log BOFU/Content Meta Program Coverage (IO 헬퍼, 읽기 전용)
 * ==========================================================
 */
function logBOFUContentMetaProgramCoverage_(label, engineKeys, matchedKeys, dictRows, metaCampaignNamesLower){

  const matchedSet = {};

  matchedKeys.forEach(function(k){ matchedSet[k] = true; });

  const unmatched = Object.keys(engineKeys).filter(function(key){ return !matchedSet[key]; });

  let noDictEntry = 0;
  let manuallyExcludedOnly = 0;
  let ambiguousOnly = 0;
  let ambiguousWithMetaPresence = 0;
  let confidentNotInMeta = 0;   // distinctProgramCount===1이지만 그 UTM 자체가 Meta_Raw에 없음(스펜드 없음 — 버그 아님)
  let confidentButUnmatched = 0; // distinctProgramCount===1이고 Meta_Raw에도 있는데 안 잡힘 — 진짜 버그 의심

  const sampleNoDictEntry = [];
  const sampleAmbiguousWithMetaPresence = [];
  const sampleConfidentButUnmatched = [];

  unmatched.forEach(function(key){

    const candidates = dictRows.filter(function(row){ return row.normalizedProgram === key; });

    if(candidates.length === 0){
      noDictEntry++;
      if(sampleNoDictEntry.length < 10) sampleNoDictEntry.push(key);
      return;
    }

    const nonExcluded = candidates.filter(function(c){
      return !isUtmProgramDictionaryKeyExcluded_(c.utmLower);
    });

    if(nonExcluded.length === 0){
      manuallyExcludedOnly++;
      return;
    }

    const confident = nonExcluded.filter(function(c){ return c.distinctProgramCount === 1; });

    if(confident.length > 0){

      // distinctProgramCount===1이고 수동 제외도 아닌데 matchedSet에 없다 — 그
      // UTM이 애초에 Meta_Raw 캠페인명으로 존재하는지부터 확인해야 진짜 버그인지
      // 판단 가능(존재 안 하면 "그 캠페인은 스펜드 데이터가 없다"는 뜻이라
      // noDictEntry와 사실상 동일 결론, 버그 아님).
      const confidentInMeta = confident.filter(function(c){ return metaCampaignNamesLower[c.utmLower]; });

      if(confidentInMeta.length > 0){

        confidentButUnmatched++;

        if(sampleConfidentButUnmatched.length < 10){
          sampleConfidentButUnmatched.push(
            key + " <= 확실한 UTM 후보(Meta_Raw에 존재): " +
            confidentInMeta.map(function(c){ return c.utm + "(matchCount=" + c.matchCount + "/" + c.totalCount + ")"; }).join(", ")
          );
        }

      } else {
        confidentNotInMeta++;
      }

      return;

    }

    ambiguousOnly++;

    const inMeta = nonExcluded.filter(function(c){ return metaCampaignNamesLower[c.utmLower]; });

    if(inMeta.length > 0){

      ambiguousWithMetaPresence++;

      if(sampleAmbiguousWithMetaPresence.length < 10){
        sampleAmbiguousWithMetaPresence.push(
          key + " <= UTM 후보: " +
          inMeta.map(function(c){ return c.utm + "(distinct=" + c.distinctProgramCount + ")"; }).join(", ")
        );
      }

    }

  });

  Logger.log("---- " + label + " ----");
  Logger.log("Engine 전체 프로그램 수 : " + Object.keys(engineKeys).length);
  Logger.log("Meta 매칭 성공 : " + matchedKeys.length);
  Logger.log("미매칭 : " + unmatched.length);
  Logger.log("  (1) 딕셔너리에 이 프로그램을 가리키는 UTM 항목 자체가 없음(0건 터치 추정) : " + noDictEntry);
  Logger.log("  (2) 수동 제외 목록(UTM_PROGRAM_DICT_MANUAL_EXCLUSIONS)에만 걸림 : " + manuallyExcludedOnly);
  Logger.log("  (3) 전부 모호(distinctProgramCount>1)해서 제외 : " + ambiguousOnly);
  Logger.log("      -> 그 중 실제로 Meta_Raw에 그 UTM 캠페인이 존재(override 도입 시 실효 있음) : " + ambiguousWithMetaPresence);
  Logger.log("  (4) 확실한 후보(distinctProgramCount===1) 있음, 그 UTM이 Meta_Raw엔 없음(그 캠페인은 스펜드 자체가 없음 — 버그 아님, (1)과 사실상 동일 결론) : " + confidentNotInMeta);
  Logger.log("  (5) 확실한 후보 있음 + Meta_Raw에도 존재하는데 안 잡힘(진짜 버그 의심) : " + confidentButUnmatched);
  Logger.log("");
  Logger.log("샘플 — 딕셔너리에 아예 없음(최대 10건):");
  sampleNoDictEntry.forEach(function(s){ Logger.log("  " + s); });
  Logger.log("");
  Logger.log("샘플 — 모호하지만 Meta_Raw에 존재(override 후보, 최대 10건):");
  sampleAmbiguousWithMetaPresence.forEach(function(s){ Logger.log("  " + s); });

  if(sampleConfidentButUnmatched.length > 0){
    Logger.log("");
    Logger.log("샘플 — 확실한 후보 + Meta_Raw에도 존재하는데 안 잡힘(진짜 버그 의심, 최대 10건):");
    sampleConfidentButUnmatched.forEach(function(s){ Logger.log("  " + s); });
  }

  Logger.log("");

}


/**
 * ==========================================================
 * Read Engine Key Set For Coverage (IO 헬퍼, 읽기 전용)
 * ==========================================================
 */
function readEngineKeySetForCoverage_(sheetName, keyHeader){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  const set = {};

  if(!sheet) return set;

  sheetToObjects(sheet).forEach(function(r){

    const key = String(r[keyHeader] || "").trim();

    if(key) set[key] = true;

  });

  return set;

}


/**
 * ==========================================================
 * Read Raw UTM Program Dictionary Rows For Coverage (IO 헬퍼, 읽기 전용)
 *
 * WHY
 * `readUtmProgramDictionaryMap_()`(UTIL_002_UtmProgramDictionary.js)는
 * distinctProgramCount===1인 것만 반환해 모호한 후보가 안 보인다 — 이
 * 진단은 모호한 후보까지 전부 봐야 하므로 `UTM_Program_Dictionary` 시트를
 * 직접 읽는다. Program 값은 `resolveMetaCampaignProgramKey_()`와 동일하게
 * `stripLGSuffix_(stripRegistrationFormSuffix_(...))`로 정규화 — 실제 매칭
 * 로직과 같은 기준으로 비교하기 위함(EVENTS_002_Engine.js 재사용).
 * ==========================================================
 */
function readRawUtmProgramDictionaryRowsForCoverage_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.UTM_PROGRAM_DICT.SHEET);

  const rows = [];

  if(!sheet) return rows;

  const values = sheet.getDataRange().getValues();

  for(let i = 1; i < values.length; i++){

    const utm = String(values[i][0] || "").trim();
    const rawProgram = values[i][1];
    const matchCount = Number(values[i][2]);
    const totalCount = Number(values[i][3]);
    const distinctProgramCount = Number(values[i][4]);

    if(!utm || !rawProgram) continue;

    rows.push({
      utm: utm,
      utmLower: utm.toLowerCase(),
      normalizedProgram: stripLGSuffix_(stripRegistrationFormSuffix_(rawProgram)),
      matchCount: matchCount,
      totalCount: totalCount,
      distinctProgramCount: distinctProgramCount
    });

  }

  return rows;

}
