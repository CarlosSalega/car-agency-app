import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { clearChannelAccounts } from "@/lib/integrations/channel-accounts";

/**
 * Unlink the account.
 *
 * A form POST so it works without JavaScript, which makes it a CSRF target: the
 * `Origin` header is compared against the request's own origin before anything is
 * deleted. A cross-site form would carry a foreign origin and be rejected.
 *
 * Deleting the row deletes the only copy of the tokens, which is what "unlink"
 * has to mean: a row left behind with sealed tokens is not an unlink.
 */

const CONFIG_URL = "/admin/config/mercadolibre";

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");

  // Same-origin form posts send Origin; a missing one is treated as untrusted.
  if (!origin) return false;

  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.redirect(
      new URL(`${CONFIG_URL}?status=forbidden`, request.url),
    );
  }

  if (!sameOrigin(request)) {
    return NextResponse.redirect(
      new URL(`${CONFIG_URL}?status=bad_origin`, request.url),
    );
  }

  await clearChannelAccounts("MERCADOLIBRE");

  return NextResponse.redirect(
    new URL(`${CONFIG_URL}?status=unlinked`, request.url),
  );
}
