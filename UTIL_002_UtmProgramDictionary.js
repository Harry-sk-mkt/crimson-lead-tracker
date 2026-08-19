/**
 * ==========================================================
 * Marketing 2.0
 * UTM Program Dictionary
 *
 * Responsibility
 * MTA_Master(`MKT UTM Campaign`/`Lead Source Detail`)에서 UTM Campaign ↔
 * 실제 Marketo Program명 매핑을 자동으로 채굴해 `CONFIG.UTM_PROGRAM_DICT.SHEET`
 * (같은 스프레드시트 안 숨김 캐시 시트)에 저장/조회한다. UTM 스타일 이름만
 * 갖고 있는 채널(예: Kakao Moments 메시지광고)이 Events_OPS 매칭용 실제
 * Marketo Program명을 자동으로 찾을 때 이 캐시를 소비한다.
 *
 * WHY (2026-08-08, 사용자 요청)
 * Kakao Moments 메시지 이름("KR_core_2026-08-08_ec-each-year-kakao-online-event")과
 * Events_OPS 매칭용 실제 Marketo Program명("WB-2026-07-KOR-MOFU-Core...")은
 * 네이밍 체계가 달라 KakaoSMS_Raw의 `Marketo program` 컬럼을 사람이 매 행
 * 수기 입력해야 했음(AD_001_Config.js v1.17.0 changelog, exec-plan
 * 2026-08-04-kakao-moments-api-integration.md에 미해결로 기록). 하드코딩
 * 대신 이미 쌓여있는 실데이터(MTA_Master — 터치 단위라 한 행에 UTM
 * Campaign과 실제 Program명이 항상 같이 있음)에서 자동으로 딕셔너리를
 * 만들자는 사용자 요청으로 신규 착수. `71_Search_Engine.js`의
 * `SEARCH_UTM_TO_PROGRAM_OVERRIDE`(사용자가 5~7개를 육안 대조해 하드코딩한
 * UTM→Program 매핑)가 정확히 이걸 수작업으로 하던 전례 — 이 파일은 그걸
 * 대량/자동으로 하는 버전.
 *
 * 같은 UTM에 서로 다른 Program명이 섞여 있으면(데이터 불일치/오타) 다수결
 * (최다 등장 Program) 채택 + 확신도 정보(matchCount/totalCount/
 * distinctProgramCount)를 함께 기록(사용자 확정) — 모호한 매핑도 숨기지
 * 않고 캐시 시트에서 육안 검토 가능하게 남긴다.
 *
 * Must NOT
 * - 자동 파이프라인(08_PipelineAsync.js)에 얹지 않음 — MTA_Master 전체
 *   스캔(8만 행+)은 QA성 무거운 작업이라 수동/가끔 실행 전용(사용자 확정,
 *   docs/OpenItems.md #19 때와 동일 신중 원칙). 필요해지면 별도 요청 시 검토.
 * - 71_Search_Engine.js의 SEARCH_UTM_TO_PROGRAM_OVERRIDE/
 *   resolveSearchEngineKey_()는 건드리지 않음(기존 출력 변경 금지 원칙) —
 *   이 신규 딕셔너리와 별개로 계속 동작.
 *
 * Version
 * v1.4.0
 *
 * Change Log
 * v1.4.0 (2026-08-19)
 * - `readLeadsMasterUtmProgramPairs_()` 신규(Leads_Master `First MKT UTM
 *   Campaign`↔`First Touch Detail`, 리드 단위) — 사용자 요청으로 v1.0.0에서
 *   "정보량이 적어 1차 소스에서 제외"했던 Leads_Master를 2차 소스로 추가.
 *   `refreshUtmProgramDictionary_()`가 이제 MTA_Master + Leads_Master 두
 *   소스의 pair를 합쳐서 채굴(additive, 기존 소스 대체 아님) — Meta 광고
 *   캠페인명처럼 MTA_Master 터치 매칭만으로는 커버가 안 되던 경우까지
 *   딕셔너리 범위를 넓히기 위함(EVENTS_002_Engine.js의 Meta 지출 자동
 *   매칭 확장 작업 중 발견).
 * v1.3.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `17_UtmProgramDictionary.js` → 신규 `UTIL_002_UtmProgramDictionary.js`, 코드 내용 변경 없음.
 * v1.3.0 (2026-08-08)
 * - **`readUtmProgramDictionaryMap_()`가 모호한 UTM(Distinct Program Count
 *   > 1)을 결과에서 제외**하도록 수정(사용자 확인) — Consolidated/Pmax류
 *   복합 캠페인은 UTM 하나가 실제로 여러 Marketo Program과 진짜 1:N으로
 *   매칭돼(예: 이 UTM 하나가 8개 서로 다른 eBook Program과 매칭) 다수결로
 *   찍으면 틀린 값이 자동으로 채워질 위험이 있음 — Kakao Moments 등 소비처는
 *   이런 UTM을 기존처럼 빈 값으로 남겨 사람이 직접 확인.
 * - `runDebugMtaMasterTouchesForUtm()` 신규(1회성 진단) — "같은 리드의 다른
 *   터치 Lead Source Detail로 모호함을 해소하자"는 사용자 제안의 정확한
 *   규칙을 정하기 전, 실제 UTM 하나의 리드 표본 터치 내역(UTM/Lead Source
 *   Detail/날짜)을 그대로 출력해 데이터 패턴을 먼저 확인하기 위함(추측 금지
 *   원칙).
 * v1.2.0 (2026-08-08)
 * - **버그 수정(사용자 피드백) — `runListAmbiguousUtmProgramEntries()`가
 *   채택된 winner Program명만 보여줘서 "뭐가 모호하다는 건지 안 보인다"는
 *   지적**. `buildAmbiguousUtmProgramBreakdown_()` 신규(순수 함수) —
 *   UTM_Program_Dictionary(확정 결과만 있음) 대신 원본 카운트
 *   (aggregateUtmProgramCounts_() 출력)를 다시 읽어 모호한 UTM의 경쟁
 *   Program 후보 **전부**를 행으로 펼치고 "Selected (Majority)" 열로 채택
 *   여부 표시. `runListAmbiguousUtmProgramEntries()`가 MTA_Master를 다시
 *   읽어(~40초) 이 함수를 쓰도록 교체.
 * v1.1.0 (2026-08-08)
 * - `runListAmbiguousUtmProgramEntries()` 신규 — 실제 딕셔너리 첫 구축 결과
 *   3,674개 UTM 키 중 640개가 모호(Distinct Program Count > 1)로 나오자
 *   사용자가 목록을 요청 — 숨김 시트를 직접 스크롤하는 대신 모호한 항목만
 *   Total Count 내림차순으로 별도 비숨김 시트에 정리해 육안 검토 가능하게 함.
 * v1.0.0 (2026-08-08)
 * - 최초 구현. `readMtaMasterUtmProgramPairs_()`/`aggregateUtmProgramCounts_()`/
 *   `resolveUtmProgramDictionaryEntries_()`/`refreshUtmProgramDictionary_()`/
 *   `runRefreshUtmProgramDictionary()`/`readUtmProgramDictionaryMap_()` 신규.
 *   AD_006_KakaoMoments.js `computeKakaoMomentsSyncRow_()`/
 *   `syncKakaoMomentsReportToKakaoSMSRaw_()`가 이 딕셔너리를 소비하도록 연동
 *   (해당 파일 자체 changelog 참고).
 * ==========================================================
 */


