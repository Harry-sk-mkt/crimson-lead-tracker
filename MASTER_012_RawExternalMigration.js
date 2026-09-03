/**
 * ==========================================================
 * Marketing 2.0
 * Raw External Migration (일회성 — Master_DB 이관)
 *
 * Responsibility
 * 메인 스프레드시트 안의 Leads_Raw/MTA_Raw/ICFunnel_Raw 전체 데이터를,
 * Master_DB 폴더 안 전용 외부 스프레드시트(CONFIG.RAW_EXTERNAL.LEADS/MTA,
 * CONFIG.IC_FUNNEL.EXTERNAL)로 복사한다. 대상 탭이 없거나 이름이 다르면
 * 만들어/이름을 맞춘 뒤 헤더+데이터를 새로 쓴다.
 *
 * WHY (도입 배경, 2026-09-03)
 * `docs/Roadmap.md` "Master_DB" 항목 — 메인 스프레드시트 용량/오픈 속도
 * 문제 완화 목적으로 Raw를 전용 외부 스프레드시트로 이관(SAL_Raw는
 * 2026-09-02에 이미 완료). 상세 배경/설계 판단:
 * `docs/exec-plans/active/2026-09-03-master-db-raw-migration.md`.
 *
 * Must NOT
 * - 메인 스프레드시트의 기존 Raw 시트를 건드리지 않음(읽기 전용) — 이
 *   스크립트는 순수 "복사"만 하고, 메인 시트 삭제/Import 경로 전환은
 *   이 파일의 책임이 아니다(그 전환은 별도 커밋 — readLeadRaw()/
 *   writeLeadRaw() 등이 CONFIG.RAW_EXTERNAL을 실제로 참조하도록 바꾸는
 *   작업, 이 마이그레이션이 성공/검증된 뒤에만 진행).
 * - 대상 탭에 이미 알 수 없는 데이터가 있으면 추측으로 덮어쓰지 않고
 *   명시적 에러로 중단한다("No Assumptions").
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-09-03)
 * - 최초 구현.
 * ==========================================================
 */


/**
 * ==========================================================
 * Resolve Target Sheet (탭 이름 확인/생성/이름 맞춤)
 *
 * WHY
 * 사용자가 미리 만들어둔 외부 스프레드시트 안에 탭이 아예 없거나
 * (기본 "Sheet1") 이름이 다른 상태 — 정확한 이름의 탭을 찾고, 없으면
 * 안전하게 만들거나 기존 default 탭 이름을 바꾼다. 여러 탭이 있는데
 * 어느 것도 대상 이름이 아니면 추측하지 않고 에러로 중단.
 * ==========================================================
 *
 * @param {Spreadsheet} externalFile
 * @param {string} requiredSheetName
 * @return {Sheet}
 */
function resolveRawMigrationTargetSheet_(externalFile, requiredSheetName){

  const existing = externalFile.getSheetByName(requiredSheetName);

  if(existing){
    return existing;
  }

  const allSheets = externalFile.getSheets();

  if(allSheets.length === 1){

    const onlySheet = allSheets[0];

    Logger.log(
      "[RawMigration] \"" + requiredSheetName + "\" 탭이 없어, 유일한 기존 탭 \"" +
      onlySheet.getName() + "\"의 이름을 바꿉니다."
    );

    onlySheet.setName(requiredSheetName);

    return onlySheet;

  }

  throw new Error(
    externalFile.getUrl() + " 안에 \"" + requiredSheetName + "\" 탭이 없고, " +
    "탭이 여러 개(" + allSheets.map(function(s){ return s.getName(); }).join(", ") + ")라 " +
    "어느 것을 대상으로 할지 추측할 수 없습니다 — 정확한 이름의 탭을 직접 만들거나 " +
    "이름을 바꿔주세요."
  );

}


