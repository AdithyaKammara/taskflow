/** The sign-in card shown instead of the app in cloud mode when nobody is signed in. */
import { useState, type ReactNode, type SubmitEvent } from 'react';
import { KEYS } from '../../lib/config';
import { readPref } from '../../lib/store/storage';
import {
  MIN_PASSWORD,
  showAuth,
  submitAuth,
  useSession,
  validate,
  type AuthFields,
  type Screen,
} from './session';

const TITLES: Record<Screen, string> = {
  loading: 'TaskFlow',
  signin: 'Sign in',
  signup: 'Create your account',
  reset: 'Reset your password',
  sent: 'Check your email',
  newpw: 'Choose a new password',
};

const SUBMIT: Partial<Record<Screen, string>> = {
  signin: 'Sign in',
  signup: 'Create account',
  reset: 'Send reset link',
  newpw: 'Save password',
};

const ID: Record<keyof AuthFields, string> = {
  name: 'authName',
  email: 'authEmail',
  password: 'authPassword',
};

function Field({
  name,
  label,
  type,
  invalid,
  ...attrs
}: {
  name: keyof AuthFields;
  label: string;
  type: string;
  invalid: boolean;
  autoComplete: string;
  autoFocus?: boolean;
  maxLength?: number;
  minLength?: number;
  'aria-describedby'?: string;
}) {
  return (
    <label className="prop block">
      <span className="prop-label">{label}</span>
      <input
        id={ID[name]}
        name={name}
        className="field"
        type={type}
        required
        aria-invalid={invalid || undefined}
        {...attrs}
      />
    </label>
  );
}

const LinkBtn = ({ to, children }: { to: Screen; children: ReactNode }) => (
  <button type="button" className="link" onClick={() => showAuth(to)}>
    {children}
  </button>
);

function AuthForm({ screen }: { screen: Screen }) {
  const screenError = useSession((s) => s.screenError);
  const [error, setError] = useState(screenError);
  const [invalid, setInvalid] = useState<keyof AuthFields | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const value = (n: string) =>
      (form.elements.namedItem(n) as HTMLInputElement | null)?.value || '';
    const fields = { name: value('name'), email: value('email'), password: value('password') };
    const bad = validate(screen, fields);
    if (bad) {
      setError(bad[1]);
      setInvalid(bad[0]);
      document.getElementById(ID[bad[0]])?.focus();
      return;
    }
    setError('');
    setBusy(true);
    try {
      await submitAuth(screen, fields);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const pwRule = <p id="authPwRule" className="muted">{`At least ${MIN_PASSWORD} characters.`}</p>;
  const newPassword = {
    autoComplete: 'new-password',
    minLength: MIN_PASSWORD,
    'aria-describedby': 'authPwRule',
  };

  return (
    <form className="auth-form" noValidate onSubmit={onSubmit} onInput={() => setInvalid(null)}>
      {screen === 'signup' && (
        <Field
          name="name"
          label="Your name"
          type="text"
          autoComplete="name"
          maxLength={60}
          autoFocus
          invalid={invalid === 'name'}
        />
      )}
      {screen !== 'newpw' && (
        <Field
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          autoFocus={screen !== 'signup'}
          invalid={invalid === 'email'}
        />
      )}
      {screen === 'signin' && (
        <Field
          name="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          invalid={invalid === 'password'}
        />
      )}
      {screen === 'signup' && (
        <Field
          name="password"
          label="Password"
          type="password"
          invalid={invalid === 'password'}
          {...newPassword}
        />
      )}
      {screen === 'newpw' && (
        <Field
          name="password"
          label="New password"
          type="password"
          autoFocus
          invalid={invalid === 'password'}
          {...newPassword}
        />
      )}
      {(screen === 'signup' || screen === 'newpw') && pwRule}
      <p id="authError" className="form-error" role="alert">
        {error}
      </p>
      <button className="btn btn-primary auth-submit" type="submit" disabled={busy}>
        {busy ? 'Please wait…' : SUBMIT[screen]}
      </button>
    </form>
  );
}

function Body({ screen, arg }: { screen: Screen; arg: string }) {
  switch (screen) {
    case 'loading':
      return <p className="muted">{arg || 'Loading…'}</p>;
    case 'sent':
      return (
        <>
          <p>{`We sent a link to ${arg}. Open it on this device to continue.`}</p>
          <div className="auth-links">
            <LinkBtn to="signin">Back to sign in</LinkBtn>
          </div>
        </>
      );
    case 'signin':
      return (
        <>
          {readPref(KEYS.invite) && (
            <p className="auth-note">Sign in or create an account to join your team.</p>
          )}
          <AuthForm screen={screen} />
          <div className="auth-links">
            <LinkBtn to="reset">Forgot your password?</LinkBtn>
            <LinkBtn to="signup">Create an account</LinkBtn>
          </div>
        </>
      );
    case 'signup':
      return (
        <>
          <AuthForm screen={screen} />
          <div className="auth-links">
            <LinkBtn to="signin">I already have an account</LinkBtn>
          </div>
        </>
      );
    case 'reset':
      return (
        <>
          <p className="muted">We will email you a link to choose a new password.</p>
          <AuthForm screen={screen} />
          <div className="auth-links">
            <LinkBtn to="signin">Back to sign in</LinkBtn>
          </div>
        </>
      );
    case 'newpw':
      return <AuthForm screen={screen} />;
  }
}

export function AuthScreen() {
  const screen = useSession((s) => s.screen);
  const arg = useSession((s) => s.screenArg);
  return (
    <section className="auth" aria-labelledby="authTitle">
      <div className="auth-card glass">
        <div className="mb-5 flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid size-[30px] place-items-center rounded-sm bg-accent font-heading text-[0.78rem] font-extrabold text-accent-contrast"
          >
            TF
          </span>
          <span className="font-heading text-[1.15rem] font-bold tracking-tight">TaskFlow</span>
        </div>
        <h1 id="authTitle" className="auth-title">
          {TITLES[screen]}
        </h1>
        {/* keyed, so each screen starts with an empty form and its own error */}
        <Body key={screen} screen={screen} arg={arg} />
      </div>
    </section>
  );
}
