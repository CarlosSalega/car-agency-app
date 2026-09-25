export function StatsSection() {
  const stats = [
    { value: "+500", label: "Vehículos Vendidos" },
    { value: "98%", label: "Clientes Satisfechos" },
    { value: "+20", label: "Años de Experiencia" },
    { value: "24hs", label: "Entrega Express" },
  ];

  return (
    <section className="bg-muted/50 flex min-h-80 items-center py-12">
      <div className="container mx-auto px-4 text-center">
        <h3 className="mb-8 text-2xl font-bold">
          Nuestros clientes confian en nosotros y nos recomiendan.
        </h3>
        <div className="flex flex-wrap items-center justify-center gap-8 opacity-60">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl font-bold text-green-500">
                {stat.value}
              </div>
              <div className="text-sm">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
