import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SignIn } from "../components/sign-in";

describe("SignIn", () => {
  it("rejects empty credentials", async () => {
    const user = userEvent.setup();
    render(<SignIn onSignIn={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Open board" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter the demo username and password");
  });

  it("rejects invalid credentials", async () => {
    const user = userEvent.setup();
    const onSignIn = vi.fn();
    render(<SignIn onSignIn={onSignIn} />);

    await user.type(screen.getByLabelText("Username"), "wrong");
    await user.type(screen.getByLabelText("Password"), "credentials");
    await user.click(screen.getByRole("button", { name: "Open board" }));

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(onSignIn).not.toHaveBeenCalled();
  });

  it("accepts the demo credentials", async () => {
    const user = userEvent.setup();
    const onSignIn = vi.fn();
    render(<SignIn onSignIn={onSignIn} />);

    await user.type(screen.getByLabelText("Username"), "user");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Open board" }));

    expect(onSignIn).toHaveBeenCalledOnce();
  });
});