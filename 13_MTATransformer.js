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
 * v5.2.0
 *
 * Change Log
 * v5.2.0 (2026-07-24)
 * - getBusinessSegment() 호출 시 detail 파라미터에 하드코딩된 빈 문자열(`""`)
 *   대신 rawRecord["Lead Source Detail"]을 전달하도록 수정 (기존 버그 — 지금까지
 *   MTA_Master의 BOFU 분류가 "Lead Source Detail에 BOFU 포함" 조건을 한 번도
 *   평가하지 못했음, docs/BusinessSegmentClassification.md의 Priority 서술과
 *   불일치했던 부분. 위 v5.1.0 컬럼명 정정 작업 중 발견, 사용자 확인 후 수정).
 *   getBusinessSegment() 자체의 BOFU 테스트는 16_TransformHelper.js에 기존재.
 * v5.1.0 (2026-07-24)
 * - Master 컬럼명 "First Touch Detail" → "Lead Source Detail"로 정정 (Events_OPS
 *   설계 중 발견, 사용자 확인). Leads_Master의 "First Touch Detail"(raw 필드도
 *   동명, Lead 레벨 First Touch 스냅샷)과 이름이 겹쳐서 혼동을 유발했음 — MTA_Master의
 *   이 필드는 raw "Lead Source Detail"을 그대로 옮긴 터치 레벨 값이라 "First Touch"와
 *   무관함. docs/BusinessSegmentClassification.md는 이미 "Lead Source Detail"로
 *   서술되어 있었음(코드만 안 맞았음). ⚠️ 컬럼명 변경이라 rebuildMTAMaster() 필요.
 * v4.0.0 (2026-07-21)
 * - Added IC Booked Date / IC Completed Date / Opportunity Won Date /
 *   Revenue / Currency fields — ICFunnel_Raw 파이프라인 대체.
 *   MTA_Master 하나로 SAL 판별 + IC Funnel 동기화를 동시에 처리.
 * v5.0.0 (2026-07-22)
 * - Business Segment 소스를 "Lead: Last MKT UTM Campaign"(Lead 레벨 스냅샷,
 *   터치 시점 정보 없음) → "MKT UTM Campaign"(Multi Touch Attribution 객체
 *   자체 필드, 터치별 실제 값)로 변경. Salesforce 리포트 추출 필드 자체를
 *   교체해서 확인됨. Master 컬럼명도 "Last MKT UTM Campaign" → "MKT UTM Campaign"로
 *   변경 (더 이상 "Lead의 최종 터치"가 아니라 "이 터치 자체의 캠페인"이므로).
 * - ⚠️ MTA_Raw 시트에 "MKT UTM Campaign" 헤더가 없으면 appendSheetRecords()가
 *   조용히 드롭함 — 전체 재추출/재구축 절차는 docs/Changelog.md 참고.
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
  //
  // 2026-07-22: "Lead: Last MKT UTM Campaign" → "MKT UTM Campaign"로 소스 변경.
  // 전자는 Lead 객체의 현재 최종 상태 스냅샷(터치 시점 정보 없음, 모든 터치
  // row에 동일한 값이 찍힘)이었고, 후자는 Multi Touch Attribution 객체 자체의
  // 필드라 터치별로 실제 그 시점 캠페인이 찍힘 (Salesforce 리포트 필드 교체로 확인).
  //----------------------------------------------------------

  const businessSegment =
    getBusinessSegment(
      rawRecord["MKT UTM Campaign"],
      rawRecord["Lead Source Detail"],
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

    "MKT UTM Campaign":
      rawRecord["MKT UTM Campaign"] || "",

    //------------------------------------------------------
    // Attribution
    //------------------------------------------------------

    "First Lead Source":
      rawRecord["Lead Source"] || "",

    "Lead Source Detail":
      rawRecord["Lead Source Detail"] || "",

    //------------------------------------------------------
    // Business
    //------------------------------------------------------

    "Business Segment":
      businessSegment,

    //------------------------------------------------------
    // Funnel (2026-07-21 추가 — ICFunnel_Raw 파이프라인 대체)
    //------------------------------------------------------

    "IC Booked Date":
      parseDate(
        rawRecord["Lead: IC Booked Date"],
        DATE_FORMAT
      ),

    "IC Completed Date":
      parseDate(
        rawRecord["Lead: IC Completed Date (Pre-Conversion)"],
        DATE_FORMAT
      ),

    "Opportunity Won Date":
      parseDate(
        rawRecord["Lead: Opportunity Won Date"],
        DATE_FORMAT
      ),

    "Revenue":
      Number(
        rawRecord["Lead: Won Opportunity's Amount (converted)"]
      ) || 0,

    "Currency":
      rawRecord["Lead: Won Opportunity's Amount (converted) Currency"] || "",

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