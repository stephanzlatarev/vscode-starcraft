import WebSocket, { WebSocketServer } from "ws";
import { spawn } from "node:child_process";

const PORT_API = Number(process.env.PORT_API) || 5000;
const PORT_LOG = Number(process.env.PORT_LOG) || 5001;

console.error("Listening for observer...");
let observer;

new WebSocketServer({ port: PORT_LOG }).on("connection", function(socket) {
  console.error("Observer connected");

  observer = socket;

  socket.on("close", function() {
    if (socket === observer) {
      console.error("Observer disconnected");

      observer = null;
    }
  });
});

console.error("Starting StarCraft II...");
const game = spawn("/StarCraftII/Versions/Base75689/SC2_x64", ["-listen", "127.0.0.1", "-port", "5555"]);

game.stdout.on("data", function(data) {
  console.error(data.toString().trim());
});

game.stderr.on("data", function(data) {
  const text = data.toString().trim();

  console.error(text);

  if (text === "Startup Phase 3 complete. Ready for commands.") {
    const socketToGame = new WebSocket("ws://127.0.0.1:5555/sc2api");
    let socketToBot;

    new WebSocketServer({ port: PORT_API }).on("connection", function(socket) {
      socketToBot = socket;
    
      socketToBot.on("error", console.error);
    
      socketToBot.on("message", function(data) {
        if (observer) observer.send(data);
        socketToGame.send(data);
      });
    });
    
    socketToGame.on("error", console.error);
    
    socketToGame.on("message", function(data) {
      if (observer) observer.send(data);
      socketToBot.send(data);
    });
  }
});

game.on("close", function(details) {
  console.error("StarCraft II exited");

  if (details) console.error(details);

  process.exit(1);
});