/**
 * ==========================================================
 * UTM Program Dictionary Headers (같은 스프레드시트 안 숨김 캐시 시트)
 * ==========================================================
 */
const UTM_PROGRAM_DICT_HEADERS = [
  "UTM Campaign", "Marketo Program", "Match Count", "Total Count", "Distinct Program Count"
];


/**
 * ==========================================================
 * Read MTA Master UTM/Program Pairs (IO 래퍼)
 *
 * WHY
 * MTA_Master는 터치 단위라 한 행에 `MKT UTM Campaign`(그 터치의 실제
 * 캠페인)과 `Lead Source Detail`(실제 Marketo Program명)이 항상 같이
 * 있다 — 딕셔너리 채굴 소스로 적합(1차 소스, 2026-08-08). 헤더 이름
 * 기준으로 읽어(readKakaoSMSRawRows_() 스타일) 컬럼 순서 변경에 안전하게
 * 대응. **2026-08-19부터 `readLeadsMasterUtmProgramPairs_()`(리드 단위
 * 첫 터치 스냅샷)를 2차 소스로 함께 사용** — Meta 캠페인명처럼 MTA_Master
 * 터치로 안 잡히는 경우도 커버 범위를 넓히기 위함(사용자 요청,
 * `refreshUtmProgramDictionary_()` 참고).
 *
 * OUTPUT
 * Array<{utm:string, program:string}>  둘 다 비어있지 않은 행만
 * ==========================================================
 */
