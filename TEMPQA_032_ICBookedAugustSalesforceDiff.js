/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — ACQ_REP IC Booked(이번 달) vs Salesforce 실제 리스트 대조
 *
 * Responsibility
 * 사용자가 Salesforce "leads report"에서 IC Booked Date=이번 달 필터로
 * 뽑은 42건(Email 목록, IC Booked/New (Not Contacted)/Qualified 등
 * 현재 Lead Status 혼재 — Lead Status는 현재 상태 스냅샷이라 IC Booked
 * 이후 더 진행된 리드도 다수 섞여 있는 게 정상)과 ACQ_REP IC Booked=21건
 * 사이의 괴리 원인을 찾는다.
 *
 * 사전 확인(OPS_006_QA.js의 runDiagnoseICCompleteMismatch()/
 * runBreakdownICCompleteByBookedMonth() 실행 결과, IC Complete 기준):
 * Leads_OPS ↔ MTA_Master 내부 정합성은 100% 일치(불일치 0, 누락 0) —
 * 즉 대표 터치 선정/sync 로직 자체엔 버그가 없고, MTA_Master가 이미
 * 담고 있는 값만큼만 Leads_OPS/ACQ_REP에 정확히 반영되고 있음이 확인됨.
 * 따라서 이번 조사는 "MTA_Master가 Salesforce의 42건을 애초에 얼마나
 * 담고 있는지"를 Import 체인 단계별(Leads_Master → Leads_OPS → MTA_Master
 * sync)로 추적하는 데 집중한다.
 *
 * 분류 기준 (Email 단위, Lead ID가 없어 Email로 매칭):
 * (1) Leads_Master에도 없음 — Leads Import 자체 누락 가능성
 * (2) Leads_Master엔 있는데 Leads_OPS엔 없음 — mergeOPS() 단계에서
 *     제외(동일 Email의 다른 Lead ID가 대신 채택됐을 가능성 등)
 * (3) Leads_OPS엔 있는데 IC Booked Date가 이번 달이 아니거나 공란 —
 *     이 경우 다시 하위 분류:
 *     (3a) MTA_Master 원본 터치에 이번 달 IC Booked Date 값이 있는데
 *          Leads_OPS에 반영 안 됨 (sync 버그 의심)
 *     (3b) MTA_Master에 이 Email의 터치는 있는데 이번 달 IC Booked Date
 *          값 자체가 없음 (Salesforce MTA export 리포트 자체가 이 값을
 *          못 담아옴 — 원본 리포트 필터/범위 문제 가능성)
 *     (3c) MTA_Master에 이 Email의 터치 자체가 없음 (MTA export에서
 *          완전히 빠짐)
 * (4) Leads_OPS의 IC Booked Date가 정상적으로 이번 달과 일치 (정상)
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 *
 * INPUT: 없음 (Leads_Master/Leads_OPS/MTA_Master 직접 스캔, Salesforce
 *   Email 목록은 사용자가 채팅으로 전달한 값을 하드코딩)
 * OUTPUT: Logger.log만
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 조사 스크립트(TEMPQA 관례).
 *
 * Version
 * v1.3.0
 *
 * Change Log
 * v1.3.0 (2026-08-25)
 * - runSyncMTAFunnelToOPS() 재실행(8,294건 갱신) 후 재검증 결과 IC
 *   Booked는 21→22(redrock333만 반영, 나머지 17건은 그대로) — "어제 sync
 *   자체가 스킵됐다"는 가설은 기각, 원래 결론(export 시차, 버그 아님)
 *   확정. 이어서 ACQ_REP IC Complete가 여전히 7(Salesforce는 22)이라
 *   보고돼, 동일한 방법론을 IC Completed Date에도 적용하기 위해
 *   runCompareICCompleteAugustAgainstSalesforce() 신규 추가(사용자
 *   제공 21건 — Salesforce가 부른 22건과 1건 차이 있으나 그대로 진행).
 * v1.2.0 (2026-08-25)
 * - runDumpICBookedMissingValueTimeline() 실행 결과, 18건은 전부 "최근
 *   터치에도 IC Booked Date가 공란"(export 시차로 설명됨, 버그 아님)
 *   패턴으로 확인됨. 단 redrock333@yahoo.com 1건만 MTA_Master엔 이번
 *   달 값이 있는데 Leads_OPS엔 반영 안 됨 — 진짜 sync 버그로 의심되어
 *   runTraceRedrock333SyncGap() 신규 추가(Lead ID 불일치 가설 검증).
 * v1.1.0 (2026-08-25)
 * - runCompareICBookedAugustAgainstSalesforce() 1차 실행 결과, 42건 중
 *   18건이 "MTA_Master 터치는 있는데 이번 달 IC Booked Date 값 자체가
 *   없음" 버킷에 집중됨 — 이 값이 아예 공란인지 다른 달 값인지, 그리고
 *   가장 최근 터치가 언제인지(=Salesforce가 그 이후 새 터치를 안
 *   만들어 최신 상태를 못 실었을 가능성) 확인하기 위해
 *   runDumpICBookedMissingValueTimeline() 신규 추가(해당 18건 +
 *   sync 버그 의심 1건, 총 19건의 터치 타임라인 전체 덤프).
 * v1.0.0 (2026-08-25)
 * - 최초 구현.
 * ==========================================================
 */

