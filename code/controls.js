const BotPlay = require("./botplay.js");
const BotSync = require("./botsync.js");
const camera = require("./camera.js");
const files = require("./files.js");
const game = require("./game.js");
const timer = require("./timer.js");
const Types = require("./types.js");
const units = require("./units.js");

class Controls {

  containers = [];
  action = { mode: "select" };
  tick = this.refresh.bind(this);

  async attach(container) {
    this.containers.push(container);

    container.webview.options = { enableScripts: true };
    container.webview.html = await files.readHtmlFile("controls.html");
    container.onDidChangeVisibility(this.renew.bind(this));
    container.onDidDispose(this.detach.bind(this));

    container.webview.onDidReceiveMessage(function(message) {
      switch (message.event) {
        case "back": return this.back();
        case "botplay": return new BotPlay();
        case "botsync": return new BotSync();
        case "fog": return game.toggleFog();
        case "forth": return this.forth();
        case "mouse": return this.mouse(message.action);
        case "owner": return toggleSpawnOwner(this);
        case "pause": return this.pause();
        case "resume": return this.resume();
        case "skip": return this.skip();
        case "speed": return this.speed();
      }
    }.bind(this));

    timer.add(this.tick, 40);
  }

  detach() {
    this.containers = [];
    this.container = null;
    this.observation = null;
  }

  renew() {
    // Clear cached data so that it's posted again
    this.container = null;
    this.observation = null;
    this.activeAction = null;
    this.activeState = null;
    this.activeTypes = null;
  }

  refresh() {
    const container = this.containers.find(one => one.visible);

    if (!container || !container.visible) return;

    const observation = game.get("observation");

    if (observation && ((observation !== this.observation) || (container !== this.container))) {
      post(this, {
        type: "observation",
        loop: observation.observation.gameLoop,
        player: observation.observation.playerCommon
      }, () => {
        this.observation = observation;
      });
    }

    if ((this.activeAction !== this.action) || (this.activeState !== this.state) || (container !== this.container)) {
      post(this,
        { type: "controls", config: this.state, action: this.action },
        () => {
          this.activeAction = this.action;
          this.activeState = this.state;
        }
      );
    }

    if ((this.activeTypes !== Types.units.size) || (container !== this.container)) {
      const types = [];

      for (const [id, type] of Types.units) {
        if (type.alias === type.name) {
          types.push({ id, name: type.name });
        }
      }
      types.sort((a, b) => a.name.localeCompare(b.name));

      post(this,
        { type: "types", types: types },
        () => {
          this.activeTypes = Types.units.size;
        }
      );
    }

    this.container = container;
  }

  reset(config, action) {
    this.config = { ...config };
    this.action = { ...action };

    if (game.isPaused) {
      this.state = { back: false, botplay: false, botsync: false, forth: false, pause: false, resume: true, speed: "fast speed", ...config };
    } else {
      this.state = { back: false, botplay: false, botsync: false, forth: false, resume: false, speed: "fast speed", ...config };
    }

    this.renew();
  }

  back() {
    if (!this.isPaused) this.pause();

    post(this, { type: "back" });
    game.history(-1);
  }

  forth() {
    if (!this.isPaused) this.pause();

    post(this, { type: "forth" });
    game.history(+1);
  }

  mouse(action) {
    this.action = action;
  }

  click(x, y) {
    if (this.action.mode === "kill") {
      game.kill(units.find(camera.viewbox, x, y));
    } else if (this.action.mode === "select") {
      camera.select(units.find(camera.viewbox, x, y));
    } else if (this.action.mode === "spawn") {
      game.spawn(this.action.owner, this.action.type, x, y);
    }
  }

  pause(toggle) {
    if (toggle && this.isPaused) {
      this.resume();
    } else {
      this.isPaused = true;
      this.activeState = null;

      this.state.back = true;
      this.state.botplay = (this.config.botplay !== false);
      this.state.botsync = (this.config.botsync !== false);
      this.state.forth = true;
      this.state.pause = false;
      this.state.resume = true;
      this.state.skip = false;

      game.pause();
    }
  }

  resume() {
    this.isPaused = false;
    this.activeState = null;

    this.state.back = false;
    this.state.botplay = false;
    this.state.botsync = false;
    this.state.forth = false;
    this.state.pause = true;
    this.state.resume = false;
    this.state.skip = (this.config.skip !== false);

    game.resume();
  }

  skip() {
    post(this, { type: "skip" });
    game.skip();
  }

  speed() {
    if (this.config.speed >= 16) {
      this.config.speed = 0;
      this.state.speed = "fast speed";
      game.setStepTime(0);
    } else if (this.config.speed >= 4) {
      this.config.speed = 16;
      this.state.speed = "x16 slower";
      game.setStepTime(16 * 1000 / 22.4);
    } else if (this.config.speed >= 2) {
      this.config.speed = 4;
      this.state.speed = "x4 slower";
      game.setStepTime(4 * 1000 / 22.4);
    } else if (this.config.speed >= 1) {
      this.config.speed = 2;
      this.state.speed = "x2 slower";
      game.setStepTime(2 * 1000 / 22.4);
    } else {
      this.config.speed = 1;
      this.state.speed = "clock time";
      game.setStepTime(1000 / 22.4);
    }

    this.activeState = null;
  }

}

function toggleSpawnOwner(controls) {
  controls.action.owner = (controls.action.owner === 2) ? 1 : 2;
  controls.activeAction = null;
}

function post(controls, message, onPosted) {
  if (controls.container) {
    controls.container.webview.postMessage(message);

    if (onPosted) {
      onPosted();
    }
  }
}

module.exports = new Controls();
