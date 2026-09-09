/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — Revenue Sync(#39) 실측 미검증 가정 검증:
 * 같은 Email 복수 딜 → Revenue 합계 + 최신 Close Date 채택
 *
 * Responsibility
 * `docs/OpenItems.md` #39 / `MASTER_011_RevenueSync.js` 헤더 주석에
 * "집계 가정(사용자 미검증)"으로 표시된 부분 — Deal Tracker에 같은 Email로
 * 여러 딜이 있을 때 Revenue는 합계, Opportunity Won Date는 가장 최근
 * Close Date를 채택한다는 로직(`computeRevenueByEmail_()`)이 단위
 * 테스트(합성 데이터)로는 PASS했지만 실제 운영 데이터로는 아직 확인된 적
 * 없음. 이 스크립트는 (1) 실제 Deal Tracker에 이런 복수 딜 Email이 몇 건
 * 있는지, (2) `computeRevenueByEmail_()`가 그 실데이터에 대해 계산하는
 * 값(합계/최신 Close Date)이 무엇인지, (3) 그 값이 현재 Leads_OPS에
 * 실제로 반영돼 있는지(동기화 자체가 정상 동작했는지)를 나란히 로그로
 * 보여준다 — 사용자가 실제 케이스를 보고 "합계 + 최신 Close Date"가
 * 원하는 정의가 맞는지 최종 확인할 수 있도록.
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 *
 * INPUT: 없음 (Deal Tracker/Leads_OPS 직접 스캔)
 * OUTPUT: Logger.log만
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 조사 스크립트(TEMPQA 관례,
 *   `TEMPQA_050_DealTrackerRevenueUnmatchedEmailTrace.js` 등과 동일).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-09-09)
 * - 최초 구현. `docs/OpenItems.md` #39 실사용 검증 후속.
 * ==========================================================
 */


/**
 * ==========================================================
 * Verify Revenue Sync Duplicate-Email Assumption (수동 실행 진입점, 읽기 전용)
 * ==========================================================
 */
function runVerifyRevenueSyncDuplicateEmailAssumption(){

  Logger.log("======================================");
  Logger.log("Revenue Sync — 복수 딜 Email 집계 가정 실측 검증");
  Logger.log("======================================");

  //----------------------------------------------------------
  // 1) Deal Tracker — Email별 딜 목록(개별 revenue/closeDate 전부 보존,
  //    computeRevenueByEmail_()와 동일 정규화 규칙으로 그룹핑)
  //----------------------------------------------------------

  const dealRows = readDealTrackerRawRows_();
  const dealsByEmail = groupDealTrackerRowsByEmail_(dealRows);
  const revenueByEmail = computeRevenueByEmail_(dealRows);

  const duplicateEmails = Object.keys(dealsByEmail)
    .filter(function(email){ return dealsByEmail[email].length > 1; });

  Logger.log("Deal Tracker Rows : " + dealRows.length);
  Logger.log("Unique Emails : " + Object.keys(dealsByEmail).length);
  Logger.log("복수 딜 Email(검증 대상) : " + duplicateEmails.length);

  if(duplicateEmails.length === 0){
    Logger.log("");
    Logger.log("복수 딜을 가진 Email이 현재 Deal Tracker에 없음 — 이 가정을 검증할 실데이터 케이스가 없는 상태.");
    return;
  }

  //----------------------------------------------------------
  // 2) Leads_OPS — Email → { revenue, wonDate } 현재 값
  //----------------------------------------------------------

  const opsValuesByEmail = readOPSRevenueAndWonDateByEmail_();

  //----------------------------------------------------------
  // 3) 케이스별 상세 로그 — 개별 딜 / 계산값(합계+최신 Close Date) / 현재 OPS 값 대조
  //----------------------------------------------------------

  let matchCount = 0;
  let mismatchCount = 0;
  let notInOPSCount = 0;

  Logger.log("");
  Logger.log("---- 복수 딜 Email 상세 (Email | 개별 딜(revenue/closeDate) | 계산값(합계/최신CloseDate) | 현재 Leads_OPS 값 | 일치 여부) ----");

  duplicateEmails.forEach(function(email){

    const deals = dealsByEmail[email];
    const computed = revenueByEmail[email];
    const opsValue = opsValuesByEmail[email];

    const dealsStr = deals
      .map(function(d){
        return "(revenue=" + d.revenue + ", closeDate=" + formatDateForLog_(d.closeDate) + ")";
      })
      .join(", ");

    const computedStr =
      "합계=" + computed.revenue + ", 최신CloseDate=" + formatDateForLog_(computed.wonDate);

    let statusStr;

    if(!opsValue){
      statusStr = "❌ Leads_OPS에 없음(미매칭 — #39 78건 계열)";
      notInOPSCount++;
    } else {

      const revenueMatches = Number(opsValue.revenue) === Number(computed.revenue);
      const wonDateMatches = sameDate_(opsValue.wonDate, computed.wonDate);

      if(revenueMatches && wonDateMatches){
        statusStr = "✅ 일치";
        matchCount++;
      } else {
        statusStr =
          "⚠️ 불일치 (OPS: revenue=" + opsValue.revenue +
          ", wonDate=" + formatDateForLog_(opsValue.wonDate) + ")";
        mismatchCount++;
      }

    }

    Logger.log(
      email + " | #Deals=" + deals.length + " | " + dealsStr +
      " | 계산값: " + computedStr + " | OPS 대조: " + statusStr
    );

  });

  Logger.log("");
  Logger.log("========== 검증 요약 ==========");
  Logger.log("일치(동기화 정상) : " + matchCount);
  Logger.log("불일치(동기화 안 됐거나 재계산 필요) : " + mismatchCount);
  Logger.log("Leads_OPS에 없음(별개 원인, #39 미매칭 계열) : " + notInOPSCount);
  Logger.log("=================================");
  Logger.log("");
  Logger.log("↑ 위 '개별 딜' 목록을 보고 '합계 + 최신 Close Date' 정의가");
  Logger.log("  실제로 원하는 값인지 사용자 확인 필요 (예: Upsell/Referral도 그대로 합산됨).");

}


