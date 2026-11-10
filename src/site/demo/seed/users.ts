import type { SeedUser } from "./types";

/**
 * The staff account a fresh clone signs in with.
 *
 * The address is neutral and `example.com` is reserved for documentation (RFC
 * 2606), so it cannot belong to a mailbox someone owns. The password is still
 * the development placeholder it always was, because the point of this row is
 * that `pnpm db:seed` gives a developer a way in, not that it is secure: a real
 * deployment creates its own staff accounts and must change this one.
 */
export const seedUsers: SeedUser[] = [
  {
    key: "admin",
    email: "admin@example.com",
    password: "admin1234",
    name: "Administrador",
    role: "ADMIN",
    isActive: true,
  },
];
