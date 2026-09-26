import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AdminDropdown } from "@/components/admin/admin-dropdown";
import type { AuthUser } from "@/types/auth";

/**
 * Renders the real dropdown, not a mock.
 *
 * This exists because of two shipped bugs from the Radix to Base UI migration,
 * both of which the previous suite could not see:
 *
 * 1. `DropdownMenuLabel` maps to Base UI's `Menu.GroupLabel`, a *group* part
 *    that reads `MenuGroupContext` and throws without a group parent. Radix's
 *    `Label` had no such requirement. The result was a runtime crash on the
 *    public landing page.
 * 2. `Button` defaulted `nativeButton` to `true` and warned whenever `render`
 *    substituted an anchor, which every `render={<Link />}` call site did.
 *
 * Neither is visible to the type checker: Base UI enforces both with runtime
 * checks, not types. **Mounting is not enough either.** The first version of
 * this file only mounted the component and passed with the group wrapper
 * removed, because the menu content is portalled and only renders once the menu
 * is actually open. These tests therefore open it.
 */
const admin = {
  name: "Facundo Podio",
  email: "facundo@caragency.com",
  role: "ADMIN",
  isActive: true,
} as AuthUser;

async function openMenu() {
  const user = userEvent.setup();
  render(<AdminDropdown user={admin} />);

  const trigger = screen.getByRole("button", { name: /menú de usuario/i });
  // Plain assertions: this project does not install @testing-library/jest-dom.
  expect(trigger).toBeTruthy();
  expect(trigger.tagName).toBe("BUTTON");

  await user.click(trigger);
  return user;
}

describe("AdminDropdown", () => {
  it("opens the menu without throwing", async () => {
    await openMenu();

    await waitFor(() => {
      // The user identity block lives inside DropdownMenuLabel, which is the
      // part that requires a group parent.
      expect(screen.getByText("Facundo Podio")).toBeTruthy();
      expect(screen.getByText("facundo@caragency.com")).toBeTruthy();
    });
  });

  it("shows the admin-only navigation for an ADMIN", async () => {
    await openMenu();

    await waitFor(() => {
      expect(screen.getByText("Usuarios")).toBeTruthy();
      expect(screen.getByText("Configuración")).toBeTruthy();
    });
  });

  it("renders the logout action", async () => {
    await openMenu();

    await waitFor(() => {
      expect(screen.getByText("Cerrar sesión")).toBeTruthy();
    });
  });

  it("does not log a nativeButton warning when rendering a link trigger", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await openMenu();
    await waitFor(() => {
      expect(screen.getByText("Facundo Podio")).toBeTruthy();
    });

    const nativeButtonWarnings = error.mock.calls.filter((call) =>
      String(call[0]).includes("nativeButton"),
    );

    error.mockRestore();
    expect(nativeButtonWarnings).toEqual([]);
  });
});
