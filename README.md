# Suivi de Production — MOLDYN

Saisie de la production horaire (1H–8H) par référence, arrêts commentés,
export Excel au modèle de l'entreprise. Fonctionne hors ligne.

Deux formes, un seul code :

- **PWA** — publiée sur GitHub Pages, installable depuis Chrome
- **APK Android** — compilée avec Capacitor (voir `docs/CAPACITOR.md`)

---

## Structure

```
suivi-moldyn/
├── .github/workflows/
│   ├── pages.yml             Publie www/ sur GitHub Pages (URL inchangée)
│   └── release.yml           Compile l'APK sur tag + crée la release
├── scripts/version.mjs       npm run version 8.2.0
├── capacitor.config.json     Réglages de l'APK (appId, nom)
├── package.json              Dépendances Capacitor + raccourcis npm
├── CHANGELOG.md              Journal des versions
├── www/                      ← l'application (c'est aussi le webDir Capacitor)
│   ├── index.html            Balisage seul
│   ├── manifest.json         Réglages PWA
│   ├── sw.js                 Hors ligne (web uniquement)
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── css/
│   │   └── app.css           Tout l'habillage
│   └── js/
│       ├── config.js         ★ VERSION, codes d'arrêt, machines, réglages
│       ├── utils.js          Dates, échappement, copie profonde, versions
│       ├── storage.js        Où atterrissent les fiches (3 niveaux)
│       ├── export-excel.js   ⛔ Génération Excel — ne pas toucher
│       ├── update.js         Vérification GitHub Releases
│       └── app.js            Interface et logique de saisie
├── supabase/
│   └── functions/moldyn-chat/
│       └── index.ts          Assistant (optionnel, non branché)
└── docs/
    ├── GITHUB.md             ★ Mise en place GitHub, pas à pas
    ├── CAPACITOR.md          Compiler l'APK en local
    ├── RELEASES.md           Comment fonctionne la mise à jour
    └── SUPABASE.md           Déployer l'assistant
```

---

## Où modifier quoi

| Besoin | Fichier | 
|---|---|
| Ajouter une machine | `www/js/config.js` → `PROCESS` |
| Ajouter un code d'arrêt | `www/js/config.js` → `CODES` |
| Changer la version | `www/js/config.js` → `VERSION` |
| Changer les couleurs | `www/css/app.css` → `:root` |
| Modifier l'écran | `www/index.html` + `www/js/app.js` |
| Modifier l'export Excel | `www/js/export-excel.js` — **demander avant** |

`config.js` est chargé par l'application **et** par le service worker.
La `VERSION` qu'il contient est la seule qui existe : la changer suffit,
rien d'autre à synchroniser.

---

## Ordre de chargement

Scripts classiques, pas de modules ES — l'application s'ouvre donc aussi
par double-clic sur `index.html`, sans serveur.

```
config.js → utils.js → storage.js → export-excel.js → update.js → app.js
```

L'ordre compte : chaque fichier utilise les précédents. Ils partagent la
même portée globale, d'où une règle à retenir : **`CODES` et `NB_H` sont
déclarés une seule fois, dans `config.js`, en `var`**. Deux `const` du
même nom dans deux fichiers empêcheraient l'application entière de
démarrer.

---

## Développer

```bash
npm install
npm run serve        # http://localhost:5173
```

Le service worker ne s'enregistre qu'en `http(s)` et hors APK. En
ouverture directe du fichier, l'application marche, simplement sans
cache hors ligne.

---

## Publier une mise à jour

```bash
npm run version 8.2.0        # config.js + package.json d'un coup
git commit -am "v8.2.0"
git push                     # → site en ligne
git tag v8.2.0 && git push origin v8.2.0    # → APK + release
```

Première mise en place : **`docs/GITHUB.md`**.

Le changement de `VERSION` renouvelle le nom du cache du service worker.
Sans cela, les postes déjà installés garderaient l'ancienne version
indéfiniment.

⚠️ Le site est publié par un workflow, **pas** depuis une branche. C'est
ce qui permet de servir `www/` à la racine de
`https://aissamta.github.io/suivi-moldyn/` — l'URL inscrite en dur dans
les applications déjà installées.

---

## Stockage des fiches

Trois niveaux, choisis automatiquement :

| Niveau | Quand | Conservation |
|---|---|---|
| `window.storage` | fourni par l'hôte | partagé équipe |
| `localStorage` | APK, navigateur | conservé sur l'appareil |
| mémoire | localStorage refusé | perdu à la fermeture |

Le message affiché à l'enregistrement dit lequel s'applique — un
opérateur ne doit jamais croire qu'une fiche est conservée alors
qu'elle ne l'est pas.

**Il n'y a pas de synchronisation entre appareils.** Chaque téléphone
garde ses propres fiches. Une vraie mise en commun demanderait un
serveur.
