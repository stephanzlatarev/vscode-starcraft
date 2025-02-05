const vscode = require("vscode");
const game = require("./game.js");
const timer = require("./timer.js");

class Debug {

  emitter = new vscode.EventEmitter();
  tick = this.refresh.bind(this);

  start() {
    this.terminal = vscode.window.createTerminal({
      name: "Debug",
      pty: {
        onDidWrite: this.emitter.event,
        open: this.attach.bind(this),
        close: this.detach.bind(this),
        handleInput: () => {},
      }
    });
  }

  attach() {
    this.observation = null;
    this.digest = null;

    timer.add(this.tick, 3000);
  }

  detach() {
    this.observation = null;
    this.digest = null;

    timer.remove(this.tick);
  }
  
  refresh() {
    const observation = game.get("observation");

    if (observation && (observation !== this.observation)) {
      const lines = game.get("debugtext");
      const digest = JSON.stringify(lines);

      if (digest !== this.digest) {
        this.emitter.fire("\x1b[3J\x1b[H\x1b[2J");

        if (lines) {
          this.emitter.fire(lines.map(line => line.text).join("\r\n"));
        }
      }

      this.observation = observation;
      this.digest = digest;

      // Inform the timer to use a complete tick
      return true;
    }
  }

  stop() {
    if (this.terminal) {
      this.terminal.dispose();
    }
  }

}

module.exports = new Debug();
