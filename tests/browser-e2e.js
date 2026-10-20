// Headless Chrome E2E: fake camera covers -> quad detect -> OCR -> edit fallback -> summon; collection; deck; CPU battles at 3 levels; layout checks.
// usage: (serve repo root on :8811) node tests/browser-e2e.js
const path = require('path'), fs = require('fs');
const puppeteer = require('/workspace/gbp-tools/node_modules/puppeteer-core');
const URL = process.env.URL || 'http://127.0.0.1:8811/index.html';
const SS = path.join(__dirname, '..', 'screenshots') + '/';
const COV = JSON.parse(fs.readFileSync(path.join(__dirname, 'covers/covers.json')));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const errors = [], out = { ocr: [], battles: [], layout: {} };
const FAKE_CAM = () => {
  navigator.mediaDevices.getUserMedia = async () => {
    const img = new Image(); img.src = window.__fakeSrc; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d');
    const draw = () => { x.drawImage(img, 0, 0); }; draw(); setInterval(draw, 66);
    return c.captureStream(15);
  };
};
function sim(a, b) { // char-level similarity (1 - normalized Levenshtein)
  a = a.replace(/\s/g, ''); b = b.replace(/\s/g, ''); const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - d[a.length][b.length] / Math.max(a.length, b.length, 1);
}
async function newPage(br, w, h) {
  const pg = await br.newPage();
  await pg.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  pg.on('console', m => { if (m.type() === 'error') errors.push(`${w}x${h} console: ${m.text()}`); });
  pg.on('pageerror', e => errors.push(`${w}x${h} pageerror: ${e.message}`));
  await pg.evaluateOnNewDocument(FAKE_CAM);
  await pg.goto(URL, { waitUntil: 'networkidle0' });
  await pg.waitForFunction('window.GB_ready');
  return pg;
}
const overlapCheck = pg => pg.evaluate(() => {
  const ids = ['hero1', 'board1', 'board0', 'hero0', 'hand0'], R = ids.map(i => document.getElementById(i).getBoundingClientRect()), p = [];
  for (let i = 0; i < R.length - 1; i++) if (R[i].bottom > R[i + 1].top + 0.5) p.push(ids[i] + '/' + ids[i + 1]);
  R.forEach((r, i) => { if (r.bottom > innerHeight + 0.5 || r.left < -0.5 || r.right > innerWidth + 0.5) p.push(ids[i] + ' offscreen'); });
  document.querySelectorAll('.minion').forEach(m => { const r = m.getBoundingClientRect(), b = m.parentElement.getBoundingClientRect(); if (r.left < b.left - 6 || r.right > b.right + 6 || r.top < b.top - 9 || r.bottom > b.bottom + 7) p.push('minion outside board'); });
  const e = document.getElementById('end-btn').getBoundingClientRect(), el = document.elementFromPoint(e.left + e.width / 2, e.top + e.height / 2);
  if (el !== document.getElementById('end-btn')) p.push('end button covered');
  return p;
});
async function createCard(pg, cv, shots) {
  await pg.evaluate(src => { window.__fakeSrc = src; }, 'tests/covers/' + cv.file);
  await pg.evaluate(() => GB.show('capture'));
  await pg.waitForFunction(() => document.getElementById('video').videoWidth > 0, { timeout: 10000 });
  await sleep(300); await pg.click('#shutter');
  await pg.waitForSelector('#cap-crop:not(.hidden)');
  const auto = await pg.evaluate(() => document.getElementById('crop-hint').textContent.includes('自動'));
  if (shots) await pg.screenshot({ path: SS + 'crop.png' });
  await pg.click('#crop-ok');
  await pg.waitForFunction(() => window.GB_lastOcr !== undefined && !document.getElementById('ocr-status').classList.contains('busy'), { timeout: 120000 });
  const ocr = await pg.evaluate(() => ({ v: document.getElementById('title-input').value, raw: (GB_lastOcr.raw || GB_lastOcr.error || '').slice(0, 200) }));
  await pg.evaluate(() => { window.GB_lastOcr = undefined; });
  if (shots) await pg.screenshot({ path: SS + 'ocr.png' });
  const exact = ocr.v.replace(/\s/g, '') === cv.title.replace(/\s/g, '');
  out.ocr.push({ truth: cv.title, ocr: ocr.v, exact, similarity: +sim(ocr.v, cv.title).toFixed(2), autoQuad: auto, raw: ocr.raw.replace(/\n/g, ' / ') });
  if (!exact) { // edit fallback
    await pg.click('#title-input', { clickCount: 3 }); await pg.evaluate(() => { document.getElementById('title-input').value = ''; });
    await pg.type('#title-input', cv.title);
  }
  await pg.click('#summon-btn');
  await pg.waitForSelector('#summon:not(.hidden)');
  return pg;
}
(async () => {
  const br = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-fake-ui-for-media-stream'], headless: 'new' });
  // ---- 390x844: title, cards, summon gif, collection, detail, deck ----
  let pg = await newPage(br, 390, 844);
  await pg.evaluate(async () => { await DB.clear(); localStorage.clear(); await GB.loadCards(); });
  await sleep(400); await pg.screenshot({ path: SS + 'title.png' });
  fs.mkdirSync('/tmp/gbgif', { recursive: true }); fs.readdirSync('/tmp/gbgif').forEach(f => fs.unlinkSync('/tmp/gbgif/' + f));
  for (let i = 0; i < COV.length; i++) {
    const t0 = Date.now(); await createCard(pg, COV[i], i === 0);
    if (i === 3) { for (let f = 0; f < 32; f++) { await pg.screenshot({ path: `/tmp/gbgif/f${String(f).padStart(3, '0')}.png` }); await sleep(30); } }
    else { await sleep(1000); if (i === 0) await pg.screenshot({ path: SS + 'summon_circle.png' }); await sleep(1500); }
    if (i === 0 || i === 3) await pg.screenshot({ path: SS + (i === 0 ? 'summon_reveal.png' : 'summon_reveal2.png') });
    await sleep(200); await pg.click('#summon'); await sleep(300);
    const card = await pg.evaluate(() => GB.userCards()[0].card);
    out.ocr[i].card = `${card.name} ${card.element} c${card.cost} ${card.atk}/${card.hp} ${card.rarity} ${card.effect.type}`;
    out.ocr[i].elementOk = ({ 火: 'fire', 水: 'water', 風: 'wind', 土: 'earth', 光: 'light', 闇: 'dark' })[COV[i].expectElement] === card.element;
    out.ocr[i].ms = Date.now() - t0;
    if (i === 1) await pg.screenshot({ path: SS + 'card_detail.png' });
    await pg.evaluate(() => GB.closeModal());
  }
  // determinism: same book again -> same id, no duplicate
  const before = await pg.evaluate(() => GB.userCards().length);
  await createCard(pg, COV[0], false); await sleep(2500); await pg.click('#summon'); await sleep(300); await pg.evaluate(() => GB.closeModal());
  out.sameBookSameCard = (await pg.evaluate(() => GB.userCards().length)) === before;
  await pg.evaluate(() => GB.show('collection')); await sleep(300); await pg.screenshot({ path: SS + 'collection.png' });
  // delete one via UI
  pg.on('dialog', d => d.accept());
  await pg.evaluate(() => GB.showDetail(GB.userCards().find(r => r.card.title === '山の音').card));
  await pg.click('.modal .btn.danger'); await sleep(400);
  out.deleteWorks = (await pg.evaluate(() => GB.userCards().length)) === before - 1;
  await pg.evaluate(() => GB.show('deck')); await sleep(300);
  const deckBefore = await pg.$eval('#deck-count', e => e.textContent);
  await pg.click('#deck-grid .card:not(.in-deck)'); // try adding (deck full -> toast) then remove one and add
  await pg.click('#deck-grid .card.in-deck'); await pg.click('#deck-grid .card:not(.in-deck)');
  out.deck = { before: deckBefore, after: await pg.$eval('#deck-count', e => e.textContent), userInDeck: await pg.evaluate(() => GB.buildDeck().filter(c => c.source === 'book').length) };
  await pg.screenshot({ path: SS + 'deck.png' });
  // ---- battles ----
  for (const [w, h] of [[390, 844], [375, 667]]) {
    if (w === 375) { await pg.close(); pg = await newPage(br, 375, 667); pg.on('dialog', d => d.accept()); }
    for (const lv of [1, 2, 3]) {
      await pg.evaluate(() => { window.GB_FAST = true; GB.show('levels'); });
      await pg.click(`[data-lv="${lv}"]`); await sleep(200);
      let steps = 0, shot = false, maxProblems = [];
      while (steps++ < 600) {
        const st = await pg.evaluate(() => ({ cur: document.querySelector('.screen.active').id, turn: GB.G.turn, busy: GB.busy, w: GB.G.winner, tn: GB.G.turnNo }));
        if (st.cur === 's-result') break;
        if (st.w != null) { await sleep(200); continue; }
        if (st.turn !== 0 || st.busy) { await sleep(60); continue; }
        const p = await overlapCheck(pg); if (p.length) maxProblems.push(...p);
        if (!shot && w === 390 && lv === 3 && st.tn >= 9) { await pg.screenshot({ path: SS + 'battle_mid.png' }); shot = true; }
        if (!shot && w === 375 && lv === 2 && st.tn >= 9) { await pg.screenshot({ path: SS + 'battle_mid_375.png' }); shot = true; }
        const a = await pg.evaluate(() => { window.__pc = window.__pc || new AI.CPU(2, 5); return __pc.choose(GB.G); });
        if (a.type === 'play') await pg.click(`#hand0 .card:nth-child(${a.idx + 1})`);
        else if (a.type === 'attack') { await pg.click(`#board0 [data-uid="${a.from}"]`); await pg.click(a.to === 'hero' ? '#hero1' : `#board1 [data-uid="${a.to}"]`); }
        else await pg.click('#end-btn');
        await sleep(40);
      }
      const res = await pg.evaluate(() => window.GB_lastResult);
      out.battles.push({ size: `${w}x${h}`, level: lv, completed: !!res, playerWon: res && res.win, turns: res && res.turns, layoutProblems: [...new Set(maxProblems)] });
      if (w === 390 && lv === 3) await pg.screenshot({ path: SS + 'result.png' });
    }
    await pg.evaluate(() => GB.show('records')); await sleep(200); if (w === 390) await pg.screenshot({ path: SS + 'records.png' });
    // 5 v 5 full board layout stress
    await pg.evaluate(() => { GB.startBattle(1); const G = GB.G; const c = GB.allCards(); for (const pi of [0, 1]) { G.players[pi].board = []; for (let i = 0; i < 5; i++) G.players[pi].board.push({ uid: 900 + pi * 10 + i, card: c[i], element: c[i].element, atk: 9, hp: 9, maxHp: 9, taunt: i === 2, canAttack: true }); } G.players[0].hand = c.slice(0, 10); G.players[0].maxMana = 10; G.players[0].mana = 10; GB.act({ type: 'end' }); });
    await pg.evaluate(() => { const G = GB.G; G.turn = 0; GB.show('battle'); }); await pg.evaluate(() => GB.act({ type: 'play', idx: 0 }) && 0).catch(() => {});
    await sleep(300); out.layout[`${w}x${h} full board`] = await overlapCheck(pg);
    await pg.screenshot({ path: SS + `layout_full_${w}x${h}.png` });
    // title / capture screens fit
    await pg.evaluate(() => GB.show('title')); await sleep(200);
    out.layout[`${w}x${h} title`] = await pg.evaluate(() => [...document.querySelectorAll('#s-title .btn')].filter(b => b.getBoundingClientRect().bottom > innerHeight).map(b => b.textContent));
    await pg.screenshot({ path: SS + `title_${w}x${h}.png` });
  }
  await br.close();
  out.errors = errors;
  fs.writeFileSync(path.join(__dirname, 'browser-result.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
})().catch(e => { console.error(e, errors); process.exit(1); });
