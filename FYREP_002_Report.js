/**
 * ==========================================================
 * Marketing 2.0
 * FY_REP Report — Write 레이어 (FY×Month 단일 플랫 테이블)
 *
 * Responsibility
 * `FYREP_001_Engine.js`의 `computeFYRepFlatRows_()`가 계산한 회사 전체
 * FY×Month 행(세그먼트/채널 구분 없음, Revenue만 세그먼트별 컬럼 유지)을
 * `FY_REP` 시트에 쓴다. Engine 레이어는 이번 재구성에서 대부분 재사용됨
 * (Marketing/Leads_OPS/Revenue 원시 계산 함수는 안 바뀜) — 이 파일과
 * `FYREP_003_Styles.js`만 전면 재작성.
 *
 * **레이아웃(2026-08-20 전면 재구성 — 사용자 요청 "전체 구조를 바꾸려고
 * 해")**: 이전(v3.x)의 4섹션 체크박스 + 지표 드롭다운 + 세그먼트/채널별
 * 컬럼 + FY 블록 세로 반복 레이아웃을 전부 폐기.
 * - **Control(1행)**: A1=Start FY 라벨/B1=값(드롭다운), C1=End FY 라벨/
 *   D1=값(드롭다운), E1=Generate 라벨/F1=체크박스 — 전부 1행에 가로로만
 *   배치(사용자 확정). 2행은 비움.
 * - **헤더(3행)**: 컬럼 헤더 라벨 + 그 아래 데이터의 SUBTOTAL(9, ...) 합계를
 *   한 셀에 겸해서 보여준다(사용자 확정 — "헤더 라벨 + SUBTOTAL 합산을
 *   겸하는"). 필터로 행을 숨기면 SUBTOTAL이 보이는 행만 다시 합산 —
 *   `buildFYRepSubtotalRowFormulas_()` 참고.
 * - **데이터(4행부터)**: FY×Month 단일 플랫 행, 컬럼은 FY | Month | Spent |
 *   New P1 | ICBooked | IC Completed | SeminarRev | WB Rev | BOFU Rev |
 *   SA Rev | Content Rev | Upsells | Referral | Other | Total Rev | Target |
 *   Target% | ROI(사용자 확정 순서, `FY_REP_FLAT_COLUMNS` 참고). Spent/New
 *   P1/ICBooked/IC Completed는 세그먼트·채널 구분 없이 회사 전체 합계
 *   하나씩만(사용자 확정). End FY가 위로 오도록 FY 최신순 정렬은 기존
 *   방침 그대로 유지.
 *
 * Stage
 * FYREP (2026-08-08 신규 컨벤션 — `FYREP_NNN_Name.js`, 사용자 확정)
 *
 * Version
 * v4.1.0
 *
 * Change Log
 * v4.1.0 (2026-08-20)
 * - 사용자 피드백("3번째는 subtotal, 4번째는 헤더 이렇게 나와야해") 반영 —
 *   헤더 라벨+SUBTOTAL 겸용 1행(3행) 설계를 2행으로 분리: 3행=SUBTOTAL 값만
 *   (`buildFYRepSubtotalRowFormulas_()`가 이제 라벨 없이 `=SUBTOTAL(9,...)`/
 *   `=IFERROR(SUBTOTAL(9,...)/SUBTOTAL(9,...),0)`만 반환), 4행=순수 컬럼
 *   헤더 라벨(`buildFYRepHeaderRowLabels_()` 신규). `writeFYRepHeaderRow_()`가
 *   두 행 모두 씀. `CONFIG.FYREP.HEADER_ROW`(4행) 신규,
 *   `REPORT_START_ROW` 4→5(CORE_001_Config.js v1.40.0). `setupFYReport()`
 *   데이터 검증 정리 범위도 1~3행→1~4행으로 확장.
 * v4.0.0 (2026-08-20)
 * - 전면 재구성(사용자 요청) — 4섹션 체크박스/지표 드롭다운/세그먼트·채널별
 *   컬럼/FY 블록 세로 반복 전부 폐기. FY×Month 단일 플랫 테이블로 교체
 *   (`FY_REP_FLAT_COLUMNS`/`buildFYRepRowValues_()`/`buildFYRepSubtotalRowFormulas_()`/
 *   `writeFYRepHeaderRow_()` 신규). Control Area를 1행 가로 배치(Start FY/
 *   End FY/Generate)로 축소, 헤더+SUBTOTAL 겸용 3행 신규. 이제 쓸모없어진
 *   `FY_REP_MARKETING_METRICS`/`FY_REP_ACQ_METRICS`/`FY_REP_PIPELINE_METRICS`/
 *   `FY_REP_REVENUE_METRIC`/`FY_REP_MARKETING_CHANNEL_DISPLAY_MAP`/
 *   `findFYRepMetricByLabel_()`/`collectFYRepDynamicBlockKeys_()`/
 *   `buildFYRepPivotIndex_()`/`buildFYRepFlatDataRows_()`/
 *   `writeFYRepFlatBlock_()`/`writeFYRepSection_()`/`computeFYRepColumnTotals_()`/
 *   `computeFYRepRowSums_()`와 각 테스트 삭제(미사용 코드 방치 금지 원칙).
 *   `transformFYRepMarketingChannels_()`는 표시명 매핑 책임이 없어져
 *   `filterFYRepMarketingChannels_()`(제외 목록만)로 단순화. `buildFYRepFYRange_()`는
 *   그대로 재사용(Start/End FY 파싱 로직 불변).
 * v3.7.0 (2026-08-08)
 * - (이전 버전 이력은 git 로그 참고 — 4섹션/블록 레이아웃 시절 기록)
 * ==========================================================
 */


