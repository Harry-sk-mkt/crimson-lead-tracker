/**
 * ==========================================================
 * Marketing 2.0
 * OPS QA
 *
 * Responsibility
 * Leads_Master / MTA_Master / Leads_OPS 간 정합성 검증.
 * 문제 있는 건은 Lead ID까지 상세히 Leads_OPS_QA 시트에 기록.
 *
 * 호출 시점
 * - appendNewLeads(), appendNewMTA()
 * - rebuildLeadsMaster(), rebuildMTAMaster()
 * - syncMTAFunnelToOPS_()
 * - buildLeadsOPS() (SYNC_COLUMNS 보존 검증 포함)
 *
 * Version
 * v1.2.0
 *
 * Change Log
 * v1.2.0 (2026-07-24)
 * - findExactDuplicateTouchRows_()/checkExactDuplicateTouchRows_()의 MTA_Master
 *   필드 참조를 "First Touch Detail" → "Lead Source Detail"로 갱신
 *   (13_MTATransformer.js v5.1.0의 컬럼명 정정 반영, Events_OPS 설계 중 발견).
 * v1.1.0 (2026-07-24)
 * - checkExactDuplicateTouchRows_() / findExactDuplicateTouchRows_() 추가.
 *   Lead ID + MTA Created Date + MKT UTM Campaign + First Lead Source +
 *   First Touch Detail 5개 필드가 전부 같은 MTA_Master row를 "완전 동일
 *   중복"으로 판단해 QA 이슈로 플래그 (CLAUDE.md 미해결 항목 3 해결).
 *   자동 삭제는 하지 않음 — 검출/보고만 수행.
 * ==========================================================
 */

const OPS_QA_SHEET = "Leads_OPS_QA";
const OPS_QA_HEADERS = ["Check", "Lead ID", "Email", "Detail"];


/**
 * ==========================================================
 * Run OPS QA (전체 검증 오케스트레이션)
 * ==========================================================
 */
function runOPSQA_(preMergeOpsSnapshot, newlyWrittenRows) {

  const start = new Date();

  Logger.log("======================================");
  Logger.log("OPS QA Started");
  Logger.log("======================================");

  const issues = [];

  checkRowCount_(issues);
  checkMTAFunnelAndMatching_(issues);
  checkLeadIdUniqueness_(issues);
  checkExactDuplicateTouchRows_(issues);

  if (preMergeOpsSnapshot && newlyWrittenRows) {
    checkSyncColumnsPreserved_(preMergeOpsSnapshot, newlyWrittenRows, issues);
  }

  const metrics = computeQADashboardMetrics_();

  writeOPSQAResults_(metrics, issues);

  const byCheck = {};

  issues.forEach(function (issue) {
    byCheck[issue.check] = (byCheck[issue.check] || 0) + 1;
  });

  const seconds = ((new Date() - start) / 1000).toFixed(2);

  Logger.log("========== OPS QA SUMMARY ==========");
  Logger.log("Total Issues : " + issues.length);

  Object.keys(byCheck).forEach(function (key) {
    Logger.log("  " + key + " : " + byCheck[key]);
  });

  Logger.log("Time : " + seconds + "s");
  Logger.log("=====================================");

  return issues;

}


/**
 * ==========================================================
 * Check 2 + 3 + 4 — MTA Funnel 값 일치 + 매칭 정확성 (통합)
 *
 * Change Log
 * v1.1.0 (2026-07-21)
 * - Revenue는 금액 완전 일치(compareFunnelField_) 대신 존재 여부만
 *   비교(checkRevenueExistence_)하도록 변경 — 환율 변환 시점 차이로
 *   인한 오탐 방지.
 * ==========================================================
 */
function checkMTAFunnelAndMatching_(issues) {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const mtaSheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);
  const opsSheet = ss.getSheetByName(OPS.SHEET.OPS);

  if (!mtaSheet || !opsSheet) return;

  const mtaRecords = sheetToObjects(mtaSheet);
  const opsRecords = sheetToObjects(opsSheet);

  const mtaFunnelByLeadId = computeMTAFunnelByLeadId_(mtaRecords);

  //----------------------------------------------------------
  // MTA Lead ID별 Email도 같이 확보 (가장 이른 터치 기준, 동일 로직)
  //----------------------------------------------------------

  const mtaEmailByLeadId = {};
  const groups = {};

  mtaRecords.forEach(function (record) {

    const leadId = String(record["Lead ID"] || "").trim();
    if (!leadId) return;

    if (!groups[leadId]) groups[leadId] = [];
    groups[leadId].push(record);

  });

  Object.keys(groups).forEach(function (leadId) {

    const rows = groups[leadId];

    let earliest = rows[0];

    rows.forEach(function (candidate) {

      const candidateDate = candidate["MTA Created Date"];
      const earliestDate = earliest["MTA Created Date"];

      const candidateValid = candidateDate instanceof Date && !isNaN(candidateDate.getTime());
      const earliestValid = earliestDate instanceof Date && !isNaN(earliestDate.getTime());

      if (candidateValid && earliestValid && candidateDate.getTime() < earliestDate.getTime()) {
        earliest = candidate;
      }

    });

    mtaEmailByLeadId[leadId] = String(earliest["Email"] || "").trim().toLowerCase();

  });

  //----------------------------------------------------------
  // Leads_OPS를 Lead ID로 인덱싱
  //----------------------------------------------------------

  const opsByLeadId = {};

  opsRecords.forEach(function (record) {
    opsByLeadId[String(record["Lead ID"] || "").trim()] = record;
  });

  //----------------------------------------------------------
  // 비교
  //----------------------------------------------------------

  Object.keys(mtaFunnelByLeadId).forEach(function (leadId) {

    const opsRecord = opsByLeadId[leadId];

    if (!opsRecord) {
      return;   // Row Count 체크에서 이미 잡힘
    }

    const mtaFunnel = mtaFunnelByLeadId[leadId];

    //------------------------------------------------------
    // 매칭 정확성 — Email 교차 검증
    //------------------------------------------------------

    const mtaEmail = mtaEmailByLeadId[leadId] || "";
    const opsEmail = String(opsRecord["Email"] || "").trim().toLowerCase();

    if (mtaEmail && opsEmail && mtaEmail !== opsEmail) {

      issues.push({
        check: "Matching Accuracy",
        leadId: leadId,
        email: opsEmail,
        detail: "MTA Email(" + mtaEmail + ") ≠ OPS Email(" + opsEmail + ")"
      });

    }

    //------------------------------------------------------
    // Funnel 날짜 필드 — 완전 일치 확인
    //------------------------------------------------------

    compareFunnelField_(
      issues, leadId, opsEmail,
      "IC Booked Date", mtaFunnel.icBookedDate, opsRecord["IC Booked Date"], true
    );

    compareFunnelField_(
      issues, leadId, opsEmail,
      "IC Completed Date", mtaFunnel.icCompletedDate, opsRecord["IC Completed Date"], true
    );

    compareFunnelField_(
      issues, leadId, opsEmail,
      "Opportunity Won Date", mtaFunnel.wonDate, opsRecord["Opportunity Won Date"], true
    );

    //------------------------------------------------------
    // Revenue — 존재 여부만 확인 (환율 변동으로 인한 오탐 방지)
    //------------------------------------------------------

    checkRevenueExistence_(
      issues, leadId, opsEmail,
      mtaFunnel.revenue, opsRecord["Revenue"]
    );

  });

}


