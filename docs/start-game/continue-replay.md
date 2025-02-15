---
layout: default
title: Continue from replay
parent: Start game
nav_order: 2
has_children: true
has_toc: false
---

Stop a replay at any time point and continue the game with your bot playing against the computer:
* While watching a replay, press `⏸ PAUSE` to pause a replay at the desired time
* You can use `⏪ 1 FRAME` and `⏩ 1 FRAME` to move back and forward within 10 seconds before the time you paused the replay
* Press `🤖 BOTPLAY` to switch from replay mode to your bot playing
* Select the starting location for your bot (`Player 1` or `Player 2`)
* Select the difficulty level of the opponent computer
* Press `Start`. The game may need a few attempts to spawn the players at the desired starting locations. Be patient
* When you see "Wait for a bot to join the game", start your bot

![Continue from replay](continue-replay.gif)

The game will continue from the game loop when you switched from replay mode to your bot playing.
However, your bot will not have retrieved observations before that and will not have knowledge about units that were visible during the replay but are now in the fog of war.
Additionally, the simulation is not perfect. For example, hallucinated units may be spawned as normal units.
Take into consideration that slight differences from the replay may appear that may cause different behavior of your bot.
