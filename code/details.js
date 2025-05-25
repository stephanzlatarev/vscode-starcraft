const vscode = require("vscode");
const game = require("./game.js");
const timer = require("./timer.js");
const stats = require("./stats.js");
const Types = require("./types.js");
const units = require("./units.js");

const LOOPS_PER_SECOND = 22.4;
const LOOPS_PER_MINUTE = LOOPS_PER_SECOND * 60;
const TAB = "  ";

class Details {

  emitter = new vscode.EventEmitter();
  tick = this.refresh.bind(this);

  start() {
    if (this.terminal && !this.terminal.exitStatus) {
      this.terminal.show();
    } else {
      this.terminal = vscode.window.createTerminal({
        name: "Stats",
        pty: {
          onDidWrite: this.emitter.event,
          open: this.attach.bind(this),
          close: this.detach.bind(this),
          handleInput: () => {},
        }
      });
    }
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
      const loop = observation.observation.gameLoop;

      clearScreen(this.emitter);

      if (unit) {
        displayUnit(this.emitter, unit, loop);
      } else {
        displayStats(this.emitter, stats.get());
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

function displayUnit(emitter, unit, loop) {
  const lines = [];
  const unitTypeInfo = Types.info(unit.unitType);

  lines.push([Types.unit(unit.unitType).name, unit.tag]);
  lines.push([]);

  if (unit.buildProgress < 1) bar(lines, "Build: ", unit.buildProgress, 1.0, "0;0;0");
  bar(lines, "Health:", unit.health, unit.healthMax, "50;205;50");
  bar(lines, "Shield:", unit.shield, unit.shieldMax, "135;206;235");
  bar(lines, "Energy:", unit.energy, unit.energyMax, "102;51;153");

  if ((unitTypeInfo.movementSpeed > 0) && unit.oldpos) {
    const loops = loop - unit.oldpos.loop;
    const distance = Math.sqrt(Math.pow(unit.pos.x - unit.oldpos.x, 2) + Math.pow(unit.pos.y - unit.oldpos.y, 2)) * loops * 22.4;

    if ((loops > 0) && (distance >= 0)) {
      bar(lines, "Speed: ", distance, unitTypeInfo.movementSpeed * 22.4 / 16, "0;0;205");
    }
  }

  if (unit.buffDurationMax) {
    lines.push([]);
    bar(lines, "Buff:  ", unit.buffDurationRemain, unit.buffDurationMax, "154;205;50");

    for (const id of unit.buffIds) {
      lines.push(["       ", TAB, Types.buff(id)]);
    }
  }

  if (unit.orders.length) {
    const order = unit.orders[0];
  
    let target = "";
  
    if (order.targetWorldSpacePos) {
      target = Math.floor(order.targetWorldSpacePos.x) + ":" + Math.floor(order.targetWorldSpacePos.y);
    } else if (order.targetUnitTag) {
      const targetUnit = units.get(order.targetUnitTag);
  
      if (targetUnit) {
        target = Types.unit(targetUnit.unitType).name + " " + targetUnit.tag;
      } else {
        target = order.targetUnitTag;
      }
    }

    lines.push([]);
    lines.push(["Order:", Types.product(order.abilityId) || Types.ability(order.abilityId), target]);
    bar(lines, "       ", order.progress, 1.0, "255;215;0");
  }

  lines.push([]);
  object(lines, TAB, ["Unit:"], unit);

  lines.push([]);
  object(lines, TAB, ["Type:"], unitTypeInfo);

  emitter.fire(lines.map(line => line.join(" ")).join("\r\n"));
}

function displayStats(emitter, players) {
  const loop = players.loop;

  if (loop >= 0) {
    const player1 = players[1];
    const player2 = players[2];
    const lines = [];

    const minutes = Math.floor(loop / LOOPS_PER_MINUTE);
    const seconds = Math.floor(loop / LOOPS_PER_SECOND) % 60;
    const mm = (minutes >= 10) ? minutes : "0" + minutes;
    const ss = (seconds >= 10) ? seconds : "0" + seconds;

    lines.push(`${mm}:${ss} (${loop})`);
    lines.push("");
    lines.push(key("Statistics") + cell("Player 1", 1) + cell("Player 2", 2));
    lines.push("");

    for (const one of Object.keys(player1)) {
      lines.push(key(one) + cell(player1[one], 1) + cell(player2[one], 2));
    }

    emitter.fire(lines.join("\r\n"));
  }
}

function clearScreen(emitter) {
  emitter.fire("\x1b[3J\x1b[H\x1b[2J");
}

function key(value) {
  const text = "                                        " + value + ":";

  return text.substring(text.length - 40);
}

function cell(value, player) {
  const text = "          " + value;

  if (player === 1) {
    return "\x1b[38;2;0;0;160m" + text.substring(text.length - 10) + "\x1b[0m";
  } else if (player === 2) {
    return "\x1b[38;2;160;0;0m" + text.substring(text.length - 10) + "\x1b[0m";
  } else {
    return text.substring(text.length - 10);
  }
}

function bar(lines, key, value, max, color) {
  if (value && max) {
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
            if (key === "oldpos") continue;

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
