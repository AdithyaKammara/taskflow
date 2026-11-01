import { hideToast, useApp } from '../app/store';

/** Bottom-of-screen notification with an optional Undo button. Always mounted, so screen readers hear it. */
export function Toast() {
  const t = useApp((s) => s.toast);
  return (
    <div className={`toast${t ? ' show' : ''}`} role="status" aria-live="polite">
      {t && <span key={t.key}>{t.message}</span>}
      {t?.undo && (
        <button
          type="button"
          className="toast-btn"
          onClick={() => {
            t.undo!();
            hideToast();
          }}
        >
          Undo
        </button>
      )}
    </div>
  );
}
