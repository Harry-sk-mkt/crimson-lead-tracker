/**
 * ==========================================================
 * Marketing 2.0
 * MTA Transformer
 *
 * Responsibility
 * Transform MTA_Raw into MTA_Master.
 *
 * Stage
 * 10 Master Build
 *
 * Version
 * v3.0.0
 *
 * Change Log
 * v3.0.0 (2026-07-20)
 * - Moved helper functions to TransformHelper.
 * - Transformer now only contains transformation logic.
 * ==========================================================
 */


/**
 * ==========================================================
 * Transform MTA Records
 * ==========================================================
 */
function transformMTARecords(rawRecords){

  if(!Array.isArray(rawRecords)){
    throw new Error(
      "transformMTARecords(): rawRecords must be an array."
    );
  }

  const masterRecords = [];

  rawRecords.forEach(function(rawRecord,index){

    try{

      const masterRecord =
        transformMTARecord(rawRecord);

      if(masterRecord){
        masterRecords.push(masterRecord);
      }

    }catch(error){

      Logger.log(

        "[MTATransformer] Row " +

        (index + 2) +

        " : " +

        error.message

      );

    }

  });

  Logger.log(

    "[MTATransformer] " +

    masterRecords.length +

    " / " +

    rawRecords.length +

    " records transformed."

  );

  return masterRecords;

}


/**
 * ==========================================================
 * Transform Single MTA Record
 * ==========================================================
 */
function transformMTARecord(rawRecord){

  if(!rawRecord){
    return null;
  }

  const DATE_FORMAT = "DMY";

  //----------------------------------------------------------
  // Parse Dates
  //----------------------------------------------------------

  const mtaCreatedDate =
    parseDate(
      rawRecord["Multi Touch Attribution: Created Date"],
      DATE_FORMAT
    );

  const leadCreatedDate =
    parseDate(
      rawRecord["Lead Created Date"],
      DATE_FORMAT
    );

  //----------------------------------------------------------
  // Business Segment
  //----------------------------------------------------------

  const businessSegment =
    getBusinessSegment(
      rawRecord["Lead: Last MKT UTM Campaign"],
      "",
      rawRecord["Lead Source"]
    );

  //----------------------------------------------------------
  // Master Record
  //----------------------------------------------------------

  return {

    //------------------------------------------------------
    // Basic
    //------------------------------------------------------

    "Lead ID":
      rawRecord["Lead: Lead ID"] || "",

    "Account":
      rawRecord["Lead: Account Name"] || "",

    "Email":
      rawRecord["Lead: Email"] || "",

    "Phone":
      rawRecord["Lead: Phone"] || "",

    //------------------------------------------------------
    // Lead
    //------------------------------------------------------

    "Lead Priority":
      rawRecord["Lead: Lead Priority"] || "",

    "Sales Funnel Stage":
      rawRecord["Lead: Sales Funnel Stage"] || "",

    //------------------------------------------------------
    // Dates
    //------------------------------------------------------

    "MTA Created Date":
      mtaCreatedDate,

    "Lead Created Date":
      leadCreatedDate,

    //------------------------------------------------------
    // Campaign
    //------------------------------------------------------

    "First MKT UTM Campaign":
      rawRecord["Lead: First MKT UTM Campaign"] || "",

    "Last MKT UTM Campaign":
      rawRecord["Lead: Last MKT UTM Campaign"] || "",

    //------------------------------------------------------
    // Attribution
    //------------------------------------------------------

    "First Lead Source":
      rawRecord["Lead Source"] || "",

    "First Touch Detail":
      rawRecord["Lead Source Detail"] || "",

    //------------------------------------------------------
    // Business
    //------------------------------------------------------

    "Business Segment":
      businessSegment,

    //------------------------------------------------------
    // Date Helpers
    //------------------------------------------------------

    "Created FY":
      getFiscalYear(mtaCreatedDate),

    "Created Quarter":
      getQuarter(mtaCreatedDate),

    "Created Week":
      getWeek(mtaCreatedDate),

    "Created Month":
      getMonthText(mtaCreatedDate),

    "Created Date Helper":
      getMonthKey(mtaCreatedDate),

    //------------------------------------------------------
    // SAL
    //------------------------------------------------------

    "Lead Record Type":
      rawRecord["Lead: Lead Record Type"] || ""
  };

}