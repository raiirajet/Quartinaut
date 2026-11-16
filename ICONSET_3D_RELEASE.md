# 3D-Icon-Fix: vollständig freigestellt

Die 36 originalen Motive der vom Nutzer gelieferten Bildvorlage werden nun pro Motiv isoliert, transparent freigestellt, mit 14 Pixeln Innenabstand und einheitlicher skalierter Darstellung als 6 × 6-Atlas gespeichert (144 × 144 Pixel pro Kachel, 864 × 864 insgesamt).

Die Kotlin-Rendering-Routine bezieht ihre 144 × 144 Pixel-Kachel aus `qt3d_atlas_safe.webp` statt den fehlerhaft entlang des Motivs abgeschnittenen 96 × 96-Pixel-Rastern der früheren Version. Dunkles Design: Graustufeneffekt mit erhaltenen 3D-Schattierungen.

Dies ändert keine offiziellen Gemeindewappen, Backend-Regeln oder Firebase-Daten.
