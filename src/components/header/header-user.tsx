import { AdminDropdown } from "@/components/admin";

type HeaderUserProps = {
  user: {
    name: string | null;
    email: string;
    role: "ADMIN" | "COLLABORATOR";
  } | null;
};

export function HeaderUser({ user }: HeaderUserProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex justify-end">
        {user ? (
          <AdminDropdown user={user} />
        ) : (
          <div className="size-9" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
