# Mercado Libre integration

What it takes to link the dealership's Mercado Libre account and publish the inventory
on their behalf. Everything below was verified against ML's developer documentation in
2026-11; the dates matter because ML changes fields with cut-off dates.

## What ML actually requires (verified)

- **OAuth 2.0, authorization code grant.** ML validates the account; we never see a
  password.
  - Authorize: `https://auth.mercadolibre.com.ar/authorization` with `response_type=code`,
    `client_id`, `redirect_uri`, `state`, `code_challenge`, `code_challenge_method=S256`.
  - Exchange: `POST https://api.mercadolibre.com/oauth/token` with the parameters in the
    **body**, `application/x-www-form-urlencoded`, not in a query string.
- **`access_token` lasts 6 hours.** The **`refresh_token` is single-use**: every refresh
  returns a new one. Two concurrent refreshes invalidate each other.
- **The authorizing user must be an administrator** of the ML account. An operator or
  collaborator gets `invalid_operator_user_id`.
- **`redirect_uri` must match the registered one exactly** and cannot carry variable
  information.
- The application is created in "Mis aplicaciones" (Client ID + Secret Key), ideally from
  the owner's account so it does not need transferring later.
- **Vehicles require a contracted package.** "En vehículos, para publicar un anuncio, el
  vendedor necesita tener contratado un paquete de publicación", contracted with ML's
  commercial team. Packages start at 15 listings (~$1.162.500, Oct 2025, sin IVA, CABA &
  GBA). There is **no free tier** for vehicles.
- **Publishing needs photos**: the `gold*` listing types have `requires_picture: true`,
  otherwise `LTP_PICTURE_REQUIRED`.
- Category `MLA1744` for cars, with `MLA1744-MARC` and `MLA1744-MODL` marked required.
  Attributes come from `GET /categories/MLA1744/attributes` — **never hardcoded**, because
  ML changes them with announced dates.
- Vehicle listings are classifieds: contact details are public and no transaction happens
  on ML, so an interested buyer does **not** enter our lead pipeline.

## Plan

| Phase | What                                                              | Buildable without the client     |
| ----- | ----------------------------------------------------------------- | -------------------------------- |
| A     | Link the account: OAuth, sealed tokens, disconnect                | **Yes** (ML provides test users) |
| B     | Token lifecycle: single-flight refresh, revocation                | **Yes**                          |
| C     | Check package and account state before offering "Publish"         | Partly                           |
| D     | Publish a car: attributes read from the API, photos, listing type | No                               |
| E     | Sync: price and availability on edit, close the item when sold    | No                               |

## A and B — done

`44370a8`, `9b7b45a`, `b190db0`, `c3e0d74`.

- `/admin/config/mercadolibre` shows three honest states: not configured (naming the
  missing variables), not linked, linked with account and token expiry.
- `authorize` → `callback` → `disconnect`, with `state` and PKCE in short-lived httpOnly
  cookies scoped to the path.
- Tokens are sealed with **AES-256-GCM** in their own table (`MeliAccount`), not in the
  generic `Settings` key/value store, which has a listing endpoint.
- Refresh is **single-flight**; it runs ahead of expiry; a network error keeps the tokens
  while `invalid_grant` clears them and asks for a re-link.
- `disconnect` is a form POST and compares `Origin`.

Environment variables (documented in `.env.example`): `MELI_CLIENT_ID`,
`MELI_CLIENT_SECRET`, `MELI_REDIRECT_URI`, `MELI_TOKEN_ENCRYPTION_KEY`, optional
`MELI_AUTH_HOST`. With any of the four missing, the integration reports itself as not
configured — there is no path that stores a token in the clear.

## Blocked on the client

C, D and E need: the app registered in ML (client id + secret), the dealership's ML
account with a **contracted package**, and a fixed `redirect_uri` for the real domain.
Until then, linking can be built and tested against ML **test users**, but publishing
cannot be verified.
