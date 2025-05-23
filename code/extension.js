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
const BotPlay = require("./botplay.js");
const BotSync = require("./botsync.js");
const Checklist = require("./checklist.js");
const Host = require("./host.js");
const units = require("./units.js");

let activeContainer;

function activate(context) {
  vscode.commands.executeCommand("setContext", "starcraft.isInGame", false);

  BotPlay.setStarter(start);
  BotSync.setStarter(start);
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

async function start(container, document, includeKey, includeChecks, removeRemaining) {
  if (includeKey !== "start-game") {
    exitGame();
  }

  if (container && (container !== activeContainer)) {
    activeContainer = container;
  
    container.webview.onDidReceiveMessage(function(message) {
      if (message.event === "click") {
        controls.click(message.x, message.y);
      } else if (message.event === "pause") {
        controls.pause(true);
      }
    });

    container.onDidDispose(function() {
      if (container === activeContainer) {
        activeContainer = null;

        exitGame();
      }
    });
  } else {
    container = activeContainer;
  }

  const prerequisites = [
    ["docker-client", () => docker.checkClient(), "Check Docker Client"],
    ["docker-server", () => docker.checkServer(), "Check Docker Server"],
    ["download-game", () => docker.checkImage(), docker],
    ["start-game",    () => game.init(), "Start StarCraft II"],
    ["connect-game",  () => game.connect(), "Connect to StarCraft II"],
  ];

  const checks = document ?
  [
    ...prerequisites,
    ["copy-replay",  () => files.copyReplayFile(document.uri), "Get replay file"],
    ["start-replay", () => game.play(files.getFileName(document.uri)), "Start the replay"],
  ] : [
    ...prerequisites,
    ["start-api", () => game.play(), "Open StarCraft II API endpoint at ws://127.0.0.1:5000/sc2api"],
    ["host-game", () => game.host(), new Host()],
    ["wait-bot",  () => game.start(), "Wait for a bot to join the game"],
  ];

  if (includeKey && includeChecks) {
    for (let index = 0; index < checks.length; index++) {
      if (checks[index][0] === includeKey) {
        checks.splice(index, 0, ...includeChecks);

        if (removeRemaining) {
          checks.length = index + includeChecks.length;
        }

        break;
      }
    }
  }

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
  controls.reset(document ? { mouse: false } : { botplay: false, botsync: false, skip: false }, { mode: "select" });
  debug.start();
  details.start();
}

function exitGame() {
  vscode.commands.executeCommand("setContext", "starcraft.isInGame", false);

  game.reset();
  debug.stop();
  details.stop();
}

function deactivate() {
  activeContainer = false;

  exitGame();

  game.stop();
  timer.stop();
}

module.exports = { activate, deactivate };
