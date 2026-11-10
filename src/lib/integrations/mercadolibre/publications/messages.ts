import type { MissingAttribute } from "../attributes";

/**
 * What a person reads in the panel, in Spanish.
 *
 * The messages are here instead of inline in the handlers for one reason: T10
 * asks for errors that tell the agency what to do, and a message scattered
 * across five handlers is a message that drifts. Every failure names the thing
 * that is wrong (`Color (COLOR)`), not the HTTP status it produced.
 *
 * No message ever contains a token, a header or a stack trace: the text is
 * stored in `Publication.lastError` and rendered on a page.
 */

const MAX_REASON_LENGTH = 300;

function reason(error: string): string {
  const collapsed = error.replace(/\s+/g, " ").trim();

  return collapsed.length <= MAX_REASON_LENGTH
    ? collapsed
    : `${collapsed.slice(0, MAX_REASON_LENGTH)}…`;
}

function formatAttribute(attribute: MissingAttribute): string {
  return attribute.name === attribute.id
    ? attribute.id
    : `${attribute.name} (${attribute.id})`;
}

function amount(value: number): string {
  return `$ ${value}`;
}

export const publicationMessages = {
  categoryNotPredicted: (title: string): string =>
    `No pudimos predecir la categoría de Mercado Libre para "${title}". Revisá el título del vehículo y volvé a intentar.`,

  missingAttributes: (missing: readonly MissingAttribute[]): string =>
    `Faltan atributos obligatorios de Mercado Libre: ${missing
      .map(formatAttribute)
      .join(", ")}. Completalos en el vehículo antes de publicar.`,

  noPictures: (): string =>
    "El vehículo no tiene fotos. Mercado Libre necesita al menos una imagen para publicar el aviso.",

  notPublished: (): string =>
    "La publicación todavía no tiene un aviso en Mercado Libre. Publicala primero.",

  createRejected: (cause: string): string =>
    `Mercado Libre rechazó la publicación: ${reason(cause)}`,

  updateRejected: (cause: string): string =>
    `Mercado Libre rechazó la actualización de precio: ${reason(cause)}`,

  pauseRejected: (cause: string): string =>
    `Mercado Libre rechazó la pausa del aviso: ${reason(cause)}`,

  closeRejected: (cause: string): string =>
    `Mercado Libre rechazó el cierre del aviso: ${reason(cause)}`,

  syncRejected: (cause: string): string =>
    `No pudimos leer el aviso en Mercado Libre: ${reason(cause)}`,

  divergedPrice: (remotePrice: number, snapshotPrice: number): string =>
    `El precio en Mercado Libre (${amount(remotePrice)}) no coincide con el último que enviamos (${amount(snapshotPrice)}). Elegí si importar el de Mercado Libre o imponer el de la web.`,
};
