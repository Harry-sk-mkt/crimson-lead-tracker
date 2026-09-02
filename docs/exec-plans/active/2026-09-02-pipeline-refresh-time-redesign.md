# 파이프라인 Refresh 시간 단축 — Engine/OPS/Report 분리 + Report 레이어 증분화

**관련 로드맵 항목**: 없음(GAS 백엔드 설계 검토에서 파생된 별도 트랙, `docs/OpenItems.md`
#40/#41/#42와 직결)
**시작일**: 2026-09-02
**상태**: 부분 구현 완료(2026-09-03) — #41 계열(BOFU/Content 이중조회, FY_REP 반복오픈,
S&M_REP 전체 재스캔) 전부 구현·실측 검증 완료. **남은 것(Engine 독립 트리거 분리 여부,
Target_REP/FY_REP 증분화)은 여전히 설계 미확정 — 사용자가 확정 후 알려주면 진행**
(2026-09-02 원칙 유지). 그 전까지 이 파일의 남은 항목을 임의로 구현하지 말 것.

## Goal

이 작업이 끝나면: Leads/MTA 등 백그라운드 파이프라인의 Engine→OPS/Report 체인이 지금처럼
한 실행에 전부 몰려있지 않고, 실제로 시간이 오래 걸리는 지점만 골라 개선되어 있어야 한다.
구체적으로는 (1) Engine 6종 refresh가 필요하면 독립 트리거 경계를 가지고, (2) Target_REP/
FY_REP/S&M_REP이 과거 확정 구간을 매번 재계산하지 않고 증분으로 동작한다.

## Progress

- [x] GAS 백엔드 아키텍처(상위 GitHub 저장소 대비) 격차를 실제 코드와 대조 검증 —
      `docs/OpenItems.md` #40
- [x] Engine/OPS/Report 16개 함수의 실제 조회 대상(어떤 시트/외부 워크북을 읽는지) 전수
      매핑 — `docs/OpenItems.md` #41
- [x] "Engine→OPS→Report 순차 3단계"라는 최초 전제가 틀렸음을 발견·정정(OPS와 Report는
      Engine 완료 후 서로 독립적으로 실행 가능) — `docs/OpenItems.md` #42
- [x] Report 레이어 5종 각각의 실제 읽기 범위를 코드로 검증 — Target/FY/S&M이 예상과
      반대로 매번 전체(과거 포함) 재계산하고 있음을 확인 — `docs/OpenItems.md` #42
