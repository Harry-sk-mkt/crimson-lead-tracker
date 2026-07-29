#!/usr/bin/env bash
# check-naming.sh — staged .js diff에서 새로 추가되는 test/run 진입점 함수명이
# `_`로 끝나는 실수를 잡는다.
#
# 배경: Apps Script는 이름 끝에 `_`가 붙은 함수를 private로 간주해 편집기 Run
# 드롭다운에서 숨긴다(docs/apps-script-gotchas.md #2). `testXXXX()`/`runXXXX()`처럼
# 사용자가 Apps Script 편집기에서 직접 Run해야 하는 함수는 끝에 `_`를 붙이면 안 된다
# (CLAUDE.md 핵심 원칙 #19) — 내부 헬퍼(`xxxx_()`)와 헷갈려 반복적으로 실수가 났던 항목.
#
# 주의: diff의 추가(+)된 줄만 검사한다. 코드베이스에는 이미 알려진 위반 사례가
# 남아있다(예: 24_OPSQA.js의 testFindExactDuplicateTouchRowsToDelete_() — 사용자가
# 그대로 두기로 결정, CLAUDE.md 미해결 항목 #13). 파일 전체를 스캔하면 그 줄을 건드리지
# 않는 무관한 커밋까지 매번 차단하게 되므로, "이번에 새로 추가되는 줄"만 검사 대상이다.

set -euo pipefail

pattern='^\+[[:space:]]*function[[:space:]]+(test|run)[A-Za-z0-9]*_[[:space:]]*\('
failed=0

staged_js_files="$(git diff --cached --name-only --diff-filter=ACM -- '*.js')"

for f in $staged_js_files; do
  matches="$(git diff --cached -U0 -- "$f" | grep -nE "$pattern" || true)"
  if [ -n "$matches" ]; then
    echo "❌ $f — test/run 진입점 함수명이 '_'로 끝남 (Run 드롭다운에서 숨겨짐):"
    echo "$matches" | sed 's/^/    /'
    failed=1
  fi
done

if [ "$failed" -ne 0 ]; then
  echo ""
  echo "   testXXXX()/runXXXX() 형태 진입점 함수는 끝에 '_'를 붙이면 안 됩니다."
  echo "   내부 헬퍼 함수(xxxx_())와는 다른 규칙입니다 — CLAUDE.md 핵심 원칙 #19,"
  echo "   docs/apps-script-gotchas.md #2 참고."
fi

exit $failed
