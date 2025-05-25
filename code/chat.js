const vscode = require("vscode");
const game = require("./game.js");

const LOOPS_PER_SECOND = 22.4;
const LOOPS_PER_MINUTE = LOOPS_PER_SECOND * 60;

class Chat {

  emitter = new vscode.EventEmitter();
  loop = 0;

  start() {
    if (this.terminal && !this.terminal.exitStatus) {
      this.terminal.show();
    } else {
      this.terminal = vscode.window.createTerminal({
        name: "Chat",
        pty: {
          onDidWrite: this.emitter.event,
          handleInput: () => {},
        }
      });
    }

    game.watching.add(this);
  }

  observe(frame) {
    if (frame.observation.gameLoop < this.loop) {
      clearScreen(this.emitter);
    }

    this.loop = frame.observation.gameLoop;

    for (const line of frame.chat) {
      const minutes = Math.floor(this.loop / LOOPS_PER_MINUTE);
      const seconds = Math.floor(this.loop / LOOPS_PER_SECOND) % 60;
      const mm = (minutes >= 10) ? minutes : "0" + minutes;
      const ss = (seconds >= 10) ? seconds : "0" + seconds;

      if (line.playerId === 1) {
        if (line.message.startsWith("Tag:")) {
          this.emitter.fire(`\x1b[38;2;0;0;160m${mm}:${ss} (${this.loop}):\x1b[0m Tag:\x1b[1;37;44m${line.message.slice(4)}\x1b[0m\r\n`);
        } else {
          this.emitter.fire(`\x1b[38;2;0;0;160m${mm}:${ss} (${this.loop}):\x1b[0m ${line.message}\r\n`);
        }
      } else {
        if (line.message.startsWith("Tag:")) {
          this.emitter.fire(`\x1b[38;2;160;0;0m${mm}:${ss} (${this.loop}):\x1b[0m Tag:\x1b[1;37;41m${line.message.slice(4)}\x1b[0m\r\n`);
        } else {
          this.emitter.fire(`\x1b[38;2;160;0;0m${mm}:${ss} (${this.loop}):\x1b[0m ${line.message}\r\n`);
        }
      }
    }
  }

  stop() {
    game.watching.delete(this);

    if (this.terminal) {
      this.terminal.dispose();
    }
  }

}

function clearScreen(emitter) {
  emitter.fire("\x1b[3J\x1b[H\x1b[2J");
}

module.exports = new Chat();
