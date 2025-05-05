const game = require("./game.js");

let start;

class BotSync {

  constructor() {
    this.gameInfo = game.get("gameInfo");
    this.observation = game.get("observation");

    start(null, null, "start-game", [
      ["prepare-game-sync", game.sync.bind(game), "Prepare game for sync play"],
      ["wait-bot", game.start.bind(game), "Wait for a bot to join the game"],
    ], true);
  }

  static setStarter(starter) {
    start = starter;
  }

}

module.exports = BotSync;
