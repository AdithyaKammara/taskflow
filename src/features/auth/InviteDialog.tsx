/**
 * Asks before joining the workspace behind an invite link, so a link someone else sent cannot move
 * a signed-in person into a workspace (where its members would see the tasks they add) unawares.
 * The workspace's name is not shown: people can only read a workspace once they are members.
 */
import { Modal } from '../../components/shared';
import { acceptPendingInvite, declinePendingInvite, useSession } from './session';

export function InviteDialog() {
  const open = useSession((s) => s.pendingInvite);
  return (
    <Modal
      open={open}
      onClose={declinePendingInvite}
      className="modal"
      aria-labelledby="inviteTitle"
    >
      <div className="dlg-inner">
        <div className="dlg-head">
          <h2 id="inviteTitle">Join a workspace?</h2>
        </div>
        <p>
          You opened an invite link. Joining adds you to that workspace: its members will see the
          tasks you add there, and you will see theirs.
        </p>
        <p className="muted">Only join if you know and trust the person who sent you the link.</p>
        <div className="set-row">
          <button className="btn btn-primary" type="button" onClick={acceptPendingInvite} autoFocus>
            Join workspace
          </button>
          <button className="btn" type="button" onClick={declinePendingInvite}>
            Not now
          </button>
        </div>
      </div>
    </Modal>
  );
}
