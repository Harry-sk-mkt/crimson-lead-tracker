/**
 * ==========================================================
 * Marketing 2.0
 * Ad Spend — Kakao Channel Import/Transform (3번째 플랫폼)
 *
 * Responsibility
 * 카카오톡 채널 푸시 발송 성과 시트(사용자가 기존에 수기로 관리해온 별도
 * 스프레드시트, `AD.KAKAO_CHANNEL.SPREADSHEET_ID`, 탭 "Performance")를 읽어
 * (FY|Month|Segment)별 Spent(KRW)로 변환/집계한다.
 *
 * **Meta/Naver Search와의 차이(2026-07-31 사용자 확인)**:
 * - Meta/Naver Search와 달리 이 시트는 AD.SPREADSHEET_ID 안이 아니라 완전히
 *   별도 스프레드시트라 자체 SPREADSHEET_ID로 접근.
 * - 1행=subtotal(사용자 수식), 2행=헤더, 3행부터 데이터 — Meta_Raw/NaverSA_Raw의
 *   "1행=헤더" 관례와 달라 `sheetToObjects()`(22_OPS_Merge.js, 항상 1행을
 *   헤더로 가정)를 그대로 못 씀. 이 파일 전용 리더를 별도로 둔다.
 * - `SentAt`이 정확한 단일 발송 날짜라, Meta처럼 캠페인 활성기간에 걸친
 *   lifetime 균등분배 로직이 필요 없다(Naver Search와 동일하게 단순 귀속).
 * - Segment 분류는 새 캠페인명 기반 로직(getBusinessSegment()) 없이 `Event
 *   type` 컬럼 값을 그대로 사용 — 사용자가 기존 "Direct Consult"를 전부
 *   "BOFU"로 이미 정정 완료해서 Business Segment 이름과 1:1 일치(Seminar/
 *   Webinar/BOFU뿐, Search/Content 해당 없음).
 * - Cost는 KRW — NZD 변환은 이 파일에서 하지 않고 AD_004_SpendCache.js가
 *   Naver Search와 동일하게 처리.
 *
 * **카카오모먼트 이관 시 이 파이프라인은 폐기 예정(사용자 확인)** — 모먼트
 * Open API 권한 심사 통과 후 별도 파일로 대체될 때까지만 유지되는 임시
 * 소스. 상세: docs/exec-plans/active/2026-07-30-campaign-spend-integration.md
 *
 * Must NOT
 * - 새 Business Segment 분류 로직 작성 (Event type 값을 그대로 사용)
 * - KRW→NZD 환율 변환 (AD_004_SpendCache.js 책임)
 * - Target_Engine/ACQ_REP에 직접 쓰기 (AD_004_SpendCache.js를 거쳐야 함)
 * - `syncKakaoChannelPerformanceToAD_()`가 이미 복사한 행을 다시 덮어쓰기
 *   (PIC 수동 입력값 보존을 위해 append-only여야 함, 아래 WHY 참고)
 *
 * Stage
 * AD (2026-07-30 네이밍 컨벤션)
 *
 * Version
 * v1.2.2
 *
 * Change Log
 * v1.2.2 (2026-08-06)
 * - `syncKakaoChannelPerformanceToAD_()` 끝에 `applyKakaoSMSRawStyling_()`
 *   (AD_006_KakaoMoments.js 신규) 호출 추가 — 어느 sync 경로로 갱신되든
 *   숫자 서식/CTR·CvR 수식/테두리가 일관되게 유지되도록(사용자 요청).
 * v1.2.1 (2026-08-06)
 * - **버그 수정 — `syncKakaoChannelPerformanceToAD_()`가 시트를 새로 만들 때
 *   "Message Ad ID"(1열) 숨김 처리 누락**. 사용자가 API sync보다 먼저 수기
 *   sync를 돌려 밀린 최신 행부터 KakaoSMS_Raw에 반영하기로 함(2026-08-06) —
 *   이 경로로 시트가 먼저 생성될 수 있어, `syncKakaoMomentsReportToKakaoSMSRaw_()`
 *   (AD_006_KakaoMoments.js)와 동일하게 `hideColumns(1)` 추가.
 * v1.2.0 (2026-08-06)
 * - **`computeKakaoChannelSpendSummary_()`를 `KakaoSMS_Raw` 소스로 리포인트
 *   (카카오모먼트 API 이관)**. 신규 `readKakaoSMSRawRows_()`(AD.SPREADSHEET_ID
 *   내부 KakaoSMS_Raw 읽기, AD_006_KakaoMoments.js의 sync 함수가 채움)로
 *   교체 — 기존 `readKakaoChannelRawRows_()`(외부 수기 Performance 시트)는
 *   `syncKakaoChannelPerformanceToAD_()`/`runDebugKakaoChannelRawFirstRow()`가
 *   계속 쓰므로 그대로 유지(코드 삭제 안 함, Decision Log상 그 함수 자체를
 *   더 이상 안 돌리는 것으로 전환 완료 처리). 상세:
 *   docs/exec-plans/active/2026-08-04-kakao-moments-api-integration.md
 * v1.1.0 (2026-07-31)
 * - **`KakaoSMS_Raw` 뷰 탭 동기화 기능 추가(사용자 요청 — "API로 가져오더라도
 *   어차피 performance는 봐야해서")**. 캠페인 지출 스프레드시트
 *   (`AD.SPREADSHEET_ID`, Meta_Raw/NaverSA_Raw와 같은 곳)에 `KakaoSMS_Raw`
 *   탭을 신설해 Performance 시트 원본을 그대로 볼 수 있게 함 — 실제 지출
 *   집계 로직(`computeKakaoChannelSpendSummary_()`)은 계속 원본을 직접
 *   읽고, 이 탭은 순수 뷰용(사용자 확인).
 *   **PIC 컬럼 신규(B/C 사이 삽입, 원본엔 없음, 사용자 요청)** — 매 행
 *   사용자가 직접 입력하는 값이라, 매번 전체를 지우고 다시 쓰면 날아감.
 *   그래서 **append-only**(Leads_Raw/MTA_Raw와 동일 기존 관행 — 이미 복사된
 *   행은 안 건드리고 원본에 새로 추가된 행만 뒤에 이어붙임)로 구현(사용자
 *   확인 — "이미 복사된 과거 행을 원본에서 나중에 수정해도 반영 안 되는 건
 *   괜찮다"). **CTR/CvR은 헤더만 복사, 값은 항상 빈칸**(원본에서 수식으로
 *   계산되는 값이라 그대로 복사하면 의미 없는 스냅샷 숫자가 되므로 사용자
 *   확인 하에 제외). 순수 함수 `computeKakaoChannelSyncRow_()`(원본 헤더
 *   기반 레코드 → 목적지 컬럼 순서의 값 배열, PIC/CTR/CvR은 빈 문자열).
 *   기존 `readKakaoChannelRawRows_()`는 새 공용 리더
 *   `readKakaoChannelPerformanceSheetData_()`(전체 컬럼을 헤더 키 객체로
 *   반환)를 쓰도록 리팩터링(중복 스프레드시트 읽기 로직 제거, 동작 변화
 *   없음). IO 래퍼 `syncKakaoChannelPerformanceToAD_()`(append 로직) +
 *   수동 진입점 `runSyncKakaoChannelPerformanceToAD()`. `AD_001_Config.js`
 *   (v1.9.0)에 `RAW_SHEET["Kakao Channel"]`("KakaoSMS_Raw")와
 *   `KAKAO_CHANNEL.SYNC_COLUMNS`(목적지 컬럼 순서/원본 매핑) 추가.
 * v1.0.0 (2026-07-31)
 * - 최초 구현.
 * ==========================================================
 */


