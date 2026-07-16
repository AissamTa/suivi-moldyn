# Publier une mise à jour (GitHub Releases)

## Comment ça marche

`www/js/update.js` interroge, au plus une fois toutes les 6 heures :

```
https://api.github.com/repos/AissamTa/suivi-moldyn/releases/latest
```

Il compare le `tag_name` de la release à `MOLDYN_CONFIG.VERSION`.
Si la release est plus récente, un bandeau s'affiche en haut de la fiche.

| Contexte | Ce que propose le bandeau |
|---|---|
| APK (Capacitor) | Télécharger le `.apk` joint à la release |
| Web (PWA) | Recharger — purge le cache et reprend la nouvelle version |

Aucune authentification : l'API publique suffit pour un dépôt public
(60 requêtes/heure/IP). En cas d'échec — hors ligne, quota atteint,
aucune release — la vérification est **silencieuse**. La saisie ne doit
jamais être gênée par ça.

Un opérateur qui ferme le bandeau ne le revoit plus pour cette
version-là ; une version suivante le réaffichera.

---

## Publier

### 1. Monter la version

`www/js/config.js` :

```js
VERSION: '8.1.0',
```

Et `package.json` → `"version": "8.1.0"`.
Si vous produisez un APK, aussi `android/app/build.gradle` :
`versionCode 810`, `versionName "8.1.0"`.

Règle : **correctif** de bug → `8.0.1` · **nouveauté** → `8.1.0` ·
**refonte** → `9.0.0`.

### 2. Publier le web

Pousser le contenu de `www/` sur `main`. GitHub Pages sert
`https://aissamta.github.io/suivi-moldyn/`.

### 3. Créer la release

Sur `github.com/AissamTa/suivi-moldyn/releases/new` :

- **Tag** : `v8.1.0` — le `v` est facultatif, la comparaison le retire
- **Titre** : `v8.1.0 — Répartition automatique`
- **Description** : ce qui change, en clair, pour l'équipe
- **Joindre l'APK** si vous en avez compilé un

Publier.

> Le tag **doit** correspondre à `VERSION`. Un tag `v8.1.0` avec un
> `config.js` resté à `8.0.0` déclencherait le bandeau chez tout le
> monde — sans que la nouvelle version existe vraiment.

---

## Vérifier

```bash
curl -s https://api.github.com/repos/AissamTa/suivi-moldyn/releases/latest \
  | grep -E '"tag_name"|"browser_download_url"'
```

Pour tester le bandeau sans publier : baisser temporairement `VERSION`
à `0.0.1` dans `config.js` et recharger.

---

## Désactiver

`www/js/config.js` :

```js
UPDATE: { ENABLED: false, ... }
```

---

## Ce que ce système ne fait pas

- **Il n'installe rien tout seul.** Sur Android, l'opérateur télécharge
  l'APK et confirme l'installation ; le téléphone demandera
  l'autorisation « installer des applications inconnues ». C'est le
  comportement normal hors Play Store.
- **Il ne met pas à jour le code de l'APK à distance.** Seul le
  fichier APK change. Pour remplacer les fichiers web sans réinstaller,
  il faudrait un plugin de mise à jour à chaud (`@capgo/capacitor-updater`) —
  une autre approche, à décider si le besoin apparaît.
- **Il ne migre pas les fiches.** Elles restent sur l'appareil, dans le
  stockage local ; une réinstallation par-dessus les conserve, une
  désinstallation les efface.
