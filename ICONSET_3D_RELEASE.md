# Quartinaut 5.11 – echte 3D-Bildicons

Die App nutzt jetzt die im Gespräch gelieferte Schweizer 3D-Bildtafel, aufgeteilt in 36 transparent freigestellte Motive. Die 576 × 576 Pixel grosse WebP-Datei `app/src/main/assets/qt3d_atlas.webp` ist mit dem APK lokal gebündelt; jede Funktion erhält einen zugewiesenen 96 × 96-Pixel-Ausschnitt.

- Alle 47 Einträge des Quartier+-Funktionsverzeichnisses und insgesamt 108 UI-Schlüssel sind zugeordnet.
- Auch Hauptnavigation und Dashboard verwenden den gleichen 3D-Renderer.
- Bei der tiefschwarzen Darstellung wird die 3D-Grafik in Graustufen gerendert, wobei Glanz und Schatten erhalten bleiben.
- Fehlende oder beschädigte Atlasdateien fallen auf den bisherigen lokalen Icon-Renderer zurück.
- Keine Änderung an Gemeindewappen, App-Logo, Firebase oder Backend.

Das Ausgangsbild hatte einen beinahe schwarzen Hintergrund; für die App wurde dieser rechnerisch freigestellt. An sehr dunklen Konturen können leichte Randartefakte auftreten.
