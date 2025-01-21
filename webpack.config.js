
const path = require("path");
const copy = require("copy-webpack-plugin");

module.exports = {
  target: "node",

  entry: "./code/extension.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "./code/extension.js",
    libraryTarget: "commonjs2",
    devtoolModuleFilenameTemplate: "../[resource-path]",
    clean: true,
  },
  devtool: "source-map",
  externals: {
    vscode: "commonjs vscode"
  },
  resolve: {
    extensions: [".js"]
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/
      },
    ]
  },
  plugins: [
    new copy({
      patterns: [
        "LICENSE",
        "package.json",
        "README.md",
        { from: "icons", to: "icons" }
      ]
    })
  ]
}
