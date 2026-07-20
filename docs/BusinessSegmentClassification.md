# Business Segment Classification

## 개요
Business Segment는 Marketing 2.0 전반에서 사용되는 표준 마케팅 채널 분류다.
Leads_Master와 MTA_Master가 같은 세그먼트 이름을 쓰지만, **분류 로직은 리포팅 목적에 따라 다르다.**

## 확정 세그먼트 (7개)
```
Event Offline
Event Online
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
| Event Offline | First MKT UTM Campaign에 `event-offline` 포함 OR First Touch Detail이 `EV-`로 시작 |
| Event Online | `event-online` 포함 OR `WB-`로 시작 OR Zoom Webinar |
| BOFU | First Touch Detail에 `BOFU` 포함 |
| Search | Paid Search, Organic Search, Contact Campaign(`_contact`), Contact/Consult 페이지 |
| Content | Lead Campaign(`_lead`), ebook, planner, guide, prospectus, booklet, curriculum guide, parent ebook |
| Referral | Lead Source = Referral |
| Other | 그 외 전부 |

## MTA_Master — Last Touch Attribution
**Priority:** Last MKT UTM Campaign → Lead Source Detail → Lead Source → Other

(분류 조건은 Leads_Master와 동일한 패턴, 필드만 Last MKT UTM Campaign / Lead Source Detail 기준)

## 구현 위치
`16_TransformHelper.js`의 `getBusinessSegment(campaign, detail, leadSource)` — Leads/MTA 양쪽에서 공용으로 호출됨.

## Design Principle
- **Leads_Master**: 1 Lead = 1 Row, First Touch Attribution, Lead 원천(origin) 표현
- **MTA_Master**: 1 Lead = N Rows 가능, Last Touch Attribution, 어트리뷰션된 마케팅 터치포인트 표현