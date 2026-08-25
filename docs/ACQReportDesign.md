# ACQ Report Design

## Overview
ACQ Report는 **그 달의 실제 퍼포먼스를 보여주는 리포트**다 (2026-07-22 변경 — 아래 "Cohort → Event 기준 전환" 참고).
특정 달에 획득된 Lead가 세일즈 퍼널을 얼마나 진행했는지가 아니라:
> "이 달에 실제로 무슨 일이 있었는가? (몇 명이 새로 획득됐고, 몇 명이 이번 달에 IC Booked/Complete/Won 됐는가)"

Lead 획득 시점을 기준으로 다운스트림 퍼널을 추적하는 **Cohort 관점**은 별도로 만들 `NewP1_REP`가 담당할 예정
(아직 미구현). ACQ_REP과 NewP1_REP이 같은 걸 보여주면 리포트 역할이 겹치므로, ACQ_REP은 Event 기준으로 명확히 분리함.

## ⚠️ Cohort → Event 기준 전환 (2026-07-22, `computeOPSAggregates_()` v1.4.0)

**배경**: 원래 IC Booked/IC Complete/Revenue는 "Create Date가 그 달인 Lead 중 조건을 만족하는 건수"(Cohort)로
집계했었다. 그런데 이 방식은 최근 달(예: 이번 달)일수록 그 코호트의 Lead들이 아직 Funnel을 충분히 진행할
시간이 없어서 구조적으로 낮게 나온다 — 사용자가 "IC Booked가 리포트엔 20인데 실제로 필터해보니 41건"이라고
확인한 게 버그가 아니라 정확히 이 정의 차이였음 (Cohort=20, Event=41, 둘 다 정확한 값이었으나 서로 다른 질문에
대한 답이었음). 게다가 이후 만들 `NewP1_REP`가 Cohort 관점을 전담할 예정이라 ACQ_REP과 정의가 겹치는 문제도 있었음.

**결정**: `IC Booked`/`IC Complete`/`Revenue`는 **각자의 이벤트 날짜**(`IC Booked Date`/`IC Completed Date`/
`Opportunity Won Date`)가 속한 달로 귀속하도록 변경. `New Leads`/`New P1`은 "새로 생성된 Lead 수" 자체가
정의상 Create Date 기준이라 그대로 유지(코호트와 이벤트가 같은 개념). `All Leads`/`All P1`/`SAL`은 원래도
`MTA Created Date`(터치 발생 시점) 기준이라 이미 Event 기준이었음 — 변경 없음.

## Report Philosophy — Event-Based (2026-07-22부터)
Example: 2025-08-10 Lead Created → 2025-09-05 IC Booked → 2025-09-12 IC Complete → 2025-10-03 Won → Revenue $10,000
→ **New Leads**는 FY25 AUG에, **IC Booked**는 FY25 SEP에, **IC Complete**도 FY25 SEP에, **Revenue**는
FY25 OCT에 각각 귀속된다 (예전엔 전부 AUG 하나로 귀속됐었음).

## Data Sources
- **MTA_Master** — 획득(acquisition) 지표 (All Leads, All P1, SAL) / Date Driver: MTA Created Date (Event)
- **Leads_OPS** — New Leads/New P1(Date Driver: Create Date, Cohort=Event) / IC Booked/IC Complete/Revenue
  (Date Driver: 각자의 이벤트 날짜 — IC Booked Date/IC Completed Date/Opportunity Won Date, Event 기준)
  - (2026-07-21 확정: `ACQReportDesign.md` 초안에는 Leads_Master가 소스로 되어 있었으나, `operations-layer-leads-ops.md`
    원칙대로 실제 구현은 **Leads_OPS**를 소스로 함 — 정합성 이슈 해결됨)

## ⚠️ Attribution 불일치 (알려진 설계, 버그 아님) — 2026-07-21 확인

같은 리포트 안에서 지표별로 **Business Segment의 귀속 기준이 다르다**:

