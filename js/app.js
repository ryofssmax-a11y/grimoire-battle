// 魔導書バトル: screens & glue.
(function () {
  'use strict';
  const $ = id => document.getElementById(id), S = StatGen, R = Rules, CV = CardView;
  const gen = new S.DeterministicStatGenerator(); // swap for AIStatGenerator later
  const artUrls = new Map(); let userCards = []; // [{id, card, art(Blob), created}]
  const LV_NAME = { 1: '見習い魔導士', 2: '宮廷魔導士', 3: '大賢者' };
  const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem('gb.' + k)) ?? d; } catch (e) { return d; } }, set: (k, v) => localStorage.setItem('gb.' + k, JSON.stringify(v)) };
  function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2000); }
  function artOf(c) {
    if (artUrls.has(c.id)) return artUrls.get(c.id);
    const u = c.source === 'starter' || c.source === 'cpu' ? Starters.art(c.title, c.element) : '';
    artUrls.set(c.id, u); return u;
  }
  async function loadCards() {
    try { userCards = (await DB.all()).sort((a, b) => b.created - a.created); } catch (e) { userCards = []; }
    for (const r of userCards) if (!artUrls.has(r.id) && r.art) artUrls.set(r.id, URL.createObjectURL(r.art));
  }
  const allCards = () => userCards.map(r => r.card).concat(Starters.CARDS);

  // ---------- navigation ----------
  let current = 'title';
  function show(name) {
    if (current === 'capture' && name !== 'capture') stopCamera();
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 's-' + name));
    current = name; window.scrollTo(0, 0); document.querySelectorAll('.pop').forEach(p => p.remove());
    if (name === 'capture') startCapture();
    if (name === 'collection') renderCollection();
    if (name === 'deck') renderDeck();
    if (name === 'records') renderRecords($('rec-body'));
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) show(b.dataset.go); });

  // ---------- capture ----------
  let stream = null, srcCanvas = null, quad = null, coverCanvas = null;
  function step(n) { ['camera', 'crop', 'title'].forEach(s => $('cap-' + s).classList.toggle('hidden', s !== n)); }
  async function startCapture() {
    step('camera');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { $('cam-msg').textContent = 'カメラが使えません。「写真を選ぶ」から撮影してください'; return; }
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      $('video').srcObject = stream; await $('video').play().catch(() => {}); $('cam-msg').textContent = '本の表紙を枠に合わせて撮影';
    } catch (e) { $('cam-msg').textContent = 'カメラを起動できませんでした。「写真を選ぶ」を使ってください'; }
  }
  function stopCamera() { if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; }
  $('shutter').onclick = () => { const v = $('video'); if (!v.videoWidth) { toast('カメラの準備中です'); return; } gotImage(Capture.toCanvas(v, 1600)); };
  $('file').onchange = e => { const f = e.target.files[0]; if (!f) return; const img = new Image(); img.onload = () => { gotImage(Capture.toCanvas(img, 1600)); URL.revokeObjectURL(img.src); }; img.src = URL.createObjectURL(f); e.target.value = ''; };
  function fullQuad() { const w = srcCanvas.width, h = srcCanvas.height, m = 0.04; return [[w * m, h * m], [w * (1 - m), h * m], [w * (1 - m), h * (1 - m)], [w * m, h * (1 - m)]]; }
  function gotImage(c) {
    stopCamera(); srcCanvas = c; const q = Capture.detectQuad(c);
    quad = q || fullQuad(); $('crop-hint').textContent = q ? '表紙を自動で見つけました。ずれていたら四隅を動かしてください' : '四隅をドラッグして表紙に合わせてください';
    step('crop'); drawCrop();
  }
  function cropScale() { const cv = $('crop-canvas'); return cv.width / srcCanvas.width; }
  function drawCrop() {
    const cv = $('crop-canvas'), wrap = cv.parentElement, maxW = wrap.clientWidth, maxH = Math.max(200, innerHeight - 230);
    const k = Math.min(maxW / srcCanvas.width, maxH / srcCanvas.height); cv.width = Math.round(srcCanvas.width * k); cv.height = Math.round(srcCanvas.height * k);
    const x = cv.getContext('2d'); x.drawImage(srcCanvas, 0, 0, cv.width, cv.height);
    const p = quad.map(([a, b]) => [a * k, b * k]);
    x.fillStyle = 'rgba(0,0,0,.45)'; x.beginPath(); x.rect(0, 0, cv.width, cv.height); x.moveTo(...p[0]); for (let i = 3; i >= 0; i--) x.lineTo(...p[i]); x.fill('evenodd');
    x.strokeStyle = '#ffd36a'; x.lineWidth = 2; x.beginPath(); x.moveTo(...p[0]); p.forEach(q => x.lineTo(...q)); x.closePath(); x.stroke();
    p.forEach(([a, b]) => { x.fillStyle = 'rgba(255,211,106,.35)'; x.beginPath(); x.arc(a, b, 16, 0, 7); x.fill(); x.fillStyle = '#ffd36a'; x.beginPath(); x.arc(a, b, 6, 0, 7); x.fill(); });
  }
  (function cropDrag() {
    const cv = $('crop-canvas'); let drag = -1;
    const pos = e => { const r = cv.getBoundingClientRect(), t = e.touches ? e.touches[0] : e; return [(t.clientX - r.left) * cv.width / r.width, (t.clientY - r.top) * cv.height / r.height]; };
    const down = e => { const [a, b] = pos(e), k = cropScale(); let bd = 40; drag = -1; quad.forEach(([qx, qy], i) => { const d = Math.hypot(qx * k - a, qy * k - b); if (d < bd) { bd = d; drag = i; } }); if (drag >= 0) e.preventDefault(); };
    const move = e => { if (drag < 0) return; e.preventDefault(); const [a, b] = pos(e), k = cropScale(); quad[drag] = [Math.max(0, Math.min(srcCanvas.width, a / k)), Math.max(0, Math.min(srcCanvas.height, b / k))]; drawCrop(); };
    cv.addEventListener('pointerdown', down); window.addEventListener('pointermove', move, { passive: false }); window.addEventListener('pointerup', () => drag = -1);
  })();
  $('crop-retake').onclick = () => startCapture();
  $('crop-reset').onclick = () => { quad = fullQuad(); drawCrop(); };
  $('crop-ok').onclick = () => {
    const wTop = Math.hypot(quad[1][0] - quad[0][0], quad[1][1] - quad[0][1]), hL = Math.hypot(quad[3][0] - quad[0][0], quad[3][1] - quad[0][1]);
    const ratio = Math.max(1.0, Math.min(1.8, hL / Math.max(1, wTop)));
    coverCanvas = Capture.warp(srcCanvas, quad, 480, Math.round(480 * ratio));
    const pv = $('cover-preview'); pv.width = coverCanvas.width; pv.height = coverCanvas.height; pv.getContext('2d').drawImage(coverCanvas, 0, 0);
    step('title'); $('title-input').value = ''; runOcr();
  };
  $('title-back').onclick = () => { step('crop'); drawCrop(); };
  let ocrRun = 0;
  async function runOcr() {
    const my = ++ocrRun, st = $('ocr-status'); st.className = 'ocr-status busy'; st.textContent = '文字を読み取り中…（初回は辞書の読み込みに少し時間がかかります）';
    try {
      const r = await Capture.ocrTitle(coverCanvas, m => { if (my === ocrRun && m.status && m.progress != null && m.status.includes('recogn')) st.textContent = `文字を読み取り中… ${Math.round(m.progress * 100)}%`; });
      if (my !== ocrRun) return; window.GB_lastOcr = r;
      if (r.title) { if (!$('title-input').value) $('title-input').value = r.title; st.className = 'ocr-status ok'; st.textContent = '読み取りました。違っていたら直してください'; }
      else { st.className = 'ocr-status ng'; st.textContent = 'タイトルを読み取れませんでした。入力してください'; $('title-input').focus(); }
    } catch (e) { if (my !== ocrRun) return; window.GB_lastOcr = { error: String(e) }; st.className = 'ocr-status ng'; st.textContent = '読み取り機能を使えませんでした。タイトルを入力してください'; }
  }
  $('ocr-retry').onclick = () => { $('title-input').value = ''; runOcr(); };
  $('summon-btn').onclick = async () => {
    const title = $('title-input').value.trim();
    if (!title) { toast('タイトルを入力してください'); $('title-input').focus(); return; }
    const pal = Capture.palette(coverCanvas);
    const card = await gen.generate({ title, palette: pal });
    const exists = userCards.find(r => r.id === card.id);
    const blob = await new Promise(res => coverCanvas.toBlob(res, 'image/jpeg', 0.85));
    if (!exists) { const rec = { id: card.id, card, art: blob, created: Date.now(), ahash: Capture.fingerprint(coverCanvas) }; await DB.put(rec); userCards.unshift(rec); artUrls.set(card.id, URL.createObjectURL(blob)); autoAddToDeck(card.id); }
    Summon.play(card, artOf(card), () => { if (exists) toast('この魔導書はすでに持っています'); showDetail(card); show('collection'); });
  };

  // ---------- collection ----------
  let colFilter = 'all';
  function renderCollection() {
    const f = $('col-filters'); f.innerHTML = '';
    [['all', 'すべて'], ['book', '撮影'], ...S.ELEMENTS.map(e => [e, S.EL_JA[e]])].forEach(([k, l]) => { const b = document.createElement('button'); b.className = 'chip' + (colFilter === k ? ' on' : ''); b.textContent = l; b.onclick = () => { colFilter = k; renderCollection(); }; f.appendChild(b); });
    const g = $('col-grid'); g.innerHTML = '';
    const list = allCards().filter(c => colFilter === 'all' || (colFilter === 'book' ? c.source === 'book' : c.element === colFilter));
    $('col-count').textContent = `${userCards.length}冊 撮影`;
    if (!list.length) g.innerHTML = '<p class="empty">まだありません。本を撮影してみましょう</p>';
    list.forEach(c => { const el = CV.card(c, artOf(c), { size: 'sm' }); el.onclick = () => showDetail(c); g.appendChild(el); });
  }
  function showDetail(c) {
    const m = $('modal-in'); m.innerHTML = ''; m.appendChild(CV.card(c, artOf(c), { size: 'lg' }));
    const row = document.createElement('div'); row.className = 'row';
    row.innerHTML = `<span class="meta">${c.source === 'book' ? '撮影した本' : 'はじまりの魔導書'}・${S.RARITY_JA[c.rarity]}</span>`;
    if (c.source === 'book') { const d = document.createElement('button'); d.className = 'btn small danger'; d.textContent = '削除'; d.onclick = async () => { if (!confirm('この魔導書を削除しますか？')) return; await DB.del(c.id); userCards = userCards.filter(r => r.id !== c.id); const dk = store.get('deck', null); if (dk) store.set('deck', dk.filter(i => i !== c.id)); closeModal(); renderCollection(); toast('削除しました'); }; row.appendChild(d); }
    const x = document.createElement('button'); x.className = 'btn small'; x.textContent = '閉じる'; x.onclick = closeModal; row.appendChild(x);
    m.appendChild(row); $('modal').classList.remove('hidden');
  }
  function closeModal() { $('modal').classList.add('hidden'); }
  $('modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };

  // ---------- deck ----------
  function deckIds() { const ids = store.get('deck', null); return ids ? ids.filter(i => allCards().some(c => c.id === i)) : null; }
  function autoAddToDeck(id) { const d = deckIds(); if (d && d.length < 20 && !d.includes(id)) { d.push(id); store.set('deck', d); } }
  function autoDeck() { const books = userCards.map(r => r.card).sort((a, b) => a.cost - b.cost); const st = Starters.CARDS; return books.concat(st).slice(0, 20).map(c => c.id); }
  function buildDeck() {
    const ids = deckIds() || autoDeck(), all = allCards(); const d = ids.map(i => all.find(c => c.id === i)).filter(Boolean);
    for (const c of Starters.CARDS) { if (d.length >= 20) break; if (!d.some(x => x.id === c.id)) d.push(c); }
    return d.slice(0, 20);
  }
  function renderDeck() {
    let ids = deckIds(); if (!ids) { ids = autoDeck(); store.set('deck', ids); }
    $('deck-count').textContent = `${ids.length} / 20`;
    const g = $('deck-grid'); g.innerHTML = '';
    const sorted = allCards().slice().sort((a, b) => a.cost - b.cost);
    sorted.forEach(c => { const el = CV.card(c, artOf(c), { size: 'sm' }); if (ids.includes(c.id)) el.classList.add('in-deck');
      el.onclick = () => { let d = deckIds() || []; if (d.includes(c.id)) d = d.filter(i => i !== c.id); else if (d.length >= 20) { toast('デッキは20枚までです'); return; } else d.push(c.id); store.set('deck', d); renderDeck(); };
      g.appendChild(el); });
  }
  $('deck-auto').onclick = () => { store.set('deck', autoDeck()); renderDeck(); };
  $('deck-clear').onclick = () => { store.set('deck', []); renderDeck(); };

  // ---------- CPU deck ----------
  const CPU_TITLES = ['焔の王の遺言', '凍てつく湖の歌', '天空図書館', '岩窟の守り手', '暁の聖典', '終焉の夜想曲', '雷鳴の旅路', '森羅の手帖', '蒼き潮の記録', '影法師の詩', '金色の祈り', '赤き竜の眠り', '霧の森の地図', '星降る丘', '黒猫の魔術', '嵐の海図', '大地の心臓', '白銀の翼', '月下の契約', '灯火の書簡'];
  function cpuDeck(level) {
    const pal = i => [{ r: (i * 53) % 255, g: (i * 97) % 255, b: (i * 31) % 255, weight: 1 }];
    const books = CPU_TITLES.map((t, i) => ({ ...S.buildCard({ title: t, palette: pal(i) }), source: 'cpu', flavor: '敵の魔導士が携える魔導書。' }));
    const pick = level === 1 ? books.slice(0, 10).concat(Starters.CARDS.slice(0, 10)) : level === 2 ? books.slice(0, 14).concat(Starters.CARDS.slice(6, 12)) : books;
    return pick.map((c, i) => ({ ...c, id: c.id + (c.source === 'cpu' ? '' : '_c') }));
  }

  // ---------- battle ----------
  let G = null, cpu = null, level = 2, sel = null, busy = false;
  const D = () => (window.GB_FAST ? 30 : 650);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  document.querySelectorAll('[data-lv]').forEach(b => b.onclick = () => startBattle(+b.dataset.lv));
  function startBattle(lv) {
    level = lv; cpu = new AI.CPU(lv, Date.now() & 0xffff); sel = null; busy = false;
    G = R.newGame(buildDeck(), cpuDeck(lv), (Math.random() * 1e9) >>> 0); G.events = [];
    $('name1').textContent = LV_NAME[lv]; show('battle'); renderBattle();
  }
  function manaHtml(p) { let s = ''; for (let i = 0; i < p.maxMana; i++) s += `<i class="${i < p.mana ? 'on' : ''}"></i>`; return `<span class="mtxt">${p.mana}/${p.maxMana}</span>` + s; }
  function renderBattle() {
    const me = G.players[0], en = G.players[1];
    $('hp0').textContent = Math.max(0, me.hp); $('hp1').textContent = Math.max(0, en.hp);
    $('mana0').innerHTML = manaHtml(me); $('mana1').innerHTML = manaHtml(en);
    $('hand1').textContent = en.hand.length; $('deck1').textContent = en.deck.length; $('deck0').textContent = me.deck.length;
    const myTurn = G.turn === 0 && G.winner == null && !busy;
    $('turn-label').textContent = G.winner != null ? '' : G.turn === 0 ? `あなたのターン（${Math.ceil(G.turnNo / 2)}）` : '相手のターン…';
    $('end-btn').disabled = !myTurn;
    [0, 1].forEach(pi => { const b = $('board' + pi); b.innerHTML = ''; G.players[pi].board.forEach(m => { const el = CV.minion(m, artOf(m.card)); if (sel === m.uid) el.classList.add('sel'); el.onclick = () => clickMinion(pi, m); b.appendChild(el); }); });
    const tg = sel ? R.legalTargets(G, 0) : [];
    document.querySelectorAll('#board1 .minion').forEach(el => el.classList.toggle('target', tg.includes(+el.dataset.uid)));
    $('hero1').classList.toggle('target', tg.includes('hero'));
    const h = $('hand0'); h.innerHTML = '';
    me.hand.forEach((c, i) => { const el = CV.card(c, artOf(c), { size: 'xs' }); if (myTurn && c.cost <= me.mana && me.board.length < R.BOARD_MAX) el.classList.add('playable'); el.onclick = () => clickHand(i); h.appendChild(el); });
    $('battle-hint').textContent = sel ? '攻撃する相手をタップ（光っている相手）' : myTurn ? 'カードをタップして出す・使い魔をタップして攻撃' : '';
  }
  function fx(events) {
    for (const e of events) {
      if (e.t === 'hit') { const el = e.uid === 'hero' ? $('hero' + e.p) : document.querySelector(`#board${e.p} [data-uid="${e.uid}"]`); if (el) popNum(el, '-' + e.v + (e.mult > 1 ? '!' : ''), e.mult > 1 ? 'crit' : 'dmg'); }
      if (e.t === 'heal') popNum($('hero' + e.p), '+' + e.v, 'heal');
      if (e.t === 'fatigue') popNum($('hero' + e.p), '-' + e.v, 'dmg');
    }
  }
  function popNum(el, txt, cls) { const r = el.getBoundingClientRect(), n = document.createElement('div'); n.className = 'pop ' + cls; n.textContent = txt; n.style.left = r.left + r.width / 2 + 'px'; n.style.top = r.top + r.height / 2 + 'px'; document.body.appendChild(n); setTimeout(() => n.remove(), 900); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
  function act(a) {
    const pre = G.players.map(p => p.board.map(m => m.uid));
    R.apply(G, a); const ev = G.events; G.events = [];
    renderBattle(); fx(ev);
    // dead minions were removed already; flash where they were is skipped for simplicity
    if (ev.some(e => e.t === 'play')) { const u = ev.find(e => e.t === 'play').uid; const el = document.querySelector(`[data-uid="${u}"]`); if (el) el.classList.add('summoned'); }
    if (G.winner != null) setTimeout(finish, window.GB_FAST ? 50 : 900);
    return pre;
  }
  function clickHand(i) {
    if (G.turn !== 0 || busy || G.winner != null) return;
    const c = G.players[0].hand[i];
    if (c.cost > G.players[0].mana) { toast('魔力が足りません'); return; }
    if (G.players[0].board.length >= R.BOARD_MAX) { toast('場がいっぱいです'); return; }
    sel = null; act({ type: 'play', idx: i });
  }
  function clickMinion(pi, m) {
    if (G.turn !== 0 || busy || G.winner != null) return;
    if (pi === 0) { if (!m.canAttack || m.atk <= 0) { toast(m.atk <= 0 ? 'この使い魔は攻撃できません' : '次のターンから攻撃できます'); return; } sel = sel === m.uid ? null : m.uid; renderBattle(); return; }
    if (sel) { if (!R.legalTargets(G, 0).includes(m.uid)) { toast('挑発を持つ使い魔を先に倒してください'); return; } const a = { type: 'attack', from: sel, to: m.uid }; sel = null; act(a); }
    else showDetail(m.card);
  }
  $('hero1').onclick = () => { if (!sel || G.turn !== 0 || busy) return; if (!R.legalTargets(G, 0).includes('hero')) { toast('挑発を持つ使い魔を先に倒してください'); return; } const a = { type: 'attack', from: sel, to: 'hero' }; sel = null; act(a); };
  $('end-btn').onclick = () => { if (G.turn !== 0 || busy) return; sel = null; act({ type: 'end' }); cpuTurn(); };
  $('menu-btn').onclick = () => { if (confirm('バトルをやめて降参しますか？')) { G.winner = 1; finish(); } };
  async function cpuTurn() {
    busy = true; renderBattle(); await wait(D());
    let n = 0;
    while (G && G.winner == null && G.turn === 1 && n++ < 60 && current === 'battle') { const a = cpu.choose(G); act(a); await wait(a.type === 'end' ? 0 : D()); }
    busy = false; if (G && G.winner == null) renderBattle();
  }
  function finish() {
    if (current !== 'battle') return;
    const win = G.winner === 0; const rec = store.get('records', { 1: { w: 0, l: 0 }, 2: { w: 0, l: 0 }, 3: { w: 0, l: 0 } });
    rec[level][win ? 'w' : 'l']++; store.set('records', rec);
    const hist = store.get('history', []); hist.unshift({ lv: level, win, turns: Math.ceil(G.turnNo / 2), at: Date.now() }); store.set('history', hist.slice(0, 20));
    $('res-title').textContent = win ? '勝利！' : '敗北…'; $('s-result').classList.toggle('lose', !win);
    $('res-sub').textContent = `${LV_NAME[level]}に${win ? '勝ちました' : '負けました'}（${Math.ceil(G.turnNo / 2)}ターン）`;
    renderRecords($('res-rec')); window.GB_lastResult = { win, level, turns: G.turnNo }; show('result');
  }
  $('res-again').onclick = () => startBattle(level);
  function renderRecords(el) {
    const rec = store.get('records', { 1: { w: 0, l: 0 }, 2: { w: 0, l: 0 }, 3: { w: 0, l: 0 } }), hist = store.get('history', []);
    el.innerHTML = '<table><tr><th>相手</th><th>勝</th><th>負</th><th>勝率</th></tr>' + [1, 2, 3].map(l => { const r = rec[l], t = r.w + r.l; return `<tr><td>${LV_NAME[l]}</td><td>${r.w}</td><td>${r.l}</td><td>${t ? Math.round(100 * r.w / t) + '%' : '-'}</td></tr>`; }).join('') + '</table>' +
      (hist.length ? '<h3>最近のバトル</h3><ul>' + hist.slice(0, 8).map(h => `<li>${new Date(h.at).toLocaleDateString('ja-JP')} ${LV_NAME[h.lv]} <b class="${h.win ? 'w' : 'l'}">${h.win ? '勝ち' : '負け'}</b> ${h.turns}ターン</li>`).join('') + '</ul>' : '');
  }

  window.GB = { show, startBattle, get G() { return G; }, get busy() { return busy; }, buildDeck, allCards, userCards: () => userCards, gotImage, act, cpuTurn, showDetail, closeModal, loadCards };
  loadCards().then(() => { window.GB_ready = true; });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
