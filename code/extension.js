const vscode = require("vscode");
const actions = require("./actions.js");
const camera = require("./camera.js");
const controls = require("./controls.js");
const debug = require("./debug.js");
const details = require("./details.js");
const docker = require("./docker.js");
const files = require("./files.js");
const game = require("./game.js");
const minimap = require("./minimap.js");
const timer = require("./timer.js");
const Checklist = require("./checklist.js");
const Host = require("./host.js");
const units = require("./units.js");

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

  context.subscriptions.push(vscode.window.registerWebviewViewProvider("starcraft.actions", {
    resolveWebviewView(view) {
      actions.attach(view);

      view.webview.onDidReceiveMessage(function(message) {
        if (message.event === "click") camera.select(units.get(message.unit));
      });
    }
  }));

  context.subscriptions.push(vscode.window.registerWebviewViewProvider("starcraft.controls", {
    resolveWebviewView(view) {
      controls.attach(view);
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

  timer.start();
}

async function start(container, document) {
  activeContainer = container;

  container.onDidDispose(function() {
    if (container === activeContainer) {
      vscode.commands.executeCommand("setContext", "starcraft.isInGame", false);

      activeContainer = null;
      game.reset();
      debug.stop();
      details.stop();
    }
  });

  const prerequisites = [
    [() => docker.checkClient(), "Check Docker Client"],
    [() => docker.checkServer(), "Check Docker Server"],
    [() => docker.checkImage(), "Download StarCraft II"],
    [() => game.init(), "Start StarCraft II"],
    [() => game.connect(), "Connect to StarCraft II"],
  ];

  const checks = document ?
  [
    ...prerequisites,
    [() => files.copyReplayFile(document.uri), "Get replay file"],
    [() => game.play(files.getFileName(document.uri)), "Start the replay"],
  ] : [
    ...prerequisites,
    [() => game.play(), "Open StarCraft II API endpoint at ws://127.0.0.1:5000/sc2api"],
    [() => game.host(), new Host(container)],
    [() => game.start(), "Wait for a bot to join the game"],
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

  vscode.commands.executeCommand("setContext", "starcraft.isInGame", true);

  camera.attach(container);
  controls.setConfig(document ? { mouse: false } : { skip: false });
  debug.start();
  details.start();
  
  container.webview.onDidReceiveMessage(function(message) {
    if (message.event === "click") {
      controls.click(message.x, message.y);
    } else if (message.event === "pause") {
      controls.pause(true);
    }
  });
}

function deactivate() {
  activeContainer = false;
  timer.stop();
  game.stop();
  debug.stop();
  details.stop();

  vscode.commands.executeCommand("setContext", "starcraft.isInGame", false);
}

module.exports = { activate, deactivate };
