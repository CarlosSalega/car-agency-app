"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";
import { track } from "@/lib/meta-pixel";

import { Button } from "./button";
import { WhatsAppIcon } from "./whatsapp";

interface WhatsAppButtonProps {
  href: string;
  label?: string;
  className?: string;
  iconClassName?: string;
}

export function WhatsAppButton({
  href,
  label = "Enviar por WhatsApp",
  className,
  iconClassName,
}: WhatsAppButtonProps) {
  return (
    <Button
      className={cn(
        "h-14 whitespace-nowrap transition-transform duration-300 hover:scale-[1.02] has-[>svg]:px-8 sm:has-[>svg]:px-12",
        className,
      )}
      render={
        <Link
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track("Contact", { method: "whatsapp" })}
        >
          <WhatsAppIcon className={cn("mr-2 size-5", iconClassName)} />
          {label}
        </Link>
      }
    />
  );
}
