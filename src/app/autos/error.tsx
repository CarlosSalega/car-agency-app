"use client";

import { useEffect } from "react";

import { PublicQueryError } from "@/components/public-query-error";

type AutosErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AutosError({ error, reset }: AutosErrorProps) {
  useEffect(() => {
    console.error("Catalog query failed", error);
  }, [error]);

  return <PublicQueryError reset={reset} />;
}
