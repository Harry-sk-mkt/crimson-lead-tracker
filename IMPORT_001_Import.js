/**
 * ==========================================================
 * Marketing 2.0
 * Import
 *
 * Responsibility
 * Execute Import Pipeline (Stage 00 — Raw까지만 담당)
 *
 * Must NOT
 * - Business rule 적용
 * - Master 빌드
 *
 * Version
 * v3.11.0
 *
 * Change Log
 * v3.11.0 (2026-09-02)
 * - **SAL Import Type 신규**(`docs/OpenItems.md` #38, `MASTER_010_SALSync.js`) —
 *   IC Funnel과 동일한 패턴: `importCsv()`의 `case "SAL"`이 `writeSALRaw()`
 *   (IMPORT_005_RawWriter.js, 외부 스프레드시트) 직후
 *   `scheduleSALPipelineTail_()`(백그라운드 트리거)를 호출.
 *   `formatAppendSummary_()`에 `importType === "SAL"` 분기 추가(IC_FUNNEL과
 *   동일 형태, 실패 시 안내 함수만 `runSyncSALToOPS()`로 교체),
 *   `importSALReport()` 메뉴 진입점 신규, `testFormatAppendSummary()` 갱신.
 * v3.10.0 (2026-08-26)
 * - **버그 수정 — 실사용 중 실제 발생**: v3.9.0에서 `case "IC_FUNNEL"`이
 *   `syncICFunnelToOPS_()`를 동기 호출하도록 배선했으나, 그 함수 끝의 7개
 *   Engine refresh가 Leads/MTA와 동일하게 무거워 업로드 다이얼로그가 오래
 *   안 닫히는 문제 발견(사용자 실측, 36,464행 전체기간 Import). `appendNewLeads()`/
 *   `appendNewMTA()`와 동일한 설치형 1회성 백그라운드 트리거 패턴으로 전환 —
 *   `syncICFunnelToOPS_()` 직접 호출을 신규 `scheduleICFunnelPipelineTail_()`
 *   (`MASTER_009_ICFunnelSync.js`)로 교체. `formatAppendSummary_()`의
 *   IC_FUNNEL 분기를 `backgroundScheduled`/`backgroundSkipped` 케이스로
 *   재작성(LEADS/MTA와 동일한 형태), `testFormatAppendSummary()` 갱신.
 * v3.9.0 (2026-08-26)
 * - `importICFunnelReport()` 메뉴 진입점 복원(ICFunnel_Raw 재도입,
 *   `docs/OpenItems.md` #32) — `showUploadDialog_("IC_FUNNEL")` 호출은
 *   기존 그대로(범용 다이얼로그라 변경 불필요). `importCsv()`의
 *   `case "IC_FUNNEL"`이 `writeICFunnelRaw()` 직후 `syncICFunnelToOPS_()`
 *   (`MASTER_009_ICFunnelSync.js` 신규)를 동기 호출하도록 배선했었음(v3.10.0에서
 *   비동기로 재수정, 위 참고). `formatAppendSummary_()`에
 *   `importType === "IC_FUNNEL"` 분기 추가 — 대응하는 Append 단계가 없어
 *   기존엔 "Master Append를 실행해주세요"라는 부정확한 안내가 나갔던 걸
 *   "IC Funnel Sync 완료" 문구로 교체, `testFormatAppendSummary()` 기대값도
 *   함께 갱신.
 * v3.8.0 (2026-08-25)
 * - writeLeadRaw()/writeMTARaw()/writeICFunnelRaw()(IMPORT_005_RawWriter.js
 *   v4.1.0)가 완전 동일 중복 제외 결과({ appended, skipped })를 반환하도록
 *   바뀜에 따라, importCsv()가 그 반환값을 rawWriteResult로 받아 신규
 *   formatRawDedupSummary_()로 "N건 완전 동일 중복 제외" 안내를 최종 메시지에
 *   추가(사용자 요청 — Raw 단계 중복 제외를 도입, 상세 배경은
 *   IMPORT_008_RawDeduplicator.js 참고).
 * v3.7.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `00_Import.js` → 신규 `IMPORT_001_Import.js`, 코드 내용 변경 없음.
 * v3.7.0 (2026-08-06)
 * - **lock-skip 알림 문구 수정(사용자 요청)** — `formatAppendSummary_()`의
 *   `backgroundSkipped` 메시지가 "Leads_OPS/Report는 다음 정상 실행 때 자동
 *   반영됩니다"라고 안내했으나 실제로는 자동 재시도 경로가 없어 사실과 다름을
 *   실사용 중 발견(07_IncrementalMasterBuild.js v1.9.0과 동일 배경). "자동
 *   재시도 안 됨 + 몇 분 후 08_PipelineAsync.js의 runLeadsPipelineTail()/
 *   runMTAPipelineTail() 직접 Run" 안내로 교체 — 어느 함수를 안내할지 알아야
 *   해서 `formatAppendSummary_()`에 `importType` 파라미터 추가(옵셔널 아님,
 *   호출부 `importCsv()` 1곳만 수정).
 * v3.6.0 (2026-08-04)
 * - importCsv()가 LEADS/MTA Raw 기록 직후 appendNewLeads()/appendNewMTA()를
 *   silent=true로 자동 호출하도록 변경(사용자 요청 — Import 끝나면 Append까지
 *   자동 실행되길 기대했는데 별도로 눌러야 했다는 피드백). 신규
 *   formatAppendSummary_()가 append 결과를 업로드 다이얼로그 완료 메시지에
 *   이어붙임. IC_FUNNEL은 대응하는 append 함수가 없어 기존 안내 문구 유지.
 * v3.5.0 (2026-08-04)
 * - `getLatestRawDate_()`와 업로드 다이얼로그의 "Raw 기준 가장 최근 날짜" 표시를
 *   완전히 제거(사용자 확정) — 2026-07-25 두 차례 성능 최적화(Master→Raw 기준
 *   전환, sheetToObjects()→getRange() targeted read)에도 불구하고 여전히
 *   업로드 다이얼로그 오픈이 느려진다는 사용자 실측 피드백. `showUploadDialog_()`의
 *   `template.lastDate` 할당도 함께 제거, `00_UploadDialog.html`의 해당 표시
 *   블록/스타일도 제거.
 * v3.4.0 (2026-07-25)
 * - getLatestRawDate_()가 sheetToObjects()로 Raw 전체(전체 컬럼)를 읽던 걸
 *   getRange()로 날짜 컬럼 하나만 targeted read하도록 변경 — Import 다이얼로그
 *   오픈 지연 해결(사용자 발견). 겸해서 16_TransformHelper.js의 parseDate()
 *   디버그 Logger.log()도 함께 제거(대량 레코드 처리 시 실행 시간에 영향).
 * v3.3.0 (2026-07-25)
 * - showUploadDialog_()가 Leads_Raw/MTA_Raw에 이미 들어있는 가장 최근
 *   날짜(getLatestRawDate_())를 업로드 화면에 표시하도록 변경 — 매주
 *   export 범위를 정할 때 참고용. 날짜 겹침으로 인한 중복 터치 append 실수
 *   방지 목적(findExactDuplicateTouchRows_(), 24_OPSQA.js와 연관). Master
 *   기준으로 처음 구현했다가, Master는 전체 재구축 도중 비어있을 수 있어
 *   Raw 기준으로 정정(사용자 지적).
 * v3.2.0 (2026-07-21)
 * - Fixed duplicate switch(importType) block in Step 5 — Raw에 매번
 *   두 번씩 append되던 버그 수정 (IC_FUNNEL 케이스 추가 시 기존 블록을
 *   교체가 아니라 추가로 남겨둔 실수).
 * ==========================================================
 */

