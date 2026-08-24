/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — Content_OPS에 남아있는 Webinar/Seminar 프로그램 원인 추적
 *
 * Responsibility
 * Business Segment Full Rebuild(2026-08-25) 이후에도 Content_OPS/
 * Content_Engine에 "WB-"/"EV-" 등 명백한 Webinar/Seminar 프로그램명이
 * 남아있음을 사용자가 발견(runAuditContentSegmentDeadKeys() 죽은 키는
 * 5건뿐 — 대부분 여전히 "살아있는" Content 키로 잡힘). getBusinessSegment()
 * 를 이 프로그램명(detail) 단독으로 재현했을 때는 Webinar/Seminar로
 * 정확히 나오는데, 실제 MTA_Master/Leads_Master에서는 Content로 남아있는
 * 모순 확인.
 *
 * 가설: 같은 "Lead Source Detail"(프로그램명) 텍스트를 가진 터치가 여러
 * 건인데, 그중 일부 터치의 MKT UTM Campaign 값이 우연히 Content 키워드
 * (ebook/guide/on-demand 등)를 포함하고 있어서, 그 소수 터치만 Content로
 * 잘못 분류되고 나머지 터치는 정상적으로 Webinar/Seminar로 분류됨 —
 * Content_Engine이 "이 detail을 가진 터치 중 Business Segment=Content가
 * 하나라도 있으면" 그 프로그램명 전체를 살아있는 키로 취급하는 구조라서
 * 프로그램 전체가 Content_OPS에 노출됨.
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 *
 * INPUT: 없음 (Leads_Master/MTA_Master 직접 스캔, 대상 프로그램명은
 *   사용자가 채팅으로 보여준 Content_OPS 목록 중 WB-/EV- 등 명백히
 *   Webinar/Seminar로 보이는 것만 하드코딩)
 * OUTPUT: Logger.log만 — 대상 프로그램명별로 (1) 총 터치/리드 수,
 *   (2) Business Segment 분포(Content/Webinar/Seminar/기타 각 건수),
 *   (3) Content로 분류된 개별 터치의 실제 MKT UTM Campaign/Lead Source
 *   값(원인 특정용)
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 조사 스크립트(TEMPQA 관례).
 *
 * Version
 * v1.1.0
 *
 * Change Log
 * v1.1.0 (2026-08-25)
 * - 매칭 방식 수정 — Content_Engine의 실제 키는
 *   stripRegistrationFormSuffix_(r["Lead Source Detail"])(등록폼 접미사
 *   " | Registered for Webinar/Seminar from ..." 제거)인데, v1.0.0은 원본
 *   값과의 완전 일치만 검사해 접미사가 붙은 변형 행들을 누락하고 있었음
 *   (v1.0.0 실행 결과 일부 키가 "Content 0건"으로 나왔는데, 실제로는
 *   접미사 붙은 변형 행에 Content 오염이 숨어있을 가능성 — 재확인 필요,
 *   사용자 발견). MTA/Leads 양쪽 다 stripRegistrationFormSuffix_() 적용
 *   후 비교하도록 수정.
 * v1.0.0 (2026-08-25)
 * - 최초 구현.
 * ==========================================================
 */

