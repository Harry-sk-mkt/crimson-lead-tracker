/**
 * ==========================================================
 * Marketing 2.0
 * FY_REP Report — Write 레이어 (4섹션: Marketing/ACQ/Pipeline/Revenue)
 *
 * Responsibility
 * `FYREP_001_Engine.js`의 4개 Engine 함수가 계산한 행을 `FY_REP` 시트에
 * 쓴다. Engine 레이어는 이번 재설계에서 전혀 안 바뀜 — 이 파일과
 * `FYREP_003_Styles.js`만 재작성.
 *
 * **레이아웃(2026-08-08, 3차 재설계 — 사용자 피드백 반복 반영)**:
 * - **Control Area**: A1:B2 = FY 범위(Start FY/End FY 드롭다운, NewP1_REP의
 *   Start/End 패턴과 동일 사상). C1:F2 = 섹션 라벨 + 체크박스(Marketing/
 *   ACQ/Pipeline/Revenue). C3:E3 = Marketing/ACQ/Pipeline 지표 드롭다운
 *   (Spent/Results/CPL 등 여러 후보 중 하나를 골라서 봄 — "지표를 하나만
 *   고정하지 말고 드롭다운으로 클릭 전환"이라는 사용자 요청). Revenue는
 *   드롭다운 없음 — Target/Target%는 추정치라 제외하고 Actual Revenue만
 *   고정 표시(사용자 확정).
 * - **Report 영역**: 체크된 섹션마다, 그리고 그 섹션 안에서 FY 범위(Start~End)
 *   만큼 블록이 세로로 반복된다. 블록 하나 = 제목 행 + 헤더 행(Month |
 *   세그먼트1 | 세그먼트2 | ...) + 12개월 데이터 행 — **세그먼트/채널이
 *   컬럼, Month가 행**(이전 버전의 "FY가 컬럼" 피벗도 폐기됨 — FY는 이제
 *   블록 반복으로 표현). 섹션당 지표 1개만 보여주므로(드롭다운으로 선택)
 *   지표 그룹 병합 헤더가 더 이상 필요 없음 — 헤더가 단순 플랫 행.
 *
 * Stage
 * FYREP (2026-08-08 신규 컨벤션 — `FYREP_NNN_Name.js`, 사용자 확정)
 *
 * Version
 * v3.7.0
 *
 * Change Log
 * v3.7.0 (2026-08-08)
 * - 사용자 요청 반영: (1) FY 블록을 최신이 위로 오도록 역순 표시
 *   (`writeFYRepSection_()` — fyRange 자체는 오름차순 유지, 순회만 역순).
 *   (2) Sum 컬럼(행별 합계)을 Revenue 전용에서 4개 섹션 전체로 확장 —
 *   Marketing/ACQ/Pipeline도 `includeRowSum: true`. Target 초과 하이라이트
 *   (#01EF18)는 여전히 Revenue만(다른 섹션엔 비교할 Target이 없음).
 * v3.6.0 (2026-08-08)
 * - 사용자 요청 반영: (1) 정수 카운트 지표 서식을 "0"→"#,##0"(1000단위
 *   콤마)으로 변경. (2) Marketing 채널 표시명 매핑(`FY_REP_MARKETING_CHANNEL_DISPLAY_MAP`)
 *   + 제외 목록(`FY_REP_MARKETING_CHANNEL_EXCLUDE`, `transformFYRepMarketingChannels_()`)
 *   신규 — 원본 채널명이 길어 컬럼 너비가 들쭉날쭉하던 문제 해소, 노이즈성
 *   채널("Others" 등) 제거.
 * v3.5.0 (2026-08-08)
 * - 버그 수정(실측) — Results/New Leads/New P1/SAL/IC Booked/IC Completed/
 *   Deals(정수 카운트 지표)의 format이 `null`이라 Revenue(통화 서식)를
 *   먼저 실행한 뒤 재실행하면 이전 서식("$")이 Total 행에 남아있었음.
 *   전부 `"0"`(소수점 없는 정수 서식)으로 명시 — FYREP_003_Styles.js
 *   v3.2.0과 짝(거기서 서식을 조건 없이 항상 재적용하도록도 수정).
 * v3.4.0 (2026-08-08)
 * - 사용자 요청 4건 반영: (1) 모든 블록에 "Total" 행 추가(컬럼별 합계,
 *   `computeFYRepColumnTotals_()`). (2) Revenue 블록에 "Sum" 컬럼 추가
 *   (세그먼트 값 행별 합계, `computeFYRepRowSums_()`) — 8개 세그먼트+Upsell
 *   기준 자연스럽게 J열에 위치. (3) Sum이 그 달 회사 전체 Revenue Target을
 *   넘으면 `#01EF18`로 하이라이트(`writeFYRepFlatBlock_()`에서 직접 처리).
 *   (4) Generate 완료 후 섹션 체크박스(C2:F2)도 자동 해제(Generate
 *   체크박스 B3와 동일하게). Styles 레이어(FYREP_003_Styles.js v3.1.0)에
 *   블록 전체 테두리 + Total 행 굵게 추가.
 * v3.3.0 (2026-08-08)
 * - Generate 체크박스(A3:B3) 신규(사용자 요청) — `onFYReportEdit_()`(설치형
 *   트리거 핸들러)/`runInstallFYReportGenerateTrigger()`(최초 1회 설치용)
 *   추가. 일반 onEdit Simple Trigger는 Marketing 섹션의
 *   `SpreadsheetApp.openById()`(perfTrackerByFY) 호출을 권한 부족으로 못
 *   해서(Target_REP 선례, docs/OpenItems.md #11) 반드시 설치형 트리거로
 *   등록해야 함 — `deleteTriggersByHandlerName_()`(08_PipelineAsync.js)
 *   재사용해 중복 트리거 방지.
 * v3.2.0 (2026-08-08)
 * - `setupFYReport()`에 `sheet.clearFormats()` 추가(사용자 요청) — 레이아웃이
 *   세 차례 바뀌며 남았을 수 있는 과거 배경색/굵게 등 서식을 시트 전체
 *   기준으로 초기화. 내용(체크박스/드롭다운 선택값 등)은 보존되므로 기존
 *   "선택값 안 건드림" 방침과 충돌 없음.
 * v3.1.0 (2026-08-08)
 * - `setupFYReport()`에 `clearDataValidations()` 방어 코드 추가 — 레이아웃이
 *   세 차례 바뀌면서 과거 버전(체크박스가 A2:D2에 있던 버전 등)이 남긴
 *   데이터 검증 규칙이 새 셀 위치에 그대로 남아있을 수 있어, Control Area
 *   전체(A1:F3)를 setValue 전에 먼저 clearDataValidations()로 정리.
 * v3.0.0 (2026-08-08)
 * - 3차 재설계 — Control Area를 FY 범위(A1:B2)+섹션 체크박스(C1:F2)+지표
 *   드롭다운(C3:E3)으로 재구성, Report 레이어를 "세그먼트/채널=컬럼,
 *   Month=행, FY=블록 반복, 지표 1개(드롭다운 선택)"로 전면 교체. v2.x의
 *   "지표=컬럼그룹 병합헤더, FY=서브컬럼" 피벗 폐기(사용자 피드백).
 * ==========================================================
 */


