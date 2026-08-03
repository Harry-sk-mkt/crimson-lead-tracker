/**
 * ==========================================================
 * Marketing 2.0
 * Pipeline Async (Background Trigger Chain)
 *
 * Responsibility
 * appendNewLeads()/appendNewMTA()(07_IncrementalMasterBuild.js)의 무거운
 * refresh 체인(buildLeadsOPS/syncMTAFunnelToOPS_/ACQ·NewP1·Events·BOFU·
 * Search·Content Engine·Target Actuals)을 설치형 1회성 time-based 트리거로
 * 백그라운드 실행. Raw→Master append는 그대로 동기 처리하고, 그 뒤는 여기로
 * 넘겨 사용자가 완료를 기다리지 않게 한다(docs/OpenItems.md #9).
 *
 * WHY
 * Leads_OPS(3만5천+행)/MTA_Master(8만1천+행) 전체 스캔 체인이 appendNewLeads()/
 * appendNewMTA() 같은 실행 안에 몰려 있어 브라우저 다이얼로그가 몇 분씩 안
 * 닫히는 문제가 있었음(2026-07-25 실측, docs/apps-script-gotchas.md #5).
 * 설치형 트리거는 Simple Trigger(onEdit)와 달리 스크립트 소유자의 Full
 * Authorization으로 실행되므로 외부 스프레드시트 openById()도 문제없이 호출
 * 가능(Target_REP/ACQ_REP가 겪은 Simple Trigger 권한 제약과 무관).
 *
 * Stage
 * 10 Master Build (Incremental)
 *
 * Version
 * v1.5.0
 *
 * Change Log
 * v1.5.0 (2026-08-04)
 * - 신규 `buildReadmeGuideRows_()`(순수)/`runSetupReadmeGuide()`(수동 실행 전용) —
 *   README 탭에 비개발자 실무자용 가이드 섹션(평소 할 일/진행상태 확인법/기간 변경법/
 *   아직 수동인 것/장애 시 대응) 작성. 정확한 위치를 미리 정하지 않고, 제목 텍스트로
 *   기존 섹션을 찾아 있으면 그 자리에 덮어쓰고 없으면 시트 맨 아래에 추가(위치 충돌
 *   없음). 사용자 요청(2026-08-04, 세션 마무리 직전).
 * v1.4.0 (2026-08-04)
 * - `runAutoDeleteExactDuplicateLeadRows()`(24_OPSQA.js)/`runAutoDeleteExactDuplicateTouchRows()`
 *   (24_OPSQA.js)를 각각 `runLeadsPipelineTail()`/`runMTAPipelineTail()`의 **첫 단계**로 추가
 *   (사용자 요청 — "완전 중복 삭제도 백그라운드에 포함시키자"). `buildLeadsOPS`/
 *   `syncMTAFunnelToOPS_`보다 먼저 실행해 OPS/Engine이 중복 제거된 Master를 기준으로
 *   계산되도록 순서 배치. 두 함수 모두 `SpreadsheetApp.getUi()` 호출이 없어(Logger만 사용)
 *   설치형 트리거에서 안전하게 호출 가능함을 소스 확인. QA 전체(`runOPSQA_()`, ~2분,
 *   Funnel Match 등 다른 검사 포함)는 여전히 `skipQA=true`로 스킵 — 이번 변경은 완전 중복
 *   삭제 단독 기능만 포함(docs/OpenItems.md #9 "QA 재활성화 여부"와는 별개 항목).
 * v1.3.0 (2026-08-04)
 * - 신규 `refreshReportGenerate_()` — `generateACQReport_()`(30_ACQReport.js)/
 *   `generateNewP1Report_()`(40_NewP1Report.js)를 매 백그라운드 실행 끝에 자동
 *   호출해 ACQ_REP/NewP1_REP Report Area 자체도 자동 갱신(사용자 요청 — 그동안
 *   Generate 체크박스를 직접 눌러야 했음). Control 행 Start FY > End FY 등으로
 *   실패해도 각각 독립 try/catch로 감싸 Logger에만 기록하고 전체 파이프라인은
 *   DONE 유지(사용자 확정 — Report 실패로 6분짜리 핵심 데이터 refresh 전체를
 *   재실행하게 만들지 않기 위함). `runLeadsPipelineTail()`/`runMTAPipelineTail()`
 *   마지막 단계로 추가(`refreshReportFYDropdowns_` 바로 다음).
 * v1.2.0 (2026-08-04)
 * - 신규 `refreshReportFYDropdowns_()` — `setupACQDropdowns()`(30_ACQReport.js)/
 *   `setupNewP1Dropdowns_()`(40_NewP1Report.js)를 매 백그라운드 실행 끝에 자동
 *   호출해 ACQ_REP/NewP1_REP Start FY/End FY 드롭다운 옵션을 최신 데이터 기준으로
 *   갱신 — 원래 "1회성 수동 실행"이었으나, 새 FY(8월 시작) 데이터가 들어와도
 *   드롭다운에 반영 안 되는 문제를 사용자가 실사용 중 발견, 자동화 요청
 *   (2026-08-04). `runLeadsPipelineTail()`/`runMTAPipelineTail()` 마지막 단계로 추가.
 * v1.1.0 (2026-08-04)
 * - 실사용 1차 검증 피드백 반영: (1) `nowTimestamp_()`가 `CONFIG.DATE.TIMEZONE`
 *   (스크립트 타임존, America/New_York)이 아닌 신규 `CONFIG.DATE.DISPLAY_TIMEZONE`
 *   ("Asia/Seoul")로 포맷하도록 수정 + " KST" 표기 추가 — README Last Started/
 *   Finished가 미국 시간으로 찍혀 사용자가 혼동. (2) `buildPipelineStatusGrid_()`
 *   헤더 라벨 "Leads"/"MTA" → "New Leads Upload"/"MTA Upload"로 변경(사용자 요청,
 *   README에서 더 명확하게 구분되도록).
 * v1.0.0 (2026-08-04)
 * - 최초 구현. docs/OpenItems.md #9(2026-07-28 설계 확정) 구현. 최초 내부 헬퍼명을
 *   `runPipelineStage_()`로 뒀다가 pre-commit naming 훅(`scripts/check-naming.sh`)이
 *   "run"으로 시작 + `_`로 끝나는 이름을 진입점 오탈자로 감지해 차단 — 실제로는
 *   진입점이 아닌 내부 헬퍼라 `advancePipelineStage_()`로 개명.
 * ==========================================================
 */


