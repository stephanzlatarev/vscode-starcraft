const vscode = require("vscode");

class Selection {

  bot = {
    id: 0,
    name: null,
  };

  favoriteBots = [];
  playerId = 1;

  listeners = [];

  init(context) {
    this.context = context;
    this.bot = context.globalState.get("starcraft.selection.bot") || {
      id: 0,
      name: null,
    };
    this.favoriteBots = context.globalState.get("starcraft.selection.favoriteBots") || [];
    vscode.commands.executeCommand("setContext", "starcraft.isBotSelected", !!this.bot.name);
  }

  addFavoriteBot(id, name) {
    if (id && name && !this.favoriteBots.some(bot => (bot.id === id))) {
      this.favoriteBots.push({ id, name });
      this.context.globalState.update("starcraft.selection.favoriteBots", this.favoriteBots);
    }
  }

  setBot(info) {
    if (!info || !info.id) return;

    if (JSON.stringify(this.bot) !== JSON.stringify(info)) {
      this.bot = info;

      this.context.globalState.update("starcraft.selection.bot", this.bot);
      vscode.commands.executeCommand("setContext", "starcraft.isBotSelected", !!info.name);

      for (const callback of this.listeners) {
        callback(info);
      }
    }

    this.addFavoriteBot(info.id, info.name);
  }

  addListener(callback) {
    if (callback && (this.listeners.indexOf(callback) < 0)) {
      this.listeners.push(callback);
    }
  }

}

module.exports = new Selection();
