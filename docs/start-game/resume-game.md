---
layout: default
title: Resume game
parent: Start game
nav_order: 4
has_children: true
has_toc: false
---

Start a new game for your bot to play against the computer:
* During a running or paused game, stop your bot
* Make chages to the code of your bot, add breakpoints, anything...
* Start your bot

![Resume game](resume-game.gif)

Your bot will reconnect to the same game at the same game loop.
However, your bot will have lost its internal state so take this into consideration when observing any differences in behavior.
