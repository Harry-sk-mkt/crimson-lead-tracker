# Master_DB — Raw(Leads_Raw/MTA_Raw/ICFunnel_Raw) 외부 스프레드시트 이관

**관련 로드맵 항목**: `docs/Roadmap.md` "Master_DB — Import되는 모든 원본 문서를 외부 폴더로 이관"
**시작일**: 2026-09-03
**상태**: Leads_Raw/MTA_Raw/ICFunnel_Raw 이관 + Phase 2 전환 + 실 Import 검증까지 전부
완료(세 타입 모두 쓰기/읽기/전체 다운스트림 체인 정상 확인). 남은 건 전부 낮은 우선순위
마무리 작업(아래 "다음 세션 시작점" 참고) — 급한 차단 요인 없음.

**다음 세션 시작점(2026-09-03 세션 종료 시점)**:
1. (선택) 안정화 며칠 확인 후 메인 스프레드시트의 기존 Leads_Raw/MTA_Raw/ICFunnel_Raw
   원본(복사 후 남겨둔 백업) 삭제 — 사용자 결정 시점에 진행("당장은 그대로 두고, 안정화
   확인 후 별도로 삭제" 확정됨).
2. `RESET_001_ResetRawMaster.js` 헤더 주석 — "Raw 시트 직접 비우기" 설명을 외부
   스프레드시트 기준으로 갱신(낮은 우선순위).
3. `TEMPQA_040`/`TEMPQA_042`/`TEMPQA_043`(IC Funnel 조사 스크립트) — 이관 후 참조가
   깨질 것, 삭제해도 되는지 사용자 확인 필요.
4. `docs/OpenItems.md` #45(Salesforce 필드 인벤토리 문서화)/#46(installable onEdit
   재발동 이슈) — 둘 다 이번 세션에서 발견만 하고 미착수, 착수 시점은 사용자 결정.
5. "전체 행 읽기/쓰기 배치 처리" 설계(Progress 체크리스트 참고) — 청크 크기/구현 방식
   미정으로 남겨둠, 실측상 급하지 않음(87,180행도 단일 호출로 103초).

## Goal

메인 스프레드시트의 용량/오픈 속도 문제를 완화하기 위해, 현재 메인 스프레드시트 안에 있는
`Leads_Raw`/`MTA_Raw`/`ICFunnel_Raw` 세 Raw 시트를 각각 전용 외부 스프레드시트(Master_DB
폴더 안)로 이관한다. `SAL_Raw`(2026-09-02)와 Deal Tracker(기존)는 이미 이 폴더 안에 있어
범위에서 제외 — 이번 작업은 나머지 세 Raw만 대상.

**범위 밖(이번 작업 아님, 사용자 확정 2026-09-03)**:
- Master(`Leads_Master`/`MTA_Master`)/Engine(ACQ/NewP1/Events/BOFU/Search/Content 등)은
  메인 스프레드시트에 그대로 둔다 — Raw만 이관해도 용량 문제의 주 원인(누적 append-only
  CSV export)이 해소될 가능성이 높고, Master/Engine은 거의 모든 리포트가
  `getActiveSpreadsheet()`로 직접 참조 중이라 이관 시 blast radius가 훨씬 큼(이유는 채팅
  로그 참고). Raw 이관 후에도 용량 문제가 남으면 별도 로드맵 항목으로 재검토.
- 캠페인 지출 Raw(Phase 1, `docs/Roadmap.md` Phase 1)는 아직 설계 미착수 — 사용자가 공유한
  "캠페인 시트"(`1zOZGwnsm0GhLGGe5rATu8jR5WxAQVx7YmmiPZVU88jY`)는 Phase 1 착수 시 참고용으로만
  기록.

## 확인된 사실 (Master_DB 폴더 구조, 2026-09-03)

Master_DB 폴더: `https://drive.google.com/drive/u/0/folders/1VDADi7BMNoQvdxFX49JTsPY14U39JNm3`

폴더 안 스프레드시트 5개(각각 별도 파일):

