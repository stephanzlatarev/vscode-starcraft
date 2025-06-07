
class Selection {

  bot = {
    id: 0,
    name: null,
  };

  playerId = 1;

  setBot(id) {
    this.bot.id = id;
    this.bot.name = null;
  }

}

module.exports = new Selection();