// Marketing 채널 중 완전히 제외할 채널(사용자 확정 — "=delete" 표시된
// 것들). 회사 전체 Spent 합계에서도 제외해야 노이즈성 채널이 총액을
// 왜곡하지 않는다(2026-08-20 재구성에서도 그대로 유지 — 채널별 표시가
// 없어졌을 뿐, 어떤 채널을 합계에 넣을지는 여전히 유효한 결정).
const FY_REP_MARKETING_CHANNEL_EXCLUDE = [
  "Google Display / Discovery/ Perf Max",
  "Others",
  "Others (Naver Search)"
];

// 회사 전체 FY×Month 플랫 테이블 컬럼 정의(사용자 확정 순서, 2026-08-20).
// subtotal: "sum"이면 3행 헤더 셀이 SUBTOTAL(9, 그 컬럼 범위)를 합산 표시,
// "ratio"면 numeratorKey/denominatorKey 컬럼의 SUBTOTAL끼리 나눈 값을
// ratioFormat으로 표시(Target%/ROI처럼 행별 비율을 그냥 합산하면 의미가
// 없는 컬럼 — 분자/분모를 각각 합산한 뒤 나눔). FY/Month는 subtotal 없음
// (헤더 라벨만).
const FY_REP_FLAT_COLUMNS = [
  { key: "fy", label: "FY" },
  { key: "month", label: "Month" },
  { key: "spent", label: "Spent", format: "$#,##0", subtotal: "sum" },
  { key: "newP1", label: "New P1", format: "#,##0", subtotal: "sum" },
  { key: "icBooked", label: "ICBooked", format: "#,##0", subtotal: "sum" },
  { key: "icComplete", label: "IC Completed", format: "#,##0", subtotal: "sum" },
  { key: "seminar", label: "SeminarRev", format: "$#,##0", subtotal: "sum" },
  { key: "webinar", label: "WB Rev", format: "$#,##0", subtotal: "sum" },
  { key: "bofu", label: "BOFU Rev", format: "$#,##0", subtotal: "sum" },
  { key: "search", label: "SA Rev", format: "$#,##0", subtotal: "sum" },
  { key: "content", label: "Content Rev", format: "$#,##0", subtotal: "sum" },
  { key: "upsell", label: "Upsells", format: "$#,##0", subtotal: "sum" },
  { key: "referral", label: "Referral", format: "$#,##0", subtotal: "sum" },
  { key: "other", label: "Other", format: "$#,##0", subtotal: "sum" },
  { key: "totalRev", label: "Total Rev", format: "$#,##0", subtotal: "sum" },
  { key: "target", label: "Target", format: "$#,##0", subtotal: "sum" },
  { key: "targetPct", label: "Target%", format: "0%", subtotal: "ratio", numeratorKey: "totalRev", denominatorKey: "target", ratioFormat: "0%" },
  { key: "roi", label: "ROI", format: "0.00", subtotal: "ratio", numeratorKey: "totalRev", denominatorKey: "spent", ratioFormat: "0.00" }
];