| 용도 | 스프레드시트 ID | 상태 |
|---|---|---|
| SALs (SAL_Raw) | `1Vo8iYMT6s0jAtjLbDR7xTwk7gBjNfSyTEGIdmYBLbgE` | **이미 `CONFIG.SAL.EXTERNAL.SPREADSHEET_ID`와 정확히 일치** — 기존 SAL_Raw 외부시트가 이 폴더로 옮겨진 것, 설정 변경 불필요 |
| New_Leads (Leads_Raw 예정) | `1wotKzNIo0xdSR5QOKN_dBW0K6BcNcCS8xci6UBjcBG8` | 신규, 이번 작업 대상 |
| MTA_Leads (MTA_Raw 예정) | `1Rqa32BoXM6jetQX2rTA9kJ_Y9mpLNnURMsQAJ9KVcQg` | 신규, 이번 작업 대상 |
| ICs (ICFunnel_Raw 예정) | `1xp_jJf6STpk5cSUpPnA_wwPRfxOknAyBoafazsyGQVE` | 신규, 이번 작업 대상 |
| Deal Tracking_2.0 | `1oGCY8okaxhpHrtotUzbhyprCOVcJ9ndX5kX3m5qqxME` | **기존 `CONFIG.TARGET.DEAL_TRACKER.SPREADSHEET_ID`와 정확히 일치** — 이름만 바뀐 동일 파일, 설정 변경 불필요 |
| (참고) 캠페인 시트 | `1zOZGwnsm0GhLGGe5rATu8jR5WxAQVx7YmmiPZVU88jY` | 범위 밖(Phase 1용) |

## Progress

- [x] Master_DB 폴더/스프레드시트 존재 여부 및 ID 확인
- [x] SAL/Deal Tracker가 기존 설정과 동일 파일임을 코드 대조로 확인(추측 아님)
- [x] 기존 SAL_Raw 이관 패턴(2026-09-02) 코드 전수 조사 — 재사용 가능한 함수/미치는 파일 목록 확정
- [x] **New_Leads/MTA_Leads/ICs 확인 결과(2026-09-03)**: 탭이 아직 비어있거나 이름이
      기본값 — 수동으로 맞추는 대신 `MASTER_012_RawExternalMigration.js`가 탭 이름을
      자동 확인/생성/rename하고 헤더+데이터를 함께 써주도록 구현(사용자가 매번 수동
      복사하면 Plain Text 서식 순서를 놓쳐 날짜 오염 재발 위험이 있다고 판단, 스크립트화 결정)
- [x] `CORE_001_Config.js`에 `RAW_EXTERNAL.LEADS/MTA.SPREADSHEET_ID`, `IC_FUNNEL.EXTERNAL.
      SPREADSHEET_ID` 추가(v1.58.0) — **단, 아직 어느 reader/writer도 이 값을 참조하지 않음**
      (2단계 롤아웃, Decision Log 참고)
- [x] **`MASTER_012_RawExternalMigration.js` 신규(v1.0.0)** — 메인 스프레드시트 Raw를
      읽기 전용으로 읽어(`readLeadRaw()`/`readMTARaw()`/`readRawSheet(CONFIG.IC_FUNNEL.SHEET)`,
      전부 기존 함수 그대로, 무변경) 외부 스프레드시트에 복사. 탭 이름 자동 확인/rename
      (`resolveRawMigrationTargetSheet_()` — 탭이 하나뿐이면 이름만 바꿔 재사용, 여러 개인데
      대상 이름이 없으면 추측하지 않고 에러), 대상 탭에 이미 데이터가 있으면 에러로 중단
      (알 수 없는 기존 데이터 덮어쓰기 방지), Plain Text 서식을 `setValues()` 이전에 적용해
      day-first 날짜 오염 방지(`docs/DateParsing.md` 재발 방지 원칙 적용). 실행 진입점:
      `runMigrateLeadsRawToExternal()`/`runMigrateMTARawToExternal()`/
      `runMigrateICFunnelRawToExternal()`/`runMigrateAllRawToExternal()`(전체 순서 실행).
      **메인 스프레드시트의 기존 Raw는 전혀 건드리지 않음(읽기 전용)** — 실행해도 프로덕션
      파이프라인에 영향 없음, 안전하게 몇 번이든 재시도 가능(단, 대상 탭이 비어있어야 함).
- [x] **(2단계 완료, 2026-09-03)** `MASTER_005_DataReader.js`(v2.2.0) —
      `readRawSheet()`/`getRawSheetDataRowCount_()`/`readRawSheetFrom_()`에 `targetSpreadsheet`
      optional 파라미터 추가(생략 시 기존과 동일), `readLeadRaw()`/`readMTARaw()`가 각자의
      external opener를 통해 전달, opener 헬퍼 2개 신설(`openLeadsRawExternalSpreadsheet_()`/
      `openMTARawExternalSpreadsheet_()`, `openSALExternalSpreadsheet_()`와 동일 패턴)
