# Business Segment Classification

## 개요
Business Segment는 Marketing 2.0 전반에서 사용되는 표준 마케팅 채널 분류다.
Leads_Master와 MTA_Master가 같은 세그먼트 이름을 쓰지만, **분류 로직은 리포팅 목적에 따라 다르다.**

## 확정 세그먼트 (8개)
```
Seminar   (구 "Event Offline", 2026-07-22 리네이밍)
Webinar   (구 "Event Online", 2026-07-22 리네이밍)
BOFU
Search
Content
Referral
Other
N/A       (2026-07-25 추가 — 아래 참고)
```

## Leads_Master — First Touch Attribution
**Priority:** First MKT UTM Campaign → First Touch Detail → Lead Source → Other

| Segment | Classification |
| --- | --- |
| Seminar | Campaign/Detail에 `event-offline`/`offline-seminar`/`expo`/`summit`(2026-07-25 추가) 포함 OR Detail에 `ev-`/`live event`/`seminar`/`세미나`(2026-07-25 추가, `ev-`는 위치 무관 포함 체크로 완화) 포함 |
| Webinar | Campaign/Detail에 `event-online`/`online-webinar`/`book a consult`(2026-07-25 추가) 포함 OR Detail에 `wb-`(위치 무관 완화)/`webinar`/`open day`(2026-07-25 추가) 포함 |
| BOFU | Detail에 `BOFU` 포함 OR Campaign/Detail에 `ptc`(Push To Consult, 2026-07-25 추가) 포함 OR Detail에 `consultation request`/`consult page`(2026-07-25 추가) 포함 |
| Search | Paid Search, Organic Search, Contact Campaign(`_contact`/`contact`/`consult` — 순수 "consult"는 Webinar/BOFU의 구체적 문구에 해당 안 되는 경우의 fallback), Detail에 `contact`(2026-07-25 추가) 포함, Lead Source에 `search`(2026-07-25 추가) 포함 |
| Content | Campaign/Detail에 `ebook`/`planner`/`guide`/`prospectus`/`booklet`/`curriculum`/`parent ebook`/`infographic`(2026-07-25 추가) 포함(`_lead`는 campaign 전용), Detail에 `on-demand`/`ondemand`(2026-07-25 추가) 포함 |
| Referral | Lead Source = Referral |
| N/A | MKT UTM Campaign/Lead Source Detail/Lead Source Category/Lead Source **4개가 전부 빈 값**인 경우(2026-07-25 추가) — 어트리뷰션 데이터 자체가 없는 경우를 "Other"와 구분하기 위함 |
| Other | 위 4개 필드 중 하나라도 값이 있지만 어떤 룰에도 안 맞는 경우 (일부는 캠페인 집행/네이밍 실수로 보이는 개별 예외 — `25_TempQA_BusinessSegment.js`에서 "Other 잘 분류"로 별도 표시) |

**N/A 판정 위치**: 다른 모든 룰(Referral 포함) 체크 이후, 맨 마지막(Other 직전)에 위치. Referral은
`Lead Source` 값만으로 판정되는데 그 값이 비어있으면 N/A 조건(Lead Source도 빈 값)과 겹치지 않으므로
우선순위 충돌 없음.

**"Consult" 계열 우선순위 확정(2026-07-25)**: 같은 "consult" 단어를 포함해도 문구에 따라 세그먼트가
다름 — `book a consult`(Webinar) > `consultation request`/`consult page`(BOFU) > 순수 `consult`
(Search, 기존 룰 유지). 코드 순서(Seminar > Webinar > BOFU > Search)상 더 구체적인 문구가 먼저
체크되므로 충돌 없음.

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

### ⚠️ Search 판정에 Lead Source 조건 추가 (2026-07-25)
- **문제**: `temp_QA` 시트(`25_TempQA_BusinessSegment.js`)로 Leads_OPS Business Segment 수동 QA 중,
  First Lead Source에 `Search`가 포함되는데도 Business Segment가 `Other`로 떨어지는 리드 2,264건 확인.
  기존 `getBusinessSegment()`는 Search 판정 시 campaign/detail만 보고 leadSource는 Referral 판정에만
  사용해서, "Lead Source 자체가 Search 계열"인 케이스를 놓치고 있었음.
