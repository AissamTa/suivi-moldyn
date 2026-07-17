/* ═══════════════════════════════════════════════════════════════
   utils.js — Fonctions utilitaires partagées
   Utilisées par app.js ET export-excel.js.
   ═══════════════════════════════════════════════════════════════ */

/** Échappe le HTML avant insertion dans le DOM. */
function esc(s){
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[c]));
}

/** '2026-07-16' -> '16/07/2026'. La valeur stockée reste en ISO (triable). */
function frDate(iso){
  const p = String(iso || '').split('-');
  return (p.length === 3 && p[0] && p[1] && p[2])
    ? `${p[2]}/${p[1]}/${p[0]}`
    : String(iso || '');
}

/** Date du jour au format ISO. */
function todayISO(){
  const d = new Date();
  return d.getFullYear() + '-' +
         String(d.getMonth() + 1).padStart(2, '0') + '-' +
         String(d.getDate()).padStart(2, '0');
}

/** Heure courante 'HH:MM'. */
function nowHM(){
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' +
         String(d.getMinutes()).padStart(2, '0');
}

/** Identifiant unique de fiche. */
function uid(){
  return 'e' + Date.now() + Math.random().toString(36).slice(2, 7);
}

/**
 * Copie profonde.
 * Indispensable à l'enregistrement : sans elle, la fiche enregistrée
 * et le formulaire partagent les mêmes objets, et modifier le
 * formulaire altère silencieusement une fiche déjà enregistrée.
 */
function deepCopy(o){
  return JSON.parse(JSON.stringify(o));
}

/**
 * Compare deux versions « 8.0.0 ».
 * Renvoie 1 si a > b, -1 si a < b, 0 si égales.
 */
function compareVersions(a, b){
  const pa = String(a).replace(/^v/, '').split('.').map(n => parseInt(n) || 0);
  const pb = String(b).replace(/^v/, '').split('.').map(n => parseInt(n) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++){
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}


/* Convertit un ArrayBuffer en chaîne base64 (nécessaire pour Filesystem.writeFile). */
function arrayBufferToBase64(buffer){
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++){
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
