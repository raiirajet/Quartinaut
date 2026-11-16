# Quartinaut 5.11.7: stable navigation and retained view state

Android Build 34 and Web 5.11.7 address unexpected screen changes and returning
to the top after leaving a menu. The Android signing identity, Firebase project,
account records and server authorisation remain the same.

Android keeps saveable scroll/filter state per account and screen, with separate
entries for chat threads, map levels and post details. The initial home
preference is applied once on a fresh home view; it cannot reset restored or
deliberate navigation. Screen visits have generations, so late async completions
cannot navigate away after the user leaves. Completed composers forget their
saved UI state. Cached loans, reservations, calendar, favourites and radar rows
remain visible while refreshing; failed/stale reads cannot erase them or cross
accounts/screens. Stable list keys keep the visible item anchored.

Web keeps scroll, filters, disclosures, transient fields and inner scroll areas
per view in memory. Hub submenus have distinct browser-history entries. Focused
editors are not replaced by ordinary background updates; manual updates retain
the draft and chosen chat image. Modal close and browser Back retain page height.
Map drill-down survives refresh/return. Late chat/post responses cannot take over
a newer menu. Network/visibility events do not rebuild the whole screen, and
Service Worker activation alone does not reload the document. Required regional
grant revalidation remains active. No view snapshot is persisted or transmitted;
passwords/images are excluded from view history, and account changes clear it.

Validation: 23 Android unit tests including four real Compose/Robolectric
restoration tests, Android lint with zero errors (16 non-blocking existing
warnings), signed APK/App Bundle verification against the existing certificate,
15 web unit tests, 21 functional browser scenarios, 10 navigation regressions,
four installed-cache upgrades and 242 page/form/theme/accessibility measurements.
All 2,110 Swiss municipalities retain their sourced bundled emblem; nine
calendar validation tests also pass. Lint's seven old state-producer errors were
resolved by explicit remembered state and keyed coroutine effects while retaining
the previous successful data during refresh.

Browser flows use isolated API fixtures. Android scroll tests render Compose
views under Robolectric API 34, including saved-instance-state restoration.
These checks do not establish physical GPS/camera capture, Web push, real
production sign-in or two-device sync. The previously documented production
chat-image upload limitation is separate and has not been fixed by this change.

Current Android artifact hashes and public signing fingerprint are in
`android-release.json`; web checks and the case inventory are in `validation.json`.
`hosting-before.json` records the previous live Hosting version. Only the Web
client is deployed to Firebase Hosting; backend/rules are unchanged.
