
const path = require("path");
const copy = require("copy-webpack-plugin");

module.exports = {
  target: "node",

  entry: "./extension/extension.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "extension.js",
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
      {
        test: /\.webp$/i,
        use: [
          {
            loader: 'file-loader',
          },
        ],
      },
    ]
  },
  plugins: [
    new copy({
      patterns: [
        { from: "icons", to: "icons" }
      ]
    })
  ]
}