- [x] **(2단계 완료)** `IMPORT_005_RawWriter.js`(v4.3.0) — `writeLeadRaw()`/`writeMTARaw()`/
      `writeICFunnelRaw()`를 `writeSALRaw()`와 동일하게 external opener 경유로 수정
- [x] **(2단계 완료)** `MASTER_001_IncrementalMasterBuild.js`(v1.11.0) —
      `appendNewLeads()`/`appendNewMTA()`의 `getRawSheetDataRowCount_()`/`readRawSheetFrom_()`
      호출에 opener로 연 external spreadsheet를 전달
- [x] **(2단계 완료)** `MASTER_009_ICFunnelSync.js`(v1.8.0) — `openICFunnelRawExternalSpreadsheet_()`
      신규, 두 곳의 인라인 `SpreadsheetApp.getActiveSpreadsheet()` +
      `getSheetByName(CONFIG.IC_FUNNEL.SHEET)`(raw 읽기용 1곳, 진단용 1곳)를 external opener로 교체
- [x] **(2단계 완료)** `OPS_006_QA.js`(v1.8.0)의 `checkUnprotectedDateLikeRawColumns_()` —
      external spreadsheet(Leads/MTA)를 열어 스캔하도록 수정, opener 실패 시에도 이슈로만
      기록하고 QA 나머지는 계속 진행(독립 try/catch)
- [x] **타임존/통화 클렌징 영향 확인(2026-09-03, 사용자 질문 계기)** — Leads/MTA/ICFunnel의
      보호된 날짜 컬럼은 Plain Text로 저장되고 `parseDate()`→`parseDMY()`(정규식 + `new
      Date(year,month-1,day)`, 스프레드시트 타임존과 무관한 순수 함수)로 파싱되므로 Raw
      위치 이동과 무관 — Deal Tracker/Ad Spend가 겪은 버그(진짜 Date 타입 셀이 소스
      스프레드시트 자체 타임존으로 변환되는 문제)와는 다른 카테고리. 통화 변환 로직은
      Raw→Master 단계에 아예 없음(Revenue는 단순 숫자, 통화 처리는 하위
      `MASTER_011_RevenueSync.js`에만 존재, 이번 이관과 무관). 유일한 잔여 위험(보호
      목록 누락된 날짜 컬럼)은 위 `checkUnprotectedDateLikeRawColumns_()` 수정으로 계속 감시됨.
- [x] `IMPORT_008_RawDeduplicator.js`는 이미 `targetSpreadsheet` 지원(v1.1.0) — 변경 불필요, 확인 완료
- [x] **마이그레이션 실행 완료 및 검증(2026-09-03)** — `runMigrateAllRawToExternal()` 실행,
      세 타입 전부 source/written 건수 정확히 일치(MATCH):
      - Leads_Raw: 37,562건, 약 28초
      - MTA_Raw: 87,180건, 약 103초 (셋 중 최대 규모)
      - ICFunnel_Raw: 42,864건, 약 16초
      "탭이 없어 유일한 기존 탭 이름을 바꿉니다" 로그로 `resolveRawMigrationTargetSheet_()`의
      자동 rename 경로가 세 시트 모두에서 정상 동작함도 확인. → 2단계(실제 reader/writer
      전환) 착수 가능
- [ ] 성능 실측 — Leads_Raw/MTA_Raw는 SAL(리드 단위 소량)과 달리 3만~8만+행 규모.
      `filterOutExactDuplicateRawRecords_()`(매 Import마다 대상 시트 전체 range read)와
      `readLeadRaw()`/`readMTARaw()`(Full Rebuild 시 전체 스캔)가 외부 스프레드시트
      `openById()` 경유로도 허용 가능한 시간 안에 끝나는지 실측 필요(같은 스프레드시트 내
      range read보다 오버헤드가 있을 수 있음, quota 이슈 가능성도 배제 못함)
