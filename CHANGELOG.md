# Journal des versions

Format : [MAJEUR.MINEUR.CORRECTIF](https://semver.org/lang/fr/).
Chaque version publiée correspond à un tag `v…` et à une release GitHub.

## [8.1.1] — 2026-07-16

### Corrigé
- **Cache hors ligne incomplet** : `js/distribute.js` était chargé par
  l'application mais absent de la liste mise en cache par le service
  worker. Lors d'une toute première ouverture sans connexion, le
  bouton 🪄 Répartir pouvait manquer.
- **Process / Shift par défaut figés en dur** dans `resetForm()` au
  lieu d'être lus dans `config.js`. Sans incidence avec les réglages
  actuels, mais aurait cassé la sélection par défaut si la liste
  `PROCESS` ou `SHIFTS` de `config.js` était réordonnée ou modifiée.
- **Boutons Annuler et Supprimer silencieusement inopérants** dans
  certains contextes d'exécution où la boîte de dialogue native
  `window.confirm()` est bloquée sans erreur visible (le clic ne
  produit alors aucune réaction). Remplacée par une feuille de
  confirmation intégrée à l'application, indépendante du navigateur.

## [8.1.0] — 2026-07-16

### Ajouté
- Bouton **🪄 Répartir** sur chaque référence : saisir un total, il se
  partage sur les heures laissées vides. Les cases déjà remplies sont
  gardées (`0` compris, ce qui exclut l'heure). Aperçu en direct avant
  d'appliquer.
- Vérification des mises à jour via GitHub Releases, avec bandeau.
- Version affichée en bas de la fiche.
- Workflows : publication du site et compilation de l'APK.
- `npm run version` : change la version dans tous les fichiers d'un coup.

### Modifié
- Code découpé : `config.js`, `utils.js`, `storage.js`, `export-excel.js`,
  `distribute.js`, `update.js`, `app.js`. Réglages courants regroupés
  dans `config.js`.
- Site servi depuis `www/` via un workflow Actions. **L'URL publique ne
  change pas** — celle inscrite dans les installations existantes.

### Corrigé
- **Le cache du service worker portait un nom fixe** (`suivi-moldyn-v1`),
  si bien qu'une mise à jour publiée n'atteignait jamais les postes
  déjà installés. Il suit désormais la version.
- Service worker désactivé dans l'APK : les fichiers y sont déjà
  embarqués, et le cache aurait pu servir une version périmée.

## [8.0.0] — 2026-07-16

### Ajouté
- Onglets **Tableau de bord** (KPI, production par heure) et **Historique**.
- Champ **Heure**, commentaire libre par heure.
- Le commentaire apparaît dans la section COMMENTAIRE de l'export Excel :
  `ATT VALIDATION 30 min - Scanner ma kay9rach`.

### Modifié
- Thème sombre.
- Dates affichées en JJ/MM/AAAA (écran et Excel). Le stockage reste en
  ISO, qui se trie.

### Corrigé
- **La fiche enregistrée et le formulaire partageaient les mêmes objets.**
  Modifier le formulaire après un enregistrement altérait silencieusement
  la fiche déjà en mémoire : l'export Excel pouvait sortir des chiffres
  jamais enregistrés.
- Le service worker levait une erreur non interceptée hors `http(s)`.
- L'application ne démarrait pas si `localStorage` était refusé
  (navigation privée) — repli en mémoire, avec un message honnête sur ce
  qui est réellement conservé.
