/** The Team dialog (cloud mode): members, invite links, a new workspace, and leaving. */
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { closeDialog, toast, useApp } from '../../app/store';
import { Avatar, Icon, Modal } from '../../components/shared';
import {
  currentWorkspace,
  inviteLink,
  leaveWorkspace,
  myRole,
  newWorkspace,
  removeFromWorkspace,
  useSession,
} from './session';

/** A button that needs a second click within 4 seconds, like v6's "armed" buttons. */
function ConfirmButton({
  label,
  confirm,
  className,
  onConfirm,
  ...aria
}: {
  label: string;
  confirm: string;
  className: string;
  onConfirm: () => void;
  'aria-label'?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        onConfirm();
      }}
      {...aria}
    >
      {armed ? confirm : label}
    </button>
  );
}

function Invite() {
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="set-group">
      <p className="set-label">Invite teammates</p>
      <p className="muted" id="inviteHelp">
        Anyone with the link can join this workspace for the next 7 days.
      </p>
      <div className="set-row">
        <button
          className="btn btn-primary"
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              setLink(await inviteLink());
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Create invite link
        </button>
      </div>
      {link && (
        <div className="set-row invite-out">
          <label className="sr-only" htmlFor="inviteLink">
            Invite link
          </label>
          <input
            id="inviteLink"
            className="field"
            type="text"
            readOnly
            value={link}
            aria-describedby="inviteHelp"
            onFocus={(e) => e.target.select()}
            autoFocus
          />
          <button
            className="btn"
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                toast('Invite link copied');
              } catch {
                (document.getElementById('inviteLink') as HTMLInputElement | null)?.select();
                toast('Press Ctrl+C to copy the link');
              }
            }}
          >
            Copy
          </button>
        </div>
      )}
      <p className="form-error" role="alert">
        {error}
      </p>
    </div>
  );
}

function NewWorkspace() {
  const [error, setError] = useState('');
  return (
    <form
      className="set-group new-ws"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem('name') as HTMLInputElement;
        try {
          await newWorkspace(input.value);
          closeDialog();
        } catch (err) {
          setError((err as Error).message);
          input.focus();
        }
      }}
    >
      <label className="set-label" htmlFor="newWorkspaceName">
        New workspace
      </label>
      <div className="set-row">
        <input
          id="newWorkspaceName"
          name="name"
          className="field"
          type="text"
          maxLength={60}
          autoComplete="off"
          placeholder="e.g. Design team"
          aria-describedby="newWorkspaceError"
        />
        <button className="btn" type="submit">
          Create
        </button>
      </div>
      <p id="newWorkspaceError" className="form-error" role="alert">
        {error}
      </p>
    </form>
  );
}

function TeamBody() {
  const members = useSession((s) => s.members);
  const user = useSession((s) => s.user);
  const owner = myRole() === 'owner';
  return (
    <div className="dlg-inner">
      <div className="dlg-head">
        <h2 id="teamTitle">{`Team · ${currentWorkspace()?.name || ''}`}</h2>
        <button className="icon-btn" type="button" aria-label="Close team" onClick={closeDialog}>
          <Icon icon={X} />
        </button>
      </div>
      <div className="set-group">
        <p className="set-label">Members</p>
        <ul className="member-list">
          {members.map((m) => (
            <li key={m.id} className="member">
              <Avatar id={m.id} />
              <div className="member-text">
                <strong>{m.id === user?.id ? `${m.name} (you)` : m.name}</strong>
                <span className="muted">{m.email}</span>
              </div>
              {m.role === 'owner' && <span className="badge due">Owner</span>}
              {owner && m.role !== 'owner' && (
                <ConfirmButton
                  className="btn sm danger"
                  label="Remove"
                  confirm="Confirm"
                  aria-label={`Remove ${m.name}`}
                  onConfirm={() => removeFromWorkspace(m.id)}
                />
              )}
            </li>
          ))}
        </ul>
      </div>
      <Invite />
      <NewWorkspace />
      {!owner && (
        <div className="set-group">
          <div className="set-row">
            <ConfirmButton
              className="btn danger"
              label="Leave this workspace"
              confirm="Click again to leave"
              onConfirm={leaveWorkspace}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function TeamDialog() {
  const open = useApp((s) => s.dialog === 'team');
  return (
    <Modal open={open} onClose={closeDialog} className="modal" aria-labelledby="teamTitle">
      <TeamBody />
    </Modal>
  );
}
