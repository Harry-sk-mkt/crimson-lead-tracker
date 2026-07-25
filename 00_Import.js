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
 * v3.4.0
 *
 * Change Log
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
  template.lastDate = getLatestRawDate_(importType);

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
 * Get Latest Raw Date (업로드 화면에 "마지막으로 들어온 날짜" 표시용)
 *
 * WHY
 * 매주 export 범위를 정할 때 "지난번 어디까지 올렸는지" 기준이 없어서
 * 겹치는 날짜를 다시 올리는 실수가 발생(같은 터치가 MTA_Raw/MTA_Master에
 * 중복으로 쌓임 — findExactDuplicateTouchRows_()로 검출은 되지만 자동
 * 삭제는 안 됨, 24_OPSQA.js 참고).
 *
 * 2026-07-25 정정 (1차): 처음엔 Master 기준으로 만들었으나, Master는
 * Rebuildable(전체 삭제 후 재구축하는 도중엔 비어있을 수 있음)이라 이
 * 시점엔 항상 "(데이터 없음)"으로 잘못 표시됨(사용자 지적). Raw는
 * Immutable하고 항상 import 즉시 반영되는 원본이라 "지금까지 실제로 뭘
 * 올렸는지"를 보려면 Raw를 봐야 정확함 — Master 대신 Raw 기준으로 변경.
 *
 * 2026-07-25 정정 (2차, 성능): sheetToObjects()로 Raw 전체(수만 행 x 전체
 * 컬럼)를 다 읽어서 객체로 변환한 뒤 날짜 컬럼 하나만 쓰고 있어서, Import
 * 다이얼로그가 뜨기 전에 이 무거운 스캔이 끝나야 해 다이얼로그 오픈 자체가
 * 느려짐(사용자 발견). 날짜 컬럼 하나만 getRange()로 targeted read하도록
 * 변경 — 전체 컬럼을 안 읽으므로 훨씬 빠름.
 *
 * @param {string} importType  "LEADS" | "MTA" | "IC_FUNNEL"
 * @return {string}  "yyyy-MM-dd" 형식, 데이터 없으면 안내 문구
 * ==========================================================
 */
function getLatestRawDate_(importType) {

  let sheetName, dateColumn;

  if (importType === "LEADS") {
    sheetName = CONFIG.SHEETS.LEADS_RAW;
    dateColumn = "Create Date";
  } else if (importType === "MTA") {
    sheetName = CONFIG.SHEETS.MTA_RAW;
    dateColumn = "Multi Touch Attribution: Created Date";
  } else {
    return "";
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) return "(데이터 없음)";

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return "(데이터 없음)";

  const headerMap = getHeaderMap(sheet);
  const colIndex = headerMap[dateColumn];

  if (colIndex === undefined) return "(데이터 없음)";

  const values = sheet
    .getRange(2, colIndex + 1, lastRow - 1, 1)
    .getValues();

  let maxDate = null;

  values.forEach(function (row) {

    const d = parseDate(row[0], "DMY");

    if (d instanceof Date && !isNaN(d.getTime())) {
      if (!maxDate || d.getTime() > maxDate.getTime()) {
        maxDate = d;
      }
    }

  });

  if (!maxDate) return "(데이터 없음)";

  return Utilities.formatDate(
    maxDate,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd"
  );

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

    switch (importType) {

      case "LEADS":
        writeLeadRaw(rawRecords);
        break;

      case "MTA":
        writeMTARaw(rawRecords);
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
      "\n\nMaster 🏗️Append를 실행해주세요."
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