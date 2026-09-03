/**
 * ==========================================================
 * Marketing 2.0
 * Leads OPS Writer
 *
 * Responsibility
 * Write merged Leads_OPS data into sheet
 *
 * Version
 * v2.3
 *
 * Change Log
 * v2.3 (2026-09-04)
 * - **청크 쓰기 전환(성능/안전장치, docs/exec-plans/active/
 *   2026-09-03-performance-optimization.md #5)**: 데이터 영역 `setValues()`
 *   단일 호출을 `setRangeValuesChunked_()`(UTIL_003_SheetChunkIO.js 신규)로
 *   교체 — 최종 시트 상태 100% 동일, 대용량 대비 안전장치.
 * v2.2 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `23_OPS_Write.js` → 신규 `OPS_005_Write.js`, 코드 내용 변경 없음.
 * v2.1 (2026-07-20)
 * - Replaced hardcoded row indices (1, 2) with
 *   OPS.ROWS.HEADER / OPS.ROWS.DATA_START.
 * ==========================================================
 */

function writeOPS(rows) {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(OPS.SHEET.OPS);

  if (!sheet) {
    sheet = ss.insertSheet(OPS.SHEET.OPS);
  }

  /*
  ==========================================================
  Clear existing contents only
  (Keep column width)
  ==========================================================
  */

  sheet.clear();

  /*
  ==========================================================
  Header
  ==========================================================
  */

  sheet
    .getRange(OPS.ROWS.HEADER, 1, 1, OPS.HEADER.length)
    .setValues([OPS.HEADER]);

  /*
  ==========================================================
  Data
  ==========================================================
  */

  if (rows && rows.length > 0) {

    // 2026-09-04 — 청크 단위 쓰기(UTIL_003_SheetChunkIO.js)로 교체, 최종
    // 시트 상태는 단일 setValues()와 100% 동일(exec-plan #5, 대용량 대비
    // 안전장치).
    setRangeValuesChunked_(
      sheet,
      OPS.ROWS.DATA_START,
      1,
      rows,
      OPS.HEADER.length
    );

  }

  /*
  ==========================================================
  Freeze Header
  ==========================================================
  */

  sheet.setFrozenRows(OPS.ROWS.HEADER);

  /*
  ==========================================================
  Filter
  ==========================================================
  */

  if (sheet.getFilter()) {
    sheet.getFilter().remove();
  }

  if (sheet.getLastRow() > OPS.ROWS.HEADER) {

    sheet
      .getRange(
        OPS.ROWS.HEADER,
        1,
        sheet.getLastRow(),
        OPS.HEADER.length
      )
      .createFilter();

  }

  /*
  ==========================================================
  Apply Styles
  ==========================================================
  */

  applyOPSStyle(sheet);

}