/**
 * ==========================================================
 * Group Deal Tracker Rows By Email (순수 함수)
 *
 * INPUT
 * dealRows : Object[]  (readDealTrackerRawRows_() 출력 — email/revenue/
 *            closeDate 필드 필요)
 *
 * OUTPUT
 * Object  { [email]: Array<{revenue, closeDate}> }
 *         (computeRevenueByEmail_()와 동일한 Email 정규화 규칙 — trim+lowercase)
 * ==========================================================
 */
function groupDealTrackerRowsByEmail_(dealRows){

  const groups = {};

  (dealRows || []).forEach(function(row){

    const email = String(row.email || "").trim().toLowerCase();

    if(!email) return;

    if(!groups[email]) groups[email] = [];

    groups[email].push({
      revenue: Number(row.revenue) || 0,
      closeDate: row.closeDate
    });

  });

  return groups;

}


/**
 * ==========================================================
 * Read OPS Revenue And Won Date By Email (IO 헬퍼, 읽기 전용)
 *
 * WHY
 * `syncRevenueToOPS_()`가 실제로 반영해둔 현재 Leads_OPS의 Revenue/
 * Opportunity Won Date 값을 Email 기준으로 조회 — 계산값과 1:1 대조용.
 *
 * OUTPUT
 * Object  { [email]: { revenue, wonDate } }
 * ==========================================================
 */
function readOPSRevenueAndWonDateByEmail_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const opsSheet = ss.getSheetByName(OPS.SHEET.OPS);

  const result = {};

  if(!opsSheet) return result;

  sheetToObjects(opsSheet).forEach(function(r){

    const email = String(r["Email"] || "").trim().toLowerCase();

    if(!email) return;

    result[email] = {
      revenue: r["Revenue"],
      wonDate: r["Opportunity Won Date"]
    };

  });

  return result;

}


/**
 * ==========================================================
 * Same Date (순수 함수, 헬퍼 — 둘 다 유효 Date일 때만 값 비교, 아니면 존재 여부만 비교)
 * ==========================================================
 */
function sameDate_(a, b){

  const aValid = a instanceof Date && !isNaN(a.getTime());
  const bValid = b instanceof Date && !isNaN(b.getTime());

  if(!aValid && !bValid) return true;
  if(aValid !== bValid) return false;

  return a.getTime() === b.getTime();

}


/**
 * ==========================================================
 * Format Date For Log (순수 함수, 헬퍼)
 * ==========================================================
 */
function formatDateForLog_(d){

  if(!(d instanceof Date) || isNaN(d.getTime())) return "(없음)";

  return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");

}