| 지표 그룹 | 소스 | Segment 기준 |
| --- | --- | --- |
| All Leads, All P1, SAL | MTA_Master | **Per-Touch** (MKT UTM Campaign 기준, 2026-07-22 이전엔 Last Touch였음 — 아래 섹션 참고) |
| New Leads, New P1, IC Booked, IC Complete | Leads_OPS | **First Touch** (First MKT UTM Campaign 기준) |
| Revenue | Deal Tracker (2026-07-28부터, 2트랙 아키텍처 CLAUDE.md #7) | **딜 자체의 수동 "Segment" 컬럼**(H열, 원래 "Content Category") — `getBusinessSegment()` 키워드 매칭은 실측 검증(Search $144,265 vs 실제 ~$537,507.89) 결과 폐기, 사용자가 전체 딜을 수동 재분류한 컬럼을 그대로 읽음 (`computeACQDealRevenueFromRows_()`, `30_ACQReport.js`) |

이는 `business-segment-classification.md`에 이미 정의된 원래 설계 차이(Leads_Master=First Touch, MTA_Master=Last Touch)를 그대로 반영한 결과다. **버그가 아니지만, 사용자가 "왜 지표마다 세그먼트 기준이 다르지?"라고 헷갈릴 수 있어 명시적으로 기록.** Revenue는 2026-07-28부터 세 번째로 다른 기준(딜 자체 필드)까지 추가됐다 — 아래 Metric Definitions 표 참고.

→ **보류된 결정 (2026-07-21)**: SAL을 First Touch 기준으로 통일할지 여부는 이번엔 손대지 않기로 함 — "파이프라인/리포트 단계에서 맞추면 될 것 같다"는 방향으로 추후 별도 논의.

### ⚠️ 오해 방지 — "New Leads/New P1"의 First Touch는 `NewP1_REP`과 동일한 컬럼이다 (2026-07-30 명확화)

**이 표(위)가 자주 오해를 부르는 지점**: "New Leads/New P1 = Leads_OPS, First Touch 기준"이라는
표현이 마치 ACQ_REP이 `docs/NewP1ReportDesign.md`의 New P1과 **다른 방식**으로 Segment를
재계산하는 것처럼 읽힌다 — 실제로 이 세션에서 그렇게 오해해서 "ACQ_REP과 NewP1_REP에 같은
New P1 Target을 붙이면 실적 숫자가 서로 달라질 수 있다"고 잘못 판단한 적이 있다.

**실제로는 동일하다** — 코드로 확인(2026-07-30):
- `30_ACQReport.js`의 `computeOPSAggregates_()`가 New Leads/New P1을 계산할 때
  `headers.indexOf("Business Segment")`로 **Leads_OPS의 `Business Segment` 컬럼 값을 그대로
  읽는다** (재계산도, `FT Override` 적용도 없음).
- `docs/NewP1ReportDesign.md`의 New P1도 정확히 같은 컬럼(`Business Segment` 컬럼 값 그대로,
  `FT Override` 재판정 없음)을 읽는다.
- 즉 위 표의 "First Touch"는 **"이 컬럼 자체가 Leads_Master 빌드 시점에 First Touch
  Attribution으로 계산돼 있다"는 뜻**이지("Leads_Master — First Touch Attribution",
  `docs/BusinessSegmentClassification.md` 참고), **"ACQ_REP이 NewP1_REP과 다른 로직으로
  재계산한다"는 뜻이 아니다.** 두 리포트의 New P1은 **같은 소스, 같은 값**이어야 정상이다.
- 반면 All Leads/All P1/SAL(MTA_Master 기반)은 정말로 **다른 컬럼**(MTA_Master 자체의
  `Business Segment`, Per-Touch Attribution)을 읽으므로 New Leads/New P1과 값이 다를 수 있다 —
  이 부분만 진짜 "Attribution 불일치"다.

**교훈**: 이 표를 "지표 소스가 다르다"는 것만으로 다른 지표에 대한 재계산/재정의를 추측하지
말 것 — 실제로 같은 컬럼을 읽는지는 코드(`headers.indexOf(...)` 호출부)로 확인해야 한다.

## ✅ All Leads/SAL — Segment "터치 시점 채널" 한계 해결됨 (2026-07-22)

**해결**: Salesforce MTA 리포트의 추출 필드를 `Last MKT UTM Campaign`(Lead 레벨) → `MKT UTM Campaign`
(Multi Touch Attribution 객체 자체 필드)로 교체 — 아래는 그 이전 진단 기록.

