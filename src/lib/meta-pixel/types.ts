/**
 * Meta Pixel event type contract.
 *
 * The `as const` object is the single source of truth: the `MetaPixelEvent`
 * union is derived from its keys/values, so renaming or adding an event only
 * requires editing the constant. `Lead` and `Search` are reserved for future
 * use (R7) — they MUST NOT have any `track()` call sites in this PR.
 */
export const META_PIXEL_EVENTS = {
  PAGE_VIEW: "PageView",
  VIEW_CONTENT: "ViewContent",
  CONTACT: "Contact",
  LEAD: "Lead",
  SEARCH: "Search",
} as const;

export type MetaPixelEvent =
  (typeof META_PIXEL_EVENTS)[keyof typeof META_PIXEL_EVENTS];

/** Payload for `ViewContent` events on vehicle detail pages. */
export interface ViewContentData {
  content_name: string;
  content_category: "vehicle";
  brand: string;
  model: string;
  year: number;
  price: number;
}

/** Payload for `Contact` events. `method` identifies the contact channel. */
export interface ContactData {
  method: "whatsapp" | "phone" | "email" | "maps";
}

/**
 * Maps every event to its required payload shape. Events with no payload
 * (e.g. `PageView`) map to `undefined` so the generic `TrackFunction` can
 * derive whether the second argument is required.
 */
export type EventDataMap = {
  PageView: undefined;
  ViewContent: ViewContentData;
  Contact: ContactData;
  Lead: undefined;
  Search: undefined;
};

/**
 * Type-safe tracking function. The second argument is omitted when the event
 * has no payload, and required when it does — the conditional rest tuple
 * enforces this at the call site without overloads.
 *
 * `[EventDataMap[E]] extends [undefined]` is written as a single-element tuple
 * on purpose: a naked `EventDataMap[E] extends undefined ? ... : ...` distributes
 * over the union of every event payload and yields `[] | [T]`, which is not
 * assignable to `[T]`. Wrapping the checked type in a tuple suppresses
 * distribution, so the rest parameter resolves to exactly `[]` or `[data: T]`.
 */
export type TrackFunction = <E extends MetaPixelEvent>(
  event: E,
  ...args: [EventDataMap[E]] extends [undefined] ? [] : [data: EventDataMap[E]]
) => void;
