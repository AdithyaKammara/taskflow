import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { csvCell, toCsv } from '../src/lib/utils/csv';

describe('csv', () => {
  it('quotes cells and escapes embedded quotes', () => {
    assert.equal(csvCell('say "hi"'), '"say ""hi"""');
    assert.equal(csvCell(null), '""');
    assert.equal(csvCell(5), '"5"');
  });

  it('neutralises spreadsheet formulas', () => {
    for (const bad of ['=SUM(A1)', '+1', '-1', '@cmd', '\tx']) {
      assert.ok(csvCell(bad).startsWith(`"'`), `${bad} should be prefixed`);
    }
    assert.equal(csvCell('normal = fine'), '"normal = fine"');
  });

  it('joins rows with CRLF and starts with a BOM for Excel', () => {
    const out = toCsv([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    assert.ok(out.startsWith('﻿'));
    assert.equal(out.slice(1), '"a","b"\r\n"c","d"');
  });
});
