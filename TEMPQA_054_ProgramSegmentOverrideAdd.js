/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — 확인된 7개 Program에 Program_Segment_Override 추가 (1회성)
 * (docs/OpenItems.md #30 후속 조사, 4차 — 확정 반영)
 *
 * Responsibility
 * `TEMPQA_053_ProgramSegmentSplitTrace.js` 조사 결과, `Program_Segment_
 * Dictionary`에서 `distinctSegmentCount=2`로 애매하다고 제외돼있던 7개
 * Program(BOFU 1건/Content 6건, #30 잔여) 전부 다수결(59~99.7%)이 "Content"
 * 이고, 소수 의견은 전부 완전히 무관한 다른 캠페인이 같은 Program 텍스트
 * 라벨을 우연히 공유한 것으로 확인됨(예: "Army Infographic"의 BOFU 1건은
 * "google-perfmax-acquisition-consult-bofu_contact"라는 별개 캠페인, Content
 * 51건은 진짜 에북 캠페인들) — 분류 로직 버그가 아니라 데이터 구조상
 * 노이즈이므로, 사용자 확인(2026-09-08) 후 다수결 값으로 override 확정.
 *
 * `Program_Segment_Override`(`CONFIG.MARKETO_QA.OVERRIDE_SHEET`)는 사람이
 * 직접 편집하는 시트가 아니라 `Marketo_QA` 검토 컬럼에서 동기화되는 내부
 * 저장소(평소 숨김)지만, 쓰기 함수(`writeOverrideMap_()`)가 기존 내용을
 * `readProgramSegmentOverrideMap_()`로 먼저 읽어 merge 후 재작성하는 구조라
 * (`UTIL_004_DictionaryQA.js` `refreshProgramSegmentDictionaryWithAnomalyCheck_()`
 * 참고) 직접 추가해도 다음 자동 동기화 때 사라지지 않는다 — 기존 헬퍼 함수
 * 그대로 재사용(clobber 위험 없음).
 *
 * 이 7건이 override로 반영되면 `isEligibleBOFUProgramPure_()`/
 * `isEligibleContentProgramPure_()`(#30 수정, BOFU_002_Engine.js v1.8.0/
 * CONTENT_002_Engine.js v1.9.0)가 다음 Engine Refresh부터 이 Program들을
 * Content로 인식해 Meta Spend 매칭이 채워진다.
 *
 * **1회성 쓰기 스크립트** — TEMPQA_048_PaidSocialContactFallbackOrderRepair.js와
 * 동일 관례(진단 완료 후 확정된 데이터를 직접 반영, 재실행해도 멱등 —
 * 이미 반영된 키는 값을 덮어쓸 뿐 중복 행이 생기지 않음).
 *
 * INPUT: 없음
 * OUTPUT: Program_Segment_Override 시트에 7행 merge, Logger.log로 결과 보고
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 반영 스크립트(TEMPQA 관례).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-09-08)
 * - 최초 작성.
 * ==========================================================
 */
function runAddProgramSegmentOverridesForAmbiguousMajorityContent(){

  const NEW_OVERRIDES = {
    "WF-2023-04-KOR-MOFU-Core Hyperlocalized Korean Army Infographic": "Content",
    "WF-2026-02-KOR-MOFU-Core RISE Academic Foundation": "Content",
    "WF-2026-06-KOR-MOFU-Core New Harvard Essay 1 Pager": "Content",
    "WF-2026-06-KOR-MOFU-Core One Pager Admission Timeline": "Content",
    "WF-2023-03-KOR-MOFU-Core Rise 2.0 Checklist Digital Campaign": "Content",
    "WF-2023-12-KOR-MOFU-Core Rise 7 Days Bootcamp": "Content",
    "WF-2022-07-KOR-TOFU-Core Master Class: Cracking the Common App": "Content"
  };

  const existingMap = readProgramSegmentOverrideMap_();

  Logger.log("======================================");
  Logger.log("Program_Segment_Override 추가 (1회성)");
  Logger.log("======================================");
  Logger.log("기존 override 항목 수 : " + Object.keys(existingMap).length);

  const mergedMap = mergeOverrideMaps_(existingMap, NEW_OVERRIDES);

  writeOverrideMap_(CONFIG.MARKETO_QA.OVERRIDE_SHEET, "Marketo Program", mergedMap);

  Logger.log("추가된 항목 수         : " + Object.keys(NEW_OVERRIDES).length);
  Logger.log("최종 override 항목 수  : " + Object.keys(mergedMap).length);
  Logger.log("");

  Object.keys(NEW_OVERRIDES).forEach(function(program){
    Logger.log("  " + program + " -> " + NEW_OVERRIDES[program]);
  });

  Logger.log("");
  Logger.log("======================================");
  Logger.log("Completed — 다음 BOFU/Content Engine Refresh부터 반영됨");
  Logger.log("======================================");

}
