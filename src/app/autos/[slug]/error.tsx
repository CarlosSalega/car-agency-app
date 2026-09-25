"use client";

import { useEffect } from "react";

import { PublicQueryError } from "@/components/public-query-error";

type CarDetailErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function CarDetailError({ error, reset }: CarDetailErrorProps) {
  useEffect(() => {
    console.error("Car detail query failed", error);
  }, [error]);

  return <PublicQueryError reset={reset} showCatalogLink />;
}
