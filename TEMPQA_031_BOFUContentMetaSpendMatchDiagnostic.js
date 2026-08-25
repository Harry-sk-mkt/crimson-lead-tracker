/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — BOFU/Content Meta Spend 자동 매칭 실패 원인 진단
 *
 * Responsibility
 * `BOFU_001_Config.js` v1.5.0/`CONTENT_001_Config.js` v1.3.0(Spent를
 * GROUP_4_COMPUTED로 전환) 적용 후 `refreshBOFUEngine_()`/
 * `refreshContentEngine_()` → `buildBOFUOPS()`/`buildContentOPS()`까지
 * 전부 실행했는데도 BOFU_OPS/Content_OPS의 Spent가 대부분(사실상 전부)
 * 0으로 나옴(사용자 실행 결과, 2026-08-25) — 매칭 파이프라인
 * (`readUtmProgramDictionaryMap_()` → `resolveMetaCampaignProgramKey_()` →
 * `isEligibleBOFUProgram_()`/`isEligibleContentProgram_()`)의 어느 단계에서
 * 막히는지 단계별로 나눠서 확인한다.
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 *
 * INPUT: 없음 (UTM_Program_Dictionary 캐시 시트 + Meta_Raw 직접 스캔)
 * OUTPUT: Logger.log만 — (1) 딕셔너리 크기, (2) Meta_Raw 행 수, (3) 딕셔너리
 *   매칭 성공/실패 건수 및 실패 샘플, (4) 매칭된 것 중 BOFU/Content 자격
 *   판정 통과 건수 및 샘플.
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 조사 스크립트(TEMPQA 관례).
 *
 * Version
 * v1.2.0
 *
 * Change Log
 * v1.2.0 (2026-08-25)
 * - `runDumpContentOPSRowRawCells()` 신규 — `runInspectBOFUContentEngineSpentColumn()`
 *   결과 Content_Engine/Content_OPS 합계가 정확히 일치(둘 다 $357,373.93)하는데도
 *   그 값이 전부 "Month 셀이 Date 객체로 보이는" 행에만 몰려있고 나머지
 *   정상 행은 전부 Spent=0인 이상한 상관관계 발견(사용자 실행 결과) — 특정
 *   행의 헤더별 원본 셀 값(typeof/instanceof 포함) 전체를 그대로 덤프해
 *   컬럼이 밀렸는지/Start Date가 실제로 뭘 담고 있는지 육안 확인.
 * v1.1.0 (2026-08-25)
 * - `runInspectBOFUContentEngineSpentColumn()` 신규 — 1차 진단(매칭 자체는
 *   67/115건 정상 성공, 사용자 실행 결과)에도 불구하고 BOFU_OPS/Content_OPS의
 *   Spent가 전부 0으로 나온 원인이 (a) refreshXEngine_()이 Spent를 Engine
 *   시트에 쓰는 단계 vs (b) buildXOPS()가 Engine→OPS로 병합하는 단계 중
 *   어디서 끊기는지 좁히기 위해, BOFU_Engine/Content_Engine 시트 자체를
 *   직접 열어 Spent 컬럼 합계/0이 아닌 행 샘플/특정 키(1차 진단에서 확인된
 *   매칭 성공 키)의 실제 값을 덤프.
 * v1.0.0 (2026-08-25)
 * - 최초 구현.
 * ==========================================================
 */

