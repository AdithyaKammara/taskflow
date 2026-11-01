import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { parseQuickAdd } from '../src/lib/model/parser';

// Monday, 26 October 2026 (local time) keeps every date assertion deterministic.
const NOW = new Date(2026, 9, 26, 10, 0);

describe('parseQuickAdd', () => {
  it('picks the title, date, assignee, tag and priority out of one line', () => {
    assert.deepEqual(parseQuickAdd('Review PR tomorrow @priya #dev !high', NOW), {
      title: 'Review PR',
      priority: 'high',
      due: '2026-10-27',
      tags: ['dev'],
      assignee: 'priya',
    });
  });

  it('returns sensible defaults for a plain title', () => {
    assert.deepEqual(parseQuickAdd('Buy milk', NOW), {
      title: 'Buy milk',
      priority: 'medium',
      due: '',
      tags: [],
      assignee: '',
    });
  });

  it('understands today, tomorrow/tmrw and next week', () => {
    assert.equal(parseQuickAdd('Standup today', NOW).due, '2026-10-26');
    assert.equal(parseQuickAdd('Standup tmrw', NOW).due, '2026-10-27');
    assert.equal(parseQuickAdd('Plan sprint next week', NOW).due, '2026-11-02');
  });

  it('resolves weekday names to the NEXT occurrence', () => {
    assert.equal(parseQuickAdd('Demo friday', NOW).due, '2026-10-30');
    assert.equal(parseQuickAdd('Demo on wed', NOW).due, '2026-10-28');
    // Today is Monday, so "monday" means a week from now, not today.
    assert.equal(parseQuickAdd('Retro monday', NOW).due, '2026-11-02');
  });

  it('removes the date words from the title', () => {
    const p = parseQuickAdd('Call client on friday', NOW);
    assert.equal(p.title, 'Call client');
    assert.equal(p.due, '2026-10-30');
  });

  it('accepts an explicit ISO date but ignores impossible ones', () => {
    assert.equal(parseQuickAdd('Ship 2026-12-25', NOW).due, '2026-12-25');
    const bad = parseQuickAdd('Ship 2026-02-31', NOW);
    assert.equal(bad.due, '');
    assert.match(bad.title, /2026-02-31/);
  });

  it('maps !med to medium and ignores unknown priorities', () => {
    assert.equal(parseQuickAdd('Task !med', NOW).priority, 'medium');
    assert.equal(parseQuickAdd('Task !low', NOW).priority, 'low');
    assert.equal(parseQuickAdd('Task !urgent', NOW).priority, 'medium');
  });

  it('matches assignees by id or first name and leaves unknown @names in the title', () => {
    assert.equal(parseQuickAdd('Fix bug @rahul', NOW).assignee, 'rahul');
    assert.equal(parseQuickAdd('Fix bug @Ananya', NOW).assignee, 'ananya');
    const unknown = parseQuickAdd('Ping @nobody', NOW);
    assert.equal(unknown.assignee, '');
    assert.equal(unknown.title, 'Ping @nobody');
  });

  it('lowercases and de-duplicates tags and keeps at most five', () => {
    assert.deepEqual(parseQuickAdd('x #Dev #dev #a #b #c #d #e', NOW).tags, [
      'dev',
      'a',
      'b',
      'c',
      'd',
    ]);
  });

  it('gives an empty title when the line contains only metadata', () => {
    assert.equal(parseQuickAdd('#dev !high tomorrow', NOW).title, '');
  });

  it('collapses extra whitespace', () => {
    assert.equal(parseQuickAdd('   Write    report   ', NOW).title, 'Write report');
  });
});
