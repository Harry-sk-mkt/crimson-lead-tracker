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
 * v1.5.0
 *
 * Change Log
 * v1.5.0 (2026-10-15)
 * - `diagnoseEventsWriteLoss_()` + 순수 `splitWriteLossByType_()`(`testSplitWriteLossByType()`)
 *   신규 — 쓰기 검증 부족 시 사라진/남은 값 타입, 첫 유실 칸 서식·데이터 확인 규칙,
 *   비율 수식 잔존 수, 시트/스크립트 TZ를 로그로 남김. 10-15 11:11 "375 쓰고 4만 남음,
 *   재쓰기도 4" 원인 판별용(로그 전용, 동작 변경 없음).
 * v1.4.0 (2026-10-14)
 * - 쓰기 직후 검증 `verifyEventsOPSWrite_()` + 순수 함수 `countEventsWriteShortfall_()`
 *   (`testCountEventsWriteShortfall()`) 신규 — setValues 후 flush·재읽기해
 *   `EVENTS.WRITE_VERIFY_COLUMNS`(Event Date/Time) 칸 수가 쓴 값보다 적으면 그 컬럼만
 *   1회 재쓰기, 결과를 로그로 남김. 10-13 23:11 쓰기 직후 유실(사용자 취침·다른 실행 없음) 대응.
 * v1.3.0 (2026-10-13)
 * - setValues 전에 `EVENTS.DERIVED_DATE_COLUMNS`(FY/Month)를 텍스트 서식으로 고정
 *   (`setTextFormatColumns_()`, UTIL_003) — Month "Sep 26"이 날짜로 자동 변환돼
 *   "September 26"처럼 섞여 보이던 문제(2026-10-13 사용자 보고) 대응.
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

    setTextFormatColumns_(sheet, EVENTS.HEADER, EVENTS.DERIVED_DATE_COLUMNS, EVENTS.ROWS.DATA_START, rows.length);

    sheet
      .getRange(EVENTS.ROWS.DATA_START, 1, rows.length, EVENTS.HEADER.length)
      .setValues(rows);

    verifyEventsOPSWrite_(sheet, rows);

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
 * Diagnose Write Loss (로그 전용)
 *
 * WHY (2026-10-15)
 * 10-15 11:11 build: Event Date 375 → 시트 4, 같은 컬럼 재쓰기 직후에도 4.
 * 1초 안에 재현되므로 외부 삭제가 아니라 "시트가 그 값을 안 받음". 같은 때
 * 비율 수식 컬럼도 비었고 일반 숫자/텍스트는 남음. 어떤 값이 살아남고 어떤
 * 값이 사라지는지(타입), 그 칸의 서식·데이터 확인 규칙, 수식이 남았는지를
 * 다음 발생 때 한 번에 남긴다.
 * ==========================================================
 */
function diagnoseEventsWriteLoss_(sheet, rows, shortfall) {

  const startRow = EVENTS.ROWS.DATA_START;
  const readBack = sheet.getRange(startRow, 1, rows.length, EVENTS.HEADER.length).getValues();

  Logger.log("[쓰기 진단] 시트 TZ=" + sheet.getParent().getSpreadsheetTimeZone() +
    " / 스크립트 TZ=" + Session.getScriptTimeZone() +
    " / maxRows=" + sheet.getMaxRows() + " maxCols=" + sheet.getMaxColumns());

  shortfall.forEach(function (x) {

    const name = EVENTS.HEADER[x.col];
    const split = splitWriteLossByType_(rows, readBack, x.col);

    Logger.log("[쓰기 진단] " + name + " — 사라진 값 타입 " + JSON.stringify(split.lostTypes) +
      " / 남은 값 타입 " + JSON.stringify(split.keptTypes) +
      " / 남은 행 " + JSON.stringify(split.keptSamples));

    if (split.firstLostIndex >= 0) {
      const cell = sheet.getRange(startRow + split.firstLostIndex, x.col + 1);
      const rule = cell.getDataValidation();
      Logger.log("[쓰기 진단] " + name + " 첫 유실 칸 " + cell.getA1Notation() +
        " — 쓴 값 " + describeWriteValue_(rows[split.firstLostIndex][x.col]) +
        " / 서식 " + cell.getNumberFormat() +
        " / 데이터 확인 " + (rule ? rule.getCriteriaType() : "없음"));
    }

  });

  EVENTS.RATIO_FORMULAS.forEach(function (spec) {
    const c = EVENTS.HEADER.indexOf(spec.column);
    if (c < 0) return;
    const formulas = sheet.getRange(startRow, c + 1, rows.length, 1).getFormulas();
    const kept = formulas.filter(function (f) { return f[0]; }).length;
    Logger.log("[쓰기 진단] 수식 " + spec.column + " " + kept + "/" + rows.length);
  });

}


function describeWriteValue_(v) {
  if (v instanceof Date) return "Date(" + (isNaN(v.getTime()) ? "Invalid" : v.toISOString()) + ")";
  return typeof v + "(" + String(v).slice(0, 40) + ")";
}


/**
 * 쓴 값 중 시트에서 사라진 것 / 남은 것을 타입별로 센다 (Pure).
 * 타입: "Date" | "InvalidDate" | typeof 결과.
 */
function splitWriteLossByType_(written, readBack, col) {

  const filled = function (v) { return v !== "" && v !== null && v !== undefined; };
  const typeOf = function (v) {
    if (v instanceof Date) return isNaN(v.getTime()) ? "InvalidDate" : "Date";
    return typeof v;
  };

  const out = { lostTypes: {}, keptTypes: {}, keptSamples: [], firstLostIndex: -1 };

  written.forEach(function (row, i) {
    const w = row[col];
    if (!filled(w)) return;
    const t = typeOf(w);
    if (filled(readBack[i][col])) {
      out.keptTypes[t] = (out.keptTypes[t] || 0) + 1;
      if (out.keptSamples.length < 5) out.keptSamples.push({ row: i, value: describeWriteValue_(w) });
    } else {
      out.lostTypes[t] = (out.lostTypes[t] || 0) + 1;
      if (out.firstLostIndex < 0) out.firstLostIndex = i;
    }
  });

  return out;

}


