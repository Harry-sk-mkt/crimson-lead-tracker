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
 * v3.0.0
 *
 * Change Log
 * v3.0.0 (2026-07-20)
 * - Removed transformRecords()/loadRecords() call to Master.
 * - Import now writes to Raw only (writeLeadRaw / writeMTARaw).
 * - Master Build is a separate manual step (Build menu).
 * - Invalid records (validateRecords._isValid === false) are
 *   logged and excluded from Raw write, never partially saved.
 * ==========================================================
 */


/**
 * Execute Import Pipeline
 *
 * @param {string} importType  "LEADS" | "MTA"
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
        rawRecords.length +
        " / " +
        records.length +
        " records written to Raw.\n\n" +
        "Master를 갱신하려면 🏗️ Build 메뉴를 사용하세요."
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
 * Open Upload Dialog
 * ==========================================================
 *
 * @param {string} importType  "LEADS" | "MTA"
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