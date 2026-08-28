/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — TOFU/트래픽류 UTM Campaign이 UTM_Program_Dictionary에
 * 다른 Program으로도 잘못 채굴돼 있는지 전수 확인
 *
 * Responsibility
 * TEMPQA_038 조사로 `KR_core_2024-07-19_landing-page-tofu_traffic`
 * (UTM_PROGRAM_DICT_MANUAL_EXCLUSIONS에 추가한 1건)이 트래픽 목적
 * 캠페인이라 소수 귀속 터치의 우연한 쏠림만으로 Distinct Program
 * Count===1(모호하지 않음)을 통과해버린 사례임을 확인. 사용자가 "TOFU
 * 성격 캠페인이 다른 프로그램에도 같은 식으로 잘못 붙어있는 거 아니냐"고
 * 질문 — UTM Campaign 이름에 "traffic"/"tofu"가 들어간 모든 딕셔너리
 * 행을 전수 조회해 각각 몇 건 중 몇 건이 특정 Program으로 쏠려있는지
 * (Match Count/Total Count) 확인한다. Total Count가 작을수록(=애초에
 * 리드로 귀속된 터치 자체가 적을수록) 같은 클래스의 오채굴 위험이 크다.
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 *
 * INPUT: 없음 (UTM_Program_Dictionary 시트 직접 스캔)
 * OUTPUT: Logger.log만
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 조사 스크립트(TEMPQA 관례).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-08-28)
 * - 최초 구현.
 * ==========================================================
 */
function runAuditTrafficStyleUtmDictionaryEntries(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.UTM_PROGRAM_DICT.SHEET);

  if(!sheet){
    Logger.log(CONFIG.UTM_PROGRAM_DICT.SHEET + " 시트를 찾을 수 없습니다.");
    return;
  }

  const rows = sheetToObjects(sheet);

  const KEYWORDS = ["traffic", "tofu"];

  function matchesKeyword(utmKey){
    const lower = String(utmKey || "").toLowerCase();
    return KEYWORDS.some(function(kw){ return lower.indexOf(kw) !== -1; });
  }

  const candidates = rows.filter(function(r){ return matchesKeyword(r["UTM Campaign"]); });

  Logger.log("========== UTM Campaign에 'traffic'/'tofu' 포함 딕셔너리 행 (" + candidates.length + "건) ==========");

  const unambiguous = candidates.filter(function(r){ return Number(r["Distinct Program Count"]) === 1; });
  const ambiguous = candidates.filter(function(r){ return Number(r["Distinct Program Count"]) !== 1; });

  Logger.log("모호하지 않음(Distinct Program Count===1, 실제로 매칭에 쓰이는 것들) : " + unambiguous.length);
  Logger.log("모호함(Distinct Program Count>1, 이미 자동 제외됨)                  : " + ambiguous.length);

  Logger.log("");
  Logger.log("---- 모호하지 않은 행 상세(잠재적 오채굴 후보) ----");

  unambiguous
    .slice()
    .sort(function(a, b){ return Number(a["Total Count"]) - Number(b["Total Count"]); })
    .forEach(function(r){
      Logger.log(
        "  UTM Campaign=\"" + r["UTM Campaign"] + "\"" +
        " → Marketo Program=\"" + r["Marketo Program"] + "\"" +
        " / Match Count=" + r["Match Count"] + "/" + r["Total Count"] +
        (isUtmProgramDictionaryKeyExcluded_(String(r["UTM Campaign"] || "").trim().toLowerCase())
          ? "  [이미 수동 제외 목록에 있음]" : "")
      );
    });

  Logger.log("");
  Logger.log("---- 모호한 행(참고용, 이미 제외돼 있어 영향 없음) ----");

  ambiguous.forEach(function(r){
    Logger.log(
      "  UTM Campaign=\"" + r["UTM Campaign"] + "\"" +
      " → Marketo Program=\"" + r["Marketo Program"] + "\"" +
      " / Distinct Program Count=" + r["Distinct Program Count"]
    );
  });

}
