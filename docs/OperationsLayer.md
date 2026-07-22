# Operations Layer — Leads_OPS

## Overview
`Leads_OPS`는 마케팅 팀이 사용하는 working database다. 주간 Salesforce snapshot인 `Leads_Master`와 달리,
`Leads_OPS`는 마케팅 운영 데이터와 수동 QA 결과를 영구 보존한다.
Salesforce export가 weekly라서 실무 시트와 싱크가 어긋나는 문제를 해결하기 위한 **Salesforce ↔ 실무 사이의 중간 시트**.

향후 모든 리포트(Acquisition, Conversion, Dashboard, Weekly Metrics)는 `Leads_Master`가 아닌 `Leads_OPS`를 읽어야 한다.

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
| IC Booked Date | Salesforce |
| IC Completed Date | Salesforce |
| Opportunity Won Date | Salesforce |
| Revenue | Salesforce |
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
`23_OPS_Write.js`의 `writeOPS()`가 하드코딩된 `1`, `2` 대신 이 값을 참조하도록 수정 완료.

> ⚠️ **미해결**: `20_OPS_Styles.js`의 `applyOPSStyle()`은 아직 `1`, `2` 하드코딩 상태 그대로 남아있음.
> `OPS.ROWS`로 교체할지 여부는 사용자 결정 대기 중.
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

