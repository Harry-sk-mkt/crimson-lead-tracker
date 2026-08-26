/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — Business Segment Dictionary 도입 영향 범위 진단
 *
 * Responsibility
 * "Lead 유입 → Dictionary 조회 → Business Segment 분류" 플로우 도입
 * (`UTIL_002_UtmProgramDictionary.js` `resolveBusinessSegment_()`,
 * docs/BusinessSegmentClassification.md 참고) 후, Leads_Master/MTA_Master
 * 기존 행에 Full Rebuild를 적용하면 Business Segment가 얼마나/어떻게
 * 바뀌는지 사람이 먼저 확인하기 위한 진단.
 *
 * **3-way 비교(v2.0.0, 2026-08-26 재설계)**: 최초 버전은 "저장된 값" vs
 * "resolveBusinessSegment_() 최종값"만 비교해서, 두 가지 서로 다른 원인
 * (① 오늘 도입한 Program_Segment_Dictionary 자체의 영향, ② 이번 작업과
 * 무관하게 과거 getBusinessSegment() 키워드 규칙 개선분이 Full Rebuild 없이
 * 누적되어 아직 Master에 반영 안 된 격차)이 뒤섞여 나와 원인 판단이 불가능
 * 했음("Referral → Other" 661건처럼 Program/UTM과 무관해야 할 규칙까지
 * 바뀐 것처럼 보이는 착시 포함). 이제 세 값을 각각 계산해 두 원인을 분리:
 * - `stored`   : Master에 이미 기록된 값(과거 어느 시점 getBusinessSegment() 결과)
 * - `pure`     : 지금 이 순간 `getBusinessSegment()`(키워드 규칙만, 딕셔너리 미사용)
 * - `dict`     : `resolveBusinessSegment_()`(딕셔너리 우선, 실제 운영에 쓰이는 값)
 * `stored ≠ pure`는 "키워드 규칙 드리프트"(이번 작업과 무관, 별도 Full
 * Rebuild 논의 대상), `pure ≠ dict`는 "딕셔너리가 실제로 바꾼 것"(이번
 * 작업의 진짜 영향 범위, 여기만 육안 검토 대상)으로 따로 집계·출력한다.
 *
 * **읽기 전용** — 아무것도 쓰지 않음.
 *
 * 실행 순서: `runRefreshUtmProgramDictionary()` → `runRefreshProgramSegmentDictionary()`
 * (둘 다 UTIL_002_UtmProgramDictionary.js)를 먼저 실행해 두 딕셔너리를
 * 최신화한 뒤 이 파일의 `runDiffBusinessSegmentDictionaryImpact()`를 실행할 것.
 *
 * Version
 * v2.0.0
 *
 * Change Log
 * v2.0.0 (2026-08-26)
 * - 3-way 비교(stored/pure/dict)로 재설계 — 딕셔너리 자체의 영향과 무관한
 *   키워드 규칙 드리프트를 분리해서 보여줌(위 Responsibility 참고). 샘플에
 *   raw UTM Campaign/canonicalProgram도 함께 출력해 원인 추적 가능하게 함.
 * v1.0.0 (2026-08-26)
 * - 최초 구현(2-way 비교).
 * ==========================================================
 */


/**
 * ==========================================================
 * Diff Business Segment Dictionary Impact (수동 실행 진입점, 읽기 전용)
 * ==========================================================
 */
function runDiffBusinessSegmentDictionaryImpact(){

  Logger.log("========== Leads_Master ==========");
  diffLeadsMasterBusinessSegment_();

  Logger.log("");
  Logger.log("========== MTA_Master ==========");
  diffMtaMasterBusinessSegment_();

}


/**
 * ==========================================================
 * Diff Leads_Master Business Segment (IO 래퍼, 읽기 전용, 3-way)
 * ==========================================================
 */
function diffLeadsMasterBusinessSegment_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS_MASTER);

  if(!sheet){
    Logger.log("Leads_Master 시트를 못 찾음.");
    return;
  }

  const records = sheetToObjects(sheet);

  const utmProgramMap = readUtmProgramDictionaryMap_();
  const programSegmentMap = readProgramSegmentDictionaryMap_();

  const rowToArgs = function(r){
    return {
      campaign: r["First MKT UTM Campaign"],
      detail: r["First Touch Detail"],
      leadSource: r["First Lead Source"],
      category: r["First Lead Source Category"],
      id: r["Lead ID"]
    };
  };

  diffBusinessSegment3Way_(records, rowToArgs, utmProgramMap, programSegmentMap);

}


