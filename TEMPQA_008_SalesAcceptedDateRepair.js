/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — Sales Accepted Date 복구 (docs/OpenItems.md #26)
 *
 * Responsibility
 * `MTA_Raw`의 `Lead: Sales Accepted Date` 컬럼 중 day/month가 뒤바뀐
 * (day≤12, TEMPQA_007_SalesAcceptedDateAudit.js로 3,193건 확인) 값을
 * 원래대로 되돌려 **MTA_Raw에 직접 씀** — Master는 Raw로부터 재생성되므로
 * (rebuildMTAMaster()) Raw를 고쳐야 영구적으로 반영됨.
 *
 * ⚠️ "Raw는 원본 보존, 수동 수정 금지" 원칙의 명시적 예외
 * 이번 건은 원본 CSV 텍스트 자체가 이미 소실된 상태(Google Sheets가 Import
 * 시점에 자동으로 잘못된 locale로 Date 변환, docs/DateParsing.md 참고)라
 * "원본을 보존"할 방법이 없고, day/month swap-back 공식이 수학적으로
 * 결정론적이며 실제 사례(kinetiroom@gmail.com, Salesforce Field History로
 * 9월 8일이 실제로는 8월 9일임을 확인)로 검증됐음 — 사용자 확정(2026-08-19)
 * 하에 예외적으로 Raw를 직접 수정.
 *
 * WHY (swap-back 공식)
 * 오염 메커니즘: 원본 텍스트 "day/month/year"(DD/MM)를 Google Sheets가
 * "month/day/year"(MM/DD)로 오해석 — 저장된 값은 month=원래 day,
 * day=원래 month가 됨. 되돌리려면 저장된 month를 day로, 저장된 day를
 * month로 다시 바꾸면 된다(TEMPQA_007과 동일 공식, 여기서 실제 쓰기까지
 * 수행). day>12인 값은 애초에 month로 오해석될 수 없었으므로 안전 —
 * 손대지 않음.
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-08-19)
 * - 최초 구현.
 * ==========================================================
 */


/**
 * ==========================================================
 * Compute Sales Accepted Date Recovery (순수 함수)
 *
 * INPUT
 * storedDate : Date|*  (현재 셀에 저장된 값 — Date가 아니면 손대지 않음)
 *
 * OUTPUT
 * { corrupted: boolean, recovered: Date|null }
 * - day>12 또는 Date 아님 → corrupted:false, recovered:null(원본 유지)
 * - day<=12 → corrupted:true, recovered: day/month swap-back 결과
 *
 * TEST
 * testComputeSalesAcceptedDateRecovery() 참고
 * ==========================================================
 */
function computeSalesAcceptedDateRecovery_(storedDate){

  if(!(storedDate instanceof Date) || isNaN(storedDate.getTime())){
    return { corrupted: false, recovered: null };
  }

  const storedDay = storedDate.getDate();

  if(storedDay > 12){
    return { corrupted: false, recovered: null };
  }

  const storedMonth = storedDate.getMonth(); // 0-indexed
  const storedYear = storedDate.getFullYear();

  const recovered = new Date(storedYear, storedDay - 1, storedMonth + 1);

  return { corrupted: true, recovered: recovered };

}


/**
 * ==========================================================
 * TEST — computeSalesAcceptedDateRecovery_()
 * ==========================================================
 */
