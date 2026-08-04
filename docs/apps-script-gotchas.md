# Apps Script / clasp 운영상 주의사항 (실전에서 겪은 것들)

이 프로젝트를 진행하며 실제로 겪은 Google Apps Script / clasp 특유의 함정들. 새 작업 시작 전에 한 번 훑어볼 것.

## 1. 서버(브라우저 편집기) 직접 수정 금지
Apps Script 편집기에서 직접 코드를 고치면, 다음에 로컬 기준으로 `clasp push`를 실행하는 순간
그 직접 수정이 통째로 사라진다 (로컬이 서버를 덮어씀). **항상 로컬(VS Code)에서 수정 → push** 흐름만 사용할 것.
불가피하게 서버에서 직접 고쳤다면, 다음 로컬 작업 전에 `clasp pull`로 반드시 동기화.

## 2. 이름 끝에 `_`가 붙은 함수는 Run 드롭다운에 안 뜬다
Apps Script는 관례적으로 `functionName_()`처럼 끝에 언더스코어가 붙은 함수를 private/내부용으로 간주해서,
편집기의 수동 실행(Run) 드롭다운에서 숨긴다. 다른 함수 안에서 호출하는 건 전혀 문제없지만, **편집기에서
직접 테스트하려면 이름 끝에 `_`가 없는 공개 래퍼 함수를 하나 더 만들어야 한다** (예: `runRefreshACQSummary()`
→ 내부적으로 `refreshACQSummary_()` 호출).

## 3. Node.js 전용 스크립트는 프로젝트 폴더에 두지 말 것
로컬에서 `node split_csv.js` 같은 CSV 분할 유틸을 쓸 일이 있어서 clasp 프로젝트 폴더 안에 만들었다가,
`clasp push` 시 이 파일도 같이 Apps Script 프로젝트로 올라가버린 적이 있다. `require()` 같은 Node 전용
문법이 GAS 런타임에서 최상위 코드로 실행되며 즉시 에러를 던지고, 이게 **프로젝트 전체의 함수 목록
생성 자체를 막아서 "No functions" + Run 버튼 비활성화**로 이어졌다.
→ Node 전용 스크립트는 프로젝트 폴더 밖에 두거나, `.claspignore`에 등록해서 애초에 push 대상에서 제외할 것.

## 4. `clasp push`는 문법 오류만 잡지, 파일 간 충돌은 못 잡는다
같은 이름의 함수나 변수가 여러 파일에 걸쳐 중복 선언돼도 `clasp push` 자체는 성공(에러 없이 끝남)한다.
실제 실행 시점(`onEdit` 등)에야 `SyntaxError`나 `ReferenceError`로 드러난다.
→ 파일 하나씩 문법만 빠르게 검증하고 싶으면 로컬에서:
```powershell
Get-ChildItem *.js | ForEach-Object {
    Write-Host "----- $($_.Name) -----"
    node --check $_.FullName
}
```
단, 이건 순수 문법 검사만 하고 GAS 전용 객체(`SpreadsheetApp` 등)나 파일 간 중복 선언은 못 잡는다는 점 주의.

## 5. 브라우저에서 업로드/장시간 실행 중 "멈춘 것처럼 보이는" 상태
`google.script.run`으로 큰 CSV 텍스트를 서버에 보내거나, 오래 걸리는 함수를 실행하면 다이얼로그/브라우저가
멈춘 것처럼 보일 수 있다. 하지만 **서버에서 실행이 시작됐다면 브라우저를 새로고침/닫아도 서버 쪽 실행은
계속 진행되거나 이미 끝나있을 수 있다.** 성급하게 재시도하면 같은 작업이 중복 실행될 위험이 있으니,
먼저 Apps Script 편집기의 **실행(Executions) 탭**에서 실제로 끝났는지 확인부터 할 것.

## 6. `getHeaderMap()`류 0-based 인덱스와 falsy 체크
`headerMap["컬럼명"]`이 `0`(즉 그 컬럼이 시트의 첫 번째 컬럼)일 때, `if(!value)` 같은 falsy 체크를 쓰면
"컬럼이 없다"고 잘못 판단한다. 인덱스 존재 여부는 반드시 `=== undefined`로 명시적으로 체크할 것.
`getRange()`에 넘길 때도 0-based 인덱스를 그대로 쓰면 안 되고 `+1` 해서 1-based로 변환해야 한다.

