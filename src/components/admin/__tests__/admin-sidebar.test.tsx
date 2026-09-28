import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminShell } from "@/components/admin/admin-shell";
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

/**
 * `useIsMobile` (src/hooks/use-mobile.ts) is asked the same question twice and
 * both answers must agree before it flips: `matchMedia("(max-width: 767px)")`
 * for the initial read, and `window.innerWidth < 768` in the `change`
 * handler it also calls on mount. Overriding only one of the two leaves the
 * hook reporting desktop, and `Sidebar` then renders the rail instead of the
 * sheet — the test still "passes" while asserting nothing about mobile at all.
 * So the override drives both, and it has to be installed *before* render
 * because `SidebarProvider` reads `useIsMobile` on its first render.
 */
const MOBILE_QUERY = "(max-width: 767px)";

function matchMediaStub(matches: boolean) {
  return vi.fn().mockImplementation((query: string) => ({
    matches: matches && query === MOBILE_QUERY,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function setViewport({ mobile }: { mobile: boolean }) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: matchMediaStub(mobile),
  });
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: mobile ? 480 : 1024,
  });
}

// `vitest.setup.ts` defines `matchMedia` as writable/configurable precisely so
// tests can override it, and it never resets anything between tests. Without
// this cleanup a mobile test would leak a mobile viewport into every test that
// runs after it and silently change what the desktop ones render.
afterEach(() => {
  setViewport({ mobile: false });
});

/**
 * The mobile tests render the real `AdminShell` rather than a hand-rolled
 * `setOpenMobile(true)` button. The opening trigger genuinely lives in the
 * shell, not in `AdminSidebar` — the sidebar only reads `openMobile` — so a
 * test-local button would be asserting against a door the app does not have.
 * `AdminShell` is cheap (provider, sidebar, trigger, inset) and puts the real
 * `SidebarTrigger` in play, which means the whole path is production code:
 * real `openMobile` state, real `toggleSidebar`, real `onClick`.
 */
function renderMobileShell() {
  setViewport({ mobile: true });
  return render(
    <AdminShell user={admin}>
      <div>Contenido del panel</div>
    </AdminShell>,
  );
}

/**
 * The sheet popup, as it actually appears in the DOM.
 *
 * `[data-slot="sheet-content"]` looks like the obvious handle and is NOT one:
 * `Sidebar` passes its own `data-slot="sidebar"` to `SheetContent`, and
 * `SheetContent` spreads props after its own `data-slot`, so the mobile popup
 * ends up tagged `data-slot="sidebar"` with `data-mobile="true"`. Scoping to
 * the portal keeps this unambiguous — `sheet-portal` is never overridden —
 * rather than relying on a `data-slot` value that a caller can steal.
 */
function sheetPopup() {
  return document.querySelector(
    '[data-slot="sheet-portal"] [data-slot="sidebar"][data-mobile="true"]',
  );
}

/** The backdrop, which `SheetContent` renders itself and no caller overrides. */
function sheetOverlay() {
  return document.querySelector('[data-slot="sheet-overlay"]');
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

/**
 * Regression cover for the mobile overlay that stayed open on top of the page
 * it had just navigated to.
 *
 * `isMobile` makes `Sidebar` swap the rail for a `Sheet`, and a `Link` inside a
 * sheet does not close the sheet. The fix is an explicit `setOpenMobile(false)`
 * on the nav links. Asserting that the `onClick` prop exists would test the
 * implementation; asserting that the sheet leaves the document after a tap
 * tests the behaviour, so that is what these do.
 *
 * Expect one line of jsdom noise per tap: `next/link` finds no App Router
 * context here, so its own click handler never calls `preventDefault` and the
 * anchor falls through to jsdom's unimplemented navigation. It is harmless and
 * the assertions are about the sheet, not the router, so it is left alone
 * rather than papered over with a global router stub.
 */
describe("AdminSidebar on mobile", () => {
  it("renders the sidebar in a sheet that starts closed", () => {
    renderMobileShell();

    // If the viewport override were wrong, `Sidebar` would have rendered the
    // desktop rail: no sheet at all, and `getByRole("link", { name: /vehículos/
    // })` would still find the nav. The closed assertion is what makes that
    // failure visible instead of silent.
    expect(sheetPopup()).toBeNull();
    expect(sheetOverlay()).toBeNull();
    expect(screen.queryByRole("link", { name: /vehículos/i })).toBeNull();
  });

  it("closes the sheet when a navigation link is tapped", async () => {
    const user = userEvent.setup();
    renderMobileShell();

    // Open through the shell's own trigger.
    await user.click(
      screen.getByRole("button", { name: /mostrar u ocultar la navegación/i }),
    );

    const link = await screen.findByRole("link", { name: /vehículos/i });
    expect(sheetPopup()).not.toBeNull();
    expect(sheetOverlay()).not.toBeNull();

    await user.click(link);

    // The overlay must be gone, not merely behind the destination page. A
    // closed Base UI popup unmounts, so absence from the document is the
    // assertion — checking a `data-state` attribute would pass on a sheet that
    // is still mounted over the content.
    await waitFor(() => {
      expect(sheetPopup()).toBeNull();
      expect(sheetOverlay()).toBeNull();
    });
  });

  it("closes the sheet when a link inside the user menu is tapped", async () => {
    const user = userEvent.setup();
    renderMobileShell();

    await user.click(
      screen.getByRole("button", { name: /mostrar u ocultar la navegación/i }),
    );
    await screen.findByRole("link", { name: /vehículos/i });

    // The same bug in the second place: the dropdown items are `Link`s too.
    await user.click(
      screen.getByRole("button", {
        name: /facundo podrío|facundo@caragency\.com/i,
      }),
    );
    const menuLink = await screen.findByRole("menuitem", {
      name: /sitio público/i,
    });

    await user.click(menuLink);

    await waitFor(() => {
      expect(sheetPopup()).toBeNull();
      expect(sheetOverlay()).toBeNull();
    });
  });
});
