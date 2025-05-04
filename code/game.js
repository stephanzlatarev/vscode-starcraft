const { execSync, spawnSync } = require("node:child_process");
const Connection = require("./connection.js");
const files = require("./files.js");
const history = require("./history.js");
const Types = require("./types.js");

const MODE_GAME = "game";
const MODE_REPLAY = "replay";

const SPAWN_ID = "SPAWN-";
let spawnIds = 1;

class Game {

  game = new Connection("ws://127.0.0.1:5001/sc2api", this.onEvent.bind(this));
  state = new Map();
  positions = new Map();
  spawning = new Map();
  index = 1;

  isCreated = false;
  isJoined = false;
  isPaused = false;
  isClosed = false;

  mode = null;
  disableFog = false;

  stepSize = 1;
  stepSkip = 0;
  stepTime = 0;

  error = null;

  async init() {
    spawnSync("docker", ["run", "-d", "--name", "starcraft",
      "--platform", "linux/amd64",
      "-p", "5000:5000", "-p", "5001:5001",
      "-v", files.getReplaysPath().split(":").join("") + ":/replays",
      "stephanzlatarev/starcraft"
    ]);
  }

  async toggleFog() {
    this.disableFog = !this.disableFog;

    if ((this.mode === MODE_GAME) && this.isJoined) {
      await this.request({ debug: { debug: [{ gameState: 1 }] } });
    }
  }

  setStepTime(millis) {
    this.stepTime = millis;
  }

  async connect() {
    await this.game.connect();

    this.game.send(Connection.CODE_RESUME);
  }

  get(key) {
    return this.state.get(key);
  }

  async onEvent(key, value, status) {
    if (value.error > 1) return this.error = value.errorDetails;

    if (!this.isCreated && ((status === 2) || (status === 3))) this.isCreated = true;
    if (!this.isJoined && (status === 3)) this.isJoined = true;

    if ((status === 3) || (status === 4)) {
      this.state.set(key, value);

      if (key === "observation") {
        const loop = value.observation.gameLoop;

        for (const unit of value.observation.rawData.units) {
          const oldpos = this.positions.get(unit.tag);

          unit.oldpos = oldpos || unit.pos;

          if (!oldpos || (loop > oldpos.loop)) {
            this.positions.set(unit.tag, { loop: loop, x: unit.pos.x, y: unit.pos.y });
          }
        }
      } else if (key === "data") {
        Types.read(value);
      } else if (key === "step") {
        history.add(loop(this), this.state);

        if (status === 3) await delay(this, true);

        const gameInfo = this.state.get("gameInfo");
        const observation = this.state.get("observation");
        const debugshapes = this.state.get("debugshapes");
        const debugtexts = this.state.get("debugtexts");
        this.state = new Map();
        this.state.set("gameInfo", gameInfo);

        // TODO: View refresh and click handling requires an observation
        // Implement a sync fynction in timer.js that runs only between game steps when the observation is available
        // Then remove this line
        if (observation) this.state.set("observation", observation);
        if (debugshapes) this.state.set("debugshapes", [...debugshapes]);
        if (debugtexts) this.state.set("debugtexts", [...debugtexts]);
      }
    } else if (key === "debug") {
      for (const debug of value.debug) {
        if (debug.draw) {
          // TODO: Remove once the timer.js sync function is ready
          this.state.set("debugshapes", []);
          this.state.set("debugtexts", []);

          for (const type in debug.draw) {
            const items = debug.draw[type];

            for (const item of items) {
              addDebugItem(this.state, type, item);
            }
          }
        }
      }
    }
  }

  async play(replayFileName) {
    this.reset();

    if (replayFileName) {
      // Viewing a replay
      this.mode = MODE_REPLAY;
      this.disableFog = true;

      const replayPath = "/replays/" + replayFileName;
      const replayInfo = await this.request({ replayInfo: { replayPath } });

      await this.request({
        startReplay: {
          replayPath,
          observedPlayerId: 1,
          realtime: false,
          options: {
            raw: true,
            showCloaked: true,
            showBurrowedShadows: true,
            showPlaceholders: true,
          },
        }
      });

      if (this.error) throw new Error(this.error);

      await this.request({ data: { abilityId: true, buffId: true, unitTypeId: true } });
      await this.request({ gameInfo: {} });

      stepReplay(this, replayInfo.gameDurationLoops);
    } else {
      this.mode = MODE_GAME;
      this.disableFog = false;
    }
  }

  async host() {
    while (!this.isCreated && !this.isClosed) {
      if (this.error) throw new Error(this.error);

      await sleep(200);
    }
  }

  async start() {
    while (!this.isJoined && !this.isClosed) {
      await sleep(200);
    }

    if (this.isJoined) {
      await this.request({ data: { abilityId: true, unitTypeId: true } });
      await this.request({ gameInfo: {} });
      await this.request({ observation: {} });
    }
  }

  async request(message) {
    return await this.game.request(message);
  }

