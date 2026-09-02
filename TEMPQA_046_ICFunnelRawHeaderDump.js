/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — ICFunnel_Raw 실제 헤더 텍스트 덤프
 * (docs/OpenItems.md #32 후속 — SALES_ACCEPTED_DATE 필드가 두 차례 전체
 * re-export/재sync 후에도 전혀 반영 안 되는 문제 조사)
 *
 * Responsibility
 * `CONFIG.IC_FUNNEL.COLUMNS.SALES_ACCEPTED_DATE`("New (Not Contacted) Date
 * Time")를 추가하고 사용자가 Salesforce IC Funnel 리포트에 그 컬럼을
 * 추가해 두 차례(59건, 3206건) re-export/재import했는데도
 * `runCompareAugustSALAgainstSalesforce()` 결과가 완전히 동일(246/44/14/8,
 * 날짜값까지 전부 동일)하게 나옴 — 정상이라면 최소 일부는 바뀌어야 함.
 * 가장 유력한 원인은 실제 export 헤더 텍스트가 코드의 문자열과 정확히
 * 일치하지 않아 `record[cols.SALES_ACCEPTED_DATE]`가 매번 undefined를
 * 반환하는 것(공백/괄호/대소문자 차이 등). 이 스크립트는 ICFunnel_Raw의
 * 실제 헤더 행 전체를 그대로 덤프해서 정확한 텍스트를 확인한다.
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 *
 * INPUT: 없음 (ICFunnel_Raw 헤더 행만 읽음)
 * OUTPUT: Logger.log만
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 조사 스크립트(TEMPQA 관례).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-09-01)
 * - 최초 구현.
 * ==========================================================
 */
function runDumpICFunnelRawHeader(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.IC_FUNNEL.SHEET);

  if(!sheet){
    Logger.log("❌ " + CONFIG.IC_FUNNEL.SHEET + " 시트가 없습니다.");
    return;
  }

  const lastCol = sheet.getLastColumn();
  const headerValues = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  Logger.log("========== " + CONFIG.IC_FUNNEL.SHEET + " 헤더(" + lastCol + "개 컬럼) ==========");

  headerValues.forEach(function(h, i){
    Logger.log("[" + (i + 1) + "] \"" + h + "\"");
  });

  Logger.log("");
  Logger.log("---- 코드가 찾는 컬럼명과 정확히 일치하는지 ----");

  const expected = CONFIG.IC_FUNNEL.COLUMNS.SALES_ACCEPTED_DATE;
  const exactMatch = headerValues.indexOf(expected) !== -1;

  Logger.log("코드 기대값: \"" + expected + "\"");
  Logger.log("정확히 일치하는 컬럼 있음? " + (exactMatch ? "✅ 예 (인덱스 " + headerValues.indexOf(expected) + ")" : "❌ 아니오"));

  if(!exactMatch){
    Logger.log("");
    Logger.log("---- 비슷해 보이는 컬럼 후보(대소문자 무시, 부분 포함) ----");
    headerValues.forEach(function(h, i){
      const hLower = String(h || "").toLowerCase();
      if(hLower.indexOf("not contacted") !== -1 || hLower.indexOf("new (") !== -1){
        Logger.log("[" + (i + 1) + "] \"" + h + "\" (길이=" + String(h).length + ")");
      }
    });
  }

  //----------------------------------------------------------
  // sheetToObjects()가 실제로 이 컬럼을 어떻게 읽는지 샘플 1건 확인
  //----------------------------------------------------------

  const records = sheetToObjects(sheet);

  Logger.log("");
  Logger.log("---- sheetToObjects() 샘플 1건(첫 레코드)의 관련 필드 ----");

  if(records.length > 0){
    const sample = records[0];
    Logger.log("Lead ID: " + sample[CONFIG.IC_FUNNEL.COLUMNS.LEAD_ID]);
    Logger.log("SALES_ACCEPTED_DATE 필드(\"" + expected + "\") 값: \"" + sample[expected] + "\"");
    Logger.log("전체 키 목록: " + Object.keys(sample).join(" | "));
  }

}
