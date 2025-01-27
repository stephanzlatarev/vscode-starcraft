const files = require("./files.js");
const game = require("./game.js");
const minimap = require("./minimap.js");
const timer = require("./timer.js");

class Camera {

  span = 25;
  tick = this.refresh.bind(this);

  async attach(container) {
    this.container = container;
    this.focus = null;

    container.webview.options = { enableScripts: true };
    container.webview.html = await files.readHtmlFile("map.html");
    container.retainContextWhenHidden = true;
    container.onDidChangeViewState(this.renew.bind(this));
    container.onDidDispose(this.detach.bind(this));

    this.renew();
  }

  detach() {
    this.container = null;
    this.gameInfo = null;
    this.observation = null;

    timer.remove(this.tick);
  }

  move(x, y) {
    if (this.container) {
      this.container.webview.postMessage({ type: "viewbox", viewbox: { x, y, span: this.span } });
      this.focus = { x, y};

      minimap.onCameraMove(x, y, this.span);
    }
  }

  renew() {
    // Clear cached data so that it's posted again
    this.gameInfo = null;
    this.observation = null;

    if (this.container.visible) {
      this.container.webview.postMessage({ type: "icons", path: files.getIconsPath(this.container.webview) });

      // Recover the focus
      if (this.focus) {
        this.move(this.focus.x, this.focus.y);
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

    if (observation && (observation !== this.observation)) {
      const units = game.units();

      if (!this.focus) {
        const playerId = observation.observation.playerCommon.playerId;
        const homebase = units.find(unit => ((unit.owner === playerId) && (unit.r > 1)));

        if (homebase) {
          this.move(homebase.x, homebase.y);
        }
      }

      this.container.webview.postMessage({ type: "units", units: units });

      this.observation = observation;
    }
  }

}

module.exports = new Camera();
