const vscode = require("vscode");
const camera = require("./camera.js");
const controls = require("./controls.js");
const docker = require("./docker.js");
const files = require("./files.js");
const game = require("./game.js");
const minimap = require("./minimap.js");
const timer = require("./timer.js");
const Checklist = require("./checklist.js");
const Host = require("./host.js");

let activeContainer;
let isGamePaused = false;

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

  timer.start();
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
  controls.showControls(!!document);
  
  container.webview.onDidReceiveMessage(function(message) {
    if (message.type === "move") {
      const x = Math.floor(message.left + message.width / 2);
      const y = Math.floor(message.top + message.height / 2);

      minimap.onCameraMove(x, y, camera.span);
    } else if (message.event === "pause") {
      if (isGamePaused) {
        isGamePaused = false;
        game.resume();
        controls.resume();
      } else {
        isGamePaused = true;
        game.pause();
        controls.pause();
      }
    }
  });
}

function deactivate() {
  activeContainer = false;
  timer.stop();
  game.stop();

  vscode.commands.executeCommand("setContext", "starcraft.isInGame", false);
}

module.exports = { activate, deactivate };
