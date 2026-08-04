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
 * v1.4.0
 *
 * Change Log
 * v1.4.0 (2026-08-04)
 * - **서식 조정(사용자 요청)**: Revenue(M)/Spent(N)/CPNP1(O)를 `"#,##0"` →
 *   `"$#,##0.00"`(통화 표시, 소수점 2자리)로 변경. New P1 Target(P,
 *   targetStartCol+2)에 신규로 `"#,##0"`(정수만) 적용 — 지금까지 이 컬럼만
 *   서식이 아예 없었던 걸 발견해 같이 수정(ACQ_REP의 New P1 Target(U)과 동일
 *   누락). 부수적으로 이 파일 주석에 남아있던 "targetStartCol=O열(15)"라는
 *   설명이 실제 Config 값(N열=14, 2026-07-30에 O→N으로 원복됨)과 어긋나 있던
 *   걸 발견해 정정, Spent 헤더 Note도 실제 소스(Ad_Spend_Cache 자동 집계,
 *   2026-08-04 전환)에 맞게 갱신.
 * v1.3.0 (2026-07-30)
 * - Spent/CPNP1/New P1 Target/New P1 Target% 4컬럼 신규 서식. **처음엔
 *   `NEWP1_REPORT_HEADERS` 배열 자체를 13→17로 늘려 N열부터 이어붙이려
 *   했으나, 실 시트 검증 중 N열이 사용자 수동 영역(00_Config.js
 *   `CONFIG.NEWP1.MANUAL_AREA_NOTE`)인 게 발견돼(사용자 리포트) N열을
 *   건너뛰고 O열(`CONFIG.NEWP1.TARGET_COLUMNS_START_COL`)부터 별도 range로
 *   분리** — `NEWP1_REPORT_HEADERS`는 13개(A:M)로 되돌아가 `totalCols`도
 *   다시 13 기준, Target 4컬럼은 별도 `targetStartCol` 변수로 배경 초기화/
 *   %·숫자 포맷/줄무늬 배경/테두리를 전부 별도 계산(ACQ_REP의 동일 유형
 *   충돌 수정과 같은 패턴, 32_ACQReportStyles.js 참고). Target% 하이라이트는
 *   `highlightAtOrAboveThreshold_()`(32_ACQReportStyles.js, 2026-07-30 신규)
 *   재사용(GAS 전역 스코프, 중복 정의 안 함). 상세:
 *   docs/exec-plans/active/2026-07-30-acq-newp1-target-columns.md
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
  const totalCols = NEWP1_REPORT_HEADERS.length;                    // A:M (13)
  const targetStartCol = CONFIG.NEWP1.TARGET_COLUMNS_START_COL;     // N열(14, 2026-07-30 최종 확정 — 이전엔 O열이었으나 사용자가 N열 수동 내용을 삭제하며 원복)
  const targetCols = NEWP1_TARGET_HEADERS.length;                   // 4

  //----------------------------------------------------------
  // 배경색 우선 초기화 (이전 실행의 줄무늬가 남지 않도록)
  // A:M과 Target 4컬럼은 사이에 사용자 수동 영역(N열)이 껴 있어 range를 분리한다.
  //----------------------------------------------------------

  if(rowCount > 0){

    sheet.getRange(startRow, 1, rowCount, totalCols).setBackground(null);
    sheet.getRange(startRow, targetStartCol, rowCount, targetCols).setBackground(null);

    //----------------------------------------------------------
    // % 컬럼: SAL%(6) / IC Booked%(8) / IC Complete%(10) / Won%(12) /
    //   New P1 Target%(targetStartCol+3, 2026-07-30 추가)
    // Revenue(13)/Spent/CPNP1 컬럼: 천단위 콤마
    //----------------------------------------------------------

    const percentColumns = [6, 8, 10, 12, targetStartCol + 3];

    percentColumns.forEach(function(col){

      sheet.getRange(startRow, col, rowCount, 1)
        .setNumberFormat("0.0%");

    });

    // Revenue(M, 13)/Spent(N, targetStartCol)/CPNP1(O, targetStartCol+1) — $ 표시
    // + 소수점 2자리(2026-08-04 사용자 요청, ACQ_REP의 Revenue Target/Spent와
    // 동일 처리).
    [13, targetStartCol, targetStartCol + 1].forEach(function(col){

      sheet.getRange(startRow, col, rowCount, 1)
        .setNumberFormat("$#,##0.00");

    });

    // New P1 Target(P, targetStartCol+2) — 리드 수 카운트라 소수점 없이 정수만
    // (2026-08-04 — ACQ_REP의 New P1 Target(U)과 동일한 서식 누락 발견, 같이 수정).
    sheet.getRange(startRow, targetStartCol + 2, rowCount, 1)
      .setNumberFormat("#,##0");

    //----------------------------------------------------------
    // Target 달성(100% 이상) 강조 — New P1 Target%(targetStartCol+3). 2026-07-30
    // 추가, highlightAtOrAboveThreshold_()는 32_ACQReportStyles.js 정의 재사용.
    //----------------------------------------------------------

    highlightAtOrAboveThreshold_(sheet, startRow, rowCount, targetStartCol + 3, 1);

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

        sheet.getRange(startRow + i, 1, 1, totalCols).setBackground("#F3F3F3");
        sheet.getRange(startRow + i, targetStartCol, 1, targetCols).setBackground("#F3F3F3");

      }

    }

  }

  //----------------------------------------------------------
  // 테두리 — 헤더(4행) + 데이터 영역(5행~), A:M + Target 4컬럼(N열 수동 영역 제외)
  //----------------------------------------------------------

  const totalRows = 1 + rowCount;

  sheet.getRange(headerRow, 1, totalRows, totalCols)
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

  // Target 4컬럼(2026-07-30 추가) — N열(사용자 수동 영역) 충돌로 위치가 한 번
  // 바뀌었다가(N→O) 사용자가 N열 수동 내용을 삭제하며 다시 N열로 원복된 전례가
  // 있어, 하드코딩 키 대신 CONFIG.NEWP1.TARGET_COLUMNS_START_COL 기준 상대
  // 위치로 부착(32_ACQReportStyles.js의 동일 수정과 같은 패턴).
  const t = CONFIG.NEWP1.TARGET_COLUMNS_START_COL;

  const targetNotes = {};
  targetNotes[t] = "Spent — Ad_Spend_Cache(Meta+Naver Search+Kakao Channel 자동 집계, AD_004_SpendCache.js) 기준(2026-08-04부터 — 이전엔 Target_Engine Block 0 수동 입력이었음). 두 소스 어디에도 없는 (FY|Month|Segment) 조합은 공란.";
  targetNotes[t + 1] = "CPNP1(실적) — Spent ÷ New P1(4).";
  targetNotes[t + 2] = "New P1 Target — Target_Engine Block D(New P1 Target). Target_Engine이 마지막으로 Generate한 FY 1개만 값이 채워짐 — 그 외 FY/Referral/Other는 공란. ACQ_REP의 New P1 Target과 같은 값(같은 Business Segment 컬럼 소스, docs/ACQReportDesign.md \"오해 방지\" 섹션 참고). Pipeline P1 Target은 포함 안 함(사용자 판단 — 클로징 여부 불확실 영역).";
  targetNotes[t + 3] = "New P1 Target% — New P1(4) ÷ New P1 Target. 100% 이상이면 초록 하이라이트.";

  Object.keys(targetNotes).forEach(function(col){

    sheet.getRange(headerRow, Number(col))
      .setNote(targetNotes[col]);

  });

}
