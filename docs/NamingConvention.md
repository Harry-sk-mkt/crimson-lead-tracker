# Naming Convention

## Functions

```
readXXXX()
transformXXXX()
writeXXXX()
buildXXXX()
updateXXXX()
appendXXXX()      // 2026-07-21 추가 — append 방식 함수
rebuildXXXX()     // 2026-07-21 추가 — full rebuild 함수 (구 buildXXXX)
```

## Configuration

```
CONFIG.SHEETS
CONFIG.ROWS
CONFIG.TOAST
CONFIG.LOG
CONFIG.DATE
CONFIG.REQUIRED_FIELDS          // 2026-07-21 추가
CONFIG.RAW_DATE_COLUMNS         // 2026-07-21 추가
CONFIG.PROPERTIES               // 2026-07-21 추가 (Incremental Build 추적용)
CONFIG.VALIDATION_SUMMARY_EXCLUDE  // 2026-07-21 추가
```

## Menu (2026-07-21 개명)

```
📥 Update   (구 "📥 Import")
🏗️ Append   (구 "🏗️ Build")
```