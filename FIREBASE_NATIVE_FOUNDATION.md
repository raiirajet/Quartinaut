# Native Firebase foundation

Stand: 2026-11-13

## Scope and assumptions

- Production project: `quartinaut`; active Firestore database: `(default)` (Standard edition).
- Android application ID: `ch.quartinaut.nativeapp`.
- The default Firebase CLI alias intentionally points to the local demo project
  `demo-quartinaut-rules`. Production always requires the explicit alias
  `--project production` or project ID `--project quartinaut`.
- App Check enforcement remains disabled until release signing, SHA-256
  registration and request metrics have been validated for all existing clients.
- The rules in `firebase/` are a reviewed candidate based on the captured live
  rules. They have not been deployed to production.

## Android components

- `QuartinautApplication`: initializes the dedicated Firebase Android app and
  the build-specific App Check provider before any Firebase SDK is used.
- `AppCheckProvider` (debug): Firebase debug provider without a committed token.
- `AppCheckProvider` (release): Play Integrity provider.
- `QuartinautMessagingService`: receives FCM messages, refreshes device tokens
  and displays private lock-screen notifications.
- `PushTokenRegistrar`: hashes token document IDs, binds writes to the signed-in
  UID, stores only bounded routing metadata, removes the previous token and
  deactivates it before logout.
- Settings UI: requests Android notification permission only after an explicit
  user action.

## Device token model

`deviceTokens/{sha256(token)}` contains:

- `id`: SHA-256 document ID
- `token`: FCM token, 20-4096 characters
- `uid`: authenticated owner, immutable
- `active`: boolean
- `platform`: `android` (legacy `web` remains accepted during migration)
- `area`, `areaKey`: at most 180 characters
- `cantonCode`: at most 2 characters
- `appVersion`: at most 40 characters
- `updatedAt`: ISO timestamp string, at most 40 characters

Legacy `displayName`, `email` and `createdAt` are temporarily accepted by the
candidate rules so existing token documents are not invalidated without a
reviewed migration.

## Security validation

- Firestore and Storage rules compile in a production-targeted dry run.
- Emulator regression tests cover valid Android token creation, token-owner
  hijacking, schema pollution, oversized values, valid and forged chat writes,
  per-user chat read state, unauthenticated chat access, immutable JPEG uploads
  and active-content MIME rejection.
- CI executes the same rules tests before building the APK.

## Production gate

Do not deploy `firebase/firestore.rules` or `firebase/storage.rules` until the
remaining legacy web flows have been exercised against the emulator candidate
and the user explicitly approves the rule migration. Do not enable App Check
enforcement until release-signing and metrics checks are complete.
