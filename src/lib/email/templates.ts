/**
 * Transactional email templates.
 *
 * Copy is Spanish because the product's UI is Spanish; the code and comments
 * stay English like the rest of the codebase.
 *
 * Each template returns the three fields `sendEmail` needs. Plain text is not
 * an afterthought: it is what a client shows when it refuses HTML, and it is
 * the fallback that keeps the link reachable.
 */

const BRAND = "Car Agency";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type LayoutInput = {
  heading: string;
  intro: string;
  action: string;
  url: string;
  note: string;
};

function layout({ heading, intro, action, url, note }: LayoutInput): string {
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;padding:32px 16px;">
      <div style="background:#ffffff;border-radius:12px;padding:32px;">
        <p style="margin:0 0 24px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">${BRAND}</p>
        <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#18181b;">${escapeHtml(heading)}</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3f3f46;">${escapeHtml(intro)}</p>
        <a href="${escapeHtml(url)}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 24px;border-radius:8px;">${escapeHtml(action)}</a>
        <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#71717a;">${escapeHtml(note)}</p>
      </div>
      <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">Si no reconocés este correo, podés ignorarlo.</p>
    </div>
  </body>
</html>`;
}

export type EmailMessage = {
  subject: string;
  html: string;
  text: string;
};

export function resetPasswordEmail({
  name,
  url,
}: {
  name?: string | null;
  url: string;
}): EmailMessage {
  const greeting = name?.trim() ? `Hola ${name.trim()}:` : "Hola:";

  return {
    subject: "Restablecer tu contraseña",
    html: layout({
      heading: "Restablecer tu contraseña",
      intro: `${greeting} recibimos un pedido para restablecer la contraseña de tu cuenta. El enlace vence en una hora y se puede usar una sola vez.`,
      action: "Restablecer contraseña",
      url,
      note: "Si no pediste este cambio, no hace falta que hagas nada: tu contraseña actual sigue funcionando.",
    }),
    text: [
      greeting,
      "",
      "Recibimos un pedido para restablecer la contraseña de tu cuenta.",
      "El enlace vence en una hora y se puede usar una sola vez.",
      "",
      url,
      "",
      "Si no pediste este cambio, no hace falta que hagas nada: tu contraseña actual sigue funcionando.",
    ].join("\n"),
  };
}

export function verifyEmailTemplate({
  name,
  url,
}: {
  name?: string | null;
  url: string;
}): EmailMessage {
  const greeting = name?.trim() ? `Hola ${name.trim()}:` : "Hola:";

  return {
    subject: "Confirmá tu dirección de email",
    html: layout({
      heading: "Confirmá tu dirección de email",
      intro: `${greeting} confirmá esta dirección para que los enlaces de recuperación de contraseña lleguen al lugar correcto.`,
      action: "Confirmar email",
      url,
      note: "El enlace vence en una hora. Si no esperabas este correo, podés ignorarlo.",
    }),
    text: [
      greeting,
      "",
      "Confirmá esta dirección para que los enlaces de recuperación de contraseña lleguen al lugar correcto.",
      "",
      url,
      "",
      "El enlace vence en una hora. Si no esperabas este correo, podés ignorarlo.",
    ].join("\n"),
  };
}

/**
 * Internal notification: a visitor asked about a car.
 *
 * This is the one template whose body is mostly visitor-supplied text, so every
 * interpolated value goes through `escapeHtml`. A lead name of `<script>` must
 * arrive in the inbox as text, not as markup, and the same string is also used in
 * the plain-text part where it needs no escaping at all.
 *
 * The subject carries the car title, never the visitor's name, and CR/LF are
 * stripped: a newline in a subject is a header-injection primitive in mail
 * clients that pass it to the outbound agent verbatim.
 */
export type LeadNotificationInput = {
  name: string;
  phone: string;
  email?: string | null;
  message?: string | null;
  carTitle?: string | null;
  carUrl?: string | null;
  adminUrl: string;
  receivedAt: Date;
};

function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

export function leadNotificationEmail({
  name,
  phone,
  email,
  message,
  carTitle,
  carUrl,
  adminUrl,
  receivedAt,
}: LeadNotificationInput): EmailMessage {
  const digits = phone.replace(/\D/g, "");
  const greeting = encodeURIComponent(
    `Hola ${name}! Te escribimos por tu consulta${carTitle ? ` sobre el ${carTitle}` : ""}.`,
  );
  const whatsappUrl = digits
    ? `https://wa.me/${digits}?text=${greeting}`
    : null;
  const subject = singleLine(
    carTitle ? `Nueva consulta: ${carTitle}` : "Nueva consulta desde la web",
  );

  const when = receivedAt.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    dateStyle: "short",
    timeStyle: "short",
  });

  const row = (label: string, value: string) =>
    `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3f3f46;"><strong style="color:#18181b;">${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`;

  const html = `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;padding:32px 16px;">
      <div style="background:#ffffff;border-radius:12px;padding:32px;">
        <p style="margin:0 0 24px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Nueva consulta</p>
        <h1 style="margin:0 0 24px;font-size:20px;line-height:1.3;color:#18181b;">${escapeHtml(carTitle ?? "Consulta general")}</h1>
        ${row("Nombre", name)}
        ${row("Teléfono", phone)}
        ${email ? row("Email", email) : ""}
        ${message ? row("Mensaje", message) : ""}
        ${row("Recibida", when)}
        ${carUrl ? `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;"><a href="${escapeHtml(carUrl)}" style="color:#18181b;">Ver el auto publicado</a></p>` : ""}
        ${whatsappUrl ? `<a href="${escapeHtml(whatsappUrl)}" style="display:inline-block;margin:12px 0 0;background:#18181b;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 24px;border-radius:8px;">Responder por WhatsApp</a>` : ""}
        <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#71717a;"><a href="${escapeHtml(adminUrl)}" style="color:#71717a;">Gestionar en el panel</a></p>
      </div>
    </div>
  </body>
</html>`;

  const text = [
    "Nueva consulta",
    "",
    `Auto: ${carTitle ?? "Consulta general"}`,
    `Nombre: ${name}`,
    `Teléfono: ${phone}`,
    ...(email ? [`Email: ${email}`] : []),
    ...(message ? [`Mensaje: ${message}`] : []),
    `Recibida: ${when}`,
    ...(carUrl ? ["", carUrl] : []),
    ...(whatsappUrl ? ["", `Responder por WhatsApp: ${whatsappUrl}`] : []),
    "",
    `Gestionar en el panel: ${adminUrl}`,
    "",
  ].join("\n");

  return { subject, html, text };
}