/**
 * ==========================================================
 * Compute Pipeline Lock State
 *
 * WHY
 * Leads/MTA 백그라운드 체인이 겹쳐 실행되면 안 되므로(사용자 확정 — 단순 락,
 * 자동 대기열 없음, 겹치면 두 번째 시도를 거부) 락 획득 가능 여부를 순수
 * 로직으로 분리 — PropertiesService IO 없이 테스트 가능하게 함.
 *
 * INPUT
 * existingLockValue : string  (PropertiesService에 저장된 현재 락 값, 없으면 "")
 * requestedType      : string ("LEADS" | "MTA")
 *
 * OUTPUT
 * { acquired: boolean, holderType: string|null }
 * - 락이 비어있으면 acquired:true, holderType:null
 * - 이미 값이 있으면(자기 자신의 타입이든 다른 타입이든) acquired:false,
 *   holderType은 기존 값 그대로
 *
 * TEST
 * ("", "LEADS") → { acquired:true,  holderType:null }
 * ("LEADS", "LEADS") → { acquired:false, holderType:"LEADS" }
 * ("MTA", "LEADS") → { acquired:false, holderType:"MTA" }
 * ==========================================================
 */
function computePipelineLockState_(existingLockValue, requestedType){

  if(!existingLockValue){
    return { acquired: true, holderType: null };
  }

  return { acquired: false, holderType: existingLockValue };

}


