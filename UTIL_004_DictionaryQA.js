/**
 * ==========================================================
 * Marketing 2.0
 * Dictionary QA — Program_Segment_Dictionary "특이 분류" 모니터링
 *
 * Responsibility
 * `Program_Segment_Dictionary`(UTIL_002_UtmProgramDictionary.js, Marketo
 * Program → Business Segment 자동 채굴 딕셔너리)가 매 갱신 사이클마다
 * 소수 오분류를 그대로 학습해 전파할 위험을 사람이 주기적으로 육안
 * 검토할 수 있도록, 세 가지 "특이 분류"를 `Marketo_QA` 시트에 플래깅한다.
 *
 * WHY
 * `docs/OpenItems.md` #34(2026-08-26 사용자 요청, 2026-09-04 설계 확정) —
 * `resolveDefiniteBusinessSegment_()`로 확정 신호는 우선권을 갖도록 막아
 * 뒀지만, 그 밖 fallback 영역(딕셔너리 다수결)은 여전히 소수 오분류가
 * 조용히 전파될 구조적 위험이 있음. 사용자 확정(2026-09-04): 플래깅
 * 대상은 (1) 확신도 낮은 신규 Program 키, (2) 다수결이 뒤집힌 기존 키,
 * (3) 애매한 키(Distinct Segment Count > 1) 3종 전부, 출력 위치는 신규
 * 시트 "Marketo_QA".
 *
 * 플래깅 기준
 * - **확신도 낮은 신규 키**: 이전 사이클엔 없던 Program 키가 이번에
 *   새로 등장했는데 matchCount/totalCount 비율이
 *   `CONFIG.MARKETO_QA.LOW_CONFIDENCE_THRESHOLD` 미만.
 * - **다수결 뒤집힘**: 이전 사이클에도 있던 Program 키인데 채택된
 *   Business Segment가 이번 사이클에 달라짐.
 * - **애매한 키**: Distinct Segment Count > 1(이미 소비처
 *   `readProgramSegmentDictionaryMap_()`에서 자동 제외되지만, 사람이
 *   해결하기 전까진 매 사이클 계속 플래깅되어야 함 — 사용자 확정).
 *
 * UTM 단위 분리 (2026-09-04 추가, 사용자 요청 — "여러 개 묶여있는건
 * 하나하나씩 분류해야할거같고, 단일인데 오분류는 바로 분류 가능")
 * `Program`(=First Touch Detail/Lead Source Detail 원문 텍스트)에 실제로는
 * 서로 다른 UTM Campaign 여러 개가 매칭되는 경우가 있음(`resolveCanonicalProgram_()`
 * 이 detail을 그대로 Program 키로 쓰기 때문 — 같은 detail 값을 여러 실제
 * 캠페인이 공유하면 그 밑에 서로 다른 UTM들이 뭉침). 이 경우 Program 하나에
 * Segment 하나를 매기면 그 안에 섞인 일부 UTM은 틀리게 됨 — 그래서 Program이
 * 매칭되는 UTM을 갖고 있으면(1개든 여러 개든) `explodeAnomaliesByUtm_()`가
 * **UTM별로 행을 펼쳐서** 각 UTM을 독립적으로 검토·override 가능하게 한다
 * (매칭 UTM이 없는 Program만 예외적으로 Program 단위 행 1개 유지). 결과적으로
 * "단일 UTM Program"은 자연히 딱 1행만 나와 바로 판단 가능하고, "복수 UTM
 * Program"은 UTM 개수만큼 행이 나눠져 하나씩 검토하게 됨.
 *
 * Override 반영 (2026-09-04 설계 → 2026-09-04 재설계·확장, 사용자 요청)
 * `Marketo_QA`는 매 사이클 clear + 재작성되는 스냅샷이라 그 시트를 직접
 * 고쳐도 다음 갱신에 사라진다. `Marketo_QA`의 "Override (직접 입력)" 컬럼
 * (드롭다운 — `CONFIG.MARKETO_QA.BUSINESS_SEGMENT_OPTIONS`로 Data Validation
 * 강제, 자유 텍스트 아님)에 사람이 값을 선택하면:
 * - 다음 갱신 사이클이 `Marketo_QA`를 clear하기 **직전**에
 *   `readMarketoQAOverrideColumnValues_()`가 그 컬럼값을 (UTM 컬럼이 채워진
 *   행이면 UTM 단위로, 비어있으면 Program 단위로) 읽어 각각
 *   `CONFIG.MARKETO_QA.UTM_OVERRIDE_SHEET`("UTM_Segment_Override")/
 *   `OVERRIDE_SHEET`("Program_Segment_Override")에 병합·저장한다.
 * - UTM 단위 override는 `resolveBusinessSegment_()`(UTIL_002_UtmProgramDictionary.js
 *   v1.12.0)가 Program 딕셔너리/확정 신호보다도 먼저 최우선으로 적용.
 *   Program 단위 override는 `readProgramSegmentDictionaryMap_()`(v1.11.0)가
 *   자동 다수결보다 우선 적용(UTM 매칭이 아예 없는 Program에만 해당).
 * - override된 UTM/Program은 이후 `Marketo_QA`에 재플래깅되지 않음(사용자
 *   확정) — 같은 사이클에서 캡처한 값도 바로 이번 사이클 출력부터 제외.
 *
 * 표시 컬럼 (2026-09-04, 사용자 요청 — "판단에 필요한 건 Program/UTM/현재
 * Segment면 충분")
 * `Marketo_QA`는 판정 근거(Anomaly Type/이전 Segment/Match·Total Count/
 * Confidence/Distinct Segment Count)를 컬럼으로 노출하지 않는다 — 내부
 * 로직은 그대로 이 값들을 계산·사용하지만, 사람이 보는 시트는 Marketo
 * Program/UTM Campaign/Business Segment (현재)/Override (직접 입력) 4개
 * 컬럼뿐.
 *
 * Must NOT
 * - `Program_Segment_Dictionary` 시트 자체의 다수결/필터 로직을 바꾸지 않음
 *   (UTIL_002_UtmProgramDictionary.js 영역, 이 파일은 순수 모니터링만)
 * - 매 사이클 `Marketo_QA`를 clear + 재작성 — 이전 사이클 플래깅 이력을
 *   누적 보관하지 않음(Leads_OPS_QA/P1_School_Mismatch_QA와 동일 관행,
 *   "현재 상태"만 보여주는 스냅샷 시트). **단, clear 직전에 반드시
 *   "Override (직접 입력)" 컬럼값부터 읽어(`readMarketoQAOverrideColumnValues_()`)
 *   해당 저장소에 병합해둔 뒤에 clear할 것 — 순서가 바뀌면 사람이 입력한
 *   값이 반영 전에 그대로 날아간다**
 *
 * Version
 * v2.0.0
 *
 * Change Log
 * v2.0.0 (2026-09-04)
 * - **UTM 단위 explode + override selector 드롭다운 추가**(사용자 요청 —
 *   실제 예시로 `ca_cgahq_2024-03-06_search-curriculum-courses_contact` 등
 *   여러 UTM이 섞인 Program 3건을 지적하며 "이러면 분리해야 분류가
 *   가능하다"). `attachUtmCampaignsToAnomalies_()`(joined 문자열 1행)를
 *   폐기하고 `explodeAnomaliesByUtm_()`(UTM별 개별 행, 순수 함수)로 교체 —
 *   `sortAnomaliesForReview_()`는 UTM 개수 정렬 대신 program→utm 알파벳순
 *   정렬로 단순화(explode 후엔 모든 행이 이미 원자적이라 개수 정렬 자체가
 *   불필요해짐). `filterOutOverriddenProgramAnomalies_()`(Program 단위
 *   전용)를 `filterOutOverriddenRows_()`(UTM 단위/Program 단위 겸용)로
 *   교체. `readUtmSegmentOverrideMap_()`/`ensureOverrideSheetExists_()`/
 *   `writeOverrideMap_()`(Program/UTM 양쪽이 공유하는 범용 IO) 신규 —
 *   `mergeProgramSegmentOverrides_()`는 도메인 무관 범용 함수라
 *   `mergeOverrideMaps_()`로 개명(Program/UTM 양쪽에 재사용). Marketo_QA
 *   "Override (직접 입력)" 컬럼에 `CONFIG.MARKETO_QA.BUSINESS_SEGMENT_OPTIONS`
 *   기반 Data Validation(드롭다운) 적용 — 자유 텍스트 대신 클릭 선택
 *   (사용자 요청 — "selector가 나오도록, 그냥 클릭변경이 가능하게").
 *   **배포 직전 발견·수정**: `filterOutOverriddenRows_()`가 UTM 단위 행을
 *   UTM override map으로만 판단하면, v1.x에서 이미 Program 단위로 확정해둔
 *   항목이 그 Program에 매칭되는 UTM이 있다는 이유만으로 재플래깅되는
 *   오탐이 생김(실제 분류는 `resolveBusinessSegment_()`가 Program override로
 *   이미 정상 폴백하고 있는데 QA만 못 따라가는 상태) — UTM 단위 행도
 *   Program override map을 먼저 확인하도록 수정. **실행 오류 발견·수정**:
 *   `sheet.clearDataValidations()`는 존재하지 않는 메서드(Range에만 있음,
 *   실측 "is not a function" 에러로 발견) — `sheet.getRange(1,1,maxRows,
 *   maxCols).clearDataValidations()`로 수정.
 * v1.3.0 (2026-09-04)
 * - 표시 간소화(컬럼 10개→4개, 판정 근거 비표시) + `dedupeAnomaliesByProgram_()`
 *   신규(Anomaly Type 컬럼 제거로 생긴 겉보기 중복 행 제거) +
 *   `readMarketoQAOverrideColumnValues_()`를 고정 인덱스 대신 실제 시트
 *   헤더 텍스트로 컬럼을 찾도록 전환(레이아웃 변경 중에도 안전).
 * v1.2.0 (2026-09-04)
 * - **Override 입력 위치 재설계**(사용자 요청) — 별도 시트에 사람이 직접
 *   입력하던 방식을 `Marketo_QA` 자체의 마지막 컬럼에서 바로 입력하는
 *   방식으로 전환.
 * v1.1.0 (2026-09-04)
 * - Override 반영(Program 단위) + UTM Campaign 표시(joined 문자열) 추가.
 * v1.0.0 (2026-09-04)
 * - 최초 구현.
 * ==========================================================
 */


