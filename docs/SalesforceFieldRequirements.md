# Salesforce Field Requirements (Export 타입별)

> `docs/OpenItems.md` #45(2026-09-03 등록) — "이 리포트를 만들려면 Salesforce에서
> 정확히 어떤 필드를 뽑아야 하는가"가 `CORE_001_Config.js`의
> `REQUIRED_FIELDS`/`RAW_DATE_COLUMNS`/각 Transformer/Sync 파일 여기저기에
> 흩어져 있어 한눈에 안 보이던 문제를 해소하기 위한 문서. 2026-09-04 작성.
>
> **범위**: 각 Export 타입(New Leads/MTA/IC Funnel/SAL)이 실제로 코드에서
> 읽는(소비하는) Salesforce 필드 전체 목록 + 필수 여부 + day-first 날짜 보호
> 필요 여부. 필드별 "어느 다운스트림 리포트가 쓰는지"까지는 역추적하지
> 않음(Business Segment처럼 사실상 거의 모든 세그먼트 기반 리포트에 영향을
> 주는 필드가 많아 개별 추적이 과도한 범위 확장이 됨 — 대신 파생 컬럼 단위로
> 용도만 요약). 코드가 바뀌면 이 문서도 드리프트될 수 있음 — 소스 오브 트루스는
> 항상 각 파일의 실제 코드(아래 "코드 출처" 참고), 이 문서는 훑어보기용 스냅샷.

## New Leads Export → `Leads_Raw` → `Leads_Master`

**코드 출처**: `CORE_001_Config.js`(`REQUIRED_FIELDS.LEADS`/`RAW_DATE_COLUMNS.LEADS`) +
`MASTER_006_LeadTransformer.js`(`transformLeadRecord()`)

| Salesforce 필드 | 필수 | day-first 보호 | 용도 |
| --- | :-: | :-: | --- |
| `Lead ID` | ✅ | | Master/OPS 조인 키 |
| `Email` | ✅ | | Master/OPS 조인 키(mergeOPS Email 그룹핑) |
| `Create Date` | ✅ | ✅ | Created Month/FY/Quarter/Week 파생 |
| `Company / Account` | ✅ | | Master 컬럼 그대로 |
| `Phone` | | | Master 컬럼 그대로 |
| `First Lead Source` | | | Business Segment 계산 입력 |
| `First Lead Source Category` | | | Business Segment 계산 입력(N/A 판정 전용) |
| `First MKT UTM Campaign` | | | Business Segment 계산 입력 |
| `First Touch Detail` | | | Business Segment 계산 입력 |
| `Lead Priority` | | | Master 컬럼 그대로(New P1 판정 등에 사용) |
| `School Name` | | | Master 컬럼 그대로(P1 School Mismatch 체크 사용) |
| `School Year/Grade Level` | | | Master 컬럼 그대로 |
| `High School Graduation Year` | | | Master 컬럼 그대로 |
| `IC Booked Date` | | ✅ | Master 컬럼 그대로(단, Leads_OPS 반영은 IC Funnel Export 경로가 담당 — 아래 참고) |
| `IC Completed Date (Pre-Conversion)` | | ✅ | 위와 동일 |
| `Opportunity Won Date` | | ✅ | Master 컬럼 그대로, Won Month 파생 |
| `Won Opportunity's Amount (converted)` | | | Revenue(숫자 변환, 실패 시 0) |
| `Won Opportunity's Amount (converted) Currency` | | | Currency |

## MTA Export → `MTA_Raw` → `MTA_Master`

**코드 출처**: `CORE_001_Config.js`(`REQUIRED_FIELDS.MTA`/`RAW_DATE_COLUMNS.MTA`) +
`MASTER_007_MTATransformer.js`(`transformMTARecord()`)

