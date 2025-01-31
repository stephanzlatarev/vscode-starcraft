const files = require("./files.js");
const game = require("./game.js");
const timer = require("./timer.js");
const units = require("./units.js");

class MiniMap {

  tick = this.refresh.bind(this);

  async attach(container) {
    this.container = container;

    container.webview.options = { enableScripts: true };
    container.webview.html = await files.readHtmlFile("map.html");
    container.onDidChangeVisibility(this.renew.bind(this));
    container.onDidDispose(this.detach.bind(this));

    this.renew();
  }

  detach() {
    this.container = null;
    this.gameInfo = null;
    this.observation = null;
    this.debugSpheres = null;
    
    timer.remove(this.tick);
  }

  onCameraMove(x, y, span) {
    if (this.container) {
      this.container.webview.postMessage({ type: "focus", x, y, span });
    }
  }

  renew() {
    // Clear cached data so that it's posted again
    this.gameInfo = null;
    this.observation = null;
    this.debugSpheres = null;

    timer.add(this.tick, 1000);
  }

  refresh() {
    if (!this.container || !this.container.visible) return;
    
    const gameInfo = game.get("gameInfo");
    const observation = game.get("observation");
    const debugSpheres = game.get("debugspheres");

    // The minimap refreshes rarely. Telling the timer nothing changed allows it to attempt a refresh sooner
    let isChanged = false;

    if (gameInfo && (gameInfo !== this.gameInfo)) {
      const { p0, p1 } = gameInfo.startRaw.playableArea;
      const { placementGrid, pathingGrid } = gameInfo.startRaw;
      const box = { left: p0.x, top: p0.y, width: p1.x - p0.x, height: p1.y - p0.y };
      const mapbox = { minx: p0.x, maxx: p1.x, miny: p0.y, maxy: p1.y };

      this.container.title = gameInfo.mapName;
      this.container.webview.postMessage({ type: "mapbox", mapbox });
      this.container.webview.postMessage({ type: "viewbox", viewbox: box });
      this.container.webview.postMessage({ type: "grid", size: placementGrid.size, placement: placementGrid.data, pathing: pathingGrid.data });

      this.gameInfo = gameInfo;
      isChanged = true;
    }

    if (observation && (observation !== this.observation)) {
      this.container.webview.postMessage({ type: "units", units: units.list() });

      this.observation = observation;
      isChanged = true;
    }

    if (debugSpheres && (debugSpheres !== this.debugSpheres)) {
      this.container.webview.postMessage({ type: "debug", spheres: debugSpheres.map(one => ({ x: one.p.x, y: one.p.y, r: one.r, color: debugColor(one.color) })) });

      this.debugSpheres = debugSpheres;
      isChanged = true;
    }

    return isChanged;
  }

}

function debugColor(rgb) {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

module.exports = new MiniMap();
