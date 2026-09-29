// The same cases collector/tests/test_match.py runs. If one side changes, both must still pass.
import spec from '../../../../shared/match_cases.json';
import { matches, reasons, score } from '../match';

const NOW = new Date(spec.now);
const deviceFor = (c) => ({ ...spec.device, ...(c.device || {}) });

test.each(spec.cases.map((c) => [c.name, c]))('%s', (_, c) => {
  const dev = deviceFor(c);
  expect(matches(c.event, dev, NOW)).toBe(c.expect.matches);
  expect(score(c.event, dev, NOW)[0]).toBe(c.expect.score);
});

test('reasons read like a person wrote them (same as Python)', () => {
  const c = spec.cases[1]; // DTU Delhi
  const ev = { ...c.event, location_approximate: false };
  const [, parts] = score(ev, deviceFor(c), NOW);
  expect(reasons(ev, deviceFor(c), parts, NOW)).toEqual(['Matches Cybersecurity', 'about 33 km away']);
  const first = spec.cases[0];
  const [, p0] = score(first.event, deviceFor(first), NOW);
  expect(reasons(first.event, deviceFor(first), p0, NOW)).toEqual(['Matches AI/ML', 'Online']);
});
