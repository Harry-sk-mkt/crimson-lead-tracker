/**
 * ==========================================================
 * Marketing 2.0
 * Csv Reader
 *
 * Responsibility
 * Read CSV text and convert to 2D Array
 *
 * No Parsing
 * No Validation
 * No Loading
 *
 * Version v1.0
 * ==========================================================
 */

/**
 * Read CSV text
 *
 * @param {string} csvText
 * @return {Array<Array<string>>}
 */
function readCsv(csvText){

  if(
    csvText===null ||
    csvText===undefined ||
    csvText===""
  ){
    throw new Error(
      "CSV text is empty."
    );
  }

  const data =
    Utilities.parseCsv(csvText);

  if(
    data.length===0
  ){
    throw new Error(
      "CSV contains no rows."
    );
  }

  Logger.log(
    "================================="
  );

  Logger.log(
    "CSV Reader"
  );

  Logger.log(
    "Rows : " +
    data.length
  );

  Logger.log(
    "Columns : " +
    data[0].length
  );

  Logger.log(
    "Header : " +
    data[0].join(" | ")
  );

  Logger.log(
    "CSV read successfully."
  );

  return data;

}


/**
 * ==========================================================
 * TEST
 * ==========================================================
 */

function testReadCsv(){

  const csvText =
      "Name,Email\n" +
      "John,john@test.com\n" +
      "Jane,jane@test.com";

  const data =
      readCsv(csvText);

  Logger.log(
      data
  );

}