## 7. 외부 스프레드시트 Date 값 — 스크립트 타임존과 다르면 날짜가 밀린다 (2026-07-28 실측)
`SpreadsheetApp.openById()`로 **다른** 스프레드시트(이 프로젝트가 바인딩된 스프레드시트가 아닌 외부 파일,
예: Deal Tracker)의 Date 셀을 읽을 때, 그 외부 시트의 타임존이 이 Apps Script 프로젝트의 타임존
(`appsscript.json`의 `timeZone`)과 다르면 `.getMonth()`/`.getDate()`/`.getFullYear()`가 **의도한 날짜보다
하루(또는 그 이상) 밀린 값**을 반환할 수 있다. 실측: 이 프로젝트 타임존은 `America/New_York`인데 Deal
Tracker(한국 관련 딜)는 다른 타임존이라, "2026-07-01"로 입력된 Close Date가 `.getMonth()`로는 6월(JUN)로
읽힘 — 시차가 자정을 가로지르는 날짜(특히 매달 1일)에서만 증상이 드러나 발견이 늦어짐.
→ 외부 스프레드시트의 Date 컬럼을 다룰 땐, `SpreadsheetApp.openById(id).getSpreadsheetTimeZone()`으로
그 시트의 타임존을 가져와 `Utilities.formatDate(date, sourceTimeZone, "yyyy-MM-dd")`로 "의도된" 연/월/일
문자열을 먼저 뽑고, 그 값으로 로컬 Date를 재구성한 뒤에 `.getMonth()` 등을 호출할 것 (`90_TargetEngine.js`
`normalizeExternalCalendarDate_()` 참고). 같은 스프레드시트에 바인딩된 시트(Leads_Master/MTA_Master 등)는
타임존이 이미 일치하므로 이 문제가 없다.

## 8. 워크북 전체 셀 개수 상한 (1,000만 셀) — 새 시트 생성이 조용히 막힐 수 있음 (2026-07-28 실측)
`ss.insertSheet()`로 새 시트를 만들려는데 워크북 전체(모든 시트 합산) 셀 개수가 Google Sheets의
1,000만 셀 상한에 근접해 있으면 `"This action would increase the number of cells in the workbook above
the limit of 10000000 cells"` 에러로 실패한다. 대용량 Master 시트(MTA_Master 8만+ 행 등)가 누적된
워크북에서는 임시 진단/QA용 새 시트 하나 만드는 것도 실패할 수 있음 — 실제로 이 프로젝트에서 발생.
→ 1회성 진단 함수는 가능하면 새 시트를 만들지 말고 `Logger.log()`로만 결과를 출력할 것. 정말 시트가
필요하면 기존 시트를 재사용(`clearContents()` 후 덮어쓰기)하거나, 먼저 불필요한 대형/임시 시트를 정리해
여유를 확보할 것.

**원인 실측(2026-07-28)**: Google Sheets의 셀 개수는 실제 데이터가 있는 셀이 아니라 시트에 할당된
그리드 크기(`getMaxRows()×getMaxColumns()`)로 계산된다 — `getLastRow()`/`getLastColumn()`(실사용 범위)
보다 훨씬 크게 할당된 시트가 있으면 그 차이만큼 낭비. 실측: 워크북 9,984,712/10,000,000(99.8%) 중
MTA_Raw(할당 123,205행 vs 사용 82,715행)와 Leads_OPS_QA(할당 34,983행 vs 사용 281행) 단 2개 시트가
전체 낭비의 67.6%를 차지.
→ `94_WorkbookMaintenance.js`의 `runTrimAllSheetsToUsedRange()` — 모든 시트를 실사용 범위 밖의 빈
행/열만 삭제(실제 데이터는 안 건드림, frozen 행/열보다 적게 안 남김)해 정리하는 범용 유틸리티. 실행
전후 `93_TempQA_DealTrackerMatch.js`의 `runReportWorkbookCellUsage()`로 효과 확인 가능.

**✅ 해결 완료 (2026-07-28)**: 21개 시트 전체에 `runTrimAllSheetsToUsedRange()` 실행 — 92,350행/200열
삭제, 에러 없음. 워크북 전체 9,984,712(99.8%) → **6,593,702(65.9%)**로, 낭비 셀 0으로 정리됨. 앞으로
비슷한 문제가 재발하면(대형 Raw/Master 시트가 다시 실사용 범위보다 크게 할당되면) 이 두 함수를
다시 실행하면 됨.

## 9. `onEdit()` Simple Trigger는 외부 스프레드시트를 못 연다 (2026-07-27/2026-07-30 두 번 실측)

