const files = require("./files.js");
const game = require("./game.js");
const timer = require("./timer.js");
const Types = require("./types.js");
const units = require("./units.js");

class Actions {

  tick = this.refresh.bind(this);

  async attach(container) {
    this.container = container;

    container.webview.options = { enableScripts: true };
    container.webview.html = await files.readHtmlFile("actions.html");
    container.onDidChangeVisibility(this.renew.bind(this));
    container.onDidDispose(this.detach.bind(this));

    this.renew();
  }

  detach() {
    this.container = null;
    this.observation = null;

    timer.remove(this.tick);
  }

  renew() {
    // Clear cached data so that it's posted again
    this.observation = null;

    timer.add(this.tick, 300);
  }
  
  refresh() {
    if (!this.container || !this.container.visible) return;

    const observation = game.get("observation");

    if (observation && (observation !== this.observation)) {
      const actions = observation.actions.filter(action => !!(action.actionRaw && action.actionRaw.unitCommand))
        .map(action => ({
          loop: action.gameLoop,
          unit: action.actionRaw.unitCommand.unitTags[0],
          text: text(action.actionRaw.unitCommand),
        }));

      this.container.webview.postMessage({ type: "actions", actions });

      this.observation = observation;

      // Inform the timer to use a complete tick
      return true;
    }
  }

}

function text(command) {
  const unitTag = command.unitTags[0];
  const unit = units.get(unitTag);
  const unitName = unit ? Types.unit(unit.unitType).name + " " + unitTag : unitTag;

  let target = "";

  if (command.targetWorldSpacePos) {
    target = Math.floor(command.targetWorldSpacePos.x) + ":" + Math.floor(command.targetWorldSpacePos.y);
  } else if (command.targetUnitTag) {
    const targetUnit = units.get(command.targetUnitTag);

    if (targetUnit) {
      target = Types.unit(targetUnit.unitType).name + " " + targetUnit.tag;
    } else {
      target = command.targetUnitTag;
    }
  }

  return [
    unitName,
    Types.ability(command.abilityId),
    "(" + command.abilityId + ")",
    target,
  ].join(" ");
}

module.exports = new Actions();
