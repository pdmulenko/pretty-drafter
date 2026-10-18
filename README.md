# ✨ Pretty Drafter

A browser-based whiteboard for teaching, studying, and explaining ideas —  
built for pen input and geometry.

## Compatibility

Pretty Drafter is a web app, so there is nothing to install.  
Just open it in your browser:

https://pdmulenko.github.io/pretty-drafter/

## Features

- Pen-based drawing (tablet and mouse friendly)
- Basic drawing tools (pencil, line, highlighter, text) with the ability to undo the last drawing
- White color works as a temporary eraser that paints over content
- Text tool (Helvetica Neue / Arial): thickness buttons switch light / regular / bold; the text frame can be moved, resized and rotated while typing
- Editing tools: eraser, hand (moves the whole board; content pushed past the edge is dropped) and area selection (cut a fragment of the active layer, then move, resize or rotate it)
- Toolbar blocks wrap onto new lines on narrow screens
- The `?` button shows the app info and all keyboard shortcuts
- Geometric shapes (polyline, rectangle, triangle, circle, trapezoid, parallelogram) with editing support (rotation and resize handles)
- Solids (cube / cuboid, triangular and hexagonal prisms, triangular, quadrilateral and hexagonal pyramids) drawn as in textbooks, with hidden edges dashed
- Function graphs (parabola, hyperbola, sine wave) that fit the frame you drag
- Images can be inserted from the clipboard
- Three-layer canvas with the ability to clear layers and toggle their visibility
- Keyboard shortcuts (see below)

## Input

- Works best with graphic tablets
- Fully usable with mouse and trackpad

## Keyboard shortcuts

- `D` — cycle drawing tools
- `E` — cycle editing tools (eraser, hand, selection)
- `Ctrl + Z` — undo the last drawing (except for eraser)
- `Ctrl + V` — insert an image from clipboard
- `G` — cycle geometry tools
- `S` — cycle solids
- `F` — cycle function graphs
- `Shift` — hold for angle snapping (line), a square (rectangle), an equilateral triangle (triangle), or a square frame (solids and graphs, e.g. a true cube)
- `X` — cancel the current shape or image; for a selection, put the fragment back where it was (`Esc` is not used: in macOS full screen it exits full screen)
- `Enter` — finish editing the current shape, image or selection
- `Delete` / `Backspace` — delete the current selection or image
- Text: `Enter` places the text, `Shift + Enter` starts a new line
- `T` — cycle thickness for the current drawing tool or geometry shape
- `C` — cycle colors for the current drawing tool or geometry shape
- `1`–`3` — switch to a layer
- `Shift + 1`–`3` — toggle layer visibility
- `Ctrl + 1`–`3` — clear a layer
- `?` — show or hide the help window

## Release history

See [CHANGELOG](CHANGELOG.md).

## 📄 License

[MIT](LICENSE)
