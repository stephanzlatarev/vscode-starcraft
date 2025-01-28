const Host = require("./host.js");

const CHECKING = 0;
const SUCCESS = 1;
const FAILURE = 2;
const FLAG = [
  "<div class='flag blue spin'>&#x27F3;</div>",
  "<div class='flag green'>&#x2714;</div>",
  "<div class='flag red'>&#x2716;</div>",
];

class Checklist {

  constructor(container) {
    this.container = container;
    this.checks = [];

    container.onDidDispose(this.close.bind(this));
  }

  track(promise, check) {
    if (!this.container) return;

    this.checks.push(check);
    render(this, CHECKING);

    return new Promise(async function(resolve, reject) {
      try {
        const result = await promise();

        render(this, SUCCESS);
        resolve(result);
      } catch (error) {
        render(this, FAILURE, error.message);
        reject(error);
      }
    }.bind(this));
  }

  close() {
    this.container = null;
  }

}

async function render(checklist, status, details) {
  const html = [
    "<!DOCTYPE html>",
    "<html>",
    "<style>",
    "body { padding: 3rem; }",
    "div { margin-top: 1rem; font-size: 120%; }",
    ".flag { display: inline-block; }",
    ".blue { color: blue; }",
    ".green { color: green; }",
    ".red { color: red; }",
    ".head { padding-left: 1rem; }",
    ".spin { animation: spin 1s linear infinite; }",
    "@keyframes spin { 100% { transform: rotate(360deg); } }",
    "</style>",
    "<body>",
  ];

  for (let i = 0; i < checklist.checks.length - 1; i++) {
    const check = checklist.checks[i];
    const markup = (check instanceof Host) ? check.complete() : "<span class='head'>" + check + "</span>";

    html.push("<div>", FLAG[SUCCESS], markup, "</div>");
  }

  const check = checklist.checks[checklist.checks.length - 1];
  const markup = (check instanceof Host) ? (!status ? await check.checking() : check.complete()) : "<span class='head'>" + check + "</span>";
  html.push("<div>", FLAG[status], markup, details || "", "</div>");

  html.push(
    "</body>",
    "</html>",
  );

  if (checklist.container) {
    checklist.container.webview.html = html.join(" ");
  }
}

module.exports = Checklist;
