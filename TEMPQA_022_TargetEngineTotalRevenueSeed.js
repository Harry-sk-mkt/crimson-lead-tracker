/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — Target_Engine "Total Revenue Target"(24행) FY27 값 1회 입력
 *
 * Responsibility
 * `Target_Engine`의 신규 24행(`CONFIG.TARGET.INPUT.MONTHLY_COMPANY_INPUTS.
 * TOTAL_REVENUE_TARGET_ROW`, TARGET_001_Engine.js v1.27.0)에 사용자가 직접
 * 확인한 FY27 AUG~JUL "Total Revenue"(VAT/Referral/Upsell 포함) 값을 1회
 * 입력한다 — 22행 "Marketing Revenue Target"과 별개 필드라 setupTargetEngine
 * 계열 함수(보존형, 빈 셀만 0으로 채움)로는 실제 값이 안 채워짐.
 *
 * WHY
 * 2026-08-24 사용자가 FY_REP의 Target 컬럼이 실제보다 낮게 나오는 걸 발견 —
 * Target_Engine 22행이 Referral/Upsell 제외 마케팅 기여분만 담고 있어
 * FY_REP의 Total Rev(Referral/Upsell 포함)와 범위가 안 맞았음(TEMPQA_006
 * `runInspectTargetEngineTeamKoreaTab()`/`runInspectTargetEngineTeamKoreaTarget()`
 * 참고). 사용자가 다른 시트에서 직접 확인한 정확한 FY27 전체 타겟 값을
 * 24행에 그대로 입력하는 것으로 확정(2026-08-24).
 *
 * Version
 * v1.1.0
 *
 * Change Log
 * v1.1.0 (2026-08-24)
 * - 실측 결과 A24 라벨이 안 채워짐을 확인(값만 쓰고 라벨은 안 씀) — A24 라벨 +
 *   통화 서식($#,##0.00) 직접 쓰도록 보강, setupTargetEngineMonthlyGridDefaults_()
 *   재실행 없이도 완결되게.
 * v1.0.0 (2026-08-24)
 * - 최초 구현.
 * ==========================================================
 */


// FY27 AUG~JUL Total Revenue Target(NZD, VAT/Referral/Upsell 포함) — 사용자가
// 2026-08-24 다른 시트에서 직접 확인해 제공한 값. CONFIG.ACQ.FISCAL_MONTH_ORDER와
// 순서 일치(AUG가 첫 번째).
const TARGET_ENGINE_TOTAL_REVENUE_FY27 = [
  1392351.40, // AUG
  1157119.70, // SEP
  1622908.10, // OCT
  1040715.50, // NOV
  1342126.50, // DEC
  1820929.00, // JAN
  1461103.60, // FEB
  1082881.80, // MAR
  1021055.20, // APR
  701984.80,  // MAY
  1000949.40, // JUN
  1270093.00  // JUL
];


/**
 * ==========================================================
 * Run Seed Target Engine Total Revenue Row (1회성, Target_Engine 시트에 쓰기)
 *
 * WHY
 * TARGET_ENGINE_TOTAL_REVENUE_FY27 값을 Target_Engine 24행(B~M열)에 직접
 * 써넣는다. Target_Engine의 `targetFY`(1행)가 27이 아니면(다음 회계연도로
 * 넘어가 다른 FY 값이 들어있으면) 실수로 엉뚱한 FY 행에 덮어쓰지 않도록
 * 안전장치로 막고 중단한다 — 이 값은 FY27 한 해에 대해서만 유효.
 * ==========================================================
 */
function runSeedTargetEngineTotalRevenueRow(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const engineSheet = ss.getSheetByName(CONFIG.TARGET.ENGINE_SHEET);

  if(!engineSheet){
    Logger.log("❌ " + CONFIG.TARGET.ENGINE_SHEET + " 시트를 찾을 수 없음");
    return;
  }

  const inputs = readTargetEngineInputs_(engineSheet);

  if(inputs.targetFY !== 27){
    Logger.log("❌ Target_Engine의 targetFY가 27이 아님(현재: " + inputs.targetFY +
      ") — 이 값은 FY27 전용이라 중단. targetFY를 27로 바꾼 뒤 재실행하거나, " +
      "다른 FY 값이 필요하면 TARGET_ENGINE_TOTAL_REVENUE_FY27을 갱신해서 재실행할 것.");
    return;
  }

  const input = CONFIG.TARGET.INPUT;
  const row = input.MONTHLY_COMPANY_INPUTS.TOTAL_REVENUE_TARGET_ROW;
  const col = input.MONTHLY_COMPANY_INPUTS.MONTH_START_COL;

  // 라벨(A24)은 setupTargetEngineMonthlyGridDefaults_()가 원래 채우는 몫이지만,
  // 그 함수는 setupTargetReport() 전체를 다시 돌려야 호출되므로 여기서 직접 씀
  // (setupTargetEngineMonthlyGridDefaults_()의 라벨 문구와 동일하게 유지).
  engineSheet.getRange(row, input.LABEL_COL)
    .setValue("Total Revenue Target (NZD, VAT/Referral/Upsell 포함 — FY_REP 전용)");

  engineSheet.getRange(row, col, 1, TARGET_ENGINE_TOTAL_REVENUE_FY27.length)
    .setValues([TARGET_ENGINE_TOTAL_REVENUE_FY27])
    .setNumberFormat("$#,##0.00");

  Logger.log("✅ " + row + "행(B~M열)에 FY27 Total Revenue Target 12개월 값 입력 완료: " +
    JSON.stringify(TARGET_ENGINE_TOTAL_REVENUE_FY27));

}
