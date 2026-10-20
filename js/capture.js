// Camera capture, cover quad detection, perspective crop, palette, on-device OCR (Tesseract.js, lazy).
(function (root) {
  'use strict';
  function toCanvas(src, maxSide) {
    const w0 = src.videoWidth || src.naturalWidth || src.width, h0 = src.videoHeight || src.naturalHeight || src.height;
    const k = maxSide ? Math.min(1, maxSide / Math.max(w0, h0)) : 1;
    const c = document.createElement('canvas'); c.width = Math.round(w0 * k); c.height = Math.round(h0 * k);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); return c;
  }
  // Largest object that differs from the border colour -> 4 extreme corners. Returns null if unsure.
  function detectQuad(canvas) {
    const k = Math.min(1, 220 / Math.max(canvas.width, canvas.height));
    const w = Math.round(canvas.width * k), h = Math.round(canvas.height * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true });
    x.filter = 'blur(1.5px)'; x.drawImage(canvas, 0, 0, w, h); const d = x.getImageData(0, 0, w, h).data;
    const border = [];
    for (let i = 0; i < w; i++) { border.push(i, (h - 1) * w + i); } for (let j = 0; j < h; j++) { border.push(j * w, j * w + w - 1); }
    const ch = n => border.map(p => d[p * 4 + n]).sort((a, b) => a - b)[border.length >> 1];
    const bg = [ch(0), ch(1), ch(2)];
    const dist = new Float32Array(w * h); const hist = new Array(64).fill(0);
    for (let p = 0; p < w * h; p++) { const v = Math.hypot(d[p * 4] - bg[0], d[p * 4 + 1] - bg[1], d[p * 4 + 2] - bg[2]); dist[p] = v; hist[Math.min(63, v >> 3)]++; }
    // Otsu threshold
    let sum = 0, tot = w * h; for (let i = 0; i < 64; i++) sum += i * hist[i];
    let sb = 0, wb = 0, best = 0, th = 4;
    for (let i = 0; i < 64; i++) { wb += hist[i]; if (!wb) continue; const wf = tot - wb; if (!wf) break; sb += i * hist[i]; const mb = sb / wb, mf = (sum - sb) / wf, b = wb * wf * (mb - mf) ** 2; if (b > best) { best = b; th = i; } }
    const T = Math.max(28, (th + 1) * 8);
    const mask = new Uint8Array(w * h); for (let p = 0; p < w * h; p++) mask[p] = dist[p] > T ? 1 : 0;
    // close small holes: dilate then fill components
    const lab = new Int32Array(w * h); let bestLab = 0, bestN = 0, L = 0; const q = new Int32Array(w * h);
    for (let p = 0; p < w * h; p++) {
      if (!mask[p] || lab[p]) continue; L++; let qh = 0, qt = 0, n = 0; q[qt++] = p; lab[p] = L;
      while (qh < qt) { const v = q[qh++]; n++; const vx = v % w, vy = (v / w) | 0;
        if (vx > 0 && mask[v - 1] && !lab[v - 1]) { lab[v - 1] = L; q[qt++] = v - 1; }
        if (vx < w - 1 && mask[v + 1] && !lab[v + 1]) { lab[v + 1] = L; q[qt++] = v + 1; }
        if (vy > 0 && mask[v - w] && !lab[v - w]) { lab[v - w] = L; q[qt++] = v - w; }
        if (vy < h - 1 && mask[v + w] && !lab[v + w]) { lab[v + w] = L; q[qt++] = v + w; } }
      if (n > bestN) { bestN = n; bestLab = L; }
    }
    if (bestN < w * h * 0.08 || bestN > w * h * 0.97) return null;
    let tl, tr, br, bl, a = 1e9, b = -1e9, cc = -1e9, e = 1e9;
    for (let p = 0; p < w * h; p++) { if (lab[p] !== bestLab) continue; const px = p % w, py = (p / w) | 0;
      if (px + py < a) { a = px + py; tl = [px, py]; } if (px + py > b) { b = px + py; br = [px, py]; }
      if (px - py > cc) { cc = px - py; tr = [px, py]; } if (px - py < e) { e = px - py; bl = [px, py]; } }
    const quad = [tl, tr, br, bl].map(([px, py]) => [(px + 0.5) / k, (py + 0.5) / k]);
    const area = Math.abs(polyArea(quad)) * k * k;
    if (area < bestN * 0.7) return null; // not quad-like
    return quad;
  }
  function polyArea(p) { let s = 0; for (let i = 0; i < 4; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % 4]; s += x1 * y2 - x2 * y1; } return s / 2; }
  // homography mapping unit square (u,v) -> quad
  function homography(q) {
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
    const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
    const den = dx1 * dy2 - dx2 * dy1, g = (dx3 * dy2 - dx2 * dy3) / den, hh = (dx1 * dy3 - dx3 * dy1) / den;
    return [x1 - x0 + g * x1, x3 - x0 + hh * x3, x0, y1 - y0 + g * y1, y3 - y0 + hh * y3, y0, g, hh];
  }
  function warp(src, quad, W, H) {
    const sw = src.width, sh = src.height, sd = src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, sw, sh).data;
    const out = document.createElement('canvas'); out.width = W; out.height = H; const ox = out.getContext('2d'); const od = ox.createImageData(W, H);
    const [a, b, c, d, e, f, g, h] = homography(quad);
    for (let j = 0; j < H; j++) { const v = (j + 0.5) / H; for (let i = 0; i < W; i++) { const u = (i + 0.5) / W;
      const z = g * u + h * v + 1, X = (a * u + b * v + c) / z, Y = (d * u + e * v + f) / z;
      const xi = Math.min(sw - 2, Math.max(0, X | 0)), yi = Math.min(sh - 2, Math.max(0, Y | 0)), fx = X - xi, fy = Y - yi, o = (j * W + i) * 4;
      for (let k = 0; k < 3; k++) { const p = (yi * sw + xi) * 4 + k; od.data[o + k] = (sd[p] * (1 - fx) + sd[p + 4] * fx) * (1 - fy) + (sd[p + sw * 4] * (1 - fx) + sd[p + sw * 4 + 4] * fx) * fy; }
      od.data[o + 3] = 255; } }
    ox.putImageData(od, 0, 0); return out;
  }
  function palette(canvas) {
    const c = document.createElement('canvas'); c.width = 48; c.height = 64; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(canvas, 0, 0, 48, 64);
    const d = x.getImageData(0, 0, 48, 64).data, m = new Map();
    for (let p = 0; p < d.length; p += 4) { const key = (d[p] >> 5) << 6 | (d[p + 1] >> 5) << 3 | (d[p + 2] >> 5); const e = m.get(key) || { r: 0, g: 0, b: 0, n: 0 }; e.r += d[p]; e.g += d[p + 1]; e.b += d[p + 2]; e.n++; m.set(key, e); }
    return [...m.values()].sort((a, b) => b.n - a.n).slice(0, 5).map(e => ({ r: Math.round(e.r / e.n), g: Math.round(e.g / e.n), b: Math.round(e.b / e.n), weight: e.n }));
  }
  // ---- OCR ----
  let workerP = null;
  function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load ' + src)); document.head.appendChild(s); }); }
  function getWorker(onProgress) {
    if (workerP) return workerP;
    const base = new URL('vendor/tesseract/', location.href).href;
    workerP = (async () => {
      if (!root.Tesseract) await loadScript(base + 'tesseract.min.js');
      return root.Tesseract.createWorker('jpn+eng', 1, { workerPath: base + 'worker.min.js', corePath: base + 'core/', langPath: base + 'lang', gzip: true,
        logger: m => onProgress && onProgress(m) });
    })();
    workerP.catch(() => { workerP = null; });
    return workerP;
  }
  function cleanLine(t) {
    t = t.normalize('NFKC').replace(/[|_~^`¥\\<>{}\[\]=]+/g, '').trim();
    t = t.replace(/([\u3000-\u9fff\uff00-\uffef])\s+(?=[\u3000-\u9fff\uff00-\uffef])/g, '$1');
    return t.replace(/\s{2,}/g, ' ');
  }
  const JA = /[\u3040-\u30ff\u4e00-\u9fff]/;
  function prep(canvas, sx, sy, sw, sh, H) { // crop + scale + grayscale
    const c = document.createElement('canvas'); const k = H / sh; c.width = Math.round(sw * k); c.height = H;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.filter = 'grayscale(1) contrast(1.25)'; x.drawImage(canvas, sx, sy, sw, sh, 0, 0, c.width, c.height); return c;
  }
  function pickLines(data) {
    return (data.lines || []).map(l => ({ text: cleanLine(l.text), conf: l.confidence, h: l.bbox.y1 - l.bbox.y0, bbox: l.bbox }))
      .filter(l => l.conf > 45 && ((l.text.match(/[\u3040-\u30ff\u4e00-\u9fff]/g) || []).length >= 2 || /[A-Za-z]{3,}/.test(l.text)))
      .map(l => ({ ...l, score: l.conf * Math.sqrt(l.h) }))
      .sort((a, b) => b.score - a.score);
  }
  async function ocrTitle(canvas, onProgress) {
    const w = await getWorker(onProgress);
    // pass 1: sparse text on the cover without its outer frame (frames/borders confuse layout analysis)
    const mx = canvas.width * 0.06, my = canvas.height * 0.045, H1 = 450;
    const c1 = prep(canvas, mx, my, canvas.width - 2 * mx, canvas.height - 2 * my, H1);
    await w.setParameters({ tessedit_pageseg_mode: '11' });
    const r1 = await w.recognize(c1);
    const lines = pickLines(r1.data); let best = lines[0] || null;
    // pass 2: re-read the best line as a single text line
    if (best) {
      const k = (canvas.height - 2 * my) / H1, b = best.bbox, pad = best.h * 0.45;
      const sx = Math.max(0, mx + (b.x0 - pad) * k), sy = Math.max(0, my + (b.y0 - pad) * k);
      const sw = Math.min(canvas.width - sx, (b.x1 - b.x0 + 2 * pad) * k), sh = Math.min(canvas.height - sy, (b.y1 - b.y0 + 2 * pad) * k);
      await w.setParameters({ tessedit_pageseg_mode: '7' });
      const r2 = await w.recognize(prep(canvas, sx, sy, sw, sh, 96));
      const t2 = cleanLine(r2.data.text || '');
      if (t2.replace(/\s/g, '').length >= 2 && r2.data.confidence > best.conf) best = { ...best, text: t2, conf: r2.data.confidence, pass: 2 };
    }
    return { title: best ? best.text : '', confidence: best ? best.conf : 0, raw: r1.data.text, lines };
  }
  function fingerprint(canvas) { // 8x8 average hash, stored for reference (not used for identity)
    const c = document.createElement('canvas'); c.width = 8; c.height = 8; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(canvas, 0, 0, 8, 8);
    const d = x.getImageData(0, 0, 8, 8).data, g = []; for (let p = 0; p < 256; p += 4) g.push(d[p] + d[p + 1] + d[p + 2]);
    const avg = g.reduce((a, b) => a + b) / 64; return g.map(v => v > avg ? 1 : 0).join('');
  }
  root.Capture = { toCanvas, detectQuad, warp, palette, ocrTitle, getWorker, fingerprint, cleanLine };
})(this);
