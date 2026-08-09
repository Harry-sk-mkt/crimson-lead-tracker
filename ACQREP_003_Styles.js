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
 * v1.13.1
 *
 * Change Log
 * v1.13.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `32_ACQReportStyles.js` → 신규 `ACQREP_003_Styles.js`, 코드 내용 변경 없음.
 * v1.13.0 (2026-08-09)
 * - `highlightAtOrAboveThreshold_()` 삭제 — 마지막 호출부였던
 *   `41_NewP1ReportStyles.js`의 New P1 Target% 강조가
 *   `applyNewP1TargetOnTrackHighlight_()`(41_NewP1ReportStyles.js v1.5.0,
 *   밝은 초록+볼드로 Segment/New P1까지 확장)로 교체되면서 완전히 미사용
 *   상태가 됨(grep으로 확인 후 삭제).
 * v1.12.0 (2026-08-09)
 * - **CPNP1(X열, 사용자 수동 컬럼) On Track 강조 추가** — `buildACQReportBackgrounds_()`가
 *   신규 `cpnp1Backgrounds`/`cpnp1Bold` 반환(다른 컬럼과 동일하게 월블록
 *   줄무늬 + On Track 강조 + 강조 시 볼드), `applyACQReportStyles_()`가
 *   `CONFIG.ACQ.CPNP1_COLUMN`(X, 24)에 적용. X열의 값/수식 자체는 전혀
 *   안 건드림 — 판정 로직은 30_ACQReport.js v1.17.0 참고.
 * v1.11.0 (2026-08-09)
 * - **H(New Leads%) 중앙값 강조 제거**(사용자 요청 — "불필요한거같아").
 *   `highlightAboveMedian_()` 호출 제거 + 함수 자체 삭제(다른 사용처 grep
 *   확인, computeMedian_()은 94_TempQA_CohortMedianV.js가 아직 써서 유지).
 * - **Revenue On Track이면 C(Segment)열도 같이 강조**(사용자 요청 — "세그먼트에도
 *   revenue가 ontrack이면 동일하게 색깔칠하자") — `buildACQReportBackgrounds_()`가
 *   onTrack[0](S On Track) true일 때 dataBackgrounds의 C열(index 2)도
 *   ON_TRACK_COLOR로 채우도록 확장.
 * - **On Track 강조 셀에 볼드 추가**(사용자 요청 — "색깔칠해지면 bold도
 *   넣어줘"): `buildACQReportBackgrounds_()`가 신규 `targetBold` 배열도
 *   반환, `applyACQReportStyles_()`가 Target 4컬럼에 `setFontWeights()`로
 *   적용(S/T/V 중 실제로 칠해진 셀만 bold). F/J 세그먼트 상위 25% 조건부
 *   서식(`applyACQSegmentPercentileHighlightRules_()`)에도 `.setBold(true)`
 *   추가(F/H/J/N은 이미 상시 볼드 컬럼이라 사실상 방어적 추가).
 * v1.10.0 (2026-08-06)
 * - **성능 개선 + F/J/S/T/V 하이라이트 재설계**(사용자 요청):
 *   (1) 배경색 적용을 "이전 실행 초기화 2번 + 행별 개별 setBackground()
 *       반복"에서 "JS 배열로 미리 계산 후 setBackgrounds() 3번"으로 전환
 *       (신규 buildACQReportBackgrounds_()) — 91행 기준 십수 초 걸리던
 *       걸 수 초 이내로 단축 예상.
 *   (2) F(All P1%)/J(New P1%): 중앙값 강조(highlightAboveMedian_) →
 *       세그먼트별 상위 25%(0 제외) 조건부 서식(신규
 *       applyACQSegmentPercentileHighlightRules_()/
 *       buildSegmentPercentileHighlightFormula_())로 교체. H(New Leads%)는
 *       기존 중앙값 강조 그대로 유지.
 *   (3) S(Revenue Target)/T(Revenue Target%)/V(New P1 Target%): 고정 100%
 *       기준(highlightAtOrAboveThreshold_) → "On Track"(Target÷그 달의
 *       주 수 페이스 대비 실적, 90_TargetEngine.js
 *       computeWeeksInMonthCountsForFYRange_()) 기준으로 교체 —
 *       generateACQReport_()가 onTrackRows로 계산해서
 *       applyACQReportStyles_()에 새 3번째 인자로 전달.
 *   (4) Revenue(N) 서식을 `"#,##0"` → `"$#,##0.00"`로 변경(사용자 요청).
 *   색상은 전부 #01ef18(Events_OPS TOP25_HIGLIGHT와 동일 색). 헤더 Note
 *   (S/T/V)도 새 기준으로 갱신. testBuildACQReportBackgrounds()/
 *   testBuildSegmentPercentileHighlightFormula() 신규.
 * v1.9.0 (2026-08-04)
 * - **서식 조정(사용자 요청)**: Revenue Target(S)/Spent(W)를 `"#,##0"` →
 *   `"$#,##0.00"`(통화 표시, 소수점 2자리)로 변경. New P1 Target(U,
 *   targetStartCol+2)에 신규로 `"#,##0"`(정수만) 적용 — 지금까지 이 컬럼만
 *   서식이 아예 없었던 걸 발견해 같이 수정. Revenue(N열, 14)는 요청 대상이
 *   아니라 기존 `"#,##0"` 그대로 유지. Target 달성(100% 이상) 하이라이트
 *   (`highlightAtOrAboveThreshold_()`, Revenue Target%/New P1 Target%)는
 *   이미 v1.6.0부터 반영돼 있었음을 확인(사용자 문의).
 * v1.8.0 (2026-07-31)
 * - "Meta Spent" → "Spent" 개명 반영 — 변수명 `metaSpentCol`→`spentCol`,
 *   `CONFIG.ACQ.META_SPENT_COLUMN`→`SPENT_COLUMN`, 헤더 Note를 Meta+Naver
 *   Search 합산 설명으로 갱신(00_Config.js v1.23.0/30_ACQReport.js v1.13.0
 *   참고). 서식 로직 자체(천단위 콤마, 배경/테두리 range 분리)는 변경 없음.
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
 * onTrackRows : Array<[boolean,boolean,boolean,boolean]>  (선택, 2026-08-06
 *   추가, 2026-08-09 4번째 원소 추가)
 *   행별 [S On Track, T On Track, V On Track, X On Track] — generateACQReport_()가
 *   계산해서 넘김. 없으면(구버전 호출 등) On Track 강조를 건너뜀. 4번째(X,
 *   CPNP1)는 사용자가 수동으로 만든 컬럼이라 값은 안 건드리고 색칠/볼드만
 *   적용.
 *
 * SIDE EFFECT
 * ACQ_REP 시트의 헤더~데이터 영역(A4:N) 셀 서식/테두리/배경 변경.
 * ==========================================================
 */
function applyACQReportStyles_(sheet, rowCount, onTrackRows){

  const startRow = CONFIG.ACQ.ROWS.REPORT_DATA_START;
  const headerRow = CONFIG.ACQ.ROWS.REPORT_HEADER;
  const dataCols = CONFIG.ACQ.REPORT_DATA_COLUMNS;             // A:N (14)
  const targetStartCol = CONFIG.ACQ.TARGET_COLUMNS_START_COL;  // S열(19) — O:R(Engine)/U:AF(수동 영역) 둘 다 건너뜀
  const targetCols = CONFIG.ACQ.TARGET_COLUMNS_COUNT;          // 4
  const spentCol = CONFIG.ACQ.SPENT_COLUMN;                    // W열(23, 2026-07-30 추가, 2026-07-31 Meta+Naver Search 합산으로 확장)
  const cpnp1Col = CONFIG.ACQ.CPNP1_COLUMN;                    // X열(24, 2026-08-09 추가 — 사용자 수동 컬럼, 색칠/볼드만)

  //----------------------------------------------------------
  // % 컬럼: All P1%(6) / New Leads%(8) / New P1%(10) /
  //   Revenue Target%(20) / New P1 Target%(22, 2026-07-30 추가)
  // Revenue 컬럼: 14 — $ 표시 + 소수점 2자리(2026-08-06 사용자 요청,
  //   기존 "#,##0"에서 변경) / Revenue Target(targetStartCol)/
  //   Spent(spentCol)도 동일 (2026-07-30 추가)
  //----------------------------------------------------------

  if(rowCount > 0){

    const percentColumns = [6, 8, 10, targetStartCol + 1, targetStartCol + 3];

    percentColumns.forEach(function(col){

      sheet.getRange(startRow, col, rowCount, 1)
        .setNumberFormat("0.0%");

    });

    // Revenue(N)/Revenue Target(S)/Spent(W) — $ 표시 + 소수점 2자리.
    [14, targetStartCol, spentCol].forEach(function(col){

      sheet.getRange(startRow, col, rowCount, 1)
        .setNumberFormat("$#,##0.00");

    });

    // New P1 Target(U, targetStartCol+2) — 리드 수 카운트라 소수점 없이 정수만
    // (2026-08-04 사용자 요청 — 지금까지 이 컬럼만 서식이 아예 없었음).
    sheet.getRange(startRow, targetStartCol + 2, rowCount, 1)
      .setNumberFormat("#,##0");

    //----------------------------------------------------------
    // 배경색 — 월 블록 줄무늬(전체) + On Track 강조(S/T/V, 2026-08-06)를
    // 한 번에 배열로 계산해서 setBackgrounds() 3번(A:N/Target 4컬럼/Spent)
    // 으로 일괄 적용 — 예전엔 이전 실행 배경 초기화 2번 + 행별 개별
    // setBackground() 반복이라 91행 기준 십수 초가 걸렸음(사용자 실측
    // 지적). buildACQReportBackgrounds_() 참고.
    //----------------------------------------------------------

    const backgrounds = buildACQReportBackgrounds_(rowCount, dataCols, targetCols, onTrackRows);

    sheet.getRange(startRow, 1, rowCount, dataCols)
      .setBackgrounds(backgrounds.dataBackgrounds);

    sheet.getRange(startRow, targetStartCol, rowCount, targetCols)
      .setBackgrounds(backgrounds.targetBackgrounds);

    sheet.getRange(startRow, spentCol, rowCount, 1)
      .setBackgrounds(backgrounds.spentBackgrounds);

    // X열(CPNP1, 사용자 수동 컬럼) — 값/수식은 안 건드리고 배경(월블록 줄무늬 +
    // On Track 강조)만 다른 컬럼과 동일 패턴으로 적용(2026-08-09 사용자 요청).
    sheet.getRange(startRow, cpnp1Col, rowCount, 1)
      .setBackgrounds(backgrounds.cpnp1Backgrounds);

    //----------------------------------------------------------
    // Target/CPNP1 강조 셀 볼드(2026-08-09 사용자 요청 — "색깔칠해지면 bold도
    // 넣어줘") — S/T/V/X는 A:N의 F/H/J와 달리 컬럼 전체 상시 볼드 대상이
    // 아니라서(아래 boldColumns 참고), On Track으로 배경색이 실제로 칠해진
    // 셀만 별도로 볼드 처리.
    //----------------------------------------------------------

    sheet.getRange(startRow, targetStartCol, rowCount, targetCols)
      .setFontWeights(backgrounds.targetBold);

    sheet.getRange(startRow, cpnp1Col, rowCount, 1)
      .setFontWeights(backgrounds.cpnp1Bold);

  }

  //----------------------------------------------------------
  // 세그먼트별 상위 25% 강조 — F(All P1%)/J(New P1%), 조건부 서식
  // (rowCount === 0이어도 항상 호출 — 이전 실행 규칙을 지우기 위해)
  //----------------------------------------------------------

  applyACQSegmentPercentileHighlightRules_(sheet, startRow, rowCount);

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
  // 테두리 — 헤더(4행) + 데이터 영역(5행~), A:N + Target 4컬럼 + Spent
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

  sheet.getRange(headerRow, spentCol, totalRows, 1)
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
  targetNotes[t] = "Revenue Target — 월별 회사 전체 Revenue Target × 세그먼트 Deal Share(Target_Engine). Target_Engine이 마지막으로 Generate한 FY 1개만 값이 채워짐 — 그 외 FY/Referral/Other는 공란. O:R(숨김 Engine)/U:AF(사용자 수동 영역)를 피해 이 위치에 배치. On Track(Revenue(N) > Revenue Target ÷ 그 달의 주 수)이면 초록 하이라이트(2026-08-06).";
  targetNotes[t + 1] = "Revenue Target% — Revenue(14) ÷ Revenue Target. On Track(Revenue(N) > Revenue Target ÷ 그 달의 주 수)이면 초록 하이라이트(2026-08-06 — 기존 100% 고정 기준에서 주간 페이스 기준으로 변경).";
  targetNotes[t + 2] = "New P1 Target — Target_Engine Block D(New P1 Target). Target_Engine이 마지막으로 Generate한 FY 1개만 값이 채워짐 — 그 외 FY/Referral/Other는 공란. NewP1_REP의 New P1 Target과 같은 값(같은 Business Segment 컬럼 소스, docs/ACQReportDesign.md \"오해 방지\" 섹션 참고).";
  targetNotes[t + 3] = "New P1 Target% — New P1(9) ÷ New P1 Target. On Track(New P1(9) > New P1 Target ÷ 그 달의 주 수)이면 초록 하이라이트(2026-08-06 — 기존 100% 고정 기준에서 주간 페이스 기준으로 변경).";

  Object.keys(targetNotes).forEach(function(col){

    sheet.getRange(headerRow, Number(col))
      .setNote(targetNotes[col]);

  });

  // Spent(2026-07-30 추가, 2026-07-31 Meta+Naver Search 합산으로 확장) — 하드코딩
  // 없이 CONFIG.ACQ.SPENT_COLUMN 기준.
  sheet.getRange(headerRow, CONFIG.ACQ.SPENT_COLUMN)
    .setNote("Spent — Meta Ads Manager + Naver 검색광고 API 캠페인 지출 자동 집계·합산(AD_004_SpendCache.js, KRW→NZD 환율 변환 포함). 8개 플랫폼 중 2개(Meta+Naver Search)만 자동화된 상태라 총 광고비가 아님(나머지 6개 플랫폼은 아직 미포함). 두 소스 어디에도 없는 (FY|Month|Segment) 조합은 공란.");

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


/**
 * ==========================================================
 * Build ACQ Report Backgrounds (순수 함수 — 배경색 2D 배열 계산)
 *
 * WHY (2026-08-06, 성능 개선 + On Track 강조 추가)
 * 예전엔 이전 실행 배경을 setBackground(null)로 초기화한 뒤, 월 블록
 * 줄무늬를 행마다 개별 setBackground() 호출로 입혔음 — 91행 기준 최대
 * 273번의 개별 API 호출이 쌓여 십수 초가 걸림(사용자 실측 지적). 이제
 * 줄무늬 + On Track 강조(S/T/V) 둘 다 JS 배열로 미리 계산해서
 * applyACQReportStyles_()가 setBackgrounds() 3번(A:N/Target 4컬럼/Spent)
 * 으로 한 번에 쓴다 — 이전 실행 배경 초기화도 별도 필요 없음(매번 전체
 * rowCount만큼 새로 계산해서 덮어쓰므로).
 *
 * INPUT
 * rowCount : Number
 * dataCols : Number  (A:N 컬럼 수, 14)
 * targetCols : Number  (Target 4컬럼 수)
 * onTrackRows : Array<[boolean,boolean,boolean,boolean]> | undefined
 *   행별 [S On Track, T On Track, V On Track, X On Track] — target 배열의
 *   0/1/3번째 컬럼(S/T/V)에 매핑, 2번째(U, New P1 Target 원본값)는 항상
 *   줄무늬만. S/T On Track(=Revenue On Track)이면 C(Segment)열도 동일
 *   색(2026-08-09 사용자 요청 — 스캔하기 쉽게 세그먼트 셀도 같이 강조).
 *   4번째(X, CPNP1 On Track, 2026-08-09 추가)는 사용자가 수동으로 만든
 *   컬럼(CONFIG.ACQ.CPNP1_COLUMN)이라 값은 안 건드리고 배경/볼드만 관리 —
 *   다른 컬럼들과 동일하게 월블록 줄무늬 + On Track 강조 패턴 적용.
 *
 * OUTPUT
 * { dataBackgrounds, targetBackgrounds, spentBackgrounds, targetBold,
 *   cpnp1Backgrounds, cpnp1Bold }
 *   각 setBackgrounds()/setFontWeights()용 배열. targetBold/cpnp1Bold는
 *   "bold"/"normal" — On Track으로 배경이 실제로 칠해진 셀만 볼드
 *   (2026-08-09 사용자 요청 — "색깔칠해지면 bold도 넣어줘". A:N의 F/H/J/N은
 *   이미 상시 볼드 컬럼이라 별도 처리 불필요, dataBold는 없음).
 *
 * TEST
 * testBuildACQReportBackgrounds 참고
 * ==========================================================
 */
function buildACQReportBackgrounds_(rowCount, dataCols, targetCols, onTrackRows){

  const segmentsPerMonth = CONFIG.ACQ.SEGMENTS.length;
  const ON_TRACK_COLOR = "#01ef18";
  const STRIPE_COLOR = "#F3F3F3";
  const SEGMENT_COL_INDEX = 2;   // C열(Segment), dataBackgrounds 0-based 인덱스

  const dataBackgrounds = [];
  const targetBackgrounds = [];
  const spentBackgrounds = [];
  const targetBold = [];
  const cpnp1Backgrounds = [];
  const cpnp1Bold = [];

  for(let i = 0; i < rowCount; i++){

    const monthBlockIndex = Math.floor(i / segmentsPerMonth);
    const stripe = (monthBlockIndex % 2 === 1) ? STRIPE_COLOR : null;

    const dataRow = new Array(dataCols).fill(stripe);
    const targetRow = new Array(targetCols).fill(stripe);
    const targetBoldRow = new Array(targetCols).fill("normal");
    let cpnp1Background = stripe;
    let cpnp1BoldValue = "normal";

    const onTrack = onTrackRows && onTrackRows[i];

    if(onTrack){

      if(onTrack[0]){
        targetRow[0] = ON_TRACK_COLOR;      // S — Revenue Target
        targetBoldRow[0] = "bold";
        dataRow[SEGMENT_COL_INDEX] = ON_TRACK_COLOR;   // C — Segment(Revenue On Track)
      }

      if(onTrack[1]){
        targetRow[1] = ON_TRACK_COLOR;      // T — Revenue Target%
        targetBoldRow[1] = "bold";
      }

      if(onTrack[2]){
        targetRow[3] = ON_TRACK_COLOR;      // V — New P1 Target%
        targetBoldRow[3] = "bold";
      }

      if(onTrack[3]){
        cpnp1Background = ON_TRACK_COLOR;   // X — CPNP1(사용자 수동 컬럼)
        cpnp1BoldValue = "bold";
      }

    }

    cpnp1Backgrounds.push([cpnp1Background]);
    cpnp1Bold.push([cpnp1BoldValue]);

    dataBackgrounds.push(dataRow);
    targetBackgrounds.push(targetRow);
    targetBold.push(targetBoldRow);

    spentBackgrounds.push([stripe]);

  }

  return {
    dataBackgrounds: dataBackgrounds,
    targetBackgrounds: targetBackgrounds,
    spentBackgrounds: spentBackgrounds,
    targetBold: targetBold,
    cpnp1Backgrounds: cpnp1Backgrounds,
    cpnp1Bold: cpnp1Bold
  };

}


/**
 * ==========================================================
 * TEST — buildACQReportBackgrounds_()
 * ==========================================================
 */
function testBuildACQReportBackgrounds(){

  // segmentsPerMonth = CONFIG.ACQ.SEGMENTS.length에 의존 — 실제 설정값 사용.
  const segmentsPerMonth = CONFIG.ACQ.SEGMENTS.length;
  const rowCount = segmentsPerMonth * 2;   // 월 블록 2개(짝/홀 각 1개)

  const onTrackRows = [];
  for(let i = 0; i < rowCount; i++) onTrackRows.push([false, false, false, false]);
  onTrackRows[0] = [true, true, false, false];               // 첫 블록(줄무늬 없음) 첫 행 — S/T만 On Track
  onTrackRows[segmentsPerMonth] = [false, false, true, true]; // 둘째 블록(줄무늬 있음) 첫 행 — V/X On Track

  const result = buildACQReportBackgrounds_(rowCount, 14, 4, onTrackRows);

  const pass =
    result.dataBackgrounds.length === rowCount &&
    result.dataBackgrounds[0][0] === null &&                    // 첫 블록 줄무늬 없음
    result.dataBackgrounds[segmentsPerMonth][0] === "#F3F3F3" && // 둘째 블록 줄무늬
    result.dataBackgrounds[0][2] === "#01ef18" &&                // C(Segment) — Revenue On Track(S)
    result.dataBackgrounds[segmentsPerMonth][2] === "#F3F3F3" &&  // V만 On Track이면 C는 줄무늬만
    result.targetBackgrounds[0][0] === "#01ef18" &&              // S On Track
    result.targetBackgrounds[0][1] === "#01ef18" &&              // T On Track
    result.targetBackgrounds[0][2] === null &&                   // U는 강조 대상 아님
    result.targetBackgrounds[0][3] === null &&                   // V 아님(첫 행)
    result.targetBackgrounds[segmentsPerMonth][3] === "#01ef18" && // V On Track(둘째 블록)
    result.targetBackgrounds[segmentsPerMonth][0] === "#F3F3F3" && // S는 줄무늬만(On Track 아님)
    result.spentBackgrounds[segmentsPerMonth][0] === "#F3F3F3" &&
    result.targetBold[0][0] === "bold" &&                        // S On Track → 볼드
    result.targetBold[0][1] === "bold" &&                        // T On Track → 볼드
    result.targetBold[0][2] === "normal" &&                      // U — 볼드 대상 아님
    result.targetBold[0][3] === "normal" &&                      // V 아님(첫 행)
    result.targetBold[segmentsPerMonth][3] === "bold" &&          // V On Track(둘째 블록) → 볼드
    result.targetBold[segmentsPerMonth][0] === "normal" &&        // S는 On Track 아님 → 볼드 아님
    result.cpnp1Backgrounds[0][0] === null &&                      // 첫 행 X On Track 아님 — 줄무늬 없음 그대로
    result.cpnp1Backgrounds[segmentsPerMonth][0] === "#01ef18" &&  // 둘째 블록 X On Track
    result.cpnp1Bold[0][0] === "normal" &&
    result.cpnp1Bold[segmentsPerMonth][0] === "bold";

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Apply ACQ Segment Percentile Highlight Rules (F/J — 세그먼트별 상위 25%)
 *
 * WHY (2026-08-06 사용자 요청)
 * All P1%(F)/New P1%(J)에서 "세그먼트 안에서" 값이 상위 25%(0 제외,
 * PERCENTILE 0.75 이상)인 셀을 강조 — 세그먼트마다 규모가 달라 전체
 * 컬럼 기준 퍼센타일은 의미가 없어서, C열(Segment)이 같은 행끼리만 묶어
 * 계산한다(50_Events_Config.js/55_Events_Styles.js의 TOP25_HIGHLIGHT와
 * 같은 취지, 세그먼트 그룹핑만 추가). 조건부 서식(수식 기반)이라 매
 * Generate마다 sheet.setConditionalFormatRules()로 전체 교체 — 이전
 * 실행 규칙이 남지 않음.
 *
 * INPUT
 * sheet : Sheet
 * startRow : Number
 * rowCount : Number
 * ==========================================================
 */
function applyACQSegmentPercentileHighlightRules_(sheet, startRow, rowCount){

  if(rowCount === 0){
    sheet.setConditionalFormatRules([]);
    return;
  }

  const lastRow = startRow + rowCount - 1;
  const segmentCol = "C";
  const percentile = 0.75;
  const color = "#01ef18";

  const rules = [6, 10].map(function(col){   // F(All P1%), J(New P1%)

    const colLetter = columnIndexToLetter_(col);

    const formula = buildSegmentPercentileHighlightFormula_(
      colLetter, segmentCol, startRow, lastRow, percentile
    );

    return SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(formula)
      .setBackground(color)
      .setBold(true)
      .setRanges([sheet.getRange(startRow, col, rowCount, 1)])
      .build();

  });

  sheet.setConditionalFormatRules(rules);

}


/**
 * ==========================================================
 * Build Segment Percentile Highlight Formula (순수 함수, 테스트용으로 분리)
 *
 * WHY
 * 같은 세그먼트(Segment 컬럼) 안에서만, 0을 제외한 값들의 상위 25%
 * (PERCENTILE 0.75 이상)인 셀을 강조하는 조건부 서식 커스텀 수식을
 * 만든다. 55_Events_Styles.js buildPercentileHighlightFormula_()와
 * 동일한 앵커/절대참조 패턴에 FILTER의 세그먼트 일치 조건만 추가.
 *
 * INPUT
 * colLetter : string  (예: "F")
 * segmentColLetter : string  (예: "C")
 * dataStartRow : number
 * lastRow : number
 * percentile : number  (0~1)
 *
 * OUTPUT
 * string
 *
 * TEST
 * testBuildSegmentPercentileHighlightFormula 참고
 * ==========================================================
 */
function buildSegmentPercentileHighlightFormula_(colLetter, segmentColLetter, dataStartRow, lastRow, percentile){

  const anchor = colLetter + dataStartRow;
  const segAnchor = segmentColLetter + dataStartRow;
  const range = "$" + colLetter + "$" + dataStartRow + ":$" + colLetter + "$" + lastRow;
  const segRange = "$" + segmentColLetter + "$" + dataStartRow + ":$" + segmentColLetter + "$" + lastRow;

  return "=AND(" + anchor + ">0," + anchor + ">=PERCENTILE(FILTER(" +
    range + "," + segRange + "=" + segAnchor + "," + range + ">0)," + percentile + "))";

}


/**
 * ==========================================================
 * TEST — buildSegmentPercentileHighlightFormula_()
 * ==========================================================
 */
function testBuildSegmentPercentileHighlightFormula(){

  const pass =
    buildSegmentPercentileHighlightFormula_("F", "C", 5, 95, 0.75) ===
      "=AND(F5>0,F5>=PERCENTILE(FILTER($F$5:$F$95,$C$5:$C$95=C5,$F$5:$F$95>0),0.75))";

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}