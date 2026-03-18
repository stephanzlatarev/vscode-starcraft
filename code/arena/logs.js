const files = require("../files.js");
const selection = require("../selection.js");
const ArenaApi = require("./api.js");

class ArenaLogs {

  async downloadLogs(match) {
    if (!selection.bot || !selection.bot.id) return [];

    const directory = "logs/" + match.id;

    const downloaded = await files.listFiles(directory);
    if (downloaded.length) return downloaded;

    const buffers = await ArenaApi.getLogs(selection.bot.id, match.id);
    const logs = [];

    for (const [filename, buffer] of buffers) {
      if (!buffer.length) continue;

      logs.push(await files.saveFile(buffer, directory, filename));
    }

    return logs;
  }

}

module.exports = new ArenaLogs();
