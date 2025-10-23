
const LIMIT = 224; // 224 game loops equal 10 seconds

const history = [];
let start = 0;

class History {

  add(loop, state) {
    if (loop >= history.length) {
      while (loop > history.length) history.push(null);
      while (history.length - start >= LIMIT) history[start++] = null;

      history.push(state);
    }
  }

  get(loop, direction) {
    if (direction > 0) {
      // We're looking for a state after the given loop
      for (let i = loop + 1; i < history.length; i++) {
        if (history[i]) return history[i];
      }
    } else if (direction < 0) {
      // We're looking for a state before the given loop
      for (let i = loop - 1; i >= start; i--) {
        if (history[i]) return history[i];
      }
    } else {
      return history[loop];
    }
  }

  clear() {
    history.length = 0;
    start = 0;
  }

}

module.exports = new History();
