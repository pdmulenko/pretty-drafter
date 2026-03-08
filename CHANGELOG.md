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
