/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — UTM 딕셔너리 다수결 비율 기준 완화 영향 미리보기
 *
 * Responsibility
 * `readUtmProgramDictionaryMap_()` 필터를 distinct===1 →
 * `isUtmDictionaryRowConfident_()`(다수결 비율 ≥ MIN_MAJORITY_RATIO)로
 * 바꾸기 전에, 새로 매칭에 들어오는 UTM 전체를 나열해 잘못 묶일 만한
 * 게 있는지 사람이 확인한다(2026-10-16 사용자 결정, TEMPQA_073 후속).
 * 이 딕셔너리는 Events/BOFU/Content/Search Spend 매칭과 Business Segment
 * 분류가 공유하므로, Content 6건 외 영향도 같이 본다.
 * 기준 바로 아래(90~95%) 구간도 같이 찍어 임계값 판단 근거로 쓴다.
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 *
 * TEST: 판정 로직은 `testIsUtmDictionaryRowConfident()`(UTIL_002) 참고.
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-10-16)
 * - 최초 구현.
 * ==========================================================
 */


/**
 * ==========================================================
 * Preview UTM Dictionary Majority Ratio (수동 실행 진입점, 읽기 전용)
 * ==========================================================
 */
function runPreviewUtmDictMajorityRatio(){

  const minRatio = CONFIG.UTM_PROGRAM_DICT.MIN_MAJORITY_RATIO;
  const dictRows = readRawUtmProgramDictionaryRowsForCoverage_(); // TEMPQA_051 — 모호 행 포함 원본
  const segmentMap = readProgramSegmentDictionaryMap_();

  const metaSpendByLower = {};

  readMetaRawRows_().forEach(function(r){
    const n = String(r.campaignName || "").trim().toLowerCase();
    if(n) metaSpendByLower[n] = (metaSpendByLower[n] || 0) + (Number(r.spent) || 0);
  });

  const ambiguous = dictRows.filter(function(d){
    return d.distinctProgramCount > 1 && !isUtmProgramDictionaryKeyExcluded_(d.utmLower);
  });

  const newlyIncluded = ambiguous.filter(function(d){
    return isUtmDictionaryRowConfident_(d.matchCount, d.totalCount, d.distinctProgramCount, minRatio);
  });

  const nearMiss = ambiguous.filter(function(d){
    const ratio = d.totalCount > 0 ? d.matchCount / d.totalCount : 0;
    return ratio >= 0.9 && ratio < minRatio;
  });

  Logger.log("======================================");
  Logger.log("UTM Dictionary Majority Ratio Preview (기준 " + minRatio + ")");
  Logger.log("======================================");
  Logger.log("현재 제외 중인 모호 UTM(수동 제외 빼고) : " + ambiguous.length);
  Logger.log("새 기준으로 매칭에 들어오는 UTM : " + newlyIncluded.length +
    " (그 중 Meta_Raw에 캠페인 있음 : " + newlyIncluded.filter(function(d){ return metaSpendByLower[d.utmLower]; }).length + ")");
  Logger.log("");

  logPreviewRows_("---- 새로 매칭되는 UTM (Meta Spent 큰 순) ----", newlyIncluded, metaSpendByLower, segmentMap);
  logPreviewRows_("---- 기준 바로 아래 90~95% (계속 제외) ----", nearMiss, metaSpendByLower, segmentMap);

  Logger.log("======================================");
  Logger.log("Preview Completed");
  Logger.log("======================================");

}


function logPreviewRows_(title, rows, metaSpendByLower, segmentMap){

  Logger.log(title);

  rows
    .slice()
    .sort(function(a, b){ return (metaSpendByLower[b.utmLower] || 0) - (metaSpendByLower[a.utmLower] || 0); })
    .forEach(function(d){
      Logger.log(
        "  " + d.utm +
        " → \"" + d.normalizedProgram + "\"" +
        " [" + (segmentMap[d.normalizedProgram.toLowerCase()] || "세그먼트 미확정") + "]" +
        " " + d.matchCount + "/" + d.totalCount + " (" + (100 * d.matchCount / d.totalCount).toFixed(1) + "%, distinct=" + d.distinctProgramCount + ")" +
        " Meta spent=" + (metaSpendByLower[d.utmLower] || 0).toFixed(2)
      );
    });

  Logger.log("");

}
