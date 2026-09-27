# Arreglar el radio real y el espaciado colapsado del sidebar

## Objetivo

Hacer que los items del sidebar se vean efectivamente redondeados, y que al colapsar el sidebar los items no se peguen al borde derecho.

## Por qué

Dos defectos distintos, reportados por el usuario con capturas de DevTools. **Ninguno de los dos es la clase `rounded-*`**, que es lo que se venía ajustando a ciegas en intentos anteriores.

### Defecto 1 — `--radius:0` anula todos los radios del sidebar

`src/components/ui/sidebar.tsx:254` monta el `sidebar-inner` con `[--radius:0]`. Esa variable CSS **cascada a todos los descendientes**, y `src/app/globals.css:257` define la escala como:

```css
--radius-md: calc(var(--radius) - 2px);
```

Con `--radius: 0`, `rounded-md` computa `calc(0px - 2px)` = `-2px`, que es inválido en `border-radius`, así que la declaración se descarta y el radio queda en `0px`.

**Consecuencia:** las clases `rounded-*` aparecen aplicadas en DevTools y no producen nada. Cambiar `rounded-sm` por `rounded-md` o `rounded-lg` no puede mover el resultado: la variable que las genera está en cero. La clase `rounded-md` de `sidebarMenuButtonVariants` **ya estaba correcta**; lo que la anulaba es la variable.

Procedencia: `git log -L 254,254` lo atribuye a `cd878c0 feat(ui): add the sidebar block composed on Base UI primitives`. El valor veio con el bloque original y nunca se reviso.

### Defecto 2 — un boton de 32px dentro de una caja de 16px al colapsar

| Dato                        | Valor                                        | Origen            |
| --------------------------- | -------------------------------------------- | ----------------- |
| Ancho del sidebar colapsado | `SIDEBAR_WIDTH_ICON = "3rem"` = **48px**     | `sidebar.tsx:56`  |
| Padding de `SidebarGroup`   | `px-4` = 16px por lado -> contenido **16px** | `sidebar.tsx:363` |
| Ancho del boton colapsado   | `size-8!` = **32px**                         | `sidebar.tsx:414` |

El boton desborda 16px a la derecha y lo recorta el borde del contenedor, que es el sintoma reportado. Ademas el boton es `flex items-center` **sin** `justify-center`, asi que los 32px se alinean al inicio de una caja de 16px, se empujan a la derecha y el icono queda corrido del centro.

## Alcance autorizado

Tres cambios, todos en `src/components/ui/sidebar.tsx`. Ningun otro archivo.

1. **`sidebar.tsx:254`** — eliminar `[--radius:0]` de `sidebar-inner`.
2. **`sidebar.tsx:363`** — anadir `group-data-[collapsible=icon]:px-2` a `SidebarGroup`.
3. **`sidebar.tsx:414`** — anadir `group-data-[collapsible=icon]:justify-center` a `sidebarMenuButtonVariants`.

### Correccion de iteracion: `px-0` fue un sobrecorrido

La primera version de este arreglo uso `px-0` en el punto 2. **Estaba mal y el usuario lo reporto de inmediato: al colapsar los items se pegaron a la izquierda.**

El error fue tratar el padding como el problema cuando el problema era la _caja_:

| Padding colapsado | Caja de contenido | Boton | Resultado                                      |
| ----------------- | ----------------- | ----- | ---------------------------------------------- |
| `px-4` (16px)     | 16px              | 32px  | desborda 16px a la derecha, lo recorta el rail |
| `px-0` (0px)      | 48px              | 32px  | boton al inicio, 16px muertos a la derecha     |
| **`px-2` (8px)**  | **32px**          | 32px  | caja igual al boton, centrado                  |

La respuesta es `(48 - 32) / 2 = 8px` por lado, no cero. **Un padding colapsado correcto hace que la caja de contenido mida exactamente el ancho del boton; esa igualdad es lo que lo centra.** Ni `px-0` ni `px-4` la producen.

Ademas `justify-center` en el boton no centraba el boton: centra el icono dentro de los 32px. Son dos niveles distintos: el padding centra la caja, el `justify-center` centra el contenido dentro de la caja. Se necesitan ambos, y por eso el segundo arreglo los deja.

**Leccion transferible:** cuando un ajuste empuja el problema de un lado al otro, la pregunta correcta no es "cuanto padding le quito" sino "que valor hace que las dos medidas coincidan".

## Riesgo aceptado

Quitar `[--radius:0]` no solo afecta a los botones de navegacion: **todo** lo redondeado dentro del sidebar va a redondearse de golpe. Es el comportamiento correcto, pero el alcance real es mayor que el de los tres items de navegacion. Si algun elemento se vea rectangular a proposito, aparece aqui como seguimiento.

## Criterios de aceptacion

- [ ] `rounded-md` produce un radio visible en `SidebarMenuButton`. **Pendiente de confirmacion visual.**
- [ ] Al colapsar, ningun item toca el borde derecho del sidebar. **Pendiente de confirmacion visual.**
- [ ] Al colapsar, el icono queda centrado en su caja de 32px. **Pendiente de confirmacion visual.**
- [ ] Ningun otro layout del sidebar se desplaza respecto al estado actual. **Pendiente de confirmacion visual.**

## Checks

- [x] `pnpm exec tsc --noEmit` -> exit 0.
- [x] `pnpm exec prettier --check src/components/ui/sidebar.tsx` -> `All matched files use Prettier code style!`
- [x] `pnpm exec eslint src/components/ui/sidebar.tsx` -> sin salida, 0 problemas.
- [x] Barrido de residuos: `grep -- "--radius:0"` sobre `src/` no encuentra ningun otro reset. Los dos `--radius: 0.5rem` de `globals.css:104,188` son los legítimos (tema claro y oscuro). No queda ningun ancestro que vuelva a anular el radio.
- [ ] **Confirmacion visual del usuario.** Este repo no tiene motor de layout en los tests: jsdom no calcula radio ni desbordamiento. Un test verde aqui NO prueba los pixeles. La prueba real es la captura del navegador, y ya se perdio una vez por confundir verificacion automatica con verificacion visual.

## Estado

Los tres cambios aplicados, checks automaticos en verde, **sin commit todavia**. Se espera la confirmacion visual antes de commitear, porque el diff no esta committeado hasta que los pixeles esten confirmados.

Diff: 1 archivo, +13/-3, tres lineas de clase y tres bloques de comentario que explican el porqué.

## Rollback

`git checkout HEAD -- src/components/ui/sidebar.tsx`, o `git revert` del commit cuando exista.
