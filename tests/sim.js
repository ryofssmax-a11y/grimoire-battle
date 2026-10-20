// CPU vs CPU simulation: node tests/sim.js [games]
const R = require('../js/rules.js'), AI = require('../js/ai.js'), St = require('../js/starters.js'), S = require('../js/statgen.js');
const N = +process.argv[2] || 200;
function deck(seed) { // starters + generated book cards for variety
  const extra = []; for (let i = 0; i < 10; i++) extra.push(S.buildCard({ title: 'テスト' + seed + '-' + i, palette: [{ r: (seed * 37 + i * 50) % 255, g: 90, b: 140, weight: 1 }] }));
  return St.CARDS.slice(0, 10).concat(extra).map((c, i) => ({ ...c, id: c.id + '_' + i }));
}
function play(l0, l1, seed) {
  const s = R.newGame(deck(seed), deck(seed + 1), seed); const c = [new AI.CPU(l0, seed * 3 + 1), new AI.CPU(l1, seed * 5 + 2)];
  let steps = 0;
  while (s.winner == null && steps < 5000) { R.apply(s, c[s.turn].choose(s)); s.events = []; steps++; }
  return { w: s.winner, turns: s.turnNo };
}
const out = [];
for (const [a, b] of [[2, 1], [3, 1], [3, 2]]) {
  let wa = 0, wb = 0, dr = 0, t = 0;
  for (let g = 0; g < N; g++) { const swap = g % 2; const r = swap ? play(b, a, g + 11) : play(a, b, g + 11); t += r.turns;
    if (r.w == null) dr++; else if ((r.w === 0) !== !!swap) wa++; else wb++; }
  out.push(`Lv${a} vs Lv${b}: Lv${a} ${wa}勝 / Lv${b} ${wb}勝 / 未決着${dr}  (勝率 ${(100 * wa / N).toFixed(1)}%, 平均${(t / N).toFixed(1)}手番)`);
}
console.log(out.join('\n'));
