---
layout: default
title: Debug info
nav_order: 6
has_children: true
has_toc: false
---

When playing a game your bot can use the debug commands to add information to the camera, minimap and the debug terminal.

This screenshot demonstrates:
* A dynamic list of "battles" the bot engages in - as text in the `Debug` terminal to the right
* The coordinates of "zones" on the map and the path between them - as lines in the camera view
* The "alert levels" of the "zones" on the map - as colors on the minimap

![Debug info](debug-info.png)

The following debug commands are supported at the moment:
* Debug draw lines will show lines on camera and minimap
* Debug draw spheres will show circles on camera and minimap
* Debug draw text
    * with virtual position - `virtualPos` - will show in the `Debug` terminal. The x coordinate will be used to split debug info into tabs in the future
    * without virtual or world position - will be parsed as JSON object and interpreted as a shape

### Shapes

The following shapes can be displayed with debug draw text command without virtual or world position:
* `arrow` - Displays an arrow from point `x1`, `y1` to point `x2`, `y2` with starting point of radius `r`. Example: `{ "shape": "arrow", "x1": 50, "y1": 50, "x2": 100, "y2": 100, "r": 10, "color": "yellow" }`
* `cell` - Colors point `x`, `y` on the map. Example: `{ "shape": "cell", "x": 100, "y": 100, "color": "blue" }`
* `circle` - Displays a circle with center point `x`, `y` and radius `r`. Example: `{ "shape": "circle", "x": 100, "y": 100, "r": 20, "color": "green" }`
* `line` - Displays a line from point `x1`, `y1` to point `x2`, `y2`. Example: `{ "shape": "line", "x1": 50, "y1": 50, "x2": 100, "y2": 100, "width": 10, "color": "red" }`
* `polygon` - Displays a polygon. Example: `{ "shape": "polygon", "points": [50, 50, 100, 50, 100, 100], "opacity": 0.8 }`
* `sector` - Colors the sector at column `col` and row `row`. Example: `{ "shape": "sector", "col": 0, "row": 2, "color": "green" }`

Shapes `arrow`, `circle`, `line`, and `polygon` support the optional properties:
* `color` - The color of the shape. Defaults to `gold`
* `filled` - When `true` fills the shape with the color. Otherwise, colors its contour. Ignored for `line` shapes. Defaults to `false`
* `width` - The stroke width when the shape is not filled. Defaults to `1`
* `dotted` - When `true` and the shape is not filled displays the contour of the shape with a dotted line.
* `opacity` - The opacity level of the coloring. Defaults to `0.2`
* `pulsing` - When `true` displays the shape as pulsating. Defaults to `false`