/**
 * ==========================================================
 * Check 1 — Row Count
 *
 * WHY
 * Leads_Master(유효 레코드, Email 기준 dedup 후 예상되는 Lead ID 집합)와
 * 실제 Leads_OPS의 Lead ID 집합을 비교. mergeOPS()의 "가장 이른 Create
 * Date 채택" 로직을 그대로 재현해서 기대값을 계산.
 * ==========================================================
 */
function checkRowCount_(issues) {

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const masterSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS_MASTER);
    const opsSheet = ss.getSheetByName(OPS.SHEET.OPS);

    if (!masterSheet || !opsSheet) return;

    const masterRecords = sheetToObjects(masterSheet);
    const opsRecords = sheetToObjects(opsSheet);

    //----------------------------------------------------------
    // mergeOPS()와 동일한 방식으로 "기대되는 Lead ID 집합" 계산
    //----------------------------------------------------------

    const emailGroups = {};

    masterRecords.forEach(function (record) {

        const email = String(record["Email"] || "").trim().toLowerCase();

        if (!email) return;

        if (!emailGroups[email]) {
            emailGroups[email] = [];
        }

        emailGroups[email].push(record);

    });

    const expectedLeadIds = {};

    Object.keys(emailGroups).forEach(function (email) {

        const group = emailGroups[email];

        let earliest = group[0];

        group.forEach(function (candidate) {

            const candidateDate = candidate["Create Date"];
            const earliestDate = earliest["Create Date"];

            const candidateValid = candidateDate instanceof Date && !isNaN(candidateDate.getTime());
            const earliestValid = earliestDate instanceof Date && !isNaN(earliestDate.getTime());

            if (candidateValid && earliestValid && candidateDate.getTime() < earliestDate.getTime()) {
                earliest = candidate;
            }

        });

        expectedLeadIds[earliest["Lead ID"]] = true;

    });

    const actualLeadIds = {};

    opsRecords.forEach(function (record) {
        actualLeadIds[record["Lead ID"]] = true;
    });

    //----------------------------------------------------------
    // 기대되는데 실제로 없는 것 / 실제로 있는데 기대 안 된 것
    //----------------------------------------------------------

    Object.keys(expectedLeadIds).forEach(function (leadId) {

        if (!actualLeadIds[leadId]) {

            issues.push({
                check: "Row Count — Missing in OPS",
                leadId: leadId,
                email: "",
                detail: "Leads_Master 기준 존재해야 하는데 Leads_OPS에 없음"
            });

        }

    });

    Object.keys(actualLeadIds).forEach(function (leadId) {

        if (!expectedLeadIds[leadId]) {

            issues.push({
                check: "Row Count — Unexpected in OPS",
                leadId: leadId,
                email: "",
                detail: "Leads_Master 기준 예상 안 된 Lead ID가 Leads_OPS에 존재"
            });

        }

    });

}


/**
 * ==========================================================
 * Compare Funnel Field (날짜 또는 숫자 한 필드 비교)
 * ==========================================================
 */
function compareFunnelField_(issues, leadId, email, fieldName, mtaValue, opsValue, isDate) {

    const mtaEmpty =
        mtaValue === null || mtaValue === undefined ||
        (isDate && !(mtaValue instanceof Date));

    const opsEmpty =
        opsValue === null || opsValue === undefined || opsValue === "" ||
        (isDate && !(opsValue instanceof Date));

    if (mtaEmpty && opsEmpty) return;

    let mismatch = false;

    if (isDate) {

        if (mtaEmpty !== opsEmpty) {
            mismatch = true;
        } else if (!mtaEmpty && !opsEmpty) {
            mismatch = mtaValue.getTime() !== opsValue.getTime();
        }

    } else {

        const mtaNum = Number(mtaValue) || 0;
        const opsNum = Number(opsValue) || 0;

        mismatch = mtaNum !== opsNum;

    }

    if (mismatch) {

        issues.push({
            check: "Funnel Match — " + fieldName,
            leadId: leadId,
            email: email,
            detail: "MTA=" + mtaValue + " / OPS=" + opsValue
        });

    }

}

/**
 * ==========================================================
 * Check Revenue Existence Only (금액 일치는 확인하지 않음)
 *
 * WHY
 * Revenue("Won Opportunity's Amount (converted)")는 Salesforce
 * 리포트 추출 시점의 환율로 매번 재계산되는 값이라, MTA/OPS 추출
 * 시점이 다르면 원래 있어야 할 미세한 차이(환율 변동)가 계속
 * 발생한다. 이건 데이터 오류가 아니라 환율 스냅샷 차이이므로
 * 금액 자체는 비교하지 않고, "값이 있어야 하는데 아예 없는"
 * 진짜 동기화 누락만 잡아낸다.
 * ==========================================================
 */
function checkRevenueExistence_(issues, leadId, email, mtaRevenue, opsRevenue){

  const mtaHasValue = Number(mtaRevenue) > 0;
  const opsHasValue = Number(opsRevenue) > 0;

  if(mtaHasValue && !opsHasValue){

    issues.push({
      check: "Revenue Existence",
      leadId: leadId,
      email: email,
      detail: "MTA에는 Revenue(" + mtaRevenue + ")가 있는데 OPS에는 없음 (동기화 누락 의심)"
    });

  }

}


/**
 * ==========================================================
 * Check 6 — Lead ID Uniqueness in Leads_OPS
 * ==========================================================
 */
function checkLeadIdUniqueness_(issues) {

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const opsSheet = ss.getSheetByName(OPS.SHEET.OPS);

    if (!opsSheet) return;

    const opsRecords = sheetToObjects(opsSheet);

    const counts = {};

    opsRecords.forEach(function (record) {

        const leadId = String(record["Lead ID"] || "").trim();
        if (!leadId) return;

        counts[leadId] = (counts[leadId] || 0) + 1;

    });

    Object.keys(counts).forEach(function (leadId) {

        if (counts[leadId] > 1) {

            issues.push({
                check: "Lead ID Uniqueness",
                leadId: leadId,
                email: "",
                detail: "Leads_OPS에 " + counts[leadId] + "번 중복 등장"
            });

        }

    });

}


