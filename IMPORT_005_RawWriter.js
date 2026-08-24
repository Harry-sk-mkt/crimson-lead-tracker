/**
 * ==========================================================
 * Marketing 2.0
 * Raw Writer
 *
 * Responsibility
 * Write imported records to Raw sheets (Append 방식).
 * 쓰기 전, 이미 Raw에 있는 행과 완전히 동일한 행은 걸러낸다
 * (IMPORT_008_RawDeduplicator.js).
 *
 * Stage
 * 00 Import
 *
 * Version
 * v4.1.0
 *
 * Change Log
 * v4.1.0 (2026-08-25)
 * - writeLeadRaw()/writeMTARaw()/writeICFunnelRaw() 모두 appendSheetRecords()
 *   호출 전에 filterOutExactDuplicateRawRecords_()(IMPORT_008_RawDeduplicator.js
 *   신규)로 Raw에 이미 존재하는 것과 모든 필드 값이 완전히 같은 행을 걸러내도록
 *   변경(사용자 요청 — Master Build 단계에서 완전동일 중복을 정리하는 방식이
 *   데이터가 쌓일수록 무거워짐, Raw에 애초에 쓰지 않는 쪽으로 이동). 반환값이
 *   없던 세 함수가 { appended, skipped }를 반환하도록 시그니처 변경 —
 *   호출부(IMPORT_001_Import.js)에서 skipped 건수를 사용자에게 보여주기 위함.
 *   "같은 Lead ID/터치인데 일부 필드만 다른" 경우까지 잡는 판단(business
 *   logic)은 여전히 Master Build 단계(OPS_006_QA.js) 책임 — 이 변경 범위 밖
 *   (2026-08-25 사용자 확정).
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
 * Write Leads Raw (Append, 완전 동일 중복 제외)
 * ==========================================================
 *
 * @param {Object[]} records
 * @return {{ appended: number, skipped: number }}
 */
function writeLeadRaw(records){

  const dedup =
    filterOutExactDuplicateRawRecords_(
      CONFIG.SHEETS.LEADS_RAW,
      records
    );

  appendSheetRecords(
    CONFIG.SHEETS.LEADS_RAW,
    dedup.kept,
    CONFIG.RAW_DATE_COLUMNS.LEADS
  );

  return {
    appended: dedup.kept.length,
    skipped: dedup.skipped.length
  };

}


/**
 * ==========================================================
 * Write MTA Raw (Append, 완전 동일 중복 제외)
 * ==========================================================
 *
 * @param {Object[]} records
 * @return {{ appended: number, skipped: number }}
 */
function writeMTARaw(records){

  const dedup =
    filterOutExactDuplicateRawRecords_(
      CONFIG.SHEETS.MTA_RAW,
      records
    );

  appendSheetRecords(
    CONFIG.SHEETS.MTA_RAW,
    dedup.kept,
    CONFIG.RAW_DATE_COLUMNS.MTA
  );

  return {
    appended: dedup.kept.length,
    skipped: dedup.skipped.length
  };

}

/**
 * ==========================================================
 * Write IC Funnel Raw (Append, 완전 동일 중복 제외)
 * ==========================================================
 *
 * @param {Object[]} records
 * @return {{ appended: number, skipped: number }}
 */
function writeICFunnelRaw(records){

  const dedup =
    filterOutExactDuplicateRawRecords_(
      CONFIG.IC_FUNNEL.SHEET,
      records
    );

  appendSheetRecords(
    CONFIG.IC_FUNNEL.SHEET,
    dedup.kept,
    CONFIG.RAW_DATE_COLUMNS.IC_FUNNEL
  );

  return {
    appended: dedup.kept.length,
    skipped: dedup.skipped.length
  };

}