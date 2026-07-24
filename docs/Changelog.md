# Changelog — 2026-07-24 (Events_OPS/Events_Engine 구현)

## NewP1 Report 복구 (40_NewP1Report.js / CONFIG.NEWP1 / onEdit 분기)

**배경**: `40_NewP1Report.js`(New P1 Cohort Funnel Report)와 그 Styles 파일, `00_Config.js`의
`CONFIG.NEWP1` 블록, `30_ACQReport.js`의 `onEdit()` NewP1 분기가 전부 Apps Script 서버에만
존재하던 상태였음(로컬 git엔 한 번도 커밋된 적 없음 — "서버에서 직접 수정 금지" 원칙이 이번에도
어겨진 사례). Events 작업 중 40번대 파일 번호가 겹친 걸 발견해 정리하는 과정에서 사용자가
`40_Events_Config.js` 등 6개 구 파일을 삭제할 때 이 NewP1 파일들도 실수로 같이 삭제됨. 추가로
이 세션에서 여러 번 실행한 `clasp push --force`가 `CONFIG.NEWP1`이 없는 로컬 `00_Config.js`로
원격을 덮어써, 파일 삭제와 별개로 설정 블록 자체도 같이 사라짐(이 부분은 사용자 실수가 아니라
이쪽 작업 방식의 문제).

**복구 방법**: Apps Script 버전 기록에 삭제 이전 시점이 없어(당일 09:43 기록만 존재), 사용자가
직전 세션에서 대화 중 붙여넣어 공유해준 파일 원문을 근거로 재구성. 실제 `NewP1_REP`/`NewP1_Engine`
시트 자체는 삭제되지 않고 살아있어(코드 삭제가 시트 데이터를 지우진 않음), 사용자가 확인해준
실제 레이아웃(1행 Control Header/2행 Control Value/4행 Report Header/5행 데이터 시작, 시트명
"NewP1_REP"/"NewP1_Engine")을 근거로 `CONFIG.NEWP1`을 재구성 — `CONFIG.ACQ`와 완전히 동일한
구조(코드가 `CONFIG.ACQ.SEGMENTS`/`FISCAL_MONTH_ORDER`를 그대로 재사용하는 것으로 확인됨).

**복구 결과물**:
- `00_Config.js` v1.1.0 — `CONFIG.NEWP1`(SHEET/ENGINE_SHEET/ROWS/COLUMNS) 추가.
- `40_NewP1Report.js` v1.2.0 — 원본 로직 그대로 복원 + `isEffectiveP1_()` 신규 재구성(원본
  정의를 못 찾아 Styles 파일 헤더 Note의 설명을 근거로 재구성, 문서에 상세 스펙 없음 — 사용자
  확인 후 확정). 원본과 100% 동일하다는 보장은 없음(diff 대조 불가).
- `41_NewP1ReportStyles.js`(파일명은 추정 — 원본 파일명 확인 불가, ACQReport/ACQReportStyles
  관례를 따름. Apps Script는 전역 네임스페이스라 파일명이 달라도 동작엔 영향 없음) v1.3.0.
- `30_ACQReport.js` v1.4.0 — `onEdit()`에 NewP1_REP 분기(`handleNewP1ReportGenerateEdit_` 호출)
  복구. 이게 없으면 NewP1_REP의 Generate 체크박스가 아무 반응도 안 함.
- **⚠️ MAX_WEEKS 값은 복구 불가** — 코드 자체가 "더 이상 안 씀"이라고 명시했던 값이라 기능엔
  영향 없음.
- 검증 필요(사용자 실행): 각 파일의 `testXXXX()`(`testIsEffectiveP1` 포함) → `runRefreshNewP1Engine()`
  → `NewP1_REP`에서 Generate 체크박스 토글해 리포트 생성 정상 동작 확인.

## Events_OPS / Events_Engine 최초 구현
- 설계: `docs/EventsReportDesign.md` (같은 날 세션에서 확정). Webinar/Seminar 프로그램별 ROI
  리포트 — 별도 xlsx(FTA/OPs/Ads perf)로 관리하던 실무를 이 워크북으로 이관하는 첫 구현.
- 신규 파일 6개 (50번대 블록, Leads_OPS/ACQ_Summary 패턴을 그대로 본뜸):
  `50_Events_Config.js`(EVENTS config) / `51_Events_Engine.js`(UTM Key별 SF 집계,
  `refreshEventsEngine_()`) / `52_Events_Build.js`(오케스트레이션, `buildEventsOPS()`) /
  `53_Events_Merge.js`(Manual 컬럼 보존 병합, `mergeEventsOPS_()`) /
  `54_Events_Write.js`(시트 쓰기 + SUBTOTAL 행 수식) / `55_Events_Styles.js`(서식).
- 4-시트(OPS/Engine/QA/REP) 설계에서 프로그램 수(~130~150개) 규모가 작다고 판단해
  **Engine+OPS 2-시트로 축소** — Events_QA/Events_REP는 만들지 않음. 파생지표(Match
  Rate/CPL/CPNP1/ROAS)는 REP 없이 OPS 빌드 시점에 값으로 계산 (ACQ_REP와 동일 패턴,
  라이브 수식/시트보호는 도입하지 않음 — 매 빌드가 전체 재작성이라 보호 없이도 안전).
