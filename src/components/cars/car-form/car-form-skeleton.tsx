import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function CarFormSkeleton() {
  return (
    <Card className="mx-auto max-w-2xl px-2 py-6 md:px-4">
      <CardHeader className="px-2">
        <div className="bg-secondary-foreground h-8 w-48 animate-pulse rounded" />
      </CardHeader>
      <CardContent className="space-y-6 px-2">
        <div className="space-y-2">
          <div className="bg-secondary-foreground h-4 w-24 animate-pulse rounded" />
          <div className="bg-secondary-foreground h-10 w-full animate-pulse rounded" />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="bg-secondary-foreground h-4 w-20 animate-pulse rounded" />
            <div className="bg-secondary-foreground h-10 w-full animate-pulse rounded" />
          </div>
          <div className="space-y-2">
            <div className="bg-secondary-foreground h-4 w-24 animate-pulse rounded" />
            <div className="bg-secondary-foreground h-10 w-full animate-pulse rounded" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="bg-secondary-foreground h-4 w-16 animate-pulse rounded" />
            <div className="bg-secondary-foreground h-10 w-full animate-pulse rounded" />
          </div>
          <div className="space-y-2">
            <div className="bg-secondary-foreground h-4 w-20 animate-pulse rounded" />
            <div className="bg-secondary-foreground h-10 w-full animate-pulse rounded" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <div className="bg-secondary-foreground h-4 w-12 animate-pulse rounded" />
            <div className="bg-secondary-foreground h-10 w-full animate-pulse rounded" />
          </div>
          <div className="space-y-2">
            <div className="bg-secondary-foreground h-4 w-16 animate-pulse rounded" />
            <div className="bg-secondary-foreground h-10 w-full animate-pulse rounded" />
          </div>
          <div className="space-y-2">
            <div className="bg-secondary-foreground h-4 w-20 animate-pulse rounded" />
            <div className="bg-secondary-foreground h-10 w-full animate-pulse rounded" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="bg-secondary-foreground h-4 w-16 animate-pulse rounded" />
          <div className="bg-secondary-foreground h-10 w-full animate-pulse rounded" />
        </div>

        <div className="space-y-2">
          <div className="bg-secondary-foreground h-4 w-20 animate-pulse rounded" />
          <div className="bg-secondary-foreground h-32 w-full animate-pulse rounded" />
        </div>

        <div className="space-y-2">
          <div className="bg-secondary-foreground h-4 w-12 animate-pulse rounded" />
          <div className="bg-secondary-foreground h-24 w-full animate-pulse rounded" />
        </div>

        <div className="space-y-2">
          <div className="bg-secondary-foreground h-4 w-8 animate-pulse rounded" />
          <div className="bg-secondary-foreground h-20 w-full animate-pulse rounded" />
        </div>

        <div className="flex gap-4">
          <div className="bg-secondary-foreground h-10 w-32 animate-pulse rounded" />
          <div className="bg-secondary-foreground h-10 w-24 animate-pulse rounded" />
        </div>
      </CardContent>
    </Card>
  );
}
