const vscode = require("vscode");
const yauzl = require("yauzl");
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

  async listActiveCompetitionMaps() {
    const competitions = await call("competitions/?status=open", { results: [] }, false);
    const activeCompetitionIds = competitions.results.map(comp => comp.id);

    const query = activeCompetitionIds.map(id => `competitions=${id}`).join("&");
    const maps = await call(`maps/?${query}`, { results: [] }, false);
    return maps.results.map(({ file }) => file);
  }

  async getLogs(botId, matchId) {
    const participations = await call(`match-participations/?bot=${botId}&match=${matchId}`, { results: [] });
    const participationId = (participations.results && (participations.results.length === 1)) ? participations.results[0].id : null;

    if (!participationId) return;

    const zipBuffer = await download(`match-participations/${participationId}/match-log/`);

    return new Promise((resolve, reject) => {
      yauzl.fromBuffer(zipBuffer, { lazyEntries: true }, (error, zipFile) => {
        if (error) {
          reject(error);
          return;
        }

        zipFile.readEntry();
        zipFile.on("entry", function(entry) {
          if (entry.fileName === "stderr.log") {
            zipFile.openReadStream(entry, (error, readStream) => {
              if (error) {
                reject(error);
                return;
              }

              const chunks = [];
              readStream.on("data", chunk => chunks.push(chunk));
              readStream.on("end", () => {
                const logBuffer = Buffer.concat(chunks);
                resolve(logBuffer);
              });
              readStream.on("error", err => reject(err));
            });
          } else {
            zipFile.readEntry();
          }
        });
      });
    });
  }

}

async function call(endpoint, defaultValue, shouldRequestToken = true) {
  const arenaApiToken = await getArenaApiToken(shouldRequestToken);
  if (!arenaApiToken) return defaultValue;

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

async function download(endpoint) {
  const arenaApiToken = await getArenaApiToken(false);
  if (!arenaApiToken) return;

  const response = await fetch(`https://aiarena.net/api/${endpoint}`, {
    headers: {
      "Authorization": `Token ${arenaApiToken}`
    }
  });

  if (response.ok) {
    return Buffer.from(await response.arrayBuffer());
  } else {
    console.error("Failed to fetch data from AI Arena API:", endpoint, "->", response.status, response.statusText);
  }
}

function getArenaApiToken(shouldRequestToken) {
  const arenaApiToken =  vscode.workspace.getConfiguration("starcraft").get("arenaApiToken");

  vscode.commands.executeCommand("setContext", "starcraft.hasArenaApiToken", !!arenaApiToken);

  if (!arenaApiToken && shouldRequestToken) {
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

  getArenaApiToken(true);
}

module.exports = new ArenaApi();
