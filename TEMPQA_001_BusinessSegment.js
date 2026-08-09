/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — Business Segment Rule Check
 *
 * Responsibility
 * Leads_OPS의 Business Segment를 getBusinessSegment()(16_TransformHelper.js)
 * 재계산값과 대조해서, Other로 분류된 행 + 룰과 실제 값이 어긋나는 행을
 * "temp_QA" 시트에 나열한다. 사람이 직접 검토(FT Override로 수정)하기 위한
 * 임시 작업 시트 — Leads_OPS_QA(24_OPSQA.js)와 달리 1회성/수시 재실행용.
 *
 * WHY
 * 2026-07-25 전체 OPS(Leads/BOFU/Search/Content/Events) 구축 완료 후 QA
 * 착수 시점에 필요해짐. Leads_OPS에는 First MKT UTM Campaign/First Lead
 * Source 컬럼이 없어(20_OPS_Config.js SF_COLUMNS 참고, Business Segment
 * 계산 입력 3개 중 First Touch Detail만 OPS에 존재) Leads_Master를
 * Lead ID로 조인해서 가져온다.
 *
 * Version
 * v1.1.1
 *
 * Change Log
 * v1.1.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `25_TempQA_BusinessSegment.js` → 신규 `TEMPQA_001_BusinessSegment.js`, 코드 내용 변경 없음.
 * v1.1.0 (2026-07-25)
 * - categorizeSegmentQARow_()에 campaign/detail 파라미터 추가, "comp"/
 *   "checklist"/"Mini Digital SAT"/"TOFU" 포함 시 "Other 잘 분류" 플래그로
 *   구분(개별 예외 확인 완료, 재검토 대상에서 시각적으로 제외하기 위함).
 * ==========================================================
 */

const TEMP_QA_SHEET = "temp_QA";

const TEMP_QA_HEADERS = [
  "Lead ID",
  "Email",
  "First MKT UTM Campaign",
  "First Touch Detail",
  "First Lead Source",
  "Business Segment (현재)",
  "Business Segment (재계산)",
  "Flag"
];


/**
 * ==========================================================
 * Run Temp QA — Business Segment Rule Check (수동 실행용)
 * ==========================================================
 */
function runTempQABusinessSegment() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const opsSheet = ss.getSheetByName(OPS.SHEET.OPS);
  const masterSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS_MASTER);

  if (!opsSheet) throw new Error(OPS.SHEET.OPS + " sheet not found.");
  if (!masterSheet) throw new Error(CONFIG.SHEETS.LEADS_MASTER + " sheet not found.");

  const opsRecords = sheetToObjects(opsSheet);
  const masterRecords = sheetToObjects(masterSheet);

  const masterByLeadId = {};

  masterRecords.forEach(function (r) {

    const leadId = String(r["Lead ID"] || "").trim();
    if (leadId) masterByLeadId[leadId] = r;

  });

  const rows = [];

  opsRecords.forEach(function (opsRecord) {

    const leadId = String(opsRecord["Lead ID"] || "").trim();
    const masterRecord = masterByLeadId[leadId];

    const campaign = masterRecord ? masterRecord["First MKT UTM Campaign"] : "";
    const leadSource = masterRecord ? masterRecord["First Lead Source"] : "";
    const detail = opsRecord["First Touch Detail"];

    const currentSegment = opsRecord["Business Segment"] || "";
    const recomputedSegment = getBusinessSegment(campaign, detail, leadSource);

    const result = categorizeSegmentQARow_(currentSegment, recomputedSegment, campaign, detail);

    if (!result.include) return;

    rows.push([
      leadId,
      opsRecord["Email"] || "",
      campaign || "",
      detail || "",
      leadSource || "",
      currentSegment,
      recomputedSegment,
      result.flag
    ]);

  });

  writeTempQASheet_(rows);

  Logger.log("temp_QA 작성 완료 — " + rows.length + "행 (Other + Rule Mismatch 포함, 총 Leads_OPS " + opsRecords.length + "행 중)");

}


