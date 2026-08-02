import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (name) => readFile(new URL(name, import.meta.url), 'utf8');

test('Activity adapter uses the real controller and honest lifecycle states without standalone window imports', async () => {
  const [source, styles] = await Promise.all([read('./Modul8rActivityAdapter.jsx'), read('./modul8rActivity.css')]);
  assert.match(source, /useActivityController\(\{ active, profileAddress, repository \}\)/);
  assert.match(source, /REFRESH FAILED/);
  assert.match(source, /PARTIAL ON-CHAIN DATA/);
  assert.match(source, /NO RECENT PROFILE ACTIVITY/);
  assert.match(source, /getOfficialProfileUrl/);
  assert.doesNotMatch(source, /ActivityBrowser|activityBrowser\.css|createPortal|onVisitProfile|Search|SIZE/);
  assert.match(styles, /var\(--lattice-menu-panel\)/);
  assert.doesNotMatch(styles, /\.activity-browser|position:\s*fixed|lattice-rack-/);
});
