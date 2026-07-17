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

const ICON_DOWNLOADED = new vscode.ThemeIcon("pass", new vscode.ThemeColor("testing.iconPassed"));
const ICON_MISSING = new vscode.ThemeIcon("circle-outline");

const emitterReload = new vscode.EventEmitter();

class ArenaBots {
  onDidChangeTreeData = emitterReload.event;

  constructor() {
    this.downloaded = new Set();
    init(this.downloaded);
  }

  getTreeItem(bot) {
    const item = new vscode.TreeItem(bot);
    item.iconPath = this.downloaded.has(bot) ? ICON_DOWNLOADED : ICON_MISSING;
    return item;
  }

  getChildren(bot) {
    return bot ? [] : BOTS_NAMES;
  }
}

module.exports = ArenaBots;

async function init(downloaded) {
  const list = await files.listBots();

  for (const name of list) {
    downloaded.add(name);
  }
  emitterReload.fire();

  for (const [id, name] of Object.entries(BOTS)) {
    if (downloaded.has(name)) continue;

    const buffer = await ArenaApi.getBotZip(id);
    if (!buffer) continue;

    await files.extractBotZip(name, buffer);
    downloaded.add(name);
    emitterReload.fire();
  }
}
