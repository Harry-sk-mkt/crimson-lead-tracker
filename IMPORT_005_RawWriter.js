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
 * v4.4.0
 *
 * Change Log
 * v4.4.0 (2026-09-04)
 * - **성능 개선(docs/exec-plans/active/2026-09-03-performance-optimization.md #2)**:
 *   `writeLeadRaw()`/`writeMTARaw()`가 `filterOutExactDuplicateRawRecords_()`
 *   (IMPORT_008_RawDeduplicator.js v1.2.0)에 4번째 인자로 각각
 *   `"Create Date"`/`"Multi Touch Attribution: Created Date"`(REQUIRED_FIELDS라
 *   항상 값이 있어 안전) 전달 — Raw 전체(수만~8만+ 행) 대신 신규 배치와 날짜가
 *   겹치는 구간만 읽어 dedup 비교. `writeICFunnelRaw()`/`writeSALRaw()`는 필수
 *   날짜 필드가 없어(REQUIRED_FIELDS에 "Lead ID"만 있음) 그대로 미전달(기존
 *   전체 스캔 유지, No Assumptions).
 * v4.3.0 (2026-09-03)
 * - **Master_DB Raw 이관 2단계** — `writeLeadRaw()`/`writeMTARaw()`/
 *   `writeICFunnelRaw()` 모두 `writeSALRaw()`와 동일하게 전용 외부
 *   스프레드시트(`openLeadsRawExternalSpreadsheet_()`/
 *   `openMTARawExternalSpreadsheet_()`(MASTER_005_DataReader.js v2.2.0)/
 *   `openICFunnelRawExternalSpreadsheet_()`(MASTER_009_ICFunnelSync.js
 *   v1.8.0))를 열어 `filterOutExactDuplicateRawRecords_()`/
 *   `appendSheetRecords()`에 명시 전달하도록 변경. `docs/exec-plans/active/
 *   2026-09-03-master-db-raw-migration.md` 참고.
 * v4.2.0 (2026-09-02)
 * - writeSALRaw() 신규(`docs/OpenItems.md` #38, `MASTER_010_SALSync.js`) —
 *   SAL을 IC Funnel에서 분리해 전용 외부 스프레드시트(CONFIG.SAL.EXTERNAL.
 *   SPREADSHEET_ID)에 append. 다른 세 함수와 달리 `filterOutExactDuplicateRawRecords_()`/
 *   `appendSheetRecords()`에 `targetSpreadsheet`(외부 openById() 결과)를
 *   명시 전달(IMPORT_006_SheetWriter.js v4.2.0/IMPORT_008_RawDeduplicator.js
 *   v1.1.0의 신규 optional 파라미터).
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

  const externalFile = openLeadsRawExternalSpreadsheet_();

  const dedup =
    filterOutExactDuplicateRawRecords_(
      CONFIG.SHEETS.LEADS_RAW,
      records,
      externalFile,
      "Create Date"
    );

  appendSheetRecords(
    CONFIG.SHEETS.LEADS_RAW,
    dedup.kept,
    CONFIG.RAW_DATE_COLUMNS.LEADS,
    [],
    externalFile
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

  const externalFile = openMTARawExternalSpreadsheet_();

  const dedup =
    filterOutExactDuplicateRawRecords_(
      CONFIG.SHEETS.MTA_RAW,
      records,
      externalFile,
      "Multi Touch Attribution: Created Date"
    );

  appendSheetRecords(
    CONFIG.SHEETS.MTA_RAW,
    dedup.kept,
    CONFIG.RAW_DATE_COLUMNS.MTA,
    [],
    externalFile
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

  const externalFile = openICFunnelRawExternalSpreadsheet_();

  const dedup =
    filterOutExactDuplicateRawRecords_(
      CONFIG.IC_FUNNEL.SHEET,
      records,
      externalFile
    );

  appendSheetRecords(
    CONFIG.IC_FUNNEL.SHEET,
    dedup.kept,
    CONFIG.RAW_DATE_COLUMNS.IC_FUNNEL,
    [],
    externalFile
  );

  return {
    appended: dedup.kept.length,
    skipped: dedup.skipped.length
  };

}

/**
 * ==========================================================
 * Write SAL Raw (전용 외부 스프레드시트, Append, 완전 동일 중복 제외)
 *
 * WHY
 * `docs/OpenItems.md` #38 — SAL을 IC Funnel 리포트/메인 스프레드시트에서
 * 완전히 분리, `openSALExternalSpreadsheet_()`(MASTER_010_SALSync.js)로
 * 연 외부 스프레드시트의 SAL_Raw 탭에 append. dedup/append 둘 다 그
 * Spreadsheet 객체를 명시 전달.
 * ==========================================================
 *
 * @param {Object[]} records
 * @return {{ appended: number, skipped: number }}
 */
function writeSALRaw(records){

  const externalFile = openSALExternalSpreadsheet_();

  const dedup =
    filterOutExactDuplicateRawRecords_(
      CONFIG.SAL.SHEET,
      records,
      externalFile
    );

  appendSheetRecords(
    CONFIG.SAL.SHEET,
    dedup.kept,
    CONFIG.RAW_DATE_COLUMNS.SAL,
    [],
    externalFile
  );

  return {
    appended: dedup.kept.length,
    skipped: dedup.skipped.length
  };

}