const MARKETO_QA_HEADERS = [
  "Marketo Program",
  "UTM Campaign",
  "Business Segment (현재)",
  "Override (직접 입력)"
];


/**
 * ==========================================================
 * Detect Program Segment Dictionary Anomalies (순수 함수)
 *
 * INPUT
 * previousEntries : Array<{program, segment, matchCount, totalCount, distinctSegmentCount}>
 *   갱신 직전(이전 사이클) 스냅샷
 * newEntries : Array<{program, segment, matchCount, totalCount, distinctSegmentCount}>
 *   갱신 직후(이번 사이클) 스냅샷
 * lowConfidenceThreshold : number  (0~1) — 이 미만이면 "확신도 낮음"
 *
 * OUTPUT
 * Array<{program, type, segment, previousSegment, matchCount, totalCount,
 *   distinctSegmentCount, confidence}>
 *   type 오름차순 → program 오름차순 정렬(결정적 결과 보장)
 * ==========================================================
 */
function detectProgramSegmentDictionaryAnomalies_(previousEntries, newEntries, lowConfidenceThreshold){

  const previousByProgram = {};

  (previousEntries || []).forEach(function(e){
    previousByProgram[e.program] = e;
  });

  const flagged = [];

  (newEntries || []).forEach(function(entry){

    const confidence = entry.totalCount > 0 ? entry.matchCount / entry.totalCount : 0;
    const previous = previousByProgram[entry.program];

    if(!previous){

      if(confidence < lowConfidenceThreshold){
        flagged.push(makeAnomalyRow_(entry, "확신도 낮은 신규 키", "", confidence));
      }

    } else if(previous.segment !== entry.segment){

      flagged.push(makeAnomalyRow_(entry, "다수결 뒤집힘", previous.segment, confidence));

    }

    if(entry.distinctSegmentCount > 1){
      flagged.push(makeAnomalyRow_(entry, "애매한 키 (Distinct Segment > 1)", "", confidence));
    }

  });

  flagged.sort(function(a, b){
    if(a.type !== b.type) return a.type < b.type ? -1 : 1;
    return a.program < b.program ? -1 : (a.program > b.program ? 1 : 0);
  });

  return flagged;

}


