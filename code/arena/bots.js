const vscode = require("vscode");
const files = require("../files.js");
const ArenaApi = require("./api.js");

const BOTS = {
  49: "MicroMachine",
  201: "QueenBot",
  357: "12PoolBot",
  517: "VeTerran-revived",
  1030: "who",
};
const BOTS_NAMES = Object.values(BOTS).sort();

class ArenaBots {
  constructor() {
    init();
  }

  getTreeItem(bot) {
    return new vscode.TreeItem(bot);
  }

  getChildren(bot) {
    return bot ? [] : BOTS_NAMES;
  }
}

module.exports = ArenaBots;

async function init() {
  const downloaded = await files.listBots();

  for (const [id, name] of Object.entries(BOTS)) {
    if (downloaded.includes(name)) continue;

    console.log(`Download bot ${name}`);
    const buffer = await ArenaApi.getBotZip(id);
    if (!buffer) continue;

    await files.extractBotZip(name, buffer);
  }
}
