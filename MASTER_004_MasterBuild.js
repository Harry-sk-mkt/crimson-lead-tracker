/**
 * ==========================================================
 * Marketing 2.0
 * Master Rebuild (Full)
 *
 * Responsibility
 * Master 전체를 Raw로부터 재계산 (복구/Business Rule 변경 시 사용)
 *
 * Stage
 * 10 Master Build (Full Rebuild)
 *
 * Version
 * v4.5.0
 *
 * Change Log
 * v4.5.0 (2026-09-04)
 * - **성능 개선(docs/exec-plans/active/2026-09-03-performance-optimization.md #1)**:
 *   `rebuildLeadsMaster()`/`rebuildMTAMaster()`의 `sortSheetByDate()` 호출 제거 —
 *   MASTER_001_IncrementalMasterBuild.js v1.12.0과 동일 원칙(Master는 실무자가
 *   직접 보지 않는 중간 처리 레이어, Append-only로 통일). Full Rebuild는 Raw를
 *   1:1로 그대로 옮기므로 Raw 자체가 여러 export 배치의 append 순서를 그대로
 *   반영 — 배치 간 겹치는 날짜가 있으면 Master가 완전한 날짜순은 아닐 수 있음(허용된
 *   트레이드오프, 위 exec-plan 참고).
 * v4.4.0 (2026-08-20)
 * - rebuildLeadsMaster()/rebuildMTAMaster() 둘 다에 완전 동일 중복 행
 *   자동 삭제(runAutoDeleteExactDuplicateLeadRows()/
 *   runAutoDeleteExactDuplicateTouchRows(), OPS_006_QA.js) 호출 추가.
 *   두 함수 다 Raw→Master를 1:1로 그대로 옮길 뿐이라(중복 제거 없음),
 *   증분 파이프라인(runLeadsPipelineTail()/runMTAPipelineTail())에만
 *   배선돼 있던 이 정리 단계가 Full Rebuild에선 빠져있어 Raw에 쌓인
 *   중복 행이 그대로 부활하는 문제 실측 발견(Sales Accepted Date 타임존
 *   버그 복구 후 rebuildMTAMaster() 재실행 → S&M_REP All Leads 수치가
 *   다시 부풀려짐, 사용자 발견) — 재발 방지로 Full Rebuild에도 동일하게
 *   배선.
 * v4.3.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `10_MasterBuild.js` → 신규 `MASTER_004_MasterBuild.js`, 코드 내용 변경 없음.
 * v4.3.0 (2026-07-27)
 * - rebuildLeadsMaster()/rebuildMTAMaster() 둘 다에 refreshTargetActuals_()
 *   호출 추가 (refreshContentEngine_() 바로 옆) — Target_REP 실적 컬럼도
 *   항상 최신 유지 (docs/TargetReportDesign.md 참고).
 * v4.2.0 (2026-07-24)
 * - rebuildLeadsMaster()/rebuildMTAMaster() 둘 다에 refreshSearchEngine_()/
 *   refreshContentEngine_() 호출 추가 (refreshBOFUEngine_() 바로 옆).
 * v4.1.0 (2026-07-24)
 * - rebuildLeadsMaster()/rebuildMTAMaster() 둘 다에 refreshBOFUEngine_()
 *   호출 추가 (refreshEventsEngine_() 바로 옆).
 * v4.0.0 (2026-07-21)
 * - buildLeadsMaster/buildMTAMaster → rebuildLeadsMaster/rebuildMTAMaster로 개명.
 * - buildAllMaster() 제거 (Leads/MTA 완전 분리 운영으로 전환).
 * - Rebuild 후 정렬 + PropertiesService 카운터 리셋 추가
 *   (Rebuild 이후 Append가 중복 처리하지 않도록).
 * ==========================================================
 */


/**
 * ==========================================================
 * Rebuild Leads Master (Full)
 * ==========================================================
 */
