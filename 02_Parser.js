/**
 * ==========================================================
 * Marketing 2.0
 * Parser
 *
 * Responsibility
 * Convert CSV 2D Array to Object Array
 *
 * No Validation
 * No Transformation
 * No Loading
 *
 * Version v1.0
 * ==========================================================
 */


/**
 * Convert CSV Array to Object Array
 *
 * @param {string} importType
 * @param {Array<Array<string>>} csvData
 * @return {Array<Object>}
 */
function parseCsv(
    importType,
    csvData
){

    if(
        !Array.isArray(csvData)
    ){
        throw new Error(
            "Invalid CSV data."
        );
    }

    if(
        csvData.length < 2
    ){
        throw new Error(
            "CSV contains no data rows."
        );
    }

    const headers =
        csvData[0];

    const records = [];

    for(
        let rowIndex = 1;
        rowIndex < csvData.length;
        rowIndex++
    ){

        const row =
            csvData[rowIndex];

        const record = {};

        for(
            let colIndex = 0;
            colIndex < headers.length;
            colIndex++
        ){

            const header =
                String(headers[colIndex]).trim();

            record[header] =
                row[colIndex] === undefined
                ? ""
                : row[colIndex];

        }

        records.push(
            record
        );

    }

    Logger.log(
        "================================="
    );

    Logger.log(
        "Parser"
    );

    Logger.log(
        "Import Type : " +
        importType
    );

    Logger.log(
        "Headers : " +
        headers.length
    );

    Logger.log(
        "Records : " +
        records.length
    );

    Logger.log(
        "Parser completed."
    );

    return records;

}


/**
 * ==========================================================
 * TEST
 * ==========================================================
 */

function testParser(){

    const csvData = [

        [
            "Name",
            "Email",
            "Lead Source"
        ],

        [
            "John",
            "john@test.com",
            "Referral"
        ],

        [
            "Jane",
            "jane@test.com",
            "Event"
        ]

    ];

    const records =
        parseCsv(
            "LEADS",
            csvData
        );

    Logger.log(
        JSON.stringify(
            records,
            null,
            2
        )
    );

}