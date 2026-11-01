/**
 * CSV helpers. Cells that start with = + - @ (or a tab/CR) are prefixed with an apostrophe so
 * spreadsheet apps never evaluate them as formulas (CSV/formula injection).
 */

export function csvCell(value: unknown) {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Rows -> CSV text with a UTF-8 BOM so Excel opens it correctly. */
export function toCsv(rows: unknown[][]) {
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}
