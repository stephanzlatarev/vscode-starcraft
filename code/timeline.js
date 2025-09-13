const ReplayTimeline = require("@robobays/replay-timeline").default;
const files = require("./files.js");

class Timeline {

  async attach(container, document) {
    const file = document.uri.fsPath;

    container.retainContextWhenHidden = true;
    container.webview.options = { enableScripts: true };
    container.webview.onDidReceiveMessage(async function(message) {
      if ((message.event === "resize") && message.width) {
        const timeline = await ReplayTimeline.from(file).format("svg", { width: message.width }).to("string");

        container.webview.postMessage({ type: "timeline", timeline });
      }
    });
    container.webview.html = await files.readHtmlFile("timeline.html");
  }

}

module.exports = Timeline;
