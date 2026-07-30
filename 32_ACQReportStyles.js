/**
 * ==========================================================
 * Marketing 2.0
 * ACQ Report Styles
 *
 * Responsibility
 * ACQ_REP Report Area의 셀 서식(% 표기, 천단위 콤마, 테두리,
 * 줄무늬 배경, 볼드, 중앙값 이상 강조 등)만 담당.
 * Business logic 없음 — 순수 서식 적용.
 *
 * Stage
 * 20 Reporting (Shared Component)
 *
 * Version
 * v1.7.0
 *
 * Change Log
 * v1.7.0 (2026-07-30)
 * - "Meta Spent" 컬럼(W열, `CONFIG.ACQ.META_SPENT_COLUMN`) 서식 추가 — 천단위
 *   콤마, 배경/테두리 range를 A:N + Target 4컬럼(S:V)에 이어 세 번째로 분리
 *   적용(그 사이 O:R Engine/U:AF 수동 영역은 계속 건너뜀). 헤더 Note로 "8개
 *   플랫폼 중 Meta만 자동화, 총 광고비 아님" 명시. 상세:
 *   docs/exec-plans/active/2026-07-30-campaign-spend-integration.md
 * v1.6.0 (2026-07-30)
 * - Revenue Target/Revenue Target%/New P1 Target/New P1 Target% 4컬럼 신규 서식 —
 *   **S:V열(`CONFIG.ACQ.TARGET_COLUMNS_START_COL`부터)**에 배치. O:R(숨김 Engine
 *   영역)/U:AF(사용자 수동 수식 영역, 00_Config.js `MANUAL_AREA_NOTE`)를 둘 다
 *   피해야 해서 위치가 두 번 바뀜(00_Config.js v1.20.0/30_ACQReport.js v1.10.0
 *   Change Log 참고) — 그래서 이 파일은 컬럼 번호를 하드코딩하지 않고 전부
 *   `CONFIG.ACQ.TARGET_COLUMNS_START_COL` 기준 상대 위치로 계산(헤더 Note 포함).
 *   기존에 A:N 1개 range로 처리하던 배경 초기화/월블록 배경/테두리를
 *   A:N(REPORT_DATA_COLUMNS) + Target 4컬럼(TARGET_COLUMNS_START_COL~) 2개
 *   range로 분리 적용. Target% 컬럼 100% 이상 하이라이트는
 *   `highlightAtOrAboveThreshold_()` 신규(기존 `highlightAboveMedian_()`은
 *   중앙값 기준이라 재사용 불가). 상세:
 *   docs/exec-plans/active/2026-07-30-acq-newp1-target-columns.md
 * v1.5.0 (2026-07-25)
 * - SAL 헤더 Note 갱신 — 데이터 소스가 MTA_Master(Lead Record Type)에서
 *   Leads_OPS(Sales Accepted Date)로 전환됨 반영.
 * v1.4.0 (2026-07-22)
 * - Added: annotateACQReportMetricNotes_() — SAL/IC Booked/IC Complete/
 *   Revenue 헤더 셀에 날짜 기준(Note)을 남겨서, 코호트 vs 이벤트 기준
 *   혼동(오늘 겪었던 "IC Booked 리포트값과 실제 필터값이 다르다" 같은
 *   질문)을 리포트 자체에서 바로 확인 가능하게 함. applyACQReportStyles_()
 *   호출 시마다 같이 실행되어 항상 최신 상태 유지.
 * v1.3.0 (2026-07-21)
 * - Added: A, B, C, F, H, J, N 컬럼(헤더+데이터) 볼드 처리.
 * - Added: F, H, J(% 컬럼) 중앙값(median) 이상인 셀 배경색 강조.
 * ==========================================================
 */


/**
 * ==========================================================
 * Apply ACQ Report Styles
 *
 * WHY
 * Report Area(A4:N...)에 % 컬럼, Revenue 컬럼 표시 형식,
 * 테두리, 짝수 행 배경색, 볼드, 중앙값 강조를 지정한다.
 * generateACQReport_()가 값을 다 쓴 직후 호출됨.
 *
 * INPUT
 * sheet : Sheet  (ACQ_REP 시트 객체)
 * rowCount : Number  (Report Area에 쓰인 데이터 행 수)
 *
 * SIDE EFFECT
 * ACQ_REP 시트의 헤더~데이터 영역(A4:N) 셀 서식/테두리/배경 변경.
 * ==========================================================
 */
