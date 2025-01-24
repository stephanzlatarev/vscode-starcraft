
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
        render(this, FAILURE);
        reject(error);
      }
    }.bind(this));
  }

  close() {
    this.container = null;
  }

}

function render(checklist, status) {
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
    ".text { padding-left: 1rem; }",
    ".spin { animation: spin 1s linear infinite; }",
    "@keyframes spin { 100% { transform: rotate(360deg); } }",
    "</style>",
    "<body>",
  ];

  for (let i = 0; i < checklist.checks.length - 1; i++) {
    html.push("<div>", FLAG[SUCCESS], "<span class='text'>", checklist.checks[i], "</span>", "</div>");
  }

  html.push("<div>", FLAG[status], "<span class='text'>", checklist.checks[checklist.checks.length - 1], "</span>", "</div>");

  html.push(
    "</body>",
    "</html>",
  );

  if (checklist.container) {
    checklist.container.webview.html = html.join(" ");
  }
}

module.exports = Checklist;
