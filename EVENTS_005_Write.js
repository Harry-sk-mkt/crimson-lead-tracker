/**
 * ==========================================================
 * Marketing 2.0
 * Events Write
 *
 * Responsibility
 * Write merged Events_OPS data into sheet (SUBTOTAL row + header +
 * data), mirrors 23_OPS_Write.js.
 *
 * Version
 * v1.2.1
 *
 * Change Log
 * v1.2.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `54_Events_Write.js` → 신규 `EVENTS_005_Write.js`, 코드 내용 변경 없음.
 * v1.2.0 (2026-08-09)
 * - `buildRatioFormula_()`/`buildGuardedRatioFormula_()` 추가 —
 *   Events/BOFU/Content/Search_OPS의 비율 컬럼(Success %/CPNP1/ROAS 등)과
 *   ACQ_REP/NewP1_REP/FY_REP의 %/CPNP1/CPL 컬럼을 JS 계산값이 아니라
 *   실제 시트 수식(`=IFERROR(...)`)으로 쓰기 위한 공용 pure 헬퍼(사용자
 *   요청 — 수동 입력값을 고치면 파이프라인 재실행 없이 즉시 재계산되길
 *   원함). `columnIndexToLetter_()`가 이미 이 파일에 있어 같은 자리에
 *   추가(도메인 공용 헬퍼가 모이는 기존 관례). `divideGuard_()`(구
 *   53_Events_Merge.js)를 대체 — 그 함수와 4개 도메인의
 *   `applyXGroup5Derived_()`는 더 이상 쓰이지 않아 각 Merge 파일에서 삭제.
 * v1.1.0 (2026-08-06)
 * - 헤더 재구성 반영(50_Events_Config.js v1.7.0): EVENTS_SUBTOTAL_COLUMNS의
 *   "Leads(Meta)" → "Results"로 리네임(같은 컬럼, 이름만 변경). GROUP_2_MANUAL
 *   신규 "EV IC REQ."(개수 컬럼)는 concat으로 자동 포함됨(코드 변경 불필요).
 * ==========================================================
 */

/**
 * SUBTOTAL(109, ...) 대상 컬럼 — 개수/금액 성격의 Group2/3/4만.
 * Group1(텍스트), Group3의 %컬럼(CVR), Group5(비율), FY/Month는
 * 합계 의미가 없어 제외.
 */
const EVENTS_SUBTOTAL_COLUMNS =
  EVENTS.GROUP_2_MANUAL
    .concat(["Clicks", "Results", "Spent"])
    .concat(EVENTS.GROUP_4_COMPUTED);


function writeEventsOPS_(rows) {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(EVENTS.SHEET.OPS);

  if (!sheet) {
    sheet = ss.insertSheet(EVENTS.SHEET.OPS);
  }

  sheet.clear();

  /*
  ==========================================================
  Header (row 2)
  ==========================================================
  */

  sheet
    .getRange(EVENTS.ROWS.HEADER, 1, 1, EVENTS.HEADER.length)
    .setValues([EVENTS.HEADER]);

  /*
  ==========================================================
  Data (row 3~)
  ==========================================================
  */

  if (rows && rows.length > 0) {

    sheet
      .getRange(EVENTS.ROWS.DATA_START, 1, rows.length, EVENTS.HEADER.length)
      .setValues(rows);

  }

  /*
  ==========================================================
  SUBTOTAL row (row 1)
  ==========================================================
  */

  writeEventsSubtotalRow_(sheet, rows.length);

  /*
  ==========================================================
  Freeze (SUBTOTAL + Header)
  ==========================================================
  */

  sheet.setFrozenRows(EVENTS.ROWS.HEADER);

  /*
  ==========================================================
  Filter (헤더 행부터)
  ==========================================================
  */

  if (sheet.getFilter()) {
    sheet.getFilter().remove();
  }

  if (sheet.getLastRow() > EVENTS.ROWS.HEADER) {

    sheet
      .getRange(
        EVENTS.ROWS.HEADER,
        1,
        sheet.getLastRow() - EVENTS.ROWS.HEADER + 1,
        EVENTS.HEADER.length
      )
      .createFilter();

  }

  /*
  ==========================================================
  Apply Styles
  ==========================================================
  */

  applyEventsOPSStyle(sheet);

}


/**
 * ==========================================================
 * Write SUBTOTAL Row (row 1)
 *
 * WHY
 * 실무에서 필터를 걸어도(예: FY/Segment 필터) 화면에 보이는 행만의
 * 합계를 바로 볼 수 있어야 한다는 요구사항 (원본 xlsx 실무 패턴
 * 그대로 이관). SUBTOTAL(109, range)는 숨겨진(필터된) 행을 제외하고
 * 합산 — 109=SUM.
 *
 * INPUT
 * sheet : Sheet
 * dataRowCount : number
 * ==========================================================
 */
function writeEventsSubtotalRow_(sheet, dataRowCount) {

  const lastDataRow =
    dataRowCount > 0
      ? EVENTS.ROWS.DATA_START + dataRowCount - 1
      : EVENTS.ROWS.DATA_START;

  const subtotalRow = EVENTS.HEADER.map(function (colName, i) {

    if (EVENTS_SUBTOTAL_COLUMNS.indexOf(colName) === -1) return "";

    const colLetter = columnIndexToLetter_(i + 1);

    return "=SUBTOTAL(109," + colLetter + EVENTS.ROWS.DATA_START + ":" + colLetter + lastDataRow + ")";

  });

  sheet
    .getRange(EVENTS.ROWS.SUBTOTAL, 1, 1, EVENTS.HEADER.length)
    .setValues([subtotalRow]);

}