// 섹션별 지표 후보 — 드롭다운에 표시될 라벨 순서 그대로. compute()는 피벗
// 행 하나(해당 FY×Month×Segment의 Engine 결과)를 받아 표시값을 뽑는다.
const FY_REP_MARKETING_METRICS = [
  { label: "Spent (NZD)", compute: function(row){ return row.spent; }, format: "$#,##0" },
  { label: "Results", compute: function(row){ return row.results; }, format: "#,##0" },
  { label: "CPL", compute: function(row){ return row.cpl; }, format: "$#,##0.00" }
];

const FY_REP_ACQ_METRICS = [
  { label: "New Leads", compute: function(row){ return row.newLeads; }, format: "#,##0" },
  { label: "New P1", compute: function(row){ return row.newP1; }, format: "#,##0" },
  { label: "SAL", compute: function(row){ return row.sal; }, format: "#,##0" }
];

const FY_REP_PIPELINE_METRICS = [
  { label: "IC Booked", compute: function(row){ return row.icBooked; }, format: "#,##0" },
  { label: "IC Completed", compute: function(row){ return row.icComplete; }, format: "#,##0" },
  { label: "Deals", compute: function(row){ return row.deals; }, format: "#,##0" }
];

// Revenue는 드롭다운 없이 Actual Revenue 고정(사용자 확정, 2026-08-08 —
// "Target, target%는 제외하고 actual만 남기자". Target은 추정치라
// Actual과 나란히 두면 실제 목표처럼 오해될 위험도 있어 제외).
const FY_REP_REVENUE_METRIC = { label: "Actual Revenue", compute: function(row){ return row.actual; }, format: "$#,##0" };

// Marketing 채널 표시명 매핑(사용자 확정, 2026-08-08 — "이름도 길어서 컬럼
// 너비도 멋대로고. 이름도 같이 고치자"). 원본 채널명(perfTrackerByFY 플랫폼
// 블록 A열에서 추출된 것, extractFYRepChannelName_() 참고)이 길어서 컬럼
// 너비가 들쭉날쭉해지는 문제 + 원본 라벨이 장황한 문제를 함께 해소.
// ⚠️ "Content Performance"는 실제 채널이 아니라 perfTrackerByFY 원본 시트의
// 장식용 섹션 헤더 행이 채널 블록으로 잘못 스캔된 것으로 보임(A열이
// 비어있지 않고 B열이 "Metrics"가 아니라 "Best & worst performing"이라
// scanFYRepMarketingPlatformBlocks_()가 블록 시작으로 오판) — 실제 지출/
// 리드 데이터가 전혀 없는 빈 컬럼일 가능성이 높음. 사용자가 삭제 대상으로
// 지정하지 않고 "Content"로 개명하라고 명시했으므로 일단 그대로 따르되,
// 스캔 로직 자체를 고칠지는 별도 확인 필요(임의로 안 고침).
const FY_REP_MARKETING_CHANNEL_DISPLAY_MAP = {
  "Content Performance": "Content",
  "Facebook": "Meta",
  "Google Demand Gen": "GoogleDG",
  "Google Paid Search": "GSA",
  "Google Performance Max": "GPMax",
  "Naver Search": "NaverSA",
  "Others (Naver Display)": "NaverGFA"
};

