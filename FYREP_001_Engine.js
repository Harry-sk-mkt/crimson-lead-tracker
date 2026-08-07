/**
 * ==========================================================
 * Marketing 2.0
 * FY_REP Engine — Marketing 섹션 (FY24/25/26 채널별 Spent/Results/CPL)
 *
 * Responsibility
 * `perfTrackerByFY`(외부 스프레드시트, `CONFIG.FYREP.MARKETING_SOURCE`)의 탭별
 * 플랫폼 블록을 읽어 FY×Month×채널 단위 Spent(NZD 환산)/Results(Leads
 * consults+event+content 합)/CPL을 계산한다(Marketing 섹션). 그 아래
 * ACQ(New Leads/New P1/SAL)/Pipeline(IC Booked/Completed/Deals) 섹션도
 * 이 파일에 포함 — ACQ와 Pipeline의 Leads_OPS 파생 지표(New Leads/New
 * P1/SAL/IC Booked/IC Completed)는 같은 FY×Month×Segment 코호트 키로
 * 묶이는 같은 소스라 시트를 두 번 읽지 않도록 한 번의 스캔
 * (`aggregateFYRepLeadsOPSFromRecords_`)으로 합쳐 계산한다 — Report
 * 레이어가 이 결과를 ACQ/Pipeline 두 섹션에 나눠 쓴다. Deals(건수, Deal
 * Tracker 소스)만 별도 함수. Revenue 섹션은 이후 커밋에서 추가 예정
 * (docs/exec-plans/active/2026-08-07-fy-rep-implementation.md 진행
 * 체크리스트 참고).
 *
 * **채널 목록은 하드코딩하지 않는다** — 탭마다 A열을 스캔해 동적으로
 * 블록을 구성(FY마다 추적 플랫폼 구성이 다름, 사용자 확인 —
 * docs/exec-plans 위 문서 §"연도마다 추적 플랫폼이 다름" 참고).
 *
 * **통화 판정 우선순위(2026-08-08, 실측 확인)**: Spent 행 라벨 자체에
 * "(NZD)" 같은 통화 표기가 있으면 그걸 최우선으로 쓰고, 없으면 플랫폼명
 * 괄호 표기로 판단한다 — 기존엔 "라벨이 아니라 플랫폼명으로만 판단"이라고
 * 가정했으나(00_Config.js 주석), FY26 탭 실측 결과 **모든** 플랫폼의
 * Spent 라벨이 "(NZD)"로 이미 명시돼 있어(플랫폼명 자체엔 통화 표기가
 * 없는 경우가 많음) 라벨을 우선 신뢰하는 쪽이 두 연도 모두 정확히
 * 들어맞음. `runInspectFYRepConsolidatedSheetBlocks()`(96_TempQA_
 * FYRepExternalSheet.js) 실행 로그로 FY24/25/26 3개 탭 전체 확인 완료.
 *
 * Must NOT
 * - `perfTrackerByFY` 원본 시트를 수정하지 않는다(읽기 전용).
 * - Clicks/Impressions/CPM 등 `CONFIG.FYREP.MARKETING_SOURCE.METRIC_ROW_LABELS`에
 *   정의는 돼 있지만 이번 라운드 Goal(Spent/Results/CPL)에 불필요한 지표는
 *   읽지 않는다(필요해지면 별도 함수로 추가).
 *
 * Stage
 * FYREP (2026-08-08 신규 컨벤션 — `FYREP_NNN_Name.js`, 사용자 확정)
 *
 * Version
 * v1.4.0
 *
 * Change Log
 * v1.4.0 (2026-08-08)
 * - `computeFYRepDefaultFYList_()` 신규(사용자 요청 — "이후 년도도 자동으로
 *   추가되게 하자") — CONFIG.FYREP.FYS를 [24,25,26] 하드코딩 대신 이 함수
 *   호출로 대체(00_Config.js v1.34.0), startFY(24)부터 오늘이 속한 FY까지
 *   자동으로 채움 — 매년 8월 수동으로 배열을 늘려줄 필요 없어짐.
 * v1.3.0 (2026-08-08)
 * - 버그 수정(사용자 피드백) — Revenue 섹션 Actual Revenue를 Created Date
 *   코호트에서 **Close Date 기준 그 달 실제 발생액**으로 전환
 *   (`aggregateFYRepDealRevenueFromRows_()`) — "코호트가 아니라 ACQ_REP의
 *   Revenue처럼 그 달에 얼마 했는지를 봐야 한다"는 피드백. Pipeline
 *   Deals(건수)는 영향 없음(Created Date 코호트 그대로).
 * v1.2.0 (2026-08-08)
 * - Revenue 섹션 추가 — 회사 전체 월별 Target(Quarterly Summary C열, 실측
 *   확인 — `CONFIG.FYREP.QUARTERLY_SUMMARY`) × 그 FY 딜 비중(코호트1,
 *   `computeFYRepDealShareRatiosForFY_()`) 추정치와 Deal Tracker Created
 *   Date 코호트 Actual Revenue. **사용자 확정(2026-08-08)**: Target 배분은
 *   7세그먼트+Upsell 전체 대상 — Target_Engine의 5세그먼트 전용 Deal
 *   Share(Upsell/Referral 제외)와 다른 별도 함수로 구현, 재사용 안 함.
 * v1.1.0 (2026-08-08)
 * - ACQ(New Leads/New P1/SAL)/Pipeline(IC Booked/IC Completed/Deals) 섹션
 *   추가. Leads_OPS 파생 지표는 `aggregateFYRepLeadsOPSFromRecords_()`
 *   하나로 통합(ACQ/Pipeline이 같은 코호트 키를 쓰는 같은 소스라 시트
 *   중복 스캔 방지). Deals(건수)는 Deal Tracker 소스라 별도
 *   `aggregateFYRepDealCountsFromRows_()` — Upsell/Referral은 Segment
 *   컬럼이 아니라 Lead Source 컬럼(`deriveFYRepDealBucket_()`)으로 식별해
 *   별도 버킷 분리(00_Config.js FYREP 블록 주석 확정 사항).
 * v1.0.0 (2026-08-08)
 * - 최초 구현 — Marketing 섹션(Spent/Results/CPL) Engine.
 * ==========================================================
 */