/**
 * ==========================================================
 * Build Pipeline Status Grid
 *
 * WHY
 * README!A1:C7 Pipeline Status 블록에 쓸 2D 배열을 만드는 로직을 Sheet IO와
 * 분리해 Node 하네스로 테스트 가능하게 함(사용자 확정 레이아웃, 2026-08-04).
 *
 * INPUT
 * leadsState / mtaState : { status, stage, startedAt, finishedAt, error }
 *   각 필드 미제공 시 status는 "IDLE", 나머지는 빈 문자열로 채움.
 *
 * OUTPUT
 * string[7][3]  (A~C열, 1~7행 그대로)
 *
 * TEST
 * RUNNING/FAILED 상태를 각각 넣으면 Status/Current Stage/Last Error 셀에
 * 그대로 반영되어야 하고, 빈 객체({})를 넣으면 Status가 "IDLE"이어야 함.
 * ==========================================================
 */
function buildPipelineStatusGrid_(leadsState, mtaState){

  const leads = leadsState || {};
  const mta = mtaState || {};

  return [
    ["⚙️ Pipeline Status", "", ""],
    ["", "New Leads Upload", "MTA Upload"],
    ["Status", leads.status || "IDLE", mta.status || "IDLE"],
    ["Current Stage", leads.stage || "", mta.stage || ""],
    ["Last Started", leads.startedAt || "", mta.startedAt || ""],
    ["Last Finished", leads.finishedAt || "", mta.finishedAt || ""],
    ["Last Error", leads.error || "", mta.error || ""]
  ];

}


/**
 * ==========================================================
 * Lock IO Wrappers
 * ==========================================================
 */
function acquirePipelineLock_(type){

  const props = PropertiesService.getScriptProperties();

  const existing = props.getProperty(CONFIG.PROPERTIES.PIPELINE_LOCK);

  const state = computePipelineLockState_(existing, type);

  if(!state.acquired){
    return false;
  }

  props.setProperty(CONFIG.PROPERTIES.PIPELINE_LOCK, type);

  return true;

}


function releasePipelineLock_(){

  PropertiesService
    .getScriptProperties()
    .deleteProperty(CONFIG.PROPERTIES.PIPELINE_LOCK);

}


/**
 * ==========================================================
 * Trigger IO Wrappers
 *
 * WHY
 * 트리거 함수 자신이 실행 시작하자마자 자기 트리거를 지워야 고아 트리거가
 * 누적되지 않음(사용자 확정 설계). 새 트리거 설치는 딜레이 상수를 CONFIG에서
 * 가져와 한 곳에서만 관리.
 * ==========================================================
 */
function deleteTriggersByHandlerName_(handlerName){

  ScriptApp.getProjectTriggers().forEach(function(trigger){

    if(trigger.getHandlerFunction() === handlerName){
      ScriptApp.deleteTrigger(trigger);
    }

  });

}


function schedulePipelineTail_(handlerName){

  ScriptApp.newTrigger(handlerName)
    .timeBased()
    .after(CONFIG.PIPELINE.TRIGGER_DELAY_MS)
    .create();

}


/**
 * ==========================================================
 * Status State IO Wrappers (PropertiesService, JSON)
 * ==========================================================
 */
function readPipelineStatusState_(type){

  const key = (type === CONFIG.PIPELINE.TYPES.MTA)
    ? CONFIG.PROPERTIES.PIPELINE_STATUS_MTA
    : CONFIG.PROPERTIES.PIPELINE_STATUS_LEADS;

  const raw = PropertiesService.getScriptProperties().getProperty(key);

  if(!raw){
    return {};
  }

  try{
    return JSON.parse(raw);
  } catch(e){
    return {};
  }

}


