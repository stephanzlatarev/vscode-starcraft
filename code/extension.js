const vscode = require("vscode");
const camera = require("./camera.js");
const controls = require("./controls.js");
const docker = require("./docker.js");
const files = require("./files.js");
const game = require("./game.js");
const minimap = require("./minimap.js");
const Checklist = require("./checklist.js");

let activeContainer;

function activate(context) {
  vscode.commands.executeCommand("setContext", "starcraft.isInGame", false);

  files.setExtensionUri(context.extensionUri);

  context.subscriptions.push(vscode.commands.registerCommand("starcraft.start", () => {
    if (activeContainer) activeContainer.dispose();

    start(vscode.window.createWebviewPanel("starcraft.camera", "StarCraft II", vscode.ViewColumn.One, { enableScripts: true }));
  }));

  context.subscriptions.push(vscode.window.registerCustomEditorProvider("starcraft.replay", {
    openCustomDocument(uri) {
      return { uri, dispose: function() {} };
    },

    resolveCustomEditor(document, container) {
      if (activeContainer) activeContainer.dispose();

      start(container, document);
    },
  }));

  context.subscriptions.push(vscode.window.registerWebviewViewProvider("starcraft.controls", {
    resolveWebviewView(view) {
      controls.attach(view);

      view.webview.onDidReceiveMessage(function(message) {
        if (message.event === "pause") game.pause();
        if (message.event === "resume") game.resume();
        if (message.event === "skip") game.skip();
      });
    }
  }));

  context.subscriptions.push(vscode.window.registerWebviewViewProvider("starcraft.minimap", {
    resolveWebviewView(view) {
      minimap.attach(view);

      view.webview.onDidReceiveMessage(function(message) {
        if (message.event === "click") camera.move(message.x, message.y);
      });
    }
  }));
}

async function start(container, document) {
  activeContainer = container;

  container.onDidDispose(function() {
    if (container === activeContainer) {
      vscode.commands.executeCommand("setContext", "starcraft.isInGame", false);

      activeContainer = null;
      game.reset();
    }
  });

  const checks = [
    [() => docker.checkClient(), "Check Docker Client"],
    [() => docker.checkServer(), "Check Docker Server"],
    [() => docker.checkImage(), "Download StarCraft II"],
    [() => game.init(), "Start StarCraft II"],
    document ? [() => files.copyReplayFile(document.uri), "Get replay file"] : null,
    [() => (document ? game.replay(files.getFileName(document.uri)) : game.play()), "Connect to StarCraft II"],
    [() => game.start(), document ? "Start the replay" : "Wait for the bot to create and join the game"],
  ];

  const checklist = new Checklist(container);

  for (const check of checks) {
    if (check) {
      await checklist.track(...check);
    }

    if (activeContainer !== container) {
      // Meanwhile the container has been disposed or a different game has been started
      return;
    }
  }

  camera.attach(container);

  vscode.commands.executeCommand("setContext", "starcraft.isInGame", true);
}

function deactivate() {
  game.stop();

  vscode.commands.executeCommand("setContext", "starcraft.isInGame", false);
}

module.exports = { activate, deactivate };
