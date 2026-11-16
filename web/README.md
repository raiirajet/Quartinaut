# Quartinaut Web 5.11.6 · Website quality review · Android Build 33

The live Web 5.4.2 source was captured from the owner's existing Firebase Hosting
version `sites/quartinaut/versions/ecfb5a780cca5bcf`. The original production
Firebase configuration and existing account, moderation and community flows
were retained. `app-source-5116.mjs` is the editable application entry. `npm run build` bundles all local modules into `app-release-5116.js`, so an old Service Worker cannot mix outdated module exports into the new release. `app-release-5116.js` is the active entry point; earlier public
release files remain for existing clients and rollback compatibility.

## Run and verify

The committed release bundle can be served directly. After source edits, rebuild it before publishing:

```sh
python3 -m http.server 5114 --bind 127.0.0.1
npm ci
npm run build
npm run check
npm test
npm run test:browser
npm run test:review
```

Browser tests include an actual installed 5.4.2 Service Worker upgrading at the same origin, including cached obsolete module exports. Browser tests require Chromium. Set `CHROMIUM_PATH` if it is not installed at
`/usr/bin/chromium`; CI installs a compatible Playwright browser. Tests inject
fixtures into an intercepted JavaScript module, never into published code.
`tests/`, dependency files and local artifacts are excluded from Hosting.

## Website layout

From 1024 CSS pixels the website uses a full-width header and text navigation,
a main content area up to 1760 pixels, a two-column home page with a personal
sidebar, multi-column function/post/calendar cards, and inbox plus conversation
side by side. Below that breakpoint, navigation and content adapt for touch
screens. The sign-in view uses a broad two-column layout on desktop.

The desktop layer is in `quartinaut-desktop-5115.css`. Keep the new bundled
release filename and Service Worker version when publishing changes; older
5.4.2, 5.11.4 and 5.11.5 installed caches are exercised by the upgrade tests.

## Page and form quality

`quartinaut-quality-5116.css` gives secondary pages a consistent hierarchy,
visible wrapping filters, readable theme colours, and suitable form widths.
QR handover, municipality comparison and transaction forms use desktop columns
and stack on phones. Settings use one heading and consistent theme selections.
`src/site-ui.mjs` enhances the rendered controls without changing their names,
form submissions or backend authorisation: labels, required markers, character
counters, German validation feedback, contextual action labels and page titles.
Loan requests reject a return before handover locally and retain server checks.
Closing a modal keeps its draft; explicitly completing a post clears it.
The help link and the transaction refresh control now call their intended flows.

`npm run test:review` reviews all 47 catalog links plus secondary pages,
every settings panel, dialogs, registration/account gates and request wizard
steps. It checks desktop/mobile bounds, labels, heading counts, duplicate IDs,
and Axe WCAG A/AA rules, with additional coverage in all four colour themes.
It waits for finite animations before measuring colour contrast. Reports and
screenshots are written to `artifacts/site-review/` outside published files.
This is an automated accessibility check, not a conformance certification.

## Shared app behavior

- The exact Android brand vector and 6×6 icon atlas are used for the header,
  install icons, navigation and feature tiles. Five task sections expose all
  47 links from `NativeQuartierNavigation.kt`; a test detects catalog drift.
- Light, green, black and Swiss-red themes, responsive navigation, home
  interests, shortcuts, personal center, municipality comparison and sources.
- Existing requests, Quartier+ listings, reservations, loans, clubs, calendar,
  reactions, administration, account registration and verification are retained.
- New own-post management, radar, server favorites, trust/reviews, reminders,
  QR handover and one-shot location use the Android callable services.
- Private messages use `quartinautPrivateChats`, including idempotent sends,
  mute/block/report, read tracking and protected images. An existing limitation
  in the production chat-image Storage upload has not been repaired here;
  failed uploads retain the message and show the server error.
- Official reference calendar: the same 206 records and source qualifications
  as the APK; exact dates export as all-day ICS. The catalog is research data,
  not a live official events feed.

App and Web use the same Firebase UID and server records. Login is performed
separately in Android and in each browser; sessions and device permissions are
not transferred. Themes, interests, local drafts and recent routes are local.
Community settings, dashboard shortcuts/backgrounds, posts, favorites, messages
and saved reminders use the existing shared backend.

## Location and privacy

`src/native/location.mjs` uses `getCurrentPosition` once, with a 20-second timeout;
there is no background tracking. An optional street lookup sends the location
to the public Swiss geo.admin.ch API, explicitly disclosed beside the control.
Only its street-name attribute is displayed, after removing trailing house
numbers. The street is neither persisted nor sent to Firebase. Firebase receives
only the center rounded to 0.01 degrees, as in Android Build 33.

Regional requests use `quartinautAudience` and owner-bound
`quartinautAudienceFeeds/{uid}/items/{id}` server reads. No unrestricted source
collection query or location document read is introduced. The UI refreshes
short-lived grants and clears regional records when the app is hidden, a
refresh fails, or accounts change. Existing Firestore and Storage rules are
unchanged by this Web rollout.

New dashboard photos synchronize through `quartinautAppearance` after an
explicit save. Previously local photos are not silently uploaded. Downloads
stay in session memory and are cleared when accounts change. Failed cloud
removals do not misleadingly delete only the local view.

The Service Worker caches only the public shell and bundled public geographic
resources. It ignores Firebase APIs, Auth helpers, private images and messages.
Optional full offline map/wappen download is explicit and includes provenance
and the existing historical coat qualifications from the Android resources.

## Hosting

From the repository root, use the separate Hosting-only configuration:

```sh
npx -y firebase-tools@latest hosting:channel:deploy site-review-5116 --project quartinaut --config firebase.hosting.json --expires 7d
npx -y firebase-tools@latest hosting:clone quartinaut:site-review-5116 quartinaut:live --project quartinaut
```

The second command promotes the tested immutable preview version. It does not
deploy Firestore/Storage rules, functions or a different Hosting site.

## Validation boundaries

Unit tests cover street/coordinate privacy, cancellation feedback, calendar
exports, catalog parity, private-cache exclusions and stale account responses.
Playwright tests exercise the actual Web code with isolated API fixtures at
360, 390, 768, 1024, 1280, 1440 and 1920 pixels, including a regional request submission, shared
favorites, post editing, chat sending, QR handover, maps and account logout.
Anonymous production SDK loading and public asset delivery are checked
separately. Real two-device authenticated use, physical GPS/camera capture and
Web push delivery are not claimed by fixture tests.