function readMtaMasterUtmProgramPairs_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);

  if(!sheet) return [];

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if(lastRow < 2 || lastCol === 0) return [];

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function(h){ return String(h).trim(); });

  const utmCol = headers.indexOf("MKT UTM Campaign");
  const programCol = headers.indexOf("Lead Source Detail");

  if(utmCol === -1 || programCol === -1){
    throw new Error(
      "MTA_Master에서 'MKT UTM Campaign'/'Lead Source Detail' 컬럼을 못 찾음 — " +
      "실제 헤더: " + JSON.stringify(headers)
    );
  }

  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  return values
    .map(function(row){
      return {
        utm: String(row[utmCol] || "").trim(),
        program: String(row[programCol] || "").trim()
      };
    })
    .filter(function(pair){ return !!pair.utm && !!pair.program; });

}


/**
 * ==========================================================
 * Read Leads Master UTM/Program Pairs (IO 래퍼, 2026-08-19 신규)
 *
 * WHY
 * Leads_Master는 리드 단위 첫 터치 스냅샷이라 `First MKT UTM Campaign`
 * (그 리드의 최초 터치 캠페인)과 `First Touch Detail`(실제 Marketo
 * Program명)이 한 행에 같이 있다 — readMtaMasterUtmProgramPairs_()와
 * 동일한 원리의 2차 소스(사용자 요청, Meta 지출 캠페인명처럼 MTA_Master
 * 터치로는 안 잡히는 경우까지 커버하기 위함). MTA_Master보다 정보량이
 * 적지만(리드당 1개 스냅샷 vs 터치마다 N개) 완전히 다른 리드 표본은
 * 아니라서 순수 추가(additive) — 기존 MTA_Master 소스를 대체하지 않음.
 *
 * OUTPUT
 * Array<{utm:string, program:string}>  둘 다 비어있지 않은 행만
 * ==========================================================
 */
function readLeadsMasterUtmProgramPairs_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS_MASTER);

  if(!sheet) return [];

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if(lastRow < 2 || lastCol === 0) return [];

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function(h){ return String(h).trim(); });

  const utmCol = headers.indexOf("First MKT UTM Campaign");
  const programCol = headers.indexOf("First Touch Detail");

  if(utmCol === -1 || programCol === -1){
    throw new Error(
      "Leads_Master에서 'First MKT UTM Campaign'/'First Touch Detail' 컬럼을 못 찾음 — " +
      "실제 헤더: " + JSON.stringify(headers)
    );
  }

  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  return values
    .map(function(row){
      return {
        utm: String(row[utmCol] || "").trim(),
        program: String(row[programCol] || "").trim()
      };
    })
    .filter(function(pair){ return !!pair.utm && !!pair.program; });

}


/**
 * ==========================================================
 * Aggregate UTM/Program Counts (순수 함수)
 *
 * WHY
 * utm(trim+lowercase 키)별로 같이 등장한 Program명 각각의 횟수를 센다 —
 * 다음 단계(resolveUtmProgramDictionaryEntries_())가 다수결 채택 + 확신도
 * 계산에 쓴다.
 *
 * INPUT
 * pairs : Array<{utm, program}>  readMtaMasterUtmProgramPairs_() 참고
 *
 * OUTPUT
 * Object  { utmKeyLower: { "프로그램명": count, ... }, ... }
 *
 * TEST
 * testAggregateUtmProgramCounts() 참고
 * ==========================================================
 */