- [x] 실행 시간 실측(현재 5분리 파이프라인 구조 기준) — 2026-09-03, `runLeadsPipelineTail()`
      리포트별/구간별 실측 완료(`docs/PerformanceBenchmark.md` 2026-09-03 항목,
      `docs/OpenItems.md` #40 참고)
- [x] **S&M_REP 전체 재스캔 제거 — 구현 및 실측 검증 완료(2026-09-03)**: ACQ Engine
      (`computeMTAAggregates_()`/`computeOPSAggregates_()`)의 기존 스캔에 주 단위 서브맵을
      얹어 신규 `ACQ_Summary_Weekly` 캐시로 저장(`refreshACQSummaryWeekly_()`,
      `ACQREP_002_Summary.js` v1.4.0), S&M_REP은 이 캐시만 읽음(`SMREP_001_Report.js`
      v1.3.0). New P1은 ACQ_REP과 완전히 동일 소스(Leads_OPS Priority Override/다운그레이드
      가드 포함)로 계산해 정의 불일치(#35/#38류) 위험 없음 — raw Master 기반 대안은
      설계 논의에서 명시적으로 기각(아래 Decision Log). 결과: 119.8s → 4.0s(97% 감소).
      상세: `docs/PerformanceBenchmark.md` 2026-09-03.
- [x] **BOFU/Content Meta_Raw+Dictionary 이중조회 제거 — 구현 완료(2026-09-03)**: 모듈
      스코프 메모이제이션(`_bofuMetaCampaignDataAggCache`/`_contentMetaCampaignDataAggCache`,
      `UTIL_002_UtmProgramDictionary.js`의 기존 캐시 패턴 재사용) — `BOFU_002_Engine.js`
      v1.7.0/`CONTENT_002_Engine.js` v1.8.0.
- [x] **FY_REP perfTrackerByFY 반복 오픈 제거 — 구현 완료(2026-09-03)**: `openFYRepMarketingSourceFile_()`
      신규(실행당 1회만 openById) — `FYREP_001_Engine.js` v1.8.0.
- [ ] "확정된 과거 구간"의 경계 설계 — Target_REP/FY_REP 증분화에 남은 항목(S&M_REP은
      위에서 별도 경로로 이미 해소됨 — ACQ Engine의 기존 Leads_OPS 기반 계산을 그대로
      재사용해 "얼마나 과거까지 캐시해도 되는가" 판단 자체가 불필요해짐). Target_Engine
      전체 재계산/FY 전체 순회는 여전히 미해결.
- [ ] Engine 분리 방식 확정 — 독립 트리거로 뺄지, 그대로 둘지. 2026-09-03 실측(Engine
      6종 169.9s/27.8%, 30분 한도의 34%)으로 시급성은 낮아짐 — 재평가 필요.
- [ ] Target_REP/FY_REP 증분화 구현 (경계 설계 확정 후)

## Surprises & Discoveries

- **Engine의 다운스트림이 일직선이 아니었음**: Events/BOFU/Search/Content Engine은 각자의
  OPS 화면에서 끝나고(더 읽어가는 Report 없음), ACQ_Summary/NewP1_Engine/Target_Engine은
  OPS를 거치지 않고 Report가 직접 읽음. 즉 OPS와 Report는 서로 순서 의존이 없고 둘 다
  "Engine 완료"라는 조건만 공유 — 분리 설계 시 "Engine 1묶음 + (OPS, Report) 독립 실행"이
  "Engine/OPS/Report 3단계 순차"보다 임계 경로가 짧음.
- **NewP1_REP은 이미 가벼움(반직관적)**: "First Touch 때문에 전체 스캔이 필요해서 느릴
  것"이라는 가설과 달리, Report 단계 자체(`generateNewP1Report_`)는 NewP1_Engine 캐시만
  읽는다. 전체 Leads_OPS 스캔은 Engine 단계(`computeNewP1Aggregates_`)에서 이미 끝나는
  일이라 Engine 실측(~4m39s)에 이미 포함돼 있음.
- **Target_REP/FY_REP/S&M_REP은 예상과 반대로 무거움**: "해당 주/월만 보면 될 텐데"라는
  가설과 반대로, 셋 다 코드상 매번 전체(과거 포함) 재계산함:
  - `generateTargetReport_()`가 시작하자마자 `refreshTargetEngine_()`(Target_Engine 전체
    재계산)을 매번 새로 호출(`TARGET_002_Report.js:541`).
  - `computeFYRepFlatRows_()`가 `CONFIG.FYREP.FYS`(24/25/26 전부)를 매번 순회
    (`FYREP_001_Engine.js:1504`) — 특정 FY 하나가 아니라 설정된 전체.
  - `generateSMReport_()`가 `sheetToObjects()`로 Leads_OPS·MTA_Master 전체를 먼저 메모리에
    올린 뒤에야 주 단위로 필터링(`SMREP_001_Report.js:471-472`).
- **BOFU/Content Engine·OPS Build가 Meta_Raw+UTM Dictionary를 이중 조회**:
  `computeBOFUMetaCampaignDataAggregates_()`가 완전히 동일한 함수로 Engine 단계(Spent용)와
  OPS Build 단계(Campaign/날짜/Clicks용) 양쪽에서 각각 호출됨 — 반환값에 이미 필요한 필드가
  전부 있는데 Engine이 Spent만 뽑아 쓰고 버리는 구조라 OPS Build가 재계산. Events_Engine은
  이 문제가 없어 비대칭 — 왜 다른지 확인 필요.
- **FY_REP만 Report 함수 자신이 외부 워크북을 동기 오픈**: 나머지 Report(ACQ/NewP1/Target)는
  전부 `Ad_Spend_Cache` 같은 로컬 캐시만 읽는데, FY_REP은 `computeFYRepMarketingRowsForFY_()`
  가 FY마다 `SpreadsheetApp.openById()`(perfTrackerByFY)를 직접 호출 — FY 개수 × 최대 2회
  반복.
- **2026-08-05에 이미 한 번 파이프라인 강제종료 사고 전례가 있었음**: `runLeadsPipelineTail()`
  안의 한 단계가 느려져 Apps Script 플랫폼이 실행을 강제 종료 → 최상위 try/catch가 개입 못 해
  `PIPELINE_LOCK`이 영구히 남았던 사고(`docs/OpenItems.md` #20). 원인 자체는 고쳤지만 "여러
  무거운 단계를 한 실행에 순차로 몰아넣는" 구조 자체는 여전함.
- **2026-09-03 실측 결과 — S&M_REP이 예상외 압도적 1순위, Engine 분리 시급성은 재평가 필요**:
  `runLeadsPipelineTail()` 전체 10m12s(36,612행 기준) 중 Report 5종이 175.2s(28.6%)로 가장
  큰 레이어, 그중 **`generateSMReport_` 단독이 119.8s(Report 레이어의 68%, 전체의 20%)**를
  차지 — Target_REP(25.6s)/FY_REP(22.3s)보다 훨씬 큼. Engine 6종은 169.9s(27.8%)로 전체
  30분 한도의 34%에 그쳐, IC Funnel 데이터로 추정했던 "6분 한도의 78%" 우려보다 여유 있음.
  상세 표: `docs/PerformanceBenchmark.md` 2026-09-03 항목.
- **S&M_REP 구현 1차 시도에서 회귀 발생 → 원인 규명·수정(2026-09-03)**: 주 단위 weekKey
  계산에 `Utilities.formatDate()`(서비스 호출)를 3만6천+행 루프마다 호출해
  `refreshACQSummary_()`가 24.7s → 122.5s로 5배 느려짐 — 2026-08-06에 Deal Tracker
  경로(`readDealTrackerRawRows_()`)에서 이미 한 번 겪은 것과 동일한 성능 클래스(이 파일
  자체의 과거 changelog에 기록돼 있었음, `ACQREP_001_Report.js` v1.14.4). `CONFIG.DATE.
  TIMEZONE = Session.getScriptTimeZone()`이라 `getMondayOfWeek_()`의 로컬 Date 컴포넌트와
  항상 일치함을 확인 후 순수 JS 포맷 함수(`formatWeekKeyDate_()`)로 교체해 해결 — 사용자
  실측으로 33.8s(정상 범위) 복귀 확인.

## Decision Log

- **2026-09-02**: 실행 시간 실측을 지금 하지 않고 설계 확정 후로 미룸 — 지금 재봐야 설계가
  바뀌면 무의미하기 때문. 대신 실측할 때는 전체 합산이 아니라 리포트별/구간별로 나눠서 잴 것
  (그래야 증분 캐싱 제안의 실제 가치를 판단할 수 있음).
- **2026-09-02**: 2026-07-28에 있었던 "함수 단위(16개) 트리거 분리 기각" 결정은 이번 재검토와
  전제가 다름(이번은 훨씬 굵은 단위 — Engine 1묶음 + OPS/Report 독립)로 판단, 재검토 가치
  있음으로 정리. 또한 그 결정 당시엔 없었던 `periodicRefreshAllReports_()`(하루 2번 강제
  재계산 안전망, 2026-09-01 도입)가 지금은 있어 "완료가 늦어지는" 비용이 그때보다 낮음.
  단, 실제 분리 여부는 최종적으로 사용자 확정 필요.
  - **2026-09-02 (Article 14 관련)**: Rebuild 커서 체이닝(`rebuildLeadsMaster()`/
    `rebuildMTAMaster()` 단일 실행)은 2026-07-28에 이미 "비동기화 대상에서 제외"로
    명시적으로 결정된 항목이라, 이번 트랙과 별개로 다시 열려면 "왜 다시 여는지"부터
    사용자 확인이 필요(패치 금지 원칙) — 이번 exec plan 범위에 포함하지 않음.
- **2026-09-02**: 사용자가 "설계 확정되면 알려줄게, 그때 진행하자"고 명시 — 그 전까지 이
  exec plan의 어떤 항목도 구현 착수하지 않음.
- **2026-09-03**: 실측 완료했으나 여전히 구현 미착수 — 위 Decision Log 원칙 유지. 실측으로
  우선순위가 "Engine 분리"보다 "S&M_REP 증분화"로 뚜렷하게 기울었다는 근거만 추가됐을 뿐,
  최종 설계 확정은 여전히 사용자 결정 대기.
- **2026-09-03 (설계 확정 및 구현 — #41 계열)**: 사용자가 "전체를 불러올 필요 없는 것부터
  정리하자"고 범위를 좁혀 확정 — S&M_REP/BOFU·Content 이중조회/FY_REP 반복오픈, 3건 진행.
  S&M_REP 설계 과정에서 "Leads_OPS를 아예 안 거치고 raw Master에서 직접 계산하면 어떤가"
  (사용자 제안, "P1 override는 비동기 트리거로 처리 가능, 세일즈 퍼널이 아닌 스냅샷 지표는
  전부 raw로 가능")는 논의 끝에 **New P1에 한해 기각** — `Lead Priority`는 리드 유입 후
  실무자가 P1 기준(연 학비 2500만원 이상 학교 리스트) 대비 수기 검수해 바꿀 수 있는 필드라,
  raw Master 값을 쓰면 이미 한 번 실제로 발생한 #35(New P1 8월 갭) 재발 위험이 있음(Leads_OPS의
  Priority Override + 다운그레이드 가드가 정확히 이 문제를 막기 위한 장치). All Leads/New
  Leads/SAL은 이 위험이 없어 raw 소스 활용이 가능했으나, New P1이 결국 Leads_OPS를 기다려야
  하는 이상 Engine이 어차피 그 시점 이후에 도니 소스를 섞어도 실질적 시간 이득이 없다고
  판단 — **최종적으로 전부 Leads_OPS/MTA_Master 기준(ACQ_REP과 완전히 동일한 소스·타이밍)
  유지, 대신 스캔을 ACQ Engine과 공유(1회 스캔, 월/주 두 grain 동시 산출)**하는 방향으로
  확정. "P1 리스트 기반 자동 flagging"(사용자 제안)과 "SAL Sync가 무관한 Engine 6종까지
  전부 재실행하는 낭비"(코드로 확인된 별개 문제)는 각각 `docs/OpenItems.md` #43/#44로
  분리 기록, 이번 구현 범위 밖.

## Outcomes & Retrospective

(작업 완료 시 작성)
