import { TwoFactorSettings } from "@/components/auth/two-factor-settings";
import { requireAuthSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Per-user security settings.
 *
 * No ADMIN check on purpose: unlike `/admin/users` or `/admin/config`, nothing
 * here touches another account. Every authenticated user manages their own
 * second factor.
 */
export default async function AdminSecurityPage() {
  const session = await requireAuthSession();

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto max-w-3xl space-y-6 px-4 py-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Seguridad</h1>
          <p className="text-muted-foreground text-sm">
            Cómo se protege tu cuenta. Estos cambios afectan solo a tu usuario.
          </p>
        </div>

        <TwoFactorSettings enabled={Boolean(session.user.twoFactorEnabled)} />
      </div>
    </div>
  );
}
