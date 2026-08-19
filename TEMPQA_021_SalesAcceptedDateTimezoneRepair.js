/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — Sales Accepted Date 타임존 버그 복구 (docs/OpenItems.md #26 후속)
 *
 * Responsibility
 * TEMPQA_020_SalesAcceptedDateTimezoneReaudit.js로 확인된 버킷 C(94건,
 * Seoul 기준 day<=12라 swap-back 대상인데 TEMPQA_008이 NY 기준으로
 * 판정하는 바람에 놓친 건)를 TEMPQA_008과 동일한 방식(MTA_Raw 컬럼 전체
 * 1회 읽기 → 메모리에서 swap-back → 1회 쓰기)으로 복구한다.
 *
 * ⚠️ "Raw는 원본 보존, 수동 수정 금지" 원칙의 명시적 예외 — TEMPQA_008과
 * 동일한 근거(원본 텍스트가 이미 Google Sheets 자동 변환으로 소실된 상태,
 * swap-back 공식이 결정론적, 사용자가 Salesforce Field History로 2건
 * 직접 검증 완료 — ppm1xxx@gmail.com/yunjiseong955@gmail.com, 2026-08-20).
 *
 * 안전장치(bucket A 이중 처리 방지)
 * TEMPQA_008이 이미 고친 값(버킷 A, 3,193건)은 `new Date(year, month, day)`
 * (시각 인자 생략, 즉 스크립트 타임존 자정)로 만들어졌으므로 시각이 항상
 * 정확히 00:00:00이다. 반면 아직 안 고쳐진 원본 오염값(버킷 C)은 Google
 * Sheets가 "M/D/YYYY, H:MM am/pm" 텍스트를 그대로 변환한 것이라 실제
 * 시각(분 단위까지)이 남아있다 — 이 시각 차이를 안전장치로 사용해 버킷 A를
 * 다시 건드리지 않는다(자정이면 이미 복구된 값으로 간주, 손대지 않음).
 * TEMPQA_020 재감사에서 버킷 B(잘못 swap된 것)가 0건으로 확인됐으므로
 * 이 컬럼 전체 재스캔이 버킷 A를 훼손할 위험도 이 안전장치로 이중 차단됨.
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-08-20)
 * - 최초 구현.
 * ==========================================================
 */


/**
 * ==========================================================
 * Compute Sales Accepted Date Recovery — Asia/Seoul 기준 (순수 함수)
 *
 * INPUT
 * storedValue : Date|*  (현재 셀에 저장된 값 — Date가 아니면 손대지 않음)
 *
 * OUTPUT
 * { corrupted: boolean, recovered: Date|null }
 * - Date 아님 → corrupted:false
 * - Asia/Seoul 기준 day>12 → corrupted:false(swap 불가능했으므로 안전)
 * - 시각이 정확히 자정(00:00:00) → corrupted:false(TEMPQA_008이 이미
 *   복구한 값으로 간주, 이중 swap 방지)
 * - 그 외(Seoul day<=12 AND 자정 아님) → corrupted:true, recovered:
 *   Seoul 기준 day/month swap-back 결과
 *
 * TEST
 * testComputeSalesAcceptedDateRecoverySeoul() 참고
 * ==========================================================
 */
function computeSalesAcceptedDateRecoverySeoul_(storedValue){

  if(!(storedValue instanceof Date) || isNaN(storedValue.getTime())){
    return { corrupted: false, recovered: null };
  }

  const seoulText = Utilities.formatDate(storedValue, "Asia/Seoul", "yyyy-MM-dd");
  const seoulParts = seoulText.split("-");

  const seoulYear = Number(seoulParts[0]);
  const seoulMonth = Number(seoulParts[1]) - 1; // 0-indexed
  const seoulDay = Number(seoulParts[2]);

  if(seoulDay > 12){
    return { corrupted: false, recovered: null };
  }

  const isMidnight =
    storedValue.getHours() === 0 &&
    storedValue.getMinutes() === 0 &&
    storedValue.getSeconds() === 0;

  if(isMidnight){
    return { corrupted: false, recovered: null };
  }

  const recovered = new Date(seoulYear, seoulDay - 1, seoulMonth + 1);

  return { corrupted: true, recovered: recovered };

}


