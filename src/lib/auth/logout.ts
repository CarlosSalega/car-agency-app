import { toast } from "sonner";

/**
 * Shared sign-out handler.
 *
 * Extracted because two call sites need it now: the user dropdown in the admin
 * header and the `logout` action in the admin sidebar. Duplicating a fetch plus a
 * redirect across both would be two places to change when the endpoint or the
 * post-logout destination moves.
 *
 * better-auth's sign-out handler requires `Content-Type: application/json`; a
 * bodyless POST is rejected with `415 UNSUPPORTED_MEDIA_TYPE`. That rejection
 * used to go unnoticed because the redirect below ran regardless, so the app
 * looked logged out while the session cookie stayed valid. The status is checked
 * now, and a failure surfaces instead of redirecting.
 */
export async function logout(): Promise<void> {
  try {
    const res = await fetch("/api/auth/sign-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      credentials: "include",
    });

    if (!res.ok) {
      console.error("No se pudo cerrar sesión", res.status);
      toast.error("No pudimos cerrar la sesión. Intentá de nuevo.");
      return;
    }

    window.location.href = "/";
  } catch (error) {
    console.error("Error al cerrar sesión", error);
    toast.error("No pudimos cerrar la sesión. Intentá de nuevo.");
  }
}
