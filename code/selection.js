
class Selection {

  bot = {
    id: 0,
    name: null,
  };

  favoriteBots = [];
  playerId = 1;

  init(context) {
    this.context = context;
    this.bot = context.globalState.get("starcraft.selection.bot") || {
      id: 0,
      name: null,
    };
    this.favoriteBots = context.globalState.get("starcraft.selection.favoriteBots") || [];
  }

  addFavoriteBot(id, name) {
    if (id && name && !this.favoriteBots.some(bot => (bot.id === id))) {
      this.favoriteBots.push({ id, name });
      this.context.globalState.update("starcraft.selection.favoriteBots", this.favoriteBots);
    }
  }

  setBot(id, name) {
    if ((this.bot.id !== id) || (this.bot.name !== name)) {
      this.bot.id = id;
      this.bot.name = name;

      this.context.globalState.update("starcraft.selection.bot", this.bot);
    }

    this.addFavoriteBot(id, name);
  }

}

module.exports = new Selection();
