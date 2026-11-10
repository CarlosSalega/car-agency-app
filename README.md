# Car Agency App

Plataforma **white-label para concesionarias**: un despliegue por cliente, con catálogo público, panel de
gestión y publicación en MercadoLibre desde un solo lugar.

La identidad del cliente — nombre, teléfono, dirección, colores, copy y catálogo — vive en
`src/site/<cliente>/`. El producto no sabe de qué concesionaria se trata, y hay un test que lo verifica.

## Qué incluye

- **Catálogo público** con filtros por marca, modelo, año, precio y combustible, ficha por vehículo con
  galería, y datos estructurados (`AutoDealer`) para buscadores.
- **Panel de gestión**: vehículos, marcas y modelos, vendedores, usuarios con roles, consultas con
  atribución de canal, reseñas, links y ajustes.
- **Pipeline de imágenes**: subida con guardas de identidad, validación y propiedad; borrado de huérfanas;
  un módulo sin acoplamiento al producto.
- **Publicación en MercadoLibre** (en desarrollo): cola de jobs durable, tokens cifrados, y handlers para
  publicar, actualizar precio, pausar y cerrar.

## Stack

|           |                                                                       |
| --------- | --------------------------------------------------------------------- |
| Framework | Next.js 16 (App Router, RSC)                                          |
| Datos     | PostgreSQL + Prisma 7                                                 |
| Auth      | better-auth (sesión, roles, 2FA)                                      |
| UI        | React 19, Tailwind CSS 4, Base UI                                     |
| Imágenes  | Cloudinary, detrás de un puerto propio                                |
| Tests     | Vitest — 816 pruebas, más la suite de contrato viva contra Cloudinary |

## Cómo está construido

Tres decisiones explican casi todo el código:

**Un despliegue por cliente, sin `tenantId`.** El cliente es configuración que viaja con el código. Se
resuelve una vez, por `SITE_SLUG`, en `src/site/active.ts`; si la variable falta o el slug no existe, **el
build falla**. Un fallback silencioso terminaría mostrando el nombre y el teléfono de una concesionaria en
el sitio de otra.

**Cuatro archivos son del despliegue, no del producto.** `src/site/registry.ts`, `src/site/theme.css`,
`src/site/seed.ts` y el paquete `src/site/<cliente>/`. Un comando los preserva al actualizar un
despliegue: `pnpm sync:deployment --to=<ruta>`, en seco por defecto y sin `--force` en ninguna parte.

**Los módulos no se empaquetan de más.** `MODULES.md` fija la regla: se extrae dentro del repositorio
mientras haya un consumidor, y se promueve a paquete el día que un segundo proyecto lo importe.
`src/modules/image-uploads/` es el ejemplo: puerto de tres métodos, guardas puras, adaptadores delgados y
un test que falla si alguna vez importa la aplicación.

## Cómo correrlo

Necesitás PostgreSQL, una cuenta de Cloudinary y el archivo de variables que está en la raíz del repo —
copiá el de ejemplo y completá los valores.

```bash
pnpm install
SITE_SLUG=demo pnpm db:push       # el esquema, por ahora sin migraciones
pnpm db:seed                      # catálogo demo, un vendedor ficticio, sin reseñas
pnpm dev
```

Entrá en `/admin` con `admin@example.com` / `admin1234`. **Esa credencial es de desarrollo**: un
despliegue real tiene que crear sus usuarios y cambiarla.

`SITE_SLUG` es obligatorio: sin él, `dev` y `build` fallan explicando qué hacer.

## Sumar un cliente nuevo

1. Copiá `src/site/demo/` a `src/site/<cliente>/` y reemplazá identidad, colores, copy y catálogo.
2. Registralo en `src/site/registry.ts`.
3. Apuntá `src/site/theme.css` a su `theme.css` y `src/site/seed.ts` a su `seed/`.
4. Nada fuera de `src/site/` cambia.

Después, para mantenerlo al día con el producto: `pnpm sync:deployment --to=<ruta del despliegue>`.

## Otros comandos

|                                   |                                                                    |
| --------------------------------- | ------------------------------------------------------------------ |
| `pnpm test` / `pnpm test:changed` | la suite completa / sólo lo afectado por cambios sin commitear     |
| `pnpm publications <cmd>`         | publicar, sincronizar, pausar o cerrar un vehículo en MercadoLibre |
| `pnpm drain:jobs`                 | drenar la cola de jobs (en seco por defecto)                       |
| `pnpm sweep:orphans`              | barrido de imágenes huérfanas (en seco por defecto)                |
| `pnpm rotate:tokens`              | recifrar credenciales tras rotar la clave                          |

Todo lo que muta estado tiene dry run por defecto y exige `--confirm`.

## Para leer

| Archivo                               | Qué hay                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------- |
| `AGENTS.md`                           | las reglas del repo: white-label, base de datos en MVP, y qué no tocar    |
| `MODULES.md`                          | cuándo extraer un módulo y cuándo empaquetarlo                            |
| `src/modules/image-uploads/AGENTS.md` | las 17 invariantes del módulo de imágenes                                 |
| `odd/tasks/`                          | el registro de cada decisión: specs, alternativas descartadas y el porqué |

`odd/` es la parte menos habitual del repo. Cada feature dejó un documento con lo que se pidió, lo que se
supuso, lo que la documentación de terceros decía de verdad, y las veces que nos equivocamos. Está más
cerca de un diario de ingeniería que de un changelog.

## Licencia

MIT — ver [`LICENSE`](LICENSE). Se puede usar, modificar y redistribuir citando el aviso de copyright.

Las imágenes de `public/autos/` son fotos de stock y **no** quedan cubiertas por esta licencia: siguen
los términos de la licencia con la que se obtuvieron.
