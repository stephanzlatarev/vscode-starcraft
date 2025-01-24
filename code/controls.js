const files = require("./files.js");
const game = require("./game.js");

class Controls {

  async attach(container) {
    this.container = container;

    container.webview.options = { enableScripts: true };
    container.webview.html = await files.readHtmlFile("controls.html");
    container.onDidChangeVisibility(this.renew.bind(this));
    container.onDidDispose(this.detach.bind(this));

    this.refresh();
  }

  detach() {
    this.container = null;
    this.observation = null;
  }

  renew() {
    if (this.container.visible) {
      // Clear cached data so that it's posted again
      this.observation = null;

      this.refresh();
    } else if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

  refresh() {
    if (!this.container) return;

    const observation = game.get("observation");

    if (observation && (observation !== this.observation)) {
      this.container.webview.postMessage({
        type: "observation",
        loop: observation.observation.gameLoop,
        player: observation.observation.playerCommon
      });

      this.observation = observation;
    }

    this.timeout = setTimeout(this.refresh.bind(this), 40);
  }

}

module.exports = new Controls();
