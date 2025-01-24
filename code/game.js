const { execSync, spawnSync } = require("node:child_process");
const sc2def = require("@node-sc2/proto/root/index.js");
const sc2api = require("@node-sc2/proto");
const WebSocket = require("ws");
const files = require("./files.js");

const Response = sc2def.lookupType("Response");

const types = new Map();
const state = new Map();

class Game {

  init() {
    spawnSync("docker", ["run", "-d", "--name", "starcraft",
      "-p", "5000:5000", "-p", "5001:5001",
      "-v", files.getReplaysPath().split(":").join("") + ":/replays",
      "stephanzlatarev/starcraft"
    ]);
  }

  async play() {
    this.reset();
    this.player = new GamePlayer();

    await this.player.connect();
  }

  async replay(fileName) {
    this.reset();
    this.player = new ReplayPlayer("/replays/" + fileName);

    await this.player.connect();
  }

  async start() {
    await this.player.start();
  }

  get(key) {
    return state.get(key);
  }

  units() {
    const observation = state.get("observation");
    if (!observation) return [];

    const units = observation.observation.rawData.units.map(unit => ({
      type: types.get(unit.unitType),
      owner: unit.owner,
      x: unit.pos.x,
      y: unit.pos.y,
      z: unit.pos.z,
      r: unit.radius,
      display: unit.displayType,
      cloak: unit.cloak,
    }));
    units.sort((a, b) => ((a.z - b.z) || (b.owner - a.owner) || (b.r - a.r)));

    return units;
  }

  pause() {
    if (this.player) this.player.pause();
  }

  resume() {
    if (this.player) this.player.resume();
  }

  skip() {
    if (this.player) this.player.skip();
  }

  reset() {
    if (this.player) this.player.close();

    types.clear();
    state.clear();
  }

  stop() {
    this.reset();
    execSync("docker rm -f starcraft");
  }
}

class Player {

  isClosed = false;
  isPaused = false;

  stepSize = 1;
  stepSkip = 0;

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
  }

  skip() {
    this.stepSkip = Math.floor(22.4 * 60);
  }

  close() {
    this.isClosed = true;
  }

}

class ReplayPlayer extends Player {

  constructor(file) {
    super();
    this.file = file;
  }

  async connect() {
    const client = sc2api();

    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        await client.connect({ host: "127.0.0.1", port: 5000 });

        return this.client = client;
      } catch (_) {
        await sleep(1000);
      }
    }

    throw new Error("Unable to connect");
  }

  async start() {
    await this.client.startReplay({
      replayPath: this.file,
      observedPlayerId: 1,
      realtime: false,
      options: {
        raw: true,
        showCloaked: true,
        showBurrowedShadows: true,
        showPlaceholders: true,
      },
    });

    this.run();
  }

  async run() {
    const replayInfo = await this.client.replayInfo({ replayPath: this.file });
    const duration = replayInfo.gameDurationLoops;

    readUnitTypes(await this.client.data({ unitTypeId: true }));

    state.set("gameInfo", await this.client.gameInfo());

    for (let frame = 0; frame < duration; frame++) {
      // Check if the player was closed
      if (this.isClosed) return;

      // Check if the player was paused
      while (this.isPaused) await sleep(200);

      const skip = this.stepSkip;
      await this.client.step({ count: (skip ? skip : this.stepSize) });

      // Check if the player was closed while waiting for the game step
      if (this.isClosed) return;

      const observation = await this.client.observation({ disableFog: true });

      // Check if the player was closed while waiting for the observation
      if (this.isClosed) return;

      frame = observation.observation.gameLoop;
      state.set("observation", observation);

      // Only remove the current skip if there was stepSkip before the asynchronous step
      if (skip) this.stepSkip = 0;
    }
  }

}

class GamePlayer extends Player {

  async connect() {
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        return this.connection = await open();
      } catch (_) {
        await sleep(100);
      }
    }

    throw new Error("Unable to connect");
  }

  async start() {
    let isGameCreated = false;

    this.connection.on("message", function(data) {      
      try {
        const decoded = Response.decode(data);

        if (decoded.status === 3) { // Status in_game        
          const response = Response.toObject(decoded, { bytes: Array, longs: String, defaults: true });

          for (const key in response) {
            const field = Response.fields[key];
            const value = response[key];

            if (field && (field.typeDefault === null)) {
              state.set(key, value);

              if (!isGameCreated && (key === "joinGame")) {
                isGameCreated = true;
              } else if (key === "data") {
                if (value.units) readUnitTypes(value);
              }
            }
          }
        }
      } catch (error) {
        console.error("Unable to decode game event:", error.message ? error.message : error);
      }
    });

    while (!this.isClosed && !isGameCreated) {
      await sleep(200);
    }
  }

}

function open() {
  const connection = new WebSocket("ws://127.0.0.1:5001/sc2api");

  return new Promise(function(resolve, reject) {
    connection.on("open", () => resolve(connection));
    connection.on("error", reject);
  });
}

function sleep(millis) {
  return new Promise(resolve => setTimeout(resolve, millis));
}

function readUnitTypes(data) {
  for (const unit of data.units) {
    if (unit.unitId && unit.name) {
      const type = {
        name: mapUnitName(unit.name),
        kind: 0,
      };

      if (unit.name.indexOf("MineralField") >= 0) {
        type.kind = 2;
      } else if (unit.name.indexOf("Geyser") >= 0) {
        type.kind = 3;
      } else if (unit.attributes && (unit.attributes.indexOf(8) >= 0)) {
        type.kind = 1; // Building
      }

      types.set(unit.unitId, type);
    }
  }
}

function mapUnitName(name) {
  if (name === "SupplyDepotLowered") return "SupplyDepot";

  return name;
}

module.exports = new Game();
