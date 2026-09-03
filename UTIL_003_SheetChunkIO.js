/**
 * ==========================================================
 * Marketing 2.0
 * Sheet Chunk IO
 *
 * Responsibility
 * 대용량 Range 읽기/쓰기를 청크(chunk) 단위로 분할 수행한다 — 결과(반환
 * 배열/최종 시트 상태)는 단일 `getRange().getValues()`/`setValues()` 호출과
 * 100% 동일하다(동작/출력 변경 없음, 순수하게 I/O 호출 방식만 분할).
 *
 * WHY (도입 배경, 2026-09-04)
 * `docs/exec-plans/active/2026-09-03-performance-optimization.md` #5 —
 * Leads_Master/Leads_OPS/Raw 이관 스크립트 등이 계속 커지는 대용량 시트
 * (수만~수십만 행)를 단일 `getValues()`/`setValues()` 호출로 한 번에 읽고/
 * 쓰는데, 데이터가 더 쌓이면 Apps Script 6분 실행 제한이나 응답 크기
 * 제한에 걸릴 위험이 커진다. 청크 단위로 나눠 여러 번 호출하면 그 위험을
 * 낮출 수 있다 — 지금 당장 문제가 있는 건 아니지만(실측상 8.7만 행도
 * 103초로 여유 있었음, 2026-09-03 Master_DB 이관 검증 참고) 데이터가 계속
 * 누적되는 구조라 미리 안전장치를 넣어둔다(사용자 확정, 병합/증분 로직
 * 자체는 건드리지 않는 범위로 한정 — 위험이 큰 부분은 별도 논의).
 *
 * Stage
 * Shared Component (Master Build / OPS Build / Raw Migration 등에서 공용)
 *
 * Version
 * v1.0.0
 * ==========================================================
 */


const SHEET_CHUNK_IO_DEFAULT_CHUNK_SIZE = 8000; // exec-plan 권장 범위(5,000~10,000)의 중간값


/**
 * ==========================================================
 * Compute Chunk Ranges (순수 함수)
 *
 * WHY
 * "시작 행 + 전체 행 수 + 청크 크기"로부터 실제 청크별 {startRow, numRows}
 * 목록을 계산하는 부분만 순수 로직으로 분리해 테스트 가능하게 함(Sheet
 * IO와 분리).
 *
 * INPUT
 * startRow : number  1-based 시작 행
 * totalRows : number  전체 행 수
 * chunkSize : number  (optional) 생략 시 SHEET_CHUNK_IO_DEFAULT_CHUNK_SIZE
 *
 * OUTPUT
 * Array<{startRow, numRows}>  totalRows<=0이면 빈 배열
 *
 * TEST
 * testComputeChunkRanges() 참고
 * ==========================================================
 */
function computeChunkRanges_(startRow, totalRows, chunkSize){

  const size = chunkSize > 0 ? chunkSize : SHEET_CHUNK_IO_DEFAULT_CHUNK_SIZE;

  const ranges = [];

  let processed = 0;

  while(processed < totalRows){

    const numRows = Math.min(size, totalRows - processed);

    ranges.push({
      startRow: startRow + processed,
      numRows: numRows
    });

    processed += numRows;

  }

  return ranges;

}


/**
 * ==========================================================
 * TEST — computeChunkRanges_()
 * ==========================================================
 */
function testComputeChunkRanges(){

  const ranges = computeChunkRanges_(2, 25000, 10000);

  const rangesOk =
    ranges.length === 3 &&
    ranges[0].startRow === 2 && ranges[0].numRows === 10000 &&
    ranges[1].startRow === 10002 && ranges[1].numRows === 10000 &&
    ranges[2].startRow === 20002 && ranges[2].numRows === 5000;

  const zero = computeChunkRanges_(2, 0, 10000);
  const zeroOk = zero.length === 0;

  const exact = computeChunkRanges_(2, 10000, 10000);
  const exactOk = exact.length === 1 && exact[0].startRow === 2 && exact[0].numRows === 10000;

  const defaultSize = computeChunkRanges_(1, 10000); // chunkSize 생략 — 기본값(8000) 사용
  const defaultSizeOk =
    defaultSize.length === 2 &&
    defaultSize[0].numRows === 8000 &&
    defaultSize[1].numRows === 2000;

  const pass = rangesOk && zeroOk && exactOk && defaultSizeOk;

  Logger.log(
    "testComputeChunkRanges: " + (pass ? "PASS" : "FAIL") +
    "\n  ranges=" + JSON.stringify(ranges) +
    "\n  defaultSize=" + JSON.stringify(defaultSize)
  );

}


/**
 * ==========================================================
 * Get Range Values Chunked (IO 래퍼)
 *
 * WHY
 * `sheet.getRange(startRow, startCol, totalRows, numCols).getValues()`와
 * 결과가 100% 동일 — 다만 내부적으로 `computeChunkRanges_()`가 계산한
 * 청크 단위로 나눠 여러 번 호출한다.
 *
 * @param {Sheet} sheet
 * @param {number} startRow
 * @param {number} startCol
 * @param {number} totalRows
 * @param {number} numCols
 * @param {number} [chunkSize]
 * @return {Array<Array>}
 * ==========================================================
 */
function getRangeValuesChunked_(sheet, startRow, startCol, totalRows, numCols, chunkSize){

  if(totalRows <= 0){
    return [];
  }

  const ranges = computeChunkRanges_(startRow, totalRows, chunkSize);

  let values = [];

  ranges.forEach(function(range){

    const chunkValues =
      sheet.getRange(range.startRow, startCol, range.numRows, numCols).getValues();

    values = values.concat(chunkValues);

  });

  return values;

}


/**
 * ==========================================================
 * Set Range Values Chunked (IO 래퍼)
 *
 * WHY
 * `sheet.getRange(startRow, startCol, rows.length, numCols).setValues(rows)`
 * 와 최종 시트 상태가 100% 동일 — 다만 내부적으로 청크 단위로 나눠 여러 번
 * 호출한다.
 *
 * @param {Sheet} sheet
 * @param {number} startRow
 * @param {number} startCol
 * @param {Array<Array>} rows
 * @param {number} numCols
 * @param {number} [chunkSize]
 * ==========================================================
 */
function setRangeValuesChunked_(sheet, startRow, startCol, rows, numCols, chunkSize){

  if(!rows || rows.length === 0){
    return;
  }

  const ranges = computeChunkRanges_(startRow, rows.length, chunkSize);

  ranges.forEach(function(range){

    const offset = range.startRow - startRow;
    const chunkRows = rows.slice(offset, offset + range.numRows);

    sheet.getRange(range.startRow, startCol, range.numRows, numCols).setValues(chunkRows);

  });

}
