"use client";

import Link from "next/link";
import { ShieldCheck, User } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ADMIN_NAVIGATION } from "@/data/admin-navigation";
import { isActiveRoute } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils";

interface AdminDropdownProps {
  user: {
    name: string | null;
    email: string;
    role: "ADMIN" | "COLLABORATOR";
  };
}

export function AdminDropdown({ user }: AdminDropdownProps) {
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/";
    } catch (error) {
      console.error("Error al cerrar sesión", error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
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
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-2 px-2">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-muted-foreground text-xs">{user.email}</p>
            <p className="text-muted-foreground text-xs capitalize">
              {user.role.toLowerCase()}
            </p>
          </div>
        </DropdownMenuLabel>

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
                onClick={handleLogout}
                className="focus:text-background space-y-2 px-4 py-2"
              >
                {Icon && <Icon className="focus:text-background mr-2 size-4" />}
                {item.label}
              </DropdownMenuItem>
            );
          }

          const active = isActiveRoute(pathname, item.href!);

          return (
            <DropdownMenuItem key={item.id} asChild>
              <Link
                href={item.href!}
                prefetch={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex w-full items-center rounded-sm px-4 py-2 text-sm outline-none",

                  !active &&
                    "data-highlighted:bg-primary data-highlighted:text-background",

                  active &&
                    "data-highlighted:text-primary data-highlighted:bg-transparent",
                )}
              >
                {Icon && (
                  <Icon
                    className={cn(
                      "mr-2 size-4 shrink-0",

                      active ? "text-secondary" : "text-current",

                      active && "data-highlighted:text-primary",
                    )}
                  />
                )}

                <span
                  className={cn(
                    "inline-block",

                    active &&
                      "text-secondary border-secondary -mb-1 border-b-2 pb-0.5",

                    active && "data-[highlighted]:no-border",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
