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
 * v3.6.0
 *
 * Change Log
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
 * @param {string} importType  "LEADS" | "MTA" | "IC_FUNNEL"
 */
function showUploadDialog_(importType) {

  const template =
    HtmlService.createTemplateFromFile(
      "00_UploadDialog"
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
 *   (IC_FUNNEL처럼 대응하는 append 함수가 없는 Import Type이면 null)
 *
 * OUTPUT
 * string
 * ==========================================================
 */
function formatAppendSummary_(appendResult){

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
    return (
      "Master Append : " + appendResult.appended + "건 반영 완료\n" +
      "다른 백그라운드 작업이 진행 중이라 이번 사이클은 Master append만 " +
      "반영했습니다. Leads_OPS/Report는 다음 정상 실행 때 자동 반영됩니다."
    );
  }

  return "Master Append : 반영할 신규 레코드가 없었습니다.";

}


/**
 * Execute Import Pipeline
 *
 * @param {string} importType  "LEADS" | "MTA" | "IC_FUNNEL"
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

    switch (importType) {

      case "LEADS":
        writeLeadRaw(rawRecords);
        appendResult = appendNewLeads(true);
        break;

      case "MTA":
        writeMTARaw(rawRecords);
        appendResult = appendNewMTA(true);
        break;

      case "IC_FUNNEL":
        writeICFunnelRaw(rawRecords);
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
      formatAppendSummary_(appendResult)
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