/**
 * ==========================================================
 * Extract FX Currency Code (순수 함수)
 *
 * WHY
 * 플랫폼명(A열)이나 Spent 행 라벨(B열)에 괄호로 표기된 통화 코드
 * (KRW/AUD/USD/NZD)를 추출한다. "(Naver Search)"처럼 통화가 아닌 다른
 * 괄호 텍스트와 구분하기 위해 화이트리스트 매칭만 한다(임의의 3글자
 * 대문자를 통화로 오판하지 않도록).
 *
 * INPUT
 * text : string
 *
 * OUTPUT
 * string|null  "KRW"/"AUD"/"USD"/"NZD" 중 매칭된 것, 없으면 null
 *
 * TEST
 * testExtractFxCurrencyCode() 참고
 * ==========================================================
 */
function extractFxCurrencyCode_(text){

  const match = String(text || "").match(/\((KRW|AUD|USD|NZD)\)/);

  return match ? match[1] : null;

}


/**
 * ==========================================================
 * TEST — extractFxCurrencyCode_()
 * ==========================================================
 */
function testExtractFxCurrencyCode(){

  const cases = [
    ["Amount spent (total) (NZD)", "NZD"],
    ["Amount spent (total)", null],
    ["Facebook\nCORE\n(NZD)", "NZD"],
    ["Others (Naver Search)", null],
    ["Naver Search\n(KRW)\n( Other )", "KRW"],
    ["Youtube (AUD)", "AUD"]
  ];

  let pass = true;

  cases.forEach(function(c){
    const result = extractFxCurrencyCode_(c[0]);
    if(result !== c[1]){
      pass = false;
      Logger.log("❌ FAIL: extractFxCurrencyCode_('" + c[0] + "') = " + result + ", expected " + c[1]);
    }
  });

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Extract FY_REP Channel Name (순수 함수)
 *
 * WHY
 * 플랫폼명 셀(A열)에서 리포트에 쓸 채널명을 뽑아낸다 — 여러 줄로 된
 * 텍스트("Facebook\nCORE\n(NZD)")는 첫 줄만 쓰고, 한 줄에 통화 코드가
 * 붙어있는 경우("Youtube (AUD)")는 그 통화 표기만 제거한다. 통화가 아닌
 * 괄호 텍스트("Others (Naver Search)")는 그대로 보존 — 실제로 서로 다른
 * 채널을 구분하는 정보이기 때문(실측 확인, FY26 "Others (Naver Search)"
 * vs "Others (Naver Display)").
 *
 * INPUT
 * platformLabel : string
 *
 * OUTPUT
 * string  채널명
 *
 * TEST
 * testExtractFYRepChannelName() 참고
 * ==========================================================
 */
function extractFYRepChannelName_(platformLabel){

  const firstLine = String(platformLabel || "").split("\n")[0];

  return firstLine.replace(/\s*\((KRW|AUD|USD|NZD)\)\s*$/, "").trim();

}


/**
 * ==========================================================
 * TEST — extractFYRepChannelName_()
 * ==========================================================
 */
function testExtractFYRepChannelName(){

  const cases = [
    ["Facebook\nCORE\n(NZD)", "Facebook"],
    ["Google Paid Search\nCORE\n(AUD)", "Google Paid Search"],
    ["Google Paid Search\nCORE", "Google Paid Search"],
    ["Youtube (AUD)", "Youtube"],
    ["Naver Search\n(KRW)\n( Other )", "Naver Search"],
    ["Others (Naver Search)", "Others (Naver Search)"],
    ["Others\n(AUD)", "Others"],
    ["Snapchat", "Snapchat"],
    ["Google Display / Discovery/ Perf Max", "Google Display / Discovery/ Perf Max"],
    ["Google Display / Discovery/ Perf Max\n(AUD)", "Google Display / Discovery/ Perf Max"]
  ];

  let pass = true;

  cases.forEach(function(c){
    const result = extractFYRepChannelName_(c[0]);
    if(result !== c[1]){
      pass = false;
      Logger.log("❌ FAIL: extractFYRepChannelName_('" + c[0] + "') = '" + result + "', expected '" + c[1] + "'");
    }
  });

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Scan FY_REP Marketing Platform Blocks (순수 함수)
 *
 * WHY
 * perfTrackerByFY 탭 하나(헤더 행부터 끝까지)를 스캔해 플랫폼 블록별로
 * Spent/Leads(consults·event·content) 월별 배열을 뽑아낸다. 새 블록은
 * A열이 비어있지 않고 B열이 "Metrics"가 아닌 행에서 시작한다고 판정 —
 * FY26 탭은 플랫폼 블록마다 "Platform"/"Metrics" 헤더 행이 반복되는데
 * (FY24/25는 맨 위 1번만) B열이 "Metrics"인 행은 블록 시작으로 오판하면
 * 안 되기 때문(실측 확인, runInspectFYRepConsolidatedSheetBlocks() 로그).
 *
 * INPUT
 * headerAndBodyValues : Array<Array>  row[0]=헤더 행(무시), row[1+]=본문.
 *   getRange(headerRow, 1, n, lastCol).getValues() 그대로.
 * monthColStart : number  1-based 월 데이터 시작 컬럼(예 3=C열)
 * monthColCount : number  월 컬럼 개수(12)
 * spentPrefix : string  Spent 행 판정용 접두사("Amount spent (total)")
 * leadTypeSuffixes : Array<string>  ["consults","event","content"]
 *
 * OUTPUT
 * Array<Object>  [{ channel, platformCurrency, spent: number[]|null,
 *   spentCurrency: string|null, leads: { consults: number[]|null, ... } }]
 *
 * TEST
 * testScanFYRepMarketingPlatformBlocks() 참고
 * ==========================================================
 */
function scanFYRepMarketingPlatformBlocks_(
  headerAndBodyValues, monthColStart, monthColCount, spentPrefix, leadTypeSuffixes
){

  const blocks = [];
  let current = null;

  for(let r = 1; r < headerAndBodyValues.length; r++){

    const row = headerAndBodyValues[r];
    const colA = String(row[0] || "").trim();
    const colB = String(row[1] || "").trim();

    if(colA !== "" && colB !== "Metrics"){

      current = {
        channel: extractFYRepChannelName_(colA),
        platformCurrency: extractFxCurrencyCode_(colA),
        spent: null,
        spentCurrency: null,
        leads: {}
      };

      leadTypeSuffixes.forEach(function(suffix){ current.leads[suffix] = null; });

      blocks.push(current);
      continue;

    }

    if(!current) continue;

    const monthValues = row.slice(monthColStart - 1, monthColStart - 1 + monthColCount)
      .map(function(v){ return parseCurrencyValue_(v); });

    if(colB.indexOf(spentPrefix) === 0){
      current.spent = monthValues;
      current.spentCurrency = extractFxCurrencyCode_(colB);
      continue;
    }

    leadTypeSuffixes.forEach(function(suffix){
      if(colB === "Leads - " + suffix){
        current.leads[suffix] = monthValues;
      }
    });

  }

  return blocks;

}


/**
 * ==========================================================
 * TEST — scanFYRepMarketingPlatformBlocks_()
 * ==========================================================
 */
function testScanFYRepMarketingPlatformBlocks(){

  function monthRow(label, value){
    // A, B, C(월1), D(월2) — monthColStart=3, monthColCount=2로 테스트
    return ["", label, value, value * 2];
  }

  const fixture = [
    ["Platform", "Metrics", "", ""],                        // 헤더 행(무시)
    ["Facebook\nCORE\n(NZD)", "Channel Revenue", "", ""],    // 블록1 시작
    monthRow("Amount spent (total) (NZD)", 100),
    monthRow("Leads - consults", 5),
    monthRow("Leads - event", 2),
    monthRow("Leads - content", 1),
    ["Platform", "Metrics", "", ""],                         // FY26류 반복 헤더 — 블록 오판 방지 확인
    ["Google Paid Search\nCORE\n(AUD)", "Channel Revenue", "", ""], // 블록2 시작
    monthRow("Amount spent (total)", 50),                    // 라벨에 통화 표기 없음 — 플랫폼명 AUD로 폴백
    monthRow("Leads - consults", 3),
    monthRow("Leads - event", 0),
    monthRow("Leads - content", 0)
  ];

  const blocks = scanFYRepMarketingPlatformBlocks_(
    fixture, 3, 2, "Amount spent (total)", ["consults", "event", "content"]
  );

  const pass =
    blocks.length === 2 &&
    blocks[0].channel === "Facebook" &&
    blocks[0].spent[0] === 100 && blocks[0].spent[1] === 200 &&
    blocks[0].spentCurrency === "NZD" &&
    blocks[0].leads.consults[0] === 5 &&
    blocks[0].leads.event[0] === 2 &&
    blocks[0].leads.content[0] === 1 &&
    blocks[1].channel === "Google Paid Search" &&
    blocks[1].platformCurrency === "AUD" &&
    blocks[1].spent[0] === 50 &&
    blocks[1].spentCurrency === null && // 라벨 자체엔 통화 표기 없음 — 플랫폼명으로 폴백은 소비 단계 책임
    blocks[1].leads.consults[0] === 3;

  Logger.log("Result: " + JSON.stringify(blocks));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Build FY_REP Marketing Raw Rows (순수 함수)
 *
 * WHY
 * scanFYRepMarketingPlatformBlocks_()가 뽑은 블록별 월간 배열을
 * (채널 × 월) flat 행으로 펼친다. 이 단계까지는 아직 원본 통화 그대로다
 * (NZD 환산은 IO가 필요한 fetchFxRateToNzd_() 호출이 있는 소비 단계에서
 * 수행 — 이 함수는 순수 함수로 유지하기 위해 분리).
 *
 * INPUT
 * blocks : Array<Object>  scanFYRepMarketingPlatformBlocks_() 결과
 * monthLabels : Array<string>  CONFIG.ACQ.FISCAL_MONTH_ORDER(12개, col3=monthLabels[0])
 * defaultCurrency : string  통화 표기가 전혀 없을 때 기본값("NZD")
 *
 * OUTPUT
 * Array<Object>  [{ channel, month, spentRaw, spentCurrency, results }]
 *
 * TEST
 * testBuildFYRepMarketingRawRows() 참고
 * ==========================================================
 */
function buildFYRepMarketingRawRows_(blocks, monthLabels, defaultCurrency){

  const rows = [];

  blocks.forEach(function(block){

    monthLabels.forEach(function(monthLabel, i){

      const spentRaw = block.spent ? (block.spent[i] || 0) : 0;
      const spentCurrency = block.spentCurrency || block.platformCurrency || defaultCurrency;

      let results = 0;

      Object.keys(block.leads).forEach(function(suffix){
        const arr = block.leads[suffix];
        if(arr) results += (arr[i] || 0);
      });

      rows.push({
        channel: block.channel,
        month: monthLabel,
        spentRaw: spentRaw,
        spentCurrency: spentCurrency,
        results: results
      });

    });

  });

  return rows;

}


/**
 * ==========================================================
 * TEST — buildFYRepMarketingRawRows_()
 * ==========================================================
 */
function testBuildFYRepMarketingRawRows(){

  const blocks = [
    {
      channel: "Facebook",
      platformCurrency: null,
      spent: [100, 200],
      spentCurrency: "NZD",
      leads: { consults: [5, 6], event: [2, 0], content: [1, 0] }
    }
  ];

  const rows = buildFYRepMarketingRawRows_(blocks, ["AUG", "SEP"], "NZD");

  const pass =
    rows.length === 2 &&
    rows[0].channel === "Facebook" && rows[0].month === "AUG" &&
    rows[0].spentRaw === 100 && rows[0].spentCurrency === "NZD" &&
    rows[0].results === 8 && // 5+2+1
    rows[1].month === "SEP" && rows[1].results === 6; // 6+0+0

  Logger.log("Result: " + JSON.stringify(rows));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute FY_REP Marketing Rows For FY (IO 래퍼)
 *
 * WHY
 * 외부 `perfTrackerByFY` 스프레드시트의 FY 하나 탭을 읽어 채널×월 Spent
 * (NZD 환산)/Results/CPL 행을 계산한다. 탭이 없으면 빈 배열(방어적 —
 * CONFIG.FYREP.FYS에 새 FY를 추가했는데 아직 탭이 없는 과도기 대비).
 *
 * INPUT
 * fy : number  24/25/26 등 (CONFIG.FYREP.MARKETING_SOURCE.TABS 키)
 *
 * OUTPUT
 * Array<Object>  [{ fy, month, channel, spent(NZD), results, cpl }]
 * ==========================================================
 */
function computeFYRepMarketingRowsForFY_(fy){

  const config = CONFIG.FYREP.MARKETING_SOURCE;
  const tabConfig = config.TABS[fy];

  if(!tabConfig) return [];

  const file = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const sheet = file.getSheetByName(tabConfig.NAME);

  if(!sheet) return [];

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  const numRows = lastRow - tabConfig.PLATFORM_HEADER_ROW + 1;

  if(numRows <= 0) return [];

  const values = sheet.getRange(tabConfig.PLATFORM_HEADER_ROW, 1, numRows, lastCol).getValues();

  const blocks = scanFYRepMarketingPlatformBlocks_(
    values, config.MONTH_COL_START, config.MONTH_COL_COUNT,
    config.METRIC_ROW_LABELS.SPENT_PREFIX, config.LEAD_TYPE_SUFFIXES
  );

  const rawRows = buildFYRepMarketingRawRows_(blocks, CONFIG.ACQ.FISCAL_MONTH_ORDER, config.DEFAULT_CURRENCY);

  const rateCache = {};

  function rateFor(currencyCode){
    if(!(currencyCode in rateCache)) rateCache[currencyCode] = fetchFxRateToNzd_(currencyCode);
    return rateCache[currencyCode];
  }

  return rawRows.map(function(row){

    const spentNZD = row.spentRaw * rateFor(row.spentCurrency);

    return {
      fy: fy,
      month: row.month,
      channel: row.channel,
      spent: spentNZD,
      results: row.results,
      cpl: row.results > 0 ? spentNZD / row.results : ""
    };

  });

}


/**
 * ==========================================================
 * Compute FY_REP Marketing Rows (IO 래퍼)
 *
 * WHY
 * CONFIG.FYREP.FYS(24/25/26)를 전부 순회해 Marketing 섹션 전체 행을
 * 만든다. Report/Write 레이어(다음 커밋)가 이 결과를 그대로 시트에 쓴다.
 *
 * OUTPUT
 * Array<Object>  [{ fy, month, channel, spent, results, cpl }]
 * ==========================================================
 */
function computeFYRepMarketingRows_(){

  const rows = [];

  CONFIG.FYREP.FYS.forEach(function(fy){
    rows.push.apply(rows, computeFYRepMarketingRowsForFY_(fy));
  });

  return rows;

}


/**
 * ==========================================================
 * Aggregate FY_REP Leads_OPS From Records (순수 함수)
 *
 * WHY
 * ACQ 섹션(New Leads/New P1/SAL)과 Pipeline 섹션(IC Booked/IC Completed)이
 * 둘 다 Leads_OPS를 Create Date 기준 FY×Month×Business Segment 코호트로
 * 집계하는 같은 소스·같은 키라 한 번에 계산(NewP1_REP의
 * `computeNewP1Aggregates_()`와 동일한 코호트 파생(`deriveNewP1Cohort_()`)/
 * P1 판정(`isEffectiveP1_()`) 재사용, FT Override 재판정 없음 — 사용자
 * 확정, exec-plan 참고). New Leads는 NewP1_REP엔 없는 지표(전체 리드 수,
 * Priority 무관)라 이 함수가 새로 추가.
 *
 * INPUT
 * records : Array<Object>  sheetToObjects(Leads_OPS 시트) 결과 — 각 레코드는
 *   OPS.HEADER 컬럼명을 키로 가짐("Create Date"/"Business Segment"/
 *   "Lead Priority"/"Priority Override"/"Total IC Requests"/"IC Booked Date"/
 *   "IC Completed Date")
 *
 * OUTPUT
 * Array<Object>  [{ fy, month, segment, newLeads, newP1, sal, icBooked, icComplete }]
 *
 * TEST
 * testAggregateFYRepLeadsOPSFromRecords() 참고
 * ==========================================================
 */
function aggregateFYRepLeadsOPSFromRecords_(records){

  const groups = {};

  records.forEach(function(record){

    const cohort = deriveNewP1Cohort_(record["Create Date"]);

    if(!cohort) return;

    const segment = record["Business Segment"] || "Other";
    const key = cohort.fy + "|" + cohort.month + "|" + segment;

    if(!groups[key]){
      groups[key] = { newLeads: 0, newP1: 0, sal: 0, icBooked: 0, icComplete: 0 };
    }

    const g = groups[key];

    g.newLeads++;

    if(isEffectiveP1_(record["Lead Priority"], record["Priority Override"])) g.newP1++;

    const totalICRequests = Number(record["Total IC Requests"]) || 0;
    if(totalICRequests > 0) g.sal++;

    const icBookedDate = record["IC Booked Date"];
    if(icBookedDate instanceof Date && !isNaN(icBookedDate.getTime())) g.icBooked++;

    const icCompleteDate = record["IC Completed Date"];
    if(icCompleteDate instanceof Date && !isNaN(icCompleteDate.getTime())) g.icComplete++;

  });

  return Object.keys(groups).map(function(key){

    const parts = key.split("|");
    const g = groups[key];

    return {
      fy: Number(parts[0]), month: parts[1], segment: parts[2],
      newLeads: g.newLeads, newP1: g.newP1, sal: g.sal,
      icBooked: g.icBooked, icComplete: g.icComplete
    };

  });

}


/**
 * ==========================================================
 * TEST — aggregateFYRepLeadsOPSFromRecords_()
 * ==========================================================
 */
function testAggregateFYRepLeadsOPSFromRecords(){

  const records = [
    {
      "Create Date": new Date(2026, 7, 1), // 2026-08-01 => FY27, AUG
      "Business Segment": "Search",
      "Lead Priority": "Priority 1",
      "Priority Override": "",
      "Total IC Requests": 1,
      "IC Booked Date": new Date(2026, 7, 5),
      "IC Completed Date": ""
    },
    {
      "Create Date": new Date(2026, 7, 10), // 같은 FY27|AUG|Search 코호트
      "Business Segment": "Search",
      "Lead Priority": "Priority 3",
      "Priority Override": "",
      "Total IC Requests": 0,
      "IC Booked Date": "",
      "IC Completed Date": ""
    },
    {
      "Create Date": "", // 무효 Create Date — 제외돼야 함
      "Business Segment": "Search",
      "Lead Priority": "Priority 1",
      "Priority Override": "",
      "Total IC Requests": 0,
      "IC Booked Date": "",
      "IC Completed Date": ""
    }
  ];

  const result = aggregateFYRepLeadsOPSFromRecords_(records);

  const row = result.find(function(r){ return r.fy === 27 && r.month === "AUG" && r.segment === "Search"; });

  const pass =
    result.length === 1 &&
    row.newLeads === 2 &&
    row.newP1 === 1 &&
    row.sal === 1 &&
    row.icBooked === 1 &&
    row.icComplete === 0;

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute FY_REP Leads_OPS Aggregates (IO 래퍼)
 *
 * WHY
 * Leads_OPS 시트를 읽어 aggregateFYRepLeadsOPSFromRecords_()에 넘긴다.
 * Report 레이어가 이 결과를 ACQ 섹션(New Leads/New P1/SAL)과 Pipeline
 * 섹션(IC Booked/IC Completed)에 나눠서 쓴다.
 *
 * OUTPUT
 * Array<Object>  aggregateFYRepLeadsOPSFromRecords_() 참고
 * ==========================================================
 */
function computeFYRepLeadsOPSAggregates_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(OPS.SHEET.OPS);

  if(!sheet) return [];

  return aggregateFYRepLeadsOPSFromRecords_(sheetToObjects(sheet));

}


/**
 * ==========================================================
 * Derive FY_REP Deal Bucket (순수 함수)
 *
 * WHY
 * Deal Tracker 딜 하나를 Pipeline/Revenue 섹션의 "버킷"(세그먼트 또는
 * Upsell/Referral 전용 라인)으로 분류한다. Upsell/Referral은 Segment
 * 컬럼(Upsell이 "Other"에 섞여 있어 신뢰 불가)이 아니라 Lead Source
 * 컬럼으로 판정 — `CONFIG.TARGET.EXTERNAL.DEAL_TRACKER.EXCLUDE_LEAD_SOURCES`
 * 재사용(00_Config.js FYREP 블록 주석에 이미 이 판정 기준이 명시돼 있음).
 * 그 외 딜은 Business Segment 컬럼 그대로(N/A는 Other로 접음, NewP1_REP의
 * `computeNewP1DealWonRevenueFromRows_()`와 동일 관례).
 *
 * INPUT
 * row : Object  readDealTrackerRawRows_() 행 하나 (leadSource/businessSegment 포함)
 *
 * OUTPUT
 * string  "Upsell" / "Referral" / Business Segment 값 / "Other"
 *
 * TEST
 * testDeriveFYRepDealBucket() 참고
 * ==========================================================
 */
function deriveFYRepDealBucket_(row){

  const excludeList = CONFIG.TARGET.EXTERNAL.DEAL_TRACKER.EXCLUDE_LEAD_SOURCES;
  const leadSource = String(row.leadSource || "").toLowerCase().trim();

  if(excludeList.indexOf(leadSource) !== -1){
    return leadSource.charAt(0).toUpperCase() + leadSource.slice(1);
  }

  return row.businessSegment === "N/A" ? "Other" : (row.businessSegment || "Other");

}


/**
 * ==========================================================
 * TEST — deriveFYRepDealBucket_()
 * ==========================================================
 */
function testDeriveFYRepDealBucket(){

  const cases = [
    [{ leadSource: "Upsell", businessSegment: "Other" }, "Upsell"],
    [{ leadSource: "Referral", businessSegment: "Search" }, "Referral"],
    [{ leadSource: "Paid Search", businessSegment: "Search" }, "Search"],
    [{ leadSource: "Paid Search", businessSegment: "N/A" }, "Other"],
    [{ leadSource: "", businessSegment: "" }, "Other"]
  ];

  let pass = true;

  cases.forEach(function(c){
    const result = deriveFYRepDealBucket_(c[0]);
    if(result !== c[1]){
      pass = false;
      Logger.log("❌ FAIL: deriveFYRepDealBucket_(" + JSON.stringify(c[0]) + ") = '" + result + "', expected '" + c[1] + "'");
    }
  });

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Aggregate FY_REP Deal Counts From Rows (순수 함수)
 *
 * WHY
 * Pipeline 섹션의 Deals(건수)를 Deal Tracker 딜의 Created Date 코호트
 * 기준으로 집계한다(Close Date 아님 — `computeNewP1DealWonRevenueFromRows_()`
 * 와 동일 패턴, exec-plan §"ACQ / Pipeline 섹션(Actual)" 확정 사항).
 * Revenue 섹션도 이 함수를 그대로 재사용 예정(건수 대신 금액 합산만
 * 다르면 되므로 — 다음 커밋).
 *
 * INPUT
 * dealRows : Array<Object>  readDealTrackerRawRows_() 결과
 *
 * OUTPUT
 * Object  키 "fy|month|bucket" → 건수
 *
 * TEST
 * testAggregateFYRepDealCountsFromRows() 참고
 * ==========================================================
 */
function aggregateFYRepDealCountsFromRows_(dealRows){

  const counts = {};

  dealRows.forEach(function(row){

    if(!row.createdDate) return;

    const bucket = deriveFYRepDealBucket_(row);
    const key = row.createdFY + "|" + getFiscalMonthLabel(row.createdDate) + "|" + bucket;

    counts[key] = (counts[key] || 0) + 1;

  });

  return counts;

}


/**
 * ==========================================================
 * TEST — aggregateFYRepDealCountsFromRows_()
 * ==========================================================
 */
function testAggregateFYRepDealCountsFromRows(){

  const dealRows = [
    { createdDate: new Date(2026, 7, 1), createdFY: 27, leadSource: "Paid Search", businessSegment: "Search" },
    { createdDate: new Date(2026, 7, 15), createdFY: 27, leadSource: "Paid Search", businessSegment: "Search" },
    { createdDate: new Date(2026, 7, 3), createdFY: 27, leadSource: "Upsell", businessSegment: "Other" },
    { createdDate: null, createdFY: null, leadSource: "Paid Search", businessSegment: "Search" }
  ];

  const counts = aggregateFYRepDealCountsFromRows_(dealRows);

  const pass =
    counts["27|AUG|Search"] === 2 &&
    counts["27|AUG|Upsell"] === 1 &&
    Object.keys(counts).length === 2;

  Logger.log("Result: " + JSON.stringify(counts));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute FY_REP Pipeline Deal Counts (IO 래퍼)
 *
 * WHY
 * Deal Tracker 캐시(DealTracker_Engine)를 읽어 Pipeline 섹션의 Deals
 * (건수) 맵을 만든다.
 *
 * OUTPUT
 * Object  aggregateFYRepDealCountsFromRows_() 참고 — 키 "fy|month|bucket" → 건수
 * ==========================================================
 */
function computeFYRepPipelineDealCounts_(){

  return aggregateFYRepDealCountsFromRows_(readDealTrackerRawRows_());

}


/**
 * ==========================================================
 * Parse Quarterly Summary Month Label (순수 함수)
 *
 * WHY
 * perfTrackerByFY Quarterly Summary(B열)에는 월 라벨("AUGUST"/"August
 * 2026")과 분기·연간 요약 라벨("Q1"/"YTD"/빈 문자열)이 섞여 있다 — 월
 * 이름으로 시작하는 라벨만 3글자 피스컬 월 코드로 변환하고, 나머지는
 * null(스킵 대상)을 반환한다.
 *
 * INPUT
 * label : string  B열 원본 텍스트
 *
 * OUTPUT
 * string|null  "AUG" 등 3글자 코드, 월이 아니면 null
 *
 * TEST
 * testParseQuarterlySummaryMonthLabel() 참고
 * ==========================================================
 */
function parseQuarterlySummaryMonthLabel_(label){

  const text = String(label || "").trim();

  if(text === "") return null;

  const monthNames = [
    "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
    "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
  ];

  const firstWord = text.split(" ")[0].toUpperCase();

  return monthNames.indexOf(firstWord) === -1 ? null : firstWord.slice(0, 3);

}


/**
 * ==========================================================
 * TEST — parseQuarterlySummaryMonthLabel_()
 * ==========================================================
 */
function testParseQuarterlySummaryMonthLabel(){

  const cases = [
    ["AUGUST", "AUG"],
    ["August 2026", "AUG"],
    ["Q1", null],
    ["YTD", null],
    ["", null]
  ];

  let pass = true;

  cases.forEach(function(c){
    const result = parseQuarterlySummaryMonthLabel_(c[0]);
    if(result !== c[1]){
      pass = false;
      Logger.log("❌ FAIL: parseQuarterlySummaryMonthLabel_('" + c[0] + "') = " + result + ", expected " + c[1]);
    }
  });

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Scan FY_REP Quarterly Summary Revenue Targets (순수 함수)
 *
 * WHY
 * Quarterly Summary 구간(1행~플랫폼 헤더 행 직전) 값을 스캔해 월별 Revenue
 * Target을 뽑아낸다. 분기/연간 요약 행은 parseQuarterlySummaryMonthLabel_()가
 * null을 반환해 자동으로 건너뜀.
 *
 * INPUT
 * values : Array<Array>  getRange(1, 1, n, lastCol).getValues() 그대로
 * monthLabelCol : number  1-based (B=2)
 * revenueTargetCol : number  1-based (C=3)
 *
 * OUTPUT
 * Object  키 "AUG" 등 3글자 월 코드 → Revenue Target 금액
 *
 * TEST
 * testScanFYRepQuarterlySummaryRevenueTargets() 참고
 * ==========================================================
 */
function scanFYRepQuarterlySummaryRevenueTargets_(values, monthLabelCol, revenueTargetCol){

  const result = {};

  values.forEach(function(row){

    const monthCode = parseQuarterlySummaryMonthLabel_(row[monthLabelCol - 1]);

    if(!monthCode) return;

    result[monthCode] = parseCurrencyValue_(row[revenueTargetCol - 1]);

  });

  return result;

}


/**
 * ==========================================================
 * TEST — scanFYRepQuarterlySummaryRevenueTargets_()
 * ==========================================================
 */
function testScanFYRepQuarterlySummaryRevenueTargets(){

  const values = [
    ["", "", "Targets", "", ""],
    ["", "", "Revenue Target", "ROAS Target", ""],
    ["", "Q1", "$1,439,487", "6", ""],
    ["", "AUGUST", "$507,487", "6", ""],
    ["", "SEPTEMBER", "$466,000", "6", ""]
  ];

  const result = scanFYRepQuarterlySummaryRevenueTargets_(values, 2, 3);

  const pass =
    Object.keys(result).length === 2 &&
    result.AUG === 507487 &&
    result.SEP === 466000;

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute FY_REP Company Revenue Targets For FY (IO 래퍼)
 *
 * WHY
 * perfTrackerByFY의 FY 하나 탭 Quarterly Summary를 읽어 월별 회사 전체
 * Revenue Target을 만든다. Marketing 섹션과 같은 탭·같은 스프레드시트를
 * 다시 연다(호출 빈도가 리포트 생성 시 1회뿐이라 별도 캐싱 없음).
 *
 * INPUT
 * fy : number
 *
 * OUTPUT
 * Object  키 "AUG" 등 → Revenue Target 금액
 * ==========================================================
 */
function computeFYRepCompanyRevenueTargetsForFY_(fy){

  const marketingConfig = CONFIG.FYREP.MARKETING_SOURCE;
  const quarterlyConfig = CONFIG.FYREP.QUARTERLY_SUMMARY;
  const tabConfig = marketingConfig.TABS[fy];

  if(!tabConfig) return {};

  const file = SpreadsheetApp.openById(marketingConfig.SPREADSHEET_ID);
  const sheet = file.getSheetByName(tabConfig.NAME);

  if(!sheet) return {};

  const lastCol = sheet.getLastColumn();
  const numRows = tabConfig.PLATFORM_HEADER_ROW - 1;

  if(numRows <= 0) return {};

  const values = sheet.getRange(1, 1, numRows, lastCol).getValues();

  return scanFYRepQuarterlySummaryRevenueTargets_(
    values, quarterlyConfig.MONTH_LABEL_COL, quarterlyConfig.REVENUE_TARGET_COL
  );

}


/**
 * ==========================================================
 * Aggregate FY_REP Deal Revenue From Rows (순수 함수)
 *
 * WHY
 * Revenue 섹션의 Actual Revenue를 Deal Tracker 딜의 **Close Date 기준
 * 그 달 실제 발생액**으로 집계한다 — **2026-08-08 사용자 확정**: 처음엔
 * NewP1_REP과 같은 Created Date 코호트 방식으로 구현했으나, "코호트가
 * 아니라 ACQ_REP의 Revenue처럼 그 달에 실제로 얼마를 했는지를 봐야
 * 한다"는 피드백으로 Close Date 기준으로 전환(ACQ_REP의
 * `computeACQDealRevenueFromRows_()`와 동일 사상). Pipeline 섹션의
 * Deals(건수, `aggregateFYRepDealCountsFromRows_()`)는 여전히 Created
 * Date 코호트 그대로 — 이 함수만 바뀜(사용자 피드백이 Revenue 한정).
 * 부수 효과: `closeDate`는 Deal Tracker 캐시에서 항상 유효한 값(Close
 * Date가 없으면 애초에 캐시에 안 들어감)이라, NewP1_REP이 갖고 있던
 * "Referral 딜 다수가 Created Date 결측이라 과소집계"(docs/OpenItems.md)
 * 문제를 이 지표는 겪지 않음.
 *
 * INPUT
 * dealRows : Array<Object>  readDealTrackerRawRows_() 결과
 *
 * OUTPUT
 * Object  키 "fy|month|bucket" → Revenue 합계
 *
 * TEST
 * testAggregateFYRepDealRevenueFromRows() 참고
 * ==========================================================
 */
function aggregateFYRepDealRevenueFromRows_(dealRows){

  const revenue = {};

  dealRows.forEach(function(row){

    if(!row.closeDate) return;

    const bucket = deriveFYRepDealBucket_(row);
    const key = row.closeFY + "|" + getFiscalMonthLabel(row.closeDate) + "|" + bucket;

    revenue[key] = (revenue[key] || 0) + (Number(row.revenue) || 0);

  });

  return revenue;

}


/**
 * ==========================================================
 * TEST — aggregateFYRepDealRevenueFromRows_()
 * ==========================================================
 */
function testAggregateFYRepDealRevenueFromRows(){

  const dealRows = [
    { closeDate: new Date(2026, 7, 1), closeFY: 27, revenue: 1000, leadSource: "Paid Search", businessSegment: "Search" },
    { closeDate: new Date(2026, 7, 15), closeFY: 27, revenue: 500, leadSource: "Paid Search", businessSegment: "Search" },
    { closeDate: new Date(2026, 7, 3), closeFY: 27, revenue: 2000, leadSource: "Upsell", businessSegment: "Other" },
    { closeDate: null, closeFY: null, revenue: 999, leadSource: "Paid Search", businessSegment: "Search" }
  ];

  const revenue = aggregateFYRepDealRevenueFromRows_(dealRows);

  const pass =
    revenue["27|AUG|Search"] === 1500 &&
    revenue["27|AUG|Upsell"] === 2000 &&
    Object.keys(revenue).length === 2;

  Logger.log("Result: " + JSON.stringify(revenue));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute FY_REP Deal Share Ratios For FY (순수 함수)
 *
 * WHY
 * Revenue 섹션의 세그먼트별 Target 배분 비중을 계산한다.
 * `90_TargetEngine.js`의 `computeDealShareRatiosFromDealRows_()`와 달리
 * (a) 단일 하드코딩 `CONFIG.TARGET.P1_VALUE_FY`가 아니라 임의의 targetFY를
 * 받고, (b) Upsell/Referral을 분모·분자에서 제외하지 않는다 — **2026-08-08
 * 사용자 확정**: FY_REP은 7세그먼트+Upsell 전체를 대상으로 배분(마케팅
 * 기여분만 배분하는 Target_Engine의 5세그먼트 방침과 다름, 00_Config.js
 * FYREP.REVENUE_TARGET_IS_ESTIMATED 주석 참고). 버킷 판정은
 * `deriveFYRepDealBucket_()` 재사용(Pipeline Deals 건수와 동일 기준).
 *
 * INPUT
 * dealRows : Array<Object>  readDealTrackerRawRows_() 결과
 * targetFY : number
 *
 * OUTPUT
 * Object  키 버킷명 → 비중(0~1), 코호트1(그 FY에 생성되고 그 FY에 클로징된
 *   딜)에 실제로 등장한 버킷만 포함
 *
 * TEST
 * testComputeFYRepDealShareRatiosForFY() 참고
 * ==========================================================
 */
function computeFYRepDealShareRatiosForFY_(dealRows, targetFY){

  let base = 0;
  const byBucket = {};

  dealRows.forEach(function(row){

    if(row.closeFY !== targetFY || row.createdFY !== targetFY) return; // 코호트1만

    const bucket = deriveFYRepDealBucket_(row);
    const revenue = Number(row.revenue) || 0;

    base += revenue;
    byBucket[bucket] = (byBucket[bucket] || 0) + revenue;

  });

  const result = {};

  Object.keys(byBucket).forEach(function(bucket){
    result[bucket] = base > 0 ? byBucket[bucket] / base : 0;
  });

  return result;

}


/**
 * ==========================================================
 * TEST — computeFYRepDealShareRatiosForFY_()
 * ==========================================================
 */
function testComputeFYRepDealShareRatiosForFY(){

  const dealRows = [
    { closeFY: 27, createdFY: 27, revenue: 100, leadSource: "Paid Search", businessSegment: "Search" },
    { closeFY: 27, createdFY: 27, revenue: 300, leadSource: "Paid Search", businessSegment: "Content" },
    { closeFY: 27, createdFY: 27, revenue: 100, leadSource: "Upsell", businessSegment: "Other" },
    { closeFY: 26, createdFY: 26, revenue: 9999, leadSource: "Paid Search", businessSegment: "Search" }, // 다른 FY — 제외
    { closeFY: 27, createdFY: 26, revenue: 9999, leadSource: "Paid Search", businessSegment: "Search" }  // 코호트2 — 제외
  ];

  const result = computeFYRepDealShareRatiosForFY_(dealRows, 27);

  const pass =
    Math.abs(result.Search - 0.2) < 1e-9 &&   // 100 / 500
    Math.abs(result.Content - 0.6) < 1e-9 &&  // 300 / 500
    Math.abs(result.Upsell - 0.2) < 1e-9 &&   // 100 / 500 — Upsell도 배분 대상(사용자 확정)
    Object.keys(result).length === 3;

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Compute FY_REP Revenue Rows (IO 래퍼)
 *
 * WHY
 * Revenue 섹션 전체 행(FY×Month×버킷 — 7세그먼트+Upsell)을 만든다. Target은
 * 회사 전체 월별 Target(Quarterly Summary) × 그 FY 딜 비중(코호트1) 추정치,
 * Actual은 Deal Tracker Created Date 코호트 Revenue 실적. 버킷 목록은
 * 그 FY의 코호트1 비중 계산에 등장한 것과, Actual에 등장한 것의 합집합
 * (한쪽에만 있어도 행이 만들어짐 — NewP1_REP의 hasOwnProperty 기반 "공란
 * vs 0" 관례와 동일 사상).
 *
 * OUTPUT
 * Array<Object>  [{ fy, month, segment, target(추정), actual }]
 * ==========================================================
 */
function computeFYRepRevenueRows_(){

  const dealRows = readDealTrackerRawRows_();
  const dealRevenue = aggregateFYRepDealRevenueFromRows_(dealRows);

  const rows = [];

  CONFIG.FYREP.FYS.forEach(function(fy){

    const companyTargets = computeFYRepCompanyRevenueTargetsForFY_(fy);
    const shareRatios = computeFYRepDealShareRatiosForFY_(dealRows, fy);

    const bucketSet = {};

    Object.keys(shareRatios).forEach(function(bucket){ bucketSet[bucket] = true; });

    Object.keys(dealRevenue).forEach(function(key){
      const parts = key.split("|");
      if(Number(parts[0]) === fy) bucketSet[parts[2]] = true;
    });

    const buckets = Object.keys(bucketSet);

    CONFIG.ACQ.FISCAL_MONTH_ORDER.forEach(function(month){

      const companyTarget = companyTargets[month] || 0;

      buckets.forEach(function(bucket){

        const key = fy + "|" + month + "|" + bucket;
        const ratio = shareRatios[bucket] || 0;

        rows.push({
          fy: fy,
          month: month,
          segment: bucket,
          target: companyTarget * ratio,
          actual: dealRevenue[key] || 0
        });

      });

    });

  });

  return rows;

}


/**
 * ==========================================================
 * Compute FY_REP Default FY List (순수 함수)
 *
 * WHY
 * `CONFIG.FYREP.FYS`가 [24,25,26]으로 하드코딩돼 있으면 매 FY 전환마다
 * (8월) 수동으로 배열을 늘려줘야 한다 — 사용자 요청(2026-08-08, "이후
 * 년도도 자동으로 추가되게 하자")으로 startFY부터 **오늘이 속한 FY까지**
 * 자동으로 채운다. 00_Config.js가 매 실행마다 새로 로드/평가되므로(Apps
 * Script는 실행마다 스크립트 전체를 다시 로드) 이 함수 결과도 실행 시점
 * 기준으로 매번 다시 계산됨 — 코드 수정 없이 해가 바뀌면 자동 반영.
 *
 * INPUT
 * startFY : number  비교 시작 FY(고정, 예 24)
 * asOfDate : Date|undefined  기준 날짜(테스트용, 생략 시 오늘)
 *
 * OUTPUT
 * Array<number>  startFY ~ 오늘이 속한 FY(포함), 오름차순
 *
 * TEST
 * testComputeFYRepDefaultFYList() 참고
 * ==========================================================
 */
function computeFYRepDefaultFYList_(startFY, asOfDate){

  const referenceDate = asOfDate || new Date();
  const currentFY = Number(getFiscalYear(referenceDate).replace("FY", ""));

  const list = [];

  for(let fy = startFY; fy <= currentFY; fy++){
    list.push(fy);
  }

  return list;

}


/**
 * ==========================================================
 * TEST — computeFYRepDefaultFYList_()
 * ==========================================================
 */
function testComputeFYRepDefaultFYList(){

  const cases = [
    [new Date(2026, 7, 8), [24, 25, 26, 27]],  // 2026-08-08 => FY27
    [new Date(2026, 6, 31), [24, 25, 26]],     // 2026-07-31 => FY26(피스컬 연도 시작 전날)
    [new Date(2025, 0, 15), [24, 25]]          // 2025-01-15 => FY25
  ];

  let pass = true;

  cases.forEach(function(c){
    const result = computeFYRepDefaultFYList_(24, c[0]);
    if(JSON.stringify(result) !== JSON.stringify(c[1])){
      pass = false;
      Logger.log("❌ FAIL: " + c[0] + " => " + JSON.stringify(result) + ", expected " + JSON.stringify(c[1]));
    }
  });

  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}
