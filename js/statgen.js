// 魔導書バトル: card stat generation (pure, no DOM). Node + browser.
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.StatGen = f(); })(this, function () {
  'use strict';
  const ELEMENTS = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];
  const EL_JA = { fire: '火', water: '水', wind: '風', earth: '土', light: '光', dark: '闇' };
  const RARITIES = ['common', 'rare', 'epic', 'legend'];
  const RARITY_JA = { common: 'コモン', rare: 'レア', epic: 'エピック', legend: 'レジェンド' };
  const EFFECTS = ['heal', 'aoe', 'taunt', 'draw', 'haste', 'drain'];
  const KEYWORDS = {
    fire: ['炎', '火', '焔', '灼', '燃', '熱', '赤', '紅', '朱', '太陽', '夏', '竜', '龍', '爆', '怒', 'fire', 'flame', 'blaze', 'burn', 'red', 'sun', 'dragon', 'heat'],
    water: ['海', '水', '雨', '青', '蒼', '藍', '氷', '雪', '川', '湖', '涙', '波', '泉', '冬', '魚', 'sea', 'water', 'rain', 'blue', 'ocean', 'ice', 'snow', 'river', 'lake', 'tear', 'wave'],
    wind: ['空', '風', '翼', '鳥', '雲', '嵐', '旅', '飛', '翔', '羽', '春', '自由', 'sky', 'wind', 'wing', 'bird', 'cloud', 'storm', 'fly', 'journey', 'travel'],
    earth: ['山', '森', '土', '石', '岩', '大地', '木', '樹', '花', '緑', '獣', '鉄', '城', '秋', '畑', 'mountain', 'forest', 'earth', 'stone', 'rock', 'tree', 'flower', 'green', 'land', 'iron'],
    light: ['光', '天', '白', '星', '聖', '神', '朝', '夜明', '希望', '愛', '祈', '金', '輝', '奇跡', 'light', 'heaven', 'white', 'star', 'holy', 'god', 'angel', 'dawn', 'hope', 'love', 'gold'],
    dark: ['夜', '闇', '黒', '死', '影', '魔', '鬼', '呪', '血', '罪', '悪', '夢', '月', '殺', '墓', 'night', 'dark', 'black', 'death', 'shadow', 'demon', 'curse', 'blood', 'moon', 'ghost', 'murder'],
  };

  // ---- hashing / rng ----
  function hash32(str) { // FNV-1a
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function normTitle(t) { return String(t || '').normalize('NFKC').replace(/[\s『』「」【】《》〈〉"'“”・:：、。,.!?！？]/g, '').toLowerCase(); }

  // ---- colours ----
  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
    if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
    return [h, s, l];
  }
  function colorElement(c) {
    const [h, s, l] = rgb2hsl(c.r, c.g, c.b);
    if (l < 0.16) return 'dark';
    if (l > 0.86 && s < 0.35) return 'light';
    if (s < 0.14) return l < 0.45 ? 'dark' : 'wind';
    if (h < 22 || h >= 335) return 'fire';
    if (h < 45) return l < 0.4 ? 'earth' : 'fire';
    if (h < 70) return 'light';
    if (h < 165) return 'earth';
    if (h < 200) return 'wind';
    if (h < 255) return 'water';
    return 'dark';
  }
  // coarse, photo-stable fingerprint: hue bucket + brightness bucket of the dominant colour
  function coarseFingerprint(palette) {
    if (!palette || !palette.length) return 'x';
    const c = palette.slice().sort((a, b) => b.weight - a.weight)[0];
    const [h, s, l] = rgb2hsl(c.r, c.g, c.b);
    const hb = s < 0.14 ? 'n' : String(Math.floor(((h + 22.5) % 360) / 45));
    const lb = l < 0.3 ? 'd' : l < 0.7 ? 'm' : 'b';
    return hb + lb;
  }

  function keywordScores(title) {
    const t = String(title || '').normalize('NFKC').toLowerCase(), sc = {};
    for (const el of ELEMENTS) { sc[el] = 0; for (const k of KEYWORDS[el]) if (t.includes(k)) sc[el] += 3; }
    return sc;
  }
  function elementFor(title, palette, r) {
    const sc = keywordScores(title);
    const tot = (palette || []).reduce((a, c) => a + c.weight, 0) || 1;
    for (const c of palette || []) sc[colorElement(c)] += 2 * c.weight / tot;
    let best = -1, out = [];
    for (const el of ELEMENTS) { if (sc[el] > best + 1e-9) { best = sc[el]; out = [el]; } else if (Math.abs(sc[el] - best) < 1e-9) out.push(el); }
    return out[Math.floor(r() * out.length)];
  }

  const FLAVOR = {
    fire: ['頁をめくるたび、指先に熱が宿る。', '綴られた文字は今も燃え続けている。', '{t}――その一節は、灰の中から蘇る。'],
    water: ['静かな頁の奥で、潮騒が聞こえる。', '読む者の心を、深い青へと沈めてゆく。', '{t}――雫ひとつが、運命を映す。'],
    wind: ['開けば頁が勝手に舞い、行き先を告げる。', '綴じ糸は風の精が編んだという。', '{t}――遠い空の匂いがする。'],
    earth: ['重い表紙は、古き大地の記憶を抱く。', '根のように文字が頁に張りめぐらされている。', '{t}――山は語らず、ただ在る。'],
    light: ['閉じていても、隙間から光がこぼれる。', '祈りの言葉が、金の文字で記されている。', '{t}――夜明けを告げる最初の一行。'],
    dark: ['真夜中にだけ、読めない頁が現れる。', 'この書を最後まで読んだ者はいない。', '{t}――影は、読む者の背後に立つ。'],
  };
  const EFFECT_JA = {
    heal: v => `召喚時：自分の体力を${v}回復`, aoe: v => `召喚時：敵の使い魔すべてに${v}ダメージ`,
    taunt: () => '挑発（敵はこの使い魔から攻撃しなければならない）', draw: v => `召喚時：カードを${v}枚引く`,
    haste: () => '速攻（召喚したターンに攻撃できる）', drain: v => `召喚時：敵に${v}ダメージ、自分は${v}回復`,
  };
  const EFFECT_COST = { heal: 0.5, aoe: 1.5, taunt: 1, draw: 1.5, haste: 1, drain: 1 };

  function buildCard(input) {
    const title = String(input.title || '').trim() || '名もなき書';
    const fp = input.fingerprint != null ? input.fingerprint : coarseFingerprint(input.palette);
    const seed = hash32(normTitle(title) + '|' + fp);
    const r = rng(seed);
    const element = elementFor(title, input.palette, r);
    const rr = r();
    const rarity = rr < 0.55 ? 'common' : rr < 0.83 ? 'rare' : rr < 0.96 ? 'epic' : 'legend';
    const rIdx = RARITIES.indexOf(rarity);
    const cost = 1 + Math.min(7, Math.floor(Math.pow(r(), 1.25) * 8));
    const effect = EFFECTS[Math.floor(r() * EFFECTS.length)];
    let value = 0;
    if (effect === 'heal') value = 2 + Math.floor(cost / 2) + rIdx;
    if (effect === 'aoe') value = 1 + Math.floor(cost / 3) + (rIdx >= 2 ? 1 : 0);
    if (effect === 'draw') value = cost >= 6 || rIdx >= 2 ? 2 : 1;
    if (effect === 'drain') value = 1 + Math.floor(cost / 3) + (rIdx >= 2 ? 1 : 0);
    const effCost = EFFECT_COST[effect] * (effect === 'aoe' || effect === 'drain' ? value : effect === 'draw' ? value : effect === 'heal' ? value / 2 : 1);
    let budget = Math.max(2, Math.round(2 * cost + 1 + rIdx * 0.75 - effCost));
    const atkShare = 0.3 + r() * 0.4;
    let atk = Math.max(effect === 'taunt' ? 0 : 1, Math.round(budget * atkShare));
    if (effect === 'taunt') atk = Math.max(0, Math.round(budget * (atkShare - 0.12)));
    let hp = Math.max(1, budget - atk);
    const ft = FLAVOR[element][Math.floor(r() * 3)].replace('{t}', `『${title}』`);
    return {
      id: 'b' + seed.toString(36) + '_' + fp, title, name: `『${title}』の書`, element, cost, atk, hp, rarity,
      effect: { type: effect, value }, effectText: EFFECT_JA[effect](value), flavor: ft, source: 'book', gen: 'deterministic-v1',
    };
  }

  // ---- StatGenerator interface ----
  class StatGenerator { /** @returns {Promise<Card>} input: {title, palette:[{r,g,b,weight}], fingerprint?, imageBlob?} */ async generate(input) { throw new Error('abstract'); } }
  class DeterministicStatGenerator extends StatGenerator { async generate(input) { return buildCard(input); } generateSync(input) { return buildCard(input); } }
  // Placeholder for a future vision-LLM backend. Intentionally not implemented (no paid APIs in the prototype).
  class AIStatGenerator extends StatGenerator { constructor(opts) { super(); this.opts = opts || {}; } async generate(input) { throw new Error('AIStatGenerator is not implemented yet'); } }

  return { ELEMENTS, EL_JA, RARITIES, RARITY_JA, EFFECTS, EFFECT_JA, KEYWORDS, hash32, rng, normTitle, rgb2hsl, colorElement, coarseFingerprint, keywordScores, elementFor, buildCard, StatGenerator, DeterministicStatGenerator, AIStatGenerator };
});
