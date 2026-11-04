"use client";

import { useState } from "react";

import { activeSite } from "@/site/active";

/**
 * Free appraisal, as the entry point of the deal.
 *
 * The owner asked for the appraisal block and, explicitly, for "sin cargo" instead
 * of "sin compromiso": the phrase promises there is no cost, without the defensive
 * tone the other one carries in this market.
 *
 * Why it is a form that opens WhatsApp instead of a form that posts somewhere: the
 * number that matters cannot be produced by a form. A real appraisal needs the
 * vehicle in the salon. What the form does is remove the first step — the visitor
 * does not have to write a message from scratch, and the seller receives the three
 * facts the counter will ask for anyway.
 *
 * The sentence at the bottom says that out loud: the range gets confirmed with the
 * car in front of us.
 */
export function AppraisalSection() {
  const { whatsapp } = activeSite;
  const [vehicle, setVehicle] = useState("");
  const [year, setYear] = useState("");
  const [kilometers, setKilometers] = useState("");

  const ready = vehicle.trim().length > 1 && year.trim().length > 0;

  const href = whatsapp.hrefWith(
    [
      "Hola! Quiero que me tasen el vehículo.",
      "",
      `Vehículo: ${vehicle.trim() || "-"}`,
      `Año: ${year.trim() || "-"}`,
      `Kilómetros: ${kilometers.trim() || "-"}`,
    ].join("\n"),
  );

  return (
    <section
      id="tasacion"
      className="bg-secondary border-border scroll-mt-[88px] border-b py-20"
    >
      <div className="mx-auto grid w-full max-w-[1320px] items-start gap-10 px-7 lg:grid-cols-[1fr_0.9fr]">
        <div>
          <p className="text-muted-foreground mb-2 flex items-center gap-3 font-mono text-[11px] tracking-[0.16em] uppercase">
            <s aria-hidden="true" className="bg-brand block h-px w-7" />
            Tasación sin cargo
          </p>
          <h2 className="text-[clamp(26px,3vw,38px)] leading-[1.05] font-bold tracking-[-0.02em]">
            Decinos qué tenés. Te decimos cuánto vale.
          </h2>

          <p className="text-subtle-foreground mt-5 max-w-[48ch] text-[15px] leading-relaxed">
            Lo revisamos en el salón y te damos el valor de toma el mismo día.
            Ese número es el que se descuenta del precio de la unidad que te
            llevás, y podés usarlo acá o compararlo con otra agencia.
          </p>

          <ul className="text-subtle-foreground mt-6 grid gap-2.5 text-sm">
            <li className="flex items-start gap-2.5">
              <i
                aria-hidden="true"
                className="bg-brand mt-1.5 block size-1.5 shrink-0"
              />
              Autos, motos, camionetas y utilitarios.
            </li>
            <li className="flex items-start gap-2.5">
              <i
                aria-hidden="true"
                className="bg-brand mt-1.5 block size-1.5 shrink-0"
              />
              Con o sin deuda: si tiene prenda, lo resolvemos nosotros.
            </li>
            <li className="flex items-start gap-2.5">
              <i
                aria-hidden="true"
                className="bg-brand mt-1.5 block size-1.5 shrink-0"
              />
              La tasación es sin cargo y no te obliga a comprar.
            </li>
          </ul>
        </div>

        <form
          className="border-line-strong bg-background grid gap-4 border p-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (!ready) return;
            window.open(href, "_blank", "noopener,noreferrer");
          }}
        >
          <p className="text-muted-foreground m-0 font-mono text-[10px] tracking-[0.16em] uppercase">
            Pedí tu tasación
          </p>

          <label className="grid gap-1.5">
            <span className="text-subtle-foreground text-xs">
              Vehículo (marca, modelo y versión)
            </span>
            <input
              value={vehicle}
              onChange={(event) => setVehicle(event.target.value)}
              placeholder="Volkswagen Taos Highline"
              className="border-line-strong bg-ground text-foreground placeholder:text-muted-foreground focus:border-brand h-11 w-full border px-3 font-sans text-sm focus:outline-none"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="grid gap-1.5">
              <span className="text-subtle-foreground text-xs">Año</span>
              <input
                value={year}
                onChange={(event) => setYear(event.target.value)}
                inputMode="numeric"
                placeholder="2021"
                className="border-line-strong bg-ground text-foreground placeholder:text-muted-foreground focus:border-brand h-11 w-full border px-3 font-mono text-sm focus:outline-none"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-subtle-foreground text-xs">Kilómetros</span>
              <input
                value={kilometers}
                onChange={(event) => setKilometers(event.target.value)}
                inputMode="numeric"
                placeholder="45000"
                className="border-line-strong bg-ground text-foreground placeholder:text-muted-foreground focus:border-brand h-11 w-full border px-3 font-mono text-sm focus:outline-none"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={!ready}
            className="bg-brand hover:bg-brand/90 mt-1 flex h-11 w-full cursor-pointer items-center justify-center px-5 font-mono text-[11px] font-bold tracking-[0.16em] text-black uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          >
            Pedir tasación por WhatsApp
          </button>

          <p className="text-muted-foreground m-0 text-xs leading-relaxed">
            Se abre WhatsApp con los datos cargados. El número final se confirma
            con el vehículo en el salón.
          </p>
        </form>
      </div>
    </section>
  );
}
