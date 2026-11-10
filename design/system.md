# Design system — Autos Demo

Capturado de las fuentes del proyecto el **2026-11-02**, en `feat/landing-redesign`.
Solo se registran valores que existen en el código; lo que no está acá no es un token del
proyecto.

**Fuentes leídas**

| Fuente                    | Qué aporta                                                      |
| ------------------------- | --------------------------------------------------------------- |
| `src/app/globals.css`     | rampa neutra, semánticos, tipografías, radios, sombras, spacing |
| `src/site/demo/theme.css` | los dos tokens de identidad (`--brand`, `--brand-foreground`)   |
| `src/app/layout.tsx`      | las familias reales cargadas por `next/font`                    |

---

## Color

### Superficies

| Token          | Valor     | Uso                       | Fuente            |
| -------------- | --------- | ------------------------- | ----------------- |
| `--background` | `#121212` | fondo de página           | `globals.css:86`  |
| `--card`       | `#141414` | superficie de tarjeta     | `globals.css:90`  |
| `--popover`    | `#1c1c1c` | capa elevada (menús)      | `globals.css:94`  |
| `--secondary`  | `#1c1c1c` | superficie secundaria     | `globals.css:118` |
| `--muted`      | `#1c1c1c` | fondo apagado             | `globals.css:122` |
| `--accent`     | `#242424` | hover / superficie activa | `globals.css:126` |
| `--sidebar`    | `#1c1c1c` | raíl del panel            | `globals.css:152` |

### Texto

| Token                 | Valor     | Uso                  | Fuente            |
| --------------------- | --------- | -------------------- | ----------------- |
| `--foreground`        | `#f5f5f5` | texto principal      | `globals.css:87`  |
| `--subtle-foreground` | `#c4c7c8` | cuerpo secundario    | `globals.css:161` |
| `--muted-foreground`  | `#a3a3a3` | etiquetas, metadatos | `globals.css:123` |

### Identidad y acción

| Token                  | Valor     | Uso                                                    | Fuente                       |
| ---------------------- | --------- | ------------------------------------------------------ | ---------------------------- |
| `--brand`              | `#6ea8fe` | color de identidad: wordmark, indicador activo, acento | `src/site/demo/theme.css:16` |
| `--brand-foreground`   | `#000000` | texto sobre `--brand`                                  | `src/site/demo/theme.css:17` |
| `--primary`            | `#f5f5f5` | la acción: botón principal                             | `globals.css:104`            |
| `--primary-foreground` | `#121212` | texto sobre `--primary`                                | `globals.css:105`            |
| `--ring`               | `#6ea8fe` | anillo de foco                                         | `globals.css:115`            |

### Líneas

| Token      | Valor     | Uso               | Fuente            |
| ---------- | --------- | ----------------- | ----------------- |
| `--border` | `#2a2a2a` | borde por defecto | `globals.css:113` |
| `--input`  | `#3d3d3d` | borde de campo    | `globals.css:114` |

### Estado

| Token           | Valor     | Uso                        | Fuente            |
| --------------- | --------- | -------------------------- | ----------------- |
| `--destructive` | `#ff5c5c` | error / destructivo        | `globals.css:132` |
| `--success`     | `#4ade80` | disponible / confirmado    | `globals.css:158` |
| `--warning`     | `#fcd34d` | estrellas de reseña, aviso | `globals.css:163` |
| `--info`        | `#60a5fa` | informativo                | `globals.css:160` |

### Contrastes medidos en el código

- `#f5f5f5` sobre `#121212` → **17.2:1**
- `#a3a3a3` sobre `#121212` → **7.6:1**
- `#6ea8fe` sobre `#121212` → **4.65:1** (AA para texto grande y UI; **no** para texto chico)
- `#000000` sobre `#6ea8fe` → **5.21:1**
- `#6ea8fe` sobre `#f5f5f5` → **4.03:1** (falla AA: por eso el rojo nunca se usa como
  texto sobre superficie clara)

## Tipografía

| Rol                               | Familia       | Stack                                          | Fuente                             |
| --------------------------------- | ------------- | ---------------------------------------------- | ---------------------------------- |
| Sans (UI y titulares)             | **Afacad**    | `Afacad, ui-sans-serif, sans-serif, system-ui` | `globals.css:162`, `layout.tsx:26` |
| Serif (citas)                     | **Adamina**   | `Adamina, ui-serif, serif`                     | `globals.css:163`, `layout.tsx:31` |
| Mono (datos, precios, contadores) | **Fira Code** | `Fira Code, ui-monospace, monospace`           | `globals.css:164`, `layout.tsx:37` |

`--tracking-normal: -0.025em` (`globals.css:172`). Los artboards usan stacks del sistema
porque el contrato prohíbe fuentes externas: en producción estas tres familias son las
que se cargan.

## Espaciado

`--spacing: 0.25rem` (`globals.css:173`) — escala de 4px. Los artboards usan la misma
escala: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128.

## Radio

`--radius: 0.5rem` (`globals.css:165`), consumido como `rounded-lg` en tarjetas y
`rounded-full` en el botón flotante de WhatsApp.

> **No es un token de este rediseño.** El brief pide esquinas rectas en la superficie
> pública: el rediseño fija `--r: 0` y no toca `--radius` global, para no arrastrar el
> panel de administración a un cambio de lenguaje visual que no pidió.

## Sombra

| Token                         | Valor                                                       | Fuente                |
| ----------------------------- | ----------------------------------------------------------- | --------------------- |
| `--shadow-sm` … `--shadow-xl` | derivados de `0 0.2rem 0.5rem 0 #000000` con alpha 0.2–0.75 | `globals.css:166-171` |

> El rediseño **no usa sombras** en la superficie pública: la jerarquía se construye con
> línea de 1px y contraste de superficie. `shadow-sm` sobrevive donde ya existe
> (tarjetas del panel).

## Componentes (reglas vigentes)

| Componente       | Regla                                                                                        | Fuente                                          |
| ---------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Botón primario   | `bg-primary` + `text-primary-foreground`, alto 56px, texto bold uppercase con tracking ancho | `(landing)/components/Reviews.tsx:186`          |
| Tarjeta          | `bg-card` + `border-border` + `rounded-lg`                                                   | `(landing)/components/Reviews.tsx:150`          |
| Foco             | anillo `--ring` (`#6ea8fe`) con `focus-visible`                                              | `globals.css:115`                               |
| Select / trigger | Base UI con `items` obligatorio para etiquetar el valor                                      | `src/components/__tests__/select-items.test.ts` |
| Badge de estado  | variantes `default`, `secondary`, `destructive`, `outline`                                   | `src/components/ui/badge.tsx`                   |