/**
 * ==========================================================
 * Open Upload Dialog
 * ==========================================================
 *
 * @param {string} importType  "LEADS" | "MTA" | "IC_FUNNEL" | "SAL"
 */
function showUploadDialog_(importType) {

  const template =
    HtmlService.createTemplateFromFile(
      "CORE_003_UploadDialog"
    );

  template.importType = importType;

  const html =
    template
      .evaluate()
      .setWidth(400)
      .setHeight(240);

  SpreadsheetApp
    .getUi()
    .showModalDialog(
      html,
      "Import " + importType
    );

}


/**
 * ==========================================================
 * Format Append Summary (Import→Append 자동 체이닝 결과 메시지)
 *
 * WHY
 * importCsv()가 Raw 기록 직후 appendNewLeads()/appendNewMTA()를 silent=true로
 * 바로 호출하도록 바뀌면서(2026-08-04, 사용자 요청 — Import→Append가 2단계
 * 수동 클릭이라 기대와 다르다는 피드백), 그 결과를 업로드 다이얼로그 완료
 * 메시지에 이어붙이기 위한 변환 함수.
 *
 * INPUT
 * appendResult : { appended, backgroundScheduled?, backgroundSkipped? } | null
 *   (IC_FUNNEL/SAL처럼 대응하는 append 함수가 없는 Import Type이면 null)
 * importType : "LEADS" | "MTA" | "IC_FUNNEL" | "SAL"
 *   backgroundSkipped 케이스에서 어느 파이프라인 tail 함수를 안내할지 결정
 *   (MTA면 runMTAPipelineTail(), 그 외엔 runLeadsPipelineTail() — 2026-08-06 추가).
 *
 * OUTPUT
 * string
 *
 * TEST
 * testFormatAppendSummary() 참고.
 * ==========================================================
 */
