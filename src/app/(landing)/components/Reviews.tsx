"use client";

import { useScrollAnimation } from "../hooks/useScrollAnimation";
import { GoogleLogo } from "../components/ui/GoogleLogo";
import { SectionHeading } from "./ui/SectionHeading";

const GOOGLE_REVIEW_URL =
  "https://www.google.com/search?sca_esv=e2250487dc351849&sxsrf=ANbL-n5j53RmXm8D3TYAM--iQi1foYbr3A:1774276136216&si=AL3DRZEsmMGCryMMFSHJ3StBhOdZ2-6yYkXd_doETEE1OR-qOZghCMLCXBcllZ10uaMWmxAo8z_OP6aYRx5Pb1TKl_jRj9rlvXwtC1OrtlCfCYmGSErdkkquQtz_lBU87n6ZF8dIItPXnzVJZtQ88FDQ9q6w-s0XRw%3D%3D&q=Autos+usados+Santa+Fe+Opiniones&sa=X&ved=2ahUKEwi9ndTWnbaTAxWQp5UCHbasH28Q0bkNegQIJxAH&biw=1358&bih=682&dpr=1";

const REVIEWS = [
  {
    name: "Juli Ballester Diaz",
    date: "hace 3 meses",
    rating: 5,
    text: `Excelente experiencia con Car Agency App! 💯\nFacu nos atendió de diez, fuimos con la idea de comprar un usado y nos terminamos llevando un 0km! 🥳\nLos chicos siempre dispuestos a asesorarnos y a buscar las mejores opciones.\nRápido y sencillo a la hora de pagar y retirar. 💪🏼👏🏻😎\nGracias facussss!`,
    avatar: "JB",
    photo: "/reviews/juli-ballester.webp",
    photoWidth: 60,
    photoHeight: 80,
  },
  {
    name: "Norma Soñez",
    date: "hace 4 meses",
    rating: 5,
    text: "Gracias Facundo por la amabilidad y atención a los detalles que hizo fuese una hermosa experiencia. Gracias al equipo de la concesionaria por el respeto y la sonrisas ,No es común por eso quiero destacarlos! Gracias,y hasta el próximo auto que nos vuelva a reunir!",
    avatar: "NS",
    photo: "/reviews/norma-sonez.webp",
    photoWidth: 60,
    photoHeight: 80,
  },
  {
    name: "Dario Ledesma",
    date: "hace 4 meses",
    rating: 5,
    text: `Excelente atención desde el primer momento! Buen asesoramiento y acompañamiento.\nHoy disfruto de mi 0km! Muchas gracias`,
    avatar: "DL",
    photo: "/reviews/dario-ledesma.webp",
    photoWidth: 89,
    photoHeight: 80,
  },
  {
    name: "Diego Pucheta",
    date: "hace 3 semanas",
    rating: 5,
    text: "Excelente la atención, el asesoramiento de Lionel que me dio mucha confianza en todo, y los detalles 🎁.. un montón 👏 👏 👏 volvería a comprar",
    avatar: "DP",
    photo: "/reviews/diego-pucheta.webp",
    photoWidth: 45,
    photoHeight: 80,
  },
  {
    name: "Marisa Moreno",
    date: "hace 1 mes",
    rating: 5,
    text: "Excelente atención desde el día 1, muy predispuestos los chicos para asesorarnos y aconsejarnos. Muy agradecidos por su agilidad para la entrega de nuestro 0km !!!!",
    avatar: "MM",
    photo: "/reviews/marisa-moreno.webp",
    photoWidth: 60,
    photoHeight: 80,
  },
  {
    name: "Elena Cristaldi",
    date: "hace 3 meses",
    rating: 5,
    text: "Excelente los chicos de Car Agency App. No solo en la atención, si no en el asesoramiento, la rapidez y facilitar la papelería y la entrega!! Un millón de gracias… muy recomendable…",
    avatar: "EC",
    photo: "/reviews/elena-cristaldi.webp",
    photoWidth: 60,
    photoHeight: 80,
  },
];

const OVERALL_RATING = 4.9;
const TOTAL_REVIEWS = 249;

function PartialStar({ fill }: { fill: number }) {
  return (
    <span className="relative inline-block leading-none" aria-hidden="true">
      <span className="text-zinc-300">★</span>
      <span
        className="absolute inset-0 overflow-hidden text-yellow-400"
        style={{ width: `${fill * 100}%` }}
      >
        ★
      </span>
    </span>
  );
}

