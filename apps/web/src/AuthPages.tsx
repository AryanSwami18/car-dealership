import { useState, type FormEvent, type ReactNode } from 'react';

import { AuthApiError, loginUser, registerUser } from './api/auth';
import { useAuth } from './auth/AuthContext';
import { MaisonVehicleArt } from './MaisonVehicleArt';
import { navigateTo } from './navigation';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function AuthLayout({
  alternateHref,
  alternateLabel,
  alternateText,
  children,
  eyebrow,
  title,
}: {
  alternateHref: string;
  alternateLabel: string;
  alternateText: string;
  children: ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="maison-page maison-motion-enter">
      <header className="maison-container maison-header">
        <a href="/" aria-label="Maison Motoring home" className="maison-brand">
          <span className="maison-mark">M/01</span>
          <span>Maison Motoring</span>
        </a>
        <a href={alternateHref} className="maison-link">
          {alternateLabel}
        </a>
      </header>

      <main>
        <section className="maison-container maison-auth-layout">
          <MaisonVehicleArt label="Abstract studio vehicle study" variant="hero" />

          <div className="maison-auth-copy maison-motion-enter maison-motion-enter--late">
            <p className="maison-eyebrow">{eyebrow}</p>
            <h1 className="maison-auth-title">{title}</h1>
            <p className="maison-auth-intro">{alternateText}</p>
            <div className="maison-auth-form-wrap">{children}</div>
          </div>
        </section>
      </main>
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }

  return (
    <div id="auth-form-error" role="alert" className="maison-feedback maison-feedback--error">
      {message}
    </div>
  );
}

export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const hasStrongPassword =
      password.length >= 8 &&
      /[a-z]/.test(password) &&
      /[A-Z]/.test(password) &&
      /\d/.test(password);

    if (!normalizedName || !normalizedEmail || !password) {
      setError('Name, email, and password are required.');
      return;
    }

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError('Email must be a valid email address.');
      return;
    }

    if (!hasStrongPassword) {
      setError(
        'Password must be at least 8 characters and contain uppercase, lowercase, and numeric characters.',
      );
      return;
    }

    setIsSubmitting(true);

    try {
      await registerUser({ name: normalizedName, email: normalizedEmail, password });
      navigateTo('/login');
    } catch (submissionError) {
      setError(
        submissionError instanceof AuthApiError
          ? submissionError.message
          : 'Unable to create your account.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      alternateHref="/login"
      alternateLabel="Sign in"
      alternateText="Create a considered account to keep your collection close and your next drive in view."
      eyebrow="Join the collection"
      title="Create account."
    >
      <form
        aria-label="Registration"
        className="maison-auth-form"
        noValidate
        onSubmit={handleSubmit}
        aria-busy={isSubmitting}
      >
        <div>
          <label htmlFor="registration-name" className="maison-form-label">
            Name
          </label>
          <input
            id="registration-name"
            type="text"
            name="name"
            autoComplete="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="maison-form-input"
          />
        </div>
        <div>
          <label htmlFor="registration-email" className="maison-form-label">
            Email
          </label>
          <input
            id="registration-email"
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="maison-form-input"
          />
        </div>
        <div>
          <label htmlFor="registration-password" className="maison-form-label">
            Password
          </label>
          <input
            id="registration-password"
            type="password"
            name="password"
            autoComplete="new-password"
            required
            aria-describedby="password-hint"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="maison-form-input"
          />
          <p id="password-hint" className="maison-form-hint">
            At least 8 characters with uppercase, lowercase, and a number.
          </p>
        </div>
        <FormError message={error} />
        <button
          type="submit"
          disabled={isSubmitting}
          className="maison-button maison-button--primary maison-button--full"
        >
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  );
}

export function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get('reason') === 'session-expired'
      ? 'Your session has expired. Please sign in again.'
      : null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setError('Email and password are required.');
      return;
    }

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError('Email must be valid.');
      return;
    }

    setIsSubmitting(true);

    try {
      const session = await loginUser({ email: normalizedEmail, password });
      signIn(session);
      navigateTo('/inventory');
    } catch (submissionError) {
      setError(
        submissionError instanceof AuthApiError ? submissionError.message : 'Unable to sign in.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      alternateHref="/register"
      alternateLabel="Create an account"
      alternateText="Sign in to keep exploring the considered collection and the road ahead."
      eyebrow="Welcome back"
      title="Sign in to the road."
    >
      <form
        aria-label="Login"
        className="maison-auth-form"
        noValidate
        onSubmit={handleSubmit}
        aria-busy={isSubmitting}
      >
        <div>
          <label htmlFor="login-email" className="maison-form-label">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="maison-form-input"
          />
        </div>
        <div>
          <label htmlFor="login-password" className="maison-form-label">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="maison-form-input"
          />
        </div>
        <FormError message={error} />
        <button
          type="submit"
          disabled={isSubmitting}
          className="maison-button maison-button--primary maison-button--full"
        >
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthLayout>
  );
}

export function AuthRequiredPage() {
  return (
    <div className="maison-page maison-motion-enter">
      <main className="maison-container maison-protected-layout">
        <section className="maison-protected-card">
          <p className="maison-eyebrow">Maison Motoring</p>
          <h1 className="maison-protected-title">Sign in to continue.</h1>
          <p className="maison-protected-copy">
            Your account keeps the considered collection close and your access secure.
          </p>
          <a href="/login" className="maison-button maison-button--primary">
            Go to login
          </a>
        </section>
      </main>
    </div>
  );
}
