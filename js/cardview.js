// Card DOM rendering (parchment grimoire frame).
(function (root) {
  'use strict';
  const S = root.StatGen;
  const RUNES = '✦✧◇◆❖☽☉✶✷✸✹❂⊕⊗△▽☆◎';
  const ICON = { heal: '✚', aoe: '✸', taunt: '🛡', draw: '❖', haste: '➤', drain: '☾' };
  function runes(seed) { const r = root.StatGen.rng(seed); let s = ''; for (let i = 0; i < 9; i++) s += RUNES[Math.floor(r() * RUNES.length)]; return s; }
  function esc(t) { return String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function card(c, artUrl, opts) {
    opts = opts || {};
    const el = document.createElement('div');
    el.className = `card el-${c.element} r-${c.rarity}` + (opts.size ? ' ' + opts.size : '');
    el.dataset.id = c.id;
    el.innerHTML = `<div class="cf"><div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
      <div class="c-cost">${c.cost}</div><div class="c-el">${S.EL_JA[c.element]}</div>
      <div class="c-art"><img alt="" src="${artUrl}"></div>
      <div class="c-name">${esc(c.name)}</div><div class="c-runes">${runes(S.hash32(c.id))}</div>
      <div class="c-text"><span class="ef">${ICON[c.effect.type] || ''}</span> ${esc(c.effectText)}</div>
      <div class="c-flavor">${esc(c.flavor)}</div>
      <div class="c-stats"><span class="c-atk">${c.atk}</span><span class="c-seal" title="${S.RARITY_JA[c.rarity]}">${'★'.repeat(S.RARITIES.indexOf(c.rarity) + 1)}</span><span class="c-hp">${c.hp}</span></div></div>`;
    return el;
  }
  function minion(m, artUrl) {
    const el = document.createElement('div');
    el.className = `minion el-${m.element} r-${m.card.rarity}` + (m.taunt ? ' taunt' : '') + (m.canAttack && m.atk > 0 ? ' ready' : ' sleep');
    el.dataset.uid = m.uid;
    el.innerHTML = `<div class="m-art"><img alt="" src="${artUrl}"></div><span class="m-el">${S.EL_JA[m.element]}</span>${m.card.effect.type !== 'taunt' && ICON[m.card.effect.type] ? '' : ''}<span class="m-atk">${m.atk}</span><span class="m-hp${m.hp < m.maxHp ? ' hurt' : ''}">${m.hp}</span>`;
    return el;
  }
  root.CardView = { card, minion, esc };
})(this);