/**
 * ==========================================================
 * Check 7 — Exact Duplicate Touch Row (완전 동일 중복 검출)
 *
 * WHY
 * findDuplicateTouchRows_()가 잡는 "Lead ID + MTA Created Date만 같음"은
 * 같은 날 서로 다른 캠페인으로 여러 번 정상 터치한 경우도 섞여있어
 * 그대로 중복으로 취급할 수 없었음 (CLAUDE.md 미해결 항목 3, 2026-07-22 보류).
 * 터치를 식별하는 핵심 필드(Lead ID / MTA Created Date / MKT UTM Campaign /
 * First Lead Source / Lead Source Detail)까지 전부 같다면 서로 다른 정상
 * 터치일 가능성은 극히 낮고 Salesforce export가 같은 touch row를 중복
 * 전달했을 가능성이 높다고 보고 QA 이슈로 플래그한다 (자동 삭제는 하지
 * 않음 — Master는 재생성 가능해도 원인 파악 전 임의 삭제는 데이터 손실
 * 위험이 있어 보수적으로 접근).
 * IC Booked/Completed/Won Date, Revenue, Lead Priority 등 Lead 레벨
 * 스냅샷 필드는 export 시점마다 값이 바뀔 수 있어 비교 기준에서 제외
 * (2026-07-24 사용자 확정).
 * ==========================================================
 */
function checkExactDuplicateTouchRows_(issues) {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const mtaSheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);

  if (!mtaSheet) return;

  const mtaRecords = sheetToObjects(mtaSheet);
  const duplicates = findExactDuplicateTouchRows_(mtaRecords);

  duplicates.forEach(function (d) {

    issues.push({
      check: "Exact Duplicate Touch Row",
      leadId: d.leadId,
      email: d.email,
      detail:
        "MTA Created Date=" + d.mtaCreatedDate +
        " / Campaign=\"" + d.campaign + "\"" +
        " / Source=\"" + d.source + "\"" +
        " / Detail=\"" + d.detail + "\"" +
        " 조합이 " + d.count + "번 완전 동일하게 등장 (export 중복 의심)"
    });

  });

}


/**
 * ==========================================================
 * Check 5 — SYNC_COLUMNS Preservation (병합 전/후 비교)
 *
 * INPUT
 * preMergeOpsRecords : Object[]  (buildLeadsOPS()가 병합 전에 읽은 기존 Leads_OPS)
 * newRows : Array[]  (병합 후 실제로 쓰여질 2D 배열, OPS.HEADER 순서)
 * ==========================================================
 */
function checkSyncColumnsPreserved_(preMergeOpsRecords, newRows, issues) {

    const emailCol = OPS.HEADER.indexOf("Email");
    const leadIdCol = OPS.HEADER.indexOf("Lead ID");

    const beforeByEmail = {};

    preMergeOpsRecords.forEach(function (record) {

        const email = String(record["Email"] || "").trim().toLowerCase();
        if (!email) return;

        beforeByEmail[email] = record;

    });

    newRows.forEach(function (row) {

        const email = String(row[emailCol] || "").trim().toLowerCase();
        const before = beforeByEmail[email];

        if (!before) return;   // 신규 레코드, 비교 대상 아님

        OPS.SYNC_COLUMNS.forEach(function (col) {

            const colIndex = OPS.HEADER.indexOf(col);
            if (colIndex === -1) return;

            const beforeValue = before[col];
            const afterValue = row[colIndex];

            const beforeEmpty =
                beforeValue === null || beforeValue === undefined || beforeValue === "";
            const afterEmpty =
                afterValue === null || afterValue === undefined || afterValue === "";

            // 이전에 값이 있었는데(=이미 동기화됨), 병합 후 비어버렸다면 문제
            if (!beforeEmpty && afterEmpty) {

                issues.push({
                    check: "SYNC_COLUMNS Preservation — " + col,
                    leadId: row[leadIdCol],
                    email: email,
                    detail: "병합 전 값(" + beforeValue + ")이 병합 후 사라짐"
                });

            }

        });

    });

}


/**
 * ==========================================================
 * Write QA Results (Dashboard A1:C6 + Issues Table from Row 8)
 * ==========================================================
 */
function writeOPSQAResults_(metrics, issues) {

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    let sheet = ss.getSheetByName(OPS_QA_SHEET);

    if (!sheet) {
        sheet = ss.insertSheet(OPS_QA_SHEET);
    }

    sheet.clearContents();
    sheet.clearFormats();

    //----------------------------------------------------------
    // Dashboard (A1:C6)
    //----------------------------------------------------------

    sheet.getRange(1, 1, 1, 3).setValues([["", "Master", "Leads_OPS"]]);

    sheet.getRange(2, 1, 5, 3).setValues([
        ["#Leads", metrics.leadsMasterCount, metrics.opsCount],
        ["#IC Booked", metrics.icBookedMTA, metrics.icBookedOPS],
        ["#IC Complete", metrics.icCompleteMTA, metrics.icCompleteOPS],
        ["#Won", metrics.wonMTA, metrics.wonOPS],
        ["Total Revenue", metrics.totalRevenueMTA, metrics.totalRevenueOPS]
    ]);

    sheet.getRange(1, 1, 6, 3).setBorder(
        true, true, true, true, true, true,
        "#000000", SpreadsheetApp.BorderStyle.SOLID
    );

    sheet.getRange(1, 1, 1, 3).setFontWeight("bold");
    sheet.getRange(2, 1, 5, 1).setFontWeight("bold");
    sheet.getRange(6, 2, 1, 2).setNumberFormat("#,##0.00");

    //----------------------------------------------------------
    // Issues Table (from Row 8)
    //----------------------------------------------------------

    const issuesStartRow = 8;

    sheet.getRange(issuesStartRow, 1, 1, OPS_QA_HEADERS.length)
        .setValues([OPS_QA_HEADERS])
        .setFontWeight("bold");

    if (issues.length > 0) {

        const rows = issues.map(function (issue) {
            return [issue.check, issue.leadId, issue.email, issue.detail];
        });

        sheet.getRange(issuesStartRow + 1, 1, rows.length, OPS_QA_HEADERS.length)
            .setValues(rows);

    }

    sheet.setFrozenRows(issuesStartRow);

    SpreadsheetApp.flush();

}

/**
 * ==========================================================
 * Compute QA Dashboard Metrics
 *
 * WHY
 * #Leads는 Leads_Master 기준, 나머지(IC Booked/Complete/Won/Revenue)는
 * MTA_Master 기준(Lead ID 중복 제거된 대표값)으로 Leads_OPS와 대조.
 * ==========================================================
 */
function computeQADashboardMetrics_() {

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const leadsMasterSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS_MASTER);
    const mtaSheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);
    const opsSheet = ss.getSheetByName(OPS.SHEET.OPS);

    const leadsMasterCount =
        leadsMasterSheet ? sheetToObjects(leadsMasterSheet).length : 0;

    const opsRecords =
        opsSheet ? sheetToObjects(opsSheet) : [];

    const mtaRecords =
        mtaSheet ? sheetToObjects(mtaSheet) : [];

    const mtaFunnelByLeadId = computeMTAFunnelByLeadId_(mtaRecords);
    const mtaFunnelValues = Object.values(mtaFunnelByLeadId);

    function isValidDate(v) {
        return v instanceof Date && !isNaN(v.getTime());
    }

    const icBookedMTA = mtaFunnelValues.filter(function (f) { return isValidDate(f.icBookedDate); }).length;
    const icCompleteMTA = mtaFunnelValues.filter(function (f) { return isValidDate(f.icCompletedDate); }).length;
    const wonMTA = mtaFunnelValues.filter(function (f) { return isValidDate(f.wonDate); }).length;
    const totalRevenueMTA = mtaFunnelValues.reduce(function (sum, f) { return sum + (Number(f.revenue) || 0); }, 0);

    const icBookedOPS = opsRecords.filter(function (r) { return isValidDate(r["IC Booked Date"]); }).length;
    const icCompleteOPS = opsRecords.filter(function (r) { return isValidDate(r["IC Completed Date"]); }).length;
    const wonOPS = opsRecords.filter(function (r) { return isValidDate(r["Opportunity Won Date"]); }).length;
    const totalRevenueOPS = opsRecords.reduce(function (sum, r) { return sum + (Number(r["Revenue"]) || 0); }, 0);

    return {
        leadsMasterCount: leadsMasterCount,
        opsCount: opsRecords.length,
        icBookedMTA: icBookedMTA,
        icBookedOPS: icBookedOPS,
        icCompleteMTA: icCompleteMTA,
        icCompleteOPS: icCompleteOPS,
        wonMTA: wonMTA,
        wonOPS: wonOPS,
        totalRevenueMTA: totalRevenueMTA,
        totalRevenueOPS: totalRevenueOPS
    };

}

