"use client";

import { useState } from "react";
import { Board } from "../components/board";
import { SignIn } from "../components/sign-in";

export default function Home() {
  const [isSignedIn, setIsSignedIn] = useState(false);

  return (
    <>
      <Board isVisible={isSignedIn} onLogout={() => setIsSignedIn(false)} />
      {!isSignedIn && <SignIn onSignIn={() => setIsSignedIn(true)} />}
    </>
  );
}
