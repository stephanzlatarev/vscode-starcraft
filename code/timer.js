const runners = new Map();

let isRunning = false;

class Timer {

  start() {
    if (!isRunning) {
      tick(this);
    }
  }

  add(runner, millis) {
    runners.set(runner, { runner, millis, time: 0 });
  }

  remove(runner) {
    runners.delete(runner);
  }

  stop() {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }

    this.isRunning = false;
  }
}

async function tick() {
  isRunning = true;

  while (isRunning) {
    const time = Date.now();

    for (const one of runners.values()) {
      if ((time - one.time) >= one.millis) {
        try {
          const ok = one.runner();

          // If the runner didn't do anything then schedule it for the next loop
          one.time = ok ? time : 0;
        } catch (error) {
          console.error(error);

          // Skip some time to allow for recovery
          one.time = time + 10000;
        }
      }
    }

    await sleep(10);
  }
}

function sleep(millis) {
  return new Promise(resolve => setTimeout(resolve, millis));
}

module.exports = new Timer();
