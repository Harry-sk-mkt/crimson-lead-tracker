# Import Date Parsing Bug

## 현상
Salesforce CSV export의 날짜 값이 CSV를 워크시트로 읽어오는 과정에서 잘못 해석될 수 있다.

**Example**
- Salesforce 원본: `1/6/2026` = 2026년 6월 1일 (Jun 1st, DMY)
- 워크시트 자동 임포트 시: 2026년 1월 6일(Jan 6th)로 잘못 해석될 위험 (day가 12 이하일 때 ambiguous)

## Root Cause
Google Sheets의 Import 과정이 텍스트를 자동으로 Date 객체로 변환하며 locale을 추측한다.
한 번 변환되면 원본 텍스트는 영구적으로 손실된다.

## 상태 — ✅ 2026-07-21 구현 완료 및 검증됨

**구현 내용**
- `CONFIG.RAW_DATE_COLUMNS`에 보호 대상 컬럼 목록 중앙화 (Leads: Create Date, IC Booked/Completed/Won Date / MTA: MTA Created Date, Lead Created Date)
- `05_SheetWriter.js`의 `appendSheetRecords()`/`writeSheetRecords()`가 해당 컬럼에 `setNumberFormat("@")`를 **값을 쓰기 전에** 적용하여 Plain Text 강제
- 날짜는 `16_TransformHelper.js`의 `parseDMY()`를 통해서만 명시적으로 Date 객체 생성 (Master Build 단계)

**검증 결과**
- `parseDMY()` 단위 테스트 4/4 통과
- 실제 `Leads_Raw` 데이터(`1/6, 2/6, 3/6...` 순차 증가 패턴)로 DMY 해석이 맞다는 것 교차 확인
- `Leads_Master`의 `Created FY`/`Created Quarter` 파생값도 정상 확인됨

## ⚠️ 검증 시 주의사항
Raw 시트 위에서 `YEAR()`/`MONTH()` 같은 **스프레드시트 수식**으로 텍스트 컬럼을 직접 확인하면,
Google Sheets가 수식 내부에서 자체적으로 locale 추측 변환을 하기 때문에 **착시로 잘못된 결과가 보일 수 있다.**
검증은 반드시 Apps Script 파서(`parseDMY` 등) 또는 `Leads_Master`의 파생 필드 기준으로 할 것.

## ⚠️ 2026-08-19 — 재발 사례: `CONFIG.RAW_DATE_COLUMNS` 누락으로 인한 회귀

이 문서의 수정(2026-07-21)은 **그 시점에 존재하던 날짜 컬럼**만 `CONFIG.RAW_DATE_COLUMNS`에
등록했다 — 이후 파이프라인에 새로 추가되는 날짜 컬럼은 이 목록에 수동으로 같이 추가해줘야
하는데, 그 절차가 누락되면 이 문서의 수정 자체가 무력화된다.

**실제 사례**: `Lead: Sales Accepted Date`가 2026-07-25(이 문서 수정 4일 뒤)에
`MASTER_007_MTATransformer.js`에 새로 매핑됐지만 `CONFIG.RAW_DATE_COLUMNS.MTA`엔 그때
추가되지 않았음 — 이후 약 3주간 이 컬럼만 보호 없이 Raw에 써지며 Google Sheets가 자체
locale로 오해석(day가 12 이하인 ambiguous 값들이 MM/DD로 뒤집힘)해 원본 텍스트가 영구
소실됨. S&M_REP(신규 리포트) 개발 중 미래 날짜 SAL이 찍히는 현상을 사용자가 Salesforce
Field History로 직접 추적해 발견("9/8/2026"이 실제로는 8월 9일인데 9월 8일로 저장돼 있었음).
`CONFIG.RAW_DATE_COLUMNS.MTA`에 추가해 재발 방지(CORE_001_Config.js v1.38.0).

**교훈(향후 새 날짜 컬럼 추가 시 체크리스트)**: MTA/Leads Transformer(`MASTER_006_LeadTransformer.js`/
`MASTER_007_MTATransformer.js`)에 `parseDate()`로 파싱하는 새 원본 날짜 컬럼을 추가할 때마다,
**반드시 같은 커밋에서 `CONFIG.RAW_DATE_COLUMNS`(해당 LEADS/MTA 배열)에도 그 원본 컬럼명을
추가할 것** — 둘이 분리된 두 곳이라 하나만 고치고 잊기 쉽다.

