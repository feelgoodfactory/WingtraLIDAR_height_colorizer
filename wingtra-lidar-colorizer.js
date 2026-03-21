/**
 * wingtra-lidar-colorizer.js
 * ─────────────────────────────────────────────────────────────────────────────
 * WingtraLIDAR Height Colorizer — core library
 *
 * Exports
 * ───────
 *   LAS parsing:
 *     parseLASHeader(buffer)                    → LASHeader
 *
 *   Colorization:
 *     heightToRGB(t)                            → { r, g, b }   (t ∈ [0,1])
 *     colorizeLAS(buffer, header, onProgress)   → Promise<ColorizeResult>
 *
 *   Export / download:
 *     saveLAS(buffer, filename, onProgress)     → Promise<void>
 *
 *   3D preview (requires Three.js on window.THREE):
 *     createPreview(canvasEl, wrapEl)           → PreviewController
 *     PreviewController.load(result, header)
 *     PreviewController.setView(mode)           // '3d' | 'top' | 'front' | 'side'
 *     PreviewController.destroy()
 *
 *   Utilities:
 *     formatBytes(n)    → string
 *     fmtNum(n, dec)    → string
 *     fmtInt(n)         → string
 *
 * Types
 * ─────
 *   LASHeader        { verMajor, verMinor, headerSize, ptOffset, ptFormat,
 *                      ptRecLen, numPoints, xScale, yScale, zScale,
 *                      xOffset, yOffset, zOffset,
 *                      minX, maxX, minY, maxY, minZ, maxZ }
 *
 *   ColorizeResult   { colorizedBuffer: ArrayBuffer,
 *                      previewSamples: { xs, ys, zs, colors },
 *                      outFormat: number, outSize: number }
 *
 *   ProgressEvent    { phase: 'colorize'|'export'|'write',
 *                      loaded: number, total: number, pct: number,
 *                      label: string }
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// LAS FORMAT TABLES
// ─────────────────────────────────────────────────────────────────────────────

/** Whether each point format already carries RGB fields */
export const FORMAT_HAS_COLOR = {
  0: false, 1: false, 2: true,  3: true,
  4: false, 5: true,  6: false, 7: true,
  8: true,  9: false, 10: true,
};

/**
 * If a format has no color, upgrade to the nearest format that does.
 * Formats 7/8/10 are LAS 1.4 only; formats 2/3/5 work for LAS 1.0-1.3.
 */
export const FORMAT_UPGRADE = {
  0: 2, 1: 3, 4: 5, 6: 8, 9: 10,
};

/** Byte size of a single point record per format */
export const FORMAT_SIZE = {
  0: 20, 1: 28,  2: 26,  3: 34,
  4: 57, 5: 63,  6: 30,  7: 36,
  8: 38, 9: 59, 10: 67,
};

/** Byte offset of the RGB triplet within a point record */
export const FORMAT_RGB_OFFSET = {
  2: 20, 3: 28, 5: 56, 7: 30, 8: 30, 10: 38,
};

// ─────────────────────────────────────────────────────────────────────────────
// GRADIENT  (low = deep blue → high = red, passing through Wingtra orange)
// ─────────────────────────────────────────────────────────────────────────────

const GRADIENT_STOPS = [
  { t: 0.00, r:  26, g:  35, b: 126 }, // deep blue
  { t: 0.17, r:   2, g: 136, b: 209 }, // blue
  { t: 0.33, r:   0, g: 172, b: 193 }, // cyan
  { t: 0.50, r:  56, g: 142, b:  60 }, // green
  { t: 0.67, r: 249, g: 168, b:  37 }, // yellow
  { t: 0.83, r: 244, g: 111, b:  41 }, // Wingtra orange
  { t: 1.00, r: 198, g:  40, b:  40 }, // red
];

/**
 * Map a normalised height value to an RGB colour.
 * @param {number} t  Normalised height in [0, 1]  (0 = lowest, 1 = highest)
 * @returns {{ r: number, g: number, b: number }}  Integer channel values 0-255
 */
export function heightToRGB(t) {
  t = Math.max(0, Math.min(1, t));
  for (let i = 1; i < GRADIENT_STOPS.length; i++) {
    const a = GRADIENT_STOPS[i - 1];
    const b = GRADIENT_STOPS[i];
    if (t <= b.t) {
      const f = (t - a.t) / (b.t - a.t);
      return {
        r: Math.round(a.r + (b.r - a.r) * f),
        g: Math.round(a.g + (b.g - a.g) * f),
        b: Math.round(a.b + (b.b - a.b) * f),
      };
    }
  }
  return { r: 198, g: 40, b: 40 };
}

