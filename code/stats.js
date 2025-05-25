const files = require("./files.js");
const MpqFile = require("./mpq.js");

const StatKeys = {
  0: "Minerals current",
  1: "Vespene current",
  2: "Minerals collection rate",
  3: "Vespene collection rate",
  4: "Workers active count",
  5: "Minerals used in progress army",
  6: "Minerals used in progress economy",
  7: "Minerals used in progress technology",
  8: "Vespene used in progress army",
  9: "Vespene used in progress economy",
  10: "Vespene used in progress technology",
  11: "Minerals used current army",
  12: "Minerals used current economy",
  13: "Minerals used current technology",
  14: "Vespene used current army",
  15: "Vespene used current economy",
  16: "Vespene used current technology",
  17: "Minerals lost army",
  18: "Minerals lost economy",
  19: "Minerals lost technology",
  20: "Vespene lost army",
  21: "Vespene lost economy",
  22: "Vespene lost technology",
  23: "Minerals killed army",
  24: "Minerals killed economy",
  25: "Minerals killed technology",
  26: "Vespene killed army",
  27: "Vespene killed economy",
  28: "Vespene killed technology",
  29: "Food used",
  30: "Food made",
  31: "Minerals used active forces",
  32: "Vespene used active forces",
  33: "Minerals friendly fire army",
  34: "Minerals friendly fire economy",
  35: "Minerals friendly fire technology",
  36: "Vespene friendly fire army",
  37: "Vespene friendly fire economy",
  38: "Vespene friendly fire technology"
};

class Stats {

  decoder = null;
  loop = 0;
  stats = {
    1: {}, // Player 1
    2: {}, // Player 2
  };

  async read(filename) {
    const mpq = new MpqFile(await files.readReplayFile(filename));

    this.decoder = mpq.read("replay.tracker.events");
    this.loop = 0;
  }

  get() {
    return this.stats;
  }

  step(loop) {
    const decoder = this.decoder;
    if (!decoder) return;
    if (this.loop > loop) return;

    while (decoder.seek((a, b) => (a === 0x03) && ((b === 0x00) || (b === 0x02)), 2)) {
      decoder.skip(2); // 03 00

      const frames = decoder.read();
      if (typeof(frames) !== "number") continue;

      this.loop += frames;

      const type = decoder.read();
      const data = decoder.read();

      if (type === 0) {
        // Player stats event
        const player = data["0"];
        const raw = data["1"];
        const values = {};
        for (const i in raw) {
          values[StatKeys[i]] = ((i == 29) || (i == 30)) ? (raw[i] / 4096).toFixed(0) : raw[i];
        }

        this.stats[player] = values;
        this.stats.loop = this.loop;
      }

      if (this.loop > loop) return;
    }
  }

  clear() {
    this.decoder = null;
    this.stats = {
      1: {}, // Player 1
      2: {}, // Player 2
    };
  }
}

module.exports = new Stats();
