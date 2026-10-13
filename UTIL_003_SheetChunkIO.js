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
 * v1.1.0
 *
 * Change Log
 * v1.1.0 (2026-10-13)
 * - `setTextFormatColumns_()` 신규 — 지정 컬럼의 데이터 행을 텍스트 서식("@")으로
 *   고정. OPS 시트 Month("Sep 26")가 setValues 시 Sheets에 의해 날짜로 자동 변환돼
 *   "September 26"처럼 섞여 보이던 문제(2026-10-13 사용자 보고, Events_OPS J열) 대응.
 *   BOFU/Content/Search/Events OPS writer가 공용으로 사용. 테스트 `testSetTextFormatColumns()`.
 * v1.0.0
 * - 최초 작성.
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


/**
 * ==========================================================
 * Set Text Format Columns
 * ==========================================================
 *
 * WHY
 * "Sep 26" 같은 문자열을 setValues로 쓰면 Sheets가 날짜로 자동 변환한다
 * (2026-10-13 Events_OPS Month 열에 "Sep 26"/"September 26" 혼재). 쓰기 전에
 * 해당 컬럼을 텍스트 서식으로 고정해 값이 문자열 그대로 남게 한다.
 * sheet.clear()가 서식도 지우므로 반드시 clear() 이후, setValues 이전에 호출.
 *
 * @param {Sheet} sheet
 * @param {string[]} header
 * @param {string[]} columnNames  header에 없는 이름은 무시
 * @param {number} startRow
 * @param {number} numRows
 * @return {number[]} 서식을 적용한 1-based 컬럼 번호
 *
 * TEST
 * testSetTextFormatColumns()
 * ==========================================================
 */
function setTextFormatColumns_(sheet, header, columnNames, startRow, numRows){

  if(!numRows || numRows <= 0){
    return [];
  }

  const applied = [];

  columnNames.forEach(function(name){
    const idx = header.indexOf(name);
    if(idx < 0) return;
    sheet.getRange(startRow, idx + 1, numRows, 1).setNumberFormat("@");
    applied.push(idx + 1);
  });

  return applied;

}


function testSetTextFormatColumns(){

  const calls = [];
  const fakeSheet = {
    getRange: function(r, c, nr, nc){
      return { setNumberFormat: function(fmt){ calls.push([r, c, nr, nc, fmt]); } };
    }
  };

  const header = ["Lead Source Detail", "FY", "Event Date", "Month"];
  const applied = setTextFormatColumns_(fakeSheet, header, ["FY", "Month", "없는컬럼"], 3, 375);
  const none = setTextFormatColumns_(fakeSheet, header, ["Month"], 3, 0);

  const pass =
    JSON.stringify(applied) === "[2,4]" &&
    none.length === 0 &&
    calls.length === 2 &&
    JSON.stringify(calls[0]) === JSON.stringify([3, 2, 375, 1, "@"]) &&
    JSON.stringify(calls[1]) === JSON.stringify([3, 4, 375, 1, "@"]);

  Logger.log("testSetTextFormatColumns: " + (pass ? "PASS" : "FAIL"));
  return pass;

}
