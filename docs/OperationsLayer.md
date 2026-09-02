# Operations Layer — Leads_OPS

## Overview
`Leads_OPS`는 마케팅 팀이 사용하는 working database다. 주간 Salesforce snapshot인 `Leads_Master`와 달리,
`Leads_OPS`는 마케팅 운영 데이터와 수동 QA 결과를 영구 보존한다.
Salesforce export가 weekly라서 실무 시트와 싱크가 어긋나는 문제를 해결하기 위한 **Salesforce ↔ 실무 사이의 중간 시트**.

향후 모든 리포트(Acquisition, Conversion, Dashboard, Weekly Metrics)는 `Leads_Master`가 아닌 `Leads_OPS`를 읽어야 한다.

> ⚠️ **2트랙 아키텍처 예외 (2026-07-28 추가, CLAUDE.md #7)**: 위 원칙은 **리드~세일즈
> 액티비티 레이어**(New Leads/New P1/SAL/IC Request/IC Booked/IC Complete)에 한정된다.
> **Opportunity/Revenue 레이어**(`#Deals`/`Revenue`)는 `Leads_OPS`가 아니라 **Deal
> Tracker**(`[KOR] Deal Tracking`)를 Source of Truth로 삼는다 — `Leads_OPS` 개별 리드
> 매칭이 상담 후 학부모 이메일 변경으로 구조적으로 신뢰 불가하다는 게 확인됐기 때문
> (Target_REP 개발 중 발견). 적용 대상: ACQ_REP(Revenue), Events_OPS/BOFU_OPS/
> Content_OPS(`#Deals`/`Revenue`), Target_REP(전체 Revenue/딜 비중). **예외의 예외**:
> `NewP1_REP`의 Won/Revenue(리드 단위 코호트 지표)와 `Search_OPS`의 `#Deals`/`Revenue`
> (raw UTM 그레인이 Deal Tracker의 프로그램 단위 매칭 필드와 안 맞음)는 구조적 이유로
> 그대로 `Leads_OPS` 기준 유지. 상세: `docs/Changelog.md` 2026-07-28.

`Leads_OPS`는 레거시였던 "Operational Sheets(Lead Tracker/SAL/IC/FTA)" 개념을 대체하는 현재 운영 레이어다.

## Data Flow
```
Salesforce → Import → Leads_Master (주간 Snapshot) → Leads_OPS (Email 기준 Merge)
  → Reports (Acquisition / Conversion / Dashboard / Weekly Metrics)
```

## Purpose

|  | Leads_Master | Leads_OPS |
| --- | --- | --- |
| 성격 | Salesforce Source of truth | 영구 운영 데이터베이스 |
| 갱신 | 매 주간 임포트마다 rebuild/append | 임포트 간 수동 편집 보존 |
| 편집 | 수동 편집 금지 | 마케팅 전용 정보 저장 |
| 역할 | - | 리포팅 소스 |

## Synchronization Logic — Primary Key = Email
Email은 마케팅 팀이 사용하는 운영 조회 키다. Salesforce의 lead 중복/데이터 품질 문제로
중복 이메일이 존재할 수 있어, merge 전 중복 이메일 검증이 필요하다.

참고: Lead_Tracker(구버전)의 Primary Key는 Lead ID였으나, Leads_OPS에서는 **Email**로 변경됨.

## Build Process
```
1. Leads_Master 읽기
2. 기존 Leads_OPS 읽기
3. Email Lookup Map 생성
4. Leads_Master 내 중복 이메일 검증
5. 유효 레코드 Merge
6. 새 Leads_OPS 쓰기
7. QA Report 생성 (⚠️ 미구현 — 아래 참고)
```

## 자동 Sync 연결 (2026-07-22 추가)

`buildLeadsOPS()`와 `syncMTAFunnelToOPS_()`는 원래 완전 수동 실행(메뉴 없음, 편집기에서만)이었는데,
"IC Requested를 마케팅이 체크해도 다음 수동 sync 전까지 IC Booked Date가 안 보인다"는 실무 갭 때문에
Append 함수에 자동 연결함 (`07_IncrementalMasterBuild.js`):

- `appendNewLeads()` → Master append 직후 **`buildLeadsOPS(true)`**(QA 생략) 자동 호출.
  신규 Lead가 지체 없이 Leads_OPS에 들어와야, 이후 그 Lead의 MTA 터치가 sync 대상이 될 수 있음.
- `appendNewMTA()` → 기존 `refreshACQSummary_()` 호출을 **`syncMTAFunnelToOPS_()`**로 대체
  (그 함수가 끝에서 이미 `refreshACQSummary_()`를 호출하므로 중복 계산 방지).

**의존성 순서**: MTA sync는 그 Lead가 이미 Leads_OPS에 있어야 성공한다 (없으면 "Not found in
Leads_OPS"로 조용히 skip). 하지만 `syncMTAFunnelToOPS_()`는 호출될 때마다 `MTA_Master` 전체를
재계산하므로, 이번 주 순서가 뒤바뀌어도(MTA 담당자가 Leads 담당자보다 먼저 import) **다음 MTA
sync 때 자동으로 따라잡힌다** (self-healing, 최대 1 사이클 지연). 두 담당자가 서로 다른 날 독립적으로
작업해도 무방함 — 요일을 맞출 필요 없음.

**QA 미실행 트레이드오프**: 자동 트리거 경로는 QA(~77s)를 생략한다. 정합성 전체 점검이 필요하면
메뉴("✅ QA → Run Leads_OPS QA") 또는 `buildLeadsOPS()`(파라미터 없이)를 편집기에서 수동 실행.

## IC Funnel Sync — Lead 레벨 전용 별도 파이프라인 (2026-08-26 재도입)

`syncMTAFunnelToOPS_()`는 MTA_Master(터치 단위)에서 Lead ID별 대표 터치를 뽑아 Leads_OPS로
역동기화하지만, IC Booked/Completed/Opportunity Won Date는 Lead 레벨 스냅샷이라 **그 리드에
새 마케팅 터치가 없으면 Salesforce 쪽 상태가 바뀌어도 영원히 반영이 안 되는 구조적 공백**이
있었다(IC Booking/Completion은 대부분 터치 없이 세일즈 내부 프로세스로만 진행됨) — ACQ_REP IC
Booked/Complete 구조적 과소집계의 근본 원인(`docs/OpenItems.md` #32).

이 3개 필드만 전담하는 `syncICFunnelToOPS_()`(`MASTER_009_ICFunnelSync.js`)를 재도입 —
`ICFunnel_Raw`(Append 전용, Master 빌드 없음)를 Lead 단위로 export("📥 Update → Import IC
Funnel")하면 반영된다. `syncMTAFunnelToOPS_()`는 이제 이 3개 필드에서 손을 떼고 Revenue/
Sales Accepted Date만 관리 — 두 파이프라인이 같은 필드를 다른 순서로 덮어쓰는 위험을 없애기
위해 필드 소유권을 완전히 분리했다(사용자 확정).

**2026-08-26 후속 — 백그라운드 트리거로 전환**: 처음엔 "Lead 단위 소규모 리포트라 무겁지
않다"는 이유로 `importCsv()`에서 동기 호출했으나, `syncICFunnelToOPS_()` 끝의 7개 Engine
refresh(Leads_OPS/MTA_Master 전체 스캔)는 IC Funnel 데이터 크기와 무관하게 그 자체로 무거워
업로드 다이얼로그가 오래 안 닫히는 문제가 실사용 중 발견됨. `appendNewLeads()`/`appendNewMTA()`
와 동일한 설치형 1회성 백그라운드 트리거 패턴으로 전환(`scheduleICFunnelPipelineTail_()` +
`runICFunnelPipelineTail()`, `MASTER_002_PipelineAsync.js`) — `PIPELINE_LOCK`은 Leads/MTA와
공유. README Pipeline Status 표에 "IC Funnel" 3번째 행 추가(사용자 요청,
`buildPipelineStatusGrid_()`/`pipelineStatusPropertyKey_()`).

**2026-08-26 추가 후속 — OPS 시트/Report 화면까지 재생성**: 처음엔 `syncICFunnelToOPS_()`만
불러서 끝냈으나, 그 함수가 갱신하는 건 ACQ_Summary/Events·BOFU·Search·Content Engine 등
숨겨진 캐시뿐이고 `buildEventsOPS()` 등(OPS 시트 재구성)이나 `generateACQReport_()` 등
(Report 화면 재생성)은 안 불러서, 이번 기능의 핵심 목적(ACQ_REP IC Booked/Complete 수치
교정)이 화면엔 다음 Leads/MTA Import 전까지 반영이 안 되는 문제를 사용자가 지적 —
`runMTAPipelineTail()`과 동일하게 `refreshOPSSheets_()`/`refreshReportFYDropdowns_()`/
`refreshReportGenerate_()`까지 이어서 실행하도록 확장(`runICFunnelPipelineTail()` v1.18.0).

## Field Ownership 전면 재편 — SAL/Revenue 분리 (2026-09-02, 사용자 확정)

`docs/OpenItems.md` #38(SAL 8월 갭)에서 시작된 조사가 Leads_OPS 전체 필드 소유권
재설계로 이어짐 — "Revenue가 지금까지 MTA_Master 터치 기반으로만 동기화돼 Search_OPS가
SAL과 동일한 '터치 없으면 갱신 안 됨' 문제를 겪고 있다"는 게 발견되면서, 리포트별 소유권을
아래처럼 완전히 분리:

- **New Leads**(Leads_Raw/Master) — 기본정보 + First Touch + Lead Priority(그대로)
- **MTA**(MTA_Master, 터치 기반) — `#Touches`(신규, 이 리드의 터치 개수)만. Revenue/Lead
  Priority sync는 여기서 완전히 제거(`MASTER_003_MTAFunnelSync.js` v1.10.0)
- **SAL**(SAL_Raw, 전용 외부 스프레드시트) — Sales Accepted Date만(`MASTER_010_SALSync.js`,
  IC Funnel에서 분리된 배경은 위 "IC Funnel Sync" 섹션 아래 별도 기록 참고)
- **IC Funnel**(ICFunnel_Raw) — IC Booked/Completed Date만. Opportunity Won Date는
  제거(`MASTER_009_ICFunnelSync.js` v1.7.0)
- **Revenue**(신규, Deal Tracker 외부 스프레드시트, `CONFIG.TARGET.EXTERNAL.DEAL_TRACKER.
  COLUMNS.EMAIL`로 Email 매칭) — Revenue + Opportunity Won Date(`MASTER_011_RevenueSync.js`
  신규). Deal Tracker에 같은 Email로 여러 딜이 있으면 Revenue는 합계, Opportunity Won
  Date는 가장 최근 Close Date를 채택(가정 — 실측 미검증).

Lead Priority 다운그레이드 방지 가드(`applyPriorityDowngradeGuard_()`)는 IC Funnel 경로에
안전장치로 유지(사용자 확정, `docs/OpenItems.md` #20 New P1 8월 갭 재발 방지) — MTA 경로의
동일 가드/sync는 "MTA=터치 지표만" 원칙에 따라 제거.

Revenue는 CSV Import가 없는 유일한 파이프라인이라(Deal Tracker는 이미 존재하는 외부 시트를
읽기만 함) `importCsv()`에서 스케줄되지 않는다 — 대신 Leads/MTA/IC Funnel/SAL 4개
파이프라인 tail이 끝날 때마다(성공/실패 무관) `enqueuePendingPipelineType_(CONFIG.PIPELINE.
TYPES.REVENUE)`로 대기열에 편입시켜, 기존 락 충돌 자동재시도 FIFO 인프라
(`releasePipelineLockAndProcessQueue_()`)가 그대로 재사용되어 매번 자동으로 뒤이어
실행된다(사용자 요청 "역싱크는 트리거로 비동기"). README Pipeline Status 표에 "SAL"/
"Revenue" 행이 각각 추가됨(`buildPipelineStatusGrid_()`, 헤더+New Leads+MTA Leads+IC
Funnel+SAL+Revenue = 6행).

## Duplicate Email Handling — ⚠️ 미해결

**문서 원칙:**
- 이메일이 1번만 등장 → 정상 Merge
- 이메일이 여러 번 등장 → **자동 Merge 금지** → QA로 이동 → 나머지 레코드는 계속 처리

**실제 `22_OPS_Merge.js`의 `mergeOPS()` 동작:**
같은 이메일이 N번 나오면 **첫 번째 발생분만 정상 merge**되고, 두 번째부터만 duplicate 처리됨.
즉 문서 원칙(그룹 전체를 QA로)과 다르게, 첫 건은 몰래 정상 데이터로 들어감.

→ **사용자 결정 대기 중** — 이 로직을 문서 원칙대로 고칠지, 현재 동작을 의도된 것으로 유지할지 미확정.
임의로 고치지 말 것.

## QA Output — `Leads_OPS_QA` (⚠️ 의도적으로 미구현)
2026-07-21 기준, 프로토타입 검증을 우선하기 위해 **의도적으로 미구현 상태 유지** 중.
`mergeOPS()`의 `result.qa`는 항상 빈 배열, `writeOPSQA()` 함수 자체가 존재하지 않음.
추후 실무 프로토타입 검증 후 구현 예정.

## Merge Rules
```
Valid Email
  → 기존 OPS Record 있음?
      YES → Salesforce 관리 컬럼 업데이트 + Marketing 관리 컬럼 보존
      NO  → 새 레코드 생성
Duplicate Email
  → Merge Skip → QA Sheet에 기록 (QA 로직은 미구현 상태)
```

## Current Schema (OPS.HEADER, `20_OPS_Config.js` 기준)

| Column | Owner |
| --- | --- |
| Lead ID | Salesforce |
| Created FY | Salesforce |
| Create Date | Salesforce |
| Company / Account | Salesforce |
| Email | Salesforce |
| Phone | Salesforce |
| School Name | Salesforce |
| Lead Priority | Salesforce |
| Priority Override | Marketing |
| Priority Checked | Marketing |
| First Touch Detail | Salesforce |
| Business Segment | Salesforce |
| FT Override | Marketing |
| FT Checked | Marketing |
| IC Requested | Marketing (매 sync마다 리셋됨 — 아래 "IC Request Tracking" 참고) |
| Last IC Requested Date | Marketing |
| Total IC Requests | System (mergeOPS()가 자동 계산, 직접 편집 금지) |
| #Touches | System (2026-09-02 신규 — `syncMTAFunnelToOPS_()`가 MTA_Master 터치 개수로 계산) |
| Sales Accepted Date | Salesforce (2026-09-02부터 SAL_Raw 전용 외부시트 기반, `syncSALToOPS_()` — 위 "Field Ownership 전면 재편" 참고) |
| IC Booked Date | Salesforce (`syncICFunnelToOPS_()`) |
| IC Completed Date | Salesforce (`syncICFunnelToOPS_()`) |
| Opportunity Won Date | Salesforce (2026-09-02부터 Deal Tracker 외부시트 Email 매칭 기반, `syncRevenueToOPS_()` — 2026-07-28부터 ACQ_REP/Events/BOFU/Content Revenue의 소스는 아니었고, 위 2트랙 예외 참고. NewP1_REP/Search_OPS는 여전히 참조) |
| Revenue | Salesforce (위와 동일 — 2026-09-02부터 `syncRevenueToOPS_()`) |
| Revenue Actual | Marketing |
| Notes | Marketing |

## IC Request Tracking (2026-07-22 추가)

**배경**: `IC Requested` 체크박스 하나로는 같은 Lead가 여러 번 상담을 재신청해도 이력이 안 남았음
(재신청할 때마다 최근 값으로 덮어씌워짐). 재신청 횟수 자체가 그 Lead/캠페인의 관심도(또는 반대로
습관적/무의미한 신청 여부)를 판단하는 유의미한 신호라 판단해 카운터를 추가.

**동작 (`applyICRequestTracking_()`, `22_OPS_Merge.js`)**: `mergeOPS()`가 실행될 때마다(= 매 OPS
sync마다, 지금은 `appendNewLeads()`에서 자동 트리거됨) 기존 OPS의 `IC Requested`가 `true`였으면:
1. `Total IC Requests`를 +1
2. `IC Requested`를 `false`로 리셋

**실무 플로우**: 웨비나/세미나 후 상담 신청자 리스트(이메일 기준)를 받으면, `Leads_OPS`에서 해당
Email을 찾아 `IC Requested` 체크 + `Last IC Requested Date`에 신청일 기록. 이후 다음 sync 때
자동으로 카운트되고 체크박스는 리셋되어, 다음 재신청을 다시 체크할 수 있는 상태가 됨.

**`Total IC Requests`는 직접 편집하지 않는다** — `mergeOPS()`가 계산하는 값이라 수동으로 고치면
다음 sync 때 잘못된 기준으로 다시 계산됨.

## Design Principles
1. **Header-Based Mapping** — 컬럼은 절대 index로 참조하지 않는다. ❌ `row[13]` / ✅ `columnMap["Revenue SF"]`
2. **Flexible Schema** — 향후 컬럼 추가는 merge logic 수정 없이 가능해야 한다.
3. **Separation of Responsibilities** — Leads_Master(Salesforce 동기화) / Leads_OPS(마케팅 운영) / Reports(집계만)

## Row 설정 (2026-07-21 정리 완료)
`OPS.ROWS = { HEADER: 1, DATA_START: 2 }` — `20_OPS_Config.js`에 추가됨.
`23_OPS_Write.js`의 `writeOPS()`와 `20_OPS_Styles.js`의 `applyOPSStyle()` 모두 하드코딩된 `1`, `2` 대신
이 값을 참조하도록 수정 완료 (2026-07-21, 정정: 2026-07-24 — 이전 버전에서 "applyOPSStyle 미해결"로
잘못 표기돼 있었으나 실제 코드는 이미 교체 완료 상태였음).
    ## Duplicate Email Handling — ✅ 해결 (2026-07-21)

    **확정된 동작**: 이메일별 그룹핑 → `Create Date` 실제 비교 → 가장 이른 날짜(진짜 First Touch)만 merge,
    나머지는 duplicate로 분류 (`22_OPS_Merge.js`의 `mergeOPS()`). 정렬 순서에 의존하지 않음.
    동일 날짜 tie-break은 별도 규칙 없이 "먼저 나온 것 유지".
    제외된 레코드는 `Logger.log`로 Email/Lead ID/Create Date 기록 (QA 시트 대체용).

    **보류**: IC Request(SAL)의 `#touches` 지표는 이 dedup과 별개로 추후 논의.

## Technical Modules
- `20_OPS_Config.js` — Sheet names, Header definitions, Column groups, Constants, Rows
- `20_OPS_Styles.js` — 서식 적용 (하드코딩 이슈 있음, 위 참고)
- `21_OPS_Build.js` — Main build entry point
- `22_OPS_Merge.js` — Email lookup, Merge logic, Preserve manual columns (중복 처리 이슈 있음, 위 참고)
- `23_OPS_Write.js` — Write merged results, Formatting, Metadata update

## Future Expansion
OPS는 마케팅의 유일한 운영 데이터베이스로 유지되어야 한다. 새 워크플로우(Webinar management, Deal QA,
Revenue validation, FT validation, Priority validation, Sales ticket tracking)는 별도 스프레드시트를
만들지 않고 OPS를 확장한다.

