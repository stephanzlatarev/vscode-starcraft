const files = require("./files.js");
const game = require("./game.js");
const timer = require("./timer.js");

class Actions {

  tick = this.refresh.bind(this);

  async attach(container) {
    this.container = container;

    container.webview.options = { enableScripts: true };
    container.webview.html = await files.readHtmlFile("actions.html");
    container.onDidChangeVisibility(this.renew.bind(this));
    container.onDidDispose(this.detach.bind(this));

    this.renew();
  }

  detach() {
    this.container = null;
    this.observation = null;

    timer.remove(this.tick);
  }

  renew() {
    // Clear cached data so that it's posted again
    this.observation = null;

    timer.add(this.tick, 300);
  }
  
  refresh() {
    if (!this.container || !this.container.visible) return;

    const observation = game.get("observation");

    if (observation && (observation !== this.observation)) {
      const actions = observation.actions.filter(action => !!(action.actionRaw && action.actionRaw.unitCommand))
        .map(action => ({ loop: action.gameLoop, command: action.actionRaw.unitCommand }));

      this.container.webview.postMessage({ type: "actions", actions });

      this.observation = observation;

      // Inform the timer to use a complete tick
      return true;
    }
  }

}

module.exports = new Actions();
