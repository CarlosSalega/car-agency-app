/**
 * The honeypot field name, isolated from the zod schema on purpose: the client
 * form needs the string, and importing `validations/lead` would pull zod into
 * the browser bundle for a constant.
 *
 * A person never fills this field. It is rendered off-screen and hidden from
 * assistive technology, so an empty value is the norm and a filled one means a
 * script walked the DOM.
 */
export const LEAD_HONEYPOT_FIELD = "company";
