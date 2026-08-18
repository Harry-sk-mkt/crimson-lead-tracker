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
 * v1.15.0
 *
 * Change Log
 * v1.15.0 (2026-08-19)
 * - **버그 수정 — 플랫폼 강제종료/내부 오류 시 README Pipeline Status에
 *   "RUNNING"이 영구 잔존**(실측: BOFU_OPS Timed Out에 이어 이번엔
 *   Leads_OPS Build 중 "Error code INTERNAL"로 동일 증상 재발). 신규 순수
 *   함수 `computeSelfHealedPipelineState_(state, nowMs)` — RUNNING 상태가
 *   `CONFIG.PIPELINE.LOCK_STALE_THRESHOLD_MS`(30분)보다 오래됐으면 FAILED로
 *   자동 전환(락 self-heal, v1.7.0과 동일 원칙을 상태 표시에도 적용).
 *   `runLeadsPipelineTail()`/`runMTAPipelineTail()`의 초기 state에
 *   `startedAtMs`(raw timestamp) 신규 추가 — 기존 `startedAt`(포맷된 문자열)은
 *   경과시간 계산에 못 씀. `readPipelineStatusState_()`가 읽을 때마다 이
 *   판정을 적용해 죽은 RUNNING을 그 자리에서 FAILED로 되돌려쓰고
 *   `PIPELINE_LAST_FAILED_TYPE`도 같이 세팅(이후 `runRetryPipelineTail()`가
 *   바로 동작 가능해짐). `runRetryPipelineTail()` 시작부에
 *   `readPipelineStatusState_()` 두 타입 다 미리 호출해 self-heal을
 *   트리거하도록 추가(안 하면 죽은 RUNNING이 있어도 "재시도할 게 없다"고
 *   잘못 알림). `testComputeSelfHealedPipelineState()` 신규.
 *   **같은 날 실측 수정**: 배포 직후 실제로 죽어있던 RUNNING(2026-08-18
 *   09:19 KST, `startedAtMs` 필드 도입 *이전*에 저장된 옛 형식)이
 *   `runRetryPipelineTail()`에서 "재시도할 게 없다"로 잘못 판정되는 걸 확인 —
 *   최초 구현이 `startedAtMs` 없는 RUNNING을 "나이를 모르니 안전하게 그냥
 *   둔다"로 처리했던 게 원인. `computePipelineLockState_()`의 파싱 불가한
 *   옛 형식 락 값 처리(안전하게 죽은 락으로 간주)와 동일 원칙으로 통일 —
 *   `startedAtMs`가 없는 RUNNING도 즉시 죽은 것으로 간주하도록 수정.
 *   `testComputeSelfHealedPipelineState()`의 해당 케이스 기대값도 함께 수정.
 * v1.14.1 (2026-08-09)
 * - 파일명 변경(신규 네이밍 컨벤션 적용) — 기존 `08_PipelineAsync.js` → 신규 `MASTER_002_PipelineAsync.js`, 코드 내용 변경 없음.
 * v1.14.0 (2026-08-06)
 * - **Pipeline Status 셀 색상 추가**(사용자 요청 — "running이면 빨갛게, done이면
 *   초록색으로 bold처리까지 하자"). 신규 순수 함수 `computePipelineStatusGridStyles_(grid)`
 *   가 `buildPipelineStatusGrid_()` 출력을 받아 배경/글자색/굵기 병렬 2D 배열을
 *   계산(헤더 행·라벨 열 제외, 값이 "RUNNING"/"DONE"으로 시작하면 각각 빨강
 *   (#F4CCCC bg·#CC0000 font)/초록(#D9EAD3 bg·#38761D font) + bold, 그 외(FAILED/
 *   IDLE/빈 문자열)는 명시적으로 null/normal — 이전 상태의 색이 안 남게 리셋).
 *   `writePipelineStatusToReadme_()`가 `setValues()` 직후 `setBackgrounds()`/
 *   `setFontColors()`/`setFontWeights()`로 매번 같이 적용 — 별도 조건부 서식
 *   규칙 없이 값 갱신 때마다 색도 항상 최신 유지. FAILED는 이번 요청 범위 밖이라
 *   미채색으로 남겨둠(사용자 확인 필요 시 별도 색상 추가 예정, 임의로 처리하지
 *   않음). `testComputePipelineStatusGridStyles()` 신규.
 * v1.13.0 (2026-08-06)
 * - **Pipeline Status 컬럼(Master Update~Target_REP)에 RUNNING/FAILED 표시
 *   추가**(사용자 요청 — "이 칸들에는 running인지 done인지 fail인지만 알려주면
 *   좋겠어"). 지금까지는 `state.stages[key]`가 boolean(`true`/없음)이라 그
 *   단계가 통째로 끝나기 전까지는 빈 칸이었고, `refreshOPSSheets_()`/
 *   `refreshReportGenerate_()`의 하위 단계가 실패해도(격리된 try/catch라
 *   Logger에만 남고 조용히 삼켜짐) 해당 컬럼이 "아직 시작 전"과 똑같이 영원히
 *   빈 칸으로 남아 실패 여부를 README에서 알 수 없었음. `state.stages[key]`를
 *   `"RUNNING"|"DONE"|"FAILED"` 문자열로 확장 — `advancePipelineStage_()`는
 *   `stageFn()` 호출 전에 RUNNING, 성공하면 DONE, 던지면 FAILED(그대로
 *   rethrow) 기록. 신규 `setPipelineStageStatus_(type, state, key, status)`가
 *   단일 컬럼 상태를 즉시 README에 반영하는 공용 헬퍼 — `refreshOPSSheets_()`/
 *   `refreshReportGenerate_()`의 하위 단계 4~3개 전부 호출 직전 RUNNING, catch에서
 *   FAILED로 마킹하도록 배선. `markPipelineStageComplete_(type, state, key)`는
 *   기존 호출부 호환을 위해 `setPipelineStageStatus_(..., "DONE")` 얇은 래퍼로
 *   유지(시그니처 변경 없음). `buildPipelineStatusGrid_()`의 `buildRow()`는
 *   `stages[col.KEY] ? "Complete" : ""` 대신 `stages[col.KEY] || ""`로 단순화
 *   (저장된 문자열을 그대로 노출). `testBuildPipelineStatusGrid()` 새 포맷에
 *   맞게 갱신.
 * v1.12.1 (2026-08-06)
 * - **버그 수정 — schedulePipelineTail_() 중복 예약으로 인한 "유령 실행"**:
 *   같은 handlerName으로 짧은 시간 내 여러 번 호출되면(예: Generate
 *   체크박스 빠른 반복 클릭) 트리거가 계속 쌓이다가 몇 분 뒤 뜬금없이
 *   재실행되는 문제 실측(사용자 발견 — ACQ_REP Generate 반복 테스트 중
 *   클릭 안 했는데 2분 뒤 재실행됨). 새 트리거 생성 전에
 *   deleteTriggersByHandlerName_()로 기존 트리거를 먼저 지우도록 수정 —
 *   짧은 시간 내 반복 호출은 마지막 1건만 예약됨(디바운스 효과).
 *   runLeadsPipelineTail()/runMTAPipelineTail() 예약도 이 함수를 공유하므로
 *   동일하게 안전해짐.
 * v1.12.0 (2026-08-06)
 * - 신규 `rebuildDealTrackerEngine_()`(90_TargetEngine.js) 배선 — 두
 *   파이프라인 테일 모두에 추가. DealTracker_Engine(내부 캐시) 전체
 *   재구축을 백그라운드에서 주기적으로 수행해, ACQ_REP/NewP1_REP Generate
 *   시점의 증분 동기화(appendNewDealTrackerRows_())로는 못 잡는 기존 행
 *   수정/재분류까지 반영(사용자 요청 — "딜 트랙커를 직접 불러오지말고
 *   엔진을 하나 만들자"). `runLeadsPipelineTail()`엔 `buildLeadsOPS` 다음
 *   (`refreshACQSummary_`가 이 캐시를 읽으므로 그 전에 배치), `runMTAPipelineTail()`
 *   엔 `refreshCampaignSpend_` 다음(`syncMTAFunnelToOPS_`가 내부적으로
 *   `refreshACQSummary_` 등을 호출하므로 그 전에 배치)에 추가.
 * v1.11.0 (2026-08-05)
 * - 신규 `refreshNaverSearchCampaignStats_()` — `refreshNaverSearchAdCampaignStatsCache_()`
 *   (AD_003_NaverSearch.js, Search_OPS Campaign/Impressions/Link clicks 자동화용
 *   누적 캐시)를 두 파이프라인 테일 모두 `refreshOPSSheets_` 바로 앞에 배선
 *   (사용자 요청 — "search ops Campaign Impressions Reach Link clicks 영역
 *   불러오도록하자"). `refreshCampaignSpend_()`와 동일하게 실패 비필수 처리.
 * v1.10.0 (2026-08-05)
 * - **Pipeline Status 표 레이아웃 전환**(사용자 요청) — "단계=행/New Leads·MTA=컬럼"
 *   (7행×3열)에서 "단계=컬럼/New Leads·MTA=행"(3행×12열)으로 변경. 컬럼:
 *   Pipeline Status(행 라벨) / Status(전체 진행상태+마지막 시각 압축 표시,
 *   `buildPipelineStatusCell_()` 신규) / Master Update / Leads_OPS / Events_OPS /
 *   BOFU_OPS / Search_OPS / Content_OPS / Campaign Spend / ACQ_REP / NewP1_REP /
 *   Target_REP(`CONFIG.PIPELINE.STATUS_COLUMNS`, 00_Config.js 신규). 각 영역
 *   컬럼은 완료되면 "Complete", 아니면 빈 문자열(사용자 확정).
 * - `advancePipelineStage_()`에 선택적 `completedKeys` 파라미터 추가 — 한
 *   함수가 통째로 끝나야 컬럼 하나가 완료되는 단일 단계(`masterUpdate`/
 *   `campaignSpend`)용. 여러 컬럼이 한 함수 안에서 개별 시점에 끝나는
 *   `refreshOPSSheets_()`/`refreshReportGenerate_()`는 `(type, state)`를 직접
 *   받아 신규 `markPipelineStageComplete_()`로 하위 단계마다 스스로 완료
 *   표시하도록 시그니처 변경.
 * - **MTA 행 leadsOps 컬럼은 의도적으로 뭉뚱그림(사용자 확정)**: `syncMTAFunnelToOPS_()`
 *   (09_MTAFunnelSync.js)가 Leads_OPS 동기화+6개 Engine 캐시 refresh를 한
 *   함수 안에서 처리하는데, 컬럼별로 쪼개려면 그 파일을 리팩토링해야 해서
 *   이번 범위에서는 보류 — 전체가 끝나는 순간 `leadsOps` 컬럼 하나만 한번에
 *   Complete로 표시(09_MTAFunnelSync.js는 수정하지 않음). Events_OPS~Content_OPS는
 *   이후 `refreshOPSSheets_()` 단계(08_PipelineAsync.js 자체 소유)에서 개별 추적.
 * - `writePipelineStatusToReadme_()` — 옛 레이아웃("⚙️ Pipeline Status" 타이틀,
 *   7행) 감지 시 그 7행을 먼저 삭제한 뒤 새 블록 공간을 확보하는 1회성
 *   마이그레이션 로직 추가(안 하면 옛 4~7행이 고아 행으로 남음).
 * - README 실무자 가이드 ② 문구 갱신(Current Stage 행 삭제로 안 맞게 된 설명 수정).
 * - `testBuildPipelineStatusGrid()` 새 그리드 형태에 맞게 재작성.
 * v1.9.0 (2026-08-05)
 * - `refreshReportGenerate_()`에 `generateTargetReport_()`(91_TargetReport.js,
 *   Deal Tracker 기반 Target_Engine Block A~D 재계산 + Target_REP 재작성) 추가
 *   (사용자 요청 — "캠페인 지출이랑 deal tracker도 import 체인에 포함시키자").
 *   기존 "Simple Trigger라 openById() 못 씀" 제약은 이 설치형 트리거엔 해당 없음
 *   (52/62/72/82_*_Build.js 자동화 때와 동일 논리). 캠페인 지출(Ad_Spend_Cache)은
 *   이미 v1.6.0(2026-08-04)부터 `refreshCampaignSpend_()`로 두 파이프라인 테일
 *   모두에 연결돼 있어 추가 조치 없음. README 실무자 가이드 ④ 문구도 갱신
 *   (남은 수동 단계 없음).
 * v1.8.0 (2026-08-05)
 * - 신규 `refreshOPSSheets_()` — `buildEventsOPS()`/`buildBOFUOPS()`/
 *   `buildSearchOPS()`/`buildContentOPS()`(각 52/62/72/82_*_Build.js, 2026-07-24
 *   "초기 이관 기간 수동 실행" 결정으로 자동화에서 빠져있었음)를 백그라운드
 *   체인에 편입(사용자 요청 — "Events·BOFU·Search·Content OPS도 한 번에
 *   갱신하도록 하자"). 4개 함수 모두 실패를 서로 격리해 하나가 실패해도
 *   나머지는 계속 진행(`refreshReportGenerate_()`와 동일 원칙 — 이미 끝난
 *   Engine 캐시 refresh를 되돌릴 필요 없는 파생 레이어). `runLeadsPipelineTail()`엔
 *   `refreshContentEngine_` 다음(4개 Engine 캐시가 방금 갱신된 직후)에,
 *   `runMTAPipelineTail()`엔 `syncMTAFunnelToOPS_`(내부에서 동일 4개 Engine을
 *   갱신) 다음에 배치. README 실무자 가이드 ④ 문구도 갱신(OPS Sync는 더 이상
 *   수동이 아님 — 남은 수동 항목은 Target_REP Generate로 교체).
 * v1.7.0 (2026-08-05)
 * - **버그 수정 — 죽은 락이 영구히 안 풀리는 문제(실측, 재발 방지 조치)**.
 *   `docs/OpenItems.md` #20(ACQ_REP New P1 불일치) 조사 중, Leads_Master에 7월
 *   한 달만 중복 659건이 쌓여있었던 배경 원인으로 다음 시나리오를 확인: 중복이
 *   누적될수록 `runAutoDeleteExactDuplicateLeadRows()`(옛 `deleteRow()` 반복
 *   버전, `24_OPSQA.js` v1.6.0에서 배치 방식으로 수정됨)의 실행 시간이 계속
 *   늘어나다가 결국 Apps Script 플랫폼이 실행을 강제 종료 — `runLeadsPipelineTail()`
 *   최상위 try/catch는 JS 예외만 잡을 수 있어 플랫폼 강제종료 시 catch 블록
 *   자체가 실행 안 되고, `releasePipelineLock_()`도 호출 안 돼 `PIPELINE_LOCK`이
 *   영구히 남아 그 이후 모든 Import의 백그라운드 처리(중복 정리+Leads_OPS
 *   재빌드+캐시 갱신 전부 포함)가 "이미 진행 중" 판정으로 계속 스킵되는 구조적
 *   문제를 발견 — 이게 중복이 몇 주간 자체 복구 없이 계속 쌓인 진짜 배경 원인.
 *   **수정**: 락 값을 단순 문자열("LEADS"/"MTA")에서 `{type, acquiredAt}` JSON으로
 *   변경, `computePipelineLockState_()`에 `nowMs` 매개변수 추가 —
 *   `CONFIG.PIPELINE.LOCK_STALE_THRESHOLD_MS`(30분, `00_Config.js` 신규)보다
 *   오래된 락은 죽은 락으로 간주해 자동으로 새 락 획득을 허용(self-heal, 수동
 *   개입 불필요). 파싱 불가한 옛 형식 값도 안전하게 죽은 락으로 처리(이 배포
 *   시점에 이미 존재할 수 있는 락도 즉시 자동 복구됨). `acquirePipelineLock_()`가
 *   새 JSON 형식으로 저장하도록 함께 수정. `testComputePipelineLockState()`에
 *   fresh/stale/legacy-format 케이스 추가.
 * v1.6.0 (2026-08-04)
 * - 신규 `refreshCampaignSpend_()` — `refreshAdSpendCache_()`(AD_004_SpendCache.js,
 *   Meta+Naver Search+Kakao Channel 합산 캐시)를 배경 파이프라인 체인에 편입(사용자
 *   요청 — "API뿐만 아니라 캠페인 스펜딩 전체를 자동으로 호출하자", Naver Search
 *   730일 조회 제약 버그 수정 직후). `refreshReportGenerate_()`와 동일하게 실패를
 *   Logger에만 남기고 던지지 않음(비필수 — Ad Spend는 Leads_OPS/MTA_Master 핵심
 *   데이터와 무관한 보조 지표). `refreshTargetActuals_()`(ACQ_REP/NewP1_REP/
 *   Target_REP의 Spent/CPNP1이 이 캐시를 읽음, 2026-08-04 자동 집계 전환)보다
 *   먼저 실행되도록 `runLeadsPipelineTail()`에 추가, `runMTAPipelineTail()`은
 *   `syncMTAFunnelToOPS_()`(내부에서 `refreshTargetActuals_()`를 호출) 앞에 추가.
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
 * WHY (2026-08-05, 죽은 락 자동 해제 추가 — 실측 계기)
 * Leads/MTA 백그라운드 체인이 겹쳐 실행되면 안 되므로(사용자 확정 — 단순 락,
 * 자동 대기열 없음, 겹치면 두 번째 시도를 거부) 락 획득 가능 여부를 순수
 * 로직으로 분리 — PropertiesService IO 없이 테스트 가능하게 함.
 *
 * **락에 타임스탬프 추가**: 락 값이 바뀌어 이제 `{type, acquiredAt}` JSON 문자열
 * (기존엔 "LEADS"/"MTA" 단순 문자열). `runLeadsPipelineTail()`의 최상위 try/catch는
 * JS 예외만 잡을 수 있어, Apps Script 플랫폼이 장시간 실행을 강제 종료하는 경우
 * (실측: `runAutoDeleteExactDuplicateLeadRows()`의 옛 느린 삭제 루프가 대량 중복
 * 누적 시 실행을 저절로 중단시킴)엔 catch 블록 자체가 실행 안 돼
 * `releasePipelineLock_()`가 절대 호출되지 않고 락이 영구히 남는 문제를 실측 확인
 * (`docs/OpenItems.md` 참고). `LOCK_STALE_THRESHOLD_MS`(30분, 이 계정의 실행시간
 * 상한 추정치)보다 오래된 락은 죽은 락으로 간주해 자동으로 새 락 획득을 허용
 * (self-heal) — 수동 개입 없이 다음 Import가 다시 정상적으로 백그라운드 처리를
 * 시작할 수 있게 함. 기존 형식(단순 문자열, 이 수정 이전에 저장된 값) 등 JSON
 * 파싱 실패 값도 죽은 락으로 간주(안전한 기본값 — 미확인 나이보다 자동 해제가
 * 락을 영구 방치하는 것보다 안전).
 *
 * INPUT
 * existingLockRaw : string  (PropertiesService에 저장된 현재 락 값, 없으면 "")
 * requestedType    : string ("LEADS" | "MTA")
 * nowMs            : number  (Date.now(), 테스트 가능하도록 주입)
 *
 * OUTPUT
 * { acquired: boolean, holderType: string|null }
 * - 락이 비어있거나, 파싱 불가하거나, 오래된(stale) 락이면 acquired:true
 * - 그 외(살아있는 락)엔 acquired:false, holderType은 락 보유 타입
 *
 * TEST
 * testComputePipelineLockState() 참고
 * ==========================================================
 */
function computePipelineLockState_(existingLockRaw, requestedType, nowMs){

  if(!existingLockRaw){
    return { acquired: true, holderType: null };
  }

  let parsed;

  try{
    parsed = JSON.parse(existingLockRaw);
  } catch(e){
    return { acquired: true, holderType: null };  // 파싱 불가 = 죽은 락으로 간주
  }

  if(!parsed || !parsed.type || typeof parsed.acquiredAt !== "number"){
    return { acquired: true, holderType: null };
  }

  const age = nowMs - parsed.acquiredAt;

  if(age > CONFIG.PIPELINE.LOCK_STALE_THRESHOLD_MS){
    return { acquired: true, holderType: null };  // 죽은 락 — 자동 해제
  }

  return { acquired: false, holderType: parsed.type };

}


/**
 * ==========================================================
 * Build Pipeline Status Cell (Status 컬럼 압축 표시)
 *
 * WHY
 * 행이 New Leads/MTA Leads 2개뿐이라(2026-08-05 레이아웃 전환, 사용자 요청)
 * 예전처럼 Last Started/Last Finished/Last Error를 별도 행으로 둘 공간이
 * 없음 — 사용자 확정: Status 셀 하나에 상태+마지막 시각(+에러)을 압축 표시.
 * ==========================================================
 */
function buildPipelineStatusCell_(state){

  const status = state.status || "IDLE";

  if(status === "RUNNING"){
    return "RUNNING · started " + (state.startedAt || "");
  }

  if(status === "FAILED"){
    return "FAILED · " + (state.finishedAt || "") +
      (state.error ? " · " + state.error : "");
  }

  if(status === "DONE"){
    return "DONE · " + (state.finishedAt || "");
  }

  return "IDLE";

}


/**
 * ==========================================================
 * Build Pipeline Status Grid
 *
 * WHY
 * README!A1: Pipeline Status 블록에 쓸 2D 배열을 만드는 로직을 Sheet IO와
 * 분리해 Node 하네스로 테스트 가능하게 함. **2026-08-05 레이아웃 전환**(사용자
 * 요청) — 예전엔 "단계=행 / New Leads·MTA=컬럼"(7행×3열)이었는데, "단계=컬럼
 * / New Leads·MTA=행"(3행×N열, N=2+`CONFIG.PIPELINE.STATUS_COLUMNS.length`)으로
 * 전환. 각 실무 영역(Master Update~Target_REP) 컬럼은 그 영역이 이번 실행에서
 * 끝났으면 "Complete", 아직이면 빈 문자열 — 사용자 확정("완료되면 Complete로").
 *
 * INPUT
 * leadsState / mtaState : { status, stage, startedAt, finishedAt, error, stages }
 *   stages : { [CONFIG.PIPELINE.STATUS_COLUMNS[i].KEY]: "RUNNING"|"DONE"|"FAILED" }
 *   (진입한 적 없는 키는 아예 없음 — 그 컬럼은 빈 문자열로 렌더링됨)
 *   각 필드 미제공 시 status는 "IDLE", stages는 {}로 간주(전 컬럼 빈 문자열).
 *
 * OUTPUT
 * string[3][2 + N]  (A열부터, 1~3행 그대로 — 헤더 1행 + New Leads/MTA Leads 2행)
 *
 * TEST
 * buildPipelineStatusGrid_() 참고 — RUNNING/FAILED/DONE 조합을 넣으면 Status
 * 셀과 각 단계 컬럼(그 상태 문자열 그대로, 진입 전이면 "")에 반영되어야 하고,
 * 빈 객체({})를 넣으면 Status가 "IDLE"이고 모든 단계 컬럼이 빈 문자열이어야 함.
 * ==========================================================
 */
function buildPipelineStatusGrid_(leadsState, mtaState){

  const leads = leadsState || {};
  const mta = mtaState || {};

  const columns = CONFIG.PIPELINE.STATUS_COLUMNS;

  const headerRow = ["Pipeline Status", "Status"].concat(
    columns.map(function(col){ return col.HEADER; })
  );

  function buildRow(rowLabel, state){

    const stages = state.stages || {};

    const stageCells = columns.map(function(col){
      return stages[col.KEY] || "";
    });

    return [rowLabel, buildPipelineStatusCell_(state)].concat(stageCells);

  }

  return [
    headerRow,
    buildRow("New Leads", leads),
    buildRow("MTA Leads", mta)
  ];

}


/**
 * ==========================================================
 * Compute Pipeline Status Grid Styles
 *
 * WHY
 * 사용자 요청(2026-08-06) — Status 셀이 RUNNING이면 빨갛게, DONE이면
 * 초록색으로 bold 처리해 한눈에 진행 상태가 보이도록. `buildPipelineStatusGrid_()`
 * 출력(문자열 그리드)을 그대로 입력받아 배경/글자색/굵기 3개의 병렬 2D
 * 배열을 만드는 순수 함수로 분리(Sheet IO와 분리해 Node 하네스로 테스트
 * 가능하게 하는 기존 패턴, `buildPipelineStatusGrid_()`와 동일 원칙).
 *
 * 대상 셀: 헤더 행(0행)과 라벨 열(0열, "New Leads"/"MTA Leads")은 제외하고
 * 나머지 전부 — Status 열(1열, "RUNNING · started ..." / "DONE · ..." 같은
 * 압축 표시)과 단계 컬럼(2열~, "RUNNING"/"DONE"/"FAILED"/"") 둘 다 값이
 * "RUNNING"/"DONE"으로 *시작*하면 칠해짐(startsWith 판정 — Status 열의
 * 타임스탬프 접미사와 무관하게 매치).
 *
 * FAILED/IDLE/빈 문자열은 의도적으로 미채색(사용자가 RUNNING/DONE 2가지만
 * 요청) — 배경/글자색 null로 리셋해 이전 RUNNING/DONE 상태에서 넘어왔을 때
 * 잔여 색이 남지 않도록 함.
 *
 * INPUT
 * grid : string[][]  (buildPipelineStatusGrid_() 출력)
 *
 * OUTPUT
 * { backgrounds: string[][], fontColors: string[][], fontWeights: string[][] }
 *   grid와 동일한 shape — Range.setBackgrounds()/setFontColors()/setFontWeights()에
 *   그대로 전달 가능.
 *
 * TEST
 * testComputePipelineStatusGridStyles() 참고.
 * ==========================================================
 */
function computePipelineStatusGridStyles_(grid){

  const RUNNING_BG = "#F4CCCC";
  const RUNNING_FONT = "#CC0000";
  const DONE_BG = "#D9EAD3";
  const DONE_FONT = "#38761D";

  const backgrounds = [];
  const fontColors = [];
  const fontWeights = [];

  grid.forEach(function(row, r){

    const bgRow = [];
    const colorRow = [];
    const weightRow = [];

    row.forEach(function(cell, c){

      const isHeaderOrLabel = (r === 0 || c === 0);
      const value = String(cell || "");

      if(!isHeaderOrLabel && value.indexOf("RUNNING") === 0){
        bgRow.push(RUNNING_BG);
        colorRow.push(RUNNING_FONT);
        weightRow.push("bold");
      } else if(!isHeaderOrLabel && value.indexOf("DONE") === 0){
        bgRow.push(DONE_BG);
        colorRow.push(DONE_FONT);
        weightRow.push("bold");
      } else {
        bgRow.push(null);
        colorRow.push(null);
        weightRow.push("normal");
      }

    });

    backgrounds.push(bgRow);
    fontColors.push(colorRow);
    fontWeights.push(weightRow);

  });

  return {
    backgrounds: backgrounds,
    fontColors: fontColors,
    fontWeights: fontWeights
  };

}


/**
 * ==========================================================
 * Lock IO Wrappers
 * ==========================================================
 */
function acquirePipelineLock_(type){

  const props = PropertiesService.getScriptProperties();

  const existing = props.getProperty(CONFIG.PROPERTIES.PIPELINE_LOCK);

  const state = computePipelineLockState_(existing, type, Date.now());

  if(!state.acquired){
    return false;
  }

  props.setProperty(
    CONFIG.PROPERTIES.PIPELINE_LOCK,
    JSON.stringify({ type: type, acquiredAt: Date.now() })
  );

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


/**
 * ==========================================================
 * Schedule Pipeline Tail (설치형 1회성 트리거 예약)
 *
 * WHY (2026-08-06 버그 수정 — 중복 예약으로 인한 "유령 실행")
 * 예전엔 새 트리거를 조건 없이 그냥 create()만 해서, 같은 handlerName으로
 * 짧은 시간 안에 여러 번 호출되면(예: Generate 체크박스를 빠르게 여러 번
 * 클릭) 트리거가 쌓였음. 각 트리거는 실행될 때 자기 자신을
 * deleteTriggersByHandlerName_()로 지우지만, 그 시점에 아직 생성되지 않은
 * (나중 호출이 만든) 트리거는 못 잡아서 큐에 남았다가 Apps Script 부하로
 * 지연되며 몇 분 뒤 뜬금없이 재실행되는 문제가 실측됨(ACQ_REP Generate
 * 반복 클릭 테스트 중 사용자 발견 — Duration/Cloud Logs 확인 결과 정상
 * 실행이었으나 예상치 못한 시점에 재발동). 새 트리거를 만들기 전에 같은
 * handlerName의 기존 트리거를 먼저 지워서, 짧은 시간 내 반복 호출은
 * "가장 마지막 호출 1건만 예약"되도록 함(디바운스와 동일한 효과).
 * ==========================================================
 */
function schedulePipelineTail_(handlerName){

  deleteTriggersByHandlerName_(handlerName);

  ScriptApp.newTrigger(handlerName)
    .timeBased()
    .after(CONFIG.PIPELINE.TRIGGER_DELAY_MS)
    .create();

}


/**
 * ==========================================================
 * Compute Self-Healed Pipeline Status State
 *
 * WHY (2026-08-19, 실측 계기 — BOFU_OPS Timed Out에 이어 Leads_OPS Build
 * 중 "Error code INTERNAL" 재발)
 * 플랫폼 강제종료(실행시간 초과)나 이번처럼 JS 엔진 내부 오류(Error code
 * INTERNAL)로 실행이 죽으면 try/catch 자체가 실행되지 않아 state.status가
 * "RUNNING"으로 영구히 남는다 — computePipelineLockState_()가 이미
 * LOCK_STALE_THRESHOLD_MS(30분)로 락을 self-heal하는 것과 동일한 원리를
 * 상태 표시(README Pipeline Status)에도 적용: RUNNING이 이 임계값보다
 * 오래됐으면 "플랫폼이 이미 죽였다"고 간주해 FAILED로 자동 전환한다.
 *
 * **`startedAtMs` 없는 RUNNING(이 필드 도입 전 저장된 옛 스키마) 처리
 * (2026-08-19 실측 수정)**: 최초 구현은 "나이를 모르니 안전하게 그냥 둔다"
 * 였으나, 실제로 이 필드 도입 *직전*에 죽은 RUNNING(2026-08-18 09:19 KST,
 * Leads_OPS Build 중 "Error code INTERNAL")이 실측으로 나왔을 때 이 방어
 * 로직 때문에 `runRetryPipelineTail()`가 "재시도할 게 없다"고 잘못 판정하는
 * 걸 확인 — `computePipelineLockState_()`가 파싱 불가한 옛 형식 락 값을
 * "안전하게 죽은 락으로 간주"하는 것과 동일 원칙으로 통일: `startedAtMs`가
 * 없는 RUNNING도 옛 스키마 잔재로 보고 즉시 죽은 것으로 간주한다(나이를
 * 특정할 순 없지만, 새 코드가 실행되는 시점엔 이미 이 필드가 항상 채워져야
 * 하므로 없다는 것 자체가 "이 실행이 새 코드 배포 전에 시작돼 끝까지 못
 * 갔다"는 신호).
 *
 * INPUT
 * state : Object  (readPipelineStatusState_() 원본 — status/startedAtMs 등)
 * nowMs : number   (Date.now(), 테스트 가능하도록 주입)
 *
 * OUTPUT
 * Object  — 죽은 RUNNING이면 새 state(status:"FAILED", error 채움), 아니면
 *   입력을 그대로 반환(참조 동일 — 호출부가 "바뀌었는지"를 참조 비교로 판단
 *   가능, readPipelineStatusState_() 참고).
 *
 * TEST
 * testComputeSelfHealedPipelineState() 참고
 * ==========================================================
 */
function computeSelfHealedPipelineState_(state, nowMs){

  if(!state || state.status !== "RUNNING"){
    return state;
  }

  const FAILED_ERROR_MESSAGE_SUFFIX = "자동 감지)";

  if(typeof state.startedAtMs !== "number"){

    return Object.assign({}, state, {
      status: "FAILED",
      finishedAt: nowTimestamp_(),
      error: "추정: 플랫폼 강제종료 또는 내부 오류로 실행 중단(startedAtMs 없는 옛 형식 RUNNING, " +
        FAILED_ERROR_MESSAGE_SUFFIX
    });

  }

  const age = nowMs - state.startedAtMs;

  if(age <= CONFIG.PIPELINE.LOCK_STALE_THRESHOLD_MS){
    return state;
  }

  return Object.assign({}, state, {
    status: "FAILED",
    finishedAt: nowTimestamp_(),
    error: "추정: 플랫폼 강제종료 또는 내부 오류로 실행 중단(RUNNING 상태가 " +
      CONFIG.PIPELINE.LOCK_STALE_THRESHOLD_MS / 60000 + "분 이상 지속됨, " +
      FAILED_ERROR_MESSAGE_SUFFIX
  });

}


/**
 * ==========================================================
 * TEST — computeSelfHealedPipelineState_()
 * ==========================================================
 */
function testComputeSelfHealedPipelineState(){

  const now = 1000000000000;

  const fresh = computeSelfHealedPipelineState_(
    { status: "RUNNING", startedAtMs: now - 1000 }, now
  );
  const freshOk = fresh.status === "RUNNING"; // 안 바뀜(참조도 동일)

  const stale = computeSelfHealedPipelineState_(
    { status: "RUNNING", startedAtMs: now - CONFIG.PIPELINE.LOCK_STALE_THRESHOLD_MS - 1 }, now
  );
  const staleOk = stale.status === "FAILED" && !!stale.error && !!stale.finishedAt;

  const doneUnaffected = computeSelfHealedPipelineState_(
    { status: "DONE", startedAtMs: now - CONFIG.PIPELINE.LOCK_STALE_THRESHOLD_MS - 1 }, now
  );
  const doneOk = doneUnaffected.status === "DONE";

  const noStartedAtMs = computeSelfHealedPipelineState_({ status: "RUNNING" }, now);
  const noStartedAtMsOk = noStartedAtMs.status === "FAILED" && !!noStartedAtMs.error; // 옛 형식(필드 없음) — 즉시 죽은 것으로 간주(락의 legacy-format 처리와 동일 원칙)

  const emptyOk = computeSelfHealedPipelineState_({}, now).status === undefined;

  const pass = freshOk && staleOk && doneOk && noStartedAtMsOk && emptyOk;

  Logger.log(
    "testComputeSelfHealedPipelineState: " + (pass ? "PASS" : "FAIL") +
    " stale=" + JSON.stringify(stale)
  );

}


/**
 * ==========================================================
 * Status State IO Wrappers (PropertiesService, JSON)
 *
 * WHY (readPipelineStatusState_() self-heal, 2026-08-19)
 * 죽은 RUNNING을 감지하면(computeSelfHealedPipelineState_()) 그 자리에서
 * FAILED로 되돌려쓰고 PIPELINE_LAST_FAILED_TYPE도 같이 세팅한다 —
 * 이 함수를 부르는 모든 지점(writePipelineStatusToReadme_(), 아래
 * runRetryPipelineTail() 등)이 자동으로 최신 상태를 보고, 재시도 진입점도
 * 바로 동작하게 됨(플랫폼 강제종료/내부 오류로 catch가 원래 실행 안 됐던
 * 케이스까지 커버).
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

  let state;

  try{
    state = JSON.parse(raw);
  } catch(e){
    return {};
  }

  const healed = computeSelfHealedPipelineState_(state, Date.now());

  if(healed !== state){

    writePipelineStatusState_(type, healed);

    PropertiesService
      .getScriptProperties()
      .setProperty(CONFIG.PROPERTIES.PIPELINE_LAST_FAILED_TYPE, type);

  }

  return healed;

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
 * 최초 1회만 README 탭 맨 위(A1)에 (그리드 행수 + 구분용 빈 행 1행) 공간을
 * 확보(insertRowsBefore)하고, 이후에는 같은 블록을 덮어쓰기만 해서 기존
 * README 내용을 건드리지 않음(사용자 확정, 2026-08-04).
 *
 * **2026-08-05 레이아웃 전환 마이그레이션**: 옛 레이아웃("⚙️ Pipeline Status"
 * 타이틀, 7행×3열)이 아직 남아있는 시트라면, 새 레이아웃(3행×N열)을 그냥
 * insertRowsBefore로 위에 끼워넣기만 하면 옛 4~7행(Current Stage/Last
 * Started/Last Finished/Last Error)이 새 블록 아래에 고아 행으로 남는다 —
 * 옛 타이틀을 감지하면 그 7행을 먼저 통째로 지운 뒤 새 블록 공간을 확보한다.
 * 이미 새 레이아웃으로 마이그레이션된 시트(타이틀 "Pipeline Status")는 기존
 * 3행 블록을 그대로 덮어쓰기만 함(삽입 없음).
 *
 * **2026-08-06 색상 추가**: 값 쓰기 직후 `computePipelineStatusGridStyles_()`로
 * RUNNING(빨강)/DONE(초록) 배경+글자색+bold를 매번 같이 덮어씀 — 상태가 바뀔
 * 때마다 이 함수가 호출되므로 별도 조건부 서식 규칙 없이 매번 값과 함께
 * 색도 최신 상태로 유지됨.
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

  const OLD_LAYOUT_TITLE = "⚙️ Pipeline Status";
  const OLD_LAYOUT_ROW_COUNT = 7;

  const titleCell = sheet.getRange(anchorRow, anchorCol).getValue();

  if(titleCell === OLD_LAYOUT_TITLE){
    sheet.deleteRows(anchorRow, OLD_LAYOUT_ROW_COUNT);
    sheet.insertRowsBefore(anchorRow, grid.length + 1);
  } else if(titleCell !== grid[0][0]){
    sheet.insertRowsBefore(anchorRow, grid.length + 1);
  }

  const range =
    sheet.getRange(anchorRow, anchorCol, grid.length, grid[0].length);

  range.setValues(grid);

  const styles = computePipelineStatusGridStyles_(grid);

  range.setBackgrounds(styles.backgrounds);
  range.setFontColors(styles.fontColors);
  range.setFontWeights(styles.fontWeights);

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
 *
 * `completedKeys`(선택, 2026-08-05 신규): `stageFn()` 실행 전에
 * `CONFIG.PIPELINE.STATUS_COLUMNS`의 해당 key(들)를 `state.stages`에 "RUNNING"
 * 으로 먼저 표시(2026-08-06부터, 진행 중임을 실시간으로 보여주기 위함),
 * 성공하면 "DONE"으로, 도중에 던지면 "FAILED"로 표시하고 그대로 rethrow —
 * 매번 README에 반영. 단계 하나가 여러 컬럼을 한 번에 완료시키는 경우(예:
 * MTA의 `syncMTAFunnelToOPS_`처럼 여러 실무 영역이 한 함수 안에 뭉쳐있는
 * 경우, 사용자 확정 — 09_MTAFunnelSync.js는 리팩토링하지 않음)에도 배열로
 * 넘기면 됨. 여러 컬럼을 개별 시점에 나눠 완료시켜야 하는 단계
 * (`refreshOPSSheets_`/`refreshReportGenerate_`)는 이 파라미터 대신 자기
 * 자신이 `(type, state)`를 받아 내부에서 직접 상태 표시함.
 * ==========================================================
 */
function advancePipelineStage_(type, state, stageName, stageFn, completedKeys){

  state.stage = stageName;

  if(completedKeys && completedKeys.length){
    if(!state.stages) state.stages = {};
    completedKeys.forEach(function(key){
      state.stages[key] = "RUNNING";
    });
  }

  writePipelineStatusState_(type, state);
  writePipelineStatusToReadme_();

  try{
    stageFn();
  } catch(err){

    if(completedKeys && completedKeys.length){
      completedKeys.forEach(function(key){
        state.stages[key] = "FAILED";
      });
      writePipelineStatusState_(type, state);
      writePipelineStatusToReadme_();
    }

    throw err;

  }

  if(completedKeys && completedKeys.length){

    completedKeys.forEach(function(key){
      state.stages[key] = "DONE";
    });

    writePipelineStatusState_(type, state);
    writePipelineStatusToReadme_();

  }

}


/**
 * ==========================================================
 * Set Pipeline Stage Status (단일 컬럼 상태 즉시 반영)
 *
 * WHY
 * `refreshOPSSheets_()`/`refreshReportGenerate_()`처럼 한 함수 안에 여러
 * Pipeline Status 컬럼(예: Events_OPS/BOFU_OPS/Search_OPS/Content_OPS)이
 * 개별 시점에 RUNNING→DONE(또는 FAILED)으로 넘어가는 경우, `advancePipelineStage_()`의
 * `completedKeys`(함수 전체가 끝나야 한 번에 표시)로는 표현할 수 없어 각
 * 하위 단계 진입/종료 시점마다 직접 이 함수를 호출해 그 컬럼만 즉시 반영한다
 * (2026-08-06 — RUNNING/FAILED 표시 추가 전에는 "Complete"/빈 문자열
 * 2단계뿐이라 `markPipelineStageComplete_(type, state, key)`이었음, 상태
 * 파라미터를 받도록 일반화).
 *
 * @param {string} status  "RUNNING" | "DONE" | "FAILED"
 * ==========================================================
 */
function setPipelineStageStatus_(type, state, key, status){

  if(!state.stages) state.stages = {};

  state.stages[key] = status;

  writePipelineStatusState_(type, state);
  writePipelineStatusToReadme_();

}


/**
 * ==========================================================
 * Mark Pipeline Stage Complete (하위 호환 래퍼)
 *
 * WHY
 * 기존 호출부(`setPipelineStageStatus_()` 도입 전부터 있던 `refreshReportGenerate_()`/
 * `refreshOPSSheets_()` 성공 경로)의 함수명/시그니처를 그대로 유지하기 위한
 * 얇은 래퍼 — `setPipelineStageStatus_(type, state, key, "DONE")`과 동일.
 * ==========================================================
 */
function markPipelineStageComplete_(type, state, key){

  setPipelineStageStatus_(type, state, key, "DONE");

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
 * Refresh Report Generate (ACQ_REP / NewP1_REP / Target_REP)
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
 *
 * `generateTargetReport_()`(91_TargetReport.js, Deal Tracker 기반 Target_Engine
 * Block A~D 전체 재계산 + Target_REP 리포트 재작성) 추가(2026-08-05, 사용자
 * 요청 — "deal tracker도 import 체인에 포함시키자"). 원래 체크박스+onEdit(Simple
 * Trigger)로는 `SpreadsheetApp.openById()`(Deal Tracker 외부 시트)를 호출할 수
 * 없어 Apps Script 편집기 직접 Run 전용으로 남아있었음(`runGenerateTargetReport()`
 * Change Log 참고, 2026-07-27) — 이 파이프라인 트리거는 설치형(Full Authorization)
 * 이라 애초에 그 제약이 없음. Block 0(Target FY/월별 Segment Spent 등 수동 입력)는
 * `refreshTargetEngine_()`가 절대 덮어쓰지 않으므로(00_Config.js 주석 참고) 반복
 * 자동 실행에도 안전.
 *
 * `(type, state)` 파라미터(2026-08-05 신규): ACQ_REP/NewP1_REP/Target_REP 3개가
 * Pipeline Status 표에서 각자 다른 컬럼이라(`CONFIG.PIPELINE.STATUS_COLUMNS`),
 * 하나 끝날 때마다 `markPipelineStageComplete_()`로 그 컬럼만 개별 반영한다
 * (advancePipelineStage_()의 completedKeys는 함수 전체가 끝나야 한 번에
 * 표시되므로 이 용도에 안 맞음).
 * ==========================================================
 */
function refreshReportGenerate_(type, state){

  setPipelineStageStatus_(type, state, "acqRep", "RUNNING");
  try{
    generateACQReport_();
    markPipelineStageComplete_(type, state, "acqRep");
  } catch(err){
    setPipelineStageStatus_(type, state, "acqRep", "FAILED");
    Logger.log(
      "refreshReportGenerate_: ACQ_REP Generate 실패(비필수, 파이프라인은 계속) — " +
      (err && err.message ? err.message : err)
    );
  }

  setPipelineStageStatus_(type, state, "newP1Rep", "RUNNING");
  try{
    generateNewP1Report_();
    markPipelineStageComplete_(type, state, "newP1Rep");
  } catch(err){
    setPipelineStageStatus_(type, state, "newP1Rep", "FAILED");
    Logger.log(
      "refreshReportGenerate_: NewP1_REP Generate 실패(비필수, 파이프라인은 계속) — " +
      (err && err.message ? err.message : err)
    );
  }

  setPipelineStageStatus_(type, state, "targetRep", "RUNNING");
  try{
    generateTargetReport_();
    markPipelineStageComplete_(type, state, "targetRep");
  } catch(err){
    setPipelineStageStatus_(type, state, "targetRep", "FAILED");
    Logger.log(
      "refreshReportGenerate_: Target_REP Generate 실패(비필수, 파이프라인은 계속) — " +
      (err && err.message ? err.message : err)
    );
  }

}


/**
 * ==========================================================
 * Refresh OPS Sheets (Events_OPS / BOFU_OPS / Search_OPS / Content_OPS)
 *
 * WHY
 * `buildEventsOPS()`(52_Events_Build.js)/`buildBOFUOPS()`(62_BOFU_Build.js)/
 * `buildSearchOPS()`(72_Search_Build.js)/`buildContentOPS()`(82_Content_Build.js)는
 * "초기 이관/롤아웃 기간 데이터 안정화 전까지는 수동 실행"으로 2026-07-24
 * 의도적으로 자동화에서 제외돼 있었음(각 파일 헤더 참고) — 그동안 Engine
 * refresh(캐시 계산)만 파이프라인에 있고 OPS 시트 자체 재작성(캐시를 실제
 * 시트에 merge/write)은 "🗂️ Sync Events/BOFU/Search/Content" 메뉴를 매번
 * 직접 눌러야 했음. 사용자 요청(2026-08-05)으로 이 단계도 백그라운드 체인에
 * 편입.
 *
 * 4개 함수 모두 `readXEngineMap_()`(방금 끝난 refresh{Events|BOFU|Search|
 * Content}Engine_() 단계가 갱신한 캐시)를 읽어 기존 OPS 시트와 merge하는
 * 동일 패턴(52/62/72/82_*_Build.js) — `SpreadsheetApp.getUi()` 호출 없어
 * 설치형 트리거에서 안전하게 호출 가능함을 소스 확인.
 *
 * 실패 격리(`refreshReportGenerate_()`/`refreshCampaignSpend_()`와 동일 원칙):
 * OPS 시트 자체는 Leads_OPS/MTA_Master 원본이 아니라 이미 반영된 Engine
 * 캐시를 화면에 옮겨적는 파생 레이어라, 하나가 실패해도(예: 특정 시트 헤더
 * 불일치) 나머지 핵심 데이터 refresh를 되돌리거나 전체 파이프라인을 FAILED로
 * 만들 필요가 없음 — 각자 독립 try/catch, 실패는 Logger에만 기록.
 *
 * `(type, state)` 파라미터(2026-08-05 신규): Events_OPS/BOFU_OPS/Search_OPS/
 * Content_OPS 4개가 Pipeline Status 표에서 각자 다른 컬럼이라
 * (`CONFIG.PIPELINE.STATUS_COLUMNS`), 하나 끝날 때마다
 * `markPipelineStageComplete_()`로 그 컬럼만 개별 반영한다.
 * ==========================================================
 */
function refreshOPSSheets_(type, state){

  setPipelineStageStatus_(type, state, "eventsOps", "RUNNING");
  try{
    buildEventsOPS();
    markPipelineStageComplete_(type, state, "eventsOps");
  } catch(err){
    setPipelineStageStatus_(type, state, "eventsOps", "FAILED");
    Logger.log(
      "refreshOPSSheets_: Events_OPS 갱신 실패(비필수, 파이프라인은 계속) — " +
      (err && err.message ? err.message : err)
    );
  }

  setPipelineStageStatus_(type, state, "bofuOps", "RUNNING");
  try{
    buildBOFUOPS();
    markPipelineStageComplete_(type, state, "bofuOps");
  } catch(err){
    setPipelineStageStatus_(type, state, "bofuOps", "FAILED");
    Logger.log(
      "refreshOPSSheets_: BOFU_OPS 갱신 실패(비필수, 파이프라인은 계속) — " +
      (err && err.message ? err.message : err)
    );
  }

  setPipelineStageStatus_(type, state, "searchOps", "RUNNING");
  try{
    buildSearchOPS();
    markPipelineStageComplete_(type, state, "searchOps");
  } catch(err){
    setPipelineStageStatus_(type, state, "searchOps", "FAILED");
    Logger.log(
      "refreshOPSSheets_: Search_OPS 갱신 실패(비필수, 파이프라인은 계속) — " +
      (err && err.message ? err.message : err)
    );
  }

  setPipelineStageStatus_(type, state, "contentOps", "RUNNING");
  try{
    buildContentOPS();
    markPipelineStageComplete_(type, state, "contentOps");
  } catch(err){
    setPipelineStageStatus_(type, state, "contentOps", "FAILED");
    Logger.log(
      "refreshOPSSheets_: Content_OPS 갱신 실패(비필수, 파이프라인은 계속) — " +
      (err && err.message ? err.message : err)
    );
  }

}


/**
 * ==========================================================
 * Refresh Campaign Spend (Ad_Spend_Cache — Meta+Naver Search+Kakao Channel)
 *
 * WHY
 * `refreshAdSpendCache_()`(AD_004_SpendCache.js)는 원래 ACQ_REP/NewP1_REP/
 * Target_REP Generate·Refresh 전에 사용자가 매번 직접 Run해야 하는 수동
 * 단계였음 — Naver Search "730일 조회 제약" 버그를 고친 직후 사용자가
 * 백그라운드 체인에 포함시켜 완전 자동화해달라고 요청(2026-08-04). Meta_Raw
 * (수기 붙여넣기)/Naver Search API/Kakao Channel(별도 스프레드시트 수기 시트)을
 * 전부 읽어야 해 Simple Trigger로는 못 돌리고, 이 설치형 백그라운드 트리거의
 * Full Authorization이 필요함(파일 상단 WHY와 동일 이유).
 *
 * `refreshTargetActuals_()`/`refreshReportGenerate_()`(ACQ_REP/NewP1_REP/
 * Target_REP의 Spent/CPNP1)가 전부 이 캐시를 읽으므로(2026-08-04 자동 집계
 * 전환), 두 파이프라인 테일 모두에서 그 단계들보다 **먼저** 호출해야 함
 * (runLeadsPipelineTail()/runMTAPipelineTail() 호출 순서 참고).
 *
 * 실패 격리(refreshReportGenerate_()와 동일 원칙) — Naver Search API 인증
 * 만료 등 외부 요인으로 실패해도 Logger에만 남기고 던지지 않음. Ad Spend는
 * Leads_OPS/MTA_Master 핵심 데이터와 무관한 보조 지표(Spent/CPNP1)라, 이
 * 실패로 6분짜리 핵심 데이터 refresh 전체를 재실행하게 만들 필요가 없음.
 * ==========================================================
 */
function refreshCampaignSpend_(){

  try{
    refreshAdSpendCache_();
  } catch(err){
    Logger.log(
      "refreshCampaignSpend_: Ad_Spend_Cache 갱신 실패(비필수, 파이프라인은 계속) — " +
      (err && err.message ? err.message : err)
    );
  }

}


/**
 * ==========================================================
 * Refresh Naver Search Campaign Stats (Search_OPS Campaign/Impressions/
 * Link clicks 자동화용 누적 캐시)
 *
 * WHY
 * `refreshNaverSearchAdCampaignStatsCache_()`(AD_003_NaverSearch.js)가
 * Naver Search Ad API를 호출해 캠페인별 누적 Impressions/Link clicks를
 * 갱신 — `refreshOPSSheets_()`(buildSearchOPS() 포함)보다 먼저 실행해야
 * Search_OPS가 이번 실행의 최신 캐시를 읽어 매칭한다(사용자 요청,
 * 2026-08-05).
 *
 * 실패 격리(`refreshCampaignSpend_()`와 동일 원칙) — Naver API 인증 만료 등
 * 외부 요인으로 실패해도 Logger에만 남기고 던지지 않음. 이 통계는
 * Search_OPS의 참고용 보조 컬럼이라, 실패로 핵심 데이터 refresh 전체를
 * 재실행하게 만들 필요가 없음.
 * ==========================================================
 */
function refreshNaverSearchCampaignStats_(){

  try{
    refreshNaverSearchAdCampaignStatsCache_();
  } catch(err){
    Logger.log(
      "refreshNaverSearchCampaignStats_: Naver 캠페인 통계 갱신 실패(비필수, 파이프라인은 계속) — " +
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
    startedAtMs: Date.now(), // computeSelfHealedPipelineState_() 판정용(2026-08-19)
    finishedAt: "",
    error: "",
    stages: {}
  };

  writePipelineStatusState_(type, state);
  writePipelineStatusToReadme_();

  try{

    advancePipelineStage_(
      type, state,
      "runAutoDeleteExactDuplicateLeadRows",
      runAutoDeleteExactDuplicateLeadRows,
      ["masterUpdate"]
    );

    advancePipelineStage_(type, state, "buildLeadsOPS", function(){
      buildLeadsOPS(true);
    }, ["leadsOps"]);

    advancePipelineStage_(
      type, state, "rebuildDealTrackerEngine_", rebuildDealTrackerEngine_
    );

    advancePipelineStage_(type, state, "refreshACQSummary_", refreshACQSummary_);
    advancePipelineStage_(type, state, "refreshNewP1Engine_", refreshNewP1Engine_);
    advancePipelineStage_(type, state, "refreshEventsEngine_", refreshEventsEngine_);
    advancePipelineStage_(type, state, "refreshBOFUEngine_", refreshBOFUEngine_);
    advancePipelineStage_(type, state, "refreshSearchEngine_", refreshSearchEngine_);
    advancePipelineStage_(type, state, "refreshContentEngine_", refreshContentEngine_);

    advancePipelineStage_(
      type, state, "refreshNaverSearchCampaignStats_", refreshNaverSearchCampaignStats_
    );

    advancePipelineStage_(type, state, "refreshOPSSheets_", function(){
      refreshOPSSheets_(type, state);
    });

    advancePipelineStage_(
      type, state, "refreshCampaignSpend_", refreshCampaignSpend_, ["campaignSpend"]
    );

    advancePipelineStage_(type, state, "refreshTargetActuals_", refreshTargetActuals_);
    advancePipelineStage_(type, state, "refreshReportFYDropdowns_", refreshReportFYDropdowns_);

    advancePipelineStage_(type, state, "refreshReportGenerate_", function(){
      refreshReportGenerate_(type, state);
    });

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
 * 여기서는 그 함수 하나만 단계로 감싼다(09_MTAFunnelSync.js 수정 불필요) —
 * 단, `refreshCampaignSpend_()`(Ad_Spend_Cache)는 그 안의 `refreshTargetActuals_()`
 * 가 참조하므로 반드시 그보다 먼저(= syncMTAFunnelToOPS_() 호출 전)
 * 실행해야 함(2026-08-04). `refreshOPSSheets_()`(Events/BOFU/Search/Content
 * OPS 시트 재작성)는 그 안에서 방금 갱신된 Engine 캐시를 읽으므로
 * syncMTAFunnelToOPS_() 바로 다음 단계로 배치(2026-08-05).
 * ==========================================================
 */
function runMTAPipelineTail(){

  deleteTriggersByHandlerName_("runMTAPipelineTail");

  const type = CONFIG.PIPELINE.TYPES.MTA;

  const state = {
    status: "RUNNING",
    stage: "",
    startedAt: nowTimestamp_(),
    startedAtMs: Date.now(), // computeSelfHealedPipelineState_() 판정용(2026-08-19)
    finishedAt: "",
    error: "",
    stages: {}
  };

  writePipelineStatusState_(type, state);
  writePipelineStatusToReadme_();

  try{

    advancePipelineStage_(
      type, state,
      "runAutoDeleteExactDuplicateTouchRows",
      runAutoDeleteExactDuplicateTouchRows,
      ["masterUpdate"]
    );

    advancePipelineStage_(
      type, state, "refreshCampaignSpend_", refreshCampaignSpend_, ["campaignSpend"]
    );

    advancePipelineStage_(
      type, state, "rebuildDealTrackerEngine_", rebuildDealTrackerEngine_
    );

    // Leads_OPS 동기화 + ACQ/NewP1/Events/BOFU/Search/Content Engine 캐시 refresh가
    // syncMTAFunnelToOPS_() 하나(09_MTAFunnelSync.js) 안에 뭉쳐있어 개별 완료 시점을
    // 못 나눔(리팩토링 안 하기로 확정, 2026-08-05) — 전체가 끝나는 순간 leadsOps
    // 컬럼만 한 번에 Complete로 표시. Events_OPS~Content_OPS는 이 뒤 refreshOPSSheets_
    // 단계(OPS 시트 재작성, 08_PipelineAsync.js 자체 소유라 개별 추적 가능)에서
    // 각자 개별 완료 표시됨.
    advancePipelineStage_(
      type, state, "syncMTAFunnelToOPS_", syncMTAFunnelToOPS_, ["leadsOps"]
    );

    advancePipelineStage_(
      type, state, "refreshNaverSearchCampaignStats_", refreshNaverSearchCampaignStats_
    );

    advancePipelineStage_(type, state, "refreshOPSSheets_", function(){
      refreshOPSSheets_(type, state);
    });

    advancePipelineStage_(type, state, "refreshReportFYDropdowns_", refreshReportFYDropdowns_);

    advancePipelineStage_(type, state, "refreshReportGenerate_", function(){
      refreshReportGenerate_(type, state);
    });

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

  // 죽은 RUNNING이 있으면 여기서 self-heal되어 PIPELINE_LAST_FAILED_TYPE가
  // 채워짐(readPipelineStatusState_() 내부 side effect, 2026-08-19) — 이
  // 호출이 없으면 플랫폼 강제종료/내부 오류로 죽은 실행은 재시도 진입점
  // 자체를 못 찾음(과거엔 이 사각지대 때문에 README에 RUNNING이 영구히
  // 남아도 이 함수가 "재시도할 게 없다"고 알림).
  readPipelineStatusState_(CONFIG.PIPELINE.TYPES.LEADS);
  readPipelineStatusState_(CONFIG.PIPELINE.TYPES.MTA);

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
    "이 시트 맨 위 Pipeline Status 표에서 New Leads/MTA Leads 행마다 Master Update~Target_REP 각 컬럼이 Complete로 바뀌는지 확인하세요.",
    "Status 컬럼에 전체 진행상태(RUNNING/DONE/FAILED)와 마지막 완료 시각(한국시간 KST 기준)이 같이 표시됩니다.",
    "",
    "③ ACQ_REP / NewP1_REP에서 다른 기간을 보고 싶다면",
    "Start FY/End FY, Start Month/End Month를 원하는 값으로 바꾸고 Generate 체크박스를 클릭하세요.",
    "(그냥 두면 마지막으로 선택했던 기간 기준으로 자동 갱신됩니다.)",
    "",
    "④ 아직 자동이 아닌 것",
    "현재 Import~Report 흐름에서 매번 수동으로 눌러야 하는 단계는 없습니다.",
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

  const now = 1000000000000; // 임의의 고정 기준 시각(ms)

  const empty = computePipelineLockState_("", "LEADS", now);
  const emptyOk = empty.acquired === true && empty.holderType === null;

  const freshSameType = computePipelineLockState_(
    JSON.stringify({ type: "LEADS", acquiredAt: now - 1000 }), "LEADS", now
  );
  const freshSameTypeOk = freshSameType.acquired === false && freshSameType.holderType === "LEADS";

  const freshOtherType = computePipelineLockState_(
    JSON.stringify({ type: "MTA", acquiredAt: now - 1000 }), "LEADS", now
  );
  const freshOtherTypeOk = freshOtherType.acquired === false && freshOtherType.holderType === "MTA";

  const staleLock = computePipelineLockState_(
    JSON.stringify({ type: "LEADS", acquiredAt: now - CONFIG.PIPELINE.LOCK_STALE_THRESHOLD_MS - 1 }),
    "LEADS", now
  );
  const staleLockOk = staleLock.acquired === true && staleLock.holderType === null;

  const legacyFormat = computePipelineLockState_("LEADS", "LEADS", now); // 옛 단순 문자열 형식
  const legacyFormatOk = legacyFormat.acquired === true && legacyFormat.holderType === null;

  const pass = emptyOk && freshSameTypeOk && freshOtherTypeOk && staleLockOk && legacyFormatOk;

  Logger.log(
    "testComputePipelineLockState: " +
    (pass ? "PASS" : "FAIL") +
    " (empty=" + JSON.stringify(empty) +
    ", freshSameType=" + JSON.stringify(freshSameType) +
    ", freshOtherType=" + JSON.stringify(freshOtherType) +
    ", staleLock=" + JSON.stringify(staleLock) +
    ", legacyFormat=" + JSON.stringify(legacyFormat) + ")"
  );

}


function testBuildPipelineStatusGrid(){

  const grid = buildPipelineStatusGrid_(
    {
      status: "RUNNING",
      stage: "refreshACQSummary_",
      startedAt: "2026-08-04 10:00:00 KST",
      finishedAt: "",
      error: "",
      stages: { masterUpdate: "DONE", leadsOps: "RUNNING" }
    },
    {
      status: "FAILED",
      stage: "syncMTAFunnelToOPS_",
      startedAt: "2026-08-04 09:00:00 KST",
      finishedAt: "2026-08-04 09:05:00 KST",
      error: "Boom",
      stages: { masterUpdate: "DONE", campaignSpend: "FAILED" }
    }
  );

  const ok =
    grid.length === 3 &&
    grid[0].length === 12 &&
    grid[0][0] === "Pipeline Status" &&
    grid[0][1] === "Status" &&
    grid[0][2] === "Master Update" &&
    grid[0][11] === "Target_REP" &&
    grid[1][0] === "New Leads" &&
    grid[1][1] === "RUNNING · started 2026-08-04 10:00:00 KST" &&
    grid[1][2] === "DONE" && grid[1][3] === "RUNNING" && grid[1][4] === "" &&
    grid[2][0] === "MTA Leads" &&
    grid[2][1] === "FAILED · 2026-08-04 09:05:00 KST · Boom" &&
    grid[2][2] === "DONE" && grid[2][3] === "" && grid[2][8] === "FAILED";

  Logger.log(
    "testBuildPipelineStatusGrid: " + (ok ? "PASS" : "FAIL") +
    " grid=" + JSON.stringify(grid)
  );

  const emptyGrid = buildPipelineStatusGrid_({}, {});
  const emptyOk =
    emptyGrid[1][1] === "IDLE" && emptyGrid[2][1] === "IDLE" &&
    emptyGrid[1][2] === "" && emptyGrid[2][2] === "";

  Logger.log(
    "testBuildPipelineStatusGrid (empty defaults): " +
    (emptyOk ? "PASS" : "FAIL")
  );

}


function testComputePipelineStatusGridStyles(){

  const grid = [
    ["Pipeline Status", "Status", "Master Update", "Leads_OPS"],
    ["New Leads", "RUNNING · started 2026-08-06 10:00:00 KST", "DONE", "RUNNING"],
    ["MTA Leads", "FAILED · 2026-08-06 09:05:00 KST · Boom", "FAILED", ""]
  ];

  const styles = computePipelineStatusGridStyles_(grid);

  const ok =
    // 헤더 행/라벨 열은 값과 무관하게 항상 미채색
    styles.backgrounds[0][0] === null && styles.backgrounds[0][1] === null &&
    styles.backgrounds[1][0] === null && styles.backgrounds[2][0] === null &&
    // Status 열(타임스탬프 접미사 있어도 접두사로 매치)
    styles.backgrounds[1][1] === "#F4CCCC" && styles.fontColors[1][1] === "#CC0000" &&
    styles.fontWeights[1][1] === "bold" &&
    styles.backgrounds[2][1] === null && styles.fontWeights[2][1] === "normal" && // FAILED는 미채색
    // 단계 컬럼 — DONE/RUNNING/FAILED/빈 문자열
    styles.backgrounds[1][2] === "#D9EAD3" && styles.fontColors[1][2] === "#38761D" &&
    styles.fontWeights[1][2] === "bold" &&
    styles.backgrounds[1][3] === "#F4CCCC" && styles.fontWeights[1][3] === "bold" &&
    styles.backgrounds[2][2] === null && styles.fontWeights[2][2] === "normal" &&
    styles.backgrounds[2][3] === null && styles.fontWeights[2][3] === "normal";

  Logger.log(
    "testComputePipelineStatusGridStyles: " + (ok ? "PASS" : "FAIL") +
    " styles=" + JSON.stringify(styles)
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