function applyACQReportStyles_(sheet, rowCount){

  const startRow = CONFIG.ACQ.ROWS.REPORT_DATA_START;
  const headerRow = CONFIG.ACQ.ROWS.REPORT_HEADER;
  const dataCols = CONFIG.ACQ.REPORT_DATA_COLUMNS;             // A:N (14)
  const targetStartCol = CONFIG.ACQ.TARGET_COLUMNS_START_COL;  // S열(19) — O:R(Engine)/U:AF(수동 영역) 둘 다 건너뜀
  const targetCols = CONFIG.ACQ.TARGET_COLUMNS_COUNT;          // 4
  const metaSpentCol = CONFIG.ACQ.META_SPENT_COLUMN;           // W열(23, 2026-07-30 추가)

  //----------------------------------------------------------
  // 배경색 우선 초기화 (이전 실행의 줄무늬/강조가 남지 않도록)
  // A:N / Target 4컬럼(S:V) / Meta Spent(W) 사이에 숨김 Engine 영역(O:R)과
  // 사용자 수동 영역(U:AF)이 껴 있어 range를 분리한다.
  //----------------------------------------------------------

  if(rowCount > 0){

    sheet.getRange(startRow, 1, rowCount, dataCols).setBackground(null);
    sheet.getRange(startRow, targetStartCol, rowCount, targetCols).setBackground(null);
    sheet.getRange(startRow, metaSpentCol, rowCount, 1).setBackground(null);

  }

  //----------------------------------------------------------
  // % 컬럼: All P1%(6) / New Leads%(8) / New P1%(10) /
  //   Revenue Target%(20) / New P1 Target%(22, 2026-07-30 추가)
  // Revenue 컬럼: 14 — 천단위 콤마 / Revenue Target(targetStartCol)/
  //   Meta Spent(metaSpentCol)도 동일 (2026-07-30 추가)
  //----------------------------------------------------------

  if(rowCount > 0){

    const percentColumns = [6, 8, 10, targetStartCol + 1, targetStartCol + 3];

    percentColumns.forEach(function(col){

      sheet.getRange(startRow, col, rowCount, 1)
        .setNumberFormat("0.0%");

    });

    [14, targetStartCol, metaSpentCol].forEach(function(col){

      sheet.getRange(startRow, col, rowCount, 1)
        .setNumberFormat("#,##0");

    });

    //----------------------------------------------------------
    // 월 블록 단위 배경색 (같은 달의 세그먼트끼리는 같은 색,
    // 월이 바뀌면 색이 번갈아가며 바뀜 — 월 구분을 시각적으로 명확히)
    //----------------------------------------------------------

    const segmentsPerMonth = CONFIG.ACQ.SEGMENTS.length;

    for(let i = 0; i < rowCount; i++){

      const monthBlockIndex = Math.floor(i / segmentsPerMonth);
      const isEvenBlock = (monthBlockIndex % 2 === 1);

      if(isEvenBlock){

        sheet.getRange(startRow + i, 1, 1, dataCols).setBackground("#F3F3F3");
        sheet.getRange(startRow + i, targetStartCol, 1, targetCols).setBackground("#F3F3F3");
        sheet.getRange(startRow + i, metaSpentCol, 1, 1).setBackground("#F3F3F3");

      }

    }

    //----------------------------------------------------------
    // 중앙값 이상 강조 — F, H, J
    //----------------------------------------------------------

    highlightAboveMedian_(sheet, startRow, rowCount, 6);   // All P1 %
    highlightAboveMedian_(sheet, startRow, rowCount, 8);   // New Leads %
    highlightAboveMedian_(sheet, startRow, rowCount, 10);  // New P1 %

    //----------------------------------------------------------
    // Target 달성(100% 이상) 강조 — Revenue Target%(20) / New P1 Target%(22)
    // 2026-07-30 추가 (중앙값 기준이 아니라 100% 고정 기준이라 별도 함수)
    //----------------------------------------------------------

    highlightAtOrAboveThreshold_(sheet, startRow, rowCount, targetStartCol + 1, 1);
    highlightAtOrAboveThreshold_(sheet, startRow, rowCount, targetStartCol + 3, 1);

  }

  //----------------------------------------------------------
  // 볼드 처리 — A, B, C, F, H, J, N (헤더 + 데이터 전체)
  //----------------------------------------------------------

  const boldColumns = [1, 2, 3, 6, 8, 10, 14];
  const totalRows = 1 + rowCount;   // 헤더 1행 + 데이터

  boldColumns.forEach(function(col){

    sheet.getRange(headerRow, col, totalRows, 1)
      .setFontWeight("bold");

  });

  //----------------------------------------------------------
  // 테두리 — 헤더(4행) + 데이터 영역(5행~), A:N + Target 4컬럼 + Meta Spent
  // (O:R Engine/U:AF 수동 영역은 제외)
  //----------------------------------------------------------

  sheet.getRange(headerRow, 1, totalRows, dataCols)
    .setBorder(
      true, true, true, true, true, true,
      "#000000",
      SpreadsheetApp.BorderStyle.SOLID
    );

  sheet.getRange(headerRow, targetStartCol, totalRows, targetCols)
    .setBorder(
      true, true, true, true, true, true,
      "#000000",
      SpreadsheetApp.BorderStyle.SOLID
    );

  sheet.getRange(headerRow, metaSpentCol, totalRows, 1)
    .setBorder(
      true, true, true, true, true, true,
      "#000000",
      SpreadsheetApp.BorderStyle.SOLID
    );

  annotateACQReportMetricNotes_(sheet, headerRow);

}


