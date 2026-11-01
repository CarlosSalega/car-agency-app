import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { requireAuthSession } from "@/lib/auth";
import {
  MELI_ENV_VARS,
  MELI_TOKEN_URL,
  readMeliConfig,
} from "@/lib/integrations/mercadolibre/config";
import { readLinkedAccount } from "@/lib/integrations/mercadolibre/store";

export const dynamic = "force-dynamic";

/**
 * The Mercado Libre section of the admin config.
 *
 * Deliberately honest about three things the screen could oversell:
 * - the integration is **optional** and says what is missing when it is not set up;
 * - the person who authorizes must be an **administrator** of the ML account, or
 *   ML rejects the grant;
 * - linking the account does **not** publish anything yet, and publishing needs a
 *   contracted package. Promising otherwise would produce a support call.
 */

const STATUS_MESSAGES: Record<
  string,
  { tone: "ok" | "warning" | "error"; text: string }
> = {
  linked: {
    tone: "ok",
    text: "Cuenta vinculada. Mercado Libre validó las credenciales.",
  },
  unlinked: {
    tone: "ok",
    text: "Cuenta desvinculada. Los tokens se borraron.",
  },
  denied: {
    tone: "warning",
    text: "Cancelaste la autorización en Mercado Libre.",
  },
  no_code: {
    tone: "error",
    text: "Mercado Libre no devolvió un código de autorización.",
  },
  state_mismatch: {
    tone: "error",
    text: "La verificación de seguridad no coincidió. Empezá de nuevo el proceso.",
  },
  missing_verifier: {
    tone: "error",
    text: "Se perdió el verificador del proceso. Empezá de nuevo.",
  },
  exchange_failed: {
    tone: "error",
    text: "Mercado Libre rechazó el intercambio del código. Revisá las credenciales de la aplicación.",
  },
  profile_failed: {
    tone: "error",
    text: "Se obtuvieron los tokens pero no pudimos leer la cuenta. Intentá de nuevo.",
  },
  not_configured: {
    tone: "error",
    text: "Faltan variables de entorno de la integración. Ver más abajo.",
  },
  forbidden: {
    tone: "error",
    text: "Solo un administrador puede vincular la cuenta.",
  },
  bad_origin: { tone: "error", text: "La solicitud no vino de este sitio." },
};

const TONE_CLASSES = {
  ok: "border-border bg-success/10 text-success",
  warning: "border-border bg-warning/10 text-warning",
  error: "border-border bg-destructive/10 text-destructive",
} as const;

export default async function MeliConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requireAuthSession();

  if (session.user.role !== "ADMIN") {
    redirect("/admin");
  }

  const params = await searchParams;
  const status = params.status ? STATUS_MESSAGES[params.status] : undefined;

  const config = readMeliConfig();
  const linked = config.ok
    ? await readLinkedAccount(config.config.encryptionKey)
    : null;

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Mercado Libre</h1>
        <p className="text-muted-foreground mt-1 mb-6 text-sm">
          Vinculá la cuenta de Mercado Libre del concesionario para publicar el
          inventario. Mercado Libre valida la cuenta con OAuth: nosotros nunca
          vemos la contraseña.
        </p>

        {status ? (
          <p
            className={`mb-6 rounded-lg border px-4 py-3 text-sm ${TONE_CLASSES[status.tone]}`}
          >
            {status.text}
          </p>
        ) : null}

        {!config.ok ? (
          <section className="border-border bg-card rounded-xl border p-6">
            <h2 className="text-lg font-semibold">
              Integración no configurada
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Faltan estas variables de entorno. Se cargan una sola vez por
              despliegue, con los datos de la aplicación creada en{" "}
              <span className="text-foreground">Mis aplicaciones</span> de
              Mercado Libre:
            </p>
            <ul className="mt-3 space-y-1 font-mono text-xs">
              {config.missing.map((name) => (
                <li key={name} className="text-destructive">
                  {name}
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-4 text-xs">
              La URL de callback registrada en Mercado Libre tiene que coincidir
              exacto con <code>{MELI_ENV_VARS.redirectUri}</code>, y no puede
              contener información variable.
            </p>
          </section>
        ) : (
          <section className="border-border bg-card rounded-xl border p-6">
            <h2 className="text-lg font-semibold">
              {linked ? "Cuenta vinculada" : "Vincular cuenta"}
            </h2>

            {linked ? (
              <div className="mt-3 space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Cuenta: </span>
                  <span className="font-medium">
                    {linked.account.nickname}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    (ID {linked.account.meliUserId}
                    {linked.account.siteId ? ` · ${linked.account.siteId}` : ""}
                    )
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">Tokens: </span>
                  {linked.tokens ? (
                    <span>
                      válidos hasta{" "}
                      {linked.tokens.expiresAt.toLocaleString("es-AR", {
                        timeZone: "America/Argentina/Buenos_Aires",
                      })}
                    </span>
                  ) : (
                    <span className="text-destructive">
                      no se pudieron leer. Desvinculá y volvé a vincular.
                    </span>
                  )}
                </p>

                <form
                  action="/api/integrations/mercadolibre/disconnect"
                  method="post"
                >
                  <Button type="submit" variant="outline" className="mt-3">
                    Desvincular cuenta
                  </Button>
                </form>
              </div>
            ) : (
              <>
                <p className="text-muted-foreground mt-1 mb-4 text-sm">
                  Te vamos a llevar a Mercado Libre para que autorices la
                  cuenta. Volvés acá con la vinculación hecha.
                </p>
                <Button
                  render={
                    <a href="/api/integrations/mercadolibre/authorize">
                      Vincular cuenta
                    </a>
                  }
                />
              </>
            )}
          </section>
        )}

        <section className="border-border bg-card mt-6 rounded-xl border p-6">
          <h2 className="text-base font-semibold">Antes de vincular</h2>
          <ul className="text-muted-foreground mt-3 space-y-2 text-sm">
            <li>
              <span className="text-foreground">
                Quien autoriza tiene que ser administrador
              </span>{" "}
              de la cuenta de Mercado Libre. Con un usuario operador, Mercado
              Libre rechaza la autorización.
            </li>
            <li>
              <span className="text-foreground">
                Publicar vehículos requiere un paquete contratado
              </span>{" "}
              con Mercado Libre. Sin paquete la vinculación funciona, pero las
              publicaciones se rechazan.
            </li>
            <li>
              <span className="text-foreground">
                Vincular no publica nada todavía.
              </span>{" "}
              Esta pantalla solo guarda las credenciales de forma cifrada.
            </li>
            <li>
              Los tokens se guardan cifrados y se renuevan solos. Mercado Libre
              entrega un token de acceso de 6 horas y uno de renovación de un
              solo uso; el sitio lo renueva antes de que venza.
            </li>
          </ul>
          <p className="text-muted-foreground mt-4 font-mono text-[11px]">
            API: {MELI_TOKEN_URL}
          </p>
        </section>
      </div>
    </div>
  );
}