- **수정**: Search 판정 조건에 `leadSource.includes("search")`(대소문자 무관)를 OR로 추가. 기존
  Search 조건과 동일 우선순위 — Seminar/Webinar/BOFU보다는 후순위, Content보다는 선순위 유지.
  따라서 현재 Content로 분류된 리드 중 Lead Source에 `search`가 포함된 건 이 변경으로 Search로
  바뀔 수 있음(부수효과, 사용자 확인 후 진행).
- **적용 범위**: `getBusinessSegment()`가 Leads_Master/MTA_Master 공용 함수라 양쪽 다 영향받음.
  기존 Master row는 `rebuildLeadsMaster()`/`rebuildMTAMaster()` 재실행 전까지 구 분류값 유지, 이후
  `buildLeadsOPS()` 재실행으로 Leads_OPS까지 반영해야 함.

### ⚠️ Seminar/Webinar 캠페인명 패턴 추가 + Search에 Detail Contact 조건 추가 (2026-07-25, 계속)
- **문제 1 (Seminar/Webinar)**: `temp_QA`로 Search Lead Source fix를 검토하던 중, 실제로는 Seminar여야
  할 리드(Lead ID `00QRC000008NmXB`, campaign=`KR_core_2024-02-27_josephine-and-gabe-seoul-offline-seminar`)가
  `event-offline` 리터럴 불일치로 걸러지지 않고 있었음이 확인됨. "core" 캠페인 네이밍 규칙이 예전
  "event-offline"/"event-online" 태그와 다른 슬러그(`-offline-seminar`/`-online-webinar`)를 쓰는 것으로
  확인.
- **수정 1**: Seminar/Webinar 판정에 각각 `campaign.includes("offline-seminar")` /
  `campaign.includes("online-webinar")`를 OR로 추가. Seminar/Webinar는 코드 순서상 Search/Content보다
  먼저 체크되므로, 이 fix로 해당 리드들은 Search 판정 이전에 Seminar/Webinar로 먼저 잡힘.
- **문제 2 (Search)**: First Touch Detail이 "Contact Us Form" 류(예: `Crimson Education Contact Us
  form`)인데 Other로 떨어지는 43건 확인 — 기존 Search 판정은 `campaign.includes("contact")`만 체크하고
  detail은 체크하지 않았음.
- **수정 2**: Search 판정에 `detail.includes("contact")`를 OR로 추가.
- 두 fix 모두 사용자가 `temp_QA` 시트를 수동 검토하며 발견, 확인 후 적용.

### ⚠️ Webinar Detail 조건 완화 — "zoom webinar" 정확 문구 → "webinar" 포함 (2026-07-25, 계속 3차)
- **문제**: First Touch Detail이 `Created via Zoom API Integration via webinar attendance report`처럼
  "zoom"과 "webinar"가 붙어있지 않은 변형인데, 기존 조건이 `detail.includes("zoom webinar")`(정확한
  연속 문구)만 체크해서 Other로 떨어짐.
- **수정**: `detail.includes("webinar")`로 완화(zoom 여부 무관). "webinar" 단어 자체가 강한 신호라
  오탐 위험은 낮다고 판단(사용자 확인).

### ⚠️ Seminar에 Expo 패턴 추가 (2026-07-25, 계속 4차)
- **문제**: `campaign="KR_core_2026-03-01_expo_early1_event-lam-budget-smart160"`,
  `detail="WF-2026-03-KOR-MOFU-Core Expo Naver DA"`처럼 캠페인명에 "event"만 있고
  "event-offline"/"offline-seminar" 패턴이 없는 Expo 캠페인이 Other로 떨어짐. Expo는 오프라인
  행사로 Seminar와 동일 취급(사용자 확인).
- **수정**: Seminar 판정에 campaign/detail 양쪽에 `includes("expo")` 추가.

