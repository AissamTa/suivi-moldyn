# Compiler l'APK avec Capacitor

## Prérequis

- **Node.js 18+**
- **Android Studio** (avec Android SDK)
- **JDK 17** — fourni avec Android Studio récent

## 1. Installer

```bash
cd suivi-moldyn
npm install
```

## 2. Ajouter la plateforme Android

Une seule fois. Crée le dossier `android/` (ignoré par git : il se
regénère).

```bash
npx cap add android
```

## 3. Synchroniser

À refaire **après chaque modification de `www/`** — c'est cette
commande qui recopie l'application dans le projet Android.

```bash
npx cap sync
```

## 4. Ouvrir dans Android Studio

```bash
npx cap open android
```

Puis **Build → Build Bundle(s) / APK(s) → Build APK(s)**.

L'APK de débogage sort dans :
`android/app/build/outputs/apk/debug/app-debug.apk`

---

## APK signé (pour distribution)

Un APK de debug s'installe, mais ne peut pas être mis à jour par un
APK signé différemment. Pour la production, créer une clé **une fois**
et la garder :

```bash
keytool -genkey -v -keystore moldyn-release.keystore \
  -alias moldyn -keyalg RSA -keysize 2048 -validity 10000
```

> ⚠️ Sauvegarder ce fichier et son mot de passe. Perdus, plus aucune
> mise à jour n'est possible : Android refuse un APK signé par une
> autre clé, il faudrait désinstaller et réinstaller partout, en
> perdant les fiches locales.

`android/key.properties` (ne pas committer) :

```properties
storeFile=../../moldyn-release.keystore
storePassword=VOTRE_MOT_DE_PASSE
keyAlias=moldyn
keyPassword=VOTRE_MOT_DE_PASSE
```

Dans `android/app/build.gradle`, avant `android {` :

```gradle
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('key.properties')
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

Puis dans le bloc `android {` :

```gradle
signingConfigs {
    release {
        storeFile file(keystoreProperties['storeFile'])
        storePassword keystoreProperties['storePassword']
        keyAlias keystoreProperties['keyAlias']
        keyPassword keystoreProperties['keyPassword']
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled false
    }
}
```

Compiler :

```bash
cd android && ./gradlew assembleRelease
```

Sortie : `android/app/build/outputs/apk/release/app-release.apk`

---

## Version affichée par Android

`config.js` porte la version de l'application ; Android a la sienne.
Les tenir alignées dans `android/app/build.gradle` :

```gradle
defaultConfig {
    versionCode 800        // entier, doit augmenter à chaque publication
    versionName "8.0.0"    // doit correspondre à config.js
}
```

Convention simple pour `versionCode` : `8.0.0` → `800`, `8.1.0` → `810`,
`8.1.2` → `812`. Android **refuse** d'installer par-dessus un
`versionCode` inférieur ou égal.

---

## Points propres à l'APK

- **Service worker désactivé.** Les fichiers sont déjà embarqués dans
  l'APK ; un cache par-dessus n'apporterait rien et pourrait servir une
  version périmée après mise à jour. `app.js` le détecte via
  `isNativeApp()`.
- **ExcelJS et les polices viennent d'un CDN.** L'export Excel a donc
  besoin du réseau au premier lancement. Pour un fonctionnement
  entièrement hors ligne dès l'installation, télécharger
  `exceljs.min.js` dans `www/js/vendor/` et changer la balise `<script>`
  de `index.html`. À décider ensemble — cela change un fichier existant.
- **`appId`** : `ma.moldyn.suivi` (`capacitor.config.json`). Le changer
  après distribution crée une application distincte aux yeux d'Android.