- [ ] **전체 행 읽기/쓰기를 배치 단위로 끊어서 처리하도록 설계 (2026-09-03 사용자 요청,
      아직 미구현 — 설계만 기록)**: 지금은 `MASTER_012_RawExternalMigration.js`의
      마이그레이션(`readLeadRaw()`/`readMTARaw()`/`readRawSheet()`로 전체를 한 번에
      `getValues()`, `writeFullRawSnapshotToExternalSheet_()`로 전체를 한 번에
      `setValues()`)과, (2단계 이후) Full Rebuild 경로(`rebuildLeadsMaster()`/
      `rebuildMTAMaster()`가 쓰는 `readLeadRaw()`/`readMTARaw()`)가 전부 3만~8만+행을
      단일 호출로 통째로 읽고/쓴다. 외부 스프레드시트 경유(`openById()`)는 같은 파일 내
      range 접근보다 느릴 수 있어 Apps Script 6분 실행 제한/응답 크기 제한에 더 쉽게
      걸릴 위험이 있음 — 대상: (1) 마이그레이션 스크립트의 읽기(`readRawSheet()`류)와
      쓰기(`writeFullRawSnapshotToExternalSheet_()`) 둘 다, (2) 2단계 이후 Full
      Rebuild 경로. 청크 크기(예: 5,000~10,000행 단위)와 청크 간 이어쓰기 방식(시작
      행 오프셋 추적 등)은 실제 성능 실측(위 항목) 이후 구체화 — 지금은 "끊어서 처리"
      필요성만 설계 기록, 청크 크기/구현 방식은 미정.
- [ ] `RESET_001_ResetRawMaster.js` 헤더 주석(수동 절차 안내문) — "Raw 시트 직접 비우기"
      설명을 외부 스프레드시트 기준으로 갱신
- [ ] `UTIL_001_TransformHelper.js`의 `testParseDMY_FromRawSheet()`(진단용 테스트 함수) — Raw
      경로 참조 갱신 여부 결정(낮은 우선순위)
- [ ] `TEMPQA_040`/`TEMPQA_042`/`TEMPQA_043`(IC Funnel 조사 스크립트) — 이관 후 그대로 깨질 것,
      아직 필요한 스크립트인지 삭제해도 되는지 착수 시 사용자 확인

## Surprises & Discoveries

- SALs/Deal Tracking_2.0 두 스프레드시트 ID가 기존 CONFIG 값과 완전히 일치함을 코드 대조로
  확인 — 사용자가 "이미 만들어뒀다"고 한 것이 실제로는 "기존 파일을 폴더에 넣고 이름만 바꾼
  것"이었음. 추측 없이 grep으로 직접 대조해 확정(잘못 추측했으면 두 시스템이 이미 동기화돼
  있다고 착각하고 새 ID로 잘못 덮어쓸 뻔한 위험이 있었음).
- Raw 쓰기 경로(`appendSheetRecords()`/`filterOutExactDuplicateRawRecords_()`)는 이미
  SAL 도입 때 `targetSpreadsheet` optional 파라미터로 완전히 범용화되어 있어 Leads/MTA/IC에도
  그대로 재사용 가능 — 반면 읽기 경로(`MASTER_005_DataReader.js`)는 아직 이 패턴이 없어
  전량 신규 작업 필요.
- `OPS_006_QA.js`의 Unprotected Date-like Raw Column 체크가 시트를 못 찾으면 에러 없이 조용히
  스킵되는 구조라, Raw 이관 후 방치하면 이 QA 자체가 무력화된 채로 오래 방치될 위험 발견(사전
  코드 조사로 발견, 실제 사고 발생 전에 캐치).
- **마이그레이션 실측 결과, 최대 규모(MTA_Raw 87,180행)도 단일 호출(전체 read + 전체 write)로
  약 103초 만에 완료** — Apps Script 6분 실행 제한이나 quota 에러 없이 끝남. 다만 이건
  "일회성 전체 복사" 1회 실행 기준이고, 매 Import마다 반복되는
  `filterOutExactDuplicateRawRecords_()`의 전체 range read(대상 시트 크기에 비례해 계속
  느려짐, 이관 후엔 external `openById()` 경유)나 Full Rebuild 빈도가 이 정도로 여유로운지는
  별개로 계속 지켜볼 필요 — "배치로 끊어서 처리" TODO를 당장 급한 차단 요인으로 격상시킬
  근거는 아직 없지만(이번 실측상 여유 있음), 데이터가 계속 누적되는 구조라 완전히 접어둘
  사안도 아님.