function writePipelineStatusState_(type, state){

  const key = (type === CONFIG.PIPELINE.TYPES.MTA)
    ? CONFIG.PROPERTIES.PIPELINE_STATUS_MTA
    : CONFIG.PROPERTIES.PIPELINE_STATUS_LEADS;

  PropertiesService
    .getScriptProperties()
    .setProperty(key, JSON.stringify(state));

}


/**
 * ==========================================================
 * Write Pipeline Status To README
 *
 * WHY
 * 최초 1회만 README 탭 맨 위(A1)에 8행(그리드 7행 + 구분용 빈 행 1행) 공간을
 * 확보(insertRowsBefore)하고, 이후에는 같은 A1:C7 블록을 덮어쓰기만 해서
 * 기존 README 내용을 건드리지 않음(사용자 확정, 2026-08-04).
 * ==========================================================
 */
function writePipelineStatusToReadme_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheet = ss.getSheetByName(CONFIG.SHEETS.README);

  if(!sheet){
    throw new Error(CONFIG.SHEETS.README + " sheet not found.");
  }

  const leadsState = readPipelineStatusState_(CONFIG.PIPELINE.TYPES.LEADS);
  const mtaState = readPipelineStatusState_(CONFIG.PIPELINE.TYPES.MTA);

  const grid = buildPipelineStatusGrid_(leadsState, mtaState);

  const anchorRow = CONFIG.PIPELINE.STATUS_ANCHOR_ROW;
  const anchorCol = CONFIG.PIPELINE.STATUS_ANCHOR_COL;

  const titleCell = sheet.getRange(anchorRow, anchorCol).getValue();

  if(titleCell !== grid[0][0]){
    sheet.insertRowsBefore(anchorRow, grid.length + 1);
  }

  sheet
    .getRange(anchorRow, anchorCol, grid.length, grid[0].length)
    .setValues(grid);

}


function nowTimestamp_(){

  return Utilities.formatDate(
    new Date(),
    CONFIG.DATE.DISPLAY_TIMEZONE,
    "yyyy-MM-dd HH:mm:ss"
  ) + " KST";

}


/**
 * ==========================================================
 * Advance Pipeline Stage
 *
 * WHY
 * 각 refresh 단계 실행 전에 "Current Stage"를 기록해둬야, 중간에 에러가 나도
 * catch 블록이 "어느 단계에서 실패했는지" 알 수 있음(설계 문서 "실패 지점 기록"
 * 요구사항).
 * ==========================================================
 */
function advancePipelineStage_(type, state, stageName, stageFn){

  state.stage = stageName;

  writePipelineStatusState_(type, state);
  writePipelineStatusToReadme_();

  stageFn();

}


/**
 * ==========================================================
 * Refresh Report FY Dropdowns (ACQ_REP / NewP1_REP)
 *
 * WHY
 * `setupACQDropdowns()`(30_ACQReport.js)/`setupNewP1Dropdowns_()`(40_NewP1Report.js)는
 * 원래 "1회성, 수동 실행"으로 설계돼(Start/End FY 드롭다운 옵션 목록을 그 시점의
 * Leads_OPS/MTA_Master 데이터 기준으로 고정) — 새 FY(예: FY26→FY27, 8월 시작)
 * 데이터가 들어와도 드롭다운 목록엔 자동 반영이 안 됐음. 사용자가 2026-08-04
 * 실사용 중 "FY27이 End FY 드롭다운에도 안 보인다"고 보고, 앞으로는 백그라운드
 * refresh 체인에 자동 연결해달라고 요청 — 매 Leads/MTA 백그라운드 실행마다
 * 드롭다운 옵션 목록을 최신 데이터 기준으로 재계산.
 *
 * 두 setup 함수 모두 데이터 검증 규칙/체크박스만 재적용하고 셀 값은 직접
 * 건드리지 않아(`setDataValidation()`/`insertCheckboxes()`는 기존 선택값을
 * 지우지 않음) 반복 호출이 안전(idempotent) — NewP1_REP는 헤더까지 다시 쓰는
 * `setupNewP1Report()` 대신 드롭다운 전용 내부 헬퍼 `setupNewP1Dropdowns_()`만
 * 직접 호출해 불필요한 헤더 재작성을 피함.
 * ==========================================================
 */
