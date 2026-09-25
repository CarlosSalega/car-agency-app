import { Loader2 } from "lucide-react";

export default function GlobalLoading() {
  return (
    <div className="bg-background fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <Loader2 className="text-muted-foreground size-16 animate-spin" />
          <div className="border-muted-foreground/10 absolute inset-0 animate-ping rounded-full border-4" />
        </div>
        <div className="text-center">
          <p className="text-muted-foreground text-sm">Cargando...</p>
        </div>
      </div>
    </div>
  );
}