## Decision Log

- **Master/Engine은 이번 범위에서 제외, Raw만 이관** (2026-09-03 사용자 확정) — 이유:
  용량 문제의 실측되지 않은 원인 추정이지만 Raw(누적 append-only)가 Master/OPS(리드 단위
  정리·집계)보다 구조적으로 훨씬 크고, Master/OPS는 거의 모든 리포트 엔진이 직접 참조하는
  중심 허브라 이관 시 blast radius가 비교할 수 없이 큼. Raw 이관만으로 부족하면 재검토.
- **SAL_Raw external 패턴을 그대로 재사용** — 이유: 이미 검증된 아키텍처(`openById()` +
  `targetSpreadsheet` optional 파라미터, 생략 시 기존 동작 100% 유지)이고, 코드 조사 결과
  쓰기 경로는 100% 그대로 재사용 가능, 읽기 경로만 동일 패턴으로 확장하면 됨.
- **탭 이름은 반드시 기존 `CONFIG.SHEETS.LEADS_RAW`("Leads_Raw") 등과 정확히 일치해야 함,
  추측하지 않고 사용자 확인 후 착수** — SAL 도입 때와 동일 원칙("No Assumptions").
- **2단계 롤아웃(마이그레이션 스크립트 먼저 → reader/writer 전환은 검증 후 별도)** —
  이유: CONFIG에 SPREADSHEET_ID를 채우자마자 reader/writer가 그 값을 참조하도록 같이
  바꿔버리면, 데이터 복사가 아직 안 된 빈 외부 시트를 그대로 읽어 Master가 텅 빈 채로
  재구축될 위험이 있음(Leads/MTA는 SAL과 달리 주간 운영 중인 라이브 파이프라인이라 리스크가
  훨씬 큼). 마이그레이션 스크립트 자체는 메인 스프레드시트를 읽기 전용으로만 다뤄 몇 번을
  실행해도 프로덕션에 영향이 없으므로, 이 단계와 실제 전환 단계를 분리해 안전하게 순차
  진행하기로 결정.
- **탭 이름 불일치는 사용자 수동 수정 대신 마이그레이션 스크립트가 자동 처리** — 이유:
  수동으로 헤더+데이터를 복사하면 Plain Text 서식을 값 입력 *전에* 적용해야 하는 순서
  제약을 사람이 지키기 어렵고, 이 프로젝트가 이미 이 정확한 실수(day-first 날짜가 Google
  Sheets 기본 locale로 오해석되어 원본 텍스트가 영구 소실)로 여러 번 사고를 겪었음
  (`docs/DateParsing.md`) — 스크립트화가 훨씬 안전.

- [x] **실 Import로 Leads 쓰기/읽기 경로 실측 검증 완료(2026-09-03)** — 사용자가 정기 Leads
      Import를 실제로 실행. `writeLeadRaw()`: 외부 Leads_Raw 스프레드시트에 68건 정상 append
      (rows 37564-37631, dedup도 외부 시트 기준 "0건 중복" 정상 판정). `appendNewLeads()`:
      `Total Raw : 37630 / Already Processed : 37562 / New : 68` — 마이그레이션 시점 건수
      (37562)가 카운터에 그대로 남아있고 이번 신규 68건만 정확히 증분 인식(전체 재처리
      아님). 에러 없이 완료. Leads 타입은 Phase 2 완전 검증됨.
- [x] **실 Import로 MTA 쓰기/읽기 경로 실측 검증 완료(2026-09-03)** — 238건 중 76건 완전
      동일 중복 skip, 162건만 외부 MTA_Raw에 정상 append(rows 87182-87343, dedup이 외부
      시트 기준으로 정확히 판정). `Total Raw : 87342 / Already Processed : 87180 / New :
      162` — 마이그레이션 시점 건수(87180) 그대로 유지, 신규분만 정확히 증분 인식. "Pipeline
      lock held by another run — queued"는 Leads 백그라운드 파이프라인과 겹쳐 발생한 정상
      동시성 처리(에러 아님, 기존 설계된 자동 재시도 대기열). MTA 타입도 Phase 2 완전 검증됨.
