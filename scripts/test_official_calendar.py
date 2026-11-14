"""Validate the offline Quartinaut official calendar catalogue and its provenance.

Run: python3 -m unittest discover -s scripts -p 'test_official_calendar.py'
No network, Firebase credentials or third-party dependencies required.
"""
import datetime
import json
import pathlib
import unittest
from urllib.parse import urlparse

ROOT = pathlib.Path(__file__).resolve().parents[1]
CALENDAR = ROOT / 'app' / 'src' / 'main' / 'assets' / 'official_calendar_ch_2026_2030.json'


class OfficialCalendarCatalogueTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with CALENDAR.open(encoding='utf-8') as handle:
            cls.data = json.load(handle)
        cls.rows = cls.data['items']

    def test_report_entries_are_present(self):
        self.assertEqual(61, self.data['originalReportRows'])
        self.assertGreaterEqual(len(self.rows), 190)
        self.assertIn('nicht', self.data['limitations'].lower())

    def test_unique_identifiers_and_minimum_provenance(self):
        self.assertEqual(len(self.rows), len({row['id'] for row in self.rows}))
        for row in self.rows:
            self.assertTrue(row['title'].strip())
            self.assertTrue(row['sourceName'].strip())
            self.assertTrue(row['canton'].strip())
            self.assertTrue(row['sourceNote'].strip())

    def test_dates_and_calendar_safety(self):
        for row in self.rows:
            if row['start']:
                start = datetime.date.fromisoformat(row['start'])
                end = datetime.date.fromisoformat(row['end'])
                self.assertLessEqual(start, end)
            else:
                self.assertEqual('', row['end'])
                self.assertFalse(row['calendarExact'])
            if row['kind'] in ('series', 'pending'):
                self.assertFalse(row['calendarExact'])

    def test_confirmed_dates_link_to_official_sources(self):
        for row in self.rows:
            url = row['sourceUrl']
            if row['status'] == 'confirmed_exact_date':
                self.assertTrue(url, row['title'])
            if url:
                parsed = urlparse(url)
                self.assertEqual('https', parsed.scheme)
                self.assertTrue(parsed.hostname)

    def test_unconfirmed_stans_conflict_remains_visible(self):
        mismatches = [r for r in self.rows if r['status'] == 'needs_review']
        self.assertTrue(mismatches)
        self.assertTrue(any(r['city'] == 'Stans' and r['start'] == '2026-11-17' for r in mismatches))
        self.assertTrue(any('11.11.2026' in r['sourceNote'] for r in mismatches))

    def test_regional_holiday_scopes_are_not_lost(self):
        fr = [r for r in self.rows if r['kind'] == 'holiday' and r['canton'] == 'FR']
        self.assertTrue(fr)
        self.assertEqual({'katholischer Kantonsteil', 'reformierter Kantonsteil'},
                         {r['region'] for r in fr})
        national = [r for r in self.rows if r['kind'] == 'holiday' and r['canton'] == 'CH']
        self.assertEqual(1, len(national))
        self.assertEqual('2027-08-01', national[0]['start'])

    def test_official_year_2027_anchors(self):
        keys = {(r['title'], r['start'], r['canton']) for r in self.rows}
        self.assertIn(('Landsgemeinde', '2027-04-25', 'AI'), keys)
        self.assertIn(('Chienbäse', '2027-02-14', 'BL'), keys)
        self.assertIn(('Basler Fasnacht', '2027-02-15', 'BS'), keys)
        self.assertIn(('Instauration de la République', '2027-03-01', 'NE'), keys)
        self.assertIn(('Jeûne genevois', '2027-09-09', 'GE'), keys)
        self.assertIn(('Luzerner Flohmarkt', '2027-05-01', 'LU'), keys)


if __name__ == '__main__':
    unittest.main()