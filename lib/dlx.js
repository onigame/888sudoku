'use strict';

/**
 * Mulberry32 deterministic PRNG seeded by a 32-bit integer.
 * Returns a function yielding floats in [0, 1).
 */
function createRng(seed) {
  let a = (seed | 0) ^ 0x9e3779b9;
  a = Math.imul(a ^ (a >>> 16), 0x85ebca6b);
  a = Math.imul(a ^ (a >>> 13), 0xc2b2ae35);
  a = (a ^ (a >>> 16)) >>> 0;

  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rngInt(rng, max) {
  return Math.floor(rng() * max);
}

function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rngInt(rng, i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Generates a random valid 8x8x8 Sudoku solution using an algebraic F_2^3
 * construction followed by random symmetry-preserving permutations.
 */
function generateRandomValidGrid(rng) {
  const digits = [1, 2, 3, 4, 5, 6, 7, 8];
  shuffleInPlace(digits, rng);

  // Permute the 4 blocks along each axis, and randomly flip within each 2-cell block
  const bxPerm = shuffleInPlace([0, 1, 2, 3], rng);
  const byPerm = shuffleInPlace([0, 1, 2, 3], rng);
  const bzPerm = shuffleInPlace([0, 1, 2, 3], rng);

  const dxFlip = [rngInt(rng, 2), rngInt(rng, 2), rngInt(rng, 2), rngInt(rng, 2)];
  const dyFlip = [rngInt(rng, 2), rngInt(rng, 2), rngInt(rng, 2), rngInt(rng, 2)];
  const dzFlip = [rngInt(rng, 2), rngInt(rng, 2), rngInt(rng, 2), rngInt(rng, 2)];

  const grid = new Array(512);
  for (let z = 0; z < 8; z++) {
    const bz = bzPerm[z >> 1];
    const dz = (z & 1) ^ dzFlip[z >> 1];
    for (let y = 0; y < 8; y++) {
      const by = byPerm[y >> 1];
      const dy = (y & 1) ^ dyFlip[y >> 1];
      for (let x = 0; x < 8; x++) {
        const bx = bxPerm[x >> 1];
        const dx = (x & 1) ^ dxFlip[x >> 1];

        const b0 = dx ^ (by & 1) ^ (bz & 1);
        const b1 = dy ^ (bx & 1) ^ ((bz >> 1) & 1);
        const b2 = dz ^ ((bx >> 1) & 1) ^ ((by >> 1) & 1);
        const valIdx = b0 | (b1 << 1) | (b2 << 2);
        grid[x + y * 8 + z * 64] = digits[valIdx];
      }
    }
  }
  return grid;
}

/**
 * Exact-cover DLX solver for 8x8x8 Sudoku.
 * Columns (2560 total):
 *   0..511:    cell (x, y, z)
 *   512..1023: row (y, z, d)
 *   1024..1535: col (x, z, d)
 *   1536..2047: shaft (x, y, d)
 *   2048..2559: 2x2x2 region (bx, by, bz, d)
 *
 * Returns { solutions, aborted }.
 */
function solveDLXWithBudget(givens, rng, maxSolutions = 2, stepBudget = 0) {
  const NUM_COLS = 2560;
  const MAX_NODES = NUM_COLS + 1 + 4096 * 5;
  const L = new Int32Array(MAX_NODES);
  const R = new Int32Array(MAX_NODES);
  const U = new Int32Array(MAX_NODES);
  const D = new Int32Array(MAX_NODES);
  const C = new Int32Array(MAX_NODES);
  const rowCell = new Int16Array(MAX_NODES);
  const rowDigit = new Uint8Array(MAX_NODES);
  const size = new Int32Array(NUM_COLS + 1);

  for (let i = 0; i <= NUM_COLS; i++) {
    L[i] = i - 1;
    R[i] = i + 1;
    U[i] = i;
    D[i] = i;
    C[i] = i;
    size[i] = 0;
  }
  L[0] = NUM_COLS;
  R[NUM_COLS] = 0;

  let nextNode = NUM_COLS + 1;

  function addRow(cellIdx, digit, cols) {
    let first = -1;
    let prev = -1;
    for (let k = 0; k < 5; k++) {
      const colHeader = cols[k] + 1;
      const node = nextNode++;
      C[node] = colHeader;
      rowCell[node] = cellIdx;
      rowDigit[node] = digit;

      const top = colHeader;
      const bottom = U[top];
      D[bottom] = node;
      U[node] = bottom;
      D[node] = top;
      U[top] = node;
      size[colHeader]++;

      if (first === -1) {
        first = node;
        L[node] = node;
        R[node] = node;
      } else {
        R[prev] = node;
        L[node] = prev;
        R[node] = first;
        L[first] = node;
      }
      prev = node;
    }
  }

  function cover(col) {
    R[L[col]] = R[col];
    L[R[col]] = L[col];
    for (let i = D[col]; i !== col; i = D[i]) {
      for (let j = R[i]; j !== i; j = R[j]) {
        D[U[j]] = D[j];
        U[D[j]] = U[j];
        size[C[j]]--;
      }
    }
  }

  function uncover(col) {
    for (let i = U[col]; i !== col; i = U[i]) {
      for (let j = L[i]; j !== i; j = L[j]) {
        size[C[j]]++;
        D[U[j]] = j;
        U[D[j]] = j;
      }
    }
    R[L[col]] = col;
    L[R[col]] = col;
  }

  const candidates = [];
  for (let z = 0; z < 8; z++) {
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const cellIdx = x + y * 8 + z * 64;
        const g = givens[cellIdx];
        if (g >= 1 && g <= 8) {
          candidates.push([x, y, z, cellIdx, g]);
        } else {
          for (let d = 1; d <= 8; d++) {
            candidates.push([x, y, z, cellIdx, d]);
          }
        }
      }
    }
  }

  if (rng) {
    shuffleInPlace(candidates, rng);
  }

  const cols = new Int32Array(5);
  for (let i = 0; i < candidates.length; i++) {
    const [x, y, z, cellIdx, d] = candidates[i];
    const dm = d - 1;
    const bx = x >> 1;
    const by = y >> 1;
    const bz = z >> 1;
    const regIdx = bx + by * 4 + bz * 16;

    cols[0] = cellIdx;
    cols[1] = 512 + (y + z * 8) * 8 + dm;
    cols[2] = 1024 + (x + z * 8) * 8 + dm;
    cols[3] = 1536 + (x + y * 8) * 8 + dm;
    cols[4] = 2048 + regIdx * 8 + dm;

    addRow(cellIdx, d, cols);
  }

  const currentGrid = new Uint8Array(512);
  const solutions = [];
  let steps = 0;
  let aborted = false;

  function search() {
    if (solutions.length >= maxSolutions || aborted) return;
    steps++;
    if (stepBudget > 0 && steps > stepBudget) {
      aborted = true;
      return;
    }

    const firstCol = R[0];
    if (firstCol === 0) {
      solutions.push(Array.from(currentGrid));
      return;
    }

    let bestCol = firstCol;
    let minSize = size[firstCol];
    for (let c = R[firstCol]; c !== 0; c = R[c]) {
      if (size[c] < minSize) {
        minSize = size[c];
        bestCol = c;
        if (minSize === 0) return;
      }
    }

    cover(bestCol);
    for (let r = D[bestCol]; r !== bestCol; r = D[r]) {
      currentGrid[rowCell[r]] = rowDigit[r];
      for (let j = R[r]; j !== r; j = R[j]) {
        cover(C[j]);
      }

      search();

      for (let j = L[r]; j !== r; j = L[j]) {
        uncover(C[j]);
      }
      currentGrid[rowCell[r]] = 0;

      if (solutions.length >= maxSolutions || aborted) break;
    }
    uncover(bestCol);
  }

  search();
  return { solutions, aborted };
}

