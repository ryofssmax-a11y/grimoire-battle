// Summon effect: magic circle, particles, rarity reveal.
(function (root) {
  'use strict';
  const COL = { fire: '#ff8a3d', water: '#4fb6ff', wind: '#7ff0c8', earth: '#d9b066', light: '#fff1a0', dark: '#b07cff' };
  const RCOL = { common: '#d8d0c0', rare: '#5ab0ff', epic: '#c070ff', legend: '#ffd040' };
  const RUNES = '✦✧◇◆❖☽☉✶✷✸✹❂⊕⊗△▽☆◎';
  let raf = 0;
  function play(card, artUrl, onDone) {
    const ov = document.getElementById('summon'), cv = document.getElementById('summon-canvas'), holder = document.getElementById('summon-card'), label = document.getElementById('summon-label');
    ov.classList.remove('hidden', 'revealed'); ov.className = 'summon r-' + card.rarity;
    holder.innerHTML = ''; holder.appendChild(root.CardView.card(card, artUrl, { size: 'lg' }));
    label.textContent = '★ ' + root.StatGen.RARITY_JA[card.rarity] + ' ★';
    const dpr = Math.min(2, devicePixelRatio || 1), W = innerWidth, H = innerHeight; cv.width = W * dpr; cv.height = H * dpr;
    const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const col = COL[card.element], rc = RCOL[card.rarity], R0 = Math.min(W, H) * 0.38, cx = W / 2, cy = H * 0.45;
    const parts = []; const t0 = performance.now(); let revealed = false, closable = false;
    const nStar = 5 + root.StatGen.RARITIES.indexOf(card.rarity);
    cancelAnimationFrame(raf);
    function frame(now) {
      const t = Math.max(0, (now - t0) / 1000); x.clearRect(0, 0, W, H);
      x.fillStyle = `rgba(8,4,16,${Math.min(0.88, t * 2)})`; x.fillRect(0, 0, W, H);
      const grow = Math.min(1, t / 0.9), rot = t * 0.9, fade = revealed ? Math.max(0, 1 - (t - 1.7) * 1.2) : 1;
      x.save(); x.translate(cx, cy); x.globalAlpha = fade; x.shadowColor = col; x.shadowBlur = 18; x.strokeStyle = col; x.lineWidth = 2;
      x.beginPath(); x.arc(0, 0, R0 * grow, 0, Math.PI * 2 * grow); x.stroke();
      x.beginPath(); x.arc(0, 0, R0 * 0.82 * grow, 0, Math.PI * 2); x.stroke();
      x.rotate(rot); x.beginPath();
      for (let i = 0; i <= nStar; i++) { const a = (i * 2 * Math.PI * 2) / nStar - Math.PI / 2; const px = Math.cos(a) * R0 * 0.8 * grow, py = Math.sin(a) * R0 * 0.8 * grow; i ? x.lineTo(px, py) : x.moveTo(px, py); }
      x.stroke(); x.rotate(-rot * 2); x.fillStyle = col; x.font = `${Math.round(R0 * 0.1)}px serif`; x.textAlign = 'center';
      for (let i = 0; i < 24; i++) { x.save(); x.rotate((i / 24) * Math.PI * 2); x.fillText(RUNES[i], 0, -R0 * 0.88 * grow); x.restore(); }
      x.restore();
      if (t < 2.4) for (let i = 0; i < (revealed ? 1 : 4); i++) { const a = Math.random() * Math.PI * 2, r = R0 * (0.2 + Math.random() * 0.8); parts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 90, life: 1, c: Math.random() < 0.3 ? rc : col }); }
      if (t > 1.5 && !revealed) { revealed = true; ov.classList.add('revealed'); for (let i = 0; i < 120; i++) { const a = Math.random() * Math.PI * 2, v = 80 + Math.random() * 320; parts.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1.4, c: i % 2 ? rc : '#fff' }); } }
      x.globalCompositeOperation = 'lighter';
      for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.x += p.vx / 60; p.y += p.vy / 60; p.vy += 0.6; p.life -= 1 / 70; if (p.life <= 0) { parts.splice(i, 1); continue; }
        x.globalAlpha = Math.min(1, p.life); x.fillStyle = p.c; x.beginPath(); x.arc(p.x, p.y, 2.2, 0, 7); x.fill(); }
      x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
      if (t > 1.5 && t < 1.8) { x.fillStyle = `rgba(255,255,255,${(1.8 - t) * 2.5})`; x.fillRect(0, 0, W, H); }
      if (t > 2.2) closable = true;
      if (t < 6 || parts.length) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    ov.onclick = () => { if (!closable && !root.GB_FAST) return; cancelAnimationFrame(raf); ov.classList.add('hidden'); ov.onclick = null; onDone && onDone(); };
  }
  root.Summon = { play };
})(this);
