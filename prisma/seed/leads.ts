import type { LeadStatus } from "@generated/prisma/enums";

/**
 * Demo inquiries for the panel.
 *
 * **This is simulated data.** It only exists in a seeded development database:
 * `pnpm db:seed` refuses to run outside development, and it wipes the tables
 * first, so these rows can never mix with real inquiries. Phones carry the `555`
 * convention so a real one is never mistyped from a demo screenshot.
 *
 * The numbers are derived from the owner's premise — **8 cars sold per week** —
 * rather than invented independently:
 *
 * - 8 sales a week means 8 `WON` per completed week.
 * - The panel's closing rate is `won / (won + lost)`, so at a realistic ~30% the
 *   other ~19 leads per week are `LOST`. Seeding 8 inquiries a week instead would
 *   render "8 inquiries, 2 sales" and contradict the premise.
 * - Only the last two weeks keep leads open. An inquiry from two months ago that
 *   is still `NEW` would inflate "Esperando respuesta" to a number no dealership
 *   would recognise.
 *
 * A seeded PRNG keeps the output identical across reseeds: a demo whose numbers
 * change every time is impossible to talk about.
 */

export const SALES_PER_WEEK = 8;
export const LEAD_WEEKS = 12;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export interface SeedLeadCar {
  id: string;
  sellerId: string | null;
  /** Cars still on the placeholder photo must not top the ranking in a demo. */
  hasImages?: boolean;
}

export interface SeedLead {
  name: string;
  phone: string;
  email: string | null;
  message: string | null;
  status: LeadStatus;
  source: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrer: string | null;
  consentAt: Date;
  notes: string | null;
  carId: string | null;
  sellerId: string | null;
  createdAt: Date;
}

/** mulberry32: tiny, deterministic, good enough for fixtures. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_NAMES = [
  "Ana",
  "Beto",
  "Carla",
  "Diego",
  "Elena",
  "Fede",
  "Gaby",
  "Hugo",
  "Inés",
  "Juli",
  "Karina",
  "Lucho",
  "Marisa",
  "Nico",
  "Ornella",
  "Pablo",
  "Quique",
  "Rocío",
  "Seba",
  "Tamara",
  "Ulises",
  "Valeria",
  "Wanda",
  "Yago",
];

const LAST_NAMES = [
  "Pérez",
  "Gómez",
  "Rodríguez",
  "Fernández",
  "López",
  "Martínez",
  "Sosa",
  "Romero",
  "Díaz",
  "Torres",
  "Ruiz",
  "Benítez",
  "Acosta",
  "Medina",
];

const MESSAGES = [
  "¿Sigue disponible?",
  "¿Aceptan permuta?",
  "Quisiera verlo este fin de semana.",
  "¿Se puede financiar?",
  "¿Tiene service oficial?",
  "Me interesa, ¿me pasás más fotos?",
  "¿Cuál es el precio final?",
  null,
  null,
  null,
];

const CHANNELS: {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
}[] = [
  { utmSource: "instagram", utmMedium: "cpc", utmCampaign: "usados-santafe" },
  { utmSource: "instagram", utmMedium: "cpc", utmCampaign: "usados-santafe" },
  { utmSource: "instagram", utmMedium: "cpc", utmCampaign: "0km" },
  { utmSource: "google", utmMedium: "organic", utmCampaign: null },
  { utmSource: "facebook", utmMedium: "cpc", utmCampaign: "permuta" },
  { utmSource: null, utmMedium: null, utmCampaign: null },
  { utmSource: null, utmMedium: null, utmCampaign: null },
];

function pick<T>(random: () => number, values: readonly T[]): T {
  return values[Math.floor(random() * values.length)];
}

/**
 * Cars are not picked uniformly: a real lot has three or four units that draw
 * most of the inquiries, and the rest barely move. That is what makes the
 * "most consulted cars" table worth looking at.
 */
function pickCar(
  random: () => number,
  cars: readonly SeedLeadCar[],
): SeedLeadCar | null {
  if (cars.length === 0) return null;

  // The popular block is the first third, but only among cars that have real
  // photos: a demo whose "most consulted" is topped by a car showing a
  // placeholder is a demo that argues against itself.
  const withPhotos = cars.filter((car) => car.hasImages !== false);
  const pool = withPhotos.length > 0 ? withPhotos : cars;
  const popular = pool.slice(0, Math.max(1, Math.ceil(pool.length / 3)));

  const roll = random();
  if (roll < 0.7) return pick(random, popular);
  if (roll < 0.95) return pick(random, pool);
  return null;
}

export function buildSeedLeads({
  cars,
  now = new Date(),
  seed = 20261101,
}: {
  cars: readonly SeedLeadCar[];
  now?: Date;
  seed?: number;
}): SeedLead[] {
  const random = createRandom(seed);
  const leads: SeedLead[] = [];
  let phoneCounter = 0;

  for (let week = LEAD_WEEKS - 1; week >= 0; week -= 1) {
    const isCurrentWeek = week === 0;
    const isLastWeek = week === 1;

    // The current week is partial: half the sales, and a pipeline still open.
    const won = isCurrentWeek ? Math.round(SALES_PER_WEEK / 2) : SALES_PER_WEEK;
    const lost = isCurrentWeek ? 6 : 17 + Math.floor(random() * 4); // 17-20, so the weekly total is not flat
    const open = isCurrentWeek ? 8 : isLastWeek ? 3 : 0;

    const outcomes: LeadStatus[] = [
      ...Array<LeadStatus>(won).fill("WON"),
      ...Array<LeadStatus>(lost).fill("LOST"),
      ...Array.from({ length: open }, () =>
        pick<LeadStatus>(random, [
          "NEW",
          "NEW",
          "NEW",
          "CONTACTED",
          "NEGOTIATING",
        ]),
      ),
    ];

    for (const status of outcomes) {
      const weekStart = now.getTime() - week * WEEK_MS;
      // Spread inside the week, but never in the future.
      const offset = Math.floor(random() * WEEK_MS);
      const createdAt = new Date(
        Math.min(weekStart - offset, now.getTime() - 60_000),
      );

      const channel = pick(random, CHANNELS);
      const car = pickCar(random, cars);
      phoneCounter += 1;

      leads.push({
        name: `${pick(random, FIRST_NAMES)} ${pick(random, LAST_NAMES)}`,
        // 555 marks a fixture number: nobody can dial a real person by mistake.
        phone: `342 555-${String(1000 + phoneCounter).slice(-4)}`,
        email: random() < 0.4 ? `consulta${phoneCounter}@ejemplo.com` : null,
        message: pick(random, MESSAGES),
        status,
        source: pick(random, ["/autos", "/autos", "/", null]),
        utmSource: channel.utmSource,
        utmMedium: channel.utmMedium,
        utmCampaign: channel.utmCampaign,
        referrer:
          channel.utmSource === "google" ? "www.google.com/search" : null,
        consentAt: createdAt,
        notes:
          status === "WON" || status === "LOST"
            ? "Cerrada durante la demo"
            : null,
        carId: car?.id ?? null,
        sellerId: car?.sellerId ?? null,
        createdAt,
      });
    }
  }

  return leads.sort(
    (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
  );
}
