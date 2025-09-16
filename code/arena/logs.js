const files = require("../files.js");
const selection = require("../selection.js");
const ArenaApi = require("./api.js");

class ArenaLogs {

  async downloadLogs(match) {
    if (!selection.bot || !selection.bot.id) return;

    const buffer = await ArenaApi.getLogs(selection.bot.id, match.id);

    return await files.saveFile(buffer, "logs", `${match.id}.log`);
  }

}

module.exports = new ArenaLogs();
