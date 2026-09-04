/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — Deal Tracker Revenue Sync 미매칭 78건 원인 조사
 * (docs/OpenItems.md #39 후속 조사)
 *
 * Responsibility
 * #39(Leads_OPS 필드 소유권 전면 재편) 검증 중 `runSyncRevenueToOPS()`
 * 실행 결과 Deal Tracker 고유 Email 122개 중 44건만 Leads_OPS에 반영되고
 * 78건(64%)이 매칭 실패한 게 확인됨 — 사용자 가설("Account로 병합된
 * 리드는 Leads 리포트에서 안 보여서 그럴 수 있다")을 실측으로 검증하기
 * 위해, 미매칭 78건 각각의 Email/Lead Source/Close FY를 덤프하고
 * Leads_Master에도 아예 없는지(=Import 공백/Account 전환 후보) 아니면
 * Leads_Master엔 있는데 Leads_OPS엔만 없는지(=mergeOPS() earliest-wins
 * 배제, #20/#27 케이스와 동일 패턴 가능성)로 분류한다.
 *
 * 분류:
 * (1) Leads_Master에도 없음 — Import 공백 또는 Account 전환 후보(사용자
 *     가설과 부합)
 * (2) Leads_Master엔 있는데 Leads_OPS엔 없음 — mergeOPS() earliest-wins
 *     dedup으로 배제됐을 가능성(진짜 버그일 수 있음, #20 redrock333 케이스
 *     참고) — 이 케이스가 나오면 별도로 더 깊이 조사 필요
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 *
 * INPUT: 없음 (Deal Tracker/Leads_Master/Leads_OPS 직접 스캔)
 * OUTPUT: Logger.log만
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 조사 스크립트(TEMPQA 관례,
 *   `TEMPQA_037_NewP1AugustSalesforceLeadTrace.js` 등과 동일).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-09-05)
 * - 최초 구현. `docs/OpenItems.md` #39.
 * ==========================================================
 */


/**
 * ==========================================================
 * Trace Deal Tracker Revenue Sync Unmatched Emails (수동 실행 진입점, 읽기 전용)
 * ==========================================================
 */
function runTraceDealTrackerUnmatchedEmails(){

  Logger.log("======================================");
  Logger.log("Deal Tracker Revenue Sync — 미매칭 Email 조사");
  Logger.log("======================================");

  //----------------------------------------------------------
  // 1) Deal Tracker — Email별 요약(revenue 합계/leadSource/closeFY 샘플)
  //    computeRevenueByEmail_()(MASTER_011_RevenueSync.js)와 동일한
  //    Email 정규화(trim+lowercase)를 그대로 씀 — 그쪽 매칭 결과와
  //    1:1 비교 가능해야 하므로.
  //----------------------------------------------------------

  const dealRows = readDealTrackerRawRows_();
  const emailSummary = buildDealTrackerEmailSummary_(dealRows);
  const emails = Object.keys(emailSummary);

  Logger.log("Deal Tracker Rows : " + dealRows.length);
  Logger.log("Unique Emails : " + emails.length);

  //----------------------------------------------------------
  // 2) Leads_OPS — 현재 존재하는 Email 집합
  //----------------------------------------------------------

  const opsEmails = readEmailSetFromSheet_(OPS.SHEET.OPS, "Email");

  //----------------------------------------------------------
  // 3) Leads_Master — 현재 존재하는 Email 집합
  //----------------------------------------------------------

  const masterEmails = readEmailSetFromSheet_(CONFIG.SHEETS.LEADS_MASTER, "Email");

  //----------------------------------------------------------
  // 4) 미매칭 분류
  //----------------------------------------------------------

  const unmatched = emails.filter(function(email){ return !opsEmails[email]; });

  let missingFromMaster = 0;
  let inMasterOnly = 0;

  Logger.log("");
  Logger.log("Leads_OPS 매칭 성공 : " + (emails.length - unmatched.length));
  Logger.log("Leads_OPS 매칭 실패(미매칭) : " + unmatched.length);
  Logger.log("");
  Logger.log("---- 미매칭 78건 상세 (Email / #Deals / Revenue / Lead Source / Close FY / Business Segment / Leads_Master 존재 여부) ----");

  unmatched.forEach(function(email){

    const summary = emailSummary[email];
    const inMaster = !!masterEmails[email];

    if(inMaster){
      inMasterOnly++;
    } else {
      missingFromMaster++;
    }

    Logger.log(
      email +
      " | #Deals=" + summary.dealCount +
      " | Revenue=" + summary.revenueSum +
      " | LeadSource=" + summary.leadSourceSamples.join(", ") +
      " | CloseFY=" + summary.closeFYSamples.join(", ") +
      " | BusinessSegment=" + summary.businessSegmentSamples.join(", ") +
      " | Leads_Master=" + (inMaster ? "있음" : "❌ 없음")
    );

  });

  Logger.log("");
  Logger.log("========== 분류 요약 ==========");
  Logger.log(
    "(1) Leads_Master에도 없음(Import 공백/Account 전환 후보) : " + missingFromMaster
  );
  Logger.log(
    "(2) Leads_Master엔 있는데 Leads_OPS엔 없음(mergeOPS 배제 가능성, 별도 조사 필요) : " + inMasterOnly
  );
  Logger.log("=================================");

}


/**
 * ==========================================================
 * Build Deal Tracker Email Summary (순수 함수)
 *
 * INPUT
 * dealRows : Object[]  (readDealTrackerRawRows_() 출력 — email/revenue/
 *            leadSource/closeFY/businessSegment 필드 필요)
 *
 * OUTPUT
 * Object  { [email]: { dealCount, revenueSum, leadSourceSamples,
 *           closeFYSamples, businessSegmentSamples } }
 *         (샘플 배열은 중복 제거된 값을 최대 3개까지만 담음 — 로그 가독성용)
 * ==========================================================
 */
function buildDealTrackerEmailSummary_(dealRows){

  const groups = {};

  (dealRows || []).forEach(function(row){

    const email = String(row.email || "").trim().toLowerCase();

    if(!email) return;

    if(!groups[email]){
      groups[email] = {
        dealCount: 0,
        revenueSum: 0,
        leadSourceSamples: [],
        closeFYSamples: [],
        businessSegmentSamples: []
      };
    }

    const g = groups[email];

    g.dealCount++;
    g.revenueSum += Number(row.revenue) || 0;

    addUniqueSample_(g.leadSourceSamples, row.leadSource);
    addUniqueSample_(g.closeFYSamples, row.closeFY);
    addUniqueSample_(g.businessSegmentSamples, row.businessSegment);

  });

  return groups;

}


/**
 * ==========================================================
 * Add Unique Sample (순수 함수, 헬퍼 — 최대 3개까지만 유지)
 * ==========================================================
 */
function addUniqueSample_(samples, value){

  if(value === undefined || value === null || value === "") return;
  if(samples.indexOf(value) !== -1) return;
  if(samples.length >= 3) return;

  samples.push(value);

}


/**
 * ==========================================================
 * Read Email Set From Sheet (IO 헬퍼, 읽기 전용)
 *
 * WHY
 * Leads_OPS/Leads_Master 둘 다 "1 Email 컬럼 존재" 구조가 같아 sheetToObjects()
 * 로 공용 처리 가능 — Email을 trim+lowercase로 정규화해 Set(Object 형태)으로
 * 반환한다(computeRevenueByEmail_()/syncRevenueToOPS_()와 동일한 정규화 규칙).
 * ==========================================================
 */
function readEmailSetFromSheet_(sheetName, emailField){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  const set = {};

  if(!sheet) return set;

  sheetToObjects(sheet).forEach(function(r){

    const email = String(r[emailField] || "").trim().toLowerCase();

    if(email) set[email] = true;

  });

  return set;

}
