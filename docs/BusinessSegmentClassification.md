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

## 구현 위치
`16_TransformHelper.js`의 `getBusinessSegment(campaign, detail, leadSource)` — Leads/MTA 양쪽에서 공용으로 호출됨.

## Design Principle
- **Leads_Master**: 1 Lead = 1 Row, First Touch Attribution, Lead 원천(origin) 표현
- **MTA_Master**: 1 Lead = N Rows 가능, Per-Touch Attribution, 어트리뷰션된 마케팅 터치포인트 표현
  (2026-07-22 이전엔 "Last Touch Attribution"으로 문서화되어 있었으나, 실제로는 터치 시점 정보가
  없는 Lead 레벨 스냅샷이었음이 밝혀져 정정)