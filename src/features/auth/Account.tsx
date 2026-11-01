/** Cloud-mode sidebar pieces: the workspace switcher, the Team button and the account box. */
import { LogOut, Users } from 'lucide-react';
import { openDialog, useApp, type SyncStatus } from '../../app/store';
import { initials } from '../../lib/utils/text';
import { Avatar, Icon, avatarBg } from '../../components/shared';
import { colorFor, logOut, switchWorkspace, useSession } from './session';

export function WorkspacePicker() {
  const workspaces = useSession((s) => s.workspaces);
  const workspaceId = useSession((s) => s.workspaceId);
  return (
    <div className="ws-pick">
      <label className="sr-only" htmlFor="workspaceSelect">
        Workspace
      </label>
      <select
        id="workspaceSelect"
        className="field ws-select"
        value={workspaceId || ''}
        onChange={(e) => {
          if (e.target.value === '__new') openDialog('team');
          else switchWorkspace(e.target.value);
        }}
      >
        {workspaces.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
        <option value="__new">New workspace…</option>
      </select>
    </div>
  );
}

const STATUS_TEXT: Record<SyncStatus, string> = {
  synced: 'All changes saved',
  saving: 'Saving…',
  offline: 'Offline, retrying',
};

/** Local mode's profile card: the demo "me", and where the data lives. */
export function LocalProfile() {
  const me = useApp((s) => s.team.find((m) => m.id === s.me));
  return (
    <div className="account">
      <Avatar id={me?.id || ''} />
      <div className="account-text">
        <strong className="account-name">{me?.name || 'You'}</strong>
        <span className="account-sync">Local mode · saved in this browser</span>
      </div>
    </div>
  );
}

export function AccountBox() {
  const user = useSession((s) => s.user);
  const sync = useApp((s) => s.syncStatus);
  if (!user) return null;
  return (
    <>
      <button type="button" className="nav-item" onClick={() => openDialog('team')}>
        <Users size={18} aria-hidden="true" />
        <span className="nav-label">Team</span>
      </button>
      <div className="account">
        <span
          className="avatar"
          style={{ background: avatarBg(colorFor(user.id)) }}
          aria-hidden="true"
        >
          {initials(user.name)}
        </span>
        <div className="account-text">
          <strong className="account-name">{user.name}</strong>
          <span className={`account-sync ${sync}`} role="status">
            {STATUS_TEXT[sync]}
          </span>
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label="Log out"
          title="Log out"
          onClick={logOut}
        >
          <Icon icon={LogOut} />
        </button>
      </div>
    </>
  );
}