function solveDLX(givens, rng, maxSolutions = 2) {
  return solveDLXWithBudget(givens, rng, maxSolutions, 0).solutions;
}

/**
 * Returns all cell indices in the symmetry orbit of `idx` for `symmetryType` (0..6).
 *   0: point symmetry across center
 *   1: reflective symmetry across XY plane
 *   2: reflective symmetry across XZ plane
 *   3: 180-deg rotational symmetry around X axis
 *   4: 180-deg rotational symmetry around Y axis
 *   5: 180-deg rotational symmetry around Z axis + reflective symmetry across XY plane (4 cells)
 *   6: 180-deg rotational symmetry around Y axis + reflective symmetry across XZ plane (4 cells)
 */
function getSymmetricIndices(idx, symmetryType) {
  const x = idx & 7;
  const y = (idx >> 3) & 7;
  const z = (idx >> 6) & 7;
  const toIdx = (cx, cy, cz) => cx + cy * 8 + cz * 64;

  switch (symmetryType) {
    case 0:
      return [idx, toIdx(7 - x, 7 - y, 7 - z)];
    case 1:
      return [idx, toIdx(x, y, 7 - z)];
    case 2:
      return [idx, toIdx(x, 7 - y, z)];
    case 3:
      return [idx, toIdx(x, 7 - y, 7 - z)];
    case 4:
      return [idx, toIdx(7 - x, y, 7 - z)];
    case 5:
      return [
        idx,
        toIdx(7 - x, 7 - y, z),
        toIdx(x, y, 7 - z),
        toIdx(7 - x, 7 - y, 7 - z)
      ];
    case 6:
      return [
        idx,
        toIdx(7 - x, y, 7 - z),
        toIdx(x, 7 - y, z),
        toIdx(7 - x, 7 - y, 7 - z)
      ];
    default:
      throw new Error(`Unknown symmetryType: ${symmetryType}`);
  }
}

