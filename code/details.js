const vscode = require("vscode");
const game = require("./game.js");
const timer = require("./timer.js");
const Types = require("./types.js");
const units = require("./units.js");

const TAB = "  ";

class Details {

  emitter = new vscode.EventEmitter();
  tick = this.refresh.bind(this);

  start() {
    this.terminal = vscode.window.createTerminal({
      name: "Unit",
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
    this.displayedUnitTag = null;
    this.selectedUnitTag = null;

    timer.add(this.tick, 300);
  }

  detach() {
    this.observation = null;
    this.displayedUnitTag = null;
    this.selectedUnitTag = null;

    timer.remove(this.tick);
  }

  onSelect(tag) {
    this.selectedUnitTag = tag;
  }
  
  refresh() {
    const observation = game.get("observation");

    if (observation && ((observation !== this.observation) || (this.displayedUnitTag !== this.selectedUnitTag))) {
      const unit = units.get(this.selectedUnitTag);

      clearScreen(this.emitter);

      if (unit) {
        displayUnit(this.emitter, unit);
      }

      this.observation = observation;
      this.displayedUnitTag = this.selectedUnitTag;

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

function displayUnit(emitter, unit) {
  const lines = [];

  lines.push([Types.unit(unit.unitType).name, unit.tag]);
  lines.push([]);

  if (unit.buildProgress < 1) bar(lines, "Build: ", unit.buildProgress, 1.0, "0;0;0");
  bar(lines, "Health:", unit.health, unit.healthMax, "50;205;50");
  bar(lines, "Shield:", unit.shield, unit.shieldMax, "135;206;235");
  bar(lines, "Energy:", unit.energy, unit.energyMax, "102;51;153");

  lines.push([]);
  object(lines, TAB, ["Unit:"], unit);

  lines.push([]);
  object(lines, TAB, ["Type:"], Types.info(unit.unitType));

  emitter.fire(lines.map(line => line.join(" ")).join("\r\n"));

  return lines.length;
}

function clearScreen(emitter) {
  emitter.fire("\x1b[3J\x1b[H\x1b[2J");
}

function bar(lines, key, value, max, color) {
  if (max) {
    const progress = Math.round(value * 10 / max);
    const progressbar = [];

    progressbar.push("\x1b[38;2;", color, "m");
    for (let i = 0; i < progress; i++) progressbar.push("\u2589");
    progressbar.push("\x1b[38;2;220;220;220m");
    for (let i = progress; i < 10; i++) progressbar.push("\u2589");
    progressbar.push("\x1b[0m");

    lines.push([key, TAB, progressbar.join(""), TAB, value.toFixed(2)]);
  }
}

function object(lines, tab, line, value) {
  switch (typeof(value)) {
    case "string": if (value === "0") break;
    case "boolean":
    case "number": {
      if (value) {
        line.push(value);
        lines.push(line);
      }
      break;
    }
    default: {
      if (!value) {
        line.push("-");
      } else if (Array.isArray(value)) {
        if (value.length) {
          lines.push(line);
  
          for (const one of value) {
            object(lines, tab + TAB, [tab, "-"], one);
          }
        }
      } else {
        const keys = Object.keys(value);

        if (keys.length) {
          let isArrayElement = (line[line.length - 1] === "-");

          if (!isArrayElement) lines.push(line);
          
          for (const key of keys) {
            const head = isArrayElement ? [...line, key + ":"] : [tab, key + ":"];
            object(lines, tab + TAB, head, value[key]);
            isArrayElement = false;
          }
        }
      }
    }
  }
}

module.exports = new Details();
