import { HeaderLogo, HeaderUser } from "@/components/header";
import { getSession } from "@/lib/auth";

export async function Header() {
  const session = await getSession();
  const user = session?.user ?? null;

  return (
    <header className="border-border bg-background/95 border-b backdrop-blur-sm">
      <div className="flex h-24 items-center justify-between px-4 md:px-8">
        <HeaderLogo />
        <HeaderUser user={user} />
      </div>
    </header>
  );
}