function Stars({
  rating,
  size = "sm",
  lastStarFill = 1,
}: {
  rating: number;
  size?: "sm" | "lg";
  lastStarFill?: number;
}) {
  const sz = size === "lg" ? "text-2xl" : "text-sm";

  return (
    <div
      role="img"
      className={`flex gap-0.5 ${sz}`}
      aria-label={`Calificación: ${rating} de 5`}
    >
      {[1, 2, 3, 4, 5].map((s) => {
        if (s < rating) {
          return (
            <span key={s} className="text-yellow-400">
              ★
            </span>
          );
        }
        if (s === rating && lastStarFill < 1) {
          return <PartialStar key={s} fill={lastStarFill} />;
        }
        return (
          <span key={s} className="text-zinc-300">
            ★
          </span>
        );
      })}
    </div>
  );
}

function Avatar({ initials }: { initials: string }) {
  const colors = [
    "bg-blue-600",
    "bg-emerald-600",
    "bg-violet-600",
    "bg-rose-600",
    "bg-amber-600",
    "bg-cyan-600",
  ];

  const idx = (initials.charCodeAt(0) + initials.charCodeAt(1)) % colors.length;

  return (
    <div
      className={`flex size-10 items-center justify-center rounded-full ${colors[idx]} text-sm font-bold text-white`}
    >
      {initials}
    </div>
  );
}

type Review = (typeof REVIEWS)[number];

function ReviewCard({ review, index }: { review: Review; index: number }) {
  const { ref, isVisible } = useScrollAnimation<HTMLDivElement>({
    rootMargin: "0px 0px -80px 0px",
  });

  return (
    <article
      ref={ref}
      className={`rounded-lg border border-zinc-200 bg-neutral-100 p-6 shadow-sm transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-zinc-300 hover:shadow-md ${
        isVisible
          ? "translate-y-0 opacity-100"
          : index % 2 === 0
            ? "-translate-x-15 translate-y-10 opacity-0"
            : "translate-x-15 translate-y-10 opacity-0"
      }`}
      style={{
        transitionDelay: isVisible ? `${index * 90}ms` : "0ms",
      }}
    >
      <header className="mb-4 flex items-center gap-3">
        <Avatar initials={review.avatar} />

        <div className="flex-1">
          <p className="text-sm font-bold text-zinc-900">{review.name}</p>
          <p className="text-xs text-zinc-400">{review.date}</p>
        </div>

        {review.photo && (
          <img
            src={review.photo}
            alt={review.name}
            width={review.photoWidth}
            height={review.photoHeight}
            className="h-20 rounded-md object-cover"
            loading="lazy"
          />
        )}
      </header>

      <Stars rating={review.rating} />

      <p className="mt-3 text-sm leading-relaxed text-zinc-600">
        {review.text}
      </p>
    </article>
  );
}

export default function Reviews() {
  const { ref: ctaRef, isVisible: ctaVisible } =
    useScrollAnimation<HTMLDivElement>({
      rootMargin: "0px 0px -100px 0px",
    });

  return (
    <section className="bg-background relative w-full overflow-hidden py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-10">
        {/* HEADER */}
        <SectionHeading
          eyebrow="Lo que dicen nuestros clientes"
          titleStart="Más de"
          titleAccent="1000 sueños"
          titleEnd="cumplidos"
        >
          <a
            href={GOOGLE_REVIEW_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Calificación ${OVERALL_RATING} de 5 en Google con ${TOTAL_REVIEWS} reseñas`}
            className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full border border-zinc-200 bg-white py-2 pr-4 pl-3 shadow-sm transition-all hover:scale-[1.03] hover:shadow-md sm:gap-2.5 sm:pr-5"
          >
            <GoogleLogo className="size-5 shrink-0" />
            <span className="text-xl font-black text-zinc-900">
              {OVERALL_RATING}
            </span>
            <Stars rating={5} size="sm" lastStarFill={0.9} />
            <span className="truncate text-xs text-zinc-500 sm:text-sm">
              {TOTAL_REVIEWS} reseñas
            </span>
          </a>
        </SectionHeading>

        {/* GRID */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {REVIEWS.map((review, i) => (
            <ReviewCard key={review.name} review={review} index={i} />
          ))}
        </div>

        {/* CTA */}
        <div
          ref={ctaRef}
          className={`mt-12 flex flex-col items-center gap-3 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            ctaVisible
              ? "translate-y-0 opacity-100"
              : "translate-y-10 opacity-0"
          }`}
        >
          <p className="text-center text-base text-zinc-500">
            ¿Ya compraste o vendiste con nosotros? <br /> Contanos tu
            experiencia
          </p>

          <a
            href={GOOGLE_REVIEW_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-14 w-full max-w-sm items-center justify-center gap-2.5 rounded-lg bg-zinc-900 px-6 font-bold tracking-widest whitespace-nowrap text-white uppercase transition-all hover:scale-105 hover:bg-black active:scale-95"
          >
            <GoogleLogo className="size-4" />
            <span className="text-xs md:text-base">
              Dejá tu reseña en Google
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
