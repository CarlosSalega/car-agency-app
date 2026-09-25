import { CarForm } from "@/components/cars";

export default async function NewCarPage() {
  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <CarForm mode="create" />
      </div>
    </div>
  );
}
