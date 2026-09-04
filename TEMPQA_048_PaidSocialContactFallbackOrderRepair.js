/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — SEARCH_CATCHALL vs "_contact"/"consult" fallback 순서 버그
 * 기존 데이터 소급 반영 (TEMPQA_047 짝, 1회성 Repair)
 *
 * Responsibility
 * OpenItems.md #29 — `getBusinessSegment()`의 SEARCH_CATCHALL_LEAD_SOURCE_
 * OVERRIDES 순서 버그(UTIL_001_TransformHelper.js v1.21.0에서 코드 수정
 * 완료)가 이미 Leads_Master/MTA_Master에 기록해둔 행(Business Segment=
 * "Other")에는 자동 반영되지 않으므로, TEMPQA_047과 동일한 판정 조건으로
 * 대상 행을 다시 찾아 Business Segment 컬럼만 직접 "BOFU"로 갱신한다.
 * Full Rebuild(전체 재계산, 다른 드리프트까지 함께 쓸림)가 아니라 이번에
 * 확정된 이 순서 버그 영향분(Leads 17건/MTA 42건, 2026-09-04 TEMPQA_047
 * 실측)만 정확히 타겟팅 — 사용자 확정(2026-09-04).
 *
 * 판정 조건(TEMPQA_047과 동일, 반드시 일치시킬 것 — 다르면 대상 건수가
 * 갈라짐): Business Segment === "Other" && leadSource(lower)가
 * ["paid social","affiliate organization","offline outreach"] 중 하나 &&
 * campaign(lower)에 "_contact"/"contact"/"consult" 포함. 이 3개 leadSource는
 * 전부 "search"를 포함하지 않으므로 새 로직상 결과는 항상 "BOFU".
 *
 * **Raw는 건드리지 않음** — Master 시트의 "Business Segment" 컬럼 값만
 * 직접 수정(Raw 원본 자체가 잘못된 게 아니라 파생 컬럼 계산 로직이 최근까지
 * 버그였던 경우라 Raw 불변 원칙과 무관, TEMPQA_008/021의 Raw 직접 수정과는
 * 성격이 다름).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-09-04)
 * - 최초 구현.
 * ==========================================================
 */


/**
 * ==========================================================
 * Repair Paid Social Contact Fallback Order Segments (수동 실행 진입점)
 * ==========================================================
 */
function runRepairPaidSocialContactFallbackOrderSegments(){

  const overrideLeadSources = ["paid social", "affiliate organization", "offline outreach"];

  Logger.log("========== Leads_Master ==========");
  repairFallbackOrderSegmentsOnMaster_(
    readLeadsMasterRowsWithIndex_(),
    CONFIG.SHEETS.LEADS_MASTER,
    function(record){
      return {
        campaign: record["First MKT UTM Campaign"],
        leadSource: record["First Lead Source"],
        segment: record["Business Segment"],
        id: record["Lead ID"]
      };
    },
    overrideLeadSources
  );

  Logger.log("");
  Logger.log("========== MTA_Master ==========");
  repairFallbackOrderSegmentsOnMaster_(
    readMTAMasterRowsWithIndex_(),
    CONFIG.SHEETS.MTA_MASTER,
    function(record){
      return {
        campaign: record["MKT UTM Campaign"],
        // ⚠️ MTA_Master 저장 컬럼명은 "First Lead Source"다 — TEMPQA_034/047
        // 참고(MASTER_007_MTATransformer.js가 raw "Lead Source"를 리네임해 저장).
        leadSource: record["First Lead Source"],
        segment: record["Business Segment"],
        id: record["Lead ID"]
      };
    },
    overrideLeadSources
  );

}


/**
 * ==========================================================
 * Repair Fallback Order Segments On Master (IO 래퍼)
 *
 * WHY
 * Leads_Master/MTA_Master 양쪽에서 동일한 판정+쓰기 로직을 재사용 —
 * rowToArgs로 필드명 차이만 흡수(TEMPQA_047과 동일 패턴).
 * ==========================================================
 */
function repairFallbackOrderSegmentsOnMaster_(rowsWithIndex, sheetName, rowToArgs, overrideLeadSources){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if(!sheet){
    Logger.log(sheetName + " 시트를 못 찾음.");
    return;
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const segmentColIndex = headers.indexOf("Business Segment");

  if(segmentColIndex === -1){
    Logger.log(sheetName + "에 'Business Segment' 컬럼을 못 찾음 — 중단.");
    return;
  }

  const segmentCol = segmentColIndex + 1;
  let updatedCount = 0;

  rowsWithIndex.forEach(function(entry){

    const args = rowToArgs(entry.record);

    const segment = String(args.segment || "");
    const leadSource = String(args.leadSource || "").trim().toLowerCase();
    const campaign = String(args.campaign || "").trim().toLowerCase();

    const hasContactSignal =
      campaign.includes("_contact") ||
      campaign.includes("contact") ||
      campaign.includes("consult");

    if(
      segment === "Other" &&
      overrideLeadSources.indexOf(leadSource) !== -1 &&
      hasContactSignal
    ){

      sheet.getRange(entry.rowIndex, segmentCol).setValue("BOFU");
      updatedCount++;

      Logger.log(
        "Lead ID=" + args.id + " Row=" + entry.rowIndex +
        " Campaign=\"" + args.campaign + "\" LeadSource=\"" + args.leadSource +
        "\" Other → BOFU"
      );

    }

  });

  SpreadsheetApp.flush();

  Logger.log(sheetName + " — " + updatedCount + "건 갱신 완료.");

}
