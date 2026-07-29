#!/usr/bin/env bash
# check-duplicate-declarations.sh — 커밋될 상태(index) 기준으로 여러 .js 파일에
# 걸쳐 동일한 최상위 function/const 이름이 중복 선언돼 있는지 검사한다.
#
# 배경: GAS는 모든 파일이 하나의 전역 네임스페이스를 공유한다. 같은 이름이 여러
# 파일에 중복 선언돼도 clasp push나 node --check 문법 검사는 통과하고, 실제 실행
# 시점(onEdit 등)에야 SyntaxError/ReferenceError로 드러난다 (docs/apps-script-gotchas.md #4).
# 기존에 수동으로 쓰던 검증 커맨드를 그대로 pre-commit에 편입:
#   grep -hoE "^(function|const) [A-Za-z0-9_]+" *.js | sort | uniq -c | awk '$1>1'
#
# 인덱스(staged) 버전 기준으로 검사한다 — 부분 스테이징(git add -p) 시 작업 디렉토리
# 파일과 실제 커밋될 내용이 다를 수 있기 때문.

set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

git ls-files '*.js' | while IFS= read -r f; do
  git show ":$f" > "$tmp/$(basename "$f")" 2>/dev/null || true
done

dupes="$(grep -hoE '^(function|const) [A-Za-z0-9_]+' "$tmp"/*.js 2>/dev/null | sort | uniq -c | awk '$1>1' || true)"

if [ -n "$dupes" ]; then
  echo "❌ 여러 .js 파일에 걸쳐 중복 선언된 이름이 있습니다 (GAS 전역 네임스페이스 공유):"
  echo "$dupes"
  exit 1
fi

exit 0
