const files = require("./files.js");
const game = require("./game.js");
const timer = require("./timer.js");

class Toggles {

  tick = this.refresh.bind(this);

  async attach(container) {
    this.container = container;

    container.webview.options = { enableScripts: true };
    container.webview.html = await files.readHtmlFile("toggles.html");
    container.onDidChangeVisibility(this.renew.bind(this));
    container.onDidDispose(this.detach.bind(this));

    container.webview.onDidReceiveMessage(function(message) {
      switch (message.event) {
        case "click": return this.toggle(message.toggle);
      }
    }.bind(this));

    this.renew();
  }

  detach() {
    this.container = null;
    this.displayed = null;

    timer.remove(this.tick);
  }

  toggle(toggle) {
    game.toggleChatMessage(toggle);
  }

  renew() {
    // Clear cached data so that it's posted again
    this.displayed = null;

    timer.add(this.tick, 300);
  }
  
  refresh() {
    if (!this.container || !this.container.visible) return;

    const toggles = game.get("toggles");
    const todisplay = JSON.stringify(toggles);

    if (toggles && (todisplay !== this.displayed)) {
      this.container.webview.postMessage({ type: "toggles", toggles });

      this.displayed = todisplay;

      // Inform the timer to use a complete tick
      return true;
    }
  }

}

module.exports = new Toggles();
