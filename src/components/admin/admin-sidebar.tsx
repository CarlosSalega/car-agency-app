"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { AdminLogo } from "@/components/admin";
import { Button } from "@/components/ui/button";
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
import type { Role } from "@generated/prisma/enums";

/**
 * The admin sidebar navigation.
 *
 * Consumes `ADMIN_NAVIGATION` rather than hardcoding items, which is strictly
 * better than the `dash` block: the items already carry an icon, Spanish labels
 * and role gating, where `dash` hardcodes `url: "#"` in four places.
 *
 * Two shapes exist in that array and both are handled explicitly:
 * - `href` renders a link.
 * - `action: "logout"` has **no** `href` and renders a button instead. The old
 *   horizontal navigation filtered on `item.href`, which silently dropped it
 *   there; here it is an explicit branch.
 *
 * Role gating filters on `roles` the same way the horizontal navigation did. That
 * is a UI-level filter and not a server guard, unchanged from before.
 */
interface AdminSidebarProps {
  role: Role;
  /** Called when the `logout` action is chosen. */
  onLogout: () => void;
}

function AdminSidebarNav({ role, onLogout }: AdminSidebarProps) {
  const pathname = usePathname();
  const { state, isMobile } = useSidebar();

  const items = ADMIN_NAVIGATION.filter(
    (item) => !item.roles || item.roles.includes(role),
  );

  const linkItems = items.filter((item) => Boolean(item.href));
  const actions = items.filter((item) => item.action === "logout");

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

      {actions.length > 0 && (
        <SidebarFooter>
          <SidebarSeparator />
          <SidebarMenu>
            {actions.map((item) => {
              const Icon = item.icon ?? LogOut;

              return (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    tooltip={
                      state === "collapsed" && !isMobile
                        ? item.label
                        : undefined
                    }
                    render={
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={onLogout}
                      />
                    }
                  >
                    <Icon aria-hidden="true" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}

export { AdminSidebarNav };
