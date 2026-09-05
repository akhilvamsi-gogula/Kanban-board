"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole, UserPlus } from "lucide-react";
import { forgotPassword, resetPassword, signIn, signUp, type AuthUser } from "../lib/api";

type SignInProps = {
  onSignIn: (user: AuthUser) => void;
};

type AuthView = "sign-in" | "sign-up" | "forgot-password" | "reset-password";

function tokenFromLocation(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("reset_token") ?? "";
}

type PasswordFieldProps = {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
};

function PasswordField({ id, name, label, autoComplete, value, onChange }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <label htmlFor={id}>{label}</label>
      <div className="auth-password-field">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="auth-password-toggle"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </>
  );
}

export function SignIn({ onSignIn }: SignInProps) {
  const [resetToken, setResetToken] = useState(tokenFromLocation);
  const [view, setView] = useState<AuthView>(() => (resetToken ? "reset-password" : "sign-in"));
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forgotUsername, setForgotUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function switchView(next: AuthView) {
    setView(next);
    setError("");
    setInfoMessage(null);
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      onSignIn(await signIn(username, password));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      onSignIn(await signUp(username, password));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign up.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleForgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResetLink(null);
    setInfoMessage(null);
    setIsSubmitting(true);
    try {
      const result = await forgotPassword(forgotUsername);
      setInfoMessage(result.message);
      if (result.reset_token) {
        setResetToken(result.reset_token);
        setResetLink(`${window.location.origin}${window.location.pathname}?reset_token=${result.reset_token}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to request a reset.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await resetPassword(resetToken, newPassword);
      setUsername("");
      setPassword("");
      setNewPassword("");
      switchView("sign-in");
      setInfoMessage("Password updated, sign in with your new password.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (view === "sign-up") {
    return (
      <main className="auth-shell">
        <section className="auth-panel" aria-labelledby="sign-up-heading">
          <div className="auth-icon" aria-hidden="true"><UserPlus size={20} /></div>
          <span className="kicker">Create your workspace</span>
          <h1 id="sign-up-heading">Sign up for Kanban board</h1>
          <p className="auth-copy">Create an account to get your own private board.</p>
          <form className="auth-form" onSubmit={handleSignUp} noValidate>
            <label htmlFor="signup-username">Username</label>
            <input id="signup-username" name="username" type="text" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} />
            <PasswordField id="signup-password" name="password" label="Password" autoComplete="new-password" value={password} onChange={setPassword} />
            <PasswordField id="signup-confirm-password" name="confirmPassword" label="Confirm password" autoComplete="new-password" value={confirmPassword} onChange={setConfirmPassword} />
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button type="submit" className="button button-primary" disabled={isSubmitting}>Create account <ArrowRight size={17} /></button>
          </form>
          <p className="auth-links"><button type="button" className="button-link" onClick={() => switchView("sign-in")}>Already have an account? Sign in</button></p>
        </section>
      </main>
    );
  }

  if (view === "forgot-password") {
    return (
      <main className="auth-shell">
        <section className="auth-panel" aria-labelledby="forgot-password-heading">
          <div className="auth-icon" aria-hidden="true"><KeyRound size={20} /></div>
          <span className="kicker">Account recovery</span>
          <h1 id="forgot-password-heading">Forgot password</h1>
          <p className="auth-copy">Enter your username and we&apos;ll generate a reset link.</p>
          <form className="auth-form" onSubmit={handleForgotPassword} noValidate>
            <label htmlFor="forgot-username">Username</label>
            <input id="forgot-username" name="username" type="text" autoComplete="username" value={forgotUsername} onChange={(event) => setForgotUsername(event.target.value)} />
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button type="submit" className="button button-primary" disabled={isSubmitting}>Send reset link <ArrowRight size={17} /></button>
          </form>
          {infoMessage && <p className="auth-copy" role="status">{infoMessage}</p>}
          {resetLink && (
            <div className="auth-token">
              <p>In production this link would be emailed to you. For this demo, here it is:</p>
              <code>{resetLink}</code>
              <button type="button" className="button button-quiet button-small" onClick={() => switchView("reset-password")}>Reset your password</button>
            </div>
          )}
          <p className="auth-links"><button type="button" className="button-link" onClick={() => switchView("sign-in")}>Back to sign in</button></p>
        </section>
      </main>
    );
  }

  if (view === "reset-password") {
    return (
      <main className="auth-shell">
        <section className="auth-panel" aria-labelledby="reset-password-heading">
          <div className="auth-icon" aria-hidden="true"><KeyRound size={20} /></div>
          <span className="kicker">Account recovery</span>
          <h1 id="reset-password-heading">Reset your password</h1>
          <p className="auth-copy">Paste your reset token if it isn&apos;t already filled in, then choose a new password.</p>
          <form className="auth-form" onSubmit={handleResetPassword} noValidate>
            <label htmlFor="reset-token">Reset token</label>
            <input id="reset-token" name="token" type="text" value={resetToken} onChange={(event) => setResetToken(event.target.value)} />
            <PasswordField id="reset-new-password" name="newPassword" label="New password" autoComplete="new-password" value={newPassword} onChange={setNewPassword} />
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button type="submit" className="button button-primary" disabled={isSubmitting}>Reset password <ArrowRight size={17} /></button>
          </form>
          <p className="auth-links"><button type="button" className="button-link" onClick={() => switchView("sign-in")}>Back to sign in</button></p>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-labelledby="sign-in-heading">
        <div className="auth-icon" aria-hidden="true"><LockKeyhole size={20} /></div>
        <span className="kicker">Private workspace</span>
        <h1 id="sign-in-heading">Sign in to Kanban board</h1>
        <p className="auth-copy">Sign in to open your board.</p>
        <form className="auth-form" onSubmit={handleSignIn} noValidate>
          <label htmlFor="username">Username</label>
          <input id="username" name="username" type="text" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} />
          <PasswordField id="password" name="password" label="Password" autoComplete="current-password" value={password} onChange={setPassword} />
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button type="submit" className="button button-primary" disabled={isSubmitting}>Open board <ArrowRight size={17} /></button>
        </form>
        {infoMessage && <p className="auth-copy" role="status">{infoMessage}</p>}
        <p className="auth-links">
          <button type="button" className="button-link" onClick={() => switchView("sign-up")}>Don&apos;t have an account? Sign up</button>
          <button type="button" className="button-link" onClick={() => switchView("forgot-password")}>Forgot password?</button>
        </p>
      </section>
    </main>
  );
}
