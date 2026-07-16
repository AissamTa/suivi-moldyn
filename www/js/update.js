/* ═══════════════════════════════════════════════════════════════
   update.js — Vérification des mises à jour via GitHub Releases

   Interroge la dernière release publiée du dépôt et compare son tag
   à MOLDYN_CONFIG.VERSION. Si une version plus récente existe, un
   bandeau apparaît en haut de la fiche.

   Deux comportements selon le contexte :

     · APK (Capacitor)  → propose le téléchargement du .apk joint à
                          la release. Android demandera l'autorisation
                          « installer des applications inconnues ».
     · Web (PWA)        → propose de recharger : le service worker
                          renouvelle son cache dès que la VERSION
                          change, il suffit de rouvrir l'application.

   Aucune authentification : l'API publique de GitHub suffit pour un
   dépôt public (60 requêtes/heure/IP, largement au-delà du besoin).
   La vérification est silencieuse en cas d'échec — hors ligne, une
   panne réseau ou un quota atteint ne doivent jamais gêner la saisie.
   ═══════════════════════════════════════════════════════════════ */

const UPDATE_SEEN_KEY = 'update_dismissed';

/** Vrai si l'application tourne dans l'APK Capacitor. */
function isNativeApp(){
  return typeof window.Capacitor !== 'undefined' &&
         typeof window.Capacitor.isNativePlatform === 'function' &&
         window.Capacitor.isNativePlatform();
}

async function checkForUpdate(){
  const cfg = MOLDYN_CONFIG.UPDATE;
  if (!cfg || !cfg.ENABLED || !cfg.REPO) return;

  // Ne pas interroger GitHub à chaque ouverture
  const lastKey = 'update_last_check';
  try {
    const last = await window.storage.get(lastKey);
    if (last && last.value){
      const ecoule = (Date.now() - parseInt(last.value)) / 36e5;
      if (ecoule < (cfg.CHECK_EVERY_HOURS || 6)) return;
    }
  } catch (err) {}

  let release;
  try {
    const res = await fetch(`https://api.github.com/repos/${cfg.REPO}/releases/latest`, {
      headers: { 'Accept': 'application/vnd.github+json' }
    });
    if (!res.ok) return;               // 404 = aucune release publiée : normal
    release = await res.json();
  } catch (err) {
    return;                            // hors ligne : on n'insiste pas
  }

  try { await window.storage.set(lastKey, String(Date.now())); } catch (err) {}

  const distante = String(release.tag_name || '').replace(/^v/, '');
  if (!distante) return;
  if (compareVersions(distante, MOLDYN_CONFIG.VERSION) <= 0) return;  // déjà à jour

  // Version déjà refusée par l'opérateur : ne pas réafficher
  try {
    const vue = await window.storage.get(UPDATE_SEEN_KEY);
    if (vue && vue.value === distante) return;
  } catch (err) {}

  const apk = (release.assets || []).find(a => String(a.name).endsWith('.apk'));
  afficherBandeauMaj(distante, apk ? apk.browser_download_url : release.html_url);
}

function afficherBandeauMaj(version, lien){
  const natif = isNativeApp();
  const box = document.getElementById('update-banner');
  if (!box) return;

  box.innerHTML = `
    <b>Version ${esc(version)} disponible</b>
    ${natif
      ? `<a href="${esc(lien)}" target="_blank" rel="noopener">Télécharger</a>`
      : `<button type="button" id="update-reload">Recharger</button>`}
    <button type="button" id="update-later" aria-label="Plus tard">✕</button>
  `;
  box.style.display = 'flex';

  const recharger = document.getElementById('update-reload');
  if (recharger) recharger.addEventListener('click', async () => {
    // Purge les caches du service worker puis recharge
    try {
      if ('caches' in window){
        const noms = await caches.keys();
        await Promise.all(noms.map(n => caches.delete(n)));
      }
      if ('serviceWorker' in navigator){
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
    } catch (err) {}
    location.reload();
  });

  document.getElementById('update-later').addEventListener('click', async () => {
    box.style.display = 'none';
    try { await window.storage.set(UPDATE_SEEN_KEY, version); } catch (err) {}
  });
}
