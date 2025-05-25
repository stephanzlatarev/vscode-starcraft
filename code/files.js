const vscode = require("vscode");

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
  await vscode.workspace.fs.copy(source, vscode.Uri.joinPath(extensionUri, "replays", getFileName(source)), { overwrite: true });
}

async function readHtmlFile(page) {
  let html = htmlFiles.get(page);

  if (!html) {
    try {
      const file = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(extensionUri, "html", page));

      html = file.toString();
    } catch (error) {
      console.error(error);
    }

    if (!html) {
      html = "<!DOCTYPE html><html><body>Oops! This view is broken.</body></html>";
    }

    htmlFiles.set(page, html);
  }

  return html;
}

async function readReplayFile(filename) {
  return await vscode.workspace.fs.readFile(vscode.Uri.joinPath(extensionUri, "replays", filename));
}

module.exports = { copyReplayFile, getFileName, getIconsPath, getReplaysPath, readHtmlFile, readReplayFile, setExtensionUri };