function formatAppendSummary_(appendResult, importType){

  if(importType === "IC_FUNNEL" || importType === "SAL"){

    const label = (importType === "SAL") ? "SAL" : "IC Funnel";
    const manualRetryFn = (importType === "SAL") ? "runSyncSALToOPS()" : "runSyncICFunnelToOPS()";
    const manualRetryFile = (importType === "SAL") ? "MASTER_010_SALSync.js" : "MASTER_009_ICFunnelSync.js";

    if(appendResult && appendResult.backgroundScheduled){
      return (
        label + " Sync가 백그라운드에서 진행됩니다 — 잠시 후 Leads_OPS에 " +
        "반영됩니다(진행상태는 Apps Script 편집기 Executions 로그 참고)."
      );
    }

    if(appendResult && appendResult.backgroundSkipped){
      return (
        "⚠️ 다른 백그라운드 작업이 진행 중이라 이번 사이클은 sync를 건너뛰었습니다. " +
        "몇 분 후(다른 작업이 끝난 뒤) " + manualRetryFile + "의 " +
        manualRetryFn + "를 Apps Script 편집기에서 직접 Run 해주세요."
      );
    }

    return label + " Sync 완료 — Leads_OPS에 반영되었습니다.";

  }

  if(!appendResult){
    return "Master 🏗️Append를 실행해주세요.";
  }

  if(appendResult.backgroundScheduled){
    return (
      "Master Append : " + appendResult.appended + "건 반영 완료\n" +
      "Leads_OPS/Report 갱신은 백그라운드에서 진행됩니다 — README 탭에서 " +
      "진행상태 확인 가능."
    );
  }

  if(appendResult.backgroundSkipped){

    const tailFn =
      (importType === "MTA")
        ? "runMTAPipelineTail()"
        : "runLeadsPipelineTail()";

    return (
      "⚠️ Master Append : " + appendResult.appended + "건 반영 완료\n" +
      "다른 백그라운드 작업이 진행 중이라 이번 사이클은 Master append만 " +
      "반영했습니다. Leads_OPS/Report 갱신은 자동으로 재시도되지 않습니다 — " +
      "몇 분 후(다른 작업이 끝난 뒤) 08_PipelineAsync.js의 " + tailFn + "을 " +
      "Apps Script 편집기에서 직접 Run 해주세요."
    );
  }

  return "Master Append : 반영할 신규 레코드가 없었습니다.";

}


