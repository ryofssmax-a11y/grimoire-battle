// 魔導書バトル: CPU players. level 1 random legal, 2 greedy, 3 lookahead + lethal search.
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(require('./rules.js')); else root.AI = f(root.Rules); })(this, function (R) {
  'use strict';
  function rand(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function lv1(s, r) {
    const acts = R.legalActions(s), non = acts.filter(a => a.type !== 'end');
    if (!non.length || r() < 0.15) return { type: 'end' };
    return non[Math.floor(r() * non.length)];
  }
  function lv2(s) {
    const p = s.players[s.turn], e = s.players[1 - s.turn], acts = R.legalActions(s);
    const plays = acts.filter(a => a.type === 'play').sort((a, b) => p.hand[b.idx].cost - p.hand[a.idx].cost);
    if (plays.length) return plays[0];
    const atks = acts.filter(a => a.type === 'attack');
    if (!atks.length) return { type: 'end' };
    // free kill if possible, else face, else hit taunt with biggest attacker
    let best = null, bs = -1e9;
    for (const a of atks) {
      const m = p.board.find(x => x.uid === a.from);
      if (a.to === 'hero') { const v = m.atk; if (v > bs) { bs = v; best = a; } continue; }
      const t = e.board.find(x => x.uid === a.to);
      const kills = R.dmg(m.atk, m.element, t.element) >= t.hp, dies = R.dmg(t.atk, t.element, m.element) >= m.hp;
      const v = kills && !dies ? 100 + t.atk : kills ? 1 + t.atk - m.atk : -5 + m.atk * 0.1;
      if (v > bs) { bs = v; best = a; }
    }
    return best;
  }
  // board evaluation from the perspective of player me
  function evaluate(s, me) {
    if (s.winner != null) return s.winner === me ? 1e6 : -1e6;
    const P = s.players[me], E = s.players[1 - me];
    const mv = b => b.reduce((a, m) => a + m.atk * 1.2 + m.hp * 1 + (m.taunt ? 1.5 : 0) + 0.5, 0);
    const eThreat = E.board.reduce((a, m) => a + m.atk, 0), pThreat = P.board.reduce((a, m) => a + m.atk, 0);
    let v = (P.hp - E.hp) * 1.0 + mv(P.board) - mv(E.board) * 1.1 + (P.hand.length - E.hand.length) * 0.8;
    if (P.hp - eThreat <= 0) v -= 40; else if (P.hp - eThreat <= 5) v -= (6 - (P.hp - eThreat)) * 2;
    if (E.hp <= pThreat) v += 15;
    v += Math.max(0, 20 - E.hp) * 0.4; // aggression bonus
    return v;
  }
  function key(a) { return a.type + ':' + (a.idx ?? '') + ':' + (a.from ?? '') + ':' + (a.to ?? ''); }
  // depth-first lethal search inside the current turn (node-capped)
  function findLethal(s, cap) {
    const me = s.turn; let nodes = 0;
    function dfs(st, path) {
      if (st.winner === me) return path;
      if (++nodes > cap) return null;
      const acts = R.legalActions(st).filter(a => a.type !== 'end');
      // order: plays first, attacks to hero first
      acts.sort((a, b) => (a.type === 'play' ? 0 : a.to === 'hero' ? 1 : 2) - (b.type === 'play' ? 0 : b.to === 'hero' ? 1 : 2));
      // quick bound: max possible face damage
      const P = st.players[me], E = st.players[1 - me];
      const dmgNow = P.board.filter(m => m.canAttack).reduce((x, m) => x + m.atk, 0) + P.hand.filter(c => c.cost <= P.mana).reduce((x, c) => x + (c.effect.type === 'drain' ? c.effect.value : 0) + (c.effect.type === 'haste' ? c.atk : 0), 0);
      if (dmgNow < E.hp) return null;
      for (const a of acts) { const n = R.apply(R.clone(st), a); n.events = []; const r = dfs(n, path.concat([a])); if (r) return r; if (nodes > cap) return null; }
      return null;
    }
    const c = R.clone(s); c.events = [];
    return dfs(c, []);
  }
  function lv3(s, mem) {
    if (mem.plan && mem.plan.length && mem.planTurn === s.turnNo) { const a = mem.plan.shift(); if (R.isLegal(s, a)) return a; mem.plan = null; }
    const lethal = findLethal(s, 3000);
    if (lethal && lethal.length) { mem.plan = lethal.slice(1); mem.planTurn = s.turnNo; return lethal[0]; }
    const me = s.turn, base = evaluate(s, me);
    let best = { type: 'end' }, bv = base + 0.01;
    for (const a of R.legalActions(s)) {
      if (a.type === 'end') continue;
      const n = R.apply(R.clone(s), a);
      // one more ply of own best follow-up (2-step lookahead)
      let v = evaluate(n, me);
      if (n.winner == null) for (const b of R.legalActions(n)) { if (b.type === 'end') continue; const n2 = R.apply(R.clone(n), b); v = Math.max(v, evaluate(n2, me) - 0.05); }
      if (v > bv) { bv = v; best = a; }
    }
    return best;
  }
  class CPU {
    constructor(level, seed) { this.level = level; this.r = rand(seed || 7); this.mem = {}; }
    choose(s) { return this.level === 1 ? lv1(s, this.r) : this.level === 2 ? lv2(s) : lv3(s, this.mem); }
  }
  return { CPU, evaluate, findLethal, lv1, lv2, lv3 };
});