// ─────────────────────────────────────────────────────────────────────────────
// LAS HEADER PARSER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse the public header block of a LAS file.
 * @param {ArrayBuffer} buffer  Raw file bytes
 * @returns {LASHeader}
 * @throws {Error} if the signature is not "LASF"
 */
export function parseLASHeader(buffer) {
  const dv = new DataView(buffer);

  // Validate signature
  const sig = String.fromCharCode(
    dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)
  );
  if (sig !== 'LASF') throw new Error('Not a valid LAS file — missing LASF signature');

  const verMajor   = dv.getUint8(24);
  const verMinor   = dv.getUint8(25);
  const headerSize = dv.getUint16(94, true);
  const ptOffset   = dv.getUint32(96, true);
  const ptFormat   = dv.getUint8(104);
  const ptRecLen   = dv.getUint16(105, true);

  // LAS 1.4 stores the full 64-bit count at offset 247; fall back to the
  // legacy 32-bit field at offset 107 for older versions.
  let numPoints = dv.getUint32(107, true);
  if (verMajor === 1 && verMinor >= 4) {
    const lo = dv.getUint32(247, true);
    const hi = dv.getUint32(251, true);
    const big = hi * 0x100000000 + lo;
    if (big > 0) numPoints = big;
  }

  return {
    verMajor, verMinor, headerSize, ptOffset, ptFormat, ptRecLen, numPoints,
    xScale:  dv.getFloat64(131, true),
    yScale:  dv.getFloat64(139, true),
    zScale:  dv.getFloat64(147, true),
    xOffset: dv.getFloat64(155, true),
    yOffset: dv.getFloat64(163, true),
    zOffset: dv.getFloat64(171, true),
    maxX:    dv.getFloat64(179, true),
    minX:    dv.getFloat64(187, true),
    maxY:    dv.getFloat64(195, true),
    minY:    dv.getFloat64(203, true),
    maxZ:    dv.getFloat64(211, true),
    minZ:    dv.getFloat64(219, true),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// COLORIZE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Colorize every point in a LAS buffer by its Z height, returning a new
 * ArrayBuffer with RGB values written according to the LAS specification.
 *
 * Processing is split into async chunks so the browser UI stays responsive.
 *
 * @param {ArrayBuffer}   buffer      Original LAS file bytes
 * @param {LASHeader}     header      Parsed header (from parseLASHeader)
 * @param {Function}      onProgress  Called with ProgressEvent each chunk
 * @returns {Promise<ColorizeResult>}
 */
export function colorizeLAS(buffer, header, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const {
      ptOffset, ptFormat, ptRecLen, numPoints,
      zScale, zOffset, minZ, maxZ,
    } = header;

    const zRange  = (maxZ - minZ) < 1e-9 ? 1 : (maxZ - minZ);
    const inFmt   = ptFormat;
    const outFmt  = FORMAT_HAS_COLOR[inFmt] ? inFmt : (FORMAT_UPGRADE[inFmt] ?? inFmt);
    const inSize  = FORMAT_SIZE[inFmt]  ?? ptRecLen;
    const outSize = FORMAT_SIZE[outFmt] ?? ptRecLen;
    const rgbOff  = FORMAT_RGB_OFFSET[outFmt];

    const inView = new Uint8Array(buffer);
    const inDV   = new DataView(buffer);

    // Allocate output buffer
    let outBuf;
    try {
      outBuf = new ArrayBuffer(ptOffset + numPoints * outSize);
    } catch (e) {
      reject(new Error('Out of memory — file is too large for browser processing'));
      return;
    }

    const outBytes = new Uint8Array(outBuf);
    const outDV    = new DataView(outBuf);

    // Copy header + VLRs verbatim, then patch the point format / record length
    outBytes.set(inView.subarray(0, ptOffset));
    outDV.setUint8(104, outFmt);
    outDV.setUint16(105, outSize, true);

    // Tag generating software
    const sw = 'WingtraLIDAR Height Colorizer';
    for (let i = 0; i < 32; i++) {
      outDV.setUint8(58 + i, i < sw.length ? sw.charCodeAt(i) : 0);
    }

    // Collect preview samples (up to 200 k points)
    const MAX_PREVIEW = 200_000;
    const sampleStep  = numPoints > MAX_PREVIEW ? Math.ceil(numPoints / MAX_PREVIEW) : 1;
    const preview = { xs: [], ys: [], zs: [], colors: [] };

    const CHUNK_SIZE = 80_000;
    let processed = 0;

    function processChunk() {
      const end = Math.min(processed + CHUNK_SIZE, numPoints);

      for (let i = processed; i < end; i++) {
        const inOff  = ptOffset + i * inSize;
        const outOff = ptOffset + i * outSize;

        // Copy the existing point data
        outBytes.set(inView.subarray(inOff, inOff + Math.min(inSize, outSize)), outOff);

        // Compute real-world Z and normalised height
        const rawZ  = inDV.getInt32(inOff + 8, true);
        const realZ = rawZ * zScale + zOffset;
        const t     = (realZ - minZ) / zRange;
        const color = heightToRGB(t);

        // Write RGB as uint16 (LAS spec: 0–65535)
        if (rgbOff !== undefined) {
          outDV.setUint16(outOff + rgbOff,     color.r * 256, true);
          outDV.setUint16(outOff + rgbOff + 2, color.g * 256, true);
          outDV.setUint16(outOff + rgbOff + 4, color.b * 256, true);
        }

        // Collect preview sample
        if (i % sampleStep === 0) {
          preview.xs.push(inDV.getInt32(inOff + 0, true) * header.xScale + header.xOffset);
          preview.ys.push(inDV.getInt32(inOff + 4, true) * header.yScale + header.yOffset);
          preview.zs.push(realZ);
          preview.colors.push(color);
        }
      }

      processed = end;
      const pct = (processed / numPoints) * 100;
      onProgress({
        phase: 'colorize',
        loaded: processed,
        total:  numPoints,
        pct,
        label: `${fmtInt(processed)} / ${fmtInt(numPoints)} pts`,
      });

      if (processed < numPoints) {
        setTimeout(processChunk, 0);
      } else {
        resolve({
          colorizedBuffer: outBuf,
          previewSamples:  preview,
          outFormat:       outFmt,
          outSize,
        });
      }
    }

    processChunk();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT / SAVE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Save a colorized LAS buffer to disk.
 *
 * Tries the File System Access API first (Chrome/Edge 86+, no size limit),
 * then falls back to a chunked base64 data-URI for Firefox/Safari (≤150 MB).
 *
 * @param {ArrayBuffer} buffer      Colorized LAS bytes
 * @param {string}      filename    Suggested output filename
 * @param {Function}    onProgress  Called with ProgressEvent during encoding
 * @returns {Promise<void>}
 */
export async function saveLAS(buffer, filename, onProgress = () => {}) {
  const bytes = new Uint8Array(buffer);
  const total = bytes.length;

  // ── Strategy 1: File System Access API ──────────────────────────────────
  if (typeof window !== 'undefined' && window.showSaveFilePicker) {
    const handle = await window.showSaveFilePicker({
      suggestedName: filename,
      types: [{
        description: 'LAS Point Cloud',
        accept: { 'application/octet-stream': ['.las'] },
      }],
    });
    const writable = await handle.createWritable();
    const CHUNK = 1024 * 1024; // 1 MB per write
    let offset = 0;

    while (offset < total) {
      const end = Math.min(offset + CHUNK, total);
      await writable.write(bytes.subarray(offset, end));
      offset = end;
      onProgress({
        phase: 'write',
        loaded: offset,
        total,
        pct: (offset / total) * 100,
        label: `Writing… ${formatBytes(offset)} / ${formatBytes(total)}`,
      });
    }

    await writable.close();
    return;
  }

  // ── Strategy 2: Chunked base64 data-URI ─────────────────────────────────
  const SIZE_LIMIT = 150 * 1024 * 1024; // 150 MB
  if (total > SIZE_LIMIT) {
    throw new Error(
      `File is ${formatBytes(total)} — too large for base64 download. ` +
      'Use Chrome or Edge which support direct file saving.'
    );
  }

  // Chunk size must be a multiple of 3 so each base64 block joins cleanly
  const CHUNK = 3 * 16_384;
  let b64    = '';
  let offset = 0;

  await new Promise((resolve, reject) => {
    function step() {
      try {
        const end   = Math.min(offset + CHUNK, total);
        const slice = bytes.subarray(offset, end);
        let bin = '';
        for (let i = 0; i < slice.length; i++) bin += String.fromCharCode(slice[i]);
        b64   += btoa(bin);
        offset = end;
        onProgress({
          phase: 'export',
          loaded: offset,
          total,
          pct: (offset / total) * 100,
          label: `Encoding… ${formatBytes(offset)} / ${formatBytes(total)}`,
        });
        if (offset < total) setTimeout(step, 0);
        else resolve();
      } catch (e) { reject(e); }
    }
    step();
  });

  const a      = document.createElement('a');
  a.href       = 'data:application/octet-stream;base64,' + b64;
  a.download   = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3D PREVIEW  (requires window.THREE from the Three.js CDN script)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create an interactive 3-D point-cloud preview inside a <canvas> element.
 *
 * Controls
 *   Drag          — orbit
 *   Shift + Drag  — pan
 *   Scroll        — zoom
 *   Pinch         — zoom (touch)
 *
 * @param {HTMLCanvasElement} canvasEl  Target <canvas>
 * @param {HTMLElement}       wrapEl   Container element (used for sizing)
 * @returns {PreviewController}
 */
export function createPreview(canvasEl, wrapEl) {
  const THREE = window.THREE;
  if (!THREE) throw new Error('Three.js is required — include the CDN script before calling createPreview()');

  let renderer, scene, camera, points, animId;
  let orbit = { theta: -0.5, phi: 1.0, radius: 3, panX: 0, panY: 0 };
  let drag  = { down: false, lastX: 0, lastY: 0 };

  // ── Init renderer / scene ──
  function init() {
    const W = wrapEl.clientWidth;
    const H = Math.max(wrapEl.clientHeight || 480, 300);

    scene    = new THREE.Scene();
    scene.background = new THREE.Color(0x111418);
    camera   = new THREE.PerspectiveCamera(45, W / H, 0.0001, 100_000);
    renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);

    scene.add(new THREE.GridHelper(6, 24, 0x333333, 0x222222));

    _bindControls();
    _renderLoop();
  }

  function _renderLoop() {
    animId = requestAnimationFrame(_renderLoop);
    const { theta, phi, radius, panX, panY } = orbit;
    camera.position.set(
      radius * Math.sin(phi) * Math.sin(theta) + panX,
      radius * Math.cos(phi)                  + panY,
      radius * Math.sin(phi) * Math.cos(theta)
    );
    camera.lookAt(panX, panY, 0);
    renderer.render(scene, camera);
  }

  function _bindControls() {
    // Mouse
    canvasEl.addEventListener('mousedown', e => {
      drag.down = true; drag.lastX = e.clientX; drag.lastY = e.clientY;
    });
    window.addEventListener('mouseup', () => { drag.down = false; });
    canvasEl.addEventListener('mousemove', e => {
      if (!drag.down) return;
      const dx = e.clientX - drag.lastX;
      const dy = e.clientY - drag.lastY;
      drag.lastX = e.clientX; drag.lastY = e.clientY;
      if (e.shiftKey) {
        const s = orbit.radius * 0.0015;
        orbit.panX -= dx * s; orbit.panY += dy * s;
      } else {
        orbit.theta -= dx * 0.008;
        orbit.phi = Math.max(0.05, Math.min(Math.PI - 0.05, orbit.phi + dy * 0.008));
      }
    });
    canvasEl.addEventListener('wheel', e => {
      e.preventDefault();
      orbit.radius = Math.max(0.05, orbit.radius * (1 + e.deltaY * 0.001));
    }, { passive: false });

    // Touch
    let lastPinch = null;
    canvasEl.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        drag.down = true;
        drag.lastX = e.touches[0].clientX; drag.lastY = e.touches[0].clientY;
        lastPinch = null;
      } else if (e.touches.length === 2) {
        drag.down = false;
        lastPinch = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    });
    canvasEl.addEventListener('touchmove', e => {
      e.preventDefault();
      if (e.touches.length === 1 && drag.down) {
        const dx = e.touches[0].clientX - drag.lastX;
        const dy = e.touches[0].clientY - drag.lastY;
        drag.lastX = e.touches[0].clientX; drag.lastY = e.touches[0].clientY;
        orbit.theta -= dx * 0.008;
        orbit.phi = Math.max(0.05, Math.min(Math.PI - 0.05, orbit.phi + dy * 0.008));
      } else if (e.touches.length === 2 && lastPinch !== null) {
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        orbit.radius = Math.max(0.05, orbit.radius * (lastPinch / d));
        lastPinch = d;
      }
    }, { passive: false });
    canvasEl.addEventListener('touchend', () => { drag.down = false; lastPinch = null; });
  }

  // ── Public API ──

  /**
   * Load a colorized point cloud into the 3D viewer.
   * @param {ColorizeResult} result   Output of colorizeLAS()
   * @param {LASHeader}      header   Parsed LAS header
   */
  function load(result, header) {
    const THREE = window.THREE;
    const { xs, ys, zs, colors } = result.previewSamples;
    const N = xs.length;
    if (N === 0) return;

    // Remove old point cloud
    if (points) {
      scene.remove(points);
      points.geometry.dispose();
      points.material.dispose();
      points = null;
    }

    // Normalise coordinates to a ~2-unit cube centred at origin
    const cx = (header.maxX + header.minX) / 2;
    const cy = (header.maxY + header.minY) / 2;
    const cz = (header.maxZ + header.minZ) / 2;
    const span = Math.max(
      header.maxX - header.minX,
      header.maxY - header.minY,
      header.maxZ - header.minZ,
      0.001
    );
    const sc = 2.0 / span;

    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3 + 0] = (xs[i] - cx) * sc;
      pos[i * 3 + 1] = (zs[i] - cz) * sc; // Z is up in Three.js
      pos[i * 3 + 2] = (ys[i] - cy) * sc;
      col[i * 3 + 0] = colors[i].r / 255;
      col[i * 3 + 1] = colors[i].g / 255;
      col[i * 3 + 2] = colors[i].b / 255;
    }

    // Reposition floor grid
    scene.children
      .filter(c => c instanceof THREE.GridHelper)
      .forEach(g => scene.remove(g));
    const grid = new THREE.GridHelper(4, 24, 0x333333, 0x222222);
    grid.position.y = -((header.maxZ - header.minZ) / 2) * sc - 0.08;
    scene.add(grid);

    // Build point cloud mesh
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
    const ptSize = Math.max(0.003, Math.min(0.012, 1.5 / Math.sqrt(N)));
    points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size: ptSize, vertexColors: true, sizeAttenuation: true })
    );
    scene.add(points);

    // Reset orbit
    orbit = { theta: -0.5, phi: 1.0, radius: 2.8, panX: 0, panY: 0 };
  }

  /**
   * Snap the camera to a preset viewpoint.
   * @param {'3d'|'top'|'front'|'side'} mode
   */
  function setView(mode) {
    orbit.panX = 0; orbit.panY = 0;
    const views = {
      '3d':    { theta: -0.5,           phi: 1.0       },
      'top':   { theta:  0,             phi: 0.01      },
      'front': { theta:  0,             phi: Math.PI/2 },
      'side':  { theta:  Math.PI / 2,   phi: Math.PI/2 },
    };
    if (views[mode]) Object.assign(orbit, views[mode]);
  }

  /** Handle container resize */
  function resize() {
    if (!renderer) return;
    const W = wrapEl.clientWidth;
    const H = Math.max(wrapEl.clientHeight || 480, 300);
    renderer.setSize(W, H);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
  }

  /** Tear down the renderer and release GPU resources */
  function destroy() {
    cancelAnimationFrame(animId);
    if (points) { points.geometry.dispose(); points.material.dispose(); }
    renderer.dispose();
    renderer = scene = camera = points = null;
  }

  init();
  return { load, setView, resize, destroy };
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/** Format a byte count as a human-readable string. */
export function formatBytes(bytes) {
  if (bytes < 1024)        return bytes + ' B';
  if (bytes < 1_048_576)   return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1_073_741_824) return (bytes / 1_048_576).toFixed(1) + ' MB';
  return (bytes / 1_073_741_824).toFixed(2) + ' GB';
}

/** Format a float to `dec` decimal places with thousands separators. */
export function fmtNum(n, dec = 2) {
  if (n === undefined || n === null || isNaN(n)) return '—';
  return n.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Format an integer with thousands separators. */
export function fmtInt(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
