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
 * v1.2.0
 *
 * Change Log
 * v1.2.0 (2026-09-04)
 * - **성능 개선(docs/exec-plans/active/2026-09-03-performance-optimization.md #2)**:
 *   `filterOutExactDuplicateRawRecords_()`에 5번째 optional 파라미터
 *   `dateFieldName` 추가 — 지정 시 Raw 시트 전체를 전체 폭(모든 컬럼)으로
 *   읽는 대신, 그 날짜 컬럼 하나만 먼저 읽어(`findRawDedupComparisonWindow_()`)
 *   신규 레코드들의 날짜 값과 일치하는 기존 행 범위(연속 구간)만 추려 그
 *   구간만 전체 폭으로 읽도록 변경. 완전동일 중복 판정은 날짜 필드도 포함한
 *   모든 필드가 일치해야 성립하므로, 신규 배치의 날짜 값 집합에 없는 날짜를
 *   가진 기존 행은 애초에 중복 후보가 될 수 없음 — 이 성질을 이용해 정확성
 *   손실 없이(시트 정렬 순서와 무관하게 항상 정확, 소급/이상치 행도 값 자체로
 *   걸림) I/O만 줄임. `dateFieldName` 생략 시 기존과 100% 동일(전체 폭 전체
 *   스캔) — `IC_FUNNEL`/`SAL`처럼 필수 날짜 필드가 없는 타입은 계속 생략.
 *   `IMPORT_005_RawWriter.js`(v4.4.0)의 `writeLeadRaw()`/`writeMTARaw()`가
 *   각각 "Create Date"/"Multi Touch Attribution: Created Date" 전달.
 * v1.1.0 (2026-09-02)
 * - filterOutExactDuplicateRawRecords_()에 3번째 optional 파라미터
 *   `targetSpreadsheet` 추가(생략 시 기존과 동일하게 `CONFIG.SPREADSHEET`
 *   사용). SAL을 전용 외부 스프레드시트로 분리(`docs/OpenItems.md` #38,
 *   `MASTER_010_SALSync.js`)하며 `writeSALRaw()`(IMPORT_005_RawWriter.js)가
 *   외부 시트 기준으로 dedup해야 해서 추가.
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
 * @param {Spreadsheet} [targetSpreadsheet]  생략 시 CONFIG.SPREADSHEET —
 *   외부 스프레드시트 기준으로 비교해야 할 때만 명시(SAL_Raw 등, 2026-09-02 추가)
 * @param {string} [dateFieldName]  지정 시 그 컬럼만 먼저 읽어 비교 대상 행
 *   범위를 좁힘(2026-09-04 추가, 필수 필드라 항상 값이 있는 컬럼만 안전 —
 *   IC_FUNNEL/SAL처럼 필수 날짜 필드가 없는 타입은 생략해 기존 전체 스캔 유지)
 * @return {{ kept: Object[], skipped: Object[] }}
 */
function filterOutExactDuplicateRawRecords_(
  sheetName,
  records,
  targetSpreadsheet,
  dateFieldName
){

  if(records.length === 0){
    return { kept: [], skipped: [] };
  }

  const ss =
    targetSpreadsheet || CONFIG.SPREADSHEET;

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

  const totalDataRows =
    lastRow - CONFIG.ROWS.DATA_START + 1;

  const window =
    dateFieldName
      ? findRawDedupComparisonWindow_(
          sheet,
          headers,
          CONFIG.ROWS.DATA_START,
          totalDataRows,
          dateFieldName,
          records
        )
      : { startRow: CONFIG.ROWS.DATA_START, numRows: totalDataRows };

  const existingRows =
    window.numRows === 0
      ? []
      : sheet.getRange(
          window.startRow,
          1,
          window.numRows,
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
    "건 신규." +
    (dateFieldName
      ? " (비교 대상 " + window.numRows + "건 / 전체 " + totalDataRows + "건)"
      : "")

  );

  return result;

}


/**
 * ==========================================================
 * Find Raw Dedup Comparison Window (Sheet I/O)
 * ==========================================================
 *
 * WHY
 * 완전동일 중복 판정은 날짜 필드를 포함한 모든 필드가 일치해야 성립하므로,
 * 신규 레코드들의 날짜 값 집합에 없는 날짜를 가진 기존 행은 애초에 중복
 * 후보가 될 수 없다. 날짜 컬럼 하나만 먼저 읽어(전체 폭 대비 I/O 대폭 절감)
 * 그 값이 신규 배치와 일치하는 기존 행의 최소~최대 인덱스(연속 구간)만 추려,
 * 그 구간만 전체 폭으로 읽도록 한다. 시트가 날짜순 정렬돼 있지 않아도(현재
 * Master/Raw는 Append-only) 항상 정확 — 위치와 무관하게 값 자체로 판정.
 *
 * @param {Sheet} sheet
 * @param {Array} headers
 * @param {number} dataStartRow  1-based
 * @param {number} totalDataRows
 * @param {string} dateFieldName
 * @param {Object[]} records
 * @return {{ startRow: number, numRows: number }}
 */
function findRawDedupComparisonWindow_(
  sheet,
  headers,
  dataStartRow,
  totalDataRows,
  dateFieldName,
  records
){

  const dateColIndex =
    headers.indexOf(dateFieldName);

  if(dateColIndex === -1){

    // 날짜 필드를 헤더에서 못 찾으면 안전하게 전체 범위(기존 동작과 동일)
    return { startRow: dataStartRow, numRows: totalDataRows };

  }

  const dateColumnValues =
    sheet.getRange(
      dataStartRow,
      dateColIndex + 1,
      totalDataRows,
      1
    ).getValues().map(function(row){
      return row[0];
    });

  const window =
    computeRawDedupWindowFromDateColumn_(
      dateColumnValues,
      records.map(function(record){
        return record[dateFieldName];
      })
    );

  return {
    startRow: dataStartRow + window.startOffset,
    numRows: window.numRows
  };

}


/**
 * ==========================================================
 * Compute Raw Dedup Window From Date Column (Pure)
 * ==========================================================
 *
 * @param {Array} existingDateValues   기존 Raw의 날짜 컬럼 값 전체(0-based)
 * @param {Array} incomingDateValues   신규 레코드들의 같은 필드 값
 * @return {{ startOffset: number, numRows: number }}  numRows===0이면 비교 대상 없음
 *
 * TEST
 * testComputeRawDedupWindowFromDateColumn() 참고
 */
function computeRawDedupWindowFromDateColumn_(
  existingDateValues,
  incomingDateValues
){

  const normalize = function(value){
    return value === null || value === undefined
      ? ""
      : String(value).trim();
  };

  const incomingSet = {};

  incomingDateValues.forEach(function(value){
    incomingSet[normalize(value)] = true;
  });

  let minIndex = -1;
  let maxIndex = -1;

  for(let i = 0; i < existingDateValues.length; i++){

    if(incomingSet[normalize(existingDateValues[i])]){

      if(minIndex === -1){
        minIndex = i;
      }

      maxIndex = i;

    }

  }

  if(minIndex === -1){
    return { startOffset: 0, numRows: 0 };
  }

  return {
    startOffset: minIndex,
    numRows: maxIndex - minIndex + 1
  };

}


/**
 * ==========================================================
 * TEST — computeRawDedupWindowFromDateColumn_()
 * ==========================================================
 */
function testComputeRawDedupWindowFromDateColumn(){

  const case1 =
    computeRawDedupWindowFromDateColumn_(
      ["2026-08-01", "2026-08-01", "2026-08-02", "2026-08-03", "2026-08-05"],
      ["2026-08-03", "2026-08-04"]
    );

  const case1Ok =
    case1.startOffset === 3 &&
    case1.numRows === 1;

  // 이상치(소급) — 신규 배치와 일치하는 오래된 행이 맨 앞에 있어도 정확히 포함
  const case2 =
    computeRawDedupWindowFromDateColumn_(
      ["2020-01-01", "2026-08-01", "2026-08-02"],
      ["2020-01-01", "2026-08-02"]
    );

  const case2Ok =
    case2.startOffset === 0 &&
    case2.numRows === 3;

  // 신규 배치의 날짜와 일치하는 기존 행이 하나도 없음 → 비교 대상 0건
  const case3 =
    computeRawDedupWindowFromDateColumn_(
      ["2026-08-01", "2026-08-02"],
      ["2026-09-01"]
    );

  const case3Ok =
    case3.numRows === 0;

  // 신규 배치에 빈 값이 있고 기존에도 빈 값 행이 있으면 그 행도 포함(정확성 우선)
  const case4 =
    computeRawDedupWindowFromDateColumn_(
      ["2026-08-01", "", "2026-08-02"],
      ["", "2026-08-02"]
    );

  const case4Ok =
    case4.startOffset === 1 &&
    case4.numRows === 2;

  const ok =
    case1Ok && case2Ok && case3Ok && case4Ok;

  Logger.log(

    "testComputeRawDedupWindowFromDateColumn: " +
    (ok ? "PASS" : "FAIL") +
    "\n  case1=" + JSON.stringify(case1) +
    "\n  case2=" + JSON.stringify(case2) +
    "\n  case3=" + JSON.stringify(case3) +
    "\n  case4=" + JSON.stringify(case4)

  );

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