체크박스 등으로 `onEdit()` Simple Trigger가 실행하는 함수 안에서 `SpreadsheetApp.openById()`로
**다른**(이 프로젝트가 바인딩된 스프레드시트가 아닌) 외부 파일을 열면 `"Specified permissions are
not sufficient to call SpreadsheetApp.openById. Required permissions:
https://www.googleapis.com/auth/spreadsheets"` 에러로 실패한다. Simple Trigger는 스크립트 소유자의
전체 권한이 아니라 제한된 권한으로 실행되기 때문 — 에러가 사용자 화면엔 안 뜨고(Simple Trigger는
UI 경고도 못 띄움) Apps Script 편집기의 **Executions(실행 기록)** 패널에서 Cloud Logs로만 확인 가능해서,
"체크박스를 눌러도 조용히 아무 일도 안 일어난다"는 증상으로만 나타나 원인 파악이 오래 걸릴 수 있다.

**같은 문제를 두 번 겪음**:
- 2026-07-27, `Target_REP`: 외부 채널시트/Naver gid를 참조하는 리포트 생성 로직을 체크박스+`onEdit()`
  으로 구현했다가 발견 — **해결 방식: 체크박스를 버리고 `runGenerateTargetReport()` 수동 실행 진입점
  으로 전환**(`docs/TargetReportDesign.md` 참고). 직접 Run은 Full Authorization이라 제약이 없음.
- 2026-07-30, `ACQ_REP`: 캠페인 지출 자동 통합(AD_002_Meta.js)을 ACQ_REP에 연결하며 재발 — 이번엔
  ACQ_REP의 기존 체크박스 UX(자주 쓰는 워크플로)를 유지하고 싶어서 다른 해법 채택: **`ACQ_Summary`와
  동일한 캐시 패턴** — 외부 시트를 읽는 계산은 별도 함수(`refreshMetaSpendCache_()`)로 분리해 사용자가
  수동으로만 실행하고, 그 결과를 같은(바인딩된) 스프레드시트 안 캐시 시트에 저장 → `onEdit()`이
  실행하는 함수는 그 캐시만 읽는다(`readMetaSpendCacheMap_()`, 외부 열기 없음 → Simple Trigger 안전).

→ **두 가지 해법 중 상황에 맞게 선택**: (1) 체크박스 자체를 버리고 수동 Run 진입점으로 전환(리포트가
새 것이거나 체크박스 UX가 덜 중요할 때), (2) 외부 읽기를 캐시 갱신용 별도 수동 함수로 분리하고
Simple Trigger가 실행하는 함수는 같은 스프레드시트의 캐시만 읽게 만들기(기존 체크박스 워크플로를
유지하고 싶을 때, ACQ_Summary가 이미 쓰던 패턴). 새 리포트/컬럼에 외부 스프레드시트 데이터를 연결할
땐, 그 리포트의 Generate가 체크박스(`onEdit()`)인지 수동 Run인지부터 먼저 확인할 것 — 체크박스라면
이 문제를 반드시 고려해야 한다.

## 10. `ScriptApp.getService().getUrl()`은 편집기에서 직접 Run하면 `/exec`가 아니라 `/dev` URL을 돌려준다 (2026-08-04 실측)

웹 앱으로 배포된 프로젝트에서 `ScriptApp.getService().getUrl()`은 "그 배포의 URL을 동적으로 알려주는
함수"로 알려져 있어, OAuth 콜백처럼 외부 서비스에 미리 등록해야 하는 Redirect URI를 하드코딩 없이
가져오려는 용도로 쓰고 싶어진다(카카오모먼트 비즈니스 인증 연동 중 실제로 이렇게 시도함).

**실제로는 실행 컨텍스트에 따라 다른 값을 돌려준다**:
- 실제로 배포된 `/exec` URL로 웹 요청이 들어와서 `doGet()`/`doPost()`가 실행되는 중이면 → 정확한
  `/exec` URL을 돌려줌.
- Apps Script **편집기에서 함수를 직접 Run**하면(수동 실행) → 배포된 `/exec`가 아니라 **개발용
  `/dev` URL**(도메인 경로도 `/a/도메인/macros/s/.../dev` 형태로 다름)을 돌려줌 — 이 값은 외부
  서비스(카카오 등)에 등록된 값과 다르므로, 이 URL로 OAuth 인가 요청을 보내면 리다이렉트가
  등록 안 된 곳으로 가서 "Script function not found: doGet" 같은 애매한 에러로 이어진다.

→ **Redirect URI처럼 외부에 미리 등록해야 하는 배포 URL은 동적으로 가져오지 말고, 실제 배포 후
나온 `/exec` URL을 Config에 그대로 박아둘 것.** 재배포로 URL이 바뀔 수 있는 경우(새 배포를
만들면 바뀌고, 기존 배포를 "관리 > 편집"하면 안 바뀜)를 대비해 그 사실을 주석으로 남겨두면
다음에 재배포할 때 Config 값도 같이 갱신해야 한다는 걸 놓치지 않는다.