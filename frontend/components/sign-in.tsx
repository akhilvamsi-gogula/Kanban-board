"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";

type SignInProps = {
  onSignIn: () => void;
};

export function SignIn({ onSignIn }: SignInProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (username === "user" && password === "password") {
      setError("");
      onSignIn();
      return;
    }
    setError("Enter the demo username and password to continue.");
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-labelledby="sign-in-heading">
        <div className="auth-icon" aria-hidden="true"><LockKeyhole size={20} /></div>
        <span className="kicker">Private workspace</span>
        <h1 id="sign-in-heading">Sign in to Kanban board</h1>
        <p className="auth-copy">Use the demo account to open the Q3 product launch board.</p>
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <label htmlFor="username">Username</label>
          <input id="username" name="username" type="text" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} />
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button type="submit" className="button button-primary">Open board <ArrowRight size={17} /></button>
        </form>
        <p className="demo-note">Demo access only. This is not real authentication.</p>
      </section>
    </main>
  );
}