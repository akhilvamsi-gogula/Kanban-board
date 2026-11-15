"use client";

import { useEffect, useState } from "react";

const TYPICAL_WAKE_SECONDS = 50;

// Eases toward 95% so the bar keeps moving through a slow boot but never claims it finished.
export function wakeProgress(elapsedSeconds: number): number {
  return 95 * (1 - Math.exp((-3 * elapsedSeconds) / TYPICAL_WAKE_SECONDS));
}

type WakeUpScreenProps = {
  startedAt: number;
  failed: boolean;
  onRetry: () => void;
};

export function WakeUpScreen({ startedAt, failed, onRetry }: WakeUpScreenProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (failed) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [failed]);

  const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const progress = Math.round(wakeProgress(elapsedSeconds));

  if (failed) {
    return (
      <main className="state-shell wake-shell">
        <h1>The server is not responding</h1>
        <p>It has not answered after 90 seconds. It may be restarting or temporarily down. Please try again in a moment.</p>
        <button type="button" className="button button-primary" onClick={onRetry}>Try again</button>
      </main>
    );
  }

  return (
    <main className="state-shell wake-shell">
      <h1 role="status">Waking up the server</h1>
      <p>This app runs on a free hosting plan that sleeps after 15 minutes without visitors. Starting it again usually takes 30-50 seconds - this page continues on its own.</p>
      <div className="wake-progress" role="progressbar" aria-label="Server start-up progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={`${elapsedSeconds} seconds elapsed`}>
        <span style={{ width: `${progress}%` }} />
      </div>
      <p className="wake-elapsed" aria-hidden="true">{elapsedSeconds}s</p>
    </main>
  );
}
