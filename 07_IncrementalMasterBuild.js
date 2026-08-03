/**
 * ==========================================================
 * Marketing 2.0
 * Incremental Master Build
 *
 * Responsibility
 * Raw에 새로 추가된 행만 Transform → Master에 Append
 *
 * Stage
 * 10 Master Build (Incremental)
 *
 * Version
 * v1.6.0
 *
 * Change Log
 * v1.6.0 (2026-08-04)
 * - appendNewLeads()/appendNewMTA()에 `silent` 파라미터 추가(옵셔널, 기본
 *   false — 기존 메뉴 호출부는 무변경) — Import(00_Import.js)가 Raw 기록
 *   직후 자동으로 Append까지 체이닝하도록 사용자가 요청(2026-08-04, Import→
 *   Append 2단계 수동 클릭이 예상과 다르다는 피드백). silent=true면 함수
 *   내부의 SpreadsheetApp.getUi().alert() 호출을 전부 건너뛰어, Import
 *   다이얼로그가 이미 보여줄 완료 메시지와 중복 팝업이 뜨지 않게 함
 *   (`buildLeadsOPS(skipQA)`와 동일한 옵셔널 파라미터 패턴 재사용).
 * v1.5.0 (2026-08-04)
 * - appendNewLeads()/appendNewMTA()가 Master append 직후 refresh 체인을
 *   직접 호출하던 것을, 08_PipelineAsync.js의 락(acquirePipelineLock_)
 *   + 설치형 1회성 트리거(schedulePipelineTail_)로 백그라운드 위임하도록
 *   변경 — Raw→Master append/sort/카운터 갱신 로직 자체는 변경 없음
 *   (docs/OpenItems.md #9 구현). 다른 백그라운드 작업이 이미 진행 중이면
 *   이번 사이클은 Master append만 반영하고 refresh는 건너뜀(안전 —
 *   다음 정상 실행 때 Master 전체 기준으로 재계산되므로 데이터 손실 없음).
 * v1.4.0 (2026-07-27)
 * - appendNewLeads()에 refreshTargetActuals_() 호출 추가 (refreshContentEngine_()
 *   바로 옆) — Target_REP 실적(Actual P1/CPNP1) 컬럼도 항상 최신 유지
 *   (Engine 목표 재계산은 하지 않음, 90_TargetEngine.js/91_TargetReport.js 참고).
 * v1.3.0 (2026-07-24)
 * - appendNewLeads()에 refreshSearchEngine_()/refreshContentEngine_() 호출 추가
 *   (refreshBOFUEngine_() 바로 옆) — Search/Content Engine도 Master/OPS 변경 시
 *   항상 최신 유지.
 * v1.2.0 (2026-07-24)
 * - appendNewLeads()에 refreshBOFUEngine_() 호출 추가 (refreshEventsEngine_()
 *   바로 옆) — BOFU_Engine도 Master/OPS 변경 시 항상 최신 유지.
 * v1.1.0 (2026-07-22)
 * - appendNewLeads() : Master append 후 buildLeadsOPS(skipQA=true) 자동 호출 추가.
 *   신규 Lead가 Leads_OPS에 지체 없이 반영되어야 이후 MTA sync의 대상이 될 수 있음.
 *   refreshACQSummary_() 이전에 실행되도록 배치 (ACQ Summary가 최신 OPS 상태를
 *   반영하도록 하기 위함 — 순서가 바뀌면 이번에 들어온 신규 Lead가 반영되기 전
 *   상태로 Summary가 계산됨).
 * - appendNewMTA() : 기존 refreshACQSummary_() 호출을 syncMTAFunnelToOPS_() 호출로
 *   대체. syncMTAFunnelToOPS_()가 끝에서 이미 refreshACQSummary_()를 호출하므로
 *   중복 계산 방지. "IC Requested 체크했는데 Booked Date가 안 보인다"는 갭 해소 목적
 *   (수동으로 09_MTAFunnelSync.js의 runSyncMTAFunnelToOPS()를 따로 실행할 필요 없어짐).
 * ==========================================================
 */


/**
 * ==========================================================
 * Append New Leads
 * ==========================================================
 */