function aggregateUtmProgramCounts_(pairs){

  const counts = {};

  (pairs || []).forEach(function(pair){

    const utmKey = String(pair.utm || "").trim().toLowerCase();
    const program = String(pair.program || "").trim();

    if(!utmKey || !program) return;

    if(!counts[utmKey]) counts[utmKey] = {};

    counts[utmKey][program] = (counts[utmKey][program] || 0) + 1;

  });

  return counts;

}


/**
 * ==========================================================
 * TEST — aggregateUtmProgramCounts_()
 * ==========================================================
 */
function testAggregateUtmProgramCounts(){

  const pairs = [
    { utm: "KR_core_2026-08-08_online-event", program: "WB-2026-08-KOR-MOFU-Core" },
    { utm: "kr_core_2026-08-08_online-event", program: "WB-2026-08-KOR-MOFU-Core" }, // 대소문자만 다름 — 같은 키
    { utm: "KR_core_2026-08-08_online-event", program: "WB-2026-08-KOR-MOFU-Core" },
    { utm: "KR_core_2026-08-08_online-event", program: "오타-프로그램명" }, // 소수 오타 — 별도 항목
    { utm: "kr_core_other-campaign", program: "EV-2026-08-KOR-Seminar" }
  ];

  const result = aggregateUtmProgramCounts_(pairs);

  const pass =
    result["kr_core_2026-08-08_online-event"]["WB-2026-08-KOR-MOFU-Core"] === 3 &&
    result["kr_core_2026-08-08_online-event"]["오타-프로그램명"] === 1 &&
    result["kr_core_other-campaign"]["EV-2026-08-KOR-Seminar"] === 1 &&
    Object.keys(result).length === 2;

  Logger.log("Result: " + JSON.stringify(result, null, 2));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Resolve UTM Program Dictionary Entries (순수 함수)
 *
 * WHY
 * utm별로 최다 등장 Program(다수결)을 채택하고, 채택 확신도를 같이
 * 계산한다(사용자 확정 — 모호한 매핑도 숨기지 않고 캐시 시트에서 육안
 * 검토 가능하게). 동점(최다 등장 Program이 여러 개)이면 알파벳순으로
 * 먼저 오는 쪽을 채택(결정적 결과 보장 목적, 우선순위 의미 없음).
 *
 * INPUT
 * counts : Object  aggregateUtmProgramCounts_() 반환값
 *
 * OUTPUT
 * Array<{utm, program, matchCount, totalCount, distinctProgramCount}>
 *   utm 알파벳순 정렬
 *
 * TEST
 * testResolveUtmProgramDictionaryEntries() 참고
 * ==========================================================
 */
function resolveUtmProgramDictionaryEntries_(counts){

  const utmKeys = Object.keys(counts || {}).sort();

  return utmKeys.map(function(utmKey){

    const programCounts = counts[utmKey];
    const programNames = Object.keys(programCounts).sort();

    let winner = programNames[0];
    let totalCount = 0;

    programNames.forEach(function(name){
      totalCount += programCounts[name];
      if(programCounts[name] > programCounts[winner]) winner = name;
    });

    return {
      utm: utmKey,
      program: winner,
      matchCount: programCounts[winner],
      totalCount: totalCount,
      distinctProgramCount: programNames.length
    };

  });

}


/**
 * ==========================================================
 * TEST — resolveUtmProgramDictionaryEntries_()
 * ==========================================================
 */
function testResolveUtmProgramDictionaryEntries(){

  const counts = {
    "kr_core_2026-08-08_online-event": { "WB-2026-08-KOR-MOFU-Core": 3, "오타-프로그램명": 1 },
    "kr_core_other-campaign": { "EV-2026-08-KOR-Seminar": 1 },
    "kr_core_tie-campaign": { "Program A": 2, "Program B": 2 } // 동점 — 알파벳순 "Program A" 채택
  };

  const result = resolveUtmProgramDictionaryEntries_(counts);

  const first = result[0];
  const tie = result.filter(function(e){ return e.utm === "kr_core_tie-campaign"; })[0];

  const pass =
    result.length === 3 &&
    first.utm === "kr_core_2026-08-08_online-event" && // 알파벳순 정렬 확인
    first.program === "WB-2026-08-KOR-MOFU-Core" &&
    first.matchCount === 3 &&
    first.totalCount === 4 &&
    first.distinctProgramCount === 2 &&
    tie.program === "Program A" &&
    tie.matchCount === 2;

  Logger.log("Result: " + JSON.stringify(result, null, 2));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Refresh UTM Program Dictionary (IO 래퍼 — 수동 실행 전용)
 *
 * WHY
 * MTA_Master 전체를 훑어 딕셔너리를 다시 채굴하고 캐시 시트를 통째로
 * 재작성한다(refreshAdSpendCache_()/refreshSearchEngine_()과 동일한 전체
 * 재빌드 관행 — clearContents→재작성→hideSheet→flush). MTA_Master 전체
 * 스캔(8만 행+)이라 무거움, 자동 파이프라인엔 얹지 않고 사용자가 필요할
 * 때(신규 캠페인/프로그램이 늘었을 때 등) 직접 Run.
 * ==========================================================
 */
function refreshUtmProgramDictionary_(){

  const pairs = readMtaMasterUtmProgramPairs_().concat(readLeadsMasterUtmProgramPairs_());
  const counts = aggregateUtmProgramCounts_(pairs);
  const entries = resolveUtmProgramDictionaryEntries_(counts);

  const rows = entries.map(function(e){
    return [e.utm, e.program, e.matchCount, e.totalCount, e.distinctProgramCount];
  });

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(CONFIG.UTM_PROGRAM_DICT.SHEET);

  if(!sheet){
    sheet = ss.insertSheet(CONFIG.UTM_PROGRAM_DICT.SHEET);
  }

  sheet.clearContents();

  sheet.getRange(1, 1, 1, UTM_PROGRAM_DICT_HEADERS.length)
    .setValues([UTM_PROGRAM_DICT_HEADERS]);

  if(rows.length > 0){
    sheet.getRange(2, 1, rows.length, UTM_PROGRAM_DICT_HEADERS.length)
      .setValues(rows);
  }

  sheet.hideSheet();

  SpreadsheetApp.flush();

  const ambiguousCount = entries.filter(function(e){ return e.distinctProgramCount > 1; }).length;

  Logger.log(
    "UTM_Program_Dictionary 갱신 완료: " + rows.length + "개 UTM 키(모호한 키 " +
    ambiguousCount + "개 — Distinct Program Count > 1)."
  );

}


/**
 * ==========================================================
 * TEMP — refreshUtmProgramDictionary_() 수동 실행용 공개 진입점
 * ==========================================================
 */
function runRefreshUtmProgramDictionary(){

  refreshUtmProgramDictionary_();

}


/**
 * ==========================================================
 * Read UTM Program Dictionary Map (같은 스프레드시트 안 캐시 읽기 — Simple
 * Trigger 안전)
 *
 * WHY
 * readAdSpendCacheMap_()/readSearchEngineMap_()과 동일한 모양 — 외부
 * 열기/API 호출 없이 캐시 시트만 읽는다.
 *
 * **Distinct Program Count > 1(모호한 UTM)은 제외한다(2026-08-08, 사용자
 * 확인)**: Consolidated/Pmax류 복합 캠페인은 UTM 하나가 실제로 여러
 * Marketo Program과 진짜 1:N으로 매칭됨(예: "kr_core_..._outside-
 * collaboration-consolidated-eb-mofu_..."가 8개 서로 다른 eBook Program과
 * 매칭) — 다수결로 하나를 찍어도 틀린 Program이 자동으로 채워질 위험이
 * 있어, 이런 UTM은 이 맵에서 아예 빠지고 자동 채움 소비처(Kakao Moments
 * 등)는 기존처럼 빈 값으로 남겨 사람이 직접 확인하게 한다. UTM이 실제로
 * Program 1개와만 짝지어진(distinctProgramCount === 1) 확실한 경우만 반환.
 *
 * OUTPUT
 * Object  { utmKeyLower: Marketo Program명 }  Distinct Program Count === 1인
 *   항목만
 * ==========================================================
 */
function readUtmProgramDictionaryMap_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.UTM_PROGRAM_DICT.SHEET);

  const map = {};

  if(!sheet) return map;

  const values = sheet.getDataRange().getValues();

  for(let i = 1; i < values.length; i++){

    const distinctProgramCount = Number(values[i][4]);

    if(distinctProgramCount !== 1) continue; // 모호한 UTM 제외

    map[String(values[i][0] || "").trim().toLowerCase()] = values[i][1];

  }

  return map;

}


