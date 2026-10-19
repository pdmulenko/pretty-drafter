## Unreleased

### Main features

- **Marker** in drawing tools: thick lines in the current color, with a ring cursor like the highlighter and eraser
- `Ctrl + C` / `Cmd + C` copies the current selection; `Ctrl + V` / `Cmd + V` pastes the copy next to the original in the same size (the copy also goes to the system clipboard)

### Settings adjustments

- Toolbar titles: **Graphs** → **Functions**, **Solids** → **Solid shapes**, **Drawing tools** → **Drawing**, so each title starts with its shortcut letter
- The three layer blocks wrap onto a new line only together
- Circle shows a thin dashed frame while editing, like solids and functions

### Fixed

- `Cmd + C` / `Ctrl + C` cycled colors
- Pasting an image after moving a selection (or over another pasted image) made the selection disappear
- The top of the board could stay under a wrapped toolbar if the page was opened in a background tab

## v1.3 — 2026-10-18

### Main features

- **Editing tools** group (`E`): eraser (moved here from drawing tools), hand (moves the whole board; content pushed past the edge is dropped) and area selection (cut a fragment of the active layer, then move, resize or rotate it)
- **Text tool** in drawing tools: thickness buttons switch light / regular / bold; while typing, the text frame can be moved, resized and rotated
- **Solids** group (`S`): cube / cuboid, triangular and hexagonal prisms, triangular, quadrilateral and hexagonal pyramids, with hidden edges dashed
- **Graphs** group (`F`): parabola, hyperbola, sine wave
- White color, which works as a temporary eraser
- `?` button and shortcut: about the app and the list of keyboard shortcuts
- Toolbar blocks wrap onto new lines on narrow screens
- Favicon

### Settings adjustments

- `Esc` is no longer used (in macOS full screen it exits full screen): `X` cancels the current shape or image, `Delete` removes a selection or image
- `Shift` draws an equilateral triangle, and a square frame for solids and graphs
- Thickness is no longer reset when switching tools right after choosing it, or when finishing a shape with `Enter`

### Fixed

- Resize handles of shapes and images behaved incorrectly after rotation
- Resize cursors did not follow the rotation of a shape
- The hidden top-right handle of a parallelogram could be grabbed
- Pasting an image into a page opened in a background tab could throw an error

## v1.1.2 — 2026-03-10

### Fixed

- When using undoable drawing tools, switching, clearing, or hiding the active layer did not affect the last drawn element
- Objects being drawn were still visible when drawing on a hidden layer

## v1.1.1 — 2026-03-08

### Fixed

- Triangular grid was not visible
- Line tool applied color and thickness settings only after the line was finished
- Geometry shapes did not use the thickness setting

## v1.1 — 2026-03-08

### Main features

- Undo is now available for pencil, highlighter, and line (`Ctrl + Z`); only the most recent drawing can be undone
- `Esc` now cancels the current geometry shape or image (to finish editing, press `Enter` or select another tool)
- Background is now available in three different sizes and also supports triangular grids
- Leaving the canvas during drawing now stops the drawing instead of "pausing" it (which previously could cause drawing without pressing the pointer)
- Window resizing now stretches the canvas content instead of wiping it

### Settings adjustments

- Switching to a new tool now selects the middle thickness by default
- Thickness values changed from `2–5–10` to `1–2–5`
- Gray color removed as obsolete
- "Brushes" renamed to **Drawing tools**, and "Primitives" renamed to **Geometry shapes**
- Line tool moved from the geometry section to the drawing tools section
- Keyboard shortcut for Drawing tools changed from `P` to `D`

### Fixed

- Drawing on lower layers is now correctly hidden under higher layers (even during editing)
- The first highlight stroke no longer behaved incorrectly until the color was changed
- Leaving and reentering the canvas could cause drawing to continue without pressing the pointer
- The last highlight stroke was not removed when clearing its layer if the highlight tool was active
- Cursor now changes above handles in Safari
- Several minor bugs

---

## v1.0 — 2026-02-14

First public release
