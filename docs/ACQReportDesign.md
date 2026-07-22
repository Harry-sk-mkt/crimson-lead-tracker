# ACQ Report Design

## Overview
ACQ Report는 **Cohort 기반 acquisition report**다. 특정 월에 무슨 일이 있었는지가 아니라:
> "이 달에 획득된 Lead들이, 세일즈 퍼널을 얼마나 진행했는가?"

모든 downstream 지표(IC Booked, IC Complete, Revenue 등)는 **Lead가 최초로 획득된 달**로 귀속된다.

## Report Philosophy — Lead Cohort
Example: 2025-08-10 Lead Created → 2025-09-05 IC Booked → 2025-09-12 IC Complete → 2025-10-03 Won → Revenue $10,000
→ 이 Lead는 **August Acquisition Cohort**에 속하며, 모든 지표는 FY25 AUG에 기록된다.

## Data Sources
- **MTA_Master** — 획득(acquisition) 지표 (All Leads, All P1, SAL) / Date Driver: MTA Created Date
- **Leads_OPS** — downstream 퍼널 지표 (New Leads, New P1, IC Booked, IC Complete, Revenue) / Date Driver: Lead Created Date
  - IC Booked/Completed/Won Date는 **월 귀속(cohort assignment)에는 사용하지 않는다.** 퍼널 단계 도달 여부 판단에만 사용.
  - (2026-07-21 확정: `ACQReportDesign.md` 초안에는 Leads_Master가 소스로 되어 있었으나, `operations-layer-leads-ops.md`
    원칙대로 실제 구현은 **Leads_OPS**를 소스로 함 — 정합성 이슈 해결됨)

## ⚠️ Attribution 불일치 (알려진 설계, 버그 아님) — 2026-07-21 확인

같은 리포트 안에서 지표별로 **Business Segment의 귀속 기준이 다르다**:

| 지표 그룹 | 소스 | Segment 기준 |
| --- | --- | --- |
| All Leads, All P1, SAL | MTA_Master | **Per-Touch** (MKT UTM Campaign 기준, 2026-07-22 이전엔 Last Touch였음 — 아래 섹션 참고) |
| New Leads, New P1, IC Booked, IC Complete, Revenue | Leads_OPS | **First Touch** (First MKT UTM Campaign 기준) |

이는 `business-segment-classification.md`에 이미 정의된 원래 설계 차이(Leads_Master=First Touch, MTA_Master=Last Touch)를 그대로 반영한 결과다. **버그가 아니지만, 사용자가 "왜 지표마다 세그먼트 기준이 다르지?"라고 헷갈릴 수 있어 명시적으로 기록.**

→ **보류된 결정 (2026-07-21)**: SAL을 First Touch 기준으로 통일할지 여부는 이번엔 손대지 않기로 함 — "파이프라인/리포트 단계에서 맞추면 될 것 같다"는 방향으로 추후 별도 논의.

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

## Metric Definitions

| Metric | Source | Cohort Date | Count Condition |
| --- | --- | --- | --- |
| All Leads | MTA_Master | MTA Created Date | Count All |
| All P1 | MTA_Master | MTA Created Date | Priority = P1 |
| SAL | MTA_Master | MTA Created Date | Lead Record Type = "SAL" |
| New Leads | Leads_OPS | Create Date | Count All |
| New P1 | Leads_OPS | Create Date | Priority = P1 |
| IC Booked | Leads_OPS | Create Date (cohort) | IC Booked Date is not blank |
| IC Complete | Leads_OPS | Create Date (cohort) | IC Completed Date is not blank |
| Revenue | Leads_OPS | Create Date (cohort) | Sum Revenue |

**참고**: 최신 달(예: 이번 달)의 IC Booked/Complete/Revenue가 낮거나 0으로 나오는 건 대부분 버그가 아니라, 그 코호트의 Lead들이 아직 Funnel을 충분히 진행할 시간이 없었기 때문 (정상적인 지연). 혹은 `syncICFunnelToOPS()`가 최신 IC Funnel CSV를 아직 반영 못 한 경우일 수 있음.

## Percentage 계산식 (2026-07-21 확정)
- All P1 % = All P1 / All Leads
- New Leads % = New Leads / All Leads
- New P1 % = New P1 / New Leads

## Engine Architecture (구현 완료, 2026-07-21)
- **Report Area**: `ACQ_REP` 시트, A4:N4 헤더 + A5부터 데이터 (FY/Month/Segment/지표 14개 컬럼)
- **Control Area**: A1:E1 헤더(Start FY/Start Month/End FY/End Month/Generate Report), A2:E2 값
  - Start FY/End FY, Start Month/End Month는 각각 별도 드롭다운으로 분리 (기존엔 "FY26 JUL"처럼 합쳐진 하나의
    드롭다운이라 FY18부터 스크롤해야 하는 문제가 있어 분리함)
  - FY 드롭다운 범위는 Leads_OPS/MTA_Master 실제 데이터의 min~현재 FY로 동적 계산 (하드코딩 없음)
  - E2는 체크박스, 체크 시 `onEdit()` Simple Trigger가 `generateACQReport_()` 실행 후 자동으로 체크 해제
- **Engine Area**: 같은 시트의 숨김 컬럼(O:R) — 선택된 Start FY~End FY 구간만 매번 재생성 (전체 기간 아님, 성능 목적)
  - Sort Index로 Start/End Month 구간을 빠르게 슬라이싱

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