/**
 * ==========================================================
 * TEST — computeSalesAcceptedDateRecoverySeoul_()
 * ==========================================================
 */
function testComputeSalesAcceptedDateRecoverySeoul(){

  // 실제 사례(TEMPQA_019로 확인) — yunjiseong955@gmail.com:
  // 저장값 epoch=1796081700000 (NY로 보면 2026-11-30 18:35, Seoul로 보면
  // 2026-12-01 08:35) → Seoul day=1(<=12) AND 자정 아님 → swap-back
  // 대상 → recovered = 2026년 1월 12일.
  const realCase = computeSalesAcceptedDateRecoverySeoul_(new Date(1796081700000));

  // 버킷 A(이미 복구된 값) 시뮬레이션 — 자정이라 손대면 안 됨
  const alreadyRecoveredCase = computeSalesAcceptedDateRecoverySeoul_(new Date(2026, 7, 9)); // Aug 9 00:00

  // Seoul day>12 — 애초에 안전
  const safeCase = computeSalesAcceptedDateRecoverySeoul_(new Date(2026, 0, 20, 15, 0));

  const nullCase = computeSalesAcceptedDateRecoverySeoul_(null);

  const pass =
    realCase.corrupted === true &&
    realCase.recovered.getFullYear() === 2026 &&
    realCase.recovered.getMonth() === 0 &&   // Jan (0-indexed)
    realCase.recovered.getDate() === 12 &&
    alreadyRecoveredCase.corrupted === false && alreadyRecoveredCase.recovered === null &&
    safeCase.corrupted === false && safeCase.recovered === null &&
    nullCase.corrupted === false && nullCase.recovered === null;

  Logger.log(
    "testComputeSalesAcceptedDateRecoverySeoul: " + (pass ? "PASS" : "FAIL") +
    " realCase.recovered=" + realCase.recovered
  );

}


/**
 * ==========================================================
 * Run Apply Sales Accepted Date Timezone Repair (MTA_Raw 직접 수정 — 1회성)
 *
 * WHY
 * MTA_Raw의 "Lead: Sales Accepted Date" 컬럼 전체를 1회 읽어 메모리에서
 * computeSalesAcceptedDateRecoverySeoul_()로 판정 후 1회 쓰기(TEMPQA_008과
 * 동일 배치 패턴). 실행 후 반드시 `MASTER_004_MasterBuild.js`의
 * `rebuildMTAMaster()` → `MASTER_003_MTAFunnelSync.js`의
 * `runSyncMTAFunnelToOPS()`를 실행해야 MTA_Master/Leads_OPS/ACQ_REP/
 * S&M_REP에 반영됨(이 함수는 Raw만 고침).
 * ==========================================================
 */
function runApplySalesAcceptedDateTimezoneRepair(){

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
  const sampleLines = [];

  const newValues = values.map(function(row){

    const val = row[0];
    const result = computeSalesAcceptedDateRecoverySeoul_(val);

    if(!result.corrupted){
      return [val];
    }

    fixedCount++;

    if(sampleLines.length < 100){
      sampleLines.push(
        Utilities.formatDate(val, "Asia/Seoul", "yyyy-MM-dd") +
        " -> " +
        Utilities.formatDate(result.recovered, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd")
      );
    }

    return [result.recovered];

  });

  range.setValues(newValues);

  Logger.log("========== Sales Accepted Date 타임존 버그 복구 (MTA_Raw) ==========");
  Logger.log("전체 행 수         : " + numRows);
  Logger.log("Swap-back 적용됨    : " + fixedCount);
  Logger.log("");
  Logger.log("전체 목록(저장값[Seoul 기준] -> 복구값):");
  sampleLines.forEach(function(line){ Logger.log("  " + line); });
  Logger.log("");
  Logger.log("⚠️ 다음 단계: MASTER_004_MasterBuild.js의 rebuildMTAMaster() 실행 후,");
  Logger.log("   MASTER_003_MTAFunnelSync.js의 runSyncMTAFunnelToOPS()까지 실행하세요.");
  Logger.log("==========================================================");

}
