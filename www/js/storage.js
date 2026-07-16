/* ═══════════════════════════════════════════════════════════════
   storage.js — Où atterrissent les fiches

   Trois niveaux, du meilleur au moindre :
     1. window.storage fourni par l'hôte  → partagé avec l'équipe
     2. localStorage de l'appareil        → local, conservé (APK, navigateur)
     3. mémoire seule                     → si localStorage est refusé
                                            (aperçu, navigation privée)

   Le niveau retenu est lisible via window.__localOnly / __memoryOnly,
   ce qui permet à l'application de dire la vérité à l'opérateur au
   moment de l'enregistrement.
   ═══════════════════════════════════════════════════════════════ */

window.__localOnly = false;
window.__memoryOnly = false;

if (typeof window.storage === 'undefined' || !window.storage){
  window.__localOnly = true;

  let store = null;
  try {
    const probe = '__sp_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    store = localStorage;
  } catch (err) {
    window.__memoryOnly = true;
    const mem = new Map();
    store = {
      getItem: k => mem.has(k) ? mem.get(k) : null,
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: k => mem.delete(k),
      key: i => [...mem.keys()][i] ?? null,
      get length(){ return mem.size; }
    };
  }

  window.storage = {
    async get(key){
      const v = store.getItem('sp_' + key);
      return v === null ? null : { key, value: v };
    },
    async set(key, value){
      store.setItem('sp_' + key, value);
      return { key, value };
    },
    async delete(key){
      store.removeItem('sp_' + key);
      return { key, deleted: true };
    },
    async list(prefix){
      const keys = [];
      for (let i = 0; i < store.length; i++){
        const k = store.key(i);
        if (k && k.indexOf('sp_' + (prefix || '')) === 0) keys.push(k.slice(3));
      }
      return { keys, prefix };
    }
  };
}

/** Index des identifiants de fiches. */
async function getIndex(){
  try {
    const r = await window.storage.get('index', true);
    if (r && r.value){
      const arr = JSON.parse(r.value);
      if (Array.isArray(arr)) return arr;
    }
  } catch (err) {}
  return [];
}

async function setIndex(arr){
  try { await window.storage.set('index', JSON.stringify(arr), true); } catch (err) {}
}
