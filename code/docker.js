const { execFile } = require("node:child_process");

class Docker {

  async checkClient() {
    return new Promise(function(resolve, reject) {
      execFile("docker", ["version"], (error, stdout, stderr) => {
        if (stdout.indexOf("Client:") >= 0) {
          resolve();
        } else {
          reject(error);
        }
      });
    });
  }

  async checkServer() {
    return new Promise(function(resolve, reject) {
      execFile("docker", ["version"], (error, stdout, stderr) => {
        if (stdout.indexOf("Server:") >= 0) {
          resolve();
        } else {
          reject(error);
        }
      });
    });
  }

  async checkImage() {
    return new Promise(function(resolve, reject) {
      execFile("docker", ["pull", "stephanzlatarev/starcraft"], (error, stdout, stderr) => {
        if (stdout.indexOf("docker.io/stephanzlatarev/starcraft:latest") >= 0) {
          resolve();
        } else {
          reject(error);
        }
      });
    });
  }

}

module.exports = new Docker();