- Sales funnel 지표(IC Request/Booked/Complete/Deals/Revenue)는 Leads_OPS에서 그대로 읽되
  Leads_Master(1 Lead=1 Row, First Touch)의 Lead ID→UTM Key 맵으로 조인 — First Touch
  Attribution 원칙 보장, MTA_Master(터치 레벨)는 All Registered/P1 All 집계에만 사용.
- `refreshEventsEngine_()`를 `refreshACQSummary_()` 호출부 4곳에 나란히 배선: 
  `07_IncrementalMasterBuild.js:101`(appendNewLeads), `09_MTAFunnelSync.js:325`
  (syncMTAFunnelToOPS_), `10_MasterBuild.js:73/153`(rebuildLeadsMaster/rebuildMTAMaster).
- `buildEventsOPS()`는 메뉴/자동 트리거 미연결 — 초기 롤아웃 기간엔 스크립트 편집기 수동
  실행 전용(Rebuild류와 동일 관행). Engine 갱신만 자동.
- **⚠️ 실행 전 확인 필요한 가정 (구현 계획서에 명시, `~/.claude/plans/synthetic-inventing-pnueli.md`)**:
  IC Request = `Total IC Requests > 0`인 Lead 수로 정의, CPL=Spent/Leads(Meta),
  CPNP1=Spent/NL P1, ROAS=Revenue/Spent, Match Rate=All Registered/Reg. — 전부 표준 관례로
  추정한 것이라 실데이터/기대치와 다르면 조정 필요. `MKT UTM Campaign`의 `_US-50`류 국가 suffix
  패턴도 실데이터 샘플 확인 전.
- 검증 순서(사용자 실행 필요): 각 파일의 `testXXXX()` 함수들 → `51_Events_Engine.js`의
  `runRefreshEventsEngine()` → `Events_Engine` 시트 육안 확인 → `52_Events_Build.js`의
  `buildEventsOPS()` → `Events_OPS` 결과 확인.

## Events_OPS / Events_Engine — 실데이터 검증 후 대폭 수정 (같은 날, 초기 구현 이후)

**⚠️ 위 "최초 구현" 항목의 매칭 방식(UTM Key/`_US-50` 국가 suffix)은 실데이터로 실제 `runRefreshEventsEngine()`을
돌려본 뒤 전면 폐기되고 아래 방식으로 교체됨.**

- **매칭 필드 전환**: 실행 결과 `MKT UTM Campaign`(raw UTM) 기준 그룹 수가 2,167개(실제 프로그램
  ~150~385개 대비 압도적으로 많음) — 하나의 프로그램에 채널(Meta/Google 등)별로 UTM이 수십 개
  붙는 구조였음. 대신 MTA_Master의 `Lead Source Detail`/Leads_Master의 `First Touch Detail`
  (raw 필드, **실제 Marketo Program 이름**을 담고 있음을 사용자가 확인)로 매칭 기준 변경 →
  1,376개로 감소.
- **국가 필터**: `_US-50`류 UTM 접미사 파싱은 실데이터와 안 맞아 폐기. 대신 Marketo Program
  이름 자체가 `{TYPE}-{YYYY}-{MM}-{COUNTRY}-{FUNNEL}-{Division} {이벤트명}` 구조임을 확인,
  COUNTRY(4번째 하이픈 토큰)가 `KOR`인 것만 대상(KR 외 국가는 다른 팀 캠페인). `isKoreanProgram_()`.
- **TYPE 필터 추가**: `WF-`로 시작하는 프로그램(대부분 ebook/practice test/consult page 등
  비-이벤트 콘텐츠)이 Business Segment=Webinar/Seminar로 잘못 섞여 들어오는 사례 다수 발견 →
  `WB`(Webinar)/`EV`(Seminar)만 허용(`EVENTS.EVENT_TYPE_PREFIXES`, `isEligibleEventType_()`).
  최종 Engine 결과: **385개** (연 50~60개 이벤트 × 5~7년 실측치와 부합).
- **MTA_Master 컬럼명 정정**: "First Touch Detail" → "Lead Source Detail"로 리네임
  (`13_MTATransformer.js` v5.1.0) — Leads_Master의 동명 컬럼(raw 필드는 다름, First Touch
  스냅샷)과 헷갈렸음. `24_OPSQA.js`의 완전동일 중복 검출 로직도 함께 갱신.
  부수적으로 `getBusinessSegment()` 호출 시 detail 파라미터에 빈 문자열이 하드코딩되어 있던
  기존 버그도 함께 수정 (v5.2.0) — MTA_Master BOFU 분류가 지금까지 한 번도 작동 안 하고 있었음.
  ⚠️ 둘 다 컬럼/분류값 변경이라 `rebuildMTAMaster()` 재실행 필요.