/**
 * ==========================================================
 * Diff MTA_Master Business Segment (IO 래퍼, 읽기 전용, 3-way)
 * ==========================================================
 */
function diffMtaMasterBusinessSegment_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);

  if(!sheet){
    Logger.log("MTA_Master 시트를 못 찾음.");
    return;
  }

  const records = sheetToObjects(sheet);

  const utmProgramMap = readUtmProgramDictionaryMap_();
  const programSegmentMap = readProgramSegmentDictionaryMap_();

  const rowToArgs = function(r){
    return {
      campaign: r["MKT UTM Campaign"],
      detail: r["Lead Source Detail"],
      // ⚠️ MTA_Master 저장 컬럼명은 "First Lead Source"다 — MASTER_007_MTATransformer.js가
      // raw "Lead Source" 필드를 읽어 Master엔 "First Lead Source"로 저장(리네임).
      // "Lead Source"로 읽으면 undefined가 되어 leadSource 기반 규칙(Referral 등)이
      // 전부 깨지는 버그 발견(2026-08-26, "Referral → Other" 662건 오탐의 원인).
      leadSource: r["First Lead Source"],
      category: r["Lead Source Category"],
      id: r["Lead ID"]
    };
  };

  diffBusinessSegment3Way_(records, rowToArgs, utmProgramMap, programSegmentMap);

}


/**
 * ==========================================================
 * Diff Business Segment 3-Way (공용 헬퍼, 읽기 전용)
 *
 * WHY
 * Leads_Master/MTA_Master 양쪽에서 동일한 3-way 비교 로직(stored/pure/dict)
 * 을 재사용 — rowToArgs로 필드명 차이만 흡수.
 * ==========================================================
 */
function diffBusinessSegment3Way_(records, rowToArgs, utmProgramMap, programSegmentMap){

  const driftTransitions = {};   // stored != pure (이번 작업과 무관)
  const driftSamples = {};
  const dictTransitions = {};    // pure != dict (딕셔너리가 실제로 바꾼 것)
  const dictSamples = {};

  let driftCount = 0;
  let dictCount = 0;

  records.forEach(function(r){

    const args = rowToArgs(r);

    const stored = String(r["Business Segment"] || "(공란)");
    const pure = getBusinessSegment(args.campaign, args.detail, args.leadSource, args.category);
    const dict = resolveBusinessSegmentPure_(args.campaign, args.detail, args.leadSource, args.category, programSegmentMap, utmProgramMap);

    if(stored !== pure){

      driftCount++;

      const key = stored + " → " + pure;
      driftTransitions[key] = (driftTransitions[key] || 0) + 1;

      if(!driftSamples[key]) driftSamples[key] = [];
      if(driftSamples[key].length < 3){
        driftSamples[key].push("Lead ID=" + args.id + " Detail=\"" + args.detail + "\"");
      }

    }

    if(pure !== dict){

      dictCount++;

      const key = pure + " → " + dict;
      dictTransitions[key] = (dictTransitions[key] || 0) + 1;

      if(!dictSamples[key]) dictSamples[key] = [];
      if(dictSamples[key].length < 5){

        const canonicalProgram = resolveCanonicalProgram_(args.campaign, args.detail, utmProgramMap);

        dictSamples[key].push(
          "Lead ID=" + args.id + " Campaign=\"" + args.campaign + "\" Detail=\"" + args.detail +
          "\" canonicalProgram=\"" + canonicalProgram + "\""
        );

      }

    }

  });

  Logger.log("전체 " + records.length + "건");
  Logger.log("");
  Logger.log("--- ① 키워드 규칙 드리프트 (stored → pure, 이번 작업과 무관, 참고용) ---");
  Logger.log("변경 " + driftCount + "건");
  Object.keys(driftTransitions).sort().forEach(function(key){
    Logger.log(key + ": " + driftTransitions[key] + "건");
    driftSamples[key].forEach(function(s){ Logger.log("  " + s); });
  });

  Logger.log("");
  Logger.log("--- ② 딕셔너리 자체의 영향 (pure → dict, 이번 작업의 실제 변경분, 육안 검토 대상) ---");
  Logger.log("변경 " + dictCount + "건");
  Object.keys(dictTransitions).sort().forEach(function(key){
    Logger.log(key + ": " + dictTransitions[key] + "건");
    dictSamples[key].forEach(function(s){ Logger.log("  " + s); });
  });

}