function testComputeSalesAcceptedDateRecovery(){

  // 실제 사례 — kinetiroom@gmail.com: 저장값 2026-09-08 → 실제 2026-08-09
  // (Salesforce Field History로 확인, Created By 타임스탬프와 동일 시각)
  const realCase = computeSalesAcceptedDateRecovery_(new Date(2026, 8, 8, 19, 5));

  const safeCase = computeSalesAcceptedDateRecovery_(new Date(2026, 0, 15)); // day=15>12
  const nullCase = computeSalesAcceptedDateRecovery_(null);
  const noopCase = computeSalesAcceptedDateRecovery_(new Date(2023, 3, 4)); // day=month=4, swap이 값 자체는 그대로

  const pass =
    realCase.corrupted === true &&
    realCase.recovered.getFullYear() === 2026 &&
    realCase.recovered.getMonth() === 7 &&   // Aug (0-indexed)
    realCase.recovered.getDate() === 9 &&
    safeCase.corrupted === false && safeCase.recovered === null &&
    nullCase.corrupted === false && nullCase.recovered === null &&
    noopCase.corrupted === true &&
    noopCase.recovered.getTime() === new Date(2023, 3, 4).getTime();

  Logger.log(
    "testComputeSalesAcceptedDateRecovery: " + (pass ? "PASS" : "FAIL") +
    " realCase.recovered=" + realCase.recovered
  );

}


/**
 * ==========================================================
 * Run Apply Sales Accepted Date Repair (MTA_Raw 직접 수정 — 1회성)
 *
 * WHY
 * MTA_Raw의 "Lead: Sales Accepted Date" 컬럼을 컬럼 전체 1회 읽기 →
 * 메모리에서 day≤12인 값만 swap-back → 컬럼 전체 1회 쓰기(배치 패턴,
 * MASTER_003_MTAFunnelSync.js v1.6.0과 동일 원칙 — 개별 setValue() 반복
 * 없음). 실행 후 반드시 `MASTER_004_MasterBuild.js`의 `rebuildMTAMaster()`를
 * 실행해야 MTA_Master/Leads_OPS/ACQ_REP/S&M_REP에 반영됨(이 함수는 Raw만
 * 고침, Master는 별도 재구축 필요).
 * ==========================================================
 */
function runApplySalesAcceptedDateRepair(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.MTA_RAW);

  if(!sheet){
    Logger.log("MTA_Raw sheet not found.");
    return;
  }

  const headerMap = getHeaderMap(sheet);
  const colIndex = headerMap["Lead: Sales Accepted Date"];

  if(colIndex === undefined){
    Logger.log('"Lead: Sales Accepted Date" column not found in MTA_Raw.');
    return;
  }

  const lastRow = sheet.getLastRow();
  const numRows = lastRow - 1; // 헤더 1행 제외

  if(numRows <= 0){
    Logger.log("MTA_Raw has no data rows.");
    return;
  }

  const range = sheet.getRange(2, colIndex + 1, numRows, 1);
  const values = range.getValues();

  let fixedCount = 0;
  let skippedNonDateCount = 0;
  const sampleLines = [];

  const newValues = values.map(function(row){

    const val = row[0];

    const result = computeSalesAcceptedDateRecovery_(val);

    if(!result.corrupted){
      if(!(val instanceof Date) || isNaN(val.getTime())) skippedNonDateCount++;
      return [val];
    }

    fixedCount++;

    if(sampleLines.length < 10){
      sampleLines.push(
        Utilities.formatDate(val, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd") +
        " -> " +
        Utilities.formatDate(result.recovered, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd")
      );
    }

    return [result.recovered];

  });

  range.setValues(newValues);

  Logger.log("========== Sales Accepted Date 복구 (MTA_Raw) ==========");
  Logger.log("전체 행 수         : " + numRows);
  Logger.log("Date 아님(스킵)     : " + skippedNonDateCount);
  Logger.log("Swap-back 적용됨    : " + fixedCount);
  Logger.log("");
  Logger.log("샘플(최대 10건, 저장값 -> 복구값):");
  sampleLines.forEach(function(line){ Logger.log("  " + line); });
  Logger.log("");
  Logger.log("⚠️ 다음 단계: MASTER_004_MasterBuild.js의 rebuildMTAMaster()를 실행해");
  Logger.log("   MTA_Master/Leads_OPS/ACQ_REP/S&M_REP에 반영하세요.");
  Logger.log("==========================================================");

}
