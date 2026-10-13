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
 * v4.7.0
 *
 * Change Log
 * v4.7.0 (2026-10-13)
 * - 공용 비블로킹 알림 `toastNotice_(title, message, ss)` 신규 — 시트 토스트(10초)
 *   + Logger 기록(편집기에서 실행하면 시트 대신 실행 로그에서 바로 보이도록).
 *   MASTER_001/002/012의 정보성 `getUi().alert()`를 전부 이 함수로 교체(사용자 요청).
 *   `notifyRebuildComplete_()`도 이 함수를 쓰도록 정리. 테스트 `testToastNoticeNonBlocking()`.
 * v4.6.0 (2026-10-13)
 * - rebuildLeadsMaster()/rebuildMTAMaster() 완료 알림을 블로킹 팝업
 *   (`getUi().alert`, OK를 눌러야 실행 종료)에서 비블로킹 토스트
 *   (`notifyRebuildComplete_()`)로 교체. 편집기에서 실행하면 시트를 열어
 *   OK를 누르기 전까지 실행이 끝나지 않아(2026-10-13 rebuildMTAMaster
 *   "Completed" 후 5분 42초 대기) 사용자 요청으로 변경. showAlert 파라미터·
 *   시그니처는 그대로(false면 알림 생략). 테스트 `testNotifyRebuildCompleteNonBlocking()`.
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

    notifyRebuildComplete_("✅ Leads_Master Rebuild 완료", result);

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

    notifyRebuildComplete_("✅ MTA_Master Rebuild 완료", result);

  }

  return result;

}


/**
 * ==========================================================
 * Notify Rebuild Complete (non-blocking)
 * ==========================================================
 *
 * WHY
 * getUi().alert()는 OK를 누를 때까지 실행을 붙잡아, 편집기에서 Rebuild를
 * 돌리면 시트를 따로 열어 OK를 눌러야만 실행이 끝났다(2026-10-13). 토스트는
 * 시트에 잠깐 표시만 하고 바로 반환하므로 실행이 즉시 종료된다.
 *
 * @param {string} title
 * @param {{raw:number, master:number}} result
 * @param {Spreadsheet=} ss  테스트 주입용, 생략 시 활성 스프레드시트
 * @return {string} 표시한 메시지
 *
 * TEST
 * testNotifyRebuildCompleteNonBlocking()
 * ==========================================================
 */
function notifyRebuildComplete_(title, result, ss){

  return toastNotice_(title, "Raw : " + result.raw + " / Master : " + result.master, ss);

}


function testNotifyRebuildCompleteNonBlocking(){

  const calls = [];
  const fakeSs = { toast: function(msg, title, sec){ calls.push([msg, title, sec]); } };

  const message = notifyRebuildComplete_("✅ MTA_Master Rebuild 완료", { raw: 89828, master: 89828 }, fakeSs);

  const pass =
    message === "Raw : 89828 / Master : 89828" &&
    calls.length === 1 &&
    calls[0][1] === "✅ MTA_Master Rebuild 완료" &&
    calls[0][2] === 10;

  Logger.log("testNotifyRebuildCompleteNonBlocking: " + (pass ? "PASS" : "FAIL"));
  return pass;

}


/**
 * ==========================================================
 * Toast Notice (non-blocking, 공용)
 * ==========================================================
 *
 * WHY
 * getUi().alert()는 OK를 누를 때까지 실행을 붙잡는다 — 편집기에서 함수를
 * 실행하면 시트를 따로 열어 OK를 눌러야 실행이 끝났다(2026-10-13 사용자 요청으로
 * 정보성 팝업 전부 교체). 토스트는 즉시 반환하고, 같은 내용을 Logger에도 남겨
 * 편집기 실행 로그에서도 보이게 한다. YES/NO 확인창(삭제 전 확인 등)은 대상 아님.
 *
 * @param {string} title    빈 문자열 가능
 * @param {string} message
 * @param {Spreadsheet=} ss 테스트 주입용, 생략 시 활성 스프레드시트
 * @return {string} message
 *
 * TEST
 * testToastNoticeNonBlocking()
 * ==========================================================
 */
function toastNotice_(title, message, ss){

  Logger.log((title ? title + " — " : "") + message);

  (ss || SpreadsheetApp.getActiveSpreadsheet()).toast(message, title, 10);

  return message;

}


function testToastNoticeNonBlocking(){

  const calls = [];
  const fakeSs = { toast: function(msg, title, sec){ calls.push([msg, title, sec]); } };

  const returned = toastNotice_("", "추가할 새 MTA 레코드가 없습니다.", fakeSs);

  const pass =
    returned === "추가할 새 MTA 레코드가 없습니다." &&
    calls.length === 1 &&
    calls[0][0] === "추가할 새 MTA 레코드가 없습니다." &&
    calls[0][1] === "" &&
    calls[0][2] === 10 &&
    testNotifyRebuildCompleteNonBlocking();

  Logger.log("testToastNoticeNonBlocking: " + (pass ? "PASS" : "FAIL"));
  return pass;

}