**남은 제약**: 이 fix는 필드 교체 이후 새로 append되는 터치부터 적용된다. 기존 MTA_Master 82,000+ row는
전체 재추출(`MKT UTM Campaign` 포함) + `resetMTACounterOnly()` + 재Import + `rebuildMTAMaster()`
전까지 아래에 기록된 구 값(부정확한 Lead 레벨 스냅샷)을 그대로 유지한다. 자세한 내용:
`docs/BusinessSegmentClassification.md` "필드 변경 이력", `docs/Changelog.md` 2026-07-22.

### (참고 기록) 원래 문제 진단

`Last MKT UTM Campaign`은 Salesforce Lead 객체의 **현재 최종 상태 필드**다. 특정 터치의 그 시점 채널을
보존하지 않고, 항상 "이 Lead가 지금 이 순간 기준 최종적으로 어디서 왔는지"만 반환한다.

**검증 방법**: Lead `00Q7F00000VePrO`의 2020-10-19 / 2026-05-18 / 2026-06-22 / 2026-07-21 터치를
Salesforce에서 각각 필터링해서 확인 — **전부 동일한(가장 최근) 캠페인**이 나옴. 터치 시점과 무관하게
Lead의 현재 상태가 그대로 조회됨을 Salesforce 원본에서 직접 확인 완료.

**영향**:
- `MTA_Master`는 터치 단위(1 Lead = N Row)인데, `Business Segment`는 Lead 레벨 필드라 같은 Lead의
  모든 터치 row가 항상 동일한(현재 시점) Segment 값을 갖는다.
- `computeMTAAggregates_()`(`30_ACQReport.js`)가 이 row를 그 row 자신의 `MTA Created Date`로 월
  귀속시키기 때문에, "이번 달에 Segment X로 집계된 터치"가 실제로 그 달에 Segment X 채널이었다는
  뜻이 아니다 — 단지 "그 Lead가 (현재 기준으로) 최종적으로 Segment X"라는 사실이, 그 Lead의 모든
  과거 터치 row에 소급 적용된 것일 뿐이다.
- Marketo 등 원천 마케팅 액티비티 로그에는 터치 시점 채널이 남아있을 수 있으나, 현재 우리 파이프라인이
  가진 데이터로는 접근/복원 불가능.

**(구) 결정 (2026-07-22 오전)**: 당시엔 Salesforce 데이터 모델 자체의 한계로 판단해 "리포트/코드는
수정하지 않고 한계만 명시"하기로 했었음. → **같은 날 오후, 사용자가 Salesforce 리포트의 추출 필드를
`MKT UTM Campaign`으로 교체하면 터치별 실제 값이 나온다는 것을 직접 확인** — 한계가 아니라 애초에
잘못된 필드를 조회하고 있었던 것으로 정정. 위 "해결" 섹션 참고.

## ⚠️ BOFU가 All Leads/SAL에서 0으로 나오던 별개의 버그 — 수정 완료 (2026-07-22, v5.1.0)

위 "MKT UTM Campaign" fix와는 별개로, MTA 쪽 `getBusinessSegment()` 호출에서 `detail` 인자가
하드코딩된 `""`였던 버그로 BOFU가 구조적으로 절대 나올 수 없었음(BOFU 판정은 `detail` 단독 조건).
`rawRecord["Lead Source Detail"]`로 수정 완료 — 자세한 내용은 `docs/BusinessSegmentClassification.md`
"MTA BOFU 판정 버그" 섹션 참고. 이 fix 반영을 위해 MTA_Master 재구축 진행 중.

## Metric Definitions (2026-07-25 갱신)

