'use strict';

const fs = require('fs');
const path = require('path');
const { generatePuzzle } = require('./dlx');

const num = Number(process.argv[2]);
if (!Number.isInteger(num) || num < 1 || num > 2147483647) {
  process.stderr.write('Invalid puzzle number\n');
  process.exit(1);
}

const puzzlesDir = path.join(__dirname, '..', 'puzzles');
if (!fs.existsSync(puzzlesDir)) {
  fs.mkdirSync(puzzlesDir, { recursive: true });
}

const filePath = path.join(puzzlesDir, `${num}.json`);
if (fs.existsSync(filePath)) {
  process.stdout.write(fs.readFileSync(filePath, 'utf8'));
  process.exit(0);
}

const puzzle = generatePuzzle(num);
const json = JSON.stringify(puzzle);
const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
fs.writeFileSync(tmpPath, json);
fs.renameSync(tmpPath, filePath);
process.stdout.write(json);