/**
 * ==========================================================
 * TEST — formatAppendSummary_()
 * ==========================================================
 */
function testFormatAppendSummary(){

  const mtaSkipped = formatAppendSummary_(
    { appended: 343, backgroundSkipped: true }, "MTA"
  );
  const leadsSkipped = formatAppendSummary_(
    { appended: 32, backgroundSkipped: true }, "LEADS"
  );
  const scheduled = formatAppendSummary_(
    { appended: 10, backgroundScheduled: true }, "LEADS"
  );
  const noNew = formatAppendSummary_({ appended: 0 }, "MTA");
  const icFunnelScheduled = formatAppendSummary_({ backgroundScheduled: true }, "IC_FUNNEL");
  const icFunnelSkipped = formatAppendSummary_({ backgroundSkipped: true }, "IC_FUNNEL");
  const salScheduled = formatAppendSummary_({ backgroundScheduled: true }, "SAL");
  const salSkipped = formatAppendSummary_({ backgroundSkipped: true }, "SAL");

  const ok =
    mtaSkipped.indexOf("runMTAPipelineTail()") !== -1 &&
    mtaSkipped.indexOf("자동으로 재시도되지 않습니다") !== -1 &&
    leadsSkipped.indexOf("runLeadsPipelineTail()") !== -1 &&
    scheduled.indexOf("백그라운드에서 진행됩니다") !== -1 &&
    noNew.indexOf("반영할 신규 레코드가 없었습니다") !== -1 &&
    icFunnelScheduled.indexOf("백그라운드에서 진행됩니다") !== -1 &&
    icFunnelSkipped.indexOf("runSyncICFunnelToOPS()") !== -1 &&
    salScheduled.indexOf("SAL Sync가 백그라운드에서 진행됩니다") !== -1 &&
    salSkipped.indexOf("runSyncSALToOPS()") !== -1;

  Logger.log(
    "testFormatAppendSummary: " + (ok ? "PASS" : "FAIL") +
    "\n  mtaSkipped=" + mtaSkipped +
    "\n  leadsSkipped=" + leadsSkipped
  );

}


/**
 * ==========================================================
 * Format Raw Dedup Summary (Raw 단계 완전 동일 중복 제외 안내)
 *
 * WHY
 * writeLeadRaw()/writeMTARaw()/writeICFunnelRaw()(IMPORT_005_RawWriter.js
 * v4.1.0)가 Raw에 쓰기 전 완전 동일(byte-identical) 행을 걸러내도록
 * 바뀌면서(2026-08-25), 몇 건이 제외됐는지 사용자에게 보여주기 위한 변환 함수.
 *
 * INPUT
 * rawWriteResult : { appended, skipped } | null
 *
 * OUTPUT
 * string (skipped가 0이거나 결과가 없으면 빈 문자열)
 *
 * TEST
 * testFormatRawDedupSummary() 참고.
 * ==========================================================
 */
function formatRawDedupSummary_(rawWriteResult){

  if(!rawWriteResult || rawWriteResult.skipped === 0){
    return "";
  }

  return (
    "⚠️ 완전 동일 중복 " +
    rawWriteResult.skipped +
    "건 제외됨(Raw 미기록)\n\n"
  );

}


/**
 * ==========================================================
 * TEST — formatRawDedupSummary_()
 * ==========================================================
 */
function testFormatRawDedupSummary(){

  const withSkip = formatRawDedupSummary_({ appended: 10, skipped: 3 });
  const noSkip = formatRawDedupSummary_({ appended: 10, skipped: 0 });
  const nullResult = formatRawDedupSummary_(null);

  const ok =
    withSkip.indexOf("3건 제외") !== -1 &&
    noSkip === "" &&
    nullResult === "";

  Logger.log(
    "testFormatRawDedupSummary: " + (ok ? "PASS" : "FAIL") +
    "\n  withSkip=" + withSkip
  );

}