/**
 * ==========================================================
 * Ambiguous UTM Program Dictionary Headers (경쟁 후보 상세 시트 전용)
 * ==========================================================
 */
const AMBIGUOUS_UTM_PROGRAM_HEADERS = [
  "UTM Campaign", "Candidate Program", "Count", "Selected (Majority)", "Total Count for UTM"
];


/**
 * ==========================================================
 * Build Ambiguous UTM Program Breakdown (순수 함수)
 *
 * WHY (2026-08-08, 사용자 요청)
 * 첫 버전은 UTM_Program_Dictionary(이미 다수결로 확정된 winner 하나만 있는
 * 시트)를 그대로 필터링해 보여줘서, 사용자가 "뭐가 모호하다는 건지 안
 * 보인다"고 지적 — winner 말고 **경쟁했던 다른 Program 후보들**이 실제로
 * 시트에 안 보였던 게 원인. `aggregateUtmProgramCounts_()`가 만드는 원본
 * 카운트(모든 후보)를 그대로 받아, distinctProgramCount > 1인 UTM만 골라
 * 후보 Program **전부**를 행으로 펼친다 — resolveUtmProgramDictionaryEntries_()
 * 와 동일한 다수결/동점 규칙(최다 등장, 동점이면 알파벳순)으로 어느 후보가
 * 채택됐는지(`Selected (Majority)`)도 같이 표시.
 *
 * INPUT
 * counts : Object  aggregateUtmProgramCounts_() 반환값
 *
 * OUTPUT
 * Array<{utm, program, count, isSelected, totalCountForUtm}>  UTM별 totalCount
 *   내림차순(영향 큰 UTM 먼저), 같은 UTM 안에서는 count 내림차순
 *
 * TEST
 * testBuildAmbiguousUtmProgramBreakdown() 참고
 * ==========================================================
 */
