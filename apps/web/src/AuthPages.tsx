import { useState, type FormEvent, type ReactNode } from 'react';

import { AuthApiError, loginUser, registerUser } from './api/auth';
import { useAuth } from './auth/AuthContext';
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
    <div className="min-h-screen bg-[#F4F1EA] text-[#171717]">
      <header className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-6 lg:px-12">
        <a
          href="/"
          aria-label="Maison Motoring home"
          className="group flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E56B45]"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-[#171717] text-[10px] tracking-normal text-[#F4F1EA] motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:rotate-12">
            M/01
          </span>
          Maison Motoring
        </a>
        <a
          href={alternateHref}
          className="text-xs font-semibold uppercase tracking-[0.16em] text-[#171717]/60 underline decoration-[#E56B45] decoration-2 underline-offset-8 transition-colors hover:text-[#E56B45] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E56B45]"
        >
          {alternateLabel}
        </a>
      </header>

      <main>
        <section className="mx-auto grid max-w-[1440px] gap-12 px-6 pb-20 pt-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-24 lg:px-12 lg:pb-32 lg:pt-24">
          <div className="hidden min-h-[520px] overflow-hidden rounded-[2rem] bg-[#A8B5A0] p-5 lg:block">
            <div className="relative h-full overflow-hidden rounded-[1.5rem] border border-[#F4F1EA]/55">
              <div className="absolute -right-20 top-16 size-80 rounded-full bg-[#E56B45]/75 blur-3xl" />
              <div className="absolute -bottom-28 -left-12 size-96 rounded-full bg-[#171717]/75 blur-3xl" />
              <div className="absolute bottom-36 left-1/2 h-32 w-4/5 -translate-x-1/2 -skew-x-12 rounded-[45%_55%_20%_20%] bg-[#171717]" />
              <div className="absolute bottom-32 left-[18%] size-14 rounded-full border-8 border-[#171717] bg-[#F4F1EA]" />
              <div className="absolute bottom-32 right-[18%] size-14 rounded-full border-8 border-[#171717] bg-[#F4F1EA]" />
              <p className="absolute bottom-8 left-8 text-xs font-semibold uppercase tracking-[0.18em] text-[#F4F1EA]">
                A considered beginning.
              </p>
            </div>
          </div>

          <div className="max-w-xl">
            <p className="mb-6 text-xs font-semibold uppercase tracking-[0.24em] text-[#E56B45]">
              {eyebrow}
            </p>
            <h1 className="font-display text-[clamp(3.5rem,8vw,7rem)] leading-[0.88] tracking-[-0.07em]">
              {title}
            </h1>
            <p className="mt-7 max-w-md text-base leading-7 text-[#171717]/65">{alternateText}</p>
            <div className="mt-10">{children}</div>
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
    <div
      id="auth-form-error"
      role="alert"
      className="rounded-2xl border border-[#E56B45]/45 bg-[#E56B45]/10 px-4 py-3 text-sm leading-6"
    >
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
        className="space-y-5"
        noValidate
        onSubmit={handleSubmit}
        aria-busy={isSubmitting}
      >
        <div>
          <label htmlFor="registration-name" className="mb-2 block text-sm font-semibold">
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
            className="w-full rounded-2xl border border-[#171717]/20 bg-white/35 px-5 py-4 outline-none transition-colors placeholder:text-[#171717]/35 focus:border-[#E56B45]"
          />
        </div>
        <div>
          <label htmlFor="registration-email" className="mb-2 block text-sm font-semibold">
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
            className="w-full rounded-2xl border border-[#171717]/20 bg-white/35 px-5 py-4 outline-none transition-colors placeholder:text-[#171717]/35 focus:border-[#E56B45]"
          />
        </div>
        <div>
          <label htmlFor="registration-password" className="mb-2 block text-sm font-semibold">
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
            className="w-full rounded-2xl border border-[#171717]/20 bg-white/35 px-5 py-4 outline-none transition-colors placeholder:text-[#171717]/35 focus:border-[#E56B45]"
          />
          <p id="password-hint" className="mt-2 text-xs leading-5 text-[#171717]/55">
            At least 8 characters with uppercase, lowercase, and a number.
          </p>
        </div>
        <FormError message={error} />
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full bg-[#171717] px-6 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-[#F4F1EA] transition-[background-color,transform] duration-300 hover:-translate-y-1 hover:bg-[#E56B45] disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none motion-reduce:hover:transform-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E56B45]"
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
  const [error, setError] = useState<string | null>(null);
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
        className="space-y-5"
        noValidate
        onSubmit={handleSubmit}
        aria-busy={isSubmitting}
      >
        <div>
          <label htmlFor="login-email" className="mb-2 block text-sm font-semibold">
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
            className="w-full rounded-2xl border border-[#171717]/20 bg-white/35 px-5 py-4 outline-none transition-colors placeholder:text-[#171717]/35 focus:border-[#E56B45]"
          />
        </div>
        <div>
          <label htmlFor="login-password" className="mb-2 block text-sm font-semibold">
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
            className="w-full rounded-2xl border border-[#171717]/20 bg-white/35 px-5 py-4 outline-none transition-colors placeholder:text-[#171717]/35 focus:border-[#E56B45]"
          />
        </div>
        <FormError message={error} />
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full bg-[#171717] px-6 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-[#F4F1EA] transition-[background-color,transform] duration-300 hover:-translate-y-1 hover:bg-[#E56B45] disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none motion-reduce:hover:transform-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E56B45]"
        >
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthLayout>
  );
}

export function AuthRequiredPage() {
  return (
    <div className="min-h-screen bg-[#F4F1EA] text-[#171717]">
      <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-20">
        <section className="w-full rounded-[2rem] border border-[#171717]/15 bg-white/25 px-6 py-14 text-center sm:px-12">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.24em] text-[#E56B45]">
            Maison Motoring
          </p>
          <h1 className="font-display text-5xl tracking-[-0.06em]">Sign in to continue.</h1>
          <p className="mx-auto mt-5 max-w-md text-base leading-7 text-[#171717]/65">
            Your account keeps the considered collection close and your access secure.
          </p>
          <a
            href="/login"
            className="mt-8 inline-flex rounded-full bg-[#171717] px-6 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-[#F4F1EA] transition-[background-color,transform] duration-300 hover:-translate-y-1 hover:bg-[#E56B45] motion-reduce:transition-none motion-reduce:hover:transform-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E56B45]"
          >
            Go to login
          </a>
        </section>
      </main>
    </div>
  );
}
