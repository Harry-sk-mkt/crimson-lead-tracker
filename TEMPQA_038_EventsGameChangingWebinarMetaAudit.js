/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — "Game Changing Common Application Tips & Case Studies"
 * (Events_OPS) Meta 집계 이상치 조사
 *
 * Responsibility
 * 사용자가 Events_OPS에서 "WB-2026-07-KOR-MOFU-Core Game Changing Common
 * Application Tips & Case Studies"의 CVR 71.3%/Spent $10,706.41/
 * Clicks 19,827/Results 14,146이 비정상적으로 크고, 같은 웨비나의
 * "Recording" 변형("WB-2026-07-KOR-MOFU-Core Recording Game Changing
 * Common Application Tips & Case Studies")은 전부 0으로 보고.
 *
 * 코드 확인 결과, `aggregateMetaMetricsByEventsProgram_()`(EVENTS_002_Engine.js)는
 * Target_REP/ACQ_REP 쪽(`aggregateMetaSpendByFYMonthSegment_()` 등,
 * AD_002_Meta.js)이 쓰는 "정밀 주간 export 우선" 이중계상 방지 로직
 * (`isMetaRowWeekPrecise_()`)을 의도적으로 재사용하지 않고 Meta_Raw
 * 매칭 행을 전부 단순 합산한다(주석에 명시된 기존 설계 — 원래 있던
 * 위험). Meta_Raw가 같은 캠페인에 대해 "정밀 주간" 행과 "장기 분배(lump)"
 * 행을 동시에 담고 있으면 겹치는 기간이 중복 합산될 수 있다 — CVR
 * 71.3%(비정상적으로 높음)이 이 패턴과 부합하는지 원본 Meta_Raw 행을
 * 직접 덤프해 확인한다.
 *
 * 동시에 "Recording" 변형이 전부 0인 이유도 확인 — 두 프로그램명 중
 * 하나로 잘못 뭉쳐 들어가고 있는지(딕셔너리/override 매칭 충돌) 아니면
 * Recording 캠페인 자체가 Meta_Raw/UTM_Program_Dictionary에 없는지
 * (별도 원인, Meta 집계와 무관) 구분한다.
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 *
 * INPUT: 없음 (Meta_Raw/UTM_Program_Dictionary 직접 스캔)
 * OUTPUT: Logger.log만
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 조사 스크립트(TEMPQA 관례).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-08-28)
 * - 최초 구현.
 * ==========================================================
 */
function runAuditGameChangingWebinarMetaDoubleCount(){

  const PROGRAM_MAIN = "WB-2026-07-KOR-MOFU-Core Game Changing Common Application Tips & Case Studies";
  const PROGRAM_RECORDING = "WB-2026-07-KOR-MOFU-Core Recording Game Changing Common Application Tips & Case Studies";

  const dict = readUtmProgramDictionaryMap_();
  const metaRecords = readMetaRawRows_();

  function fmt(d){
    return d instanceof Date && !isNaN(d.getTime())
      ? Utilities.formatDate(d, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd")
      : "(공란)";
  }

  //----------------------------------------------------------
  // 1. 두 프로그램명 각각으로 매칭되는 Meta_Raw 행 전부 덤프
  //----------------------------------------------------------

  [PROGRAM_MAIN, PROGRAM_RECORDING].forEach(function(programName){

    Logger.log("========== " + programName + " ==========");

    const matched = metaRecords.filter(function(r){
      return resolveMetaCampaignEventsKey_(r.campaignName, dict) === programName;
    });

    Logger.log("매칭된 Meta_Raw 행 수 : " + matched.length);

    if(matched.length === 0){
      Logger.log("  (매칭된 행 없음)");
      return;
    }

    let sumSpent = 0, sumClicks = 0, sumResults = 0;

    matched.forEach(function(r, i){

      const precise = isMetaRowWeekPrecise_(r);

      Logger.log(
        "  [" + (i + 1) + "] Campaign=\"" + r.campaignName + "\"" +
        " / Report=" + fmt(r.reportStart) + "~" + fmt(r.reportEnd) +
        " / CampaignRun=" + fmt(r.campaignStart) + "~" + fmt(r.campaignEnd) +
        " / Precise=" + precise +
        " / Spent=" + r.spent + " / Clicks=" + r.clicks + " / Results=" + r.results
      );

      sumSpent += Number(r.spent) || 0;
      sumClicks += Number(r.clicks) || 0;
      sumResults += Number(r.results) || 0;

    });

    Logger.log(
      "  합계(단순 합산, 현재 Events Engine 방식) — Spent=" + sumSpent +
      " Clicks=" + sumClicks + " Results=" + sumResults +
      " CVR=" + (sumClicks > 0 ? (100 * sumResults / sumClicks).toFixed(1) + "%" : "N/A")
    );

    const uniqueCampaignNames = Array.from(new Set(matched.map(function(r){ return r.campaignName; })));

    Logger.log("  이 프로그램에 매칭된 서로 다른 Meta 캠페인명 수 : " + uniqueCampaignNames.length);
    uniqueCampaignNames.forEach(function(name){ Logger.log("    - " + name); });

  });

  //----------------------------------------------------------
  // 2. UTM_Program_Dictionary에서 두 프로그램명으로 매핑된 UTM Campaign 전부 조회
  //----------------------------------------------------------

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dictSheet = ss.getSheetByName(CONFIG.UTM_PROGRAM_DICT.SHEET);

  if(dictSheet){

    const dictRows = sheetToObjects(dictSheet);

    Logger.log("");
    Logger.log("========== UTM_Program_Dictionary 매핑 상세 ==========");

    [PROGRAM_MAIN, PROGRAM_RECORDING].forEach(function(programName){

      const rows = dictRows.filter(function(r){ return r["Marketo Program"] === programName; });

      Logger.log("-- " + programName + " (" + rows.length + "개 UTM Campaign) --");

      rows.forEach(function(r){
        Logger.log(
          "   UTM Campaign=\"" + r["UTM Campaign"] + "\"" +
          " / Match Count=" + r["Match Count"] + "/" + r["Total Count"] +
          " / Distinct Program Count=" + r["Distinct Program Count"]
        );
      });

    });

  } else {

    Logger.log("");
    Logger.log(CONFIG.UTM_PROGRAM_DICT.SHEET + " 시트를 찾을 수 없습니다.");

  }

}
