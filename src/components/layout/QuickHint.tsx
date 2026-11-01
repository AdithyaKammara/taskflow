import { HINT_DEFAULT } from '../../lib/config';
import { member } from '../../lib/model/meta';
import { parseQuickAdd } from '../../lib/model/parser';
import { fmtDate } from '../../lib/utils/dates';
import { truncate } from '../../lib/utils/text';

/** The "Will add: …" preview under the quick-add box (shown while it has focus) and its error line. */
export function QuickHint({ text, error }: { text: string; error: string }) {
  let hint = HINT_DEFAULT;
  if (text.trim()) {
    const p = parseQuickAdd(text.trim());
    const bits = [`"${truncate(p.title || '…', 40)}"`, p.priority];
    if (p.due) bits.push(`due ${fmtDate(p.due)}`);
    if (p.assignee) bits.push(`@${member(p.assignee)!.name.split(' ')[0]}`);
    p.tags.forEach((g) => bits.push(`#${g}`));
    hint = 'Will add: ' + bits.join(' · ');
  }
  return (
    <>
      <p id="quickHint" className="hint">
        {hint}
      </p>
      <p id="quickError" className="form-error" role="alert">
        {error}
      </p>
    </>
  );
}
