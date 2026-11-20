'use strict';

const assert = require('assert');
const { generatePuzzle, solveDLX, getSymmetricIndices } = require('../lib/dlx');

function countInvalidConstraints(grid) {
  let invalid = 0;

  // 64 rows: fixed (y, z), vary x
  for (let z = 0; z < 8; z++) {
    for (let y = 0; y < 8; y++) {
      let mask = 0;
      for (let x = 0; x < 8; x++) {
        const d = grid[x + y * 8 + z * 64];
        if (d >= 1 && d <= 8) mask |= 1 << (d - 1);
      }
      if (mask !== 0xff) invalid++;
    }
  }

  // 64 cols: fixed (x, z), vary y
  for (let z = 0; z < 8; z++) {
    for (let x = 0; x < 8; x++) {
      let mask = 0;
      for (let y = 0; y < 8; y++) {
        const d = grid[x + y * 8 + z * 64];
        if (d >= 1 && d <= 8) mask |= 1 << (d - 1);
      }
      if (mask !== 0xff) invalid++;
    }
  }

  // 64 shafts: fixed (x, y), vary z
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      let mask = 0;
      for (let z = 0; z < 8; z++) {
        const d = grid[x + y * 8 + z * 64];
        if (d >= 1 && d <= 8) mask |= 1 << (d - 1);
      }
      if (mask !== 0xff) invalid++;
    }
  }

  // 64 regions: 2x2x2
  for (let bz = 0; bz < 4; bz++) {
    for (let by = 0; by < 4; by++) {
      for (let bx = 0; bx < 4; bx++) {
        let mask = 0;
        for (let dz = 0; dz < 2; dz++) {
          for (let dy = 0; dy < 2; dy++) {
            for (let dx = 0; dx < 2; dx++) {
              const x = bx * 2 + dx;
              const y = by * 2 + dy;
              const z = bz * 2 + dz;
              const d = grid[x + y * 8 + z * 64];
              if (d >= 1 && d <= 8) mask |= 1 << (d - 1);
            }
          }
        }
        if (mask !== 0xff) invalid++;
      }
    }
  }

  return invalid;
}

function assertSymmetric(givens, symmetryType) {
  assert.ok(symmetryType >= 0 && symmetryType <= 6, 'symmetryType must be in 0..6');
  for (let i = 0; i < 512; i++) {
    for (const sym of getSymmetricIndices(i, symmetryType)) {
      assert.strictEqual(
        givens[i] !== 0,
        givens[sym] !== 0,
        `Cell ${i} and symmetric cell ${sym} (type ${symmetryType}) must both be given or both blank`
      );
    }
  }
}

const t0 = Date.now();
const p1a = generatePuzzle(1);
const t1 = Date.now();
const p1b = generatePuzzle(1);
assert.deepStrictEqual(p1a, p1b, 'Generation must be deterministic for same seed');
assertSymmetric(p1a.givens, p1a.symmetryType);

const sols = solveDLX(p1a.givens, null, 2);
assert.strictEqual(sols.length, 1, 'Generated puzzle must have a unique solution');
assert.strictEqual(countInvalidConstraints(sols[0]), 0, 'Solution must satisfy all 256 constraints');

const p2 = generatePuzzle(2);
const t2 = Date.now();
assert.notDeepStrictEqual(p1a.givens, p2.givens, 'Different seeds should produce different puzzles');
assertSymmetric(p2.givens, p2.symmetryType);
const sols2 = solveDLX(p2.givens, null, 2);
assert.strictEqual(sols2.length, 1, 'Puzzle 2 must have a unique solution');
assert.strictEqual(countInvalidConstraints(sols2[0]), 0, 'Puzzle 2 solution must satisfy all 256 constraints');

console.log(`Puzzle 1 (sym=${p1a.symmetryType}): ${p1a.givenCount} givens, generated in ${t1 - t0}ms`);
console.log(`Puzzle 2 (sym=${p2.symmetryType}): ${p2.givenCount} givens, generated in ${t2 - t1}ms`);
console.log('All DLX tests passed!');
