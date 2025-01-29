import WebSocket, { WebSocketServer } from "ws";
import { spawn } from "node:child_process";

const PORT_API = Number(process.env.PORT_API) || 5000;
const PORT_LOG = Number(process.env.PORT_LOG) || 5001;

let socketToGame;
let socketToBot;
let socketToObserver;

let request;

function listenForObservers() {
  console.error("Listening for observer...");

  new WebSocketServer({ port: PORT_LOG }).on("connection", function(socket) {
    console.error("Observer connected");

    socketToObserver = socket;

    socket.on("error", console.error);

    socket.on("message", function(data) {
      sendToGame(socketToObserver, data);
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
    socketToBot = socket;

    socketToBot.on("error", console.error);

    socketToBot.on("message", function(data) {
      if (socketToObserver) socketToObserver.send(data);

      sendToGame(socketToBot, data);
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
      socketToGame = new WebSocket("ws://127.0.0.1:5555/sc2api");

    
      socketToGame.on("error", console.error);
    
      socketToGame.on("message", function(data) {
        if (socketToObserver) socketToObserver.send(data);
        if (socketToBot && (request.caller === socketToBot)) socketToBot.send(data);
    
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

  request = { caller, data };

  socketToGame.send(data);
}

function sleep(millis) {
  return new Promise(resolve => setTimeout(resolve, millis));
}

listenForObservers();
listenForBots();
connectToGame();
