/**
 * ==========================================================
 * Build Menu
 * ==========================================================
 */

function createBuildMenu() {

  SpreadsheetApp.getUi()
    .createMenu("🏗️ Build")
    .addItem("Append New Leads", "menuAppendNewLeads")
    .addItem("Append New MTA", "menuAppendNewMTA")
    .addSeparator()
    .addItem("⚠️ Rebuild Leads (Full)", "menuRebuildLeadsMaster")
    .addItem("⚠️ Rebuild MTA (Full)", "menuRebuildMTAMaster")
    .addToUi();

}


/**
 * ==========================================================
 * Menu Wrappers
 * ==========================================================
 */

function menuAppendNewLeads(){

  Logger.log(
    CONFIG.LOG.PREFIX +
    " Menu : Append New Leads"
  );

  appendNewLeads();

}


function menuAppendNewMTA(){

  Logger.log(
    CONFIG.LOG.PREFIX +
    " Menu : Append New MTA"
  );

  appendNewMTA();

}


function menuRebuildLeadsMaster(){

  Logger.log(
    CONFIG.LOG.PREFIX +
    " Menu : Rebuild Leads Master (Full)"
  );

  rebuildLeadsMaster();

}


function menuRebuildMTAMaster(){

  Logger.log(
    CONFIG.LOG.PREFIX +
    " Menu : Rebuild MTA Master (Full)"
  );

  rebuildMTAMaster();

}