function refreshReportFYDropdowns_(){

  setupACQDropdowns();

  const newP1Sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(CONFIG.NEWP1.SHEET);

  if(!newP1Sheet){
    throw new Error(CONFIG.NEWP1.SHEET + " sheet not found.");
  }

  setupNewP1Dropdowns_(newP1Sheet);

}


/**
 * ==========================================================
 * Refresh Report Generate (ACQ_REP / NewP1_REP)
 *
 * WHY
 * Report Generate는 원래 사용자가 Generate 체크박스를 직접 클릭해야 하는
 * 수동 단계였음 — 사용자가 "이것도 백그라운드 체인에 포함시킬 수 있냐"고
 * 요청(2026-08-04). `generateACQReport_()`/`generateNewP1Report_()`는 onEdit
 * 이벤트 객체(`e`)와 무관하게 동작해 트리거에서 직접 호출 가능.
 *
 * 실패 격리(사용자 확정, 2026-08-04): Control 행 Start FY가 End FY보다 늦으면
 * (`startFY > endFY`) 두 함수 모두 에러를 던짐(30_ACQReport.js/40_NewP1Report.js).
 * OPS/Engine/Target 갱신(핵심 데이터)은 이미 끝난 뒤에 이 단계가 실행되므로,
 * Report Generate 실패가 전체 파이프라인을 FAILED로 만들면 핵심 데이터 갱신까지
 * 다시 6분 걸려 재실행해야 하는 배보다 배꼽이 큰 상황이 됨 — 그래서 이 함수는
 * 각자 독립적으로 try/catch해 실패해도 Logger에만 남기고 던지지 않음(전체 상태는
 * DONE 유지). Report가 하나라도 실패하면 사용자가 Executions 로그에서 확인 후
 * Control 행을 고치고 직접 Generate 체크박스를 눌러야 함.
 * ==========================================================
 */
function refreshReportGenerate_(){

  try{
    generateACQReport_();
  } catch(err){
    Logger.log(
      "refreshReportGenerate_: ACQ_REP Generate 실패(비필수, 파이프라인은 계속) — " +
      (err && err.message ? err.message : err)
    );
  }

  try{
    generateNewP1Report_();
  } catch(err){
    Logger.log(
      "refreshReportGenerate_: NewP1_REP Generate 실패(비필수, 파이프라인은 계속) — " +
      (err && err.message ? err.message : err)
    );
  }

}


/**
 * ==========================================================
 * Run Leads Pipeline Tail
 *
 * 트리거 대상(schedulePipelineTail_("runLeadsPipelineTail")) + 수동 재실행
 * 진입점(디버깅/재시도용, 이름 끝에 "_" 없음 — Apps Script 편집기 Run
 * 드롭다운에 보여야 함, CLAUDE.md 규칙).
 * ==========================================================
 */
