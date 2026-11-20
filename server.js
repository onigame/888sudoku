'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { generatePuzzle } = require('./lib/dlx');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const PUZZLES_DIR = path.join(__dirname, 'puzzles');

if (!fs.existsSync(PUZZLES_DIR)) {
  fs.mkdirSync(PUZZLES_DIR, { recursive: true });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function getOrCreatePuzzle(puzzleNumber) {
  const filePath = path.join(PUZZLES_DIR, `${puzzleNumber}.json`);
  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  }

  const puzzle = generatePuzzle(puzzleNumber);
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(puzzle));
  fs.renameSync(tmpPath, filePath);
  return puzzle;
}

const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && (reqUrl.pathname === '/api/puzzle' || reqUrl.pathname === '/api.php')) {
    const numParam = reqUrl.searchParams.get('number') || '1';
    const puzzleNumber = Number(numParam);
    if (!Number.isInteger(puzzleNumber) || puzzleNumber < 1 || puzzleNumber > 2147483647) {
      return sendJson(res, 400, { error: 'Puzzle number must be a positive 32-bit integer.' });
    }

    try {
      const puzzle = getOrCreatePuzzle(puzzleNumber);
      return sendJson(res, 200, puzzle);
    } catch (err) {
      console.error('Error generating puzzle:', err);
      return sendJson(res, 500, { error: 'Failed to generate puzzle.' });
    }
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    return res.end('Method Not Allowed');
  }

  let relPath = reqUrl.pathname === '/' ? '/index.html' : reqUrl.pathname;
  relPath = path.normalize(relPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, relPath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(err.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain' });
      return res.end(err.code === 'ENOENT' ? 'Not Found' : 'Internal Server Error');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(req.method === 'HEAD' ? undefined : content);
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`8x8x8 Sudoku server running at http://localhost:${PORT}`);
  });
}

module.exports = { server, getOrCreatePuzzle };
