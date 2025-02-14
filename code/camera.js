const details = require("./details.js");
const files = require("./files.js");
const game = require("./game.js");
const minimap = require("./minimap.js");
const timer = require("./timer.js");
const units = require("./units.js");

const SPAN_MIN = 12;
const SPAN_MID = 50;

class Camera {

  focus = null;
  mapbox = null;
  viewbox = null;

  shouldRender = true;
  shouldRerender = false;

  tick = this.render.bind(this);

  async attach(container) {
    this.focus = null;

    if (this.container !== container) {
      container.onDidChangeViewState(this.renew.bind(this));
      container.onDidDispose(this.detach.bind(this));

      container.webview.onDidReceiveMessage(function(message) {
        if (message.event === "ready") this.shouldRender = true;
        if (message.event === "resize") this.resize(message.width, message.height);
        if (message.event === "scroll") this.move(message.x, message.y);
        if (message.event === "wheel") this.zoom(message.x, message.y, message.delta);
      }.bind(this));
    }

    this.container = container;

    container.retainContextWhenHidden = true;
    container.webview.options = { enableScripts: true };
    container.webview.html = await files.readHtmlFile("map.html");

    this.renew();
  }

  detach() {
    this.container = null;
    this.gameInfo = null;
    this.observation = null;
    this.debugShapes = null;

    timer.remove(this.tick);
  }

  resize(width, height) {
    this.shouldRerender = true;
    this.width = width;
    this.height = height;

    if (this.focus && this.viewbox) {
      this.shouldRerender = true;

      this.focus.height = this.focus.width * height / width;

      this.viewbox.height = this.viewbox.width * height / width;
      this.viewbox.left = this.focus.x - this.viewbox.width / 2;
      this.viewbox.top = this.focus.y - this.viewbox.height / 2;

      minimap.setFocus(this.focus);
    }
  }

  move(x, y) {
    if (!x || !y) return;
    if (!this.mapbox || !this.focus || !this.viewbox) return;

    if (x < this.mapbox.minx) x = this.mapbox.minx;
    if (x > this.mapbox.maxx) x = this.mapbox.maxx;
    if (y < this.mapbox.miny) y = this.mapbox.miny;
    if (y > this.mapbox.maxy) y = this.mapbox.maxy;

    this.shouldRerender = true;

    this.focus.x = x;
    this.focus.y = y;

    this.viewbox.left = this.focus.x - this.viewbox.width / 2;
    this.viewbox.top = this.focus.y - this.viewbox.height / 2;

    minimap.setFocus(this.focus);

    if (this.focus.tag) {
      // If tagged unit is still on screen then continue following it
      const unit = units.get(this.focus.tag);

      if (!unit || !isOnCamera(unit, this.viewbox)) {
        this.focus.tag = null;
      }
    }
  }

  select(unit) {
    if (!this.focus) return;

    if (unit) {
      if (unit.pos) {
        this.move(unit.pos.x, unit.pos.y);
      } else {
        this.move(unit.x, unit.y);
      }

      this.focus.tag = unit.tag;
    } else {
      this.focus.tag = null;
    }

    this.shouldRerender = true;

    details.onSelect(this.focus.tag);
  }

  zoom(x, y, delta) {
    if (!this.mapbox || !this.focus || !this.viewbox) return;
    if (!this.width || !this.height) return;

    let span = this.focus.width;

    span += span * 0.1 * Math.sign(delta);

    if (span < SPAN_MIN) span = SPAN_MIN;
    if (span > this.mapbox.maxspan) span = this.mapbox.maxspan;

    const ratio = span / this.focus.width;
    const slide = 1 - ratio;
    const newx = this.focus.x + (x - this.focus.x) * slide;
    const newy = this.focus.y + (y - this.focus.y) * slide;

    this.shouldRerender = true;
    this.focus.width = span;
    this.focus.height = span * this.height / this.width;
    this.viewbox.width = this.focus.width;
    this.viewbox.height = this.focus.height;

    this.move(newx, newy);
  }

  renew() {
    this.shouldRender = true;

    // Clear cached data so that it's posted again
    this.gameInfo = null;
    this.observation = null;
    this.debugShapes = null;

    if (this.container.visible) {
      this.container.webview.postMessage({ type: "icons", path: files.getIconsPath(this.container.webview) });
    }

    timer.add(this.tick, 80);
  }

  render() {
    if (!this.container || !this.container.visible) return;
    if (!this.shouldRender) return;

    const gameInfo = game.get("gameInfo");
    const observation = game.get("observation");
    const debugShapes = game.get("debugshapes");

    let data;

    if (gameInfo && (gameInfo !== this.gameInfo)) {
      const { placementGrid, pathingGrid } = gameInfo.startRaw;
      const { p0, p1 } = gameInfo.startRaw.playableArea;

      this.gameInfo = gameInfo;
      this.mapbox = { minx: p0.x, maxx: p1.x, miny: p0.y, maxy: p1.y, maxspan: Math.max(p1.x - p0.x, p1.y - p0.y) * 2 };

      if (!data) data = {};
      data.mapbox = this.mapbox;
      data.grid = { placement: placementGrid, pathing: pathingGrid };
    }

    if (observation && ((observation !== this.observation) || this.shouldRerender)) {
      const list = units.list(this.viewbox);

      if (!data) data = {};
      data.creep = observation.observation.rawData.mapState.creep;
      data.fog = observation.observation.rawData.mapState.visibility;
      data.units = list;

      this.observation = observation;
      this.renderedViewBox = this.viewbox;

      // Follow selected unit
      if (this.viewbox && this.focus && this.focus.tag) {
        const unit = units.get(this.focus.tag);

        if (unit && !isOnCamera(unit, this.viewbox)) {
          this.move(unit.pos.x, unit.pos.y);
          this.focus.tag = unit.tag;
        }
      }
    }

    if (debugShapes && this.viewbox && ((debugShapes !== this.debugShapes) || this.shouldRerender)) {
      const shapes = debugShapes.filter(shape => isOnCamera(shape, this.viewbox));

      if (shapes.length) {
        if (!data) data = {};
        data.shapes = shapes;
      }

      this.debugShapes = debugShapes;
    }

    if (data) {
      if ((!this.viewbox || !this.focus) && this.height && this.width && this.mapbox) {
        const center = units.list().find(unit => ((unit.owner === 1) && (unit.r > 1)));

        if (center) {
          this.focus = { width: SPAN_MID, height: SPAN_MID * this.height / this.width };
          this.viewbox = { width: this.focus.width, height: this.focus.height };
          this.select(center);
        }
      }

      data.focus = this.focus;
      data.viewbox = this.viewbox;

      this.shouldRender = false;
      this.shouldRerender = false;

      this.container.webview.postMessage({ type: "render", data });


      return true;
    }
  }

}

function isOnCamera(object, viewbox) {
  if (object.pos) {
    return isLocationOnCamera(object.pos.x, object.pos.y, viewbox);
  } else if (object.x && object.y) {
    return isLocationOnCamera(object.x, object.y, viewbox);
  } else {
    if (object.x1 && object.y1 && isLocationOnCamera(object.x1, object.y1, viewbox)) return true;
    if (object.x2 && object.y2 && isLocationOnCamera(object.x2, object.y2, viewbox)) return true;
  }
}

function isLocationOnCamera(x, y, viewbox) {
  return (x > viewbox.left) && (y > viewbox.top) && (x < viewbox.left + viewbox.width) && (y < viewbox.top + viewbox.height);
}

module.exports = new Camera();
