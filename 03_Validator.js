/**
 * ==========================================================
 * Marketing 2.0
 * Validator
 *
 * Responsibility
 * Validate parsed records
 *
 * No Business Logic
 * No Transformation
 * No Loading
 *
 * Version v1.1
 * ==========================================================
 */


/**
 * Validate parsed records
 *
 * @param {string} importType
 * @param {Array<Object>} records
 * @return {Array<Object>}
 */
function validateRecords(
    importType,
    records
){

    if(
        !Array.isArray(records)
    ){
        throw new Error(
            "Invalid records."
        );
    }

    const validated = [];

    for(
        let i = 0;
        i < records.length;
        i++
    ){

        const record = records[i];

        const output = {};

        for(
            const key in record
        ){
            output[key] = record[key];
        }

        output._row = i + 2;
        output._errors = [];
        output._isValid = true;

        validateRequiredFields_(
            importType,
            output
        );

        if(
            output._errors.length > 0
        ){
            output._isValid = false;
        }

        validated.push(
            output
        );

    }

    Logger.log(
        "================================="
    );

    Logger.log(
        "Validator"
    );

    Logger.log(
        "Import Type : " +
        importType
    );

    Logger.log(
        "Records : " +
        validated.length
    );

    Logger.log(
        "Validation completed."
    );

    return validated;

}


/**
 * Validate required fields
 *
 * @param {string} importType
 * @param {Object} record
 */
function validateRequiredFields_(
    importType,
    record
){

    const requiredFields =
        CONFIG.REQUIRED_FIELDS[importType] || [];

    requiredFields.forEach(function(field){

        if(
            !(field in record)
        ){
            record._errors.push(
                "Missing column : " +
                field
            );
            return;
        }

        if(
            record[field]===null ||
            record[field]===undefined ||
            String(record[field]).trim()===""
        ){
            record._errors.push(
                field +
                " is empty."
            );
        }

    });

}


/**
 * ==========================================================
 * TEST
 * ==========================================================
 */

function testValidator(){

    const records = [

        {
            Name:"John",
            Email:"john@test.com",
            "Lead Source":"Referral"
        },

        {
            Name:"",
            Email:"",
            "Lead Source":"Event"
        }

    ];

    const validated =
        validateRecords(
            "LEADS",
            records
        );

    Logger.log(
        JSON.stringify(
            validated,
            null,
            2
        )
    );

}