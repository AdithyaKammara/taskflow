import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  addDays,
  ago,
  diffDays,
  fromISO,
  isValidISO,
  toISO,
  todayISO,
} from '../src/lib/utils/dates';

const NOW = new Date(2026, 9, 26, 10, 0);

describe('dates', () => {
  it('round-trips ISO strings without time-zone drift', () => {
    assert.equal(toISO(fromISO('2026-10-26')), '2026-10-26');
    assert.equal(todayISO(NOW), '2026-10-26');
  });

  it('adds days across month and year boundaries', () => {
    assert.equal(addDays('2026-10-31', 1), '2026-11-01');
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  });

  it('counts whole days from today', () => {
    assert.equal(diffDays('2026-10-26', NOW), 0);
    assert.equal(diffDays('2026-10-29', NOW), 3);
    assert.equal(diffDays('2026-10-20', NOW), -6);
  });

  it('validates real calendar dates only', () => {
    assert.equal(isValidISO('2026-02-31'), false);
    assert.equal(isValidISO('2026-13-01'), false);
    assert.equal(isValidISO('26-10-2026'), false);
    assert.equal(isValidISO(20261026), false);
    assert.equal(isValidISO('2024-02-29'), true);
    assert.equal(isValidISO('2026-02-29'), false);
  });

  it('describes elapsed time in words', () => {
    const now = 1_700_000_000_000;
    assert.equal(ago(now - 10_000, now), 'just now');
    assert.equal(ago(now - 5 * 60_000, now), '5 min ago');
    assert.equal(ago(now - 3 * 3_600_000, now), '3 h ago');
    assert.equal(ago(now - 2 * 86_400_000, now), '2 d ago');
  });
});
