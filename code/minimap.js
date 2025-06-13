const files = require("./files.js");
const game = require("./game.js");
const timer = require("./timer.js");
const units = require("./units.js");

class MiniMap {

  containers = [];
  tick = this.render.bind(this);

  async attach(container) {
    this.containers.push(container);

    container.webview.options = { enableScripts: true };
    container.webview.html = await files.readHtmlFile("map.html");
    container.onDidChangeVisibility(this.renew.bind(this));
    container.onDidDispose(this.detach.bind(this));

    this.renew();
  }

  detach() {
    this.containers = [];
    this.container = null;
    this.gameInfo = null;
    this.observation = null;
    this.debugShapes = null;
    
    timer.remove(this.tick);
  }

  renew() {
    // Clear cached data so that it's posted again
    this.container = null;
    this.gameInfo = null;
    this.observation = null;
    this.debugShapes = null;

    timer.add(this.tick, 1000);
  }

  setFocus(focus) {
    this.focus = focus;

    for (const container of this.containers) {
      if (container.visible) {
        container.webview.postMessage({ type: "focus", focus });
      }
    }
  }

  render() {
    const container = this.containers.find(one => one.visible);

    if (!container || !container.visible) return;
    
    const gameInfo = game.get("gameInfo");
    const observation = game.get("observation");
    const debugShapes = game.get("debugshapes");

    const data = { showZones: true, focus: this.focus };

    if (gameInfo && ((gameInfo !== this.gameInfo) || (container !== this.container))) {
      const { p0, p1 } = gameInfo.startRaw.playableArea;
      const { placementGrid, pathingGrid } = gameInfo.startRaw;

      container.title = gameInfo.mapName;

      data.viewbox = { left: p0.x, top: p0.y, width: p1.x - p0.x, height: p1.y - p0.y };
      data.mapbox = { minx: p0.x, maxx: p1.x, miny: p0.y, maxy: p1.y };
      data.grid = { placement: placementGrid, pathing: pathingGrid };

      this.gameInfo = gameInfo;
    }

    if (observation && ((observation !== this.observation) || (container !== this.container))) {
      data.units = units.list();
      data.creep = observation.observation.rawData.mapState.creep;
      data.fog = observation.observation.rawData.mapState.visibility;

      this.observation = observation;
    }

    if (debugShapes && ((debugShapes !== this.debugShapes) || (container !== this.container))) {
      data.shapes = debugShapes;

      this.debugShapes = debugShapes;
    }

    if (data.viewbox || data.units || data.shapes) {
      container.webview.postMessage({ type: "render", data });

      this.container = container;

      return true;
    }
  }

}

module.exports = new MiniMap();