function appendNewLeads(silent){

  const start = new Date();

  Logger.log("======================================");
  Logger.log("Append New Leads Started");
  Logger.log("======================================");

  const propKey =
    CONFIG.PROPERTIES.LEADS_LAST_ROW;

  const lastProcessed =
    Number(
      PropertiesService
        .getScriptProperties()
        .getProperty(propKey)
    ) || 0;

  const allRaw =
    readLeadRaw();

  const newRaw =
    allRaw.slice(lastProcessed);

  Logger.log(
    "Total Raw : " + allRaw.length +
    " / Already Processed : " + lastProcessed +
    " / New : " + newRaw.length
  );

  if(newRaw.length === 0){

    Logger.log("No new Lead records to append.");

    if(!silent){
      SpreadsheetApp.getUi().alert(
        "추가할 새 Lead 레코드가 없습니다."
      );
    }

    return { appended: 0 };

  }

  const newMaster =
    transformLeadRecords(newRaw);

  appendSheetRecords(
    CONFIG.SHEETS.LEADS_MASTER,
    newMaster
  );

  sortSheetByDate(
    CONFIG.SHEETS.LEADS_MASTER,
    "Create Date"
  );

  PropertiesService
    .getScriptProperties()
    .setProperty(
      propKey,
      String(allRaw.length)
    );

  const seconds =
    ((new Date() - start) / 1000).toFixed(2);

  Logger.log(
    "Appended " + newMaster.length +
    " Lead records. (" + seconds + "s)"
  );

  const locked = !acquirePipelineLock_(CONFIG.PIPELINE.TYPES.LEADS);

  if(locked){

    Logger.log(
      "Pipeline lock held by another run — skipping background refresh this cycle."
    );

    Logger.log("======================================");
    Logger.log("Append New Leads Completed (background skipped)");
    Logger.log("======================================");

    if(!silent){
      SpreadsheetApp.getUi().alert(
        "✅ Leads_Master Append 완료 (백그라운드 처리는 건너뜀)",
        "신규 반영 : " + newMaster.length + "건\n" +
        "소요 시간 : " + seconds + "s\n\n" +
        "다른 백그라운드 작업이 진행 중이라 이번 사이클은 Master append만 " +
        "반영했습니다. Leads_OPS/Report는 다음 정상 실행 때 자동 반영됩니다.",
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    }

    return { appended: newMaster.length, backgroundSkipped: true };

  }

  writePipelineStatusState_(
    CONFIG.PIPELINE.TYPES.LEADS,
    { status: "PENDING", stage: "", startedAt: "", finishedAt: "", error: "" }
  );

  writePipelineStatusToReadme_();

  schedulePipelineTail_("runLeadsPipelineTail");

  Logger.log("======================================");
  Logger.log("Append New Leads Completed (background scheduled)");
  Logger.log("======================================");

  if(!silent){
    SpreadsheetApp.getUi().alert(
      "✅ Leads_Master Append 완료 (백그라운드 처리 시작)",
      "신규 반영 : " + newMaster.length + "건\n" +
      "소요 시간 : " + seconds + "s\n\n" +
      "Leads_OPS/Report 갱신은 백그라운드에서 진행됩니다 — README 탭에서 " +
      "진행상태 확인 가능.",
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }

  return { appended: newMaster.length, backgroundScheduled: true };

}


/**
 * ==========================================================
 * Append New MTA
 * ==========================================================
 */
function appendNewMTA(silent){

  const start = new Date();

  Logger.log("======================================");
  Logger.log("Append New MTA Started");
  Logger.log("======================================");

  const propKey =
    CONFIG.PROPERTIES.MTA_LAST_ROW;

  const lastProcessed =
    Number(
      PropertiesService
        .getScriptProperties()
        .getProperty(propKey)
    ) || 0;

  
  const allRaw =
    readMTARaw();

  const newRaw =
    allRaw.slice(lastProcessed);

  Logger.log(
    "Total Raw : " + allRaw.length +
    " / Already Processed : " + lastProcessed +
    " / New : " + newRaw.length
  );

  if(newRaw.length === 0){

    Logger.log("No new MTA records to append.");

    if(!silent){
      SpreadsheetApp.getUi().alert(
        "추가할 새 MTA 레코드가 없습니다."
      );
    }

    return { appended: 0 };

  }

  const newMaster =
    transformMTARecords(newRaw);

  appendSheetRecords(
    CONFIG.SHEETS.MTA_MASTER,
    newMaster
  );

  sortSheetByDate(
    CONFIG.SHEETS.MTA_MASTER,
    "MTA Created Date"
  );

  PropertiesService
    .getScriptProperties()
    .setProperty(
      propKey,
      String(allRaw.length)
    );

  const seconds =
    ((new Date() - start) / 1000).toFixed(2);

  Logger.log(
    "Appended " + newMaster.length +
    " MTA records. (" + seconds + "s)"
  );

  const locked = !acquirePipelineLock_(CONFIG.PIPELINE.TYPES.MTA);

  if(locked){

    Logger.log(
      "Pipeline lock held by another run — skipping background refresh this cycle."
    );

    Logger.log("======================================");
    Logger.log("Append New MTA Completed (background skipped)");
    Logger.log("======================================");

    if(!silent){
      SpreadsheetApp.getUi().alert(
        "✅ MTA_Master Append 완료 (백그라운드 처리는 건너뜀)",
        "신규 반영 : " + newMaster.length + "건\n" +
        "소요 시간 : " + seconds + "s\n\n" +
        "다른 백그라운드 작업이 진행 중이라 이번 사이클은 Master append만 " +
        "반영했습니다. Leads_OPS/Report는 다음 정상 실행 때 자동 반영됩니다.",
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    }

    return { appended: newMaster.length, backgroundSkipped: true };

  }

  writePipelineStatusState_(
    CONFIG.PIPELINE.TYPES.MTA,
    { status: "PENDING", stage: "", startedAt: "", finishedAt: "", error: "" }
  );

  writePipelineStatusToReadme_();

  schedulePipelineTail_("runMTAPipelineTail");

  Logger.log("======================================");
  Logger.log("Append New MTA Completed (background scheduled)");
  Logger.log("======================================");

  if(!silent){
    SpreadsheetApp.getUi().alert(
      "✅ MTA_Master Append 완료 (백그라운드 처리 시작)",
      "신규 반영 : " + newMaster.length + "건\n" +
      "소요 시간 : " + seconds + "s\n\n" +
      "Leads_OPS/Report 갱신은 백그라운드에서 진행됩니다 — README 탭에서 " +
      "진행상태 확인 가능.",
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }

  return { appended: newMaster.length, backgroundScheduled: true };

}