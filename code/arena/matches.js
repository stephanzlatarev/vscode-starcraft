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

const REFRESH_INTERVAL = 60000;

class ArenaMatches {

  onDidChangeTreeData = emitterReload.event;
  tick = this.refresh.bind(this);

  displayedBotId = null;
  list = { ready: false, message: "Loading..." };

  constructor() {
    showLoadingStatus(this, "Loading matches...");

    timer.add(this.tick, REFRESH_INTERVAL);
    selection.addListener(this.refresh.bind(this));
  }

  setViewer(viewer) {
    this.viewer = viewer;
  }

  async getTreeItem(match) {
    if (!this.list.ready) {
      // Show the loading message in italics
      const item = new vscode.TreeItem("");
      item.iconPath = new vscode.ThemeIcon("sync~spin");
      item.description = this.list.message;
      return item;
    }

    const time = new Date(match.date);
    const formattedTime = `${time.getDate()} ${MONTHS[time.getMonth()]} ${twodigit(time.getHours())}:${twodigit(time.getMinutes())}`;
    const item = new vscode.TreeItem(formattedTime + " vs " + match.opponent + getMatchDuration(match));

    item.iconPath = ICON_COLOR[match.result] || ICON_COLOR["Tie"];
    item.contextValue = "arenaMatch";

    if (match.replay && match.replay.length) {
      item.command = { command: "starcraft.arena-replay", title: "Arena replay", arguments: [match, selection.bot.name] };
    }

    return item;
  }

  async getChildren(match) {
    if (match) return [];

    if (this.list.ready && this.list.loading) {
      const controller = this;

      // The promise makes the tree show a progress bar without removing the displayed list
      return new Promise(async function(resolve) {
        const sleep = 1000;
        const limit = REFRESH_INTERVAL / 1000;

        for (let i = 0; i < limit; i++) {
          if (!controller.list.loading) break;

          await new Promise(r => setTimeout(r, sleep));
        }

        if (controller.list.ready) {
          resolve(controller.list.matches || []);
        } else {
          resolve([controller.list.message]);
        }
      });
    } else if (this.list.ready) {
      return this.list.matches || [];
    } else {
      return [this.list.message];
    }
  }

  refresh() {
    // Check if viewer is showing
    if (!this.viewer || !this.viewer.visible) return false;

    // Check if we're waiting for the list to load
    if (this.list.loading) return true;

    // Check if a bot is selected
    if (!selection.bot.id) return false;

    if (this.displayedBotId !== selection.bot.id) {
      this.displayedBotId = selection.bot.id;

      showLoadingStatus(this, `Listing ${selection.bot.name}'s matches from AI Arena...`);
    }

    listMatches(this);

    return (this.list.ready || this.list.loading);
  }

}

function showLoadingStatus(controller, message) {
  controller.list = { ready: false, message };
  emitterReload.fire();
}

function showMatchList(controller, matches) {
  controller.list = { ready: true, matches };
  emitterReload.fire();
}

async function listMatches(controller) {
  if (selection.bot.id) {
    try {
      controller.list.loading = true;
      emitterReload.fire();

      const matches = await ArenaApi.listBotMatches(selection.bot);

      if (matches && matches.length) {
        showMatchList(controller, matches);
      } else if (controller.list.matches && controller.list.matches.length) {
        // Keep the existing list showing
      } else {
        showLoadingStatus(controller, "Unable to list matches from AI Arena");
      }
    } finally {
      controller.list.loading = false;
      emitterReload.fire();
    }
  } else {
    showLoadingStatus(controller, "Select a bot to view matches");
  }
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
