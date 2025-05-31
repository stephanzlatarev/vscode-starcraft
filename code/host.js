const files = require("./files.js");
const game = require("./game.js");

class Host {

  complete = "Create game";

  async checking(container) {
    container.webview.onDidReceiveMessage(this.onMessage.bind(this));

    return await files.readHtmlFile("host.html");
  }

  async onMessage(message) {
    if (message.type === "host") {
      try {
        await game.request({
          createGame: {
            localMap: { mapPath: message.map },
            playerSetup: [
              { type: 1, race: 4 },
              { type: 2, race: message.race, difficulty: message.difficulty, playerName: "Computer" },
            ],
            realtime: false,
          }
        });
      } catch (error) {
        if (error.length && (error.indexOf("Already in the process of starting a game") >= 0)) {
          game.isCreated = true;
        } else {
          console.error("Unable to start game.", error);
        }
      }
    }
  }
}

module.exports = Host;
