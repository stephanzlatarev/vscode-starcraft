const vscode = require("vscode");
const fetchModule = require("node-fetch");
const selection = require("../selection.js");
const timer = require("../timer.js");

const fetch = fetchModule.default || fetchModule;
const emitterReload = new vscode.EventEmitter();
const iconColor = {
  "Win": new vscode.ThemeIcon("testing-passed-icon", new vscode.ThemeColor("testing.iconPassed")),
  "Loss": new vscode.ThemeIcon("testing-failed-icon", new vscode.ThemeColor("testing.iconFailed")),
  "Tie": new vscode.ThemeIcon("testing-error-icon", new vscode.ThemeColor("testing.iconErrored")),
};

class ArenaMatches {

  onDidChangeTreeData = emitterReload.event;
  tick = this.refresh.bind(this);
  displayedBotId = null;

  constructor() {
    timer.add(this.tick, 1000);
  }

  async getTreeItem(match) {
    const duration = match.duration.startsWith("00:") ? "in " + match.duration.substring(3) + " min" : "timeout";
    const item = new vscode.TreeItem(match.date + " vs " + match.opponent + " " + duration);

    item.iconPath = iconColor[match.result] || iconColor["Tie"];
    item.command = { command: "starcraft.arena-replay", title: "Arena replay", arguments: [match] };

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
  if (!selection.bot.id) return [];

  const url = `https://aiarena.net/bots/${selection.bot.id}/`;
  const response = await fetch(url);
  const html = await response.text();

  // TODO: Remove this once we can use GraphQL API
  selection.setBot(selection.bot.id, extractBotName(html));

  const table = extractMatchTable(html);
  const rows = table.match(/<tr[\s\S]*?<\/tr>/g) || [];

  return rows.map(extractMatch).filter(match => !!match.id);
}

function extractBotName(html) {
  const start = html.indexOf('<h2>');
  const end = html.indexOf('</h2>', start);

  return ((start > 0) && (end > start)) ? html.substring(start + 4, end).trim() : null;
}

function extractMatchTable(html) {
  const start = html.indexOf('<div class="table-container">');
  const end = html.indexOf('</div>', start);

  return ((start > 0) && (end > start)) ? html.substring(start, end) : "";
}

function extractMatch(row) {
  // Extract columns
  const cols = [...row.matchAll(/<td.*?>([\s\S]*?)<\/td>/g)].map(m => m[1].trim());

  // Extract match id from first column's <a>
  const idMatch = cols[0]?.match(/\/matches\/(\d+)\//);
  const id = idMatch ? Number(idMatch[1]) : null;

  // Date is second column
  const date = cols[1] || "";

  // Opponent from third column's <a>
  const opponentPart = cols[2]?.match(/>([^<]+)<\/a>/);
  const opponent = opponentPart ? opponentPart[1] : "";

  // Result from fourth column (strip HTML)
  const result = cols[3] || "";

  // Duration from eighth column
  const duration = cols[7] || "";

  // File-link from ninth column's <a>
  const replayPart = cols[8]?.match(/href="([^"]+)"/);
  const replay = replayPart ? replayPart[1].replace(/&amp;/g, "&") : "";

  return { id, date, opponent, result, duration, replay };
}

module.exports = ArenaMatches;
