# Quartinaut Native: private Chats

## Ziel und Annahmen

Dieser Abschnitt erweitert bestehende 1:1-Chats. Bestehende Chat- und
Nachrichtendokumente bleiben lesbar. Neue sicherheitsrelevante Aktionen laufen
über `quartinautPrivateChats` in `europe-west6`.

Die produktive Firestore-Instanz bleibt `(default)`, Standard Edition, `nam5`.
Die zusätzliche Enterprise-Instanz `default` wird nicht verwendet.

## Datenmodelle

### `chats/{chatId}`

- `id`, `requestId`, `requestTitle`, `requestOwnerUid`
- `participants`: exakt zwei unveränderliche UIDs
- `participantLabels`: exakt ein begrenzter Anzeigename je Teilnehmer
- `createdAt`, `lastMessageAt`, `lastMessagePreview`, `lastSenderUid`
- `readBy`: höchstens ein ISO-Zeitwert je Teilnehmer
- `mutedBy`, `blockedBy`: höchstens die zwei Teilnehmer-UIDs

### `chatMessages/{messageId}`

- Unveränderliche Bindung an `chatId`, Anfrage, Sender und Empfänger
- `messageType`: `text` oder `image`
- `text`: maximal 500 Zeichen; bei Bildern optional
- `media`: ausschließlich `{storagePath, contentType, size}`
- `deliveryStatus`, `createdAt`, `readAt`

### `userBlocks/{blockerUid}_{blockedUid}`

Serververwaltete, gerichtete Blockkante. Direkter Clientzugriff ist vollständig
gesperrt. Vor jeder Nachricht werden beide Richtungen geprüft.

### `moderationCases/{caseId}`

Meldegrund aus `spam`, `harassment`, `fraud`, `unsafe`, `other`, optionaler
Hinweis bis 500 Zeichen und eine begrenzte Nachrichtensicherung. Nur
Administratoren können Fälle lesen oder bearbeiten.

### Storage `chat-media/{chatId}/{senderUid}/{messageId}.jpg`

- Nur Chatteilnehmer dürfen lesen.
- Nur der Pfad-Sender darf einmalig hochladen.
- Nur JPEG, maximal 2.500.000 Byte.
- Pfad und Custom Metadata müssen Chat, Sender und Nachricht exakt binden.
- Ersetzen ist verboten; Löschen ist für Uploader oder Administrator möglich.

## Callable-Aktionen

- `list`, `messages`, `start`, `send`
- `read`: eigener Lesestatus
- `mute`: eigener Push-Status
- `block`: gerichtete Blockierung plus Chatstatus
- `report`: idempotenter Moderationsfall

Bildnachrichten werden zuerst in den geschützten Storage-Pfad geladen. Die
Cloud Function liest anschließend die echten Objektmetadaten und schreibt erst
danach die Nachricht. Bei Fehlern entfernt die Android-App den verwaisten
Upload.

Pushmeldungen enthalten keinen Nachrichtentext oder Bildlink. Ungültige
FCM-Registrierungstoken werden deaktiviert.

## Produktionsgrenze

Der Code und die Kandidatenregeln sind lokal und in Emulatoren geprüft. Eine
Produktivbereitstellung von Function, Firestore-Regeln und Storage-Regeln muss
gemeinsam erfolgen. Vorher sind Kompatibilitätstests mit bestehenden Web- und
Android-Clients erforderlich.

## Akzeptanzkriterien

- Kein Nichtteilnehmer kann Chat, Nachricht oder Bild lesen.
- Kein Client kann Blocklisten oder fremde Lesestatus manipulieren.
- Bilder sind unveränderlich, JPEG und größenbegrenzt.
- Blockierung stoppt Nachrichten in beiden Richtungen.
- Stummschaltung unterdrückt Push, nicht aber den Chatverlauf.
- Meldungen besitzen begrenzte, rollenbasierte Moderationsdaten.
- Wiederholte `send`- und `report`-Aufrufe sind idempotent.