function runCompareICBookedAugustAgainstSalesforce(){

  const SALESFORCE_IC_BOOKED_EMAILS = [
    "ssong508@gmail.com", "tgyoush@gmail.com", "happysahngmi@gmail.com",
    "pchanmi.ad@gmail.com", "jeun_young@naver.com", "inigahn@gmail.com",
    "ssy003@gmail.com", "lyj79bada@gmail.com", "help@tonny.net",
    "mdleebs@gmail.com", "vn79young@hanmail.net", "songcm2027@tciscommunity.com",
    "washgoo@gmail.com", "behappy12123@gmail.com", "hisunwoo2023@gmail.com",
    "cyr.vtr@gmail.com", "joohi82@naver.com", "sung.pyun@speclipse.com",
    "bgfnccoo@gmail.com", "heisyou@gmail.com", "yeonwooobear@gmail.com",
    "jackiek75@gmail.com", "wooooow79@naver.com", "giyoun_lee@naver.com",
    "jeeyoon79@naver.com", "jinhee.jang@gmail.com", "micyoo@gmail.com",
    "whereur10@gmail.com", "tabbyy77@gmail.com", "gracebbcjin@gmail.com",
    "baramein@gmail.com", "ian.han0408@gmail.com", "ands82@naver.com",
    "i.m.dasom@gmail.com", "rrxaun@gmail.com", "luciajuly77@gmail.com",
    "eun_ji_kim@bat.com", "ywsahn@gmail.com", "li36682@gmail.com",
    "choi.jongsok@gmail.com", "chiwupark@gmail.com", "redrock333@yahoo.com"
  ];

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const opsSheet = ss.getSheetByName(OPS.SHEET.OPS);
  const masterSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS_MASTER);
  const mtaSheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);

  if(!opsSheet){ Logger.log(OPS.SHEET.OPS + " 시트를 찾을 수 없습니다."); return; }
  if(!masterSheet){ Logger.log(CONFIG.SHEETS.LEADS_MASTER + " 시트를 찾을 수 없습니다."); return; }
  if(!mtaSheet){ Logger.log(CONFIG.SHEETS.MTA_MASTER + " 시트를 찾을 수 없습니다."); return; }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  function isThisMonth(date){
    return date instanceof Date && !isNaN(date.getTime()) &&
      date.getFullYear() === year && date.getMonth() === month;
  }

  function normEmail(v){
    return String(v || "").trim().toLowerCase();
  }

  function groupByEmail(records){
    const map = {};
    records.forEach(function(r){
      const email = normEmail(r["Email"]);
      if(!email) return;
      if(!map[email]) map[email] = [];
      map[email].push(r);
    });
    return map;
  }

  const opsByEmail = groupByEmail(sheetToObjects(opsSheet));
  const masterByEmail = groupByEmail(sheetToObjects(masterSheet));
  const mtaByEmail = groupByEmail(sheetToObjects(mtaSheet));

  const notInMaster = [];
  const notInOps = [];
  const syncBugSuspect = [];
  const mtaMissingValue = [];
  const mtaMissingTouch = [];
  const ok = [];

  SALESFORCE_IC_BOOKED_EMAILS.forEach(function(rawEmail){

    const email = normEmail(rawEmail);

    const masterRows = masterByEmail[email] || [];
    const opsRows = opsByEmail[email] || [];
    const mtaRows = mtaByEmail[email] || [];

    if(masterRows.length === 0){
      notInMaster.push(email);
      return;
    }

    if(opsRows.length === 0){
      notInOps.push(
        email + " — Leads_Master엔 있음(Lead ID=" +
        masterRows.map(function(r){ return r["Lead ID"]; }).join(", ") + ")"
      );
      return;
    }

    const anyOpsBookedThisMonth = opsRows.some(function(r){
      return isThisMonth(r["IC Booked Date"]);
    });

    if(anyOpsBookedThisMonth){
      ok.push(email);
      return;
    }

    // Leads_OPS엔 있지만 IC Booked Date가 이번 달로 안 잡힘 — MTA_Master 원본 확인
    const opsBookedValues = opsRows.map(function(r){
      const d = r["IC Booked Date"];
      return d instanceof Date && !isNaN(d.getTime())
        ? Utilities.formatDate(d, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd")
        : "(공란)";
    }).join(", ");

    const mtaHasThisMonthValue = mtaRows.some(function(r){
      return isThisMonth(r["IC Booked Date"]);
    });

    if(mtaHasThisMonthValue){
      syncBugSuspect.push(
        email + " — Leads_OPS IC Booked Date=" + opsBookedValues +
        " / MTA_Master엔 이번 달 값 존재(sync 안 됨, 버그 의심)"
      );
    } else if(mtaRows.length > 0){
      mtaMissingValue.push(
        email + " — Leads_OPS IC Booked Date=" + opsBookedValues +
        " / MTA_Master 터치 " + mtaRows.length + "건 있으나 이번 달 IC Booked Date 값 없음"
      );
    } else {
      mtaMissingTouch.push(
        email + " — Leads_OPS IC Booked Date=" + opsBookedValues +
        " / MTA_Master에 이 Email의 터치 자체가 없음"
      );
    }

  });

  Logger.log("========== Salesforce IC Booked(이번 달, " + SALESFORCE_IC_BOOKED_EMAILS.length + "건) vs 파이프라인 대조 ==========");
  Logger.log("정상 일치(Leads_OPS IC Booked Date=이번 달)         : " + ok.length);
  Logger.log("Leads_Master에도 없음(Import 누락 의심)             : " + notInMaster.length);
  Logger.log("Leads_Master엔 있는데 Leads_OPS엔 없음(mergeOPS 제외): " + notInOps.length);
  Logger.log("MTA_Master엔 이번 달 값 있는데 미동기화(sync 버그)   : " + syncBugSuspect.length);
  Logger.log("MTA_Master 터치는 있는데 이번 달 값 자체가 없음      : " + mtaMissingValue.length);
  Logger.log("MTA_Master에 터치 자체가 없음                        : " + mtaMissingTouch.length);

  Logger.log("");
  Logger.log("---- Leads_Master에도 없음 (" + notInMaster.length + "건) ----");
  notInMaster.forEach(function(line){ Logger.log(line); });

  Logger.log("");
  Logger.log("---- Leads_Master엔 있는데 Leads_OPS엔 없음 (" + notInOps.length + "건) ----");
  notInOps.forEach(function(line){ Logger.log(line); });

  Logger.log("");
  Logger.log("---- MTA_Master엔 이번 달 값 있는데 미동기화 — sync 버그 의심 (" + syncBugSuspect.length + "건) ----");
  syncBugSuspect.forEach(function(line){ Logger.log(line); });

  Logger.log("");
  Logger.log("---- MTA_Master 터치는 있는데 이번 달 IC Booked Date 값 자체가 없음 (" + mtaMissingValue.length + "건) ----");
  mtaMissingValue.forEach(function(line){ Logger.log(line); });

  Logger.log("");
  Logger.log("---- MTA_Master에 터치 자체가 없음 (" + mtaMissingTouch.length + "건) ----");
  mtaMissingTouch.forEach(function(line){ Logger.log(line); });

}


