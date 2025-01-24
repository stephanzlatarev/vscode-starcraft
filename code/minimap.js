const files = require("./files.js");
const game = require("./game.js");

class MiniMap {

  async attach(container) {
    this.container = container;

    container.webview.options = { enableScripts: true };
    container.webview.html = await files.readHtmlFile("map.html");
    container.onDidChangeVisibility(this.renew.bind(this));
    container.onDidDispose(this.detach.bind(this));

    this.refresh();
  }

  detach() {
    this.container = null;
    this.gameInfo = null;
    this.observation = null;
  }

  onCameraMove(x, y, span) {
    if (this.container) {
      this.container.webview.postMessage({ type: "focus", x, y, span });
    }
  }

  renew() {
    if (this.container.visible) {
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
      const { p0, p1 } = gameInfo.startRaw.playableArea;
      const { placementGrid, pathingGrid } = gameInfo.startRaw;
      const box = { left: p0.x, top: p0.y, width: p1.x - p0.x, height: p1.y - p0.y };

      this.container.title = gameInfo.mapName;
      this.container.webview.postMessage({ type: "viewbox", viewbox: box });
      this.container.webview.postMessage({ type: "grid", size: placementGrid.size, placement: placementGrid.data, pathing: pathingGrid.data });

      this.gameInfo = gameInfo;
    }

    if (observation && (observation !== this.observation)) {
      this.container.webview.postMessage({ type: "units", units: game.units() });

      this.observation = observation;
    }

    this.timeout = setTimeout(this.refresh.bind(this), 1000);
  }

}

module.exports = new MiniMap();
