/**
 * ==========================================================
 * Marketing 2.0
 * Lead Transformer
 *
 * Responsibility
 * Transform Leads_Raw into Leads_Master.
 *
 * Stage
 * 10 Master Build
 *
 * Version
 * v3.0.0
 *
 * Change Log
 * v3.0.0 (2026-07-20)
 * - Moved all helper functions to TransformHelper.
 * - Transformer now only contains transformation logic.
 * ==========================================================
 */


/**
 * ==========================================================
 * Transform Lead Records
 * ==========================================================
 */
function transformLeadRecords(rawRecords){

  if(!Array.isArray(rawRecords)){
    throw new Error(
      "transformLeadRecords(): rawRecords must be an array."
    );
  }

  const masterRecords = [];

  rawRecords.forEach(function(rawRecord,index){

    try{

      const masterRecord =
        transformLeadRecord(rawRecord);

      if(masterRecord){
        masterRecords.push(masterRecord);
      }

    }catch(error){

      Logger.log(

        "[LeadTransformer] Row " +

        (index + 2) +

        " : " +

        error.message

      );

    }

  });

  Logger.log(

    "[LeadTransformer] " +

    masterRecords.length +

    " / " +

    rawRecords.length +

    " records transformed."

  );

  return masterRecords;

}


/**
 * ==========================================================
 * Transform Single Lead Record
 * ==========================================================
 */
function transformLeadRecord(rawRecord){

  if(!rawRecord){
    return null;
  }

  const DATE_FORMAT = "DMY";

  //----------------------------------------------------------
  // Parse Dates
  //----------------------------------------------------------

  const createdDate =
    parseDate(
      rawRecord["Create Date"],
      DATE_FORMAT
    );

  const bookedDate =
    parseDate(
      rawRecord["IC Booked Date"],
      DATE_FORMAT
    );

  const completedDate =
    parseDate(
      rawRecord["IC Completed Date (Pre-Conversion)"],
      DATE_FORMAT
    );

  const wonDate =
    parseDate(
      rawRecord["Opportunity Won Date"],
      DATE_FORMAT
    );

  //----------------------------------------------------------
  // Revenue
  //----------------------------------------------------------

  const revenue =
    Number(
      rawRecord["Won Opportunity's Amount (converted)"]
    ) || 0;

  const currency =
    rawRecord["Won Opportunity's Amount (converted) Currency"] || "";

  //----------------------------------------------------------
  // Master Record
  //----------------------------------------------------------

  return {

    //------------------------------------------------------
    // Lead
    //------------------------------------------------------

    "Lead ID":
      rawRecord["Lead ID"] || "",

    "Company / Account":
      rawRecord["Company / Account"] || "",

    "Email":
      rawRecord["Email"] || "",

    "Phone":
      rawRecord["Phone"] || "",

    //------------------------------------------------------
    // Created
    //------------------------------------------------------

    "Create Date":
      createdDate,

    "Created Month":
      getMonthKey(createdDate),

    "Created FY":
      getFiscalYear(createdDate),

    "Created Quarter":
      getQuarter(createdDate),

    "Created Week":
      getWeek(createdDate),

    "Created Month TEXT":
      getMonthText(createdDate),

    "Created Date Helper":
      createdDate,

    //------------------------------------------------------
    // Attribution
    //------------------------------------------------------

    "First Lead Source":
      rawRecord["First Lead Source"] || "",

    "First Lead Source Category":
      rawRecord["First Lead Source Category"] || "",

    "First MKT UTM Campaign":
      rawRecord["First MKT UTM Campaign"] || "",

    "First Touch Detail":
      rawRecord["First Touch Detail"] || "",

    //------------------------------------------------------
    // Student
    //------------------------------------------------------

    "Lead Priority":
      rawRecord["Lead Priority"] || "",

    "School Name":
      rawRecord["School Name"] || "",

    "School Year/Grade Level":
      rawRecord["School Year/Grade Level"] || "",

    "High School Graduation Year":
      rawRecord["High School Graduation Year"] || "",

    //------------------------------------------------------
    // IC
    //------------------------------------------------------

    "IC Booked Date":
      bookedDate,

    "IC Completed Date":
      completedDate,

    //------------------------------------------------------
    // Opportunity
    //------------------------------------------------------

    "Opportunity Won Date":
      wonDate,

    "Won Month":
      getMonthKey(wonDate),

    "Currency":
      currency,

    "Revenue":
      revenue,

    //------------------------------------------------------
    // Business
    //------------------------------------------------------

    "Business Segment":
      getBusinessSegment(
        rawRecord["First MKT UTM Campaign"],
        rawRecord["First Touch Detail"],
        rawRecord["First Lead Source"]
      )

  };

}