const vscode = require("vscode");

let delay;
let last;

class Speed {

  init(context) {
    this.context = context;
    this.reset();
  }

  get() {
    return delay;
  }

  set(value) {
    if (value === delay) return;

    last = delay;
    delay = value;

    this.context.globalState.update("starcraft.speed", delay);
  }

  pause() {
    this.set(null);
  }

  resume() {
    if (delay === null) {
      this.set(last);
    }
  }

  reset() {
    this.set(getStartingSpeed(this.context));
    last = delay;
  }

}

function getStartingSpeed(context) {
  const delay = vscode.workspace.getConfiguration("starcraft").get("speed");

  switch (delay) {
    case "Keep last used": {
      const speed = context.globalState.get("starcraft.speed")
      return (speed >= 0) ? speed : null;
    }
    case "Fast speed": return 0;
    case "Clock time": return 1;
    case "x2 slower": return 2;
    case "x4 slower": return 4;
    case "x8 slower": return 8;
    case "x16 slower": return 16;
    case "Paused": return null;
  }
}

module.exports = new Speed();
