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

  track(_, promise, check) {
    if (!this.container) return;

    this.checks.push(check);
    render(this, CHECKING);

    return new Promise(async function(resolve, reject) {
      try {
        const result = await promise();

        await render(this, SUCCESS);

        resolve(result);
      } catch (error) {
        let details;

        if (error instanceof Error) {
          details = error.message;
        } else if (error instanceof String) {
          details = error;
        }

        await render(this, FAILURE, details);

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
    html.push("<div>", FLAG[SUCCESS], await getMarkup(checklist.checks[i], "complete", checklist.container), "</div>");
  }

  const check = checklist.checks[checklist.checks.length - 1];
  const markup = await getMarkup(check, status, checklist.container);

  html.push("<div>", FLAG[status], markup, details || "", "</div>");

  html.push(
    "</body>",
    "</html>",
  );

  // Check again if the container is active because it may have meanwhile been disposed
  if (checklist.container) {
    checklist.container.webview.html = html.join(" ");
  }
}

async function getMarkup(check, status, container) {
  const markup = status ? check.complete : check.checking;

  if (markup instanceof Function) {
    return await markup.bind(check)(container);
  } else {
    return "<span class='head'>" + (markup || check) + "</span>";
  }
}

module.exports = Checklist;
