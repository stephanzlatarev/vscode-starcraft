const vscode = require("vscode");
const files = require("../files.js");
const ArenaApi = require("./api.js");

const MAP_URL = "https://stephanzlatarev.github.io/vscode-starcraft/maps/";
const MAPS = [
  "AbyssalReefAIE.SC2Map",
  "AcropolisAIE.SC2Map",
  "AutomatonAIE.SC2Map",
  "EphemeronAIE.SC2Map",
  "InterloperAIE.SC2Map",
  "LeyLinesAIE.SC2Map",
  "MagannathaAIE.SC2Map",
  "PersephoneAIE.SC2Map",
  "PylonAIE.SC2Map",
  "ThunderbirdAIE.SC2Map",
  "TorchesAIE.SC2Map",
  "UltraloveAIE.SC2Map",
];

const emitterReload = new vscode.EventEmitter();

class ArenaMaps {

  onDidChangeTreeData = emitterReload.event;

  constructor() {
    init();
  }

  async getTreeItem(map) {
    return new vscode.TreeItem(map);
  }

  async getChildren(map) {
    return map ? [] : await list();
  }

}

async function init() {
  for (const map of MAPS) {
    await files.copyMapFile(`${MAP_URL}/${map}`);

    emitterReload.fire();
  }

  const activeCompetitionMaps = await ArenaApi.listActiveCompetitionMaps();
  for (const map of activeCompetitionMaps) {
    await files.copyMapFile(map);

    emitterReload.fire();
  }
}

async function list() {
  return await files.listMaps();
}

module.exports = ArenaMaps;