- **등록 폼 접미사 중복 버그 수정**: Marketo Program 이름 뒤에 "(구분자) Registered for
  Webinar/Seminar from X Form" 접미사가 폼 종류별로 다르게 붙어, 같은 이벤트가 여러 행으로
  쪼개지는 버그 발견(사용자가 실 빌드 결과에서 확인). `stripRegistrationFormSuffix_()`를
  표시용이 아니라 **매칭 키 추출 단계**(`aggregateMTATouchRecords_`/`aggregateLeadsRecords_`,
  51_Events_Engine.js)에 직접 적용해 근본 해결.
- **Event Date/EventType 자동 채움**: Marketo Program 이름에서 `{TYPE}-{YYYY}-{MM}` 파싱
  (`parseProgramTypeAndDate_()`) — EventType은 WB→Webinar/EV→Seminar 매핑, Event Date는
  1차로 월 1일 기본값. 이후 더 정확한 값을 위해 Events_Engine에 `UTM`/`Event Date` 컬럼 추가,
  같은 프로그램의 터치들이 가리키는 raw `MKT UTM Campaign`의 일 단위 날짜 중 **최빈값**을
  채택(`pickModeEventDate_()`) — Engine의 정확한 날짜가 있으면 그걸 우선, 없으면 월 1일로
  fallback. 값이 이미 있는 행(Ops 수동 입력)은 덮어쓰지 않음. FY/Month는 Event Date로부터
  자동 파생(기존 로직 재사용), 정렬도 Event Date 기준(기존 로직)이 그대로 FY/Month 순 역할.
- **스키마/스타일 사용자 지정**: 컬럼명 대량 리네임(예: `All Registered`→`SF Reg.`, `Reg.`→
  `Mkt Reg.`) 및 순서 재배치, A~D열(`Lead Source Detail`/`Match Rate`/`Target Market`/`Division`)
  숨김 처리, 헤더를 소스 그룹별 배경색으로 구분(Marketo=보라 `#6b21a8`, SF=하늘색 `#0369a1`,
  Meta=Meta 브랜드 블루 `#1877F2`, Derived=회색 `#434343`), 전체 셀 테두리 추가.
- **메뉴 정리**: `00_Menu.js` v3.1.0 — "✅ QA" 메뉴 제거(Leads_OPS QA는 이미 `buildLeadsOPS()`
  실행 시 자동 수행이라 메뉴 실익 낮음, `runOPSQAManual()` 자체는 그대로 존재해 편집기에서
  직접 실행 가능), "🗂️ OPS" 메뉴 신설(`createOPSMenu()`) — "Update Events"(`buildEventsOPS()`)
  추가. Search/BOFU/Ebook 등 향후 세그먼트 트래커도 구현되는 대로 이 메뉴에 추가 예정.

## `Leads_OPS_QA` 시트 구현 완료 사실 뒤늦게 반영
- `24_OPSQA.js`(`writeOPSQAResults_()`)에 Dashboard(Master vs Leads_OPS 지표 대조) + Issues 테이블을
  `Leads_OPS_QA` 시트에 쓰는 로직이 이미 완전히 구현되어 있고, `buildLeadsOPS()` 실행 시 자동 호출
  (`21_OPS_Build.js`)까지 연결되어 있음을 확인. 메뉴에도 "Run Leads_OPS QA" 수동 실행 항목 존재.
- 실제로는 2026-07-22 커밋(`c0dec13`, `24_OPSQA.js` 최초 추가) 시점에 이미 구현 완료된 상태였으나,
  env(로컬 개발 환경) 전환 과정에서 CLAUDE.md "현재 알려진 미해결 항목" 1번과 Changelog에 반영이
  누락된 것으로 추정. CLAUDE.md 1번 항목을 완료 처리로 정정.

## CLAUDE.md 2번 항목 정정 — IC Request(SAL) `#touches` 지표는 4번(재신청 카운터)과 동일 항목
- 별개의 미해결 항목으로 잘못 분리 기재돼 있었음. 4번 항목(`applyICRequestTracking_()`,
  `Total IC Requests`/`Last IC Requested Date`)이 곧 이 지표의 구현이었음을 확인, 완료 처리로 정정.

## `OperationsLayer.md` 143~148행 정정 — `applyOPSStyle()` 하드코딩 "미해결" 표기 오류
- 실제 코드(`20_OPS_Styles.js`)는 이미 `OPS.ROWS.HEADER`/`OPS.ROWS.DATA_START`로 전부 교체되어 있었음
  (Changelog 2026-07-21 "applyOPSStyle() 하드코딩 정리 완료" 기록과 일치). `OperationsLayer.md`에만
  구버전 상태로 남아있던 것을 정정.

## CLAUDE.md 3번 항목 해결 — MTA_Master "완전 동일 duplicate row" 검출 로직 구현 (`24_OPSQA.js` v1.1.0)
- **배경**: 2026-07-22 `findDuplicateTouchRows_()`로 Lead ID+MTA Created Date 조합 기준 3,401개 그룹
  발견했으나, 같은 날 서로 다른 캠페인으로 정상 다중 터치한 경우와 진짜 중복(Salesforce export 재전달
  사고)을 구분할 기준이 없어 판단 기준 정의부터 필요한 상태로 보류돼 있었음.
