const details = require("./details.js");
const files = require("./files.js");
const game = require("./game.js");
const minimap = require("./minimap.js");
const timer = require("./timer.js");
const units = require("./units.js");

const SPAN_MIN = 9;
const SPAN_MID = 35;

class Camera {

  mapbox = { minx: 0, maxx: 0, miny: 300, maxy: 300, maxspan: 300 };
  renderedViewBox = null;

  tick = this.refresh.bind(this);

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
      if (message.event === "scroll") this.move(message.x, message.y);
      if (message.event === "wheel") this.zoom(message.x, message.y, message.delta);
    }.bind(this));

    this.renew();
  }

  detach() {
    this.container = null;
    this.gameInfo = null;
    this.observation = null;
    this.debugSpheres = null;

    timer.remove(this.tick);
  }

  move(x, y, span) {
    if (!x || !y) return;
    if (!this.mapbox) return;
    if (!this.focus) this.focus = { x, y, span: span || SPAN_MID };

    span = span || this.focus.span;

    if (x < this.mapbox.minx) x = this.mapbox.minx;
    if (x > this.mapbox.maxx) x = this.mapbox.maxx;
    if (y < this.mapbox.miny) y = this.mapbox.miny;
    if (y > this.mapbox.maxy) y = this.mapbox.maxy;

    this.focus.x = x;
    this.focus.y = y;
    this.focus.span = span;
    this.focus.tag = null;

    post(this, { type: "viewbox", viewbox: this.focus });

    minimap.onCameraMove(x, y, span);
  }

  select(unit) {
    let tag;

    if (unit) {
      tag = unit.tag;

      if (unit.pos) {
        this.move(unit.pos.x, unit.pos.y);
      } else {
        this.move(unit.x, unit.y);
      }
    } else if (!this.focus) {
      // Selection is possible only when camera is already set
      return;
    } else {
      tag = null;
    }

    this.focus.tag = tag;

    post(this, { type: "select", unit: tag });

    details.onSelect(tag);
  }

  zoom(x, y, delta) {
    if (!this.mapbox || !this.focus) return;

    let tag = this.focus.tag;
    let newspan = this.focus.span;

    newspan += newspan * 0.1 * Math.sign(delta);

    if (newspan < SPAN_MIN) newspan = SPAN_MIN;
    if (newspan > this.mapbox.maxspan) newspan = this.mapbox.maxspan;

    const ratio = newspan / this.focus.span;
    const slide = 1 - ratio;
    const newx = this.focus.x + (x - this.focus.x) * slide;
    const newy = this.focus.y + (y - this.focus.y) * slide;

    this.move(newx, newy, newspan);

    if (tag && this.viewbox) {
      // If tagged unit is still on screen then continue following it
      const unit = units.list().find(unit => (unit.tag === tag));

      if (unit) {
        const width = this.viewbox.width * ratio;
        const height = this.viewbox.height * ratio;

        if (isOnCamera(unit, { left: newx - width / 2, top: newy - height / 2, width, height })) {
          this.focus.tag = tag;
        }
      }
    }
  }

  renew() {
    // Clear cached data so that it's posted again
    this.gameInfo = null;
    this.observation = null;
    this.debugSpheres = null;

    if (this.container.visible) {
      post(this, { type: "icons", path: files.getIconsPath(this.container.webview) });

      // Recover the focus
      if (this.focus) {
        this.move(this.focus.x, this.focus.y, this.focus.span);
      }
    }

    timer.add(this.tick, 80);
  }

  refresh() {
    if (!this.container || !this.container.visible) return;

    const gameInfo = game.get("gameInfo");
    const observation = game.get("observation");
    const debugSpheres = game.get("debugspheres");

    if (gameInfo && (gameInfo !== this.gameInfo)) {
      const { placementGrid, pathingGrid } = gameInfo.startRaw;
      const { p0, p1 } = gameInfo.startRaw.playableArea;

      this.gameInfo = gameInfo;
      this.mapbox = { minx: p0.x, maxx: p1.x, miny: p0.y, maxy: p1.y, maxspan: Math.max(p1.x - p0.x, p1.y - p0.y) * 2 };

      post(this, { type: "mapbox", mapbox: this.mapbox });
      post(this, { type: "grid", size: placementGrid.size, placement: placementGrid.data, pathing: pathingGrid.data });
    }

    if (observation && ((observation !== this.observation) || (this.renderedViewBox !== this.viewbox))) {
      const list = units.list(this.viewbox);

      if (!this.focus) {
        this.select(list.find(unit => ((unit.owner === 1) && (unit.r > 1))) || units.list().find(unit => ((unit.owner === 1) && (unit.r > 1))));
      } else if (this.viewbox && this.focus.tag) {
        const unit = list.find(unit => (unit.tag === this.focus.tag));

        if (unit && !isOnCamera(unit, this.viewbox)) {
          this.move(unit.x, unit.y);
          this.focus.tag = unit.tag;
        }
      }

      this.observation = observation;
      this.renderedViewBox = this.viewbox;

      post(this, { type: "units", units: list });
    }

    if (debugSpheres && (debugSpheres !== this.debugSpheres)) {
      const spheres = [];

      for (const sphere of debugSpheres) {
        if ((sphere.r < 3) && isOnCamera(sphere.p, this.viewbox)) {
          spheres.push({ x: sphere.p.x, y: sphere.p.y, r: sphere.r, color: debugColor(sphere.color) });
        }
      }

      this.container.webview.postMessage({ type: "debug", spheres });

      this.debugSpheres = debugSpheres;
    }
  }

}

function isOnCamera(unit, viewbox) {
  return (unit.x > viewbox.left) && (unit.y > viewbox.top) && (unit.x < viewbox.left + viewbox.width) && (unit.y < viewbox.top + viewbox.height);
}

function debugColor(rgb) {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

function post(controls, message) {
  if (controls.container) {
    controls.container.webview.postMessage(message);
  }
}

module.exports = new Camera();