/**
 * ==========================================================
 * Compute Kakao Channel Row Spend Entry (순수 함수)
 *
 * WHY
 * Performance 시트 한 행(Event type + SentAt + Cost)을 (FY|Month|Segment)
 * 단위 Spent 항목 1개로 변환한다. SentAt이 정확한 단일 날짜라 Meta처럼
 * 캠페인 활성기간에 걸친 분배가 필요 없음 — 그 달에 그대로 귀속.
 *
 * INPUT
 * record : Object  {eventType:string, sentAt:Date, cost:number}
 *
 * OUTPUT
 * {fy:number, month:string, segment:string, spent:number} | null
 * sentAt이 유효하지 않거나 eventType이 비어있으면 null.
 *
 * TEST
 * testComputeKakaoChannelRowSpendEntry() 참고
 * ==========================================================
 */
function computeKakaoChannelRowSpendEntry_(record){

  if(!record || !record.eventType) return null;
  if(!(record.sentAt instanceof Date) || isNaN(record.sentAt.getTime())) return null;

  const fy = Number(getFiscalYear(record.sentAt).replace("FY", ""));
  const month = getFiscalMonthLabel(record.sentAt);
  const segment = String(record.eventType).trim();

  return { fy: fy, month: month, segment: segment, spent: Number(record.cost) || 0 };

}


