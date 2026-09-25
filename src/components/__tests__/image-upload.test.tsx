import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ImageUpload,
  buildMoveAnnouncement,
} from "@/components/image-upload";

const KEYS = ["cars/a.webp", "cars/b.webp", "cars/c.webp"];

function renderUploader(value: string[] = KEYS) {
  const onChange = vi.fn();
  render(<ImageUpload value={value} onChange={onChange} />);
  return { onChange };
}

function announcements() {
  return screen.getByRole("status", { name: "Anuncios de reordenamiento" });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ImageUpload reorder", () => {
  it("marks only the first image as cover", () => {
    renderUploader();
    const badges = screen.getAllByText("Portada");
    expect(badges).toHaveLength(1);
    expect(
      screen.getByAltText("Imagen 1 (portada)", { exact: true }),
    ).not.toBeNull();
  });

  it("renders no visible move or cover buttons", () => {
    renderUploader();
    expect(screen.queryByLabelText(/a la izquierda/)).toBeNull();
    expect(screen.queryByLabelText(/a la derecha/)).toBeNull();
    expect(screen.queryByLabelText(/como portada/)).toBeNull();
  });

  it("builds the Spanish reorder announcement", () => {
    expect(buildMoveAnnouncement(1, 2, 3)).toBe(
      "Imagen 1 movida a la posición 2 de 3",
    );
  });

  it("removes an image via the delete button", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );
    const { onChange } = renderUploader();
    fireEvent.click(screen.getByLabelText("Eliminar imagen 2"));
    expect(onChange).toHaveBeenCalledWith(["cars/a.webp", "cars/c.webp"]);
  });

  it("exposes a named delete button per thumbnail", () => {
    renderUploader();
    for (const position of [1, 2, 3]) {
      expect(
        screen.getByLabelText(`Eliminar imagen ${position}`),
      ).not.toBeNull();
    }
  });

  it("makes the whole thumbnail the keyboard-focusable drag surface", () => {
    renderUploader();
    for (const position of [1, 2, 3]) {
      const thumbnail = screen.getByRole("button", {
        name: new RegExp(`Imagen ${position}.*arrastra para reordenar`),
      }) as HTMLElement;
      expect(thumbnail.tabIndex).toBeGreaterThanOrEqual(0);
      expect(thumbnail.getAttribute("aria-describedby")).not.toBeNull();
    }
    const first = screen.getByRole("button", {
      name: /Imagen 1.*arrastra para reordenar/,
    }) as HTMLElement;
    first.focus();
    expect(document.activeElement).toBe(first);
  });

  it("starts a keyboard drag with Espacio and announces it", () => {
    renderUploader();
    const first = screen.getByRole("button", {
      name: /Imagen 1.*arrastra para reordenar/,
    }) as HTMLElement;
    first.focus();
    fireEvent.keyDown(first, { key: " ", code: "Space", keyCode: 32 });
    expect(announcements().textContent).toBe(
      "Imagen 1 en movimiento. Usa las flechas para moverla y Espacio para soltarla.",
    );
  });

  it("labels the thumbnail group with reorder instructions", () => {
    renderUploader();
    expect(
      screen.getByRole("group", {
        name: /arrastra para reordenar.*primera imagen es la portada/,
      }),
    ).not.toBeNull();
    expect(
      screen.getByText(/enfoca una foto, pulsa Espacio/, { exact: false }),
    ).not.toBeNull();
  });
});
