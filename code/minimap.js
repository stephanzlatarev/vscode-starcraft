const files = require("./files.js");
const game = require("./game.js");
const timer = require("./timer.js");
const units = require("./units.js");

class MiniMap {

  tick = this.render.bind(this);

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

  renew() {
    // Clear cached data so that it's posted again
    this.gameInfo = null;
    this.observation = null;
    this.debugSpheres = null;

    timer.add(this.tick, 1000);
  }

  setFocus(focus) {
    this.focus = focus;

    if (this.container && this.container.visible) {
      this.container.webview.postMessage({ type: "focus", focus });
    }
  }

  render() {
    if (!this.container || !this.container.visible) return;
    
    const gameInfo = game.get("gameInfo");
    const observation = game.get("observation");
    const debugSpheres = game.get("debugspheres");

    const data = { showZones: true, focus: this.focus };

    if (gameInfo && (gameInfo !== this.gameInfo)) {
      const { p0, p1 } = gameInfo.startRaw.playableArea;
      const { placementGrid, pathingGrid } = gameInfo.startRaw;

      this.container.title = gameInfo.mapName;

      data.viewbox = { left: p0.x, top: p0.y, width: p1.x - p0.x, height: p1.y - p0.y };
      data.mapbox = { minx: p0.x, maxx: p1.x, miny: p0.y, maxy: p1.y };
      data.grid = { placement: placementGrid, pathing: pathingGrid };

      this.gameInfo = gameInfo;
    }

    if (observation && (observation !== this.observation)) {
      data.units = units.list();
      data.creep = observation.observation.rawData.mapState.creep;
      data.fog = observation.observation.rawData.mapState.visibility;

      this.observation = observation;
    }

    if (debugSpheres && (debugSpheres !== this.debugSpheres)) {
      data.spheres = debugSpheres.map(one => ({ x: one.p.x, y: one.p.y, r: one.r, color: debugColor(one.color) }));

      this.debugSpheres = debugSpheres;
    }

    if (data.viewbox || data.units || data.spheres) {
      this.container.webview.postMessage({ type: "render", data });

      return true;
    }
  }

}

function debugColor(rgb) {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

module.exports = new MiniMap();
