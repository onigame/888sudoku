# Formal Specifications: 8x8x8 3D Sudoku Webapp

**Current Version:** 1.10.1

## 1. Overview
A web application for generating, caching, and solving 8×8×8 3D Sudoku puzzles.
- **Backend**: Standalone Node.js HTTP server (`server.js`, zero external dependencies) and Apache-compatible PHP endpoint (`public/api.php` invoking `lib/cli_generate.js`) serving static frontend assets and a puzzle generation/caching API.
- **Frontend**: Vanilla HTML/CSS/JavaScript with an HTML5 Canvas 2D renderer using 3D perspective projection.

## 2. Game Rules & Grid Model
- **Dimensions**: $8 \times 8 \times 8 = 512$ cells, indexed by $(x, y, z)$ with $x, y, z \in \{0, \dots, 7\}$.
- **Flat index**: $\text{idx} = x + 8y + 64z \in \{0, \dots, 511\}$.
- **Digits**: $1$ through $8$ ($0$ represents an empty cell).
- **256 Constraint Groups** (each group of 8 cells must contain every digit $1 \dots 8$ exactly once):
  1. **Rows (64)**: Fixed $(y, z)$, $x \in [0..7]$.
  2. **Columns (64)**: Fixed $(x, z)$, $y \in [0..7]$.
  3. **Shafts (64)**: Fixed $(x, y)$, $z \in [0..7]$.
  4. **Regions (64)**: $2 \times 2 \times 2$ sub-cubes indexed by $(b_x, b_y, b_z) \in \{0..3\}^3$, containing $(2b_x + d_x, 2b_y + d_y, 2b_z + d_z)$ for $d_x, d_y, d_z \in \{0, 1\}$.

## 3. Puzzle Generation & Caching
- **Seeded PRNG**: Deterministic 32-bit PRNG (Mulberry32) seeded from the integer puzzle number $N \ge 1$.
- **Exact Cover (DLX)**:
  - 2,560 constraint columns: 512 cell constraints + 512 row-digit + 512 col-digit + 512 shaft-digit + 512 region-digit.
  - 4,096 candidate rows: $(x, y, z, d)$ for each cell and digit $1..8$.
  - Uses Knuth's Algorithm X with Dancing Links (DLX) and Minimum Remaining Values (MRV) column selection, with candidate row order randomized by the seeded PRNG.
- **Generation Algorithm**:
  1. Uniformly choose a `symmetryType` in $0..6$:
     - `0`: Point symmetry across the center point
     - `1`: Reflective symmetry across the $XY$ plane
     - `2`: Reflective symmetry across the $XZ$ plane
     - `3`: 180° rotational symmetry around the $X$ axis
     - `4`: 180° rotational symmetry around the $Y$ axis
     - `5`: 180° rotational symmetry around the $Z$ axis + reflective symmetry across the $XY$ plane (4-cell orbit)
     - `6`: 180° rotational symmetry around the $Y$ axis + reflective symmetry across the $XZ$ plane (4-cell orbit)
  2. Start from a seeded valid 8×8×8 grid and place one random cell's symmetric orbit as givens.
  3. Run DLX on the current givens, stopping once 2 solutions are found (`maxSolutions = 2`).
  4. On sparse grids where raw DLX exceeds a 25,000-step budget, add a random blank cell's symmetric orbit from the seeded valid grid and repeat.
  5. Once DLX completes within budget: if 2 solutions are found, pick a random cell where `solution1[i] !== solution2[i]`, add `solution1` values for its symmetric orbit as givens, and repeat.
  6. Once 1 unique solution is found, uniformly choose `extraPairs` in $0..4$ (inclusive) and add that many symmetric orbits of extra givens at random from the remaining blank cells.
- **Server Caching**:
  - Puzzles are stored on disk at `puzzles/<number>.json`.
  - `GET /api/puzzle?number=<N>` and `GET api.php?number=<N>` return the cached JSON if present, or generate, write to disk, and return it.

## 4. Persistence (`localStorage`)
- `sudoku888_solved`: JSON array of solved puzzle numbers.
- `sudoku888_puzzle_<N>`: JSON object storing `{ entries: { [cellIdx]: digit }, candidates: { [cellIdx]: bitmask } }` for puzzle `N`.

## 5. User Interface & Controls
- **Puzzle Selection**:
  - URL query parameter `?puzzle=N` (defaults to `1`).
  - Header input box + "Load" button to switch to any positive integer puzzle number, a "Reset" button with a confirmation modal dialog to erase all user entries, candidates, and solved status for the current puzzle, plus a solved badge if the current puzzle is in `sudoku888_solved`.
