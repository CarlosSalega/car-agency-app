import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { notifyNewLead } from "@/lib/leads/notify";
import { clientKeyFrom, createRateLimiter } from "@/lib/rate-limit";
import { LEAD_HONEYPOT_FIELD, leadSubmitSchema } from "@/lib/validations/lead";

/**
 * Public inquiry endpoint. No session: this is the anonymous path that turns a
 * WhatsApp-only site into one that records what it generated.
 *
 * Because it is unauthenticated and writes rows, the order of the checks matters:
 * rate limit first (cheapest, no parsing), then the honeypot, then validation,
 * then the database. Anything expensive happens only after the cheap gates pass.
 */

/**
 * Five submissions per IP per ten minutes. A person asks about one car, maybe
 * two; a script asks about all of them. See `rate-limit.ts` for why this is a
 * speed bump and not a security boundary.
 */
const leadLimiter = createRateLimiter({ limit: 5, windowMs: 10 * 60_000 });

const MAX_SOURCE_LENGTH = 300;

function sourceFrom(request: NextRequest): string | undefined {
  const referer = request.headers.get("referer");
  if (!referer) return undefined;

  try {
    // Keep the origin and path, drop query strings: tracking parameters belong
    // in the future attribution work, not in an unbounded column.
    const url = new URL(referer);
    return `${url.origin}${url.pathname}`.slice(0, MAX_SOURCE_LENGTH);
  } catch {
    return referer.slice(0, MAX_SOURCE_LENGTH);
  }
}

export async function POST(request: NextRequest) {
  const limit = leadLimiter.check(clientKeyFrom(request.headers));

  if (!limit.ok) {
    return NextResponse.json(
      {
        error:
          "Recibimos varias consultas tuyas. Probá de nuevo en unos minutos.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "No pudimos leer la consulta" },
      { status: 400 },
    );
  }

  // A filled honeypot means a bot. Answer exactly like a success and write
  // nothing: a 400 would tell the script which field to leave alone.
  const honeypot =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)[LEAD_HONEYPOT_FIELD]
      : undefined;

  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const parsed = leadSubmitSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { name, phone, email, message, carSlug, attribution } = parsed.data;

  try {
    // The slug comes from the page the visitor was on. Resolving it here is what
    // attaches the car and, through it, the seller who should answer: the client
    // never claims either.
    let carId: string | undefined;
    let sellerId: string | undefined;
    let carTitleWithBrand: string | undefined;

    if (carSlug) {
      const car = await prisma.car.findUnique({
        where: { slug: carSlug },
        select: { id: true, title: true, sellerId: true, deletedAt: true },
      });

      // A car that was removed between page load and submit is not an error: the
      // inquiry is still worth keeping, it just loses its subject.
      if (car && !car.deletedAt) {
        carId = car.id;
        sellerId = car.sellerId ?? undefined;
        carTitleWithBrand = car.title;
      }
    }

    const lead = await prisma.lead.create({
      data: {
        name,
        phone,
        email,
        message,
        carId,
        sellerId,
        // Server clock, never the client's: this is the consent record.
        consentAt: new Date(),
        // Our own page that produced it, from the POST referer.
        source: sourceFrom(request),
        // First-touch campaign, from the browser. Not trusted for anything but
        // reporting, and normalised by the schema before it gets here.
        utmSource: attribution?.utmSource,
        utmMedium: attribution?.utmMedium,
        utmCampaign: attribution?.utmCampaign,
        referrer: attribution?.referrer,
      },
      select: { id: true },
    });

    // Best effort, and awaited so a serverless invocation does not end before
    // the request to the mail provider goes out. `notifyNewLead` never throws,
    // so a mail failure cannot turn a saved lead into a 500.
    const notification = await notifyNewLead({
      name,
      phone,
      email,
      message,
      carTitle: carTitleWithBrand,
      carSlug,
    });

    if (!notification.sent) {
      console.warn(
        `[LEAD] Consulta ${lead.id} guardada sin aviso: ${notification.reason}`,
      );
    }

    return NextResponse.json({ ok: true, id: lead.id }, { status: 201 });
  } catch (error) {
    // The visitor gets nothing about the failure internals; the operator gets it
    // in the server log.
    console.error("[LEAD] No se pudo guardar la consulta:", error);
    return NextResponse.json(
      { error: "No pudimos registrar tu consulta. Escribinos por WhatsApp." },
      { status: 500 },
    );
  }
}
