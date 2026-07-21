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