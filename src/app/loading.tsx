import { SquareLoader } from "@/components/ui/square-loader";

/**
 * The global loading state.
 *
 * It is a flow container, not a `fixed inset-0` overlay with `backdrop-blur`: Next
 * renders this while the next route resolves, and blocking the whole page (and
 * blurring it) for a navigation that usually takes a few hundred milliseconds makes
 * the wait feel longer, not shorter.
 */
export default function GlobalLoading() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <SquareLoader />
    </div>
  );
}