function buildAmbiguousUtmProgramBreakdown_(counts){

  const utmKeys = Object.keys(counts || {});

  const groups = utmKeys
    .map(function(utmKey){

      const programCounts = counts[utmKey];
      const programNames = Object.keys(programCounts).sort();

      if(programNames.length <= 1) return null; // 모호하지 않음 — 제외

      let winner = programNames[0];

      programNames.forEach(function(name){
        if(programCounts[name] > programCounts[winner]) winner = name;
      });

      const totalCountForUtm = programNames.reduce(function(sum, name){
        return sum + programCounts[name];
      }, 0);

      const candidates = programNames
        .slice()
        .sort(function(a, b){ return programCounts[b] - programCounts[a]; })
        .map(function(name){
          return {
            utm: utmKey,
            program: name,
            count: programCounts[name],
            isSelected: name === winner,
            totalCountForUtm: totalCountForUtm
          };
        });

      return { totalCountForUtm: totalCountForUtm, candidates: candidates };

    })
    .filter(function(g){ return g !== null; })
    .sort(function(a, b){ return b.totalCountForUtm - a.totalCountForUtm; });

  const breakdown = [];

  groups.forEach(function(g){
    g.candidates.forEach(function(c){ breakdown.push(c); });
  });

  return breakdown;

}


/**
 * ==========================================================
 * TEST — buildAmbiguousUtmProgramBreakdown_()
 * ==========================================================
 */
