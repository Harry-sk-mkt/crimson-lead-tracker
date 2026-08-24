/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — S&M_REP 8/17~08/23주 New P1, Salesforce 리스트 직접 대조
 *
 * Responsibility
 * OpenItems.md #27 계속 조사. TEMPQA_025(타임존 가설, 기각)/TEMPQA_026
 * (해당 주 Leads_OPS 레코드 전체 로그)에 이어, 사용자가 Salesforce에서
 * 직접 뽑은 8/17~08/23주 New P1 Lead ID 전체 목록(75건)을 하드코딩해
 * Leads_OPS/Leads_Master와 Lead ID 단위로 1:1 대조한다. 각 Lead ID를
 * 4가지 결과로 분류:
 * (1) 정상 일치 — Leads_OPS에 그 주 New P1로 존재
 * (2) Leads_OPS에 없음 — Leads_Master에도 없으면 Import 누락 가능성,
 *     Leads_Master엔 있는데 Leads_OPS에 없으면 mergeOPS()의 Email 기준
 *     earliest-wins dedup이 같은 이메일의 다른 Lead ID를 대신 채택했을
 *     가능성(OpenItems #20과 동일 메커니즘 — 그때는 "1 Email = 1 진짜
 *     최초 접점"이 의도대로 동작한 것으로 결론났지만, 이번 케이스가 같은
 *     패턴인지 확인 필요)
 * (3) Leads_OPS엔 있지만 Create Date가 다른 주로 계산됨
 * (4) Leads_OPS엔 있지만 isEffectiveP1_()이 false(Lead Priority/Priority
 *     Override가 기대와 다름)
 * 역방향(우리 쪽엔 New P1로 잡히는데 이 리스트엔 없는 Lead ID)도 참고용으로
 * 같이 출력.
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 *
 * INPUT: 없음 (Leads_OPS/Leads_Master 직접 스캔, Salesforce 리스트는
 *   사용자가 채팅으로 전달한 값을 하드코딩)
 * OUTPUT: Logger.log만
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 조사 스크립트(TEMPQA 관례).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-08-25)
 * - 최초 구현.
 * ==========================================================
 */

