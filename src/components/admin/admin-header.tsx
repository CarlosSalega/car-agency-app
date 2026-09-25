import { AdminDropdown, AdminNavigation, AdminLogo } from "@/components/admin";
import { AuthUser } from "@/types/auth";

interface AdminHeaderProps {
  user: AuthUser;
}

export function AdminHeader({ user }: AdminHeaderProps) {
  return (
    <header className="bg-foreground">
      <div className="flex h-24 items-center justify-between px-4 lg:px-8">
        <AdminLogo />

        <AdminNavigation user={user} />

        <AdminDropdown user={user} />
      </div>
    </header>
  );
}
