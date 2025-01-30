const details = require("./details.js");
const files = require("./files.js");
const game = require("./game.js");
const minimap = require("./minimap.js");
const timer = require("./timer.js");
const units = require("./units.js");

class Camera {

  span = 25;
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
      if (message.event === "click") this.select(findUnit(this.viewbox, message.x, message.y));
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
    if (unit) {
      if (unit.pos) {
        this.move(unit.pos.x, unit.pos.y, unit.tag);
      } else {
        this.move(unit.x, unit.y, unit.tag);
      }
    } else {
      details.onSelect(null);
    }

    this.container.webview.postMessage({ type: "select", unit: (unit ? unit.tag : null) });
  }

  move(x, y, tag) {
    if (!x || !y) return;

    this.focus = { x, y, tag };

    if (this.container) {
      this.container.webview.postMessage({ type: "viewbox", viewbox: { x, y, span: this.span } });
    }

    details.onSelect(tag);
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
      } else if (this.focus.tag) {
        const unit = list.find(unit => (unit.tag === this.focus.tag));

        if (unit && ((unit.x !== this.focus.x) || (unit.y !== this.focus.y))) {
          this.move(unit.x, unit.y, unit.tag);
        }
      }

      this.container.webview.postMessage({ type: "units", units: list });

      this.observation = observation;
      this.renderedViewBox = this.viewbox;
    }
  }

}

function findUnit(viewbox, x, y) {
  const list = units.list(viewbox);

  let bestUnit;
  let bestSquareDistance;

  for (const unit of list) {
    if ((unit.owner !== 1) && bestUnit && (bestUnit.owner === 1)) continue;

    const squareDistance = (unit.x - x) * (unit.x - x) + (unit.y - y) * (unit.y - y);
    const squareRadius = (unit.r + 1) * (unit.r * 1);

    if (squareDistance > squareRadius) continue;

    if (!bestUnit || (squareDistance < bestSquareDistance)) {
      bestUnit = unit;
      bestSquareDistance = squareDistance;
    }
  }

  return bestUnit;
}

module.exports = new Camera();
