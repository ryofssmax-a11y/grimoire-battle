// IndexedDB storage (cards + cover images). Local only.
(function (root) {
  'use strict';
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => { const r = indexedDB.open('grimoire-battle', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('cards', { keyPath: 'id' });
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    return dbp;
  }
  async function tx(mode, fn) { const db = await open(); return new Promise((res, rej) => { const t = db.transaction('cards', mode), st = t.objectStore('cards'); const out = fn(st); t.oncomplete = () => res(out && out.result !== undefined ? out.result : out); t.onerror = () => rej(t.error); }); }
  const DB = {
    put: rec => tx('readwrite', st => st.put(rec)),
    get: id => tx('readonly', st => st.get(id)),
    del: id => tx('readwrite', st => st.delete(id)),
    all: () => tx('readonly', st => st.getAll()),
    clear: () => tx('readwrite', st => st.clear()),
  };
  root.DB = DB;
})(this);