/**
 * ==========================================================
 * Run OPS QA (수동 실행용 — Append/Rebuild/Sync 이후 아무 때나)
 *
 * WHY
 * Check 5(SYNC_COLUMNS 보존)는 buildLeadsOPS() 실행 시점에서만
 * 정확히 검증 가능해서 이 경로에서는 제외. 나머지 5개 체크만 수행.
 * ==========================================================
 */
function runOPSQAManual() {

    runOPSQA_();

}


/**
 * ==========================================================
 * Categorize Won Discrepancy (OPS의 Won Date 중 MTA_Master로
 * 설명 안 되는 건 분류)
 *
 * WHY
 * QA Dashboard에서 #Won(OPS 3093) > #Won(MTA 2875)로 반대 방향
 * 불일치 발견. MTA_Master가 Lead ID를 가지고 있는지, 있다면 Won
 * Date를 계산해내는지 여부로 원인을 두 갈래로 분류해서 확인한다.
 * - notInMTA: 해당 Lead ID가 MTA_Master에 아예 없음
 *   (구버전 ICFunnel_Raw 파이프라인에서만 잡혔던 lead일 가능성)
 * - inMTANoWonDate: MTA_Master엔 있지만 계산된 Won Date가 없음
 *   (파싱 실패 등 다른 원인)
 *
 * INPUT
 * mtaFunnelByLeadId : Object  (computeMTAFunnelByLeadId_() 결과)
 * opsRecords : Object[]  (Leads_OPS 전체 레코드)
 *
 * OUTPUT
 * { notInMTA: Object[], inMTANoWonDate: Object[] }
 *
 * TEST
 * OPS에 Won Date가 있는 Lead 3개 — MTA에 정상 매칭 1개(제외 대상),
 * MTA엔 있지만 Won Date 없는 1개, MTA에 아예 없는 1개
 * → notInMTA 1건, inMTANoWonDate 1건으로 분류되어야 함
 * ==========================================================
 */
function categorizeWonDiscrepancy_(mtaFunnelByLeadId, opsRecords) {

  const notInMTA = [];
  const inMTANoWonDate = [];

  opsRecords.forEach(function (record) {

    const wonDate = record["Opportunity Won Date"];
    const isWon = wonDate instanceof Date && !isNaN(wonDate.getTime());

    if (!isWon) return;

    const leadId = String(record["Lead ID"] || "").trim();
    const mtaFunnel = mtaFunnelByLeadId[leadId];

    const entry = {
      leadId: leadId,
      email: record["Email"],
      wonDate: wonDate,
      revenue: record["Revenue"]
    };

    if (!mtaFunnel) {
      notInMTA.push(entry);
      return;
    }

    const mtaWonDate = mtaFunnel.wonDate;
    const mtaHasWonDate = mtaWonDate instanceof Date && !isNaN(mtaWonDate.getTime());

    if (!mtaHasWonDate) {
      inMTANoWonDate.push(entry);
    }

  });

  return {
    notInMTA: notInMTA,
    inMTANoWonDate: inMTANoWonDate
  };

}


/**
 * ==========================================================
 * TEST — categorizeWonDiscrepancy_()
 * ==========================================================
 */
function testCategorizeWonDiscrepancy() {

  const mtaFunnelByLeadId = {
    "L1": { wonDate: new Date(2026, 1, 1), revenue: 1000 },
    "L2": { wonDate: null, revenue: 0 }
  };

  const opsRecords = [
    { "Lead ID": "L1", "Opportunity Won Date": new Date(2026, 1, 1), "Revenue": 1000, "Email": "a@x.com" },
    { "Lead ID": "L2", "Opportunity Won Date": new Date(2026, 1, 5), "Revenue": 500, "Email": "b@x.com" },
    { "Lead ID": "L3", "Opportunity Won Date": new Date(2026, 1, 10), "Revenue": 2000, "Email": "c@x.com" }
  ];

  const result = categorizeWonDiscrepancy_(mtaFunnelByLeadId, opsRecords);

  const pass =
    result.notInMTA.length === 1 &&
    result.notInMTA[0].leadId === "L3" &&
    result.inMTANoWonDate.length === 1 &&
    result.inMTANoWonDate[0].leadId === "L2";

  Logger.log("notInMTA: " + result.notInMTA.length + " (expected 1)");
  Logger.log("inMTANoWonDate: " + result.inMTANoWonDate.length + " (expected 1)");
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Run Won Discrepancy Investigation (수동 실행용, 1회성 진단)
 *
 * WHY
 * QA Dashboard의 #Won/Revenue 역방향 불일치(OPS > MTA) 원인을
 * Lead ID 단위로 로그에 남겨 확인하기 위한 1회성 진단 함수.
 * ==========================================================
 */
function runInvestigateWonDiscrepancy() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const mtaSheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);
  const opsSheet = ss.getSheetByName(OPS.SHEET.OPS);

  if (!mtaSheet || !opsSheet) {
    throw new Error("MTA_Master 또는 Leads_OPS 시트를 찾을 수 없습니다.");
  }

  const mtaRecords = sheetToObjects(mtaSheet);
  const opsRecords = sheetToObjects(opsSheet);

  const mtaFunnelByLeadId = computeMTAFunnelByLeadId_(mtaRecords);

  const result = categorizeWonDiscrepancy_(mtaFunnelByLeadId, opsRecords);

  const notInMTARevenue = result.notInMTA.reduce(function (sum, r) { return sum + (Number(r.revenue) || 0); }, 0);
  const inMTANoWonDateRevenue = result.inMTANoWonDate.reduce(function (sum, r) { return sum + (Number(r.revenue) || 0); }, 0);

  Logger.log("======================================");
  Logger.log("Won Discrepancy Investigation");
  Logger.log("======================================");
  Logger.log("");
  Logger.log("[A] MTA_Master에 Lead ID 자체가 없음 : " + result.notInMTA.length + "건 / Revenue " + notInMTARevenue);
  result.notInMTA.forEach(function (r) {
    Logger.log("  " + r.leadId + " / " + r.email + " / WonDate=" + r.wonDate + " / Revenue=" + r.revenue);
  });

  Logger.log("");
  Logger.log("[B] MTA_Master엔 있지만 Won Date 계산 안 됨 : " + result.inMTANoWonDate.length + "건 / Revenue " + inMTANoWonDateRevenue);
  result.inMTANoWonDate.forEach(function (r) {
    Logger.log("  " + r.leadId + " / " + r.email + " / WonDate=" + r.wonDate + " / Revenue=" + r.revenue);
  });

  Logger.log("");
  Logger.log("========== SUMMARY ==========");
  Logger.log("Total unexplained : " + (result.notInMTA.length + result.inMTANoWonDate.length) + "건");
  Logger.log("Total unexplained Revenue : " + (notInMTARevenue + inMTANoWonDateRevenue));
  Logger.log("==============================");

}


