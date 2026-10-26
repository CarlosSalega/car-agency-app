import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The 2FA branch of sign-in.
 *
 * A correct password for a 2FA-enabled account returns `200` with
 * `twoFactorRedirect: true` and **no session**. Sending that user to `/admin`
 * would have the guard bounce them straight back to the login page with no
 * explanation, so this branch is the difference between "2FA works" and "2FA
 * looks like a broken login".
 */

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { LoginForm } from "@/components/login-form";

function submitCredentials() {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "admin@caragency.com" },
  });
  fireEvent.change(screen.getByLabelText("Contraseña"), {
    target: { value: "admin1234" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));
}

beforeEach(() => {
  push.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LoginForm two-factor branch", () => {
  it("sends a 2FA user to the code step instead of the admin panel", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          twoFactorRedirect: true,
          twoFactorMethods: ["totp"],
        }),
      })),
    );

    render(<LoginForm />);
    submitCredentials();

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/two-factor");
    });

    expect(push).not.toHaveBeenCalledWith("/admin");
  });

  it("reports bad credentials without navigating anywhere", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ message: "Invalid email or password" }),
      })),
    );

    render(<LoginForm />);
    submitCredentials();

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    expect(push).not.toHaveBeenCalled();
  });
});
