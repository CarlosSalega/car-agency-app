import { Loader2Icon } from "lucide-react";

interface AdminLoadingFallbackProps {
  label?: string;
}

export function AdminLoadingFallback({
  label = "Cargando...",
}: AdminLoadingFallbackProps) {
  return (
    <div className="bg-background min-h-screen">
      {/* The offset tracks the admin shell's slim bar, which is `h-16`. The
          previous `6rem` assumed the old full-width `h-24` header. */}
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center gap-4 px-4 py-6">
        <Loader2Icon className="text-muted-foreground size-6 animate-spin" />
        <p className="text-muted-foreground text-base font-medium">{label}</p>
      </div>
    </div>
  );
}
