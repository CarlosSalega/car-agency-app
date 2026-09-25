import { cookies } from "next/headers";

import { prisma } from "@/lib/db";

export async function createSession(userId: string) {
  const sessionToken = crypto.randomUUID();
  const expires = new Date(Date.now() + 1 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      sessionToken,
      userId,
      expires,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set("session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires,
    sameSite: "lax",
    path: "/",
  });

  return sessionToken;
}

export async function getSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value;

  if (!sessionToken) return null;

  const session = await prisma.session.findUnique({
    where: { sessionToken },
    include: { user: true },
  });

  if (!session || session.expires < new Date()) {
    return null;
  }

  return session;
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value;

  if (sessionToken) {
    await prisma.session
      .delete({
        where: { sessionToken },
      })
      .catch(() => {});
  }

  cookieStore.delete("session");
}

export async function requireAuthSession() {
  const session = await getSession();
  if (!session) {
    throw new Error(
      "Sesión no encontrada. Esto no debería ocurrir si el layout está funcionando correctamente.",
    );
  }
  return session;
}
