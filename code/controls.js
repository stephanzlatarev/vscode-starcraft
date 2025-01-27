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

    this.container.webview.postMessage({ type: "controls", enabled: this.isShowingControls });
  }

  showControls(flag) {
    this.isShowingControls = !!flag;
  }

  pause() {
    if (this.container) this.container.webview.postMessage({ type: "pause" });
  }

  resume() {
    if (this.container) this.container.webview.postMessage({ type: "resume" });
  }

}

module.exports = new Controls();
