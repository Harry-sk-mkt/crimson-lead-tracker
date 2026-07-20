# Architecture: ETL Pipeline (Marketing 2.0)

> Source: 원본 Architecture 문서 + 2026-07-21 대화 기준 업데이트
> Status: 확정

## Philosophy

Marketing 2.0은 Staged ETL 아키텍처를 따른다. 각 Stage는 하나의 책임만 가진다.

```
CSV → Import → Raw → Master Build → Master → Leads_OPS → Reports → Dashboard
```

- 모든 Stage는 독립적으로 실행 가능해야 한다.
- Business logic은 오직 Master Build Stage에만 존재한다.

## Stage 구조

```
Stage 00  Import
   ↓
Stage 10  Master Build
   ↓
Stage 20  Reporting
```

---

## Stage 00 — Import

**Purpose:** 외부 소스 CSV 파일을 Raw 테이블로 임포트

**Responsibilities**
- 소스 파일 읽기 (CsvReader)
- 레코드 파싱 (Parser)
- 필수 필드 검증 (Validator, `CONFIG.REQUIRED_FIELDS` 기준)
- 원본 소스 데이터 보존 (텍스트 그대로, Plain Text 강제)
- Raw 테이블에 **Append** (2026-07-21부터: 매번 전체 삭제/재작성 방식에서 append 방식으로 전환)

**Must NOT**
- Business rule 적용
- Master 빌드
- 리포트 생성
- 지표 계산

**Output:** `Leads_Raw`, `MTA_Raw`

파일 구성은 실제 구축된 구조 기준: `import-pipeline-actual-structure.md` 참고.

---

## Stage 10 — Master Build

**Purpose:** Raw 테이블을 표준화된 Master 데이터로 변환

**두 가지 실행 모드 (2026-07-21 확정)**

1. **Incremental Append (기본, 성능 목적)**
   - `PropertiesService`에 저장된 `LEADS_LAST_PROCESSED_ROW`/`MTA_LAST_PROCESSED_ROW` 기준으로, Raw에 새로 추가된 행만 Transform하여 Master에 append.
   - Master를 `Create Date`(Leads) / `MTA Created Date`(MTA) 기준 내림차순 정렬.
   - 메뉴: 🏗️ Append → "Append New Leads" / "Append New MTA"

2. **Full Rebuild (복구/Business Rule 변경 시, 스크립트 편집기에서 수동 실행 전용 — 메뉴 노출 안 함)**
   - Raw 전체를 다시 읽어 Master 전체를 재계산.
   - 함수: `rebuildLeadsMaster()`, `rebuildMTAMaster()`
   - Rebuild 후 Incremental 카운터를 Raw 전체 길이로 리셋 (Append 중복 방지).

**Output:** `Leads_Master`, `MTA_Master`

---

## Stage 20 — Reporting

**Purpose:** 대시보드 및 KPI 리포트 생성 (현재 미구현 — 메뉴/함수 placeholder만 존재)

**Responsibilities**
- Master 읽기
- **Leads_OPS 참조** (구 "Operational Sheets" 개념을 대체함 — 아래 참고)
- 지표 집계 / KPI 계산 / 리포트·대시보드 생성

**Must NOT**
- Master 수정
- CSV 읽기
- Business rule 적용

---

## Data Flow (확정본, 2026-07-21 업데이트)

```
CSV → Raw (Append) → Master (Incremental Append / Full Rebuild) → Leads_OPS → Reports → Dashboard
```

의존성은 항상 단방향이다.

**절대 금지**
- Reports → Master (역방향)
- Master → Raw (역방향)

---

## 레거시 — "Operational Sheets (Lead Tracker, SAL, IC, FTA 등)"

원본 문서는 Stage 10 산출물로 "Operational Sheets (Lead Tracker, SAL, IC, FTA 등)"를 언급했으나,
**이는 레거시**이며 현재는 `Leads_OPS` 단일 레이어가 이 역할을 대체한다.
`Leads_OPS`는 Salesforce weekly snapshot(`Leads_Master`)과 실무 데이터 사이의 중간 계층으로,
"Operational Sheets are Disposable / 수동편집 금지" 원칙의 예외 레이어이다.
자세한 내용: `operations-layer-leads-ops.md`

## Future Expansion

```
00 Import → 10 Master Build → 20 Reporting → 30 Dashboard → 90 QA
```

이전 Stage가 이후 Stage에 의존해서는 안 된다.