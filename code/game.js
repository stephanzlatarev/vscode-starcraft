const { execSync, spawnSync } = require("node:child_process");
const Connection = require("./connection.js");
const files = require("./files.js");
const history = require("./history.js");
const Types = require("./types.js");

class Game {

  game = new Connection("ws://127.0.0.1:5001/sc2api", this.onEvent.bind(this));
  state = new Map();
  index = 1;

  isCreated = false;
  isJoined = false;
  isPaused = false;
  isClosed = false;

  stepSize = 1;
  stepSkip = 0;

  error = null;

  async init() {
    spawnSync("docker", ["run", "-d", "--name", "starcraft",
      "-p", "5000:5000", "-p", "5001:5001",
      "-v", files.getReplaysPath().split(":").join("") + ":/replays",
      "stephanzlatarev/starcraft"
    ]);
  }

  async connect() {
    await this.game.connect();
  }

  get(key) {
    return this.state.get(key);
  }

  onEvent(key, value, status) {
    if (value.error > 1) return this.error = value.errorDetails;

    if (!this.isCreated && ((status === 2) || (status === 3))) this.isCreated = true;
    if (!this.isJoined && (status === 3)) this.isJoined = true;

    if ((status === 3) || (status === 4)) {
      this.state.set(key, value);
    }

    if ((status === 3) || (status === 4)) {
      if (key === "data") {
        Types.read(value);
      } else if (key === "step") {
        history.add(loop(this), this.state);

        const gameInfo = this.state.get("gameInfo");
        this.state = new Map();
        this.state.set("gameInfo", gameInfo);
      }
    }
  }

  async play(replayFileName) {
    this.reset();

    if (replayFileName) {
      // Viewing a replay
      const replayPath = "/replays/" + replayFileName;
      const replayInfo = await this.game.request({ replayInfo: { replayPath } });

      await this.game.request({
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

      await this.game.request({ data: { abilityId: true, unitTypeId: true } });
      await this.game.request({ gameInfo: {} });

      stepReplay(this, replayInfo.gameDurationLoops);
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
  }

  async request(message) {
    await this.game.request(message);
  }

  history(step) {
    this.state = history.get(loop(this) + step) || this.state;
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
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

    this.state = new Map();
    this.error = null;

    history.clear();
  }

  stop() {
    this.isClosed = true;   // Stops checklist
    this.reset();

    execSync("docker rm -f starcraft");
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

    const observation = await game.game.request({ observation: { disableFog: true } });

    // Check if the replay was closed while waiting for the observation
    if (index !== game.index) return;

    frame = observation.observation.gameLoop;

    // Only remove the current skip if there was stepSkip before the asynchronous step
    if (skip) game.stepSkip = 0;
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
