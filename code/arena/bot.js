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
    container.webview.onDidReceiveMessage(async function(message) {
      if ((message.event === "selection") && message.id) {
        const botInfo = await ArenaApi.getBotInfo(message.id);

        if (botInfo) {
          selection.setBot(botInfo);
        } else {
          selection.setBot({ id: Number(message.id) });
        }
      }
    }.bind(this));

    this.container.webview.postMessage({ bots: selection.favoriteBots });
    this.container.webview.postMessage(selection.bot);
  }

  refresh() {
    if (this.container && this.container.visible) {
      if (selection.bot.id && (this.displayed !== selection.bot)) {
        this.displayed = selection.bot;

        this.container.webview.postMessage({ bots: selection.favoriteBots });
        this.container.webview.postMessage(selection.bot);
      }
    } else {
      this.displayed = null;
    }

    return true;
  }

}

module.exports = new ArenaBot();
