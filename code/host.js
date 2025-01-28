const files = require("./files.js");
const game = require("./game.js");

class Host {

  constructor(container) {
    container.webview.onDidReceiveMessage(function(message) {
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
    });
  }

  async checking() {
    return await files.readHtmlFile("host.html");
  }

  complete() {
    return "<span class='head'>Create game</span>";
  }

}

module.exports = Host;