/**
 * Generates a symmetric 8x8x8 Sudoku puzzle from a numeric seed.
 * Picks a symmetryType in 0..6 at random, adds symmetric groups of givens
 * until DLX proves a unique solution, then adds 0..4 extra symmetric groups.
 */
function generatePuzzle(puzzleNumber) {
  const rng = createRng(puzzleNumber);
  const symmetryType = rngInt(rng, 7); // uniform 0..6 inclusive
  let baseSol = generateRandomValidGrid(rng);
  const givens = new Array(512).fill(0);
  let givenCount = 0;

  function addGivenGroup(idx, sol) {
    for (const symIdx of getSymmetricIndices(idx, symmetryType)) {
      if (givens[symIdx] === 0) {
        givens[symIdx] = sol[symIdx];
        givenCount++;
      }
    }
  }

  const initialCell = rngInt(rng, 512);
  addGivenGroup(initialCell, baseSol);

  while (true) {
    const res = solveDLXWithBudget(givens, rng, 2, 25000);
    if (res.aborted) {
      const emptyCells = [];
      for (let i = 0; i < 512; i++) {
        if (givens[i] === 0) emptyCells.push(i);
      }
      const chosen = emptyCells[rngInt(rng, emptyCells.length)];
      addGivenGroup(chosen, baseSol);
      continue;
    }

    const { solutions } = res;
    if (solutions.length === 0) {
      throw new Error(`Puzzle ${puzzleNumber} became unsolvable during generation.`);
    }
    if (solutions.length === 1) {
      const uniqueSol = solutions[0];
      const extraPairs = rngInt(rng, 5); // uniform 0..4 inclusive
      for (let p = 0; p < extraPairs; p++) {
        const emptyCells = [];
        for (let i = 0; i < 512; i++) {
          if (givens[i] === 0) emptyCells.push(i);
        }
        if (emptyCells.length === 0) break;
        const chosen = emptyCells[rngInt(rng, emptyCells.length)];
        addGivenGroup(chosen, uniqueSol);
      }

      return {
        puzzleNumber,
        symmetryType,
        givens,
        givenCount
      };
    }

    baseSol = solutions[0];
    const solA = solutions[0];
    const solB = solutions[1];
    const diffCells = [];
    for (let i = 0; i < 512; i++) {
      if (solA[i] !== solB[i]) {
        diffCells.push(i);
      }
    }

    const chosenCell = diffCells[rngInt(rng, diffCells.length)];
    addGivenGroup(chosenCell, solA);
  }
}

module.exports = {
  createRng,
  solveDLX,
  generatePuzzle,
  getSymmetricIndices
};
