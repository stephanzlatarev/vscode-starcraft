const vscode = require("vscode");
const selection = require("../selection.js");
const timer = require("../timer.js");
const ArenaApi = require("./api.js");

const emitterReload = new vscode.EventEmitter();
const ICON_COLOR = {
  "Win": new vscode.ThemeIcon("testing-passed-icon", new vscode.ThemeColor("testing.iconPassed")),
  "Loss": new vscode.ThemeIcon("testing-failed-icon", new vscode.ThemeColor("testing.iconFailed")),
  "Tie": new vscode.ThemeIcon("testing-error-icon", new vscode.ThemeColor("testing.iconErrored")),
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];

class ArenaMatches {

  onDidChangeTreeData = emitterReload.event;
  tick = this.refresh.bind(this);
  displayedBotId = null;

  constructor() {
    timer.add(this.tick, 1000);
  }

  async getTreeItem(match) {
    const time = new Date(match.date);
    const formattedTime = `${time.getDate()} ${MONTHS[time.getMonth()]} ${twodigit(time.getHours())}:${twodigit(time.getMinutes())}`;
    const item = new vscode.TreeItem(formattedTime + " vs " + match.opponent + getMatchDuration(match));

    item.iconPath = ICON_COLOR[match.result] || ICON_COLOR["Tie"];
    item.contextValue = "arenaMatch";

    if (match.replay && match.replay.length) {
      item.command = { command: "starcraft.arena-replay", title: "Arena replay", arguments: [match] };
    }

    return item;
  }

  async getChildren(match) {
    this.nextDownloadTime = Date.now() + 1000 * 60; // Refresh every minute

    return match ? [] : await listMatches();
  }

  refresh() {
    if (selection.bot.id && ((this.displayedBotId !== selection.bot.id) || (Date.now() > this.nextDownloadTime))) {
      emitterReload.fire();

      this.displayedBotId = selection.bot.id;
    }

    return true;
  }

}

async function listMatches() {
  return selection.bot.id ? await ArenaApi.listBotMatches(selection.bot.id) : [];
}

function getMatchDuration(match) {
  if (!match.duration) return "";

  const totalSeconds = Math.floor(match.duration / 22.4);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return ` in ${minutes} min ${seconds} sec`;
}

function twodigit(number) {
  return number.toString().padStart(2, "0");
}

module.exports = ArenaMatches;
