/**
 * ==========================================================
 * Marketing 2.0
 * Raw Writer
 *
 * Responsibility
 * Write imported records to Raw sheets (Append 방식).
 *
 * Stage
 * 00 Import
 *
 * Version
 * v4.0.1
 *
 * Change Log
 * v4.0.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `04_RawWriter.js` → 신규 `IMPORT_005_RawWriter.js`, 코드 내용 변경 없음.
 * v4.0.0 (2026-07-21)
 * - writeSheetRecords() → appendSheetRecords()로 변경.
 * - Raw는 더 이상 매 Import마다 전체 삭제되지 않고,
 *   기존 데이터 뒤에 새 CSV 레코드만 추가됨.
 * ==========================================================
 */


/**
 * ==========================================================
 * Write Leads Raw (Append)
 * ==========================================================
 */
function writeLeadRaw(records){

  appendSheetRecords(
    CONFIG.SHEETS.LEADS_RAW,
    records,
    CONFIG.RAW_DATE_COLUMNS.LEADS
  );

}


/**
 * ==========================================================
 * Write MTA Raw (Append)
 * ==========================================================
 */
function writeMTARaw(records){

  appendSheetRecords(
    CONFIG.SHEETS.MTA_RAW,
    records,
    CONFIG.RAW_DATE_COLUMNS.MTA
  );

}

/**
 * ==========================================================
 * Write IC Funnel Raw (Append)
 * ==========================================================
 */
function writeICFunnelRaw(records){

  appendSheetRecords(
    CONFIG.IC_FUNNEL.SHEET,
    records,
    CONFIG.RAW_DATE_COLUMNS.IC_FUNNEL
  );

}