| Metric | Source | Date Driver | Count Condition |
| --- | --- | --- | --- |
| All Leads | MTA_Master | MTA Created Date (Event) | Count All |
| All P1 | MTA_Master | MTA Created Date (Event) | `Lead Priority`에 `"1"` 포함(substring) — `Priority Override` 컬럼이 `MTA_Master`엔 없어서 New P1과 달리 그대로 유지 |
| SAL | Leads_OPS | **Sales Accepted Date (Event)** | Sales Accepted Date가 그 달에 속함 (2026-07-25부터 — 아래 "SAL 과집계 원인 해결" 섹션 참고. 이전엔 MTA_Master의 Lead Record Type="SAL" 터치 건수였음) |
| New Leads | Leads_OPS | Create Date (Cohort=Event) | Count All |
| New P1 | Leads_OPS | Create Date (Cohort=Event) | 유효 Priority = "Priority 1" (exact match, `Priority Override` 우선 → 없으면 `Lead Priority`, 2026-07-22부터 `NewP1_REP` 설계와 통일. `isEffectiveP1_()`, `30_ACQReport.js`) |
| IC Booked | Leads_OPS | **IC Booked Date (Event)** | IC Booked Date가 그 달에 속함 |
| IC Complete | Leads_OPS | **IC Completed Date (Event)** | IC Completed Date가 그 달에 속함 |
| Revenue | **Deal Tracker** (2026-07-28부터 — 이전엔 Leads_OPS `Opportunity Won Date`/`Revenue`, 2트랙 아키텍처 CLAUDE.md #7 참고) | **Close Date (Event, Deal Tracker 자체 필드)** | 그 달에 Close된 딜의 Revenue 합. Segment는 딜 트래커의 수동 "Segment" 컬럼(H열) 그대로 사용 — Upsell은 이 컬럼에서 이미 "Other"로 분류돼 있어 별도 제외 로직 없음 |

## ⚠️ 이번 달 IC Booked/Complete 구조적 과소집계 — 터치 기반 export의 한계 (2026-08-25, 미해결)

**증상**: 사용자가 Salesforce "leads report"(IC Booked Date=이번 달 필터, 전체 세그먼트 합)에서
42건을 확인했는데 ACQ_REP IC Booked는 21건. IC Complete도 Salesforce 21~22건 대비 ACQ_REP 7건.

**조사** (`TEMPQA_032_ICBookedAugustSalesforceDiff.js`): 사용자가 Salesforce에서 직접 뽑은 Email
목록을 `Leads_Master` → `Leads_OPS` → `MTA_Master` 순으로 단계별 대조.
- 1건(`redrock333@yahoo.com`)만 진짜 sync 버그로 확인 — 신규 리드(Create Date 당일) 생성과
  `syncMTAFunnelToOPS_()` 실행 사이의 일회성 타이밍 공백(Leads/MTA 파이프라인이 서로 독립된
  비동기 체인이라 발생). `runSyncMTAFunnelToOPS()` 재실행(8,294건 갱신)으로 해결, IC Booked
  21→22 확인.
- 2건은 `Leads_Master`에도 없음 — 신규 리드라 Leads Import 자체가 아직 안 된 것(코드 문제
  아님).
- **나머지 대다수(IC Booked 17건, IC Complete 14건, 전체 재sync 이후에도 불변)는 `MTA_Master`에
  그 리드의 터치는 있지만 어떤 터치 행에도 이번 달 IC Booked/Completed Date 값 자체가 없음** —
  sync 로직 문제가 아님이 재확인됨(재sync로 8,294건이 갱신됐는데도 이 버킷은 거의 그대로).

**근본 원인**: `IC Booked Date`/`IC Completed Date`는 Lead 레벨 스냅샷 필드라, MTA 리포트에
그 리드의 **새 터치(마케팅 액티비티)가 export될 때만** 그 시점의 최신 Salesforce 상태가 실린다
(`computeMTAFunnelByLeadId_()`, `MASTER_003_MTAFunnelSync.js`). 실제 터치 타임라인을 찍어보면,
이 리드들은 SAL(Sales Accepted) 전후로 마지막 마케팅 터치가 있었고 그 이후 세일즈 내부 프로세스로
IC Booking/Completion이 진행된 것으로 보이는데(예: Sales Accepted Date는 터치 당일 찍히지만 IC
Booked Date는 계속 공란) — 그 사이 새 마케팅 터치가 없어서 우리 파이프라인이 그 변화를 아직 실을
방법이 없다. **재Import를 반복해도 그 리드가 다시 터치되기 전까진 계속 공란으로 남는 구조적
문제**이며, "이번 달"처럼 아직 진행 중인 최근 구간일수록 이 효과가 더 두드러진다(시간이 지나며
그 리드가 재터치/재export되면 점차 실제값에 수렴).

**과거 이력과의 연관**: 2026-07-21에 정확히 이 문제를 풀기 위한 별도 Lead-level 리포트/파이프라인
(`ICFunnel_Raw` 시트 + `syncICFunnelToOPS()`, 터치와 무관하게 IC Booked/Completed/Won Date를
직접 주간 export)이 있었으나, "SAL 판별(Lead Record Type)이 사실상 IC Booked Date 존재 여부와
동일"하다는 이유로 MTA_Master 통합 방식(`syncMTAFunnelToOPS_()`)으로 대체되며 제거됨
(`docs/Changelog.md` "IC Funnel Sync 구축 및 검증" 섹션 참고) — 그 통합이 이번 과소집계의 구조적
원인으로 추정된다.

**영향 범위**: New Leads/New P1/All Leads/SAL은 리드 저니상 더 이른/동시 시점에 값이 찍혀 상대적으로
영향이 적어 보임. Revenue는 2026-07-28부터 Deal Tracker 소스로 전환되어(2트랙 아키텍처, CLAUDE.md
#7) 이 문제에서 이미 벗어남 — 남은 취약 지표는 사실상 **IC Booked/Complete뿐**.

**해결 방향(미착수, 사용자 결정 대기)**: `ICFunnel_Raw` 방식(터치와 무관한 별도 Lead-level IC
Booked/Completed/Won Date 주간 export)을 IC Booked/Complete 전용으로 재도입하면 이 시차가
사라진다 — 단 사용자가 Salesforce에서 별도 리포트를 추가로 유지보수해야 하고, SAL(Sales Accepted
Date)은 지금 방식 그대로 둘지 같이 옮길지 결정 필요. 상세: `docs/OpenItems.md` #32. 이번 세션에선
조사만 완료, 구현은 보류.

## ⚠️ computeMTAFunnelByLeadId_() — "가장 오래된 터치" → "가장 최근 터치"로 정정 (2026-07-25)
- **문제**: IC Booked/Completed/Won Date/Revenue는 Lead 레벨 스냅샷(그 터치 row가 export된 시점의
  Salesforce 상태)이라 파이프라인 진행에 따라(IC Booked → Completed → Won) 값이 갱신되는데,
  `computeMTAFunnelByLeadId_()`(`09_MTAFunnelSync.js`)가 mergeOPS()의 "earliest wins"(중복 리드
  식별용) 원칙을 잘못 그대로 적용해 **가장 오래된 터치**의 스냅샷 값을 채택하고 있었음 — 실제로는
  이미 진행된 Funnel 상태를 놓치는 구조적 오류였음.
- **발견 경위**: 테스트 스프레드시트에서 이번 달 MTA만 재수출/재계산해 실제 Salesforce 수치와
  비교하던 중, IC Booked/Complete/Revenue가 계속 실제보다 낮게 나오는 걸 사용자가 지적.
- **수정**: 대표 터치 선정 기준을 **가장 최근 터치(MTA Created Date 최댓값)**로 변경 — ACQ_REP의
  IC Booked/Complete/Revenue는 "그 달까지 실제로 어디까지 진행됐는지"를 보는 지표이므로 최신
  스냅샷이 맞음(사용자 확인). `testComputeMTAFunnelByLeadId()` 갱신 완료.
- **영향**: `syncMTAFunnelToOPS_()`가 이 함수를 사용해 Leads_OPS SYNC_COLUMNS를 채우므로,
  기존에 이미 동기화된 IC Booked/Completed/Won Date/Revenue 값도 재동기화하면 달라질 수 있음
  (더 정확해지는 방향).

## ✅ SAL 과집계 원인 해결 — "Sales Accepted Date" 이벤트 필드 도입 (2026-07-25)
- **문제**: Lead Record Type 역시 Lead 레벨 스냅샷 필드라, 리드가 "이미 오래전에" SAL이 된 경우
  그 이후 발생하는 (SAL과 무관한) 터치들도 export 시점 기준 Record Type="SAL"이 그대로 찍혀서
  나옴. 예: IC Booked Date가 2026-03-31로 오래전인 리드인데도, 이후 7월에 발생한 무관한 터치
  row에도 Record Type=SAL이 찍혀 있어 7월 SAL 카운트에 잘못 포함됨(사용자 발견, 실측 MTA 리포트
  SAL 총계 235 확인).
- **해결**: Salesforce MTA export에 `Lead: Sales Accepted Date`(진짜 SAL 전환 이벤트 날짜) 필드
  추가 가능함을 확인 — `13_MTATransformer.js`에 `Sales Accepted Date` 필드로 매핑,
  `computeMTAFunnelByLeadId_()`(`09_MTAFunnelSync.js`)의 대표값(가장 최근 터치) 산출 대상에 포함,
  `syncMTAFunnelToOPS_()`가 Leads_OPS `Sales Accepted Date` 컬럼(`20_OPS_Config.js` SYNC_COLUMNS)에
  동기화. SAL 계산 자체를 `computeMTAAggregates_()`(MTA_Master, 터치 단위)에서
  `computeOPSAggregates_()`(Leads_OPS, IC Booked/Complete와 동일하게 리드당 1건, 이벤트 날짜
  기준)로 이동(`30_ACQReport.js`). 기존 MTA_Master 기반 SAL 로직/`Lead Record Type` 사용은 제거.

## ⚠️ SAL에 Lead Status 제외 조건 추가 필요 — 데이터 대기 (2026-07-25, 미해결)
- 위 "Sales Accepted Date" 전환 이후에도, `Lead Status`(Salesforce 표준 필드 — `Sales Funnel Stage`와
  다른 별개 필드. 픽리스트 순서: Nurturing → New (Not Contacted) → Attempting Contact → Contacted →
  Disqualified → IC Booked → Qualified)가 `"Nurturing"`인 리드도 Sales Accepted Date가 찍혀있어
  SAL로 잘못 카운트되는 케이스 발견(Search 세그먼트 SAL 8건이 전부 IC Booked인 게 이상해서 개별
  확인하다 발견).
- **확정된 제외 조건**: `Lead Status === "Nurturing"`만 제외. New/Attempting Contact/Contacted/
  Disqualified/IC Booked/Qualified는 전부 SAL로 그대로 카운트(사용자 확인).
- **막힘**: `Lead: Lead Status` 필드가 아직 MTA export에 없음 — Salesforce 리포트에 추가 + 재export
  전까지 구현 불가. 도착 시 `13_MTATransformer.js` 매핑(리드 레벨 스냅샷이라 대표값 로직 필요 가능)
  → `computeOPSAggregates_()`(`30_ACQReport.js`) SAL 조건에 `leadStatus !== "Nurturing"` 추가.
  자세한 내용: `CLAUDE.md` 미해결 항목 10번.

## 💡 Opportunity Won Date 대체 후보 발견 — Lead: Sales Funnel Stage = "Won Deal" (2026-07-25, 발견만 기록·구현 보류)
- CLAUDE.md "현재 알려진 미해결 항목" 5번(Opp Won Date는 진짜 Close Date가 아님)과 관련된 발견.
  `Lead: Sales Funnel Stage`가 `"Won Deal"`인 리드는 전부 Revenue 값이 존재하는 것으로 확인됨
  (사용자 확인) — Won 여부 판별에 Opportunity Won Date 대신/보조로 활용할 수 있는 후보.
  이 필드는 이미 MTA_Master에 `Sales Funnel Stage` 컬럼으로 존재(`13_MTATransformer.js`,
  `rawRecord["Lead: Sales Funnel Stage"]`에서 매핑) — 새 Salesforce export 필드 요청 불필요.
- **구현은 보류** — 정확한 활용 방식(Won count만 대체할지, wonDate 자체를 대체할지 등)은 추후
  별도 설계 논의 후 결정.

**참고**: Event 기준으로 바뀌면서 오래전에 생성된 Lead(예: 2020년 Lead)가 이번 달에 IC Booked/Won 되면
이번 달 지표에 정상적으로 잡힌다 — Create Date가 이번 달이 아니어도 무방. Lead 획득 시점 기준의 다운스트림
Funnel 진행률을 보고 싶으면(예전 이 리포트가 하려던 것) 추후 `NewP1_REP`를 참고할 것.

## Percentage 계산식 (2026-07-21 확정)
- All P1 % = All P1 / All Leads
- New Leads % = New Leads / All Leads
- New P1 % = New P1 / New Leads

## Engine Architecture (구현 완료, 2026-07-21)
- **Report Area**: `ACQ_REP` 시트, A4:N4 헤더 + A5부터 데이터 (FY/Month/Segment/지표 14개 컬럼).
  **2026-07-30 추가**: AH4:AK4 헤더 + AH5부터 Revenue Target/Revenue Target%/New P1 Target/
  New P1 Target% 4컬럼(`CONFIG.ACQ.TARGET_COLUMNS_START_COL`, Target_Engine 조회 기반,
  `docs/exec-plans/active/2026-07-30-acq-newp1-target-columns.md` 참고) — O:R열(Engine Area,
  아래 참고)과 U:AF열(사용자 수동 수식/소계 영역, 아래 참고)을 둘 다 피해 그 뒤로 배치.
- **Control Area**: A1:E1 헤더(Start FY/Start Month/End FY/End Month/Generate Report), A2:E2 값
  - Start FY/End FY, Start Month/End Month는 각각 별도 드롭다운으로 분리 (기존엔 "FY26 JUL"처럼 합쳐진 하나의
    드롭다운이라 FY18부터 스크롤해야 하는 문제가 있어 분리함)
  - FY 드롭다운 범위는 Leads_OPS/MTA_Master 실제 데이터의 min~현재 FY로 동적 계산 (하드코딩 없음)
  - E2는 체크박스, 체크 시 `onEdit()` Simple Trigger가 `generateACQReport_()` 실행 후 자동으로 체크 해제
- **Engine Area**: 같은 시트의 숨김 컬럼(O:R, `CONFIG.ACQ.ENGINE_START_COL`) — 선택된 Start FY~End FY
  구간만 매번 재생성 (전체 기간 아님, 성능 목적). Sort Index로 Start/End Month 구간을 빠르게 슬라이싱.
- **사용자 수동 영역**: U:AF열(21~32) — 사용자가 직접 넣은 수동 수식/소계(코드 아님,
  `CONFIG.ACQ.MANUAL_AREA_NOTE`). 코드가 절대 쓰면 안 됨.
  **주의(2026-07-30)**: 이 시트에 새 컬럼 블록을 추가할 때 A:N 바로 뒤(O열)를 가정하면 이 숨김
  Engine 영역과 겹치고, 그 뒤(S열)를 가정해도 이 수동 영역과 겹친다 — 실제로 Target 컬럼
  추가 시 이 두 충돌을 순서대로 발견해(1차는 코드 리뷰, 2차는 실 시트 검증 중 사용자 리포트)
  최종 AH열로 옮긴 적 있음(위 exec-plan 참고). 새 블록 추가 전 항상 `CONFIG.ACQ`의 기존 컬럼
  상수(`ENGINE_START_COL`/`MANUAL_AREA_NOTE`)를 먼저 확인할 것.

## ⚡ 성능 아키텍처 — ACQ Summary (Aggregate Table), 2026-07-21 추가

최초 구현은 리포트 생성 시마다 `MTA_Master`(8만+ 행)/`Leads_OPS`(3만+ 행) 전체를 스캔해서 지표를 계산했는데,
선택 기간을 좁혀도 스캔 자체는 항상 전체 데이터를 훑어야 해서 매번 수 분이 걸렸다 ("Engine을 만든 이유가
view만 빠르게 불러오려는 건데 여전히 느리다"는 문제 제기로 재설계).

**해결**: `ACQ_Summary`라는 별도 숨김 시트에 **전체 기간의 모든 (FY, Month, Segment) 조합별 지표를 미리 계산**해서
저장해두고, `generateACQReport_()`는 이 요약 테이블만 조회한다 (원본 스캔 없음 → 1초 이내).

- `31_ACQSummary.js`의 `refreshACQSummary_()`가 전체 재계산을 담당
- 아래 5개 함수 실행 끝에 자동으로 `refreshACQSummary_()` 호출되어, Master/OPS가 바뀔 때마다 요약 테이블도 같이 갱신됨:
  - `appendNewLeads()`, `appendNewMTA()` (`07_IncrementalMasterBuild.js`)
  - `rebuildLeadsMaster()`, `rebuildMTAMaster()` (`10_MasterBuild.js`)
  - `syncICFunnelToOPS()` (`08_ICFunnelSync.js`)
- 이 5개 함수를 실행하는 작업(Append/Rebuild/Sync) 자체는 이 때문에 조금 느려지지만, ACQ Report 조회는 항상 빠름

## Future Scalability
동일 Engine/Summary 구조를 ACQ Report, Conversion Report, Dashboard 등 향후 리포트가 재사용할 수 있도록 설계됨.