function runLeadsPipelineTail(){

  deleteTriggersByHandlerName_("runLeadsPipelineTail");

  const type = CONFIG.PIPELINE.TYPES.LEADS;

  const state = {
    status: "RUNNING",
    stage: "",
    startedAt: nowTimestamp_(),
    finishedAt: "",
    error: ""
  };

  writePipelineStatusState_(type, state);
  writePipelineStatusToReadme_();

  try{

    advancePipelineStage_(
      type, state,
      "runAutoDeleteExactDuplicateLeadRows",
      runAutoDeleteExactDuplicateLeadRows
    );

    advancePipelineStage_(type, state, "buildLeadsOPS", function(){
      buildLeadsOPS(true);
    });

    advancePipelineStage_(type, state, "refreshACQSummary_", refreshACQSummary_);
    advancePipelineStage_(type, state, "refreshNewP1Engine_", refreshNewP1Engine_);
    advancePipelineStage_(type, state, "refreshEventsEngine_", refreshEventsEngine_);
    advancePipelineStage_(type, state, "refreshBOFUEngine_", refreshBOFUEngine_);
    advancePipelineStage_(type, state, "refreshSearchEngine_", refreshSearchEngine_);
    advancePipelineStage_(type, state, "refreshContentEngine_", refreshContentEngine_);
    advancePipelineStage_(type, state, "refreshTargetActuals_", refreshTargetActuals_);
    advancePipelineStage_(type, state, "refreshReportFYDropdowns_", refreshReportFYDropdowns_);
    advancePipelineStage_(type, state, "refreshReportGenerate_", refreshReportGenerate_);

    state.status = "DONE";
    state.stage = "";
    state.finishedAt = nowTimestamp_();
    state.error = "";

    writePipelineStatusState_(type, state);
    writePipelineStatusToReadme_();

    PropertiesService
      .getScriptProperties()
      .deleteProperty(CONFIG.PROPERTIES.PIPELINE_LAST_FAILED_TYPE);

    releasePipelineLock_();

  } catch(err){

    state.status = "FAILED";
    state.finishedAt = nowTimestamp_();
    state.error = String(err && err.message ? err.message : err);

    writePipelineStatusState_(type, state);
    writePipelineStatusToReadme_();

    PropertiesService
      .getScriptProperties()
      .setProperty(CONFIG.PROPERTIES.PIPELINE_LAST_FAILED_TYPE, type);

    releasePipelineLock_();

    throw err;

  }

}


/**
 * ==========================================================
 * Run MTA Pipeline Tail
 *
 * 트리거 대상(schedulePipelineTail_("runMTAPipelineTail")) + 수동 재실행
 * 진입점. syncMTAFunnelToOPS_()가 이미 내부에서 ACQ/NewP1/Events/BOFU/
 * Search/Content Engine + Target Actuals refresh 전체를 실행하므로
 * 여기서는 그 함수 하나만 단계로 감싼다(09_MTAFunnelSync.js 수정 불필요).
 * ==========================================================
 */
function runMTAPipelineTail(){

  deleteTriggersByHandlerName_("runMTAPipelineTail");

  const type = CONFIG.PIPELINE.TYPES.MTA;

  const state = {
    status: "RUNNING",
    stage: "",
    startedAt: nowTimestamp_(),
    finishedAt: "",
    error: ""
  };

  writePipelineStatusState_(type, state);
  writePipelineStatusToReadme_();

  try{

    advancePipelineStage_(
      type, state,
      "runAutoDeleteExactDuplicateTouchRows",
      runAutoDeleteExactDuplicateTouchRows
    );

    advancePipelineStage_(type, state, "syncMTAFunnelToOPS_", syncMTAFunnelToOPS_);
    advancePipelineStage_(type, state, "refreshReportFYDropdowns_", refreshReportFYDropdowns_);
    advancePipelineStage_(type, state, "refreshReportGenerate_", refreshReportGenerate_);

    state.status = "DONE";
    state.stage = "";
    state.finishedAt = nowTimestamp_();
    state.error = "";

    writePipelineStatusState_(type, state);
    writePipelineStatusToReadme_();

    PropertiesService
      .getScriptProperties()
      .deleteProperty(CONFIG.PROPERTIES.PIPELINE_LAST_FAILED_TYPE);

    releasePipelineLock_();

  } catch(err){

    state.status = "FAILED";
    state.finishedAt = nowTimestamp_();
    state.error = String(err && err.message ? err.message : err);

    writePipelineStatusState_(type, state);
    writePipelineStatusToReadme_();

    PropertiesService
      .getScriptProperties()
      .setProperty(CONFIG.PROPERTIES.PIPELINE_LAST_FAILED_TYPE, type);

    releasePipelineLock_();

    throw err;

  }

}