// 완전히 제외할 채널(사용자 확정 — "=delete" 표시된 것들).
const FY_REP_MARKETING_CHANNEL_EXCLUDE = [
  "Google Display / Discovery/ Perf Max",
  "Others",
  "Others (Naver Search)"
];


/**
 * ==========================================================
 * Transform FY_REP Marketing Channels (순수 함수)
 *
 * WHY
 * Marketing Engine 행의 원본 채널명을 사용자 확정 표시명으로 바꾸고,
 * 제외 대상 채널은 행 자체를 걸러낸다 — 컬럼 헤더가 짧아져 컬럼 너비가
 * 안정되고, 노이즈성 채널(예 "Content Performance")도 정리 가능.
 *
 * INPUT
 * rows : Array<Object>  computeFYRepMarketingRows_() 결과(각 행에 channel 필드)
 * displayMap : Object  원본명 → 표시명(매핑 없으면 원본 그대로 유지)
 * excludeList : Array<string>  이 목록에 있는 원본 채널명은 행 자체를 제거
 *
 * OUTPUT
 * Array<Object>  channel 필드가 치환된 새 배열(원본 불변)
 *
 * TEST
 * testTransformFYRepMarketingChannels() 참고
 * ==========================================================
 */
function transformFYRepMarketingChannels_(rows, displayMap, excludeList){

  return rows
    .filter(function(row){ return excludeList.indexOf(row.channel) === -1; })
    .map(function(row){

      const displayName = displayMap[row.channel];

      return displayName ? Object.assign({}, row, { channel: displayName }) : row;

    });

}


/**
 * ==========================================================
 * TEST — transformFYRepMarketingChannels_()
 * ==========================================================
 */
