/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — ICFunnel_Raw Lead Priority 백로그 확인
 * (docs/OpenItems.md #35 후속 조사, 2026-09-09)
 *
 * Responsibility
 * TEMPQA_037의 runCompareAugustNewP1AgainstSalesforce()가 여전히
 * "Lead Priority 스냅샷 지연"으로 플래깅한 10개 리드에 대해, MTA_Master
 * 대신(2026-09-02부터 MTA_Master는 Lead Priority를 더 이상 관리하지 않음
 * — MASTER_003_MTAFunnelSync.js v1.10.0 참고) 현재 실제 소유 경로인
 * ICFunnel_Raw(MASTER_009_ICFunnelSync.js)를 직접 조회해, 이 리드들의
 * Lead Priority가 그 시트에 애초에 존재하는지/어떤 값인지 확인한다.
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례). ICFunnel_Raw 전체를
 * 한 번 스캔(1회성 진단이라 windowed read 대신 전체 읽기, No Assumptions —
 * 체크포인트 상태와 무관하게 시트에 실제로 뭐가 있는지 직접 확인).
 *
 * INPUT: 없음 (ICFunnel_Raw 직접 스캔, Lead ID 목록은 TEMPQA_037 결과에서
 *   채굴해 하드코딩)
 * OUTPUT: Logger.log만
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 조사 스크립트(TEMPQA 관례).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-09-09)
 * - 최초 구현.
 * ==========================================================
 */
function runCheckICFunnelLeadPriorityBacklog(){

  const TARGET_LEAD_IDS = [
    "00QRC00001JTNAf", // waiceo1107@gmail.com
    "00QRC00001JYdWX", // email629@naver.com
    "00QRC00001KDF21", // yrimlee7@gmail.com
    "00QRC00001KNs3h", // jihkim7575@naver.com
    "00QRC00001KQzqD", // sunrise.shine2020@gmail.com
    "00QRC00001KTmLN", // myfairy82@gmail.com
    "00QRC00001KaOz3", // hyojunan2009@gmail.com
    "00QRC00001KfBV0", // jinsm0725@gmail.com
    "00QRC00001Krphv", // hyejin0401@naver.com
    "00QRC00001M1xdb"  // abakua@naver.com
  ];

  const cols = CONFIG.IC_FUNNEL.COLUMNS;

  const externalFile = openICFunnelRawExternalSpreadsheet_();
  const records = readRawSheet(CONFIG.IC_FUNNEL.SHEET, externalFile);

  Logger.log(
    CONFIG.IC_FUNNEL.SHEET + " 전체 레코드 : " + records.length +
    " (외부 스프레드시트 " + externalFile.getId() + ")"
  );

  const byLeadId = {};

  records.forEach(function(r){

    const leadId = String(r[cols.LEAD_ID] || "").trim();

    if(!leadId) return;

    if(!byLeadId[leadId]) byLeadId[leadId] = [];

    byLeadId[leadId].push(r);

  });

  TARGET_LEAD_IDS.forEach(function(leadId){

    const rows = byLeadId[leadId] || [];

    if(rows.length === 0){
      Logger.log("========== " + leadId + " — ICFunnel_Raw에 행 자체가 없음 ==========");
      return;
    }

    Logger.log("========== " + leadId + " (ICFunnel_Raw " + rows.length + "행) ==========");

    rows.forEach(function(r, i){
      Logger.log(
        "  [" + (i + 1) + "] IC Booked Date=\"" + r[cols.IC_BOOKED_DATE] +
        "\" / Lead Priority=\"" + r[cols.LEAD_PRIORITY] + "\""
      );
    });

  });

}