/**
 * ==========================================================
 * Contains Upsell (Lead 레코드의 Attribution 필드에 "upsell" 텍스트가
 * 포함되는지 확인)
 *
 * WHY
 * getBusinessSegment()(16_TransformHelper.js)는 현재 Upsell을 별도
 * 세그먼트로 분류하지 않아 전부 "Other"로 떨어진다. "Other" 중
 * 실제로는 Upsell(재구매/추가 문의)로 보이는 비중을 확인하기 위해,
 * 분류에 쓰이는 4개 Attribution 필드에 "upsell" 텍스트가 있는지
 * 대소문자 무시하고 검사한다.
 *
 * INPUT
 * record : Object  (Leads_Master 레코드 1건)
 *
 * OUTPUT
 * boolean
 *
 * TEST
 * 4개 필드 중 하나라도 "upsell" 포함 시 true, 전부 없으면 false
 * ==========================================================
 */
function containsUpsell_(record) {

  const fields = [
    record["First Lead Source"],
    record["First Lead Source Category"],
    record["First MKT UTM Campaign"],
    record["First Touch Detail"]
  ];

  return fields.some(function (v) {
    return String(v || "").toLowerCase().includes("upsell");
  });

}


/**
 * ==========================================================
 * TEST — containsUpsell_()
 * ==========================================================
 */
function testContainsUpsell() {

  const pass =
    containsUpsell_({ "First Lead Source": "Upsell" }) === true &&
    containsUpsell_({ "First Lead Source Category": "Upsell - Renewal" }) === true &&
    containsUpsell_({ "First MKT UTM Campaign": "spring-upsell-2026" }) === true &&
    containsUpsell_({ "First Touch Detail": "" , "First Lead Source": "Referral" }) === false;

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Log Top N (집계 객체를 건수 내림차순으로 상위 N개 로그 출력)
 * ==========================================================
 */
function logTopN_(tally, n) {

  const entries = Object.keys(tally).map(function (k) {
    return { key: k, count: tally[k] };
  });

  entries.sort(function (a, b) { return b.count - a.count; });

  entries.slice(0, n).forEach(function (e) {
    Logger.log("  " + e.key + " : " + e.count);
  });

}


/**
 * ==========================================================
 * Run Other Segment Composition Investigation (수동 실행용, 1회성 진단)
 *
 * WHY
 * Business Segment = "Other"인 Lead 중 Upsell로 보이는 비중과,
 * "Other"를 구성하는 실제 First Lead Source / Category 분포를
 * Leads_Master 기준으로 확인하기 위한 1회성 진단 함수.
 * ==========================================================
 */
function runInvestigateOtherSegmentComposition() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS_MASTER);

  if (!sheet) {
    throw new Error(CONFIG.SHEETS.LEADS_MASTER + " sheet not found.");
  }

  const records = sheetToObjects(sheet);

  const otherRecords = records.filter(function (r) {
    return r["Business Segment"] === "Other";
  });

  const upsellRecords = otherRecords.filter(containsUpsell_);

  const sourceTally = {};
  const sourceCategoryTally = {};

  otherRecords.forEach(function (r) {

    const src = String(r["First Lead Source"] || "(empty)").trim();
    const cat = String(r["First Lead Source Category"] || "(empty)").trim();

    sourceTally[src] = (sourceTally[src] || 0) + 1;
    sourceCategoryTally[cat] = (sourceCategoryTally[cat] || 0) + 1;

  });

  Logger.log("======================================");
  Logger.log("Other Segment Composition Investigation");
  Logger.log("======================================");
  Logger.log("Total Leads_Master : " + records.length);
  Logger.log("Business Segment = Other : " + otherRecords.length);
  Logger.log("  ...of which contain 'upsell' (Source/Category/Campaign/Detail 중 하나라도) : " + upsellRecords.length);
  Logger.log("");
  Logger.log("-- First Lead Source breakdown (Other only, top 20) --");
  logTopN_(sourceTally, 20);
  Logger.log("");
  Logger.log("-- First Lead Source Category breakdown (Other only, top 20) --");
  logTopN_(sourceCategoryTally, 20);
  Logger.log("");
  Logger.log("========== SUMMARY ==========");
  Logger.log("Other : " + otherRecords.length + " / Upsell 의심 : " + upsellRecords.length +
    " (" + (otherRecords.length > 0 ? (upsellRecords.length / otherRecords.length * 100).toFixed(1) : "0") + "%)");
  Logger.log("==============================");

}


/**
 * ==========================================================
 * Run Segment-Month Anomaly Investigation (수동 실행용, 1회성 진단)
 *
 * WHY
 * (2026-07-22 근본 원인 해결됨 — 아래는 진단 당시 기록, 참고용으로 유지)
 * ACQ Report의 "All Leads"는 MTA_Master를 터치(row) 단위로 세는데, 당시
 * Business Segment는 Lead 레벨 필드("Lead: Last MKT UTM Campaign", 그 Lead의
 * "최종" 마지막 터치 기준)라서 같은 Lead의 모든 터치 row가 동일한
 * Segment를 갖는 문제가 있었다. Salesforce 리포트 추출 필드를
 * "MKT UTM Campaign"(Multi Touch Attribution 객체 자체 필드, 터치별 실제 값)로
 * 교체해서 해결됨 (13_MTATransformer.js v5.0.0) — 단, 이 fix는 교체 이후 새로
 * append되는 터치부터 적용되고 기존 MTA_Master row는 전체 재구축 전까지 구 값 유지.
 * 이 함수는 데이터 재구축 검증용으로 계속 사용 가능.
 *
 * INPUT (Apps Script 편집기에서 직접 값 수정 후 실행)
 * targetMonth : string  (예: "JUL", getFiscalMonthLabel() 결과 형식)
 * targetSegment : string  (예: "Seminar")
 * ==========================================================
 */
