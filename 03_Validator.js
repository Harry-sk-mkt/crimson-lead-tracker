/**
 * ==========================================================
 * Marketing 2.0
 * Validator
 *
 * Responsibility
 * Validate parsed records + build validation summary for reporting.
 *
 * No Business Logic
 * No Transformation
 * No Loading
 *
 * Version v1.2.0
 *
 * Change Log
 * v1.2.0 (2026-07-21)
 * - Added buildValidationSummary_() : 필수 필드별 valid/missing 카운트,
 *   Raw Date 컬럼 타입(string) 체크 결과 요약.
 * - Added formatValidationSummary_() : 요약을 alert용 텍스트로 변환.
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
 * Build Validation Summary
 *
 * @param {string} importType
 * @param {Object[]} validated   validateRecords()의 결과 (valid+invalid 전부)
 * @return {Object}
 * ==========================================================
 */
function buildValidationSummary_(
    importType,
    validated
){

    const requiredFields =
        CONFIG.REQUIRED_FIELDS[importType] || [];

    const dateColumns =
        CONFIG.RAW_DATE_COLUMNS[importType] || [];

    const summary = {

        total: validated.length,
        valid: 0,
        invalid: 0,
        fields: {},
        dateTypeCheck: {}

    };

    requiredFields.forEach(function(field){

        summary.fields[field] = {
            valid: 0,
            missing: 0
        };

    });

    dateColumns.forEach(function(column){

        summary.dateTypeCheck[column] = {
            textType: 0,
            nonTextType: 0
        };

    });

    validated.forEach(function(record){

        if(record._isValid){
            summary.valid++;
        } else {
            summary.invalid++;
        }

        requiredFields.forEach(function(field){

            const value = record[field];

            const isEmpty =
                value === null ||
                value === undefined ||
                String(value).trim() === "";

            if(isEmpty){
                summary.fields[field].missing++;
            } else {
                summary.fields[field].valid++;
            }

        });

        dateColumns.forEach(function(column){

            const value = record[column];

            if(typeof value === "string"){
                summary.dateTypeCheck[column].textType++;
            } else {
                summary.dateTypeCheck[column].nonTextType++;
            }

        });

    });

    return summary;

}


/**
 * ==========================================================
 * Format Validation Summary for Alert
 *
 * @param {Object} summary
 * @return {string}
 * ==========================================================
 */
/**
 * ==========================================================
 * Format Validation Summary for Alert
 *
 * @param {Object} summary
 * @return {string}
 * ==========================================================
 */
function formatValidationSummary_(summary){

    const excludeFields =
        CONFIG.VALIDATION_SUMMARY_EXCLUDE.FIELDS || [];

    const excludeDateColumns =
        CONFIG.VALIDATION_SUMMARY_EXCLUDE.DATE_COLUMNS || [];

    const lines = [];

    lines.push(

        summary.valid +
        " / " +
        summary.total +
        " 레코드 업데이트 완료"

    );

    if(summary.invalid > 0){

        lines.push(
            "⚠️ 실패(제외됨) : " +
            summary.invalid +
            "건"
        );

    }

    lines.push("");
    lines.push("[필수 필드 체크]");

    for(const field in summary.fields){

        if(excludeFields.indexOf(field) !== -1){
            continue;
        }

        const stat = summary.fields[field];

        lines.push(

            field +
            " : " +
            stat.valid +
            " valid" +
            (stat.missing > 0
                ? " / ⚠️ " + stat.missing + " missing"
                : "")

        );

    }

    const dateColumns =
        Object.keys(summary.dateTypeCheck)
            .filter(function(column){
                return excludeDateColumns.indexOf(column) === -1;
            });

    if(dateColumns.length > 0){

        lines.push("");
        lines.push("[Date 컬럼 타입 체크 (Text 보존 여부)]");

        dateColumns.forEach(function(column){

            const stat = summary.dateTypeCheck[column];

            lines.push(

                column +
                " : " +
                stat.textType +
                " text" +
                (stat.nonTextType > 0
                    ? " / ⚠️ " + stat.nonTextType + " non-text"
                    : "")

            );

        });

    }

    return lines.join("\n");

}