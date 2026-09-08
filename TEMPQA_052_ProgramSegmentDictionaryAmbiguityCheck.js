/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — Program_Segment_Dictionary 원본 행 조회
 * (docs/OpenItems.md #30 후속 조사, 2차)
 *
 * Responsibility
 * `TEMPQA_051_BOFUContentMetaProgramCoverageDiagnostic.js`의
 * `runDiagnoseBOFUContentMetaProgramCoverage()`를 #30 수정
 * (`isEligibleBOFUProgramPure_()`/`isEligibleContentProgramPure_()`,
 * BOFU_002_Engine.js v1.8.0/CONTENT_002_Engine.js v1.9.0) 이후 재실행한
 * 결과, 수정으로 잡힐 것으로 기대했던 "확실한 후보 + Meta_Raw에도 존재하는데
 * 안 잡힘"(진짜 버그 의심) 버킷이 BOFU 1건/Content 9건 → BOFU 1건/Content
 * 6건으로만 줄고 완전히 해소되지 않음(2026-09-08 사용자 재실행 확인) — 특히
 * 수정의 대표 사례로 들었던 "WF-2023-04-KOR-MOFU-Core Hyperlocalized Korean
 * Army Infographic"(BOFU)과 "WF-2026-02-KOR-MOFU-Core RISE Academic
 * Foundation"(Content)이 여전히 남아있음.
 *
 * `readProgramSegmentDictionaryMap_()`(UTIL_002_UtmProgramDictionary.js)를
 * 코드로 읽어보면 `distinctSegmentCount !== 1`인 Program은 애매하다고 보고
 * 맵에서 아예 제외한다(대신 `isEligibleXxxProgramPure_()`가 옛
 * `getBusinessSegment(programName, programName)` 폴백으로 떨어짐) — 즉 이
 * 프로그램들이 여전히 안 잡히는 건 딕셔너리 조회 로직 자체의 버그가 아니라
 * "이 Program의 과거 터치들이 Business Segment 다수결에서 갈렸다
 * (distinctSegmentCount>1)"는 별개의 원인일 가능성이 높다는 가설.
 *
 * 이 스크립트는 그 가설을 실데이터로 확인한다 — `Program_Segment_Dictionary`
 * 시트에서 이 Program들의 원본 행(Business Segment 다수결 값/Match Count/
 * Total Count/Distinct Segment Count)을 그대로 출력. `Program_Segment_
 * Override` 시트에 이미 override가 있는지도 함께 확인(있다면 왜 맵에
 * 반영이 안 됐는지는 또 다른 원인이라는 뜻).
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 *
 * INPUT: 없음 (Program_Segment_Dictionary, Program_Segment_Override 직접 조회)
 * OUTPUT: Logger.log만
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 조사 스크립트(TEMPQA 관례).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-09-08)
 * - 최초 작성.
 * ==========================================================
 */
function runCheckProgramSegmentDictionaryAmbiguity(){

  const PROGRAM_NAMES = [
    "WF-2023-04-KOR-MOFU-Core Hyperlocalized Korean Army Infographic",
    "WF-2026-02-KOR-MOFU-Core RISE Academic Foundation",
    "WF-2026-06-KOR-MOFU-Core New Harvard Essay 1 Pager",
    "WF-2026-06-KOR-MOFU-Core One Pager Admission Timeline",
    "WF-2023-03-KOR-MOFU-Core Rise 2.0 Checklist Digital Campaign",
    "WF-2023-12-KOR-MOFU-Core Rise 7 Days Bootcamp",
    "WF-2022-07-KOR-TOFU-Core Master Class: Cracking the Common App"
  ];

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const dictSheet = ss.getSheetByName(CONFIG.PROGRAM_SEGMENT_DICT.SHEET);
  const overrideSheet = ss.getSheetByName(CONFIG.MARKETO_QA.OVERRIDE_SHEET);

  const dictRowsByLower = {};

  if(dictSheet){

    const values = dictSheet.getDataRange().getValues();

    for(let i = 1; i < values.length; i++){

      const key = String(values[i][0] || "").trim().toLowerCase();

      if(!key) continue;

      dictRowsByLower[key] = {
        program: values[i][0],
        businessSegment: values[i][1],
        matchCount: values[i][2],
        totalCount: values[i][3],
        distinctSegmentCount: values[i][4]
      };

    }

  }

  const overrideRowsByLower = {};

  if(overrideSheet){

    const values = overrideSheet.getDataRange().getValues();

    for(let i = 1; i < values.length; i++){

      const key = String(values[i][0] || "").trim().toLowerCase();

      if(!key) continue;

      overrideRowsByLower[key] = values[i];

    }

  }

  Logger.log("======================================");
  Logger.log("Program_Segment_Dictionary 원본 행 조회");
  Logger.log("======================================");
  Logger.log("Program_Segment_Dictionary 시트 존재 : " + !!dictSheet);
  Logger.log("Program_Segment_Override 시트 존재   : " + !!overrideSheet);
  Logger.log("");

  PROGRAM_NAMES.forEach(function(name){

    const key = name.trim().toLowerCase();
    const dictRow = dictRowsByLower[key];
    const overrideRow = overrideRowsByLower[key];

    Logger.log("---- " + name + " ----");

    if(dictRow){

      Logger.log(
        "  Program_Segment_Dictionary : Business Segment=" +
        JSON.stringify(dictRow.businessSegment) +
        " / Match Count=" + dictRow.matchCount +
        " / Total Count=" + dictRow.totalCount +
        " / Distinct Segment Count=" + dictRow.distinctSegmentCount +
        " / 맵에 반영됨(=== 1)? " + (Number(dictRow.distinctSegmentCount) === 1)
      );

    } else {

      Logger.log("  Program_Segment_Dictionary : 이 Program 자체가 시트에 없음(전혀 채굴 안 됨)");

    }

    Logger.log("  Program_Segment_Override   : " + (overrideRow ? JSON.stringify(overrideRow) : "없음"));
    Logger.log("");

  });

  Logger.log("======================================");
  Logger.log("Check Completed");
  Logger.log("======================================");

}