function runInvestigateSegmentMonthAnomaly(targetMonth, targetSegment) {

  targetMonth = targetMonth || "JUL";
  targetSegment = targetSegment || "Seminar";

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);

  if (!sheet) {
    throw new Error(CONFIG.SHEETS.MTA_MASTER + " sheet not found.");
  }

  const records = sheetToObjects(sheet);

  const touchesByLeadId = {};

  records.forEach(function (r) {

    const leadId = String(r["Lead ID"] || "").trim();
    if (!leadId) return;

    if (!touchesByLeadId[leadId]) touchesByLeadId[leadId] = [];
    touchesByLeadId[leadId].push(r);

  });

  const targetRows = records.filter(function (r) {

    const date = r["MTA Created Date"];
    if (!(date instanceof Date) || isNaN(date.getTime())) return false;

    return getFiscalMonthLabel(date) === targetMonth && r["Business Segment"] === targetSegment;

  });

  Logger.log("======================================");
  Logger.log("Segment-Month Anomaly Investigation — " + targetSegment + " x " + targetMonth);
  Logger.log("======================================");
  Logger.log("Matched touch rows : " + targetRows.length);
  Logger.log("");

  targetRows.forEach(function (r) {

    const leadId = String(r["Lead ID"] || "").trim();
    const allTouches = touchesByLeadId[leadId] || [];

    const dates = allTouches
      .map(function (t) { return t["MTA Created Date"]; })
      .filter(function (d) { return d instanceof Date && !isNaN(d.getTime()); })
      .sort(function (a, b) { return a - b; });

    const campaigns = Array.from(new Set(allTouches.map(function (t) {
      return t["MKT UTM Campaign"] || "(empty)";
    })));

    Logger.log(
      "Lead ID=" + leadId +
      " / 이 row의 MTA Created Date=" + r["MTA Created Date"] +
      " / 이 Lead의 전체 touch 수=" + allTouches.length +
      " / touch 날짜 범위=" + (dates.length ? dates[0] + " ~ " + dates[dates.length - 1] : "N/A") +
      " / MKT UTM Campaign distinct 값=" + JSON.stringify(campaigns)
    );

  });

}


/**
 * ==========================================================
 * Find Duplicate Touch Rows (같은 Lead ID + 같은 MTA Created Date)
 *
 * WHY
 * MTA_Master는 append-only라 Raw export가 같은 터치를 다시 내보내면
 * 중복이 그대로 쌓일 위험이 있다 (CLAUDE.md "현재 알려진 미해결 항목"
 * 3번). "미래 날짜 캠페인명"은 캠페인이 이벤트 한 달 전부터 돌아가고
 * 이름은 이벤트 당일로 짓는 정상 패턴으로 확인되어 중복의 증거가
 * 아니었으므로, 같은 Lead ID + 같은 MTA Created Date 조합이 실제로
 * 몇 번 등장하는지로 직접 확인한다.
 *
 * 주의: 이 두 필드만으로는 "완전 동일" 판단에 false positive가
 * 있을 수 있다 (같은 날 서로 다른 채널로 2번 터치한 정상 케이스도
 * 걸림) — 1차 스크리닝 용도.
 *
 * INPUT
 * records : Object[]  (MTA_Master 전체 레코드)
 *
 * OUTPUT
 * Object[]  [{ leadId, mtaCreatedDate, count }, ...]  (count > 1인 것만)
 *
 * TEST
 * 같은 Lead ID+날짜 조합 3번, 다른 조합 1번 입력 시 count=3인 그룹 1개만 반환
 * ==========================================================
 */
function findDuplicateTouchRows_(records) {

  const groups = {};

  records.forEach(function (r) {

    const leadId = String(r["Lead ID"] || "").trim();
    const date = r["MTA Created Date"];

    if (!leadId || !(date instanceof Date) || isNaN(date.getTime())) return;

    const key = leadId + "|" + date.getTime();

    groups[key] = (groups[key] || 0) + 1;

  });

  return Object.keys(groups)
    .filter(function (key) { return groups[key] > 1; })
    .map(function (key) {

      const parts = key.split("|");

      return {
        leadId: parts[0],
        mtaCreatedDate: new Date(Number(parts[1])),
        count: groups[key]
      };

    });

}


/**
 * ==========================================================
 * TEST — findDuplicateTouchRows_()
 * ==========================================================
 */
function testFindDuplicateTouchRows() {

  const date1 = new Date(2026, 0, 1);
  const date2 = new Date(2026, 0, 2);

  const records = [
    { "Lead ID": "L1", "MTA Created Date": date1 },
    { "Lead ID": "L1", "MTA Created Date": date1 },
    { "Lead ID": "L1", "MTA Created Date": date1 },
    { "Lead ID": "L1", "MTA Created Date": date2 },
    { "Lead ID": "L2", "MTA Created Date": date1 }
  ];

  const result = findDuplicateTouchRows_(records);

  const pass =
    result.length === 1 &&
    result[0].leadId === "L1" &&
    result[0].count === 3;

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Find Exact Duplicate Touch Rows (완전 동일 중복 검출)
 *
 * WHY
 * checkExactDuplicateTouchRows_() 참고 — Lead ID + MTA Created Date만으로는
 * 정상 다중 터치와 진짜 중복을 구분할 수 없어, 터치 식별 필드
 * (MKT UTM Campaign / First Lead Source / Lead Source Detail)까지 전부
 * 같은 경우만 "완전 동일"로 판단하도록 기준을 좁힘 (2026-07-24 확정).
 * ⚠️ MTA_Master 컬럼명이 "First Touch Detail" → "Lead Source Detail"로
 * 정정됨(13_MTATransformer.js v5.1.0) — 이 함수도 함께 갱신.
 *
 * INPUT
 * records : Object[]  (MTA_Master sheetToObjects() 결과)
 *
 * OUTPUT
 * Object[]  [{ leadId, email, mtaCreatedDate, campaign, source, detail, count }, ...]  (count > 1인 것만)
 *
 * TEST
 * 5개 필드 전부 같은 조합 2번 + 날짜만 같고 캠페인 다른 조합(정상 다중 터치) +
 * 다른 Lead ID 입력 시 count=2인 그룹 1개만 반환
 * ==========================================================
 */
function findExactDuplicateTouchRows_(records) {

  const groups = {};

  records.forEach(function (r) {

    const leadId = String(r["Lead ID"] || "").trim();
    const date = r["MTA Created Date"];

    if (!leadId || !(date instanceof Date) || isNaN(date.getTime())) return;

    const campaign = String(r["MKT UTM Campaign"] || "").trim();
    const source = String(r["First Lead Source"] || "").trim();
    const detail = String(r["Lead Source Detail"] || "").trim();

    const key = [leadId, date.getTime(), campaign, source, detail].join("|");

    if (!groups[key]) {
      groups[key] = {
        leadId: leadId,
        email: r["Email"] || "",
        mtaCreatedDate: date,
        campaign: campaign,
        source: source,
        detail: detail,
        count: 0
      };
    }

    groups[key].count++;

  });

  return Object.keys(groups)
    .map(function (key) { return groups[key]; })
    .filter(function (g) { return g.count > 1; });

}


/**
 * ==========================================================
 * TEST — findExactDuplicateTouchRows_()
 * ==========================================================
 */
function testFindExactDuplicateTouchRows() {

  const date1 = new Date(2026, 0, 1);

  const records = [
    { "Lead ID": "L1", "MTA Created Date": date1, "MKT UTM Campaign": "Webinar_A", "First Lead Source": "Web", "Lead Source Detail": "Form", "Email": "a@test.com" },
    { "Lead ID": "L1", "MTA Created Date": date1, "MKT UTM Campaign": "Webinar_A", "First Lead Source": "Web", "Lead Source Detail": "Form", "Email": "a@test.com" },
    { "Lead ID": "L1", "MTA Created Date": date1, "MKT UTM Campaign": "Seminar_B", "First Lead Source": "Web", "Lead Source Detail": "Form", "Email": "a@test.com" },
    { "Lead ID": "L2", "MTA Created Date": date1, "MKT UTM Campaign": "Webinar_A", "First Lead Source": "Web", "Lead Source Detail": "Form", "Email": "b@test.com" }
  ];

  const result = findExactDuplicateTouchRows_(records);

  const pass =
    result.length === 1 &&
    result[0].leadId === "L1" &&
    result[0].count === 2 &&
    result[0].campaign === "Webinar_A";

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Run Duplicate Touch Row Investigation (수동 실행용, 1회성 진단)
 * ==========================================================
 */
function runInvestigateDuplicateTouchRows() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);

  if (!sheet) {
    throw new Error(CONFIG.SHEETS.MTA_MASTER + " sheet not found.");
  }

  const records = sheetToObjects(sheet);

  const duplicates = findDuplicateTouchRows_(records);

  const totalExtraRows = duplicates.reduce(function (sum, d) { return sum + (d.count - 1); }, 0);

  Logger.log("======================================");
  Logger.log("Duplicate Touch Row Investigation (MTA_Master)");
  Logger.log("======================================");
  Logger.log("Total MTA_Master rows : " + records.length);
  Logger.log("Duplicate (Lead ID + MTA Created Date) groups : " + duplicates.length);
  Logger.log("Extra rows caused by duplication : " + totalExtraRows);
  Logger.log("(참고: 같은 날 서로 다른 채널 터치 2번인 정상 케이스도 섞여 있을 수 있음 — 1차 스크리닝)");
  Logger.log("");

  duplicates
    .sort(function (a, b) { return b.count - a.count; })
    .slice(0, 50)
    .forEach(function (d) {
      Logger.log("  Lead ID=" + d.leadId + " / MTA Created Date=" + d.mtaCreatedDate + " / " + d.count + "회 등장");
    });

  if (duplicates.length > 50) {
    Logger.log("  ... 외 " + (duplicates.length - 50) + "개 그룹 더 있음 (상위 50개만 표시)");
  }

}


