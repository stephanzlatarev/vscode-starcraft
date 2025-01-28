const { execSync, spawnSync } = require("node:child_process");
const sc2def = require("@node-sc2/proto/root/index.js");
const sc2api = require("@node-sc2/proto");
const WebSocket = require("ws");
const files = require("./files.js");
const Types = require("./types.js");

const Request = sc2def.lookupType("Request");
const Response = sc2def.lookupType("Response");

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

  async host() {
    await this.player.host();
  }

  async start() {
    await this.player.start();
  }

  async request(message) {
    await this.player.request(message);
  }

  get(key) {
    return state.get(key);
  }

  units(viewbox) {
    const observation = state.get("observation");

    if (!observation) {
      return [];
    } else if (viewbox) {
      const units = [];
      const index = new Map();
      const orders = new Map();

      const raws = observation.observation.rawData.units;
      const minx = viewbox.left;
      const miny = viewbox.top;
      const maxx = viewbox.left + viewbox.width;
      const maxy = viewbox.top + viewbox.height;

      for (const one of raws) {
        if ((one.pos.x >= minx - one.radius) && (one.pos.x <= maxx + one.radius) && (one.pos.y >= miny - one.radius) && (one.pos.y <= maxy + one.radius)) {
          const unit = getUnitDetailedInfo(one);

          units.push(unit);
          index.set(one.tag, unit);

          if (one.orders && one.orders.length) {
            const order = one.orders[0];

            if (order.targetUnitTag || order.targetWorldSpacePos) {
              orders.set(unit, order);
            }
          }
        }
      }

      for (const [unit, order] of orders) {
        if (order.targetWorldSpacePos) {
          unit.order = { x: order.targetWorldSpacePos.x, y: order.targetWorldSpacePos.y };
        } else if (order.targetUnitTag) {
          const target = index.get(order.targetUnitTag);

          if (target) {
            unit.order = { x: target.x, y: target.y };
          }
        }
      }

      units.sort((a, b) => ((a.z - b.z) || (b.owner - a.owner) || (b.r - a.r)));

      return units;
    } else {
      return observation.observation.rawData.units.map(getUnitBasicInfo);
    }
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

    state.clear();
  }

  stop() {
    this.reset();
    execSync("docker rm -f starcraft");
  }
}

function getUnitBasicInfo(unit) {
  return { type: Types.get(unit.unitType), owner: unit.owner, x: unit.pos.x, y: unit.pos.y, r: unit.radius };
}

function getUnitDetailedInfo(unit) {
  return {
    type: Types.get(unit.unitType),
    owner: unit.owner,
    x: unit.pos.x,
    y: unit.pos.y,
    z: unit.pos.z,
    r: unit.radius,
    wip: (unit.displayType === 4) || (unit.buildProgress < 1),
    cloak: (unit.cloak !== 3),
  };
}

class Player {

  isClosed = false;
  isPaused = false;

  stepSize = 1;
  stepSkip = 0;

  host() {}
  request() {}

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
      observedPlayerId: 0,
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

    Types.read(await this.client.data({ unitTypeId: true }));

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

  isGameCreated = false;
  isGameJoined = false;
  error = null;

  async connect() {
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        const connection = new WebSocket("ws://127.0.0.1:5001/sc2api");

        await new Promise(function(resolve, reject) {
          connection.on("open", () => resolve(connection));
          connection.on("error", reject);
        });

        connection.on("message", this.onGameEvent.bind(this));

        this.connection = connection;
        this.error = null;

        return;
      } catch (_) {
        await sleep(100);
      }
    }

    throw new Error("Unable to connect");
  }

  async host() {
    while (!this.isGameCreated && !this.isClosed) {
      if (this.error) throw new Error(this.error);

      await sleep(200);
    }
  }

  async start() {
    while (!this.isGameJoined && !this.isClosed) {
      await sleep(200);
    }
  }

  async request(message) {
    this.connection.send(Request.encode(Request.create(message)).finish());
  }

  onGameEvent(data) {     
    try {
      const decoded = Response.decode(data);

      if (!this.isGameCreated && ((decoded.status === 2) || (decoded.status === 3))) this.isGameCreated = true;
      if (!this.isGameJoined && (decoded.status === 3)) this.isGameJoined = true;

      if (decoded.createGame && (decoded.createGame.error !== 1)) this.error = decoded.createGame.errorDetails;

      if (decoded.status === 3) { // Status in_game        
        const response = Response.toObject(decoded, { bytes: Array, longs: String, defaults: true });

        for (const key in response) {
          const field = Response.fields[key];
          const value = response[key];

          if (field && (field.typeDefault === null)) {
            state.set(key, value);

            if (key === "data") {
              Types.read(value);
            }
          }
        }
      }
    } catch (error) {
      console.error("Unable to decode game event:", error.message ? error.message : error);
    }
  }
}

function sleep(millis) {
  return new Promise(resolve => setTimeout(resolve, millis));
}

module.exports = new Game();
