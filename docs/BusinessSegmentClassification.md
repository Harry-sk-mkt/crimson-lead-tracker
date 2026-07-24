# Business Segment Classification

## 개요
Business Segment는 Marketing 2.0 전반에서 사용되는 표준 마케팅 채널 분류다.
Leads_Master와 MTA_Master가 같은 세그먼트 이름을 쓰지만, **분류 로직은 리포팅 목적에 따라 다르다.**

## 확정 세그먼트 (7개)
```
Seminar   (구 "Event Offline", 2026-07-22 리네이밍)
Webinar   (구 "Event Online", 2026-07-22 리네이밍)
BOFU
Search
Content
Referral
Other
```

## Leads_Master — First Touch Attribution
**Priority:** First MKT UTM Campaign → First Touch Detail → Lead Source → Other

| Segment | Classification |
| --- | --- |
| Seminar | First MKT UTM Campaign에 `event-offline` 포함 OR First Touch Detail이 `EV-`로 시작 |
| Webinar | `event-online` 포함 OR `WB-`로 시작 OR Zoom Webinar |
| BOFU | First Touch Detail에 `BOFU` 포함 |
| Search | Paid Search, Organic Search, Contact Campaign(`_contact`), Contact/Consult 페이지 |
| Content | Lead Campaign(`_lead`), ebook, planner, guide, prospectus, booklet, curriculum guide, parent ebook |
| Referral | Lead Source = Referral |
| Other | 그 외 전부 |

## MTA_Master — Per-Touch Attribution (2026-07-22 수정)
**Priority:** MKT UTM Campaign → Lead Source Detail → Lead Source → Other

(분류 조건은 Leads_Master와 동일한 패턴, 필드만 MKT UTM Campaign / Lead Source Detail 기준)

### ⚠️ 필드 변경 이력 — "Last MKT UTM Campaign" → "MKT UTM Campaign"
- **기존(~2026-07-21) 문제**: `Lead: Last MKT UTM Campaign`은 Salesforce **Lead 객체**의 현재 최종
  상태 필드라, 터치 시점 정보를 전혀 보존하지 않았다. 한 Lead의 모든 MTA 터치 row(1 Lead = N Row)가
  전부 동일한(그 시점 기준 "최종") 캠페인 값을 가져서, 월별 Segment 집계가 실제 그 달의 채널을
  반영하지 못하는 근본 문제가 있었다 (`docs/ACQReportDesign.md` 참고, 실데이터로 검증 완료).
- **해결(2026-07-22)**: Salesforce MTA 리포트의 추출 필드를 `MKT UTM Campaign`으로 교체.
  이 필드는 **Multi Touch Attribution 객체 자체**의 필드라, 터치별로 그 시점의 실제 캠페인이 찍힌다.
  `13_MTATransformer.js` v5.0.0에서 `getBusinessSegment()` 입력과 Master 컬럼명(`MKT UTM Campaign`,
  기존 `Last MKT UTM Campaign`에서 개명)을 이 필드로 교체.
- **주의**: 이 fix는 필드 교체 이후 새로 append되는 터치부터 적용된다. 기존 MTA_Master row는
  MTA_Raw 재추출 + `resetMTACounterOnly()` + 재Import + `rebuildMTAMaster()` 전까지 구 값(부정확한
  Lead 레벨 스냅샷)을 유지한다.

### ⚠️ MTA BOFU 판정 버그 — 수정 완료 (2026-07-22, v5.1.0)
- **문제**: `13_MTATransformer.js`가 `getBusinessSegment(campaign, detail, leadSource)`를 호출할 때
  `detail` 인자를 하드코딩된 `""`로 넘기고 있었음. BOFU 판정 조건은 `detail.includes("bofu")` 단독이라
  (campaign 기반 fallback 없음), MTA_Master에서 BOFU가 구조적으로 절대 나올 수 없는 상태였음.
- **수정**: `""` → `rawRecord["Lead Source Detail"]`. 이 필드는 Salesforce에서 `Lead:` prefix가
  없어 Multi Touch Attribution 객체 자체 필드로 확인됨(샘플 검증, `MKT UTM Campaign`과 프로그램이
  일치 — 100% 검증은 아님). Leads_Master 쪽(`12_LeadTransformer.js`)은 원래부터 `Lead Source Detail`을
  정상적으로 넘기고 있어 이 버그의 영향을 받지 않았음.
- 회귀 테스트: `testTransformMTARecord_BOFU()` (`13_MTATransformer.js`).
- 기존 MTA_Master 데이터는 이 fix 적용 후 전체 재추출 없이도 `MTA_Raw`/`MTA_Master`를 비우고
  `resetMTACounterOnly()` + 재Import + `appendNewMTA()`(카운터 0이라 Full Rebuild와 동일 효과)로
  재분류 진행 중.

## 구현 위치
`16_TransformHelper.js`의 `getBusinessSegment(campaign, detail, leadSource)` — Leads/MTA 양쪽에서 공용으로 호출됨.

## Design Principle
- **Leads_Master**: 1 Lead = 1 Row, First Touch Attribution, Lead 원천(origin) 표현
- **MTA_Master**: 1 Lead = N Rows 가능, Per-Touch Attribution, 어트리뷰션된 마케팅 터치포인트 표현
  (2026-07-22 이전엔 "Last Touch Attribution"으로 문서화되어 있었으나, 실제로는 터치 시점 정보가
  없는 Lead 레벨 스냅샷이었음이 밝혀져 정정)