/**
 * ==========================================================
 * Write Full Raw Snapshot To External Sheet (IO 래퍼)
 *
 * WHY
 * `IMPORT_006_SheetWriter.js`의 `writeSheetRecords()`는 CONFIG.SPREADSHEET
 * (메인 파일) 전용이라 외부 스프레드시트에는 그대로 못 씀 — 일회성
 * 마이그레이션이라 별도 재사용 가능한 추상화를 만들지 않고 이 파일 안에
 * 필요한 만큼만 구현. Plain Text 서식(날짜 컬럼)은 반드시 setValues() 이전에
 * 적용해야 Google Sheets 자동 Date 변환을 막을 수 있음(appendSheetRecords()와
 * 동일 원칙, docs/DateParsing.md 참고).
 * ==========================================================
 *
 * @param {Spreadsheet} externalFile
 * @param {string} requiredSheetName
 * @param {Object[]} records
 * @param {string[]} dateColumns  Plain Text 서식 강제 대상 컬럼명
 * @return {{ written: number }}
 */
function writeFullRawSnapshotToExternalSheet_(externalFile, requiredSheetName, records, dateColumns){

  const sheet = resolveRawMigrationTargetSheet_(externalFile, requiredSheetName);

  const existingLastRow = sheet.getLastRow();

  if(existingLastRow > 0){
    throw new Error(
      externalFile.getUrl() + "의 \"" + requiredSheetName + "\" 탭에 이미 " +
      existingLastRow + "행의 데이터가 있습니다 — 알 수 없는 기존 데이터를 " +
      "추측으로 덮어쓰지 않습니다. 빈 탭인지 확인 후 다시 실행하세요."
    );
  }

  if(records.length === 0){
    Logger.log("[RawMigration] " + requiredSheetName + " : 복사할 레코드가 없습니다.");
    return { written: 0 };
  }

  const headers = Object.keys(records[0]);

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  dateColumns.forEach(function(columnName){

    const colIndex = headers.indexOf(columnName);
    if(colIndex === -1) return;

    sheet.getRange(2, colIndex + 1, records.length, 1).setNumberFormat("@");

  });

  const values = records.map(function(record){
    return headers.map(function(header){
      return record[header] !== undefined ? record[header] : "";
    });
  });

  sheet.getRange(2, 1, values.length, headers.length).setValues(values);

  SpreadsheetApp.flush();

  Logger.log(
    "[RawMigration] " + requiredSheetName + " : " + values.length +
    "건 복사 완료 (" + externalFile.getUrl() + ")."
  );

  return { written: values.length };

}


/**
 * ==========================================================
 * Migrate Raw To External (하나의 Raw 타입 처리)
 * ==========================================================
 *
 * @param {string} label  로그용 표시 이름
 * @param {Object[]} sourceRecords  메인 스프레드시트 Raw 전체 레코드
 * @param {string} spreadsheetId
 * @param {string} requiredSheetName
 * @param {string[]} dateColumns
 * @return {{ label: string, sourceCount: number, writtenCount: number, ok: boolean }}
 */
function migrateRawToExternal_(label, sourceRecords, spreadsheetId, requiredSheetName, dateColumns){

  if(!spreadsheetId){
    throw new Error(
      label + " : 외부 스프레드시트 ID가 비어있습니다 — CORE_001_Config.js를 먼저 확인하세요."
    );
  }

  const externalFile = SpreadsheetApp.openById(spreadsheetId);

  const result = writeFullRawSnapshotToExternalSheet_(
    externalFile, requiredSheetName, sourceRecords, dateColumns
  );

  const ok = result.written === sourceRecords.length;

  Logger.log(
    "[RawMigration] " + label + " : source=" + sourceRecords.length +
    " / written=" + result.written + " / " + (ok ? "MATCH" : "MISMATCH")
  );

  return {
    label: label,
    sourceCount: sourceRecords.length,
    writtenCount: result.written,
    ok: ok
  };

}


/**
 * ==========================================================
 * 수동 실행용 진입점 — Leads_Raw만 이관
 * ==========================================================
 */