| Salesforce 필드 | 필수 | day-first 보호 | 용도 |
| --- | :-: | :-: | --- |
| `Lead: Lead ID` | ✅ | | Master/OPS 조인 키 |
| `Lead: Email` | ✅ | | Master 컬럼 그대로 |
| `Multi Touch Attribution: Created Date` | ✅ | ✅ | 터치 시각 — Created FY/Quarter/Week 파생, SAL 8월 갭 조사에서 핵심 필드로 확인됨 |
| `Lead: Account Name` | | | Account |
| `Lead: Phone` | | | Phone |
| `Lead: Lead Priority` | | | Lead Priority |
| `Lead: Sales Funnel Stage` | | | Sales Funnel Stage |
| `Lead Created Date` | | | Lead Created Date(Lead 자체 생성일, 터치 생성일과 별개) |
| `Lead: First MKT UTM Campaign` | | | First MKT UTM Campaign(Lead 레벨 스냅샷) |
| `MKT UTM Campaign` | | | Business Segment 계산 입력 — **터치 레벨** 필드(Lead 객체가 아니라 Multi Touch Attribution 객체 자체 필드, 2026-07-22 소스 교체 확정) |
| `Lead Source` | | | Business Segment 계산 입력(First Lead Source로 저장 — ⚠️ Master 컬럼명이 "First Lead Source"라 raw 필드명과 다름, 다른 진단/리포트 코드에서 반복적으로 헷갈렸던 지점) |
| `Lead Source Detail` | | | Business Segment 계산 입력 |
| `Lead Source Category` | | | Business Segment 계산 입력(N/A 판정 전용) |
| `Lead: IC Booked Date` | | ✅ | Master 컬럼 그대로(단, Leads_OPS 반영은 IC Funnel Export 경로가 담당) |
| `Lead: IC Completed Date (Pre-Conversion)` | | ✅ | 위와 동일 |
| `Lead: Opportunity Won Date` | | ✅ | Master 컬럼 그대로(Leads_OPS Won Date sync는 현재 Deal Tracker 경로로 이관됨, `MASTER_011_RevenueSync.js`) |
| `Lead: Sales Accepted Date` | | ✅ | Master 컬럼 그대로 — Leads_OPS Revenue/Sales Accepted Date sync는 `MASTER_003_MTAFunnelSync.js`가 담당(IC Funnel/SAL 경로와 필드 소유권 분리됨) |
| `Lead: Won Opportunity's Amount (converted)` | | | Revenue |
| `Lead: Won Opportunity's Amount (converted) Currency` | | | Currency |
| `Lead: Lead Record Type` | | | Lead Record Type(SAL 과집계 원인 조사에서 쓰였던 필드, 현재는 `Lead: Sales Accepted Date` 기반으로 대체됨 — Master엔 계속 보존) |

## IC Funnel Export → `ICFunnel_Raw` (Master 빌드 없음, Raw→직접 Leads_OPS sync)

**코드 출처**: `CORE_001_Config.js`(`REQUIRED_FIELDS.IC_FUNNEL`/`RAW_DATE_COLUMNS.IC_FUNNEL`/
`IC_FUNNEL.COLUMNS`) + `MASTER_009_ICFunnelSync.js`(`computeICFunnelByLeadId_()`)

| Salesforce 필드 | 필수 | day-first 보호 | 용도 |
| --- | :-: | :-: | --- |
| `Lead ID` | ✅ | | Leads_OPS 조인 키 |
| `IC Booked Date` | | ✅ | Leads_OPS로 sync |
| `IC Completed Date (Pre-Conversion)` | | ✅ | Leads_OPS로 sync |
| `Opportunity Won Date` | | ✅ | `computeICFunnelByLeadId_()`가 계산은 하지만 **현재 Leads_OPS sync 대상 아님**(2026-09-02, Won Date는 Deal Tracker 경로로 이관) — export에는 계속 필요 없음, 있어도 무해 |
| `Lead Priority` | (optional) | | Leads_OPS로 sync, 값 없으면 skip(예전 export 재import 시 하위호환 위해 optional 취급) — 다운그레이드 방지 가드 있음(`applyPriorityDowngradeGuard_()`) |

