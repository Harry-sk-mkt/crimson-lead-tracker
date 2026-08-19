/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — Sales Accepted Date 오염 범위 재감사, Asia/Seoul 기준
 * (docs/OpenItems.md #26 후속, TEMPQA_007의 타임존 버그 수정판)
 *
 * Responsibility
 * TEMPQA_019에서 확인된 근본 원인: TEMPQA_007_SalesAcceptedDateAudit.js/
 * TEMPQA_008_SalesAcceptedDateRepair.js가 day/month swap 여부를 판정할 때
 * `Date.getDate()`/`.getMonth()`를 그대로 호출했는데, 이 JS Date getter는
 * **스크립트 실행 타임존(America/New_York, appsscript.json)** 기준으로
 * 동작한다. 하지만 실제 corruption 메커니즘(Google Sheets가 텍스트를
 * Date로 자동 변환)은 **스프레드시트 자체 타임존(Asia/Seoul)** 기준으로
 * 값을 구성하므로, 두 타임존 사이 시차(최대 13~14시간)로 인해 자정
 * 전후(대략 00:00~13:xx KST) 시각을 가진 레코드는 NY 기준 day가 Seoul
 * 기준 day와 달라질 수 있다 — 이게 두 가지 오분류를 만들 수 있음:
 *   (C) Seoul day<=12(진짜 swap 후보)인데 NY day>12로 보여 원래 스캔에서
 *       누락된 건(TEMPQA_013/018/019로 실측된 8건이 이 버킷 — 전부
 *       Seoul 기준 day=1).
 *   (B) Seoul day>12(원래 안전)인데 NY day<=12로 보여 TEMPQA_008이 잘못
 *       swap-back을 적용했을 수 있는 건(아직 미확인 — 이 스크립트로 처음
 *       확인).
 * 이 스크립트는 MTA_Master 전체(리드 대표 터치 기준, TEMPQA_007과 동일
 * 모집단)를 Asia/Seoul 기준 day/month로 재분류해 A/B/C/D 네 버킷 규모를
 * 센다. **읽기 전용** — 아무것도 쓰지 않음(TEMPQA_007과 동일 관례).
 *
 * 버킷 정의
 * A: NY ambiguous(day<=12) AND Seoul ambiguous  — 두 타임존이 동의, 원래
 *    스캔이 맞게 처리(이미 TEMPQA_008로 swap-back 완료된 상태 그대로 정상).
 * B: NY ambiguous AND Seoul NOT ambiguous        — **위험**: 원래 스캔이
 *    "오염"으로 잘못 판단해 TEMPQA_008이 실제로는 정상이었던 날짜를 잘못
 *    swap했을 가능성 — 개별 확인 필요.
 * C: NY NOT ambiguous AND Seoul ambiguous        — **위험**: 원래 스캔이
 *    놓친 진짜 오염 후보(TEMPQA_018에서 발견된 8건이 이 버킷에 해당하는지
 *    교차 확인용) — 아직 복구 안 됨.
 * D: 둘 다 NOT ambiguous                          — 두 타임존 모두 안전
 *    (조치 불필요).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-08-20)
 * - 최초 구현.
 * ==========================================================
 */
function runReauditSalesAcceptedDateTimezone(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const mtaSheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);

  if(!mtaSheet){
    Logger.log("MTA_Master sheet not found.");
    return;
  }

  const mtaRecords = sheetToObjects(mtaSheet);
  const funnelByLeadId = computeMTAFunnelByLeadId_(mtaRecords);

  const opsSheet = ss.getSheetByName(OPS.SHEET.OPS);
  const opsRecords = opsSheet ? sheetToObjects(opsSheet) : [];

  const emailByLeadId = {};

  opsRecords.forEach(function(r){
    const id = String(r["Lead ID"] || "").trim();
    if(id) emailByLeadId[id] = r["Email"];
  });

  function extractSeoulDayMonthYear(date){

    const text = Utilities.formatDate(date, "Asia/Seoul", "yyyy-MM-dd");
    const parts = text.split("-");

    return {
      year: Number(parts[0]),
      month: Number(parts[1]) - 1, // 0-indexed, NY getMonth()과 형식 통일
      day: Number(parts[2])
    };

  }

  let totalWithDate = 0;

  const buckets = { A: [], B: [], C: [], D: [] };

  Object.keys(funnelByLeadId).forEach(function(leadId){

    const salDate = funnelByLeadId[leadId].salesAcceptedDate;

    if(!(salDate instanceof Date) || isNaN(salDate.getTime())) return;

    totalWithDate++;

    const nyDay = salDate.getDate();
    const nyMonth = salDate.getMonth();

    const seoul = extractSeoulDayMonthYear(salDate);

    const nyAmbiguous = nyDay <= 12;
    const seoulAmbiguous = seoul.day <= 12;

    const entry = {
      leadId: leadId,
      email: emailByLeadId[leadId] || "",
      nyValue: Utilities.formatDate(salDate, "America/New_York", "yyyy-MM-dd"),
      seoulValue: Utilities.formatDate(salDate, "Asia/Seoul", "yyyy-MM-dd")
    };

    if(nyAmbiguous && seoulAmbiguous){
      buckets.A.push(entry);
    } else if(nyAmbiguous && !seoulAmbiguous){
      buckets.B.push(entry);
    } else if(!nyAmbiguous && seoulAmbiguous){
      buckets.C.push(entry);
    } else {
      buckets.D.push(entry);
    }

  });

  Logger.log("========== Sales Accepted Date 타임존 재감사 (Asia/Seoul 기준) ==========");
  Logger.log("Sales Accepted Date 있는 리드 수 (전체) : " + totalWithDate);
  Logger.log("A (두 타임존 동의, 정상 처리됨)          : " + buckets.A.length);
  Logger.log("B (NY만 ambiguous — 잘못 swap 의심)      : " + buckets.B.length);
  Logger.log("C (Seoul만 ambiguous — 복구 누락 의심)   : " + buckets.C.length);
  Logger.log("D (둘 다 안전)                            : " + buckets.D.length);
  Logger.log("");

  function logSample(label, list, max){

    Logger.log(label + " 샘플(최대 " + max + "건):");

    list.slice(0, max).forEach(function(e){
      Logger.log(
        "  Lead ID=" + e.leadId + " / Email=" + e.email +
        " / NY=" + e.nyValue + " / Seoul=" + e.seoulValue
      );
    });

    Logger.log("");

  }

  logSample("[B] 잘못 swap 의심", buckets.B, 30);
  logSample("[C] 복구 누락 의심", buckets.C, 30);

  Logger.log("==========================================================");

}
