const vscode = require("vscode");
const fetchModule = require("node-fetch");
const fetch = fetchModule.default || fetchModule;

const htmlFiles = new Map();

let extensionUri;

function setExtensionUri(uri) {
  extensionUri = uri;
}

function getIconsPath(webview) {
  return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "icons")) + "/";
}

function getReplaysPath() {
  return vscode.Uri.joinPath(extensionUri, "replays").path;
}

function getFileName(uri) {
  const path = uri.path.split("/");

  return path[path.length - 1];
}

async function copyReplayFile(source) {
  const sourcePath = source.path ? source.path : source;
  const sourceSplit = sourcePath.split("?")[0].split("/");
  const fileName = sourceSplit[sourceSplit.length - 1];
  const target = vscode.Uri.joinPath(extensionUri, "replays", fileName);

  if (await getFileMeta(target)) {
    // The file is already copied
    return target;
  } if (sourcePath.startsWith("http")) {
    const response = await fetch(sourcePath);
    const buffer = Buffer.from(await response.arrayBuffer());

    await vscode.workspace.fs.writeFile(target, buffer);
  } else {
    await vscode.workspace.fs.copy(source, target, { overwrite: true });
  }

  return target;
}

async function getFileMeta(uri) {
  try {
    return await vscode.workspace.fs.stat(uri);
  } catch (error) {
    // The file does not exist
  }
}

async function readHtmlFile(...page) {
  const path = page.join("/");
  let html = htmlFiles.get(path);

  if (!html) {
    try {
      const file = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(extensionUri, "html", ...page));

      html = file.toString();
    } catch (error) {
      console.error(error);
    }

    if (!html) {
      html = "<!DOCTYPE html><html><body>Oops! This view is broken.</body></html>";
    }

    htmlFiles.set(path, html);
  }

  return html;
}

async function readReplayFile(filename) {
  return await vscode.workspace.fs.readFile(vscode.Uri.joinPath(extensionUri, "replays", filename));
}

module.exports = { copyReplayFile, getFileName, getIconsPath, getReplaysPath, readHtmlFile, readReplayFile, setExtensionUri };