function runTraceContentSegmentLeak(){

  const TARGET_KEYS = [
    "WB-2026-02-KOR-MOFU-Core Application Tips and Timeline for 2026 Applicants",
    "WB-2025-09-KOR-MOFU-Core College Research 1: HYPSM + Ivy by MIT FAO",
    "EV-2025-10-KOR-MOFU-Core 3 Successful Capstone Projects, Research, and Profiles",
    "WB-2025-08-KOR-MOFU-Core The Difference Between a Stanford and Harvard Admit",
    "WB-2025-01-KOR-MOFU-Core The Difference Between Harvard and Cornell Admit",
    "WB-2024-04-KOR-MOFU-Core Major Strategy Webinar Part 1: Natural Sciences & Engineering & STEM (7/13)",
    "WB-2023-10-KOR-MOFU-Core Admission Roadmap for Sophomores & Juniors",
    "EV-2023-03-KOR-MOFU-Core David Freed Seminar in Seoul",
    "WB-2023-01-KOR-MOFU-Core Major Selection: Law/Social Science/Humanities (2/11)",
    "EV-2023-09-KOR-MOFU-Core Admissions Breakdown with UChicago FAO Steve Han",
    "WB-2026-07-KOR-MOFU-Core EC for Each Year of High School",
    "EV-2026-03-KOR-MOFU-Core RD Result - Seoul",
    "WB-2024-11-KOR-MOFU-Core Harvard/Imperial Accepted Student Webinar",
    "WB-2025-07-KOR-MOFU-Core Game changing Common Application Tips",
    "WB-2024-09-KOR-MOFU-Core College Research Part 1. Ivy League",
    "EV-2024-05-KOR-MOFU-Core Analysis of Ivy League Admission Application Cases with Stanford FAO Martin",
    "WB-2024-07-KOR-MOFU-Core Edu Group Webinar with Gifted Mentor (8/28); 카카오",
    "EV-2025-03-KOR-MOFU-Core RD results - JEJU seminar",
    "WB-2021-11-KOR-MOFU-Core Major Selection Webinar",
    "WB-2022-09-KOR-MOFU-Core UC Admission Strategy",
    "WB-2023-11-KOR-MOFU-Core wise webinar",
    "WB-2022-02-KOR-MOFU-Core Admissions Secrets from a Stanford FAO webinar (4/2)",
    "WB-2022-04-KOR-MOFU-Core All About IVY League with a Harvard FAO",
    "EV-2024-02-KOR-MOFU-Core Strategists Summit in Seoul (3/16)",
    "WB-2022-03-KOR-MOFU-Core US Admissions trends webinar with Martin Walsh (4/23)",
    "WB-2022-02-KOR-MOFU-Core Start early and succeed - Jamie webinar"
  ];

  const targetKeySet = {};
  TARGET_KEYS.forEach(function(k){ targetKeySet[k.trim().toLowerCase()] = k; });

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const summary = {};
  TARGET_KEYS.forEach(function(k){
    summary[k] = { total: 0, bySegment: {}, contentSamples: [] };
  });

  //----------------------------------------------------------
  // MTA_Master 스캔
  //----------------------------------------------------------

  const mtaSheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);

  if(mtaSheet){

    sheetToObjects(mtaSheet).forEach(function(r){

      const detail = stripRegistrationFormSuffix_(r["Lead Source Detail"]);
      const normalized = detail.toLowerCase();

      if(!targetKeySet[normalized]) return;

      const originalKey = targetKeySet[normalized];
      const segment = String(r["Business Segment"] || "").trim();

      summary[originalKey].total++;
      summary[originalKey].bySegment[segment] = (summary[originalKey].bySegment[segment] || 0) + 1;

      if(segment === "Content" && summary[originalKey].contentSamples.length < 5){
        summary[originalKey].contentSamples.push(
          "[MTA] Lead ID=" + r["Lead ID"] +
          " / MKT UTM Campaign=\"" + r["MKT UTM Campaign"] + "\"" +
          " / First Lead Source=\"" + r["First Lead Source"] + "\"" +
          " / MTA Created Date=" + r["MTA Created Date"]
        );
      }

    });

  }

  //----------------------------------------------------------
  // Leads_Master 스캔
  //----------------------------------------------------------

  const leadsSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS_MASTER);

  if(leadsSheet){

    sheetToObjects(leadsSheet).forEach(function(r){

      const detail = stripRegistrationFormSuffix_(r["First Touch Detail"]);
      const normalized = detail.toLowerCase();

      if(!targetKeySet[normalized]) return;

      const originalKey = targetKeySet[normalized];
      const segment = String(r["Business Segment"] || "").trim();

      summary[originalKey].total++;
      summary[originalKey].bySegment[segment] = (summary[originalKey].bySegment[segment] || 0) + 1;

      if(segment === "Content" && summary[originalKey].contentSamples.length < 5){
        summary[originalKey].contentSamples.push(
          "[Leads] Lead ID=" + r["Lead ID"] +
          " / First MKT UTM Campaign=\"" + r["First MKT UTM Campaign"] + "\"" +
          " / Lead Source=\"" + r["Lead Source"] + "\"" +
          " / Create Date=" + r["Create Date"]
        );
      }

    });

  }

  //----------------------------------------------------------
  // 결과 출력
  //----------------------------------------------------------

  Logger.log("========== Content Segment Leak Trace ==========");

  TARGET_KEYS.forEach(function(key){

    const s = summary[key];

    Logger.log("");
    Logger.log("\"" + key + "\"");
    Logger.log("  총 매칭 행 수 : " + s.total);
    Logger.log("  Segment 분포 : " + JSON.stringify(s.bySegment));

    if(s.contentSamples.length > 0){
      Logger.log("  Content로 분류된 샘플:");
      s.contentSamples.forEach(function(line){ Logger.log("    " + line); });
    }

  });

  Logger.log("");
  Logger.log("========== Trace Completed ==========");

}
