const files = require("./files.js");
const game = require("./game.js");

class Host {

  complete = "Create game";

  async checking(container) {
    container.webview.onDidReceiveMessage(this.onMessage.bind(this));

    return await files.readHtmlFile("host.html");
  }

  onMessage(message) {
    if (message.type === "host") {
      game.request({
        createGame: {
          localMap: { mapPath: message.map },
          playerSetup: [
            { type: 1, race: 4 },
            { type: 2, race: message.race, difficulty: message.difficulty, playerName: "Computer" },
          ],
          realtime: false,
        }
      });
    }
  }
}

module.exports = Host;
