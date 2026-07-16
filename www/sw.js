/* ═══════════════════════════════════════════════════════════════
   sw.js — Service worker (version web / PWA uniquement)

   Rôle : rendre l'application utilisable hors ligne sur le poste.

   Le nom du cache est bâti sur MOLDYN_CONFIG.VERSION, importé
   directement depuis config.js. Une seule version à changer, donc :
   dès qu'elle bouge, le nom du cache change, « activate » supprime
   les anciens et les postes reçoivent la nouvelle version.

   C'est le correctif d'un vrai défaut de la version précédente :
   le cache s'appelait « suivi-moldyn-v1 » en dur, si bien qu'une
   mise à jour publiée n'atteignait jamais les postes déjà installés.

   Note : ce fichier n'est pas enregistré dans l'APK Capacitor, où
   les fichiers sont déjà embarqués (voir la fin de app.js).
   ═══════════════════════════════════════════════════════════════ */

importScripts('./js/config.js');

const CACHE = 'moldyn-v' + MOLDYN_CONFIG.VERSION;

const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './css/app.css',
  './js/config.js',
  './js/utils.js',
  './js/storage.js',
  './js/export-excel.js',
  './js/update.js',
  './js/distribute.js',
  './js/app.js',
  'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // addAll échoue en bloc si une seule URL tombe ; on tolère les
      // absences (une police indisponible ne doit pas casser l'install)
      .then(c => Promise.allSettled(CORE.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  // L'API GitHub ne doit jamais être servie depuis le cache :
  // la vérification de mise à jour doit voir l'état réel.
  if (e.request.url.includes('api.github.com')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return resp;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
