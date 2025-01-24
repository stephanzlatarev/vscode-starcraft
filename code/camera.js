const files = require("./files.js");
const game = require("./game.js");
const minimap = require("./minimap.js");

class Camera {

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
  }

  move(x, y) {
    if (this.container) {
      this.container.webview.postMessage({ type: "viewbox", viewbox: { x, y, span: 25 } });
      this.focus = { x, y};

      minimap.onCameraMove(x, y, 25);
    }
  }

  renew() {
    if (this.container.visible) {
      this.container.webview.postMessage({ type: "icons", path: files.getIconsPath(this.container.webview) });

      // Recover the focus
      if (this.focus) {
        this.move(this.focus.x, this.focus.y);
      }

      // Clear cached data so that it's posted again
      this.gameInfo = null;
      this.observation = null;

      this.refresh();
    } else if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

  refresh() {
    if (!this.container) return;

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

    this.timeout = setTimeout(this.refresh.bind(this), 80);
  }

}

module.exports = new Camera();