/**
 * ==========================================================
 * Column Index (1-based) → A1 Letter
 *
 * TEST
 * columnIndexToLetter_(1) === "A"
 * columnIndexToLetter_(27) === "AA"
 * ==========================================================
 */
function columnIndexToLetter_(index) {

  let letter = "";
  let n = index;

  while (n > 0) {

    const remainder = (n - 1) % 26;

    letter = String.fromCharCode(65 + remainder) + letter;

    n = Math.floor((n - 1) / 26);

  }

  return letter;

}


/**
 * ==========================================================
 * TEST — columnIndexToLetter_()
 * ==========================================================
 */
function testColumnIndexToLetter_() {

  const pass =
    columnIndexToLetter_(1) === "A" &&
    columnIndexToLetter_(26) === "Z" &&
    columnIndexToLetter_(27) === "AA" &&
    columnIndexToLetter_(52) === "AZ";

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Build Ratio Formula (분모=0 → 고정 fallback)
 *
 * WHY
 * OPS 비율 컬럼(Match Rate/Success %/CPNP1/ROAS 등, 기존 divideGuard_()가
 * 항상 0을 반환하던 케이스)과 ACQ_REP 메인 비율(All P1%/New Leads%/New P1%,
 * 기존 `s.x>0 ? a/b : 0`)처럼 "분모가 0이면 항상 같은 고정값" 컬럼용.
 * 분자/분모 컬럼이 항상 존재하는(외부 조회로 "값 자체가 없음"이 있을 수
 * 없는) 컬럼에만 쓴다 — "값 자체가 없음"까지 구분해야 하면
 * buildGuardedRatioFormula_() 사용.
 *
 * INPUT
 * numColLetter : string  (분자 컬럼 A1 문자, 예: "R")
 * denColLetter : string  (분모 컬럼 A1 문자, 예: "N")
 * sheetRow     : number  (1-based 시트 행 번호)
 * fallback     : number|string  (분모 0일 때 값, 기본 0)
 *
 * TEST
 * buildRatioFormula_("R", "N", 5) === "=IFERROR(R5/N5,0)"
 * buildRatioFormula_("D", "C", 3, "") === "=IFERROR(D3/C3,\"\")"
 * ==========================================================
 */
function buildRatioFormula_(numColLetter, denColLetter, sheetRow, fallback) {

  const fallbackLiteral =
    (fallback === undefined || fallback === 0) ? 0 : '"' + fallback + '"';

  return "=IFERROR(" + numColLetter + sheetRow + "/" + denColLetter + sheetRow +
    "," + fallbackLiteral + ")";

}


/**
 * ==========================================================
 * TEST — buildRatioFormula_()
 * ==========================================================
 */
function testBuildRatioFormula() {

  const pass =
    buildRatioFormula_("R", "N", 5) === "=IFERROR(R5/N5,0)" &&
    buildRatioFormula_("D", "C", 3, "") === "=IFERROR(D3/C3,\"\")";

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Build Guarded Ratio Formula (특정 셀이 비어있음 vs 0 구분)
 *
 * WHY
 * ACQ_REP/NewP1_REP의 Target%/CPNP1처럼 분자 또는 분모가 외부 조회값
 * (Ad_Spend_Cache, Target_Engine)이라 "그 키 자체가 없음(공란)"과 "값은
 * 있지만 0"을 구분해야 하는 컬럼용 — 기존 JS는 `hasOwnProperty` 체크로
 * 이를 구분했다. guardColLetter 셀이 공란이면 그대로 공란, 분모가 0이거나
 * 나눗셈이 에러면 공란(항상 blank fallback — 이 패턴을 쓰는 기존 컬럼들은
 * 전부 blank 관례였음).
 *
 * INPUT
 * numColLetter  : string
 * denColLetter  : string
 * sheetRow      : number
 * guardColLetter: string  ("공란이면 무조건 공란"으로 볼 셀 — 생략 시
 *                          denColLetter와 동일, 기존 ACQ_REP Target% 케이스)
 *
 * TEST
 * buildGuardedRatioFormula_("N", "S", 5)
 *   === "=IF(S5=\"\",\"\",IFERROR(N5/S5,\"\"))"
 * buildGuardedRatioFormula_("N", "D", 5, "N")
 *   === "=IF(N5=\"\",\"\",IFERROR(N5/D5,\"\"))"
 * ==========================================================
 */
function buildGuardedRatioFormula_(numColLetter, denColLetter, sheetRow, guardColLetter) {

  const guardLetter = guardColLetter || denColLetter;

  return "=IF(" + guardLetter + sheetRow + '="","",IFERROR(' +
    numColLetter + sheetRow + "/" + denColLetter + sheetRow + ',""))';

}


/**
 * ==========================================================
 * TEST — buildGuardedRatioFormula_()
 * ==========================================================
 */
function testBuildGuardedRatioFormula() {

  const pass =
    buildGuardedRatioFormula_("N", "S", 5) === "=IF(S5=\"\",\"\",IFERROR(N5/S5,\"\"))" &&
    buildGuardedRatioFormula_("N", "D", 5, "N") === "=IF(N5=\"\",\"\",IFERROR(N5/D5,\"\"))";

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}
