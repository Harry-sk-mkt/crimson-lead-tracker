/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — 2026년 7월 New P1 불일치 확인 (ACQ_REP vs Salesforce)
 *
 * Responsibility
 * ACQ_REP의 2026-07 **New P1**(I열, Leads_OPS 기준 유효 Priority="Priority 1"
 * 카운트, isEffectiveP1_(), computeOPSAggregates_() 참고)가 183건인데,
 * 사용자가 확인한 Salesforce 자체 리포트(Priority 1로 필터한 Lead 개수)는
 * 205건 — docs/OpenItems.md #20. **2026-08-05 정정**: 최초엔 "New Leads"
 * (전체 Lead 수) 비교로 오인하고 시작했으나, 사용자 확인 결과 양쪽 다
 * Priority 1로 필터된 값이었음 — 아래 v1.1.0/v1.2.0 결과(Leads_Master/
 * Leads_OPS 전체 Lead 대조)는 배경 조사로 유효하지만 원래 질문(New P1)에
 * 대한 직접 답은 아니었음, v1.3.0의 runCheckJulyNewP1GapInOPS()가 정확한
 * 비교.
 *
 * 93_TempQA_DealTrackerMatch.js/25_TempQA_BusinessSegment.js와 동일한
 * 1회성/수시 재실행 패턴 — 다만 워크북 셀 개수 상한 문제
 * (docs/apps-script-gotchas.md #8) 재발 방지로 새 시트는 만들지 않고
 * Logger.log로만 결과를 출력한다.
 *
 * WHY
 * 두 숫자의 차이를 추측으로 설명하지 않고, 실제로 빠진 Lead ID를
 * 하나하나 확인해서 원인(우리 파이프라인에 아예 없는지/Create Date가
 * 다르게 찍혀 7월 범위 밖으로 빠졌는지/Priority 판정이 다른지 등)을
 * 실측으로 좁히기 위함.
 *
 * Version
 * v1.4.0
 *
 * Change Log
 * v1.4.0 (2026-08-05)
 * - **3차 실행 결과 — 원인 후보 확정적으로 좁혀짐**: runCheckJulyNewP1GapInOPS()
 *   라이브 재계산 결과도 183(ACQ_REP과 정확히 일치, 캐시/Report 갱신 문제 아님
 *   확인됨 — 사용자가 Generate 재실행 후에도 183 그대로였음). 누락 24건 중
 *   23건이 Leads_OPS에 **"Priority 3"로 존재**(Salesforce는 Priority 1로 봄),
 *   1건은 Leads_OPS에 아예 없음. `22_OPS_Merge.js`의 `mergeOPS()`("Earliest-wins
 *   dedup", Email 기준 그룹핑 후 Create Date가 가장 이른 행만 채택)가 원래
 *   "같은 이메일의 서로 다른 Lead ID"(진짜 재신청) 구분용으로 설계됐는데, 같은
 *   Lead ID가 여러 번 재export되어 Leads_Master에 중복 행이 쌓인 경우(위 v1.1.0
 *   발견 — 7월만 1,266행/205 고유)에도 이 로직을 그대로 타면서, Create Date가
 *   동일한 중복들 사이에서는 배열 순서(group[0], 사실상 가장 먼저 import된
 *   오래된 스냅샷)로 판가름 나 **최신 Priority 값이 아니라 오래된 스냅샷의
 *   Priority가 채택됐을 가능성**을 발견 — 아직 가설 단계, Leads_Master 원본에서
 *   실제로 이 23건에 Priority 1 스냅샷이 존재하는지(=merge가 잘못 고른 것) 아니면
 *   애초에 없는지(=단순 export 지연) 확인 전. 신규
 *   `runDumpPriorityMismatchLeadHistory()` + `MISMATCHED_PRIORITY_LEAD_IDS`
 *   추가 — 이 23+1건의 Leads_Master 전체 중복 히스토리(모든 rowIndex별 Lead
 *   Priority/Priority Override)를 덤프해 실측으로 확인.
 * v1.3.0 (2026-08-05)
 * - **범위 정정 + 진짜 비교 구현**: 사용자 확인 결과 원래 질문은 "New Leads"
 *   전체가 아니라 **New P1**(ACQ_REP I열) vs Salesforce Priority 1 필터
 *   205건 비교였음(위 Responsibility 정정 참고). `runRefreshACQSummary()`
 *   재실행(672행, 34.55초) 후에도 ACQ_REP New P1이 183 그대로였다는 사용자
 *   보고 — `generateACQReport_()`(Report Area 실제 표시 갱신)는
 *   `refreshACQSummary_()`(숨은 캐시 갱신)와 별개 단계이고 ACQ_REP의 E2
 *   체크박스(onEdit)로만 트리거되므로, 캐시만 갱신하고 Report Area를 다시
 *   Generate 안 했다면 화면엔 이전 값이 그대로 남아있을 수 있음(가설,
 *   미확정) — 별개로 신규 runCheckJulyNewP1GapInOPS() 추가: Leads_OPS 7월
 *   행을 isEffectiveP1_()(30_ACQReport.js, 기존 함수 재사용)로 직접 필터링해
 *   Salesforce P1 목록과 대조 — 캐시/Report 갱신 여부와 무관하게 라이브
 *   데이터 기준 진짜 답을 확인.
 * v1.2.0 (2026-08-05)
 * - **2차 실행 결과 — 방향이 반전됨**: runCheckJulyNewLeadsGapInOPS() 결과 Leads_OPS
 *   7월 Create Date 건수가 **619건**(missingFromOurs 1건뿐, Salesforce 205건 거의 전부
 *   존재) — 즉 Leads_OPS 기준으로는 우리 쪽이 Salesforce보다 훨씬 많음(183 < 206이
 *   아니라 619 > 206). ACQ_REP의 "183"은 Leads_OPS를 매번 직접 스캔하지 않고
 *   `ACQ_Summary` 캐시 테이블(`refreshACQSummary_()`, `docs/ACQReportDesign.md` "⚡
 *   성능 아키텍처")을 읽으므로, 183은 그 캐시가 마지막으로 갱신된 시점의 스냅샷일
 *   가능성이 큼 — 사용자에게 `runRefreshACQSummary()` 재실행 후 재확인 요청 예정.
 *   Leads_OPS 자체의 중복 배율도 확인할 수 있게 runCheckJulyNewLeadsGapInOPS()에
 *   computeIdOccurrenceCounts_() 기반 로그 추가(아직 실행 전).
 * v1.1.0 (2026-08-05)
 * - **1차 실행 결과 — 예상 밖 발견**: runCheckJulyNewLeadsGap() 결과 Leads_Master
 *   7월 Create Date 행이 1,266건(!)이었고 Salesforce 205건 전부가 그 안에 존재함
 *   (missingFromOurs 0건) — 즉 Leads_Master 자체에 대량 중복이 있다는 뜻. 하지만
 *   실제 ACQ_REP New Leads(183건)는 Leads_Master가 아니라 Leads_OPS를 읽으므로
 *   (computeOPSAggregates_(), 30_ACQReport.js), 진짜 183 vs 206 갭의 원인은
 *   Leads_Master→Leads_OPS 병합 과정에 있을 가능성이 큼 — 신규
 *   runCheckJulyNewLeadsGapInOPS()(Leads_OPS 기준 동일 대조) +
 *   computeIdOccurrenceCounts_()(순수 함수, Leads_Master 중복 배율 정량화) 추가.
 * v1.0.0 (2026-08-05)
 * - 최초 구현. computeLeadIdGap_()(순수 함수, 두 Lead ID 목록 집합 대조) +
 *   runCheckJulyNewLeadsGap()(Leads_Master 7월 Create Date 행을 읽어
 *   Salesforce 목록과 대조, 빠진 Lead의 Leads_Master 내 실제 상태도 같이 출력).
 * ==========================================================
 */


// 사용자가 Salesforce에서 직접 export한 2026-07 Lead ID 205개 — 전부 Priority 1
// (2026-08-05 제공, 같은 날 후속 확인: New Leads 전체가 아니라 New P1 비교였음)
const SALESFORCE_JULY_2026_LEAD_IDS = [
  "00QRC00001FE5za","00QRC00001FGEPG","00QRC00001FJeQQ","00QRC00001FMwlm","00QRC00001FOh9A",
  "00QRC00001FSOhN","00QRC00001FVuw2","00QRC00001FYSyP","00QRC00001FcZ8T","00QRC00001FcxnV",
  "00QRC00001Fei2n","00QRC00001FflrR","00QRC00001FgCEw","00QRC00001Fgff7","00QRC00001FhlLl",
  "00QRC00001FiPg5","00QRC00001Fivkb","00QRC00001Fj3On","00QRC00001FlC6D","00QRC00001FlzWk",
  "00QRC00001FmSiP","00QRC00001FmUu0","00QRC00001Fnizd","00QRC00001FpOC2","00QRC00001FpeiE",
  "00QRC00001FtAvF","00QRC00001FsysU","00QRC00001FuNdW","00QRC00001FutVJ","00QRC00001FwsQH",
  "00QRC00001FwsZx","00QRC00001GSIRh","00QRC00001GTIvt","00QRC00001GURvW","00QRC00001GWwtZ",
  "00QRC00001GaJ43","00QRC00001GeGKT","00QRC00001GeArm","00QRC00001GlK1Z","00QRC00001GloUH",
  "00QRC00001GnNg5","00QRC00001GnyPV","00QRC00001Gtp0A","00QRC00001GvBxt","00QRC00001GwkVN",
  "00QRC00001Gx4h0","00QRC00001Gzc1p","00QRC00001GznN3","00QRC00001H0TZq","00QRC00001H0Z58",
  "00QRC00001H0lO9","00QRC00001H2FLf","00QRC00001H1yeA","00QRC00001H2HiP","00QRC00001H333t",
  "00QRC00001HHe6n","00QRC00001HHiQX","00QRC00001HHkqX","00QRC00001HI5LV","00QRC00001HI8fx",
  "00QRC00001HJnKT","00QRC00001HKsZp","00QRC00001HLgEr","00QRC00001HLIHO","00QRC00001HM9f4",
  "00QRC00001HMsST","00QRC00001HNQig","00QRC00001HObvO","00QRC00001HOzw5","00QRC00001HProQ",
  "00QRC00001HRP6T","00QRC00001HRbM9","00QRC00001HRfKv","00QRC00001HRa6l","00QRC00001HRjy2",
  "00QRC00001HWe4r","00QRC00001HZAJx","00QRC00001HiQ4X","00QRC00001Hj3tu","00QRC00001Hkdk1",
  "00QRC00001Hl5Mv","00QRC00001HlxK6","00QRC00001Hn4pm","00QRC00001Hn7fZ","00QRC00001Hn6d5",
  "00QRC00001Hod77","00QRC00001HsPf3","00QRC00001HtpE6","00QRC00001HxF0j","00QRC00001HxOYg",
  "00QRC00001I0KTh","00QRC00001I0lvK","00QRC00001I1g7B","00QRC00001I1u5J","00QRC00001I2tf5",
  "00QRC00001I4xY6","00QRC00001I4qMw","00QRC00001I68jC","00QRC00001I7Qfd","00QRC00001IAcsL",
  "00QRC00001IBFYj","00QRC00001IBd81","00QRC00001IEFVl","00QRC00001IETGz","00QRC00001IJV3d",
  "00QRC00001ILDDt","00QRC00001ILXUM","00QRC00001IQ0sj","00QRC00001IV4yv","00QRC00001IVPLp",
  "00QRC00001IVRgz","00QRC00001IY793","00QRC00001IYE45","00QRC00001IaKVB","00QRC00001IaTQQ",
  "00QRC00001Ic27Z","00QRC00001IceHi","00QRC00001Icjyx","00QRC00001Id4dZ","00QRC00001IeL4T",
  "00QRC00001IgkTN","00QRC00001IiomD","00QRC00001Imznt","00QRC00001InEn0","00QRC00001ItHjh",
  "00QRC00001Ix0lt","00QRC00001IyzKH","00QRC00001IzRej","00QRC00001J10NV","00QRC00001J3kqr",
  "00QRC00001J4Aa2","00QRC00001J5sif","00QRC00001J6YZp","00QRC00001J8AYE","00QRC00001JAlWt",
  "00QRC00001JDwp7","00QRC00001JFQUz","00QRC00001JGIFG","00QRC00001JHjrh","00QRC00001JHJys",
  "00QRC00001JIUyf","00QRC00001FRZ2C","00QRC00001FYFTJ","00QRC00001GZubt","00QRC00001Gejkf",
  "00QRC00001HxBoM","00QRC00001ILvy5","00QRC00001ILvy6","00QRC00001IxwbO","00QRC00001FVpzZ",
  "00QRC00001FnFHh","00QRC00001Ft8LZ","00QRC00001H6T8H","00QRC00001FR4j7","00QRC00001FRzEL",
  "00QRC00001FoWwQ","00QRC00001FvW8T","00QRC00001GXjz7","00QRC00001GbmlV","00QRC00001GbvQc",
  "00QRC00001GiZZp","00QRC00001Gurxa","00QRC00001GvFGj","00QRC00001GvObl","00QRC00001HE3N7",
  "00QRC00001HbEMg","00QRC00001HjVDR","00QRC00001IUkqX","00QRC00001IfGvZ","00QRC00001IgsIr",
  "00QRC00001IrjKH","00QRC00001IvJSr","00QRC00001JD1cN","00QRC00001J9Xm5","00QRC00001FyDXW",
  "00QRC00001GaSDl","00QRC00001GjyeD","00QRC00001Gipxy","00QRC00001GwG13","00QRC00001HTOuH",
  "00QRC00001HZENa","00QRC00001IUT05","00QRC00001Imc3J","00QRC00001J9lc9","00QRC00001Fvldm",
  "00QRC00001HYnvF","00QRC00001Iidij","00QRC00001Gdsej","00QRC00001FPWMv","00QRC00001FV8Ze",
  "00QRC00001FZ97J","00QRC00001FZUdB","00QRC00001GpM4s","00QRC00001H9eJX","00QRC00001HVvHS",
  "00QRC00001Hfa22","00QRC00001HnECP","00QRC00001HqBzZ","00QRC00001HqDF0","00QRC00001Hr13h",
  "00QRC00001IgKXJ","00QRC00001Ixfc9","00QRC00001FLy4r","00QRC00001IoI5J","00QRC00001IlBQ9"
];


/**
 * ==========================================================
 * Compute Lead ID Gap (순수 함수)
 *
 * WHY
 * 두 Lead ID 목록(Salesforce vs 우리 쪽)을 집합으로 비교해 양방향 차집합을
 * 계산한다 — 순수 함수라 실제 시트를 안 건드리고 단위 테스트 가능.
 *
 * INPUT
 * salesforceIds : Array<string>
 * ourIds : Array<string>
 *
 * OUTPUT
 * { missingFromOurs: Array<string>, extraInOurs: Array<string> }
 *
 * TEST
 * testComputeLeadIdGap() 참고
 * ==========================================================
 */
function computeLeadIdGap_(salesforceIds, ourIds){

  const sfSet = {};
  salesforceIds.forEach(function(id){ sfSet[id] = true; });

  const ourSet = {};
  ourIds.forEach(function(id){ ourSet[id] = true; });

  const missingFromOurs = salesforceIds.filter(function(id){ return !ourSet[id]; });
  const extraInOurs = ourIds.filter(function(id){ return !sfSet[id]; });

  return { missingFromOurs: missingFromOurs, extraInOurs: extraInOurs };

}


/**
 * ==========================================================
 * TEST — computeLeadIdGap_()
 * ==========================================================
 */
function testComputeLeadIdGap(){

  const result = computeLeadIdGap_(["A", "B", "C"], ["B", "C", "D"]);

  const pass =
    JSON.stringify(result.missingFromOurs) === JSON.stringify(["A"]) &&
    JSON.stringify(result.extraInOurs) === JSON.stringify(["D"]);

  Logger.log("result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * TEMP — 2026년 7월 New Leads 불일치 확인(수동 실행)
 *
 * WHY
 * SALESFORCE_JULY_2026_LEAD_IDS(206건)와 Leads_Master의 7월 Create Date
 * Lead ID 목록을 대조 — 빠진 Lead ID마다 Leads_Master에 아예 없는지,
 * 있다면 실제 Create Date가 뭔지 같이 출력해서 원인을 추측이 아니라
 * 실측으로 좁힌다. readLeadsMasterRowsWithIndex_()(24_OPSQA.js) 재사용.
 * ==========================================================
 */
function runCheckJulyNewLeadsGap(){

  const rowsWithIndex = readLeadsMasterRowsWithIndex_();

  const rangeStart = new Date(2026, 6, 1);        // 2026-07-01
  const rangeEndExclusive = new Date(2026, 7, 1);  // 2026-08-01 (미포함)

  const julyLeadIds = [];
  const leadIdToRecord = {};

  rowsWithIndex.forEach(function(item){

    const leadId = String(item.record["Lead ID"] || "").trim();
    if(!leadId) return;

    leadIdToRecord[leadId] = item.record;

    const createDate = item.record["Create Date"];

    if(createDate instanceof Date && !isNaN(createDate.getTime()) &&
       createDate >= rangeStart && createDate < rangeEndExclusive){
      julyLeadIds.push(leadId);
    }

  });

  Logger.log(
    "Leads_Master 7월 Create Date 건수: " + julyLeadIds.length +
    " / Salesforce 목록: " + SALESFORCE_JULY_2026_LEAD_IDS.length + "건"
  );

  const gap = computeLeadIdGap_(SALESFORCE_JULY_2026_LEAD_IDS, julyLeadIds);

  Logger.log(
    "=== Salesforce엔 있는데 우리 7월 카운트엔 없는 Lead (" +
    gap.missingFromOurs.length + "건) ==="
  );

  gap.missingFromOurs.forEach(function(leadId){

    const record = leadIdToRecord[leadId];

    if(!record){
      Logger.log(leadId + " -> Leads_Master에 아예 없음");
      return;
    }

    const createDate = record["Create Date"];
    const createDateText = createDate instanceof Date
      ? Utilities.formatDate(createDate, Session.getScriptTimeZone(), "yyyy-MM-dd")
      : String(createDate);

    Logger.log(leadId + " -> Leads_Master엔 있음, Create Date=" + createDateText);

  });

  Logger.log(
    "=== 우리 7월 카운트엔 있는데 Salesforce 목록엔 없는 Lead (" +
    gap.extraInOurs.length + "건) ==="
  );

  gap.extraInOurs.forEach(function(leadId){
    Logger.log(leadId);
  });

  //----------------------------------------------------------
  // Leads_Master 자체의 중복 정도 정량화(위 extraInOurs가 대부분 같은
  // Lead ID의 반복이라는 게 육안으로 보여서, 실제 중복 배율을 수치로 확인)
  //----------------------------------------------------------

  const duplicateCounts = computeIdOccurrenceCounts_(julyLeadIds);
  const uniqueJulyLeadIds = Object.keys(duplicateCounts);
  const duplicatedIds = uniqueJulyLeadIds.filter(function(id){ return duplicateCounts[id] > 1; });

  Logger.log(
    "Leads_Master 7월 행 " + julyLeadIds.length + "건 중 고유 Lead ID " +
    uniqueJulyLeadIds.length + "개, 그중 2회 이상 중복 등장 Lead ID " +
    duplicatedIds.length + "개(최대 중복 횟수: " +
    Math.max.apply(null, uniqueJulyLeadIds.map(function(id){ return duplicateCounts[id]; })) + ")"
  );

}


/**
 * ==========================================================
 * Compute ID Occurrence Counts (순수 함수)
 *
 * WHY
 * Leads_Master 7월 행 수(1266)가 Salesforce 리스트(205)보다 훨씬 커서,
 * 같은 Lead ID가 몇 번씩 반복되는지 정량화하기 위함.
 * ==========================================================
 */
function computeIdOccurrenceCounts_(ids){

  const counts = {};

  ids.forEach(function(id){
    counts[id] = (counts[id] || 0) + 1;
  });

  return counts;

}


/**
 * ==========================================================
 * TEMP — 2026년 7월 New Leads 불일치 확인(Leads_OPS 기준, 수동 실행)
 *
 * WHY
 * runCheckJulyNewLeadsGap()은 Leads_Master를 봤는데, 실제 ACQ_REP New
 * Leads(183건)는 Leads_Master가 아니라 Leads_OPS를 읽는다
 * (computeOPSAggregates_(), 30_ACQReport.js). Leads_Master에 7월 Lead
 * 206건 전부가 존재함(missingFromOurs 0건, 다만 대량 중복)이 확인됐으니,
 * 실제 183 vs 206 갭은 Leads_Master→Leads_OPS 병합(buildLeadsOPS()) 과정
 * 어딘가에서 발생한다는 뜻 — 정확히 어떤 Lead ID가 Leads_OPS 7월
 * 카운트에서 빠지는지 같은 방식으로 확인한다.
 * ==========================================================
 */
function runCheckJulyNewLeadsGapInOPS(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const opsSheet = ss.getSheetByName(OPS.SHEET.OPS);

  if(!opsSheet){
    Logger.log("Leads_OPS 시트를 못 찾음 — OPS.SHEET.OPS 설정 확인 필요.");
    return;
  }

  const opsRecords = sheetToObjects(opsSheet);

  const rangeStart = new Date(2026, 6, 1);        // 2026-07-01
  const rangeEndExclusive = new Date(2026, 7, 1);  // 2026-08-01 (미포함)

  const julyLeadIds = [];
  const leadIdToRecord = {};

  opsRecords.forEach(function(record){

    const leadId = String(record["Lead ID"] || "").trim();
    if(!leadId) return;

    leadIdToRecord[leadId] = record;

    const createDate = record["Create Date"];

    if(createDate instanceof Date && !isNaN(createDate.getTime()) &&
       createDate >= rangeStart && createDate < rangeEndExclusive){
      julyLeadIds.push(leadId);
    }

  });

  Logger.log(
    "Leads_OPS 7월 Create Date 건수: " + julyLeadIds.length +
    " / Salesforce 목록: " + SALESFORCE_JULY_2026_LEAD_IDS.length + "건"
  );

  const gap = computeLeadIdGap_(SALESFORCE_JULY_2026_LEAD_IDS, julyLeadIds);

  Logger.log(
    "=== Salesforce엔 있는데 Leads_OPS 7월 카운트엔 없는 Lead (" +
    gap.missingFromOurs.length + "건) ==="
  );

  gap.missingFromOurs.forEach(function(leadId){

    const record = leadIdToRecord[leadId];

    if(!record){
      Logger.log(leadId + " -> Leads_OPS에 아예 없음(어떤 Create Date로도)");
      return;
    }

    const createDate = record["Create Date"];
    const createDateText = createDate instanceof Date
      ? Utilities.formatDate(createDate, Session.getScriptTimeZone(), "yyyy-MM-dd")
      : String(createDate);

    Logger.log(
      leadId + " -> Leads_OPS엔 있음, Create Date=" + createDateText +
      ", Business Segment=" + record["Business Segment"]
    );

  });

  Logger.log(
    "=== Leads_OPS 7월 카운트엔 있는데 Salesforce 목록엔 없는 Lead (" +
    gap.extraInOurs.length + "건) ==="
  );

  gap.extraInOurs.forEach(function(leadId){
    Logger.log(leadId);
  });

  //----------------------------------------------------------
  // Leads_OPS 자체의 중복 여부 확인 — buildLeadsOPS()의 불변식(1 Lead ID =
  // 1 행)이 실제로 지켜지고 있는지, Leads_Master처럼 중복이 새고 있는지 확인
  //----------------------------------------------------------

  const duplicateCounts = computeIdOccurrenceCounts_(julyLeadIds);
  const uniqueJulyLeadIds = Object.keys(duplicateCounts);
  const duplicatedIds = uniqueJulyLeadIds.filter(function(id){ return duplicateCounts[id] > 1; });

  Logger.log(
    "Leads_OPS 7월 행 " + julyLeadIds.length + "건 중 고유 Lead ID " +
    uniqueJulyLeadIds.length + "개, 그중 2회 이상 중복 등장 Lead ID " +
    duplicatedIds.length + "개" +
    (duplicatedIds.length > 0
      ? "(최대 중복 횟수: " + Math.max.apply(null, duplicatedIds.map(function(id){ return duplicateCounts[id]; })) + ")"
      : "(중복 없음 — Lead ID당 1행 불변식 유지됨)")
  );

}


/**
 * ==========================================================
 * TEMP — 2026년 7월 New P1 불일치 확인(Leads_OPS 기준, 수동 실행)
 *
 * WHY
 * 진짜 비교 대상은 New Leads(전체)가 아니라 New P1(유효 Priority=
 * "Priority 1")이었음(사용자 확인, 2026-08-05) — Leads_OPS 7월 행을
 * isEffectiveP1_()(30_ACQReport.js, computeOPSAggregates_()가 쓰는 것과
 * 동일한 함수 그대로 재사용, 재구현/추측 없음)로 직접 필터링해 Salesforce
 * Priority 1 목록(205건)과 대조한다. ACQ_REP 화면의 183은 캐시/Report
 * 갱신 타이밍 문제일 수 있어(Change Log 참고), 이 함수는 그와 무관하게
 * 라이브 데이터 기준 진짜 답을 확인하기 위함.
 * ==========================================================
 */
function runCheckJulyNewP1GapInOPS(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const opsSheet = ss.getSheetByName(OPS.SHEET.OPS);

  if(!opsSheet){
    Logger.log("Leads_OPS 시트를 못 찾음 — OPS.SHEET.OPS 설정 확인 필요.");
    return;
  }

  const opsRecords = sheetToObjects(opsSheet);

  const rangeStart = new Date(2026, 6, 1);        // 2026-07-01
  const rangeEndExclusive = new Date(2026, 7, 1);  // 2026-08-01 (미포함)

  const julyP1LeadIds = [];
  const leadIdToRecord = {};

  opsRecords.forEach(function(record){

    const leadId = String(record["Lead ID"] || "").trim();
    if(!leadId) return;

    leadIdToRecord[leadId] = record;

    const createDate = record["Create Date"];

    if(createDate instanceof Date && !isNaN(createDate.getTime()) &&
       createDate >= rangeStart && createDate < rangeEndExclusive &&
       isEffectiveP1_(record["Lead Priority"], record["Priority Override"])){
      julyP1LeadIds.push(leadId);
    }

  });

  Logger.log(
    "Leads_OPS 7월 New P1(effective, 라이브 계산) 건수: " + julyP1LeadIds.length +
    " / Salesforce Priority 1 목록: " + SALESFORCE_JULY_2026_LEAD_IDS.length + "건"
  );

  const gap = computeLeadIdGap_(SALESFORCE_JULY_2026_LEAD_IDS, julyP1LeadIds);

  Logger.log(
    "=== Salesforce Priority 1엔 있는데 Leads_OPS 7월 New P1 카운트엔 없는 Lead (" +
    gap.missingFromOurs.length + "건) ==="
  );

  gap.missingFromOurs.forEach(function(leadId){

    const record = leadIdToRecord[leadId];

    if(!record){
      Logger.log(leadId + " -> Leads_OPS 7월 Create Date 행 자체가 없음");
      return;
    }

    const createDate = record["Create Date"];
    const createDateText = createDate instanceof Date
      ? Utilities.formatDate(createDate, Session.getScriptTimeZone(), "yyyy-MM-dd")
      : String(createDate);

    Logger.log(
      leadId + " -> Leads_OPS엔 있음(Create Date=" + createDateText +
      "), Lead Priority=" + JSON.stringify(record["Lead Priority"]) +
      ", Priority Override=" + JSON.stringify(record["Priority Override"]) +
      " (isEffectiveP1_=" + isEffectiveP1_(record["Lead Priority"], record["Priority Override"]) + ")"
    );

  });

  Logger.log(
    "=== Leads_OPS 7월 New P1 카운트엔 있는데 Salesforce Priority 1 목록엔 없는 Lead (" +
    gap.extraInOurs.length + "건) ==="
  );

  gap.extraInOurs.forEach(function(leadId){
    Logger.log(leadId);
  });

}


// runCheckJulyNewP1GapInOPS() 실행 결과 "Priority 3"로 잘못 찍혀 있던 23개 Lead ID
// (2026-08-05) — Leads_Master의 전체 중복 히스토리를 다시 확인해 mergeOPS()가
// 오래된 스냅샷을 골랐는지, 아니면 우리 Master 자체에 최신 Priority 1 스냅샷이
// 애초에 없는지(=단순 export 지연) 구분하기 위함
const MISMATCHED_PRIORITY_LEAD_IDS = [
  "00QRC00001FYSyP","00QRC00001FgCEw","00QRC00001FuNdW","00QRC00001FwsZx",
  "00QRC00001H2FLf","00QRC00001H1yeA","00QRC00001H2HiP","00QRC00001HLIHO",
  "00QRC00001HMsST","00QRC00001HNQig","00QRC00001HObvO","00QRC00001HRbM9",
  "00QRC00001HRa6l","00QRC00001HRjy2","00QRC00001HWe4r","00QRC00001HiQ4X",
  "00QRC00001Hl5Mv","00QRC00001Hn7fZ","00QRC00001Hn6d5","00QRC00001IyzKH",
  "00QRC00001J3kqr","00QRC00001HTOuH","00QRC00001HZENa",
  "00QRC00001IUkqX"  // Leads_OPS엔 아예 없던 1건도 같이 확인
];


/**
 * ==========================================================
 * TEMP — Priority 불일치 Lead의 Leads_Master 전체 중복 히스토리 덤프(수동 실행)
 *
 * WHY
 * runCheckJulyNewP1GapInOPS()가 찾은 23개 Lead가 Leads_OPS엔 "Priority 3"로
 * 있는데 Salesforce는 Priority 1로 봄 — 원인이 (a) mergeOPS()가 이 Lead의
 * 여러 중복 스냅샷 중 오래된(Priority 3) 걸 골라서인지, 아니면 (b) 우리
 * Leads_Master 자체에 Priority 1 스냅샷이 애초에 없어서(=단순히 최신
 * Salesforce 상태 대비 export가 뒤처진 것뿐)인지 구분해야 함 — 실제
 * Leads_Master 원본 데이터로 확인 전까지 추측하지 않는다.
 * ==========================================================
 */
function runDumpPriorityMismatchLeadHistory(){

  const rowsWithIndex = readLeadsMasterRowsWithIndex_();

  const rowsByLeadId = {};

  rowsWithIndex.forEach(function(item){

    const leadId = String(item.record["Lead ID"] || "").trim();
    if(!leadId) return;

    if(!rowsByLeadId[leadId]) rowsByLeadId[leadId] = [];
    rowsByLeadId[leadId].push(item);

  });

  MISMATCHED_PRIORITY_LEAD_IDS.forEach(function(leadId){

    const items = rowsByLeadId[leadId];

    if(!items || items.length === 0){
      Logger.log(leadId + " -> Leads_Master에 아예 없음");
      return;
    }

    Logger.log(leadId + " -> Leads_Master 행 " + items.length + "개:");

    items.forEach(function(item){

      const createDate = item.record["Create Date"];
      const createDateText = createDate instanceof Date
        ? Utilities.formatDate(createDate, Session.getScriptTimeZone(), "yyyy-MM-dd")
        : String(createDate);

      Logger.log(
        "  rowIndex=" + item.rowIndex +
        ", Create Date=" + createDateText +
        ", Lead Priority=" + JSON.stringify(item.record["Lead Priority"]) +
        ", Priority Override=" + JSON.stringify(item.record["Priority Override"])
      );

    });

  });

}
