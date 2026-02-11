const BotPlay = require("./botplay.js");
const BotSync = require("./botsync.js");
const camera = require("./camera.js");
const files = require("./files.js");
const game = require("./game.js");
const Speed = require("./speed.js");
const timer = require("./timer.js");
const Types = require("./types.js");
const units = require("./units.js");

class Controls {

  containers = [];
  action = { mode: "select" };
  tick = this.refresh.bind(this);

  async attach(container) {
    this.containers.push(container);
    this.iconsPath = files.getIconsPath(container.webview);

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
        case "skip": return this.skip();
        case "speed": return this.speed(message.speed);
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
    this.activeSpeed = null;
    this.activeState = null;
    this.activeTypes = null;
  }

  refresh() {
    const container = this.containers.find(one => one.visible);

    if (!container || !container.visible) return;

    const observation = game.get("observation");
    const speed = Speed.get();

    syncControlsToSpeed(this);

    if (observation && ((observation !== this.observation) || (container !== this.container))) {
      post(this, {
        type: "observation",
        loop: observation.observation.gameLoop,
        player: observation.observation.playerCommon,
        icons: this.iconsPath,
      }, () => {
        this.observation = observation;
      });
    }

    if ((this.activeAction !== this.action) || (this.activeSpeed !== speed) || (this.activeState !== this.state) || (container !== this.container)) {
      post(this,
        { type: "controls", speed, config: this.state, action: this.action },
        () => {
          this.activeAction = this.action;
          this.activeSpeed = speed;
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

    this.state = { back: false, botplay: false, botsync: false, forth: false, ...config };

    this.renew();
  }

  back() {
    post(this, { type: "back" });
    game.history(-1);
  }

  forth() {
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

      Speed.pause();
      game.pause();
    }
  }

  resume() {
    this.isPaused = false;
    this.activeState = null;

    Speed.resume();
    game.resume();
  }

  skip() {
    post(this, { type: "skip" });
    game.skip();
  }

  speed(speed) {
    Speed.set(speed);
    syncControlsToSpeed(this);

    this.activeSpeed = speed;
    this.activeState = null;
  }

}

function syncControlsToSpeed(controls) {
  const speed = Speed.get();

  if (speed !== null) {
    // Game is running
    controls.state.back = false;
    controls.state.botplay = false;
    controls.state.botsync = false;
    controls.state.forth = false;
    controls.state.skip = (controls.config.skip !== false);

    if (controls.isPaused) {
      controls.resume();
    }
  } else {
    // Game is paused
    controls.state.back = true;
    controls.state.botplay = (controls.config.botplay !== false);
    controls.state.botsync = (controls.config.botsync !== false);
    controls.state.forth = true;
    controls.state.skip = false;

    if (!controls.isPaused) {
      controls.pause();
    }
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
