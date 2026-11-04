"use client";

import { Facebook, Link2, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WhatsAppIcon } from "@/components/ui/whatsapp";

/**
 * Share one unit.
 *
 * **One icon, not a row of brand logos.** A strip of WhatsApp/Facebook/Instagram/TikTok
 * next to the title competes with the WhatsApp call to action right below and turns a
 * clean block into a button bar. The icon opens the destinations that actually exist.
 *
 * Three real options, and one honest gap:
 *
 * - **WhatsApp** and **Facebook** accept a URL prefilled from the web, so they are
 *   plain links that work without JavaScript.
 * - **Native share** (`navigator.share`) is what covers Instagram, TikTok and whatever
 *   else is installed, because there is no web URL that posts a link to those. It only
 *   appears on devices that have it.
 * - **Copy the link** is the fallback for everything else, and the only way to take a
 *   link into Instagram stories: the app has no web endpoint for it. Saying so is better
 *   than a button that promises a share it cannot perform.
 */
export function ShareCar({
  title,
  url,
  siteName,
}: {
  title: string;
  url: string;
  siteName: string;
}) {
  const message = `${title} — ${siteName}`;

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${message}\n${url}`)}`;
  const facebookHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("No pudimos copiar el link");
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title: message, url });
    } catch {
      // Cancelar el diálogo del sistema no es un error: no se avisa nada.
    }
  };

  // Se resuelve en un efecto y no durante el render: el servidor no tiene
  // `navigator`, así que leerlo en el render haría que el HTML enviado y el
  // hidratado no coincidan.
  const [canNativeShare, setCanNativeShare] = useState(false);
  useEffect(() => {
    setCanNativeShare(typeof navigator.share === "function");
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Compartir este auto"
            className="border-line-strong text-muted-foreground hover:border-foreground hover:text-foreground flex size-9 cursor-pointer items-center justify-center border transition-colors"
          >
            <Share2 aria-hidden="true" className="size-4" />
          </button>
        }
      />

      <DropdownMenuContent align="end" className="w-56">
        {canNativeShare ? (
          <DropdownMenuItem onClick={nativeShare} className="px-3 py-2">
            <Share2 className="mr-2 size-4" aria-hidden="true" />
            Compartir…
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuItem
          render={
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer" />
          }
          className="px-3 py-2"
        >
          <WhatsAppIcon className="mr-2 size-4" aria-hidden="true" />
          WhatsApp
        </DropdownMenuItem>

        <DropdownMenuItem
          render={
            <a href={facebookHref} target="_blank" rel="noopener noreferrer" />
          }
          className="px-3 py-2"
        >
          <Facebook className="mr-2 size-4" aria-hidden="true" />
          Facebook
        </DropdownMenuItem>

        <DropdownMenuItem onClick={copy} className="px-3 py-2">
          <Link2 className="mr-2 size-4" aria-hidden="true" />
          Copiar link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