function testBuildAmbiguousUtmProgramBreakdown(){

  const counts = {
    "kr_core_low-volume": { "Program X": 1, "Program Y": 1 }, // total 2 — 모호
    "kr_core_high-volume": { "WB-2026-08-KOR-MOFU-Core": 8, "오타-프로그램명": 2 }, // total 10 — 모호, 더 큼
    "kr_core_clean": { "EV-2026-08-KOR-Seminar": 5 } // 모호하지 않음 — 제외돼야 함
  };

  const result = buildAmbiguousUtmProgramBreakdown_(counts);

  const pass =
    result.length === 4 && // low-volume 2개 + high-volume 2개, clean은 제외
    result[0].utm === "kr_core_high-volume" && // totalCountForUtm 큰 그룹 먼저
    result[0].program === "WB-2026-08-KOR-MOFU-Core" &&
    result[0].count === 8 &&
    result[0].isSelected === true &&
    result[0].totalCountForUtm === 10 &&
    result[1].utm === "kr_core_high-volume" &&
    result[1].program === "오타-프로그램명" &&
    result[1].isSelected === false &&
    result[2].utm === "kr_core_low-volume" &&
    result[2].isSelected === true && // 동점 — 알파벳순 "Program X" 채택
    result[2].program === "Program X";

  Logger.log("Result: " + JSON.stringify(result, null, 2));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * TEMP — 모호한 UTM의 경쟁 Program 후보 전부를 눈에 보이는 시트로 정리
 * (수동 실행, 육안 검토용)
 *
 * WHY (2026-08-08, 사용자 요청)
 * MTA_Master를 다시 읽어(runRefreshUtmProgramDictionary()와 동일 소스,
 * ~40초) 원본 카운트를 얻고 buildAmbiguousUtmProgramBreakdown_()로 모호한
 * UTM의 후보 Program 전부를 펼쳐 별도 **비숨김** 시트에 정리 — "Selected
 * (Majority)" 열로 다수결 채택 여부까지 표시해, 뭐랑 경쟁해서 뭐가 뽑혔는지
 * 한눈에 보이게 함(이전 버전은 채택된 것만 보여줘 사용자가 "뭐가
 * 모호하다는 건지 모르겠다"고 지적).
 * ==========================================================
 */
function runListAmbiguousUtmProgramEntries(){

  const pairs = readMtaMasterUtmProgramPairs_();
  const counts = aggregateUtmProgramCounts_(pairs);
  const breakdown = buildAmbiguousUtmProgramBreakdown_(counts);

  const rows = breakdown.map(function(c){
    return [c.utm, c.program, c.count, c.isSelected ? "TRUE" : "", c.totalCountForUtm];
  });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const outputSheetName = CONFIG.UTM_PROGRAM_DICT.SHEET + "_Ambiguous";

  let outputSheet = ss.getSheetByName(outputSheetName);

  if(!outputSheet){
    outputSheet = ss.insertSheet(outputSheetName);
  }

  outputSheet.showSheet();
  outputSheet.clearContents();

  outputSheet.getRange(1, 1, 1, AMBIGUOUS_UTM_PROGRAM_HEADERS.length)
    .setValues([AMBIGUOUS_UTM_PROGRAM_HEADERS]);

  if(rows.length > 0){
    outputSheet.getRange(2, 1, rows.length, AMBIGUOUS_UTM_PROGRAM_HEADERS.length)
      .setValues(rows);
  }

  SpreadsheetApp.flush();

  const ambiguousUtmCount = breakdown.filter(function(c){ return c.isSelected; }).length;

  Logger.log(
    outputSheetName + " 시트에 모호한 UTM " + ambiguousUtmCount + "개(후보 " +
    rows.length + "행) 정리 완료 — Total Count for UTM 내림차순, 같은 UTM 안에서는 " +
    "Count 내림차순, Selected (Majority)=TRUE가 다수결 채택된 후보."
  );

}


/**
 * ==========================================================
 * TEMP — 특정 UTM으로 들어온 리드들의 MTA_Master 전체 터치 내역 진단
 * (수동 실행, 1회성)
 *
 * WHY (2026-08-08, 사용자 요청)
 * Consolidated/Pmax류 복합 캠페인 UTM은 여러 Marketo Program과 진짜 1:N으로
 * 매칭될 수 있다는 사용자 지적 이후, "같은 리드의 다른 터치에 찍힌 Lead
 * Source Detail을 봐서 모호함을 해소하자"는 제안이 나왔는데 — 정확한 규칙
 * (어느 터치를 근거로 삼을지, Created Date 기준으로 어떻게 고를지)은 실제
 * 데이터 패턴을 보지 않고는 추측 금지 원칙상 확정할 수 없음. 이 UTM으로
 * 들어온 리드 표본의 실제 터치들(UTM/Lead Source Detail/날짜)을 그대로
 * 찍어서 같이 보고 규칙을 정하기 위한 1회성 진단.
 *
 * 표본이 너무 많으면 로그가 잘리므로 리드 최대 15명만 출력(경고 로그로
 * 전체 리드 수는 알려줌).
 * ==========================================================
 */
function runDebugMtaMasterTouchesForUtm(){

  const targetUtm = "kr_core_2023-07-14_outside-collaboration-consolidated-eb-mofu_lead-fbiglg";
  const targetUtmLower = targetUtm.trim().toLowerCase();
  const maxLeadsToLog = 15;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);

  if(!sheet){
    Logger.log("MTA_Master 시트를 못 찾음.");
    return;
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function(h){ return String(h).trim(); });

  const leadIdCol = headers.indexOf("Lead ID");
  const utmCol = headers.indexOf("MKT UTM Campaign");
  const programCol = headers.indexOf("Lead Source Detail");
  const dateCol = headers.indexOf("MTA Created Date");

  if(leadIdCol === -1 || utmCol === -1 || programCol === -1 || dateCol === -1){
    Logger.log(
      "필요한 컬럼을 못 찾음 — 실제 헤더: " + JSON.stringify(headers)
    );
    return;
  }

  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  // 1단계: 이 UTM이 찍힌 터치가 하나라도 있는 Lead ID 전부 수집
  const matchingLeadIds = {};

  values.forEach(function(row){
    const utm = String(row[utmCol] || "").trim().toLowerCase();
    if(utm === targetUtmLower){
      matchingLeadIds[String(row[leadIdCol] || "")] = true;
    }
  });

  const leadIds = Object.keys(matchingLeadIds).filter(function(id){ return !!id; });

  Logger.log("UTM: " + targetUtm);
  Logger.log("이 UTM으로 들어온 고유 Lead ID 수: " + leadIds.length);

  // 2단계: 그 Lead ID들의 "전체" 터치(이 UTM 아닌 것도 포함)를 Lead ID별로 모음
  const touchesByLeadId = {};

  values.forEach(function(row){
    const leadId = String(row[leadIdCol] || "");
    if(!matchingLeadIds[leadId]) return;

    if(!touchesByLeadId[leadId]) touchesByLeadId[leadId] = [];

    touchesByLeadId[leadId].push({
      utm: row[utmCol],
      program: row[programCol],
      date: row[dateCol]
    });

  });

  // 3단계: Lead ID별로 날짜순 정렬 후 최대 maxLeadsToLog명만 출력
  leadIds.slice(0, maxLeadsToLog).forEach(function(leadId){

    const touches = touchesByLeadId[leadId].slice().sort(function(a, b){
      const aTime = a.date instanceof Date ? a.date.getTime() : 0;
      const bTime = b.date instanceof Date ? b.date.getTime() : 0;
      return aTime - bTime;
    });

    Logger.log("--- Lead ID: " + leadId + " (터치 " + touches.length + "개, 날짜순) ---");

    touches.forEach(function(t){
      const dateStr = t.date instanceof Date ? Utilities.formatDate(t.date, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd") : String(t.date);
      Logger.log(
        "  " + dateStr + " | UTM: " + t.utm + " | Lead Source Detail: " +
        (t.program || "(빈값)")
      );
    });

  });

  if(leadIds.length > maxLeadsToLog){
    Logger.log(
      "(리드 " + (leadIds.length - maxLeadsToLog) + "명 더 있음 — 로그 잘림 방지로 " +
      maxLeadsToLog + "명만 출력)"
    );
  }

}
