"use client";

import type { ReactNode } from "react";

import { AdminSidebar } from "@/components/admin";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import type { AuthUser } from "@/types/auth";

/**
 * The admin shell: a collapsible sidebar plus the content area.
 *
 * Follows the `dash` layout. There is **no top header bar**: the logo, the
 * navigation links and the user menu all live in the sidebar, which is what
 * frees the content area to start at the top of the viewport. The bar inside
 * `SidebarInset` only carries the collapse trigger and a breadcrumb slot, the
 * same as upstream.
 *
 * This replaced a full-width `bg-foreground` bar of `h-24` that held the logo,
 * the horizontal navigation and the user dropdown.
 *
 * A client component because the sidebar needs context, the pathname and the
 * logout handler. The layout stays a server component and passes the already
 * resolved session user down.
 */
interface AdminShellProps {
  user: AuthUser;
  children: ReactNode;
}

export function AdminShell({ user, children }: AdminShellProps) {
  return (
    <SidebarProvider>
      <AdminSidebar user={user} />

      <SidebarInset>
        <header className="bg-background flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-2 h-4" />
        </header>

        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
