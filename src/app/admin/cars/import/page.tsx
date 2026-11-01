import { CarImport } from "@/components/cars";
import { requireAuthSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Bulk creation follows the rule the single-car form already had: anyone working
 * the inventory can add to it. Users, configuration and inquiries stay
 * admin-only, and those are a different kind of data than stock.
 *
 * `requireAuthSession` is still the gate — the layout is not the only thing
 * standing between the public and this page.
 */
export default async function AdminCarImportPage() {
  await requireAuthSession();

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-6">
        <CarImport />
      </div>
    </div>
  );
}