function rebuildLeadsMaster(showAlert = true) {

  Logger.log(
    CONFIG.LOG.PREFIX +
    " Rebuild Leads Master (FULL) Started"
  );

  const raw = readLeadRaw();

  Logger.log(
    CONFIG.LOG.PREFIX +
    " Raw Leads : " +
    raw.length
  );

  const master =
    transformLeadRecords(raw);

  Logger.log(
    CONFIG.LOG.PREFIX +
    " Master Leads : " +
    master.length
  );

  writeLeadMaster(master);

  //----------------------------------------------------------
  // Raw는 1:1로 그대로 옮기므로(중복 제거 없음), Raw에 쌓인 완전 동일
  // 중복 Lead 행이 그대로 부활함 — runLeadsPipelineTail()(증분 파이프라인)
  // 에만 배선돼 있던 정리 단계를 Full Rebuild에도 동일하게 적용
  // (2026-08-20, S&M_REP All Leads 수치 오염 실측으로 발견).
  //----------------------------------------------------------

  runAutoDeleteExactDuplicateLeadRows();

  //----------------------------------------------------------
  // Rebuild 완료 후, Append가 중복 처리하지 않도록
  // 처리 카운터를 Raw 전체 길이로 리셋
  //----------------------------------------------------------

  PropertiesService
    .getScriptProperties()
    .setProperty(
      CONFIG.PROPERTIES.LEADS_LAST_ROW,
      String(raw.length)
    );

  refreshACQSummary_();
  refreshNewP1Engine_();

  refreshEventsEngine_();
  refreshBOFUEngine_();
  refreshSearchEngine_();
  refreshContentEngine_();
  refreshTargetActuals_();

  Logger.log(
    CONFIG.LOG.PREFIX +
    " ACQ Summary refreshed."
  );

  const result = {
    raw: raw.length,
    master: master.length
  };

  Logger.log(
    CONFIG.LOG.PREFIX +
    " Rebuild Leads Master (FULL) Completed"
  );

  if (showAlert) {

    SpreadsheetApp.getUi().alert(
      "✅ Leads_Master Rebuild 완료",
      [
        "Full Rebuild Complete",
        "",
        "Raw : " + result.raw,
        "Master : " + result.master
      ].join("\n"),
      SpreadsheetApp.getUi().ButtonSet.OK
    );

  }

  return result;

}


/**
 * ==========================================================
 * Rebuild MTA Master (Full)
 * ==========================================================
 */
function rebuildMTAMaster(showAlert = true) {

  Logger.log(
    CONFIG.LOG.PREFIX +
    " Rebuild MTA Master (FULL) Started"
  );

  const raw = readMTARaw();

  Logger.log(
    CONFIG.LOG.PREFIX +
    " Raw MTA : " +
    raw.length
  );

  const master =
    transformMTARecords(raw);

  Logger.log(
    CONFIG.LOG.PREFIX +
    " Master MTA : " +
    master.length
  );

  writeMTAMaster(master);

  //----------------------------------------------------------
  // Raw는 1:1로 그대로 옮기므로(중복 제거 없음), Raw에 쌓인 완전 동일
  // 중복 터치 행이 그대로 부활함 — runMTAPipelineTail()(증분 파이프라인)
  // 에만 배선돼 있던 정리 단계를 Full Rebuild에도 동일하게 적용
  // (2026-08-20, S&M_REP All Leads 수치 오염 실측으로 발견 — Sales
  // Accepted Date 타임존 버그 복구 후 rebuildMTAMaster() 재실행 시
  // 이전에 정리했던 중복 터치 294건이 부활한 것을 사용자가 발견).
  //----------------------------------------------------------

  runAutoDeleteExactDuplicateTouchRows();

  PropertiesService
    .getScriptProperties()
    .setProperty(
      CONFIG.PROPERTIES.MTA_LAST_ROW,
      String(raw.length)
    );

  refreshACQSummary_();
  refreshNewP1Engine_();

  refreshEventsEngine_();
  refreshBOFUEngine_();
  refreshSearchEngine_();
  refreshContentEngine_();
  refreshTargetActuals_();

  Logger.log(
    CONFIG.LOG.PREFIX +
    " ACQ Summary refreshed."
  );

  const result = {
    raw: raw.length,
    master: master.length
  };

  Logger.log(
    CONFIG.LOG.PREFIX +
    " Rebuild MTA Master (FULL) Completed"
  );

  if (showAlert) {

    SpreadsheetApp.getUi().alert(
      "✅ MTA_Master Rebuild 완료",
      [
        "Full Rebuild Complete",
        "",
        "Raw : " + result.raw,
        "Master : " + result.master
      ].join("\n"),
      SpreadsheetApp.getUi().ButtonSet.OK
    );

  }

  return result;

}