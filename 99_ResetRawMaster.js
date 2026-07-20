/**
 * ==========================================================
 * Reset Incremental Build Counters
 *
 * Responsibility
 * Raw/Master를 수동으로 초기화한 뒤,
 * PropertiesService 카운터를 0으로 리셋.
 *
 * ⚠️ 반드시 Raw/Master 시트를 직접 비운 "직후"에만 실행할 것.
 * 1. Leads_Raw, MTA_Raw, Leads_Master, MTA_Master — 시트 내용 수동 삭제 (헤더 포함 전체 지우기)
 * 2. Apps Script 편집기에서 resetIncrementalCounters() 실행 (카운터 0으로)
 * 3. SheetWriter, RawWriter, SheetSorter, IncrementalMasterBuild, MasterBuild, menu.gs 전부 적용
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