- [x] **실 Import로 ICFunnel 쓰기 경로 검증 완료, 읽기 경로는 대기열 처리 대기 중(2026-09-03)** —
      10건 중 4건 완전 동일 중복 skip, 6건만 외부 ICFunnel_Raw에 정상 append(rows
      42866-42871, 마이그레이션 시점 42864건과 정확히 이어짐) — `writeICFunnelRaw()`의
      external opener 경유 쓰기 확인됨. **읽기 경로(`openICFunnelRawExternalSpreadsheet_()`가
      실제로 쓰이는 `syncICFunnelToOPS_()`)는 아직 미실행** — Leads/MTA와 달리 ICFunnel은
      증분 read가 Import 동기 구간이 아니라 `syncICFunnelToOPS_()` 전체(백그라운드 tail)
      안에 있는데, 이번엔 Leads/MTA 파이프라인 락에 걸려 대기열에 들어감("[ICFunnelSync]
      Pipeline lock held by another run — queued"). 락이 풀리면 자동으로 이어서 실행되므로
      추가 조치는 불필요 — README Pipeline Status 또는 다음 Execution 로그에서 정상 완료
      확인 필요(TODO, 아직 완료로 간주하지 말 것).
- [x] **`runMTAPipelineTail` 전체 체인 실측 검증 완료(2026-09-03)** — 최초 시도(10:10:45 시작)가
      Content Engine Refresh 완료 후 "We're sorry, a server error occurred"로 중단(Google
      인프라 쪽 일시적 오류로 추정, 이번 이관 코드와 무관해 보임). 재시도(10:44:21 시작)가
      처음부터 끝까지 에러 없이 완주: MTA Funnel Sync → ACQ/NewP1/Events/BOFU/Search/Content
      Engine refresh → Events/BOFU/Search/Content OPS Build → ACQ/NewP1/Target/S&M/FY Report
      생성까지 전부 정상 완료. MTA_Raw가 외부 스프레드시트로 이관된 상태에서 다운스트림
      전체 체인이 정상 동작함을 확인 — MTA는 Phase 2 완전 검증됨(단순 읽기/쓰기뿐 아니라
      전체 파생 리포트 체인까지).
- [ ] **사용자 질문(2026-09-03) — "Raw가 분리됐으니 파이프라인을 병렬로 못 돌리나?"에 대한
      답변 기록**: 아니오, 관련 없음 — `PIPELINE_LOCK`이 보호하는 대상은 Raw 시트가 아니라
      Leads/MTA/IC Funnel/SAL 전부가 공통으로 쓰는 다운스트림 공유 자원(Leads_OPS,
      ACQ_Summary, NewP1/Events/BOFU/Search/Content_Engine 등, 전부 메인 스프레드시트).
      Raw를 아무리 분리해도 이 시트들에 대한 동시 쓰기 레이스 컨디션 위험은 그대로라 락은
      계속 필요. Raw 이관과는 별개 주제이므로 이번 exec-plan 범위 밖.
- [x] **부수 발견(2026-09-03) — 자동 리포트 생성이 installable onEdit 트리거를 재발동시켜
      파이프라인이 느려짐, `docs/OpenItems.md` #46로 기록, 이번 exec-plan 범위 밖(고치지
      않음)** — `runICFunnelPipelineTail`이 19분 넘게 걸린 원인 조사 중 발견. Raw 이관과
      무관한 기존 설계의 부수 효과.
- [x] **ICFunnel 읽기 경로 검증 완료(2026-09-03) — Phase 2 전체 완료** —
      `runICFunnelPipelineTail`(11:03:11~11:22:25, 완료) 로그에서
      `ICFunnel_Raw Records : 42870` 확인 — 마이그레이션 시점 42,864건 + 이번 Import 6건 =
      정확히 42,870건, `syncICFunnelToOPS_()`의 `openICFunnelRawExternalSpreadsheet_()` 읽기
      경로가 정상 동작함을 실측 확인. 에러 없이 전체 체인(IC Funnel Sync → ACQ/NewP1/Events/
      BOFU/Search/Content Engine refresh → OPS Build → ACQ/NewP1/Target/S&M/FY Report 생성)
      완주. **→ Leads/MTA/ICFunnel 세 타입 전부 Phase 2(쓰기+읽기) 완전 검증 완료.**

## Outcomes & Retrospective

(작업 완료 후 작성 — 아직 MTA/ICFunnel 실 Import 검증 및 기존 메인 스프레드시트 Raw 정리
결정이 남아있어 미완료)