**데이터 복구 — ✅ 2026-08-18 같은 세션에서 완료(2026-08-19 문서 정정)**: 원본 텍스트 소실로
재export 대신 swap-back(day/month 역산) 방식으로 직접 복구했다. `TEMPQA_007_
SalesAcceptedDateAudit.js`(읽기 전용 감사, 8,191건 중 3,193건 오염 확인) →
`TEMPQA_008_SalesAcceptedDateRepair.js`(MTA_Raw 직접 복구 — "Raw는 원본 보존" 원칙의
명시적 예외, 원본 텍스트가 이미 소실돼 보존 자체가 불가능했던 상황이라 사용자 확인 후 예외
처리) → `rebuildMTAMaster()` → `runSyncMTAFunnelToOPS()`. 잔존값 1건은
`TEMPQA_010_SalesAcceptedDateStaleClear.js`로 별도 클리어. 상세: `docs/Changelog.md`
2026-08-19 항목.

**남은 작업**: day/month swap 가설로 설명 안 되는(day>12) 잔여 3개 Lead ID는 `TEMPQA_013_
SalesAcceptedDateResidualTrace.js` 실행 결과 셋 다 월말 날짜 + IC 진행 전무라는 공통 패턴 확인
— Salesforce 쪽 워크플로우/롤업 기본값 가설이 유력하나 시트/코드로는 더 이상 확인 불가,
Salesforce Field History 직접 확인 필요. 상세: `docs/OpenItems.md` #26(임의로 처리하지 말 것).

## ⚠️ 2026-08-20 — 두 번째 근본 원인 발견: 타임존 오사용 (day>12 잔여건의 정체)

위 "잔여 3개"는 실제로는 day/month swap과 무관한 별개 버그였다. `TEMPQA_018_
SalesAcceptedDateFutureAudit.js`로 전수 재확인한 결과 실제로는 8건, `TEMPQA_020_
SalesAcceptedDateTimezoneReaudit.js`로 MTA_Master 전체(8,191건)를 재감사한 결과 **94건**이었다.

**원인**: TEMPQA_007/008이 day/month swap 여부를 판정할 때 `Date.getDate()`/`.getMonth()`를
그대로 호출했는데, 이 JS Date getter는 **스크립트 실행 타임존**(`America/New_York`,
`appsscript.json`) 기준으로 동작한다. 하지만 corruption 메커니즘(Google Sheets가 텍스트를
Date로 자동 변환) 자체는 **스프레드시트 타임존**(`Asia/Seoul`, `CONFIG.DATE.DISPLAY_TIMEZONE`과
동일) 기준으로 값을 구성한다. 두 타임존 사이 시차(최대 13~14시간)로 인해 자정 전후(대략
00:00~13:xx KST) 시각을 가진 레코드는 NY 기준 day가 Seoul 기준 day와 달라진다 — 특히 원본이
"그 달 1일"인 경우 NY 기준으로는 "전달 말일"(day 28~31)로 보여, day≤12만 스캔하던 원래 로직에서
전부 누락됐다(사용자가 Salesforce Field History에서 두 건을 직접 대조해 발견 —
ppm1xxx@gmail.com/yunjiseong955@gmail.com, "12/1/2026, 8:35 am"이 실제로는 day-first 원본
"1월 12일"인데 Seoul 기준으로도 "12/1"(그 달 1일)로 보여 최초의 day-first→month-first
오해석과는 별개 축의 문제임이 확인됨). 반대 방향(NY만 ambiguous, Seoul은 안전 — 잘못 swap된
경우)이 있는지도 같이 재감사했으나 **0건**으로 확인, 기존 3,193건 복구는 전부 안전했음.

**교훈**: 이 프로젝트의 실제 업무 타임존은 Asia/Seoul(스프레드시트 자체 타임존과 동일)이지만
스크립트 실행 타임존은 America/New_York — **어떤 코드에서든 Date 객체의 날짜/월을 업무
의미로 판단해야 한다면 `Date.getDate()`/`.getMonth()`를 직접 쓰지 말고 반드시
`Utilities.formatDate(date, "Asia/Seoul", ...)`(또는 `CONFIG.DATE.DISPLAY_TIMEZONE`)로
추출할 것** — 이번 버그와 동일 클래스의 문제가 다른 날짜 판정 로직에도 잠재해있을 수 있음.

**복구**: `TEMPQA_021_SalesAcceptedDateTimezoneRepair.js`(Seoul 기준 swap-back, TEMPQA_008과
동일한 "Raw 직접 수정" 예외 적용 — 이미 복구된 값(자정 시각)은 건드리지 않는 안전장치 포함).

**예방(자동화)**: `OPS_006_QA.js` v1.7.0에 `checkUnprotectedDateLikeRawColumns_()` 추가 —
Leads_Raw/MTA_Raw 헤더 중 이름에 "date"가 들어가는데 `CONFIG.RAW_DATE_COLUMNS`에 없는 컬럼을
매 QA 실행마다 자동 감지(이번 사고의 근본 원인인 "보호 목록 갱신 누락"을 코드로 방지).