/**
 * ==========================================================
 * Annotate ACQ Report Metric Notes (헤더 셀 Note)
 *
 * WHY
 * SAL/IC Booked/IC Complete/Revenue는 서로 날짜 기준이 다르다
 * (2026-07-22부터 IC Booked/IC Complete/Revenue는 Event 기준으로
 * 전환, SAL은 원래부터 MTA Created Date 기준). 리포트만 보고는
 * 구분이 안 돼서 헷갈리기 쉬우므로, 헤더 셀에 Note로 기준을 남긴다.
 * 컬럼 텍스트 자체는 시트에 수동으로 입력된 값이라 코드가 건드리지
 * 않고, Note만 컬럼 위치(K/L/M/N) 기준으로 부착한다.
 *
 * INPUT
 * sheet : Sheet  (ACQ_REP 시트 객체)
 * headerRow : Number
 * ==========================================================
 */
function annotateACQReportMetricNotes_(sheet, headerRow){

  const notes = {
    11: "SAL — Sales Accepted Date 기준(그 달에 실제로 SAL 전환된 건, Leads_OPS 기준, 리드당 1건). Create Date(Lead 생성월)와 무관 (2026-07-25, Lead Record Type 스냅샷 과집계 문제로 이벤트 날짜 기준 전환).",
    12: "IC Booked — IC Booked Date 기준(그 달에 실제로 Booking된 건). Create Date(Lead 생성월)와 무관 (2026-07-22, 코호트 → 이벤트 기준 전환).",
    13: "IC Complete — IC Completed Date 기준(그 달에 실제로 Complete된 건). Booked된 달과 다를 수 있음 (예: 이전 달 Booked, 이번 달 Complete — 정상적인 백로그).",
    14: "Revenue — Opportunity Won Date 기준(그 달에 Won된 건의 Revenue 합). Create Date(Lead 생성월)와 무관 (2026-07-22, 코호트 → 이벤트 기준 전환)."
  };

  Object.keys(notes).forEach(function(col){

    sheet.getRange(headerRow, Number(col))
      .setNote(notes[col]);

  });

  // Target 4컬럼(2026-07-30 추가) — 컬럼 위치가 두 번 바뀐 전례(위 Change Log 참고)가
  // 있어, 하드코딩 키 대신 CONFIG.ACQ.TARGET_COLUMNS_START_COL 기준 상대 위치로 부착.
  const t = CONFIG.ACQ.TARGET_COLUMNS_START_COL;

  const targetNotes = {};
  targetNotes[t] = "Revenue Target — 월별 회사 전체 Revenue Target × 세그먼트 Deal Share(Target_Engine). Target_Engine이 마지막으로 Generate한 FY 1개만 값이 채워짐 — 그 외 FY/Referral/Other는 공란. O:R(숨김 Engine)/U:AF(사용자 수동 영역)를 피해 이 위치에 배치.";
  targetNotes[t + 1] = "Revenue Target% — Revenue(14) ÷ Revenue Target. 100% 이상이면 초록 하이라이트.";
  targetNotes[t + 2] = "New P1 Target — Target_Engine Block D(New P1 Target). Target_Engine이 마지막으로 Generate한 FY 1개만 값이 채워짐 — 그 외 FY/Referral/Other는 공란. NewP1_REP의 New P1 Target과 같은 값(같은 Business Segment 컬럼 소스, docs/ACQReportDesign.md \"오해 방지\" 섹션 참고).";
  targetNotes[t + 3] = "New P1 Target% — New P1(9) ÷ New P1 Target. 100% 이상이면 초록 하이라이트.";

  Object.keys(targetNotes).forEach(function(col){

    sheet.getRange(headerRow, Number(col))
      .setNote(targetNotes[col]);

  });

  // Meta Spent(2026-07-30 추가) — 하드코딩 없이 CONFIG.ACQ.META_SPENT_COLUMN 기준.
  sheet.getRange(headerRow, CONFIG.ACQ.META_SPENT_COLUMN)
    .setNote("Meta Spent — Meta Ads Manager 캠페인 지출 자동 집계(AD_002_Meta.js). 8개 플랫폼 중 Meta만 자동화된 상태라 총 광고비가 아님(나머지 7개 플랫폼은 아직 미포함). Meta_Raw에 없는 (FY|Month|Segment) 조합은 공란.");

}


