import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignIn } from "../components/sign-in";
import * as api from "../lib/api";

vi.mock("../lib/api", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
}));

describe("SignIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/");
  });

  it("signs in with valid credentials", async () => {
    const user = userEvent.setup();
    const onSignIn = vi.fn();
    vi.mocked(api.signIn).mockResolvedValue({ id: "1", username: "alice" });
    render(<SignIn onSignIn={onSignIn} />);

    await user.type(screen.getByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Open board" }));

    expect(api.signIn).toHaveBeenCalledWith("alice", "password123");
    expect(onSignIn).toHaveBeenCalledOnce();
  });

  it("shows an error for invalid credentials", async () => {
    const user = userEvent.setup();
    const onSignIn = vi.fn();
    vi.mocked(api.signIn).mockRejectedValue(new Error("Invalid username or password."));
    render(<SignIn onSignIn={onSignIn} />);

    await user.type(screen.getByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Open board" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid username or password.");
    expect(onSignIn).not.toHaveBeenCalled();
  });

  it("signs up a new account", async () => {
    const user = userEvent.setup();
    const onSignIn = vi.fn();
    vi.mocked(api.signUp).mockResolvedValue({ id: "2", username: "newuser" });
    render(<SignIn onSignIn={onSignIn} />);

    await user.click(screen.getByRole("button", { name: "Don't have an account? Sign up" }));
    await user.type(screen.getByLabelText("Username"), "newuser");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm password"), "password123");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(api.signUp).toHaveBeenCalledWith("newuser", "password123");
    expect(onSignIn).toHaveBeenCalledOnce();
  });

  it("rejects mismatched passwords on sign up without calling the API", async () => {
    const user = userEvent.setup();
    render(<SignIn onSignIn={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Don't have an account? Sign up" }));
    await user.type(screen.getByLabelText("Username"), "newuser");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm password"), "different");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Passwords do not match.");
    expect(api.signUp).not.toHaveBeenCalled();
  });

  it("shows a server error when sign up fails, e.g. a duplicate username", async () => {
    const user = userEvent.setup();
    const onSignIn = vi.fn();
    vi.mocked(api.signUp).mockRejectedValue(new Error("Username is already taken"));
    render(<SignIn onSignIn={onSignIn} />);

    await user.click(screen.getByRole("button", { name: "Don't have an account? Sign up" }));
    await user.type(screen.getByLabelText("Username"), "taken");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm password"), "password123");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Username is already taken");
    expect(onSignIn).not.toHaveBeenCalled();
  });

  it("disables the submit button while a sign-in request is in flight", async () => {
    const user = userEvent.setup();
    let resolveSignIn: (user: api.AuthUser) => void = () => {};
    vi.mocked(api.signIn).mockReturnValue(new Promise((resolve) => { resolveSignIn = resolve; }));
    render(<SignIn onSignIn={vi.fn()} />);

    await user.type(screen.getByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Password"), "password123");
    const submitButton = screen.getByRole("button", { name: "Open board" });
    await user.click(submitButton);

    expect(submitButton).toBeDisabled();
    resolveSignIn({ id: "1", username: "alice" });
    await vi.waitFor(() => expect(submitButton).not.toBeDisabled());
  });

  it("shows the generic message without a reset link for an unknown username", async () => {
    const user = userEvent.setup();
    vi.mocked(api.forgotPassword).mockResolvedValue({
      message: "If that account exists, a reset link was generated.",
      reset_token: null,
    });
    render(<SignIn onSignIn={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Forgot password?" }));
    await user.type(screen.getByLabelText("Username"), "nobody");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByText(/reset link was generated/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reset your password" })).not.toBeInTheDocument();
  });

  it("shows an error and stays on the reset screen when the token is invalid or expired", async () => {
    const user = userEvent.setup();
    vi.mocked(api.resetPassword).mockRejectedValue(new Error("Invalid or expired reset token"));
    window.history.replaceState({}, "", "/?reset_token=stale-token");
    render(<SignIn onSignIn={vi.fn()} />);

    await user.type(await screen.findByLabelText("New password"), "newpassword123");
    await user.click(screen.getByRole("button", { name: "Reset password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid or expired reset token");
    expect(screen.getByRole("heading", { name: "Reset your password" })).toBeInTheDocument();
  });

  it("requests a password reset and can jump to the reset screen with the token pre-filled", async () => {
    const user = userEvent.setup();
    vi.mocked(api.forgotPassword).mockResolvedValue({
      message: "If that account exists, a reset link was generated.",
      reset_token: "abc123",
    });
    render(<SignIn onSignIn={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Forgot password?" }));
    await user.type(screen.getByLabelText("Username"), "alice");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByText(/reset link was generated/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reset your password" }));

    expect(screen.getByLabelText("Reset token")).toHaveValue("abc123");
  });

  it("reads a reset_token query param on mount and jumps to the reset screen", async () => {
    window.history.replaceState({}, "", "/?reset_token=xyz789");
    render(<SignIn onSignIn={vi.fn()} />);

    expect(await screen.findByLabelText("Reset token")).toHaveValue("xyz789");
  });

  it("resets the password with a token and returns to sign in", async () => {
    const user = userEvent.setup();
    vi.mocked(api.resetPassword).mockResolvedValue(undefined);
    window.history.replaceState({}, "", "/?reset_token=xyz789");
    render(<SignIn onSignIn={vi.fn()} />);

    await user.type(await screen.findByLabelText("New password"), "newpassword123");
    await user.click(screen.getByRole("button", { name: "Reset password" }));

    expect(api.resetPassword).toHaveBeenCalledWith("xyz789", "newpassword123");
    expect(await screen.findByRole("heading", { name: "Sign in to Kanban board" })).toBeInTheDocument();
    expect(screen.getByText("Password updated, sign in with your new password.")).toBeInTheDocument();
  });
});
