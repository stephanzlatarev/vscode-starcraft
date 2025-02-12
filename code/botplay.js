const files = require("./files.js");
const game = require("./game.js");
const Types = require("./types.js");

const KIND_UNIT = 0;
const KIND_BUILDING = 1;

let start;

class BotPlay {

  constructor() {
    this.gameInfo = game.get("gameInfo");
    this.observation = game.get("observation");

    start(null, null, [
      ["host-game",   () => game.host(), {
        checking: this.renderPlayerSelection.bind(this),
        complete: "Create game",
      }],
      ["spawn-units", () => this.spawnUnits(), {
        checking: this.renderProgress.bind(this),
        complete: "Spawn units",
      }],
    ]);
  }

  async renderPlayerSelection(container) {
    if (this.webview !== container.webview) {
      container.webview.onDidReceiveMessage(this.onMessage.bind(this));

      this.webview = container.webview;
    }

    return await files.readHtmlFile("play.html");
  }

  async renderProgress() {
    return await files.readHtmlFile("progress.html");
  }

  onMessage(message) {
    if (message.type === "play") {
      const map = this.gameInfo.localMapPath;
      const races = this.gameInfo.playerInfo.map(one => one.raceActual);
      const opponentRace = races[(message.player === 1) ? 1 : 0];

      this.player = message.player;

      game.request({
        createGame: {
          localMap: { mapPath: map },
          playerSetup: [
            { type: 1, race: 4 },
            { type: 2, race: opponentRace, difficulty: message.difficulty, playerName: "Computer" },
          ],
          realtime: false,
        }
      });
    }
  }

  async spawnUnits() {
    const desiredState = this.observation;
    const desiredLoop = desiredState.observation.gameLoop;
    const desiredUnits = desiredState.observation.rawData.units;

    game.pause();
    await sleep(1000);

    post(this, "Re-create game state");

    // Reveal map so that all existing player units can be removed
    await game.request({ debug: { debug: [{ gameState: 1 }] } });
    await game.request({ step: { count: 4 } });

    // Move to the time we want to simulate
    post(this, "Step to game loop");
    const isKeepAliveUnit = getKeepAliveUnits(await game.request({ observation: {} }));
    let loop = 0;

    for (loop = 0; loop < desiredLoop; loop += 1000) {
      const state = await game.request({ observation: {} });
      const units = state.observation.rawData.units;

      for (const unit of units) {
        if (isPlayerUnit(unit) && !isKeepAliveUnit[unit.tag]) {
          await game.request({ debug: { debug: [{ killUnit: { tag: [unit.tag] } }] } });
        }
      }

      await game.request({ step: { count: 1000 } });

      post(this, "Stepping: " + (loop * 100 / desiredLoop).toFixed(2) + "%");
    }

    if (loop < desiredLoop) {
      await game.request({ step: { count: desiredLoop - loop } });
    }

    post(this, "Spawn units");

    // Remove all existing player units
    const startingState = await game.request({ observation: {} });
    const unitsToKill = startingState.observation.rawData.units;

    for (const unit of unitsToKill) {
      if (isPlayerUnit(unit) || !isResourceInDesiredUnits(desiredUnits, unit)) {
        await game.request({ debug: { debug: [{ killUnit: { tag: [unit.tag] } }] } });
      }
    }

    // Spawn the buildings before the units so that they get at their exact positions
    post(this, "Spawn buildings");
    for (const unit of desiredUnits) {
      if (isPlayerBuilding(unit)) {
        const owner = getUnitOwner(unit, this.player);
  
        await game.request({ debug: { debug: [{ createUnit: { unitType: unit.unitType, owner: owner, pos: unit.pos, quantity: 1 } }] } });
      }
    }

    // Spawn the units
    post(this, "Spawn units");
    for (const unit of desiredUnits) {
      if (isPlayerUnit(unit)) {
        const owner = getUnitOwner(unit, this.player);
  
        await game.request({ debug: { debug: [{ createUnit: { unitType: unit.unitType, owner: owner, pos: unit.pos, quantity: 1 } }] } });
      }
    }

    // Restore fog of war and request the observation with the spawned units
    post(this, "Restore fog of war");
    await game.request({ debug: { debug: [{ gameState: 1 }] } });
    await game.request({ step: { count: 2 } });
    await game.request({ observation: {} })
  }

  static setStarter(starter) {
    start = starter;
  }

}

function getKeepAliveUnits(observation) {
  const units = observation.observation.rawData.units;
  const keepAlive = {};

  let playerOneWorker;
  let playerTwoWorker;

  for (const unit of units) {
    if (unit.owner === 1) {
      if (!playerOneWorker) {
        keepAlive[unit.tag] = true;
        playerOneWorker = true;
      }
    } else if (unit.owner === 2) {
      if (!playerTwoWorker) {
        keepAlive[unit.tag] = true;
        playerTwoWorker = true;
      }
    }
  }

  return keepAlive;
}

function isResourceInDesiredUnits(desiredUnits, resource) {
  if (resource.mineralContents) {
    return desiredUnits.find(one => one.mineralContents && isSamePosition(one, resource));
  } else if (resource.vespeneContents) {
    // Check if there's extractor on top of the geyser in the desired state
    if (desiredUnits.find(one => one.vespeneContents && isPlayerBuilding(one) && isSamePosition(one, resource))) {
      return false;
    }

    return desiredUnits.find(one => one.vespeneContents && isSamePosition(one, resource));
  }
}

function isPlayerBuilding(unit) {
  return ((unit.owner === 1) || (unit.owner === 2)) && (Types.unit(unit.unitType).kind === KIND_BUILDING);
}

function isPlayerUnit(unit) {
  return ((unit.owner === 1) || (unit.owner === 2)) && (Types.unit(unit.unitType).kind === KIND_UNIT);
}

function isSamePosition(a, b) {
  const pa = a.pos || a;
  const pb = b.pos || b;

  return (pa.x === pb.x) && (pa.y === pb.y);
}

function getUnitOwner(unit, player) {
  if (player === 2) {
    if (unit.owner === 1) {
      return 2;
    } else if (unit.owner === 2) {
      return 1;
    }
  }

  return unit.owner;
}

function post(container, status) {
  container.webview.postMessage({ type: "status", text: status });
}

function sleep(millis) {
  return new Promise(resolve => setTimeout(resolve, millis));
}

module.exports = BotPlay;
