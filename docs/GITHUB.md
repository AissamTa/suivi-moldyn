# Mettre le projet sur GitHub — pas à pas

À faire une seule fois. Ensuite, publier une mise à jour tiendra en
trois commandes.

---

## ⚠️ À lire avant de pousser quoi que ce soit

L'application installée sur les téléphones pointe **en dur** sur :

```
https://aissamta.github.io/suivi-moldyn/index.html
```

Aujourd'hui, `index.html` est à la racine du dépôt. Le projet réorganisé
le place dans `www/`. Si vous poussez sans changer le réglage Pages,
l'URL devient `.../suivi-moldyn/www/index.html` et **toutes les
installations tombent sur une erreur 404**.

C'est pour ça que le workflow `pages.yml` existe : il publie le
**contenu** de `www/` à la racine du site. L'URL ne bouge pas.

> Faites l'**étape 1 avant l'étape 2**. Dans l'autre sens, le site est
> cassé entre les deux.

---

## Étape 1 — Régler Pages sur « GitHub Actions »

1. `github.com/AissamTa/suivi-moldyn` → **Settings**
2. Menu de gauche → **Pages**
3. **Build and deployment** → **Source** → choisir **GitHub Actions**

Rien à valider, le choix est pris en compte immédiatement. Le site
continue de servir l'ancienne version jusqu'au premier déploiement.

---

## Étape 2 — Envoyer le projet

### Avec git (recommandé)

```bash
git clone https://github.com/AissamTa/suivi-moldyn.git
cd suivi-moldyn

# Retirer l'ancienne version à la racine
git rm index.html manifest.json sw.js icon-192.png icon-512.png

# Copier le contenu du ZIP ici (www/, docs/, .github/, package.json, …)

git add -A
git commit -m "v8.1.0 — réorganisation, répartition, mise à jour auto"
git push
```

Le push déclenche `pages.yml`. Suivez-le dans l'onglet **Actions**.

### Depuis le navigateur

Possible mais fastidieux : il faut supprimer les 5 fichiers de la
racine un par un (chacun → ⋯ → *Delete file*), puis
`github.com/AissamTa/suivi-moldyn/upload/main` pour déposer les
dossiers. Le glisser-déposer d'un dossier entier conserve
l'arborescence.

---

## Étape 3 — Vérifier

Onglet **Actions** → « Publier sur GitHub Pages » doit être vert.

Puis ouvrez `https://aissamta.github.io/suivi-moldyn/` — **la même URL
qu'avant**. La version s'affiche en bas de la fiche : `Suivi MOLDYN v8.1.0`.

Si vous voyez encore l'ancienne version, c'est le service worker
installé sur votre téléphone qui sert son cache. Normal, et c'est le
sujet de la section suivante.

---

## Étape 4 — Clé de signature (une fois, avant le premier APK)

Sans clé stable, Android refuse d'installer une mise à jour par-dessus
l'installation existante.

```bash
keytool -genkey -v -keystore moldyn-release.keystore \
  -alias moldyn -keyalg RSA -keysize 2048 -validity 10000
```

> **Sauvegardez ce fichier et son mot de passe.** Perdus, plus aucune
> mise à jour n'est possible : il faudrait désinstaller et réinstaller
> sur chaque téléphone, en perdant les fiches locales de chacun.
> Ne le mettez pas dans le dépôt — `.gitignore` l'exclut déjà.

Encodez-le :

```bash
base64 -w0 moldyn-release.keystore > keystore.txt
```

Puis **Settings → Secrets and variables → Actions → New repository secret**,
quatre fois :

| Nom | Valeur |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | le contenu de `keystore.txt` |
| `ANDROID_KEYSTORE_PASSWORD` | le mot de passe du keystore |
| `ANDROID_KEY_ALIAS` | `moldyn` |
| `ANDROID_KEY_PASSWORD` | le mot de passe de la clé |

Effacez `keystore.txt` ensuite.

---

## Étape 5 — Premier APK

```bash
git tag v8.1.0
git push origin v8.1.0
```

Le workflow « Compiler l'APK et publier la release » démarre. Il :

1. refuse si le tag ≠ `config.js` ≠ `package.json`
2. génère le projet Android (Capacitor)
3. pose `versionCode 80100` / `versionName 8.1.0`
4. signe avec votre clé
5. crée la release et y joint `SuiviMOLDYN-8.1.0.apk`

Comptez ~5 minutes. Le résultat est dans l'onglet **Releases**.

---

## Publier une mise à jour, ensuite

```bash
npm run version 8.2.0          # met à jour config.js + package.json
git commit -am "v8.2.0"
git push                       # → site en ligne
git tag v8.2.0 && git push origin v8.2.0    # → APK + release
```

C'est tout. Ce qui se passe pour l'équipe :

| Support | Comment la mise à jour arrive |
|---|---|
| **PWA** | Le nom du cache suit la version → au prochain lancement, le service worker prend la nouvelle. Le bandeau propose aussi « Recharger ». |
| **APK** | `update.js` voit la release, un bandeau propose de télécharger le nouvel APK. |

---

## Le garde-fou

Les deux workflows refusent de tourner si `config.js` et `package.json`
divergent, et le workflow de release exige en plus que le tag
corresponde.

Ce n'est pas de la rigueur pour la rigueur : un tag `v8.2.0` avec un
`config.js` resté à `8.1.0` afficherait le bandeau « Version 8.2.0
disponible » sur tous les postes — en boucle, puisque l'application
téléchargée se croirait toujours en 8.1.0. `npm run version` évite le
problème en changeant les deux d'un coup.

---

## Compiler en local (sans GitHub)

Voir `docs/CAPACITOR.md`. Utile pour essayer avant de publier.

```bash
npm install
npx cap add android
npx cap sync
npx cap open android      # puis Build → Build APK(s)
```

---

## En cas de souci

| Symptôme | Cause probable |
|---|---|
| Actions au vert, site inchangé | Source Pages restée sur « Deploy from a branch » |
| 404 sur le site | `www/` absent, ou artefact vide — voir le log du job `build` |
| L'ancienne version persiste sur le téléphone | Cache du service worker : bandeau « Recharger », ou vider les données du site |
| Release sans APK | Secrets manquants — le log le dit explicitement |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | APK signé par une autre clé que celui installé |
| `INSTALL_FAILED_VERSION_DOWNGRADE` | `versionCode` inférieur à celui installé |