function makeAnomalyRow_(entry, type, previousSegment, confidence){

  return {
    program: entry.program,
    type: type,
    segment: entry.segment,
    previousSegment: previousSegment,
    matchCount: entry.matchCount,
    totalCount: entry.totalCount,
    distinctSegmentCount: entry.distinctSegmentCount,
    confidence: confidence
  };

}


/**
 * ==========================================================
 * TEST — detectProgramSegmentDictionaryAnomalies_()
 * ==========================================================
 */
function testDetectProgramSegmentDictionaryAnomalies(){

  const previousEntries = [
    { program: "existing-stable", segment: "Search", matchCount: 10, totalCount: 10, distinctSegmentCount: 1 },
    { program: "existing-flips", segment: "BOFU", matchCount: 5, totalCount: 6, distinctSegmentCount: 2 }
  ];

  const newEntries = [
    // 기존 키, 안정적 — 플래깅 없음
    { program: "existing-stable", segment: "Search", matchCount: 11, totalCount: 11, distinctSegmentCount: 1 },
    // 기존 키, 다수결 뒤집힘 + 여전히 애매함(2건 플래깅)
    { program: "existing-flips", segment: "Content", matchCount: 4, totalCount: 7, distinctSegmentCount: 2 },
    // 신규 키, 확신도 낮음(0.6 < 0.7) — 플래깅
    { program: "new-low-confidence", segment: "Other", matchCount: 3, totalCount: 5, distinctSegmentCount: 1 },
    // 신규 키, 확신도 높음 — 플래깅 없음
    { program: "new-high-confidence", segment: "Content", matchCount: 9, totalCount: 10, distinctSegmentCount: 1 },
    // totalCount=0 방어(0으로 나누기) — confidence 0으로 처리, threshold 미만이라 플래깅
    { program: "new-zero-total", segment: "Other", matchCount: 0, totalCount: 0, distinctSegmentCount: 1 }
  ];

  const result = detectProgramSegmentDictionaryAnomalies_(previousEntries, newEntries, 0.7);

  const stable = result.filter(function(r){ return r.program === "existing-stable"; });
  const flips = result.filter(function(r){ return r.program === "existing-flips"; });
  const lowConf = result.filter(function(r){ return r.program === "new-low-confidence"; });
  const highConf = result.filter(function(r){ return r.program === "new-high-confidence"; });
  const zeroTotal = result.filter(function(r){ return r.program === "new-zero-total"; });

  const pass =
    result.length === 4 &&
    stable.length === 0 &&
    flips.length === 2 &&
    flips.some(function(r){ return r.type === "다수결 뒤집힘" && r.previousSegment === "BOFU" && r.segment === "Content"; }) &&
    flips.some(function(r){ return r.type === "애매한 키 (Distinct Segment > 1)"; }) &&
    lowConf.length === 1 && lowConf[0].type === "확신도 낮은 신규 키" &&
    highConf.length === 0 &&
    zeroTotal.length === 1 && zeroTotal[0].confidence === 0;

  Logger.log("Result: " + JSON.stringify(result, null, 2));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Dedupe Anomalies By Program (순수 함수)
 *
 * WHY
 * 같은 Program이 여러 이유(예: 다수결 뒤집힘 + 애매한 키)로 동시에
 * 플래깅되면 detectProgramSegmentDictionaryAnomalies_()가 Program당 여러
 * 행을 반환하는데, Marketo_QA에서 Anomaly Type 컬럼을 없앤 뒤로는 이게
 * 겉보기엔 완전히 똑같은 행이 중복으로 보임 — Program당 1행만 남긴다
 * (처음 등장한 것 유지, 어차피 program/segment 정보는 동일).
 * ==========================================================
 */
function dedupeAnomaliesByProgram_(anomalies){

  const seen = {};
  const result = [];

  (anomalies || []).forEach(function(a){

    const programKey = String(a.program || "").trim().toLowerCase();

    if(seen[programKey]) return;

    seen[programKey] = true;
    result.push(a);

  });

  return result;

}


/**
 * ==========================================================
 * TEST — dedupeAnomaliesByProgram_()
 * ==========================================================
 */
function testDedupeAnomaliesByProgram(){

  const anomalies = [
    { program: "program-a", type: "다수결 뒤집힘" },
    { program: "program-b", type: "확신도 낮은 신규 키" },
    { program: "program-a", type: "애매한 키 (Distinct Segment > 1)" }
  ];

  const result = dedupeAnomaliesByProgram_(anomalies);

  const pass =
    result.length === 2 &&
    result[0].program === "program-a" &&
    result[0].type === "다수결 뒤집힘" && // 첫 등장분 유지
    result[1].program === "program-b";

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Read All Program Segment Dictionary Entries (IO 래퍼)
 *
 * WHY
 * `readProgramSegmentDictionaryMap_()`(UTIL_002_UtmProgramDictionary.js)는
 * 소비(Business Segment 분류)용이라 Distinct Segment Count > 1인 애매한
 * 키를 이미 걸러내고 반환함 — 이 모니터링은 그 걸러진 키까지 전부 봐야
 * 하므로 필터 없이 5개 core 컬럼 그대로 읽는 별도 리더가 필요.
 *
 * OUTPUT
 * Array<{program, segment, matchCount, totalCount, distinctSegmentCount}>
 * ==========================================================
 */
function readAllProgramSegmentDictionaryEntries_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.PROGRAM_SEGMENT_DICT.SHEET);

  if(!sheet) return [];

  const lastRow = sheet.getLastRow();

  if(lastRow <= 1) return [];

  // core 5컬럼만(Marketo Program/Business Segment/Match Count/Total Count/
  // Distinct Segment Count) — hidden JSON 컬럼(6/7)은 이 모니터링에 불필요.
  const values = sheet.getRange(2, 1, lastRow - 1, 5).getValues();

  return values.map(function(row){
    return {
      program: String(row[0] || ""),
      segment: String(row[1] || ""),
      matchCount: Number(row[2]) || 0,
      totalCount: Number(row[3]) || 0,
      distinctSegmentCount: Number(row[4]) || 0
    };
  });

}


