/**
 * Quick-add parser: "Review PR tomorrow @priya #dev !high"
 *   -> { title: 'Review PR', due: <tomorrow>, assignee: 'priya', tags: ['dev'], priority: 'high' }
 * Pure function: pass `now` to make the date handling deterministic in tests.
 */
import { MAX_TAGS, TEAM, WEEKDAYS } from '../config';
import type { Priority } from '../types';
import { addDays, isValidISO, todayISO } from '../utils/dates';

export interface QuickAdd {
  title: string;
  priority: Priority;
  due: string;
  tags: string[];
  assignee: string;
}

function nextWeekday(abbr: string, now: Date) {
  const target = WEEKDAYS.indexOf(abbr.slice(0, 3).toLowerCase());
  const delta = (target - now.getDay() + 7) % 7 || 7;
  return addDays(todayISO(now), delta);
}

export function parseQuickAdd(raw: string, now = new Date()): QuickAdd {
  let text = ' ' + raw + ' ';
  const out: QuickAdd = { title: '', priority: 'medium', due: '', tags: [], assignee: '' };

  text = text.replace(/(\s)#([\w-]{1,20})(?=\s)/g, (_m, sp: string, tag: string) => {
    const g = tag.toLowerCase();
    if (out.tags.length < MAX_TAGS && !out.tags.includes(g)) out.tags.push(g);
    return sp;
  });

  text = text.replace(/(\s)!(high|medium|med|low)(?=\s)/gi, (_m, sp: string, p: string) => {
    const v = p.toLowerCase();
    out.priority = (v === 'med' ? 'medium' : v) as Priority;
    return sp;
  });

  text = text.replace(/(\s)@([a-z]{2,20})(?=\s)/gi, (m, sp: string, name: string) => {
    const k = name.toLowerCase();
    const found = TEAM.find((x) => x.id === k || x.name.toLowerCase().split(' ')[0] === k);
    if (!found) return m;
    out.assignee = found.id;
    return sp;
  });

  const rules: [RegExp, (m: RegExpMatchArray) => string][] = [
    [/\s(\d{4}-\d{2}-\d{2})(?=\s)/, (m) => (isValidISO(m[1]) ? m[1] : '')],
    [/\s(today)(?=\s)/i, () => todayISO(now)],
    [/\s(tomorrow|tmrw)(?=\s)/i, () => addDays(todayISO(now), 1)],
    [/\s(next week)(?=\s)/i, () => addDays(todayISO(now), 7)],
    [
      /\s(?:(?:on|next)\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues?|wed|thur?s?|fri|sat)(?=\s)/i,
      (m) => nextWeekday(m[1], now),
    ],
  ];
  for (const [re, fn] of rules) {
    const m = text.match(re);
    if (!m) continue;
    const iso = fn(m);
    if (iso) {
      out.due = iso;
      text = text.replace(re, ' ');
      break;
    }
  }

  out.title = text.replace(/\s+/g, ' ').trim();
  return out;
}