/**
 * ==========================================================
 * Compare IC Complete (This Month) Against Salesforce
 *
 * WHY
 * IC Booked 쪽에서 쓴 것과 동일한 방법론(Leads_Master → Leads_OPS →
 * MTA_Master 원본 순 단계별 대조)을 IC Completed Date에도 그대로
 * 적용 — runSyncMTAFunnelToOPS() 재실행 후에도 ACQ_REP IC Complete가
 * 7(Salesforce는 22)로 그대로라, 이번엔 sync 지연이 아니라 다른
 * 원인(예: 애초에 Complete가 아니라 Booked만 필터된 리스트를 받았을
 * 가능성, 또는 IC Completed Date 필드 자체의 export 문제)일 수 있어
 * 확인 필요.
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 * ==========================================================
 */
function runCompareICCompleteAugustAgainstSalesforce(){

  const SALESFORCE_IC_COMPLETE_EMAILS = [
    "jackiek75@gmail.com", "wooooow79@naver.com", "giyoun_lee@naver.com",
    "jeeyoon79@naver.com", "jinhee.jang@gmail.com", "micyoo@gmail.com",
    "whereur10@gmail.com", "tabbyy77@gmail.com", "gracebbcjin@gmail.com",
    "baramein@gmail.com", "ian.han0408@gmail.com", "ands82@naver.com",
    "i.m.dasom@gmail.com", "rrxaun@gmail.com", "luciajuly77@gmail.com",
    "eun_ji_kim@bat.com", "ywsahn@gmail.com", "li36682@gmail.com",
    "choi.jongsok@gmail.com", "chiwupark@gmail.com", "redrock333@yahoo.com"
  ];

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const opsSheet = ss.getSheetByName(OPS.SHEET.OPS);
  const masterSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS_MASTER);
  const mtaSheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);

  if(!opsSheet){ Logger.log(OPS.SHEET.OPS + " 시트를 찾을 수 없습니다."); return; }
  if(!masterSheet){ Logger.log(CONFIG.SHEETS.LEADS_MASTER + " 시트를 찾을 수 없습니다."); return; }
  if(!mtaSheet){ Logger.log(CONFIG.SHEETS.MTA_MASTER + " 시트를 찾을 수 없습니다."); return; }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  function isThisMonth(date){
    return date instanceof Date && !isNaN(date.getTime()) &&
      date.getFullYear() === year && date.getMonth() === month;
  }

  function normEmail(v){
    return String(v || "").trim().toLowerCase();
  }

  function groupByEmail(records){
    const map = {};
    records.forEach(function(r){
      const email = normEmail(r["Email"]);
      if(!email) return;
      if(!map[email]) map[email] = [];
      map[email].push(r);
    });
    return map;
  }

  const opsByEmail = groupByEmail(sheetToObjects(opsSheet));
  const masterByEmail = groupByEmail(sheetToObjects(masterSheet));
  const mtaByEmail = groupByEmail(sheetToObjects(mtaSheet));

  const notInMaster = [];
  const notInOps = [];
  const syncBugSuspect = [];
  const mtaMissingValue = [];
  const mtaMissingTouch = [];
  const ok = [];

  SALESFORCE_IC_COMPLETE_EMAILS.forEach(function(rawEmail){

    const email = normEmail(rawEmail);

    const masterRows = masterByEmail[email] || [];
    const opsRows = opsByEmail[email] || [];
    const mtaRows = mtaByEmail[email] || [];

    if(masterRows.length === 0){
      notInMaster.push(email);
      return;
    }

    if(opsRows.length === 0){
      notInOps.push(
        email + " — Leads_Master엔 있음(Lead ID=" +
        masterRows.map(function(r){ return r["Lead ID"]; }).join(", ") + ")"
      );
      return;
    }

    const anyOpsCompleteThisMonth = opsRows.some(function(r){
      return isThisMonth(r["IC Completed Date"]);
    });

    if(anyOpsCompleteThisMonth){
      ok.push(email);
      return;
    }

    const opsCompleteValues = opsRows.map(function(r){
      const d = r["IC Completed Date"];
      return d instanceof Date && !isNaN(d.getTime())
        ? Utilities.formatDate(d, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd")
        : "(공란)";
    }).join(", ");

    const mtaHasThisMonthValue = mtaRows.some(function(r){
      return isThisMonth(r["IC Completed Date"]);
    });

    if(mtaHasThisMonthValue){
      syncBugSuspect.push(
        email + " — Leads_OPS IC Completed Date=" + opsCompleteValues +
        " / MTA_Master엔 이번 달 값 존재(sync 안 됨, 버그 의심)"
      );
    } else if(mtaRows.length > 0){
      mtaMissingValue.push(
        email + " — Leads_OPS IC Completed Date=" + opsCompleteValues +
        " / MTA_Master 터치 " + mtaRows.length + "건 있으나 이번 달 IC Completed Date 값 없음"
      );
    } else {
      mtaMissingTouch.push(
        email + " — Leads_OPS IC Completed Date=" + opsCompleteValues +
        " / MTA_Master에 이 Email의 터치 자체가 없음"
      );
    }

  });

  Logger.log("========== Salesforce IC Complete(이번 달, " + SALESFORCE_IC_COMPLETE_EMAILS.length + "건) vs 파이프라인 대조 ==========");
  Logger.log("정상 일치(Leads_OPS IC Completed Date=이번 달)        : " + ok.length);
  Logger.log("Leads_Master에도 없음(Import 누락 의심)               : " + notInMaster.length);
  Logger.log("Leads_Master엔 있는데 Leads_OPS엔 없음(mergeOPS 제외)  : " + notInOps.length);
  Logger.log("MTA_Master엔 이번 달 값 있는데 미동기화(sync 버그)     : " + syncBugSuspect.length);
  Logger.log("MTA_Master 터치는 있는데 이번 달 값 자체가 없음        : " + mtaMissingValue.length);
  Logger.log("MTA_Master에 터치 자체가 없음                          : " + mtaMissingTouch.length);

  Logger.log("");
  Logger.log("---- Leads_Master에도 없음 (" + notInMaster.length + "건) ----");
  notInMaster.forEach(function(line){ Logger.log(line); });

  Logger.log("");
  Logger.log("---- Leads_Master엔 있는데 Leads_OPS엔 없음 (" + notInOps.length + "건) ----");
  notInOps.forEach(function(line){ Logger.log(line); });

  Logger.log("");
  Logger.log("---- MTA_Master엔 이번 달 값 있는데 미동기화 — sync 버그 의심 (" + syncBugSuspect.length + "건) ----");
  syncBugSuspect.forEach(function(line){ Logger.log(line); });

  Logger.log("");
  Logger.log("---- MTA_Master 터치는 있는데 이번 달 IC Completed Date 값 자체가 없음 (" + mtaMissingValue.length + "건) ----");
  mtaMissingValue.forEach(function(line){ Logger.log(line); });

  Logger.log("");
  Logger.log("---- MTA_Master에 터치 자체가 없음 (" + mtaMissingTouch.length + "건) ----");
  mtaMissingTouch.forEach(function(line){ Logger.log(line); });

}