function runCompareSMRepNewP1WeekAgainstSalesforce(){

  const SALESFORCE_NEW_P1_LEAD_IDS = [
    "00QRC00001LKLba", "00QRC00001LKZkz", "00QRC00001LKzUA", "00QRC00001LMiAf",
    "00QRC00001LMmnm", "00QRC00001LNBZF", "00QRC00001LOgL2", "00QRC00001LNsJH",
    "00QRC00001LPt6M", "00QRC00001LR4R8", "00QRC00001LRwtC", "00QRC00001LS3Ud",
    "00QRC00001LSj7F", "00QRC00001LTqEj", "00QRC00001LUpZx", "00QRC00001LUpDO",
    "00QRC00001LYYQr", "00QRC00001LYkbh", "00QRC00001LYshM", "00QRC00001Lai4L",
    "00QRC00001Lb591", "00QRC00001LcP41", "00QRC00001LchNW", "00QRC00001LdrG3",
    "00QRC00001LfcO5", "00QRC00001LgAO9", "00QRC00001LhDGj", "00QRC00001LheFJ",
    "00QRC00001LiHes", "00QRC00001Liddm", "00QRC00001LkXvd", "00QRC00001LkoJl",
    "00QRC00001LkCHj", "00QRC00001Lls6n", "00QRC00001LnNri", "00QRC00001LowfJ",
    "00QRC00001LrFxB", "00QRC00001Lrwqs", "00QRC00001LthJ3", "00QRC00001LuJZe",
    "00QRC00001LyUcv", "00QRC00001LyeZ3", "00QRC00001LyiZR", "00QRC00001LzevB",
    "00QRC00001LzndV", "00QRC00001M0fZ3", "00QRC00001M0yDW", "00QRC00001M17a9",
    "00QRC00001M1L21", "00QRC00001M1VmA", "00QRC00001M1hKH", "00QRC00001M1fX0",
    "00QRC00001M2CPh", "00QRC00001M1qLy", "00QRC00001M2LuP", "00QRC00001M1o0s",
    "00QRC00001M29IC", "00QRC00001M2wig", "00QRC00001M4VUf", "00QRC00001M5IOv",
    "00QRC00001M5bL7", "00QRC00001M62DG", "00QRC00001M6TJt", "00QRC00001M6nYj",
    "00QRC00001M7GCX", "00QRC00001M4jB9", "00QRC00001LLlov", "00QRC00001LhhoH",
    "00QRC00001LhjoT", "00QRC00001LhkEI", "00QRC00001Ln4qf", "00QRC00001M749m",
    "00QRC00001LRpt3", "00QRC00001Lgp9a", "00QRC00001LqPLv"
  ];

  const targetWeekKey = "2026-08-17";

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const opsSheet = ss.getSheetByName(OPS.SHEET.OPS);
  const masterSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS_MASTER);

  if(!opsSheet){
    Logger.log(OPS.SHEET.OPS + " 시트를 찾을 수 없습니다.");
    return;
  }

  if(!masterSheet){
    Logger.log(CONFIG.SHEETS.LEADS_MASTER + " 시트를 찾을 수 없습니다.");
    return;
  }

  const opsRecords = sheetToObjects(opsSheet);
  const masterRecords = sheetToObjects(masterSheet);

  const opsByLeadId = {};
  const opsByEmail = {};

  opsRecords.forEach(function(record){

    const leadId = String(record["Lead ID"] || "").trim();
    if(leadId) opsByLeadId[leadId] = record;

    const email = String(record["Email"] || "").trim().toLowerCase();

    if(email){
      if(!opsByEmail[email]) opsByEmail[email] = [];
      opsByEmail[email].push(record);
    }

  });

  const masterByLeadId = {};

  masterRecords.forEach(function(record){

    const leadId = String(record["Lead ID"] || "").trim();
    if(!leadId) return;

    if(!masterByLeadId[leadId]) masterByLeadId[leadId] = [];
    masterByLeadId[leadId].push(record);

  });

  const sfLeadIdSet = {};
  SALESFORCE_NEW_P1_LEAD_IDS.forEach(function(id){ sfLeadIdSet[id] = true; });

  const missingFromOps = [];
  const wrongWeek = [];
  const notP1 = [];
  const ok = [];

  SALESFORCE_NEW_P1_LEAD_IDS.forEach(function(leadId){

    const opsRecord = opsByLeadId[leadId];

    if(!opsRecord){

      const masterRows = masterByLeadId[leadId] || [];

      if(masterRows.length === 0){

        missingFromOps.push(
          leadId + " — Leads_Master에도 없음(Import 누락 가능성)"
        );

      } else {

        const email = String(masterRows[0]["Email"] || "").trim().toLowerCase();
        const keptForEmail = opsByEmail[email] || [];
        const keptIds = keptForEmail.map(function(r){ return r["Lead ID"]; }).join(", ") || "(없음)";

        missingFromOps.push(
          leadId + " — Leads_Master엔 있음(Email=" + email +
          ", Master 행 수=" + masterRows.length + "), Leads_OPS엔 없음 — " +
          "mergeOPS() earliest-wins가 같은 이메일의 다른 Lead ID(" + keptIds +
          ")를 대신 채택했을 가능성"
        );

      }

      return;

    }

    const createDate = opsRecord["Create Date"];
    const isP1 = isEffectiveP1_(opsRecord["Lead Priority"], opsRecord["Priority Override"]);

    if(!(createDate instanceof Date) || isNaN(createDate.getTime())){
      wrongWeek.push(leadId + " — Create Date 없음/비정상");
      return;
    }

    const weekKey = Utilities.formatDate(
      getMondayOfWeek_(createDate), CONFIG.DATE.TIMEZONE, "yyyy-MM-dd"
    );

    if(weekKey !== targetWeekKey){

      wrongWeek.push(
        leadId + " — Create Date=" +
        Utilities.formatDate(createDate, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd HH:mm") +
        " (week=" + weekKey + ", 기대=" + targetWeekKey + ")"
      );

      return;

    }

    if(!isP1){

      notP1.push(
        leadId + " — Lead Priority=" + opsRecord["Lead Priority"] +
        " / Priority Override=" + opsRecord["Priority Override"]
      );

      return;

    }

    ok.push(leadId);

  });

  //----------------------------------------------------------
  // 역방향 — 우리 쪽 New P1인데 이 리스트엔 없는 Lead ID (참고용)
  //----------------------------------------------------------

  const extraOnOurSide = [];

  opsRecords.forEach(function(record){

    const createDate = record["Create Date"];

    if(!(createDate instanceof Date) || isNaN(createDate.getTime())) return;

    const weekKey = Utilities.formatDate(
      getMondayOfWeek_(createDate), CONFIG.DATE.TIMEZONE, "yyyy-MM-dd"
    );

    if(weekKey !== targetWeekKey) return;

    const isP1 = isEffectiveP1_(record["Lead Priority"], record["Priority Override"]);
    if(!isP1) return;

    const leadId = String(record["Lead ID"] || "").trim();

    if(!sfLeadIdSet[leadId]){
      extraOnOurSide.push(leadId + " — Business Segment=" + record["Business Segment"]);
    }

  });

  Logger.log("========== Salesforce New P1 리스트(" + SALESFORCE_NEW_P1_LEAD_IDS.length + "건) vs Leads_OPS 대조 ==========");
  Logger.log("정상 일치                 : " + ok.length);
  Logger.log("Leads_OPS에 없음           : " + missingFromOps.length);
  Logger.log("다른 주로 배정됨           : " + wrongWeek.length);
  Logger.log("Leads_OPS엔 있지만 P1 아님  : " + notP1.length);
  Logger.log("(참고) 우리 쪽엔만 있음     : " + extraOnOurSide.length);

  Logger.log("");
  Logger.log("---- Leads_OPS에 없음 (" + missingFromOps.length + "건) ----");
  missingFromOps.forEach(function(line){ Logger.log(line); });

  Logger.log("");
  Logger.log("---- 다른 주로 배정됨 (" + wrongWeek.length + "건) ----");
  wrongWeek.forEach(function(line){ Logger.log(line); });

  Logger.log("");
  Logger.log("---- Leads_OPS엔 있지만 P1 아님 (" + notP1.length + "건) ----");
  notP1.forEach(function(line){ Logger.log(line); });

  Logger.log("");
  Logger.log("---- (참고) 우리 쪽엔만 New P1으로 잡힘 (" + extraOnOurSide.length + "건) ----");
  extraOnOurSide.forEach(function(line){ Logger.log(line); });

}
