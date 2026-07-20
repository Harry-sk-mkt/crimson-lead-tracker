# Fiscal Calendar Rule

## Fiscal Year

| Period | Fiscal Year |
| --- | --- |
| Aug – Dec | 다음 Fiscal Year |
| Jan – Jul | 현재 Calendar Year의 Fiscal Year |

**Example**
- 2026-08-15 → FY27
- 2026-12-01 → FY27
- 2027-01-20 → FY27
- 2027-07-31 → FY27

## Fiscal Quarter

| Quarter | Months |
| --- | --- |
| Q1 | August – October |
| Q2 | November – January |
| Q3 | February – April |
| Q4 | May – July |

**Example**

| Date | FY | Quarter |
| --- | --- | --- |
| 2026-08-01 | FY27 | Q1 |
| 2026-11-15 | FY27 | Q2 |
| 2027-02-10 | FY27 | Q3 |
| 2027-06-20 | FY27 | Q4 |

## 구현 위치
`16_TransformHelper.js`의 `getFiscalYear()`, `getQuarter()` — 2026-07-21 단위 테스트로 검증 완료.