/**
 * ==========================================================
 * Dump IC Booked Missing-Value Touch Timeline
 *
 * WHY
 * runCompareICBookedAugustAgainstSalesforce() 1차 실행 결과, 22건 갭 중
 * 18건이 "MTA_Master 터치는 있는데 이번 달 IC Booked Date 값 자체가
 * 없음" 버킷에 집중됐다. IC Booked Date는 Lead 레벨 스냅샷 필드라
 * 리드가 새로 터치될 때만 갱신되므로, 실제 원인이 "값이 아예 없음"인지
 * "가장 최근 터치가 오래돼서(=그 이후 새 터치가 없어서) 최신 상태를
 * 못 실은 것"인지 구분하려면 각 리드의 전체 터치 타임라인(MTA Created
 * Date별 IC Booked/Completed/Sales Accepted/Won Date 스냅샷)을 직접
 * 봐야 한다.
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 *
 * INPUT: 없음 (MTA_Master 직접 스캔, 대상 Email 목록은 1차 실행 결과를
 *   하드코딩)
 * OUTPUT: Logger.log만
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 조사 스크립트(TEMPQA 관례).
 * ==========================================================
 */
function runDumpICBookedMissingValueTimeline(){

  const TARGET_EMAILS = [
    "ssong508@gmail.com", "happysahngmi@gmail.com", "pchanmi.ad@gmail.com",
    "inigahn@gmail.com", "ssy003@gmail.com", "help@tonny.net",
    "vn79young@hanmail.net", "songcm2027@tciscommunity.com", "hisunwoo2023@gmail.com",
    "cyr.vtr@gmail.com", "sung.pyun@speclipse.com", "bgfnccoo@gmail.com",
    "heisyou@gmail.com", "jackiek75@gmail.com", "giyoun_lee@naver.com",
    "jinhee.jang@gmail.com", "baramein@gmail.com", "ands82@naver.com",
    "redrock333@yahoo.com"
  ];

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const mtaSheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);

  if(!mtaSheet){ Logger.log(CONFIG.SHEETS.MTA_MASTER + " 시트를 찾을 수 없습니다."); return; }

  function normEmail(v){
    return String(v || "").trim().toLowerCase();
  }

  function fmt(d){
    return d instanceof Date && !isNaN(d.getTime())
      ? Utilities.formatDate(d, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd")
      : "(공란)";
  }

  const mtaByEmail = {};

  sheetToObjects(mtaSheet).forEach(function(r){
    const email = normEmail(r["Email"]);
    if(!email) return;
    if(!mtaByEmail[email]) mtaByEmail[email] = [];
    mtaByEmail[email].push(r);
  });

  const now = new Date();

  TARGET_EMAILS.forEach(function(email){

    const rows = (mtaByEmail[email] || []).slice().sort(function(a, b){
      const da = a["MTA Created Date"] instanceof Date ? a["MTA Created Date"].getTime() : 0;
      const db = b["MTA Created Date"] instanceof Date ? b["MTA Created Date"].getTime() : 0;
      return da - db;
    });

    Logger.log("========== " + email + " (터치 " + rows.length + "건) ==========");

    rows.forEach(function(r, i){

      const touchDate = r["MTA Created Date"];
      const daysSinceTouch = touchDate instanceof Date && !isNaN(touchDate.getTime())
        ? Math.round((now.getTime() - touchDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      Logger.log(
        "  [" + (i + 1) + "] MTA Created Date=" + fmt(touchDate) +
        (daysSinceTouch !== null ? " (" + daysSinceTouch + "일 전)" : "") +
        " / IC Booked Date=" + fmt(r["IC Booked Date"]) +
        " / IC Completed Date=" + fmt(r["IC Completed Date"]) +
        " / Sales Accepted Date=" + fmt(r["Sales Accepted Date"]) +
        " / Opportunity Won Date=" + fmt(r["Opportunity Won Date"]) +
        " / Campaign=" + (r["MKT UTM Campaign"] || "")
      );

    });

    Logger.log("");

  });

}


/**
 * ==========================================================
 * Trace redrock333@yahoo.com Sync Gap
 *
 * WHY
 * 2차 실행 결과, redrock333@yahoo.com은 MTA_Master에 이번 달 IC Booked
 * Date(2026-08-19) 값이 있는데도 Leads_OPS엔 공란으로 남아있음 —
 * 나머지 18건(정상적인 export 시차)과 달리 이 1건만 진짜 sync 버그로
 * 보인다. syncMTAFunnelToOPS_()는 Lead ID를 매칭 키로 쓰므로, 가장
 * 유력한 가설은 MTA_Master 이 터치의 Lead ID와 Leads_OPS에 남아있는
 * (mergeOPS earliest-wins가 채택한) Lead ID가 서로 다른 경우 — 2026-08-05
 * New P1 사고(00QRC00001IUkqX)와 동일한 패턴 가능성. Lead ID를 직접
 * 대조해 확인한다.
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 * ==========================================================
 */
function runTraceRedrock333SyncGap(){

  const EMAIL = "redrock333@yahoo.com";

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const opsSheet = ss.getSheetByName(OPS.SHEET.OPS);
  const masterSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS_MASTER);
  const mtaSheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);

  function normEmail(v){ return String(v || "").trim().toLowerCase(); }

  const opsRows = sheetToObjects(opsSheet).filter(function(r){ return normEmail(r["Email"]) === EMAIL; });
  const masterRows = sheetToObjects(masterSheet).filter(function(r){ return normEmail(r["Email"]) === EMAIL; });
  const mtaRows = sheetToObjects(mtaSheet).filter(function(r){ return normEmail(r["Email"]) === EMAIL; });

  Logger.log("========== " + EMAIL + " — Lead ID 대조 ==========");

  Logger.log("-- Leads_OPS (" + opsRows.length + "건) --");
  opsRows.forEach(function(r){
    Logger.log(
      "  Lead ID=" + r["Lead ID"] + " / IC Booked Date=" + r["IC Booked Date"] +
      " / Create Date=" + r["Create Date"]
    );
  });

  Logger.log("-- Leads_Master (" + masterRows.length + "건) --");
  masterRows.forEach(function(r){
    Logger.log("  Lead ID=" + r["Lead ID"] + " / Create Date=" + r["Create Date"]);
  });

  Logger.log("-- MTA_Master (" + mtaRows.length + "건) --");
  mtaRows.forEach(function(r){
    Logger.log(
      "  Lead ID=" + r["Lead ID"] + " / MTA Created Date=" + r["MTA Created Date"] +
      " / IC Booked Date=" + r["IC Booked Date"]
    );
  });

}