/**
 * ==========================================================
 * Read All UTM Program Dictionary Entries (IO 래퍼)
 *
 * WHY
 * Marketo_QA에서 Program을 UTM 단위로 펼치려면 `UTM_Program_Dictionary`
 * (UTIL_002_UtmProgramDictionary.js, UTM → Program 방향)를 Program → UTM
 * 목록으로 역인덱싱해야 한다 — 그 역인덱싱 전 원본 5개 core 컬럼 리더.
 *
 * OUTPUT
 * Array<{utm, program, matchCount, totalCount, distinctProgramCount}>
 * ==========================================================
 */
function readAllUtmProgramDictionaryEntries_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.UTM_PROGRAM_DICT.SHEET);

  if(!sheet) return [];

  const lastRow = sheet.getLastRow();

  if(lastRow <= 1) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, 5).getValues();

  return values.map(function(row){
    return {
      utm: String(row[0] || ""),
      program: String(row[1] || ""),
      matchCount: Number(row[2]) || 0,
      totalCount: Number(row[3]) || 0,
      distinctProgramCount: Number(row[4]) || 0
    };
  });

}


/**
 * ==========================================================
 * Build Program → UTM Campaigns Map (순수 함수)
 *
 * WHY
 * UTM_Program_Dictionary는 UTM별로 채택된 Program 1개를 갖는(다수결) 구조라,
 * 여러 UTM이 같은 Program으로 수렴하는 게 정상 — 역방향(이 Program을 만드는
 * UTM들)을 보여주려면 전체를 훑어 program 키로 그룹핑해야 한다.
 *
 * INPUT
 * utmEntries : Array<{utm, program, matchCount, totalCount, distinctProgramCount}>
 *
 * OUTPUT
 * Object  { programKeyLower: Array<string> }  UTM 알파벳순 정렬, 중복 없음
 * ==========================================================
 */
function buildProgramToUtmCampaignsMap_(utmEntries){

  const map = {};

  (utmEntries || []).forEach(function(e){

    const programKey = String(e.program || "").trim().toLowerCase();

    if(!programKey) return;

    if(!map[programKey]) map[programKey] = [];

    if(map[programKey].indexOf(e.utm) === -1){
      map[programKey].push(e.utm);
    }

  });

  Object.keys(map).forEach(function(key){
    map[key].sort();
  });

  return map;

}


/**
 * ==========================================================
 * TEST — buildProgramToUtmCampaignsMap_()
 * ==========================================================
 */
