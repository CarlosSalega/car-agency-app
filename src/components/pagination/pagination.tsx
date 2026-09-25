"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  baseUrl?: string;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  baseUrl = "?",
  className = "",
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const buildUrl = (page: number) => {
    return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}page=${page}`;
  };

  const isPrevDisabled = currentPage <= 1;
  const isNextDisabled = currentPage >= totalPages;
  const prevHref = buildUrl(Math.max(1, currentPage - 1));
  const nextHref = buildUrl(Math.min(totalPages, currentPage + 1));

  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      <Button
        className="hover:bg-foreground hover:text-background bg-card"
        variant="outline"
        size="icon"
        asChild
      >
        <Link
          href={prevHref}
          aria-disabled={isPrevDisabled}
          tabIndex={isPrevDisabled ? -1 : 0}
          onClick={(e) => {
            if (isPrevDisabled) {
              e.preventDefault();
            }
          }}
        >
          <ChevronLeft className="size-5" />
        </Link>
      </Button>

      <span className="text-muted-foreground text-sm">
        Página {currentPage} de {totalPages}
      </span>

      <Button
        className="hover:bg-foreground hover:text-background bg-card"
        variant="outline"
        size="icon"
        asChild
      >
        <Link
          href={nextHref}
          aria-disabled={isNextDisabled}
          tabIndex={isNextDisabled ? -1 : 0}
          onClick={(e) => {
            if (isNextDisabled) {
              e.preventDefault();
            }
          }}
        >
          <ChevronRight className="size-5" />
        </Link>
      </Button>
    </div>
  );
}
