"use client";

import type { ReactNode } from "react";

import { AdminDropdown, AdminSidebarNav } from "@/components/admin";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { logout } from "@/lib/auth/logout";
import type { AuthUser } from "@/types/auth";

/**
 * The admin shell: a collapsible sidebar plus the content area.
 *
 * The logo lives in the sidebar header and the user dropdown in the inset's
 * slim bar, which is where the upstream shadcn layout puts them. The horizontal
 * `AdminHeader` this replaces was a full-width `bg-foreground` bar of `h-24`;
 * the bar here is the height the sidebar layout expects.
 *
 * This is a client component because the sidebar needs context, the pathname
 * and the logout handler. The layout stays a server component and passes the
 * already-resolved session user down.
 */
interface AdminShellProps {
  user: AuthUser;
  children: ReactNode;
}

export function AdminShell({ user, children }: AdminShellProps) {
  return (
    <SidebarProvider>
      <AdminSidebarNav role={user.role} onLogout={logout} />

      <SidebarInset>
        <header className="bg-background flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex-1" />
          <AdminDropdown user={user} />
        </header>

        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
