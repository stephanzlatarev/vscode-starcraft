const game = require("./game.js");
const Types = require("./types.js");

class Units {

  get(tag) {
    const observation = game.get("observation");

    if (observation) {
      return observation.observation.rawData.units.find(unit => (unit.tag === tag));
    }
  }

  list(viewbox) {
    const observation = game.get("observation");

    if (!observation) {
      return [];
    } else if (viewbox) {
      const units = [];
      const index = new Map();
      const orders = new Map();

      const raws = observation.observation.rawData.units;
      const minx = viewbox.left;
      const miny = viewbox.top;
      const maxx = viewbox.left + viewbox.width;
      const maxy = viewbox.top + viewbox.height;

      for (const one of raws) {
        if ((one.pos.x >= minx - one.radius) && (one.pos.x <= maxx + one.radius) && (one.pos.y >= miny - one.radius) && (one.pos.y <= maxy + one.radius)) {
          const unit = getUnitDetailedInfo(one);

          units.push(unit);
          index.set(one.tag, unit);

          if (one.orders && one.orders.length) {
            const order = one.orders[0];

            if (order.targetUnitTag || order.targetWorldSpacePos) {
              orders.set(unit, order);
            }
          }
        }
      }

      for (const [unit, order] of orders) {
        if (order.targetWorldSpacePos) {
          unit.order = { x: order.targetWorldSpacePos.x, y: order.targetWorldSpacePos.y };
        } else if (order.targetUnitTag) {
          const target = index.get(order.targetUnitTag);

          if (target) {
            unit.order = { x: target.x, y: target.y };
          }
        }
      }

      units.sort((a, b) => ((a.z - b.z) || (b.owner - a.owner) || (b.r - a.r)));

      return units;
    } else {
      return observation.observation.rawData.units.map(getUnitBasicInfo);
    }
  }

}

function getUnitBasicInfo(unit) {
  return { type: Types.unit(unit.unitType), tag: unit.tag, owner: unit.owner, x: unit.pos.x, y: unit.pos.y, r: unit.radius };
}

function getUnitDetailedInfo(unit) {
  return {
    type: Types.unit(unit.unitType),
    tag: unit.tag,
    owner: unit.owner,
    x: unit.pos.x,
    y: unit.pos.y,
    z: unit.pos.z,
    r: unit.radius,
    wip: (unit.displayType === 4) || (unit.buildProgress < 1),
    cloak: (unit.cloak !== 3),
  };
}

module.exports = new Units();
