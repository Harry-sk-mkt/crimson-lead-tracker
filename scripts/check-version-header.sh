#!/usr/bin/env bash
# check-version-header.sh — 코드가 바뀐 staged .js 파일이 파일 상단 헤더의
# Version/Change Log도 함께 갱신했는지 검사한다 (docs/NamingConvention.md
# "File Versioning" 규칙, CLAUDE.md 핵심 원칙).
#
# 방식: 파일의 헤더(첫 '/** ... */' 블록) 끝 라인 번호를 구한 뒤, 이번 커밋의 diff
# 히스토리 hunk들이 헤더 밖(코드 영역)만 건드리고 헤더 안(Version 근처)은 전혀
# 건드리지 않았다면 실패 처리한다.
#
# 알려진 한계 (최소 구성 원칙): 헤더 밖 diff가 "주석만 고친 경우"(예외 대상)인지
# "실제 코드 변경"인지는 구분하지 않는다 — 주석만 고쳤는데도 걸릴 수 있음. 신규 파일
# (Added)은 헤더 자체가 새로 생기므로 검사 대상에서 제외.

set -euo pipefail

failed=0
staged_js_files="$(git diff --cached --name-only --diff-filter=M -- '*.js')"

for f in $staged_js_files; do
  header_end="$(git show ":$f" | grep -n -m1 '\*/' | cut -d: -f1 || true)"
  if [ -z "$header_end" ]; then
    # 표준 헤더가 없는 파일 — 이 검사 대상 아님
    continue
  fi

  code_changed=0
  header_changed=0
  while IFS= read -r hunk_start; do
    [ -z "$hunk_start" ] && continue
    if [ "$hunk_start" -gt "$header_end" ]; then
      code_changed=1
    else
      header_changed=1
    fi
  done < <(git diff --cached -- "$f" | grep -oE '^@@ -[0-9]+(,[0-9]+)? \+[0-9]+' | sed -E 's/.*\+([0-9]+)/\1/')

  if [ "$code_changed" -eq 1 ] && [ "$header_changed" -eq 0 ]; then
    echo "❌ $f — 코드가 변경됐지만 Version/Change Log 헤더(1~${header_end}행) 갱신이 감지되지 않음"
    failed=1
  fi
done

if [ "$failed" -ne 0 ]; then
  echo ""
  echo "   파일 상단 헤더의 Version을 올리고 Change Log에 항목을 추가하세요"
  echo "   (docs/NamingConvention.md 'File Versioning' 섹션 참고)."
  echo "   순수 주석/문서 수정이라 예외 대상이라고 판단되면, 그 판단 자체를 커밋"
  echo "   메시지에 남기고 Version은 그대로 두는 방식을 권장 (임의 우회 금지)."
fi

exit $failed