function runDiagnoseBOFUContentMetaSpendMatching() {

  const dict = readUtmProgramDictionaryMap_();
  const dictSize = Object.keys(dict).length;

  const metaRows = readMetaRawRows_();

  let dictHitCount = 0;
  let bofuEligibleCount = 0;
  let contentEligibleCount = 0;

  const bofuSamples = [];
  const contentSamples = [];
  const dictMissSamples = [];
  const dictHitButIneligibleSamples = [];

  metaRows.forEach(function (r) {

    const name = String(r.campaignName || "").trim();

    if (!name) return;

    const rawDictProgram = dict[name.toLowerCase()];

    if (!rawDictProgram) {

      if (dictMissSamples.length < 15) dictMissSamples.push(name);

      return;

    }

    dictHitCount++;

    const normalized = stripLGSuffix_(stripRegistrationFormSuffix_(rawDictProgram));

    const isBOFU = isEligibleBOFUProgram_(normalized);
    const isContent = isEligibleContentProgram_(normalized);

    if (isBOFU) {

      bofuEligibleCount++;

      if (bofuSamples.length < 15) {
        bofuSamples.push(name + " => \"" + normalized + "\" (spent=" + r.spent + ")");
      }

    }

    if (isContent) {

      contentEligibleCount++;

      if (contentSamples.length < 15) {
        contentSamples.push(name + " => \"" + normalized + "\" (spent=" + r.spent + ")");
      }

    }

    if (!isBOFU && !isContent && dictHitButIneligibleSamples.length < 15) {
      dictHitButIneligibleSamples.push(
        name + " => \"" + normalized + "\" (segment=" +
        getBusinessSegment(normalized, normalized) + ")"
      );
    }

  });

  Logger.log("========== BOFU/Content Meta Spend 매칭 진단 ==========");
  Logger.log("UTM_Program_Dictionary 크기(distinctProgramCount=1인 것만) : " + dictSize);
  Logger.log("Meta_Raw 총 행 수 : " + metaRows.length);
  Logger.log("");
  Logger.log("딕셔너리에서 Program명 찾은 행 수 : " + dictHitCount + " / " + metaRows.length);

  if (dictMissSamples.length > 0) {
    Logger.log("딕셔너리 매칭 실패 캠페인명 샘플(최대 15건):");
    dictMissSamples.forEach(function (s) { Logger.log("  " + s); });
  }

  Logger.log("");
  Logger.log("딕셔너리 매칭 성공 중 BOFU 자격 통과 : " + bofuEligibleCount);
  bofuSamples.forEach(function (s) { Logger.log("  [BOFU] " + s); });

  Logger.log("");
  Logger.log("딕셔너리 매칭 성공 중 Content 자격 통과 : " + contentEligibleCount);
  contentSamples.forEach(function (s) { Logger.log("  [Content] " + s); });

  if (dictHitButIneligibleSamples.length > 0) {
    Logger.log("");
    Logger.log("딕셔너리는 찾았지만 BOFU/Content 둘 다 자격 미달인 샘플(최대 15건):");
    dictHitButIneligibleSamples.forEach(function (s) { Logger.log("  " + s); });
  }

  Logger.log("");
  Logger.log("========== Diagnostic Completed ==========");

}


/**
 * ==========================================================
 * Inspect BOFU/Content Engine Spent Column (직접 시트 덤프)
 *
 * WHY
 * `runDiagnoseBOFUContentMetaSpendMatching()`에서 매칭 자체는 정상(BOFU
 * 67건/Content 115건 성공, spent>0 확인)인데도 BOFU_OPS/Content_OPS의
 * Spent가 전부 0으로 나온 원인을 좁히기 위해, `BOFU_Engine`/`Content_Engine`
 * (숨김) 시트를 `readBOFUEngineMap_()`/`readContentEngineMap_()` 같은
 * 가공 레이어 없이 직접 열어 Spent 컬럼 원본 값을 확인한다 — 여기서
 * 이미 0이면 `refreshBOFUEngine_()`/`refreshContentEngine_()` 단계(집계→쓰기)
 * 문제, 여기 값은 있는데 BOFU_OPS/Content_OPS만 0이면 `buildBOFUOPS()`/
 * `buildContentOPS()`(병합) 단계 문제로 원인 범위를 좁힐 수 있다.
 * ==========================================================
 */