/**
 * ==========================================================
 * Sample Duplicate Raw Dates (MTA_Raw 원문 텍스트 직접 비교)
 *
 * WHY
 * findDuplicateTouchRows_()가 잡아낸 "중복"은 parseDate()로 파싱된
 * MTA_Master의 Date 객체 기준이다. parseDate()는 콤마 이후 시간
 * 부분을 무조건 잘라내므로(16_TransformHelper.js), 원본 CSV에 시간이
 * 있었다면 이미 소실된 상태로 비교한 것일 수 있다. MTA_Raw의
 * "Multi Touch Attribution: Created Date" 원문을 직접 찍어서
 * 진짜 시간 정보가 있었는지, 있었다면 서로 다른지 확인한다.
 * ==========================================================
 */
function runSampleDuplicateRawDates() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const mtaSheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);

  if (!mtaSheet) {
    throw new Error(CONFIG.SHEETS.MTA_MASTER + " sheet not found.");
  }

  const records = sheetToObjects(mtaSheet);
  const duplicates = findDuplicateTouchRows_(records);

  Logger.log("Duplicate 그룹 수 (전체) : " + duplicates.length);

  const sampleLeadIds = duplicates.slice(0, 15).map(function (d) { return d.leadId; });

  const rawRecords = readMTARaw();

  Logger.log("======================================");
  Logger.log("Sample Duplicate Groups — MTA_Raw 'Multi Touch Attribution: Created Date' 원문");
  Logger.log("======================================");

  sampleLeadIds.forEach(function (leadId) {

    const rowsForLead = rawRecords.filter(function (r) {
      return String(r["Lead: Lead ID"] || "").trim() === leadId;
    });

    Logger.log("");
    Logger.log("Lead ID=" + leadId + " (Raw row 수=" + rowsForLead.length + ")");

    rowsForLead.forEach(function (r) {

      Logger.log(
        "  RAW Created Date=\"" + r["Multi Touch Attribution: Created Date"] + "\"" +
        " / Campaign=\"" + (r["MKT UTM Campaign"] || "") + "\""
      );

    });

  });

}


/**
 * ==========================================================
 * Count IC Booked / IC Complete — This Calendar Month
 *
 * WHY
 * ACQ_REP의 "IC Booked"/"IC Complete"는 Create Date 기준 cohort
 * 집계라(docs/ACQReportDesign.md), "이번 달에 IC Booked Date가 찍힌
 * 건수"(이벤트 발생 월 기준)와는 다른 숫자다. 사용자가 실제값과
 * 리포트값이 다르다고 한 것을 검증하기 위해 두 기준을 모두 계산해서
 * 비교한다.
 * ==========================================================
 */
function runCountICBookedThisMonth() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(OPS.SHEET.OPS);

  if (!sheet) {
    throw new Error(OPS.SHEET.OPS + " sheet not found.");
  }

  const records = sheetToObjects(sheet);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  function isThisMonth(date) {
    return date instanceof Date && !isNaN(date.getTime()) &&
      date.getFullYear() === year && date.getMonth() === month;
  }

  function isFilled(date) {
    return date instanceof Date && !isNaN(date.getTime());
  }

  let cohortBooked = 0;
  let cohortComplete = 0;
  let eventBooked = 0;
  let eventComplete = 0;

  records.forEach(function (r) {

    const createDate = r["Create Date"];
    const bookedDate = r["IC Booked Date"];
    const completeDate = r["IC Completed Date"];

    if (isThisMonth(createDate) && isFilled(bookedDate)) cohortBooked++;
    if (isThisMonth(createDate) && isFilled(completeDate)) cohortComplete++;

    if (isThisMonth(bookedDate)) eventBooked++;
    if (isThisMonth(completeDate)) eventComplete++;

  });

  Logger.log("======================================");
  Logger.log("IC Booked / IC Complete — " + (month + 1) + "/" + year);
  Logger.log("======================================");
  Logger.log("[Cohort 기준 — ACQ_REP과 동일: Create Date가 이번 달 AND 해당 Date가 채워짐]");
  Logger.log("IC Booked (cohort)   : " + cohortBooked);
  Logger.log("IC Complete (cohort) : " + cohortComplete);
  Logger.log("");
  Logger.log("[이벤트 기준 — 해당 Date 자체가 이번 달 (Create Date 무관)]");
  Logger.log("IC Booked (event)    : " + eventBooked);
  Logger.log("IC Complete (event)  : " + eventComplete);

}


