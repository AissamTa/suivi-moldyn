/* ═══════════════════════════════════════════════════════════════
   MOLDYN — Suivi de Production
   config.js — LE SEUL FICHIER À MODIFIER POUR LES RÉGLAGES COURANTS

   Ce fichier est chargé par l'application ET par le service worker
   (via importScripts). La version définie ici est donc la seule et
   unique source de vérité : la changer ici suffit.
   ═══════════════════════════════════════════════════════════════ */

var MOLDYN_CONFIG = {

  /* ── Version ────────────────────────────────────────────────
     Format : MAJEUR.MINEUR.CORRECTIF
       MAJEUR   : refonte / rupture
       MINEUR   : nouvelle fonctionnalité
       CORRECTIF: correction de bug

     En changeant cette valeur :
       · le cache du service worker est renouvelé (les postes
         reçoivent la nouvelle version au lieu de garder l'ancienne)
       · la version s'affiche en bas de la fiche
       · la comparaison avec GitHub Releases utilise cette valeur
     Le tag GitHub doit correspondre : 8.0.0 -> tag "v8.0.0"
     ──────────────────────────────────────────────────────────── */
  VERSION: '8.1.5',

  /* ── Codes d'arrêt ──────────────────────────────────────────
     Alimentent le menu déroulant de chaque heure ET la légende
     numérotée de l'export Excel. L'ORDRE EST SIGNIFICATIF :
     la légende Excel numérote 1, 2, 3... dans cet ordre.
     Ajouter à la fin ; ne pas réordonner sans raison.
     ──────────────────────────────────────────────────────────── */
  CODES: [
    'PAUSE',
    'ATT VALIDATION',
    'ARRET MAINTENANCE',
    'ARRET QUALITE',
    'ATT PIECES',
    'FORMATION / REUNION'
  ],

  /* ── Machines ───────────────────────────────────────────────
     Menu « Process / Machine ». Ajouter une ligne par machine.
     ──────────────────────────────────────────────────────────── */
  PROCESS: [
    'ML05 - Laser',
    'ML04 - Laser',
    'ML02 - Laser'
  ],

  /* ── Shifts ─────────────────────────────────────────────── */
  SHIFTS: ['Matin', 'Soir', 'Nuit'],

  /* ── Nombre d'heures d'un shift ─────────────────────────────
     ⚠️ L'export Excel est bâti sur 8 colonnes horaires (C..J).
     Changer cette valeur SANS adapter export-excel.js casserait
     la correspondance avec le modèle de l'entreprise.
     ──────────────────────────────────────────────────────────── */
  HOURS: 8,

  /* ── Mise à jour via GitHub Releases ────────────────────────
     Dépôt public consulté pour savoir si une version plus récente
     existe. Voir docs/RELEASES.md.
     Mettre ENABLED à false pour désactiver la vérification.
     ──────────────────────────────────────────────────────────── */
  UPDATE: {
    ENABLED: true,
    REPO: 'AissamTa/suivi-moldyn',
    CHECK_EVERY_HOURS: 6
  },

  /* ── Assistant (Supabase Edge Function) ─────────────────────
     Renseigner l'URL après « supabase functions deploy ».
     Voir docs/SUPABASE.md. Laisser vide tant que non déployé :
     l'application fonctionne sans.
     ──────────────────────────────────────────────────────────── */
  CHAT: {
    ENABLED: false,
    URL: ''  // https://<PROJECT_REF>.supabase
