/**
 * The sign-in screen shown instead of the app in cloud mode when nobody is signed in: a quiet
 * scene (drifting particles, grid lines that draw themselves in) behind a frosted card that has
 * Sign in / Sign up tabs, and single cards for the reset, "check your email" and new-password steps.
 */
import { ArrowRight, Eye, EyeOff, Lock, Mail, User, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode, type SubmitEvent } from 'react';
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

const REPO = 'https://github.com/AdithyaKammara/taskflow';

const TITLES: Record<Screen, string> = {
  loading: 'TaskFlow',
  signin: 'Welcome back',
  signup: 'Create your account',
  reset: 'Reset your password',
  sent: 'Check your email',
  newpw: 'Choose a new password',
};

const SUBTITLES: Partial<Record<Screen, string>> = {
  signin: 'Sign in to pick up where your team left off.',
  signup: 'Plan, assign and track work with your team, in sync.',
  reset: 'We will email you a link to choose a new password.',
  newpw: 'Pick something you have not used here before.',
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

/** Slow, sparse particles rising behind the card. Still (one frame) for reduced motion. */
function Particles() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    type P = { x: number; y: number; v: number; o: number };
    let ps: P[] = [];
    let raf = 0;
    let w = 0;
    let h = 0;
    const make = (y = Math.random() * h): P => ({
      x: Math.random() * w,
      y,
      v: Math.random() * 0.25 + 0.05,
      o: Math.random() * 0.35 + 0.15,
    });
    const size = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ps = Array.from({ length: Math.floor((w * h) / 9000) }, () => make());
    };
    const draw = () => {
      // the particle colour follows the theme (light dots on dark, dark dots on light)
      const rgb =
        getComputedStyle(canvas).getPropertyValue('--auth-particle').trim() || '250,250,250';
      ctx.clearRect(0, 0, w, h);
      for (const p of ps) {
        if (!still) p.y -= p.v;
        if (p.y < 0) Object.assign(p, make(h + Math.random() * 40));
        ctx.fillStyle = `rgba(${rgb},${p.o})`;
        ctx.fillRect(p.x, p.y, 0.7, 2.2);
      }
      if (!still) raf = requestAnimationFrame(draw);
    };
    const onResize = () => {
      size();
      if (still) draw();
    };
    size();
    draw();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(raf);
    };
  }, []);
  return <canvas ref={ref} className="auth-particles" aria-hidden="true" />;
}

function Field({
  name,
  label,
  type,
  icon: FieldIcon,
  invalid,
  ...attrs
}: {
  name: keyof AuthFields;
  label: string;
  type: string;
  icon: LucideIcon;
  invalid: boolean;
  autoComplete: string;
  placeholder?: string;
  autoFocus?: boolean;
  maxLength?: number;
  minLength?: number;
  'aria-describedby'?: string;
}) {
  const [shown, setShown] = useState(false);
  const secret = type === 'password';
  return (
    <div className="auth-field">
      <label htmlFor={ID[name]}>{label}</label>
      <div className="auth-input">
        <FieldIcon aria-hidden="true" size={16} className="auth-input-icon" />
        <input
          id={ID[name]}
          name={name}
          type={secret && shown ? 'text' : type}
          required
          aria-invalid={invalid || undefined}
          {...attrs}
        />
        {secret && (
          <button
            type="button"
            className="auth-eye"
            aria-label={shown ? 'Hide password' : 'Show password'}
            aria-pressed={shown}
            onClick={() => setShown((v) => !v)}
          >
            {shown ? <EyeOff aria-hidden="true" size={16} /> : <Eye aria-hidden="true" size={16} />}
          </button>
        )}
      </div>
    </div>
  );
}