- **3D Cube Rendering**:
  - Cube centered at $(0, 0, 0)$ with cell centers at $(x - 3.5, y - 3.5, z - 3.5)$.
  - Drawn back-to-front using 3D perspective projection.
  - Faint wireframe edges for all cells; numbers centered in 3D cell centers and rendered as 2D screen-aligned text facing the user.
  - Given digits and user-entered digits are visually distinct; digits outside the active plane are rendered near background opacity.
  - Candidate marks render in yellow at 60% of normal digit size as a single numerically sorted string centered in the cell.
- **Inset Views**:
  - **Upper-Left (2×2×2 Region Inset)**: Perspective-projected copy of the 2×2×2 region containing the cursor at the same orientation and scale as the main grid, with full-opacity outer 12 edges, low-opacity interior edges, full 1×1×1 sub-cube yellow shading on the cursor cell and cyan shading on its two in-plane row/column neighbor cells, full-opacity digits/candidates for active-plane cells, and 80% opacity for off-plane cells.
  - **Upper-Right (Perpendicular Shaft Inset)**: Perspective-projected 2/5-scale copy of the 8-cell shaft perpendicular to the active plane at the same orientation, with a single low-opacity connecting line, full-opacity digits/candidates, and cyan dots for empty cells without candidates.
- **Camera**:
  - Orbit camera with longitude (`lon`) and latitude (`lat` clamped to $(-90^\circ, +90^\circ)$).
  - Controlled by dragging with Right Mouse Button, holding `Shift` + Left Mouse Button, or 1-finger touch drag on the canvas.
- **Cursor & Active Plane**:
  - One cell $(c_x, c_y, c_z)$ is always the active cursor, highlighted in yellow.
  - Among the 3 axis-aligned $8 \times 8$ planes containing the cursor ($XY$, $XZ$, $YZ$), the one with the largest projected 2D screen area is the **active plane**.
  - Visual hierarchy:
    1. Cursor cell: brightest yellow square highlight.
    2. Cursor's row and column within the active plane: medium-bright highlight.
    3. Remaining cells in the active plane: subtle highlight.
    4. All other cells: faint.
  - Within the active plane, $2 \times 2$ region boundaries are drawn with thicker lines.
- **Input**:
  - **Left Click / Tap**: Ray-plane intersection with the active plane moves the cursor to the clicked cell within the active plane.
  - **Modes (`Z` / `Shift`)**: Tapping `Z` toggles between **Entry** mode and **Candidate** mode; holding `Shift` temporarily switches to the opposite mode until released.
  - **`1`–`8`**: In Entry mode, sets the digit in the cursor cell and clears its candidates; in Candidate mode, clears any user entry and toggles the digit in the cell's candidate set (ignored if cell is a given).
  - **`X` / `Backspace` / `Delete` / `0` / `Space`**: Clears both user entry and candidates in the cursor cell (ignored if cell is a given).
  - **`C`**: 1-layer Undo/Redo for the most recent cell edit.
  - **`W` / `A` / `S` / `D`**: Moves cursor 1 step within the active plane in the axis direction closest to screen up / left / down / right (wraps around at grid edges).
  - **`Q` / `E`**: Moves cursor 1 step along the axis perpendicular to the active plane (`Q` = toward left of canvas, `E` = toward right of canvas, with closer/farther fallback when purely vertical; wraps around at grid edges). The bottom legend dynamically displays `Q (Closer) / E (Farther)` or `Q (Farther) / E (Closer)`.
  - **On-Screen Keypads**: Responsive lower-left (`Q W E / A S D / Z X C`) and lower-right (`1 2 3 / 4 5 6 / 7 8 0`) 3×3 touch keypads for mobile/tablet play.
- **Progress Bar, Assistance Mode, Constraint Counter & Win State**:
  - Second bar below the top bar displaying the `Solved` badge (when solved), live Unsatisfied Constraints counter (`0` to `256`), Empty Cells counter (`<A>+<B>/<C>`, where `<A>` is empty cells with no notes, `<B>` is empty cells with notes, and `<C>` is total starting empty cells), and an **Assistance** toggle button.
  - When **Assistance Mode** is enabled:
    - Displays unplaced digits (in 60%-size yellow note font) for the two active-plane rows containing the cursor outside the cube on the end closer to the camera, for the perpendicular shaft under the upper-right inset, and for the 2×2×2 region under the upper-left inset.
    - Highlights duplicate-digit errors (ignoring notes) by turning the outermost line segments on both ends of any duplicate row/column in the active plane red, turning the upper-right inset red if the perpendicular shaft has duplicates, and turning the upper-left inset's outer borders red if the 2×2×2 region has duplicates.
  - When the Unsatisfied Constraints counter reaches `0`, record puzzle as solved in `localStorage` and display a "Solved!" pop-up modal.