/**
 * ==========================================================
 * Diagnose IC Complete Mismatch — Leads_OPS vs MTA_Master
 *
 * WHY
 * Leads_OPS의 "IC Completed Date가 이번 달인 건수"(43)가
 * MTA_Master 기준 재계산값(26)보다 많음. syncMTAFunnelToOPS_()는
 * 값이 없으면 기존 OPS 값을 보존하므로, 예전엔 있었지만 지금
 * MTA_Master 재계산으로는 안 잡히는 Lead가 있다는 뜻. 원인 후보:
 * computeMTAFunnelByLeadId_()가 "가장 오래된 터치" 행의 IC Completed
 * Date만 보는데, 그 필드가 실제로는 다른 터치 행에만 채워져 있을 수
 * 있음 (Lead 레벨 필드가 모든 터치 행에 동일하게 반복된다는 가정이
 * 깨지는 경우).
 * ==========================================================
 */
function runDiagnoseICCompleteMismatch() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const opsSheet = ss.getSheetByName(OPS.SHEET.OPS);
  const mtaSheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);

  if (!opsSheet) throw new Error(OPS.SHEET.OPS + " sheet not found.");
  if (!mtaSheet) throw new Error(CONFIG.SHEETS.MTA_MASTER + " sheet not found.");

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  function isThisMonth(date) {
    return date instanceof Date && !isNaN(date.getTime()) &&
      date.getFullYear() === year && date.getMonth() === month;
  }

  const opsRecords = sheetToObjects(opsSheet);
  const mtaRecords = sheetToObjects(mtaSheet);

  const funnelByLeadId = computeMTAFunnelByLeadId_(mtaRecords);

  const touchesByLeadId = {};

  mtaRecords.forEach(function (r) {
    const leadId = String(r["Lead ID"] || "").trim();
    if (!leadId) return;
    if (!touchesByLeadId[leadId]) touchesByLeadId[leadId] = [];
    touchesByLeadId[leadId].push(r);
  });

  const opsCompletedThisMonth = opsRecords.filter(function (r) {
    return isThisMonth(r["IC Completed Date"]);
  });

  let earliestTouchHasValue = 0;
  let someOtherTouchHasValue = 0;
  let noTouchHasValue = 0;
  let leadNotInMTA = 0;

  const missingSamples = [];

  opsCompletedThisMonth.forEach(function (r) {

    const leadId = String(r["Lead ID"] || "").trim();
    const funnel = funnelByLeadId[leadId];

    if (!funnel) {
      leadNotInMTA++;
      return;
    }

    if (funnel.icCompletedDate instanceof Date && !isNaN(funnel.icCompletedDate.getTime())) {
      earliestTouchHasValue++;
      return;
    }

    const touches = touchesByLeadId[leadId] || [];

    const anyHasValue = touches.some(function (t) {
      return t["IC Completed Date"] instanceof Date && !isNaN(t["IC Completed Date"].getTime());
    });

    if (anyHasValue) {
      someOtherTouchHasValue++;
      if (missingSamples.length < 10) missingSamples.push(leadId);
    } else {
      noTouchHasValue++;
    }

  });

  Logger.log("======================================");
  Logger.log("IC Complete Mismatch Diagnosis — Leads_OPS vs MTA_Master");
  Logger.log("======================================");
  Logger.log("Leads_OPS: IC Completed Date가 이번 달인 건수 : " + opsCompletedThisMonth.length);
  Logger.log("");
  Logger.log("  Earliest-touch 행에 값 있음 (정상)                    : " + earliestTouchHasValue);
  Logger.log("  다른 touch 행엔 값 있는데 earliest엔 없음 (버그 의심) : " + someOtherTouchHasValue);
  Logger.log("  이 Lead의 어떤 touch 행에도 값 없음                   : " + noTouchHasValue);
  Logger.log("  MTA_Master에 이 Lead ID 자체가 없음                   : " + leadNotInMTA);
  Logger.log("");

  if (missingSamples.length > 0) {
    Logger.log("샘플 Lead ID (다른 touch엔 값 있는데 earliest touch엔 없는 케이스, 최대 10개):");
    Logger.log(missingSamples.join(", "));
  }

}


/**
 * ==========================================================
 * Breakdown IC Complete (This Month) by IC Booked Month
 *
 * WHY
 * IC Complete(이벤트 기준, 이번 달)가 IC Booked(이벤트 기준, 이번 달)보다
 * 많게 나와서 이상하다는 의심이 있었음. Event 기준에서는 "이번 달 Complete"와
 * "이번 달 Booked"가 서로 다른 Lead 집합일 수 있어(예: 지난달 Booked된 상담이
 * 이번 달에 Complete) 수치상 불가능하진 않지만, 실제로 그런 백로그 패턴인지
 * 확인 필요. 특히 IC Booked Date가 아예 비어있는데 IC Completed Date만 있는
 * 경우는 진짜 데이터 이상(부킹 없이 완료는 불가능)이라 별도로 집계한다.
 * ==========================================================
 */
function runBreakdownICCompleteByBookedMonth() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const opsSheet = ss.getSheetByName(OPS.SHEET.OPS);

  if (!opsSheet) throw new Error(OPS.SHEET.OPS + " sheet not found.");

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  function isThisMonth(date) {
    return date instanceof Date && !isNaN(date.getTime()) &&
      date.getFullYear() === year && date.getMonth() === month;
  }

  const records = sheetToObjects(opsSheet);

  const completedThisMonth = records.filter(function (r) {
    return isThisMonth(r["IC Completed Date"]);
  });

  const bookedSameMonth = [];
  const bookedEarlierMonth = [];
  const bookedMissing = [];

  const monthKeyTally = {};

  completedThisMonth.forEach(function (r) {

    const bookedDate = r["IC Booked Date"];
    const leadId = String(r["Lead ID"] || "").trim();

    if (!(bookedDate instanceof Date) || isNaN(bookedDate.getTime())) {
      bookedMissing.push(leadId);
      return;
    }

    if (isThisMonth(bookedDate)) {
      bookedSameMonth.push(leadId);
    } else {
      bookedEarlierMonth.push(leadId);
    }

    const key = bookedDate.getFullYear() + "-" + String(bookedDate.getMonth() + 1).padStart(2, "0");
    monthKeyTally[key] = (monthKeyTally[key] || 0) + 1;

  });

  Logger.log("======================================");
  Logger.log("IC Complete (This Month) — IC Booked Month Breakdown");
  Logger.log("======================================");
  Logger.log("IC Completed Date가 이번 달인 건수 : " + completedThisMonth.length);
  Logger.log("");
  Logger.log("  IC Booked Date도 이번 달 (정상, 빠른 처리)      : " + bookedSameMonth.length);
  Logger.log("  IC Booked Date가 이전 달 (정상, 백로그 처리)    : " + bookedEarlierMonth.length);
  Logger.log("  IC Booked Date가 비어있음 (⚠️ 데이터 이상 의심) : " + bookedMissing.length);
  Logger.log("");
  Logger.log("-- IC Booked Date 월별 분포 --");

  Object.keys(monthKeyTally).sort().forEach(function (key) {
    Logger.log("  " + key + " : " + monthKeyTally[key]);
  });

  if (bookedMissing.length > 0) {
    Logger.log("");
    Logger.log("⚠️ IC Booked Date 없이 IC Completed Date만 있는 Lead ID:");
    Logger.log(bookedMissing.join(", "));
  }

}