/**
 * ==========================================================
 * Known "Other" Exception Keywords (2026-07-25)
 *
 * WHY
 * temp_QA 반복 검토 끝에 남은 Other 중 "comp"/"checklist"/"Mini Digital SAT"/
 * "TOFU"가 포함된 건 일반화 가능한 분류 룰이 아니라 캠페인 집행/네이밍 실수로
 * 보이는 개별 예외로 확인됨(사용자 확인). getBusinessSegment()는 건드리지
 * 않고, temp_QA 결과에서 "이미 확인된 정상 Other"임을 표시만 해서 재검토
 * 대상에서 시각적으로 구분되게 함.
 * ==========================================================
 */
const TEMP_QA_KNOWN_OTHER_EXCEPTION_KEYWORDS = ["comp", "checklist", "mini digital sat", "tofu"];


/**
 * ==========================================================
 * Categorize Segment QA Row (현재 값 vs 재계산 값 비교 → 포함 여부 + 라벨)
 *
 * WHY
 * "Other로 분류된 것" + "다른 세그먼트 중 룰에 안 맞는 것"을 한 번에
 * 판단하는 로직을 I/O(시트 읽기/쓰기)에서 분리해 테스트 가능하게 함.
 *
 * OUTPUT
 * { include: boolean, flag: string }
 * ==========================================================
 */
function categorizeSegmentQARow_(currentSegment, recomputedSegment, campaign, detail) {

  const isOther = currentSegment === "Other";
  const isMismatch = currentSegment !== recomputedSegment;

  if (isOther && !isMismatch) {

    const text = (String(campaign || "") + " " + String(detail || "")).toLowerCase();

    const isKnownException = TEMP_QA_KNOWN_OTHER_EXCEPTION_KEYWORDS.some(function (kw) {
      return text.includes(kw);
    });

    if (isKnownException) {
      return { include: true, flag: "Other 잘 분류" };
    }

    return { include: true, flag: "Other (룰상으로도 Other)" };
  }

  if (isOther && isMismatch) {
    return { include: true, flag: "Other인데 재계산은 다름 (Master 재빌드 필요 의심)" };
  }

  if (!isOther && isMismatch) {
    return { include: true, flag: "Rule Mismatch" };
  }

  return { include: false, flag: "" };

}


/**
 * ==========================================================
 * TEST — categorizeSegmentQARow_()
 * ==========================================================
 */
function testCategorizeSegmentQARow() {

  const bothOther = categorizeSegmentQARow_("Other", "Other", "", "some random detail");
  const staleOther = categorizeSegmentQARow_("Other", "Content", "", "some random detail");
  const ruleMismatch = categorizeSegmentQARow_("Search", "Content", "", "some random detail");
  const agree = categorizeSegmentQARow_("Content", "Content", "", "some random detail");
  const knownException = categorizeSegmentQARow_("Other", "Other", "", "WF-2023-01-KOR-TOFU-Core Some Checklist");

  const pass =
    bothOther.include === true && bothOther.flag === "Other (룰상으로도 Other)" &&
    staleOther.include === true && staleOther.flag === "Other인데 재계산은 다름 (Master 재빌드 필요 의심)" &&
    ruleMismatch.include === true && ruleMismatch.flag === "Rule Mismatch" &&
    agree.include === false &&
    knownException.include === true && knownException.flag === "Other 잘 분류";

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Write Temp QA Sheet
 * ==========================================================
 */
function writeTempQASheet_(rows) {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(TEMP_QA_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(TEMP_QA_SHEET);
  }

  sheet.clearContents();
  sheet.clearFormats();

  sheet.getRange(1, 1, 1, TEMP_QA_HEADERS.length)
    .setValues([TEMP_QA_HEADERS])
    .setFontWeight("bold");

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, TEMP_QA_HEADERS.length).setValues(rows);
  }

  sheet.setFrozenRows(1);

  SpreadsheetApp.flush();

}
