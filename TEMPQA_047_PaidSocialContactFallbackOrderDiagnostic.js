/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — SEARCH_CATCHALL_LEAD_SOURCE_OVERRIDES vs "_contact"/"consult"
 * fallback 순서 버그의 실 라이브 데이터 영향 범위 진단
 *
 * Responsibility
 * OpenItems.md #29(getBusinessSegment() 회귀 테스트 3개 FAIL) 조사 중 발견한
 * 순서 버그의 실측 영향 규모를 코드 수정 전에 먼저 확인하기 위한 진단.
 *
 * WHY
 * `getBusinessSegment()`(UTIL_001_TransformHelper.js)에서
 * `SEARCH_CATCHALL_LEAD_SOURCE_OVERRIDES`(leadSource="paid social"/
 * "affiliate organization"/"offline outreach" → "Other", 2026-07-29 추가,
 * 900행)가 campaign의 "_contact"/"contact"/"consult" fallback 블록(2026-07-28
 * 확정, leadSource로 BOFU/Search 최종 판별, 1382행)보다 먼저 체크되고 있어,
 * 이 3개 leadSource 값을 가진 리드가 campaign에 "_contact"/"consult" 신호가
 * 있어도 전부 "Other"로 떨어지고 있음(fallback 블록에 도달 자체를 못 함).
 * 순서를 바꾸면 이 조건에 해당하는 리드는 "Other" → "BOFU"로 재분류됨
 * (해당 leadSource 3개는 전부 "search"를 포함하지 않으므로 항상 BOFU).
 *
 * 이 진단은 코드를 고치지 않고, "지금 stored/실측 Business Segment가 Other인데
 * leadSource가 이 3개 중 하나이고 campaign에 _contact/contact/consult 신호가
 * 있는" 행만 세어 수정 시 영향받을 건수를 보여준다.
 *
 * **읽기 전용** — 아무것도 쓰지 않음.
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
 * Check Paid Social Contact Fallback Order Impact (수동 실행 진입점, 읽기 전용)
 * ==========================================================
 */
function runCheckPaidSocialContactFallbackOrderImpact(){

  const overrideLeadSources = ["paid social", "affiliate organization", "offline outreach"];

  Logger.log("========== Leads_Master ==========");
  checkFallbackOrderImpactOnSheet_(
    CONFIG.SHEETS.LEADS_MASTER,
    function(r){
      return {
        campaign: r["First MKT UTM Campaign"],
        leadSource: r["First Lead Source"],
        segment: r["Business Segment"],
        id: r["Lead ID"]
      };
    },
    overrideLeadSources
  );

  Logger.log("");
  Logger.log("========== MTA_Master ==========");
  checkFallbackOrderImpactOnSheet_(
    CONFIG.SHEETS.MTA_MASTER,
    function(r){
      return {
        campaign: r["MKT UTM Campaign"],
        // ⚠️ MTA_Master 저장 컬럼명은 "First Lead Source"다 — TEMPQA_034 참고
        // (MASTER_007_MTATransformer.js가 raw "Lead Source"를 "First Lead
        // Source"로 리네임해 저장).
        leadSource: r["First Lead Source"],
        segment: r["Business Segment"],
        id: r["Lead ID"]
      };
    },
    overrideLeadSources
  );

}


/**
 * ==========================================================
 * Check Fallback Order Impact On Sheet (IO 래퍼, 읽기 전용)
 * ==========================================================
 */
function checkFallbackOrderImpactOnSheet_(sheetName, rowToArgs, overrideLeadSources){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if(!sheet){
    Logger.log(sheetName + " 시트를 못 찾음.");
    return;
  }

  const records = sheetToObjects(sheet);

  let affectedCount = 0;
  const samples = [];

  records.forEach(function(r){

    const args = rowToArgs(r);

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

      affectedCount++;

      if(samples.length < 10){
        samples.push(
          "Lead ID=" + args.id + " Campaign=\"" + args.campaign +
          "\" LeadSource=\"" + args.leadSource + "\" (Other → BOFU 예상)"
        );
      }

    }

  });

  Logger.log("전체 " + records.length + "건 중 영향 예상 " + affectedCount + "건");
  samples.forEach(function(s){ Logger.log("  " + s); });

}
