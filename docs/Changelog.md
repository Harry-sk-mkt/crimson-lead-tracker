# Changelog — 2026-07-24 (Events_OPS/Events_Engine 구현)

## NewP1 Report — 삭제 사고 → 재구성 → origin 실제 기록 발견으로 대체 (경위 기록)

**사고**: `40_NewP1Report.js`/Styles 파일/`00_Config.js`의 `CONFIG.NEWP1`/`30_ACQReport.js`의
`onEdit()` NewP1 분기가 이 로컬 checkout에선 한 번도 커밋된 적 없는 상태였는데, Events 작업 중
40번대 파일 번호가 겹친 걸 발견해 정리하다가(사용자가 6개 구 Events 파일을 지울 때 NewP1 파일도
같이 삭제) 사라짐. 추가로 이 세션에서 여러 번 실행한 `clasp push --force`가 `CONFIG.NEWP1`이
없는 로컬 `00_Config.js`로 원격을 덮어써, 설정 블록도 같이 사라짐(이 부분은 작업 방식의 문제).

**1차 대응(재구성, 이후 폐기됨)**: Apps Script 버전 기록엔 삭제 이전 시점이 없어, 사용자가 대화
중 공유해준 파일 원문 + 실제 `NewP1_REP` 시트 레이아웃을 근거로 `40_NewP1Report.js`/
`41_NewP1ReportStyles.js`(추정 파일명)/`CONFIG.NEWP1`/`isEffectiveP1_()`를 재구성해 동작 확인까지
했었음.

**실제로는 이미 origin/main에 진짜 원본이 있었음**: `origin push`를 시도하다 로컬이 origin/main과
7개 커밋 divergence 상태였다는 걸 발견 — "집에서 작업하던 걸 커밋 안 해서"로 추정했던 바로 그
작업이 실제로는 이미 정상적으로 커밋/푸시되어 있었음(`9b1a86a` NewP1_REP 구현, `43890e9` Week축
제거, `cb8fb85` MTA BOFU 버그 수정, `180b9ea`/`95396a8` ACQ_REP 이벤트 기준 개선,
`4d4afce` New P1 로직 통일 등). 이 진짜 원본은 재구성판보다 훨씬 완전했음:
- `isEffectiveP1_()`는 사실 `30_ACQReport.js`에 있었음(재구성판은 `40_NewP1Report.js`에 넣어서,
  origin 버전을 그대로 받으면 중복 선언 충돌이 날 뻔함).
- `13_MTATransformer.js`의 BOFU 분류 버그 수정은 origin 쪽이 회귀 테스트(`testTransformMTARecord_BOFU`)
  까지 포함한 상위호환 버전이었음(수정 내용 자체는 동일 — `diff`로 확인).
- `30_ACQReport.js`엔 ACQ_REP 자체의 개선사항(IC Booked/Complete/Revenue를 코호트가 아니라 실제
  이벤트 날짜 기준으로 전환, `docs/ACQReportDesign.md` 참고)까지 포함돼 있었음 — 재구성판엔 없던 부분.

**최종 결정(사용자 확인)**: `00_Config.js`/`13_MTATransformer.js`/`30_ACQReport.js`/
`40_NewP1Report.js`/`41_NewP1ReportStyles.js`는 origin(진짜 원본) 버전을 그대로 채택, 재구성판은
전부 폐기. `24_OPSQA.js`(IC Booked/Complete 불일치 진단 함수 3종 추가)와
`07_IncrementalMasterBuild.js`/`09_MTAFunnelSync.js`/`10_MasterBuild.js`(`refreshNewP1Engine_()`
호출 배선)는 이번 세션의 Events 관련 변경과 겹치지 않는 별도 영역이라 병합 시 양쪽 다 자동으로
합쳐짐(충돌 없음).

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

## 14. Events_REP 설계 착수 — Meta 데이터 소스 확인 대기 (미해결)

