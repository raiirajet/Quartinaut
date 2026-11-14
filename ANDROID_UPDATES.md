# Android-Updateverteilung für Quartinaut

## Update-Benachrichtigung

- Android-App-ID: ch.quartinaut.nativeapp.
- Beim Öffnen der App wird die öffentliche GitHub Releases API gelesen.
- Es werden ausschliesslich Releases mit Tags android-v<versionCode>-preview
  und android-v<versionCode>-stable erkannt.
- APK-Links müssen zur HTTPS-Domain github.com, dem exakten Repository
  raiirajet/Quartinaut und einem Quartinaut-Android-*.apk-Asset gehören.
- Nur ein höherer versionCode erzeugt „Update verfügbar“.
- Der Button öffnet den GitHub-Download über den Android-Browser.
- Android verlangt eine Bestätigung; keine stille Installation.
- In Einstellungen → App-Version & Updates lässt sich die Prüfung wiederholen.
- Kein Hintergrund- oder periodischer Pushdienst wird dafür installiert.

## APK bereitstellen

Der Android-Workflow erzeugt eine Test-APK und veröffentlicht sie **nach
erfolgreichem Build** auf GitHub Releases als Vorschauversion.
Release-Seite: https://github.com/raiirajet/Quartinaut/releases

Die grosse APK wird absichtlich nicht in den Haupt-Quellbaum auf main gelegt.
Der main-README verweist auf den stabilen Release-Downloadort.

## Entscheidende Voraussetzung für echte Updates

Aktuell sind die Android-CI-Debug-Builds nicht mit einem dauerhaft
gleichen Signaturschlüssel versehen. Geräte verweigern ein Update,
wenn die Signatur der neuen APK nicht mit der installierten APK übereinstimmt.
Das ist eine Sicherheitsfunktion von Android, kein Fehler des Update-Dialogs.

Für zukünftige nahtlose Upgrades:
1. Eine langlebige, sicher gespeicherte Android-Release-KeyStore-Datei
   erzeugen und niemals öffentlich ins Git-Repository hochladen.
2. Keystore und Zugangsdaten nur über geschützte GitHub Secrets oder eine
   signierte Release-Umgebung bereitstellen.
3. Eine Release-Buildvariante mit unveränderter applicationId
   ch.quartinaut.nativeapp und steigenden versionCodes nutzen.
4. SHA-256-Zertifikatsfingerprint der Release-Signatur mit Firebase-Android-
   Registrierung, App Check und FCM-Konfiguration abgleichen.
5. Test mit zwei aufeinanderfolgenden, gleich signierten APKs durchführen.
6. Alle vorherigen Debug-Benutzer vor dem Wechsel auf die neue Signatur
   über den Verlust lokaler Appdaten beim nötigen Neuinstallieren informieren.

Der vorhandene Workflow veröffentlicht bewusst nur eine als
**Testversion** markierte Debug-APK. Produktiver Signaturschlüssel,
Store-Distribution oder vollautomatische Installation sind nicht aktiviert.

## Datenschutz und Abgrenzung

Die Release-Veröffentlichung benötigt keine Änderung an Benutzerkonten,
Firestore-Daten, Firestore- oder Storage-Sicherheitsregeln oder Cloud Functions.
