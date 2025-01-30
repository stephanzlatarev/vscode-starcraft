const files = require("./files.js");
const game = require("./game.js");
const timer = require("./timer.js");

class Controls {

  tick = this.refresh.bind(this);

  async attach(container) {
    this.container = container;

    container.webview.options = { enableScripts: true };
    container.webview.html = await files.readHtmlFile("controls.html");
    container.onDidChangeVisibility(this.renew.bind(this));
    container.onDidDispose(this.detach.bind(this));

    container.webview.onDidReceiveMessage(function(message) {
      if (message.event === "back") this.back();
      if (message.event === "forth") this.forth();
      if (message.event === "pause") this.pause();
      if (message.event === "resume") this.resume();
      if (message.event === "skip") this.skip();
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

    this.showControls(this.isShowingControls);

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

    post(this, { type: "controls", enabled: this.isShowingControls });
  }

  showControls(flag) {
    this.isShowingControls = !!flag;
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
