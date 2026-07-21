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
 * v3.2.0
 *
 * Change Log
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
function showUploadDialog_(importType){

  const template =
    HtmlService.createTemplateFromFile(
      "00_UploadDialog"
    );

  template.importType = importType;

  const html =
    template
      .evaluate()
      .setWidth(400)
      .setHeight(220);

  SpreadsheetApp
    .getUi()
    .showModalDialog(
      html,
      "Import " + importType
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
      validated.filter(function(record){
        return record._isValid;
      });

    const invalidRecords =
      validated.filter(function(record){
        return !record._isValid;
      });

    if(invalidRecords.length > 0){

      Logger.log(
        "Invalid Records : " +
        invalidRecords.length
      );

      invalidRecords.forEach(function(record){

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
      validRecords.map(function(record){

        const clean = {};

        for(const key in record){

          if(
            key === "_row" ||
            key === "_errors" ||
            key === "_isValid"
          ){
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

    SpreadsheetApp
      .getUi()
      .alert(
        formatValidationSummary_(summary) +
        "\n\nMaster 🏗️Append를 실행해주세요."
      );

  }

  catch (error) {

    Logger.log("=================================");
    Logger.log("IMPORT FAILED");
    Logger.log(error.message);
    Logger.log(error.stack);

    SpreadsheetApp
      .getUi()
      .alert(
        "Import Failed\n\n" +
        error.message
      );

    throw error;

  }

}


/**
 * ==========================================================
 * Menu Entry Points
 * ==========================================================
 */

function importLeadReport(){

  showUploadDialog_("LEADS");

}


function importMTAReport(){

  showUploadDialog_("MTA");

}


function importICFunnelReport(){

  showUploadDialog_("IC_FUNNEL");

}