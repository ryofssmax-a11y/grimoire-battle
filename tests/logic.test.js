const test = require('node:test'), assert = require('node:assert');
const R = require('../js/rules.js'), AI = require('../js/ai.js'), S = require('../js/statgen.js'), St = require('../js/starters.js');
const mk = (o) => ({ id: 'x' + Math.random(), name: 'x', element: 'fire', cost: 1, atk: 1, hp: 1, rarity: 'common', effect: { type: 'none', value: 0 }, ...o });
const deck = (o) => Array.from({ length: 20 }, () => mk(o));
const empty = () => { const s = R.newGame(deck(), deck(), 1); s.players.forEach(p => { p.hand = []; p.board = []; }); return s; };
const minion = (s, pi, o) => { const m = { uid: s.uid++, element: 'fire', atk: 1, hp: 1, maxHp: 1, taunt: false, canAttack: true, card: mk({}), ...o }; s.players[pi].board.push(m); return m; };

test('affinity cycle 火>風>土>水>火 and 光<->闇', () => {
  assert.equal(R.affinity('fire', 'wind'), 1.5); assert.equal(R.affinity('wind', 'earth'), 1.5);
  assert.equal(R.affinity('earth', 'water'), 1.5); assert.equal(R.affinity('water', 'fire'), 1.5);
  assert.equal(R.affinity('wind', 'fire'), 1); assert.equal(R.affinity('fire', 'fire'), 1);
  assert.equal(R.affinity('light', 'dark'), 1.5); assert.equal(R.affinity('dark', 'light'), 1.5);
  assert.equal(R.dmg(4, 'fire', 'wind'), 6); assert.equal(R.dmg(3, 'water', 'fire'), 5);
});
test('affinity applied in combat', () => {
  const s = empty(); const a = minion(s, 0, { element: 'fire', atk: 2, hp: 5 }); const b = minion(s, 1, { element: 'wind', atk: 1, hp: 3 });
  R.apply(s, { type: 'attack', from: a.uid, to: b.uid });
  assert.equal(s.players[1].board.length, 0); assert.equal(a.hp, 4);
});
test('mana starts at 1, +1 per turn, capped at 10', () => {
  const s = R.newGame(deck(), deck(), 3);
  assert.equal(s.players[0].maxMana, 1); assert.equal(s.players[0].mana, 1);
  R.apply(s, { type: 'end' }); assert.equal(s.players[1].maxMana, 1);
  for (let i = 0; i < 30; i++) R.apply(s, { type: 'end' });
  assert.equal(s.players[0].maxMana, 10); assert.equal(s.players[1].maxMana, 10);
});
test('cannot play card costing more than mana; board max 5', () => {
  const s = empty(); s.players[0].hand = [mk({ cost: 2 })];
  assert.ok(!R.legalActions(s).some(a => a.type === 'play'));
  s.players[0].mana = 5; s.players[0].hand = [mk({ cost: 1 })];
  for (let i = 0; i < 5; i++) minion(s, 0, {});
  assert.ok(!R.legalActions(s).some(a => a.type === 'play'));
});
test('summoning sickness and haste', () => {
  const s = empty(); s.players[0].mana = 5; s.players[0].hand = [mk({ cost: 1 }), mk({ cost: 1, effect: { type: 'haste', value: 0 } })];
  R.apply(s, { type: 'play', idx: 0 });
  assert.ok(!R.legalActions(s).some(a => a.type === 'attack'));
  R.apply(s, { type: 'play', idx: 0 });
  const atk = R.legalActions(s).filter(a => a.type === 'attack'); assert.equal(atk.length, 1); assert.equal(atk[0].from, s.players[0].board[1].uid);
});
test('taunt must be attacked first', () => {
  const s = empty(); const a = minion(s, 0, { atk: 3, hp: 3 }); const t = minion(s, 1, { taunt: true, hp: 2 }); minion(s, 1, {});
  const targets = R.legalActions(s).filter(x => x.type === 'attack').map(x => x.to);
  assert.deepEqual(targets, [t.uid]);
  assert.throws(() => R.apply(s, { type: 'attack', from: a.uid, to: 'hero' }));
});
test('spell effects trigger on play (heal, aoe, drain, draw)', () => {
  const s = empty(); const P = s.players[0], E = s.players[1]; P.mana = 10; P.hp = 10;
  minion(s, 1, { hp: 2, element: 'earth' }); minion(s, 1, { hp: 5, element: 'earth' });
  P.hand = [mk({ effect: { type: 'heal', value: 3 } }), mk({ element: 'water', effect: { type: 'aoe', value: 2 } }), mk({ effect: { type: 'drain', value: 2 } }), mk({ effect: { type: 'draw', value: 2 } })];
  R.apply(s, { type: 'play', idx: 0 }); assert.equal(P.hp, 13);
  R.apply(s, { type: 'play', idx: 0 }); assert.equal(E.board.length, 1); assert.equal(E.board[0].hp, 3);
  R.apply(s, { type: 'play', idx: 0 }); assert.equal(E.hp, 18); assert.equal(P.hp, 15);
  const before = P.deck.length; R.apply(s, { type: 'play', idx: 0 }); assert.equal(P.deck.length, before - 2);
});
test('win at enemy HP 0', () => {
  const s = empty(); s.players[1].hp = 3; const a = minion(s, 0, { atk: 3 });
  R.apply(s, { type: 'attack', from: a.uid, to: 'hero' }); assert.equal(s.winner, 0); assert.deepEqual(R.legalActions(s), []);
});
test('CPU lv3 finds lethal through taunt', () => {
  const s = empty(); s.players[1].hp = 4;
  minion(s, 0, { atk: 2, hp: 2 }); minion(s, 0, { atk: 4, hp: 1 }); minion(s, 1, { taunt: true, atk: 0, hp: 2, element: 'water' });
  const cpu = new AI.CPU(3, 1); let n = 0;
  while (s.winner == null && n++ < 10) R.apply(s, cpu.choose(s));
  assert.equal(s.winner, 0);
});
test('CPU lv3 lethal uses drain from hand', () => {
  const s = empty(); s.players[1].hp = 2; s.players[0].mana = 3; s.players[0].hand = [mk({ cost: 3, effect: { type: 'drain', value: 2 } })];
  const p = AI.findLethal(s, 500); assert.ok(p && p[0].type === 'play');
});
test('stat generator is deterministic and balanced', () => {
  const g = new S.DeterministicStatGenerator();
  const inp = { title: '炎の魔術師', palette: [{ r: 200, g: 40, b: 30, weight: 5 }, { r: 20, g: 20, b: 20, weight: 2 }] };
  const a = g.generateSync(inp), b = g.generateSync(JSON.parse(JSON.stringify(inp)));
  assert.deepEqual(a, b);
  // spacing / brackets / width variants of the same title give the same card
  assert.deepEqual(g.generateSync({ ...inp, title: '『炎の 魔術師』' }).id, a.id);
  // small colour noise (same photo, different shot) keeps the card
  assert.equal(g.generateSync({ ...inp, palette: [{ r: 205, g: 44, b: 28, weight: 5 }, { r: 25, g: 18, b: 22, weight: 2 }] }).id, a.id);
  for (let i = 0; i < 500; i++) {
    const c = g.generateSync({ title: 'book' + i, palette: [{ r: i % 255, g: (i * 7) % 255, b: (i * 13) % 255, weight: 1 }] });
    assert.ok(c.cost >= 1 && c.cost <= 8); assert.ok(S.ELEMENTS.includes(c.element)); assert.ok(S.RARITIES.includes(c.rarity));
    assert.ok(S.EFFECTS.includes(c.effect.type)); assert.ok(c.hp >= 1 && c.atk >= 0);
    assert.ok(c.atk + c.hp <= 2 * c.cost + 4, JSON.stringify(c)); assert.ok(c.flavor.length > 5);
  }
});
test('keyword → element', () => {
  const el = t => S.buildCard({ title: t, palette: [{ r: 128, g: 128, b: 128, weight: 1 }] }).element;
  assert.equal(el('炎の魔術師'), 'fire'); assert.equal(el('深い海の底'), 'water'); assert.equal(el('風の谷'), 'wind');
  assert.equal(el('森の生活'), 'earth'); assert.equal(el('星の王子さま'), 'light'); assert.equal(el('夜は短し'), 'dark');
  assert.equal(el('The Ocean at the End'), 'water'); assert.equal(el('Red Sun'), 'fire');
});
test('cover colour decides element when title has no keyword', () => {
  const el = c => S.buildCard({ title: 'あいうえお', palette: [c] }).element;
  assert.equal(el({ r: 220, g: 30, b: 30, weight: 1 }), 'fire'); assert.equal(el({ r: 30, g: 60, b: 210, weight: 1 }), 'water');
  assert.equal(el({ r: 10, g: 10, b: 12, weight: 1 }), 'dark'); assert.equal(el({ r: 40, g: 160, b: 60, weight: 1 }), 'earth');
});
test('StatGenerator interface: AI backend is a stub', async () => {
  assert.ok(new S.DeterministicStatGenerator() instanceof S.StatGenerator);
  await assert.rejects(new S.AIStatGenerator().generate({ title: 'x' }));
});
test('20 starters valid', () => { assert.equal(St.CARDS.length, 20); St.CARDS.forEach(c => assert.ok(St.art(c.title, c.element).startsWith('data:image/svg'))); });
