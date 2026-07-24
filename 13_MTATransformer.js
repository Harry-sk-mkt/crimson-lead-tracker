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
 * - Master 출력 필드명 "First Touch Detail" → "Lead Source Detail"로 변경
 *   (rawRecord 소스는 그대로 rawRecord["Lead Source Detail"], 필드명만 변경).
 *   WHY: 이전 세션에서 이미 이 이름으로 변경해 Events/BOFU/Search/Content
 *   트래커(50/60/70/80번대) 전부가 MATCH_FIELD.MTA: "Lead Source Detail"로
 *   구현됐고, 실제 라이브 MTA_Master 시트 헤더도 이미 "Lead Source Detail"
 *   상태(직접 확인: 사용자가 시트 헤더 공유). 그런데 git divergence 해소 중
 *   origin 버전(v5.1.0, BOFU detail 인자 버그만 고치고 필드명은 원래
 *   "First Touch Detail" 그대로)을 checkout --theirs로 통째로 채택하면서
 *   이 rename이 조용히 되돌아가 있었음 — 코드와 라이브 시트 헤더가 어긋난
 *   상태였고, 지금 당장은 rebuildMTAMaster()를 아직 재실행 안 해서 시트
 *   헤더가 구버전 그대로라 문제가 안 드러났을 뿐, 다음 Full Rebuild 시
 *   전체 트래커의 MTA측 지표(SF Reg./SF P1s)가 조용히 0으로 깨질 뻔한
 *   잠재 버그. 코드를 라이브 시트/트래커 기대값에 맞춰 재정렬.
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
 * v5.1.0 (2026-07-22)
 * - getBusinessSegment() 호출 시 detail 인자가 하드코딩된 ""라서 BOFU가
 *   구조적으로 절대 나올 수 없던 버그 수정 — "" → rawRecord["Lead Source Detail"]
 *   (MTA_Raw 리포트에서 이 필드는 Lead 객체가 아닌 Multi Touch Attribution
 *   객체 자체 필드로 확인됨 — 샘플 검증, "Lead:" prefix 없음).
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


/**
 * ==========================================================
 * TEST — transformMTARecord() BOFU Business Segment
 *
 * WHY
 * getBusinessSegment() 호출 시 detail 인자가 하드코딩된 ""라서
 * MTA_Master에서 BOFU가 구조적으로 절대 나올 수 없던 버그(v5.1.0에서
 * "" → rawRecord["Lead Source Detail"]로 수정)의 회귀 방지.
 * ==========================================================
 */
function testTransformMTARecord_BOFU(){

  const rawRecord = {
    "Lead: Lead ID": "L1",
    "Lead: Email": "test@example.com",
    "Multi Touch Attribution: Created Date": "1/6/2026",
    "MKT UTM Campaign": "random-campaign-2026",
    "Lead Source Detail": "BOFU-Consult",
    "Lead Source": "Web"
  };

  const result = transformMTARecord(rawRecord);

  const pass = result["Business Segment"] === "BOFU";

  Logger.log("Business Segment : " + result["Business Segment"] + " (expected BOFU)");
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * TEST — transformMTARecord() 출력 필드명 "Lead Source Detail" 고정
 *
 * WHY
 * git divergence 해소 중 origin 버전을 통째로 채택하면서 이 출력 필드명이
 * "Lead Source Detail" → "First Touch Detail"로 조용히 되돌아갔던 적이
 * 있음 (2026-07-24 발견) — 라이브 MTA_Master 시트 헤더 및 Events/BOFU/
 * Search/Content 트래커(50/60/70/80번대)의 MATCH_FIELD.MTA가 전부
 * "Lead Source Detail"을 기대하는 상태와 어긋나 있었음. Full Rebuild 시
 * 전체 트래커 MTA측 지표가 조용히 0이 되는 회귀를 방지하기 위한 테스트.
 * ==========================================================
 */
function testTransformMTARecord_OutputFieldName(){

  const rawRecord = {
    "Lead: Lead ID": "L1",
    "Lead: Email": "test@example.com",
    "Multi Touch Attribution: Created Date": "1/6/2026",
    "MKT UTM Campaign": "random-campaign-2026",
    "Lead Source Detail": "WB-2026-01-KOR-MOFU-Core Sample Program",
    "Lead Source": "Web"
  };

  const result = transformMTARecord(rawRecord);

  const pass =
    result["Lead Source Detail"] === "WB-2026-01-KOR-MOFU-Core Sample Program" &&
    result["First Touch Detail"] === undefined;

  Logger.log("Lead Source Detail : " + result["Lead Source Detail"]);
  Logger.log("First Touch Detail (should be undefined) : " + result["First Touch Detail"]);
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}