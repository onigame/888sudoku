# Release Notes

## v1.10.1 (2026-11-20)
- **Label Update**: Renamed "Incorrect Constraints" to "Unsatisfied Constraints".

## v1.10.0 (2026-11-20)
- **Assistance Mode**: Added an `Assistance: Off/On` toggle button on the progress bar. When enabled:
  - Displays sorted unplaced digits (in 60%-size yellow note font) for the two active-plane rows containing the cursor outside the cube on the side closer to the camera, for the perpendicular shaft under the upper-right inset, and for the 2×2×2 region under the upper-left inset.
  - Highlights duplicate-digit errors (from givens and player entries) by turning the outermost border segments on both ends of any duplicate row/column in the active plane red, turning the upper-right shaft inset red on shaft duplicates, and turning the upper-left inset's outer borders red on region duplicates.

## v1.9.0 (2026-11-20)
- **Full 3D Sub-Cube Shading in Upper-Left Inset**: Updated the upper-left 2×2×2 region inset to shade the entire 1×1×1 sub-cube (front-facing faces) for the cursor cell (yellow) and its two in-plane row/column neighbors (cyan) instead of a flat 2D slice.

## v1.8.0 (2026-11-20)
- **Upper-Left Inset Cursor & Row/Col Shading**: Shaded the cursor cell in the upper-left 2×2×2 region inset yellow and its two in-plane row/column neighbor cells cyan to match the main grid highlighting.

## v1.7.0 (2026-11-20)
- **Inverted Puzzle # Spinner**: Replaced the native number spinner with custom `▲` / `▼` controls (and Up/Down arrow key handling) where clicking down increments the puzzle number and clicking up decrements it.
- **HTML Release Notes**: Clicking the version number in the header now opens an HTML-rendered version of `RELEASE_NOTES.md` (`public/release-notes.php`) in a new tab.

## v1.6.0 (2026-11-20)
- **Progress Bar & Empty Cells Counter**: Added a dedicated progress bar below the top bar containing the `Solved` badge, Incorrect Constraints counter, and an Empty Cells counter (`<A>+<B>/<C>` for blank cells without notes + blank cells with notes / total starting blank cells).
- **Upper-Left Inset Off-Plane Opacity**: Cells in the upper-left 2×2×2 region inset that are not in the active plane now render at 80% opacity to distinguish them from active-plane cells.

## v1.5.0 (2026-11-20)
- **Cursor Wraparound**: `Q`, `W`, `E`, `A`, `S`, `D` navigation (both keyboard and on-screen keypad) now wraps around to the opposite side when moving past an edge of the 8×8×8 cube.

## v1.4.0 (2026-11-20)
- **Reset Puzzle**: Added a "Reset" button next to "Load" with a confirmation modal dialog that erases all user entries, candidates, and solved status for the current puzzle.

## v1.3.0 (2026-11-20)
- **Multi-Type Symmetry**: Puzzle generation now uniformly selects one of 7 symmetry types (`0`–`6`): point symmetry, XY/XZ plane reflection, X/Y 180° rotation, Z rotation + XY reflection (4-cell), and Y rotation + XZ reflection (4-cell).

## v1.2.0 (2026-11-20)
- **Symmetric Puzzle Generation**: Every given cell `(x, y, z)` is now paired with its center-symmetric partner `(7 - x, 7 - y, 7 - z)`.
- **Extra Given Pairs**: After DLX proves a unique solution, uniformly chooses 0 to 4 (inclusive) extra symmetric pairs from the remaining blank cells to make puzzles slightly easier.

## v1.1.0 (2026-11-20)
- **Candidate / Pencil Marks**: Added Entry vs. Candidate mode (`Z` to toggle, hold `Shift` for temporary mode switch). Candidates render as yellow 60%-size sorted strings centered in cells across the main grid and insets, and persist in `localStorage`.
- **Clear & 1-Layer Undo/Redo**: `X` (alongside `Backspace`/`Delete`/`0`/`Space`) clears both entries and candidates; `C` performs 1-layer Undo/Redo.
- **Touch & Mobile Support**: Added lower-left (`Q W E / A S D / Z X C`) and lower-right (`1 2 3 / 4 5 6 / 7 8 0`) 3×3 on-screen keypads, 1-finger touch orbit/tap-to-select, and responsive mobile layout.
- **Perspective Inset Views**: Added upper-left 2×2×2 region inset (1:1 scale) and upper-right perpendicular shaft inset (2/5 scale, cyan dots for empty cells) using the main grid's perspective projection.
- **Depth Navigation**: Updated `Q`/`E` to step left/right across planes on the canvas with a dynamic `Closer`/`Farther` legend.
- **Visual Polish**: Reduced off-plane digit opacity, removed 3D cursor wireframe edges, and added Apache/PHP (`public/api.php`) compatibility alongside `server.js`.

## v1.0.0 (2026-11-19)
- Initial release with Mulberry32-seeded DLX puzzle generator, server-side JSON caching, 3D Canvas cube renderer, orbit camera, active-plane detection, `WASD`/`QE` and click navigation, `localStorage` persistence, and 256-constraint win detection.
