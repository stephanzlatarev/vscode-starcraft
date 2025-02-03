const camera = require("./camera.js");
const files = require("./files.js");
const game = require("./game.js");
const timer = require("./timer.js");
const Types = require("./types.js");
const units = require("./units.js");

class Controls {

  action = { mode: "select" };
  tick = this.refresh.bind(this);

  async attach(container) {
    this.container = container;

    container.webview.options = { enableScripts: true };
    container.webview.html = await files.readHtmlFile("controls.html");
    container.onDidChangeVisibility(this.renew.bind(this));
    container.onDidDispose(this.detach.bind(this));

    container.webview.onDidReceiveMessage(function(message) {
      switch (message.event) {
        case "back": return this.back();
        case "forth": return this.forth();
        case "mouse": return this.mouse(message.action);
        case "pause": return this.pause();
        case "resume": return this.resume();
        case "skip": return this.skip();
      }
    }.bind(this));

    this.renew();
  }

  detach() {
    this.container = null;
    this.observation = null;
  }

  renew() {
    // Clear cached data so that it's posted again
    this.observation = null;
    this.activeConfig = null;
    this.activeTypes = null;

    this.setConfig(this.config);

    timer.add(this.tick, 40);
  }

  refresh() {
    if (!this.container || !this.container.visible) return;

    const observation = game.get("observation");

    if (observation && (observation !== this.observation)) {
      this.container.webview.postMessage({
        type: "observation",
        loop: observation.observation.gameLoop,
        player: observation.observation.playerCommon
      });

      this.observation = observation;
    }

    if (this.activeConfig !== this.config) {
      post(this, { type: "config", config: this.config });

      this.activeConfig = this.config;
    }

    if (this.activeTypes !== Types.units.size) {
      const types = [];

      for (const [id, type] of Types.units) {
        if (type.alias === type.name) {
          types.push({ id, name: type.name });
        }
      }
      types.sort((a, b) => a.name.localeCompare(b.name));

      post(this, { type: "types", types: types });

      this.activeTypes = Types.units.size;
    }
  }

  setConfig(flags) {
    this.config = { ...flags };
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
    if (this.action.mode === "select") {
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
      post(this, { type: "pause" });
      game.pause();
    }
  }

  resume() {
    this.isPaused = false;
    post(this, { type: "resume" });
    game.resume();
  }

  skip() {
    post(this, { type: "skip" });
    game.skip();
  }

}

function post(controls, message) {
  if (controls.container) {
    controls.container.webview.postMessage(message);
  }
}

module.exports = new Controls();