- **판단 기준 확정(사용자 결정)**: "완전 동일" = 터치 식별 필드(Lead ID / MTA Created Date /
  MKT UTM Campaign / First Lead Source / First Touch Detail — 이후 2026-07-24 같은 날 컬럼명이
  "Lead Source Detail"로 정정됨, 아래 Events_OPS 항목 참고) 5개가 전부 일치하는 경우. IC Booked/
  Completed/Won Date, Revenue, Lead Priority, Sales Funnel Stage, Lead Record Type 등 Lead 레벨
  스냅샷 필드(export 시점마다 값이 바뀔 수 있음)는 비교 대상에서 제외 — 서로 다른 시점에 재추출된
  진짜 중복까지 놓치지 않기 위함. Created FY/Quarter/Week/Month 등 파생 필드는 MTA Created Date에서
  자동 계산되므로 비교 의미 없어 제외.
- **구현**: `findExactDuplicateTouchRows_()`(순수 검출 함수) + `checkExactDuplicateTouchRows_()`(OPS QA
  체크로 등록, `runOPSQA_()`에 연결) 추가. 문제 있는 조합은 "Exact Duplicate Touch Row" 이슈로
  `Leads_OPS_QA` 시트에 기록됨. `buildLeadsOPS()` 실행 시 자동 실행.
- **자동 삭제는 하지 않음** — Master는 재생성 가능하지만 원인 파악 전 임의 삭제는 데이터 손실 위험이
  있어, 이번 구현은 검출/보고까지만 수행. 실제 제거 여부는 QA 이슈 확인 후 별도 논의.
- TDD 원칙에 따라 `testFindExactDuplicateTouchRows()` 단위 테스트 함께 추가 (기존 `findDuplicateTouchRows_()`
  로직과 별개로 유지 — 후자는 여전히 1차 스크리닝용 진단 유틸리티로 남겨둠).

# Changelog — 2026-07-21

이날 하루 동안 진행된 리팩토링 요약. 시간순 기록.

## 1. 구버전 중복 파일 정리
- `16_TransformHelper.js`에 `transformLeadRecords`/`transformLeadRecord`가 `12_LeadTransformer.js`와
  중복 정의되어 있던 문제 발견 → 헬퍼 함수(`parseDMY` 등)만 남기고 중복 함수 삭제.

## 2. Import(Stage 00) — Architecture 정합성 수정
- 기존 `importCsv()`가 Raw를 거치지 않고 곧장 Master로 쓰던 구조(Architecture 문서 위반) 발견 → 수정.
- Import는 이제 Raw까지만 담당 (`transformRecords()`/`loadRecords()` 호출 제거).
- Master Build는 별도 메뉴(🏗️)로 분리.
- `REQUIRED_FIELDS`를 `CONFIG.REQUIRED_FIELDS`로 중앙화 (Leads: Lead ID/Email/Create Date/Company Account,
  MTA: Lead ID/Email/MTA Created Date).
- 무효 레코드(`_isValid === false`)는 Raw에 안 쓰고 로그만 남김 (Silent Failure 방지).
- 업로드 다이얼로그(`00_UploadDialog.html`) 연결 함수(`showUploadDialog_`, `importLeadReport`, `importMTAReport`) 추가.
- "Import All" 메뉴 제거 (레거시).

## 3. 날짜 파싱 버그 방지 구현
- `CONFIG.RAW_DATE_COLUMNS` 추가, Raw 쓰기 시 Plain Text 서식(`@`) 강제.
- `parseDMY()` 단위 테스트 + 실데이터 검증 완료 (자세한 내용: `import-date-parsing-bug.md`).

## 4. Raw/Master 방식 전환 — Overwrite → Append
- **배경**: Salesforce weekly export를 매번 전체 재계산하기엔 데이터 볼륨이 너무 큼 (성능 문제).
- **Raw**: Full Overwrite → Append로 전환 (`appendSheetRecords()` 신규 추가, `05_SheetWriter.js`).
  - 정렬은 하지 않음 (텍스트 날짜라 정렬 비용이 큼 — Master 단계에서만 정렬).
  - Leads는 원천에서 이미 신규 lead만 export되어 dedup 불필요. MTA는 중복이 의도된 것이라 dedup 안 함.
- **Master**: Incremental Append 방식 도입 (`07_IncrementalMasterBuild.js`).
  - `PropertiesService`에 `LEADS_LAST_PROCESSED_ROW`/`MTA_LAST_PROCESSED_ROW` 저장, 이후 Raw 행부터만 Transform.
  - Append 후 `06_SheetSorter.js`의 `sortSheetByDate()`로 Create Date 기준 내림차순 정렬 (최신이 맨 위).
- **Full Rebuild**: 기존 `buildLeadsMaster`/`buildMTAMaster` → `rebuildLeadsMaster`/`rebuildMTAMaster`로 개명,
  복구/Business Rule 변경 시 스크립트 편집기에서 수동 실행 전용 (메뉴 노출 안 함). `buildAllMaster()` 제거.
