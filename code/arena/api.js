const vscode = require("vscode");
const fetchModule = require("node-fetch");
const fetch = fetchModule.default || fetchModule;

const RACE = { 1: "Terran", 2: "Zerg", 3: "Protoss", 4: "Random" };

const knownBotNames = new Map();

class ArenaApi {

  async getBotInfo(botId) {
    const info = await call(`bots/${botId}`);

    if (info) {
      knownBotNames.set(botId, info.name);

      return {
        id: info.id,
        name: info.name,
        race: RACE[info.plays_race.id] || "Unknown",
        gameId: info.game_display_id,
        created: info.created,
        modified: info.bot_zip_updated,
      };
    }
  }

  async listBotMatches(botId) {
    let botName = knownBotNames.get(botId);
    if (!botName) {
      const botInfo = await this.getBotInfo(botId);

      if (botInfo) {
        botName = botInfo.name;
      } else {
        return [];
      }
    }

    const count = (await call(`matches/?limit=1&bot=${botId}`, { count: 0 })).count;
    if (!count) return [];

    const list = await call(`matches/?ordering=started&offset=${Math.max(count - 50, 0)}&limit=50&bot=${botId}`, { results: [] });

    return list.results.filter(match => match.result).map(match => ({
      id: match.id || null,
      date: match.started || "",
      opponent: (match.result.bot1_name == botName) ? match.result.bot2_name || "" : match.result.bot1_name || "",
      result: (match.result.winner == botId) ? "Win" : match.result.winner ? "Loss" : "Tie",
      duration: match.result.game_steps || "",
      replay: match.result.replay_file || "",
    })).reverse();
  }

}

async function call(endpoint, defaultValue) {
  const arenaApiToken = await getArenaApiToken();
  if (!arenaApiToken) return;

  const response = await fetch(`https://aiarena.net/api/${endpoint}`, {
    headers: {
      "Authorization": `Token ${arenaApiToken}`
    }
  });

  if (response.ok) {
    return await response.json();
  } else {
    console.error("Failed to fetch data from AI Arena API:", endpoint, "->", response.status, response.statusText);
    return defaultValue;
  }
}

function getArenaApiToken() {
  const arenaApiToken =  vscode.workspace.getConfiguration("starcraft").get("arenaApiToken");

  vscode.commands.executeCommand("setContext", "starcraft.hasArenaApiToken", !!arenaApiToken);

  if (!arenaApiToken) {
    requestArenaApiToken();
  }

  return arenaApiToken;
}

let isRequestingToken = false;

async function requestArenaApiToken() {
  if (isRequestingToken) return;

  isRequestingToken = true;
  vscode.commands.executeCommand("workbench.action.openSettings", "starcraft.arenaApiToken");

  await new Promise(resolve => setTimeout(resolve, 3000));
  isRequestingToken = false;

  getArenaApiToken();
}

module.exports = new ArenaApi();
