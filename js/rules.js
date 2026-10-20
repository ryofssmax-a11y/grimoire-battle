// 魔導書バトル: battle rules (pure, no DOM).
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.Rules = f(); })(this, function () {
  'use strict';
  const HERO_HP = 20, MAX_MANA = 10, BOARD_MAX = 5, HAND_MAX = 10, DECK_SIZE = 20;
  const BEATS = { fire: 'wind', wind: 'earth', earth: 'water', water: 'fire' };
  function affinity(att, def) {
    if (!att || !def) return 1;
    if (BEATS[att] === def) return 1.5;
    if ((att === 'light' && def === 'dark') || (att === 'dark' && def === 'light')) return 1.5;
    return 1;
  }
  function dmg(amount, attEl, defEl) { return amount <= 0 ? 0 : Math.round(amount * affinity(attEl, defEl)); }
  function rng(state) { let a = state.rng >>> 0; a = (a + 0x6D2B79F5) >>> 0; state.rng = a; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  function shuffle(state, arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng(state) * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

  function newGame(deck0, deck1, seed) {
    const s = { rng: (seed >>> 0) || 1, turn: 0, turnNo: 0, winner: null, uid: 1, log: [], events: [],
      players: [deck0, deck1].map(d => ({ hp: HERO_HP, mana: 0, maxMana: 0, deck: d.map(c => ({ ...c })), hand: [], board: [], fatigue: 0 })) };
    s.players.forEach(p => shuffle(s, p.deck));
    for (let i = 0; i < 3; i++) draw(s, 0);
    for (let i = 0; i < 4; i++) draw(s, 1);
    startTurn(s);
    return s;
  }
  function ev(s, e) { s.events.push(e); }
  function draw(s, pi) {
    const p = s.players[pi];
    if (!p.deck.length) { p.fatigue++; p.hp -= p.fatigue; ev(s, { t: 'fatigue', p: pi, v: p.fatigue }); checkWin(s); return; }
    const c = p.deck.shift();
    if (p.hand.length >= HAND_MAX) { ev(s, { t: 'burn', p: pi, card: c.name }); return; }
    p.hand.push(c); ev(s, { t: 'draw', p: pi });
  }
  function startTurn(s) {
    s.turnNo++;
    const p = s.players[s.turn];
    p.maxMana = Math.min(MAX_MANA, p.maxMana + 1); p.mana = p.maxMana;
    p.board.forEach(m => { m.canAttack = true; });
    draw(s, s.turn);
  }
  function checkWin(s) {
    if (s.winner != null) return;
    const d0 = s.players[0].hp <= 0, d1 = s.players[1].hp <= 0;
    if (d0 && d1) s.winner = s.turn; else if (d0) s.winner = 1; else if (d1) s.winner = 0;
  }
  function hasTaunt(p) { return p.board.some(m => m.taunt); }
  function legalTargets(s, pi) { // targets the side pi may attack
    const e = s.players[1 - pi];
    if (hasTaunt(e)) return e.board.filter(m => m.taunt).map(m => m.uid);
    return ['hero'].concat(e.board.map(m => m.uid));
  }
  function legalActions(s) {
    if (s.winner != null) return [];
    const pi = s.turn, p = s.players[pi], out = [];
    p.hand.forEach((c, i) => { if (c.cost <= p.mana && p.board.length < BOARD_MAX) out.push({ type: 'play', idx: i }); });
    const tg = legalTargets(s, pi);
    p.board.forEach(m => { if (m.canAttack && m.atk > 0) tg.forEach(t => out.push({ type: 'attack', from: m.uid, to: t })); });
    out.push({ type: 'end' });
    return out;
  }
  function isLegal(s, a) { return legalActions(s).some(b => b.type === a.type && b.idx === a.idx && b.from === a.from && b.to === a.to); }
  function healHero(p, v) { p.hp = Math.min(HERO_HP, p.hp + v); }
  function removeDead(s) {
    s.players.forEach((p, pi) => { p.board = p.board.filter(m => { if (m.hp <= 0) { ev(s, { t: 'die', p: pi, uid: m.uid }); return false; } return true; }); });
  }
  function apply(s, a) {
    if (s.winner != null) return s;
    if (!isLegal(s, a)) throw new Error('illegal action ' + JSON.stringify(a));
    const pi = s.turn, p = s.players[pi], e = s.players[1 - pi];
    if (a.type === 'end') { s.turn = 1 - s.turn; ev(s, { t: 'end', p: pi }); startTurn(s); return s; }
    if (a.type === 'play') {
      const c = p.hand.splice(a.idx, 1)[0];
      p.mana -= c.cost;
      const ef = c.effect || { type: 'none', value: 0 };
      const m = { uid: s.uid++, card: c, element: c.element, atk: c.atk, hp: c.hp, maxHp: c.hp, taunt: ef.type === 'taunt', canAttack: ef.type === 'haste' };
      p.board.push(m); ev(s, { t: 'play', p: pi, uid: m.uid, name: c.name });
      if (ef.type === 'heal') { healHero(p, ef.value); ev(s, { t: 'heal', p: pi, v: ef.value }); }
      if (ef.type === 'aoe') { e.board.forEach(t => { const d = dmg(ef.value, c.element, t.element); t.hp -= d; ev(s, { t: 'hit', p: 1 - pi, uid: t.uid, v: d }); }); removeDead(s); }
      if (ef.type === 'draw') for (let i = 0; i < ef.value; i++) draw(s, pi);
      if (ef.type === 'drain') { e.hp -= ef.value; healHero(p, ef.value); ev(s, { t: 'hit', p: 1 - pi, uid: 'hero', v: ef.value }); ev(s, { t: 'heal', p: pi, v: ef.value }); }
      checkWin(s); return s;
    }
    if (a.type === 'attack') {
      const m = p.board.find(x => x.uid === a.from); m.canAttack = false;
      if (a.to === 'hero') { e.hp -= m.atk; ev(s, { t: 'hit', p: 1 - pi, uid: 'hero', v: m.atk, from: m.uid }); }
      else {
        const t = e.board.find(x => x.uid === a.to);
        const d1 = dmg(m.atk, m.element, t.element), d2 = dmg(t.atk, t.element, m.element);
        t.hp -= d1; m.hp -= d2;
        ev(s, { t: 'hit', p: 1 - pi, uid: t.uid, v: d1, from: m.uid, mult: affinity(m.element, t.element) });
        if (d2) ev(s, { t: 'hit', p: pi, uid: m.uid, v: d2 });
        removeDead(s);
      }
      checkWin(s); return s;
    }
    return s;
  }
  function clone(s) { const ev0 = s.events; s.events = []; const c = JSON.parse(JSON.stringify(s)); s.events = ev0; return c; }
  return { HERO_HP, MAX_MANA, BOARD_MAX, HAND_MAX, DECK_SIZE, affinity, dmg, newGame, legalActions, legalTargets, isLegal, apply, clone, hasTaunt };
});
