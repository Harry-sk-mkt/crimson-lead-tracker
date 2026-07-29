#!/usr/bin/env bash
# start-session.sh — 세션 시작 시 한 번 실행하는 git 상태 점검.
# CLAUDE.md의 "Session-Start Git Sync Check" prose 절차를 스크립트로 대체한다.
#
# 확인 항목:
#   1. git fetch 후 로컬/origin divergence (2026-07-24 사고: 7개 커밋 divergence를
#      모른 채 작업하다가 서버 코드 유실 + 로컬 재구성 이중 사고로 번짐)
#   2. git worktree list (2026-07-29 사고: 다른 worktree가 배포해둔 라이브 코드를
#      모르고 main에서 clasp push로 덮어씀 — CLAUDE.md 항목 #15)
#   3. core.hooksPath가 .githooks로 설정돼 있는지 (안 돼 있으면 pre-commit 검사
#      자체가 동작하지 않음 — clone 직후 설치 누락 방지)

set -uo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

echo "=== 1. git fetch + divergence 확인 ==="
git fetch

behind="$(git log --oneline main..origin/main)"
ahead="$(git log --oneline origin/main..main)"

if [ -z "$behind" ] && [ -z "$ahead" ]; then
  echo "✅ origin/main과 동기화됨 (divergence 없음)."
else
  if [ -n "$behind" ]; then
    echo "⚠️  로컬이 origin보다 뒤처짐 — origin에만 있는 커밋:"
    echo "$behind" | sed 's/^/    /'
  fi
  if [ -n "$ahead" ]; then
    echo "⚠️  로컬이 origin보다 앞섬 — 로컬에만 있는 커밋(아직 push 안 됨):"
    echo "$ahead" | sed 's/^/    /'
  fi
  echo "   → 코드 수정 전에 이 divergence의 의미를 먼저 파악할 것 (CLAUDE.md 참고)."
fi

echo ""
echo "=== 2. git worktree list ==="
worktree_list="$(git worktree list)"
worktree_count="$(printf '%s\n' "$worktree_list" | wc -l)"
printf '%s\n' "$worktree_list"
if [ "$worktree_count" -ge 2 ]; then
  echo "⚠️  worktree가 ${worktree_count}개 존재합니다 — clasp push 전 반드시"
  echo "   scripts/safe-clasp-push.sh를 통해 확인할 것 (2026-07-29 사고 참고)."
fi

echo ""
echo "=== 3. pre-commit hook 설치 여부 ==="
hooks_path="$(git config --get core.hooksPath || true)"
if [ "$hooks_path" = ".githooks" ]; then
  echo "✅ core.hooksPath=.githooks 설정됨."
else
  echo "❌ core.hooksPath가 .githooks로 설정돼 있지 않음 (현재: '${hooks_path:-<미설정>}')."
  echo "   pre-commit 검사(naming/version-header/중복선언/문법)가 동작하지 않습니다."
  echo "   설치: git config core.hooksPath .githooks"
fi

echo ""
git status