/**
 * ==========================================================
 * Run Retry Pipeline Tail
 *
 * WHY
 * appendNewLeads()/appendNewMTA()는 신규 Raw가 없으면 조기 종료해버려 실패한
 * 파이프라인만 다시 큐잉하는 경로가 없음(설계 문서 확정 사항) — 이 함수가 그
 * 재시도 진입점. 자동 재시도는 하지 않음(사용자 확정), 반드시 수동 실행.
 * ==========================================================
 */
function runRetryPipelineTail(){

  const failedType = PropertiesService
    .getScriptProperties()
    .getProperty(CONFIG.PROPERTIES.PIPELINE_LAST_FAILED_TYPE);

  if(!failedType){
    SpreadsheetApp.getUi().alert("재시도할 실패한 파이프라인이 없습니다.");
    return;
  }

  if(!acquirePipelineLock_(failedType)){
    SpreadsheetApp.getUi().alert(
      "다른 파이프라인이 이미 실행 중입니다. 완료 후 다시 시도하세요."
    );
    return;
  }

  if(failedType === CONFIG.PIPELINE.TYPES.MTA){
    runMTAPipelineTail();
  } else {
    runLeadsPipelineTail();
  }

}


/**
 * ==========================================================
 * Build Readme Guide Rows (순수 함수)
 *
 * WHY
 * README 탭의 Pipeline Status(A1:C7)는 상태판이라 실무자가 "평소에 뭘
 * 눌러야 하는지"는 알 수 없음 — 사용자 요청(2026-08-04)으로 비개발자
 * 실무자용 가이드 섹션을 별도로 추가. Sheet IO와 분리해 Node 하네스로
 * 내용 자체를 테스트 가능하게 함.
 *
 * OUTPUT
 * string[][]  (1열 x N행 — 긴 문장도 한 셀에 그대로 들어가게 함)
 *
 * TEST
 * 제목 행이 정확히 "📘 실무자 가이드 — Import~Report 흐름"이어야 하고,
 * 모든 행이 배열이어야 함(빈 줄도 [""]로 표현).
 * ==========================================================
 */
function buildReadmeGuideRows_(){

  const lines = [
    "📘 실무자 가이드 — Import~Report 흐름",
    "",
    "① 평소 할 일 — 이것만 하면 됩니다",
    "1. 📥 Update 메뉴 → Import Leads 또는 Import MTA (CSV 업로드)",
    "2. 끝입니다 — Master 반영, 완전 중복 정리, Leads_OPS/리포트 갱신까지 몇 분 안에 전부 자동으로 처리됩니다.",
    "",
    "② 지금 어디까지 진행됐는지 보고 싶다면",
    "이 시트 맨 위 \"⚙️ Pipeline Status\" 표에서 Status(RUNNING/DONE/FAILED)와 Current Stage를 확인하세요.",
    "Last Started/Finished는 한국시간(KST) 기준입니다.",
    "",
    "③ ACQ_REP / NewP1_REP에서 다른 기간을 보고 싶다면",
    "Start FY/End FY, Start Month/End Month를 원하는 값으로 바꾸고 Generate 체크박스를 클릭하세요.",
    "(그냥 두면 마지막으로 선택했던 기간 기준으로 자동 갱신됩니다.)",
    "",
    "④ 아직 자동이 아닌 것",
    "🗂️ OPS 메뉴(Sync Events / BOFU / Search / Content)는 여전히 직접 눌러야 합니다.",
    "",
    "⑤ Pipeline Status가 FAILED로 계속 떠 있다면",
    "화면을 캡처해서 담당자에게 문의해주세요."
  ];

  return lines.map(function(line){ return [line]; });

}


/**
 * ==========================================================
 * Setup Readme Guide (수동 실행 — README 탭에 실무자 가이드 섹션 작성/갱신)
 *
 * WHY
 * Pipeline Status 블록과 달리 정확한 위치를 미리 정해두지 않았음 —
 * README 탭에 이미 있는 내용과 절대 겹치지 않도록, 제목 텍스트로 기존
 * 가이드 섹션을 찾아(있으면 그 자리에 덮어쓰기), 없으면 시트 맨 아래에
 * 새로 추가한다(안전한 기본값, 위치 충돌 없음).
 * ==========================================================
 */