⚠️ **역사적 함정**: `IC_FUNNEL.COLUMNS.LEAD_PRIORITY`를 코드에 추가한 시점(2026-08-28)과
실제 `ICFunnel_Raw` 시트 헤더에 그 컬럼이 실제로 추가된 시점 사이에 공백이 있으면
`appendSheetRecords()`가 새 컬럼을 조용히 드롭해 값이 계속 빈 채로 sync된다
(`docs/apps-script-gotchas.md` 참고 사례, `TEMPQA_046`). Salesforce 리포트에 새 필드를
추가했다면 반드시 실제 export 헤더에도 그 컬럼명이 정확히 포함됐는지 확인할 것.

## SAL Export → `SAL_Raw`(전용 외부 스프레드시트, Master 빌드 없음)

**코드 출처**: `CORE_001_Config.js`(`REQUIRED_FIELDS.SAL`/`RAW_DATE_COLUMNS.SAL`/`SAL.COLUMNS`) +
`MASTER_010_SALSync.js`(`computeSALByLeadId_()`)

| Salesforce 필드 | 필수 | day-first 보호 | 용도 |
| --- | :-: | :-: | --- |
| `Lead ID` | ✅ | | Leads_OPS 조인 키 |
| `New (Not Contacted) Date Time` | | ✅ | SAL 판정 이벤트 시각(Lead Status가 Nurturing→New (Not Contacted)로 전환된 시각) — Leads_OPS Sales Accepted Date로 sync |
| `Last MKT UTM Campaign` | | | Business Segment 계산 입력(campaign 인자) — 이 리포트엔 leadSource/category에 대응하는 필드가 없어 `resolveBusinessSegment_()` 호출 시 그 두 인자는 빈 문자열로 전달(그래도 대부분 분류 가능) |
| `Last Touch Detail` | | | Business Segment 계산 입력(detail 인자) |
| `Lead Status` | | | **현재 코드에서 sync 대상 아님** — `docs/OpenItems.md` #10(SAL에서 "Lead Status=Nurturing" 제외) 구현 시 사용 예정으로 config에만 미리 정의돼 있음. Salesforce 리포트엔 이미 포함돼 있어야 이후 #10 구현이 막히지 않음 |

⚠️ **리포트 범위 주의**: SAL 판정용 리포트는 "All leads" 범위(IC Booked Date 필터
없음)여야 한다 — 필터가 걸린 리포트를 쓰면 이미 IC를 진행한 리드의 SAL 이벤트가
누락된다(`docs/OpenItems.md` #38 배경 참고).

## 공통 주의사항

- **day-first 보호가 빠진 새 날짜 필드는 영구 데이터 손상으로 이어질 수 있음**
  (`docs/DateParsing.md` 참고 — 2026-08-19/08-20 두 차례 실제 사고). Transformer/Sync
  파일에 새 날짜 컬럼을 매핑할 때마다 반드시 해당 `CONFIG.RAW_DATE_COLUMNS.*` 배열에도
  같이 추가할 것 — 이 문서만 보고 놓치지 말고 `OPS_006_QA.js`의
  `checkUnprotectedDateLikeRawColumns_()`(매 QA 실행마다 이름에 "date"가 들어가는데
  보호 목록에 없는 컬럼을 자동 감지)로 반드시 재확인.
- **Raw 시트 헤더 자체가 새 필드를 못 따라가면 조용히 드롭됨** — `appendSheetRecords()`가
  기존 시트 헤더 기준으로만 쓰기 때문에, 코드에 새 필드 매핑을 추가해도 실제 시트 헤더에
  그 컬럼이 없으면 값이 계속 비어있는 채로 조용히 넘어간다(IC Funnel Lead Priority 사례,
  위 참고). 새 필드를 추가했다면 최초 1회는 실제 Raw 시트 헤더도 함께 확인/추가할 것.
- 이 문서는 스냅샷이라 코드가 바뀌면 드리프트될 수 있다 — 특히 `Business Segment` 계산
  입력 필드(campaign/detail/leadSource/category 4종)는 `UTIL_001_TransformHelper.js`의
  `getBusinessSegment()`/`resolveDefiniteBusinessSegment_()`가 실제 로직을 담당하므로,
  분류 규칙 자체를 알고 싶다면 이 문서가 아니라 `docs/BusinessSegmentClassification.md`를
  참고할 것.
