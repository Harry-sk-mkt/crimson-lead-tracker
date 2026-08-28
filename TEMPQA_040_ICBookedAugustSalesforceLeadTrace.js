/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — 8월 IC Booked(52) vs ACQ_REP(43) 리드 단위 대조
 * (docs/OpenItems.md #32 후속 조사, 사용자가 제공한 Salesforce
 * IC Booked 리포트 CSV 전체 52건 기준 — IC Complete는 30/30으로
 * 이미 일치 확인돼 Booked 갭만 대상으로 함)
 *
 * Responsibility
 * TEMPQA_036 실측 결과, ACQ_REP IC Booked(43)는 화면과 원본 재계산이
 * 일치해 캐시 지연이 아니라 진짜 데이터 갭으로 확인됨. 사용자가 제공한
 * Salesforce 8월 IC Booked 리포트(52건, Email + IC Booked Date 포함)를
 * Leads_Master/Leads_OPS와 Lead 단위로 1:1 대조해 9건 갭의 정확한 원인을
 * 좁힌다(#20/#27/#32/#37과 동일한 방법론).
 *
 * 분류:
 * (1) Leads_Master에도 없음 — Import 공백
 * (2) Leads_Master엔 있는데 Leads_OPS엔 없음 — mergeOPS() earliest-wins
 *     로 배제
 * (3) 둘 다 있음, Leads_OPS의 IC Booked Date가 Salesforce와 다르거나
 *     비어있음 — 동기화 지연/누락(ICFunnel_Raw sync 관련 확인 필요)
 * (4) 정상 일치(같은 날짜)
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 *
 * INPUT: 없음 (Leads_Master/Leads_OPS 직접 스캔, Salesforce 목록은
 *   사용자가 제공한 CSV에서 채굴해 하드코딩. Email 기준 매칭 — 이
 *   리포트엔 Lead ID가 없어 Email로 매칭, mergeOPS()도 원래 Email
 *   그룹핑 기준이라 일관됨)
 * OUTPUT: Logger.log만
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 조사 스크립트(TEMPQA 관례).
 *
 * Version
 * v1.1.0
 *
 * Change Log
 * v1.1.0 (2026-08-28)
 * - runCompareAugustICBookedAgainstSalesforce() 실행 결과 5건이
 *   runSyncICFunnelToOPS() 재실행 후에도 그대로임 — 대조 스크립트는
 *   Email 기준인데 실제 sync는 Lead ID 기준이라 Lead ID 불일치를
 *   의심, runTraceICBookedSyncGapLeadIds() 신규 추가.
 * v1.0.0 (2026-08-28)
 * - 최초 구현.
 * ==========================================================
 */
function runCompareAugustICBookedAgainstSalesforce(){

  // [Email, Salesforce IC Booked Date(day-first 텍스트, 시간 포함)]
  const SALESFORCE_IC_BOOKED = [
    ["mini37510@naver.com","26/8/2026, 2:43 pm"],
    ["ssong508@gmail.com","10/8/2026, 5:56 pm"],
    ["happysahngmi@gmail.com","20/8/2026, 1:42 pm"],
    ["julia.cheon@yahoo.com","26/8/2026, 4:52 pm"],
    ["pchanmi.ad@gmail.com","13/8/2026, 4:50 pm"],
    ["jeun_young@naver.com","7/8/2026, 3:46 pm"],
    ["mpilaniwala@gmail.com","26/8/2026, 2:35 pm"],
    ["inigahn@gmail.com","24/8/2026, 6:51 pm"],
    ["ssy003@gmail.com","25/8/2026, 2:18 pm"],
    ["mdleebs@gmail.com","5/8/2026, 6:07 pm"],
    ["vn79young@hanmail.net","7/8/2026, 5:11 pm"],
    ["washgoo@gmail.com","10/8/2026, 6:38 pm"],
    ["lsuny98@gmail.com","26/8/2026, 7:12 pm"],
    ["hisunwoo2023@gmail.com","3/8/2026, 2:08 pm"],
    ["cyr.vtr@gmail.com","5/8/2026, 4:29 pm"],
    ["joohi82@naver.com","3/8/2026, 8:20 pm"],
    ["sung.pyun@speclipse.com","25/8/2026, 5:27 pm"],
    ["bgfnccoo@gmail.com","19/8/2026, 8:57 pm"],
    ["heisyou@gmail.com","25/8/2026, 2:45 pm"],
    ["k29870950@gmail.com","25/8/2026, 10:56 pm"],
    ["sunife@hotmail.com","26/8/2026, 6:38 pm"],
    ["netykim9797@naver.com","26/8/2026, 2:41 pm"],
    ["yeonwooobear@gmail.com","4/8/2026, 4:42 pm"],
    ["jackiek75@gmail.com","6/8/2026, 3:05 pm"],
    ["wooooow79@naver.com","5/8/2026, 5:00 pm"],
    ["giyoun_lee@naver.com","18/8/2026, 4:22 pm"],
    ["tgyoush@gmail.com","20/8/2026, 4:37 pm"],
    ["jeeyoon79@naver.com","11/8/2026, 5:36 pm"],
    ["avecmgr@gmail.com","26/8/2026, 1:36 pm"],
    ["jinhee.jang@gmail.com","12/8/2026, 4:10 pm"],
    ["micyoo@gmail.com","6/8/2026, 1:54 pm"],
    ["whereur10@gmail.com","12/8/2026, 5:51 pm"],
    ["tabbyy77@gmail.com","7/8/2026, 2:27 pm"],
    ["lyj79bada@gmail.com","13/8/2026, 2:36 pm"],
    ["samchuchu89@gmail.com","26/8/2026, 1:00 am"],
    ["help@tonny.net","18/8/2026, 4:20 pm"],
    ["dugong0907@gmail.com","25/8/2026, 7:04 pm"],
    ["gracebbcjin@gmail.com","12/8/2026, 2:40 pm"],
    ["baramein@gmail.com","3/8/2026, 5:28 pm"],
    ["songcm2027@tciscommunity.com","24/8/2026, 9:04 pm"],
    ["ian.han0408@gmail.com","19/8/2026, 3:02 pm"],
    ["ands82@naver.com","12/8/2026, 6:09 pm"],
    ["i.m.dasom@gmail.com","6/8/2026, 5:39 pm"],
    ["behappy12123@gmail.com","14/8/2026, 3:06 pm"],
    ["rrxaun@gmail.com","3/8/2026, 5:55 pm"],
    ["luciajuly77@gmail.com","4/8/2026, 3:04 pm"],
    ["eun_ji_kim@bat.com","5/8/2026, 8:17 pm"],
    ["ywsahn@gmail.com","5/8/2026, 6:34 pm"],
    ["li36682@gmail.com","6/8/2026, 5:00 pm"],
    ["choi.jongsok@gmail.com","6/8/2026, 5:16 pm"],
    ["chiwupark@gmail.com","10/8/2026, 7:41 pm"],
    ["redrock333@yahoo.com","19/8/2026, 1:53 pm"]  ];

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const masterSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS_MASTER);
  const opsSheet = ss.getSheetByName(OPS.SHEET.OPS);

  if(!masterSheet){ Logger.log(CONFIG.SHEETS.LEADS_MASTER + " 시트를 찾을 수 없습니다."); return; }
  if(!opsSheet){ Logger.log(OPS.SHEET.OPS + " 시트를 찾을 수 없습니다."); return; }

  function normEmail(v){ return String(v || "").trim().toLowerCase(); }

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

  const masterByEmail = groupByEmail(sheetToObjects(masterSheet));
  const opsByEmail = groupByEmail(sheetToObjects(opsSheet));

  function fmt(d){
    return d instanceof Date && !isNaN(d.getTime())
      ? Utilities.formatDate(d, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd")
      : "(공란)";
  }

  const notInMaster = [];
  const notInOps = [];
  const syncMissing = [];
  const dateMismatch = [];
  const ok = [];

  SALESFORCE_IC_BOOKED.forEach(function(row){

    const email = normEmail(row[0]);
    const sfBookedDate = parseDate(row[1], "DMY");

    const masterRows = masterByEmail[email] || [];

    if(masterRows.length === 0){
      notInMaster.push(email + " (SF IC Booked=" + row[1] + ")");
      return;
    }

    const opsRows = opsByEmail[email] || [];

    if(opsRows.length === 0){
      notInOps.push(
        email + " (SF IC Booked=" + row[1] + ") — Leads_Master Lead ID=" +
        masterRows.map(function(r){ return r["Lead ID"]; }).join(", ")
      );
      return;
    }

    const sfBookedDateStr = fmt(sfBookedDate);

    const matchingOpsRow = opsRows.find(function(r){
      return fmt(r["IC Booked Date"]) === sfBookedDateStr;
    });

    if(matchingOpsRow){
      ok.push(email);
      return;
    }

    const opsBookedValues = opsRows.map(function(r){ return fmt(r["IC Booked Date"]); }).join(", ");

    if(opsRows.every(function(r){ return !(r["IC Booked Date"] instanceof Date) || isNaN(r["IC Booked Date"].getTime()); })){
      syncMissing.push(
        email + " (SF IC Booked=" + sfBookedDateStr + ") — Leads_OPS IC Booked Date 공란"
      );
    } else {
      dateMismatch.push(
        email + " — SF IC Booked=" + sfBookedDateStr + " / Leads_OPS IC Booked Date=" + opsBookedValues
      );
    }

  });

  Logger.log("========== Salesforce 8월 IC Booked(" + SALESFORCE_IC_BOOKED.length + "건) vs 파이프라인 대조 ==========");
  Logger.log("정상 일치                                             : " + ok.length);
  Logger.log("Leads_Master에도 없음(Import 공백)                    : " + notInMaster.length);
  Logger.log("Leads_Master엔 있는데 Leads_OPS엔 없음(mergeOPS 배제) : " + notInOps.length);
  Logger.log("Leads_OPS IC Booked Date 공란(동기화 누락)            : " + syncMissing.length);
  Logger.log("Leads_OPS IC Booked Date 있으나 값 다름               : " + dateMismatch.length);

  Logger.log("");
  Logger.log("---- Leads_Master에도 없음 (" + notInMaster.length + "건) ----");
  notInMaster.forEach(function(line){ Logger.log(line); });

  Logger.log("");
  Logger.log("---- Leads_Master엔 있는데 Leads_OPS엔 없음 (" + notInOps.length + "건) ----");
  notInOps.forEach(function(line){ Logger.log(line); });

  Logger.log("");
  Logger.log("---- Leads_OPS IC Booked Date 공란(동기화 누락) (" + syncMissing.length + "건) ----");
  syncMissing.forEach(function(line){ Logger.log(line); });

  Logger.log("");
  Logger.log("---- Leads_OPS IC Booked Date 있으나 값 다름 (" + dateMismatch.length + "건) ----");
  dateMismatch.forEach(function(line){ Logger.log(line); });

}


/**
 * ==========================================================
 * Trace IC Booked Sync Gap Lead IDs
 *
 * WHY
 * runCompareAugustICBookedAgainstSalesforce()가 찾은 5건이
 * runSyncICFunnelToOPS() 재실행 후에도 그대로임 — 대조 스크립트는
 * Email 기준인데 실제 sync(syncICFunnelToOPS_())는 Lead ID 기준으로
 * 매칭하므로, ICFunnel_Raw의 Lead ID와 Leads_OPS에 실제로 남아있는
 * (mergeOPS()가 채택한) Lead ID가 서로 다른 경우(#20 redrock333@yahoo.com
 * 케이스와 동일 패턴)를 의심 — Lead ID를 직접 대조해 확인한다.
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 * ==========================================================
 */
function runTraceICBookedSyncGapLeadIds(){

  const EMAILS = [
    "mini37510@naver.com", "mpilaniwala@gmail.com", "lsuny98@gmail.com",
    "sunife@hotmail.com", "netykim9797@naver.com"
  ];

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const masterSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS_MASTER);
  const opsSheet = ss.getSheetByName(OPS.SHEET.OPS);
  const icFunnelSheet = ss.getSheetByName(CONFIG.IC_FUNNEL.SHEET);

  function normEmail(v){ return String(v || "").trim().toLowerCase(); }

  const masterRecords = sheetToObjects(masterSheet);
  const opsRecords = sheetToObjects(opsSheet);
  const icFunnelRecords = icFunnelSheet ? sheetToObjects(icFunnelSheet) : [];

  function normId(v){ return String(v || "").trim(); }

  EMAILS.forEach(function(email){

    Logger.log("========== " + email + " ==========");

    const masterRows = masterRecords.filter(function(r){ return normEmail(r["Email"]) === email; });
    const opsRows = opsRecords.filter(function(r){ return normEmail(r["Email"]) === email; });

    Logger.log("-- Leads_Master (" + masterRows.length + "건) --");
    masterRows.forEach(function(r){
      Logger.log("  Lead ID=" + r["Lead ID"] + " / Create Date=" + r["Create Date"]);
    });

    Logger.log("-- Leads_OPS (" + opsRows.length + "건) --");
    opsRows.forEach(function(r){
      Logger.log(
        "  Lead ID=" + r["Lead ID"] + " / IC Booked Date=" + r["IC Booked Date"] +
        " / Create Date=" + r["Create Date"]
      );
    });

    // ICFunnel_Raw엔 Email 컬럼이 없을 수 있어(확인 안 됨) Lead ID로 조회
    // (위 Leads_Master/Leads_OPS에서 뽑은 Lead ID 전부 대상)
    const relatedLeadIds = {};
    masterRows.concat(opsRows).forEach(function(r){
      const id = normId(r["Lead ID"]);
      if(id) relatedLeadIds[id] = true;
    });

    const icFunnelRows = icFunnelRecords.filter(function(r){
      return relatedLeadIds[normId(r["Lead ID"])];
    });

    Logger.log("-- ICFunnel_Raw (Lead ID 매칭 기준, " + icFunnelRows.length + "건) --");
    icFunnelRows.forEach(function(r){
      Logger.log(
        "  Lead ID=" + r["Lead ID"] + " / IC Booked Date=" + r["IC Booked Date"]
      );
    });

  });

}