const LinkBtn = ({ to, children }: { to: Screen; children: ReactNode }) => (
  <button type="button" className="auth-link" onClick={() => showAuth(to)}>
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

  const newPassword = {
    autoComplete: 'new-password',
    minLength: MIN_PASSWORD,
    placeholder: `At least ${MIN_PASSWORD} characters`,
    'aria-describedby': 'authPwRule',
  };

  return (
    <form className="auth-form" noValidate onSubmit={onSubmit} onInput={() => setInvalid(null)}>
      {screen === 'signup' && (
        <Field
          name="name"
          label="Your name"
          type="text"
          icon={User}
          autoComplete="name"
          placeholder="Priya Sharma"
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
          icon={Mail}
          autoComplete="email"
          placeholder="you@company.com"
          autoFocus={screen !== 'signup'}
          invalid={invalid === 'email'}
        />
      )}
      {screen === 'signin' && (
        <div className="auth-pw">
          <Field
            name="password"
            label="Password"
            type="password"
            icon={Lock}
            autoComplete="current-password"
            placeholder="••••••••"
            invalid={invalid === 'password'}
          />
          <LinkBtn to="reset">Forgot password?</LinkBtn>
        </div>
      )}
      {screen === 'signup' && (
        <Field
          name="password"
          label="Password"
          type="password"
          icon={Lock}
          invalid={invalid === 'password'}
          {...newPassword}
        />
      )}
      {screen === 'newpw' && (
        <Field
          name="password"
          label="New password"
          type="password"
          icon={Lock}
          autoFocus
          invalid={invalid === 'password'}
          {...newPassword}
        />
      )}
      {(screen === 'signup' || screen === 'newpw') && (
        <p id="authPwRule" className="sr-only">{`At least ${MIN_PASSWORD} characters.`}</p>
      )}
      <p id="authError" className="auth-error" role="alert">
        {error}
      </p>
      <button className="auth-submit" type="submit" disabled={busy}>
        {busy ? 'Please wait…' : SUBMIT[screen]}
        {!busy && <ArrowRight aria-hidden="true" size={16} />}
      </button>
    </form>
  );
}

/** Sign in / Sign up as tabs; the other auth steps are single cards with a way back. */
function Tabs({ screen }: { screen: 'signin' | 'signup' }) {
  const tabs = [
    { id: 'signin', label: 'Sign in' },
    { id: 'signup', label: 'Sign up' },
  ] as const;
  return (
    <div className="auth-tabs" role="tablist" aria-label="Account">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          id={`tab-${t.id}`}
          aria-selected={screen === t.id}
          aria-controls="authPanel"
          tabIndex={screen === t.id ? 0 : -1}
          onClick={() => showAuth(t.id)}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            e.preventDefault();
            const other = t.id === 'signin' ? 'signup' : 'signin';
            showAuth(other);
            requestAnimationFrame(() => document.getElementById(`tab-${other}`)?.focus());
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function Body({ screen, arg }: { screen: Screen; arg: string }) {
  switch (screen) {
    case 'loading':
      return <p className="auth-muted">{arg || 'Loading…'}</p>;
    case 'sent':
      return (
        <>
          <p className="auth-muted">
            We sent a link to <strong>{arg}</strong>. Open it on this device to continue.
          </p>
          <div className="auth-foot">
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
          <p className="auth-foot">
            New to TaskFlow? <LinkBtn to="signup">Create an account</LinkBtn>
          </p>
        </>
      );
    case 'signup':
      return (
        <>
          <AuthForm screen={screen} />
          <p className="auth-foot">
            Already have an account? <LinkBtn to="signin">Sign in</LinkBtn>
          </p>
        </>
      );
    case 'reset':
      return (
        <>
          <AuthForm screen={screen} />
          <p className="auth-foot">
            <LinkBtn to="signin">Back to sign in</LinkBtn>
          </p>
        </>
      );
    case 'newpw':
      return <AuthForm screen={screen} />;
  }
}

export function AuthScreen() {
  const screen = useSession((s) => s.screen);
  const arg = useSession((s) => s.screenArg);
  const tabbed = screen === 'signin' || screen === 'signup';
  return (
    <div className="auth-scene">
      <div className="auth-glow" aria-hidden="true" />
      <div className="auth-lines" aria-hidden="true">
        <i className="h" />
        <i className="h" />
        <i className="h" />
        <i className="v" />
        <i className="v" />
        <i className="v" />
      </div>
      <Particles />

      <header className="auth-bar">
        <span className="auth-brand">
          <span aria-hidden="true" className="auth-logo">
            TF
          </span>
          TaskFlow
        </span>
        <a className="auth-bar-btn" href={REPO} target="_blank" rel="noopener">
          Source on GitHub
          <ArrowRight aria-hidden="true" size={15} />
        </a>
      </header>

      <main className="auth-main">
        <section className="auth-card" aria-labelledby="authTitle">
          <h1 id="authTitle" className="auth-title">
            {TITLES[screen]}
          </h1>
          {SUBTITLES[screen] && <p className="auth-sub">{SUBTITLES[screen]}</p>}
          {tabbed && <Tabs screen={screen} />}
          {/* keyed, so each screen starts with an empty form and its own error, and blurs in */}
          <div
            key={screen}
            className="auth-panel"
            id="authPanel"
            {...(tabbed && { role: 'tabpanel', 'aria-labelledby': `tab-${screen}` })}
          >
            <Body screen={screen} arg={arg} />
          </div>
        </section>
        <p className="auth-credit">
          Built by{' '}
          <a href="https://github.com/AdithyaKammara" target="_blank" rel="noopener">
            Adithya Kammara
          </a>
        </p>
      </main>
    </div>
  );
}
