# StarCraft II for Bots

Run your bots with StarCraft II within Visual Studio Code.

## Features

Visualizes StarCraft II games and replays directly in you IDE.
You don't need an installation of the game on your machine.
You can improve the code of your bot and troubleshoot it without leaving Visual Studio Code.

To run a replay, drag and drop a replay file (*.SC2Replay) into the Editor area of Visual Studio Code. If you have the file in your workspace, open it with a click.

To play a game with your bot, start StarCraft II by opening the command palette with `Ctrl+Shift+P` and typing `Start StarCraft II for a bot to play`.

In both cases, a viewer will start checking all pre-requisites until the game is ready for viewing.
Then the editor will show game camera.
The left side will host game controls and a minimap.
You can click on the minimap to move the camera.

## Acknowledgements

This extension to Visual Studio Code makes use of [StarCraft II API](https://github.com/Blizzard/s2client-proto) and its headless StarCraft II linux build,
and the lightweight node.js framework [node-sc2](https://github.com/node-sc2).
Thanks for your great work!
