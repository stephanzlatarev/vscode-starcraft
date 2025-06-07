
class Selection {

  bot = {
    id: 0,
    name: null,
  };

  playerId = 1;

  init(context) {
    this.context = context;
    this.bot = context.globalState.get("starcraft.selection.bot") || {
      id: 0,
      name: null,
    };
  }

  setBot(id, name) {
    this.bot.id = id;
    this.bot.name = name;

    this.context.globalState.update("starcraft.selection.bot", this.bot);
  }

}

module.exports = new Selection();
