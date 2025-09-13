const files = require("../files.js");
const selection = require("../selection.js");
const timer = require("../timer.js");
const ArenaApi = require("./api.js");

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
      if (message.event === "selection") {
        selection.setBot(message.id);
      }
    }.bind(this));

    this.container.webview.postMessage({ bots: selection.favoriteBots });
  }

  async refresh() {
    if (this.container && this.container.visible) {
      if (selection.bot.id && (this.displayed !== selection.bot.id)) {
        this.displayed = selection.bot.id;

        this.container.webview.postMessage({ bots: selection.favoriteBots });

        const botInfo = await ArenaApi.getBotInfo(selection.bot.id);

        if (botInfo) {
          this.container.webview.postMessage(botInfo);
        } else {
          this.container.webview.postMessage({ id: selection.bot.id });
        }
      }
    } else {
      this.displayed = null;
    }

    return true;
  }

}

module.exports = new ArenaBot();
