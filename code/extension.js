const vscode = require("vscode");
const sc2 = require("@node-sc2/proto/root/index.js");
const { execSync, spawnSync } = require("node:child_process");
const WebSocket = require("ws");

const LOOPS_PER_SECOND = 22.4;
const LOOPS_PER_MINUTE = LOOPS_PER_SECOND * 60;
const ZOOM = 12;
const UNIT_TYPE = {};
const IS_BUILDING = {};
const IS_MINERAL_FIELD = {};
const IS_VESPENE_GEYSER = {};

const Response = sc2.lookupType("Response");

let extension;
let iconspath;
let viewbox = { width: 600, height: 600 };
let mouse = { x: 0, y: 0 };
let mapbox = { top: 0, left: 0, width: 250, height: 250 };
let loop = -1;
let units = [];
let hint = [];

let mapPanel;
let zoomPanel;
let refreshing;

function activate(context) {
  extension = context;

  context.subscriptions.push(vscode.commands.registerCommand("starcraft.startGame", () => {
    // Create map panel
    mapPanel = vscode.window.createWebviewPanel("starcraft.map", "AcropolisAIE", vscode.ViewColumn.One, { enableScripts: true });
    mapPanel.webview.onDidReceiveMessage(function(message) {
        const data = message.text.split(",").map(text => Number(text));

        if (message.command === "size") {
          const width = Math.min(data[0] - 50, data[1] - 50);
          viewbox.width = width;
          viewbox.height = width; // TODO: Calculate height based on map ratio
        } else if (message.command === "click") {
          mouse.x = Math.round(mapbox.left + data[0] * mapbox.width / viewbox.width);
          mouse.y = Math.round(mapbox.top + data[1] * mapbox.height / viewbox.height);
        }
      },
      undefined,
      context.subscriptions
    );

    // Create zoom panel
    zoomPanel = vscode.window.createWebviewPanel("starcraft.zoom", "Zoom", vscode.ViewColumn.Two, { enableScripts: true });
    iconspath = zoomPanel.webview.asWebviewUri(vscode.Uri.joinPath(extension.extensionUri, "icons"));

    // Start refreshing the panels
    refreshing = setInterval(refresh, 250);

    // Start the game
    startGame();
  }));
}

function refresh() {
  if (mapPanel && mapPanel.visible) {
    mapPanel.webview.html = renderView();
  }

  if (zoomPanel && zoomPanel.visible) {
    zoomPanel.title = mouse.x + ":" + mouse.y;
    zoomPanel.webview.html = renderView(mouse);
  }
}

function renderView(zoom) {
  const html = [
    "<!DOCTYPE html>",
    "<html>",
    "<body>",
    clock(),
    hint.join(" | "),
    "<br />",
  ];

  let box = [];
  if (zoom) {
    box.push(zoom.x - ZOOM, zoom.y - ZOOM, ZOOM + ZOOM, ZOOM + ZOOM);
  } else {
    box.push(mapbox.left, mapbox.top, mapbox.width, mapbox.height);
  }

  html.push(`<svg id="map" width="${viewbox.width}" height="${viewbox.height}" viewBox="${box.join(" ")}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">`);

  // Show grid
  if (zoom) {
    const minx = zoom.x - ZOOM;
    const maxx = zoom.x + ZOOM;
    const miny = zoom.y - ZOOM;
    const maxy = zoom.y + ZOOM;

    html.push("<g style='stroke: #333333; stroke-width: 0.05'>");
    for (let x = minx + 1; x < maxx; x++) {
      html.push(`<line x1="${x}" y1=${miny} x2="${x}" y2="${maxy}" />`);
    }
    for (let y = miny + 1; y < maxy; y++) {
      html.push(`<line x1=${minx} y1="${y}" x2="${maxx}" y2="${y}" />`);
    }
    html.push("</g>");
  }

  // Show units
  for (const unit of units) {
    if (zoom && ((unit.x < zoom.x - ZOOM) || (unit.x > zoom.x + ZOOM) || (unit.y < zoom.y - ZOOM) || (unit.y > zoom.y + ZOOM))) continue;

    let color = "blue";

    if (unit.owner === 1) color = "green";
    if (unit.owner === 2) color = "red";

    if (zoom && extension) {
      const size = getBuildingSize(unit);
      let x, y, width, height;

      if (size) {
        x = unit.x + size.dx;
        y = unit.y + size.dy;
        width = size.width;
        height = size.height;

        html.push(`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="0.4" ry="0.4" stroke="${color}" stroke-width="0.2" fill="black" />`);
      } else {
        html.push(`<circle cx="${unit.x}" cy="${unit.y}" r="${unit.r}" stroke="${color}" stroke-width="0.2" fill="black" />`);
      }

      if (UNIT_TYPE[unit.type]) {
        const href = iconspath + "/" + UNIT_TYPE[unit.type] + ".webp";
        const onerror = `onerror="this.style.display='none'"`;

        if (size) {
          x += 0.4;
          y += 0.4;
          width -= 0.8;
          height -= 0.8;
        } else {
          const radius = unit.r / 1.5;
          x = unit.x - radius;
          y = unit.y - radius;
          width = radius + radius;
          height = width;
        }

        html.push(`<image x="${x}" y="${y}" width="${width}" height="${height}" href="${href}" ${onerror} />`);
      }
    } else {
      html.push(`<circle cx="${unit.x}" cy="${unit.y}" r="${unit.r}" stroke="none" fill="${color}" />`);
    }
  }

  html.push("</svg>");

  if (!zoom) {
    html.push("<script>");
    html.push("const vscode = acquireVsCodeApi();");
    html.push("vscode.postMessage({ command: 'size', text: [window.innerWidth, window.innerHeight].join() });");
    html.push("document.getElementById('map').addEventListener('click', (event) => { vscode.postMessage({ command: 'click', text: [event.offsetX, event.offsetY].join() }); });");
    html.push("</script>");
  }

  html.push(
    "</body>",
    "</html>",
  );

  return html.join("");
}