function testBuildProgramToUtmCampaignsMap(){

  const utmEntries = [
    { utm: "kr_core_utm_b", program: "Program A", matchCount: 1, totalCount: 1, distinctProgramCount: 1 },
    { utm: "kr_core_utm_a", program: "Program A", matchCount: 1, totalCount: 1, distinctProgramCount: 1 },
    { utm: "kr_core_utm_c", program: "Program B", matchCount: 1, totalCount: 1, distinctProgramCount: 1 },
    // 중복 UTM(같은 program 재등장) — 한 번만 남아야 함
    { utm: "kr_core_utm_a", program: "Program A", matchCount: 1, totalCount: 1, distinctProgramCount: 1 },
    // program 빈값 — 무시
    { utm: "kr_core_utm_orphan", program: "", matchCount: 1, totalCount: 1, distinctProgramCount: 1 }
  ];

  const result = buildProgramToUtmCampaignsMap_(utmEntries);

  const pass =
    Object.keys(result).length === 2 &&
    JSON.stringify(result["program a"]) === JSON.stringify(["kr_core_utm_a", "kr_core_utm_b"]) &&
    JSON.stringify(result["program b"]) === JSON.stringify(["kr_core_utm_c"]);

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Explode Anomalies By UTM (순수 함수, 2026-09-04 신규)
 *
 * WHY
 * 사용자 확정 — 여러 UTM이 하나의 Program(detail 텍스트)으로 묶인 경우
 * Program 단위 판단 하나로는 부족하고 UTM 하나하나를 따로 검토해야 함.
 * 매칭 UTM이 있는 Program은 UTM 개수만큼 행을 만들고(각 행은 `utm`
 * 필드로 자신의 override 저장 대상이 UTM 단위임을 표시), 매칭 UTM이
 * 전혀 없는 Program(옛 attachUtmCampaignsToAnomalies_의 "빈 UTM" 케이스)은
 * Program 단위 행 1개만 유지(`utm: ""`로 표시 — Program 단위 override
 * 대상).
 *
 * INPUT
 * anomalies : Array<{program, segment, ...}>  dedupeAnomaliesByProgram_() 출력
 * programToUtmMap : Object  buildProgramToUtmCampaignsMap_() 출력
 *
 * OUTPUT
 * Array<{program, utm, segment, ...원본 필드 유지}>  utm이 ""이면 Program
 *   단위 행, 아니면 UTM 단위 행
 * ==========================================================
 */
function explodeAnomaliesByUtm_(anomalies, programToUtmMap){

  const exploded = [];

  (anomalies || []).forEach(function(a){

    const programKey = String(a.program || "").trim().toLowerCase();
    const utms = (programToUtmMap && programToUtmMap[programKey]) || [];

    if(utms.length === 0){

      const copy = {};
      Object.keys(a).forEach(function(key){ copy[key] = a[key]; });
      copy.utm = "";
      exploded.push(copy);

      return;

    }

    utms.forEach(function(utm){

      const copy = {};
      Object.keys(a).forEach(function(key){ copy[key] = a[key]; });
      copy.utm = utm;
      exploded.push(copy);

    });

  });

  return exploded;

}


/**
 * ==========================================================
 * TEST — explodeAnomaliesByUtm_()
 * ==========================================================
 */
function testExplodeAnomaliesByUtm(){

  const anomalies = [
    { program: "multi-utm-program", segment: "Search" },
    { program: "single-utm-program", segment: "BOFU" },
    { program: "no-utm-program", segment: "Content" }
  ];

  const programToUtmMap = {
    "multi-utm-program": ["utm-a", "utm-b", "utm-c"],
    "single-utm-program": ["utm-d"]
  };

  const result = explodeAnomaliesByUtm_(anomalies, programToUtmMap);

  const multiRows = result.filter(function(r){ return r.program === "multi-utm-program"; });
  const singleRows = result.filter(function(r){ return r.program === "single-utm-program"; });
  const noUtmRows = result.filter(function(r){ return r.program === "no-utm-program"; });

  const pass =
    result.length === 5 &&
    multiRows.length === 3 &&
    multiRows.map(function(r){ return r.utm; }).join(",") === "utm-a,utm-b,utm-c" &&
    singleRows.length === 1 && singleRows[0].utm === "utm-d" &&
    noUtmRows.length === 1 && noUtmRows[0].utm === "" &&
    // 원본 배열 불변(순수 함수)
    anomalies[0].utm === undefined;

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Sort Anomalies For Review (순수 함수)
 *
 * WHY
 * explode 이후엔 모든 행이 이미 원자적(Program+UTM 조합 1개)이라, Program →
 * UTM 알파벳순으로만 정렬해도 같은 Program에서 나온 행끼리 붙어서 보여
 * 검토하기 편함(결정적 결과 보장).
 * ==========================================================
 */
function sortAnomaliesForReview_(anomalies){

  const copy = (anomalies || []).slice();

  copy.sort(function(a, b){
    if(a.program !== b.program) return a.program < b.program ? -1 : 1;
    return a.utm < b.utm ? -1 : (a.utm > b.utm ? 1 : 0);
  });

  return copy;

}


/**
 * ==========================================================
 * TEST — sortAnomaliesForReview_()
 * ==========================================================
 */
function testSortAnomaliesForReview(){

  const anomalies = [
    { program: "program-b", utm: "" },
    { program: "program-a", utm: "utm-c" },
    { program: "program-a", utm: "utm-a" }
  ];

  const result = sortAnomaliesForReview_(anomalies);

  const pass =
    result.map(function(r){ return r.program + ":" + r.utm; }).join(",") ===
    "program-a:utm-a,program-a:utm-c,program-b:" &&
    // 원본 배열 불변(순수 함수)
    anomalies[0].program === "program-b";

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Merge Override Maps (순수 함수)
 *
 * WHY
 * 기존에 누적된 override(사람이 그 시트를 직접 편집한 경우 포함)와 이번
 * 사이클에 Marketo_QA 컬럼에서 새로 캡처한 값을 합친다 — 신규값이 충돌 시
 * 우선(가장 최근 사람의 의도). Program 단위/UTM 단위 양쪽 override 병합에
 * 공용으로 재사용(도메인 무관 범용 key-value 병합).
 * ==========================================================
 */
function mergeOverrideMaps_(existingMap, newOverrides){

  const merged = {};

  Object.keys(existingMap || {}).forEach(function(key){ merged[key] = existingMap[key]; });
  Object.keys(newOverrides || {}).forEach(function(key){ merged[key] = newOverrides[key]; });

  return merged;

}


/**
 * ==========================================================
 * TEST — mergeOverrideMaps_()
 * ==========================================================
 */
function testMergeOverrideMaps(){

  const existingMap = { "program a": "BOFU", "program b": "Search" };
  const newOverrides = { "program b": "Content", "program c": "Webinar" };

  const result = mergeOverrideMaps_(existingMap, newOverrides);

  const pass =
    Object.keys(result).length === 3 &&
    result["program a"] === "BOFU" &&
    result["program b"] === "Content" && // 신규값이 기존값을 덮어씀
    result["program c"] === "Webinar";

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Filter Out Overridden Rows (순수 함수)
 *
 * WHY
 * 사람이 이미 확정한(UTM 단위든 Program 단위든) 행은 "해결된 것"으로 간주
 * — Marketo_QA에 계속 재플래깅되면 매번 다시 검토해야 해서 사용자 확정으로
 * 제외 대상. **UTM 단위 override와 Program 단위 override 둘 다 확인** —
 * `resolveBusinessSegment_()`(UTIL_002_UtmProgramDictionary.js v1.12.0)가
 * 실제로 이 두 단계를 겸비해서 판정하므로(UTM override 없으면 Program
 * override로 폴백), QA 재플래깅 판단도 동일 규칙을 따라야 한다. 이걸
 * 놓치면 v2.0.0 explode 도입 전 Program 단위로 이미 확정해둔 항목이,
 * 그 Program에 매칭되는 UTM이 있다는 이유만으로 다시 플래깅되는(실제로는
 * 이미 올바르게 분류되고 있는데) 오탐이 생김(2026-09-04 배포 직전 발견).
 * ==========================================================
 */
function filterOutOverriddenRows_(rows, programOverrideMap, utmOverrideMap){

  return (rows || []).filter(function(r){

    const programKey = String(r.program || "").trim().toLowerCase();

    if(programOverrideMap && Object.prototype.hasOwnProperty.call(programOverrideMap, programKey)){
      return false;
    }

    if(r.utm){
      const utmKey = String(r.utm).trim().toLowerCase();
      if(utmOverrideMap && Object.prototype.hasOwnProperty.call(utmOverrideMap, utmKey)){
        return false;
      }
    }

    return true;

  });

}


/**
 * ==========================================================
 * TEST — filterOutOverriddenRows_()
 * ==========================================================
 */
function testFilterOutOverriddenRows(){

  const rows = [
    { program: "shared-program", utm: "overridden-utm" },
    { program: "shared-program", utm: "still-flagged-utm" },
    { program: "overridden-program", utm: "" },
    { program: "still-flagged-program", utm: "" },
    // 2026-09-04 배포 직전 발견한 케이스 — Program 단위로 이미 확정된
    // Program에 매칭되는 UTM 행은, 그 UTM 자체가 override map에 없어도
    // Program override로 폴백해 제외돼야 함(resolveBusinessSegment_()의
    // 실제 판정 순서와 일치시키기 위함).
    { program: "overridden-program", utm: "utm-under-overridden-program" }
  ];

  const programOverrideMap = { "overridden-program": "BOFU" };
  const utmOverrideMap = { "overridden-utm": "Search" };

  const result = filterOutOverriddenRows_(rows, programOverrideMap, utmOverrideMap);

  const pass =
    result.length === 2 &&
    result.some(function(r){ return r.utm === "still-flagged-utm"; }) &&
    result.some(function(r){ return r.program === "still-flagged-program" && r.utm === ""; }) &&
    !result.some(function(r){ return r.program === "overridden-program"; });

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Ensure Override Sheet Exists (IO 래퍼)
 *
 * WHY
 * Program 단위/UTM 단위 override 저장소가 둘 다 같은 모양(2컬럼: 키/
 * Business Segment)이라 공용 — 시트가 없으면 헤더만 갖춘 빈 시트를
 * 미리 만든다(존재하면 아무것도 안 함, 재실행 안전).
 * ==========================================================
 */
function ensureOverrideSheetExists_(sheetName, keyColumnLabel){

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(sheetName);

  if(sheet) return;

  sheet = ss.insertSheet(sheetName);

  sheet.getRange(1, 1, 1, 2)
    .setValues([[keyColumnLabel, "Business Segment"]])
    .setFontWeight("bold");

  sheet.setFrozenRows(1);

  SpreadsheetApp.flush();

}


/**
 * ==========================================================
 * TEMP — Program_Segment_Override/UTM_Segment_Override 시트 준비(수동
 * 실행용 공개 진입점, Apps Script 편집기에서 직접 Run, 1회면 충분·재실행
 * 안전)
 * ==========================================================
 */
function runEnsureOverrideSheets(){

  ensureOverrideSheetExists_(CONFIG.MARKETO_QA.OVERRIDE_SHEET, "Marketo Program");
  ensureOverrideSheetExists_(CONFIG.MARKETO_QA.UTM_OVERRIDE_SHEET, "UTM Campaign");

  Logger.log(
    CONFIG.LOG.PREFIX + " " + CONFIG.MARKETO_QA.OVERRIDE_SHEET + " / " +
    CONFIG.MARKETO_QA.UTM_OVERRIDE_SHEET + " 시트 준비 완료 — 평소엔 " +
    CONFIG.MARKETO_QA.SHEET + "의 \"Override (직접 입력)\" 드롭다운에서 선택하면 " +
    "자동으로 이 시트들에 동기화됨(직접 편집도 가능)."
  );

}


/**
 * ==========================================================
 * Write Override Map (IO 래퍼)
 *
 * WHY
 * 병합된 override map을 저장 — clear+재작성(키 알파벳순 정렬로 diff
 * 가독성 확보). Program 단위/UTM 단위 양쪽 저장에 공용 재사용.
 * ==========================================================
 */
function writeOverrideMap_(sheetName, keyColumnLabel, map){

  ensureOverrideSheetExists_(sheetName, keyColumnLabel);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  const keys = Object.keys(map || {}).sort();

  sheet.clearContents();

  sheet.getRange(1, 1, 1, 2)
    .setValues([[keyColumnLabel, "Business Segment"]])
    .setFontWeight("bold");

  if(keys.length > 0){

    const rows = keys.map(function(key){
      return [key, map[key]];
    });

    sheet.getRange(2, 1, rows.length, 2).setValues(rows);

  }

  sheet.setFrozenRows(1);

  SpreadsheetApp.flush();

}


/**
 * ==========================================================
 * Read Program Segment Override Map (IO 래퍼)
 *
 * OUTPUT
 * Object  { programKeyLower: Business Segment명 }
 * ==========================================================
 */
function readProgramSegmentOverrideMap_(){
  return readKeyValueSheetAsMap_(CONFIG.MARKETO_QA.OVERRIDE_SHEET);
}


/**
 * ==========================================================
 * Read UTM Segment Override Map (IO 래퍼, 2026-09-04 신규)
 *
 * OUTPUT
 * Object  { utmKeyLower: Business Segment명 }
 * ==========================================================
 */
function readUtmSegmentOverrideMap_(){
  return readKeyValueSheetAsMap_(CONFIG.MARKETO_QA.UTM_OVERRIDE_SHEET);
}


/**
 * ==========================================================
 * Read Key-Value Sheet As Map (IO 래퍼, 2026-09-04 신규)
 *
 * WHY
 * Program_Segment_Override/UTM_Segment_Override가 같은 2컬럼(키/Business
 * Segment) 모양이라 읽기 로직 공용화.
 * ==========================================================
 */
function readKeyValueSheetAsMap_(sheetName){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  const map = {};

  if(!sheet) return map;

  const lastRow = sheet.getLastRow();

  if(lastRow <= 1) return map;

  const values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();

  values.forEach(function(row){

    const key = String(row[0] || "").trim().toLowerCase();
    const segment = String(row[1] || "").trim();

    if(key && segment){
      map[key] = segment;
    }

  });

  return map;

}


/**
 * ==========================================================
 * Read Marketo QA Override Column Values (IO 래퍼)
 *
 * WHY
 * `Marketo_QA`는 매 사이클 clear+재작성되므로, 사람이 "Override (직접
 * 입력)" 컬럼에 입력한 값은 그 clear가 일어나기 **직전**에 반드시 먼저
 * 읽어둬야 한다. UTM 컬럼이 채워진 행은 UTM 단위 override로, 비어있는
 * 행은 Program 단위 override로 분리해서 반환.
 *
 * ⚠️ 컬럼 위치를 `MARKETO_QA_HEADERS` 상수가 아니라 **그 순간 실제 시트의
 * 헤더 행(1행) 텍스트**에서 찾는다 — 컬럼 레이아웃이 바뀌는 배포 시점에도
 * 이미 입력해둔 override 값을 안전하게 캡처하기 위함.
 *
 * OUTPUT
 * { programOverrides: {programKeyLower: value}, utmOverrides: {utmKeyLower: value} }
 * ==========================================================
 */
function readMarketoQAOverrideColumnValues_(){

  const result = { programOverrides: {}, utmOverrides: {} };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.MARKETO_QA.SHEET);

  if(!sheet) return result;

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if(lastRow <= 1 || lastCol < 1) return result;

  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function(h){ return String(h || "").trim(); });

  const programCol = headerRow.indexOf("Marketo Program") + 1;
  const utmCol = headerRow.indexOf("UTM Campaign") + 1;
  const overrideCol = headerRow.indexOf("Override (직접 입력)") + 1;

  if(programCol === 0 || overrideCol === 0) return result; // 예상 헤더가 없는 시트 — 안전하게 스킵

  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  values.forEach(function(row){

    const program = String(row[programCol - 1] || "").trim().toLowerCase();
    const utm = utmCol > 0 ? String(row[utmCol - 1] || "").trim().toLowerCase() : "";
    const override = String(row[overrideCol - 1] || "").trim();

    if(!override) return;

    if(utm){
      result.utmOverrides[utm] = override;
    } else if(program){
      result.programOverrides[program] = override;
    }

  });

  return result;

}


/**
 * ==========================================================
 * Write Marketo QA Sheet (IO 래퍼)
 *
 * WHY
 * Leads_OPS_QA(24_OPSQA.js)/P1_School_Mismatch_QA(OPS_007_P1SchoolMismatch.js)
 * 와 동일한 "clear + 재작성" 관행 — 매 사이클 현재 플래깅 대상만 보여주는
 * 스냅샷 시트(이력 누적 아님). "Override (직접 입력)" 컬럼에는 Data
 * Validation(드롭다운)을 적용해 자유 텍스트 대신 클릭 선택만 가능하게 함
 * (사용자 요청).
 * ==========================================================
 */
function writeMarketoQASheet_(rows){

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(CONFIG.MARKETO_QA.SHEET);

  if(!sheet){
    sheet = ss.insertSheet(CONFIG.MARKETO_QA.SHEET);
  }

  sheet.clearContents();
  sheet.clearFormats();

  // ⚠️ Sheet에는 clearDataValidations()가 없음(Range에만 존재) — 이전
  // 사이클에서 걸어둔 드롭다운이 남아있지 않도록 현재 시트 최대 범위 전체에서
  // 지운다(2026-09-04 배포 후 실측으로 "sheet.clearDataValidations is not a
  // function" 발견·수정).
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).clearDataValidations();

  sheet.getRange(1, 1, 1, MARKETO_QA_HEADERS.length)
    .setValues([MARKETO_QA_HEADERS])
    .setFontWeight("bold");

  if(rows.length > 0){

    const values = rows.map(function(r){
      return [
        r.program,
        r.utm || "",
        r.segment,
        "" // Override (직접 입력) — 사람이 채울 빈 컬럼
      ];
    });

    sheet.getRange(2, 1, values.length, MARKETO_QA_HEADERS.length).setValues(values);

    const overrideCol = MARKETO_QA_HEADERS.indexOf("Override (직접 입력)") + 1;

    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(CONFIG.MARKETO_QA.BUSINESS_SEGMENT_OPTIONS, true)
      .setAllowInvalid(false)
      .build();

    sheet.getRange(2, overrideCol, values.length, 1).setDataValidation(rule);

  }

  sheet.setFrozenRows(1);

  SpreadsheetApp.flush();

}


/**
 * ==========================================================
 * Refresh Program Segment Dictionary With Anomaly Check (IO 래퍼)
 *
 * WHY
 * `periodicRefreshDictionaries_()`(UTIL_002_UtmProgramDictionary.js)가
 * 호출하는 통합 진입점 — 갱신 직전 스냅샷을 떠 두고, 증분 갱신 실행 후
 * 직후 스냅샷과 비교해 Marketo_QA에 플래깅한다. 갱신 자체(
 * `refreshProgramSegmentDictionaryIncremental_()`)는 이 함수 밖에서 실패
 * 시 그대로 예외를 전파해야 하므로 try/catch 밖에 둔다 — 모니터링(diff+쓰기)
 * 단계만 실패해도 딕셔너리 갱신 자체는 이미 끝난 상태를 보존.
 *
 * ⚠️ 순서 주의: `readMarketoQAOverrideColumnValues_()`(사람이 입력한
 * override 캡처)는 반드시 `writeMarketoQASheet_()`(clear+재작성)보다
 * **먼저** 호출해야 한다 — 순서가 바뀌면 사람이 입력한 값이 반영 전에
 * 그대로 사라진다.
 *
 * 파이프라인: detect → dedupe(Program당 1개) → explode(UTM별로 펼침) →
 * override 필터(UTM/Program 단위 겸용) → 정렬 → 시트 쓰기.
 * ==========================================================
 */
function refreshProgramSegmentDictionaryWithAnomalyCheck_(){

  const previousEntries = readAllProgramSegmentDictionaryEntries_();

  // Marketo_QA가 clear되기 전에 사람이 입력한 override부터 캡처.
  const overridesFromSheet = readMarketoQAOverrideColumnValues_();

  // 갱신 자체는 격리하지 않음 — 실패하면 그대로 위로 전파되어야 호출부
  // (periodicRefreshDictionaries_())가 정상적으로 실행 실패를 인지한다.
  refreshProgramSegmentDictionaryIncremental_();

  // 모니터링(diff+쓰기) 단계는 여기서 격리 — 이 단계가 실패해도 위 갱신은
  // 이미 끝난 상태이므로, 그 성공을 이 단계의 실패로 되돌리거나 감추지 않는다.
  try{

    const newEntries = readAllProgramSegmentDictionaryEntries_();

    const rawAnomalies = detectProgramSegmentDictionaryAnomalies_(
      previousEntries, newEntries, CONFIG.MARKETO_QA.LOW_CONFIDENCE_THRESHOLD
    );

    const mergedProgramOverrideMap = mergeOverrideMaps_(
      readProgramSegmentOverrideMap_(), overridesFromSheet.programOverrides
    );
    writeOverrideMap_(CONFIG.MARKETO_QA.OVERRIDE_SHEET, "Marketo Program", mergedProgramOverrideMap);

    const mergedUtmOverrideMap = mergeOverrideMaps_(
      readUtmSegmentOverrideMap_(), overridesFromSheet.utmOverrides
    );
    writeOverrideMap_(CONFIG.MARKETO_QA.UTM_OVERRIDE_SHEET, "UTM Campaign", mergedUtmOverrideMap);

    const deduped = dedupeAnomaliesByProgram_(rawAnomalies);

    const programToUtmMap = buildProgramToUtmCampaignsMap_(readAllUtmProgramDictionaryEntries_());
    const explodedRows = explodeAnomaliesByUtm_(deduped, programToUtmMap);

    const afterOverrideFilter = filterOutOverriddenRows_(
      explodedRows, mergedProgramOverrideMap, mergedUtmOverrideMap
    );

    const rows = sortAnomaliesForReview_(afterOverrideFilter);

    writeMarketoQASheet_(rows);

    Logger.log(
      CONFIG.LOG.PREFIX + " Marketo_QA anomaly check: " + rows.length + "행 플래깅" +
      "(Program " + newEntries.length + "개 중 " + deduped.length + "개 anomaly → UTM 단위로 " +
      explodedRows.length + "행 explode, override로 제외된 " +
      (explodedRows.length - afterOverrideFilter.length) + "행, 이번 사이클 신규 캡처된 " +
      "override Program " + Object.keys(overridesFromSheet.programOverrides).length + "건/UTM " +
      Object.keys(overridesFromSheet.utmOverrides).length + "건)."
    );

  }catch(err){

    Logger.log(
      CONFIG.LOG.PREFIX + " Marketo_QA anomaly check 실패(무해, Program_Segment_Dictionary " +
      "자체는 정상 갱신됨): " + (err && err.message ? err.message : err)
    );

  }

}


/**
 * ==========================================================
 * TEMP — refreshProgramSegmentDictionaryWithAnomalyCheck_() 수동 실행용
 * 공개 진입점(Apps Script 편집기에서 직접 Run)
 * ==========================================================
 */
function runCheckProgramSegmentDictionaryAnomalies(){

  refreshProgramSegmentDictionaryWithAnomalyCheck_();

}
