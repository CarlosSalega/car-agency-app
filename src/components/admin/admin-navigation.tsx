"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ADMIN_HEADER_CONTENT } from "@/data/admin-header";
import { ADMIN_NAVIGATION } from "@/data/admin-navigation";
import { isActiveRoute } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { AuthUser } from "@/types/auth";

interface AdminNavigationProps {
  user: AuthUser;
}

export function AdminNavigation({ user }: AdminNavigationProps) {
  const pathname = usePathname();
  const { styles } = ADMIN_HEADER_CONTENT;

  return (
    <nav className="hidden items-center gap-6 md:flex">
      {ADMIN_NAVIGATION.filter(
        (item) =>
          item.showInHeader &&
          item.href &&
          (!item.roles || item.roles.includes(user.role)),
      ).map((item) => {
        const active = isActiveRoute(pathname, item.href!);
        const Icon = item.icon;

        return (
          <Link
            key={item.id}
            href={item.href!}
            aria-current={active ? "page" : undefined}
            className={cn(
              styles.link.base,
              active ? styles.link.active : styles.link.inactive,
              !active && "text-secondary-foreground hover:text-gray-300",
              active && "-mb-1 pb-1",
            )}
          >
            {Icon && <Icon className={styles.icon} />}

            <span
              className={cn(active && "border-secondary -mb-1 border-b-2 pb-1")}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
