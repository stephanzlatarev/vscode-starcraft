const game = require("./game.js");

const RADIUS = {
  0: 0,    // Unused
  1: 2,    // Psi storm
  2: 4.5,  // Guardian shield
  3: 3.75, // Temporal field growing bubble
  4: 3.75, // Temporal field after bubble
  5: 9,    // Thermal lances
  6: 13,   // Scanner sweep
  7: 12,   // Nuke
  8: 5,    // Liberator morph delay
  9: 5,    // Liberator morph
  10: 2,   // Blinding cloud
  11: 0.5, // Ravager corrosive bile
  12: 8,   // Lurker 
};

class Effects {

  list(viewbox) {
    const observation = game.get("observation");
    const effects = [];

    if (!observation) {
      // No effects
    } else if (viewbox) {
      const raws = observation.observation.rawData.effects;
      const minx = viewbox.left;
      const miny = viewbox.top;
      const maxx = viewbox.left + viewbox.width;
      const maxy = viewbox.top + viewbox.height;

      for (const one of raws) {
        const r = RADIUS[one.effectId] || 0;

        for (const pos of one.pos) {
          if ((pos.x >= minx - r) && (pos.x <= maxx + r) && (pos.y >= miny - r) && (pos.y <= maxy + r)) {
            effects.push({ owner: one.owner, x: pos.x, y: pos.y, r });
          }
        }
      }
    } else {
      for (const one of observation.observation.rawData.effects) {
        const r = RADIUS[one.effectId] || 0;

        for (const pos of one.pos) {
          effects.push({ owner: one.owner, x: pos.x, y: pos.y, r });
        }
      }
    }

    return effects;
  }

}

module.exports = new Effects();
