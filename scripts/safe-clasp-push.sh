#!/usr/bin/env bash
# safe-clasp-push.sh — `clasp push` 전에 다른 git worktree의 존재를 강제로 보여주고 확인받는 래퍼.
#
# 배경 (CLAUDE.md 미해결 항목 #15, 2026-07-29 사고):
#   linked worktree(worktree-clever-seeking-dolphin)가 이 scriptId에 Target_REP
#   New/Pipeline Block C/D 코드를 이미 라이브로 배포해둔 상태에서, 이후 세션이
#   `git worktree list` 확인 없이 **main worktree에서** `clasp push`를 반복하다가
#   그 라이브 코드를 main의 (더 오래된) 로컬 파일 상태로 덮어써 Target_REP가 0으로
#   표시되는 사고가 발생했다.
#
#   핵심: 위험은 "어느 worktree에서 push하는가"가 아니라 "다른 worktree가 이
#   scriptId에 뭔가 배포해뒀을 수 있다는 사실 자체를 잊는 것"이다. 그래서 이 스크립트는
#   현재 위치가 main이든 linked worktree든 상관없이, worktree가 2개 이상 존재하면
#   항상 목록을 보여주고 명시적 확인을 받는다 (2026-07-29 사용자 확정 정책).
#
# Usage: scripts/safe-clasp-push.sh [clasp push에 그대로 전달할 인자...]

set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

worktree_list="$(git worktree list)"
worktree_count="$(printf '%s\n' "$worktree_list" | wc -l)"
current_worktree="$(pwd)"
script_id="$(grep -o '"scriptId"[[:space:]]*:[[:space:]]*"[^"]*"' .clasp.json | sed -E 's/.*"([^"]+)"$/\1/')"

echo "=== git worktree list ==="
printf '%s\n' "$worktree_list"
echo "=========================="
echo "현재 push 위치: $current_worktree"
echo "대상 scriptId : $script_id"

if [ "$worktree_count" -ge 2 ]; then
  echo ""
  echo "⚠️  경고: 이 저장소에 worktree가 ${worktree_count}개 존재합니다."
  echo "   위 목록의 다른 worktree가 같은 scriptId(${script_id})에 이미 코드를"
  echo "   배포해뒀을 수 있고, 지금 이 push가 그 코드를 덮어쓸 수 있습니다."
  echo "   (2026-07-29 사고: main worktree에서 이 확인 없이 push하다가 linked"
  echo "   worktree가 배포해둔 Target_REP 코드를 덮어씀 — CLAUDE.md 항목 #15 참고)"
  echo ""
  read -r -p "위 worktree들의 최근 배포 상태를 확인했고, 그래도 push를 진행하시겠습니까? (y/N) " confirm
  case "$confirm" in
    y|Y|yes|YES) ;;
    *)
      echo "취소되었습니다. push하지 않았습니다."
      exit 1
      ;;
  esac
fi

echo ""
echo "clasp push 실행..."
clasp push "$@"