// 3행 SUBTOTAL 헤더 수식이 참조하는 데이터 범위 크기(4행부터 이만큼) —
// 실제 데이터 행 수(FY 개수×12)보다 넉넉히 크게 잡아 매 Generate마다 수식을
// 다시 안 써도 되게 한다(SUBTOTAL(9,...)는 빈 셀을 0으로 취급해 합계에
// 영향 없음).
const FY_REP_SUBTOTAL_RANGE_ROW_COUNT = 100000;

// Target% ≥ 100%일 때 Total Rev/Target% 셀을 강조하는 색상 — 기존
// FYREP_002_Report.js(v3.x, Sum 컬럼 하이라이트)가 쓰던 값 그대로 재사용
// (ACQ_REP의 #C6E0B4와는 별개 — FY_REP 자체 관례 유지, 2026-08-20).
const FY_REP_TARGET_ACHIEVED_COLOR = "#01EF18";


/**
 * ==========================================================
 * Filter FY_REP Marketing Channels (순수 함수)
 *
 * WHY
 * 제외 대상 채널(FY_REP_MARKETING_CHANNEL_EXCLUDE)의 행을 걸러낸다 — 회사
 * 전체 Spent 합계(`sumFYRepRowsByFYMonth_()`)에 노이즈성 채널이 섞이지
 * 않도록. 이전 버전의 `transformFYRepMarketingChannels_()`는 채널별 컬럼
 * 표시명 매핑도 겸했으나, 2026-08-20 재구성으로 채널별 컬럼 자체가
 * 없어져(회사 전체 합계 하나) 표시명 매핑 책임은 삭제 — 필터만 남음.
 *
 * INPUT
 * rows : Array<Object>  computeFYRepMarketingRows_() 결과(각 행에 channel 필드)
 * excludeList : Array<string>  이 목록에 있는 원본 채널명은 행 자체를 제거
 *
 * OUTPUT
 * Array<Object>  제외 대상이 빠진 새 배열(원본 불변)
 *
 * TEST
 * testFilterFYRepMarketingChannels() 참고
 * ==========================================================
 */
function filterFYRepMarketingChannels_(rows, excludeList){

  return rows.filter(function(row){ return excludeList.indexOf(row.channel) === -1; });

}


/**
 * ==========================================================
 * TEST — filterFYRepMarketingChannels_()
 * ==========================================================
 */
