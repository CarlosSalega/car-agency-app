// @vitest-environment node
import { describe, expect, it } from "vitest";

import { resetPasswordEmail } from "@/lib/email/templates";

describe("resetPasswordEmail", () => {
  it("puts the reset link in both the html and the text body", () => {
    const url = "http://localhost:3000/api/auth/reset-password/token-1";

    const { html, text } = resetPasswordEmail({ name: "Ana", url });

    expect(html).toContain(url);
    expect(text).toContain(url);
  });

  it("greets the user by name and falls back when there is none", () => {
    expect(resetPasswordEmail({ name: "Ana", url: "http://x" }).text).toContain(
      "Hola Ana:",
    );

    expect(resetPasswordEmail({ name: null, url: "http://x" }).text).toContain(
      "Hola:",
    );
  });

  it("escapes the name so a crafted display name cannot inject markup", () => {
    const { html } = resetPasswordEmail({
      name: '<img src=x onerror="alert(1)">',
      url: "http://x",
    });

    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});
