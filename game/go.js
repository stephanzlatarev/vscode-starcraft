import WebSocket, { WebSocketServer } from "ws";
import { spawn } from "node:child_process";

const PORT_API = Number(process.env.PORT_API) || 5000;
const PORT_LOG = Number(process.env.PORT_LOG) || 5001;

const CODE_PAUSE = 1;
const CODE_RESUME = 2;

let socketToGame;
let socketToBot;
let socketToObserver;

let request = null;
let isPaused = false;

function setPaused(flag) {
  console.log(flag ? "Game paused" : "Game resumed");

  isPaused = flag;
}

function listenForObservers() {
  console.error("Listening for observer...");

  new WebSocketServer({ port: PORT_LOG }).on("connection", function(socket) {
    console.error("Observer connected");

    socketToObserver = socket;

    socket.on("error", console.error);

    socket.on("message", function(data) {
      switch (data[0]) {
        case CODE_PAUSE: return setPaused(true);
        case CODE_RESUME: return setPaused(false);
      }

      if (socket) sendToGame(socket, data);
    });

    socket.on("close", function() {
      if (socket === socketToObserver) {
        console.error("Observer disconnected");

        socketToObserver = null;
      }
    });
  });
}

function listenForBots() {
  console.error("Listening for bots...");

  new WebSocketServer({ port: PORT_API }).on("connection", function(socket) {
    console.error("Bot connected");

    socketToBot = socket;

    socket.on("error", console.error);

    socket.on("message", function(data) {
      if (socketToObserver) socketToObserver.send(data);
      if (socket) sendToGame(socket, data);
    });

    socket.on("close", function() {
      if (socket === socketToBot) {
        console.error("Bot disconnected");

        socketToBot = null;
      }
    });
  });
}

function connectToGame() {
  console.error("Starting StarCraft II...");

  const game = spawn("/StarCraftII/Versions/Base75689/SC2_x64", ["-listen", "127.0.0.1", "-port", "5555"]);

  game.stdout.on("data", function(data) {
    console.error(data.toString().trim());
  });

  game.stderr.on("data", function(data) {
    const text = data.toString().trim();

    console.error(text);

    if (text === "Startup Phase 3 complete. Ready for commands.") {
      const socket = new WebSocket("ws://127.0.0.1:5555/sc2api");

      socket.on("open", function open() {
        console.error("StarCraft II connected");

        socketToGame = socket;
      });

      socket.on("error", console.error);
    
      socket.on("message", function(data) {
        if (socketToObserver) socketToObserver.send(data);
        if (request && socketToBot && (request.caller === socketToBot)) socketToBot.send(data);
    
        request = null;
      });
    }
  });

  game.on("close", function(details) {
    console.error("StarCraft II exited");

    if (details) console.error(details);

    connectToGame();
  });
}

async function sendToGame(caller, data) {
  while (!socketToGame) await sleep(10);
  while (request) await sleep(10);
  while (isPaused && (caller === socketToBot)) await sleep(10);

  request = { caller, data };

  socketToGame.send(data);
}

function sleep(millis) {
  return new Promise(resolve => setTimeout(resolve, millis));
}

listenForObservers();
listenForBots();
connectToGame();
