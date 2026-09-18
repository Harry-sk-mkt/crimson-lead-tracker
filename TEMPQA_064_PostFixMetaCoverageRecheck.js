/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — 등록폼 접미사 정규화 수정(UTIL_002 v1.13.0) 이후 전체 재검토
 *
 * Responsibility
 * `TEMPQA_063_EventsMetaSpendMissingDiagnostic.js` 조사로 발견된 버그
 * (`aggregateUtmProgramCounts_()`가 "ㅣRegistered for Webinar from FB LG
 * Form"/"...from Website Form" 등록폼 접미사를 안 뗀 원본값으로
 * distinctProgramCount를 계산해, 실제로는 같은 프로그램인데 접미사만
 * 다른 경우까지 "모호"로 오판되어 Meta 자동매칭에서 배제되던 문제)를
 * `UTIL_002_UtmProgramDictionary.js` v1.13.0으로 수정하고
 * `runRefreshUtmProgramDictionary()` 전체 재구축까지 완료(2026-09-18,
 * 사용자 확인 — Events 7건 중 6건 자동 해소).
 *
 * 이 버그는 Events_OPS(웨비나/세미나)뿐 아니라 `readUtmProgramDictionaryMap_()`
 * 을 공유 소비하는 BOFU_OPS/Content_OPS Meta 자동매칭에도 동일하게
 * 영향을 줬을 것으로 추정 — 사용자 요청으로 세 도메인 전체를 다시 훑어
 * (1) 수정으로 저절로 좋아진 정도, (2) 여전히 "확실한 후보 + Meta_Raw에도
 * 존재하는데 안 잡힘"(진짜 버그/추가 override 필요 의심) 남은 건수를
 * 확인한다.
 *
 * `TEMPQA_051_BOFUContentMetaProgramCoverageDiagnostic.js`의 범용 헬퍼
 * (`readEngineKeySetForCoverage_()`/`readRawUtmProgramDictionaryRowsForCoverage_()`/
 * `logBOFUContentMetaProgramCoverage_()` — 이름은 BOFU/Content 전용처럼
 * 보이지만 내부적으로 도메인 무관 범용 구현, TEMPQA_051 코드 참고)를 그대로
 * 재사용해 Events를 포함한 3개 도메인에 동일 기준 적용. BOFU/Content 두
 * 도메인은 `TEMPQA_051`의 `runDiagnoseBOFUContentMetaProgramCoverage()`를
 * 그대로 다시 실행해도 동일 결과 — 이 파일은 여기에 Events를 추가해 세
 * 도메인을 한 번에 나란히 비교 가능하게 하는 것이 유일한 차이.
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 *
 * INPUT: 없음 (Events_Engine/BOFU_Engine/Content_Engine,
 *   UTM_Program_Dictionary, Meta_Raw 직접 스캔)
 * OUTPUT: Logger.log만
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 조사 스크립트(TEMPQA 관례).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-09-18)
 * - 최초 구현. 사용자 요청 — 등록폼 접미사 정규화 수정 이후 Events/BOFU/
 *   Content 전체 재검토.
 * ==========================================================
 */


/**
 * ==========================================================
 * Recheck All Meta Coverage After Dictionary Fix (수동 실행 진입점, 읽기 전용)
 * ==========================================================
 */
function runRecheckAllMetaCoverageAfterDictionaryFix(){

  Logger.log("======================================");
  Logger.log("등록폼 접미사 정규화 수정 이후 Events/BOFU/Content Meta 매칭 커버리지 재검토");
  Logger.log("======================================");

  const metaCampaignNamesLower = {};

  readMetaRawRows_().forEach(function(r){

    const name = String(r.campaignName || "").trim().toLowerCase();

    if(name) metaCampaignNamesLower[name] = true;

  });

  const dictRows = readRawUtmProgramDictionaryRowsForCoverage_();

  [
    {
      label: "Events",
      engineKeys: readEngineKeySetForCoverage_(EVENTS.SHEET.ENGINE, EVENTS.KEY),
      matchedKeys: Object.keys(computeEventsMetaMetricsAggregates_().spend)
    },
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
  Logger.log("Recheck Completed");
  Logger.log("======================================");

}
