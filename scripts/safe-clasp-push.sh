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
# --force: TTY가 없는 환경(이 harness 등)에서 clasp가 자체 확인 프롬프트를
# 렌더링하지 못하고 "Skipping push."로 조용히 아무것도 안 하고 종료되는 것을
# 실측 확인(2026-07-30, clasp 3.3.0) — 이 래퍼 자체가 이미 위에서 worktree
# 확인/y-n 게이트를 거치므로, clasp의 중복 확인은 안전하게 건너뛴다.
clasp push --force "$@"

# ---------------------------------------------------------------------------
# 삭제 전용 push 무시 버그 감지 (2026-09-16 발견, docs/OpenItems.md #52 조사 중)
#
# clasp 3.3.0의 `push`는 getChangedFiles()가 "로컬 파일 목록"만 순회하며 원격과
# 비교한다(files.js:304) — 원격에만 존재하고 로컬엔 없는 파일(=삭제 대상)은 애초에
# 비교 대상에 안 들어가 "변경"으로 잡히지 않는다. 그 결과 이번 push에서 실제
# 콘텐츠 차이가 "파일 삭제"뿐이면 clasp는 API 호출(updateContent) 자체를 건너뛰고
# "Script is already up to date."만 출력한다 — 삭제가 조용히 실패하는데 성공한
# 것처럼 보인다(-f/--force도 매니페스트 확인용일 뿐 이 경로엔 영향 없음).
#
# 실측 사례: TEMPQA_060_ICFunnelBookedCompletedFullBackfill.js를 로컬에서
# 삭제하고 push했지만 원격 컨테이너에 그대로 남아있었음 — 재pull로 확인.
#
# 이 블록은 매 push 후 임시 디렉토리에 원격을 pull해 파일명만 로컬과 diff하고,
# 로컬에 없는 원격 전용 파일이 있으면 경고만 한다(자동 삭제/자동 재push는 하지
# 않음 — 삭제 전용 push는 이 스크립트로 재시도해도 같은 이유로 계속 무시되므로,
# Apps Script 편집기에서 직접 삭제하는 것이 유일하게 확실한 방법).
echo ""
echo "삭제 동기화 확인 중 (원격 전용 파일 감지)..."
orphan_check_dir="$(mktemp -d)"
cp .clasp.json "$orphan_check_dir/"
if npx clasp pull -P "$orphan_check_dir" >/dev/null 2>&1; then
  remote_only="$(comm -13 \
    <(ls -1 | grep -E '\.(js|gs|json|html)$' | sort) \
    <(ls -1 "$orphan_check_dir" | grep -E '\.(js|gs|json|html)$' | sort))"
  if [ -n "$remote_only" ]; then
    echo "⚠️  경고: 로컬엔 없고 원격 컨테이너에만 남아있는 파일이 있습니다 (삭제 push가 무시됐을 가능성):"
    printf '%s\n' "$remote_only" | sed 's/^/   - /'
    echo "   위 clasp 버그 설명 참고 — Apps Script 편집기에서 직접 삭제하세요."
  else
    echo "✅ 원격 전용 파일 없음 (삭제 동기화 정상)."
  fi
else
  echo "   (원격 pull 실패 — 삭제 동기화 확인 생략)"
fi
rm -rf "$orphan_check_dir"