function runSetupReadmeGuide(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.README);

  if(!sheet){
    throw new Error(CONFIG.SHEETS.README + " sheet not found.");
  }

  const guideRows = buildReadmeGuideRows_();

  const finder = sheet
    .createTextFinder(guideRows[0][0])
    .matchEntireCell(true);

  const existingMatch = finder.findNext();

  const startRow = existingMatch
    ? existingMatch.getRow()
    : sheet.getLastRow() + 2;

  sheet
    .getRange(startRow, 1, guideRows.length, 1)
    .setValues(guideRows);

  Logger.log(
    "실무자 가이드 " + (existingMatch ? "갱신" : "신규 작성") +
    " — README!" + startRow + "행부터 " + guideRows.length + "행"
  );

}


/**
 * ==========================================================
 * Tests
 * ==========================================================
 */
function testComputePipelineLockState(){

  const empty = computePipelineLockState_("", "LEADS");
  const emptyOk = empty.acquired === true && empty.holderType === null;

  const sameType = computePipelineLockState_("LEADS", "LEADS");
  const sameTypeOk = sameType.acquired === false && sameType.holderType === "LEADS";

  const otherType = computePipelineLockState_("MTA", "LEADS");
  const otherTypeOk = otherType.acquired === false && otherType.holderType === "MTA";

  Logger.log(
    "testComputePipelineLockState: " +
    (emptyOk && sameTypeOk && otherTypeOk ? "PASS" : "FAIL") +
    " (empty=" + JSON.stringify(empty) +
    ", sameType=" + JSON.stringify(sameType) +
    ", otherType=" + JSON.stringify(otherType) + ")"
  );

}


function testBuildPipelineStatusGrid(){

  const grid = buildPipelineStatusGrid_(
    {
      status: "RUNNING",
      stage: "refreshACQSummary_",
      startedAt: "2026-08-04 10:00:00",
      finishedAt: "",
      error: ""
    },
    {
      status: "FAILED",
      stage: "syncMTAFunnelToOPS_",
      startedAt: "2026-08-04 09:00:00",
      finishedAt: "2026-08-04 09:05:00",
      error: "Boom"
    }
  );

  const ok =
    grid.length === 7 &&
    grid[0][0] === "⚙️ Pipeline Status" &&
    grid[1][1] === "New Leads Upload" && grid[1][2] === "MTA Upload" &&
    grid[2][1] === "RUNNING" && grid[2][2] === "FAILED" &&
    grid[3][1] === "refreshACQSummary_" && grid[3][2] === "syncMTAFunnelToOPS_" &&
    grid[6][1] === "" && grid[6][2] === "Boom";

  Logger.log(
    "testBuildPipelineStatusGrid: " + (ok ? "PASS" : "FAIL") +
    " grid=" + JSON.stringify(grid)
  );

  const emptyGrid = buildPipelineStatusGrid_({}, {});
  const emptyOk = emptyGrid[2][1] === "IDLE" && emptyGrid[2][2] === "IDLE";

  Logger.log(
    "testBuildPipelineStatusGrid (empty defaults): " +
    (emptyOk ? "PASS" : "FAIL")
  );

}


function testBuildReadmeGuideRows(){

  const rows = buildReadmeGuideRows_();

  const ok =
    Array.isArray(rows) &&
    rows.length > 0 &&
    rows.every(function(row){ return Array.isArray(row) && row.length === 1; }) &&
    rows[0][0] === "📘 실무자 가이드 — Import~Report 흐름";

  Logger.log(
    "testBuildReadmeGuideRows: " + (ok ? "PASS" : "FAIL") +
    " rowCount=" + rows.length
  );

}
