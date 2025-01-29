const details = require("./details.js");
const files = require("./files.js");
const game = require("./game.js");
const minimap = require("./minimap.js");
const timer = require("./timer.js");
const units = require("./units.js");

class Camera {

  span = 25;
  tick = this.refresh.bind(this);
  renderedViewBox = null;

  async attach(container) {
    this.container = container;
    this.focus = null;

    container.webview.options = { enableScripts: true };
    container.webview.html = await files.readHtmlFile("map.html");
    container.retainContextWhenHidden = true;
    container.onDidChangeViewState(this.renew.bind(this));
    container.onDidDispose(this.detach.bind(this));

    container.webview.onDidReceiveMessage(function(message) {
      if (message.type === "viewbox") this.viewbox = message.viewbox;
    }.bind(this));

    this.renew();
  }

  detach() {
    this.container = null;
    this.gameInfo = null;
    this.observation = null;

    timer.remove(this.tick);
  }

  select(unit) {
    this.move(unit.x, unit.y, unit.tag);
  }

  move(x, y, tag) {
    this.focus = { x, y, tag };

    if (this.container) {
      this.container.webview.postMessage({ type: "viewbox", viewbox: { x, y, span: this.span } });
    }

    if (tag) details.onSelect(tag);

    minimap.onCameraMove(x, y, this.span);
  }

  renew() {
    // Clear cached data so that it's posted again
    this.gameInfo = null;
    this.observation = null;

    if (this.container.visible) {
      this.container.webview.postMessage({ type: "icons", path: files.getIconsPath(this.container.webview) });

      // Recover the focus
      if (this.focus) {
        this.move(this.focus.x, this.focus.y, this.focus.tag);
      }
    }

    timer.add(this.tick, 80);
  }

  refresh() {
    if (!this.container || !this.container.visible) return;

    const gameInfo = game.get("gameInfo");
    const observation = game.get("observation");

    if (gameInfo && (gameInfo !== this.gameInfo)) {
      const { placementGrid, pathingGrid } = gameInfo.startRaw;

      this.container.webview.postMessage({ type: "grid", size: placementGrid.size, placement: placementGrid.data, pathing: pathingGrid.data });

      this.gameInfo = gameInfo;
    }

    if (observation && ((observation !== this.observation) || (this.renderedViewBox !== this.viewbox))) {
      const list = units.list(this.viewbox);

      if (!this.focus) {
        this.select(list.find(unit => ((unit.owner === 1) && (unit.r > 1))) || units.list().find(unit => ((unit.owner === 1) && (unit.r > 1))));
      }

      this.container.webview.postMessage({ type: "units", units: list });

      this.observation = observation;
      this.renderedViewBox = this.viewbox;
    }
  }

}

module.exports = new Camera();
