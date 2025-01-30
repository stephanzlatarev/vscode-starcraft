
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

  get(loop) {
    return history[loop];
  }

  clear() {
    history.length = 0;
    start = 0;
  }

}

module.exports = new History();
