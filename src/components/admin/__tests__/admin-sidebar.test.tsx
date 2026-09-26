import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import type { AuthUser } from "@/types/auth";

/**
 * The sidebar's user menu is a second implementation of the same pattern as
 * `AdminDropdown`, so it carries the same risk: `DropdownMenuLabel` maps to
 * Base UI's `Menu.GroupLabel`, which throws at runtime without a group parent.
 * That bug shipped once already and crashed the public landing page.
 *
 * These tests open the menu rather than only mounting it. Mounting is not
 * enough: the content is portalled and renders only once the menu is open, so a
 * mount-only test passes with the bug present.
 */
const admin = {
  name: "Facundo Podio",
  email: "facundo@caragency.com",
  role: "ADMIN",
  isActive: true,
} as AuthUser;

function renderSidebar(user: AuthUser = admin) {
  return render(
    <SidebarProvider>
      <AdminSidebar user={user} />
    </SidebarProvider>,
  );
}

async function openUserMenu() {
  const user = userEvent.setup();
  renderSidebar();

  // The trigger is the size="lg" menu button holding the name and email.
  const trigger = screen.getByRole("button", {
    name: /facundo podrío|facundo@caragency\.com/i,
  });
  await user.click(trigger);
  return user;
}

describe("AdminSidebar", () => {
  it("renders the logo and the navigation links", () => {
    renderSidebar();

    expect(screen.getByRole("link", { name: /panel/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /vehículos/i })).toBeTruthy();
  });

  it("hides admin-only links from a COLLABORATOR", () => {
    renderSidebar({ ...admin, role: "COLLABORATOR" });

    expect(screen.getByRole("link", { name: /panel/i })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /usuarios/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /configuración/i })).toBeNull();
  });

  it("opens the user menu without throwing", async () => {
    await openUserMenu();

    await waitFor(() => {
      // Reaches the DropdownMenuLabel identity block, which is the part that
      // requires a group parent.
      expect(
        screen.getAllByText("facundo@caragency.com").length,
      ).toBeGreaterThan(0);
    });
  });

  it("puts the navigation and the logout action inside the user menu", async () => {
    await openUserMenu();

    await waitFor(() => {
      expect(screen.getByText("Cerrar sesión")).toBeTruthy();
    });

    // The links live in the dropdown, not as duplicate footer items.
    expect(
      screen.getAllByRole("menuitem", { name: /sitio público/i }).length,
    ).toBe(1);
  });
});