- **초기 전환 절차**: 기존 Raw/Master 수동 삭제 → `resetIncrementalCounters()` 실행(카운터 0 리셋) →
  CSV 재Import → Append 실행. (`99_ResetRawMaster.js`)

## 5. 메뉴 개편
- "📥 Import" → **"📥 Update"**
- "🏗️ Build" → **"🏗️ Append"**
- "📊 Report" 메뉴는 항목이 하나도 없어 `onOpen()`에서 예외 발생 → 호출 비활성화 (함수 정의는 보존).
- Rebuild 메뉴 항목 제거 (스크립트 편집기 직접 실행으로 전환).

## 6. Import 완료 alert 개선
- 진행률(%)은 구현하지 않기로 함 (실시간 상태 전달은 폴링 구조가 필요해 복잡도 대비 실익 낮다고 판단).
- 대신 완료 후 요약 표시: 전체/성공/실패 건수 + 필수 필드별 valid/missing 카운트 + Date 컬럼 텍스트 보존 여부.
- `CONFIG.VALIDATION_SUMMARY_EXCLUDE`로 "Company / Account" 필드와 IC/Won Date 컬럼은 alert 표시에서만 제외
  (검증/서식 강제 로직 자체는 그대로 유지).
- 완료 문구: `"{valid} / {total} 레코드 업데이트 완료" + ... + "Master 🏗️Append를 실행해주세요."`

## 7. OPS 정리 (일부)
- `OPS.ROWS = { HEADER: 1, DATA_START: 2 }` 추가, `writeOPS()`가 이를 참조하도록 수정.
- `mergeOPS()` 중복 이메일 처리, `applyOPSStyle()` 하드코딩, `Leads_OPS_QA` 구현은 **모두 미해결로 보류**
  (자세한 내용: `operations-layer-leads-ops.md`).

## 8. 로컬 개발 환경 세팅
- Node.js v24.13.0 확인, `clasp` 3.3.0 설치.
- 기존 로컬 프로젝트 폴더(`crimson-lead-tracker`) 비우고 Marketing 2.0 스크립트로 재clone.
- git 초기화 + GitHub 원격 저장소(`Harry-sk-mkt/crimson-lead-tracker`) 연결, 최초 push 완료.
- `onOpen` 관련 syntax/runtime error 두 건 수정 (Report 메뉴 빈 항목 예외, Import.js 괄호 누락).

## 다음에 다룰 항목 (사용자 확인 후 진행)
- `mergeOPS()` 중복 이메일 처리 로직 재검토
- `applyOPSStyle()` 하드코딩 정리 여부
- `Leads_OPS_QA` 구현 시점 (프로토타입 검증 후)
- Engineering Constitution Article 8 다이어그램 텍스트 수정 (Loader → RawWriter/SheetWriter)
- UX/언어 최적화 (구체 범위 미정 — alert 문구, 다이얼로그 UI 등 중 확인 필요)

## 2026-07-21 (추가) — TDD 원칙 도입 시점 명시

- `CLAUDE.md`에 TDD 원칙 추가 (새/수정 함수는 WHY 주석 + `testXXXX()` 테스트 함수 동반).
- **적용 범위: 이 시점(2026-07-21) 이후 신규 작성/수정되는 함수부터.**
  이전에 작성된 기존 함수(`appendSheetRecords`, `buildValidationSummary_`, `sortSheetByDate` 등)에
  소급 적용하지 않음 — 필요 시 향후 해당 함수를 수정하는 시점에 테스트를 추가한다.

  ## 2026-07-21 (계속) — OPS 중복 이메일 로직 확정 및 정리

### mergeOPS() — 중복 이메일 처리 로직 확정
- **결정**: 이메일별로 그룹핑 후 실제 `Create Date`를 비교하여 **가장 오래된(진짜 First Touch) 레코드만 유지**,
  나머지는 duplicate로 분류. 기존엔 시트 순서(Master가 Create Date 내림차순 정렬되어 있어 사실상 "가장 최근"
  레코드가 남는 구조)에 의존했던 버그를 바로잡음.
- **Tie-break 규칙**: 같은 이메일에 완전히 동일한 Create Date가 여러 건 있는 경우, 배열 순서상 먼저 나온 것을
  유지 (별도 tie-break 로직 추가하지 않기로 결정 — 실무적으로 문제없다고 판단).
- **로그**: 제외된 duplicate 건은 `Logger.log`에 `Email / 제외된 Lead ID / Create Date / 남긴 Lead ID`로 기록
  (QA 시트 대체용, `Leads_OPS_QA` 구현 전까지 유지).
- **검증**: 단위 테스트(`testMergeOPS_EarliestWins`) PASS + 실제 데이터 35,529건 중 47건 duplicate 확인,
  샘플 검증 결과 모두 가장 이른 날짜가 정확히 유지됨.
- **보류 항목**: IC Request(SAL)의 `#touches`(터치 횟수) 지표는 별도 논의 필요 — 이번 dedup 로직과 무관하게
  추후 별도 구현 시 재논의.