function getBuildingSize(unit) {
  if (IS_MINERAL_FIELD[unit.type]) return { dx: -1, dy: -0.5, width: 2, height: 1 };
  if (IS_VESPENE_GEYSER[unit.type]) return { dx: -1.5, dy: -1.5, width: 3, height: 3 };

  if (IS_BUILDING[unit.type]) {
    const size = Math.floor(unit.r + unit.r);
    const radius = size / 2;
    return { dx: -radius, dy: -radius, width: size, height: size };
  }
}

function clock() {
  if (loop < 0) return "Waiting for game to start";

  const minutes = Math.floor(loop / LOOPS_PER_MINUTE);
  const seconds = Math.floor(loop / LOOPS_PER_SECOND) % 60;
  const mm = (minutes >= 10) ? minutes : "0" + minutes;
  const ss = (seconds >= 10) ? seconds : "0" + seconds;

  return `${mm}:${ss}/${loop}`;
}

function connectToGame(attempts) {
  return new Promise(function(resolve) {
    const connection = new WebSocket("ws://127.0.0.1:5001/sc2api");

    connection.on("error", async function() {
      if (attempts > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));

        resolve(await connectToGame(attempts - 1));
      }
    });

    connection.on("open", function() {
      resolve(connection);
    });
  });
}

async function startGame() {
  spawnSync("docker", ["run", "--name", "starcraft", "-d", "-p", "5000:5000", "-p", "5001:5001", "stephanzlatarev/starcraft"]);

  const connection = await connectToGame(30);

  connection.on("message", function(data) {
    const response = decodeResponse(data);

    if (!response) return;

    if (response.gameInfo && response.gameInfo.startRaw) {
      const { p0, p1 } = response.gameInfo.startRaw.playableArea;

      mapbox.top = p0.y;
      mapbox.left = p0.x;
      mapbox.width = p1.x - p0.x;
      mapbox.height = p1.y - p0.y;
    }

    if (response.observation && response.observation.observation) {
      loop = response.observation.observation.gameLoop;
      units = response.observation.observation.rawData.units.map(unit => ({
        type: unit.unitType,
        owner: unit.owner,
        x: unit.pos.x,
        y: unit.pos.y,
        z: unit.pos.z,
        r: unit.radius,
      }));
      units.sort((a, b) => ((a.z - b.z) || (b.owner - a.owner) || (b.r - a.r)));
    }

    if (response.data && response.data.units) {
      for (const unit of response.data.units) {
        if (unit.unitId && unit.name) {
          UNIT_TYPE[unit.unitId] = unit.name;

          if (unit.name.indexOf("MineralField") >= 0) IS_MINERAL_FIELD[unit.unitId] = true;
          if (unit.name.indexOf("Geyser") >= 0) IS_VESPENE_GEYSER[unit.unitId] = true;
          if (unit.attributes && (unit.attributes.indexOf(8) >= 0)) IS_BUILDING[unit.unitId] = true;
        }
      }
    }
  });
}

function decodeResponse(data) {
  try {
    return Response.decode(data);
  } catch (error) {
    console.error("Unable to decode response:");
    console.error(error);
  }
}

function stopGame() {
  execSync("docker rm -f starcraft");
}

function deactivate() {
  clearInterval(refreshing);
  stopGame();
  extension = null;
}

module.exports = { activate, deactivate };