function testSplitWriteLossByType() {

  const written = [[new Date(2026, 0, 1)], ["2026-01-02"], [new Date(2026, 0, 3)], [""], [new Date("x")]];
  const readBack = [[""], ["2026-01-02"], [new Date(2026, 0, 3)], [""], [""]];

  const r = splitWriteLossByType_(written, readBack, 0);

  const pass =
    r.lostTypes.Date === 1 && r.lostTypes.InvalidDate === 1 &&
    r.keptTypes.string === 1 && r.keptTypes.Date === 1 &&
    r.keptSamples.length === 2 && r.firstLostIndex === 0;

  Logger.log("testSplitWriteLossByType: " + (pass ? "PASS" : "FAIL") + " " + JSON.stringify(r));
  return pass;

}


/**
 * ==========================================================
 * Count Write Shortfall (Pure)
 *
 * WHY (2026-10-14)
 * 10-13 23:11 build는 메모리에 Event Date 374 / Time 73을 갖고 setValues 했는데,
 * 다음 build(01:13)는 Event Date 31 / Time 0을 읽었고 그 사이 Events_OPS를 쓴
 * 실행도 사람 편집도 없었다(버전 기록 23:13, 사용자 취침). 10-08·10-12(Leads_OPS
 * Create Date)도 같은 모양 — "쓴 값이 시트에 안 남음"을 쓰기 직후에 직접 확인한다.
 *
 * @param {Array<Array>} written  setValues에 넘긴 행들
 * @param {Array<Array>} readBack 같은 범위를 다시 읽은 값(열 하나씩이 아니라 전체 행)
 * @param {Array<number>} colIdxs 검사할 0-based 컬럼 인덱스
 * @return {Array<{col:number, written:number, read:number}>} 부족한 컬럼만
 * ==========================================================
 */
function countEventsWriteShortfall_(written, readBack, colIdxs) {

  const filled = function (v) { return v !== "" && v !== null && v !== undefined; };

  return colIdxs.map(function (c) {
    const w = written.filter(function (r) { return filled(r[c]); }).length;
    const r = readBack.filter(function (row) { return filled(row[c]); }).length;
    return { col: c, written: w, read: r };
  }).filter(function (x) { return x.read < x.written; });

}


function testCountEventsWriteShortfall() {

  const written = [[1, "a", new Date(2026, 0, 1)], [2, "", new Date(2026, 0, 2)], [3, "c", ""]];
  const okRead = written.map(function (r) { return r.slice(); });
  const badRead = [[1, "a", ""], [2, "", ""], [3, "c", ""]];

  const none = countEventsWriteShortfall_(written, okRead, [1, 2]);
  const lost = countEventsWriteShortfall_(written, badRead, [1, 2]);

  const pass =
    none.length === 0 &&
    lost.length === 1 && lost[0].col === 2 && lost[0].written === 2 && lost[0].read === 0;

  Logger.log("testCountEventsWriteShortfall: " + (pass ? "PASS" : "FAIL"));
  return pass;

}


/**
 * ==========================================================
 * Verify Events_OPS Write (재읽기 + 부족 컬럼 1회 재쓰기)
 *
 * 로그만 남기고 build를 멈추지 않는다 — 재쓰기 후에도 부족하면 다음 build의
 * Manual 가드가 잡는다(EVENTS_007_ManualBackup.js).
 * ==========================================================
 */
function verifyEventsOPSWrite_(sheet, rows) {

  const colIdxs = EVENTS.WRITE_VERIFY_COLUMNS
    .map(function (name) { return EVENTS.HEADER.indexOf(name); })
    .filter(function (i) { return i >= 0; });

  const readRange = function () {
    SpreadsheetApp.flush();
    return sheet.getRange(EVENTS.ROWS.DATA_START, 1, rows.length, EVENTS.HEADER.length).getValues();
  };

  const label = function (list) {
    return list.map(function (x) { return EVENTS.HEADER[x.col] + " " + x.read + "/" + x.written; }).join(" | ");
  };

  const shortfall = countEventsWriteShortfall_(rows, readRange(), colIdxs);

  if (shortfall.length === 0) {
    Logger.log("[Events_OPS 쓰기 검증] 정상 — " + EVENTS.WRITE_VERIFY_COLUMNS.join(", "));
    return;
  }

  Logger.log("⚠️ [Events_OPS 쓰기 검증] 쓴 값이 시트에 덜 남음 — " + label(shortfall) + " → 해당 컬럼 재쓰기");

  // 진단 실패가 build를 막으면 안 됨
  try {
    diagnoseEventsWriteLoss_(sheet, rows, shortfall);
  } catch (diagError) {
    Logger.log("diagnoseEventsWriteLoss_ 실패(무시): " + diagError);
  }

  shortfall.forEach(function (x) {
    sheet
      .getRange(EVENTS.ROWS.DATA_START, x.col + 1, rows.length, 1)
      .setValues(rows.map(function (r) { return [r[x.col]]; }));
  });

  const after = countEventsWriteShortfall_(rows, readRange(), colIdxs);

  Logger.log(after.length === 0
    ? "[Events_OPS 쓰기 검증] 재쓰기 후 정상"
    : "⚠️ [Events_OPS 쓰기 검증] 재쓰기 후에도 부족 — " + label(after));

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
