# Initial Specifications (User Prompt)

- A puzzle is generated from a provided puzzle number (which is used as a seed to a repeatable RNG).
- The puzzle generation algorithm is simple -- put a cell in at random, use DLX to solve the puzzle as an exact cover problem, stop DLX when two solutions are found, find a random cell that's different between the two solutions, add a given in that cell, repeat until solution is unique.
- When a puzzle is generated, save it locally on a file on server and just load it from that file next time it's accessed, so we don't need to generate it again.
- Rules for the variant: divide the grid into 64 distinct 2x2x2 regions, put a digit in each cell in a 8x8x8 grid so that each region, row, column, and shaft in the third dimension has all digits from 1-8.
- User's state is tied to localStorage, should record which puzzles are solved, and what the user has put in the blank cells.
- Interface rules:
  - Cube looks like a drawn 3D cube, with faint lines showing cube edges, and if a cell has a number in it, the number is centered in the cube but always "faces" the solver (that is, the location of the number changes in 3D, but the number is always 2D facing the user).
  - User can hold right mouse button (or hold down Shift) and drag around to change the camera viewpoint of the 8x8x8 cube. Left-right correspond to longitude location of the camera, up-down correspond to latitude direction of the camera (does not go above 90 or below -90).
  - One cell is always the "cursor". The cursor cell is highlighted in a bright color. Whichever 8x8 plane containing the cursor cell that covers the most screen area is called the "active plane". Note that the active plane can change when the camera angle changes.
  - The row and column within the active plane that contains the cursor is highlighted in a less bright color, the other cells of that plane are an even less bright color, and all other cells are faint.
  - The 2x2 edges of the region boundaries within the active plane are drawn thicker.
  - Player can left click on a cell in the active plane to move the cursor to that cell.
  - Player cannot change the contents of given cell numbers.
  - Player can type 1-8 on keyboard to change the contents of the cursor's cell (if it isn't a given cell).
  - Player can type WASD to change cursor location within the active plane (whichever is closest in direction to up-left-down-right on the screen).
  - Player can type Q and E to change cursor location along the axis perpendicular to the active plane (Q for "closer to camera", E for "farther from camera").
  - A counter is shown on the screen indicating how many of the 256 constraints are currently incorrect (do not contain all digits from 1-8). When the counter reaches 0, the puzzle is solved and there is a small fanfare (probably just a pop-up box saying "Solved!").
  - Various "nice to have" UI features to aid in user experience; don't implement them in the first pass, but record ideas in an `*.md` file for future consideration.
