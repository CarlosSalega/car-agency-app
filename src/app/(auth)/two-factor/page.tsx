import type { Metadata } from "next";

import { TwoFactorForm } from "@/components/auth/two-factor-form";

export const metadata: Metadata = {
  title: "Verificación en dos pasos",
};

export default function TwoFactorPage() {
  return <TwoFactorForm />;
}
