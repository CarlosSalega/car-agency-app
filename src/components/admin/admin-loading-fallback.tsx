import { SquareLoader } from "@/components/ui/square-loader";

interface AdminLoadingFallbackProps {
  label?: string;
}

/**
 * The panel's loading state, with the same square as the public site so the two
 * do not speak different languages. The label is visible here: inside the panel the
 * wait happens between two screens of the same tool, and naming it helps.
 */
export function AdminLoadingFallback({
  label = "Cargando…",
}: AdminLoadingFallbackProps) {
  return (
    <div className="bg-background min-h-screen">
      {/* The offset tracks the admin shell's slim bar, which is `h-16`. */}
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-6">
        <SquareLoader label={label} showLabel size="sm" />
      </div>
    </div>
  );
}