### ⚠️ Content가 campaign만 체크하는 단일 필드 의존 문제 해결 (2026-07-25, 계속 5차)
- **문제**: Content 판정이 campaign만 보고 detail은 전혀 체크하지 않아서,
  `detail="WF-2021-09-KOR-MOFU-Core Hyperlocalized ECL eBook"`처럼 campaign엔 신호가 없고
  detail에만 "eBook"이 있는 케이스가 Other로 떨어짐(사용자 확인).
- **수정**: `_lead`(캠페인 슬러그 전용 태그) 제외 나머지 6개 콘텐츠 키워드(ebook/planner/guide/
  prospectus/booklet/curriculum/parent ebook)를 detail에도 동일하게 미러링.

### ⚠️ temp_QA 2차 리프레시 발견분 일괄 반영 (2026-07-25, 계속 6차)
- **Seminar**: `summit`(예: "KR APAC US UK Summit (Jun 06)"), `live event`(예: "Registered for
  Live Event: Mar 30 FAO Conference"), `seminar`/`세미나` 일반 단어 자체(예: "Martin Walsh
  Seminar", 한국어 세미나 초청 문구) 추가. `EV-` 접두사 체크(`startsWith`)를 위치 무관
  `includes("ev-")`로 완화 — "Registered for EV-2024-04-..." 처럼 접두사가 아닌 위치에 오는
  케이스 대응.
- **Webinar**: `book a consult`(예: "2021-07-KOR-Book a consult page" — 대다수가 웨비나 케이스로
  확인, 소수 예외는 수동 관리 예정), `open day`(예: "Filled out form: CGA APAC Open Day") 추가.
  `WB-` 접두사 체크도 동일하게 위치 무관 `includes("wb-")`로 완화.
- **BOFU**: `ptc`(Push To Consult, 예: campaign에 `yale-ptc-parents_content-...`),
  `consultation request`/`consult page`(예: "KR Consult Page", "...| Consultation Request")
  추가.
  - **"Consult" 계열 우선순위 확정**: `book a consult`(Webinar) > `consultation request`/
    `consult page`(BOFU) > 순수 `consult`(Search, 기존 유지) — 코드 순서(Seminar > Webinar >
    BOFU > Search)상 더 구체적인 문구가 먼저 체크되어 충돌 없음(사용자 확인).
- **Content**: `infographic`(예: "...Hyperlocalized Korean Army Infographic"), `on-demand`/
  `ondemand`(예: "...15Mins On-Demand", "On-demand & Slide Package") 추가.
- **일반화 불가능한 나머지 Other**: `comp`/`checklist`/`Mini Digital SAT`/`TOFU` 포함 케이스는
  `getBusinessSegment()`를 건드리지 않고 `25_TempQA_BusinessSegment.js`에서 "Other 잘 분류"로
  표시만.

### ⚠️ BUSINESS_SEGMENT_EXCEPTIONS 하드코딩 도입 (2026-07-25, 계속 7차)
- **문제**: 공통 키워드 없는 순수 오타성 Content 예외(예: "US vs UK Top University Comparisons")
  8건은 패턴 룰로 일반화 불가능(Marketo 캠페인/폼 명명 실수로 추정, 사용자 확인).
- **수정**: `getBusinessSegment()` 최상단에 `BUSINESS_SEGMENT_EXCEPTIONS` 정확한 문자열 매칭
  맵을 추가해 모든 일반 룰보다 먼저 체크(campaign/detail 둘 다 대조). 근본 수정은 아래
  "Marketo 네이밍 정정 필요 목록"을 Marketo에서 정정하는 것 — 이 하드코딩은 그 전까지의
  임시 우회.

### ⚠️ N/A 세그먼트 추가 — 4개 어트리뷰션 필드 전부 공백 케이스 구분 (2026-07-25, 계속 8차)
- **문제**: "Other"가 두 가지 서로 다른 상황을 섞어서 표현하고 있었음 — (1) 어트리뷰션 데이터
  자체가 아예 없는 경우(캠페인/터치디테일/카테고리/리드소스 전부 공백), (2) 데이터는 있지만
  기존 룰 어디에도 안 맞는 경우. QA 리뷰 중 이 둘을 구분해야 한다는 필요성 확인(사용자 확인).
- **수정**: `getBusinessSegment()`에 4번째 파라미터 `category`(Leads: First Lead Source
  Category / MTA: Lead Source Category, 신규 export 필드) 추가. MKT UTM Campaign/Lead Source
  Detail/Lead Source Category/Lead Source 4개가 전부 공백이면 "N/A" 반환, 그 외엔 기존과 동일.
  위치는 맨 마지막(Other 직전) — Referral 등 다른 룰과 충돌 없음(Referral은 Lead Source 값이
  있어야 매치되므로 애초에 N/A 조건과 겹치지 않음). `12_LeadTransformer.js`/`13_MTATransformer.js`
  호출부 갱신, MTA_Master에 `Lead Source Category` 컬럼 신규 추가. 테스트:
  `testGetBusinessSegmentNA()`.

### ⚠️ Search의 Lead Source 신호가 Content보다 먼저 체크되던 우선순위 반전 (2026-07-28)
- **문제**: 2026-07-25(위 "Search 판정에 Lead Source 조건 추가")에서 도입한 `leadSource.includes("search")`는
  당시 "Content보다는 선순위 유지"로 확정했었으나, 이 순서 때문에 campaign/detail에 ebook/guide/
  on-demand/infographic 등 명확한 Content 키워드가 있어도 그 리드의 `First Lead Source`가 "Paid
  Search"/"Organic Search"면 무조건 Search로 덮어써지는 문제가 있었음. 사용자가 Search_OPS를
  검토하다가 콘텐츠 다운로드성 캠페인 22개가 Search_OPS에 노출되는 걸 보고 발견 — 진단 함수
  `runInvestigateSearchMisclassifiedCampaigns()`(`71_Search_Engine.js`)로 실측한 결과, 22개 중 20개
  ·총 약 1,190건이 이 원인으로 잘못 분류돼 있었음 확인(예: detail="WF-2021-09-KOR-MOFU-Core
  Hyperlocalized ECL eBook" + leadSource="Organic Search" → recomputed도 Search, 라이브 버그).
- **수정**: `leadSource.includes("search")`를 Search 블록에서 제거하고 Content 판정 **뒤**, N/A/Other
  **앞**으로 이동(신규 "Search (Lead Source fallback)" 블록) — campaign/detail에 뚜렷한 신호(Search
  계열 문구도, Content 키워드도)가 전혀 없을 때만 leadSource를 최후 수단으로 사용. 2026-07-25에 이
  신호를 추가한 원래 목적(First Lead Source에 "Search" 포함되는데 Other로 떨어지던 2,264건 구제)은
  fallback 위치에서 그대로 유지됨. Seminar/Webinar/BOFU 및 campaign/detail 기반 Search 신호(contact/
  consult/paid search/organic search 문구)의 우선순위는 변경 없음. 테스트:
  `testGetBusinessSegmentContentBeatsLeadSourceSearch()`(`16_TransformHelper.js`).
- **소급 적용**: Leads_Master/MTA_Master 기존 행에 반영하려면 `rebuildLeadsMaster()`/`rebuildMTAMaster()`
  Full Rebuild 필요 — ACQ_REP/NewP1_REP/Search_OPS 등 Business Segment를 쓰는 모든 리포트에 영향.

### ⚠️ campaign의 "_contact"/"consult"도 Content보다 먼저 체크되던 문제 + "search"/"sitelink" 확정 신호 도입 (2026-07-28, 계속)
- **문제**: 위 항목 수정 후 Full Rebuild + `buildSearchOPS()`까지 실행했는데도, "Downloaded Top 50 NZ
  High Schools", "Prospectus", "Case Study", SAT Practice Test 계열, Webinar 등 명백한 콘텐츠 detail
  값들이 여전히 Search에 남아있음을 발견(`runAuditSearchSegmentIssues()`, `71_Search_Engine.js`). 원인은
  이 계정의 거의 모든 Meta 리타게팅 캠페인이 슬러그 끝에 관례적으로 `_contact`/`consult`를 붙이고
  있어서, `campaign.includes("_contact")`/`"contact"`/`"consult"`가 Content 판정보다 먼저 체크되며
  ebook/prospectus 캠페인까지 가로챈 것 — leadSource 문제와 동일한 패턴이 campaign 레벨에도 있었음.
- **검증**: 사용자가 "명확한 Search" 캠페인 49개를 직접 제시(전부 campaign에 `search` 또는 `sitelink`
  포함, 예: `KR_core_2021-04-01_search-kr_tier1-college-specific_contact`,
  `KR_core_2025-01-15_sitelink-ext-bookconsultukoxbridge_lead`). 이 49개를 전수 검증한 결과, 단순히
  `_contact`/`consult`만 Content 뒤로 미루면 `search-ap-curriculum-courses_contact`(Content 키워드
  "curriculum"과 우연히 겹침), `sitelink-ext-..._lead`(Content 키워드 "_lead"와 우연히 겹침) 같은
  **진짜 Search 캠페인이 잘못 Content로 넘어갈 뻔함**이 확인됨.
- **수정**: `campaign.includes("search")`/`campaign.includes("sitelink")`를 신규 확정 신호로 추가해
  Content 판정보다 **먼저** 체크(사용자 확정 기준: organic/paid 무관하게 campaign에 search/sitelink가
  있으면 무조건 Search). `campaign.includes("_contact")`/`"contact"`/`"consult"`는 여기서 제거하고
  Content 판정 **뒤** fallback으로 이동(`leadSource.includes("search")`와 같은 블록에 통합).
  `detail.includes("contact")`/`"paid search"`/`"organic search"`는 더 구체적인 폼 제출 신호라 기존
  위치(Content보다 먼저) 그대로 유지. 테스트:
  `testGetBusinessSegmentSearchCampaignSignals()`(`16_TransformHelper.js`) — 49개 검증 중 대표 케이스
  포함.
- **남은 잔여 케이스**: "Downloaded X"/"Case Study"/"Quiz"/공백형 "On Demand"(하이픈 없음)는 아래
  2026-07-28(계속) 항목에서 Content 키워드로 추가돼 해결됨. SAT Practice Test의 다른 문구 변형(예:
  "Core SAT practice test", "Filled out form for Mini SAT Practice Test")은 기존 하드코딩 예외 목록의
  정확한 문자열과 달라 여전히 미해결 — 필요 시 개별 예외 추가.
- **Search_OPS 죽은 키**: `mergeSearchOPS_()`(`73_Search_Merge.js`)가 "현재 Engine 키 ∪ 기존 Search_OPS
  키"로 합치는 구조라, 위 수정들로 Business Segment가 바뀌어도 Search_OPS에 한 번 들어간 키는 지표만
  0이 된 채 행 자체는 남음. `runAuditSearchSegmentIssues()` Part 1로 실측한 결과 죽은 키 116건 전부
  수동 컬럼(PIC/Impressions/Spent 등)이 완전히 비어있어 삭제 확정 — `runDeleteDeadSearchOPSRows()`
  (`71_Search_Engine.js`)로 실행.

### ⚠️ Content 키워드 확장 + BOFU/Search "_contact" 공용 fallback을 leadSource 기반으로 재설계 (2026-07-28, 계속)
- **Content 키워드 확장(사용자 확정)**: "download"/"case study"/"quiz"/"on demand"(공백형, 하이픈 없음)를
  Content 키워드로 추가(campaign/detail 양쪽) — 위 "남은 잔여 케이스"의 "Downloaded Top 50 NZ High
  Schools"(26건)/"Case Study" 계열/"Career Quiz"/공백형 "On Demand" 계열이 이제 Content로 분류됨.
- **BOFU/Search 판별 기준 재정의(사용자 확정)**: "이 계정 BOFU/Search 세그먼트 캠페인 둘 다 슬러그에
  관례적으로 `_contact`를 붙이는데, Search는 역사적으로 Lead Source가 Naver Search/Google
  Search/Organic Search(+Paid Search)인 경우만 존재 — 그 외(Paid Social 등)는 전부 BOFU여야 한다"는
  기준 확정. campaign에 `search`/`sitelink` 확정 신호가 없는 순수 `_contact`/`contact`/`consult`
  캠페인의 fallback을, 이전(v1.7.0)의 "무조건 Search"에서 **leadSource.includes("search") 여부로
  BOFU/Search를 최종 판별**하도록 재설계(leadSource에 search 계열 값이 있으면 Search, 없으면 BOFU).
  테스트: `testGetBusinessSegmentContactFallbackToBOFU()`(`16_TransformHelper.js`).
- **잔여 이슈(별도, 미해결 — CLAUDE.md에도 기록)**: 옛날 ebook Marketo flow가 UTM 값이 없으면
  leadSource를 "Organic Search"로 기본 처리하던 레거시(위 첫 항목 참고) 때문에, leadSource="Organic
  Search"라고 전부 진짜 Search는 아닐 수 있음(사용자 확인). 이번 수정은 leadSource가 Paid Social 등
  **명확히 다른 값**인 케이스만 해소 — leadSource 필드 자체가 "Organic Search"로 잘못 남아있는 잔존
  레거시(campaign.includes("search")로 이미 확정되는 케이스나 leadSource 최종 fallback 경로 포함)는
  식별 기준이 아직 없어 별도 처리 필요, 임의로 처리하지 말 것.

## Marketo 네이밍 정정 필요 목록 (2026-07-25)
아래는 `BUSINESS_SEGMENT_EXCEPTIONS`로 임시 우회 중인 캠페인/폼 이름. Marketo에서 이름 자체를
정정(예: 프로그램명에 콘텐츠 유형 키워드 포함)하면 코드 하드코딩 없이도 일반 룰로 분류 가능해짐.

| 캠페인/폼 이름 (First MKT UTM Campaign 또는 First Touch Detail) | 현재 임시 분류 | 비고 |
| --- | --- | --- |
| WF-2023-01-KOR-MOFU-Core US University Admissions for International School Students | Content | ebook인데 이름에 콘텐츠 유형 키워드 없음 |
| WF-2022-11-KOR-MOFU-Core US vs UK Top University Comparisons | Content | 〃 |
| WF-2023-06-KOR-MOFU-Core Breaking Down the Ivy League 2023 Update | Content | 〃 |
| WF-2022-02-KOR-MOFU-CGA School Comparison | Content | 공통 키워드 없는 개별 예외 |
| GC-2021-03 KR Why CGA Campaign | Content | 〃 |
| WF-2023-09-KOR-MOFU-Core How to Ace Your Academics for US Universities (relaunching) | Content | 〃 |
| WF-2025-12-UK-TOFU-Core 2 Year Roadmap to the Ivy League | Content | 〃 |
| WF-2026-04-USA-MOFU-Postgrad The 6-Month Recruitment Prep Workbook | Content | 〃 |
| 2021-07-KOR-Book a consult page | Webinar | 이름은 "consult"지만 실제로는 대부분 웨비나 프로그램. 일부 예외는 수동 관리 필요(사용자 확인, 예외 목록 미확정) |
| WF-2023-05-KOR-MOFU-Core Mini Digital SAT Practice Test 2023 | Content | "SAT"/"practice test"는 공통 키워드로 일반화하기엔 오탐 위험(2026-07-28) |
| WF-2023-05-KOR-MOUF-Core Mini Digital SAT Practice Test 2023 | Content | 위와 동일 값의 "MOUF" 오타 변형(2026-07-28) |
| WF-2022-11-KOR-MOFU-Core New Digital Mini SAT Practice Test | Content | "SAT"/"practice test"는 공통 키워드로 일반화하기엔 오탐 위험(2026-07-28) |

## 구현 위치
`16_TransformHelper.js`의 `getBusinessSegment(campaign, detail, leadSource)` — Leads/MTA 양쪽에서 공용으로 호출됨.

## Design Principle
- **Leads_Master**: 1 Lead = 1 Row, First Touch Attribution, Lead 원천(origin) 표현
- **MTA_Master**: 1 Lead = N Rows 가능, Per-Touch Attribution, 어트리뷰션된 마케팅 터치포인트 표현
  (2026-07-22 이전엔 "Last Touch Attribution"으로 문서화되어 있었으나, 실제로는 터치 시점 정보가
  없는 Lead 레벨 스냅샷이었음이 밝혀져 정정)