- 다음 리포트로 **Events_REP** 논의 시작: Business Segment 중 **Webinar/Seminar만** 대상,
  NewP1_REP과 달리 **All Leads부터** 퍼널을 그림 (P1 필터 없음), 여기에 마케팅 캠페인 성과를 연결해
  프로그램 자체의 실질 퍼포먼스(ROI)를 보는 목적.
- **소스 결정**: `MTA_Master` (사용자 선택) — "All Leads"가 이미 ACQ_REP에서 MTA_Master 기준
  용어이고, 터치별 `MKT UTM Campaign`이 이미 존재. 퍼널 지표(IC Booked/Complete/Won/Revenue)는
  `Leads_OPS`와 Lead ID로 join 필요 (`09_MTAFunnelSync.js`의 기존 매칭 로직 재사용 가능성 있음).
- **막힌 지점**: "마케팅 캠페인"이 Salesforce `MKT UTM Campaign` 라벨이 아니라 **Meta 광고
  플랫폼 자체의 퍼포먼스 데이터**(스펜드/도달/CTR 등으로 추정)를 붙여서 보고 싶다는 의미로 확인됨.
  이는 현재 파이프라인에 전혀 없는 새 외부 데이터 소스라, 다음 세션에서 먼저 확인 필요:
  1. Meta 광고 성과 데이터를 지금 어떻게 확보 중인지 (수동 CSV export? 기존 시트? 아직 없음?)
  2. Meta 캠페인과 Salesforce `MKT UTM Campaign` 간 join key(이름/ID 일치 여부)
  3. Meta 데이터의 시간 단위(일별/주별/캠페인 누적)
  4. 새 Import 파이프라인(`Meta_Raw` 등) 신설 필요 여부
- 코드 변경 없음 — 순수 논의만 진행, 사용자가 다른 대화창(claude.ai)에서 이어가기로 함.

## 다음에 다룰 항목 (2026-07-22 최종 갱신)
- ~~MTA 전체 재추출 + 재구축 실행 대기 (7번 항목 절차)~~ — 완료.
- ~~BOFU fix 반영 MTA_Master 재구축~~ — 완료 (82,421건 매칭 확인).
- **Events_REP 설계 이어가기 (14번 항목)** — Meta 광고 성과 데이터 확보 방식부터 확인 필요. 다음 세션 최우선.
- `Total Touches`(MTA_Master 기준 터치 횟수) 컬럼 — Leads_OPS `Revenue Actual`과 `Notes` 사이(T/U열 사이)에 추가. 아직 미구현.
- "Other" 세그먼트 중 Upsell 비중 조사 — `runInvestigateOtherSegmentComposition()`(`24_OPSQA.js`) 구현 완료,
  실행 결과 확인 대기.
- MTA_Master 중복 append 의심(4번 항목) — 여전히 미해결, CLAUDE.md TODO 3번 참고.
- NewP1_REP: Segment가 실제 데이터 있는 조합만 sparse하게 표시됨(전체 7개 고정 표시 아님) —
  사용자가 "지금 급하지 않다"고 확인, 필요 시 재검토.

# Changelog — 2026-07-22 (계속, 오후)

## 9. 로컬 개발 환경 재구축 (신규 머신)
- 새 환경에 Git 미설치 상태 확인 (winget도 미설치) → Git for Windows 인스톨러 직접 다운로드해 무인 설치.
- 기존 로컬 `crimson-lead-tracker` 폴더(스텁 상태, `.gs` 확장자, 문서 없음)를
  `crimson-lead-tracker-backup-20260722`로 백업 후, GitHub(`Harry-sk-mkt/crimson-lead-tracker`) clone으로 교체.
- `clasp` 재설치 + 로그인(`h.yun@crimsoneducation.org`) 재인증.
- GitHub push 인증: 이 세션의 브릿지된 터미널은 상호작용이 비활성화되어 있어 Git Credential Manager의
  브라우저 로그인을 못 띄움 → 사용자가 별도의 일반 터미널에서 직접 `git push` 실행해 해결.

