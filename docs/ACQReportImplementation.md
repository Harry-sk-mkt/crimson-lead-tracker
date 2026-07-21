# ACQ Report — Implementation Reference

2026-07-21 구현. `ACQReportDesign.md`의 설계 문서를 실제 코드로 옮긴 결과에 대한 파일/함수 레벨 참고 문서.

## 파일 구성

| 파일 | Responsibility |
| --- | --- |
| `30_ACQReport.js` | Report 생성 오케스트레이션 (`generateACQReport_`), Engine 생성(`buildACQEngineRows_`), 드롭다운 세팅(`setupACQDropdowns`), `onEdit` 트리거 |
| `31_ACQSummary.js` | Aggregate Table(`ACQ_Summary`) 생성/조회 — 원본 스캔은 여기서만 발생 |
| `32_ACQReportStyles.js` | Report Area 서식 전용 (% 표기, Revenue 콤마, 테두리, 짝수 행 배경색) |

## 함수 목록

**`30_ACQReport.js`**
- `setupACQDropdowns()` — Start/End FY·Month 드롭다운 + Generate 체크박스 최초 세팅 (1회성, 수동 실행)
- `findFiscalYearRange_()` — 실제 데이터 기준 FY min/max 계산 (드롭다운 목록용)
- `onEdit(e)` — Simple Trigger, `ACQ_REP!E2` 체크박스 체크 시 `generateACQReport_()` 실행 후 자동 체크 해제
- `generateACQReport_()` — 메인 로직: Engine 생성 → Sort Index 필터 → `ACQ_Summary` 조회 → Report Area 작성 → 서식 적용
- `buildACQEngineRows_(minFY, maxFY)` — 월×세그먼트 조합 생성 (테스트: `testBuildACQEngineRows`)
- `computeSortIndex_(fy, month, minFY)` — FY+Month → Sort Index 변환
- `writeACQEngine_(sheet, engineRows)` — Engine을 O:R 컬럼에 씀
- `computeMTAAggregates_(rangeStart, rangeEndExclusive)` — MTA_Master 스캔, range가 null이면 전체 스캔
- `computeOPSAggregates_(rangeStart, rangeEndExclusive)` — Leads_OPS 스캔, range가 null이면 전체 스캔

**`31_ACQSummary.js`**
- `refreshACQSummary_()` — 전체 재계산, Append/Rebuild/Sync 완료 시 자동 호출됨
- `writeACQSummary_(rows)` — `ACQ_Summary` 시트에 씀 (없으면 생성)
- `readACQSummaryMap_()` — Key(`fy|month|segment`) → 지표 객체 맵으로 조회
- `runRefreshACQSummary()` — **수동 실행용 공개 래퍼**. `refreshACQSummary_()`는 이름 끝에 `_`가 있어 Apps Script
  편집기의 Run 드롭다운에 노출되지 않으므로, 편집기에서 직접 테스트할 때는 이 함수를 실행할 것.

**`32_ACQReportStyles.js`**
- `applyACQReportStyles_(sheet, rowCount)` — % 컬럼(F,H,J) 서식, Revenue(N) 콤마, 테두리, 짝수 행 배경색(`#F3F3F3`)

## Config 참조 (`00_Config.js` — `CONFIG.ACQ`)

```javascript
ACQ: {
  SHEET: "ACQ_REP",
  SUMMARY_SHEET: "ACQ_Summary",
  ROWS: { CONTROL_HEADER: 1, CONTROL_VALUE: 2, REPORT_HEADER: 4, REPORT_DATA_START: 5 },
  COLUMNS: { START_FY: 1, START_MONTH: 2, END_FY: 3, END_MONTH: 4, GENERATE: 5 },
  ENGINE_START_COL: 15,
  SEGMENTS: [7개 세그먼트],
  FISCAL_MONTH_ORDER: ["AUG", ..., "JUL"]
}
```

⚠️ **2026-07-21 실제로 겪은 사고**: `SUMMARY_SHEET` 항목을 브라우저(Apps Script 편집기)에서 서버에 직접 추가했다가,
그 상태에서 로컬 파일 기준으로 `clasp push`를 다시 실행해서 그 직접 수정이 통째로 사라진 적이 있음.
**교훈: 서버(Apps Script 편집기)에서 직접 코드를 고치지 말고, 항상 로컬에서 고친 뒤 push할 것.**
불가피하게 서버에서 직접 고쳤다면, 다음 로컬 작업 전에 반드시 `clasp pull`로 동기화.

## `16_TransformHelper.js`에 추가된 헬퍼

- `getFiscalMonthLabel(date)` — 날짜 → "JUL" 같은 3글자 대문자 월 약어 (테스트: `testGetFiscalMonthLabel`)
- `getCalendarDateForFiscalMonth_(fy, monthLabel, day)` — FY+Month 라벨 → 실제 달력 Date (v1.2.0 이후 미사용,
  ACQ_Summary 도입으로 날짜 범위 스캔 로직 자체가 필요 없어졌으나 함수는 남겨둠)

## 겪었던 버그와 원인 (교훈 기록)

| 증상 | 원인 |
| --- | --- |
| 세그먼트가 1개만 나옴, All Leads가 너무 작게 나옴 | `endIndex` 계산 시 End Month의 첫 세그먼트 인덱스만 반영, 7개 세그먼트 블록 전체를 안 더함 |
| `targetRows is not defined` | 코드 교체 시 실수로 해당 변수 선언 줄이 같이 삭제됨 |
| JUN 값이 안 지워짐 | 위 `targetRows` 에러로 함수가 clear 블록 실행 전에 중단됨 (증상이지 원인이 아니었음) |
| 리포트가 여전히 느림 | Engine은 "월×세그먼트 조합 생성"용이지 "지표 캐싱"용이 아니었음 — 근본 원인은 매번 원본 전체 스캔 |
| `refreshACQSummary_()` 실행할 때마다 새 시트(Sheet9, Sheet10...) 생성 | `CONFIG.ACQ.SUMMARY_SHEET`가 `undefined`라 `getSheetByName(undefined)`가 매번 실패 → `insertSheet(undefined)`가 기본 이름으로 생성 |
| Import 후 갑자기 "No functions", Run 버튼 비활성화 | `split_csv.js`(Node 전용 유틸)가 실수로 프로젝트 폴더에 남아있다가 `clasp push`로 같이 올라감 → `require is not defined`가 최상위에서 발생해 전체 프로젝트 파싱 실패 |
| `refreshACQSummary_` 함수가 드롭다운에 안 뜸 | Apps Script는 이름 끝에 `_`가 붙은 함수를 private으로 취급해 Run 드롭다운에서 숨김 (버그 아님, 관례) → `runRefreshACQSummary()` 같은 공개 래퍼로 우회 |