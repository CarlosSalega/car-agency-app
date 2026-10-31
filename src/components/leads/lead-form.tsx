"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readAttribution } from "@/lib/leads/attribution";
import { LEAD_HONEYPOT_FIELD } from "@/lib/leads/honeypot";

/**
 * The inquiry form on a car page.
 *
 * It posts to `/api/leads` and stays a client component because the alternative
 * would be a server action, and this codebase has none: every write goes through
 * a route handler.
 *
 * Field errors come back as zod's `flatten()` shape, so the component renders the
 * first message per field instead of inventing its own validation. Nothing is
 * validated here beyond `required`, which the browser needs for a decent
 * experience; the server decides.
 */

type FieldErrors = Partial<Record<string, string[]>>;

interface LeadFormProps {
  carSlug: string;
  carTitle: string;
}

const initialValues = {
  name: "",
  phone: "",
  email: "",
  message: "",
  consent: false,
  [LEAD_HONEYPOT_FIELD]: "",
};

export function LeadForm({ carSlug, carTitle }: LeadFormProps) {
  const [values, setValues] = useState(initialValues);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  const honeypot = LEAD_HONEYPOT_FIELD;

  function update<K extends keyof typeof initialValues>(
    key: K,
    value: (typeof initialValues)[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setFormError(null);
    setFieldErrors({});

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Read at submit time, not at mount: the visitor may have landed with
        // campaign parameters on a previous page and `captureFirstTouch` stored
        // them in sessionStorage since this form rendered.
        body: JSON.stringify({
          ...values,
          carSlug,
          attribution: readAttribution(),
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string | { fieldErrors?: FieldErrors };
      } | null;

      if (!response.ok) {
        const error = payload?.error;

        if (error && typeof error === "object" && error.fieldErrors) {
          setFieldErrors(error.fieldErrors);
          setStatus("idle");
          return;
        }

        setFormError(
          typeof error === "string"
            ? error
            : "No pudimos enviar tu consulta. Probá otra vez.",
        );
        setStatus("idle");
        return;
      }

      setStatus("sent");
      setValues(initialValues);
    } catch {
      setFormError("No pudimos enviar tu consulta. Revisá tu conexión.");
      setStatus("idle");
    }
  }

  if (status === "sent") {
    return (
      <div
        role="status"
        className="border-border bg-card rounded-xl border px-6 py-10 text-center"
      >
        <p className="text-lg font-semibold">¡Listo! Recibimos tu consulta.</p>
        <p className="text-muted-foreground mt-2 text-sm">
          Te escribimos a la brevedad por el {carTitle}.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-describedby={formError ? "lead-form-error" : undefined}
      className="border-border bg-card rounded-xl border p-6"
    >
      <h2 className="text-xl font-semibold tracking-tight">
        Consultá por este auto
      </h2>
      <p className="text-muted-foreground mt-1 mb-6 text-sm">
        Dejanos tu nombre y un teléfono. Sin vueltas.
      </p>

      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="lead-name">
            Tu nombre <span aria-hidden="true">*</span>
          </Label>
          <Input
            id="lead-name"
            name="name"
            autoComplete="name"
            required
            value={values.name}
            onChange={(event) => update("name", event.target.value)}
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? "lead-name-error" : undefined}
          />
          {fieldErrors.name ? (
            <p id="lead-name-error" className="text-destructive text-xs">
              {fieldErrors.name[0]}
            </p>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="lead-phone">
            Tu teléfono <span aria-hidden="true">*</span>
          </Label>
          <Input
            id="lead-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            value={values.phone}
            onChange={(event) => update("phone", event.target.value)}
            aria-invalid={Boolean(fieldErrors.phone)}
            aria-describedby={
              fieldErrors.phone ? "lead-phone-error" : undefined
            }
          />
          {fieldErrors.phone ? (
            <p id="lead-phone-error" className="text-destructive text-xs">
              {fieldErrors.phone[0]}
            </p>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="lead-email">
            Tu email{" "}
            <span className="text-muted-foreground font-normal">
              (opcional)
            </span>
          </Label>
          <Input
            id="lead-email"
            name="email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={(event) => update("email", event.target.value)}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={
              fieldErrors.email ? "lead-email-error" : undefined
            }
          />
          {fieldErrors.email ? (
            <p id="lead-email-error" className="text-destructive text-xs">
              {fieldErrors.email[0]}
            </p>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="lead-message">
            Mensaje{" "}
            <span className="text-muted-foreground font-normal">
              (opcional)
            </span>
          </Label>
          <textarea
            id="lead-message"
            name="message"
            rows={3}
            value={values.message}
            onChange={(event) => update("message", event.target.value)}
            aria-invalid={Boolean(fieldErrors.message)}
            aria-describedby={
              fieldErrors.message ? "lead-message-error" : undefined
            }
            className="border-input bg-background focus-visible:ring-ring/50 aria-invalid:border-destructive w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
          />
          {fieldErrors.message ? (
            <p id="lead-message-error" className="text-destructive text-xs">
              {fieldErrors.message[0]}
            </p>
          ) : null}
        </div>

        {/* Off-screen, not `display:none`: a bot that checks visibility skips a
            hidden input, and assistive technology ignores `aria-hidden`. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden"
        >
          <label htmlFor="lead-company">No completar</label>
          <input
            id="lead-company"
            name={honeypot}
            tabIndex={-1}
            autoComplete="off"
            value={values[honeypot]}
            onChange={(event) => update(honeypot, event.target.value)}
          />
        </div>

        <div className="grid gap-1.5">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="consent"
              required
              checked={values.consent}
              onChange={(event) => update("consent", event.target.checked)}
              aria-invalid={Boolean(fieldErrors.consent)}
              aria-describedby={
                fieldErrors.consent ? "lead-consent-error" : undefined
              }
              className="accent-primary mt-0.5 size-4"
            />
            <span>Acepto que me contacten por esta consulta.</span>
          </label>
          {fieldErrors.consent ? (
            <p id="lead-consent-error" className="text-destructive text-xs">
              {fieldErrors.consent[0]}
            </p>
          ) : null}
        </div>

        {formError ? (
          <p
            id="lead-form-error"
            role="alert"
            className="text-destructive text-sm"
          >
            {formError}
          </p>
        ) : null}

        <Button
          type="submit"
          size="lg"
          disabled={status === "sending"}
          className="w-full"
        >
          {status === "sending" ? "Enviando…" : "Enviar consulta"}
        </Button>
      </div>
    </form>
  );
}
