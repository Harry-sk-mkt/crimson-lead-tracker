/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — Program별 Business Segment 분화 원인 추적
 * (docs/OpenItems.md #30 후속 조사, 3차)
 *
 * Responsibility
 * `TEMPQA_052_ProgramSegmentDictionaryAmbiguityCheck.js` 실행 결과, #30에서
 * "확실한 후보 + Meta_Raw에도 존재하는데 안 잡힘"(진짜 버그 의심)으로 남아있던
 * BOFU 1건/Content 6건 전부 `Program_Segment_Dictionary`상 다수결이 실제로는
 * "Content"이고(59~99.7% 비율), 그 중 BOFU_Engine의 141개 프로그램 목록에
 * 들어있는 "WF-2023-04-KOR-MOFU-Core Hyperlocalized Korean Army Infographic"은
 * 리드의 98.75%(79/80)가 Content로 분류돼왔다는 게 확인됨(2026-09-08 사용자
 * 확인) — `BOFU_002_Engine.js`의 `aggregateBOFUMTATouchRecords_()`(line 474)가
 * "Business Segment === BOFU인 터치만" 필터링해 프로그램 키를 모으므로, 이
 * 프로그램이 BOFU 목록에 오른 건 최소 1건의 터치가 실제로(진짜 campaign/detail
 * 기반 분류로) BOFU로 분류됐기 때문 — 이 스크립트는 그 소수 BOFU 분류 터치와
 * 다수 Content 분류 터치의 실제 MKT UTM Campaign 값을 나란히 보여줘, 이게
 * (a) 같은 Program 아래 서로 다른 UTM 캠페인들이 실제로 섞여있는 정상적인
 * 케이스인지, 아니면 (b) 같은/유사 UTM 캠페인이 분류 규칙 경계에서 갈린 진짜
 * 버그(#29 SEARCH_CATCHALL류)인지 구분한다.
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 *
 * INPUT: 없음 (MTA_Master/Leads_Master 직접 스캔)
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
function runTraceProgramSegmentSplit(){

  const TARGET_PROGRAMS = [
    "WF-2023-04-KOR-MOFU-Core Hyperlocalized Korean Army Infographic",
    "WF-2026-02-KOR-MOFU-Core RISE Academic Foundation"
  ];

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  TARGET_PROGRAMS.forEach(function(targetProgram){

    Logger.log("======================================");
    Logger.log("Program: " + targetProgram);
    Logger.log("======================================");

    traceProgramSegmentSplitInSheet_(
      ss,
      CONFIG.SHEETS.MTA_MASTER,
      "Lead Source Detail",
      "MKT UTM Campaign",
      targetProgram
    );

    traceProgramSegmentSplitInSheet_(
      ss,
      CONFIG.SHEETS.LEADS_MASTER,
      "First Touch Detail",
      "First MKT UTM Campaign",
      targetProgram
    );

    Logger.log("");

  });

  Logger.log("======================================");
  Logger.log("Trace Completed");
  Logger.log("======================================");

}


/**
 * ==========================================================
 * Trace Program Segment Split In Sheet (IO 헬퍼, 읽기 전용)
 * ==========================================================
 */
function traceProgramSegmentSplitInSheet_(ss, sheetName, programField, utmField, targetProgram){

  const sheet = ss.getSheetByName(sheetName);

  if(!sheet){
    Logger.log("  [" + sheetName + "] 시트 없음");
    return;
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if(lastRow < 2 || lastCol === 0){
    Logger.log("  [" + sheetName + "] 데이터 없음");
    return;
  }

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function(h){ return String(h).trim(); });

  const programCol = headers.indexOf(programField);
  const utmCol = headers.indexOf(utmField);
  const segmentCol = headers.indexOf("Business Segment");

  if(programCol === -1 || utmCol === -1 || segmentCol === -1){
    Logger.log(
      "  [" + sheetName + "] 컬럼 못 찾음 — " + programField + "=" + programCol +
      " / " + utmField + "=" + utmCol + " / Business Segment=" + segmentCol
    );
    return;
  }

  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const bySegment = {};

  values.forEach(function(row){

    const stripped = stripRegistrationFormSuffix_(row[programCol]);

    if(stripped !== targetProgram) return;

    const segment = row[segmentCol] || "(공란)";
    const utm = row[utmCol] || "(공란)";

    if(!bySegment[segment]) bySegment[segment] = {};

    bySegment[segment][utm] = (bySegment[segment][utm] || 0) + 1;

  });

  Logger.log("  ---- [" + sheetName + "] " + programField + " 매칭 ----");

  const segments = Object.keys(bySegment);

  if(segments.length === 0){
    Logger.log("    매칭되는 행 없음");
    return;
  }

  segments.forEach(function(segment){

    const utmCounts = bySegment[segment];
    const total = Object.keys(utmCounts).reduce(function(sum, k){ return sum + utmCounts[k]; }, 0);

    Logger.log("    Business Segment=\"" + segment + "\" (" + total + "건)");

    Object.keys(utmCounts)
      .sort(function(a, b){ return utmCounts[b] - utmCounts[a]; })
      .slice(0, 10)
      .forEach(function(utm){
        Logger.log("      " + utmCounts[utm] + "건 <= UTM Campaign=\"" + utm + "\"");
      });

  });

}