function runInspectBOFUContentEngineSpentColumn() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const KNOWN_MATCHED_KEYS = {
    BOFU: [
      "WF-2022-11-KOR-BOFU-Core Rise Prospectus",
      "WF-2023-09-KOR-BOFU-Core Consult Ad: FAO Interview",
      "WF-2024-01-KOR-BOFU-Core Delta Careers 2024"
    ],
    CONTENT: [
      "WF-2024-08-KOR-MOFU-Core SAT & ACT Ultimate Guide 2024 eBook",
      "WF-2022-10-KOR-MOFU-Core Hyperlocalized FAQ with FAO for US ebook",
      "WF-2023-02-KOR-MOFU-Core 5 Ways To Build Stand-Out ECL ebook"
    ]
  };

  [
    { label: "BOFU", sheetName: BOFU.SHEET.ENGINE, keyColHeader: BOFU.KEY },
    { label: "CONTENT", sheetName: CONTENT.SHEET.ENGINE, keyColHeader: CONTENT.KEY }
  ].forEach(function (domain) {

    Logger.log("========== " + domain.label + "_Engine (\"" + domain.sheetName + "\") Spent 컬럼 직접 확인 ==========");

    const sheet = ss.getSheetByName(domain.sheetName);

    if (!sheet) {
      Logger.log(domain.sheetName + " sheet not found.");
      return;
    }

    const values = sheet.getDataRange().getValues();

    if (values.length <= 1) {
      Logger.log("데이터 없음(헤더만 있거나 빈 시트).");
      return;
    }

    const headers = values[0];
    const keyCol = headers.indexOf(domain.keyColHeader);
    const spentCol = headers.indexOf("Spent");

    Logger.log("헤더: " + JSON.stringify(headers));
    Logger.log("키 컬럼 인덱스: " + keyCol + ", Spent 컬럼 인덱스: " + spentCol);

    if (keyCol === -1 || spentCol === -1) {
      Logger.log("키 또는 Spent 컬럼을 헤더에서 못 찾음 — 아래 진행 불가.");
      return;
    }

    let total = 0;
    let nonZeroCount = 0;
    const nonZeroSamples = [];
    const keyToRow = {};

    for (let i = 1; i < values.length; i++) {

      const key = String(values[i][keyCol] || "").trim();
      const spent = Number(values[i][spentCol]) || 0;

      keyToRow[key] = spent;
      total += spent;

      if (spent !== 0) {

        nonZeroCount++;

        if (nonZeroSamples.length < 15) {
          nonZeroSamples.push(key + " => " + spent);
        }

      }

    }

    Logger.log("총 데이터 행 수 : " + (values.length - 1));
    Logger.log("Spent 합계 : " + total.toFixed(2));
    Logger.log("Spent ≠ 0인 행 수 : " + nonZeroCount);

    if (nonZeroSamples.length > 0) {
      Logger.log("Spent ≠ 0 샘플(최대 15건):");
      nonZeroSamples.forEach(function (s) { Logger.log("  " + s); });
    }

    Logger.log("");
    Logger.log("1차 진단에서 매칭 성공 확인된 키 직접 조회:");

    KNOWN_MATCHED_KEYS[domain.label].forEach(function (key) {

      const found = Object.prototype.hasOwnProperty.call(keyToRow, key);

      Logger.log(
        "  \"" + key + "\" — " +
        (found ? ("Engine 시트에 존재, Spent=" + keyToRow[key]) : "Engine 시트에 이 키 자체가 없음")
      );

    });

    Logger.log("");

  });

  Logger.log("========== Inspection Completed ==========");

}


/**
 * ==========================================================
 * Dump Content_OPS Row Raw Cells (특정 키의 헤더별 원본 셀 값 전체 덤프)
 *
 * WHY
 * `runInspectBOFUContentEngineSpentColumn()` 결과 Content_Engine과
 * Content_OPS의 Spent 합계가 정확히 일치($357,373.93)하는데, 그 값이
 * 전부 "Month 셀이 Date 객체로 보이는" 소수 행에만 몰려있고 정상 Month
 * 문자열을 가진 나머지 행은 전부 Spent=0 — 이 상관관계의 원인(컬럼 밀림,
 * Start Date 실제 값 등)을 헤더별 값을 그대로 찍어 육안으로 확인한다.
 * ==========================================================
 */
function runDumpContentOPSRowRawCells() {

  const TARGET_KEYS = [
    "WF-2026-07-KOR-MOFU-Core Hyperlocalized Rising 8~9 Roadmap eBook", // Spent=0 (malformed month)
    "WF-2026-06-KOR-MOFU-Core UK Admissions Guide eBook",                // Spent=1597.81 (malformed month)
    "WF-2026-03-KOR-MOFU-Core HL Grade 9 Academic Planner"               // Spent=6030.96 (malformed month)
  ];

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONTENT.SHEET.OPS);

  if (!sheet) {
    Logger.log(CONTENT.SHEET.OPS + " sheet not found.");
    return;
  }

  const values = sheet.getDataRange().getValues();
  const headerIndex = CONTENT.ROWS.HEADER - 1;
  const headers = values[headerIndex];

  Logger.log("헤더(순서대로): " + JSON.stringify(headers));
  Logger.log("");

  TARGET_KEYS.forEach(function (targetKey) {

    Logger.log("---- \"" + targetKey + "\" ----");

    let found = false;

    for (let r = headerIndex + 1; r < values.length; r++) {

      const rowKey = String(values[r][headers.indexOf(CONTENT.KEY)] || "").trim();

      if (rowKey !== targetKey) continue;

      found = true;

      headers.forEach(function (header, c) {

        const v = values[r][c];
        const type = v instanceof Date ? "Date" : typeof v;

        Logger.log("  [" + header + "] (" + type + ") = " + v);

      });

      break;

    }

    if (!found) Logger.log("  Content_OPS에서 이 키를 찾지 못함.");

    Logger.log("");

  });

  Logger.log("========== Dump Completed ==========");

}
