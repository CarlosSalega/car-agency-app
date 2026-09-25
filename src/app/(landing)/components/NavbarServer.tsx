import { getSession } from "@/lib/auth";
import NavbarClient from "./NavbarClient";

export async function NavbarServer() {
  const session = await getSession();
  const user = session?.user ?? null;

  return <NavbarClient user={user} />;
}