function testTransformFYRepMarketingChannels(){

  const rows = [
    { channel: "Facebook", spent: 100 },
    { channel: "Bing", spent: 50 },
    { channel: "Others", spent: 999 } // 제외 대상
  ];

  const result = transformFYRepMarketingChannels_(
    rows, { "Facebook": "Meta" }, ["Others"]
  );

  const pass =
    result.length === 2 &&
    result[0].channel === "Meta" && result[0].spent === 100 &&
    result[1].channel === "Bing" &&
    rows[0].channel === "Facebook"; // 원본 불변 확인

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Find FY_REP Metric By Label (순수 함수)
 *
 * WHY
 * Control Area 드롭다운 셀 값(문자열 라벨)을 실제 metric 객체로 변환한다.
 * 드롭다운이 아직 비어있거나 알 수 없는 값이면 목록의 첫 번째로 안전하게
 * 폴백(에러로 리포트 생성을 막지 않음).
 *
 * INPUT
 * metrics : Array<{ label }>
 * label : string
 *
 * OUTPUT
 * Object  metrics 안의 항목(못 찾으면 metrics[0])
 *
 * TEST
 * testFindFYRepMetricByLabel() 참고
 * ==========================================================
 */
function findFYRepMetricByLabel_(metrics, label){

  const found = metrics.filter(function(m){ return m.label === label; })[0];

  return found || metrics[0];

}


/**
 * ==========================================================
 * TEST — findFYRepMetricByLabel_()
 * ==========================================================
 */
function testFindFYRepMetricByLabel(){

  const metrics = [{ label: "A" }, { label: "B" }];

  const pass =
    findFYRepMetricByLabel_(metrics, "B").label === "B" &&
    findFYRepMetricByLabel_(metrics, "존재안함").label === "A" &&
    findFYRepMetricByLabel_(metrics, "").label === "A";

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Collect FY_REP Dynamic Block Keys (순수 함수)
 *
 * WHY
 * Marketing 채널처럼 고정 목록이 없는 차원은 실제 등장한 값을 모아
 * 알파벳순으로 정렬한다(채널 구성이 FY마다 달라 하드코딩 불가 — exec-plan
 * 확정 사항).
 *
 * INPUT
 * rows : Array<Object>
 * dimensionKey : string
 *
 * OUTPUT
 * Array<string>  중복 제거 + 알파벳순
 *
 * TEST
 * testCollectFYRepDynamicBlockKeys() 참고
 * ==========================================================
 */
function collectFYRepDynamicBlockKeys_(rows, dimensionKey){

  const seen = {};

  rows.forEach(function(row){ seen[row[dimensionKey]] = true; });

  return Object.keys(seen).sort();

}


/**
 * ==========================================================
 * TEST — collectFYRepDynamicBlockKeys_()
 * ==========================================================
 */
function testCollectFYRepDynamicBlockKeys(){

  const rows = [
    { channel: "Facebook" }, { channel: "Naver Search" },
    { channel: "Facebook" }, { channel: "Bing" }
  ];

  const result = collectFYRepDynamicBlockKeys_(rows, "channel");

  const pass = JSON.stringify(result) === JSON.stringify(["Bing", "Facebook", "Naver Search"]);

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Build FY_REP Pivot Index (순수 함수)
 *
 * WHY
 * 플랫 Engine 행 배열을 { [블록키]: { [월]: { [FY]: row } } } 3중 맵으로
 * 재구성한다 — 표 작성 시 (블록, 월, FY) 조합으로 O(1) 조회하기 위함.
 *
 * INPUT
 * rows : Array<Object>  { fy, month, [dimensionKey]: string, ...지표 }
 * dimensionKey : string
 *
 * OUTPUT
 * Object
 *
 * TEST
 * testBuildFYRepPivotIndex() 참고
 * ==========================================================
 */
function buildFYRepPivotIndex_(rows, dimensionKey){

  const index = {};

  rows.forEach(function(row){

    const dim = row[dimensionKey];

    if(!index[dim]) index[dim] = {};
    if(!index[dim][row.month]) index[dim][row.month] = {};

    index[dim][row.month][row.fy] = row;

  });

  return index;

}


/**
 * ==========================================================
 * TEST — buildFYRepPivotIndex_()
 * ==========================================================
 */
function testBuildFYRepPivotIndex(){

  const rows = [
    { fy: 26, month: "AUG", segment: "Search", newLeads: 10 },
    { fy: 25, month: "AUG", segment: "Search", newLeads: 8 }
  ];

  const index = buildFYRepPivotIndex_(rows, "segment");

  const pass =
    index.Search.AUG[26].newLeads === 10 &&
    index.Search.AUG[25].newLeads === 8;

  Logger.log("Result: " + JSON.stringify(index));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Build FY_REP Flat Data Rows (순수 함수)
 *
 * WHY
 * FY 하나·지표 하나에 대한 12개월 × 세그먼트/채널 그리드를 만든다 —
 * 세그먼트가 컬럼, 월이 행(2026-08-08 사용자 확정 레이아웃). 데이터가
 * 없는 (월, 세그먼트) 조합은 공란("").
 *
 * INPUT
 * pivotIndex : Object  buildFYRepPivotIndex_() 결과
 * blockKeys : Array<string>  컬럼이 될 세그먼트/채널 목록(순서 그대로)
 * monthOrder : Array<string>  CONFIG.ACQ.FISCAL_MONTH_ORDER
 * fy : number
 * metric : { compute: Function }
 *
 * OUTPUT
 * Array<Array>  각 행 = [월, 세그먼트1값, 세그먼트2값, ...]
 *
 * TEST
 * testBuildFYRepFlatDataRows() 참고
 * ==========================================================
 */
function buildFYRepFlatDataRows_(pivotIndex, blockKeys, monthOrder, fy, metric){

  return monthOrder.map(function(month){

    const outRow = [month];

    blockKeys.forEach(function(blockKey){

      const monthData = pivotIndex[blockKey] && pivotIndex[blockKey][month];
      const row = monthData && monthData[fy];

      outRow.push(row ? metric.compute(row) : "");

    });

    return outRow;

  });

}


/**
 * ==========================================================
 * TEST — buildFYRepFlatDataRows_()
 * ==========================================================
 */
function testBuildFYRepFlatDataRows(){

  const rows = [
    { fy: 26, month: "AUG", segment: "Search", newLeads: 10 },
    { fy: 26, month: "AUG", segment: "Content", newLeads: 4 }
    // SEP은 데이터 없음 — 공란 확인용
  ];

  const index = buildFYRepPivotIndex_(rows, "segment");
  const metric = { compute: function(r){ return r.newLeads; } };

  const dataRows = buildFYRepFlatDataRows_(index, ["Search", "Content"], ["AUG", "SEP"], 26, metric);

  const pass =
    dataRows.length === 2 &&
    JSON.stringify(dataRows[0]) === JSON.stringify(["AUG", 10, 4]) &&
    JSON.stringify(dataRows[1]) === JSON.stringify(["SEP", "", ""]);

  Logger.log("Result: " + JSON.stringify(dataRows));
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
 * 막지 않음(빈 드롭다운인 최초 상태 등 방어).
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
 * Setup FY_REP Report (IO 래퍼)
 *
 * WHY
 * FY_REP 시트를 만들고 Control Area(FY 범위 드롭다운 + 섹션 체크박스 +
 * 지표 드롭다운)를 세팅한다. 기존 선택값이 있으면 안 건드리고, 비어있거나
 * 유효하지 않은 셀만 기본값으로 채운다 — 재실행해도 사용자가 골라둔 선택이
 * 사라지지 않게(체크박스 기본값 버그, 2026-08-08 실측 발견·수정 경험 반영).
 * ==========================================================
 */
function setupFYReport(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(CONFIG.FYREP.SHEET);

  if(!sheet){
    sheet = ss.insertSheet(CONFIG.FYREP.SHEET);
  }

  // 시트 전체 서식 초기화(값은 안 건드림) — 레이아웃이 세 차례 바뀌면서
  // 과거 버전의 배경색/굵게 등이 새 레이아웃 위치에 남아있을 수 있어
  // 사용자 요청으로 추가(2026-08-08). clearFormats()는 내용은 보존하므로
  // 아래 Control Area 기존 선택값 보존 로직과 충돌하지 않음.
  sheet.clearFormats();

  const control = CONFIG.FYREP.CONTROL;
  const fyLabels = CONFIG.FYREP.FYS.map(function(fy){ return "FY" + String(fy).slice(-2); });
  const fyRule = SpreadsheetApp.newDataValidation().requireValueInList(fyLabels).build();

  // 과거 레이아웃(체크박스 4개가 A2:D2에 있던 버전 등)이 남긴 데이터 검증
  // 규칙을 먼저 지운다 — setValue()는 검증을 무시하고 값은 써지지만, 규칙
  // 자체는 안 지워져 셀에 엉뚱한 체크박스/드롭다운 UI가 남을 수 있음
  // (2026-08-08 레이아웃이 세 차례 바뀌며 실측 대비 방어적으로 추가).
  sheet.getRange(1, 1, 3, 6).clearDataValidations();

  //----------------------------------------------------------
  // A1:B2 — FY 범위
  //----------------------------------------------------------

  const fyRange = control.FY_RANGE;

  sheet.getRange(fyRange.START_ROW, fyRange.LABEL_COL).setValue("Start FY").setFontWeight("bold");
  sheet.getRange(fyRange.END_ROW, fyRange.LABEL_COL).setValue("End FY").setFontWeight("bold");

  const startCell = sheet.getRange(fyRange.START_ROW, fyRange.VALUE_COL);
  const endCell = sheet.getRange(fyRange.END_ROW, fyRange.VALUE_COL);

  startCell.setDataValidation(fyRule);
  endCell.setDataValidation(fyRule);

  if(fyLabels.indexOf(startCell.getValue()) === -1) startCell.setValue(fyLabels[0]);
  if(fyLabels.indexOf(endCell.getValue()) === -1) endCell.setValue(fyLabels[fyLabels.length - 1]);

  //----------------------------------------------------------
  // C1:F3 — 섹션 체크박스 + 지표 드롭다운
  //----------------------------------------------------------

  const sections = control.SECTIONS;
  const cols = sections.COLUMNS;

  const sectionMeta = [
    { col: cols.MARKETING, label: "Marketing", metrics: FY_REP_MARKETING_METRICS },
    { col: cols.ACQ, label: "ACQ", metrics: FY_REP_ACQ_METRICS },
    { col: cols.PIPELINE, label: "Pipeline", metrics: FY_REP_PIPELINE_METRICS },
    { col: cols.REVENUE, label: "Revenue", metrics: null } // 드롭다운 없음(Actual 고정)
  ];

  const checkboxRule = SpreadsheetApp.newDataValidation().requireCheckbox().build();

  sectionMeta.forEach(function(meta){

    const labelCell = sheet.getRange(sections.LABEL_ROW, meta.col);
    labelCell.setValue(meta.label).setFontWeight("bold");

    const checkboxCell = sheet.getRange(sections.CHECKBOX_ROW, meta.col);
    checkboxCell.setDataValidation(checkboxRule);

    if(typeof checkboxCell.getValue() !== "boolean") checkboxCell.setValue(true);

    if(meta.metrics){

      const metricLabels = meta.metrics.map(function(m){ return m.label; });
      const metricRule = SpreadsheetApp.newDataValidation().requireValueInList(metricLabels).build();

      const metricCell = sheet.getRange(sections.METRIC_ROW, meta.col);
      metricCell.setDataValidation(metricRule);

      if(metricLabels.indexOf(metricCell.getValue()) === -1) metricCell.setValue(metricLabels[0]);

    }

  });

  //----------------------------------------------------------
  // A3:B3 — Generate 체크박스(설치형 트리거 전용, onFYReportEdit_() 참고)
  //----------------------------------------------------------

  const generateConfig = control.GENERATE;

  sheet.getRange(generateConfig.ROW, generateConfig.LABEL_COL).setValue("Generate").setFontWeight("bold");

  const generateCell = sheet.getRange(generateConfig.ROW, generateConfig.CHECKBOX_COL);
  generateCell.setDataValidation(checkboxRule);

  if(typeof generateCell.getValue() !== "boolean") generateCell.setValue(false);

  Logger.log(CONFIG.LOG.PREFIX + " " + CONFIG.FYREP.SHEET + " Control Area ready.");

}


/**
 * ==========================================================
 * On FY_REP Edit (설치형 트리거 핸들러)
 *
 * WHY
 * Generate 체크박스(A3:B3)가 체크되면 generateFYReport_()를 실행하고 다시
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

  if(e.range.getRow() !== generateConfig.ROW || e.range.getColumn() !== generateConfig.CHECKBOX_COL) return;

  if(e.value !== "TRUE") return;

  try{
    generateFYReport_();
  } catch(err){
    Logger.log(CONFIG.LOG.PREFIX + " FY_REP Generate 실패: " + err.message);
  } finally {
    sheet.getRange(generateConfig.ROW, generateConfig.CHECKBOX_COL).setValue(false);
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
 * Compute FY_REP Column Totals (순수 함수)
 *
 * WHY
 * 블록 하나(12개월 데이터 행)의 컬럼별 합계 행을 만든다 — 모든 블록에
 * 공통으로 붙는 "Total" 행(사용자 요청, 2026-08-08). 첫 컬럼(Month)은
 * "Total" 라벨로 대체, 나머지 컬럼은 숫자 합(공란/비숫자는 0 취급).
 *
 * INPUT
 * dataRows : Array<Array>  buildFYRepFlatDataRows_() 결과(또는 Sum 컬럼이
 *   이미 붙은 형태 — 그 컬럼도 그대로 합산됨)
 *
 * OUTPUT
 * Array|null  ["Total", 합계1, 합계2, ...], dataRows가 비어있으면 null
 *
 * TEST
 * testComputeFYRepColumnTotals() 참고
 * ==========================================================
 */
function computeFYRepColumnTotals_(dataRows){

  if(dataRows.length === 0) return null;

  const colCount = dataRows[0].length;
  const totals = ["Total"];

  for(let c = 1; c < colCount; c++){

    let sum = 0;

    dataRows.forEach(function(row){ sum += (Number(row[c]) || 0); });

    totals.push(sum);

  }

  return totals;

}


/**
 * ==========================================================
 * TEST — computeFYRepColumnTotals_()
 * ==========================================================
 */
function testComputeFYRepColumnTotals(){

  const dataRows = [["AUG", 1, 2], ["SEP", 3, ""], ["OCT", "", 4]];

  const totals = computeFYRepColumnTotals_(dataRows);

  const pass =
    JSON.stringify(totals) === JSON.stringify(["Total", 4, 6]) &&
    computeFYRepColumnTotals_([]) === null;

  Logger.log("Result: " + JSON.stringify(totals));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute FY_REP Row Sums (순수 함수)
 *
 * WHY
 * Revenue 섹션의 Sum 컬럼(사용자 요청 — "J에 sum이 들어가면 좋겠어") 값을
 * 계산한다 — 행 하나(그 달)의 세그먼트/버킷 값을 전부 더한 것(Month
 * 컬럼 제외).
 *
 * INPUT
 * dataRows : Array<Array>  buildFYRepFlatDataRows_() 결과
 *
 * OUTPUT
 * Array<number>  dataRows와 같은 길이, 행별 합계
 *
 * TEST
 * testComputeFYRepRowSums() 참고
 * ==========================================================
 */
function computeFYRepRowSums_(dataRows){

  return dataRows.map(function(row){

    let sum = 0;

    for(let c = 1; c < row.length; c++){
      sum += (Number(row[c]) || 0);
    }

    return sum;

  });

}


/**
 * ==========================================================
 * TEST — computeFYRepRowSums_()
 * ==========================================================
 */
function testComputeFYRepRowSums(){

  const dataRows = [["AUG", 1, 2, 3], ["SEP", 5, "", ""]];

  const sums = computeFYRepRowSums_(dataRows);

  const pass = JSON.stringify(sums) === JSON.stringify([6, 5]);

  Logger.log("Result: " + JSON.stringify(sums));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Write FY_REP Flat Block (IO 래퍼)
 *
 * WHY
 * FY 하나·지표 하나의 표(제목 행 + 헤더 행 + 12개월 데이터 행 + Total
 * 행)를 startRow부터 쓴다. Revenue 전용 옵션(options.includeRowSum)이
 * 켜져 있으면 세그먼트 값들의 행별 합계를 "Sum" 컬럼으로 추가하고,
 * options.monthTargets(월→회사 전체 Target 맵)가 있으면 그 달 Sum이
 * Target을 넘을 때 셀 배경을 `#01EF18`로 칠한다(사용자 확정 색상,
 * 2026-08-08) — Sum 계산과 같은 함수 안에서 처리해야 rowSums를 다시
 * 조회할 필요가 없어 Styles 레이어로 안 빼고 여기서 직접 처리.
 *
 * INPUT
 * sheet : Sheet
 * startRow : number
 * title : string
 * columnKeys : Array<string>  세그먼트/채널 컬럼 목록
 * dataRows : Array<Array>  buildFYRepFlatDataRows_() 결과
 * options : { includeRowSum?: boolean, monthTargets?: Object } | undefined
 *
 * OUTPUT
 * Object  { headerRow, dataStartRow, rowCount, colCount, totalRow, nextRow }
 * ==========================================================
 */
function writeFYRepFlatBlock_(sheet, startRow, title, columnKeys, dataRows, options){

  options = options || {};

  sheet.getRange(startRow, 1).setValue(title).setFontWeight("bold").setFontSize(12);

  const headerRow = startRow + 1;
  const header = ["Month"].concat(columnKeys);

  if(options.includeRowSum) header.push("Sum");

  sheet.getRange(headerRow, 1, 1, header.length).setValues([header]);

  const dataStartRow = headerRow + 1;

  let outputRows = dataRows;
  let rowSums = null;

  if(options.includeRowSum){

    rowSums = computeFYRepRowSums_(dataRows);
    outputRows = dataRows.map(function(row, i){ return row.concat([rowSums[i]]); });

  }

  if(outputRows.length > 0){
    sheet.getRange(dataStartRow, 1, outputRows.length, header.length).setValues(outputRows);
  }

  let cursor = dataStartRow + outputRows.length;
  let totalRow = null;

  const totals = computeFYRepColumnTotals_(outputRows);

  if(totals){
    sheet.getRange(cursor, 1, 1, header.length).setValues([totals]);
    totalRow = cursor;
    cursor++;
  }

  if(options.includeRowSum && options.monthTargets && rowSums){

    dataRows.forEach(function(row, i){

      const month = row[0];
      const target = options.monthTargets[month] || 0;

      if(rowSums[i] > target){
        sheet.getRange(dataStartRow + i, header.length).setBackground("#01EF18");
      }

    });

  }

  return {
    headerRow: headerRow,
    dataStartRow: dataStartRow,
    rowCount: outputRows.length,
    colCount: header.length,
    totalRow: totalRow,
    nextRow: cursor + 1 // 블록 사이 빈 줄 1개
  };

}


/**
 * ==========================================================
 * Write FY_REP Section (IO 래퍼)
 *
 * WHY
 * 섹션(Marketing/ACQ/Pipeline/Revenue) 하나 — FY 범위만큼 writeFYRepFlatBlock_()
 * 반복 호출(FY가 세로 블록 반복 단위, 2026-08-08 확정). 블록은 **최신 FY가
 * 먼저(위쪽)** 오도록 fyRange를 역순으로 순회(사용자 요청, 2026-08-08 —
 * fyRange 자체는 오름차순 유지, 여기서만 표시 순서를 뒤집음).
 *
 * INPUT
 * sheet : Sheet
 * startRow : number
 * sectionName : string
 * metric : Object
 * columnKeys : Array<string>
 * pivotIndex : Object
 * monthOrder : Array<string>
 * fyRange : Array<number>
 * sectionOptions : { includeRowSum?: boolean, monthTargetsByFY?: Object } | undefined
 *   monthTargetsByFY는 FY→(월→Target) 맵 — Revenue Sum 하이라이트 전용.
 *
 * OUTPUT
 * Object  { blocks: Array<Object>, nextRow }
 * ==========================================================
 */
function writeFYRepSection_(sheet, startRow, sectionName, metric, columnKeys, pivotIndex, monthOrder, fyRange, sectionOptions){

  sectionOptions = sectionOptions || {};

  let cursor = startRow;
  const blocks = [];

  fyRange.slice().reverse().forEach(function(fy){

    const dataRows = buildFYRepFlatDataRows_(pivotIndex, columnKeys, monthOrder, fy, metric);
    const title = sectionName + " — " + metric.label + " — FY" + String(fy).slice(-2);

    const blockOptions = {
      includeRowSum: sectionOptions.includeRowSum,
      monthTargets: sectionOptions.monthTargetsByFY ? sectionOptions.monthTargetsByFY[fy] : null
    };

    const block = writeFYRepFlatBlock_(sheet, cursor, title, columnKeys, dataRows, blockOptions);

    blocks.push(block);
    cursor = block.nextRow;

  });

  return { blocks: blocks, nextRow: cursor };

}


/**
 * ==========================================================
 * Generate FY_REP Report (IO 래퍼 — 수동 실행 전용)
 *
 * WHY
 * Control Area(FY 범위/섹션 체크박스/지표 드롭다운)를 읽어 체크된 섹션만
 * Engine 호출 + 표 작성. Report 영역(CONFIG.FYREP.REPORT_START_ROW부터)만
 * 지우고 Control Area는 그대로 둔다.
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
  const fyRangeConfig = control.FY_RANGE;
  const sections = control.SECTIONS;
  const cols = sections.COLUMNS;

  const startLabel = sheet.getRange(fyRangeConfig.START_ROW, fyRangeConfig.VALUE_COL).getValue();
  const endLabel = sheet.getRange(fyRangeConfig.END_ROW, fyRangeConfig.VALUE_COL).getValue();
  const fyRange = buildFYRepFYRange_(startLabel, endLabel, CONFIG.FYREP.FYS);

  const checkboxValues = sheet.getRange(sections.CHECKBOX_ROW, cols.MARKETING, 1, 4).getValues()[0];
  const metricValues = sheet.getRange(sections.METRIC_ROW, cols.MARKETING, 1, 3).getValues()[0];

  const showMarketing = checkboxValues[cols.MARKETING - cols.MARKETING] === true;
  const showACQ = checkboxValues[cols.ACQ - cols.MARKETING] === true;
  const showPipeline = checkboxValues[cols.PIPELINE - cols.MARKETING] === true;
  const showRevenue = checkboxValues[cols.REVENUE - cols.MARKETING] === true;

  const marketingMetric = findFYRepMetricByLabel_(FY_REP_MARKETING_METRICS, metricValues[cols.MARKETING - cols.MARKETING]);
  const acqMetric = findFYRepMetricByLabel_(FY_REP_ACQ_METRICS, metricValues[cols.ACQ - cols.MARKETING]);
  const pipelineMetric = findFYRepMetricByLabel_(FY_REP_PIPELINE_METRICS, metricValues[cols.PIPELINE - cols.MARKETING]);

  const reportStartRow = CONFIG.FYREP.REPORT_START_ROW;
  const clearWidth = 30; // 세그먼트/채널 컬럼 수가 늘어나도 여유있게(Marketing 채널은 동적)

  const lastRow = sheet.getLastRow();
  if(lastRow >= reportStartRow){
    sheet.getRange(reportStartRow, 1, lastRow - reportStartRow + 1, clearWidth).clear();
  }

  const monthOrder = CONFIG.ACQ.FISCAL_MONTH_ORDER;
  const segmentOrder = CONFIG.ACQ.SEGMENTS;

  let cursor = reportStartRow;
  const sectionsWritten = [];

  //----------------------------------------------------------
  // 1. Marketing
  //----------------------------------------------------------

  if(showMarketing){

    const marketingRows = transformFYRepMarketingChannels_(
      computeFYRepMarketingRows_(), FY_REP_MARKETING_CHANNEL_DISPLAY_MAP, FY_REP_MARKETING_CHANNEL_EXCLUDE
    );
    const marketingIndex = buildFYRepPivotIndex_(marketingRows, "channel");
    const marketingBlockKeys = collectFYRepDynamicBlockKeys_(marketingRows, "channel");

    const section = writeFYRepSection_(
      sheet, cursor, "Marketing", marketingMetric, marketingBlockKeys, marketingIndex, monthOrder, fyRange,
      { includeRowSum: true }
    );

    sectionsWritten.push({ metric: marketingMetric, blocks: section.blocks });
    cursor = section.nextRow;

  }

  //----------------------------------------------------------
  // 2/3. ACQ + Pipeline (같은 Engine 결과 공유)
  //----------------------------------------------------------

  if(showACQ || showPipeline){

    const leadsOPSRows = computeFYRepLeadsOPSAggregates_();

    if(showACQ){

      const acqIndex = buildFYRepPivotIndex_(leadsOPSRows, "segment");

      const section = writeFYRepSection_(
        sheet, cursor, "ACQ", acqMetric, segmentOrder, acqIndex, monthOrder, fyRange,
        { includeRowSum: true }
      );

      sectionsWritten.push({ metric: acqMetric, blocks: section.blocks });
      cursor = section.nextRow;

    }

    if(showPipeline){

      const pipelineDealCounts = computeFYRepPipelineDealCounts_();

      const pipelineRows = leadsOPSRows.map(function(row){

        const key = row.fy + "|" + row.month + "|" + row.segment;

        return Object.assign({}, row, { deals: pipelineDealCounts[key] || 0 });

      });

      const pipelineIndex = buildFYRepPivotIndex_(pipelineRows, "segment");

      const section = writeFYRepSection_(
        sheet, cursor, "Pipeline", pipelineMetric, segmentOrder, pipelineIndex, monthOrder, fyRange,
        { includeRowSum: true }
      );

      sectionsWritten.push({ metric: pipelineMetric, blocks: section.blocks });
      cursor = section.nextRow;

    }

  }

  //----------------------------------------------------------
  // 4. Revenue
  //----------------------------------------------------------

  if(showRevenue){

    const revenueRows = computeFYRepRevenueRows_();
    const revenueBucketOrder = segmentOrder.concat(["Upsell"]);
    const revenueIndex = buildFYRepPivotIndex_(revenueRows, "segment");

    // Sum(J열) 하이라이트용 — FY별 월 Revenue Target(회사 전체, Quarterly
    // Summary C열). computeFYRepCompanyRevenueTargetsForFY_()는 Revenue
    // 섹션 Engine이 Target(추정) 계산에 이미 쓰던 함수 재사용.
    const monthTargetsByFY = {};
    fyRange.forEach(function(fy){
      monthTargetsByFY[fy] = computeFYRepCompanyRevenueTargetsForFY_(fy);
    });

    const section = writeFYRepSection_(
      sheet, cursor, "Revenue", FY_REP_REVENUE_METRIC, revenueBucketOrder, revenueIndex, monthOrder, fyRange,
      { includeRowSum: true, monthTargetsByFY: monthTargetsByFY }
    );

    sectionsWritten.push({ metric: FY_REP_REVENUE_METRIC, blocks: section.blocks });
    cursor = section.nextRow;

  }

  applyFYReportStyles_(sheet, sectionsWritten);

  // Generate 완료 후 섹션 체크박스(C2:F2)도 Generate 체크박스(B3, onFYReportEdit_
  // 쪽에서 처리)처럼 해제 — 사용자 요청(2026-08-08, "이것도 해제되도록").
  sheet.getRange(sections.CHECKBOX_ROW, cols.MARKETING, 1, 4).setValue(false);

  const elapsed = ((new Date()) - start) / 1000;

  Logger.log(
    CONFIG.LOG.PREFIX + " FY_REP Report generated — FY 범위 " +
    fyRange.map(function(fy){ return "FY" + String(fy).slice(-2); }).join("~") +
    ", 섹션 " + sectionsWritten.length + "개 (" + elapsed + "초)"
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
