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
    this.observation = null;    // Clear cached data so that view gets refreshed
  }

  renew() {
    // Clear cached data so that it's posted again
    this.observation = null;
    this.selectedUnitTag = null;

    timer.add(this.tick, 300);
  }
  
  refresh() {
    if (!this.container || !this.container.visible) return;

    const observation = game.get("observation");

    if (observation && (observation !== this.observation)) {
      const unit = this.selectedUnitTag ? observation.observation.rawData.units.find(unit => (unit.tag === this.selectedUnitTag)) : null;

      if (unit) {
        const type = Types.unit(unit.unitType).name;

        this.container.title = type + " " + unit.tag;
        this.container.webview.postMessage({ type: "unit", unit });
      } else {
        this.container.title = "Unit details";
        this.container.webview.postMessage({ type: "unit", unit: null });
      }

      this.observation = observation;

      // Inform the timer to use a complete tick
      return true;
    }
  }

}

module.exports = new Details();
