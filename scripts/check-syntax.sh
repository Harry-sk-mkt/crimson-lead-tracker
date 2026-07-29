#!/usr/bin/env bash
# check-syntax.sh — staged .js 파일의 index(커밋될) 내용을 node --check로 문법 검사.
#
# 순수 문법 검사만 한다 — GAS 전용 전역 객체(SpreadsheetApp 등)는 Node에 없어서 이
# 검사와 무관하며, 파일 간 중복 선언은 못 잡는다(별도 check-duplicate-declarations.sh
# 담당). docs/apps-script-gotchas.md #4 참고.

set -euo pipefail

staged_js_files="$(git diff --cached --name-only --diff-filter=ACM -- '*.js')"
if [ -z "$staged_js_files" ]; then
  exit 0
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

failed=0
for f in $staged_js_files; do
  tmp_file="$tmp/$(basename "$f")"
  git show ":$f" > "$tmp_file"
  if ! node --check "$tmp_file" 2>"$tmp/err.txt"; then
    echo "❌ $f: 문법 오류 (아래 경로는 임시 검사 파일이며 실제 파일 경로가 아님)"
    cat "$tmp/err.txt"
    failed=1
  fi
done

exit $failed
