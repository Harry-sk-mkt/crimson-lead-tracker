/**
 * ==========================================================
 * Marketing 2.0
 * Master Writer
 *
 * Responsibility
 * Write Master records to Master sheets.
 *
 * Stage
 * 10 Master Build
 *
 * Version
 * v3.1.1
 *
 * Change Log
 * v3.1.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `14_MasterWriter.js` → 신규 `MASTER_008_MasterWriter.js`, 코드 내용 변경 없음.
 * v3.1.0 (2026-08-06)
 * - writeMTAMaster()에 numberColumns=["Revenue"] 추가 — Revenue가 Google Sheets에
 *   의해 날짜로 자동 오인식되는 것 방지(setNumberFormat("0.00") 강제).
 *   **버그 수정**: 직전 작업 중 writeSheetRecords() → appendSheetRecords()로 잘못
 *   바꿔놓은 채 미완성 상태였음 — writeMTAMaster()는 rebuildMTAMaster()(Full Rebuild)
 *   전용이라 반드시 clearContents() 후 overwrite해야 하는데, appendSheetRecords()는
 *   clear 없이 lastRow 뒤에 이어붙이기만 해서 Full Rebuild를 돌릴 때마다 전체 데이터가
 *   중복 append되는 회귀가 있었음. writeSheetRecords()(overwrite)로 원복.
 * v3.0.0 (2026-07-21)
 * - writeLeadMaster()/writeMTAMaster() 최초 구현.
 * ==========================================================
 */


/**
 * ==========================================================
 * Write Leads Master
 * ==========================================================
 *
 * @param {Object[]} records
 *
 */
function writeLeadMaster(records){

  writeSheetRecords(
    CONFIG.SHEETS.LEADS_MASTER,
    records
  );

}


/**
 * ==========================================================
 * Write MTA Master
 * ==========================================================
 *
 * @param {Object[]} records
 *
 */
function writeMTAMaster(records){

  writeSheetRecords(
    CONFIG.SHEETS.MTA_MASTER,
    records,
    [],              // textColumns 없음 (Master는 Date 객체 그대로 유지)
    ["Revenue"]       // ← 숫자 서식 강제 (날짜로 자동 오인식 방지)
  );

}