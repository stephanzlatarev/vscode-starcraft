const files = require("./files.js");
const game = require("./game.js");
const timer = require("./timer.js");
const Types = require("./types.js");

class Details {

  tick = this.refresh.bind(this);

  async attach(container) {
    this.container = container;

    container.webview.options = { enableScripts: true };
    container.webview.html = await files.readHtmlFile("details.html");
    container.onDidChangeVisibility(this.renew.bind(this));
    container.onDidDispose(this.detach.bind(this));

    this.renew();
  }

  detach() {
    this.container = null;
    this.observation = null;

    timer.remove(this.tick);
  }

  onSelect(tag) {
    this.selectedUnitTag = tag;
  }

  renew() {
    // Clear cached data so that it's posted again
    this.observation = null;
    this.selectedUnitTag = null;

    timer.add(this.tick, 300);
  }
  
  refresh() {
    if (!this.container || !this.container.visible) return;
    if (!this.selectedUnitTag) return;

    const observation = game.get("observation");

    if (observation && (observation !== this.observation)) {
      const unit = observation.observation.rawData.units.find(unit => (unit.tag === this.selectedUnitTag));
      const type = unit ? Types.get(unit.unitType).name : "";

      this.container.title = unit ? type + " " + unit.tag : "Unit details";
      this.container.webview.postMessage({ type: "unit", unit });

      this.observation = observation;

      // Inform the timer to use a complete tick
      return true;
    }
  }

}

module.exports = new Details();