### applyOPSStyle() 하드코딩 정리 완료
- 헤더/데이터 행 번호(`1`, `2`) → `OPS.ROWS.HEADER`/`OPS.ROWS.DATA_START` 참조로 교체 완료.

### 디버그 로그 제거
- `buildLeadsOPS()`에 남아있던 `Logger.log(result)`, `Logger.log(result.rows)` 등 35,000+건 전체를
  로그에 찍으려던 디버그 코드 제거. "Logging output too large" 및 불필요한 실행 시간 증가의 원인이었음.

### clasp run-function — 보류
- 터미널에서 Apps Script 함수를 직접 실행하는 방법(`clasp run-function`) 확인함. 별도 OAuth Client,
  API Executable 배포, Cloud Project ID 연결 등 설정 부담이 커서 **당분간 도입 보류**.
  Apps Script 편집기에서 함수 선택 후 직접 실행하는 기존 방식 유지.

  ## 2026-07-21 (계속) — IC Funnel Sync 최초 실행 검증 완료

- `syncICFunnelToOPS()` 최초 실행: 3,139건 중 3,127건 정상 반영, 12건 "Not found in Leads_OPS".
- 12건 원인 확인 완료 — 버그 아님:
  - 10건: mergeOPS()의 중복 이메일 제외 로직으로 Leads_OPS에 의도적으로 없는 Lead ID
  - 2건: Salesforce에 2026-07-20 새벽 생성된 최신 Lead — 아직 weekly export에 미포함,
    다음 Leads Import 시 자동 반영 예정
- `08_ICFunnelSync.gs`(구 24_) — getHeaderMap() 0-based index를 falsy 체크(`!leadIdCol`)로
  잘못 판단하던 버그 수정 (Lead ID가 0번째 컬럼일 때 실패하던 문제).

  ## 2026-07-21 (계속) — ACQ Report (Engine + Summary) 구현 완료

### 설계 확정 사항
- 시트: 기존 `ACQ_REP` 시트 재사용 (Report Area A4:N + Control Area A1:E1)
- Start/End FY·Month를 별도 드롭다운 4개로 분리 (기존 "FY26 JUL" 통합 드롭다운의 스크롤 문제 해결),
  FY 목록은 실제 데이터 기준 동적 계산
- Generate Report는 E2 체크박스 + `onEdit` Simple Trigger 방식
- Engine(월×세그먼트 조합)은 매번 선택된 Start~End FY 구간만 재생성 (전체 기간 아님, 성능 목적)
- % 계산식: All P1% = All P1/All Leads, New Leads% = New Leads/All Leads, New P1% = New P1/New Leads

### 성능 재설계 — ACQ Summary (Aggregate Table) 도입
- 최초 구현(원본 Master/OPS 매번 전체 스캔)이 선택 기간을 좁혀도 여전히 느려서, 별도 `ACQ_Summary` 숨김 시트에
  전체 (FY|Month|Segment) 조합별 지표를 미리 계산해두는 방식으로 재설계.
- `refreshACQSummary_()`가 Append/Rebuild/Sync 5개 함수 완료 시 자동 호출되어 항상 최신 유지.
- 결과: 리포트 조회가 수십 초 → 1초 이내로 개선.

### SAL 데이터 소스 확정
- 새 `SALs_Raw` 시트 안 만들고, 기존 MTA CSV export에 `Lead: Lead Record Type`(값: MQL/SAL) 컬럼만 추가 요청하는 것으로 단순화.
- MTA 전체(81,907건) 재수출/재Import/Full Rebuild 완료, `Lead Record Type` 필드 반영 확인됨.

### IC Funnel Sync 구축 및 검증
- 새 `ICFunnel_Raw` 시트 + `syncICFunnelToOPS()` 구현 — 별도 Lead 리포트(IC Booked/Completed/Won Date 중
  하나라도 해당 주에 걸리면 잡히는 필터, 2018~현재 히스토리 백필용 최초 추출)로 Leads_OPS의 Funnel 4개 필드만 역동기화.
- `OPS.SF_COLUMNS`에서 IC Booked/Completed/Won/Revenue를 빼서 `OPS.SYNC_COLUMNS`로 재분류
  (mergeOPS()가 더 이상 이 필드들을 Master의 stale 값으로 덮어쓰지 않도록).
- 최초 실행: 3,139건 중 3,127건 반영, 12건 "Not found" — 10건은 mergeOPS 중복 제외 로직으로 의도적으로 없는 Lead,
  2건은 아직 weekly export에 안 잡힌 최신 Lead(2026-07-20 생성)로 확인, 전부 정상.

### Attribution 불일치 발견 및 보류
- All Leads/All P1/SAL(MTA_Master 소스)은 Last Touch 기준 Segment, New Leads/New P1/IC Booked/Complete/Revenue
  (Leads_OPS 소스)는 First Touch 기준 Segment로 서로 다름. 기존 설계 문서(business-segment-classification.md)와
  일치하는 의도된 차이. SAL을 First Touch로 통일할지는 이번엔 보류 (추후 파이프라인/리포트 단계에서 논의 예정).

