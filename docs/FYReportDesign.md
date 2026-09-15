# FY_REP Design (FY별 Sales Funnel 대시보드)

FY_REP은 두 차례 설계가 뒤집힌 이력이 있다:

1. **2026-07-30**: 최초 설계 검토 — 결국 "채택 안 함(superseded)"으로 결론, 대신 기존
   `ACQ_REP`/`NewP1_REP`에 Target 컬럼만 추가하는 방식으로 대체하기로 결정.
2. **2026-08-07**: 사용자가 FY24/25/26 monthly Segment/Sales Funnel 비교를 다시 요청하며
   재착수 — 1번의 판단을 뒤집고, 1번 때와는 구조가 상당히 다른(Marketing/ACQ/Pipeline/
   Revenue 4섹션, 세그먼트 7개, 플랫폼별 채널 데이터 포함) 독립 `FY_REP` 시트로 최종 확정,
   구현 완료.

**현재 설계/구현은 아래를 볼 것** (이 문서는 더 이상 최신 설계를 담고 있지 않음):
- `docs/exec-plans/completed/2026-08-07-fy-rep-implementation.md` — 구현 당시 설계/진행 기록
- `FYREP_001_Engine.js`/`FYREP_002_Report.js` — 실제 코드 (Source of Truth)
- `CLAUDE.md`의 문서 목록 — 최신 상태 한 줄 요약

1번(2026-07-30) 검토 당시의 원래 설계 초안 전문은 순수 역사 기록으로 `docs/FYReportDesign_Legacy.md`에
보존돼 있다 — 실제로 채택되지 않았으므로 참고용일 뿐 현재 구현을 이해하는 데는 필요 없다.

관련 로드맵 항목: `docs/Roadmap.md` "계획 중" §"FY별 Sales Funnel 대시보드"(있다면 완료로 갱신 필요 — 미확인)
관련 문서: `docs/NewP1ReportDesign.md`(패턴 재사용), `docs/TargetReportDesign.md`(Deal Share/Spent 소스)