/**
 * Execute Import Pipeline
 *
 * @param {string} importType  "LEADS" | "MTA" | "IC_FUNNEL" | "SAL"
 * @param {string} csvText
 */
function importCsv(
  importType,
  csvText
) {

  try {

    Logger.log("=================================");
    Logger.log("Marketing 2.0 Import Started");
    Logger.log("Import Type : " + importType);
    Logger.log("=================================");

    //----------------------------------------------------------
    // Step 1
    // Read CSV
    //----------------------------------------------------------

    const csvData =
      readCsv(csvText);

    //----------------------------------------------------------
    // Step 2
    // Parse
    //----------------------------------------------------------

    const records =
      parseCsv(
        importType,
        csvData
      );

    Logger.log(
      "Parsed Records : " +
      records.length
    );

    //----------------------------------------------------------
    // Step 3
    // Validate
    //----------------------------------------------------------

    const validated =
      validateRecords(
        importType,
        records
      );

    const summary =
      buildValidationSummary_(
        importType,
        validated
      );

    const validRecords =
      validated.filter(function (record) {
        return record._isValid;
      });

    const invalidRecords =
      validated.filter(function (record) {
        return !record._isValid;
      });

    if (invalidRecords.length > 0) {

      Logger.log(
        "Invalid Records : " +
        invalidRecords.length
      );

      invalidRecords.forEach(function (record) {

        Logger.log(
          "  Row " +
          record._row +
          " : " +
          record._errors.join(", ")
        );

      });

    }

    Logger.log(
      "Valid Records : " +
      validRecords.length
    );

    //----------------------------------------------------------
    // Step 4
    // Strip internal validator fields before Raw write
    //----------------------------------------------------------

    const rawRecords =
      validRecords.map(function (record) {

        const clean = {};

        for (const key in record) {

          if (
            key === "_row" ||
            key === "_errors" ||
            key === "_isValid"
          ) {
            continue;
          }

          clean[key] = record[key];

        }

        return clean;

      });

    //----------------------------------------------------------
    // Step 5
    // Write to Raw
    //----------------------------------------------------------

    let appendResult = null;
    let rawWriteResult = null;

    switch (importType) {

      case "LEADS":
        rawWriteResult = writeLeadRaw(rawRecords);
        appendResult = appendNewLeads(true);
        break;

      case "MTA":
        rawWriteResult = writeMTARaw(rawRecords);
        appendResult = appendNewMTA(true);
        break;

      case "IC_FUNNEL":
        rawWriteResult = writeICFunnelRaw(rawRecords);
        appendResult = scheduleICFunnelPipelineTail_();
        break;

      case "SAL":
        rawWriteResult = writeSALRaw(rawRecords);
        appendResult = scheduleSALPipelineTail_();
        break;

      default:
        throw new Error(
          "Unknown Import Type : " +
          importType
        );

    }

    //----------------------------------------------------------
    // Complete
    //----------------------------------------------------------

    Logger.log("=================================");
    Logger.log("Import (Raw) Completed Successfully");
    Logger.log("=================================");

    return (
      formatValidationSummary_(summary) +
      "\n\n" +
      formatRawDedupSummary_(rawWriteResult) +
      formatAppendSummary_(appendResult, importType)
    );

  }

  catch (error) {

    Logger.log("=================================");
    Logger.log("IMPORT FAILED");
    Logger.log(error.message);
    Logger.log(error.stack);

    throw error;

  }

}


/**
 * ==========================================================
 * Menu Entry Points
 * ==========================================================
 */

function importLeadReport() {

  showUploadDialog_("LEADS");

}


function importMTAReport() {

  showUploadDialog_("MTA");

}


function importICFunnelReport() {

  showUploadDialog_("IC_FUNNEL");

}


function importSALReport() {

  showUploadDialog_("SAL");

}