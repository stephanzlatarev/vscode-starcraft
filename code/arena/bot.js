const files = require("../files.js");
const selection = require("../selection.js");
const timer = require("../timer.js");

class ArenaBot {

  tick = this.refresh.bind(this);
  displayed = null;

  constructor() {
    timer.add(this.tick, 1000);
  }

  async attach(container) {
    this.container = container;

    container.webview.options = { enableScripts: true };
    container.webview.html = await files.readHtmlFile("arena", "bot.html");
    container.webview.onDidReceiveMessage(function(message) {
      switch (message.event) {
        case "selection": return selection.setBot(message.id);
        case "displayed": return this.displayed = message.name;
      }
    });
  }

  refresh() {
    if (this.container && this.container.visible) {
      if (this.displayed !== selection.bot.name) {;
        this.container.webview.postMessage((selection.bot.id && selection.bot.name) ? selection.bot : null);
      }
    } else {
      this.displayed = null;
    }

    return true;
  }

}

module.exports = new ArenaBot();
