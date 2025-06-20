const WebSocket = require("ws");
const protocol = require("./protocol.js");

const Request = protocol.lookupType("Request");
const Response = protocol.lookupType("Response");

class Connection {

  static CODE_PAUSE = 1;
  static CODE_RESUME = 2;
  static CODE_START_SYNC = 3;
  static CODE_STOP_SYNC = 4;

  constructor(uri, callback) {
    this.uri = uri;
    this.callback = callback;
  }

  async connect() {
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        const socket = new WebSocket(this.uri);

        await new Promise(function(resolve, reject) {
          socket.on("open", () => resolve(socket));
          socket.on("error", reject);
        });

        socket.on("message", this.receive.bind(this));

        return this.socket = socket;
      } catch (_) {
        await sleep(100);
      }
    }

    throw new Error("Unable to connect");
  }

  send(code) {
    this.socket.send(new Uint8Array([code]));
  }

  async request(message) {
    if (this.socket) {
      const connection = this;

      this.socket.send(Request.encode(Request.create(message)).finish());

      return new Promise(function(resolve, reject) {
        connection.resolve = resolve;
        connection.reject = reject;
      });
    }
  }

  receive(data) {
    try {
      const decoded = Response.decode(data);

      if (decoded.debug) {
        const request = Request.toObject(Request.decode(data), { bytes: Array, longs: String, defaults: true });

        if (this.callback) {
          this.callback("debug", request.debug, decoded.status);
        }

        return this.resolve(request.debug);
      }

      if (decoded.error && decoded.error.length) {
        return this.reject("Error: " + decoded.error.join(" "));
      }

      const response = Response.toObject(decoded, { bytes: Array, longs: String, defaults: true });

      for (const key in response) {
        const field = Response.fields[key];

        if (field && (field.typeDefault === null)) {
          if (this.callback) {
            this.callback(key, response[key], decoded.status);
          }

          return this.resolve(response[key]);
        }
      }

      this.reject("Unable to parse response: " + Object.keys(response));
    } catch (error) {
      this.reject(error);
    }
  }

  close() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

function sleep(millis) {
  return new Promise(resolve => setTimeout(resolve, millis));
}

module.exports = Connection;