function runMigrateLeadsRawToExternal(){

  const result = migrateRawToExternal_(
    "Leads_Raw",
    readLeadRaw(),
    CONFIG.RAW_EXTERNAL.LEADS.SPREADSHEET_ID,
    CONFIG.SHEETS.LEADS_RAW,
    CONFIG.RAW_DATE_COLUMNS.LEADS
  );

  SpreadsheetApp.getUi().alert(
    result.ok ? "✅ Leads_Raw 이관 완료" : "⚠️ Leads_Raw 이관 건수 불일치",
    "Source : " + result.sourceCount + "건\nWritten : " + result.writtenCount + "건",
    SpreadsheetApp.getUi().ButtonSet.OK
  );

}


/**
 * ==========================================================
 * 수동 실행용 진입점 — MTA_Raw만 이관
 * ==========================================================
 */
function runMigrateMTARawToExternal(){

  const result = migrateRawToExternal_(
    "MTA_Raw",
    readMTARaw(),
    CONFIG.RAW_EXTERNAL.MTA.SPREADSHEET_ID,
    CONFIG.SHEETS.MTA_RAW,
    CONFIG.RAW_DATE_COLUMNS.MTA
  );

  SpreadsheetApp.getUi().alert(
    result.ok ? "✅ MTA_Raw 이관 완료" : "⚠️ MTA_Raw 이관 건수 불일치",
    "Source : " + result.sourceCount + "건\nWritten : " + result.writtenCount + "건",
    SpreadsheetApp.getUi().ButtonSet.OK
  );

}


/**
 * ==========================================================
 * 수동 실행용 진입점 — ICFunnel_Raw만 이관
 * ==========================================================
 */
function runMigrateICFunnelRawToExternal(){

  const result = migrateRawToExternal_(
    "ICFunnel_Raw",
    readRawSheet(CONFIG.IC_FUNNEL.SHEET),
    CONFIG.IC_FUNNEL.EXTERNAL.SPREADSHEET_ID,
    CONFIG.IC_FUNNEL.SHEET,
    CONFIG.RAW_DATE_COLUMNS.IC_FUNNEL
  );

  SpreadsheetApp.getUi().alert(
    result.ok ? "✅ ICFunnel_Raw 이관 완료" : "⚠️ ICFunnel_Raw 이관 건수 불일치",
    "Source : " + result.sourceCount + "건\nWritten : " + result.writtenCount + "건",
    SpreadsheetApp.getUi().ButtonSet.OK
  );

}


/**
 * ==========================================================
 * 수동 실행용 진입점 — 셋 다 순서대로 이관
 * ==========================================================
 */
function runMigrateAllRawToExternal(){

  const results = [
    migrateRawToExternal_(
      "Leads_Raw", readLeadRaw(),
      CONFIG.RAW_EXTERNAL.LEADS.SPREADSHEET_ID, CONFIG.SHEETS.LEADS_RAW,
      CONFIG.RAW_DATE_COLUMNS.LEADS
    ),
    migrateRawToExternal_(
      "MTA_Raw", readMTARaw(),
      CONFIG.RAW_EXTERNAL.MTA.SPREADSHEET_ID, CONFIG.SHEETS.MTA_RAW,
      CONFIG.RAW_DATE_COLUMNS.MTA
    ),
    migrateRawToExternal_(
      "ICFunnel_Raw", readRawSheet(CONFIG.IC_FUNNEL.SHEET),
      CONFIG.IC_FUNNEL.EXTERNAL.SPREADSHEET_ID, CONFIG.IC_FUNNEL.SHEET,
      CONFIG.RAW_DATE_COLUMNS.IC_FUNNEL
    )
  ];

  const allOk = results.every(function(r){ return r.ok; });

  SpreadsheetApp.getUi().alert(
    allOk ? "✅ Raw 전체 이관 완료" : "⚠️ 일부 이관 건수 불일치 — Log 확인 필요",
    results.map(function(r){
      return r.label + " : source=" + r.sourceCount + " / written=" + r.writtenCount +
        (r.ok ? "" : " ← MISMATCH");
    }).join("\n"),
    SpreadsheetApp.getUi().ButtonSet.OK
  );

}