/**
 * ==========================================================
 * TEST — computeKakaoChannelRowSpendEntry_()
 * ==========================================================
 */
function testComputeKakaoChannelRowSpendEntry(){

  const row = { eventType: "BOFU", sentAt: new Date(2026, 6, 15), cost: 108042 };
  const result = computeKakaoChannelRowSpendEntry_(row);

  const pass =
    result.fy === 26 &&
    result.month === "JUL" &&
    result.segment === "BOFU" &&
    result.spent === 108042;

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

  const invalid = computeKakaoChannelRowSpendEntry_({ eventType: "Webinar", sentAt: null, cost: 100 });

  Logger.log("Invalid sentAt result: " + JSON.stringify(invalid) + " (expected null)");
  Logger.log(invalid === null ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Aggregate Kakao Channel Spend By FY/Month/Segment (순수 함수)
 *
 * WHY
 * computeKakaoChannelRowSpendEntry_()가 만든 행별 항목들을 (FY|Month|Segment)
 * 키로 합산한다 — 같은 세그먼트/월에 여러 발송 건이 걸치는 게 정상.
 *
 * INPUT
 * records : Array<Object>  Performance 시트에서 읽은 원시 레코드 배열
 *
 * OUTPUT
 * Object  키 "fy|month|segment" → 합산 Spent(KRW)
 *
 * TEST
 * testAggregateKakaoChannelSpendByFYMonthSegment() 참고
 * ==========================================================
 */
function aggregateKakaoChannelSpendByFYMonthSegment_(records){

  const totals = {};

  (records || []).forEach(function(record){

    const entry = computeKakaoChannelRowSpendEntry_(record);

    if(!entry) return;

    const key = entry.fy + "|" + entry.month + "|" + entry.segment;

    totals[key] = (totals[key] || 0) + entry.spent;

  });

  return totals;

}


/**
 * ==========================================================
 * TEST — aggregateKakaoChannelSpendByFYMonthSegment_()
 * ==========================================================
 */
function testAggregateKakaoChannelSpendByFYMonthSegment(){

  const records = [
    { eventType: "Webinar", sentAt: new Date(2026, 6, 1), cost: 500 },
    { eventType: "Webinar", sentAt: new Date(2026, 6, 15), cost: 250 },
    { eventType: "BOFU", sentAt: new Date(2026, 6, 20), cost: 1000 },
    { eventType: "", sentAt: new Date(2026, 6, 21), cost: 999 } // eventType 없음 — 무시돼야 함
  ];

  const result = aggregateKakaoChannelSpendByFYMonthSegment_(records);

  const pass =
    result["26|JUL|Webinar"] === 750 &&
    result["26|JUL|BOFU"] === 1000 &&
    Object.keys(result).length === 2;

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Read Kakao Channel Performance Sheet Data (IO 래퍼)
 *
 * WHY
 * Performance 시트는 1행=subtotal, 2행=헤더, 3행부터 데이터라
 * `sheetToObjects()`(항상 1행을 헤더로 가정)를 그대로 못 쓴다 — 이 파일
 * 전용으로 헤더 행/데이터 시작 행을 `AD.KAKAO_CHANNEL`에서 읽어 처리.
 * `readKakaoChannelRawRows_()`(지출 집계용, 3개 필드만 추출)와
 * `syncKakaoChannelPerformanceToAD_()`(뷰 탭 동기화용, 전체 컬럼 필요)가
 * 공통으로 쓰는 원시 리더 — 전체 컬럼을 헤더 이름 키 객체로 그대로 반환한다.
 *
 * OUTPUT
 * {timeZone:string, rows:Array<Object>}  rows는 헤더 이름 → 원본 셀 값
 * ==========================================================
 */
function readKakaoChannelPerformanceSheetData_(){

  const cfg = AD.KAKAO_CHANNEL;
  const ss = SpreadsheetApp.openById(cfg.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(cfg.SHEET_NAME);

  if(!sheet) return { timeZone: ss.getSpreadsheetTimeZone(), rows: [] };

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if(lastRow < cfg.DATA_START_ROW || lastCol === 0){
    return { timeZone: ss.getSpreadsheetTimeZone(), rows: [] };
  }

  const headers = sheet.getRange(cfg.HEADER_ROW, 1, 1, lastCol).getValues()[0]
    .map(function(h){ return String(h).trim(); });

  const values = sheet.getRange(
    cfg.DATA_START_ROW, 1, lastRow - cfg.DATA_START_ROW + 1, lastCol
  ).getValues();

  const rows = values.map(function(row){

    const obj = {};

    headers.forEach(function(header, i){ obj[header] = row[i]; });

    return obj;

  });

  return { timeZone: ss.getSpreadsheetTimeZone(), rows: rows };

}


/**
 * ==========================================================
 * Read Kakao Channel Raw Rows (IO 래퍼)
 *
 * WHY
 * 지출 집계(computeKakaoChannelSpendSummary_())에 필요한 3개 필드(Event
 * type/SentAt/Cost)만 추출한다. 타임존 정규화는 Meta_Raw 때와 동일한 이유
 * (이 스프레드시트 자체 타임존과 스크립트 타임존이 다를 수 있음)로
 * `normalizeExternalCalendarDate_()` 재사용.
 * ==========================================================
 */
function readKakaoChannelRawRows_(){

  const cfg = AD.KAKAO_CHANNEL;
  const data = readKakaoChannelPerformanceSheetData_();

  return data.rows
    .map(function(row){

      const rawSentAt = row[cfg.COLUMNS.SENT_AT];
      const sentAt = rawSentAt instanceof Date
        ? normalizeExternalCalendarDate_(rawSentAt, data.timeZone)
        : rawSentAt;

      return {
        eventType: row[cfg.COLUMNS.EVENT_TYPE],
        sentAt: sentAt,
        cost: parseCurrencyValue_(row[cfg.COLUMNS.COST])
      };

    })
    .filter(function(record){ return !!record.eventType; });

}


/**
 * ==========================================================
 * Read KakaoSMS_Raw Rows (IO 래퍼)
 *
 * WHY (2026-08-06, 카카오모먼트 API 이관)
 * `computeKakaoChannelSpendSummary_()`의 데이터 소스를 외부 수기 시트
 * (Performance, `readKakaoChannelRawRows_()`)에서 `KakaoSMS_Raw`
 * (AD.SPREADSHEET_ID 내부, AD_006_KakaoMoments.js의
 * `runSyncKakaoMomentsReportToKakaoSMSRaw()`가 채움)로 전환한다 — 카카오모먼트
 * API 전환 후 신규 데이터는 이 탭에만 쌓이므로, 리포인트 안 하면 이 시점부터
 * Ad_Spend_Cache→ACQ_REP Spent 집계가 조용히 멈춤(exec-plan
 * 2026-08-04-kakao-moments-api-integration.md 필수 변경사항 항목 참고).
 * `KakaoSMS_Raw`는 같은 AD.SPREADSHEET_ID 안(외부 스프레드시트 아님)이라
 * `normalizeExternalCalendarDate_()` 타임존 보정이 필요 없음 — 쓸 때 이미
 * 이 스크립트 타임존 기준 Date로 기록됨.
 *
 * OUTPUT
 * Array<{eventType, sentAt, cost}>  readKakaoChannelRawRows_()와 동일한 형태
 * ==========================================================
 */
function readKakaoSMSRawRows_(){

  const ss = SpreadsheetApp.openById(AD.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(AD.RAW_SHEET["Kakao Channel"]);

  if(!sheet) return [];

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if(lastRow < 2 || lastCol === 0) return [];

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function(h){ return String(h).trim(); });

  const eventTypeCol = headers.indexOf("Event type");
  const sentAtCol = headers.indexOf("SentAt");
  const costCol = headers.indexOf("Cost");

  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  return values
    .map(function(row){
      return {
        eventType: row[eventTypeCol],
        sentAt: row[sentAtCol],
        cost: parseCurrencyValue_(row[costCol])
      };
    })
    .filter(function(record){ return !!record.eventType; });

}


/**
 * ==========================================================
 * Compute Kakao Channel Spend Summary (IO 래퍼)
 * ==========================================================
 */
function computeKakaoChannelSpendSummary_(){

  return aggregateKakaoChannelSpendByFYMonthSegment_(readKakaoSMSRawRows_());

}


/**
 * ==========================================================
 * TEMP — computeKakaoChannelSpendSummary_() 수동 실행/확인용 공개 진입점
 * ==========================================================
 */
function runComputeKakaoChannelSpendSummary(){

  const summary = computeKakaoChannelSpendSummary_();

  Logger.log(JSON.stringify(summary, null, 2));

}


/**
 * ==========================================================
 * Compute Kakao Channel Sync Row (순수 함수)
 *
 * WHY
 * Performance 시트 한 행(헤더 이름 키 객체)을 `KakaoSMS_Raw` 뷰 탭에 쓸
 * 값 배열로 변환한다. `columnDefs`의 각 항목이 `source:null`이면(PIC —
 * 원본에 없는 신규 컬럼, CTR/CvR — 원본 수식값을 일부러 복사 안 함) 빈
 * 문자열을 채운다.
 *
 * INPUT
 * sourceRecord : Object  원본 헤더 이름 → 값(readKakaoChannelPerformanceSheetData_() 참고)
 * columnDefs : Array<{header:string, source:string|null}>  목적지 컬럼 순서
 *
 * OUTPUT
 * Array  columnDefs와 같은 길이/순서의 값 배열
 *
 * TEST
 * testComputeKakaoChannelSyncRow() 참고
 * ==========================================================
 */
function computeKakaoChannelSyncRow_(sourceRecord, columnDefs){

  return columnDefs.map(function(col){

    if(!col.source) return "";

    const value = sourceRecord[col.source];

    return (value === undefined) ? "" : value;

  });

}


/**
 * ==========================================================
 * TEST — computeKakaoChannelSyncRow_()
 * ==========================================================
 */
function testComputeKakaoChannelSyncRow(){

  const sentAt = new Date(2026, 6, 15);

  const columnDefs = [
    { header: "FY", source: "FY" },
    { header: "Event type", source: "Event type" },
    { header: "PIC", source: null },
    { header: "SentAt", source: "SentAt" },
    { header: "CTR", source: null }
  ];

  const record = { "FY": "FY26", "Event type": "Webinar", "SentAt": sentAt, "CTR": 0.12 };

  const result = computeKakaoChannelSyncRow_(record, columnDefs);

  const pass =
    result.length === 5 &&
    result[0] === "FY26" &&
    result[1] === "Webinar" &&
    result[2] === "" &&        // PIC — 빈값
    result[3] === sentAt &&
    result[4] === "";          // CTR — 빈값(원본 수식값 복사 안 함)

  Logger.log("Result: " + JSON.stringify(result));
  Logger.log(pass ? "✅ PASS" : "❌ FAIL");

}


/**
 * ==========================================================
 * Sync Kakao Channel Performance To AD Spreadsheet (IO 래퍼)
 *
 * WHY
 * 캠페인 지출 스프레드시트(AD.SPREADSHEET_ID)에 `KakaoSMS_Raw` 뷰 탭을
 * 만들어 Performance 원본을 그대로 볼 수 있게 한다(사용자 요청). PIC 컬럼은
 * 사용자가 매 행 직접 입력하므로, 이미 복사된 행은 절대 다시 안 건드리고
 * 원본에 새로 추가된 행만 뒤에 이어붙인다(append-only — Leads_Raw/MTA_Raw와
 * 동일한 기존 관행). 이미 복사된 과거 행을 원본에서 나중에 수정해도 이
 * 동기화로는 반영되지 않음(사용자 확인 — 허용 가능한 트레이드오프).
 *
 * OUTPUT
 * number  새로 추가된 행 수
 * ==========================================================
 */
function syncKakaoChannelPerformanceToAD_(){

  const cfg = AD.KAKAO_CHANNEL;
  const columnDefs = cfg.SYNC_COLUMNS;
  const headerValues = columnDefs.map(function(c){ return c.header; });

  const sourceData = readKakaoChannelPerformanceSheetData_();
  const sourceRows = sourceData.rows;

  const destSS = SpreadsheetApp.openById(AD.SPREADSHEET_ID);
  let destSheet = destSS.getSheetByName(AD.RAW_SHEET["Kakao Channel"]);

  if(!destSheet){
    destSheet = destSS.insertSheet(AD.RAW_SHEET["Kakao Channel"]);
    destSheet.getRange(1, 1, 1, headerValues.length).setValues([headerValues]);
    destSheet.hideColumns(1); // "Message Ad ID" — syncKakaoMomentsReportToKakaoSMSRaw_()의 upsert 키, 이 경로로 시트가 먼저 생성돼도 동일하게 숨김
  }

  const existingDataRowCount = Math.max(destSheet.getLastRow() - 1, 0);

  if(existingDataRowCount >= sourceRows.length){
    Logger.log(
      "새로 추가할 행 없음(원본 " + sourceRows.length + "행, 이미 복사됨 " +
      existingDataRowCount + "행)."
    );
    return 0;
  }

  const newSourceRows = sourceRows.slice(existingDataRowCount);
  const newValues = newSourceRows.map(function(record){
    return computeKakaoChannelSyncRow_(record, columnDefs);
  });

  destSheet.getRange(existingDataRowCount + 2, 1, newValues.length, headerValues.length)
    .setValues(newValues);

  applyKakaoSMSRawStyling_(destSheet);

  Logger.log(
    newValues.length + "행 추가됨(" + AD.RAW_SHEET["Kakao Channel"] + ", 총 " +
    (existingDataRowCount + newValues.length) + "행)."
  );

  return newValues.length;

}


/**
 * ==========================================================
 * TEMP — syncKakaoChannelPerformanceToAD_() 수동 실행용 공개 진입점
 * ==========================================================
 */
function runSyncKakaoChannelPerformanceToAD(){

  syncKakaoChannelPerformanceToAD_();

}


/**
 * ==========================================================
 * TEMP — Performance 시트 첫 데이터 행 진단 (헤더/컬럼 불일치 확인용)
 *
 * WHY
 * Meta 때 헤더명 불일치로 빈 결과가 나온 적이 있어(runDebugMetaRawFirstRow()
 * 참고), 동일한 방식으로 실제 헤더/첫 행 값을 눈으로 확인하는 진단 함수.
 * ==========================================================
 */
function runDebugKakaoChannelRawFirstRow(){

  const cfg = AD.KAKAO_CHANNEL;
  const ss = SpreadsheetApp.openById(cfg.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(cfg.SHEET_NAME);

  if(!sheet){
    Logger.log(cfg.SHEET_NAME + " 시트를 못 찾음 — SPREADSHEET_ID/SHEET_NAME 확인하세요.");
    return;
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  Logger.log("Performance lastRow=" + lastRow + ", lastCol=" + lastCol);

  const headerRow = sheet.getRange(cfg.HEADER_ROW, 1, 1, lastCol).getValues()[0];

  Logger.log("헤더(실제 시트, " + cfg.HEADER_ROW + "행): " + JSON.stringify(headerRow));
  Logger.log("헤더(AD_001_Config.js 매핑 기대값): " + JSON.stringify(cfg.COLUMNS));

  const records = readKakaoChannelRawRows_();

  Logger.log("읽은 행 수: " + records.length);

  if(records.length > 0){
    Logger.log("첫 행: " + JSON.stringify(records[0]) +
      "  [sentAt type: " + (records[0].sentAt instanceof Date ? "Date" : typeof records[0].sentAt) + "]");
  }

}
