(() => {
  'use strict';

  const canvas = document.getElementById('cube-canvas');
  const ctx = canvas.getContext('2d');
  const puzzleForm = document.getElementById('puzzle-form');
  const puzzleInput = document.getElementById('puzzle-input');
  const invalidCountEl = document.getElementById('invalid-count');
  const counterWrapper = invalidCountEl.closest('.counter');
  const planeInfoEl = document.getElementById('plane-info');
  const depthLegendEl = document.getElementById('depth-legend');
  const modeIndicatorEl = document.getElementById('mode-indicator');
  const btnModeZ = document.getElementById('btn-mode-z');
  const solvedBadgeEl = document.getElementById('solved-badge');
  const loadingOverlay = document.getElementById('loading-overlay');
  const loadingText = document.getElementById('loading-text');
  const solvedModal = document.getElementById('solved-modal');
  const solvedMessage = document.getElementById('solved-message');
  const closeSolvedBtn = document.getElementById('close-solved-btn');
  const resetBtn = document.getElementById('reset-btn');
  const resetModal = document.getElementById('reset-modal');
  const resetMessage = document.getElementById('reset-message');
  const cancelResetBtn = document.getElementById('cancel-reset-btn');
  const confirmResetBtn = document.getElementById('confirm-reset-btn');

  // Game state
  let puzzleNumber = 1;
  let givens = new Uint8Array(512);
  let entries = new Uint8Array(512);
  let candidates = new Uint8Array(512);
  let cursor = { x: 3, y: 3, z: 3 };
  let isSolved = false;
  let baseCandidateMode = false;
  let shiftHeld = false;
  let lastEdit = null;

  function isCandidateMode() {
    return shiftHeld ? !baseCandidateMode : baseCandidateMode;
  }

  function updateModeUI() {
    const cand = isCandidateMode();
    modeIndicatorEl.textContent = cand ? 'Mode: Candidate' : 'Mode: Entry';
    modeIndicatorEl.classList.toggle('candidate', cand);
    btnModeZ.classList.toggle('active', cand);
  }

  function formatCandidates(mask) {
    let s = '';
    for (let d = 1; d <= 8; d++) {
      if (mask & (1 << (d - 1))) s += d;
    }
    return s;
  }

  // Camera state (spherical coordinates around origin)
  const camera = {
    lon: 0.65,
    lat: 0.45,
    distance: 19
  };

  // Drag state
  let isDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  // LocalStorage keys
  const SOLVED_KEY = 'sudoku888_solved';
  function puzzleStorageKey(num) {
    return `sudoku888_puzzle_${num}`;
  }

  function getSolvedSet() {
    try {
      const raw = localStorage.getItem(SOLVED_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  }

  function markPuzzleSolved(num) {
    const solved = getSolvedSet();
    solved.add(num);
    try {
      localStorage.setItem(SOLVED_KEY, JSON.stringify(Array.from(solved)));
    } catch {
      // Ignore storage quota errors
    }
  }

  function loadUserEntries(num) {
    entries.fill(0);
    candidates.fill(0);
    try {
      const raw = localStorage.getItem(puzzleStorageKey(num));
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && data.entries) {
        for (const [k, v] of Object.entries(data.entries)) {
          const idx = Number(k);
          const val = Number(v);
          if (idx >= 0 && idx < 512 && givens[idx] === 0 && val >= 1 && val <= 8) {
            entries[idx] = val;
          }
        }
      }
      if (data && data.candidates) {
        for (const [k, v] of Object.entries(data.candidates)) {
          const idx = Number(k);
          const mask = Number(v);
          if (idx >= 0 && idx < 512 && givens[idx] === 0 && entries[idx] === 0 && mask >= 1 && mask <= 255) {
            candidates[idx] = mask;
          }
        }
      }
    } catch {
      // Ignore malformed storage
    }
  }

  function saveUserEntries() {
    const sparseEntries = {};
    const sparseCandidates = {};
    for (let i = 0; i < 512; i++) {
      if (givens[i] === 0) {
        if (entries[i] !== 0) {
          sparseEntries[i] = entries[i];
        } else if (candidates[i] !== 0) {
          sparseCandidates[i] = candidates[i];
        }
      }
    }
    try {
      localStorage.setItem(
        puzzleStorageKey(puzzleNumber),
        JSON.stringify({ entries: sparseEntries, candidates: sparseCandidates })
      );
    } catch {
      // Ignore storage quota errors
    }
  }

  function cellIndex(x, y, z) {
    return x + y * 8 + z * 64;
  }

  function getCellValue(x, y, z) {
    const idx = cellIndex(x, y, z);
    return givens[idx] !== 0 ? givens[idx] : entries[idx];
  }

  // Count how many of the 256 constraints do not contain all digits 1..8
  function countInvalidConstraints() {
    let invalid = 0;

    // 64 rows: fixed (y, z), vary x
    for (let z = 0; z < 8; z++) {
      for (let y = 0; y < 8; y++) {
        let mask = 0;
        for (let x = 0; x < 8; x++) {
          const d = getCellValue(x, y, z);
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
          const d = getCellValue(x, y, z);
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
          const d = getCellValue(x, y, z);
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
                const d = getCellValue(bx * 2 + dx, by * 2 + dy, bz * 2 + dz);
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

  function updateStatus(triggerFanfare = false) {
    const invalid = countInvalidConstraints();
    invalidCountEl.textContent = String(invalid);
    if (invalid === 0) {
      counterWrapper.classList.add('complete');
      solvedBadgeEl.classList.remove('hidden');
      if (!isSolved && triggerFanfare) {
        isSolved = true;
        markPuzzleSolved(puzzleNumber);
        solvedMessage.textContent = `You solved Puzzle #${puzzleNumber} with all 256 constraints satisfied!`;
        solvedModal.classList.remove('hidden');
      } else {
        isSolved = true;
        markPuzzleSolved(puzzleNumber);
      }
    } else {
      counterWrapper.classList.remove('complete');
      const solvedSet = getSolvedSet();
      if (solvedSet.has(puzzleNumber)) {
        solvedBadgeEl.classList.remove('hidden');
      } else {
        solvedBadgeEl.classList.add('hidden');
      }
    }
  }

  // Vector helpers
  function dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  function cross(a, b) {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    };
  }

  function normalize(v) {
    const len = Math.hypot(v.x, v.y, v.z) || 1;
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  }

  function getCameraBasis() {
    const cosLat = Math.cos(camera.lat);
    const sinLat = Math.sin(camera.lat);
    const cosLon = Math.cos(camera.lon);
    const sinLon = Math.sin(camera.lon);

    const pos = {
      x: camera.distance * cosLat * sinLon,
      y: camera.distance * sinLat,
      z: camera.distance * cosLat * cosLon
    };

    const forward = normalize({ x: -pos.x, y: -pos.y, z: -pos.z });
    // Analytical horizontal right vector avoids gimbal lock near +/-90 deg latitude
    const right = { x: cosLon, y: 0, z: -sinLon };
    const up = cross(right, forward);

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const focal = Math.min(width, height) * 1.45;

    return { pos, forward, right, up, width, height, focal };
  }

  function project(pt, cam) {
    const rx = pt.x - cam.pos.x;
    const ry = pt.y - cam.pos.y;
    const rz = pt.z - cam.pos.z;
    const vx = dot({ x: rx, y: ry, z: rz }, cam.right);
    const vy = dot({ x: rx, y: ry, z: rz }, cam.up);
    const vz = dot({ x: rx, y: ry, z: rz }, cam.forward);
    const invZ = 1 / Math.max(vz, 0.1);
    return {
      x: cam.width * 0.5 + vx * invZ * cam.focal,
      y: cam.height * 0.5 - vy * invZ * cam.focal,
      vz
    };
  }

  function polygonArea2D(pts) {
    let sum = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      sum += a.x * b.y - b.x * a.y;
    }
    return Math.abs(sum) * 0.5;
  }

  function getActivePlane(cam) {
    const planes = [
      {
        name: 'XY',
        label: `XY (Z=${cursor.z + 1})`,
        fixedAxis: 'z',
        fixedVal: cursor.z,
        normal: { x: 0, y: 0, z: 1 },
        uAxis: { x: 1, y: 0, z: 0 },
        vAxis: { x: 0, y: 1, z: 0 },
        corners: [
          { x: -4, y: -4, z: cursor.z - 3.5 },
          { x: 4, y: -4, z: cursor.z - 3.5 },
          { x: 4, y: 4, z: cursor.z - 3.5 },
          { x: -4, y: 4, z: cursor.z - 3.5 }
        ]
      },
      {
        name: 'XZ',
        label: `XZ (Y=${cursor.y + 1})`,
        fixedAxis: 'y',
        fixedVal: cursor.y,
        normal: { x: 0, y: 1, z: 0 },
        uAxis: { x: 1, y: 0, z: 0 },
        vAxis: { x: 0, y: 0, z: 1 },
        corners: [
          { x: -4, y: cursor.y - 3.5, z: -4 },
          { x: 4, y: cursor.y - 3.5, z: -4 },
          { x: 4, y: cursor.y - 3.5, z: 4 },
          { x: -4, y: cursor.y - 3.5, z: 4 }
        ]
      },
      {
        name: 'YZ',
        label: `YZ (X=${cursor.x + 1})`,
        fixedAxis: 'x',
        fixedVal: cursor.x,
        normal: { x: 1, y: 0, z: 0 },
        uAxis: { x: 0, y: 1, z: 0 },
        vAxis: { x: 0, y: 0, z: 1 },
        corners: [
          { x: cursor.x - 3.5, y: -4, z: -4 },
          { x: cursor.x - 3.5, y: 4, z: -4 },
          { x: cursor.x - 3.5, y: 4, z: 4 },
          { x: cursor.x - 3.5, y: -4, z: 4 }
        ]
      }
    ];

    let best = planes[0];
    let bestArea = -1;
    for (const p of planes) {
      const projected = p.corners.map((c) => project(c, cam));
      const area = polygonArea2D(projected);
      if (area > bestArea) {
        bestArea = area;
        best = p;
      }
    }
    return best;
  }

  function planeCellCoords(plane, u, v) {
    if (plane.name === 'XY') return { x: u, y: v, z: cursor.z };
    if (plane.name === 'XZ') return { x: u, y: cursor.y, z: v };
    return { x: cursor.x, y: u, z: v };
  }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function render() {
    resizeCanvas();
    const cam = getCameraBasis();
    const activePlane = getActivePlane(cam);
    planeInfoEl.textContent = `Active Plane: ${activePlane.label}`;

    ctx.clearRect(0, 0, cam.width, cam.height);

    // 1. Faint 3D grid lines for the 8x8x8 cube
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.10)';
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      for (let j = 0; j <= 8; j++) {
        // Lines along X
        const ax0 = project({ x: -4, y: i - 4, z: j - 4 }, cam);
        const ax1 = project({ x: 4, y: i - 4, z: j - 4 }, cam);
        ctx.moveTo(ax0.x, ax0.y);
        ctx.lineTo(ax1.x, ax1.y);

        // Lines along Y
        const ay0 = project({ x: i - 4, y: -4, z: j - 4 }, cam);
        const ay1 = project({ x: i - 4, y: 4, z: j - 4 }, cam);
        ctx.moveTo(ay0.x, ay0.y);
        ctx.lineTo(ay1.x, ay1.y);

        // Lines along Z
        const az0 = project({ x: i - 4, y: j - 4, z: -4 }, cam);
        const az1 = project({ x: i - 4, y: j - 4, z: 4 }, cam);
        ctx.moveTo(az0.x, az0.y);
        ctx.lineTo(az1.x, az1.y);
      }
    }
    ctx.stroke();

    // Outer cube boundary slightly clearer
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
    ctx.beginPath();
    for (const i of [0, 8]) {
      for (const j of [0, 8]) {
        const ax0 = project({ x: -4, y: i - 4, z: j - 4 }, cam);
        const ax1 = project({ x: 4, y: i - 4, z: j - 4 }, cam);
        ctx.moveTo(ax0.x, ax0.y);
        ctx.lineTo(ax1.x, ax1.y);

        const ay0 = project({ x: i - 4, y: -4, z: j - 4 }, cam);
        const ay1 = project({ x: i - 4, y: 4, z: j - 4 }, cam);
        ctx.moveTo(ay0.x, ay0.y);
        ctx.lineTo(ay1.x, ay1.y);

        const az0 = project({ x: i - 4, y: j - 4, z: -4 }, cam);
        const az1 = project({ x: i - 4, y: j - 4, z: 4 }, cam);
        ctx.moveTo(az0.x, az0.y);
        ctx.lineTo(az1.x, az1.y);
      }
    }
    ctx.stroke();

    // 2. Active plane cell quads (even less bright for plane, less bright for row/col, bright for cursor)
    const cursorU = activePlane.name === 'YZ' ? cursor.y : cursor.x;
    const cursorV = activePlane.name === 'XY' ? cursor.y : cursor.z;

    for (let u = 0; u < 8; u++) {
      for (let v = 0; v < 8; v++) {
        const c = planeCellCoords(activePlane, u, v);
        const cx = c.x - 3.5;
        const cy = c.y - 3.5;
        const cz = c.z - 3.5;

        const p00 = project({
          x: cx - 0.5 * activePlane.uAxis.x - 0.5 * activePlane.vAxis.x,
          y: cy - 0.5 * activePlane.uAxis.y - 0.5 * activePlane.vAxis.y,
          z: cz - 0.5 * activePlane.uAxis.z - 0.5 * activePlane.vAxis.z
        }, cam);
        const p10 = project({
          x: cx + 0.5 * activePlane.uAxis.x - 0.5 * activePlane.vAxis.x,
          y: cy + 0.5 * activePlane.uAxis.y - 0.5 * activePlane.vAxis.y,
          z: cz + 0.5 * activePlane.uAxis.z - 0.5 * activePlane.vAxis.z
        }, cam);
        const p11 = project({
          x: cx + 0.5 * activePlane.uAxis.x + 0.5 * activePlane.vAxis.x,
          y: cy + 0.5 * activePlane.uAxis.y + 0.5 * activePlane.vAxis.y,
          z: cz + 0.5 * activePlane.uAxis.z + 0.5 * activePlane.vAxis.z
        }, cam);
        const p01 = project({
          x: cx - 0.5 * activePlane.uAxis.x + 0.5 * activePlane.vAxis.x,
          y: cy - 0.5 * activePlane.uAxis.y + 0.5 * activePlane.vAxis.y,
          z: cz - 0.5 * activePlane.uAxis.z + 0.5 * activePlane.vAxis.z
        }, cam);

        const isCursor = u === cursorU && v === cursorV;
        const isRowOrCol = u === cursorU || v === cursorV;

        ctx.beginPath();
        ctx.moveTo(p00.x, p00.y);
        ctx.lineTo(p10.x, p10.y);
        ctx.lineTo(p11.x, p11.y);
        ctx.lineTo(p01.x, p01.y);
        ctx.closePath();

        if (isCursor) {
          ctx.fillStyle = 'rgba(250, 204, 21, 0.36)';
          ctx.strokeStyle = 'rgba(253, 224, 71, 0.95)';
          ctx.lineWidth = 2;
        } else if (isRowOrCol) {
          ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
          ctx.strokeStyle = 'rgba(125, 211, 252, 0.42)';
          ctx.lineWidth = 1;
        } else {
          ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
          ctx.lineWidth = 1;
        }
        ctx.fill();
        ctx.stroke();
      }
    }

    // 3. Thicker 2x2 region boundaries within the active plane
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.72)';
    ctx.beginPath();
    const fixedCoord = activePlane.fixedVal - 3.5;
    for (let k = 0; k <= 8; k += 2) {
      // Line along u
      const u0 = -4;
      const u1 = 4;
      const vCoord = k - 4;
      let a, b;
      if (activePlane.name === 'XY') {
        a = { x: u0, y: vCoord, z: fixedCoord };
        b = { x: u1, y: vCoord, z: fixedCoord };
      } else if (activePlane.name === 'XZ') {
        a = { x: u0, y: fixedCoord, z: vCoord };
        b = { x: u1, y: fixedCoord, z: vCoord };
      } else {
        a = { x: fixedCoord, y: u0, z: vCoord };
        b = { x: fixedCoord, y: u1, z: vCoord };
      }
      const pa = project(a, cam);
      const pb = project(b, cam);
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);

      // Line along v
      const uCoord = k - 4;
      const v0 = -4;
      const v1 = 4;
      if (activePlane.name === 'XY') {
        a = { x: uCoord, y: v0, z: fixedCoord };
        b = { x: uCoord, y: v1, z: fixedCoord };
      } else if (activePlane.name === 'XZ') {
        a = { x: uCoord, y: fixedCoord, z: v0 };
        b = { x: uCoord, y: fixedCoord, z: v1 };
      } else {
        a = { x: fixedCoord, y: uCoord, z: v0 };
        b = { x: fixedCoord, y: uCoord, z: v1 };
      }
      const pc = project(a, cam);
      const pd = project(b, cam);
      ctx.moveTo(pc.x, pc.y);
      ctx.lineTo(pd.x, pd.y);
    }
    ctx.stroke();

    // 4. Render all non-zero digits and candidate strings back-to-front, always 2D facing the user
    const digitItems = [];
    for (let z = 0; z < 8; z++) {
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const idx = cellIndex(x, y, z);
          const g = givens[idx];
          const e = entries[idx];
          const val = g !== 0 ? g : e;
          const candMask = val === 0 ? candidates[idx] : 0;
          if (val === 0 && candMask === 0) continue;

          const p = project({ x: x - 3.5, y: y - 3.5, z: z - 3.5 }, cam);
          const inPlane =
            (activePlane.name === 'XY' && z === cursor.z) ||
            (activePlane.name === 'XZ' && y === cursor.y) ||
            (activePlane.name === 'YZ' && x === cursor.x);
          const isCursor = x === cursor.x && y === cursor.y && z === cursor.z;
          const isRowOrCol =
            inPlane &&
            ((activePlane.name === 'XY' && (x === cursor.x || y === cursor.y)) ||
              (activePlane.name === 'XZ' && (x === cursor.x || z === cursor.z)) ||
              (activePlane.name === 'YZ' && (y === cursor.y || z === cursor.z)));

          digitItems.push({
            val,
            candText: candMask !== 0 ? formatCandidates(candMask) : '',
            isGiven: g !== 0,
            inPlane,
            isCursor,
            isRowOrCol,
            sx: p.x,
            sy: p.y,
            vz: p.vz
          });
        }
      }
    }

    digitItems.sort((a, b) => b.vz - a.vz);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const item of digitItems) {
      const baseFontSize = Math.max(11, Math.min(26, (cam.focal / item.vz) * 0.48));
      if (item.val === 0) {
        const candSize = baseFontSize * 0.6;
        ctx.font = `600 ${candSize.toFixed(1)}px system-ui, sans-serif`;
        if (item.isCursor) {
          ctx.fillStyle = '#fef08a';
        } else if (item.isRowOrCol) {
          ctx.fillStyle = 'rgba(250, 204, 21, 0.95)';
        } else if (item.inPlane) {
          ctx.fillStyle = 'rgba(250, 204, 21, 0.82)';
        } else {
          ctx.fillStyle = 'rgba(250, 204, 21, 0.09)';
        }
        ctx.fillText(item.candText, item.sx, item.sy);
        continue;
      }

      ctx.font = `${item.isGiven ? '700' : '500'} ${baseFontSize.toFixed(1)}px system-ui, sans-serif`;

      if (item.isCursor) {
        ctx.fillStyle = item.isGiven ? '#fef08a' : '#7dd3fc';
      } else if (item.isRowOrCol) {
        ctx.fillStyle = item.isGiven ? 'rgba(248, 250, 252, 0.96)' : 'rgba(56, 189, 248, 0.96)';
      } else if (item.inPlane) {
        ctx.fillStyle = item.isGiven ? 'rgba(226, 232, 240, 0.85)' : 'rgba(56, 189, 248, 0.82)';
      } else {
        ctx.fillStyle = item.isGiven ? 'rgba(203, 213, 225, 0.10)' : 'rgba(56, 189, 248, 0.09)';
      }

      ctx.fillText(String(item.val), item.sx, item.sy);
    }

    renderRegionInset(cam);
    renderShaftInset(cam, activePlane);

    const stepQ = getPerpendicularStepQ(cam, activePlane);
    const qIsCloser = stepQ * dot(activePlane.normal, cam.forward) < 0;
    depthLegendEl.innerHTML = qIsCloser
      ? '<strong>Move Depth:</strong> Q (Closer) / E (Farther)'
      : '<strong>Move Depth:</strong> Q (Farther) / E (Closer)';
  }

  function projectInset(offset, centerX, centerY, scaleFactor, cam) {
    const vx = dot(offset, cam.right) * scaleFactor;
    const vy = dot(offset, cam.up) * scaleFactor;
    const vz = camera.distance + dot(offset, cam.forward) * scaleFactor;
    const invZ = 1 / Math.max(vz, 0.1);
    return {
      x: centerX + vx * invZ * cam.focal,
      y: centerY - vy * invZ * cam.focal,
      vz
    };
  }

  function renderRegionInset(cam) {
    const scale = cam.focal / camera.distance;
    const pad = Math.min(cam.width, cam.height) * 0.03 + 1.85 * scale;
    const cx = pad;
    const cy = pad;

    const bx = cursor.x >> 1;
    const by = cursor.y >> 1;
    const bz = cursor.z >> 1;

    // Interior grid lines at low opacity
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.beginPath();
    for (const a of [-1, 0, 1]) {
      for (const b of [-1, 0, 1]) {
        if (a !== 0 && b !== 0) continue; // outer 12 edges drawn separately
        let p0 = projectInset({ x: -1, y: a, z: b }, cx, cy, 1, cam);
        let p1 = projectInset({ x: 1, y: a, z: b }, cx, cy, 1, cam);
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);

        p0 = projectInset({ x: a, y: -1, z: b }, cx, cy, 1, cam);
        p1 = projectInset({ x: a, y: 1, z: b }, cx, cy, 1, cam);
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);

        p0 = projectInset({ x: a, y: b, z: -1 }, cx, cy, 1, cam);
        p1 = projectInset({ x: a, y: b, z: 1 }, cx, cy, 1, cam);
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
      }
    }
    ctx.stroke();

    // Outside 12 edges at full opacity
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.95)';
    ctx.beginPath();
    for (const a of [-1, 1]) {
      for (const b of [-1, 1]) {
        let p0 = projectInset({ x: -1, y: a, z: b }, cx, cy, 1, cam);
        let p1 = projectInset({ x: 1, y: a, z: b }, cx, cy, 1, cam);
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);

        p0 = projectInset({ x: a, y: -1, z: b }, cx, cy, 1, cam);
        p1 = projectInset({ x: a, y: 1, z: b }, cx, cy, 1, cam);
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);

        p0 = projectInset({ x: a, y: b, z: -1 }, cx, cy, 1, cam);
        p1 = projectInset({ x: a, y: b, z: 1 }, cx, cy, 1, cam);
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
      }
    }
    ctx.stroke();

    // Digits and candidate strings inside the 2x2x2 region at full opacity
    const items = [];
    for (let dz = 0; dz < 2; dz++) {
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const gx = bx * 2 + dx;
          const gy = by * 2 + dy;
          const gz = bz * 2 + dz;
          const idx = cellIndex(gx, gy, gz);
          const g = givens[idx];
          const e = entries[idx];
          const val = g !== 0 ? g : e;
          const candMask = val === 0 ? candidates[idx] : 0;
          if (val === 0 && candMask === 0) continue;

          const p = projectInset({ x: dx - 0.5, y: dy - 0.5, z: dz - 0.5 }, cx, cy, 1, cam);
          const isCursor = gx === cursor.x && gy === cursor.y && gz === cursor.z;
          items.push({
            val,
            candText: candMask !== 0 ? formatCandidates(candMask) : '',
            isGiven: g !== 0,
            isCursor,
            sx: p.x,
            sy: p.y,
            vz: p.vz
          });
        }
      }
    }

    items.sort((a, b) => b.vz - a.vz);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const item of items) {
      const baseFontSize = Math.max(11, Math.min(26, (cam.focal / item.vz) * 0.48));
      if (item.val === 0) {
        const candSize = baseFontSize * 0.6;
        ctx.font = `600 ${candSize.toFixed(1)}px system-ui, sans-serif`;
        ctx.fillStyle = item.isCursor ? '#fef08a' : '#facc15';
        ctx.fillText(item.candText, item.sx, item.sy);
        continue;
      }

      ctx.font = `${item.isGiven ? '700' : '500'} ${baseFontSize.toFixed(1)}px system-ui, sans-serif`;
      if (item.isCursor) {
        ctx.fillStyle = item.isGiven ? '#fef08a' : '#7dd3fc';
      } else {
        ctx.fillStyle = item.isGiven ? '#f8fafc' : '#38bdf8';
      }
      ctx.fillText(String(item.val), item.sx, item.sy);
    }
  }

  function renderShaftInset(cam, activePlane) {
    const scale = cam.focal / camera.distance;
    const shaftScaleFactor = 0.4; // 2/5 scale
    const pad = Math.min(cam.width, cam.height) * 0.03 + 1.75 * scale;
    const cx = cam.width - pad;
    const cy = pad;
    const n = activePlane.normal;

    // Single low-opacity line connecting the shaft positions
    const startPt = projectInset({ x: -3.5 * n.x, y: -3.5 * n.y, z: -3.5 * n.z }, cx, cy, shaftScaleFactor, cam);
    const endPt = projectInset({ x: 3.5 * n.x, y: 3.5 * n.y, z: 3.5 * n.z }, cx, cy, shaftScaleFactor, cam);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.beginPath();
    ctx.moveTo(startPt.x, startPt.y);
    ctx.lineTo(endPt.x, endPt.y);
    ctx.stroke();

    // Digits, candidate strings, and cyan dots for empty cells along the shaft at full opacity
    const items = [];
    for (let i = 0; i < 8; i++) {
      const gx = activePlane.fixedAxis === 'x' ? i : cursor.x;
      const gy = activePlane.fixedAxis === 'y' ? i : cursor.y;
      const gz = activePlane.fixedAxis === 'z' ? i : cursor.z;
      const idx = cellIndex(gx, gy, gz);
      const g = givens[idx];
      const e = entries[idx];
      const val = g !== 0 ? g : e;
      const candMask = val === 0 ? candidates[idx] : 0;

      const d = i - 3.5;
      const p = projectInset({ x: d * n.x, y: d * n.y, z: d * n.z }, cx, cy, shaftScaleFactor, cam);
      const isCursor = i === cursor[activePlane.fixedAxis];
      items.push({
        val,
        candText: candMask !== 0 ? formatCandidates(candMask) : '',
        isGiven: g !== 0,
        isCursor,
        sx: p.x,
        sy: p.y,
        vz: p.vz
      });
    }

    items.sort((a, b) => b.vz - a.vz);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const item of items) {
      if (item.val === 0 && !item.candText) {
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath();
        ctx.arc(item.sx, item.sy, 3.2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      const baseFontSize = Math.max(11, Math.min(20, (cam.focal / item.vz) * 0.36));
      if (item.val === 0) {
        const candSize = baseFontSize * 0.6;
        ctx.font = `600 ${candSize.toFixed(1)}px system-ui, sans-serif`;
        ctx.fillStyle = item.isCursor ? '#fef08a' : '#facc15';
        ctx.fillText(item.candText, item.sx, item.sy);
        continue;
      }

      ctx.font = `${item.isGiven ? '700' : '500'} ${baseFontSize.toFixed(1)}px system-ui, sans-serif`;
      if (item.isCursor) {
        ctx.fillStyle = item.isGiven ? '#fef08a' : '#7dd3fc';
      } else {
        ctx.fillStyle = item.isGiven ? '#f8fafc' : '#38bdf8';
      }
      ctx.fillText(String(item.val), item.sx, item.sy);
    }
  }

  // Ray-plane intersection for left-clicking a cell in the active plane
  function selectCellAtMouse(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    const cam = getCameraBasis();
    const activePlane = getActivePlane(cam);

    const rx = (mx - cam.width * 0.5) / cam.focal;
    const ry = -(my - cam.height * 0.5) / cam.focal;
    const dir = normalize({
      x: rx * cam.right.x + ry * cam.up.x + cam.forward.x,
      y: rx * cam.right.y + ry * cam.up.y + cam.forward.y,
      z: rx * cam.right.z + ry * cam.up.z + cam.forward.z
    });

    const denom = dot(dir, activePlane.normal);
    if (Math.abs(denom) < 1e-6) return;

    const planeOffset = activePlane.fixedVal - 3.5;
    const t = (planeOffset - dot(cam.pos, activePlane.normal)) / denom;
    if (t <= 0) return;

    const hit = {
      x: cam.pos.x + t * dir.x,
      y: cam.pos.y + t * dir.y,
      z: cam.pos.z + t * dir.z
    };

    const gx = Math.floor(hit.x + 4);
    const gy = Math.floor(hit.y + 4);
    const gz = Math.floor(hit.z + 4);

    if (activePlane.name === 'XY' && gx >= 0 && gx < 8 && gy >= 0 && gy < 8) {
      cursor.x = gx;
      cursor.y = gy;
    } else if (activePlane.name === 'XZ' && gx >= 0 && gx < 8 && gz >= 0 && gz < 8) {
      cursor.x = gx;
      cursor.z = gz;
    } else if (activePlane.name === 'YZ' && gy >= 0 && gy < 8 && gz >= 0 && gz < 8) {
      cursor.y = gy;
      cursor.z = gz;
    }
    render();
  }

  // Move cursor within active plane using WASD
  function moveInActivePlane(targetScreenX, targetScreenY) {
    const cam = getCameraBasis();
    const activePlane = getActivePlane(cam);

    const p0 = project(
      { x: cursor.x - 3.5, y: cursor.y - 3.5, z: cursor.z - 3.5 },
      cam
    );
    const pu = project(
      {
        x: cursor.x - 3.5 + activePlane.uAxis.x,
        y: cursor.y - 3.5 + activePlane.uAxis.y,
        z: cursor.z - 3.5 + activePlane.uAxis.z
      },
      cam
    );
    const pv = project(
      {
        x: cursor.x - 3.5 + activePlane.vAxis.x,
        y: cursor.y - 3.5 + activePlane.vAxis.y,
        z: cursor.z - 3.5 + activePlane.vAxis.z
      },
      cam
    );

    const suLen = Math.hypot(pu.x - p0.x, pu.y - p0.y) || 1;
    const svLen = Math.hypot(pv.x - p0.x, pv.y - p0.y) || 1;

    const su = { x: (pu.x - p0.x) / suLen, y: (pu.y - p0.y) / suLen };
    const sv = { x: (pv.x - p0.x) / svLen, y: (pv.y - p0.y) / svLen };

    const candidates = [
      { vec: activePlane.uAxis, score: su.x * targetScreenX + su.y * targetScreenY },
      {
        vec: { x: -activePlane.uAxis.x, y: -activePlane.uAxis.y, z: -activePlane.uAxis.z },
        score: -su.x * targetScreenX - su.y * targetScreenY
      },
      { vec: activePlane.vAxis, score: sv.x * targetScreenX + sv.y * targetScreenY },
      {
        vec: { x: -activePlane.vAxis.x, y: -activePlane.vAxis.y, z: -activePlane.vAxis.z },
        score: -sv.x * targetScreenX - sv.y * targetScreenY
      }
    ];

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0].vec;
    cursor.x = Math.max(0, Math.min(7, cursor.x + best.x));
    cursor.y = Math.max(0, Math.min(7, cursor.y + best.y));
    cursor.z = Math.max(0, Math.min(7, cursor.z + best.z));
    render();
  }

  function getPerpendicularStepQ(cam, activePlane) {
    const rx = dot(activePlane.normal, cam.right);
    if (Math.abs(rx) >= 1e-4) {
      return rx > 0 ? -1 : 1;
    }
    const f = dot(activePlane.normal, cam.forward);
    return f >= 0 ? -1 : 1;
  }

  // Move cursor perpendicular to active plane: Q = left on canvas, E = right on canvas
  function movePerpendicular(moveRight) {
    const cam = getCameraBasis();
    const activePlane = getActivePlane(cam);
    const stepQ = getPerpendicularStepQ(cam, activePlane);
    const step = moveRight ? -stepQ : stepQ;
    cursor[activePlane.fixedAxis] = Math.max(
      0,
      Math.min(7, cursor[activePlane.fixedAxis] + step)
    );
    render();
  }

  // Mouse & keyboard events
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 2 || (e.button === 0 && e.shiftKey)) {
      isDragging = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      return;
    }
    if (e.button === 0) {
      selectCellAtMouse(e.clientX, e.clientY);
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    camera.lon -= dx * 0.008;
    const maxLat = Math.PI / 2 - 0.001;
    camera.lat = Math.max(-maxLat, Math.min(maxLat, camera.lat + dy * 0.008));
    render();
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  function applyDigit(digit) {
    const idx = cellIndex(cursor.x, cursor.y, cursor.z);
    if (givens[idx] !== 0) return;

    if (digit === 0) {
      clearCurrentCell();
      return;
    }

    const prevEntry = entries[idx];
    const prevCand = candidates[idx];

    if (isCandidateMode()) {
      const nextCand = prevCand ^ (1 << (digit - 1));
      if (prevEntry === 0 && nextCand === prevCand) return;
      lastEdit = { idx, entry: prevEntry, cand: prevCand };
      entries[idx] = 0;
      candidates[idx] = nextCand;
      saveUserEntries();
      if (prevEntry !== 0) updateStatus(false);
      render();
    } else {
      if (prevEntry === digit && prevCand === 0) return;
      lastEdit = { idx, entry: prevEntry, cand: prevCand };
      entries[idx] = digit;
      candidates[idx] = 0;
      saveUserEntries();
      updateStatus(true);
      render();
    }
  }

  function clearCurrentCell() {
    const idx = cellIndex(cursor.x, cursor.y, cursor.z);
    if (givens[idx] !== 0) return;
    if (entries[idx] === 0 && candidates[idx] === 0) return;

    lastEdit = { idx, entry: entries[idx], cand: candidates[idx] };
    entries[idx] = 0;
    candidates[idx] = 0;
    saveUserEntries();
    updateStatus(false);
    render();
  }

  function undoRedo() {
    if (!lastEdit) return;
    const { idx, entry, cand } = lastEdit;
    if (givens[idx] !== 0) return;

    lastEdit = { idx, entry: entries[idx], cand: candidates[idx] };
    entries[idx] = entry;
    candidates[idx] = cand;
    saveUserEntries();
    updateStatus(true);
    render();
  }

  function toggleBaseMode() {
    baseCandidateMode = !baseCandidateMode;
    updateModeUI();
  }

  function extractDigitFromKeyEvent(e) {
    if (e.key >= '0' && e.key <= '8') return Number(e.key);
    if (e.code && (e.code.startsWith('Digit') || e.code.startsWith('Numpad'))) {
      const n = Number(e.code.slice(-1));
      if (n >= 0 && n <= 8) return n;
    }
    return null;
  }

  // Touch events on canvas for 1-finger orbit rotation and tap-to-select
  let touchDragging = false;
  let touchMoved = false;
  let touchStartX = 0;
  let touchStartY = 0;

  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    const t = e.touches[0];
    touchDragging = true;
    touchMoved = false;
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    lastMouseX = t.clientX;
    lastMouseY = t.clientY;
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    if (!touchDragging || e.touches.length !== 1) return;
    e.preventDefault();
    const t = e.touches[0];
    const dx = t.clientX - lastMouseX;
    const dy = t.clientY - lastMouseY;
    lastMouseX = t.clientX;
    lastMouseY = t.clientY;

    if (Math.hypot(t.clientX - touchStartX, t.clientY - touchStartY) > 6) {
      touchMoved = true;
    }

    camera.lon -= dx * 0.008;
    const maxLat = Math.PI / 2 - 0.001;
    camera.lat = Math.max(-maxLat, Math.min(maxLat, camera.lat + dy * 0.008));
    render();
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    if (!touchDragging) return;
    touchDragging = false;
    if (!touchMoved && e.changedTouches.length > 0) {
      const t = e.changedTouches[0];
      selectCellAtMouse(t.clientX, t.clientY);
    }
  });

  // On-screen 3x3 keypads
  document.querySelectorAll('[data-digit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyDigit(Number(btn.dataset.digit));
    });
  });

  document.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'w') moveInActivePlane(0, -1);
      else if (action === 's') moveInActivePlane(0, 1);
      else if (action === 'a') moveInActivePlane(-1, 0);
      else if (action === 'd') moveInActivePlane(1, 0);
      else if (action === 'q') movePerpendicular(false);
      else if (action === 'e') movePerpendicular(true);
      else if (action === 'z') toggleBaseMode();
      else if (action === 'x') clearCurrentCell();
      else if (action === 'c') undoRedo();
    });
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') {
      shiftHeld = false;
      updateModeUI();
    }
  });

  window.addEventListener('blur', () => {
    if (shiftHeld) {
      shiftHeld = false;
      updateModeUI();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Shift' && !shiftHeld) {
      shiftHeld = true;
      updateModeUI();
      return;
    }
    if (document.activeElement === puzzleInput) return;

    const digit = extractDigitFromKeyEvent(e);
    if (digit !== null) {
      if (digit === 0) {
        e.preventDefault();
        clearCurrentCell();
      } else {
        applyDigit(digit);
      }
      return;
    }

    const key = e.key;
    if (key === 'Backspace' || key === 'Delete' || key === ' ') {
      e.preventDefault();
      clearCurrentCell();
      return;
    }

    const lower = key.toLowerCase();
    if (lower === 'w') {
      moveInActivePlane(0, -1);
    } else if (lower === 's') {
      moveInActivePlane(0, 1);
    } else if (lower === 'a') {
      moveInActivePlane(-1, 0);
    } else if (lower === 'd') {
      moveInActivePlane(1, 0);
    } else if (lower === 'q') {
      movePerpendicular(false);
    } else if (lower === 'e') {
      movePerpendicular(true);
    } else if (lower === 'z') {
      toggleBaseMode();
    } else if (lower === 'x') {
      clearCurrentCell();
    } else if (lower === 'c') {
      undoRedo();
    }
  });

  window.addEventListener('resize', render);

  closeSolvedBtn.addEventListener('click', () => {
    solvedModal.classList.add('hidden');
  });

  resetBtn.addEventListener('click', () => {
    resetMessage.textContent = `Erase all your entries and candidates for Puzzle #${puzzleNumber}?`;
    resetModal.classList.remove('hidden');
  });

  cancelResetBtn.addEventListener('click', () => {
    resetModal.classList.add('hidden');
  });

  confirmResetBtn.addEventListener('click', () => {
    entries.fill(0);
    candidates.fill(0);
    lastEdit = null;
    isSolved = false;
    try {
      localStorage.removeItem(puzzleStorageKey(puzzleNumber));
      const solved = getSolvedSet();
      solved.delete(puzzleNumber);
      localStorage.setItem(SOLVED_KEY, JSON.stringify(Array.from(solved)));
    } catch {
      // Ignore storage errors
    }
    resetModal.classList.add('hidden');
    updateStatus(false);
    render();
  });

  puzzleForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const num = Number(puzzleInput.value);
    if (Number.isInteger(num) && num >= 1) {
      const url = new URL(window.location.href);
      url.searchParams.set('puzzle', String(num));
      window.history.pushState({}, '', url);
      loadPuzzle(num);
    }
  });

  window.addEventListener('popstate', () => {
    const params = new URLSearchParams(window.location.search);
    const num = Number(params.get('puzzle') || '1');
    loadPuzzle(Number.isInteger(num) && num >= 1 ? num : 1);
  });

  async function loadPuzzle(num) {
    puzzleNumber = num;
    puzzleInput.value = String(num);
    isSolved = false;
    lastEdit = null;
    solvedModal.classList.add('hidden');
    loadingText.textContent = `Loading Puzzle #${num}...`;
    loadingOverlay.classList.remove('hidden');

    try {
      const resp = await fetch(`api.php?number=${encodeURIComponent(num)}`);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const data = await resp.json();
      givens = Uint8Array.from(data.givens);
      loadUserEntries(num);
      updateStatus(false);
      render();
    } catch (err) {
      loadingText.textContent = `Error loading puzzle #${num}: ${err.message}`;
      return;
    }

    loadingOverlay.classList.add('hidden');
  }

  // Initial load from URL query param ?puzzle=N (default 1)
  const params = new URLSearchParams(window.location.search);
  const initialNum = Number(params.get('puzzle') || '1');
  loadPuzzle(Number.isInteger(initialNum) && initialNum >= 1 ? initialNum : 1);
})();
