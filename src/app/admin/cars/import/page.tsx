import { redirect } from "next/navigation";

import { CarImport } from "@/components/cars";
import { requireAuthSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Bulk creation is ADMIN-only, the same way `/admin/users` and
 * `/admin/leads` are: fifty cars in one request is a hammer, and the
 * single-car form stays available to collaborators.
 */
export default async function AdminCarImportPage() {
  const session = await requireAuthSession();

  if (session.user.role !== "ADMIN") {
    redirect("/admin");
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-6">
        <CarImport />
      </div>
    </div>
  );
}