function testFilterFYRepMarketingChannels(){

  const rows = [
    { channel: "Facebook", spent: 100 },
    { channel: "Others", spent: 999 }
  ];

  const result = filterFYRepMarketingChannels_(rows, ["Others"]);

  const pass =
    result.length === 1 &&
    result[0].channel === "Facebook" &&
    rows.length === 2; // 원본 불변 확인

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Build FY_REP Row Values (순수 함수)
 *
 * WHY
 * `computeFYRepFlatRows_()`가 만든 행 객체 하나를 `FY_REP_FLAT_COLUMNS`
 * 순서의 셀 값 배열로 바꾼다(setValues()에 바로 넣을 형태). FY 컬럼만
 * "FY27" 같은 표시용 라벨로 변환하고 나머지는 그대로 통과.
 *
 * INPUT
 * row : Object  computeFYRepFlatRows_() 결과 행 하나
 * columns : Array<{ key }>  FY_REP_FLAT_COLUMNS
 *
 * OUTPUT
 * Array  columns 순서의 셀 값
 *
 * TEST
 * testBuildFYRepRowValues() 참고
 * ==========================================================
 */
function buildFYRepRowValues_(row, columns){

  return columns.map(function(col){

    if(col.key === "fy") return "FY" + String(row.fy).slice(-2);

    return row[col.key];

  });

}


/**
 * ==========================================================
 * TEST — buildFYRepRowValues_()
 * ==========================================================
 */
function testBuildFYRepRowValues(){

  const row = {
    fy: 27, month: "AUG", spent: 100, newP1: 5, icBooked: 2, icComplete: 1,
    seminar: 10, webinar: 20, bofu: 30, search: 40, content: 50,
    upsell: 60, referral: 70, other: 80, totalRev: 360, target: 400,
    targetPct: 0.9, roi: 3.6
  };

  const values = buildFYRepRowValues_(row, FY_REP_FLAT_COLUMNS);

  const pass =
    values[0] === "FY27" &&
    values[1] === "AUG" &&
    values[2] === 100 &&
    values[3] === 5 &&
    values[14] === 360 && // totalRev
    values[16] === 0.9 && // targetPct
    values[17] === 3.6;   // roi

  Logger.log("Result: " + JSON.stringify(values));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Build FY_REP Subtotal Row Formulas (순수 함수)
 *
 * WHY
 * 3행(헤더 겸 SUBTOTAL 행)에 들어갈 수식 문자열을 컬럼 정의로부터 만든다.
 * "sum" 컬럼은 `="라벨 (" & TEXT(SUBTOTAL(9,범위),서식) & ")"` 형태로 라벨과
 * 합계를 한 셀에 겸해서 보여주고(사용자 확정), "ratio" 컬럼(Target%/ROI)은
 * 분자·분모 컬럼을 각각 SUBTOTAL로 합산한 뒤 나눈다(행별 비율을 그대로
 * 합산하면 의미가 없으므로). FY/Month처럼 subtotal이 없는 컬럼은 라벨만.
 * 전부 "="로 시작하는 수식이라 setFormulas() 한 번으로 균일하게 쓸 수 있음.
 *
 * INPUT
 * columns : Array<Object>  FY_REP_FLAT_COLUMNS
 * rangeByKey : Object  컬럼 key → A1 표기 데이터 범위 문자열(예 "C4:C100000")
 *
 * OUTPUT
 * Array<string>  columns와 같은 길이의 수식 문자열
 *
 * TEST
 * testBuildFYRepSubtotalRowFormulas() 참고
 * ==========================================================
 */
function buildFYRepSubtotalRowFormulas_(columns, rangeByKey){

  return columns.map(function(col){

    if(col.subtotal === "sum"){
      return "=SUBTOTAL(9," + rangeByKey[col.key] + ")";
    }

    if(col.subtotal === "ratio"){
      return "=IFERROR(SUBTOTAL(9," + rangeByKey[col.numeratorKey] +
        ")/SUBTOTAL(9," + rangeByKey[col.denominatorKey] + "),0)";
    }

    return "";

  });

}


/**
 * ==========================================================
 * TEST — buildFYRepSubtotalRowFormulas_()
 * ==========================================================
 */
function testBuildFYRepSubtotalRowFormulas(){

  const columns = [
    { key: "fy", label: "FY" },
    { key: "spent", label: "Spent", format: "$#,##0", subtotal: "sum" },
    { key: "totalRev", label: "Total Rev", format: "$#,##0", subtotal: "sum" },
    { key: "target", label: "Target", format: "$#,##0", subtotal: "sum" },
    { key: "roi", label: "ROI", format: "0.00", subtotal: "ratio", numeratorKey: "totalRev", denominatorKey: "spent", ratioFormat: "0.00" }
  ];

  const rangeByKey = { spent: "C4:C100", totalRev: "O4:O100", target: "P4:P100" };

  const formulas = buildFYRepSubtotalRowFormulas_(columns, rangeByKey);

  const pass =
    formulas[0] === "" &&
    formulas[1] === "=SUBTOTAL(9,C4:C100)" &&
    formulas[4] === "=IFERROR(SUBTOTAL(9,O4:O100)/SUBTOTAL(9,C4:C100),0)";

  Logger.log("Result: " + JSON.stringify(formulas));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Build FY_REP Header Row Labels (순수 함수)
 *
 * WHY
 * 4행(순수 컬럼 헤더 행)에 쓸 라벨 배열을 만든다 — 2026-08-20 사용자
 * 피드백("3번째는 subtotal, 4번째는 헤더")으로 기존 "헤더+SUBTOTAL 겸용"
 * 1행 설계를 2행으로 분리(3행=SUBTOTAL만, 4행=이 함수의 라벨만).
 *
 * INPUT
 * columns : Array<{ label }>  FY_REP_FLAT_COLUMNS
 *
 * OUTPUT
 * Array<string>  columns 순서의 라벨
 *
 * TEST
 * testBuildFYRepHeaderRowLabels() 참고
 * ==========================================================
 */
function buildFYRepHeaderRowLabels_(columns){

  return columns.map(function(col){ return col.label; });

}


/**
 * ==========================================================
 * TEST — buildFYRepHeaderRowLabels_()
 * ==========================================================
 */
function testBuildFYRepHeaderRowLabels(){

  const columns = [{ key: "fy", label: "FY" }, { key: "spent", label: "Spent" }];

  const labels = buildFYRepHeaderRowLabels_(columns);

  const pass = JSON.stringify(labels) === JSON.stringify(["FY", "Spent"]);

  Logger.log("Result: " + JSON.stringify(labels));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Build FY_REP FY Range (순수 함수)
 *
 * WHY
 * Control Area의 Start FY/End FY 드롭다운 값(예 "FY24")을 실제 순회할 FY
 * 배열로 바꾼다. 잘못된 값(파싱 실패, start > end, CONFIG.FYREP.FYS 밖의
 * 값)이면 CONFIG.FYREP.FYS 전체로 안전하게 폴백 — 에러로 리포트 생성을
 * 막지 않음(빈 드롭다운인 최초 상태 등 방어). 2026-08-20 재구성에서도
 * 그대로 재사용(Start/End FY 파싱 로직 자체는 안 바뀜).
 *
 * INPUT
 * startLabel, endLabel : string  "FY24" 등
 * allFYs : Array<number>  CONFIG.FYREP.FYS(오래된 순)
 *
 * OUTPUT
 * Array<number>  startFY~endFY(포함) 중 allFYs에 실제 존재하는 것만
 *
 * TEST
 * testBuildFYRepFYRange() 참고
 * ==========================================================
 */
function buildFYRepFYRange_(startLabel, endLabel, allFYs){

  const startFY = Number(String(startLabel || "").replace("FY", ""));
  const endFY = Number(String(endLabel || "").replace("FY", ""));

  if(isNaN(startFY) || isNaN(endFY) || startFY > endFY){
    return allFYs.slice();
  }

  const range = allFYs.filter(function(fy){ return fy >= startFY && fy <= endFY; });

  return range.length > 0 ? range : allFYs.slice();

}


/**
 * ==========================================================
 * TEST — buildFYRepFYRange_()
 * ==========================================================
 */
function testBuildFYRepFYRange(){

  const allFYs = [24, 25, 26];

  const cases = [
    ["FY24", "FY26", [24, 25, 26]],
    ["FY25", "FY26", [25, 26]],
    ["FY26", "FY24", [24, 25, 26]], // start > end — 폴백
    ["", "", [24, 25, 26]],         // 빈 값 — 폴백
    ["FY22", "FY23", [24, 25, 26]]  // 범위 밖 — 폴백
  ];

  let pass = true;

  cases.forEach(function(c){
    const result = buildFYRepFYRange_(c[0], c[1], allFYs);
    if(JSON.stringify(result) !== JSON.stringify(c[2])){
      pass = false;
      Logger.log("❌ FAIL: (" + c[0] + "," + c[1] + ") = " + JSON.stringify(result) + ", expected " + JSON.stringify(c[2]));
    }
  });

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Write FY_REP Header Row (IO 래퍼)
 *
 * WHY
 * 3행(헤더+SUBTOTAL 겸용)에 `buildFYRepSubtotalRowFormulas_()` 결과를 쓴다.
 * 실제 시트 Range의 `getA1Notation()`으로 범위 문자열을 만들어(컬럼 문자
 * 직접 계산 안 함 — 이 프로젝트에 아직 columnToLetter_ 유틸이 없어 실수
 * 위험) 순수 함수에 넘긴다. setupFYReport()와 generateFYReport_() 둘 다
 * 호출 — Generate 때마다 다시 써도 내용은 동일(범위가 컬럼 개수/
 * REPORT_START_ROW로 고정이라 매번 같은 수식).
 *
 * INPUT
 * sheet : Sheet
 * ==========================================================
 */
function writeFYRepHeaderRow_(sheet){

  const columns = FY_REP_FLAT_COLUMNS;
  const dataStartRow = CONFIG.FYREP.REPORT_START_ROW;

  const rangeByKey = {};

  columns.forEach(function(col, i){
    rangeByKey[col.key] = sheet.getRange(dataStartRow, i + 1, FY_REP_SUBTOTAL_RANGE_ROW_COUNT, 1).getA1Notation();
  });

  const formulas = buildFYRepSubtotalRowFormulas_(columns, rangeByKey);
  sheet.getRange(CONFIG.FYREP.SUBTOTAL_ROW, 1, 1, columns.length).setFormulas([formulas]);

  const labels = buildFYRepHeaderRowLabels_(columns);
  sheet.getRange(CONFIG.FYREP.HEADER_ROW, 1, 1, columns.length).setValues([labels]);

}


/**
 * ==========================================================
 * Setup FY_REP Report (IO 래퍼)
 *
 * WHY
 * FY_REP 시트를 만들고 Control Area(1행 — Start FY/End FY/Generate)와
 * 3행 헤더를 세팅한다. 기존 선택값이 있으면 안 건드리고, 비어있거나
 * 유효하지 않은 셀만 기본값으로 채운다 — 재실행해도 사용자가 골라둔
 * 선택이 사라지지 않게.
 * ==========================================================
 */
function setupFYReport(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(CONFIG.FYREP.SHEET);

  if(!sheet){
    sheet = ss.insertSheet(CONFIG.FYREP.SHEET);
  }

  sheet.clearFormats();

  const control = CONFIG.FYREP.CONTROL;
  const columns = FY_REP_FLAT_COLUMNS;

  // 과거 레이아웃(체크박스 4개 + 지표 드롭다운, A1:F3)이 남긴 데이터 검증
  // 규칙을 먼저 지운다 — setValue()는 검증을 무시하고 값은 써지지만, 규칙
  // 자체는 안 지워져 셀에 엉뚱한 체크박스/드롭다운 UI가 남을 수 있음.
  sheet.getRange(1, 1, 4, columns.length).clearDataValidations();

  // 2행은 항상 빈 행(사용자 확정) — 과거 레이아웃이 남긴 값이 있어도 정리.
  sheet.getRange(2, 1, 1, columns.length).clearContent();

  const fyLabels = CONFIG.FYREP.FYS.map(function(fy){ return "FY" + String(fy).slice(-2); });
  const fyRule = SpreadsheetApp.newDataValidation().requireValueInList(fyLabels).build();

  sheet.getRange(control.START_FY.ROW, control.START_FY.LABEL_COL).setValue("Start FY").setFontWeight("bold");
  sheet.getRange(control.END_FY.ROW, control.END_FY.LABEL_COL).setValue("End FY").setFontWeight("bold");
  sheet.getRange(control.GENERATE.ROW, control.GENERATE.LABEL_COL).setValue("Generate").setFontWeight("bold");

  const startCell = sheet.getRange(control.START_FY.ROW, control.START_FY.VALUE_COL);
  const endCell = sheet.getRange(control.END_FY.ROW, control.END_FY.VALUE_COL);

  startCell.setDataValidation(fyRule);
  endCell.setDataValidation(fyRule);

  if(fyLabels.indexOf(startCell.getValue()) === -1) startCell.setValue(fyLabels[0]);
  if(fyLabels.indexOf(endCell.getValue()) === -1) endCell.setValue(fyLabels[fyLabels.length - 1]);

  const checkboxRule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  const generateCell = sheet.getRange(control.GENERATE.ROW, control.GENERATE.VALUE_COL);

  generateCell.setDataValidation(checkboxRule);
  if(typeof generateCell.getValue() !== "boolean") generateCell.setValue(false);

  writeFYRepHeaderRow_(sheet);

  Logger.log(CONFIG.LOG.PREFIX + " " + CONFIG.FYREP.SHEET + " Control Area ready.");

}


/**
 * ==========================================================
 * On FY_REP Edit (설치형 트리거 핸들러)
 *
 * WHY
 * Generate 체크박스(F1)가 체크되면 generateFYReport_()를 실행하고 다시
 * 체크 해제한다. 반드시 **설치형 트리거**로 등록해야 동작 — 일반 onEdit
 * Simple Trigger는 권한이 제한돼 있어 Marketing 섹션이 여는
 * `perfTrackerByFY`(SpreadsheetApp.openById()) 호출이 실패한다(Target_REP
 * 선례, docs/OpenItems.md #11 — "Specified permissions are not sufficient").
 * `runInstallFYReportGenerateTrigger()`로 최초 1회 설치.
 *
 * INPUT
 * e : Object  onEdit 이벤트 객체
 * ==========================================================
 */
function onFYReportEdit_(e){

  if(!e || !e.range) return;

  const sheet = e.range.getSheet();

  if(sheet.getName() !== CONFIG.FYREP.SHEET) return;

  const generateConfig = CONFIG.FYREP.CONTROL.GENERATE;

  if(e.range.getRow() !== generateConfig.ROW || e.range.getColumn() !== generateConfig.VALUE_COL) return;

  if(e.value !== "TRUE") return;

  try{
    generateFYReport_();
  } catch(err){
    Logger.log(CONFIG.LOG.PREFIX + " FY_REP Generate 실패: " + err.message);
  } finally {
    sheet.getRange(generateConfig.ROW, generateConfig.VALUE_COL).setValue(false);
  }

}


/**
 * ==========================================================
 * TEMP — Generate 체크박스 설치형 트리거 등록(최초 1회 수동 실행 전용)
 *
 * WHY
 * onFYReportEdit_()가 실제로 동작하려면 설치형 트리거로 등록돼 있어야
 * 한다(일반 Simple Trigger는 자동 실행되지만 권한 부족 — 위 WHY 참고).
 * 같은 handlerName의 기존 트리거를 먼저 지우고 새로 등록해 중복 방지
 * (`deleteTriggersByHandlerName_()`, 08_PipelineAsync.js 재사용).
 * ==========================================================
 */
function runInstallFYReportGenerateTrigger(){

  deleteTriggersByHandlerName_("onFYReportEdit_");

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  ScriptApp.newTrigger("onFYReportEdit_")
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  Logger.log(CONFIG.LOG.PREFIX + " FY_REP Generate 체크박스 설치형 트리거 등록 완료.");

}


/**
 * ==========================================================
 * Generate FY_REP Report (IO 래퍼 — 수동 실행 전용)
 *
 * WHY
 * Control Area(Start FY/End FY)를 읽어 그 범위의 FY×Month 플랫 행을
 * `computeFYRepFlatRows_()`(Engine)에서 가져와 4행부터 쓴다. End FY가
 * 위로 오도록 FY는 최신순, 그 안에서 월은 CONFIG.ACQ.FISCAL_MONTH_ORDER
 * 순(기존 방침 유지). 3행 헤더는 컬럼 정의가 안 바뀌어도 매번 다시 써서
 * (Generate와 무관하게 항상 최신 수식 유지) 값만 새로 채운다.
 * ==========================================================
 */
function generateFYReport_(){

  const start = new Date();

  Logger.log("======================================");
  Logger.log("FY_REP Report Generation Started");
  Logger.log("======================================");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.FYREP.SHEET);

  if(!sheet){
    throw new Error(CONFIG.FYREP.SHEET + " sheet not found. setupFYReport()를 먼저 실행하세요.");
  }

  const control = CONFIG.FYREP.CONTROL;
  const columns = FY_REP_FLAT_COLUMNS;

  const startLabel = sheet.getRange(control.START_FY.ROW, control.START_FY.VALUE_COL).getValue();
  const endLabel = sheet.getRange(control.END_FY.ROW, control.END_FY.VALUE_COL).getValue();
  const fyRange = buildFYRepFYRange_(startLabel, endLabel, CONFIG.FYREP.FYS);

  const reportStartRow = CONFIG.FYREP.REPORT_START_ROW;
  const lastRow = sheet.getLastRow();

  if(lastRow >= reportStartRow){
    sheet.getRange(reportStartRow, 1, lastRow - reportStartRow + 1, columns.length).clear();
  }

  writeFYRepHeaderRow_(sheet);

  const allRows = computeFYRepFlatRows_();
  const rowsByKey = {};

  allRows.forEach(function(row){ rowsByKey[row.fy + "|" + row.month] = row; });

  const monthOrder = CONFIG.ACQ.FISCAL_MONTH_ORDER;
  const orderedRows = [];

  fyRange.slice().reverse().forEach(function(fy){
    monthOrder.forEach(function(month){
      const row = rowsByKey[fy + "|" + month];
      if(row) orderedRows.push(row);
    });
  });

  const values = orderedRows.map(function(row){ return buildFYRepRowValues_(row, columns); });

  if(values.length > 0){
    sheet.getRange(reportStartRow, 1, values.length, columns.length).setValues(values);
  }

  applyFYReportStyles_(sheet, columns, orderedRows);

  const elapsed = ((new Date()) - start) / 1000;

  Logger.log(
    CONFIG.LOG.PREFIX + " FY_REP Report generated — FY 범위 " +
    fyRange.map(function(fy){ return "FY" + String(fy).slice(-2); }).join("~") +
    ", " + values.length + "행 (" + elapsed + "초)"
  );

}


/**
 * ==========================================================
 * TEMP — generateFYReport_() 수동 실행용 공개 진입점
 * ==========================================================
 */
function runGenerateFYReport(){

  generateFYReport_();

}