## 10. MTA_Raw 재추출 시 "Lead: Lead ID" 컬럼 누락 발견 + 재조치
- 사용자가 새로 다운로드한 MTA raw CSV(`report1784693554195.csv`, 82,421행)에 `Lead: Lead ID` 컬럼
  자체가 없음 발견. `CONFIG.REQUIRED_FIELDS.MTA`가 이 필드를 필수로 요구해서 전체 레코드가
  invalid 처리 → `MTA_Raw`에 0건 기록 (에러 없이 "성공"으로 끝나 원인 파악에 로그 확인 필요했음).
- 원인: Salesforce 리포트 재추출 시 필드 설정 누락으로 추정 (재현 조건 불명, 일회성 사용자 실수로 판단).
- 조치: `Lead: Lead ID` 포함해서 재추출(`report1784695873625.csv`) → `google.script.run` 페이로드
  크기 문제 방지를 위해 Node 스크립트(`split_csv.mjs`, 프로젝트 폴더 밖 scratchpad에 위치 —
  gotcha #3 원칙 준수)로 CSV를 quote-aware하게 정확히 2등분(41,211 / 41,210행, 헤더 포함) →
  `MTA_Raw`/`MTA_Master` 시트 전체 삭제 → `resetMTACounterOnly()` → 두 파일 업로드 → `appendNewMTA()`.
- 결과: 82,421건 전체 매칭 확인, `MTA_Master` 재생성 완료.

## 11. MTA BOFU Business Segment 버그 발견 + 수정
- 사용자가 ACQ_REP에서 BOFU가 항상 0으로 나오는 것을 확인, 원인 조사.
- `13_MTATransformer.js`의 `getBusinessSegment()` 호출에서 `detail` 인자가 하드코딩된 `""`였음
  (10번 항목의 MTA 전체 재구축과 무관하게 이전부터 존재하던 별개 버그). BOFU 판정 조건은
  `detail.includes("bofu")` 단독이라 campaign 기반 fallback이 없어 구조적으로 절대 나올 수 없었음.
- Leads_Master 쪽(`12_LeadTransformer.js`)은 원래부터 정상적으로 detail을 넘기고 있어 영향 없음
  (Leads/MTA 분류 로직은 원래도 소스 필드가 다르게 분리되어 있었음 — First Touch vs Per-Touch).
- 사용자 확인: MTA 리포트의 `Lead Source Detail`은 `Lead:` prefix가 없어 Multi Touch Attribution
  객체 자체 필드로 판단 (샘플 검증, 100% 확정은 아님).
- 수정: `13_MTATransformer.js` v5.1.0, `""` → `rawRecord["Lead Source Detail"]`.
  회귀 테스트 `testTransformMTARecord_BOFU()` 추가. `clasp push --force`(manifest 변경 확인 필요)로 배포,
  git 커밋(`cb8fb85`) + GitHub push 완료.
- 반영을 위해 `MTA_Raw`/`MTA_Master` 재삭제 → `resetMTACounterOnly()` → 재Import → `appendNewMTA()` 재실행 중.
- 자세한 내용: `docs/BusinessSegmentClassification.md`, `docs/ACQReportDesign.md`.

## 12.5. IC Booked/Complete Event 기준 검증 + 헤더 Note 추가
- `24_OPSQA.js`에 `runDiagnoseICCompleteMismatch()`(Leads_OPS vs MTA_Master 재계산값 대조)와
  `runBreakdownICCompleteByBookedMonth()`(이번 달 Complete 건을 Booked 월별로 분해) 진단 함수 추가,
  일시적으로 `✅ QA` 메뉴에 걸어 실행 확인 후 메뉴에서 제거(진단 함수 자체는 파일에 보존).
- 검증 결과: IC Booked(41)/IC Complete(43) 전부 정상 — sync 로직 버그 없음. Complete가 Booked보다
  많은 건 5~6월에 Booked된 상담이 7월에 Complete된 백로그(재부킹 등) 때문으로 확인, 정상 동작.
- `32_ACQReportStyles.js` v1.4.0: `annotateACQReportMetricNotes_()` 추가 — `ACQ_REP` 헤더 K/L/M/N
  (SAL/IC Booked/IC Complete/Revenue) 셀에 날짜 기준을 Note로 남겨, 코호트/이벤트 기준 혼동 방지.
  `applyACQReportStyles_()`가 매 리포트 생성마다 자동 호출하므로 항상 최신 유지.

## 12.6. NewP1_REP 설계 확정 + ACQ_REP New P1 로직 통일
- 사용자가 `docs/NewP1ReportDesign.md`에 NewP1_REP(New P1 Cohort Funnel Report) 설계를 직접 정리 —
  소스는 `Leads_OPS` 단일, 코호트는 `Create Date` + 유효 Priority(`Priority Override` 우선 →
  `Lead Priority`, exact match `"Priority 1"`), SAL 판정은 `Total IC Requests` > 0(MTA 무관),
  Won 판정은 `Revenue` > 0, Row는 FY>Month>Fiscal Week>Segment flat 구조(소계 없음), Engine과
  Summary를 `NewP1_Engine` 한 시트로 통합. 리뷰 결과 Article 번호 인용/실제 함수 동작 모두 정확함 확인.
- 리뷰 중 발견: ACQ_REP의 New P1(`computeOPSAggregates_()`)이 `Priority Override`를 무시하고
  `Lead Priority`에 `indexOf("1")`(substring)로 느슨하게 비교하고 있어, NewP1_REP 설계(exact match +
  Override 우선)와 기준이 달랐음. 사용자 확인 후 **ACQ_REP의 New P1도 같은 기준으로 통일** —
  `isEffectiveP1_()` 신규 추가(`30_ACQReport.js` v1.5.0), 테스트 `testIsEffectiveP1()` 포함.
  All P1(MTA_Master 기반)은 `Priority Override` 컬럼 자체가 없어 대상 아니고 기존 로직 유지.
- NewP1_REP 구현은 다음 세션 대기 (`40_NewP1Report.js`/`41_NewP1ReportStyles.js`/`CONFIG.NEWP1` 신규 예정).

## 13. NewP1_REP 구현 완료

- `docs/NewP1ReportDesign.md` 설계 그대로 구현: `40_NewP1Report.js`(Engine + Aggregates + Report 생성),
  `41_NewP1ReportStyles.js`(서식), `00_Config.js`의 `CONFIG.NEWP1` 신규.
- **Cohort 정의**: `Leads_OPS` 단일 소스, Create Date 구간 + 유효 Priority(`Priority Override` 우선 →
  `Lead Priority`, exact match `"Priority 1"`, `isEffectiveP1_()` 재사용).
- **Engine**: `NewP1_Engine` 숨김 시트 하나에 Engine(조합/Sort Index)과 Summary(사전 집계)를 통합
  (ACQ_REP은 이 둘이 분리돼 있으나, NewP1은 매번 전 기간을 사전 집계하므로 합쳐도 무방 — 설계 문서 §6).
  `refreshNewP1Engine_()`을 `refreshACQSummary_()`가 호출되는 모든 지점(`appendNewLeads()`,
  `syncMTAFunnelToOPS_()`, `rebuildLeadsMaster()`, `rebuildMTAMaster()`)에 나란히 추가.
  `runRefreshACQSummary()`(수동 전용 래퍼)는 건드리지 않음 — `runRefreshNewP1Engine()`을 별도 제공.
- **Row 구조**: FY > Month > Fiscal Week(`getWeek()` 재사용, 8/1=W01 시작) > Segment, flat(소계 없음).
  Week가 Month 경계와 무관하게 파생되어 같은 Week 번호가 다른 두 Month 아래 나뉘어 나타날 수 있음
  (의도된 동작). 이 때문에 ACQ_REP처럼 고정 blockSize로 월 블록을 나눌 수 없어, `reverseNewP1MonthBlocks_()`는
  FY/Month 값이 실제로 바뀌는 지점을 경계로 판단하도록 별도 구현 (ACQ의 `reverseMonthBlocks_()`와 다른 방식).
- **onEdit 통합**: GAS는 전역 함수명이 파일 간 중복되면 나중에 로드된 정의가 조용히 덮어써서, `onEdit()`을
  파일마다 따로 두면 안 됨. `30_ACQReport.js`의 기존 `onEdit()`을 시트 이름 분기 방식으로 리팩터링해서
  `handleACQReportGenerateEdit_()`(기존 로직 그대로 이동)와 `handleNewP1ReportGenerateEdit_()`(신규)를
  각각 호출하도록 변경 — ACQ_REP 동작 자체는 변경 없음.
- **최초 시트 세팅**: ACQ_REP과 달리 사전에 수동으로 만들어둔 헤더가 없어서, `setupNewP1Report()`가
  시트 생성 + Control Area 헤더(Start FY/Start Month/End FY/End Month/Generate Report) + Report Area
  헤더(14개 컬럼) + 드롭다운까지 한 번에 세팅하도록 구현. 편집기에서 1회 수동 실행 필요.
- 신규 pure 함수(`deriveNewP1Cohort_`, `computeNewP1SortIndex_`, `reverseNewP1MonthBlocks_`)는
  전부 `testXXXX()` 회귀 테스트 동반 (TDD).
- 리뷰 중 발견해 같이 처리한 항목: ACQ_REP New P1 로직 통일 (별도 §12.6 기록).

## 13.5. NewP1_REP — Week 축 제거, 줄무늬 배경 Weekly 실험 후 원복
- 사용자가 실제 화면 확인 후 `getWeek()`(8/1 기준 7일 단위 Fiscal Week)이 캘린더 주(월~일)와
  무관함을 확인 — 매년 8/1 요일이 달라(FY26=금요일, FY27=토요일) Week 시작 요일이 매년 바뀜.
  캘린더 주로 오인하기 쉬워 혼동 유발 → **Week 축을 리포트에서 완전히 제거**하기로 결정.
- Row 구조를 FY > Month > Fiscal Week > Segment → **FY > Month > Segment**로 단순화
  (ACQ_REP과 동일 계층). Report Area 14 → 13컬럼, Engine 11 → 10컬럼.
  `computeNewP1SortIndex_()`에서 Week 슬롯 제거(ACQ의 `computeSortIndex_()`와 동일한 형태로 단순화).
  `deriveNewP1Cohort_()`도 Week 계산 제거. `CONFIG.NEWP1.MAX_WEEKS`는 제거하지 않고 보존(향후 재도입 대비).
- 이 변경 직전에는 "줄무늬 배경을 Monthly → Weekly 기준으로" 요청받아 `41_NewP1ReportStyles.js`
  v1.1.0에 반영했었으나, Week 축 자체가 사라지면서 v1.2.0에서 자연스럽게 FY+Month 기준으로 복귀.
- `docs/NewP1ReportDesign.md`는 원래 Week 포함 설계 텍스트를 삭제하지 않고 "원래 설계(배경 기록)"
  섹션으로 보존, 위에 변경 사유를 명시하는 방식으로 갱신.

## 12. 리포트 설계 가드레일 재확인 — 향후 NewP1_REP 등 확장 리포트 주의사항
- 사용자가 향후 만들 New P1 Funnel 리포트(`NewP1_REP`, 미구현)가 `Leads_Master`를 직접 읽으면 안 된다는
  점을 미리 확인. `Leads_Master`는 append-only라 갱신된 상태(Business Segment 재분류 등)를 반영 못 함.
  기존 원칙(`docs/OperationsLayer.md`: "향후 모든 리포트는 Leads_Master가 아닌 Leads_OPS를 읽어야 한다")과
  일치 — 코드 변경 없음, 향후 구현 시 지킬 가드레일로 기록.
- 참고로 `IC Booked Date` 등 `OPS.SYNC_COLUMNS`는 애초에 `Leads_Master`를 거치지 않고
  `syncMTAFunnelToOPS_()`가 `MTA_Master`에서 직접 `Leads_OPS`로 쓰기 때문에 이 문제와 무관 (이미 안전).