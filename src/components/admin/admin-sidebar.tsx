"use client";

import { ChevronsUpDown, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { AdminLogo } from "@/components/admin";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { ADMIN_NAVIGATION } from "@/data/admin-navigation";
import { isActiveRoute } from "@/lib/constants";
import { logout } from "@/lib/auth/logout";
import type { AuthUser } from "@/types/auth";

/**
 * The admin sidebar: the header, the links and the user menu.
 *
 * Layout follows the `dash` block's composition, with the project's own classes
 * and its own data source. `dash` hardcodes `url: "#"` in four places;
 * `ADMIN_NAVIGATION` already carries an icon, Spanish labels and role gating, so
 * it is consumed rather than duplicated.
 *
 * Two shapes exist in that array and both are handled explicitly:
 * - `href` renders a link.
 * - `action: "logout"` has **no** `href` and renders a button. The old
 *   horizontal navigation filtered on `item.href`, which silently dropped it.
 *
 * Role gating filters on `roles` exactly as the horizontal navigation did. That
 * is a UI-level filter, not a server guard, unchanged from before.
 *
 * The `logout` action lives **inside the user menu**, which is where the `dash`
 * block puts it. It is deliberately not also a separate item in the footer: two
 * sign-out affordances in the same panel is a duplicate.
 */

/** Initials for the menu trigger and the identity block. */
function initialsOf(name: string | null, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]);
  return letters.join("").toUpperCase() || "?";
}

function SidebarNavUser({ user }: { user: AuthUser }) {
  const { isMobile } = useSidebar();
  const pathname = usePathname();
  const initials = initialsOf(user.name, user.email);

  const items = ADMIN_NAVIGATION.filter(
    (item) =>
      item.showInDropdown &&
      item.href &&
      (!item.roles || item.roles.includes(user.role)),
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-[popup-open]:bg-sidebar-accent data-[popup-open]:text-sidebar-accent-foreground"
              />
            }
          >
            <span
              aria-hidden="true"
              className="bg-sidebar-primary text-sidebar-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold"
            >
              {initials}
            </span>
            <span className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs">{user.email}</span>
            </span>
            <ChevronsUpDown className="ml-auto size-4 shrink-0" />
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-56 min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            {/* Base UI's GroupLabel needs a group parent; Radix's Label did
                not. Without this the menu throws on open. */}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <span
                    aria-hidden="true"
                    className="bg-sidebar-primary text-sidebar-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold"
                  >
                    {initials}
                  </span>
                  <span className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs">{user.email}</span>
                  </span>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              {items.map((item) => {
                const Icon = item.icon;
                const active = isActiveRoute(pathname, item.href!);

                return (
                  <DropdownMenuItem
                    key={item.id}
                    render={
                      <Link
                        href={item.href!}
                        aria-current={active ? "page" : undefined}
                      />
                    }
                  >
                    {Icon && <Icon className="mr-2 size-4" />}
                    {item.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              {ADMIN_NAVIGATION.filter((item) => item.action === "logout").map(
                (item) => {
                  const Icon = item.icon ?? LogOut;

                  return (
                    <DropdownMenuItem
                      key={item.id}
                      onClick={logout}
                      className="text-destructive focus:text-destructive"
                    >
                      <Icon className="mr-2 size-4" />
                      {item.label}
                    </DropdownMenuItem>
                  );
                },
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function AdminSidebar({ user }: { user: AuthUser }) {
  const pathname = usePathname();
  const { state, isMobile } = useSidebar();

  const linkItems = ADMIN_NAVIGATION.filter(
    (item) => item.href && (!item.roles || item.roles.includes(user.role)),
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="px-2 py-1">
          <AdminLogo />
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Panel</SidebarGroupLabel>
          <SidebarMenu>
            {linkItems.map((item) => {
              const Icon = item.icon;
              const active = isActiveRoute(pathname, item.href!);

              return (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={active}
                    tooltip={
                      state === "collapsed" && !isMobile
                        ? item.label
                        : undefined
                    }
                    render={
                      <Link
                        href={item.href!}
                        aria-current={active ? "page" : undefined}
                      />
                    }
                  >
                    {Icon && <Icon aria-hidden="true" />}
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />
        <SidebarNavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
