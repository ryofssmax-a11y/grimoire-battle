// 魔導書バトル: 20 built-in starter grimoires with original procedural SVG art.
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(require('./statgen.js')); else root.Starters = f(root.StatGen); })(this, function (S) {
  'use strict';
  // [title, element, cost, atk, hp, effect, value, rarity]
  const RAW = [
    ['火種の手記', 'fire', 1, 2, 1, 'haste', 0, 'common'],
    ['紅蓮の詠唱', 'fire', 3, 3, 2, 'aoe', 1, 'rare'],
    ['灼竜の黙示', 'fire', 6, 6, 5, 'drain', 2, 'epic'],
    ['しずく写本', 'water', 1, 1, 2, 'heal', 2, 'common'],
    ['潮騒の祈祷書', 'water', 3, 2, 4, 'heal', 3, 'common'],
    ['深淵の水鏡', 'water', 5, 4, 5, 'draw', 1, 'rare'],
    ['そよ風の頁', 'wind', 2, 2, 2, 'draw', 1, 'common'],
    ['疾風の飛翔録', 'wind', 2, 3, 1, 'haste', 0, 'common'],
    ['嵐呼びの巻物', 'wind', 7, 5, 6, 'aoe', 2, 'epic'],
    ['苔むす石版', 'earth', 2, 1, 4, 'taunt', 0, 'common'],
    ['大樹の年代記', 'earth', 4, 3, 6, 'taunt', 0, 'rare'],
    ['巨岩の法典', 'earth', 6, 4, 8, 'taunt', 0, 'rare'],
    ['朝焼けの聖句', 'light', 2, 2, 3, 'heal', 2, 'common'],
    ['星読みの暦', 'light', 4, 3, 4, 'draw', 1, 'common'],
    ['天輪の福音', 'light', 8, 7, 7, 'heal', 5, 'legend'],
    ['宵闇の覚え書き', 'dark', 1, 1, 1, 'drain', 1, 'common'],
    ['影縫いの禁書', 'dark', 3, 3, 3, 'drain', 1, 'common'],
    ['月蝕の呪文集', 'dark', 5, 5, 4, 'haste', 0, 'rare'],
    ['冥府の目録', 'dark', 7, 6, 6, 'aoe', 2, 'epic'],
    ['見習いの魔導入門', 'light', 3, 3, 3, 'draw', 1, 'common'],
  ];
  const COLORS = { fire: ['#ff7a3d', '#7a1408'], water: ['#53b8ff', '#0b2a66'], wind: ['#9ff0d0', '#1f6b62'], earth: ['#c9a25a', '#4a3110'], light: ['#fff3b0', '#a2741a'], dark: ['#b07cff', '#16062e'] };
  function art(title, element) {
    const h = S.hash32(title), [c1, c2] = COLORS[element], n = 5 + (h % 4), rot = h % 360;
    let star = '';
    for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 22 : 52; star += (i ? 'L' : 'M') + (100 + r * Math.cos(a)).toFixed(1) + ' ' + (130 + r * Math.sin(a)).toFixed(1); }
    const runes = '✦✧◇◆❖☽☉✶✷✸✹❂⊕⊗△▽☆◎';
    let rt = ''; for (let i = 0; i < 12; i++) rt += runes[(S.hash32(title + i)) % runes.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 260"><defs><radialGradient id="g" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>` +
      `<path id="c" d="M100 130 m-78 0 a78 78 0 1 1 156 0 a78 78 0 1 1 -156 0"/></defs><rect width="200" height="260" fill="url(#g)"/>` +
      `<g opacity=".35" stroke="#fff" fill="none"><circle cx="100" cy="130" r="86"/><circle cx="100" cy="130" r="70"/></g>` +
      `<text font-size="13" fill="#fff" opacity=".55"><textPath href="#c">${rt}${rt}</textPath></text>` +
      `<g transform="rotate(${rot} 100 130)"><path d="${star}Z" fill="none" stroke="#fff" stroke-width="2.5" opacity=".85"/></g>` +
      `<text x="100" y="146" text-anchor="middle" font-size="46" font-family="serif" fill="#fff" opacity=".95">${S.EL_JA[element]}</text></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  const CARDS = RAW.map(([title, element, cost, atk, hp, type, value, rarity], i) => ({
    id: 's' + String(i + 1).padStart(2, '0'), title, name: `『${title}』の書`, element, cost, atk, hp, rarity,
    effect: { type, value }, effectText: S.EFFECT_JA[type](value), flavor: '工房に古くから伝わる、はじまりの魔導書。', source: 'starter',
  }));
  return { CARDS, art };
});
