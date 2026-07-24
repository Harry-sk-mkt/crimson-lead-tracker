/**
 * ==========================================================
 * Marketing 2.0
 * NewP1 Report Styles
 *
 * Responsibility
 * NewP1_REP Report Area의 셀 서식(% 표기, 천단위 콤마, 테두리,
 * FY+Month 블록 줄무늬 배경, 헤더 Note)만 담당.
 * Business logic 없음 — 순수 서식 적용.
 *
 * Stage
 * 20 Reporting (Shared Component)
 *
 * Version
 * v1.3.0
 *
 * Change Log
 * v1.3.0 (2026-07-24)
 * - 2026-07-24 세션 중 이 파일이 Apps Script 서버에서 실수로 삭제되어
 *   복구. 원본 파일명이 정확히 무엇이었는지는 확인 불가(로컬 git에
 *   한 번도 없었던 서버 전용 파일) — "41_NewP1ReportStyles.js"는
 *   30_ACQReport.js/32_ACQReportStyles.js 관례를 따른 추정 파일명이며,
 *   실제 원본과 다를 수 있음(파일명 자체는 Apps Script 전역 네임스페이스
 *   특성상 함수 동작에 영향 없음). 로직은 대화 중 공유된 원본 내용 그대로.
 * v1.2.0 (2026-07-22)
 * - 40_NewP1Report.js에서 Week 축 제거됨에 따라 컬럼 배치가
 *   14 → 13개로 줄어듦 (Week 컬럼 삭제). % 컬럼/Revenue 컬럼 인덱스,
 *   헤더 Note 컬럼 번호 전부 한 칸씩 당김. 줄무늬 배경은 자연스럽게
 *   FY+Month 블록 기준으로 복귀 (Week가 없으니 Weekly 구분 자체가 없음).
 * v1.1.0 (2026-07-22)
 * - 줄무늬 배경 기준을 FY+Month(월별) → FY+Month+Week(주별)로 변경.
 * v1.0.0 (2026-07-22)
 * - 최초 구현. 32_ACQReportStyles.js 관례 재사용, 단 FY+Month 블록
 *   크기가 가변(Segment 조합이 실제 데이터 기준이라 고정폭 아님)이라
 *   줄무늬 배경은 blockSize 나눗셈이 아니라 실제 FY/Month 값 변화
 *   지점으로 경계를 판단한다.
 * ==========================================================
 */


/**
 * ==========================================================
 * Apply NewP1 Report Styles
 *
 * INPUT
 * sheet : Sheet  (NewP1_REP 시트 객체)
 * rowCount : Number  (Report Area에 쓰인 데이터 행 수)
 *
 * SIDE EFFECT
 * NewP1_REP 시트의 헤더~데이터 영역(A4:M...) 셀 서식/테두리/배경 변경.
 * ==========================================================
 */
function applyNewP1ReportStyles_(sheet, rowCount){

  const startRow = CONFIG.NEWP1.ROWS.REPORT_DATA_START;
  const headerRow = CONFIG.NEWP1.ROWS.REPORT_HEADER;
  const totalCols = NEWP1_REPORT_HEADERS.length;

  //----------------------------------------------------------
  // 배경색 우선 초기화 (이전 실행의 줄무늬가 남지 않도록)
  //----------------------------------------------------------

  if(rowCount > 0){

    sheet.getRange(startRow, 1, rowCount, totalCols)
      .setBackground(null);

    //----------------------------------------------------------
    // % 컬럼: SAL%(6) / IC Booked%(8) / IC Complete%(10) / Won%(12)
    // Revenue 컬럼: 13 — 천단위 콤마
    //----------------------------------------------------------

    const percentColumns = [6, 8, 10, 12];

    percentColumns.forEach(function(col){

      sheet.getRange(startRow, col, rowCount, 1)
        .setNumberFormat("0.0%");

    });

    sheet.getRange(startRow, 13, rowCount, 1)
      .setNumberFormat("#,##0");

    //----------------------------------------------------------
    // FY+Month 블록 단위 배경색 (블록 크기 가변 — 실제 값 변화로 경계 판단)
    //----------------------------------------------------------

    const fyMonthValues = sheet.getRange(startRow, 1, rowCount, 2).getValues();

    let blockIndex = -1;
    let previousKey = null;

    for(let i = 0; i < rowCount; i++){

      const key = fyMonthValues[i][0] + "|" + fyMonthValues[i][1];

      if(key !== previousKey){
        blockIndex++;
        previousKey = key;
      }

      if(blockIndex % 2 === 1){

        sheet.getRange(startRow + i, 1, 1, totalCols)
          .setBackground("#F3F3F3");

      }

    }

  }

  //----------------------------------------------------------
  // 테두리 — 헤더(4행) + 데이터 영역(5행~) 전체
  //----------------------------------------------------------

  const totalRows = 1 + rowCount;

  sheet.getRange(headerRow, 1, totalRows, totalCols)
    .setBorder(
      true, true, true, true, true, true,
      "#000000",
      SpreadsheetApp.BorderStyle.SOLID
    );

  sheet.getRange(headerRow, 1, 1, totalCols)
    .setFontWeight("bold");

  annotateNewP1ReportMetricNotes_(sheet, headerRow);

}


/**
 * ==========================================================
 * Annotate NewP1 Report Metric Notes (헤더 셀 Note)
 *
 * WHY
 * NewP1_REP은 전부 Create Date 코호트 기준(ACQ_REP은 반대로 IC Booked/
 * IC Complete/Revenue가 이벤트 기준)이라, 두 리포트를 같이 보다 보면
 * 기준을 헷갈리기 쉽다. 헤더 셀에 Note로 기준을 명시한다
 * (32_ACQReportStyles.js의 annotateACQReportMetricNotes_() 패턴 재사용).
 *
 * INPUT
 * sheet : Sheet
 * headerRow : Number
 * ==========================================================
 */
function annotateNewP1ReportMetricNotes_(sheet, headerRow){

  const notes = {
    1: "FY/Month — 전부 Create Date(Lead 생성일) 기준 코호트. ACQ_REP의 IC Booked/IC Complete/Revenue(이벤트 기준)와 반대 개념이니 혼동 주의 (docs/ACQReportDesign.md, docs/NewP1ReportDesign.md 참고).",
    4: "New P1 — Create Date가 이 코호트에 속하고 유효 Priority(Priority Override 우선, 없으면 Lead Priority)가 \"Priority 1\"인 Lead 수.",
    5: "SAL — 코호트 중 Total IC Requests > 0 인 Lead 수 (MTA_Master 무관, Leads_OPS 자체 카운터 컬럼 기준).",
    7: "IC Booked — 코호트 중 IC Booked Date가 채워진 Lead 수 (현재까지 누적, Booked된 달과 무관).",
    9: "IC Complete — 코호트 중 IC Completed Date가 채워진 Lead 수 (현재까지 누적).",
    11: "Won — 코호트 중 Revenue > 0 인 Lead 수 (현재까지 누적). Opportunity Won Date는 사용하지 않음(사용자 확정).",
    13: "Revenue — 코호트의 Revenue 합 (현재까지 누적, Revenue Actual 아닌 SF 동기화 Revenue 컬럼 기준)."
  };

  Object.keys(notes).forEach(function(col){

    sheet.getRange(headerRow, Number(col))
      .setNote(notes[col]);

  });

}
