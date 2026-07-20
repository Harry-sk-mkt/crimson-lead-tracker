# Import Date Parsing Bug

## 현상
Salesforce CSV export의 날짜 값이 CSV를 워크시트로 읽어오는 과정에서 잘못 해석될 수 있다.

**Example**
- Salesforce 원본: `1/6/2026` = 2026년 6월 1일 (Jun 1st, DMY)
- 워크시트 자동 임포트 시: 2026년 1월 6일(Jan 6th)로 잘못 해석될 위험 (day가 12 이하일 때 ambiguous)

## Root Cause
Google Sheets의 Import 과정이 텍스트를 자동으로 Date 객체로 변환하며 locale을 추측한다.
한 번 변환되면 원본 텍스트는 영구적으로 손실된다.

## 상태 — ✅ 2026-07-21 구현 완료 및 검증됨

**구현 내용**
- `CONFIG.RAW_DATE_COLUMNS`에 보호 대상 컬럼 목록 중앙화 (Leads: Create Date, IC Booked/Completed/Won Date / MTA: MTA Created Date, Lead Created Date)
- `05_SheetWriter.js`의 `appendSheetRecords()`/`writeSheetRecords()`가 해당 컬럼에 `setNumberFormat("@")`를 **값을 쓰기 전에** 적용하여 Plain Text 강제
- 날짜는 `16_TransformHelper.js`의 `parseDMY()`를 통해서만 명시적으로 Date 객체 생성 (Master Build 단계)

**검증 결과**
- `parseDMY()` 단위 테스트 4/4 통과
- 실제 `Leads_Raw` 데이터(`1/6, 2/6, 3/6...` 순차 증가 패턴)로 DMY 해석이 맞다는 것 교차 확인
- `Leads_Master`의 `Created FY`/`Created Quarter` 파생값도 정상 확인됨

## ⚠️ 검증 시 주의사항
Raw 시트 위에서 `YEAR()`/`MONTH()` 같은 **스프레드시트 수식**으로 텍스트 컬럼을 직접 확인하면,
Google Sheets가 수식 내부에서 자체적으로 locale 추측 변환을 하기 때문에 **착시로 잘못된 결과가 보일 수 있다.**
검증은 반드시 Apps Script 파서(`parseDMY` 등) 또는 `Leads_Master`의 파생 필드 기준으로 할 것.