  async spawn(owner, type, x, y) {
    if (this.isJoined && owner && type && x && y) {
      if (this.isPaused) {
        const tag = SPAWN_ID + (spawnIds++);

        this.spawning.set(tag, { createUnit: { unitType: type, owner: owner, pos: { x: x, y: y }, quantity: 1 } });

        // Add the spawned unit to the observation
        const observation = this.state.get("observation");
        observation.observation.rawData.units.push({
          tag: tag,
          unitType: type,
          owner: owner,
          pos: { x, y, z: 0 },
          radius: 0.5,
          orders: [],
          cloak: 3,
          buildProgress: 1,
          displayType: 4,
        });
        this.state.set("observation", { ...observation });
      } else {
        await this.request({ debug: { debug: [{ createUnit: { unitType: type, owner: owner, pos: { x: x, y: y }, quantity: 1 } }] } });
      }
    }
  }

  async kill(unit) {
    if (this.isJoined && unit && unit.tag) {
      if (unit.tag.startsWith(SPAWN_ID)) {
        this.spawning.delete(unit.tag);
      } else {
        await this.request({ debug: { debug: [{ killUnit: { tag: [unit.tag] } }] } });
      }

      if (this.isPaused) {
        // Remove the unit from the observation
        const observation = this.state.get("observation");
        const units = observation.observation.rawData.units;

        for (let index = 0; index < units.length; index++) {
          if (units[index].tag === unit.tag) {
            units.splice(index, 1);
            break;
          }
        }

        this.state.set("observation", { ...observation });
      }
    }
  }

  history(step) {
    this.state = history.get(loop(this) + step) || this.state;
  }

  pause() {
    if (this.game && !this.isPaused) this.game.send(Connection.CODE_PAUSE);

    this.isPaused = true;
  }

  async resume() {
    if (this.game && this.isPaused) {
      if (this.spawning.size) {
        await this.request({ debug: { debug: [...this.spawning.values()] } });
      }

      this.spawning.clear();
      this.game.send(Connection.CODE_RESUME);
    }

    this.isPaused = false;
  }

  skip() {
    this.stepSkip = Math.floor(22.4 * 60);
  }

  reset() {
    this.index++;           // Stops replays in progress
    this.isCreated = false;
    this.isJoined = false;
    this.isPaused = false;
    this.stepSize = 1;
    this.stepSkip = 0;
    this.stepTime = 0;

    this.state = new Map();
    this.positions = new Map();
    this.spawning = new Map();
    this.error = null;

    history.clear();
  }

  stop() {
    this.isClosed = true;   // Stops checklist
    this.reset();

    execSync("docker rm -f starcraft");
  }

}

function addDebugItem(state, type, item) {
  switch (type) {
    case "lines": {
      const color = item.color ? `rgb(${item.color.r}, ${item.color.g}, ${item.color.b})` : "gold";
      state.get("debugshapes").push({ shape: "line", x1: item.line.p0.x, y1: item.line.p0.y, x2: item.line.p1.x, y2: item.line.p1.y, width: 1, color: color });
      break;
    }
    case "spheres": {
      const color = item.color ? `rgb(${item.color.r}, ${item.color.g}, ${item.color.b})` : "gold";
      state.get("debugshapes").push({ shape: "circle", x: item.p.x, y: item.p.y, r: item.r, color: color });
      break;
    }
    case "text": {
      if (!item.virtualPos && !item.worldPos) {
        state.get("debugshapes").push(JSON.parse(item.text));
      } else {
        state.get("debugtexts").push(item);
      }
      break;
    }
  }
}

async function stepReplay(game, duration) {
  const index = game.index;

  for (let frame = 0; frame < duration; frame++) {
    // Check if this replay was closed
    if (index !== game.index) return;

    // Check if the game was paused
    while (game.isPaused) await sleep(200);

    const skip = game.stepSkip;
    await game.game.request({ step: { count: (skip ? skip : game.stepSize) } });

    // Check if the replay was closed while waiting for the game step
    if (index !== game.index) return;

    const observation = await game.game.request({ observation: { disableFog: game.disableFog } });

    // Check if the replay was closed while waiting for the observation
    if (index !== game.index) return;

    frame = observation.observation.gameLoop;

    // Only remove the current skip if there was stepSkip before the asynchronous step
    if (skip) game.stepSkip = 0;

    // Delay if necessary for the set speed
    await delay(game, false);
  }
}

async function delay(game, shouldSendPauseCode) {
  if (game.stepTime) {
    const elapsed = Date.now() - game.lastStepTime;
    const delay = game.stepTime - elapsed;

    if (delay > 0) {
      if (shouldSendPauseCode && !game.isPaused) game.game.send(Connection.CODE_PAUSE);

      await sleep(delay);

      if (shouldSendPauseCode && !game.isPaused) game.game.send(Connection.CODE_RESUME);
    }

    game.lastStepTime = Date.now();
  }
}

function loop(game) {
  const observation = game.get("observation");

  if (observation) {
    return observation.observation.gameLoop;
  }
}

function sleep(millis) {
  return new Promise(resolve => setTimeout(resolve, millis));
}

module.exports = new Game();