### 디자인 (32_ACQReportStyles.js)
- % 컬럼 소수점 1자리 %표기, Revenue 천단위 콤마, 전체 테두리, 짝수 행 배경색(#F3F3F3) 적용.

### 트러블슈팅 히스토리 (자세한 내용은 docs/ACQReportImplementation.md 참고)
- `endIndex` 세그먼트 블록 계산 누락, `targetRows` 변수 삭제 사고, Report Area 코드 중복(mtaAgg/opsAgg 구버전 잔존),
  `computeMTAAggregates_`/`computeOPSAggregates_`의 null range 처리 누락, `CONFIG.ACQ.SUMMARY_SHEET` 로컬-서버
  동기화 불일치로 인한 반복적인 신규 시트 생성 버그, `split_csv.js`가 실수로 Apps Script 프로젝트에 push되어
  전체 프로젝트 파싱이 깨졌던 사고(`require is not defined`), Apps Script의 `_` 접미사 함수 Run 드롭다운 미노출 관례.
- 교훈: **서버(Apps Script 편집기)에서 직접 코드를 수정하지 말 것 — 항상 로컬에서 수정 후 push.**
  Node 전용 유틸리티 스크립트는 프로젝트 폴더 밖에 두거나 `.claspignore`로 제외할 것.

# Changelog — 2026-07-22

## 1. MTA Funnel Sync 재검증 (09_MTAFunnelSync.js)
- `rebuildLeadsMaster()`/`rebuildMTAMaster()`/`buildLeadsOPS()`/QA 재실행 완료, `24_OPSQA.js`의 QA
  Dashboard에서 `#Won`(OPS 3093 vs MTA 2875, +218) / `Total Revenue`(OPS가 +415만 많음) 역방향 불일치 발견.
- 원인: 삭제된 구버전 `08_ICFunnelSync.js`(ICFunnel_Raw 기반) 시절 잔존 데이터로, 현재 `MTA_Master`에는
  대응 레코드가 없는 219건 (전부 category A: MTA_Master에 Lead ID 자체가 없음, 파싱 버그 아님).
  `syncMTAFunnelToOPS_()`는 값이 있을 때만 채워넣고 지우지 않으므로 안전하게 보존됨 — 버그 아님, 정상.

## 2. Business Segment 리네이밍
- `Event Offline` → `Seminar`, `Event Online` → `Webinar` (분류 조건 변경 없음, 표시 이름만 변경).
- 변경 파일: `16_TransformHelper.js`(`getBusinessSegment()`), `00_Config.js`(`CONFIG.ACQ.SEGMENTS`),
  `docs/BusinessSegmentClassification.md`, `30_ACQReport.js` 주석.
- **주의**: Master 재생성(`rebuildLeadsMaster()`/`rebuildMTAMaster()`) 전까지는 기존 데이터에 구 이름이 남아있음.

## 3. ACQ Report "All Leads" 월별 집계 근본 한계 발견
- `Last MKT UTM Campaign`이 Salesforce Lead 객체의 **현재 최종 상태 필드**임을 실데이터로 확인
  (Lead `00Q7F00000VePrO`의 2020~2026년 여러 터치를 Salesforce에서 각각 필터링해도 전부 동일한 최신 캠페인).
  터치 시점의 채널 정보를 전혀 보존하지 않음.
- 영향: `MTA_Master`는 터치 단위(1 Lead=N Row)인데 `Business Segment`는 Lead 레벨 필드라 한 Lead의
  모든 터치 row가 항상 동일 Segment를 가짐 → 월별 Segment 집계가 "그 달의 실제 채널"을 의미하지 않음.
- **결정**: 리포트/코드 수정 없음. 한계를 `docs/ACQReportDesign.md`에 명시하는 것으로 마무리
  (Lead 단위 dedup 재설계도 검토했으나, Segment 자체가 터치 시점 정보를 못 담으므로 근본 해결 안 됨).

## 4. MTA_Master 중복 append 의심 (미해결, TODO)
- `findDuplicateTouchRows_()`(`24_OPSQA.js`)로 같은 Lead ID+같은 MTA Created Date 조합 3,401개 그룹,
  extra row 4,139건 발견. MTA_Raw 원문 확인 결과 애초에 시간 정보가 없는 날짜 단위 데이터라, 같은 날
  여러 정상 터치인지 실제 재export로 인한 중복 append인지 현재 필드로는 구분 불가.
- CLAUDE.md "현재 알려진 미해결 항목" 3번으로 TODO 유지.

## 5. Leads_OPS 짝수 행 배경색(Row Banding) 추가
- `20_OPS_Styles.js`에 `computeRowBandingColors_()` 추가, 짝수 행에 `#F3F3F3` 배경 — 컬럼 많은 행을
  옆으로 읽을 때 row 경계 구분 목적. 35,000+ 행이라 `setBackgrounds()` 배치 호출로 구현 (개별 호출 지양).

## 6. Leads_OPS ↔ Master 자동 Sync 연결
- `appendNewLeads()` → `buildLeadsOPS(true)`(QA 생략) 자동 호출 추가.
- `appendNewMTA()` → `syncMTAFunnelToOPS_()` 자동 호출로 대체 (기존 `refreshACQSummary_()` 단독 호출 제거,
  `syncMTAFunnelToOPS_()`가 내부에서 이미 호출하므로 중복 방지).
- 배경: "IC Requested 체크 후 다음 수동 sync 전까지 IC Booked Date가 안 보인다"는 실무 갭 해소 목적.
  MTA sync는 Lead가 이미 Leads_OPS에 있어야 하지만, 매번 전체 재계산이라 순서가 뒤바뀌어도 다음 사이클에
  자동으로 따라잡힘 (self-healing) — 두 담당자가 다른 날 독립적으로 import해도 무방.
- 자세한 내용: `docs/OperationsLayer.md` "자동 Sync 연결" 섹션.

## 7. IC Request Tracking 구현 (재신청 이력 보존)
- `20_OPS_Config.js`: `IC Requested` 옆에 `Last IC Requested Date`, `Total IC Requests` 컬럼 추가.
  `IC Requested`는 `MANUAL_COLUMNS`에서 제외 — `OPS.IC_REQUEST`(CHECKBOX/COUNTER)로 특수 관리.
- `22_OPS_Merge.js`: `applyICRequestTracking_()` 추가. 매 merge마다 기존 `IC Requested`가 true였으면
  `Total IC Requests` +1 후 리셋. 추가로 `IC Booked Date`가 있는데 카운트가 0이면 1로 하한 보정
  (트래킹 도입 이전 기존 Booked 이력 백필 + 체크박스 없이 booked되는 예외 케이스 커버).
- `20_OPS_Styles.js`: `Last IC Requested Date` 날짜 서식(yyyy-mm-dd) 추가.
- 자세한 내용: `docs/OperationsLayer.md` "IC Request Tracking" 섹션.

## 8. MTA Business Segment 필드 근본 수정 — "Last MKT UTM Campaign" → "MKT UTM Campaign"
- **배경**: 3번 항목에서 "Salesforce 데이터 모델 자체의 한계"로 결론 냈던 것을, 사용자가 같은 날 오후
  Salesforce 리포트 추출 필드를 `Last MKT UTM Campaign`(Lead 객체 레벨) → `MKT UTM Campaign`
  (Multi Touch Attribution 객체 자체 필드)로 교체해서 실제로 해결함. 후자는 터치별 실제 캠페인 값이 찍힘.
- `13_MTATransformer.js` v5.0.0: `getBusinessSegment()` 입력 필드 교체, Master 컬럼명도
  `Last MKT UTM Campaign` → `MKT UTM Campaign`로 개명 (더 이상 "Lead의 최종 터치"가 아니므로).
- `24_OPSQA.js`의 진단 함수들(`runInvestigateSegmentMonthAnomaly`, `runSampleDuplicateRawDates`)도
  새 필드명으로 업데이트.
- ⚠️ **`appendSheetRecords()`(`05_SheetWriter.js`) 주의**: 기존 데이터 있는 시트에 append할 때 **시트에
  이미 있는 헤더만 기준으로 컬럼 매칭**. `MTA_Raw` 헤더에 `MKT UTM Campaign`이 없으면 새 CSV의 이
  컬럼이 조용히 드롭됨. 재추출 CSV를 새 헤더 포함해서 다시 쌓아야 함.
- **결정**: 과거 82,000+ 터치까지 정확한 Segment로 바로잡기 위해 **전체 재추출 + 재구축** 진행하기로 함
  (부분 적용— MTA_Raw 헤더만 추가하고 신규 터치부터만 적용 — 대신 선택).
  절차: MTA 전체 리포트 재추출(`MKT UTM Campaign` 포함) → `MTA_Raw`/`MTA_Master` 시트 내용 수동 삭제 →
  `99_ResetRawMaster.js`의 `resetMTACounterOnly()` 실행 → "Import MTA"로 전체 CSV 재업로드 →
  `rebuildMTAMaster()` 실행 (`refreshACQSummary_()` 자동 포함) → `buildLeadsOPS()`로 OPS도 갱신.
- 자세한 내용: `docs/BusinessSegmentClassification.md` "필드 변경 이력", `docs/ACQReportDesign.md`
  "All Leads/SAL — Segment 한계 해결됨" 섹션.

## 다음에 다룰 항목
- MTA 전체 재추출 + 재구축 실행 대기 (7번 항목 절차).
- `Total Touches`(MTA_Master 기준 터치 횟수) 컬럼 — Leads_OPS `Revenue Actual`과 `Notes` 사이(T/U열 사이)에 추가. 아직 미구현.
- "Other" 세그먼트 중 Upsell 비중 조사 — `runInvestigateOtherSegmentComposition()`(`24_OPSQA.js`) 구현 완료,
  실행 결과 확인 대기.
- MTA_Master 중복 append 의심(4번 항목) — 여전히 미해결, CLAUDE.md TODO 3번 참고.