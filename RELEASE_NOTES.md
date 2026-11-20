# Release Notes

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
