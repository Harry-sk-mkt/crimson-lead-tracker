/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — "Referral → Other" 키워드 규칙 드리프트 원인 추적
 *
 * Responsibility
 * TEMPQA_034_BusinessSegmentDictionaryDiff.js의 ①번(키워드 규칙 드리프트,
 * 이번 딕셔너리 작업과 무관) 항목에서 MTA_Master 662건이 "Referral → Other"
 * 로 나온 원인을 확인한다. `getBusinessSegment()`의 Referral 판정은
 * `leadSource === "referral"`(소문자 비교) 단 하나뿐이라, 지금 재계산 시
 * "Other"가 나온다는 건 재계산에 넘긴 leadSource 값이 "Referral"이 아니라는
 * 뜻 — 그 값이 실제로 무엇인지(공란인지, 다른 값인지, 표기가 다른지) 직접
 * 확인한다. **읽기 전용** — 아무것도 쓰지 않음(TEMPQA_017/033/034와 동일
 * 관례).
 *
 * **결론(v1.0.0 최초 실행, 2026-08-26)**: 원인은 데이터가 아니라 이 진단
 * 스크립트(및 TEMPQA_034) 자체의 필드명 버그였음 — MTA_Master의 leadSource
 * 저장 컬럼명은 `MASTER_007_MTATransformer.js`가 raw "Lead Source"를
 * "First Lead Source"로 리네임해서 저장하는데, 여기서 "Lead Source"로
 * 읽어서 전부 undefined였음. v1.1.0에서 "First Lead Source"로 수정 —
 * 실제 키워드 규칙 드리프트가 있는지는 이 수정 후 재실행 결과로 다시 판단.
 *
 * Version
 * v1.1.0
 *
 * Change Log
 * v1.1.0 (2026-08-26)
 * - 필드명 버그 수정 — `r["First Lead Source"]` → `r["First Lead Source"]`(MTA_Master
 *   실제 저장 컬럼명). 위 "결론" 참고.
 * v1.0.0 (2026-08-26)
 * - 최초 구현(필드명 버그 있음, v1.1.0에서 수정).
 * ==========================================================
 */


/**
 * ==========================================================
 * Trace Referral Drift (수동 실행 진입점, 읽기 전용)
 * ==========================================================
 */
function runTraceReferralDrift(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);

  if(!sheet){
    Logger.log("MTA_Master 시트를 못 찾음.");
    return;
  }

  const records = sheetToObjects(sheet);

  const affected = records.filter(function(r){
    return String(r["Business Segment"] || "") === "Referral";
  });

  Logger.log("Business Segment = \"Referral\"로 저장된 행: " + affected.length + "건");
  Logger.log("");

  const leadSourceValueCounts = {};

  affected.forEach(function(r){
    const leadSourceRaw = r["First Lead Source"];
    const key = "\"" + leadSourceRaw + "\" (typeof " + (typeof leadSourceRaw) + ")";
    leadSourceValueCounts[key] = (leadSourceValueCounts[key] || 0) + 1;
  });

  Logger.log("--- 현재 'Lead Source' 필드 값 분포 (Business Segment=Referral 행들 기준) ---");
  Object.keys(leadSourceValueCounts).sort(function(a, b){
    return leadSourceValueCounts[b] - leadSourceValueCounts[a];
  }).forEach(function(key){
    Logger.log(key + " : " + leadSourceValueCounts[key] + "건");
  });

  Logger.log("");
  Logger.log("--- 샘플 10건 (Lead ID / Lead Source / Lead Source Detail / MKT UTM Campaign / Lead Source Category) ---");

  affected.slice(0, 10).forEach(function(r){
    Logger.log(
      "Lead ID=" + r["Lead ID"] +
      " | Lead Source=\"" + r["First Lead Source"] + "\"" +
      " | Lead Source Detail=\"" + r["Lead Source Detail"] + "\"" +
      " | MKT UTM Campaign=\"" + r["MKT UTM Campaign"] + "\"" +
      " | Lead Source Category=\"" + r["Lead Source Category"] + "\""
    );
  });

}
