/**
 * Shared sign-out handler.
 *
 * Extracted because two call sites need it now: the user dropdown in the admin
 * header and the `logout` action in the admin sidebar. Duplicating a fetch plus a
 * redirect across both would be two places to change when the endpoint or the
 * post-logout destination moves.
 */
export async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  } catch (error) {
    console.error("Error al cerrar sesión", error);
  }
}
