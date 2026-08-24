/**
 * ==========================================================
 * Marketing 2.0
 * Raw Deduplicator
 *
 * Responsibility
 * Import으로 들어온 신규 레코드 중, 대상 Raw 시트에 이미 존재하는 행과
 * 모든 필드 값이 완전히 동일한 행만 걸러내는 순수 구조적 비교(structural
 * equality) 전용.
 *
 * No Business Logic
 * No Transformation
 * No Loading (필터링 결과를 반환만 하고 시트에 쓰지 않음 — 실제 쓰기는
 * IMPORT_005_RawWriter.js 책임)
 *
 * WHY
 * Master Build 단계의 완전동일 중복 정리(runAutoDeleteExactDuplicateLeadRows/
 * runAutoDeleteExactDuplicateTouchRows, OPS_006_QA.js)가 파이프라인 tail마다
 * Master 전체를 훑는 방식이라 데이터가 쌓일수록 무거워짐(사용자 지적,
 * 2026-08-25) — 겹치는 export 날짜 범위 재업로드로 생기는 "완전 동일
 * (byte-identical)" 행은 애초에 Raw에 쓰지 않으면 이 부담을 원천적으로
 * 줄일 수 있음.
 *
 * 주의 — 이 파일이 하지 않는 것
 * "같은 Lead ID/같은 터치인데 일부 snapshot 필드(IC Booked Date, Revenue
 * 등)만 다른" 경우까지 하나로 합치는 판단은 어떤 필드가 식별 필드고 어떤
 * 필드가 export 시점마다 바뀌는 snapshot 필드인지, 어느 행이 "더 진행된
 * 상태"인지를 아는 business logic이라 Import 단계 책임 밖 — 그 케이스는
 * 여전히 Master Build 단계(OPS_006_QA.js) 정리에 의존한다(2026-08-25
 * 사용자가 "완전 동일 행만 skip" 정책으로 확정, Raw는 순수 append-only
 * 유지).
 *
 * Stage
 * 00 Import
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-08-25)
 * - 최초 구현.
 * ==========================================================
 */


/**
 * ==========================================================
 * Filter Out Exact Duplicate Raw Records (Sheet I/O)
 * ==========================================================
 *
 * 대상 Raw 시트를 읽어 기존 행들과 완전히 동일한 신규 레코드를 걸러낸다.
 *
 * @param {string} sheetName
 * @param {Object[]} records   Raw에 쓸 예정인 정제된 레코드(Validator 통과분)
 * @return {{ kept: Object[], skipped: Object[] }}
 */
function filterOutExactDuplicateRawRecords_(
  sheetName,
  records
){

  if(records.length === 0){
    return { kept: [], skipped: [] };
  }

  const ss =
    CONFIG.SPREADSHEET;

  const sheet =
    ss.getSheetByName(
      sheetName
    );

  if(!sheet){

    throw new Error(
      "Sheet not found : " +
      sheetName
    );

  }

  const lastRow =
    sheet.getLastRow();

  // Raw 시트가 비어있으면(최초 1회) 비교 대상이 없으므로 그대로 통과.
  if(lastRow < CONFIG.ROWS.DATA_START){
    return { kept: records, skipped: [] };
  }

  const lastCol =
    sheet.getLastColumn();

  const headers =
    sheet.getRange(
      CONFIG.ROWS.HEADER,
      1,
      1,
      lastCol
    ).getValues()[0];

  const existingRows =
    sheet.getRange(
      CONFIG.ROWS.DATA_START,
      1,
      lastRow - CONFIG.ROWS.DATA_START + 1,
      lastCol
    ).getValues();

  const result =
    findNewRawRecords_(
      headers,
      existingRows,
      records
    );

  Logger.log(

    CONFIG.LOG.PREFIX +
    " " +
    sheetName +
    " : Raw dedup — " +
    records.length +
    "건 중 " +
    result.skipped.length +
    "건 완전 동일 중복으로 skip, " +
    result.kept.length +
    "건 신규."

  );

  return result;

}


/**
 * ==========================================================
 * Find New Raw Records (Pure)
 * ==========================================================
 *
 * headers 순서 기준으로 existingRows(기존 Raw 행)와 완전히 동일한
 * value 조합을 가진 record는 skip, 나머지는 kept로 분류. 같은 배치
 * (records) 안에서의 자체 중복도 함께 잡는다.
 *
 * @param {Array} headers
 * @param {Array<Array>} existingRows
 * @param {Object[]} records
 * @return {{ kept: Object[], skipped: Object[] }}
 */
function findNewRawRecords_(
  headers,
  existingRows,
  records
){

  const existingSignatures = {};

  existingRows.forEach(function(row){

    existingSignatures[
      buildRowSignature_(headers, row)
    ] = true;

  });

  const kept = [];
  const skipped = [];

  records.forEach(function(record){

    const row =
      headers.map(function(header){

        return record[header] !== undefined
          ? record[header]
          : "";

      });

    const signature =
      buildRowSignature_(headers, row);

    if(existingSignatures[signature]){

      skipped.push(record);

    } else {

      kept.push(record);
      existingSignatures[signature] = true;

    }

  });

  return { kept: kept, skipped: skipped };

}


/**
 * ==========================================================
 * Build Row Signature (Pure)
 * ==========================================================
 *
 * headers 순서 고정 기준으로 모든 필드 값을 결합해 비교용 문자열 생성.
 *
 * @param {Array} headers
 * @param {Array} row
 * @return {string}
 */
function buildRowSignature_(
  headers,
  row
){

  return headers.map(function(_, index){

    const value = row[index];

    return value === null || value === undefined
      ? ""
      : String(value).trim();

  }).join("");

}


/**
 * ==========================================================
 * TEST — findNewRawRecords_()
 * ==========================================================
 */
function testFindNewRawRecords(){

  const headers = ["Lead ID", "Email", "Create Date"];

  const existingRows = [
    ["L1", "a@test.com", "2026-08-01"]
  ];

  const records = [
    { "Lead ID": "L1", "Email": "a@test.com", "Create Date": "2026-08-01" }, // 완전 동일 → skip
    { "Lead ID": "L1", "Email": "a@test.com", "Create Date": "2026-08-08" }, // 날짜만 다름 → kept (snapshot 판단 없음)
    { "Lead ID": "L2", "Email": "b@test.com", "Create Date": "2026-08-01" }, // 신규 → kept
    { "Lead ID": "L2", "Email": "b@test.com", "Create Date": "2026-08-01" }  // 같은 배치 내 자체 중복 → 두 번째는 skip
  ];

  const result =
    findNewRawRecords_(
      headers,
      existingRows,
      records
    );

  const ok =
    result.kept.length === 2 &&
    result.skipped.length === 2 &&
    result.kept[0]["Create Date"] === "2026-08-08" &&
    result.kept[1]["Lead ID"] === "L2";

  Logger.log(

    "testFindNewRawRecords: " +
    (ok ? "PASS" : "FAIL") +
    "\n  kept=" + JSON.stringify(result.kept) +
    "\n  skipped=" + JSON.stringify(result.skipped)

  );

}
