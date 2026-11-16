# Quartinaut Web 5.11.6: complete website review

All 47 native catalog links and secondary destinations were inspected on
390- and 1440-pixel viewports. The review additionally opens all 11 settings
panels, account gates, registration, legal/help/admin dialogs and all three
steps of both request types. Representative pages and forms were checked in
green, black and Swiss-red themes as well as the default light design.

The final 242 rendered view checks pass: no page/control overflow, unnamed
fields, duplicate visible IDs, duplicate/missing page H1s, Axe WCAG A/AA
violations or uncaught JavaScript errors. The initial 177-view review found
23 problem views; the expanded checks also exposed dark/red contrast defects.
Automated accessibility checks complement the visual review and do not
constitute full accessibility certification.

Changes include consistent headings, spacing and card/form widths; wrapping
filters; transaction input/result columns; two-column QR and comparison forms;
settings overview cards; readable theme colours; German field validation and
character counters; Swiss date formatting; clearer search/error/status copy;
and correct page titles and navigation state. The installed website may now
use either orientation. Existing legal facts and backend contracts are retained.

Functional corrections cover modal drafts surviving the close button, explicit
draft discard, local validation of loan return dates, the help route and the
transaction refresh control. Regression tests exercise those behaviors along
with the existing shared-account workflows, location privacy and maps.

Validation: 15 unit tests, 21 browser scenarios, three installed Service Worker
upgrades (5.4.2, 5.11.4 and 5.11.5 to 5.11.6), and 242 page/form/accessibility
checks. Responsive flow checks cover 360, 390, 768, 1024, 1280, 1440 and 1920
pixels. Source bundle and stylesheet hashes and the case inventory are in
`validation.json`. The pre-rollout Hosting version is in `before.json`.

Authenticated browser runs inject isolated API fixtures into an intercepted
bundle. They do not send production messages, create real listings or prove
physical GPS/camera, push delivery or real two-device synchronization. Tests,
dependency files and editable bundle entries are excluded from Hosting.
Only Hosting files are published; Android and backend/rules are unchanged.
The previously documented production chat-image upload limitation is separate.