/**
 * ==========================================================
 * Highlight Cells Above Median (특정 컬럼의 중앙값 이상인 셀 강조)
 *
 * WHY
 * F/H/J(% 지표) 컬럼에서 상대적으로 높은 값을 시각적으로
 * 바로 알아볼 수 있게 한다.
 *
 * INPUT
 * sheet : Sheet
 * startRow : Number  (데이터 시작 행)
 * rowCount : Number  (데이터 행 수)
 * col : Number  (대상 컬럼, 1-based)
 *
 * SIDE EFFECT
 * 해당 컬럼에서 중앙값 이상인 셀의 배경색을 강조색으로 변경
 * (짝수 행 줄무늬보다 나중에 적용되므로 이 강조색이 우선됨).
 * ==========================================================
 */
function highlightAboveMedian_(sheet, startRow, rowCount, col){

  if(rowCount === 0) return;

  const values = sheet
    .getRange(startRow, col, rowCount, 1)
    .getValues()
    .map(function(row){ return Number(row[0]) || 0; });

  const median = computeMedian_(values);

  for(let i = 0; i < rowCount; i++){

    if(values[i] >= median){

      sheet.getRange(startRow + i, col)
        .setBackground("#C6E0B4");   // 옅은 초록 — 강조색

    }

  }

}


/**
 * ==========================================================
 * Highlight Cells At Or Above Threshold (고정 기준값 이상 강조)
 *
 * WHY (2026-07-30)
 * Target 달성률(Revenue Target%/New P1 Target%)은 중앙값이 아니라 100%라는
 * 고정 기준으로 강조해야 해서 `highlightAboveMedian_()`을 재사용할 수 없음 —
 * 같은 강조색(#C6E0B4, ACQ_REP 기존 관례)을 그대로 쓰는 별도 함수.
 *
 * INPUT
 * sheet : Sheet
 * startRow : Number  (데이터 시작 행)
 * rowCount : Number  (데이터 행 수)
 * col : Number  (대상 컬럼, 1-based)
 * threshold : Number  (이 값 이상이면 강조, 예: 1 = 100%)
 *
 * TEST
 * testHighlightAtOrAboveThreshold_()는 시트 I/O라 단위 테스트 대상 아님
 * (읽기 전용 헬퍼 `computeMedian_()`과 달리 이 함수는 getValues/setBackground를
 * 직접 호출 — 90_TargetEngine.js의 readXXX_()류와 동일 관례).
 * ==========================================================
 */
function highlightAtOrAboveThreshold_(sheet, startRow, rowCount, col, threshold){

  if(rowCount === 0) return;

  const values = sheet
    .getRange(startRow, col, rowCount, 1)
    .getValues();

  for(let i = 0; i < rowCount; i++){

    const raw = values[i][0];

    if(raw !== "" && Number(raw) >= threshold){

      sheet.getRange(startRow + i, col)
        .setBackground("#C6E0B4");   // 옅은 초록 — 강조색 (highlightAboveMedian_()과 동일)

    }

  }

}


/**
 * ==========================================================
 * Compute Median
 *
 * WHY
 * highlightAboveMedian_()이 기준값을 계산하는 데 사용.
 *
 * INPUT
 * values : Number[]
 *
 * OUTPUT
 * Number
 *
 * TEST
 * computeMedian_([1,2,3]) === 2
 * computeMedian_([1,2,3,4]) === 2.5
 *
 * EXPECTED
 * 홀수 개는 가운데 값, 짝수 개는 가운데 두 값의 평균
 * ==========================================================
 */
function computeMedian_(values){

  if(values.length === 0) return 0;

  const sorted = values.slice().sort(function(a, b){ return a - b; });

  const mid = Math.floor(sorted.length / 2);

  if(sorted.length % 2 === 0){
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];

}


/**
 * ==========================================================
 * TEST — computeMedian_()
 * ==========================================================
 */
function testComputeMedian(){

  const case1 = computeMedian_([1, 2, 3]);
  const case2 = computeMedian_([1, 2, 3, 4]);
  const case3 = computeMedian_([]);

  const pass =
    case1 === 2 &&
    case2 === 2.5 &&
    case3 === 0;

  Logger.log("case1 (홀수) : " + case1 + " (expected 2)");
  Logger.log("case2 (짝수) : " + case2 + " (expected 2.5)");
  Logger.log("case3 (빈배열) : " + case3 + " (expected 0)");
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}