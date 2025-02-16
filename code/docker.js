const files = require("./files.js");
const { execFile, spawn } = require("node:child_process");

class Docker {

  complete = "Download StarCraft II";

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

  checkImage() {
    const progress = this;

    const layers = new Set();
    const downloaded = new Set();

    let isDownloaded = false;

    post(progress.webview, "Downloading StarCraft II");

    return new Promise(function(resolve, reject) {
      const pull = spawn("docker", ["pull", "stephanzlatarev/starcraft"]);

      pull.stdout.on("data", (data) => {
        const stdout = data.toString();

        if (stdout.indexOf("docker.io/stephanzlatarev/starcraft:latest") >= 0) {
          isDownloaded = true;
        } else {
          const lines = stdout.split("\n");

          for (const line of lines) {
            const parts = line.split(":");
            if (parts.length === 2) {
              const layer = parts[0].trim();
              const status = parts[1].trim();

              if (layer.length === 12) {
                layers.add(layer);

                if ((status === "Already exists") || (status === "Download complete")) {
                  downloaded.add(layer);
                }
              }
            }
          }
        }

        if (layers.size) {
          post(progress.webview, `Downloading StarCraft II (${downloaded.size}/${layers.size}) This may take a few minutes. Be patient...`);
        } else {
          post(progress.webview, "Downloading StarCraft II");
        }
      });

      pull.on("close", () => {
        if (isDownloaded) {
          resolve();
        } else {
          execFile("docker", ["image", "inspect", "stephanzlatarev/starcraft:latest"], (error, stdout, stderr) => {
            if (stdout.indexOf("stephanzlatarev/starcraft:latest") >= 0) {
              resolve();
            } else {
              reject(error || stderr);
            }
          });
        }
      });
    });
  }
  
  async checking(container) {
    this.webview = container.webview;
    this.webview.options = { enableScripts: true };

    return await files.readHtmlFile("progress.html");
  }

}

function post(webview, status) {
  if (webview) {
    webview.postMessage({ type: "status", text: status });
  }
}

module.exports = new Docker();
