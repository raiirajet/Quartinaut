import test from 'node:test';
import assert from 'node:assert/strict';
import {dateOnlyLabel} from '../src/site-ui.mjs';

test('calendar display uses Swiss dates and preserves all-day dates across time zones',()=>{
 assert.equal(dateOnlyLabel('2026-12-24'),'24.12.2026');
 assert.equal(dateOnlyLabel('2026-12-24','2026-12-27'),'24.12.2026 – 27.12.2026');
 assert.equal(dateOnlyLabel('2026-12-24','2026-12-24'),'24.12.2026');
});
test('unknown or invalid calendar dates do not become invented dates',()=>{
 for(const input of ['',null,'2026-02-31','2026-13-01','2026','unbekannt'])assert.equal(dateOnlyLabel(input),'Datum noch offen');
 assert.equal(dateOnlyLabel('2028-02-29'),'29.02.2028');
 assert.equal(dateOnlyLabel('', '', 'Jahr bestätigt'),'Jahr bestätigt');
});
