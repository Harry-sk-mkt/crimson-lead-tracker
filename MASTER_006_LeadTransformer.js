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
 * v3.2.0
 *
 * Change Log
 * v3.2.0 (2026-08-26)
 * - `getBusinessSegment(...)` 직접 호출 → `resolveBusinessSegment_(...)`
 *   (`UTIL_002_UtmProgramDictionary.js` 신규, 동일 인자 시그니처) 호출로 교체
 *   — "Lead 유입 → Dictionary 조회 → Business Segment 분류" 플로우 도입(사용자
 *   요청, docs/BusinessSegmentClassification.md 참고). Program_Segment_Dictionary
 *   에 캐시된 값이 있으면 그걸 우선 쓰고, 없으면 내부적으로 기존
 *   `getBusinessSegment()` 키워드 규칙 그대로 fallback — 딕셔너리가 비어있는
 *   상태(최초 배포 시점)에서는 출력 100% 동일(회귀 없음).
 * v3.1.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `12_LeadTransformer.js` → 신규 `MASTER_006_LeadTransformer.js`, 코드 내용 변경 없음.
 * v3.1.0 (2026-07-25)
 * - getBusinessSegment() 호출에 4번째 인자(First Lead Source Category) 추가 —
 *   4개 어트리뷰션 필드가 전부 빈 리드를 "Other" 대신 "N/A"로 구분하기 위함
 *   (16_TransformHelper.js 참고).
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
      resolveBusinessSegment_(
        rawRecord["First MKT UTM Campaign"],
        rawRecord["First Touch Detail"],
        rawRecord["First Lead Source"],
        rawRecord["First Lead Source Category"]
      )

  };

}