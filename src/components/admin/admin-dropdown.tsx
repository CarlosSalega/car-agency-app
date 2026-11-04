"use client";

import Link from "next/link";
import { ShieldCheck, User } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ADMIN_NAVIGATION } from "@/data/admin-navigation";
import { isActiveRoute } from "@/lib/constants/navigation";
import { logout } from "@/lib/auth/logout";
import { cn } from "@/lib/utils";

interface AdminDropdownProps {
  user: {
    name: string | null;
    email: string;
    role: "ADMIN" | "COLLABORATOR";
  };
  /**
   * `icon` (default) is the panel's square button. `text` is for the public
   * footer, where an icon button next to the copyright would look like a control
   * from another product: there the trigger is the same mono label as the
   * "Acceso" link it replaces.
   */
  variant?: "icon" | "text";
}

export function AdminDropdown({ user, variant = "icon" }: AdminDropdownProps) {
  const pathname = usePathname();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          variant === "text" ? (
            <Button
              variant="ghost"
              aria-label="Menú de usuario"
              className="text-muted-foreground hover:text-foreground h-auto gap-1.5 px-0 py-0 font-mono text-[10px] tracking-[0.14em] uppercase hover:bg-transparent"
            >
              {user.name ?? "Mi cuenta"}
              <span aria-hidden="true" className="text-[8px]">
                ▾
              </span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="icon"
              aria-label="Menú de usuario"
              className="hover:bg-background hover:text-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              {user.role === "ADMIN" ? (
                <ShieldCheck className="size-5" />
              ) : (
                <User className="size-5" />
              )}
            </Button>
          )
        }
      />

      <DropdownMenuContent align="end" className="w-64">
        {/* Base UI's GroupLabel reads MenuGroupContext and throws without a
            group parent. Radix's Label did not require one, so the wrapper
            alone would crash. The user identity block is a natural group. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-2 px-2">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-muted-foreground text-xs">{user.email}</p>
              <p className="text-muted-foreground text-xs capitalize">
                {user.role.toLowerCase()}
              </p>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {ADMIN_NAVIGATION.filter(
          (item) =>
            item.showInDropdown &&
            (!item.roles || item.roles.includes(user.role)),
        ).map((item) => {
          const Icon = item.icon;

          if (item.action === "logout") {
            return (
              <DropdownMenuItem
                key={item.id}
                onClick={logout}
                className="focus:text-primary-foreground space-y-2 px-4 py-2"
              >
                {Icon && (
                  <Icon className="focus:text-primary-foreground mr-2 size-4" />
                )}
                {item.label}
              </DropdownMenuItem>
            );
          }

          const active = isActiveRoute(pathname, item.href!);

          return (
            <DropdownMenuItem
              key={item.id}
              render={
                <Link
                  href={item.href!}
                  prefetch={false}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex w-full items-center rounded-md px-4 py-2 text-sm outline-none",

                    !active &&
                      "data-highlighted:bg-primary data-highlighted:text-primary-foreground",

                    active &&
                      "data-highlighted:text-brand data-highlighted:bg-transparent",
                  )}
                >
                  {Icon && (
                    <Icon
                      className={cn(
                        "mr-2 size-4 shrink-0",

                        active ? "text-brand" : "text-current",

                        active && "data-highlighted:text-brand",
                      )}
                    />
                  )}

                  <span
                    className={cn(
                      "inline-block",

                      active &&
                        "text-brand border-brand -mb-1 border-b-2 pb-0.5",

                      active && "data-[highlighted]:no-border",
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              }
            />
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
