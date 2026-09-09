/**
 * ==========================================================
 * Reset Incremental Build Counters
 *
 * Responsibility
 * Raw/Master를 수동으로 초기화한 뒤,
 * PropertiesService 카운터를 0으로 리셋.
 *
 * ⚠️ 반드시 Raw/Master 시트를 직접 비운 "직후"에만 실행할 것.
 * **2026-09-03부터 Leads_Raw/MTA_Raw는 메인 스프레드시트가 아니라 각자 전용 외부
 * 스프레드시트에 있음**(`CONFIG.RAW_EXTERNAL.LEADS/MTA.SPREADSHEET_ID`,
 * `MASTER_012_RawExternalMigration.js` 참고) — 1번 단계에서 Leads_Raw/MTA_Raw를
 * 비울 땐 메인 스프레드시트가 아니라 그 외부 스프레드시트를 열어야 한다.
 * Leads_Master/MTA_Master는 그대로 메인 스프레드시트에 있음(이관 대상 아님).
 * 1. Leads_Raw/MTA_Raw(각자의 외부 스프레드시트) — 시트 내용 수동 삭제 (헤더 포함 전체 지우기)
 *    Leads_Master, MTA_Master(메인 스프레드시트) — 시트 내용 수동 삭제 (헤더 포함 전체 지우기)
 * 2. Apps Script 편집기에서 resetIncrementalCounters() 실행 (카운터 0으로)
 * 3. SheetWriter, RawWriter, IncrementalMasterBuild, MasterBuild, menu.gs 전부 적용
 *    (구 SheetSorter는 `docs/OpenItems.md` #18로 정렬 로직 자체가 삭제돼 더 이상 존재하지 않음)
 * 4. 📥 Import → Import Leads / Import MTA로 전체 CSV 새로 업로드 (Raw에 처음부터 다시 쌓임)
 * 5. 🏗️ Build → Append New Leads / Append New MTA 실행 (카운터가 0이라 Raw 전체가 "신규"로 인식되어 Master 전체가 한 번에 생성됨)
 * 6. 이후부터는 매주 새 CSV만 Import → Append 반복
 * ==========================================================
 */
function resetIncrementalCounters(){

  const props =
    PropertiesService.getScriptProperties();

  props.setProperty(
    CONFIG.PROPERTIES.LEADS_LAST_ROW,
    "0"
  );

  props.setProperty(
    CONFIG.PROPERTIES.MTA_LAST_ROW,
    "0"
  );

  Logger.log(
    CONFIG.LOG.PREFIX +
    " Incremental counters reset to 0 (Leads, MTA)."
  );

}

/**
 * ==========================================================
 * Reset MTA Incremental Counter Only
 *
 * Responsibility
 * MTA_Raw/MTA_Master를 수동으로 초기화한 뒤,
 * MTA 카운터만 0으로 리셋 (Leads는 건드리지 않음).
 *
 * WHY
 * MTA CSV에 "Lead: Lead Record Type" 필드가 새로 추가되어
 * 기존 MTA_Raw/MTA_Master 전체를 재수출/재계산해야 함.
 * Leads 쪽은 영향 없으므로 카운터를 그대로 유지해야 함.
 *
 * ⚠️ 반드시 MTA_Raw/MTA_Master 시트를 직접 비운 "직후"에만 실행할 것.
 *
 * Version
 * v1.0.1
 * ==========================================================
 */
function resetMTACounterOnly(){

  PropertiesService
    .getScriptProperties()
    .setProperty(
      CONFIG.PROPERTIES.MTA_LAST_ROW,
      "0"
    );

  Logger.log(
    CONFIG.LOG.PREFIX +
    " MTA incremental counter reset to 0. (Leads counter untouched)"
  );

}


/**
 * ==========================================================
 * TEST — resetMTACounterOnly()
 *
 * WHY
 * MTA 카운터만 0이 되고, LEADS 카운터는 실행 전후로 변하지
 * 않는지 확인 (실수로 같이 리셋되는 사고 방지).
 * ==========================================================
 */
function testResetMTACounterOnly(){

  const props = PropertiesService.getScriptProperties();

  const leadsKey = CONFIG.PROPERTIES.LEADS_LAST_ROW;
  const mtaKey = CONFIG.PROPERTIES.MTA_LAST_ROW;

  // 임의의 값으로 세팅해두고 시작 (기존 값 건드리지 않기 위해 백업)
  const originalLeadsValue = props.getProperty(leadsKey);

  props.setProperty(leadsKey, "999");
  props.setProperty(mtaKey, "999");

  resetMTACounterOnly();

  const leadsAfter = props.getProperty(leadsKey);
  const mtaAfter = props.getProperty(mtaKey);

  const pass =
    leadsAfter === "999" &&
    mtaAfter === "0";

  Logger.log("Leads after (expected 999) : " + leadsAfter);
  Logger.log("MTA after (expected 0) : " + mtaAfter);
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

  // 원래 값 복구
  if(originalLeadsValue !== null){
    props.setProperty(leadsKey, originalLeadsValue);
  } else {
    props.deleteProperty(leadsKey);
  }

}